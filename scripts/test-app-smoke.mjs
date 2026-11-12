// End-to-end smoke tests: load every real page module in a DOM (jsdom), click through
// the main flows, and fail on any thrown error or console.error. Run with `npm test`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { SUPABASE_URL } from '../js/config.js';

const root = resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let runId = 0;
const problems = [];
process.on('unhandledRejection', (reason) => problems.push(`unhandled rejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (error) => problems.push(`uncaught exception: ${error?.stack || error}`));

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

async function openPage(file, { seed = {}, supabase = null, search = '' } = {}) {
  const html = await readFile(resolve(root, file), 'utf8');
  const dom = new JSDOM(html, { url: `http://localhost/${file}${search}`, pretendToBeVisual: true });
  const { window } = dom;
  for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, JSON.stringify(value));
  if (supabase) window.supabase = supabase;
  else if (process.env.STUB_SUPABASE) window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }) };
  defineGlobal('window', window);
  defineGlobal('document', window.document);
  defineGlobal('location', window.location);
  defineGlobal('localStorage', window.localStorage);
  defineGlobal('fetch', async (url) => {
    const match = String(url).match(/(data\/.+)$/);
    if (!match) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(await readFile(resolve(root, match[1]), 'utf8')) };
  });
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };
  const entry = file === 'index.html' ? 'js/pages/home.js'
    : file === 'pages/login.html' ? 'js/pages/login.js'
    : 'js/pages/app.js';
  await import(`${pathToFileURL(resolve(root, entry)).href}?run=${runId += 1}`);
  const host = window.document.querySelector('#app, #home-app, #login-app');
  for (let waited = 0; host.getAttribute('aria-busy') !== 'false' && waited < 4000; waited += 10) await sleep(10);
  const page = {
    window, host, errors,
    $: (selector) => window.document.querySelector(selector),
    $$: (selector) => [...window.document.querySelectorAll(selector)],
    click: (selector) => { const el = page.$(selector); assert.ok(el, `missing ${selector}`); el.click(); },
    choose(selector = 'input[type="radio"]') {
      const input = page.$(selector); assert.ok(input, `missing ${selector}`);
      input.checked = true; input.dispatchEvent(new window.Event('change', { bubbles: true }));
    },
    text: () => host.textContent.replace(/\s+/g, ' ').trim(),
    storage: (key) => JSON.parse(window.localStorage.getItem(key) || 'null'),
    async until(check, label) {
      for (let waited = 0; waited < 3000; waited += 10) { if (check()) return; await sleep(10); }
      assert.fail(`timed out waiting for ${label}`);
    },
    done() { console.error = originalError; assert.deepEqual(errors, [], `console.error during ${file}: ${errors.join(' | ')}`); window.close(); }
  };
  assert.equal(host.getAttribute('aria-busy'), 'false', `${file} never finished loading. console.error: ${errors.join(' | ') || 'none'}`);
  return page;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

for (const [file, heading] of [
  ['index.html', 'Build the reasoning'],
  ['pages/dashboard.html', 'Welcome back'],
  ['pages/courses.html', 'Learn one idea at a time'],
  ['pages/lessons.html', 'Propositions and connectives'],
  ['pages/flashcards.html', 'Flashcards for Logic'],
  ['pages/practice.html', 'Practice one idea at a time'],
  ['pages/quizzes.html', 'Check your understanding'],
  ['pages/assessments.html', 'Check what is sticking'],
  ['pages/progress.html', 'Progress you can understand'],
  ['pages/profile.html', 'Your study profile'],
  ['pages/login.html', 'Welcome back']
]) {
  test(`${file} renders without errors`, async () => {
    const page = await openPage(file);
    assert.ok(page.$('h1')?.textContent.includes(heading), `${file}: expected an h1 containing "${heading}"`);
    page.done();
  });
}

test('guests never load the Supabase client', async () => {
  const page = await openPage('pages/courses.html', { supabase: null });
  assert.equal(page.window.supabase, undefined);
  assert.equal(page.$$('script[src*="supabase"]').length, 0);
  page.done();
});

test('practice: mixed review runs to a results screen', async () => {
  const page = await openPage('pages/practice.html');
  page.click('[data-start-practice="mixed-review"]');
  for (let question = 0; question < 5; question += 1) {
    page.choose('[data-learning-answer]');
    page.click('[data-learning-check]');
    assert.match(page.text(), /Correct\.|Not quite\./);
    page.click('[data-learning-next]');
  }
  assert.ok(page.$('#practice-results-heading'), 'practice results heading');
  assert.match(page.text(), /\d \/ 5/);
  page.click('[data-restart-learning]');
  assert.ok(page.$('[data-learning-answer]'), 'restart returns to the first question');
  page.done();
});

test('practice: a single lesson set runs too', async () => {
  const page = await openPage('pages/practice.html');
  page.click('[data-start-practice="logic-propositions"]');
  assert.match(page.text(), /Question 1 of 5/);
  page.done();
});

test('assessment: checkpoint submits and shows a review', async () => {
  const page = await openPage('pages/assessments.html');
  page.click('[data-start-assessment]');
  for (let question = 0; question < 15; question += 1) {
    page.choose('[data-learning-answer]');
    page.click('[data-learning-next]');
  }
  assert.ok(page.$('#assessment-results-heading'), 'assessment results heading');
  assert.match(page.text(), /Your XP and lesson progress have not changed/);
  page.click('[data-restart-assessment]');
  assert.match(page.text(), /Question 1 of 15/);
  page.done();
});

