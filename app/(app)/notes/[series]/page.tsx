import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { getSeriesView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

const loadSeries = cache(getSeriesView);

export async function generateMetadata({
  params,
}: PageProps<"/notes/[series]">): Promise<Metadata> {
  const { series: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadSeries(user.userId, slug);
  return buildMetadata({
    title: view?.series.title ?? "Notes",
    description: view?.series.description,
    path: `/notes/${encodeURIComponent(slug)}`,
  });
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ series: string }>;
}) {
  const user = await requireUser();
  const { series: slug } = await params;
  await connectDb();
  const view = await loadSeries(user.userId, slug);
  if (!view) notFound();
  const read = view.chapters.filter((c) => c.read).length;

  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-1">
        <BackLink href="/notes">← All notes</BackLink>
        <h1 className="text-2xl font-semibold">{view.series.title}</h1>
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
        <ol className="mt-3 divide-y divide-border">
          {view.chapters.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between gap-3 py-2"
            >
              <Link
                href={`/notes/${view.series.slug}/${c.slug}`}
                className="relative flex min-w-0 items-baseline gap-2 hover:underline pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">{c.title}</span>
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
