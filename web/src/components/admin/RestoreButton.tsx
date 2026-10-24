"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreRevisionAction } from "@/app/(app)/admin/revisions/actions";
import { Button } from "@/components/ui/button";

export function RestoreButton({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (!window.confirm("Restore this version? The current version is kept in history.")) return;
            const r = await restoreRevisionAction(revisionId);
            setMessage(r.ok ? "Restored." : (Object.values(r.errors)[0] ?? "Failed"));
            router.refresh();
          })
        }
      >
        Restore
      </Button>
      {message && (
        <span role="status" className="text-xs text-muted-foreground">
          {message}
        </span>
      )}
    </span>
  );
}
