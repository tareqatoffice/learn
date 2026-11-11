# Speaking Practice module — design

Date: 2026-11-10
Status: draft for approval

## Programme context

This is the first of four pieces, built in order, each with its own design:

1. **Speaking Practice** (this document) — daily everyday-English speaking routine with recording, review and progress.
2. **IELTS base + IELTS Speaking** — test date, target band, adjustable study plan, band history; Speaking Parts 1–3 mock format.
3. **IELTS Listening + Reading** (Academic) — question sets with auto-marking.
4. **IELTS Writing** (Academic Task 1 + Task 2) — AI marking per criterion.

Agreed for the IELTS pieces, recorded here so this module does not block them: IELTS **Academic** (user is studying abroad); per-user test date and target band; plan changes are **suggested by the app and approved by the user**, never applied silently. Speaking Practice and IELTS Prep are separate modules with separate pages and progress, but share recording, storage, AI feedback and attempt-history plumbing. Build that plumbing here with IELTS reuse in mind; do not build any IELTS feature now.

## Intent

The user wants a daily habit for speaking English out loud, modelled on a tracker they already use (`rehearsal-log.jsx`: three daily tasks, a weekly bar strip, current and best streak). The app version adds what the tracker can't: the material to practise with, recordings of every take (audio and optionally video), the ability to watch and judge themselves (including gestures and confidence), and AI feedback alongside their own judgement. It is for every approved user of the app, with content managed by the admin like the existing content types.

Success: a user opens the page, does today's ~22 minutes, every take is saved, they can rate themselves and read the AI's view, and over weeks they can see their streak, minutes and scores improve.

## Goals

- Daily routine of three tasks with default durations: **Shadowing 15 min**, **Read aloud 5 min**, **Record & review 2 min**. Admin sets defaults; each user can change their own durations and which tasks are on.
- Every task is recorded. Audio always; video optional per take.
- Material comes from admin-authored **lessons**; when none is available for the day, the AI generates a passage/prompt.
- Review of each take: playback, transcript, self-rating, AI feedback, saved together.
- Progress: streak, best streak, weekly bar strip (as in the tracker), minutes practised, self-ratings and AI scores over time.
- Users can delete their own recordings.

## Non-goals (this piece)

- Anything IELTS-specific (bands, test date, plan, mocks, listening/reading/writing).
- Pronunciation scoring from audio. Leave a seam for it (audio is kept, so a later version can send audio to an audio-capable model), but v1 feedback is from transcript and frames only.
- Full-motion video analysis. AI sees still frames only.
- Sharing recordings with other users, teachers or the admin.
- Automatic recording clean-up (admin-configurable retention can come later if storage fills).
- A native mobile app. Mobile is supported through the mobile browser (see Devices).

## Anti-goals (failure even if it "works")

