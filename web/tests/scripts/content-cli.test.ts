import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../scripts/content";

describe("parseCliArgs", () => {
  it("parses a committing push to a book", () => {
    expect(parseCliArgs(["push", "a.md", "--book", "react", "--commit"])).toEqual({
      cmd: "push",
      files: ["a.md"],
      target: { kind: "book", slug: "react" },
      dryRun: false,
      publish: false,
    });
  });

  it("defaults a push to a dry run and takes several files, a title and publish", () => {
    expect(parseCliArgs(["push", "01-a.md", "02-b.md", "--series", "docker", "--title", "Docker notes", "--publish"])).toEqual({
      cmd: "push",
      files: ["01-a.md", "02-b.md"],
      target: { kind: "series", slug: "docker" },
      dryRun: true,
      publish: true,
      title: "Docker notes",
    });
  });

  it("parses list and pull", () => {
    expect(parseCliArgs(["list"])).toEqual({ cmd: "list" });
    expect(parseCliArgs(["pull", "graph", "javascript", "--out", "tmp"])).toEqual({ cmd: "pull", kind: "graph", slug: "javascript", out: "tmp" });
    expect(parseCliArgs(["pull", "book", "react"])).toEqual({ cmd: "pull", kind: "book", slug: "react", out: "." });
  });

  it("throws a usage error for a push without a target", () => {
    expect(() => parseCliArgs(["push", "a.md"])).toThrow(/usage/i);
  });

  it("throws a usage error for unknown commands, kinds and missing files", () => {
    expect(() => parseCliArgs([])).toThrow(/usage/i);
    expect(() => parseCliArgs(["delete", "x"])).toThrow(/usage/i);
    expect(() => parseCliArgs(["pull", "user", "x"])).toThrow(/usage/i);
    expect(() => parseCliArgs(["push", "--book", "react"])).toThrow(/usage/i);
  });
});
