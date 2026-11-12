// Pure logic for the lesson "truth-table explorer". No DOM here, so it is unit-tested in Node.

export const CONNECTIVES = [
  { id: 'not-p', symbol: '¬p', meaning: 'not p', evaluate: (p) => !p },
  { id: 'not-q', symbol: '¬q', meaning: 'not q', evaluate: (_p, q) => !q },
  { id: 'and', symbol: 'p ∧ q', meaning: 'p and q', evaluate: (p, q) => p && q },
  { id: 'or', symbol: 'p ∨ q', meaning: 'p or q (or both)', evaluate: (p, q) => p || q },
  { id: 'implies', symbol: 'p → q', meaning: 'if p then q', evaluate: (p, q) => !p || q },
  { id: 'iff', symbol: 'p ↔ q', meaning: 'p exactly when q', evaluate: (p, q) => p === q }
];

/** The four possible (p, q) cases in the order a truth table lists them. */
export const CASES = [[true, true], [true, false], [false, true], [false, false]];

const NOTES = {
  'true,true': 'Both are true, so p ∧ q, p ∨ q, p → q and p ↔ q are all true.',
  'true,false': 'This is the one case where p → q is false: a true p that does not lead to a true q.',
  'false,true': 'p → q is still true when p is false. With nothing to break, the promise holds (vacuous truth).',
  'false,false': 'p → q is true again, and p ↔ q is true because p and q have the same value.'
};

export const truthWord = (value) => (value ? 'True' : 'False');

export function evaluateAll(p, q) {
  return CONNECTIVES.map(({ id, symbol, meaning, evaluate }) => ({ id, symbol, meaning, value: evaluate(p, q) }));
}

export function noteFor(p, q) {
  return NOTES[`${Boolean(p)},${Boolean(q)}`];
}

export function announce(p, q) {
  const implication = evaluateAll(p, q).find((item) => item.id === 'implies');
  return `p is ${truthWord(p)} and q is ${truthWord(q)}. p → q is ${truthWord(implication.value)}.`;
}
