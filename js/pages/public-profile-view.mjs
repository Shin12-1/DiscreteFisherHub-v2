import { escapeHtml as escape } from '../core/html.mjs';
import { pageUrl } from '../core/router.js';

function formatDuration(seconds, study = false) {
  if (!Number.isInteger(seconds) || seconds < 0) return '—';
  if (study) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  const total = Math.floor(seconds);
  if (total >= 3600) return `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function topicMastery(mastery, topics = []) {
  if (Array.isArray(mastery)) return mastery.slice(0, 5);
  const completed = new Set(Array.isArray(mastery?.completedLessonIds) ? mastery.completedLessonIds : []);
  return topics
    .filter(({ lessonIds }) => Array.isArray(lessonIds) && lessonIds.length)
    .map((topic) => {
      const count = topic.lessonIds.filter((id) => completed.has(id)).length;
      return {
        topicId: topic.id,
        title: topic.title,
        completed: count,
        total: topic.lessonIds.length,
        percent: Math.round(count / topic.lessonIds.length * 100)
      };
    })
    .sort((left, right) => right.percent - left.percent || left.title.localeCompare(right.title))
    .slice(0, 5);
}

function itemTitle(item, lessons, quizzes) {
  if (item.title) return item.title;
  if (item.type === 'lesson') return lessons.find(({ id }) => id === item.activityId)?.title || 'Lesson';
  if (item.type === 'quiz') return quizzes.find(({ id }) => id === item.activityId)?.title || 'Quiz';
  return 'Checkpoint';
}

function fastestTimes(items, lessons, quizzes) {
  if (!Array.isArray(items) || !items.length) return '<p class="profile-empty">No completed timed activities yet.</p>';
  return `<ul class="profile-fastest-list">${items.map((item) => {
    const score = Number.isInteger(item.score) && Number.isInteger(item.total)
      ? `<span>${item.score}/${item.total}</span>`
      : '';
    return `<li><span>${escape(itemTitle(item, lessons, quizzes))} ${escape(item.type)}</span><strong>${formatDuration(item.durationSeconds)}</strong>${score}</li>`;
  }).join('')}</ul>`;
}

function section(title, key, content) {
  return `<section class="public-profile-section clay" data-profile-${key}><h2>${title}</h2>${content}</section>`;
}

function sectionMarkup(profile, topics, lessons, quizzes, isOwner, achievementTotal) {
  const data = profile.sections;
  let output = '';
  if (data.studyTime) {
    const time = data.studyTime;
    output += section('Student time', 'study-time', `<dl class="profile-time-stats"><div><dt>Total study time</dt><dd>${formatDuration(time.totalSeconds, true)}</dd></div><div><dt>This week</dt><dd>${formatDuration(time.thisWeekSeconds, true)}</dd></div><div><dt>Average per day</dt><dd>${formatDuration(time.averageSecondsPerDay, true)}</dd></div></dl>`);
  }
  if (data.fastestTimes) output += section('Fastest times', 'fastest-times', fastestTimes(data.fastestTimes.items, lessons, quizzes));
  if (data.stats) {
    const stats = data.stats;
    output += section('Learning stats', 'stats', `<dl class="profile-stat-list"><div><dt>XP</dt><dd>${escape(stats.xp)}</dd></div><div><dt>Streak</dt><dd>${escape(stats.streak)} days</dd></div><div><dt>Lessons completed</dt><dd>${escape(stats.lessonsCompleted)}</dd></div><div><dt>Quizzes taken</dt><dd>${escape(stats.quizzesTaken)}</dd></div></dl>`);
  }
  if (data.badges) {
    const badges = Array.isArray(data.badges.pinned) ? data.badges.pinned.slice(0, 3) : [];
    const cards = badges.length
      ? `<ul class="profile-badge-list">${badges.map(({ id, title }) => `<li data-badge="${escape(id)}"><span class="profile-badge-mark" aria-hidden="true">${escape(title.slice(0, 1))}</span><strong>${escape(title)}</strong></li>`).join('')}</ul>`
      : '<p class="profile-empty">No badges pinned yet.</p>';
    const changePinned = isOwner
      ? `<a class="profile-pinned-edit" data-profile-pinned-badges href="${escape(pageUrl('achievements'))}">Change pinned badges</a>`
      : '';
    const earnedCount = Number.isInteger(achievementTotal)
      ? `${data.badges.earnedCount} of ${achievementTotal}`
      : `${data.badges.earnedCount} earned`;
    output += section('Pinned achievements', 'badges', `${changePinned}${cards}<p class="profile-earned-count">${escape(earnedCount)}</p>`);
  }
  if (data.mastery) {
    const topicsList = topicMastery(data.mastery, topics);
    const bars = topicsList.length
      ? `<ul class="profile-mastery-list">${topicsList.map((topic) => `<li><div><span>${escape(topic.title)}</span><strong>${topic.completed}/${topic.total}</strong></div><div class="progress" role="progressbar" aria-label="${escape(topic.title)} mastery" aria-valuemin="0" aria-valuemax="${topic.total}" aria-valuenow="${topic.completed}"><span style="width:${topic.percent}%"></span></div></li>`).join('')}</ul>`
      : '<p class="profile-empty">Topic mastery will appear as lessons are published.</p>';
    output += section('Strongest topics', 'mastery', bars);
  }
  if (data.activity) {
    const events = Array.isArray(data.activity) ? data.activity.slice(0, 5) : [];
    const rows = events.map((event) => {
      let label = event.label;
      if (!label && event.type === 'lesson-completed') {
        label = `Finished ${lessons.find(({ id }) => id === event.activityId)?.title || 'a lesson'}`;
      } else if (!label && event.type === 'checkpoint-completed') {
        label = 'Finished a checkpoint';
      }
      if (!label) return '';
      return `<li><span>${escape(label)}</span><time datetime="${escape(event.occurredAt)}">${escape(dateLabel(event.occurredAt))}</time></li>`;
    }).filter(Boolean).join('');
    output += section('Recent milestones', 'activity', rows
      ? `<ol class="profile-activity-list">${rows}</ol>`
      : '<p class="profile-empty">Milestones will appear here as you learn.</p>');
  }
  return output;
}

function ownerActions(handle, shareAllowed, targets = {}) {
  const visitorUrl = `public-profile.html?handle=${encodeURIComponent(handle)}&preview=visitor`;
  const editUrl = targets.edit || 'profile.html';
  const visibilityUrl = targets.visibility || 'profile.html#profile-visibility';
  const shareButton = shareAllowed
    ? '<button class="button button-primary" type="button" data-profile-share>Share profile</button>'
    : '<button class="button button-primary" type="button" data-profile-share disabled aria-label="Profile is private; sharing is off">Profile is private</button>';
  return `<nav class="profile-owner-actions" data-owner-controls aria-label="Profile owner controls">
    <a class="button button-primary" href="${escape(editUrl)}">Edit profile</a>
    ${shareButton}
    <a class="button button-secondary" href="${visitorUrl}" data-profile-preview>Preview as visitor</a>
    <a class="button button-secondary" href="${escape(visibilityUrl)}" data-profile-visibility>Manage visibility</a>
  </nav>`;
}

function visitorActions() {
  return `<div class="profile-visitor-actions">
    <button class="button button-primary" type="button" data-profile-share>Share profile</button>
    <button class="button button-secondary" type="button" data-profile-block>Block profile</button>
    <button class="button button-secondary" type="button" data-profile-report>Report profile</button>
  </div>
  <form class="profile-report-form clay" data-profile-report-form hidden>
    <label for="profile-report-reason">Why are you reporting this profile?</label>
    <select id="profile-report-reason" name="reason">
      <option value="privacy">Privacy concern</option>
      <option value="impersonation">Impersonation</option>
      <option value="harassment">Harassment</option>
      <option value="other">Other</option>
    </select>
    <button class="button button-primary" type="submit">Submit report</button>
    <p class="form-message" data-profile-action-status role="status" hidden></p>
  </form>`;
}

export function renderPublicProfileView({
  profile,
  isOwner = false,
  shareAllowed = true,
  topics = [],
  lessons = [],
  quizzes = [],
  ownerActionTargets = null,
  headingLevel = 'h1',
  achievementTotal
} = {}) {
  if (!profile || typeof profile.nickname !== 'string') throw new TypeError('A public profile is required.');
  const nickname = profile.nickname.trim() || 'Fisher learner';
  const initials = nickname.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const avatarTier = Math.min(5, Math.floor((profile.level - 1) / 5) + 1);
  const identityHeading = headingLevel === 'h2' ? 'h2' : 'h1';
  const ownerActionsMarkup = isOwner ? ownerActions(profile.handle, shareAllowed, ownerActionTargets || {}) : visitorActions();
  const embeddedOwner = isOwner && ownerActionTargets;
  const content = `<div class="public-profile-page${embeddedOwner ? ' profile-owner-dashboard' : ''}">
    <header class="public-profile-header clay">
      <div class="public-profile-identity">
        <div class="profile-avatar profile-avatar-tier-${avatarTier}" aria-hidden="true">${escape(initials)}</div>
        <div><p class="tag">Learner profile · Level ${escape(profile.level)}</p><${identityHeading}>${escape(nickname)}</${identityHeading}>${profile.title ? `<p class="profile-title">${escape(profile.title)}</p>` : ''}<p class="profile-member-since">Member since ${escape(dateLabel(profile.memberSince))}</p></div>
      </div>
      ${ownerActionsMarkup}
      <p class="form-message" data-profile-action-status role="status" hidden></p>
    </header>
    <div class="public-profile-sections">${sectionMarkup(profile, topics, lessons, quizzes, isOwner, achievementTotal)}</div>
  </div>`;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = content;
  return wrapper.firstElementChild;
}
