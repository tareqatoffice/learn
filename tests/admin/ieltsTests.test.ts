import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsListeningTest } from "@/models";
import {
  deleteTest,
  getTestAdmin,
  listTestsAdmin,
  parsePromptDraft,
  parseTestDraft,
  savePrompt,
  saveTest,
  setPromptStatus,
  setTestStatus,
  listPromptsAdmin,
} from "@/admin/ieltsTests";
import { resetDb } from "../setup/mongo";

const QUESTIONS = "## tfng | Agree?\nSky is blue => TRUE\n## completion | One word\nThe ___ => cat";
const input = (over: Partial<Parameters<typeof saveTest>[2]> = {}) => ({
  title: "Test A",
  status: "draft" as const,
  sections: [{ title: "Passage 1", passage: "Some text", script: "A script", questions: QUESTIONS }],
  ...over,
});

describe("admin IELTS tests", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("saves a reading test, numbering questions and round-tripping the text", async () => {
    const res = await saveTest("reading", null, input());
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    const got = await getTestAdmin("reading", res.id);
    expect(got).toMatchObject({ title: "Test A", status: "draft", sections: [{ count: 2, passage: "Some text" }] });
    expect(got?.sections[0].questions).toContain("Sky is blue => TRUE");
    expect(await listTestsAdmin("listening")).toEqual([]);
  });

  it("reports section errors by field", async () => {
    const res = await saveTest("reading", null, input({ sections: [{ title: "", passage: "", questions: "nonsense" }] }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["sections.0.title", "sections.0.passage", "sections.0.questions"]));
    }
  });

  it("keeps listening audio when the test is edited, and refuses to publish without questions", async () => {
    const res = await saveTest("listening", null, input());
    if (!res.ok) throw new Error("save");
    await IeltsListeningTest.updateOne({ _id: res.id }, { $set: { "sections.0.audioKey": "ielts/tests/listening/x/a.mp3", "sections.0.durationSec": 90 } });
    const again = await saveTest("listening", res.id, input({ title: "Renamed", status: "published" }));
    expect(again.ok).toBe(true);
    const got = await getTestAdmin("listening", res.id);
    expect(got).toMatchObject({ title: "Renamed", status: "published", sections: [{ audioKey: "ielts/tests/listening/x/a.mp3", durationSec: 90 }] });
    expect((await setTestStatus("listening", res.id, "draft")).ok).toBe(true);
    expect((await deleteTest("listening", res.id)).ok).toBe(true);
    expect(await getTestAdmin("listening", res.id)).toBeNull();
  });

  it("saves, publishes and lists writing prompts", async () => {
    const bad = await savePrompt(null, { task: "task2", title: "", brief: "short", status: "draft" });
    expect(bad.ok).toBe(false);
    const res = await savePrompt(null, { task: "task2", title: "Cities", brief: "Discuss both views and give your opinion.", status: "draft" });
    if (!res.ok) throw new Error("save");
    expect((await setPromptStatus(res.id, "published")).ok).toBe(true);
    expect(await listPromptsAdmin()).toMatchObject([{ task: "task2", status: "published" }]);
    const changeTask = await savePrompt(res.id, { task: "task1", title: "Cities", brief: "Discuss both views and give your opinion.", status: "draft" });
    expect(changeTask.ok).toBe(false);
  });

  it("parses AI drafts and rejects unusable ones", () => {
    const reply = JSON.stringify({ title: "Bees", sectionTitle: "Passage", text: "Bees are insects.", questions: QUESTIONS });
    expect(parseTestDraft("reading", reply)?.sections[0].passage).toBe("Bees are insects.");
    expect(parseTestDraft("reading", JSON.stringify({ title: "x", text: "t", questions: "bad" }))).toBeNull();
    expect(parseTestDraft("listening", reply)?.sections[0].script).toBe("Bees are insects.");
    const prompt = JSON.stringify({ title: "Chart", brief: "The chart shows sales. Summarise it. Write at least 150 words.", chartDescription: "Sales rose." });
    expect(parsePromptDraft("task1", prompt)).toMatchObject({ task: "task1", imageAlt: "Sales rose.", status: "draft" });
    expect(parsePromptDraft("task2", "not json")).toBeNull();
  });
});
