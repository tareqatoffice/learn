import { isValidObjectId, type Types } from "mongoose";
import { Graph, GraphNode, Question, QuestionBook, Subject, type Status } from "@/models";

// Admin reads: every status, unlike the user-facing queries.

type Id = Types.ObjectId;

export async function listSubjects(): Promise<{ slug: string; name: string }[]> {
  return (await Subject.find({}, { slug: 1, name: 1 }).sort({ order: 1, name: 1 }).lean<{ slug: string; name: string }[]>()).map(
    ({ slug, name }) => ({ slug, name }),
  );
}

export async function listBooksAdmin(): Promise<{ id: string; slug: string; title: string; status: Status; questions: number }[]> {
  const books = await QuestionBook.find({}, { slug: 1, title: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; status: Status }[]>();
  const counts = await Question.aggregate<{ _id: Id; n: number }>([{ $group: { _id: "$bookId", n: { $sum: 1 } } }]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
  return books.map((b) => ({ id: String(b._id), slug: b.slug, title: b.title, status: b.status, questions: countOf.get(String(b._id)) ?? 0 }));
}

export type AdminBook = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  subjects: string[];
  status: Status;
  parts: { key: string; title: string; intro: string }[];
  extras: { key: string; title: string; body: string }[];
};

export async function getBookAdmin(id: string): Promise<{
  book: AdminBook;
  questions: { id: string; question: string; partKey: string; status: Status }[];
} | null> {
  if (!isValidObjectId(id)) return null;
  const book = await QuestionBook.findById(id).lean<{
    _id: Id;
    slug: string;
    title: string;
    intro?: string;
    subjects?: string[];
    status: Status;
    parts?: { key: string; title: string; intro?: string; order?: number }[];
    extras?: { key: string; title: string; body?: string; order?: number }[];
  }>();
  if (!book) return null;
  const byOrder = <T extends { order?: number }>(xs: T[] = []) => xs.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const questions = await Question.find({ bookId: book._id }, { question: 1, partKey: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; question: string; partKey: string; status: Status }[]>();
  return {
    book: {
      id: String(book._id),
      slug: book.slug,
      title: book.title,
      intro: book.intro ?? "",
      subjects: book.subjects ?? [],
      status: book.status,
      parts: byOrder(book.parts).map((p) => ({ key: p.key, title: p.title, intro: p.intro ?? "" })),
      extras: byOrder(book.extras).map((e) => ({ key: e.key, title: e.title, body: e.body ?? "" })),
    },
    questions: questions.map((q) => ({ id: String(q._id), question: q.question, partKey: q.partKey, status: q.status })),
  };
}

export type AdminQuestion = {
  id: string;
  bookId: string;
  partKey: string;
  question: string;
  prompt: string;
  answer: string;
  subjects: string[];
  status: Status;
};

export async function getQuestionAdmin(id: string): Promise<{
  question: AdminQuestion;
  topics: { id: string; title: string; graphTitle: string }[];
} | null> {
  if (!isValidObjectId(id)) return null;
  const q = await Question.findById(id).lean<{
    _id: Id;
    bookId: Id;
    partKey: string;
    question: string;
    prompt?: string;
    answer: string;
    subjects?: string[];
    status: Status;
  }>();
  if (!q) return null;
  const nodes = await GraphNode.find({ "related.questionIds": q._id }, { title: 1, graphId: 1 }).lean<{ _id: Id; title: string; graphId: Id }[]>();
  const graphs = await Graph.find({ _id: { $in: nodes.map((n) => n.graphId) } }, { title: 1 }).lean<{ _id: Id; title: string }[]>();
  const titleOf = new Map(graphs.map((g) => [String(g._id), g.title]));
  return {
    question: {
      id: String(q._id),
      bookId: String(q.bookId),
      partKey: q.partKey,
      question: q.question,
      prompt: q.prompt ?? "",
      answer: q.answer,
      subjects: q.subjects ?? [],
      status: q.status,
    },
    topics: nodes.map((n) => ({ id: String(n._id), title: n.title, graphTitle: titleOf.get(String(n.graphId)) ?? "" })),
  };
}
