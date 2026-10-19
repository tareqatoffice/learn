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
 * A parsed question book. `extras` are non-question sections (appendix, prep plan, …) kept as raw
 * markdown; `unaccounted` lists heading lines (1-based) that no parsing rule placed anywhere.
 */
export type ParsedBook = {
  id?: string;
  title?: string;
  intro: string;
  parts: { key: string; title: string }[];
  extras: { key: string; title: string; body: string }[];
  questions: ParsedQuestion[];
  unaccounted: { line: number; heading: string }[];
};
