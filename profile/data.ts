// Data for the profile page: lifetime totals and history per area, plus a daily activity count.
// Every date handed to the page is a learner-local YYYY-MM-DD string, so the page never has to
// know about time zones and a late-night activity lands on the day the learner lived it.

import { isValidObjectId, Types } from "mongoose";
import { listBooksWithProgress, listSeriesWithProgress } from "@/content/queries";
import { filterUnder, visibleNoteFilter } from "@/content/visibility";
import {
  IeltsBandEntry,
  IeltsSpeakingAttempt,
  Note,
  NoteProgress,
  NoteSeries,
  QuizSession,
  SpeakingTake,
  User,
} from "@/models";
import { labelSessions, sessionCounts } from "@/progress/quiz";
import { addDays, localDate } from "@/speaking/schedule";
import { TASK_LABEL, type TaskKey } from "@/speaking/tasks";

type Id = Types.ObjectId;

export const PROFILE_TABS = ["overview", "notes", "interview", "speaking", "ielts"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export const TAB_LABEL: Record<ProfileTab, string> = {
  overview: "Overview",
  notes: "Notes",
  interview: "Interview",
  speaking: "Speaking",
  ielts: "IELTS",
};

export function parseTab(value: string | undefined): ProfileTab {
  return PROFILE_TABS.find((t) => t === value) ?? "overview";
}

const HISTORY_MAX = 15;
const ACTIVITY_DAYS = 84;
/** The widest UTC offset is 14 hours; a timestamp bound this far back never cuts a local day short. */
const MAX_OFFSET_MS = 14 * 3_600_000;

export type ActivityDay = { date: string; count: number };

/** The last `days` days ending at `today`, oldest first, with the count for each (0 when none). */
export function fillActivity(counts: Map<string, number>, today: string, days = ACTIVITY_DAYS): ActivityDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** Current streak: consecutive active days ending today, or yesterday if today has none yet. */
export function streakOf(activity: ActivityDay[]): number {
  let i = activity.length - 1;
  if (i >= 0 && activity[i].count === 0) i -= 1;
  let streak = 0;
  for (; i >= 0 && activity[i].count > 0; i -= 1) streak += 1;
  return streak;
}

export type NotesHistoryItem = { chapter: string; series: string; seriesSlug: string; chapterSlug: string; date: string };
export type QuizHistoryItem = { id: string; label: string; got: number; review: number; date: string };
export type TakeHistoryItem = { id: string; date: string; task: string };
export type AttemptHistoryItem = { id: string; date: string; kind: string; status: string; overall?: number };
export type BandHistoryItem = { date: string; source: string; overall?: number };

export type ProfileData = {
  name: string;
  image?: string;
  /** The day the account was created, in the learner's time zone. */
  joined: string | null;
  streak: number;
  activity: ActivityDay[];
  notes: { series: { slug: string; title: string; read: number; total: number }[]; read: number; total: number; history: NotesHistoryItem[] };
  interview: {
    books: { slug: string; title: string; mastered: number; total: number }[];
    mastered: number;
    total: number;
    quizzes: number;
    history: QuizHistoryItem[];
  };
  speaking: { takes: number; byTask: { task: string; count: number }[]; history: TakeHistoryItem[] };
  ielts: { attempts: number; completed: number; history: AttemptHistoryItem[]; bands: BandHistoryItem[] };
};

type Window = { today: string; timeZone: string; counts: Map<string, number>; since: string; sinceInstant: Date };
type DayRow = { _id: string; n: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function addDayRows(counts: Map<string, number>, rows: DayRow[]) {
  for (const r of rows) counts.set(r._id, (counts.get(r._id) ?? 0) + r.n);
}

/** $group stage that counts documents per learner-local day of a timestamp field. */
const perLocalDay = (field: string, timeZone: string) => ({
  $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: timeZone } }, n: { $sum: 1 } },
});

