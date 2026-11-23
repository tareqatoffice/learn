import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { ExerciseProfile, WeightEntry } from "@/models";
import { isRealDate } from "@/features/exercise/date";
import { getActiveProfile, saveProfile } from "@/features/exercise/profile";
import { deleteWeight, listWeights, logWeight } from "@/features/exercise/weights";
import { resetDb } from "../setup/mongo";
import { newUserId } from "../progress/seed";

const profile = {
  heightCm: 175,
  birthYear: 1990,
  sex: "male" as const,
  level: "beginner" as const,
  workoutDays: [1, 3, 5],
  minutesPerSession: 30,
  startWeightKg: 80,
  goalWeightKg: 72,
  months: 3,
};

describe("weights", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all([ExerciseProfile.init(), WeightEntry.init()]);
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("logWeight fails with a form message when there is no active profile", async () => {
    const res = await logWeight(newUserId(), "2026-11-02", 80, "2026-11-02");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors._).toBeTruthy();
  });

  it("rejects 0, -1, 29, 301, NaN and a future date", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    for (const kg of [0, -1, 29, 301, Number.NaN]) {
      expect((await logWeight(userId, "2026-11-02", kg, "2026-11-02")).ok).toBe(false);
    }
    expect((await logWeight(userId, "2026-11-03", 80, "2026-11-02")).ok).toBe(false);
    expect(await WeightEntry.countDocuments({ userId })).toBe(0);
  });

  it("logging twice on one day overwrites", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    await logWeight(userId, "2026-11-02", 80, "2026-11-02");
    const res = await logWeight(userId, "2026-11-02", 79.4, "2026-11-02");
    expect(res).toMatchObject({ ok: true, date: "2026-11-02", kg: 79.4 });
    const active = await getActiveProfile(userId);
    expect(await listWeights(userId, active!.id)).toEqual([{ date: "2026-11-02", kg: 79.4 }]);
  });

  it("lists by date ascending and deletes an entry", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    await logWeight(userId, "2026-11-04", 79, "2026-11-04");
    await logWeight(userId, "2026-11-02", 80, "2026-11-04");
    const active = await getActiveProfile(userId);
    expect((await listWeights(userId, active!.id)).map((w) => w.date)).toEqual(["2026-11-02", "2026-11-04"]);
    expect((await deleteWeight(userId, "2026-11-02")).ok).toBe(true);
    expect((await listWeights(userId, active!.id)).map((w) => w.date)).toEqual(["2026-11-04"]);
  });

  it("rejects dates that are not real calendar days", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    for (const d of ["2026-02-30", "2026-13-01"]) {
      expect((await logWeight(userId, d, 80, "2026-12-31")).ok).toBe(false);
      expect((await deleteWeight(userId, d)).ok).toBe(false);
    }
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2026-2-3")).toBe(false);
    expect(isRealDate(20261101)).toBe(false);
  });

  it("rejects a date before the active goal started", async () => {
    const userId = newUserId();
    await saveProfile(userId, profile, "2026-11-02");
    const res = await logWeight(userId, "2026-11-01", 80, "2026-11-05");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.date).toBeTruthy();
    expect(await WeightEntry.countDocuments({ userId })).toBe(0);
  });

  it("updating an existing entry never re-tags it to another goal", async () => {
    const userId = newUserId();
    const first = await saveProfile(userId, profile, "2026-11-02");
    if (!first.ok) throw new Error("save failed");
    await logWeight(userId, "2026-11-03", 80, "2026-11-03");
    const second = await saveProfile(userId, { ...profile, goalWeightKg: 70 }, "2026-11-03");
    if (!second.ok) throw new Error("save failed");
    expect((await logWeight(userId, "2026-11-03", 79, "2026-11-03")).ok).toBe(true);
    const row = await WeightEntry.findOne({ userId, date: "2026-11-03" }).lean<{ kg: number; profileId: unknown }>();
    expect(row?.kg).toBe(79);
    expect(String(row?.profileId)).toBe(first.id);
  });
});
