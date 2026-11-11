import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_REPLY_MAX } from "@/lib/ai-limits";
import { clearAiKey, getAiConfig, getAiSettings, saveAiKey, saveAiSettings } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { DEFAULT_OPENROUTER_MODEL, resetEnvCache } from "@/lib/env";
import { AiError } from "@/lib/openrouter";
import { AiConversation, AiSettings, AiUsage, Question } from "@/models";
import { createSession } from "@/progress/quiz";
import { askFollowUp, consumeAiCall, gradeAnswer, loadCoachCard, parseFeedback } from "@/progress/quizAi";
import { resetDb } from "../setup/mongo";
import { newUserId, seedBook, seedQuestions } from "./seed";

const FEEDBACK = {
  verdict: "partial",
  score: 62,
  summary: "Right idea, thin on detail.",
  strengths: ["Mentions scope"],
  missing: ["Lexical environment", "Example"],
  followUp: "What does a closure capture: values or variables?",
};

const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
const bodyOf = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(String((fetch.mock.calls[call] as unknown as [string, RequestInit])[1].body));
const usageCount = async (userId: string) =>
  (await AiUsage.findOne({ userId }).lean<{ count: number }>())?.count ?? 0;

async function setup(slug = "js") {
  const user = newUserId();
  const bookId = await seedBook(slug);
  const [questionId] = await seedQuestions(bookId, 1);
  const created = await createSession(user, { bookIds: [], partKeys: [], mode: "all", size: null });
  if (!("sessionId" in created)) throw new Error("expected a session");
  return { user, bookId, questionId, sessionId: created.sessionId };
}

describe("parseFeedback", () => {
  it("parses JSON, clamps the score and suggests a mark from the verdict", () => {
    expect(parseFeedback(JSON.stringify(FEEDBACK))).toMatchObject({ verdict: "partial", score: 62, suggested: "review" });
    expect(parseFeedback(JSON.stringify({ ...FEEDBACK, verdict: "correct", score: 140 }))).toMatchObject({
      score: 100,
      suggested: "got",
    });
  });

  it("tolerates fences, missing lists and a missing score", () => {
    const parsed = parseFeedback("```json\n" + JSON.stringify({ verdict: "incorrect", summary: "No." }) + "\n```");
    expect(parsed).toEqual({
      verdict: "incorrect",
      score: 10,
      summary: "No.",
      strengths: [],
      missing: [],
      followUp: "",
      suggested: "review",
    });
  });

  it("rejects replies without a verdict or summary", () => {
    expect(parseFeedback("I think it is fine")).toBeNull();
    expect(parseFeedback(JSON.stringify({ verdict: "great", summary: "x" }))).toBeNull();
    expect(parseFeedback(JSON.stringify({ verdict: "correct" }))).toBeNull();
    expect(parseFeedback(JSON.stringify({ verdict: "correct", summary: " " }))).toBeNull();
  });
});

