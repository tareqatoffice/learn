import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  presignGet: vi.fn(async (key: string) => `https://r2.test/get/${key}`),
  headObject: vi.fn(async () => ({ size: 1_000_000, contentType: "" })),
  deleteObjects: vi.fn(async () => undefined),
}));
vi.mock("@/lib/stt", () => ({ sttConfigured: vi.fn(() => true) }));

import { connectDb } from "@/lib/db";
import { SpeakingLesson, SpeakingTake, SpeakingTakeUsage } from "@/models";
import { MAX_OPEN_TAKES, MAX_TAKES_PER_DAY, OPEN_TAKE_MS, sweepAbandonedTakes, deleteAllTakes, deleteTake, confirmTake, getTake, listTakes, saveSelfRating, startTake } from "@/features/speaking/takes";
import * as r2 from "@/lib/r2";
import * as stt from "@/lib/stt";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());
const base = {
  task: "readAloud" as const,
  date: new Date().toISOString().slice(0, 10),
  lessonId: null,
  material: { text: "hello", generated: false },
  kind: "audio" as const,
  mime: "audio/webm",
  size: 1000,
};
const VIDEO = { kind: "video", mime: "video/webm", audioMime: "audio/webm", size: 5000, audioSize: 1000 };

async function start(u: string, over: Record<string, unknown> = {}) {
  const res = await startTake(u, { ...base, ...over } as never);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res;
}

