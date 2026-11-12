import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { IeltsBandEntry, IeltsListeningTest, IeltsReadingTest } from "@/models";
import { AUDIO_LINK_SEC, claimSection, deleteTestAttempt, getAttempt, listTestAttempts, listTests, saveAnswers, startTestAttempt, submitAttempt } from "@/ielts/practice/attempts";
import { parseQuestions } from "@/ielts/practice/format";
import { resetDb } from "../setup/mongo";

const user = () => String(new Types.ObjectId());

function groups(text: string) {
  const r = parseQuestions(text);
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.groups;
}

async function publishedTest(sectionCount = 2) {
  const sections = Array.from({ length: sectionCount }, (_, i) => ({
    title: `Passage ${i + 1}`,
    passage: "Text",
    groups: groups(`## tfng | Agree?\nS${i}a => TRUE ~ because\nS${i}b => FALSE\n## completion | One word\nThe ___ => cat`),
  }));
  const doc = await IeltsReadingTest.create({ title: "Test A", status: "published", sections });
  return String(doc._id);
}

describe("listening and reading attempts", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  it("lists only published tests with questions", async () => {
    await publishedTest();
    await IeltsReadingTest.create({ title: "Draft", status: "draft", sections: [] });
    const tests = await listTests("reading");
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ title: "Test A", questions: 6 });
  });

  it("starts a section attempt with numbered questions and hides answers from the run view", async () => {
    const u = user();
    const testId = await publishedTest();
    const started = await startTestAttempt(u, { skill: "reading", testId, scope: 1, date: "2026-11-12" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const got = await getAttempt(u, started.attemptId);
    expect(got?.state).toBe("run");
    if (got?.state !== "run") return;
    expect(got.view.limitSec).toBe(20 * 60);
    expect(got.view.sections).toHaveLength(1);
    expect(got.view.sections[0].groups[0].questions.map((q) => q.n)).toEqual([1, 2]);
    expect(JSON.stringify(got.view)).not.toContain("because");
    expect(JSON.stringify(got.view)).not.toContain('"explanation"');
  });

  it("autosaves valid answers only and ignores another user", async () => {
    const u = user();
    const testId = await publishedTest(1);
    const started = await startTestAttempt(u, { skill: "reading", testId, scope: "full", date: "2026-11-12" });
    if (!started.ok) throw new Error("start");
    const id = started.attemptId;
    await saveAnswers(u, id, { "1": "true", "99": "nope", "3": "cat" });
    const stranger = await saveAnswers(user(), id, { "2": "x" });
    expect(stranger.ok).toBe(false);
    const got = await getAttempt(u, id);
    if (got?.state !== "run") throw new Error("run");
    expect(got.view.answers).toEqual({ "1": "true", "3": "cat" });
  });

  it("marks on submit, is idempotent, and shows the key in the review", async () => {
    const u = user();
    const testId = await publishedTest(1);
    const started = await startTestAttempt(u, { skill: "reading", testId, scope: "full", date: "2026-11-12" });
    if (!started.ok) throw new Error("start");
    const id = started.attemptId;
    const first = await submitAttempt(u, id, { "1": "TRUE", "2": "TRUE", "3": "The cat" });
    expect(first).toEqual({ ok: true, ...{ raw: 2, total: 3 } });
    const again = await submitAttempt(u, id, { "2": "FALSE" });
    expect(again).toEqual({ ok: true, ...{ raw: 2, total: 3 } });
    const review = await getAttempt(u, id);
    expect(review?.state).toBe("review");
    if (review?.state === "review") {
      expect(review.view.score.results.map((r) => r.correct)).toEqual([true, false, true]);
      expect(review.view.sections[0].groups[0].questions[0].explanation).toBe("because");
    }
    expect(await IeltsBandEntry.countDocuments({})).toBe(0);
  });

  it("writes a practice band entry only for a full 40-question test", async () => {
    const u = user();
    const lines = Array.from({ length: 40 }, (_, i) => `Q${i} => x`).join("\n");
    const doc = await IeltsReadingTest.create({
      title: "Full",
      status: "published",
      sections: [{ title: "P", passage: "t", groups: groups(`## completion | w\n${lines}`) }],
    });
    const started = await startTestAttempt(u, { skill: "reading", testId: String(doc._id), scope: "full", date: "2026-11-12" });
    if (!started.ok) throw new Error("start");
    const answers = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), "x"]));
    const res = await submitAttempt(u, started.attemptId, answers);
    expect(res).toEqual({ ok: true, ...{ raw: 30, total: 40, band: 7 } });
    const entry = await IeltsBandEntry.findOne({ userId: u }).lean<{ source: string; bands: { reading: number } }>();
    expect(entry).toMatchObject({ source: "practice", bands: { reading: 7 } });

    expect((await deleteTestAttempt(u, started.attemptId)).ok).toBe(true);
    expect(await IeltsBandEntry.countDocuments({})).toBe(0);
  });

  it("lists a user's attempts newest first", async () => {
    const u = user();
    const testId = await publishedTest(1);
    await startTestAttempt(u, { skill: "reading", testId, scope: "full", date: "2026-11-12" });
    await startTestAttempt(user(), { skill: "reading", testId, scope: "full", date: "2026-11-12" });
    expect(await listTestAttempts(u)).toHaveLength(1);
  });

  it("keeps scripts and audio links out of the run view and hands them out at Play", async () => {
    const u = user();
    const deps = { sign: vi.fn(async (key: string, ttl: number) => `https://r2.test/${key}?ttl=${ttl}`), storage: () => true };
    const doc = await IeltsListeningTest.create({
      title: "L",
      status: "published",
      sections: [
        { title: "S1", script: "The secret is cat.", groups: groups("## completion | w\nThe secret => cat") },
        { title: "S2", script: "Other.", audioKey: "k/a.mp3", groups: groups("## completion | w\nQ => x") },
        { title: "S3", groups: groups("## completion | w\nQ3 => y") },
      ],
    });
    const full = await startTestAttempt(u, { skill: "listening", testId: String(doc._id), scope: "full", date: "2026-11-12" });
    if (!full.ok) throw new Error("start");
    const got = await getAttempt(u, full.attemptId);
    if (got?.state !== "run") throw new Error("run");
    expect(got.view.audio).toEqual(["voice", "file", "none"]);
    expect(JSON.stringify(got.view)).not.toContain("secret is cat");
    expect(JSON.stringify(got.view)).not.toContain("k/a.mp3");

    expect(await claimSection(u, full.attemptId, 0, deps)).toEqual({ ok: true, play: { kind: "voice", script: "The secret is cat." } });
    expect((await claimSection(u, full.attemptId, 0, deps)).ok).toBe(false); // one play in a full test
    // A recording is signed only now, for long enough to play through a section.
    expect(await claimSection(u, full.attemptId, 1, deps)).toEqual({ ok: true, play: { kind: "file", url: `https://r2.test/k/a.mp3?ttl=${AUDIO_LINK_SEC}` } });
    expect((await claimSection(u, full.attemptId, 1, deps)).ok).toBe(false);
    expect((await claimSection(u, full.attemptId, 2, deps)).ok).toBe(false); // nothing to play
    expect((await claimSection(user(), full.attemptId, 0, deps)).ok).toBe(false); // someone else's attempt

    const drill = await startTestAttempt(u, { skill: "listening", testId: String(doc._id), scope: 1, date: "2026-11-12" });
    if (!drill.ok) throw new Error("start");
    expect((await claimSection(u, drill.attemptId, 0, deps)).ok).toBe(true);
    expect((await claimSection(u, drill.attemptId, 0, deps)).ok).toBe(true); // drills can be replayed
    await submitAttempt(u, drill.attemptId, {});
    expect((await claimSection(u, drill.attemptId, 0, deps)).ok).toBe(false); // closed after submit
  });

  it("rejects an unknown section", async () => {
    const testId = await publishedTest(1);
    expect((await startTestAttempt(user(), { skill: "reading", testId, scope: 5, date: "2026-11-12" })).ok).toBe(false);
  });
});
