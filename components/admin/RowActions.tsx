"use client";

import Link from "next/link";
import { moveItemAction, setStatusAction } from "@/app/(app)/admin/actions";
import { firstError } from "@/admin/result";
import type { OrderedKind, StatusKind } from "@/admin/service";
import { useAdminAction } from "@/components/admin/useAdminAction";
import type { Status } from "@/models/status";

const buttonClass =
  "rounded border border-border px-2 py-0.5 text-xs pointer-coarse:min-h-9 pointer-coarse:min-w-9 hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring";

/** Up/down and a status select for one row of an admin list. */
export function RowActions({ kind, id, status, label }: { kind: OrderedKind; id: string; status?: Status; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const error = firstError(errors);

  return (
    <span className="flex items-center gap-1">
      <button type="button" className={buttonClass} disabled={pending} aria-label={`Move ${label} up`} onClick={() => run(() => moveItemAction(kind, id, "up"))}>
        ↑
      </button>
      <button type="button" className={buttonClass} disabled={pending} aria-label={`Move ${label} down`} onClick={() => run(() => moveItemAction(kind, id, "down"))}>
        ↓
      </button>
      {status && kind !== "subject" && (
        <select
          aria-label={`Status of ${label}`}
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as Status;
            // Unpublishing takes the item away from learners at once, so it asks first.
            const confirm = status === "published" && next !== "published" ? `Unpublish "${label}"? Learners stop seeing it.` : undefined;
            run(() => setStatusAction(kind as StatusKind, id, next), { confirm });
          }}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs pointer-coarse:min-h-9"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      )}
      <Link href={`/admin/revisions/${MODEL_OF[kind]}/${id}`} className="px-1 text-xs underline-offset-2 pointer-coarse:px-2 pointer-coarse:py-2.5 hover:underline">
        History
      </Link>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Revision.entityType is the Mongoose model name. */
const MODEL_OF: Record<OrderedKind, string> = {
  book: "QuestionBook",
  question: "Question",
  graph: "Graph",
  node: "GraphNode",
  series: "NoteSeries",
  note: "Note",
  subject: "Subject",
};
