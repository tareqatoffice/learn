import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(),
  presignGet: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(async () => undefined),
  getObjectBytes: vi.fn(),
}));

import { deleteTest } from "@/admin/ieltsTests";
import { connectDb } from "@/lib/db";
import * as r2 from "@/lib/r2";
import { IeltsListeningTest, IeltsTestAttempt } from "@/models";
import { resetDb } from "../setup/mongo";

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.mocked(r2.deleteObjects).mockClear();
});
afterAll(() => mongoose.disconnect());

describe("IELTS test files (S17)", () => {
  it("keeps a recording an attempt still points at and removes the rest", async () => {
    const section = (audioKey: string) => ({ title: "S", script: "s", audioKey, groups: [] });
    const test = await IeltsListeningTest.create({ title: "T", status: "draft", sections: [section("k/used.mp3"), section("k/free.mp3")] });
    await IeltsTestAttempt.collection.insertOne({
      userId: new Types.ObjectId(),
      skill: "listening",
      testId: test._id,
      title: "T",
      date: "2026-11-16",
      scope: "full",
      status: "in_progress",
      startedAt: new Date(),
      limitSec: 1800,
      sections: [section("k/used.mp3")],
    });
    expect((await deleteTest("listening", String(test._id))).ok).toBe(true);
    expect(r2.deleteObjects).toHaveBeenCalledWith(["k/free.mp3"]);
  });
});
