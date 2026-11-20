"use server";

import { type ActionResult, fail, ok } from "@/features/admin/result";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import type { AiResult } from "@/features/progress/quizAi";
import { type BodyFeedback, type SpeechFeedback, bodyFeedback, generateMaterial, speechFeedback } from "@/features/speaking/coach";
import { swapLesson } from "@/features/speaking/lessons";
import { localDate } from "@/features/speaking/schedule";
import { saveProfile, setBodyConsent } from "@/features/speaking/settings";
import { type StartTakeInput, confirmTake, deleteAllTakes, deleteTake, getTake, saveSelfRating, startTake } from "@/features/speaking/takes";
import { readTimeZone } from "@/features/speaking/timezone";
import { framesInput, objectIdInput, selfRatingInput, shape, takeInput } from "@/lib/actionInput";

const BAD_REQUEST = "That request isn't valid. Reload the page and try again.";
import { transcribeTake } from "@/features/speaking/transcribe";


async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

export async function startTakeAction(input: StartTakeInput) {
  const userId = await session();
  const valid = shape(takeInput, input);
  if (!valid) return fail(BAD_REQUEST);
  const { task, lessonId, material, kind, mime, audioMime, size, audioSize } = valid as unknown as StartTakeInput;
  const date = localDate(new Date(), await readTimeZone());
  return startTake(userId, { task, date, lessonId: lessonId ?? null, material, kind, mime, audioMime, size, audioSize });
}

export async function confirmTakeAction(takeId: string, durationSec: number): Promise<ActionResult> {
  const userId = await session();
  if (!shape(objectIdInput, takeId) || typeof durationSec !== "number") return fail(BAD_REQUEST);
  return confirmTake(userId, takeId, durationSec);
}

export async function transcribeTakeAction(takeId: string): Promise<ActionResult<{ transcript: string }>> {
  return transcribeTake(await session(), takeId);
}

export async function saveSelfRatingAction(
  takeId: string,
  input: Parameters<typeof saveSelfRating>[2],
): Promise<ActionResult> {
  const userId = await session();
  const valid = shape(selfRatingInput, input);
  if (!valid || !shape(objectIdInput, takeId)) return fail(BAD_REQUEST);
  return saveSelfRating(userId, takeId, valid as Parameters<typeof saveSelfRating>[2]);
}

export async function speechFeedbackAction(takeId: string): Promise<AiResult<SpeechFeedback>> {
  return speechFeedback(await session(), takeId);
}

export async function bodyFeedbackAction(takeId: string, frames: string[]): Promise<AiResult<BodyFeedback>> {
  const userId = await session();
  if (!shape(framesInput, frames)) return { ok: false, error: BAD_REQUEST };
  return bodyFeedback(userId, takeId, frames);
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

export async function takeMediaUrlsAction(takeId: string): Promise<{ media: string; audio?: string } | null> {
  const take = await getTake(await session(), takeId);
  return take ? { media: take.mediaUrl, ...(take.audioUrl ? { audio: take.audioUrl } : {}) } : null;
}

export async function deleteAllTakesAction(): Promise<ActionResult<{ deleted: number }>> {
  const userId = await session();
  try {
    return ok({ deleted: await deleteAllTakes(userId) });
  } catch {
    return fail("Couldn't delete your recordings. Nothing was removed; try again.");
  }
}

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
