"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Plays the lesson clip and then the learner's take, back to back, for comparison. */
export function ShadowPlayer({ sourceUrl, takeUrl }: { sourceUrl: string; takeUrl: string }) {
  const source = useRef<HTMLAudioElement>(null);
  const take = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<"source" | "take" | null>(null);

  function stop() {
    for (const el of [source.current, take.current]) {
      el?.pause();
      if (el) el.currentTime = 0;
    }
    setPlaying(null);
  }

  function play() {
    stop();
    const el = source.current;
    if (!el) return;
    setPlaying("source");
    void el.play()?.catch(() => setPlaying(null));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <audio
        ref={source}
        src={sourceUrl}
        preload="auto"
        onEnded={() => {
          setPlaying("take");
          void take.current?.play()?.catch(() => setPlaying(null));
        }}
      />
      <audio ref={take} src={takeUrl} preload="auto" onEnded={() => setPlaying(null)} />
      {playing ? (
        <Button variant="outline" onClick={stop}>
          Stop
        </Button>
      ) : (
        <Button variant="outline" onClick={play}>
          Play source, then my take
        </Button>
      )}
      {playing && (
        <span role="status" className="text-sm text-muted-foreground">
          {playing === "source" ? "Playing the source…" : "Playing your take…"}
        </span>
      )}
    </div>
  );
}
