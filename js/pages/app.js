import { getState, saveState, touchStreak, completeLesson } from '../core/state.js';
import { initTheme, toggleTheme } from '../core/theme.js';
import { shell } from '../components/shell.js';
import { pageUrl } from '../core/router.js';
import { getCurrentUser, getLeaderboard, getQuizAttempts, initialiseAuth, recordQuizAttempt, signOut } from '../core/auth.js';
import { loadPageData } from '../core/page-data.mjs';
import { validateNickname } from '../core/auth-validation.mjs';
import { renderPageSkeleton } from '../components/loading.js';

let scoreQuiz;
let selectMixedQuestions;
const base = location.pathname.includes('/pages/') ? '../' : '';
const load = async (path) => { const response = await fetch(base + path); if (!response.ok) throw new Error(`Could not load ${path}`); return response.json(); };
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const app = document.querySelector('#app');
const page = document.body.dataset.page;

async function loadPageViews(pageName) {
  const [learning, student, practice, quiz] = await Promise.all([
    ['dashboard', 'courses', 'lessons'].includes(pageName) ? import('./learning-views.js') : null,
    ['profile', 'progress'].includes(pageName) ? import('./student-views.js') : null,
    ['practice', 'assessments', 'flashcards'].includes(pageName) ? import('./practice-views.js') : null,
    pageName === 'quizzes' ? import('../core/quiz.mjs') : null
  ]);
  return { learning, student, practice, quiz };
}

function closeMobileMore(restoreFocus = false) {
  const button = app.querySelector('[data-mobile-more-toggle]');
  const menu = app.querySelector('#mobile-more-menu');
  if (!button || !menu) return;
  button.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
  if (restoreFocus) button.focus();
}

app.addEventListener('click', (event) => {
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
  if (event.key === 'Escape' && app.querySelector('[data-mobile-more-toggle][aria-expanded="true"]')) {
    closeMobileMore(true);
  }
});
document.addEventListener('click', (event) => {
  if (!app.contains(event.target)) closeMobileMore();
});

