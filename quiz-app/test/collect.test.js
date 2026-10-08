import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect } from '../src/lib/collect.js';

test('collect parses every md file, builds unique ids, fails loudly on bad input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-'));
  try {
    assert.throws(() => collect(dir), /No \.md files/);
    writeFileSync(
      join(dir, 'javascript-explained-ebook.md'),
      '### Q1.\n```js\na()\n```\nOne.\n\n### Q2.\n```js\nb()\n```\nTwo.\n'
    );
    const { questions, counts } = collect(dir);
    assert.equal(questions.length, 2);
    assert.notEqual(questions[0].id, questions[1].id); // same question text, different prompt
    assert.equal(questions[0].book, 'JavaScript');
    assert.equal(questions[0].prompt, '```js\na()\n```');
    assert.deepEqual(counts, { JavaScript: 2 });
    writeFileSync(join(dir, 'empty.md'), '# nothing');
    assert.throws(() => collect(dir), /No questions found in empty\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
