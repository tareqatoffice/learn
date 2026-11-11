import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { QuestionProgress } from "@/models";
import { clearQuestionProgress, markQuestion } from "@/progress/questions";
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

describe("clearQuestionProgress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  async function setup() {
    const user = newUserId();
    const other = newUserId();
    const a = await seedBook("a");
    const b = await seedBook("b");
    const [qa1, qa2] = await seedQuestions(a, 2);
    const [qb] = await seedQuestions(b, 1);
    for (const q of [qa1, qa2, qb]) await markQuestion(user, q, "got");
    await markQuestion(other, qa1, "review");
    return { user, other, a, b };
  }

  it("clears only the chosen books for that user", async () => {
    const { user, other, a, b } = await setup();

    expect(await clearQuestionProgress(user, [a])).toBe(2);

    const left = await QuestionProgress.find({ userId: user }).lean<{ bookId: unknown }[]>();
    expect(left.map((d) => String(d.bookId))).toEqual([b]);
    expect(await QuestionProgress.countDocuments({ userId: other })).toBe(1);
  });

  it("an empty list clears every book for that user only", async () => {
    const { user, other } = await setup();

    expect(await clearQuestionProgress(user, [])).toBe(3);

    expect(await QuestionProgress.countDocuments({ userId: user })).toBe(0);
    expect(await QuestionProgress.countDocuments({ userId: other })).toBe(1);
  });

  it("invalid book ids clear nothing instead of everything", async () => {
    const { user } = await setup();

    expect(await clearQuestionProgress(user, ["nope"])).toBe(0);
    expect(await QuestionProgress.countDocuments({ userId: user })).toBe(3);
  });
});
