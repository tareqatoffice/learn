# Quiz App (Svelte + Vite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the working vanilla quiz from `interview-topics/` into its own `quiz-app/` project, rebuilt with Svelte 5 + Vite, still producing one committed, offline `quiz-app/quiz.html`.

**Architecture:** The tested pure modules (`parse.js`, `deck.js`) move with `git mv` and become ESM under `quiz-app/src/lib/`. A Vite plugin turns the md books into a virtual module (`virtual:questions`) using escaped JSON; `vite-plugin-singlefile` inlines everything into `dist/index.html`, and `scripts/publish.js` copies it to the committed `quiz.html`. The UI is three Svelte components on top of the pure helpers, plus new tested helpers for highlighting, markdown and storage.

**Tech Stack:** Node 24, npm 11, Svelte 5.57.2 (runes), Vite 8.3.3, @sveltejs/vite-plugin-svelte 7.3.1, vite-plugin-singlefile 2.3.3, marked 12.0.2, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-08-quiz-app-svelte-design.md` (amends `docs/superpowers/specs/2026-10-08-interview-quiz-design.md`, whose parsing rules and features stay binding).

## Global Constraints

- Branch `feat/interview-quiz` (already checked out); commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run commands from the repo root `C:\Users\Tareq-PC\Development\learn` unless a step says `cd quiz-app`.
- Exact dependency versions: `svelte 5.57.2`, `vite 8.3.3`, `@sveltejs/vite-plugin-svelte 7.3.1`, `vite-plugin-singlefile 2.3.3` (dev), `marked 12.0.2` (runtime). Fallback only if the Task 2 proof fails: Vite 7 + `@sveltejs/vite-plugin-svelte` 6.x, exact versions recorded as a ruling.
- Record shape `{ id, book, part, question, prompt, answer }`; expected counts CSS 61, Frontend Interview 117, Frontend System Design 70, HTML 64, JavaScript 72, NestJS 94, Next.js 53, Node.js 66, React 66 — total 663, 45 with a prompt.
- `localStorage` key stays `interviewQuiz.progress.v1`.
- The books path is always resolved from the file that needs it (`new URL('../interview-topics', import.meta.url)` style), never from the current directory.
- All CSS is global (`src/styles.css`); no `<style>` blocks in components (scoped CSS does not reach `{@html}` output).
- Every setup control (chips, mode buttons, Part select, reset) blurs itself after use.
- `quiz.html` committed; `dist/` and `node_modules/` ignored; `package-lock.json` committed.
- Writing `\u2028`/`\u2029` escapes directly into files has been corrupted by the Write tool before (they became literal characters). Code here builds those characters with `String.fromCharCode`; keep it that way.
- Out of scope: the six deferred minors listed in the spec, search, timers, Astro, a component test framework.

## Review Focus

- The minifier could re-emit an escaped `</script` from the data or a constant as a raw `</script`, cutting the inline script short. Pinned in Task 2 (`dist.test.js` requires exactly one `<script` and one `</script` in `quiz.html`; the proof app includes a constant the minifier may fold into `</script>`).
- Markdown inserted with `{@html}` must keep its table/code/highlight styling (global CSS). No automated test; checked in Task 5 step 3.
- Svelte keeps chip buttons alive between renders, so a chip keeps focus after a click unless blurred, and Space would toggle the chip instead of revealing. Checked in Task 5 step 5 for a chip, a mode button and the Part select.
- `npm run dev` should reload after a book is edited (plugin `addWatchFile`). Not covered by any test; checked in Task 5 step 6.
- Progress saved by the old vanilla page must load in the new page (same key, same ids). Checked in Task 5 step 4.

---

### Task 1: Move the pure modules into `quiz-app/` as ESM

**Files:**
- Create: `quiz-app/package.json`, `quiz-app/.gitignore`
- Move (git mv): `interview-topics/quiz-src/parse.js` → `quiz-app/src/lib/parse.js`; `interview-topics/quiz-src/deck.js` → `quiz-app/src/lib/deck.js`; `interview-topics/quiz-src/parse.test.js` → `quiz-app/test/parse.test.js`; `interview-topics/quiz-src/deck.test.js` → `quiz-app/test/deck.test.js`
- Modify: the four moved files (CommonJS → ESM)

**Interfaces:**
- Consumes: the vanilla modules as they are on the branch (14 parse tests, 6 deck tests).
- Produces: `quiz-app/src/lib/parse.js` exporting `parseFile`, `parseQuestionHeadings`, `parseNumberedSections`; `quiz-app/src/lib/deck.js` exporting `shuffle`, `filterQuestions`, `buildDeck`, `requeue`, `emptyProgress`, `markProgress`, `markSeen` (same signatures as before); the `npm test` script.

Note: after this task `interview-topics/build-quiz.js` can no longer find `./quiz-src/parse`. That is expected; the old build is deleted in Task 5, and the committed old `quiz.html` keeps working until then.

- [ ] **Step 1: Create `quiz-app/package.json`**

```json
{
  "name": "quiz-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && node scripts/publish.js",
    "test": "node --test \"test/*.test.js\""
  },
  "dependencies": {
    "marked": "12.0.2"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "7.3.1",
    "svelte": "5.57.2",
    "vite": "8.3.3",
    "vite-plugin-singlefile": "2.3.3"
  }
}
```

- [ ] **Step 2: Create `quiz-app/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 3: Move the files**

