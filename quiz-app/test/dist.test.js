import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collect } from '../src/lib/collect.js';
import { assertSingleScript } from '../src/lib/embed.js';

const BOOKS_DIR = fileURLToPath(new URL('../../interview-topics', import.meta.url));
const html = readFileSync(new URL('../quiz.html', import.meta.url), 'utf8');

// The built page carries the data as JSON.parse("<escaped json>"). Find that literal, evaluate it as a JS
// string exactly like the browser would, and parse it.
function embeddedQuestions() {
  const literal = /JSON\.parse\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;
  for (const m of html.matchAll(literal)) {
    const text = new Function('return ' + m[1])();
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0 && typeof data[0].id === 'string') return data;
    } catch {
      // not the question payload
    }
  }
  throw new Error('embedded question data not found in quiz.html');
}

test('quiz.html is one self-contained page whose script cannot be cut short', () => {
  assertSingleScript(html);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=/i);
  assert.doesNotMatch(html, /<link[^>]*rel=["']?(stylesheet|modulepreload)/i);
});

test('quiz.html embeds exactly the questions the books produce', () => {
  const { questions } = collect(BOOKS_DIR);
  assert.ok(questions.length > 0);
  assert.deepEqual(embeddedQuestions(), questions);
});
