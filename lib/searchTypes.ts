export type SearchHit = {
  kind: "book" | "graph" | "series" | "question" | "topic" | "chapter";
  title: string;
  context: string;
  href: string;
};
