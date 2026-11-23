"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { setNotePosition, setNoteRead } from "@/features/progress/notes";

const input = z.object({
  noteId: z.string().regex(/^[0-9a-f]{24}$/i),
  read: z.boolean(),
});

const positionInput = z.object({
  noteId: z.string().regex(/^[0-9a-f]{24}$/i),
  anchor: z.string().trim().min(1).max(200).nullable(),
});

export async function saveNotePositionAction(noteId: string, anchor: string | null): Promise<void> {
  const user = await requireUser();
  const parsed = positionInput.parse({ noteId, anchor });
  await connectDb();
  await setNotePosition(user.userId, parsed.noteId, parsed.anchor);
}

export async function setNoteReadAction(
  noteId: string,
  read: boolean,
): Promise<void> {
  const user = await requireUser();
  const parsed = input.parse({ noteId, read });
  await connectDb();
  await setNoteRead(user.userId, parsed.noteId, parsed.read);
  refresh();
}
