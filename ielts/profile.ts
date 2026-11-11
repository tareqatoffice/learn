import { z } from "zod";
import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { IeltsPlan, IeltsProfile } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { isHalfBand, SKILLS, type Criterion } from "@/ielts/bands";
import { generatePlan, type Adjustment, type BandSet, type Hours, type Phase, type PlanInputs, type Week } from "@/ielts/plan";
import { getIeltsSettings } from "@/ielts/settings";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANGED_REASON = "You changed your profile";

const band = z
  .number()
  .min(4, "Bands run from 4.0 to 9.0.")
  .max(9, "Bands run from 4.0 to 9.0.")
  .refine(isHalfBand, "Bands go in steps of 0.5.");

export const profileInput = z.object({
  testDate: z.string().regex(DATE, "Enter the test date as YYYY-MM-DD."),
  target: z.object({
    overall: band,
    listening: band.optional(),
    reading: band.optional(),
    writing: band.optional(),
    speaking: band.optional(),
  }),
  current: z
    .object({
      overall: band.optional(),
      listening: band.optional(),
      reading: band.optional(),
      writing: band.optional(),
      speaking: band.optional(),
    })
    .default({}),
  minutesPerDay: z.number().int("Minutes per day must be a whole number.").min(10, "Study at least 10 minutes a day.").max(480, "Study at most 480 minutes a day."),
  studyDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Pick at least one study day.")
    .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  examinerVoice: z.boolean().optional(),
  mockVideo: z.boolean().optional(),
  drillVideo: z.boolean().optional(),
});

export type ProfileInput = z.input<typeof profileInput>;

type Bands = Partial<Record<"overall" | (typeof SKILLS)[number], number>>;

export type ProfileView = {
  testDate: string;
  target: BandSet;
  current: Bands;
  minutesPerDay: number;
  studyDays: number[];
  status: "active" | "ended";
  examinerVoice: boolean;
  mockVideo: boolean;
  drillVideo: boolean;
  createdAt: string;
};

export type AdjustmentView = Omit<Adjustment, "createdAt"> & { createdAt: string };

export type PlanView = {
  version: number;
  reason: string;
  createdAt: string;
  phases: Phase[];
  weeks: Week[];
  hours: Hours;
  adjustments: AdjustmentView[];
};

type PlanDoc = {
  version: number;
  reason: string;
  createdAt: Date;
  phases: Phase[];
  weeks: Week[];
  hours: Hours;
  adjustments?: Adjustment[];
};

/** Only the bands that are set, so Mongoose's undefined fields never leak out. */
function pickBands(b: Bands | undefined): Bands {
  const out: Bands = {};
  for (const k of ["overall", ...SKILLS] as const) if (typeof b?.[k] === "number") out[k] = b[k];
  return out;
}

const iso = (d: Date | string | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

function adjustmentView(a: Adjustment): AdjustmentView {
  const view: AdjustmentView = { id: a.id, kind: a.kind, createdAt: iso(a.createdAt) };
  if (a.criterion !== undefined) view.criterion = a.criterion as Criterion;
  if (a.share !== undefined) view.share = a.share;
  if (a.minutes !== undefined) view.minutes = a.minutes;
  if (a.fromWeek !== undefined) view.fromWeek = a.fromWeek;
  return view;
}

function planView(doc: PlanDoc): PlanView {
  return {
    version: doc.version,
    reason: doc.reason,
    createdAt: iso(doc.createdAt),
    phases: doc.phases.map((p) => ({ name: p.name, start: p.start, end: p.end })),
    weeks: doc.weeks.map((w) => ({
      start: w.start,
      end: w.end,
      minutes: Object.fromEntries(SKILLS.map((s) => [s, w.minutes[s] ?? 0])) as Week["minutes"],
      mocks: w.mocks ?? 0,
      ...(w.focus ? { focus: w.focus } : {}),
    })),
    hours: { needed: doc.hours.needed, available: doc.hours.available, short: Boolean(doc.hours.short) },
    adjustments: (doc.adjustments ?? []).map(adjustmentView),
  };
}

/** Plan inputs from a profile (validated input or stored view). */
export function toPlanInputs(
  data: Pick<z.output<typeof profileInput>, "testDate" | "target" | "current" | "minutesPerDay" | "studyDays">,
  today: string,
): PlanInputs {
  const current = pickBands(data.current);
  return {
    today,
    testDate: data.testDate,
    minutesPerDay: data.minutesPerDay,
    studyDays: data.studyDays,
    target: pickBands(data.target) as BandSet,
    current,
    currentUnknown: current.overall === undefined,
  };
}

function validate(input: ProfileInput, today: string): { data: z.output<typeof profileInput> } | { errors: ActionResult } {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.length ? String(i.path[0]) : "_"] ??= i.message;
    return { errors: fail(errors) };
  }
  if (parsed.data.testDate <= today) return { errors: fail({ testDate: "Pick a test date after today." }) };
  if (Number.isNaN(Date.parse(`${parsed.data.testDate}T00:00:00Z`))) return { errors: fail({ testDate: "That test date isn't a real date." }) };
  return { data: parsed.data };
}

