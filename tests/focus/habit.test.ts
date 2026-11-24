import { describe, expect, it } from "vitest";
import {
  type HabitSession,
  localClock,
  shouldRemind,
  streakOf,
  suggestBlock,
  weekStartOf,
  weekSummary,
} from "@/features/focus/habit";

const TODAY = "2026-11-24";
const MONDAY = "2026-11-23";

const s = (date: string, over: Partial<HabitSession> = {}): HabitSession => ({ date, seconds: 600, ...over });

describe("weekStartOf", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-24")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-29")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-30")).toBe("2026-11-30");
  });
});

describe("streakOf", () => {
  it("is empty with no sessions", () => {
    expect(streakOf([], TODAY)).toEqual({ days: 0, alive: false, lastActive: null, doneToday: false, atRisk: false });
  });

  it("counts consecutive days and notes today is done", () => {
    expect(streakOf(["2026-11-24", "2026-11-23", "2026-11-22"], TODAY)).toMatchObject({ days: 3, alive: true, doneToday: true, atRisk: false });
  });

  it("forgives one missed day but not two in a row", () => {
    expect(streakOf(["2026-11-24", "2026-11-22"], TODAY).days).toBe(2);
    expect(streakOf(["2026-11-24", "2026-11-21"], TODAY).days).toBe(1);
    expect(streakOf(["2026-11-24", "2026-11-22", "2026-11-20", "2026-11-17"], TODAY).days).toBe(3);
  });

  it("stays alive but at risk when yesterday was missed and today is open", () => {
    expect(streakOf(["2026-11-22", "2026-11-21"], TODAY)).toMatchObject({ days: 2, alive: true, doneToday: false, atRisk: true });
    expect(streakOf(["2026-11-23"], TODAY)).toMatchObject({ days: 1, alive: true, atRisk: false });
  });

  it("ends after two missed days and remembers the last active day", () => {
    expect(streakOf(["2026-11-21", "2026-11-20"], TODAY)).toEqual({
      days: 0,
      alive: false,
      lastActive: "2026-11-21",
      doneToday: false,
      atRisk: false,
    });
  });

  it("ignores duplicates and future dates", () => {
    expect(streakOf(["2026-11-24", "2026-11-24", "2026-11-23", "2026-12-01"], TODAY).days).toBe(2);
  });
});

describe("weekSummary", () => {
  it("totals the week by day and ignores other weeks", () => {
    const sum = weekSummary(
      [s("2026-11-23", { seconds: 1500 }), s("2026-11-23", { seconds: 300 }), s("2026-11-25"), s("2026-11-22"), s("2026-11-30")],
      MONDAY,
    );
    expect(sum.days).toHaveLength(7);
    expect(sum.days[0]).toEqual({ date: MONDAY, seconds: 1800 });
    expect(sum.days[2]).toEqual({ date: "2026-11-25", seconds: 600 });
    expect(sum.totalSeconds).toBe(2400);
    expect(sum.sessions).toBe(3);
  });

  it("averages ratings, picks the top distraction and sums drifts", () => {
    const sum = weekSummary(
      [
        s("2026-11-23", { rating: 4, distraction: "phone", drifts: 2 }),
        s("2026-11-24", { rating: 3, distraction: "noise", drifts: 1 }),
        s("2026-11-25", { rating: 4, distraction: "noise" }),
        s("2026-11-26"),
      ],
      MONDAY,
    );
    expect(sum.avgRating).toBe(3.7);
    expect(sum.ratedSessions).toBe(3);
    expect(sum.topDistraction).toBe("noise");
    expect(sum.drifts).toBe(3);
  });

  it("breaks distraction ties alphabetically and handles an empty week", () => {
    const tie = weekSummary([s("2026-11-23", { distraction: "phone" }), s("2026-11-24", { distraction: "noise" })], MONDAY);
    expect(tie.topDistraction).toBe("noise");
    const empty = weekSummary([], MONDAY);
    expect(empty).toMatchObject({ totalSeconds: 0, sessions: 0, avgRating: null, topDistraction: null, drifts: 0 });
  });
});

