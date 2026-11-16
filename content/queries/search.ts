import type { Types } from "mongoose";
import { visibleBookIds, visibleGraphIds, visibleNodeFilter, visibleNoteFilter, visibleQuestionFilter, visibleSeriesIds } from "@/content/visibility";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

type Id = Types.ObjectId;

export type SearchHit = {
  kind: "book" | "graph" | "series" | "question" | "topic" | "chapter";
  title: string;
  context: string;
  href: string;
};

const PER_KIND = 6;
const CANDIDATES = PER_KIND * 5;
export const SEARCH_MIN = 2;

function plain(md: string): string {
  return md
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function term(input: string): RegExp {
  return new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function parents<T extends { _id: Id }>(
  model: { find: (f: object, p: object) => { lean: <R>() => Promise<R> } },
  ids: Id[],
): Promise<Map<string, T>> {
  if (!ids.length) return new Map();
  const rows = await model.find({ _id: { $in: ids } }, { slug: 1, title: 1 }).lean<T[]>();
  return new Map(rows.map((row) => [String(row._id), row]));
}

type Parent = { _id: Id; slug: string; title: string };

export async function searchContent(input: string): Promise<SearchHit[]> {
  const query = input.trim();
  if (query.length < SEARCH_MIN) return [];
  const match = term(query);
  const lower = query.toLowerCase();
  const startsFirst = <T>(rows: T[], text: (row: T) => string): T[] =>
    rows
      .map((row, i) => ({ row, i, rank: text(row).toLowerCase().startsWith(lower) ? 0 : 1 }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .slice(0, PER_KIND)
      .map((x) => x.row);

  const [bookRows, graphRows, seriesRows, questionRows, nodeRows, noteRows] = await Promise.all([
    QuestionBook.find({ _id: { $in: await visibleBookIds() }, title: match }, { title: 1, slug: 1 }).limit(CANDIDATES).lean<Parent[]>(),
    Graph.find({ _id: { $in: await visibleGraphIds() }, title: match }, { title: 1, slug: 1 }).limit(CANDIDATES).lean<Parent[]>(),
    NoteSeries.find({ _id: { $in: await visibleSeriesIds() }, title: match }, { title: 1, slug: 1 }).limit(CANDIDATES).lean<Parent[]>(),
    Question.find({ ...(await visibleQuestionFilter()), question: match }, { question: 1, bookId: 1 })
      .limit(CANDIDATES)
      .lean<{ _id: Id; question: string; bookId: Id }[]>(),
    GraphNode.find({ ...(await visibleNodeFilter()), title: match }, { title: 1, slug: 1, graphId: 1 })
      .limit(CANDIDATES)
      .lean<{ _id: Id; title: string; slug: string; graphId: Id }[]>(),
    Note.find({ ...(await visibleNoteFilter()), title: match }, { title: 1, slug: 1, seriesId: 1 })
      .limit(CANDIDATES)
      .lean<{ _id: Id; title: string; slug: string; seriesId: Id }[]>(),
  ]);
  const questions = startsFirst(questionRows, (q) => plain(q.question));
  const nodes = startsFirst(nodeRows, (n) => n.title);
  const notes = startsFirst(noteRows, (n) => n.title);

  const [books, graphs, series] = await Promise.all([
    parents<Parent>(QuestionBook, questions.map((q) => q.bookId)),
    parents<Parent>(Graph, nodes.map((n) => n.graphId)),
    parents<Parent>(NoteSeries, notes.map((n) => n.seriesId)),
  ]);

  const hits: SearchHit[] = [
    ...startsFirst(bookRows, (b) => b.title).map<SearchHit>((b) => ({ kind: "book", title: b.title, context: "Question book", href: `/interview/${b.slug}` })),
    ...startsFirst(graphRows, (g) => g.title).map<SearchHit>((g) => ({ kind: "graph", title: g.title, context: "Graph", href: `/graphs/${g.slug}` })),
    ...startsFirst(seriesRows, (s) => s.title).map<SearchHit>((s) => ({ kind: "series", title: s.title, context: "Note series", href: `/notes/${s.slug}` })),
    ...questions.flatMap<SearchHit>((q) => {
      const book = books.get(String(q.bookId));
      return book
        ? [{ kind: "question", title: plain(q.question), context: book.title, href: `/interview/${book.slug}/${String(q._id)}` }]
        : [];
    }),
    ...nodes.flatMap<SearchHit>((n) => {
      const graph = graphs.get(String(n.graphId));
      return graph
        ? [
            {
              kind: "topic",
              title: n.title,
              context: graph.title,
              href: `/graphs/${graph.slug}?topic=${encodeURIComponent(n.slug)}`,
            },
          ]
        : [];
    }),
    ...notes.flatMap<SearchHit>((n) => {
      const parent = series.get(String(n.seriesId));
      return parent
        ? [{ kind: "chapter", title: n.title, context: parent.title, href: `/notes/${parent.slug}/${n.slug}` }]
        : [];
    }),
  ];

  const starts = (hit: SearchHit) => (hit.title.toLowerCase().startsWith(lower) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b));
}
