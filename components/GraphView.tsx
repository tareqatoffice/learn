"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { setNodeStatusAction } from "@/app/(app)/graphs/actions";
import { Chip } from "@/components/Chip";
import { TopicPanel } from "@/components/TopicPanel";
import type { GraphView as GraphData } from "@/content/queries";
import { layoutGraph, NH, NW, readyNext } from "@/graph/layout";
import type { NodeStatus } from "@/progress/graph";
import { cn } from "@/lib/utils";

const statusOf = (progress: GraphData["progress"], id: string): NodeStatus => progress[id] ?? "none";

export function GraphView({ data }: { data: GraphData }) {
  const pathname = usePathname();
  // The URL's ?topic= is the selection, so any link to another topic of this graph (the panel's
  // prerequisites, links from elsewhere) selects it without a remount.
  const selected = useSearchParams().get("topic");
  const { graph, nodes } = data;
  const [progress, setProgress] = useState(data.progress);
  const [focus, setFocus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => layoutGraph(nodes, graph.tracks), [nodes, graph.tracks]);
  const trackIdx = useMemo(() => new Map(graph.tracks.map((t, i) => [t.key, i])), [graph.tracks]);
  const trackName = useMemo(() => new Map(graph.tracks.map((t) => [t.key, t.name])), [graph.tracks]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const ready = useMemo(() => new Set(readyNext(nodes, progress)), [nodes, progress]);
  const done = nodes.filter((n) => progress[n.id] === "done").length;
  const learning = nodes.filter((n) => progress[n.id] === "learning").length;
  const current = nodes.find((n) => n.slug === selected) ?? null;

  function select(slug: string) {
    setError(null);
    // The native history API updates useSearchParams without refetching the page from the server.
    window.history.replaceState(null, "", `${pathname}?topic=${encodeURIComponent(slug)}`);
    panelRef.current?.focus({ preventScroll: window.matchMedia("(min-width: 1024px)").matches });
  }

  async function changeStatus(nodeId: string, status: NodeStatus) {
    const before = progress;
    setPending(true);
    setError(null);
    setProgress((p) => {
      const next = { ...p };
      if (status === "none") delete next[nodeId];
      else next[nodeId] = status;
      return next;
    });
    try {
      await setNodeStatusAction(nodeId, status);
    } catch {
      setProgress(before);
      setError("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{graph.title}</h1>
          {graph.subtitle && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{graph.subtitle}</p>}
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {done}/{nodes.length} done · {learning} learning
        </p>
      </header>

      {graph.tracks.length > 0 && (
        <div role="group" aria-label="Highlight a track" className="flex flex-wrap gap-2">
          <Chip on={focus === null} onClick={() => setFocus(null)}>
            All tracks
          </Chip>
          {graph.tracks.map((t) => (
            <Chip key={t.key} on={focus === t.key} onClick={() => setFocus(focus === t.key ? null : t.key)}>
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 overflow-auto rounded-xl border border-border bg-card p-3">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label="Prerequisite graph"
            className="block"
          >
            {layout.rows
              .filter((r) => r.first)
              .map((r) => (
                <text key={r.tier} x={16} y={r.y + NH / 2 + 4} className="fill-muted-foreground font-mono text-[11px] uppercase tracking-wider">
                  Step {r.tier + 1}
                </text>
              ))}

            {nodes.flatMap((n) =>
              n.prereqIds.map((p) => {
                const a = layout.positions[p];
                const b = layout.positions[n.id];
                if (!a || !b) return null;
                const x1 = a.x + NW / 2;
                const y1 = a.y + NH;
                const x2 = b.x + NW / 2;
                const y2 = b.y;
                const dy = Math.max(24, (y2 - y1) / 2);
                const lit = current && (current.id === n.id || current.id === p);
                return (
                  <path
                    key={`${p}-${n.id}`}
                    d={`M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`}
                    fill="none"
                    className={cn(lit ? "stroke-foreground" : "stroke-border")}
                    strokeWidth={lit ? 2 : 1.4}
                  />
                );
              }),
            )}

            {nodes.map((n) => {
              const pos = layout.positions[n.id];
              const s = statusOf(progress, n.id);
              const color = `var(--t-${trackIdx.get(n.trackKey) ?? 0})`;
              const dimmed = focus !== null && focus !== n.trackKey;
              const isSel = n.slug === selected;
              const label = `${n.title}, ${s === "none" ? (ready.has(n.id) ? "ready to start" : "not started") : s}`;
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={isSel}
                  onClick={() => select(n.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(n.slug);
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-foreground"
                  style={{ opacity: dimmed ? 0.3 : 1 }}
                >
                  {s === "none" && ready.has(n.id) && (
                    <rect x={-4} y={-4} width={NW + 8} height={NH + 8} rx={11} fill="none" className="stroke-muted-foreground" strokeDasharray="2 3" />
                  )}
                  <rect
                    width={NW}
                    height={NH}
                    rx={8}
                    stroke={isSel ? "var(--fg)" : color}
                    strokeWidth={isSel ? 3 : 1.8}
                    strokeDasharray={s === "learning" ? "6 3" : undefined}
                    fill={s === "done" ? `color-mix(in srgb, ${color} 22%, var(--surface))` : "var(--surface)"}
                    style={s === "learning" ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
                  />
                  <text x={12} y={NH / 2 + 4.5} className="fill-foreground text-[12.5px] font-medium">
                    {n.title}
                  </text>
                  {s === "done" && (
                    <text x={NW - 10} y={NH / 2 + 5} textAnchor="end" className="fill-ok text-[13px]">
                      ✓
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Filled = done</span>
            <span>Dashed with glow = learning</span>
            <span>Dotted ring = ready next</span>
          </p>
        </div>

        <div
          ref={panelRef}
          tabIndex={-1}
          aria-label="Topic details"
          className="rounded-xl border border-border bg-card p-5 outline-none lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-auto"
        >
          {current ? (
            <>
              <TopicPanel
                node={{ ...current, trackName: trackName.get(current.trackKey) ?? "" }}
                status={statusOf(progress, current.id)}
                onStatus={(s) => changeStatus(current.id, s)}
                pending={pending}
                topicHref={(slug) => `${pathname}?topic=${encodeURIComponent(slug)}`}
                related={{
                  questions: current.related.questions,
                  notes: current.related.notes,
                  prereqs: current.prereqIds.flatMap((id) => {
                    const p = byId.get(id);
                    return p ? [{ slug: p.slug, title: p.title, status: statusOf(progress, p.id) }] : [];
                  }),
                }}
              />
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a topic in the graph to see its details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