function quizLobby(topics, bank, attempts, historyError) {
  const cards = bank.quizzes.map((quiz) => {
    const latest = attempts.find((attempt) => attempt.mode === quiz.id);
    return `<article class="quiz-card clay"><p class="tag">Logic · 5 questions</p><h2>${escape(quiz.title)}</h2><p>Practice the ideas from this lesson and see an explanation after each answer.</p>${latest ? `<p class="quiz-last-score">Latest: <strong class="num">${latest.score} / ${latest.total}</strong></p>` : '<p class="quiz-last-score">No attempts yet</p>'}<button class="button button-primary" type="button" data-start-quiz="${escape(quiz.id)}">Start quiz</button></article>`;
  }).join('');
  const history = attempts.length ? `<ol class="quiz-history-list">${attempts.map((attempt) => {
    const title = attempt.mode === 'mixed-review' ? 'Mixed Logic review' : bank.quizzes.find((quiz) => quiz.id === attempt.mode)?.title || 'Logic practice';
    const date = new Date(attempt.taken_at);
    const takenAt = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
    return `<li><span><strong>${escape(title)}</strong><small>${escape(takenAt)}</small></span><strong class="num">${attempt.score} / ${attempt.total}</strong></li>`;
  }).join('')}</ol>` : '<p>No attempts yet. Complete a quiz to build your history.</p>';
  const unavailable = topics.filter((topic) => topic.id !== bank.topicId).map((topic) => `<article class="quiz-unavailable-card"><h3>${escape(topic.title)}</h3><span class="tag">Not available yet</span></article>`).join('');
  return `<section class="quiz-intro clay"><p class="tag">Low-stakes practice · no XP</p><h1 id="quiz-page-heading" tabindex="-1">Check your understanding.</h1><p>Build confidence with the Logic lessons that are ready now. Answer one question at a time, learn from each explanation, and retry anything you missed.</p></section><section class="quiz-section" aria-labelledby="available-quizzes-heading"><div class="section-heading"><div><h2 id="available-quizzes-heading">Available quizzes</h2><p>Untimed practice. Your quiz scores do not affect your level or lesson progress.</p></div></div><div class="quiz-grid">${cards}<article class="quiz-card quiz-card-mixed clay"><p class="tag">All Logic lessons</p><h2>Mixed Logic review</h2><p>Try five questions sampled from the available Logic lessons.</p><p class="quiz-last-score">Questions are mixed for each attempt.</p><button class="button button-primary" type="button" data-start-quiz="mixed-review">Start mixed review</button></article></div></section><section class="quiz-history clay" aria-labelledby="quiz-history-heading"><div class="section-heading"><div><h2 id="quiz-history-heading">Recent attempts</h2><p>Latest 20 attempts on this device or signed-in account.</p></div></div>${historyError ? `<p class="quiz-error" role="alert">${escape(historyError)}</p>` : history}</section><section class="quiz-section" aria-labelledby="more-quizzes-heading"><div class="section-heading"><div><h2 id="more-quizzes-heading">More topics</h2><p>These quizzes will appear when lesson content and questions are ready.</p></div></div><div class="quiz-unavailable-grid">${unavailable}</div></section>`;
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
    questions,
    answers:Array(questions.length).fill(null),
    index:0,
    checked:false,
    phase:'question',
    result:null
  };
  let currentTheme = theme;

  function render(focusSelector) {
    let content;
    if (session.phase === 'results') {
      content = kind === 'assessment' ? assessmentResultsView(session) : practiceResultsView(session);
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

    app.innerHTML = shell(page, content, currentTheme);
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
      session.result = scoreQuiz(session.questions, session.answers);
      session.phase = 'results';
      render('#' + (kind === 'assessment' ? 'assessment-results-heading' : 'practice-results-heading'));
    });
    app.querySelector('[data-restart-learning]')?.addEventListener('click', () => {
      if (session.mode === 'mixed-review') {
        session.questions = selectPracticeQuestions(bank, session.mode);
      }
      session.answers = Array(session.questions.length).fill(null);
      session.index = 0;
      session.checked = false;
      session.phase = 'question';
      session.result = null;
      render('[data-learning-answer]');
    });
    app.querySelector('[data-restart-assessment]')?.addEventListener('click', () => {
      session.questions = selectAssessmentQuestions(bank);
      session.answers = Array(session.questions.length).fill(null);
      session.index = 0;
      session.phase = 'question';
      session.result = null;
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
      questions,
      answers: Array(questions.length).fill(null),
      index: 0,
      checked: false,
      phase: 'question',
      saving: false,
      saveStarted: false,
      saveError: '',
      result: null
    };
    render('[data-quiz-answer]');
  }

  function render(focusSelector) {
    const content = session ? session.phase === 'results' ? quizResultsView(session) : quizQuestionView(session) : quizLobby(topics, bank, attempts, historyError);
    app.innerHTML = shell(page, content, currentTheme);
    app.setAttribute('aria-busy', 'false');
    app.querySelector('[data-theme-toggle]')?.addEventListener('click', async () => {
      currentTheme = (await toggleTheme()).theme;
      render();
    });
    app.querySelectorAll('[data-start-quiz]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.startQuiz;
        if (mode === 'mixed-review') {
          start(mode, 'Mixed Logic review', selectMixedQuestions(bank.quizzes.flatMap((quiz) => quiz.questions), 5));
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
      session.result = scoreQuiz(session.questions, session.answers);
      session.phase = 'results';
      session.saving = true;
      session.saveStarted = true;
      render('#quiz-results-title');
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
function dashboardExtras(user, leaderboard, leaderboardError = '') {
  const account = user
    ? `<article class="streak clay"><p class="tag">Synced account</p><h2>${escape(user.email)}</h2><p>Your progress is stored securely in your FVC study profile.</p><button class="button button-secondary" data-logout>Log out</button><p class="form-error dashboard-account-status" data-account-status role="alert" hidden></p></article>`
    : `<article class="streak clay"><p class="tag">Guest mode</p><h2>Keep your progress safe.</h2><p>Sign in to sync completed lessons across your devices.</p><a class="button button-primary" href="${pageUrl('login')}">Log in or sign up</a></article>`;
  const board = leaderboardError
    ? `<p class="quiz-error" role="alert">${escape(leaderboardError)}</p>`
    : leaderboard.length
      ? `<ol class="leaderboard-list">${leaderboard.map((entry, index) => `<li><span><strong class="num">${index + 1}</strong> ${escape(entry.nickname)}</span><strong class="num">${entry.xp} XP</strong></li>`).join('')}</ol>`
      : '<p class="leaderboard-empty">The leaderboard will appear after Supabase is configured.</p>';
  return `<section class="dashboard-grid dashboard-bottom"><div class="leaderboard clay"><div class="section-heading"><h2>Top learners</h2><span class="tag">Top 50</span></div>${board}</div><aside>${account}</aside></section>`;
}
function showLevelUp(level) { const overlay = document.createElement('div'); overlay.className = 'level-up'; overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="level-title"><p class="tag">New milestone</p><h2 id="level-title">Level ${level} unlocked!</h2><p>Your steady work earned a new level.</p><button class="button button-secondary" data-close-level>Keep learning</button></div>`; document.body.append(overlay); overlay.querySelector('button').focus(); overlay.addEventListener('click',(event) => { if (event.target === overlay || event.target.matches('[data-close-level]')) overlay.remove(); }); }
async function render() {
  const initialTheme = document.documentElement.dataset.theme || 'light';
  app.innerHTML = shell(page, renderPageSkeleton(page), initialTheme);
  app.setAttribute('aria-busy', 'true');
  try {
    await initialiseAuth();
    await initTheme();
    const state = await touchStreak();
    const [data, views] = await Promise.all([
      loadPageData(page, load),
      loadPageViews(page)
    ]);
    const { topics, lessons: logic, bank } = data;
    if (views.quiz) {
      scoreQuiz = views.quiz.scoreQuiz;
      selectMixedQuestions = views.quiz.selectMixedQuestions;
    }
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
      content = views.learning.dashboardView(topics, logic.lessons, state, attempts, attemptsError);
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
    if (page === 'dashboard') {
      let leaderboard = [];
      let leaderboardError = '';
      try {
        leaderboard = await getLeaderboard();
      } catch (error) {
        console.error('Could not load the leaderboard.', error);
        leaderboardError = 'The leaderboard could not be loaded. Please try again later.';
      }
      content += dashboardExtras(getCurrentUser(), leaderboard, leaderboardError);
    }
    app.innerHTML = shell(page,content,state.theme);
    app.setAttribute('aria-busy','false');
    app.querySelector('[data-theme-toggle]')?.addEventListener('click', async () => {
      await toggleTheme();
      render();
    });
    app.querySelector('[data-reveal]')?.addEventListener('click', (event) => {
      const answer = document.querySelector(`#answer-${event.currentTarget.dataset.reveal}`);
      answer.hidden = !answer.hidden;
      event.currentTarget.textContent = answer.hidden ? 'Reveal answer' : 'Hide answer';
    });
    app.querySelector('[data-complete]')?.addEventListener('click', async (event) => {
      const lesson = logic.lessons.find((item) => item.id === event.currentTarget.dataset.complete);
      try {
        const result = await completeLesson(lesson.id, lesson.xp);
        if (result.awarded) {
          event.currentTarget.disabled = true;
          event.currentTarget.textContent = 'Completed ✓';
          event.currentTarget.className = 'button button-secondary';
          if (result.leveledUp) showLevelUp(result.state.level);
        }
      } catch {
        event.currentTarget.textContent = 'Could not save. Try again.';
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
      try {
        const current = await getState();
        const nickname = input.value.trim();
        await saveState({ ...current, nickname });
        app.querySelector('.profile-summary h2').textContent = nickname;
        app.querySelector('.profile-avatar').textContent = nickname.charAt(0).toUpperCase();
        input.value = nickname;
        status.hidden = false;
        status.textContent = 'Nickname saved.';
      } catch (error) {
        console.error('Could not save profile nickname.', error);
        status.hidden = false;
        status.setAttribute('role', 'alert');
        status.textContent = 'Could not save your nickname. Please try again.';
      }
    });
    app.querySelectorAll('[data-start-practice]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.startPractice;
        const questions = selectPracticeQuestions(bank, mode);
        const title = mode === 'mixed-review'
          ? 'Mixed Logic practice'
          : bank.quizzes.find((quiz) => quiz.id === mode).title;
        learningQuestionPage(bank, state.theme, 'practice', mode, title, questions);
      });
    });
    app.querySelector('[data-start-assessment]')?.addEventListener('click', () => {
      learningQuestionPage(bank, state.theme, 'assessment', 'logic-checkpoint', 'Logic checkpoint', selectAssessmentQuestions(bank));
    });
    if (page === 'flashcards') {
      let index = 0;
      let revealed = false;
      const container = app.querySelector('[data-flashcards-content]');
      const update = (focusSelector) => {
        container.innerHTML = views.practice.flashcardsView(bank, index, revealed);
        bind();
        if (focusSelector) container.querySelector(focusSelector)?.focus();
      };
      const bind = () => {
        container.querySelector('[data-flashcard-reveal]')?.addEventListener('click', () => {
          revealed = !revealed;
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
    app.innerHTML = shell(page, `<section class="empty clay" aria-labelledby="page-load-error"><h2 id="page-load-error">${escape(heading)}</h2><p>Your study data could not be loaded. Check your connection and try again.</p><button class="button button-primary" type="button" data-retry-render>Try again</button></section>`, document.documentElement.dataset.theme || initialTheme);
    app.setAttribute('aria-busy', 'false');
    app.querySelector('[data-retry-render]')?.addEventListener('click', render);
  }
}
render();
