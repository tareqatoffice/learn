"use server";

import { type ActionResult, ok } from "@/admin/result";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import type { AiResult } from "@/progress/quizAi";
import { type BodyFeedback, type SpeechFeedback, bodyFeedback, generateMaterial, speechFeedback } from "@/speaking/coach";
import { swapLesson } from "@/speaking/lessons";
import { localDate } from "@/speaking/schedule";
import { saveProfile, setBodyConsent } from "@/speaking/settings";
import { type StartTakeInput, confirmTake, deleteTake, saveSelfRating, startTake } from "@/speaking/takes";
import { readTimeZone } from "@/speaking/timezone";
import { transcribeTake } from "@/speaking/transcribe";

// Every action signs in first and acts as the session user; ids in the input never pick the user.

async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

export async function startTakeAction(input: StartTakeInput) {
  const userId = await session();
  const { task, date, lessonId, material, kind, mime, audioMime, clipSec, size, audioSize } = input ?? ({} as StartTakeInput);
  return startTake(userId, { task, date, lessonId: lessonId ?? null, material, kind, mime, audioMime, clipSec, size, audioSize });
}

export async function confirmTakeAction(takeId: string, durationSec: number): Promise<ActionResult> {
  return confirmTake(await session(), takeId, durationSec);
}

export async function transcribeTakeAction(takeId: string): Promise<ActionResult<{ transcript: string }>> {
  return transcribeTake(await session(), takeId);
}

export async function saveSelfRatingAction(
  takeId: string,
  input: Parameters<typeof saveSelfRating>[2],
): Promise<ActionResult> {
  return saveSelfRating(await session(), takeId, input);
}

export async function speechFeedbackAction(takeId: string): Promise<AiResult<SpeechFeedback>> {
  return speechFeedback(await session(), takeId);
}

export async function bodyFeedbackAction(takeId: string, frames: string[]): Promise<AiResult<BodyFeedback>> {
  return bodyFeedback(await session(), takeId, frames);
}

export async function generateMaterialAction(
  task: "readAloud" | "recordReview",
): Promise<AiResult<{ title: string; text?: string; prompt?: string }>> {
  const userId = await session();
  if (task !== "readAloud" && task !== "recordReview") return { ok: false, error: "Unknown task." };
  return generateMaterial(userId, task);
}

export async function deleteTakeAction(takeId: string): Promise<ActionResult> {
  return deleteTake(await session(), takeId);
}

/** Swaps today's lesson; "today" is the learner's local date, read from the time-zone cookie. */
export async function swapLessonAction(lessonId: string): Promise<ActionResult> {
  const userId = await session();
  const id = typeof lessonId === "string" ? lessonId : "";
  return swapLesson(userId, localDate(new Date(), await readTimeZone()), id);
}

export async function saveProfileAction(input: Parameters<typeof saveProfile>[1]): Promise<ActionResult> {
  return saveProfile(await session(), input ?? {});
}

export async function setBodyConsentAction(consent: boolean): Promise<ActionResult> {
  await setBodyConsent(await session(), consent === true);
  return ok();
}
