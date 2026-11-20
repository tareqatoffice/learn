"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActionResult, FieldErrors } from "@/features/admin/result";
import { confirm } from "@/components/ConfirmDialog";

type Options<R> = {
  onSuccess?: (result: R) => void;
  refresh?: boolean;
  confirm?: string;
};

export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  const run = useCallback(
    <R extends ActionResult>(action: () => Promise<R>, options: Options<Extract<R, { ok: true }>> = {}) => {
      void (async () => {
        if (
          options.confirm &&
          !(await confirm({ description: options.confirm, destructive: true }))
        ) {
          return;
        }
        startTransition(async () => {
          setSaved(false);
          let result: R;
          try {
            result = await action();
          } catch {
            setErrors({ _: "Something went wrong. Try again." });
            return;
          }
          if (!result.ok) {
            setErrors(result.errors);
            return;
          }
          setErrors({});
          setSaved(true);
          options.onSuccess?.(result as Extract<R, { ok: true }>);
          if (options.refresh !== false) router.refresh();
        });
      })();
    },
    [router],
  );

  const touch = useCallback(() => setSaved(false), []);

  return { run, pending, errors, setErrors, saved: saved && !pending, touch };
}
