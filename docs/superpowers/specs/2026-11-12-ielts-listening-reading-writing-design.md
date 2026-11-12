# IELTS Listening, Reading and Writing — design

Date: 2026-11-12
Status: go-ahead given in chat ("go with your recommendation"); every choice below is **(my call)** and open to change.
Builds on: `2026-11-11-ielts-base-speaking-design.md` (pieces 3 and 4 of 4).

## Intent

The IELTS module plans and tracks all four skills but only Speaking has practice screens. Listening, Reading and Writing show "study outside the app and log minutes". This piece adds real practice for them, Academic only, so the plan, today list, band history and countdown run on real data for every skill.

## Goals

- **Reading**: passages with questions, timed (20 min per passage drill, 60 min full test), marked in code, raw score converted to a band with the existing table.
- **Listening**: four sections, audio plays once in a full test (replayable in a drill), same question types, marked in code, band from the existing table.
- **Writing**: Task 1 (describe a chart/graph/table/process from an image and short brief, 150+ words, 20 min) and Task 2 (essay, 250+ words, 40 min), a full test being both in 60 min. Learner rates themselves first on the four criteria, then asks for an AI estimate.
- Content authored in Admin; AI fills drafts (Reading passages, Listening scripts, Writing prompts).
- Results feed band history, the plan's done-minutes, today list, and the history page.

## Non-goals

- General Training. Official band tables (the existing approximations stay). Generated audio files (no TTS service; see Listening). Question types that need layout (diagram labelling, matching headings drag UI beyond a select). Human marking.

## Anti-goals

- An AI band shown before the learner's own rating, or without the word "estimate".
- Answer keys sent to the browser before submission. Marking happens on the server.
- A drill or part-test score written to band history as if it were a full-test band (only full tests write entries).
- Duplicating plumbing: ownership checks, AI metering, band history and admin conventions are reused.
- Losing an in-progress answer sheet or essay on refresh.

## Content model (shared)

A **question** has: `kind`, `prompt`, optional `options`, `answers` (accepted answers, server only), `explanation`.

Kinds: `mcq` (one correct option), `tfng` (True/False/Not Given), `ynng` (Yes/No/Not Given), `completion` (gap fill / short answer; case-insensitive, trims, collapses spaces, strips a trailing full stop, leading a/an/the optional), `matching` (choose from a shared lettered option list).

Questions belong to a **group** (instruction line, shared options), groups to a **section** (a Reading passage or a Listening part). Numbering is by order within the test.

**Models** (through `@/models`): `IeltsReadingTest`, `IeltsListeningTest`, `IeltsWritingPrompt` (task1|task2, brief, optional image key), `IeltsTestAttempt` (listening|reading; answers; frozen copy of the questions; score), `IeltsWritingAttempt` (tasks with text, self bands, AI estimate).

## Reading and Listening

- Hub lists published tests; start a full test or one section. Answer sheet with timer (drill: soft; full test: auto-submit at the limit). Answers autosave so a refresh resumes.
- Listening audio streams from R2 (presigned GET). In a full test: one play, no scrub. A section with no file falls back to browser `speechSynthesis` reading the script, labelled as a computer voice.
- Submit marks on the server; review shows raw score, band (full 40-question test only, "approximate"), per-question answer vs accepted answers, explanation, and the script for Listening.
- A submitted full 40-question test writes a `practice` band entry. Drills and part tests do not.

## Writing

- Run: prompt (Task 1 shows the image), text area with live word count and timer, draft autosave.
- Review order fixed: learner rates each task on four criteria (whole bands 1–9) first; then metered AI estimate (bands, reasons with quotes, 3 strengths, 3 improvements with a rewrite); then side by side with gaps ≥ 1.0 highlighted. Under-length essays are flagged to the model.
- Writing band: Task 1 weighs one third, Task 2 two thirds, rounded with the existing half-band rule. A full writing test writes self/AI Writing band entries; single-task drills do not.
- No key: everything works except the AI estimate.

## Plan integration

`dailyMinutes` adds test and writing time. `todayList` replaces the "log by hand" items for the three skills with practice links; the manual log stays for study done elsewhere. `deleteAllIeltsData` removes the new attempts. History page lists them.

## Admin

New Content sections **IELTS Reading & Listening** and **IELTS Writing**, per the admin conventions, registered in `admin/nav.ts`. Audio and Task 1 images upload through presigned PUT with a HEAD check, as Speaking lessons do. AI "Generate draft" always creates a draft.

## Constraints

Repo conventions per `CLAUDE.md`; Next.js 16 docs read first; env via `lib/env.ts`; `buildMetadata` per page; pure logic (marking, scoring, word count, writing band) in plain modules with unit tests; tests use in-memory Mongo with R2/AI mocked; no new env.
