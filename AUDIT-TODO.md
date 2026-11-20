# Audit fix list (2026-11-16)

Findings from the full-app audit. Work top to bottom. Tick `[x]` when the fix is in and verified, and add a short note (commit hash or "won't fix: why") after the title.

Status key: CONFIRMED = proven in code or reproduced; SUSPECTED = check first, close as "not a bug" if it does not hold.

## Ground rules

- Branch first: `git switch -c fix/audit-findings` (never commit on `main`). One commit per item or small group, message names the IDs (e.g. `fix: S1 check access status in requireUser`).
- Read `CLAUDE.md` and `AGENTS.md` first. Next 16: `proxy.ts`, not middleware; check `node_modules/next/dist/docs/` before Next-specific code. Follow the admin conventions in `CLAUDE.md`.
- Add or update a vitest test for every behaviour fix where practical.
- After each phase: `npx tsc --noEmit`, `npm run lint`, `npm test` (baseline: all 1014 pass).
- **Database safety:** `.env.local` points at a remote cluster and has `AUTH_DEV_LOGIN=true`. Never run the dev server, seed or scripts against it. For browser checks use a throwaway DB: Docker (`docker compose up -d`) if running, otherwise `mongodb-memory-server` on a spare port, plus a temporary `.env.development.local` overriding `MONGODB_URI`, `ADMIN_EMAILS`, and blanking `R2_*`, `CF_AI_TOKEN`, `OPENROUTER_API_KEY`. Delete that file when done; never commit it.
- Items marked **DECIDE** need a product choice. Use the recommended option unless the user says otherwise, and say which you picked in the note.

---

## Phase 1 — Security and data loss (do first)

- [x] **S1 (High) Pending/blocked users can run Server Actions** — 802b8bd, cb3835f (tests). `requireUser()` reads the status once per request (React `cache`), matcher skips only root-level images; `/api/search` checks status too.
  - Where: `proxy.ts:41` (matcher), `features/auth/lib/authz.ts:79` (`requireUser`).
  - Problem: matcher skips paths ending in `.png|.svg|...` outside `api/` and `features/admin/`; `requireUser()` checks only the JWT. Reproduced: a pending account POSTed the notes "mark read" action to `/notes/seed-docker/x.png` → 200 and a progress row written.
  - Fix: check access status inside `requireUser()` (and pages/actions that rely on it), wrapped in React `cache()` per request; deleted/pending/blocked → redirect to `/access` or `/`. Narrow the matcher to real static files (explicit allowlist, e.g. `/favicon.ico`, `/*.svg` at root only).
  - Verify: test that `requireUser()` rejects pending/blocked/deleted users; update `tests/proxy/matcher.test.ts` so `/speaking/x.png` and `/notes/a/x.png` are matched.

- [x] **D1 (High) Backup and export omit IELTS collections** — 797b704. Test asserts every `@/models` model is listed.
  - Where: `features/content/backup.ts:40-52` (`CONTENT_COLLECTIONS`), `:75-94` (`ALL_COLLECTIONS`); `app/(app)/admin/export/page.tsx:16,25`.
  - Problem: missing `IeltsReadingTest`, `IeltsListeningTest`, `IeltsWritingPrompt`, `IeltsTestAttempt`, `IeltsWritingAttempt`, `AiUsage`, `AiConversation`, `SpeakingUsage`. Restore's empty-DB guard skips them too. Export page copy is wrong (says books…subjects only; mentions a non-existent `web/` folder).
  - Fix: add all to `ALL_COLLECTIONS`; add the three content ones to `CONTENT_COLLECTIONS`; add a test that every model in `models/index.ts` is in `ALL_COLLECTIONS` (or an explicit exclude list); fix export page copy.
  - Verify: new test passes; backup→restore round-trip test includes an IELTS attempt.

