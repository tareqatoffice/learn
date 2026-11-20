import Link from "next/link";
import { ClearProgress } from "@/features/interview/components/ClearProgress";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { ProgressBar } from "@/components/ProgressBar";
import { TileGrid } from "@/components/TileGrid";
import { buttonVariants } from "@/components/ui/button";
import { focusRing, trackVar } from "@/components/track";
import { DiscardQuizButton } from "@/features/interview/components/DiscardQuizButton";
import { QuizSetup } from "@/features/interview/components/QuizSetup";
import type { listBooksWithProgress } from "@/features/content/queries";
import type { listUnfinished } from "@/features/progress/quiz";
import { cn } from "@/lib/utils";

type Book = Awaited<ReturnType<typeof listBooksWithProgress>>[number];
type Unfinished = Awaited<ReturnType<typeof listUnfinished>>[number];

export function InterviewHome({
  books,
  unfinished,
}: {
  books: Book[];
  unfinished: Unfinished[];
}) {
  const mastered = books.reduce((n, b) => n + b.mastered, 0);
  const total = books.reduce((n, b) => n + b.total, 0);
  const review = books.reduce((n, b) => n + b.review, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Interview prep"
        track="interview"
        description={
          total > 0
            ? `${mastered} of ${total} questions mastered${review > 0 ? `, ${review} in the review pile` : ""}.`
            : undefined
        }
        actions={
          <Link href="/interview/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
            My quiz answers
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <QuizSetup
          books={books.map(({ id, title, parts }) => ({ id, title, parts }))}
        />

        <div className="grid min-w-0 content-start gap-6">
          {unfinished.length > 0 && (
            <Panel title="Unfinished quizzes" track="interview">
              <ul className="grid gap-1">
                {unfinished.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                  >
                    <span className="grid min-w-0 flex-1 gap-1.5">
                      <span className="block truncate text-sm font-medium">
                        {quiz.label || "Quiz"}
                      </span>
                      <ProgressBar value={quiz.position} max={quiz.total} color={trackVar("interview")} />
                      <span className="text-xs text-muted-foreground">
                        {quiz.position} / {quiz.total} done
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <DiscardQuizButton sessionId={quiz.id} label={quiz.label || "Quiz"} />
                      <Link
                        href={`/interview/quiz/${quiz.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), focusRing)}
                      >
                        Resume
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Question books" track="interview">
            <TileGrid
              track="interview"
              empty="No books published yet."
              className="sm:grid-cols-1 lg:grid-cols-1"
              tiles={books.map((book) => ({
                key: book.id,
                href: `/interview/${book.slug}`,
                title: book.title,
                value: book.mastered,
                max: book.total,
                stat: `${book.mastered} / ${book.total} mastered`,
                meta: book.review > 0 ? `${book.review} in the review pile` : undefined,
              }))}
            />
          </Panel>

          {books.length > 0 && (
            <ClearProgress books={books.map(({ id, title }) => ({ id, title }))} />
          )}
        </div>
      </div>
    </div>
  );
}
