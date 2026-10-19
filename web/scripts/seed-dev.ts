/**
 * Loads a small published fixture set (2 books, 1 graph with related links, 1 note series) into the
 * local database through the real import pipeline, so pages can be checked before the legacy import.
 * Safe to re-run: existing items are matched by key and left unchanged. Refuses to run in production.
 *
 *   npm run seed:dev
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { runImport } from "@/content/import/run";
import type { ImportReport, ImportSource, ImportTarget } from "@/content/types";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";

const EDITED_BY = "seed-dev";

const JS_BOOK = `# JavaScript Basics

A short seed book for checking the question list and quiz.

# Part 1 — Fundamentals

Core language ideas.

## Q1. What is a closure?

A closure is a function that keeps access to the variables of the scope it was created in, even after that scope has returned.

\`\`\`js
function counter() {
  let n = 0;
  return () => ++n;
}
const next = counter();
next(); // 1
next(); // 2
\`\`\`

## Q2. What is the difference between \`let\` and \`var\`?

\`var\` is function-scoped and hoisted with the value \`undefined\`. \`let\` is block-scoped and unusable before its declaration (the temporal dead zone).

# Part 2 — Async

## Q3. How does the event loop order promises and timers?

Promise callbacks run as microtasks, right after the current task. \`setTimeout\` callbacks run as macrotasks in a later turn of the loop.
`;

const CSS_BOOK = `# CSS Puzzles

A second seed book, with a question that carries a code prompt.

# Part 1 — Layout

### Q1.
\`\`\`css
.box { margin: 0 auto; width: 50%; }
\`\`\`
**It is centred horizontally.** Auto margins split the free space on both sides of a block with a set width.

### Q2. When does \`z-index\` have an effect?

It applies to positioned elements (anything but \`static\`) and to flex or grid items, within their stacking context.
`;

const NOTE_FILES = [
  {
    name: "01-intro.md",
    content: `# Docker introduction

Why containers exist and what they give you.

## Images and containers

An image is a read-only template. A container is a running instance of one.

### Layers

Each Dockerfile instruction adds a layer, and unchanged layers are cached.

## Running a container

\`\`\`sh
docker run --rm -p 8080:80 nginx
\`\`\`
`,
  },
  {
    name: "02-networking.md",
    content: `# Docker networking

How containers talk to each other and to the host.

## Bridge networks

The default network. Containers on it get private addresses and reach each other by IP.

### User-defined bridges

These add DNS, so containers resolve each other by name.

## Published ports

\`-p host:container\` maps a host port to a container port.
`,
  },
  {
    name: "03-volumes.md",
    content: `# Docker volumes

Keeping data after a container is gone.

## Named volumes

Managed by Docker and the default choice for persistent data.

## Bind mounts

Map a host directory into the container, which suits local development.

### Permissions

The container user must be able to read and write the mounted path.
`,
  },
];

const node = (id: string, tr: string, t: string, pre: string[]) => ({
  id,
  tr,
  t,
  pre,
  s: `${t} in a few sentences.`,
  p: [`${t}: first key point.`, `${t}: second key point.`],
  c: `// ${id}\nconsole.log("${id}");`,
  pit: `A common mistake with ${t.toLowerCase()}.`,
  u: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
});

const GRAPH = {
  title: "JavaScript Seed Graph",
  sub: "Six topics across three tracks.",
  foot: "Seed data for local testing.",
  tracks: [
    { k: "lang", n: "Language" },
    { k: "async", n: "Async" },
    { k: "tools", n: "Tooling" },
  ],
  nodes: [
    node("variables", "lang", "Variables & scope", []),
    node("functions", "lang", "Functions", ["variables"]),
    node("closures", "lang", "Closures", ["functions"]),
    node("promises", "async", "Promises", ["functions"]),
    node("async-await", "async", "async / await", ["promises"]),
    node("modules", "tools", "Modules", ["variables"]),
  ],
};

type Job = { target: ImportTarget; source: ImportSource; title: string; description?: string };

const JOBS: Job[] = [
  { target: { kind: "book", slug: "seed-javascript" }, source: { kind: "book", markdown: JS_BOOK }, title: "JavaScript Basics" },
  { target: { kind: "book", slug: "seed-css" }, source: { kind: "book", markdown: CSS_BOOK }, title: "CSS Puzzles" },
  { target: { kind: "graph", slug: "seed-javascript-graph" }, source: { kind: "graph", json: GRAPH }, title: GRAPH.title },
  {
    target: { kind: "series", slug: "seed-docker" },
    source: { kind: "series", files: NOTE_FILES },
    title: "Docker Notes",
    description: "A three-chapter seed series.",
  },
];

/** Imports every job; stops at the first one with errors. The reports say what happened. */
export async function seedDev(): Promise<ImportReport[]> {
  if (process.env.NODE_ENV === "production") throw new Error("seed-dev refuses to run when NODE_ENV=production");
  await connectDb();

  const importedAt = new Date();
  const reports: ImportReport[] = [];
  for (const job of JOBS) {
    const report = await runImport({ ...job, dryRun: false, publish: true, editedBy: EDITED_BY, importedAt });
    reports.push(report);
    if (report.errors.length) return reports;
  }
  await linkRelated();
  return reports;
}

type Id = { _id: unknown };

/**
 * runImport cannot set a graph node's `related` links (they point at other collections), so they
 * are written directly: "Closures" -> two questions and a note section, "async / await" -> a question.
 */
async function linkRelated(): Promise<void> {
  const book = await QuestionBook.findOne({ slug: "seed-javascript" }).lean<Id | null>();
  const series = await NoteSeries.findOne({ slug: "seed-docker" }).lean<Id | null>();
  const graph = await Graph.findOne({ slug: "seed-javascript-graph" }).lean<Id | null>();
  if (!book || !series || !graph) throw new Error("seed content is missing after import");

  const questions = await Question.find({ bookId: book._id }).sort({ order: 1 }).lean<Id[]>();
  const note = await Note.findOne({ seriesId: series._id, slug: "intro" }).lean<(Id & { toc: { anchor: string }[] }) | null>();
  if (questions.length < 3 || !note?.toc.length) throw new Error("seed content is incomplete after import");

  const link = (slug: string, related: Record<string, unknown>) =>
    GraphNode.updateOne({ graphId: graph._id, slug }, { $set: { related } });
  await link("closures", {
    questionIds: [questions[0]._id, questions[1]._id],
    notes: [{ noteId: note._id, anchor: note.toc[0].anchor }],
  });
  await link("async-await", { questionIds: [questions[2]._id], notes: [] });
}

async function main(): Promise<void> {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const envFile = path.join(webRoot, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  try {
    const reports = await seedDev();
    for (const r of reports) {
      console.log(`${r.target.kind} ${r.target.slug}: ${r.creates} created, ${r.updates} updated, ${r.unchanged} unchanged`);
      for (const w of r.warnings) console.warn(`  warning: ${w}`);
      for (const e of r.errors) console.error(`  error: ${e}`);
    }
    if (reports.some((r) => r.errors.length)) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
