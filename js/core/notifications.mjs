import { validateAchievementCatalog } from './achievements.mjs';
import { getWeeklyChallenge } from './weekly-challenge.mjs';

const LOGIC_LESSONS = ['logic-propositions', 'logic-truth-tables', 'logic-predicates'];
const CARD_DECK_SIZE = 15;
const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const MANILA_HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: '2-digit',
  hourCycle: 'h23'
});

function assertLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('Notification limit must be an integer from 1 to 100.');
  }
}

function asDate(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${label} must be a valid timestamp.`);
  return date;
}

function manilaDate(value) {
  const date = asDate(value, 'Activity time');
  const parts = Object.fromEntries(
    MANILA_DATE_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isInWeek(timestamp, challenge) {
  const time = asDate(timestamp, 'Activity time').getTime();
  return time >= Date.parse(challenge.startsAt) && time < Date.parse(challenge.endsAt);
}

function validateFacts({ events, completions, studySessions }) {
  if (!Array.isArray(events) || !Array.isArray(completions) || !Array.isArray(studySessions)) {
    throw new TypeError('Learner events, completions, and study sessions must be arrays.');
  }
  for (const event of events) {
    if (!event || typeof event.type !== 'string' || !event.data || typeof event.data !== 'object' ||
      Array.isArray(event.data)) {
      throw new TypeError('Learner event records are invalid.');
    }
    asDate(event.occurredAt, 'Event time');
  }
  for (const completion of completions) {
    if (!completion || !['lesson', 'quiz', 'checkpoint'].includes(completion.type) ||
      typeof completion.activityId !== 'string') {
      throw new TypeError('Activity completion records are invalid.');
    }
    asDate(completion.completedAt, 'Completion time');
  }
  for (const session of studySessions) {
    if (!session || !Number.isInteger(session.durationSeconds) || session.durationSeconds < 0) {
      throw new TypeError('Study session records are invalid.');
    }
    asDate(session.startedAt, 'Study session start time');
  }
}

function longestStreak(sessions) {
  const days = [...new Set(sessions
    .filter(({ durationSeconds }) => durationSeconds > 0)
    .map(({ startedAt }) => manilaDate(startedAt)))]
    .sort();
  let longest = 0;
  let streak = 0;
  let previous = null;
  for (const day of days) {
    const current = Date.parse(`${day}T00:00:00Z`);
    streak = previous !== null && current - previous === 86_400_000 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = current;
  }
  return longest;
}

function hasImprovedScore(completions, type) {
  const grouped = new Map();
  for (const item of completions.filter((entry) => entry.type === type && entry.total)) {
    const attempts = grouped.get(item.activityId) || [];
    attempts.push(item);
    grouped.set(item.activityId, attempts);
  }
  return [...grouped.values()].some((attempts) => {
    const ordered = attempts.sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt));
    return ordered.some((attempt, index) => index > 0 &&
      attempt.score / attempt.total > ordered[index - 1].score / ordered[index - 1].total);
  });
}

function uniqueFlashcards(events) {
  return new Set(events
    .filter(({ type }) => type === 'flashcard-reviewed')
    .map(({ data }) => `${data.sessionId || ''}:${data.cardId || ''}`));
}

function ruleEligible(achievement, facts, weeklyChallenge) {
  const { criteria, id } = achievement;
  const { events, completions, studySessions } = facts;
  switch (criteria.ruleKey) {
    case 'event-count':
      return events.filter(({ type }) => type === criteria.event).length >= criteria.target;
    case 'all-sidebar-pages': {
      const visited = new Set(events
        .filter(({ type }) => type === 'page-visited')
        .map(({ data }) => data.page));
      return criteria.pages.every((page) => visited.has(page));
    }
    case 'lesson-completed':
      return completions.some(({ type, activityId }) => type === 'lesson' && activityId === criteria.lessonId);
    case 'topic-completed':
      return criteria.topicId === 'logic' &&
        LOGIC_LESSONS.every((lessonId) =>
          completions.some(({ type, activityId }) => type === 'lesson' && activityId === lessonId));
    case 'streak-days':
      return longestStreak(studySessions) >= criteria.days;
    case 'perfect-quiz-score':
      return completions.some(({ type, score, total }) =>
        type === 'quiz' && score === criteria.score && total === criteria.total);
    case 'quiz-score-improved':
      return hasImprovedScore(completions, 'quiz');
    case 'consecutive-quiz-threshold': {
      const attempts = completions
        .filter(({ type, total }) => type === 'quiz' && total > 0)
        .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
        .slice(0, criteria.attempts);
      return attempts.length === criteria.attempts &&
        attempts.every(({ score, total }) => score / total * 100 >= criteria.minPercent);
    }
    case 'practice-answers':
      return events.filter(({ type }) => type === 'practice-question-answered').length >= criteria.count;
    case 'deck-reviewed': {
      const cardsByDeckAndSession = new Map();
      for (const { type, data } of events) {
        if (type !== 'flashcard-reviewed' || !data.deckId || !data.sessionId || !data.cardId) continue;
        const key = `${data.deckId}:${data.sessionId}`;
        const cards = cardsByDeckAndSession.get(key) || new Set();
        cards.add(data.cardId);
        cardsByDeckAndSession.set(key, cards);
      }
      return [...cardsByDeckAndSession.values()].some((cards) => cards.size >= CARD_DECK_SIZE);
    }
    case 'cards-reviewed':
      return uniqueFlashcards(events).size >= criteria.count;
    case 'checkpoint-completed':
      return completions.some(({ type }) => type === 'checkpoint');
    case 'checkpoint-score-improved':
      return hasImprovedScore(completions, 'checkpoint');
    case 'study-local-hour':
      return studySessions.some(({ startedAt, durationSeconds }) => {
        if (durationSeconds <= 0) return false;
        const hour = Number(MANILA_HOUR_FORMATTER.format(asDate(startedAt, 'Study session start time')));
        return hour >= criteria.startHour && hour < criteria.endHourExclusive;
      });
    case 'de-morgan-correct':
      return events.filter(({ type, data }) => type === 'practice-question-answered' &&
        data.correct === true && Array.isArray(data.tags) && data.tags.includes('de-morgan')).length >= criteria.count;
    case 'glossary-opens':
      return false;
    case 'perfect-every-published-quiz':
      return criteria.topicId === 'logic' &&
        LOGIC_LESSONS.every((quizId) => completions.some(({ type, activityId, score, total }) =>
          type === 'quiz' && activityId === quizId && score === total && total > 0));
    case 'weekly-challenge':
      return weeklyChallengeMet(weeklyChallenge, facts);
    default:
      throw new TypeError(`Achievement ${id} uses an unsupported rule.`);
  }
}

function weeklyChallengeMet(challenge, { events, completions }) {
  const weeklyEvents = events.filter(({ occurredAt }) => isInWeek(occurredAt, challenge));
  const weeklyCompletions = completions.filter(({ completedAt }) => isInWeek(completedAt, challenge));
  switch (challenge.ruleKey) {
    case 'lesson-completions':
      return weeklyCompletions.filter(({ type }) => type === 'lesson').length >= challenge.target;
    case 'quiz-completions':
      return weeklyCompletions.filter(({ type }) => type === 'quiz').length >= challenge.target;
    case 'practice-answers':
      return weeklyEvents.filter(({ type }) => type === 'practice-question-answered').length >= challenge.target;
    case 'flashcards-reviewed':
      return uniqueFlashcards(weeklyEvents).size >= challenge.target;
    default:
      throw new TypeError(`Weekly challenge ${challenge.id} uses an unsupported rule.`);
  }
}

function makeUnlock(achievement, periodKey, now) {
  return {
    id: `${achievement.id}:${periodKey}`,
    achievementId: achievement.id,
    periodKey,
    title: `${achievement.title} unlocked`,
    body: achievement.description,
    rewardTitle: achievement.rewards?.title || null,
    unlockedAt: now.toISOString(),
    readAt: null
  };
}

export function evaluateGuestAchievements({
  catalog,
  challengeCatalog,
  events = [],
  completions = [],
  studySessions = [],
  now = new Date()
} = {}) {
  validateAchievementCatalog(catalog);
  if (!Array.isArray(challengeCatalog) || challengeCatalog.length === 0) {
    throw new TypeError('A non-empty weekly challenge catalog is required.');
  }
  const instant = asDate(now, 'Evaluation time');
  const facts = { events, completions, studySessions };
  validateFacts(facts);
  const weeklyChallenge = getWeeklyChallenge({ now: instant, challengeCatalog });
  const availableAchievements = catalog.achievements.filter(({ available }) => available);
  const awards = [];
  for (const achievement of availableAchievements) {
    const periodKey = achievement.criteria.ruleKey === 'weekly-challenge'
      ? weeklyChallenge.periodKey
      : '';
    if (ruleEligible(achievement, facts, weeklyChallenge)) {
      awards.push(makeUnlock(achievement, periodKey, instant));
    }
  }
  return awards;
}

export async function evaluateAndSaveGuestAchievements({
  localAdapter,
  catalog,
  challengeCatalog,
  now = new Date()
} = {}) {
  if (!localAdapter?.get || !localAdapter?.set) throw new TypeError('A local storage adapter is required.');
  const [activity, studySessions, saved] = await Promise.all([
    localAdapter.get('learner-events:guest', { events: [], completions: [] }),
    localAdapter.get('study-sessions:guest', []),
    localAdapter.get('guest-achievements', { unlocked: [], notifications: [] })
  ]);
  if (!activity || typeof activity !== 'object' || Array.isArray(activity) ||
    !Array.isArray(saved?.unlocked) || !Array.isArray(saved?.notifications)) {
    throw new TypeError('Saved guest learner records are invalid.');
  }
  const candidates = evaluateGuestAchievements({
    catalog,
    challengeCatalog,
    events: activity.events || [],
    completions: activity.completions || [],
    studySessions,
    now
  });
  const keys = new Set(saved.unlocked.map(({ achievementId, periodKey }) => `${achievementId}:${periodKey}`));
  const unlocked = candidates.filter(({ achievementId, periodKey }) => !keys.has(`${achievementId}:${periodKey}`));
  if (!unlocked.length) return [];
  const next = {
    unlocked: [...saved.unlocked, ...unlocked],
    notifications: [...saved.notifications, ...unlocked]
  };
  await localAdapter.set('guest-achievements', next);
  return unlocked;
}

export async function listGuestNotifications({ localAdapter, limit = 20 } = {}) {
  assertLimit(limit);
  if (!localAdapter?.get) throw new TypeError('A local storage adapter is required.');
  const saved = await localAdapter.get('guest-achievements', { unlocked: [], notifications: [] });
  if (!Array.isArray(saved?.notifications)) throw new TypeError('Saved guest notifications are invalid.');
  return saved.notifications
    .slice()
    .sort((left, right) => Date.parse(right.unlockedAt) - Date.parse(left.unlockedAt))
    .slice(0, limit);
}

export async function markGuestNotificationRead({ localAdapter, notificationId, readAt = new Date().toISOString() } = {}) {
  if (!localAdapter?.get || !localAdapter?.set || typeof notificationId !== 'string' || !notificationId) {
    throw new TypeError('A local adapter and notification ID are required.');
  }
  asDate(readAt, 'Read time');
  const saved = await localAdapter.get('guest-achievements', { unlocked: [], notifications: [] });
  if (!Array.isArray(saved?.notifications)) throw new TypeError('Saved guest notifications are invalid.');
  await localAdapter.set('guest-achievements', {
    ...saved,
    notifications: saved.notifications.map((notification) =>
      notification.id === notificationId && !notification.readAt
        ? { ...notification, readAt }
        : notification)
  });
}

export async function listNotifications({ client, limit = 20 } = {}) {
  assertLimit(limit);
  if (!client?.from) throw new TypeError('A signed-in notification client is required.');
  const { data, error } = await client.from('notifications')
    .select('id, achievement_id, period_key, title, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!Array.isArray(data)) throw new TypeError('The notification query returned invalid data.');
  return data.map((notification) => ({
    id: notification.id,
    achievementId: notification.achievement_id,
    periodKey: notification.period_key,
    title: notification.title,
    body: notification.body,
    unlockedAt: notification.created_at,
    readAt: notification.read_at
  }));
}

export async function markNotificationRead({ client, notificationId, readAt = new Date().toISOString() } = {}) {
  if (!client?.from || typeof notificationId !== 'string' || !notificationId) {
    throw new TypeError('A signed-in notification client and ID are required.');
  }
  asDate(readAt, 'Read time');
  const { error } = await client.from('notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function countUnreadNotifications({ client, localAdapter } = {}) {
  if (client?.from) {
    const { count, error } = await client.from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw error;
    if (!Number.isInteger(count) || count < 0) throw new TypeError('The unread notification count is invalid.');
    return count;
  }
  if (!localAdapter?.get) throw new TypeError('A signed-in client or local storage adapter is required.');
  const saved = await localAdapter.get('guest-achievements', { unlocked: [], notifications: [] });
  if (!Array.isArray(saved?.notifications)) throw new TypeError('Saved guest notifications are invalid.');
  return saved.notifications.filter(({ readAt }) => !readAt).length;
}
