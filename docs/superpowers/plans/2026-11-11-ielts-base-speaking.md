# IELTS Base + IELTS Speaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an IELTS Prep module (Academic): per-user profile, a three-phase study plan with user-approved suggestions, band calculator and band history, and IELTS Speaking drills and full mocks with recording, self-rating first, then an AI band estimate. It builds on Speaking Practice's recording plumbing, generalised rather than copied.

**Architecture:** First, the media/upload/transcription parts of `speaking/` are pulled into a new `recording/` folder as functions that work on a media value. Each caller (`SpeakingTake`, `IeltsSpeakingAttempt.parts[i]`) does its own DB writes, so the stored shape of `SpeakingTake` stays byte-for-byte the same. IELTS logic lives in a new `ielts/` folder (pure plan/band maths plus services), models in `models/ielts*.ts`, pages under `app/(app)/ielts/**`, admin under `app/(app)/admin/ielts/**`.

**Tech Stack:** Next.js 16 App Router, Mongoose, zod 4, vitest + mongodb-memory-server, R2 via `lib/r2.ts`, STT via `lib/stt.ts`, OpenRouter via `lib/openrouter.ts`, browser `MediaRecorder` and `speechSynthesis`.

**Spec:** `docs/superpowers/specs/2026-11-11-ielts-base-speaking-design.md`

## Global Constraints

