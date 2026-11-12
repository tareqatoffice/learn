// Listening and Reading attempts: start, autosave, submit (marked here, never in the browser), review.

import { Types } from "mongoose";
import { type ActionResult, fail, ok } from "@/admin/result";
import { connectDb } from "@/lib/db";
import { presignGet, storageConfigured } from "@/lib/r2";
import { IeltsBandEntry, IeltsListeningTest, IeltsReadingTest, IeltsTestAttempt } from "@/models";
import { numberSections, scoreSections, toPublic, type PublicSection, type Score, type Section } from "./marking";

export type TestSkill = "listening" | "reading";
export const TEST_SKILLS: TestSkill[] = ["listening", "reading"];

const isId = (id: unknown): id is string => typeof id === "string" && Types.ObjectId.isValid(id);
const NOT_FOUND = "That attempt doesn't exist.";
const MAX_ANSWER = 200;
/** Allowed overrun when an attempt is submitted (clock drift, slow network). */
const GRACE_SEC = 60;

const model = (skill: TestSkill) => (skill === "listening" ? IeltsListeningTest : IeltsReadingTest);

/** Seconds: a full test, or one section. */
export function limitFor(skill: TestSkill, full: boolean): number {
  if (skill === "reading") return (full ? 60 : 20) * 60;
  return (full ? 40 : 10) * 60;
}

export type TestSummary = { id: string; title: string; sections: { title: string; questions: number; hasAudio: boolean }[]; questions: number };

type TestRow = { _id: Types.ObjectId; title: string; sections: Section[] };

export async function listTests(skill: TestSkill): Promise<TestSummary[]> {
  await connectDb();
  const rows = await model(skill).find({ status: "published" }).sort({ title: 1 }).lean<TestRow[]>();
  return rows
    .map((t) => {
      const sections = t.sections.map((s) => ({
        title: s.title,
        questions: s.groups.reduce((n, g) => n + g.questions.length, 0),
        hasAudio: Boolean(s.audioKey) || Boolean(s.script),
      }));
      return { id: String(t._id), title: t.title, sections, questions: sections.reduce((n, s) => n + s.questions, 0) };
    })
    .filter((t) => t.questions > 0);
}

export async function startTestAttempt(
  userId: string,
  input: { skill: TestSkill; testId: string; scope: "full" | number; date: string },
  now: Date = new Date(),
): Promise<ActionResult<{ attemptId: string }>> {
  const { skill, testId, scope } = input ?? ({} as typeof input);
  if (!TEST_SKILLS.includes(skill) || !isId(testId) || !isId(userId)) return fail("That test doesn't exist.");
  await connectDb();
  const test = await model(skill).findOne({ _id: testId, status: "published" }).lean<TestRow>();
  if (!test) return fail("That test is no longer available.");
  let sections: Section[];
  if (scope === "full") sections = test.sections;
  else if (Number.isInteger(scope) && test.sections[scope as number]) sections = [test.sections[scope as number]];
  else return fail("That part of the test doesn't exist.");
  sections = JSON.parse(JSON.stringify(sections)) as Section[];
  if (!numberSections(sections)) return fail("That test has no questions.");

  const doc = await IeltsTestAttempt.create({
    userId,
    skill,
    testId,
    title: scope === "full" ? test.title : `${test.title} — ${sections[0].title}`,
    date: input.date,
    scope: String(scope),
    sections,
    startedAt: now,
    limitSec: limitFor(skill, scope === "full"),
  });
  return ok({ attemptId: String(doc._id) });
}

/** Merges the learner's answers into an unsubmitted attempt. Unknown question numbers are ignored. */
export async function saveAnswers(userId: string, attemptId: string, answers: Record<string, string>): Promise<ActionResult> {
  if (!isId(attemptId) || !isId(userId)) return fail(NOT_FOUND);
  await connectDb();
  const attempt = await IeltsTestAttempt.findOne({ _id: attemptId, userId, status: "in_progress" }).select("sections").lean<{ sections: Section[] }>();
  if (!attempt) return fail("This attempt was already submitted or doesn't exist.");
  const valid = new Set(attempt.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => String(q.n)))));
  const set: Record<string, string> = {};
  for (const [n, v] of Object.entries(answers ?? {})) {
    if (valid.has(n) && typeof v === "string") set[`answers.${n}`] = v.slice(0, MAX_ANSWER);
  }
  if (Object.keys(set).length) await IeltsTestAttempt.updateOne({ _id: attemptId, userId, status: "in_progress" }, { $set: set });
  return ok();
}

