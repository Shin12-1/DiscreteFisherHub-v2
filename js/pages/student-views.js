import { getTopicProgress } from '../core/learning.mjs';
import { lessonUrl, pageUrl } from '../core/router.js';

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[char]));

function progressBar(label, { completed, total, percent }) {
  return `<div class="learning-progress"><div class="learning-progress-copy"><span>${escape(label)}</span><strong>${completed} of ${total} lessons · ${percent}%</strong></div><div class="progress" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${percent}%"></span></div></div>`;
}

export function profileView(user, state) {
  const signedIn = Boolean(user);
  const nickname = String(state.nickname || 'Fisher learner');
  return `<section class="learning-page-intro"><p class="tag">${signedIn ? 'Synced account' : 'Guest profile'}</p><h1>Your study profile</h1><p>Choose the name you want to see in your study space. Your learning progress remains private to this device or your signed-in account.</p></section><section class="profile-layout"><article class="profile-summary clay"><div class="profile-avatar" aria-hidden="true">${escape(nickname.trim().charAt(0).toUpperCase() || 'F')}</div><div><h2>${escape(nickname)}</h2><p>${signedIn ? escape(user.email) : 'Guest learner · this device'}</p><span class="tag">${signedIn ? 'Progress sync enabled' : 'Saved on this device'}</span></div></article><form class="profile-editor clay" data-profile-form novalidate><p class="tag">Personalize your study space</p><h2>Display name</h2><p>${signedIn ? 'Your name is saved to your private profile.' : 'Your name is saved only in this browser.'}</p><label for="profile-nickname">Nickname</label><input id="profile-nickname" name="nickname" value="${escape(nickname)}" autocomplete="nickname" minlength="3" maxlength="32" aria-describedby="profile-nickname-help profile-nickname-error" required><small id="profile-nickname-help">Use 3–32 letters, numbers, spaces, dots, hyphens, or underscores.</small><p id="profile-nickname-error" class="field-error" hidden></p><p data-profile-status class="form-message" role="status" hidden></p><button class="button button-primary" type="submit">Save nickname</button></form></section><section class="profile-account clay"><h2>Account and privacy</h2><p>${signedIn ? 'Your email is used to sign in. Course progress and quiz history are private to your account.' : 'You can study without an account. Sign in only if you want to sync your lesson progress across devices.'}</p>${signedIn ? '<button class="button button-secondary" type="button" data-logout>Log out</button>' : `<a class="button button-primary" href="${pageUrl('login')}">Sign in to sync</a>`}</section>`;
}

export function progressView(topics, lessons, state, attempts) {
  const completedIds = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const lessonProgress = getTopicProgress({ lessonIds: lessons.map((lesson) => lesson.id) }, completedIds);
  const lessonRows = lessons.map((lesson, index) => {
    const completed = completedIds.includes(lesson.id);
    return `<li><a href="${lessonUrl(lesson.id)}"><span class="lesson-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escape(lesson.title)}</strong><small>${completed ? 'Completed' : 'Not completed yet'}</small></span><span class="tag">${completed ? 'Complete' : 'Ready'}</span></a></li>`;
  }).join('');
  const courseRows = topics.map((topic) => {
    const available = topic.id === 'logic';
    const progress = getTopicProgress(topic, completedIds);
    return `<article class="progress-topic clay"><div class="progress-topic-heading"><h3>${escape(topic.title)}</h3><span class="tag">${available ? `${progress.percent}%` : 'Coming soon'}</span></div>${available ? progressBar('Course completion', progress) : `<p>${escape(topic.scopeLabel)} · Lessons have not been published yet.</p>`}</article>`;
  }).join('');
  const history = attempts === null
    ? '<p class="quiz-error" role="alert">Quiz history could not be loaded. Refresh this page to try again.</p>'
    : Array.isArray(attempts) && attempts.length
      ? `<ol class="progress-attempts">${attempts.slice(0, 10).map((attempt) => {
        const date = new Date(attempt.taken_at);
        const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
        return `<li><span>${escape(attempt.mode === 'mixed-review' ? 'Mixed Logic review' : attempt.mode.replace(/-/g, ' '))}</span><strong>${attempt.score} / ${attempt.total}</strong><time${Number.isNaN(date.getTime()) ? '' : ` datetime="${escape(attempt.taken_at)}"`}>${escape(dateLabel)}</time></li>`;
      }).join('')}</ol>`
      : '<p>No quiz attempts yet. Quiz scores are practice feedback, not course grades.</p>';

  return `<section class="learning-page-intro"><p class="tag">Your learning record</p><h1>Progress you can understand.</h1><p>Lesson completion, XP, and practice are shown separately so you can see what each measure means.</p></section><section class="progress-summary-grid" aria-label="Learning totals"><article class="progress-stat clay"><span>Experience points</span><strong class="num">${escape(state.xp)}</strong><p>Earned by completing lessons.</p></article><article class="progress-stat clay"><span>Current level</span><strong class="num">${escape(state.level)}</strong><p>Levels are based on lesson XP.</p></article><article class="progress-stat clay"><span>Study streak</span><strong class="num">${escape(state.streak)} day${state.streak === 1 ? '' : 's'}</strong><p>A visit streak, not a grade.</p></article></section><section class="progress-course-section" aria-labelledby="progress-course-heading"><div class="section-heading"><div><h2 id="progress-course-heading">Course progress</h2><p>${lessonProgress.completed} of ${lessonProgress.total} published Logic lessons complete.</p></div></div><div class="progress-course-grid">${courseRows}</div></section><section class="progress-detail-grid"><article class="learning-panel clay"><div class="section-heading"><div><h2>Logic lesson checklist</h2><p>Open any lesson to review it.</p></div></div><ol class="progress-lesson-list">${lessonRows}</ol></article><article class="learning-panel clay"><div class="section-heading"><div><h2>Practice history</h2><p>Quiz scores do not change lesson progress or XP.</p></div><a href="${pageUrl('quizzes')}">Open quizzes</a></div>${history}</article></section>`;
}
