import { headingId } from "@/lib/markdown/pipeline";
import Link from "next/link";
import { MarkReadButton } from "@/features/notes/components/NoteReader";
import { ReadingPosition } from "@/features/notes/components/ReadingPosition";
import { OverlayMenu } from "@/components/OverlayMenu";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

const linkClass =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const sideClass =
  "hidden text-sm lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto";

type ChapterViewData = NonNullable<Awaited<ReturnType<typeof import("@/features/content/queries").getChapterView>>>;

export function ChapterView({ view }: { view: ChapterViewData }) {
  const position =
    view.series.chapters.findIndex((c) => c.slug === view.chapter.slug) + 1;
  const chapterList = () => (
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
  const tocList = () => (
    <ul className="mt-2 grid gap-1">
      {view.toc.map((t) => (
        <li key={t.anchor} className={t.depth === 3 ? "pl-3" : undefined}>
          <a
            href={`#${headingId(t.anchor)}`}
            className={cn("block pointer-coarse:py-1.5", linkClass)}
          >
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[13.75rem_minmax(0,1fr)_12.5rem] lg:gap-6">
      <OverlayMenu
        navLabel={`${view.series.title} chapters`}
        label={
          <>
            {view.series.title}
            <span className="font-normal text-muted-foreground">
              {" · "}chapter {position} of {view.series.chapters.length}
            </span>
          </>
        }
      >
        <Link
          href={`/notes/${view.series.slug}`}
          className={cn("mt-2 block px-2 py-2 font-semibold", linkClass)}
        >
          All chapters
        </Link>
        {chapterList()}
      </OverlayMenu>
      {view.toc.length > 0 && (
        <OverlayMenu navLabel="On this page" label="On this page">
          <div className="px-2 pb-2">{tocList()}</div>
        </OverlayMenu>
      )}

      <nav aria-label={`${view.series.title} chapters`} className={sideClass}>
        <Link
          href={`/notes/${view.series.slug}`}
          className={cn("font-semibold", linkClass)}
        >
          {view.series.title}
        </Link>
        {chapterList()}
      </nav>

      <article aria-labelledby="chapter-title" className="mt-2 min-w-0 lg:mt-0">
        <PageHeader
          titleId="chapter-title"
          title={view.chapter.title}
          track="notes"
          description={
            <>
              {view.chapter.readMinutes} min read
              {view.relatedTopics.length > 0 && (
                <>
                  {" · related topics: "}
                  {view.relatedTopics.map((t, i) => (
                    <span key={`${t.graphSlug}/${t.nodeSlug}`}>
                      {i > 0 && ", "}
                      <Link
                        href={`/graphs/${t.graphSlug}?topic=${encodeURIComponent(t.nodeSlug)}`}
                        className={cn("underline", linkClass)}
                      >
                        {t.title}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </>
          }
        />

        {view.resume && (
          <p className="mt-4 text-sm">
            <a href={`#${headingId(view.resume.anchor)}`} className={cn("underline", linkClass)}>
              Resume where you stopped: {view.resume.text}
            </a>
          </p>
        )}
        {view.toc.length > 0 && (
          <ReadingPosition
            noteId={view.chapter.id}
            initialAnchor={view.resume?.anchor}
            headings={view.toc.map((t) => ({ anchor: t.anchor, id: headingId(t.anchor) }))}
          />
        )}

        <div className="mt-6">
          <Markdown source={view.chapter.body} />
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <MarkReadButton noteId={view.chapter.id} initialRead={view.read} />
          <span className="flex w-full justify-between gap-4 text-sm sm:w-auto sm:justify-end">
            {view.prev && (
              <Link
                href={`/notes/${view.series.slug}/${view.prev.slug}`}
                className={cn("py-2", linkClass)}
              >
                ← {view.prev.title}
              </Link>
            )}
            {view.next && (
              <Link
                href={`/notes/${view.series.slug}/${view.next.slug}`}
                className={cn("ml-auto py-2 text-right", linkClass)}
              >
                Next: {view.next.title} →
              </Link>
            )}
          </span>
        </footer>
      </article>

      {view.toc.length > 0 && (
        <nav aria-label="On this page" className={sideClass}>
          <p className="font-semibold text-muted-foreground">On this page</p>
          {tocList()}
        </nav>
      )}
    </div>
  );
}
