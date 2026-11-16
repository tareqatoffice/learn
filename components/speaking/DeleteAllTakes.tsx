"use client";

import { useState } from "react";
import { deleteAllTakesAction } from "@/app/(app)/speaking/actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

export function DeleteAllTakes() {
  const { run, pending, errors } = useAdminAction();
  const [done, setDone] = useState<number | null>(null);
  return (
    <section aria-labelledby="delete-recordings" className="grid gap-2 rounded-xl border border-border bg-card p-5">
      <h2 id="delete-recordings" className="font-semibold">
        Your recordings
      </h2>
      <p className="text-sm text-muted-foreground">
        Deletes every Speaking practice recording, with its transcript, ratings and AI feedback. Your settings stay.
      </p>
      <Button
        variant="destructive"
        className="justify-self-start"
        disabled={pending}
        onClick={() =>
          run(() => deleteAllTakesAction(), {
            confirm: "Delete all your Speaking practice recordings? This cannot be undone.",
            onSuccess: ({ deleted }) => setDone(deleted),
          })
        }
      >
        {pending ? "Deleting…" : "Delete all my recordings"}
      </Button>
      {done !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {done ? `Deleted ${done} recording${done === 1 ? "" : "s"}.` : "There were no recordings to delete."}
        </p>
      )}
      <ActionStatus saved={false} errors={errors} />
    </section>
  );
}
