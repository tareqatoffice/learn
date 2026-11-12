"use client";

import { setItemStatusAction } from "@/app/(app)/admin/ielts/speaking/actions";
import type { ItemStatus } from "@/admin/ielts";
import { firstError } from "@/admin/result";
import { useAdminAction } from "@/components/admin/useAdminAction";

/** Publishes or unpublishes one row of the IELTS Speaking list. */
export function IeltsItemStatusButton({ id, status, label }: { id: string; status: ItemStatus; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const error = firstError(errors);
  const next = status === "published" ? "draft" : "published";
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border border-border px-2 py-0.5 text-xs pointer-coarse:min-h-9 hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
        disabled={pending}
        aria-label={`${next === "published" ? "Publish" : "Unpublish"} ${label}`}
        onClick={() => run(() => setItemStatusAction(id, next))}
      >
        {next === "published" ? "Publish" : "Unpublish"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
