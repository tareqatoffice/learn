import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsProfile, IeltsSpeakingAttempt } from "@/models";
import { saveProfile } from "@/ielts/profile";
import { bandSeries, criteriaSeries, weeklyMinutes } from "@/ielts/history";
import { addDays, localDate } from "@/speaking/schedule";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());
const crit = (n: number) => ({ fluency: n, lexical: n, grammar: n, pronunciation: n });
const attempt = (u: string, date: string, over: Record<string, unknown> = {}) =>
  IeltsSpeakingAttempt.create({ userId: u, date, kind: "mock", status: "complete", parts: [], ...over });

describe("ielts history", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("bandSeries includes official as its own source", async () => {
    const u = user();
    await IeltsBandEntry.create({ userId: u, date: "2026-10-01", source: "practice", bands: { writing: 6 } });
    await IeltsBandEntry.create({ userId: u, date: "2026-10-20", source: "official", bands: { listening: 7, reading: 7, writing: 6.5, speaking: 7 }, overall: 7 });
    const rows = await bandSeries(u);
    expect(rows.map((r) => r.source)).toEqual(["practice", "official"]);
    expect(rows[1]).toMatchObject({ date: "2026-10-20", overall: 7, speaking: 7 });
    expect(rows[0].overall).toBeUndefined();
  });

  it("criteriaSeries excludes drills", async () => {
    const u = user();
    await attempt(u, "2026-11-01", { self: crit(6), ai: { bands: crit(5) } });
    await attempt(u, "2026-11-05", { kind: "part1", self: crit(7) });
    await attempt(u, "2026-11-06", { status: "incomplete", self: crit(7) });
    await attempt(u, "2026-11-08", { self: crit(7) });
    await attempt(u, "2026-11-09", { self: { fluency: 7 } });
    const rows = await criteriaSeries(u);
    expect(rows.map((r) => r.date)).toEqual(["2026-11-01", "2026-11-08"]);
    expect(rows[0].ai).toEqual(crit(5));
    expect(rows[1].ai).toBeUndefined();
  });

  it("weeklyMinutes gives target and done for weeks that have started", async () => {
    const u = user();
    const today = localDate(new Date(), "UTC");
    const res = await saveProfile(
      u,
      { testDate: addDays(today, 30), target: { overall: 7 }, current: { overall: 6 }, minutesPerDay: 60, studyDays: [0, 1, 2, 3, 4, 5, 6] },
      today,
    );
    expect(res.ok).toBe(true);
    await IeltsProfile.collection.updateOne({ userId: new Types.ObjectId(u) }, { $set: { createdAt: new Date(`${today}T00:00:00Z`) } });
    await attempt(u, today, { kind: "part1", parts: [{ part: "p1", media: { kind: "audio", key: "k", mime: "audio/webm", durationSec: 600, capSec: 420, stored: true } }] });
    const weeks = await weeklyMinutes(u, "UTC");
    expect(weeks).toHaveLength(1);
    expect(weeks[0].weekStart).toBe(today);
    expect(weeks[0].done.speaking).toBe(10);
    expect(weeks[0].target.speaking).toBeGreaterThan(0);
    expect(await weeklyMinutes(user(), "UTC")).toEqual([]);
  });
});
