"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import type { MarkResult } from "@/progress/questions";
import { createSession, finishSession, recordResult, type QuizFilter, type SessionView } from "@/progress/quiz";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);

const filterSchema = z.object({
  bookIds: z.array(objectId).max(100),
  partKeys: z.array(z.string().max(200)).max(200),
  mode: z.enum(["unseen", "review", "all"]),
  size: z.union([z.literal(10), z.literal(20), z.literal(50), z.null()]),
  questionIds: z.array(objectId).max(5000).optional(),
});

/** Starts a quiz and redirects into it; an empty deck creates nothing and comes back as `{ empty: true }`. */
export async function startQuizAction(filter: QuizFilter): Promise<{ empty: true }> {
  const parsed = filterSchema.parse(filter);
  const user = await requireUser();
  await connectDb();
  const result = await createSession(user.userId, parsed);
  if ("empty" in result) return { empty: true };
  redirect(`/interview/quiz/${result.sessionId}`);
}

export async function recordResultAction(sessionId: string, questionId: string, result: MarkResult): Promise<SessionView> {
  const input = z.object({ sessionId: objectId, questionId: objectId, result: z.enum(["got", "review", "skip"]) }).parse({
    sessionId,
    questionId,
    result,
  });
  const user = await requireUser();
  await connectDb();
  return recordResult(user.userId, input.sessionId, input.questionId, input.result);
}

export async function finishQuizAction(sessionId: string): Promise<void> {
  const id = objectId.parse(sessionId);
  const user = await requireUser();
  await connectDb();
  await finishSession(user.userId, id);
}
