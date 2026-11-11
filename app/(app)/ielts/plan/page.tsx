import Link from "next/link";
import { redirect } from "next/navigation";
import { HoursWarning } from "@/components/ielts/HoursWarning";
import { PlanTimeline } from "@/components/ielts/PlanTimeline";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { weekOn } from "@/ielts/plan";
import { currentPlan, getProfile, planHistory } from "@/ielts/profile";
import { weekProgress } from "@/ielts/progress";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { localDate } from "@/speaking/schedule";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "IELTS plan",
  description: "Your IELTS phases, this week's targets and progress, and the plan's version history.",
  path: "/ielts/plan",
});

export default async function IeltsPlanPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const [profile, plan] = await Promise.all([getProfile(user.userId), currentPlan(user.userId)]);
  if (!profile || !plan) redirect("/ielts");

  const found = weekOn(plan, today);
  const [progress, history] = await Promise.all([
    found ? weekProgress(user.userId, plan, found.index, timeZone) : Promise.resolve(null),
    planHistory(user.userId),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <TimeZoneCookie current={timeZone} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>IELTS plan</h1>
        <Link
          href="/ielts"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to IELTS
        </Link>
      </div>
      {plan.hours.short && <HoursWarning needed={plan.hours.needed} available={plan.hours.available} />}
      <PlanTimeline plan={plan} today={today} weekIndex={found?.index ?? null} progress={progress} history={history} />
    </div>
  );
}