```bash
mkdir -p quiz-app/src/lib quiz-app/test
git mv interview-topics/quiz-src/parse.js quiz-app/src/lib/parse.js
git mv interview-topics/quiz-src/deck.js quiz-app/src/lib/deck.js
git mv interview-topics/quiz-src/parse.test.js quiz-app/test/parse.test.js
git mv interview-topics/quiz-src/deck.test.js quiz-app/test/deck.test.js
```

- [ ] **Step 4: Convert the test headers to ESM (the failing step)**

In `quiz-app/test/parse.test.js`, replace the first four lines

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFile, parseQuestionHeadings, parseNumberedSections } = require('./parse');
```

with

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFile, parseQuestionHeadings, parseNumberedSections } from '../src/lib/parse.js';
```

In `quiz-app/test/deck.test.js`, replace the first four lines

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./deck');
```

with

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/lib/deck.js';
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd quiz-app && npm test`
Expected: FAIL — both files error (SyntaxError about a missing named export, or `module is not defined`), because the sources are still CommonJS inside a `"type": "module"` package.

- [ ] **Step 6: Convert the sources to ESM**

In `quiz-app/src/lib/parse.js`: delete the first line `'use strict';` and the blank line after it, and replace the last line

```js
module.exports = { parseFile, parseQuestionHeadings, parseNumberedSections };
```

with

```js
export { parseFile, parseQuestionHeadings, parseNumberedSections };
```

In `quiz-app/src/lib/deck.js`: replace the top

```js
'use strict';

// Pure deck/progress helpers. Inlined into quiz.html by build-quiz.js (so top-level
// functions become globals in the page) and also loaded by node:test via module.exports.
```

with

```js
// Pure deck/progress helpers used by the Svelte app. No DOM, no storage.
```

and replace the bottom

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shuffle, filterQuestions, buildDeck, requeue, emptyProgress, markProgress, markSeen };
}
```

with

```js
export { shuffle, filterQuestions, buildDeck, requeue, emptyProgress, markProgress, markSeen };
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd quiz-app && npm test`
Expected: PASS — 20 tests (14 parse, 6 deck), 0 failures.

- [ ] **Step 8: Commit**

```bash
git add -A quiz-app interview-topics/quiz-src docs/superpowers
git commit -m "refactor(quiz): move parser and deck helpers into quiz-app as ES modules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Data plugin, single-file build, and the toolchain proof

**Files:**
- Move (git mv): `interview-topics/quiz-src/build.test.js` → `quiz-app/test/collect.test.js` (rewritten)
- Create: `quiz-app/src/lib/collect.js`, `quiz-app/src/lib/embed.js`, `quiz-app/src/lib/questions-plugin.js`, `quiz-app/vite.config.js`, `quiz-app/index.html`, `quiz-app/src/main.js`, `quiz-app/src/App.svelte` (proof version, replaced in Task 4), `quiz-app/scripts/publish.js`, `quiz-app/test/embed.test.js`, `quiz-app/test/dist.test.js`
- Generated + committed: `quiz-app/quiz.html`, `quiz-app/package-lock.json`

**Interfaces:**
- Consumes: `parseFile` (Task 1).
- Produces:
  - `collect(dir: string): { questions: Question[], counts: Record<string, number> }` — same behaviour and ids as `interview-topics/build-quiz.js`.
  - `safeJson(value): string` — JSON with `<`, U+2028, U+2029 escaped as `\u003c`, `\u2028`, `\u2029` text.
  - `questionsModuleSource(questions): string` — `export default JSON.parse("…");` containing no raw `<`.
  - `questionsPlugin(booksDir: string)` — Vite plugin resolving `virtual:questions`; prints per-book counts.
  - `npm run build` → `quiz-app/dist/index.html` → copied to `quiz-app/quiz.html`.

- [ ] **Step 1: Install dependencies (ask the user first)**

This downloads packages from the npm registry. Tell the user: `npm install` in `quiz-app/` fetches svelte 5.57.2, vite 8.3.3, @sveltejs/vite-plugin-svelte 7.3.1, vite-plugin-singlefile 2.3.3, marked 12.0.2 and their dependencies (tens of MB into the git-ignored `quiz-app/node_modules/`). Wait for a yes, then:

```bash
cd quiz-app && npm install
```

Expected: exits 0; `npm ls --depth=0` lists exactly the five pinned versions. A peer-dependency warning about `rollup` from `vite-plugin-singlefile` is acceptable here; the proof in Step 9 decides.

- [ ] **Step 2: Write the failing tests**

