"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const OVERLAY_EVENT = "learn-overlay-open";

/** How many overlays are holding the page still. The last one to close gives scrolling back. */
let scrollLocks = 0;

function lockPageScroll(): () => void {
  scrollLocks += 1;
  if (scrollLocks === 1) document.body.style.overflow = "hidden";
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = "";
  };
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")];
}

/**
 * A collapsed list for narrow screens. Opening it lays the list over the page, under the trigger,
 * with a backdrop that closes it — the same idea as the header's mobile menu — instead of pushing
 * the page down. Choosing a link closes it too. Opening one closes any other.
 */
export function OverlayMenu({
  label,
  navLabel,
  children,
}: {
  label: React.ReactNode;
  /** Accessible name for the list that opens. */
  navLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState(0);

  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    // The header is 3.5rem. Keep the sheet under it when the trigger has scrolled up behind it.
    const place = () => {
      const box = buttonRef.current?.getBoundingClientRect();
      if (!box) return;
      setTop((current) => {
        const next = Math.max(box.bottom, 56);
        return current === next ? current : next;
      });
    };
    place();
    const unlock = lockPageScroll();
    const onOther = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        buttonRef.current?.focus();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !portalRef.current) return;
      const button = buttonRef.current;
      const items = button ? [button, ...focusable(portalRef.current)] : focusable(portalRef.current);
      if (!items.length) return;
      e.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const delta = e.shiftKey ? -1 : 1;
      const next = index === -1 ? (e.shiftKey ? items.length - 1 : 0) : (index + delta + items.length) % items.length;
      items[next]?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener(OVERLAY_EVENT, onOther);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener(OVERLAY_EVENT, onOther);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-30 lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const box = buttonRef.current?.getBoundingClientRect();
          if (box) setTop(Math.max(box.bottom, 56));
          // Close any overlay already open, then open this one. The listener is only attached while open.
          window.dispatchEvent(new Event(OVERLAY_EVENT));
          setOpen(true);
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="min-w-0 break-words">{label}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open &&
        createPortal(
          // Portaled out of the page: its enter animation uses translate, which would trap a
          // fixed layer inside this one-row trigger instead of the viewport. The page fade also
          // paints above anything left inside the page, so the list has to travel with the backdrop.
          <div ref={portalRef}>
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className="fixed inset-x-0 bottom-0 z-30 bg-black/40 animate-in fade-in-0 duration-200"
              style={{ top }}
            />
            <nav
              id={panelId}
              aria-label={navLabel}
              onClick={(e) => {
                const node = e.target instanceof Element ? e.target : null;
                if (node?.closest("a")) setOpen(false);
              }}
              style={{ top, maxHeight: `calc(100dvh - ${top}px)` }}
              className="fixed inset-x-0 z-40 overflow-y-auto border-y border-border bg-card px-4 py-2 text-sm shadow-lg animate-in fade-in-0 slide-in-from-top-2 duration-200 sm:px-6"
            >
              {children}
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
