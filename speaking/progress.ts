import { connectDb } from "@/lib/db";
import { SpeakingTake } from "@/models";
import { storageConfigured } from "@/lib/r2";
import { getEffectiveSettings, type EffectiveSettings } from "./settings";
import { todaysLesson, type LessonView } from "./lessons";
import { type DayMinutes, addDays, dayFraction, localDate, longestStreak, streak, taskDone, weekDates } from "./schedule";
import { TASKS, type TaskKey } from "./tasks";

type Row = {
  date: string;
  task: TaskKey;
  media: { durationSec: number };
  self?: { fluency?: number; confidence?: number };
  ai?: { speech?: { fluency?: number; vocabulary?: number; grammar?: number }; body?: { confidence?: number } };
};

const ZERO = { minutes: 0 };

/** Stored takes only; unstored uploads never count. */
function storedTakes(userId: string, filter: Record<string, unknown> = {}) {
  return SpeakingTake.find({ userId, "media.stored": true, ...filter });
}

export async function getToday(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<{
  date: string;
  settings: EffectiveSettings;
  lesson: LessonView | null;
  minutes: DayMinutes;
  done: Record<TaskKey, boolean>;
  week: { date: string; fraction: number }[];
  streak: number;
  best: number;
  storage: boolean;
}> {
  await connectDb();
  const date = localDate(now, timeZone);
  const settings = await getEffectiveSettings(userId);
  const lesson = await todaysLesson(userId, date, settings.enabled);

  const days = weekDates(date);
  const [weekRows, practisedRows] = await Promise.all([
    storedTakes(userId, { date: { $in: days } })
      .select("date task media.durationSec")
      .lean<Row[]>(),
    SpeakingTake.distinct("date", { userId, "media.stored": true }) as Promise<string[]>,
  ]);

  const perDay = new Map<string, DayMinutes>();
  for (const r of weekRows) {
    const mins = perDay.get(r.date) ?? {};
    mins[r.task] = (mins[r.task] ?? 0) + r.media.durationSec / 60;
    perDay.set(r.date, mins);
  }

  const minutes = perDay.get(date) ?? {};
  const done = Object.fromEntries(
    TASKS.map((t) => [t, taskDone(minutes[t] ?? 0, settings.targets[t])]),
  ) as Record<TaskKey, boolean>;
  const week = days.map((d) => ({ date: d, fraction: dayFraction(perDay.get(d) ?? {}, settings.targets, settings.enabled) }));

  const practised = new Set(practisedRows);
  return {
    date,
    settings,
    lesson,
    minutes,
    done,
    week,
    streak: streak(practised, date),
    best: longestStreak(practised),
    storage: storageConfigured(),
  };
}

const avg = (values: number[]): number | undefined =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : undefined;

function collect(target: Record<string, number | undefined>, values: Record<string, number[]>) {
  for (const [key, list] of Object.entries(values)) {
    const v = avg(list);
    if (v !== undefined) target[key] = v;
  }
}

export async function getTrends(
  userId: string,
  days: number,
  timeZone: string,
  now: Date = new Date(),
): Promise<
  {
    date: string;
    minutes: number;
    self: { fluency?: number; confidence?: number };
    ai: { fluency?: number; vocabulary?: number; grammar?: number; confidence?: number };
  }[]
> {
  await connectDb();
  const count = Math.min(Math.max(Math.floor(days) || 1, 1), 366);
  const last = localDate(now, timeZone);
  const dates = Array.from({ length: count }, (_, i) => addDays(last, i - count + 1));

  const rows = await storedTakes(userId, { date: { $gte: dates[0], $lte: last } })
    .select("date media.durationSec self ai.speech.fluency ai.speech.vocabulary ai.speech.grammar ai.body.confidence")
    .lean<Row[]>();

  const byDate = new Map<string, Row[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return dates.map((date) => {
    const list = byDate.get(date) ?? [];
    const nums = (pick: (r: Row) => number | undefined) =>
      list.map(pick).filter((n): n is number => typeof n === "number");
    const self: { fluency?: number; confidence?: number } = {};
    const ai: { fluency?: number; vocabulary?: number; grammar?: number; confidence?: number } = {};
    collect(self, {
      fluency: nums((r) => r.self?.fluency),
      confidence: nums((r) => r.self?.confidence),
    });
    collect(ai, {
      fluency: nums((r) => r.ai?.speech?.fluency),
      vocabulary: nums((r) => r.ai?.speech?.vocabulary),
      grammar: nums((r) => r.ai?.speech?.grammar),
      confidence: nums((r) => r.ai?.body?.confidence),
    });
    const minutes = list.reduce((sum, r) => sum + r.media.durationSec / 60, ZERO.minutes);
    return { date, minutes: Math.round(minutes * 10) / 10, self, ai };
  });
}
