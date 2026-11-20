"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type AdminNavGroup = { label: string; links: { href: string; label: string }[] };

const sidebarLink = (active: boolean) =>
  cn(
    "rounded px-2 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
    active ? "bg-muted font-medium text-foreground" : "text-foreground",
  );

export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = pathname === "/admin" ? "Admin" : (groups.flatMap((g) => g.links).find((l) => isActive(l.href))?.label ?? "Admin");
  const [open, setOpen] = useState(false);

  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  const list = (linkClass: (active: boolean) => string) => (
    <>
      <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} className={cn(linkClass(pathname === "/admin"), "font-semibold")}>
        Admin
      </Link>
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          {group.links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={linkClass(isActive(l.href))}>
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group rounded-lg border border-border bg-card text-sm md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-muted-foreground">Admin menu · </span>
            {current}
          </span>
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <nav aria-label="Admin" className="grid gap-4 border-t border-border p-3">
          {list((active) => cn(sidebarLink(active), "py-2"))}
        </nav>
      </details>
      <nav aria-label="Admin" className="hidden text-sm md:sticky md:top-20 md:grid md:content-start md:gap-4 md:self-start">
        {list(sidebarLink)}
      </nav>
    </>
  );
}
