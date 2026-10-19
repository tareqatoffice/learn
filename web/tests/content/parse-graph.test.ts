import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGraph, validateNode } from "@/content/parse/graph";

const node = (over: Record<string, unknown> = {}) => ({
  id: "a-node", tr: "t1", t: "A node", pre: [], s: "sum", p: ["one", "two"], c: "code", pit: "pit",
  u: "https://example.com/x", ...over,
});
const graph = (nodes: unknown[], tracks: unknown[] = [{ k: "t1", n: "One" }, { k: "t2", n: "Two" }]) => ({
  title: "G", sub: "S", foot: "F", tracks, nodes,
});

const path = resolve(process.cwd(), "../learning-graph/_src/data/javascript.mjs");
describe.skipIf(!existsSync(path))("parseGraph on the real javascript graph", () => {
  it("parses 37 nodes with no errors", async () => {
    const cfg = (await import(pathToFileURL(path).href)).default;
    const { graph: g, errors } = parseGraph(cfg);
    expect(g.nodes).toHaveLength(37);
    expect(errors).toEqual([]);
    expect(g.title).toBe(cfg.title);
    expect(g.subtitle).toBe(cfg.sub);
    expect(g.footer).toBe(cfg.foot);
    expect(g.nodes[0]).toMatchObject({ slug: "values-types", trackKey: "basics", title: "Values & types" });
  });
});

describe("parseGraph", () => {
  it("maps legacy fields and optional _id values", () => {
    const { graph: g, errors } = parseGraph({ ...graph([node({ _id: "n1" })]), _id: "g1" });
    expect(errors).toEqual([]);
    expect(g.id).toBe("g1");
    expect(g.tracks[0]).toEqual({ key: "t1", name: "One" });
    expect(g.nodes[0]).toEqual({
      id: "n1", slug: "a-node", trackKey: "t1", title: "A node", prereqSlugs: [], summary: "sum",
      points: ["one", "two"], code: "code", pitfall: "pit", docsUrl: "https://example.com/x",
    });
  });
  it("flags a 23-char title", () => {
    const { errors } = parseGraph(graph([node({ t: "x".repeat(23) })]));
    expect(errors.join("\n")).toContain("over 22");
  });
  it("accepts a 22-char title", () => {
    expect(parseGraph(graph([node({ t: "x".repeat(22) })])).errors).toEqual([]);
  });
  it("flags track count, bad id, duplicate id, unknown track, missing fields, bad url, unknown prerequisite", () => {
    const { errors } = parseGraph(graph([
      node({ id: "Bad_Id" }),
      node({ id: "dup" }),
      node({ id: "dup", tr: "nope", s: " ", c: "", pit: "", p: ["one"], u: "http://x.com", pre: ["ghost"] }),
    ], [{ k: "t1", n: "One" }]));
    const all = errors.join("\n");
    for (const m of [
      "tracks: need 2..6", "node Bad_Id: id must be lowercase kebab", "node dup: duplicate id",
      "node dup: unknown track nope", "node dup: s missing", "node dup: c missing", "node dup: pit missing",
      "node dup: p needs 2+ points", "node dup: u must be an absolute https URL",
      "node dup: unknown prerequisite ghost",
    ]) expect(all).toContain(m);
  });
  it("reports cycles from findCycle", () => {
    const { errors } = parseGraph(graph([node({ id: "a", pre: ["b"] }), node({ id: "b", pre: ["a"] })]));
    expect(errors).toContain("cycle: a -> b -> a");
  });
  it("does not throw on garbage input", () => {
    expect(parseGraph(null).graph.nodes).toEqual([]);
    expect(parseGraph({ tracks: "x", nodes: [1, null] }).errors.length).toBeGreaterThan(0);
  });
  it("flags a non-array pre", () => {
    expect(parseGraph(graph([node({ pre: "a" })])).errors).toContain("node a-node: pre must be an array");
  });
});

describe("validateNode", () => {
  it("returns no errors for a good node and flags an unknown track", () => {
    const n = parseGraph(graph([node()])).graph.nodes[0];
    expect(validateNode(n, ["t1"])).toEqual([]);
    expect(validateNode(n, ["other"])).toEqual(["node a-node: unknown track t1"]);
  });
});
