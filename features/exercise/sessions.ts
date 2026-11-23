import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { WorkoutSession } from "@/models";
import { FEELS, type Feel } from "@/models/exerciseConstants";
import { addDays } from "@/features/speaking/schedule";
import { getActiveProfile } from "./profile";
import type { PlanDay } from "./plan";
import { dayPlan, plannedDates } from "./weeks";

export type SessionView = {
  date: string;
  status: "inProgress" | "done" | "abandoned";
  items: { exerciseId: string; setsDone: number; skipped: boolean; feel?: Feel }[];
};

const toView = (s: SessionView): SessionView => ({
  date: s.date,
  status: s.status,
  items: s.items.map((i) => ({
    exerciseId: i.exerciseId,
    setsDone: i.setsDone,
    skipped: i.skipped,
    ...(i.feel ? { feel: i.feel } : {}),
  })),
});

/** The day's session if one exists; never creates one. */
export async function getSession(userId: string, date: string): Promise<SessionView | null> {
  await connectDb();
  const doc = await WorkoutSession.findOne({ userId, date }).lean<SessionView>();
  return doc ? toView(doc) : null;
}

export async function startSession(userId: string, date: string): Promise<SessionView | null> {
  await connectDb();
  const existing = await WorkoutSession.findOne({ userId, date }).lean<SessionView>();
  if (existing) return toView(existing);
  const [plan, profile] = await Promise.all([dayPlan(userId, date), getActiveProfile(userId)]);
  if (!plan || !profile) return null;
  const items = plan.items.map((i) => ({ exerciseId: i.exerciseId, setsDone: 0, skipped: false }));
  const doc = await retryOnDuplicateKey(() =>
    WorkoutSession.findOneAndUpdate(
      { userId, date },
      { $setOnInsert: { userId, profileId: profile.id, date, status: "inProgress", items, startedAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    ).lean<SessionView>(),
  );
  return toView(doc!);
}

export async function saveSet(
  userId: string,
  date: string,
  index: number,
  action: "done" | "skip" | "back",
): Promise<SessionView> {
  if (!Number.isInteger(index) || index < 0) throw new Error("No such exercise in this session.");
  if (action !== "done" && action !== "skip" && action !== "back") throw new Error("Unknown set action.");
  await connectDb();
  const session = await WorkoutSession.findOne({ userId, date });
  if (!session) throw new Error("No session started for that day.");
  const item = session.items[index];
  if (!item) throw new Error("No such exercise in this session.");
  if (session.status !== "inProgress") return toView(session.toObject() as SessionView);
  const plan = await dayPlan(userId, date);
  const sets = plan?.items[index]?.sets ?? item.setsDone;
  if (action === "done") item.setsDone = Math.min(sets, item.setsDone + 1);
  else if (action === "skip") item.skipped = true;
  else {
    item.setsDone = Math.max(0, item.setsDone - 1);
    item.skipped = false;
  }
  // Once every exercise is finished or skipped the workout counts as done, without waiting for the Finish tap.
  if (plan && plan.items.every((p, i) => session.items[i]?.skipped || (session.items[i]?.setsDone ?? 0) >= p.sets)) {
    // A workout where every exercise was skipped and no set was done earns no credit.
    session.status = session.items.some((i: { setsDone: number }) => i.setsDone > 0) ? "done" : "abandoned";
    session.finishedAt = new Date();
  }
  await session.save();
  return toView(session.toObject() as SessionView);
}

/** Records how each exercise felt. Moves an in-progress session to done; on a done session it only updates feels. */
export async function finishSession(userId: string, date: string, feels: Record<string, Feel>): Promise<SessionView> {
  await connectDb();
  const session = await WorkoutSession.findOne({ userId, date });
  if (!session) throw new Error("No session started for that day.");
  if (session.status === "abandoned") return toView(session.toObject() as SessionView);
  const known = new Set(session.items.map((i: { exerciseId: string }) => i.exerciseId));
  for (const [id, feel] of Object.entries(feels)) {
    if (!known.has(id) || !FEELS.includes(feel)) throw new Error("Invalid feedback for this workout.");
  }
  for (const item of session.items) {
    const feel = feels[item.exerciseId];
    if (feel) item.feel = feel;
  }
  if (session.status === "inProgress") {
    session.status = "done";
    session.finishedAt = new Date();
  }
  await session.save();
  return toView(session.toObject() as SessionView);
}

export function resumePoint(s: SessionView, plan: PlanDay): { item: number; set: number } | null {
  for (let i = 0; i < plan.items.length; i++) {
    const state = s.items[i];
    if (!state || state.skipped) continue;
    if (state.setsDone < plan.items[i].sets) return { item: i, set: state.setsDone };
  }
  return null;
}

export async function weekSummary(userId: string, weekStart: string): Promise<{ done: number; planned: number }> {
  await connectDb();
  const end = addDays(weekStart, 6);
  const profile = await getActiveProfile(userId);
  if (!profile) return { done: 0, planned: 0 };
  const planned = await plannedDates(userId, profile, weekStart, end);
  // Only planned dates count, so done never exceeds planned (e.g. after a mid-week goal replacement).
  const done = await WorkoutSession.countDocuments({ userId, status: "done", date: { $in: planned } });
  return { done, planned: planned.length };
}

export async function streak(userId: string, today: string): Promise<number> {
  const profile = await getActiveProfile(userId);
  if (!profile) return 0;
  const dates = await plannedDates(userId, profile, profile.startDate, today);
  if (!dates.length) return 0;
  const rows = await WorkoutSession.find({ userId, status: "done", date: { $gte: dates[0], $lte: today } })
    .select("date")
    .lean<{ date: string }[]>();
  const done = new Set(rows.map((r) => r.date));
  let count = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (done.has(dates[i])) count++;
    else if (dates[i] !== today) break;
  }
  return count;
}

export async function doneDates(userId: string, from: string, to: string): Promise<string[]> {
  await connectDb();
  const rows = await WorkoutSession.find({ userId, status: "done", date: { $gte: from, $lte: to } })
    .select("date")
    .lean<{ date: string }[]>();
  return rows.map((r) => r.date);
}
