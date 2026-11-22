import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/features/auth/lib/authz";
import { addDays, localDate } from "@/features/speaking/schedule";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { readTimeZone } from "@/features/speaking/timezone";
import { connectDb } from "@/lib/db";
import { ageFrom, calorieAdvice, goalLine, goalReached, paceStatus, weeklyPace, weeksBetween } from "@/features/exercise/goal";
import { weekStartOf } from "@/features/exercise/plan";
import { finishIfDone, getActiveProfile, lastEndedProfile } from "@/features/exercise/profile";
import { doneDates, streak as streakOf } from "@/features/exercise/sessions";
import { ensureWeek, plannedDates } from "@/features/exercise/weeks";
import { listWeights } from "@/features/exercise/weights";
import { CoachNote } from "./CoachNote";
import { GoalCard } from "./GoalCard";
import { PlanFinished } from "./PlanFinished";
import { WeekStrip, type StripDay } from "./WeekStrip";
import { WeightPanel, type WeightPoint } from "./WeightPanel";

const RECENT_WEIGHTS = 5;

export async function ExerciseHome() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const userId = user.userId;

  await finishIfDone(userId, today);
  const profile = await getActiveProfile(userId);

  const header = (
    <>
      <TimeZoneCookie current={timeZone} />
      <PageHeader
        title="Exercise"
        track="exercise"
        actions={
          profile && (
            <Link href="/exercise/setup" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Edit goal
            </Link>
          )
        }
      />
    </>
  );

  if (!profile) {
    const ended = await lastEndedProfile(userId);
    if (!ended) redirect("/exercise/setup");
    const weights = await listWeights(userId, ended.id);
    const finalKg = Math.round(paceStatus(ended, weights, today).currentKg * 10) / 10;
    return (
      <div className="grid w-full gap-6">
        {header}
        <PlanFinished result={{ startKg: ended.startWeightKg, goalKg: ended.goalWeightKg, finalKg, reached: goalReached(ended, finalKg) }} />
      </div>
    );
  }

  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const [week, weights, planned, done, streak] = await Promise.all([
    ensureWeek(userId, today),
    listWeights(userId, profile.id),
    plannedDates(userId, profile, weekStart, weekEnd),
    doneDates(userId, weekStart, weekEnd),
    streakOf(userId, today),
  ]);

  const status = paceStatus(profile, weights, today);
  const pace = weeklyPace(profile.startWeightKg, profile.goalWeightKg, weeksBetween(profile.startDate, profile.targetDate));
  const kcal = calorieAdvice({
    kg: status.currentKg,
    heightCm: profile.heightCm,
    age: ageFrom(profile.birthYear, today),
    sex: profile.sex,
    daysPerWeek: profile.workoutDays.length,
    pace,
  });

  const plan = new Map((week?.days ?? []).map((d) => [d.date, d]));
  const doneSet = new Set(done);
  const plannedSet = new Set(planned);
  const strip: StripDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const day = plan.get(date);
    return {
      date,
      done: doneSet.has(date),
      ...(plannedSet.has(date) ? { workout: { focus: day?.focus ?? "workout", minutes: day?.minutes ?? profile.minutesPerSession } } : {}),
    };
  });

  const dates = [...new Set([profile.startDate, ...weights.map((w) => w.date), profile.targetDate])].sort();
  const byDate = new Map(weights.map((w) => [w.date, w.kg]));
  const points: WeightPoint[] = dates.map((date) => ({ date, kg: byDate.get(date), goal: goalLine(profile, date) }));

  return (
    <div className="grid w-full gap-6">
      {header}
      <GoalCard profile={profile} status={status} kcal={kcal} streak={streak} />
      <Panel title="This week" track="exercise">
        <WeekStrip today={today} days={strip} />
      </Panel>
      {week && <CoachNote note={week.coachNote} />}
      <WeightPanel points={points} recent={weights.slice(-RECENT_WEIGHTS).reverse()} today={today} />
    </div>
  );
}
