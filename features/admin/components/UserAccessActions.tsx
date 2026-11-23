"use client";

import { createContext, useContext, useId, useState } from "react";
import { deleteUserAction, setUserAccessAction } from "@/app/(app)/admin/users/actions";
import { firstError } from "@/features/admin/result";
import { useAdminAction } from "@/features/admin/components/useAdminAction";
import { Button } from "@/components/ui/button";
import { BLOCK_REASON_MAX as REASON_MAX } from "@/features/auth/lib/access-limits";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/Notice";

type Flash = { tone: "ok" | "error"; text: string } | null;
const FlashContext = createContext<(flash: Flash) => void>(() => {});

export function UserAccessFlash({ children }: { children: React.ReactNode }) {
  const [flash, setFlash] = useState<Flash>(null);
  return (
    <FlashContext.Provider value={setFlash}>
      <div aria-live="polite" className="empty:hidden">
        {flash && (
          <p
            role={flash.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm animate-in fade-in-0 slide-in-from-top-1",
              flash.tone === "ok" ? "border-ok/40 bg-ok/10" : "border-destructive/40 bg-destructive/5 text-destructive",
            )}
          >
            {flash.text}
            <button
              type="button"
              onClick={() => setFlash(null)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </p>
        )}
      </div>
      {children}
    </FlashContext.Provider>
  );
}

export function UserAccessActions({
  id,
  email,
  status,
}: {
  id: string;
  email: string;
  status: "pending" | "approved" | "blocked";
}) {
  const setFlash = useContext(FlashContext);
  const { run: runAction, pending, errors } = useAdminAction();
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const del = useAdminAction();
  const remove = () =>
    del.run(
      async () => {
        const result = await deleteUserAction(id);
        setFlash(
          result.ok
            ? { tone: "ok", text: `${email} and all their data were deleted.` }
            : { tone: "error", text: `${email}: ${firstError(result.errors) ?? "Something went wrong. Try again."}` },
        );
        return result;
      },
      { confirm: `Delete ${email} for good? Their recordings, progress, attempts and account are removed. This can't be undone.` },
    );
  const tooLong = reason.trim().length > REASON_MAX;

  const error = firstError(errors) ?? null;

  const run = (next: "approved" | "blocked") =>
    runAction(
      async () => {
        const result = await setUserAccessAction(id, next, next === "blocked" ? reason : undefined);
        if (!result.ok) setFlash({ tone: "error", text: `${email}: ${firstError(result.errors) ?? "Something went wrong. Try again."}` });
        return result;
      },
      {
        onSuccess: () => {
          setBlocking(false);
          setReason("");
          setFlash({
            tone: "ok",
            text:
              next === "approved"
                ? status === "blocked"
                  ? `${email} is unblocked and can use Learn again.`
                  : `${email} is approved and can now use Learn.`
                : `${email} is blocked and has lost access.`,
          });
        },
      },
    );

  if (blocking) {
    return (
      <form
        className="grid w-full gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:w-80"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooLong) run("blocked");
        }}
      >
        <p className="text-sm font-medium">Block {email}?</p>
        <p className="text-xs text-muted-foreground">They lose access on their next request and see the reason below.</p>
        <label htmlFor={reasonId} className="text-xs font-medium">
          Reason (optional)
        </label>
        <textarea
          id={reasonId}
          rows={2}
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={tooLong}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive"
        />
        <span
          role={tooLong || error ? "alert" : undefined}
          className={cn("text-xs", tooLong || error ? "text-destructive" : "text-muted-foreground")}
        >
          {tooLong ? `Keep it under ${REASON_MAX} characters` : (error ?? `${reason.trim().length}/${REASON_MAX}`)}
        </span>
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="destructive" disabled={pending || tooLong}>
            {pending ? "Blocking…" : "Block user"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setBlocking(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run("approved")}
          aria-label={`${status === "blocked" ? "Unblock" : "Approve"} ${email}`}
        >
          {pending ? "Saving…" : status === "blocked" ? "Unblock" : "Approve"}
        </Button>
      )}
      {status !== "blocked" && (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => setBlocking(true)} aria-label={`Block ${email}`}>
          Block
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending || del.pending} onClick={remove} aria-label={`Delete ${email}`}>
        {del.pending ? "Deleting…" : "Delete"}
      </Button>
      {error && (
        <Notice as="span" className="text-xs">
          {error}
        </Notice>
      )}
    </div>
  );
}
