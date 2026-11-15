import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  blockProfile,
  createPublicProfileUrl,
  loadPublicProfile,
  reportProfile,
  saveProfilePresentation,
  saveProfileVisibility,
  unblockProfile
} from '../js/core/profile-data.mjs';
import { renderPublicProfileView } from '../js/pages/public-profile-view.mjs';
import { renderAchievementsView } from '../js/pages/achievements-view.mjs';
import { profileView } from '../js/pages/student-views.js';
import { pageUrl } from '../js/core/router.js';
import { shell } from '../js/components/shell.js';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(resolve(root, 'data/achievements.json'), 'utf8'));
const migrationPath = (await import('node:fs/promises')).readFile;
const migrationFiles = (await import('node:fs/promises')).readdir;
const migrationName = (await migrationFiles(resolve(root, 'supabase/migrations')))
  .find((name) => name.endsWith('_profile_visibility_actions.sql'));
assert.ok(migrationName, 'profile privacy actions have a forward migration');
const migrationSql = await migrationPath(resolve(root, 'supabase/migrations', migrationName), 'utf8');
const schemaSql = await migrationPath(resolve(root, 'supabase/schema.sql'), 'utf8');
const handle = 'a'.repeat(32);
const reports = [];

function clientFor({ user = { id: 'learner-1' }, profile = null, rpcOverrides = {} } = {}) {
  const calls = [];
  const client = {
    calls,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ type: 'rpc', name, args });
      if (rpcOverrides[name]) return rpcOverrides[name](args);
      if (name === 'load_public_profile') return { data: profile, error: null };
      if (name === 'save_profile_presentation') {
        return { data: { selectedTitle: 'Logic Apprentice', pinnedBadgeIds: args.target_badge_ids }, error: null };
      }
      return { data: null, error: null };
    },
    from(table) {
      return {
        update(payload) {
          calls.push({ type: 'update', table, payload });
          return {
            eq: async () => ({ data: [{ ...payload, public_handle: handle }], error: null })
          };
        }
      };
    }
  };
  return client;
}

