"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const { run, pending, errors, setErrors, saved, touch } = useAdminAction();

  const set = <K extends keyof T>(key: K, value: T[K]) => {
    touch();
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(() => save(draft), {
      // A new item has no page to refresh yet; go to its edit page instead.
      refresh: Boolean(draft.id),
      onSuccess: (result) => {
        if (!draft.id) router.push(hrefAfterCreate(result.id));
        // The next save is checked against this version, so keep it in step with what was saved.
        else if (result.updatedAt) setDraft((d) => ({ ...d, updatedAt: result.updatedAt }));
      },
    });
  };

  return { draft, setDraft, set, errors, setErrors, saved, pending, submit };
}

/** Drops the empty id of a not-yet-created item so the service treats it as new. */
export function withoutEmptyId<T extends { id: string }>(draft: T): Omit<T, "id"> & { id?: string } {
  const { id, ...rest } = draft;
  return id ? { id, ...rest } : rest;
}
