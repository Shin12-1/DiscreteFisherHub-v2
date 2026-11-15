import { getState, saveState, saveProfilePreferences, touchStreak, completeLesson } from '../core/state.js';
import { initTheme, toggleTheme } from '../core/theme.js';
import { shell } from '../components/shell.js';
import { pageUrl } from '../core/router.js';
import { getCurrentUser, getLeaderboard, getQuizAttempts, initialiseAuth, recordQuizAttempt, signOut } from '../core/auth.js';
import { loadPageData } from '../core/page-data.mjs';
import { validateNickname } from '../core/auth-validation.mjs';
import { normalizeProfilePreferences } from '../core/profile-preferences.mjs';
import { getLocalStorageAdapter, getStorageAdapter } from '../core/storage.js';
import { getDashboardActivity, recordDashboardActivity, setDashboardGoal } from '../core/dashboard-activity.mjs';
import { renderPageSkeleton } from '../components/loading.js';
import { escapeHtml as escape } from '../core/html.mjs';
import { mountTruthWidget } from '../components/truth-widget.mjs';
import { createStudyTimer } from '../core/study-time.mjs';
import { recordActivityCompletion, recordLearnerEvent, recordStudySession, syncPendingStudySessions } from '../core/learner-events.mjs';
import {
  countUnreadNotifications,
  evaluateAndSaveGuestAchievements,
  listGuestNotifications,
  listNotifications,
  markGuestNotificationRead,
  markNotificationRead
} from '../core/notifications.mjs';

let quizApi;
let practiceApi;
let studyTimer;
let studySessionId;
let studyStartedAt;
let lastSavedStudySeconds = 0;
let studyFlushQueue = Promise.resolve();
let lessonStartedAtSeconds;
let pageVisitRecorded = false;
let lessonOpenedRecorded = false;
let achievementCatalog;
let weeklyChallengeCatalog;
let notificationOwnerId;
const notificationState = { notifications: [], unreadCount: 0, loaded: false, error: '' };
let achievementFeedbackQueue = [];
const base = location.pathname.includes('/pages/') ? '../' : '';
const load = async (path) => { const response = await fetch(base + path); if (!response.ok) throw new Error(`Could not load ${path}`); return response.json(); };
const app = document.querySelector('#app');
const page = document.body.dataset.page;

function notificationListMarkup() {
  if (notificationState.error) {
    return `<p class="form-error" role="alert">${escape(notificationState.error)} <button class="notification-mark-read" data-notifications-retry type="button">Try again</button></p>`;
  }
  if (!notificationState.loaded) return '<p>Loading notifications…</p>';
  if (!notificationState.notifications.length) return '<p>You’re all caught up. Achievement updates will appear here.</p>';
  return `<ol>${notificationState.notifications.map((notification) => {
    const date = new Date(notification.unlockedAt);
    const dateText = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
    return `<li class="notification-item ${notification.readAt ? '' : 'notification-item-unread'}"><h3>${escape(notification.title)}</h3><time datetime="${escape(notification.unlockedAt)}">${escape(dateText)}</time><p>${escape(notification.body)}</p>${notification.readAt ? '<span>Read</span>' : `<button class="notification-mark-read" data-notification-read="${escape(notification.id)}" type="button">Mark as read</button>`}</li>`;
  }).join('')}</ol>`;
}

function paintNotificationState() {
  const toggle = app.querySelector('[data-notifications-toggle]');
  const count = app.querySelector('[data-notification-count]');
  const list = app.querySelector('[data-notification-list]');
  if (toggle) toggle.setAttribute('aria-label', `Notifications${notificationState.unreadCount ? `, ${notificationState.unreadCount} unread` : ''}`);
  if (count) {
    count.textContent = notificationState.unreadCount > 99 ? '99+' : String(notificationState.unreadCount);
    count.hidden = notificationState.unreadCount === 0;
  }
  if (list) {
    list.innerHTML = notificationListMarkup();
    list.setAttribute('aria-busy', 'false');
  }
}

function renderShell(content, theme) {
  app.innerHTML = shell(page, content, theme, notificationState.unreadCount);
  paintNotificationState();
}

function getNotificationClient() {
  return getActivityAdapter()?.client || null;
}

async function refreshNotificationState(announce = false) {
  if (!achievementCatalog || !weeklyChallengeCatalog) return;
  const localAdapter = getLocalStorageAdapter();
  const userId = getCurrentUser()?.id || null;
  const client = getNotificationClient();
  try {
    if (!userId) {
      await evaluateAndSaveGuestAchievements({
        localAdapter,
        catalog: achievementCatalog,
        challengeCatalog: weeklyChallengeCatalog
      });
    }
    const [notifications, unreadCount] = await Promise.all([
      userId ? listNotifications({ client, limit: 50 }) : listGuestNotifications({ localAdapter, limit: 50 }),
      countUnreadNotifications(userId ? { client } : { localAdapter })
    ]);
    const existingIds = new Set(notificationState.notifications.map(({ id }) => id));
    const shouldAnnounce = announce && notificationState.loaded;
    notificationState.notifications = notifications;
    notificationState.unreadCount = unreadCount;
    notificationState.error = '';
    notificationState.loaded = true;
    paintNotificationState();
    if (shouldAnnounce) {
      for (const notification of notifications) {
        if (!existingIds.has(notification.id)) showAchievementUnlock(notification);
      }
    }
  } catch (error) {
    console.error('Could not load achievement notifications.', error);
    notificationState.error = 'Notifications could not be loaded.';
    notificationState.loaded = true;
    paintNotificationState();
  }
}

async function setNotificationRead(notificationId) {
  const userId = getCurrentUser()?.id;
  try {
    if (userId) {
      await markNotificationRead({ client: getNotificationClient(), notificationId });
    } else {
      await markGuestNotificationRead({ localAdapter: getLocalStorageAdapter(), notificationId });
    }
    await refreshNotificationState();
  } catch (error) {
    console.error('Could not mark the notification as read.', error);
    notificationState.error = 'This notification could not be updated.';
    paintNotificationState();
  }
}

