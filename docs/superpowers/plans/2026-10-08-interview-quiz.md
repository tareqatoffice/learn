# Interview Quiz Page Implementation Plan

> **Superseded — historical record.** Executed on `feat/interview-quiz` (commits `26cd625`..`53fbfc1`). The files it created under `interview-topics/` are moved or deleted by `2026-10-08-quiz-app-svelte.md`; do not execute this plan again.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One offline `interview-topics/quiz.html` that quizzes the user on every Q&A in the `interview-topics/*.md` books, as a random mix or filtered by book (and part).

**Architecture:** `build-quiz.js` (plain Node) parses every `.md` into `{id, book, part, question, prompt, answer}` records using a tested `parse.js`, then injects the records, the pinned `marked` markdown renderer, and a tested pure `deck.js` (filter / shuffle / requeue / progress helpers) into `quiz-src/template.html`, writing a self-contained `quiz.html`. The page UI is plain DOM JS on top of those helpers; progress lives in `localStorage`.

**Tech Stack:** Node 24 (built-in `node:test`, no npm dependencies), vanilla HTML/CSS/JS, `marked@12.0.2` vendored as a single file.

**Spec:** `docs/superpowers/specs/2026-10-08-interview-quiz-design.md`

## Global Constraints

- All work happens under `C:\Users\Tareq-PC\Development\learn\interview-topics\` (`quiz.html` and `build-quiz.js` sit directly in it, per spec "Location"). Supporting source lives in `interview-topics/quiz-src/`.
- No npm dependencies; Node built-ins only. Tests use `node:test` + `node:assert/strict`.
- `quiz.html` must work offline by double-click: no external fonts, scripts, or stylesheets (system font stacks).
- `localStorage` access is always wrapped in try/catch; the page works without it.
- Record shape is exactly `{ id, book, part, question, prompt, answer }` (strings; `part` and `prompt` may be `''`).
- Expected counts (spec): CSS 61, Frontend Interview 117, Frontend System Design 70, HTML 64, JavaScript 72, NestJS 94, Next.js 53, Node.js 66, React 66 — total 663.
- Out of scope (spec YAGNI): search, timers, score history, editing questions in the browser.
- Run all commands from the repo root `C:\Users\Tareq-PC\Development\learn`.
- Work on a branch `feat/interview-quiz` (repo is on `main`). Commit messages end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Markdown inside fenced code (`# build stage`, a `## Q99.` or a `<details><summary>Answer</summary>` example inside a fence; the HTML book teaches `<details>`) must not split answers, create parts, create questions, or create prompts. Pinned in Task 1.
- Windows CRLF line endings (8 of the 9 books use them) must parse identically. Pinned in Task 1.
- Answers containing `</script>` (the HTML book has 8), `$&`, `` $` ``, or U+2028, and a vendored script containing `</script`, must embed without breaking the page or corrupting text. Pinned in Task 3.
- A "Review again" on the last card and a finished deck must not crash or loop; a filter with no questions shows an empty state. Pinned in Task 2; shown in Task 4.
- Corrupt or blocked `localStorage` must not break the page. Verified in Task 4.

---

### Task 1: Markdown parser

**Files:**
- Create: `interview-topics/quiz-src/parse.js`
- Test: `interview-topics/quiz-src/parse.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (record = `{question: string, part: string, prompt: string, answer: string}`):
  - `parseQuestionHeadings(md: string): Record[]` — Q headings (with `<details>` and untitled-puzzle handling) plus extras outside Q sections.
  - `parseNumberedSections(md: string): Record[]` — fallback for books without Q headings.
  - `parseFile(md: string, fileName: string): Record[]` — tries Q headings, falls back to numbered sections, throws `Error("No questions found in <fileName>")` if both are empty.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/interview-quiz
```

- [ ] **Step 2: Write the failing tests**

Create `interview-topics/quiz-src/parse.test.js`:

```js
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

test('parseFile falls back to numbered sections and throws when nothing is found', () => {
  assert.equal(parseFile(md('## 1. Topic', '', 'Body.'), 'x.md').length, 1);
  assert.throws(() => parseFile('# Just a title\n\nprose', 'empty.md'), /No questions found in empty\.md/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test interview-topics/quiz-src/parse.test.js`
Expected: FAIL — `Cannot find module './parse'`.

- [ ] **Step 4: Write the implementation**

Create `interview-topics/quiz-src/parse.js`:

```js
'use strict';

// Parses the interview md books into question records. Pure functions, no I/O.
// Record: { question, part, prompt, answer } — prompt is markdown shown with the
// question before the answer is revealed ('' when there is none).

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const PART = /^(part|section)\b/i;
const Q_HEAD = /^Q\d+[.:]\s*(.*)$/;
const SKIP_SECTION = /table of contents|cheat sheets?|preparation plan|prep plan|self-scoring|final advice/i;
const RAPID_FIRE = /rapid-fire/i;
const PUZZLE_QUESTION = 'What does this code output?';

// outside[i] is true when line i is plain markdown (not a fence marker, not inside a fence).
function fenceMask(lines) {
  const outside = [];
  let fence = null;
  for (const line of lines) {
    const f = line.match(FENCE);
    if (f && !fence) {
      fence = f[1];
      outside.push(false);
    } else if (f && f[1][0] === fence[0] && f[1].length >= fence.length && f[2].trim() === '') {
      fence = null;
      outside.push(false);
    } else {
      outside.push(!fence);
    }
  }
  return outside;
}

function scanHeadings(lines) {
  const outside = fenceMask(lines);
  const headings = [];
  lines.forEach((line, i) => {
    if (!outside[i]) return;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) headings.push({ line: i, level: m[1].length, text: m[2].trim() });
  });
  return headings;
}

function cleanAnswer(text) {
  let t = text.trim();
  let prev;
  do {
    prev = t;
    t = t.replace(/(^|\n)---$/, '').trim();
  } while (t !== prev);
  return t;
}

// Line where the body of heading #idx ends: the next heading of the same or higher level.
function bodyEnd(lines, headings, idx) {
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j].level <= headings[idx].level) return headings[j].line;
  }
  return lines.length;
}

