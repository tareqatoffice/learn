import Link from "next/link";
import { chipClass } from "@/components/Chip";
import { BandCharts } from "@/features/ielts/components/BandCharts";
import { dateLabel } from "@/features/ielts/components/format";
import type { AttemptSummary } from "@/features/ielts/speaking/attempts";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "mocks", label: "Mocks" },
  { key: "drills", label: "Drills" },
  { key: "part1", label: "Part 1" },
  { key: "part2", label: "Part 2" },
  { key: "part3", label: "Part 3" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const KIND_LABEL: Record<AttemptSummary["kind"], string> = { mock: "Full mock", part1: "Part 1 drill", part2: "Part 2 drill", part3: "Part 3 drill" };

function matches(f: Filter, a: AttemptSummary): boolean {
  if (f === "all") return true;
  if (f === "mocks") return a.kind === "mock";
  if (f === "drills") return a.kind !== "mock";
  return a.kind === f;
}

const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

type BandPoint = Awaited<ReturnType<typeof import("@/features/ielts/history").bandSeries>>[number];
type CriteriaPoint = Awaited<ReturnType<typeof import("@/features/ielts/history").criteriaSeries>>[number];
type WeekPoint = Awaited<ReturnType<typeof import("@/features/ielts/history").weeklyMinutes>>[number];
type TestAttempt = Awaited<ReturnType<typeof import("@/features/ielts/practice/attempts").listTestAttempts>>[number];
type WritingAttempt = Awaited<ReturnType<typeof import("@/features/ielts/writing/attempts").listWritingAttempts>>[number];
type Profile = Awaited<ReturnType<typeof import("@/features/ielts/profile").getProfile>>;

export function IeltsHistory({
  filter,
  bands,
  criteria,
  weeks,
  attempts,
  tests,
  writings,
  profile,
}: {
  filter: Filter;
  bands: BandPoint[];
  criteria: CriteriaPoint[];
  weeks: WeekPoint[];
  attempts: AttemptSummary[];
  tests: TestAttempt[];
  writings: WritingAttempt[];
  profile: Profile;
}) {
  const rows = attempts.filter((a) => matches(filter, a));

  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/ielts">← IELTS</BackLink>
        <PageHeader title="History" track="ielts" />
      </div>
      <BandCharts bands={bands} criteria={criteria} weeks={weeks} target={profile?.target.overall} testDate={profile?.testDate} />

      <section aria-labelledby="attempts-title" className="grid gap-3">
        <h2 id="attempts-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Speaking attempts
        </h2>
        <nav aria-label="Filter attempts" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/ielts/history" : `/ielts/history?show=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={chipClass(f.key === filter)}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <EmptyState>
            No recorded attempts here yet.{" "}
            <Link href="/ielts/speaking" className="underline underline-offset-2">
              Start a Speaking mock or drill
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/ielts/speaking/${a.id}/review`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-medium">{KIND_LABEL[a.kind]}</span>
                  <span className="text-muted-foreground">
                    {dateLabel(a.date)} · {minutes(a.durationSec)}
                    {a.status === "incomplete" ? " · incomplete" : ""}
                    {a.aiOverall !== undefined ? ` · AI estimate ${a.aiOverall.toFixed(1)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="practice-title" className="grid gap-3">
        <h2 id="practice-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Listening, Reading and Writing attempts
        </h2>
        {tests.length === 0 && writings.length === 0 ? (
          <EmptyState>No practice attempts yet.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {tests.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/ielts/test/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="text-muted-foreground">
                    {dateLabel(t.date)} ·{" "}
                    {t.status === "submitted" && t.raw !== undefined ? `${t.raw}/${t.total}${t.band !== undefined ? ` · about band ${t.band}` : ""}` : "in progress"}
                  </span>
                </Link>
              </li>
            ))}
            {writings.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/ielts/writing/${w.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-medium">Writing {w.kind === "full" ? "full test" : w.kind === "task1" ? "Task 1" : "Task 2"}</span>
                  <span className="text-muted-foreground">
                    {dateLabel(w.date)} · {w.status === "submitted" ? `${w.words} words${w.selfBand !== null ? ` · you rated ${w.selfBand}` : ""}` : "in progress"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { FILTERS };
export type { Filter };
