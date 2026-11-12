import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsPlan, IeltsPlanSuggestion, IeltsProfile, IeltsSpeakingAttempt, SpeakingTake } from "@/models";
import type { Criterion } from "@/ielts/bands";
import { currentPlan, getProfile, previewPlan, previewProfile, saveProfile, toPlanInputs, type ProfileInput } from "@/ielts/profile";
import { logStudy } from "@/ielts/progress";
import {
  approveSuggestion,
  dismissSuggestion,
  listPending,
  removeAdjustment,
  runChecks,
  suggestCurrentBand,
} from "@/ielts/suggestions";
import { addDays } from "@/speaking/schedule";
import { resetDb } from "../setup/mongo";

const TODAY = "2026-11-11";
const TZ = "UTC";
const WEEK1 = addDays(TODAY, 7);
const user = () => String(new Types.ObjectId());

const base: ProfileInput = {
  testDate: addDays(TODAY, 60),
  target: { overall: 7, speaking: 7 },
  current: { overall: 6 },
  minutesPerDay: 60,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
};

async function setup(over: Partial<ProfileInput> = {}) {
  const u = user();
  const res = await saveProfile(u, { ...base, ...over }, TODAY);
  expect(res.ok).toBe(true);
  await IeltsProfile.collection.updateOne({ userId: new Types.ObjectId(u) }, { $set: { createdAt: new Date(`${TODAY}T00:00:00Z`) } });
  return u;
}

const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

/** Week 0 at 40 % of its target, checked at the start of week 1. */
async function missedWeek() {
  const u = await setup();
  const plan = (await currentPlan(u))!;
  const target = total(plan.weeks[0].minutes);
  await logStudy(u, { date: TODAY, skill: "reading", minutes: Math.round(target * 0.4) });
  return { u, target, done: Math.round(target * 0.4) };
}

type Bands = Record<Criterion, number>;
const mock = (u: string, date: string, self: Bands, ai?: Bands) =>
  IeltsSpeakingAttempt.create({ userId: u, date, kind: "mock", status: "complete", self, ...(ai ? { ai: { bands: ai } } : {}) });

const pending = (u: string) => IeltsPlanSuggestion.find({ userId: u, status: "pending" }).lean<{ kind: string; proposal: Record<string, unknown> }[]>();

