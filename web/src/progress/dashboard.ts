import { isValidObjectId, Types } from "mongoose";
import { listBooksWithProgress, listSeriesWithProgress } from "@/content/queries";
import { filterUnder, visibleNodeFilter, visibleNoteFilter, visibleQuestionFilter } from "@/content/visibility";
import { readyNext as readyIn } from "@/graph/layout";
import { Graph, GraphNode, Note, NodeProgress, NoteProgress, NoteSeries, Question, QuestionBook, QuestionProgress, QuizSession } from "@/models";
import { labelSessions, sessionCounts } from "./quiz";
import type { MarkResult } from "./questions";

type Id = Types.ObjectId;

export type Dashboard = {
  continueReading: { seriesSlug: string; seriesTitle: string; chapterSlug: string; chapterTitle: string; read: number; total: number } | null;
  learningNow: { graphSlug: string; graphTitle: string; topics: { slug: string; title: string }[] }[];
  readyNext: { graphSlug: string; slug: string; title: string }[];
  reviewPile: { total: number; byBook: { slug: string; title: string; count: number }[] };
  graphs: { slug: string; title: string; done: number; total: number }[];
  books: { slug: string; title: string; mastered: number; total: number }[];
  series: { slug: string; title: string; read: number; total: number }[];
  recentQuizzes: { id: string; label: string; got: number; review: number; finishedAt: Date }[];
};

const READY_NEXT_MAX = 3;
const RECENT_QUIZZES = 5;

/** The most recently opened chapter that is still visible, with its series' read count. */
async function continueReading(userId: string, series: Dashboard["series"]): Promise<Dashboard["continueReading"]> {
  // Walks the user's opened chapters newest first and stops at the first visible one.
  const [note] = await NoteProgress.aggregate<{ slug: string; title: string; seriesId: Id }>([
    { $match: { userId: new Types.ObjectId(userId), lastOpenedAt: { $ne: null } } },
    { $sort: { lastOpenedAt: -1 } },
    { $lookup: { from: Note.collection.name, localField: "noteId", foreignField: "_id", as: "note" } },
    { $unwind: "$note" },
    { $match: filterUnder("note", await visibleNoteFilter()) },
    { $limit: 1 },
    { $project: { _id: 0, slug: "$note.slug", title: "$note.title", seriesId: "$note.seriesId" } },
  ]);
  const parent = note && (await NoteSeries.findById(note.seriesId, { slug: 1, title: 1 }).lean<{ slug: string; title: string }>());
  if (!note || !parent) return null;
  const counts = series.find((s) => s.slug === parent.slug);
  return {
    seriesSlug: parent.slug,
    seriesTitle: parent.title,
    chapterSlug: note.slug,
    chapterTitle: note.title,
    read: counts?.read ?? 0,
    total: counts?.total ?? 0,
  };
}

/**
 * Every visible graph with its done count, then, for graphs the user has started, the topics marked
 * learning and up to three ready topics. One read of the visible topics serves all three.
 */
