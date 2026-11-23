"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isActivePath,
  NAV_ITEMS,
  PROFILE_ITEM,
  TAB_HREFS,
  type NavItem,
} from "@/components/nav";
import { focusRing, trackVar } from "@/components/track";
import { lockPageScroll } from "@/lib/scrollLock";
import { cn } from "@/lib/utils";

const tabClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.6875rem] font-medium transition-colors",
    focusRing,
    active ? "text-foreground" : "text-muted-foreground",
  );

function Icon({ item, active }: { item: NavItem; active: boolean }) {
  const Glyph = item.icon;
  return (
    <Glyph
      aria-hidden
      className="size-5"
      style={item.track && active ? { color: trackVar(item.track) } : undefined}
    />
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const tabs = NAV_ITEMS.filter((i) => TAB_HREFS.includes(i.href));
  const more = [
    ...NAV_ITEMS.filter((i) => !TAB_HREFS.includes(i.href)),
    PROFILE_ITEM,
  ];
  const moreActive = more.some((i) => isActivePath(pathname, i.href));

  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const unlock = lockPageScroll();
    const main = document.getElementById("main");
    if (main) main.inert = true;
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      if (main) main.inert = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia("(min-width: 48rem)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMoreOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [moreOpen]);

  return (
    <div className="lg:hidden">
      {moreOpen && (
        <>
          <div
            aria-hidden
            onClick={() => {
              setMoreOpen(false);
              moreButtonRef.current?.focus();
            }}
            className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 duration-200"
          />
          <nav
            ref={sheetRef}
            id="more-nav"
            aria-label="More"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 rounded-t-xl border-t border-border bg-card p-2 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
          >
            <ul className="grid gap-1">
              {more.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-muted",
                        focusRing,
                        active ? "bg-muted text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon item={item} active={active} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
      <nav
        aria-label="Primary"
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              <Icon item={item} active={active} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="More"
          aria-expanded={moreOpen}
          aria-controls="more-nav"
          onClick={() => setMoreOpen((o) => !o)}
          className={tabClass(moreActive || moreOpen)}
        >
          <Ellipsis aria-hidden className="size-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