describe("ielts suggestions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("missed after a 40 % week", async () => {
    const { u, target, done } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    const list = await listPending(u, WEEK1);
    expect(list.map((s) => s.kind)).toEqual(["missed"]);
    const [s] = await pending(u);
    expect(s.proposal).toMatchObject({ adjustment: { kind: "spreadShortfall", minutes: target - done, fromWeek: 1 } });
    expect(list[0].reason).toContain("40 %");
    // The preview carries the spread minutes; the plan itself is unchanged.
    const { before, after, dropped } = list[0].preview;
    expect(before.version).toBe(1);
    expect(after.adjustments.map((a) => a.kind)).toEqual(["spreadShortfall"]);
    expect(dropped).toEqual([]);
    expect(after.weeks.slice(1).reduce((n, w) => n + total(w.minutes), 0)).toBeGreaterThan(
      before.weeks.slice(2).reduce((n, w) => n + total(w.minutes), 0),
    );
  });

  it("missed raises minutes per day when spreading would overload a day", async () => {
    const u = await setup({ testDate: addDays(TODAY, 21) });
    // Nothing done in week 0 (420 min). Spread over the one week after this it would put 120 min
    // on each day (> 90), so instead: (14 days × 60 + 420) / 14 study days left = 90 a day.
    await runChecks(u, WEEK1, TZ);
    const [s] = await pending(u);
    expect(s.kind).toBe("missed");
    expect(s.proposal).toEqual({ inputs: { minutesPerDay: 90 } });
    const id = (await listPending(u, WEEK1))[0].id;
    expect((await approveSuggestion(u, id, WEEK1)).ok).toBe(true);
    expect((await getProfile(u))!.minutesPerDay).toBe(90);
  });

  it("a failed plan write leaves the profile and suggestion unchanged", async () => {
    const u = await setup({ testDate: addDays(TODAY, 21) });
    await runChecks(u, WEEK1, TZ);
    const [s] = await listPending(u, WEEK1);
    const spy = vi.spyOn(IeltsPlan, "create").mockRejectedValueOnce(new Error("write failed"));
    await expect(approveSuggestion(u, s.id, WEEK1)).rejects.toThrow("write failed");
    spy.mockRestore();
    expect((await getProfile(u))!.minutesPerDay).toBe(60);
    expect((await pending(u)).map((p) => p.kind)).toEqual(["missed"]);
    expect((await currentPlan(u))!.version).toBe(1);
  });

  it("an approved shortfall is not spread again on a later rebuild", async () => {
    const { u } = await missedWeek();
    const low = { fluency: 5, lexical: 5, grammar: 5, pronunciation: 5 };
    await mock(u, TODAY, low, low);
    await mock(u, addDays(TODAY, 1), low, low);
    await runChecks(u, WEEK1, TZ);
    for (const s of await listPending(u, WEEK1)) expect((await approveSuggestion(u, s.id, WEEK1)).ok).toBe(true);
    const plan = (await currentPlan(u))!;
    expect(plan.adjustments.map((a) => a.kind).sort()).toEqual(["shiftCriterion", "spreadShortfall"]);
    const shift = plan.adjustments.find((a) => a.kind === "shiftCriterion")!;
    const spread = plan.adjustments.find((a) => a.kind === "spreadShortfall")!;

    const next = addDays(WEEK1, 1);
    const preview = await previewPlan(u, toPlanInputs((await getProfile(u))!, next), plan.adjustments.map((a) => ({ ...a, createdAt: new Date(a.createdAt) })), "x");
    expect(preview.dropped.map((a) => a.id)).toEqual([spread.id]);
    expect((await removeAdjustment(u, shift.id, next)).ok).toBe(true);
    const after = (await currentPlan(u))!;
    expect(after.adjustments).toEqual([]);
    // 52 study days left at 60 min, with nothing extra.
    expect(after.weeks.reduce((n, w) => n + total(w.minutes), 0)).toBe(52 * 60);
  });

  it("missed after 3 study days in a row with nothing done", async () => {
    const u = await setup();
    await runChecks(u, addDays(TODAY, 3), TZ);
    expect((await pending(u)).map((s) => s.kind)).toEqual(["missed"]);
    const other = await setup();
    await logStudy(other, { date: addDays(TODAY, 1), skill: "reading", minutes: 10 });
    await runChecks(other, addDays(TODAY, 3), TZ);
    expect(await pending(other)).toEqual([]);
  });

  it("no duplicate on second run same day", async () => {
    const { u } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    await runChecks(u, WEEK1, TZ);
    expect(await pending(u)).toHaveLength(1);
    // A later day still adds none while one of the kind is pending.
    await runChecks(u, addDays(WEEK1, 1), TZ);
    expect(await pending(u)).toHaveLength(1);
  });

  it("dismissed kind silent 7 days", async () => {
    const { u } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    const [s] = await listPending(u, WEEK1);
    expect((await dismissSuggestion(u, s.id)).ok).toBe(true);
    await IeltsPlanSuggestion.updateOne({ _id: s.id }, { $set: { decidedAt: new Date(`${WEEK1}T12:00:00Z`) } });
    await runChecks(u, addDays(WEEK1, 6), TZ);
    expect(await pending(u)).toHaveLength(0);
    await runChecks(u, addDays(WEEK1, 8), TZ);
    expect((await pending(u)).map((p) => p.kind)).toEqual(["missed"]);
  });

  it("check never creates a plan version", async () => {
    const { u } = await missedWeek();
    const low = { fluency: 5, lexical: 5, grammar: 5, pronunciation: 5 };
    await mock(u, TODAY, low, low);
    await mock(u, addDays(TODAY, 1), low, low);
    const before = await IeltsPlan.countDocuments({ userId: u });
    await runChecks(u, WEEK1, TZ);
    expect((await pending(u)).length).toBeGreaterThan(1);
    expect(await IeltsPlan.countDocuments({ userId: u })).toBe(before);
    await listPending(u, WEEK1);
    expect(await IeltsPlan.countDocuments({ userId: u })).toBe(before);
  });

  it("approve writes version with adjustment", async () => {
    const { u, target, done } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    const [s] = await listPending(u, WEEK1);
    const res = await approveSuggestion(u, s.id, WEEK1);
    expect(res).toEqual({ ok: true, version: 2 });
    const plan = (await currentPlan(u))!;
    expect(plan.version).toBe(2);
    expect(plan.adjustments).toEqual([expect.objectContaining({ kind: "spreadShortfall", minutes: target - done, fromWeek: 1 })]);
    expect(plan.weeks.map((w) => w.minutes)).toEqual(s.preview.after.weeks.map((w) => w.minutes));
    expect(await listPending(u, WEEK1)).toEqual([]);
    expect((await approveSuggestion(u, s.id, WEEK1)).ok).toBe(false);
    expect((await approveSuggestion(user(), s.id, WEEK1)).ok).toBe(false);
    expect((await dismissSuggestion(u, "nope")).ok).toBe(false);
  });

  it("removeAdjustment writes a version without it", async () => {
    const { u } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    const [s] = await listPending(u, WEEK1);
    await approveSuggestion(u, s.id, WEEK1);
    const [adj] = (await currentPlan(u))!.adjustments;
    expect((await removeAdjustment(u, "missing", WEEK1)).ok).toBe(false);
    expect((await removeAdjustment(u, adj.id, WEEK1)).ok).toBe(true);
    const plan = (await currentPlan(u))!;
    expect(plan.version).toBe(3);
    expect(plan.adjustments).toEqual([]);
  });

  it("weak uses min(self, AI) and ignores pronunciation unless self flags it", async () => {
    const u = await setup();
    // Target 7, so weak means 6 or lower in both mocks. Fluency: self 7, AI 6 → 6 (weak).
    // Pronunciation: AI 5 but self 7 → ignored. Lexical weak in one mock only.
    await mock(u, TODAY, { fluency: 7, lexical: 6, grammar: 7, pronunciation: 7 }, { fluency: 6, lexical: 7, grammar: 7, pronunciation: 5 });
    await mock(u, TODAY, { fluency: 6, lexical: 7, grammar: 7, pronunciation: 7 }, { fluency: 7, lexical: 7, grammar: 7, pronunciation: 5 });
    await runChecks(u, TODAY, TZ);
    const list = await pending(u);
    expect(list.map((s) => s.kind)).toEqual(["weak"]);
    expect(list[0].proposal).toEqual({ adjustment: { kind: "shiftCriterion", criterion: "fluency", share: 0.15 } });

    const v = await setup();
    await mock(v, TODAY, { fluency: 7, lexical: 7, grammar: 7, pronunciation: 6 }, { fluency: 7, lexical: 7, grammar: 7, pronunciation: 5 });
    await mock(v, TODAY, { fluency: 7, lexical: 7, grammar: 7, pronunciation: 6 }, { fluency: 6, lexical: 7, grammar: 7, pronunciation: 5 });
    await runChecks(v, TODAY, TZ);
    expect((await pending(v))[0].proposal).toMatchObject({ adjustment: { criterion: "pronunciation" } });

    const w = await setup();
    await mock(w, TODAY, { fluency: 7, lexical: 7, grammar: 7, pronunciation: 7 }, { fluency: 6, lexical: 7, grammar: 7, pronunciation: 7 });
    await runChecks(w, TODAY, TZ);
    expect(await pending(w)).toEqual([]); // only one mock
  });

  it("drops stale spreadShortfall on rebuild", async () => {
    const { u } = await missedWeek();
    await runChecks(u, WEEK1, TZ);
    const [s] = await listPending(u, WEEK1);
    await approveSuggestion(u, s.id, WEEK1);
    const edit = { ...base, testDate: addDays(WEEK1, 7) };
    const preview = await previewProfile(u, edit, WEEK1);
    if (!preview.ok) throw new Error("preview failed");
    expect(preview.dropped).toEqual([expect.objectContaining({ kind: "spreadShortfall" })]);
    expect(preview.after.adjustments).toEqual([]);
    expect((await saveProfile(u, edit, WEEK1)).ok).toBe(true);
    expect((await currentPlan(u))!.adjustments).toEqual([]);
  });

  it("hoursShort only on the transition from OK to short", async () => {
    // 201 study days at 1 h for a 200 h gap: OK until two days have passed.
    const u = await setup({ testDate: addDays(TODAY, 201) });
    await logStudy(u, { date: TODAY, skill: "reading", minutes: 60 });
    await runChecks(u, addDays(TODAY, 1), TZ);
    expect(await pending(u)).toEqual([]);
    await runChecks(u, addDays(TODAY, 2), TZ);
    const list = await listPending(u, addDays(TODAY, 2));
    expect(list.map((s) => s.kind)).toEqual(["hoursShort"]);
    expect(list[0].preview.after).toEqual(list[0].preview.before);
    expect(await approveSuggestion(u, list[0].id, addDays(TODAY, 2))).toEqual({ ok: true, version: 1 });
  });

  it("phase change when a skill-building mock is near target", async () => {
    const u = await setup();
    const plan = (await currentPlan(u))!;
    const skills = plan.phases.find((p) => p.name === "skills")!;
    const good = { fluency: 7, lexical: 6, grammar: 7, pronunciation: 7 };
    await mock(u, skills.start, good, good);
    await runChecks(u, skills.start, TZ);
    const phase = (await listPending(u, skills.start)).find((s) => s.kind === "phase")!;
    expect(phase.reason).toContain(plan.phases.find((p) => p.name === "mocks")!.start);
    expect(await approveSuggestion(u, phase.id, skills.start)).toEqual({ ok: true, version: 1 });
    // The same mock doesn't raise it again.
    await runChecks(u, addDays(skills.start, 1), TZ);
    expect((await pending(u)).some((s) => s.kind === "phase")).toBe(false);
  });

  it("currentBand from official result", async () => {
    const u = await setup();
    await suggestCurrentBand(u, "official", { listening: 7, reading: 7.5, writing: 6, speaking: 6.5, overall: 7 }, TODAY);
    const [s] = await listPending(u, TODAY);
    expect(s.kind).toBe("currentBand");
    expect(s.preview.after.hours.needed).toBe(0);
    expect((await approveSuggestion(u, s.id, TODAY)).ok).toBe(true);
    expect((await getProfile(u))!.current).toEqual({ overall: 7, listening: 7, reading: 7.5, writing: 6, speaking: 6.5 });
    expect((await currentPlan(u))!.version).toBe(2);
  });

  it("currentBand from mocks only when 0.5 or more away", async () => {
    const u = await setup({ current: { overall: 6, speaking: 6 } });
    await suggestCurrentBand(u, "mocks", { speaking: 6 }, TODAY);
    expect(await pending(u)).toEqual([]);
    await suggestCurrentBand(u, "mocks", { speaking: 6.5 }, TODAY);
    expect((await pending(u))[0].proposal).toEqual({ inputs: { current: { speaking: 6.5 } } });
  });

  it("currentBand from mocks is raised once even when two saves race", async () => {
    const u = await setup({ current: { overall: 6, speaking: 6 } });
    await IeltsPlanSuggestion.init();
    await Promise.all([suggestCurrentBand(u, "mocks", { speaking: 6.5 }, TODAY), suggestCurrentBand(u, "mocks", { speaking: 7 }, TODAY)]);
    expect((await pending(u)).filter((s) => s.kind === "currentBand")).toHaveLength(1);
  });

  it("currentBand approve keeps a band edited after the suggestion", async () => {
    const u = await setup({ current: { overall: 6, speaking: 6 } });
    await suggestCurrentBand(u, "mocks", { speaking: 6.5 }, TODAY);
    expect((await saveProfile(u, { ...base, current: { overall: 6, speaking: 6, listening: 7 } }, TODAY)).ok).toBe(true);
    const [s] = await listPending(u, TODAY);
    expect(s.preview.after.version).toBe(3);
    expect((await approveSuggestion(u, s.id, TODAY)).ok).toBe(true);
    expect((await getProfile(u))!.current).toEqual({ overall: 6, speaking: 6.5, listening: 7 });
  });

  it("Speaking Practice takes break a zero-day streak", async () => {
    const u = await setup();
    for (let i = 0; i < 3; i++) {
      await SpeakingTake.create({
        userId: u,
        date: addDays(TODAY, i),
        task: "readAloud",
        media: { kind: "audio", key: "k", mime: "audio/webm", durationSec: 60, capSec: 420, stored: true },
      });
    }
    await runChecks(u, addDays(TODAY, 3), TZ);
    expect(await pending(u)).toEqual([]);
  });
});
