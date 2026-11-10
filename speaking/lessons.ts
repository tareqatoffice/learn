import { Types } from "mongoose";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { SpeakingDay, SpeakingLesson, SpeakingTake } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { TASKS, type TaskKey } from "./tasks";

export type LessonView = {
  id: string;
  title: string;
  order: number;
  shadow: { audioKey?: string; audioUrl?: string; durationSec?: number; text?: string } | null;
  passage: string;
  prompt: string;
};

type LessonDoc = {
  _id: unknown;
  title: string;
  order: number;
  shadow?: { audioKey?: string; audioUrl?: string; durationSec?: number; text?: string };
  passage?: string;
  prompt?: string;
};

function toView(doc: LessonDoc): LessonView {
  const s = doc.shadow;
  const shadow = s && (s.audioKey || s.audioUrl || s.text)
    ? { audioKey: s.audioKey, audioUrl: s.audioUrl, durationSec: s.durationSec, text: s.text }
    : null;
  return { id: String(doc._id), title: doc.title, order: doc.order, shadow, passage: doc.passage ?? "", prompt: doc.prompt ?? "" };
}

export function lessonHasPart(lesson: LessonView, task: TaskKey): boolean {
  if (task === "shadowing") {
    const sh = lesson.shadow;
    return Boolean(sh && (sh.audioKey || sh.audioUrl) && sh.text?.trim());
  }
  if (task === "readAloud") return Boolean(lesson.passage.trim());
  return Boolean(lesson.prompt.trim());
}

export async function listPublishedLessons(): Promise<{ id: string; title: string; order: number }[]> {
  await connectDb();
  const docs = await SpeakingLesson.find({ status: "published" }).sort({ order: 1 }).lean<LessonDoc[]>();
  return docs.map((d) => ({ id: String(d._id), title: d.title, order: d.order }));
}

async function publishedLesson(id: string): Promise<LessonView | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await SpeakingLesson.findOne({ _id: id, status: "published" }).lean<LessonDoc>();
  return doc ? toView(doc) : null;
}

function assign(userId: string, date: string, lessonId: string) {
  return retryOnDuplicateKey(() =>
    SpeakingDay.updateOne({ userId, date }, { $set: { lessonId } }, { upsert: true }),
  );
}

export async function todaysLesson(
  userId: string,
  date: string,
  enabled: Record<TaskKey, boolean>,
): Promise<LessonView | null> {
  await connectDb();
  const day = await SpeakingDay.findOne({ userId, date }).lean<{ lessonId: unknown }>();
  if (day) {
    const stored = await publishedLesson(String(day.lessonId));
    if (stored) return stored;
  }

  const lessons = (await SpeakingLesson.find({ status: "published" }).sort({ order: 1 }).lean<LessonDoc[]>()).map(toView);
  if (!lessons.length) return null;

  const takes = await SpeakingTake.find({ userId, "media.stored": true, lessonId: { $in: lessons.map((l) => l.id) } })
    .select("lessonId task")
    .lean<{ lessonId: unknown; task: TaskKey }[]>();
  const done = new Set(takes.map((t) => `${t.lessonId}:${t.task}`));
  const finished = (l: LessonView) =>
    TASKS.every((task) => !enabled[task] || !lessonHasPart(l, task) || done.has(`${l.id}:${task}`));

  // Everything finished: no assignment, so the UI can offer generated material.
  const pick = lessons.find((l) => !finished(l));
  if (!pick) return null;
  await assign(userId, date, pick.id);
  return pick;
}

export async function swapLesson(userId: string, date: string, lessonId: string): Promise<ActionResult> {
  await connectDb();
  if (!(await publishedLesson(lessonId))) return fail("That lesson is not available.");
  await assign(userId, date, lessonId);
  return ok();
}
