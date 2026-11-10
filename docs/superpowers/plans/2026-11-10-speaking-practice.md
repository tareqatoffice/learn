# Speaking Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Speaking Practice module: a daily routine of recorded shadowing / read-aloud / record-and-review takes (audio, optional video) stored in Cloudflare R2, with server transcription, self-rating, AI speech and body-language feedback, admin-authored lessons, and streak/progress tracking — working on desktop and phone browsers.

**Architecture:** Domain logic in a new top-level `speaking/` folder (like `progress/`, `admin/`), Mongoose models in `models/`, R2 and speech-to-text clients in `lib/`, pages under `app/(app)/speaking/**` with Server Actions in `actions.ts`, admin under `app/(app)/admin/speaking/**`. Media never passes through Vercel: the browser uploads to and plays from R2 via presigned URLs; only the server-side transcription step reads the small audio-only file.

**Tech Stack:** Next.js 16 App Router, Mongoose, zod 4, vitest + mongodb-memory-server, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2), Cloudflare Workers AI Whisper (REST), OpenRouter via `lib/openrouter.ts`, browser `MediaRecorder`.

**Spec:** `docs/superpowers/specs/2026-11-10-speaking-practice-design.md`

## Global Constraints

- Follow `CLAUDE.md`: logic outside `app/`; models exported from `models/index.ts`; env only through `getEnv()` in `lib/env.ts`; `buildMetadata({ title, description, path })` on every page; Next.js 16 — read `node_modules/next/dist/docs/` before writing Next code; `proxy.ts`, not middleware.
- Admin: register in `admin/nav.ts`; pages use `AdminPage`/`AdminCard`/`AdminSection`/`AdminList`; actions start with `adminContext()` and return `ActionResult` (`ok`/`fail`); client uses `useAdminAction()` / `<SaveBar>` / `<ActionStatus>`.
- User Server Actions start with `requireUser()` then `connectDb()`; every query on takes/profile filters by `userId` from the session, never from input.
- AI through `getAiConfig()`, `modelChain()`, `chatCompletion()`, `extractJson()`; AI feedback calls go through `metered()` (export it from `progress/quizAi.ts`). Never pass the API key to a page. Module works fully with AI off and with STT unset.
- R2 bucket private. Presigned PUT/GET expire in 600 s. Object keys `takes/<userId>/<takeId>.<ext>` and `takes/<userId>/<takeId>.audio.<ext>`; lesson audio `lessons/<lessonId>/<random>.<ext>`.
- Audio 48 kbps mono; video 640×480 front camera, 600 kbps. Mime chosen by `MediaRecorder.isTypeSupported` in order — audio: `audio/webm;codecs=opus`, `audio/mp4`; video: `video/webm;codecs=vp9,opus`, `video/webm`, `video/mp4`.
- Default task targets (minutes): shadowing 15, readAloud 5, recordReview 2. Task keys `shadowing | readAloud | recordReview`; URL slugs `shadowing | read-aloud | record-review`.
- Take caps: shadowing = clip length × 2 (600 s when length unknown); readAloud and recordReview 600 s; absolute 900 s. Size cap = cap seconds × (video ? 120_000 : 8_000) bytes.
- Video default on for recordReview only. Headphone confirmation required before shadowing.
- Dates are the user's local `YYYY-MM-DD`. The client sets cookie `tz` (IANA zone); server computes "today" with `Intl.DateTimeFormat("en-CA", { timeZone })`, fallback `UTC`.
- Self-rating and AI scores are integers 1–5.
- UI copy: sentence case, no "please", no "successfully"; errors say what happened and what to do.
- Must work on desktop Chrome/Edge/Safari/Firefox and on iOS Safari / Android Chrome.

## Review Focus

1. **iOS Safari recording while a clip plays** — recording starts from the same tap that starts playback; an interrupted take (screen lock / tab hidden) stops and keeps what was recorded. Test: Task 9 "stops and keeps data on visibilitychange hidden".
2. **Upload fails or user leaves mid-upload** — blob kept in memory, retry offered, `beforeunload` warning while unsaved. Tests: Task 9 "retries after a failed PUT without re-recording", Task 10 "TaskRecorder shows retry after a failed upload".
3. **Confirming a take whose object never arrived, or someone else's take** — `confirmTake` HEADs the object and rejects other users' take ids. Tests: Task 5 "confirmTake rejects missing object", "rejects another user's take".
4. **Day boundary / time zone** — a take at 23:30 local counts for that local day even when UTC is the next day; an unpractised today doesn't break the streak. Tests: Task 3 `localDate` and `streak` cases.
5. **Lesson deleted or unpublished after takes exist** — review renders from the take's copied material; today's assignment moves to the next lesson. Tests: Task 4 "assignment skips an unpublished lesson", Task 5 "getTake renders when lesson deleted".

---

