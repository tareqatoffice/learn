import Link from "next/link";
import { BandCalculator } from "@/components/ielts/BandCalculator";
import { Countdown } from "@/components/ielts/Countdown";
import { HoursWarning } from "@/components/ielts/HoursWarning";
import { LatestBands } from "@/components/ielts/LatestBands";
import { EndPlanButton } from "@/components/ielts/PlanActions";
import { ProfileForm } from "@/components/ielts/ProfileForm";
import { SuggestionCard } from "@/components/ielts/SuggestionCard";
import { TodayList } from "@/components/ielts/TodayList";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { listBandEntries } from "@/ielts/bandHistory";
import { phaseOn, weekOn } from "@/ielts/plan";
import { currentPlan, getProfile, testDayStatus } from "@/ielts/profile";
import { todayList } from "@/ielts/progress";
import { listPending, runChecks } from "@/ielts/suggestions";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { localDate } from "@/speaking/schedule";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "IELTS",
  description: "Your IELTS study plan: countdown, today's list, plan suggestions and latest bands.",
  path: "/ielts",
});

const linkClass =
  "rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function IeltsPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const profile = await getProfile(user.userId);

  if (!profile) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <TimeZoneCookie current={timeZone} />
        <h1 className={pageTitleClass}>Set up your IELTS plan</h1>
        <p className="text-sm text-muted-foreground">
          Tell us when your test is and what band you want. You will see a preview of the plan before anything is saved. Just want to
          convert a practice score?{" "}
          <Link href="/ielts/calculator" className="underline underline-offset-2">
            Use the band calculator
          </Link>
          .
        </p>
        <div className="rounded-xl border border-border bg-card p-5">
          <ProfileForm today={today} />
        </div>
      </div>
    );
  }

  const header = (
    <>
      <TimeZoneCookie current={timeZone} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>IELTS</h1>
        <nav aria-label="IELTS" className="flex flex-wrap gap-2">
          <Link href="/ielts/speaking" className={linkClass}>
            Speaking
          </Link>
          <Link href="/ielts/listening" className={linkClass}>
            Listening
          </Link>
          <Link href="/ielts/reading" className={linkClass}>
            Reading
          </Link>
          <Link href="/ielts/writing" className={linkClass}>
            Writing
          </Link>
          <Link href="/ielts/plan" className={linkClass}>
            Plan
          </Link>
          <Link href="/ielts/history" className={linkClass}>
            History
          </Link>
          <Link href="/ielts/calculator" className={linkClass}>
            Calculator
          </Link>
          <Link href="/ielts/profile" className={linkClass}>
            Profile
          </Link>
        </nav>
      </div>
    </>
  );

  if (profile.status === "ended") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        {header}
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Your IELTS plan has ended</h2>
          <p className="text-sm text-muted-foreground">Your history and band entries are kept. Start a new plan whenever you are ready.</p>
          <div>
            <Link href="/ielts/profile" className={linkClass}>
              Start a new plan
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (testDayStatus(today, profile.testDate) === "passed") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        {header}
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">Your test date has passed</h2>
            <p className="text-sm text-muted-foreground">
              Enter your official result to keep it in your band history. The overall band is worked out from the four skills.
            </p>
          </div>
          <BandCalculator today={today} source="official" />
          <div className="flex flex-wrap items-start gap-3 border-t border-border pt-4">
            <Link href="/ielts/profile" className={linkClass}>
              Set a new test date
            </Link>
            <EndPlanButton />
          </div>
        </section>
      </div>
    );
  }

  await runChecks(user.userId, today, timeZone);
  const [plan, suggestions, items, entries] = await Promise.all([
    currentPlan(user.userId),
    listPending(user.userId, today),
    todayList(user.userId, today, timeZone),
    listBandEntries(user.userId),
  ]);
  const week = plan ? weekOn(plan, today) : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {header}
      <Countdown
        today={today}
        testDate={profile.testDate}
        phase={plan ? (phaseOn(plan, today)?.name ?? null) : null}
        week={plan && week ? { index: week.index, count: plan.weeks.length } : null}
      />
      {suggestions.length > 0 && (
        <section aria-labelledby="suggestions-title" className="grid gap-3">
          <h2 id="suggestions-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plan suggestions
          </h2>
          <p className="-mt-1 text-sm text-muted-foreground">Your plan stays as it is until you approve a change.</p>
          <ul className="grid gap-3">
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </ul>
        </section>
      )}
      <TodayList items={items} />
      {plan?.hours.short && <HoursWarning needed={plan.hours.needed} available={plan.hours.available} />}
      <LatestBands entries={entries} target={profile.target} />
    </div>
  );
}
