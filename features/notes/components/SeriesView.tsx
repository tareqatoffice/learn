import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { ProgressBar } from "@/components/ProgressBar";
import { focusRing, trackVar } from "@/components/track";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";

type SeriesViewData = NonNullable<Awaited<ReturnType<typeof import("@/features/content/queries").getSeriesView>>>;

export function SeriesView({ view }: { view: SeriesViewData }) {
  const read = view.chapters.filter((c) => c.read).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid gap-3">
        <BackLink href="/notes">← All notes</BackLink>
        <PageHeader
          title={view.series.title}
          track="notes"
          description={`${read}/${view.chapters.length} chapters read`}
        />
        <ProgressBar value={read} max={view.chapters.length} color={trackVar("notes")} />
      </div>

      <Panel title="Chapters" track="notes">
        {view.chapters.length === 0 && (
          <p className="text-sm text-muted-foreground">No chapters are published in this series yet.</p>
        )}
        <ol className="grid gap-0.5 empty:hidden">
          {view.chapters.map((c, i) => (
            <li key={c.slug}>
              <Link
                href={`/notes/${view.series.slug}/${c.slug}`}
                className={cn(
                  "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60 pointer-coarse:py-3",
                  focusRing,
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums",
                    c.read ? "bg-ok/15 text-ok" : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.read ? "✓" : i + 1}
                </span>
                <span className="min-w-0 truncate">
                  {c.title}
                  {c.read && <span className="sr-only"> (read)</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.readMinutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>

      {view.series.description && (
        <section aria-label="About this series" className="text-sm">
          <Markdown source={view.series.description} />
        </section>
      )}
    </div>
  );
}
