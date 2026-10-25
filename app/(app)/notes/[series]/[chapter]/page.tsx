import { ChevronDown } from "lucide-react";
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
// Below lg the chapter list and page outline fold into these disclosures above the text, so the chapter
// itself starts on the first screen; from lg they are the side columns.
const disclosureClass = "group rounded-lg border border-border bg-card text-sm lg:hidden";
const summaryClass =
  "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden";
const sideClass = "hidden text-sm lg:sticky lg:top-20 lg:block lg:self-start";

export default async function ChapterPage({ params }: { params: Promise<{ series: string; chapter: string }> }) {
  const user = await requireUser();
  const { series, chapter } = await params;
  await connectDb();
  const view = await getChapterView(user.userId, series, chapter);
  if (!view) notFound();
  await openNote(user.userId, view.chapter.id);

  const position = view.series.chapters.findIndex((c) => c.slug === view.chapter.slug) + 1;
  const chapterList = (
    <ol className="mt-2 grid gap-1">
      {view.series.chapters.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/notes/${view.series.slug}/${c.slug}`}
            aria-current={c.slug === view.chapter.slug ? "page" : undefined}
            className={cn(
              "relative flex items-start gap-1.5 rounded px-2 py-1 pointer-coarse:py-2",
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
  );
  const tocList = view.toc.length > 0 && (
    <ul className="mt-2 grid gap-1">
      {view.toc.map((t) => (
        <li key={t.anchor} className={t.depth === 3 ? "pl-3" : undefined}>
          <a href={`#${t.anchor}`} className={cn("block pointer-coarse:py-1.5", linkClass)}>
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[13.75rem_minmax(0,1fr)_12.5rem] lg:gap-6">
      <details className={disclosureClass}>
        <summary className={summaryClass}>
          <span className="min-w-0 truncate">
            {view.series.title}
            <span className="font-normal text-muted-foreground">
              {" · "}chapter {position} of {view.series.chapters.length}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label={`${view.series.title} chapters`} className="border-t border-border px-2 pb-2">
          <Link href={`/notes/${view.series.slug}`} className={cn("mt-2 block px-2 py-2 font-semibold", linkClass)}>
            All chapters
          </Link>
          {chapterList}
        </nav>
      </details>
      {tocList && (
        <details className={disclosureClass}>
          <summary className={summaryClass}>
            On this page
            <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <nav aria-label="On this page" className="border-t border-border px-4 pb-3">
            {tocList}
          </nav>
        </details>
      )}

      <nav aria-label={`${view.series.title} chapters`} className={sideClass}>
        <Link href={`/notes/${view.series.slug}`} className={cn("font-semibold", linkClass)}>
          {view.series.title}
        </Link>
        {chapterList}
      </nav>

      <article aria-labelledby="chapter-title" className="mt-2 min-w-0 lg:mt-0">
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
          {/* On phones prev/next take a full-width row of large targets, the way a reader moves on. */}
          <span className="flex w-full justify-between gap-4 text-sm sm:w-auto sm:justify-end">
            {view.prev && (
              <Link href={`/notes/${view.series.slug}/${view.prev.slug}`} className={cn("py-2", linkClass)}>
                ← {view.prev.title}
              </Link>
            )}
            {view.next && (
              <Link href={`/notes/${view.series.slug}/${view.next.slug}`} className={cn("ml-auto py-2 text-right", linkClass)}>
                Next: {view.next.title} →
              </Link>
            )}
          </span>
        </footer>
      </article>

      {tocList && (
        <nav aria-label="On this page" className={sideClass}>
          <p className="font-semibold text-muted-foreground">On this page</p>
          {tocList}
        </nav>
      )}
    </div>
  );
}
