import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(async (key: string) => `https://r2.test/put/${key}`),
  presignGet: vi.fn(async (key: string) => `https://r2.test/get/${key}`),
  headObject: vi.fn(async () => ({ size: 1000 }) as { size: number } | null),
  deleteObjects: vi.fn(async () => undefined),
}));
vi.mock("@/lib/r2", () => r2);

import {
  confirmPromptImage,
  confirmSectionAudio,
  generatePromptDraft,
  generateTestDraft,
  getPromptAdmin,
  getTestAdmin,
  savePrompt,
  saveTest,
  startPromptImageUpload,
  startSectionAudioUpload,
} from "@/admin/ieltsTests";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { AiUsage } from "@/models";
import { Types } from "mongoose";
import { resetDb } from "../setup/mongo";

const QUESTIONS = "## tfng | Agree?\nSky is blue => TRUE\n## completion | One word\nThe ___ => cat";
const admin = () => String(new Types.ObjectId());
const reply = (obj: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) } }] }));

async function listening() {
  const res = await saveTest("listening", null, { title: "L", status: "draft", sections: [{ title: "S1", script: "x", questions: QUESTIONS }] });
  if (!res.ok) throw new Error("save");
  return res.id;
}

describe("IELTS admin uploads", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    r2.storageConfigured.mockReturnValue(true);
    r2.headObject.mockResolvedValue({ size: 1000 });
  });
  afterAll(() => mongoose.disconnect());

  it("signs an audio upload under the test's own prefix and rejects bad input", async () => {
    const id = await listening();
    const started = await startSectionAudioUpload(id, 0, "audio/mpeg", 1000);
    if (!started.ok) throw new Error("start");
    expect(started.key).toMatch(new RegExp(`^ielts/tests/listening/${id}/[0-9a-f]{24}\\.mp3$`));
    expect(r2.presignPut).toHaveBeenCalledWith(started.key, "audio/mpeg", 1000);
    expect((await startSectionAudioUpload(id, 0, "image/png", 10)).ok).toBe(false);
    expect((await startSectionAudioUpload(id, 0, "audio/mpeg", 81 * 1024 * 1024)).ok).toBe(false);
    expect((await startSectionAudioUpload(id, 5, "audio/mpeg", 10)).ok).toBe(false); // no such section
    r2.storageConfigured.mockReturnValue(false);
    expect((await startSectionAudioUpload(id, 0, "audio/mpeg", 10)).ok).toBe(false);
  });

  it("confirms an audio upload, replaces the old file and refuses foreign keys or missing objects", async () => {
    const id = await listening();
    expect((await confirmSectionAudio(id, 0, "ielts/tests/listening/other/x.mp3", 30)).ok).toBe(false);
    expect((await confirmSectionAudio(id, 0, `ielts/tests/listening/${id}/../x.mp3`, 30)).ok).toBe(false);
    r2.headObject.mockResolvedValueOnce(null);
    expect((await confirmSectionAudio(id, 0, `ielts/tests/listening/${id}/a.mp3`, 30)).ok).toBe(false);

    expect((await confirmSectionAudio(id, 0, `ielts/tests/listening/${id}/a.mp3`, 30)).ok).toBe(true);
    expect((await getTestAdmin("listening", id))?.sections[0]).toMatchObject({ audioKey: `ielts/tests/listening/${id}/a.mp3`, durationSec: 30 });
    expect((await confirmSectionAudio(id, 0, `ielts/tests/listening/${id}/b.mp3`, 45)).ok).toBe(true);
    expect(r2.deleteObjects).toHaveBeenCalledWith([`ielts/tests/listening/${id}/a.mp3`]);

    r2.headObject.mockResolvedValueOnce({ size: 90 * 1024 * 1024 });
    expect((await confirmSectionAudio(id, 0, `ielts/tests/listening/${id}/c.mp3`, 45)).ok).toBe(false);
    expect((await getTestAdmin("listening", id))?.sections[0].audioKey).toBe(`ielts/tests/listening/${id}/b.mp3`);
  });

  it("handles Task 1 images: only task1, only images, only its own prefix", async () => {
    const p1 = await savePrompt(null, { task: "task1", title: "Chart", brief: "Summarise the chart below.", status: "draft" });
    const p2 = await savePrompt(null, { task: "task2", title: "Essay", brief: "Discuss both views and give opinion.", status: "draft" });
    if (!p1.ok || !p2.ok) throw new Error("save");
    expect((await startPromptImageUpload(p2.id, "image/png", 100)).ok).toBe(false);
    expect((await startPromptImageUpload(p1.id, "audio/mpeg", 100)).ok).toBe(false);
    expect((await startPromptImageUpload(p1.id, "image/png", 6 * 1024 * 1024)).ok).toBe(false);
    const started = await startPromptImageUpload(p1.id, "image/png", 100);
    if (!started.ok) throw new Error("start");
    expect(started.key.startsWith(`ielts/tests/writing/${p1.id}/`)).toBe(true);
    expect((await confirmPromptImage(p1.id, `ielts/tests/writing/${p2.id}/x.png`)).ok).toBe(false);
    expect((await confirmPromptImage(p1.id, started.key)).ok).toBe(true);
    expect((await getPromptAdmin(p1.id))?.imageKey).toBe(started.key);
  });
});

describe("IELTS admin AI drafts", () => {
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

  it("saves a generated reading test as a draft and counts one AI call", async () => {
    const u = admin();
    const fetch = vi.fn().mockImplementation(async () => reply({ title: "Bees", sectionTitle: "Passage 1", text: "Bees are insects.", questions: QUESTIONS }));
    const res = await generateTestDraft(u, "reading", { fetch });
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    expect(await getTestAdmin("reading", res.id)).toMatchObject({ status: "draft", generated: true, title: "Bees" });
    expect((await AiUsage.findOne({ userId: u }).lean<{ count: number }>())?.count).toBe(1);
  });

  it("refunds the call and saves nothing when the reply is unusable", async () => {
    const u = admin();
    const fetch = vi.fn().mockImplementation(async () => reply({ title: "x", sectionTitle: "y", text: "t", questions: "not questions" }));
    const res = await generateTestDraft(u, "listening", { fetch });
    expect(res.ok).toBe(false);
    expect((await AiUsage.findOne({ userId: u }).lean<{ count: number }>())?.count ?? 0).toBe(0);
  });

  it("saves a generated Task 1 prompt with the chart description as its alt text", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => reply({ title: "Sales", brief: "The chart shows sales. Summarise it. Write at least 150 words.", chartDescription: "Sales rose." }));
    const res = await generatePromptDraft(admin(), "task1", { fetch });
    if (!res.ok) throw new Error("gen");
    expect(await getPromptAdmin(res.id)).toMatchObject({ task: "task1", status: "draft", generated: true, imageAlt: "Sales rose." });
  });
});
