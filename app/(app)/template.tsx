"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const shownPath = useRef(pathname);

  useEffect(() => {
    const el = ref.current;
    if (!el || shownPath.current === pathname) return;
    shownPath.current = pathname;
    el.classList.remove("page-enter");
    void el.offsetWidth;
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter min-w-0">
      {children}
    </div>
  );
}
