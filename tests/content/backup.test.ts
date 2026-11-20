import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_COLLECTIONS, CONTENT_COLLECTIONS, backupAll, restoreAll } from "@/features/content/backup";
import { connectDb } from "@/lib/db";
import * as models from "@/models";
import { IeltsTestAttempt, Question, QuestionBook, QuestionProgress, Revision, Subject, User } from "@/models";
import { markQuestion } from "@/features/progress/questions";
import { resetDb } from "../setup/mongo";
import { seedBook, seedQuestions } from "../progress/seed";

let dir: string;
beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  dir = mkdtempSync(path.join(tmpdir(), "learn-backup-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
afterAll(() => mongoose.disconnect());

describe("collection lists", () => {
  const isModel = (value: unknown): value is mongoose.Model<unknown> =>
    typeof value === "function" && "modelName" in value && "collection" in value;

  it("lists every model in @/models, so a backup never silently drops one (D1)", () => {
    const listed = new Set(ALL_COLLECTIONS.map(([, model]) => model.modelName));
    const missing = Object.values(models).filter(isModel).map((m) => m.modelName).filter((name) => !listed.has(name));
    expect(missing).toEqual([]);
  });

  it("names each entry after the model's real collection", () => {
    for (const [name, model] of ALL_COLLECTIONS) expect(name).toBe(model.collection.collectionName);
  });

  it("exports the IELTS practice tests and prompts as content", () => {
    const names = CONTENT_COLLECTIONS.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(["ieltsreadingtests", "ieltslisteningtests", "ieltswritingprompts"]));
  });
});

describe("backupAll / restoreAll", () => {
  it("restores every collection with the original ids so progress reconnects", async () => {
    const user = await User.create({ email: "u@example.test", name: "U", role: "user" });
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 2);
    await markQuestion(String(user._id), q, "got");
    await Revision.create({ entityType: "Question", entityId: q, snapshot: { answer: "old" }, editedBy: "x", editedAt: new Date() });
    const attemptId = new mongoose.Types.ObjectId();
    await IeltsTestAttempt.collection.insertOne({ _id: attemptId, userId: user._id, skill: "reading", answers: {} });

    const file = path.join(dir, "backup.json");
    const saved = await backupAll(file);
    expect(saved.counts).toMatchObject({ users: 1, questions: 2, questionprogresses: 1, revisions: 1, ieltstestattempts: 1 });

    await resetDb();
    const restored = await restoreAll(file);
    expect(restored.counts).toEqual(saved.counts);

    const question = await Question.findById(q).lean<{ _id: unknown; answer: string }>();
    expect(question?.answer).toBe("answer 0");
    const progress = await QuestionProgress.findOne({ userId: user._id }).lean<{ questionId: unknown; lastSeenAt: Date }>();
    expect(String(progress?.questionId)).toBe(q);
    expect(progress?.lastSeenAt).toBeInstanceOf(Date);
    expect(await IeltsTestAttempt.exists({ _id: attemptId })).toBeTruthy();
  });

  it("refuses to restore into a database that already has content or users", async () => {
    await seedBook("js");
    const file = path.join(dir, "backup.json");
    await backupAll(file);
    await expect(restoreAll(file)).rejects.toThrow("target database is not empty");
  });

  it("refuses when only non-content collections have documents", async () => {
    const file = path.join(dir, "backup.json");
    await backupAll(file);
    await Revision.create({ entityType: "Question", entityId: new mongoose.Types.ObjectId(), snapshot: {}, editedAt: new Date() });
    await expect(restoreAll(file)).rejects.toThrow("revisions has documents");
  });

  it("rolls back a restore that fails part way, so it can be rerun", async () => {
    const { EJSON } = mongoose.mongo.BSON;
    const dup = new mongoose.Types.ObjectId();
    const book = { _id: dup, slug: "a", title: "A", status: "published" };
    const file = path.join(dir, "broken.json");
    writeFileSync(
      file,
      EJSON.stringify({
        version: 1,
        collections: {
          subjects: [{ _id: new mongoose.Types.ObjectId(), slug: "js", name: "JS" }],
          questionbooks: [book, { ...book, slug: "b" }],
        },
      }),
    );
    await expect(restoreAll(file)).rejects.toThrow("rolled back");
    expect(await Subject.countDocuments()).toBe(0);
    expect(await QuestionBook.countDocuments()).toBe(0);
  });
});
