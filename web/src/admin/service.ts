import mongoose, { isValidObjectId, type Model, type Types } from "mongoose";
import { z } from "zod";
import { saveWithRevision } from "@/content/revisions";
import { importKey } from "@/lib/ids";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, STATUSES, Subject, type Status } from "@/models";

// Admin write operations. Every function validates its input, writes through
// saveWithRevision (so edits keep history) and never deletes content.

export type Result = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

type Id = Types.ObjectId;
const fail = (errors: Record<string, string>): Result => ({ ok: false, errors });
const done = (id: unknown): Result => ({ ok: true, id: String(id) });

const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes");
const text = (label: string) => z.string().trim().min(1, `${label} is required`);
const objectId = z.string().refine((v) => isValidObjectId(v), "Invalid id");
const status = z.enum(STATUSES);
const subjects = z.array(slug).max(50);

/** zod issues → { field: message } using the first path segment. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

async function nextOrder(model: Model<unknown>, filter: Record<string, unknown> = {}): Promise<number> {
  const [last] = await model.find(filter, { order: 1 }).sort({ order: -1 }).limit(1).lean<{ order?: number }[]>();
  return last ? (last.order ?? 0) + 1 : 0;
}

async function slugTaken(model: Model<unknown>, value: string, id?: string, scope: Record<string, unknown> = {}): Promise<boolean> {
  return !!(await model.exists({ ...scope, slug: value, ...(id ? { _id: { $ne: id } } : {}) }));
}

// ---------- books ----------

const bookSchema = z.object({
  id: objectId.optional(),
  slug,
  title: text("Title"),
  intro: z.string(),
  subjects,
  parts: z.array(z.object({ key: slug, title: text("Part title"), intro: z.string().optional() })).max(100),
  extras: z.array(z.object({ key: slug, title: text("Extra title"), body: z.string() })).max(100),
  status,
});
export type BookInput = z.input<typeof bookSchema>;

export async function saveBook(input: BookInput, editedBy: string): Promise<Result> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, parts, extras, ...rest } = parsed.data;
  if (new Set(parts.map((p) => p.key)).size !== parts.length) return fail({ parts: "Part keys must be unique" });
  if (new Set(extras.map((e) => e.key)).size !== extras.length) return fail({ extras: "Extra keys must be unique" });
  if (await slugTaken(QuestionBook, rest.slug, id)) return fail({ slug: "Another book already uses this slug" });

  const data = {
    ...rest,
    parts: parts.map((p, order) => ({ key: p.key, title: p.title, intro: p.intro ?? "", order })),
    extras: extras.map((e, order) => ({ ...e, order })),
  };
  if (id) {
    if (!(await QuestionBook.exists({ _id: id }))) return fail({ id: "Book not found" });
    return done((await saveWithRevision(QuestionBook, id, data, editedBy))._id);
  }
  return done((await saveWithRevision(QuestionBook, null, { ...data, order: await nextOrder(QuestionBook) }, editedBy))._id);
}

// ---------- questions ----------

const questionSchema = z.object({
  id: objectId.optional(),
  bookId: objectId,
  partKey: text("Part"),
  question: text("Question"),
  prompt: z.string(),
  answer: text("Answer"),
  subjects,
  status,
});
export type QuestionInput = z.input<typeof questionSchema>;

/** importKey for a new question, suffixed like collect.js when the text already exists. */
async function freshImportKey(bookSlug: string, question: string, prompt: string): Promise<string> {
  const base = importKey(bookSlug, question, prompt);
  let key = base;
  for (let n = 2; await Question.exists({ importKey: key }); n++) key = `${base}-${n}`;
  return key;
}

export async function saveQuestion(input: QuestionInput, editedBy: string): Promise<Result> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, ...data } = parsed.data;
  const book = await QuestionBook.findById(data.bookId, { slug: 1, parts: 1 }).lean<{ slug: string; parts: { key: string }[] }>();
  if (!book) return fail({ bookId: "Book not found" });
  if (!book.parts.some((p) => p.key === data.partKey)) return fail({ partKey: "Pick one of the book's parts" });

  if (id) {
    if (!(await Question.exists({ _id: id }))) return fail({ id: "Question not found" });
    return done((await saveWithRevision(Question, id, data, editedBy))._id);
  }
  const created = await saveWithRevision(
    Question,
    null,
    {
      ...data,
      order: await nextOrder(Question, { bookId: data.bookId }),
      importKey: await freshImportKey(book.slug, data.question, data.prompt),
    },
    editedBy,
  );
  return done(created._id);
}

