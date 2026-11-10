import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/webm" })),
  getObjectBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { SpeakingTake, SpeakingUsage } from "@/models";
import { SttError } from "@/lib/stt";
import { transcribeTake } from "@/speaking/transcribe";
import * as r2 from "@/lib/r2";
import { resetDb } from "../setup/mongo";

const today = new Date().toISOString().slice(0, 10);

async function makeTake(userId: string, over: Record<string, unknown> = {}, media: Record<string, unknown> = {}) {
  const doc = await SpeakingTake.create({
    userId,
    date: today,
    task: "readAloud",
    media: { kind: "audio", key: "takes/u/a.webm", mime: "audio/webm", durationSec: 5, capSec: 60, stored: true, ...media },
    transcriptStatus: "pending",
    ...over,
  });
  return String(doc._id);
}
const statusOf = async (id: string) => (await SpeakingTake.findById(id).lean<{ transcriptStatus: string; transcript?: string }>())!;
const usageCount = async (u: string) =>
  (await SpeakingUsage.findOne({ userId: u, day: today }).lean<{ count: number }>())?.count ?? 0;

describe("transcribeTake", () => {
  const user = String(new Types.ObjectId());
  const stub = (text = "hello") => vi.fn(async () => text);

  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    vi.mocked(r2.headObject).mockResolvedValue({ size: 1000, contentType: "audio/webm" });
    vi.mocked(r2.getObjectBytes).mockResolvedValue(new Uint8Array([1, 2, 3]));
  });
  afterEach(() => {
    delete process.env.STT_DAILY_LIMIT;
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("saves the transcript and marks done", async () => {
    const id = await makeTake(user);
    const res = await transcribeTake(user, id, { transcribe: stub("hello") });
    expect(res).toEqual({ ok: true, transcript: "hello" });
    const t = await statusOf(id);
    expect(t.transcriptStatus).toBe("done");
    expect(t.transcript).toBe("hello");
    expect(await usageCount(user)).toBe(1);
  });

  it("uses the audio-only key for video takes", async () => {
    const id = await makeTake(user, {}, { kind: "video", key: "takes/u/v.mp4", mime: "video/mp4", audioKey: "takes/u/v.audio.webm" });
    await transcribeTake(user, id, { transcribe: stub() });
    expect(r2.getObjectBytes).toHaveBeenCalledWith("takes/u/v.audio.webm");
  });

  it("marks failed and refunds usage on STT error", async () => {
    const id = await makeTake(user);
    const res = await transcribeTake(user, id, {
      transcribe: vi.fn(async () => {
        throw new SttError("boom");
      }),
    });
    expect(res.ok).toBe(false);
    expect((await statusOf(id)).transcriptStatus).toBe("failed");
    expect(await usageCount(user)).toBe(0);
  });

  it("can retry a failed take", async () => {
    const id = await makeTake(user, { transcriptStatus: "failed" });
    const res = await transcribeTake(user, id, { transcribe: stub("again") });
    expect(res.ok).toBe(true);
    expect((await statusOf(id)).transcriptStatus).toBe("done");
  });

  it("stops at the daily limit", async () => {
    process.env.STT_DAILY_LIMIT = "1";
    resetEnvCache();
    const a = await makeTake(user);
    const b = await makeTake(user);
    expect((await transcribeTake(user, a, { transcribe: stub() })).ok).toBe(true);
    const res = await transcribeTake(user, b, { transcribe: stub() });
    expect(res).toEqual({ ok: false, errors: { _: "You've reached today's transcription limit. It resets at midnight UTC." } });
    expect((await statusOf(b)).transcriptStatus).toBe("pending");
    expect(await usageCount(user)).toBe(1);
  });

  it("ignores a take that is already done", async () => {
    const id = await makeTake(user, { transcriptStatus: "done", transcript: "kept" });
    const t = stub("new");
    const res = await transcribeTake(user, id, { transcribe: t });
    expect(res.ok).toBe(false);
    expect(t).not.toHaveBeenCalled();
    expect((await statusOf(id)).transcript).toBe("kept");
    expect(await usageCount(user)).toBe(0);
  });

  it("rejects bad ids, other users' takes and unstored takes", async () => {
    const t = stub();
    expect((await transcribeTake(user, "nope", { transcribe: t })).ok).toBe(false);
    expect((await transcribeTake("nope", "nope", { transcribe: t })).ok).toBe(false);
    const id = await makeTake(user);
    expect((await transcribeTake(String(new Types.ObjectId()), id, { transcribe: t })).ok).toBe(false);
    const unstored = await makeTake(user, {}, { stored: false });
    expect((await transcribeTake(user, unstored, { transcribe: t })).ok).toBe(false);
    expect(t).not.toHaveBeenCalled();
  });

  it("refuses files over 25 MB without reading them", async () => {
    vi.mocked(r2.headObject).mockResolvedValue({ size: 25 * 1024 * 1024 + 1, contentType: "audio/webm" });
    const id = await makeTake(user);
    const t = stub();
    const res = await transcribeTake(user, id, { transcribe: t });
    expect(res.ok).toBe(false);
    expect(r2.getObjectBytes).not.toHaveBeenCalled();
    expect(t).not.toHaveBeenCalled();
    expect(await usageCount(user)).toBe(0);
  });
});
