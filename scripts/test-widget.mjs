// Pure-logic tests for the lesson explorer and the local-time streak keys.
process.env.TZ = 'Asia/Manila';
import assert from 'node:assert/strict';
import { CASES, CONNECTIVES, announce, evaluateAll, noteFor } from '../js/core/connectives.mjs';
import { localDateKey, previousDateKey } from '../js/core/dates.mjs';
import { truthWidgetMarkup } from '../js/components/truth-widget.mjs';

const ids = ['not-p', 'not-q', 'and', 'or', 'implies', 'iff'];
const expected = { // [p, q] -> values in the order of `ids`
  'true,true': [false, false, true, true, true, true],
  'true,false': [false, true, false, true, false, false],
  'false,true': [true, false, false, true, true, false],
  'false,false': [true, true, false, false, true, true]
};
assert.deepEqual(CONNECTIVES.map((item) => item.id), ids);
assert.equal(CASES.length, 4);
for (const [p, q] of CASES) {
  assert.deepEqual(evaluateAll(p, q).map((item) => item.value), expected[`${p},${q}`], `case ${p},${q}`);
  assert.ok(noteFor(p, q).length > 20, 'every case has a teaching note');
}
assert.match(announce(true, false), /p → q is False/);
assert.match(announce(false, false), /p → q is True/);

const markup = truthWidgetMarkup();
for (const id of ids) assert.match(markup, new RegExp(`data-result="${id}"`));
assert.equal((markup.match(/<tr data-case=/g) || []).length, 4);
assert.match(markup, /aria-pressed="true"/);
assert.match(markup, /role="status"/);

// 17:30 UTC on 11 Nov is 01:30 on 12 Nov in Manila. UTC keys would still say the 11th.
const lateEvening = new Date('2026-11-11T17:30:00Z');
assert.equal(localDateKey(lateEvening), '2026-11-12');
assert.equal(previousDateKey(lateEvening), '2026-11-11');
assert.equal(previousDateKey(new Date('2026-03-01T04:00:00Z')), '2026-02-28');
assert.equal(previousDateKey(new Date('2027-01-01T04:00:00Z')), '2026-12-31');

console.log('Widget and date helper tests passed.');
