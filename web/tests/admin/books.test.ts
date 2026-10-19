import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moveItem, saveBook, saveQuestion, setQuestionTopicLink, setStatus } from "@/admin/service";
import { connectDb } from "@/lib/db";
import { GraphNode, Question, QuestionBook, Revision } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedBook, seedGraph, seedNode, seedQuestions } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const ADMIN = "owner@example.test";

const questionInput = (bookId: string, over: Record<string, unknown> = {}) => ({
  bookId,
  partKey: "p1",
  question: "What is a closure?",
  prompt: "",
  answer: "A function with its scope.",
  subjects: ["javascript"],
  status: "published" as const,
  ...over,
});

describe("saveBook", () => {
  it("creates a book after the existing ones and updates it with a revision", async () => {
    await seedBook("first");
    const created = await saveBook(
      {
        slug: "react",
        title: "React",
        intro: "Intro",
        subjects: ["react"],
        parts: [{ key: "hooks", title: "Hooks" }],
        extras: [],
        status: "draft",
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const book = await QuestionBook.findById(created.id).lean<{ order: number; parts: { key: string; order: number }[] }>();
    expect(book?.order).toBe(1);
    expect(book?.parts).toEqual([expect.objectContaining({ key: "hooks", order: 0 })]);

    const updated = await saveBook(
      { id: created.id, slug: "react", title: "React!", intro: "Intro", subjects: [], parts: [], extras: [], status: "published" },
      ADMIN,
    );
    expect(updated).toEqual({ ok: true, id: created.id });
    expect(await Revision.countDocuments({ entityId: created.id })).toBe(1);
  });

  it("refuses to remove a part that still has questions", async () => {
    const book = await seedBook("js");
    await seedQuestions(book, 2, "p2", "archived");
    const r = await saveBook(
      { id: book, slug: "js", title: "JS", intro: "", subjects: [], parts: [{ key: "p1", title: "Part One" }], extras: [], status: "published" },
      ADMIN,
    );
    expect(r).toMatchObject({ ok: false, errors: { parts: expect.stringContaining("Part Two") } });
    expect((await QuestionBook.findById(book).lean<{ parts: unknown[] }>())?.parts).toHaveLength(2);
  });

  it("rejects a slug that is taken or not kebab-case", async () => {
    await seedBook("react");
    const taken = await saveBook({ slug: "react", title: "x", intro: "", subjects: [], parts: [], extras: [], status: "draft" }, ADMIN);
    expect(taken).toMatchObject({ ok: false, errors: { slug: expect.any(String) } });
    const bad = await saveBook({ slug: "Not Kebab", title: "x", intro: "", subjects: [], parts: [], extras: [], status: "draft" }, ADMIN);
    expect(bad).toMatchObject({ ok: false, errors: { slug: expect.any(String) } });
  });
});

describe("saveQuestion", () => {
  it("writes exactly one revision when an answer is edited", async () => {
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 1);
    const result = await saveQuestion({ id: q, ...questionInput(book, { answer: "Edited" }) }, ADMIN);
    expect(result).toEqual({ ok: true, id: q });
    expect((await Question.findById(q).lean<{ answer: string }>())?.answer).toBe("Edited");
    const revisions = await Revision.find({ entityId: q }).lean<{ editedBy: string; snapshot: { answer: string } }[]>();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ editedBy: ADMIN, snapshot: { answer: "answer 0" } });
  });

  it("gives a new question the next order and an import key", async () => {
    const book = await seedBook("js");
    await seedQuestions(book, 2);
    const result = await saveQuestion(questionInput(book), ADMIN);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const q = await Question.findById(result.id).lean<{ order: number; importKey: string }>();
    expect(q?.order).toBe(2);
    expect(q?.importKey).toMatch(/^js-/);
  });

  it("returns field errors for invalid input", async () => {
    const book = await seedBook("js");
    const empty = await saveQuestion(questionInput(book, { question: "  " }), ADMIN);
    expect(empty).toMatchObject({ ok: false, errors: { question: expect.any(String) } });
    const badPart = await saveQuestion(questionInput(book, { partKey: "nope" }), ADMIN);
    expect(badPart).toMatchObject({ ok: false, errors: { partKey: expect.any(String) } });
  });
});

describe("moveItem", () => {
  it("swaps order with the neighbour in the same book", async () => {
    const book = await seedBook("js");
    const [q1, q2, q3] = await seedQuestions(book, 3);
    const other = await seedBook("css");
    await seedQuestions(other, 2);

    expect(await moveItem("question", q2, "up", ADMIN)).toEqual({ ok: true, id: q2 });
    const order = async (id: string) => (await Question.findById(id).lean<{ order: number }>())?.order;
    expect([await order(q1), await order(q2), await order(q3)]).toEqual([1, 0, 2]);
    expect(await moveItem("question", q2, "up", ADMIN)).toMatchObject({ ok: false });
  });
});

describe("setStatus", () => {
  it("archives without deleting", async () => {
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 1);
    expect(await setStatus("question", q, "archived", ADMIN)).toEqual({ ok: true, id: q });
    expect((await Question.findById(q).lean<{ status: string }>())?.status).toBe("archived");
    expect(await Revision.countDocuments({ entityId: q })).toBe(1);
  });
});

describe("setQuestionTopicLink", () => {
  it("adds the question once and removes it again", async () => {
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 1);
    const node = await seedNode(await seedGraph("g"), "closures");
    const ids = async () =>
      ((await GraphNode.findById(node).lean<{ related: { questionIds: unknown[] } }>())?.related.questionIds ?? []).map(String);

    await setQuestionTopicLink(q, node, true, ADMIN);
    await setQuestionTopicLink(q, node, true, ADMIN);
    expect(await ids()).toEqual([q]);
    await setQuestionTopicLink(q, node, false, ADMIN);
    expect(await ids()).toEqual([]);
  });
});
