import { isValidObjectId, type Types } from "mongoose";
import { visibleNodeFilter, visibleQuestionFilter } from "@/content/visibility";
import { ForbiddenError } from "@/lib/authz";
import { Graph, GraphNode, Question, QuestionBook, QuestionProgress, QuizSession } from "@/models";
import { markQuestion, type MarkResult } from "./questions";

export type QuizMode = "unseen" | "review" | "all";

export type QuizFilter = {
  bookIds: string[];
  partKeys: string[];
  mode: QuizMode;
  size: 10 | 20 | 50 | null;
  questionIds?: string[];
};

export type SessionView = {
  sessionId: string;
  /** Cards behind the cursor (answered or skipped as hidden); the current card is number `position + 1`. */
  position: number;
  /** Deck length, including cards requeued by a Review mark. */
  total: number;
  done: boolean;
  counts: Record<MarkResult, number>;
  current: null | {
    id: string;
    question: string;
    prompt: string;
    answer: string;
    bookSlug: string;
    bookTitle: string;
    partTitle: string;
    topic?: { graphSlug: string; nodeSlug: string; title: string };
  };
};

type Id = Types.ObjectId;
type SessionRow = {
  _id: Id;
  filter: { bookIds: Id[]; partKeys: string[]; mode: QuizMode; questionIds?: Id[] };
  questionIds: Id[];
  results: { questionId: Id; result: MarkResult; at: Date }[];
  cursor: number;
  startedAt: Date;
  finishedAt?: Date | null;
};
type BookRow = { _id: Id; slug: string; title: string; order: number; parts: { key: string; title: string }[] };

/** Where a card marked Review goes back into the deck: 5-9 cards later, at most the end (deck.js `requeue`). */
export function requeueIndex(deckLength: number, cursor: number, rand: () => number): number {
  return Math.min(deckLength, cursor + 1 + 4 + Math.floor(rand() * 5));
}

export function sessionLabel(bookTitles: string[], partTitle?: string): string {
  const books = bookTitles.length >= 3 ? "Mixed" : bookTitles.join(" · ");
  return [books, partTitle].filter(Boolean).join(" · ");
}

/** Fisher-Yates, as in deck.js `shuffle`. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const validIds = (ids: string[]) => ids.filter((id) => isValidObjectId(id));

/** Visible questions matching the filter: questionIds override books/parts; parts apply to a single book only. */
async function deckQuery(userId: string, filter: QuizFilter) {
  const and: Record<string, unknown>[] = [];
  if (filter.questionIds) {
    and.push(await visibleQuestionFilter(), { _id: { $in: validIds(filter.questionIds) } });
  } else {
    and.push(await visibleQuestionFilter(filter.bookIds.length ? filter.bookIds : undefined));
    if (filter.bookIds.length === 1 && filter.partKeys.length) and.push({ partKey: { $in: filter.partKeys } });
  }
  if (filter.mode !== "all") {
    const progress = filter.mode === "review" ? { userId, status: "review" } : { userId };
    const seen = await QuestionProgress.distinct("questionId", progress);
    and.push({ _id: filter.mode === "review" ? { $in: seen } : { $nin: seen } });
  }
  return { $and: and };
}

/** Samples a shuffled deck. An empty deck creates nothing. */
export async function createSession(
  userId: string,
  filter: QuizFilter,
  rand: () => number = Math.random,
): Promise<{ sessionId: string } | { empty: true }> {
  const rows = await Question.find(await deckQuery(userId, filter), { _id: 1 }).sort({ _id: 1 }).lean<{ _id: Id }[]>();
  const deck = shuffle(rows.map((row) => row._id), rand);
  const questionIds = filter.size ? deck.slice(0, filter.size) : deck;
  if (!questionIds.length) return { empty: true };

  // Store the filter as applied, so labels never show parts or books that were ignored.
  const topic = Boolean(filter.questionIds);
  const session = await QuizSession.create({
    userId,
    filter: {
      bookIds: topic ? [] : validIds(filter.bookIds),
      partKeys: !topic && filter.bookIds.length === 1 ? filter.partKeys : [],
      mode: filter.mode,
      questionIds: topic ? validIds(filter.questionIds!) : undefined,
    },
    questionIds,
    cursor: 0,
    results: [],
  });
  return { sessionId: String(session._id) };
}

