import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkReadButton } from "@/components/NoteReader";
import { getChapterView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { openNote } from "@/progress/notes";
import { cn } from "@/lib/utils";

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function ChapterPage({ params }: { params: Promise<{ series: string; chapter: string }> }) {
  const user = await requireUser();
  const { series, chapter } = await params;
  await connectDb();
  const view = await getChapterView(user.userId, series, chapter);
  if (!view) notFound();
  await openNote(user.userId, view.chapter.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_200px]">
      <nav aria-label={`${view.series.title} chapters`} className="text-sm lg:sticky lg:top-4 lg:self-start">
        <Link href={`/notes/${view.series.slug}`} className={cn("font-semibold", linkClass)}>
          {view.series.title}
        </Link>
        <ol className="mt-2 grid gap-1">
          {view.series.chapters.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/notes/${view.series.slug}/${c.slug}`}
                aria-current={c.slug === view.chapter.slug ? "page" : undefined}
                className={cn(
                  "relative flex items-start gap-1.5 rounded px-2 py-1",
                  c.slug === view.chapter.slug ? "bg-muted font-medium" : "",
                  linkClass,
                )}
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
            </li>
          ))}
        </ol>
      </nav>

      <article aria-labelledby="chapter-title" className="min-w-0">
        <h1 id="chapter-title" className="text-2xl font-semibold">
          {view.chapter.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {view.chapter.readMinutes} min read
          {view.relatedTopics.length > 0 && (
            <>
              {" · related topics: "}
              {view.relatedTopics.map((t, i) => (
                <span key={`${t.graphSlug}/${t.nodeSlug}`}>
                  {i > 0 && ", "}
                  <Link href={`/graphs/${t.graphSlug}?topic=${encodeURIComponent(t.nodeSlug)}`} className={cn("underline", linkClass)}>
                    {t.title}
                  </Link>
                </span>
              ))}
            </>
          )}
        </p>

        <div className="mt-6">
          <Markdown source={view.chapter.body} />
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <MarkReadButton noteId={view.chapter.id} initialRead={view.read} />
          <span className="flex gap-4 text-sm">
            {view.prev && (
              <Link href={`/notes/${view.series.slug}/${view.prev.slug}`} className={linkClass}>
                ← {view.prev.title}
              </Link>
            )}
            {view.next && (
              <Link href={`/notes/${view.series.slug}/${view.next.slug}`} className={linkClass}>
                Next: {view.next.title} →
              </Link>
            )}
          </span>
        </footer>
      </article>

      {view.toc.length > 0 && (
        <nav aria-label="On this page" className="text-sm lg:sticky lg:top-4 lg:self-start">
          <p className="font-semibold text-muted-foreground">On this page</p>
          <ul className="mt-2 grid gap-1">
            {view.toc.map((t) => (
              <li key={t.anchor} className={t.depth === 3 ? "pl-3" : undefined}>
                <a href={`#${t.anchor}`} className={linkClass}>
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
