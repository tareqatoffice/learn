import { Types } from "mongoose";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

/** Shared fixtures for the progress tests (not a test file itself). */

export const newUserId = () => String(new Types.ObjectId());

const PARTS = [
  { key: "p1", title: "Part One" },
  { key: "p2", title: "Part Two" },
];

export async function seedBook(slug: string, status = "published") {
  const book = await QuestionBook.create({ slug, title: `${slug} title`, parts: PARTS, status });
  return String(book._id);
}

/** Creates `n` questions in order and returns their ids as strings. */
export async function seedQuestions(bookId: string, n: number, partKey = "p1", status = "published") {
  const docs = await Question.insertMany(
    Array.from({ length: n }, (_, i) => ({
      bookId,
      partKey,
      order: i,
      question: `${partKey} question ${i}`,
      prompt: `prompt ${i}`,
      answer: `answer ${i}`,
      status,
    })),
  );
  return docs.map((d) => String(d._id));
}

export async function seedGraph(slug: string, status = "published") {
  const graph = await Graph.create({ slug, title: `${slug} title`, status });
  return String(graph._id);
}

export async function seedNode(
  graphId: string,
  slug: string,
  opts: { status?: string; questionIds?: string[]; order?: number } = {},
) {
  const node = await GraphNode.create({
    graphId,
    slug,
    trackKey: "t",
    title: `${slug} title`,
    order: opts.order ?? 0,
    related: { questionIds: opts.questionIds ?? [] },
    status: opts.status ?? "published",
  });
  return String(node._id);
}

export async function seedSeries(slug: string, status = "published") {
  const series = await NoteSeries.create({ slug, title: `${slug} title`, status });
  return String(series._id);
}

export async function seedNote(seriesId: string, slug: string, status = "published") {
  const note = await Note.create({ seriesId, slug, title: `${slug} title`, status });
  return String(note._id);
}
