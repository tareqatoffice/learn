import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { HISTORY_LIMIT, listAttemptSessions, plural } from "@/progress/attempts";

export const metadata = buildMetadata({
  title: "Quiz answers",
  description: "Every quiz you have taken, with your written and voice answers, ready to download for review.",
  path: "/interview/history",
});

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function HistoryPage() {
  const user = await requireUser();
  await connectDb();
  const sessions = await listAttemptSessions(user.userId);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/interview" className="text-sm text-muted-foreground hover:underline">
            ← Interview prep
          </Link>
          <h1 className={pageTitleClass}>Quiz answers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your answers, the reference answers and the coach&apos;s feedback. Download them as Markdown and ask another AI
            what you are missing.
          </p>
        </div>
        {sessions.length > 0 && (
          <a href="/interview/history/export" download className={buttonVariants()}>
            Download all (.md)
          </a>
        )}
      </div>

      <section aria-label="Quizzes" className="rounded-xl border border-border bg-card p-5">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No answers yet. Take a quiz from{" "}
            <Link href="/interview" className="underline">
              Interview prep
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <Link href={`/interview/history/${s.id}`} className="block truncate font-medium hover:underline">
                    {s.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {dateFormat.format(s.startedAt)} UTC · {plural(s.attempts, "attempt")} · {s.answered} answered ·{" "}
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
          <p className="mt-3 text-xs text-muted-foreground">Showing your latest {HISTORY_LIMIT} quizzes.</p>
        )}
      </section>
    </div>
  );
}
