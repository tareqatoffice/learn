# Learn Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one Next.js app in `web/` (Google sign-in, MongoDB) that replaces the static quiz, learning-graph pages and markdown notes with an interview quiz, learning graphs, a notes reader, per-user tracking, an admin editor and a bulk-import API/CLI, then import the legacy files and delete them.

**Architecture:** App Router pages render content from Mongoose models. UI mutations are Server Actions that call plain service modules (`src/content`, `src/progress`, `src/admin`), and the services carry all the logic and tests. One parser and import pipeline (`src/content/parse/*`, `src/content/import/*`) serves the legacy importer, the admin "Import markdown" page and the token API/CLI.

**Tech Stack:** Next.js (App Router, TypeScript), Auth.js `next-auth` v5 (Google), Mongoose, Tailwind CSS + shadcn/ui, react-markdown + remark-gfm + rehype-raw + rehype-sanitize + rehype-slug + rehype-highlight, github-slugger, zod, Vitest + mongodb-memory-server + Testing Library, tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-10-19-learn-platform-design.md`. Read it before any task; this plan argues from it.

## Global Constraints

- Node ≥ 22. App lives in `web/`. TypeScript strict.
- Install current stable versions at scaffold time. Use `next-auth@beta` if `next-auth@latest` still resolves to v4.
- Google is the only sign-in provider in production. JWT sessions with no Auth.js adapter. The one exception is the dev-only login in Task 3.
- Env vars, exact names: `MONGODB_URI`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS` (comma-separated). Task 3 adds `AUTH_DEV_LOGIN`; the CLI uses `LEARN_API_URL` and `LEARN_API_TOKEN`.
- Content `status` is exactly `draft | published | archived`. Users only see `published` items whose parent is `published`. Progress totals exclude everything else.
- Content is never hard-deleted. Every admin or API write to an existing content doc first stores the previous full doc in `revisions`.
- Every admin page, Server Action and admin route checks admin on the server.
- Sanitizer allow-list on top of the default schema: `details`, `summary`, `a`, `kbd`, `br`, `sup`, `sub`. Font stack includes Noto Sans Bengali.
- Top bar: `Learn` · Dashboard · Interview · Graphs · Notes · Admin (admins only) · avatar menu (sign out).
- Quiz: modes `unseen | review | all`, deck sizes 10 / 20 / 50 / All, keys Space (reveal), G (got), R (review), S (skip).
- `readMinutes = ceil(words / 200)`.
- Import: `dryRun` defaults to `true`, new items are `draft` unless `publish`, and an import never deletes or archives anything.
- API tokens: only the SHA-256 hash is stored. Tokens have content scope only.
- Expected legacy counts:
  - **Books:** css-questions-ebook 61, frontend-interview-bl 183, frontend-system-design-ebook 70, html-questions-ebook 64, javascript-explained-ebook 72, nestjs-interview-guide 94, nextjs-questions-ebook 53, nodejs-questions-ebook 66, react-questions-ebook 66 (total 729).
  - **Graphs:** backend-engineering 38, csharp-aspnet 38, database 37, frontend-engineering 36, go 37, javascript 37, nodejs 36, python 38 (total 297).
  - **Series:** docker 10, javascript 9, oop 9, dotnet 9, claude-code 6.
- Work on branch `feat/learn-platform`. Commit after every task. Commit messages follow `type(scope): summary`.

## Review Focus

1. **Markdown containing `<script>`, `on*=` attributes or `javascript:` links** (pushed through the API or pasted in admin) must render inert. Test: Task 4.
2. **Content archived or drafted after users have progress on it** must disappear from totals, the review pile and new decks, and be skipped in resumed quiz sessions. Tests: Tasks 11 and 15.
3. **A quiz setup that matches zero questions** (all seen, empty review pile, a topic with no linked questions) must return an "empty" result and create no session. Test: Task 11.
4. **A double-submitted quiz mark** (double click or two tabs) must record exactly one result, keep one progress doc, and never throw E11000. Test: Task 11.
5. **An admin removed from `ADMIN_EMAILS` while still holding a 30-day JWT** must lose admin on the next request. Test: Task 3.

---

## File Structure (`web/`)

```
web/
  package.json  tsconfig.json  next.config.ts  vitest.config.ts  components.json
  docker-compose.yml  .env.example  README.md
  src/
    auth.ts                     Auth.js config (Google, dev login, jwt/session callbacks)
    middleware.ts               route gating via routeAccess()
    lib/env.ts                  zod-parsed env
    lib/db.ts                   connectDb()
    lib/authz.ts                isAdminEmail, routeAccess, requireUser, requireAdmin, requireToken
    lib/ids.ts                  slugify, fnv1a, importKey
    lib/markdown/Markdown.tsx   isomorphic renderer
    lib/markdown/toc.ts         extractToc, readMinutes
    models/*.ts                 one file per collection + index.ts
    content/types.ts            shared parsed/preview types
    content/parse/questions.ts  parseBook
    content/parse/notes.ts      parseChapter
    content/parse/graph.ts      parseGraph, validateNode
    content/cycles.ts           findCycle
    content/revisions.ts        saveWithRevision, restoreRevision, listRevisions
    content/visibility.ts       visible* helpers
    content/queries.ts          read queries for pages
    content/import/run.ts       runImport
    content/pull.ts             pullBook, pullSeries, pullGraph
    content/backup.ts           exportContent, backupAll, restoreAll
    progress/questions.ts  progress/quiz.ts  progress/graph.ts  progress/notes.ts  progress/dashboard.ts
    graph/layout.ts             computeTiers, layoutGraph, readyNext
    admin/service.ts            admin write operations
    admin/tokens.ts             createToken, revokeToken, listTokens
    app/...                     pages, actions.ts per area, api routes
    components/...              TopBar, QuizCard, GraphView, TopicPanel, NoteReader, MarkdownEditor, ...
  scripts/import-legacy.ts  scripts/legacy-map.ts  scripts/content.ts  scripts/backup.ts  scripts/restore.ts  scripts/seed-dev.ts
  tests/                        mirrors src/ (vitest); tests/setup/mongo.ts
```

---

## Phase 1 — Foundation

### Task 1: Scaffold `web/`

**Files:**
- Create: `web/` via `create-next-app` (TS, App Router, Tailwind, ESLint, `src/` dir, alias `@/*`)
- Create: `web/vitest.config.ts`, `web/tests/setup/mongo.ts`, `web/docker-compose.yml`, `web/.env.example`, `web/README.md`, `web/src/lib/env.ts`
- Modify: root `.gitignore` (add `.superpowers/`)
- Test: `web/tests/lib/env.test.ts`

**Interfaces:**
- Produces:
  - `getEnv(): { MONGODB_URI: string; AUTH_SECRET: string; AUTH_GOOGLE_ID: string; AUTH_GOOGLE_SECRET: string; ADMIN_EMAILS: string[]; AUTH_DEV_LOGIN: boolean }`, lazily parsed and cached.
  - `resetEnvCache(): void`, for tests.
  - `tests/setup/mongo.ts`: a global setup that starts mongodb-memory-server (replica-set mode, so transactions work) and sets `process.env.MONGODB_URI`, plus `resetDb()` to drop all collections between tests.

- [ ] **Step 1:** Scaffold with `npx create-next-app@latest web --ts --app --tailwind --eslint --src-dir --import-alias "@/*"`. Run `npx shadcn@latest init`. Add dev deps: vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/user-event, mongodb-memory-server, tsx. Add deps: mongoose, zod, next-auth (see Global Constraints).
- [ ] **Step 2:** Write `tests/lib/env.test.ts`:
  - `getEnv()` splits `ADMIN_EMAILS=" A@x.com, b@y.com "` into `['a@x.com','b@y.com']` (trimmed, lower-cased).
  - Missing `MONGODB_URI` throws an error whose message contains `MONGODB_URI`.
  - `AUTH_DEV_LOGIN` defaults to `false`.
- [ ] **Step 3:** Run `cd web && npx vitest run tests/lib/env.test.ts`. Expect FAIL (module missing).
- [ ] **Step 4:** Implement `src/lib/env.ts` (zod) and `vitest.config.ts`:
  - Default environment `node`, with the `@` alias.
  - `globalSetup: tests/setup/mongo.ts`.
- [ ] **Step 5:** Run the test again. Expect PASS.
- [ ] **Step 6:** Write `docker-compose.yml` (`mongo:7` started with `--replSet rs0` plus an init healthcheck, port 27017, named volume) and `.env.example` listing every env var from Global Constraints. Write a `README.md` "Local dev" section: `docker compose up -d`, `cp .env.example .env.local`, `npm run dev`. Add `.superpowers/` to the root `.gitignore`.
- [ ] **Step 7:** Run `cd web && npm run build && npx vitest run`. Expect the build to succeed and the tests to pass.
- [ ] **Step 8:** Commit `chore(web): scaffold Next.js app with Tailwind, shadcn, Vitest`.

