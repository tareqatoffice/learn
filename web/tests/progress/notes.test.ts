import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Note, NoteProgress } from "@/models";
import { getSeriesProgress, openNote, setNoteRead } from "@/progress/notes";
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
