// Plan suggestions: the app proposes, the user approves. Checks only ever create pending
// suggestions; a plan version is written only by approveSuggestion (or the user's own
// removeAdjustment / profile edit).

import { randomUUID } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { connectDb, inTransaction } from "@/lib/db";
import { IeltsPlanSuggestion, IeltsProfile, IeltsSpeakingAttempt, SpeakingTake } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { CRITERIA, CRITERION_LABEL, SKILLS, speakingBand, type Criterion, type Skill } from "@/ielts/bands";
import { type Adjustment, generatePlan, hoursCheck, phaseOn, type PlanInputs, studyDaysBetween, type Week, weekOn } from "@/ielts/plan";
import {
  type AdjustmentView,
  currentPlan,
  getProfile,
  type PlanView,
  previewPlan,
  type ProfileView,
  toPlanInputs,
  writePlanVersion,
} from "@/ielts/profile";
import { dailyMinutes, weekProgress } from "@/ielts/progress";
import { getIeltsSettings, type IeltsSettingsView } from "@/ielts/settings";
import { addDays, localDate } from "@/speaking/schedule";

export type SuggestionKind = "missed" | "weak" | "hoursShort" | "phase" | "currentBand";

type Bands = Partial<Record<"overall" | Skill, number>>;

/**
 * Stored in `IeltsPlanSuggestion.proposal`. Empty for `hoursShort` and `phase`. `inputs.current`
 * holds only the bands that change; they are merged over the live profile when used.
 */
type Proposal = {
  inputs?: { minutesPerDay?: number; current?: Bands };
  adjustment?: Omit<Adjustment, "id" | "createdAt">;
};

export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  reason: string;
  preview: { before: PlanView; after: PlanView; dropped: Adjustment[] };
};

type SuggestionDoc = { _id: Types.ObjectId; kind: SuggestionKind; reason: string; proposal?: Proposal; forDate: string };
type Thresholds = IeltsSettingsView["thresholds"];
type Found = { kind: SuggestionKind; reason: string; proposal: Proposal };

const MAX_MINUTES = 480;
/** Spreading a shortfall may put at most this multiple of minutes per day on a study day. */
const DAY_CAP = 1.5;
/** A skill-building mock this close to target suggests starting mocks and polish early. */
const PHASE_GAP = 0.5;
const NOT_PENDING = "That suggestion isn't pending any more. Reload the page to see the current ones.";
const NO_PLAN = "You don't have an active IELTS plan. Set up your profile first.";

const total = (m: Record<Skill, number>) => SKILLS.reduce((n, s) => n + m[s], 0);
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const band = (n: number) => n.toFixed(1);
const fromView = (a: AdjustmentView): Adjustment => ({ ...a, createdAt: new Date(a.createdAt) });
const speakingTarget = (p: ProfileView) => p.target.speaking ?? p.target.overall;
const changesPlan = (p: Proposal) => Boolean(p.inputs || p.adjustment);
/**
 * `createdAt` for a new adjustment: now's time of day on `today`, so its UTC date is the day of
 * the rebuild it is made for (spreadShortfall is one-shot: ruling R12).
 */
const createdOn = (today: string) => new Date(`${today}T${new Date().toISOString().slice(11)}`);

type MockBands = { date: string; low: Partial<Record<Criterion, number>>; self: Partial<Record<Criterion, number>> };

/** The latest `n` complete mocks, newest first: per criterion min(self, AI), and the self rating alone. */
async function lastMocks(userId: string, n: number): Promise<MockBands[]> {
  type Row = { date: string; self?: Partial<Record<Criterion, number>>; ai?: { bands?: Partial<Record<Criterion, number>> } };
  const rows = await IeltsSpeakingAttempt.find({ userId, kind: "mock", status: "complete" })
    .sort({ date: -1, createdAt: -1 })
    .limit(n)
    .select("date self ai.bands")
    .lean<Row[]>();
  return rows.map((r) => {
    const out: MockBands = { date: r.date, low: {}, self: {} };
    for (const c of CRITERIA) {
      const self = r.self?.[c];
      const values = [self, r.ai?.bands?.[c]].filter((v): v is number => typeof v === "number");
      if (values.length) out.low[c] = Math.min(...values);
      if (typeof self === "number") out.self[c] = self;
    }
    return out;
  });
}

type PlanContext = { profile: ProfileView; plan: PlanView; inputs: PlanInputs; adjustments: Adjustment[]; met: Criterion[] };

