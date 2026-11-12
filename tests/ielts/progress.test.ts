import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsPlan, IeltsProfile, IeltsSpeakingAttempt, IeltsStudyLog, SpeakingTake } from "@/models";
import { addDays } from "@/speaking/schedule";
import { currentPlan, saveProfile } from "@/ielts/profile";
import { dailyMinutes, logStudy, todayList, weekProgress } from "@/ielts/progress";
import { resetDb } from "../setup/mongo";

const TODAY = "2026-11-11";
const TZ = "UTC";
const user = () => String(new Types.ObjectId());

async function setup(over: Record<string, unknown> = {}, days = 14) {
  const u = user();
  const res = await saveProfile(
    u,
    { testDate: addDays(TODAY, days), target: { overall: 7 }, current: { overall: 6 }, minutesPerDay: 60, studyDays: [0, 1, 2, 3, 4, 5, 6], ...over },
    TODAY,
  );
  expect(res.ok).toBe(true);
  // createdAt defaults to the real clock; pin it to the plan's start.
  await IeltsProfile.collection.updateOne({ userId: new Types.ObjectId(u) }, { $set: { createdAt: new Date(`${TODAY}T00:00:00Z`) } });
  const plan = (await currentPlan(u))!;
  return { u, plan };
}

const media = (sec: number, stored = true) => ({ kind: "audio", key: "k", mime: "audio/webm", durationSec: sec, capSec: 420, stored });
const attempt = (u: string, date: string, over: Record<string, unknown> = {}) =>
  IeltsSpeakingAttempt.create({ userId: u, date, kind: "part1", status: "complete", parts: [{ part: "p1", media: media(600) }], ...over });
const take = (u: string, date: string, sec: number, stored = true) =>
  SpeakingTake.create({ userId: u, date, task: "readAloud", media: media(sec, stored) });

