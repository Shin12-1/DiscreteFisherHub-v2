import { localDateKey } from './dates.mjs';

const KEY = 'dashboard-activity';
const MAX_EVENTS = 20;
const activityQueues = new Map();

function activityKey(userId) {
  return `${KEY}:${userId === null ? 'guest' : `user:${userId}`}`;
}

function uniqueIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === 'string' && id.trim()))]
    : [];
}

function isStoredEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.timestamp !== 'string') return false;
  if (event.type === 'lesson-completed' || event.type === 'flashcard-revealed') {
    return typeof event.id === 'string' && Boolean(event.id.trim());
  }
  return event.type === 'quiz-attempt'
    && typeof event.mode === 'string'
    && Number.isFinite(event.score)
    && Number.isFinite(event.total)
    && Array.isArray(event.missedQuestionIds);
}

function normalizeActivity(value, now) {
  const date = localDateKey(now);
  const sameDay = value?.today?.date === date;
  return {
    goal: value?.goal === 'flashcards' ? 'flashcards' : 'lesson',
    today: {
      date,
      lessonIds: sameDay ? uniqueIds(value.today.lessonIds) : [],
      flashcardIds: sameDay ? uniqueIds(value.today.flashcardIds) : []
    },
    recentEvents: Array.isArray(value?.recentEvents)
      ? value.recentEvents.filter(isStoredEvent).slice(0, MAX_EVENTS)
      : []
  };
}

async function loadActivity(localAdapter, key, now) {
  const stored = await localAdapter.get(key, null);
  const activity = normalizeActivity(stored, now);
  if (!stored || stored.today?.date !== activity.today.date) {
    await localAdapter.set(key, activity);
  }
  return activity;
}

async function serializeActivity(key, operation) {
  const previous = activityQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  activityQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (activityQueues.get(key) === current) activityQueues.delete(key);
  }
}

export async function getDashboardActivity({ localAdapter, userId, now = new Date() }) {
  const key = activityKey(userId);
  return serializeActivity(key, () => loadActivity(localAdapter, key, now));
}

export async function setDashboardGoal({ localAdapter, userId, goal, now = new Date() }) {
  if (goal !== 'lesson' && goal !== 'flashcards') {
    throw new TypeError('Dashboard goal must be lesson or flashcards.');
  }
  const key = activityKey(userId);
  return serializeActivity(key, async () => {
    const activity = await loadActivity(localAdapter, key, now);
    activity.goal = goal;
    await localAdapter.set(key, activity);
    return activity;
  });
}

export async function recordDashboardActivity({ localAdapter, userId, event, now = new Date() }) {
  let recordedEvent;
  if ((event?.type === 'lesson-completed' || event?.type === 'flashcard-revealed')
    && typeof event.id === 'string' && event.id.trim()) {
    recordedEvent = { type: event.type, id: event.id, timestamp: now.toISOString() };
  } else if (event?.type === 'quiz-attempt'
    && typeof event.mode === 'string'
    && Number.isFinite(event.score)
    && Number.isFinite(event.total)
    && Array.isArray(event.missedQuestionIds)) {
    recordedEvent = {
      type: event.type,
      mode: event.mode,
      score: event.score,
      total: event.total,
      missedQuestionIds: uniqueIds(event.missedQuestionIds),
      timestamp: now.toISOString()
    };
  } else {
    throw new TypeError('Dashboard activity event is invalid.');
  }

  const key = activityKey(userId);
  return serializeActivity(key, async () => {
    const activity = await loadActivity(localAdapter, key, now);
    if (recordedEvent.type === 'lesson-completed') {
      activity.today.lessonIds = uniqueIds([...activity.today.lessonIds, recordedEvent.id]);
    } else if (recordedEvent.type === 'flashcard-revealed') {
      activity.today.flashcardIds = uniqueIds([...activity.today.flashcardIds, recordedEvent.id]);
    }
    activity.recentEvents = [recordedEvent, ...activity.recentEvents].slice(0, MAX_EVENTS);
    await localAdapter.set(key, activity);
    return activity;
  });
}
