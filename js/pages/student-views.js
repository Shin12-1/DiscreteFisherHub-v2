import { getTopicProgress } from '../core/learning.mjs';
import { lessonUrl, pageUrl } from '../core/router.js';
import { escapeHtml as escape } from '../core/html.mjs';
import { normalizeProfilePreferences } from '../core/profile-preferences.mjs';



function progressBar(label, { completed, total, percent }) {
  return `<div class="learning-progress"><div class="learning-progress-copy"><span>${escape(label)}</span><strong>${completed} of ${total} lessons · ${percent}%</strong></div><div class="progress" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${percent}%"></span></div></div>`;
}

function profileSelect(id, name, label, options, selectedValue) {
  const choices = options.map(([value, text]) => `<option value="${escape(value)}"${value === selectedValue ? ' selected' : ''}>${escape(text)}</option>`).join('');
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${name}">${choices}</select></div>`;
}

function profileToggle(id, name, label, checked) {
  return `<label class="profile-toggle"><span>${label}</span><input id="${id}" name="${name}" type="checkbox" ${checked ? 'checked' : ''}></label>`;
}

function visibilitySettingsView(settings, blockedProfiles, error, blockedProfilesError) {
  if (error) return `<section class="profile-account clay" id="profile-visibility" data-profile-visibility><h2>Public profile and privacy</h2><p class="form-error" role="alert">${escape(error)}</p></section>`;
  if (!settings) return `<section class="profile-account clay" id="profile-visibility" data-profile-visibility><h2>Public profile and privacy</h2><p>Loading your privacy settings…</p></section>`;
  const visibilityOptions = [['private', 'Only me'], ['members', 'Signed-in learners'], ['public', 'Anyone with the link']];
  const sectionSelect = (key, label) => profileSelect(
    `profile-${key}-visibility`,
    `${key}Visibility`,
    label,
    visibilityOptions,
    settings[`${key}Visibility`]
  );
  const publicUrl = /^[a-f0-9]{32}$/i.test(settings.publicHandle || '')
    ? `${pageUrl('public-profile')}?handle=${encodeURIComponent(settings.publicHandle)}`
    : '';
  const profileLink = publicUrl
    ? `<a data-public-profile-url href="${escape(publicUrl)}">${escape(publicUrl)}</a>`
    : '<p class="form-error" role="alert">Your profile link is not available yet.</p>';
  const blockedMarkup = blockedProfilesError
    ? `<p class="form-error" role="alert">${escape(blockedProfilesError)}</p>`
    : blockedProfiles.length
    ? `<ul class="blocked-profile-list">${blockedProfiles.map(({ handle, nickname }) => `<li><span>${escape(nickname)}</span><button class="button button-secondary" type="button" data-unblock-profile="${escape(handle)}">Unblock</button></li>`).join('')}</ul>`
    : '<p>No profiles blocked.</p>';
  return `<section class="profile-account clay" id="profile-visibility" data-profile-visibility>
    <h2>Public profile and privacy</h2>
    <p>Your profile is private by default. Choose what signed-in learners or anyone with your link can see.</p>
    <form class="profile-visibility-form" data-profile-visibility-form>
      <div class="profile-field-grid">
        ${profileSelect('profile-access', 'profileVisibility', 'Who can open your profile?', visibilityOptions, settings.profileVisibility)}
      </div>
      <div class="profile-toggle-list">
        ${profileToggle('profile-search-opt-in', 'searchOptIn', 'Allow your profile in learner search', settings.searchOptIn)}
        ${profileToggle('profile-leaderboard-opt-in', 'leaderboardOptIn', 'Show my nickname and XP on the leaderboard', settings.leaderboardOptIn)}
      </div>
      <h3>Profile sections</h3>
      <div class="profile-field-grid">
        ${sectionSelect('studyTime', 'Study time')}
        ${sectionSelect('fastestTimes', 'Fastest times')}
        ${sectionSelect('stats', 'Learning stats')}
        ${sectionSelect('badges', 'Pinned achievements')}
        ${sectionSelect('mastery', 'Topic mastery')}
        ${sectionSelect('activity', 'Recent milestones')}
      </div>
      <p class="profile-note">Sharing your profile does not make your email or account ID public.</p>
      <p data-profile-visibility-status class="form-message" role="status" hidden></p>
      <button class="button button-primary" type="submit">Save privacy settings</button>
    </form>
    <div class="profile-share-link"><h3>Your profile link</h3>${profileLink}</div>
    <div class="profile-blocked-list"><h3>Blocked profiles</h3>${blockedMarkup}</div>
  </section>`;
}

