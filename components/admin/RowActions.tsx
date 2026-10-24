"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveItemAction, setStatusAction } from "@/app/(app)/admin/actions";
import type { OrderedKind, StatusKind } from "@/admin/service";
import type { Status } from "@/models/status";

const buttonClass =
  "rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring";

/** Up/down and a status select for one row of an admin list. */
export function RowActions({ kind, id, status, label }: { kind: OrderedKind; id: string; status?: Status; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; errors?: Record<string, string> }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(Object.values(result.errors ?? {})[0] ?? "Failed");
      router.refresh();
    });

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
          onChange={(e) => run(() => setStatusAction(kind as StatusKind, id, e.target.value as Status))}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      )}
      <Link href={`/admin/revisions/${MODEL_OF[kind]}/${id}`} className="px-1 text-xs underline-offset-2 hover:underline">
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
