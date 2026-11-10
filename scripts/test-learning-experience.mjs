import assert from 'node:assert/strict';
import { getNextLesson, getTopicProgress, youtubeSearchUrl } from '../js/core/learning.mjs';
import { loadPageData } from '../js/core/page-data.mjs';
import { validateAuthFields, validateNickname } from '../js/core/auth-validation.mjs';
import { renderPageSkeleton } from '../js/components/loading.js';
import { dashboardView, coursesView, lessonsView } from '../js/pages/learning-views.js';
import { profileView, progressView } from '../js/pages/student-views.js';
import { assessmentResultsView, assessmentView, flashcardsView, practiceResultsView, practiceView, selectAssessmentQuestions, selectPracticeQuestions } from '../js/pages/practice-views.js';
import { scoreQuiz } from '../js/core/quiz.mjs';
import { shell } from '../js/components/shell.js';
import { renderHomePage } from '../js/pages/home-view.mjs';
import topics from '../data/topics.json' with { type: 'json' };
import logic from '../data/lessons/logic.json' with { type: 'json' };
import bank from '../data/quizzes/logic.json' with { type: 'json' };

const lessons = [
  { id: 'logic-propositions', title: 'Propositions' },
  { id: 'logic-truth-tables', title: 'Truth tables' },
  { id: 'logic-predicates', title: 'Predicates' }
];

const resourcesByPage = {
  dashboard: ['data/topics.json', 'data/lessons/logic.json'],
  courses: ['data/topics.json', 'data/lessons/logic.json'],
  lessons: ['data/lessons/logic.json'],
  quizzes: ['data/topics.json', 'data/quizzes/logic.json'],
  profile: [],
  progress: ['data/topics.json', 'data/lessons/logic.json'],
  practice: ['data/quizzes/logic.json'],
  assessments: ['data/quizzes/logic.json'],
  flashcards: ['data/quizzes/logic.json'],
  login: []
};
for (const [page, expected] of Object.entries(resourcesByPage)) {
  const requestedData = [];
  await loadPageData(page, async (path) => {
    requestedData.push(path);
    return { path };
  });
  assert.deepEqual(requestedData, expected, `${page} only loads its required study data`);
}
const dashboardRequests = [];
const dashboardResolvers = [];
const dashboardDataPromise = loadPageData('dashboard', (path) => {
  dashboardRequests.push(path);
  return new Promise((resolve) => dashboardResolvers.push(() => resolve(path)));
});
assert.deepEqual(dashboardRequests, resourcesByPage.dashboard, 'dashboard data requests start in parallel');
dashboardResolvers.forEach((resolve) => resolve());
assert.deepEqual(await dashboardDataPromise, {
  topics: 'data/topics.json',
  lessons: 'data/lessons/logic.json',
  bank: null
});

assert.equal(getNextLesson(lessons, ['logic-propositions']).id, 'logic-truth-tables');
assert.equal(getNextLesson(lessons, lessons.map((lesson) => lesson.id)), null);
assert.equal(getNextLesson([], []), null);

assert.deepEqual(getTopicProgress({ lessonIds: ['a', 'b', 'c'] }, ['a', 'a', 'unknown']), {
  completed: 1,
  total: 3,
  percent: 33
});
assert.deepEqual(getTopicProgress({ lessonIds: [] }, ['unknown']), {
  completed: 0,
  total: 0,
  percent: 0
});

assert.equal(
  youtubeSearchUrl('  logic propositions & connectives  '),
  'https://www.youtube.com/results?search_query=logic+propositions+%26+connectives'
);
assert.throws(() => youtubeSearchUrl('  '), /query/i);

