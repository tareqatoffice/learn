import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Markdown } from "@/lib/markdown/Markdown";
import { pageTitleClass } from "@/lib/ui";

type SeriesViewData = NonNullable<Awaited<ReturnType<typeof import("@/content/queries").getSeriesView>>>;

export function SeriesView({ view }: { view: SeriesViewData }) {
  const read = view.chapters.filter((c) => c.read).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="grid gap-1">
        <BackLink href="/notes">← All notes</BackLink>
        <h1 className={pageTitleClass}>{view.series.title}</h1>
        <p className="text-sm text-muted-foreground">
          {read}/{view.chapters.length} chapters read
        </p>
      </header>

      <section
        aria-labelledby="chapters"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 id="chapters" className="text-lg font-semibold">
          Chapters
        </h2>
        {view.chapters.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No chapters are published in this series yet.</p>
        )}
        <ol className="mt-3 divide-y divide-border empty:hidden">
          {view.chapters.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between gap-3 py-2"
            >
              <Link
                href={`/notes/${view.series.slug}/${c.slug}`}
                className="relative flex min-w-0 items-baseline gap-2 hover:underline pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0 truncate">{c.title}</span>
                {c.read && (
                  <>
                    <span aria-hidden className="shrink-0 text-ok">
                      ✓
                    </span>
                    <span className="sr-only"> (read)</span>
                  </>
                )}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {c.readMinutes} min
              </span>
            </li>
          ))}
        </ol>
      </section>

      {view.series.description && (
        <section aria-label="About this series" className="text-sm">
          <Markdown source={view.series.description} />
        </section>
      )}
    </div>
  );
}