/** Per-day counts of documents that store their own local-date string, limited to the window. */
async function dayCountsOfDateField(
  model: typeof SpeakingTake | typeof IeltsSpeakingAttempt,
  userId: Id,
  w: Window,
): Promise<DayRow[]> {
  return model.aggregate<DayRow>([
    { $match: { userId, date: { $gte: w.since } } },
    { $group: { _id: "$date", n: { $sum: 1 } } },
  ]);
}

/**
 * Chapters marked read, in one pass over the user's progress: per-day counts for the heatmap and the
 * newest rows for the history. Chapters an admin has since unpublished are left out of both.
 */
async function notesArea(userId: Id, w: Window) {
  const [series, [facets]] = await Promise.all([
    listSeriesWithProgress(String(userId)),
    NoteProgress.aggregate<{
      days: DayRow[];
      history: { chapter: string; chapterSlug: string; seriesId: Id; readAt: Date }[];
    }>([
      { $match: { userId, read: true, readAt: { $ne: null } } },
      { $lookup: { from: Note.collection.name, localField: "noteId", foreignField: "_id", as: "note" } },
      { $unwind: "$note" },
      { $match: filterUnder("note", await visibleNoteFilter()) },
      {
        $facet: {
          days: [{ $match: { readAt: { $gte: w.sinceInstant } } }, perLocalDay("readAt", w.timeZone)],
          history: [
            { $sort: { readAt: -1 } },
            { $limit: HISTORY_MAX },
            { $project: { _id: 0, readAt: 1, seriesId: 1, chapter: "$note.title", chapterSlug: "$note.slug" } },
          ],
        },
      },
    ]),
  ]);
  addDayRows(w.counts, facets?.days ?? []);
  const history = facets?.history ?? [];
  const parents = await NoteSeries.find({ _id: { $in: history.map((h) => h.seriesId) } }, { slug: 1, title: 1 }).lean<
    { _id: Id; slug: string; title: string }[]
  >();
  const parent = new Map(parents.map((p) => [String(p._id), p]));
  return {
    series,
    read: sum(series.map((s) => s.read)),
    total: sum(series.map((s) => s.total)),
    history: history.flatMap((h) => {
      const p = parent.get(String(h.seriesId));
      return p
        ? [{ chapter: h.chapter, chapterSlug: h.chapterSlug, series: p.title, seriesSlug: p.slug, date: localDate(h.readAt, w.timeZone) }]
        : [];
    }),
  };
}

