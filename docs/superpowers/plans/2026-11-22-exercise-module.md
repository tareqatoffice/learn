# Exercise Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/exercise` module where approved users set a weight goal, get a weekly bodyweight workout plan (code skeleton + AI fill), follow it in a focus-mode guided player, and track weight against a goal line.

**Architecture:** Pure logic (`goal.ts`, `plan.ts`, `library.ts`) is deterministic and unit-tested. `planAi.ts` asks OpenRouter to fill a week inside code limits and falls back to `fillDay`. Services (`profile.ts`, `weeks.ts`, `weights.ts`, `sessions.ts`) own Mongo access; pages in `app/(app)/exercise/**` call Server Actions in `actions.ts`. UI in `features/exercise/components/`.

**Tech Stack:** Next.js 16 App Router, Mongoose, zod, Vitest (+ jsdom for component tests), Tailwind 4, existing `components/charts/LineChart`.

**Spec:** `docs/superpowers/specs/2026-11-22-exercise-module-design.md`

## Global Constraints

- Follow CLAUDE.md layering: logic in `features/exercise/`, UI in `features/exercise/components/`, pages + `actions.ts` in `app/(app)/exercise/`, models in `models/` exported from `@/models`; models never import `features/`. Tests under `tests/exercise/` (component tests in `tests/components/exercise/`).
- Read `node_modules/next/dist/docs/` before writing page/route code (Next 16 breaking changes).
- Dates are local `YYYY-MM-DD` strings; use `localDate`, `addDays` from `@/features/speaking/schedule` and `readTimeZone` from `@/features/speaking/timezone`. Week starts Monday.
- Units: kg and cm only.
- Pace caps: |pace| > 1 kg/week blocks save; > 0.75 kg/week warns.
- Calorie floor: 1,200 kcal female, 1,500 kcal male and "prefer not to say".
- AI limits on any filled item: exercise id in allowed list, sets 1–4, reps 5–30, seconds 15–60, items per day within slots ±1, day total time ≤ day minutes × 1.1.
- AI goes through `getAiConfig()` + `modelChain` + `chatCompletion` + `extractJson` and `metered(userId, settings, call)` from `@/features/progress/quizAi`. Never send `apiKey` to a page. AI off or failing never blocks a plan.
- Setup shows: "This is not medical advice. If you have a health condition or injury, check with a doctor before starting."
- No darebee or other copyrighted images/text. Images only from free-exercise-db (Unlicense) or a neutral placeholder.
- Exercise is not part of Focus: no changes to `features/focus` or `models/focusConstants.ts`.
- Every page uses `buildMetadata({ title, description, path })`.

## Review Focus

1. **Day boundary across time zones** — "today" (week strip, workout page, weight log) must use the user's time zone, not UTC. Test in Task 6: `ensureWeeks` with a 23:30 UTC time in UTC+6 uses the local date's week.
2. **Reload mid-workout** — reopening `/exercise/workout/[date]` resumes at the first unfinished set, not from the start. Tests in Task 6 (`resumePoint`) and Task 8 (player starts at given index).
3. **AI returns junk** — unknown ids, strings for numbers, missing days, prose around JSON: only the bad days fall back, and the week still has every workout day. Test in Task 5.
4. **Pace with no or few weights** — no entries uses start weight; under 3 entries in 7 days uses the latest; status never throws. Test in Task 2.
5. **Bad weight input** — 0, negative, > 400 kg, NaN, or a future date is rejected with a form message; a same-day log overwrites. Test in Task 6.

---

### Task 1: Models, barrel, backup and user deletion

**Files:**
- Create: `models/exerciseConstants.ts`, `models/exerciseProfile.ts`, `models/exercisePlanWeek.ts`, `models/workoutSession.ts`, `models/weightEntry.ts`
- Create: `features/exercise/data.ts`
- Modify: `models/index.ts` (export the four models), `features/content/backup.ts` (add collections next to `ieltsprofiles`), `features/admin/users.ts` (call `deleteAllExerciseData(id)` beside `deleteAllIeltsData`)
- Test: `tests/exercise/data.test.ts`

