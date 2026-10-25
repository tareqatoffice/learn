"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Wraps every signed-in page in `.page-enter` (app/globals.css). The template itself only remounts
 * when the top-level segment changes, so deeper navigations (series → chapter, book → question)
 * replay the entry animation by restarting the class on each pathname change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const shownPath = useRef(pathname);

  useEffect(() => {
    const el = ref.current;
    if (!el || shownPath.current === pathname) return;
    shownPath.current = pathname;
    el.classList.remove("page-enter");
    void el.offsetWidth; // force a style flush so re-adding the class restarts the animations
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
