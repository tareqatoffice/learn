"use server";

import { saveNote, saveSeries, type NoteInput, type Result, type SeriesInput } from "@/admin/service";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function saveSeriesAction(input: SeriesInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveSeries(input, user.email);
}

export async function saveNoteAction(input: NoteInput): Promise<Result> {
  const user = await requireAdmin();
  await connectDb();
  return saveNote(input, user.email);
}
