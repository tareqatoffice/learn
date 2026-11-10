import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { answerModeOf } from "@/lib/quiz-answer";
import { AiConversation, Question, QuizSession } from "@/models";
import { attemptsMarkdown, exportFileName, getAttemptLogs, listAttemptSessions } from "@/progress/attempts";
import { createSession, recordResult } from "@/progress/quiz";
import { appendSpoken } from "@/components/QuizCoach";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedQuestions } from "./seed";

const authUser = vi.hoisted(() => ({ id: "" as string | null }));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(authUser.id ? { user: { id: authUser.id, email: "me@example.test" } } : null),
}));
const { GET: exportRoute } = await import("@/app/(app)/interview/history/export/route");

const keep = () => 0.999;

async function start(user: string, ids: string[]): Promise<string> {
  const created = await createSession(user, { bookIds: [], partKeys: [], mode: "all", size: null, questionIds: ids }, () => 0);
  if (!("sessionId" in created)) throw new Error("expected a session");
  return created.sessionId;
}

async function currentCard(sessionId: string): Promise<string> {
  const s = await QuizSession.findById(sessionId).lean<{ questionIds: unknown[]; cursor: number }>();
  return String(s!.questionIds[s!.cursor]);
}

describe("quiz attempts", () => {
  beforeAll(connectDb);
  beforeEach(async () => {
    await resetDb();
    authUser.id = null;
  });
  afterAll(() => mongoose.disconnect());

  it("answerModeOf and appendSpoken", () => {
    expect(answerModeOf(true, false)).toBe("typed");
    expect(answerModeOf(false, true)).toBe("voice");
    expect(answerModeOf(true, true)).toBe("mixed");
    expect(appendSpoken("", "hello")).toBe("hello");
    expect(appendSpoken("closures", "keep scope")).toBe("closures keep scope");
    expect(appendSpoken("closures ", "keep")).toBe("closures keep");
  });

  it("saves the answer and how it was given with the mark, and nothing for a bare reveal", async () => {
    const user = newUserId();
    const ids = await seedQuestions(await seedBook("b"), 2);
    const sessionId = await start(user, ids);

    const first = await currentCard(sessionId);
    await recordResult(user, sessionId, first, "review", keep, { answer: "  spoken words ", mode: "voice" });
    const second = await currentCard(sessionId);
    await recordResult(user, sessionId, second, "got", keep);

    const s = await QuizSession.findById(sessionId).lean<{ results: Record<string, unknown>[] }>();
    expect(s!.results[0]).toMatchObject({ answer: "spoken words", answerMode: "voice", result: "review" });
    expect(s!.results[1].answer).toBeUndefined();
    expect(s!.results[1].answerMode).toBeUndefined();
  });

  it("copies the coach's grade and chat for this card, not one from an earlier attempt", async () => {
    const user = newUserId();
    const ids = await seedQuestions(await seedBook("b"), 2);
    const sessionId = await start(user, ids);
    const first = await currentCard(sessionId);
    await AiConversation.create({
      userId: user,
      sessionId,
      questionId: first,
      answer: "a",
      messages: [
        { role: "assistant", content: "Why?" },
        { role: "user", content: "Because." },
      ],
      feedback: { verdict: "partial", score: 55, summary: "Close.", strengths: ["s"], missing: ["m"], model: "x/y" },
    });
    await recordResult(user, sessionId, first, "got", keep, { answer: "a", mode: "typed" });
    const second = await currentCard(sessionId);
    await recordResult(user, sessionId, second, "got", keep, { answer: "b", mode: "typed" });

    const s = await QuizSession.findById(sessionId).lean<{ results: { coach?: Record<string, unknown> }[] }>();
    expect(s!.results[0].coach).toMatchObject({ verdict: "partial", score: 55, missing: ["m"], model: "x/y" });
    expect(s!.results[0].coach!.chat).toHaveLength(2);
    expect(s!.results[1].coach).toBeUndefined();
  });

  it("lists only the user's sessions with attempts and builds a Markdown log", async () => {
    const user = newUserId();
    const ids = await seedQuestions(await seedBook("b"), 2);
    const sessionId = await start(user, ids);
    await start(user, ids); // no attempts: not listed
    await start(newUserId(), ids); // someone else's
    const card = await currentCard(sessionId);
    await recordResult(user, sessionId, card, "review", keep, { answer: "my take", mode: "mixed" });

    const list = await listAttemptSessions(user);
    expect(list.map((s) => s.id)).toEqual([sessionId]);
    expect(list[0]).toMatchObject({ attempts: 1, answered: 1 });

    const logs = await getAttemptLogs(user, sessionId);
    const md = attemptsMarkdown(logs, new Date("2026-11-10T00:00:00Z"));
    const q = await Question.findById(card).lean<{ question: string; answer: string }>();
    expect(md).toContain(`### 1. ${q!.question}`);
    expect(md).toContain("> my take");
    expect(md).toContain(q!.answer);
    expect(md).toContain("Answered by: Written and voice");
    expect(md).toContain("Marked: Needs review");
    expect(md).toContain("How to use this file");
    expect(await getAttemptLogs(newUserId(), sessionId)).toEqual([]);
  });

  it("does not export a question that is no longer published", async () => {
    const user = newUserId();
    const ids = await seedQuestions(await seedBook("b"), 1);
    const sessionId = await start(user, ids);
    await recordResult(user, sessionId, ids[0], "got", keep, { answer: "x", mode: "typed" });
    await Question.updateOne({ _id: ids[0] }, { $set: { status: "draft" } });

    const md = attemptsMarkdown(await getAttemptLogs(user, sessionId));
    expect(md).toContain("(This question is no longer available)");
    expect(md).not.toContain("answer 0");
  });

  it("exportFileName is filesystem-safe", () => {
    expect(exportFileName("CSS · Selectors", new Date("2026-11-10T00:00:00Z"))).toBe(
      "interview-answers-css-selectors-2026-11-10.md",
    );
    expect(exportFileName(null, new Date("2026-11-10T00:00:00Z"))).toBe("interview-answers-all-2026-11-10.md");
  });

  describe("export route", () => {
    it("needs a sign-in", async () => {
      const res = await exportRoute(new Request("http://localhost/interview/history/export"));
      expect(res.status).toBe(401);
    });

    it("downloads the user's own session and 404s for anyone else's", async () => {
      const user = newUserId();
      const ids = await seedQuestions(await seedBook("b"), 1);
      const sessionId = await start(user, ids);
      await recordResult(user, sessionId, ids[0], "got", keep, { answer: "x", mode: "typed" });

      authUser.id = user;
      const res = await exportRoute(new Request(`http://localhost/interview/history/export?session=${sessionId}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/markdown");
      expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="interview-answers-.+\.md"/);
      expect(await res.text()).toContain("> x");

      authUser.id = newUserId();
      const other = await exportRoute(new Request(`http://localhost/interview/history/export?session=${sessionId}`));
      expect(other.status).toBe(404);
    });
  });
});
