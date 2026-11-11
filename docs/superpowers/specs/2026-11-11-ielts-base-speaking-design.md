# IELTS base + IELTS Speaking — design

Date: 2026-11-11
Status: approved 2026-11-11. Plan: `docs/superpowers/plans/2026-11-11-ielts-base-speaking.md`
Branch: `feature/ielts-speaking` (from `develop`)

Markers: **(decided)** = the user decided it; **(my call)** = my proposal, the user has asked me to mark these and will check them. Everything unmarked follows from those two or from the repo's conventions.

## Programme context

Piece 2 of 4:

1. Speaking Practice — built and merged (`docs/superpowers/specs/2026-11-10-speaking-practice-design.md`). Not IELTS.
2. **IELTS base + IELTS Speaking** — this document.
3. IELTS Listening + Reading (Academic).
4. IELTS Writing (Academic Task 1 + Task 2).

This piece builds the IELTS module's base (profile, plan, bands, countdown, history) for all four skills, plus the full Speaking skill. Listening, Reading and Writing appear in the plan and in band history from day one, but their practice screens come in pieces 3 and 4.

## Intent

The user is sitting **IELTS Academic** to study abroad **(decided)**. They want one place that knows their test date and target band, says what to study today, lets them practise and mock the Speaking test in the real format with recordings, gives them an honest band estimate after they have judged themselves, and shows over time whether they are on track. The plan adapts, but only with their approval.

Success: the user sets a test date and target, gets a three-phase plan, opens IELTS Prep each day to a short "today" list, does Speaking drills and weekly mocks with video, rates each mock, reads the AI's estimate, and sees their Speaking band and their study hours move towards target, with clear warnings when they are behind.

## Goals

- Per-user IELTS profile: test date, target band, current band, minutes per day **(decided)**.
- A three-phase study plan: foundation, skill building, mocks and polish **(decided)**, with today's activities derived from it.
- A warning heuristic of about 200 study hours per band, labelled as a rough guide and not an official figure **(decided)**.
- Plan changes are suggested by the app (missed days, weak scores) and applied only when the user approves **(decided)**.
- Band calculator: Listening and Reading raw scores to bands; four skill bands average to an overall band, rounded to the nearest half band **(decided)**.
- IELTS Speaking in the real format: Part 1 (4–5 min familiar topics), Part 2 (1 min prep, up to 2 min talk on a cue card), Part 3 (4–5 min abstract discussion) **(decided)**, both as single-part drills and as a full mock.
- Band estimates for the four Speaking criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation **(decided)**.
- Video on by default for mocks **(decided)**; self-rating first, then the AI estimate **(decided)**.
- Mock history and band charts; countdown to test day.
- Question content authored in Admin, with AI filling gaps **(decided)**.

## Non-goals (this piece)

- Listening, Reading and Writing practice screens or content (pieces 3 and 4). Only their place in the plan, in band history and in the calculator is built now.
- IELTS General Training.
- Pronunciation judged from audio. The AI works from the transcript **(decided)**. Audio is kept so a later version can send it to an audio-capable model.
- A live, conversational AI examiner that listens and answers in real time. The examiner here reads fixed questions; the user moves on with a tap.
- Official band conversion tables. IDP/British Council don't publish one fixed table; the calculator uses widely quoted approximations and says so.
- Sharing mocks with a teacher.

## Anti-goals (failure even if it "works")

- The plan changing without the user's approval **(decided)**.
- The AI's band shown before the user has rated themselves, or shown as if it were the real band. Every AI band carries "estimate".
- Pronunciation presented as if the AI heard the user. The UI must say plainly that pronunciation is judged from the transcript only **(decided)**.
- Copying the Speaking Practice plumbing instead of generalising it **(decided)**. Two recorders, two upload paths or two transcription jobs is a failure.
- Losing a mock recording partway through. A three-part mock is 11–14 minutes of the user's effort.
- The 200-hours-per-band figure shown as a promise or an official number.
- Any of piece 1's anti-goals regressing (private bucket, no media through Vercel functions, progress in MongoDB not the browser).

## Constraints

