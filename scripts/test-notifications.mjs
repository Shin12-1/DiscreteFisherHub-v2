import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const catalog = await read('data/achievements.json');
const challengeCatalog = (await read('data/weekly-challenges.json')).challenges;
const notifications = await import('../js/core/notifications.mjs');
const { presentAchievement } = await import('../js/core/achievements.mjs');
const {
  evaluateGuestAchievements,
  evaluateAndSaveGuestAchievements,
  listNotifications,
  listGuestNotifications,
  markNotificationRead,
  markGuestNotificationRead,
  countUnreadNotifications
} = notifications;

const now = '2026-11-15T12:00:00.000Z';
const sessionDates = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 9, 16 + index, 15));
  return {
    id: `session-${index}`,
    startedAt: date.toISOString(),
    endedAt: new Date(date.getTime() + 60_000).toISOString(),
    durationSeconds: 60
  };
});
sessionDates.push({
  id: 'early-session',
  startedAt: '2026-10-19T22:00:00.000Z',
  endedAt: '2026-10-19T22:01:00.000Z',
  durationSeconds: 60
});

const events = [];
const addEvent = (type, data, occurredAt = '2026-11-10T12:00:00.000Z') => {
  events.push({ id: `event-${events.length}`, type, data, occurredAt });
};
for (const page of ['dashboard', 'courses', 'lessons', 'flashcards', 'practice', 'quizzes', 'assessments', 'progress', 'profile']) {
  addEvent('page-visited', { page });
}
addEvent('lesson-opened', {});
addEvent('nickname-changed', {});
for (let index = 0; index < 50; index += 1) {
  addEvent('practice-question-answered', {
    questionId: `practice-${index}`,
    correct: index < 5,
    tags: index < 5 ? ['de-morgan'] : []
  });
}
for (let index = 0; index < 100; index += 1) {
  addEvent('flashcard-reviewed', {
    cardId: `card-${index}`,
    deckId: 'logic',
    sessionId: 'flashcard-session'
  });
}

const completions = [
  { id: 'lesson-1', type: 'lesson', activityId: 'logic-propositions', completedAt: '2026-11-10T12:00:00.000Z', durationSeconds: 60 },
  { id: 'lesson-2', type: 'lesson', activityId: 'logic-truth-tables', completedAt: '2026-11-11T12:00:00.000Z', durationSeconds: 60 },
  { id: 'lesson-3', type: 'lesson', activityId: 'logic-predicates', completedAt: '2026-11-12T12:00:00.000Z', durationSeconds: 60 },
  { id: 'quiz-old', type: 'quiz', activityId: 'logic-propositions', completedAt: '2026-11-09T12:00:00.000Z', score: 3, total: 5, durationSeconds: 60 },
  { id: 'quiz-1', type: 'quiz', activityId: 'logic-propositions', completedAt: '2026-11-10T12:00:00.000Z', score: 5, total: 5, durationSeconds: 60 },
  { id: 'quiz-2', type: 'quiz', activityId: 'logic-truth-tables', completedAt: '2026-11-11T12:00:00.000Z', score: 5, total: 5, durationSeconds: 60 },
  { id: 'quiz-3', type: 'quiz', activityId: 'logic-predicates', completedAt: '2026-11-12T12:00:00.000Z', score: 5, total: 5, durationSeconds: 60 },
  { id: 'checkpoint-old', type: 'checkpoint', activityId: 'logic-checkpoint', completedAt: '2026-11-09T10:00:00.000Z', score: 2, total: 5, durationSeconds: 60 },
  { id: 'checkpoint-new', type: 'checkpoint', activityId: 'logic-checkpoint', completedAt: '2026-11-12T10:00:00.000Z', score: 4, total: 5, durationSeconds: 60 }
];

const eligible = evaluateGuestAchievements({
  catalog,
  challengeCatalog,
  events,
  completions,
  studySessions: sessionDates,
  now
});
const unlockedIds = new Set(eligible.map(({ achievementId }) => achievementId));
for (const id of [
  'first-step', 'name-tag', 'explorer', 'logic-rookie', 'table-builder', 'course-complete',
  'warm-up', 'on-fire', 'unstoppable', 'perfect-score', 'comeback', 'sharp-mind',
  'practice-makes-perfect', 'memory-workout', 'card-shark', 'checkpoint-cleared', 'growth',
  'night-owl', 'early-bird', 'de-morgans-disciple', 'secret'
]) {
  assert.ok(unlockedIds.has(id), `${id} unlocks from its recorded facts`);
}
assert.ok(!unlockedIds.has('curious-mind'), 'unavailable glossary achievements never unlock');
assert.equal(eligible.find(({ achievementId }) => achievementId === 'logic-rookie').rewardTitle, 'Logic Apprentice');
assert.equal(eligible.find(({ achievementId }) => achievementId === 'course-complete').rewardTitle, 'Proof Master');
assert.equal(eligible.find(({ achievementId }) => achievementId === 'weekly-scholar')?.periodKey, '2026-W46');
assert.equal(new Set(eligible.map(({ achievementId, periodKey }) => `${achievementId}:${periodKey}`)).size, eligible.length);

