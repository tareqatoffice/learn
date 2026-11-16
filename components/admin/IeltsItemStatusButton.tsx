"use client";

import { setItemStatusAction } from "@/app/(app)/admin/ielts/speaking/actions";
import type { ItemStatus } from "@/admin/ielts";
import { firstError } from "@/admin/result";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

/** Publishes or unpublishes one row of the IELTS Speaking list. */
export function IeltsItemStatusButton({ id, status, label }: { id: string; status: ItemStatus; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const error = firstError(errors);
  const next = status === "published" ? "draft" : "published";
  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        aria-label={`${next === "published" ? "Publish" : "Unpublish"} ${label}`}
        onClick={() => run(() => setItemStatusAction(id, next))}
      >
        {next === "published" ? "Publish" : "Unpublish"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
