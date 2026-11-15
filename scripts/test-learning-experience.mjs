import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getNextLesson, getTopicProgress, youtubeSearchUrl } from '../js/core/learning.mjs';
import { getDashboardActivity, recordDashboardActivity, setDashboardGoal } from '../js/core/dashboard-activity.mjs';
import { localDateKey } from '../js/core/dates.mjs';
import { loadPageData } from '../js/core/page-data.mjs';
import { normalizeProfilePreferences } from '../js/core/profile-preferences.mjs';
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

assert.deepEqual(normalizeProfilePreferences(), {
  program: '',
  yearLevel: '',
  weeklyGoal: 3,
  sessionLength: 25,
  preferredTime: 'flexible',
  lessonStyle: 'worked-examples',
  studyReminders: false,
  assessmentUpdates: false,
  reduceMotion: false
}, 'profile preferences: supplies unset academic defaults');
assert.deepEqual(normalizeProfilePreferences({
  program: 'BS Computer Science',
  yearLevel: '10th year',
  weeklyGoal: '4',
  sessionLength: 20,
  preferredTime: 'midnight',
  lessonStyle: 'lectures',
  studyReminders: 'yes',
  assessmentUpdates: true,
  reduceMotion: 1,
  unexpected: 'discarded'
}), {
  program: 'BS Computer Science',
  yearLevel: '',
  weeklyGoal: 4,
  sessionLength: 25,
  preferredTime: 'flexible',
  lessonStyle: 'worked-examples',
  studyReminders: false,
  assessmentUpdates: true,
  reduceMotion: false
}, 'profile preferences: normalizes invalid and partial values');

