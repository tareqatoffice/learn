
import { isValidObjectId, Types } from "mongoose";
import { listBooksWithProgress, listGraphsWithProgress, listSeriesWithProgress } from "@/features/content/queries";
import { filterUnder, visibleNodeFilter, visibleNoteFilter } from "@/features/content/visibility";
import {
  FocusSession,
  Graph,
  GraphNode,
  IeltsBandEntry,
  IeltsSpeakingAttempt,
  IeltsStudyLog,
  IeltsTestAttempt,
  IeltsWritingAttempt,
  NodeProgress,
  Note,
  NoteProgress,
  NoteSeries,
  QuizSession,
  SpeakingTake,
  User,
} from "@/models";
import { labelSessions, quizDate, quizHistoryFilter, sessionCounts, SUMMARY_PROJECTION } from "@/features/progress/quiz";
import { addDays, localDate } from "@/features/speaking/schedule";
import { TASK_LABEL, type TaskKey } from "@/features/speaking/tasks";
import type { FocusArea } from "@/models/focusConstants";

type Id = Types.ObjectId;

export const PROFILE_TABS = ["overview", "focus", "notes", "interview", "graphs", "speaking", "ielts"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export const TAB_LABEL: Record<ProfileTab, string> = {
  overview: "Overview",
  focus: "Focus",
  notes: "Notes",
  interview: "Interview",
  graphs: "Graphs",
  speaking: "Speaking",
  ielts: "IELTS",
};

export function parseTab(value: string | undefined): ProfileTab {
  return PROFILE_TABS.find((t) => t === value) ?? "overview";
}

const HISTORY_MAX = 15;
const ACTIVITY_DAYS = 84;

export type ActivityDay = { date: string; count: number };

export function fillActivity(counts: Map<string, number>, today: string, days = ACTIVITY_DAYS): ActivityDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function streakOf(activity: ActivityDay[]): number {
  let i = activity.length - 1;
  if (i >= 0 && activity[i].count === 0) i -= 1;
  let streak = 0;
  for (; i >= 0 && activity[i].count > 0; i -= 1) streak += 1;
  return streak;
}

export function activityStreak(counts: Map<string, number>, today: string): number {
  let day = (counts.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let streak = 0;
  while ((counts.get(day) ?? 0) > 0) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export type NotesHistoryItem = { chapter: string; series: string; seriesSlug: string; chapterSlug: string; date: string };
export type QuizHistoryItem = { id: string; label: string; got: number; review: number; finished: boolean; date: string };
export type TopicHistoryItem = { topic: string; topicSlug: string; graph: string; graphSlug: string; date: string };
export type TakeHistoryItem = { id: string; date: string; task: string };
export type IeltsArea = "speaking" | "listening" | "reading" | "writing";
export type AttemptHistoryItem = {
  id: string;
  date: string;
  area: IeltsArea;
  kind: string;
  done: boolean;
  band?: number;
  href: string;
};
export type FocusHistoryItem = {
  id: string;
  date: string;
  label: string;
  path: string;
  area: FocusArea;
  seconds: number;
  targetMinutes?: number;
  completed: boolean;
};
export type FocusData = {
  totalSeconds: number;
  sessions: number;
  weekSeconds: number;
  byArea: { area: FocusArea; seconds: number; sessions: number }[];
  history: FocusHistoryItem[];
};
export type Bands = { listening?: number; reading?: number; writing?: number; speaking?: number };
export type BandHistoryItem = { date: string; source: string; overall?: number; bands: Bands };

export type ProfileData = {
  name: string;
  image?: string;
  joined: string | null;
  streak: number;
  activity: ActivityDay[];
  focus: FocusData;
  notes: { series: { slug: string; title: string; read: number; total: number }[]; read: number; total: number; history: NotesHistoryItem[] };
  interview: {
    books: { slug: string; title: string; mastered: number; total: number }[];
    mastered: number;
    total: number;
    quizzes: number;
    history: QuizHistoryItem[];
  };
  graphs: { graphs: { slug: string; title: string; done: number; total: number }[]; done: number; total: number; history: TopicHistoryItem[] };
  speaking: { takes: number; byTask: { task: string; count: number }[]; history: TakeHistoryItem[] };
  ielts: {
    speaking: { attempts: number; completed: number };
    tests: number;
    writing: number;
    studyMinutes: number;
    history: AttemptHistoryItem[];
    bands: BandHistoryItem[];
  };
};

type Window = { timeZone: string; counts: Map<string, number> };
type DayRow = { _id: string; n: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function addDayRows(counts: Map<string, number>, rows: DayRow[]) {
  for (const r of rows) counts.set(r._id, (counts.get(r._id) ?? 0) + r.n);
}

const perLocalDay = (field: string, timeZone: string) => ({
  $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: timeZone } }, n: { $sum: 1 } },
});

async function dayCountsOfDateField(model: typeof SpeakingTake, match: Record<string, unknown>): Promise<DayRow[]> {
  return model.aggregate<DayRow>([{ $match: match }, { $group: { _id: "$date", n: { $sum: 1 } } }]);
}

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
          days: [perLocalDay("readAt", w.timeZone)],
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

async function interviewArea(userId: Id, w: Window) {
  const finished = { userId, finishedAt: { $ne: null } };
  const [books, quizzes, days, shown] = await Promise.all([
    listBooksWithProgress(String(userId)),
    QuizSession.countDocuments(finished),
    QuizSession.aggregate<DayRow>([
      { $match: { userId, "results.0": { $exists: true } } },
      { $unwind: "$results" },
      {
        $group: {
          _id: { s: "$_id", day: { $dateToString: { format: "%Y-%m-%d", date: "$results.at", timezone: w.timeZone } } },
        },
      },
      { $group: { _id: "$_id.day", n: { $sum: 1 } } },
    ]),
    QuizSession.find(quizHistoryFilter(userId), SUMMARY_PROJECTION)
      .sort({ startedAt: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<
        {
          _id: Id;
          filter: { bookIds: Id[]; partKeys: string[]; mode: "unseen" | "review" | "all"; questionIds?: Id[] };
          questionIds: Id[];
          results: { questionId: Id; result: "got" | "review" | "skip"; at: Date }[];
          startedAt: Date;
          finishedAt?: Date | null;
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
      return { id: String(s._id), label: labels[i] || "Quiz", got: c.got, review: c.review, finished: Boolean(s.finishedAt), date: localDate(quizDate(s), w.timeZone) };
    }),
  };
}

async function graphsArea(userId: Id, w: Window) {
  const [graphs, [facets]] = await Promise.all([
    listGraphsWithProgress(String(userId)),
    NodeProgress.aggregate<{ days: DayRow[]; history: { topic: string; topicSlug: string; graphId: Id; doneAt: Date }[] }>([
      { $match: { userId, status: "done", doneAt: { $ne: null } } },
      { $lookup: { from: GraphNode.collection.name, localField: "nodeId", foreignField: "_id", as: "node" } },
      { $unwind: "$node" },
      { $match: filterUnder("node", await visibleNodeFilter()) },
      {
        $facet: {
          days: [perLocalDay("doneAt", w.timeZone)],
          history: [
            { $sort: { doneAt: -1 } },
            { $limit: HISTORY_MAX },
            { $project: { _id: 0, doneAt: 1, graphId: "$node.graphId", topic: "$node.title", topicSlug: "$node.slug" } },
          ],
        },
      },
    ]),
  ]);
  addDayRows(w.counts, facets?.days ?? []);
  const history = facets?.history ?? [];
  const parents = await Graph.find({ _id: { $in: history.map((h) => h.graphId) } }, { slug: 1, title: 1 }).lean<{ _id: Id; slug: string; title: string }[]>();
  const parent = new Map(parents.map((p) => [String(p._id), p]));
  return {
    graphs,
    done: sum(graphs.map((g) => g.done)),
    total: sum(graphs.map((g) => g.total)),
    history: history.flatMap((h) => {
      const p = parent.get(String(h.graphId));
      return p ? [{ topic: h.topic, topicSlug: h.topicSlug, graph: p.title, graphSlug: p.slug, date: localDate(h.doneAt, w.timeZone) }] : [];
    }),
  };
}

async function speakingArea(userId: Id, w: Window) {
  const stored = { userId, "media.stored": true };
  const [takes, byTask, days, recent] = await Promise.all([
    SpeakingTake.countDocuments(stored),
    SpeakingTake.aggregate<{ _id: TaskKey; n: number }>([{ $match: stored }, { $group: { _id: "$task", n: { $sum: 1 } } }]),
    dayCountsOfDateField(SpeakingTake, stored),
    SpeakingTake.find(stored, { date: 1, task: 1 })
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

const EMPTY_FOCUS: FocusData = { totalSeconds: 0, sessions: 0, weekSeconds: 0, byArea: [], history: [] };

async function focusArea(userId: Id, w: Window, today: string): Promise<FocusData> {
  const weekStart = addDays(today, -6);
  const [byArea, days, week, recent] = await Promise.all([
    FocusSession.aggregate<{ _id: FocusArea; seconds: number; sessions: number }>([
      { $match: { userId } },
      { $group: { _id: "$area", seconds: { $sum: "$seconds" }, sessions: { $sum: 1 } } },
      { $sort: { seconds: -1, _id: 1 } },
    ]),
    dayCountsOfDateField(FocusSession as typeof SpeakingTake, { userId }),
    FocusSession.aggregate<{ n: number }>([
      { $match: { userId, date: { $gte: weekStart, $lte: today } } },
      { $group: { _id: null, n: { $sum: "$seconds" } } },
    ]),
    FocusSession.find({ userId }, { date: 1, label: 1, path: 1, area: 1, seconds: 1, targetMinutes: 1, completed: 1 })
      .sort({ startedAt: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<{ _id: Id; date: string; label: string; path: string; area: FocusArea; seconds: number; targetMinutes?: number; completed?: boolean }[]>(),
  ]);
  addDayRows(w.counts, days);
  return {
    totalSeconds: sum(byArea.map((a) => a.seconds)),
    sessions: sum(byArea.map((a) => a.sessions)),
    weekSeconds: week[0]?.n ?? 0,
    byArea: byArea.map((a) => ({ area: a._id, seconds: a.seconds, sessions: a.sessions })),
    history: recent.map((f) => ({
      id: String(f._id),
      date: f.date,
      label: f.label,
      path: f.path,
      area: f.area,
      seconds: f.seconds,
      completed: Boolean(f.completed),
      ...(f.targetMinutes !== undefined ? { targetMinutes: f.targetMinutes } : {}),
    })),
  };
}

type Dated = { _id: Id; date: string; createdAt?: Date };
const newestFirst = (a: { date: string; at: number }, b: { date: string; at: number }) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1);

async function ieltsArea(userId: Id, w: Window) {
  const spoken = { userId, "parts.media.stored": true };
  const submitted = { userId, status: "submitted" };
  const [attempts, completed, tests, writing, minutes, ...dayRows] = await Promise.all([
    IeltsSpeakingAttempt.countDocuments(spoken),
    IeltsSpeakingAttempt.countDocuments({ ...spoken, status: "complete" }),
    IeltsTestAttempt.countDocuments(submitted),
    IeltsWritingAttempt.countDocuments(submitted),
    IeltsStudyLog.aggregate<{ _id: null; n: number }>([{ $match: { userId } }, { $group: { _id: null, n: { $sum: "$minutes" } } }]),
    dayCountsOfDateField(IeltsSpeakingAttempt as typeof SpeakingTake, spoken),
    dayCountsOfDateField(IeltsTestAttempt as typeof SpeakingTake, submitted),
    dayCountsOfDateField(IeltsWritingAttempt as typeof SpeakingTake, submitted),
    dayCountsOfDateField(IeltsStudyLog as typeof SpeakingTake, { userId }),
  ]);
  for (const rows of dayRows) addDayRows(w.counts, rows);

  const recent = { sort: { date: -1 as const, _id: -1 as const }, limit: HISTORY_MAX };
  const [speakingRows, testRows, writingRows, bands] = await Promise.all([
    IeltsSpeakingAttempt.find(spoken, { date: 1, kind: 1, status: 1, "ai.overall": 1, createdAt: 1 })
      .sort(recent.sort)
      .limit(recent.limit)
      .lean<(Dated & { kind: string; status: string; ai?: { overall?: number } })[]>(),
    IeltsTestAttempt.find({ userId }, { date: 1, skill: 1, scope: 1, status: 1, "score.band": 1, createdAt: 1 })
      .sort(recent.sort)
      .limit(recent.limit)
      .lean<(Dated & { skill: "listening" | "reading"; scope: string; status: string; score?: { band?: number } })[]>(),
    IeltsWritingAttempt.find({ userId }, { date: 1, kind: 1, status: 1, "ai.overall": 1, createdAt: 1 })
      .sort(recent.sort)
      .limit(recent.limit)
      .lean<(Dated & { kind: string; status: string; ai?: { overall?: number } })[]>(),
    IeltsBandEntry.find({ userId }, { date: 1, source: 1, overall: 1, bands: 1 })
      .sort({ date: -1, _id: -1 })
      .limit(HISTORY_MAX)
      .lean<{ date: string; source: string; overall?: number; bands?: Bands }[]>(),
  ]);

  const at = (r: Dated) => r.createdAt?.getTime() ?? r._id.getTimestamp().getTime();
  const band = (value: number | undefined) => (value !== undefined ? { band: value } : {});
  const history: (AttemptHistoryItem & { at: number })[] = [
    ...speakingRows.map((a) => ({
      id: String(a._id),
      date: a.date,
      at: at(a),
      area: "speaking" as const,
      kind: a.kind,
      done: a.status === "complete",
      ...band(a.ai?.overall),
      href: a.status === "complete" ? `/ielts/speaking/${a._id}/review` : `/ielts/speaking/${a._id}`,
    })),
    ...testRows.map((a) => ({
      id: String(a._id),
      date: a.date,
      at: at(a),
      area: a.skill,
      kind: a.scope === "full" ? "Full test" : `Section ${Number(a.scope) + 1} drill`,
      done: a.status === "submitted",
      ...band(a.score?.band),
      href: `/ielts/test/${a._id}`,
    })),
    ...writingRows.map((a) => ({
      id: String(a._id),
      date: a.date,
      at: at(a),
      area: "writing" as const,
      kind: a.kind === "full" ? "Full test" : a.kind === "task1" ? "Task 1" : "Task 2",
      done: a.status === "submitted",
      ...band(a.ai?.overall),
      href: `/ielts/writing/${a._id}`,
    })),
  ];

  return {
    speaking: { attempts, completed },
    tests,
    writing,
    studyMinutes: minutes[0]?.n ?? 0,
    history: history
      .sort(newestFirst)
      .slice(0, HISTORY_MAX)
      .map((item): AttemptHistoryItem => ({ id: item.id, date: item.date, area: item.area, kind: item.kind, done: item.done, href: item.href, ...(item.band !== undefined ? { band: item.band } : {}) })),
    bands: bands.map((b) => ({ date: b.date, source: b.source, bands: b.bands ?? {}, ...(b.overall !== undefined ? { overall: b.overall } : {}) })),
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
      focus: EMPTY_FOCUS,
      notes: { series: [], read: 0, total: 0, history: [] },
      interview: { books: [], mastered: 0, total: 0, quizzes: 0, history: [] },
      graphs: { graphs: [], done: 0, total: 0, history: [] },
      speaking: { takes: 0, byTask: [], history: [] },
      ielts: { speaking: { attempts: 0, completed: 0 }, tests: 0, writing: 0, studyMinutes: 0, history: [], bands: [] },
    };
  }
  const uid = new Types.ObjectId(userId);
  const w: Window = { timeZone, counts };
  const [user, focus, notes, interview, graphs, speaking, ielts] = await Promise.all([
    User.findById(uid, { createdAt: 1 }).lean<{ createdAt?: Date } | null>(),
    focusArea(uid, w, today),
    notesArea(uid, w),
    interviewArea(uid, w),
    graphsArea(uid, w),
    speakingArea(uid, w),
    ieltsArea(uid, w),
  ]);
  return {
    ...fallback,
    joined: user?.createdAt ? localDate(user.createdAt, timeZone) : null,
    streak: activityStreak(counts, today),
    activity: fillActivity(counts, today),
    focus,
    notes,
    interview,
    graphs,
    speaking,
    ielts,
  };
}
