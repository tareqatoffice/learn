import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { Note, NoteProgress } from "@/models";
import {
  getNotePosition,
  getSeriesProgress,
  getStudyNotes,
  openNote,
  saveRecitation,
  setNotePosition,
  setNoteRead,
  setPreQuestions,
} from "@/features/progress/notes";
import { NoteRecitation } from "@/models";
import { resetDb } from "../setup/mongo";
import { newUserId, seedNote, seedSeries } from "./seed";

type Row = { read: boolean; readAt?: Date; lastOpenedAt?: Date; seriesId: unknown };

describe("note progress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());
  afterAll(() => mongoose.disconnect());

  it("openNote twice updates lastOpenedAt and leaves one doc", async () => {
    const user = newUserId();
    const seriesId = await seedSeries("s");
    const note = await seedNote(seriesId, "n");
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    await openNote(user, note);
    vi.setSystemTime(new Date("2026-02-03T00:00:00Z"));
    await openNote(user, note);

    const docs = await NoteProgress.find({}).lean<Row[]>();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ read: false, lastOpenedAt: new Date("2026-02-03T00:00:00Z") });
    expect(String(docs[0].seriesId)).toBe(seriesId);
  });

  it("setNoteRead marks and unmarks read without touching lastOpenedAt", async () => {
    const user = newUserId();
    const note = await seedNote(await seedSeries("s"), "n");
    await openNote(user, note);
    const opened = (await NoteProgress.findOne({}).lean<Row>())!.lastOpenedAt;

    await setNoteRead(user, note, true);
    const read = await NoteProgress.findOne({}).lean<Row>();
    expect(read).toMatchObject({ read: true, lastOpenedAt: opened });
    expect(read!.readAt).toBeInstanceOf(Date);

    await setNoteRead(user, note, false);
    const unread = await NoteProgress.findOne({}).lean<Row>();
    expect(unread!.read).toBe(false);
    expect(unread!.readAt).toBeUndefined();
    expect(await NoteProgress.countDocuments()).toBe(1);
  });

  it("setNoteRead creates the doc when the note was never opened", async () => {
    const user = newUserId();
    const seriesId = await seedSeries("s");
    const note = await seedNote(seriesId, "n");

    await setNoteRead(user, note, true);

    const doc = await NoteProgress.findOne({ userId: user, noteId: note }).lean<Row>();
    expect(doc).toMatchObject({ read: true });
    expect(String(doc!.seriesId)).toBe(seriesId);
  });

  it("saves a reading position per user and note, keeping it through read toggles", async () => {
    const user = newUserId();
    const note = await seedNote(await seedSeries("s"), "n");
    expect(await getNotePosition(user, note)).toBeUndefined();

    await setNotePosition(user, note, "intro");
    await setNotePosition(user, note, "details");
    await setNoteRead(user, note, true);

    expect(await getNotePosition(user, note)).toBe("details");
    expect(await getNotePosition(newUserId(), note)).toBeUndefined();
    expect(await NoteProgress.countDocuments()).toBe(1);
    expect(await getNotePosition(user, "not-an-id")).toBeUndefined();

    await setNotePosition(user, note, null);
    expect(await getNotePosition(user, note)).toBeUndefined();
    expect((await NoteProgress.findOne({ userId: user, noteId: note }).lean<Row>())?.read).toBe(true);
  });

  it("keeps pre-read questions per note, trimmed and capped", async () => {
    const user = newUserId();
    const note = await seedNote(await seedSeries("s"), "n");

    await setPreQuestions(user, note, ["  What is a bridge? ", "", "Why ports?", "Third", "Fourth"]);
    expect((await getStudyNotes(user, note)).preQuestions).toEqual(["What is a bridge?", "Why ports?", "Third"]);
    expect((await getStudyNotes(newUserId(), note)).preQuestions).toEqual([]);

    await setPreQuestions(user, note, ["", "  "]);
    expect((await getStudyNotes(user, note)).preQuestions).toEqual([]);
    expect(await NoteProgress.countDocuments()).toBe(1);
  });

  it("saves one recitation per section and updates it in place", async () => {
    const user = newUserId();
    const note = await seedNote(await seedSeries("s"), "n");
    await Note.updateOne({ _id: note }, { toc: [{ depth: 2, text: "Bridge", anchor: "bridge" }, { depth: 2, text: "Ports", anchor: "ports" }] });

    await saveRecitation(user, note, "bridge", "  Containers share a network  ", "review");
    await saveRecitation(user, note, "bridge", "Containers on a bridge reach each other", "got");
    await saveRecitation(user, note, "ports", "Ports are published with -p", "review");
    await saveRecitation(newUserId(), note, "bridge", "someone else", "got");

    expect(await NoteRecitation.countDocuments({ userId: user })).toBe(2);
    expect((await getStudyNotes(user, note)).recitations).toEqual({
      bridge: { text: "Containers on a bridge reach each other", verdict: "got" },
      ports: { text: "Ports are published with -p", verdict: "review" },
    });
  });

  it("rejects recitations for unknown sections, empty text and hidden notes", async () => {
    const user = newUserId();
    const note = await seedNote(await seedSeries("s"), "n");
    const draft = await seedNote(await seedSeries("hidden", "draft"), "n");
    await Note.updateOne({ _id: { $in: [note, draft] } }, { toc: [{ depth: 2, text: "Bridge", anchor: "bridge" }] });

    await expect(saveRecitation(user, note, "nope", "text", "got")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRecitation(user, note, "bridge", "   ", "got")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRecitation(user, draft, "bridge", "text", "got")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRecitation(user, "not-an-id", "bridge", "text", "got")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await NoteRecitation.countDocuments()).toBe(0);
    expect(await getStudyNotes(user, "not-an-id")).toEqual({ preQuestions: [], recitations: {} });
  });

  it("rejects notes that are not visible", async () => {
    const user = newUserId();
    const draft = await seedNote(await seedSeries("s"), "draft", "draft");
    const inDraftSeries = await seedNote(await seedSeries("hidden", "draft"), "n");

    await expect(openNote(user, draft)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setNoteRead(user, inDraftSeries, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(openNote(user, "not-an-id")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await NoteProgress.countDocuments()).toBe(0);
  });

  it("getSeriesProgress maps visible notes of the series, per user", async () => {
    const user = newUserId();
    const seriesId = await seedSeries("s");
    const a = await seedNote(seriesId, "a");
    const b = await seedNote(seriesId, "b");
    const c = await seedNote(seriesId, "c");
    const elsewhere = await seedNote(await seedSeries("s2"), "x");
    await openNote(user, a);
    await setNoteRead(user, b, true);
    await setNoteRead(user, c, true);
    await setNoteRead(user, elsewhere, true);
    await setNoteRead(newUserId(), a, true);
    await Note.updateOne({ _id: c }, { status: "archived" });

    expect(await getSeriesProgress(user, seriesId)).toEqual({ [a]: { read: false }, [b]: { read: true } });
  });
});
