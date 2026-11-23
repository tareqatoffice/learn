"use client";

import { moveLessonAction } from "@/app/(app)/admin/speaking/actions";
import { firstError } from "@/features/admin/result";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/Notice";

export function SpeakingLessonRowActions({ id, label }: { id: string; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const error = firstError(errors);
  return (
    <span className="flex items-center gap-1">
      <Button type="button" variant="outline" size="xs" disabled={pending} aria-label={`Move ${label} up`} onClick={() => run(() => moveLessonAction(id, "up"))}>
        ↑
      </Button>
      <Button type="button" variant="outline" size="xs" disabled={pending} aria-label={`Move ${label} down`} onClick={() => run(() => moveLessonAction(id, "down"))}>
        ↓
      </Button>
      {error && (
        <Notice as="span" className="text-xs">
          {error}
        </Notice>
      )}
    </span>
  );
}
