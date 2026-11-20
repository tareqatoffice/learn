import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/ui/badge";
import { focusRing, trackVar } from "@/components/track";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { got: "Got it", review: "Review" } as const;

type BookViewData = NonNullable<Awaited<ReturnType<typeof import("@/features/content/queries").getBookView>>>;

export function BookView({ view }: { view: BookViewData }) {
  const { book, parts, questions } = view;
  const mastered = questions.filter((q) => q.status === "got").length;

  return (
    <article className="w-full">
      <div className="grid gap-3">
        <BackLink href="/interview">← Interview prep</BackLink>
        <PageHeader
          title={book.title}
          track="interview"
          description={
            <span className="tabular-nums">
              {mastered} / {questions.length} mastered
            </span>
          }
        />
        <ProgressBar value={mastered} max={questions.length} color={trackVar("interview")} />
      </div>

      {book.intro && (
        <div className="mt-6">
          <Markdown source={book.intro} />
        </div>
      )}

      {book.extras.length > 0 && (
        <div className="mt-6 grid gap-2">
          {book.extras.map((extra) => (
            <details
              key={extra.key}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <summary className="cursor-pointer font-medium">
                {extra.title}
              </summary>
              <div className="mt-3">
                <Markdown source={extra.body} />
              </div>
            </details>
          ))}
        </div>
      )}

      {parts.map((part) => (
        <section
          key={part.key}
          aria-labelledby={`part-${part.key}`}
          className="mt-10"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`part-${part.key}`} className="text-xl font-semibold tracking-tight">
              {part.title}
            </h2>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {part.mastered} / {part.total}
            </span>
          </div>
          <ProgressBar
            value={part.mastered}
            max={part.total}
            color={trackVar("interview")}
            className="mt-2"
          />
          {part.intro && (
            <div className="mt-3">
              <Markdown source={part.intro} />
            </div>
          )}
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {questions
              .filter((q) => q.partKey === part.key)
              .map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/interview/${book.slug}/${q.id}`}
                    className={cn(
                      focusRing,
                      "flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60 focus-visible:-outline-offset-2",
                    )}
                  >
                    <span className="min-w-0">
                      <Markdown source={q.question} inline insideLink />
                    </span>
                    {q.status && (
                      <Badge variant={q.status === "got" ? "ok" : "track"}>{STATUS_LABEL[q.status]}</Badge>
                    )}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
