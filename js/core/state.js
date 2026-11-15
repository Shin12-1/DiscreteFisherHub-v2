import { getLocalStorageAdapter, storage } from './storage.js';
import { localDateKey, previousDateKey } from './dates.mjs';
import { normalizeProfilePreferences } from './profile-preferences.mjs';
const KEY = 'learner-state';
const PROFILE_PREFERENCES_KEY = 'profile-preferences';
const defaults = { xp:0, level:1, streak:0, lastActiveDate:null, completedLessons:[], theme:'light', nickname:'Fisher learner' };
const today = () => localDateKey();
const yesterday = () => previousDateKey();
export async function getState() {
  const [state, profilePreferences] = await Promise.all([
    storage.get(KEY, {}),
    getLocalStorageAdapter().get(PROFILE_PREFERENCES_KEY)
  ]);
  return { ...defaults, ...state, profilePreferences: normalizeProfilePreferences(profilePreferences) };
}
export async function saveState(next) {
  const { profilePreferences, ...learnerState } = next;
  const normalizedPreferences = normalizeProfilePreferences(profilePreferences);
  const state = await storage.set(KEY, { ...defaults, ...learnerState });
  return { ...state, profilePreferences: normalizedPreferences };
}
export async function saveProfilePreferences(preferences) {
  const normalizedPreferences = normalizeProfilePreferences(preferences);
  await getLocalStorageAdapter().set(PROFILE_PREFERENCES_KEY, normalizedPreferences);
  return normalizedPreferences;
}
export async function touchStreak() { const state = await getState(); if (storage.kind === 'supabase') return state; const now = today(); if (state.lastActiveDate === now) return state; const streak = state.lastActiveDate === yesterday() ? state.streak + 1 : 1; return saveState({ ...state, streak, lastActiveDate:now }); }
export async function completeLesson(id, xp = 50) { const state = await touchStreak(); if (state.completedLessons.includes(id)) return { state, awarded:false, leveledUp:false }; const candidate = { ...state, xp:state.xp + xp, level:Math.floor((state.xp + xp) / 150) + 1, completedLessons:[...state.completedLessons,id] }; const next = await saveState(candidate); return { state:next, awarded:next.completedLessons.includes(id), leveledUp:next.level > state.level }; }
export async function setTheme(theme) { const state = await getState(); const next = await saveState({ ...state, theme }); document.documentElement.dataset.theme = theme; return next; }
