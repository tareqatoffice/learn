import { PageHeader } from "@/components/PageHeader";
import { addMonths } from "@/features/exercise/goal";
import { type ProfileInput, getActiveProfile, lastEndedProfile } from "@/features/exercise/profile";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { readTimeZone } from "@/features/speaking/timezone";
import { SetupForm } from "./SetupForm";
import { Card } from "@/components/Card";

function monthsOf(startDate: string, targetDate: string): number {
  for (let m = 1; m <= 24; m++) if (addMonths(startDate, m) === targetDate) return m;
  return 3;
}

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
      <Card>
        <SetupForm initial={initial} editing={Boolean(active)} />
      </Card>
    </div>
  );
}
