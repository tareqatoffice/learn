import mongoose, { Types, type Model } from "mongoose";
import { findCycle } from "@/content/cycles";
import { parseGraph } from "@/content/parse/graph";
import { parseChapter } from "@/content/parse/notes";
import { parseBook } from "@/content/parse/questions";
import { saveWithRevision } from "@/content/revisions";
import type { ImportReport, ImportSource, ImportTarget, ItemChange } from "@/content/types";
import { extractToc, readMinutes } from "@/lib/markdown/toc";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

export type ImportOptions = {
  target: ImportTarget;
  source: ImportSource;
  dryRun?: boolean;
  publish?: boolean;
  editedBy: string;
  title?: string;
  subjects?: string[];
  description?: string;
  importedAt?: Date;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;
type Data = Record<string, unknown>;
type Row = Data & { _id: Types.ObjectId };
/** A part, extra or track: container subdocs merged by `key`. */
type Entry = Data & { key: string };
/** `seen` is the doc's `updatedAt` when planned; the commit refuses to overwrite a doc edited since. */
type Write = { model: AnyModel; id: Types.ObjectId | null; data: Data; seen?: unknown; label: string };
type Ctx = { opts: ImportOptions; report: ImportReport; writes: Write[] };
type Target = { doc: Row | null; id: Types.ObjectId };
type Incoming = { id?: string; key: string; title: string };
type Match<T> = { item: T; doc: Row | null; id: Types.ObjectId };
type ListSpec = { name: string; type: ItemChange["type"]; fields: string[]; incoming: Entry[] };

/** Where partless questions go when they are new (a fragment pushed without a part heading). */
const GENERAL_PART: Entry = { key: "general", title: "General", intro: "" };
/** parseGraph checks these against the incoming JSON alone; the import re-checks them against existing + incoming. */
const GRAPH_CONTEXT_ERRORS = [/^tracks: need /, /: unknown track /, /: unknown prerequisite /, /^cycle: /];
const MAX_TRACKS = 6;

/**
 * Imports a book, note series or graph. Plans a diff against the DB first (reads only); when not a
 * dry run and the plan has no errors, applies it in one transaction. Never deletes or archives,
 * and never changes the status of existing items. `dryRun` defaults to true.
 */
export async function runImport(opts: ImportOptions): Promise<ImportReport> {
  const report: ImportReport = {
    target: opts.target,
    dryRun: opts.dryRun ?? true,
    createdTarget: false,
    creates: 0,
    updates: 0,
    unchanged: 0,
    items: [],
    warnings: [],
    errors: [],
  };
  const ctx: Ctx = { opts, report, writes: [] };

  try {
    const { source, target } = opts;
    if (source.kind !== target.kind) report.errors.push(`source kind ${source.kind} does not match target kind ${target.kind}`);
    else if (source.kind === "book") await planBook(ctx, source.markdown);
    else if (source.kind === "series") await planSeries(ctx, source.files);
    else await planGraph(ctx, source.json);
  } catch (error) {
    report.errors.push(message(error));
  }
  if (report.dryRun || report.errors.length || !ctx.writes.length) return report;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const w of ctx.writes) {
        // The plan was read outside the transaction; an edit made since would be silently overwritten.
        if (w.id && !(await w.model.exists({ _id: w.id, updatedAt: w.seen ?? null }).session(session))) {
          throw new Error(`${w.label} was edited since this import was planned; preview again`);
        }
        await saveWithRevision(w.model, w.id && String(w.id), w.data, opts.editedBy, { session });
      }
    });
  } catch (error) {
    report.errors.push(`import failed, nothing was written: ${message(error)}`);
  } finally {
    await session.endSession();
  }
  return report;
}

