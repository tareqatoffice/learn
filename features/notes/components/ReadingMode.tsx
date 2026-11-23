"use client";

import { BookOpen, ChevronDown, ChevronUp, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { focusContextFor } from "@/features/focus/context";
import { useFocusStore } from "@/features/focus/lib/store";

const STORAGE_KEY = "learn:reading:v1";
const TOP_OFFSET_PX = 140;
const START_MINUTES = 25;
const REMEMBER_MS = 30 * 60_000;

type Heading = { id: string; text: string };

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function remember(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  listeners.forEach((listener) => listener());
}

function wasOn(): boolean {
  try {
    const since = Number(window.sessionStorage.getItem(STORAGE_KEY));
    return Number.isFinite(since) && since > 0 && Date.now() - since < REMEMBER_MS;
  } catch {
    return false;
  }
}

const isScrollable = () => document.documentElement.scrollHeight - window.innerHeight > 1;

function currentIndex(headings: Heading[]): number {
  const root = document.documentElement;
  if (isScrollable() && window.scrollY + window.innerHeight >= root.scrollHeight - 2) return headings.length - 1;
  let found = -1;
  headings.forEach((h, i) => {
    const el = document.getElementById(h.id);
    if (el && el.getBoundingClientRect().top <= TOP_OFFSET_PX) found = i;
  });
  return found;
}

export function ReadingMode({ headings }: { headings: Heading[] }) {
  const pathname = usePathname();
  const on = useSyncExternalStore(subscribe, wasOn, () => false);
  const [at, setAt] = useState(-1);
  const [scrollable, setScrollable] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.dataset.reading = "on";
    let frame = 0;
    const update = () => {
      frame = 0;
      setAt(currentIndex(headings));
      setScrollable(isScrollable());
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog], [role=alertdialog]")) return;
      remember(false);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.reading;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("keydown", onKey);
    };
  }, [on, headings]);

  const enter = () => {
    remember(true);
    const store = useFocusStore.getState();
    if (!store.run) {
      store.start(
        focusContextFor(pathname, { title: document.title, heading: document.querySelector("#main h1")?.textContent }),
        START_MINUTES,
      );
    }
  };

  const exit = () => {
    remember(false);
    toggleRef.current?.focus();
  };

  const go = useCallback(
    (delta: 1 | -1) => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      const target = currentIndex(headings) + delta;
      if (target < 0) {
        window.scrollTo({ top: 0, behavior });
        return;
      }
      document.getElementById(headings[target]?.id ?? "")?.scrollIntoView({ behavior, block: "start" });
    },
    [headings],
  );

  return (
    <>
      <Button ref={toggleRef} variant={on ? "secondary" : "outline"} size="sm" aria-pressed={on} onClick={on ? exit : enter}>
        <BookOpen /> Focus reading
      </Button>
      {on && (
        <>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Close focus reading"
            className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-40 bg-card"
            onClick={exit}
          >
            <X />
          </Button>
          {headings.length > 0 && scrollable && (
            <div
              role="group"
              aria-label="Sections"
              className="fixed bottom-4 left-4 z-30 flex max-w-[calc(100vw-6rem)] items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg"
            >
              <Button variant="ghost" size="icon-sm" aria-label="Previous section" onClick={() => go(-1)} disabled={at < 0}>
                <ChevronUp />
              </Button>
              <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                {at >= 0 ? `${at + 1}/${headings.length} · ${headings[at].text}` : `Start · ${headings.length} sections`}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next section"
                onClick={() => go(1)}
                disabled={at >= headings.length - 1}
              >
                <ChevronDown />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
