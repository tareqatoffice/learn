"use client";

import { Pause, Play, Square, Target, Timer, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { focusTodayAction, saveFocusSessionAction } from "@/app/(app)/focus-actions";
import { confirm } from "@/components/ConfirmDialog";
import { ProgressBar } from "@/components/ProgressBar";
import { focusRing, trackVar } from "@/components/track";
import { Button } from "@/components/ui/button";
import { firstError } from "@/features/admin/result";
import {
  areaLabel,
  type FocusContext,
  focusContextFor,
  formatClock,
  formatDuration,
  offersFocus,
} from "@/features/focus/context";
import type { FocusToday } from "@/features/focus/sessions";
import {
  elapsedSeconds,
  FOCUS_PRESETS,
  type FocusRun,
  isCompleted,
  isDone,
  isPaused,
  MIN_SAVE_SECONDS,
  pauseRun,
  remainingSeconds,
} from "@/features/focus/lib/timer";
import { isCurrentRun, syncFocusStore, useFocusStore } from "@/features/focus/lib/store";
import { cn } from "@/lib/utils";
import type { FocusArea } from "@/models/focusConstants";

const colorOf = (area: FocusArea) => (area === "general" ? "var(--primary)" : trackVar(area));

function pageContext(pathname: string): FocusContext {
  return focusContextFor(pathname, {
    title: document.title,
    heading: document.querySelector("#main h1")?.textContent,
  });
}

function AreaDot({ area }: { area: FocusArea }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{
        background: colorOf(area),
        boxShadow: `0 0 0 3px color-mix(in oklch, ${colorOf(area)} 20%, transparent)`,
      }}
    />
  );
}

