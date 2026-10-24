import type { Types } from "mongoose";
import { byOrder } from "@/lib/utils";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

// Lossless exports in the canonical formats the parsers read back: every item
// carries its id, so editing a pulled file and importing it updates in place.

type Id = Types.ObjectId;
const block = (text?: string) => (text?.trim() ? [text.trim(), ""] : []);

export class NotFoundError extends Error {}

/** A question book (every status) as canonical markdown. */
export async function pullBook(slug: string): Promise<{ fileName: string; content: string }> {
  const book = await QuestionBook.findOne({ slug }).lean<{
    _id: Id;
    title: string;
    intro?: string;
    parts?: { key: string; title: string; intro?: string; order?: number }[];
    extras?: { key: string; title: string; body?: string; order?: number }[];
  }>();
  if (!book) throw new NotFoundError(`book ${slug} not found`);
  const questions = await Question.find({ bookId: book._id })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; partKey: string; question: string; prompt?: string; answer: string }[]>();

  const lines = [`<!-- learn:book id=${book._id} -->`, `# ${book.title}`, "", ...block(book.intro)];
  let n = 0;
  for (const part of byOrder(book.parts)) {
    lines.push(`<!-- learn:part key=${part.key} -->`, `# ${part.title}`, "", ...block(part.intro));
    for (const q of questions.filter((x) => x.partKey === part.key)) {
      n += 1;
      lines.push(`<!-- learn:question id=${q._id} -->`, `## Q${n}. ${q.question}`, "", ...block(q.prompt), "<!-- learn:answer -->", "", ...block(q.answer));
    }
  }
  for (const extra of byOrder(book.extras)) {
    lines.push(`<!-- learn:extra key=${extra.key} -->`, `## ${extra.title}`, "", ...block(extra.body));
  }
  return { fileName: `${slug}.md`, content: `${lines.join("\n").trimEnd()}\n` };
}

/** A note series (every status) as one canonical file per chapter, named by order. */
export async function pullSeries(slug: string): Promise<{ files: { name: string; content: string }[] }> {
  const series = await NoteSeries.findOne({ slug }, { _id: 1 }).lean<{ _id: Id }>();
  if (!series) throw new NotFoundError(`series ${slug} not found`);
  const notes = await Note.find({ seriesId: series._id })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; body?: string }[]>();
  const width = Math.max(2, String(notes.length).length);
  return {
    files: notes.map((note, i) => ({
      name: `${String(i + 1).padStart(width, "0")}-${note.slug}.md`,
      content: `${[`<!-- learn:note id=${note._id} slug=${note.slug} -->`, `# ${note.title}`, "", ...block(note.body)].join("\n").trimEnd()}\n`,
    })),
  };
}

/** A graph (every status) in the legacy data shape, with `_id` on the graph and on each topic. */
export async function pullGraph(slug: string): Promise<{ fileName: string; json: object }> {
  const graph = await Graph.findOne({ slug }).lean<{
    _id: Id;
    title: string;
    subtitle?: string;
    footer?: string;
    tracks?: { key: string; name: string; order?: number }[];
  }>();
  if (!graph) throw new NotFoundError(`graph ${slug} not found`);
  const nodes = await GraphNode.find({ graphId: graph._id })
    .sort({ order: 1, _id: 1 })
    .lean<
      {
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
      }[]
    >();
  const slugOf = new Map(nodes.map((n) => [String(n._id), n.slug]));
  return {
    fileName: `${slug}.json`,
    json: {
      _id: String(graph._id),
      title: graph.title,
      sub: graph.subtitle ?? "",
      foot: graph.footer ?? "",
      tracks: byOrder(graph.tracks).map((t) => ({ k: t.key, n: t.name })),
      nodes: nodes.map((n) => ({
        _id: String(n._id),
        id: n.slug,
        tr: n.trackKey,
        t: n.title,
        pre: (n.prereqIds ?? []).flatMap((p) => slugOf.get(String(p)) ?? []),
        s: n.summary ?? "",
        p: n.points ?? [],
        c: n.code ?? "",
        pit: n.pitfall ?? "",
        u: n.docsUrl ?? "",
      })),
    },
  };
}
