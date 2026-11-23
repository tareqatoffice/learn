import { getAppSettings } from "@/lib/appSettings";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { ExercisePlanWeek, WorkoutSession } from "@/models";
import { addDays } from "@/features/speaking/schedule";
import { getActiveProfile, type ProfileView } from "./profile";
import { type PlanDay, scheduledDates, skeletonWeek, weekIndex, weekStartOf } from "./plan";
import { activeExercises } from "./library";
import { fillWeek, type LastWeekResult } from "./planAi";

export type PlanWeekView = { weekStart: string; days: PlanDay[]; source: "ai" | "code"; coachNote: string };

type WeekDoc = PlanWeekView;

const toView = (w: WeekDoc): PlanWeekView => ({
  weekStart: w.weekStart,
  days: w.days.map((d) => ({
    date: d.date,
    focus: d.focus,
    minutes: d.minutes,
    items: d.items.map((i) => ({
      exerciseId: i.exerciseId,
      sets: i.sets,
      ...(i.reps != null ? { reps: i.reps } : {}),
      ...(i.seconds != null ? { seconds: i.seconds } : {}),
      restSec: i.restSec,
    })),
  })),
  source: w.source,
  coachNote: w.coachNote,
});

function summary(p: ProfileView): string {
  return `${p.level}, ${p.workoutDays.length} workouts a week of ${p.minutesPerSession} min, goal ${p.startWeightKg} to ${p.goalWeightKg} kg`;
}

async function lastWeekOf(userId: string, p: ProfileView, weekStart: string) {
  const from = addDays(weekStart, -7);
  const to = addDays(weekStart, -1);
  const sessions = await WorkoutSession.find({ userId, date: { $gte: from, $lte: to } }).lean<
    { status: string; items: LastWeekResult[] }[]
  >();
  const planned = (await plannedDates(userId, p, from, to)).length;
  const done = sessions.filter((s) => s.status === "done").length;
  return {
    finishedRatio: planned ? done / planned : 0,
    lastWeek: sessions.flatMap((s) =>
      s.items.map((i): LastWeekResult => ({ exerciseId: i.exerciseId, setsDone: i.setsDone, skipped: i.skipped, feel: i.feel })),
    ),
  };
}

export async function ensureWeek(userId: string, today: string, fetchFn?: typeof fetch): Promise<PlanWeekView | null> {
  const profile = await getActiveProfile(userId);
  if (!profile || today > profile.targetDate) return null;
  const weekStart = weekStartOf(today);
  const existing = await ExercisePlanWeek.findOne({ profileId: profile.id, weekStart }).lean<WeekDoc>();
  if (existing) return toView(existing);

  const exercises = await activeExercises();
  if (!exercises.length) return null;
  const { finishedRatio, lastWeek } = await lastWeekOf(userId, profile, weekStart);
  const direction =
    profile.goalWeightKg < profile.startWeightKg ? "lose" : profile.goalWeightKg > profile.startWeightKg ? "gain" : "keep";
  const { exerciseRotation: rotation } = await getAppSettings();
  const skeleton = skeletonWeek({ ...profile, direction, rotation }, weekStart, { finishedRatio });
  const filled = await fillWeek({
    userId,
    skeleton,
    weekIdx: weekIndex(profile.startDate, weekStart),
    profileSummary: summary(profile),
    lastWeek,
    exercises,
    fetch: fetchFn,
  });

  const doc = await retryOnDuplicateKey(() =>
    ExercisePlanWeek.findOneAndUpdate(
      { profileId: profile.id, weekStart },
      { $setOnInsert: { userId, profileId: profile.id, weekStart, days: filled.days, source: filled.source, coachNote: filled.coachNote } },
      { upsert: true, returnDocument: "after" },
    ).lean<WeekDoc>(),
  );
  return toView(doc!);
}

export async function dayPlan(userId: string, date: string): Promise<PlanDay | null> {
  await connectDb();
  const profile = await getActiveProfile(userId);
  if (!profile) return null;
  const week = await ExercisePlanWeek.findOne({ profileId: profile.id, weekStart: weekStartOf(date) }).lean<WeekDoc>();
  if (!week) return null;
  return toView(week).days.find((d) => d.date === date) ?? null;
}

export async function plannedDates(userId: string, profile: ProfileView, from: string, to: string): Promise<string[]> {
  await connectDb();
  const first = weekStartOf(from);
  const weekStarts: string[] = [];
  for (let w = first; w <= to; w = addDays(w, 7)) weekStarts.push(w);
  const stored = await ExercisePlanWeek.find({ userId, profileId: profile.id, weekStart: { $in: weekStarts } })
    .select("weekStart days.date")
    .lean<{ weekStart: string; days: { date: string }[] }[]>();
  const byWeek = new Map(stored.map((w) => [w.weekStart, w.days.map((d) => d.date)]));
  const dates = new Set<string>();
  for (const w of weekStarts) {
    for (const d of byWeek.get(w) ?? scheduledDates(profile, w, addDays(w, 6))) {
      if (d >= from && d <= to) dates.add(d);
    }
  }
  return [...dates].sort();
}