export function profileView(user, state, dashboard = null) {
  const signedIn = Boolean(user);
  const nickname = String(state?.nickname || 'Fisher learner');
  const dashboardMarkup = !signedIn
    ? `<section class="profile-dashboard-message clay" data-profile-dashboard-guest><h2>Your learning dashboard</h2><p>${escape(nickname)}'s dashboard is available after signing in.</p><a class="button button-primary" href="../pages/login.html">Sign in to sync</a><a class="button button-secondary" href="edit-profile.html">Edit profile</a></section>`
    : dashboard?.error
      ? `<section class="profile-dashboard-message clay" data-profile-dashboard-error role="alert"><h2>Your learning dashboard</h2><p>${escape(dashboard.error)}</p><a class="button button-secondary" href="edit-profile.html">Edit profile</a></section>`
      : dashboard?.markup || '<section class="profile-dashboard-message clay" data-profile-dashboard-error role="alert"><h2>Your learning dashboard</h2><p>Your profile dashboard is unavailable.</p><a class="button button-secondary" href="edit-profile.html">Edit profile</a></section>';
  return `<div class="profile-page">
  <section class="learning-page-intro">
    <p class="tag">${signedIn ? 'Synced account' : 'Guest profile'}</p>
    <h1>Your study profile</h1>
    <p>A snapshot of your progress, achievements, and recent learning milestones.</p>
  </section>
  ${dashboardMarkup}
  </div>`;
}