const profile = {
  handle,
  nickname: 'Logic Learner',
  title: 'Logic Apprentice',
  level: 4,
  memberSince: '2025-01-02T00:00:00Z',
  sections: {
    studyTime: { totalSeconds: 7200, thisWeekSeconds: 1800, averageSecondsPerDay: 240 },
    fastestTimes: { items: [{ type: 'quiz', title: 'Truth tables', durationSeconds: 161, score: 5, total: 5 }] },
    stats: { xp: 450, streak: 3, lessonsCompleted: 2, quizzesTaken: 4 },
    badges: { pinned: [{ id: 'first-step', title: 'First Step' }], earnedCount: 12 },
    mastery: [{ topicId: 'logic', title: 'Logic', completed: 2, total: 3, percent: 67 }],
    activity: [{ type: 'course-completed', label: 'Finished Logic course', occurredAt: '2025-02-01T00:00:00Z' }]
  }
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('public profile loader treats unavailable handles as unavailable and passes visitor preview safely', async () => {
  const client = clientFor({ profile: null });
  assert.equal(await loadPublicProfile({ client, handle }), null);
  assert.deepEqual(client.calls[0], {
    type: 'rpc',
    name: 'load_public_profile',
    args: { target_handle: handle, visitor_preview: false }
  });
  const previewClient = clientFor({ profile, user: { id: 'owner' } });
  const loaded = await loadPublicProfile({ client: previewClient, handle, visitorPreview: true });
  assert.equal(loaded.nickname, profile.nickname);
  assert.deepEqual(previewClient.calls[0].args, { target_handle: handle, visitor_preview: true });
});

test('visibility saving keeps search and leaderboard opt-ins separate from six section controls', async () => {
  const client = clientFor();
  const saved = await saveProfileVisibility({
    client,
    settings: {
      profileVisibility: 'members',
      searchOptIn: true,
      studyTimeVisibility: 'public',
      fastestTimesVisibility: 'members',
      statsVisibility: 'private',
      badgesVisibility: 'public',
      masteryVisibility: 'private',
      activityVisibility: 'members',
      leaderboardOptIn: true
    }
  });
  assert.deepEqual(client.calls[0], {
    type: 'update',
    table: 'profiles',
    payload: {
      profile_visibility: 'members',
      search_opt_in: true,
      study_time_visibility: 'public',
      fastest_times_visibility: 'members',
      stats_visibility: 'private',
      badges_visibility: 'public',
      mastery_visibility: 'private',
      activity_visibility: 'members',
      leaderboard_opt_in: true
    }
  });
  assert.equal(saved.profileVisibility, 'members');
  await assert.rejects(() => saveProfileVisibility({
    client,
    settings: { ...saved, profileVisibility: 'everyone' }
  }), /visibility/i);
});

test('profile presentation and visitor actions validate inputs and use database-owned handle resolution', async () => {
  const client = clientFor();
  await saveProfilePresentation({ client, titleId: 'logic-rookie', pinnedBadgeIds: ['first-step', 'logic-rookie'] });
  await blockProfile({ client, handle });
  await unblockProfile({ client, handle });
  await reportProfile({ client, handle, reason: 'privacy' });
  assert.deepEqual(client.calls.map(({ name }) => name), [
    'save_profile_presentation',
    'block_profile',
    'unblock_profile',
    'report_profile'
  ]);
  assert.deepEqual(client.calls[1].args, { target_handle: handle });
  assert.deepEqual(client.calls[3].args, { target_handle: handle, report_reason: 'privacy' });
  await assert.rejects(() => saveProfilePresentation({
    client,
    titleId: 'not-earned',
    pinnedBadgeIds: ['first-step', 'first-step', 'first-step', 'first-step']
  }), /three|duplicate|badge/i);
  await assert.rejects(() => reportProfile({ client, handle, reason: 'spam' }), /reason/i);
  const guest = clientFor({ user: null });
  await assert.rejects(() => blockProfile({ client: guest, handle }), /sign in/i);
  await assert.rejects(() => reportProfile({ client: guest, handle, reason: 'other' }), /sign in/i);
});

test('profile URLs contain only a validated stable handle', () => {
  const url = new URL(createPublicProfileUrl(handle, 'https://discretefisherhub.vercel.app'));
  assert.equal(url.pathname, '/pages/public-profile.html');
  assert.equal(url.searchParams.get('handle'), handle);
  assert.equal(url.searchParams.has('user_id'), false);
  assert.equal(url.searchParams.has('email'), false);
  assert.throws(() => createPublicProfileUrl('student@example.com', 'https://example.com'), /handle/i);
});

test('achievement page is reachable from learner navigation', () => {
  globalThis.location = { pathname: '/pages/profile.html' };
  assert.equal(pageUrl('achievements'), '../pages/achievements.html');
  assert.match(shell('achievements', '', 'light'), /href="\.\.\/pages\/achievements\.html"[^>]*aria-current="page"/);
});

test('public profile and achievements have standalone app routes', async () => {
  const [publicPage, achievementsPage] = await Promise.all([
    readFile(resolve(root, 'pages/public-profile.html'), 'utf8'),
    readFile(resolve(root, 'pages/achievements.html'), 'utf8')
  ]);
  assert.match(publicPage, /data-page="public-profile"/);
  assert.match(achievementsPage, /data-page="achievements"/);
});

test('visitor view shows available profile sections and only visitor actions', () => {
  const dom = new JSDOM('<!doctype html>');
  globalThis.document = dom.window.document;
  const view = renderPublicProfileView({ profile, isOwner: false });
  dom.window.document.body.append(view);
  const text = dom.window.document.body.textContent;
  assert.match(text, /Logic Learner/);
  assert.match(text, /Logic Apprentice/);
  assert.match(text, /Member since/);
  assert.match(text, /Fastest times/);
  assert.match(text, /Truth tables quiz/);
  assert.match(text, /2:41/);
  assert.match(text, /5\/5/);
  assert.match(text, /12 earned/);
  assert.match(text, /Finished Logic course/);
  assert.ok(view.querySelector('[data-profile-share]'));
  assert.ok(view.querySelector('[data-profile-block]'));
  assert.ok(view.querySelector('[data-profile-report]'));
  assert.equal(view.querySelector('[data-profile-follow]'), null);
  assert.equal(view.querySelector('[data-owner-controls]'), null);
  dom.window.close();
});

test('owner profile renderer supports in-page edit targets and keeps standalone links', () => {
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  const dom = new JSDOM('<!doctype html>');
  globalThis.document = dom.window.document;
  globalThis.location = { pathname: '/pages/profile.html' };
  try {
    const embedded = renderPublicProfileView({
      profile,
      isOwner: true,
      ownerActionTargets: { edit: '#profile-details', visibility: '#profile-visibility' },
      headingLevel: 'h2',
      achievementTotal: 24
    });
    dom.window.document.body.append(embedded);
    assert.equal(embedded.querySelector('.public-profile-identity h2')?.textContent, 'Logic Learner');
    assert.equal(embedded.querySelector('.public-profile-identity h1'), null);
    assert.equal(embedded.querySelector('[data-owner-controls] a')?.getAttribute('href'), '#profile-details');
    assert.equal(embedded.querySelector('[data-profile-visibility]')?.getAttribute('href'), '#profile-visibility');
    assert.equal(embedded.querySelector('[data-profile-pinned-badges]')?.getAttribute('href'), '../pages/achievements.html');
    assert.match(embedded.querySelector('[data-profile-badges]').textContent, /12 of 24/);

    const standalone = renderPublicProfileView({ profile, isOwner: true });
    assert.equal(standalone.querySelector('[data-owner-controls] a')?.getAttribute('href'), 'profile.html');
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
    dom.window.close();
  }
});

test('profile report form stays visually hidden until opened', async () => {
  const css = await readFile(resolve(root, 'css/pages.css'), 'utf8');
  const formStyles = [...css.matchAll(/\.profile-report-form(?:\[hidden\])?\s*\{[^}]+\}/g)]
    .map(([rule]) => rule)
    .join('\n');
  const dom = new JSDOM(`<!doctype html><style>${formStyles}</style>`);
  const oldDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const view = renderPublicProfileView({ profile });
    dom.window.document.body.append(view);
    const form = view.querySelector('[data-profile-report-form]');
    assert.equal(form.hidden, true);
    assert.equal(dom.window.getComputedStyle(form).display, 'none');
    form.hidden = false;
    assert.notEqual(dom.window.getComputedStyle(form).display, 'none');
  } finally {
    globalThis.document = oldDocument;
    dom.window.close();
  }
});

