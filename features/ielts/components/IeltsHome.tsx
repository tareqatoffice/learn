import Link from "next/link";
import { BandCalculator } from "@/features/ielts/components/BandCalculator";
import { Countdown } from "@/features/ielts/components/Countdown";
import { HoursWarning } from "@/features/ielts/components/HoursWarning";
import { LatestBands } from "@/features/ielts/components/LatestBands";
import { EndPlanButton } from "@/features/ielts/components/PlanActions";
import { ProfileForm } from "@/features/ielts/components/ProfileForm";
import { SuggestionCard } from "@/features/ielts/components/SuggestionCard";
import { TodayList } from "@/features/ielts/components/TodayList";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { listBandEntries } from "@/features/ielts/bandHistory";
import { phaseOn, weekOn } from "@/features/ielts/plan";
import { currentPlan, getProfile, testDayStatus } from "@/features/ielts/profile";
import { listStudyLogs, STUDY_LOG_DAYS, todayList } from "@/features/ielts/progress";
import { listPending, runChecks } from "@/features/ielts/suggestions";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { buttonVariants } from "@/components/ui/button";
import { StudyLog } from "@/features/ielts/components/StudyLog";
import { addDays, localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { Card } from "@/components/Card";

const linkClass = buttonVariants({ variant: "outline", size: "sm" });

const PRACTICE = [
  ["/ielts/speaking", "Speaking"],
  ["/ielts/listening", "Listening"],
  ["/ielts/reading", "Reading"],
  ["/ielts/writing", "Writing"],
] as const;
const PLAN = [
  ["/ielts/plan", "Plan"],
  ["/ielts/history", "History"],
] as const;
const TOOLS = [
  ["/ielts/calculator", "Calculator"],
  ["/ielts/profile", "Profile"],
] as const;

function IeltsNav({ withPlan }: { withPlan: boolean }) {
  const links = withPlan ? [...PRACTICE, ...PLAN, ...TOOLS] : [...PRACTICE, TOOLS[0]];
  return (
    <nav aria-label="IELTS" className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className={linkClass}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export async function IeltsHome() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const profile = await getProfile(user.userId);

  if (!profile) {
    return (
      <div className="grid w-full gap-6">
        <TimeZoneCookie current={timeZone} />
        <PageHeader
          title="Set up your IELTS plan"
          track="ielts"
          description="Tell us when your test is and what band you want. You will see a preview of the plan before anything is saved. You can also practise any skill or use the band calculator without a plan."
        />
        <IeltsNav withPlan={false} />
        <Card>
          <ProfileForm today={today} />
        </Card>
      </div>
    );
  }

  const header = (
    <>
      <TimeZoneCookie current={timeZone} />
      <PageHeader title="IELTS" track="ielts" actions={<IeltsNav withPlan />} />
    </>
  );

  if (profile.status === "ended") {
    return (
      <div className="grid w-full gap-6">
        {header}
        <Panel title="Your IELTS plan has ended" track="ielts" className="p-5">
          <p className="text-sm text-muted-foreground">Your history and band entries are kept. Start a new plan whenever you are ready.</p>
          <div>
            <Link href="/ielts/profile" className={linkClass}>
              Start a new plan
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (testDayStatus(today, profile.testDate) === "passed") {
    return (
      <div className="grid w-full gap-6">
        {header}
        <Panel title="Your test date has passed" track="ielts" className="gap-4 p-5">
          <p className="-mt-1 text-sm text-muted-foreground">
            Enter your official result to keep it in your band history. The overall band is worked out from the four skills.
          </p>
          <BandCalculator today={today} source="official" />
          <div className="flex flex-wrap items-start gap-3 border-t border-border pt-4">
            <Link href="/ielts/profile" className={linkClass}>
              Set a new test date
            </Link>
            <EndPlanButton />
          </div>
        </Panel>
      </div>
    );
  }

  await runChecks(user.userId, today, timeZone);
  const [plan, suggestions, items, entries, studyLogs] = await Promise.all([
    currentPlan(user.userId),
    listPending(user.userId, today),
    todayList(user.userId, today, timeZone),
    listBandEntries(user.userId),
    listStudyLogs(user.userId),
  ]);
  const week = plan ? weekOn(plan, today) : null;

  return (
    <div className="grid w-full gap-6">
      {header}
      <Countdown
        today={today}
        testDate={profile.testDate}
        phase={plan ? (phaseOn(plan, today)?.name ?? null) : null}
        week={plan && week ? { index: week.index, count: plan.weeks.length } : null}
      />
      {suggestions.length > 0 && (
        <Panel title="Plan suggestions" track="ielts">
          <p className="-mt-1 text-sm text-muted-foreground">Your plan stays as it is until you approve a change.</p>
          <ul className="grid gap-3">
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </ul>
        </Panel>
      )}
      <TodayList items={items} />
      <StudyLog today={today} minDate={addDays(today, -(STUDY_LOG_DAYS - 1))} entries={studyLogs} />
      {plan?.hours.short && <HoursWarning needed={plan.hours.needed} available={plan.hours.available} />}
      <LatestBands entries={entries} target={profile.target} />
    </div>
  );
}