async function planBook(ctx: Ctx, markdown: string): Promise<void> {
  const { opts, report } = ctx;
  const parsed = parseBook(markdown, opts.target.slug);
  report.warnings.push(...parsed.unaccounted.map((u) => `line ${u.line} not imported: ${u.heading}`));
  const target = await loadContainer(ctx, QuestionBook, parsed.id);
  if (!target) return;

  const docs = target.doc ? await Question.find({ bookId: target.id }).lean<Row[]>() : [];
  const items = parsed.questions.map((q) => ({ ...q, key: q.importKey, title: q.question }));
  // importKey is unique across all books, so a key another book holds can't be created here.
  const foreign = await Question.find({ importKey: { $in: items.map((i) => i.key) }, bookId: { $ne: target.id } })
    .select("importKey")
    .lean<Row[]>();
  for (const f of foreign) report.errors.push(`question key ${String(f.importKey)} already belongs to another book`);
  const matches = matchItems(ctx, "question", items, docs, "importKey");

  const parts: Entry[] = [...parsed.parts];
  const knownParts = [...parts, ...((target.doc?.parts as Entry[] | undefined) ?? [])];
  if (matches.some((m) => !m.doc && !m.item.part) && !knownParts.some((p) => p.key === GENERAL_PART.key)) {
    parts.push(GENERAL_PART);
  }
  const container = await planContainer(ctx, QuestionBook, target, { title: opts.title || parsed.title, intro: parsed.intro }, [
    { name: "parts", type: "part", fields: ["title", "intro"], incoming: parts },
    { name: "extras", type: "extra", fields: ["title", "body"], incoming: parsed.extras },
  ]);

  const partKeyByTitle = new Map<string, string>();
  for (const p of parsed.parts) if (!partKeyByTitle.has(p.title)) partKeyByTitle.set(p.title, p.key);
  const nextOrder = orderAfter(docs);
  for (const m of matches) {
    const q = m.item;
    const next: Data = { question: q.question, prompt: q.prompt, answer: q.answer };
    // A matched question keeps its part unless the source names one.
    const partKey = q.part ? partKeyByTitle.get(q.part) : m.doc ? undefined : GENERAL_PART.key;
    if (partKey) next.partKey = partKey;
    await planItem(ctx, Question, "question", m, next, { bookId: target.id, importKey: q.key }, container.subjects, nextOrder);
  }
}

async function planSeries(ctx: Ctx, files: { name: string; content: string }[]): Promise<void> {
  const { opts } = ctx;
  const chapters = files.map((f) => parseChapter(f.content, f.name));
  const target = await loadContainer(ctx, NoteSeries);
  if (!target) return;

  const docs = target.doc ? await Note.find({ seriesId: target.id }).lean<Row[]>() : [];
  const items = chapters.map((c) => ({ ...c, key: c.slug, title: c.title || c.slug }));
  const matches = matchItems(ctx, "note", items, docs, "slug");
  const container = await planContainer(ctx, NoteSeries, target, { title: opts.title, description: opts.description }, []);

  const nextOrder = orderAfter(docs);
  for (const [i, m] of matches.entries()) {
    const { title, body, slug } = chapters[i]; // `title` unlabelled: a chapter without an H1 fails validation
    const next: Data = { title, body, toc: extractToc(body), readMinutes: readMinutes(body) };
    await planItem(ctx, Note, "note", m, next, { seriesId: target.id, slug }, container.subjects, nextOrder);
  }
}

async function planGraph(ctx: Ctx, json: unknown): Promise<void> {
  const { opts, report } = ctx;
  const { graph, errors } = parseGraph(json);
  report.errors.push(...errors.filter((e) => !GRAPH_CONTEXT_ERRORS.some((re) => re.test(e))));
  const target = await loadContainer(ctx, Graph, graph.id);
  if (!target) return;

  const docs = target.doc ? await GraphNode.find({ graphId: target.id }).lean<Row[]>() : [];
  const matches = matchItems(ctx, "node", graph.nodes.map((n) => ({ ...n, key: n.slug })), docs, "slug");
  const container = await planContainer(
    ctx,
    Graph,
    target,
    { title: opts.title || graph.title, subtitle: graph.subtitle, footer: graph.footer },
    [{ name: "tracks", type: "track", fields: ["name"], incoming: graph.tracks }],
  );
  const trackKeys = (container.lists.tracks ?? []).map((t) => t.key);
  if (trackKeys.length < 2 || trackKeys.length > MAX_TRACKS) report.errors.push(`tracks: need 2..${MAX_TRACKS}`);

  // Second pass: prerequisite slugs resolve to existing or incoming nodes; cycles are checked over both.
  const idBySlug = new Map(docs.map((d) => [String(d.slug), d._id]));
  for (const m of matches) idBySlug.set(m.item.slug, m.id);
  const slugById = new Map(docs.map((d) => [String(d._id), String(d.slug)]));
  const edges: Record<string, string[]> = Object.fromEntries(
    docs.map((d) => [String(d._id), (d.prereqIds as Types.ObjectId[]).map(String)]),
  );
  const prereqs = matches.map((m) => {
    const n = m.item;
    if (!trackKeys.includes(n.trackKey)) report.errors.push(`node ${n.slug}: unknown track ${n.trackKey}`);
    const ids = n.prereqSlugs.flatMap((slug) => {
      const id = idBySlug.get(slug);
      if (!id) report.errors.push(`node ${n.slug}: unknown prerequisite ${slug}`);
      return id ? [id] : [];
    });
    edges[String(m.id)] = ids.map(String);
    slugById.set(String(m.id), n.slug);
    return ids;
  });
  const cycle = findCycle(edges);
  if (cycle) report.errors.push(`cycle: ${cycle.map((id) => slugById.get(id)).join(" -> ")}`);

  const nextOrder = orderAfter(docs);
  for (const [i, m] of matches.entries()) {
    const n = m.item;
    const next: Data = {
      trackKey: n.trackKey,
      title: n.title,
      summary: n.summary,
      points: n.points,
      code: n.code,
      pitfall: n.pitfall,
      docsUrl: n.docsUrl,
      prereqIds: prereqs[i],
    };
    await planItem(ctx, GraphNode, "node", m, next, { graphId: target.id, slug: n.slug }, container.subjects, nextOrder);
  }
}