/** Everything a rebuild from `today` needs; null without an active profile, a plan, or days left. */
async function planContext(userId: string, today: string): Promise<PlanContext | null> {
  const [profile, plan, [latest]] = await Promise.all([getProfile(userId), currentPlan(userId), lastMocks(userId, 1)]);
  if (!profile || !plan || profile.status !== "active" || profile.testDate <= today) return null;
  const target = speakingTarget(profile);
  return {
    profile,
    plan,
    inputs: toPlanInputs(profile, today),
    adjustments: plan.adjustments.map(fromView),
    // Shifts towards a criterion the latest mock already meets are dropped on rebuild.
    met: latest ? CRITERIA.filter((c) => (latest.low[c] ?? -Infinity) >= target) : [],
  };
}

/** Inputs and adjustments with `proposal` applied over the live profile, rebuilt from `today`. */
function applied(ctx: PlanContext, proposal: Proposal, today: string): { inputs: PlanInputs; adjustments: Adjustment[] } {
  const { minutesPerDay, current } = proposal.inputs ?? {};
  const inputs = toPlanInputs(
    {
      ...ctx.profile,
      ...(minutesPerDay !== undefined ? { minutesPerDay } : {}),
      current: { ...ctx.profile.current, ...current },
    },
    today,
  );
  const adjustments = proposal.adjustment
    ? [...ctx.adjustments, { ...proposal.adjustment, id: randomUUID(), createdAt: createdOn(today) }]
    : ctx.adjustments;
  return { inputs, adjustments };
}

function versionReason(p: Proposal): string {
  if (p.inputs?.minutesPerDay !== undefined) return `You approved ${p.inputs.minutesPerDay} minutes a day`;
  if (p.inputs?.current) return "You approved a new current band";
  if (p.adjustment?.kind === "shiftCriterion" && p.adjustment.criterion) {
    return `You approved more ${CRITERION_LABEL[p.adjustment.criterion]} drills`;
  }
  return "You approved spreading the minutes you missed";
}

/** Kinds not to raise now: one is pending, or one was dismissed in the last `dismissDays` days. */
async function quietKinds(userId: string, today: string, dismissDays: number): Promise<Set<SuggestionKind>> {
  const since = new Date(`${addDays(today, -dismissDays)}T00:00:00Z`);
  const rows = await IeltsPlanSuggestion.find({
    userId,
    $or: [{ status: "pending" }, { status: "dismissed", decidedAt: { $gte: since } }],
  })
    .select("kind")
    .lean<{ kind: SuggestionKind }[]>();
  return new Set(rows.map((r) => r.kind));
}

/**
 * `n` when the last `n` study days before today (within the plan) had no IELTS minutes and no
 * stored Speaking Practice take (counted from the profile's creation day), else 0.
 */
async function zeroStreak(userId: string, ctx: PlanContext, today: string, timeZone: string, n: number): Promise<number> {
  const start = ctx.plan.weeks[0]?.start;
  if (!start) return 0;
  const days: string[] = [];
  for (let d = addDays(today, -1); d >= start && days.length < n; d = addDays(d, -1)) {
    if (ctx.profile.studyDays.includes(weekday(d))) days.push(d);
  }
  if (days.length < n) return 0;
  const from = days[days.length - 1];
  const created = localDate(new Date(ctx.profile.createdAt), timeZone);
  const [totals, takes] = await Promise.all([
    dailyMinutes(userId, from, days[0]),
    SpeakingTake.find({ userId, "media.stored": true, date: { $gte: created > from ? created : from, $lte: days[0] } })
      .select("date")
      .lean<{ date: string }[]>(),
  ]);
  const practised = new Set(takes.map((t) => t.date));
  return days.every((d) => total(totals[d]) === 0 && !practised.has(d)) ? n : 0;
}

