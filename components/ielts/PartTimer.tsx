import { clock } from "@/components/speaking/format";

/**
 * The clock for one stage of a Speaking part: elapsed against a target (or, with `countdown`, the
 * time left), a bar that fills toward the target, and an optional tick such as Part 2's one-minute mark.
 */
export function PartTimer({
  label,
  elapsedSec,
  totalSec,
  markSec,
  countdown = false,
}: {
  label: string;
  elapsedSec: number;
  totalSec: number;
  markSec?: number;
  countdown?: boolean;
}) {
  const shown = countdown ? Math.max(0, totalSec - elapsedSec) : elapsedSec;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / totalSec) * 100))}%`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums" aria-live="off">
          {countdown ? `${clock(shown)} left` : `${clock(shown)} / ${clock(totalSec)}`}
        </span>
      </div>
      <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-ring transition-[width] duration-300" style={{ width: pct(elapsedSec) }} />
        {markSec !== undefined && <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: pct(markSec) }} />}
      </div>
    </div>
  );
}
