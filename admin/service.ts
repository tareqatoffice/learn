import mongoose, { isValidObjectId, Types, type ClientSession, type Model } from "mongoose";
import { z } from "zod";
import { findCycle } from "@/content/cycles";
import { validateNode } from "@/content/parse/graph";
import { restoreRevision, saveWithRevision } from "@/content/revisions";
import { inTransaction } from "@/lib/db";
import { importKey, SLUG_PATTERN } from "@/lib/ids";
import { extractToc, readMinutes } from "@/lib/markdown/toc";
import { escapeRegex } from "@/lib/utils";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Revision, STATUSES, Subject, type Status } from "@/models";

// Admin write operations. Every function validates its input, writes through
// saveWithRevision (so edits keep history) and never deletes content.

export type Result = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

type Id = Types.ObjectId;
const fail = (errors: Record<string, string>): Result => ({ ok: false, errors });
const done = (id: unknown): Result => ({ ok: true, id: String(id) });

const slug = z.string().trim().regex(SLUG_PATTERN, "Use lowercase letters, digits and dashes");
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

/**
 * Labels of the parent's current parts/tracks that the edit drops while children (any status)
 * still point at them, e.g. "Part Two (2)"; empty when nothing would be orphaned.
 */
async function removedKeysInUse(
  parentModel: Model<unknown>,
  parentId: string,
  listField: "parts" | "tracks",
  labelField: "title" | "name",
  next: { key: string }[],
  childModel: Model<unknown>,
  childScope: Record<string, unknown>,
  childKeyField: string,
): Promise<string> {
  const parent = await parentModel.findById(parentId, { [listField]: 1 }).lean<Record<string, { key: string; title?: string; name?: string }[]>>();
  const keep = new Set(next.map((x) => x.key));
  const dropped = (parent?.[listField] ?? []).filter((x) => !keep.has(x.key));
  const used: string[] = [];
  for (const item of dropped) {
    const n = await childModel.countDocuments({ ...childScope, [childKeyField]: item.key });
    if (n) used.push(`${item[labelField] ?? item.key} (${n})`);
  }
  return used.join(", ");
}

/** Content that lists subjects by slug. */
const SUBJECT_HOLDERS: Model<unknown>[] = [QuestionBook, Question, Graph, GraphNode, NoteSeries, Note];

/**
 * Keeps slug-keyed references in step with a subject or book whose slug changed: content lists its
 * subjects by slug, and question importKeys (what a legacy re-import matches on) start with the book slug.
 */
async function followSlugChange(entityType: string, id: string, from: string, to: string, session: ClientSession): Promise<void> {
  if (from === to) return;
  if (entityType === "Subject") {
    for (const model of SUBJECT_HOLDERS) {
      await model.updateMany({ subjects: from }, { $addToSet: { subjects: to } }, { session });
      await model.updateMany({ subjects: from }, { $pull: { subjects: from } }, { session });
    }
  } else if (entityType === "QuestionBook") {
    const prefix = `${from}-`;
    const rows = await Question.find({ bookId: id, importKey: new RegExp(`^${escapeRegex(prefix)}`) }, { importKey: 1 })
      .session(session)
      .lean<{ _id: Id; importKey: string }[]>();
    if (!rows.length) return;
    await Question.bulkWrite(
      rows.map((r) => ({
        updateOne: { filter: { _id: r._id }, update: { $set: { importKey: `${to}-${r.importKey.slice(prefix.length)}` } } },
      })),
      { session },
    );
  }
}