test('signed-out visitor actions request sign-in without calling profile RPCs', async () => {
  const { bindPublicProfileActions } = await import('../js/pages/public-profile.js');
  const dom = new JSDOM('<!doctype html>');
  const view = renderPublicProfileView({ profile, isOwner: false });
  dom.window.document.body.append(view);
  const calls = [];
  bindPublicProfileActions({
    root: view,
    handle,
    profileUrl: `https://example.com/pages/public-profile.html?handle=${handle}`,
    isSignedIn: false,
    client: { rpc: async (...args) => { calls.push(args); return { data: null, error: null }; } },
    clipboard: { writeText: async () => {} }
  });
  view.querySelector('[data-profile-block]').click();
  assert.match(view.querySelector('[data-profile-action-status]').textContent, /sign in/i);
  view.querySelector('[data-profile-report]').click();
  assert.match(view.querySelector('[data-profile-action-status]').textContent, /sign in/i);
  assert.deepEqual(calls, []);
  dom.window.close();
});

test('owner view adds management controls and hidden sections stay absent', () => {
  const privateProfile = { ...profile, sections: { stats: profile.sections.stats } };
  const dom = new JSDOM('<!doctype html>');
  globalThis.document = dom.window.document;
  const view = renderPublicProfileView({ profile: privateProfile, isOwner: true });
  dom.window.document.body.append(view);
  assert.ok(view.querySelector('[data-owner-controls]'));
  assert.ok(view.querySelector('[data-profile-preview]'));
  assert.ok(view.querySelector('[data-profile-visibility]'));
  assert.equal(view.querySelector('[data-profile-block]'), null);
  assert.equal(view.querySelector('[data-profile-report]'), null);
  assert.equal(view.querySelector('[data-profile-study-time]'), null);
  assert.equal(view.querySelector('[data-profile-fastest-times]'), null);
  assert.ok(view.querySelector('[data-profile-stats]'));
  dom.window.close();
});

