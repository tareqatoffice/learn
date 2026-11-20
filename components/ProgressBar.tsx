import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  secondary = 0,
  max,
  color,
  className,
}: {
  value: number;
  secondary?: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = (n: number) => (max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0);
  return (
    <div aria-hidden className={cn("flex h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="progress-fill h-full bg-ok"
        style={{ width: `${pct(value)}%`, ...(color ? { background: color } : {}) }}
      />
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
