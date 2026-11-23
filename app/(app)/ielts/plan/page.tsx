import { redirect } from "next/navigation";
import { HoursWarning } from "@/features/ielts/components/HoursWarning";
import { PlanTimeline } from "@/features/ielts/components/PlanTimeline";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { weekOn } from "@/features/ielts/plan";
import { currentPlan, getProfile, planHistory } from "@/features/ielts/profile";
import { weekProgress } from "@/features/ielts/progress";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="grid w-full gap-6">
      <TimeZoneCookie current={timeZone} />
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="IELTS plan" track="ielts" />
      </div>
      {plan.hours.short && <HoursWarning needed={plan.hours.needed} available={plan.hours.available} />}
      <PlanTimeline plan={plan} today={today} weekIndex={found?.index ?? null} progress={progress} history={history} />
    </div>
  );
}
