import { trackVar, type TrackName } from "@/components/track";
import { cn } from "@/lib/utils";

const R = 26;
const C = 2 * Math.PI * R;

/** Circular progress with its content centred. Draws in once on load (see `.ring-fill`). */
export function ProgressRing({
  value,
  max,
  track,
  done = false,
  size = 44,
  stroke = 6,
  className,
  children,
}: {
  value: number;
  max: number;
  track: TrackName;
  /** Finished: the arc turns "done" green regardless of the numbers. */
  done?: boolean;
  /** Outer size in px. */
  size?: number;
  /** Arc thickness in viewBox units (the ring is 64 wide). */
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : done ? 1 : 0;
  return (
    <span
      aria-hidden
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" strokeWidth={stroke} stroke="var(--muted)" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={done ? "var(--ok)" : trackVar(track)}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          className="ring-fill"
          style={{ "--c": C } as React.CSSProperties}
        />
      </svg>
      <span className="relative grid place-items-center">{children}</span>
    </span>
  );
}

export function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5 10 17.5 19 7.5" />
    </svg>
  );
}
