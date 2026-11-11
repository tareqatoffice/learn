import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuestions, pickQuestions } from "@/ielts/speaking/questions";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { AiUsage, IeltsSpeakingAttempt, IeltsSpeakingItem } from "@/models";
import { resetDb } from "../setup/mongo";

const user = new Types.ObjectId();
const userId = String(user);
const qs = (n: number, tag = "q") => Array.from({ length: n }, (_, i) => `${tag} question ${i}`);

const p1 = (title: string, over: Record<string, unknown> = {}) =>
  IeltsSpeakingItem.create({ type: "part1", title, questions: qs(4, title), status: "published", ...over });
const p2 = (title: string, over: Record<string, unknown> = {}) =>
  IeltsSpeakingItem.create({
    type: "part2",
    title,
    cue: { topic: `Describe ${title}`, bullets: ["a", "b", "c"], explain: "and explain why", roundOff: [] },
    status: "published",
    ...over,
  });
const p3 = (title: string, over: Record<string, unknown> = {}) =>
  IeltsSpeakingItem.create({ type: "part3", title, questions: qs(5, title), status: "published", ...over });
const attempt = (date: string, questions: Record<string, unknown>, who = user) =>
  IeltsSpeakingAttempt.create({ userId: who, date, kind: "mock", status: "complete", questions });

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.stubEnv("OPENROUTER_DAILY_LIMIT", "5");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  resetEnvCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => mongoose.disconnect());

describe("pickQuestions", () => {
  it("unused items first, then least recently used", async () => {
    const a = await p1("Alpha");
    const b = await p1("Beta");
    const c = await p1("Gamma");
    await attempt("2026-01-05", { part1: { itemIds: [a._id], frames: [] } });
    await attempt("2026-01-01", { part1: { itemIds: [b._id], frames: [] } });
    await attempt("2026-01-10", { part1: { itemIds: [b._id] , frames: [] } }, new Types.ObjectId());

    let res = await pickQuestions(userId, "part1");
    expect(res.exhausted).toBe(false);
    expect(res.questions.part1?.itemIds.map(String)).toEqual([String(c._id)]);
    expect(res.questions.part1?.frames[0]).toMatchObject({ title: "Gamma" });

    await attempt("2026-01-06", { part1: { itemIds: [c._id], frames: [] } });
    res = await pickQuestions(userId, "part1");
    expect(res.exhausted).toBe(true);
    expect(res.questions.part1?.itemIds.map(String)).toEqual([String(b._id)]);
  });

  it("breaks ties with rng", async () => {
    const a = await p2("One");
    const b = await p2("Two");
    const first = await pickQuestions(userId, "part2", () => 0);
    const last = await pickQuestions(userId, "part2", () => 0.999);
    expect([first, last].map((r) => String(r.questions.part2?.itemId)).sort()).toEqual([String(a._id), String(b._id)].sort());
    expect(first.questions.part2?.itemId).not.toEqual(last.questions.part2?.itemId);
    expect(first.questions.part2?.cue).toMatchObject({ bullets: ["a", "b", "c"] });
  });

  it("mock links part3 to card", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p1("Travel");
    await p1("Music");
    const card = await p2("Card");
    await p3("Unlinked");
    const linked = await p3("Linked", { cardId: card._id });
    await p3("Other card", { cardId: new Types.ObjectId() });

    const { questions, exhausted } = await pickQuestions(userId, "mock");
    expect(exhausted).toBe(false);
    expect(questions.part1?.frames).toHaveLength(3);
    expect(questions.part1?.frames[0].title).toBe("About me");
    expect(questions.part2?.itemId).toEqual(card._id);
    expect(questions.part3?.itemId).toEqual(linked._id);
  });

  it("falls back to unlinked part3", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p1("Travel");
    await p2("Card");
    const unlinked = await p3("Unlinked");
    await p3("Other card", { cardId: new Types.ObjectId() });

    const { questions } = await pickQuestions(userId, "mock");
    expect(questions.part3?.itemId).toEqual(unlinked._id);
  });

  it("mock without any usable part3 is exhausted", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p1("Travel");
    await p2("Card");
    await p3("Other card", { cardId: new Types.ObjectId() });
    const res = await pickQuestions(userId, "mock");
    expect(res.exhausted).toBe(true);
    expect(res.questions.part3).toBeUndefined();
    expect(res.questions.part2).toBeDefined();
  });

  it("mock picks the least recently used per slot, ignoring other users", async () => {
    const about = await p1("About me", { aboutYou: true });
    const food = await p1("Food");
    const travel = await p1("Travel");
    const work = await p1("Work");
    const old = await p2("Old card");
    const recent = await p2("Recent card");
    await attempt("2026-01-01", { part1: { itemIds: [about._id, food._id, travel._id], frames: [] }, part2: { itemId: old._id, cue: { topic: "t" } } });
    await attempt("2026-01-09", { part2: { itemId: recent._id, cue: { topic: "t" } } });
    await attempt("2026-01-10", { part2: { itemId: old._id, cue: { topic: "t" } } }, new Types.ObjectId());
    const { questions } = await pickQuestions(userId, "mock");
    expect(questions.part1?.itemIds.slice(0, 2).map(String)).toEqual([String(about._id), String(work._id)]);
    expect(questions.part2?.itemId).toEqual(old._id);
  });

  it("a mock with only 2 part1 items is exhausted", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p2("Card");
    await p3("Set");
    const res = await pickQuestions(userId, "mock");
    expect(res.questions.part1?.frames).toHaveLength(2);
    expect(res.exhausted).toBe(true);
  });

  it("a mock is exhausted when part1 is fresh but every part2 is used", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p1("Travel");
    const card = await p2("Card");
    await p3("Set", { cardId: card._id });
    expect((await pickQuestions(userId, "mock")).exhausted).toBe(false);
    await attempt("2026-01-01", { part2: { itemId: card._id, cue: { topic: "t" } } });
    expect((await pickQuestions(userId, "mock")).exhausted).toBe(true);
  });

  it("a fresh part3 linked to a different card doesn't count", async () => {
    await p1("About me", { aboutYou: true });
    await p1("Food");
    await p1("Travel");
    const card = await p2("Card");
    const mine = await p3("Mine", { cardId: card._id });
    await p3("Elsewhere", { cardId: new Types.ObjectId() });
    await attempt("2026-01-01", { part3: { itemId: mine._id, questions: [] } });
    const res = await pickQuestions(userId, "mock");
    expect(res.questions.part3?.itemId).toEqual(mine._id);
    expect(res.exhausted).toBe(true);
  });

  it("exhausted when bank empty", async () => {
    for (const kind of ["mock", "part1", "part2", "part3"] as const) {
      expect(await pickQuestions(userId, kind)).toEqual({ questions: {}, exhausted: true });
    }
  });

  it("drafts never picked", async () => {
    await p1("Draft", { status: "draft" });
    await p2("Draft card", { status: "draft" });
    const live = await p1("Live");
    expect((await pickQuestions(userId, "part2")).questions.part2).toBeUndefined();
    const res = await pickQuestions(userId, "part1");
    expect(res.questions.part1?.itemIds.map(String)).toEqual([String(live._id)]);
  });
});