**Interfaces:**
- Produces (`models/exerciseConstants.ts`): `SEXES = ["male","female","unspecified"] as const`, `LEVELS = ["beginner","intermediate","advanced"] as const`, `FOCUSES = ["full","upper","lower","core","cardio","stretch"] as const`, `FEELS = ["easy","ok","hard"] as const`, types `Sex`, `Level`, `Focus`, `Feel`.
- Produces models:
  - `ExerciseProfile`: `userId` ObjectId, `status` `"active"|"ended"` (default active), `heightCm`, `birthYear`, `sex`, `level`, `workoutDays: number[]` (0–6), `minutesPerSession`, `startWeightKg`, `goalWeightKg`, `startDate`, `targetDate` (strings), `endedReason?: "replaced"|"finished"`, timestamps. Partial unique index `{ userId: 1 }` with `partialFilterExpression: { status: "active" }`.
  - `ExercisePlanWeek`: `userId`, `profileId`, `weekStart`, `days: [{ date, focus, minutes, items: [{ exerciseId, sets, reps?, seconds?, restSec }] }]`, `source: "ai"|"code"`, `coachNote`. Unique `{ profileId: 1, weekStart: 1 }`.
  - `WorkoutSession`: `userId`, `profileId`, `date`, `status: "inProgress"|"done"|"abandoned"`, `items: [{ exerciseId, setsDone, skipped, feel? }]`, `startedAt`, `finishedAt?`. Unique `{ userId: 1, date: 1 }`.
  - `WeightEntry`: `userId`, `profileId`, `date`, `kg`. Unique `{ userId: 1, date: 1 }`.
- Produces: `deleteAllExerciseData(userId: string): Promise<void>` in `features/exercise/data.ts`.

- [ ] **Step 1: Write failing tests** `tests/exercise/data.test.ts` (pattern: `tests/ielts/profile.test.ts`, `connectDb` / `resetDb` / `mongoose.disconnect`):
  - `"allows one active profile per user but many ended"`: two `ended` + one `active` for one user succeed; a second `active` rejects with code 11000.
  - `"deleteAllExerciseData removes only that user's rows"`: one row per collection for users A and B; after deleting A, A has 0 everywhere, B has 1 in each.
- [ ] **Step 2: Run** `npx vitest run tests/exercise/data.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** models, barrel exports, `deleteAllExerciseData`, backup entries (`exerciseprofiles`, `exerciseplanweeks`, `workoutsessions`, `weightentries`), user-delete call.
- [ ] **Step 4: Run** `npx vitest run tests/exercise/data.test.ts tests/content tests/admin` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): add exercise models and data cleanup`

### Task 2: Goal maths (pure)

**Files:**
- Create: `features/exercise/goal.ts`
- Test: `tests/exercise/goal.test.ts`

**Interfaces:**
- Produces:
  - `weeksBetween(start: string, end: string): number` (days / 7, not rounded)
  - `weeklyPace(startKg: number, goalKg: number, weeks: number): number` (signed kg/week; 0 when weeks ≤ 0)
  - `paceCheck(pace: number): "ok"|"warn"|"block"` (by absolute value: > 1 block, > 0.75 warn)
  - `addMonths(date: string, months: number): string`
  - `safeTargetDate(start: string, startKg: number, goalKg: number): string` (earliest `addMonths(start, m)` with |pace| ≤ 1)
  - `ageFrom(birthYear: number, today: string): number`
  - `bmr(p: { kg: number; heightCm: number; age: number; sex: Sex }): number` — `10kg + 6.25cm − 5age + s`, s = +5 male, −161 female, −78 unspecified.
  - `activityFactor(daysPerWeek: number): number` — 0–1: 1.2, 2–3: 1.375, 4–5: 1.55, 6–7: 1.725.
  - `calorieAdvice(p: { kg: number; heightCm: number; age: number; sex: Sex; daysPerWeek: number; pace: number }): number` — `bmr × factor + pace × 7700 / 7`, rounded to nearest 50, floored at 1,200 female / 1,500 otherwise.
  - `type GoalShape = { startDate: string; targetDate: string; startWeightKg: number; goalWeightKg: number }`
  - `goalLine(g: GoalShape, date: string): number` (linear, clamped at both ends)
  - `paceStatus(g: GoalShape, weights: { date: string; kg: number }[], today: string): { status: "onPace"|"ahead"|"behind"; currentKg: number; gapKg: number }` — currentKg = mean of entries in the last 7 days when ≥ 3, else latest entry, else start weight. On pace when |current − line| ≤ 0.5; "ahead" = nearer the goal than the line. `gapKg` rounded to 0.1.
  - `goalReached(g: GoalShape, currentKg: number): boolean` (crossed goal in goal direction; false when start = goal)

