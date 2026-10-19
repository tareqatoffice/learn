/**
 * Content CLI over the token API, for adding content in bulk (e.g. from Claude Code).
 *
 *   npm run content -- list
 *   npm run content -- pull <book|series|graph> <slug> [--out <dir>]
 *   npm run content -- push <file...> (--book|--series|--graph) <slug> [--title <t>] [--commit] [--publish]
 *
 * Reads LEARN_API_URL and LEARN_API_TOKEN (from the environment or web/.env.local).
 * A push without --commit only previews.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Kind = "book" | "series" | "graph";
export type CliCommand =
  | { cmd: "list" }
  | { cmd: "pull"; kind: Kind; slug: string; out: string }
  | { cmd: "push"; files: string[]; target: { kind: Kind; slug: string }; dryRun: boolean; publish: boolean; title?: string };

const USAGE = `usage:
  npm run content -- list
  npm run content -- pull <book|series|graph> <slug> [--out <dir>]
  npm run content -- push <file...> (--book|--series|--graph) <slug> [--title <t>] [--commit] [--publish]`;

const KINDS: Kind[] = ["book", "series", "graph"];
const usage = (why: string) => new Error(`${why}\n${USAGE}`);

export function parseCliArgs(argv: string[]): CliCommand {
  const [cmd, ...rest] = argv;
  if (cmd === "list" && rest.length === 0) return { cmd: "list" };

  if (cmd === "pull") {
    const [kind, slug, ...flags] = rest;
    if (!KINDS.includes(kind as Kind) || !slug) throw usage("pull needs a kind and a slug");
    let out = ".";
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] === "--out" && flags[i + 1]) out = flags[++i];
      else throw usage(`unknown option ${flags[i]}`);
    }
    return { cmd: "pull", kind: kind as Kind, slug, out };
  }

  if (cmd === "push") {
    const files: string[] = [];
    let target: { kind: Kind; slug: string } | undefined;
    let title: string | undefined;
    let dryRun = true;
    let publish = false;
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      const kind = arg.startsWith("--") ? (arg.slice(2) as Kind) : undefined;
      if (kind && KINDS.includes(kind)) {
        if (!rest[i + 1] || rest[i + 1].startsWith("--")) throw usage(`${arg} needs a slug`);
        target = { kind, slug: rest[++i] };
      } else if (arg === "--title" && rest[i + 1]) title = rest[++i];
      else if (arg === "--commit") dryRun = false;
      else if (arg === "--publish") publish = true;
      else if (arg.startsWith("--")) throw usage(`unknown option ${arg}`);
      else files.push(arg);
    }
    if (!target) throw usage("push needs --book, --series or --graph <slug>");
    if (!files.length) throw usage("push needs at least one file");
    if (target.kind === "graph" && files.length > 1) throw usage("push --graph takes exactly one file (one JSON graph)");
    return { cmd: "push", files, target, dryRun, publish, ...(title ? { title } : {}) };
  }

  throw usage(cmd ? `unknown command ${cmd}` : "no command");
}

type Report = {
  dryRun: boolean;
  createdTarget: boolean;
  creates: number;
  updates: number;
  unchanged: number;
  items: { action: string; type: string; key: string; title: string; fields?: string[] }[];
  warnings: string[];
  errors: string[];
};

export function formatReport(report: Report): string {
  const lines = report.items
    .filter((i) => i.action !== "unchanged")
    .map((i) => `${i.action.padEnd(9)} ${i.type.padEnd(9)} ${i.key}${i.fields?.length ? `  [${i.fields.join(", ")}]` : ""}`);
  return [
    `${report.dryRun ? "PREVIEW (nothing written; add --commit to apply)" : "COMMITTED"}`,
    ...(report.createdTarget ? ["target will be created"] : []),
    ...lines,
    `creates ${report.creates} · updates ${report.updates} · unchanged ${report.unchanged}`,
    ...report.warnings.map((w) => `warning: ${w}`),
    ...report.errors.map((e) => `ERROR: ${e}`),
  ].join("\n");
}

async function api(pathname: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const base = process.env.LEARN_API_URL;
  const token = process.env.LEARN_API_TOKEN;
  if (!base || !token) throw new Error("Set LEARN_API_URL and LEARN_API_TOKEN (create a token in Admin → API tokens).");
  const res = await fetch(new URL(pathname, base), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep the raw text for the error message
  }
  return { status: res.status, body };
}

const fail = (status: number, body: unknown) =>
  new Error(`HTTP ${status}: ${typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : String(body)}`);

async function run(command: CliCommand): Promise<number> {
  if (command.cmd === "list") {
    const { status, body } = await api("/api/content");
    if (status !== 200) throw fail(status, body);
    const lists = body as Record<string, { slug: string; title: string; status: string }[]>;
    for (const kind of ["books", "series", "graphs"]) {
      console.log(`${kind}:`);
      for (const item of lists[kind] ?? []) console.log(`  ${item.slug.padEnd(32)} ${item.status.padEnd(10)} ${item.title}`);
    }
    return 0;
  }

  if (command.cmd === "pull") {
    const { status, body } = await api(`/api/content/pull?kind=${command.kind}&slug=${encodeURIComponent(command.slug)}`);
    if (status !== 200) throw fail(status, body);
    await mkdir(command.out, { recursive: true });
    const result = body as { fileName?: string; content?: string; json?: unknown; files?: { name: string; content: string }[] };
    const written: string[] = [];
    if (result.files) {
      for (const f of result.files) written.push(await save(command.out, f.name, f.content));
    } else if (result.json !== undefined && result.fileName) {
      written.push(await save(command.out, result.fileName, `${JSON.stringify(result.json, null, 2)}\n`));
    } else if (result.content !== undefined && result.fileName) {
      written.push(await save(command.out, result.fileName, result.content));
    }
    console.log(written.map((w) => `wrote ${w}`).join("\n"));
    return 0;
  }

  const { kind, slug } = command.target;
  const texts = await Promise.all(command.files.map((f) => readFile(f, "utf8")));
  const source =
    kind === "series"
      ? { kind, files: command.files.map((f, i) => ({ name: path.basename(f), content: texts[i] })) }
      : kind === "graph"
        ? { kind, json: JSON.parse(texts[0]) }
        : { kind, markdown: texts.join("\n\n") };
  const { status, body } = await api("/api/content/import", {
    method: "POST",
    body: JSON.stringify({ target: { kind, slug }, source, dryRun: command.dryRun, publish: command.publish, ...(command.title ? { title: command.title } : {}) }),
  });
  if (status !== 200 && status !== 400) throw fail(status, body);
  if (typeof body !== "object" || !body || !("items" in body)) throw fail(status, body);
  const report = body as Report;
  console.log(formatReport(report));
  return report.errors.length ? 1 : 0;
}

async function save(dir: string, name: string, content: string): Promise<string> {
  const file = path.join(dir, path.basename(name));
  await writeFile(file, content, "utf8");
  return file;
}

async function main(): Promise<void> {
  const webRoot = fileURLToPath(new URL("..", import.meta.url));
  const envFile = path.join(webRoot, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    process.exitCode = await run(parseCliArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) void main();