export type SubmitResult = { raw: number; total: number; band?: number };

const summary = (s: SubmitResult): SubmitResult => ({ raw: s.raw, total: s.total, ...(s.band !== undefined ? { band: s.band } : {}) });

type SubmitRow = {
  status: string;
  skill: TestSkill;
  scope: string;
  date: string;
  sections: Section[];
  answers?: Map<string, string> | Record<string, string>;
  startedAt: Date;
  limitSec: number;
  score?: SubmitResult;
};

const plainAnswers = (m: SubmitRow["answers"]): Record<string, string> => (m instanceof Map ? Object.fromEntries(m) : { ...(m ?? {}) });

export async function submitAttempt(
  userId: string,
  attemptId: string,
  answers: Record<string, string>,
  now: Date = new Date(),
): Promise<ActionResult<SubmitResult>> {
  if (!isId(attemptId) || !isId(userId)) return fail(NOT_FOUND);
  await saveAnswers(userId, attemptId, answers);
  await connectDb();
  const attempt = await IeltsTestAttempt.findOne({ _id: attemptId, userId }).lean<SubmitRow>();
  if (!attempt) return fail(NOT_FOUND);
  if (attempt.status === "submitted") return ok(summary(attempt.score as SubmitResult));

  const score = scoreSections(attempt.skill, attempt.sections, plainAnswers(attempt.answers));
  const elapsed = Math.round((now.getTime() - new Date(attempt.startedAt).getTime()) / 1000);
  const timeSec = Math.max(0, Math.min(elapsed, attempt.limitSec + GRACE_SEC));
  // Only the first submit wins; a second tab loses the race and reads the stored score.
  const res = await IeltsTestAttempt.updateOne(
    { _id: attemptId, userId, status: "in_progress" },
    {
      $set: {
        status: "submitted",
        submittedAt: now,
        timeSec,
        score: { raw: score.raw, total: score.total, ...(score.band !== undefined ? { band: score.band } : {}), results: score.results },
      },
    },
  );
  if (!res.matchedCount) {
    const again = await IeltsTestAttempt.findOne({ _id: attemptId, userId }).select("score").lean<{ score?: SubmitResult }>();
    return ok(summary(again?.score as SubmitResult));
  }
  if (attempt.scope === "full" && score.band !== undefined) {
    await IeltsBandEntry.updateOne(
      { userId, attemptId, source: "practice" },
      { $set: { date: attempt.date, bands: { [attempt.skill]: score.band } } },
      { upsert: true },
    );
  }
  return ok({ raw: score.raw, total: score.total, ...(score.band !== undefined ? { band: score.band } : {}) });
}

export type RunView = {
  id: string;
  skill: TestSkill;
  title: string;
  scope: string;
  limitSec: number;
  startedAt: string;
  answers: Record<string, string>;
  sections: PublicSection[];
  /**
   * Per section: "file" (a recording), "voice" (the browser reads the script) or "none". Neither the
   * audio link nor the script is in the page: both come from `claimSection` when Play is pressed.
   */
  audio: SectionAudioKind[];
};

export type SectionAudioKind = "file" | "voice" | "none";

export type ReviewView = {
  id: string;
  skill: TestSkill;
  title: string;
  scope: string;
  date: string;
  timeSec: number;
  score: Score;
  sections: Section[];
};

type AttemptRow = SubmitRow & {
  _id: Types.ObjectId;
  title: string;
  timeSec?: number;
  score?: { raw: number; total: number; band?: number; results: Score["results"] };
};

