"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startWritingAction } from "@/app/(app)/ielts/practice-actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { WritingListItem } from "@/ielts/writing/attempts";
import type { WritingKind } from "@/ielts/writing/bands";

const OPTIONS: { kind: WritingKind; title: string; blurb: string }[] = [
  { kind: "full", title: "Full test", blurb: "Task 1 then Task 2, 60 minutes. Gets a Writing band in your history." },
  { kind: "task1", title: "Task 1 drill", blurb: "Describe a chart, 150+ words, 20 minutes." },
  { kind: "task2", title: "Task 2 drill", blurb: "An essay, 250+ words, 40 minutes." },
];
const KIND_NAME: Record<WritingKind, string> = { full: "Full test", task1: "Task 1", task2: "Task 2" };

export function WritingHub({ missing, recent }: { missing: Record<WritingKind, boolean>; recent: WritingListItem[] }) {
  const router = useRouter();
  const { run, pending, errors } = useAdminAction();
  return (
    <div className="grid gap-6">
      <ActionStatus saved={false} errors={errors} />
      <ul className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <li key={o.kind} className="grid content-between gap-3 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-medium">{o.title}</h2>
              <p className="text-sm text-muted-foreground">{o.blurb}</p>
            </div>
            {missing[o.kind] ? (
              <p className="text-xs text-muted-foreground">No published prompt yet. An admin adds them under Admin → IELTS Writing.</p>
            ) : (
              <Button type="button" disabled={pending} onClick={() => run(() => startWritingAction(o.kind), { refresh: false, onSuccess: (r) => router.push(`/ielts/writing/${r.attemptId}`) })}>
                Start
              </Button>
            )}
          </li>
        ))}
      </ul>
      <section aria-labelledby="recent-w" className="grid gap-2">
        <h2 id="recent-w" className="font-medium">
          Recent attempts
        </h2>
        {!recent.length ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <Link href={`/ielts/writing/${a.id}`} className="font-medium hover:underline">
                  {KIND_NAME[a.kind]} · {a.date}
                </Link>
                <span className="text-muted-foreground">
                  {a.status === "submitted" ? `${a.words} words${a.selfBand !== null ? ` · you rated ${a.selfBand}` : " · not rated yet"}` : "in progress"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
