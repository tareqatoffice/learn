/** What the one-time legacy importer imports, and the counts it must end up with. */

export type ExpectedCounts = {
  books: Record<string, number>;
  graphs: Record<string, number>;
  series: Record<string, number>;
};

/** Seeded in this order (`order` = position + 1). */
export const SUBJECTS: { slug: string; name: string }[] = [
  { slug: "html", name: "HTML" },
  { slug: "css", name: "CSS" },
  { slug: "javascript", name: "JavaScript" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "react", name: "React" },
  { slug: "nextjs", name: "Next.js" },
  { slug: "nodejs", name: "Node.js" },
  { slug: "nestjs", name: "NestJS" },
  { slug: "frontend", name: "Frontend" },
  { slug: "backend", name: "Backend" },
  { slug: "system-design", name: "System Design" },
  { slug: "database", name: "Database" },
  { slug: "go", name: "Go" },
  { slug: "python", name: "Python" },
  { slug: "csharp-dotnet", name: "C# / .NET" },
  { slug: "docker", name: "Docker" },
  { slug: "oop", name: "OOP" },
  { slug: "claude-code", name: "Claude Code" },
];

/** `interview-topics/<slug>.md` */
export const BOOKS: { slug: string; title: string; subjects: string[] }[] = [
  { slug: "css-questions-ebook", title: "CSS", subjects: ["css", "frontend"] },
  { slug: "frontend-interview-bl", title: "Frontend Interview", subjects: ["frontend", "react", "nextjs", "javascript"] },
  { slug: "frontend-system-design-ebook", title: "Frontend System Design", subjects: ["system-design", "frontend"] },
  { slug: "html-questions-ebook", title: "HTML", subjects: ["html", "frontend"] },
  { slug: "javascript-explained-ebook", title: "JavaScript", subjects: ["javascript"] },
  { slug: "nestjs-interview-guide", title: "NestJS", subjects: ["nestjs", "nodejs", "backend"] },
  { slug: "nextjs-questions-ebook", title: "Next.js", subjects: ["nextjs", "react", "frontend"] },
  { slug: "nodejs-questions-ebook", title: "Node.js", subjects: ["nodejs", "backend"] },
  { slug: "react-questions-ebook", title: "React", subjects: ["react", "frontend"] },
];

/** `learning-graph/_src/data/<slug>.mjs`; the title comes from the graph file. */
export const GRAPHS: { slug: string; subjects: string[] }[] = [
  { slug: "backend-engineering", subjects: ["backend"] },
  { slug: "csharp-aspnet", subjects: ["csharp-dotnet", "backend"] },
  { slug: "database", subjects: ["database"] },
  { slug: "frontend-engineering", subjects: ["frontend"] },
  { slug: "go", subjects: ["go"] },
  { slug: "javascript", subjects: ["javascript"] },
  { slug: "nodejs", subjects: ["nodejs", "backend"] },
  { slug: "python", subjects: ["python"] },
];

/** Every `*.md` in `dir` except `exclude`, in file-name order; `description` is a file whose text becomes the series description. */
export const SERIES: {
  slug: string;
  dir: string;
  exclude?: string[];
  description: string;
  title: string;
  subjects: string[];
}[] = [
  { slug: "docker", dir: "docker/notes", description: "docker/LEARNING_PLAN.md", title: "Docker", subjects: ["docker"] },
  {
    slug: "javascript",
    dir: "javascript/notes",
    description: "javascript/LEARNING_PLAN.md",
    title: "JavaScript & Node (backend)",
    subjects: ["javascript", "typescript", "nodejs", "backend"],
  },
  { slug: "oop", dir: "oop/notes", description: "oop/LEARNING_PLAN.md", title: "OOP", subjects: ["oop"] },
  { slug: "dotnet", dir: ".net/notes", description: ".net/LEARNING_PLAN.md", title: "C# / .NET", subjects: ["csharp-dotnet"] },
  { slug: "claude-code", dir: "claude", exclude: ["README.md"], description: "claude/README.md", title: "Claude Code", subjects: ["claude-code"] },
];

export const EXPECTED_COUNTS: ExpectedCounts = {
  books: {
    "css-questions-ebook": 61,
    "frontend-interview-bl": 183,
    "frontend-system-design-ebook": 70,
    "html-questions-ebook": 64,
    "javascript-explained-ebook": 72,
    "nestjs-interview-guide": 94,
    "nextjs-questions-ebook": 53,
    "nodejs-questions-ebook": 66,
    "react-questions-ebook": 66,
  },
  graphs: {
    "backend-engineering": 38,
    "csharp-aspnet": 38,
    database: 37,
    "frontend-engineering": 36,
    go: 37,
    javascript: 37,
    nodejs: 36,
    python: 38,
  },
  series: { docker: 10, javascript: 9, oop: 9, dotnet: 9, "claude-code": 6 },
};
