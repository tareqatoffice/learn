import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import {
  IeltsBandEntry,
  IeltsPlan,
  IeltsPlanSuggestion,
  IeltsProfile,
  IeltsSettings,
  IeltsSpeakingAttempt,
  IeltsSpeakingItem,
  IeltsStudyLog,
} from "@/models";
import { resetDb } from "../setup/mongo";

beforeAll(async () => {
  await connectDb();
  for (const m of [IeltsProfile, IeltsPlan, IeltsPlanSuggestion, IeltsStudyLog, IeltsBandEntry, IeltsSpeakingItem, IeltsSpeakingAttempt, IeltsSettings]) await m.init();
});
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const userId = new Types.ObjectId();
const profile = () => ({ userId, testDate: "2027-03-01", target: { overall: 7 }, minutesPerDay: 60, studyDays: [1, 2, 3] });

describe("IELTS models", () => {
  it("rejects a second profile for the same user and applies defaults", async () => {
    const p = await IeltsProfile.create(profile());
    expect(p.status).toBe("active");
    expect(p.examinerVoice).toBe(true);
    expect(p.mockVideo).toBe(true);
    expect(p.drillVideo).toBe(false);
    await expect(IeltsProfile.create(profile())).rejects.toThrow(/duplicate key/);
  });

  it("rejects a duplicate plan version per user", async () => {
    const plan = (version: number, uid = userId) => ({
      userId: uid, version, startDate: "2026-11-11", testDate: "2027-03-01", reason: "initial",
      hours: { needed: 100, available: 90, short: true },
    });
    await IeltsPlan.create(plan(1));
    await expect(IeltsPlan.create(plan(1))).rejects.toThrow(/duplicate key/);
    await IeltsPlan.create(plan(2));
    await IeltsPlan.create(plan(1, new Types.ObjectId()));
  });

  it("saves and reads an attempt with an embedded media part", async () => {
    const a = await IeltsSpeakingAttempt.create({
      userId, date: "2026-11-11", kind: "mock",
      parts: [{
        part: "p1",
        media: { kind: "audio", key: "ielts/u/a/p1.webm", mime: "audio/webm", durationSec: 30, capSec: 420 },
        markers: [{ atSec: 5, label: "x" }],
      }],
      self: { fluency: 6, lexical: 6, grammar: 6, pronunciation: 6 },
    });
    const back = await IeltsSpeakingAttempt.findById(a._id).lean<{ status: string; parts: { media: { key: string; stored: boolean }; transcriptStatus: string }[] }>();
    expect(back!.status).toBe("inProgress");
    expect(back!.parts[0].media.key).toBe("ielts/u/a/p1.webm");
    expect(back!.parts[0].media.stored).toBe(false);
    expect(back!.parts[0].transcriptStatus).toBe("none");
  });

  it("validates enums and ranges", async () => {
    await expect(IeltsStudyLog.create({ userId, date: "2026-11-11", skill: "reading", minutes: 0 })).rejects.toThrow();
    await expect(IeltsStudyLog.create({ userId, date: "2026-11-11", skill: "reading", minutes: 481 })).rejects.toThrow();
    await IeltsStudyLog.create({ userId, date: "2026-11-11", skill: "reading", minutes: 30 });
    await expect(IeltsBandEntry.create({ userId, date: "2026-11-11", source: "bogus" })).rejects.toThrow();
    await IeltsBandEntry.create({ userId, date: "2026-11-11", source: "official", bands: { speaking: 6.5 } });
    const s = await IeltsPlanSuggestion.create({ userId, kind: "missed", reason: "r", forDate: "2026-11-11" });
    expect(s.status).toBe("pending");
    await IeltsSpeakingItem.create({ type: "part1", title: "Hometown", questions: ["Where?"] });
  });

  it("has singleton settings defaults", async () => {
    const s = await IeltsSettings.create({});
    expect(s.key).toBe("default");
    expect(s.hoursPerBand).toBe(200);
    expect(s.split.toObject()).toEqual({ foundation: 30, skills: 45, mocks: 25 });
    expect(s.thresholds.dismissDays).toBe(7);
    await expect(IeltsSettings.create({})).rejects.toThrow(/duplicate key/);
  });
});
