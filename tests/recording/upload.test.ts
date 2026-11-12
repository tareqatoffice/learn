import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectsCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { resetEnvCache } from "@/lib/env";
import { setR2Client } from "@/lib/r2";
import { connectDb } from "@/lib/db";
import { SpeakingTake } from "@/models";
import { capBytes, keysOf, type MediaDoc } from "@/recording/media";
import { playbackUrls, prepareUpload, removeMedia, verifyUpload } from "@/recording/upload";
import { getTake } from "@/speaking/takes";
import { resetDb } from "../setup/mongo";
import { legacyTake, legacyTakeId, legacyUserId } from "./fixtures/legacyTake";

const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
const UPLOAD_FAILED = "Your recording didn't finish uploading. Try again.";

// A real client (so presigning works offline) whose network calls are mocked.
let s3: S3Client;
let send: ReturnType<typeof vi.fn>;
let heads: Record<string, number | null>;

const VIDEO = {
  keyBase: "ielts/u/a/p1",
  kind: "video" as const,
  mime: "video/webm;codecs=vp8,opus",
  audioMime: "audio/webm",
  size: 5000,
  audioSize: 1000,
  capSec: 420,
};

const stored = (over: Partial<MediaDoc> = {}): MediaDoc => ({
  kind: "video",
  key: "ielts/u/a/p1.webm",
  mime: "video/webm",
  audioKey: "ielts/u/a/p1.audio.webm",
  audioMime: "audio/webm",
  durationSec: 0,
  capSec: 420,
  stored: false,
  ...over,
});

