// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/lib/markdown/Markdown";
import { extractToc } from "@/lib/markdown/toc";

describe("extractToc parity with <Markdown>", () => {
  const doc = [
    "# Title",
    "## _it_ x",
    "## `code` _it_ [l](u) x",
    "## Foo <b>x</b>",
    "## Dup",
    "Setext Dup",
    "----------",
    "## Dup",
    "### Dup",
    "> ## Quoted",
    "",
    "<h2>Raw h2</h2>",
    "",
    "````",
    "```",
    "## not",
    "````",
    "### Tail ##",
  ].join("\n");

  it("matches every rendered h2/h3 id and text", () => {
    const { container } = render(<Markdown source={doc} />);
    const rendered = [...container.querySelectorAll("h2, h3")].map((h) => ({
      depth: Number(h.tagName[1]),
      text: h.textContent,
      anchor: h.id,
    }));
    const toc = extractToc(doc);
    expect(toc).toEqual(rendered);
    expect(toc.map((t) => t.anchor)).toEqual(expect.arrayContaining(["dup", "setext-dup", "dup-1", "dup-2", "quoted", "raw-h2", "tail"]));
    expect(toc.find((t) => t.anchor === "it-x")?.text).toBe("it x");
    expect(toc.some((t) => t.text === "not")).toBe(false);
  });
});