- Repo conventions in `CLAUDE.md`: logic outside `app/`, models through `@/models`, admin pages through `AdminPage`/`AdminCard`/`AdminSection`/`AdminList`, registered once in `admin/nav.ts`, Server Actions start with `adminContext()` and return `ActionResult`, client uses `useAdminAction`/`SaveBar`, env through `lib/env.ts`, `buildMetadata` on every page. Next.js 16: read `node_modules/next/dist/docs/` before writing Next code; `proxy.ts`, not middleware.
- Pages under `app/(app)/ielts/` so the sign-in and approved-account policy applies unchanged.
- AI through the existing OpenRouter setup (`getAiConfig()`, `modelChain`, `chatCompletion`, `metered`/`consumeAiCall`, the `visionModel` setting). Never pass the key to a page. With no key, everything except AI estimates and AI-generated questions still works.
- IELTS Prep is a separate module from Speaking Practice, with its own pages and progress, sharing recording, R2 storage, server transcription, AI feedback and attempt history **(decided)**.

## Known risks carried from piece 1

These come from the brief; the plan must address them before the mock UI depends on them:

- **No phone test yet** (recording while a clip plays on iPhone Safari and Android Chrome, video, upload, frame grab). The IELTS mock adds two more phone risks: one continuous 4–5 min video recording per part, and the examiner reading questions aloud with `speechSynthesis` while the mic records. **The plan starts with a throwaway phone spike covering piece 1's list plus these two.** If speech synthesis during recording fails on a phone, fall back to on-screen questions only on that device (examiner voice off). **(my call)** **Order (decided): the build does not wait for the phone results.** The spike page comes first in the plan; the user runs it on their own iPhone and Android phone while the shared plumbing, profile, plan, calculator and history are built. The examiner-voice fallback is built in either way. The mock screens take the spike's findings into account once they arrive; any finding that changes the recording design comes back to the user before the mock screens are finished.
- **Nothing run against live R2, Cloudflare STT, or in a hydrated browser.** The plan includes one end-to-end check against live R2 and STT before the IELTS screens are built on top.
- The brief says deferred minors from piece 1 are listed in final review notes in the commit history. I couldn't find such a list in the commit messages or under `docs/`. The builder should ask the user where it is or skip it; nothing in this design depends on it.

## The design

### 1. Shared recording plumbing (generalise piece 1)

Today the media, transcript, AI and ownership logic lives in `speaking/takes.ts`, `speaking/transcribe.ts` and `speaking/coach.ts`, tied to `SpeakingTake` and its three daily tasks. Pull the parts that don't depend on tasks into a shared layer **(decided: generalise, don't copy)**. The shape below is **(my call)**; the exact split is left to the builder:

