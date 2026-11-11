import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { Markdown } from "@/lib/markdown/Markdown";
import { ANSWER_MODE_LABEL } from "@/lib/quiz-answer";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { getAttemptLogs, MARK_LABEL, plural, VERDICT_LABEL } from "@/progress/attempts";

export async function generateMetadata({ params }: PageProps<"/interview/history/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  return buildMetadata({
    title: "Quiz answers",
    description: "Your answers to one quiz, with the reference answers and coach feedback.",
    path: `/interview/history/${encodeURIComponent(sessionId)}`,
  });
}

export default async function SessionHistoryPage({ params }: PageProps<"/interview/history/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireUser();
  await connectDb();
  const [log] = await getAttemptLogs(user.userId, sessionId);
  if (!log) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/interview/history" className="text-sm text-muted-foreground hover:underline">
            ← All quiz answers
          </Link>
          <h1 className={pageTitleClass}>{log.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plural(log.attempts, "attempt")} · {log.answered} answered · {log.counts.got} got · {log.counts.review} review ·{" "}
            {log.counts.skip} skipped
          </p>
        </div>
        <a href={`/interview/history/export?session=${log.id}`} download className={buttonVariants()}>
          Download (.md)
        </a>
      </div>

      {log.items.length === 0 && <p className="text-sm text-muted-foreground">No cards marked in this quiz yet.</p>}
      <ol className="grid gap-4">
        {log.items.map((item, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{item.question ? [item.question.bookTitle, item.question.partTitle].filter(Boolean).join(" · ") : ""}</span>
              <span>
                {MARK_LABEL[item.result]}
                {item.answerMode && ` · ${ANSWER_MODE_LABEL[item.answerMode]}`}
              </span>
            </div>
            <h2 className="mt-2 font-semibold">
              {i + 1}. {item.question ? <Markdown source={item.question.question} inline /> : "This question is no longer available"}
            </h2>
            <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm">
              <p className="text-muted-foreground">Your answer</p>
              <p className="mt-1 whitespace-pre-wrap">{item.answer.trim() || "No answer given."}</p>
            </div>
            {item.coach?.verdict && (
              <div className="mt-3 rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">
                  {VERDICT_LABEL[item.coach.verdict]}
                  {item.coach.score !== undefined && ` · ${item.coach.score} / 100`}
                </p>
                {item.coach.summary && <p className="mt-1">{item.coach.summary}</p>}
                {item.coach.missing && item.coach.missing.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {item.coach.missing.map((m, j) => (
                      <li key={j}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {item.question && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Reference answer</summary>
                <div className="mt-2">
                  <Markdown source={item.question.reference} />
                </div>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
