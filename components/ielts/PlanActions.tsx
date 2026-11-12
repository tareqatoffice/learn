"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAllIeltsDataAction, endPlanAction, removeAdjustmentAction } from "@/app/(app)/ielts/actions";
import { firstError, type ActionResult } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";

/** Runs an action, refreshes the page on success and shows its error otherwise. */
function useAction(onDone?: (router: ReturnType<typeof useRouter>) => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setError(firstError(res.errors) ?? "That didn't work. Try again.");
        return;
      }
      if (onDone) onDone(router);
      else router.refresh();
    });
  }
  return { run, error, pending };
}

export function EndPlanButton({ variant = "outline" }: { variant?: "outline" | "destructive" }) {
  const { run, error, pending } = useAction();
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (!window.confirm("End this plan? Your history and band entries stay. You can start a new plan any time.")) return;
          run(endPlanAction);
        }}
      >
        End this plan
      </Button>
      {error && <Notice>{error}</Notice>}
    </div>
  );
}

export function DeleteIeltsDataButton() {
  const { run, error, pending } = useAction((router) => {
    router.push("/ielts");
    router.refresh();
  });
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Delete all your IELTS data? Your profile, plans, band entries, study logs and Speaking recordings are removed for good. Speaking Practice is not affected. This cannot be undone.",
            )
          )
            return;
          run(deleteAllIeltsDataAction);
        }}
      >
        Delete my IELTS data
      </Button>
      {error && <Notice>{error}</Notice>}
    </div>
  );
}

/** Removes one standing change from the plan (a new plan version). */
export function RemoveAdjustmentButton({ id, label }: { id: string; label: string }) {
  const { run, error, pending } = useAction();
  return (
    <div className="grid justify-items-end gap-1">
      <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Remove change: ${label}`} onClick={() => run(() => removeAdjustmentAction(id))}>
        Remove
      </Button>
      {error && <Notice>{error}</Notice>}
    </div>
  );
}