- [ ] **Step 1: Write failing tests**, including:
  - `paceCheck(-0.8) === "warn"`, `paceCheck(1.2) === "block"`, `paceCheck(0.5) === "ok"`.
  - `bmr({kg:80,heightCm:180,age:30,sex:"male"}) === 1780`; female same inputs `=== 1614`.
  - `calorieAdvice({kg:80,heightCm:180,age:30,sex:"male",daysPerWeek:3,pace:-0.5}) === 1900`.
  - `calorieAdvice({kg:50,heightCm:155,age:40,sex:"female",daysPerWeek:6,pace:-1}) === 1200` (floor).
  - `safeTargetDate("2026-11-22", 90, 80) === "2027-02-22"`.
  - `paceStatus`: no weights → `currentKg === startWeightKg`; 2 entries → latest; 3 entries in 7 days → mean.
  - Loss goal with line at 85: current 85.3 → `onPace`; 84 → `ahead`; 86 → `behind`, `gapKg === 1`.
- [ ] **Step 2: Run** `npx vitest run tests/exercise/goal.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `features/exercise/goal.ts`.
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): add goal pace and calorie advice`

### Task 3: Exercise library and images

**Files:**
- Create: `features/exercise/library.ts`, `scripts/exercise-images.ts`, `public/exercise/<id>/0.jpg`, `1.jpg`, `public/exercise/placeholder.svg`, `public/exercise/README.md`
- Modify: `package.json` (script `"exercise:images": "tsx scripts/exercise-images.ts"`)
- Test: `tests/exercise/library.test.ts`

**Interfaces:**
- Produces: `type Exercise = { id: string; name: string; focus: Focus[]; type: "strength"|"cardio"|"hiit"|"stretch"; difficulty: 1|2|3; mode: "reps"|"time"; equipment: "none"; cues: string[]; frames: [string, string] | null }` (`null` → `/exercise/placeholder.svg`).
- Produces: `EXERCISES: readonly Exercise[]`, `exerciseById(id: string): Exercise | undefined`, `allowedFor(focus: Focus, maxDifficulty: 1|2|3): Exercise[]`, `exerciseImage(e: Exercise, frame: 0|1): string`.

- [ ] **Step 1: Write failing tests:** `"ids are unique kebab-case"`; `"every exercise has 1–3 cues and equipment none"`; `"each focus has at least 3 exercises at difficulty 1"`; `"at least 30 exercises total"`; `"every frames path exists under public/"`.
- [ ] **Step 2: Run** `npx vitest run tests/exercise/library.test.ts` — Expected: FAIL.
- [ ] **Step 3: Write `scripts/exercise-images.ts`:** takes the path of a local clone of `yuhonas/free-exercise-db`, reads its exercises JSON, keeps entries with equipment `"body only"` or none, copies start/end images for a chosen id list to `public/exercise/<id>/0.jpg|1.jpg` (resize to ≤ 480 px wide only if `sharp` is already installed), prints a count per focus. Run it once; commit images, not the clone. README states source + Unlicense.
- [ ] **Step 4: Fill `EXERCISES`** (30–70 moves). Moves with no public-domain photo get `frames: null`. Cues in your own words.
- [ ] **Step 5: Run** test — Expected: PASS.
- [ ] **Step 6: Commit** `feat(exercise): add bodyweight exercise library and images`

### Task 4: Plan skeleton and code fill (pure)

**Files:**
- Create: `features/exercise/plan.ts`
- Test: `tests/exercise/plan.test.ts`

