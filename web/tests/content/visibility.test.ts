import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import {
  visibleBookIds,
  visibleGraphIds,
  visibleNodeFilter,
  visibleNoteFilter,
  visibleQuestionFilter,
  visibleSeriesIds,
} from "@/content/visibility";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";
import { resetDb } from "../setup/mongo";

const q = (bookId: unknown, question: string, status: string) =>
  Question.create({ bookId, partKey: "p", question, answer: "a", status });

describe("visibility", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("lists only published parents", async () => {
    const pub = await QuestionBook.create({ slug: "pub", title: "P", status: "published" });
    await QuestionBook.create({ slug: "draft", title: "D", status: "draft" });
    await QuestionBook.create({ slug: "arch", title: "A", status: "archived" });
    expect((await visibleBookIds()).map(String)).toEqual([String(pub._id)]);

    const g = await Graph.create({ slug: "g", title: "G", status: "published" });
    await Graph.create({ slug: "g2", title: "G2", status: "draft" });
    expect((await visibleGraphIds()).map(String)).toEqual([String(g._id)]);

    const s = await NoteSeries.create({ slug: "s", title: "S", status: "published" });
    await NoteSeries.create({ slug: "s2", title: "S2", status: "archived" });
    expect((await visibleSeriesIds()).map(String)).toEqual([String(s._id)]);
  });

  it("excludes a published question in a draft book and an archived one in a published book", async () => {
    const pub = await QuestionBook.create({ slug: "pub", title: "P", status: "published" });
    const draft = await QuestionBook.create({ slug: "draft", title: "D", status: "draft" });
    await q(pub._id, "visible", "published");
    await q(pub._id, "archived", "archived");
    await q(pub._id, "drafted", "draft");
    await q(draft._id, "in-draft-book", "published");

    const found = await Question.find(await visibleQuestionFilter()).lean();
    expect(found.map((x) => x.question)).toEqual(["visible"]);
  });

  it("limits to the requested books but never widens past visible ones", async () => {
    const a = await QuestionBook.create({ slug: "a", title: "A", status: "published" });
    const b = await QuestionBook.create({ slug: "b", title: "B", status: "published" });
    const hidden = await QuestionBook.create({ slug: "h", title: "H", status: "draft" });
    await q(a._id, "qa", "published");
    await q(b._id, "qb", "published");
    await q(hidden._id, "qh", "published");

    const only = await Question.find(await visibleQuestionFilter([String(a._id)])).lean();
    expect(only.map((x) => x.question)).toEqual(["qa"]);
    const mixed = await Question.find(
      await visibleQuestionFilter([String(a._id), String(hidden._id)]),
    ).lean();
    expect(mixed.map((x) => x.question)).toEqual(["qa"]);
    expect(await Question.countDocuments(await visibleQuestionFilter([]))).toBe(0);
  });

  it("filters nodes by published graph and notes by published series", async () => {
    const g = await Graph.create({ slug: "g", title: "G", status: "published" });
    const gd = await Graph.create({ slug: "gd", title: "GD", status: "draft" });
    const node = (graphId: unknown, slug: string, status: string) =>
      GraphNode.create({ graphId, slug, trackKey: "t", title: slug, status });
    await node(g._id, "ok", "published");
    await node(g._id, "nope", "draft");
    await node(gd._id, "orphan", "published");
    expect((await GraphNode.find(await visibleNodeFilter()).lean()).map((n) => n.slug)).toEqual([
      "ok",
    ]);
    expect(await GraphNode.countDocuments(await visibleNodeFilter(String(gd._id)))).toBe(0);
    expect(await GraphNode.countDocuments(await visibleNodeFilter(String(g._id)))).toBe(1);

    const s = await NoteSeries.create({ slug: "s", title: "S", status: "published" });
    const sa = await NoteSeries.create({ slug: "sa", title: "SA", status: "archived" });
    const note = (seriesId: unknown, slug: string, status: string) =>
      Note.create({ seriesId, slug, title: slug, status });
    await note(s._id, "ok", "published");
    await note(s._id, "nope", "archived");
    await note(sa._id, "orphan", "published");
    expect((await Note.find(await visibleNoteFilter()).lean()).map((n) => n.slug)).toEqual(["ok"]);
    expect(await Note.countDocuments(await visibleNoteFilter(String(sa._id)))).toBe(0);
    expect(await Note.countDocuments(await visibleNoteFilter(String(s._id)))).toBe(1);
  });
});