```bash
git mv interview-topics/quiz-src/build.test.js quiz-app/test/collect.test.js
```

Replace the whole content of `quiz-app/test/collect.test.js` with:

```js
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
```

Create `quiz-app/test/embed.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJson } from '../src/lib/embed.js';
import { questionsModuleSource } from '../src/lib/questions-plugin.js';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

test('safeJson escapes <, U+2028 and U+2029 and still round-trips', () => {
  const value = [{ q: 'a </script><!-- ' + LS + ' $& $`', p: PS }];
  const out = safeJson(value);
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes(LS));
  assert.ok(!out.includes(PS));
  assert.deepEqual(JSON.parse(out), value);
});

test('questions module source has no raw < and evaluates to the data', async () => {
  const value = [{ id: 'x-1', q: '</script> <!-- ' + LS }];
  const src = questionsModuleSource(value);
  assert.ok(!src.includes('<'));
  const mod = await import('data:text/javascript,' + encodeURIComponent(src));
  assert.deepEqual(mod.default, value);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd quiz-app && npm test`
Expected: FAIL — `collect.test.js` and `embed.test.js` cannot find `../src/lib/collect.js` / `../src/lib/embed.js` (ERR_MODULE_NOT_FOUND); the 20 existing tests still pass.

- [ ] **Step 4: Write `collect.js`, `embed.js`, `questions-plugin.js`**

Create `quiz-app/src/lib/collect.js`:

```js
// Reads every *.md book in a folder and turns it into question records with stable ids.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile } from './parse.js';

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

export function collect(dir) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  if (files.length === 0) throw new Error(`No .md files in ${dir}`);
  const used = new Set();
  const questions = [];
  const counts = {};
  for (const file of files) {
    const md = readFileSync(join(dir, file), 'utf8');
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
```

Create `quiz-app/src/lib/embed.js`:

```js
// JSON that is safe to place inside an inline <script>: no raw "<" (so no "</script" or "<!--"),
// and no U+2028/U+2029. The characters are built from char codes on purpose (see plan constraints).
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}
```

Create `quiz-app/src/lib/questions-plugin.js`:

```js
// Vite plugin: `import questions from 'virtual:questions'` gives the parsed books, embedded as escaped JSON.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { collect } from './collect.js';
import { safeJson } from './embed.js';

const VIRTUAL_ID = 'virtual:questions';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// The JSON text travels as a JS string literal, so even a minifier that rewrites string escapes
// never sees a "<" character it could turn back into "</script".
export function questionsModuleSource(questions) {
  return `export default JSON.parse(${JSON.stringify(safeJson(questions))});`;
}

export function questionsPlugin(booksDir) {
  return {
    name: 'interview-questions',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { questions, counts } = collect(booksDir);
      for (const file of readdirSync(booksDir)) {
        if (file.toLowerCase().endsWith('.md')) this.addWatchFile(join(booksDir, file));
      }
      Object.entries(counts).forEach(([book, n]) => console.log(`${book.padEnd(24)} ${n}`));
      console.log(`${'TOTAL'.padEnd(24)} ${questions.length}`);
      return questionsModuleSource(questions);
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd quiz-app && npm test`
Expected: PASS — 23 tests, 0 failures.

- [ ] **Step 6: Write the build wiring and the proof app**

Create `quiz-app/vite.config.js`:

```js
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { questionsPlugin } from './src/lib/questions-plugin.js';

const BOOKS_DIR = fileURLToPath(new URL('../interview-topics', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [questionsPlugin(BOOKS_DIR), svelte(), viteSingleFile()],
});
```

Create `quiz-app/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Interview Quiz</title>
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.js"></script>
</body>
</html>
```

Create `quiz-app/src/main.js` (the stylesheet import is added in Task 4):

```js
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
```

Create `quiz-app/src/App.svelte` (proof only; Task 4 replaces it). The probe is split so the `.svelte` parser does not end its own `<script>` block, while the minifier is free to fold it back into a `</script>` literal:

```svelte
<script>
  import questions from 'virtual:questions';
  const probe = '<' + '/script> <' + '!-- ' + String.fromCharCode(0x2028);
</script>

<p id="count">{questions.length}</p>
<p id="probe">{probe.length}</p>
<p id="first">{questions[0].id}</p>
```

Create `quiz-app/scripts/publish.js`:

```js
// Copies the single-file build to quiz-app/quiz.html, the committed, double-clickable quiz.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const to = fileURLToPath(new URL('../quiz.html', import.meta.url));
copyFileSync(from, to);
console.log(`Published ${to}`);
```

- [ ] **Step 7: Write the dist test (fails before the first build)**

Create `quiz-app/test/dist.test.js`:

```js
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
```

Run: `cd quiz-app && npm test`
Expected: FAIL — `dist.test.js` errors with ENOENT for `quiz.html`; the other 23 pass.

- [ ] **Step 8: Build**

Run: `cd quiz-app && npm run build`
Expected: the per-book counts (CSS 61 … React 66, TOTAL 663) print, Vite writes a single `dist/index.html`, and `Published …quiz-app\quiz.html` prints. Then `cd quiz-app && npm test` — Expected: PASS, 25 tests.

- [ ] **Step 9: Prove it loads offline**

Open `quiz-app/quiz.html` in the browser pane (`file:///C:/Users/Tareq-PC/Development/learn/quiz-app/quiz.html`). If `file://` is blocked, add a temporary `interview-topics/.claude/launch.json` with a config named `quiz-app-static` running `python -m http.server 8765 --directory ../quiz-app`, start it with `preview_start`, open `http://localhost:8765/quiz.html`, and remove the config afterwards. Read `#count`, `#probe`, `#first` and the console.
Expected: `#count` = 663, `#probe` = 16 (`</script>` 9 + space + `<!--` 4 + space + U+2028), `#first` starts with `css-questions-ebook-`, no console errors.

If `dist.test.js` fails only on the `<script` / `</script` counts, look at where each extra match sits before deciding the proof failed. An extra `</script` anywhere, or any extra match inside the embedded data, is a real failure. An extra `<script` (not `</script`) inside third-party library code is harmless: relax the first assertion to count only `</script` and ledger `Task 2: Ruling: <script count relaxed — extra match in <library> at offset <n>, not data`.

If the build fails, the dist test fails, or the page does not load: switch to the fallback. Run `npm view vite@7 version` and `npm view @sveltejs/vite-plugin-svelte@6 version`, set the latest of each as exact versions in `package.json`, `npm install`, repeat Steps 8–9, and ledger `Task 2: Ruling: Vite 8 proof failed (<symptom>) — pinned vite <x>, plugin-svelte <y>`.

- [ ] **Step 10: Commit**

```bash
git add -A quiz-app interview-topics/quiz-src
git commit -m "feat(quiz-app): embed parsed books via a Vite plugin and build one offline file" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Highlight, markdown and storage helpers

**Files:**
- Create: `quiz-app/src/lib/highlight.js`, `quiz-app/src/lib/markdown.js`, `quiz-app/src/lib/storage.js`
- Test: `quiz-app/test/highlight.test.js`, `quiz-app/test/markdown.test.js`, `quiz-app/test/storage.test.js`

**Interfaces:**
- Consumes: `emptyProgress` (Task 1); `marked` (installed in Task 2).
- Produces:
  - `escapeHtml(s: string): string`, `highlight(code: string, lang: string): string` — same output as the vanilla template's functions.
  - `renderBlock(md: string): string`, `renderInline(md: string): string` — marked 12 with the highlighting code renderer.
  - `STORE_KEY = 'interviewQuiz.progress.v1'`; `loadProgress(getStorage?)`, `saveProgress(progress, getStorage?)`; `getStorage` defaults to `() => globalThis.localStorage`; neither function ever throws.

- [ ] **Step 1: Write the failing tests**

Create `quiz-app/test/highlight.test.js`:

```js
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
```

Create `quiz-app/test/markdown.test.js`:

```js
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
```

Create `quiz-app/test/storage.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_KEY, loadProgress, saveProgress } from '../src/lib/storage.js';
import { emptyProgress } from '../src/lib/deck.js';

function fakeStorage(initial) {
  const map = new Map(initial === undefined ? [] : [[STORE_KEY, initial]]);
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test('progress round-trips through storage under the old key', () => {
  const s = fakeStorage();
  const p = { got: ['a'], review: [], seen: ['a', 'b'] };
  saveProgress(p, () => s);
  assert.equal(STORE_KEY, 'interviewQuiz.progress.v1');
  assert.deepEqual(loadProgress(() => s), p);
});

test('corrupt JSON loads as empty progress', () => {
  assert.deepEqual(loadProgress(() => fakeStorage('{bad')), emptyProgress());
});

test('wrong shapes keep only string ids', () => {
  assert.deepEqual(loadProgress(() => fakeStorage('{"got":5,"review":["r",1],"seen":null}')), { got: [], review: ['r'], seen: [] });
  assert.deepEqual(loadProgress(() => fakeStorage('null')), emptyProgress());
});

test('blocked storage never throws', () => {
  const blocked = () => {
    throw new Error('blocked');
  };
  assert.deepEqual(loadProgress(blocked), emptyProgress());
  assert.doesNotThrow(() => saveProgress(emptyProgress(), blocked));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd quiz-app && npm test`
Expected: FAIL — the three new files cannot find their modules (ERR_MODULE_NOT_FOUND); the other 25 pass.

- [ ] **Step 3: Write the implementations**

Create `quiz-app/src/lib/highlight.js` (moved verbatim from the vanilla template):

```js
// Tiny offline code highlighter. Output is always HTML-escaped.
const SLASH_LANGS = new Set(['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'java', 'c#', 'csharp', 'cs', 'go', 'rust', 'json']);
const HASH_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'python', 'py', 'dockerfile', 'docker', 'toml', 'ini']);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|from|export|default|class|extends|new|async|await|try|catch|finally|throw|typeof|instanceof|type|interface|enum|public|private|protected|static|void|true|false|null|undefined|this|def|self|None|True|False)\b|(\b\d+(?:\.\d+)?\b)/g;

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(code, lang) {
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
```

Create `quiz-app/src/lib/markdown.js`:

```js
// marked 12 configured with the highlighter. marked 12.x renderer signature: code(code, infostring, escaped).
import { marked } from 'marked';
import { escapeHtml, highlight } from './highlight.js';

marked.use({
  gfm: true,
  renderer: {
    code(code, infostring) {
      const lang = ((infostring || '').match(/^\S*/) || [''])[0];
      return '<pre><code class="lang-' + escapeHtml(lang) + '">' + highlight(code, lang) + '\n</code></pre>\n';
    },
  },
});

export const renderBlock = (md) => marked.parse(md);
export const renderInline = (md) => marked.parseInline(md);
```

Create `quiz-app/src/lib/storage.js`:

```js
// Progress persistence. Never throws: blocked or corrupt storage falls back to empty progress.
import { emptyProgress } from './deck.js';

export const STORE_KEY = 'interviewQuiz.progress.v1';

const defaultStorage = () => globalThis.localStorage;

function ids(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function loadProgress(getStorage = defaultStorage) {
  try {
    const raw = getStorage().getItem(STORE_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw);
    return { got: ids(p && p.got), review: ids(p && p.review), seen: ids(p && p.seen) };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress, getStorage = defaultStorage) {
  try {
    getStorage().setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    // storage blocked: keep going without persistence
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd quiz-app && npm test`
Expected: PASS — 34 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add quiz-app/src/lib quiz-app/test
git commit -m "feat(quiz-app): add tested highlight, markdown and storage helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Svelte UI

**Files:**
- Create: `quiz-app/src/styles.css`, `quiz-app/src/components/Markdown.svelte`, `quiz-app/src/components/SetupBar.svelte`, `quiz-app/src/components/QuestionCard.svelte`
- Modify: `quiz-app/src/App.svelte` (replace the proof), `quiz-app/src/main.js` (import styles)
- Regenerated + committed: `quiz-app/quiz.html`

**Interfaces:**
- Consumes: `virtual:questions` (Task 2); `buildDeck`, `filterQuestions`, `requeue`, `emptyProgress`, `markProgress`, `markSeen` (Task 1); `renderBlock`, `renderInline`, `loadProgress`, `saveProgress` (Task 3).
- Produces: the quiz UI with the same behaviour as the vanilla page.

Svelte 5 notes: `$state` proxies arrays and plain objects but not `Set`, so the selected books are a string array, wrapped in `new Set(...)` only when calling `filterQuestions`/`buildDeck`. `aria-pressed` values are passed as strings because the CSS matches `[aria-pressed="true"]`.

- [ ] **Step 1: Move the stylesheet**

Extract the contents of the vanilla template's `<style>` block, verbatim, into the global stylesheet:

```bash
node -e "const fs=require('fs');const t=fs.readFileSync('interview-topics/quiz-src/template.html','utf8');const css=t.slice(t.indexOf('<style>')+7,t.indexOf('</style>')).trim()+'\n';fs.writeFileSync('quiz-app/src/styles.css',css);console.log(css.split('\n').length+' lines')"
```

Expected: about 80 lines; the file starts with `:root {` and contains `.md pre`, `.prompt`, `.answer`, `.hl-c`.

Then change `quiz-app/src/main.js` to:

```js
import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';

mount(App, { target: document.getElementById('app') });
```

- [ ] **Step 2: Write `Markdown.svelte`**

Create `quiz-app/src/components/Markdown.svelte`:

```svelte
<script>
  import { renderBlock, renderInline } from '../lib/markdown.js';

  let { source, inline = false, class: cls = '' } = $props();
  const html = $derived(inline ? renderInline(source) : renderBlock(source));
</script>

{#if inline}
  <span class={cls}>{@html html}</span>
{:else}
  <div class={cls}>{@html html}</div>
{/if}
```

- [ ] **Step 3: Write `SetupBar.svelte`**

Create `quiz-app/src/components/SetupBar.svelte`:

```svelte
<script>
  let { books, counts, total, selected, parts, part, mode, onToggleBook, onAllBooks, onPart, onMode, onReset } = $props();

  // Every control gives up focus after use so the card shortcuts (Space, arrows, G, R) keep working.
  const release = (e) => e.currentTarget.blur();
</script>

<section class="setup" aria-label="Choose questions">
  <div class="chips" role="group" aria-label="Books">
    <button type="button" class="chip" aria-pressed={String(selected.length === 0)}
      onclick={(e) => { release(e); onAllBooks(); }}>
      All books <span class="count">{total}</span>
    </button>
    {#each books as book (book)}
      <button type="button" class="chip" aria-pressed={String(selected.includes(book))}
        onclick={(e) => { release(e); onToggleBook(book); }}>
        {book} <span class="count">{counts[book]}</span>
      </button>
    {/each}
  </div>
  <div class="row">
    {#if parts.length > 1}
      <label>Part
        <select value={part} onchange={(e) => { const v = e.currentTarget.value; release(e); onPart(v); }}>
          <option value="">All parts</option>
          {#each parts as p (p)}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
    {/if}
    <div class="seg" role="group" aria-label="Order">
      <button type="button" aria-pressed={String(mode === 'shuffle')} onclick={(e) => { release(e); onMode('shuffle'); }}>Shuffle</button>
      <button type="button" aria-pressed={String(mode === 'browse')} onclick={(e) => { release(e); onMode('browse'); }}>Browse</button>
    </div>
    <button type="button" class="ghost" onclick={(e) => { release(e); onReset(); }}>Reset progress</button>
  </div>
</section>
```

- [ ] **Step 4: Write `QuestionCard.svelte`**

Create `quiz-app/src/components/QuestionCard.svelte`:

```svelte
<script>
  import Markdown from './Markdown.svelte';

  let { q, position, total, revealed, gotBefore, reviewMarked, onReveal, onMark, onNext } = $props();
</script>

<div class="meta">
  <span class="tag">{q.book}</span>
  {#if q.part}<span>{q.part}</span>{/if}
  <span>Question {position} of {total}</span>
  {#if gotBefore}<span class="badge-got">✓ got it before</span>{/if}
  {#if reviewMarked}<span class="badge-review">↻ marked for review</span>{/if}
</div>

<h2 class="question"><Markdown source={q.question} inline /></h2>

{#if q.prompt}
  <Markdown source={q.prompt} class="md prompt" />
{/if}

{#if revealed}
  <Markdown source={q.answer || '_No answer text._'} class="md answer" />
{/if}

<div class="actions">
  {#if !revealed}
    <button type="button" class="btn primary" onclick={onReveal}>Show answer<kbd>Space</kbd></button>
  {:else}
    <button type="button" class="btn review" onclick={() => onMark('review')}>Review again<kbd>R</kbd></button>
    <button type="button" class="btn got" onclick={() => onMark('got')}>Got it<kbd>G</kbd></button>
  {/if}
  <button type="button" class="btn" onclick={onNext}>Next<kbd>→</kbd></button>
</div>
```

- [ ] **Step 5: Replace `App.svelte`**

Replace the whole content of `quiz-app/src/App.svelte` with:

```svelte
<script>
  import questions from 'virtual:questions';
  import SetupBar from './components/SetupBar.svelte';
  import QuestionCard from './components/QuestionCard.svelte';
  import { buildDeck, filterQuestions, requeue, emptyProgress, markProgress, markSeen } from './lib/deck.js';
  import { loadProgress, saveProgress } from './lib/storage.js';

  const books = [...new Set(questions.map((q) => q.book))];
  const bookCounts = Object.fromEntries(books.map((b) => [b, questions.filter((q) => q.book === b).length]));
  const byId = new Map(questions.map((q) => [q.id, q]));

  let selected = $state([]); // book names; empty = all books
  let part = $state('');
  let mode = $state('shuffle');
  let deck = $state([]);
  let pos = $state(0);
  let revealed = $state(false);
  let progress = $state(loadProgress());
  let cardEl = $state(null);

  const parts = $derived(
    selected.length === 1
      ? [...new Set(questions.filter((q) => q.book === selected[0] && q.part).map((q) => q.part))]
      : []
  );
  const current = $derived(pos < deck.length ? byId.get(deck[pos]) : null);
  const stats = $derived.by(() => {
    const scope = filterQuestions(questions, new Set(selected), part);
    const count = (list) => {
      const set = new Set(list);
      return scope.filter((q) => set.has(q.id)).length;
    };
    return { total: scope.length, seen: count(progress.seen), got: count(progress.got), review: count(progress.review) };
  });

  function save(next) {
    progress = next;
    saveProgress(next);
  }

  function markCurrentSeen() {
    if (current) save(markSeen(progress, current.id));
  }

  function newDeck() {
    deck = buildDeck(questions, { books: new Set(selected), part, mode });
    pos = 0;
    revealed = false;
    markCurrentSeen();
  }

  function toggleBook(book) {
    selected = selected.includes(book) ? selected.filter((b) => b !== book) : [...selected, book];
    part = '';
    newDeck();
  }

  function allBooks() {
    selected = [];
    part = '';
    newDeck();
  }

  function setPart(p) {
    part = p;
    newDeck();
  }

  function setMode(m) {
    mode = m;
    newDeck();
  }

  function resetProgress() {
    if (!window.confirm('Reset all saved progress?')) return;
    save(emptyProgress());
    newDeck();
  }

  function reveal() {
    if (current && !revealed) revealed = true;
  }

  function advance() {
    if (!current) return;
    pos += 1;
    revealed = false;
    markCurrentSeen();
    if (cardEl) cardEl.scrollIntoView({ block: 'start' });
  }

  function mark(kind) {
    const q = current;
    if (!q || !revealed) return;
    save(markProgress(progress, q.id, kind));
    if (kind === 'review') deck = requeue(deck, pos, q.id);
    advance();
  }

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
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
  }

  newDeck();
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <header class="top">
    <h1>Interview Quiz</h1>
    <div class="stats" aria-live="polite">
      {stats.seen} / {stats.total} seen · {stats.got} got it · {stats.review} to review
    </div>
  </header>

  <SetupBar
    {books}
    counts={bookCounts}
    total={questions.length}
    {selected}
    {parts}
    {part}
    {mode}
    onToggleBook={toggleBook}
    onAllBooks={allBooks}
    onPart={setPart}
    onMode={setMode}
    onReset={resetProgress}
  />

  <section class="card" bind:this={cardEl} aria-live="polite">
    {#if deck.length === 0}
      <div class="empty"><p>No questions match this filter.</p></div>
    {:else if !current}
      <div class="empty">
        <p>Deck finished. Nice work.</p>
        <button type="button" class="btn primary" onclick={newDeck}>Start again</button>
      </div>
    {:else}
      <QuestionCard
        q={current}
        position={pos + 1}
        total={deck.length}
        {revealed}
        gotBefore={progress.got.includes(current.id)}
        reviewMarked={progress.review.includes(current.id)}
        onReveal={reveal}
        onMark={mark}
        onNext={advance}
      />
    {/if}
  </section>
</main>
```

- [ ] **Step 6: Build and test**

Run: `cd quiz-app && npm run build && npm test`
Expected: the build prints the per-book counts (TOTAL 663) with no Svelte compile errors, then publishes `quiz.html`; tests PASS — 34 tests (the dist test now runs against the real UI build: one `<script`, one `</script`, all 663 ids present).

- [ ] **Step 7: Commit**

```bash
git add quiz-app
git commit -m "feat(quiz-app): rebuild the quiz UI as Svelte components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Remove the old build, verify in the browser

**Files:**
- Delete (git rm): `interview-topics/quiz.html`, `interview-topics/build-quiz.js`, `interview-topics/quiz-src/template.html`, `interview-topics/quiz-src/vendor/marked.min.js`
- Modify only if a check fails: `quiz-app/src/**`, then rebuild

**Interfaces:**
- Consumes: the committed `quiz-app/quiz.html` (Task 4).
- Produces: a verified app; `interview-topics/` holds only the md books and `frontend-interview-bl-practice.html`.

Serve `quiz-app/` for the browser checks with a temporary `interview-topics/.claude/launch.json` (config `quiz-app-static`: `python -m http.server 8765 --directory ../quiz-app`, port 8765), `preview_start`, and open `http://localhost:8765/quiz.html`. Stop the servers and delete the temporary config at the end of the task.

- [ ] **Step 1: Remove the old files and build from both working directories**

```bash
git rm -q interview-topics/quiz.html interview-topics/build-quiz.js interview-topics/quiz-src/template.html interview-topics/quiz-src/vendor/marked.min.js
ls interview-topics
cd quiz-app && npm run build && node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('quiz.html')).digest('hex'))"
```

then, with the repo root as the working directory (not `npm --prefix`, which would run inside `quiz-app/` again):

```bash
node quiz-app/node_modules/vite/bin/vite.js build quiz-app && node quiz-app/scripts/publish.js && node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('quiz-app/quiz.html')).digest('hex'))"
cd quiz-app && npm test
```

Expected: `ls` shows the nine `.md` books and `frontend-interview-bl-practice.html` only (no `quiz-src/`); both builds print TOTAL 663 and the same hash (proving the books path and the publish paths do not depend on the working directory); 34 tests pass.

- [ ] **Step 2: Smoke check**

Open the served page. Console errors: none. Run in the page:

```js
({ stats: document.querySelector('.stats').textContent.trim(), chips: document.querySelectorAll('.chip').length, card: document.querySelector('.card').innerText.slice(0, 80) })
```

Expected: stats `1 / 663 seen · 0 got it · 0 to review` (fresh origin), 10 chips (All books + 9), a question card with a book tag and "Question 1 of 663".

- [ ] **Step 3: Rendering and prompts**

- Select `JavaScript` → Part "Section 9 — Output Prediction Puzzles": "What does this code output?" with highlighted code before reveal; Space reveals only the explanation.
- Select `CSS` → "Part 9 — Rapid-Fire and Debugging Puzzles": snippet before reveal, no `<details>` after reveal.
- Select only `CSS`, Browse, reveal Question 1 ("How does the cascade decide which rule wins?"): take a screenshot and confirm the answer shows a bordered table and a shaded code block (global markdown CSS applies inside `{@html}`).
- `NestJS` Part 4 = 9 questions, Part 5 = 20.

- [ ] **Step 4: Deck behaviour and storage**

- `React` alone: 66 and the Part dropdown is visible; add `CSS`: 127 and the dropdown is hidden; "All books": 663.
- `Next.js`, Browse: R on question 1 → it returns 5–9 cards later with "↻ marked for review"; G then moves it to got; run to the end → "Deck finished" + "Start again"; R on the last card appends it (Question 54 of 54).
- Old progress carries over: run `localStorage.setItem('interviewQuiz.progress.v1', JSON.stringify({ got: ['react-questions-ebook-1y64yp2'], review: [], seen: ['react-questions-ebook-1y64yp2'] }))` (an id the vanilla build saved for a React question; ids are unchanged), reload: stats read `… · 1 got it · 0 to review`.
- Corrupt `'{bad'` and wrong shape `'{"got":5}'` in that key, each followed by a reload: empty progress, no console errors.
- Blocked storage (`Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true })`), then reveal + G: no uncaught error.
- Reset (`window.confirm = () => true`, then click "Reset progress"): stats return to `0 got it · 0 to review`.

- [ ] **Step 5: Keyboard regression for every setup control**

With real clicks and key presses (`computer` tool, not dispatched events), after reloading the page each time:
1. Click `Browse`, press → twice, press Space: the answer reveals on Question 3 (no jump back to Question 1).
2. Click the `CSS` chip, press → twice, press Space: the answer reveals on Question 3 and the chip stays selected.
3. With `CSS` selected, pick a Part in the dropdown, then press Space: the answer reveals and `document.activeElement.tagName` is `BODY`.

- [ ] **Step 6: Dev server reload**

Add a second configuration to the temporary launch config: `quiz-app-dev`, `runtimeExecutable: "node"`, `runtimeArgs: ["../quiz-app/node_modules/vite/bin/vite.js", "../quiz-app", "--port", "5175", "--strictPort"]`, port 5175 (Vite is started directly because spawning plain `npm` can fail on Windows, where the executable is `npm.cmd`). Start it, open `http://localhost:5175/`, read the total (663). Append the line `<!-- dev reload probe -->` to the end of `interview-topics/react-questions-ebook.md`, wait two seconds, and confirm the page reloaded without a manual refresh (for example `performance.getEntriesByType('navigation')[0].startTime` changes, or a `window.__probe` flag set before the edit is gone). Then restore the file with `git checkout -- interview-topics/react-questions-ebook.md` and stop the dev server.

- [ ] **Step 7: Dark mode and mobile**

`resize_window` with `colorScheme: "dark"`: text, prompts and code are readable. `mobile` preset: `document.documentElement.scrollWidth === 375`, code blocks scroll inside the card, chips wrap. Reset to `desktop` / `light`. Stop the static server and delete `interview-topics/.claude/launch.json` and its folder.

- [ ] **Step 8: Double-click check (by the user)**

The browser pane blocks `file://`, so every check above ran over a local server. The design's real target is a double-click, so ask the user to double-click `quiz-app/quiz.html` once in their own browser and confirm the question card appears. If they report a problem, treat it as a failed check (Step 9). If the user is not available, list this as an open item in the final message instead of claiming it passed.

- [ ] **Step 9: Fix anything found, commit**

Any failed check: fix in `quiz-app/src/**` (pure helpers test-first), `npm run build`, `npm test`, and re-run the check. Then:

```bash
git add -A interview-topics quiz-app
git commit -m "chore(quiz): remove the vanilla build now that quiz-app is at parity" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** structure and file list (Tasks 1–4); data plugin with config-relative path, escaped JSON, count logging and `addWatchFile` (Task 2; dev reload checked in Task 5 step 6); single-file output and committed `quiz.html` via `publish.js` (Task 2); global markdown styles (Task 4 step 1, checked in Task 5 step 3); runes state on pure helpers (Task 4); exact versions and the fallback (Global Constraints, Task 2 step 9); toolchain proof before the UI migration (Task 2); `git mv` history and old-file deletion after parity (Tasks 1, 2, 5); same storage key (Task 3 test, Task 5 step 4); every setup control blurs (Task 4 SetupBar, Task 5 step 5); spec verification items 1–3 (Task 2 dist test, Task 5 steps 1–7).
- **Names:** `collect`, `safeJson`, `questionsModuleSource`, `questionsPlugin`, `escapeHtml`, `highlight`, `renderBlock`, `renderInline`, `STORE_KEY`, `loadProgress`, `saveProgress` are each defined once and used with the same signatures; deck helper signatures are unchanged from the vanilla plan.
- **Test counts:** 14 parse + 6 deck = 20 (Task 1); + 1 collect + 2 embed + 2 dist = 25 (Task 2); + 3 highlight + 2 markdown + 4 storage = 34 (Tasks 3–4).
- **Ordering caveat:** between Task 1 and Task 5 the old `interview-topics/build-quiz.js` is broken (its parser moved away); the committed old `quiz.html` still works and is deleted in Task 5.
- **Not exercised by a unit test:** Svelte component behaviour (verified in the browser, as in the vanilla build), dev-server reload (Task 5 step 6).
