"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { FOCUSES, type Focus } from "@/models/exerciseConstants";
import type { Exercise } from "../catalog";
import { EXERCISE_TYPES } from "@/models/exerciseConstants";
import { ExerciseFrames } from "./ExerciseFrames";
import { Card } from "@/components/Card";

const TYPES = EXERCISE_TYPES;
const DIFFICULTIES: { value: Exercise["difficulty"]; label: string }[] = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Hard" },
];

type Filters = { focus: Focus[]; type: Exercise["type"] | null; difficulty: Exercise["difficulty"] | null; q: string };

const NO_FILTERS: Filters = { focus: [], type: null, difficulty: null, q: "" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function parse(params: URLSearchParams): Filters {
  const diff = Number(params.get("difficulty"));
  const type = params.get("type");
  return {
    focus: (params.get("focus") ?? "").split(",").filter((f): f is Focus => (FOCUSES as readonly string[]).includes(f)),
    type: TYPES.find((t) => t === type) ?? null,
    difficulty: DIFFICULTIES.find((d) => d.value === diff)?.value ?? null,
    q: params.get("q") ?? "",
  };
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.focus.length) p.set("focus", f.focus.join(","));
  if (f.type) p.set("type", f.type);
  if (f.difficulty) p.set("difficulty", String(f.difficulty));
  if (f.q.trim()) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function matches(e: Exercise, f: Filters): boolean {
  return (
    f.focus.every((x) => e.focus.includes(x)) &&
    (!f.type || e.type === f.type) &&
    (!f.difficulty || e.difficulty === f.difficulty) &&
    e.name.toLowerCase().includes(f.q.trim().toLowerCase())
  );
}

/** Filterable exercise cards; the filters live in the URL search params. */
export function LibraryBrowser({ exercises }: { exercises: Exercise[] }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parse(new URLSearchParams(params.toString())));

  const update = (next: Filters) => {
    setFilters(next);
    window.history.replaceState(null, "", `${window.location.pathname}${toQuery(next)}`);
  };

  const shown = exercises.filter((e) => matches(e, filters));
  const active = toQuery(filters) !== "";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search by name"
          value={filters.q}
          onChange={(e) => update({ ...filters, q: e.target.value })}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-base"
        />
        <div role="group" aria-label="Focus" className="flex flex-wrap gap-2">
          {FOCUSES.map((f) => (
            <Chip
              key={f}
              on={filters.focus.includes(f)}
              onClick={() => update({ ...filters, focus: filters.focus.includes(f) ? filters.focus.filter((x) => x !== f) : [...filters.focus, f] })}
            >
              {cap(f)}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Chip key={t} on={filters.type === t} onClick={() => update({ ...filters, type: filters.type === t ? null : t })}>
              {cap(t)}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d.value}
              on={filters.difficulty === d.value}
              onClick={() => update({ ...filters, difficulty: filters.difficulty === d.value ? null : d.value })}
            >
              {d.label}
            </Chip>
          ))}
        </div>
        {active && (
          <div>
            <Button variant="outline" size="sm" onClick={() => update(NO_FILTERS)}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises match these filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((e) => (
            <Card as="li" key={e.id} className="grid gap-3 p-4">
              <ExerciseFrames exercise={e} size="sm" />
              <h2 className="text-base font-medium">{e.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                {e.focus.map((f) => (
                  <span key={f} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {cap(f)}
                  </span>
                ))}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {e.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
