# Quiz App (Svelte + Vite) — Design

Date: 2026-10-08 (revised after review: safe data embedding, toolchain proof first, exact versions, config-relative paths, global markdown styles, committed build output)
Amends: `2026-10-08-interview-quiz-design.md` (vanilla version, built on branch `feat/interview-quiz`)

## Goal

Move the quiz out of `interview-topics/` into its own project, `quiz-app/` (repo root), and rebuild its UI with Svelte + Vite. Behaviour, parsing rules, record shape, and the look stay exactly as in the first spec; only the structure and tooling change. The result is still **one offline file** the user can double-click, and it is committed so it works right after cloning.

## What does not change (carried over from the first spec)

- Source of questions: every `*.md` in `interview-topics/` (the books stay where they are).
- Parsing rules, the `{ id, book, part, question, prompt, answer }` record, id hashing, expected counts (CSS 61, Frontend Interview 117, Frontend System Design 70, HTML 64, JavaScript 72, NestJS 94, Next.js 53, Node.js 66, React 66 — total 663, 45 with a prompt), fail-loud errors.
- Features: book chips with counts, Part dropdown, Shuffle/Browse, prompt shown before reveal, Got it / Review again with requeue, Next, keyboard (Space, →, G, R), progress in `localStorage` (same key `interviewQuiz.progress.v1`, so existing progress carries over) with reset, empty and finished states, dark mode, mobile layout, offline.
- Both post-review fixes: parsing ignores markers inside code fences everywhere; every setup control (book chips, mode buttons, Part dropdown, reset) releases focus after use so the card shortcuts keep working. Svelte reuses DOM nodes, so chips must blur explicitly too (the vanilla page got this for free by rebuilding them).

## Structure

```
quiz-app/
  package.json            type: module; scripts: dev, build, test
  vite.config.js          svelte() + viteSingleFile() + questionsPlugin()
  index.html
  quiz.html               committed build output (copy of dist/index.html)
  scripts/publish.js      copies dist/index.html -> quiz.html after vite build
  src/
    main.js               mounts App
    App.svelte            layout, state, keyboard handling
    components/
      SetupBar.svelte     book chips, Part dropdown, mode toggle, reset
      QuestionCard.svelte meta, question, prompt, answer, action buttons
      Markdown.svelte     renders markdown via marked + highlighter ({@html})
    lib/
      parse.js            moved from interview-topics/quiz-src, now ESM
      collect.js          collect(dir) + book names + id hashing (from build-quiz.js)
      embed.js            safeJson(value): JSON with <, U+2028, U+2029 escaped
      questions-plugin.js the Vite plugin below
      deck.js             moved, now ESM: shuffle, filterQuestions, buildDeck, requeue, progress helpers
      highlight.js        the small code highlighter, extracted so it can be tested
      storage.js          load/save progress with try/catch
    styles.css            GLOBAL: palette, dark-mode tokens, and all .md content styles
  test/                   node:test — parse, collect, embed, deck, highlight, dist checks
```

- **Data.** `questions-plugin.js` exposes a virtual module `virtual:questions` whose default export is `collect(BOOKS_DIR)`. `BOOKS_DIR` is resolved from the config file, `fileURLToPath(new URL('../interview-topics', import.meta.url))`, never from the current directory, so the build works from any working directory. The module source is `export default JSON.parse(<string literal>)`, where the string literal is built from `safeJson(questions)`, so no raw `<` from the books reaches the bundle. The plugin prints the per-book counts and the total on every build. It registers each md file with `addWatchFile`, so `npm run dev` reloads when a book is edited. Known limitation: a newly added md file is picked up on the next dev-server restart or build.
- **Output.** `npm run build` = `vite build && node scripts/publish.js`. Vite writes one self-contained `dist/index.html` (JS, CSS and data inlined by `vite-plugin-singlefile`); `publish.js` copies it to `quiz-app/quiz.html`, which is committed. `dist/` and `node_modules/` are git-ignored.
- **Markdown styles.** Svelte scopes component CSS, and scoped CSS does not reach HTML inserted with `{@html}`. All styles for rendered markdown (`.md pre`, `code`, `table`, `blockquote`, highlight classes) therefore live in the global `styles.css`, not in `Markdown.svelte`.
- **State.** Svelte 5 runes in `App.svelte` (`$state`, `$derived`); all deck and progress logic stays in the pure, tested `lib/` functions.
- **Dependencies, pinned exact.** `svelte 5.57.2`, `vite 8.3.3`, `@sveltejs/vite-plugin-svelte 7.3.1`, `vite-plugin-singlefile 2.3.3`, `marked 12.0.2`. `marked` is a runtime dependency; the rest are dev dependencies. No test framework beyond `node --test`. Components are verified in the browser, as in the vanilla build.