**Interfaces:**
- Consumes: `allowedFor`, `exerciseById` (Task 3); `Level`, `Focus` (Task 1).
- Produces:
  - `type PlanItem = { exerciseId: string; sets: number; reps?: number; seconds?: number; restSec: number }`
  - `type SkeletonDay = { date: string; focus: Focus; minutes: number; maxDifficulty: 1|2|3; slots: number; sets: number; restSec: number; reps: number; seconds: number }`
  - `type PlanDay = { date: string; focus: Focus; minutes: number; items: PlanItem[] }`
  - `type SkeletonInput = { level: Level; workoutDays: number[]; minutesPerSession: number; startDate: string; targetDate: string; direction: "lose"|"gain"|"keep" }`
  - `weekStartOf(date: string): string` (Monday)
  - `weekIndex(startDate: string, weekStart: string): number` (0-based from `weekStartOf(startDate)`)
  - `skeletonWeek(p: SkeletonInput, weekStart: string, history: { finishedRatio: number }): SkeletonDay[]` — only dates in `[startDate, targetDate]` whose weekday is in `workoutDays`. Focus rotation over the week's workout days in order: `full, lower, upper, cardio, core, full`; if ≥ 3 workout days the last is `stretch`. `"gain"` swaps `cardio` for `full`. Level defaults: beginner sets 2 / rest 45 / maxDifficulty 1; intermediate 3 / 35 / 2; advanced 3 / 25 / 3. `maxDifficulty + 1` (cap 3) when week index ≥ 4 and `finishedRatio ≥ 0.8`. Week index 3, 7, 11… is deload: sets − 1 (min 1) and week-0 volume. `slots = max(3, floor(minutes / 3))`. `reps`/`seconds` from `baseVolume`.
  - `baseVolume(level: Level, weekIdx: number): { reps: number; seconds: number }` — beginner 8 / 20, intermediate 12 / 30, advanced 15 / 40; × 1.1 per week compounding, rounded, clamped to reps 5–30 / seconds 15–60.
  - `fillDay(day: SkeletonDay, seed: string): PlanDay` — `day.slots` picks from `allowedFor(day.focus, day.maxDifficulty)` via seeded shuffle (string hash of `seed`), cycling if too few; reps or seconds by exercise `mode`; then drops items from the end until `validateDay` passes.
  - `itemSeconds(i: PlanItem): number` = `sets × (seconds ?? reps × 3) + (sets − 1) × restSec`
  - `validateDay(day: SkeletonDay, items: unknown): PlanItem[] | null` — zod shape + every AI limit in Global Constraints; null when invalid.

- [ ] **Step 1: Write failing tests:**
  - `workoutDays [1,3,5]` beginner → 3 days, focus `full, lower, stretch`, sets 2.
  - Week index 3 → sets 1 (beginner); week index 4 with `finishedRatio 0.9` → maxDifficulty 2.
  - Days after `targetDate` are left out; a week fully after it → `[]`.
  - `fillDay` same seed → equal output; other seed → different; output passes `validateDay`.
  - `validateDay` → null for unknown id, `reps: 40`, `sets: 0`, `slots + 2` items, total over `minutes × 60 × 1.1`; returns items for a valid list.
- [ ] **Step 2: Run** `npx vitest run tests/exercise/plan.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `features/exercise/plan.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): add plan skeleton and code fill`

### Task 5: AI week fill with fallback

**Files:**
- Create: `features/exercise/planAi.ts`
- Test: `tests/exercise/planAi.test.ts`

**Interfaces:**
- Consumes: `SkeletonDay`, `PlanDay`, `fillDay`, `validateDay` (Task 4); `allowedFor` (Task 3); `getAiConfig`, `modelChain` (`@/features/ai/lib/aiSettings`); `chatCompletion`, `extractJson` (`@/features/ai/lib/openrouter`); `metered` (`@/features/progress/quizAi`).
- Produces: `fillWeek(input: { userId: string; skeleton: SkeletonDay[]; weekIdx: number; profileSummary: string; lastWeek: { exerciseId: string; setsDone: number; skipped: boolean; feel?: Feel }[]; fetch?: typeof fetch }): Promise<{ days: PlanDay[]; source: "ai"|"code"; coachNote: string }>`
- Produces: `codeNote(p: { weekIdx: number; deload: boolean; workouts: number }): string` (e.g. "Week 4: lighter week to recover. 3 workouts.")

Behaviour: empty skeleton → `{ days: [], source: "code", coachNote: codeNote(...) }` with no call. `settings.active` false → all `fillDay(day, userId + day.date)`, `source "code"`. Otherwise one `metered` call with `jsonSchema` for `{ days: [{ date, items }], coachNote }`, `maxTokens` 1500, `temperature` 0.4; prompt lists each skeleton day (date, focus, minutes, slots, sets, restSec, reps, seconds) with its allowed ids (id, name, mode) and last week's results. Each returned day goes through `validateDay`; invalid or missing days use `fillDay`. `source "ai"` if ≥ 1 day came from AI. Coach note trimmed to 600 chars (empty → `codeNote`). Any error, including the daily-limit `AiError`, → full code fallback; never throws.

- [ ] **Step 1: Write failing tests** (stub `fetch`; seed AI settings the way `tests/progress` quiz-AI tests do):
  - `"uses code fill when AI is off"` → `source "code"`, `days.length === skeleton.length`.
  - `"keeps valid AI days and replaces invalid ones"` → day 1 = AI items, day 2 (unknown id) = `fillDay` output, `source "ai"`.
  - `"falls back when the reply is not JSON"`; `"falls back when fetch rejects"`.
  - `"falls back when the daily limit is used up"` (`dailyLimit 1`, one call consumed first).
- [ ] **Step 2: Run** `npx vitest run tests/exercise/planAi.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `features/exercise/planAi.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): fill weekly plan with AI inside code limits`

