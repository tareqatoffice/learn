import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  headObject: vi.fn(async () => ({ size: 1000, contentType: "audio/mpeg" })),
  deleteObjects: vi.fn(async () => undefined),
}));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "64b000000000000000000001", email: "someone@example.test", name: "Someone" } }),
}));

import { ForbiddenError } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { SpeakingDay, SpeakingLesson, SpeakingTake } from "@/models";
import * as r2 from "@/lib/r2";
import {
  confirmLessonAudio,
  createLesson,
  deleteLesson,
  moveLesson,
  startLessonAudioUpload,
  updateLesson,
} from "@/admin/speaking";
import { createLessonAction } from "@/app/(app)/admin/speaking/actions";
import { resetDb } from "../setup/mongo";

const input = (over: Record<string, unknown> = {}) => ({
  title: "Lesson",
  status: "published" as const,
  subjectIds: [],
  shadowText: "",
  shadowAudioUrl: "",
  shadowDurationSec: 0,
  passage: "",
  prompt: "",
  ...over,
});

async function make(title = "Lesson") {
  const res = await createLesson(input({ title }));
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.id;
}

const orderOf = async (id: string) => (await SpeakingLesson.findById(id).lean<{ order: number }>())!.order;

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(r2.storageConfigured).mockReturnValue(true);
  vi.mocked(r2.headObject).mockResolvedValue({ size: 1000, contentType: "audio/mpeg" });
});
afterAll(() => mongoose.disconnect());

describe("admin speaking lessons", () => {
  it("non-admins can't create lessons", async () => {
    await expect(createLessonAction(input())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await SpeakingLesson.countDocuments()).toBe(0);
  });

  it("rejects invalid input", async () => {
    const res = await createLesson(input({ title: "", shadowAudioUrl: "http://x.test/a.mp3", shadowDurationSec: 5000 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["title", "shadowAudioUrl", "shadowDurationSec"]));
  });

  it("createLesson appends to the end of the order", async () => {
    const a = await make("A");
    const b = await make("B");
    expect(await orderOf(b)).toBe((await orderOf(a)) + 1);
  });

  it("updateLesson saves the fields", async () => {
    const id = await make();
    const res = await updateLesson(id, input({ title: "New", passage: "Read me", prompt: "Say", shadowText: "Hi", shadowDurationSec: 12 }));
    expect(res.ok).toBe(true);
    const doc = await SpeakingLesson.findById(id).lean<{ title: string; passage: string; prompt: string; shadow: { text: string; durationSec: number } }>();
    expect(doc).toMatchObject({ title: "New", passage: "Read me", prompt: "Say", shadow: { text: "Hi", durationSec: 12 } });
    expect((await updateLesson("nope", input())).ok).toBe(false);
  });

  it("deleteLesson keeps users' takes and days, and deletes the audio", async () => {
    const id = await make();
    const key = `lessons/${id}/abc.mp3`;
    await SpeakingLesson.updateOne({ _id: id }, { $set: { "shadow.audioKey": key } });
    await SpeakingTake.collection.insertOne({ userId: new Types.ObjectId(), lessonId: new Types.ObjectId(id) });
    await SpeakingDay.collection.insertOne({ userId: new Types.ObjectId(), lessonId: new Types.ObjectId(id) });
    expect((await deleteLesson(id)).ok).toBe(true);
    expect(await SpeakingLesson.countDocuments()).toBe(0);
    expect(await SpeakingTake.countDocuments()).toBe(1);
    expect(await SpeakingDay.countDocuments()).toBe(1);
    expect(r2.deleteObjects).toHaveBeenCalledWith([key]);
  });

  it("moveLesson swaps order with the neighbour", async () => {
    const a = await make("A");
    const b = await make("B");
    const c = await make("C");
    expect((await moveLesson(b, "up")).ok).toBe(true);
    expect(await orderOf(b)).toBeLessThan(await orderOf(a));
    expect((await moveLesson(c, "down")).ok).toBe(true); // already last: no-op
    expect(await orderOf(c)).toBeGreaterThan(await orderOf(a));
  });

  it("startLessonAudioUpload only accepts audio within the size cap", async () => {
    const id = await make();
    const res = await startLessonAudioUpload(id, "audio/mpeg", 1000);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.key.startsWith(`lessons/${id}/`)).toBe(true);
      expect(res.key.endsWith(".mp3")).toBe(true);
      expect(res.uploadUrl).toContain(res.key);
    }
    expect((await startLessonAudioUpload(id, "video/mp4", 1000)).ok).toBe(false);
    expect((await startLessonAudioUpload(id, "audio/mpeg", 51 * 1024 * 1024)).ok).toBe(false);
    expect((await startLessonAudioUpload("bad", "audio/mpeg", 10)).ok).toBe(false);
  });

  it("startLessonAudioUpload explains when storage isn't configured", async () => {
    vi.mocked(r2.storageConfigured).mockReturnValue(false);
    const res = await startLessonAudioUpload(await make(), "audio/mpeg", 10);
    expect(res.ok).toBe(false);
  });

  it("confirmLessonAudio rejects a key outside the lesson's folder", async () => {
    const id = await make();
    const other = await make("Other");
    const res = await confirmLessonAudio(id, `lessons/${other}/x.mp3`, 10);
    expect(res.ok).toBe(false);
    expect((await confirmLessonAudio(id, `lessons/${id}/../x.mp3`, 10)).ok).toBe(false);
  });

  it("confirmLessonAudio rejects an object that never arrived", async () => {
    const id = await make();
    vi.mocked(r2.headObject).mockResolvedValue(null);
    expect((await confirmLessonAudio(id, `lessons/${id}/x.mp3`, 10)).ok).toBe(false);
  });

  it("confirmLessonAudio stores the key and deletes the previous one", async () => {
    const id = await make();
    const first = `lessons/${id}/one.mp3`;
    const second = `lessons/${id}/two.mp3`;
    expect((await confirmLessonAudio(id, first, 30)).ok).toBe(true);
    expect(r2.deleteObjects).not.toHaveBeenCalled();
    expect((await confirmLessonAudio(id, second, 45)).ok).toBe(true);
    expect(r2.deleteObjects).toHaveBeenCalledWith([first]);
    const doc = await SpeakingLesson.findById(id).lean<{ shadow: { audioKey: string; durationSec: number } }>();
    expect(doc?.shadow).toMatchObject({ audioKey: second, durationSec: 45 });
  });
});
