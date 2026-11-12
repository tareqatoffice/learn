"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTestAttemptAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { ReviewView } from "@/ielts/practice/attempts";
import { choicesFor } from "@/ielts/practice/marking";
import { cn } from "@/lib/utils";

const mmss = (s: number) => `${Math.floor(s / 60)} min ${s % 60} s`;

/** The marked attempt: score, approximate band for a full 40-question test, and every question with its key. */
export function TestReview({ view }: { view: ReviewView }) {
  const router = useRouter();
  const del = useAdminAction();
  const byN = new Map(view.score.results.map((r) => [r.n, r]));
  const wrong = view.score.results.filter((r) => !r.correct).length;
  const back = `/ielts/${view.skill}`;

  return (
    <div className="grid gap-6">
      <section aria-label="Score" className="grid gap-1 rounded-lg border border-border p-4">
        <p className="text-2xl font-semibold">
          {view.score.raw}/{view.score.total}
        </p>
        {view.score.band !== undefined ? (
          <p className="text-sm">
            About band <strong>{view.score.band}</strong>. This uses a commonly published conversion table; it is an approximation, not an official band.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Only a full 40-question test gets a band; this one counts toward your practice time only.</p>
        )}
        <p className="text-sm text-muted-foreground">
          {view.date} · {mmss(view.timeSec)} · {wrong} wrong or blank
        </p>
      </section>

      {view.sections.map((s, si) => (
        <section key={si} className="grid gap-4" aria-label={s.title}>
          <h2 className="font-medium">{s.title}</h2>
          {s.groups.map((g, gi) => (
            <div key={gi} className="grid gap-2">
              <p className="text-sm text-muted-foreground">{g.instruction}</p>
              <ul className="grid gap-2">
                {g.questions.map((q) => {
                  const r = byN.get(q.n);
                  const label = (v: string) => {
                    const i = choicesFor(q.kind, q, g).indexOf(v.toUpperCase());
                    const text = q.kind === "mcq" ? q.options[i] : q.kind === "matching" ? g.options[i] : "";
                    return text ? `${v.toUpperCase()}. ${text}` : v;
                  };
                  return (
                    <li key={q.n} className={cn("rounded-md border p-3 text-sm", r?.correct ? "border-ok" : "border-destructive")}>
                      <p>
                        <strong>{q.n}.</strong> {q.prompt}
                      </p>
                      <p>
                        Your answer: <strong>{r?.given ? label(r.given) : "(blank)"}</strong> {r?.correct ? "✓ correct" : "✗ wrong"}
                      </p>
                      {!r?.correct && <p>Accepted: {q.answers.map(label).join(" / ")}</p>}
                      {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {s.script && (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Script</summary>
              <p className="mt-2 whitespace-pre-wrap">{s.script}</p>
            </details>
          )}
          {s.passage && (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Passage</summary>
              <p className="mt-2 whitespace-pre-wrap">{s.passage}</p>
            </details>
          )}
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Link href={back} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Back to {view.skill}
        </Link>
        <Button
          type="button"
          variant="outline"
          disabled={del.pending}
          onClick={() => del.run(() => deleteTestAttemptAction(view.id), { confirm: "Delete this attempt?", refresh: false, onSuccess: () => router.push(back) })}
        >
          Delete attempt
        </Button>
        <ActionStatus saved={false} errors={del.errors} />
      </div>
    </div>
  );
}
