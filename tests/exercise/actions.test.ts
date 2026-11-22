import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: async () => (await import("../setup/session")).approvedSession(session.userId),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "UTC" }) }) }));

import * as actions from "@/app/(app)/exercise/actions";
import { connectDb } from "@/lib/db";
import { ExerciseProfile, User } from "@/models";
import type { ProfileInput } from "@/features/exercise/profile";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const input = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  heightCm: 175,
  birthYear: 1990,
  sex: "male",
  level: "intermediate",
  workoutDays: [1, 3, 5],
  minutesPerSession: 45,
  startWeightKg: 80,
  goalWeightKg: 76,
  months: 4,
  ...over,
});

describe("exercise actions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });
  afterAll(() => mongoose.disconnect());

  it("saveProfileAction works for an approved user and rejects a pending one", async () => {
    const me = id();
    session.userId = me;
    const res = await actions.saveProfileAction(input());
    expect(res.ok).toBe(true);
    expect(await ExerciseProfile.countDocuments({ userId: me, status: "active" })).toBe(1);

    const pending = id();
    await User.create({ _id: pending, email: `${pending}@example.test`, name: "New", status: "pending", lastLoginAt: new Date() });
    session.userId = pending;
    await expect(actions.saveProfileAction(input())).rejects.toThrow();
    expect(await ExerciseProfile.countDocuments({ userId: pending })).toBe(0);
  });

  it("previewGoalAction returns the pace check and ignores unusable input", async () => {
    session.userId = id();
    const fast = await actions.previewGoalAction(input({ goalWeightKg: 60, months: 1 }));
    expect(fast?.check).toBe("block");
    expect(fast?.safeTargetDate).toBeTruthy();
    expect(await actions.previewGoalAction(input({ months: Number.NaN }))).toBeNull();
  });
});
