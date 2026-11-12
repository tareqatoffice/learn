// Chart data for the IELTS history page: bands over time, mock criteria and weekly minutes.

import { connectDb } from "@/lib/db";
import { IeltsSpeakingAttempt } from "@/models";
import { CRITERIA, type Criterion, SKILLS, type Skill } from "@/ielts/bands";
import { listBandEntries, type BandSource } from "@/ielts/bandHistory";
import { currentPlan } from "@/ielts/profile";
import { weekProgress } from "@/ielts/progress";
import { localDate } from "@/speaking/schedule";

export type BandPoint = { date: string; source: BandSource; listening?: number; reading?: number; writing?: number; speaking?: number; overall?: number };

/** One point per band entry, oldest first. Official results stay their own source. */
export async function bandSeries(userId: string): Promise<BandPoint[]> {
  const entries = await listBandEntries(userId);
  return entries.map((e) => ({
    date: e.date,
    source: e.source,
    ...e.bands,
    ...(e.overall !== undefined ? { overall: e.overall } : {}),
  }));
}

export type CriteriaPoint = { date: string; self: Record<Criterion, number>; ai?: Record<Criterion, number> };

function allCriteria(v: Partial<Record<Criterion, unknown>> | undefined): Record<Criterion, number> | null {
  if (!v) return null;
  const out = {} as Record<Criterion, number>;
  for (const c of CRITERIA) {
    if (typeof v[c] !== "number") return null;
    out[c] = v[c] as number;
  }
  return out;
}

/** Criteria bands of completed mocks, oldest first. Drills are left out. */
export async function criteriaSeries(userId: string): Promise<CriteriaPoint[]> {
  await connectDb();
  const docs = await IeltsSpeakingAttempt.find({ userId, kind: "mock", status: "complete" })
    .sort({ date: 1, _id: 1 })
    .select("date self ai.bands")
    .lean<{ date: string; self?: Partial<Record<Criterion, number>>; ai?: { bands?: Partial<Record<Criterion, number>> } }[]>();
  const out: CriteriaPoint[] = [];
  for (const d of docs) {
    const self = allCriteria(d.self);
    if (!self) continue;
    const ai = allCriteria(d.ai?.bands);
    out.push({ date: d.date, self, ...(ai ? { ai } : {}) });
  }
  return out;
}

export type WeekMinutes = { weekStart: string; target: Record<Skill, number>; done: Record<Skill, number> };

/** Target and done minutes for each plan week that has started, in the learner's time zone. */
export async function weeklyMinutes(userId: string, timeZone: string): Promise<WeekMinutes[]> {
  const plan = await currentPlan(userId);
  if (!plan) return [];
  const today = localDate(new Date(), timeZone);
  const started = plan.weeks.map((w, i) => ({ w, i })).filter(({ w }) => w.start <= today);
  const progress = await Promise.all(started.map(({ i }) => weekProgress(userId, plan, i, timeZone)));
  return started.map(({ w }, k) => ({
    weekStart: w.start,
    target: Object.fromEntries(SKILLS.map((s) => [s, w.minutes[s]])) as Record<Skill, number>,
    done: Object.fromEntries(SKILLS.map((s) => [s, Math.round(progress[k].done[s])])) as Record<Skill, number>,
  }));
}
