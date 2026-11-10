import { connectDb } from "@/lib/db";
import { SpeakingProfile, SpeakingSettings } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { DEFAULT_TARGET_MIN, TASKS, TASK_LABEL, type TaskKey, VIDEO_DEFAULT } from "./tasks";

export type EffectiveSettings = {
  targets: Record<TaskKey, number>;
  enabled: Record<TaskKey, boolean>;
  video: Record<TaskKey, boolean>;
  bodyConsent: boolean;
};

const MIN_TARGET = 1;
const MAX_TARGET = 120;

type Lean<T> = { targets?: Partial<Record<TaskKey, number>>; enabled?: Partial<Record<TaskKey, boolean>>; video?: Partial<Record<TaskKey, boolean>> } & T;

const validTarget = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= MIN_TARGET && n <= MAX_TARGET;

function targetErrors(targets: Partial<Record<TaskKey, number>>) {
  const errors: Record<string, string> = {};
  for (const task of TASKS) {
    const value = targets[task];
    if (value !== undefined && !validTarget(value)) {
      errors[task] = `${TASK_LABEL[task]} target must be a whole number of minutes from ${MIN_TARGET} to ${MAX_TARGET}.`;
    }
  }
  return errors;
}

export async function getDefaults(): Promise<Record<TaskKey, number>> {
  await connectDb();
  const doc = await SpeakingSettings.findOne({ key: "default" }).lean<Lean<object>>();
  return {
    shadowing: doc?.targets?.shadowing ?? DEFAULT_TARGET_MIN.shadowing,
    readAloud: doc?.targets?.readAloud ?? DEFAULT_TARGET_MIN.readAloud,
    recordReview: doc?.targets?.recordReview ?? DEFAULT_TARGET_MIN.recordReview,
  };
}

export async function saveDefaults(targets: Record<TaskKey, number>): Promise<ActionResult> {
  const errors = targetErrors(targets);
  for (const task of TASKS) if (targets[task] === undefined && !errors[task]) errors[task] = `${TASK_LABEL[task]} target is required.`;
  if (Object.keys(errors).length) return fail(errors);
  await connectDb();
  await SpeakingSettings.updateOne({ key: "default" }, { $set: { targets } }, { upsert: true });
  return ok();
}

export async function getEffectiveSettings(userId: string): Promise<EffectiveSettings> {
  const defaults = await getDefaults();
  const profile = await SpeakingProfile.findOne({ userId }).lean<Lean<{ bodyConsentAt?: Date }>>();
  const pick = <V,>(own: Partial<Record<TaskKey, V>> | undefined, fallback: Record<TaskKey, V>) =>
    Object.fromEntries(TASKS.map((t) => [t, own?.[t] ?? fallback[t]])) as Record<TaskKey, V>;
  return {
    targets: pick(profile?.targets, defaults),
    enabled: pick(profile?.enabled, { shadowing: true, readAloud: true, recordReview: true }),
    video: pick(profile?.video, VIDEO_DEFAULT),
    bodyConsent: Boolean(profile?.bodyConsentAt),
  };
}

export async function saveProfile(
  userId: string,
  input: {
    targets?: Partial<Record<TaskKey, number>>;
    enabled?: Partial<Record<TaskKey, boolean>>;
    video?: Partial<Record<TaskKey, boolean>>;
  },
): Promise<ActionResult> {
  const errors = targetErrors(input.targets ?? {});
  if (Object.keys(errors).length) return fail(errors);
  const $set: Record<string, unknown> = {};
  for (const task of TASKS) {
    if (input.targets?.[task] !== undefined) $set[`targets.${task}`] = input.targets[task];
    if (input.enabled?.[task] !== undefined) $set[`enabled.${task}`] = Boolean(input.enabled[task]);
    if (input.video?.[task] !== undefined) $set[`video.${task}`] = Boolean(input.video[task]);
  }
  if (!Object.keys($set).length) return ok();
  await connectDb();
  await SpeakingProfile.updateOne({ userId }, { $set }, { upsert: true });
  return ok();
}

export async function setBodyConsent(userId: string, consent: boolean): Promise<void> {
  await connectDb();
  await SpeakingProfile.updateOne(
    { userId },
    consent ? { $set: { bodyConsentAt: new Date() } } : { $unset: { bodyConsentAt: "" } },
    { upsert: true },
  );
}
