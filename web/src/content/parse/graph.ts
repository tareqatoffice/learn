import { findCycle } from "@/content/cycles";
import type { ParsedGraph, ParsedNode } from "@/content/types";
import { SLUG_PATTERN } from "@/lib/ids";

const MAX_TRACKS = 6;
const MAX_TITLE = 22;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const strings = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/** Per-node rules of the legacy `validate()` (build.mjs), reusable by the admin editor. */
export function validateNode(node: ParsedNode, trackKeys: string[]): string[] {
  const errs: string[] = [];
  const at = `node ${node.slug || "?"}`;
  if (!SLUG_PATTERN.test(node.slug || "")) errs.push(`${at}: id must be lowercase kebab`);
  if (!trackKeys.includes(node.trackKey)) errs.push(`${at}: unknown track ${node.trackKey}`);
  if (!node.title || node.title.length > MAX_TITLE) {
    errs.push(`${at}: title missing or over ${MAX_TITLE} chars ("${node.title}")`);
  }
  for (const [f, v] of [["s", node.summary], ["c", node.code], ["pit", node.pitfall]] as const) {
    if (!v || !v.trim()) errs.push(`${at}: ${f} missing`);
  }
  if (node.points.length < 2) errs.push(`${at}: p needs 2+ points`);
  if (!/^https:\/\/[^\s]+$/.test(node.docsUrl || "")) errs.push(`${at}: u must be an absolute https URL`);
  return errs;
}

/** Maps the legacy graph shape (`title, sub, foot, tracks[{k,n}], nodes[{id,tr,t,pre,s,p,c,pit,u}]`) and validates it. */
export function parseGraph(input: unknown): { graph: ParsedGraph; errors: string[] } {
  const cfg = rec(input);
  const errors: string[] = [];
  const rawTracks = Array.isArray(cfg.tracks) ? cfg.tracks.map(rec) : [];
  const tracks = rawTracks.map((t) => ({ key: str(t.k), name: str(t.n) }));
  if (tracks.length < 2 || tracks.length > MAX_TRACKS) errors.push(`tracks: need 2..${MAX_TRACKS}`);

  const nodes: ParsedNode[] = (Array.isArray(cfg.nodes) ? cfg.nodes : []).map((raw) => {
    const n = rec(raw);
    const slug = str(n.id);
    if (!Array.isArray(n.pre)) errors.push(`node ${slug || "?"}: pre must be an array`);
    return {
      ...(typeof n._id === "string" && n._id ? { id: n._id } : {}),
      slug,
      trackKey: str(n.tr),
      title: str(n.t),
      prereqSlugs: strings(n.pre),
      summary: str(n.s),
      points: strings(n.p),
      code: str(n.c),
      pitfall: str(n.pit),
      docsUrl: str(n.u),
    };
  });

  const trackKeys = tracks.map((t) => t.key);
  const seen = new Set<string>();
  for (const node of nodes) {
    errors.push(...validateNode(node, trackKeys));
    if (seen.has(node.slug)) errors.push(`node ${node.slug || "?"}: duplicate id`);
    seen.add(node.slug);
  }
  for (const node of nodes) {
    for (const p of node.prereqSlugs) if (!seen.has(p)) errors.push(`node ${node.slug}: unknown prerequisite ${p}`);
  }
  const cycle = findCycle(Object.fromEntries(nodes.map((n) => [n.slug, n.prereqSlugs])));
  if (cycle) errors.push(`cycle: ${cycle.join(" -> ")}`);

  const graph: ParsedGraph = {
    ...(typeof cfg._id === "string" && cfg._id ? { id: cfg._id } : {}),
    ...(typeof cfg.title === "string" ? { title: cfg.title } : {}),
    ...(typeof cfg.sub === "string" ? { subtitle: cfg.sub } : {}),
    ...(typeof cfg.foot === "string" ? { footer: cfg.foot } : {}),
    tracks,
    nodes,
  };
  return { graph, errors };
}
