import { readFile } from "node:fs/promises";
import path from "node:path";
import { codingGroup } from "./groups";

export interface GroupSpecs {
  intro: string;
  questions: Record<string, string>;
}

const DOC_BLOCK = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\//;
const EXPORTED_DOC = new RegExp(`${DOC_BLOCK.source}\\s*export\\s+(?:async\\s+)?(?:function\\*?|class|const)\\s+(\\w+)`, "g");

const cleanDoc = (doc: string): string =>
  doc
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd())
    .join("\n")
    .trim();

const EMPTY: GroupSpecs = { intro: "", questions: {} };

const cache = new Map<string, Promise<GroupSpecs>>();

async function parseSpecs(slug: string): Promise<GroupSpecs> {
  for (const extension of [".ts", ".tsx"]) {
    const file = path.join(process.cwd(), "features", "coding", "problems", slug, `${slug}${extension}`);
    const source: string | null = await readFile(file, "utf8").catch(() => null);
    if (source === null) continue;
    const intro: string = cleanDoc(DOC_BLOCK.exec(source)?.[1] ?? "").replace(/^Group:.*\n*/, "");
    const questions: Record<string, string> = {};
    for (const [, doc, name] of source.matchAll(EXPORTED_DOC)) questions[name] = cleanDoc(doc);
    return { intro, questions };
  }
  return EMPTY;
}

export function readGroupSpecs(slug: string): Promise<GroupSpecs | null> {
  if (!codingGroup(slug)) return Promise.resolve(null);
  if (process.env.NODE_ENV !== "production") return parseSpecs(slug);
  let specs = cache.get(slug);
  if (!specs) cache.set(slug, (specs = parseSpecs(slug)));
  return specs;
}
