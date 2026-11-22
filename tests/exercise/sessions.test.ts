import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile, WorkoutSession } from "@/models";
import { getActiveProfile, saveProfile, type ProfileInput } from "@/features/exercise/profile";
import { dayPlan, ensureWeek, plannedDates } from "@/features/exercise/weeks";
import { finishSession, resumePoint, saveSet, startSession, streak, weekSummary } from "@/features/exercise/sessions";
import { resetDb } from "../setup/mongo";
import { newUserId } from "../progress/seed";

const input = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  heightCm: 175,
  birthYear: 1990,
  sex: "male",
  level: "intermediate",
  workoutDays: [1, 3, 5],
  minutesPerSession: 45,
  startWeightKg: 80,
  goalWeightKg: 72,
  months: 3,
  ...over,
});

async function setup(over: Partial<ProfileInput> = {}, weeks: string[] = ["2026-11-02"]) {
  const userId = newUserId();
  await saveProfile(userId, input(over), "2026-11-02");
  for (const w of weeks) await ensureWeek(userId, w);
  return userId;
}

async function complete(userId: string, date: string) {
  await startSession(userId, date);
  await finishSession(userId, date, {});
}

describe("workout sessions", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([ExerciseProfile.init(), ExercisePlanWeek.init(), WorkoutSession.init()]);
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("startSession is idempotent and null on a rest day", async () => {
    const userId = await setup();
    const a = await startSession(userId, "2026-11-02");
    await saveSet(userId, "2026-11-02", 0, "done");
    const b = await startSession(userId, "2026-11-02");
    expect(a?.items.length).toBeGreaterThan(0);
    expect(b?.items[0].setsDone).toBe(1);
    expect(await WorkoutSession.countDocuments({ userId })).toBe(1);
    expect(await startSession(userId, "2026-11-03")).toBeNull();
  });

  it("saveSet caps at sets, skips, and goes back", async () => {
    const userId = await setup();
    const plan = (await dayPlan(userId, "2026-11-02"))!;
    await startSession(userId, "2026-11-02");
    let s = await saveSet(userId, "2026-11-02", 0, "back");
    expect(s.items[0].setsDone).toBe(0);
    for (let i = 0; i < plan.items[0].sets + 2; i++) s = await saveSet(userId, "2026-11-02", 0, "done");
    expect(s.items[0].setsDone).toBe(plan.items[0].sets);
    s = await saveSet(userId, "2026-11-02", 1, "skip");
    expect(s.items[1].skipped).toBe(true);
    s = await saveSet(userId, "2026-11-02", 1, "back");
    expect(s.items[1].skipped).toBe(false);
  });

  it("resumes at the first unfinished set after reload", async () => {
    const userId = await setup();
    const plan = (await dayPlan(userId, "2026-11-02"))!;
    expect(plan.items[0].sets).toBe(3);
    await startSession(userId, "2026-11-02");
    await saveSet(userId, "2026-11-02", 0, "done");
    await saveSet(userId, "2026-11-02", 0, "done");
    const reloaded = (await startSession(userId, "2026-11-02"))!;
    expect(resumePoint(reloaded, plan)).toEqual({ item: 0, set: 2 });
    await saveSet(userId, "2026-11-02", 0, "skip");
    expect(resumePoint((await startSession(userId, "2026-11-02"))!, plan)).toEqual({ item: 1, set: 0 });
  });

  it("resumePoint is null when everything is done or skipped", () => {
    const plan = { date: "d", focus: "full" as const, minutes: 30, items: [{ exerciseId: "a", sets: 2, reps: 8, restSec: 30 }, { exerciseId: "b", sets: 2, reps: 8, restSec: 30 }] };
    const s = { date: "d", status: "inProgress" as const, items: [{ exerciseId: "a", setsDone: 2, skipped: false }, { exerciseId: "b", setsDone: 0, skipped: true }] };
    expect(resumePoint(s, plan)).toBeNull();
  });

  it("finishSession stores feels and marks the session done", async () => {
    const userId = await setup();
    const s = (await startSession(userId, "2026-11-02"))!;
    const done = await finishSession(userId, "2026-11-02", { [s.items[0].exerciseId]: "hard" });
    expect(done.status).toBe("done");
    expect(done.items[0].feel).toBe("hard");
  });

  it("weekSummary counts done sessions against scheduled days", async () => {
    const userId = await setup();
    await complete(userId, "2026-11-02");
    expect(await weekSummary(userId, "2026-11-02")).toEqual({ done: 1, planned: 3 });
  });

  it("streak counts done workouts in a row; rest days don't break it; a missed one does", async () => {
    const userId = await setup({}, ["2026-11-02", "2026-11-09"]);
    for (const d of ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"]) await complete(userId, d);
    expect(await streak(userId, "2026-11-11")).toBe(2);
    await complete(userId, "2026-11-06");
    expect(await streak(userId, "2026-11-11")).toBe(5);
    expect(await streak(userId, "2026-11-12")).toBe(5);
  });

  it("today not done yet does not break the streak", async () => {
    const userId = await setup({}, ["2026-11-02", "2026-11-09"]);
    for (const d of ["2026-11-02", "2026-11-04", "2026-11-06"]) await complete(userId, d);
    expect(await streak(userId, "2026-11-09")).toBe(3);
  });

  it("streak breaks across a week the user never opened", async () => {
    const userId = await setup({ workoutDays: [1] }, ["2026-11-02", "2026-11-16"]);
    await complete(userId, "2026-11-02");
    await complete(userId, "2026-11-16");
    expect(await streak(userId, "2026-11-16")).toBe(1);
  });

  it("changing workoutDays mid-week keeps earlier sessions in the streak and the week summary consistent", async () => {
    const userId = await setup();
    await complete(userId, "2026-11-02");
    await complete(userId, "2026-11-04");
    await saveProfile(userId, input({ workoutDays: [2, 4] }), "2026-11-04");
    expect(await streak(userId, "2026-11-04")).toBe(2);
    const summary = await weekSummary(userId, "2026-11-02");
    expect(summary).toEqual({ done: 2, planned: 3 });
    expect(summary.done).toBeLessThanOrEqual(summary.planned);
    const profile = (await getActiveProfile(userId))!;
    const dates = await plannedDates(userId, profile, "2026-11-02", "2026-11-08");
    expect(dates).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
    for (const d of dates) expect(await dayPlan(userId, d)).not.toBeNull();
  });
});