export function FocusButton() {
  const pathname = usePathname();
  const run = useFocusStore((s) => s.run);
  const { start, pause, resume, restore: restoreRun, clear } = useFocusStore.getState();
  useEffect(syncFocusStore, []);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<FocusContext | null>(null);
  const [target, setTarget] = useState<number | undefined>(25);
  const [today, setToday] = useState<FocusToday | null>(null);
  const [saving, setSaving] = useState(false);
  const finishing = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refreshToday = useCallback(async () => {
    try {
      setToday(await focusTodayAction());
    } catch {
    }
  }, []);

  const finish = useCallback(
    async (current: FocusRun, completed: boolean) => {
      if (finishing.current) return false;
      if (!isCurrentRun(current)) return false;
      finishing.current = true;
      const finishedAt = Date.now();
      const seconds = elapsedSeconds(current, finishedAt);
      const restore = () => restoreRun(pauseRun(current, finishedAt));
      const { label } = current.context;
      clear();
      try {
        if (seconds < MIN_SAVE_SECONDS) {
          toast(`Focus under ${MIN_SAVE_SECONDS}s, not saved.`);
          return true;
        }
        setSaving(true);
        const res = await saveFocusSessionAction({
          ...current.context,
          runId: current.id,
          startedAt: current.firstStartedAt,
          seconds,
          targetMinutes: current.targetMinutes,
          completed,
        });
        if (!res.ok) {
          restore();
          toast.error(firstError(res.errors) ?? "Couldn't save the focus session.");
          return false;
        }
        toast.success(
          completed ? `Focus done: ${formatDuration(seconds)} on ${label}` : `Saved ${formatDuration(seconds)} on ${label}`,
        );
        void refreshToday();
        return true;
      } catch {
        restore();
        toast.error("Couldn't save the focus session. It's paused; try again.");
        return false;
      } finally {
        setSaving(false);
        finishing.current = false;
      }
    },
    [refreshToday, restoreRun, clear],
  );

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const running = run !== null && !isPaused(run);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const current = runRef.current;
      if (current && isDone(current, t)) {
        const completed = isCompleted(current, t);
        if (completed && typeof navigator.vibrate === "function") navigator.vibrate(200);
        void finish(current, completed);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, finish]);

  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=alertdialog]")) return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Element;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      if (t.closest?.("[role=alertdialog]")) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    setHere(pageContext(pathname));
    setNow(Date.now());
    setOpen(true);
    void refreshToday();
  };

  const startHere = (minutes: number | undefined) => {
    const context = pageContext(pathname);
    const t = Date.now();
    setHere(context);
    setNow(t);
    start(context, minutes, t);
  };

  const switchHere = async () => {
    if (!run) return;
    const minutes = run.targetMinutes;
    if (await finish(run, false)) startHere(minutes);
  };

  const discard = async () => {
    if (!run) return;
    const yes = await confirm({
      title: "Discard this focus session?",
      description: "The time won't be saved.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (yes) clear();
  };

  const elapsed = run ? elapsedSeconds(run, now) : 0;
  const remaining = run ? remainingSeconds(run, now) : null;
  const clock = run ? formatClock(remaining ?? elapsed) : null;
  const color = colorOf(run?.context.area ?? here?.area ?? "general");
  const elsewhere = run && here && run.context.path !== here.path ? here : null;

  if (!run && !offersFocus(pathname)) return null;

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Focus"
          className="fixed right-4 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-30 grid w-80 max-w-[calc(100vw-2rem)] gap-4 rounded-2xl border border-border bg-card p-4 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200 lg:bottom-22"
          style={{ backgroundImage: `linear-gradient(180deg, color-mix(in oklch, ${color} 10%, transparent), transparent 6rem)` }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Target aria-hidden className="size-4" style={{ color }} />
              Focus
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close focus panel"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <X />
            </Button>
          </div>

          {run ? (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {areaLabel(run.context.area)} · {isPaused(run) ? "Paused" : run.targetMinutes ? "Time left" : "Elapsed"}
                </p>
                {run.context.path === pathname ? (
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <AreaDot area={run.context.area} />
                    <span className="truncate">{run.context.label}</span>
                  </p>
                ) : (
                  <Link
                    href={run.context.path}
                    className={cn("flex min-w-0 items-center gap-2 rounded text-sm font-medium hover:underline", focusRing)}
                  >
                    <AreaDot area={run.context.area} />
                    <span className="truncate">{run.context.label}</span>
                  </Link>
                )}
              </div>
              <p
                role="timer"
                className={cn(
                  "text-center font-mono text-5xl font-semibold tabular-nums tracking-tight",
                  isPaused(run) && "opacity-60",
                )}
              >
                {clock}
              </p>
              {run.targetMinutes ? <ProgressBar value={elapsed} max={run.targetMinutes * 60} color={color} /> : null}
              <div className="flex gap-2">
                {isPaused(run) ? (
                  <Button className="flex-1" onClick={() => resume()}>
                    <Play /> Resume
                  </Button>
                ) : (
                  <Button variant="secondary" className="flex-1" onClick={() => pause()}>
                    <Pause /> Pause
                  </Button>
                )}
                <Button variant="outline" className="flex-1" disabled={saving} onClick={() => void finish(run, false)}>
                  <Square /> Finish
                </Button>
                <Button variant="ghost" size="icon" aria-label="Discard focus session" onClick={() => void discard()}>
                  <Trash2 />
                </Button>
              </div>
              {elsewhere && (
                <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <p className="min-w-0 truncate text-muted-foreground">
                    Now on <span className="font-medium text-foreground">{elsewhere.label}</span>
                  </p>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => void switchHere()}>
                    Save and focus on this page
                  </Button>
                </div>
              )}
            </div>
          ) : (
            here && (
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <p className="text-xs font-medium text-muted-foreground">Focus on this page · {areaLabel(here.area)}</p>
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <AreaDot area={here.area} />
                    <span className="truncate">{here.label}</span>
                  </p>
                </div>
                <div role="radiogroup" aria-label="Session length" className="grid grid-cols-4 gap-1.5">
                  {[...FOCUS_PRESETS, undefined].map((m) => {
                    const selected = target === m;
                    return (
                      <button
                        key={m ?? "open"}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTarget(m)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors",
                          focusRing,
                          selected ? "text-foreground" : "border-border text-muted-foreground hover:bg-muted",
                        )}
                        style={
                          selected
                            ? { borderColor: color, background: `color-mix(in oklch, ${color} 22%, transparent)` }
                            : undefined
                        }
                      >
                        {m ? `${m}m` : "Open"}
                      </button>
                    );
                  })}
                </div>
                <Button size="lg" onClick={() => startHere(target)}>
                  <Play /> Start focus
                </Button>
              </div>
            )
          )}

          {today && today.sessions > 0 && (
            <div className="grid gap-2 border-t border-border pt-3">
              <p className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                <span>Today</span>
                <span>
                  {formatDuration(today.totalSeconds)} · {today.sessions} {today.sessions === 1 ? "session" : "sessions"}
                </span>
              </p>
              <ul className="grid gap-1">
                {today.items.slice(0, 4).map((item) => (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={cn("flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted", focusRing)}
                    >
                      <AreaDot area={item.area} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(item.seconds)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={run ? `Focus: ${clock} on ${run.context.label}` : "Start focus"}
        onClick={toggle}
        className={cn(
          "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-12 items-center gap-2 rounded-full border border-border bg-card text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 lg:bottom-6",
          focusRing,
          run ? "px-4" : "w-12 justify-center",
        )}
        style={
          run
            ? { boxShadow: `0 0 0 2px ${color}, 0 10px 24px -8px color-mix(in oklch, ${color} 50%, transparent)` }
            : undefined
        }
      >
        {run ? (
          <>
            {isPaused(run) ? (
              <Pause aria-hidden className="size-4" style={{ color }} />
            ) : (
              <span aria-hidden className="size-2.5 animate-pulse rounded-full" style={{ background: color }} />
            )}
            <span className="font-mono tabular-nums">{clock}</span>
          </>
        ) : (
          <Timer aria-hidden className="size-5" />
        )}
      </button>
    </>
  );
}
