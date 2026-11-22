# Exercise module (freehand workouts) — design

Date: 2026-11-22

## Intent

Add a separate **Exercise** module beside the study tracks. A user sets a weight goal (current weight, goal weight, months to get there), gets a freehand (bodyweight, no equipment) workout plan built by code + AI, follows each workout in a guided player with animated exercise pictures, and sees results: a weight chart against the goal line and completed-workout progress. Darebee (https://darebee.com/workout.html) is the reference for feel and filters (focus, difficulty, type), not for content.

Why: the user wants a goal-driven routine they can follow without thinking, inside the app they already use daily.

## Goals

- Separate module at `/exercise`, own nav entry, for **all approved users** (same access rules as other `(app)` pages).
- Goal setup: current weight, goal weight, months, plus height, age, sex, fitness level (beginner / intermediate / advanced), workout weekdays (picked), minutes per session.
- Plan: weekly schedule of workout and rest days, each workout a list of exercises with reps or seconds, sets, rest.
- Guided player (focus mode, picked from mockup A): one exercise fills the screen, big rep count or countdown, Back / Done set / Skip, progress bar; rest screen between sets with countdown, "up next" preview, +15s, Skip rest. Phone-first.
- Exercise pictures that animate (start/end frames alternating like a GIF).
- Results: log weight (any day), line chart of logged weight vs goal line, on-pace / behind-pace status, completed workouts this week, streak.
- Daily calorie target shown as **advice only** (Mifflin-St Jeor BMR × activity factor − deficit for the goal pace).
- AI coach note on the home screen and AI-chosen exercises/reps within code limits.

## Non-goals

- Food or calorie logging, meal plans.
- Gym equipment exercises (library is bodyweight only for now; schema keeps an `equipment` field so more can come later).
- Wearables, step counts, heart rate.
- Social features, sharing, leaderboards.
- Admin editing of the exercise library (library is code, see below).

## Anti-goals (would make this a failure even if it works)

- Plans that push unsafe pace: more than ~1 kg/week loss (or gain) must never be planned silently.
- Medical-sounding claims. Show a short "not medical advice; check with a doctor if you have health conditions" note at setup.
- Module breaking when no AI key is set or the daily AI limit is hit. It must still produce a full plan.
- Using darebee's (or any copyrighted) images or text.

## Constraints (from the codebase)

- Feature layout per CLAUDE.md: logic in `features/exercise/`, UI in `features/exercise/components/`, pages + Server Actions in `app/(app)/exercise/**`, models in `models/` (exported from the `@/models` barrel; models import nothing from `features/`). Tests mirror under `tests/exercise/`.
- Nav: add `{ href: "/exercise", label: "Exercise", icon: Dumbbell, track: "exercise" }` to `NAV_ITEMS` in `components/nav.ts`; add `"exercise"` to `TrackName` in `components/track`.
- AI: use `getAiConfig()` / `modelChain` from `features/ai/lib/aiSettings.ts`, `chatCompletion` + `extractJson` from `features/ai/lib/openrouter.ts`, and count calls against the existing daily per-user limit with `consumeAiCall` (`features/progress/quizAi.ts`, move to `features/ai/lib/` if a second feature needs it). Never pass `apiKey` to a page.
- Validate AI output with zod; anything invalid falls back to code.
- Env via `lib/env.ts` only. SEO via `buildMetadata` per page (under `(app)`, noindex anyway).
- Dates: store local dates as `YYYY-MM-DD` strings like IELTS (`localDate`/`addDays` from `features/speaking/schedule`).

## Approaches considered

1. **Code builds plan, AI only coaches.** Rule engine like `features/ielts/plan.ts`; AI writes notes only. Cheap, predictable, works offline; plan feels generic and isn't really "by AI".
2. **AI writes whole plan.** AI returns full plan JSON from profile + library. Feels personal; inconsistent, nothing when AI is off or limited, unsafe volume harder to catch.
3. **Hybrid — chosen.** Code builds the skeleton and enforces limits; AI fills each day with exercises and reps inside those limits; code validates and falls back to its own fill. Gets "plan by AI" while keeping safety in code and never breaking without a key.

User picked **3 (Hybrid)**.

## Design

### Exercise library (code)

`features/exercise/library.ts`: a typed, fixed list of ~50–70 bodyweight exercises, like coding problems are code. Each entry:

```ts
type Exercise = {
  id: string;               // "bodyweight-squat"
  name: string;
  focus: ("full" | "upper" | "lower" | "core" | "cardio")[];
  type: "strength" | "cardio" | "hiit" | "stretch";
  difficulty: 1 | 2 | 3;    // beginner / intermediate / advanced
  mode: "reps" | "time";
  equipment: "none";
  cues: string[];           // 1–3 short form tips
  frames: [string, string]; // image paths, start + end
};
```

Images come from **free-exercise-db** (github.com/yuhonas/free-exercise-db, public domain / Unlicense): pick the bodyweight subset, copy start/end JPGs into `public/exercise/<id>/0.jpg` and `1.jpg` (resized, small). Served statically. The player alternates the two frames every ~0.8s (CSS/JS), respecting `prefers-reduced-motion` (show frame 0 only). *My call:* static `public/` files instead of R2, because `lib/r2.ts` is presigned/private and these are small public assets.

### Goal and safety (code)

`features/exercise/goal.ts`, pure functions:
- `weeklyPace = (goal − current) / weeks`. If |pace| > 1 kg/week: block saving with a message and offer the nearest safe timeline (months rounded up). If > 0.75 kg/week: allow with a warning.
- Calorie advice: Mifflin-St Jeor BMR, activity factor from days/week, deficit/surplus = pace × 7700 kcal / 7, floor at 1,200 (female) / 1,500 (male) kcal. Shown as "≈ N kcal/day (advice)".
- Weight gain goals allowed with the same caps (plan leans strength).

### Plan skeleton (code)

`features/exercise/plan.ts`, pure, deterministic, tested:
- Input: profile (level, days/week, minutes/session, goal direction), start date, weeks.
- Output: weeks → days. Each workout day has `focus` (rotation: full / lower+core / upper / cardio-HIIT / full …), `minutes`, `difficultyMax` (from level, +1 allowed after week 4 if sessions keep being finished), `slots` count (minutes / ~3), sets, rest seconds. Rest days and one stretch day per week.
- Progression: volume +~10% per week, deload every 4th week.
- `fillDay(day, library)`: code's own exercise pick for a day (deterministic by seed = userId + date) so a plan exists with no AI.

### AI fill (hybrid)

`features/exercise/planAi.ts`:
- On plan create and once per week (on first visit of a new week), one AI call: send skeleton days for the week + allowed exercise ids (filtered by focus and difficulty) + profile summary + last week's results (finished/skipped sets, "too easy/too hard" taps). Ask for JSON: per day, list of `{ exerciseId, sets, reps | seconds }` + a one-paragraph coach note.
- Validate with zod and with code limits: ids must be in the allowed list, count within slots ±1, reps 5–30, seconds 15–60, sets 1–4, total time within day minutes +10%. Invalid day → that day uses `fillDay`. AI off / limit hit / error → whole week uses `fillDay` and a code-written note.
- Counts against the shared daily AI limit (`consumeAiCall`).

### Data (models)

- `ExerciseProfile` (one active per user, see calls): heightCm, birthYear, sex, level, workoutDays (weekday numbers 0–6), minutesPerSession, startWeightKg, goalWeightKg, startDate, targetDate, status active/ended.
- `ExercisePlanWeek`: userId, weekStart, days `[{ date, focus, minutes, items: [{ exerciseId, sets, reps?, seconds?, restSec }] }]`, source `ai | code`, coachNote. Unique (userId, weekStart). Weeks are created lazily (current + next), so a changed goal only rewrites future weeks.
- `WorkoutSession`: userId, date, weekStart, status in-progress/done/abandoned, per item `{ exerciseId, setsDone, skipped, feel?: easy|ok|hard }`, startedAt, finishedAt.
- `WeightEntry`: userId, date, kg. Unique (userId, date); logging again the same day overwrites.

### Screens

- `/exercise` home (mockup "Plan/home"): goal card (start → goal, target date, on pace / behind, calorie advice), weight chart (`components/charts`) + "Log weight", this week strip (7 days, today highlighted, Start button), AI coach note. No profile yet → setup.
- `/exercise/setup`: goal + body + schedule form with live pace check and the not-medical-advice note. Editing later regenerates future weeks.
- `/exercise/workout/[date]`: guided player (focus mode A): exercise picture (animated), name, big reps or countdown, "Set 2 of 3", one cue, Back / Done set / Skip, progress bar; rest screen with countdown, up next, +15s, Skip rest. After the last exercise: summary + "how did it feel" (easy/ok/hard) per exercise, saved to `WorkoutSession`. Progress is saved after each set so a reload resumes.
- `/exercise/library`: browse/filter exercises (focus, type, difficulty) with pictures and cues, like darebee's filter panel.
- Dashboard: small Exercise card (this week x/y workouts, last weight, pace, streak). Not part of Focus (see decisions).

### Pace status

On pace if latest weight (7-day average when ≥3 entries) is within 0.5 kg of the straight goal line for today; otherwise ahead / behind with the gap.

## Decided by the user

- Separate module, freehand exercises included.
- Inputs: current weight, goal weight, months.
- Plan made by AI ("hybrid: code + AI").
- Guided player, focus-mode layout A.
- Exercise only, no food logging.
- For all approved users.
- Darebee as look/feel reference.
- **Workout days:** user picks weekdays at setup (e.g. Mon/Wed/Fri; count = days per week). A missed workout is just marked missed, never shifted. Streak = scheduled workouts done in a row (rest days don't break it; a missed workout does).
- **Focus:** exercise stays out of Focus. No changes to `features/focus` or `FOCUS_AREAS`; no Focus button on exercise pages.

## My calls (correct if wrong)

- Extra setup inputs (height, age, sex, level, days, minutes) for calorie advice and plan sizing.
- 1 kg/week hard cap, 0.75 warning.
- Library in code; images from free-exercise-db in `public/exercise/`.
- Weekly AI fill rather than daily, to keep AI cost low for all users.
- Units: kg and cm only for v1.
- **Goal history:** `ExerciseProfile` is one *active* per user (partial unique index on `userId` where `status: "active"`), not one ever. Changing start/goal weight or target date ends the current profile and starts a new one (old weights and sessions stay, tagged with `profileId`); chart goal line starts at the new profile's start. Changing only schedule fields (days, minutes, level) edits in place and rewrites future weeks.
- **End of plan:** at the target date or when the 7-day average reaches the goal, no new weeks are made; home shows the result and offers "New goal" or "Keep fit" (keep-fit = new profile with goal = current weight, maintenance calories, same caps).
- **Library gaps:** builder first counts free-exercise-db bodyweight moves per focus/difficulty. A smaller library (≥30) is fine. Moves with no public-domain picture (likely cardio like high knees, burpees) get a simple neutral illustration placeholder plus cues; never borrowed images.
- **Sex options:** male / female / prefer not to say. "Prefer not to say" uses the average of both Mifflin-St Jeor constants and the 1,500 kcal floor.
- **Track colour:** add a seventh `--t-6` token in light and dark themes for Exercise.

## Left to the builder

- Exact exercise list (≈50–70 bodyweight moves covering all focus/difficulty combos) and image resizing.
- Focus rotation table and per-level sets/reps defaults.
- Prompt wording; chart styling; animation timing.
- Whether to move `consumeAiCall` into `features/ai/lib/`.
