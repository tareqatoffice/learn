import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { AiUsage, IeltsBandEntry, IeltsWritingPrompt } from "@/models";
import { taskBand, wordCount, writingBand } from "@/ielts/writing/bands";
import {
  deleteWritingAttempt,
  getWritingAttempt,
  parseWritingEstimate,
  saveWritingSelf,
  saveWritingText,
  startWritingAttempt,
  submitWriting,
  writingAiEstimate,
} from "@/ielts/writing/attempts";
import { resetDb } from "../setup/mongo";

const TODAY = "2026-11-12";
const user = () => String(new Types.ObjectId());
const SELF = { ta: 6, cc: 6, lr: 6, gra: 6 };
const ESTIMATE = {
  bands: { ta: 6, cc: 7, lr: 6, gra: 6 },
  reasons: { ta: "Covers it.", cc: "Clear.", lr: "Everyday.", gra: "Simple." },
  evidence: { ta: ["x"], cc: [], lr: [], gra: [] },
  strengths: ["a", "b", "c"],
  improvements: [
    { advice: "one", original: "o1", rewrite: "r1" },
    { advice: "two", original: "o2", rewrite: "r2" },
    { advice: "three", original: "o3", rewrite: "r3" },
  ],
};
const reply = (obj: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }));

async function prompts() {
  await IeltsWritingPrompt.create({ task: "task1", title: "Chart", brief: "Summarise the chart.", status: "published" });
  await IeltsWritingPrompt.create({ task: "task2", title: "Cities", brief: "Discuss both views.", status: "published" });
}

describe("writing maths", () => {
  it("counts words", () => {
    expect(wordCount("  one two\nthree  ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("averages criteria to a half band", () => {
    expect(taskBand({ ta: 6, cc: 6, lr: 6, gra: 7 })).toBe(6.5);
    expect(taskBand({ ta: 6, cc: 6, lr: 6, gra: 6 })).toBe(6);
  });
  it("weights Task 2 twice as much as Task 1", () => {
    expect(writingBand(6, 7)).toBe(6.5);
    expect(writingBand(7, 6)).toBe(6.5);
    expect(writingBand(5, 7)).toBe(6.5);
  });
});

describe("parseWritingEstimate", () => {
  it("recomputes overall and rejects incomplete replies", () => {
    expect(parseWritingEstimate(JSON.stringify({ ...ESTIMATE, overall: 9 }))?.overall).toBe(6.5);
    expect(parseWritingEstimate(JSON.stringify({ ...ESTIMATE, strengths: ["a"] }))).toBeNull();
    expect(parseWritingEstimate("nonsense")).toBeNull();
  });
});

describe("writing attempts", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "5");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    resetEnvCache();
  });
  afterAll(() => mongoose.disconnect());

  it("fails to start when no prompt is published", async () => {
    const res = await startWritingAttempt(user(), { kind: "task2", date: TODAY });
    expect(res.ok).toBe(false);
  });

  it("runs a full test: write, submit, rate first, then AI, then band entries", async () => {
    await prompts();
    const u = user();
    const started = await startWritingAttempt(u, { kind: "full", date: TODAY });
    if (!started.ok) throw new Error("start");
    const id = started.attemptId;
    expect((await getWritingAttempt(u, id))?.tasks.map((t) => t.task)).toEqual(["task1", "task2"]);

    expect((await submitWriting(u, id)).ok).toBe(false); // nothing written yet
    await saveWritingText(u, id, 0, "word ".repeat(160), 600);
    await saveWritingText(u, id, 1, "word ".repeat(120), 1200);
    const submitted = await submitWriting(u, id);
    expect(submitted).toEqual({ ok: true, short: ["task2"] });
    expect((await saveWritingText(u, id, 0, "late edit", 1)).ok).toBe(false);

    const fetch = vi.fn().mockImplementation(async () => reply(ESTIMATE));
    expect(await writingAiEstimate(u, id, 0, { fetch })).toEqual({ ok: false, error: "Rate yourself first, then ask the coach." });
    expect(fetch).not.toHaveBeenCalled();

    expect((await saveWritingSelf(u, id, 0, { ...SELF, ta: 0 })).ok).toBe(false);
    await saveWritingSelf(u, id, 0, SELF);
    expect(await IeltsBandEntry.countDocuments({})).toBe(0); // task 2 not rated yet
    await saveWritingSelf(u, id, 1, SELF);
    expect((await IeltsBandEntry.findOne({ source: "writingSelf" }).lean<{ bands: { writing: number } }>())?.bands.writing).toBe(6);

    const hidden = await getWritingAttempt(u, id);
    expect(hidden?.tasks[0].ai).toBeUndefined();

    const est = await writingAiEstimate(u, id, 0, { fetch });
    expect(est.ok).toBe(true);
    await writingAiEstimate(u, id, 1, { fetch });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await AiUsage.findOne({ userId: u }).lean<{ count: number }>())?.count).toBe(2);
    const ai = await IeltsBandEntry.findOne({ source: "writingAi" }).lean<{ bands: { writing: number } }>();
    expect(ai?.bands.writing).toBe(6.5);
    const view = await getWritingAttempt(u, id);
    expect(view?.aiBand).toBe(6.5);
    expect(view?.selfBand).toBe(6);

    expect((await deleteWritingAttempt(u, id)).ok).toBe(true);
    expect(await IeltsBandEntry.countDocuments({})).toBe(0);
  });

  it("a single-task drill never writes band history", async () => {
    await prompts();
    const u = user();
    const started = await startWritingAttempt(u, { kind: "task2", date: TODAY });
    if (!started.ok) throw new Error("start");
    await saveWritingText(u, started.attemptId, 0, "an essay", 100);
    await submitWriting(u, started.attemptId);
    await saveWritingSelf(u, started.attemptId, 0, SELF);
    expect(await IeltsBandEntry.countDocuments({})).toBe(0);
    expect((await getWritingAttempt(u, started.attemptId))?.selfBand).toBe(6);
  });

  it("keeps another user's attempt private", async () => {
    await prompts();
    const started = await startWritingAttempt(user(), { kind: "task1", date: TODAY });
    if (!started.ok) throw new Error("start");
    expect(await getWritingAttempt(user(), started.attemptId)).toBeNull();
    expect((await saveWritingText(user(), started.attemptId, 0, "x", 1)).ok).toBe(false);
  });
});