async function loadOwned(userId: string, sessionId: string): Promise<SessionRow | null> {
  if (!isValidObjectId(sessionId) || !isValidObjectId(userId)) return null;
  return QuizSession.findOne({ _id: sessionId, userId }).lean<SessionRow>();
}

const isDone = (s: SessionRow) => Boolean(s.finishedAt) || s.cursor >= s.questionIds.length;

/**
 * Moves the cursor past cards that are no longer visible (no result recorded), finishing the
 * session when that reaches the end. The write is conditional on the cursor it read; if another
 * request moved it first, re-read and try again (the cursor only grows, so this terminates).
 */
async function skipHidden(start: SessionRow): Promise<SessionRow> {
  let session = start;
  while (!isDone(session)) {
    const rest = session.questionIds.slice(session.cursor);
    const visible = await Question.find({ ...(await visibleQuestionFilter()), _id: { $in: rest } }, { _id: 1 }).lean<
      { _id: Id }[]
    >();
    const shown = new Set(visible.map((row) => String(row._id)));
    let cursor = session.cursor;
    while (cursor < session.questionIds.length && !shown.has(String(session.questionIds[cursor]))) cursor++;
    if (cursor === session.cursor) return session;

    const set = { cursor, ...(cursor >= session.questionIds.length ? { finishedAt: new Date() } : {}) };
    const moved = await QuizSession.updateOne({ _id: session._id, cursor: session.cursor }, { $set: set });
    if (moved.matchedCount) return { ...session, ...set };
    const fresh = await QuizSession.findById(session._id).lean<SessionRow>();
    if (!fresh) return session;
    session = fresh;
  }
  return session;
}

/** The last result per unique question. */
function countResults(results: SessionRow["results"]): SessionView["counts"] {
  const last = new Map(results.map((r) => [String(r.questionId), r.result]));
  const counts = { got: 0, review: 0, skip: 0 };
  for (const result of last.values()) counts[result]++;
  return counts;
}

async function cardView(questionId: Id): Promise<SessionView["current"]> {
  const q = await Question.findById(questionId).lean<{
    _id: Id;
    bookId: Id;
    partKey: string;
    question: string;
    prompt?: string;
    answer: string;
  }>();
  if (!q) return null;
  const book = await QuestionBook.findById(q.bookId, { slug: 1, title: 1, parts: 1 }).lean<BookRow>();
  const node = await GraphNode.findOne(
    { ...(await visibleNodeFilter()), "related.questionIds": q._id },
    { graphId: 1, slug: 1, title: 1 },
  )
    .sort({ order: 1, _id: 1 })
    .lean<{ graphId: Id; slug: string; title: string }>();
  const graph = node ? await Graph.findById(node.graphId, { slug: 1 }).lean<{ slug: string }>() : null;

  return {
    id: String(q._id),
    question: q.question,
    prompt: q.prompt ?? "",
    answer: q.answer,
    bookSlug: book?.slug ?? "",
    bookTitle: book?.title ?? "",
    partTitle: book?.parts.find((p) => p.key === q.partKey)?.title ?? "",
    ...(node && graph ? { topic: { graphSlug: graph.slug, nodeSlug: node.slug, title: node.title } } : {}),
  };
}

async function buildView(session: SessionRow): Promise<SessionView> {
  const total = session.questionIds.length;
  const done = isDone(session);
  return {
    sessionId: String(session._id),
    position: Math.min(session.cursor, total),
    total,
    done,
    counts: countResults(session.results),
    current: done ? null : await cardView(session.questionIds[session.cursor]),
  };
}

/** The session as the quiz page shows it, or null when it isn't the user's. */
export async function getSessionView(userId: string, sessionId: string): Promise<SessionView | null> {
  const session = await loadOwned(userId, sessionId);
  return session && buildView(await skipHidden(session));
}

/**
 * Applies a mark to the current card. A mark for any other card, or on a finished session, is a
 * no-op returning the current view, so double submits and stale tabs are harmless: the session
 * write is conditional on the cursor it read, and progress is updated only when that write won.
 */
