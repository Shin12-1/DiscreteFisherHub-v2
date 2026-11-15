import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

let achievementHelpers;
let weeklyChallengeHelpers;
try {
  achievementHelpers = await import('../js/core/achievements.mjs');
  weeklyChallengeHelpers = await import('../js/core/weekly-challenge.mjs');
} catch (error) {
  assert.fail(`Achievement helpers must be available before catalog tests run: ${error.message}`);
}

const root = resolve(import.meta.dirname, '..');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const catalog = await read('data/achievements.json');
const weeklyCatalog = await read('data/weekly-challenges.json');
const { validateAchievementCatalog, presentAchievement, getAvatarFrameTier } = achievementHelpers;
const { getWeeklyChallenge } = weeklyChallengeHelpers;

const categories = [
  'Getting started',
  'Lessons',
  'Streaks',
  'Quizzes and practice',
  'Flashcards',
  'Assessments',
  'Fun and hidden',
  'Weekly challenges'
];
const expectedIds = [
  'first-step', 'name-tag', 'explorer', 'logic-rookie', 'table-builder', 'course-complete',
  'warm-up', 'on-fire', 'unstoppable', 'perfect-score', 'comeback', 'sharp-mind',
  'practice-makes-perfect', 'memory-workout', 'card-shark', 'checkpoint-cleared', 'growth',
  'night-owl', 'early-bird', 'de-morgans-disciple', 'curious-mind', 'secret', 'weekly-scholar'
].sort();
const expectedTitles = [
  'First Step', 'Name Tag', 'Explorer', 'Logic Rookie', 'Table Builder', 'Course Complete',
  'Warm Up', 'On Fire', 'Unstoppable', 'Perfect Score', 'Comeback', 'Sharp Mind',
  'Practice Makes Perfect', 'Memory Workout', 'Card Shark', 'Checkpoint Cleared', 'Growth',
  'Night Owl', 'Early Bird', "De Morgan's Disciple", 'Curious Mind', 'Secret', 'Weekly Scholar'
].sort();

assert.equal(validateAchievementCatalog(catalog), undefined);
assert.equal(catalog.achievements.length, 23, 'all named achievement ideas and the weekly award are represented');
assert.equal(new Set(catalog.achievements.map(({ id }) => id)).size, 23, 'achievement ids are unique');
assert.deepEqual(catalog.achievements.map(({ id }) => id).sort(), expectedIds, 'every planned achievement id is present');
assert.deepEqual(catalog.achievements.map(({ title }) => title).sort(), expectedTitles, 'every planned achievement name is present');
assert.ok(catalog.achievements.every(({ category }) => categories.includes(category)), 'each achievement has a valid category');
assert.ok(catalog.achievements.every(({ criteria }) => criteria && typeof criteria.ruleKey === 'string'), 'each achievement has rule metadata');
assert.equal(catalog.achievements.find(({ id }) => id === 'logic-rookie').rewards.title, 'Logic Apprentice');
assert.equal(catalog.achievements.find(({ id }) => id === 'course-complete').rewards.title, 'Proof Master');
assert.throws(
  () => validateAchievementCatalog({ ...catalog, achievements: [...catalog.achievements, catalog.achievements[0]] }),
  /duplicate/i,
  'duplicate achievement ids are rejected'
);
const malformedCriteria = structuredClone(catalog);
malformedCriteria.achievements[0].criteria.target = 0;
assert.throws(() => validateAchievementCatalog(malformedCriteria), /criteria/i, 'malformed criteria metadata is rejected');

const secret = catalog.achievements.find(({ id }) => id === 'secret');
assert.ok(secret?.hidden, 'the secret achievement is marked hidden');
const lockedSecret = presentAchievement(secret, false);
assert.equal(lockedSecret.title, '???');
assert.equal(lockedSecret.unlocked, false);
assert.ok(!Object.hasOwn(lockedSecret, 'description'), 'a locked secret does not expose its description');
assert.ok(!Object.hasOwn(lockedSecret, 'criteria'), 'a locked secret does not expose its criteria');
assert.equal(presentAchievement(secret, true).title, secret.title, 'the title is revealed after unlocking');
assert.equal(getAvatarFrameTier(0), 1, 'new learners start at frame tier 1');
assert.equal(getAvatarFrameTier(599), 1, 'frame tier does not advance before level 5');
assert.equal(getAvatarFrameTier(600), 2, 'frame tier advances at level 5');
assert.equal(getAvatarFrameTier(1350), 3, 'frame tier advances at level 10');
assert.equal(getAvatarFrameTier(2850), 5, 'frame tier caps at level 20');
assert.throws(() => getAvatarFrameTier(-1), /xp/i, 'negative XP is rejected');
assert.throws(() => getAvatarFrameTier(1.5), /xp/i, 'fractional XP is rejected');

const curiousMind = catalog.achievements.find(({ id }) => id === 'curious-mind');
assert.equal(curiousMind.available, false, 'glossary achievement stays unavailable until a glossary exists');

const beforeManilaMonday = getWeeklyChallenge({
  now: '2026-11-08T15:59:59Z',
  challengeCatalog: weeklyCatalog.challenges
});
const afterManilaMonday = getWeeklyChallenge({
  now: '2026-11-08T16:00:00Z',
  challengeCatalog: weeklyCatalog.challenges
});
const laterThatWeek = getWeeklyChallenge({
  now: '2026-11-12T04:00:00Z',
  challengeCatalog: weeklyCatalog.challenges
});
assert.equal(beforeManilaMonday.periodKey, '2026-W45');
assert.equal(beforeManilaMonday.startsAt, '2026-11-02T00:00:00+08:00');
assert.equal(beforeManilaMonday.endsAt, '2026-11-09T00:00:00+08:00');
assert.equal(afterManilaMonday.periodKey, '2026-W46');
assert.equal(afterManilaMonday.startsAt, '2026-11-09T00:00:00+08:00');
assert.equal(afterManilaMonday.endsAt, '2026-11-16T00:00:00+08:00');
assert.equal(laterThatWeek.id, afterManilaMonday.id, 'the weekly challenge does not change during the Manila week');
assert.notEqual(afterManilaMonday.id, beforeManilaMonday.id, 'the selected challenge rotates at Manila Monday');
assert.throws(
  () => getWeeklyChallenge({ now: 'not-a-date', challengeCatalog: weeklyCatalog.challenges }),
  /date/i,
  'invalid dates are rejected'
);
assert.throws(
  () => getWeeklyChallenge({ now: new Date('2026-11-09T00:00:00Z'), challengeCatalog: [] }),
  /challenge/i,
  'an empty challenge catalog is rejected'
);
assert.equal(weeklyCatalog.challenges.length, 4, 'four weekly challenge goals rotate');

console.log(`Achievement data valid: ${catalog.achievements.length} achievements and ${weeklyCatalog.challenges.length} weekly challenges.`);
