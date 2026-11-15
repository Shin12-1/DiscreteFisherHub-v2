import { presentAchievement } from '../core/achievements.mjs';
import { escapeHtml as escape } from '../core/html.mjs';

function achievementCard(achievement, earned, unlock, progress, pinned) {
  const presentation = presentAchievement(achievement, earned);
  const earnedDate = unlock ? new Date(unlock.unlockedAt) : null;
  const date = earnedDate && Number.isFinite(earnedDate.getTime())
    ? `<time datetime="${escape(unlock.unlockedAt)}">${escape(earnedDate.toLocaleDateString())}</time>`
    : '';
  const current = progress && Number.isFinite(progress.current) ? progress.current : 0;
  const target = progress && Number.isFinite(progress.target) ? progress.target : null;
  const progressMarkup = !earned && !achievement.hidden && target !== null
    ? `<p>${escape(current)} of ${escape(target)} complete</p><div class="progress" role="progressbar" aria-label="${escape(presentation.title)} progress" aria-valuemin="0" aria-valuemax="${escape(target)}" aria-valuenow="${escape(Math.min(current, target))}"><span style="width:${target ? Math.min(100, current / target * 100) : 0}%"></span></div>`
    : '';
  const pin = earned && !achievement.hidden
    ? `<button class="button button-secondary" type="button" data-pin-badge="${escape(achievement.id)}" aria-pressed="${pinned ? 'true' : 'false'}">${pinned ? 'Unpin badge' : 'Pin badge'}</button>`
    : '';
  return `<article class="achievement-card clay ${earned ? 'achievement-earned' : 'achievement-locked'}" data-achievement="${escape(achievement.id)}">
    <span class="achievement-mark" aria-hidden="true">${earned ? '✓' : '·'}</span>
    <div><p class="tag">${earned ? 'Unlocked' : 'In progress'}</p><h3>${escape(presentation.title)}</h3>${presentation.description ? `<p>${escape(presentation.description)}</p>` : ''}${date}${progressMarkup}</div>
    ${pin}
  </article>`;
}

export function renderAchievementsView({
  catalog,
  unlocks = [],
  progress = {},
  weeklyChallenge = null,
  pinnedBadgeIds = [],
  titleId = null
} = {}) {
  if (!Array.isArray(catalog?.achievements) || !Array.isArray(unlocks) || !Array.isArray(pinnedBadgeIds)) {
    throw new TypeError('Achievement catalog, unlocks, and pinned badges are required.');
  }
  const latestUnlock = new Map();
  for (const unlock of unlocks) {
    const current = latestUnlock.get(unlock.achievementId);
    if (!current || Date.parse(unlock.unlockedAt) > Date.parse(current.unlockedAt)) {
      latestUnlock.set(unlock.achievementId, unlock);
    }
  }
  const earnedCount = unlocks.length;
  const rewardChoices = catalog.achievements
    .filter((achievement) => achievement.rewards?.title && latestUnlock.has(achievement.id))
    .map((achievement) => `<option value="${escape(achievement.id)}"${titleId === achievement.id ? ' selected' : ''}>${escape(achievement.rewards.title)}</option>`)
    .join('');
  const cards = catalog.achievements.map((achievement) => achievementCard(
    achievement,
    latestUnlock.has(achievement.id),
    latestUnlock.get(achievement.id),
    progress[achievement.id],
    pinnedBadgeIds.includes(achievement.id)
  )).join('');
  const challenge = weeklyChallenge
    ? `<article class="weekly-challenge clay"><p class="tag">This week</p><h2>${escape(weeklyChallenge.title)}</h2><p>${escape(weeklyChallenge.description)}</p><p>${escape(weeklyChallenge.current || 0)} of ${escape(weeklyChallenge.target)} complete</p><div class="progress" role="progressbar" aria-label="Weekly challenge progress" aria-valuemin="0" aria-valuemax="${escape(weeklyChallenge.target)}" aria-valuenow="${escape(Math.min(weeklyChallenge.current || 0, weeklyChallenge.target))}"><span style="width:${weeklyChallenge.target ? Math.min(100, (weeklyChallenge.current || 0) / weeklyChallenge.target * 100) : 0}%"></span></div></article>`
    : '';
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<section class="achievements-page">
    <header class="learning-page-intro"><p class="tag">Your achievement case</p><h1>Small wins add up.</h1><p>Badges celebrate learning milestones, not grades.</p><p class="achievement-count">${earnedCount} of ${catalog.achievements.length} earned</p><p data-achievement-status class="form-message" role="status" hidden></p></header>
    ${challenge}
    <section class="achievement-title-control clay"><label for="achievement-title">Profile title</label><select id="achievement-title" data-profile-title><option value="">No title</option>${rewardChoices}</select><p>Titles can only be selected after you earn them.</p></section>
    <section class="achievement-grid" aria-label="Achievement catalog">${cards}</section>
    <section class="achievement-history"><h2>Unlock history</h2>${unlocks.length
      ? `<ol>${unlocks.slice().sort((a, b) => Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt)).map((unlock) => {
        const achievement = catalog.achievements.find(({ id }) => id === unlock.achievementId);
        const visible = achievement ? presentAchievement(achievement, true) : null;
        return visible ? `<li><strong>${escape(visible.title)}</strong><time datetime="${escape(unlock.unlockedAt)}">${escape(new Date(unlock.unlockedAt).toLocaleDateString())}</time></li>` : '';
      }).join('')}</ol>`
      : '<p>No achievements unlocked yet. Your first milestone is waiting.</p>'}</section>
  </section>`;
  return wrapper.firstElementChild;
}