describe("generateQuestions", () => {
  const reply = (obj: unknown) =>
    new Response(JSON.stringify({ choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) } }] }));
  const usage = async () => (await AiUsage.findOne({ userId: user }).lean<{ count: number }>())?.count ?? 0;
  const card = { title: "Trip", topic: "Describe a trip", bullets: ["where", "who", "when", "what"], explain: "and say why", roundOff: [] };

  it("returns a validated part2 cue with 3-4 bullets and saves nothing", async () => {
    const fetch = vi.fn(async () => reply({ ...card, bullets: ["1", "2", "3", "4", "5"] }));
    const res = await generateQuestions(userId, "part2", undefined, { fetch });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.part2?.cue.topic).toBe("Describe a trip");
    expect(res.value.part2?.cue.bullets).toHaveLength(4);
    expect(res.value.part2?.itemId).toBeUndefined();
    expect(await IeltsSpeakingItem.countDocuments()).toBe(0);
    expect(await usage()).toBe(1);
  });

  it("generates a full mock in one call", async () => {
    const fetch = vi.fn(async () =>
      reply({
        part1: [
          { title: "You", questions: qs(4) },
          { title: "Food", questions: qs(4) },
          { title: "Work", questions: qs(4) },
        ],
        part2: card,
        part3: { title: "Travel", questions: qs(5) },
      }),
    );
    const res = await generateQuestions(userId, "mock", undefined, { fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.ok && res.value.part1?.frames.map((f) => f.title)).toEqual(["You", "Food", "Work"]);
    expect(res.ok && res.value.part3?.questions).toHaveLength(5);
    expect(res.ok && res.value.part2?.cue.bullets).toHaveLength(4);
  });

  it("part3 follows a given cue inside a card tag", async () => {
    const fetch = vi.fn(async () => reply({ title: "Travel", questions: qs(5) }));
    const res = await generateQuestions(userId, "part3", card, { fetch });
    expect(res.ok && res.value.part3?.questions).toHaveLength(5);
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(JSON.stringify(body.messages)).toContain("<card>");
  });

  it("refunds an unusable reply", async () => {
    const res = await generateQuestions(userId, "part1", undefined, { fetch: async () => reply("not json") });
    expect(res.ok).toBe(false);
    expect(await usage()).toBe(0);
    const short = await generateQuestions(userId, "mock", undefined, { fetch: async () => reply({ part1: [] }) });
    expect(short.ok).toBe(false);
  });

  it("says so when the AI coach is off", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    resetEnvCache();
    const fetch = vi.fn();
    expect(await generateQuestions(userId, "part1", undefined, { fetch })).toEqual({ ok: false, error: "The AI coach is turned off." });
    expect(fetch).not.toHaveBeenCalled();
  });
});
