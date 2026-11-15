const categories = new Set([
  'Getting started',
  'Lessons',
  'Streaks',
  'Quizzes and practice',
  'Flashcards',
  'Assessments',
  'Fun and hidden',
  'Weekly challenges'
]);

const criterionFields = {
  'event-count': { event: 'string', target: 'positiveInteger' },
  'all-sidebar-pages': { pages: 'stringArray' },
  'lesson-completed': { lessonId: 'string' },
  'topic-completed': { topicId: 'string' },
  'streak-days': { days: 'positiveInteger' },
  'perfect-quiz-score': { score: 'positiveInteger', total: 'positiveInteger' },
  'quiz-score-improved': {},
  'consecutive-quiz-threshold': { attempts: 'positiveInteger', minPercent: 'percentage' },
  'practice-answers': { count: 'positiveInteger' },
  'deck-reviewed': {},
  'cards-reviewed': { count: 'positiveInteger' },
  'checkpoint-completed': {},
  'checkpoint-score-improved': {},
  'study-local-hour': { startHour: 'hour', endHourExclusive: 'hourEnd', timeZone: 'manila' },
  'de-morgan-correct': { count: 'positiveInteger' },
  'glossary-opens': { count: 'positiveInteger' },
  'perfect-every-published-quiz': { topicId: 'string' },
  'weekly-challenge': {}
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validField(value, type) {
  if (type === 'string') return typeof value === 'string' && value.trim().length > 0;
  if (type === 'positiveInteger') return Number.isInteger(value) && value > 0;
  if (type === 'percentage') return Number.isFinite(value) && value >= 0 && value <= 100;
  if (type === 'hour') return Number.isInteger(value) && value >= 0 && value < 24;
  if (type === 'hourEnd') return Number.isInteger(value) && value > 0 && value <= 24;
  if (type === 'manila') return value === 'Asia/Manila';
  if (type === 'stringArray') {
    return Array.isArray(value) && value.length > 0 &&
      value.every((item) => typeof item === 'string' && item.trim().length > 0) &&
      new Set(value).size === value.length;
  }
  return false;
}

function validateCriteria(criteria, id) {
  if (!isRecord(criteria) || typeof criteria.ruleKey !== 'string') {
    throw new TypeError(`Achievement ${id} has invalid criteria metadata.`);
  }

  const requiredFields = criterionFields[criteria.ruleKey];
  if (!requiredFields) throw new TypeError(`Achievement ${id} has an unknown criteria rule.`);

  const allowedFields = new Set(['ruleKey', ...Object.keys(requiredFields)]);
  if (Object.keys(criteria).some((field) => !allowedFields.has(field))) {
    throw new TypeError(`Achievement ${id} has invalid criteria metadata.`);
  }
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!validField(criteria[field], type)) {
      throw new TypeError(`Achievement ${id} has invalid criteria metadata.`);
    }
  }
  if (criteria.ruleKey === 'perfect-quiz-score' && criteria.score > criteria.total) {
    throw new TypeError(`Achievement ${id} has invalid criteria metadata.`);
  }
  if (criteria.ruleKey === 'study-local-hour' && criteria.startHour >= criteria.endHourExclusive) {
    throw new TypeError(`Achievement ${id} has invalid criteria metadata.`);
  }
}

export function validateAchievementCatalog(catalog) {
  if (!isRecord(catalog) || !Array.isArray(catalog.achievements)) {
    throw new TypeError('Achievement catalog must contain an achievements array.');
  }

  const ids = new Set();
  for (const achievement of catalog.achievements) {
    if (!isRecord(achievement) ||
      typeof achievement.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(achievement.id) ||
      ids.has(achievement.id)) {
      throw new TypeError(`Invalid or duplicate achievement id: ${achievement?.id ?? ''}`);
    }
    ids.add(achievement.id);
    if (typeof achievement.title !== 'string' || !achievement.title.trim() ||
      typeof achievement.description !== 'string' || !achievement.description.trim() ||
      !categories.has(achievement.category) ||
      typeof achievement.hidden !== 'boolean' ||
      typeof achievement.available !== 'boolean') {
      throw new TypeError(`Achievement ${achievement.id} has invalid required fields.`);
    }
    validateCriteria(achievement.criteria, achievement.id);
    if (achievement.rewards !== undefined &&
      (!isRecord(achievement.rewards) ||
        Object.keys(achievement.rewards).some((key) => key !== 'title') ||
        (achievement.rewards.title !== undefined &&
          (typeof achievement.rewards.title !== 'string' || !achievement.rewards.title.trim())))) {
      throw new TypeError(`Achievement ${achievement.id} has invalid reward metadata.`);
    }
  }
}

export function presentAchievement(achievement, unlocked) {
  if (!isRecord(achievement) || typeof achievement.id !== 'string' ||
    typeof achievement.title !== 'string' || typeof achievement.description !== 'string' ||
    typeof unlocked !== 'boolean') {
    throw new TypeError('An achievement and its unlock state are required.');
  }
  if (achievement.hidden && !unlocked) {
    return { id: achievement.id, title: '???', unlocked: false, hidden: true };
  }
  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    category: achievement.category,
    unlocked,
    hidden: achievement.hidden,
    available: achievement.available
  };
}

export function getAvatarFrameTier(xp) {
  if (!Number.isInteger(xp) || xp < 0) throw new TypeError('XP must be a non-negative integer.');
  const level = Math.floor(xp / 150) + 1;
  return Math.min(5, Math.floor(level / 5) + 1);
}
