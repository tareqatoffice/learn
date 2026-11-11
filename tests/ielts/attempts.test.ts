import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  presignGet: vi.fn(async (key: string) => `https://r2.test/get/${key}`),
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/webm" })),
  getObjectBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
  deleteObjects: vi.fn(async () => undefined),
}));
vi.mock("@/lib/stt", async (orig) => ({ ...(await orig<typeof import("@/lib/stt")>()), sttConfigured: vi.fn(() => true) }));

import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import * as r2 from "@/lib/r2";
import {
  IeltsBandEntry,
  IeltsPlan,
  IeltsPlanSuggestion,
  IeltsProfile,
  IeltsSpeakingAttempt,
  IeltsSpeakingItem,
  IeltsStudyLog,
  SpeakingProfile,
  SpeakingTake,
  SpeakingUsage,
} from "@/models";
import { deleteAllIeltsData } from "@/ielts/data";
import {
  confirmPart,
  deleteAttempt,
  finishAttempt,
  getAttempt,
  listAttempts,
  startAttempt,
  startPart,
  transcribePart,
} from "@/ielts/speaking/attempts";
import { writeMockEntries } from "@/ielts/bandHistory";
import { TRANSCRIBE_LIMIT_MESSAGE } from "@/recording/transcribe";
import { resetDb } from "../setup/mongo";

const today = new Date().toISOString().slice(0, 10);
const user = () => String(new Types.ObjectId());
const AUDIO = { kind: "audio" as const, mime: "audio/webm", size: 1000 };
const SET = {
  part1: { itemIds: [], frames: [{ title: "Home", questions: ["Where do you live?"] }] },
  part2: { cue: { topic: "Describe a trip", bullets: ["where"], explain: "and explain why", roundOff: [] } },
  part3: { questions: ["Why travel?"] },
};

async function start(u: string, kind: "mock" | "part1" | "part2" | "part3" = "mock") {
  const res = await startAttempt(u, { kind, date: today, questions: SET, generated: true });
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.attemptId;
}
async function store(u: string, id: string, part: "p1" | "p2" | "p3", over: Record<string, unknown> = {}) {
  const s = await startPart(u, id, { part, ...AUDIO, ...over });
  if (!s.ok) throw new Error(JSON.stringify(s.errors));
  const c = await confirmPart(u, id, part, { durationSec: 30, markers: [] });
  if (!c.ok) throw new Error(JSON.stringify(c.errors));
  return s;
}