### Task 1: Phone spike (throwaway)

Not merged. Proves the risky browser parts before real code.

**Files:**
- Create (temporary): `app/(app)/speaking/spike/page.tsx` and a temporary server action that presigns with raw `@aws-sdk` calls.

- [ ] **Step 1:** One page with buttons: play a sample clip and start an audio `MediaRecorder` from the same tap; record video from the front camera with a parallel audio-only recorder on the same audio track; draw 4 frames from the recorded `<video>` to a canvas as JPEG data URLs; PUT the blob to a presigned R2 URL; play it back from a presigned GET.
- [ ] **Step 2:** Run on a real iPhone (Safari) and Android phone (Chrome) over HTTPS (Vercel preview or a tunnel). Write results in this plan's Notes section: mime chosen per device, recording during playback works, frame grab works, R2 CORS works.
- [ ] **Step 3:** Delete the spike files. Commit only the notes:

```bash
git add docs/superpowers/plans/2026-11-10-speaking-practice.md
git commit -m "docs: record phone recording spike results"
```

If any part fails on a phone, stop and report to the user before Task 9.

---

### Task 2: Env, R2 client and speech-to-text client

**Files:**
- Modify: `lib/env.ts`, `.env.example`, `package.json` (add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- Create: `lib/r2.ts`, `lib/stt.ts`
- Test: `tests/lib/r2.test.ts`, `tests/lib/stt.test.ts`

**Interfaces:**
- Produces (`lib/env.ts`): strings defaulting to `""`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CF_AI_TOKEN`; number `STT_DAILY_LIMIT` default `200`.
- Produces (`lib/r2.ts`):
  - `storageConfigured(): boolean`
  - `presignPut(key: string, contentType: string): Promise<string>`
  - `presignGet(key: string): Promise<string>`
  - `headObject(key: string): Promise<{ size: number; contentType: string } | null>`
  - `getObjectBytes(key: string): Promise<Uint8Array>`
  - `deleteObjects(keys: string[]): Promise<void>` (no-op on empty; batches of 1000)
  - `setR2Client(client: S3Client | null): void` (test seam)
- Produces (`lib/stt.ts`):
  - `sttConfigured(): boolean` (needs `R2_ACCOUNT_ID` and `CF_AI_TOKEN`)
  - `class SttError extends Error`
  - `transcribe(audio: Uint8Array, options?: { fetch?: typeof fetch }): Promise<string>` — POST `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`, bearer `CF_AI_TOKEN`, JSON `{ audio: <base64> }`; returns `result.text.trim()`; throws `SttError` on non-2xx or missing text.

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/r2.test.ts
it("storageConfigured is false until all four R2 vars are set", ...) // false; vi.stubEnv ×4 + resetEnvCache() → true
it("presignPut signs a PUT for the key", async () => {
  const url = await presignPut("takes/u/t.webm", "audio/webm");
  expect(new URL(url).pathname).toContain("/takes/u/t.webm");
  expect(url).toContain("X-Amz-Expires=600");
});
it("headObject returns null on NotFound", ...) // fake client send rejects { name: "NotFound" }
it("deleteObjects sends nothing for an empty list", ...)

// tests/lib/stt.test.ts
it("transcribe posts base64 audio and returns trimmed text", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, result: { text: " hello there " } })));
  expect(await transcribe(new Uint8Array([1, 2, 3]), { fetch })).toBe("hello there");
  expect(JSON.parse(fetch.mock.calls[0][1].body).audio).toBe("AQID");
});
it("transcribe throws SttError on a 500", ...)
```

- [ ] **Step 2:** Run `npx vitest run tests/lib/r2.test.ts tests/lib/stt.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3:** `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`; add env keys (and to `.env.example` with comments); implement. R2 endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`.
- [ ] **Step 4:** Same command — Expected: PASS. `npx tsc --noEmit` — Expected: no errors.
- [ ] **Step 5: Commit**

```bash
git add lib/env.ts lib/r2.ts lib/stt.ts .env.example package.json package-lock.json tests/lib/r2.test.ts tests/lib/stt.test.ts
git commit -m "feat: add R2 storage and Workers AI speech-to-text clients"
```

---

### Task 3: Models and pure schedule logic

**Files:**
- Create: `models/speakingLesson.ts`, `models/speakingTake.ts`, `models/speakingSettings.ts`, `models/speakingProfile.ts`, `models/speakingDay.ts`, `models/speakingUsage.ts`, `speaking/tasks.ts`, `speaking/schedule.ts`
- Modify: `models/index.ts`; `content/backup.ts` (`SpeakingLesson` and `SpeakingSettings` in `CONTENT_COLLECTIONS`; all except `SpeakingUsage` in `ALL_COLLECTIONS`)
- Test: `tests/speaking/schedule.test.ts`, extend `tests/models/indexes.test.ts`

**Interfaces:**
- Produces (`speaking/tasks.ts`): `TASKS = ["shadowing", "readAloud", "recordReview"] as const`; `type TaskKey`; `TASK_SLUG: Record<TaskKey, string>`; `taskFromSlug(slug: string): TaskKey | null`; `TASK_LABEL: Record<TaskKey, string>` = Shadowing / Read aloud / Record and review; `DEFAULT_TARGET_MIN` = `{ shadowing: 15, readAloud: 5, recordReview: 2 }`; `VIDEO_DEFAULT` = `{ shadowing: false, readAloud: false, recordReview: true }`.
- Produces (models, `timestamps: true`):
  - `SpeakingLesson`: `title` (req), `order` (Number, req), `status` (`STATUSES`, default draft), `subjectIds` [ObjectId], `shadow: { audioKey?, audioUrl?, durationSec?, text? }`, `passage?`, `prompt?`.
  - `SpeakingTake`: `userId` (req), `date` (req), `task` (enum `TASKS`), `lessonId?`, `material: { title?, text?, prompt?, generated: Boolean }`, `media: { kind: "audio"|"video", key, mime, audioKey?, audioMime?, durationSec, capSec, size?, stored: Boolean default false }`, `transcript?`, `transcriptStatus` enum `none|pending|done|failed|unavailable` default `none`, `self?: { fluency, confidence, eyeContact?, gestures?, note? }`, `markers: [{ atSec, label }]`, `ai?: { speech?: { fluency, vocabulary, grammar, summary, strengths[], workOn[], missedWords[] }, body?: { confidence, eyeContact, gestures, suggestions[] }, model?, at? }`. Indexes `{ userId: 1, date: -1 }`, `{ userId: 1, task: 1, date: -1 }`.
  - `SpeakingSettings` (singleton, unique `key: "default"`): `targets: { shadowing, readAloud, recordReview }`.
  - `SpeakingProfile` (unique `userId`): `targets?` (partial), `enabled` (default all true), `video` (default `VIDEO_DEFAULT`), `bodyConsentAt?: Date`.
  - `SpeakingDay` (unique `{ userId, date }`): `lessonId`.
  - `SpeakingUsage` (unique `{ userId, day }`, TTL 3 days on `createdAt`): `count` — STT counter, same shape as `models/aiUsage.ts`.
- Produces (`speaking/schedule.ts`, pure):
  - `localDate(now: Date, timeZone: string): string`
  - `addDays(date: string, n: number): string`
  - `weekDates(today: string): string[]` (Sunday first, 7 items, as in the tracker)
  - `type DayMinutes = Partial<Record<TaskKey, number>>`
  - `dayFraction(mins: DayMinutes, targets: Record<TaskKey, number>, enabled: Record<TaskKey, boolean>): number` — Σ min(mins, target) over enabled ÷ Σ enabled targets; 0 when none enabled.
  - `taskDone(minutes: number, target: number): boolean`
  - `streak(practised: Set<string>, today: string): number` — today counts if present; else start from yesterday.
  - `longestStreak(practised: Set<string>): number`
  - `takeCapSec(task: TaskKey, clipSec?: number): number`; `takeCapBytes(capSec: number, video: boolean): number`

- [ ] **Step 1: Write failing tests** (`tests/speaking/schedule.test.ts`)

```ts
expect(localDate(new Date("2026-11-10T19:30:00Z"), "Asia/Dhaka")).toBe("2026-11-11");
expect(localDate(new Date("2026-11-11T04:30:00Z"), "America/New_York")).toBe("2026-11-10");
expect(weekDates("2026-11-11")).toEqual(["2026-11-08","2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13","2026-11-14"]);
const T = { shadowing: 15, readAloud: 5, recordReview: 2 }, E = { shadowing: true, readAloud: true, recordReview: true };
expect(dayFraction({ shadowing: 30, readAloud: 5 }, T, E)).toBeCloseTo(20 / 22);
expect(dayFraction({ readAloud: 5 }, T, { ...E, shadowing: false })).toBeCloseTo(5 / 7);
expect(dayFraction({}, T, { shadowing: false, readAloud: false, recordReview: false })).toBe(0);
expect(taskDone(14.9, 15)).toBe(false); expect(taskDone(15, 15)).toBe(true);
const d = new Set(["2026-11-08", "2026-11-09"]);
expect(streak(d, "2026-11-10")).toBe(2);
expect(streak(new Set([...d, "2026-11-10"]), "2026-11-10")).toBe(3);
expect(streak(new Set(["2026-11-07"]), "2026-11-10")).toBe(0);
expect(longestStreak(new Set(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-06"]))).toBe(3);
expect(takeCapSec("shadowing", 90)).toBe(180);
expect(takeCapSec("shadowing")).toBe(600);
expect(takeCapSec("shadowing", 1200)).toBe(900);
expect(takeCapSec("readAloud")).toBe(600);
expect(takeCapBytes(600, false)).toBe(4_800_000);
expect(takeCapBytes(600, true)).toBe(72_000_000);
```

Extend `tests/models/indexes.test.ts`: a duplicate `SpeakingDay { userId, date }` and a duplicate `SpeakingProfile { userId }` are rejected.

- [ ] **Step 2:** Run `npx vitest run tests/speaking tests/models` — Expected: FAIL.
- [ ] **Step 3:** Implement models, `speaking/tasks.ts`, `speaking/schedule.ts`; update `models/index.ts` and `content/backup.ts`.
- [ ] **Step 4:** Run `npx vitest run tests/speaking tests/models tests/content/backup.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add speaking models and schedule logic"`.

---

### Task 4: Settings, lessons and today's assignment

**Files:**
- Create: `speaking/settings.ts`, `speaking/lessons.ts`
- Test: `tests/speaking/settings.test.ts`, `tests/speaking/lessons.test.ts`

**Interfaces:**
- Produces (`speaking/settings.ts`):
  - `type EffectiveSettings = { targets: Record<TaskKey, number>; enabled: Record<TaskKey, boolean>; video: Record<TaskKey, boolean>; bodyConsent: boolean }`
  - `getDefaults(): Promise<Record<TaskKey, number>>` (singleton, else `DEFAULT_TARGET_MIN`)
  - `saveDefaults(targets: Record<TaskKey, number>): Promise<ActionResult>` (integers 1–120)
  - `getEffectiveSettings(userId: string): Promise<EffectiveSettings>`
  - `saveProfile(userId: string, input: { targets?: Partial<Record<TaskKey, number>>; enabled?: Partial<Record<TaskKey, boolean>>; video?: Partial<Record<TaskKey, boolean>> }): Promise<ActionResult>`
  - `setBodyConsent(userId: string, consent: boolean): Promise<void>`
- Produces (`speaking/lessons.ts`):
  - `type LessonView = { id: string; title: string; order: number; shadow: { audioKey?: string; audioUrl?: string; durationSec?: number; text?: string } | null; passage: string; prompt: string }`
  - `lessonHasPart(lesson: LessonView, task: TaskKey): boolean` — shadowing needs (audioKey or audioUrl) and text; readAloud needs passage; recordReview needs prompt.
  - `todaysLesson(userId: string, date: string, enabled: Record<TaskKey, boolean>): Promise<LessonView | null>` — stored `SpeakingDay` lesson if still published; else first published lesson by `order` the user hasn't finished, upserted into `SpeakingDay` via `retryOnDuplicateKey`. Finished = every enabled task the lesson has a part for has ≥ 1 stored take with that `lessonId`.
  - `swapLesson(userId: string, date: string, lessonId: string): Promise<ActionResult>` (published only)
  - `listPublishedLessons(): Promise<{ id: string; title: string; order: number }[]>`

- [ ] **Step 1: Write failing tests**

```ts
it("assigns the first unfinished published lesson and keeps it all day", ...)
// L1(order 1, passage + prompt), L2(order 2); todaysLesson → L1; add stored readAloud take on L1; same date → still L1
it("moves on only when every enabled part has a take", ...)
// next day after readAloud only → L1; after a recordReview take too → next day L2
it("assignment skips an unpublished lesson", ...) // SpeakingDay → L1, set L1 draft → returns L2 and SpeakingDay updated
it("swapLesson refuses a draft lesson", ...)      // ok false
it("returns null when there are no published lessons", ...)
it("profile targets override admin defaults", ...) // saveDefaults {15,5,2}; saveProfile {targets:{shadowing:20}} → 20 / 5 / 2
it("rejects a target of 0 or 121", ...)
```

- [ ] **Step 2:** Run `npx vitest run tests/speaking` — Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add speaking settings and daily lesson assignment"`.

---

### Task 5: Takes service and progress queries

**Files:**
- Create: `speaking/takes.ts`, `speaking/progress.ts`
- Test: `tests/speaking/takes.test.ts`, `tests/speaking/progress.test.ts`

**Interfaces:**
- Consumes: `lib/r2.ts` and `sttConfigured` (Task 2); `takeCapSec`, `takeCapBytes`, `localDate`, `weekDates`, `dayFraction`, `streak`, `longestStreak` (Task 3); `todaysLesson`, `getEffectiveSettings` (Task 4).
- Produces (`speaking/takes.ts`):
  - `type StartTakeInput = { task: TaskKey; date: string; lessonId: string | null; material: { title?: string; text?: string; prompt?: string; generated: boolean }; kind: "audio" | "video"; mime: string; audioMime?: string; clipSec?: number }`
  - `startTake(userId: string, input: StartTakeInput): Promise<ActionResult<{ takeId: string; uploadUrl: string; audioUploadUrl?: string; maxBytes: number; capSec: number }>>` — refuses when `!storageConfigured()`; material text ≤ 5000; creates take `stored: false`; `audioUploadUrl` only for video.
  - `confirmTake(userId: string, takeId: string, durationSec: number): Promise<ActionResult>` — owner only; HEADs main (and audio) key; on missing or `size > maxBytes` → `fail("Your recording didn't finish uploading. Try again.")`; sets `stored`, `size`, `durationSec = min(durationSec, capSec)`, `transcriptStatus = sttConfigured() ? "pending" : "unavailable"`.
  - `type TakeView` = take fields as plain data + `mediaUrl: string`, `audioUrl?: string`, `sourceAudioUrl?: string` (presigned lesson audio, or its external `audioUrl`).
  - `getTake(userId: string, takeId: string): Promise<TakeView | null>`
  - `saveSelfRating(userId: string, takeId: string, input: { fluency: number; confidence: number; eyeContact?: number; gestures?: number; note?: string; markers?: { atSec: number; label: string }[] }): Promise<ActionResult>` — integers 1–5; eyeContact/gestures rejected on audio takes; note ≤ 1000; ≤ 50 markers, label ≤ 60, `atSec` within duration.
  - `deleteTake(userId: string, takeId: string): Promise<ActionResult>` — deletes R2 keys, then the document.
  - `deleteAllTakes(userId: string): Promise<number>`
  - `type TakeSummary = { id: string; date: string; task: TaskKey; kind: "audio" | "video"; durationSec: number; title: string; self?: { fluency: number }; ai?: { fluency?: number } }`
  - `listTakes(userId: string, filter: { task?: TaskKey; limit?: number; before?: string }): Promise<TakeSummary[]>` — stored only, newest first, default limit 50.
- Produces (`speaking/progress.ts`):
  - `getToday(userId: string, timeZone: string, now?: Date): Promise<{ date: string; settings: EffectiveSettings; lesson: LessonView | null; minutes: DayMinutes; done: Record<TaskKey, boolean>; week: { date: string; fraction: number }[]; streak: number; best: number; storage: boolean }>`
  - `getTrends(userId: string, days: number, timeZone: string): Promise<{ date: string; minutes: number; self: { fluency?: number; confidence?: number }; ai: { fluency?: number; vocabulary?: number; grammar?: number; confidence?: number } }[]>` (daily averages, rounded to 1 decimal)

- [ ] **Step 1: Write failing tests** (`vi.mock("@/lib/r2")`)

```ts
it("startTake presigns keys under the user's folder", ...)   // uploadUrl key starts `takes/${user}/`; video → audioUploadUrl defined
it("startTake caps shadowing at twice the clip length", ...) // clipSec 90 → capSec 180, maxBytes 1_440_000
it("confirmTake rejects missing object", ...)                // headObject → null → ok false; stored false
it("rejects another user's take", ...)                       // confirmTake(otherUser, takeId) → ok false
it("confirmTake marks transcript unavailable when STT is unset", ...)
it("saveSelfRating rejects eyeContact on an audio take", ...)
it("deleteTake removes both R2 keys and the document", ...)  // deleteObjects([key, audioKey])
it("getTake renders when lesson deleted", ...)               // material.text still returned
it("getToday sums minutes per task and marks done at target", ...) // 10 + 6 min shadowing → 16, done
it("unstored takes don't count", ...)
it("week fractions and streak use local dates", ...)         // take dated local day, tz "Asia/Dhaka"
```

- [ ] **Step 2:** Run `npx vitest run tests/speaking` — Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add speaking takes service and progress queries"`.

---

### Task 6: Transcription job

**Files:**
- Create: `speaking/transcribe.ts`
- Test: `tests/speaking/transcribe.test.ts`

**Interfaces:**
- Consumes: `getObjectBytes` (Task 2), `transcribe`, `sttConfigured` (Task 2), `SpeakingUsage` (Task 3).
- Produces: `transcribeTake(userId: string, takeId: string, deps?: { transcribe?: typeof transcribe }): Promise<ActionResult<{ transcript: string }>>` — owner only; runs only when status is `pending` or `failed`; reads `audioKey ?? key`; counts against `STT_DAILY_LIMIT` per UTC day with refund on failure (same pattern as `consumeAiCall`); sets `done` + transcript, or `failed`. Over the limit → `fail("You've reached today's transcription limit. It resets at midnight UTC.")` and status stays `pending`.

- [ ] **Step 1: Write failing tests**

```ts
it("saves the transcript and marks done", ...)          // deps.transcribe → "hello" → transcript "hello", status "done"
it("uses the audio-only key for video takes", ...)      // getObjectBytes called with audioKey
it("marks failed and refunds usage on STT error", ...)  // SpeakingUsage count 0 afterwards
it("stops at the daily limit", ...)                     // STT_DAILY_LIMIT=1 → second take ok false, status pending
it("ignores a take that is already done", ...)
```

- [ ] **Step 2–4:** `npx vitest run tests/speaking/transcribe.test.ts` FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: transcribe speaking takes server-side"`.

---

### Task 7: AI coach — speech, body language, generated material

**Files:**
- Modify: `lib/openrouter.ts` (`ChatMessage.content: string | ContentPart[]`, `ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }`; `CatalogModel.images: boolean` from `architecture.input_modalities` containing `"image"`); `progress/quizAi.ts` (export `metered`, `SAFETY` unchanged); `models/aiSettings.ts`, `lib/aiSettings.ts`, `components/admin/AiSettingsForm.tsx` (optional `visionModel: string`, empty = use the primary chain)
- Create: `speaking/coach.ts`
- Test: `tests/speaking/coach.test.ts`; keep `tests/progress/quizAi.test.ts` and `tests/components/AiSettingsForm.test.tsx` passing (add a case for `visionModel`)

**Interfaces:**
- Produces (`speaking/coach.ts`):
  - `type SpeechFeedback = { fluency: number; vocabulary: number; grammar: number; summary: string; strengths: string[]; workOn: string[]; missedWords: string[] }`
  - `type BodyFeedback = { confidence: number; eyeContact: number; gestures: number; suggestions: string[] }`
  - `speechFeedback(userId: string, takeId: string, deps?: { fetch?: typeof fetch }): Promise<AiResult<SpeechFeedback>>` — requires transcript `done` and a saved self-rating (else `"Rate yourself first, then ask the coach."`); sends transcript and, for shadowing/readAloud, the reference text, in tagged blocks under the `SAFETY` rule; zod-parses (scores clamped to 1–5; summary ≤ 800; lists ≤ 5 items, ≤ 400 chars); saves `ai.speech`, `ai.model`, `ai.at`.
  - `bodyFeedback(userId: string, takeId: string, frames: string[], deps?): Promise<AiResult<BodyFeedback>>` — video takes only; requires `bodyConsentAt`; 1–6 frames, each `data:image/jpeg;base64,` ≤ 200 KB; model = `visionModel` or primary chain; if the model rejects images → `"The AI model can't read images. Ask your admin to set a vision model."`; frames not stored; saves `ai.body`.
  - `generateMaterial(userId: string, task: "readAloud" | "recordReview", deps?): Promise<AiResult<{ title: string; text?: string; prompt?: string }>>` — B2-level everyday English: a 120–180-word passage, or one speaking prompt with 3 hint bullets.
  - All three go through `metered()`; AI off → the same "off" message quiz coach uses.

- [ ] **Step 1: Write failing tests** (fake OpenRouter `fetch`, as in `tests/progress/quizAi.test.ts`)

```ts
it("speechFeedback refuses before self-rating", ...)
it("speechFeedback saves clamped scores", ...)              // model returns fluency 7 → saved 5
it("speechFeedback refunds the AI call on unreadable JSON", ...)
it("bodyFeedback refuses without consent", ...)
it("bodyFeedback sends frames as image_url parts and stores none", ...)
it("bodyFeedback refuses an audio take", ...)
it("generateMaterial returns a passage for readAloud", ...)
it("AI off: all three return ok false", ...)
```

- [ ] **Step 2–4:** `npx vitest run tests/speaking/coach.test.ts tests/progress tests/components/AiSettingsForm.test.tsx` FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add speaking AI coach with vision feedback"`.

---

### Task 8: Admin — speaking lessons and default targets

**Files:**
- Modify: `admin/nav.ts` (Content: `{ href: "/admin/speaking", label: "Speaking lessons", description: "Shadowing audio, read-aloud passages and speaking prompts." }`)
- Create: `admin/speaking.ts`, `app/(app)/admin/speaking/page.tsx`, `app/(app)/admin/speaking/actions.ts`, `app/(app)/admin/speaking/[lessonId]/page.tsx`, `components/admin/SpeakingLessonForm.tsx`, `components/admin/SpeakingDefaultsForm.tsx`
- Test: `tests/admin/speaking.test.ts`

**Interfaces:**
- Produces (`admin/speaking.ts`):
  - `lessonInput` (zod): `title` 1–200, `status`, `subjectIds`, `shadowText` ≤ 5000, `shadowAudioUrl` (https URL or ""), `shadowDurationSec` 0–1200, `passage` ≤ 5000, `prompt` ≤ 1000.
  - `createLesson(input): Promise<ActionResult<{ id: string }>>` (order = max + 1); `updateLesson(id: string, input): Promise<ActionResult>`; `deleteLesson(id: string): Promise<ActionResult>` (deletes its audio key, never touches takes or `SpeakingDay` rows — Task 4 skips missing lessons); `moveLesson(id: string, dir: "up" | "down"): Promise<ActionResult>`.
  - `startLessonAudioUpload(id: string, mime: string, size: number): Promise<ActionResult<{ uploadUrl: string; key: string }>>` (`audio/*` only, ≤ 50 MB); `confirmLessonAudio(id: string, key: string, durationSec: number): Promise<ActionResult>` (key must start `lessons/<id>/`; HEAD check; deletes the previous key).
- `actions.ts` wraps each with `adminContext()`; the defaults card calls `saveDefaults` (Task 4). Revisions: hook into `content/revisions.ts` only if it accepts a new collection without schema changes; otherwise skip and say so in the commit message.

- [ ] **Step 1: Write failing tests**

```ts
it("non-admins can't create lessons", ...)      // pattern from tests/admin/authz-actions.test.ts
it("createLesson appends to the end of the order", ...)
it("deleteLesson keeps users' takes", ...)
it("moveLesson swaps order with the neighbour", ...)
it("confirmLessonAudio rejects a key outside the lesson's folder", ...)
```

The existing test that every `ADMIN_NAV` entry has a page must pass.

- [ ] **Step 2–4:** `npx vitest run tests/admin` FAIL → implement → PASS.
- [ ] **Step 5:** `npm run dev`, sign in with the dev admin login, create a lesson with audio, passage and prompt, reorder, delete. Expected: list updates, no console errors.
- [ ] **Step 6: Commit** — `git commit -m "feat: admin speaking lessons and default targets"`.

---

### Task 9: Browser recorder, upload and frame grab

**Files:**
- Create: `lib/media.ts`, `lib/useRecorder.ts`, `lib/uploadTake.ts`
- Test: `tests/lib/media.test.ts`, `tests/lib/useRecorder.test.ts`, `tests/lib/uploadTake.test.ts` (jsdom; fake `MediaRecorder` and `getUserMedia`)

**Interfaces:**
- Produces (`lib/media.ts`): `pickMime(kind: "audio" | "video", isSupported: (m: string) => boolean): string | null`; `extFor(mime: string): "webm" | "mp4" | "m4a"` (audio/mp4 → m4a); `grabFrames(video: HTMLVideoElement, count: number, maxWidth = 512): Promise<string[]>` (evenly spaced, JPEG quality 0.7).
- Produces (`lib/useRecorder.ts`): `useRecorder({ kind, capSec }: { kind: "audio" | "video"; capSec: number })` → `{ state: "idle" | "asking" | "recording" | "stopped" | "error"; error: string; elapsedSec: number; stream: MediaStream | null; result: { blob: Blob; audioBlob?: Blob; mime: string; audioMime?: string; durationSec: number } | null; start(): Promise<void>; stop(): void; reset(): void }`. Settings from Global Constraints; video adds a second audio-only recorder on the same audio track; auto-stops at `capSec`; stops and keeps data on `visibilitychange` (hidden) and `pagehide`; releases tracks on stop/unmount; errors: `NotAllowedError` → "Microphone or camera access was blocked. Allow it in the browser to record.", `NotFoundError` → "No microphone or camera was found.", unsupported → "This browser can't record. Try Chrome, Edge or Safari."
- Produces (`lib/uploadTake.ts`): `class UploadError extends Error`; `uploadTake(url: string, blob: Blob, mime: string, fetchImpl?: typeof fetch): Promise<void>` — PUT with `Content-Type: mime`; throws `UploadError` on non-2xx or network failure.

- [ ] **Step 1: Write failing tests**

```ts
expect(pickMime("audio", (m) => m === "audio/mp4")).toBe("audio/mp4");
expect(pickMime("video", () => false)).toBeNull();
expect(extFor("audio/mp4")).toBe("m4a"); expect(extFor("video/mp4")).toBe("mp4"); expect(extFor("audio/webm;codecs=opus")).toBe("webm");
it("auto-stops at capSec", ...)                          // fake timers, capSec 3 → stopped, durationSec 3
it("stops and keeps data on visibilitychange hidden", ...)
it("video records a parallel audio-only blob", ...)
it("maps NotAllowedError to the blocked message", ...)
it("retries after a failed PUT without re-recording", ...) // 500 → UploadError; second call, same blob → resolves
```

- [ ] **Step 2–4:** `npx vitest run tests/lib` FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add browser recorder, uploader and frame grab"`.

---

### Task 10: Learner pages — today, recorder, review, history, settings

**Files:**
- Create: `app/(app)/speaking/page.tsx`, `app/(app)/speaking/actions.ts`, `app/(app)/speaking/[task]/page.tsx`, `app/(app)/speaking/takes/[takeId]/page.tsx`, `app/(app)/speaking/history/page.tsx`, `app/(app)/speaking/settings/page.tsx`; `components/speaking/` — `WeekStrip.tsx`, `TodayTasks.tsx`, `TaskRecorder.tsx`, `ShadowPlayer.tsx`, `TakeReview.tsx`, `SelfRatingForm.tsx`, `CoachPanel.tsx`, `BodyConsentDialog.tsx`, `TrendChart.tsx` (inline SVG, no chart dependency), `SpeakingSettingsForm.tsx`, `TimeZoneCookie.tsx`; `speaking/timezone.ts` (`readTimeZone(): Promise<string>` from cookie `tz`, validated, fallback `"UTC"`)
- Modify: `components/TopBar.tsx` (add `{ href: "/speaking", label: "Speaking" }` after Interview); `app/(app)/dashboard/page.tsx` (Speaking card from `getToday`: today's tasks with minutes/target and the streak)
- Test: `tests/components/WeekStrip.test.tsx`, `tests/components/SelfRatingForm.test.tsx`, `tests/components/TaskRecorder.test.tsx`, `tests/speaking/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 4–9.
- `actions.ts` exports, each `requireUser()` → `connectDb()` → service with `session.userId`: `startTakeAction`, `confirmTakeAction`, `transcribeTakeAction`, `saveSelfRatingAction`, `speechFeedbackAction`, `bodyFeedbackAction`, `generateMaterialAction`, `deleteTakeAction`, `swapLessonAction`, `saveProfileAction`, `setBodyConsentAction`.

Behaviour (from the spec):
- **Today:** "Recording storage isn't set up yet" notice when `!storage`; `WeekStrip` (7 bars, height ∝ fraction, today outlined); current and best streak; enabled task rows with minutes/target bar and done tick; today's lesson title, "Change lesson" (published list), and "Generate with AI" when the lesson lacks a part (readAloud/recordReview only; shadowing says "Today's lesson has no shadowing audio").
- **Recorder (`/speaking/[task]`):** material on screen; video toggle (default from settings); shadowing shows "I'm wearing headphones" checkbox required before Start; Start plays the clip and starts recording in the same tap; elapsed / cap timer; Stop → upload with progress, retry on failure, `beforeunload` guard while unsaved → `confirmTakeAction` → `transcribeTakeAction` (not awaited) → go to review.
- **Review (`/speaking/takes/[takeId]`):** player (video or audio; shadowing adds "Play source, then my take"); transcript, or its status with "Try again" when failed; `SelfRatingForm` (fluency and confidence always; eye contact and gestures for video; note; "Mark this moment" adds a marker at the player's time); `CoachPanel` shows "Rate yourself first" until a self-rating exists; on video, "Body language feedback" opens `BodyConsentDialog` the first time (text: a few still images of your face are sent to an outside AI provider through OpenRouter; your transcript is sent too; you can withdraw in Speaking settings), then grabs 5 frames and calls `bodyFeedbackAction`; self vs AI scores side by side; delete with confirm.
- **History:** filter by task, newest first, links to review; `TrendChart` of minutes and self/AI scores for 30 days.
- **Settings:** per-task target (1–120), enabled toggles, video defaults, withdraw body-language consent.
- `buildMetadata` with each page's path.

- [ ] **Step 1: Write failing tests**

```tsx
it("WeekStrip outlines today and scales bars by fraction", ...)
it("SelfRatingForm hides eye contact and gestures for audio takes", ...)
it("SelfRatingForm requires fluency", ...)               // submit empty → "Rate your fluency first"
it("TaskRecorder keeps Start disabled until headphones are confirmed for shadowing", ...)
it("TaskRecorder shows retry after a failed upload", ...)
it("actions use the session user, not input ids", ...)
it("signed-out users are rejected", ...)
```

- [ ] **Step 2–4:** `npx vitest run tests/components tests/speaking` FAIL → implement → PASS. Then `npm run lint` and `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 5: Verify in the browser** (`npm run dev` with R2 + CF env): one take of each task on desktop Chrome and Firefox; one shadowing take and one video record-and-review take on iPhone Safari and Android Chrome. Expected: takes saved, transcripts appear, self-rating and AI feedback saved, week strip and streak update, dashboard card matches.
- [ ] **Step 6: Commit** — `git commit -m "feat: speaking practice pages, recorder and review"`.

---

### Task 11: Docs and final check

**Files:**
- Modify: `README.md` (Speaking setup: create R2 bucket; CORS allowing `PUT, GET, HEAD` from app origins with header `Content-Type`; R2 API token scope; Workers AI token; env keys; storage cost note from the spec); `CLAUDE.md` (one Architecture line: `speaking/` — speaking practice logic; media in R2 via `lib/r2.ts`, transcription via `lib/stt.ts`)

- [ ] **Step 1:** Write the sections.
- [ ] **Step 2:** `npm test` — Expected: all pass. `npm run build` — Expected: success.
- [ ] **Step 3: Commit** — `git commit -m "docs: speaking practice setup and architecture"`.

---

## Notes

(Task 1 spike results go here.)
