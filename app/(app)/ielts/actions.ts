"use server";

import { type ActionResult, ok } from "@/admin/result";
import { deleteAllIeltsData } from "@/ielts/data";
import { deleteBandEntry, saveCalculatorResult, type CalculatorInput } from "@/ielts/bandHistory";
import type { Skill } from "@/ielts/bands";
import { endPlan, previewProfile, saveProfile, type ProfileInput } from "@/ielts/profile";
import { logStudy } from "@/ielts/progress";
import { approveSuggestion, dismissSuggestion, removeAdjustment } from "@/ielts/suggestions";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { localDate } from "@/speaking/schedule";
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

export async function previewProfileAction(input: ProfileInput) {
  return previewProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function saveProfileAction(input: ProfileInput) {
  return saveProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function endPlanAction(): Promise<ActionResult> {
  return endPlan(await session());
}

export async function logStudyAction(skill: Skill, minutes: number): Promise<ActionResult> {
  const userId = await session();
  return logStudy(userId, { date: await today(), skill, minutes });
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

/** The client asks for confirmation before calling this. */
export async function deleteAllIeltsDataAction(): Promise<ActionResult> {
  await deleteAllIeltsData(await session());
  return ok();
}
