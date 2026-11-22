import { connectDb, inTransaction, retryOnDuplicateKey } from "@/lib/db";
import { ExercisePlanWeek, ExerciseProfile, WeightEntry } from "@/models";
import { LEVELS, SEXES, type Level, type Sex } from "@/models/exerciseConstants";
import { type ActionResult, type FieldErrors, fail, ok } from "@/features/admin/result";
import {
  addMonths,
  ageFrom,
  calorieAdvice,
  goalReached,
  paceCheck,
  paceStatus,
  safeTargetDate,
  type GoalShape,
  weeklyPace,
  weeksBetween,
} from "./goal";
import { weekStartOf } from "./plan";

export type ProfileInput = {
  heightCm: number;
  birthYear: number;
  sex: Sex;
  level: Level;
  workoutDays: number[];
  minutesPerSession: number;
  startWeightKg: number;
  goalWeightKg: number;
  months: number;
};

export type ProfileView = GoalShape & {
  id: string;
  heightCm: number;
  birthYear: number;
  sex: Sex;
  level: Level;
  workoutDays: number[];
  minutesPerSession: number;
  status: "active" | "ended";
};

type ProfileDoc = Omit<ProfileView, "id"> & { _id: { toString(): string } };

function toView(doc: ProfileDoc): ProfileView {
  return {
    id: String(doc._id),
    heightCm: doc.heightCm,
    birthYear: doc.birthYear,
    sex: doc.sex,
    level: doc.level,
    workoutDays: doc.workoutDays,
    minutesPerSession: doc.minutesPerSession,
    startWeightKg: doc.startWeightKg,
    goalWeightKg: doc.goalWeightKg,
    startDate: doc.startDate,
    targetDate: doc.targetDate,
    status: doc.status,
  };
}

const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
const normalDays = (days: number[]) => [...new Set(days)].sort((a, b) => a - b);

export function previewGoal(
  input: ProfileInput,
  today: string,
): { targetDate: string; pace: number; check: "ok" | "warn" | "block"; safeTargetDate?: string; kcal: number } {
  const targetDate = addMonths(today, input.months);
  const pace = weeklyPace(input.startWeightKg, input.goalWeightKg, weeksBetween(today, targetDate));
  const check = paceCheck(pace);
  const kcal = calorieAdvice({
    kg: input.startWeightKg,
    heightCm: input.heightCm,
    age: ageFrom(input.birthYear, today),
    sex: input.sex,
    daysPerWeek: input.workoutDays.length,
    pace,
  });
  return {
    targetDate,
    pace,
    check,
    ...(check === "block" ? { safeTargetDate: safeTargetDate(today, input.startWeightKg, input.goalWeightKg) } : {}),
    kcal,
  };
}

function validate(input: ProfileInput, today: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!inRange(input.heightCm, 120, 230)) errors.heightCm = "Height must be between 120 and 230 cm.";
  if (!Number.isInteger(input.birthYear) || !inRange(ageFrom(input.birthYear, today), 16, 90)) {
    errors.birthYear = "You must be between 16 and 90 years old.";
  }
  if (!SEXES.includes(input.sex)) errors.sex = "Pick one of the options.";
  if (!LEVELS.includes(input.level)) errors.level = "Pick one of the options.";
  if (!inRange(input.startWeightKg, 30, 300)) errors.startWeightKg = "Weight must be between 30 and 300 kg.";
  if (!inRange(input.goalWeightKg, 30, 300)) errors.goalWeightKg = "Goal weight must be between 30 and 300 kg.";
  if (!Number.isInteger(input.months) || !inRange(input.months, 1, 24)) errors.months = "Choose 1 to 24 months.";
  const days = Array.isArray(input.workoutDays) ? input.workoutDays : [];
  const unique = new Set(days);
  if (days.length < 1 || days.length > 7 || unique.size !== days.length || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    errors.workoutDays = "Pick 1 to 7 different days.";
  }
  if (!Number.isInteger(input.minutesPerSession) || !inRange(input.minutesPerSession, 10, 60)) {
    errors.minutesPerSession = "Sessions run 10 to 60 minutes.";
  }
  return errors;
}