test('quizzes: a quiz saves an attempt to guest history', async () => {
  const page = await openPage('pages/quizzes.html');
  page.click('[data-start-quiz="logic-truth-tables"]');
  for (let question = 0; question < 5; question += 1) {
    page.choose('[data-quiz-answer]');
    page.click('[data-quiz-check]');
    page.click('[data-quiz-next]');
  }
  await page.until(() => /Attempt saved/.test(page.text()), 'the attempt to be saved');
  assert.equal(page.storage('dfh:quiz-attempts').length, 1);
  assert.equal(page.storage('dfh:quiz-attempts')[0].mode, 'logic-truth-tables');
  page.done();
});

test('flashcards: reveal and move through the deck', async () => {
  const page = await openPage('pages/flashcards.html');
  assert.match(page.text(), /Card 1 of 15/);
  page.click('[data-flashcard-reveal]');
  assert.equal(page.$('[data-flashcard-answer]').hasAttribute('hidden'), false);
  page.click('[data-flashcard-next]');
  assert.match(page.text(), /Card 2 of 15/);
  page.done();
});

test('lesson: completing a lesson awards XP once', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-truth-tables' });
  page.click('[data-complete]');
  await page.until(() => page.storage('dfh:learner-state')?.xp === 50, 'XP to be saved');
  assert.deepEqual(page.storage('dfh:learner-state').completedLessons, ['logic-truth-tables']);
  assert.match(page.$('[data-complete]').textContent, /Completed/);
  page.done();
});

test('lesson: the truth-table explorer responds to the switches', async () => {
  const page = await openPage('pages/lessons.html', { search: '?lesson=logic-propositions' });
  const widget = page.$('[data-widget="truth-table"]');
  assert.ok(widget, 'the explorer is on the page');
  await page.until(() => widget.dataset.ready === 'true', 'the explorer to start');
  const value = (id) => widget.querySelector(`[data-result="${id}"]`).textContent.trim();
  assert.equal(value('implies'), 'True');
  widget.querySelector('[data-var="p"]').click();
  assert.equal(widget.querySelector('[data-var="p"]').getAttribute('aria-pressed'), 'false');
  assert.equal(value('implies'), 'True');
  widget.querySelector('[data-var="q"]').click();
  assert.equal(value('implies'), 'True');
  assert.equal(value('and'), 'False');
  widget.querySelector('[data-var="p"]').click();
  assert.equal(value('implies'), 'False');
  assert.equal(widget.querySelectorAll('tr[aria-current="true"]').length, 1);
  page.done();
});

test('profile: saving a nickname updates the page', async () => {
  const page = await openPage('pages/profile.html');
  const input = page.$('#profile-nickname'); input.value = 'Kian Reyes';
  page.$('[data-profile-form]').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.until(() => /Nickname saved/.test(page.text()), 'the nickname to save');
  assert.equal(page.storage('dfh:learner-state').nickname, 'Kian Reyes');
  page.done();
});

test('signed-in dashboard fills the leaderboard after the first paint', async () => {
  const session = { user: { id: 'user-1', email: 'student@example.com' } };
  const rows = { profiles: { nickname: 'Kian', xp: 100, level: 1, streak: 2, last_active: '2026-11-12' }, lesson_progress: [{ lesson_id: 'logic-propositions' }, { lesson_id: 'logic-truth-tables' }], quiz_attempts: [], leaderboard: [{ nickname: 'Ana', xp: 150 }, { nickname: 'Kian', xp: 100 }] };
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, single: () => Promise.resolve(result), upsert: () => Promise.resolve({ error: null }), update: () => chain, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    return chain;
  };
  const client = { auth: { getSession: async () => ({ data: { session }, error: null }) }, from: query };
  const page = await openPage('pages/dashboard.html', {
    seed: { [`sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`]: { access_token: 'x' } },
    supabase: { createClient: () => client }
  });
  await page.until(() => page.$$('.leaderboard-list li').length === 2, 'the leaderboard rows');
  assert.match(page.text(), /student@example\.com/);
  assert.match(page.text(), /Ana/);
  page.done();
});

const child = process.env.SMOKE_CHILD;
if (child) {
  // Child process: run exactly one test in a fresh module graph.
  const entry = tests.find(([name]) => name === child);
  try { await entry[1](); if (problems.length) throw new Error(problems.join(' | ')); console.log(`ok   ${child}`); process.exit(0); }
  catch (error) { console.log(`FAIL ${child}\n     ${String(error.message).split('\n')[0]}`); process.exit(1); }
}

// Parent process: run each test in its own process, four at a time.
const only = process.env.ONLY;
const names = tests.map(([name]) => name).filter((name) => !only || name.includes(only));
const results = new Map();
let next = 0;
async function worker() {
  while (next < names.length) {
    const name = names[next]; next += 1;
    const output = await new Promise((done) => {
      execFile(process.execPath, [import.meta.filename], { env: { ...process.env, SMOKE_CHILD: name }, timeout: 60000 }, (error, stdout) => done(stdout || `FAIL ${name}\n     ${error?.message || 'no output'}`));
    });
    results.set(name, output.trim());
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
let failed = 0;
for (const name of names) { const line = results.get(name); if (line.startsWith('FAIL')) failed += 1; console.log(line); }
console.log(failed ? `\n${failed} of ${names.length} smoke tests failed.` : `\nAll ${names.length} smoke tests passed.`);
process.exit(failed ? 1 : 0);
