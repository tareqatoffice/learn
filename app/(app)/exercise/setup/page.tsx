import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/features/auth/lib/authz";
import { SetupForm } from "@/features/exercise/components/SetupForm";
import { addMonths } from "@/features/exercise/goal";
import { type ProfileInput, getActiveProfile, lastEndedProfile } from "@/features/exercise/profile";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Exercise goal",
  description: "Set your weight goal, workout days and session length.",
  path: "/exercise/setup",
});

/** Whole months from the start date to the target date, as chosen in the form. */
function monthsOf(startDate: string, targetDate: string): number {
  for (let m = 1; m <= 24; m++) if (addMonths(startDate, m) === targetDate) return m;
  return 3;
}

export default async function ExerciseSetupPage() {
  const user = await requireUser();
  await connectDb();
  const active = await getActiveProfile(user.userId);
  const source = active ?? (await lastEndedProfile(user.userId));

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
      <PageHeader
        title={active ? "Edit your goal" : "Set your goal"}
        track="exercise"
        description="Pick a goal weight, how many months you want and the days you can work out. You see the target date and pace before you save."
      />
      <div className="rounded-xl border border-border bg-card p-5">
        <SetupForm initial={initial} />
      </div>
    </div>
  );
}
