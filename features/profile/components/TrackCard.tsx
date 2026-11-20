import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { trackVar, type TrackName } from "@/components/track";

const linkClass =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ProgressRows({
  rows,
  empty,
  track,
}: {
  track?: TrackName;
  rows: {
    key: string;
    href: string;
    label: string;
    value: number;
    max: number;
  }[];
  empty: string;
}) {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3"
        >
          <Link
            href={r.href}
            className={`truncate text-sm pointer-coarse:py-2 ${linkClass}`}
          >
            {r.label}
          </Link>
          <span className="text-xs tabular-nums text-muted-foreground">
            {r.value}/{r.max}
          </span>
          <ProgressBar
            value={r.value}
            max={r.max}
            color={track && r.value < r.max ? trackVar(track) : undefined}
            className="col-span-2"
          />
        </li>
      ))}
    </ul>
  );
}
