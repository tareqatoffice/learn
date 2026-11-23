"use client";

import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CLIP_RATES, type ClipRate, type Sentence, sentenceAt } from "@/features/speaking/shadowText";
import { clock } from "./format";
import { ShadowText } from "./ShadowText";

const BACK_SEC = 3;
const LOOP_GAP_MS = 400;

export function RatePicker({
  rate,
  onRate,
  disabled,
  label = "Clip speed",
}: {
  rate: ClipRate;
  onRate: (rate: ClipRate) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-sm text-muted-foreground">{label}</span>
      {CLIP_RATES.map((r) => (
        <Button
          key={r}
          type="button"
          size="sm"
          variant={r === rate ? "default" : "outline"}
          aria-pressed={r === rate}
          disabled={disabled}
          onClick={() => onRate(r)}
        >
          {r}×
        </Button>
      ))}
    </div>
  );
}

export function ShadowPractice({
  src,
  sentences,
  rate,
  onRate,
}: {
  src: string;
  sentences: readonly Sentence[];
  rate: ClipRate;
  onRate: (rate: ClipRate) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(-1);
  const [error, setError] = useState("");
  const loopRef = useRef(-1);
  const durationRef = useRef(0);
  const gap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const active = sentenceAt(sentences, time);

  useEffect(() => {
    loopRef.current = loop;
    durationRef.current = duration;
  }, [loop, duration]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const el = audio.current;
    return () => {
      clearTimeout(gap.current);
      el?.pause();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = audio.current;
      if (el) {
        const t = el.currentTime;
        const i = loopRef.current;
        const s = sentences[i];
        const stop = s ? (s.end > s.start ? s.end : durationRef.current || s.start + 5) : 0;
        if (s && t >= stop - 0.05) {
          el.pause();
          el.currentTime = s.start;
          setTime(s.start);
          clearTimeout(gap.current);
          gap.current = setTimeout(() => void el.play()?.catch(() => setPlaying(false)), LOOP_GAP_MS);
        } else {
          setTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sentences]);

  function play() {
    const el = audio.current;
    if (!el) return;
    setError("");
    el.playbackRate = rate;
    void el.play()?.catch(() => {
      setPlaying(false);
      setError("The clip didn't start. Try again.");
    });
  }

  function pause() {
    clearTimeout(gap.current);
    audio.current?.pause();
  }

  function seek(t: number, andPlay = true) {
    const el = audio.current;
    if (!el) return;
    const max = duration || (Number.isFinite(el.duration) ? el.duration : 0);
    const at = Math.max(0, max ? Math.min(t, max - 0.05) : t);
    el.currentTime = at;
    setTime(at);
    if (andPlay) play();
  }

  function jump(i: number) {
    if (i < 0 || i >= sentences.length) return;
    if (loop >= 0) setLoop(i);
    clearTimeout(gap.current);
    seek(sentences[i].start);
  }

  function toggleLoop() {
    if (loop >= 0) return setLoop(-1);
    const i = Math.max(active, 0);
    setLoop(i);
    if (!playing) seek(sentences[i].start);
  }

  const current = Math.max(active, 0);

  return (
    <section aria-label="Practise the clip" className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Practise first</h2>
        <p className="text-xs text-muted-foreground">Nothing is recorded here. Tap a sentence to hear it.</p>
      </div>

      <audio
        ref={audio}
        src={src}
        preload="auto"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
          e.currentTarget.playbackRate = rate;
        }}
      />

      {sentences.length > 0 && <ShadowText sentences={sentences} active={active} looped={loop} onPick={jump} />}

      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button type="button" onClick={pause}>
            <Pause /> Pause
          </Button>
        ) : (
          <Button type="button" onClick={play}>
            <Play /> Play
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Back ${BACK_SEC} seconds`}
          onClick={() => seek(time - BACK_SEC, playing)}
        >
          <RotateCcw />
        </Button>
        {sentences.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous sentence"
              disabled={current === 0}
              onClick={() => jump(current - 1)}
            >
              <SkipBack />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next sentence"
              disabled={current >= sentences.length - 1}
              onClick={() => jump(current + 1)}
            >
              <SkipForward />
            </Button>
          </>
        )}
        {sentences.length > 0 && (
          <Button type="button" variant={loop >= 0 ? "default" : "outline"} aria-pressed={loop >= 0} onClick={toggleLoop}>
            <Repeat /> {loop >= 0 ? `Repeating sentence ${loop + 1}` : "Repeat sentence"}
          </Button>
        )}
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {clock(time)} / {clock(duration)}
        </span>
      </div>

      <RatePicker rate={rate} onRate={onRate} />
      <p className="text-xs text-muted-foreground">The speed you pick is also used when you record a take.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
