import test from 'node:test';
import assert from 'node:assert/strict';
import { releasePointerFocus } from '../src/lib/focus.js';

function fakeEvent(detail) {
  let blurred = 0;
  return { detail, currentTarget: { blur: () => blurred++ }, blurred: () => blurred };
}

test('a mouse or touch click gives up focus', () => {
  const e = fakeEvent(1);
  releasePointerFocus(e);
  assert.equal(e.blurred(), 1);
});

test('keyboard activation (detail 0) keeps focus so Tab order is not reset', () => {
  const e = fakeEvent(0);
  releasePointerFocus(e);
  assert.equal(e.blurred(), 0);
});
