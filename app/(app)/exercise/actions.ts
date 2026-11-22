"use server";

import type { ActionResult } from "@/features/admin/result";
import { requireUser } from "@/features/auth/lib/authz";
import { type ProfileInput, previewGoal, saveProfile, startKeepFit } from "@/features/exercise/profile";
import { finishSession, saveSet, startSession } from "@/features/exercise/sessions";
import { deleteWeight, logWeight } from "@/features/exercise/weights";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";
import type { Feel } from "@/models/exerciseConstants";

async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

async function today(): Promise<string> {
  return localDate(new Date(), await readTimeZone());
}

const usable = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export async function previewGoalAction(input: ProfileInput) {
  await session();
  const ok =
    usable(input?.heightCm) &&
    usable(input.birthYear) &&
    usable(input.startWeightKg) &&
    usable(input.goalWeightKg) &&
    Number.isInteger(input.months) &&
    input.months >= 1 &&
    input.months <= 24 &&
    Array.isArray(input.workoutDays);
  return ok ? previewGoal(input, await today()) : null;
}

export async function saveProfileAction(input: ProfileInput) {
  return saveProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function logWeightAction(date: string, kg: number): Promise<ActionResult> {
  return logWeight(await session(), date, kg, await today());
}

export async function deleteWeightAction(date: string): Promise<ActionResult> {
  return deleteWeight(await session(), date);
}

export async function startKeepFitAction() {
  return startKeepFit(await session(), await today());
}

export async function startSessionAction(date: string) {
  return startSession(await session(), date);
}

export async function saveSetAction(date: string, index: number, action: "done" | "skip" | "back") {
  return saveSet(await session(), date, index, action);
}

export async function finishSessionAction(date: string, feels: Record<string, Feel>) {
  return finishSession(await session(), date, feels);
}