export function editProfileView(user, state, visibilitySettings = null, blockedProfiles = [], profileSettingsError = '', blockedProfilesError = '') {
  const signedIn = Boolean(user);
  const nickname = String(state.nickname || 'Fisher learner');
  const preferences = normalizeProfilePreferences(state.profilePreferences);
  const theme = state.theme === 'dark' ? 'dark' : 'light';
  return `<div class="profile-page">
  <section class="learning-page-intro">
    <p class="tag">${signedIn ? 'Synced account' : 'Guest profile'}</p>
    <h1>Edit your profile</h1>
    <p>Manage your personal details, study preferences, account, and privacy.</p>
  </section>
  <section class="profile-layout">
    <article class="profile-summary clay">
      <div class="profile-id">
        <div class="profile-avatar" aria-hidden="true">${escape(nickname.trim().charAt(0).toUpperCase() || 'F')}</div>
        <div>
          <h2>${escape(nickname)}</h2>
          <p>${signedIn ? escape(user.email) : 'Guest learner · this device'}</p>
          <span class="tag">${signedIn ? 'Progress sync enabled' : 'Saved on this device'}</span>
        </div>
      </div>
    </article>
    <form class="profile-editor clay" data-profile-form novalidate>
      <div class="profile-editor-heading">
        <p class="tag">Profile preferences</p>
        <h2>Make this study space yours</h2>
        <p>${signedIn ? 'Your nickname syncs to your private account; study preferences stay in this browser.' : 'Your nickname and study preferences stay in this browser.'}</p>
      </div>
      <section class="profile-settings-group" id="profile-details" aria-labelledby="profile-details-heading">
        <h3 id="profile-details-heading">Personal details</h3>
        <div class="profile-field-grid">
          <div class="field profile-field-wide">
            <label for="profile-nickname">Nickname</label>
            <input id="profile-nickname" name="nickname" value="${escape(nickname)}" autocomplete="nickname" minlength="3" maxlength="32" aria-describedby="profile-nickname-help profile-nickname-error" required>
            <small id="profile-nickname-help">Use 3–32 letters, numbers, spaces, dots, hyphens, or underscores.</small>
            <p id="profile-nickname-error" class="field-error" hidden></p>
          </div>
          ${profileSelect('profile-program', 'program', 'Program', [
    ['', 'Not set'],
    ['BS Computer Science', 'BS Computer Science'],
    ['BS Information Technology', 'BS Information Technology']
  ], preferences.program)}
          ${profileSelect('profile-year-level', 'yearLevel', 'Year level', [
    ['', 'Not set'],
    ['1st year', '1st year'],
    ['2nd year', '2nd year'],
    ['3rd year', '3rd year'],
    ['4th year', '4th year']
  ], preferences.yearLevel)}
        </div>
      </section>
      <section class="profile-settings-group" aria-labelledby="profile-rhythm-heading">
        <h3 id="profile-rhythm-heading">Study rhythm</h3>
        <div class="profile-field-grid">
          ${profileSelect('profile-weekly-goal', 'weeklyGoal', 'Weekly study goal', [
    [2, '2 sessions'],
    [3, '3 sessions'],
    [4, '4 sessions'],
    [5, '5 sessions']
  ], preferences.weeklyGoal)}
          ${profileSelect('profile-session-length', 'sessionLength', 'Typical session length', [
    [15, '15 minutes'],
    [25, '25 minutes'],
    [40, '40 minutes'],
    [60, '60 minutes']
  ], preferences.sessionLength)}
          ${profileSelect('profile-preferred-time', 'preferredTime', 'Preferred study time', [
    ['morning', 'Morning'],
    ['afternoon', 'Afternoon'],
    ['evening', 'Evening'],
    ['flexible', 'No preference']
  ], preferences.preferredTime)}
          ${profileSelect('profile-lesson-style', 'lessonStyle', 'Lesson support', [
    ['worked-examples', 'Worked examples first'],
    ['definitions-first', 'Definitions first'],
    ['practice-first', 'Practice first']
  ], preferences.lessonStyle)}
        </div>
      </section>
      <section class="profile-settings-group" aria-labelledby="profile-display-heading">
        <h3 id="profile-display-heading">Reminders and display</h3>
        <div class="profile-field-grid">
          ${profileSelect('profile-theme', 'theme', 'Appearance', [['light', 'Light'], ['dark', 'Dark']], theme)}
        </div>
        <div class="profile-toggle-list">
          ${profileToggle('profile-study-reminders', 'studyReminders', 'Study reminders', preferences.studyReminders)}
          ${profileToggle('profile-assessment-updates', 'assessmentUpdates', 'Assessment updates', preferences.assessmentUpdates)}
          ${profileToggle('profile-reduce-motion', 'reduceMotion', 'Reduce motion', preferences.reduceMotion)}
        </div>
        <p class="profile-note">Reminder preferences are saved locally; no notifications are sent.</p>
      </section>
      <p data-profile-status class="form-message" role="status" hidden></p>
      <button class="button button-primary" type="submit">Save profile settings</button>
    </form>
  </section>
  <section class="profile-account clay">
    <h2>Account and privacy</h2>
    <p>${signedIn ? 'Your email is used to sign in. Course progress and quiz history are private to your account.' : 'You can study without an account. Sign in only if you want to sync your lesson progress across devices.'}</p>
    ${signedIn ? `<a class="button button-secondary" data-change-email href="${pageUrl('change-email')}">Change email address</a><a class="button button-secondary" data-reauthenticate href="${pageUrl('reauthenticate')}">Verify your identity</a><button class="button button-secondary" type="button" data-logout>Log out</button>` : `<a class="button button-primary" href="${pageUrl('login')}">Sign in to sync</a>`}
  </section>
  ${signedIn ? visibilitySettingsView(visibilitySettings, blockedProfiles, profileSettingsError, blockedProfilesError) : ''}
  </div>`;
}

