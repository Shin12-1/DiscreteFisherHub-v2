const PROFILE_VISIBILITY = new Set(['private', 'members', 'public']);
const SECTION_VISIBILITY = ['studyTime', 'fastestTimes', 'stats', 'badges', 'mastery', 'activity'];
const REPORT_REASONS = new Set(['privacy', 'impersonation', 'harassment', 'other']);
const PROFILE_COLUMNS = 'public_handle, profile_visibility, search_opt_in, study_time_visibility, fastest_times_visibility, stats_visibility, badges_visibility, mastery_visibility, activity_visibility, leaderboard_opt_in, selected_title, pinned_badge_ids';

function assertClient(client, method) {
  if (!client || typeof client[method] !== 'function') {
    throw new TypeError(`A Supabase client with ${method}() is required.`);
  }
}

function assertHandle(handle) {
  if (typeof handle !== 'string' || !/^[a-f0-9]{32}$/i.test(handle)) {
    throw new TypeError('A valid public profile handle is required.');
  }
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object' || typeof profile.nickname !== 'string' ||
    typeof profile.handle !== 'string' || !Number.isInteger(profile.level) ||
    !profile.sections || typeof profile.sections !== 'object') {
    throw new TypeError('The public profile response is invalid.');
  }
  const sections = Object.fromEntries(SECTION_VISIBILITY
    .filter((key) => profile.sections[key] !== null && profile.sections[key] !== undefined)
    .map((key) => [key, profile.sections[key]]));
  return {
    handle: profile.handle,
    nickname: profile.nickname,
    title: typeof profile.title === 'string' ? profile.title : null,
    level: profile.level,
    memberSince: profile.memberSince,
    sections
  };
}

function normalizeSettings(row) {
  return {
    publicHandle: row.public_handle,
    profileVisibility: row.profile_visibility,
    searchOptIn: row.search_opt_in,
    studyTimeVisibility: row.study_time_visibility,
    fastestTimesVisibility: row.fastest_times_visibility,
    statsVisibility: row.stats_visibility,
    badgesVisibility: row.badges_visibility,
    masteryVisibility: row.mastery_visibility,
    activityVisibility: row.activity_visibility,
    leaderboardOptIn: row.leaderboard_opt_in,
    selectedTitle: row.selected_title,
    pinnedBadgeIds: Array.isArray(row.pinned_badge_ids) ? row.pinned_badge_ids : []
  };
}

async function requireUser(client) {
  if (!client?.auth || typeof client.auth.getUser !== 'function') {
    throw new TypeError('A signed-in Supabase client is required.');
  }
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Sign in to manage profile actions.');
  return data.user;
}

function visibilityPayload(settings) {
  if (!settings || typeof settings !== 'object' || !PROFILE_VISIBILITY.has(settings.profileVisibility) ||
    typeof settings.searchOptIn !== 'boolean' || typeof settings.leaderboardOptIn !== 'boolean') {
    throw new TypeError('Profile visibility settings are invalid.');
  }
  const payload = {
    profile_visibility: settings.profileVisibility,
    search_opt_in: settings.searchOptIn,
    leaderboard_opt_in: settings.leaderboardOptIn
  };
  for (const section of SECTION_VISIBILITY) {
    const key = `${section[0].toLowerCase()}${section.slice(1)}Visibility`;
    if (!PROFILE_VISIBILITY.has(settings[key])) throw new TypeError(`Invalid ${section} visibility.`);
    payload[`${section.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_visibility`] = settings[key];
  }
  return payload;
}

export async function loadPublicProfile({ client, handle, visitorPreview = false } = {}) {
  assertClient(client, 'rpc');
  assertHandle(handle);
  if (typeof visitorPreview !== 'boolean') throw new TypeError('Visitor preview must be a boolean.');
  const { data, error } = await client.rpc('load_public_profile', {
    target_handle: handle,
    visitor_preview: visitorPreview
  });
  if (error) throw error;
  return data == null ? null : normalizeProfile(data);
}

export async function loadProfileSettings({ client } = {}) {
  const user = await requireUser(client);
  const { data, error } = await client.from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .single();
  if (error) throw error;
  if (!data) throw new Error('Profile settings are unavailable.');
  return normalizeSettings(data);
}

export async function saveProfileVisibility({ client, settings } = {}) {
  const user = await requireUser(client);
  const payload = visibilityPayload(settings);
  const { data, error } = await client.from('profiles')
    .update(payload)
    .eq('id', user.id);
  if (error) throw error;
  return { ...settings, publicHandle: data?.[0]?.public_handle };
}

export async function saveProfilePresentation({ client, titleId = null, pinnedBadgeIds = [] } = {}) {
  await requireUser(client);
  if ((titleId !== null && (typeof titleId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(titleId))) ||
    !Array.isArray(pinnedBadgeIds) || pinnedBadgeIds.length > 3 ||
    pinnedBadgeIds.some((id) => typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) ||
    new Set(pinnedBadgeIds).size !== pinnedBadgeIds.length) {
    throw new TypeError('Choose an earned title and up to three unique badges.');
  }
  const { data, error } = await client.rpc('save_profile_presentation', {
    title_id: titleId,
    target_badge_ids: pinnedBadgeIds
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new TypeError('The profile presentation response is invalid.');
  return {
    selectedTitle: data.selectedTitle ?? null,
    pinnedBadgeIds: Array.isArray(data.pinnedBadgeIds) ? data.pinnedBadgeIds : []
  };
}

export async function listBlockedProfiles({ client } = {}) {
  await requireUser(client);
  const { data, error } = await client.rpc('list_blocked_profiles');
  if (error) throw error;
  if (!Array.isArray(data)) throw new TypeError('The blocked profile response is invalid.');
  return data.map(({ public_handle: handle, nickname }) => ({ handle, nickname }));
}

async function profileAction({ client, handle, name, args }) {
  await requireUser(client);
  assertHandle(handle);
  const { error } = await client.rpc(name, args);
  if (error) throw error;
}

export async function blockProfile({ client, handle } = {}) {
  return profileAction({ client, handle, name: 'block_profile', args: { target_handle: handle } });
}

export async function unblockProfile({ client, handle } = {}) {
  return profileAction({ client, handle, name: 'unblock_profile', args: { target_handle: handle } });
}

export async function reportProfile({ client, handle, reason } = {}) {
  if (!REPORT_REASONS.has(reason)) throw new TypeError('Choose a valid report reason.');
  return profileAction({
    client,
    handle,
    name: 'report_profile',
    args: { target_handle: handle, report_reason: reason }
  });
}

export function createPublicProfileUrl(handle, origin = globalThis.location?.origin) {
  assertHandle(handle);
  let base;
  try {
    base = new URL(origin);
  } catch {
    throw new TypeError('A valid profile URL origin is required.');
  }
  if (!['https:', 'http:'].includes(base.protocol)) throw new TypeError('Profile URLs require an HTTP origin.');
  return new URL(`/pages/public-profile.html?handle=${encodeURIComponent(handle)}`, base.origin).href;
}