- Recordings readable by anyone other than their owner (public bucket, guessable URLs, links that don't expire).
- Audio/video **uploads and playback** passing through Vercel functions (size/time limits, cost). The one exception is server-side transcription, which reads the small audio-only file (see Transcripts).
- AI feedback replacing the user's own judgement: the user rates first, AI second.
- Losing a take: a failed upload or AI error must not throw away the recording the user just made.
- Streak/progress kept in browser storage (the tracker's `window.storage`); it must live in MongoDB per user.

## Constraints

- Follow the repo's conventions in `CLAUDE.md`: logic outside `app/`, models via `@/models`, admin pages via `AdminPage`/`AdminCard`/etc., registered in `admin/nav.ts`, Server Actions via `adminContext()` returning `ActionResult`, env through `lib/env.ts`, `buildMetadata` per page. Next.js 16 — read `node_modules/next/dist/docs/` before writing Next code.
- AI goes through the existing OpenRouter setup: `getAiConfig()`, `modelChain`, `chatCompletion`, `extractJson`, and the per-user daily limit with refunds (`consumeAiCall` / the run-under-limit helper in `progress/quizAi.ts`). Never pass the API key to a page. AI off when no key is set — the module must still work fully without AI.
- Access: pages under `app/(app)/` so the existing sign-in + approved-account policy applies.

## Decisions made with the user

- **Audience:** all approved users; content authored in Admin.
- **Material:** admin-curated lessons, with AI filling gaps.
- **Recording:** everything recorded, including speaking along during shadowing.
- **Storage:** **Cloudflare R2**, "medium quality".
- **Video:** recorded too, to check gestures and self-confidence.
- **Judging:** the user judges themselves **and** gets AI results/suggestions.
- **Task timing:** many short takes add up toward the task's target minutes (answered after review).
- **Devices:** phones (iOS Safari, Android Chrome) must work in v1, as well as desktop (answered after review).

## The design

### Daily session flow

The Speaking page (`/speaking`) shows today: the three tasks with their durations, done/not done, and the weekly bar strip + streak (visual language of the tracker file is a good starting point, adapted to the app's Tailwind/shadcn styling and dark mode).

Each task opens a recorder screen:

- **Shadowing** — plays the lesson's source audio with its text on screen (text highlighting in sync is nice-to-have, builder's call). The user speaks along; **one pass of the clip = one take**. Headphones are required: show a clear prompt before starting (browsers can't reliably detect headphones; a confirm checkbox is fine). After the take: play source and take back-to-back for comparison.
- **Read aloud** — shows the lesson passage; **one reading = one take**.
- **Record & review** — shows the lesson's speaking prompt; user talks freely; one answer = one take (default target 2 min means typically one take).

**Timing (user's decision): many short takes add up.** Each task has a target in minutes. A progress timer on the task fills with the summed duration of today's saved takes for that task. The task is **done for the day when its target minutes are reached**; partial progress shows as partial (the weekly bar strip uses the fraction of today's total target minutes reached, capped at 100%). Each take has its own review. A day counts toward the streak when at least one take was saved that day (lenient, like the tracker's `computeStreak`; "done" is shown separately). Days are the user's local calendar day (store the local date string with each take, as the tracker's `isoDate` does; send the user's time zone with requests so the server and dashboard compute "today" the same way).

**Take length cap:** a take may not exceed the source clip length × 2 for shadowing, a generous fixed cap for read aloud and record & review (e.g. 10 min), and an absolute cap of 15 min. These caps also set the presign size cap.

### Recording

- `MediaRecorder` in the browser. **Audio:** mono, ~48 kbps Opus in WebM; Safari fallback to AAC/MP4 at a similar bitrate (pick by `MediaRecorder.isTypeSupported`). **Video:** ~480p, modest bitrate (~4–6 MB/min target), same container logic.
- **Video default:** on for Record & review, off for Shadowing and Read aloud; any take can toggle it. User's last choice per task may be remembered (builder's call).
- **Video takes also record an audio-only file** (a second `MediaRecorder` on the same audio track) so transcription and a future pronunciation check never need the large video.
- **Transcripts (changed after review, because phones must work):** transcription is **server-side**, not browser speech recognition. On phones the browser's speech recognition and `MediaRecorder` fight over the microphone, and Firefox has none. After a take is stored, the server reads the audio-only file from R2 and sends it to a speech-to-text service; the transcript is saved on the take. My suggestion for the service is **Cloudflare Workers AI Whisper**, since the user already uses Cloudflare; an OpenRouter audio-capable model or another Whisper host would also do. Keep it behind one small `transcribe(audio)` seam so it can be swapped. Credentials via `lib/env.ts`; when unset, takes still save with no transcript and the UI says why. Transcription does **not** count against the per-user daily AI limit (it is needed for every take), but has its own generous daily cap per user to bound cost (builder picks the number; admin-adjustable is nice-to-have). Do not run `lib/useSpeechInput.ts` during recording.
- Upload flow: server issues a short-lived **presigned PUT** URL to R2 for a key it chooses (`<userId>/<takeId>.<ext>`); browser uploads directly; browser then calls a Server Action to confirm the take (server verifies the object exists via HEAD before marking it stored). Playback via short-lived **presigned GET** URLs, generated server-side only for the owner. Bucket is private.
- If upload fails, keep the blob in memory and offer retry; don't navigate away silently (warn on leave).

### Devices (user's decision: phones must work in v1)

Must work on desktop Chrome, Edge, Safari, Firefox, and on **iOS Safari and Android Chrome**. Known phone issues to design for:

- iOS records MP4/AAC (and H.264 for video) only; pick the container with `MediaRecorder.isTypeSupported` and store the mime type.
- iOS requires a user gesture to start audio playback and recording; start both from the same tap for shadowing.
- Recording while the source audio plays must work on iOS (headphones required anyway); test it early, it is the riskiest part.
- Phones may suspend the page when the screen locks or the app is backgrounded: stop the take cleanly and keep what was recorded.
- Front camera for video; mobile-first layout for the recorder and review screens.
- Grabbing frames for AI (draw the `<video>` playback onto a canvas) must work on iOS Safari.

The plan should start with a small throwaway spike on a real iPhone and Android phone covering: record audio while a clip plays, record video, upload to R2 with a presigned URL, play back, grab frames.

### Review of a take

Order matters: **self-rating first, then AI.**

1. Playback (video or audio) with transcript beside it.
2. **Self-rating:** 1–5 for **confidence**, **eye contact**, **gestures/posture** (latter two only when video), plus **fluency** (always), optional free-text note. Optional **moment markers**: timestamp + short label ("looked down", "filler words", "good eye contact").
3. **AI feedback** (when AI is configured and the user asks for it — one click, counts against the daily AI limit):
   - **Speech:** from the transcript (and for Shadowing/Read aloud, the reference text so it can compare what was said vs. what was meant). Returns JSON: scores 0–100 or 1–5 for fluency, vocabulary, grammar; short summary; strengths; things to work on; for reading/shadowing, notable missed or changed words.
   - **Body language** (video takes only): the browser grabs a few still frames (e.g. 4–6 evenly spaced JPEGs, small) and they're sent with the request to a vision-capable model. Returns confidence, eye contact, posture/gestures ratings + suggestions. Frames are not stored long-term (builder may store them if useful, but they are not required).
   - **Consent (my call):** the first time a user asks for body-language feedback, show a one-time notice that a few still images of their face will be sent to an outside AI provider through OpenRouter, and record their agreement on their speaking settings. They can withdraw it in settings. Without consent, only speech feedback runs. Transcripts are already sent to the AI by the quiz coach today, so they need no extra notice beyond a line in the same notice.
   - If the configured primary/backup models don't accept images, the body-language part is skipped with a clear message; speech feedback still works. Whether to add a separate "vision model" setting to Admin → AI coach is the builder's call; lean towards adding it.
4. Saved together on the take; the review screen shows self-rating and AI rating side by side.

### Content (Admin)

New Content entry in `admin/nav.ts`: **Speaking lessons**. A lesson has:

- title, optional level/tags (could reuse Subjects), draft/published (reuse `content/visibility.ts` patterns),
- **shadowing**: source audio (uploaded by admin to R2, or an external audio URL) + its text,
- **read-aloud passage** (text),
- **speaking prompt** (text; e.g. "Describe a place you'd like to visit").

Any of the three parts may be missing. Admin also sets the **default task durations** (a small settings card on the same admin section).

**Which lesson is today's (my call, after review):** lessons have an order. On the user's first visit of a local day, the app **assigns today's lesson and stores it** (user + local date + lessonId), so it stays the same all day across tasks. The assigned lesson is the first published lesson in order that the user has not yet *finished*; a lesson is finished when every one of its parts that matches an enabled task has at least one take. The user can swap today's lesson for any other; the swap replaces the stored assignment and does not change the order or mark anything finished. When the user has run out of lessons, or today's lesson lacks the part a task needs, the user can ask the AI to generate one (passage or prompt; no AI audio — shadowing without admin audio is unavailable that day and the UI says so). Generated material is saved on the take so it can be reviewed later.

Lessons should take part in the existing revisions/export/backup machinery where that is straightforward; the builder decides how far (at minimum, include them in `npm run backup`/export).

### Per-user settings

Per user: task durations and which tasks are on (overriding admin defaults), video default per task. Stored in MongoDB.

### Progress

- Weekly bar strip (bar height = share of tasks done that day), current streak, best streak — as in the tracker.
- Minutes practised per day/week (sum of take durations).
- Charts over time of self-ratings and AI scores (one line per criterion), and a list/history of all takes with filters by task, each opening its review screen (model the history on `app/(app)/interview/history` and `progress/attempts.ts`).
- Surface a Speaking card on the dashboard (`app/(app)/dashboard`): today's tasks + streak.

### Deletion

Users can delete a take: deletes the R2 object(s) and the DB record. Deleting a user's data (if/when "clear progress" style features apply) must also delete their R2 objects. Admin deleting a lesson must not delete users' takes (takes keep a copy of the text they practised).

### Data (shape, not schema)

- **SpeakingLesson** — content, as above.
- **SpeakingTake** — userId, local date string, task (shadowing/readAloud/recordReview), lessonId (nullable) + copy of the practised text/prompt, media (R2 key, mime, kind audio/video, duration, size, stored flag), transcript, selfRating, markers, aiFeedback (speech + bodyLanguage parts, model used), timestamps. Index by userId + date.
- **Per-user speaking settings** — durations, enabled tasks, video defaults, body-language consent; on the user or a small own collection (builder's call).
- **Daily lesson assignment** — userId + local date + lessonId (unique on userId + date).
- Streaks are computed from takes; storing best streak is optional (it can be recomputed).

### Config

New env (validated in `lib/env.ts`): R2 account id, access key id, secret, bucket name; speech-to-text credentials (e.g. Cloudflare account id + Workers AI token). Module shows a clear "recording storage not configured" state when missing rather than crashing. Use the S3-compatible API (e.g. `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). R2 bucket CORS must allow PUT/GET from the app's origins — document this in the README with the deploy steps.

### Limits

- Take length caps as in the daily session flow; refuse to presign beyond the matching size cap.
- AI feedback calls count against the existing per-user daily limit; transcription has its own daily cap.

### Storage cost note (for the user/admin)

Audio ≈ 360 KB/min; video ≈ 4–6 MB/min. R2 free tier is 10 GB; beyond that ≈ $0.015/GB-month. A heavy video user can fill ~10 GB in ~3 months. No automatic retention in v1.

## Left to the builder

- Exact schemas, routes, component split, chart library choice (check what the repo already uses).
- Text-highlighting sync for shadowing.
- Exact frame count/size for vision requests and the AI prompt wording/JSON shape (follow `quizAi.ts` patterns).
- Whether to add a vision-model setting to Admin → AI coach.
- How far lessons join revisions/import-markdown.
- Testing approach (follow repo: vitest + in-memory Mongo; mock R2 and OpenRouter).
