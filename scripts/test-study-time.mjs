import assert from 'node:assert/strict';
import { getWeeklyChallenge } from '../js/core/weekly-challenge.mjs';
import { SupabaseAdapter } from '../js/core/supabase-adapter.js';
import * as timerApi from '../js/core/study-time.mjs';
import * as eventApi from '../js/core/learner-events.mjs';
const tests = [];
const test = (name, run) => tests.push([name, run]);

class MemoryAdapter {
  constructor() { this.values = new Map(); }
  async get(key, fallback = null) { return this.values.has(key) ? this.values.get(key) : fallback; }
  async set(key, value) { this.values.set(key, structuredClone(value)); return value; }
}

function createSupabaseClient() {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        insert: async (payload) => {
          calls.push({ operation: 'insert', table, payload });
          return { error: null };
        },
        update(payload) {
          const filters = [];
          const query = {
            eq(column, value) { filters.push([column, value]); return query; },
            then(resolve, reject) {
              calls.push({ operation: 'update', table, payload, filters });
              return Promise.resolve({ error: null }).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

test('active timer pauses after idle timeout and resumes on activity', () => {
  assert.equal(typeof timerApi.createStudyTimer, 'function');
  let now = 0;
  const timer = timerApi.createStudyTimer({ now: () => now, idleTimeoutMs: 60_000 });
  timer.start();
  now = 61_000;
  assert.equal(timer.stop(), 60);
  timer.activity();
  now += 1_500;
  assert.equal(timer.stop(), 62);
});

test('active timer pauses while hidden and resumes only when visible', () => {
  let now = 0;
  const timer = timerApi.createStudyTimer({ now: () => now, idleTimeoutMs: 60_000 });
  timer.start();
  now = 5_000;
  timer.setVisible(false);
  now = 65_000;
  timer.setVisible(true);
  now = 70_000;
  assert.equal(timer.stop(), 10);
});

test('guest events and completions persist locally and repeated page visits dedupe', async () => {
  assert.equal(typeof eventApi.recordLearnerEvent, 'function');
  const localAdapter = new MemoryAdapter();
  const pageVisit = {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'page-visited',
    dedupeKey: 'page-visited:dashboard',
    data: { page: 'dashboard' }
  };
  await eventApi.recordLearnerEvent({ localAdapter, client: null, userId: null, event: pageVisit });
  const duplicate = await eventApi.recordLearnerEvent({
    localAdapter,
    client: null,
    userId: null,
    event: { ...pageVisit, id: '00000000-0000-4000-8000-000000000002' }
  });
  assert.equal(duplicate.duplicate, true);
  const stored = await localAdapter.get('learner-events:guest');
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].data.page, 'dashboard');
});

test('concurrent guest events do not overwrite each other', async () => {
  const localAdapter = new MemoryAdapter();
  await Promise.all([
    eventApi.recordLearnerEvent({
      localAdapter,
      client: null,
      userId: null,
      event: { id: '00000000-0000-4000-8000-000000000003', type: 'page-visited', data: { page: 'lessons' } }
    }),
    eventApi.recordLearnerEvent({
      localAdapter,
      client: null,
      userId: null,
      event: { id: '00000000-0000-4000-8000-000000000004', type: 'lesson-opened', data: { lessonId: 'logic-propositions' } }
    })
  ]);
  const stored = await localAdapter.get('learner-events:guest');
  assert.deepEqual(stored.events.map(({ type }) => type).sort(), ['lesson-opened', 'page-visited']);
});

test('flashcard reviews dedupe by card and study session', async () => {
  const localAdapter = new MemoryAdapter();
  const sessionId = '00000000-0000-4000-8000-000000000010';
  const event = {
    id: '00000000-0000-4000-8000-000000000011',
    type: 'flashcard-reviewed',
    dedupeKey: `flashcard:${sessionId}:equivalence-demorgan`,
    data: { sessionId, cardId: 'equivalence-demorgan' }
  };
  await eventApi.recordLearnerEvent({ localAdapter, client: null, userId: null, event });
  await eventApi.recordLearnerEvent({
    localAdapter,
    client: null,
    userId: null,
    event: { ...event, id: '00000000-0000-4000-8000-000000000012' }
  });
  assert.equal((await localAdapter.get('learner-events:guest')).events.length, 1);
});

test('completion records reject empty durations and preserve timed lesson, quiz, and checkpoint results', async () => {
  assert.equal(typeof eventApi.recordActivityCompletion, 'function');
  const localAdapter = new MemoryAdapter();
  await assert.rejects(
    eventApi.recordActivityCompletion({
      localAdapter, client: null, userId: null,
      completion: { id: '00000000-0000-4000-8000-000000000020', type: 'lesson', activityId: 'logic-propositions', durationSeconds: 0 }
    }),
    /duration/i
  );
  await assert.rejects(
    eventApi.recordActivityCompletion({
      localAdapter, client: null, userId: null,
      completion: { id: '00000000-0000-4000-8000-000000000021', type: 'quiz', activityId: 'logic-truth-tables', durationSeconds: -1 }
    }),
    /duration/i
  );

  for (const [index, type, activityId, score, total] of [
    [1, 'lesson', 'logic-propositions', undefined, undefined],
    [2, 'quiz', 'logic-truth-tables', 5, 5],
    [3, 'checkpoint', 'logic-checkpoint', 12, 15]
  ]) {
    await eventApi.recordActivityCompletion({
      localAdapter, client: null, userId: null,
      completion: {
        id: `00000000-0000-4000-8000-00000000002${index}`,
        type,
        activityId,
        durationSeconds: 42,
        completedAt: '2026-11-09T00:30:00.000Z',
        score,
        total
      }
    });
  }
  const completions = (await localAdapter.get('learner-events:guest')).completions;
  assert.deepEqual(completions.map(({ type, durationSeconds }) => [type, durationSeconds]), [
    ['lesson', 42], ['quiz', 42], ['checkpoint', 42]
  ]);
  assert.equal(completions[1].completedAt, '2026-11-09T00:30:00.000Z');
  assert.deepEqual(
    getWeeklyChallenge({ now: '2026-11-08T16:00:00Z', challengeCatalog: [{ id: 'one' }, { id: 'two' }] }).periodKey,
    '2026-W46',
    'Manila week boundary follows Monday midnight rather than UTC midnight'
  );
});

test('signed-in activity uses only the learning event, completion, and study session tables', async () => {
  const supabase = createSupabaseClient();
  const adapter = new SupabaseAdapter(supabase, { id: '00000000-0000-4000-8000-000000000030' }, new MemoryAdapter());
  const localAdapter = new MemoryAdapter();
  await eventApi.recordLearnerEvent({
    localAdapter, client: adapter, userId: adapter.user.id,
    event: {
      id: '00000000-0000-4000-8000-000000000031',
      type: 'practice-question-answered',
      data: { questionId: 'equivalence-demorgan', correct: true, tags: ['de-morgan'] }
    }
  });
  await eventApi.recordActivityCompletion({
    localAdapter, client: adapter, userId: adapter.user.id,
    completion: {
      id: '00000000-0000-4000-8000-000000000032',
      type: 'quiz',
      activityId: 'logic-truth-tables',
      durationSeconds: 37,
      score: 5,
      total: 5
    }
  });
  await eventApi.recordStudySession({
    localAdapter, client: adapter, userId: adapter.user.id,
    session: {
      id: '00000000-0000-4000-8000-000000000033',
      startedAt: '2026-11-09T00:30:00.000Z',
      durationSeconds: 60,
      endedAt: '2026-11-09T00:31:00.000Z'
    }
  });
  assert.deepEqual(
    [...new Set(supabase.calls.map((call) => call.table))].sort(),
    ['activity_completions', 'learning_events', 'study_sessions']
  );
  assert.equal(supabase.calls.find((call) => call.table === 'learning_events').payload.event_data.tags[0], 'de-morgan');
  assert.equal(supabase.calls.find((call) => call.table === 'activity_completions').payload.duration_seconds, 37);
  assert.equal(
    supabase.calls.find((call) => call.table === 'study_sessions' && call.operation === 'insert').payload.started_at,
    '2026-11-09T00:30:00.000Z',
    'offline flush preserves the original UTC start time for Manila day/week calculations'
  );
  assert.equal((await localAdapter.get(`study-sessions:${adapter.user.id}`))[0].pending, false);
});

test('study-session segments remain locally pending after a failed remote write and can be retried', async () => {
  const localAdapter = new MemoryAdapter();
  const session = {
    id: '00000000-0000-4000-8000-000000000040',
    startedAt: '2026-11-09T00:30:00.000Z',
    endedAt: '2026-11-09T00:31:00.000Z',
    durationSeconds: 60
  };
  await assert.rejects(
    eventApi.recordStudySession({
      localAdapter,
      client: { recordStudySession: async () => { throw new Error('offline'); } },
      userId: '00000000-0000-4000-8000-000000000041',
      session
    }),
    /offline/
  );
  const key = 'study-sessions:00000000-0000-4000-8000-000000000041';
  assert.equal((await localAdapter.get(key))[0].pending, true);
  await eventApi.recordStudySession({
    localAdapter,
    client: { recordStudySession: async () => {} },
    userId: '00000000-0000-4000-8000-000000000041',
    session
  });
  assert.equal((await localAdapter.get(key))[0].pending, false);
});

test('a later signed-in session retries locally pending study segments', async () => {
  assert.equal(typeof eventApi.syncPendingStudySessions, 'function');
  const localAdapter = new MemoryAdapter();
  const sessionId = '00000000-0000-4000-8000-000000000050';
  const userId = '00000000-0000-4000-8000-000000000051';
  const session = {
    id: sessionId,
    startedAt: '2026-11-09T00:30:00.000Z',
    endedAt: '2026-11-09T00:31:00.000Z',
    durationSeconds: 60
  };
  await assert.rejects(
    eventApi.recordStudySession({
      localAdapter,
      client: { recordStudySession: async () => { throw new Error('offline'); } },
      userId,
      session
    }),
    /offline/
  );
  let retries = 0;
  await eventApi.syncPendingStudySessions({
    localAdapter,
    client: { recordStudySession: async (pending) => { retries += 1; assert.equal(pending.id, sessionId); } },
    userId
  });
  assert.equal(retries, 1);
  assert.equal((await localAdapter.get(`study-sessions:${userId}`))[0].pending, false);
});

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.stack || error}`);
  }
}
if (failures) process.exitCode = 1;
else console.log(`All ${tests.length} study-time tests passed.`);
