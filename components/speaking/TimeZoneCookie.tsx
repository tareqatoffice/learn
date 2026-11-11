"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Stores the browser's time zone in the `tz` cookie so the server computes "today" in the learner's
 * local day. When the page was rendered with a different zone, it refreshes once with the right one.
 */
export function TimeZoneCookie({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone || zone === current) return;
    document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [current, router]);
  return null;
}
