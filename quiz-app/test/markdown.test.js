import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock, renderInline } from '../src/lib/markdown.js';

test('fenced code renders through the highlighter', () => {
  const html = renderBlock('```js\nconst a = 1;\n```');
  assert.ok(html.includes('<pre><code class="lang-js"><span class="hl-k">const</span> a = <span class="hl-n">1</span>;'));
});

test('inline markdown renders without a paragraph wrapper', () => {
  assert.equal(renderInline('`x` and **y**'), '<code>x</code> and <strong>y</strong>');
});
