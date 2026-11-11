import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsPlan } from "@/models";
import { addDays } from "@/speaking/schedule";
import { currentPlan, endPlan, getProfile, previewProfile, saveProfile, writePlanVersion } from "@/ielts/profile";
import { getIeltsSettings, saveIeltsSettings } from "@/ielts/settings";
import { resetDb } from "../setup/mongo";

const TODAY = "2026-11-11";
const user = () => String(new Types.ObjectId());
const input = (over: Record<string, unknown> = {}) => ({
  testDate: addDays(TODAY, 100),
  target: { overall: 7 },
  current: { overall: 6 },
  minutesPerDay: 60,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  ...over,
});

describe("ielts profile", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("creates version 1, then version 2 on edit, keeping version 1", async () => {
    const u = user();
    const first = await saveProfile(u, input(), TODAY);
    expect(first).toEqual({ ok: true, version: 1 });
    const second = await saveProfile(u, input({ testDate: addDays(TODAY, 120) }), TODAY);
    expect(second).toEqual({ ok: true, version: 2 });
    expect(await IeltsPlan.countDocuments({ userId: u })).toBe(2);
    const plan = await currentPlan(u);
    expect(plan?.version).toBe(2);
    expect(plan?.reason).toBe("You changed your profile");
    expect((await getProfile(u))?.testDate).toBe(addDays(TODAY, 120));
  });

  it("previewProfile writes nothing", async () => {
    const u = user();
    await saveProfile(u, input(), TODAY);
    const res = await previewProfile(u, input({ testDate: addDays(TODAY, 50) }), TODAY);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.before?.version).toBe(1);
      expect(res.after.weeks.length).toBeGreaterThan(0);
    }
    expect(await IeltsPlan.countDocuments({ userId: u })).toBe(1);
    expect((await getProfile(u))?.testDate).toBe(addDays(TODAY, 100));
  });

  it("rejects bad values and writes nothing", async () => {
    const u = user();
    for (const bad of [
      { target: { overall: 9.5 } },
      { minutesPerDay: 5 },
      { studyDays: [] },
      { testDate: addDays(TODAY, -1) },
      { testDate: TODAY },
      { target: { overall: 7.25 } },
    ]) {
      const res = await saveProfile(u, input(bad), TODAY);
      expect(res.ok, JSON.stringify(bad)).toBe(false);
    }
    expect(await getProfile(u)).toBeNull();
    expect(await IeltsPlan.countDocuments({})).toBe(0);
  });

  it("carries standing adjustments from v1 to v2", async () => {
    const u = user();
    await saveProfile(u, input(), TODAY);
    await writePlanVersion(
      u,
      {
        today: TODAY,
        testDate: addDays(TODAY, 100),
        minutesPerDay: 60,
        studyDays: [0, 1, 2, 3, 4, 5, 6],
        target: { overall: 7 },
        current: { overall: 6 },
        currentUnknown: false,
      },
      [{ id: "a1", kind: "shiftCriterion", criterion: "fluency", share: 0.15, createdAt: new Date() }],
      "Added drills",
    );
    expect((await currentPlan(u))?.adjustments.map((a) => a.id)).toEqual(["a1"]);
    await saveProfile(u, input({ minutesPerDay: 90 }), TODAY);
    const plan = await currentPlan(u);
    expect(plan?.version).toBe(3);
    expect(plan?.adjustments.map((a) => a.id)).toEqual(["a1"]);
  });

  it("endPlan marks the profile ended", async () => {
    const u = user();
    await saveProfile(u, input(), TODAY);
    expect(await endPlan(u)).toEqual({ ok: true });
    expect((await getProfile(u))?.status).toBe("ended");
  });

  it("marks current unknown when no overall band is given", async () => {
    const u = user();
    await saveProfile(u, input({ current: {} }), TODAY);
    const plan = await IeltsPlan.findOne({ userId: u }).lean<{ inputs: { currentUnknown: boolean } }>();
    expect(plan?.inputs.currentUnknown).toBe(true);
  });
});

describe("ielts settings", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("returns defaults, saves, and rejects a split not summing to 100", async () => {
    const d = await getIeltsSettings();
    expect(d.hoursPerBand).toBe(200);
    expect(d.split).toEqual({ foundation: 30, skills: 45, mocks: 25 });
    const bad = await saveIeltsSettings({ hoursPerBand: 200, split: { foundation: 30, skills: 45, mocks: 24 } });
    expect(bad.ok).toBe(false);
    const good = await saveIeltsSettings({ hoursPerBand: 150, split: { foundation: 20, skills: 50, mocks: 30 } });
    expect(good.ok).toBe(true);
    const s = await getIeltsSettings();
    expect(s.hoursPerBand).toBe(150);
    expect(s.split.mocks).toBe(30);
    expect(s.thresholds.missedShare).toBe(0.6);
  });
});