assert.deepEqual(validateAuthFields({ email: 'bad', password: 'short' }, 'login'), {
  email: 'Enter a valid email address.',
  password: 'Use a password with at least 8 characters.'
});
assert.deepEqual(validateAuthFields({ email: 'student@example.edu', password: 'long-enough' }, 'signup'), {
  nickname: 'Use a 3–32 character nickname with letters, numbers, spaces, dots, hyphens, or underscores.'
});
assert.deepEqual(validateAuthFields({
  nickname: 'Student',
  email: 'invalid',
  password: 'short'
}, 'signup'), {
  email: 'Enter a valid email address.',
  password: 'Use a password with at least 8 characters.'
});
assert.deepEqual(validateAuthFields({
  nickname: 'x',
  email: 'student@example.edu',
  password: 'eightchars'
}, 'signup'), {
  nickname: 'Use a 3–32 character nickname with letters, numbers, spaces, dots, hyphens, or underscores.'
});
assert.deepEqual(validateAuthFields({
  nickname: 'Fisher Learner',
  email: 'student@example.edu',
  password: 'a secure password'
}, 'signup'), {});
assert.equal(validateNickname('Abc'), '');
assert.match(validateNickname('x'), /3–32/);
assert.match(validateNickname('x'.repeat(33)), /3–32/);

const pages = ['dashboard', 'courses', 'lessons', 'quizzes', 'profile', 'progress', 'practice', 'assessments', 'flashcards', 'login'];
const skeletons = pages.map((page) => renderPageSkeleton(page));
assert.equal(new Set(skeletons).size, pages.length, 'each page should have a distinct skeleton');
for (const [index, page] of pages.entries()) {
  assert.match(skeletons[index], /role="status"/);
  assert.match(skeletons[index], /aria-busy="true"/);
  assert.match(skeletons[index], new RegExp(`Loading ${page === 'login' ? 'sign-in form' : page}`, 'i'));
}
assert.match(renderPageSkeleton('not-a-page'), /Loading content/i);

Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { pathname: '/pages/courses.html' }
});
const profileShell = shell('profile', '<p>Profile content</p>', 'light');
const mobileNavigation = profileShell.split('<nav class="mobile-nav"')[1].split('<div id="mobile-more-menu"')[0];
assert.equal((mobileNavigation.match(/<a\b/g) || []).length, 4, 'mobile navigation has four direct page links');
assert.equal((mobileNavigation.match(/<button\b/g) || []).length, 1, 'mobile navigation has one More button');
assert.match(mobileNavigation, /aria-expanded="false"/);
assert.match(mobileNavigation, /aria-current="page"/, 'More indicates when a secondary page is active');
const moreMenu = profileShell.split('<div id="mobile-more-menu"')[1].split('</div>')[0];
for (const label of ['Quizzes', 'Assessments', 'Flashcards', 'Progress', 'Profile']) {
  assert.match(moreMenu, new RegExp(label));
}
assert.match(shell('flashcards', '<p>Flashcards content</p>', 'light'), /aria-current="page".*Flashcards/);
const guestState = {
  nickname: '<student>',
  completedLessons: ['logic-propositions'],
  xp: 50,
  level: 1,
  streak: 2
};
const homePage = renderHomePage(null, guestState, 'light');
assert.match(homePage, /pages\/dashboard\.html/);
assert.match(homePage, /href="pages\/practice\.html"/);
assert.match(homePage, /href="pages\/flashcards\.html"/);
assert.match(homePage, /Dashboard/);
assert.doesNotMatch(homePage, /Leaderboard|next build/i);
assert.match(homePage, /TFVC%20CCS\.jpg/);
const dashboard = dashboardView(topics, logic.lessons, guestState, []);
assert.match(dashboard, /Welcome back, &lt;student&gt;/);
assert.match(dashboard, /logic-truth-tables/);
const completedDashboard = dashboardView(topics, logic.lessons, {
  ...guestState,
  completedLessons: logic.lessons.map((lesson) => lesson.id)
}, []);
assert.match(completedDashboard, /All Logic lessons complete/i);
assert.doesNotMatch(completedDashboard, /lesson=undefined/);

const courses = coursesView(topics, logic.lessons, guestState);
assert.match(courses, /Propositions and connectives/);
assert.match(courses, /Coming soon/);
assert.match(courses, /youtube\.com\/results/);
assert.doesNotMatch(courses, /href="(?:\.{0,2}\/)*pages\/courses\.html".*Coming soon/);