### Task 6: Services — profile, weeks, weights, sessions, streak

**Files:**
- Create: `features/exercise/profile.ts`, `features/exercise/weeks.ts`, `features/exercise/weights.ts`, `features/exercise/sessions.ts`
- Test: `tests/exercise/profile.test.ts`, `tests/exercise/weeks.test.ts`, `tests/exercise/weights.test.ts`, `tests/exercise/sessions.test.ts`

**Interfaces:**
- Consumes: models (Task 1), goal (Task 2), plan (Task 4), `fillWeek` (Task 5), `ActionResult`/`ok`/`fail` (`@/features/admin/result`), `inTransaction`, `retryOnDuplicateKey` (`@/lib/db`).
- Produces (`profile.ts`):
  - `type ProfileInput = { heightCm: number; birthYear: number; sex: Sex; level: Level; workoutDays: number[]; minutesPerSession: number; startWeightKg: number; goalWeightKg: number; months: number }`
  - `type ProfileView = GoalShape & { id: string; heightCm; birthYear; sex; level; workoutDays; minutesPerSession; status }`
  - `previewGoal(input: ProfileInput, today: string): { targetDate: string; pace: number; check: "ok"|"warn"|"block"; safeTargetDate?: string; kcal: number }`
  - `saveProfile(userId: string, input: ProfileInput, today: string): Promise<ActionResult<ProfileView>>` — validates height 120–230, age 16–90, weights 30–300, months 1–24, `workoutDays` 1–7 unique ints 0–6, minutes 10–60 (`fail({ field: msg })`). Block → `fail({ months: "That's faster than 1 kg a week. The earliest safe date is <date>." })`. No active profile → create (`startDate = today`, `targetDate = addMonths(today, months)`). Active and start/goal weight or months changed → in `inTransaction`, end it (`endedReason "replaced"`) and create new. Only schedule fields changed → update in place, delete its plan weeks with `weekStart > weekStartOf(today)`.
  - `getActiveProfile(userId: string): Promise<ProfileView | null>`
  - `lastEndedProfile(userId: string): Promise<ProfileView | null>`
  - `finishIfDone(userId: string, today: string): Promise<{ finished: boolean; reason?: "target"|"goal" }>` — ends active profile (`endedReason "finished"`) when `today > targetDate` or `goalReached(paceStatus(...).currentKg)`.
  - `startKeepFit(userId: string, today: string): Promise<ActionResult<ProfileView>>` — new profile from `lastEndedProfile` with start = goal = its current kg, months 3.
- Produces (`weeks.ts`):
  - `type PlanWeekView = { weekStart: string; days: PlanDay[]; source: "ai"|"code"; coachNote: string }`
  - `ensureWeeks(userId: string, today: string): Promise<{ current: PlanWeekView | null; next: PlanWeekView | null }>` — for the active profile, creates current and next week if missing (unique index + `retryOnDuplicateKey`); `finishedRatio` and `lastWeek` from the previous week's `WorkoutSession`s. No active profile → both null.
  - `dayPlan(userId: string, date: string): Promise<PlanDay | null>`
