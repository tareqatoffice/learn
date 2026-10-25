"use client";

import { Maximize2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { setNodeStatusAction } from "@/app/(app)/graphs/actions";
import { Chip } from "@/components/Chip";
import { ProgressBar } from "@/components/ProgressBar";
import { type NodeState, STATE_LABEL, StatusGlyph, StatusIcon } from "@/components/StatusIcon";
import { TopicPanel, type TopicPanelProps } from "@/components/TopicPanel";
import { TopicReader } from "@/components/TopicReader";
import { Button } from "@/components/ui/button";
import type { GraphView as GraphData } from "@/content/queries";
import { layoutGraph, LBL, NH, NW, readyNext } from "@/graph/layout";
import type { NodeStatus } from "@/progress/graph";
import { cn } from "@/lib/utils";

const statusOf = (progress: GraphData["progress"], id: string): NodeStatus => progress[id] ?? "none";

const EDGE_COLOR = {
  chain: "var(--foreground)",
  unlock: "var(--muted-foreground)",
  met: "color-mix(in oklch, var(--ok) 55%, var(--border))",
  base: "var(--border)",
} as const;

const TRACK_COLORS = 6;

// About 20 characters of 13px text fit beside the status icon; longer titles wrap onto a second line.
const LINE_CHARS = 20;

/** Up to two lines of at most LINE_CHARS each, word-wrapped, ellipsised when the title runs longer. */
function wrapTitle(title: string): { lines: string[]; cut: boolean } {
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= LINE_CHARS) line = next;
    else if (!line) line = word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const cut = lines.length > 2 || lines.some((l) => l.length > LINE_CHARS);
  const shown = lines.slice(0, 2).map((l) => (l.length > LINE_CHARS ? `${l.slice(0, LINE_CHARS - 1)}…` : l));
  if (lines.length > 2) shown[1] = `${shown[1].slice(0, LINE_CHARS - 1).trimEnd()}…`;
  return { lines: shown, cut };
}

