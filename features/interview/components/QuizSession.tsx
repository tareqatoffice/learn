import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";
import { ANSWER_MODE_LABEL } from "@/lib/quiz-answer";
import { MARK_LABEL, plural, VERDICT_LABEL } from "@/features/progress/attempts";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

type Log = NonNullable<Awaited<ReturnType<typeof import("@/features/progress/attempts").getAttemptLogs>>[number]>;

export function QuizSession({ log }: { log: Log }) {
  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/interview/history">← All quiz answers</BackLink>
        <PageHeader
          title={log.label}
          track="interview"
          description={
            <>
              {plural(log.attempts, "attempt")} · {log.answered} answered · {log.counts.got} got · {log.counts.review}{" "}
              review · {log.counts.skip} skipped
            </>
          }
          actions={
            <>
              {!log.finishedAt && (
                <Link href={`/interview/quiz/${log.id}`} className={buttonVariants({ variant: "outline" })}>
                  Resume quiz
                </Link>
              )}
              <a href={`/interview/history/export?session=${log.id}`} download className={buttonVariants()}>
                Download (.md)
              </a>
            </>
          }
        />
      </div>

      {log.items.length === 0 && <p className="text-sm text-muted-foreground">No cards marked in this quiz yet.</p>}
      <ol className="grid gap-4">
        {log.items.map((item, i) => (
          <Card as="li" key={i}>
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
                {item.coach.strengths && item.coach.strengths.length > 0 && (
                  <>
                    <p className="mt-2 text-muted-foreground">What you got right</p>
                    <ul className="mt-1 list-disc pl-5">
                      {item.coach.strengths.map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {item.coach.missing && item.coach.missing.length > 0 && (
                  <>
                    <p className="mt-2 text-muted-foreground">Missing</p>
                    <ul className="mt-1 list-disc pl-5">
                      {item.coach.missing.map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {item.coach?.chat && item.coach.chat.length > 0 && (
              <details className="mt-3 rounded-lg border border-border p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Follow-up with the coach</summary>
                <ol className="mt-2 grid gap-2">
                  {item.coach.chat.map((m, j) => (
                    <li key={j}>
                      <span className="font-medium">{m.role === "user" ? "You" : "Coach"}:</span>{" "}
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {item.question && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Reference answer</summary>
                <div className="mt-2">
                  <Markdown source={item.question.reference} />
                </div>
              </details>
            )}
          </Card>
        ))}
      </ol>
    </div>
  );
}