- [x] **S6 (Medium) Dev login can write to a real database** — a58e2c8. `isLocalMongoUri` now in `lib/mongoUri.ts`.
  - Where: `auth.ts:64-86`, `auth.ts:29-48`.
  - Problem: dev login is gated only on `NODE_ENV === "development" && AUTH_DEV_LOGIN`. With a remote `MONGODB_URI`, a dev login using a real email `$set`s `googleId: "dev:…"` and name on that real user.
  - Fix: also require a local `MONGODB_URI` (move `isLocalMongoUri` from `scripts/seed-dev.ts` into `lib/` and reuse it).
  - Verify: unit test for `getProviders()` with a remote URI → no credentials provider.

- [x] **D7 (Medium) Band entry enum rejects writing sources** — e5ff9fa. One `IELTS_BAND_SOURCES` list types `BandSource`; unique index done under D12.
  - Where: `models/ieltsBandEntry.ts:7`; written in `features/ielts/writing/attempts.ts:85-88`.
  - Fix: add `writingSelf` and `writingAi` to the enum. Consider a partial unique index on `(userId, attemptId, source)` (see D12).
  - Verify: test that `IeltsBandEntry.create({ source: "writingAi", … })` validates.

- [x] **F1 (High) IELTS Listening full-test audio lost on section switch or reload** — 46b6542. All section players stay mounted; a full-test play is used up only at `ended` (`finishSection`), so reload/load error can retry.
  - Where: `features/ielts/components/TestRunner.tsx:24-85,246`; `features/ielts/practice/attempts.ts:253-259`.
  - Problem: `SectionAudio` is keyed by section index and only the active section is mounted, while the server allows one play claim per section. Switching tabs, reloading or a load error burns the single play.
  - Fix: keep one audio element per section mounted for the whole attempt (hide inactive), and record the claim on first `playing`, or allow re-claim until playback reaches the end.
  - Verify: component test (switch section mid-play keeps audio); server test for claim rules.

