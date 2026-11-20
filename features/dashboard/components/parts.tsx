import Link from "next/link";
import { CheckMark, ProgressRing } from "@/components/ProgressRing";
import { focusRing, type TrackName } from "@/components/track";
import { cn } from "@/lib/utils";

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
  return (
    <Link
      href={href}
      className={cn(
        "group grid min-w-0 justify-items-center gap-1.5 rounded-lg p-2 text-center",
        focusRing,
      )}
    >
      <ProgressRing
        value={value}
        max={max}
        track={track}
        done={done}
        size={64}
        stroke={5}
        className="transition-transform duration-300 group-hover:scale-105"
      >
        {done ? (
          <CheckMark className="size-6 text-ok" />
        ) : (
          <span className="text-sm font-semibold tabular-nums">
            {value}
            <span className="text-xs font-normal text-muted-foreground">/{max}</span>
          </span>
        )}
      </ProgressRing>
      <span className="text-xs leading-tight text-muted-foreground group-hover:text-foreground">
        {label}
        <span className="sr-only">
          {done ? ", done today" : `, ${value} of ${max} minutes`}
        </span>
      </span>
    </Link>
  );
}

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
