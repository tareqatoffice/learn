/**
 * One-time import of the legacy repo content (interview books, learning graphs, note series) into
 * the database. Verifies the imported counts against the known legacy totals, so it can be trusted
 * before the legacy files are deleted.
 *
 *   npm run import:legacy -- --dry-run
 *   npm run import:legacy
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { runImport } from "@/content/import/run";
import type { ImportReport, ImportSource, ImportTarget } from "@/content/types";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Subject } from "@/models";
import { BOOKS, EXPECTED_COUNTS, GRAPHS, SERIES, SUBJECTS, type ExpectedCounts } from "./legacy-map";

type Kind = "book" | "graph" | "series";
export type LegacyRow = { kind: Kind; slug: string; expected: number; actual: number; creates: number; updates: number };
export type LegacyResult = { ok: boolean; message?: string; rows: LegacyRow[]; warnings?: string[] };

const EDITED_BY = "legacy-import";
const REFUSAL = "database has content not created by the legacy import";
const CONTENT_MODELS = [Subject, QuestionBook, Question, Graph, GraphNode, NoteSeries, Note];
const KIND_KEY = { book: "books", graph: "graphs", series: "series" } as const;

type Job = {
  kind: Kind;
  slug: string;
  load: (repoRoot: string) => Promise<{ source: ImportSource; title?: string; description?: string }>;
  subjects: string[];
  title?: string;
  /** Number of items of the container in the DB. */
  count: () => Promise<number>;
};

const read = (repoRoot: string, rel: string) => readFile(path.join(repoRoot, rel), "utf8");

async function loadSeries(repoRoot: string, s: (typeof SERIES)[number]) {
  const dir = path.join(repoRoot, s.dir);
  const names = (await readdir(dir)).filter((n) => /\.md$/i.test(n) && !(s.exclude ?? []).includes(n)).sort();
  const files = await Promise.all(names.map(async (name) => ({ name, content: await readFile(path.join(dir, name), "utf8") })));
  return { source: { kind: "series", files } as ImportSource, description: (await read(repoRoot, s.description)).trim() };
}

async function loadGraph(repoRoot: string, slug: string) {
  const file = path.join(repoRoot, "learning-graph", "_src", "data", `${slug}.mjs`);
  const json = (await import(/* @vite-ignore */ pathToFileURL(file).href)).default as { title?: string };
  return { source: { kind: "graph", json } as ImportSource, title: json?.title };
}

/** Every legacy container, in import order, with how to read its source and count its items. */
function jobs(): Job[] {
  const countIn = async (container: typeof QuestionBook, slug: string, items: typeof Question, field: string) => {
    const doc = await container.findOne({ slug }).select("_id").lean<{ _id: unknown } | null>();
    return doc ? items.countDocuments({ [field]: doc._id }) : 0;
  };
  return [
    ...BOOKS.map((b): Job => ({
      kind: "book",
      slug: b.slug,
      subjects: b.subjects,
      title: b.title,
      load: async (root) => ({ source: { kind: "book", markdown: await read(root, `interview-topics/${b.slug}.md`) } }),
      count: () => countIn(QuestionBook, b.slug, Question, "bookId"),
    })),
    ...GRAPHS.map((g): Job => ({
      kind: "graph",
      slug: g.slug,
      subjects: g.subjects,
      load: (root) => loadGraph(root, g.slug),
      count: () => countIn(Graph as typeof QuestionBook, g.slug, GraphNode as typeof Question, "graphId"),
    })),
    ...SERIES.map((s): Job => ({
      kind: "series",
      slug: s.slug,
      subjects: s.subjects,
      title: s.title,
      load: (root) => loadSeries(root, s),
      count: () => countIn(NoteSeries as typeof QuestionBook, s.slug, Note as typeof Question, "seriesId"),
    })),
  ];
}

async function hasForeignContent(): Promise<boolean> {
  const counts = await Promise.all(CONTENT_MODELS.map((m) => m.countDocuments({ importedAt: null })));
  return counts.some((n) => n > 0);
}

async function seedSubjects(importedAt: Date): Promise<void> {
  await Subject.bulkWrite(
    SUBJECTS.map((s, i) => ({
      updateOne: {
        filter: { slug: s.slug },
        update: { $set: { name: s.name, order: i + 1 }, $setOnInsert: { importedAt } },
        upsert: true,
      },
    })),
  );
}

