import { storage } from './storage.js';
const KEY = 'learner-state';
const defaults = { xp:0, level:1, streak:0, lastActiveDate:null, completedLessons:[], theme:'light', nickname:'Fisher learner' };
const today = () => new Date().toISOString().slice(0,10);
const yesterday = () => { const date = new Date(); date.setDate(date.getDate() - 1); return date.toISOString().slice(0,10); };
export async function getState() { return { ...defaults, ...await storage.get(KEY, {}) }; }
export async function saveState(next) { return storage.set(KEY, { ...defaults, ...next }); }
export async function touchStreak() { const state = await getState(); if (storage.kind === 'supabase') return state; const now = today(); if (state.lastActiveDate === now) return state; const streak = state.lastActiveDate === yesterday() ? state.streak + 1 : 1; return saveState({ ...state, streak, lastActiveDate:now }); }
export async function completeLesson(id, xp = 50) { const state = await touchStreak(); if (state.completedLessons.includes(id)) return { state, awarded:false, leveledUp:false }; const candidate = { ...state, xp:state.xp + xp, level:Math.floor((state.xp + xp) / 150) + 1, completedLessons:[...state.completedLessons,id] }; const next = await saveState(candidate); return { state:next, awarded:next.completedLessons.includes(id), leveledUp:next.level > state.level }; }
export async function setTheme(theme) { const state = await getState(); const next = await saveState({ ...state, theme }); document.documentElement.dataset.theme = theme; return next; }
