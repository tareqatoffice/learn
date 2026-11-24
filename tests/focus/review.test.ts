import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: async () => (await import("../setup/session")).approvedSession(session.userId),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "UTC" }) }) }));

import * as actions from "@/app/(app)/focus-actions";
import { weekStartOf } from "@/features/focus/habit";
import { getFocusPlan, getFocusReview, saveFocusPlan, saveWeeklyReview } from "@/features/focus/review";
import { addDays, localDate } from "@/features/speaking/schedule";
import { connectDb } from "@/lib/db";
import { FocusPlan, FocusReview, FocusSession } from "@/models";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const today = () => localDate(new Date(), "UTC");
const thisWeek = () => weekStartOf(today());
const answers = { helped: "Phone in another room", pulledAway: "Messages", change: "Mute notifications" };
const plan = { time: "19:00", action: "sit at my desk and read", minutes: 25, enabled: true };

async function session_(userId: string, date: string, over: Record<string, unknown> = {}) {
  await FocusSession.create({
    userId,
    runId: id(),
    startedAt: new Date(`${date}T09:00:00Z`),
    date,
    area: "notes",
    label: "Channels",
    path: "/notes/go/channels",
    seconds: 900,
    ...over,
  });
}

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  session.userId = null;
});
afterAll(() => mongoose.disconnect());

describe("saveWeeklyReview", () => {
  it("saves this week's answers and updates them in place", async () => {
    const me = id();
    expect((await saveWeeklyReview(me, thisWeek(), answers, { today: today() })).ok).toBe(true);
    expect((await saveWeeklyReview(me, thisWeek(), { ...answers, change: "Sleep earlier" }, { today: today() })).ok).toBe(true);
    expect((await saveWeeklyReview(id(), thisWeek(), answers, { today: today() })).ok).toBe(true);

    expect(await FocusReview.countDocuments()).toBe(2);
    const doc = await FocusReview.findOne({ userId: me }).lean<{ change: string }>();
    expect(doc?.change).toBe("Sleep earlier");
  });

  it("allows last week but no other week, bad dates or oversized answers", async () => {
    const me = id();
    const opts = { today: today() };
    expect((await saveWeeklyReview(me, addDays(thisWeek(), -7), answers, opts)).ok).toBe(true);
    expect((await saveWeeklyReview(me, addDays(thisWeek(), -14), answers, opts)).ok).toBe(false);
    expect((await saveWeeklyReview(me, addDays(thisWeek(), 7), answers, opts)).ok).toBe(false);
    expect((await saveWeeklyReview(me, addDays(thisWeek(), 1), answers, opts)).ok).toBe(false);
    expect((await saveWeeklyReview(me, "not-a-date", answers, opts)).ok).toBe(false);
    expect((await saveWeeklyReview(me, thisWeek(), { ...answers, helped: "x".repeat(501) }, opts)).ok).toBe(false);
    expect(await FocusReview.countDocuments()).toBe(1);
  });
});

describe("saveFocusPlan", () => {
  it("keeps one plan per user and updates it", async () => {
    const me = id();
    expect((await saveFocusPlan(me, plan)).ok).toBe(true);
    expect((await saveFocusPlan(me, { ...plan, time: "07:30", enabled: false })).ok).toBe(true);
    expect((await saveFocusPlan(id(), plan)).ok).toBe(true);

    expect(await FocusPlan.countDocuments()).toBe(2);
    expect(await getFocusPlan(me)).toEqual({ ...plan, time: "07:30", enabled: false });
    expect(await getFocusPlan(id())).toBeNull();
  });

  it("rejects an invalid time, action or length", async () => {
    const me = id();
    for (const bad of [
      { ...plan, time: "25:00" },
      { ...plan, time: "7:30" },
      { ...plan, action: "   " },
      { ...plan, action: "x".repeat(161) },
      { ...plan, minutes: 4 },
      { ...plan, minutes: 241 },
      { ...plan, minutes: 25.5 },
    ]) {
      expect((await saveFocusPlan(me, bad)).ok).toBe(false);
    }
    expect(await FocusPlan.countDocuments()).toBe(0);
  });
});

describe("getFocusReview", () => {
  it("builds the week summary, streak, block suggestion, answers and plan for one user", async () => {
    const me = id();
    const t = today();
    for (let i = 0; i < 3; i++) {
      await session_(me, t, { completed: true, targetMinutes: 25, rating: 4, distraction: "phone", drifts: 1 });
    }
    await session_(me, addDays(t, -1));
    await session_(id(), t, { seconds: 5000 });
    await saveWeeklyReview(me, thisWeek(), answers, { today: t });
    await saveFocusPlan(me, plan);

    const d = await getFocusReview(me, t, thisWeek());
    expect(d.isCurrentWeek).toBe(true);
    expect(d.summary.sessions).toBeGreaterThanOrEqual(3);
    expect(d.summary.days.find((day) => day.date === t)?.seconds).toBe(2700);
    expect(d.summary.avgRating).toBe(4);
    expect(d.summary.topDistraction).toBe("phone");
    expect(d.streak).toMatchObject({ days: 2, alive: true, doneToday: true });
    expect(d.block).toMatchObject({ minutes: 30, direction: "up" });
    expect(d.answers).toEqual(answers);
    expect(d.plan).toEqual(plan);
  });

  it("is empty for a new user and flags past weeks", async () => {
    const d = await getFocusReview(id(), today(), addDays(thisWeek(), -7));
    expect(d.isCurrentWeek).toBe(false);
    expect(d.summary).toMatchObject({ totalSeconds: 0, sessions: 0, avgRating: null });
    expect(d.streak.alive).toBe(false);
    expect(d.block.minutes).toBe(25);
    expect(d.answers).toBeNull();
    expect(d.plan).toBeNull();
  });
});

describe("focus review actions", () => {
  it("use the session user and today's date", async () => {
    const me = id();
    session.userId = me;
    expect((await actions.saveWeeklyReviewAction(thisWeek(), answers)).ok).toBe(true);
    expect((await actions.saveWeeklyReviewAction(addDays(thisWeek(), -21), answers)).ok).toBe(false);
    expect((await actions.saveFocusPlanAction(plan)).ok).toBe(true);
    expect(String((await FocusReview.findOne().lean<{ userId: Types.ObjectId }>())?.userId)).toBe(me);
    expect(String((await FocusPlan.findOne().lean<{ userId: Types.ObjectId }>())?.userId)).toBe(me);
  });

  it("need a signed-in user", async () => {
    await expect(actions.saveWeeklyReviewAction(thisWeek(), answers)).rejects.toThrow();
    await expect(actions.saveFocusPlanAction(plan)).rejects.toThrow();
  });
});