export function GraphView({ data }: { data: GraphData }) {
  const pathname = usePathname();
  // The URL's ?topic= is the selection, so any link to another topic of this graph (the panel's
  // prerequisites, links from elsewhere) selects it without a remount.
  const searchParams = useSearchParams();
  const selected = searchParams.get("topic");
  // ?read=1 opens the selected topic in the full-screen reader, so the back button closes it.
  const readParam = searchParams.get("read") === "1";
  const { graph, nodes } = data;
  const [progress, setProgress] = useState(data.progress);
  const [focus, setFocus] = useState<string | null>(null);
  // The topic under the mouse or keyboard focus; it previews its chain the way a selection does.
  const [hovered, setHovered] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Whether this page pushed the reader's history entry, so closing can step back over it.
  const pushedReader = useRef(false);

  const layout = useMemo(() => layoutGraph(nodes, graph.tracks), [nodes, graph.tracks]);
  const trackIdx = useMemo(() => new Map(graph.tracks.map((t, i) => [t.key, i])), [graph.tracks]);
  const trackName = useMemo(() => new Map(graph.tracks.map((t) => [t.key, t.name])), [graph.tracks]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Each topic's dependents: the topics it unlocks.
  const children = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) for (const p of n.prereqIds) m.set(p, [...(m.get(p) ?? []), n.id]);
    return m;
  }, [nodes]);
  const ready = useMemo(() => new Set(readyNext(nodes, progress)), [nodes, progress]);
  const done = nodes.filter((n) => progress[n.id] === "done").length;
  const learning = nodes.filter((n) => progress[n.id] === "learning").length;
  const current = nodes.find((n) => n.slug === selected) ?? null;
  const upNext = nodes.filter((n) => ready.has(n.id));
  const reading = readParam && current !== null;
  // Reading order for the reader's previous/next: step by step, left to right.
  const order = useMemo(
    () =>
      nodes.toSorted(
        (a, b) => (layout.positions[a.id]?.y ?? 0) - (layout.positions[b.id]?.y ?? 0) || (layout.positions[a.id]?.x ?? 0) - (layout.positions[b.id]?.x ?? 0),
      ),
    [nodes, layout],
  );

  // On a canvas narrower than the graph (phones), bring the selected topic, else the first one ready, into view.
  const focusId = current?.id ?? upNext[0]?.id;
  useEffect(() => {
    const el = canvasRef.current;
    const pos = focusId ? layout.positions[focusId] : undefined;
    if (!el || !pos || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: pos.x + NW / 2 - el.clientWidth / 2 });
  }, [focusId, layout]);

  // The palette has TRACK_COLORS track colours (--t-0 …); further tracks reuse them in order.
  const colorOf = (trackKey: string) => `var(--t-${(trackIdx.get(trackKey) ?? 0) % TRACK_COLORS})`;
  const titles = useMemo(() => new Map(nodes.map((n) => [n.id, wrapTitle(n.title)])), [nodes]);
  const stateOf = (id: string): NodeState => {
    const s = statusOf(progress, id);
    return s === "none" ? (ready.has(id) ? "ready" : "locked") : s;
  };

  // The highlighted topic's whole prerequisite chain; edges into the chain draw in, edges out of it mark unlocks.
  const active = hovered ?? current?.id ?? null;
  const chain = new Set<string>();
  const stack = active ? [...(byId.get(active)?.prereqIds ?? [])] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (chain.has(id) || !byId.has(id)) continue;
    chain.add(id);
    stack.push(...byId.get(id)!.prereqIds);
  }

  const geometry = useMemo(
    () =>
      nodes.flatMap((n) =>
        n.prereqIds.flatMap((p) => {
          const a = layout.positions[p];
          const b = layout.positions[n.id];
          if (!a || !b) return [];
          const x1 = a.x + NW / 2;
          const y1 = a.y + NH;
          const x2 = b.x + NW / 2;
          // The line stops short of the node so the arrowhead's tip lands on its top edge.
          const y2 = b.y - 7;
          const dy = Math.max(20, (y2 - y1) / 2);
          return [
            {
              key: `${p}-${n.id}`,
              from: p,
              to: n.id,
              d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`,
              x2,
              y2,
            },
          ];
        }),
      ),
    [nodes, layout],
  );
  const edges = geometry.map((e) => {
    const kind: keyof typeof EDGE_COLOR =
      e.to === active || chain.has(e.to) ? "chain" : e.from === active ? "unlock" : progress[e.from] === "done" ? "met" : "base";
    return { ...e, kind };
  });
  const unlocks = new Set(edges.filter((e) => e.kind === "unlock").map((e) => e.to));
  // Highlighted edges paint last so they cross over the rest.
  const lit = (e: (typeof edges)[number]) => e.kind === "chain" || e.kind === "unlock";
  const ordered = [...edges.filter((e) => !lit(e)), ...edges.filter(lit)];

  const topicUrl = (slug: string, read: boolean) => `${pathname}?topic=${encodeURIComponent(slug)}${read ? "&read=1" : ""}`;
  const wide = () => window.matchMedia("(min-width: 1024px)").matches;

  // The native history API updates useSearchParams without refetching the page from the server.
  function select(slug: string) {
    setError(null);
    window.history.replaceState(null, "", topicUrl(slug, reading));
    if (!reading) panelRef.current?.focus({ preventScroll: wide() });
  }

  function openReader(slug: string) {
    setError(null);
    // Read the live URL, not `reading`: a fast double tap fires twice before the next render.
    if (new URLSearchParams(window.location.search).get("read") === "1") {
      window.history.replaceState(null, "", topicUrl(slug, true));
      return;
    }
    window.history.pushState(null, "", topicUrl(slug, true));
    pushedReader.current = true;
  }

  function closeReader() {
    const slug = current?.slug;
    if (!slug) return;
    if (!pushedReader.current) {
      window.history.replaceState(null, "", topicUrl(slug, false));
      return;
    }
    pushedReader.current = false;
    // Step back over the reader's entry, then keep the topic the reader ended on selected.
    window.addEventListener("popstate", () => window.history.replaceState(null, "", topicUrl(slug, false)), { once: true });
    window.history.back();
  }

  // The side panel sits beside the graph on wide screens; on narrow ones it is far below, so open the reader.
  function pick(slug: string) {
    if (wide()) select(slug);
    else openReader(slug);
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

  const relatedTopic = (n: (typeof nodes)[number]) => ({ slug: n.slug, title: n.title, state: stateOf(n.id), color: colorOf(n.trackKey) });
  // Everything the side panel and the full-screen reader share.
  const topicProps: Omit<TopicPanelProps, "topicHref" | "variant" | "action"> | null = current && {
    node: { ...current, trackName: trackName.get(current.trackKey) ?? "", trackColor: colorOf(current.trackKey) },
    status: statusOf(progress, current.id),
    onStatus: (s) => changeStatus(current.id, s),
    pending,
    error,
    related: {
      questions: current.related.questions,
      notes: current.related.notes,
      prereqs: current.prereqIds.flatMap((id) => {
        const p = byId.get(id);
        return p ? [relatedTopic(p)] : [];
      }),
      unlocks: (children.get(current.id) ?? []).flatMap((id) => {
        const n = byId.get(id);
        return n ? [relatedTopic(n)] : [];
      }),
    },
  };
  const readIdx = current ? order.findIndex((n) => n.id === current.id) : -1;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">{graph.title}</h1>
          {graph.subtitle && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{graph.subtitle}</p>}
        </div>
        <div className="w-full sm:w-72">
          <p className="flex justify-between text-sm tabular-nums">
            <span>
              <span className="font-semibold">{done}</span>
              <span className="text-muted-foreground"> of {nodes.length} done</span>
            </span>
            <span className="text-muted-foreground">{learning} learning</span>
          </p>
          <ProgressBar value={done} secondary={learning} max={nodes.length} className="mt-2 h-2" />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {graph.tracks.length > 0 && (
          <div role="group" aria-label="Highlight a track" className="flex flex-wrap gap-2">
            <Chip on={focus === null} onClick={() => setFocus(null)}>
              All tracks
            </Chip>
            {graph.tracks.map((t) => (
              <Chip key={t.key} on={focus === t.key} onClick={() => setFocus(focus === t.key ? null : t.key)}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: colorOf(t.key) }} />
                  {t.name}
                </span>
              </Chip>
            ))}
          </div>
        )}
        {upNext.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Up next</span>
            {upNext.slice(0, 3).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => pick(n.slug)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:py-2"
              >
                <StatusGlyph state="ready" color={colorOf(n.trackKey)} />
                {n.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          <div ref={canvasRef} className="overflow-auto">
            <svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="group"
              aria-label="Prerequisite graph"
              // Wider than the graph, the SVG centres it at its natural size, and the bands reach the canvas edges.
              preserveAspectRatio="xMidYMin meet"
              className="block min-w-full"
            >
              {layout.bands.map((b, i) => (
                <g key={b.tier}>
                  <rect
                    x={-2000}
                    y={b.y}
                    width={layout.width + 4000}
                    height={b.height}
                    fill={i % 2 ? "transparent" : "color-mix(in oklch, var(--muted) 45%, transparent)"}
                  />
                  <text
                    x={LBL / 2 + 6}
                    y={b.y + b.height / 2 + 4}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-[0.08em]"
                  >
                    Step {b.tier + 1}
                  </text>
                </g>
              ))}

              {ordered.map((e) => {
                const color = EDGE_COLOR[e.kind];
                const chained = e.kind === "chain";
                return (
                  // Keyed by the highlighted topic too, so the chain redraws each time the highlight moves.
                  <g key={chained ? `${e.key}@${active}` : e.key}>
                    <path
                      d={e.d}
                      fill="none"
                      stroke={color}
                      strokeWidth={chained ? 2 : 1.5}
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={e.kind === "unlock" ? "0.02 0.025" : "1"}
                      className={cn(chained && "edge-draw")}
                    />
                    <path d={`M${e.x2 - 4.5},${e.y2} L${e.x2 + 4.5},${e.y2} L${e.x2},${e.y2 + 6.5} Z`} fill={color} />
                  </g>
                );
              })}

              {nodes.map((n) => {
                const pos = layout.positions[n.id];
                const state = stateOf(n.id);
                const color = colorOf(n.trackKey);
                const isSel = n.slug === selected;
                const related = n.id === active || chain.has(n.id) || unlocks.has(n.id);
                const opacity = focus !== null && focus !== n.trackKey ? 0.25 : hovered && !related ? 0.4 : 1;
                const { lines, cut } = titles.get(n.id)!;
                const label = [n.title, trackName.get(n.trackKey), STATE_LABEL[state].toLowerCase()].filter(Boolean).join(", ");
                const fill =
                  state === "done"
                    ? `color-mix(in oklch, ${color} 18%, var(--card))`
                    : state === "learning"
                      ? `color-mix(in oklch, ${color} 8%, var(--card))`
                      : "var(--card)";
                const stroke = state === "locked" ? `color-mix(in oklch, ${color} 30%, var(--border))` : color;
                return (
                  // Positioned by the outer group, so the button's press scale (globals.css) centres on the node.
                  <g key={n.id} transform={`translate(${pos.x},${pos.y})`}>
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      aria-pressed={isSel}
                      onClick={() => pick(n.slug)}
                      onDoubleClick={() => openReader(n.slug)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          pick(n.slug);
                        }
                      }}
                      // A touch tap fires pointerenter too; only a real hover previews, or every tap would dim the graph.
                      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(n.id)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHovered(n.id)}
                      onBlur={() => setHovered(null)}
                      // select-none: double-click opens the reader and must not also highlight a word of the title.
                      className="graph-node cursor-pointer outline-none select-none"
                      style={{ opacity }}
                    >
                      {cut && <title>{n.title}</title>}
                      <rect
                        className="node-ring"
                        x={-4}
                        y={-4}
                        width={NW + 8}
                        height={NH + 8}
                        rx={13}
                        fill="none"
                        stroke={isSel ? "var(--foreground)" : "var(--ring)"}
                        strokeWidth={2}
                        opacity={isSel ? 1 : 0}
                      />
                      <g className="node-lift">
                        <rect className="node-body" width={NW} height={NH} rx={9} fill={fill} stroke={stroke} strokeWidth={1.5} />
                        <text className={cn("text-[13px] font-medium", state === "locked" ? "fill-muted-foreground" : "fill-foreground")}>
                          {lines.map((l, i) => (
                            <tspan key={i} x={14} y={NH / 2 + 4.5 + (i - (lines.length - 1) / 2) * 15}>
                              {l}
                            </tspan>
                          ))}
                        </text>
                        <g transform={`translate(${NW - 20},${NH / 2})`}>
                          <StatusIcon state={state} color={color} />
                        </g>
                      </g>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            {(["locked", "ready", "learning", "done"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <StatusGlyph state={s} />
                {STATE_LABEL[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <svg width={18} height={14} viewBox="0 0 18 14" aria-hidden>
                <path d="M2,7 H11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                <path d="M11,3 L16,7 L11,11 Z" fill="currentColor" />
              </svg>
              Arrows point to what a topic unlocks
            </span>
          </div>
        </div>

        <div
          ref={panelRef}
          tabIndex={-1}
          aria-label="Topic details"
          className="rounded-xl border border-border bg-card p-5 outline-none lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-auto"
        >
          {topicProps ? (
            <TopicPanel
              {...topicProps}
              topicHref={(slug) => topicUrl(slug, false)}
              action={
                <Button variant="ghost" size="icon-sm" aria-label="Open full screen" title="Open full screen" onClick={() => openReader(topicProps.node.slug)}>
                  <Maximize2 aria-hidden />
                </Button>
              }
            />
          ) : (
            <div className="grid justify-items-start gap-2">
              <h2 className="font-semibold">No topic selected</h2>
              <p className="text-sm text-muted-foreground">Pick a topic in the graph to see its summary, an example, and the questions that test it.</p>
              {upNext[0] && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => pick(upNext[0].slug)}>
                  Start with {upNext[0].title}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {topicProps && current && (
        <TopicReader
          open={reading}
          onClose={closeReader}
          onPrev={readIdx > 0 ? () => select(order[readIdx - 1].slug) : undefined}
          onNext={readIdx < order.length - 1 ? () => select(order[readIdx + 1].slug) : undefined}
          context={`${graph.title} · Step ${(layout.positions[current.id]?.tier ?? 0) + 1} · ${readIdx + 1} of ${order.length}`}
          topicKey={current.slug}
          labelledBy={`reader-topic-${current.slug}`}
        >
          {/* Mounted only while open: no hidden second copy of the topic for assistive tech to find. */}
          {reading && <TopicPanel {...topicProps} variant="full" topicHref={(slug) => topicUrl(slug, true)} />}
        </TopicReader>
      )}
    </div>
  );
}
