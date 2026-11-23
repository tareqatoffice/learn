"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "after" | "together";
type Part = "source" | "take";

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
  const source = useRef<HTMLAudioElement>(null);
  const take = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<Mode>("after");
  const [part, setPart] = useState<Part | null>(null);
  const [paused, setPaused] = useState(false);
  const [mix, setMix] = useState(50);
  const [error, setError] = useState("");
  const live = useRef(false);
  const active = part !== null;
  // A renewed link replaces the take's source only between plays, so playback never restarts.
  const [shownTakeUrl, setShownTakeUrl] = useState(takeUrl);
  if (!active && shownTakeUrl !== takeUrl) setShownTakeUrl(takeUrl);

  useEffect(() => {
    const s = source.current;
    const t = take.current;
    if (!s || !t) return;
    s.defaultPlaybackRate = rate;
    s.playbackRate = rate;
    const v = mode === "together" ? mixVolumes(mix) : { source: 1, take: 1 };
    s.volume = v.source;
    t.volume = v.take;
  }, [rate, mode, mix]);

  useEffect(() => {
    const s = source.current;
    const t = take.current;
    return () => {
      s?.pause();
      t?.pause();
    };
  }, []);

  function stop() {
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
    void s.play()?.catch(failed);
    if (mode === "together") void t.play()?.catch(failed);
  }

  function pause() {
    source.current?.pause();
    take.current?.pause();
    setPaused(true);
  }

  function resume() {
    const s = source.current;
    const t = take.current;
    if (!s || !t) return;
    setPaused(false);
    if (mode === "together") {
      if (!s.ended) void s.play()?.catch(failed);
      if (!t.ended) void t.play()?.catch(failed);
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
      <audio
        ref={source}
        src={sourceUrl}
        preload="auto"
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
      <audio
        ref={take}
        src={shownTakeUrl}
        preload="auto"
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
