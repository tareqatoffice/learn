import mongoose, { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/webm" })),
  getObjectBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import * as r2 from "@/lib/r2";
import { SpeakingTake, SpeakingUsage } from "@/models";
import { SttError } from "@/lib/stt";
import type { MediaDoc } from "@/recording/mediaCore";
import { TRANSCRIBE_LIMIT_MESSAGE, transcribeMedia } from "@/recording/transcribe";
import { transcribeTake } from "@/speaking/transcribe";
import { resetDb } from "../setup/mongo";
import { legacyTake, legacyTakeId, legacyUserId } from "./fixtures/legacyTake";

const today = new Date().toISOString().slice(0, 10);
const usageCount = async (u: string) =>
  (await SpeakingUsage.findOne({ userId: u, day: today }).lean<{ count: number }>())?.count ?? 0;

const media: MediaDoc = {
  kind: "audio",
  key: "ielts/u/a/p1.webm",
  mime: "audio/webm",
  durationSec: 5,
  capSec: 420,
  stored: true,
};

describe("recording transcription", () => {
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
    vi.restoreAllMocks();
    delete process.env.STT_DAILY_LIMIT;
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("shares the daily cap across modules", async () => {
    process.env.STT_DAILY_LIMIT = "2";
    resetEnvCache();
    const t = stub();
    const uid = String(legacyUserId);
    await mongoose.connection.collection("speakingtakes").insertOne({ ...legacyTake, transcriptStatus: "pending" });
    // One call from the IELTS-style path, one from Speaking Practice: same user, same counter.
    expect((await transcribeMedia(uid, media, { transcribe: t })).ok).toBe(true);
    expect((await transcribeTake(uid, String(legacyTakeId), { transcribe: t })).ok).toBe(true);
    const res = await transcribeMedia(uid, media, { transcribe: t });
    expect(res).toEqual({ ok: false, errors: { _: TRANSCRIBE_LIMIT_MESSAGE } });
    expect(t).toHaveBeenCalledTimes(2);
    expect(await usageCount(uid)).toBe(2);
  });

  it("refunds on an STT error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await transcribeMedia(user, media, {
      transcribe: vi.fn(async () => {
        expect(await usageCount(user)).toBe(1);
        throw new SttError("boom");
      }),
    });
    expect(res).toEqual({ ok: false, errors: { _: "Couldn't transcribe the recording. Try again." } });
    expect(await usageCount(user)).toBe(0);
    log.mockRestore();
  });

  it("refunds and skips onError when save reports nothing stored", async () => {
    const onError = vi.fn(async () => {});
    const res = await transcribeMedia(user, media, { transcribe: stub(), save: async () => false, onError });
    expect(res).toEqual({ ok: false, errors: { _: "This recording can't be transcribed." } });
    expect(await usageCount(user)).toBe(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it("still returns the failure and refunds when onError throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await transcribeMedia(user, media, {
      transcribe: vi.fn(async () => {
        throw new SttError("boom");
      }),
      onError: async () => {
        throw new Error("db down");
      },
    });
    expect(res).toEqual({ ok: false, errors: { _: "Couldn't transcribe the recording. Try again." } });
    expect(await usageCount(user)).toBe(0);
    log.mockRestore();
  });

  it("transcribes the audio-only copy of a video and writes nothing", async () => {
    const video: MediaDoc = { ...media, kind: "video", key: "ielts/u/a/p1.mp4", mime: "video/mp4", audioKey: "ielts/u/a/p1.audio.webm" };
    const res = await transcribeMedia(user, video, { transcribe: stub("said it") });
    expect(res).toEqual({ ok: true, transcript: "said it" });
    expect(r2.getObjectBytes).toHaveBeenCalledWith("ielts/u/a/p1.audio.webm");
    expect(await SpeakingTake.countDocuments()).toBe(0);
  });

  it("refuses files over 25 MB without using the cap", async () => {
    vi.mocked(r2.headObject).mockResolvedValue({ size: 25 * 1024 * 1024 + 1, contentType: "audio/webm" });
    const res = await transcribeMedia(user, media, { transcribe: stub() });
    expect(res).toEqual({ ok: false, errors: { _: "This recording is too large to transcribe." } });
    expect(await usageCount(user)).toBe(0);
  });

  it("transcribes a legacy take", async () => {
    const col = mongoose.connection.collection("speakingtakes");
    await col.insertOne({ ...legacyTake, transcript: undefined, transcriptStatus: "pending" });
    const uid = String(legacyUserId);
    const res = await transcribeTake(uid, String(legacyTakeId), { transcribe: stub("from legacy") });
    expect(res).toEqual({ ok: true, transcript: "from legacy" });
    expect(r2.getObjectBytes).toHaveBeenCalledWith(legacyTake.media.audioKey);
    const row = await col.findOne({ _id: legacyTakeId });
    expect(row?.transcript).toBe("from legacy");
    expect(row?.transcriptStatus).toBe("done");
  });
});
