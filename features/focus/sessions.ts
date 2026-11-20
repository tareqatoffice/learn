import { Types } from "mongoose";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { isAppPath } from "@/features/focus/context";
import { localDate } from "@/features/speaking/schedule";
import { FocusSession } from "@/models";
import {
  FOCUS_AREAS,
  FOCUS_LABEL_MAX,
  FOCUS_MAX_SECONDS,
  FOCUS_MAX_TARGET_MINUTES,
  FOCUS_PATH_MAX,
  FOCUS_RUN_ID_MAX,
  type FocusArea,
} from "@/models/focusConstants";

/** How far back a run may have started (long pauses), and how far ahead a client clock may drift. */
const MAX_START_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const focusSessionInput = z.object({
  runId: z.string().trim().min(1).max(FOCUS_RUN_ID_MAX),
  startedAt: z.number().int().positive(),
  area: z.enum(FOCUS_AREAS),
  label: z.string().trim().min(1).max(FOCUS_LABEL_MAX),
  path: z.string().trim().max(FOCUS_PATH_MAX).refine(isAppPath, "Not an app path"),
  seconds: z.number().int().min(1).max(FOCUS_MAX_SECONDS),
  targetMinutes: z.number().int().min(1).max(FOCUS_MAX_TARGET_MINUTES).optional(),
  completed: z.boolean().optional(),
});
export type FocusSessionInput = z.infer<typeof focusSessionInput>;

export type FocusTodayItem = { path: string; label: string; area: FocusArea; seconds: number; sessions: number };
export type FocusToday = { totalSeconds: number; sessions: number; items: FocusTodayItem[] };

/**
 * Saves a finished run. Idempotent per `runId`: a retry or a second tab saving the same
 * run updates the one document instead of adding another. The day is the run's start day.
 */
export async function saveFocusSession(
  userId: string,
  input: FocusSessionInput,
  { now = new Date(), timeZone }: { now?: Date; timeZone: string },
): Promise<ActionResult<{ id: string }>> {
  const parsed = focusSessionInput.safeParse(input);
  if (!parsed.success) return fail("That focus session isn't valid, so it wasn't saved.");
  const { runId, startedAt, completed, ...rest } = parsed.data;
  const age = now.getTime() - startedAt;
  if (age < -MAX_CLOCK_SKEW_MS || age > MAX_START_AGE_MS) {
    return fail("That focus session's start time is off, so it wasn't saved.");
  }
  const start = new Date(Math.min(startedAt, now.getTime()));
  const doc = await FocusSession.findOneAndUpdate(
    { userId, runId },
    { $set: { ...rest, startedAt: start, date: localDate(start, timeZone), completed: completed ?? false } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean<{ _id: Types.ObjectId }>();
  return ok({ id: String(doc!._id) });
}

/** Today's focus time, grouped by page, most time first. */
export async function getFocusToday(userId: string, today: string): Promise<FocusToday> {
  const rows = await FocusSession.aggregate<{ _id: string; label: string; area: FocusArea; seconds: number; sessions: number }>([
    { $match: { userId: new Types.ObjectId(userId), date: today } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$path",
        label: { $first: "$label" },
        area: { $first: "$area" },
        seconds: { $sum: "$seconds" },
        sessions: { $sum: 1 },
      },
    },
    { $sort: { seconds: -1, _id: 1 } },
  ]);
  const items = rows.map(({ _id, ...r }) => ({ path: _id, ...r }));
  return {
    totalSeconds: items.reduce((n, i) => n + i.seconds, 0),
    sessions: items.reduce((n, i) => n + i.sessions, 0),
    items,
  };
}
