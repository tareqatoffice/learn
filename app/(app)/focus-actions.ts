"use server";

import type { ActionResult } from "@/features/admin/result";
import { requireUser } from "@/features/auth/lib/authz";
import {
  type FocusCheckinInput,
  type FocusSessionInput,
  type FocusToday,
  getFocusToday,
  rateFocusSession,
  saveFocusSession,
} from "@/features/focus/sessions";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";

async function context() {
  const user = await requireUser();
  await connectDb();
  return { userId: user.userId, timeZone: await readTimeZone() };
}

export async function saveFocusSessionAction(input: FocusSessionInput): Promise<ActionResult<{ id: string }>> {
  const { userId, timeZone } = await context();
  return saveFocusSession(userId, input, { timeZone });
}

export async function rateFocusSessionAction(input: FocusCheckinInput): Promise<ActionResult> {
  const { userId } = await context();
  return rateFocusSession(userId, input);
}

export async function focusTodayAction(): Promise<FocusToday> {
  const { userId, timeZone } = await context();
  return getFocusToday(userId, localDate(new Date(), timeZone));
}
