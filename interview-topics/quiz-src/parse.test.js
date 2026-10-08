'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFile, parseQuestionHeadings, parseNumberedSections } = require('./parse');

const md = (...lines) => lines.join('\n');

test('extracts H2 questions with part and answer', () => {
  const src = md(
    '# Book', '', '# Part 1 — Basics', '',
    '## Q1. What is X?', '', 'X is a thing.', '',
    '## Q2: What is Y?', '', 'Y is another.', '',
    '# Part 2 — Advanced', '',
    '## Q3. What is Z?', '', 'Z.'
  );
  assert.deepEqual(parseQuestionHeadings(src), [
    { question: 'What is X?', part: 'Part 1 — Basics', prompt: '', answer: 'X is a thing.' },
    { question: 'What is Y?', part: 'Part 1 — Basics', prompt: '', answer: 'Y is another.' },
    { question: 'What is Z?', part: 'Part 2 — Advanced', prompt: '', answer: 'Z.' },
  ]);
});

test('H3 questions keep deeper subsections, stop at next H3/H2, use H2 as part', () => {
  const src = md(
    '## 0. Warm-up', '',
    '### Q1. Intro?', '', 'Say hi.', '', '#### Detail', '', 'More.', '',
    '### Q2. Next?', '', 'Next answer.', '',
    '## 1. JS', '',
    '### Q1. Closures?', '', 'Remembering scope.'
  );
  const got = parseQuestionHeadings(src);
  assert.equal(got.length, 3);
  assert.equal(got[0].part, '0. Warm-up');
  assert.equal(got[0].answer, 'Say hi.\n\n#### Detail\n\nMore.');
  assert.equal(got[1].answer, 'Next answer.');
  assert.equal(got[2].part, '1. JS');
});

