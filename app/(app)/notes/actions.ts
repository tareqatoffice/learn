"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { saveRecitation, setNotePosition, setNoteRead, setPreQuestions } from "@/features/progress/notes";
import { ANCHOR_MAX, PREQ_MAX_LEN, PREQ_MAX_QUESTIONS, RECITE_MAX, RECITE_VERDICTS } from "@/models/studyConstants";

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

const noteId = z.string().regex(/^[0-9a-f]{24}$/i);

const preQuestionsInput = z.object({
  noteId,
  questions: z.array(z.string().max(PREQ_MAX_LEN)).max(PREQ_MAX_QUESTIONS),
});

const recitationInput = z.object({
  noteId,
  anchor: z.string().min(1).max(ANCHOR_MAX),
  text: z.string().trim().min(1).max(RECITE_MAX),
  verdict: z.enum(RECITE_VERDICTS),
});

export async function savePreQuestionsAction(id: string, questions: string[]): Promise<void> {
  const user = await requireUser();
  const parsed = preQuestionsInput.parse({ noteId: id, questions });
  await connectDb();
  await setPreQuestions(user.userId, parsed.noteId, parsed.questions);
}

export async function saveRecitationAction(
  id: string,
  anchor: string,
  text: string,
  verdict: (typeof RECITE_VERDICTS)[number],
): Promise<void> {
  const user = await requireUser();
  const parsed = recitationInput.parse({ noteId: id, anchor, text, verdict });
  await connectDb();
  await saveRecitation(user.userId, parsed.noteId, parsed.anchor, parsed.text, parsed.verdict);
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
