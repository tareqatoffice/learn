# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `AGENTS.md`: this is Next.js 16 with breaking changes; read `node_modules/next/dist/docs/` before writing Next code. Note `middleware` is now `proxy.ts`.

## Commands

Requires Node >=22. Local DB: `docker compose up -d` (MongoDB 7 single-node replica set on :27017; transactions need a replica set). Copy `.env.example` to `.env.local` first.

```bash
npm run dev                          # http://localhost:3000
npm run build
npm run lint                         # eslint
npm test                             # vitest run (all tests)
npx vitest run tests/lib/foo.test.ts # single file
npx vitest run -t "name"             # single test by name
npx tsc --noEmit                     # typecheck (no script defined)
npm run seed:dev                     # tsx scripts/seed-dev.ts
npm run content -- list|pull|push    # CLI over the token API (see README)
npm run backup -- <file>.json        # full dump
npm run restore -- <file>.json       # into an EMPTY db only
```

Tests spin up their own in-memory MongoDB replica set (`tests/setup/mongo.ts`, `mongodb-memory-server`), so no Docker needed; first run downloads `mongod`. `fileParallelism: false` because all files share one DB and `resetDb()` empties it. `vitest.config.ts` re-spawns itself to uppercase the Windows drive letter; don't remove that.

## Architecture

App Router app at repo root (no `src/`), `@/` alias maps to root. Mongoose models, Auth.js (Google; dev credentials login behind `AUTH_DEV_LOGIN`), Tailwind 4 + shadcn/base-ui.

Three content types, all stored in MongoDB and edited in-app via Admin: **question books** (interview Q&A with spaced-review quizzes), **graphs** (prerequisite topic graphs), **note series** (chaptered notes). Content is DB-only; there are no content files in the repo.

Layering (logic lives outside `app/`):
- `models/*` — Mongoose schemas; import from `@/models` barrel. `lib/db.ts` `connectDb()` caches the connection on `globalThis`; also has `retryOnDuplicateKey`.
- `content/` — domain logic for content: `queries/` (read), `parse/` + `import/` (canonical markdown with `<!-- learn:… id=… -->` markers, zod schemas in `import/schema.ts`), `pull.ts`, `revisions.ts` (edit history), `visibility.ts` (draft/published), `cycles.ts` (prereq cycle check), `backup.ts`.
- `admin/` — admin service/queries/token logic; `progress/` — per-user progress (questions, quiz, graph, notes, dashboard; `quizAi.ts` is the OpenRouter quiz coach: client + model catalogue in `lib/openrouter.ts`, admin-chosen key (encrypted via `lib/secrets.ts` with `AUTH_SECRET`; use `getAiConfig()` and never pass `apiKey` to a page), primary/backup models and daily limit in `lib/aiSettings.ts` (Admin → AI coach, env as defaults); off when no key is set); `graph/layout.ts` — pure tiered layout for the prereq graph view.
- `speaking/` — speaking practice logic; media in R2 via `lib/r2.ts`, transcription via `lib/stt.ts`.
- `app/(app)/**` — signed-in pages and Server Actions (`actions.ts` beside pages); `app/(app)/admin/**` admin-only UI; `app/api/content/*` token-authenticated content API (used by `scripts/content.ts`); `app/api/admin/export`.
- `components/` — UI; `components/admin/` forms.

Admin conventions (follow these for every admin page and update):
- **Structure.** A section is `app/(app)/admin/<section>/page.tsx` + `actions.ts`, UI in `components/admin/`, logic in `admin/` (or `lib/` when non-admin code needs it). Register it once in `admin/nav.ts` (`ADMIN_NAV`: Content / Users & access / Data / Settings); the sidebar and the admin home read it, and a test checks every entry has a page.
- **Layout.** Each page is one `<AdminPage title description? back? actions? width?>` from `components/admin/layout.tsx` (`width="narrow"` for settings pages). Forms and settings go in `<AdminCard title?>`, titled groups in `<AdminSection>`, rows in `<AdminList empty="…">` of `<AdminListItem actions={…}>`. Don't hand-roll `h1`/`section`/list chrome.
- **Updates.** A Server Action starts with `adminContext()` (`admin/action.ts`: requireAdmin, then connectDb) and returns `ActionResult<T>` from `admin/result.ts` (`ok(data)` / `fail(errors)`, the `_` key is a whole-form message). Lookups (search, tests) return plain data. On the client use `useAdminAction()` (`run(action, { onSuccess, confirm, refresh })`; it refreshes the page on success) or `useSaveForm` for content drafts, and show the outcome with `<SaveBar>` (submit + status) or `<ActionStatus>`. Exceptions: import preview/commit return an `ImportReport`, and link toggles that only update local state.

Auth/access: `proxy.ts` calls `routeAccess()` (pure policy in `lib/authz.ts`): `/` and `/api/auth` open, `/api/content` open at proxy level (bearer token checked in the route via `lib/tokenAuth.ts`), `/admin` + `/api/admin` need an email in `ADMIN_EMAILS` (re-read on every call). Everything else needs sign-in **and** an approved account: new sign-ins start `pending` (`User.status`, admins start `approved`; users with no status count as approved) until an admin approves them in Admin → Users, and `blocked` users are shut out. The proxy re-reads the status from the DB on every non-public request (`lib/access.ts` `accessStatusFor`; `routeAccess(path, { email, status })`) and sends pending/blocked users to `/access` (API calls get 403); `requireUser()` only checks the session and does not repeat the lookup. `auth.ts` configures NextAuth lazily, so `proxy()` awaits `auth(cb)`.

Env is validated through `lib/env.ts` (`getEnv()`); use it rather than `process.env`.

SEO: use `buildMetadata({ title, description, path })` from `lib/seo.ts` per page (canonical must be set per page; child `alternates` replace the parent's). `(app)` layout is `noindex`. Dynamic routes use `generateMetadata`.

Deploy: Vercel + MongoDB Atlas (see README; Atlas free tier has no backups, use `npm run backup`).