describe("ielts speaking attempts", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    vi.mocked(r2.storageConfigured).mockReturnValue(true);
    vi.mocked(r2.presignPut).mockImplementation(async (key: string) => `https://r2.test/put/${key}`);
    vi.mocked(r2.headObject).mockResolvedValue({ size: 1000, contentType: "audio/webm" });
  });
  afterEach(() => {
    delete process.env.STT_DAILY_LIMIT;
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("picks bank questions when none are given and validates the date", async () => {
    const u = user();
    const card = await IeltsSpeakingItem.create({
      type: "part2",
      title: "Trip",
      status: "published",
      cue: { topic: "Describe a trip", bullets: ["a", "b", "c"], explain: "and explain why", roundOff: [] },
    });
    const res = await startAttempt(u, { kind: "part2", date: today });
    expect(res.ok && String(res.questions.part2?.itemId)).toBe(String(card._id));
    expect((await startAttempt(u, { kind: "part2", date: "2020-01-01" })).ok).toBe(false);
    expect((await startAttempt(u, { kind: "nope" as never, date: today })).ok).toBe(false);
    expect((await startAttempt(u, { kind: "part1", date: today })).ok).toBe(false); // bank has no part1
    vi.mocked(r2.storageConfigured).mockReturnValue(false);
    expect(await startAttempt(u, { kind: "part2", date: today })).toEqual({
      ok: false,
      errors: { _: "Recording storage isn't set up yet." },
    });
  });

  it("rejects another user's attempt", async () => {
    const owner = user();
    const other = user();
    const id = await start(owner);
    await store(owner, id, "p1");
    expect(await startPart(other, id, { part: "p2", ...AUDIO })).toEqual({ ok: false, errors: { _: "Recording not found." } });
    expect((await confirmPart(other, id, "p1", { durationSec: 1, markers: [] })).ok).toBe(false);
    expect((await transcribePart(other, id, "p1")).ok).toBe(false);
    expect((await finishAttempt(other, id, { paused: false })).ok).toBe(false);
    expect((await deleteAttempt(other, id)).ok).toBe(false);
    expect(await getAttempt(other, id)).toBeNull();
    expect(await listAttempts(other, {})).toEqual([]);
    expect(await IeltsSpeakingAttempt.countDocuments({ _id: id })).toBe(1);
  });

  it("startPart refuses size over p2 cap", async () => {
    const u = user();
    const id = await start(u);
    const over = await startPart(u, id, { part: "p2", ...AUDIO, size: 150 * 8_000 + 1 });
    expect(over).toEqual({ ok: false, errors: { _: expect.stringMatching(/larger than the \d+ MB limit/) } });
    const p2 = await startPart(u, id, { part: "p2", ...AUDIO, size: 150 * 8_000 });
    expect(p2.ok && p2.maxBytes).toBe(1_200_000);
    const p1 = await startPart(u, id, { part: "p1", ...AUDIO, size: 150 * 8_000 + 1 });
    expect(p1.ok && p1.maxBytes).toBe(420 * 8_000);
  });

  it("refuses a part the kind doesn't have", async () => {
    const u = user();
    const id = await start(u, "part1");
    expect((await startPart(u, id, { part: "p2", ...AUDIO })).ok).toBe(false);
    expect((await startPart(u, id, { part: "p9" as never, ...AUDIO })).ok).toBe(false);
  });

  it("keys under ielts/<user>/<attempt>/p2", async () => {
    const u = user();
    const id = await start(u);
    const v = await startPart(u, id, { part: "p2", kind: "video", mime: "video/mp4", audioMime: "audio/mp4", size: 5000, audioSize: 1000 });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.uploadUrl).toBe(`https://r2.test/put/ielts/${u}/${id}/p2.mp4`);
    expect(v.audioUploadUrl).toBe(`https://r2.test/put/ielts/${u}/${id}/p2.audio.m4a`);
    const doc = await IeltsSpeakingAttempt.findById(id).lean<{ videoUsed: boolean; parts: { part: string; media: { key: string } }[] }>();
    expect(doc!.parts).toHaveLength(1);
    expect(doc!.parts[0].media.key).toBe(`ielts/${u}/${id}/p2.mp4`);
    expect(doc!.videoUsed).toBe(true);
  });

  it("startPart again replaces an unstored part's media and refuses a stored one", async () => {
    const u = user();
    const id = await start(u);
    await startPart(u, id, { part: "p1", kind: "video", mime: "video/webm", audioMime: "audio/webm", size: 5000, audioSize: 1000 });
    vi.mocked(r2.deleteObjects).mockClear();
    await startPart(u, id, { part: "p1", ...AUDIO });
    expect(r2.deleteObjects).toHaveBeenCalledWith([`ielts/${u}/${id}/p1.webm`, `ielts/${u}/${id}/p1.audio.webm`]);
    const doc = await IeltsSpeakingAttempt.findById(id).lean<{ parts: { media: { kind: string; audioKey?: string } }[] }>();
    expect(doc!.parts).toHaveLength(1);
    expect(doc!.parts[0].media.kind).toBe("audio");
    expect(doc!.parts[0].media.audioKey).toBeUndefined();

    await confirmPart(u, id, "p1", { durationSec: 10, markers: [] });
    expect(await startPart(u, id, { part: "p1", ...AUDIO })).toEqual({ ok: false, errors: { _: "This part is already saved." } });
  });

  /** Holds the first presign of each of two calls until both have read the attempt, forcing the race. */
  function gatePresign() {
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.mocked(r2.presignPut).mockImplementation(async (key: string) => {
      if (arrived < 2) {
        arrived++;
        if (arrived === 2) release();
        await gate;
      }
      return `https://r2.test/put/${key}`;
    });
  }
  const VIDEO_MP4 = { kind: "video" as const, mime: "video/mp4", audioMime: "audio/mp4", size: 5000, audioSize: 1000 };

  for (const replacing of [true, false]) {
    it(`concurrent startPart on the same ${replacing ? "unstored" : "new"} part lets exactly one win`, async () => {
      const u = user();
      const id = await start(u);
      if (replacing) await startPart(u, id, { part: "p1", kind: "video", mime: "video/webm", audioMime: "audio/webm", size: 5000, audioSize: 1000 });
      gatePresign();
      vi.mocked(r2.deleteObjects).mockClear();
      const results = await Promise.all([startPart(u, id, { part: "p1", ...AUDIO }), startPart(u, id, { part: "p1", ...VIDEO_MP4 })]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);

      const doc = await IeltsSpeakingAttempt.findById(id).lean<{ parts: { media: { key: string; audioKey?: string } }[] }>();
      expect(doc!.parts).toHaveLength(1);
      const winnerKeys = [doc!.parts[0].media.key, doc!.parts[0].media.audioKey].filter(Boolean);
      const loserKeys = results[0].ok ? [`ielts/${u}/${id}/p1.mp4`, `ielts/${u}/${id}/p1.audio.m4a`] : [`ielts/${u}/${id}/p1.webm`];
      expect(r2.deleteObjects).toHaveBeenCalledWith(loserKeys);
      for (const call of vi.mocked(r2.deleteObjects).mock.calls.slice(replacing ? 2 : 0)) {
        for (const k of winnerKeys) expect(call[0]).not.toContain(k);
      }
    });
  }

  it("a part confirmed after finish completes the attempt", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    await store(u, id, "p2");
    await startPart(u, id, { part: "p3", ...AUDIO });
    expect(await finishAttempt(u, id, { paused: false })).toEqual({ ok: true, status: "incomplete" });
    expect((await confirmPart(u, id, "p3", { durationSec: 20, markers: [] })).ok).toBe(true);
    expect((await getAttempt(u, id))!.status).toBe("complete");
  });

  it("confirmPart rejects missing object", async () => {
    const u = user();
    const id = await start(u);
    await startPart(u, id, { part: "p1", ...AUDIO });
    vi.mocked(r2.headObject).mockResolvedValue(null);
    const res = await confirmPart(u, id, "p1", { durationSec: 10, markers: [] });
    expect(res.ok).toBe(false);
    const doc = await IeltsSpeakingAttempt.findById(id).lean<{ parts: { media: { stored: boolean } }[] }>();
    expect(doc!.parts[0].media.stored).toBe(false);
    expect((await confirmPart(u, id, "p2", { durationSec: 10, markers: [] })).ok).toBe(false); // never started
  });

  it("confirmPart stores markers, caps duration, sets the transcript status and is idempotent", async () => {
    const u = user();
    const id = await start(u);
    await startPart(u, id, { part: "p2", ...AUDIO });
    const bad = [
      [{ atSec: 151, label: "Q1" }],
      [{ atSec: -1, label: "Q1" }],
      [{ atSec: Number.NaN, label: "Q1" }],
      [{ atSec: 1, label: "x".repeat(61) }],
      [{ atSec: 1, label: "  " }],
      Array.from({ length: 51 }, (_, i) => ({ atSec: i, label: `Q${i}` })),
    ];
    for (const markers of bad) expect((await confirmPart(u, id, "p2", { durationSec: 10, markers })).ok).toBe(false);
    expect((await confirmPart(u, id, "p2", { durationSec: -1, markers: [] })).ok).toBe(false);

    const res = await confirmPart(u, id, "p2", { durationSec: 999, markers: [{ atSec: 60, label: " keep going " }] });
    expect(res.ok).toBe(true);
    expect((await confirmPart(u, id, "p2", { durationSec: 5, markers: [] })).ok).toBe(true);
    const doc = await IeltsSpeakingAttempt.findById(id).lean<{
      parts: { media: { stored: boolean; durationSec: number; size: number }; transcriptStatus: string; markers: unknown[] }[];
    }>();
    const [p] = doc!.parts;
    expect(p.media).toMatchObject({ stored: true, durationSec: 150, size: 1000 });
    expect(p.transcriptStatus).toBe("pending");
    expect(p.markers).toEqual([{ atSec: 60, label: "keep going" }]);
  });

  it("finishAttempt marks incomplete when a part is unstored", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    await store(u, id, "p2");
    await startPart(u, id, { part: "p3", ...AUDIO });
    expect(await finishAttempt(u, id, { notes: "trip notes", paused: true })).toEqual({ ok: true, status: "incomplete" });
    const doc = await IeltsSpeakingAttempt.findById(id).lean<{ status: string; notes: string; paused: boolean }>();
    expect(doc).toMatchObject({ status: "incomplete", notes: "trip notes", paused: true });

    const drill = await start(u, "part2");
    await store(u, drill, "p2");
    expect(await finishAttempt(u, drill, { paused: false })).toEqual({ ok: true, status: "complete" });
  });

  it("transcribePart saves the transcript on the matching part", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    await store(u, id, "p2");
    const res = await transcribePart(u, id, "p2", { transcribe: vi.fn(async () => "a trip") });
    expect(res).toEqual({ ok: true, transcript: "a trip" });
    const view = await getAttempt(u, id);
    expect(view!.parts.map((p) => [p.part, p.transcriptStatus, p.transcript])).toEqual([
      ["p1", "pending", undefined],
      ["p2", "done", "a trip"],
    ]);
    expect((await transcribePart(u, id, "p2", { transcribe: vi.fn(async () => "x") })).ok).toBe(false); // already done
  });

  it("transcribePart counts against the shared cap", async () => {
    process.env.STT_DAILY_LIMIT = "1";
    resetEnvCache();
    const u = user();
    await SpeakingUsage.create({ userId: u, day: today, count: 1 }); // used by Speaking Practice
    const id = await start(u);
    await store(u, id, "p1");
    const stt = vi.fn(async () => "hello");
    expect(await transcribePart(u, id, "p1", { transcribe: stt })).toEqual({ ok: false, errors: { _: TRANSCRIBE_LIMIT_MESSAGE } });
    expect(stt).not.toHaveBeenCalled();
    await SpeakingUsage.deleteMany({});
    expect((await transcribePart(u, id, "p1", { transcribe: stt })).ok).toBe(true);
    expect((await SpeakingUsage.findOne({ userId: u, day: today }).lean<{ count: number }>())!.count).toBe(1);
  });

  it("transcribePart marks the part failed when STT throws", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await transcribePart(u, id, "p1", { transcribe: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    expect(res.ok).toBe(false);
    expect((await getAttempt(u, id))!.parts[0].transcriptStatus).toBe("failed");
  });

  it("getAttempt returns plain JSON with playback URLs only for stored parts", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    await startPart(u, id, { part: "p2", ...AUDIO });
    const view = await getAttempt(u, id);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(view).toMatchObject({ id, kind: "mock", status: "inProgress", generated: true, date: today });
    expect(view!.questions.part2?.cue.topic).toBe("Describe a trip");
    expect(view!.parts[0]).toMatchObject({ part: "p1", stored: true, mediaUrl: `https://r2.test/get/ielts/${u}/${id}/p1.webm` });
    expect(view!.parts[1].stored).toBe(false);
    expect(view!.parts[1].mediaUrl).toBeUndefined();
    expect(await getAttempt(u, "bad")).toBeNull();
  });

  it("listAttempts lists attempts with stored parts, newest first, by kind", async () => {
    const u = user();
    const mock = await start(u);
    await store(u, mock, "p1");
    const drill = await start(u, "part2");
    await store(u, drill, "p2");
    await start(u, "part3"); // nothing recorded
    expect((await listAttempts(u, {})).map((a) => a.id)).toEqual([drill, mock]);
    expect((await listAttempts(u, { kind: "mock" })).map((a) => a.id)).toEqual([mock]);
    expect(await listAttempts(u, { limit: 1 })).toHaveLength(1);
    const [row] = await listAttempts(u, { kind: "part2" });
    expect(row).toMatchObject({ id: drill, kind: "part2", status: "inProgress", parts: ["p2"], durationSec: 30 });
  });

  it("deleteAttempt removes R2 objects and band entries", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    await store(u, id, "p2", { kind: "video", mime: "video/webm", audioMime: "audio/webm", size: 5000, audioSize: 1000 });
    const keep = await start(u);
    await writeMockEntries(u, id, today, 6, 6.5);
    await writeMockEntries(u, keep, today, 7);
    vi.mocked(r2.deleteObjects).mockClear();

    expect(await deleteAttempt(u, id)).toEqual({ ok: true });
    expect(r2.deleteObjects).toHaveBeenCalledWith([
      `ielts/${u}/${id}/p1.webm`,
      `ielts/${u}/${id}/p2.webm`,
      `ielts/${u}/${id}/p2.audio.webm`,
    ]);
    expect(await IeltsSpeakingAttempt.exists({ _id: id })).toBeNull();
    expect(await IeltsBandEntry.countDocuments({ attemptId: id })).toBe(0);
    expect(await IeltsBandEntry.countDocuments({ attemptId: keep })).toBe(1);
  });

  it("deleteAttempt keeps everything when R2 fails", async () => {
    const u = user();
    const id = await start(u);
    await store(u, id, "p1");
    vi.mocked(r2.deleteObjects).mockRejectedValueOnce(new Error("r2 down"));
    expect((await deleteAttempt(u, id)).ok).toBe(false);
    expect(await IeltsSpeakingAttempt.exists({ _id: id })).not.toBeNull();
  });

  it("deleteAllIeltsData leaves Speaking Practice takes untouched", async () => {
    const u = user();
    const other = user();
    const id = await start(u);
    await store(u, id, "p1");
    const otherId = await start(other);
    await writeMockEntries(u, id, today, 6);
    await IeltsProfile.collection.insertOne({ userId: new Types.ObjectId(u) });
    await IeltsPlan.collection.insertOne({ userId: new Types.ObjectId(u), version: 1 });
    await IeltsPlanSuggestion.collection.insertOne({ userId: new Types.ObjectId(u), status: "pending" });
    await IeltsStudyLog.collection.insertOne({ userId: new Types.ObjectId(u), date: today, skill: "reading", minutes: 30 });
    await SpeakingTake.create({
      userId: u,
      date: today,
      task: "readAloud",
      media: { kind: "audio", key: `takes/${u}/t.webm`, mime: "audio/webm", durationSec: 5, capSec: 60, stored: true },
    });
    await SpeakingProfile.collection.insertOne({ userId: new Types.ObjectId(u) });
    await SpeakingUsage.create({ userId: u, day: today, count: 1 });
    vi.mocked(r2.deleteObjects).mockClear();

    await deleteAllIeltsData(u);

    expect(r2.deleteObjects).toHaveBeenCalledWith([`ielts/${u}/${id}/p1.webm`]);
    for (const M of [IeltsProfile, IeltsPlan, IeltsPlanSuggestion, IeltsStudyLog, IeltsBandEntry, IeltsSpeakingAttempt]) {
      expect(await M.countDocuments({ userId: u })).toBe(0);
    }
    expect(await IeltsSpeakingAttempt.exists({ _id: otherId })).not.toBeNull();
    expect(await SpeakingTake.countDocuments({ userId: u })).toBe(1);
    expect(await SpeakingProfile.countDocuments({ userId: u })).toBe(1);
    expect(await SpeakingUsage.countDocuments({ userId: u })).toBe(1);
  });
});
