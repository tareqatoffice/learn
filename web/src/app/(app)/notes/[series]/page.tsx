import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";

export default async function SeriesPage({ params }: { params: Promise<{ series: string }> }) {
  const user = await requireUser();
  const { series: slug } = await params;
  await connectDb();
  const view = await getSeriesView(user.userId, slug);
  if (!view) notFound();
  const read = view.chapters.filter((c) => c.read).length;

  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-1">
        <Link href="/notes" className="text-sm text-muted-foreground hover:underline">
          ← All notes
        </Link>
        <h1 className="text-2xl font-semibold">{view.series.title}</h1>
        <p className="text-sm text-muted-foreground">
          {read}/{view.chapters.length} chapters read
        </p>
      </header>

      <section aria-labelledby="chapters" className="rounded-xl border border-border bg-card p-5">
        <h2 id="chapters" className="text-lg font-semibold">
          Chapters
        </h2>
        <ol className="mt-3 divide-y divide-border">
          {view.chapters.map((c) => (
            <li key={c.slug} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={`/notes/${view.series.slug}/${c.slug}`}
                className="min-w-0 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span aria-hidden className="mr-2 inline-block w-4 text-ok">
                  {c.read ? "✓" : ""}
                </span>
                {c.title}
                {c.read && <span className="sr-only"> (read)</span>}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{c.readMinutes} min</span>
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
