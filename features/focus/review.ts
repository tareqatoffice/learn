import { Types } from "mongoose";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import {
  type BlockSuggestion,
  type HabitSession,
  type Streak,
  type WeekSummary,
  streakOf,
  suggestBlock,
  weekStartOf,
  weekSummary,
} from "@/features/focus/habit";
import { addDays } from "@/features/speaking/schedule";
import { retryOnDuplicateKey } from "@/lib/db";
import { FocusPlan, FocusReview, FocusSession } from "@/models";
import {
  FOCUS_DATE_RE,
  FOCUS_PLAN_ACTION_MAX,
  FOCUS_PLAN_MAX_MINUTES,
  FOCUS_PLAN_MIN_MINUTES,
  FOCUS_REVIEW_TEXT_MAX,
  FOCUS_TIME_RE,
} from "@/models/focusConstants";

const HISTORY_DAYS = 60;

export type ReviewAnswers = { helped: string; pulledAway: string; change: string };
export type FocusPlanView = { time: string; action: string; minutes: number; enabled: boolean };

export type FocusReviewData = {
  today: string;
  weekStart: string;
  isCurrentWeek: boolean;
  summary: WeekSummary;
  streak: Streak;
  block: BlockSuggestion;
  answers: ReviewAnswers | null;
  plan: FocusPlanView | null;
};

export async function getFocusPlan(userId: string): Promise<FocusPlanView | null> {
  const plan = await FocusPlan.findOne({ userId: new Types.ObjectId(userId) }, { time: 1, action: 1, minutes: 1, enabled: 1 }).lean<FocusPlanView>();
  return plan ? { time: plan.time, action: plan.action, minutes: plan.minutes, enabled: plan.enabled !== false } : null;
}

export async function getFocusReview(userId: string, today: string, weekStart: string): Promise<FocusReviewData> {
  const id = new Types.ObjectId(userId);
  const since = [addDays(today, -(HISTORY_DAYS - 1)), weekStart].sort()[0];
  const [rows, review, plan] = await Promise.all([
    FocusSession.find(
      { userId: id, date: { $gte: since, $lte: today } },
      { date: 1, seconds: 1, completed: 1, targetMinutes: 1, rating: 1, distraction: 1, drifts: 1 },
    ).lean<HabitSession[]>(),
    FocusReview.findOne({ userId: id, weekStart }, { helped: 1, pulledAway: 1, change: 1 }).lean<ReviewAnswers>(),
    getFocusPlan(userId),
  ]);
  return {
    today,
    weekStart,
    isCurrentWeek: weekStart === weekStartOf(today),
    summary: weekSummary(rows, weekStart),
    streak: streakOf(rows.map((r) => r.date), today),
    block: suggestBlock(rows, today),
    answers: review ? { helped: review.helped ?? "", pulledAway: review.pulledAway ?? "", change: review.change ?? "" } : null,
    plan,
  };
}

export const reviewInput = z.object({
  helped: z.string().trim().max(FOCUS_REVIEW_TEXT_MAX),
  pulledAway: z.string().trim().max(FOCUS_REVIEW_TEXT_MAX),
  change: z.string().trim().max(FOCUS_REVIEW_TEXT_MAX),
});
export type ReviewInput = z.infer<typeof reviewInput>;

export async function saveWeeklyReview(
  userId: string,
  weekStart: string,
  input: ReviewInput,
  { today }: { today: string },
): Promise<ActionResult> {
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return fail("Those answers are too long, so they weren't saved.");
  const thisWeek = weekStartOf(today);
  const allowed = [thisWeek, addDays(thisWeek, -7)];
  if (!FOCUS_DATE_RE.test(weekStart) || !allowed.includes(weekStart)) {
    return fail("You can only review this week or last week.");
  }
  await retryOnDuplicateKey(() =>
    FocusReview.updateOne({ userId, weekStart }, { $set: parsed.data }, { upsert: true, runValidators: true }),
  );
  return ok();
}

export const planInput = z.object({
  time: z.string().regex(FOCUS_TIME_RE),
  action: z.string().trim().min(1).max(FOCUS_PLAN_ACTION_MAX),
  minutes: z.number().int().min(FOCUS_PLAN_MIN_MINUTES).max(FOCUS_PLAN_MAX_MINUTES),
  enabled: z.boolean(),
});
export type PlanInput = z.infer<typeof planInput>;

export async function saveFocusPlan(userId: string, input: PlanInput): Promise<ActionResult> {
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return fail("That plan isn't valid. Check the time, what you will do and the minutes.");
  await retryOnDuplicateKey(() =>
    FocusPlan.updateOne({ userId }, { $set: parsed.data }, { upsert: true, runValidators: true }),
  );
  return ok();
}
