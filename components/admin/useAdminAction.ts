"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActionResult, FieldErrors } from "@/admin/result";
import { confirm } from "@/components/ConfirmDialog";

type Options<R> = {
  /** Runs after a successful result, before the refresh. */
  onSuccess?: (result: R) => void;
  /** Re-render the server page with the new data (default true). */
  refresh?: boolean;
  /** Asked first via AlertDialog; the action does not run unless the admin agrees. */
  confirm?: string;
};

/**
 * The client half of the admin update standard: runs a Server Action that returns an
 * ActionResult, tracks pending / saved / errors, and refreshes the page on success.
 * Pair it with <ActionStatus> (or <SaveBar>, which includes it) to show the outcome.
 */
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

  /** Call when the form changes, so an old "Saved." does not linger. */
  const touch = useCallback(() => setSaved(false), []);

  // The refresh after a save runs inside the same transition, so wait for it before saying "Saved.".
  return { run, pending, errors, setErrors, saved: saved && !pending, touch };
}