/** Updates an existing subject or book and, in the same transaction, follows its slug change. */
async function updateFollowingSlug(model: Model<unknown>, id: string, data: { slug: string }, editedBy: string): Promise<unknown> {
  return inTransaction(async (session) => {
    const before = await model.findById(id, { slug: 1 }, { session }).lean<{ slug: string }>();
    const saved = await saveWithRevision(model, id, data, editedBy, { session });
    if (before) await followSlugChange(model.modelName, id, before.slug, data.slug, session);
    return saved._id;
  });
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
  if (id) {
    const stillUsed = await removedKeysInUse(QuestionBook, id, "parts", "title", parts, Question, { bookId: id }, "partKey");
    if (stillUsed) return fail({ parts: `Move its questions out first: ${stillUsed}` });
  }

  const data = {
    ...rest,
    parts: parts.map((p, order) => ({ key: p.key, title: p.title, intro: p.intro ?? "", order })),
    extras: extras.map((e, order) => ({ ...e, order })),
  };
  if (id) {
    if (!(await QuestionBook.exists({ _id: id }))) return fail({ id: "Book not found" });
    return done(await updateFollowingSlug(QuestionBook, id, data, editedBy));
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

/**
 * Swaps the item with its neighbour among siblings (same parent). When sibling orders are already
 * distinct only the two `order` values swap; ties or missing orders renumber siblings 0..n-1.
 */
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

  const orders = siblings.map((s) => s.order);
  const distinct = orders.every((o, i) => typeof o === "number" && (i === 0 || o > orders[i - 1]!));
  const next = siblings.slice();
  [next[at], next[to]] = [next[to], next[at]];
  // Positions keep their order values; only the items in them move.
  const writes = next
    .map((s, i) => ({ id: String(s._id), order: distinct ? orders[i]! : i, current: s.order }))
    .filter((w) => w.order !== w.current);
  await inTransaction(async (session) => {
    for (const w of writes) await saveWithRevision(spec.model, w.id, { order: w.order }, editedBy, { session });
  });
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

/** Adds or removes a link from the topic to a note (whole chapter when anchor is '', else one of its headings). */
export async function setNodeNoteLink(nodeId: string, noteId: string, anchor: string, linked: boolean, editedBy: string): Promise<Result> {
  if (!isValidObjectId(nodeId) || !isValidObjectId(noteId) || typeof anchor !== "string") return fail({ _: "Invalid link" });
  const note = await Note.findById(noteId, { toc: 1 }).lean<{ toc?: { anchor: string }[] }>();
  if (!note) return fail({ noteId: "Chapter not found" });
  if (anchor && !(note.toc ?? []).some((t) => t.anchor === anchor)) return fail({ anchor: "That heading is not in the chapter" });
  const node = await GraphNode.findById(nodeId, { related: 1 }).lean<{ related?: { notes?: { noteId: Id; anchor?: string }[] } }>();
  if (!node) return fail({ nodeId: "Topic not found" });

  const current = (node.related?.notes ?? []).map((n) => ({ noteId: n.noteId, anchor: n.anchor ?? "" }));
  const same = (n: { noteId: Id; anchor: string }) => String(n.noteId) === noteId && n.anchor === anchor;
  if (current.some(same) === linked) return done(nodeId);
  const next = linked ? [...current, { noteId: new Types.ObjectId(noteId), anchor }] : current.filter((n) => !same(n));
  return done((await saveWithRevision(GraphNode, nodeId, { "related.notes": next } as never, editedBy))._id);
}

// ---------- graphs and topics ----------

const graphSchema = z.object({
  id: objectId.optional(),
  slug,
  title: text("Title"),
  subtitle: z.string(),
  footer: z.string(),
  subjects,
  tracks: z
    .array(z.object({ key: slug, name: text("Track name") }))
    .min(2, "A graph needs 2 to 6 tracks")
    .max(6, "A graph needs 2 to 6 tracks"),
  status,
});
export type GraphInput = z.input<typeof graphSchema>;

export async function saveGraph(input: GraphInput, editedBy: string): Promise<Result> {
  const parsed = graphSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, tracks, ...rest } = parsed.data;
  if (new Set(tracks.map((t) => t.key)).size !== tracks.length) return fail({ tracks: "Track keys must be unique" });
  if (await slugTaken(Graph, rest.slug, id)) return fail({ slug: "Another graph already uses this slug" });
  if (id) {
    const stillUsed = await removedKeysInUse(Graph, id, "tracks", "name", tracks, GraphNode, { graphId: id }, "trackKey");
    if (stillUsed) return fail({ tracks: `Move its topics to another track first: ${stillUsed}` });
  }
  const data = { ...rest, tracks: tracks.map((t, order) => ({ ...t, order })) };
  if (id) {
    if (!(await Graph.exists({ _id: id }))) return fail({ id: "Graph not found" });
    return done((await saveWithRevision(Graph, id, data, editedBy))._id);
  }
  return done((await saveWithRevision(Graph, null, { ...data, order: await nextOrder(Graph) }, editedBy))._id);
}

const nodeSchema = z.object({
  id: objectId.optional(),
  graphId: objectId,
  slug,
  trackKey: z.string(),
  title: z.string().trim(),
  prereqIds: z.array(objectId).max(50),
  summary: z.string(),
  // One point per line in the editor; blank lines carry no meaning.
  points: z
    .array(z.string())
    .transform((ps) => ps.map((p) => p.trim()).filter(Boolean))
    .pipe(z.array(z.string()).max(30)),
  code: z.string(),
  pitfall: z.string(),
  docsUrl: z.string().trim(),
  subjects,
  status,
});
export type NodeInput = z.input<typeof nodeSchema>;

// validateNode messages → form fields.
const NODE_RULE_FIELDS: [RegExp, string][] = [
  [/id must/, "slug"],
  [/unknown track/, "trackKey"],
  [/title/, "title"],
  [/: s missing/, "summary"],
  [/: c missing/, "code"],
  [/: pit missing/, "pitfall"],
  [/p needs/, "points"],
  [/u must/, "docsUrl"],
];

export async function saveNode(input: NodeInput, editedBy: string): Promise<Result> {
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, ...data } = parsed.data;
  const graph = await Graph.findById(data.graphId, { tracks: 1 }).lean<{ tracks?: { key: string }[] }>();
  if (!graph) return fail({ graphId: "Graph not found" });

  const errors: Record<string, string> = {};
  for (const message of validateNode({ ...data, prereqSlugs: [] }, (graph.tracks ?? []).map((t) => t.key))) {
    const field = NODE_RULE_FIELDS.find(([pattern]) => pattern.test(message))?.[1] ?? "_";
    errors[field] ??= message.replace(/^node [^:]*: /, "");
  }
  if (await slugTaken(GraphNode, data.slug, id, { graphId: data.graphId })) errors.slug ??= "Another topic in this graph uses this slug";
  if (Object.keys(errors).length) return fail(errors);

  const siblings = await GraphNode.find({ graphId: data.graphId }, { title: 1, prereqIds: 1 }).lean<{ _id: Id; title: string; prereqIds?: Id[] }[]>();
  const selfId = id ?? "new";
  if (data.prereqIds.includes(selfId)) return fail({ prereqIds: "A topic cannot require itself" });
  const inGraph = new Set(siblings.map((s) => String(s._id)));
  if (data.prereqIds.some((p) => !inGraph.has(p))) return fail({ prereqIds: "Prerequisites must be topics in the same graph" });

  const edges = Object.fromEntries(siblings.map((s) => [String(s._id), (s.prereqIds ?? []).map(String)]));
  edges[selfId] = data.prereqIds;
  const cycle = findCycle(edges);
  if (cycle) {
    const titleOf = new Map(siblings.map((s) => [String(s._id), s.title]));
    titleOf.set(selfId, data.title);
    // Start the loop at the topic being saved so the message reads from the user's point of view.
    const loop = cycle.slice(0, -1);
    const start = Math.max(0, loop.indexOf(selfId));
    const rotated = [...loop.slice(start), ...loop.slice(0, start)];
    return fail({ prereqIds: `Creates a cycle: ${[...rotated, rotated[0]].map((n) => titleOf.get(n) ?? n).join(" → ")}` });
  }

  if (id) {
    if (!(await GraphNode.exists({ _id: id, graphId: data.graphId }))) return fail({ id: "Topic not found" });
    return done((await saveWithRevision(GraphNode, id, data, editedBy))._id);
  }
  return done((await saveWithRevision(GraphNode, null, { ...data, order: await nextOrder(GraphNode, { graphId: data.graphId }) }, editedBy))._id);
}

