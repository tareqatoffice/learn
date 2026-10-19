import { isValidObjectId, type Types } from "mongoose";
import { visibleNoteFilter } from "@/content/visibility";
import { ForbiddenError } from "@/lib/authz";
import { Note, NoteProgress } from "@/models";

async function visibleNote(noteId: string): Promise<{ seriesId: Types.ObjectId }> {
  const note = isValidObjectId(noteId)
    ? await Note.findOne({ ...(await visibleNoteFilter()), _id: noteId }, { seriesId: 1 }).lean<{
        seriesId: Types.ObjectId;
      }>()
    : null;
  if (!note) throw new ForbiddenError("Note not available");
  return note;
}

async function upsertNoteProgress(userId: string, noteId: string, update: Record<string, unknown>): Promise<void> {
  const { seriesId } = await visibleNote(noteId);
  await NoteProgress.updateOne({ userId, noteId }, { ...update, $setOnInsert: { seriesId } }, { upsert: true });
}

/** Records that the user opened a chapter (drives "continue reading"). */
export async function openNote(userId: string, noteId: string): Promise<void> {
  await upsertNoteProgress(userId, noteId, { $set: { lastOpenedAt: new Date() } });
}

export async function setNoteRead(userId: string, noteId: string, read: boolean): Promise<void> {
  const update = read ? { $set: { read, readAt: new Date() } } : { $set: { read }, $unset: { readAt: 1 } };
  await upsertNoteProgress(userId, noteId, update);
}

/** Read state per visible chapter of the series that the user has touched (noteId -> { read }). */
export async function getSeriesProgress(userId: string, seriesId: string): Promise<Record<string, { read: boolean }>> {
  if (!isValidObjectId(seriesId)) return {};
  const visible = await Note.find(await visibleNoteFilter(seriesId), { _id: 1 }).lean<{ _id: Types.ObjectId }[]>();
  const rows = await NoteProgress.find(
    { userId, noteId: { $in: visible.map((n) => n._id) } },
    { noteId: 1, read: 1 },
  ).lean<{ noteId: Types.ObjectId; read: boolean }[]>();
  return Object.fromEntries(rows.map((row) => [String(row.noteId), { read: row.read }]));
}
