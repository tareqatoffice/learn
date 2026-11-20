"use server";

import { type ActionResult, fail, ok } from "@/features/admin/result";
import { deleteAllIeltsData } from "@/features/ielts/data";
import { deleteBandEntry, saveCalculatorResult, type CalculatorInput } from "@/features/ielts/bandHistory";
import type { Skill } from "@/features/ielts/bands";
import { endPlan, previewProfile, saveProfile, type ProfileInput } from "@/features/ielts/profile";
import { deleteStudyLog, logStudy, studyLogDateError } from "@/features/ielts/progress";
import { approveSuggestion, dismissSuggestion, removeAdjustment } from "@/features/ielts/suggestions";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";


async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

async function today(): Promise<string> {
  return localDate(new Date(), await readTimeZone());
}

export async function previewProfileAction(input: ProfileInput) {
  return previewProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function saveProfileAction(input: ProfileInput) {
  return saveProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function endPlanAction(): Promise<ActionResult> {
  return endPlan(await session());
}

export async function logStudyAction(skill: Skill, minutes: number, date?: string): Promise<ActionResult> {
  const userId = await session();
  const now = await today();
  const day = date ?? now;
  const dateError = studyLogDateError(day, now);
  if (dateError) return fail({ date: dateError });
  return logStudy(userId, { date: day, skill, minutes });
}

export async function deleteStudyLogAction(id: string): Promise<ActionResult> {
  return deleteStudyLog(await session(), id);
}

export async function approveSuggestionAction(id: string) {
  const userId = await session();
  return approveSuggestion(userId, id, await today());
}

export async function dismissSuggestionAction(id: string): Promise<ActionResult> {
  return dismissSuggestion(await session(), id);
}

export async function removeAdjustmentAction(adjustmentId: string): Promise<ActionResult> {
  const userId = await session();
  return removeAdjustment(userId, adjustmentId, await today());
}

export async function saveCalculatorResultAction(input: CalculatorInput) {
  const userId = await session();
  return saveCalculatorResult(userId, input ?? ({} as CalculatorInput), await today());
}

export async function deleteBandEntryAction(id: string): Promise<ActionResult> {
  return deleteBandEntry(await session(), id);
}

export async function deleteAllIeltsDataAction(): Promise<ActionResult> {
  const userId = await session();
  try {
    await deleteAllIeltsData(userId);
  } catch (error) {
    console.error(`Couldn't delete the IELTS data of ${userId}`, error);
    return fail("Couldn't delete your recordings. Try again.");
  }
  return ok();
}
