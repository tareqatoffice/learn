import Link from "next/link";
import { BandCharts } from "@/components/ielts/BandCharts";
import { dateLabel } from "@/components/ielts/format";
import { bandSeries, criteriaSeries, weeklyMinutes } from "@/ielts/history";
import { getProfile } from "@/ielts/profile";
import { type AttemptSummary, listAttempts } from "@/ielts/speaking/attempts";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "IELTS history",
  description: "Your IELTS bands over time, Speaking mock criteria, weekly minutes and past Speaking attempts.",
  path: "/ielts/history",
});

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
const LIMIT = 50;

function matches(f: Filter, a: AttemptSummary): boolean {
  if (f === "all") return true;
  if (f === "mocks") return a.kind === "mock";
  if (f === "drills") return a.kind !== "mock";
  return a.kind === f;
}

const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

const linkClass = "rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function IeltsHistoryPage({ searchParams }: PageProps<"/ielts/history">) {
  const { show } = await searchParams;
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const filter: Filter = FILTERS.find((f) => f.key === show)?.key ?? "all";

  const [profile, bands, criteria, weeks, attempts] = await Promise.all([
    getProfile(user.userId),
    bandSeries(user.userId),
    criteriaSeries(user.userId),
    weeklyMinutes(user.userId, timeZone),
    listAttempts(user.userId, { limit: LIMIT }),
  ]);
  const rows = attempts.filter((a) => matches(filter, a));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Link href="/ielts" className="text-sm text-muted-foreground hover:underline">
        ← IELTS
      </Link>
      <h1 className={pageTitleClass}>History</h1>
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
              className={`${linkClass} ${f.key === filter ? "bg-muted font-medium" : ""}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            No recorded attempts here yet.{" "}
            <Link href="/ielts/speaking" className="underline underline-offset-2">
              Start a Speaking mock or drill
            </Link>
            .
          </p>
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
    </div>
  );
}
