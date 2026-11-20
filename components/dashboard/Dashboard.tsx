import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { StartReviewButton } from "@/components/StartReviewButton";
import { buttonVariants } from "@/components/ui/button";
import { mins } from "@/components/speaking/format";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import type { Dashboard as DashboardData } from "@/progress/dashboard";
import { TASKS, TASK_LABEL, TASK_SLUG } from "@/speaking/tasks";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { focusRing, Panel, Ring, SplitBar, trackVar } from "./parts";
import { ProgressTabs, type TrackTab } from "./ProgressTabs";

type SpeakingToday = Awaited<ReturnType<typeof import("@/speaking/progress").getToday>>;

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtDay = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const START_POINTS = [
  { href: "/interview", label: "Interview" },
  { href: "/graphs", label: "Graphs" },
  { href: "/notes", label: "Notes" },
  { href: "/speaking", label: "Speaking" },
  { href: "/ielts", label: "IELTS" },
];

/** Opacity steps for the review split on the slab; works in both themes. */
const SHARE_OPACITY = [1, 0.7, 0.5, 0.35, 0.22];
const SLAB_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slab-foreground";
/** Slab-coloured button: the app's primary/secondary variants clash with the slab in one theme or the other. */
const SLAB_BUTTON = "bg-slab-foreground text-slab hover:bg-slab-foreground/90";

type Share = { slug: string | null; title: string; count: number };

/** Books with reviews due, largest first; everything past the visible steps folds into one "more" entry. */
function reviewShares(byBook: DashboardData["reviewPile"]["byBook"]): Share[] {
  const books = byBook.filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
  if (books.length <= SHARE_OPACITY.length) return books;
  const keep = books.slice(0, SHARE_OPACITY.length - 1);
  const rest = books.slice(SHARE_OPACITY.length - 1);
  return [...keep, { slug: null, title: `${rest.length} more books`, count: rest.reduce((n, b) => n + b.count, 0) }];
}

function makeTab(track: TrackTab["track"], label: string, rows: TrackTab["rows"], empty: string): TrackTab {
  return {
    id: track,
    label,
    track,
    rows,
    empty,
    done: rows.reduce((n, r) => n + r.value, 0),
    total: rows.reduce((n, r) => n + r.max, 0),
  };
}

