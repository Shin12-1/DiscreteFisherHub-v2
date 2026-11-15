import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { runInNewContext } from 'node:vm';
import { createPublicProfileUrl } from '../js/core/profile-data.mjs';
import { renderPublicProfileView } from '../js/pages/public-profile-view.mjs';
import { downloadProfileCard, renderProfileQr } from '../js/components/profile-share.js';
import { bindPublicProfileActions } from '../js/pages/public-profile.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const handle = 'a'.repeat(32);
const url = createPublicProfileUrl(handle, 'https://discretefisherhub.vercel.app');
const profile = {
  handle,
  nickname: 'Logic Learner',
  title: 'Logic Apprentice',
  level: 4,
  memberSince: '2025-01-02T00:00:00Z',
  sections: {
    badges: { pinned: [{ id: 'first-step', title: 'First Step' }] },
    stats: { xp: 450, streak: 3, lessonsCompleted: 2, quizzesTaken: 4 }
  }
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('QR rendering encodes the stable profile URL locally', async () => {
  const dom = new JSDOM('<div id="qr"></div>');
  const target = dom.window.document.querySelector('#qr');
  const calls = [];
  const oldEncoder = globalThis.qrcode;
  globalThis.qrcode = () => ({
    addData: (payload) => calls.push({ canvas: target, payload }),
    make: () => {},
    createSvgTag: () => `<svg data-qr-payload="${url}"></svg>`
  });
  try {
    await renderProfileQr({ target, url });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload, url);
    assert.equal(target.querySelector('svg')?.getAttribute('data-qr-payload'), url);
  } finally {
    globalThis.qrcode = oldEncoder;
    dom.window.close();
  }
});

test('private owner profiles disable and reject profile sharing', async () => {
  const dom = new JSDOM('<!doctype html>');
  const oldDocument = globalThis.document;
  const oldLocation = globalThis.location;
  try {
    globalThis.document = dom.window.document;
    globalThis.location = dom.window.location;
    const view = renderPublicProfileView({ profile, isOwner: true, shareAllowed: false });
    const button = view.querySelector('[data-profile-share]');
    assert.ok(button);
    assert.equal(button.disabled, true);
    assert.match(button.getAttribute('aria-label') || button.textContent, /private|sharing off/i);
    bindPublicProfileActions({ root: view, profile, profileUrl: url, shareAllowed: false, isSignedIn: false });
    button.disabled = false;
    button.click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    assert.equal(view.querySelector('[data-profile-share-dialog]'), null);
    assert.match(view.querySelector('[data-profile-action-status]').textContent, /private/i);
  } finally {
    globalThis.document = oldDocument;
    globalThis.location = oldLocation;
    dom.window.close();
  }
});

test('share dialog exposes the QR, stable link, copy, and card actions', async () => {
  const dom = new JSDOM('<!doctype html>');
  const oldDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const view = renderPublicProfileView({ profile, isOwner: false, shareAllowed: true });
  dom.window.document.body.append(view);
  const encoded = [];
  const oldEncoder = globalThis.qrcode;
  const oldShowModal = dom.window.HTMLDialogElement.prototype.showModal;
  const copied = [];
  try {
    globalThis.qrcode = () => ({
      addData: (payload) => encoded.push(payload),
      make: () => {},
      createSvgTag: () => '<svg role="img"></svg>'
    });
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    bindPublicProfileActions({
      root: view,
      handle,
      profile,
      profileUrl: url,
      shareAllowed: true,
      isSignedIn: false,
      clipboard: { writeText: async (value) => copied.push(value) }
    });
    view.querySelector('[data-profile-share]').click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    const dialog = view.querySelector('[data-profile-share-dialog]');
    assert.ok(dialog?.hasAttribute('open'));
    assert.equal(dialog.querySelector('[data-profile-qr] svg')?.getAttribute('role'), 'img');
    assert.equal(dialog.querySelector('[data-profile-share-link]').href, url);
    assert.ok(dialog.querySelector('[data-profile-copy]'));
    assert.ok(dialog.querySelector('[data-profile-card-download]'));
    assert.deepEqual(encoded, [url]);
    dialog.querySelector('[data-profile-copy]').click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    assert.deepEqual(copied, [url]);
  } finally {
    globalThis.qrcode = oldEncoder;
    globalThis.document = oldDocument;
    dom.window.HTMLDialogElement.prototype.showModal = oldShowModal;
    dom.window.close();
  }
});

