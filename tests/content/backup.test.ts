import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { backupAll, restoreAll } from "@/content/backup";
import { connectDb } from "@/lib/db";
import { Question, QuestionBook, QuestionProgress, Revision, Subject, User } from "@/models";
import { markQuestion } from "@/progress/questions";
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

describe("backupAll / restoreAll", () => {
  it("restores every collection with the original ids so progress reconnects", async () => {
    const user = await User.create({ email: "u@example.test", name: "U", role: "user" });
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 2);
    await markQuestion(String(user._id), q, "got");
    await Revision.create({ entityType: "Question", entityId: q, snapshot: { answer: "old" }, editedBy: "x", editedAt: new Date() });

    const file = path.join(dir, "backup.json");
    const saved = await backupAll(file);
    expect(saved.counts).toMatchObject({ users: 1, questions: 2, questionprogresses: 1, revisions: 1 });

    await resetDb();
    const restored = await restoreAll(file);
    expect(restored.counts).toEqual(saved.counts);

    const question = await Question.findById(q).lean<{ _id: unknown; answer: string }>();
    expect(question?.answer).toBe("answer 0");
    const progress = await QuestionProgress.findOne({ userId: user._id }).lean<{ questionId: unknown; lastSeenAt: Date }>();
    expect(String(progress?.questionId)).toBe(q);
    expect(progress?.lastSeenAt).toBeInstanceOf(Date);
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