describe("suggestBlock", () => {
  it("starts at 25 minutes with no history", () => {
    expect(suggestBlock([], TODAY)).toMatchObject({ minutes: 25, direction: "same" });
  });

  it("adds five minutes after three finished blocks in a week", () => {
    const rows = ["2026-11-20", "2026-11-22", "2026-11-23"].map((d) => s(d, { completed: true, targetMinutes: 25 }));
    expect(suggestBlock(rows, TODAY)).toMatchObject({ minutes: 30, direction: "up" });
  });

  it("holds when finished blocks felt only so-so", () => {
    const rows = ["2026-11-20", "2026-11-22", "2026-11-23"].map((d) => s(d, { completed: true, targetMinutes: 30, rating: 3 }));
    expect(suggestBlock(rows, TODAY)).toMatchObject({ minutes: 30, direction: "same" });
  });

  it("goes down when focus is rated low", () => {
    const rows = [s("2026-11-22", { targetMinutes: 30, rating: 2 }), s("2026-11-23", { targetMinutes: 30, rating: 1 })];
    expect(suggestBlock(rows, TODAY)).toMatchObject({ minutes: 25, direction: "down" });
  });

  it("builds on the most recent block length and stays within 10 to 90", () => {
    const old = s("2026-10-01", { completed: true, targetMinutes: 60 });
    const recent = ["2026-11-20", "2026-11-22", "2026-11-23"].map((d) => s(d, { completed: true, targetMinutes: 45 }));
    expect(suggestBlock([old, ...recent], TODAY).minutes).toBe(50);

    const maxed = ["2026-11-20", "2026-11-22", "2026-11-23"].map((d) => s(d, { completed: true, targetMinutes: 90 }));
    expect(suggestBlock(maxed, TODAY)).toMatchObject({ minutes: 90, direction: "same" });

    const floor = [s("2026-11-22", { targetMinutes: 10, rating: 1 }), s("2026-11-23", { targetMinutes: 10, rating: 2 })];
    expect(suggestBlock(floor, TODAY).minutes).toBe(10);
  });
});

describe("shouldRemind", () => {
  const plan = { time: "19:00", enabled: true };
  const at = (hhmm: string) => ({ date: TODAY, hhmm });

  it("fires from the planned time for a short window, once a day", () => {
    expect(shouldRemind(plan, at("18:59"), null)).toBe(false);
    expect(shouldRemind(plan, at("19:00"), null)).toBe(true);
    expect(shouldRemind(plan, at("19:19"), null)).toBe(true);
    expect(shouldRemind(plan, at("19:20"), null)).toBe(false);
    expect(shouldRemind(plan, at("19:05"), TODAY)).toBe(false);
    expect(shouldRemind(plan, at("19:05"), "2026-11-23")).toBe(true);
  });

  it("keeps the window across midnight", () => {
    const late = { time: "23:50", enabled: true };
    expect(shouldRemind(late, { date: TODAY, hhmm: "23:55" }, null)).toBe(true);
    expect(shouldRemind(late, { date: "2026-11-25", hhmm: "00:05" }, TODAY)).toBe(true);
    expect(shouldRemind(late, { date: "2026-11-25", hhmm: "00:15" }, TODAY)).toBe(false);
    expect(shouldRemind(late, { date: TODAY, hhmm: "23:49" }, null)).toBe(false);
  });

  it("stays quiet without an enabled plan", () => {
    expect(shouldRemind(null, at("19:00"), null)).toBe(false);
    expect(shouldRemind({ ...plan, enabled: false }, at("19:00"), null)).toBe(false);
  });
});

describe("localClock", () => {
  it("reads the local date and zero-padded time", () => {
    expect(localClock(new Date(2026, 10, 24, 7, 5))).toEqual({ date: "2026-11-24", hhmm: "07:05" });
    expect(localClock(new Date(2026, 0, 3, 23, 59))).toEqual({ date: "2026-01-03", hhmm: "23:59" });
  });
});