const resourcesByPage = {
  dashboard: ['data/topics.json', 'data/lessons/logic.json', 'data/quizzes/logic.json', 'data/dashboard-notices.json'],
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
  bank: 'data/quizzes/logic.json',
  notices: 'data/dashboard-notices.json'
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

const themeBootstrap = readFileSync(new URL('../js/core/theme-bootstrap.js', import.meta.url), 'utf8');
for (const [storedTheme, expectedTheme] of [['dark', 'dark'], ['light', 'light'], [null, 'light'], ['invalid', 'light']]) {
  const document = { documentElement: { dataset: {} } };
  runInNewContext(themeBootstrap, {
    document,
    localStorage: { getItem: () => storedTheme === null ? null : JSON.stringify({ theme: storedTheme }) },
    console
  });
  assert.equal(document.documentElement.dataset.theme, expectedTheme, `bootstrap applies ${expectedTheme} before rendering`);
}

for (const page of ['../index.html', ...[
  'dashboard', 'courses', 'lessons', 'quizzes', 'profile',
  'progress', 'practice', 'assessments', 'flashcards', 'login'
].map((page) => `../pages/${page}.html`)]) {
  const html = readFileSync(new URL(page, import.meta.url), 'utf8');
  const bootstrapIndex = html.indexOf('theme-bootstrap.js');
  const stylesIndex = html.indexOf('css/tokens.css');
  assert.notEqual(bootstrapIndex, -1, `${page} loads the synchronous theme bootstrap`);
  assert.ok(stylesIndex === -1 || bootstrapIndex < stylesIndex, `${page} applies the saved theme before stylesheets`);
}

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
assert.match(readFileSync(new URL('../css/home.css', import.meta.url), 'utf8'), /SCHOOL%20BACKGROUND\.jpg/);
const dashboard = dashboardView(topics, logic.lessons, guestState, []);
assert.match(dashboard, /Welcome back, &lt;student&gt;/);
assert.match(dashboard, /logic-truth-tables/);
const completedDashboard = dashboardView(topics, logic.lessons, {
  ...guestState,
  completedLessons: logic.lessons.map((lesson) => lesson.id)
}, []);
assert.match(completedDashboard, /All Logic lessons complete/i);
assert.doesNotMatch(completedDashboard, /lesson=undefined/);

const [propositionQuiz, truthTableQuiz, predicateQuiz] = bank.quizzes;
const shiftedDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};
const reviewTimestamp = new Date(2026, 10, 13, 12).toISOString();
const reviewEvents = [
  {
    type: 'quiz-attempt',
    mode: 'mixed-review',
    score: 2,
    total: 5,
    missedQuestionIds: [truthTableQuiz.questions[0].id, truthTableQuiz.questions[1].id, propositionQuiz.questions[0].id],
    timestamp: reviewTimestamp
  },
  {
    type: 'flashcard-revealed',
    id: propositionQuiz.questions[1].id,
    timestamp: reviewTimestamp
  },
  {
    type: 'quiz-attempt',
    mode: 'logic-propositions',
    score: 3,
    total: 5,
    missedQuestionIds: [propositionQuiz.questions[0].id],
    timestamp: reviewTimestamp
  },
  {
    type: 'lesson-completed',
    id: 'logic-propositions',
    timestamp: reviewTimestamp
  },
  {
    type: 'quiz-attempt',
    mode: 'logic-propositions',
    score: 4,
    total: 5,
    missedQuestionIds: [propositionQuiz.questions[2].id],
    timestamp: reviewTimestamp
  },
  {
    type: 'quiz-attempt',
    mode: 'logic-predicates',
    score: 4,
    total: 5,
    missedQuestionIds: [predicateQuiz.questions[0].id],
    timestamp: reviewTimestamp
  }
];
const currentNotices = [
  {
    id: 'fvc-review',
    source: 'FVC',
    title: 'Final review <session>',
    body: 'Room 4',
    publishedAt: localDateKey(),
    dueAt: shiftedDate(1)
  },
  {
    id: 'instructor-note',
    source: 'Instructor',
    title: 'Bring your notes',
    body: 'Optional practice session.'
  },
  { id: 'future', source: 'FVC', title: 'Future notice', body: 'Not yet.', publishedAt: shiftedDate(1) },
  { id: 'expired', source: 'Instructor', title: 'Expired notice', body: 'No longer current.', expiresAt: shiftedDate(-1) },
  { id: 'malformed', source: 'Other', title: 'Malformed notice', body: 'Invalid source.' },
  { id: 'bad-date', source: 'FVC', title: 'Bad date', body: 'Invalid date.', dueAt: '2026-02-31' }
];
const insightsDashboard = dashboardView(topics, logic.lessons, guestState, [], '', {
  activity: {
    goal: 'flashcards',
    today: { date: localDateKey(), lessonIds: ['logic-propositions'], flashcardIds: ['card-1', 'card-2'] },
    recentEvents: reviewEvents
  },
  notices: currentNotices,
  questions: bank
});
assert.match(insightsDashboard, /data-dashboard-goal/);
assert.match(insightsDashboard, /2 of 10 cards/);
assert.match(insightsDashboard, /aria-valuenow="2"/);
const reviewCard = insightsDashboard.match(/<article class="clay learning-panel dashboard-review"[\s\S]*?<\/article>/)?.[0] || '';
assert.match(reviewCard, /Needs review today/);
assert.ok(
  reviewCard.indexOf('Propositions and connectives') < reviewCard.indexOf('Truth tables and equivalences'),
  'review groups are ordered by missed-question count'
);
assert.match(reviewCard, new RegExp(propositionQuiz.questions[0].prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(reviewCard, /lesson=logic-propositions/);
assert.doesNotMatch(reviewCard, new RegExp(predicateQuiz.questions[0].prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(insightsDashboard, /&lt;session&gt;/);
assert.doesNotMatch(insightsDashboard, /<session>/);
const noticesCard = insightsDashboard.match(/<article class="clay learning-panel dashboard-notices"[\s\S]*?<\/article>/)?.[0] || '';
assert.match(noticesCard, /Final review &lt;session&gt;/);
assert.match(noticesCard, /Instructor/);
assert.match(noticesCard, new RegExp(`datetime="${shiftedDate(1)}"`));
const expectedDueDate = new Date(`${shiftedDate(1)}T00:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC' });
assert.ok(noticesCard.includes(`Due ${expectedDueDate}`), 'date-only deadlines keep their calendar day across time zones');
assert.doesNotMatch(noticesCard, /Future notice|Expired notice|Malformed notice|Bad date/);
const recentActivity = insightsDashboard.match(/<ol[^>]*data-dashboard-activity[^>]*>([\s\S]*?)<\/ol>/)?.[1] || '';
assert.equal((recentActivity.match(/<li\b/g) || []).length, 3, 'recent activity includes at most three entries');
assert.ok(
  insightsDashboard.indexOf('Choose how to learn today') < insightsDashboard.indexOf('data-dashboard-activity'),
  'recent activity appears beneath the study-tool links'
);
const emptyInsightsDashboard = dashboardView(topics, logic.lessons, guestState, [], '', {
  activity: { goal: 'lesson', today: { date: localDateKey(), lessonIds: [], flashcardIds: [] }, recentEvents: [] },
  notices: [],
  questions: bank
});
assert.match(emptyInsightsDashboard, /Complete a quiz to build your review list/);
assert.match(emptyInsightsDashboard, /No current announcements or deadlines/);
const perfectInsightsDashboard = dashboardView(topics, logic.lessons, guestState, [], '', {
  activity: {
    goal: 'lesson',
    today: { date: localDateKey(), lessonIds: [], flashcardIds: [] },
    recentEvents: [{ ...reviewEvents[0], missedQuestionIds: [] }]
  },
  notices: [],
  questions: bank
});
assert.match(perfectInsightsDashboard, /No missed questions from your recent attempts/);

const courses = coursesView(topics, logic.lessons, guestState);
assert.match(courses, /Propositions and connectives/);
assert.match(courses, /Coming soon/);
assert.match(courses, /youtube\.com\/results/);
assert.doesNotMatch(courses, /href="(?:\.{0,2}\/)*pages\/courses\.html".*Coming soon/);

const lessonView = lessonsView(logic.lessons, guestState, 'unknown-lesson');
assert.match(lessonView, /Propositions and connectives/);
assert.match(lessonView, /aria-label=['"]A connective map relating p and q['"]/);
for (const lesson of logic.lessons) {
  if (lesson.sections.some((section) => section.diagram)) {
    const themedLesson = lessonsView(logic.lessons, guestState, lesson.id);
    assert.doesNotMatch(themedLesson, /#(?:04113A|eaf0ff|edfff4|fff|FDEF03|01A54E)/i);
    assert.match(themedLesson, /fill='var\(--ink\)'/);
    assert.match(themedLesson, /var\(--surface(?:-soft)?\)/);
  }
}
assert.match(lessonView, /Reveal explanation/);
assert.match(lessonView, /youtube\.com\/results/);
assert.doesNotMatch(lessonView, /unknown-lesson/);

const guestProfile = profileView(null, guestState);
assert.match(guestProfile, /class="profile-page"/);
const profileIntroIndex = guestProfile.indexOf('class="learning-page-intro"');
const profileLayoutIndex = guestProfile.indexOf('class="profile-layout"');
const profileSummaryIndex = guestProfile.indexOf('class="profile-summary clay"');
const profileFormIndex = guestProfile.indexOf('data-profile-form');
const profileAccountIndex = guestProfile.indexOf('class="profile-account clay"');
assert.ok(profileIntroIndex < profileLayoutIndex && profileLayoutIndex < profileSummaryIndex && profileSummaryIndex < profileFormIndex && profileFormIndex < profileAccountIndex);
assert.match(guestProfile, /Guest learner/);
assert.match(guestProfile, /name="nickname"/);
assert.match(guestProfile, /Sign in to sync/);
assert.doesNotMatch(guestProfile, /data-logout/);
for (const [name, label] of [
  ['program', 'Program'],
  ['yearLevel', 'Year level'],
  ['weeklyGoal', 'Weekly study goal'],
  ['sessionLength', 'Typical session length'],
  ['preferredTime', 'Preferred study time'],
  ['lessonStyle', 'Lesson support'],
  ['theme', 'Appearance']
]) {
  assert.match(guestProfile, new RegExp(`name="${name}"`), `${name} control is present`);
  assert.match(guestProfile, new RegExp(`<label[^>]*>${label}</label>`), `${name} control has a label`);
}
for (const [name, label] of [['studyReminders', 'Study reminders'], ['assessmentUpdates', 'Assessment updates'], ['reduceMotion', 'Reduce motion']]) {
  assert.match(guestProfile, new RegExp(`name="${name}"`), `${name} control is present`);
  assert.match(guestProfile, new RegExp(`<label class="profile-toggle"><span>${label}</span><input[^>]*name="${name}"`), `${name} control has a full-row label`);
}
assert.match(guestProfile, /name="program"><option value="" selected>Not set/);
assert.match(guestProfile, /name="yearLevel"><option value="" selected>Not set/);
assert.doesNotMatch(guestProfile, /profile-summary-details|data-profile-(program|year)-summary/);
assert.match(guestProfile, /Reminder preferences are saved locally; no notifications are sent/i);
const accountProfile = profileView({ email: 'student@example.edu' }, guestState);
assert.match(accountProfile, /class="profile-page"/);
assert.match(accountProfile, /student@example\.edu/);
assert.match(accountProfile, /data-logout/);
assert.match(accountProfile, /data-change-email/);
assert.match(accountProfile, /data-reauthenticate/);
assert.doesNotMatch(accountProfile, /name="email"/);

const zeroProgress = progressView(topics, logic.lessons, { ...guestState, completedLessons: [] }, []);
const partialProgress = progressView(topics, logic.lessons, guestState, []);
assert.match(partialProgress, /class="progress-page"/);
assert.match(partialProgress, /1 of 3 lessons/);
assert.match(partialProgress, /role="progressbar"/);
assert.match(partialProgress, /Quiz scores do not change lesson progress or XP/i);
assert.match(partialProgress, /No quiz attempts yet/);
const courseIndex = partialProgress.indexOf('class="progress-course-section"');
const lessonIndex = partialProgress.indexOf('class="progress-lesson-list"');
const totalsIndex = partialProgress.indexOf('class="progress-summary-grid"');
const historyIndex = partialProgress.indexOf('progress-history');
const upcomingIndex = partialProgress.indexOf('class="progress-upcoming-section"');
assert.ok(courseIndex < lessonIndex && lessonIndex < totalsIndex && totalsIndex < historyIndex && historyIndex < upcomingIndex);
assert.match(zeroProgress, /0 of 3 lessons/);
const upcomingHtml = partialProgress.match(/<section class="progress-upcoming-section"[\s\S]*?<\/section>/)?.[0] ?? '';
assert.equal((upcomingHtml.match(/class="progress-topic clay"/g) ?? []).length, 8);
assert.doesNotMatch(upcomingHtml, /<a\b/);
const completeProgress = progressView(topics, logic.lessons, {
  ...guestState,
  completedLessons: logic.lessons.map((lesson) => lesson.id)
}, null);
assert.match(completeProgress, /3 of 3 lessons/);
assert.match(completeProgress, /Quiz history could not be loaded/i);
const attemptHistory = progressView(topics, logic.lessons, guestState, Array.from({ length: 11 }, (_, index) => ({
  mode: 'logic-propositions',
  score: index,
  total: 5,
  taken_at: index === 0 ? 'not-a-date' : `2026-11-${String(index).padStart(2, '0')}T12:00:00Z`
})));
const attemptRows = attemptHistory.match(/<ol class="progress-attempts">([\s\S]*?)<\/ol>/)?.[1] ?? '';
assert.equal((attemptRows.match(/<li>/g) ?? []).length, 10);
assert.match(attemptRows, /Date unavailable/);
assert.match(attemptRows, /0 \/ 5/);

const practice = practiceView(bank);
const assessment = assessmentView(bank);
const firstFlashcard = flashcardsView(bank);
const revealedFlashcard = flashcardsView(bank, 1, true);
const reducedAssessment = assessmentView({ quizzes: [{ questions: bank.quizzes[0].questions.slice(0, 4) }] });
assert.match(practice, /data-start-practice="logic-propositions"/);
assert.match(practice, /mixed/i);
assert.match(assessment, /class="assessment-page"/);
assert.match(assessment, /15 available questions/);
assert.match(assessment, /explanations after you submit/i);
assert.match(assessment, /data-start-assessment/);
assert.match(assessment, /untimed/i);
assert.match(assessment, /no XP/i);
assert.match(reducedAssessment, /4 available questions/);
assert.match(reducedAssessment, /at least five questions/);
assert.doesNotMatch(reducedAssessment, /data-start-assessment/);
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

function createMemoryAdapter() {
  const values = new Map();
  return {
    async get(key, fallback = null) {
      return values.has(key) ? values.get(key) : fallback;
    },
    async set(key, value) {
      values.set(key, value);
      return value;
    }
  };
}

const activityAdapter = createMemoryAdapter();
const activityDay = new Date(2026, 10, 13, 12);
assert.deepEqual(await getDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  now: activityDay
}), {
  goal: 'lesson',
  today: { date: '2026-11-13', lessonIds: [], flashcardIds: [] },
  recentEvents: []
}, 'dashboard activity defaults to a lesson goal and empty history');
await setDashboardGoal({ localAdapter: activityAdapter, userId: null, goal: 'flashcards' });
await assert.rejects(
  () => setDashboardGoal({ localAdapter: activityAdapter, userId: null, goal: 'invalid' }),
  /goal/i,
  'dashboard activity rejects unsupported goals'
);
await recordDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  event: { type: 'lesson-completed', id: 'logic-propositions' },
  now: activityDay
});
await recordDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  event: { type: 'lesson-completed', id: 'logic-propositions' },
  now: activityDay
});
await recordDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  event: { type: 'flashcard-revealed', id: 'question-1' },
  now: activityDay
});
await recordDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  event: { type: 'flashcard-revealed', id: 'question-1' },
  now: activityDay
});
await recordDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  event: { type: 'quiz-attempt', mode: 'logic-propositions', score: 3, total: 5, missedQuestionIds: ['question-2', 'question-3'] },
  now: activityDay
});
const guestActivity = await getDashboardActivity({ localAdapter: activityAdapter, userId: null, now: activityDay });
assert.equal(guestActivity.goal, 'flashcards');
assert.deepEqual(guestActivity.today, {
  date: '2026-11-13',
  lessonIds: ['logic-propositions'],
  flashcardIds: ['question-1']
}, 'repeated lesson and flashcard events count once toward the daily goal');
assert.deepEqual(guestActivity.recentEvents[0], {
  type: 'quiz-attempt',
  mode: 'logic-propositions',
  score: 3,
  total: 5,
  missedQuestionIds: ['question-2', 'question-3'],
  timestamp: activityDay.toISOString()
}, 'quiz attempts retain missed question IDs and timestamps');
assert.equal(guestActivity.recentEvents.length, 5);
assert.deepEqual(await getDashboardActivity({
  localAdapter: activityAdapter,
  userId: 'student-1',
  now: activityDay
}), {
  goal: 'lesson',
  today: { date: '2026-11-13', lessonIds: [], flashcardIds: [] },
  recentEvents: []
}, 'signed-in activity is separate from guest activity');

const nextActivityDay = new Date(2026, 10, 14, 8);
const rolledActivity = await getDashboardActivity({
  localAdapter: activityAdapter,
  userId: null,
  now: nextActivityDay
});
assert.equal(rolledActivity.goal, 'flashcards', 'date rollover preserves the selected goal');
assert.deepEqual(rolledActivity.today, {
  date: '2026-11-14',
  lessonIds: [],
  flashcardIds: []
}, 'date rollover clears only daily counters');
assert.equal(rolledActivity.recentEvents.length, 5, 'date rollover preserves recent history');

for (let index = 0; index < 21; index += 1) {
  await recordDashboardActivity({
    localAdapter: activityAdapter,
    userId: 'student-2',
    event: { type: 'lesson-completed', id: `lesson-${index}` },
    now: new Date(2026, 10, 13, 12, index)
  });
}
const boundedActivity = await getDashboardActivity({
  localAdapter: activityAdapter,
  userId: 'student-2',
  now: activityDay
});
assert.equal(boundedActivity.recentEvents.length, 20, 'recent activity is bounded to 20 events');
assert.equal(boundedActivity.recentEvents[0].id, 'lesson-20', 'recent events are newest first');

console.log('Learning experience helper tests passed.');
