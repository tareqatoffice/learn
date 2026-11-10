import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { SpeakingDay, SpeakingLesson, SpeakingTake } from "@/models";
import { lessonHasPart, listPublishedLessons, swapLesson, todaysLesson } from "@/speaking/lessons";
import type { TaskKey } from "@/speaking/tasks";
import { resetDb } from "../setup/mongo";

const ALL = { shadowing: true, readAloud: true, recordReview: true };
const NO_SHADOW = { shadowing: false, readAloud: true, recordReview: true };
const user = () => String(new Types.ObjectId());

async function lesson(order: number, extra: Record<string, unknown> = {}) {
  const doc = await SpeakingLesson.create({
    title: `L${order}`,
    order,
    status: "published",
    passage: "a passage",
    prompt: "a prompt",
    ...extra,
  });
  return String(doc._id);
}

async function take(userId: string, lessonId: string, task: TaskKey, stored = true) {
  await SpeakingTake.create({
    userId,
    date: "2026-11-01",
    task,
    lessonId,
    media: { kind: "audio", key: "k", mime: "audio/webm", durationSec: 5, capSec: 60, stored },
  });
}

describe("speaking lessons", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("assigns the first unfinished published lesson and keeps it all day", async () => {
    const u = user();
    const l1 = await lesson(1);
    await lesson(2);
    expect((await todaysLesson(u, "2026-11-10", ALL))?.id).toBe(l1);
    await take(u, l1, "readAloud");
    expect((await todaysLesson(u, "2026-11-10", ALL))?.id).toBe(l1);
  });

  it("moves on only when every enabled part has a take", async () => {
    const u = user();
    const l1 = await lesson(1);
    const l2 = await lesson(2);
    await take(u, l1, "readAloud");
    expect((await todaysLesson(u, "2026-11-11", NO_SHADOW))?.id).toBe(l1);
    await take(u, l1, "recordReview");
    expect((await todaysLesson(u, "2026-11-12", NO_SHADOW))?.id).toBe(l2);
  });

  it("ignores unstored takes and parts a lesson lacks", async () => {
    const u = user();
    const l1 = await lesson(1, { prompt: undefined });
    const l2 = await lesson(2);
    await take(u, l1, "readAloud", false);
    expect((await todaysLesson(u, "2026-11-11", NO_SHADOW))?.id).toBe(l1);
    await take(u, l1, "readAloud");
    expect((await todaysLesson(u, "2026-11-12", NO_SHADOW))?.id).toBe(l2);
  });

  it("assignment skips an unpublished lesson", async () => {
    const u = user();
    const l1 = await lesson(1);
    const l2 = await lesson(2);
    expect((await todaysLesson(u, "2026-11-10", ALL))?.id).toBe(l1);
    await SpeakingLesson.updateOne({ _id: l1 }, { status: "draft" });
    expect((await todaysLesson(u, "2026-11-10", ALL))?.id).toBe(l2);
    const day = await SpeakingDay.findOne({ userId: u, date: "2026-11-10" }).lean<{ lessonId: unknown }>();
    expect(String(day?.lessonId)).toBe(l2);
  });

  it("swapLesson refuses a draft lesson and accepts a published one", async () => {
    const u = user();
    const l1 = await lesson(1);
    const l2 = await lesson(2);
    const draft = await lesson(3, { status: "draft" });
    await todaysLesson(u, "2026-11-10", ALL);
    expect((await swapLesson(u, "2026-11-10", draft)).ok).toBe(false);
    expect((await swapLesson(u, "2026-11-10", l2)).ok).toBe(true);
    expect((await todaysLesson(u, "2026-11-10", ALL))?.id).toBe(l2);
    expect((await listPublishedLessons()).map((l) => l.id)).toEqual([l1, l2]);
  });

  it("returns null when there are no published lessons", async () => {
    await lesson(1, { status: "draft" });
    expect(await todaysLesson(user(), "2026-11-10", ALL)).toBeNull();
  });

  it("lessonHasPart checks the content each task needs", () => {
    const base = { id: "x", title: "t", order: 1, shadow: null, passage: "", prompt: "" };
    expect(lessonHasPart(base, "shadowing")).toBe(false);
    expect(lessonHasPart({ ...base, shadow: { audioKey: "k" } }, "shadowing")).toBe(false);
    expect(lessonHasPart({ ...base, shadow: { audioUrl: "u", text: "t" } }, "shadowing")).toBe(true);
    expect(lessonHasPart({ ...base, passage: "p" }, "readAloud")).toBe(true);
    expect(lessonHasPart({ ...base, prompt: "p" }, "recordReview")).toBe(true);
  });
});
