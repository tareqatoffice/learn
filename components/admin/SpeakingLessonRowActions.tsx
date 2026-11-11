"use client";

import { moveLessonAction } from "@/app/(app)/admin/speaking/actions";
import { firstError } from "@/admin/result";
import { useAdminAction } from "@/components/admin/useAdminAction";

const buttonClass =
  "rounded border border-border px-2 py-0.5 text-xs pointer-coarse:min-h-9 pointer-coarse:min-w-9 hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring";

/** Up/down for one row of the speaking lessons list. */
export function SpeakingLessonRowActions({ id, label }: { id: string; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const error = firstError(errors);
  return (
    <span className="flex items-center gap-1">
      <button type="button" className={buttonClass} disabled={pending} aria-label={`Move ${label} up`} onClick={() => run(() => moveLessonAction(id, "up"))}>
        ↑
      </button>
      <button type="button" className={buttonClass} disabled={pending} aria-label={`Move ${label} down`} onClick={() => run(() => moveLessonAction(id, "down"))}>
        ↓
      </button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
