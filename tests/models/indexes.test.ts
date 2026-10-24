import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import {
  ApiToken,
  Graph,
  GraphNode,
  Note,
  NoteProgress,
  NoteSeries,
  NodeProgress,
  Question,
  QuestionBook,
  QuestionProgress,
  User,
} from "@/models";
import { resetDb } from "../setup/mongo";

const oid = () => new Types.ObjectId();

async function expectDuplicate(first: Promise<unknown>, second: () => Promise<unknown>) {
  await first;
  await expect(second()).rejects.toMatchObject({ code: 11000 });
}

describe("model indexes and validation", () => {
  beforeAll(async () => {
    await connectDb();
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("indexes revisions by editedAt for the recent-edits list", async () => {
    const indexes = await mongoose.models.Revision.collection.indexes();
    expect(indexes.map((i) => i.key)).toContainEqual({ editedAt: -1 });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("rejects a second QuestionProgress for the same user and question", async () => {
    const doc = { userId: oid(), questionId: oid(), bookId: oid() };
    await expectDuplicate(QuestionProgress.create(doc), () => QuestionProgress.create(doc));
  });

  it("rejects a second NodeProgress for the same user and node", async () => {
    const doc = { userId: oid(), nodeId: oid(), graphId: oid(), status: "learning" };
    await expectDuplicate(NodeProgress.create(doc), () => NodeProgress.create(doc));
  });

  it("rejects a second NoteProgress for the same user and note", async () => {
    const doc = { userId: oid(), noteId: oid(), seriesId: oid() };
    await expectDuplicate(NoteProgress.create(doc), () => NoteProgress.create(doc));
  });

  it("rejects a second GraphNode with the same graph and slug", async () => {
    const doc = { graphId: oid(), slug: "closures", trackKey: "core", title: "Closures" };
    await expectDuplicate(GraphNode.create(doc), () => GraphNode.create(doc));
  });

  it("rejects a second Note with the same series and slug", async () => {
    const doc = { seriesId: oid(), slug: "intro", title: "Intro" };
    await expectDuplicate(Note.create(doc), () => Note.create(doc));
  });

  it("rejects a second QuestionBook with the same slug", async () => {
    const doc = { slug: "react", title: "React" };
    await expectDuplicate(QuestionBook.create(doc), () => QuestionBook.create(doc));
  });

  it("rejects a second ApiToken with the same tokenHash", async () => {
    const doc = { name: "cli", tokenHash: "abc123", createdBy: oid() };
    await expectDuplicate(ApiToken.create(doc), () => ApiToken.create(doc));
  });

  it("rejects a second User with the same email", async () => {
    const doc = { email: "a@example.com" };
    await expectDuplicate(User.create(doc), () => User.create(doc));
  });

  it("allows many Questions without an importKey but rejects a repeated one", async () => {
    const base = { bookId: oid(), partKey: "p1", question: "Q?", answer: "A" };
    await Question.create(base);
    await Question.create({ ...base, order: 1 });
    expect(await Question.countDocuments()).toBe(2);

    const keyed = { ...base, importKey: "book-xyz" };
    await expectDuplicate(Question.create(keyed), () => Question.create(keyed));
  });

  it("rejects status 'deleted' on every content model", async () => {
    const bad = { status: "deleted" };
    const docs = [
      new QuestionBook({ slug: "b", title: "B", ...bad }),
      new Question({ bookId: oid(), partKey: "p", question: "Q", answer: "A", ...bad }),
      new Graph({ slug: "g", title: "G", ...bad }),
      new GraphNode({ graphId: oid(), slug: "n", trackKey: "t", title: "N", ...bad }),
      new NoteSeries({ slug: "s", title: "S", ...bad }),
      new Note({ seriesId: oid(), slug: "n", title: "N", ...bad }),
    ];
    for (const doc of docs) {
      await expect(doc.validate()).rejects.toMatchObject({
        errors: { status: expect.anything() },
      });
    }
  });

  it("stores a part intro and defaults it to ''", async () => {
    const book = await QuestionBook.create({
      slug: "b",
      title: "B",
      parts: [{ key: "p1", title: "Part 1", intro: "Lead-in." }, { key: "p2", title: "Part 2" }],
    });
    const saved = await QuestionBook.findById(book._id).lean<{ parts: { intro: string }[] }>();
    expect(saved?.parts.map((p) => p.intro)).toEqual(["Lead-in.", ""]);
  });
});
