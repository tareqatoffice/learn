import Link from "next/link";
import { DeleteIeltsDataButton, EndPlanButton } from "@/components/ielts/PlanActions";
import { ProfileForm } from "@/components/ielts/ProfileForm";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { getProfile, testDayStatus } from "@/ielts/profile";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { localDate } from "@/speaking/schedule";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "IELTS profile",
  description: "Your test date, target and current bands, study days and Speaking preferences.",
  path: "/ielts/profile",
});

export default async function IeltsProfilePage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const profile = await getProfile(user.userId);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <TimeZoneCookie current={timeZone} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>{profile ? "IELTS profile" : "Set up your IELTS plan"}</h1>
        <Link
          href="/ielts"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to IELTS
        </Link>
      </div>
      {profile?.status === "ended" && (
        <p className="text-sm text-muted-foreground">Your last plan has ended. Saving this starts a new one.</p>
      )}
      {profile && testDayStatus(today, profile.testDate) === "passed" && profile.status === "active" && (
        <p className="text-sm text-muted-foreground">Your test date has passed. Pick a new test date to rebuild your plan.</p>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <ProfileForm today={today} initial={profile ?? undefined} />
      </div>

      {profile && (
        <section aria-labelledby="data-title" className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <h2 id="data-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your data
          </h2>
          {profile.status === "active" && (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">Ending the plan keeps your history and band entries.</p>
              <div>
                <EndPlanButton />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              Deleting removes your IELTS profile, plans, band entries, study logs and Speaking recordings. Speaking Practice is not affected.
            </p>
            <div>
              <DeleteIeltsDataButton />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
