import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './validate-data.mjs';
import { validateQuizBank, scoreQuiz, selectMixedQuestions } from '../js/core/quiz.mjs';
import { listQuizAttempts, saveQuizAttempt } from '../js/core/quiz-history.mjs';
import { shell } from '../js/components/shell.js';

const logic = JSON.parse(await readFile(new URL('../data/lessons/logic.json', import.meta.url), 'utf8'));
const bank = JSON.parse(await readFile(new URL('../data/quizzes/logic.json', import.meta.url), 'utf8'));

assert.doesNotThrow(() => validateQuizBank(bank, logic.lessons));
assert.equal(bank.quizzes.length, 3);
assert.ok(bank.quizzes.every((quiz) => quiz.questions.length === 5));

const invalidLessonBank = structuredClone(bank);
invalidLessonBank.quizzes[0].lessonId = 'unknown-lesson';
assert.throws(() => validateQuizBank(invalidLessonBank, logic.lessons), /lesson/i);

const duplicateQuestionBank = structuredClone(bank);
duplicateQuestionBank.quizzes[1].questions[0].id = duplicateQuestionBank.quizzes[0].questions[0].id;
assert.throws(() => validateQuizBank(duplicateQuestionBank, logic.lessons), /unique/i);

const questions = [
  { id: 'one', answerIndex: 2 },
  { id: 'two', answerIndex: 1 },
  { id: 'three', answerIndex: 0 }
];
const result = scoreQuiz(questions, [2, 0]);
assert.equal(result.score, 1);
assert.equal(result.total, 3);
assert.deepEqual(result.missedQuestions.map((question) => question.id), ['two', 'three']);

const pool = Array.from({ length: 15 }, (_, index) => ({ id: `question-${index}` }));
const originalOrder = pool.map((question) => question.id);
const mixed = selectMixedQuestions(pool, 5, () => 0.5);
assert.equal(mixed.length, 5);
assert.equal(new Set(mixed.map((question) => question.id)).size, 5);
assert.deepEqual(pool.map((question) => question.id), originalOrder);
assert.equal(selectMixedQuestions(pool.slice(0, 2), 5, () => 0).length, 2);

const saved = [];
const localAdapter = {
  async get(key, fallback) {
    assert.equal(key, 'quiz-attempts');
    return saved.length ? saved : fallback;
  },
  async set(key, value) {
    assert.equal(key, 'quiz-attempts');
    saved.splice(0, saved.length, ...value);
    return value;
  }
};
for (let index = 0; index < 22; index += 1) {
  saved.push({
    topic_id: 'logic',
    mode: 'logic-propositions',
    score: index % 6,
    total: 5,
    taken_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
  });
}
const guestAttempts = await listQuizAttempts({ localAdapter });
assert.equal(guestAttempts.length, 20);
assert.ok(guestAttempts[0].taken_at > guestAttempts[1].taken_at);
const guestAttempt = await saveQuizAttempt({
  localAdapter,
  attempt: { topicId: 'logic', mode: 'mixed-review', score: 4, total: 5 }
});
assert.equal(guestAttempt.topic_id, 'logic');
assert.equal(saved[0].mode, 'mixed-review');
assert.equal(saved.length, 20);

let remoteRows = [{
  topic_id: 'logic',
  mode: 'logic-propositions',
  score: 3,
  total: 5,
  taken_at: '2026-01-02T00:00:00.000Z'
}];
let queryUser;
let insertedRow;
const client = {
  from(table) {
    assert.equal(table, 'quiz_attempts');
    return {
      select(columns) {
        assert.equal(columns, 'topic_id, mode, score, total, taken_at');
        return {
          eq(column, value) {
            assert.equal(column, 'user_id');
            queryUser = value;
            return {
              order(columnName, options) {
                assert.equal(columnName, 'taken_at');
                assert.deepEqual(options, { ascending: false });
                return {
                  async limit(count) {
                    assert.equal(count, 20);
                    return { data: remoteRows, error: null };
                  }
                };
              }
            };
          }
        };
      },
      insert(row) {
        insertedRow = row;
        return {
          select() {
            return {
              async single() {
                return { data: { ...row, taken_at: '2026-01-03T00:00:00.000Z' }, error: null };
              }
            };
          }
        };
      }
    };
  }
};
const remoteAttempts = await listQuizAttempts({ localAdapter, client, userId: 'user-123' });
assert.equal(queryUser, 'user-123');
assert.equal(remoteAttempts.length, 1);
const remoteAttempt = await saveQuizAttempt({
  localAdapter,
  client,
  userId: 'user-123',
  attempt: { topicId: 'logic', mode: 'mixed-review', score: 4, total: 5 }
});
assert.equal(insertedRow.user_id, 'user-123');
assert.equal(insertedRow.topic_id, 'logic');
assert.equal(remoteAttempt.score, 4);

await assert.rejects(
  saveQuizAttempt({ localAdapter, attempt: { topicId: 'logic', mode: 'mixed-review', score: 6, total: 5 } }),
  /score/i
);
await assert.rejects(
  listQuizAttempts({ localAdapter: { async get() { throw new Error('local read failed'); } } }),
  /local read failed/
);
await assert.rejects(
  listQuizAttempts({
    localAdapter,
    userId: 'user-123',
    client: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: null, error: new Error('remote read failed') }) }) }) }) }) }
  }),
  /remote read failed/
);

const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/index.html' } });
const quizzesPage = shell('quizzes', '', 'light');
if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
else delete globalThis.location;
const mobileNavigation = quizzesPage.match(/<nav class="mobile-nav" aria-label="Quick navigation">([\s\S]*?)<\/nav>/)?.[1];
assert.ok(mobileNavigation, 'the mobile quick-navigation landmark should render');
const primaryNavigation = mobileNavigation.split('<div id="mobile-more-menu"')[0];
const moreNavigation = mobileNavigation.split('<div id="mobile-more-menu"')[1];
assert.equal((primaryNavigation.match(/<a\b/g) || []).length, 4, 'mobile quick navigation should have four direct page links');
assert.equal((primaryNavigation.match(/<button\b/g) || []).length, 1, 'mobile quick navigation should have one More control');
assert.match(primaryNavigation, /data-mobile-more-toggle/, 'the More control should be keyboard operable');
assert.match(moreNavigation, /<span>Quizzes<\/span>/, 'quizzes should be reachable in the mobile More menu');

console.log('Quiz helper tests passed.');
