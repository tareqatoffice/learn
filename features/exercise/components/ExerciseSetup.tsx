import { PageHeader } from "@/components/PageHeader";
import { addMonths } from "@/features/exercise/goal";
import { type ProfileInput, getActiveProfile, lastEndedProfile } from "@/features/exercise/profile";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { readTimeZone } from "@/features/speaking/timezone";
import { SetupForm } from "./SetupForm";

/** Whole months from the start date to the target date, as chosen in the form. */
function monthsOf(startDate: string, targetDate: string): number {
  for (let m = 1; m <= 24; m++) if (addMonths(startDate, m) === targetDate) return m;
  return 3;
}

/**
 * The goal form. Rendered by /exercise/setup and, for a user with no goal yet,
 * by /exercise itself, so a first visit shows one loading state, not two.
 */
export async function ExerciseSetup({ userId }: { userId: string }) {
  const active = await getActiveProfile(userId);
  const source = active ?? (await lastEndedProfile(userId));

  const initial: Partial<ProfileInput> | undefined = source ? {
    heightCm: source.heightCm,
    birthYear: source.birthYear,
    sex: source.sex,
    level: source.level,
    workoutDays: source.workoutDays,
    minutesPerSession: source.minutesPerSession,
    // A new goal after a finished one starts from the old profile body, not its weights.
    ...(active
      ? { startWeightKg: active.startWeightKg, goalWeightKg: active.goalWeightKg, months: monthsOf(active.startDate, active.targetDate) }
      : {}),
  } : undefined;

  return (
    <div className="grid w-full max-w-2xl gap-6">
      <TimeZoneCookie current={await readTimeZone()} />
      <PageHeader
        title={active ? "Edit your goal" : "Set your goal"}
        track="exercise"
        description="Pick a goal weight, how many months you want and the days you can work out. You see the target date and pace before you save."
      />
      <div className="rounded-xl border border-border bg-card p-5">
        <SetupForm initial={initial} editing={Boolean(active)} />
      </div>
    </div>
  );
}
