// Prerequisite-graph layout, ported from learning-graph/_src/template.html.
// Topics sit in tiers (steps) by prerequisite depth; a tier with more than MAXC
// topics wraps onto balanced visual rows; rows are centred against the widest one.

export const NW = 176;
export const NH = 44;
const GX = 14;
const GY = 52;
const TG = 14;
const PAD = 16;
const LBL = 66;
const MAXC = 4;

type Prereqs = { id: string; prereqIds: string[] };
type LayoutNode = Prereqs & { trackKey: string };
export type Progress = Record<string, "learning" | "done">;

/** Tier 0 for topics without (known) prerequisites, else 1 + the deepest prerequisite's tier. */
export function computeTiers(nodes: Prereqs[]): Record<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const tiers: Record<string, number> = {};
  const visiting = new Set<string>();
  const tierOf = (n: Prereqs): number => {
    if (n.id in tiers) return tiers[n.id];
    if (visiting.has(n.id)) return 0; // a cycle never reaches the DB, but never recurse forever
    visiting.add(n.id);
    const pre = n.prereqIds.map((p) => byId.get(p)).filter((p): p is Prereqs => !!p);
    tiers[n.id] = pre.length ? 1 + Math.max(...pre.map(tierOf)) : 0;
    visiting.delete(n.id);
    return tiers[n.id];
  };
  nodes.forEach(tierOf);
  return tiers;
}

/** Topics not started yet whose (known) prerequisites are all done. */
export function readyNext(nodes: Prereqs[], progress: Progress): string[] {
  const known = new Set(nodes.map((n) => n.id));
  return nodes
    .filter((n) => !progress[n.id] && n.prereqIds.every((p) => !known.has(p) || progress[p] === "done"))
    .map((n) => n.id);
}

export function layoutGraph(
  nodes: LayoutNode[],
  tracks: { key: string }[],
): {
  width: number;
  height: number;
  positions: Record<string, { x: number; y: number; tier: number }>;
  rows: { tier: number; y: number; first: boolean }[];
} {
  const tiers = computeTiers(nodes);
  const trackIdx = new Map(tracks.map((t, i) => [t.key, i]));
  const rank = (n: LayoutNode) => trackIdx.get(n.trackKey) ?? tracks.length;

  const byTier: LayoutNode[][] = [];
  for (const n of nodes) (byTier[tiers[n.id]] ??= []).push(n);

  const vrows: { tier: number; items: LayoutNode[]; first: boolean }[] = [];
  byTier.forEach((row, tier) => {
    if (!row) return;
    const sorted = row.toSorted((a, b) => rank(a) - rank(b));
    const per = Math.ceil(sorted.length / Math.ceil(sorted.length / MAXC));
    for (let i = 0; i < sorted.length; i += per) vrows.push({ tier, items: sorted.slice(i, i + per), first: i === 0 });
  });

  const gap = (items: LayoutNode[], i: number) =>
    i ? GX + (items[i].trackKey !== items[i - 1].trackKey ? TG : 0) : 0;
  const rowW = vrows.map((v) => v.items.reduce((w, _n, i) => w + gap(v.items, i) + NW, 0));
  const maxW = Math.max(0, ...rowW);

  const positions: Record<string, { x: number; y: number; tier: number }> = {};
  const rows = vrows.map((v, ri) => {
    const y = PAD + ri * (NH + GY);
    let x = LBL + PAD + (maxW - rowW[ri]) / 2;
    v.items.forEach((n, i) => {
      x += gap(v.items, i);
      positions[n.id] = { x, y, tier: v.tier };
      x += NW;
    });
    return { tier: v.tier, y, first: v.first };
  });

  return {
    width: LBL + PAD * 2 + maxW,
    height: PAD * 2 + vrows.length * NH + Math.max(0, vrows.length - 1) * GY,
    positions,
    rows,
  };
}