/** Finished quizzes count towards the heatmap on the day they were finished, whatever happened to the books since. */
async function interviewArea(userId: Id, w: Window) {
  const finished = { userId, finishedAt: { $ne: null } };
  const [books, quizzes, days, shown] = await Promise.all([
    listBooksWithProgress(String(userId)),
    QuizSession.countDocuments(finished),
    QuizSession.aggregate<DayRow>([{ $match: { ...finished, finishedAt: { $gte: w.sinceInstant } } }, perLocalDay("finishedAt", w.timeZone)]),
    // Full results (answers, coach chat) are read only for the rows shown.
    QuizSession.find(finished)
      .sort({ finishedAt: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .select("filter questionIds results finishedAt")
      .lean<
        {
          _id: Id;
          filter: { bookIds: Id[]; partKeys: string[]; mode: "unseen" | "review" | "all"; questionIds?: Id[] };
          questionIds: Id[];
          results: { questionId: Id; result: "got" | "review" | "skip"; at: Date }[];
          finishedAt: Date;
        }[]
      >(),
  ]);
  addDayRows(w.counts, days);
  const labels = await labelSessions(shown);
  return {
    books: books.map(({ slug, title, mastered, total }) => ({ slug, title, mastered, total })),
    mastered: sum(books.map((b) => b.mastered)),
    total: sum(books.map((b) => b.total)),
    quizzes,
    history: shown.map((s, i) => {
      const c = sessionCounts(s);
      return { id: String(s._id), label: labels[i] || "Quiz", got: c.got, review: c.review, date: localDate(s.finishedAt, w.timeZone) };
    }),
  };
}

async function speakingArea(userId: Id, w: Window) {
  const [takes, byTask, days, recent] = await Promise.all([
    SpeakingTake.countDocuments({ userId }),
    SpeakingTake.aggregate<{ _id: TaskKey; n: number }>([{ $match: { userId } }, { $group: { _id: "$task", n: { $sum: 1 } } }]),
    dayCountsOfDateField(SpeakingTake, userId, w),
    SpeakingTake.find({ userId }, { date: 1, task: 1 })
      .sort({ date: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<{ _id: Id; date: string; task: TaskKey }[]>(),
  ]);
  addDayRows(w.counts, days);
  return {
    takes,
    byTask: byTask.map((t) => ({ task: TASK_LABEL[t._id] ?? t._id, count: t.n })),
    history: recent.map((t) => ({ id: String(t._id), date: t.date, task: TASK_LABEL[t.task] ?? t.task })),
  };
}

async function ieltsArea(userId: Id, w: Window) {
  const [attempts, completed, days, recent, bands] = await Promise.all([
    IeltsSpeakingAttempt.countDocuments({ userId }),
    IeltsSpeakingAttempt.countDocuments({ userId, status: "complete" }),
    dayCountsOfDateField(IeltsSpeakingAttempt, userId, w),
    IeltsSpeakingAttempt.find({ userId }, { date: 1, kind: 1, status: 1, "ai.overall": 1 })
      .sort({ date: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<{ _id: Id; date: string; kind: string; status: string; ai?: { overall?: number } }[]>(),
    IeltsBandEntry.find({ userId }, { date: 1, source: 1, overall: 1 })
      .sort({ date: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<{ date: string; source: string; overall?: number }[]>(),
  ]);
  addDayRows(w.counts, days);
  return {
    attempts,
    completed,
    history: recent.map((a) => ({
      id: String(a._id),
      date: a.date,
      kind: a.kind,
      status: a.status,
      ...(a.ai?.overall !== undefined ? { overall: a.ai.overall } : {}),
    })),
    bands: bands.map((b) => ({ date: b.date, source: b.source, ...(b.overall !== undefined ? { overall: b.overall } : {}) })),
  };
}

export async function getProfileData(
  userId: string,
  fallback: { name: string; image?: string },
  timeZone = "UTC",
  now = new Date(),
): Promise<ProfileData> {
  const today = localDate(now, timeZone);
  const counts = new Map<string, number>();
  if (!isValidObjectId(userId)) {
    return {
      ...fallback,
      joined: null,
      streak: 0,
      activity: fillActivity(counts, today),
      notes: { series: [], read: 0, total: 0, history: [] },
      interview: { books: [], mastered: 0, total: 0, quizzes: 0, history: [] },
      speaking: { takes: 0, byTask: [], history: [] },
      ielts: { attempts: 0, completed: 0, history: [], bands: [] },
    };
  }
  const uid = new Types.ObjectId(userId);
  const since = addDays(today, -(ACTIVITY_DAYS - 1));
  const w: Window = { today, timeZone, counts, since, sinceInstant: new Date(Date.parse(`${since}T00:00:00Z`) - MAX_OFFSET_MS) };
  const [user, notes, interview, speaking, ielts] = await Promise.all([
    User.findById(uid, { createdAt: 1 }).lean<{ createdAt?: Date } | null>(),
    notesArea(uid, w),
    interviewArea(uid, w),
    speakingArea(uid, w),
    ieltsArea(uid, w),
  ]);
  const activity = fillActivity(counts, today);
  return {
    ...fallback,
    joined: user?.createdAt ? localDate(user.createdAt, timeZone) : null,
    streak: streakOf(activity),
    activity,
    notes,
    interview,
    speaking,
    ielts,
  };
}
