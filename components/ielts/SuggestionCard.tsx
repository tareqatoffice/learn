"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveSuggestionAction, dismissSuggestionAction } from "@/app/(app)/ielts/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { SuggestionView } from "@/ielts/suggestions";
import { PlanPreview } from "./PlanPreview";

/** One pending plan suggestion. The plan changes only when the learner clicks approve. */
export function SuggestionCard({ suggestion }: { suggestion: SuggestionView }) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function decide(action: typeof approveSuggestionAction | typeof dismissSuggestionAction) {
    setError(null);
    start(async () => {
      const res = await action(suggestion.id);
      if (!res.ok) setError(firstError(res.errors) ?? "That didn't work. Try again.");
      // Also on failure: a stale suggestion is gone from the server, so reloading drops it.
      router.refresh();
    });
  }

  return (
    <li className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm">{suggestion.reason}</p>
      {showPreview && <PlanPreview {...suggestion.preview} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending} onClick={() => decide(approveSuggestionAction)}>
          Approve
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => decide(dismissSuggestionAction)}>
          Dismiss
        </Button>
        <Button type="button" variant="ghost" aria-expanded={showPreview} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? "Hide preview" : "See preview"}
        </Button>
      </div>
      {error && <Notice>{error}</Notice>}
    </li>
  );
}
