import { isValidObjectId, type Types } from "mongoose";
import { effectiveStatus } from "@/lib/access";
import { isAdminEmail } from "@/lib/authz";
import { byOrder, escapeRegex } from "@/lib/utils";
import {
  Graph,
  GraphNode,
  NodeProgress,
  Note,
  NoteProgress,
  NoteSeries,
  Question,
  QuestionBook,
  QuestionProgress,
  Revision,
  Subject,
  User,
  type AccessStatus,
  type Status,
} from "@/models";

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

// ---------- graphs ----------

export type AdminGraph = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  footer: string;
  subjects: string[];
  status: Status;
  tracks: { key: string; name: string }[];
};

export async function listGraphsAdmin(): Promise<{ id: string; slug: string; title: string; status: Status; topics: number }[]> {
  const graphs = await Graph.find({}, { slug: 1, title: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; status: Status }[]>();
  const counts = await GraphNode.aggregate<{ _id: Id; n: number }>([{ $group: { _id: "$graphId", n: { $sum: 1 } } }]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
  return graphs.map((g) => ({ id: String(g._id), slug: g.slug, title: g.title, status: g.status, topics: countOf.get(String(g._id)) ?? 0 }));
}

export async function getGraphAdmin(id: string): Promise<{
  graph: AdminGraph;
  nodes: { id: string; slug: string; title: string; trackKey: string; status: Status }[];
} | null> {
  if (!isValidObjectId(id)) return null;
  const g = await Graph.findById(id).lean<{
    _id: Id;
    slug: string;
    title: string;
    subtitle?: string;
    footer?: string;
    subjects?: string[];
    status: Status;
    tracks?: { key: string; name: string; order?: number }[];
  }>();
  if (!g) return null;
  const nodes = await GraphNode.find({ graphId: g._id }, { slug: 1, title: 1, trackKey: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; trackKey: string; status: Status }[]>();
  return {
    graph: {
      id: String(g._id),
      slug: g.slug,
      title: g.title,
      subtitle: g.subtitle ?? "",
      footer: g.footer ?? "",
      subjects: g.subjects ?? [],
      status: g.status,
      tracks: byOrder(g.tracks).map(({ key, name }) => ({ key, name })),
    },
    nodes: nodes.map((n) => ({ id: String(n._id), slug: n.slug, title: n.title, trackKey: n.trackKey, status: n.status })),
  };
}

export type AdminNode = {
  id: string;
  graphId: string;
  slug: string;
  trackKey: string;
  title: string;
  prereqIds: string[];
  summary: string;
  points: string[];
  code: string;
  pitfall: string;
  docsUrl: string;
  subjects: string[];
  status: Status;
};

export type AdminRelated = {
  questions: { id: string; title: string }[];
  notes: { noteId: string; anchor: string; title: string }[];
};

export async function getNodeAdmin(id: string): Promise<{ node: AdminNode; related: AdminRelated } | null> {
  if (!isValidObjectId(id)) return null;
  const n = await GraphNode.findById(id).lean<{
    _id: Id;
    graphId: Id;
    slug: string;
    trackKey: string;
    title: string;
    prereqIds?: Id[];
    summary?: string;
    points?: string[];
    code?: string;
    pitfall?: string;
    docsUrl?: string;
    subjects?: string[];
    status: Status;
    related?: { questionIds?: Id[]; notes?: { noteId: Id; anchor?: string }[] };
  }>();
  if (!n) return null;
  const questionIds = n.related?.questionIds ?? [];
  const noteLinks = n.related?.notes ?? [];
  const [questions, notes] = await Promise.all([
    Question.find({ _id: { $in: questionIds } }, { question: 1 }).lean<{ _id: Id; question: string }[]>(),
    Note.find({ _id: { $in: noteLinks.map((l) => l.noteId) } }, { title: 1, toc: 1 }).lean<
      { _id: Id; title: string; toc?: { anchor: string; text: string }[] }[]
    >(),
  ]);
  const qTitle = new Map(questions.map((q) => [String(q._id), q.question]));
  const noteById = new Map(notes.map((x) => [String(x._id), x]));
  return {
    node: {
      id: String(n._id),
      graphId: String(n.graphId),
      slug: n.slug,
      trackKey: n.trackKey,
      title: n.title,
      prereqIds: (n.prereqIds ?? []).map(String),
      summary: n.summary ?? "",
      points: n.points ?? [],
      code: n.code ?? "",
      pitfall: n.pitfall ?? "",
      docsUrl: n.docsUrl ?? "",
      subjects: n.subjects ?? [],
      status: n.status,
    },
    related: {
      questions: questionIds.map((q) => ({ id: String(q), title: qTitle.get(String(q)) ?? "(missing question)" })),
      notes: noteLinks.map((l) => {
        const note = noteById.get(String(l.noteId));
        const heading = l.anchor ? note?.toc?.find((t) => t.anchor === l.anchor)?.text : undefined;
        return {
          noteId: String(l.noteId),
          anchor: l.anchor ?? "",
          title: `${note?.title ?? "(missing chapter)"}${heading ? ` § ${heading}` : ""}`,
        };
      }),
    },
  };
}

/** Questions whose text matches, limited to the given subjects when any; for the related picker. */
export async function searchQuestions(query: string, subjectSlugs: string[]): Promise<{ id: string; title: string }[]> {
  const term = query.trim();
  const rows = await Question.find(
    { ...(term ? { question: new RegExp(escapeRegex(term), "i") } : {}), ...(subjectSlugs.length ? { subjects: { $in: subjectSlugs } } : {}) },
    { question: 1 },
  )
    .limit(20)
    .lean<{ _id: Id; question: string }[]>();
  return rows.map((q) => ({ id: String(q._id), title: q.question }));
}

/** Chapters whose title matches, with their headings; for the related picker. */
export async function searchNotes(query: string): Promise<{ id: string; title: string; toc: { anchor: string; text: string }[] }[]> {
  const term = query.trim();
  const rows = await Note.find(term ? { title: new RegExp(escapeRegex(term), "i") } : {}, { title: 1, toc: 1 })
    .limit(20)
    .lean<{ _id: Id; title: string; toc?: { anchor: string; text: string }[] }[]>();
  return rows.map((n) => ({ id: String(n._id), title: n.title, toc: (n.toc ?? []).map(({ anchor, text }) => ({ anchor, text })) }));
}

// ---------- notes ----------

export type AdminSeries = { id: string; slug: string; title: string; description: string; subjects: string[]; status: Status };
export type AdminNote = { id: string; seriesId: string; slug: string; title: string; body: string; subjects: string[]; status: Status };

export async function listSeriesAdmin(): Promise<{ id: string; slug: string; title: string; status: Status; chapters: number }[]> {
  const series = await NoteSeries.find({}, { slug: 1, title: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; status: Status }[]>();
  const counts = await Note.aggregate<{ _id: Id; n: number }>([{ $group: { _id: "$seriesId", n: { $sum: 1 } } }]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
  return series.map((s) => ({ id: String(s._id), slug: s.slug, title: s.title, status: s.status, chapters: countOf.get(String(s._id)) ?? 0 }));
}

export async function getSeriesAdmin(id: string): Promise<{
  series: AdminSeries;
  notes: { id: string; slug: string; title: string; status: Status }[];
} | null> {
  if (!isValidObjectId(id)) return null;
  const s = await NoteSeries.findById(id).lean<{ _id: Id; slug: string; title: string; description?: string; subjects?: string[]; status: Status }>();
  if (!s) return null;
  const notes = await Note.find({ seriesId: s._id }, { slug: 1, title: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ _id: Id; slug: string; title: string; status: Status }[]>();
  return {
    series: { id: String(s._id), slug: s.slug, title: s.title, description: s.description ?? "", subjects: s.subjects ?? [], status: s.status },
    notes: notes.map((n) => ({ id: String(n._id), slug: n.slug, title: n.title, status: n.status })),
  };
}

export async function getNoteAdmin(id: string): Promise<AdminNote | null> {
  if (!isValidObjectId(id)) return null;
  const n = await Note.findById(id).lean<{ _id: Id; seriesId: Id; slug: string; title: string; body?: string; subjects?: string[]; status: Status }>();
  return n
    ? { id: String(n._id), seriesId: String(n.seriesId), slug: n.slug, title: n.title, body: n.body ?? "", subjects: n.subjects ?? [], status: n.status }
    : null;
}

// ---------- system ----------

export type RevisionRow = { id: string; entityType: string; entityId: string; editedBy: string; editedAt: Date; snapshot: Record<string, unknown> };

/** Newest revisions across all content, or of one entity when given. */
export async function listRevisionsAdmin(filter: { entityType?: string; entityId?: string } = {}, limit = 100): Promise<RevisionRow[]> {
  const query: Record<string, unknown> = {};
  if (filter.entityType) query.entityType = filter.entityType;
  if (filter.entityId) {
    if (!isValidObjectId(filter.entityId)) return [];
    query.entityId = filter.entityId;
  }
  const rows = await Revision.find(query)
    .sort({ editedAt: -1, _id: -1 })
    .limit(limit)
    .lean<{ _id: Id; entityType: string; entityId: Id; editedBy?: string; editedAt: Date; snapshot: Record<string, unknown> }[]>();
  return rows.map((r) => ({
    id: String(r._id),
    entityType: r.entityType,
    entityId: String(r.entityId),
    editedBy: r.editedBy ?? "",
    editedAt: r.editedAt,
    snapshot: r.snapshot,
  }));
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  image?: string;
  /** From ADMIN_EMAILS, not the stored role: admins can't be reviewed or blocked. */
  isAdmin: boolean;
  status: AccessStatus;
  requestedAt?: Date;
  requestNote?: string;
  blockReason?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  lastLoginAt?: Date;
  questions: number;
  topics: number;
  notes: number;
}

export async function listUsersAdmin(): Promise<AdminUserRow[]> {
  const users = await User.find(
    {},
    { email: 1, name: 1, image: 1, lastLoginAt: 1, status: 1, createdAt: 1, requestNote: 1, blockReason: 1, reviewedAt: 1, reviewedBy: 1 },
  )
    .sort({ lastLoginAt: -1, _id: -1 })
    .lean<
      {
        _id: Id;
        email: string;
        name?: string;
        image?: string;
        lastLoginAt?: Date;
        status?: AccessStatus;
        createdAt?: Date;
        requestNote?: string;
        blockReason?: string;
        reviewedAt?: Date;
        reviewedBy?: string;
      }[]
    >();
  const count = async (model: typeof QuestionProgress) =>
    new Map((await model.aggregate<{ _id: Id; n: number }>([{ $group: { _id: "$userId", n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
  const [questions, topics, notes] = await Promise.all([count(QuestionProgress), count(NodeProgress), count(NoteProgress)]);
  return users.map((u) => ({
    id: String(u._id),
    email: u.email,
    name: u.name ?? "",
    image: u.image,
    isAdmin: isAdminEmail(u.email),
    status: effectiveStatus(u.email, u.status),
    requestedAt: u.createdAt,
    requestNote: u.requestNote,
    blockReason: u.blockReason,
    reviewedAt: u.reviewedAt,
    reviewedBy: u.reviewedBy,
    lastLoginAt: u.lastLoginAt,
    questions: questions.get(String(u._id)) ?? 0,
    topics: topics.get(String(u._id)) ?? 0,
    notes: notes.get(String(u._id)) ?? 0,
  }));
}

export async function listSubjectsAdmin(): Promise<{ id: string; slug: string; name: string }[]> {
  const rows = await Subject.find({}, { slug: 1, name: 1 }).sort({ order: 1, name: 1 }).lean<{ _id: Id; slug: string; name: string }[]>();
  return rows.map((s) => ({ id: String(s._id), slug: s.slug, name: s.name }));
}
