import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Question, QuestionProgress, QuizSession } from "@/models";
import { markQuestion } from "@/progress/questions";
import {
  createSession,
  finishSession,
  getSessionView,
  listUnfinished,
  recordResult,
  requeueIndex,
  sessionLabel,
  type QuizFilter,
} from "@/progress/quiz";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedGraph, seedNode, seedQuestions } from "./seed";

type SessionRow = {
  questionIds: unknown[];
  results: { questionId: unknown; result: string }[];
  cursor: number;
  finishedAt?: Date;
  filter: { bookIds: unknown[]; partKeys: string[] };
};

const all = (over: Partial<QuizFilter> = {}): QuizFilter => ({ bookIds: [], partKeys: [], mode: "all", size: null, ...over });

async function start(user: string, filter: QuizFilter, rand?: () => number): Promise<string> {
  const created = await createSession(user, filter, rand);
  if (!("sessionId" in created)) throw new Error("expected a session");
  return created.sessionId;
}

const loadSession = async (id: string) => (await QuizSession.findById(id).lean<SessionRow>())!;
const deckOf = async (id: string) => (await loadSession(id)).questionIds.map(String);

describe("quiz sessions", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  describe("helpers", () => {
    it("requeueIndex reinserts 5-9 cards after the cursor, capped at the deck end", () => {
      expect(requeueIndex(10, 0, () => 0)).toBe(5);
      expect(requeueIndex(20, 0, () => 0.999)).toBe(9);
      expect(requeueIndex(20, 3, () => 0.5)).toBe(10);
      expect(requeueIndex(3, 1, () => 0)).toBe(3);
    });

    it("sessionLabel joins up to two books, says Mixed for more, and appends one part", () => {
      expect(sessionLabel(["CSS"])).toBe("CSS");
      expect(sessionLabel(["CSS", "HTML"])).toBe("CSS · HTML");
      expect(sessionLabel(["CSS", "HTML", "JS"])).toBe("Mixed");
      expect(sessionLabel(["CSS"], "Selectors")).toBe("CSS · Selectors");
    });
  });

  describe("createSession", () => {
    it("Review Focus 3: an empty review pile returns empty and creates no session", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);

      expect(await createSession(user, all({ mode: "review" }))).toEqual({ empty: true });
      expect(await QuizSession.countDocuments()).toBe(0);
    });

    it("Review Focus 3: questionIds [] returns empty and creates no session", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);

      expect(await createSession(user, all({ questionIds: [] }))).toEqual({ empty: true });
      expect(await QuizSession.countDocuments()).toBe(0);
    });

    it("Review Focus 3: unseen with everything seen returns empty", async () => {
      const user = newUserId();
      const ids = await seedQuestions(await seedBook("b"), 2);
      for (const id of ids) await markQuestion(user, id, "skip");

      expect(await createSession(user, all({ mode: "unseen" }))).toEqual({ empty: true });
      expect(await QuizSession.countDocuments()).toBe(0);
    });

    it("stores a shuffled deck of visible questions with cursor 0 and no results", async () => {
      const user = newUserId();
      const book = await seedBook("b");
      const ids = await seedQuestions(book, 4);
      await seedQuestions(book, 1, "p1", "draft");
      await seedQuestions(await seedBook("hidden", "draft"), 2);

      const sessionId = await start(user, all(), () => 0);
      const session = await loadSession(sessionId);
      expect(session.cursor).toBe(0);
      expect(session.results).toEqual([]);
      expect(session.questionIds.map(String).sort()).toEqual([...ids].sort());
      // Fisher-Yates with rand 0 rotates the sorted ids left by one.
      expect(session.questionIds.map(String)).toEqual([...ids.slice(1), ids[0]]);
    });

    it("slices the deck to size", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 12);

      expect(await deckOf(await start(user, all({ size: 10 })))).toHaveLength(10);
      expect(await deckOf(await start(user, all({ size: null })))).toHaveLength(12);
    });

    it("mode unseen excludes questions with progress; review takes only status review", async () => {
      const user = newUserId();
      const [seen, reviewed, fresh] = await seedQuestions(await seedBook("b"), 3);
      await markQuestion(user, seen, "got");
      await markQuestion(user, reviewed, "review");
      await markQuestion(newUserId(), fresh, "review");

      expect(await deckOf(await start(user, all({ mode: "unseen" })))).toEqual([fresh]);
      expect(await deckOf(await start(user, all({ mode: "review" })))).toEqual([reviewed]);
    });

    it("filters by books, and by parts only when exactly one book is selected", async () => {
      const user = newUserId();
      const a = await seedBook("a");
      const b = await seedBook("b");
      const [a1] = await seedQuestions(a, 1, "p1");
      const [a2] = await seedQuestions(a, 1, "p2");
      const [b1] = await seedQuestions(b, 1, "p1");
      const [b2] = await seedQuestions(b, 1, "p2");
      await seedQuestions(await seedBook("c"), 2);

      const one = await deckOf(await start(user, all({ bookIds: [a], partKeys: ["p1"] })));
      expect(one).toEqual([a1]);
      const two = await deckOf(await start(user, all({ bookIds: [a, b], partKeys: ["p1"] })));
      expect(two.sort()).toEqual([a1, a2, b1, b2].sort());
    });

    it("questionIds override books and parts, keep the mode and drop invisible ids", async () => {
      const user = newUserId();
      const a = await seedBook("a");
      const [a1] = await seedQuestions(a, 1);
      const [b1, b2] = await seedQuestions(await seedBook("b"), 2, "p2");
      const [draft] = await seedQuestions(a, 1, "p1", "draft");
      await markQuestion(user, b2, "got");

      const deck = await deckOf(
        await start(user, all({ bookIds: [a], partKeys: ["p1"], mode: "unseen", questionIds: [b1, b2, draft] })),
      );
      expect(deck).toEqual([b1]);
      expect(deck).not.toContain(a1);
    });
  });

  describe("getSessionView", () => {
    it("returns the current card with its book, part and first visible topic", async () => {
      const user = newUserId();
      const book = await seedBook("b");
      const [q] = await seedQuestions(book, 1, "p2");
      const hiddenGraph = await seedGraph("hidden", "draft");
      await seedNode(hiddenGraph, "hidden-node", { questionIds: [q] });
      const graph = await seedGraph("g");
      await seedNode(graph, "draft-node", { status: "draft", questionIds: [q] });
      await seedNode(graph, "topic", { questionIds: [q], order: 2 });
      const sessionId = await start(user, all());

      const view = await getSessionView(user, sessionId);
      expect(view).toEqual({
        sessionId,
        position: 0,
        total: 1,
        done: false,
        counts: { got: 0, review: 0, skip: 0 },
        current: {
          id: q,
          question: "p2 question 0",
          prompt: "prompt 0",
          answer: "answer 0",
          bookSlug: "b",
          bookTitle: "b title",
          partTitle: "Part Two",
          topic: { graphSlug: "g", nodeSlug: "topic", title: "topic title" },
        },
      });
    });

    it("leaves topic out when no visible node links the question", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 1);
      const view = await getSessionView(user, await start(user, all()));
      expect(view!.current).not.toHaveProperty("topic");
    });

    it("returns null for another user's session or a bad id", async () => {
      const owner = newUserId();
      await seedQuestions(await seedBook("b"), 2);
      const sessionId = await start(owner, all());

      expect(await getSessionView(newUserId(), sessionId)).toBeNull();
      expect(await getSessionView(owner, String(new mongoose.Types.ObjectId()))).toBeNull();
      expect(await getSessionView(owner, "not-an-id")).toBeNull();
    });

    it("Review Focus 2: an archived card is skipped on resume without a result", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);
      const sessionId = await start(user, all());
      const deck = await deckOf(sessionId);

      const first = await getSessionView(user, sessionId);
      expect(first!.current!.id).toBe(deck[0]);
      await recordResult(user, sessionId, deck[0], "got");
      await Question.updateOne({ _id: deck[1] }, { status: "archived" });

      const resumed = await getSessionView(user, sessionId);
      expect(resumed).toMatchObject({ done: false, position: 2, total: 3 });
      expect(resumed!.current!.id).toBe(deck[2]);

      const end = await recordResult(user, sessionId, deck[2], "got");
      expect(end).toMatchObject({ done: true, current: null, counts: { got: 2, review: 0, skip: 0 } });
      const session = await loadSession(sessionId);
      expect(session.results.map((r) => String(r.questionId))).toEqual([deck[0], deck[2]]);
      expect(session.finishedAt).toBeInstanceOf(Date);
    });

    it("a session whose remaining cards were all archived is done and finished", async () => {
      const user = newUserId();
      const book = await seedBook("b");
      await seedQuestions(book, 2);
      const sessionId = await start(user, all());
      const deck = await deckOf(sessionId);
      await recordResult(user, sessionId, deck[0], "skip");
      await Question.updateOne({ _id: deck[1] }, { status: "draft" });

      expect(await getSessionView(user, sessionId)).toMatchObject({ done: true, current: null, position: 2 });
      expect((await loadSession(sessionId)).finishedAt).toBeInstanceOf(Date);
      expect(await listUnfinished(user)).toEqual([]);
    });
  });

  describe("recordResult", () => {
    it("Review Focus 4: a double submit records one result and one progress doc", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);
      const sessionId = await start(user, all());
      const q = (await getSessionView(user, sessionId))!.current!.id;

      const views = await Promise.all([
        recordResult(user, sessionId, q, "got"),
        recordResult(user, sessionId, q, "got"),
      ]);

      const session = await loadSession(sessionId);
      expect(session.results).toHaveLength(1);
      expect(session.cursor).toBe(1);
      const progress = await QuestionProgress.find({ userId: user }).lean<{ seenCount: number }[]>();
      expect(progress).toHaveLength(1);
      expect(progress[0].seenCount).toBe(1);
      for (const view of views) expect(view.current!.id).not.toBe(q);
    });

    it("is idempotent for a stale question id", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);
      const sessionId = await start(user, all());
      const deck = await deckOf(sessionId);

      const view = await recordResult(user, sessionId, deck[1], "got");
      expect(view.current!.id).toBe(deck[0]);
      expect((await loadSession(sessionId)).results).toHaveLength(0);
      expect(await QuestionProgress.countDocuments()).toBe(0);
    });

    it("advances the cursor, updates progress and counts", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 3);
      const sessionId = await start(user, all());
      const deck = await deckOf(sessionId);

      const view = await recordResult(user, sessionId, deck[0], "skip");
      expect(view).toMatchObject({ position: 1, total: 3, done: false, counts: { got: 0, review: 0, skip: 1 } });
      expect(view.current!.id).toBe(deck[1]);
      expect(await QuestionProgress.findOne({ userId: user, questionId: deck[0] }).lean()).toMatchObject({
        status: null,
        seenCount: 1,
      });
    });

    it("requeue: review at cursor 0 of a 10-card deck reinserts the id at index 5", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 10);
      const sessionId = await start(user, all());
      const deck = await deckOf(sessionId);

      const view = await recordResult(user, sessionId, deck[0], "review", () => 0);

      const after = await deckOf(sessionId);
      expect(after).toHaveLength(11);
      expect(after[5]).toBe(deck[0]);
      expect(after.filter((id) => id === deck[0])).toHaveLength(2);
      expect(view).toMatchObject({ position: 1, total: 11 });
      expect(view.current!.id).toBe(deck[1]);
    });

    it("counts the last result per question and finishes at the end", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 2);
      const sessionId = await start(user, all());
      const [q0, q1] = await deckOf(sessionId);

      await recordResult(user, sessionId, q0, "review", () => 0); // deck of 2: requeued at the end
      expect(await deckOf(sessionId)).toEqual([q0, q1, q0]);
      await recordResult(user, sessionId, q1, "got");
      const end = await recordResult(user, sessionId, q0, "got");

      expect(end).toMatchObject({ done: true, position: 3, total: 3, current: null, counts: { got: 2, review: 0, skip: 0 } });
      expect((await loadSession(sessionId)).finishedAt).toBeInstanceOf(Date);
      expect(await QuestionProgress.findOne({ userId: user, questionId: q0 }).lean()).toMatchObject({
        status: "got",
        seenCount: 2,
      });
      // A late mark on a finished session changes nothing.
      await recordResult(user, sessionId, q0, "review");
      expect((await loadSession(sessionId)).results).toHaveLength(3);
    });

    it("rejects another user's session", async () => {
      const owner = newUserId();
      await seedQuestions(await seedBook("b"), 1);
      const sessionId = await start(owner, all());
      const [q] = await deckOf(sessionId);

      await expect(recordResult(newUserId(), sessionId, q, "got")).rejects.toBeInstanceOf(ForbiddenError);
      expect((await loadSession(sessionId)).results).toHaveLength(0);
    });
  });

  describe("finishSession and listUnfinished", () => {
    it("lists the user's unfinished sessions, newest first, with labels", async () => {
      const user = newUserId();
      const a = await seedBook("a");
      const b = await seedBook("b");
      const c = await seedBook("c");
      await seedQuestions(a, 3, "p1");
      await seedQuestions(b, 2);
      await seedQuestions(c, 2);

      const onePart = await start(user, all({ bookIds: [a], partKeys: ["p1"] }));
      const twoBooks = await start(user, all({ bookIds: [a, b], partKeys: ["p1"] }));
      const everything = await start(user, all());
      const finished = await start(user, all({ bookIds: [b] }));
      await start(newUserId(), all());
      await finishSession(user, finished);
      await recordResult(user, onePart, (await deckOf(onePart))[0], "got");
      await QuizSession.updateOne({ _id: onePart }, { startedAt: new Date("2030-01-01") });

      const list = await listUnfinished(user);
      expect(list.map((s) => s.id)).toEqual([onePart, everything, twoBooks]);
      expect(list[0]).toMatchObject({ label: "a title · Part One", position: 1, total: 3 });
      expect(list[0].startedAt).toEqual(new Date("2030-01-01"));
      expect(list[1]).toMatchObject({ label: "Mixed", position: 0, total: 7 });
      expect(list[2]).toMatchObject({ label: "a title · b title", position: 0, total: 5 });
    });

    it("finishSession marks the session done and ignores other users", async () => {
      const user = newUserId();
      await seedQuestions(await seedBook("b"), 2);
      const sessionId = await start(user, all());

      await finishSession(newUserId(), sessionId);
      expect((await getSessionView(user, sessionId))!.done).toBe(false);

      await finishSession(user, sessionId);
      expect(await getSessionView(user, sessionId)).toMatchObject({ done: true, current: null });
      expect(await listUnfinished(user)).toEqual([]);
    });
  });
});
