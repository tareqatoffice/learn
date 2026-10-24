import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteProgress, Question } from "@/models";
import { getDashboard } from "@/progress/dashboard";
import { setNodeStatus } from "@/progress/graph";
import { openNote, setNoteRead } from "@/progress/notes";
import { markQuestion } from "@/progress/questions";
import { createSession, recordResult } from "@/progress/quiz";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedGraph, seedNode, seedNote, seedQuestions, seedSeries } from "./seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const zero = () => 0;

/** One user with progress across every section. */
async function fixtures() {
  const user = newUserId();
  const js = await seedBook("js");
  const [q1, q2, q3] = await seedQuestions(js, 3);
  const css = await seedBook("css");
  const [c1] = await seedQuestions(css, 2);
  await markQuestion(user, q1, "got");
  await markQuestion(user, q2, "review");
  await markQuestion(user, c1, "review");

  const g = await seedGraph("js-graph");
  const a = await seedNode(g, "a", { order: 0 });
  const b = await seedNode(g, "b", { order: 1 });
  const c = await seedNode(g, "c", { order: 2 });
  const d = await seedNode(g, "d", { order: 3 });
  await GraphNode.updateOne({ _id: c }, { prereqIds: [a] });
  await GraphNode.updateOne({ _id: d }, { prereqIds: [b] });
  await setNodeStatus(user, a, "done");
  await setNodeStatus(user, b, "learning");
  const untouched = await seedGraph("go");
  await seedNode(untouched, "go-a");

  const s = await seedSeries("docker");
  const n1 = await seedNote(s, "intro");
  const n2 = await seedNote(s, "net");
  await Note.updateOne({ _id: n2 }, { order: 1 });
  await openNote(user, n1);
  await setNoteRead(user, n1, true);
  await openNote(user, n2);
  await NoteProgress.updateOne({ userId: user, noteId: n2 }, { lastOpenedAt: new Date(Date.now() + 1000) });

  const session = await createSession(user, { bookIds: [js], partKeys: [], mode: "all", size: null, questionIds: [q3] }, zero);
  if (!("sessionId" in session)) throw new Error("expected a session");
  await recordResult(user, session.sessionId, q3, "got", zero);

  return { user, q2, g, n2, s };
}

describe("getDashboard", () => {
  it("fills every section for a user with progress", async () => {
    const { user } = await fixtures();
    const dash = await getDashboard(user);

    expect(dash.continueReading).toEqual({
      seriesSlug: "docker",
      seriesTitle: "docker title",
      chapterSlug: "net",
      chapterTitle: "net title",
      read: 1,
      total: 2,
    });
    expect(dash.learningNow).toEqual([{ graphSlug: "js-graph", graphTitle: "js-graph title", topics: [{ slug: "b", title: "b title" }] }]);
    expect(dash.readyNext).toEqual([{ graphSlug: "js-graph", slug: "c", title: "c title" }]);
    expect(dash.reviewPile).toEqual({
      total: 2,
      byBook: [
        { slug: "css", title: "css title", count: 1 },
        { slug: "js", title: "js title", count: 1 },
      ],
    });
    expect(dash.graphs).toEqual([
      { slug: "go", title: "go title", done: 0, total: 1 },
      { slug: "js-graph", title: "js-graph title", done: 1, total: 4 },
    ]);
    expect(dash.books).toEqual([
      { slug: "css", title: "css title", mastered: 0, total: 2 },
      { slug: "js", title: "js title", mastered: 2, total: 3 },
    ]);
    expect(dash.series).toEqual([{ slug: "docker", title: "docker title", read: 1, total: 2 }]);
    expect(dash.recentQuizzes).toHaveLength(1);
    expect(dash.recentQuizzes[0]).toMatchObject({ label: "js title", got: 1, review: 0 });
    expect(dash.recentQuizzes[0].finishedAt).toBeInstanceOf(Date);
  });

  it("drops archived and draft content from every section", async () => {
    const { user, q2, g, n2 } = await fixtures();
    await Question.updateOne({ _id: q2 }, { status: "archived" });
    await Graph.updateOne({ _id: g }, { status: "draft" });
    await Note.updateOne({ _id: n2 }, { status: "archived" });

    const dash = await getDashboard(user);
    expect(dash.reviewPile).toEqual({ total: 1, byBook: [{ slug: "css", title: "css title", count: 1 }] });
    expect(dash.books.find((b) => b.slug === "js")).toMatchObject({ total: 2 });
    expect(dash.graphs.map((x) => x.slug)).toEqual(["go"]);
    expect(dash.learningNow).toEqual([]);
    expect(dash.readyNext).toEqual([]);
    expect(dash.continueReading).toMatchObject({ chapterSlug: "intro", read: 1, total: 1 });
  });

  it("falls back to null when no opened chapter is visible", async () => {
    const { user, s } = await fixtures();
    await Note.updateMany({ seriesId: s }, { status: "archived" });
    expect((await getDashboard(user)).continueReading).toBeNull();
  });

  it("gives a new user empty progress", async () => {
    await fixtures();
    const dash = await getDashboard(newUserId());
    expect(dash.continueReading).toBeNull();
    expect(dash.learningNow).toEqual([]);
    expect(dash.readyNext).toEqual([]);
    expect(dash.reviewPile).toEqual({ total: 0, byBook: [] });
    expect(dash.recentQuizzes).toEqual([]);
    expect(dash.graphs.every((x) => x.done === 0)).toBe(true);
    expect(dash.books.every((x) => x.mastered === 0)).toBe(true);
  });
});
