import test from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../src/lib/highlight.js';

test('js: keywords, strings and comments are wrapped, HTML is escaped', () => {
  assert.equal(
    highlight('const s = "<b>"; // done', 'js'),
    '<span class="hl-k">const</span> s = <span class="hl-s">"&lt;b&gt;"</span>; <span class="hl-c">// done</span>'
  );
});

test('bash: # starts a comment and numbers are wrapped', () => {
  assert.equal(highlight('# note\nx=42', 'bash'), '<span class="hl-c"># note</span>\nx=<span class="hl-n">42</span>');
});

test('js: # is not a comment, so the rest of the line is still highlighted', () => {
  assert.equal(
    highlight('this.#count = "x"', 'js'),
    '<span class="hl-k">this</span>.#count = <span class="hl-s">"x"</span>'
  );
});

test('bash: // is not a comment, so a URL does not swallow the line', () => {
  assert.equal(highlight('curl http://host 3', 'bash'), 'curl http://host <span class="hl-n">3</span>');
});

test('unknown languages are only escaped', () => {
  assert.equal(highlight('<a href="x">', 'html'), '&lt;a href="x"&gt;');
});