test('ignores headings inside fenced code blocks', () => {
  const src = md(
    '# Part 1 — Ops', '',
    '## Q1. How to build?', '',
    '```dockerfile', '# build stage', 'FROM node', '## Q99. Not a question', '```', '',
    'After the fence.', '',
    '## Q2. Next?', '', 'Done.'
  );
  const got = parseQuestionHeadings(src);
  assert.deepEqual(got.map((q) => q.question), ['How to build?', 'Next?']);
  assert.match(got[0].answer, /# build stage/);
  assert.match(got[0].answer, /After the fence\./);
  assert.equal(got[1].part, 'Part 1 — Ops');
});

test('a longer fence is not closed by a shorter inner fence', () => {
  const src = md(
    '## Q1. Markdown example?', '',
    '````md', '```js', '# not a heading', '```', '## Q9. still inside', '````', '',
    '## Q2. Next?', '', 'ok'
  );
  const got = parseQuestionHeadings(src);
  assert.deepEqual(got.map((q) => q.question), ['Markdown example?', 'Next?']);
});

test('handles CRLF line endings', () => {
  const src = md('## Q1. A?', '', 'Answer A.', '', '## Q2. B?', '', 'Answer B.').replace(/\n/g, '\r\n');
  const got = parseQuestionHeadings(src);
  assert.deepEqual(got.map((q) => q.answer), ['Answer A.', 'Answer B.']);
  assert.deepEqual(got.map((q) => q.question), ['A?', 'B?']);
});

test('strips trailing horizontal rules from answers', () => {
  const src = md('## Q1. A?', '', 'Answer.', '', '---', '', '# Part 2 — More', '', '## Q2. B?', '', 'B.');
  assert.equal(parseQuestionHeadings(src)[0].answer, 'Answer.');
});

test('keeps # inside heading text', () => {
  const src = md('## 2. C# basics', '', '## Q1. What is C#?', '', 'A language.');
  const got = parseQuestionHeadings(src);
  assert.equal(got[0].question, 'What is C#?');
  assert.equal(got[0].part, '2. C# basics');
});

test('untitled puzzle headings use the leading code block(s) as the prompt', () => {
  const src = md(
    '# Section 9 — Puzzles', '',
    '### Q61.', '```js', 'console.log(typeof typeof 1);', '```', '**`"string"`.** Inner typeof gives "number".', '', '---', '',
    '### Q62.', '```js', 'a()', '```', '', '```js', 'b()', '```', 'Two blocks.'
  );
  assert.deepEqual(parseQuestionHeadings(src), [
    {
      question: 'What does this code output?',
      part: 'Section 9 — Puzzles',
      prompt: '```js\nconsole.log(typeof typeof 1);\n```',
      answer: '**`"string"`.** Inner typeof gives "number".',
    },
    {
      question: 'What does this code output?',
      part: 'Section 9 — Puzzles',
      prompt: '```js\na()\n```\n\n```js\nb()\n```',
      answer: 'Two blocks.',
    },
  ]);
});

test('<details> answer blocks split into prompt and answer; <details> inside code is ignored', () => {
  const src = md(
    '## Q54. Which color is the text?', '',
    '```css', '.lead { color: green !important; }', '```', '',
    '<details><summary>Answer</summary>', '', 'Green. `!important` wins.', '</details>', '', '---', '',
    '## Q55. What does the details element do?', '',
    'It makes a disclosure widget:', '',
    '```html', '<details><summary>Answer</summary>', '</details>', '```', '',
    'Native, no JS.'
  );
  const got = parseQuestionHeadings(src);
  assert.deepEqual(got[0], {
    question: 'Which color is the text?',
    part: '',
    prompt: '```css\n.lead { color: green !important; }\n```',
    answer: 'Green. `!important` wins.',
  });
  assert.equal(got[1].prompt, '');
  assert.match(got[1].answer, /^It makes a disclosure widget:/);
  assert.match(got[1].answer, /Native, no JS\.$/);
});

test('extracts bold numbered prompts, quoted bullets and Question/Answer tables outside Q sections', () => {
  const src = md(
    '# Part 1 — Basics', '',
    '## Q1. A?', '', 'One.', '', '| Question | Answer |', '|---|---|', '| inside a Q answer | ignored |', '',
    '# Part 4 — Design', '',
    '## Design prompts', '', 'Intro sentence.', '',
    '**1. Design a URL shortener.**', 'Key generation and caching.', '',
    '**2. Design a notification service.**', 'Channels and retries.', '',
    '## Behavioural', '', '- **"Tell me about an incident."** What broke and what changed.', '',
    '# Part 5 — Rapid-fire', '',
    '## Rapid-fire', '', '| Question | Answer |', '|---|---|', '| Default status for `@Post()`? | 201 |', '| Guards or pipes first? | Guards |', '',
    '## A 7-day prep plan', '', '**1. Day one.**', 'Not a question.'
  );
  assert.deepEqual(parseQuestionHeadings(src).map((q) => [q.part, q.question, q.answer]), [
    ['Part 1 — Basics', 'A?', 'One.\n\n| Question | Answer |\n|---|---|\n| inside a Q answer | ignored |'],
    ['Part 4 — Design', 'Design a URL shortener', 'Key generation and caching.'],
    ['Part 4 — Design', 'Design a notification service', 'Channels and retries.'],
    ['Part 4 — Design', 'Tell me about an incident.', 'What broke and what changed.'],
    ['Part 5 — Rapid-fire', 'Default status for `@Post()`?', '201'],
    ['Part 5 — Rapid-fire', 'Guards or pipes first?', 'Guards'],
  ]);
});

test('numbered sections: topics, design problems, rapid-fire, skipped sections', () => {
  const src = md(
    '# PART I — THE METHOD', '',
    '## Table of Contents', '', '- stuff', '',
    '## 1. The RADIO framework', '', 'Requirements first.', '', '### Sub', '', 'Detail.', '',
    '# PART III — THE QUESTION BANK', '',
    '## 17. Design a News Feed (Facebook / Twitter)', '', 'Feed answer.', '',
    '## 41. Thirty rapid-fire questions with condensed answers', '',
    '1. **CSR vs SSR?** SSR for SEO.',
    '2. **Debounce vs throttle?** Debounce waits for quiet.',
    '   Throttle caps the rate.', '',
    '## 42. Cheat sheets', '', 'table'
  );
  assert.deepEqual(parseNumberedSections(src), [
    { question: 'Explain: The RADIO framework', part: 'PART I — THE METHOD', prompt: '', answer: 'Requirements first.\n\n### Sub\n\nDetail.' },
    { question: 'Design a News Feed (Facebook / Twitter)', part: 'PART III — THE QUESTION BANK', prompt: '', answer: 'Feed answer.' },
    { question: 'CSR vs SSR?', part: 'PART III — THE QUESTION BANK', prompt: '', answer: 'SSR for SEO.' },
    { question: 'Debounce vs throttle?', part: 'PART III — THE QUESTION BANK', prompt: '', answer: 'Debounce waits for quiet.\n   Throttle caps the rate.' },
  ]);
});

test('extras ignore question markers inside fenced code in Q-less sections', () => {
  const src = md(
    '# Part 4 — Design', '',
    '## Notes', '',
    '**1. Real prompt.**', 'Real answer.', '',
    '```md', '| Question | Answer |', '|---|---|', '| fake q | fake a |', '**2. Fake numbered.**', '- **"Fake quote"** x', '```', ''
  );
  const got = parseQuestionHeadings(src);
  assert.deepEqual(got.map((q) => q.question), ['Real prompt']);
  assert.match(got[0].answer, /^Real answer\./);
  assert.match(got[0].answer, /\*\*2\. Fake numbered\.\*\*/);
});

test('rapid-fire items keep blank lines and fenced code; markers inside fences are not items', () => {
  const src = md(
    '## 41. Rapid-fire questions', '',
    '1. **Real?** Yes.', '   Second line.', '', '   Second paragraph.',
    '```js', '1. **Fake?** no', '', 'const a = 1;', '```',
    '2. **Next?** ok'
  );
  assert.deepEqual(parseNumberedSections(src), [
    {
      question: 'Real?',
      part: '',
      prompt: '',
      answer: 'Yes.\n   Second line.\n\n   Second paragraph.\n```js\n1. **Fake?** no\n\nconst a = 1;\n```',
    },
    { question: 'Next?', part: '', prompt: '', answer: 'ok' },
  ]);
});

test('parseFile falls back to numbered sections and throws when nothing is found', () => {
  assert.equal(parseFile(md('## 1. Topic', '', 'Body.'), 'x.md').length, 1);
  assert.throws(() => parseFile('# Just a title\n\nprose', 'empty.md'), /No questions found in empty\.md/);
});