// ---------- notes ----------

const seriesSchema = z.object({ id: objectId.optional(), slug, title: text("Title"), description: z.string(), subjects, status });
export type SeriesInput = z.input<typeof seriesSchema>;

export async function saveSeries(input: SeriesInput, editedBy: string): Promise<Result> {
  const parsed = seriesSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, ...data } = parsed.data;
  if (await slugTaken(NoteSeries, data.slug, id)) return fail({ slug: "Another series already uses this slug" });
  if (id) {
    if (!(await NoteSeries.exists({ _id: id }))) return fail({ id: "Series not found" });
    return done((await saveWithRevision(NoteSeries, id, data, editedBy))._id);
  }
  return done((await saveWithRevision(NoteSeries, null, { ...data, order: await nextOrder(NoteSeries) }, editedBy))._id);
}

const noteSchema = z.object({ id: objectId.optional(), seriesId: objectId, slug, title: text("Title"), body: z.string(), subjects, status });
export type NoteInput = z.input<typeof noteSchema>;

export async function saveNote(input: NoteInput, editedBy: string): Promise<Result> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, ...rest } = parsed.data;
  if (!(await NoteSeries.exists({ _id: rest.seriesId }))) return fail({ seriesId: "Series not found" });
  if (await slugTaken(Note, rest.slug, id, { seriesId: rest.seriesId })) return fail({ slug: "Another chapter in this series uses this slug" });
  const data = { ...rest, toc: extractToc(rest.body), readMinutes: readMinutes(rest.body) };
  if (id) {
    if (!(await Note.exists({ _id: id, seriesId: rest.seriesId }))) return fail({ id: "Chapter not found" });
    return done((await saveWithRevision(Note, id, data, editedBy))._id);
  }
  return done((await saveWithRevision(Note, null, { ...data, order: await nextOrder(Note, { seriesId: rest.seriesId }) }, editedBy))._id);
}

