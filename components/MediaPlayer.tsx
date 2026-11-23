"use client";

import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Button } from "@/components/ui/button";
import { clock } from "@/lib/format";

const SPEEDS = [1, 1.25, 1.5, 0.75];

type PlayerProps = React.ComponentProps<typeof ReactPlayer>;

/**
 * Invisible react-player for audio driven from code (ref.play(), ref.currentTime).
 * react-player re-applies `volume` and `playbackRate` on every render, so pass them
 * as props rather than setting them on the element.
 */
export function HiddenPlayer(props: Omit<PlayerProps, "width" | "height" | "style" | "controls">) {
  return <ReactPlayer {...props} controls={false} width={0} height={0} style={{ display: "none" }} />;
}

export function MediaPlayer({
  src,
  video = false,
  label = video ? "Video" : "Audio",
  playerRef,
  className = "",
  fallbackDuration,
  refreshSrc,
  autoPlay = false,
  onEnded,
  onError,
}: {
  src: string;
  video?: boolean;
  label?: string;
  playerRef?: (el: HTMLVideoElement | null) => void;
  className?: string;
  fallbackDuration?: number;
  refreshSrc?: () => Promise<string | null>;
  autoPlay?: boolean;
  onEnded?: () => void;
  onError?: () => void;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const el = useRef<HTMLVideoElement | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  // `playing` on react-player is re-applied on every render, so it is only set as a
  // one-shot request from the buttons and cleared once the element reports play/pause.
  // That leaves callers free to drive the element through playerRef (el.play()).
  const [isPlaying, setIsPlaying] = useState(false);
  const [request, setRequest] = useState<boolean | undefined>(undefined);
  const playing = request ?? isPlaying;
  const settle = (now: boolean) => {
    setIsPlaying(now);
    setRequest(undefined);
  };
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [reported, setDuration] = useState(0);
  const duration = Number.isFinite(reported) && reported > 0 ? reported : (fallbackDuration ?? 0);
  const [failed, setFailed] = useState(false);

  const parentRef = useRef(playerRef);
  useEffect(() => {
    parentRef.current = playerRef;
  });
  const setRefs = useCallback((node: HTMLVideoElement | null) => {
    el.current = node;
    parentRef.current?.(node);
  }, []);

  const toggle = async () => {
    if (failed) {
      setFailed(false);
      const fresh = refreshSrc ? await refreshSrc().catch(() => null) : null;
      if (fresh && fresh !== currentSrc) setCurrentSrc(fresh);
      else el.current?.load();
      setRequest(true);
      return;
    }
    if (playing) {
      setRequest(false);
      return;
    }
    setRequest(true);
    // A refused play() (autoplay policy) fires no play/pause event, so settle the request here
    // instead of leaving the button on Pause and react-player retrying on every render.
    const media = el.current;
    if (typeof media?.play === "function") media.play()?.catch(() => settle(false));
  };

  const player = (
    <ReactPlayer
      ref={setRefs}
      src={currentSrc}
      playing={request}
      autoPlay={autoPlay}
      muted={muted}
      playbackRate={speed}
      controls={false}
      playsInline
      preload="metadata"
      width={video ? "100%" : 0}
      height={video ? "100%" : 0}
      style={video ? { width: "100%", height: "100%" } : { display: "none" }}
      onPlay={() => settle(true)}
      onPause={() => settle(false)}
      onEnded={() => {
        settle(false);
        setTime(0);
        onEnded?.();
      }}
      onError={() => {
        setFailed(true);
        settle(false);
        onError?.();
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
        <Button
          type="button"
          size="icon"
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          onClick={() => void toggle()}
          className="size-9 rounded-full"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px" aria-hidden />}
        </Button>
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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Playback speed ${speed}x`}
          onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
          className="tabular-nums"
        >
          {speed}x
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
          aria-pressed={muted}
          onClick={() => setMuted((m) => !m)}
          className="rounded-full"
        >
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        </Button>
        {video && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Fullscreen"
            onClick={() => void screen.current?.requestFullscreen?.()}
            className="rounded-full"
          >
            <Maximize className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
