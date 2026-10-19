import GithubSlugger from "github-slugger";

export type TocEntry = { depth: 2 | 3; text: string; anchor: string };

/** h2/h3 headings (fenced code ignored). Anchors match rehype-slug's ids. */
export function extractToc(md: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const out: TocEntry[] = [];
  let fence: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      const marker = f[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!m) continue;
    const text = m[2].trim();
    // Every heading advances the slugger so duplicates number the same as rehype-slug.
    const anchor = slugger.slug(text);
    const depth = m[1].length;
    if (depth === 2 || depth === 3) out.push({ depth, text, anchor });
  }
  return out;
}

export function readMinutes(md: string): number {
  const words = md.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
