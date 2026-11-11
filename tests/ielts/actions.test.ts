import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: () =>
    Promise.resolve(session.userId ? { user: { id: session.userId, email: "learner@example.test", name: "Learner" } } : null),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "UTC" }) }) }));
vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(),
  presignGet: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(async () => undefined),
  getObjectBytes: vi.fn(),
}));

import * as actions from "@/app/(app)/ielts/actions";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsPlanSuggestion, IeltsProfile, IeltsStudyLog } from "@/models";
import { getProfile, planHistory } from "@/ielts/profile";
import { addDays, localDate } from "@/speaking/schedule";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const today = localDate(new Date(), "UTC");
const profile = (over: Record<string, unknown> = {}) => ({
  testDate: addDays(today, 100),
  target: { overall: 7 },
  current: { overall: 6 },
  minutesPerDay: 60,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  ...over,
});

describe("ielts actions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });
  afterAll(() => mongoose.disconnect());

  it("saves the profile for the session user, ignoring a smuggled userId", async () => {
    const me = id();
    session.userId = me;
    const res = await actions.saveProfileAction({ ...profile(), userId: id() } as never);
    expect(res.ok).toBe(true);
    expect(await getProfile(me)).not.toBeNull();
    expect(await IeltsProfile.countDocuments()).toBe(1);
  });

  it("previews without writing", async () => {
    session.userId = id();
    const res = await actions.previewProfileAction(profile());
    expect(res.ok).toBe(true);
    expect(await IeltsProfile.countDocuments()).toBe(0);
  });

  it("another user's suggestion can't be approved or dismissed", async () => {
    const me = id();
    session.userId = me;
    await actions.saveProfileAction(profile());
    const theirs = await IeltsPlanSuggestion.create({ userId: id(), kind: "hoursShort", reason: "x", forDate: today });
    expect((await actions.approveSuggestionAction(String(theirs._id))).ok).toBe(false);
    expect((await actions.dismissSuggestionAction(String(theirs._id))).ok).toBe(false);
    expect((await IeltsPlanSuggestion.findById(theirs._id).lean<{ status: string }>())?.status).toBe("pending");
  });

  it("another user's band entry can't be deleted", async () => {
    session.userId = id();
    const theirs = await IeltsBandEntry.create({ userId: id(), date: today, source: "practice", bands: { writing: 6 } });
    expect((await actions.deleteBandEntryAction(String(theirs._id))).ok).toBe(false);
    expect(await IeltsBandEntry.countDocuments()).toBe(1);
  });

  it("saves a calculator result and logs study for the session user, dated by the learner's day", async () => {
    const me = id();
    session.userId = me;
    const saved = await actions.saveCalculatorResultAction({ date: today, source: "practice", listeningRaw: 30 });
    expect(saved.ok).toBe(true);
    expect(await IeltsBandEntry.countDocuments({ userId: me })).toBe(1);
    expect((await actions.logStudyAction("reading", 20)).ok).toBe(true);
    const log = await IeltsStudyLog.findOne({ userId: me }).lean<{ date: string; minutes: number }>();
    expect(log).toMatchObject({ date: today, minutes: 20 });
  });

  it("ends the plan and deletes all data for the session user only", async () => {
    const me = id();
    const other = id();
    session.userId = me;
    await actions.saveProfileAction(profile());
    await IeltsProfile.create({ userId: other, testDate: addDays(today, 50), target: { overall: 7 }, minutesPerDay: 30, studyDays: [1] });
    expect((await actions.endPlanAction()).ok).toBe(true);
    expect((await getProfile(me))?.status).toBe("ended");
    expect((await actions.deleteAllIeltsDataAction()).ok).toBe(true);
    expect(await getProfile(me)).toBeNull();
    expect(await IeltsProfile.countDocuments({ userId: other })).toBe(1);
  });

  it("lists plan versions newest first", async () => {
    const me = id();
    session.userId = me;
    await actions.saveProfileAction(profile());
    await actions.saveProfileAction(profile({ minutesPerDay: 90 }));
    const history = await planHistory(me);
    expect(history.map((h) => h.version)).toEqual([2, 1]);
    expect(history[0].reason).toBe("You changed your profile");
  });
});