async function missedCheck(
  userId: string,
  ctx: PlanContext,
  today: string,
  timeZone: string,
  settings: IeltsSettingsView,
): Promise<Found | null> {
  const t = settings.thresholds;
  let shortfall = 0;
  let why = "";
  // "Last week" is the plan week before the one containing today.
  const here = weekOn(ctx.plan, today);
  if (here && here.index > 0) {
    const target = total(ctx.plan.weeks[here.index - 1].minutes);
    const done = total((await weekProgress(userId, ctx.plan, here.index - 1, timeZone)).done);
    if (target > 0 && done < target * t.missedShare) {
      shortfall = Math.round(target - done);
      why = `Last week you did ${Math.round((done / target) * 100)} % of the ${target} minutes planned.`;
    }
  }
  if (!shortfall) {
    const streak = await zeroStreak(userId, ctx, today, timeZone, t.missedStreak);
    if (streak) {
      shortfall = streak * ctx.profile.minutesPerDay;
      why = `You did nothing on your last ${streak} study days.`;
    }
  }
  if (shortfall <= 0) return null;

  // A rebuild starts today, so today's week is week 0 and the spread starts at week 1.
  const adjustment = { kind: "spreadShortfall" as const, minutes: shortfall, fromWeek: 1 };
  const plan = (extra: Adjustment[]) => generatePlan(ctx.inputs, [...ctx.adjustments, ...extra], settings, { metCriteria: ctx.met });
  const spread = plan([{ ...adjustment, id: "preview", createdAt: createdOn(today) }]);
  const studyDays = (w: Week) => studyDaysBetween(w.start, w.end, ctx.profile.studyDays);
  const cap = ctx.profile.minutesPerDay * DAY_CAP;
  const later = spread.weeks.slice(adjustment.fromWeek);
  const overloaded = later.length === 0 || later.some((w) => studyDays(w) > 0 && total(w.minutes) / studyDays(w) > cap);
  if (!overloaded) {
    return {
      kind: "missed",
      reason: `${why} This spreads the ${shortfall} minutes you missed over the weeks left.`,
      proposal: { adjustment },
    };
  }

  // Too much for some days: raise minutes per day so the study days left (today included) cover
  // all the planned minutes plus the shortfall.
  const weeks = plan([]).weeks;
  const days = weeks.reduce((n, w) => n + studyDays(w), 0);
  if (!days) return null;
  const needed = (weeks.reduce((n, w) => n + total(w.minutes), 0) + shortfall) / days;
  const minutesPerDay = Math.min(Math.ceil(needed / 5) * 5, MAX_MINUTES);
  if (minutesPerDay <= ctx.profile.minutesPerDay) return null;
  return {
    kind: "missed",
    reason:
      `${why} Spreading the ${shortfall} minutes you missed would put more than ${Math.round(cap)} minutes on some days, ` +
      `so this raises your daily study from ${ctx.profile.minutesPerDay} to ${minutesPerDay} minutes. ` +
      "A later test date also works: change it on your profile.",
    proposal: { inputs: { minutesPerDay } },
  };
}

async function weakCheck(userId: string, ctx: PlanContext, t: Thresholds): Promise<Found | null> {
  const mocks = await lastMocks(userId, 2);
  if (mocks.length < 2) return null;
  const target = speakingTarget(ctx.profile);
  const limit = target - t.weakGap;
  const low = (v: number | undefined) => v !== undefined && v <= limit;
  // Pronunciation is estimated from the transcript only, so it counts only when the learner's own rating agrees.
  const weak = CRITERIA.filter((c) => mocks.every((m) => low(m.low[c]) && (c !== "pronunciation" || low(m.self[c]))));
  if (!weak.length) return null;
  const avg = (c: Criterion) => mocks.reduce((n, m) => n + m.low[c]!, 0) / mocks.length;
  const criterion = weak.reduce((a, b) => (avg(b) < avg(a) ? b : a));
  const shifts = ctx.adjustments.filter((a) => a.kind === "shiftCriterion");
  const newest = shifts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).at(-1);
  if (newest?.criterion === criterion) return null;
  return {
    kind: "weak",
    reason:
      `${CRITERION_LABEL[criterion]} was ${band(limit)} or lower in your last 2 mocks (the lower of your rating and the AI estimate), ` +
      `at least ${band(t.weakGap)} below your Speaking target of ${band(target)}. ` +
      `This moves ${Math.round(t.shiftShare * 100)} % of your Speaking minutes to drills for it.`,
    proposal: { adjustment: { kind: "shiftCriterion", criterion, share: t.shiftShare } },
  };
}

function hoursShortCheck(ctx: PlanContext, today: string, lastCheck: string | undefined, settings: IeltsSettingsView): Found | null {
  const now = hoursCheck(ctx.inputs, settings);
  if (!now.short) return null;
  const was =
    lastCheck && lastCheck < today && lastCheck < ctx.profile.testDate
      ? hoursCheck({ ...ctx.inputs, today: lastCheck }, settings).short
      : ctx.plan.hours.short;
  if (was) return null;
  return {
    kind: "hoursShort",
    reason:
      `You have about ${Math.round(now.available)} study hours left, and your target needs about ${Math.round(now.needed)} ` +
      "(rough guide, not an official figure). You could study more minutes a day, pick a later test date or lower your target: " +
      "change any of them on your profile.",
    proposal: {},
  };
}

