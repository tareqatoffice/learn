"use server";

import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { confirmInput, recordingInput, shape } from "@/lib/actionInput";
import {
  confirmPart,
  deleteAttempt,
  finishAttempt,
  startAttempt,
  startPart,
  transcribePart,
  type Part,
  type StartPartInput,
} from "@/features/ielts/speaking/attempts";
import { generateQuestions, type Kind, type QuestionSet } from "@/features/ielts/speaking/questions";
import { aiEstimate, attemptBodyFeedback, saveSelfBands, type AiEstimate, type SelfBandsInput } from "@/features/ielts/speaking/score";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import type { AiResult } from "@/features/progress/quizAi";
import type { BodyFeedback } from "@/features/speaking/coach";
import { localDate } from "@/features/speaking/schedule";
import { setBodyConsent } from "@/features/speaking/settings";
import { readTimeZone } from "@/features/speaking/timezone";


async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

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
  const userId = await session();
  const valid = shape(recordingInput.extend({ part: z.string().max(5) }), input);
  if (!valid) return fail("That request isn't valid. Reload the page and try again.");
  return startPart(userId, attemptId, valid as StartPartInput);
}

export async function confirmPartAction(
  attemptId: string,
  part: Part,
  input: Parameters<typeof confirmPart>[3],
): Promise<ActionResult> {
  const userId = await session();
  if (!shape(confirmInput, input)) return fail("That request isn't valid. Reload the page and try again.");
  return confirmPart(userId, attemptId, part, input);
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
