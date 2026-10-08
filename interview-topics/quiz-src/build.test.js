'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collect, renderHtml } = require('../build-quiz');

const TEMPLATE =
  '<script>/*__MARKED__*/</script><script>/*__DECK__*/</script><script>const DATA = /*__DATA__*/[];</script>';

test('renderHtml embeds data safely (</script>, $ patterns, U+2028)', () => {
  const questions = [
    {
      id: 't-1',
      book: 'T',
      part: '',
      question: 'Q $& </script> \u2028?',
      prompt: '```html\n<script>x()</script>\n```',
      answer: 'A </script><script>alert(1)</script> $1 $` $$ <!-- x',
    },
  ];
  const html = renderHtml({ questions, template: TEMPLATE, markedSrc: 'var marked={};', deckSrc: 'var deck=1;' });
  assert.equal((html.match(/<\/script/gi) || []).length, 3);
  const json = html.match(/const DATA = (.*);<\/script>/s)[1];
  assert.deepEqual(JSON.parse(json), questions);
});

test('renderHtml neutralises </script inside inlined sources and fails loudly on a missing slot', () => {
  const html = renderHtml({ questions: [], template: TEMPLATE, markedSrc: 'var s="</SCRIPT>";', deckSrc: '' });
  assert.ok(html.includes('var s="<\\/SCRIPT>";'));
  assert.equal((html.match(/<\/script/gi) || []).length, 3);
  assert.throws(
    () => renderHtml({ questions: [], template: '<p>no slots</p>', markedSrc: '', deckSrc: '' }),
    /template missing slot/
  );
});

test('collect parses every md file, builds unique ids, fails loudly on bad input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-'));
  try {
    assert.throws(() => collect(dir), /No \.md files/);
    fs.writeFileSync(
      path.join(dir, 'javascript-explained-ebook.md'),
      '### Q1.\n```js\na()\n```\nOne.\n\n### Q2.\n```js\nb()\n```\nTwo.\n'
    );
    const { questions, counts } = collect(dir);
    assert.equal(questions.length, 2);
    assert.notEqual(questions[0].id, questions[1].id); // same question text, different prompt
    assert.equal(questions[0].book, 'JavaScript');
    assert.equal(questions[0].prompt, '```js\na()\n```');
    assert.deepEqual(counts, { JavaScript: 2 });
    fs.writeFileSync(path.join(dir, 'empty.md'), '# nothing');
    assert.throws(() => collect(dir), /No questions found in empty\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
