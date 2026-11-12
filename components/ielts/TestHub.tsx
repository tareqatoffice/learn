"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTestAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { AttemptListItem, TestSkill, TestSummary } from "@/ielts/practice/attempts";

const NAME: Record<TestSkill, string> = { listening: "Listening", reading: "Reading" };

/** Lists published tests with a full-test button and one button per section, plus recent attempts. */
export function TestHub({ skill, tests, recent }: { skill: TestSkill; tests: TestSummary[]; recent: AttemptListItem[] }) {
  const router = useRouter();
  const { run, pending, errors } = useAdminAction();
  const start = (testId: string, scope: "full" | number) =>
    run(() => startTestAction(skill, testId, scope), { refresh: false, onSuccess: (r) => router.push(`/ielts/test/${r.attemptId}`) });
  const fullMinutes = skill === "reading" ? 60 : 40;
  const sectionMinutes = skill === "reading" ? 20 : 10;

  return (
    <div className="grid gap-6">
      <ActionStatus saved={false} errors={errors} />
      {!tests.length ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          No {NAME[skill].toLowerCase()} tests are published yet. An admin adds them under Admin → IELTS Reading &amp; Listening.
        </p>
      ) : (
        <ul className="grid gap-4">
          {tests.map((t) => (
            <li key={t.id} className="grid gap-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">{t.title}</h2>
                <span className="text-xs text-muted-foreground">{t.questions} questions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={pending} onClick={() => start(t.id, "full")}>
                  Full test · {fullMinutes} min
                </Button>
                {t.sections.map((s, i) => (
                  <Button key={i} type="button" variant="outline" disabled={pending || s.questions === 0} onClick={() => start(t.id, i)}>
                    {s.title} · {s.questions} q · {sectionMinutes} min
                  </Button>
                ))}
              </div>
              {skill === "listening" && (
                <p className="text-xs text-muted-foreground">
                  In a full test the audio plays once, like the real test. Sections without a recording are read by your browser&apos;s voice.
                </p>
              )}
              {t.questions !== 40 && <p className="text-xs text-muted-foreground">Only a 40-question full test gets a band.</p>}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="recent-h" className="grid gap-2">
        <h2 id="recent-h" className="font-medium">
          Recent attempts
        </h2>
        {!recent.length ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <Link href={`/ielts/test/${a.id}`} className="font-medium hover:underline">
                  {a.title}
                </Link>
                <span className="text-muted-foreground">
                  {a.date} ·{" "}
                  {a.status === "submitted" && a.raw !== undefined
                    ? `${a.raw}/${a.total}${a.band !== undefined ? ` · about band ${a.band}` : ""}`
                    : "in progress"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
