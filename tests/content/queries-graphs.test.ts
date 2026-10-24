import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getGraphView, listGraphsWithProgress } from "@/content/queries";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteSeries } from "@/models";
import { setNodeStatus } from "@/progress/graph";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedGraph, seedNode, seedQuestions } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

describe("listGraphsWithProgress", () => {
  it("lists visible graphs with done over visible topics", async () => {
    const user = newUserId();
    const g = await seedGraph("js");
    const a = await seedNode(g, "a");
    await seedNode(g, "b");
    const later = await seedNode(g, "c");
    await seedGraph("draft-graph", "draft");
    await setNodeStatus(user, a, "done");
    await setNodeStatus(user, later, "done");
    await GraphNode.updateOne({ _id: later }, { status: "archived" });

    expect(await listGraphsWithProgress(user)).toEqual([{ slug: "js", title: "js title", done: 1, total: 2 }]);
  });
});

describe("getGraphView", () => {
  it("returns null for a graph users cannot see", async () => {
    await seedGraph("draft-graph", "draft");
    expect(await getGraphView(newUserId(), "draft-graph")).toBeNull();
    expect(await getGraphView(newUserId(), "missing")).toBeNull();
  });

  it("resolves visible related questions and notes and drops hidden ones", async () => {
    const user = newUserId();
    const book = await seedBook("js-book");
    const [q1, q2] = await seedQuestions(book, 2);
    const [draftQ] = await seedQuestions(book, 1, "p1", "draft");
    const series = await NoteSeries.create({ slug: "js-notes", title: "JS notes", status: "published" });
    const note = await Note.create({
      seriesId: series._id,
      slug: "internals",
      title: "Internals",
      status: "published",
      toc: [{ depth: 2, text: "Closures", anchor: "closures" }],
    });
    const hiddenNote = await Note.create({ seriesId: series._id, slug: "draft", title: "Draft", status: "draft" });
    const g = await seedGraph("js");
    await Graph.updateOne({ _id: g }, { tracks: [{ key: "t", name: "Track", order: 0 }] });
    const a = await seedNode(g, "a", { order: 0 });
    const b = await seedNode(g, "b", { order: 1, questionIds: [q2, q1, draftQ] });
    const hiddenNode = await seedNode(g, "h", { order: 2, status: "draft" });
    await GraphNode.updateOne(
      { _id: b },
      {
        prereqIds: [a, hiddenNode],
        "related.notes": [
          { noteId: note._id, anchor: "closures" },
          { noteId: note._id, anchor: "" },
          { noteId: hiddenNote._id, anchor: "" },
        ],
      },
    );
    await setNodeStatus(user, a, "done");

    const view = await getGraphView(user, "js");
    expect(view?.graph).toMatchObject({ slug: "js", title: "js title", tracks: [{ key: "t", name: "Track" }] });
    expect(view?.nodes.map((n) => n.slug)).toEqual(["a", "b"]);
    const nodeB = view!.nodes[1];
    expect(nodeB.prereqIds).toEqual([a]);
    expect(nodeB.related.questions).toEqual([
      { id: q2, title: "p1 question 1", href: `/interview/js-book/${q2}` },
      { id: q1, title: "p1 question 0", href: `/interview/js-book/${q1}` },
    ]);
    expect(nodeB.related.notes).toEqual([
      { title: "Internals § Closures", href: "/notes/js-notes/internals#closures" },
      { title: "Internals", href: "/notes/js-notes/internals" },
    ]);
    expect(view?.progress).toEqual({ [a]: "done" });
  });
});
