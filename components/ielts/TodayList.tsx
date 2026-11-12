"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logStudyAction } from "@/app/(app)/ielts/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { TodayItem } from "@/ielts/progress";
import { cn } from "@/lib/utils";

function LogMinutes({ item }: { item: TodayItem }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(String(item.minutes));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function log() {
    setError(null);
    start(async () => {
      const res = await logStudyAction(item.skill, Number(minutes));
      if (!res.ok) {
        setError(firstError(res.errors) ?? "That didn't save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        log();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Minutes done for {item.label}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={480}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <span className="text-muted-foreground">min</span>
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        Log minutes
      </Button>
      {error && <Notice>{error}</Notice>}
    </form>
  );
}

/** Today's items from this week's targets. Speaking items link to the practice screens; the other skills are logged by hand. */
export function TodayList({ items }: { items: TodayItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="today-title" className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </h2>
        {items.length > 0 && (
          <p className="text-sm tabular-nums text-muted-foreground">
            {doneCount} of {items.length} done
          </p>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is planned for today. It isn&apos;t one of your study days, or this week&apos;s targets are met.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                    item.done ? "border-ok bg-ok text-background" : "border-border",
                  )}
                >
                  {item.done && <Check className="size-3.5" />}
                </span>
                <div>
                  <p className={cn("text-sm font-medium", item.done && "text-muted-foreground line-through")}>
                    {item.label} <span className="font-normal text-muted-foreground no-underline">· {item.minutes} min</span>
                  </p>
                  <p className="sr-only">{item.done ? "Done" : "Not done yet"}</p>
                  {item.skill !== "speaking" && !item.done && (
                    <p className="text-xs text-muted-foreground">Practise here, or study elsewhere and log your minutes.</p>
                  )}
                </div>
              </div>
              {item.href && !item.done && (
                <Link
                  href={item.href}
                  className="rounded-md border border-border px-3 py-1.5 text-center text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Start
                </Link>
              )}
              {item.skill !== "speaking" && !item.done && <LogMinutes item={item} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
