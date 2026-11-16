"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "theme";

function effectiveTheme(): "light" | "dark" {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    void document.body.offsetHeight;
    root.classList.remove("theme-switching");
    try {
      localStorage.setItem(KEY, next);
    } catch {
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:transition-transform [&_svg]:duration-500 [&_svg]:ease-out hover:[&_svg]:-rotate-[25deg] hover:[&_svg]:scale-110 motion-reduce:[&_svg]:transition-none",
        className,
      )}
    >
      <Moon className="size-4.5 dark:hidden" aria-hidden />
      <Sun className="hidden size-4.5 dark:block" aria-hidden />
    </button>
  );
}
