import { isValidObjectId, type Types } from "mongoose";
import { visibleNodeFilter, visibleNoteFilter, visibleQuestionFilter } from "@/content/visibility";
import { byOrder } from "@/lib/utils";
import { Graph, GraphNode, Note, NoteSeries, NodeProgress, Question, QuestionBook } from "@/models";
import { getGraphProgress } from "@/progress/graph";

type Id = Types.ObjectId;
type GraphRow = {
  _id: Id;
  slug: string;
  title: string;
  subtitle?: string;
  footer?: string;
  tracks?: { key: string; name: string; order?: number }[];
};
type NodeRow = {
  _id: Id;
  slug: string;
  trackKey: string;
  title: string;
  prereqIds?: Id[];
  summary?: string;
  points?: string[];
  code?: string;
  pitfall?: string;
  docsUrl?: string;
  related?: { questionIds?: Id[]; notes?: { noteId: Id; anchor?: string }[] };
};

export type RelatedLink = { title: string; href: string };
export type GraphNodeView = {
  id: string;
  slug: string;
  trackKey: string;
  title: string;
  prereqIds: string[];
  summary: string;
  points: string[];
  code: string;
  pitfall: string;
  docsUrl: string;
  related: { questions: (RelatedLink & { id: string })[]; notes: RelatedLink[] };
};
export type GraphView = {
  graph: { id: string; slug: string; title: string; subtitle: string; footer: string; tracks: { key: string; name: string }[] };
  nodes: GraphNodeView[];
  progress: Record<string, "learning" | "done">;
};

const visibleGraphs = () =>
  Graph.find({ status: "published" }, { slug: 1, title: 1 }).sort({ order: 1, title: 1 }).lean<GraphRow[]>();

/** Visible graphs with how many of their visible topics the user has marked done. */
export async function listGraphsWithProgress(
  userId: string,
): Promise<{ slug: string; title: string; done: number; total: number }[]> {
  const graphs = await visibleGraphs();
  const nodes = await GraphNode.find(await visibleNodeFilter(), { graphId: 1 }).lean<{ _id: Id; graphId: Id }[]>();
  const done = isValidObjectId(userId)
    ? await NodeProgress.find({ userId, status: "done", nodeId: { $in: nodes.map((n) => n._id) } }, { nodeId: 1 }).lean<
        { nodeId: Id }[]
      >()
    : [];
  const doneIds = new Set(done.map((d) => String(d.nodeId)));

  return graphs.map((g) => {
    const mine = nodes.filter((n) => String(n.graphId) === String(g._id));
    return {
      slug: g.slug,
      title: g.title,
      done: mine.filter((n) => doneIds.has(String(n._id))).length,
      total: mine.length,
    };
  });
}

/** Visible related questions, keyed by id, with links into their books. */
async function questionLinks(ids: Id[]): Promise<Map<string, RelatedLink & { id: string }>> {
  if (!ids.length) return new Map();
  const rows = await Question.find({ ...(await visibleQuestionFilter()), _id: { $in: ids } }, { question: 1, bookId: 1 }).lean<
    { _id: Id; question: string; bookId: Id }[]
  >();
  const books = await QuestionBook.find({ _id: { $in: rows.map((r) => r.bookId) } }, { slug: 1 }).lean<{ _id: Id; slug: string }[]>();
  const slugOf = new Map(books.map((b) => [String(b._id), b.slug]));
  return new Map(
    rows.map((r) => [
      String(r._id),
      { id: String(r._id), title: r.question, href: `/interview/${slugOf.get(String(r.bookId))}/${r._id}` },
    ]),
  );
}

type NoteLinkRow = { slug: string; title: string; series: string; toc: { anchor: string; text: string }[] };

/** Visible related notes, keyed by id. */
async function noteRows(ids: Id[]): Promise<Map<string, NoteLinkRow>> {
  if (!ids.length) return new Map();
  const notes = await Note.find({ ...(await visibleNoteFilter()), _id: { $in: ids } }, { slug: 1, title: 1, seriesId: 1, toc: 1 }).lean<
    { _id: Id; slug: string; title: string; seriesId: Id; toc?: { anchor: string; text: string }[] }[]
  >();
  const series = await NoteSeries.find({ _id: { $in: notes.map((n) => n.seriesId) } }, { slug: 1 }).lean<{ _id: Id; slug: string }[]>();
  const slugOf = new Map(series.map((s) => [String(s._id), s.slug]));
  return new Map(
    notes.map((n) => [String(n._id), { slug: n.slug, title: n.title, series: slugOf.get(String(n.seriesId)) ?? "", toc: n.toc ?? [] }]),
  );
}

function noteLink(note: NoteLinkRow, anchor: string): RelatedLink {
  const heading = anchor ? note.toc.find((t) => t.anchor === anchor)?.text : undefined;
  return {
    title: heading ? `${note.title} § ${heading}` : note.title,
    href: `/notes/${note.series}/${note.slug}${anchor ? `#${anchor}` : ""}`,
  };
}

/** A visible graph with its visible topics (related links resolved, hidden ones dropped) and the user's progress. */
export async function getGraphView(userId: string, slug: string): Promise<GraphView | null> {
  const graph = await Graph.findOne({ slug, status: "published" }).lean<GraphRow>();
  if (!graph) return null;

  const rows = await GraphNode.find(await visibleNodeFilter(String(graph._id)))
    .sort({ order: 1, _id: 1 })
    .lean<NodeRow[]>();
  const visible = new Set(rows.map((r) => String(r._id)));
  const [questions, notes, progress] = await Promise.all([
    questionLinks(rows.flatMap((r) => r.related?.questionIds ?? [])),
    noteRows(rows.flatMap((r) => (r.related?.notes ?? []).map((n) => n.noteId))),
    getGraphProgress(userId, String(graph._id), rows.map((r) => r._id)),
  ]);

  const nodes = rows.map((r) => ({
    id: String(r._id),
    slug: r.slug,
    trackKey: r.trackKey,
    title: r.title,
    prereqIds: (r.prereqIds ?? []).map(String).filter((id) => visible.has(id)),
    summary: r.summary ?? "",
    points: r.points ?? [],
    code: r.code ?? "",
    pitfall: r.pitfall ?? "",
    docsUrl: r.docsUrl ?? "",
    related: {
      questions: (r.related?.questionIds ?? []).flatMap((id) => questions.get(String(id)) ?? []),
      notes: (r.related?.notes ?? []).flatMap(({ noteId, anchor }) => {
        const note = notes.get(String(noteId));
        return note ? [noteLink(note, anchor ?? "")] : [];
      }),
    },
  }));

  return {
    graph: {
      id: String(graph._id),
      slug: graph.slug,
      title: graph.title,
      subtitle: graph.subtitle ?? "",
      footer: graph.footer ?? "",
      tracks: byOrder(graph.tracks).map(({ key, name }) => ({ key, name })),
    },
    nodes,
    progress,
  };
}
