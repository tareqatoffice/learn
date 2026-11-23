import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile, WeightEntry } from "@/models";
import { finishIfDone, getActiveProfile, previewGoal, saveProfile, startKeepFit, type ProfileInput } from "@/features/exercise/profile";
import { weeklyPace, weeksBetween } from "@/features/exercise/goal";
import { ensureWeek } from "@/features/exercise/weeks";
import { logWeight } from "@/features/exercise/weights";
import { resetDb } from "../setup/mongo";
import { newUserId } from "../progress/seed";

const input = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  heightCm: 175,
  birthYear: 1990,
  sex: "male",
  level: "beginner",
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startWeightKg: 80,
  goalWeightKg: 72,
  months: 3,
  ...over,
});

describe("exercise profile", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([ExerciseProfile.init(), ExercisePlanWeek.init(), WeightEntry.init()]);
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("blocks a goal faster than 1 kg/week and suggests a safe date", async () => {
    const userId = newUserId();
    const res = await saveProfile(userId, input({ goalWeightKg: 60, months: 1 }), "2026-11-02");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.months).toMatch(/faster than 1 kg a week.*earliest safe date is \d{4}-\d{2}-\d{2}/);
    expect(await getActiveProfile(userId)).toBeNull();
    expect(previewGoal(input({ goalWeightKg: 60, months: 1 }), "2026-11-02")).toMatchObject({ check: "block" });
  });

  it("rejects out-of-range fields with field messages", async () => {
    const res = await saveProfile(newUserId(), input({ heightCm: 100, workoutDays: [1, 1], minutesPerSession: 5 }), "2026-11-02");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(["heightCm", "minutesPerSession", "workoutDays"]);
  });

  it("warns but saves at 0.8 kg/week", async () => {
    const userId = newUserId();
    const i = input({ goalWeightKg: 76.6, months: 1 });
    expect(previewGoal(i, "2026-11-02").check).toBe("warn");
    const res = await saveProfile(userId, i, "2026-11-02");
    expect(res.ok).toBe(true);
    expect(await getActiveProfile(userId)).toMatchObject({ startDate: "2026-11-02", targetDate: "2026-12-02", goalWeightKg: 76.6 });
  });

  it("changing goal weight ends the old profile and keeps its weights", async () => {
    const userId = newUserId();
    const first = await saveProfile(userId, input(), "2026-11-02");
    if (!first.ok) throw new Error("save failed");
    expect((await logWeight(userId, "2026-11-02", 80, "2026-11-02")).ok).toBe(true);
    const second = await saveProfile(userId, input({ goalWeightKg: 70 }), "2026-11-03");
    if (!second.ok) throw new Error("save failed");
    expect(second.id).not.toBe(first.id);
    const old = await ExerciseProfile.findById(first.id).lean<{ status: string; endedReason: string }>();
    expect(old).toMatchObject({ status: "ended", endedReason: "replaced" });
    expect(await WeightEntry.countDocuments({ userId, profileId: first.id })).toBe(1);
    expect(await ExerciseProfile.countDocuments({ userId, status: "active" })).toBe(1);
  });

  it("changing only workoutDays keeps the profile id and leaves stored weeks alone", async () => {
    const userId = newUserId();
    const first = await saveProfile(userId, input(), "2026-11-02");
    if (!first.ok) throw new Error("save failed");
    for (const weekStart of ["2026-11-02", "2026-11-09", "2026-11-16"]) {
      await ExercisePlanWeek.create({ userId, profileId: first.id, weekStart, days: [], source: "code", coachNote: "" });
    }
    const second = await saveProfile(userId, input({ workoutDays: [2, 4] }), "2026-11-04");
    if (!second.ok) throw new Error("save failed");
    expect(second.id).toBe(first.id);
    expect(second.workoutDays).toEqual([2, 4]);
    const weeks = await ExercisePlanWeek.find({ userId }).sort({ weekStart: 1 }).lean<{ weekStart: string }[]>();
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("finishIfDone ends the profile after targetDate", async () => {
    const userId = newUserId();
    await saveProfile(userId, input({ goalWeightKg: 77, months: 1 }), "2026-11-02");
    expect(await finishIfDone(userId, "2026-12-02")).toEqual({ finished: false });
    expect(await finishIfDone(userId, "2026-12-03")).toEqual({ finished: true, reason: "target" });
    expect(await getActiveProfile(userId)).toBeNull();
    expect(await ensureWeek(userId, "2026-12-03")).toBeNull();
  });

  it("finishIfDone ends the profile when the 7-day average of 3+ entries reaches the goal", async () => {
    const userId = newUserId();
    await saveProfile(userId, input(), "2026-11-02");
    for (const date of ["2026-11-03", "2026-11-04", "2026-11-05"]) await logWeight(userId, date, 71.5, date);
    expect(await finishIfDone(userId, "2026-11-05")).toEqual({ finished: true, reason: "goal" });
  });

  it("one or two entries below goal do not end the plan", async () => {
    const userId = newUserId();
    await saveProfile(userId, input(), "2026-11-02");
    await logWeight(userId, "2026-11-03", 71.5, "2026-11-03");
    expect(await finishIfDone(userId, "2026-11-03")).toEqual({ finished: false });
    await logWeight(userId, "2026-11-04", 71, "2026-11-04");
    expect(await finishIfDone(userId, "2026-11-04")).toEqual({ finished: false });
    expect(await getActiveProfile(userId)).not.toBeNull();
  });

  it("previewGoal for a schedule-only edit shows the kept target date and pace", async () => {
    const userId = newUserId();
    const saved = await saveProfile(userId, input(), "2026-11-02");
    if (!saved.ok) throw new Error("save failed");
    const later = previewGoal(input({ workoutDays: [2, 4] }), "2026-12-10", saved);
    expect(later.targetDate).toBe(saved.targetDate);
    expect(later.pace).toBeCloseTo(weeklyPace(80, 72, weeksBetween(saved.startDate, saved.targetDate)));
    const changed = previewGoal(input({ goalWeightKg: 70 }), "2026-12-10", saved);
    expect(changed.targetDate).toBe("2027-03-10");
  });

  it("startKeepFit continues from the current weight with a 3 month maintenance goal", async () => {
    const userId = newUserId();
    await saveProfile(userId, input(), "2026-11-02");
    for (const date of ["2026-11-03", "2026-11-04", "2026-11-05"]) await logWeight(userId, date, 71.5, date);
    await finishIfDone(userId, "2026-11-05");
    const res = await startKeepFit(userId, "2026-11-06");
    expect(res.ok).toBe(true);
    expect(await getActiveProfile(userId)).toMatchObject({ startWeightKg: 71.5, goalWeightKg: 71.5, targetDate: "2027-02-06" });
  });

  it("previewGoal says whether saving would replace the active goal", () => {
    const active = { startDate: "2026-11-02", targetDate: "2027-02-02", startWeightKg: 80, goalWeightKg: 72 };
    expect(previewGoal(input({ workoutDays: [2, 4] }), "2026-11-04", active).replaces).toBe(false);
    expect(previewGoal(input({ goalWeightKg: 70 }), "2026-11-04", active).replaces).toBe(true);
    expect(previewGoal(input({ months: 4 }), "2026-11-04", active).replaces).toBe(true);
    expect(previewGoal(input(), "2026-11-04", null).replaces).toBe(false);
  });

  it("a goal needing over 24 months says so instead of naming a far date", async () => {
    const hard = input({ startWeightKg: 300, goalWeightKg: 30, months: 1 });
    const preview = previewGoal(hard, "2026-11-02");
    expect(preview).toMatchObject({ check: "block", tooFar: true });
    expect(preview.safeTargetDate).toBeUndefined();
    const res = await saveProfile(newUserId(), hard, "2026-11-02");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.months).toBe("That goal needs more than 24 months at a safe pace. Pick a goal closer to your current weight.");
  });
});
