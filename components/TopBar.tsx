"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions";
import { AppHeader } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export type TopBarUser = { name: string; image?: string; isAdmin: boolean };

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/interview", label: "Interview" },
  { href: "/graphs", label: "Graphs" },
  { href: "/notes", label: "Notes" },
];
const ADMIN_LINK = { href: "/admin", label: "Admin" };

const linkClass = (active: boolean) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-muted text-foreground" : "text-muted-foreground",
  );

// Desktop only: an accent bar on the header's bottom border, under the link, that grows on hover and
// stays for the current page. It is a sibling of the link (positioned against the full-height wrapper),
// not the link's ::after: the press scale on the link would make the link its containing block and
// pull the bar up under the text for the length of the click.
const barClass = (active: boolean) =>
  cn(
    "pointer-events-none absolute inset-x-3 -bottom-px h-0.5 origin-left rounded-full bg-ring transition-transform duration-300 ease-out peer-hover:scale-x-100",
    active ? "scale-x-100" : "scale-x-0",
  );

export function TopBar({ user }: { user: TopBarUser }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const links = user.isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // A new page closes both menus (the account menu has no links, but a back/forward navigation can happen with it open).
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setMenuOpen(false);
    setAccountOpen(false);
  }

  // Escape closes whichever menu is open and puts focus back on its button, so it is not lost with the
  // unmounted menu; a tap or click outside the account menu closes it.
  useEffect(() => {
    if (!menuOpen && !accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      (accountOpen ? accountButtonRef : menuButtonRef).current?.focus();
      setMenuOpen(false);
      setAccountOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node))
        setAccountOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen, accountOpen]);

  return (
    <AppHeader
      logoHref="/dashboard"
      below={
        // Overlays the page instead of pushing it down: absolute under the sticky header, with a
        // backdrop over the rest of the viewport that closes the menu on tap.
        menuOpen && (
          <>
            <div
              aria-hidden
              onClick={() => setMenuOpen(false)}
              className="fixed inset-x-0 bottom-0 top-14 bg-black/40 animate-in fade-in-0 duration-200 md:hidden"
            />
            <nav
              id="mobile-nav"
              aria-label="Mobile"
              className="absolute inset-x-0 top-full border-y border-border bg-card px-4 py-2 shadow-lg sm:px-6 animate-in fade-in-0 slide-in-from-top-2 duration-200 md:hidden"
            >
              <ul className="grid gap-1">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive(href) ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(linkClass(isActive(href)), "block py-2.5")}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )
      }
    >
      <nav aria-label="Main" className="hidden gap-1 self-stretch md:flex">
        {links.map(({ href, label }) => (
          <div key={href} className="relative flex items-center">
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(linkClass(isActive(href)), "peer")}
            >
              {label}
            </Link>
            <span aria-hidden className={barClass(isActive(href))} />
          </div>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <div ref={accountRef} className="relative">
          <button
            ref={accountButtonRef}
            type="button"
            aria-label="Account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((open) => !open)}
            className="flex size-9 pointer-coarse:size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold transition-shadow hover:ring-2 hover:ring-ring/40 aria-expanded:ring-2 aria-expanded:ring-ring/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- Google avatar host; next/image would need a remote pattern
              <img
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden>
                {(user.name.trim()[0] ?? "?").toUpperCase()}
              </span>
            )}
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-11 w-56 origin-top-right rounded-lg border border-border bg-popover p-2 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
              <p className="truncate px-2 py-1.5 text-sm font-medium">
                {user.name}
              </p>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-md px-2 py-1.5 pointer-coarse:py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:pl-3 hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex size-9 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden />
          ) : (
            <Menu className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </AppHeader>
  );
}