export async function getActiveProfile(userId: string): Promise<ProfileView | null> {
  await connectDb();
  const doc = await ExerciseProfile.findOne({ userId, status: "active" }).lean<ProfileDoc>();
  return doc ? toView(doc) : null;
}

export async function lastEndedProfile(userId: string): Promise<ProfileView | null> {
  await connectDb();
  const doc = await ExerciseProfile.findOne({ userId, status: "ended" }).sort({ updatedAt: -1, _id: -1 }).lean<ProfileDoc>();
  return doc ? toView(doc) : null;
}

export async function saveProfile(userId: string, input: ProfileInput, today: string): Promise<ActionResult<ProfileView>> {
  const errors = validate(input, today);
  if (Object.keys(errors).length) return fail(errors);
  await connectDb();

  const workoutDays = normalDays(input.workoutDays);
  const fields = {
    heightCm: input.heightCm,
    birthYear: input.birthYear,
    sex: input.sex,
    level: input.level,
    workoutDays,
    minutesPerSession: input.minutesPerSession,
  };
  const active = await ExerciseProfile.findOne({ userId, status: "active" });
  const targetDate = addMonths(today, input.months);

  const goalChanged =
    !active ||
    active.startWeightKg !== input.startWeightKg ||
    active.goalWeightKg !== input.goalWeightKg ||
    active.targetDate !== addMonths(active.startDate, input.months);

  if (goalChanged) {
    const pace = weeklyPace(input.startWeightKg, input.goalWeightKg, weeksBetween(today, targetDate));
    if (paceCheck(pace) === "block") {
      const safe = safeTargetDate(today, input.startWeightKg, input.goalWeightKg);
      return fail({ months: `That's faster than 1 kg a week. The earliest safe date is ${safe}.` });
    }
  }

  if (active && !goalChanged) {
    Object.assign(active, fields);
    await active.save();
    await ExercisePlanWeek.deleteMany({ userId, profileId: active._id, weekStart: { $gt: weekStartOf(today) } });
    return ok(toView(active.toObject() as ProfileDoc));
  }

  const fresh = {
    userId,
    status: "active" as const,
    ...fields,
    startWeightKg: input.startWeightKg,
    goalWeightKg: input.goalWeightKg,
    startDate: today,
    targetDate,
  };
  const created = await retryOnDuplicateKey(() =>
    inTransaction(async (session) => {
      if (active) {
        await ExerciseProfile.updateOne({ _id: active._id }, { $set: { status: "ended", endedReason: "replaced" } }, { session });
      }
      const [doc] = await ExerciseProfile.create([fresh], { session });
      return doc;
    }),
  );
  return ok(toView(created.toObject() as ProfileDoc));
}

export async function finishIfDone(userId: string, today: string): Promise<{ finished: boolean; reason?: "target" | "goal" }> {
  const profile = await getActiveProfile(userId);
  if (!profile) return { finished: false };
  let reason: "target" | "goal" | undefined;
  if (today > profile.targetDate) {
    reason = "target";
  } else {
    const weights = await WeightEntry.find({ userId, profileId: profile.id }).select("date kg").lean<{ date: string; kg: number }[]>();
    if (goalReached(profile, paceStatus(profile, weights, today).currentKg)) reason = "goal";
  }
  if (!reason) return { finished: false };
  await ExerciseProfile.updateOne({ _id: profile.id, status: "active" }, { $set: { status: "ended", endedReason: "finished" } });
  return { finished: true, reason };
}

export async function startKeepFit(userId: string, today: string): Promise<ActionResult<ProfileView>> {
  if (await getActiveProfile(userId)) return fail("You already have an active goal.");
  const last = await lastEndedProfile(userId);
  if (!last) return fail("There is no finished goal to continue from.");
  const weights = await WeightEntry.find({ userId, profileId: last.id }).select("date kg").lean<{ date: string; kg: number }[]>();
  const kg = Math.round(paceStatus(last, weights, today).currentKg * 10) / 10;
  return saveProfile(
    userId,
    {
      heightCm: last.heightCm,
      birthYear: last.birthYear,
      sex: last.sex,
      level: last.level,
      workoutDays: last.workoutDays,
      minutesPerSession: last.minutesPerSession,
      startWeightKg: kg,
      goalWeightKg: kg,
      months: 3,
    },
    today,
  );
}