## Toolchain proof first

Vite 8 bundles with Rolldown, while `vite-plugin-singlefile` still lists Rollup as a peer. Before any migration, the first task is a minimal proof: a one-component app whose embedded data contains `</script>`, `<!--`, and U+2028, built to a single file, which must (a) contain exactly as many `</script` as script tags, and (b) load and show the data from `file://` (or a local server if the browser pane blocks `file://`). If the proof fails, fall back to Vite 7 with the matching `@sveltejs/vite-plugin-svelte` 6.x line, pin those exact versions, and record the change. The migration starts only after the proof passes.

## Migration of the existing files

Work continues on branch `feat/interview-quiz` under a new plan with its own progress ledger; the branch is merged once, at the end. `git mv` (history kept): `interview-topics/quiz-src/{parse,deck}.js` and their tests move into `quiz-app/src/lib/` and `quiz-app/test/`, converted to ESM; the logic in `build-quiz.js` becomes `collect.js` and `embed.js`; `quiz-src/template.html` is rewritten as the Svelte components and `styles.css`. After the Svelte app reaches parity (all checks below), delete `interview-topics/quiz.html`, `build-quiz.js`, the rest of `quiz-src/`, and the vendored `marked.min.js`. `interview-topics/` returns to holding only the md books and the existing practice HTML.

## Deferred minors (from the vanilla review) — not in scope

Space blocks page scrolling; focus is lost when the card re-renders and the whole card is a live region; no `data-theme="dark"` block; `<!--` not neutralised when inlining (now covered by the data escaping and the proof's dist check, but not for future vendored scripts); the highlighter treats JS `#` as a comment; table cells split on escaped pipes. They stay out of this change. (The highlighter is extracted and tested, so the `#` one is easy next.)

## Out of scope (YAGNI)

Search, timers, score history, editing questions in the browser, Astro, SSR, routing, a component test framework.

## Verification

1. `npm test` (node:test): parser (all existing cases), collect (unique ids, fail-loud), `safeJson`, deck helpers, highlighter basics, and a dist check that runs against the committed `quiz.html`: `</script` count equals the script-tag count, no `http(s)://` script or stylesheet references, and the embedded data decodes to 663 records.
2. Build twice: `npm run build` inside `quiz-app/`, and Vite + `publish.js` invoked directly with the repo root as the working directory (`npm --prefix` does not count, because it runs scripts inside `quiz-app/`). Both print the expected per-book counts and write a byte-identical `quiz.html`.
3. Open `quiz.html` (served locally if `file://` is blocked) and repeat the vanilla checks: filters and part, puzzles and `<details>` prompts showing before reveal, NestJS extras, requeue, finished deck, review on the last card, persistence (including progress saved by the old page), corrupt/blocked storage, reset, dark mode, mobile width, markdown styling of tables and code, and the keyboard regression for every setup control (click Browse, a chip, or a Part option; advance twice; press Space: the answer reveals on the same card).
4. The user double-clicks `quiz-app/quiz.html` once in their own browser (the agent's browser pane blocks `file://`, so it cannot prove this itself).