test('share-card download retries loading after the QR module fails', async () => {
  const dom = new JSDOM('<!doctype html>');
  const oldDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const view = renderPublicProfileView({ profile, isOwner: false, shareAllowed: true });
  dom.window.document.body.append(view);
  const downloads = [];
  let loadAttempts = 0;
  const loggedErrors = [];
  const oldConsoleError = console.error;
  const shareModule = {
    renderProfileQr: ({ target }) => { target.textContent = 'QR ready'; },
    downloadProfileCard: (options) => downloads.push(options)
  };
  console.error = (...args) => loggedErrors.push(args);
  dom.window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  try {
    bindPublicProfileActions({
      root: view,
      handle,
      profile,
      profileUrl: url,
      shareAllowed: true,
      isSignedIn: false,
      loadShareModule: async () => {
        loadAttempts += 1;
        if (loadAttempts === 1) throw new Error('module unavailable');
        return shareModule;
      }
    });

    view.querySelector('[data-profile-share]').click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    const dialog = view.querySelector('[data-profile-share-dialog]');
    assert.match(dialog.querySelector('[data-profile-share-status]').textContent, /could not create the QR code/i);
    dialog.querySelector('[data-profile-card-download]').click();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));

    assert.equal(loadAttempts, 2);
    assert.deepEqual(downloads, [{ profile, url }]);
    assert.match(loggedErrors[0][1].message, /module unavailable/);
    assert.match(dialog.querySelector('[data-profile-share-status]').textContent, /downloaded/i);
  } finally {
    console.error = oldConsoleError;
    globalThis.document = oldDocument;
    dom.window.close();
  }
});

test('share card contains only visible identity and badges in a safe SVG download', async () => {
  const dom = new JSDOM('<!doctype html>');
  const sensitiveProfile = {
    ...profile,
    nickname: '<Logic & Learner>',
    realName: 'Private Real Name',
    email: 'learner@example.test',
    sections: { badges: profile.sections.badges, stats: null }
  };
  const oldDocument = globalThis.document;
  const oldEncoder = globalThis.qrcode;
  const oldCreateObjectURL = URL.createObjectURL;
  const oldRevokeObjectURL = URL.revokeObjectURL;
  const oldAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
  let downloadedBlob;
  let downloadedFilename;
  let qrPayload;
  try {
    globalThis.document = dom.window.document;
    globalThis.qrcode = () => ({
      addData: (payload) => { qrPayload = payload; },
      make: () => {},
      createSvgTag: () => `<svg data-qr-payload="${url}"></svg>`
    });
    URL.createObjectURL = (blob) => {
      downloadedBlob = blob;
      return 'blob:profile-card';
    };
    URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function click() {
      downloadedFilename = this.download;
    };

    await downloadProfileCard({ profile: sensitiveProfile, url });

    assert.equal(qrPayload, url);
    assert.equal(downloadedBlob.type, 'image/svg+xml');
    assert.match(downloadedFilename, /^profile-logic-learner\.svg$/);
    const svg = await downloadedBlob.text();
    assert.match(svg, /&lt;Logic &amp; Learner&gt;/);
    assert.match(svg, /Logic Apprentice/);
    assert.match(svg, /First Step/);
    assert.match(svg, /data-qr-payload=/);
    assert.doesNotMatch(svg, /Private Real Name|learner@example\.test|450|streak|lessonsCompleted/);
  } finally {
    globalThis.document = oldDocument;
    globalThis.qrcode = oldEncoder;
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
    dom.window.HTMLAnchorElement.prototype.click = oldAnchorClick;
    dom.window.close();
  }
});

test('public profile page loads the local QR asset before the application module', async () => {
  const html = await readFile(resolve(import.meta.dirname, '../pages/public-profile.html'), 'utf8');
  assert.match(html, /<script src="\.\.\/js\/vendor\/qrcode-generator\.js"><\/script>/);
  assert.ok(html.indexOf('qrcode-generator.js') < html.indexOf('type="module"'));
});

test('vendored QR asset creates a QR matrix from the exact profile link', async () => {
  const source = await readFile(resolve(import.meta.dirname, '../js/vendor/qrcode-generator.js'), 'utf8');
  const context = {};
  runInNewContext(source, context);
  const qr = context.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  assert.ok(qr.getModuleCount() >= 21);
  assert.match(svg, /<svg[^>]+viewBox=/);
  assert.match(source, /Licensed under the MIT license/);
});

test('share cards reject profile URLs containing extra identifiers', () => {
  assert.throws(() => downloadProfileCard({ profile, url: `${url}&email=learner%40example.test` }), /stable public profile/i);
  assert.throws(() => downloadProfileCard({ profile, url: 'https://example.test/pages/public-profile.html?handle=not-a-handle' }), /stable public profile/i);
});

for (const [name, fn] of tests) {
  await fn();
  console.log(`PASS ${name}`);
}

console.log(`All ${tests.length} profile share tests passed.`);
