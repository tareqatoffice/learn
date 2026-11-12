"use client";

import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";

const SPEEDS = [1, 1.25, 1.5, 0.75];

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Audio or video with our own controls (play/pause, seek, time, mute, speed, fullscreen for video) on
 * top of ReactPlayer's media element. `video` shows the picture above the controls; audio hides it.
 * `playerRef` exposes the element so a parent can seek or play it (e.g. jump to a moment).
 */
export function MediaPlayer({
  src,
  video = false,
  label = video ? "Video" : "Audio",
  playerRef,
  className = "",
}: {
  src: string;
  video?: boolean;
  label?: string;
  playerRef?: (el: HTMLVideoElement | null) => void;
  className?: string;
}) {
  const el = useRef<HTMLVideoElement | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // A stable ref callback: the parent's function may change identity every render.
  const parentRef = useRef(playerRef);
  useEffect(() => {
    parentRef.current = playerRef;
  });
  const setRefs = useCallback((node: HTMLVideoElement | null) => {
    el.current = node;
    parentRef.current?.(node);
  }, []);

  const toggle = () => {
    if (failed) {
      // Try again: reload the file, e.g. after a dropped connection.
      setFailed(false);
      el.current?.load();
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const player = (
    <ReactPlayer
      ref={setRefs}
      src={src}
      playing={playing}
      muted={muted}
      playbackRate={speed}
      controls={false}
      playsInline
      preload="metadata"
      width={video ? "100%" : 0}
      height={video ? "100%" : 0}
      style={video ? { width: "100%", height: "100%" } : { display: "none" }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        setTime(0);
      }}
      onError={() => {
        setFailed(true);
        setPlaying(false);
      }}
      onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      onDurationChange={(e) => setDuration(e.currentTarget.duration)}
    />
  );

  return (
    <div className={`grid gap-2 ${className}`}>
      {video ? (
        <div ref={screen} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {player}
        </div>
      ) : (
        player
      )}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <button
          type="button"
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          onClick={toggle}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px" aria-hidden />}
        </button>
        <input
          type="range"
          aria-label={`${label} position`}
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(time, Number.isFinite(duration) ? duration : 0)}
          disabled={!(duration > 0)}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (el.current) el.current.currentTime = t;
            setTime(t);
          }}
          className="h-1.5 min-w-0 flex-1 accent-primary"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {failed ? "Can't play. Press play to retry." : `${clock(time)} / ${clock(duration)}`}
        </span>
        <button
          type="button"
          aria-label={`Playback speed ${speed}x`}
          onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
          className={`${iconButton} w-auto px-2 text-xs tabular-nums`}
        >
          {speed}x
        </button>
        <button
          type="button"
          aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
          aria-pressed={muted}
          onClick={() => setMuted((m) => !m)}
          className={iconButton}
        >
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        </button>
        {video && (
          <button
            type="button"
            aria-label="Fullscreen"
            onClick={() => void screen.current?.requestFullscreen?.()}
            className={iconButton}
          >
            <Maximize className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