describe("recording upload", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    for (const v of VARS) vi.stubEnv(v, `${v.toLowerCase()}x`);
    resetEnvCache();
    heads = {};
    s3 = new S3Client({
      region: "auto",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      credentials: { accessKeyId: "id", secretAccessKey: "secret" },
    });
    send = vi.fn(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        const size = heads[cmd.input.Key!];
        if (size === undefined || size === null) throw Object.assign(new Error("nf"), { name: "NotFound" });
        return { ContentLength: size, ContentType: "video/webm" };
      }
      if (cmd instanceof DeleteObjectsCommand) return { Errors: [] };
      throw new Error("unexpected command");
    });
    vi.spyOn(s3, "send").mockImplementation(send as never);
    setR2Client(s3);
  });
  afterEach(() => {
    setR2Client(null);
    vi.unstubAllEnvs();
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("prepareUpload builds both keys from keyBase and presigns them", async () => {
    const res = await prepareUpload(VIDEO);
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    expect(res.media).toEqual({
      kind: "video",
      key: "ielts/u/a/p1.webm",
      mime: "video/webm",
      audioKey: "ielts/u/a/p1.audio.webm",
      audioMime: "audio/webm",
      durationSec: 0,
      capSec: 420,
      stored: false,
    });
    expect(new URL(res.uploadUrl).pathname).toContain("/ielts/u/a/p1.webm");
    expect(new URL(res.audioUploadUrl!).pathname).toContain("/ielts/u/a/p1.audio.webm");
    expect(res.maxBytes).toBe(capBytes(420, true));
  });

  it("prepareUpload for audio has no audio key or URL", async () => {
    const res = await prepareUpload({ keyBase: "ielts/u/a/p2", kind: "audio", mime: "audio/mp4", size: 100, capSec: 150 });
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    expect(res.media.key).toBe("ielts/u/a/p2.m4a");
    expect(res.media.audioKey).toBeUndefined();
    expect(res.audioUploadUrl).toBeUndefined();
    expect(res.maxBytes).toBe(capBytes(150, false));
  });

  it("prepareUpload refuses an oversize recording with the take too-large message", async () => {
    const max = capBytes(420, true);
    const res = await prepareUpload({ ...VIDEO, size: max + 1 });
    expect(res).toEqual({
      ok: false,
      errors: {
        _: `This recording is larger than the ${Math.floor(max / (1024 * 1024))} MB limit for a take, so it can't be saved. Discard it and record a shorter take.`,
      },
    });
  });

  it("prepareUpload rejects an unsupported mime or a kind/mime mismatch", async () => {
    const unsupported = { ok: false, errors: { _: "That recording format isn't supported." } };
    expect(await prepareUpload({ ...VIDEO, mime: "video/ogg" })).toEqual(unsupported);
    expect(await prepareUpload({ ...VIDEO, kind: "audio", mime: "video/webm" })).toEqual(unsupported);
    expect(await prepareUpload({ ...VIDEO, audioMime: "video/webm" })).toEqual(unsupported);
  });

  it("verifyUpload accepts both objects within the cap and returns the main size", async () => {
    heads = { "ielts/u/a/p1.webm": 5000, "ielts/u/a/p1.audio.webm": 1000 };
    expect(await verifyUpload(stored())).toEqual({ ok: true, size: 5000 });
    expect(send.mock.calls.some(([c]) => c instanceof DeleteObjectsCommand)).toBe(false);
  });

  it.each([
    ["main is empty", { "ielts/u/a/p1.webm": 0, "ielts/u/a/p1.audio.webm": 1000 }],
    ["main is over the cap", { "ielts/u/a/p1.webm": capBytes(420, true) + 1, "ielts/u/a/p1.audio.webm": 1000 }],
    ["audio is over the cap", { "ielts/u/a/p1.webm": 5000, "ielts/u/a/p1.audio.webm": capBytes(420, false) + 1 }],
    ["main is missing", { "ielts/u/a/p1.audio.webm": 1000 }],
  ])("verifyUpload rejects and deletes when %s", async (_name, h) => {
    heads = h;
    expect(await verifyUpload(stored())).toEqual({ ok: false, error: UPLOAD_FAILED });
    const del = send.mock.calls.map(([c]) => c).find((c) => c instanceof DeleteObjectsCommand) as DeleteObjectsCommand;
    expect(del.input.Delete!.Objects!.map((o) => o.Key)).toEqual(["ielts/u/a/p1.webm", "ielts/u/a/p1.audio.webm"]);
  });

  it("playbackUrls is null until stored, then signs both keys", async () => {
    expect(await playbackUrls(stored())).toBeNull();
    const urls = await playbackUrls(stored({ stored: true }));
    expect(new URL(urls!.url).pathname).toContain("/ielts/u/a/p1.webm");
    expect(new URL(urls!.audioUrl!).pathname).toContain("/ielts/u/a/p1.audio.webm");
    const audioOnly = await playbackUrls(stored({ stored: true, kind: "audio", key: "k.webm", audioKey: undefined }));
    expect(audioOnly!.audioUrl).toBeUndefined();
  });

  it("removeMedia deletes every key of every media", async () => {
    await removeMedia([stored(), stored({ key: "x.m4a", audioKey: undefined })]);
    const keys = send.mock.calls
      .map(([c]) => c)
      .filter((c) => c instanceof DeleteObjectsCommand)
      .flatMap((c) => (c as DeleteObjectsCommand).input.Delete!.Objects!.map((o) => o.Key));
    expect(keys).toEqual(["ielts/u/a/p1.webm", "ielts/u/a/p1.audio.webm", "x.m4a"]);
    expect(keysOf(stored())).toEqual(["ielts/u/a/p1.webm", "ielts/u/a/p1.audio.webm"]);
  });

  it("legacy take fixture round-trips", async () => {
    await SpeakingTake.collection.insertOne(legacyTake);
    const view = await getTake(String(legacyUserId), String(legacyTakeId));
    expect(view).not.toBeNull();
    expect(view!.transcript).toBe(legacyTake.transcript);
    expect(view!.transcriptStatus).toBe("done");
    expect(view!.self).toEqual(legacyTake.self);
    expect(view!.markers).toEqual(legacyTake.markers);
    expect(view!.ai?.speech).toEqual(legacyTake.ai.speech);
    expect(view!.kind).toBe("video");
    expect(view!.durationSec).toBe(95);
    expect(new URL(view!.mediaUrl).pathname).toContain(`/${legacyTake.media.key}`);
    expect(new URL(view!.audioUrl!).pathname).toContain(`/${legacyTake.media.audioKey}`);
  });
});
