import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { restoreRevisionChecked, saveGraph, saveNode } from "@/admin/service";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Revision } from "@/models";
import { resetDb } from "../setup/mongo";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const ADMIN = "owner@example.test";
const TRACKS = [
  { key: "basics", name: "Basics" },
  { key: "async", name: "Async" },
];

async function graph(slug = "js") {
  const r = await saveGraph({ slug, title: `${slug} graph`, subtitle: "", footer: "", subjects: [], tracks: TRACKS, status: "published" }, ADMIN);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

const node = (graphId: string, slug: string, over: Record<string, unknown> = {}) => ({
  graphId,
  slug,
  trackKey: "basics",
  title: `${slug} topic`,
  prereqIds: [] as string[],
  summary: "Summary.",
  points: ["One", "Two"],
  code: "x()",
  pitfall: "Oops.",
  docsUrl: "https://example.test/docs",
  subjects: [],
  status: "published" as const,
  ...over,
});

async function saved(input: ReturnType<typeof node>) {
  const r = await saveNode(input, ADMIN);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

describe("saveGraph", () => {
  it("requires 2 to 6 tracks", async () => {
    const r = await saveGraph({ slug: "x", title: "X", subtitle: "", footer: "", subjects: [], tracks: [TRACKS[0]], status: "draft" }, ADMIN);
    expect(r).toMatchObject({ ok: false, errors: { tracks: expect.any(String) } });
  });

  it("refuses to remove a track that still has topics", async () => {
    const id = await graph();
    await saved(node(id, "a", { trackKey: "async" }));
    const r = await saveGraph(
      { id, slug: "js", title: "JS", subtitle: "", footer: "", subjects: [], tracks: [TRACKS[0], { key: "extra", name: "Extra" }], status: "published" },
      ADMIN,
    );
    expect(r).toMatchObject({ ok: false, errors: { tracks: expect.stringContaining("Async") } });
  });

  it("ignores blank key-point lines", async () => {
    const g = await graph();
    const id = await saved(node(g, "a", { points: ["One", "", "  ", "Two", ""] }));
    expect((await GraphNode.findById(id).lean<{ points: string[] }>())?.points).toEqual(["One", "Two"]);
  });

  it("updates with a revision", async () => {
    const id = await graph();
    const r = await saveGraph({ id, slug: "js", title: "JS!", subtitle: "", footer: "", subjects: [], tracks: TRACKS, status: "published" }, ADMIN);
    expect(r).toEqual({ ok: true, id });
    expect((await Graph.findById(id).lean<{ title: string }>())?.title).toBe("JS!");
    expect(await Revision.countDocuments({ entityId: id })).toBe(1);
  });
});

describe("saveNode", () => {
  it("creates a topic with the next order", async () => {
    const g = await graph();
    await saved(node(g, "a"));
    const b = await saved(node(g, "b"));
    expect((await GraphNode.findById(b).lean<{ order: number }>())?.order).toBe(1);
  });

  it("rejects a prerequisite from another graph", async () => {
    const g = await graph("js");
    const other = await saved(node(await graph("go"), "elsewhere"));
    const r = await saveNode(node(g, "a", { prereqIds: [other] }), ADMIN);
    expect(r).toMatchObject({ ok: false, errors: { prereqIds: expect.stringMatching(/same graph/i) } });
  });

  it("names the cycle by topic titles", async () => {
    const g = await graph();
    const a = await saved(node(g, "a", { title: "Alpha" }));
    const b = await saved(node(g, "b", { title: "Beta", prereqIds: [a] }));
    const r = await saveNode({ id: a, ...node(g, "a", { title: "Alpha", prereqIds: [b] }) }, ADMIN);
    expect(r).toMatchObject({ ok: false, errors: { prereqIds: "Creates a cycle: Alpha → Beta → Alpha" } });
    expect((await GraphNode.findById(a).lean<{ prereqIds: unknown[] }>())?.prereqIds).toEqual([]);
  });

  it("rejects a self prerequisite", async () => {
    const g = await graph();
    const a = await saved(node(g, "a"));
    const r = await saveNode({ id: a, ...node(g, "a", { prereqIds: [a] }) }, ADMIN);
    expect(r).toMatchObject({ ok: false, errors: { prereqIds: expect.any(String) } });
  });

  it("enforces the legacy topic rules", async () => {
    const g = await graph();
    const long = await saveNode(node(g, "a", { title: "x".repeat(23) }), ADMIN);
    expect(long).toMatchObject({ ok: false, errors: { title: expect.stringContaining("22") } });
    const track = await saveNode(node(g, "b", { trackKey: "nope" }), ADMIN);
    expect(track).toMatchObject({ ok: false, errors: { trackKey: expect.any(String) } });
    const points = await saveNode(node(g, "c", { points: ["only one"] }), ADMIN);
    expect(points).toMatchObject({ ok: false, errors: { points: expect.any(String) } });
    const url = await saveNode(node(g, "d", { docsUrl: "http://insecure.test" }), ADMIN);
    expect(url).toMatchObject({ ok: false, errors: { docsUrl: expect.any(String) } });
  });

  it("rejects a slug already used in the same graph", async () => {
    const g = await graph();
    await saved(node(g, "a"));
    expect(await saveNode(node(g, "a"), ADMIN)).toMatchObject({ ok: false, errors: { slug: expect.any(String) } });
  });
});

describe("restoreRevisionChecked", () => {
  const revisionWith = async (entityId: string, match: (snap: Record<string, unknown>) => boolean) => {
    const rows = await Revision.find({ entityId }).lean<{ _id: unknown; snapshot: Record<string, unknown> }[]>();
    const row = rows.find((r) => match(r.snapshot));
    if (!row) throw new Error("revision not found");
    return String(row._id);
  };

  it("refuses a topic version whose prerequisites would now form a cycle", async () => {
    const g = await graph();
    const a = await saved(node(g, "a"));
    const b = await saved(node(g, "b"));
    await saved(node(g, "a", { id: a, prereqIds: [b] }));
    await saved(node(g, "a", { id: a, prereqIds: [] })); // stores the a -> b version
    await saved(node(g, "b", { id: b, prereqIds: [a] }));

    const aNeedsB = await revisionWith(a, (s) => (s.prereqIds as unknown[]).length === 1);
    expect(await restoreRevisionChecked(aNeedsB, ADMIN)).toMatchObject({ ok: false, errors: { prereqIds: expect.stringContaining("cycle") } });
    expect((await GraphNode.findById(a).lean<{ prereqIds: unknown[] }>())?.prereqIds).toEqual([]);
  });

  it("refuses a graph version that drops a track still holding topics", async () => {
    const g = await graph();
    const three = [...TRACKS, { key: "extra", name: "Extra" }];
    expect(await saveGraph({ id: g, slug: "js", title: "js graph", subtitle: "", footer: "", subjects: [], tracks: three, status: "published" }, ADMIN)).toMatchObject({ ok: true });
    await saved(node(g, "x", { trackKey: "extra" }));

    const twoTracks = await revisionWith(g, (s) => (s.tracks as unknown[]).length === 2);
    expect(await restoreRevisionChecked(twoTracks, ADMIN)).toMatchObject({ ok: false, errors: { tracks: expect.stringContaining("Extra") } });
  });

  it("restores a version that still fits", async () => {
    const g = await graph();
    const a = await saved(node(g, "a"));
    await saved(node(g, "a", { id: a, title: "renamed" }));
    const original = await revisionWith(a, (s) => s.title === "a topic");
    expect(await restoreRevisionChecked(original, ADMIN)).toEqual({ ok: true, id: a });
    expect((await GraphNode.findById(a).lean<{ title: string }>())?.title).toBe("a topic");
  });
});
