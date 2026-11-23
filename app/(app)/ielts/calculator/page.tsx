import { BandCalculator } from "@/features/ielts/components/BandCalculator";
import { BandEntryList } from "@/features/ielts/components/BandEntryList";
import { TimeZoneCookie } from "@/features/speaking/components/TimeZoneCookie";
import { listBandEntries } from "@/features/ielts/bandHistory";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { localDate } from "@/features/speaking/schedule";
import { readTimeZone } from "@/features/speaking/timezone";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

export const metadata = buildMetadata({
  title: "IELTS band calculator",
  description: "Turn Listening and Reading raw scores and your Writing and Speaking bands into an overall IELTS band.",
  path: "/ielts/calculator",
});

export default async function IeltsCalculatorPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const today = localDate(new Date(), timeZone);
  const entries = (await listBandEntries(user.userId))
    .filter((e) => (e.source === "practice" || e.source === "official" || e.source === "other") && !e.attemptId)
    .reverse();

  return (
    <div className="grid w-full gap-6">
      <TimeZoneCookie current={timeZone} />
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="IELTS band calculator" track="ielts" />
      </div>
      <Card>
        <BandCalculator today={today} />
      </Card>
      <section aria-labelledby="saved-title" className="grid gap-3">
        <h2 id="saved-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Saved results
        </h2>
        <BandEntryList entries={entries} />
      </section>
    </div>
  );
}
