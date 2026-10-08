import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_KEY, loadProgress, saveProgress } from '../src/lib/storage.js';
import { emptyProgress } from '../src/lib/deck.js';

function fakeStorage(initial) {
  const map = new Map(initial === undefined ? [] : [[STORE_KEY, initial]]);
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test('progress round-trips through storage under the old key', () => {
  const s = fakeStorage();
  const p = { got: ['a'], review: [], seen: ['a', 'b'] };
  saveProgress(p, () => s);
  assert.equal(STORE_KEY, 'interviewQuiz.progress.v1');
  assert.deepEqual(loadProgress(() => s), p);
});

test('corrupt JSON loads as empty progress', () => {
  assert.deepEqual(loadProgress(() => fakeStorage('{bad')), emptyProgress());
});

test('wrong shapes keep only string ids', () => {
  assert.deepEqual(loadProgress(() => fakeStorage('{"got":5,"review":["r",1],"seen":null}')), { got: [], review: ['r'], seen: [] });
  assert.deepEqual(loadProgress(() => fakeStorage('null')), emptyProgress());
});

test('blocked storage never throws', () => {
  const blocked = () => {
    throw new Error('blocked');
  };
  assert.deepEqual(loadProgress(blocked), emptyProgress());
  assert.doesNotThrow(() => saveProgress(emptyProgress(), blocked));
});
