// Builds one learning-graph page per data file.
// Usage: node build.mjs            (all data files)
//        node build.mjs go python  (only these slugs)
// Writes ../<out>.html (standalone, opens from disk) and dist/<slug>.html (no skeleton, for Artifact publish).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "template.html"), "utf8");
const skeletonHead = readFileSync(join(here, "skeleton-head.html"), "utf8").trimEnd();
const MAX_TRACKS = 6, MAX_TITLE = 22;

function validate(slug, cfg) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };
  for (const f of ["out", "title", "sub", "foot", "key"]) need(typeof cfg[f] === "string" && cfg[f].trim(), `config.${f} missing`);
  need(Array.isArray(cfg.tracks) && cfg.tracks.length >= 2 && cfg.tracks.length <= MAX_TRACKS, `tracks: need 2..${MAX_TRACKS}`);
  const trackKeys = new Set((cfg.tracks || []).map((t) => t.k));
  const ids = new Set();
  for (const n of cfg.nodes || []) {
    const at = `node ${n.id || "?"}`;
    need(/^[a-z0-9-]+$/.test(n.id || ""), `${at}: id must be lowercase kebab`);
    need(!ids.has(n.id), `${at}: duplicate id`); ids.add(n.id);
    need(trackKeys.has(n.tr), `${at}: unknown track ${n.tr}`);
    need(typeof n.t === "string" && n.t.length <= MAX_TITLE, `${at}: title missing or over ${MAX_TITLE} chars ("${n.t}")`);
    need(Array.isArray(n.pre), `${at}: pre must be an array`);
    for (const f of ["s", "c", "pit"]) need(typeof n[f] === "string" && n[f].trim(), `${at}: ${f} missing`);
    need(Array.isArray(n.p) && n.p.length >= 2, `${at}: p needs 2+ points`);
    need(/^https:\/\/[^\s]+$/.test(n.u || ""), `${at}: u must be an absolute https URL`);
  }
  for (const n of cfg.nodes || []) for (const p of n.pre || []) need(ids.has(p), `node ${n.id}: unknown prerequisite ${p}`);
  need((cfg.nodes || []).length >= 20, "need at least 20 nodes");
  for (const t of cfg.tracks || []) need(cfg.nodes.some((n) => n.tr === t.k), `track ${t.k} has no nodes`);
  // cycle check
  const byId = Object.fromEntries((cfg.nodes || []).map((n) => [n.id, n]));
  const state = {};
  const visit = (id, path) => {
    if (state[id] === 2 || !byId[id]) return;
    if (state[id] === 1) { errs.push(`cycle: ${[...path, id].join(" -> ")}`); return; }
    state[id] = 1; byId[id].pre.forEach((p) => visit(p, [...path, id])); state[id] = 2;
  };
  Object.keys(byId).forEach((id) => visit(id, []));
  if (errs.length) throw new Error(`${slug}:\n  - ${errs.join("\n  - ")}`);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wanted = process.argv.slice(2);
const files = readdirSync(join(here, "data")).filter((f) => f.endsWith(".mjs"));
mkdirSync(join(here, "dist"), { recursive: true });
let failed = 0;
for (const f of files) {
  const slug = f.replace(/\.mjs$/, "");
  if (wanted.length && !wanted.includes(slug)) continue;
  try {
    const cfg = (await import(pathToFileURL(join(here, "data", f)).href)).default;
    validate(slug, cfg);
    const data = "var CONFIG = " + JSON.stringify({ key: cfg.key, tracks: cfg.tracks, nodes: cfg.nodes }).replace(/<\//g, "<\\/") + ";";
    const page = template
      .replaceAll("{{TITLE}}", esc(cfg.title))
      .replace("{{SUB}}", esc(cfg.sub))
      .replace("{{FOOT}}", cfg.foot)
      .replace("/*__DATA__*/", () => data);
    writeFileSync(join(here, "dist", slug + ".html"), page);
    writeFileSync(join(here, "..", cfg.out + ".html"), skeletonHead + "\n" + page + "\n</body></html>\n");
    const tiers = {};
    const tier = (n) => tiers[n.id] ??= n.pre.length ? 1 + Math.max(...n.pre.map((p) => tier(cfg.nodes.find((x) => x.id === p)))) : 0;
    cfg.nodes.forEach(tier);
    console.log(`ok  ${slug}: ${cfg.nodes.length} topics, ${cfg.tracks.length} tracks, ${1 + Math.max(...Object.values(tiers))} steps -> ${cfg.out}.html`);
  } catch (e) { failed++; console.error("ERR " + e.message); }
}
process.exit(failed ? 1 : 0);
