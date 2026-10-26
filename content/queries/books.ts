import { isValidObjectId, type Types } from "mongoose";
import { visibleNodeFilter, visibleQuestionFilter } from "@/content/visibility";
import { byOrder } from "@/lib/utils";
import { Graph, GraphNode, Question, QuestionBook, QuestionProgress } from "@/models";

type Id = Types.ObjectId;
type Ordered = { order?: number };
type Part = { key: string; title: string; intro?: string } & Ordered;
type Extra = { key: string; title: string; body?: string } & Ordered;
type BookRow = {
  _id: Id;
  slug: string;
  title: string;
  intro?: string;
  parts: Part[];
  extras: Extra[];
};
type Status = "got" | "review" | null;

/** Visible books, in display order. */
async function visibleBooks(): Promise<BookRow[]> {
  return QuestionBook.find({ status: "published" }).sort({ order: 1, title: 1 }).lean<BookRow[]>();
}

/** Status of the user's progress per question, for the given question ids (got/review only). */
async function statusByQuestion(userId: string, questionIds: Id[]): Promise<Map<string, Status>> {
  if (!isValidObjectId(userId) || !questionIds.length) return new Map();
  const rows = await QuestionProgress.find(
    { userId, questionId: { $in: questionIds }, status: { $in: ["got", "review"] } },
    { questionId: 1, status: 1 },
  ).lean<{ questionId: Id; status: "got" | "review" }[]>();
  return new Map(rows.map((row) => [String(row.questionId), row.status]));
}

/** Visible books with how many of their visible questions the user has mastered or put in the review pile. */
export async function listBooksWithProgress(userId: string): Promise<
  {
    id: string;
    slug: string;
    title: string;
    total: number;
    mastered: number;
    review: number;
    parts: { key: string; title: string }[];
  }[]
> {
  const books = await visibleBooks();
  const questions = await Question.find(await visibleQuestionFilter(), { bookId: 1 }).lean<{ _id: Id; bookId: Id }[]>();
  const status = await statusByQuestion(
    userId,
    questions.map((q) => q._id),
  );

  const stats = new Map<string, { total: number; mastered: number; review: number }>();
  for (const q of questions) {
    const row = stats.get(String(q.bookId)) ?? { total: 0, mastered: 0, review: 0 };
    row.total++;
    const s = status.get(String(q._id));
    if (s === "got") row.mastered++;
    if (s === "review") row.review++;
    stats.set(String(q.bookId), row);
  }

  return books.map((book) => ({
    id: String(book._id),
    slug: book.slug,
    title: book.title,
    ...(stats.get(String(book._id)) ?? { total: 0, mastered: 0, review: 0 }),
    parts: byOrder(book.parts).map((p) => ({ key: p.key, title: p.title })),
  }));
}

/** A visible book with per-part progress and its visible questions in reading order; null when not visible. */
export async function getBookView(
  userId: string,
  slug: string,
): Promise<{
  book: { id: string; slug: string; title: string; intro: string; extras: { key: string; title: string; body: string }[] };
  parts: { key: string; title: string; intro: string; total: number; mastered: number }[];
  questions: { id: string; question: string; partKey: string; status: Status }[];
} | null> {
  const book = await QuestionBook.findOne({ slug, status: "published" }).lean<BookRow>();
  if (!book) return null;

  const rows = await Question.find(await visibleQuestionFilter([String(book._id)]), { question: 1, partKey: 1, order: 1 })
    .lean<{ _id: Id; question: string; partKey: string; order?: number }[]>();
  const status = await statusByQuestion(
    userId,
    rows.map((r) => r._id),
  );

  const parts = byOrder(book.parts);
  const questions = inPartOrder(parts, rows).map((r) => ({
    id: String(r._id),
    question: r.question,
    partKey: r.partKey,
    status: status.get(String(r._id)) ?? null,
  }));

  return {
    book: {
      id: String(book._id),
      slug: book.slug,
      title: book.title,
      intro: book.intro ?? "",
      extras: byOrder(book.extras).map((e) => ({ key: e.key, title: e.title, body: e.body ?? "" })),
    },
    parts: parts.map((p) => {
      const inPart = questions.filter((q) => q.partKey === p.key);
      return {
        key: p.key,
        title: p.title,
        intro: p.intro ?? "",
        total: inPart.length,
        mastered: inPart.filter((q) => q.status === "got").length,
      };
    }),
    questions,
  };
}

/** A neighboring question in reading order, with the section it belongs to. */
export type QuestionStep = {
  id: string;
  question: string;
  partKey: string;
  partTitle: string;
};