export async function getProfile(userId: string): Promise<ProfileView | null> {
  await connectDb();
  const doc = await IeltsProfile.findOne({ userId }).lean<
    Omit<ProfileView, "createdAt" | "target" | "current"> & { target: Bands; current?: Bands; createdAt: Date }
  >();
  if (!doc) return null;
  return {
    testDate: doc.testDate,
    target: pickBands(doc.target) as BandSet,
    current: pickBands(doc.current),
    minutesPerDay: doc.minutesPerDay,
    studyDays: doc.studyDays,
    status: doc.status,
    examinerVoice: doc.examinerVoice,
    mockVideo: doc.mockVideo,
    drillVideo: doc.drillVideo,
    createdAt: iso(doc.createdAt),
  };
}

async function latestPlanDoc(userId: string): Promise<PlanDoc | null> {
  return IeltsPlan.findOne({ userId }).sort({ version: -1 }).lean<PlanDoc>();
}

export async function currentPlan(userId: string): Promise<PlanView | null> {
  await connectDb();
  const doc = await latestPlanDoc(userId);
  return doc ? planView(doc) : null;
}

export type PlanPreview = { before: PlanView | null; after: PlanView; dropped: Adjustment[] };

type PlanCtx = { metCriteria?: Criterion[] };

async function buildPreview(
  prev: PlanDoc | null,
  inputs: PlanInputs,
  adjustments: Adjustment[],
  reason: string,
  ctx: PlanCtx,
): Promise<PlanPreview> {
  const settings = await getIeltsSettings();
  const plan = generatePlan(inputs, adjustments, settings, ctx);
  const after = planView({
    version: (prev?.version ?? 0) + 1,
    reason,
    createdAt: new Date(),
    phases: plan.phases,
    weeks: plan.weeks,
    hours: plan.hours,
    adjustments: plan.kept,
  });
  return { before: prev ? planView(prev) : null, after, dropped: plan.dropped };
}

/** What the next version would look like, against the current one. Writes nothing. */
export async function previewPlan(
  userId: string,
  inputs: PlanInputs,
  adjustments: Adjustment[],
  reason: string,
  ctx: PlanCtx = {},
): Promise<PlanPreview> {
  await connectDb();
  return buildPreview(await latestPlanDoc(userId), inputs, adjustments, reason, ctx);
}

export async function previewProfile(userId: string, input: ProfileInput, today: string): Promise<ActionResult<PlanPreview>> {
  const v = validate(input, today);
  if ("errors" in v) return v.errors as ActionResult<never>;
  await connectDb();
  const prev = await latestPlanDoc(userId);
  return ok(await buildPreview(prev, toPlanInputs(v.data, today), prev?.adjustments ?? [], CHANGED_REASON, {}));
}

/** Generates a plan from `inputs` and stores it as the next version. Returns the new version number. */
export async function writePlanVersion(
  userId: string,
  inputs: PlanInputs,
  adjustments: Adjustment[],
  reason: string,
  ctx: PlanCtx = {},
): Promise<number> {
  await connectDb();
  const settings = await getIeltsSettings();
  const plan = generatePlan(inputs, adjustments, settings, ctx);
  return retryOnDuplicateKey(async () => {
    const last = await IeltsPlan.findOne({ userId }).sort({ version: -1 }).select("version").lean<{ version: number }>();
    const version = (last?.version ?? 0) + 1;
    await IeltsPlan.create({
      userId,
      version,
      startDate: inputs.today,
      testDate: inputs.testDate,
      inputs,
      adjustments: plan.kept,
      phases: plan.phases,
      weeks: plan.weeks,
      hours: plan.hours,
      reason,
    });
    return version;
  });
}

export async function saveProfile(userId: string, input: ProfileInput, today: string): Promise<ActionResult<{ version: number }>> {
  const v = validate(input, today);
  if ("errors" in v) return v.errors as ActionResult<never>;
  const { data } = v;
  await connectDb();
  const prev = await latestPlanDoc(userId);
  await IeltsProfile.updateOne(
    { userId },
    {
      $set: {
        testDate: data.testDate,
        target: pickBands(data.target),
        current: pickBands(data.current),
        minutesPerDay: data.minutesPerDay,
        studyDays: data.studyDays,
        status: "active",
        ...(data.examinerVoice !== undefined ? { examinerVoice: data.examinerVoice } : {}),
        ...(data.mockVideo !== undefined ? { mockVideo: data.mockVideo } : {}),
        ...(data.drillVideo !== undefined ? { drillVideo: data.drillVideo } : {}),
      },
    },
    { upsert: true },
  );
  const version = await writePlanVersion(userId, toPlanInputs(data, today), prev?.adjustments ?? [], CHANGED_REASON);
  return ok({ version });
}

export async function endPlan(userId: string): Promise<ActionResult> {
  await connectDb();
  const res = await IeltsProfile.updateOne({ userId }, { $set: { status: "ended" } });
  if (!res.matchedCount) return fail("You don't have an IELTS plan to end.");
  return ok();
}