export async function recordResult(
  userId: string,
  sessionId: string,
  questionId: string,
  result: MarkResult,
  rand: () => number = Math.random,
): Promise<SessionView> {
  const loaded = await loadOwned(userId, sessionId);
  if (!loaded) throw new ForbiddenError("Quiz session not available");
  const session = await skipHidden(loaded);
  const current = session.questionIds[session.cursor];
  if (isDone(session) || String(current) !== questionId) return buildView(session);

  const questionIds = session.questionIds.slice();
  if (result === "review") questionIds.splice(requeueIndex(questionIds.length, session.cursor, rand), 0, current);
  const cursor = session.cursor + 1;
  const set = {
    cursor,
    questionIds,
    ...(cursor >= questionIds.length ? { finishedAt: new Date() } : {}),
  };
  const applied = await QuizSession.updateOne(
    { _id: session._id, userId, cursor: session.cursor, finishedAt: null },
    { $push: { results: { questionId: current, result, at: new Date() } }, $set: set },
  );
  if (applied.matchedCount) await markQuestion(userId, questionId, result);

  const view = await getSessionView(userId, sessionId);
  if (!view) throw new ForbiddenError("Quiz session not available");
  return view;
}

/** Ends a session early (or confirms the end); other users' sessions are left alone. */
export async function finishSession(userId: string, sessionId: string): Promise<void> {
  if (!isValidObjectId(sessionId) || !isValidObjectId(userId)) return;
  await QuizSession.updateOne({ _id: sessionId, userId, finishedAt: null }, { $set: { finishedAt: new Date() } });
}

/** Resumable sessions, newest first. */
export async function listUnfinished(
  userId: string,
): Promise<{ id: string; label: string; position: number; total: number; startedAt: Date }[]> {
  if (!isValidObjectId(userId)) return [];
  const sessions = await QuizSession.find({ userId, finishedAt: null })
    .sort({ startedAt: -1, _id: -1 })
    .lean<SessionRow[]>();
  const labels = await labelSessions(sessions);
  return sessions.map((s, i) => ({
    id: String(s._id),
    label: labels[i],
    position: Math.min(s.cursor, s.questionIds.length),
    total: s.questionIds.length,
    startedAt: s.startedAt,
  }));
}

/** The last result per unique question of a session. */
export const sessionCounts = (session: Pick<SessionRow, "results">) => countResults(session.results);

/** A display label per session ("JavaScript · Hooks", "Mixed", ...), in the same order. */
export async function labelSessions(sessions: Pick<SessionRow, "filter" | "questionIds">[]): Promise<string[]> {
  if (!sessions.length) return [];

  // "All books" and topic decks have no books in the filter; label them by the books in the deck.
  const deckIds = sessions.filter((s) => !s.filter.bookIds.length).flatMap((s) => s.questionIds);
  const deckRows = await Question.find({ _id: { $in: deckIds } }, { bookId: 1 }).lean<{ _id: Id; bookId: Id }[]>();
  const bookOfQuestion = new Map(deckRows.map((q) => [String(q._id), String(q.bookId)]));
  const bookIdsBySession = sessions.map((s) =>
    s.filter.bookIds.length
      ? s.filter.bookIds.map(String)
      : [...new Set(s.questionIds.flatMap((id) => bookOfQuestion.get(String(id)) ?? []))],
  );
  const books = await QuestionBook.find({ _id: { $in: [...new Set(bookIdsBySession.flat())] } }, { title: 1, order: 1, parts: 1 })
    .sort({ order: 1, title: 1 })
    .lean<BookRow[]>();
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const rank = new Map(books.map((b, i) => [String(b._id), i]));

  return sessions.map((s, i) => {
    const ids = s.filter.bookIds.length
      ? bookIdsBySession[i]
      : bookIdsBySession[i].toSorted((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    const sessionBooks = ids.flatMap((id) => bookById.get(id) ?? []);
    const partTitle =
      sessionBooks.length === 1 && s.filter.partKeys.length === 1
        ? sessionBooks[0].parts.find((p) => p.key === s.filter.partKeys[0])?.title
        : undefined;
    return sessionLabel(
      sessionBooks.map((b) => b.title),
      partTitle,
    );
  });
}
