/** One question parsed from a question book. `part` is the part's title ('' when there is none). */
export type ParsedQuestion = {
  id?: string;
  question: string;
  part: string;
  prompt: string;
  answer: string;
  importKey: string;
};

/**
 * A parsed question book. A part's `intro` is the prose inside the part that is not a question or
 * extra. `extras` are non-question sections (appendix, prep plan, …) kept as raw markdown.
 * `unaccounted` lists non-blank lines (1-based, with their text) that no parsing rule placed anywhere.
 */
export type ParsedBook = {
  id?: string;
  title?: string;
  intro: string;
  parts: { key: string; title: string; intro: string }[];
  extras: { key: string; title: string; body: string }[];
  questions: ParsedQuestion[];
  unaccounted: { line: number; heading: string }[];
};

/** One note chapter. `id` is present only when the markdown carries a learn:note marker. */
export type ParsedChapter = { id?: string; slug: string; title: string; body: string };

/** One learning-graph node (legacy fields: id=slug, tr=trackKey, t=title, pre=prereqSlugs, s, p, c, pit, u). */
export type ParsedNode = {
  id?: string;
  slug: string;
  trackKey: string;
  title: string;
  prereqSlugs: string[];
  summary: string;
  points: string[];
  code: string;
  pitfall: string;
  docsUrl: string;
};

export type ParsedGraph = {
  id?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  tracks: { key: string; name: string }[];
  nodes: ParsedNode[];
};
