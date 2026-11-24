"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { localClock, shouldRemind } from "@/features/focus/habit";
import type { FocusPlanView } from "@/features/focus/review";
import { useFocusStore } from "@/features/focus/lib/store";

const STORAGE_KEY = "learn:focus:reminded";
const CHECK_MS = 30_000;

function lastShown(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function markShown(date: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, date);
  } catch {}
}

export function FocusReminder({ plan }: { plan: FocusPlanView | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!plan?.enabled) return;
    const check = () => {
      const now = localClock(new Date());
      if (!shouldRemind(plan, now, lastShown())) return;
      markShown(now.date);
      if (useFocusStore.getState().run) return;
      toast(`Time to focus: ${plan.action}`, {
        description: `${plan.minutes} minutes, starting now.`,
        duration: 20_000,
        action: { label: "Open plan", onClick: () => router.push("/focus/review") },
      });
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [plan, router]);

  return null;
}
