import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  presignGet: vi.fn(async (key: string) => `https://r2.test/get/${key}`),
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/webm" })),
  deleteObjects: vi.fn(async () => undefined),
}));
vi.mock("@/lib/stt", () => ({ sttConfigured: vi.fn(() => true) }));

import { connectDb } from "@/lib/db";
import { SpeakingLesson, SpeakingTake } from "@/models";
import { deleteAllTakes, deleteTake, confirmTake, getTake, listTakes, saveSelfRating, startTake } from "@/speaking/takes";
import * as r2 from "@/lib/r2";
import * as stt from "@/lib/stt";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());
const base = {
  task: "readAloud" as const,
  date: "2026-11-10",
  lessonId: null,
  material: { text: "hello", generated: false },
  kind: "audio" as const,
  mime: "audio/webm",
};

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
    vi.mocked(r2.headObject).mockResolvedValue({ size: 1000, contentType: "audio/webm" });
  });
  afterAll(() => mongoose.disconnect());

  it("startTake presigns keys under the user's folder", async () => {
    const u = user();
    const a = await start(u);
    expect(a.uploadUrl).toContain(`takes/${u}/${a.takeId}.webm`);
    expect(a.audioUploadUrl).toBeUndefined();
    const v = await start(u, { kind: "video", mime: "video/mp4", audioMime: "audio/mp4" });
    expect(v.uploadUrl).toContain(`takes/${u}/${v.takeId}.mp4`);
    expect(v.audioUploadUrl).toContain(`takes/${u}/${v.takeId}.audio.m4a`);
  });

  it("startTake refuses when storage is not configured, text too long, or bad mime", async () => {
    vi.mocked(r2.storageConfigured).mockReturnValue(false);
    expect((await startTake(user(), base)).ok).toBe(false);
    vi.mocked(r2.storageConfigured).mockReturnValue(true);
    expect((await startTake(user(), { ...base, material: { text: "x".repeat(5001), generated: false } })).ok).toBe(false);
    expect((await startTake(user(), { ...base, mime: "text/html" })).ok).toBe(false);
  });

  it("startTake caps shadowing at twice the clip length", async () => {
    const res = await start(user(), { task: "shadowing", clipSec: 90 });
    expect(res.capSec).toBe(180);
    expect(res.maxBytes).toBe(1_440_000);
  });

  it("confirmTake rejects missing object", async () => {
    const u = user();
    const { takeId } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValue(null);
    const res = await confirmTake(u, takeId, 30);
    expect(res.ok).toBe(false);
    expect((await SpeakingTake.findById(takeId).lean<{ media: { stored: boolean } }>())!.media.stored).toBe(false);
  });

  it("confirmTake rejects oversize object", async () => {
    const u = user();
    const { takeId, maxBytes } = await start(u);
    vi.mocked(r2.headObject).mockResolvedValue({ size: maxBytes + 1, contentType: "audio/webm" });
    expect((await confirmTake(u, takeId, 30)).ok).toBe(false);
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
    expect(doc!.media.size).toBe(1000);
    expect(doc!.media.durationSec).toBe(capSec);
    expect(doc!.transcriptStatus).toBe("pending");
  });

  it("confirmTake heads the audio key for video takes", async () => {
    const u = user();
    const { takeId } = await start(u, { kind: "video", mime: "video/webm" });
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
    const v = await start(u, { kind: "video", mime: "video/webm" });
    await confirmTake(u, v.takeId, 60);
    expect((await saveSelfRating(u, v.takeId, { fluency: 3, confidence: 3, eyeContact: 4, gestures: 2 })).ok).toBe(true);
    const doc = await SpeakingTake.findById(v.takeId).lean<{ self: { eyeContact: number } }>();
    expect(doc!.self.eyeContact).toBe(4);
  });

  it("deleteTake removes both R2 keys and the document", async () => {
    const u = user();
    const { takeId } = await start(u, { kind: "video", mime: "video/webm", audioMime: "audio/webm" });
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
    await start(u); // unstored
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
