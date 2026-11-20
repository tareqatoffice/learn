import { isValidObjectId, type Types } from "mongoose";
import { type QuestionTopic, topicForQuestion } from "@/features/content/queries/books";
import { visibleQuestionFilter } from "@/features/content/visibility";
import { AI_ANSWER_MAX } from "@/features/ai/lib/ai-limits";
import { ForbiddenError } from "@/features/auth/lib/authz";
import { inTransaction } from "@/lib/db";
import type { QuizAttempt } from "@/lib/quiz-answer";
import { AiConversation, Question, QuestionBook, QuestionProgress, QuizSession } from "@/models";
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
  position: number;
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
    topic?: QuestionTopic;
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

export function requeueIndex(deckLength: number, cursor: number, rand: () => number): number {
  return Math.min(deckLength, cursor + 1 + 4 + Math.floor(rand() * 5));
}

export function sessionLabel(bookTitles: string[], partTitle?: string): string {
  const books = bookTitles.length >= 3 ? "Mixed" : bookTitles.join(" · ");
  return [books, partTitle].filter(Boolean).join(" · ");
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const validIds = (ids: string[]) => ids.filter((id) => isValidObjectId(id));

async function deckQuery(userId: string, filter: QuizFilter) {
  const and: Record<string, unknown>[] = [];
  if (filter.questionIds) {
    and.push(await visibleQuestionFilter(), { _id: { $in: validIds(filter.questionIds) } });
  } else {
    and.push(await visibleQuestionFilter(filter.bookIds.length ? filter.bookIds : undefined));
    if (filter.bookIds.length === 1 && filter.partKeys.length) and.push({ partKey: { $in: filter.partKeys } });
  }
  if (filter.mode !== "all") {
    const progress = filter.mode === "review" ? { userId, status: "review" } : { userId, status: { $ne: null } };
    const seen = await QuestionProgress.distinct("questionId", progress);
    and.push({ _id: filter.mode === "review" ? { $in: seen } : { $nin: seen } });
  }
  return { $and: and };
}

export async function countDeck(userId: string, filter: QuizFilter): Promise<number> {
  return Question.countDocuments(await deckQuery(userId, filter));
}

export async function createSession(
  userId: string,
  filter: QuizFilter,
  rand: () => number = Math.random,
): Promise<{ sessionId: string } | { empty: true }> {
  const rows = await Question.find(await deckQuery(userId, filter), { _id: 1 }).sort({ _id: 1 }).lean<{ _id: Id }[]>();
  let deck = shuffle(rows.map((row) => row._id), rand);
  if (filter.mode === "review" && deck.length) {
    const seen = await QuestionProgress.find({ userId, questionId: { $in: deck } }, { questionId: 1, lastSeenAt: 1 }).lean<
      { questionId: Id; lastSeenAt?: Date }[]
    >();
    const at = new Map(seen.map((p) => [String(p.questionId), p.lastSeenAt?.getTime() ?? 0]));
    deck = deck.slice().sort((a, b) => (at.get(String(a)) ?? 0) - (at.get(String(b)) ?? 0));
  }
  const questionIds = filter.size ? deck.slice(0, filter.size) : deck;
  if (!questionIds.length) return { empty: true };

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
  const topic = await topicForQuestion(q._id);

  return {
    id: String(q._id),
    question: q.question,
    prompt: q.prompt ?? "",
    answer: q.answer,
    bookSlug: book?.slug ?? "",
    bookTitle: book?.title ?? "",
    partTitle: book?.parts.find((p) => p.key === q.partKey)?.title ?? "",
    ...(topic ? { topic } : {}),
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

export async function getSessionView(userId: string, sessionId: string): Promise<SessionView | null> {
  const session = await loadOwned(userId, sessionId);
  return session && buildView(await skipHidden(session));
}

type CoachRow = {
  answer?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  feedback?: { verdict: string; score: number; summary: string; strengths: string[]; missing: string[]; model: string };
};

async function coachSnapshot(userId: string, session: SessionRow, questionId: Id) {
  const since = session.results.at(-1)?.at ?? session.startedAt;
  const row = await AiConversation.findOne(
    { userId, sessionId: session._id, questionId, updatedAt: { $gte: since } },
    { answer: 1, messages: 1, feedback: 1 },
  )
    .sort({ updatedAt: -1, _id: -1 })
    .lean<CoachRow>();
  const answer = row?.answer?.trim() || undefined;
  if (!row || (!row.feedback && !row.messages.length)) return { coach: null, answer };
  return {
    coach: {
      ...(row.feedback ?? {}),
      ...(row.messages.length ? { chat: row.messages.map(({ role, content }) => ({ role, content })) } : {}),
    },
    answer,
  };
}

export async function recordResult(
  userId: string,
  sessionId: string,
  questionId: string,
  result: MarkResult,
  rand: () => number = Math.random,
  attempt?: QuizAttempt,
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
  const { coach, answer: graded } = await coachSnapshot(userId, session, current);
  const typed = attempt?.answer.trim();
  const answer = (typed || graded)?.slice(0, AI_ANSWER_MAX);
  const entry = {
    questionId: current,
    result,
    at: new Date(),
    ...(answer ? { answer, answerMode: typed && attempt ? attempt.mode : "typed" } : {}),
    ...(coach ? { coach } : {}),
  };
  await inTransaction(async (txn) => {
    const applied = await QuizSession.updateOne(
      { _id: session._id, userId, cursor: session.cursor, finishedAt: null },
      { $push: { results: entry }, $set: set },
      { session: txn },
    );
    if (applied.matchedCount) await markQuestion(userId, questionId, result, { session: txn });
  });

  const view = await getSessionView(userId, sessionId);
  if (!view) throw new ForbiddenError("Quiz session not available");
  return view;
}

export async function finishSession(userId: string, sessionId: string): Promise<void> {
  if (!isValidObjectId(sessionId) || !isValidObjectId(userId)) return;
  await QuizSession.updateOne({ _id: sessionId, userId, finishedAt: null }, { $set: { finishedAt: new Date() } });
}

export const quizHistoryFilter = (userId: string | Types.ObjectId) => ({ userId, "results.0": { $exists: true } });

export const SUMMARY_PROJECTION = { "results.answer": 0, "results.coach": 0 };

export const quizDate = (s: { finishedAt?: Date | null; startedAt?: Date; results: { at: Date }[] }): Date =>
  s.finishedAt ?? s.results.at(-1)?.at ?? s.startedAt ?? new Date(0);

export const UNFINISHED_MAX_DAYS = 30;

export async function discardSession(userId: string, sessionId: string): Promise<void> {
  if (!isValidObjectId(sessionId) || !isValidObjectId(userId)) return;
  await QuizSession.deleteOne({ _id: sessionId, userId, finishedAt: null, "results.0": { $exists: false } });
  await QuizSession.updateOne({ _id: sessionId, userId, finishedAt: null }, { $set: { finishedAt: new Date() } });
}

export async function listUnfinished(
  userId: string,
  now: Date = new Date(),
): Promise<{ id: string; label: string; position: number; total: number; startedAt: Date }[]> {
  if (!isValidObjectId(userId)) return [];
  const since = new Date(now.getTime() - UNFINISHED_MAX_DAYS * 86_400_000);
  const sessions = await QuizSession.find({ userId, finishedAt: null, startedAt: { $gte: since } }, SUMMARY_PROJECTION)
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

export const sessionCounts = (session: Pick<SessionRow, "results">) => countResults(session.results);

export async function labelSessions(sessions: Pick<SessionRow, "filter" | "questionIds">[]): Promise<string[]> {
  if (!sessions.length) return [];

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
