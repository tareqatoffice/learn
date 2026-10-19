"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { setNoteRead } from "@/progress/notes";

const input = z.object({ noteId: z.string().regex(/^[0-9a-f]{24}$/i), read: z.boolean() });

export async function setNoteReadAction(noteId: string, read: boolean): Promise<void> {
  const user = await requireUser();
  const parsed = input.parse({ noteId, read });
  await connectDb();
  await setNoteRead(user.userId, parsed.noteId, parsed.read);
}
