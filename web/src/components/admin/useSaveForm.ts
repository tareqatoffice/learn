"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Result } from "@/admin/service";

/** Draft state plus a save that reports field errors, navigates to `hrefAfterCreate` on create, and refreshes on update. */
export function useSaveForm<T extends { id: string }>(initial: T, save: (draft: T) => Promise<Result>, hrefAfterCreate: (id: string) => string) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    startTransition(async () => {
      const result = await save(draft);
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setSaved(true);
      if (!draft.id) router.push(hrefAfterCreate(result.id));
      else router.refresh();
    });
  };

  return { draft, setDraft, set, errors, setErrors, saved, pending, submit };
}

/** Drops the empty id of a not-yet-created item so the service treats it as new. */
export function withoutEmptyId<T extends { id: string }>(draft: T): Omit<T, "id"> & { id?: string } {
  const { id, ...rest } = draft;
  return id ? { id, ...rest } : rest;
}
