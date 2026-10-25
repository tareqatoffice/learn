import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { StartReviewButton } from "@/components/StartReviewButton";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { getDashboard } from "@/progress/dashboard";

export const metadata = { title: "Dashboard · Learn" };

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="card-interactive grid content-start gap-2 rounded-xl border border-border bg-card p-4">
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProgressRows({ rows, empty }: { rows: { key: string; href: string; label: string; value: number; max: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          <Link href={r.href} className={`truncate text-sm ${linkClass}`}>
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

export default async function DashboardPage() {
  const user = await requireUser();
  await connectDb();
  const dash = await getDashboard(user.userId);
  // requireUser falls back to the email when the Google profile has no name; never greet with an address.
  const firstName = user.name && user.name !== user.email ? user.name.split(" ")[0] : undefined;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Welcome back{firstName ? `, ${firstName}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Pick up where you left off.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Continue reading">
          {dash.continueReading ? (
            <>
              <Link
                href={`/notes/${dash.continueReading.seriesSlug}/${dash.continueReading.chapterSlug}`}
                className={`font-semibold ${linkClass}`}
              >
                {dash.continueReading.seriesTitle} › {dash.continueReading.chapterTitle}
              </Link>
              <p className="text-sm text-muted-foreground">
                {dash.continueReading.read} of {dash.continueReading.total} chapters read
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Open a chapter in <Link href="/notes" className={`underline ${linkClass}`}>Notes</Link> and it shows up here.
            </p>
          )}
        </Card>

        <Card title="Learning now">
          {dash.learningNow.length ? (
            <ul className="grid gap-2 text-sm">
              {dash.learningNow.map((g) => (
                <li key={g.graphSlug}>
                  <span className="text-muted-foreground">{g.graphTitle}: </span>
                  {g.topics.map((t, i) => (
                    <span key={t.slug}>
                      {i > 0 && " · "}
                      <Link href={`/graphs/${g.graphSlug}?topic=${encodeURIComponent(t.slug)}`} className={`font-medium ${linkClass}`}>
                        {t.title}
                      </Link>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a graph to start: <Link href="/graphs" className={`underline ${linkClass}`}>Graphs</Link>.
            </p>
          )}
          {dash.readyNext.length > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Ready next: </span>
              {dash.readyNext.map((t, i) => (
                <span key={`${t.graphSlug}/${t.slug}`}>
                  {i > 0 && " · "}
                  <Link href={`/graphs/${t.graphSlug}?topic=${encodeURIComponent(t.slug)}`} className={linkClass}>
                    {t.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </Card>

        <Card title="Review pile">
          <p className="text-lg font-semibold tabular-nums">
            {dash.reviewPile.total} question{dash.reviewPile.total === 1 ? "" : "s"}
          </p>
          {dash.reviewPile.byBook.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {dash.reviewPile.byBook.map((b) => `${b.title} ${b.count}`).join(" · ")}
            </p>
          )}
          <StartReviewButton disabled={dash.reviewPile.total === 0} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Graphs">
          <ProgressRows
            rows={dash.graphs.map((g) => ({ key: g.slug, href: `/graphs/${g.slug}`, label: g.title, value: g.done, max: g.total }))}
            empty="No graphs published yet."
          />
        </Card>

        <Card title="Interview books (mastered)">
          <ProgressRows
            rows={dash.books.map((b) => ({ key: b.slug, href: `/interview/${b.slug}`, label: b.title, value: b.mastered, max: b.total }))}
            empty="No books published yet."
          />
        </Card>

        <Card title="Recent quizzes">
          {dash.recentQuizzes.length ? (
            <ul className="grid gap-2 text-sm">
              {dash.recentQuizzes.map((q) => (
                <li key={q.id} className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{q.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {q.got} got · {q.review} review · {dateFormat.format(q.finishedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Take your first quiz in <Link href="/interview" className={`underline ${linkClass}`}>Interview</Link>.
            </p>
          )}
        </Card>
      </div>

      {dash.series.length > 0 && (
        <Card title="Notes">
          <ProgressRows
            rows={dash.series.map((s) => ({ key: s.slug, href: `/notes/${s.slug}`, label: s.title, value: s.read, max: s.total }))}
            empty="No notes published yet."
          />
        </Card>
      )}
    </div>
  );
}
