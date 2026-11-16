import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { ProgressBar } from "@/components/ProgressBar";
import { Markdown } from "@/lib/markdown/Markdown";
import { pageTitleClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { got: "Got it", review: "Review" } as const;

type BookViewData = NonNullable<Awaited<ReturnType<typeof import("@/content/queries").getBookView>>>;

export function BookView({ view }: { view: BookViewData }) {
  const { book, parts, questions } = view;
  const mastered = questions.filter((q) => q.status === "got").length;

  return (
    <article className="w-full">
      <BackLink href="/interview">← Interview prep</BackLink>
      <h1 className={cn("mt-1", pageTitleClass)}>{book.title}</h1>
      <p className="mt-2 text-sm tabular-nums text-muted-foreground">
        {mastered} / {questions.length} mastered
      </p>
      <ProgressBar value={mastered} max={questions.length} className="mt-2" />

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
              className="rounded-lg border border-border bg-card px-4 py-3"
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
            <h2 id={`part-${part.key}`} className="text-xl font-semibold">
              {part.title}
            </h2>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {part.mastered} / {part.total}
            </span>
          </div>
          <ProgressBar
            value={part.mastered}
            max={part.total}
            className="mt-2"
          />
          {part.intro && (
            <div className="mt-3">
              <Markdown source={part.intro} />
            </div>
          )}
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {questions
              .filter((q) => q.partKey === part.key)
              .map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/interview/${book.slug}/${q.id}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0">
                      <Markdown source={q.question} inline insideLink />
                    </span>
                    {q.status && (
                      <span
                        className={
                          q.status === "got"
                            ? "shrink-0 text-xs text-ok"
                            : "shrink-0 text-xs text-track-1"
                        }
                      >
                        {STATUS_LABEL[q.status]}
                      </span>
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
