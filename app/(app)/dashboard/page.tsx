import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { StartReviewButton } from "@/components/StartReviewButton";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { getDashboard } from "@/progress/dashboard";
import { mins } from "@/components/speaking/format";
import { TimeZoneCookie } from "@/components/speaking/TimeZoneCookie";
import { getToday } from "@/speaking/progress";
import { TASKS, TASK_LABEL, TASK_SLUG } from "@/speaking/tasks";
import { readTimeZone } from "@/speaking/timezone";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "Dashboard",
  description: "Your progress across interview books, topic graphs and notes.",
  path: "/dashboard",
});

const linkClass =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

/**
 * One of the three things to do next, in the band at the top of the page. The page's hierarchy is
 * do (this band) → track (progress) → look back (activity), so these are the only cards with an
 * action in them, and the only ones with a heading at full size.
 */
function NextUp({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = `next-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="grid content-start gap-2 p-4 sm:p-5"
    >
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A tracking card: a quiet title and a list of numbers. Never carries an action. */
function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "card-interactive grid content-start gap-2 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <h3
        id={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProgressRows({
  rows,
  empty,
}: {
  rows: {
    key: string;
    href: string;
    label: string;
    value: number;
    max: number;
  }[];
  empty: string;
}) {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3"
        >
          <Link
            href={r.href}
            className={`truncate text-sm pointer-coarse:py-2 ${linkClass}`}
          >
            {r.label}
          </Link>
          <span className="text-xs tabular-nums text-muted-foreground">
            {r.value}/{r.max}
          </span>
          <ProgressBar value={r.value} max={r.max} className="col-span-2" />
        </li>
      ))}
    </ul>
  );
}

/** Topic links joined by a middot, used for both "learning now" and "ready next". */
function TopicLinks({
  topics,
}: {
  topics: { graphSlug: string; slug: string; title: string }[];
}) {
  return (
    <>
      {topics.map((t, i) => (
        <span key={`${t.graphSlug}/${t.slug}`}>
          {i > 0 && " · "}
          <Link
            href={`/graphs/${t.graphSlug}?topic=${encodeURIComponent(t.slug)}`}
            className={`font-medium ${linkClass}`}
          >
            {t.title}
          </Link>
        </span>
      ))}
    </>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  await connectDb();
  const timeZone = await readTimeZone();
  const [dash, speaking] = await Promise.all([
    getDashboard(user.userId, timeZone),
    getToday(user.userId, timeZone),
  ]);
  const speakingTasks = TASKS.filter((t) => speaking.settings.enabled[t]);
  // requireUser falls back to the email when the Google profile has no name; never greet with an address.
  const firstName =
    user.name && user.name !== user.email ? user.name.split(" ")[0] : undefined;

  const reviewCount = dash.reviewPile.total;
  // With nothing started and nothing published to start, the band would be three empty boxes;
  // one line pointing at the three areas is more use than that.
  const nothingToDo =
    reviewCount === 0 && !dash.continueReading && dash.readyNext.length === 0;

  return (
    <div className="grid gap-8">
      <TimeZoneCookie current={timeZone} />
      <header>
        <h1 className={pageTitleClass}>
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </header>

      <section aria-labelledby="next-up" className="grid gap-3">
        <h2 id="next-up" className="text-sm font-semibold text-muted-foreground">
          Next up
        </h2>
        {nothingToDo ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Nothing queued yet. Start a quiz in{" "}
              <Link href="/interview" className={`underline ${linkClass}`}>
                Interview
              </Link>
              , pick a topic in{" "}
              <Link href="/graphs" className={`underline ${linkClass}`}>
                Graphs
              </Link>
              , or open a chapter in{" "}
              <Link href="/notes" className={`underline ${linkClass}`}>
                Notes
              </Link>
              .
            </p>
          </div>
        ) : (
          // One panel split into columns rather than three separate cards: these belong together,
          // and the shared surface is what makes the band read as the page's primary row.
          <div className="grid divide-y divide-border rounded-xl border border-border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <NextUp title="Review pile">
              <p className="text-3xl font-semibold tabular-nums leading-none">
                {reviewCount}
              </p>
              <p className="text-sm text-muted-foreground">
                {reviewCount === 1 ? "question waiting" : "questions waiting"}
                {dash.reviewPile.byBook.length > 0 &&
                  ` · ${dash.reviewPile.byBook.map((b) => `${b.title} ${b.count}`).join(" · ")}`}
              </p>
              <div className="mt-1">
                <StartReviewButton disabled={reviewCount === 0} />
              </div>
            </NextUp>

            <NextUp title="Continue reading">
              {dash.continueReading ? (
                <>
                  <Link
                    href={`/notes/${dash.continueReading.seriesSlug}/${dash.continueReading.chapterSlug}`}
                    className={`font-medium pointer-coarse:py-1.5 ${linkClass}`}
                  >
                    {dash.continueReading.chapterTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {dash.continueReading.seriesTitle} ·{" "}
                    {dash.continueReading.read} of {dash.continueReading.total}{" "}
                    chapters read
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open a chapter in{" "}
                  <Link href="/notes" className={`underline ${linkClass}`}>
                    Notes
                  </Link>{" "}
                  and it shows up here.
                </p>
              )}
            </NextUp>

            <NextUp title="Ready to learn">
              {dash.readyNext.length > 0 ? (
                <p className="text-sm">
                  <TopicLinks topics={dash.readyNext} />
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Mark a topic done in{" "}
                  <Link href="/graphs" className={`underline ${linkClass}`}>
                    Graphs
                  </Link>{" "}
                  to unlock the next one.
                </p>
              )}
            </NextUp>
          </div>
        )}
      </section>

      <section aria-labelledby="progress" className="grid gap-3">
        <h2 id="progress" className="text-sm font-semibold text-muted-foreground">
          Your progress
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="Graphs">
            <ProgressRows
              rows={dash.graphs.map((g) => ({
                key: g.slug,
                href: `/graphs/${g.slug}`,
                label: g.title,
                value: g.done,
                max: g.total,
              }))}
              empty="No graphs published yet."
            />
          </Card>

          <Card title="Interview books (mastered)">
            <ProgressRows
              rows={dash.books.map((b) => ({
                key: b.slug,
                href: `/interview/${b.slug}`,
                label: b.title,
                value: b.mastered,
                max: b.total,
              }))}
              empty="No books published yet."
            />
          </Card>

          <Card title="Speaking today">
            <p className="text-sm">
              <Link href="/speaking" className={`font-medium ${linkClass}`}>
                {speaking.streak} {speaking.streak === 1 ? "day" : "days"} streak
              </Link>
              <span className="text-muted-foreground">
                {" "}
                · best {speaking.best}
              </span>
            </p>
            <ProgressRows
              rows={speakingTasks.map((t) => ({
                key: t,
                href: `/speaking/${TASK_SLUG[t]}`,
                label: `${speaking.done[t] ? "✓ " : ""}${TASK_LABEL[t]}`,
                value: Number(mins(speaking.minutes[t] ?? 0)),
                max: speaking.settings.targets[t],
              }))}
              empty="Every speaking task is turned off."
            />
          </Card>

          {dash.ielts && (
            <Card title="IELTS">
              <p className="text-sm">
                <Link href="/ielts" className={`font-medium ${linkClass}`}>
                  {dash.ielts.daysLeft} {dash.ielts.daysLeft === 1 ? "day" : "days"} to your test
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                {dash.ielts.total === 0
                  ? "Nothing planned for today."
                  : `${dash.ielts.done} of ${dash.ielts.total} done today`}
              </p>
            </Card>
          )}

          <Card title="Notes">
            <ProgressRows
              rows={dash.series.map((s) => ({
                key: s.slug,
                href: `/notes/${s.slug}`,
                label: s.title,
                value: s.read,
                max: s.total,
              }))}
              empty="No notes published yet."
            />
          </Card>
        </div>
      </section>

      {(dash.learningNow.length > 0 || dash.recentQuizzes.length > 0) && (
        <section aria-labelledby="activity" className="grid gap-3">
          <h2
            id="activity"
            className="text-sm font-semibold text-muted-foreground"
          >
            Recent activity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {dash.learningNow.length > 0 && (
              <Card title="Learning now">
                <ul className="grid gap-2 text-sm">
                  {dash.learningNow.map((g) => (
                    <li key={g.graphSlug}>
                      <span className="text-muted-foreground">
                        {g.graphTitle}:{" "}
                      </span>
                      <TopicLinks
                        topics={g.topics.map((t) => ({
                          ...t,
                          graphSlug: g.graphSlug,
                        }))}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {dash.recentQuizzes.length > 0 && (
              <Card title="Recent quizzes">
                <ul className="grid gap-2 text-sm">
                  {dash.recentQuizzes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="truncate">{q.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {q.got} got · {q.review} review ·{" "}
                        {dateFormat.format(q.finishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
