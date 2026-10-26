import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getBookView, getQuestionView, listBooksWithProgress } from "@/content/queries";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Question, QuestionBook } from "@/models";
import { markQuestion } from "@/progress/questions";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedGraph, seedNode, seedQuestions } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

describe("listBooksWithProgress", () => {
  it("excludes draft and archived books", async () => {
    const user = newUserId();
    const live = await seedBook("live");
    await seedQuestions(live, 2);
    const draft = await seedBook("draft", "draft");
    await seedQuestions(draft, 2);
    const archived = await seedBook("archived", "archived");
    await seedQuestions(archived, 2);

    const books = await listBooksWithProgress(user);
    expect(books.map((b) => b.slug)).toEqual(["live"]);
    expect(books[0]).toMatchObject({ title: "live title", total: 2, mastered: 0, review: 0 });
    expect(books[0].parts).toEqual([
      { key: "p1", title: "Part One" },
      { key: "p2", title: "Part Two" },
    ]);
  });

  it("counts mastered and review over visible questions only", async () => {
    const user = newUserId();
    const other = newUserId();
    const book = await seedBook("b");
    const ids = await seedQuestions(book, 4);
    const [hidden] = await seedQuestions(book, 1, "p2", "draft");
    await markQuestion(user, ids[0], "got");
    await markQuestion(user, ids[1], "got");
    await markQuestion(user, ids[2], "review");
    await markQuestion(user, ids[3], "skip");
    await markQuestion(user, hidden, "got");
    await markQuestion(other, ids[0], "got");

    const [row] = await listBooksWithProgress(user);
    expect(row).toMatchObject({ total: 4, mastered: 2, review: 1 });
  });

  it("drops mastered when its question is archived afterwards", async () => {
    const user = newUserId();
    const book = await seedBook("b");
    const ids = await seedQuestions(book, 3);
    await markQuestion(user, ids[0], "got");
    await Question.updateOne({ _id: ids[0] }, { status: "archived" });
    const [row] = await listBooksWithProgress(user);
    expect(row).toMatchObject({ total: 2, mastered: 0 });
  });

  it("orders books by their order field", async () => {
    await QuestionBook.create({ slug: "b2", title: "B2", order: 2, status: "published" });
    await QuestionBook.create({ slug: "b1", title: "B1", order: 1, status: "published" });
    expect((await listBooksWithProgress(newUserId())).map((b) => b.slug)).toEqual(["b1", "b2"]);
  });
});

describe("getBookView", () => {
  it("returns null for unknown, draft and archived books", async () => {
    await seedBook("draft", "draft");
    await seedBook("archived", "archived");
    for (const slug of ["nope", "draft", "archived"]) expect(await getBookView(newUserId(), slug)).toBeNull();
  });

  it("returns intro, extras, parts with progress and the question list with statuses", async () => {
    const user = newUserId();
    const book = await QuestionBook.create({
      slug: "b",
      title: "Book",
      intro: "About **this** book",
      status: "published",
      parts: [
        { key: "p1", title: "One", intro: "Intro one", order: 0 },
        { key: "p2", title: "Two", intro: "", order: 1 },
      ],
      extras: [
        { key: "e2", title: "Second", body: "b2", order: 1 },
        { key: "e1", title: "First", body: "b1", order: 0 },
      ],
    });
    const id = String(book._id);
    const p1 = await seedQuestions(id, 2, "p1");
    const p2 = await seedQuestions(id, 2, "p2");
    await seedQuestions(id, 1, "p2", "draft");
    await markQuestion(user, p1[0], "got");
    await markQuestion(user, p2[1], "review");

    const view = await getBookView(user, "b");
    expect(view!.book).toMatchObject({ id, slug: "b", title: "Book", intro: "About **this** book" });
    expect(view!.book.extras).toEqual([
      { key: "e1", title: "First", body: "b1" },
      { key: "e2", title: "Second", body: "b2" },
    ]);
    expect(view!.parts).toEqual([
      { key: "p1", title: "One", intro: "Intro one", total: 2, mastered: 1 },
      { key: "p2", title: "Two", intro: "", total: 2, mastered: 0 },
    ]);
    expect(view!.questions.map((q) => [q.id, q.partKey, q.status])).toEqual([
      [p1[0], "p1", "got"],
      [p1[1], "p1", null],
      [p2[0], "p2", null],
      [p2[1], "p2", "review"],
    ]);
  });
});