- **`recording/` (new top-level folder, beside `speaking/`)**: the media sub-schema (kind, key, mime, audioKey, audioMime, duration, cap, size, stored), transcript fields and status, presign-for-upload with the size cap, confirm-by-HEAD, owner-only playback URLs, delete of R2 objects, and the transcription job. They work through a small adapter per owning collection (which model, the key prefix, how to find the owner's document), so `SpeakingTake` and the new IELTS recording use the same code.
- **Keys**: Speaking Practice keeps `takes/<userId>/…`; IELTS uses `ielts/<userId>/<attemptId>/<part>.<ext>`. Delete-all-user-data covers both prefixes.
- **Transcription cap**: one shared daily cap per user across both modules (the existing `SpeakingUsage` counter and `STT_DAILY_LIMIT`). A full mock costs 3 transcriptions. **(my call)**
- **AI limit**: IELTS estimates count against the same per-user daily AI limit through `metered`. One mock estimate = one call; body-language feedback on a mock = one more call. **(my call)**
- **Client**: `useRecorder`, `uploadTake` (retry), `pickMime`/`extFor`, `grabFrames`, `BodyConsentDialog` and the consent flag are reused as they are. Body-language consent is one flag for the user, shared by both modules **(my call)**: it covers the same thing (still frames of the face sent through OpenRouter).
- **Charts**: `TrendChart` becomes a generic line chart that takes series definitions, used by Speaking Practice trends and IELTS band charts. **(my call)**
- Speaking Practice's existing tests must still pass after the refactor; the refactor lands before any IELTS feature.
- **Production holds real Speaking Practice data** **(decided)**. The refactor must not change the stored shape of `SpeakingTake`: same collection, same field names and paths (`media.*`, `transcript`, `transcriptStatus`, `ai.*`), same R2 keys. The shared media sub-schema is extracted *from* the existing one, so old documents read unchanged and no migration is needed. If the builder finds a change to stored data unavoidable, it ships as a separate, idempotent migration script with a test, run only after `npm run backup`, and the README deploy steps say so. A test loads a fixture shaped like a current production take and checks it still reads, plays back and transcribes through the new code.

### 2. IELTS profile and setup

First visit to `/ielts` opens setup. Fields **(decided)**: test date, target band (overall, 4.0–9.0 in half bands), current band (overall; "don't know" allowed), minutes per day. My additions **(my call)**:

- **Study days per week**: which weekdays they study (default all seven). Needed so "missed day" means something.
- **Optional per-skill current and target bands.** If left blank, every skill uses the overall figures. When set, they weight the plan towards the weak skill.
- If "don't know" is picked for current band, the plan assumes target − 1.0 for the hours heuristic and suggests a diagnostic Speaking mock in week 1 (and the calculator for any practice test they have done).

The profile can be edited at any time. Editing the test date, target, minutes per day or study days is the user's own change, so it rebuilds the plan straight away, after showing a before/after preview. That is not a "silent change" because the user did it.

**After the test date** **(my call)**: the home page asks for their official result (four skill bands, overall computed) and offers "set a new test date" or "end this plan". The official result goes into band history marked "official".

### 3. Study plan

Generated in code, with no AI, so it works without a key and is testable **(my call)**.

**Inputs**: today, test date, minutes per day, study days, current and target bands (overall and per skill).

**Hours check (warning only)** **(decided heuristic)**: hours needed ≈ (target − current) × 200 for the overall band; hours available = study days left × minutes per day ÷ 60. If available < needed, the plan page and home show a warning with both numbers and the wording "rough guide, not an official figure". Shown options are only suggestions: more minutes per day, a later test date, or a lower target. Nothing changes until the user picks one.

**Phases** **(decided: three phases; split is my call)**: of the days left, foundation ≈ 30%, skill building ≈ 45%, mocks and polish ≈ 25%, with mocks and polish at least the final 7 days. With fewer than 21 days left, foundation is dropped and the split is 60/40. The phase split defaults live in an admin settings card (Admin → IELTS settings) so it can be tuned without code.

**Weekly targets**: each week gets minutes per skill. The base split is equal across the four skills; skills whose current band is further below target get proportionally more (any skill below target gets at least 15%). Each phase also has a mix of activity types:

- Foundation: mostly single-part drills, Speaking Practice routines, no full mocks (one diagnostic Speaking mock if current band is unknown).
- Skill building: drills plus one full Speaking mock a week.
- Mocks and polish: two full Speaking mocks a week; drills target the weakest criterion.

**Today**: on each study day the home page shows a short list sized to minutes per day, taken from what is left of this week's targets. For example: "Speaking: Part 2 drill × 2 (10 min)", "Speaking mock (15 min)", "Reading: 20 min, logged by hand". **(my call)**

**Listening, Reading and Writing before pieces 3 and 4** **(my call)**: the plan still budgets their time. Their items say "study outside the app and log your minutes" with a one-tap minutes log, so weekly progress and missed-day checks work for all four skills now. Pieces 3 and 4 replace the log with real practice screens.

**What counts as done**: minutes from IELTS Speaking drills and mocks (recording durations), minutes logged by hand for other skills, and **Speaking Practice minutes counting towards IELTS Speaking** **(my call)**. Piece 1 is the foundation fluency work that IELTS Speaking needs, and not counting it would make a user who does both look behind. They show as a separate line, "from Speaking Practice", and the plan caps their share at 50% of a week's Speaking target so mocks and drills still happen. They only count from the IELTS profile's creation date.

**Plan versions**: every plan is stored as a version (inputs + generated phases and weeks). A rebuild makes a new version; history is kept so the plan page can show "changed on …, because …".

### 4. Plan suggestions (app suggests, user approves)

**(decided: never silent)**. Checks run when the user opens `/ielts` (no cron needed) **(my call)**, at most once per local day, and create **suggestions**, each with a reason, the proposed change, and a before/after preview. The user can approve or dismiss each one. Approving makes a new plan version. A dismissed suggestion of the same kind isn't raised again for 7 days.

Triggers **(my call; thresholds stored in the IELTS settings singleton)**:

- **Missed days**: last week's done minutes < 60% of target, or 3 study days in a row with nothing done. Suggests spreading the shortfall over the remaining weeks, or, if that pushes a day beyond minutes per day + 50%, raising minutes per day or moving the test date.
- **Weak scores**: in the last 2 Speaking mocks, a criterion's band (the user's own rating and the AI estimate, whichever is lower) is ≥ 1.0 below target. Suggests moving 10–15% of Speaking minutes to drills for that criterion (examples: Part 3 drills for coherence, Part 2 drills for fluency).
- **Hours short**: the hours check went from OK to short since the last check.
- **Phase change**: entering the next phase early when its entry conditions are met (for example a mock at target − 0.5 or better during skill building). The plan never moves phases on its own; it only moves on dates.

