import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { rehypePlugins, remarkPlugins } from "./pipeline";

export type TocEntry = { depth: 2 | 3; text: string; anchor: string };

// Same remark/rehype chain as <Markdown> (minus highlighting), so the ids come from rehype-slug itself.
const processor = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypePlugins as never);

/** h2/h3 headings with the exact ids <Markdown> renders and their plain text. */
export function extractToc(md: string): TocEntry[] {
  const tree = processor.runSync(processor.parse(md)) as Root;
  const out: TocEntry[] = [];
  visit(tree, "element", (node: Element) => {
    const depth = /^h([23])$/.exec(node.tagName)?.[1];
    const id = node.properties?.id;
    if (!depth || typeof id !== "string") return;
    out.push({ depth: Number(depth) as 2 | 3, text: toString(node).trim(), anchor: id });
  });
  return out;
}

export function readMinutes(md: string): number {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