describe("getQuestionView", () => {
  it("returns the question with its book and graph topic", async () => {
    const book = await seedBook("b");
    const [id] = await seedQuestions(book, 1);
    const graph = await seedGraph("g");
    await seedNode(graph, "closures", { questionIds: [id] });

    const view = await getQuestionView("b", id);
    expect(view).toMatchObject({
      question: { id, question: "p1 question 0", prompt: "prompt 0", answer: "answer 0" },
      book: { slug: "b", title: "b title" },
      topic: { graphSlug: "g", nodeSlug: "closures", title: "closures title" },
    });
  });

  it("omits the topic when the node or its graph is hidden", async () => {
    const book = await seedBook("b");
    const [id] = await seedQuestions(book, 1);
    const graph = await seedGraph("g");
    await seedNode(graph, "n", { questionIds: [id], status: "draft" });
    expect((await getQuestionView("b", id))!.topic).toBeUndefined();
    await GraphNode.updateMany({}, { status: "published" });
    await Graph.updateMany({}, { status: "draft" });
    expect((await getQuestionView("b", id))!.topic).toBeUndefined();
  });

  it("steps into the next section and lists each section's first question", async () => {
    const book = await seedBook("b");
    const p1 = await seedQuestions(book, 2, "p1");
    const p2 = await seedQuestions(book, 1, "p2");
    await seedQuestions(book, 1, "p2", "draft");

    const first = await getQuestionView("b", p1[0]);
    expect(first!.prev).toBeUndefined();
    expect(first!.part).toEqual({ key: "p1", title: "Part One" });
    expect(first!.next).toMatchObject({ id: p1[1], partKey: "p1", partTitle: "Part One", question: "p1 question 1" });
    expect(first!.parts).toEqual([
      { key: "p1", title: "Part One", firstQuestionId: p1[0] },
      { key: "p2", title: "Part Two", firstQuestionId: p2[0] },
    ]);

    const lastOfSection = await getQuestionView("b", p1[1]);
    expect(lastOfSection!.next).toMatchObject({ id: p2[0], partKey: "p2", partTitle: "Part Two" });
    expect(lastOfSection!.prev).toMatchObject({ id: p1[0], partKey: "p1" });

    const end = await getQuestionView("b", p2[0]);
    expect(end!.next).toBeUndefined();
    expect(end!.prev).toMatchObject({ id: p1[1], partKey: "p1", partTitle: "Part One" });
  });

  it("follows section order, skips hidden questions, and leaves questions outside a section unlinked", async () => {
    const book = await QuestionBook.create({
      slug: "b",
      title: "Book",
      status: "published",
      parts: [
        { key: "later", title: "Later", order: 1 },
        { key: "early", title: "Early", order: 0 },
        { key: "empty", title: "Empty", order: 2 },
      ],
    });
    const id = String(book._id);
    const [later] = await seedQuestions(id, 1, "later");
    await Question.updateOne({ _id: later }, { order: -5 });
    const orphan = await Question.create({
      bookId: id,
      partKey: "missing",
      order: -9,
      question: "orphan",
      answer: "a",
      status: "published",
    });
    const [earlyFirst] = await seedQuestions(id, 1, "early");
    const [hidden] = await seedQuestions(id, 1, "early", "draft");
    const [earlySecond] = await seedQuestions(id, 1, "early");
    await Question.updateOne({ _id: earlyFirst }, { order: 1 });
    await Question.updateOne({ _id: earlySecond }, { order: 0 });

    const start = await getQuestionView("b", earlySecond);
    expect(start!.prev).toBeUndefined();
    expect(start!.next).toMatchObject({ id: earlyFirst, partKey: "early" });
    expect(start!.next!.id).not.toBe(hidden);
    expect(start!.parts).toEqual([
      { key: "early", title: "Early", firstQuestionId: earlySecond },
      { key: "later", title: "Later", firstQuestionId: later },
      { key: "empty", title: "Empty" },
    ]);

    const lastOfEarly = await getQuestionView("b", earlyFirst);
    expect(lastOfEarly!.next).toMatchObject({ id: later, partKey: "later", partTitle: "Later" });

    const orphanView = await getQuestionView("b", String(orphan._id));
    expect(orphanView!.part).toEqual({ key: "missing", title: "" });
    expect(orphanView!.prev).toBeUndefined();
    expect(orphanView!.next).toBeUndefined();

    const listed = await getBookView(newUserId(), "b");
    expect(listed!.questions.map((q) => q.id)).toEqual([earlySecond, earlyFirst, later, String(orphan._id)]);
  });

  it("returns null for hidden, wrong-book and malformed requests", async () => {
    const book = await seedBook("b");
    const [id] = await seedQuestions(book, 1);
    const [draftQ] = await seedQuestions(book, 1, "p1", "draft");
    await seedBook("other");
    const draftBook = await seedBook("draft", "draft");
    const [inDraftBook] = await seedQuestions(draftBook, 1);

    expect(await getQuestionView("b", draftQ)).toBeNull();
    expect(await getQuestionView("other", id)).toBeNull();
    expect(await getQuestionView("draft", inDraftBook)).toBeNull();
    expect(await getQuestionView("b", "not-an-id")).toBeNull();
    expect(await getQuestionView("b", String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