const hidden = catalog.achievements.find(({ id }) => id === 'secret');
const locked = presentAchievement(hidden, false);
assert.equal(locked.title, '???');
assert.equal(Object.hasOwn(locked, 'description'), false);

const localValues = new Map([
  ['learner-events:guest', { events, completions }],
  ['study-sessions:guest', sessionDates]
]);
const localAdapter = {
  async get(key, fallback = null) { return localValues.has(key) ? localValues.get(key) : fallback; },
  async set(key, value) { localValues.set(key, value); return value; }
};
const firstUnlocks = await evaluateAndSaveGuestAchievements({ localAdapter, catalog, challengeCatalog, now });
assert.equal(firstUnlocks.length, eligible.length, 'all first-time awards are returned for feedback');
const persisted = localValues.get('guest-achievements');
assert.equal(persisted.unlocked.length, eligible.length);
assert.equal(persisted.notifications.length, eligible.length, 'each unlock creates one notification');
const duplicateUnlocks = await evaluateAndSaveGuestAchievements({ localAdapter, catalog, challengeCatalog, now });
assert.deepEqual(duplicateUnlocks, [], 're-evaluating the same activity creates no duplicate unlock');
assert.equal(localValues.get('guest-achievements').notifications.length, eligible.length);

localValues.set('learner-events:guest', {
  events: events.map((event) => ({ ...event, occurredAt: '2026-11-16T12:00:00.000Z' })),
  completions: completions.map((completion) => ({ ...completion, completedAt: '2026-11-16T12:00:00.000Z' }))
});
const weeklyAtNextPeriod = await evaluateAndSaveGuestAchievements({
  localAdapter,
  catalog,
  challengeCatalog,
  now: '2026-11-16T00:00:00.000Z'
});
assert.ok(weeklyAtNextPeriod.some(({ achievementId }) => achievementId === 'weekly-scholar'),
  'a completed new weekly challenge earns a separate period award');
assert.ok(localValues.get('guest-achievements').notifications.some(({ periodKey }) => periodKey === '2026-W46'),
  'expired weekly notifications remain in history');

const guestNotifications = await listGuestNotifications({ localAdapter, limit: 100 });
assert.equal(await countUnreadNotifications({ localAdapter }), guestNotifications.length);
await markGuestNotificationRead({ localAdapter, notificationId: guestNotifications[0].id, readAt: now });
assert.equal(await countUnreadNotifications({ localAdapter }), guestNotifications.length - 1);
assert.equal((await listGuestNotifications({ localAdapter, limit: 100 }))[0].readAt, now);

const databaseRows = [
  { id: 'notice-2', title: 'Recent', body: 'Recent unlock', created_at: '2026-11-12T12:00:00Z', read_at: null },
  { id: 'notice-1', title: 'Earlier', body: 'Earlier unlock', created_at: '2026-11-10T12:00:00Z', read_at: null }
];
let update;
const client = {
  from(table) {
    assert.equal(table, 'notifications');
    let result = { data: databaseRows, error: null, count: 2 };
    const chain = {
      select: () => chain,
      order: (column, options) => {
        assert.equal(column, 'created_at');
        assert.deepEqual(options, { ascending: false });
        return chain;
      },
      limit: (limit) => {
        result = { ...result, data: result.data.slice(0, limit) };
        return Promise.resolve(result);
      },
      update: (values) => { update = values; return chain; },
      eq: (column, value) => {
        assert.equal(column, 'id');
        assert.equal(value, 'notice-2');
        return Promise.resolve({ data: null, error: null });
      },
      is: (column, value) => {
        assert.equal(column, 'read_at');
        assert.equal(value, null);
        return Promise.resolve(result);
      },
      then: (resolvePromise, rejectPromise) => Promise.resolve(result).then(resolvePromise, rejectPromise)
    };
    return chain;
  }
};
const listed = await listNotifications({ client, limit: 1 });
assert.deepEqual(listed.map(({ id }) => id), ['notice-2'], 'signed-in notices are returned newest first and limited');
await markNotificationRead({ client, notificationId: 'notice-2', readAt: now });
assert.deepEqual(update, { read_at: now }, 'only the read timestamp is writable');
assert.equal(await countUnreadNotifications({ client }), 2, 'signed-in unread counts are scoped by the database client');

const failingClient = {
  from: () => ({
    select: () => ({
      order: () => ({
        limit: async () => ({ data: null, error: new Error('notification read failed') })
      })
    })
  })
};
await assert.rejects(() => listNotifications({ client: failingClient }), /notification read failed/);

console.log(`Notification and achievement behavior verified: ${eligible.length} guest unlocks, weekly retention, and notification access.`);