// ---------- shared: ordering and status ----------

export type OrderedKind = "book" | "question" | "graph" | "node" | "series" | "note" | "subject";
export type StatusKind = Exclude<OrderedKind, "subject">;

const KINDS: Record<OrderedKind, { model: Model<unknown>; parent: string | null }> = {
  book: { model: QuestionBook, parent: null },
  question: { model: Question, parent: "bookId" },
  graph: { model: Graph, parent: null },
  node: { model: GraphNode, parent: "graphId" },
  series: { model: NoteSeries, parent: null },
  note: { model: Note, parent: "seriesId" },
  subject: { model: Subject, parent: null },
};

/** Swaps the item with its neighbour among siblings (same parent), renumbering siblings 0..n-1. */
export async function moveItem(kind: OrderedKind, id: string, dir: "up" | "down", editedBy: string): Promise<Result> {
  const spec = Object.hasOwn(KINDS, kind) ? KINDS[kind] : undefined;
  if (!spec || !isValidObjectId(id) || (dir !== "up" && dir !== "down")) return fail({ _: "Invalid move" });
  const item = await spec.model.findById(id).lean<Record<string, unknown> & { _id: Id }>();
  if (!item) return fail({ id: "Not found" });

  const siblings = await spec.model
    .find(spec.parent ? { [spec.parent]: item[spec.parent] } : {}, { order: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; order?: number }[]>();
  const at = siblings.findIndex((s) => String(s._id) === id);
  const to = dir === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= siblings.length) return fail({ _: dir === "up" ? "Already first" : "Already last" });

  const next = siblings.slice();
  [next[at], next[to]] = [next[to], next[at]];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [order, s] of next.entries()) {
        if (s.order !== order) await saveWithRevision(spec.model, String(s._id), { order }, editedBy, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return done(id);
}

export async function setStatus(kind: StatusKind, id: string, value: Status, editedBy: string): Promise<Result> {
  const spec = kind !== ("subject" as OrderedKind) && Object.hasOwn(KINDS, kind) ? KINDS[kind] : undefined;
  const parsed = status.safeParse(value);
  if (!spec || !isValidObjectId(id) || !parsed.success) return fail({ status: "Invalid status change" });
  if (!(await spec.model.exists({ _id: id }))) return fail({ id: "Not found" });
  return done((await saveWithRevision(spec.model, id, { status: parsed.data }, editedBy))._id);
}

// ---------- links ----------

/** Adds or removes the question in the topic's related questions (one stored link, edited from either side). */
export async function setQuestionTopicLink(questionId: string, nodeId: string, linked: boolean, editedBy: string): Promise<Result> {
  if (!isValidObjectId(questionId) || !isValidObjectId(nodeId)) return fail({ _: "Invalid id" });
  if (!(await Question.exists({ _id: questionId }))) return fail({ questionId: "Question not found" });
  const node = await GraphNode.findById(nodeId, { related: 1 }).lean<{ related?: { questionIds?: Id[] } }>();
  if (!node) return fail({ nodeId: "Topic not found" });

  const current = (node.related?.questionIds ?? []).map(String);
  if (current.includes(questionId) === linked) return done(nodeId);
  const next = linked ? [...current, questionId] : current.filter((q) => q !== questionId);
  return done((await saveWithRevision(GraphNode, nodeId, { "related.questionIds": next } as never, editedBy))._id);
}

/** Topics whose title matches, limited to the given subjects when any; for the "link topic" picker. */
export async function searchTopics(
  query: string,
  subjectSlugs: string[],
): Promise<{ id: string; title: string; graphTitle: string }[]> {
  const term = query.trim();
  const pattern = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const nodes = await GraphNode.find(
    { ...(pattern ? { title: pattern } : {}), ...(subjectSlugs.length ? { subjects: { $in: subjectSlugs } } : {}) },
    { title: 1, graphId: 1 },
  )
    .sort({ order: 1 })
    .limit(20)
    .lean<{ _id: Id; title: string; graphId: Id }[]>();
  const graphs = await Graph.find({ _id: { $in: nodes.map((n) => n.graphId) } }, { title: 1 }).lean<{ _id: Id; title: string }[]>();
  const titleOf = new Map(graphs.map((g) => [String(g._id), g.title]));
  return nodes.map((n) => ({ id: String(n._id), title: n.title, graphTitle: titleOf.get(String(n.graphId)) ?? "" }));
}
