# Learn Platform — Design

Date: 2026-10-19
Status: draft, awaiting owner approval
Location: `web/` (new Next.js app inside the `learn` repo)

## Intent

The `learn` repo holds three kinds of study material, each in its own format and with its own throwaway viewer:

- **Interview question books**: 9 markdown files in `interview-topics/`, quizzed through a Svelte single-file app in `quiz-app/`.
- **Learning graphs**: 8 `.mjs` data files in `learning-graph/_src/data/`, built into static HTML pages.
- **Learning notes**: markdown chapters in `docker/notes`, `javascript/notes`, `oop/notes`, `.net/notes` and `claude/`.

Progress lives only in each browser's localStorage, nothing links the three kinds together, and nobody else can use them.

The goal is one full-stack web app with three sections (Interview, Graphs, Notes). People sign in with Google and the app tracks what each person is learning. The owner is the **only author**: they edit everything in an admin area inside the app. After a one-time import, **MongoDB is the single source of truth**, and the old files and all HTML pages are deleted.

## Goals

1. Three sections: Interview questions (quiz), Learning graphs, Learning notes.
2. Google sign-in only.
3. Per-user progress tracking and a dashboard as the first screen after sign-in.
4. Admin editor inside the app for all content; Mongo is the source of truth.
5. One-time import of all existing content, followed by deletion of the source files and every HTML file.
6. Cross-links between sections: content is tagged by subject, and each graph topic links to its interview questions and note sections.

## Non-goals (v1)

