import Link from "next/link";
import { clock } from "@/components/speaking/format";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { TrendChart } from "@/components/speaking/TrendChart";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getTrends } from "@/speaking/progress";
import { listTakes } from "@/speaking/takes";
import { TASKS, TASK_LABEL, TASK_SLUG, taskFromSlug } from "@/speaking/tasks";
import { readTimeZone } from "@/speaking/timezone";

export const metadata = buildMetadata({
  title: "Speaking history",
  description: "Every speaking take, newest first, with minutes practised and your scores over 30 days.",
  path: "/speaking/history",
});

const LIMIT = 100;
const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const filterClass = (on: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-sm transition-colors pointer-coarse:px-3.5 pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
  );

export default async function SpeakingHistoryPage({ searchParams }: PageProps<"/speaking/history">) {
  const { task: slug } = await searchParams;
  const task = typeof slug === "string" ? taskFromSlug(slug) : null;
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [takes, trends] = await Promise.all([
    listTakes(user.userId, { task: task ?? undefined, limit: LIMIT }),
    getTrends(user.userId, 30, timeZone),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <TimeZoneCookie current={timeZone} />
      <div>
        <Link href="/speaking" className="text-sm text-muted-foreground hover:underline">
          ← Speaking practice
        </Link>
        <h1 className={pageTitleClass}>Speaking history</h1>
      </div>

      <section aria-label="Last 30 days" className="rounded-xl border border-border bg-card p-5">
        <TrendChart days={trends} />
      </section>

      <section aria-labelledby="takes" className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="takes" className="font-semibold">
          Takes
        </h2>
        <nav aria-label="Filter by task" className="flex flex-wrap gap-2">
          <Link href="/speaking/history" aria-current={!task ? "page" : undefined} className={filterClass(!task)}>
            All
          </Link>
          {TASKS.map((t) => (
            <Link
              key={t}
              href={`/speaking/history?task=${TASK_SLUG[t]}`}
              aria-current={task === t ? "page" : undefined}
              className={filterClass(task === t)}
            >
              {TASK_LABEL[t]}
            </Link>
          ))}
        </nav>
        {takes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No takes yet.{" "}
            <Link href="/speaking" className="underline">
              Record one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {takes.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                <span className="min-w-0">
                  <Link href={`/speaking/takes/${t.id}`} className="block truncate font-medium hover:underline">
                    {t.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {TASK_LABEL[t.task]} · {DATE.format(new Date(`${t.date}T00:00:00Z`))} · {clock(t.durationSec)} ·{" "}
                    {t.kind}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  Fluency: you {t.self ? `${t.self.fluency}/5` : "–"} · AI {t.ai?.fluency ? `${t.ai.fluency}/5` : "–"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {takes.length >= LIMIT && <p className="text-xs text-muted-foreground">Showing your latest {LIMIT} takes.</p>}
      </section>
    </div>
  );
}
