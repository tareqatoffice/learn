import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { getBookView } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

const STATUS_LABEL = { got: "Got it", review: "Review" } as const;

const loadBook = cache(getBookView);

export async function generateMetadata({
  params,
}: PageProps<"/interview/[book]">): Promise<Metadata> {
  const { book: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadBook(user.userId, slug);
  return buildMetadata({
    title: view?.book.title ?? "Interview",
    description: view?.book.intro,
    path: `/interview/${encodeURIComponent(slug)}`,
  });
}

export default async function BookPage({
  params,
}: PageProps<"/interview/[book]">) {
  const { book: slug } = await params;
  const user = await requireUser();
  await connectDb();
  const view = await loadBook(user.userId, slug);
  if (!view) notFound();

  const { book, parts, questions } = view;
  const mastered = questions.filter((q) => q.status === "got").length;

  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="text-sm">
        <Link
          href="/interview"
          className="text-muted-foreground hover:underline"
        >
          Interview
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{book.title}</h1>
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