describe("quiz coach", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "3");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    resetEnvCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  describe("settings", () => {
    it("defaults to the environment and lets the admin override it", async () => {
      expect(await getAiSettings()).toEqual({
        keyConfigured: true,
        keySource: "env",
        keyUnreadable: false,
        enabled: true,
        active: true,
        primaryModel: DEFAULT_OPENROUTER_MODEL,
        fallbackModel: "",
        visionModel: "",
        dailyLimit: 3,
      });
      const admin = newUserId();
      expect(
        await saveAiSettings({ enabled: false, primaryModel: "meta/llama:free", fallbackModel: "google/gemma:free", dailyLimit: 0 }, admin),
      ).toEqual({ ok: true });
      expect(await getAiSettings()).toMatchObject({
        enabled: false,
        active: false,
        primaryModel: "meta/llama:free",
        fallbackModel: "google/gemma:free",
        dailyLimit: 0,
      });
    });

    it("is inactive without a key whatever the admin chose", async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "");
      resetEnvCache();
      expect(await getAiSettings()).toMatchObject({ keyConfigured: false, enabled: true, active: false });
    });

    describe("API key", () => {
      const verified = async () => new Response(JSON.stringify({ data: { label: "learn" } }));

      it("saves a verified key encrypted and prefers it over the environment", async () => {
        const admin = newUserId();
        expect(await saveAiKey(" sk-or-v1-secret-1234 ", admin, { fetch: verified })).toEqual({
          ok: true,
          verified: { status: "valid", label: "learn" },
        });
        const row = await AiSettings.findById("ai").lean<{ apiKeyEncrypted: string; apiKeyHint: string }>();
        expect(row?.apiKeyEncrypted).not.toContain("secret");
        expect(row?.apiKeyHint).toBe("1234");

        const { settings, apiKey } = await getAiConfig();
        expect(apiKey).toBe("sk-or-v1-secret-1234");
        expect(settings).toMatchObject({ keySource: "settings", keyHint: "1234", keyConfigured: true, active: true });
        expect(JSON.stringify(settings)).not.toContain("secret");

        await clearAiKey(admin);
        expect(await getAiConfig()).toMatchObject({ apiKey: "sk-test", settings: { keySource: "env" } });
      });

      it("makes the coach available with no environment key", async () => {
        vi.stubEnv("OPENROUTER_API_KEY", "");
        resetEnvCache();
        expect(await getAiSettings()).toMatchObject({ keySource: "none", active: false });
        await saveAiKey("sk-or-v1-only-here", newUserId(), { fetch: verified });
        expect(await getAiSettings()).toMatchObject({ keySource: "settings", active: true });
      });

      it("does not save a key OpenRouter rejects, but saves one it cannot verify", async () => {
        const admin = newUserId();
        const rejected = await saveAiKey("sk-or-v1-wrong-key", admin, { fetch: async () => new Response("", { status: 401 }) });
        expect(rejected).toEqual({ ok: false, errors: { _: expect.stringMatching(/rejected/) } });
        expect((await getAiSettings()).keySource).toBe("env");

        const offline = await saveAiKey("sk-or-v1-offline", admin, {
          fetch: async () => {
            throw new TypeError("offline");
          },
        });
        expect(offline).toEqual({ ok: true, verified: { status: "unverified" } });
        expect((await getAiSettings()).keySource).toBe("settings");
      });

      it("rejects malformed keys and saving without AUTH_SECRET", async () => {
        const fetch = vi.fn();
        expect(await saveAiKey("short", newUserId(), { fetch })).toMatchObject({ ok: false });
        expect(await saveAiKey("sk-or with spaces in", newUserId(), { fetch })).toMatchObject({ ok: false });
        vi.stubEnv("AUTH_SECRET", "");
        resetEnvCache();
        expect(await saveAiKey("sk-or-v1-fine-key", newUserId(), { fetch })).toEqual({
          ok: false,
          errors: { _: expect.stringMatching(/AUTH_SECRET/) },
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("reports a saved key it cannot decrypt and falls back to the environment", async () => {
        await saveAiKey("sk-or-v1-old-secret", newUserId(), { fetch: verified });
        vi.stubEnv("AUTH_SECRET", "rotated");
        resetEnvCache();
        expect(await getAiConfig()).toMatchObject({
          apiKey: "sk-test",
          settings: { keySource: "env", keyUnreadable: true },
        });
      });
    });

    it("rejects bad model ids, a backup equal to the primary and a bad limit", async () => {
      const result = await saveAiSettings(
        { enabled: true, primaryModel: "not a model", fallbackModel: "", dailyLimit: Number.NaN },
        newUserId(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["dailyLimit", "primaryModel"]);
      const same = await saveAiSettings({ enabled: true, primaryModel: "a/b", fallbackModel: "a/b", dailyLimit: 1 }, newUserId());
      expect(same).toEqual({ ok: false, errors: { fallbackModel: "Pick a different model than the primary one" } });
    });
  });

  it("loads only visible cards from the user's own session", async () => {
    const { user, sessionId, questionId, bookId } = await setup();
    expect(await loadCoachCard(user, sessionId, questionId)).toEqual({
      question: "p1 question 0",
      prompt: "prompt 0",
      answer: "answer 0",
    });
    expect(await loadCoachCard(newUserId(), sessionId, questionId)).toBeNull();
    const [other] = await seedQuestions(bookId, 1, "p2");
    expect(await loadCoachCard(user, sessionId, other)).toBeNull();
    expect(await loadCoachCard(user, "bad", questionId)).toBeNull();
    await Question.updateOne({ _id: questionId }, { status: "draft" });
    expect(await loadCoachCard(user, sessionId, questionId)).toBeNull();
  });

  it("grades an answer and opens a conversation with the follow-up question", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn(async () => reply(JSON.stringify(FEEDBACK)));
    const grade = await gradeAnswer(user, sessionId, questionId, "It keeps scope", { fetch });
    expect(grade.feedback).toMatchObject({ verdict: "partial", score: 62, suggested: "review", followUp: FEEDBACK.followUp });
    expect(grade.model).toBe(DEFAULT_OPENROUTER_MODEL);

    const userMessage = bodyOf(fetch).messages.at(-1).content as string;
    expect(userMessage).toContain("<question>\np1 question 0");
    expect(userMessage).toContain("<reference_answer>\nanswer 0");
    expect(userMessage).toContain("<learner_answer>\nIt keeps scope");

    const conversation = await AiConversation.findById(grade.conversationId).lean<{ answer: string; messages: unknown[] }>();
    expect(conversation).toMatchObject({ answer: "It keeps scope", messages: [{ role: "assistant", content: FEEDBACK.followUp }] });
    expect(await usageCount(user)).toBe(1);
  });

  it("uses the backup model when the primary gives unreadable JSON", async () => {
    const { user, sessionId, questionId } = await setup();
    await saveAiSettings({ enabled: true, primaryModel: "p/main:free", fallbackModel: "p/backup:free", dailyLimit: 3 }, user);
    const fetch = vi.fn().mockResolvedValueOnce(reply("Sure, looks good!")).mockResolvedValueOnce(reply(JSON.stringify(FEEDBACK)));
    const grade = await gradeAnswer(user, sessionId, questionId, "x", { fetch });
    expect(grade.model).toBe("p/backup:free");
    expect([bodyOf(fetch, 0).model, bodyOf(fetch, 1).model]).toEqual(["p/main:free", "p/backup:free"]);
    expect(await usageCount(user)).toBe(1);
  });

  it("refunds the quota when every model fails", async () => {
    const { user, sessionId, questionId } = await setup();
    await expect(gradeAnswer(user, sessionId, questionId, "x", { fetch: async () => reply("hmm") })).rejects.toThrow(
      /unreadable/,
    );
    await expect(
      gradeAnswer(user, sessionId, questionId, "x", { fetch: async () => new Response("", { status: 503 }) }),
    ).rejects.toThrow(AiError);
    expect(await usageCount(user)).toBe(0);
  });

  it("refuses blank answers, foreign sessions and a disabled coach without calling the model", async () => {
    const { user, sessionId, questionId } = await setup();
    const fetch = vi.fn();
    await expect(gradeAnswer(user, sessionId, questionId, "  ", { fetch })).rejects.toThrow(/Type an answer/);
    await expect(gradeAnswer(newUserId(), sessionId, questionId, "x", { fetch })).rejects.toThrow(/no longer available/);
    await saveAiSettings({ enabled: false, primaryModel: "a/b", fallbackModel: "", dailyLimit: 3 }, user);
    await expect(gradeAnswer(user, sessionId, questionId, "x", { fetch })).rejects.toThrow(/turned off/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enforces the daily limit per user, without counting refused calls, and resets the next day", async () => {
    const user = newUserId();
    const day = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 3; i++) await consumeAiCall(user, 3, day);
    await expect(consumeAiCall(user, 3, day)).rejects.toThrow(AiError);
    expect(await usageCount(user)).toBe(3);
    await consumeAiCall(newUserId(), 3, day);
    await consumeAiCall(user, 3, new Date("2026-01-02T00:00:01Z"));
  });

  it("does not limit when the limit is 0", async () => {
    const user = newUserId();
    for (let i = 0; i < 5; i++) await consumeAiCall(user, 0);
    expect(await usageCount(user)).toBe(0);
  });

  it("continues a conversation from the server's history, never the client's", async () => {
    const { user, sessionId, questionId } = await setup();
    const grade = await gradeAnswer(user, sessionId, questionId, "my answer", {
      fetch: async () => reply(JSON.stringify(FEEDBACK)),
    });
    const fetch = vi.fn().mockResolvedValueOnce(reply("Variables, by reference.")).mockResolvedValueOnce(reply("Yes."));
    const first = await askFollowUp(user, sessionId, questionId, { conversationId: grade.conversationId, message: "Values?" }, { fetch });
    expect(first).toMatchObject({ reply: "Variables, by reference.", conversationId: grade.conversationId });

    const body = bodyOf(fetch);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("<reference_answer>\nanswer 0");
    expect(body.messages[0].content).toContain("<learner_answer>\nmy answer");
    expect(body.messages.slice(1)).toEqual([
      { role: "assistant", content: FEEDBACK.followUp },
      { role: "user", content: "Values?" },
    ]);

    await askFollowUp(user, sessionId, questionId, { conversationId: grade.conversationId, message: "So both?" }, { fetch });
    expect(bodyOf(fetch, 1).messages.slice(1).map((m: { content: string }) => m.content)).toEqual([
      FEEDBACK.followUp,
      "Values?",
      "Variables, by reference.",
      "So both?",
    ]);
  });

  it("starts a conversation when there is none, and caps long replies", async () => {
    const { user, sessionId, questionId } = await setup();
    const long = "x".repeat(AI_REPLY_MAX + 500);
    const result = await askFollowUp(user, sessionId, questionId, { message: "Why?", answer: "typed" }, {
      fetch: async () => reply(long),
    });
    expect(result.reply).toHaveLength(AI_REPLY_MAX);
    const stored = await AiConversation.findById(result.conversationId).lean<{ answer: string; messages: { content: string }[] }>();
    expect(stored?.answer).toBe("typed");
    expect(stored?.messages.map((m) => m.content.length)).toEqual([4, AI_REPLY_MAX]);
  });

  it("refuses someone else's conversation and empty messages", async () => {
    const { user, sessionId, questionId } = await setup();
    const { conversationId } = await askFollowUp(user, sessionId, questionId, { message: "Why?" }, {
      fetch: async () => reply("Because."),
    });
    const other = await setup("js2");
    const fetch = vi.fn();
    await expect(
      askFollowUp(other.user, other.sessionId, questionId, { conversationId, message: "Hi" }, { fetch }),
    ).rejects.toThrow(AiError);
    await expect(askFollowUp(user, sessionId, questionId, { conversationId, message: " " }, { fetch })).rejects.toThrow(
      /Type a message/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
