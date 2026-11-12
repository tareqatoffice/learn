"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateItemDraftAction } from "@/app/(app)/admin/ielts/speaking/actions";
import type { ItemType } from "@/admin/ielts";
import { ActionStatus, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

/** Asks the AI coach for a draft item and opens it for editing. Part 3 can follow one of the cue cards. */
export function IeltsGenerateDraftButton({ type, cards = [] }: { type: ItemType; cards?: { id: string; title: string }[] }) {
  const router = useRouter();
  const { run, pending, errors } = useAdminAction();
  const [cardId, setCardId] = useState("");
  return (
    <span className="flex flex-wrap items-center gap-2">
      {type === "part3" && cards.length > 0 && (
        <select aria-label="Follows cue card" className={`${inputClass} w-auto max-w-56`} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">Any topic</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => generateItemDraftAction(type, cardId || undefined), {
            refresh: false,
            onSuccess: (r) => router.push(`/admin/ielts/speaking/${r.id}`),
          })
        }
      >
        {pending ? "Generating…" : "Generate draft"}
      </Button>
      <ActionStatus saved={false} errors={errors} />
    </span>
  );
}
