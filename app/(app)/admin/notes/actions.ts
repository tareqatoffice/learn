"use server";

import { adminContext } from "@/features/admin/action";
import {
  saveNote,
  saveSeries,
  type NoteInput,
  type Result,
  type SeriesInput,
} from "@/features/admin/service";

export async function saveSeriesAction(input: SeriesInput): Promise<Result> {
  const user = await adminContext();
  return saveSeries(input, user.email);
}

export async function saveNoteAction(input: NoteInput): Promise<Result> {
  const user = await adminContext();
  return saveNote(input, user.email);
}
