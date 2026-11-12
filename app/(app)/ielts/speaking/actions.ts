"use server";

import { type ActionResult, ok } from "@/admin/result";
import {
  confirmPart,
  deleteAttempt,
  finishAttempt,
  startAttempt,
  startPart,
  transcribePart,
  type Part,
  type StartPartInput,
} from "@/ielts/speaking/attempts";
import { generateQuestions, type Kind, type QuestionSet } from "@/ielts/speaking/questions";
import { aiEstimate, attemptBodyFeedback, saveSelfBands, type AiEstimate, type SelfBandsInput } from "@/ielts/speaking/score";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import type { AiResult } from "@/progress/quizAi";
import type { BodyFeedback } from "@/speaking/coach";
import { localDate } from "@/speaking/schedule";
import { setBodyConsent } from "@/speaking/settings";
import { readTimeZone } from "@/speaking/timezone";

// Every action signs in first and acts as the session user; ids in the input never pick the user.

async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

/** The learner's local date, from the time-zone cookie. */
async function today(): Promise<string> {
  return localDate(new Date(), await readTimeZone());
}

const KINDS: Kind[] = ["mock", "part1", "part2", "part3"];

export async function startAttemptAction(input: {
  kind: Kind;
  questions?: QuestionSet;
  generated?: boolean;
}): Promise<ActionResult<{ attemptId: string; questions: QuestionSet }>> {
  const userId = await session();
  const { kind, questions, generated } = input ?? ({} as typeof input);
  return startAttempt(userId, { kind, date: await today(), ...(questions ? { questions, generated: generated === true } : {}) });
}

export async function generateQuestionsAction(kind: Kind): Promise<AiResult<QuestionSet>> {
  const userId = await session();
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown practice type." };
  return generateQuestions(userId, kind);
}

export async function startPartAction(attemptId: string, input: StartPartInput) {
  return startPart(await session(), attemptId, input);
}

export async function confirmPartAction(
  attemptId: string,
  part: Part,
  input: Parameters<typeof confirmPart>[3],
): Promise<ActionResult> {
  return confirmPart(await session(), attemptId, part, input);
}

export async function transcribePartAction(attemptId: string, part: Part): Promise<ActionResult<{ transcript: string }>> {
  return transcribePart(await session(), attemptId, part);
}

export async function finishAttemptAction(attemptId: string, input: Parameters<typeof finishAttempt>[2]) {
  return finishAttempt(await session(), attemptId, input);
}

export async function saveSelfBandsAction(attemptId: string, input: SelfBandsInput): Promise<ActionResult<{ band: number }>> {
  const userId = await session();
  return saveSelfBands(userId, attemptId, input, await today());
}

export async function aiEstimateAction(attemptId: string): Promise<AiResult<AiEstimate>> {
  const userId = await session();
  return aiEstimate(userId, attemptId, await today());
}

export async function attemptBodyFeedbackAction(attemptId: string, frames: string[]): Promise<AiResult<BodyFeedback>> {
  return attemptBodyFeedback(await session(), attemptId, frames);
}

export async function deleteAttemptAction(attemptId: string): Promise<ActionResult> {
  return deleteAttempt(await session(), attemptId);
}

export async function setBodyConsentAction(consent: boolean): Promise<ActionResult> {
  await setBodyConsent(await session(), consent === true);
  return ok();
}
