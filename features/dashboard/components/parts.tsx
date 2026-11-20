import Link from "next/link";
import { cn } from "@/lib/utils";

/** Track identity: each area of the app keeps one hue everywhere on the dashboard. */
export const TRACK = {
  graphs: 0,
  speaking: 1,
  notes: 2,
  interview: 3,
  ielts: 4,
} as const;
export type TrackName = keyof typeof TRACK;

export const trackVar = (track: TrackName) => `var(--t-${TRACK[track]})`;

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Panel({
  title,
  track,
  action,
  children,
  className,
}: {
  title: string;
  track?: TrackName;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid min-w-0 content-start gap-3 rounded-xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 id={id} className="flex min-w-0 items-center gap-2 text-base font-semibold">
          {track && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: trackVar(track) }}
            />
          )}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Circular progress for one speaking task: minutes done against the daily target. */
export function Ring({
  value,
  max,
  done,
  label,
  href,
  track,
}: {
  value: number;
  max: number;
  done: boolean;
  label: string;
  href: string;
  track: TrackName;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : done ? 1 : 0;
  const color = trackVar(track);
  return (
    <Link
      href={href}
      className={cn(
        "group grid min-w-0 justify-items-center gap-1.5 rounded-lg p-2 text-center",
        focusRing,
      )}
    >
      <span className="relative grid size-16 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" stroke="var(--muted)" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke={done ? "var(--ok)" : color}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="ring-fill"
            style={{ "--c": c } as React.CSSProperties}
          />
        </svg>
        {done ? (
          <svg viewBox="0 0 24 24" className="relative size-6 text-ok" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5 10 17.5 19 7.5" />
          </svg>
        ) : (
          <span className="relative text-sm font-semibold tabular-nums">
            {value}
            <span className="text-xs font-normal text-muted-foreground">/{max}</span>
          </span>
        )}
      </span>
      <span className="text-xs leading-tight text-muted-foreground group-hover:text-foreground">
        {label}
        <span className="sr-only">
          {done ? ", done today" : `, ${value} of ${max} minutes`}
        </span>
      </span>
    </Link>
  );
}

/** Two-part bar for a quiz: answers you got against those sent to review. */
export function SplitBar({ got, review }: { got: number; review: number }) {
  const total = got + review;
  if (total === 0) return <div aria-hidden className="h-1.5 rounded-full bg-muted" />;
  return (
    <div aria-hidden className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
      <div className="progress-fill h-full bg-ok" style={{ width: `${(got / total) * 100}%` }} />
      <div
        className="progress-fill h-full"
        style={{ width: `${(review / total) * 100}%`, background: "var(--t-1)" }}
      />
    </div>
  );
}
