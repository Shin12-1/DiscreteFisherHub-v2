import { initialiseAuth, getCurrentUser } from '../core/auth.js';
import { getState } from '../core/state.js';
import { initTheme, toggleTheme } from '../core/theme.js';
import { renderHomePage } from './home-view.mjs';

const app = document.querySelector('#home-app');
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[char]));

function renderTopics(topics) {
  const target = document.querySelector('#topic-preview');
  target.innerHTML = topics.map((topic) => `<article class="topic-preview clay"><span class="scope-label">${escape(topic.scopeLabel)}</span><h3>${escape(topic.title)}</h3><p>${escape(topic.summary)}</p></article>`).join('');
}

async function loadTopics() {
  const target = document.querySelector('#topic-preview');
  try {
    const response = await fetch('data/topics.json');
    if (!response.ok) throw new Error('Topic data request failed.');
    renderTopics(await response.json());
  } catch (error) {
    console.error('Could not load topic previews.', error);
    target.innerHTML = '<div class="topic-status clay"><div><strong>Topics could not load.</strong><br>Run the local server and refresh this page.</div></div>';
  }
}

async function render() {
  try {
    await initialiseAuth();
  } catch (error) {
    console.warn('Could not initialize authentication; continuing in guest mode.', error);
  }
  const theme = await initTheme();
  const state = await getState();
  app.innerHTML = renderHomePage(getCurrentUser(), state, theme);
  app.setAttribute('aria-busy', 'false');
  app.querySelector('[data-theme-toggle]').addEventListener('click', async () => {
    await toggleTheme();
    render();
  });
  loadTopics();
}

render();