// ---------- subjects ----------

const subjectSchema = z.object({ id: objectId.optional(), slug, name: text("Name") });
export type SubjectInput = z.input<typeof subjectSchema>;

export async function saveSubject(input: SubjectInput, editedBy: string): Promise<Result> {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return fail(fieldErrors(parsed.error));
  const { id, ...data } = parsed.data;
  if (await slugTaken(Subject, data.slug, id)) return fail({ slug: "That subject already exists" });
  if (id) {
    if (!(await Subject.exists({ _id: id }))) return fail({ id: "Subject not found" });
    return done(await updateFollowingSlug(Subject, id, data, editedBy));
  }
  return done((await saveWithRevision(Subject, null, { ...data, order: await nextOrder(Subject) }, editedBy))._id);
}

// ---------- revisions ----------

type Snapshot = Record<string, unknown>;
const idsOf = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

/**
 * The rules the editors enforce, applied to a snapshot about to be restored: slugs stay unique,
 * parts/tracks still in use are not dropped, children point at an existing part/track, and
 * topic prerequisites stay in the graph without forming a cycle. Returns field errors or null.
 */
async function restoreErrors(entityType: string, id: string, snap: Snapshot): Promise<Record<string, string> | null> {
  const slugScope: Record<string, [Model<unknown>, string | null]> = {
    QuestionBook: [QuestionBook, null],
    Graph: [Graph, null],
    NoteSeries: [NoteSeries, null],
    Subject: [Subject, null],
    GraphNode: [GraphNode, "graphId"],
    Note: [Note, "seriesId"],
  };
  const scoped = slugScope[entityType];
  if (scoped && typeof snap.slug === "string") {
    const [model, parent] = scoped;
    if (await slugTaken(model, snap.slug, id, parent ? { [parent]: snap[parent] } : {})) {
      return { slug: `Another item now uses the slug "${snap.slug}"` };
    }
  }

  if (entityType === "QuestionBook") {
    const used = await removedKeysInUse(QuestionBook, id, "parts", "title", (snap.parts as { key: string }[]) ?? [], Question, { bookId: id }, "partKey");
    if (used) return { parts: `This version drops parts that still have questions: ${used}` };
  }
  if (entityType === "Graph") {
    const used = await removedKeysInUse(Graph, id, "tracks", "name", (snap.tracks as { key: string }[]) ?? [], GraphNode, { graphId: id }, "trackKey");
    if (used) return { tracks: `This version drops tracks that still have topics: ${used}` };
  }
  if (entityType === "Question") {
    const book = await QuestionBook.findById(snap.bookId, { parts: 1 }).lean<{ parts: { key: string }[] }>();
    if (!book?.parts.some((p) => p.key === snap.partKey)) return { partKey: "This version's part is no longer in the book" };
  }
  if (entityType === "GraphNode") {
    const graph = await Graph.findById(snap.graphId, { tracks: 1 }).lean<{ tracks?: { key: string }[] }>();
    if (!graph?.tracks?.some((t) => t.key === snap.trackKey)) return { trackKey: "This version's track is no longer in the graph" };
    const siblings = await GraphNode.find({ graphId: snap.graphId }, { prereqIds: 1 }).lean<{ _id: Id; prereqIds?: Id[] }[]>();
    const prereqs = idsOf(snap.prereqIds);
    const inGraph = new Set(siblings.map((s) => String(s._id)));
    if (prereqs.some((p) => p === id || !inGraph.has(p))) return { prereqIds: "This version's prerequisites are no longer in the graph" };
    const edges = Object.fromEntries(siblings.map((s) => [String(s._id), (s.prereqIds ?? []).map(String)]));
    edges[id] = prereqs;
    if (findCycle(edges)) return { prereqIds: "Restoring this version would create a prerequisite cycle" };
  }
  return null;
}