async function phaseCheck(userId: string, ctx: PlanContext, today: string): Promise<Found | null> {
  const phase = phaseOn(ctx.plan, today);
  const next = ctx.plan.phases.find((p) => p.name === "mocks");
  if (phase?.name !== "skills" || !next) return null;
  const [latest] = await lastMocks(userId, 1);
  if (!latest || latest.date < phase.start || CRITERIA.some((c) => latest.low[c] === undefined)) return null;
  const score = speakingBand(latest.low as Record<Criterion, number>);
  const target = speakingTarget(ctx.profile);
  if (score < target - PHASE_GAP) return null;
  // One phase suggestion per qualifying mock, whatever became of it.
  if (await IeltsPlanSuggestion.exists({ userId, kind: "phase", forDate: { $gte: latest.date } })) return null;
  return {
    kind: "phase",
    reason:
      `Your last mock came out at ${band(score)} (the lower of your rating and the AI estimate), within ${band(PHASE_GAP)} of your ` +
      `Speaking target of ${band(target)}. You could start mocks and polish early, with two full mocks a week. ` +
      `The plan itself moves to that phase on ${next.start}.`,
    proposal: {},
  };
}

/**
 * Runs the plan checks at most once per learner-local day (`profile.lastCheckDate`) and stores
 * what they find as pending suggestions. Never writes a plan version.
 */
export async function runChecks(userId: string, today: string, timeZone: string): Promise<void> {
  await connectDb();
  const claimed = await IeltsProfile.findOneAndUpdate(
    { userId, status: "active", testDate: { $gt: today }, lastCheckDate: { $ne: today } },
    { $set: { lastCheckDate: today } },
  )
    .select("lastCheckDate")
    .lean<{ lastCheckDate?: string }>();
  if (!claimed) return;
  const ctx = await planContext(userId, today);
  if (!ctx) return;
  const settings = await getIeltsSettings();
  const quiet = await quietKinds(userId, today, settings.thresholds.dismissDays);
  const checks: [SuggestionKind, () => Promise<Found | null> | Found | null][] = [
    ["missed", () => missedCheck(userId, ctx, today, timeZone, settings)],
    ["weak", () => weakCheck(userId, ctx, settings.thresholds)],
    ["hoursShort", () => hoursShortCheck(ctx, today, claimed.lastCheckDate, settings)],
    ["phase", () => phaseCheck(userId, ctx, today)],
  ];
  for (const [kind, check] of checks) {
    if (quiet.has(kind)) continue;
    const found = await check();
    if (found) await IeltsPlanSuggestion.create({ userId, ...found, forDate: today });
  }
}

/** Pending suggestions, oldest first, each with a before/after preview of a rebuild from `today`. */
export async function listPending(userId: string, today: string): Promise<SuggestionView[]> {
  await connectDb();
  const docs = await IeltsPlanSuggestion.find({ userId, status: "pending" }).sort({ createdAt: 1 }).lean<SuggestionDoc[]>();
  if (!docs.length) return [];
  const ctx = await planContext(userId, today);
  if (!ctx) return [];
  const out: SuggestionView[] = [];
  for (const d of docs) {
    const proposal = d.proposal ?? {};
    let preview: SuggestionView["preview"] = { before: ctx.plan, after: ctx.plan, dropped: [] };
    if (changesPlan(proposal)) {
      const { inputs, adjustments } = applied(ctx, proposal, today);
      const p = await previewPlan(userId, inputs, adjustments, versionReason(proposal), { metCriteria: ctx.met });
      preview = { before: ctx.plan, after: p.after, dropped: p.dropped };
    }
    out.push({ id: String(d._id), kind: d.kind, reason: d.reason, preview });
  }
  return out;
}

/**
 * Applies a pending suggestion and writes the next plan version. `hoursShort` and `phase` change
 * nothing: approving acknowledges them and returns the current version.
 */