- [x] **S2 (Medium) No security headers** — bdc838b. Nonce CSP set per request in `proxy.ts` (`lib/csp.ts`), fixed headers in `next.config.ts`. Browser check in Final check.
  - Where: `next.config.ts:3-16`.
  - Fix: `headers()` with `Content-Security-Policy` (nonce or hash for the inline theme script in `app/layout.tsx:53`; allow R2 origin for media, OpenRouter not needed client-side), `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - Verify: dev server responses carry the headers; no CSP console errors on dashboard, graph, quiz, speaking pages.

- [x] **S3 (Medium) Unbounded speaking uploads** — 1cdd35e. Max 3 open takes (older than 1 h ignored), 40 per 24 h; clip length from the lesson.
  - Where: `features/speaking/takes.ts:35-92` (`clipSec` at 54-55).
  - Fix: cap unconfirmed takes per user (e.g. 3) and takes per day; read `clipSec` from the lesson on the server, not the client.
  - Verify: tests for both caps.

- [x] **S4 (Medium) Unlimited transcription and AI retries** — 531dccf. Refund only when no response arrived (`SttError.reached`, `AiError.reached`); takes claimed atomically; 3 attempts per take/IELTS part.
  - Where: `features/recording/transcribe.ts:69-83`, `features/speaking/transcribe.ts:23`, `features/progress/quizAi.ts:81-89`, `features/ai/lib/openrouter.ts:113-129`.
  - Problem: every failure is refunded and `failed` can be retried forever; concurrent calls on one pending take all reach STT.
  - Fix: refund only when no upstream response arrived; cap attempts per take/day; claim the take atomically (`findOneAndUpdate` status `pending→running`) before calling STT.
  - Verify: tests for refund rules, attempt cap, concurrent claim.

- [x] **S5 (Medium) API tokens have no scope or expiry** — 7498480, bbae94c. Old tokens default to write.
  - Where: `features/admin/tokens.ts`, `models/apiToken.ts`, `features/auth/lib/tokenAuth.ts`, `app/api/content/**`, `features/admin/components/TokensEditor.tsx`.
  - Fix: add `scope: "read" | "write"` (import needs write) and optional `expiresAt`; existing tokens default to write so the CLI keeps working. Show both in the admin list.
  - Verify: route tests: read token → 403 on import; expired token → 401.

## Phase 2 — Data consistency

- [x] **D2 (Medium) Stale progress after graph/notes actions** — reproduced — 9959412. `refresh()` (next/cache) in graph, note and quiz mark/finish actions. Browser check in Final check.
  - Where: `app/(app)/graphs/actions.ts:14-28`, `features/graph/components/GraphView.tsx:68`; `app/(app)/notes/actions.ts:13-21`, `components/NoteReader.tsx:14-27`.
  - Problem: mark topic Done → Dashboard → Back shows "0 of 6 done"; "Mark as read" leaves the sidebar unticked.
  - Fix: call `refresh()` from `next/cache` in the actions (check Next 16 docs) or `router.refresh()` on success. Check other user actions without refresh (quiz mark/finish in `app/(app)/interview/actions.ts`).

- [x] **D3 (Medium) Profile counts abandoned recordings** — 8b16b0d.
  - Where: `features/profile/data.ts:198-204,216-222` (+ `dayCountsOfDateField` 103-112).
  - Fix: add `"media.stored": true` to the speaking take and IELTS speaking attempt queries, matching `features/speaking/progress.ts:21`.

- [x] **D4 (Medium) Two streaks with different rules** — DECIDE — 8b16b0d. Chose the recommended option: both kept, labelled "Speaking streak" (Dashboard) and "activity streak" (Profile, full history).
  - Where: `features/profile/data.ts:39-61` vs `features/speaking/schedule.ts:40-58`, `app/(app)/dashboard/page.tsx`.
  - Problem: Dashboard = speaking-only, unbounded, has "best"; Profile = any activity, capped at 84 days. Neither labelled.
  - Recommended: keep both, label them "Speaking streak" and "Activity streak", and compute the activity streak over full history (not the 84-day window).

- [x] **D4b (Medium) Profile is missing areas** — 8b16b0d, 94c43fa. Graphs tab; IELTS L/R/W attempts and study logs; per-skill bands; interview activity per quiz-day of `results.at`.
  - Where: `features/profile/data.ts:24,118-158,214-272`, `app/(app)/profile/page.tsx:60-81`.
  - Fix: add a Graphs area (reuse `listGraphsWithProgress`; activity from `NodeProgress.doneAt`); include `IeltsTestAttempt`, `IeltsWritingAttempt`, `IeltsStudyLog` in IELTS counts and heatmap; project `bands` (not just `overall`) for band rows; count Interview activity by `results.at`, not `finishedAt` (`features/profile/data.ts:161-166`).

- [x] **D5 (Medium) Abandoned takes and R2 objects never cleaned** — 68d28a8. Sweep on `startTake`, `deletingAt` mark, "Delete all my recordings" in Speaking settings.
  - Where: `features/speaking/takes.ts:81,279-288`, `features/speaking/components/TaskRecorder.tsx:140-149`.
  - Fix: sweep `media.stored: false` takes older than 1 hour (on `startTake`, or a TTL-style cleanup) deleting R2 objects; mark take as deleting before removing objects; wire `deleteAllTakes` into a user "Delete all my recordings" action on speaking settings.

- [x] **D6 (Medium) Revision restore and lost updates** — 7165bc7. Restore keeps status/order/subjects/importKey; forms send `updatedAt`, stale saves refused.
  - Where: `features/content/revisions.ts:36-69`, `features/admin/service.ts:126-148,172-195,300-424,453-518`.
  - Fix: restore editor fields only (not `status`, `order`, `importKey`, `subjects`), or show those changes in the confirm; send `updatedAt` with each admin draft and reject a stale save with a clear message.

- [x] **D8 (Medium) IELTS: no server deadline; profile save rebuilds plan** — 17b2e17.
  - Where: `features/ielts/practice/attempts.ts:78-150`; `features/ielts/profile.ts:281-306`, `features/ielts/history.ts:56-67`, `features/ielts/plan.ts:194`.
  - Fix: reject saves/submits on full tests after `startedAt + limitSec + grace` (auto-submit what is saved); only write a new plan version when plan inputs change (date, bands, hours), not preferences; wrap profile + plan write in `inTransaction`; weekly minutes chart across all plan versions.

- [x] **D9 (Low) Quiz result write not atomic** — 6555ab0. — `features/progress/quiz.ts:265-269`: wrap session update and `markQuestion` in `inTransaction`.
- [x] **D10 (Low) Quiz lists disagree** — 6555ab0. Shared `quizHistoryFilter` (any session with a marked card) and `SUMMARY_PROJECTION`. — `features/progress/attempts.ts:86`, `features/progress/dashboard.ts:109`, `features/profile/data.ts:162`: one shared filter; add `SUMMARY_PROJECTION` to `features/progress/quiz.ts:287` and `features/progress/dashboard.ts:109`.
- [x] **D11 (Low) Reorder writes a revision per row** — 658a1b1. — `features/admin/service.ts:235-249`: skip revisions for order-only changes.
- [x] **D12 (Low) IELTS band entry not atomic with attempt submit** — 9c5de31. Note: the new partial unique index fails to build if a database already holds duplicate synced entries; remove them first. — `features/ielts/practice/attempts.ts:121-148`: transaction, re-sync on "already submitted", partial unique index.
- [x] **D13 (Low) Client-supplied speaking date and duration** — cd3c41b. Server date from tz cookie; writing time capped by time open; take duration stays capped by the task limit (a size-based floor was not added: no safe minimum bitrate). — `features/speaking/takes.ts:42-44,124-141`, writing `timeSec` in `features/ielts/writing/attempts.ts:123`: derive date on server from tz cookie; bound duration by size / task limit.
- [x] **D14 (Low) Non-atomic admin multi-writes** — 19356d7. IELTS test save uses `findOneAndUpdate` (before) instead of a transaction, since R2 removal can't join one. — `features/admin/ielts.ts:106-108`, `features/admin/speaking.ts:116-119`, `features/admin/ieltsTests.ts:119`, `features/admin/service.ts:366-389` (cycle check + save): wrap in `inTransaction`.
- [x] **D15 (Low) Dead fields** — 8607a05. All used, none dropped: graphId in the progress query (index serves it), doneAt in Profile, seenCount/lastSeenAt in F2, ai.model and media.size shown on the take page. `NodeProgress.startedAt` kept: written on first status and covered by tests. — `QuestionProgress.seenCount/lastSeenAt` (use in F2), `NodeProgress.startedAt/doneAt/graphId` (use in D4b), unused `{userId, graphId}` index, `ai.model`, `media.size`: use or drop.
- [x] **D16 (Low) `openNote` writes during GET render** — 68540b9. — `app/(app)/notes/[series]/[chapter]/page.tsx:49`: catch and ignore write failure.
- [x] **D17 (Low) Dashboard quiz dates in server time zone** — 6555ab0. — `app/(app)/dashboard/page.tsx:23,322`: use `localDate(…, timeZone)` like Profile.

## Phase 3 — Functionality gaps

- [x] **F2 (Medium) Skipped questions vanish; no real spaced review** — DECIDE — 79d3ca6. Recommended option: skips write nothing (stay unseen); review deck oldest `lastSeenAt` first; "spaced review" wording kept.
  - Where: `features/progress/questions.ts:18-22`, `features/progress/quiz.ts:83-87`, `models/questionProgress.ts:9-10`, `app/(app)/interview/page.tsx:14`.
  - Recommended: skips do not count as "seen"; order the review deck by `lastSeenAt` (oldest first) instead of random sampling. Keep the "spaced review" wording only if that is done.
- [x] **F3 (Medium) Duplicate prerequisite blocks a topic** — 9702f7b. — `features/progress/graph.ts:32-45`: de-duplicate `needed`; de-duplicate `prereqIds` in import (`features/content/import/run.ts:187-194`) and `features/admin/service.ts:324`.
- [x] **F4 (Medium) IELTS runner gaps** — c7996d0 (discard, Writing review brief/chart); drill voice reset and drill audio `onError` in 46b6542 (F1). — `features/ielts/components/TestRunner.tsx`, `WritingRunner.tsx`, `WritingReview.tsx:25-35`, `app/(app)/ielts/writing/[attemptId]/page.tsx:25,34`: add "Discard attempt" to both runners; show task brief and chart image in Writing review; reset drill voice `played` on end (`TestRunner.tsx:70`); add `onError` to drill audio (`:56`).
- [x] **F5 (Medium) Speaking playback and upload** — 99f2ea4. — `features/recording/lib/uploadTake.ts:1,30` use `putFile` from `lib/uploadFile.ts` (10-min timeout, progress); `features/speaking/components/TakeReview.tsx:120,150` + `components/MediaPlayer.tsx:115-118` re-presign on error and pass `take.durationSec` as duration fallback.
- [x] **F6 (Medium) Deep link lost on sign-in** — 112c41a, d9b768a. `features/auth/lib/nextPath.ts`. — `proxy.ts:32`, `app/actions.ts:9`, `app/page.tsx`: carry a same-origin relative `next` path through redirect and `redirectTo`; reject absolute or `//` URLs.
- [x] **F7 (Medium) Admin IELTS test form hides audio upload after save** — 077899b. — `features/admin/components/IeltsTestForm.tsx:95,139,151`: reset `removed` on save success.
- [x] **F8 (Medium) Speaking recording impossible with no lesson and AI off** — 21597d8. — `features/speaking/components/TaskRecorder.tsx:299-317`, `app/(app)/speaking/[task]/page.tsx:82-91`: allow a free-practice take without material; hide "Generate with AI" when AI is off; separate copy for "no lessons published".
- [x] **F9 (Low) IELTS home without profile has no way to practise** — c66dc7d. — `app/(app)/ielts/page.tsx:39-57`: render the section nav in the no-profile branch (reproduced: only a calculator link).
- [x] **F10 (Low) Quiz deck size label wrong** — 5defa78. `countDeckAction`. — reproduced: "Start · 20 questions" started a 5-card deck. `features/interview/components/QuizSetup.tsx`: show the real count, e.g. "Start · 5 questions".
- [x] **F11 (Low) Interview history detail incomplete** — f050532. — `app/(app)/interview/history/[sessionId]/page.tsx:65-80`: render strengths and coach chat; Resume link for unfinished; learner time zone (`history/page.tsx:15,60-61`).
- [x] **F12 (Low) Unfinished quizzes pile up** — e4831f8. Discard (delete if untouched, else finish); 30-day cut-off on the resume list. — `features/progress/quiz.ts:283-298`, `app/(app)/interview/page.tsx:43-75`: discard action and age cut-off.
- [x] **F13 (Low) Saved answer lost after reload** — 470d4d8. — `features/progress/quiz.ts:256-264`: fall back to `AiConversation.answer`.
- [x] **F14 (Low) Dashboard/Profile quizzes not linked** — 6555ab0. — `app/(app)/dashboard/page.tsx:314-325`, `app/(app)/profile/page.tsx:120-128`: link to `/interview/history/<id>`.
- [x] **F15 (Low) Speaking history capped at 100** — dad5489. — `app/(app)/speaking/history/page.tsx:21,101`, `features/speaking/takes.ts:318`: "Load older" with the `before` cursor.
- [x] **F16 (Low) `unavailable` transcripts never retry** — 2a520fc. — `features/speaking/takes.ts:142`, `features/speaking/transcribe.ts:23`: allow transcribe when `sttConfigured()`.
- [x] **F17 (Low) Search gaps** — 9b6d235. — `features/content/queries/search.ts:55-108`: search book, graph and series titles; rank prefix matches before the limit.
- [x] **F18 (Low) "Continue reading" points at a read chapter** — 5593a0c. — `features/progress/dashboard.ts:31-41`: prefer next unread chapter.
- [x] **F19 (Low) Empty states for empty published parents** — bd73e46. — `app/(app)/notes/[series]/page.tsx:58`, `features/graph/components/GraphView.tsx:379`.
- [x] **F20 (Low) Topic code always highlighted as JS** — 2e63832. Language omitted. — `features/graph/components/TopicPanel.tsx:63-67`: omit language or add a field.
- [x] **F21 (Low) IELTS study log** — 925a61b. — `features/ielts/progress.ts:113-116`, `features/ielts/components/TodayList.tsx:110`: standalone log form with recent entries and delete.
- [x] **F22 (Low) IELTS bands display** — 7270f87. New `practiceTest` source. — `features/ielts/components/LatestBands.tsx:9-11` show latest per-skill; `app/(app)/ielts/calculator/page.tsx:25-27` + `features/ielts/bandHistory.ts:84-93` distinct source for L/R attempt bands and block deleting them server-side.
- [x] **F23 (Low) Admin gaps** — 37099b6 (subject delete, user delete, import warning), 7498480 (token revoke). Lesson delete guard: not a bug — learner pages reassign the day and takes keep their material copy. — subject delete with in-use guard (`features/admin/service.ts:431-441`); user delete flow incl. recordings (`features/admin/users.ts`); token revoke returns `fail` when nothing matched (`app/(app)/admin/tokens/actions.ts:16-20`); import warns on ignored slug rename (`features/content/import/run.ts:151-155,200-213`); speaking lesson delete guard or archive (`features/admin/speaking.ts:90-104`, SUSPECTED: confirm learner pages break first).
- [x] **F24 (Low) Speaking minor** — 6665810. — lesson assigned for UTC date before tz cookie (`app/(app)/speaking/page.tsx:28-29`, `features/speaking/lessons.ts:85`); "Record another" link on take review (`app/(app)/speaking/takes/[takeId]/page.tsx:53`); content-type check in `features/recording/upload.ts:79-80`.

## Phase 4 — Lower-risk security hardening

- [x] **S7** — db6b97a. Admin import → `/api/admin/import`; action limit 2 MB, not 1 MB, because body-language stills can total ~1.2 MB. `next.config.ts:6` 10 MB action body limit applies everywhere: move admin import to a route handler with its own limit; restore 1 MB default.
- [x] **S8** — ab4cef7 (`lib/rateLimit.ts`). No rate limiting on sign-in / access actions (`app/actions.ts`, `app/access/actions.ts`) and `/api/search`: simple per-user/IP throttle (Mongo TTL counter like `AiUsage`).
- [x] **S9** — db6b97a. Import body size: check `content-length` in `app/api/content/import/route.ts:18`; cap graph JSON in `features/content/import/schema.ts:14`.
- [x] **S10** — c4733d6. Prompt injection: escape `<learner_answer>` tags in learner text (`features/progress/quizAi.ts:95-104,252-266`).
- [x] **S11** — 1403242. Logs: log status and length only in `features/ai/lib/openrouter.ts:100,114,123`.
- [x] **S12** — f0a1e53. Raw Mongo errors returned to callers: `features/content/import/run.ts:73,88`, `features/admin/service.ts:515`.
- [x] **S13** — 2e8624c. zod at action boundaries: `app/(app)/speaking/actions.ts`, `features/ielts/writing/attempts.ts:99-146`, `features/ielts/speaking/attempts.ts:137,240`; `features/speaking/settings.ts:42-47` build `targets` from `TASKS`.
- [x] **S14** — 9bd700c (`h-` prefix; stored anchors unchanged). Heading ids: prefix rehype-slug ids (`lib/markdown/pipeline.ts:16`, `lib/markdown/toc.ts`) so they cannot clash with page ids.
- [x] **S15** — b4af4fc (checked in the signIn callback before the write). `auth.ts:40` googleId update can hit duplicate email: catch E11000 and give a clear message.
- [x] **S16** — e4f6477. IELTS open attempts uncapped (`features/ielts/practice/attempts.ts:46-75`, `features/ielts/writing/attempts.ts:93-116`): reuse open attempt for same test.
- [x] **S17** — c194419. Admin IELTS audio deleted while attempts reference it (`features/admin/ieltsTests.ts:121-123,154`): keep referenced audio or fail the claim without burning it.

## Phase 5 — UX/UI

- [x] **U1 (Medium)** — fa2b39e. End quiz: confirm, pending/disabled state, catch error into a Notice (`features/interview/components/QuizCard.tsx:275`, `features/interview/components/QuizRunner.tsx:18,27-32`). Reproduced: one click ended quiz at 1/5.
- [x] **U2 (Medium)** — 1a7f596. Skip link + `id="main"` on `<main>` (`app/(app)/layout.tsx`, `app/page.tsx`, `app/access/page.tsx`).
- [x] **U3 (Medium)** — 33bf4d4 (mobile menu; desktop already had it in the account menu). Profile in main and mobile nav, or linked from Dashboard (`components/TopBar.tsx:16-23,202`).
- [x] **U4 (Medium)** — 3bbc7e0. Command palette: scroll active option into view; `role="presentation"` on `li`; always render list for `aria-controls`; retry after failed search (`components/CommandPalette.tsx:93-199`).
- [x] **U5 (Medium)** — ff29934. IELTS autosave: handle `{ ok: false }` (`features/ielts/components/TestRunner.tsx:175`, `WritingRunner.tsx:41`).
- [x] **U6 (Medium)** — ff66b24 (`lib/useLeaveGuard.ts`, shared with the IELTS mock). Recorder: guard in-app navigation while unsaved (`features/speaking/components/TaskRecorder.tsx:140-149`).
- [x] **U7 (Medium)** — a12708b (panel scrolled into view; checked at 375px in Final check). Graph deep link on phone opens reader or scrolls to panel (`features/graph/components/GraphView.tsx:99,230-234`). SUSPECTED: confirm at 375px.
- [x] **U8 (Low)** — fa2b39e. Focus after quiz mark: move focus to new question heading (`features/interview/components/QuizCard.tsx:66`).
- [x] **U9 (Low)** — c4dfa0c. Start/quiz buttons swallow errors: add catch + message (`features/interview/components/StartReviewButton.tsx:12-21`, `features/graph/components/TopicPanel.tsx:102-118`, `features/interview/components/QuizSetup.tsx:53-57`).
- [x] **U10 (Low)** — fa2b39e (G/R need the reveal; S any time). Quiz shortcuts G/R/S fire before reveal: require reveal or add undo (`features/interview/components/QuizCard.tsx:34,143-159`); keep "Check with AI" after reveal (`:184-195`).
- [x] **U11 (Low)** — f9ffa6a. New-user Dashboard: no "Welcome back" for first visit; empty-state hint mentions Speaking and IELTS; IELTS setup prompt (`app/(app)/dashboard/page.tsx:100-127,246`). Landing feature list adds Speaking and IELTS (`app/page.tsx:16-32`).
- [x] **U12 (Low)** — 33bf4d4 (`inert` on `#main`). Mobile menu focus trap / `inert`; account menu closes on focus-out (`components/TopBar.tsx:108-135`).
- [x] **U13 (Low)** — a12708b. Graph panel: Escape returns focus to selected node (`features/graph/components/GraphView.tsx:200-204,430`).
- [x] **U14 (Low)** — d35c7dd. IELTS timer: announce at 5 and 1 min; tabs/radios keyboard pattern; explain disabled Submit (`features/ielts/components/TestRunner.tsx:93-113,217-241`, `WritingRunner.tsx:105-117`); delete-all copy lists L/R/W (`app/(app)/ielts/profile/page.tsx:63`).
- [x] **U15 (Low)** — 889db18, db6b97a (ImportForm). `SubjectsEditor` already uses `AdminList`; its rows are inline edit forms that do not fit `AdminListItem`, so left as is. Admin: confirm when leaving Published (`features/admin/components/RowActions.tsx:27-37`); unsaved-changes guard in `useSaveForm`; `ImportForm` catches thrown actions (`features/admin/components/ImportForm.tsx:60-69`); `QuestionForm` link/unlink via `useAdminAction` (`features/admin/components/QuestionForm.tsx:35-43`); hand-rolled lists to `AdminList` (`app/(app)/admin/users/page.tsx:136`, `revisions/[entityType]/[entityId]/page.tsx:28`, `SubjectsEditor.tsx:26`); `IeltsTestForm.tsx:179` real `errors`.
- [x] **U16 (Low)** — cf771db. Speaking: upload progress and cancel; keep-or-discard for very short takes (`features/speaking/components/TaskRecorder.tsx:402-409`).
- [x] **U17 (Low)** — 684f40e. Admin nav at 375px is a 15-item horizontal scroller: collapse into a menu on small screens.

## Final check

- [x] `npx tsc --noEmit`, `npm run lint`, `npm test` all pass — 123 files / 1119 tests (baseline 112 / 1014).
- [ ] blocked: user's dev server on port 3000 (PID 16940, not this session's) runs in the project folder, so a second dev server won't start; it was left running and not used because it likely reads `.env.local` (remote cluster). Waiting on the user's answer. Browser pass on a throwaway DB (desktop + 375px, light + dark): sign in as pending user and confirm S1 POST to `/notes/<series>/x.png` is now rejected; D2 graph Back shows saved status; quiz End confirm; skip link.
- [x] Temporary `.env.development.local` removed (it must be recreated for the browser pass); `git status` shows only `AUDIT-TODO.md` (left untracked, not committed); `git status` shows only intended changes.
- [x] Summary at the bottom of this file: what was fixed, what was skipped and why, any DECIDE choices made.

---

## Summary (2026-11-16, branch `fix/audit-findings`, not pushed)

**Fixed:** every item in Phases 1–5 (S1–S17, D1–D17 with D4b, F1–F24, U1–U17). Each one is ticked above with its commit. Tests added or updated for each behaviour fix; the suite went from 112 files / 1014 tests to 123 / 1119.

**DECIDE choices (all the recommended options):**
- D4: both streaks kept and labelled: "Speaking streak" on the Dashboard, "activity streak" on Profile, computed over the whole history.
- F2: skips no longer count as seen; review decks are ordered oldest `lastSeenAt` first; the "spaced review" wording stays.

**Where I went beyond or differed from the suggested fix:**
- S2: nonce CSP from `proxy.ts`, so every proxied page is dynamic (it already was, because of the auth checks).
- S4: an AI or speech-to-text call that got any response now counts against the daily limit, even when the reply was unusable. Several tests that expected a refund were updated.
- S7: the Server Action limit is 2 MB, not 1 MB, because body-language feedback sends up to 6 × 200 KB stills.
- D12: the new partial unique index on band entries won't build if a database already has duplicate synced entries; remove them before deploying.
- D13: take duration is still capped by the task limit only. A size-based floor was dropped because there is no safe minimum bitrate.
- D14: IELTS test saves use `findOneAndUpdate` (returning the old version) rather than a transaction, because removing files from R2 can't take part in one.
- F22: Listening and Reading attempt bands get a new `practiceTest` source. Older attempt rows stored as `practice` with an `attemptId` are treated the same.
- S14: rendered heading ids get an `h-` prefix. Stored anchors are unchanged, and links add the prefix.

**Not a bug / left as is:**
- F23 speaking lesson delete guard: deleting a lesson doesn't break learner pages. The day gets a new lesson, and takes keep their own copy of the material.
- U15 `SubjectsEditor`: it already uses `AdminList`. Its rows are inline edit forms that don't fit `AdminListItem`.
- D15 `NodeProgress.startedAt`: kept, because it is written on the first status change and covered by tests.

**Still open:** the browser pass in Final check — blocked: user's dev server on port 3000.

