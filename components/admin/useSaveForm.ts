"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import type { Result } from "@/admin/service";
import { useAdminAction } from "@/components/admin/useAdminAction";

/**
 * Draft state for a content form plus a save that reports field errors, navigates to
 * `hrefAfterCreate` on create, and refreshes on update (built on useAdminAction).
 */
export function useSaveForm<T extends { id: string; updatedAt?: string }>(
  initial: T,
  save: (draft: T) => Promise<Result>,
  hrefAfterCreate: (id: string) => string,
) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const { run, pending, errors, setErrors, saved, touch } = useAdminAction();

  const set = <K extends keyof T>(key: K, value: T[K]) => {
    touch();
    setDirty(true);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // Edits not saved yet: closing the tab or following a link asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useLeaveGuard(dirty, "You have unsaved changes. Leave anyway?", "adminLeaveGuard");

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(() => save(draft), {
      // A new item has no page to refresh yet; go to its edit page instead.
      refresh: Boolean(draft.id),
      onSuccess: (result) => {
        setDirty(false);
        if (!draft.id) router.push(hrefAfterCreate(result.id));
        // The next save is checked against this version, so keep it in step with what was saved.
        else if (result.updatedAt) setDraft((d) => ({ ...d, updatedAt: result.updatedAt }));
      },
    });
  };

  return { draft, setDraft, set, errors, setErrors, saved, pending, submit, dirty };
}

/** Drops the empty id of a not-yet-created item so the service treats it as new. */
export function withoutEmptyId<T extends { id: string }>(draft: T): Omit<T, "id"> & { id?: string } {
  const { id, ...rest } = draft;
  return id ? { id, ...rest } : rest;
}