function sliceAnswer(lines, headings, idx) {
  return cleanAnswer(lines.slice(headings[idx].line + 1, bodyEnd(lines, headings, idx)).join('\n'));
}

// "Predict the result" questions: snippet first, then <details><summary>Answer</summary> … </details>.
function splitDetails(body) {
  const lines = body.split('\n');
  const outside = fenceMask(lines);
  const open = lines.findIndex((l, i) => outside[i] && /^\s*<details>\s*<summary>\s*answer\s*<\/summary>\s*$/i.test(l));
  if (open === -1) return null;
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) {
    if (outside[i] && /^\s*<\/details>\s*$/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) return null;
  return {
    prompt: cleanAnswer(lines.slice(0, open).join('\n')),
    answer: cleanAnswer(lines.slice(open + 1, close).concat(lines.slice(close + 1)).join('\n')),
  };
}

// Untitled puzzles ("### Q61."): leading code block(s) are the question, the rest is the answer.
function splitLeadingCode(body) {
  const lines = body.split('\n');
  const outside = fenceMask(lines);
  let i = 0;
  let end = 0;
  while (i < lines.length) {
    if (outside[i] && !lines[i].trim()) {
      i++;
      continue;
    }
    if (outside[i]) break;
    while (i < lines.length && !outside[i]) i++;
    end = i;
  }
  return { prompt: cleanAnswer(lines.slice(0, end).join('\n')), answer: cleanAnswer(lines.slice(end).join('\n')) };
}

function questionRecord(title, part, body) {
  const details = splitDetails(body);
  if (title) return { question: title, part, prompt: details ? details.prompt : '', answer: details ? details.answer : body };
  const split = details || splitLeadingCode(body);
  return { question: PUZZLE_QUESTION, part, prompt: split.prompt, answer: split.answer };
}

// Question-like items in sections that are not Q headings: bold numbered prompts
// ("**1. Design a URL shortener.**" + answer lines), quoted bold bullets
// ("- **"Tell me about…"** answer"), and "| Question | Answer |" tables.
function sectionExtras(text, part) {
  const lines = text.split('\n');
  const out = [];
  let open = null;
  const flush = () => {
    if (open) out.push({ question: open.question, part, prompt: '', answer: cleanAnswer(open.lines.join('\n')) });
    open = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(/^\*\*\d+\.\s+(.+?)\.?\*\*\s*$/);
    if (m) {
      flush();
      open = { question: m[1].trim(), lines: [] };
      continue;
    }
    m = line.match(/^[-*]\s+\*\*"(.+?)"\*\*\s*(.*)$/);
    if (m) {
      flush();
      out.push({ question: m[1].trim(), part, prompt: '', answer: m[2].trim() });
      continue;
    }
    if (/^\|\s*(question|q)\s*\|\s*(answer|a)\s*\|\s*$/i.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      flush();
      let j = i + 2;
      for (; j < lines.length && /^\|.*\|\s*$/.test(lines[j]); j++) {
        const cells = lines[j].trim().slice(1, -1).split('|').map((c) => c.trim());
        out.push({ question: cells[0], part, prompt: '', answer: cells.slice(1).join(' | ') });
      }
      i = j - 1;
      continue;
    }
    if (open) open.lines.push(line);
  }
  flush();
  return out;
}

function parseQuestionHeadings(md) {
  const lines = md.split(/\r?\n/);
  const headings = scanHeadings(lines);
  const out = [];
  let part = null;
  let section = null;
  let insideQ = -1; // line where the current Q's body ends
  headings.forEach((h, i) => {
    const q = (h.level === 2 || h.level === 3) && h.text.match(Q_HEAD);
    if (q) {
      out.push(questionRecord(q[1].trim(), part || section || '', sliceAnswer(lines, headings, i)));
      insideQ = bodyEnd(lines, headings, i);
      return;
    }
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      section = null;
    } else if (h.level === 2) {
      section = h.text;
    }
    if (h.level >= 2 && h.line >= insideQ && !SKIP_SECTION.test(h.text)) {
      const next = i + 1 < headings.length ? headings[i + 1].line : lines.length;
      out.push(...sectionExtras(lines.slice(h.line + 1, next).join('\n'), part || section || ''));
    }
  });
  return out;
}

function splitRapidFire(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (m) items.push({ question: m[1].trim(), answer: m[2].trim() });
    else if (items.length && line.trim()) items[items.length - 1].answer += '\n' + line;
  }
  return items;
}

function parseNumberedSections(md) {
  const lines = md.split(/\r?\n/);
  const headings = scanHeadings(lines);
  const out = [];
  let part = '';
  headings.forEach((h, i) => {
    if (h.level === 1 && PART.test(h.text)) {
      part = h.text;
      return;
    }
    if (h.level !== 2) return;
    const m = h.text.match(/^(\d+)\.\s+(.+)$/);
    if (!m || SKIP_SECTION.test(m[2])) return;
    const title = m[2].trim();
    const answer = sliceAnswer(lines, headings, i);
    if (RAPID_FIRE.test(title)) {
      splitRapidFire(answer).forEach((r) => out.push({ question: r.question, part, prompt: '', answer: r.answer }));
      return;
    }
    out.push({ question: /^Design\b/i.test(title) ? title : `Explain: ${title}`, part, prompt: '', answer });
  });
  return out;
}

function parseFile(md, fileName) {
  const found = parseQuestionHeadings(md);
  const items = found.length ? found : parseNumberedSections(md);
  if (items.length === 0) throw new Error(`No questions found in ${fileName}`);
  return items;
}

