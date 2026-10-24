import { cn } from "@/lib/utils";

/** A thin determinate bar; the numbers beside it carry the meaning, so the bar itself is decorative. */
export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div aria-hidden className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}
