import { cn } from "@/lib/utils";

/**
 * A thin determinate bar; the numbers beside it carry the meaning, so the bar itself is decorative.
 * `secondary` adds a paler segment after the main one (e.g. topics in progress after topics done).
 */
export function ProgressBar({ value, secondary = 0, max, className }: { value: number; secondary?: number; max: number; className?: string }) {
  const pct = (n: number) => (max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0);
  return (
    <div aria-hidden className={cn("flex h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="progress-fill h-full bg-ok" style={{ width: `${pct(value)}%` }} />
      {secondary > 0 && (
        <div
          className="progress-fill h-full"
          style={{
            width: `${Math.min(pct(secondary), 100 - pct(value))}%`,
            background: "color-mix(in oklch, var(--ok) 40%, var(--muted))",
          }}
        />
      )}
    </div>
  );
}