module.exports = { parseFile, parseQuestionHeadings, parseNumberedSections };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test interview-topics/quiz-src/parse.test.js`
Expected: PASS — 12 tests, 0 failures.

- [ ] **Step 6: Check the real books**

Run:
```bash
node -e "const fs=require('fs');const {parseFile}=require('./interview-topics/quiz-src/parse');let t=0;for(const f of fs.readdirSync('interview-topics').filter(f=>f.endsWith('.md')).sort()){const q=parseFile(fs.readFileSync('interview-topics/'+f,'utf8'),f);t+=q.length;console.log(f,q.length,'prompts:',q.filter(x=>x.prompt).length)}console.log('TOTAL',t)"
```
Expected: css 61 (prompts 7), frontend-interview-bl 117 (0), frontend-system-design 70 (0), html 64 (6), javascript 72 (12), nestjs 94 (0), nextjs 53 (7), nodejs 66 (6), react 66 (7); TOTAL 663. Any mismatch is a parser bug: add a failing test reproducing it before changing `parse.js`.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers interview-topics/quiz-src/parse.js interview-topics/quiz-src/parse.test.js
git commit -m "feat(quiz): parse interview md files into question records" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Deck and progress helpers

**Files:**
- Create: `interview-topics/quiz-src/deck.js`
- Test: `interview-topics/quiz-src/deck.test.js`

**Interfaces:**
- Consumes: question records `{id, book, part, ...}` (Task 1 shape after Task 3 adds `id`/`book`).
- Produces (all pure; `rand` is an optional `() => number in [0,1)`, default `Math.random`):
  - `filterQuestions(all, books: Set<string>, part: string): Question[]` — empty `books` = all books; empty `part` = all parts.
  - `shuffle<T>(arr: T[], rand?): T[]` — new array, input untouched.
  - `buildDeck(all, {books: Set<string>, part: string, mode: 'shuffle'|'browse'}, rand?): string[]` — ids.
  - `requeue(deck: string[], pos: number, id: string, rand?): string[]` — new deck with `id` inserted `5..9` slots after `pos`, clamped to the end.
  - `emptyProgress(): {got: string[], review: string[], seen: string[]}`
  - `markProgress(p, id, kind: 'got'|'review')` — adds to `kind`, removes from the other list; returns new object.
  - `markSeen(p, id)` — idempotent add to `seen`; returns new object.
- In the browser these are global functions; in Node they come from `module.exports`.

- [ ] **Step 1: Write the failing tests**

Create `interview-topics/quiz-src/deck.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./deck');

const Q = [
  { id: 'a1', book: 'CSS', part: 'P1' },
  { id: 'a2', book: 'CSS', part: 'P2' },
  { id: 'b1', book: 'React', part: 'P1' },
];

test('filterQuestions: empty book set means all, part narrows, no match is empty', () => {
  assert.equal(D.filterQuestions(Q, new Set(), '').length, 3);
  assert.deepEqual(D.filterQuestions(Q, new Set(['CSS']), '').map((q) => q.id), ['a1', 'a2']);
  assert.deepEqual(D.filterQuestions(Q, new Set(['CSS']), 'P2').map((q) => q.id), ['a2']);
  assert.deepEqual(D.filterQuestions(Q, new Set(['Vue']), ''), []);
});

