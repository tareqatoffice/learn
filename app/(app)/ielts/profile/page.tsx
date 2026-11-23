import { DeleteIeltsDataButton, EndPlanButton } from "@/features/ielts/components/PlanActions";
import { ProfileForm } from "@/features/ielts/components/ProfileForm";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { getProfile, testDayStatus } from "@/features/ielts/profile";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

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
    <div className="grid w-full gap-6">
      <TimeZoneCookie current={timeZone} />
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title={profile ? "IELTS profile" : "Set up your IELTS plan"} track="ielts" />
      </div>
      {profile?.status === "ended" && (
        <p className="text-sm text-muted-foreground">Your last plan has ended. Saving this starts a new one.</p>
      )}
      {profile && testDayStatus(today, profile.testDate) === "passed" && profile.status === "active" && (
        <p className="text-sm text-muted-foreground">Your test date has passed. Pick a new test date to rebuild your plan.</p>
      )}
      <Card>
        <ProfileForm today={today} initial={profile ?? undefined} />
      </Card>

      {profile && (
        <Card as="section" aria-labelledby="data-title" className="grid gap-3">
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
              Deleting removes your IELTS profile, plans, band entries, study logs, and every Speaking, Listening, Reading and
              Writing attempt, recordings included. Speaking Practice is not affected.
            </p>
            <div>
              <DeleteIeltsDataButton />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