function TopicLinks({
  topics,
}: {
  topics: { graphSlug: string; slug: string; title: string }[];
}) {
  return (
    <ul className="grid gap-0.5">
      {topics.map((t) => (
        <li key={`${t.graphSlug}/${t.slug}`}>
          <Link
            href={`/graphs/${t.graphSlug}?topic=${encodeURIComponent(t.slug)}`}
            className={cn(
              "block truncate rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/70 pointer-coarse:py-2.5",
              focusRing,
            )}
          >
            {t.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Focus({ dash, nothingToDo }: { dash: DashboardData; nothingToDo: boolean }) {
  const total = dash.reviewPile.total;
  const books = reviewShares(dash.reviewPile.byBook);
  return (
    <section
      aria-labelledby="focus"
      className="grid min-w-0 gap-5 rounded-2xl bg-slab p-5 text-slab-foreground sm:p-8"
    >
      {nothingToDo ? (
        <>
          <div className="grid max-w-[34rem] gap-2">
            <h2 id="focus" className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Nothing queued yet. Pick a place to start.
            </h2>
            <p className="text-pretty text-slab-foreground/75">
              Whatever you open shows up here next time, with reviews, reading and topics ready to continue.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {START_POINTS.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className={cn(
                    "inline-flex rounded-lg border border-slab-foreground/30 px-3.5 py-2 text-sm font-medium hover:bg-slab-foreground/12 pointer-coarse:py-2.5",
                    SLAB_FOCUS,
                  )}
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : total > 0 ? (
        <>
          <div className="grid max-w-[34rem] gap-2">
            <h2 id="focus" className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {plural(total, "question")} due for review
            </h2>
            <p className="text-pretty text-slab-foreground/75">
              A short quiz now keeps them from slipping. Twenty cards at a time, drawn from every book.
            </p>
          </div>

          {books.length > 0 && (
            <div className="grid gap-2.5">
              <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {books.map((b, i) => (
                  <div
                    key={b.slug ?? "more"}
                    className="progress-fill h-full bg-slab-foreground"
                    style={{ width: `${(b.count / total) * 100}%`, opacity: SHARE_OPACITY[i] }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {books.map((b, i) => {
                  const label = (
                    <>
                      <span
                        aria-hidden
                        className="size-2.5 rounded-sm bg-slab-foreground"
                        style={{ opacity: SHARE_OPACITY[i] }}
                      />
                      {b.title}
                      <span className="tabular-nums text-slab-foreground/60">{b.count}</span>
                    </>
                  );
                  return (
                    <li key={b.slug ?? "more"}>
                      {b.slug ? (
                        <Link
                          href={`/interview/${b.slug}`}
                          className={cn(
                            "inline-flex items-center gap-2 rounded text-slab-foreground/85 hover:text-slab-foreground",
                            SLAB_FOCUS,
                          )}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-slab-foreground/85">{label}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <StartReviewButton size="lg" className={SLAB_BUTTON} />
        </>
      ) : (
        <>
          <div className="grid max-w-[34rem] gap-2">
            <h2 id="focus" className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              You’re caught up on reviews
            </h2>
            <p className="text-pretty text-slab-foreground/75">
              Continue a chapter or open the next topic below, or practise on your own with a fresh quiz.
            </p>
          </div>
          <div>
            <Link
              href="/interview"
              className={cn(buttonVariants({ size: "lg" }), SLAB_BUTTON, SLAB_FOCUS)}
            >
              Take a quiz
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

export function Dashboard({
  dash,
  speaking,
  firstName,
  timeZone,
}: {
  dash: DashboardData;
  speaking: SpeakingToday;
  firstName?: string;
  timeZone: string;
}) {
  const speakingTasks = TASKS.filter((t) => speaking.settings.enabled[t]);
  const nothingToDo =
    dash.reviewPile.total === 0 && !dash.continueReading && dash.readyNext.length === 0;
  const firstVisit =
    nothingToDo && dash.recentQuizzes.length === 0 && dash.learningNow.length === 0 && speaking.best === 0 && !dash.ielts;

  const tabs = [
    makeTab("graphs", "Graphs", dash.graphs.map((g) => ({ key: g.slug, href: `/graphs/${g.slug}`, label: g.title, value: g.done, max: g.total })), "No graphs published yet."),
    makeTab("interview", "Interview", dash.books.map((b) => ({ key: b.slug, href: `/interview/${b.slug}`, label: b.title, value: b.mastered, max: b.total })), "No books published yet."),
    makeTab("notes", "Notes", dash.series.map((s) => ({ key: s.slug, href: `/notes/${s.slug}`, label: s.title, value: s.read, max: s.total })), "No notes published yet."),
  ];

  const reading = dash.continueReading;

  return (
    <div className="grid gap-6">
      <TimeZoneCookie current={timeZone} />
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className={pageTitleClass}>
            {firstVisit ? "Welcome" : "Welcome back"}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {firstVisit ? "Choose where to start; your progress shows up here as you go." : "Pick up where you left off."}
          </p>
        </div>
        <Link
          href="/speaking"
          className={cn(
            "flex items-baseline gap-2 rounded-lg border border-border bg-card px-3.5 py-2 hover:border-ring/50",
            focusRing,
          )}
        >
          <span className="text-xl font-semibold tabular-nums leading-none" style={{ color: trackVar("speaking") }}>
            {speaking.streak}
          </span>
          <span className="text-sm text-muted-foreground">
            {speaking.streak === 1 ? "day" : "days"} speaking streak
          </span>
        </Link>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-6">
          <Focus dash={dash} nothingToDo={nothingToDo} />

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Continue reading" track="notes">
              {reading ? (
                <Link
                  href={`/notes/${reading.seriesSlug}/${reading.chapterSlug}`}
                  className={cn("group grid gap-2 rounded-lg", focusRing)}
                >
                  <span className="text-pretty font-medium underline-offset-4 group-hover:underline">
                    {reading.chapterTitle}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {reading.seriesTitle}: {reading.read} of {reading.total} chapters read
                  </span>
                  <ProgressBar value={reading.read} max={reading.total} color={trackVar("notes")} />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open a chapter in{" "}
                  <Link href="/notes" className="font-medium text-foreground underline">
                    Notes
                  </Link>{" "}
                  and it shows up here.
                </p>
              )}
            </Panel>

            <Panel title="Ready to learn" track="graphs">
              {dash.readyNext.length > 0 ? (
                <TopicLinks topics={dash.readyNext} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Mark a topic done in{" "}
                  <Link href="/graphs" className="font-medium text-foreground underline">
                    Graphs
                  </Link>{" "}
                  to unlock the next one.
                </p>
              )}
            </Panel>
          </div>

          <ProgressTabs tabs={tabs} />
        </div>

        <aside className="grid min-w-0 gap-6" aria-label="Today and recent activity">
          <Panel title="Speaking today" track="speaking">
            {speakingTasks.length > 0 ? (
              <ul className="grid grid-cols-3 gap-1">
                {speakingTasks.map((t) => (
                  <li key={t} className="min-w-0">
                    <Ring
                      href={`/speaking/${TASK_SLUG[t]}`}
                      label={TASK_LABEL[t]}
                      value={Number(mins(speaking.minutes[t] ?? 0))}
                      max={speaking.settings.targets[t]}
                      done={Boolean(speaking.done[t])}
                      track="speaking"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Every speaking task is turned off.</p>
            )}
            <p className="text-sm text-muted-foreground">
              Best streak: {plural(speaking.best, "day")}
            </p>
          </Panel>

          <Panel title="IELTS" track="ielts">
            {dash.ielts ? (
              <div className="grid gap-2">
                <Link
                  href="/ielts"
                  className={cn("rounded-lg font-medium underline-offset-4 hover:underline", focusRing)}
                >
                  {dash.ielts.testDay === "passed"
                    ? "Enter your result"
                    : dash.ielts.testDay === "today"
                      ? "Your test is today"
                      : `${plural(dash.ielts.daysLeft, "day")} to your test`}
                </Link>
                {dash.ielts.testDay === "upcoming" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {dash.ielts.total === 0
                        ? "Nothing planned for today."
                        : `${dash.ielts.done} of ${dash.ielts.total} done today`}
                    </p>
                    {dash.ielts.total > 0 && (
                      <ProgressBar value={dash.ielts.done} max={dash.ielts.total} color={trackVar("ielts")} />
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Preparing for IELTS?{" "}
                <Link href="/ielts" className="font-medium text-foreground underline">
                  Set up a study plan
                </Link>{" "}
                from your test date and target band, or practise any skill without one.
              </p>
            )}
          </Panel>

          {dash.learningNow.length > 0 && (
            <Panel title="Learning now" track="graphs">
              <ul className="grid gap-3">
                {dash.learningNow.map((g) => (
                  <li key={g.graphSlug} className="grid gap-0.5">
                    <span className="px-2 text-xs text-muted-foreground">{g.graphTitle}</span>
                    <TopicLinks topics={g.topics.map((t) => ({ ...t, graphSlug: g.graphSlug }))} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {dash.recentQuizzes.length > 0 && (
            <Panel title="Recent quizzes" track="interview">
              <ul className="grid gap-0.5">
                {dash.recentQuizzes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/interview/history/${q.id}`}
                      className={cn(
                        "grid min-w-0 gap-1.5 rounded-lg px-2 py-2 hover:bg-muted/60 pointer-coarse:py-3",
                        focusRing,
                      )}
                    >
                      <span className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {q.label}
                          {!q.finished && <span className="font-normal text-muted-foreground"> in progress</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fmtDay(q.date)}</span>
                      </span>
                      <SplitBar got={q.got} review={q.review} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {q.got} got, {q.review} to review
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
