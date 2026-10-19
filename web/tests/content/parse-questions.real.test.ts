import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBook } from "@/content/parse/questions";

const dir = resolve(__dirname, "../../../interview-topics");

// Global Constraints: expected legacy counts per book (729 in total).
const EXPECTED: Record<string, number> = {
  "css-questions-ebook": 61,
  "frontend-interview-bl": 183,
  "frontend-system-design-ebook": 70,
  "html-questions-ebook": 64,
  "javascript-explained-ebook": 72,
  "nestjs-interview-guide": 94,
  "nextjs-questions-ebook": 53,
  "nodejs-questions-ebook": 66,
  "react-questions-ebook": 66,
};

describe.skipIf(!existsSync(dir))("parseBook on the real interview-topics books", () => {
  const parse = (slug: string) => parseBook(readFileSync(resolve(dir, `${slug}.md`), "utf8"), slug);

  for (const [slug, count] of Object.entries(EXPECTED)) {
    it(`${slug}: ${count} questions, no unaccounted headings`, () => {
      const book = parse(slug);
      expect(book.questions.length).toBe(count);
      expect(book.unaccounted).toEqual([]);
    });
  }

  it("parses 729 questions in total", () => {
    const total = Object.keys(EXPECTED).reduce((n, slug) => n + parse(slug).questions.length, 0);
    expect(total).toBe(729);
  });
});