async function graphActivity(userId: string): Promise<Pick<Dashboard, "graphs" | "learningNow" | "readyNext">> {
  const nodeFilter = await visibleNodeFilter();
  const [graphs, nodes] = await Promise.all([
    Graph.find({ status: "published" }, { slug: 1, title: 1 }).sort({ order: 1, title: 1 }).lean<{ _id: Id; slug: string; title: string }[]>(),
    GraphNode.find(nodeFilter, { graphId: 1, slug: 1, title: 1, prereqIds: 1 })
      .sort({ order: 1, _id: 1 })
      .lean<{ _id: Id; graphId: Id; slug: string; title: string; prereqIds?: Id[] }[]>(),
  ]);
  const rows = isValidObjectId(userId)
    ? await NodeProgress.find({ userId, nodeId: { $in: nodes.map((n) => n._id) } }, { nodeId: 1, status: 1 }).lean<
        { nodeId: Id; status: "learning" | "done" }[]
      >()
    : [];
  const progress = Object.fromEntries(rows.map((r) => [String(r.nodeId), r.status]));

  const shelf: Dashboard["graphs"] = [];
  const learningNow: Dashboard["learningNow"] = [];
  const readyNext: Dashboard["readyNext"] = [];
  for (const g of graphs) {
    const mine = nodes.filter((n) => String(n.graphId) === String(g._id));
    shelf.push({ slug: g.slug, title: g.title, done: mine.filter((n) => progress[String(n._id)] === "done").length, total: mine.length });
    if (!mine.some((n) => progress[String(n._id)])) continue;
    const learning = mine.filter((n) => progress[String(n._id)] === "learning");
    if (learning.length) {
      learningNow.push({ graphSlug: g.slug, graphTitle: g.title, topics: learning.map(({ slug, title }) => ({ slug, title })) });
    }
    const ready = new Set(readyIn(mine.map((n) => ({ id: String(n._id), prereqIds: (n.prereqIds ?? []).map(String) })), progress));
    for (const n of mine) if (ready.has(String(n._id))) readyNext.push({ graphSlug: g.slug, slug: n.slug, title: n.title });
  }
  return { graphs: shelf, learningNow, readyNext: readyNext.slice(0, READY_NEXT_MAX) };
}

/** Visible questions in the user's review pile, counted per book in book order. */
async function reviewPile(userId: string): Promise<Dashboard["reviewPile"]> {
  const rows = await QuestionProgress.aggregate<{ _id: Id; count: number }>([
    { $match: { userId: new Types.ObjectId(userId), status: "review" } },
    { $lookup: { from: Question.collection.name, localField: "questionId", foreignField: "_id", as: "q" } },
    { $unwind: "$q" },
    { $match: filterUnder("q", await visibleQuestionFilter()) },
    { $group: { _id: "$q.bookId", count: { $sum: 1 } } },
  ]);
  const books = await QuestionBook.find({ _id: { $in: rows.map((r) => r._id) } }, { slug: 1, title: 1 })
    .sort({ order: 1, title: 1 })
    .lean<{ _id: Id; slug: string; title: string }[]>();
  const countOf = new Map(rows.map((r) => [String(r._id), r.count]));
  const byBook = books.map((b) => ({ slug: b.slug, title: b.title, count: countOf.get(String(b._id)) ?? 0 }));
  return { total: byBook.reduce((sum, b) => sum + b.count, 0), byBook };
}

async function recentQuizzes(userId: string): Promise<Dashboard["recentQuizzes"]> {
  const sessions = await QuizSession.find({ userId, finishedAt: { $ne: null } })
    .sort({ finishedAt: -1, _id: -1 })
    .limit(RECENT_QUIZZES)
    .lean<
      {
        _id: Id;
        filter: { bookIds: Id[]; partKeys: string[]; mode: "unseen" | "review" | "all"; questionIds?: Id[] };
        questionIds: Id[];
        results: { questionId: Id; result: MarkResult; at: Date }[];
        finishedAt: Date;
      }[]
    >();
  const labels = await labelSessions(sessions);
  return sessions.map((s, i) => {
    const counts = sessionCounts(s);
    return { id: String(s._id), label: labels[i] || "Quiz", got: counts.got, review: counts.review, finishedAt: s.finishedAt };
  });
}

export async function getDashboard(userId: string): Promise<Dashboard> {
  const [activity, books, series] = await Promise.all([
    graphActivity(userId),
    listBooksWithProgress(userId),
    listSeriesWithProgress(userId),
  ]);
  const shelf = {
    ...activity,
    books: books.map(({ slug, title, mastered, total }) => ({ slug, title, mastered, total })),
    series,
  };
  if (!isValidObjectId(userId)) {
    return { continueReading: null, reviewPile: { total: 0, byBook: [] }, recentQuizzes: [], ...shelf };
  }

  const [reading, pile, quizzes] = await Promise.all([continueReading(userId, series), reviewPile(userId), recentQuizzes(userId)]);
  return { continueReading: reading, reviewPile: pile, recentQuizzes: quizzes, ...shelf };
}
