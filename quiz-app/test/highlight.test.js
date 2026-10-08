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

test('unknown languages are only escaped', () => {
  assert.equal(highlight('<a href="x">', 'html'), '&lt;a href="x"&gt;');
});
