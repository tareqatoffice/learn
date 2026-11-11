"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** The one-time notice before body-language feedback: what leaves the browser and how to withdraw. */
export function BodyConsentDialog({
  open,
  pending,
  onAgree,
  onCancel,
}: {
  open: boolean;
  pending?: boolean;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="body-consent-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="grid gap-3 p-5">
        <h2 id="body-consent-title" className="text-lg font-semibold">
          Body language feedback
        </h2>
        <p className="text-sm">
          A few still images of your face are sent to an outside AI provider through OpenRouter. Your transcript is sent
          too.
        </p>
        <p className="text-sm text-muted-foreground">
          The images aren&apos;t stored. You can withdraw this permission any time in Speaking settings.
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onAgree} disabled={pending}>
            {pending ? "Saving…" : "Agree and continue"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
