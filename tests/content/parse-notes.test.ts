import { describe, expect, it } from "vitest";
import { parseChapter } from "@/content/parse/notes";

describe("parseChapter", () => {
  it("takes title from the first H1, body after it, slug from the file name", () => {
    expect(parseChapter("# Phase 3 — Networking\n\ntext", "03-networking.md")).toEqual({
      slug: "networking",
      title: "Phase 3 — Networking",
      body: "text",
    });
  });
  it("keeps a file name without a numeric prefix", () => {
    expect(parseChapter("# A\n\nb", "intro.md").slug).toBe("intro");
  });
  it("lets the canonical marker override id and slug", () => {
    const md = "<!-- learn:note id=abc123 slug=custom -->\n# Title\n\nbody\n\n## Sub\nmore";
    expect(parseChapter(md, "03-networking.md")).toEqual({
      id: "abc123",
      slug: "custom",
      title: "Title",
      body: "body\n\n## Sub\nmore",
    });
  });
  it("ignores a '# ' line inside a code fence when finding the title", () => {
    const md = "```sh\n# not a title\n```\n\n# Real\n\nbody";
    expect(parseChapter(md, "1-x.md")).toMatchObject({ title: "Real", body: "body" });
  });
  it("handles CRLF line endings", () => {
    expect(parseChapter("# T\r\n\r\ntext\r\n", "1-x.md")).toMatchObject({ title: "T", body: "text" });
  });
});
