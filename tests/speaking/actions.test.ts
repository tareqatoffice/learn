import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: () =>
    Promise.resolve(session.userId ? { user: { id: session.userId, email: "learner@example.test", name: "Learner" } } : null),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "Europe/London" }) }) }));
vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  presignGet: vi.fn(async (key: string) => `https://r2.test/get/${key}`),
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/webm" })),
  deleteObjects: vi.fn(async () => undefined),
  getObjectBytes: vi.fn(async () => new Uint8Array([1])),
}));
vi.mock("@/lib/stt", () => ({ sttConfigured: vi.fn(() => false), transcribe: vi.fn() }));

import * as actions from "@/app/(app)/speaking/actions";
import { connectDb } from "@/lib/db";
import { SpeakingDay, SpeakingLesson, SpeakingProfile, SpeakingTake } from "@/models";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const today = new Date().toISOString().slice(0, 10);
const input = {
  task: "readAloud" as const,
  date: today,
  lessonId: null,
  material: { text: "hello", generated: true },
  kind: "audio" as const,
  mime: "audio/webm",
  size: 1000,
};

describe("speaking actions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });
  afterAll(() => mongoose.disconnect());

  it("actions use the session user, not input ids", async () => {
    const me = id();
    const other = id();
    session.userId = me;

    // A smuggled userId in the input is ignored.
    const started = await actions.startTakeAction({ ...input, userId: other } as never);
    if (!started.ok) throw new Error(JSON.stringify(started.errors));
    const take = await SpeakingTake.findById(started.takeId).lean<{ userId: Types.ObjectId }>();
    expect(String(take?.userId)).toBe(me);
    expect(started.uploadUrl).toContain(`takes/${me}/`);

    // Someone else's take can't be touched.
    const theirs = await SpeakingTake.create({
      userId: other,
      date: today,
      task: "readAloud",
      material: { generated: false },
      media: { kind: "audio", key: `takes/${other}/x.webm`, mime: "audio/webm", durationSec: 30, capSec: 600, stored: true },
    });
    expect((await actions.confirmTakeAction(String(theirs._id), 10)).ok).toBe(false);
    expect((await actions.saveSelfRatingAction(String(theirs._id), { fluency: 3, confidence: 3 })).ok).toBe(false);
    expect((await actions.deleteTakeAction(String(theirs._id))).ok).toBe(false);
    expect(await SpeakingTake.exists({ _id: theirs._id })).toBeTruthy();

    // Settings land on the session user's profile.
    expect((await actions.saveProfileAction({ targets: { readAloud: 9 } })).ok).toBe(true);
    expect((await actions.setBodyConsentAction(true)).ok).toBe(true);
    const profile = await SpeakingProfile.findOne({ userId: me }).lean<{ targets: { readAloud: number }; bodyConsentAt?: Date }>();
    expect(profile?.targets.readAloud).toBe(9);
    expect(profile?.bodyConsentAt).toBeInstanceOf(Date);
    expect(await SpeakingProfile.exists({ userId: other })).toBeNull();

    // Swapping uses the session user and their local date.
    const lesson = await SpeakingLesson.create({ title: "L1", order: 1, status: "published", passage: "p", prompt: "q" });
    expect((await actions.swapLessonAction(String(lesson._id))).ok).toBe(true);
    const day = await SpeakingDay.findOne({ userId: me }).lean<{ lessonId: Types.ObjectId }>();
    expect(String(day?.lessonId)).toBe(String(lesson._id));
  });

  it("passes the declared sizes through to startTake", async () => {
    session.userId = id();
    const r2 = await import("@/lib/r2");
    const started = await actions.startTakeAction({
      ...input,
      kind: "video",
      mime: "video/webm",
      audioMime: "audio/webm",
      size: 4000,
      audioSize: 900,
    });
    if (!started.ok) throw new Error(JSON.stringify(started.errors));
    expect(vi.mocked(r2.presignPut)).toHaveBeenCalledWith(expect.stringMatching(/\.webm$/), "video/webm", 4000);
    expect(vi.mocked(r2.presignPut)).toHaveBeenCalledWith(expect.stringMatching(/\.audio\.webm$/), "audio/webm", 900);
  });

  it("confirms the caller's own take", async () => {
    session.userId = id();
    const started = await actions.startTakeAction(input);
    if (!started.ok) throw new Error("start failed");
    expect((await actions.confirmTakeAction(started.takeId, 12)).ok).toBe(true);
    const take = await SpeakingTake.findById(started.takeId).lean<{ media: { stored: boolean }; transcriptStatus: string }>();
    expect(take?.media.stored).toBe(true);
    expect(take?.transcriptStatus).toBe("unavailable");
  });

  it("surfaces startTake's messages", async () => {
    session.userId = id();
    const res = await actions.startTakeAction({ ...input, date: "2020-01-01" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors._).toBe("That date isn't today.");
  });

  it("signed-out users are rejected", async () => {
    const takeId = id();
    const calls: [string, () => Promise<unknown>][] = [
      ["startTakeAction", () => actions.startTakeAction(input)],
      ["confirmTakeAction", () => actions.confirmTakeAction(takeId, 5)],
      ["transcribeTakeAction", () => actions.transcribeTakeAction(takeId)],
      ["saveSelfRatingAction", () => actions.saveSelfRatingAction(takeId, { fluency: 3, confidence: 3 })],
      ["speechFeedbackAction", () => actions.speechFeedbackAction(takeId)],
      ["bodyFeedbackAction", () => actions.bodyFeedbackAction(takeId, [])],
      ["generateMaterialAction", () => actions.generateMaterialAction("readAloud")],
      ["deleteTakeAction", () => actions.deleteTakeAction(takeId)],
      ["swapLessonAction", () => actions.swapLessonAction(id())],
      ["saveProfileAction", () => actions.saveProfileAction({})],
      ["setBodyConsentAction", () => actions.setBodyConsentAction(true)],
    ];
    expect(calls.map(([name]) => name).sort()).toEqual(
      Object.entries(actions)
        .filter(([, v]) => typeof v === "function")
        .map(([k]) => k)
        .sort(),
    );
    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
    }
    expect(await SpeakingTake.countDocuments()).toBe(0);
    expect(await SpeakingProfile.countDocuments()).toBe(0);
  });
});