/** The target container, or null (with an error) when it is missing and no title allows creating it. */
async function loadContainer(ctx: Ctx, model: AnyModel, sourceId?: string): Promise<Target | null> {
  const { target, title } = ctx.opts;
  const doc = await model.findOne({ slug: target.slug }).lean<Row | null>();
  if (!doc && !title) {
    ctx.report.errors.push("target not found");
    return null;
  }
  if (doc && sourceId && sourceId !== String(doc._id)) {
    ctx.report.warnings.push(`source was pulled from ${target.kind} ${sourceId}, not ${target.slug}`);
  }
  return { doc, id: doc?._id ?? new Types.ObjectId() };
}

/** Plans the container create or update; scalars and list entries change only when given a non-empty value. */
async function planContainer(
  ctx: Ctx,
  model: AnyModel,
  target: Target,
  scalars: Record<string, string | undefined>,
  lists: ListSpec[],
): Promise<{ subjects: string[]; lists: Record<string, Entry[]> }> {
  const { opts, report } = ctx;
  const given: Data = Object.fromEntries(Object.entries(scalars).filter(([, v]) => v?.trim()));
  const listItems: ItemChange[] = [];
  const merged: Record<string, Entry[]> = {};
  const changedLists: Data = {};
  for (const spec of lists) {
    const result = mergeByKey((target.doc?.[spec.name] as Entry[] | undefined) ?? [], spec, listItems);
    merged[spec.name] = result.list;
    if (result.changed) changedLists[spec.name] = result.list;
  }
  const key = opts.target.slug;
  const title = String(given.title ?? target.doc?.title ?? "");

  if (!target.doc) {
    const last = await model.findOne().sort({ order: -1 }).lean<Row | null>();
    const subjects = opts.subjects ?? [];
    const data = {
      _id: target.id,
      slug: key,
      ...given,
      ...merged,
      subjects,
      order: Number(last?.order ?? 0) + 1,
      status: newStatus(opts),
    };
    report.createdTarget = true;
    await queue(ctx, model, null, stamped(opts, data), { action: "create", type: "container", key, title, id: String(target.id) });
    report.items.push(...listItems);
    return { subjects, lists: merged };
  }

  const fields = [...diff(target.doc, given), ...Object.keys(changedLists)];
  const change: ItemChange = { action: "unchanged", type: "container", key, title, id: String(target.id) };
  if (fields.length) {
    const data = stamped(opts, { ...pick(given, fields), ...changedLists });
    await queue(ctx, model, target.doc, data, { ...change, action: "update", fields });
  } else {
    report.items.push(change);
  }
  report.items.push(...listItems);
  return { subjects: (target.doc.subjects as string[] | undefined) ?? [], lists: merged };
}