- Follow `CLAUDE.md`: logic outside `app/`; models exported from `models/index.ts`; env only through `getEnv()`; `buildMetadata({ title, description, path })` on every page; Next.js 16, so read `node_modules/next/dist/docs/` before writing Next code; `proxy.ts`, not middleware.
- Admin: register in `admin/nav.ts`; pages use `AdminPage`/`AdminCard`/`AdminSection`/`AdminList`; actions start with `adminContext()` and return `ActionResult`; client uses `useAdminAction()` / `<SaveBar>` / `<ActionStatus>`.
- User Server Actions start with `requireUser()` then `connectDb()`; every query filters by the session `userId`, never one from input.
- **Production has real Speaking Practice data.** `SpeakingTake`'s collection, field paths (`media.*`, `transcript`, `transcriptStatus`, `ai.*`, `self.*`, `markers`) and R2 keys (`takes/<userId>/<takeId>.<ext>`, `.audio.<ext>`) must not change. No migration in this plan. If one turns out to be needed, stop and ask the user.
- IELTS R2 keys: `ielts/<userId>/<attemptId>/<part>.<ext>` and `ielts/<userId>/<attemptId>/<part>.audio.<ext>`, where `<part>` is `p1 | p2 | p3`.
- AI goes through `getAiConfig()`, `modelChain()`, `chatCompletion()` and `extractJson()`, every call metered by `metered()`. Never pass the key to a page. Everything works with AI off, STT unset and R2 unset (Speaking screens then show "Recording storage isn't set up yet.").
- One shared daily transcription cap (`SpeakingUsage`, `STT_DAILY_LIMIT`) and one shared AI limit across both modules. Body-language consent is the existing `SpeakingProfile.bodyConsentAt`.
- Bands: target and current 4.0–9.0 in 0.5 steps. Speaking criteria self-ratings are whole bands 1–9. Criteria keys: `fluency` (Fluency and Coherence), `lexical` (Lexical Resource), `grammar` (Grammatical Range and Accuracy), `pronunciation` (Pronunciation).
- Rounding to the half band (overall and Speaking-from-criteria): fraction < 0.25 rounds down to .0, 0.25 to < 0.75 becomes .5, ≥ 0.75 rounds up.
- Skills: `listening | reading | writing | speaking`.
- Minutes per day 10–480, integer. Study weekdays are a non-empty subset of 0–6 (0 = Sunday), default all.
- Hours per band default 200, always labelled "rough guide, not an official figure".
- Phases `foundation | skills | mocks`, with a default split of 30/45/25 % of days left. `mocks` gets at least the final 7 days. With fewer than 21 days left: no foundation, 60/40.
- Plan weeks are 7-day blocks starting at the plan's start date. Each skill gets at least 15 % of weekly minutes.
- Mocks per week: foundation 0 (plus 1 diagnostic in week 1 when the current band is unknown), skills 1, mocks 2.
- Speaking Practice minutes count toward IELTS Speaking only from the profile's `createdAt`, capped at 50 % of that week's Speaking target.
- Suggestion defaults: missed when last week < 60 % of target, or 3 study days in a row with 0 minutes; weak when a criterion is ≥ 1.0 below target in the last 2 mocks (taking min(self, AI); pronunciation counts only if self also flags it); shift 15 % of Speaking minutes to drills for that criterion; current-band suggestion when the last 2 mocks differ from the profile's Speaking band by ≥ 0.5, or an official result is entered; a dismissed kind is not raised again for 7 days; checks run at most once per local day.
- Speaking timing: Part 1 and Part 3 soft limit 300 s with a "time to move on" notice and no cut-off; caps 420 s. Part 2: 60 s prep, talk marker at 60 s, auto-stop at 120 s, cap 150 s. Size cap = cap s × (video ? 120_000 : 8_000) bytes (piece 1's `takeCapBytes` rule).
- Video on by default for mocks, off for drills. Examiner voice on by default, falling back to text only when `speechSynthesis` is missing or fails on the device.
- Pronunciation copy, verbatim: "Estimated from the transcript only — the AI can't hear your accent or sounds. Your recording is kept so a later version can check pronunciation from audio."
- Every AI band is labelled "estimate". The AI estimate stays hidden until the self-rating is saved.
- UI copy: sentence case, no "please", no "successfully"; errors say what happened and what to do.
- Must work on desktop Chrome/Edge/Safari/Firefox and on iOS Safari / Android Chrome.

## Review Focus

1. **A mock part fails to upload, or the user leaves mid-mock.** Expected: parts already uploaded stay, the failed part's blob is kept for retry, `beforeunload` warns, and an unfinished attempt shows as "incomplete" with the stored parts reviewable. Tests: Task 16 "keeps part 1 and retries part 2 after a failed PUT"; Task 14 "finishAttempt marks incomplete when a part is unstored".
2. **Old Speaking Practice takes after the refactor.** Expected: a production-shaped take document reads, plays and transcribes exactly as before. Tests: Task 1 "legacy take fixture round-trips"; Task 2 "transcribes legacy take".
3. **Test date very close, already past, or moved earlier.** Expected: fewer than 21 days drops foundation; under 7 days is all mocks; a past test date shows the result prompt instead of a plan; moving the date earlier drops a shortfall adjustment that no longer fits and shows it in the preview. Tests: Task 6 "5 days left" / "test date past"; Task 9 "drops stale spreadShortfall on rebuild".
4. **Day boundary and time zone.** Expected: a study day or mock at 23:30 local counts for that local date; weekly blocks use local dates. Tests: Task 8 "late-evening attempt counts for local day".
5. **Suggestions repeating or acting without approval.** Expected: opening `/ielts` twice in a day doesn't duplicate suggestions; a dismissed kind is quiet for 7 days; no plan version is created until the user approves. Tests: Task 9 "no duplicate on second run same day", "dismissed kind silent 7 days", "check never creates a plan version".

---

### Task 0: Phone spike and live check (throwaway; does not block the build)

The build carries on during this task (user's decision). The user runs it on their own phones.

**Files:**
- Create (temporary, not merged): `app/(app)/ielts/spike/page.tsx`

- [ ] **Step 1:** Build one page with buttons. (a) Speak a sentence with `speechSynthesis` while an audio `MediaRecorder` records from the same tap. (b) Record 5 minutes of front-camera video with the parallel audio recorder from `useRecorder`. (c) `grabFrames` 4 frames. (d) Upload through the existing `startTakeAction` path to live R2. (e) Play it back from a presigned GET. (f) Run `transcribeTakeAction` against live Cloudflare STT, printing whether Whisper returned word or segment timestamps.
- [ ] **Step 2:** Deploy to a Vercel preview, then ask the user to run it on iPhone Safari and Android Chrome and report results. Record the results in a `## Notes` section at the end of this plan: mime per device, whether synthesis-during-recording works, 5-min video size, frame grab, R2 CORS, STT timestamps.
- [ ] **Step 3:** Delete the spike page and commit only the notes.

```bash
git add docs/superpowers/plans/2026-11-11-ielts-base-speaking.md
git commit -m "docs: record IELTS phone spike results"
```

If a result changes the recording design (for example 5-minute continuous video fails on iOS), stop before Task 16 and bring it to the user.

---

### Task 1: Extract media and upload into `recording/`

**Files:**
- Create: `recording/media.ts`, `recording/upload.ts`
- Modify: `models/speakingTake.ts` (import `mediaSchema`), `speaking/takes.ts` (use the new functions), `speaking/schedule.ts` (re-export `takeCapBytes` from `recording/media.ts`)
- Test: `tests/recording/upload.test.ts`, `tests/recording/fixtures/legacyTake.ts`

**Interfaces:**
- Produces:
  - `recording/media.ts`: `mediaSchema` (the exact current sub-schema, moved), `type MediaDoc` (as in `speaking/takes.ts` today), `MEDIA_EXT: Record<string,string>`, `baseMime(mime: string): string`, `keysOf(media: MediaDoc): string[]`, `capBytes(capSec: number, video: boolean): number`.
  - `recording/upload.ts`:
    - `prepareUpload(input: { keyBase: string; kind: "audio"|"video"; mime: string; audioMime?: string; size: number; audioSize?: number; capSec: number }): Promise<ActionResult<{ media: MediaDoc; uploadUrl: string; audioUploadUrl?: string; maxBytes: number }>>`. Keys are `${keyBase}.${ext}` and `${keyBase}.audio.${ext}`; returns `media` with `stored: false, durationSec: 0`.
    - `verifyUpload(media: MediaDoc): Promise<{ ok: true; size: number } | { ok: false; error: string }>`. HEADs both objects against `capBytes`; on reject it deletes the objects and returns piece 1's `UPLOAD_FAILED` text.
    - `playbackUrls(media: MediaDoc): Promise<{ url: string; audioUrl?: string } | null>`, null when not stored.
    - `removeMedia(medias: MediaDoc[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests** in `tests/recording/upload.test.ts`, with R2 mocked through `setR2Client`:
  - `prepareUpload` builds `ielts/u/a/p1.webm` and `ielts/u/a/p1.audio.webm` keys from `keyBase "ielts/u/a/p1"`, video `video/webm` + `audio/webm`.
  - It refuses `size > capBytes(capSec, true)` with the piece 1 too-large message, and rejects an unsupported mime or a kind/mime mismatch.
  - `verifyUpload` returns `ok:false` and calls DeleteObjects when the HEAD size is 0 or over the cap.
  - "legacy take fixture round-trips": insert `legacyTake` (a document literal copied from today's schema: `takes/<id>/<id>.webm`, `audioKey`, `transcriptStatus: "done"`, `ai.speech`, `self`, `markers`) with the raw driver (`SpeakingTake.collection.insertOne`), then `getTake(userId, id)` returns the same transcript, ratings, markers and a playback URL for the same key.
- [ ] **Step 2:** Run `npx vitest run tests/recording/upload.test.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3:** Move the code in. Then rewrite `startTake`, `confirmTake`, `deleteTake`, `deleteAllTakes` and `getTake` in `speaking/takes.ts` to call `prepareUpload` (with `keyBase "takes/<userId>/<takeId>"`), `verifyUpload`, `removeMedia` and `playbackUrls`. Their signatures and messages stay unchanged.
- [ ] **Step 4:** Run `npx vitest run tests/recording tests/speaking tests/components/TaskRecorder.test.tsx`, then `npx tsc --noEmit`. Expected: all PASS, no type errors.
- [ ] **Step 5: Commit**

```bash
git add recording models/speakingTake.ts speaking tests/recording
git commit -m "refactor: extract recording media and upload helpers from speaking takes"
```

---

### Task 2: Extract transcription into `recording/`

**Files:**
- Create: `recording/transcribe.ts`
- Modify: `speaking/transcribe.ts`
- Test: `tests/recording/transcribe.test.ts`

**Interfaces:**
- Consumes: `MediaDoc`, from Task 1.
- Produces:
  - `consumeTranscription(userId: string, now?: Date): Promise<(() => Promise<void>) | null>`, the existing `SpeakingUsage` counter moved over.
  - `transcribeMedia(userId: string, media: MediaDoc, deps?: { transcribe?: typeof transcribe }): Promise<ActionResult<{ transcript: string }>>`. It covers the size check (25 MB), the cap, getObjectBytes and STT, and refunds on failure. It writes nothing to the DB.
  - `TRANSCRIBE_LIMIT_MESSAGE`.

- [ ] **Step 1: Write the failing tests:**
  - "shared cap across modules": with `STT_DAILY_LIMIT=2`, two calls succeed and the third fails with the limit message.
  - "refunds on STT error": the count is unchanged after a throwing `transcribe`.
  - "transcribes legacy take": `transcribeTake` on the Task 1 fixture (status reset to `pending`) reads `media.audioKey` and saves the transcript at the same path.
- [ ] **Step 2:** Run `npx vitest run tests/recording/transcribe.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `speaking/transcribe.ts` `transcribeTake` keeps its signature and DB update and delegates the middle to `transcribeMedia`.
- [ ] **Step 4:** Run `npx vitest run tests/recording tests/speaking`. Expected: PASS.
- [ ] **Step 5:** Commit: `refactor: share transcription job and daily cap via recording/transcribe`.

---

### Task 3: Generic line chart

**Files:**
- Create: `components/charts/LineChart.tsx`
- Modify: `components/speaking/TrendChart.tsx` (becomes a thin wrapper)
- Test: `tests/components/LineChart.test.tsx`

**Interfaces:**
- Produces: `LineChart<P>({ points, series, yDomain, yTicks?, xLabel, refLines?, refX? })`.
  - `points: P[]`
  - `series: { key: string; label: string; color: string; dash?: string; pick: (p: P) => number | undefined; dotsOnly?: boolean }[]`
  - `yDomain: [number, number]`
  - `xLabel: (p: P) => string`
  - `refLines?: { y: number; label: string }[]`
  - `refX?: { index: number; label: string }`
  - Gaps stay gaps; `dotsOnly` draws points without a line (official results).

- [ ] **Step 1:** Tests: it renders one `<path>` per series that has values, a horizontal line for `refLines`, circles only for `dotsOnly`, and a legend label per series.
- [ ] **Step 2:** Run `npx vitest run tests/components/LineChart.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Move the SVG code from `TrendChart` into `LineChart`; `TrendChart` passes its `SERIES` and `yDomain [1,5]`.
- [ ] **Step 4:** Run `npx vitest run tests/components`. Expected: PASS.
- [ ] **Step 5:** Commit: `refactor: generic LineChart behind speaking TrendChart`.

---

### Task 4: Band maths (pure)

**Files:**
- Create: `ielts/bands.ts`
- Test: `tests/ielts/bands.test.ts`

**Interfaces:**
- Produces:
  - `type Skill = "listening"|"reading"|"writing"|"speaking"` and `SKILLS: Skill[]`
  - `type Criterion = "fluency"|"lexical"|"grammar"|"pronunciation"`, `CRITERIA`, `CRITERION_LABEL`
  - `roundHalf(mean: number): number`
  - `overallBand(b: Record<Skill, number>): number`
  - `speakingBand(c: Record<Criterion, number>): number`
  - `listeningBand(raw: number): number`, `readingBand(raw: number): number` (Academic; raw is an integer 0–40, anything else throws `RangeError`)
  - `isHalfBand(n: number): boolean`, `isWholeBand(n: number): boolean`

- [ ] **Step 1: Write the failing tests:**
  - `roundHalf(6.125)===6`, `roundHalf(6.25)===6.5`, `roundHalf(6.625)===6.5`, `roundHalf(6.75)===7`
  - `overallBand({listening:6.5,reading:6.5,writing:5,speaking:7})===6.5` (mean 6.25)
  - `listeningBand(30)===7`, `listeningBand(29)===6.5`, `readingBand(33)===7.5`, `readingBand(32)===7`, `listeningBand(40)===9`, `readingBand(0)===0`
  - `listeningBand(41)` throws.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/bands.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Each table is a list of `[minRaw, band]`, first match from the top, with a code comment saying "approximate; commonly published Academic conversion; not official".
  - Listening: `[[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[2,2],[1,1],[0,0]]`
  - Reading: `[[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[2,2],[1,1],[0,0]]`
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS band conversion and rounding`.

---

### Task 5: IELTS models

**Files:**
- Create:
  - `models/ieltsProfile.ts`, `models/ieltsPlan.ts`, `models/ieltsPlanSuggestion.ts`, `models/ieltsStudyLog.ts`, `models/ieltsBandEntry.ts`
  - `models/ieltsSpeakingItem.ts`, `models/ieltsSpeakingAttempt.ts`, `models/ieltsSettings.ts`
- Modify:
  - `models/index.ts`
  - `content/backup.ts`: `ieltsspeakingitems` and `ieltssettings` go in `CONTENT_COLLECTIONS`; the user collections go in `ALL_COLLECTIONS`.
  - `tests/content/export.test.ts`, which lists the collections.
- Test: `tests/models/ielts.test.ts`

**Interfaces (fields; all user models carry `userId: ObjectId` required and `timestamps: true`):**
- `IeltsProfile`:
  - `userId` unique; `testDate: String` (YYYY-MM-DD)
  - `target: { overall: Number, listening?, reading?, writing?, speaking? }`; `current: { overall?: Number, … }`
  - `minutesPerDay`; `studyDays: [Number]`; `status: "active"|"ended"`
  - `examinerVoice: Boolean (true)`, `mockVideo: Boolean (true)`, `drillVideo: Boolean (false)`
  - `lastCheckDate?: String`
- `IeltsPlan`: `version: Number`; `startDate`; `testDate`; `inputs: Mixed`; `adjustments: [{ id, kind: "shiftCriterion"|"spreadShortfall", criterion?, share?, minutes?, fromWeek?, createdAt }]`; `phases: [{ name, start, end }]`; `weeks: [{ start, end, minutes: { listening, reading, writing, speaking }, mocks: Number, focus?: String }]`; `hours: { needed, available, short: Boolean }`; `reason: String`. Unique index on `{userId, version}`.
- `IeltsPlanSuggestion`: `kind: "missed"|"weak"|"hoursShort"|"phase"|"currentBand"`; `reason`; `proposal: Mixed` (`{ inputs?, adjustment? }`); `status: "pending"|"approved"|"dismissed"`; `decidedAt?`; `forDate: String`. Index on `{userId, status}`.
- `IeltsStudyLog`: `date`, `skill`, `minutes` (1–480). Index on `{userId, date}`.
- `IeltsBandEntry`: `date`, `source: "official"|"practice"|"mockSelf"|"mockAi"|"other"`, `bands: { listening?, reading?, writing?, speaking? }`, `overall?`, `attemptId?`. Index on `{userId, date}`.
- `IeltsSpeakingItem`: `type: "part1"|"part2"|"part3"`; `title`; `aboutYou: Boolean`; `questions: [String]` (parts 1 and 3); `cue: { topic, bullets:[String], explain, roundOff:[String] }` (part 2); `cardId?: ObjectId` (part 3); `status: "draft"|"published"`; `tags:[String]`; `generated: Boolean`.
- `IeltsSpeakingAttempt`:
  - `date`; `kind: "mock"|"part1"|"part2"|"part3"`; `status: "inProgress"|"complete"|"incomplete"`
  - `questions: { part1?: {itemIds,frames:[{title,questions}]}, part2?: {itemId?, cue}, part3?: {itemId?, questions} }`; `generated: Boolean`; `notes?: String`
  - `parts: [{ part: "p1"|"p2"|"p3", media: mediaSchema, transcript, transcriptStatus, markers: [{ atSec, label }] }]`
  - `self?: { fluency, lexical, grammar, pronunciation, notes?: Mixed, confidence?, eyeContact?, gestures? }`
  - `ai?: { bands: {…4}, reasons: {…4}, evidence: {…4: [String]}, overall, strengths:[String], nextBand: [{ advice, original, rewrite }], model, at }`; `body?: bodySchema`
  - `paused: Boolean`; `videoUsed: Boolean`. Index on `{userId, date:-1}`.
- `IeltsSettings`: singleton `key:"default"`, `hoursPerBand 200`, `split: { foundation:30, skills:45, mocks:25 }`, `thresholds: { missedShare:0.6, missedStreak:3, weakGap:1, shiftShare:0.15, currentBandGap:0.5, dismissDays:7 }`.

- [ ] **Step 1:** Tests: models compile; unique indexes reject a duplicate profile and a duplicate plan version; an attempt with an embedded `mediaSchema` part saves and reads.
- [ ] **Step 2:** Run `npx vitest run tests/models/ielts.test.ts tests/content/export.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the models and the barrel and backup lists.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS models`.

---

### Task 6: Plan generator (pure)

**Files:**
- Create: `ielts/plan.ts`
- Test: `tests/ielts/plan.test.ts`

**Interfaces:**
- Consumes: `Skill` and `roundHalf` (Task 4).
- Produces:
  - `type PlanInputs = { today: string; testDate: string; minutesPerDay: number; studyDays: number[]; target: BandSet; current: Partial<BandSet>; currentUnknown: boolean }`, with `BandSet = { overall: number } & Partial<Record<Skill, number>>`.
  - `type Adjustment` (as stored, in Task 5).
  - `type PlanSettings = Pick<IeltsSettings, "hoursPerBand"|"split">`.
  - `generatePlan(inputs, adjustments: Adjustment[], settings): { phases; weeks; hours; kept: Adjustment[]; dropped: Adjustment[] }`.
  - `hoursCheck(inputs, settings): { needed: number; available: number; short: boolean }`.
  - `phaseOn(plan, date): Phase | null` and `weekOn(plan, date): { index: number; week } | null`.
  - `studyDaysBetween(from, to, studyDays): number`.

Rules not already fixed in Global Constraints:
- `needed = max(target.overall − currentOverall, 0) × hoursPerBand`, where `currentOverall = current.overall ?? target.overall − 1`.
- `available = studyDaysBetween(today, testDate − 1) × minutesPerDay / 60`.
- Phase boundaries are whole days. Each phase gets `round(days × share)`, mocks is raised to ≥ 7, and the remainder goes to skills.
- Skill weights: `w_s = 1 + max(target_s − current_s, 0)`, where a missing per-skill figure uses overall. Normalise, raise any below 0.15 to 0.15, then renormalise the rest. A week's minutes are its study days × minutesPerDay × w_s, rounded to whole minutes; Speaking takes the rounding remainder.
- `spreadShortfall { minutes, fromWeek }` adds `minutes / remainingWeeks` to each week ≥ fromWeek, split by the same weights. It is dropped when `fromWeek ≥ weeks.length`.
- `shiftCriterion { criterion, share }` sets `week.focus = criterion` on every week from its creation date onwards. It never changes minutes. It is dropped when the criterion is in `ctx.metCriteria`. The full signature is `generatePlan(inputs, adjustments, settings, ctx: { metCriteria?: Criterion[] } = {})`; Task 9 fills `metCriteria` with the criteria whose latest mock band (min(self, AI)) is ≥ target.speaking.

- [ ] **Step 1: Write the failing tests:**
  - "100 days, all study days, 60 min": phases 30/45/25 days, ending the day before testDate; `hours.available === 99`.
  - "5 days left": one phase, `mocks`.
  - "20 days left": phases skills then mocks, 12/8 days.
  - "test date past": throws `RangeError("test date has passed")`.
  - "per-skill gap weights writing": target 7 everywhere, current writing 5.5, others 6.5. Then writing minutes > reading minutes, and every skill gets ≥ 15 %.
  - "hours short": target 7, current 5, 30 days × 60 min, so needed 400 h, available 30 h, `short: true`.
  - "unknown current assumes target − 1": target 7 gives needed 200.
  - "mocks per week": the foundation weeks have 0 mocks except week 0 = 1 when `currentUnknown`; skills weeks 1; mocks weeks 2.
  - "spreadShortfall adds minutes to remaining weeks" and "dropped when fromWeek past end".
- [ ] **Step 2:** Run `npx vitest run tests/ielts/plan.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `generatePlan` and its helpers in `ielts/plan.ts`, using date strings and the `addDays` from `speaking/schedule.ts`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS three-phase plan generator`.

---

### Task 7: Profile, settings and plan versions (service)

**Files:**
- Create: `ielts/profile.ts`, `ielts/settings.ts`
- Test: `tests/ielts/profile.test.ts`

**Interfaces:**
- Consumes: `generatePlan` and `PlanInputs` (Task 6); the models (Task 5).
- Produces:
  - `ielts/settings.ts`: `getIeltsSettings(): Promise<IeltsSettingsView>` (defaults when no doc exists) and `saveIeltsSettings(input): Promise<ActionResult>` (zod; split must sum to 100).
  - `ielts/profile.ts`:
    - `profileInput` (zod)
    - `getProfile(userId): Promise<ProfileView | null>`
    - `previewProfile(userId, input, today): Promise<ActionResult<{ before: PlanView | null; after: PlanView; dropped: Adjustment[] }>>`
    - `saveProfile(userId, input, today): Promise<ActionResult<{ version: number }>>`, which saves and writes a new plan version with `reason "You changed your profile"`
    - `currentPlan(userId): Promise<PlanView | null>` (highest version)
    - `writePlanVersion(userId, inputs, adjustments, reason): Promise<number>`, used by Task 9
    - `endPlan(userId): Promise<ActionResult>`

- [ ] **Step 1: Write the failing tests:**
  - `saveProfile` creates version 1, and editing the test date creates version 2 with version 1 kept.
  - `previewProfile` writes nothing.
  - It rejects target 9.5, minutes 5, empty studyDays, and a testDate earlier than today.
  - `saveIeltsSettings` rejects a split summing to 99.
  - Standing adjustments carry from v1 to v2.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/profile.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS profile, settings and plan versions`.

---

### Task 8: Progress against the plan and today's list

**Files:**
- Create: `ielts/progress.ts`
- Test: `tests/ielts/progress.test.ts`

**Interfaces:**
- Consumes: `currentPlan`, `weekOn`, `phaseOn`, the models, and `SpeakingTake` (stored takes only, `media.durationSec`).
- Produces:
  - `weekProgress(userId, plan, weekIndex): Promise<{ done: Record<Skill, number>; fromPractice: number; mocksDone: number }>`. Speaking = IELTS attempt minutes + min(Speaking Practice minutes, 50 % of the week's Speaking target), counting practice only on dates ≥ the profile's `createdAt` local date.
  - `todayList(userId, today, timeZone): Promise<TodayItem[]>`, where `TodayItem = { id: string; skill: Skill; kind: "drill"|"mock"|"log"; label: string; minutes: number; done: boolean; href?: string }`.
  - `logStudy(userId, { date, skill, minutes }): Promise<ActionResult>` (speaking isn't allowed; it is recorded).
  - `dailyMinutes(userId, from, to): Promise<Record<string, Record<Skill, number>>>`.

Rule for today: on a study day, each skill's item minutes = remaining weekly minutes ÷ remaining study days in the week (this day included), rounded up to 5 and capped at `minutesPerDay` in total. Speaking gets the mock item instead of drills when `mocksDone < week.mocks` and today is the first study day of the week, or (for the second mock) the first study day ≥ 3 days after the first mock. Drill items name `week.focus` when it is set. Listening, reading and writing items are `kind: "log"`. An item is `done` when that day's minutes for the skill reach its minutes (for a mock: a complete mock attempt on that date).

- [ ] **Step 1: Write the failing tests:**
  - "late-evening attempt counts for local day": an attempt dated `2026-11-20` (local) counts on that day even when its `createdAt` UTC is the 21st.
  - "practice minutes capped at 50 %".
  - "practice before profile creation ignored".
  - "non-study day has empty list".
  - "mock offered on first study day of a skills week".
  - "focus drill label".
  - "log refuses speaking".
- [ ] **Step 2:** Run `npx vitest run tests/ielts/progress.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS weekly progress and today list`.

---

### Task 9: Plan suggestions

**Files:**
- Create: `ielts/suggestions.ts`
- Test: `tests/ielts/suggestions.test.ts`

**Interfaces:**
- Consumes: `weekProgress`, `currentPlan`, `writePlanVersion`, `getProfile`, `getIeltsSettings`, `hoursCheck`, `IeltsBandEntry`, and the `IeltsSpeakingAttempt` self/ai bands.
- Produces:
  - `runChecks(userId, today): Promise<void>`: at most once per `today` via `profile.lastCheckDate`; creates pending suggestions, never plan versions.
  - `listPending(userId): Promise<SuggestionView[]>`, where `SuggestionView = { id; kind; reason; preview: { before: PlanView; after: PlanView; dropped: Adjustment[] } }`.
  - `approveSuggestion(userId, id, today): Promise<ActionResult<{ version: number }>>`.
  - `dismissSuggestion(userId, id): Promise<ActionResult>`.
  - `removeAdjustment(userId, adjustmentId, today): Promise<ActionResult>`.
  - `suggestCurrentBand(userId, source: "official"|"mocks", bands): Promise<void>`, called by Task 10 and Task 15.

What each kind proposes:
- `missed`: `spreadShortfall { minutes: shortfall, fromWeek: current+1 }`. If that pushes any study day over `minutesPerDay × 1.5`, it proposes `inputs.minutesPerDay = ceil(needed per day / 5) × 5` instead.
- `weak`: `shiftCriterion { criterion, share: 0.15 }`.
- `hoursShort`: raised only on the transition from OK to short. The proposal is `{}`; the reason text offers the three options (more minutes, later date, lower target), and approving opens the profile page with no change made.
- `phase`: a reason only; the plan never moves phases itself, so approving just acknowledges it.
- `currentBand`: `inputs.current`.
- No new pending suggestion of a kind when one of that kind is pending, or when one was dismissed within `dismissDays`.

- [ ] **Step 1: Write the failing tests:**
  - "missed after a 40 % week": one `missed` suggestion is pending.
  - "no duplicate on second run same day".
  - "dismissed kind silent 7 days": day 6 creates none, day 8 creates one.
  - "check never creates a plan version": the version count stays the same after `runChecks`.
  - "approve writes version with adjustment".
  - "weak uses min(self, AI) and ignores pronunciation unless self flags it".
  - "drops stale spreadShortfall on rebuild": approve `missed`, then `saveProfile` with a test date 7 days away; the preview lists the adjustment as dropped.
  - "currentBand from official result".
- [ ] **Step 2:** Run `npx vitest run tests/ielts/suggestions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS plan suggestions with approval`.

---

### Task 10: Band history and calculator save

**Files:**
- Create: `ielts/bandHistory.ts`
- Test: `tests/ielts/bandHistory.test.ts`

**Interfaces:**
- Consumes: `overallBand`, `listeningBand`, `readingBand`, `suggestCurrentBand`.
- Produces:
  - `saveCalculatorResult(userId, { date, source: "practice"|"official"|"other", listeningRaw?, readingRaw?, writing?, speaking? }): Promise<ActionResult<{ id }>>`. It stores bands, computes `overall` only when all four are present, and for `official` it calls `suggestCurrentBand`.
  - `listBandEntries(userId, from?): Promise<BandEntryView[]>`.
  - `deleteBandEntry(userId, id): Promise<ActionResult>`. It refuses `mockSelf`/`mockAi` entries, which are deleted with their attempt.
  - `writeMockEntries(userId, attemptId, date, selfBand, aiBand?)`. It is idempotent (upsert on attemptId + source).

- [ ] **Step 1:** Tests:
  - raw 30/33 plus 6/6.5 stores 7, 7.5, 6, 6.5 and overall 6.75 → 7.
  - Three skills give no overall.
  - An official entry creates a `currentBand` suggestion.
  - `writeMockEntries` twice leaves 2 rows, not 4.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/bandHistory.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS band history`.

---

### Task 11: Admin: IELTS Speaking content

**Files:**
- Create:
  - `admin/ielts.ts`
  - `app/(app)/admin/ielts/speaking/page.tsx`, `app/(app)/admin/ielts/speaking/actions.ts`, `app/(app)/admin/ielts/speaking/[itemId]/page.tsx`
  - `components/admin/IeltsSpeakingItemForm.tsx`
- Modify: `admin/nav.ts`, adding Content → `{ href: "/admin/ielts/speaking", label: "IELTS Speaking", description: "Part 1 topics, Part 2 cue cards and Part 3 discussions." }`
- Test: `tests/admin/ielts.test.ts`, `tests/components/IeltsSpeakingItemForm.test.tsx`

**Interfaces:**
- Produces:
  - `itemInput` (zod, discriminated by `type`):
    - part1: 3–5 questions ≤ 200 chars each
    - part2: topic ≤ 200, 3–4 bullets, `explain` required, 0–2 `roundOff`
    - part3: 4–6 questions, an optional `cardId` that must be a part2 item
  - `createItem`, `updateItem`, `deleteItem` (deleting a card unlinks its part3 sets), `setItemStatus`, `listItemsAdmin(type?)`, `getItemAdmin(id)`: all `ActionResult`.
  - `generateItemDraft(adminUserId, type, cardId?): Promise<ActionResult<{ id }>>`: one metered AI call; saves `status: "draft", generated: true`.

- [ ] **Step 1:** Tests:
  - zod bounds for each type.
  - A part3 with a part1 id as `cardId` is rejected.
  - Deleting a card unlinks its sets.
  - `generateItemDraft` with a stubbed fetch saves a draft, and an unparseable reply refunds.
  - The nav test (it exists) passes with the new page.
  - The form test shows bullets only for part2.
- [ ] **Step 2:** Run `npx vitest run tests/admin/ielts.test.ts tests/components/IeltsSpeakingItemForm.test.tsx tests/admin/authz-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement, following `app/(app)/admin/speaking/**` and `components/admin/layout.tsx`. The list is in three `AdminSection`s by type, with a "Generate draft" button per section (hidden when AI is off).
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: admin IELTS Speaking question bank`.

---

### Task 12: Admin: IELTS settings

**Files:**
- Create: `app/(app)/admin/ielts/settings/page.tsx`, `app/(app)/admin/ielts/settings/actions.ts`, `components/admin/IeltsSettingsForm.tsx`
- Modify: `admin/nav.ts`, adding Settings → `{ href: "/admin/ielts/settings", label: "IELTS settings", description: "Hours-per-band guide, plan phases and suggestion thresholds." }`
- Test: `tests/components/IeltsSettingsForm.test.tsx`

- [ ] **Step 1:** Test: the form shows the defaults, the "rough guide, not an official figure" helper text under hours per band, and an error from `saveIeltsSettings` for a bad split.
- [ ] **Step 2:** Run `npx vitest run tests/components/IeltsSettingsForm.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement with `<AdminPage width="narrow">`, `<AdminCard>` and `<SaveBar>`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: admin IELTS settings`.

---

### Task 13: Question choice and learner AI fill

**Files:**
- Create: `ielts/speaking/questions.ts`
- Test: `tests/ielts/questions.test.ts`

**Interfaces:**
- Produces:
  - `type QuestionSet = IeltsSpeakingAttempt["questions"]` (as in Task 5).
  - `pickQuestions(userId, kind: "mock"|"part1"|"part2"|"part3", rng?: () => number): Promise<{ questions: QuestionSet; exhausted: boolean }>`.
  - `generateQuestions(userId, kind, cue?): Promise<AiResult<QuestionSet>>`: one metered call, never saved to the bank.

Rules:
- "Least recently used" = the latest attempt date that used the item; never-used comes first; ties are broken by `rng`.
- A mock is 1 `aboutYou` part1 + 2 other part1 + 1 part2 + 1 part3 linked to that card. With no linked set it uses any unlinked part3, and with none at all it sets `exhausted` so the UI offers AI.
- `exhausted: true` when every needed type has no unused published item, or none exist.

- [ ] **Step 1:** Tests:
  - "unused items first".
  - "mock links part3 to card".
  - "falls back to unlinked part3".
  - "exhausted when bank empty".
  - "drafts never picked".
  - `generateQuestions` with a stubbed reply returns a validated part2 cue with 3–4 bullets.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/questions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS Speaking question choice and AI fill`.

---

### Task 14: Attempts: start, parts, finish, delete

**Files:**
- Create: `ielts/speaking/attempts.ts`, `ielts/data.ts`
- Test: `tests/ielts/attempts.test.ts`

**Interfaces:**
- Consumes: `prepareUpload`, `verifyUpload`, `removeMedia`, `playbackUrls` (Task 1); `transcribeMedia` (Task 2); `pickQuestions` (Task 13).
- Produces:
  - `startAttempt(userId, { kind, date, questions?: QuestionSet, generated?: boolean }): Promise<ActionResult<{ attemptId; questions }>>`. It picks the questions unless they're given. `date` is validated like `startTake` (within ±1 day of UTC today).
  - `startPart(userId, attemptId, { part: "p1"|"p2"|"p3", kind, mime, audioMime?, size, audioSize? }): Promise<ActionResult<{ uploadUrl; audioUploadUrl?; maxBytes }>>`. Caps: p1/p3 420 s, p2 150 s. `keyBase` is `ielts/<userId>/<attemptId>/<part>`, and calling it again for the same part replaces that part's unstored media.
  - `confirmPart(userId, attemptId, part, { durationSec, markers }): Promise<ActionResult>`, idempotent. It sets `stored` and `transcriptStatus` ("pending" or "unavailable").
  - `transcribePart(userId, attemptId, part): Promise<ActionResult<{ transcript }>>`.
  - `finishAttempt(userId, attemptId, { notes?, paused }): Promise<ActionResult<{ status }>>`. The status is `complete` when every part the kind needs is stored, otherwise `incomplete`.
  - `getAttempt(userId, id): Promise<AttemptView | null>`, which includes playback URLs.
  - `listAttempts(userId, { kind?, limit? })`.
  - `deleteAttempt(userId, id)`: R2 objects, the document, and its mock band entries.
  - `ielts/data.ts`: `deleteAllIeltsData(userId): Promise<void>`, covering every IELTS collection and R2 under the attempts' keys.
- Kind to parts: mock `p1,p2,p3`; part1 `p1`; part2 `p2`; part3 `p3`.

- [ ] **Step 1: Write the failing tests:**
  - "rejects another user's attempt".
  - "startPart refuses size over p2 cap".
  - "keys under ielts/<user>/<attempt>/p2".
  - "confirmPart rejects missing object".
  - "finishAttempt marks incomplete when a part is unstored".
  - "transcribePart counts against the shared cap".
  - "deleteAttempt removes R2 objects and band entries".
  - "deleteAllIeltsData leaves Speaking Practice takes untouched".
- [ ] **Step 2:** Run `npx vitest run tests/ielts/attempts.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Writes target the matching array element with `{ "parts.part": part }` and the positional `$`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS Speaking attempts and part uploads`.

---

### Task 15: Self-rating, AI estimate and body feedback

**Files:**
- Create: `ielts/speaking/score.ts`
- Modify: `speaking/coach.ts`, extracting `runBodyFeedback(userId: string, frames: string[], deps?): Promise<AiResult<BodyFeedback>>` (validation + consent + call, no DB write); `bodyFeedback` keeps its signature and calls it.
- Test: `tests/ielts/score.test.ts`, plus the existing `tests/speaking/coach.test.ts` still passing

**Interfaces:**
- Produces:
  - `saveSelfBands(userId, attemptId, { fluency, lexical, grammar, pronunciation, notes?, confidence?, eyeContact?, gestures? }): Promise<ActionResult<{ band: number }>>`. Criteria are whole 1–9; the 1–5 extras are only allowed when the attempt has video. On a complete mock it calls `writeMockEntries` with the self band, and it runs `suggestCurrentBand(userId, "mocks", …)` when the last 2 mocks qualify.
  - `aiEstimate(userId, attemptId, deps?): Promise<AiResult<AiEstimate>>`. It refuses until the self bands are saved and every stored part's transcript is `done`.
    - `AiEstimate` = `{ bands: Record<Criterion,number>; reasons: Record<Criterion,string>; evidence: Record<Criterion,string[]>; overall: number; strengths: string[3]; nextBand: {advice,original,rewrite}[3] }`.
    - It recomputes `overall = speakingBand(bands)` server-side rather than trusting the model.
    - For a mock it writes the `mockAi` entry.
    - The prompt wraps transcripts in `<transcript part="p1">` tags, extends `SPEAKING_SAFETY`, and includes the questions, the cue card and the Part 2 duration.
  - `attemptBodyFeedback(userId, attemptId, frames, deps?)`: needs `p2` to be video and consent; it calls `runBodyFeedback` and saves `body`.

- [ ] **Step 1: Write the failing tests:**
  - "AI refused before self-rating".
  - "self bands reject 6.5 and 10".
  - "eye contact rejected on audio attempt".
  - "estimate stored with server-computed overall": a reply with overall 9 but bands 6/6/6/7 stores 6.
  - "unparseable reply refunds".
  - "mock writes mockSelf and mockAi entries".
  - "drill writes no band entries".
  - "body feedback needs consent".
- [ ] **Step 2:** Run `npx vitest run tests/ielts/score.test.ts tests/speaking/coach.test.ts`. Expected: FAIL (new tests).
- [ ] **Step 3:** Implement, following the `speechFeedback` pattern (`guarded`, `metered`, `jsonSchema`, `accept`).
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS Speaking self bands and AI estimate`.

---

### Task 16: Examiner voice and mock runner (client)

**Files:**
- Create: `lib/useExaminer.ts`, `components/ielts/MockRunner.tsx`, `components/ielts/PartTimer.tsx`
- Test: `tests/lib/useExaminer.test.ts`, `tests/components/MockRunner.test.tsx`

**Interfaces:**
- Consumes: `useRecorder`, `uploadTake`; the actions from Task 18 (`startPartAction`, `confirmPartAction`, `transcribePartAction`, `finishAttemptAction`), passed in as props so the test can stub them.
- Produces:
  - `useExaminer({ enabled }): { speak(text: string): Promise<void>; supported: boolean; failed: boolean }`. It resolves on `end`, on `error`, or after 15 s, whichever comes first. After one error it sets `failed`, and later calls resolve at once (text only). It picks the first `en-GB` voice, then any `en-*` voice.
  - `<MockRunner attemptId kind questions video examinerVoice actions />`.
    - Order: p1 questions → p2 prep (60 s countdown, notes textarea) → p2 talk (marker at 60 s, auto-stop at 120 s) → optional round-off question → p3 questions → finish.
    - Each part is one `useRecorder` session. "Next question" pushes a marker `{ atSec, label: "Q<n>" }` and speaks the next question.
    - At the end of a part it uploads in the background while the next part starts, and keeps the blob in `Map<part, Blob>` until confirmed.
    - It warns on `beforeunload` while any part is unsent, and has a pause button that sets `paused`.
    - When it finishes it navigates to `/ielts/speaking/<id>/review`, even if transcription is still pending.

- [ ] **Step 1: Write the failing tests:**
  - `useExaminer`: with no `speechSynthesis`, `supported` is false and `speak` resolves immediately; after an `error` event, `failed` is true.
  - `MockRunner` (recorder mocked):
    - "Part 2 starts recording when prep ends".
    - "auto-stops Part 2 at 120 s" (fake timers).
    - "shows move-on notice at 300 s in Part 1 but keeps recording".
    - "keeps part 1 and retries part 2 after a failed PUT".
    - "beforeunload set while a part is unsent".
- [ ] **Step 2:** Run `npx vitest run tests/lib/useExaminer.test.ts tests/components/MockRunner.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement, mobile-first, with `TaskRecorder` as the reference for the recorder and upload state.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS mock runner and examiner voice`.

---

### Task 17: Pages: home, setup/profile, plan, calculator

**Files:**
- Create:
  - `app/(app)/ielts/page.tsx`, `app/(app)/ielts/actions.ts`, `app/(app)/ielts/profile/page.tsx`
  - `app/(app)/ielts/plan/page.tsx`, `app/(app)/ielts/calculator/page.tsx`
  - `components/ielts/ProfileForm.tsx`, `components/ielts/Countdown.tsx`, `components/ielts/TodayList.tsx`, `components/ielts/SuggestionCard.tsx`, `components/ielts/PlanTimeline.tsx`, `components/ielts/BandCalculator.tsx`, `components/ielts/HoursWarning.tsx`
- Modify: the app's top navigation (where `/speaking` is linked), adding "IELTS"
- Test: `tests/ielts/actions.test.ts`, `tests/components/ProfileForm.test.tsx`, `tests/components/BandCalculator.test.tsx`, `tests/components/SuggestionCard.test.tsx`

**Interfaces:**
- `app/(app)/ielts/actions.ts` (`"use server"`; each one does `requireUser()` + `connectDb()`, and gets today from `readTimeZone()` + `localDate()`): `previewProfileAction`, `saveProfileAction`, `endPlanAction`, `logStudyAction`, `approveSuggestionAction`, `dismissSuggestionAction`, `removeAdjustmentAction`, `saveCalculatorResultAction`, `deleteBandEntryAction`, `deleteAllIeltsDataAction` (confirm required on the client).
- The home page calls `runChecks(userId, today)` before it renders, then renders in the spec's §10 order.
  - With no profile, it renders `ProfileForm` (setup).
  - When the test date has passed, it shows the official result prompt (`BandCalculator` with source official) plus "Set a new test date" and "End this plan".
- `HoursWarning` copy includes both numbers and "rough guide, not an official figure".

- [ ] **Step 1: Write the failing tests:**
  - The actions test: every action uses the session user (calling with another user's suggestion id fails).
  - `ProfileForm`: it shows the before/after preview before saving and lists dropped adjustments.
  - `BandCalculator`: raw 30 shows 7, and overall appears only when all four are filled.
  - `SuggestionCard`: approve and dismiss call their actions, and nothing changes without a click.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/actions.test.ts tests/components/ProfileForm.test.tsx tests/components/BandCalculator.test.tsx tests/components/SuggestionCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. Every page gets `buildMetadata({ title, description, path })`.
- [ ] **Step 4:** Run the same command, then `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS home, profile, plan and calculator pages`.

---

### Task 18: Pages: Speaking hub, run, review

**Files:**
- Create:
  - `app/(app)/ielts/speaking/page.tsx`, `app/(app)/ielts/speaking/actions.ts`
  - `app/(app)/ielts/speaking/[attemptId]/page.tsx`, `app/(app)/ielts/speaking/[attemptId]/review/page.tsx`
  - `components/ielts/SpeakingHub.tsx`, `components/ielts/AttemptReview.tsx`, `components/ielts/SelfBandsForm.tsx`, `components/ielts/BandCompare.tsx`
- Test: `tests/components/AttemptReview.test.tsx`, `tests/components/SelfBandsForm.test.tsx`

**Interfaces:**
- Actions: `startAttemptAction`, `generateQuestionsAction`, `startPartAction`, `confirmPartAction`, `transcribePartAction`, `finishAttemptAction`, `saveSelfBandsAction`, `aiEstimateAction`, `attemptBodyFeedbackAction`, `deleteAttemptAction`, and the existing `setBodyConsent` reused through a thin action.
- The hub lists "Full mock" and the three drills. When `pickQuestions` returns `exhausted` and AI is on, it offers "Generate new questions"; when AI is off, it says there are no new questions and offers repeats.
- The review shows parts with markers as jump links, transcripts (polling `transcribePartAction` for pending ones like piece 1's `TakeTranscript`), then `SelfBandsForm`. `BandCompare` and the AI section only render after self bands exist. The Pronunciation row is greyed with the verbatim copy from Global Constraints. Differences ≥ 1.0 are highlighted, and "estimate" sits on every AI band.

- [ ] **Step 1: Write the failing tests:**
  - "AI section hidden until self bands saved".
  - "pronunciation note verbatim".
  - "difference ≥ 1.0 highlighted".
  - "incomplete attempt shows stored parts and a delete button".
  - `SelfBandsForm` "only whole bands 1–9" and "video extras only when video".
- [ ] **Step 2:** Run `npx vitest run tests/components/AttemptReview.test.tsx tests/components/SelfBandsForm.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. The run page loads the attempt and the profile's `mockVideo`/`drillVideo`/`examinerVoice`, and renders `MockRunner`.
- [ ] **Step 4:** Run the same command, then `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS Speaking hub, run and review pages`.

---

### Task 19: History, charts and dashboard card

**Files:**
- Create: `app/(app)/ielts/history/page.tsx`, `ielts/history.ts`, `components/ielts/BandCharts.tsx`
- Modify: `progress/dashboard.ts` (adds `ielts?: { daysLeft: number; done: number; total: number }`), `app/(app)/dashboard/page.tsx` (a card beside "Speaking today", only when `ielts` is set)
- Test: `tests/ielts/history.test.ts`, `tests/progress/dashboard.test.ts`

**Interfaces:**
- `ielts/history.ts`:
  - `bandSeries(userId): Promise<{ date; source; listening?; reading?; writing?; speaking?; overall? }[]>`
  - `criteriaSeries(userId): Promise<{ date; self: Record<Criterion,number>; ai?: Record<Criterion,number> }[]>` (mocks only)
  - `weeklyMinutes(userId): Promise<{ weekStart; target: Record<Skill,number>; done: Record<Skill,number> }[]>`
- `BandCharts` uses `LineChart` three times:
  - overall/per-skill bands: official `dotsOnly`, mockAi dashed; `refLines` target; `refX` test date
  - criteria: self solid, AI dashed, `yDomain [1,9]`
  - minutes vs target per week

- [ ] **Step 1:** Tests:
  - "criteriaSeries excludes drills".
  - "bandSeries includes official as its own source".
  - "dashboard shows ielts only with a profile", with `daysLeft` from local today.
- [ ] **Step 2:** Run `npx vitest run tests/ielts/history.test.ts tests/progress/dashboard.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The attempts list filter is mocks / drills / part, and each row links to its review.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: IELTS history, band charts and dashboard card`.

---

### Task 20: Docs and full verification

**Files:**
- Modify: `README.md` (IELTS section: pages, admin sections, shared caps, no new env, the R2 key prefix, "back up before deploy"), `CLAUDE.md` (the architecture list gains `recording/` and `ielts/`)

- [ ] **Step 1:** Write the README and CLAUDE.md lines.
- [ ] **Step 2:** Run `npm test`, `npx tsc --noEmit` and `npm run lint`. Expected: all pass, 0 errors.
- [ ] **Step 3:** Run `npm run dev`, then in the browser preview: create a profile, see the plan, open the calculator, start a Part 2 drill with audio, finish, self-rate, and see the AI section unlock (stub AI if no key). Check the console has no hydration errors.
- [ ] **Step 4:** Commit: `docs: IELTS Prep setup and architecture`.
- [ ] **Step 5:** Ask the user to run `npm run backup` against production before this branch deploys.

## Notes

(Task 0 phone spike results go here.)
