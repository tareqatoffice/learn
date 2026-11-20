"use client";

import { useRouter } from "next/navigation";
import type { ActionResult } from "@/features/admin/result";
import { ActionStatus } from "@/features/admin/components/SaveBar";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";

export function DiscardAttempt({ discard, back }: { discard: () => Promise<ActionResult>; back: string }) {
  const router = useRouter();
  const { run, pending, errors } = useAdminAction();
  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(discard, {
            confirm: "Discard this attempt? Your answers so far are deleted and it won't count.",
            refresh: false,
            onSuccess: () => router.push(back),
          })
        }
      >
        Discard
      </Button>
      <ActionStatus saved={false} errors={errors} />
    </span>
  );
}