/**
 * Imports every legacy container (all published, `editedBy: 'legacy-import'`, one shared `importedAt`),
 * then compares the number of items in the DB (or, on a dry run, in the plan) with `expected`.
 * `ok` is false on any import error, count mismatch, or if the DB holds content this import did not create.
 */
export async function importLegacy(opts: { repoRoot: string; dryRun: boolean; expected?: ExpectedCounts }): Promise<LegacyResult> {
  const expected = opts.expected ?? EXPECTED_COUNTS;
  const all = jobs();

  const known = new Set(all.map((j) => `${j.kind}:${j.slug}`));
  const unknown = (Object.keys(KIND_KEY) as Kind[]).flatMap((kind) =>
    Object.keys(expected[KIND_KEY[kind]]).filter((slug) => !known.has(`${kind}:${slug}`)).map((slug) => `${kind} ${slug}`),
  );
  if (unknown.length) return { ok: false, message: `no legacy mapping for: ${unknown.join(", ")}`, rows: [] };

  if (await hasForeignContent()) return { ok: false, message: REFUSAL, rows: [] };

  const importedAt = new Date();
  if (!opts.dryRun) await seedSubjects(importedAt);

  const rows: LegacyRow[] = [];
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const job of all) {
    const want = expected[KIND_KEY[job.kind]][job.slug];
    if (want === undefined) continue;
    const row: LegacyRow = { kind: job.kind, slug: job.slug, expected: want, actual: 0, creates: 0, updates: 0 };
    rows.push(row);
    const label = `${job.kind} ${job.slug}`;
    try {
      const { source, title, description } = await job.load(opts.repoRoot);
      const target: ImportTarget = { kind: job.kind, slug: job.slug };
      const report: ImportReport = await runImport({
        target,
        source,
        dryRun: opts.dryRun,
        publish: true,
        editedBy: EDITED_BY,
        title: job.title ?? title,
        subjects: job.subjects,
        description,
        importedAt,
      });
      // On a failed commit the counts still describe the plan, so errors always mean failure.
      if (report.errors.length) problems.push(`${label}: ${report.errors.join("; ")}`);
      warnings.push(...report.warnings.map((w) => `${label}: ${w}`));
      row.creates = report.creates;
      row.updates = report.updates;
      row.actual = opts.dryRun ? report.creates + report.updates + report.unchanged : await job.count();
    } catch (error) {
      problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (row.actual !== row.expected) problems.push(`${label}: expected ${row.expected}, got ${row.actual}`);
  }

  return { ok: problems.length === 0, ...(problems.length ? { message: problems.join("\n") } : {}), rows, warnings };
}

/** `kind slug expected actual OK/MISMATCH` per row, then the totals. */
export function formatRows(rows: LegacyRow[]): string {
  const width = Math.max(4, ...rows.map((r) => r.slug.length));
  const line = (cells: (string | number)[]) =>
    `${String(cells[0]).padEnd(7)}${String(cells[1]).padEnd(width + 2)}${String(cells[2]).padStart(8)}${String(cells[3]).padStart(7)}  ${String(cells[4]).padEnd(9)}${String(cells[5]).padStart(8)}${String(cells[6]).padStart(8)}`;
  const out = [line(["kind", "slug", "expected", "actual", "status", "creates", "updates"])];
  for (const r of rows) out.push(line([r.kind, r.slug, r.expected, r.actual, r.expected === r.actual ? "OK" : "MISMATCH", r.creates, r.updates]));
  for (const kind of ["book", "graph", "series"] as const) {
    const of = rows.filter((r) => r.kind === kind);
    if (!of.length) continue;
    const sum = (f: (r: LegacyRow) => number) => of.reduce((n, r) => n + f(r), 0);
    out.push(line([kind, "TOTAL", sum((r) => r.expected), sum((r) => r.actual), "", sum((r) => r.creates), sum((r) => r.updates)]));
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const webRoot = fileURLToPath(new URL("..", import.meta.url));
  const envFile = path.join(webRoot, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const dryRun = process.argv.includes("--dry-run");
  await connectDb();
  try {
    const result = await importLegacy({ repoRoot: path.resolve(webRoot, ".."), dryRun });
    console.log(`${dryRun ? "DRY RUN" : "IMPORT"}\n${formatRows(result.rows)}`);
    for (const w of result.warnings ?? []) console.warn(`warning: ${w}`);
    console.log(result.ok ? "\nOK" : `\nFAILED: ${result.message}`);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
