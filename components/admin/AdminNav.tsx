"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type AdminNavGroup = { label: string; links: { href: string; label: string }[] };

/**
 * Admin section navigation. Below md it is one horizontally scrolling row of pills, so a phone sees
 * the page content first instead of nine stacked links; from md up it is the grouped sidebar,
 * sticky under the app header. The current section is marked in both.
 */
export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const navRef = useRef<HTMLElement>(null);

  // On the phone strip, centre the current pill so "where am I" is never scrolled off the edge.
  // Sets scrollLeft directly rather than scrollIntoView, which could also scroll the page.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    nav.scrollLeft += box.left - navBox.left - (navBox.width - box.width) / 2;
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Admin"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] sm:-mx-6 sm:px-6 md:sticky md:top-20 md:mx-0 md:grid md:content-start md:gap-4 md:self-start md:overflow-visible md:px-0 md:pb-0"
    >
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-full border border-border px-3 py-2 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:rounded md:border-0 md:px-2 md:py-1",
          pathname === "/admin" && "bg-muted",
        )}
      >
        Admin
      </Link>
      {groups.map((group) => (
        <div key={group.label} className="contents md:grid md:gap-1">
          <p className="hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block">{group.label}</p>
          {group.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:rounded md:border-0 md:px-2 md:py-1",
                isActive(l.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground md:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
