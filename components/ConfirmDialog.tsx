"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let openConfirm: ((pending: Pending) => void) | null = null;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!openConfirm) return Promise.resolve(false);
  return new Promise((resolve) => openConfirm!({ ...options, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    openConfirm = (next) => {
      resolveRef.current = next.resolve;
      setPending(next);
    };
    return () => {
      openConfirm = null;
    };
  }, []);

  function finish(ok: boolean) {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    resolve?.(ok);
  }

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Are you sure?"}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>{pending?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            variant={pending?.destructive ? "destructive" : "default"}
            onClick={() => finish(true)}
          >
            {pending?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
