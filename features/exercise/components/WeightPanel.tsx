"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteWeightAction, logWeightAction } from "@/app/(app)/exercise/actions";
import { LineChart, type LineSeries } from "@/components/charts/LineChart";
import { Notice } from "@/components/Notice";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/features/ielts/components/format";

export type WeightPoint = { date: string; kg?: number; goal: number };

const SERIES: LineSeries<WeightPoint>[] = [
  { key: "kg", label: "Weight", color: "var(--t-6)", pick: (p) => p.kg },
  { key: "goal", label: "Goal line", color: "var(--muted-foreground)", dash: "4 3", pick: (p) => p.goal },
];

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function domain(points: WeightPoint[]): { yDomain: [number, number]; yTicks: number[] } {
  const values = points.flatMap((p) => [p.kg, p.goal]).filter((v): v is number => typeof v === "number");
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const step = hi - lo <= 8 ? 1 : hi - lo <= 20 ? 2 : 5;
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);
  return { yDomain: [lo, hi], yTicks };
}

export function WeightPanel({ points, recent, today }: { points: WeightPoint[]; recent: { date: string; kg: number }[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { yDomain, yTicks } = domain(points);

  function log() {
    start(async () => {
      const res = await logWeightAction(date, kg.trim() === "" ? Number.NaN : Number(kg));
      if (!res.ok) {
        setError(Object.values(res.errors)[0] ?? "Could not save that weight.");
        return;
      }
      setError(null);
      setKg("");
      router.refresh();
    });
  }

  function remove(day: string) {
    start(async () => {
      await deleteWeightAction(day);
      router.refresh();
    });
  }

  return (
    <Panel title="Weight" track="exercise">
      <LineChart
        points={points}
        series={SERIES}
        yDomain={yDomain}
        yTicks={yTicks}
        xLabel={(p) => shortDate(p.date)}
        ariaLabel="Your weight over time against the goal line"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          log();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="grid gap-1 text-sm font-medium">
          Weight (kg)
          <input type="number" inputMode="decimal" step={0.1} min={1} value={kg} onChange={(e) => setKg(e.target.value)} className={`w-28 ${inputClass}`} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <Button type="submit" disabled={pending}>
          Log weight
        </Button>
      </form>
      {error && <Notice>{error}</Notice>}
      {recent.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {recent.map((w) => (
            <li key={w.date} className="flex items-center justify-between gap-3">
              <span>
                {shortDate(w.date)}: {w.kg} kg
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => remove(w.date)} aria-label={`Delete weight for ${w.date}`}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