### Task 2: DB connection and models

**Files:**
- Create: `src/lib/db.ts`, `src/lib/ids.ts`, `src/models/{user,subject,questionBook,question,graph,graphNode,noteSeries,note,revision,apiToken,questionProgress,quizSession,nodeProgress,noteProgress,index}.ts`
- Test: `tests/models/indexes.test.ts`, `tests/lib/ids.test.ts`

**Interfaces:**
- Produces:
  - `connectDb(): Promise<typeof mongoose>`, cached on `globalThis`.
  - Models `User, Subject, QuestionBook, Question, Graph, GraphNode, NoteSeries, Note, Revision, ApiToken, QuestionProgress, QuizSession, NodeProgress, NoteProgress`, all exported from `@/models`.
  - Fields: exactly the spec's Data model, plus:
    - an `importedAt?: Date` marker on every content model
    - `cursor: number` (default 0) on `QuizSession`
  - `type Status = 'draft' | 'published' | 'archived'`, exported from `@/models`.
  - `slugify(s: string): string`.
  - `fnv1a(s: string): string`: base-36, a byte-for-byte port of `quiz-app/src/lib/collect.js`.
  - `importKey(bookSlug: string, question: string, prompt: string): string` = `` `${bookSlug}-${fnv1a(question + '\n' + prompt)}` ``.

- [ ] **Step 1:** Write `tests/lib/ids.test.ts`:
  - `fnv1a('')` equals `(0x811c9dc5).toString(36)`.
  - `importKey('react-questions-ebook','What is React?','')` equals the `id` that `collect()` currently gives that question. Read it once with `node -e` against `quiz-app/src/lib/collect.js` and hard-code it.
  - `slugify('Part 1 — Fundamentals')` returns `'part-1-fundamentals'`.
- [ ] **Step 2:** Write `tests/models/indexes.test.ts`. After `syncIndexes()`:
  - Inserting a second `QuestionProgress` with the same `{userId, questionId}` rejects with code 11000. Same for `NodeProgress {userId,nodeId}`, `NoteProgress {userId,noteId}`, `GraphNode {graphId,slug}`, `Note {seriesId,slug}`, `QuestionBook.slug`, `ApiToken.tokenHash` and `User.email`.
  - `Question.importKey` is unique sparse: two docs without it both insert.
  - `status: 'deleted'` on any content model fails validation.
