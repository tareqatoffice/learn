"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBandEntryAction } from "@/app/(app)/ielts/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { SKILLS } from "@/ielts/bands";
import type { BandEntryView, BandSource } from "@/ielts/bandHistory";
import { SKILL_LABEL, bandLabel, dateLabel } from "./format";

const SOURCE_LABEL: Record<BandSource, string> = {
  official: "Official result",
  practice: "Practice test",
  other: "Other",
  mockSelf: "Speaking mock (your rating)",
  mockAi: "Speaking mock (AI estimate)",
  writingSelf: "Writing test (your rating)",
  writingAi: "Writing test (AI estimate)",
};

/** Saved calculator results, newest first, each removable. Mock rows are removed with their attempt. */
export function BandEntryList({ entries }: { entries: BandEntryView[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteBandEntryAction(id);
      if (!res.ok) setError(firstError(res.errors) ?? "That didn't work. Try again.");
      router.refresh();
    });
  }

  if (!entries.length) return <p className="text-sm text-muted-foreground">No saved results yet.</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <div className="grid gap-0.5">
              <span className="font-medium">
                {SOURCE_LABEL[e.source]} <span className="font-normal text-muted-foreground">· {dateLabel(e.date)}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {SKILLS.filter((s) => e.bands[s] !== undefined)
                  .map((s) => `${SKILL_LABEL[s]} ${bandLabel(e.bands[s]!)}`)
                  .join(", ")}
                {e.overall !== undefined && ` · Overall ${bandLabel(e.overall)}`}
              </span>
            </div>
            {!e.attemptId && (
              <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Delete ${SOURCE_LABEL[e.source]} from ${dateLabel(e.date)}`} onClick={() => remove(e.id)}>
                Delete
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <Notice>{error}</Notice>}
    </div>
  );
}