test('signed-in profile exposes privacy controls and blocked-profile management', () => {
  globalThis.location = { pathname: '/pages/profile.html' };
  const settings = {
    publicHandle: handle,
    profileVisibility: 'public',
    searchOptIn: false,
    studyTimeVisibility: 'members',
    fastestTimesVisibility: 'private',
    statsVisibility: 'public',
    badgesVisibility: 'private',
    masteryVisibility: 'members',
    activityVisibility: 'private',
    leaderboardOptIn: true,
    selectedTitle: 'logic-rookie',
    pinnedBadgeIds: ['first-step']
  };
  const markup = profileView({ id: 'learner-1', email: 'learner@example.com' }, {}, settings, [
    { handle: 'b'.repeat(32), nickname: 'Blocked learner' }
  ]);
  assert.match(markup, /data-profile-visibility/);
  assert.match(markup, /name="profileVisibility"/);
  assert.match(markup, /name="studyTimeVisibility"/);
  assert.match(markup, /name="fastestTimesVisibility"/);
  assert.match(markup, /name="statsVisibility"/);
  assert.match(markup, /name="badgesVisibility"/);
  assert.match(markup, /name="masteryVisibility"/);
  assert.match(markup, /name="activityVisibility"/);
  assert.match(markup, /name="searchOptIn"/);
  assert.match(markup, /name="leaderboardOptIn"/);
  assert.match(markup, /data-public-profile-url/);
  assert.match(markup, /Blocked learner/);
  assert.match(markup, /data-unblock-profile="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"/);
});

test('achievements view counts earned badges, shows progress, and hides locked secret details', () => {
  const dom = new JSDOM('<!doctype html>');
  globalThis.document = dom.window.document;
  const view = renderAchievementsView({
    catalog,
    unlocks: [{ achievementId: 'first-step', unlockedAt: '2025-01-02T00:00:00Z' }],
    progress: {
      'logic-rookie': { current: 0, target: 1 },
      secret: { current: 1, target: 3 }
    },
    weeklyChallenge: { title: 'Lesson Sprint', description: 'Complete 3 lessons this week.', current: 1, target: 3 },
    pinnedBadgeIds: ['first-step']
  });
  dom.window.document.body.append(view);
  const text = dom.window.document.body.textContent;
  assert.match(text, /1 of 23 earned/i);
  assert.match(text, /Lesson Sprint/);
  assert.match(text, /Logic Rookie/);
  assert.match(text, /\?\?\?/);
  assert.doesNotMatch(text, /perfect score on every published Logic quiz/i);
  assert.equal(view.querySelector('[data-achievement="secret"] [role="progressbar"]'), null);
  assert.ok(view.querySelector('[data-pin-badge="first-step"]'));
  assert.ok(view.querySelector('[role="progressbar"]'));
  dom.window.close();
});

test('achievement total includes each weekly badge earned in a different week', () => {
  const dom = new JSDOM('<!doctype html>');
  globalThis.document = dom.window.document;
  const view = renderAchievementsView({
    catalog,
    unlocks: [
      { achievementId: 'weekly-scholar', periodKey: '2025-W01', unlockedAt: '2025-01-02T00:00:00Z' },
      { achievementId: 'weekly-scholar', periodKey: '2025-W02', unlockedAt: '2025-01-09T00:00:00Z' }
    ]
  });
  assert.match(view.textContent, /2 of 23 earned/i);
  dom.window.close();
});

test('database profile actions are privacy checked, authenticated, and grant only intended execution', () => {
  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /function public\.load_public_profile\s*\(/i);
    assert.match(sql, /if visitor_preview then\s+profile_visible := viewer_id = profile_row\.id\s+and profile_row\.profile_visibility = 'public';/i);
    assert.match(sql, /function public\.save_profile_presentation\s*\(/i);
    assert.match(sql, /function public\.block_profile\s*\(/i);
    assert.match(sql, /function public\.unblock_profile\s*\(/i);
    assert.match(sql, /function public\.report_profile\s*\(/i);
    assert.match(sql, /function public\.list_blocked_profiles\s*\(/i);
    assert.match(sql, /security definer[\s\S]*?set search_path\s*=\s*''/i);
    assert.match(sql, /profile_reports_reason_check[\s\S]*?privacy[\s\S]*?impersonation[\s\S]*?harassment[\s\S]*?other/i);
    assert.match(sql, /grant execute on function public\.load_public_profile\s*\(text,\s*boolean\)\s*to anon,\s*authenticated/i);
    assert.match(sql, /grant execute on function public\.save_profile_presentation\s*\(text,\s*text\[\]\)\s*to authenticated/i);
  }
});

for (const [name, run] of tests) {
  await run();
  reports.push(`PASS ${name}`);
}

console.log(`${reports.join('\n')}\nAll ${tests.length} public profile tests passed.`);
