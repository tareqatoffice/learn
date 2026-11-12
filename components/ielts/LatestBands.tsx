import Link from "next/link";
import type { BandEntryView } from "@/ielts/bandHistory";
import type { BandSet } from "@/ielts/plan";
import { bandLabel, dateLabel } from "./format";

/** Last Speaking mock (self and AI estimate), latest overall from band history, and the target. */
export function LatestBands({ entries, target }: { entries: BandEntryView[]; target: BandSet }) {
  const newest = (pred: (e: BandEntryView) => boolean) => entries.filter(pred).at(-1);
  const self = newest((e) => e.source === "mockSelf" && e.bands.speaking !== undefined);
  const ai = newest((e) => e.source === "mockAi" && e.bands.speaking !== undefined);
  const overall = newest((e) => e.overall !== undefined);
  const speakingTarget = target.speaking ?? target.overall;

  const rows: [string, string, string | undefined][] = [
    ["Target", bandLabel(target.overall), undefined],
    ["Speaking target", bandLabel(speakingTarget), undefined],
    ["Last Speaking mock (your rating)", self ? bandLabel(self.bands.speaking!) : "–", self && dateLabel(self.date)],
    ["Last Speaking mock (AI estimate)", ai ? bandLabel(ai.bands.speaking!) : "–", ai && dateLabel(ai.date)],
    ["Latest overall", overall ? bandLabel(overall.overall!) : "–", overall && dateLabel(overall.date)],
  ];

  return (
    <section aria-labelledby="bands-title" className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <h2 id="bands-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Latest bands
      </h2>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value, date]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">
              <span className="font-semibold">{value}</span>
              {date && <span className="ml-2 text-xs text-muted-foreground">{date}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {!self && !ai && !overall && (
        <p className="text-sm text-muted-foreground">
          No bands yet. Do a Speaking mock or{" "}
          <Link href="/ielts/calculator" className="underline underline-offset-2">
            work out a band from a practice test
          </Link>
          .
        </p>
      )}
    </section>
  );
}
