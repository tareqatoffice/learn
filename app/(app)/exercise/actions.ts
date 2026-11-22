"use server";

import { type ActionResult, fail } from "@/features/admin/result";
import { requireUser } from "@/features/auth/lib/authz";
import { type ProfileInput, getActiveProfile, previewGoal, saveProfile, startKeepFit } from "@/features/exercise/profile";
import { finishSession, saveSet } from "@/features/exercise/sessions";
import { deleteWeight, logWeight } from "@/features/exercise/weights";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";
import { FEELS, type Feel } from "@/models/exerciseConstants";

async function session(): Promise<string> {
  const user = await requireUser();
  await connectDb();
  return user.userId;
}

async function today(): Promise<string> {
  return localDate(new Date(), await readTimeZone());
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown): v is string => typeof v === "string" && DATE.test(v);

/** A workout can only be saved on the user's own current day. */
async function workoutDay(date: unknown): Promise<string> {
  if (!isDate(date) || date !== (await today())) throw new Error("Workouts can only be saved for today.");
  return date;
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
  if (!ok) return null;
  const userId = await session();
  return previewGoal(input, await today(), await getActiveProfile(userId));
}

export async function saveProfileAction(input: ProfileInput) {
  return saveProfile(await session(), input ?? ({} as ProfileInput), await today());
}

export async function logWeightAction(date: string, kg: number): Promise<ActionResult> {
  const userId = await session();
  if (!isDate(date)) return fail({ date: "Pick today or an earlier day." });
  return logWeight(userId, date, kg, await today());
}

export async function deleteWeightAction(date: string): Promise<ActionResult> {
  const userId = await session();
  if (!isDate(date)) return fail({ date: "Pick a valid day." });
  return deleteWeight(userId, date);
}

export async function startKeepFitAction() {
  return startKeepFit(await session(), await today());
}

export async function saveSetAction(date: string, index: number, action: "done" | "skip" | "back") {
  const userId = await session();
  await workoutDay(date);
  if (!Number.isInteger(index) || index < 0) throw new Error("No such exercise in this session.");
  if (action !== "done" && action !== "skip" && action !== "back") throw new Error("Unknown set action.");
  return saveSet(userId, date, index, action);
}

export async function finishSessionAction(date: string, feels: Record<string, Feel>) {
  const userId = await session();
  await workoutDay(date);
  const entries = feels && typeof feels === "object" && !Array.isArray(feels) ? Object.entries(feels) : null;
  if (!entries || !entries.every(([, f]) => FEELS.includes(f))) throw new Error("Invalid feedback for this workout.");
  return finishSession(userId, date, feels);
}
