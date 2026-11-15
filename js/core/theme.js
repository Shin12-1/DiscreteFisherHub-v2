import { getState, setTheme } from './state.js';
export async function initTheme() {
  const state = await getState();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.reduceMotion = String(state.profilePreferences.reduceMotion);
  return state.theme;
}
export async function toggleTheme() { const theme = (await getState()).theme; return setTheme(theme === 'dark' ? 'light' : 'dark'); }