- [ ] **Step 3:** Run `npx vitest run tests/models tests/lib/ids.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement the models with `timestamps: true` and the spec's index table. Use the `models.X || model(...)` guard for hot reload.
- [ ] **Step 5:** Run the tests. Expect PASS.
- [ ] **Step 6:** Commit `feat(web): add Mongo connection and Mongoose models`.

### Task 3: Auth and route protection

**Files:**
- Create: `src/auth.ts`, `src/middleware.ts`, `src/lib/authz.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/lib/authz.test.ts`, `tests/auth/signin.test.ts`

**Interfaces:**
- Consumes: `getEnv`, `resetEnvCache`, `User`.
- Produces:
  - `isAdminEmail(email: string | null | undefined): boolean`. Reads `getEnv().ADMIN_EMAILS` **on every call**.
  - `routeAccess(pathname: string, session: { email: string } | null): 'allow' | 'signin' | 'forbidden'`. `/` and `/api/auth/*` are public. `/api/content/*` returns `allow` (the token check happens in the route). `/admin/*` and `/api/admin/*` need an admin email. Everything else needs a session.
  - `class ForbiddenError extends Error { status = 403 }`
  - `requireUser(): Promise<{ userId: string; email: string; name: string; image?: string; isAdmin: boolean }>`. Redirects to `/` when signed out.
  - `requireAdmin(): Promise<same>`. Throws `ForbiddenError` when not an admin.
  - `upsertUserOnSignIn(profile: { sub: string; email: string; name: string; picture?: string }): Promise<{ userId: string; role: 'user'|'admin' }>`. Sets `lastLoginAt` and stores the role.
  - `getProviders(): Provider[]`, exported for tests.
  - Session shape: `session.user = { id, email, name, image, isAdmin }`.

Plan-level decision: when `NODE_ENV === 'development'` and `AUTH_DEV_LOGIN=true`, `getProviders()` adds a Credentials provider "Dev login" that takes an email and signs in through the same `upsertUserOnSignIn` (with `sub = 'dev:' + email`). It exists only so agents and the owner can test the UI locally without Google.

- [ ] **Step 1:** Write `tests/lib/authz.test.ts`:
  - `routeAccess('/dashboard', null)` returns `'signin'`.
  - `routeAccess('/', null)` returns `'allow'`.
  - `routeAccess('/admin/books', {email:'u@x.com'})` returns `'forbidden'` when `ADMIN_EMAILS='o@x.com'`.
  - The same call returns `'allow'` once `ADMIN_EMAILS` includes `U@X.com` (case-insensitive).
  - **Review Focus 5:** with the env set to include `o@x.com`, `isAdminEmail('o@x.com')` is `true`. After setting `process.env.ADMIN_EMAILS=''` and calling `resetEnvCache()`, the same call returns `false` and `routeAccess('/admin', {email:'o@x.com'})` returns `'forbidden'`.
  - `requireAdmin()` (with `@/auth` mocked to return a non-admin session) rejects with `ForbiddenError`.
- [ ] **Step 2:** Write `tests/auth/signin.test.ts`:
  - `upsertUserOnSignIn` called twice for the same `sub` leaves 1 `User` doc, with `lastLoginAt` updated.
  - The stored role is `'admin'` only for an `ADMIN_EMAILS` member.
  - `getProviders()` with `NODE_ENV='production'` and `AUTH_DEV_LOGIN='true'` contains no `credentials` provider.
- [ ] **Step 3:** Run `npx vitest run tests/lib/authz.test.ts tests/auth`. Expect FAIL.
- [ ] **Step 4:** Implement:
  - `auth.ts`: providers from `getProviders()`.
  - `jwt` callback: on sign-in, call `upsertUserOnSignIn` and put `userId` on the token.
  - `session` callback: `isAdmin = isAdminEmail(token.email)`, so admin status is recomputed on every request.
  - `middleware.ts`: map `routeAccess` results to redirect `/`, 403 or next.
- [ ] **Step 5:** Run the tests. Expect PASS.
- [ ] **Step 6:** Commit `feat(web): add Google sign-in, admin role and route protection`.

### Task 4: Markdown rendering

**Files:**
- Create: `src/lib/markdown/Markdown.tsx`, `src/lib/markdown/toc.ts`
- Modify: `src/app/layout.tsx` (fonts)
- Test: `tests/lib/markdown.test.tsx`, `tests/lib/toc.test.ts`

**Interfaces:**
- Produces:
  - `<Markdown source={string} inline?={boolean} />`. Works in server and client components (the admin preview reuses it). The pipeline: remark-gfm → rehype-raw → rehype-sanitize(schema) → rehype-slug → rehype-highlight. Sanitize runs **before** slug so ids are not prefixed with `user-content-`.
  - `extractToc(md: string): { depth: 2|3; text: string; anchor: string }[]`. Uses github-slugger, so anchors match rehype-slug. Fenced code is ignored.
  - `readMinutes(md: string): number` = `Math.max(1, Math.ceil(words/200))`.

- [ ] **Step 1:** Write the tests:
  - A GFM table renders `<table>`.
  - ```` ```js ```` code gets `hljs` classes.
  - `<details><summary>Answer</summary>x</details>` survives.
  - **Review Focus 1:** `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>` and `[x](javascript:alert(1))` render with no `<script>`, no `onerror` and no `javascript:` href.
  - Bangla text `বাংলায়` renders unchanged.
  - `extractToc('## A b\n```\n## not\n```\n### C')` returns `[{depth:2,text:'A b',anchor:'a-b'},{depth:3,text:'C',anchor:'c'}]`.
  - `readMinutes` of 401 words returns 3.
- [ ] **Step 2:** Run `npx vitest run tests/lib/markdown.test.tsx tests/lib/toc.test.ts` (`// @vitest-environment jsdom` in the `.tsx` test). Expect FAIL.
- [ ] **Step 3:** Implement the renderer and helpers. Load `IBM Plex Sans` and `Noto Sans Bengali` through `next/font/google`, and put both in the `--font-sans` stack.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Commit `feat(web): add sanitized markdown renderer and TOC helpers`.

---

## Phase 2 — Parsers and import pipeline

### Task 5: Question-book parser

**Files:**
- Create: `src/content/types.ts`, `src/content/parse/questions.ts`
- Test: `tests/content/parse-questions.test.ts`, `tests/content/parse-questions.real.test.ts`

**Interfaces:**
- Consumes: `slugify`, `importKey`.
- Produces (in `types.ts`):
  - `ParsedQuestion = { id?: string; question: string; part: string; prompt: string; answer: string; importKey: string }`
  - `ParsedBook = { id?: string; title?: string; intro: string; parts: { key: string; title: string }[]; extras: { key: string; title: string; body: string }[]; questions: ParsedQuestion[]; unaccounted: { line: number; heading: string }[] }`
  - `parseBook(md: string, bookSlug: string): ParsedBook`

Rules:

1. **Port** `quiz-app/src/lib/parse.js` to TypeScript unchanged. That covers fences, Q headings, `<details>`, untitled puzzles, the part rules, `sectionExtras`, rapid-fire and `parseNumberedSections`. Add the id-collision suffix (`-2`, `-3`) from `collect.js`, per book.
2. **B/T questions:** the Q-heading regex also accepts `B\d+` and `T\d+` (for example `^(?:Q|B|T)\d+[.:]\s*(.*)$`). For a body containing a line that starts with `**Answer:**` (outside fences):
   - `prompt` = the text before that line, trimmed.
   - `answer` = the rest, with the leading `**Answer:**` label removed.
3. **Extras:** sections the port currently drops become `extras`, with `key` = slugify(heading) and the body as raw markdown. These are the headings matching `SKIP_SECTION` other than "table of contents", plus `Appendix…` / `Final advice` headings and their bodies. Contents sections are dropped.
4. **Intro:** the markdown before the first part, question or extra heading, minus any `Contents` / `Table of contents` section and the book's H1. That H1 becomes `title`.
5. **Coverage:** every heading line outside fences must sit inside an intro, part heading, question (including its sub-headings), extra or dropped contents range. Anything else goes into `unaccounted`.
6. **Canonical (pulled) format:** used when the file contains `<!-- learn:` markers. In canonical mode, the markers decide the structure and the legacy heuristics are skipped.
   ```
   <!-- learn:book id=<ObjectId> -->
   # <title>
   <intro>
   <!-- learn:part key=<key> -->
   # <part title>
   <!-- learn:question id=<ObjectId> -->
   ## Q<n>. <question>
   <prompt>
   <!-- learn:answer -->
   <answer>
   <!-- learn:extra key=<key> -->
   ## <extra title>
   <body>
   ```

- [ ] **Step 1:** Port every case in `quiz-app/test/parse.test.js` and `collect.test.js` to Vitest in `parse-questions.test.ts`. They must pass unchanged against `parseBook`, comparing `question/part/prompt/answer` and the importKeys.
- [ ] **Step 2:** Add tests:
  - A `### B3. Title` body becomes a question with `prompt` `''`.
  - A `### T5. What does this print?` body with a code block, then `**Answer:** \`3\`. Because…` gives `prompt` = the code block and an `answer` starting with `` `3` ``.
  - A `## Appendix — A 10-day study plan` section becomes `extras[0]` with `key: 'appendix-a-10-day-study-plan'`.
  - A heading the rules don't cover ends up in `unaccounted`.
  - A canonical-format sample parses to exactly the given ids, parts, extras and prompt/answer split.
  - CRLF input gives the same result as LF.
- [ ] **Step 3:** Write `parse-questions.real.test.ts`, wrapped in `describe.skipIf(!existsSync(resolve(__dirname,'../../../interview-topics')))`. For each of the 9 files:
  - `parseBook(...).questions.length` equals the Global Constraints count.
  - `unaccounted` is `[]`.
  - The total is 729.
- [ ] **Step 4:** Run `npx vitest run tests/content/parse-questions`. Expect FAIL.
- [ ] **Step 5:** Implement `parseBook`. Iterate on the extras and coverage rules until the real-file test passes with zero unaccounted headings. Don't special-case file names.
- [ ] **Step 6:** Run the tests. Expect PASS.
- [ ] **Step 7:** Commit `feat(web): port question-book parser with B/T, extras and coverage`.

### Task 6: Note and graph parsers, cycle check

**Files:**
- Create: `src/content/parse/notes.ts`, `src/content/parse/graph.ts`, `src/content/cycles.ts`
- Test: `tests/content/parse-notes.test.ts`, `tests/content/parse-graph.test.ts`, `tests/content/cycles.test.ts`

**Interfaces:**
- Produces:
  - `ParsedChapter = { id?: string; slug: string; title: string; body: string }`
  - `parseChapter(md: string, fileName: string): ParsedChapter`:
    - `title` = the first H1 text, verbatim.
    - `body` = everything after that H1, trimmed.
    - `slug` = the file name without `.md` and without a leading `\d+-`.
    - Canonical form: a `<!-- learn:note id=<id> slug=<slug> -->` first line overrides `id` and `slug`.
  - `ParsedGraph = { id?: string; title?: string; subtitle?: string; footer?: string; tracks: { key: string; name: string }[]; nodes: ParsedNode[] }`, where `ParsedNode = { id?: string; slug: string; trackKey: string; title: string; prereqSlugs: string[]; summary: string; points: string[]; code: string; pitfall: string; docsUrl: string }`.
  - `parseGraph(input: unknown): { graph: ParsedGraph; errors: string[] }`:
    - Accepts the legacy shape (`title, sub, foot, tracks[{k,n}], nodes[{id,tr,t,pre,s,p,c,pit,u}]`), with an optional `_id` at graph and node level.
    - `errors` uses the exact rules and messages of `validate()` in `learning-graph/_src/build.mjs`: tracks 2..6, kebab ids, unique ids, known track, title ≤ 22 chars, `s/c/pit` non-empty, `p` ≥ 2 items, `u` absolute https, prerequisites exist.
    - A cycle error comes from `findCycle`.
  - `validateNode(node: ParsedNode, trackKeys: string[]): string[]`. Same per-node rules, reused by the admin editor.
  - `findCycle(edges: Record<string, string[]>): string[] | null`. Returns a closed path, e.g. `['a','b','a']`.

- [ ] **Step 1:** Write the tests:
  - `parseChapter('# Phase 3 — Networking\n\ntext', '03-networking.md')` returns `{slug:'networking', title:'Phase 3 — Networking', body:'text'}`.
  - The canonical marker overrides the slug.
  - `parseGraph` on the real `javascript.mjs` default export gives 37 nodes and `[]` errors (skip if the file is missing).
  - A node titled with 23 chars gives an error containing `over 22`.
  - `findCycle({a:['b'],b:['a']})` returns `['a','b','a']`.
  - A 3-node loop is found.
  - A DAG returns `null`.
- [ ] **Step 2:** Run `npx vitest run tests/content/parse-notes.test.ts tests/content/parse-graph.test.ts tests/content/cycles.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement the three modules.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Commit `feat(web): add note and graph parsers with cycle detection`.

### Task 7: Revisions and visibility

**Files:**
- Create: `src/content/revisions.ts`, `src/content/visibility.ts`
- Test: `tests/content/revisions.test.ts`, `tests/content/visibility.test.ts`

**Interfaces:**
- Produces:
  - `saveWithRevision<T>(model: Model<T>, id: string | null, data: Partial<T>, editedBy: string): Promise<HydratedDocument<T>>`:
    - When `id` exists: `Revision.create({entityType: model.modelName, entityId: id, snapshot: <lean previous doc>, editedBy, editedAt: new Date()})` before the update.
    - When `id` is null: create, with no revision.
  - `restoreRevision(revisionId: string, editedBy: string): Promise<void>`. Applies the snapshot through `saveWithRevision`, so the restore is itself revisioned.
  - `listRevisions(entityType: string, entityId: string): Promise<{ id: string; editedBy: string; editedAt: Date }[]>`, newest first.
  - Visibility:
    - `visibleBookIds(): Promise<Types.ObjectId[]>`
    - `visibleGraphIds(): Promise<Types.ObjectId[]>`
    - `visibleSeriesIds(): Promise<Types.ObjectId[]>`
    - `visibleQuestionFilter(bookIds?: string[]): Promise<FilterQuery<Question>>`: published, in a published book, optionally limited to `bookIds`.
    - `visibleNodeFilter(graphId?: string)` and `visibleNoteFilter(seriesId?: string)`: the same pattern.

- [ ] **Step 1:** Write the tests:
  - Two updates to a question give 2 revisions whose snapshots hold the 1st and 2nd text.
  - Restoring the 1st sets the text back and adds a 3rd revision.
  - A published question in a draft book is excluded by `visibleQuestionFilter`.
  - An archived question in a published book is excluded.
- [ ] **Step 2:** Run `npx vitest run tests/content/revisions.test.ts tests/content/visibility.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Commit `feat(web): add revision history and visibility filters`.

### Task 8: Import pipeline (`runImport`)

**Files:**
- Create: `src/content/import/run.ts`
- Modify: `src/content/types.ts` (add the types below)
- Test: `tests/content/import.test.ts`

**Interfaces:**
- Consumes: `parseBook`, `parseChapter`, `parseGraph`, `findCycle`, `saveWithRevision`, `extractToc`, `readMinutes`, `importKey`, models.
- Produces:
  - `ImportTarget = { kind: 'book' | 'series' | 'graph'; slug: string }`
  - `ImportSource = { kind: 'book'; markdown: string } | { kind: 'series'; files: { name: string; content: string }[] } | { kind: 'graph'; json: unknown }`
  - `ItemChange = { action: 'create' | 'update' | 'unchanged'; type: 'container' | 'question' | 'part' | 'extra' | 'note' | 'node' | 'track'; key: string; title: string; id?: string; fields?: string[] }`
  - `ImportReport = { target: ImportTarget; dryRun: boolean; createdTarget: boolean; creates: number; updates: number; unchanged: number; items: ItemChange[]; warnings: string[]; errors: string[] }`
  - `runImport(opts: { target: ImportTarget; source: ImportSource; dryRun?: boolean; publish?: boolean; editedBy: string; title?: string; subjects?: string[]; description?: string; importedAt?: Date }): Promise<ImportReport>`

Rules (spec, "Bulk content"):
- **Target container:**
  - A missing book, series or graph is created only when `title` is given. Otherwise `errors: ['target not found']`.
  - Container fields (`intro`, `title`, `subtitle`, `footer`, `description`) update only when the source or opts give a non-empty value.
  - `parts`, `extras` and `tracks` merge by key. New ones are appended; existing ones get their title or name updated.
- **Item matching:** in order, (1) the `id` from canonical markers; (2) `importKey` for questions, or slug within the container for notes and nodes; (3) otherwise a new item.
  - New items go after the current max `order`, in source order.
  - A matched item updates only the fields that differ.
  - `fields` lists the changed field names.
- **New item status:** `publish ? 'published' : 'draft'`. The status of existing items is never changed by an import.
- **Writes:**
  - Every update goes through `saveWithRevision(..., editedBy)`.
  - Notes recompute `toc` and `readMinutes`.
  - Nodes resolve `prereqSlugs` to ids in a second pass. An unresolved slug or a cycle (checked across existing plus incoming nodes) is an error, and nothing is written.
  - Subjects: `opts.subjects` sets the container's subjects on create; new children inherit the container's subjects.
  - `importedAt`, when given, is set on every created or updated doc.
- **Never** deletes or archives. `dryRun` (default `true`) computes the report and performs zero writes. Commit writes run in a transaction.
- Parse warnings from `unaccounted` headings go into `warnings`, and so do graph `errors` (which also block writing).

- [ ] **Step 1:** Write `tests/content/import.test.ts`:
  - **Dry run:** a book dry run over an empty DB with `title` reports `createdTarget: true` and `creates` = number of questions, and leaves `Question.countDocuments()` at 0.
  - **Commit:** the same run with `dryRun:false, publish:true` creates the questions as `published`, with `order` 1..n.
  - **Re-import:** re-running the identical source reports `unchanged` = n, `creates` 0.
  - **Edited answer:** changing one answer in the source reports `updates` 1 with `fields: ['answer']`, and writes 1 `Revision`.
  - **Missing item:** removing a question from the source leaves it in the DB, unchanged.
  - **Canonical id:** a canonical id match updates a question whose text changed (its importKey would no longer match).
  - **Graph cycle:** an incoming `pre` that creates a cycle returns an error containing `cycle` and writes nothing.
  - **Series:** a series import with 2 files creates 2 notes with `toc` filled.
  - **Duplicates (Review Focus):** two questions with identical text in one book get keys `…` and `…-2`, and re-import matches both (no new creates).
- [ ] **Step 2:** Run `npx vitest run tests/content/import.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `runImport`: plan first (pure diff against the DB), then apply the plan inside `session.withTransaction` when not a dry run.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Commit `feat(web): add shared import pipeline with dry-run preview`.

### Task 9: Legacy importer script

**Files:**
- Create: `scripts/import-legacy.ts`, `scripts/legacy-map.ts`, and an `"import:legacy": "tsx scripts/import-legacy.ts"` npm script
- Test: `tests/scripts/import-legacy.test.ts`

**Interfaces:**
- Consumes: `runImport`, models.
- Produces:
  - `importLegacy(opts: { repoRoot: string; dryRun: boolean; expected?: ExpectedCounts }): Promise<{ ok: boolean; message?: string; rows: { kind: 'book'|'graph'|'series'; slug: string; expected: number; actual: number }[] }>`
  - CLI exit code 1 when `!ok`. `repoRoot` defaults to `..` from `web/`.

Pinned values (`legacy-map.ts`):
- **Subjects (seeded in this order):** html, css, javascript, typescript, react, nextjs, nodejs, nestjs, frontend, backend, system-design, database, go, python, csharp-dotnet, docker, oop, claude-code. `name` is the display form (e.g. `Next.js`, `C# / .NET`, `Claude Code`).
- **Books:**
  - slug = file slug.
  - Titles: css-questions-ebook → CSS, frontend-interview-bl → Frontend Interview, frontend-system-design-ebook → Frontend System Design, html-questions-ebook → HTML, javascript-explained-ebook → JavaScript, nestjs-interview-guide → NestJS, nextjs-questions-ebook → Next.js, nodejs-questions-ebook → Node.js, react-questions-ebook → React.
  - Subjects: css [css, frontend]; frontend-interview-bl [frontend, react, nextjs, javascript]; frontend-system-design-ebook [system-design, frontend]; html [html, frontend]; javascript-explained-ebook [javascript]; nestjs-interview-guide [nestjs, nodejs, backend]; nextjs [nextjs, react, frontend]; nodejs [nodejs, backend]; react [react, frontend].
- **Graphs:**
  - slug = data file name.
  - Subjects: backend-engineering [backend]; csharp-aspnet [csharp-dotnet, backend]; database [database]; frontend-engineering [frontend]; go [go]; javascript [javascript]; nodejs [nodejs, backend]; python [python].
- **Series:**

  | Series | Source | Description | Title | Subjects |
  |---|---|---|---|---|
  | `docker` | `docker/notes` | `docker/LEARNING_PLAN.md` | Docker | [docker] |
  | `javascript` | `javascript/notes` | `javascript/LEARNING_PLAN.md` | JavaScript & Node (backend) | [javascript, typescript, nodejs, backend] |
  | `oop` | `oop/notes` | `oop/LEARNING_PLAN.md` | OOP | [oop] |
  | `dotnet` | `.net/notes` | `.net/LEARNING_PLAN.md` | C# / .NET | [csharp-dotnet] |
  | `claude-code` | `claude/*.md` minus `README.md` | `claude/README.md` | Claude Code | [claude-code] |
- **Expected counts:** from Global Constraints (`ExpectedCounts = { books: Record<string,number>; graphs: Record<string,number>; series: Record<string,number> }`).

Behaviour:
- Refuse (`ok:false`, with `message: 'database has content not created by the legacy import'`) if any content doc lacks `importedAt`.
- Run every `runImport` with `publish:true`, `editedBy:'legacy-import'` and the same `importedAt` for the whole run.
- Print a table of `kind slug expected actual OK/MISMATCH`.
- `--dry-run` is supported.

- [ ] **Step 1:** Write the test, using a temp `repoRoot` with 1 small book, 1 graph and 1 series fixture plus an `expected` override:
  - `ok: true` and the right rows.
  - A second run is idempotent: same counts, 0 creates.
  - A fixture with one question fewer than expected gives `ok:false`.
  - Pre-inserting a `Question` without `importedAt` gives `ok:false` with the refusal message.
- [ ] **Step 2:** Run `npx vitest run tests/scripts/import-legacy.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement. Load graphs with `(await import(pathToFileURL(file).href)).default`.
- [ ] **Step 4:** Run the tests. Expect PASS. Then run `docker compose up -d && npm run import:legacy -- --dry-run` against the real repo. Expect every row OK, with totals 729 / 297 / 43.
- [ ] **Step 5:** Commit `feat(web): add one-time legacy content importer`.

---

## Phase 3 — Reading, quiz and tracking

### Task 10: App shell and dev seed

**Files:**
- Create: `src/app/page.tsx` (landing), `src/app/(app)/layout.tsx`, `src/components/TopBar.tsx`, `src/components/ThemeToggle.tsx`, `scripts/seed-dev.ts` (`npm run seed:dev`)
- Modify: `src/app/layout.tsx` (theme tokens)
- Test: `tests/components/TopBar.test.tsx`

**Interfaces:**
- Consumes: `requireUser`, `auth`, `signIn`, `signOut`, `runImport` (for seeding).
- Produces:
  - `<TopBar user={{ name: string; image?: string; isAdmin: boolean }} />`, with the items in Global Constraints. The active link gets `aria-current="page"`. Below 768px it collapses to a menu button.
  - `(app)/layout.tsx` calls `requireUser()` and renders `<TopBar>`.
  - The landing page redirects signed-in users to `/dashboard` and otherwise shows "Sign in with Google". It also shows the dev login form when that provider is registered.
  - `seed-dev.ts` loads a small published fixture set (2 books, 1 graph with related links, 1 series) into the local DB through `runImport`. Used for manual checks before the real import.

- [ ] **Step 1:** Write the TopBar test:
  - Admin hidden for `isAdmin:false`, shown for `true`.
  - Links point to `/dashboard`, `/interview`, `/graphs` and `/notes`.
- [ ] **Step 2:** Run `npx vitest run tests/components/TopBar.test.tsx`. Expect FAIL.
- [ ] **Step 3:** Implement. Light and dark themes come from CSS variables based on the palette in `learning-graph/_src/template.html`.
- [ ] **Step 4:** Run the test. Expect PASS. Then run `npm run build`. Expect success.
- [ ] **Step 5:** Commit `feat(web): add app shell, top bar and landing page`.

### Task 11: Progress services

**Files:**
- Create: `src/progress/questions.ts`, `src/progress/quiz.ts`, `src/progress/graph.ts`, `src/progress/notes.ts`
- Test: `tests/progress/questions.test.ts`, `tests/progress/quiz.test.ts`, `tests/progress/graph.test.ts`, `tests/progress/notes.test.ts`

**Interfaces:**
- Consumes: models, the visibility helpers.
- Produces:
  - `markQuestion(userId: string, questionId: string, result: 'got'|'review'|'skip'): Promise<void>`:
    - A single `updateOne` with `upsert`: `$inc seenCount`, `$set lastSeenAt` (plus `status` unless the result is skip), `$setOnInsert bookId` (plus `status: null` on skip).
    - On E11000, retry once.
  - `QuizFilter = { bookIds: string[]; partKeys: string[]; mode: 'unseen'|'review'|'all'; size: 10|20|50|null; questionIds?: string[] }`
  - `createSession(userId: string, filter: QuizFilter, rand?: () => number): Promise<{ sessionId: string } | { empty: true }>`
  - `SessionView = { sessionId: string; position: number; total: number; done: boolean; counts: { got: number; review: number; skip: number }; current: null | { id: string; question: string; prompt: string; answer: string; bookSlug: string; bookTitle: string; partTitle: string; topic?: { graphSlug: string; nodeSlug: string; title: string } } }`
  - `getSessionView(userId: string, sessionId: string): Promise<SessionView | null>`. Returns `null` when the session doesn't belong to the user.
  - `recordResult(userId: string, sessionId: string, questionId: string, result: 'got'|'review'|'skip', rand?: () => number): Promise<SessionView>`
  - `finishSession(userId: string, sessionId: string): Promise<void>`
  - `listUnfinished(userId: string): Promise<{ id: string; label: string; position: number; total: number; startedAt: Date }[]>`
  - `sessionLabel(bookTitles: string[], partTitle?: string): string`: the titles joined with " · " (or "Mixed" for 3+ books), plus ` · <part>` when there's one part.
  - `requeueIndex(deckLength: number, cursor: number, rand: () => number): number` = `Math.min(deckLength, cursor + 1 + 4 + Math.floor(rand() * 5))` (from `deck.js`).
  - `setNodeStatus(userId: string, nodeId: string, status: 'none'|'learning'|'done'): Promise<void>`:
    - `none` deletes the doc.
    - `learning` sets the status, `$setOnInsert startedAt`, and unsets `doneAt`.
    - `done` sets the status and `doneAt`, with `$setOnInsert startedAt`.
    - The node must be visible, else `ForbiddenError`.
  - `getGraphProgress(userId: string, graphId: string): Promise<Record<string, 'learning'|'done'>>`
  - `openNote(userId: string, noteId: string): Promise<void>`
  - `setNoteRead(userId: string, noteId: string, read: boolean): Promise<void>`
  - `getSeriesProgress(userId: string, seriesId: string): Promise<Record<string, { read: boolean }>>`

Quiz rules:
- **Deck:** `createSession` takes visible questions matching the books (all books when empty), the parts (only when exactly one book is selected) and the mode:
  - `unseen`: no progress doc.
  - `review`: `status 'review'`.
  - `all`: everything.
  - `questionIds`: overrides books and parts; the mode still applies.

  It shuffles with `rand`, slices to `size`, and stores `questionIds`, `cursor: 0` and `results: []`. An empty deck returns `{ empty: true }` and inserts nothing.
- **Current card:** `getSessionView` advances `cursor` past ids that are no longer visible, without recording results, before picking the current card. `done` = cursor ≥ length or `finishedAt` set.
- **Recording a result:**
  - When `questionId !== current.id` or the session is done, return the current view unchanged (idempotent).
  - Otherwise: push the result, call `markQuestion`, and `cursor += 1`.
  - On `review`, also insert the id at `requeueIndex(len, cursor-1, rand)`.
  - When the cursor reaches the end, set `finishedAt`.
  - Use a conditional `updateOne({ _id, userId, cursor: expectedCursor })` so concurrent submits can't both apply. Call `markQuestion` only when that update matched.
- **Counts:** the last result per unique question.
- **`topic`:** the first visible node whose `related.questionIds` contains the question.

- [ ] **Step 1:** Write the tests:
  - **`markQuestion`:** got then review gives one doc with `status 'review'` and `seenCount 2`. A skip on a new question gives `status null` and `seenCount 1`.
  - **Review Focus 4:** `await Promise.all([recordResult(u,s,q,'got'), recordResult(u,s,q,'got')])` gives exactly 1 entry in `results`, 1 `QuestionProgress` doc with `seenCount 1`, and no rejection.
  - **Review Focus 3:** `createSession` with `mode:'review'` when no progress exists returns `{empty:true}` and `QuizSession.countDocuments()` is 0. The same holds for `questionIds: []`.
  - **Review Focus 2:** archiving the 2nd question of a 3-card session makes `getSessionView` after card 1 return card 3, with `done` after card 3.
  - **Requeue:** with `rand = () => 0`, marking `review` at cursor 0 in a 10-card deck re-inserts that id at index 5.
  - **Parts:** `partKeys` are ignored when 2 books are selected.
  - **Ownership:** another user's `sessionId` returns `null`.
  - **Graph:** `setNodeStatus` none → learning → done → none leaves no doc, and `startedAt` stays the same between learning and done.
  - **Notes:** `openNote` twice updates `lastOpenedAt` and leaves one doc.
- [ ] **Step 2:** Run `npx vitest run tests/progress`. Expect FAIL.
- [ ] **Step 3:** Implement the four modules.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Commit `feat(web): add progress and quiz session services`.

### Task 12: Interview pages

**Files:**
- Create: `src/content/queries.ts` (book and question queries), `src/app/(app)/interview/page.tsx`, `src/app/(app)/interview/actions.ts`, `src/app/(app)/interview/[book]/page.tsx`, `src/app/(app)/interview/[book]/[questionId]/page.tsx`, `src/app/(app)/interview/quiz/[sessionId]/page.tsx`, `src/components/QuizSetup.tsx`, `src/components/QuizCard.tsx`
- Test: `tests/components/QuizCard.test.tsx`, `tests/content/queries-books.test.ts`

**Interfaces:**
- Consumes: the Task 11 services, `<Markdown>`, `requireUser`.
- Produces:
  - `listBooksWithProgress(userId: string): Promise<{ id: string; slug: string; title: string; total: number; mastered: number; review: number; parts: { key: string; title: string }[] }[]>` (visible only).
  - `getBookView(userId: string, slug: string): Promise<{ book: { id; slug; title; intro; extras }; parts: { key; title; total; mastered }[]; questions: { id; question; partKey; status: 'got'|'review'|null }[] } | null>`
  - `getQuestionView(bookSlug: string, questionId: string): Promise<{ question: { id; question; prompt; answer }; book: { slug; title }; topic?: { graphSlug; nodeSlug; title } } | null>`
  - Server Actions:
    - `startQuizAction(filter: QuizFilter)`: redirects to `/interview/quiz/<id>`, or returns `{ empty: true }`.
    - `recordResultAction(sessionId, questionId, result)`: returns a `SessionView`.
    - `finishQuizAction(sessionId)`.
  - `<QuizCard view={SessionView} onResult={(r: 'got'|'review'|'skip') => Promise<SessionView>} onFinish={() => void} />`, a client component:
    - The answer is hidden until revealed.
    - Got it, Review and Skip are disabled while a call is pending.
- Behaviour:
  - `/interview` shows the books with progress bars, the setup panel (chips as in the wireframe; parts only when exactly one book is selected), and an "unfinished quizzes" list from `listUnfinished`.
  - An empty result shows "No questions match. Try another mode or book."
  - The book page shows the intro, parts with progress, extras (collapsible) and the question list linking to the question page.
  - The done screen shows counts and "Back to Interview".

- [ ] **Step 1:** Write `QuizCard.test.tsx` (jsdom):
  - Before reveal, the answer text is absent.
  - Pressing Space reveals it.
  - Pressing G calls `onResult('got')` once, even with a second G pressed while the promise is pending.
  - R and S map to review and skip.
  - Keys are ignored while focus is inside an input.
- [ ] **Step 2:** Write `queries-books.test.ts`:
  - `listBooksWithProgress` excludes draft books.
  - `mastered` counts only visible questions with `status 'got'`.
- [ ] **Step 3:** Run `npx vitest run tests/components/QuizCard.test.tsx tests/content/queries-books.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement the queries, actions, pages and components.
- [ ] **Step 5:** Run the tests. Expect PASS. Run `npm run build`. Then run `npm run seed:dev && npm run dev`, sign in with the dev login, and check: start a 10-card quiz, reveal, mark, finish, see the counts.
- [ ] **Step 6:** Commit `feat(web): add interview book pages and quiz flow`.

### Task 13: Graph pages

**Files:**
- Create: `src/graph/layout.ts`, `src/app/(app)/graphs/page.tsx`, `src/app/(app)/graphs/[slug]/page.tsx`, `src/app/(app)/graphs/actions.ts`, `src/components/GraphView.tsx`, `src/components/TopicPanel.tsx`
- Modify: `src/content/queries.ts` (graph queries)
- Test: `tests/graph/layout.test.ts`, `tests/components/TopicPanel.test.tsx`

**Interfaces:**
- Consumes: `setNodeStatus`, `getGraphProgress`, `startQuizAction`, `<Markdown>`.
- Produces:
  - `computeTiers(nodes: { id: string; prereqIds: string[] }[]): Record<string, number>`. Tier = 0 without prerequisites, else 1 + the max tier of its prerequisites (as `tierOf` in `template.html`).
  - `layoutGraph(nodes: { id: string; trackKey: string; prereqIds: string[] }[], tracks: { key: string }[]): { width: number; height: number; positions: Record<string, { x: number; y: number; tier: number }>; rows: { tier: number; y: number; first: boolean }[] }`. Port of `template.html` lines 126–165, with the same `NW, NH, GX, GY, TG, PAD` constants and row-wrapping. Read the file before it's deleted.
  - `readyNext(nodes: { id: string; prereqIds: string[] }[], progress: Record<string,'learning'|'done'>): string[]` = ids with no progress whose prerequisites are all `done`.
  - `listGraphsWithProgress(userId)` returns `{ slug; title; done; total }[]`.
  - `getGraphView(userId, slug)` returns `{ graph; nodes (visible, with related questions resolved to { id, title, href } and notes to { title, href: /notes/<series>/<chapter>#<anchor> }); progress }`.
  - `setNodeStatusAction(nodeId, status)`.
  - `<TopicPanel node status onStatus related />` with chips Not started / Learning / Done, summary, points (inline markdown), code (highlighted), pitfall, docs link, Related (questions with a "Quiz these" button that calls `startQuizAction({questionIds, mode:'all', bookIds:[], partKeys:[], size:null})`, plus note links) and prerequisites with status.
- Behaviour:
  - `?topic=<slug>` preselects a topic.
  - Track chips filter the view.
  - Node styles: done = filled, learning = dashed with a glow, ready = dotted ring.

- [ ] **Step 1:** Write `layout.test.ts`:
  - For `b` with prereq `a`, and `c` with prereqs `a` and `b`, `computeTiers` gives `{a:0, b:1, c:2}`.
  - `readyNext` with `a` done returns `['b']`.
  - On the real `javascript.mjs` (if present), no two positions share `(x, y)`.
- [ ] **Step 2:** Write `TopicPanel.test.tsx`:
  - Clicking "Done" calls `onStatus('done')`.
  - "Quiz these" is hidden when there are no related questions.
- [ ] **Step 3:** Run `npx vitest run tests/graph tests/components/TopicPanel.test.tsx`. Expect FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run the tests. Expect PASS. Run `npm run build`. Manual check on seeded data: change a status, reload, and confirm it persisted.
- [ ] **Step 6:** Commit `feat(web): add learning graph pages with per-user status`.

### Task 14: Notes pages

**Files:**
- Create: `src/app/(app)/notes/page.tsx`, `src/app/(app)/notes/[series]/page.tsx`, `src/app/(app)/notes/[series]/[chapter]/page.tsx`, `src/app/(app)/notes/actions.ts`, `src/components/NoteReader.tsx`
- Modify: `src/content/queries.ts` (note queries)
- Test: `tests/content/queries-notes.test.ts`

**Interfaces:**
- Consumes: `openNote`, `setNoteRead`, `getSeriesProgress`, `<Markdown>`.
- Produces:
  - `listSeriesWithProgress(userId)` returns `{ slug; title; read; total }[]`.
  - `getSeriesView(userId, slug)` returns `{ series: { slug; title; description }; chapters: { slug; title; readMinutes; read }[] } | null`.
  - `getChapterView(userId, seriesSlug, chapterSlug)` returns `{ series; chapter: { id; slug; title; body; readMinutes }; prev?: { slug; title }; next?: { slug; title }; toc; read; relatedTopics: { graphSlug; nodeSlug; title }[] } | null`.
  - `setNoteReadAction(noteId, read)`.
- Behaviour:
  - The chapter page calls `openNote` while rendering on the server.
  - Three columns: chapter list with ticks, body, and an "On this page" list from `toc`. On mobile they stack.
  - The footer has "Mark as read" (toggles to "Read ✓") and a "Next" link.
  - `relatedTopics` = visible nodes whose `related.notes.noteId` is this chapter.

- [ ] **Step 1:** Write the tests:
  - `getChapterView` gives the right `prev` and `next` by `order`, skipping draft chapters.
  - `relatedTopics` includes a node linking this note and excludes archived nodes.
  - `listSeriesWithProgress` `read` counts only visible chapters.
- [ ] **Step 2:** Run `npx vitest run tests/content/queries-notes.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expect PASS. Run `npm run build`. Manual check: open a chapter, mark it read, and see the tick in the list.
- [ ] **Step 5:** Commit `feat(web): add notes reader with read tracking`.

### Task 15: Dashboard

**Files:**
- Create: `src/progress/dashboard.ts`, `src/app/(app)/dashboard/page.tsx`
- Test: `tests/progress/dashboard.test.ts`

**Interfaces:**
- Consumes: models, visibility helpers, `readyNext`, `sessionLabel`, `startQuizAction`.
- Produces: `getDashboard(userId: string): Promise<Dashboard>`, where:
  ```ts
  type Dashboard = {
    continueReading: { seriesSlug: string; seriesTitle: string; chapterSlug: string; chapterTitle: string; read: number; total: number } | null;
    learningNow: { graphSlug: string; graphTitle: string; topics: { slug: string; title: string }[] }[];
    readyNext: { graphSlug: string; slug: string; title: string }[];   // max 3, from graphs with any progress
    reviewPile: { total: number; byBook: { slug: string; title: string; count: number }[] };
    graphs: { slug: string; title: string; done: number; total: number }[];
    books: { slug: string; title: string; mastered: number; total: number }[];
    series: { slug: string; title: string; read: number; total: number }[];
    recentQuizzes: { id: string; label: string; got: number; review: number; finishedAt: Date }[]; // last 5 finished
  };
  ```
- Behaviour:
  - Cards are laid out as in the wireframe.
  - "Start review quiz" calls `startQuizAction({mode:'review', bookIds:[], partKeys:[], size:20})`.
  - Empty states for new users: "Pick a graph to start", "Take your first quiz".

- [ ] **Step 1:** Write the tests:
  - With fixtures, every field has the expected values.
  - **Review Focus 2:** after archiving a question with `status 'review'`, `reviewPile.total` drops by 1 and the book's `total` drops by 1. A draft graph is absent from `graphs`. A `continueReading` chapter that gets archived falls back to the next most recently opened visible chapter, or `null`.
  - A new user gets `continueReading: null` and empty progress arrays.
- [ ] **Step 2:** Run `npx vitest run tests/progress/dashboard.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement with aggregation pipelines: one per section, keyed on the indexed `{userId, …}` fields.
- [ ] **Step 4:** Run the tests. Expect PASS. Run `npm run build`.
- [ ] **Step 5:** Commit `feat(web): add personal dashboard`.

---

## Phase 4 — Admin

### Task 16: Admin shell and question books

**Files:**
- Create: `src/admin/service.ts` (book and question functions), `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/books/**` (list, edit book, edit question), `src/app/admin/books/actions.ts`, `src/components/MarkdownEditor.tsx`, `src/components/StatusChips.tsx`, `src/components/SubjectPicker.tsx`
- Test: `tests/admin/books.test.ts`, `tests/admin/authz-actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `saveWithRevision`, `importKey`, `<Markdown>`.
- Produces (`service.ts`; every function takes `editedBy: string` last and returns `Result = { ok: true; id: string } | { ok: false; errors: Record<string, string> }`):
  - `saveBook(input: { id?: string; slug: string; title: string; intro: string; subjects: string[]; parts: { key: string; title: string }[]; extras: { key: string; title: string; body: string }[]; status: Status }, editedBy)`
  - `saveQuestion(input: { id?: string; bookId: string; partKey: string; question: string; prompt: string; answer: string; subjects: string[]; status: Status }, editedBy)`. A new question gets `order = max+1` and an `importKey`.
  - `moveItem(kind: 'book'|'question'|'graph'|'node'|'series'|'note'|'subject', id: string, dir: 'up'|'down', editedBy)`. Swaps `order` with the neighbour in the same parent.
  - `setStatus(kind: 'book'|'question'|'graph'|'node'|'series'|'note', id: string, status: Status, editedBy)`
  - `setQuestionTopicLink(questionId: string, nodeId: string, linked: boolean, editedBy)`. Writes `GraphNode.related.questionIds`.
  - All input is validated with zod.
- Behaviour:
  - Admin layout nav: Content (Question books, Graphs, Note series, Subjects) and System (Import markdown, Revisions, Export, API tokens, Users).
  - The editor uses side-by-side `<MarkdownEditor value onChange />` (textarea + `<Markdown>` preview) for `intro`, `prompt`, `answer` and extras.
  - The "+ link topic" picker searches nodes by title within the question's subjects.
  - Each action file starts with `'use server'`, and every action calls `requireAdmin()` first, then passes `user.email` as `editedBy`.

- [ ] **Step 1:** Write `books.test.ts`:
  - Editing a question's answer writes 1 revision.
  - `moveItem('question', q2, 'up')` swaps `order` with q1.
  - `setStatus` archived keeps the doc.
  - `setQuestionTopicLink(..., true)` twice adds the id once; `false` removes it.
  - Invalid input (empty `question`) returns `ok:false` with an `errors.question` key.
- [ ] **Step 2:** Write `authz-actions.test.ts`: with `@/auth` mocked to a non-admin session, every exported function in `src/app/admin/**/actions.ts` (collected with `import.meta.glob(..., { eager: true })`) rejects with `ForbiddenError` when called with `{}`. This test grows automatically as Tasks 17–20 add actions.
- [ ] **Step 3:** Run `npx vitest run tests/admin`. Expect FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run the tests. Expect PASS. Run `npm run build`. Manual check: edit a question, see the preview, save, and confirm the change on the reader page.
- [ ] **Step 6:** Commit `feat(web): add admin shell and question book editor`.

### Task 17: Admin graphs, notes and subjects

**Files:**
- Modify: `src/admin/service.ts`
- Create: `src/app/admin/graphs/**`, `src/app/admin/notes/**`, `src/app/admin/subjects/**` (pages and `actions.ts`), `src/components/PrereqPicker.tsx`, `src/components/RelatedPicker.tsx`
- Test: `tests/admin/graphs.test.ts`, `tests/admin/notes.test.ts`

**Interfaces:**
- Consumes: `validateNode`, `findCycle`, `extractToc`, `readMinutes`, `saveWithRevision`.
- Produces (same `Result` and `editedBy` conventions):
  - `saveGraph(input: { id?; slug; title; subtitle; footer; subjects; tracks: { key: string; name: string }[]; status }, editedBy)`. Tracks: 2..6.
  - `saveNode(input: { id?; graphId; slug; trackKey; title; prereqIds: string[]; summary; points: string[]; code; pitfall; docsUrl; subjects; status }, editedBy)`. Runs `validateNode` errors; prerequisites must be in the same graph. On a cycle it returns `errors.prereqIds = 'Creates a cycle: A → B → A'`, using node titles.
  - `setNodeNoteLink(nodeId: string, noteId: string, anchor: string, linked: boolean, editedBy)`. The anchor must exist in that note's `toc`, or be `''` for the whole chapter.
  - `saveSeries(input: { id?; slug; title; description; subjects; status }, editedBy)`
  - `saveNote(input: { id?; seriesId; slug; title; body; subjects; status }, editedBy)`. Recomputes `toc` and `readMinutes`.
  - `saveSubject(input: { id?; slug; name }, editedBy)`
- Behaviour:
  - `<PrereqPicker>` lists only same-graph nodes, excluding self.
  - `<RelatedPicker>` searches questions by text within the graph's subjects, and picks a note then one of its headings.

- [ ] **Step 1:** Write the tests:
  - `saveNode` with a prerequisite from another graph returns `ok:false`.
  - A cycle returns the message format above.
  - A 23-char title returns an error.
  - `saveNote` sets the `toc` from the body.
  - `setNodeNoteLink` with an unknown anchor returns `ok:false`.
- [ ] **Step 2:** Run `npx vitest run tests/admin/graphs.test.ts tests/admin/notes.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/admin`. Expect PASS, including `authz-actions`. Run `npm run build`.
- [ ] **Step 5:** Commit `feat(web): add admin editors for graphs, notes and subjects`.

### Task 18: Admin revisions, users and content export

**Files:**
- Create: `src/content/backup.ts` (`exportContent`), `src/app/admin/revisions/**`, `src/app/admin/users/page.tsx`, `src/app/admin/export/page.tsx`, `src/app/api/admin/export/route.ts`
- Test: `tests/content/export.test.ts`, `tests/admin/revisions.test.ts`

**Interfaces:**
- Consumes: `listRevisions`, `restoreRevision`, `requireAdmin`.
- Produces:
  - `exportContent(): AsyncIterable<string>`. Yields a canonical-EJSON document `{ "version": 1, "exportedAt": …, "collections": { "subjects": [...], "questionbooks": [...], "questions": [...], "graphs": [...], "graphnodes": [...], "noteseries": [...], "notes": [...] } }` in chunks, streaming each collection with a cursor.
  - `GET /api/admin/export` checks the session admin and streams it with `Content-Disposition: attachment; filename="learn-content-<YYYY-MM-DD>.json"`.
  - `restoreRevisionAction(revisionId)`.
  - Revisions UI: a "History" link per item lists `listRevisions`, with view (rendered snapshot JSON) and "Restore".
  - Users page: email, name, `lastLoginAt`, and counts of questionProgress, nodeProgress and noteProgress docs.

- [ ] **Step 1:** Write the tests:
  - The parsed export contains every content collection and **no** `users`, `questionprogresses`, `revisions` or `apitokens` keys.
  - ObjectIds survive `EJSON.parse`.
  - `restoreRevisionAction` as admin sets the old text back.
- [ ] **Step 2:** Run `npx vitest run tests/content/export.test.ts tests/admin/revisions.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expect PASS. Run `npm run build`.
- [ ] **Step 5:** Commit `feat(web): add revision history, users list and content export`.

---

## Phase 5 — Bulk content

### Task 19: Pull, API tokens and content API

**Files:**
- Create: `src/content/pull.ts`, `src/admin/tokens.ts`, `src/app/admin/tokens/**`, `src/app/api/content/route.ts` (list), `src/app/api/content/pull/route.ts`, `src/app/api/content/import/route.ts`
- Modify: `src/lib/authz.ts` (add `requireToken`)
- Test: `tests/content/pull.test.ts`, `tests/api/content.test.ts`

**Interfaces:**
- Consumes: `runImport`, models, `requireAdmin`.
- Produces:
  - `pullBook(slug: string): Promise<{ fileName: string; content: string }>`. The canonical format from Task 5, covering every status. Questions are numbered `Q<order>`. `fileName` = `<slug>.md`.
  - `pullSeries(slug: string): Promise<{ files: { name: string; content: string }[] }>`. Names follow `NN-<chapterSlug>.md` (NN = zero-padded order), and each file starts with the `learn:note` marker.
  - `pullGraph(slug: string): Promise<{ fileName: string; json: object }>`. The legacy shape, with `_id` on the graph and on each node.
  - `createToken(name: string, createdBy: string): Promise<{ id: string; token: string }>`. The token is `learn_` + 32 random bytes in base64url, returned once. `sha256(token)` hex is stored.
  - `revokeToken(id: string): Promise<void>` and `listTokens(): Promise<{ id; name; createdBy; lastUsedAt?; revokedAt? }[]>`.
  - `requireToken(req: Request): Promise<{ tokenId: string; name: string }>`. Throws a 401 response for a missing, unknown or revoked token, and updates `lastUsedAt`.
  - Routes:
    - `GET /api/content` returns `{ books, series, graphs: { id, slug, title, status }[] }`.
    - `GET /api/content/pull?kind=book|series|graph&slug=`
    - `POST /api/content/import` with body `{ target, source, dryRun?, publish?, title?, subjects?, description? }` returns `ImportReport` (status 400 when `errors` is non-empty). `editedBy = 'token:' + name`.
  - Only these three routes accept tokens. No user, progress or token data is reachable with a token.

- [ ] **Step 1:** Write `pull.test.ts`:
  - **Round trip:** for a fixture book with parts, extras, a prompt and a T-style question, `runImport({source:{kind:'book', markdown: (await pullBook(slug)).content}, dryRun:true})` reports `updates 0, creates 0`. The same holds for a series and a graph.
  - **Edit by id:** editing one answer in the pulled text and importing updates exactly that question by id.
- [ ] **Step 2:** Write `api/content.test.ts`. Call the route handlers directly with `new Request(...)`:
  - No header gives 401. A revoked token gives 401.
  - A valid token on `GET /api/content` gives 200.
  - An import without `dryRun` writes nothing.
  - An import with `dryRun:false` writes, and its revision `editedBy` starts with `token:`.
  - A token request to `/api/admin/export` gives 403 (session-only).
- [ ] **Step 3:** Run `npx vitest run tests/content/pull.test.ts tests/api/content.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement, including the admin Tokens page (create shows the token once with a copy button; list; revoke) with actions `createTokenAction(name)` and `revokeTokenAction(id)`.
- [ ] **Step 5:** Run the tests. Expect PASS. Run `npm run build`.
- [ ] **Step 6:** Commit `feat(web): add content API with tokens and lossless pull`.

### Task 20: Admin "Import markdown" page, CLI, backup and restore

**Files:**
- Create: `src/app/admin/import/page.tsx`, `src/app/admin/import/actions.ts`, `scripts/content.ts`, `scripts/backup.ts`, `scripts/restore.ts`; add the `content`, `backup` and `restore` npm scripts
- Modify: `src/content/backup.ts` (add `backupAll`, `restoreAll`)
- Test: `tests/scripts/content-cli.test.ts`, `tests/content/backup.test.ts`

**Interfaces:**
- Consumes: `runImport`, `exportContent`, the content API (Task 19).
- Produces:
  - `previewImportAction(input: { target: ImportTarget; source: ImportSource; title?: string; publish: boolean })` returns `ImportReport` (dry run). `commitImportAction(same)` returns `ImportReport` (commit).
  - The page takes a paste or file upload (multiple `.md` files for a series, `.json` for a graph), a target kind, an existing-or-new target (slug + title) and a publish toggle. It renders the report table, and Commit is enabled only after a successful preview with the same input.
  - `backupAll(filePath: string): Promise<{ counts: Record<string, number> }>`. Every collection, including users, progress, quizSessions, revisions and apiTokens, as canonical EJSON.
  - `restoreAll(filePath: string): Promise<{ counts: Record<string, number> }>`. Accepts a backup or a content export, inserts with the original `_id`s, and throws `target database is not empty` when any content or user doc exists.
  - CLI `npm run content -- <cmd>` (reads `LEARN_API_URL` and `LEARN_API_TOKEN`):
    - `list`
    - `pull <book|series|graph> <slug> [--out <dir>]`: writes the files.
    - `push <file...> (--book|--series|--graph) <slug> [--title <t>] [--commit] [--publish]`: prints the report table. Exit code 0 when there are no `errors`, else 1.
  - `parseCliArgs(argv: string[]): CliCommand` is exported for tests.
  - `npm run backup -- <file>` and `npm run restore -- <file>` use `MONGODB_URI`.

- [ ] **Step 1:** Write the tests:
  - `parseCliArgs(['push','a.md','--book','react','--commit'])` returns `{cmd:'push', files:['a.md'], target:{kind:'book',slug:'react'}, dryRun:false, publish:false}`.
  - A missing target flag throws an error containing `usage`.
  - Backup then restore into a fresh in-memory DB preserves the `_id` of a question **and** its `QuestionProgress.questionId`.
  - Restore into a non-empty DB throws.
- [ ] **Step 2:** Run `npx vitest run tests/scripts/content-cli.test.ts tests/content/backup.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expect PASS. Run `npm run build`. Manual check against the dev server:
  1. Create a token in admin.
  2. Run `npm run content -- pull book <slug> --out tmp`, edit one answer, and run `npm run content -- push tmp/<file> --book <slug>`. The preview shows 1 update.
  3. Run the push again with `--commit`. The change is visible in the app.
- [ ] **Step 5:** Add a `README.md` section "Adding content with Claude Code" covering the token, `pull`, `push`, preview and `--commit`, and "Backup & restore".
- [ ] **Step 6:** Commit `feat(web): add markdown import page, content CLI and backup/restore`.

---

## Phase 6 — Cut-over

### Task 21: Import the real content, owner check, delete legacy files

**Files:**
- Delete: `interview-topics/`, `learning-graph/`, `quiz-app/`, `docker/notes/`, `javascript/notes/`, `oop/notes/`, `.net/notes/`, `docker/LEARNING_PLAN.md`, `javascript/LEARNING_PLAN.md`, `oop/LEARNING_PLAN.md`, `.net/LEARNING_PLAN.md`, `claude/`, `web/scripts/import-legacy.ts`, `web/scripts/legacy-map.ts`, `web/tests/scripts/import-legacy.test.ts`, and the real-file tests that read those folders
- Modify: `docker/CLAUDE.md`, `javascript/CLAUDE.md`, `oop/CLAUDE.md`, `.net/CLAUDE.md`, `web/README.md` (Deploy section), `web/package.json` (remove `import:legacy`)
- Keep untouched: `best-practices/`, `.net/examples/`, `docs/`, `.vscode/`

- [ ] **Step 1:** Write the README "Deploy" section:
  - Create an Atlas cluster and the Google OAuth client (redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<vercel-domain>/api/auth/callback/google`).
  - Set the Vercel env vars.
  - `vercel deploy`.

  Deploying is the owner's step. Don't run it.
- [ ] **Step 2:** With `MONGODB_URI` pointing at the target database the owner names, run `cd web && npm run import:legacy -- --dry-run`, then `npm run import:legacy`. Expect every row OK: 729 questions, 297 topics, 43 chapters. Then run `npm run backup -- backups/after-import.json` (`backups/` is gitignored).
- [ ] **Step 3: STOP — owner checkpoint.** Ask the owner to check the imported content in the app and to confirm the deletion in chat. Don't continue without an explicit yes.
- [ ] **Step 4:** Delete the paths listed above with `git rm -r`. Rewrite each per-folder `CLAUDE.md` so that, instead of writing `notes/*.md` / `LEARNING_PLAN.md`, it says: content lives in the Learn app; write chapter markdown (first line H1), run `npm run content -- push <files> --series <slug>` to preview, then add `--commit`. Use `pull` to edit existing chapters. Use the series slugs from Task 9.
- [ ] **Step 5:** Verify:
  - `git ls-files '*.html'` prints nothing.
  - `cd web && npx vitest run && npm run build` passes.
- [ ] **Step 6:** Commit `chore: remove legacy content files after import into the Learn app`.