export async function approveSuggestion(userId: string, id: string, today: string): Promise<ActionResult<{ version: number }>> {
  if (!isValidObjectId(id)) return fail(NOT_PENDING);
  await connectDb();
  const ctx = await planContext(userId, today);
  if (!ctx) return fail(NO_PLAN);
  // One transaction: a failed plan write leaves the suggestion pending and the profile unchanged.
  return inTransaction(async (session) => {
    const s = await IeltsPlanSuggestion.findOneAndUpdate(
      { _id: id, userId, status: "pending" },
      { $set: { status: "approved", decidedAt: new Date() } },
      { session },
    ).lean<SuggestionDoc>();
    if (!s) return fail(NOT_PENDING);
    const proposal = s.proposal ?? {};
    if (!changesPlan(proposal)) return ok({ version: ctx.plan.version });
    const { minutesPerDay, current } = proposal.inputs ?? {};
    const $set: Record<string, number> = {};
    if (minutesPerDay !== undefined) $set.minutesPerDay = minutesPerDay;
    for (const [k, v] of Object.entries(current ?? {})) $set[`current.${k}`] = v;
    if (Object.keys($set).length) await IeltsProfile.updateOne({ userId }, { $set }, { session });
    const { inputs, adjustments } = applied(ctx, proposal, today);
    const version = await writePlanVersion(userId, inputs, adjustments, versionReason(proposal), { metCriteria: ctx.met, session });
    return ok({ version });
  });
}

export async function dismissSuggestion(userId: string, id: string): Promise<ActionResult> {
  if (!isValidObjectId(id)) return fail(NOT_PENDING);
  await connectDb();
  const res = await IeltsPlanSuggestion.updateOne(
    { _id: id, userId, status: "pending" },
    { $set: { status: "dismissed", decidedAt: new Date() } },
  );
  return res.matchedCount ? ok() : fail(NOT_PENDING);
}

/** The user's own change: a new plan version without that standing adjustment. */
export async function removeAdjustment(userId: string, adjustmentId: string, today: string): Promise<ActionResult> {
  await connectDb();
  const ctx = await planContext(userId, today);
  if (!ctx) return fail(NO_PLAN);
  const rest = ctx.adjustments.filter((a) => a.id !== adjustmentId);
  if (rest.length === ctx.adjustments.length) return fail("That change isn't on your plan any more. Reload the page.");
  await writePlanVersion(userId, ctx.inputs, rest, "You removed a change from your plan", { metCriteria: ctx.met });
  return ok();
}

/**
 * Suggests updating the profile's current band. The proposal holds only the bands that change.
 * `official`: the entered result becomes the current band (replacing any pending current-band suggestion, and not held back by a recent
 * dismissal, since the user entered it). `mocks`: `bands.speaking` (the caller's figure from the
 * last 2 mocks) is suggested when it is at least `currentBandGap` from the profile's Speaking band.
 */
export async function suggestCurrentBand(userId: string, source: "official" | "mocks", bands: Bands, today: string): Promise<void> {
  await connectDb();
  const [profile, settings] = await Promise.all([getProfile(userId), getIeltsSettings()]);
  if (!profile || profile.status !== "active") return;
  const given: Bands = {};
  for (const k of ["overall", ...SKILLS] as const) if (typeof bands[k] === "number") given[k] = bands[k];

  if (source === "official") {
    const keys = Object.keys(given) as (keyof Bands)[];
    if (!keys.length || keys.every((k) => profile.current[k] === given[k])) return;
    const list = keys.map((k) => `${k} ${band(given[k]!)}`).join(", ");
    await IeltsPlanSuggestion.updateOne(
      { userId, kind: "currentBand", status: "pending" },
      {
        $set: {
          reason: `You entered an official result (${list}). This makes it your current band and rebuilds the plan.`,
          proposal: { inputs: { current: given } },
          forDate: today,
        },
      },
      { upsert: true },
    );
    return;
  }

  const speaking = given.speaking;
  if (speaking === undefined) return;
  const now = profile.current.speaking ?? profile.current.overall;
  if (now !== undefined && Math.abs(speaking - now) < settings.thresholds.currentBandGap) return;
  if ((await quietKinds(userId, today, settings.thresholds.dismissDays)).has("currentBand")) return;
  const from = now === undefined ? "" : `, against ${band(now)} on your profile`;
  await IeltsPlanSuggestion.create({
    userId,
    kind: "currentBand",
    reason: `Your last 2 mocks put your Speaking at about ${band(speaking)}${from}. This updates your current Speaking band and rebuilds the plan.`,
    proposal: { inputs: { current: { speaking } } },
    forDate: today,
  });
}