- Produces (`weights.ts`): `logWeight(userId: string, date: string, kg: number, today: string): Promise<ActionResult<{ date: string; kg: number }>>` (reject non-finite, ≤ 0, > 400, `date > today`; upsert by (userId, date), set `profileId` to active); `listWeights(userId: string, profileId: string): Promise<{ date: string; kg: number }[]>` (date asc); `deleteWeight(userId: string, date: string): Promise<ActionResult<null>>`.
- Produces (`sessions.ts`):
  - `type SessionView = { date: string; status: "inProgress"|"done"|"abandoned"; items: { exerciseId: string; setsDone: number; skipped: boolean; feel?: Feel }[] }`
  - `startSession(userId: string, date: string): Promise<SessionView | null>` (idempotent; items from `dayPlan`; null if no plan that day)
  - `saveSet(userId: string, date: string, index: number, action: "done"|"skip"|"back"): Promise<SessionView>` (done: `setsDone + 1` capped at sets; skip: `skipped true`; back: `setsDone − 1` min 0, `skipped false`)
  - `finishSession(userId: string, date: string, feels: Record<string, Feel>): Promise<SessionView>`
  - `resumePoint(s: SessionView, plan: PlanDay): { item: number; set: number } | null` (first item not skipped with `setsDone < sets`; null when none)
  - `weekSummary(userId: string, weekStart: string): Promise<{ done: number; planned: number }>`
  - `streak(userId: string, today: string): Promise<number>` — walk scheduled workout dates from plan weeks backwards from today: today done +1, today not done skipped; each earlier scheduled date with a `done` session +1; stop at the first earlier one without.

- [ ] **Step 1: Write failing tests** (DB tests; AI off):
  - profile: `"blocks a goal faster than 1 kg/week and suggests a safe date"`; `"warns but saves at 0.8 kg/week"`; `"changing goal weight ends the old profile and keeps its weights"`; `"changing only workoutDays keeps the profile id and rewrites future weeks only"`; `"finishIfDone ends the profile after targetDate"`.
  - weeks: `"ensureWeeks creates current and next week once"` (two calls → 2 docs); `"uses the local date in UTC+6"` (`localDate(new Date("2026-11-22T23:30:00Z"), "Asia/Dhaka") === "2026-11-23"` → current `weekStart "2026-11-23"`); `"no weeks after the profile ends"`.
  - weights: rejects `0`, `-1`, `401`, `NaN`, tomorrow; `"logging twice on one day overwrites"`.
  - sessions: `"resumes at the first unfinished set after reload"` (2 sets done of 3 → `{ item: 0, set: 2 }`); `"streak counts done workouts in a row; rest days don't break it; a missed one does"`; `"today not done yet does not break the streak"`.
