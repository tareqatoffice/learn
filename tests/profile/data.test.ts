import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsSpeakingAttempt, Note, NoteProgress, QuizSession, SpeakingTake } from "@/models";
import { openNote, setNoteRead } from "@/progress/notes";
import { createSession, finishSession, recordResult, type QuizFilter } from "@/progress/quiz";
import { fillActivity, getProfileData, parseTab, streakOf } from "@/profile/data";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedNote, seedQuestions, seedSeries } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const now = new Date("2026-11-12T10:00:00Z");
const who = { name: "Sam" };
const media = { kind: "audio", key: "k", mime: "audio/webm", durationSec: 5, capSec: 60 };
const all: QuizFilter = { bookIds: [], partKeys: [], mode: "all", size: null };

describe("parseTab", () => {
  it("falls back to overview for unknown or missing values", () => {
    expect(parseTab(undefined)).toBe("overview");
    expect(parseTab("nope")).toBe("overview");
    expect(parseTab("speaking")).toBe("speaking");
  });
});

describe("fillActivity and streakOf", () => {
  it("fills missing days with zero, oldest first, ending today", () => {
    const days = fillActivity(new Map([["2026-11-12", 2]]), "2026-11-12", 3);
    expect(days).toEqual([
      { date: "2026-11-10", count: 0 },
      { date: "2026-11-11", count: 0 },
      { date: "2026-11-12", count: 2 },
    ]);
  });

  it("counts a streak ending today", () => {
    const days = fillActivity(new Map([["2026-11-12", 1], ["2026-11-11", 1], ["2026-11-09", 1]]), "2026-11-12", 5);
    expect(streakOf(days)).toBe(2);
  });

  it("keeps the streak alive when today has no activity yet", () => {
    const days = fillActivity(new Map([["2026-11-11", 1], ["2026-11-10", 1]]), "2026-11-12", 5);
    expect(streakOf(days)).toBe(2);
  });

  it("is zero after a gap of a full day", () => {
    const days = fillActivity(new Map([["2026-11-10", 1]]), "2026-11-12", 5);
    expect(streakOf(days)).toBe(0);
  });
});

