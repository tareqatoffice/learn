import Link from "next/link";
import { notFound } from "next/navigation";
import { OverlayMenu } from "@/components/OverlayMenu";
import { getQuestionView, type QuestionStep } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { cn } from "@/lib/utils";
import { cache } from "react";
import type { Metadata } from "next";
import { buildMetadata, toDescription } from "@/lib/seo";

const linkClass =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
// Below lg the section list is an overlay above the question, matching the notes chapter list.
// The desktop column scrolls on its own so a long list stays reachable under the sticky header.
const sideClass =
  "hidden text-sm lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto";

const loadQuestion = cache(getQuestionView);

export async function generateMetadata({
  params,
}: PageProps<"/interview/[book]/[questionId]">): Promise<Metadata> {
  const { book: bookSlug, questionId } = await params;
  await requireUser();
  await connectDb();
  const view = await loadQuestion(bookSlug, questionId);
  return buildMetadata({
    title: view
      ? toDescription(view.question.question, "Question")
      : "Question",
    description: view?.question.answer,
    path: `/interview/${encodeURIComponent(bookSlug)}/${encodeURIComponent(questionId)}`,
  });
}

function sectionHref(bookSlug: string, part: { key: string; firstQuestionId?: string }) {
  if (part.firstQuestionId) return `/interview/${bookSlug}/${part.firstQuestionId}`;
  return `/interview/${bookSlug}#part-${part.key}`;
}

function QuestionStepLink({
  direction,
  step,
  currentPartKey,
  bookSlug,
}: {
  direction: "prev" | "next";
  step: QuestionStep;
  currentPartKey: string;
  bookSlug: string;
}) {
  const crosses = step.partKey !== currentPartKey && step.partTitle.length > 0;
  return (
    <Link
      href={`/interview/${bookSlug}/${step.id}`}
      className={cn(
        "block min-w-0 max-w-[18rem] py-2",
        direction === "next" && "ml-auto text-right",
        linkClass,
      )}
    >
      <span className="line-clamp-2">
        {direction === "prev" && "← "}
        {crosses ? (
          direction === "next" ? (
            `Next section: ${step.partTitle}`
          ) : (
            `Previous section: ${step.partTitle}`
          )
        ) : (
          <>
            {direction === "next" && "Next: "}
            <Markdown source={step.question} inline insideLink />
          </>
        )}
        {direction === "next" && " →"}
      </span>
    </Link>
  );
}

export default async function QuestionPage({
  params,
}: PageProps<"/interview/[book]/[questionId]">) {
  const { book: bookSlug, questionId } = await params;
  await requireUser();
  await connectDb();
  const view = await loadQuestion(bookSlug, questionId);
  if (!view) notFound();

  const { question, book, topic, part } = view;
  const position = view.parts.findIndex((item) => item.key === part.key) + 1;
  // Called twice: the overlay and the sidebar each need their own element tree.
  const sectionList = () => (
    <ol className="mt-2 grid gap-1">
      {view.parts.map((item) => {
        const current = item.key === part.key;
        return (
          <li key={item.key}>
            <Link
              href={sectionHref(book.slug, item)}
              aria-current={current ? (item.firstQuestionId === question.id ? "page" : "true") : undefined}
              className={cn(
                "relative flex items-start gap-1.5 rounded px-2 py-1 pointer-coarse:py-2",
                current ? "bg-muted font-medium" : "",
                linkClass,
              )}
            >
              <span className="min-w-0">{item.title}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[13.75rem_minmax(0,48rem)] lg:gap-6">
      <OverlayMenu
        navLabel={`${book.title} sections`}
        label={
          <>
            {book.title}
            {position > 0 && (
              <span className="font-normal text-muted-foreground">
                {" · "}section {position} of {view.parts.length}
              </span>
            )}
          </>
        }
      >
        <Link
          href={`/interview/${book.slug}`}
          className={cn("mt-2 block px-2 py-2 font-semibold", linkClass)}
        >
          All questions
        </Link>
        {sectionList()}
      </OverlayMenu>

      <nav aria-label={`${book.title} sections`} className={sideClass}>
        <Link
          href={`/interview/${book.slug}`}
          className={cn("font-semibold", linkClass)}
        >
          {book.title}
        </Link>
        {sectionList()}
      </nav>

      <article className="min-w-0">
        <p className="text-sm text-muted-foreground">
          <Link href="/interview" className={linkClass}>
            Interview
          </Link>
          {" › "}
          <Link href={`/interview/${book.slug}`} className={linkClass}>
            {book.title}
          </Link>
          {part.title && (
            <>
              {" › "}
              <span>{part.title}</span>
            </>
          )}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug">
          <Markdown source={question.question} inline />
        </h1>
        {question.prompt && (
          <div className="mt-4">
            <Markdown source={question.prompt} />
          </div>
        )}
        <section
          aria-label="Answer"
          className="mt-4 rounded-lg border border-border bg-card p-4"
        >
          <Markdown source={question.answer} />
        </section>
        {topic && (
          <p className="mt-4 text-sm">
            <Link
              href={`/graphs/${encodeURIComponent(topic.graphSlug)}?topic=${encodeURIComponent(topic.nodeSlug)}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Graph topic: {topic.title}
            </Link>
          </p>
        )}
        {(view.prev || view.next) && (
          <nav aria-label="Previous and next" className="mt-8 border-t border-border pt-4">
            <div className="flex w-full items-start justify-between gap-4 text-sm">
              {view.prev && (
                <QuestionStepLink
                  direction="prev"
                  step={view.prev}
                  currentPartKey={part.key}
                  bookSlug={book.slug}
                />
              )}
              {view.next && (
                <QuestionStepLink
                  direction="next"
                  step={view.next}
                  currentPartKey={part.key}
                  bookSlug={book.slug}
                />
              )}
            </div>
          </nav>
        )}
      </article>
    </div>
  );
}
