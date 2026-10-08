import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collect } from '../src/lib/collect.js';

const BOOKS_DIR = fileURLToPath(new URL('../../interview-topics', import.meta.url));
const html = readFileSync(new URL('../quiz.html', import.meta.url), 'utf8');

test('quiz.html is one self-contained page whose script cannot be cut short', () => {
  assert.equal((html.match(/<script\b/gi) || []).length, 1, 'exactly one <script');
  assert.equal((html.match(/<\/script/gi) || []).length, 1, 'exactly one </script');
  assert.doesNotMatch(html, /<script[^>]*\bsrc=/i);
  assert.doesNotMatch(html, /<link[^>]*rel=["']?(stylesheet|modulepreload)/i);
});

test('quiz.html embeds every question from the books', () => {
  const { questions } = collect(BOOKS_DIR);
  assert.equal(questions.length, 663);
  assert.deepEqual(questions.filter((q) => !html.includes(q.id)).map((q) => q.id), []);
});
