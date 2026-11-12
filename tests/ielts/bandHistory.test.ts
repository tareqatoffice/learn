import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsPlanSuggestion } from "@/models";
import { deleteBandEntry, listBandEntries, saveCalculatorResult, writeMockEntries } from "@/ielts/bandHistory";
import { saveProfile, type ProfileInput } from "@/ielts/profile";
import { addDays } from "@/speaking/schedule";
import { resetDb } from "../setup/mongo";

const TODAY = "2026-11-11";
const user = () => String(new Types.ObjectId());

const profile: ProfileInput = {
  testDate: addDays(TODAY, 60),
  target: { overall: 7, speaking: 7 },
  current: { overall: 6 },
  minutesPerDay: 60,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
};

describe("ielts band history", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("stores bands from raw scores and computes the overall when all four are given", async () => {
    const u = user();
    const res = await saveCalculatorResult(u, { date: TODAY, source: "practice", listeningRaw: 30, readingRaw: 33, writing: 6, speaking: 6.5 }, TODAY);
    expect(res.ok).toBe(true);
    const [e] = await listBandEntries(u);
    expect(e.bands).toEqual({ listening: 7, reading: 7.5, writing: 6, speaking: 6.5 });
    expect(e.overall).toBe(7);
  });

  it("gives no overall for three skills", async () => {
    const u = user();
    await saveCalculatorResult(u, { date: TODAY, source: "practice", listeningRaw: 30, readingRaw: 33, writing: 6 }, TODAY);
    const [e] = await listBandEntries(u);
    expect(e.overall).toBeUndefined();
  });

  it("validates input with field-keyed errors", async () => {
    const u = user();
    const bad = await saveCalculatorResult(u, { date: addDays(TODAY, 1), source: "practice", listeningRaw: 41, writing: 6.25 }, TODAY);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["date", "listeningRaw", "writing"]);
    const none = await saveCalculatorResult(u, { date: TODAY, source: "other" }, TODAY);
    expect(none.ok).toBe(false);
    expect(await listBandEntries(u)).toHaveLength(0);
  });

  it("an official entry creates a currentBand suggestion", async () => {
    const u = user();
    await saveProfile(u, profile, TODAY);
    await saveCalculatorResult(u, { date: TODAY, source: "official", listeningRaw: 35, readingRaw: 35, writing: 7, speaking: 7 }, TODAY);
    const s = await IeltsPlanSuggestion.find({ userId: u, kind: "currentBand", status: "pending" }).lean();
    expect(s).toHaveLength(1);
  });

  it("writeMockEntries twice leaves 2 rows", async () => {
    const u = user();
    const attempt = String(new Types.ObjectId());
    await writeMockEntries(u, attempt, TODAY, 6.5, 6);
    await writeMockEntries(u, attempt, TODAY, 7, 6.5);
    const rows = await IeltsBandEntry.find({ userId: u }).lean();
    expect(rows).toHaveLength(2);
    const list = await listBandEntries(u);
    expect(list.find((r) => r.source === "mockSelf")?.bands.speaking).toBe(7);
    expect(list.find((r) => r.source === "mockAi")?.bands.speaking).toBe(6.5);
  });

  it("lists by date ascending, filtered by from, and deletes only calculator entries", async () => {
    const u = user();
    await saveCalculatorResult(u, { date: "2026-11-05", source: "practice", writing: 6 }, TODAY);
    await saveCalculatorResult(u, { date: "2026-11-01", source: "other", writing: 5 }, TODAY);
    await writeMockEntries(u, String(new Types.ObjectId()), "2026-11-08", 6);
    const all = await listBandEntries(u);
    expect(all.map((r) => r.date)).toEqual(["2026-11-01", "2026-11-05", "2026-11-08"]);
    expect(await listBandEntries(u, "2026-11-05")).toHaveLength(2);
    const refused = await deleteBandEntry(u, all[2].id);
    expect(refused.ok).toBe(false);
    expect((await deleteBandEntry(user(), all[0].id)).ok).toBe(false);
    expect((await deleteBandEntry(u, all[0].id)).ok).toBe(true);
    expect(await listBandEntries(u)).toHaveLength(2);
  });
});
