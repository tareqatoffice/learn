import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { listRevisions, restoreRevision, saveWithRevision } from "@/content/revisions";
import { Question, QuestionBook, Revision } from "@/models";
import { resetDb } from "../setup/mongo";

const editor = new Types.ObjectId().toString();
const editor2 = new Types.ObjectId().toString();

async function seedQuestion(text = "first") {
  const book = await QuestionBook.create({ slug: "b", title: "B", status: "published" });
  const created = await saveWithRevision(
    Question,
    null,
    { bookId: book._id, partKey: "p", question: text, answer: "a", status: "published" },
    editor,
  );
  return String(created._id);
}

describe("revisions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("creates without a revision when id is null", async () => {
    const id = await seedQuestion();
    expect(await Revision.countDocuments()).toBe(0);
    expect(await Question.findById(id)).toMatchObject({ question: "first" });
  });

  it("stores the previous full doc on each update", async () => {
    const id = await seedQuestion("first");
    const second = await saveWithRevision(Question, id, { question: "second" }, editor);
    expect(second.question).toBe("second");
    await saveWithRevision(Question, id, { question: "third" }, editor2);

    const revisions = await Revision.find({ entityId: id }).sort({ editedAt: 1 }).lean();
    expect(revisions).toHaveLength(2);
    expect(revisions.map((r) => r.snapshot.question)).toEqual(["first", "second"]);
    expect(revisions[0].entityType).toBe("Question");
    expect(revisions[0].snapshot).toMatchObject({ answer: "a", partKey: "p", status: "published" });
    expect(String(revisions[0].editedBy)).toBe(editor);
    expect(String(revisions[1].editedBy)).toBe(editor2);
    expect((await Question.findById(id).lean())!.question).toBe("third");
  });

  it("throws and writes no revision for an unknown id", async () => {
    await expect(
      saveWithRevision(Question, new Types.ObjectId().toString(), { question: "x" }, editor),
    ).rejects.toThrow(/not found/i);
    expect(await Revision.countDocuments()).toBe(0);
  });

  it("restores a revision and records the restore as a revision", async () => {
    const id = await seedQuestion("first");
    await saveWithRevision(Question, id, { question: "second" }, editor);
    await saveWithRevision(Question, id, { question: "third" }, editor);

    const listed = await listRevisions("Question", id);
    expect(listed).toHaveLength(2);
    expect(listed[0].editedAt.getTime()).toBeGreaterThanOrEqual(listed[1].editedAt.getTime());
    const oldest = listed[1]; // holds "first"

    await restoreRevision(oldest.id, editor2);

    expect((await Question.findById(id).lean())!.question).toBe("first");
    const after = await listRevisions("Question", id);
    expect(after).toHaveLength(3);
    expect(after[0].editedBy).toBe(editor2);
    const newest = await Revision.findById(after[0].id).lean();
    expect(newest!.snapshot.question).toBe("third");
  });

  it("rejects restoring an unknown revision", async () => {
    await expect(restoreRevision(new Types.ObjectId().toString(), editor)).rejects.toThrow(
      /not found/i,
    );
  });

  it("rejects an invalid update and writes no revision", async () => {
    const id = await seedQuestion("first");
    await expect(saveWithRevision(Question, id, { status: "bogus" }, editor)).rejects.toThrow(/status/);
    expect(await Revision.countDocuments()).toBe(0);
    expect((await Question.findById(id).lean())!.status).toBe("published");
  });

  it("stores editedBy as given, such as an email or token name", async () => {
    const id = await seedQuestion("first");
    await saveWithRevision(Question, id, { question: "second" }, "token:cli");
    expect((await listRevisions("Question", id))[0].editedBy).toBe("token:cli");
  });

  it("works inside a transaction session, and rolls back with it", async () => {
    const id = await seedQuestion("first");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await saveWithRevision(Question, id, { question: "in-tx" }, editor, { session });
        const created = await saveWithRevision(
          Question,
          null,
          { bookId: new Types.ObjectId(), partKey: "p", question: "new", answer: "a" },
          editor,
          { session },
        );
        expect(created.question).toBe("new");
      });
      expect((await Question.findById(id).lean())!.question).toBe("in-tx");
      expect(await Revision.countDocuments({ entityId: id })).toBe(1);
      expect(await Question.countDocuments({ question: "new" })).toBe(1);

      await expect(
        session.withTransaction(async () => {
          await saveWithRevision(Question, id, { question: "aborted" }, editor, { session });
          throw new Error("abort");
        }),
      ).rejects.toThrow("abort");
      expect((await Question.findById(id).lean())!.question).toBe("in-tx");
      expect(await Revision.countDocuments({ entityId: id })).toBe(1);
    } finally {
      await session.endSession();
    }
  });
});
