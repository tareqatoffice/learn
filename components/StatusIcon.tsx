/** What a topic shows: its saved status, with "not started" split by whether its prerequisites are done. */
export type NodeState = "locked" | "ready" | "learning" | "done";

export const STATE_LABEL: Record<NodeState, string> = {
  locked: "Needs prerequisites",
  ready: "Ready to start",
  learning: "Learning",
  done: "Done",
};

/** A 16px status glyph centred on the origin, for use inside an SVG; `color` is the topic's track colour. */
export function StatusIcon({ state, color }: { state: NodeState; color: string }) {
  if (state === "done")
    return (
      <g>
        <circle r={8} fill="var(--ok)" />
        <path d="M-3.6,0.2 L-1.1,2.7 L3.8,-2.6" fill="none" stroke="var(--card)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  if (state === "learning")
    return (
      <g>
        <circle r={7} fill="none" stroke={color} strokeWidth={1.6} />
        <path d="M0,-4.4 A4.4,4.4 0 0 1 0,4.4 Z" fill={color} />
      </g>
    );
  if (state === "ready")
    return (
      <g>
        <circle r={7} fill="none" stroke={color} strokeWidth={1.6} />
        <path d="M-1.5,-3 L3,0 L-1.5,3 Z" fill={color} />
      </g>
    );
  return (
    <g fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} strokeLinecap="round">
      <rect x={-4.5} y={-1} width={9} height={7} rx={1.6} />
      <path d="M-2.6,-1 V-3 A2.6,2.6 0 0 1 2.6,-3 V-1" />
    </g>
  );
}

/** StatusIcon as a standalone inline icon, for HTML text. */
export function StatusGlyph({ state, color = "var(--muted-foreground)", size = 14 }: { state: NodeState; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden className="shrink-0">
      <StatusIcon state={state} color={color} />
    </svg>
  );
}
