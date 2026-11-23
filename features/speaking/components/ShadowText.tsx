"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Sentence } from "@/features/speaking/shadowText";

export function ShadowText({
  sentences,
  active,
  looped = -1,
  onPick,
  follow = true,
  label = "Clip transcript",
}: {
  sentences: readonly Sentence[];
  active: number;
  looped?: number;
  onPick?: (index: number) => void;
  follow?: boolean;
  label?: string;
}) {
  const box = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!follow || active < 0) return;
    const list = box.current;
    const el = list?.children[active] as HTMLElement | undefined;
    if (!list || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top >= list.scrollTop && bottom <= list.scrollTop + list.clientHeight) return;
    list.scrollTo?.({ top: Math.max(0, top - list.clientHeight / 3), behavior: "smooth" });
  }, [active, follow]);

  return (
    <ol ref={box} aria-label={label} className="relative grid max-h-80 gap-1 overflow-y-auto text-base leading-relaxed">
      {sentences.map((s, i) => {
        const on = i === active;
        const cls = cn(
          "rounded-md px-2 py-1 text-left transition-colors",
          on ? "bg-ring/15 text-foreground" : "text-muted-foreground",
          i === looped && "ring-1 ring-ring",
        );
        return (
          <li key={i} aria-current={on ? "true" : undefined}>
            {onPick ? (
              <button type="button" className={cn(cls, "w-full hover:bg-muted")} onClick={() => onPick(i)}>
                {s.text}
              </button>
            ) : (
              <p className={cls}>{s.text}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