/** Appends new entries (after the max `order`) and updates the given fields of existing ones. */
function mergeByKey(existing: Entry[], spec: ListSpec, items: ItemChange[]): { list: Entry[]; changed: boolean } {
  const list = existing.map((e) => ({ ...e }));
  let order = Math.max(0, ...list.map((e) => Number(e.order) || 0));
  let changed = false;
  for (const inc of spec.incoming) {
    const title = String(inc.title ?? inc.name ?? "");
    const base = { type: spec.type, key: inc.key, title };
    const cur = list.find((e) => e.key === inc.key);
    if (!cur) {
      list.push({ ...inc, order: ++order });
      changed = true;
      items.push({ ...base, action: "create" });
      continue;
    }
    const fields = spec.fields.filter((f) => typeof inc[f] === "string" && (inc[f] as string).trim() && inc[f] !== cur[f]);
    for (const f of fields) cur[f] = inc[f];
    changed ||= fields.length > 0;
    items.push(fields.length ? { ...base, action: "update", fields } : { ...base, action: "unchanged" });
  }
  return { list, changed };
}

/** Matches each incoming item by canonical id within the container, then by key; otherwise it is new. */
function matchItems<T extends Incoming>(
  ctx: Ctx,
  type: ItemChange["type"],
  items: T[],
  docs: Row[],
  keyField: string,
): Match<T>[] {
  const { report, opts } = ctx;
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const byKey = new Map(docs.map((d) => [String(d[keyField]), d]));
  const claimed = new Set<string>();
  const fresh = new Set<string>();
  return items.map((item) => {
    let doc = item.id ? (byId.get(item.id) ?? null) : null;
    if (item.id && !doc) {
      report.warnings.push(`${type} "${item.title}": id ${item.id} is not in ${opts.target.kind} ${opts.target.slug}; matching by key`);
    }
    doc ??= byKey.get(item.key) ?? null;
    const seen = doc ? claimed : fresh;
    const mark = doc ? String(doc._id) : item.key;
    if (seen.has(mark)) report.errors.push(`${type} "${item.title}": matches the same ${type} as an earlier entry (${item.key})`);
    seen.add(mark);
    return { item, doc, id: doc?._id ?? new Types.ObjectId() };
  });
}

/** Plans one child: an update of the fields that differ, nothing when unchanged, or a create. */
async function planItem(
  ctx: Ctx,
  model: AnyModel,
  type: ItemChange["type"],
  m: Match<Incoming>,
  next: Data,
  createData: Data,
  subjects: string[],
  nextOrder: () => number,
): Promise<void> {
  const { opts, report } = ctx;
  const base = { type, key: m.item.key, title: m.item.title, id: String(m.id) };
  if (!m.doc) {
    report.creates++;
    const data = { _id: m.id, ...createData, ...next, order: nextOrder(), subjects, status: newStatus(opts) };
    await queue(ctx, model, null, stamped(opts, data), { ...base, action: "create" });
    return;
  }
  const fields = diff(m.doc, next);
  if (!fields.length) {
    report.unchanged++;
    report.items.push({ ...base, action: "unchanged" });
    return;
  }
  report.updates++;
  await queue(ctx, model, m.doc, stamped(opts, pick(next, fields)), { ...base, action: "update", fields });
}

/** Records a write and its report line; schema validation runs now so a bad item blocks the whole import. */
async function queue(ctx: Ctx, model: AnyModel, doc: Row | null, data: Data, change: ItemChange): Promise<void> {
  const probe = doc ? model.hydrate(doc) : new model(data);
  if (doc) probe.set(data);
  try {
    await probe.validate();
  } catch (error) {
    if (!(error instanceof mongoose.Error.ValidationError)) throw error;
    ctx.report.errors.push(`${change.type} "${change.title}": ${error.message}`);
  }
  ctx.writes.push({ model, id: doc?._id ?? null, data, seen: doc?.updatedAt, label: `${change.type} "${change.title}"` });
  ctx.report.items.push(change);
}

const newStatus = (opts: ImportOptions) => (opts.publish ? "published" : "draft");
const stamped = (opts: ImportOptions, data: Data): Data => (opts.importedAt ? { ...data, importedAt: opts.importedAt } : data);
const pick = (data: Data, keys: string[]): Data => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const diff = (doc: Data, next: Data) => Object.keys(next).filter((k) => !same(doc[k], next[k]));
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function orderAfter(docs: Row[]): () => number {
  let order = Math.max(0, ...docs.map((d) => Number(d.order) || 0));
  return () => ++order;
}