export async function getAttempt(
  userId: string,
  attemptId: string,
): Promise<{ state: "run"; view: RunView } | { state: "review"; view: ReviewView } | null> {
  if (!isId(attemptId) || !isId(userId)) return null;
  await connectDb();
  const a = await IeltsTestAttempt.findOne({ _id: attemptId, userId }).lean<AttemptRow & { score?: { results: Score["results"] } }>();
  if (!a) return null;
  if (a.status === "submitted" && a.score) {
    const s = a.score as { raw: number; total: number; band?: number; results?: Score["results"] };
    return {
      state: "review",
      view: {
        id: String(a._id),
        skill: a.skill,
        title: a.title,
        scope: a.scope,
        date: a.date,
        timeSec: a.timeSec ?? 0,
        score: { raw: s.raw, total: s.total, ...(s.band !== undefined ? { band: s.band } : {}), results: s.results ?? [] },
        sections: a.sections,
      },
    };
  }
  return {
    state: "run",
    view: {
      id: String(a._id),
      skill: a.skill,
      title: a.title,
      scope: a.scope,
      limitSec: a.limitSec,
      startedAt: new Date(a.startedAt).toISOString(),
      answers: plainAnswers(a.answers),
      sections: toPublic(a.sections),
      audio: a.sections.map((s): SectionAudioKind => (s.audioKey ? "file" : s.script ? "voice" : "none")),
    },
  };
}

/** Long enough for any section to play through, signed only when Play is pressed. */
export const AUDIO_LINK_SEC = 30 * 60;

export type SectionPlay = { kind: "file"; url: string } | { kind: "voice"; script: string };

/**
 * What a Listening section plays, handed out when Play is pressed: a freshly signed link to its
 * recording, or the script for the browser voice (the script holds the answers). Only while the
 * attempt is open, and in a full test only once per section, recorded here rather than in the browser.
 */
export async function claimSection(
  userId: string,
  attemptId: string,
  index: number,
  deps: { sign?: (key: string, expiresIn: number) => Promise<string>; storage?: () => boolean } = {},
): Promise<ActionResult<{ play: SectionPlay }>> {
  const { sign = presignGet, storage = storageConfigured } = deps;
  if (!isId(attemptId) || !isId(userId) || !Number.isInteger(index) || index < 0) return fail(NOT_FOUND);
  await connectDb();
  const a = await IeltsTestAttempt.findOne({ _id: attemptId, userId, status: "in_progress" })
    .select("skill scope sections")
    .lean<{ skill: TestSkill; scope: string; sections: Section[] }>();
  const section = a?.sections[index];
  if (!a || a.skill !== "listening" || !section || (!section.audioKey && !section.script)) return fail("There is no audio for this section.");
  if (section.audioKey && !storage()) return fail("Audio storage isn't set up.");
  if (a.scope === "full") {
    const claimed = await IeltsTestAttempt.updateOne(
      { _id: attemptId, userId, status: "in_progress", played: { $ne: index } },
      { $addToSet: { played: index } },
    );
    if (!claimed.matchedCount) return fail("This section has already been played. A full test plays it once.");
  }
  if (section.audioKey) return ok({ play: { kind: "file", url: await sign(section.audioKey, AUDIO_LINK_SEC) } });
  return ok({ play: { kind: "voice", script: section.script } });
}

export type AttemptListItem = {
  id: string;
  skill: TestSkill;
  title: string;
  date: string;
  status: string;
  scope: string;
  raw?: number;
  total?: number;
  band?: number;
};

export async function listTestAttempts(userId: string, opts: { skill?: TestSkill; limit?: number } = {}): Promise<AttemptListItem[]> {
  if (!isId(userId)) return [];
  await connectDb();
  const rows = await IeltsTestAttempt.find({ userId, ...(opts.skill ? { skill: opts.skill } : {}) })
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 50)
    .select("skill title date status scope score.raw score.total score.band")
    .lean<(Omit<AttemptRow, "score"> & { score?: { raw: number; total: number; band?: number } })[]>();
  return rows.map((r) => ({
    id: String(r._id),
    skill: r.skill,
    title: r.title,
    date: r.date,
    status: r.status,
    scope: r.scope,
    ...(r.score ? { raw: r.score.raw, total: r.score.total, ...(r.score.band !== undefined ? { band: r.score.band } : {}) } : {}),
  }));
}

export async function deleteTestAttempt(userId: string, attemptId: string): Promise<ActionResult> {
  if (!isId(attemptId) || !isId(userId)) return fail(NOT_FOUND);
  await connectDb();
  const res = await IeltsTestAttempt.deleteOne({ _id: attemptId, userId });
  if (!res.deletedCount) return fail(NOT_FOUND);
  await IeltsBandEntry.deleteMany({ userId, attemptId });
  return ok();
}