/**
 * Reading order: section order, then `order` inside the section, then id.
 * A question whose part is not one of `parts` sorts after every real section.
 */
function inPartOrder<T extends { _id: Id; partKey: string; order?: number }>(parts: { key: string }[], rows: T[]): T[] {
  const rank = new Map(parts.map((part, index) => [part.key, index]));
  return rows.toSorted((a, b) => {
    const byPart = (rank.get(a.partKey) ?? parts.length) - (rank.get(b.partKey) ?? parts.length);
    if (byPart !== 0) return byPart;
    const byOrder = (a.order ?? 0) - (b.order ?? 0);
    if (byOrder !== 0) return byOrder;
    const aId = String(a._id);
    const bId = String(b._id);
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });
}

/**
 * One visible question of the given book, with the first visible graph topic that lists it,
 * the book's sections, and the previous and next question in reading order (crossing into the
 * next section when this one ends). Null when not visible.
 */
export async function getQuestionView(
  bookSlug: string,
  questionId: string,
): Promise<{
  question: { id: string; question: string; prompt: string; answer: string };
  book: { slug: string; title: string };
  part: { key: string; title: string };
  parts: { key: string; title: string; firstQuestionId?: string }[];
  prev?: QuestionStep;
  next?: QuestionStep;
  topic?: QuestionTopic;
} | null> {
  if (!isValidObjectId(questionId)) return null;
  const book = await QuestionBook.findOne(
    { slug: bookSlug, status: "published" },
    { slug: 1, title: 1, parts: 1 },
  ).lean<BookRow>();
  if (!book) return null;

  const q = await Question.findOne(
    { ...(await visibleQuestionFilter([String(book._id)])), _id: questionId },
    { question: 1, prompt: 1, answer: 1, partKey: 1 },
  ).lean<{
    _id: Id;
    question: string;
    prompt?: string;
    answer: string;
    partKey: string;
  }>();
  if (!q) return null;

  const parts = byOrder(book.parts);
  const partKeys = new Set(parts.map((part) => part.key));
  const rows = await Question.find(await visibleQuestionFilter([String(book._id)]), { question: 1, partKey: 1, order: 1 })
    .lean<{ _id: Id; question: string; partKey: string; order?: number }[]>();
  // The book page only lists questions that belong to a section, so prev/next follows that list.
  const ordered = inPartOrder(
    parts,
    rows.filter((row) => partKeys.has(row.partKey)),
  );
  const index = ordered.findIndex((row) => String(row._id) === String(q._id));
  const titles = new Map(parts.map((part) => [part.key, part.title]));
  const partKey = ordered[index]?.partKey ?? q.partKey;

  const firstQuestionId = new Map<string, string>();
  for (const row of ordered) {
    if (!firstQuestionId.has(row.partKey)) firstQuestionId.set(row.partKey, String(row._id));
  }

  const step = (row: (typeof ordered)[number] | undefined): QuestionStep | undefined =>
    row
      ? {
          id: String(row._id),
          question: row.question,
          partKey: row.partKey,
          partTitle: titles.get(row.partKey) ?? "",
        }
      : undefined;
  const prev = index > 0 ? step(ordered[index - 1]) : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? step(ordered[index + 1]) : undefined;
  const topic = await topicForQuestion(q._id);

  return {
    question: { id: String(q._id), question: q.question, prompt: q.prompt ?? "", answer: q.answer },
    book: { slug: book.slug, title: book.title },
    part: { key: partKey, title: titles.get(partKey) ?? "" },
    parts: parts.map((part) => ({
      key: part.key,
      title: part.title,
      ...(firstQuestionId.has(part.key) ? { firstQuestionId: firstQuestionId.get(part.key) } : {}),
    })),
    ...(prev ? { prev } : {}),
    ...(next ? { next } : {}),
    ...(topic ? { topic } : {}),
  };
}

export type QuestionTopic = { graphSlug: string; nodeSlug: string; title: string };

/** The first visible graph topic (by order) that lists the question; undefined when none does. */
export async function topicForQuestion(questionId: Id): Promise<QuestionTopic | undefined> {
  const node = await GraphNode.findOne(
    { ...(await visibleNodeFilter()), "related.questionIds": questionId },
    { graphId: 1, slug: 1, title: 1 },
  )
    .sort({ order: 1, _id: 1 })
    .lean<{ graphId: Id; slug: string; title: string }>();
  const graph = node ? await Graph.findById(node.graphId, { slug: 1 }).lean<{ slug: string }>() : null;
  return node && graph ? { graphSlug: graph.slug, nodeSlug: node.slug, title: node.title } : undefined;
}