/** Restores a revision after checking it against the editors' rules; the restore is itself revisioned. */
export async function restoreRevisionChecked(revisionId: string, editedBy: string): Promise<Result> {
  if (!isValidObjectId(revisionId)) return fail({ _: "Invalid revision" });
  const revision = await Revision.findById(revisionId).lean<{ entityType: string; entityId: Id; snapshot: Snapshot }>();
  if (!revision) return fail({ _: "Revision not found" });
  const errors = await restoreErrors(revision.entityType, String(revision.entityId), revision.snapshot);
  if (errors) return fail(errors);
  try {
    await inTransaction(async (session) => {
      const before = await mongoose.models[revision.entityType]
        ?.findById(revision.entityId, { slug: 1 }, { session })
        .lean<{ slug?: string }>();
      await restoreRevision(revisionId, editedBy, { session });
      const [from, to] = [before?.slug, revision.snapshot.slug];
      if (typeof from === "string" && typeof to === "string") {
        await followSlugChange(revision.entityType, String(revision.entityId), from, to, session);
      }
    });
  } catch (error) {
    return fail({ _: error instanceof Error ? error.message : "Restore failed" });
  }
  return done(revision.entityId);
}

/** Topics whose title matches, limited to the given subjects when any; for the "link topic" picker. */
export async function searchTopics(
  query: string,
  subjectSlugs: string[],
): Promise<{ id: string; title: string; graphTitle: string }[]> {
  const term = query.trim();
  const pattern = term ? new RegExp(escapeRegex(term), "i") : null;
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
