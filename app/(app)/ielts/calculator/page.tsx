import Link from "next/link";
import { BandCalculator } from "@/components/ielts/BandCalculator";
import { BandEntryList } from "@/components/ielts/BandEntryList";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { listBandEntries } from "@/ielts/bandHistory";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { localDate } from "@/speaking/schedule";
import { readTimeZone } from "@/speaking/timezone";

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
  // Mock rows belong to their attempts; this page lists only results the learner entered.
  const entries = (await listBandEntries(user.userId))
    .filter((e) => e.source === "practice" || e.source === "official" || e.source === "other")
    .reverse();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <TimeZoneCookie current={timeZone} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>IELTS band calculator</h1>
        <Link
          href="/ielts"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to IELTS
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <BandCalculator today={today} />
      </div>
      <section aria-labelledby="saved-title" className="grid gap-3">
        <h2 id="saved-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Saved results
        </h2>
        <BandEntryList entries={entries} />
      </section>
    </div>
  );
}
