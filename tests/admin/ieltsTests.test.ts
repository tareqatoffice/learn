import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsListeningTest, IeltsWritingPrompt } from "@/models";
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
    const again = await saveTest(
      "listening",
      res.id,
      input({ title: "Renamed", status: "published", sections: [{ title: "S", script: "A script", questions: QUESTIONS, audioKey: "ielts/tests/listening/x/a.mp3" }] }),
    );
    expect(again.ok).toBe(true);
    const got = await getTestAdmin("listening", res.id);
    expect(got).toMatchObject({ title: "Renamed", status: "published", sections: [{ audioKey: "ielts/tests/listening/x/a.mp3", durationSec: 90 }] });
    expect((await setTestStatus("listening", res.id, "draft")).ok).toBe(true);
    expect((await deleteTest("listening", res.id)).ok).toBe(true);
    expect(await getTestAdmin("listening", res.id)).toBeNull();
  });

  it("keeps each recording with its own section when sections are removed or reordered", async () => {
    const section = (title: string, audioKey = "") => ({ title, script: `${title} script`, questions: QUESTIONS, audioKey });
    const res = await saveTest("listening", null, input({ sections: [section("One"), section("Two"), section("Three")] }));
    if (!res.ok) throw new Error("save");
    await IeltsListeningTest.updateOne(
      { _id: res.id },
      { $set: { "sections.0.audioKey": "k/0.mp3", "sections.1.audioKey": "k/1.mp3", "sections.2.audioKey": "k/2.mp3", "sections.1.durationSec": 61 } },
    );
    // Remove section One: Two and Three keep their own files and the file of the removed section is dropped.
    const removed = await saveTest("listening", res.id, input({ sections: [section("Two", "k/1.mp3"), section("Three", "k/2.mp3")] }));
    expect(removed.ok).toBe(true);
    const got = await getTestAdmin("listening", res.id);
    expect(got?.sections.map((s) => [s.title, s.audioKey, s.durationSec])).toEqual([["Two", "k/1.mp3", 61], ["Three", "k/2.mp3", 0]]);
    // An unknown key (for example from another test) is ignored rather than trusted.
    const forged = await saveTest("listening", res.id, input({ sections: [section("Two", "k/other.mp3"), section("Three", "k/2.mp3")] }));
    expect(forged.ok).toBe(true);
    expect((await getTestAdmin("listening", res.id))?.sections.map((s) => s.audioKey)).toEqual(["", "k/2.mp3"]);
  });

  it("won't publish a silent listening section or a Task 1 prompt without its image", async () => {
    const silent = { title: "S", script: "", questions: QUESTIONS };
    expect((await saveTest("listening", null, input({ status: "published", sections: [silent] }))).ok).toBe(false);
    const draft = await saveTest("listening", null, input({ sections: [silent] }));
    if (!draft.ok) throw new Error("draft");
    expect((await setTestStatus("listening", draft.id, "published")).ok).toBe(false);

    const brief = "Summarise the chart below in at least 150 words.";
    expect((await savePrompt(null, { task: "task1", title: "Chart", brief, status: "published" })).ok).toBe(false);
    const p = await savePrompt(null, { task: "task1", title: "Chart", brief, status: "draft" });
    if (!p.ok) throw new Error("prompt");
    expect((await setPromptStatus(p.id, "published")).ok).toBe(false);
    expect((await savePrompt(p.id, { task: "task1", title: "Chart", brief, status: "published" })).ok).toBe(false);
    await IeltsWritingPrompt.updateOne({ _id: p.id }, { $set: { imageKey: "ielts/tests/writing/x/a.png" } });
    expect((await setPromptStatus(p.id, "published")).ok).toBe(true);
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
