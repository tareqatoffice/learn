import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { QuizSetup } from "@/components/QuizSetup";
import { listBooksWithProgress } from "@/content/queries";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { listUnfinished } from "@/progress/quiz";

export const metadata = { title: "Interview · Learn" };

export default async function InterviewPage() {
  const user = await requireUser();
  await connectDb();
  const [books, unfinished] = await Promise.all([listBooksWithProgress(user.userId), listUnfinished(user.userId)]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <QuizSetup books={books.map(({ id, title, parts }) => ({ id, title, parts }))} />

      <div className="grid content-start gap-6">
        {unfinished.length > 0 && (
          <section aria-labelledby="unfinished" className="rounded-xl border border-border bg-card p-5">
            <h2 id="unfinished" className="text-lg font-semibold">
              Unfinished quizzes
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {unfinished.map((quiz) => (
                <li key={quiz.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{quiz.label || "Quiz"}</span>
                    <span className="text-xs text-muted-foreground">
                      {quiz.position} / {quiz.total} done
                    </span>
                  </span>
                  <Link
                    href={`/interview/quiz/${quiz.id}`}
                    className="shrink-0 rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Resume
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="books" className="rounded-xl border border-border bg-card p-5">
          <h2 id="books" className="text-lg font-semibold">
            Question books
          </h2>
          {books.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No books published yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {books.map((book) => (
                <li key={book.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/interview/${book.slug}`}
                      className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {book.title}
                    </Link>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {book.mastered} / {book.total} mastered
                    </span>
                  </div>
                  <ProgressBar value={book.mastered} max={book.total} className="mt-2" />
                  {book.review > 0 && <p className="mt-1 text-xs text-muted-foreground">{book.review} in the review pile</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
