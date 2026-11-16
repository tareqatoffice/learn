export type ParsedQuestion = {
  id?: string;
  question: string;
  part: string;
  partKey?: string;
  prompt: string;
  answer: string;
  importKey: string;
};

export type ParsedBook = {
  id?: string;
  title?: string;
  intro: string;
  parts: { key: string; title: string; intro: string }[];
  extras: { key: string; title: string; body: string }[];
  questions: ParsedQuestion[];
  unaccounted: { line: number; heading: string }[];
};

export type ParsedChapter = { id?: string; slug: string; title: string; body: string };

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

export type ImportTarget = { kind: "book" | "series" | "graph"; slug: string };

export type ImportSource =
  | { kind: "book"; markdown: string }
  | { kind: "series"; files: { name: string; content: string }[] }
  | { kind: "graph"; json: unknown };

export type ItemChange = {
  action: "create" | "update" | "unchanged";
  type: "container" | "question" | "part" | "extra" | "note" | "node" | "track";
  key: string;
  title: string;
  id?: string;
  fields?: string[];
};

export type ImportReport = {
  target: ImportTarget;
  dryRun: boolean;
  createdTarget: boolean;
  creates: number;
  updates: number;
  unchanged: number;
  items: ItemChange[];
  warnings: string[];
  errors: string[];
};