The home page shows pending suggestions at the top. Suggestions are stored per user with status pending, approved or dismissed.

### 5. Band calculator and band history

- **Calculator page** (`/ielts/calculator`), usable without a profile: Listening raw /40, Reading raw /40 (Academic table), Writing and Speaking bands typed in. It shows the per-skill bands and the overall band. Overall = mean of the four, rounded to the nearest half band **(decided)**; a mean exactly on .25 or .75 rounds **up** (IELTS's published convention) **(my call)**. The conversion tables are constants in code, labelled "approximate, based on commonly published tables" **(my call; the builder sources the table and cites it in a code comment)**.
- **Save as a result**: from the calculator, the user can save the bands to band history with a source: practice test, official result, or other.
- **Band history**: one place (`IeltsBandEntry`) for per-skill bands with a date and source: official, practice test (calculator), Speaking mock (self), Speaking mock (AI estimate). Speaking mocks write their entries automatically.

### 6. IELTS Speaking content (Admin)

New admin section **IELTS Speaking** under Content in `admin/nav.ts` (`/admin/ielts/speaking`), following the admin conventions **(decided)**. The structure below is **(my call)**:

- **Part 1 frames**: a topic title (for example "Hometown", "Reading habits") and 3–5 questions. Flag: "about you" frames (work or study, home) used to open Part 1.
- **Part 2 cue cards**: topic line ("Describe a time when…"), 3–4 "You should say" bullets, the closing "and explain…" line, and 1–2 optional rounding-off questions.
- **Part 3 sets**: 4–6 abstract questions, **linked to a cue card** (the real test's Part 3 follows Part 2's theme). A cue card can have more than one linked set.
- Each item has draft/published status (reuse the `content/visibility.ts` pattern), optional tags or Subjects, and joins export/backup. How far it joins revisions and markdown import is the builder's call, as in piece 1.
- **AI in Admin**: a "Generate draft" button per type creates a draft from the AI, which the admin edits and publishes. Generated items are always drafts.
- **AI for the learner** **(decided: AI fills gaps; how is my call)**: when the user has used every published item of the type a drill or mock needs (least recently used across their own attempts), or none exist, the screen offers "Generate new questions" (one AI call, metered). Generated questions are saved on the attempt only, not added to the bank.
- **Question choice** **(my call)**: pick the published item this user has seen least recently, at random among ties. A mock uses one "about you" frame plus two topic frames for Part 1, one cue card for Part 2, and a set linked to that card for Part 3 (or AI-generated Part 3 if the card has none, or a general set when AI is off).

### 7. Speaking practice screens

**`/ielts/speaking`** hub: start a full mock, or drill one part (Part 1 frame, Part 2 card, Part 3 set). It also shows the last mock's bands and a link to history.

**Examiner** **(my call)**: each question shows on screen, and by default is also read aloud with the browser's `speechSynthesis` (an English voice; can be turned off and remembered). The user taps **Next question** when done answering, the way a real examiner moves on.

**Timing, matching the test** **(decided format; behaviour is my call)**:

- Part 1: soft timer 4–5 min. At 5 min the screen says "time to move on", but does not cut the user off mid-answer.
- Part 2: 1 min prep countdown with an on-screen notes box (the real test gives paper and pencil; the notes are saved on the attempt). Recording starts automatically when prep ends. A visible marker at 1 min ("keep going"), auto-stop at 2 min. Optional rounding-off question afterwards.
- Part 3: soft timer 4–5 min, as Part 1.
- Full mock: Part 1 → Part 2 → Part 3 with no stop in between except Part 2's prep. A "pause" exists for real interruptions but is marked on the attempt.

**Recording granularity** **(my call)**: **one recording per part** (continuous video makes gestures and confidence reviewable as a whole). Each "Next question" tap stores a timestamp marker, so the review screen can jump to a question and the AI gets the transcript split by question where the transcript has timestamps, or the whole part plus the question list where it doesn't (the builder checks what Cloudflare Whisper returns). Part caps: Part 1 and 3 at 7 min, Part 2 talk at 2.5 min; caps set the presign size, as in piece 1.

**Video**: on by default for mocks **(decided)**, off by default for drills **(my call)**, and any session can toggle it.

**Not losing a mock**: each part uploads when it ends, in the background while the next part runs. Blobs stay in memory until confirmed, retry uses `uploadTake`, and leaving with unsent parts shows a warning. An attempt whose later parts never arrive is kept as "incomplete" with whatever parts were stored; the user can review or delete it. If the page is suspended (phone lock), the current part stops cleanly and keeps what was recorded, as in piece 1.

### 8. Scoring and review

The review screen works for a drill or a whole mock. The order is fixed **(decided)**:

1. **Playback** per part with the transcript and the question markers.
2. **Self-rating** **(decided: first)**: a band for each of the four criteria in whole bands 1–9 (IELTS examiners score criteria in whole bands) **(my call)**, an optional note per criterion, and confidence/eye contact/gestures 1–5 when video, as in piece 1. The Speaking band is shown computed from the user's four criteria (mean, rounded to the nearest half band, same rule as the calculator).
3. **AI estimate** (one click once the self-rating is saved and transcripts are done; metered):
   - Input: per-part transcripts, the questions asked, Part 2 cue card, Part 2 duration (did they reach the 2 min mark), pause and filler markers if the transcript has them.
   - Output (JSON, validated like `parseSpeechFeedback`): a band and a 1–2 sentence reason for each criterion, with quoted evidence from the transcript; the overall Speaking estimate; 3 strengths; 3 "to reach the next band" items, each with a rewrite of one of the user's own sentences; and for drills, the same with the part noted.
   - **Pronunciation**: the band is still returned so the four criteria are complete, but it is shown greyed with "Estimated from the transcript only — the AI can't hear your accent or sounds. Your recording is kept so a later version can check pronunciation from audio." **(decided honesty; wording is my call)**. It is weighted out of the plan's weak-score trigger unless the user's own rating also flags it.
   - **Body language** on mocks with video and consent: reuse piece 1's frame flow on the Part 2 recording (the longest uninterrupted talk), with the same vision model and consent rules.
4. **Side by side**: the user's bands and the AI's bands, with differences ≥ 1.0 highlighted. The text says the AI is an estimate and the user's own judgement stands **(decided)**.

**What gets stored** **(my call)**: one **`IeltsSpeakingAttempt`** per drill or mock, holding userId, local date, kind (mock, part1, part2, part3), status (in progress, complete, incomplete), the questions used (copied, so admin edits don't change history), Part 2 notes, and per part: the shared media sub-schema, transcript, question markers. Plus self bands and note, AI estimate (bands, reasons, evidence, model, time), body feedback, and paused flag. Completed mocks write two `IeltsBandEntry` rows for Speaking (self, AI). Drills store bands on the attempt but **don't** write band history, because a one-part drill isn't a test-level score **(my call)**.

Users can delete an attempt (R2 objects + document + its band entries).

### 9. History and charts

- **`/ielts/history`**: a list of Speaking attempts (filter: mocks, drills, part), each opening its review; and band charts:
  - **Overall and per-skill bands over time** from band history, source shown by line style (official as points, practice as solid lines, Speaking AI estimate dashed), with the target as a horizontal line and the test date as a vertical line.
  - **Speaking criteria over time** (mocks only): four lines for self and four dashed lines for AI, as in the Speaking Practice trend chart.
  - **Study minutes per week** against the plan's weekly target, by skill.
- Model the list on `app/(app)/interview/history` / `progress/attempts.ts`, as piece 1 did.

### 10. Home and countdown

**`/ielts`** home, top to bottom **(the user's guess, accepted in chat; layout detail is my call)**:

1. Countdown: "N days to your test (date)", the current phase, and "week X of Y".
2. Pending plan suggestions (approve / dismiss / see preview).
3. Today's list, with ticks as items are done.
4. Hours check (only when short).
5. Latest bands: last Speaking mock (self and AI), latest overall from band history, and target.
6. Links: Speaking, plan, history, calculator, profile.

**`/ielts/plan`**: a phase timeline from today to test day, this week's targets by skill with progress bars, the coming weeks in brief, and the plan's version history.

**Dashboard card**: "IELTS: N days, today's items done x/y" beside the existing Speaking card, only for users with a profile.

### 11. Admin settings

**Admin → IELTS settings** (Settings group, `width="narrow"`) **(my call)**: hours per band (default 200, labelled a heuristic), phase split percentages, suggestion thresholds, Part 1/3 soft time and caps. Defaults in code; the singleton overrides them.

### 12. Data (shape, not schema)

- **IeltsProfile**: userId (unique), test date, target and current bands (overall, optional per skill), minutes per day, study weekdays, time zone used, created date, status (active/ended), voice and video preferences.
- **IeltsPlan**: userId, version, inputs snapshot, phases (name, start, end), weeks (start date, minutes per skill, planned mocks), reason, created at. The latest version is the live one.
- **IeltsPlanSuggestion**: userId, kind, reason, proposed inputs or plan diff, status, created and decided at.
- **IeltsStudyLog**: userId, local date, skill, minutes, source (manual). Recording minutes are computed from attempts and Speaking Practice takes, not copied here.
- **IeltsSpeakingAttempt**: as in section 8.
- **IeltsBandEntry**: userId, date, source, per-skill bands (any subset), overall (computed when all four are present), attemptId if any.
- **IeltsSpeakingItem** (or three models; builder's call): Part 1 frames, Part 2 cards, Part 3 sets with link to card, status, tags.
- **IeltsSettings**: singleton, section 11.

### 13. Routes (proposed)

`/ielts` (home or setup), `/ielts/profile`, `/ielts/plan`, `/ielts/calculator`, `/ielts/history`, `/ielts/speaking`, `/ielts/speaking/[attemptId]` (run), `/ielts/speaking/[attemptId]/review`. Admin: `/admin/ielts/speaking`, `/admin/ielts/settings`. All get `buildMetadata`; `(app)` stays `noindex`.

### 14. Config

No new env is required. It reuses R2, STT and OpenRouter. Without R2 the Speaking screens show "recording storage not configured"; profile, plan, calculator and history still work.

## Settled after the builder check

- **Approved suggestions survive rebuilds** **(my call)**: an approved suggestion that changes the plan without changing an input (shifting Speaking minutes to a criterion, spreading a shortfall) is stored as a **standing adjustment** on the plan. The generator is a pure function of (inputs, standing adjustments). When the user edits their profile, adjustments are re-applied; any that no longer fit (for example a shortfall spread when the test date moved) are dropped, and the before/after preview lists what was kept and what was dropped. The user can remove an adjustment from the plan page.
- **Current band updates are suggestions** **(my call)**: the profile's current band only changes when the user edits it or approves a suggestion. A new suggestion kind, **update current band**, is raised when an official result is entered, or when the last 2 Speaking mocks (lower of self and AI) differ from the profile's Speaking band by ≥ 0.5. Approving it rebuilds the plan and re-runs the hours check.
- **Deleting user data** **(my call)**: no app-wide delete-account flow exists today (`deleteAllTakes` has no caller; `components/ClearProgress.tsx` clears interview progress only). This piece adds **"Delete my IELTS data"** on the IELTS profile page (attempts, R2 objects under `ielts/<userId>/`, plan, suggestions, logs, band entries, profile) and an `deleteAllIeltsData(userId)` beside `deleteAllTakes`, so a later account-deletion flow can call both. Building that account-wide flow is out of scope.

## Left to the builder

- Exact schemas, the `recording/` adapter shape, component split, and file names.
- The band conversion table source (cite it in a comment).
- AI prompt wording and JSON schema (follow `speaking/coach.ts`).
- Whether Whisper timestamps allow per-question transcript splits.
- The exact weekly distribution maths, within the rules in section 3.
- How far IELTS Speaking items join revisions and markdown import (at minimum export/backup).
- Test approach: vitest + in-memory Mongo; mock R2, STT and OpenRouter; plan generation and the calculator as pure functions with unit tests.
