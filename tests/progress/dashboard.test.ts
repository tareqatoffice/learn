import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteProgress, Question } from "@/models";
import { saveProfile as saveExerciseProfile } from "@/features/exercise/profile";
import { finishSession, saveSet, startSession } from "@/features/exercise/sessions";
import { logWeight } from "@/features/exercise/weights";
import { ensureWeek } from "@/features/exercise/weeks";
import { endPlan, saveProfile } from "@/features/ielts/profile";
import { getDashboard } from "@/features/progress/dashboard";
import { setNodeStatus } from "@/features/progress/graph";
import { openNote, setNoteRead } from "@/features/progress/notes";
import { markQuestion } from "@/features/progress/questions";
import { createSession, recordResult } from "@/features/progress/quiz";
import { resetDb } from "../setup/mongo";
import { seedExercises } from "../exercise/fixtures";
import { newUserId, seedBook, seedGraph, seedNode, seedNote, seedQuestions, seedSeries } from "./seed";

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  await seedExercises();
});
afterAll(() => mongoose.disconnect());

const zero = () => 0;

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
    expect(dash.recentQuizzes[0]).toMatchObject({ finished: true, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
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

  it("points Continue reading at the next unread chapter when the last opened one is read (F18)", async () => {
    const { user, n2, s } = await fixtures();
    const n3 = await seedNote(s, "vol");
    await Note.updateOne({ _id: n3 }, { order: 2 });
    await setNoteRead(user, n2, true);
    expect((await getDashboard(user)).continueReading).toMatchObject({ chapterSlug: "vol", read: 2, total: 3 });
    await setNoteRead(user, n3, true);
    expect((await getDashboard(user)).continueReading).toMatchObject({ chapterSlug: "net" });
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

  it("shows ielts only with a profile, with days left from local today", async () => {
    const user = newUserId();
    const now = new Date("2026-11-11T23:30:00Z");
    expect((await getDashboard(user, "UTC", now)).ielts).toBeUndefined();

    const res = await saveProfile(
      user,
      { testDate: "2026-12-11", target: { overall: 7 }, current: { overall: 6 }, minutesPerDay: 60, studyDays: [0, 1, 2, 3, 4, 5, 6] },
      "2026-11-11",
    );
    expect(res.ok).toBe(true);
    const utc = (await getDashboard(user, "UTC", now)).ielts;
    expect(utc).toMatchObject({ daysLeft: 30, done: 0 });
    expect(utc!.total).toBeGreaterThan(0);
    expect((await getDashboard(user, "Pacific/Auckland", now)).ielts).toMatchObject({ daysLeft: 29 });

    await endPlan(user);
    expect((await getDashboard(user, "UTC", now)).ielts).toBeUndefined();
  });

  it("marks the ielts card on test day and once the test has passed", async () => {
    const user = newUserId();
    const res = await saveProfile(
      user,
      { testDate: "2026-12-11", target: { overall: 7 }, current: { overall: 6 }, minutesPerDay: 60, studyDays: [0, 1, 2, 3, 4, 5, 6] },
      "2026-11-11",
    );
    expect(res.ok).toBe(true);
    expect((await getDashboard(user, "UTC", new Date("2026-11-11T12:00:00Z"))).ielts).toMatchObject({ testDay: "upcoming" });
    expect((await getDashboard(user, "UTC", new Date("2026-12-11T12:00:00Z"))).ielts).toMatchObject({ daysLeft: 0, testDay: "today" });
    expect((await getDashboard(user, "UTC", new Date("2026-12-14T12:00:00Z"))).ielts).toMatchObject({ testDay: "passed" });
  });

  it("omits exercise when there is no active profile", async () => {
    expect((await getDashboard(newUserId(), "UTC", new Date("2026-11-11T12:00:00Z"))).exercise).toBeUndefined();
  });

  it("retires an expired goal before building the exercise card", async () => {
    const user = newUserId();
    await saveExerciseProfile(
      user,
      { heightCm: 175, birthYear: 1990, sex: "male", level: "beginner", workoutDays: [1, 3, 5], minutesPerSession: 30, startWeightKg: 80, goalWeightKg: 77, months: 1 },
      "2026-11-02",
    );
    expect((await getDashboard(user, "UTC", new Date("2026-12-20T12:00:00Z"))).exercise).toBeUndefined();
  });

  it("reports this week's done/planned, last weight and streak", async () => {
    const user = newUserId();
    const res = await saveExerciseProfile(
      user,
      { heightCm: 175, birthYear: 1990, sex: "male", level: "intermediate", workoutDays: [1, 3, 5], minutesPerSession: 45, startWeightKg: 80, goalWeightKg: 72, months: 3 },
      "2026-11-02",
    );
    expect(res.ok).toBe(true);
    for (const w of ["2026-11-02", "2026-11-09"]) await ensureWeek(user, w);
    for (const d of ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09"]) {
      await startSession(user, d);
      await saveSet(user, d, 0, "done");
      await finishSession(user, d, {});
    }
    await logWeight(user, "2026-11-10", 79.6, "2026-11-11");
    const card = (await getDashboard(user, "UTC", new Date("2026-11-11T12:00:00Z"))).exercise;
    expect(card).toMatchObject({ done: 1, planned: 3, lastKg: 79.6, streak: 4 });
    expect(["onPace", "ahead", "behind"]).toContain(card!.status);
    expect(card!.gapKg).toBeGreaterThanOrEqual(0);
  });
});
