import Link from "next/link";
import { chipClass } from "@/components/Chip";
import { clock } from "@/components/speaking/format";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { TrendChart } from "@/components/speaking/TrendChart";
import { pageTitleClass } from "@/lib/ui";
import type { TaskKey } from "@/speaking/tasks";
import { TASKS, TASK_LABEL, TASK_SLUG } from "@/speaking/tasks";

const LIMIT = 100;
const DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

type Take = Awaited<ReturnType<typeof import("@/speaking/takes").listTakes>>[number];
type TrendDay = Awaited<ReturnType<typeof import("@/speaking/progress").getTrends>>[number];

export function SpeakingHistory({
  takes,
  trends,
  task,
  before,
  timeZone,
}: {
  takes: Take[];
  trends: TrendDay[];
  task: TaskKey | null;
  before?: string;
  timeZone: string;
}) {
  return (
    <div className="grid w-full gap-4">
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
          <Link href="/speaking/history" aria-current={!task ? "page" : undefined} className={chipClass(!task)}>
            All
          </Link>
          {TASKS.map((t) => (
            <Link
              key={t}
              href={`/speaking/history?task=${TASK_SLUG[t]}`}
              aria-current={task === t ? "page" : undefined}
              className={chipClass(task === t)}
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
        {(before || takes.length >= LIMIT) && (
          <nav aria-label="More takes" className="flex flex-wrap gap-3 text-sm">
            {before && (
              <Link href={`/speaking/history${task ? `?task=${TASK_SLUG[task]}` : ""}`} className="underline underline-offset-2">
                Newest takes
              </Link>
            )}
            {takes.length >= LIMIT && (
              <Link
                href={`/speaking/history?${new URLSearchParams({ ...(task ? { task: TASK_SLUG[task] } : {}), before: takes[takes.length - 1].id })}`}
                className="underline underline-offset-2"
              >
                Load older takes
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
