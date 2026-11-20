"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { cn } from "@/lib/utils";
import { focusRing, trackVar, type TrackName } from "@/components/track";

export type TabRow = { key: string; href: string; label: string; value: number; max: number };
export type TrackTab = {
  id: string;
  label: string;
  track: TrackName;
  rows: TabRow[];
  empty: string;
  /** Sums over `rows`, computed on the server for the tab label. */
  done: number;
  total: number;
};

const isFinished = (r: TabRow) => r.max > 0 && r.value >= r.max;

export function ProgressTabs({ tabs }: { tabs: TrackTab[] }) {
  const uid = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [hideFinished, setHideFinished] = useState(false);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!tab) return null;

  const rows = hideFinished ? tab.rows.filter((r) => !isFinished(r)) : tab.rows;
  const finishedCount = tab.rows.filter(isFinished).length;

  function onKeyDown(e: React.KeyboardEvent) {
    const at = tabs.findIndex((t) => t.id === active);
    const to =
      e.key === "ArrowRight" ? (at + 1) % tabs.length
      : e.key === "ArrowLeft" ? (at - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    setActive(tabs[to].id);
    buttons.current[tabs[to].id]?.focus();
  }

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="grid min-w-0 gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id={`${uid}-title`} className="text-base font-semibold">
          Your progress
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={hideFinished}
            onChange={(e) => setHideFinished(e.target.checked)}
            className="size-4 accent-[var(--ring)]"
          />
          Hide finished
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Progress by area"
        onKeyDown={onKeyDown}
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {tabs.map((t) => {
          const selected = t.id === tab.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                buttons.current[t.id] = el;
              }}
              role="tab"
              id={`${uid}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={cn(
                "grid min-w-0 gap-0.5 rounded-md px-2 py-2 text-left sm:px-3",
                focusRing,
                selected
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: trackVar(t.track) }}
                />
                <span className="truncate">{t.label}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t.done} of {t.total}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${tab.id}`}
        tabIndex={0}
        className={cn("rounded-lg", focusRing)}
      >
        {tab.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tab.empty}</p>
        ) : rows.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            All {finishedCount} finished. Untick “Hide finished” to see them.
          </p>
        ) : (
          <ul key={tab.id} className="grid gap-0.5">
            {rows.map((r) => {
              const pct = r.max > 0 ? Math.min(100, Math.round((r.value / r.max) * 100)) : 0;
              return (
                <li key={r.key}>
                  <Link
                    href={r.href}
                    className={cn(
                      "group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 hover:bg-muted/60 pointer-coarse:py-3",
                      focusRing,
                    )}
                  >
                    <span className="truncate text-sm font-medium">{r.label}</span>
                    <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                      <span className="group-hover:hidden group-focus-visible:hidden">
                        {r.value}/{r.max}
                      </span>
                      <span className="hidden group-hover:inline group-focus-visible:inline">{pct}%</span>
                    </span>
                    <ProgressBar
                      value={r.value}
                      max={r.max}
                      color={isFinished(r) ? undefined : trackVar(tab.track)}
                      className="col-span-2"
                    />
                    <span className="sr-only">
                      {r.value} of {r.max}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
