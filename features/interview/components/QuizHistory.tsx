import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { buttonVariants } from "@/components/ui/button";
import { HISTORY_LIMIT, plural } from "@/features/progress/attempts";

type Session = Awaited<ReturnType<typeof import("@/features/progress/attempts").listAttemptSessions>>[number];

export function QuizHistory({
  sessions,
  timeZone,
}: {
  sessions: Session[];
  timeZone: string;
}) {
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone });

  return (
    <div className="grid w-full gap-6">
      <div className="grid gap-3">
        <BackLink href="/interview">← Interview prep</BackLink>
        <PageHeader
          title="Quiz answers"
          track="interview"
          description="Your answers, the reference answers and the coach's feedback. Download them as Markdown and ask another AI what you are missing."
          actions={
            sessions.length > 0 ? (
              <a href="/interview/history/export" download className={buttonVariants()}>
                Download all (.md)
              </a>
            ) : undefined
          }
        />
      </div>

      <Panel title="Quizzes" track="interview">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No answers yet. Take a quiz from{" "}
            <Link href="/interview" className="underline">
              Interview prep
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-0.5">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <Link href={`/interview/history/${s.id}`} className="block truncate font-medium hover:underline">
                    {s.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {dateFormat.format(s.startedAt)} · {plural(s.attempts, "attempt")} · {s.answered} answered ·{" "}
                    {s.counts.got} got · {s.counts.review} review{s.finishedAt ? "" : " · unfinished"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Link href={`/interview/history/${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View
                  </Link>
                  <a
                    href={`/interview/history/export?session=${s.id}`}
                    download
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    .md
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        {sessions.length >= HISTORY_LIMIT && (
          <p className="text-xs text-muted-foreground">Showing your latest {HISTORY_LIMIT} quizzes.</p>
        )}
      </Panel>
    </div>
  );
}
