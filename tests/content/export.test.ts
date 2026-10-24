import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportContent } from "@/content/backup";
import { connectDb } from "@/lib/db";
import { ApiToken, QuestionProgress, Revision, Subject, User } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedBook, seedGraph, seedNode, seedNote, seedQuestions, seedSeries } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const { EJSON } = mongoose.mongo.BSON;

async function collect(): Promise<string> {
  let out = "";
  for await (const chunk of exportContent()) out += chunk;
  return out;
}

describe("exportContent", () => {
  it("exports every content collection and nothing personal", async () => {
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 2);
    await seedNode(await seedGraph("g"), "a");
    await seedNote(await seedSeries("docker"), "intro");
    await Subject.create({ slug: "javascript", name: "JavaScript" });
    const user = await User.create({ email: "u@example.test", name: "U", role: "user" });
    await QuestionProgress.create({ userId: user._id, questionId: q, bookId: book, status: "got", seenCount: 1 });
    await Revision.create({ entityType: "Question", entityId: q, snapshot: { question: "old" }, editedBy: "x", editedAt: new Date() });
    await ApiToken.create({ name: "cli", tokenHash: "a".repeat(64), createdBy: user._id });

    const doc = EJSON.parse(await collect()) as {
      version: number;
      exportedAt: Date;
      collections: Record<string, Record<string, unknown>[]>;
    };
    expect(doc.version).toBe(1);
    expect(doc.exportedAt).toBeInstanceOf(Date);
    expect(Object.keys(doc.collections).sort()).toEqual(
      ["graphnodes", "graphs", "notes", "noteseries", "questionbooks", "questions", "subjects"].sort(),
    );
    expect(doc.collections.questions).toHaveLength(2);
    expect(doc.collections.questions[0]._id).toBeInstanceOf(Types.ObjectId);
    expect(String(doc.collections.questions[0].bookId)).toBe(book);
    expect(doc.collections.subjects).toEqual([expect.objectContaining({ slug: "javascript" })]);
  });

  it("is valid JSON when collections are empty", async () => {
    const doc = EJSON.parse(await collect()) as { collections: Record<string, unknown[]> };
    expect(doc.collections.questions).toEqual([]);
  });

  it("streams in more than one chunk", async () => {
    const book = await seedBook("js");
    await seedQuestions(book, 3);
    const chunks: string[] = [];
    for await (const chunk of exportContent()) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThan(3);
  });
});
