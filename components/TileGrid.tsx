"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { CheckMark, ProgressRing } from "@/components/ProgressRing";
import { Badge } from "@/components/ui/badge";
import { focusRing, trackVar, type TrackName } from "@/components/track";
import { cn } from "@/lib/utils";

export type Tile = {
  key: string;
  href: string;
  title: string;
  value: number;
  max: number;
  stat: string;
  meta?: string;
  badge?: { label: string; tone?: "primary" | "muted" };
  group?: string;
};

type Status = "all" | "doing" | "new" | "done";

const statusOf = (t: Tile): Exclude<Status, "all"> =>
  t.max > 0 && t.value >= t.max ? "done" : t.value > 0 ? "doing" : "new";

const LABEL: Record<Status, string> = { all: "All", doing: "In progress", new: "Not started", done: "Finished" };
const FILTERS: Status[] = ["all", "doing", "new", "done"];

function TileCard({ tile, track }: { tile: Tile; track: TrackName }) {
  const status = statusOf(tile);
  const pct = tile.max > 0 ? Math.min(100, Math.round((tile.value / tile.max) * 100)) : 0;
  const color = status === "done" ? "var(--ok)" : trackVar(track);
  return (
    <li className="min-w-0">
      <Link
        href={tile.href}
        className={cn(
          "card-interactive group grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-2xl border border-border p-4 shadow-xs pointer-coarse:py-5 sm:p-5",
          focusRing,
        )}
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${color} 10%, var(--card)), var(--card) 62%)`,
        }}
      >
        <span className="grid min-w-0 gap-1.5">
          <span className="text-pretty text-base font-semibold leading-snug">{tile.title}</span>
          <span className="text-sm text-muted-foreground">{tile.stat}</span>
          {(status === "done" || tile.badge || tile.meta) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {status === "done" ? (
                <Badge variant="ok">Finished</Badge>
              ) : tile.badge ? (
                <Badge variant={tile.badge.tone ?? "muted"}>{tile.badge.label}</Badge>
              ) : null}
              {tile.meta && <span className="text-xs text-muted-foreground">{tile.meta}</span>}
            </span>
          )}
        </span>
        <ProgressRing
          value={tile.value}
          max={tile.max}
          track={track}
          done={status === "done"}
          size={52}
          className="transition-transform duration-300 group-hover:scale-105"
        >
          {status === "done" ? (
            <CheckMark className="text-ok" />
          ) : (
            <span className="text-xs font-semibold tabular-nums">{pct}%</span>
          )}
        </ProgressRing>
      </Link>
    </li>
  );
}

export function TileGrid({
  tiles,
  track,
  empty,
  className,
}: {
  tiles: Tile[];
  track: TrackName;
  empty: string;
  className?: string;
}) {
  const [filter, setFilter] = useState<Status>("all");

  if (tiles.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const counts: Record<Status, number> = { all: tiles.length, doing: 0, new: 0, done: 0 };
  for (const t of tiles) counts[statusOf(t)]++;
  const shown = filter === "all" ? tiles : tiles.filter((t) => statusOf(t) === filter);
  const showFilters = tiles.length > 3;

  const groups: { name: string | undefined; tiles: Tile[] }[] = [];
  for (const t of shown) {
    const last = groups[groups.length - 1];
    const existing = t.group === undefined ? last : groups.find((g) => g.name === t.group);
    if (existing) existing.tiles.push(t);
    else groups.push({ name: t.group, tiles: [t] });
  }

  return (
    <div className="grid gap-4">
      {showFilters && (
        <div role="group" aria-label="Filter by progress" className="flex flex-wrap gap-2">
          {FILTERS.filter((f) => f === "all" || counts[f] > 0 || f === filter).map((f) => (
            <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
              {LABEL[f]} <span className="ml-1.5 tabular-nums opacity-70">{counts[f]}</span>
            </Chip>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Nothing is {LABEL[filter].toLowerCase()} right now.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.name ?? "all"} aria-label={g.name} className="grid gap-3">
            {g.name && <h2 className="text-lg font-semibold tracking-tight">{g.name}</h2>}
            <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
              {g.tiles.map((t) => (
                <TileCard key={t.key} tile={t} track={track} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
