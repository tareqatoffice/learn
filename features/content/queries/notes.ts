import { isValidObjectId, type Types } from "mongoose";
import { visibleNodeFilter, visibleNoteFilter } from "@/features/content/visibility";
import { Graph, GraphNode, Note, NoteProgress, NoteSeries } from "@/models";
import { getNotePosition, getSeriesProgress, getStudyNotes, type StudyNotes } from "@/features/progress/notes";

type Id = Types.ObjectId;
type SeriesRow = { _id: Id; slug: string; title: string; description?: string };
type ChapterRow = { _id: Id; slug: string; title: string; readMinutes?: number };
export type TocEntry = { depth: number; text: string; anchor: string };

const visibleSeries = (slug?: string) =>
  NoteSeries.find({ status: "published", ...(slug ? { slug } : {}) }, { slug: 1, title: 1, description: 1 })
    .sort({ order: 1, title: 1 })
    .lean<SeriesRow[]>();

async function chaptersOf(seriesId: Id): Promise<ChapterRow[]> {
  return Note.find(await visibleNoteFilter(String(seriesId)), { slug: 1, title: 1, readMinutes: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<ChapterRow[]>();
}

export async function listSeriesWithProgress(
  userId: string,
): Promise<{ slug: string; title: string; read: number; total: number }[]> {
  const series = await visibleSeries();
  const notes = await Note.find(await visibleNoteFilter(), { seriesId: 1 }).lean<{ _id: Id; seriesId: Id }[]>();
  const read = isValidObjectId(userId)
    ? await NoteProgress.find({ userId, read: true, noteId: { $in: notes.map((n) => n._id) } }, { noteId: 1 }).lean<
        { noteId: Id }[]
      >()
    : [];
  const readIds = new Set(read.map((r) => String(r.noteId)));

  return series.map((s) => {
    const mine = notes.filter((n) => String(n.seriesId) === String(s._id));
    return { slug: s.slug, title: s.title, read: mine.filter((n) => readIds.has(String(n._id))).length, total: mine.length };
  });
}

export async function getSeriesView(
  userId: string,
  slug: string,
): Promise<{
  series: { slug: string; title: string; description: string };
  chapters: { slug: string; title: string; readMinutes: number; read: boolean }[];
} | null> {
  const [series] = await visibleSeries(slug);
  if (!series) return null;
  const chapters = await chaptersOf(series._id);
  const progress = await getSeriesProgress(userId, String(series._id), chapters.map((c) => c._id));
  return {
    series: { slug: series.slug, title: series.title, description: series.description ?? "" },
    chapters: chapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      readMinutes: c.readMinutes ?? 1,
      read: progress[String(c._id)]?.read ?? false,
    })),
  };
}

async function topicsLinking(noteId: Id): Promise<{ graphSlug: string; nodeSlug: string; title: string }[]> {
  const nodes = await GraphNode.find({ ...(await visibleNodeFilter()), "related.notes.noteId": noteId }, { graphId: 1, slug: 1, title: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<{ graphId: Id; slug: string; title: string }[]>();
  const graphs = await Graph.find({ _id: { $in: nodes.map((n) => n.graphId) } }, { slug: 1 }).lean<{ _id: Id; slug: string }[]>();
  const slugOf = new Map(graphs.map((g) => [String(g._id), g.slug]));
  return nodes.map((n) => ({ graphSlug: slugOf.get(String(n.graphId)) ?? "", nodeSlug: n.slug, title: n.title }));
}

export async function getChapterView(
  userId: string,
  seriesSlug: string,
  chapterSlug: string,
): Promise<{
  series: { slug: string; title: string; chapters: { slug: string; title: string; read: boolean }[] };
  chapter: { id: string; slug: string; title: string; body: string; readMinutes: number };
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
  toc: TocEntry[];
  read: boolean;
  resume?: { anchor: string; text: string };
  study: StudyNotes;
  relatedTopics: { graphSlug: string; nodeSlug: string; title: string }[];
} | null> {
  const [series] = await visibleSeries(seriesSlug);
  if (!series) return null;
  const note = await Note.findOne({ ...(await visibleNoteFilter(String(series._id))), slug: chapterSlug }).lean<{
    _id: Id;
    slug: string;
    title: string;
    body?: string;
    readMinutes?: number;
    toc?: TocEntry[];
  }>();
  if (!note) return null;

  const [chapters, relatedTopics, lastAnchor, study] = await Promise.all([
    chaptersOf(series._id),
    topicsLinking(note._id),
    getNotePosition(userId, String(note._id)),
    getStudyNotes(userId, String(note._id)),
  ]);
  const toc = (note.toc ?? []).map(({ depth, text, anchor }) => ({ depth, text, anchor }));
  const resumeEntry = lastAnchor ? toc.find((t) => t.anchor === lastAnchor) : undefined;
  const progress = await getSeriesProgress(userId, String(series._id), chapters.map((c) => c._id));
  const at = chapters.findIndex((c) => String(c._id) === String(note._id));
  const prev = chapters[at - 1];
  const next = chapters[at + 1];

  return {
    series: {
      slug: series.slug,
      title: series.title,
      chapters: chapters.map((c) => ({ slug: c.slug, title: c.title, read: progress[String(c._id)]?.read ?? false })),
    },
    chapter: { id: String(note._id), slug: note.slug, title: note.title, body: note.body ?? "", readMinutes: note.readMinutes ?? 1 },
    ...(prev ? { prev: { slug: prev.slug, title: prev.title } } : {}),
    ...(next ? { next: { slug: next.slug, title: next.title } } : {}),
    toc,
    read: progress[String(note._id)]?.read ?? false,
    ...(resumeEntry ? { resume: { anchor: resumeEntry.anchor, text: resumeEntry.text } } : {}),
    study,
    relatedTopics,
  };
}
