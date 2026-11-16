"use client";

import { restoreRevisionAction } from "@/app/(app)/admin/revisions/actions";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

export function RestoreButton({ revisionId }: { revisionId: string }) {
  const { run, pending, errors, saved } = useAdminAction();
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => restoreRevisionAction(revisionId), {
            confirm: "Restore this version's content? Status, order and subjects stay as they are now, and the current version is kept in history.",
          })
        }
      >
        Restore
      </Button>
      <ActionStatus saved={saved} errors={errors} savedText="Restored." />
    </span>
  );
}
