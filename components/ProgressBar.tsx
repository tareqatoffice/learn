import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  secondary = 0,
  max,
  color,
  label,
  animate = true,
  className,
}: {
  value: number;
  secondary?: number;
  max: number;
  color?: string;
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const pct = (n: number) => (max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0);
  const a11y = label
    ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": value }
    : { "aria-hidden": true };
  return (
    <div {...a11y} className={cn("flex h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full bg-ok", animate ? "progress-fill" : "transition-[width]")}
        style={{ width: `${pct(value)}%`, ...(color ? { background: color } : {}) }}
      />
      {secondary > 0 && (
        <div
          className={cn("h-full", animate ? "progress-fill" : "transition-[width]")}
          style={{
            width: `${Math.min(pct(secondary), 100 - pct(value))}%`,
            background: "color-mix(in oklch, var(--ok) 40%, var(--muted))",
          }}
        />
      )}
    </div>
  );
}