describe("getProfileData", () => {
  it("returns empty areas for a new user", async () => {
    const d = await getProfileData(newUserId(), who, "UTC", now);
    expect(d.name).toBe("Sam");
    expect(d.streak).toBe(0);
    expect(d.notes.history).toEqual([]);
    expect(d.interview.history).toEqual([]);
    expect(d.speaking.takes).toBe(0);
    expect(d.ielts.attempts).toBe(0);
  });

  it("returns empty areas for an id that is not an ObjectId", async () => {
    const d = await getProfileData("dev-user", who, "UTC", now);
    expect(d.joined).toBeNull();
    expect(d.notes.history).toEqual([]);
    expect(d.activity.at(-1)).toEqual({ date: "2026-11-12", count: 0 });
  });

  it("does not mix in another user's progress", async () => {
    const s = await seedSeries("docker");
    const n = await seedNote(s, "intro");
    const other = newUserId();
    await openNote(other, n);
    await setNoteRead(other, n, true);

    const d = await getProfileData(newUserId(), who);
    expect(d.notes.read).toBe(0);
    expect(d.notes.history).toEqual([]);
  });

  describe("notes", () => {
    it("lists read chapters and counts them on the day they were read", async () => {
      const user = newUserId();
      const s = await seedSeries("docker");
      const n = await seedNote(s, "intro");
      await openNote(user, n);
      await setNoteRead(user, n, true);
      await NoteProgress.updateOne({ userId: user, noteId: n }, { readAt: new Date("2026-11-11T12:00:00Z") });

      const d = await getProfileData(user, who, "UTC", now);
      expect(d.notes.read).toBe(1);
      expect(d.notes.history).toEqual([{ chapter: expect.any(String), chapterSlug: "intro", series: expect.any(String), seriesSlug: "docker", date: "2026-11-11" }]);
      expect(d.activity.at(-2)?.count).toBe(1);
      expect(d.streak).toBe(1);
    });

    it("puts a late-night read on the learner's local day, not the UTC day", async () => {
      const user = newUserId();
      const s = await seedSeries("docker");
      const n = await seedNote(s, "intro");
      await openNote(user, n);
      await setNoteRead(user, n, true);
      // 23:00 UTC on the 12th is 03:00 on the 13th in Dubai (UTC+4).
      await NoteProgress.updateOne({ userId: user, noteId: n }, { readAt: new Date("2026-11-12T23:00:00Z") });

      const d = await getProfileData(user, who, "Asia/Dubai", new Date("2026-11-13T05:00:00Z"));
      expect(d.activity.at(-1)).toEqual({ date: "2026-11-13", count: 1 });
      expect(d.activity.at(-2)).toEqual({ date: "2026-11-12", count: 0 });
      expect(d.notes.history[0].date).toBe("2026-11-13");
    });

    it("leaves unpublished chapters out of history and the heatmap", async () => {
      const user = newUserId();
      const s = await seedSeries("docker");
      const hidden = await seedNote(s, "hidden");
      await openNote(user, hidden);
      await setNoteRead(user, hidden, true);
      await Note.updateOne({ _id: hidden }, { status: "draft" });

      const d = await getProfileData(user, who);
      expect(d.notes.history).toEqual([]);
      expect(d.activity.every((day) => day.count === 0)).toBe(true);
    });
  });

  describe("interview", () => {
    it("lists finished quizzes with their counts and heatmap day", async () => {
      const user = newUserId();
      const book = await seedBook("js");
      await seedQuestions(book, 2);
      const created = await createSession(user, all);
      if (!("sessionId" in created)) throw new Error("expected a session");
      // The deck is shuffled and cards are answered in deck order.
      const session = await QuizSession.findById(created.sessionId).lean<{ questionIds: unknown[] }>();
      for (const q of session!.questionIds) await recordResult(user, created.sessionId, String(q), "got");
      await finishSession(user, created.sessionId);

      const d = await getProfileData(user, who);
      expect(d.interview.quizzes).toBe(1);
      expect(d.interview.history).toHaveLength(1);
      expect(d.interview.history[0]).toMatchObject({ got: 2, review: 0 });
      expect(d.interview.mastered).toBe(2);
      expect(d.activity.at(-1)?.count).toBe(1);
    });

    it("ignores quizzes that are not finished", async () => {
      const user = newUserId();
      const book = await seedBook("js");
      await seedQuestions(book, 1);
      await createSession(user, all);

      const d = await getProfileData(user, who);
      expect(d.interview.quizzes).toBe(0);
      expect(d.interview.history).toEqual([]);
    });
  });

  describe("speaking", () => {
    it("counts takes per task, lists the newest first and buckets them by their own date", async () => {
      const user = newUserId();
      await SpeakingTake.create({ userId: user, date: "2026-11-10", task: "shadowing", media });
      await SpeakingTake.create({ userId: user, date: "2026-11-12", task: "readAloud", media });
      await SpeakingTake.create({ userId: user, date: "2026-11-12", task: "readAloud", media });

      const d = await getProfileData(user, who, "UTC", now);
      expect(d.speaking.takes).toBe(3);
      expect(d.speaking.byTask).toEqual(expect.arrayContaining([{ task: "Read aloud", count: 2 }, { task: "Shadowing", count: 1 }]));
      expect(d.speaking.history.map((t) => t.date)).toEqual(["2026-11-12", "2026-11-12", "2026-11-10"]);
      expect(d.activity.at(-1)?.count).toBe(2);
    });

    it("keeps old takes in the totals but out of the heatmap window", async () => {
      const user = newUserId();
      await SpeakingTake.create({ userId: user, date: "2026-01-01", task: "shadowing", media });

      const d = await getProfileData(user, who, "UTC", now);
      expect(d.speaking.takes).toBe(1);
      expect(d.activity.every((day) => day.count === 0)).toBe(true);
    });
  });

  describe("ielts", () => {
    it("counts attempts and completed ones, with the AI overall on the history rows", async () => {
      const user = newUserId();
      await IeltsSpeakingAttempt.create({ userId: user, date: "2026-11-11", kind: "part1", status: "inProgress" });
      await IeltsSpeakingAttempt.create({ userId: user, date: "2026-11-12", kind: "mock", status: "complete", ai: { overall: 6.5 } });

      const d = await getProfileData(user, who, "UTC", now);
      expect(d.ielts.attempts).toBe(2);
      expect(d.ielts.completed).toBe(1);
      expect(d.ielts.history[0]).toMatchObject({ date: "2026-11-12", kind: "mock", overall: 6.5 });
      expect(d.ielts.history[1].overall).toBeUndefined();
      expect(d.activity.at(-1)?.count).toBe(1);
    });

    it("lists band results newest first", async () => {
      const user = newUserId();
      await IeltsBandEntry.create({ userId: user, date: "2026-10-01", source: "practice", bands: { speaking: 6 }, overall: 6 });
      await IeltsBandEntry.create({ userId: user, date: "2026-11-01", source: "official", bands: { speaking: 7 }, overall: 7 });

      const d = await getProfileData(user, who, "UTC", now);
      expect(d.ielts.bands.map((b) => b.overall)).toEqual([7, 6]);
    });
  });
});
