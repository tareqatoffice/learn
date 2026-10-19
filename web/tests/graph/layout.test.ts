import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { computeTiers, layoutGraph, readyNext } from "@/graph/layout";

const abc = [
  { id: "a", prereqIds: [] },
  { id: "b", prereqIds: ["a"] },
  { id: "c", prereqIds: ["a", "b"] },
];

describe("computeTiers", () => {
  it("puts a node one tier below its deepest prerequisite", () => {
    expect(computeTiers(abc)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("ignores prerequisites that are not in the node list", () => {
    expect(computeTiers([{ id: "x", prereqIds: ["hidden"] }])).toEqual({ x: 0 });
  });
});

describe("readyNext", () => {
  it("returns untouched nodes whose prerequisites are all done", () => {
    expect(readyNext(abc, { a: "done" })).toEqual(["b"]);
  });

  it("does not count learning prerequisites as done", () => {
    expect(readyNext(abc, { a: "learning" })).toEqual([]);
  });

  it("returns roots when nothing is started", () => {
    expect(readyNext(abc, {})).toEqual(["a"]);
  });
});

describe("layoutGraph", () => {
  it("places each tier on its own row, top to bottom", () => {
    const out = layoutGraph(
      abc.map((n) => ({ ...n, trackKey: "t" })),
      [{ key: "t" }],
    );
    expect(out.positions.a.tier).toBe(0);
    expect(out.positions.c.tier).toBe(2);
    expect(out.positions.a.y).toBeLessThan(out.positions.b.y);
    expect(out.positions.b.y).toBeLessThan(out.positions.c.y);
    expect(out.rows.filter((r) => r.first).map((r) => r.tier)).toEqual([0, 1, 2]);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(out.positions.c.y);
  });

  it("wraps a tier with more than four topics onto balanced rows", () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, trackKey: "t", prereqIds: [] }));
    const out = layoutGraph(nodes, [{ key: "t" }]);
    expect(out.rows).toEqual([
      expect.objectContaining({ tier: 0, first: true }),
      expect.objectContaining({ tier: 0, first: false }),
    ]);
  });

  const realGraph = resolve(__dirname, "../../../learning-graph/_src/data/javascript.mjs");
  it.skipIf(!existsSync(realGraph))("gives every topic of the real JavaScript graph its own position", async () => {
    const data = (await import(pathToFileURL(realGraph).href)).default as {
      tracks: { k: string }[];
      nodes: { id: string; tr: string; pre: string[] }[];
    };
    const out = layoutGraph(
      data.nodes.map((n) => ({ id: n.id, trackKey: n.tr, prereqIds: n.pre })),
      data.tracks.map((t) => ({ key: t.k })),
    );
    const spots = Object.values(out.positions).map((p) => `${p.x},${p.y}`);
    expect(spots).toHaveLength(37);
    expect(new Set(spots).size).toBe(37);
  });
});
