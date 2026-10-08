'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./deck');

const Q = [
  { id: 'a1', book: 'CSS', part: 'P1' },
  { id: 'a2', book: 'CSS', part: 'P2' },
  { id: 'b1', book: 'React', part: 'P1' },
];

test('filterQuestions: empty book set means all, part narrows, no match is empty', () => {
  assert.equal(D.filterQuestions(Q, new Set(), '').length, 3);
  assert.deepEqual(D.filterQuestions(Q, new Set(['CSS']), '').map((q) => q.id), ['a1', 'a2']);
  assert.deepEqual(D.filterQuestions(Q, new Set(['CSS']), 'P2').map((q) => q.id), ['a2']);
  assert.deepEqual(D.filterQuestions(Q, new Set(['Vue']), ''), []);
});

test('shuffle returns a permutation, leaves input alone, is deterministic with rand', () => {
  const input = [1, 2, 3, 4, 5];
  assert.deepEqual(D.shuffle(input, () => 0), [2, 3, 4, 5, 1]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual(D.shuffle(input).slice().sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(D.shuffle([], () => 0), []);
});

test('buildDeck: browse keeps order, shuffle keeps the same ids', () => {
  const opts = { books: new Set(), part: '' };
  assert.deepEqual(D.buildDeck(Q, { ...opts, mode: 'browse' }), ['a1', 'a2', 'b1']);
  assert.deepEqual(D.buildDeck(Q, { ...opts, mode: 'shuffle' }).sort(), ['a1', 'a2', 'b1']);
  assert.deepEqual(D.buildDeck(Q, { books: new Set(['Vue']), part: '', mode: 'shuffle' }), []);
});

test('requeue inserts 5-9 slots ahead and clamps to the end of a short deck', () => {
  const short = ['a', 'b', 'c'];
  assert.deepEqual(D.requeue(short, 0, 'a', () => 0), ['a', 'b', 'c', 'a']);
  assert.deepEqual(D.requeue(['only'], 0, 'only', () => 0.99), ['only', 'only']);
  const long = Array.from({ length: 20 }, (_, i) => 'q' + i);
  const out = D.requeue(long, 2, 'q2', () => 0);
  assert.equal(out.length, 21);
  assert.equal(out[7], 'q2');
  assert.equal(long.length, 20);
});

test('markProgress moves an id between got and review', () => {
  let p = D.emptyProgress();
  p = D.markProgress(p, 'x', 'review');
  assert.deepEqual(p.review, ['x']);
  p = D.markProgress(p, 'x', 'got');
  assert.deepEqual(p, { got: ['x'], review: [], seen: [] });
  p = D.markProgress(p, 'x', 'got');
  assert.deepEqual(p.got, ['x']);
});

test('markSeen is idempotent and does not mutate', () => {
  const p0 = D.emptyProgress();
  const p1 = D.markSeen(p0, 'x');
  const p2 = D.markSeen(p1, 'x');
  assert.deepEqual(p0.seen, []);
  assert.deepEqual(p2.seen, ['x']);
});
