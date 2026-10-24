import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { QuestionProgress } from "@/models";
import { markQuestion } from "@/progress/questions";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedQuestions } from "./seed";

describe("markQuestion", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("got then review leaves one doc with status review and seenCount 2", async () => {
    const user = newUserId();
    const bookId = await seedBook("b");
    const [q] = await seedQuestions(bookId, 1);

    await markQuestion(user, q, "got");
    await markQuestion(user, q, "review");

    const docs = await QuestionProgress.find({}).lean<{ status: string; seenCount: number; bookId: unknown; lastSeenAt: Date }[]>();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ status: "review", seenCount: 2 });
    expect(String(docs[0].bookId)).toBe(bookId);
    expect(docs[0].lastSeenAt).toBeInstanceOf(Date);
  });

  it("a skip on a new question stores status null and seenCount 1", async () => {
    const user = newUserId();
    const [q] = await seedQuestions(await seedBook("b"), 1);

    await markQuestion(user, q, "skip");

    const doc = await QuestionProgress.findOne({ userId: user, questionId: q }).lean<{ status: unknown; seenCount: number }>();
    expect(doc).toMatchObject({ status: null, seenCount: 1 });
  });

  it("a skip keeps an earlier status", async () => {
    const user = newUserId();
    const [q] = await seedQuestions(await seedBook("b"), 1);

    await markQuestion(user, q, "got");
    await markQuestion(user, q, "skip");

    const doc = await QuestionProgress.findOne({ userId: user, questionId: q }).lean<{ status: unknown; seenCount: number }>();
    expect(doc).toMatchObject({ status: "got", seenCount: 2 });
  });

  it("concurrent first marks for the same question keep one doc", async () => {
    const user = newUserId();
    const [q] = await seedQuestions(await seedBook("b"), 1);

    await Promise.all([markQuestion(user, q, "got"), markQuestion(user, q, "got"), markQuestion(user, q, "review")]);

    const docs = await QuestionProgress.find({ userId: user }).lean<{ seenCount: number }[]>();
    expect(docs).toHaveLength(1);
    expect(docs[0].seenCount).toBe(3);
  });
});
