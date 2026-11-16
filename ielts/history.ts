
import { connectDb } from "@/lib/db";
import { IeltsSpeakingAttempt } from "@/models";
import { CRITERIA, type Criterion, SKILLS, type Skill } from "@/ielts/bands";
import { listBandEntries, type BandSource } from "@/ielts/bandHistory";
import { planVersionsForChart } from "@/ielts/profile";
import { weekProgress } from "@/ielts/progress";
import { localDate } from "@/speaking/schedule";

export type BandPoint = { date: string; source: BandSource; listening?: number; reading?: number; writing?: number; speaking?: number; overall?: number };

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

export async function weeklyMinutes(userId: string, timeZone: string): Promise<WeekMinutes[]> {
  const plans = await planVersionsForChart(userId);
  if (!plans.length) return [];
  const today = localDate(new Date(), timeZone);
  const started = plans.flatMap((plan, v) => {
    const until = plans[v + 1]?.startDate;
    return plan.weeks
      .map((w, i) => ({ plan, w, i }))
      .filter(({ w }) => w.start <= today && w.start >= plan.startDate && (until === undefined || w.start < until));
  });
  const progress = await Promise.all(started.map(({ plan, i }) => weekProgress(userId, plan, i, timeZone)));
  return started.map(({ w }, k) => ({
    weekStart: w.start,
    target: Object.fromEntries(SKILLS.map((s) => [s, w.minutes[s]])) as Record<Skill, number>,
    done: Object.fromEntries(SKILLS.map((s) => [s, Math.round(progress[k].done[s])])) as Record<Skill, number>,
  }));
}
