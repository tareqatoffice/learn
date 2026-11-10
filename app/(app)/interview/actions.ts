"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AI_ANSWER_MAX, AI_MESSAGE_MAX } from "@/lib/ai-limits";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { AiError } from "@/lib/openrouter";
import { clearQuestionProgress, type MarkResult } from "@/progress/questions";
import { type AiGrade, type AiReply, type AiResult, askFollowUp, gradeAnswer } from "@/progress/quizAi";
import {
  createSession,
  finishSession,
  recordResult,
  type QuizFilter,
  type SessionView,
} from "@/progress/quiz";

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);

const filterSchema = z.object({
  bookIds: z.array(objectId).max(100),
  partKeys: z.array(z.string().max(200)).max(200),
  mode: z.enum(["unseen", "review", "all"]),
  size: z.union([z.literal(10), z.literal(20), z.literal(50), z.null()]),
  questionIds: z.array(objectId).max(5000).optional(),
});

/** Starts a quiz and redirects into it; an empty deck creates nothing and comes back as `{ empty: true }`. */
export async function startQuizAction(
  filter: QuizFilter,
): Promise<{ empty: true }> {
  const parsed = filterSchema.parse(filter);
  const user = await requireUser();
  await connectDb();
  const result = await createSession(user.userId, parsed);
  if ("empty" in result) return { empty: true };
  redirect(`/interview/quiz/${result.sessionId}`);
}

export async function recordResultAction(
  sessionId: string,
  questionId: string,
  result: MarkResult,
): Promise<SessionView> {
  const input = z
    .object({
      sessionId: objectId,
      questionId: objectId,
      result: z.enum(["got", "review", "skip"]),
    })
    .parse({
      sessionId,
      questionId,
      result,
    });
  const user = await requireUser();
  await connectDb();
  return recordResult(
    user.userId,
    input.sessionId,
    input.questionId,
    input.result,
  );
}

/** Clears the user's question progress for the given books (empty list = every book). */
export async function clearProgressAction(bookIds: string[]): Promise<{ cleared: number }> {
  const ids = z.array(objectId).max(100).parse(bookIds);
  const user = await requireUser();
  await connectDb();
  return { cleared: await clearQuestionProgress(user.userId, ids) };
}

export async function finishQuizAction(sessionId: string): Promise<void> {
  const id = objectId.parse(sessionId);
  const user = await requireUser();
  await connectDb();
  await finishSession(user.userId, id);
}

/** Runs an AI call, turning failures into a message (thrown errors are masked in production). */
async function aiCall<T>(work: (userId: string) => Promise<T>): Promise<AiResult<T>> {
  const user = await requireUser();
  try {
    await connectDb();
    return { ok: true, value: await work(user.userId) };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    console.error("AI coach failed", error);
    return { ok: false, error: "The AI coach failed. Try again." };
  }
}

/** The message for the first invalid field, so the learner fixes the right thing. */
function inputError(error: z.ZodError, messages: Record<string, string>): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  return messages[field] ?? "This quiz is out of date. Reload the page and try again.";
}

export async function gradeAnswerAction(
  sessionId: string,
  questionId: string,
  answer: string,
): Promise<AiResult<AiGrade>> {
  const input = z
    .object({ sessionId: objectId, questionId: objectId, answer: z.string().trim().min(1).max(AI_ANSWER_MAX) })
    .safeParse({ sessionId, questionId, answer });
  if (!input.success) {
    return {
      ok: false,
      error: inputError(input.error, {
        answer: answer?.trim() ? `Keep your answer under ${AI_ANSWER_MAX} characters.` : "Type an answer first.",
      }),
    };
  }
  const { data } = input;
  return aiCall((userId) => gradeAnswer(userId, data.sessionId, data.questionId, data.answer));
}

export async function askFollowUpAction(
  sessionId: string,
  questionId: string,
  followUp: { conversationId?: string; message: string; answer?: string },
): Promise<AiResult<AiReply>> {
  const input = z
    .object({
      sessionId: objectId,
      questionId: objectId,
      conversationId: objectId.optional(),
      message: z.string().trim().min(1).max(AI_MESSAGE_MAX),
      answer: z.string().max(AI_ANSWER_MAX).optional(),
    })
    .safeParse({ sessionId, questionId, ...followUp });
  if (!input.success) {
    return {
      ok: false,
      error: inputError(input.error, {
        message: followUp?.message?.trim() ? `Keep messages under ${AI_MESSAGE_MAX} characters.` : "Type a message first.",
        answer: `Keep your answer under ${AI_ANSWER_MAX} characters.`,
        conversationId: "This conversation has expired. Reload the page to start a new one.",
      }),
    };
  }
  const { sessionId: sid, questionId: qid, ...rest } = input.data;
  return aiCall((userId) => askFollowUp(userId, sid, qid, rest));
}
