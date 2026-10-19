import { describe, expect, it } from "vitest";
import { extractToc, readMinutes } from "@/lib/markdown/toc";

describe("extractToc", () => {
  it("returns h2/h3 headings and ignores fenced code", () => {
    expect(extractToc("## A b\n```\n## not\n```\n### C")).toEqual([
      { depth: 2, text: "A b", anchor: "a-b" },
      { depth: 3, text: "C", anchor: "c" },
    ]);
  });

  it("de-duplicates repeated headings like rehype-slug", () => {
    const toc = extractToc("## Same\n## Same");
    expect(toc.map((t) => t.anchor)).toEqual(["same", "same-1"]);
  });
});

describe("readMinutes", () => {
  it("rounds up at 200 words per minute", () => {
    expect(readMinutes(Array(401).fill("w").join(" "))).toBe(3);
  });
  it("is at least 1", () => {
    expect(readMinutes("")).toBe(1);
  });
});
