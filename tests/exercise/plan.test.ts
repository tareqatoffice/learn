import { describe, expect, it } from "vitest";
import { LEVELS } from "@/models/exerciseConstants";
import { addDays } from "@/features/speaking/schedule";
import {
  baseVolume,
  fillDay,
  scheduledDates,
  skeletonWeek,
  validateDay,
  weekIndex,
  weekStartOf,
  type SkeletonInput,
} from "@/features/exercise/plan";

const base: SkeletonInput = {
  level: "beginner",
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startDate: "2026-11-23",
  targetDate: "2026-12-31",
  direction: "lose",
};
const history = { finishedRatio: 0.5 };

describe("week helpers", () => {
  it("finds Monday and week index", () => {
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16");
    expect(weekStartOf("2026-11-25")).toBe("2026-11-23");
    expect(weekIndex("2026-11-25", "2026-12-21")).toBe(4);
  });
  it("grows volume 10% a week within limits", () => {
    expect(baseVolume("beginner", 0)).toEqual({ reps: 8, seconds: 20 });
    expect(baseVolume("beginner", 2)).toEqual({ reps: 10, seconds: 24 });
    expect(baseVolume("advanced", 50)).toEqual({ reps: 30, seconds: 60 });
  });
});

describe("skeletonWeek", () => {
  it("rotates focus with a stretch day last", () => {
    const week = skeletonWeek(base, "2026-11-23", history);
    expect(week.map((d) => d.focus)).toEqual(["full", "lower", "stretch"]);
    expect(week.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-25", "2026-11-27"]);
    expect(week[0].sets).toBe(2);
    expect(week[0].maxDifficulty).toBe(1);
  });
  it("swaps cardio for full when gaining", () => {
    const four = { ...base, workoutDays: [1, 2, 3, 4, 5], direction: "gain" as const };
    expect(skeletonWeek(four, "2026-11-23", history).map((d) => d.focus)).toEqual([
      "full",
      "lower",
      "upper",
      "full",
      "stretch",
    ]);
    const lose = { ...four, direction: "lose" as const };
    expect(skeletonWeek(lose, "2026-11-23", history)[3].focus).toBe("cardio");
  });
  it("deloads on week index 3", () => {
    expect(skeletonWeek(base, "2026-12-14", history)[0].sets).toBe(1);
  });
  it("raises difficulty from week 4 when sessions were finished", () => {
    expect(skeletonWeek(base, "2026-12-21", { finishedRatio: 0.9 })[0].maxDifficulty).toBe(2);
    expect(skeletonWeek(base, "2026-12-21", { finishedRatio: 0.5 })[0].maxDifficulty).toBe(1);
  });
  it("leaves out days after the target date", () => {
    const p = { ...base, targetDate: "2026-11-26" };
    expect(skeletonWeek(p, "2026-11-23", history).map((d) => d.date)).toEqual(["2026-11-23", "2026-11-25"]);
    expect(skeletonWeek(p, "2026-11-30", history)).toEqual([]);
  });
});

describe("scheduledDates", () => {
  it("lists workout weekdays inside the window", () => {
    const p = { workoutDays: [1, 3, 5], startDate: "2026-11-25", targetDate: "2026-12-31" };
    expect(scheduledDates(p, "2026-11-23", "2026-11-29")).toEqual(["2026-11-25", "2026-11-27"]);
  });
});

describe("fillDay", () => {
  const day = skeletonWeek(base, "2026-11-23", history)[0];
  it("is deterministic per seed and varies across seeds", () => {
    expect(fillDay(day, "a")).toEqual(fillDay(day, "a"));
    const outputs = ["a", "b", "c", "d", "e"].map((s) => JSON.stringify(fillDay(day, s)));
    expect(new Set(outputs).size).toBeGreaterThan(1);
  });
  it("always passes validation, whatever the level, week and length", () => {
    for (const level of LEVELS) {
      for (const idx of [0, 12]) {
        for (const minutes of [10, 60]) {
          const p = { ...base, level, minutesPerSession: minutes, targetDate: "2027-12-31" };
          const days = skeletonWeek(p, addDays("2026-11-23", idx * 7), { finishedRatio: 1 });
          expect(days.length).toBeGreaterThan(0);
          for (const d of days) {
            const filled = fillDay(d, `${level}-${idx}-${minutes}`);
            expect(filled.items).toHaveLength(d.slots);
            expect(validateDay(d, filled.items), `${level} week ${idx} ${minutes}m`).not.toBeNull();
          }
        }
      }
    }
  });
});

describe("validateDay", () => {
  const day = skeletonWeek(base, "2026-11-23", history)[0];
  const good = fillDay(day, "x").items;
  it("returns valid items", () => {
    expect(validateDay(day, good)).toEqual(good);
  });
  it("rejects bad input", () => {
    const first = good[0];
    expect(validateDay(day, [{ ...first, exerciseId: "nope" }, ...good.slice(1)])).toBeNull();
    expect(validateDay(day, [{ ...first, reps: 40 }, ...good.slice(1)])).toBeNull();
    expect(validateDay(day, [{ ...first, sets: 0 }, ...good.slice(1)])).toBeNull();
    expect(validateDay(day, [...good, ...good.slice(0, 2)])).toBeNull();
    expect(validateDay(day, "nope")).toBeNull();
  });
  it("rejects items whose fields do not match the exercise mode", () => {
    const withReps = good.findIndex((i) => i.reps !== undefined);
    const withSeconds = good.findIndex((i) => i.seconds !== undefined);
    const swap = (idx: number, item: object) => good.map((g, n) => (n === idx ? { ...g, ...item } : g));
    if (withReps >= 0) {
      expect(validateDay(day, swap(withReps, { seconds: 30 }))).toBeNull(); // reps move given reps and seconds
      expect(validateDay(day, good.map((g, n) => (n === withReps ? { ...g, reps: undefined, seconds: 30 } : g)))).toBeNull(); // seconds only
    }
    if (withSeconds >= 0) {
      expect(validateDay(day, swap(withSeconds, { reps: 12 }))).toBeNull(); // time move given both
      expect(validateDay(day, good.map((g, n) => (n === withSeconds ? { ...g, seconds: undefined, reps: 12 } : g)))).toBeNull(); // reps only
    }
    expect(withReps >= 0 || withSeconds >= 0).toBe(true);
  });
  it("rejects a day longer than the time budget", () => {
    const long = good.map((i) => (i.seconds !== undefined ? { ...i, sets: 4, restSec: 180, seconds: 60 } : { ...i, sets: 4, restSec: 180, reps: 30 }));
    expect(validateDay({ ...day, minutes: 5 }, long)).toBeNull();
  });
});