test('shuffle returns a permutation, leaves input alone, is deterministic with rand', () => {
  const input = [1, 2, 3, 4, 5];
  assert.deepEqual(D.shuffle(input, () => 0), [2, 3, 4, 5, 1]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual(D.shuffle(input).slice().sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(D.shuffle([], () => 0), []);
});

test('buildDeck: browse keeps order, shuffle keeps the same ids', () => {
  const opts = { books: new Set(), part: '' };
  assert.deepEqual(D.buildDeck(Q, { ...opts, mode: 'browse' }), ['a1', 'a2', 'b1']);
  assert.deepEqual(D.buildDeck(Q, { ...opts, mode: 'shuffle' }).sort(), ['a1', 'a2', 'b1']);
  assert.deepEqual(D.buildDeck(Q, { books: new Set(['Vue']), part: '', mode: 'shuffle' }), []);
});

test('requeue inserts 5-9 slots ahead and clamps to the end of a short deck', () => {
  const short = ['a', 'b', 'c'];
  assert.deepEqual(D.requeue(short, 0, 'a', () => 0), ['a', 'b', 'c', 'a']);
  assert.deepEqual(D.requeue(['only'], 0, 'only', () => 0.99), ['only', 'only']);
  const long = Array.from({ length: 20 }, (_, i) => 'q' + i);
  const out = D.requeue(long, 2, 'q2', () => 0);
  assert.equal(out.length, 21);
  assert.equal(out[7], 'q2');
  assert.equal(long.length, 20);
});

test('markProgress moves an id between got and review', () => {
  let p = D.emptyProgress();
  p = D.markProgress(p, 'x', 'review');
  assert.deepEqual(p.review, ['x']);
  p = D.markProgress(p, 'x', 'got');
  assert.deepEqual(p, { got: ['x'], review: [], seen: [] });
  p = D.markProgress(p, 'x', 'got');
  assert.deepEqual(p.got, ['x']);
});

test('markSeen is idempotent and does not mutate', () => {
  const p0 = D.emptyProgress();
  const p1 = D.markSeen(p0, 'x');
  const p2 = D.markSeen(p1, 'x');
  assert.deepEqual(p0.seen, []);
  assert.deepEqual(p2.seen, ['x']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test interview-topics/quiz-src/deck.test.js`
Expected: FAIL — `Cannot find module './deck'`.

- [ ] **Step 3: Write the implementation**

Create `interview-topics/quiz-src/deck.js`:

```js
'use strict';

// Pure deck/progress helpers. Inlined into quiz.html by build-quiz.js (so top-level
// functions become globals in the page) and also loaded by node:test via module.exports.

function shuffle(arr, rand) {
  const r = rand || Math.random;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function filterQuestions(all, books, part) {
  return all.filter((q) => (books.size === 0 || books.has(q.book)) && (!part || q.part === part));
}

function buildDeck(all, opts, rand) {
  const ids = filterQuestions(all, opts.books, opts.part).map((q) => q.id);
  return opts.mode === 'shuffle' ? shuffle(ids, rand) : ids;
}

function requeue(deck, pos, id, rand) {
  const r = rand || Math.random;
  const at = Math.min(deck.length, pos + 1 + 4 + Math.floor(r() * 5));
  const out = deck.slice();
  out.splice(at, 0, id);
  return out;
}

function emptyProgress() {
  return { got: [], review: [], seen: [] };
}

function addUnique(arr, id) {
  return arr.includes(id) ? arr : arr.concat(id);
}

function markProgress(p, id, kind) {
  const other = kind === 'got' ? 'review' : 'got';
  const next = { got: p.got, review: p.review, seen: p.seen };
  next[kind] = addUnique(p[kind], id);
  next[other] = p[other].filter((x) => x !== id);
  return next;
}

function markSeen(p, id) {
  return { got: p.got, review: p.review, seen: addUnique(p.seen, id) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shuffle, filterQuestions, buildDeck, requeue, emptyProgress, markProgress, markSeen };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test interview-topics/quiz-src/deck.test.js`
Expected: PASS — 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add interview-topics/quiz-src/deck.js interview-topics/quiz-src/deck.test.js
git commit -m "feat(quiz): add deck filtering, shuffle, requeue and progress helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Build script and page template

**Files:**
- Create: `interview-topics/build-quiz.js`
- Create: `interview-topics/quiz-src/template.html`
- Create: `interview-topics/quiz-src/vendor/marked.min.js` (downloaded)
- Create (generated, committed): `interview-topics/quiz.html`
- Test: `interview-topics/quiz-src/build.test.js`

**Interfaces:**
- Consumes: `parseFile` (Task 1); `deck.js` source text (Task 2 — its functions are globals in the page).
- Produces:
  - `collect(dir: string): {questions: Question[], counts: Record<string, number>}` — reads every `*.md` in `dir`; `Question = {id, book, part, question, prompt, answer}`; throws on no files / empty file / zero questions (message includes the file name).
  - `renderHtml({questions, template, markedSrc, deckSrc}): string` — replaces slots `/*__MARKED__*/`, `/*__DECK__*/`, `/*__DATA__*/[]` in `template`; rewrites `</script` in inlined sources to `<\/script`; throws if a slot is missing.
  - CLI: `node interview-topics/build-quiz.js` writes `interview-topics/quiz.html` and prints per-book counts.

- [ ] **Step 1: Write the failing tests**

Create `interview-topics/quiz-src/build.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test interview-topics/quiz-src/build.test.js`
Expected: FAIL — `Cannot find module '../build-quiz'`.

- [ ] **Step 3: Write `build-quiz.js`**

Create `interview-topics/build-quiz.js`:

```js
#!/usr/bin/env node
'use strict';

// Builds quiz.html from every *.md in this folder.
// Usage: node interview-topics/build-quiz.js   (re-run after editing any md file)

const fs = require('node:fs');
const path = require('node:path');
const { parseFile } = require('./quiz-src/parse');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'quiz-src');
const OUT = path.join(ROOT, 'quiz.html');
const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js';

const BOOK_NAMES = {
  'css-questions-ebook.md': 'CSS',
  'frontend-interview-bl.md': 'Frontend Interview',
  'frontend-system-design-ebook.md': 'Frontend System Design',
  'html-questions-ebook.md': 'HTML',
  'javascript-explained-ebook.md': 'JavaScript',
  'nestjs-interview-guide.md': 'NestJS',
  'nextjs-questions-ebook.md': 'Next.js',
  'nodejs-questions-ebook.md': 'Node.js',
  'react-questions-ebook.md': 'React',
};

function bookName(file) {
  return (
    BOOK_NAMES[file] ||
    file.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function slug(file) {
  return file.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function collect(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  if (files.length === 0) throw new Error(`No .md files in ${dir}`);
  const used = new Set();
  const questions = [];
  const counts = {};
  for (const file of files) {
    const md = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!md.trim()) throw new Error(`Empty file: ${file}`);
    const book = bookName(file);
    const items = parseFile(md, file);
    counts[book] = items.length;
    for (const item of items) {
      const base = `${slug(file)}-${fnv1a(item.question + '\n' + item.prompt)}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      questions.push({ id, book, part: item.part, question: item.question, prompt: item.prompt, answer: item.answer });
    }
  }
  return { questions, counts };
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// "</script" would end the inline <script> early; "<\/script" means the same inside JS strings,
// regexes and comments.
function inlineScript(src) {
  return src.replace(/<\/(script)/gi, (m, word) => '<\\/' + word);
}

// split/join (not String.replace) so "$&" and friends in the data are never interpreted.
function renderHtml({ questions, template, markedSrc, deckSrc }) {
  const slots = [
    ['/*__MARKED__*/', inlineScript(markedSrc)],
    ['/*__DECK__*/', inlineScript(deckSrc)],
    ['/*__DATA__*/[]', safeJson(questions)], // last, so injected text is never re-scanned
  ];
  let html = template;
  for (const [slot, value] of slots) {
    if (!html.includes(slot)) throw new Error(`template missing slot ${slot}`);
    html = html.split(slot).join(value);
  }
  return html;
}

function main() {
  const markedPath = path.join(SRC, 'vendor', 'marked.min.js');
  if (!fs.existsSync(markedPath)) {
    throw new Error(`Missing ${markedPath}\nDownload it once:\n  curl -L -o "${markedPath}" ${MARKED_URL}`);
  }
  const { questions, counts } = collect(ROOT);
  const html = renderHtml({
    questions,
    template: fs.readFileSync(path.join(SRC, 'template.html'), 'utf8'),
    markedSrc: fs.readFileSync(markedPath, 'utf8'),
    deckSrc: fs.readFileSync(path.join(SRC, 'deck.js'), 'utf8'),
  });
  fs.writeFileSync(OUT, html);
  Object.entries(counts).forEach(([book, n]) => console.log(`${book.padEnd(24)} ${n}`));
  console.log(`${'TOTAL'.padEnd(24)} ${questions.length}`);
  console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
}

module.exports = { collect, renderHtml };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test interview-topics/quiz-src/build.test.js`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Download `marked` (ask the user first)**

This downloads a file. Before running it, tell the user: file `marked.min.js`, source `cdn.jsdelivr.net/npm/marked@12.0.2`, about 40 KB, and wait for a yes.

```bash
mkdir -p interview-topics/quiz-src/vendor
curl -L -o interview-topics/quiz-src/vendor/marked.min.js https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js
```

Verify: `node -e "const s=require('fs').readFileSync('interview-topics/quiz-src/vendor/marked.min.js','utf8'); console.log(s.length, s.slice(0, 80))"`
Expected: a length around 35000-50000 and a first line mentioning `marked v12.0.2` (not an HTML error page).

- [ ] **Step 6: Write the page template**

Create `interview-topics/quiz-src/template.html`. The three slots (`/*__MARKED__*/`, `/*__DECK__*/`, `/*__DATA__*/[]`) must each appear exactly once:

````html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Interview Quiz</title>
<style>
:root {
  --bg: #F3F5F8; --surface: #FFFFFF; --ink: #1B2230; --muted: #5A6475; --rule: #DCE1E8;
  --accent: #0E6A70; --accent-soft: #E1F0F0; --on-accent: #FFFFFF;
  --got: #2F7D4F; --got-soft: #E3F2E8; --review: #9A5A0C; --review-soft: #FBEEDB;
  --code-bg: #EEF1F5; --answer-bg: #F7FAFA;
  --hl-c: #6B7686; --hl-s: #0B7A4B; --hl-k: #8A3FB0; --hl-n: #B25E09;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12161D; --surface: #1A1F28; --ink: #E6E9EF; --muted: #9AA3B2; --rule: #2C333F;
    --accent: #5CC0C6; --accent-soft: #173235; --on-accent: #0B1A1C;
    --got: #6BC48D; --got-soft: #18301F; --review: #E6A65A; --review-soft: #33260F;
    --code-bg: #232A35; --answer-bg: #171C24;
    --hl-c: #8A94A5; --hl-s: #7FD6A5; --hl-k: #C79BE6; --hl-n: #E8A25C;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 var(--sans); }
main { max-width: 860px; margin: 0 auto; padding: 20px 16px 48px; }
header.top { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; justify-content: space-between; }
h1 { font-size: 1.4rem; margin: 0; }
.stats { color: var(--muted); font-size: .9rem; }
.setup { margin: 16px 0; display: grid; gap: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
button { font: inherit; cursor: pointer; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chip { border: 1px solid var(--rule); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 4px 12px; }
.chip .count { color: var(--muted); font-size: .8em; margin-left: 2px; }
.chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.chip[aria-pressed="true"] .count { color: inherit; opacity: .85; }
label { color: var(--muted); font-size: .9rem; }
select { font: inherit; padding: 4px 8px; border: 1px solid var(--rule); border-radius: 8px; background: var(--surface); color: var(--ink); max-width: 100%; }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); color: var(--ink); padding: 4px 14px; }
.seg button[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.ghost { border: 1px solid var(--rule); background: transparent; color: var(--muted); border-radius: 8px; padding: 4px 12px; }
.card { background: var(--surface); border: 1px solid var(--rule); border-radius: 14px; padding: 20px; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; color: var(--muted); font-size: .85rem; }
.tag { background: var(--accent-soft); color: var(--accent); border-radius: 6px; padding: 1px 8px; font-weight: 600; }
.badge-got { color: var(--got); } .badge-review { color: var(--review); }
.question { font-size: 1.3rem; line-height: 1.35; margin: 12px 0 4px; font-weight: 600; }
.question code { font-family: var(--mono); font-size: .9em; background: var(--code-bg); padding: .05em .3em; border-radius: 4px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.btn { border: 1px solid var(--rule); background: var(--surface); color: var(--ink); border-radius: 10px; padding: 8px 16px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
.btn.got { background: var(--got-soft); border-color: var(--got); color: var(--got); font-weight: 600; }
.btn.review { background: var(--review-soft); border-color: var(--review); color: var(--review); font-weight: 600; }
.btn kbd { font: .75em var(--mono); opacity: .7; margin-left: 6px; }
.md { overflow-wrap: anywhere; }
.md > :first-child { margin-top: 0; } .md > :last-child { margin-bottom: 0; }
.md pre { background: var(--code-bg); padding: 12px 14px; border-radius: 8px; overflow-x: auto; overflow-wrap: normal; }
.md code { font-family: var(--mono); font-size: .9em; background: var(--code-bg); padding: .1em .35em; border-radius: 4px; }
.md pre code { background: none; padding: 0; font-size: .85em; }
.md table { border-collapse: collapse; display: block; overflow-x: auto; }
.md th, .md td { border: 1px solid var(--rule); padding: 6px 10px; text-align: left; vertical-align: top; }
.md blockquote { margin: 12px 0; padding: 2px 14px; border-left: 3px solid var(--accent); color: var(--muted); }
.md img { max-width: 100%; }
.prompt { margin-top: 12px; }
.answer { background: var(--answer-bg); border: 1px solid var(--rule); border-radius: 10px; padding: 14px 18px; margin-top: 16px; }
.hl-c { color: var(--hl-c); font-style: italic; } .hl-s { color: var(--hl-s); } .hl-k { color: var(--hl-k); } .hl-n { color: var(--hl-n); }
.empty { text-align: center; color: var(--muted); padding: 24px 0; }
.empty .btn { margin-top: 12px; }
</style>
</head>
<body>
<main>
  <header class="top">
    <h1>Interview Quiz</h1>
    <div class="stats" id="stats" aria-live="polite"></div>
  </header>
  <section class="setup" aria-label="Choose questions">
    <div class="chips" id="chips" role="group" aria-label="Books"></div>
    <div class="row">
      <label id="partWrap" hidden>Part <select id="part"></select></label>
      <div class="seg" role="group" aria-label="Order">
        <button type="button" id="modeShuffle" aria-pressed="true">Shuffle</button>
        <button type="button" id="modeBrowse" aria-pressed="false">Browse</button>
      </div>
      <button type="button" id="reset" class="ghost">Reset progress</button>
    </div>
  </section>
  <section class="card" id="card" aria-live="polite"></section>
</main>
<script>/*__MARKED__*/</script>
<script>/*__DECK__*/</script>
<script>
const DATA = /*__DATA__*/[];
(function () {
  'use strict';

  const STORE_KEY = 'interviewQuiz.progress.v1';
  const $ = (id) => document.getElementById(id);
  const books = Array.from(new Set(DATA.map((q) => q.book)));
  const byId = new Map(DATA.map((q) => [q.id, q]));
  const state = { books: new Set(), part: '', mode: 'shuffle', deck: [], pos: 0, revealed: false, progress: loadProgress() };

  // ---------- code highlighting (tiny, offline) ----------
  const SLASH_LANGS = new Set(['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'java', 'c#', 'csharp', 'cs', 'go', 'rust', 'json']);
  const HASH_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'python', 'py', 'dockerfile', 'docker', 'toml', 'ini']);
  const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|from|export|default|class|extends|new|async|await|try|catch|finally|throw|typeof|instanceof|type|interface|enum|public|private|protected|static|void|true|false|null|undefined|this|def|self|None|True|False)\b|(\b\d+(?:\.\d+)?\b)/g;

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(code, lang) {
    const l = (lang || '').toLowerCase();
    const slash = SLASH_LANGS.has(l);
    const hash = HASH_LANGS.has(l);
    if (!slash && !hash) return escapeHtml(code);
    let out = '';
    let last = 0;
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, m.index));
      last = m.index + m[0].length;
      let cls;
      if (m[1] !== undefined) cls = (m[1][0] === '#' ? hash : slash) ? 'c' : null;
      else if (m[2] !== undefined) cls = 's';
      else if (m[3] !== undefined) cls = 'k';
      else cls = 'n';
      out += cls ? '<span class="hl-' + cls + '">' + escapeHtml(m[0]) + '</span>' : escapeHtml(m[0]);
    }
    return out + escapeHtml(code.slice(last));
  }

  // marked 12.x renderer signature: code(code, infostring, escaped)
  marked.use({
    gfm: true,
    renderer: {
      code(code, infostring) {
        const lang = ((infostring || '').match(/^\S*/) || [''])[0];
        return '<pre><code class="lang-' + escapeHtml(lang) + '">' + highlight(code, lang) + '\n</code></pre>\n';
      },
    },
  });

  // ---------- progress persistence ----------
  function ids(v) {
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  }
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyProgress();
      const p = JSON.parse(raw);
      return { got: ids(p && p.got), review: ids(p && p.review), seen: ids(p && p.seen) };
    } catch (e) {
      return emptyProgress();
    }
  }
  function saveProgress() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
    } catch (e) { /* storage blocked: keep going without persistence */ }
  }

  // ---------- setup bar ----------
  function chip(label, count, on, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(on));
    b.appendChild(document.createTextNode(label + ' '));
    const s = document.createElement('span');
    s.className = 'count';
    s.textContent = String(count);
    b.appendChild(s);
    b.addEventListener('click', () => { b.blur(); onClick(); });
    return b;
  }

  function renderChips() {
    const wrap = $('chips');
    wrap.textContent = '';
    wrap.appendChild(chip('All books', DATA.length, state.books.size === 0, () => {
      state.books.clear();
      onFilterChange();
    }));
    books.forEach((b) => {
      const n = DATA.filter((q) => q.book === b).length;
      wrap.appendChild(chip(b, n, state.books.has(b), () => {
        if (state.books.has(b)) state.books.delete(b); else state.books.add(b);
        onFilterChange();
      }));
    });
  }

  function renderParts() {
    const wrap = $('partWrap');
    const sel = $('part');
    const only = state.books.size === 1 ? Array.from(state.books)[0] : null;
    const parts = only
      ? Array.from(new Set(DATA.filter((q) => q.book === only && q.part).map((q) => q.part)))
      : [];
    if (parts.length < 2) {
      wrap.hidden = true;
      state.part = '';
      return;
    }
    if (parts.indexOf(state.part) === -1) state.part = '';
    sel.textContent = '';
    [''].concat(parts).forEach((p) => {
      const o = document.createElement('option');
      o.value = p;
      o.textContent = p || 'All parts';
      sel.appendChild(o);
    });
    sel.value = state.part;
    wrap.hidden = false;
  }

  function renderMode() {
    $('modeShuffle').setAttribute('aria-pressed', String(state.mode === 'shuffle'));
    $('modeBrowse').setAttribute('aria-pressed', String(state.mode === 'browse'));
  }

  // ---------- deck + card ----------
  function newDeck() {
    state.deck = buildDeck(DATA, { books: state.books, part: state.part, mode: state.mode });
    state.pos = 0;
    state.revealed = false;
    renderCard();
    renderStats();
  }

  function onFilterChange() {
    state.part = '';
    renderChips();
    renderParts();
    newDeck();
  }

  function currentQ() {
    return state.pos < state.deck.length ? byId.get(state.deck[state.pos]) : null;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function button(label, cls, key, onClick) {
    const b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    if (key) b.appendChild(el('kbd', '', key));
    b.addEventListener('click', onClick);
    return b;
  }

  function emptyMessage(text, actionLabel, onAction) {
    const box = el('div', 'empty');
    box.appendChild(el('p', '', text));
    if (actionLabel) box.appendChild(button(actionLabel, 'primary', '', onAction));
    return box;
  }

  function renderCard() {
    const card = $('card');
    card.textContent = '';
    if (state.deck.length === 0) {
      card.appendChild(emptyMessage('No questions match this filter.'));
      return;
    }
    const q = currentQ();
    if (!q) {
      card.appendChild(emptyMessage('Deck finished. Nice work.', 'Start again', newDeck));
      return;
    }
    state.progress = markSeen(state.progress, q.id);
    saveProgress();

    const meta = el('div', 'meta');
    meta.appendChild(el('span', 'tag', q.book));
    if (q.part) meta.appendChild(el('span', '', q.part));
    meta.appendChild(el('span', '', 'Question ' + (state.pos + 1) + ' of ' + state.deck.length));
    if (state.progress.got.indexOf(q.id) !== -1) meta.appendChild(el('span', 'badge-got', '✓ got it before'));
    if (state.progress.review.indexOf(q.id) !== -1) meta.appendChild(el('span', 'badge-review', '↻ marked for review'));
    card.appendChild(meta);

    const h = el('h2', 'question');
    h.innerHTML = marked.parseInline(q.question);
    card.appendChild(h);

    if (q.prompt) {
      const prompt = el('div', 'md prompt');
      prompt.innerHTML = marked.parse(q.prompt);
      card.appendChild(prompt);
    }

    if (state.revealed) {
      const ans = el('div', 'md answer');
      ans.innerHTML = marked.parse(q.answer || '_No answer text._');
      card.appendChild(ans);
    }

    const actions = el('div', 'actions');
    if (!state.revealed) {
      actions.appendChild(button('Show answer', 'primary', 'Space', reveal));
    } else {
      actions.appendChild(button('Review again', 'review', 'R', () => mark('review')));
      actions.appendChild(button('Got it', 'got', 'G', () => mark('got')));
    }
    actions.appendChild(button('Next', '', '→', advance));
    card.appendChild(actions);
  }

  function renderStats() {
    const scope = filterQuestions(DATA, state.books, state.part);
    const got = new Set(state.progress.got);
    const review = new Set(state.progress.review);
    const seen = new Set(state.progress.seen);
    const count = (set) => scope.filter((q) => set.has(q.id)).length;
    $('stats').textContent =
      count(seen) + ' / ' + scope.length + ' seen · ' + count(got) + ' got it · ' + count(review) + ' to review';
  }

  function reveal() {
    if (!currentQ() || state.revealed) return;
    state.revealed = true;
    renderCard();
  }

  function advance() {
    if (!currentQ()) return;
    state.pos += 1;
    state.revealed = false;
    renderCard();
    renderStats();
    $('card').scrollIntoView({ block: 'start' });
  }

  function mark(kind) {
    const q = currentQ();
    if (!q || !state.revealed) return;
    state.progress = markProgress(state.progress, q.id, kind);
    saveProgress();
    if (kind === 'review') state.deck = requeue(state.deck, state.pos, q.id);
    advance();
  }

  // ---------- wiring ----------
  $('part').addEventListener('change', (e) => {
    state.part = e.target.value;
    newDeck();
  });
  $('modeShuffle').addEventListener('click', () => { state.mode = 'shuffle'; renderMode(); newDeck(); });
  $('modeBrowse').addEventListener('click', () => { state.mode = 'browse'; renderMode(); newDeck(); });
  $('reset').addEventListener('click', () => {
    if (!window.confirm('Reset all saved progress?')) return;
    state.progress = emptyProgress();
    saveProgress();
    newDeck();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      if (tag === 'BUTTON') return; // the focused button handles Space itself
      e.preventDefault();
      reveal();
    } else if (e.key === 'ArrowRight') {
      advance();
    } else if (e.key === 'g' || e.key === 'G') {
      mark('got');
    } else if (e.key === 'r' || e.key === 'R') {
      mark('review');
    }
  });

  renderChips();
  renderParts();
  renderMode();
  newDeck();
})();
</script>
</body>
</html>
````

- [ ] **Step 7: Build and check counts**

Run: `node interview-topics/build-quiz.js`
Expected output:

```
CSS                      61
Frontend Interview       117
Frontend System Design   70
HTML                     64
JavaScript               72
NestJS                   94
Next.js                  53
Node.js                  66
React                    66
TOTAL                    663
Wrote ...\quiz.html (… KB)
```

Any mismatch is a parser bug: reproduce it in `parse.test.js` first, then fix `parse.js`.

- [ ] **Step 8: Run the whole suite**

Run: `node --test "interview-topics/quiz-src/*.test.js"`
Expected: PASS — 21 tests, 0 failures.

- [ ] **Step 9: Commit**

```bash
git add interview-topics/build-quiz.js interview-topics/quiz-src/template.html interview-topics/quiz-src/build.test.js interview-topics/quiz-src/vendor/marked.min.js interview-topics/quiz.html
git commit -m "feat(quiz): build self-contained quiz.html from interview md files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser verification and fixes

**Files:**
- Modify (only if a check fails): `interview-topics/quiz-src/template.html`, then re-run `node interview-topics/build-quiz.js`
- Output: `interview-topics/quiz.html` (regenerated)

**Interfaces:**
- Consumes: the generated `quiz.html` (Task 3).
- Produces: a verified page; any fix is committed with the regenerated `quiz.html`.

Open the page in the built-in browser: `file:///C:/Users/Tareq-PC/Development/learn/interview-topics/quiz.html`. If `file://` is blocked, serve the folder instead (`python -m http.server 8080 --directory interview-topics`) and open `http://localhost:8080/quiz.html`.

- [ ] **Step 1: Smoke check (no console errors, data loaded)**

Read the console (`read_console_messages`, errors only): expect none. Then run in the page:

```js
({ total: DATA.length, books: [...new Set(DATA.map(q => q.book))].length, prompts: DATA.filter(q => q.prompt).length, hasMarked: typeof marked.parse })
```
Expected: `{ total: 663, books: 9, prompts: 45, hasMarked: "function" }`.

- [ ] **Step 2: Random mix, reveal, code rendering**

Confirm: the stats line reads `N / 663 seen · 0 got it · 0 to review` and the card shows a book tag and "Question 1 of 663". Press Space: the answer appears with markdown rendered (bold, lists, tables) and fenced code blocks coloured. Press →: next question and the page scrolls to the card top. Screenshot an answer containing a code block and a table.

- [ ] **Step 3: Prompts and extras**

- Select `JavaScript`, Part "Section 9 — Output Prediction Puzzles": the question reads "What does this code output?" with the code visible **before** reveal; Space reveals only the explanation.
- Select `CSS`, the "Rapid-Fire and Debugging Puzzles" part: "Which color is the text?" shows the HTML and CSS snippets before reveal, and the revealed answer has no leftover `<details>` disclosure.
- Select `NestJS`, Part "Part 5 — Rapid-fire and a prep plan": 20 short rapid-fire questions; Part 4 shows the 5 design prompts and 4 behavioural questions.

- [ ] **Step 4: Book and part filters**

Click the `React` chip: counts drop to 66, "All books" turns off, and a Part dropdown appears. Pick one part: the deck shrinks to that part. Add the `CSS` chip too: the Part dropdown disappears (two books selected). Click "All books": back to 663. Select only `Frontend System Design` and confirm questions read "Explain: …" or "Design a …", plus the 30 rapid-fire items as separate questions.

- [ ] **Step 5: Got, Review, requeue, finished deck**

Select `Next.js` in Browse mode. Reveal, press `R`: stats show 1 to review and the same question comes back 5-9 cards later with the "marked for review" badge. Press `G` on it then: the review count drops and the got count rises. Step to the end of the deck: "Deck finished" shows with "Start again", with no loop or error. On the very last card press `R`: no error, and the card comes back at the end of the deck.

- [ ] **Step 6: Persistence, corrupt and blocked storage, reset**

- Persistence: mark a few cards, reload, and confirm the stats are unchanged.
- Corrupt storage: run `localStorage.setItem('interviewQuiz.progress.v1', '{bad')` in the page, reload. The page loads with 0 progress and no console error.
- Wrong shape: run `localStorage.setItem('interviewQuiz.progress.v1', '{"got":5}')`, reload. It loads with 0 progress.
- Blocked storage: run `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })`, then reveal a card and press G. There is no uncaught error in the console.
- Reset: click "Reset progress", accept the confirm, and the stats return to `0 got it · 0 to review`.
- The "No questions match this filter." state cannot be reached from the UI (every offered filter has questions). It is covered by the `filterQuestions` / `buildDeck` unit tests, so do not try to force it.

- [ ] **Step 7: Dark mode and mobile width**

Call `resize_window` with `colorScheme: "dark"`: text, prompts and code stay readable, chips and buttons keep contrast. Call `resize_window` with the `mobile` preset: there is no horizontal page scroll, tables and code blocks scroll inside the card, and buttons wrap. Reset with `preset: "desktop"` and `colorScheme: "light"` afterwards.

- [ ] **Step 8: Fix anything found, rebuild, commit**

For each failed check, change `template.html` (or `parse.js` / `deck.js` with a failing test first), run `node interview-topics/build-quiz.js` and `node --test "interview-topics/quiz-src/*.test.js"`, then re-run the failed check. Then:

```bash
git add -A interview-topics
git commit -m "fix(quiz): address issues found in browser verification" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If every check passed with no changes, there is nothing to commit; report "verified, no fixes needed".

---

## Self-review notes

- **Spec coverage:** parsing rules 1–4 (Task 1: tests for Q headings, `<details>` prompts, untitled puzzles, part fallback, NestJS extras, numbered-section fallback; Step 6 checks the real books); record shape with `prompt` and ids hashed from question + prompt (Task 3 `collect`, tested); fail-loud build errors and safe inlining (Task 3 tests); inlined `marked` and highlighter (Task 3 template); book chips with counts, All books, Part dropdown (Task 3, checked in Task 4 step 4); Shuffle vs Browse (Task 2 `buildDeck`, Task 3); prompt shown before reveal (Task 3 `renderCard`, Task 4 step 3); Show answer, Got it, Review again with requeue, Next (Task 2 `requeue`, Task 3); keyboard Space, →, G, R (Task 3); progress with `localStorage` try/catch and reset (Task 3, Task 4 step 6); palette, dark mode, system fonts (Task 3); mobile (Task 4 step 7); empty-filter and finished-deck states (Task 3 `renderCard`, Task 2 tests).
- **Types:** `parseFile` returns `{question, part, prompt, answer}`; `collect` adds `id` and `book`; the deck helpers and template use `id`, `book`, `part`, `question`, `prompt`, `answer` consistently. The template calls `markProgress(p, id, 'got'|'review')`, `markSeen`, `emptyProgress`, `requeue(deck, pos, id)`, `buildDeck(all, {books, part, mode})` and `filterQuestions(all, books, part)` with exactly the signatures defined in Task 2.
- **Prompt count:** 33 `<details>` questions + 12 JavaScript puzzles = 45 records with a prompt (Task 4 step 1).
- **Pre-checked:** the Task 1 parser and its 12 tests were run against the real books before this plan was finalised (663 total, counts as listed).
