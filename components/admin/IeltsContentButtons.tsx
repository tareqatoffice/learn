"use client";

import { useRouter } from "next/navigation";
import {
  generatePromptDraftAction,
  generateTestDraftAction,
  setPromptStatusAction,
  setTestStatusAction,
} from "@/app/(app)/admin/ielts/tests/actions";
import type { PublishStatus, TestKind } from "@/admin/ieltsTests";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

/** Creates an AI draft test or prompt and opens it for editing. */
export function GenerateDraftButton({ what, label }: { what: TestKind | "task1" | "task2"; label: string }) {
  const router = useRouter();
  const { run, pending, errors } = useAdminAction();
  const go = (id: string) => router.push(what === "task1" || what === "task2" ? `/admin/ielts/writing/${id}` : `/admin/ielts/tests/${what}/${id}`);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => (what === "task1" || what === "task2" ? generatePromptDraftAction(what) : generateTestDraftAction(what)), {
            refresh: false,
            onSuccess: (r) => go(r.id),
          })
        }
      >
        {pending ? "Generating..." : label}
      </Button>
      <ActionStatus saved={false} errors={errors} />
    </>
  );
}

/** Publishes or unpublishes a test or a prompt from the list. */
export function StatusButton({ what, id, status, label }: { what: TestKind | "writing"; id: string; status: PublishStatus; label: string }) {
  const { run, pending, errors } = useAdminAction();
  const next: PublishStatus = status === "published" ? "draft" : "published";
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`${next === "published" ? "Publish" : "Unpublish"} ${label}`}
        onClick={() => run(() => (what === "writing" ? setPromptStatusAction(id, next) : setTestStatusAction(what, id, next)))}
      >
        {next === "published" ? "Publish" : "Unpublish"}
      </Button>
      <ActionStatus saved={false} errors={errors} />
    </>
  );
}
