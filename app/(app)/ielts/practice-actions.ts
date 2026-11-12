"use server";

import { type ActionResult } from "@/admin/result";
import {
  deleteTestAttempt,
  saveAnswers,
  startTestAttempt,
  submitAttempt,
  type SubmitResult,
  type TestSkill,
} from "@/ielts/practice/attempts";
import {
  deleteWritingAttempt,
  saveWritingSelf,
  saveWritingText,
  startWritingAttempt,
  submitWriting,
  writingAiEstimate,
  type SelfInput,
  type WritingAi,
} from "@/ielts/writing/attempts";
import type { WritingKind } from "@/ielts/writing/bands";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import type { AiResult } from "@/progress/quizAi";
import { localDate } from "@/speaking/schedule";
import { readTimeZone } from "@/speaking/timezone";

// Every action signs in first and acts as the session user; ids in the input never pick the user.

async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

const today = async () => localDate(new Date(), await readTimeZone());

// ---- Listening and Reading ----

export async function startTestAction(skill: TestSkill, testId: string, scope: "full" | number): Promise<ActionResult<{ attemptId: string }>> {
  const userId = await session();
  return startTestAttempt(userId, { skill, testId, scope, date: await today() });
}

export async function saveAnswersAction(attemptId: string, answers: Record<string, string>): Promise<ActionResult> {
  return saveAnswers(await session(), attemptId, answers);
}

export async function submitAttemptAction(attemptId: string, answers: Record<string, string>): Promise<ActionResult<SubmitResult>> {
  return submitAttempt(await session(), attemptId, answers);
}

export async function deleteTestAttemptAction(attemptId: string): Promise<ActionResult> {
  return deleteTestAttempt(await session(), attemptId);
}

// ---- Writing ----

export async function startWritingAction(kind: WritingKind): Promise<ActionResult<{ attemptId: string }>> {
  const userId = await session();
  return startWritingAttempt(userId, { kind, date: await today() });
}

export async function saveWritingTextAction(attemptId: string, index: number, text: string, timeSec: number): Promise<ActionResult> {
  return saveWritingText(await session(), attemptId, index, text, timeSec);
}

export async function submitWritingAction(attemptId: string): Promise<ActionResult<{ short: string[] }>> {
  return submitWriting(await session(), attemptId);
}

export async function saveWritingSelfAction(attemptId: string, index: number, input: SelfInput): Promise<ActionResult<{ band: number }>> {
  return saveWritingSelf(await session(), attemptId, index, input);
}

export async function writingEstimateAction(attemptId: string, index: number): Promise<AiResult<WritingAi>> {
  return writingAiEstimate(await session(), attemptId, index);
}

export async function deleteWritingAction(attemptId: string): Promise<ActionResult> {
  return deleteWritingAttempt(await session(), attemptId);
}