const lessonView = lessonsView(logic.lessons, guestState, 'unknown-lesson');
assert.match(lessonView, /Propositions and connectives/);
assert.match(lessonView, /aria-label=['"]A connective map relating p and q['"]/);
assert.match(lessonView, /Reveal explanation/);
assert.match(lessonView, /youtube\.com\/results/);
assert.doesNotMatch(lessonView, /unknown-lesson/);

const guestProfile = profileView(null, guestState);
assert.match(guestProfile, /Guest learner/);
assert.match(guestProfile, /name="nickname"/);
assert.match(guestProfile, /Sign in to sync/);
assert.doesNotMatch(guestProfile, /data-logout/);
const accountProfile = profileView({ email: 'student@example.edu' }, guestState);
assert.match(accountProfile, /student@example\.edu/);
assert.match(accountProfile, /data-logout/);

const partialProgress = progressView(topics, logic.lessons, guestState, []);
assert.match(partialProgress, /1 of 3 lessons/);
assert.match(partialProgress, /role="progressbar"/);
assert.match(partialProgress, /Quiz scores do not change lesson progress or XP/i);
assert.match(partialProgress, /No quiz attempts yet/);
const completeProgress = progressView(topics, logic.lessons, {
  ...guestState,
  completedLessons: logic.lessons.map((lesson) => lesson.id)
}, null);
assert.match(completeProgress, /3 of 3 lessons/);
assert.match(completeProgress, /Quiz history could not be loaded/i);

const practice = practiceView(bank);
const assessment = assessmentView(bank);
const firstFlashcard = flashcardsView(bank);
const revealedFlashcard = flashcardsView(bank, 1, true);
assert.match(practice, /data-start-practice="logic-propositions"/);
assert.match(practice, /mixed/i);
assert.match(assessment, /data-start-assessment/);
assert.match(assessment, /untimed/i);
assert.match(assessment, /no XP/i);
assert.doesNotMatch(`${practice}${assessment}`, /data-complete=/);
assert.match(firstFlashcard, /Card 1 of 15/);
assert.match(firstFlashcard, /data-flashcard-answer hidden/);
assert.match(firstFlashcard, /data-flashcard-reveal/);
assert.match(revealedFlashcard, /data-flashcard-answer(?! hidden)/);
assert.match(revealedFlashcard, /data-flashcard-next/);
assert.match(flashcardsView({ quizzes: [] }), /Try a quiz/);
const focusedQuestions = selectPracticeQuestions(bank, 'logic-propositions');
assert.equal(focusedQuestions.length, 5);
assert.equal(new Set(focusedQuestions.map((question) => question.id)).size, 5);
const mixedQuestions = selectPracticeQuestions(bank, 'mixed-review', () => 0.5);
assert.equal(mixedQuestions.length, 5);
assert.equal(new Set(mixedQuestions.map((question) => question.id)).size, 5);
const assessmentQuestions = selectAssessmentQuestions(bank, () => 0.5);
assert.equal(assessmentQuestions.length, 15);
assert.equal(new Set(assessmentQuestions.map((question) => question.id)).size, 15);
assert.throws(() => selectPracticeQuestions({ quizzes: [] }, 'mixed-review'), /question/i);
assert.throws(() => selectAssessmentQuestions({ quizzes: [] }), /at least 5/i);
assert.throws(() => selectAssessmentQuestions({
  quizzes: [{ questions: bank.quizzes[0].questions.slice(0, 4) }]
}), /at least 5/i);
const practiceResult = {
  questions: focusedQuestions,
  answers: [1, ...focusedQuestions.slice(1).map((question) => question.answerIndex)],
  result: scoreQuiz(focusedQuestions, [1, ...focusedQuestions.slice(1).map((question) => question.answerIndex)])
};
assert.equal(practiceResult.result.score, 4);
assert.match(practiceResultsView(practiceResult), /Your answer:/);
assert.match(practiceResultsView(practiceResult), /does not change lesson progress or XP/);
const assessmentResult = {
  questions: focusedQuestions,
  answers: practiceResult.answers,
  result: practiceResult.result
};
assert.match(assessmentResultsView(assessmentResult), /Review your answers/);
assert.match(assessmentResultsView(assessmentResult), /Your XP and lesson progress have not changed/);
assert.doesNotMatch(`${practiceResultsView(practiceResult)}${assessmentResultsView(assessmentResult)}`, /data-complete=/);

console.log('Learning experience helper tests passed.');