- Leaderboards, social features, sharing, comments.
- Time-spent tracking, streaks, email or push reminders.
- Full-text search.
- More than one author, or any role beyond `user` and `admin`.
- Translated UI. Bangla appears only inside content markdown (see Content notes).
- Importing old localStorage quiz progress (`importKey` is kept so it stays possible later).
- Offline mode or PWA.
- The features of `interview-topics/frontend-interview-bl-practice.html` (owner's decision: deleted, not carried over):
  - typed or spoken answers before the reveal, and the saved typed answers in its localStorage
  - text-to-speech of answers
  - the English / Bangla / Both answer toggle
  - its search and filters

## Anti-goals (failure even if it "works")

- **Losing content.** Mongo is the only copy after import, so every admin save keeps a revision, there is no hard delete, and a full JSON export exists.
- **Progress breaking when content is edited.** Retitling, reordering, or moving a question to another part must never detach anyone's progress.
- **Admin reachable by non-admins.** Hiding UI is not enough: every admin route, server action and API handler checks the role on the server.
- **Import silently dropping content.** Import counts must match the existing parsers exactly, or the import fails.

## Users and roles

- **user**: any Google account can sign in (owner's call: open sign-up). Users read published content, take quizzes and track progress.
- **admin**: any account whose email is in the `ADMIN_EMAILS` env var (comma-separated). The role is stored on the user doc at each sign-in, so removing an email takes effect on that person's next sign-in.
- All pages except the landing page require sign-in (my call).

## Stack (decided)

| Area | Choice |
|---|---|
| App | One Next.js app (App Router, TypeScript) in `web/`. Pages and server code live together. |
| Auth | Auth.js (`next-auth` v5), Google provider only. |
| DB | MongoDB via Mongoose. |
| UI | Tailwind CSS + shadcn/ui. |
| Hosting | Vercel + MongoDB Atlas free cluster. |
| Local dev | Mongo in Docker Compose (`web/docker-compose.yml`). |
| Runtime | Node ≥ 22. |

My calls inside the stack:

- **Sessions:** JWT session strategy and no Auth.js database adapter. On sign-in, upsert the `users` doc with Mongoose and put `userId` and `role` on the token.
- **Markdown:** stored raw and rendered on the server with GFM (tables, fenced code), syntax highlighting and a sanitizer. The library is the builder's choice. Content includes `<details>` blocks and inline HTML links, so the sanitizer must allow a safe subset (`details`, `summary`, `a`, `kbd`, `br`, `sup`, `sub`).
- **Fonts:** the font stack includes Noto Sans Bengali so the Bangla text renders properly.

## Screens

Approved wireframes: `.superpowers/brainstorm/62993-1792400445/content/screens.html`. Ignore its left-sidebar card: the owner chose **top bar** navigation.

**Top bar:** `Learn` (logo) · Dashboard · Interview · Graphs · Notes · Admin (admins only) · avatar menu (sign out). On phones it collapses to a menu.

### Routes

| Route | Purpose |
|---|---|
| `/` | Landing page with a "Sign in with Google" button. Signed-in users are redirected to `/dashboard`. |
| `/dashboard` | Personal dashboard. |
| `/interview` | Book list with progress, plus the "New quiz" setup panel. |
| `/interview/[book]` | Book overview: parts with per-part progress, plus a browsable list of questions. |
| `/interview/[book]/[questionId]` | One question with its answer. Target of links from graph topics. |
| `/interview/quiz/[sessionId]` | Quiz card flow. |
| `/graphs` | Graph list with % done. |
| `/graphs/[slug]?topic=<nodeSlug>` | Graph view with the selected topic open in the detail panel. |
| `/notes` | Series list. |
| `/notes/[series]` | Series intro (from `LEARNING_PLAN.md`) and chapter list with read ticks. |
| `/notes/[series]/[chapter]#<anchor>` | Chapter reader. |
| `/admin/**` | Admin area (below). |

### Dashboard

- **Continue reading:** the note with the latest `lastOpenedAt`.
- **Learning now:** all topics with status `learning`, grouped by graph, plus "ready next" suggestions.
- **Review pile:** count of questions with status `review`, broken down by book, and a "Start review quiz" button.
- **Progress:** done/total topics per graph, mastered/total questions per book, read/total chapters per series.
- **Recent quizzes:** the last 5 finished sessions.

### Interview quiz

- **Setup:**
  - Books (multi-select).
  - Parts (shown when exactly one book is selected).
  - Mode: *Not seen yet* / *Review pile* / *Everything*.
  - Deck size: 10, 20, 50 or All.
- **"Quiz these"** on a graph topic starts a session from that topic's `related.questionIds`.
- Starting a quiz creates a `quizSessions` doc with the sampled, ordered `questionIds`.
- **Card:**
  - The question and its `prompt` (for example the code a puzzle asks about) show first.
  - "Show answer" reveals the answer.
  - Then the user picks **Got it**, **Review** or **Skip**.
  - Keyboard: Space reveals, G marks Got it, R marks Review, S skips.
- **Each mark:**
  - Appends to the session's `results`.
  - Upserts `questionProgress`: Got it and Review set `status`; every mark increments `seenCount` and sets `lastSeenAt`.
- **Port quiz behaviour:** shuffle, filtering, and the in-deck requeue of cards marked Review come from `quiz-app/src/lib/deck.js`. Read it before `quiz-app/` is deleted.
- **Leaving early:** the session stays unfinished. Only finished sessions appear in "Recent quizzes". Unfinished sessions can be resumed from `/interview` (my call).
- **Definitions:** *Mastered* = `status: got`. *Review pile* = `status: review`. *Seen* = a progress doc exists.

### Learning graph

- **Layout and rendering:** port from `learning-graph/_src/template.html`:
  - Tiers are computed from prerequisite depth.
  - SVG nodes are coloured by track, with track filter chips.
  - The detail panel sits beside the graph on desktop and below it on phones.
- **Statuses:**
  - Each topic is *Not started* (no doc), *Learning* or *Done*, set from chips in the detail panel.
  - *Ready next* = not started, with every prerequisite done.
- **Detail panel:** summary, key points, code, common mistake and docs link, plus **Related**: linked questions ("Quiz these" and links), linked note sections, and prerequisites with their status.
- **% done** = done ÷ published topics in the graph.

### Notes reader

- **Layout:** chapter list on the left with read ticks, the chapter in the middle, and an "On this page" list on the right built from the chapter's h2/h3 headings.
- **Anchors:** heading anchors are the slugified heading text and are stored in `notes.toc`. Graph topic links point at them.
- **Tracking:**
  - Opening a chapter upserts `noteProgress.lastOpenedAt`.
  - **Mark as read** is a manual button that sets `read` and `readAt` (my call: no auto-read on scroll).
  - The footer has a "Next chapter" link.
- **`readMinutes`** = word count ÷ 200, computed on save.

### Admin

- **Navigation:** Content (Question books, Graphs, Note series, Subjects) and System (Import markdown, Revisions, Export, API tokens, Users).
- **CRUD for every content type:**
  - Markdown fields get a side-by-side editor and live preview, using the same renderer as the reader.
  - Every item has a status: `draft` / `published` / `archived`.
  - Order is set with up/down controls (drag is optional).
  - Subject tags on every item.
- **Graph topic editor:**
  - Prerequisite picker limited to topics in the same graph. The server rejects saves that would create a cycle, and the error message names the cycle.
  - `related` picker: search questions by text within the graph's subjects, and pick a note chapter plus one of its headings.
  - Linking from the question editor ("+ link topic") writes to the graph topic's `related.questionIds`. There is one stored link, edited from either side.
- **Revisions:**
  - Every admin write stores the **previous** full document in `revisions`.
  - The History view lists revisions per item and can view or restore one. Restoring is itself a new revision.
  - No diff view in v1.
- **Export and backup:** Atlas free clusters have no automated backups, so this is the backup.
  - **Admin "Export content" button:** streams the content collections as one JSON file (subjects, books, questions, graphs, topics, series, notes). Users, progress and revisions are not included, because they're not needed to rebuild content and would make the download a dump of everyone's data. The response is streamed because the content alone is about 3 MB, close to Vercel's response limit.
  - **CLI `npm run backup`:** full backup of every collection, including users, progress, quiz sessions and revisions, to a local file.
  - **CLI `npm run restore -- <file>`:** loads either file into an empty database and **keeps the original `_id`s**, so progress reconnects to its content.
- **Users:** a read-only list showing email, name, last sign-in and progress counts.
- **Import markdown:** the browser form of the bulk import described in the next section. Paste or upload a file, pick the target, see the preview, confirm.
- **API tokens:**
  - Create a named token; it is shown once. List tokens with their last-used time, and revoke them.
  - Only the SHA-256 hash is stored.
- **Authorization:** middleware blocks `/admin/**`, and every admin server action or handler checks `role === 'admin'` again.

## Bulk content: import API and CLI (owner's choice)

After the cut-over, Claude Code keeps adding content in bulk the way it does today: it writes markdown in the same formats the books and notes use now, and pushes it.

- **Parsers are app code.** They are not deleted. The question-book parser (with the B/T and extras extensions) and the note-chapter parser live in `web/` with their tests. The one-time importer, the admin "Import markdown" page and the API all use them.
- **Formats:**
  - **Question book:** markdown in today's book format. A whole book or just a fragment of parts and questions.
  - **Note chapters:** one markdown file per chapter. The first H1 is the title.
  - **Graph:** JSON shaped like today's `.mjs` data (`tracks`, `nodes` with `id/tr/t/pre/s/p/c/pit/u`).
- **Matching existing items:**
  1. `pull` writes a `<!-- id: <ObjectId> -->` comment under each question heading, chapter title and graph node. On push, an id comment matches that exact item, so edits update it.
  2. Without an id comment, a question matches on `importKey`: the same hash of question and prompt that `collect()` uses for ids. A chapter matches on series + slug, and a graph node on graph + slug.
  3. Anything else is new and gets added in file order after existing items, or at the position the file implies when it is a full pull.
  - Items in the target but missing from the file are **never** deleted or archived by an import.
- **Preview, then commit:**
  - Every import runs as a dry run first. It reports new items, unchanged items, changed items (with field names) and parse warnings.
  - Committing applies the changes, and every change writes a revision (`editedBy` = user email or token name).
  - New items are created as `draft` unless the request says `publish`.
- **API** (`/api/content/**`, `Authorization: Bearer <token>`):
  - Endpoints: list books, series and graphs (slugs and ids); `pull` one book, series or graph; `import` with `dryRun` (default `true`).
  - Tokens have content scope only. They can't read or change users, progress or quiz sessions, and can't touch tokens.
  - Request size stays under Vercel's limit; the largest current book is well below it.
- **CLI** (`web/scripts/content.ts`, `npm run content -- <cmd>`): a thin wrapper over the API, configured by `LEARN_API_URL` and `LEARN_API_TOKEN`.
  - `list`
  - `pull <kind> <slug> [--out dir]`
  - `push <file> --book <slug> | --series <slug> | --graph <slug> [--commit] [--publish]`
  - Without `--commit` it prints the preview only.
- **Repo guidance:** in the deletion commit, the per-folder `CLAUDE.md` files in `docker/`, `javascript/`, `oop/` and `.net/` are rewritten to describe this workflow (write markdown, `push` to preview, `--commit`) instead of writing `notes/*.md`.

## Data model (MongoDB, Mongoose)

All collections use `timestamps: true` (`createdAt`, `updatedAt`). `_id` is the permanent identity and `slug` is for URLs only. Content `status` is `draft | published | archived`. Users only ever see `published` items whose parent is also `published`.

```
# identity
users            { email, name, image, googleId, role: 'user'|'admin', lastLoginAt }

# content (admin writes, everyone reads)
subjects         { slug, name, order }
questionBooks    { slug, title, intro, subjects[], parts[{ key, title, order }], extras[{ key, title, body, order }], order, status }
questions        { bookId, partKey, order, question, prompt, answer, subjects[], status, importKey }
graphs           { slug, title, subtitle, footer, subjects[], tracks[{ key, name, order }], order, status }
graphNodes       { graphId, slug, trackKey, title, prereqIds[], summary, points[], code, pitfall,
                   docsUrl, order, related: { questionIds[], notes[{ noteId, anchor }] }, subjects[], status }
noteSeries       { slug, title, description, subjects[], order, status }
notes            { seriesId, slug, title, order, body, toc[{ depth, text, anchor }], readMinutes, subjects[], status }
revisions        { entityType, entityId, snapshot, editedBy, editedAt }
apiTokens        { name, tokenHash, createdBy, lastUsedAt, revokedAt }

# per-user progress (one doc per user × item; no doc = not started / not seen)
questionProgress { userId, questionId, bookId, status: 'got'|'review'|null, seenCount, lastSeenAt }
quizSessions     { userId, filter{ bookIds[], partKeys[], mode, questionIds? }, questionIds[],
                   results[{ questionId, result: 'got'|'review'|'skip', at }], startedAt, finishedAt }
nodeProgress     { userId, graphId, nodeId, status: 'learning'|'done', startedAt, doneAt }
noteProgress     { userId, noteId, seriesId, read, readAt, lastOpenedAt }
```

Field notes:

- `question` is one line of inline markdown. `prompt` is markdown shown before the reveal (`''` if none). `answer` is markdown.
- `points` is an array of inline-markdown strings. `code` is plain text (JavaScript highlighting unless the graph says otherwise). `footer` and `intro` are markdown.
- `subjects[]` holds subject slugs.
- Copying `bookId`, `graphId` and `seriesId` into progress docs is deliberate: each dashboard count is then one indexed query.
- Choosing "Not started" on a topic deletes its `nodeProgress` doc.

### Why this shape

- **Questions, graph topics and note chapters have their own collections** instead of living as arrays inside the book, graph or series. There are about 730 questions, they are edited one at a time, and progress points at each one. Embedding them would rewrite the whole book on every edit.
- **Book parts and graph tracks stay embedded.** They are small and always loaded with their parent.
- **Progress is one small doc per (user, item)**, never arrays on the user doc. Arrays there would grow without limit and make per-book counts hard.
- **Nothing is hard-deleted** (`archived` instead), so progress references never dangle.
- **The graph topic is the hub for cross-links.** The reverse lookup ("which topic is this question in?") uses a multikey index on `related.questionIds`.

### Indexes

| Collection | Index |
|---|---|
| users | `email` unique, `googleId` unique |
| subjects, questionBooks, graphs, noteSeries | `slug` unique |
| questions | `{ bookId, partKey, order }`; `importKey` unique sparse; `subjects` |
| graphNodes | `{ graphId, slug }` unique; `{ graphId, order }`; `related.questionIds`; `related.notes.noteId` |
| notes | `{ seriesId, slug }` unique; `{ seriesId, order }` |
| revisions | `{ entityType, entityId, editedAt: -1 }` |
| apiTokens | `tokenHash` unique |
| questionProgress | `{ userId, questionId }` unique; `{ userId, bookId, status }` |
| quizSessions | `{ userId, startedAt: -1 }` |
| nodeProgress | `{ userId, nodeId }` unique; `{ userId, graphId }`; `{ userId, status }` |
| noteProgress | `{ userId, noteId }` unique; `{ userId, lastOpenedAt: -1 }` |

## One-time import

Script: `web/scripts/import-legacy.ts`, run with `npm run import:legacy`.

- **Idempotent.** It upserts by `slug` or `importKey`, so it can be re-run until the owner is happy.
- **Refuses** to run against a database that contains items not created by the import (my call: check for an `importedAt` marker).

### Questions (`interview-topics/*.md`)

- **Reuse the parser.** Move `quiz-app/src/lib/parse.js` and the id logic from `collect.js`, with their tests, into `web/` as app code (see Bulk content). The parsing rules in `docs/superpowers/specs/2026-10-08-interview-quiz-design.md` remain binding, with the extensions below.
- **All 9 files become question books.** That includes `frontend-system-design-ebook.md`: today's parser already turns its no-Q-heading layout into 70 quiz cards (16 "Explain:", 24 design problems, 30 rapid-fire), and the quiz keeps them. `collect()` today gives 695 records: CSS 61, Frontend Interview 149, Frontend System Design 70, HTML 64, JavaScript 72, NestJS 94, Next.js 53, Node.js 66, React 66.
- **Parser extension 1: B and T questions.** `frontend-interview-bl.md` has 34 questions the current parser skips:
  - `### B1.`–`B14.` in "6b. Browser & networking".
  - `### T1.`–`T20.` in "12. Tricky & trap questions".
  - The question heading pattern must also accept a `B<n>` or `T<n>` prefix.
  - For T questions, everything before the `**Answer:**` line is the `prompt` (the code stays visible before the reveal) and the rest is the `answer`.
  - That book then has 183 questions, matching its own header.
- **Parser extension 2: sections that aren't questions.** The parser currently drops sections it skips:
  - the "Appendix — A 10-day study plan" in the CSS, HTML, Next.js, Node.js and React books
  - JavaScript's Appendix A and B
  - NestJS's "A 7-day prep plan" and "Final advice"
  - cheat sheets and self-scoring sections

  These are imported as `extras` on the book (title plus markdown body, in file order) and shown on the book overview page. Only the "Contents" list is dropped, because it's navigation.
- **One book per file:**
  - `slug` is the file slug and `title` comes from `BOOK_NAMES`.
  - `parts` are taken from `record.part` in first-seen order, with `key` = slugified part.
  - `intro` is the markdown before the first part or question heading, minus the contents list (may be empty).
- **One question per record:**
  - `importKey` is the record's `id`. B and T questions get ids built the same way.
  - `order` is the order in the file.
  - `question`, `prompt` and `answer` are copied as-is.
- **Checks:**
  - Question count per book must equal `collect()` today plus the B and T questions (695 + 34 = 729 in total).
  - **Coverage check:** every heading in every source file must end up as a question, part, intro, extra, or the dropped Contents list. Any heading left over fails the import. This is what guarantees nothing is silently lost.

### Graphs (`learning-graph/_src/data/*.mjs`)

Dynamic-import each file and map its fields:

| From | To |
|---|---|
| `title` | `title` |
| `sub` | `subtitle` |
| `foot` (HTML) | `footer` (kept as markdown with inline HTML, rendered sanitized) |
| `tracks[{k,n}]` | `tracks[{key,name,order}]` |
| node `id` | `slug` |
| node `tr` | `trackKey` |
| node `t` | `title` |
| node `pre` | `prereqIds` (resolved in a second pass) |
| node `s` | `summary` |
| node `p` | `points` |
| node `c` | `code` |
| node `pit` | `pitfall` |
| node `u` | `docsUrl` |

- `order` is the order in the file.
- `out` and `key` are dropped.
- **Check:** node count per graph must equal the file's `nodes.length`. Any unresolved prerequisite fails the import.

### Notes

| Folder | Series | Description |
|---|---|---|
| `docker/notes` | Docker | `docker/LEARNING_PLAN.md` |
| `javascript/notes` | JavaScript & Node (backend) | `javascript/LEARNING_PLAN.md` |
| `oop/notes` | OOP | `oop/LEARNING_PLAN.md` |
| `.net/notes` | C# / .NET | `.net/LEARNING_PLAN.md` |
| `claude/*.md` (except README) | Claude Code | `claude/README.md` |

- Chapters are ordered by file name.
- `title` is the first H1 and `body` is the rest of the file.
- `toc` and `readMinutes` are computed.
- **Check:** chapter count per series must equal its file count.

### Subjects

- Seed a starter list: html, css, javascript, typescript, react, nextjs, nodejs, nestjs, frontend, backend, system-design, database, go, python, csharp-dotnet, docker, oop, claude-code. The builder may adjust it.
- Each book, graph and series gets at least one subject from a mapping table in the script. Questions, topics and chapters inherit their parent's subjects.
- Topic-level `related` links start **empty**. The owner adds them in the admin over time.

### Report

The script prints counts per book, graph and series next to the expected counts. It exits non-zero on any mismatch.

### Deletion step (separate commit, after the owner has checked the import in the app)

**Delete:**
- `interview-topics/`
- `learning-graph/`
- `quiz-app/`
- `docker/notes/`, `javascript/notes/`, `oop/notes/`, `.net/notes/`
- the four `LEARNING_PLAN.md` files
- `claude/`
- `web/scripts/import-legacy.ts`, which is dead once the sources are gone. The parsers stay, because the import API uses them.

**Keep:**
- `best-practices/`
- `.net/examples/`
- the per-folder `CLAUDE.md` files
- `docs/`
- `.vscode/`

Afterwards **no `.html` file remains in the repo** outside `web/` build output, which is gitignored. Add `.superpowers/` to `.gitignore`.

## Config

`web/.env.local` (with `web/.env.example` committed):
- `MONGODB_URI`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ADMIN_EMAILS`

The Google OAuth client must list redirect URIs for `http://localhost:3000` and the Vercel domain.

## Content notes

- `frontend-interview-bl.md` (183 questions: 149 Q, 14 B, 20 T) has a short Bangla explanation inside each answer, after a `**বাংলায়:**` marker. Other files are English. There are no language fields: Bangla is stored inside the markdown and only needs the font.
- Some answers contain code-output puzzles with a `prompt` and `<details>` reveals. The parser already splits these.

## Testing (minimum)

- Import: counts match the expected values for every book, graph and series, using the copied parser tests plus a fixture run.
- The cycle check rejects A→B→A and longer loops.
- Progress upserts: marking twice keeps one doc per (user, item), and `seenCount` increments.
- Admin authorization: a non-admin session gets 403 or a redirect on every admin action and route.
- Visibility: draft and archived items never show to users and are excluded from progress totals.
- Bulk import:
  - Pulling a book, series or graph and pushing it back unchanged reports zero changes.
  - An edited pull updates the right items by id.
  - A dry run writes nothing.
  - A push never deletes or archives anything.
- API tokens:
  - A revoked or unknown token gets 401.
  - A valid token can't reach users, progress or token endpoints.

## Left to the builder

- Folder structure inside `web/`, and the split between server actions and route handlers.
- Markdown, highlighting and editor libraries.
- Graph rendering technique (porting the existing SVG approach is expected but not required).
- Exact visual design within the approved wireframes. Light and dark themes are expected, matching the existing graph pages.
- Exact subject list and the book/graph/series → subject mapping.
- Loading and error states, empty states for new users, pagination in admin lists.

## Calls made during brainstorming (owner may override)

- All pages need sign-in except the landing page. Any Google account may sign in.
- JWT sessions with no Auth.js adapter. Admin role comes from `ADMIN_EMAILS`.
- Revisions store full previous snapshots: list, view and restore, no diff view.
- Backup: the admin export covers content only. The CLI backup covers everything, and restore keeps `_id`s (Atlas free tier has no backups).
- `frontend-system-design-ebook.md` stays a question book (70 cards, as in today's quiz), not a note series.
- The parser is extended so the 34 B/T questions and every appendix or plan section get imported, and a coverage check fails the import if any heading is left over.
- `LEARNING_PLAN.md` files become series descriptions.
- Notes are marked read manually.
- Unfinished quiz sessions can be resumed but don't count as "recent".
- No full-text search in v1.
- Bulk import is always preview-then-commit. It matches by an id comment, then `importKey` or slug. It never deletes. New items start as `draft`.
- `pull` embeds `<!-- id: … -->` comments so Claude Code can round-trip edits.
- API tokens: hashed, content scope only, managed in the admin.
- The per-folder `CLAUDE.md` files get rewritten to describe the `content push` workflow.
- `legacyId` is renamed `importKey`: for imported questions it equals the old quiz id, and it's also the match key for future imports.
