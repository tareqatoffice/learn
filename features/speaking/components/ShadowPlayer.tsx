"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HiddenPlayer } from "@/components/MediaPlayer";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/Notice";

type Mode = "after" | "together";
type Part = "source" | "take";

const nowMs = () => Date.now();

export function mixVolumes(mix: number): { source: number; take: number } {
  const m = Math.min(Math.max(mix, 0), 100) / 100;
  return { source: Math.min(1, 2 * (1 - m)), take: Math.min(1, 2 * m) };
}

export function ShadowPlayer({
  sourceUrl,
  takeUrl,
  rate = 1,
  onSourceTime,
}: {
  sourceUrl: string;
  takeUrl: string;
  rate?: number;
  onSourceTime?: (sec: number | null) => void;
}) {
  const source = useRef<HTMLVideoElement>(null);
  const take = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("after");
  const [part, setPart] = useState<Part | null>(null);
  const [paused, setPaused] = useState(false);
  const [mix, setMix] = useState(50);
  const [error, setError] = useState("");
  const [nudge, setNudge] = useState(0);
  const live = useRef(false);
  const late = useRef<{ el: HTMLVideoElement; due: number; timer: ReturnType<typeof setTimeout> }[]>([]);
  const waiting = useRef<{ el: HTMLVideoElement; ms: number }[]>([]);
  const active = part !== null;
  const [shownTakeUrl, setShownTakeUrl] = useState(takeUrl);
  if (!active && shownTakeUrl !== takeUrl) setShownTakeUrl(takeUrl);

  const volume = mode === "together" ? mixVolumes(mix) : { source: 1, take: 1 };

  useEffect(() => {
    const s = source.current;
    const t = take.current;
    return () => {
      late.current.forEach((l) => clearTimeout(l.timer));
      s?.pause();
      t?.pause();
    };
  }, []);

  function clearLate() {
    late.current.forEach((l) => clearTimeout(l.timer));
    late.current = [];
  }

  function run(el: HTMLVideoElement, afterMs: number) {
    if (afterMs <= 0) return void el.play()?.catch(failed);
    const entry = { el, due: nowMs() + afterMs, timer: setTimeout(() => void el.play()?.catch(failed), afterMs) };
    late.current.push(entry);
  }

  function stop() {
    clearLate();
    waiting.current = [];
    live.current = false;
    for (const el of [source.current, take.current]) {
      el?.pause();
      if (el) el.currentTime = 0;
    }
    setPart(null);
    setPaused(false);
    onSourceTime?.(null);
  }

  const failed = () => {
    stop();
    setError("Playback didn't start. Try again.");
  };

  function start() {
    stop();
    setError("");
    const s = source.current;
    const t = take.current;
    if (!s || !t) return;
    s.playbackRate = rate;
    live.current = true;
    setPart("source");
    run(s, mode === "together" ? Math.max(-nudge, 0) * 1000 : 0);
    if (mode === "together") run(t, Math.max(nudge, 0) * 1000);
  }

  function pause() {
    const now = nowMs();
    waiting.current = late.current.map(({ el, due }) => ({ el, ms: Math.max(due - now, 0) }));
    clearLate();
    source.current?.pause();
    take.current?.pause();
    setPaused(true);
  }

  function resume() {
    const s = source.current;
    const t = take.current;
    if (!s || !t) return;
    setPaused(false);
    const wait = new Map(waiting.current.map((w) => [w.el, w.ms]));
    waiting.current = [];
    if (mode === "together") {
      if (!s.ended) run(s, wait.get(s) ?? 0);
      if (!t.ended) run(t, wait.get(t) ?? 0);
    } else {
      void (part === "take" ? t : s).play()?.catch(failed);
    }
  }

  function choose(next: Mode) {
    if (next === mode) return;
    stop();
    setMode(next);
  }

  const status = !active
    ? ""
    : paused
      ? "Paused"
      : mode === "together"
        ? "Playing the source and your take together…"
        : part === "source"
          ? "Playing the source…"
          : "Playing your take…";

  return (
    <div className="grid gap-3 rounded-lg border border-border p-3">
      <HiddenPlayer
        ref={source}
        src={sourceUrl}
        preload="auto"
        playbackRate={rate}
        volume={volume.source}
        onTimeUpdate={(e) => {
          if (live.current) onSourceTime?.(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          if (mode === "together") {
            if (!take.current || take.current.ended) stop();
            return;
          }
          setPart("take");
          void take.current?.play()?.catch(failed);
        }}
      />
      <HiddenPlayer
        ref={take}
        src={shownTakeUrl}
        preload="auto"
        volume={volume.take}
        onEnded={() => {
          if (mode === "together" && source.current && !source.current.ended) return;
          stop();
        }}
      />

      <div role="group" aria-label="Compare" className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-sm text-muted-foreground">Compare</span>
        <Button
          type="button"
          size="sm"
          variant={mode === "after" ? "default" : "outline"}
          aria-pressed={mode === "after"}
          onClick={() => choose("after")}
        >
          One after the other
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "together" ? "default" : "outline"}
          aria-pressed={mode === "together"}
          onClick={() => choose("together")}
        >
          Together
        </Button>
      </div>

      {mode === "together" && (
        <label className="grid gap-1 text-sm">
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>Source louder</span>
            <span>You louder</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={mix}
            aria-label="Mix between the source and your take"
            onChange={(e) => setMix(Number(e.target.value))}
          />
        </label>
      )}

      {mode === "together" && (
        <label className="grid gap-1 text-sm">
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>Source starts later</span>
            <span>Line up: {nudge > 0 ? "+" : ""}{nudge.toFixed(2)}s</span>
            <span>Your take starts later</span>
          </span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={nudge}
            disabled={active}
            aria-label="Line up the source and your take"
            onChange={(e) => setNudge(Number(e.target.value))}
          />
          <span className="text-xs text-muted-foreground">Fixes a small offset from the microphone starting. It applies the next time you press play.</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!active ? (
          <Button type="button" variant="outline" onClick={start}>
            <Play /> {mode === "together" ? "Play both together" : "Play source, then my take"}
          </Button>
        ) : (
          <>
            {paused ? (
              <Button type="button" variant="outline" onClick={resume}>
                <Play /> Resume
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={pause}>
                <Pause /> Pause
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={stop}>
              <Square /> Stop
            </Button>
          </>
        )}
        {status && (
          <span role="status" className="text-sm text-muted-foreground">
            {status}
          </span>
        )}
      </div>
      {rate !== 1 && <p className="text-xs text-muted-foreground">The source plays at {rate}×, the speed you recorded with.</p>}
      {error && <Notice>{error}</Notice>}
    </div>
  );
}