describe("ielts progress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("late-evening attempt counts for local day", async () => {
    const { u, plan } = await setup();
    const a = await attempt(u, "2026-11-12");
    await IeltsSpeakingAttempt.collection.updateOne({ _id: a._id }, { $set: { createdAt: new Date("2026-11-13T01:30:00Z") } });
    const daily = await dailyMinutes(u, "2026-11-11", "2026-11-13");
    expect(daily["2026-11-12"].speaking).toBe(10);
    expect(daily["2026-11-13"].speaking).toBe(0);
    expect((await weekProgress(u, plan, 0, TZ)).done.speaking).toBe(10);
  });

  it("ignores unstored parts and sums stored ones", async () => {
    const { u } = await setup();
    await attempt(u, TODAY, { parts: [{ part: "p1", media: media(300) }, { part: "p2", media: media(300, false) }] });
    expect((await dailyMinutes(u, TODAY, TODAY))[TODAY].speaking).toBe(5);
  });

  it("practice minutes capped at 50 %", async () => {
    const { u, plan } = await setup();
    const target = plan.weeks[0].minutes.speaking;
    await take(u, TODAY, target * 60 * 3); // three times the target
    await attempt(u, TODAY, { parts: [{ part: "p1", media: media(120) }] }); // 2 min
    const p = await weekProgress(u, plan, 0, TZ);
    expect(p.fromPractice).toBeCloseTo(target / 2);
    expect(p.done.speaking).toBeCloseTo(2 + target / 2);
  });

  it("practice before profile creation ignored", async () => {
    const { u, plan } = await setup();
    await take(u, "2026-11-10", 600);
    await take(u, "2026-11-12", 600, false); // not stored
    const p = await weekProgress(u, plan, 0, TZ);
    expect(p.fromPractice).toBe(0);
    await take(u, "2026-11-12", 60);
    expect((await weekProgress(u, plan, 0, TZ)).fromPractice).toBe(1);
  });

  it("counts logged minutes and complete mocks", async () => {
    const { u, plan } = await setup();
    await logStudy(u, { date: TODAY, skill: "reading", minutes: 20 });
    await logStudy(u, { date: TODAY, skill: "reading", minutes: 10 });
    await attempt(u, TODAY, { kind: "mock" });
    await attempt(u, TODAY, { kind: "mock", status: "incomplete" });
    const p = await weekProgress(u, plan, 0, TZ);
    expect(p.done.reading).toBe(30);
    expect(p.mocksDone).toBe(1);
  });

  it("non-study day has empty list", async () => {
    const { u } = await setup({ studyDays: [1, 2, 3, 4, 5] }); // 2026-11-14 is a Saturday
    expect(await todayList(u, "2026-11-14", TZ)).toEqual([]);
    expect((await todayList(u, "2026-11-13", TZ)).length).toBeGreaterThan(0);
  });

  it("mock offered on first study day of a skills week", async () => {
    const { u, plan } = await setup();
    expect(plan.weeks[0].mocks).toBe(1);
    const list = await todayList(u, TODAY, TZ);
    const speaking = list.filter((i) => i.skill === "speaking");
    expect(speaking).toHaveLength(1);
    expect(speaking[0]).toMatchObject({ kind: "mock", href: "/ielts/speaking?start=mock", done: false });
    const others = list.filter((i) => i.skill !== "speaking");
    expect(others.every((i) => i.kind === "drill" && i.href === `/ielts/${i.skill}`)).toBe(true);
    expect(list.reduce((s, i) => s + i.minutes, 0)).toBeLessThanOrEqual(60);
    await attempt(u, TODAY, { kind: "mock" });
    expect((await todayList(u, TODAY, TZ)).find((i) => i.skill === "speaking")).toMatchObject({ kind: "mock", done: true });
    const next = await todayList(u, addDays(TODAY, 1), TZ);
    expect(next.find((i) => i.skill === "speaking")).toMatchObject({ kind: "drill", href: "/ielts/speaking" });
  });

  it("re-offers the first mock after a skipped first study day", async () => {
    const { u } = await setup();
    const day3 = addDays(TODAY, 2);
    expect((await todayList(u, day3, TZ)).find((i) => i.skill === "speaking")).toMatchObject({ kind: "mock", done: false });
  });

  it("a mock done on a later day ends the offer", async () => {
    const { u } = await setup();
    const day3 = addDays(TODAY, 2);
    await attempt(u, day3, { kind: "mock" });
    expect((await todayList(u, day3, TZ)).find((i) => i.skill === "speaking")).toMatchObject({ kind: "mock", done: true });
    expect((await todayList(u, addDays(day3, 1), TZ)).find((i) => i.skill === "speaking")?.kind).toBe("drill");
  });

  it("second mock waits 3 days after the first, then stays on offer", async () => {
    const { u, plan } = await setup();
    await IeltsPlan.updateOne({ userId: u, version: plan.version }, { $set: { "weeks.0.mocks": 2 } });
    await attempt(u, TODAY, { kind: "mock" });
    const kind = async (d: string) => (await todayList(u, d, TZ)).find((i) => i.skill === "speaking")?.kind;
    expect(await kind(addDays(TODAY, 1))).toBe("drill");
    expect(await kind(addDays(TODAY, 2))).toBe("drill");
    expect(await kind(addDays(TODAY, 3))).toBe("mock");
    expect(await kind(addDays(TODAY, 5))).toBe("mock");
  });

  describe("sizing", () => {
    const setWeek = (u: string, version: number, minutes: Record<string, number>, mocks = 0) =>
      IeltsPlan.updateOne({ userId: u, version }, { $set: { "weeks.0.minutes": minutes, "weeks.0.mocks": mocks } });

    it("rounds each item up to 5", async () => {
      const { u, plan } = await setup({ minutesPerDay: 480 });
      await setWeek(u, plan.version, { listening: 70, reading: 71, writing: 7, speaking: 70 });
      const list = await todayList(u, TODAY, TZ);
      const m = Object.fromEntries(list.map((i) => [i.skill, i.minutes]));
      expect(m).toEqual({ listening: 10, reading: 15, writing: 5, speaking: 10 });
    });

    it("scales proportionally, floors to 5 and stays within minutesPerDay", async () => {
      const { u, plan } = await setup({ minutesPerDay: 25 });
      await setWeek(u, plan.version, { listening: 140, reading: 70, writing: 70, speaking: 70 }); // wants 20/10/10/10 = 50
      const list = await todayList(u, TODAY, TZ);
      const m = Object.fromEntries(list.map((i) => [i.skill, i.minutes]));
      expect(m).toEqual({ listening: 10, reading: 5, writing: 5, speaking: 5 });
      expect(list.reduce((s, i) => s + i.minutes, 0)).toBeLessThanOrEqual(25);
    });

    it("counts a mock's minutes in the cap even when the speaking share is 0", async () => {
      const { u, plan } = await setup({ minutesPerDay: 30 });
      await setWeek(u, plan.version, { listening: 140, reading: 140, writing: 0, speaking: 0 }, 1); // wants 20/20/0 + 15
      const list = await todayList(u, TODAY, TZ);
      expect(list.find((i) => i.skill === "speaking")).toMatchObject({ kind: "mock" });
      expect(list.reduce((s, i) => s + i.minutes, 0)).toBeLessThanOrEqual(30);
    });

    it("omits a skill already complete for the week", async () => {
      const { u, plan } = await setup({ minutesPerDay: 480 });
      await setWeek(u, plan.version, { listening: 70, reading: 70, writing: 70, speaking: 70 });
      await logStudy(u, { date: TODAY, skill: "listening", minutes: 70 });
      const list = await todayList(u, addDays(TODAY, 1), TZ);
      expect(list.map((i) => i.skill)).toEqual(["reading", "writing", "speaking"]);
    });
  });

  it("profile cut-off uses the learner's local day", async () => {
    const { u, plan } = await setup();
    await IeltsPlan.updateOne({ userId: u, version: plan.version }, { $set: { "weeks.0.minutes.speaking": 140 } });
    // 23:30 UTC on the 12th is already the 13th in Dhaka (UTC+6).
    await IeltsProfile.collection.updateOne({ userId: new Types.ObjectId(u) }, { $set: { createdAt: new Date("2026-11-12T23:30:00Z") } });
    const week = { weeks: [{ ...plan.weeks[0], minutes: { ...plan.weeks[0].minutes, speaking: 140 } }] };
    await take(u, "2026-11-12", 60); // the UTC day: before the Dhaka cut-off
    expect((await weekProgress(u, week, 0, "Asia/Dhaka")).fromPractice).toBe(0);
    await take(u, "2026-11-13", 60);
    expect((await weekProgress(u, week, 0, "Asia/Dhaka")).fromPractice).toBe(1);
    expect((await weekProgress(u, week, 0, "UTC")).fromPractice).toBe(2); // UTC cut-off is the 12th
  });

  it("focus drill label", async () => {
    const { u, plan } = await setup();
    await IeltsPlan.updateOne({ userId: u, version: plan.version }, { $set: { "weeks.0.focus": "fluency", "weeks.0.mocks": 0 } });
    const item = (await todayList(u, TODAY, TZ)).find((i) => i.skill === "speaking")!;
    expect(item.kind).toBe("drill");
    expect(item.label).toContain("Fluency and Coherence");
  });

  it("log refuses speaking and bad values", async () => {
    const u = user();
    expect(await logStudy(u, { date: TODAY, skill: "speaking", minutes: 10 })).toEqual({ ok: false, errors: { _: "Speaking minutes come from your recordings." } });
    for (const bad of [{ minutes: 0 }, { minutes: 481 }, { minutes: 1.5 }, { date: "11/11/2026" }, { date: "2026-02-31" }, { skill: "cooking" }]) {
      const res = await logStudy(u, { date: TODAY, skill: "reading", minutes: 10, ...bad } as never);
      expect(res.ok).toBe(false);
    }
    expect(await IeltsStudyLog.countDocuments({ userId: u })).toBe(0);
    expect(await logStudy(u, { date: TODAY, skill: "reading", minutes: 10 })).toEqual({ ok: true });
    expect(await IeltsStudyLog.countDocuments({ userId: u })).toBe(1);
  });
});
