"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "theme";

/** The theme currently in effect: an explicit choice on <html>, else the OS preference. */
function effectiveTheme(): "light" | "dark" {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Flips light/dark. The icon is picked by CSS (`dark:` follows both `data-theme` and the OS setting),
 * so the server and client render the same markup. The choice persists in localStorage, which the
 * inline script in the root layout reads before first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts for this page view only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Moon className="size-[18px] dark:hidden" aria-hidden />
      <Sun className="hidden size-[18px] dark:block" aria-hidden />
    </button>
  );
}
