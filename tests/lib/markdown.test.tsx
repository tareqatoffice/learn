// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/lib/markdown/Markdown";

function html(source: string, inline = false) {
  const { container } = render(<Markdown source={source} inline={inline} />);
  return container;
}

describe("Markdown", () => {
  it("renders GFM tables", () => {
    const c = html("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(c.querySelector("table")).not.toBeNull();
  });

  it("highlights fenced code", () => {
    const c = html("```js\nconst a = 1;\n```");
    expect(c.querySelector("code.hljs")).not.toBeNull();
    expect(c.querySelector(".hljs-keyword")).not.toBeNull();
  });

  it("keeps details/summary", () => {
    const c = html("<details><summary>Answer</summary>x</details>");
    expect(c.querySelector("details > summary")?.textContent).toBe("Answer");
  });

  it("keeps kbd", () => {
    expect(html("press <kbd>G</kbd>").querySelector("kbd")).not.toBeNull();
  });

  it("neutralises script, on* handlers and javascript: links", () => {
    const c = html(
      "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
    );
    expect(c.querySelector("script")).toBeNull();
    expect(c.innerHTML).not.toContain("onerror");
    expect(c.innerHTML.toLowerCase()).not.toContain("javascript:");
  });

  it("strips javascript: from raw anchors too", () => {
    const c = html('<a href="javascript:alert(1)">x</a>');
    expect(c.innerHTML.toLowerCase()).not.toContain("javascript:");
  });

  it("gives headings unprefixed ids", () => {
    const c = html("## A b");
    expect(c.querySelector("h2")?.id).toBe("a-b");
  });

  it("renders Bangla text unchanged", () => {
    expect(html("বাংলায়").textContent).toContain("বাংলায়");
  });

  it("inline mode renders without block wrapper", () => {
    const c = html("**hi**", true);
    expect(c.querySelector("p")).toBeNull();
    expect(c.querySelector("strong")?.textContent).toBe("hi");
  });

  it("insideLink keeps link text but never renders a nested <a>", () => {
    const { container } = render(<Markdown source="Type www.example.com or [docs](https://example.com) **now**" inline insideLink />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("Type www.example.com or docs now");
    expect(container.querySelector("strong")?.textContent).toBe("now");
  });
});