export function progressView(topics, lessons, state, attempts) {
  const completedIds = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const lessonProgress = getTopicProgress({ lessonIds: lessons.map((lesson) => lesson.id) }, completedIds);
  const lessonRows = lessons.map((lesson, index) => {
    const completed = completedIds.includes(lesson.id);
    return `<li><a href="${lessonUrl(lesson.id)}"><span class="lesson-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escape(lesson.title)}</strong><small>${completed ? 'Completed' : 'Not completed yet'}</small></span><span class="tag">${completed ? 'Complete' : 'Ready'}</span></a></li>`;
  }).join('');
  const courseRow = (topic) => {
    const available = topic.id === 'logic';
    const progress = getTopicProgress(topic, completedIds);
    return `<article class="progress-topic clay"><div class="progress-topic-heading"><h3>${escape(topic.title)}</h3><span class="tag">${available ? `${progress.percent}%` : 'Coming soon'}</span></div>${available ? progressBar('Course completion', progress) : `<p>${escape(topic.scopeLabel)} · Lessons have not been published yet.</p>`}</article>`;
  };
  const logicCourseRows = topics.filter((topic) => topic.id === 'logic').map(courseRow).join('');
  const upcomingCourseRows = topics.filter((topic) => topic.id !== 'logic').map(courseRow).join('');
  const history = attempts === null
    ? '<p class="quiz-error" role="alert">Quiz history could not be loaded. Refresh this page to try again.</p>'
    : Array.isArray(attempts) && attempts.length
      ? `<ol class="progress-attempts">${attempts.slice(0, 10).map((attempt) => {
        const date = new Date(attempt.taken_at);
        const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
        return `<li><span>${escape(attempt.mode === 'mixed-review' ? 'Mixed Logic review' : attempt.mode.replace(/-/g, ' '))}</span><strong>${attempt.score} / ${attempt.total}</strong><time${Number.isNaN(date.getTime()) ? '' : ` datetime="${escape(attempt.taken_at)}"`}>${escape(dateLabel)}</time></li>`;
      }).join('')}</ol>`
      : '<p>No quiz attempts yet. Quiz scores are practice feedback, not course grades.</p>';

  return `<div class="progress-page">
    <section class="learning-page-intro"><p class="tag">Your learning record</p><h1>Progress you can understand.</h1><p>Lesson completion, XP, and practice are shown separately so you can see what each measure means.</p></section>
    <section class="progress-course-section" aria-labelledby="progress-course-heading">
      <div class="section-heading"><div><h2 id="progress-course-heading">Course progress</h2><p>${lessonProgress.completed} of ${lessonProgress.total} published Logic lessons complete.</p></div></div>
      <div class="progress-course-grid">${logicCourseRows}</div>
    </section>
    <section class="progress-detail-grid">
      <article class="learning-panel clay"><div class="section-heading"><div><h2>Logic lesson checklist</h2><p>Open any lesson to review it.</p></div></div><ol class="progress-lesson-list">${lessonRows}</ol></article>
      <div class="progress-supporting">
        <section class="progress-summary-grid" aria-label="Learning totals"><article class="progress-stat clay"><span>Experience points</span><strong class="num">${escape(state.xp)}</strong><p>Earned by completing lessons.</p></article><article class="progress-stat clay"><span>Current level</span><strong class="num">${escape(state.level)}</strong><p>Levels are based on lesson XP.</p></article><article class="progress-stat clay"><span>Study streak</span><strong class="num">${escape(state.streak)} day${state.streak === 1 ? '' : 's'}</strong><p>A visit streak, not a grade.</p></article></section>
        <article class="progress-history learning-panel clay"><div class="section-heading"><div><h2>Practice history</h2><p>Quiz scores do not change lesson progress or XP.</p></div><a href="${pageUrl('quizzes')}">Open quizzes</a></div>${history}</article>
      </div>
    </section>
    <section class="progress-upcoming-section" aria-labelledby="progress-upcoming-heading">
      <div class="section-heading"><div><h2 id="progress-upcoming-heading">More topics</h2><p>Lessons have not been published for these topics yet.</p></div></div>
      <div class="progress-course-grid">${upcomingCourseRows}</div>
    </section>
  </div>`;
}
