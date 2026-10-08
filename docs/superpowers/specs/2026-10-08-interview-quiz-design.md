# Interview Quiz Page — Design

Date: 2026-10-08 (revised after review: puzzle/`<details>` prompts, NestJS extras, safe inlining)
Location: `interview-topics/`

## Goal

One self-contained `quiz.html` that quizzes the user on every question in the `.md` interview books in `interview-topics/`. The user can draw random questions from all books mixed (interview style) or pick one or more books ("type" = md file). Personal study tool, offline, no backend.

## Approach

Build script embeds data (chosen by user). `build-quiz.js` (plain Node, no dependencies) parses the md files and writes `quiz.html` with the Q&A inlined as JSON. Re-run the script after editing any md file.

Rejected: runtime fetch (needs local server because of `file://`), folder picker (manual each time, Chromium only).

## Record

`{ id, book, part, question, prompt, answer }`, all strings.

- `question`: one line of inline markdown.
- `prompt`: markdown shown with the question **before** the answer is revealed (code snippet the question is about); `''` when there is none.
- `answer`: markdown revealed on demand.
- `part`: section label used as a sub-filter; `''` when there is none.
- `id`: `<file-slug>-<hash of question + prompt>`, so saved progress survives reordering the md files.
- `book`: display name derived from the file (e.g. "CSS", "React", "NestJS", "Frontend Interview").

## Components

### 1. `build-quiz.js`

Input: all `*.md` in `interview-topics/`. Headings and markers inside fenced code blocks are ignored everywhere (fences may be ``` or ~~~, and a longer fence is only closed by a fence at least as long). Line endings may be CRLF.

Parsing rules, per file:

1. **Q headings.** A heading `## Q<n>. <title>` or `### Q<n>. <title>` (`.` or `:`) starts a question. Its body runs until the next heading of the same or higher level; deeper subsections stay in the body; trailing `---` rules are dropped.
   - **`<details>` answers.** If the body has a `<details><summary>Answer</summary> … </details>` block (outside code), the text before it is the `prompt` and the block's inner text (plus anything after it) is the `answer`. (33 "predict the result" questions across CSS, HTML, Next.js, Node.js, React.)
   - **Untitled puzzles.** If the title is empty (`### Q61.`), the question is "What does this code output?", the leading code block(s) are the `prompt`, the rest is the `answer`. (12 questions in JavaScript Section 9.)
2. **Part.** The nearest preceding `# Part …` / `# Section …` H1. When a book has no such H1 (Frontend Interview), the nearest preceding non-Q H2 (e.g. `## 0. Warm-up`).
3. **Extras outside Q sections.** In the direct content of a non-Q H2/H3 heading that is not inside a question's body, these are also questions (NestJS Parts 4–5, 29 items):
   - bold numbered prompts `**1. Design a URL shortener.**` followed by answer lines;
   - quoted bold bullets `- **"Tell me about a production incident."** answer`;
   - `| Question | Answer |` tables, one question per row.
   Sections titled "prep plan", "preparation plan", "final advice", "cheat sheets", "self-scoring", "table of contents" are skipped.
4. **Fallback for books without Q headings** (`frontend-system-design-ebook.md`): each `## N. Topic` becomes "Explain: <Topic>"; `## N. Design …` keeps its title; the rapid-fire section (`1. **Question?** answer` list) becomes one question per item; `###` subsections stay inside the answer; skipped sections as above.

Output and errors:

- Prints per-book counts. Expected: CSS 61, Frontend Interview 117, Frontend System Design 70 (16 topics + 24 design problems + 30 rapid-fire), HTML 64, JavaScript 72, NestJS 94 (65 + 29 extras), Next.js 53, Node.js 66, React 66. Total 663.
- Fails loudly, naming the file, when the folder has no md files, a file is empty, or a book yields 0 questions.
- Inlines `marked` (pinned `12.0.2`, vendored once as a single file) and a minimal code highlighter so the page works offline. Inline scripts are made safe by rewriting any `</script` to `<\/script`; the JSON data escapes `<`, U+2028 and U+2029.

### 2. `quiz.html` (generated)

- **Setup bar:** book chips, multi-select, each with a count; an "All books" chip means random mix. A Part dropdown appears when exactly one book is selected and it has 2+ parts.
- **Modes:** Shuffle deck (random order, no repeats until the deck is exhausted) and Browse (sequential).
- **Card:** book tag, part, position; the question; the `prompt` (if any) rendered as markdown under it. "Show answer" reveals the rendered `answer`. "Got it" / "Review again" buttons; Review-again cards are re-queued 5–9 cards later. "Next" skips.
- **Keyboard:** Space = reveal, → = next, G = got it, R = review again.
- **Progress:** "seen / total · got · to review" for the current filter, kept in `localStorage` (every access in try/catch; page works without it; corrupt values reset to empty); reset button with confirm.
- **Look:** reuses the palette and dark-mode handling (`prefers-color-scheme` with a `data-theme` override) of `frontend-interview-bl-practice.html`. Uses system font stacks instead of Google Fonts so the page stays offline. Responsive for mobile.

## Out of scope (YAGNI)

Search, timers, score history, editing questions in the browser.

## Error handling

- Build: the failures listed above, with the file name.
- Page: if the selected filter has no questions, show an empty state; a finished deck shows "Start again". If `localStorage` throws or holds bad data, continue without persistence.

## Verification

1. `node --test` for parser, deck helpers, and build (embedding safety, fail-loud cases).
2. Run `node build-quiz.js`; compare per-book counts with the expected counts above.
3. Open `quiz.html` in the browser: filter by book and part, shuffle without repeats, a puzzle question shows its code before reveal, a `<details>` question shows its snippet before reveal, NestJS rapid-fire rows appear, reveal an answer with code blocks, mark got/review, reload and confirm progress persists, corrupt storage, reset.
4. Check dark mode and mobile width.