describe("speaking takes", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    vi.mocked(r2.storageConfigured).mockReturnValue(true);
    vi.mocked(stt.sttConfigured).mockReturnValue(true);
    vi.mocked(r2.headObject).mockResolvedValue({ size: 1_000_000, contentType: "" });
  });
  afterAll(() => mongoose.disconnect());

  it("startTake presigns keys under the user's folder", async () => {
    const u = user();
    const a = await start(u);
    expect(a.uploadUrl).toContain(`takes/${u}/${a.takeId}.webm`);
    expect(a.audioUploadUrl).toBeUndefined();
    const v = await start(u, { ...VIDEO, mime: "video/mp4", audioMime: "audio/mp4" });
    expect(v.uploadUrl).toContain(`takes/${u}/${v.takeId}.mp4`);
    expect(v.audioUploadUrl).toContain(`takes/${u}/${v.takeId}.audio.m4a`);
  });

  it("startTake signs the declared sizes into the upload URLs", async () => {
    const u = user();
    const v = await start(u, VIDEO);
    expect(vi.mocked(r2.presignPut)).toHaveBeenCalledWith(`takes/${u}/${v.takeId}.webm`, "video/webm", 5000);
    expect(vi.mocked(r2.presignPut)).toHaveBeenCalledWith(`takes/${u}/${v.takeId}.audio.webm`, "audio/webm", 1000);
  });

  it("startTake refuses a declared size over the cap, or a missing or bad size, without saving", async () => {
    const u = user();
    const { maxBytes } = await start(u);
    await SpeakingTake.deleteMany({});
    const over = await startTake(u, { ...base, size: maxBytes + 1 });
    expect(over).toEqual({ ok: false, errors: { _: expect.stringMatching(/larger than the \d+ MB limit/) } });
    for (const size of [undefined, 0, -1, 1.5, Number.NaN, "1000"]) {
      expect((await startTake(u, { ...base, size } as never)).ok).toBe(false);
    }
    const video = await start(u, VIDEO);
    await SpeakingTake.deleteMany({});
    expect((await startTake(u, { ...VIDEO, size: video.maxBytes + 1 } as never)).ok).toBe(false);
    expect((await startTake(u, { ...VIDEO, audioSize: undefined } as never)).ok).toBe(false);
    expect((await startTake(u, { ...VIDEO, audioSize: 100 * 1024 * 1024 } as never)).ok).toBe(false);
    expect(await SpeakingTake.countDocuments({})).toBe(0);
    expect(vi.mocked(r2.presignPut)).toHaveBeenCalledTimes(3);
  });

  it("startTake refuses when storage is not configured, text too long, or bad mime", async () => {
    vi.mocked(r2.storageConfigured).mockReturnValue(false);
    expect((await startTake(user(), base)).ok).toBe(false);
    vi.mocked(r2.storageConfigured).mockReturnValue(true);
    expect((await startTake(user(), { ...base, material: { text: "x".repeat(5001), generated: false } })).ok).toBe(false);
    expect((await startTake(user(), { ...base, mime: "text/html" })).ok).toBe(false);
  });

  it("startTake saves without a lesson link when the lesson is unpublished, deleted or malformed", async () => {
    const u = user();
    const draft = await SpeakingLesson.create({ title: "D", order: 1, status: "draft", shadow: { audioKey: "k", text: "t" } });
    for (const lessonId of [String(draft._id), String(new Types.ObjectId()), "nope"]) {
      const { takeId } = await start(u, { task: "shadowing", lessonId, material: { text: "kept", generated: false } });
      const doc = await SpeakingTake.findById(takeId).lean<{ lessonId?: unknown; material: { text: string } }>();
      expect(doc!.lessonId ?? null).toBeNull();
      expect(doc!.material.text).toBe("kept");
      await confirmTake(u, takeId, 5);
      const view = await getTake(u, takeId);
      expect(view!.lessonId).toBeUndefined();
      expect(view!.sourceAudioUrl).toBeUndefined();
    }
    expect(vi.mocked(r2.presignGet)).not.toHaveBeenCalledWith("k");
  });

  it("startTake rejects far dates and bad user ids", async () => {
    expect((await startTake(user(), { ...base, date: "2020-01-01" })).ok).toBe(false);
    expect((await startTake("bad", base)).ok).toBe(false);
  });

  it("startTake caps shadowing at twice the lesson's clip length, ignoring a client clipSec (S3)", async () => {
    const lesson = await SpeakingLesson.create({ title: "L", order: 1, status: "published", shadow: { durationSec: 90 } });
    const res = await start(user(), { task: "shadowing", lessonId: String(lesson._id), clipSec: 900 });
    expect(res.capSec).toBe(180);
    expect(res.maxBytes).toBe(1_440_000);
    const noLesson = await start(user(), { task: "shadowing", clipSec: 900 });
    expect(noLesson.capSec).toBe(600);
  });

  it("startTake stores a slowed shadowing clip rate and stretches the cap; ignores bad or other-task rates", async () => {
    const lesson = await SpeakingLesson.create({
      title: "L",
      order: 1,
      status: "published",
      shadow: { durationSec: 90, text: "One. Two.", marks: [0, 4], audioKey: "lessons/x/a.mp3" },
    });
    const u = user();
    const slow = await start(u, { task: "shadowing", lessonId: String(lesson._id), clipRate: 0.5, material: { text: "One. Two.", generated: false } });
    expect(slow.capSec).toBe(360);
    expect((await SpeakingTake.findById(slow.takeId).lean<{ clipRate?: number }>())?.clipRate).toBe(0.5);

    const odd = await start(u, { task: "shadowing", lessonId: String(lesson._id), clipRate: 0.3 });
    expect(odd.capSec).toBe(180);
    expect((await SpeakingTake.findById(odd.takeId).lean<{ clipRate?: number }>())?.clipRate).toBeUndefined();

    const other = await start(u, { clipRate: 0.5 });
    expect((await SpeakingTake.findById(other.takeId).lean<{ clipRate?: number }>())?.clipRate).toBeUndefined();

    await confirmTake(u, slow.takeId, 100);
    const view = await getTake(u, slow.takeId);
    expect(view).toMatchObject({ clipRate: 0.5, sourceMarks: [0, 4], sourceDurationSec: 90 });
    await confirmTake(u, odd.takeId, 100);
    const plain = await getTake(u, odd.takeId);
    expect(plain?.clipRate).toBe(1);
    expect(plain?.sourceMarks).toBeUndefined();
  });

  it("startTake refuses a fourth unconfirmed take, but not once older ones count as abandoned (S3)", async () => {
    const u = user();
    for (let i = 0; i < MAX_OPEN_TAKES; i++) await start(u);
    const refused = await startTake(u, base);
    expect(refused.ok).toBe(false);
    await SpeakingTake.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - OPEN_TAKE_MS - 1000) } });
    expect((await startTake(u, base)).ok).toBe(true);
    expect((await startTake(user(), base)).ok).toBe(true);
  });

  it("sweeps a user's takes left unconfirmed for over an hour, files first (D5)", async () => {
    const u = user();
    const old = await start(u);
    const fresh = await start(u);
    const kept = await start(user());
    await SpeakingTake.collection.updateMany({ _id: { $in: [new Types.ObjectId(old.takeId), new Types.ObjectId(kept.takeId)] } }, { $set: { createdAt: new Date(Date.now() - OPEN_TAKE_MS - 1000) } });
    vi.mocked(r2.deleteObjects).mockClear();
    expect(await sweepAbandonedTakes(u)).toBe(1);
    expect(r2.deleteObjects).toHaveBeenCalledWith([`takes/${u}/${old.takeId}.webm`]);
    expect(await SpeakingTake.exists({ _id: old.takeId })).toBeNull();
    expect(await SpeakingTake.exists({ _id: fresh.takeId })).toBeTruthy();
    expect(await SpeakingTake.exists({ _id: kept.takeId })).toBeTruthy();
  });

  it("keeps abandoned takes when R2 fails, and a take being deleted cannot be confirmed (D5)", async () => {
    const u = user();
    const t = await start(u);
    await SpeakingTake.collection.updateOne({ _id: new Types.ObjectId(t.takeId) }, { $set: { createdAt: new Date(Date.now() - OPEN_TAKE_MS - 1000) } });
    vi.mocked(r2.deleteObjects).mockRejectedValueOnce(new Error("r2 down"));
    expect(await sweepAbandonedTakes(u)).toBe(0);
    expect(await SpeakingTake.exists({ _id: t.takeId, deletingAt: null })).toBeTruthy();
    await SpeakingTake.updateOne({ _id: t.takeId }, { $set: { deletingAt: new Date() } });
    expect((await confirmTake(u, t.takeId, 3)).ok).toBe(false);
  });

  it("startTake refuses past the daily limit, and deleting takes doesn't give it back (S3)", async () => {
    const u = user();
    const day = new Date().toISOString().slice(0, 10);
    await SpeakingTakeUsage.create({ userId: u, day, count: MAX_TAKES_PER_DAY - 1 });
    const last = await start(u);
    await deleteTake(u, last.takeId);
    const refused = await startTake(u, base);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors._).toMatch(/today/);
    expect((await SpeakingTakeUsage.findOne({ userId: u, day }).lean<{ count: number }>())?.count).toBe(MAX_TAKES_PER_DAY);
    expect((await startTake(user(), base)).ok).toBe(true);
  });

  it("parallel starts never leave more than the open-take limit", async () => {
    const u = user();
    const results = await Promise.all(Array.from({ length: MAX_OPEN_TAKES + 3 }, () => startTake(u, base)));
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(MAX_OPEN_TAKES);
    expect(await SpeakingTake.countDocuments({ userId: u })).toBeLessThanOrEqual(MAX_OPEN_TAKES);
  });

  it("confirmTake credits no more time than the file could hold", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValue({ size: 18_000, contentType: "" });
    expect((await confirmTake(u, takeId, 600)).ok).toBe(true);
    const doc = await SpeakingTake.findById(takeId).lean<{ media: { durationSec: number } }>();
    expect(doc!.media.durationSec).toBe(18);
  });

  it("confirmTake rejects missing object", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValue(null);
    const res = await confirmTake(u, takeId, 30);
    expect(res.ok).toBe(false);
    expect((await SpeakingTake.findById(takeId).lean<{ media: { stored: boolean } }>())!.media.stored).toBe(false);
    expect(vi.mocked(r2.deleteObjects)).toHaveBeenCalledWith([`takes/${u}/${takeId}.webm`]);
  });

  it("confirmTake rejects oversize object and deletes both of its R2 objects", async () => {
    const u = user();
    const { takeId, maxBytes } = await start(u, VIDEO);
    vi.mocked(r2.headObject).mockResolvedValue({ size: maxBytes + 1, contentType: "video/webm" });
    expect((await confirmTake(u, takeId, 30)).ok).toBe(false);
    expect(vi.mocked(r2.deleteObjects)).toHaveBeenCalledWith([`takes/${u}/${takeId}.webm`, `takes/${u}/${takeId}.audio.webm`]);
    expect(await SpeakingTake.countDocuments({ _id: takeId })).toBe(1);
  });

  it("confirmTake still reports the upload failure when the clean-up fails", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValue(null);
    vi.mocked(r2.deleteObjects).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await confirmTake(u, takeId, 30)).toEqual({ ok: false, errors: { _: "Your recording didn't finish uploading. Try again." } });
  });

  it("confirmTake accepts the retried upload after a rejection", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValueOnce(null);
    expect((await confirmTake(u, takeId, 30)).ok).toBe(false);
    expect((await confirmTake(u, takeId, 30)).ok).toBe(true);
  });

  it("confirmTake stores the take and clamps duration", async () => {
    const u = user();
    const { takeId, capSec } = await start(u);
    expect((await confirmTake(u, takeId, 99999)).ok).toBe(true);
    const doc = await SpeakingTake.findById(takeId).lean<{
      media: { stored: boolean; size: number; durationSec: number };
      transcriptStatus: string;
    }>();
    expect(doc!.media.stored).toBe(true);
    expect(doc!.media.size).toBe(1_000_000);
    expect(doc!.media.durationSec).toBe(capSec);
    expect(doc!.transcriptStatus).toBe("pending");
  });

  it("confirmTake on a stored take changes nothing", async () => {
    const u = user();
    const { takeId } = await start(u);
    await confirmTake(u, takeId, 10);
    await SpeakingTake.updateOne({ _id: takeId }, { $set: { transcriptStatus: "done" } });
    expect((await confirmTake(u, takeId, 500)).ok).toBe(true);
    const doc = await SpeakingTake.findById(takeId).lean<{ media: { durationSec: number }; transcriptStatus: string }>();
    expect(doc!.media.durationSec).toBe(10);
    expect(doc!.transcriptStatus).toBe("done");
  });

  it("confirmTake rejects an upload stored with another content type (F24)", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValueOnce({ size: 1000, contentType: "text/html" });
    expect((await confirmTake(u, takeId, 5)).ok).toBe(false);
    vi.mocked(r2.headObject).mockResolvedValueOnce({ size: 1000, contentType: "audio/webm;codecs=opus" });
    expect((await confirmTake(u, takeId, 5)).ok).toBe(true);
  });

  it("confirmTake heads the audio key for video takes", async () => {
    const u = user();
    const { takeId } = await start(u, VIDEO);
    await confirmTake(u, takeId, 10);
    expect(vi.mocked(r2.headObject)).toHaveBeenCalledTimes(2);
  });

  it("rejects another user's take", async () => {
    const u = user();
    const { takeId } = await start(u);
    const other = user();
    expect((await confirmTake(other, takeId, 10)).ok).toBe(false);
    await confirmTake(u, takeId, 10);
    expect(await getTake(other, takeId)).toBeNull();
    expect((await saveSelfRating(other, takeId, { fluency: 3, confidence: 3 })).ok).toBe(false);
    expect((await deleteTake(other, takeId)).ok).toBe(false);
    expect(await SpeakingTake.countDocuments({ _id: takeId })).toBe(1);
  });

  it("handles malformed ids without throwing", async () => {
    const u = user();
    expect((await confirmTake(u, "nope", 1)).ok).toBe(false);
    expect(await getTake(u, "nope")).toBeNull();
    expect((await saveSelfRating(u, "nope", { fluency: 3, confidence: 3 })).ok).toBe(false);
    expect((await deleteTake(u, "nope")).ok).toBe(false);
  });

  it("confirmTake marks transcript unavailable when STT is unset", async () => {
    vi.mocked(stt.sttConfigured).mockReturnValue(false);
    const u = user();
    const { takeId } = await start(u);
    await confirmTake(u, takeId, 10);
    expect((await SpeakingTake.findById(takeId).lean<{ transcriptStatus: string }>())!.transcriptStatus).toBe(
      "unavailable",
    );
  });

  it("saveSelfRating validates scores, audio-only fields, note and markers", async () => {
    const u = user();
    const a = await start(u);
    await confirmTake(u, a.takeId, 60);
    const rate = (input: Parameters<typeof saveSelfRating>[2]) => saveSelfRating(u, a.takeId, input);
    expect((await rate({ fluency: 3, confidence: 3, eyeContact: 3 })).ok).toBe(false);
    expect((await rate({ fluency: 0, confidence: 3 })).ok).toBe(false);
    expect((await rate({ fluency: 3.5, confidence: 3 })).ok).toBe(false);
    expect((await rate({ fluency: 3, confidence: 6 })).ok).toBe(false);
    expect((await rate({ fluency: 3, confidence: 3, note: "x".repeat(1001) })).ok).toBe(false);
    expect((await rate({ fluency: 3, confidence: 3, markers: [{ atSec: 61, label: "late" }] })).ok).toBe(false);
    expect((await rate({ fluency: 3, confidence: 3, markers: [{ atSec: 1, label: "x".repeat(61) }] })).ok).toBe(false);
    const tooMany = Array.from({ length: 51 }, () => ({ atSec: 1, label: "m" }));
    expect((await rate({ fluency: 3, confidence: 3, markers: tooMany })).ok).toBe(false);
    expect((await rate({ fluency: 4, confidence: 2, note: "ok", markers: [{ atSec: 5, label: "pause" }] })).ok).toBe(true);
    const v = await start(u, VIDEO);
    await confirmTake(u, v.takeId, 60);
    expect((await saveSelfRating(u, v.takeId, { fluency: 3, confidence: 3, eyeContact: 4, gestures: 2 })).ok).toBe(true);
    const doc = await SpeakingTake.findById(v.takeId).lean<{ self: { eyeContact: number } }>();
    expect(doc!.self.eyeContact).toBe(4);
  });

  it("deleteTake removes both R2 keys and the document of a started, unstored take", async () => {
    const u = user();
    const { takeId } = await start(u, VIDEO);
    expect((await deleteTake(u, takeId)).ok).toBe(true);
    expect(vi.mocked(r2.deleteObjects)).toHaveBeenCalledWith([
      `takes/${u}/${takeId}.webm`,
      `takes/${u}/${takeId}.audio.webm`,
    ]);
    expect(await SpeakingTake.countDocuments({ _id: takeId })).toBe(0);
  });

  it("deleteTake keeps the document when R2 deletion fails", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.deleteObjects).mockRejectedValueOnce(new Error("boom"));
    expect((await deleteTake(u, takeId)).ok).toBe(false);
    expect(await SpeakingTake.countDocuments({ _id: takeId })).toBe(1);
  });

  it("deleteAllTakes only removes the caller's takes", async () => {
    const u = user();
    const o = user();
    await start(u);
    await start(u);
    await start(o);
    expect(await deleteAllTakes(u)).toBe(2);
    expect(await SpeakingTake.countDocuments({ userId: u })).toBe(0);
    expect(await SpeakingTake.countDocuments({ userId: o })).toBe(1);
  });

  it("getTake renders when lesson deleted, and presigns lesson audio when present", async () => {
    const u = user();
    const lesson = await SpeakingLesson.create({
      title: "L",
      order: 1,
      status: "published",
      shadow: { audioKey: "lessons/a.mp3", text: "t" },
    });
    const { takeId } = await start(u, {
      task: "shadowing",
      lessonId: String(lesson._id),
      material: { text: "shadow text", generated: false },
    });
    await confirmTake(u, takeId, 20);
    const withLesson = await getTake(u, takeId);
    expect(withLesson!.mediaUrl).toContain(`takes/${u}/${takeId}.webm`);
    expect(withLesson!.sourceAudioUrl).toContain("lessons/a.mp3");
    await SpeakingLesson.deleteMany({});
    const view = await getTake(u, takeId);
    expect(view!.material.text).toBe("shadow text");
    expect(view!.sourceAudioUrl).toBeUndefined();
  });

  it("listTakes returns stored takes newest first with filters", async () => {
    const u = user();
    const a = await start(u);
    const b = await start(u, { task: "recordReview" });
    await start(u);
    await confirmTake(u, a.takeId, 10);
    await confirmTake(u, b.takeId, 20);
    const all = await listTakes(u, {});
    expect(all.map((t) => t.id)).toEqual([b.takeId, a.takeId]);
    expect(all[0].durationSec).toBe(20);
    expect((await listTakes(u, { task: "readAloud" })).map((t) => t.id)).toEqual([a.takeId]);
    expect((await listTakes(u, { limit: 1 })).length).toBe(1);
    expect((await listTakes(u, { before: b.takeId })).map((t) => t.id)).toEqual([a.takeId]);
    expect(await listTakes(user(), {})).toEqual([]);
  });
});
