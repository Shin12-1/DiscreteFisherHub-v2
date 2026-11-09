import { getState, setTheme } from './state.js';
export async function initTheme() { const theme = (await getState()).theme; document.documentElement.dataset.theme = theme; return theme; }
export async function toggleTheme() { const theme = (await getState()).theme; return setTheme(theme === 'dark' ? 'light' : 'dark'); }
