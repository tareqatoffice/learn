"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import type { Result } from "@/admin/service";
import { useAdminAction } from "@/components/admin/useAdminAction";

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
      refresh: Boolean(draft.id),
      onSuccess: (result) => {
        setDirty(false);
        if (!draft.id) router.push(hrefAfterCreate(result.id));
        else if (result.updatedAt) setDraft((d) => ({ ...d, updatedAt: result.updatedAt }));
      },
    });
  };

  return { draft, setDraft, set, errors, setErrors, saved, pending, submit, dirty };
}

export function withoutEmptyId<T extends { id: string }>(draft: T): Omit<T, "id"> & { id?: string } {
  const { id, ...rest } = draft;
  return id ? { id, ...rest } : rest;
}