- [ ] **Step 2: Run** `npx vitest run tests/exercise` — Expected: new files FAIL.
- [ ] **Step 3: Implement** the four service files.
- [ ] **Step 4: Run** `npx vitest run tests/exercise` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): add profile, weekly plan, weight and session services`

### Task 7: Nav, track colour, setup page and home page

**Files:**
- Modify: `components/track.ts` (`exercise: 6`), `app/globals.css` (`--color-track-6: var(--t-6)` and `--t-6` in the light block and both dark blocks beside `--t-5`; a teal with contrast like the others), `components/nav.ts` (`{ href: "/exercise", label: "Exercise", icon: Dumbbell, track: "exercise" }` after Coding)
- Create: `app/(app)/exercise/page.tsx`, `app/(app)/exercise/setup/page.tsx`, `app/(app)/exercise/actions.ts`, `app/(app)/exercise/loading.tsx`
- Create: `features/exercise/components/ExerciseHome.tsx`, `SetupForm.tsx`, `GoalCard.tsx`, `WeightPanel.tsx`, `WeekStrip.tsx`, `CoachNote.tsx`, `PlanFinished.tsx`
- Test: `tests/components/exercise/SetupForm.test.tsx`, `tests/components/exercise/WeekStrip.test.tsx`, `tests/exercise/actions.test.ts`

**Interfaces:**
- Consumes: Task 6 services; `paceStatus`, `calorieAdvice`, `goalLine` (Task 2); `LineChart` (`points`, `series: LineSeries<P>[]`, `yDomain`, `xLabel`, `refLines`, `ariaLabel`; see `features/ielts/components/BandCharts.tsx`).
- Produces (`actions.ts`, `"use server"`, each starts with `requireUser()` + `connectDb()`, today from `localDate(new Date(), await readTimeZone())`, like `app/(app)/ielts/actions.ts`): `previewGoalAction(input: ProfileInput)`, `saveProfileAction(input: ProfileInput)`, `logWeightAction(date: string, kg: number)`, `deleteWeightAction(date: string)`, `startKeepFitAction()`, `startSessionAction(date: string)`, `saveSetAction(date: string, index: number, action: "done"|"skip"|"back")`, `finishSessionAction(date: string, feels: Record<string, Feel>)`.
- Home: no active profile and no ended one → redirect `/exercise/setup`. Calls `finishIfDone` then `ensureWeeks`. Just finished / no active but an ended one → `PlanFinished` (result, "New goal" → setup, "Keep fit" → `startKeepFitAction`). Otherwise `GoalCard` (start → goal, target date, "On pace" / "Ahead by X kg" / "Behind by X kg", "≈ N kcal/day (advice)"), `WeightPanel` (LineChart of weights + goal-line series, log input defaulting to today), `WeekStrip` (Mon–Sun; workout days show focus + minutes; done ✓; past without done = "Missed"; today highlighted with Start link `/exercise/workout/<date>`), `CoachNote`, streak count.
- Setup form: all `ProfileInput` fields, weekday toggles Mon–Sun, debounced `previewGoalAction` showing target date, pace, warn/block text with safe date, kcal; Save disabled on block; disclaimer verbatim from Global Constraints; prefilled when editing.

- [ ] **Step 1: Write failing tests:**
  - `SetupForm`: `"shows the block message and disables save above 1 kg/week"`; `"renders the medical disclaimer"`.
  - `WeekStrip`: `"highlights today and links Start to /exercise/workout/<date>"`; `"marks a past workout without a session as missed"`.
  - `actions.test.ts`: `"saveProfileAction works for an approved user and rejects a pending one"` (mock session like `tests/setup/session.ts` `approvedSession`).
- [ ] **Step 2: Run** `npx vitest run tests/components/exercise tests/exercise/actions.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** track/colour/nav, pages (`buildMetadata` paths `/exercise`, `/exercise/setup`), actions, components.
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`, `npm run lint` — Expected: PASS (existing nav test confirms `/exercise` has a page).
- [ ] **Step 5: Check in browser** (`npm run dev`, dev login): setup → home week strip, weight log updates chart, light + dark, 375 px width.
- [ ] **Step 6: Commit** `feat(exercise): add setup and home pages with nav entry`

### Task 8: Guided player (focus mode)

**Files:**
- Create: `app/(app)/exercise/workout/[date]/page.tsx`
- Create: `features/exercise/components/WorkoutPlayer.tsx`, `ExerciseFrames.tsx`, `RestScreen.tsx`, `WorkoutSummary.tsx`, `features/exercise/lib/usePlayer.ts`
- Test: `tests/components/exercise/WorkoutPlayer.test.tsx`, `tests/exercise/usePlayer.test.ts`

**Interfaces:**
- Consumes: `dayPlan`, `startSession`, `resumePoint` (Task 6); `saveSetAction`, `finishSessionAction` (Task 7); `exerciseById`, `exerciseImage` (Task 3).
- Produces: `type PlayerState = { phase: "work"|"rest"|"summary"; item: number; set: number; remaining: number }`, `type PlayerEvent = { type: "done"|"skip"|"back"|"tick"|"skipRest" } | { type: "addRest"; sec: number }`, `playerReducer(plan: PlanDay, s: PlayerState, e: PlayerEvent): PlayerState`, `usePlayer(plan: PlanDay, start: { item: number; set: number }): PlayerState & { dispatch(e: PlayerEvent): void }` (1 s interval while `rest`, or `work` on a timed item; timed work reaching 0 acts as `done`).
- `ExerciseFrames({ exercise, size })`: swaps frame 0/1 every 800 ms; `prefers-reduced-motion` → frame 0 only; `frames null` → placeholder.
- Page: `date` is not a planned workout day or is after today → message "No workout planned for this day." + link home. Otherwise `startSession`; done → `WorkoutSummary` read-only; else `WorkoutPlayer` at `resumePoint`.
- Player UI (mockup A): header "<Focus> · n of N", frames, name, big "15 reps" or "0:30", "Set 2 of 3", first cue, Back / Done set / Skip, progress bar. `RestScreen`: "Rest", countdown, "Up next: <name> · <reps or seconds>", small frames, "+15s", "Skip rest". Each done/skip/back calls `saveSetAction` (retry once on failure, no blocking). After the last set → `WorkoutSummary` with easy/ok/hard per exercise → `finishSessionAction` → link home. Request `navigator.wakeLock?.request("screen")` while playing; ignore if unsupported.

- [ ] **Step 1: Write failing tests:**
  - `playerReducer`: done on set 1 of 3 → `rest`; `tick` to 0 in rest → `work` set 2; done on last set of last item → `summary`; `back` at set 0 of item 2 → item 1 last set; `addRest 15` adds 15.
  - `WorkoutPlayer` (jsdom, fake timers): `"starts at the resume point"` (start `{item:1,set:1}` → item 2 name, "Set 2 of 3"); `"timed item counts down and moves to rest at 0"`; `"shows the placeholder when frames are null"`; `"calls saveSetAction on Done set"`.
- [ ] **Step 2: Run** `npx vitest run tests/components/exercise/WorkoutPlayer.test.tsx tests/exercise/usePlayer.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** reducer/hook, components, page (`generateMetadata` → `buildMetadata` path `/exercise/workout/${date}`).
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`, `npm run lint` — Expected: PASS.
- [ ] **Step 5: Check in browser** at 375 px: full workout, reload mid-workout resumes, +15s / Skip rest, summary saves, home shows ✓ and streak.
- [ ] **Step 6: Commit** `feat(exercise): add guided workout player`

### Task 9: Exercise library page

**Files:**
- Create: `app/(app)/exercise/library/page.tsx`, `features/exercise/components/LibraryBrowser.tsx`
- Modify: `features/exercise/components/ExerciseHome.tsx` (link "Exercise library")
- Test: `tests/components/exercise/LibraryBrowser.test.tsx`

**Interfaces:**
- Consumes: `EXERCISES` (Task 3); `ExerciseFrames` (Task 8); `Chip` (`components/Chip`).
- Behaviour: client filters focus (multi), type, difficulty (Easy/Normal/Hard = 1/2/3), name search (case-insensitive); filter state in URL search params; "Clear filters"; empty → "No exercises match these filters."; cards: frames, name, focus chips, cues.

- [ ] **Step 1: Write failing tests:** `"filters by focus and difficulty"`; `"search matches name case-insensitively"`; `"shows the empty message when nothing matches"`.
- [ ] **Step 2: Run** `npx vitest run tests/components/exercise/LibraryBrowser.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** page (`buildMetadata` path `/exercise/library`) and component.
- [ ] **Step 4: Run** test and `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercise): add exercise library page`

### Task 10: Dashboard card

**Files:**
- Modify: `features/progress/dashboard.ts` (add `exercise?: { done: number; planned: number; lastKg?: number; status: "onPace"|"ahead"|"behind"; gapKg: number; streak: number }` to `Dashboard`; `exerciseCard(userId, timeZone, now)` in the `Promise.all`, spread like `ielts`), `features/dashboard/components/Dashboard.tsx` (`<Panel title="Exercise" track="exercise">` linking `/exercise`; count it in `nothingToDo`)
- Test: `tests/progress/dashboard.test.ts` (extend)

**Interfaces:**
- Consumes: `getActiveProfile`, `listWeights`, `weekSummary`, `streak` (Task 6); `paceStatus` (Task 2); `weekStartOf` (Task 4).

- [ ] **Step 1: Write failing tests:** `"omits exercise when there is no active profile"`; `"reports this week's done/planned, last weight and streak"`.
- [ ] **Step 2: Run** `npx vitest run tests/progress/dashboard.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** card data and panel text, e.g. "2 of 3 workouts this week · 81.4 kg · On pace · 4 in a row".
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(exercise): show exercise progress on dashboard`