function setNotificationPanelOpen(open, restoreFocus = false) {
  const button = app.querySelector('[data-notifications-toggle]');
  const panel = app.querySelector('#notification-panel');
  if (!button || !panel) return;
  button.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  if (open) {
    panel.querySelector('[data-notifications-close]')?.focus();
  } else if (restoreFocus) {
    button.focus();
  }
}

function showAchievementUnlock(notification) {
  if (notification) achievementFeedbackQueue.push(notification);
  if (document.querySelector('[data-achievement-feedback]') || !achievementFeedbackQueue.length) return;
  const next = achievementFeedbackQueue.shift();
  const overlay = document.createElement('div');
  overlay.className = 'level-up achievement-unlock';
  overlay.dataset.achievementFeedback = '';
  overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="achievement-unlock-title"><p class="tag">Achievement unlocked</p><h2 id="achievement-unlock-title">${escape(next.title)}</h2><p>${escape(next.body)}</p>${next.rewardTitle ? `<p class="achievement-reward">New title: <strong>${escape(next.rewardTitle)}</strong></p>` : ''}<button class="button button-secondary" data-close-achievement type="button">Keep learning</button></div>`;
  document.body.append(overlay);
  const close = () => {
    overlay.remove();
    showAchievementUnlock();
  };
  overlay.querySelector('button').focus();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.matches('[data-close-achievement]')) close();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

function recordDashboardEvent(event, errorMessage) {
  return recordDashboardActivity({
    localAdapter: getLocalStorageAdapter(),
    userId: getCurrentUser()?.id || null,
    event
  }).catch((error) => console.error(errorMessage, error));
}

function getActivityAdapter() {
  const adapter = getStorageAdapter();
  return adapter.kind === 'supabase' ? adapter : null;
}

async function recordLearnerActivity(event, errorMessage) {
  try {
    const result = await recordLearnerEvent({
    localAdapter: getLocalStorageAdapter(),
    client: getActivityAdapter(),
    userId: getCurrentUser()?.id || null,
    event
    });
    if (!result.duplicate) await refreshNotificationState(true);
    return result;
  } catch (error) {
    console.error(errorMessage, error);
  }
}

async function recordActivityResult(completion, errorMessage) {
  try {
    const result = await recordActivityCompletion({
    localAdapter: getLocalStorageAdapter(),
    client: getActivityAdapter(),
    userId: getCurrentUser()?.id || null,
    completion
    });
    if (!result.duplicate) await refreshNotificationState(true);
    return result;
  } catch (error) {
    console.error(errorMessage, error);
  }
}

function activeStudySeconds() {
  if (!studyTimer) return 0;
  const seconds = studyTimer.stop();
  studyTimer.start();
  return seconds;
}

function activityDuration(startedAtSeconds) {
  return Math.max(1, activeStudySeconds() - startedAtSeconds);
}

async function flushStudySession(final = false) {
  if (!studyTimer) return;
  const durationSeconds = studyTimer.stop();
  if (!final) studyTimer.start();
  if (durationSeconds <= 0 || (durationSeconds <= lastSavedStudySeconds && !final)) return;
  const save = async () => {
    if (durationSeconds <= lastSavedStudySeconds && !final) return;
    try {
      await recordStudySession({
        localAdapter: getLocalStorageAdapter(),
        client: getActivityAdapter(),
        userId: getCurrentUser()?.id || null,
        session: {
          id: studySessionId,
          startedAt: studyStartedAt,
          endedAt: new Date().toISOString(),
          durationSeconds
        }
      });
      lastSavedStudySeconds = Math.max(lastSavedStudySeconds, durationSeconds);
      await refreshNotificationState(true);
    } catch (error) {
      console.error('Could not save active study time.', error);
    }
  };
  studyFlushQueue = studyFlushQueue.then(save, save);
  await studyFlushQueue;
}

function startStudyTracking() {
  if (studyTimer) return;
  studyTimer = createStudyTimer({ now: () => performance.now() });
  studySessionId = crypto.randomUUID();
  studyStartedAt = new Date().toISOString();
  studyTimer.setVisible(document.visibilityState === 'visible');
  studyTimer.start();
  retryPendingStudySessions();
  const markActivity = () => studyTimer.activity();
  document.addEventListener('pointerdown', markActivity, { passive: true });
  document.addEventListener('keydown', markActivity);
  document.addEventListener('touchstart', markActivity, { passive: true });
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    studyTimer.setVisible(visible);
    if (!visible) void flushStudySession();
  });
  window.addEventListener('pagehide', () => { void flushStudySession(true); }, { once: true });
  window.addEventListener('online', retryPendingStudySessions);
  window.setInterval(() => { void flushStudySession(); }, 15_000);
}

function retryPendingStudySessions() {
  const userId = getCurrentUser()?.id;
  if (!userId) return;
  void syncPendingStudySessions({
    localAdapter: getLocalStorageAdapter(),
    client: getActivityAdapter(),
    userId
  }).then((synced) => {
    if (synced) return refreshNotificationState(true);
    return undefined;
  }).catch((error) => console.error('Could not sync pending study time.', error));
}

async function loadPageViews(pageName) {
  const [learning, student, practice, quiz] = await Promise.all([
    ['dashboard', 'courses', 'lessons'].includes(pageName) ? import('./learning-views.js') : null,
    ['profile', 'progress'].includes(pageName) ? import('./student-views.js') : null,
    ['practice', 'assessments', 'flashcards'].includes(pageName) ? import('./practice-views.js') : null,
    ['quizzes', 'practice', 'assessments'].includes(pageName) ? import('../core/quiz.mjs') : null
  ]);
  return { learning, student, practice, quiz };
}

const withShuffledChoices = (questions) => questions.map((question) => quizApi.shuffleChoices(question));

function closeMobileMore(restoreFocus = false) {
  const button = app.querySelector('[data-mobile-more-toggle]');
  const menu = app.querySelector('#mobile-more-menu');
  if (!button || !menu) return;
  button.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
  if (restoreFocus) button.focus();
}

app.addEventListener('click', (event) => {
  const notificationToggle = event.target.closest('[data-notifications-toggle]');
  if (notificationToggle) {
    const open = notificationToggle.getAttribute('aria-expanded') !== 'true';
    setNotificationPanelOpen(open);
    if (open) void refreshNotificationState();
    return;
  }
  if (event.target.closest('[data-notifications-close]')) {
    setNotificationPanelOpen(false, true);
    return;
  }
  const markRead = event.target.closest('[data-notification-read]');
  if (markRead) {
    void setNotificationRead(markRead.dataset.notificationRead);
    return;
  }
  if (event.target.closest('[data-notifications-retry]')) {
    void refreshNotificationState();
    return;
  }
  const button = event.target.closest('[data-mobile-more-toggle]');
  if (button) {
    const menu = app.querySelector('#mobile-more-menu');
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    menu.hidden = isOpen;
    if (!isOpen) menu.querySelector('a')?.focus();
    return;
  }
  if (event.target.closest('#mobile-more-menu a')) closeMobileMore();
});
app.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && app.querySelector('[data-notifications-toggle][aria-expanded="true"]')) {
    setNotificationPanelOpen(false, true);
  }
  if (event.key === 'Escape' && app.querySelector('[data-mobile-more-toggle][aria-expanded="true"]')) {
    closeMobileMore(true);
  }
});
document.addEventListener('click', (event) => {
  if (!app.contains(event.target)) closeMobileMore();
  if (!app.contains(event.target)) setNotificationPanelOpen(false);
});

function quizLobby(topics, bank, attempts, historyError) {
  const cards = bank.quizzes.map((quiz) => {
    const latest = attempts.find((attempt) => attempt.mode === quiz.id);
    return `<article class="quiz-card clay"><p class="tag">Logic · ${quiz.questions.length} questions</p><h2>${escape(quiz.title)}</h2><p>Practice the ideas from this lesson and see an explanation after each answer.</p>${latest ? `<p class="quiz-last-score">Latest: <strong class="num">${latest.score} / ${latest.total}</strong></p>` : '<p class="quiz-last-score">No attempts yet</p>'}<button class="button button-primary" type="button" data-start-quiz="${escape(quiz.id)}">Start quiz</button></article>`;
  }).join('');
  const mixedReview = '<article class="quiz-card quiz-card-mixed clay"><p class="tag">All Logic lessons</p><h2>Mixed Logic review</h2><p>Try five questions sampled from the available Logic lessons.</p><p class="quiz-last-score">Questions are mixed for each attempt.</p><button class="button button-primary" type="button" data-start-quiz="mixed-review">Start mixed review</button></article>';
  const history = attempts.length ? `<ol class="quiz-history-list">${attempts.map((attempt) => {
    const title = attempt.mode === 'mixed-review' ? 'Mixed Logic review' : bank.quizzes.find((quiz) => quiz.id === attempt.mode)?.title || 'Logic practice';
    const date = new Date(attempt.taken_at);
    const takenAt = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
    return `<li><span><strong>${escape(title)}</strong><small>${escape(takenAt)}</small></span><strong class="num">${attempt.score} / ${attempt.total}</strong></li>`;
  }).join('')}</ol>` : '<p>No attempts yet. Complete a quiz to build your history.</p>';
  const unavailable = topics.filter((topic) => topic.id !== bank.topicId).map((topic) => `<article class="quiz-unavailable-card"><h3>${escape(topic.title)}</h3><span class="tag">Not available yet</span></article>`).join('');
  return `<div class="quiz-catalogue">
    <section class="quiz-intro clay"><p class="tag">Low-stakes practice · no XP</p><h1 id="quiz-page-heading" tabindex="-1">Check your understanding.</h1><p>Build confidence with the Logic lessons that are ready now. Answer one question at a time, learn from each explanation, and retry anything you missed.</p></section>
    <section class="quiz-section" aria-labelledby="available-quizzes-heading"><div class="section-heading"><div><h2 id="available-quizzes-heading">Available quizzes</h2><p>Untimed practice. Your quiz scores do not affect your level or lesson progress.</p></div></div><div class="quiz-grid">${cards}</div></section>
    <section class="quiz-mixed-section" aria-labelledby="mixed-review-heading"><div class="section-heading"><div><h2 id="mixed-review-heading">Mixed review</h2><p>Revisit ideas from across the available Logic lessons.</p></div></div>${mixedReview}</section>
    <section class="quiz-history clay" aria-labelledby="quiz-history-heading"><div class="section-heading"><div><h2 id="quiz-history-heading">Recent attempts</h2><p>Latest 20 attempts on this device or signed-in account.</p></div></div>${historyError ? `<p class="quiz-error" role="alert">${escape(historyError)}</p>` : history}</section>
    <section class="quiz-section" aria-labelledby="more-quizzes-heading"><div class="section-heading"><div><h2 id="more-quizzes-heading">More topics</h2><p>These quizzes will appear when lesson content and questions are ready.</p></div></div><div class="quiz-unavailable-grid">${unavailable}</div></section>
  </div>`;
}
function quizQuestionView(session) {
  const question = session.questions[session.index];
  const selected = session.answers[session.index];
  const correct = selected === question.answerIndex;
  const choices = question.choices.map((choice, index) => {
    const isCorrect = session.checked && index === question.answerIndex;
    const isWrongSelection = session.checked && index === selected && !correct;
    const status = isCorrect ? '<strong class="quiz-choice-status">Correct answer</strong>' : isWrongSelection ? '<strong class="quiz-choice-status">Your answer</strong>' : '';
    return `<label class="quiz-choice ${isCorrect ? 'quiz-choice-correct' : ''} ${isWrongSelection ? 'quiz-choice-wrong' : ''}"><input type="radio" name="quiz-answer" value="${index}" data-quiz-answer ${selected === index ? 'checked' : ''} ${session.checked ? 'disabled' : ''}><span>${escape(choice)}</span>${status}</label>`;
  }).join('');
  const feedback = session.checked
    ? `<strong>${correct ? 'Correct.' : 'Not quite.'}</strong> ${correct ? '' : `The correct answer is ${escape(question.choices[question.answerIndex])}. `}${escape(question.explanation)}`
    : '';
  const isLast = session.index === session.questions.length - 1;
  return `<section class="quiz-question-panel clay"><div class="quiz-session-heading"><a href="${pageUrl('quizzes')}" data-back-to-quizzes>← All quizzes</a><span class="tag">Untimed practice · no XP</span></div><p class="quiz-progress-label">Question ${session.index + 1} of ${session.questions.length}</p><progress class="quiz-progress" value="${session.index + 1}" max="${session.questions.length}" aria-label="Quiz progress"></progress><h1 id="quiz-question-title" tabindex="-1">${escape(session.title)}</h1><p>Choose one answer. Check it to see the explanation before moving on.</p><form><fieldset class="quiz-choices"><legend>${escape(question.prompt)}</legend>${choices}</fieldset><div class="quiz-feedback" id="quiz-feedback" role="status" aria-live="polite" tabindex="-1">${feedback}</div><div class="quiz-actions">${session.checked ? `<button class="button button-primary" type="button" data-quiz-next>${isLast ? 'See results' : 'Next question'}</button>` : `<button class="button button-primary" type="button" data-quiz-check ${selected === null ? 'disabled' : ''}>Check answer</button>`}</div></form></section>`;
}
function quizResultsView(session) {
  const { score, total, missedQuestions } = session.result;
  const missed = missedQuestions.length ? `<section class="quiz-review" aria-labelledby="quiz-review-heading"><h2 id="quiz-review-heading">Review missed questions</h2><ol>${missedQuestions.map((question) => `<li><h3>${escape(question.prompt)}</h3><p><strong>Correct answer:</strong> ${escape(question.choices[question.answerIndex])}</p><p>${escape(question.explanation)}</p></li>`).join('')}</ol></section>` : '<p class="quiz-perfect">You got every question right. Try another quiz to keep practicing.</p>';
  const saveStatus = session.saving ? '<p class="quiz-save-status" role="status">Saving this attempt…</p>' : session.saveError ? `<p class="quiz-error" role="alert">${escape(session.saveError)}</p>` : '<p class="quiz-save-status" role="status">Attempt saved to your recent history.</p>';
  const retryMissed = missedQuestions.length ? `<button class="button button-secondary" type="button" data-retry-missed ${session.saving ? 'disabled' : ''}>Retry missed (${missedQuestions.length})</button>` : '';
  return `<section class="quiz-results clay" aria-labelledby="quiz-results-title"><p class="tag">Practice complete</p><h1 id="quiz-results-title" tabindex="-1">Your result</h1><p class="quiz-score"><strong class="num">${score} / ${total}</strong><span>${Math.round(score / total * 100)}%</span></p><p>Use the review below to decide what you want to revisit. This score is for practice only and does not change your XP.</p>${saveStatus}${missed}<div class="quiz-actions"><button class="button button-primary" type="button" data-retry-all ${session.saving ? 'disabled' : ''}>Try again</button>${retryMissed}<button class="button button-secondary" type="button" data-back-to-quizzes ${session.saving ? 'disabled' : ''}>All quizzes</button></div></section>`;
}
function learningQuestionPage(bank, theme, kind, mode, title, questions) {
  const session = {
    kind,
    mode,
    title,
    questions: withShuffledChoices(questions),
    answers:Array(questions.length).fill(null),
    index:0,
    checked:false,
    phase:'question',
    result:null,
    startedAtSeconds:activeStudySeconds(),
    completionRecorded:false
  };
  let currentTheme = theme;

  function render(focusSelector) {
    let content;
    if (session.phase === 'results') {
      content = kind === 'assessment' ? practiceApi.assessmentResultsView(session) : practiceApi.practiceResultsView(session);
    } else {
      const question = session.questions[session.index];
      const selected = session.answers[session.index];
      const choices = question.choices.map((choice, index) => `<label class="quiz-choice"><input type="radio" name="learning-answer" value="${index}" data-learning-answer ${selected === index ? 'checked' : ''} ${kind === 'practice' && session.checked ? 'disabled' : ''}><span>${escape(choice)}</span></label>`).join('');
      const feedback = kind === 'practice' && session.checked
        ? `<strong>${selected === question.answerIndex ? 'Correct.' : `Not quite. The correct answer is ${escape(question.choices[question.answerIndex])}.`}</strong> ${escape(question.explanation)}`
        : '';
      const isLast = session.index === session.questions.length - 1;
      const action = kind === 'practice'
        ? session.checked
          ? `<button class="button button-primary" type="button" data-learning-next>${isLast ? 'See results' : 'Next question'}</button>`
          : `<button class="button button-primary" type="button" data-learning-check ${selected === null ? 'disabled' : ''}>Check answer</button>`
        : `<div class="quiz-actions">${session.index > 0 ? '<button class="button button-secondary" type="button" data-learning-previous>Previous</button>' : ''}<button class="button button-primary" type="button" data-learning-next>${isLast ? 'Submit checkpoint' : 'Next question'}</button></div>`;
      const label = kind === 'assessment' ? 'Untimed checkpoint · no XP' : 'Immediate explanations · no XP';
      content = `<section class="quiz-question-panel clay"><div class="quiz-session-heading"><a href="${pageUrl(page)}" data-exit-learning>← ${kind === 'assessment' ? 'Assessments' : 'Practice'}</a><span class="tag">${label}</span></div><p class="quiz-progress-label">Question ${session.index + 1} of ${session.questions.length}</p><progress class="quiz-progress" value="${session.index + 1}" max="${session.questions.length}" aria-label="Question progress"></progress><h1 id="learning-question-title" tabindex="-1">${escape(title)}</h1><p>${kind === 'assessment' ? 'Choose an answer, then continue. Explanations appear after you submit.' : 'Choose one answer and check it to see an explanation.'}</p><form><fieldset class="quiz-choices"><legend>${escape(question.prompt)}</legend>${choices}</fieldset><div class="quiz-feedback" id="learning-feedback" role="status" aria-live="polite" tabindex="-1">${feedback}</div><div class="quiz-actions">${action}</div></form></section>`;
    }

    renderShell(content, currentTheme);
    app.setAttribute('aria-busy', 'false');
    app.querySelector('[data-theme-toggle]')?.addEventListener('click', async () => {
      currentTheme = (await toggleTheme()).theme;
      render();
    });
    app.querySelectorAll('[data-learning-answer]').forEach((input) => {
      input.addEventListener('change', () => {
        session.answers[session.index] = Number(input.value);
        if (kind === 'practice') app.querySelector('[data-learning-check]').disabled = false;
      });
    });
    app.querySelector('[data-learning-check]')?.addEventListener('click', () => {
      if (session.answers[session.index] === null) return;
      if (kind === 'practice') {
        const question = session.questions[session.index];
        void recordLearnerActivity({
          type: 'practice-question-answered',
          data: {
            questionId: question.id,
            correct: session.answers[session.index] === question.answerIndex,
            tags: question.tags || []
          }
        }, 'Could not record the practice answer.');
      }
      session.checked = true;
      render('#learning-feedback');
    });
    app.querySelector('[data-learning-previous]')?.addEventListener('click', () => {
      session.index -= 1;
      render('#learning-question-title');
    });
    app.querySelector('[data-learning-next]')?.addEventListener('click', () => {
      if (session.index < session.questions.length - 1) {
        session.index += 1;
        session.checked = false;
        render('[data-learning-answer]');
        return;
      }
      session.result = quizApi.scoreQuiz(session.questions, session.answers);
      session.phase = 'results';
      if (kind === 'assessment' && !session.completionRecorded) {
        session.completionRecorded = true;
        void recordActivityResult({
          type: 'checkpoint',
          activityId: session.mode,
          durationSeconds: activityDuration(session.startedAtSeconds),
          score: session.result.score,
          total: session.result.total
        }, 'Could not save checkpoint completion.');
      }
      render('#' + (kind === 'assessment' ? 'assessment-results-heading' : 'practice-results-heading'));
    });
    app.querySelector('[data-restart-learning]')?.addEventListener('click', () => {
      session.questions = withShuffledChoices(session.mode === 'mixed-review'
        ? practiceApi.selectPracticeQuestions(bank, session.mode)
        : session.questions);
      session.answers = Array(session.questions.length).fill(null);
      session.index = 0;
      session.checked = false;
      session.phase = 'question';
      session.result = null;
      session.startedAtSeconds = activeStudySeconds();
      session.completionRecorded = false;
      render('[data-learning-answer]');
    });
    app.querySelector('[data-restart-assessment]')?.addEventListener('click', () => {
      session.questions = withShuffledChoices(practiceApi.selectAssessmentQuestions(bank));
      session.answers = Array(session.questions.length).fill(null);
      session.index = 0;
      session.phase = 'question';
      session.result = null;
      session.startedAtSeconds = activeStudySeconds();
      session.completionRecorded = false;
      render('[data-learning-answer]');
    });
    app.querySelectorAll('[data-exit-learning],[data-exit-assessment]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.assign(pageUrl(page));
      });
    });
    if (focusSelector) app.querySelector(focusSelector)?.focus();
  }
  render('[data-learning-answer]');
}
function quizPage(topics, bank, initialAttempts, theme, initialHistoryError = '') {
  let attempts = initialAttempts;
  let currentTheme = theme;
  let historyError = initialHistoryError;
  let session = null;

  function start(mode, title, questions) {
    session = {
      mode,
      title,
      questions: withShuffledChoices(questions),
      answers: Array(questions.length).fill(null),
      index: 0,
      checked: false,
      phase: 'question',
      saving: false,
      saveStarted: false,
      saveError: '',
      result: null,
      startedAtSeconds: activeStudySeconds()
    };
    render('[data-quiz-answer]');
  }

  function render(focusSelector) {
    const content = session ? session.phase === 'results' ? quizResultsView(session) : quizQuestionView(session) : quizLobby(topics, bank, attempts, historyError);
    renderShell(content, currentTheme);
    app.setAttribute('aria-busy', 'false');
    app.querySelector('[data-theme-toggle]')?.addEventListener('click', async () => {
      currentTheme = (await toggleTheme()).theme;
      render();
    });
    app.querySelectorAll('[data-start-quiz]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.startQuiz;
        if (mode === 'mixed-review') {
          start(mode, 'Mixed Logic review', quizApi.selectMixedQuestions(bank.quizzes.flatMap((quiz) => quiz.questions), 5));
          return;
        }
        const quiz = bank.quizzes.find((item) => item.id === mode);
        if (quiz) start(quiz.id, quiz.title, quiz.questions);
      });
    });
    app.querySelectorAll('[data-quiz-answer]').forEach((answer) => {
      answer.addEventListener('change', () => {
        session.answers[session.index] = Number(answer.value);
        app.querySelector('[data-quiz-check]').disabled = false;
      });
    });
    app.querySelector('[data-quiz-check]')?.addEventListener('click', () => {
      if (session.answers[session.index] === null) return;
      session.checked = true;
      render('#quiz-feedback');
    });
    app.querySelector('[data-quiz-next]')?.addEventListener('click', async () => {
      if (session.index < session.questions.length - 1) {
        session.index += 1;
        session.checked = false;
        render('[data-quiz-answer]');
        return;
      }
      if (session.saveStarted) return;
      session.result = quizApi.scoreQuiz(session.questions, session.answers);
      session.phase = 'results';
      session.saving = true;
      session.saveStarted = true;
      void recordActivityResult({
        type: 'quiz',
        activityId: session.mode,
        durationSeconds: activityDuration(session.startedAtSeconds),
        score: session.result.score,
        total: session.result.total
      }, 'Could not save quiz completion.');
      render('#quiz-results-title');
      await recordDashboardEvent({
        type: 'quiz-attempt',
        mode: session.mode,
        score: session.result.score,
        total: session.result.total,
        missedQuestionIds: session.result.missedQuestions.map((question) => question.id)
      }, 'Could not save local dashboard quiz activity.');
      try {
        const savedAttempt = await recordQuizAttempt({
          topicId: bank.topicId,
          mode: session.mode,
          score: session.result.score,
          total: session.result.total
        });
        historyError = '';
        attempts = [savedAttempt, ...attempts].slice(0, 20);
      } catch (error) {
        console.error('Could not save quiz attempt.', error);
        session.saveError = 'We could not save this attempt. Your result is shown, but it will not appear in recent history.';
      } finally {
        session.saving = false;
        render('#quiz-results-title');
      }
    });
    app.querySelector('[data-retry-all]')?.addEventListener('click', () => start(session.mode, session.title, session.questions));
    app.querySelector('[data-retry-missed]')?.addEventListener('click', () => start(session.mode, session.title, session.result.missedQuestions));
    app.querySelectorAll('[data-back-to-quizzes]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        session = null;
        render('#quiz-page-heading');
      });
    });
    if (focusSelector) app.querySelector(focusSelector)?.focus();
  }

  render();
}
function leaderboardMarkup(leaderboard, leaderboardError = '') {
  if (leaderboardError) return `<p class="quiz-error" role="alert">${escape(leaderboardError)}</p>`;
  if (!leaderboard.length) return '<p class="leaderboard-empty">No learners on the board yet. Complete a lesson to be the first.</p>';
  return `<ol class="leaderboard-list">${leaderboard.map((entry, index) => `<li><span><strong class="num">${index + 1}</strong> ${escape(entry.nickname)}</span><strong class="num">${entry.xp} XP</strong></li>`).join('')}</ol>`;
}
function dashboardExtras(user) {
  const account = user
    ? `<article class="streak clay"><p class="tag">Synced account</p><h2>${escape(user.email)}</h2><p>Your progress is stored securely in your FVC study profile.</p><button class="button button-secondary" data-logout>Log out</button><p class="form-error dashboard-account-status" data-account-status role="alert" hidden></p></article>`
    : `<article class="streak clay"><p class="tag">Guest mode</p><h2>Keep your progress safe.</h2><p>Sign in to sync completed lessons across your devices.</p><a class="button button-primary" href="${pageUrl('login')}">Log in or sign up</a></article>`;
  return `<section class="dashboard-grid dashboard-bottom"><div class="leaderboard clay"><div class="section-heading"><h2>Top learners</h2><span class="tag">Top 50</span></div><div data-leaderboard aria-live="polite" aria-busy="true"><p class="leaderboard-empty">Loading top learners…</p></div></div><aside>${account}</aside></section>`;
}
async function fillLeaderboard() {
  let markup;
  try {
    markup = leaderboardMarkup(await getLeaderboard());
  } catch (error) {
    console.error('Could not load the leaderboard.', error);
    markup = leaderboardMarkup([], 'The leaderboard could not be loaded. Please try again later.');
  }
  const slot = app.querySelector('[data-leaderboard]');
  if (!slot) return;
  slot.innerHTML = markup;
  slot.setAttribute('aria-busy', 'false');
}
function showLevelUp(level) { const overlay = document.createElement('div'); overlay.className = 'level-up'; overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="level-title"><p class="tag">New milestone</p><h2 id="level-title">Level ${level} unlocked!</h2><p>Your steady work earned a new level.</p><button class="button button-secondary" data-close-level>Keep learning</button></div>`; document.body.append(overlay); overlay.querySelector('button').focus(); overlay.addEventListener('click',(event) => { if (event.target === overlay || event.target.matches('[data-close-level]')) overlay.remove(); }); }
async function render() {
  const initialTheme = document.documentElement.dataset.theme || 'light';
  renderShell(renderPageSkeleton(page), initialTheme);
  app.setAttribute('aria-busy', 'true');
  // Fetch page data and views while the session is being restored instead of afterwards.
  const pageAssets = Promise.all([
    loadPageData(page, load),
    loadPageViews(page),
    load('data/achievements.json'),
    load('data/weekly-challenges.json')
  ]);
  pageAssets.catch(() => {});
  try {
    await initialiseAuth();
    await initTheme();
    const state = await touchStreak();
    const [data, views, achievements, weeklyChallenges] = await pageAssets;
    const { topics, lessons: logic, bank } = data;
    achievementCatalog = achievements;
    weeklyChallengeCatalog = weeklyChallenges.challenges;
    const ownerId = getCurrentUser()?.id || null;
    if (notificationOwnerId !== ownerId) {
      notificationOwnerId = ownerId;
      notificationState.notifications = [];
      notificationState.unreadCount = 0;
      notificationState.loaded = false;
      notificationState.error = '';
    }
    await refreshNotificationState();
    startStudyTracking();
    if (!pageVisitRecorded) {
      pageVisitRecorded = true;
      void recordLearnerActivity({
        type: 'page-visited',
        dedupeKey: `page-visited:${page}`,
        data: { page }
      }, 'Could not record the learner page visit.');
    }
    if (page === 'lessons' && !lessonOpenedRecorded) {
      lessonOpenedRecorded = true;
      const lessonId = new URLSearchParams(location.search).get('lesson') || 'logic-propositions';
      void recordLearnerActivity({
        type: 'lesson-opened',
        data: { lessonId }
      }, 'Could not record the lesson visit.');
    }
    if (page === 'lessons' && lessonStartedAtSeconds === undefined) {
      lessonStartedAtSeconds = activeStudySeconds();
    }
    quizApi = views.quiz;
    practiceApi = views.practice;
    if (page === 'quizzes') {
      let attempts = [];
      let historyError = '';
      try {
        attempts = await getQuizAttempts();
      } catch (error) {
        console.error('Could not load quiz history.', error);
        historyError = 'Recent attempts could not be loaded. New results may also be unavailable.';
      }
      quizPage(topics, bank, attempts, state.theme, historyError);
      return;
    }

    let content;
    if (page === 'dashboard') {
      let attempts = [];
      let attemptsError = '';
      try {
        attempts = await getQuizAttempts();
      } catch (error) {
        console.error('Could not load dashboard quiz history.', error);
        attemptsError = 'Recent quiz attempts could not be loaded.';
      }
      const activity = await getDashboardActivity({
        localAdapter: getLocalStorageAdapter(),
        userId: getCurrentUser()?.id || null
      });
      content = views.learning.dashboardView(topics, logic.lessons, state, attempts, attemptsError, {
        activity,
        notices: data.notices,
        questions: bank
      });
    } else if (page === 'courses') {
      content = views.learning.coursesView(topics, logic.lessons, state);
    } else if (page === 'lessons') {
      const lessonId = new URLSearchParams(location.search).get('lesson') || 'logic-propositions';
      content = views.learning.lessonsView(logic.lessons, state, lessonId);
    } else if (page === 'profile') {
      content = views.student.profileView(getCurrentUser(), state);
    } else if (page === 'progress') {
      let attempts = null;
      try {
        attempts = await getQuizAttempts();
      } catch (error) {
        console.error('Could not load progress quiz history.', error);
      }
      content = views.student.progressView(topics, logic.lessons, state, attempts);
    } else if (page === 'practice') {
      content = views.practice.practiceView(bank);
    } else if (page === 'assessments') {
      content = views.practice.assessmentView(bank);
    } else if (page === 'flashcards') {
      content = `<div data-flashcards-content>${views.practice.flashcardsView(bank)}</div>`;
    } else {
      content = '';
    }
    if (page === 'dashboard') content += dashboardExtras(getCurrentUser());
    renderShell(content, state.theme);
    app.setAttribute('aria-busy', 'false');
    if (page === 'dashboard') fillLeaderboard();
    app.querySelector('[data-theme-toggle]')?.addEventListener('click', async () => {
      await toggleTheme();
      render();
    });
    app.querySelector('[data-dashboard-goal]')?.addEventListener('change', async (event) => {
      const control = event.currentTarget;
      const status = app.querySelector('[data-dashboard-goal-status]');
      control.disabled = true;
      try {
        await setDashboardGoal({
          localAdapter: getLocalStorageAdapter(),
          userId: getCurrentUser()?.id || null,
          goal: control.value
        });
        control.dataset.savedGoal = control.value;
        const isLessonGoal = control.value === 'lesson';
        const target = isLessonGoal ? 1 : 10;
        const count = Number(isLessonGoal ? control.dataset.lessonCount : control.dataset.flashcardCount);
        const progress = Math.min(count, target);
        const progressBar = app.querySelector('[data-dashboard-goal-progress]');
        app.querySelector('[data-dashboard-goal-progress-copy]').textContent = `${progress} of ${target} ${isLessonGoal ? 'lesson' : 'cards'}`;
        progressBar.setAttribute('aria-valuemax', String(target));
        progressBar.setAttribute('aria-valuenow', String(progress));
        progressBar.querySelector('span').style.width = `${progress / target * 100}%`;
        status.hidden = true;
      } catch (error) {
        console.error('Could not save dashboard daily goal.', error);
        control.value = control.dataset.savedGoal;
        status.hidden = false;
        status.textContent = 'Could not save your daily goal. Please try again.';
      } finally {
        control.disabled = false;
      }
    });
    app.querySelectorAll('[data-reveal]').forEach((button) => {
      button.addEventListener('click', () => {
        const answer = app.querySelector(`#answer-${button.dataset.reveal}`);
        answer.hidden = !answer.hidden;
        button.textContent = answer.hidden ? 'Reveal explanation' : 'Hide explanation';
        button.setAttribute('aria-expanded', String(!answer.hidden));
      });
    });
    app.querySelectorAll('[data-widget="truth-table"]').forEach(mountTruthWidget);
    app.querySelector('[data-complete]')?.addEventListener('click', async (event) => {
      // event.currentTarget is reset to null once the handler yields, so keep our own reference.
      const button = event.currentTarget;
      const lesson = logic.lessons.find((item) => item.id === button.dataset.complete);
      button.disabled = true;
      try {
        const result = await completeLesson(lesson.id, lesson.xp);
        if (result.awarded) {
          void recordActivityResult({
            type: 'lesson',
            activityId: lesson.id,
            durationSeconds: activityDuration(lessonStartedAtSeconds ?? 0)
          }, 'Could not save lesson completion.');
          await recordDashboardEvent({
            type: 'lesson-completed',
            id: lesson.id
          }, 'Could not save local dashboard lesson activity.');
          button.textContent = 'Completed ✓';
          button.className = 'button button-secondary';
          if (result.leveledUp) showLevelUp(result.state.level);
        } else {
          button.textContent = 'Lesson completed';
          button.className = 'button button-secondary';
        }
      } catch (error) {
        console.error('Could not save lesson progress.', error);
        button.disabled = false;
        button.textContent = 'Could not save. Try again.';
      }
    });
    app.querySelector('[data-logout]')?.addEventListener('click', async () => {
      const status = app.querySelector('[data-profile-status], [data-account-status]');
      try {
        await signOut();
        render();
      } catch (error) {
        console.error('Could not sign out.', error);
        if (status) {
          status.hidden = false;
          status.setAttribute('role', 'alert');
          status.textContent = 'Could not log out. Please try again.';
        }
      }
    });
    app.querySelector('[data-profile-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.elements.nickname;
      const error = form.querySelector('#profile-nickname-error');
      const status = form.querySelector('[data-profile-status]');
      const validationError = validateNickname(input.value);
      error.hidden = !validationError;
      error.textContent = validationError;
      input.setAttribute('aria-invalid', String(Boolean(validationError)));
      status.hidden = true;
      status.removeAttribute('role');
      if (validationError) {
        input.focus();
        return;
      }
      let accountSettingsSaved = false;
      try {
        const current = await getState();
        const nickname = input.value.trim();
        const profilePreferences = normalizeProfilePreferences({
          program: form.elements.program.value,
          yearLevel: form.elements.yearLevel.value,
          weeklyGoal: form.elements.weeklyGoal.value,
          sessionLength: form.elements.sessionLength.value,
          preferredTime: form.elements.preferredTime.value,
          lessonStyle: form.elements.lessonStyle.value,
          studyReminders: form.elements.studyReminders.checked,
          assessmentUpdates: form.elements.assessmentUpdates.checked,
          reduceMotion: form.elements.reduceMotion.checked
        });
        const theme = form.elements.theme.value === 'dark' ? 'dark' : 'light';
        const next = await saveState({ ...current, nickname, theme });
        accountSettingsSaved = true;
        if (nickname !== current.nickname) {
          void recordLearnerActivity({
            type: 'nickname-changed',
            data: { changed: true }
          }, 'Could not record the nickname change.');
        }
        app.querySelector('.profile-summary h2').textContent = nickname;
        app.querySelector('.profile-avatar').textContent = nickname.charAt(0).toUpperCase();
        input.value = nickname;
        document.documentElement.dataset.theme = next.theme;
        document.documentElement.dataset.reduceMotion = String(profilePreferences.reduceMotion);
        await saveProfilePreferences(profilePreferences);
        status.hidden = false;
        status.textContent = 'Profile settings saved.';
      } catch (error) {
        console.error('Could not save profile settings.', error);
        status.hidden = false;
        status.setAttribute('role', 'alert');
        status.textContent = accountSettingsSaved
          ? 'Account settings were saved, but study preferences could not be saved. Please try again.'
          : 'Could not save your profile settings. Please try again.';
      }
    });
    app.querySelectorAll('[data-start-practice]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.startPractice;
        const questions = practiceApi.selectPracticeQuestions(bank, mode);
        const title = mode === 'mixed-review'
          ? 'Mixed Logic practice'
          : bank.quizzes.find((quiz) => quiz.id === mode).title;
        learningQuestionPage(bank, state.theme, 'practice', mode, title, questions);
      });
    });
    app.querySelector('[data-start-assessment]')?.addEventListener('click', () => {
      learningQuestionPage(bank, state.theme, 'assessment', 'logic-checkpoint', 'Logic checkpoint', practiceApi.selectAssessmentQuestions(bank));
    });
    if (page === 'flashcards') {
      let index = 0;
      let revealed = false;
      const reviewedCardIds = new Set();
      const container = app.querySelector('[data-flashcards-content]');
      const update = (focusSelector) => {
        container.innerHTML = views.practice.flashcardsView(bank, index, revealed);
        bind();
        if (focusSelector) container.querySelector(focusSelector)?.focus();
      };
      const bind = () => {
        container.querySelector('[data-flashcard-reveal]')?.addEventListener('click', () => {
          const wasRevealed = revealed;
          revealed = !revealed;
          if (!wasRevealed) {
            const id = container.querySelector('.flashcard-panel')?.dataset.flashcardId;
            recordDashboardEvent({
              type: 'flashcard-revealed',
              id
            }, 'Could not save local dashboard flashcard activity.');
            if (id && !reviewedCardIds.has(id)) {
              reviewedCardIds.add(id);
              void recordLearnerActivity({
                type: 'flashcard-reviewed',
                dedupeKey: `flashcard:${studySessionId}:${id}`,
                data: { cardId: id, deckId: 'logic', sessionId: studySessionId }
              }, 'Could not record the flashcard review.');
            }
          }
          update('[data-flashcard-reveal]');
        });
        container.querySelector('[data-flashcard-previous]')?.addEventListener('click', () => {
          index -= 1;
          revealed = false;
          update('[data-flashcard-heading]');
        });
        container.querySelector('[data-flashcard-next]')?.addEventListener('click', () => {
          index += 1;
          revealed = false;
          update('[data-flashcard-heading]');
        });
      };
      bind();
    }
  } catch (error) {
    console.error('Could not render page.', error);
    const heading = page === 'quizzes' ? 'Quiz content could not load.' : `${page[0].toUpperCase()}${page.slice(1)} could not load.`;
    renderShell(`<section class="empty clay" aria-labelledby="page-load-error"><h2 id="page-load-error">${escape(heading)}</h2><p>Your study data could not be loaded. Check your connection and try again.</p><button class="button button-primary" type="button" data-retry-render>Try again</button></section>`, document.documentElement.dataset.theme || initialTheme);
    app.setAttribute('aria-busy', 'false');
    app.querySelector('[data-retry-render]')?.addEventListener('click', render);
  }
}
render();
