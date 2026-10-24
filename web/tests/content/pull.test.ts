import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runImport } from "@/content/import/run";
import { pullBook, pullGraph, pullSeries } from "@/content/pull";
import { connectDb } from "@/lib/db";
import { Question } from "@/models";
import { resetDb } from "../setup/mongo";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const FENCE = "```";
const BOOK = [
  "# Fixture Book",
  "",
  "Intro text.",
  "",
  "# Part 1 — Basics",
  "",
  "Part intro.",
  "",
  "## Q1. What is X?",
  "",
  "X is a thing.",
  "",
  "## Q2. What does this print?",
  "",
  `${FENCE}js`,
  "console.log(1)",
  FENCE,
  "",
  "<details><summary>Answer</summary>",
  "",
  "`1`",
  "",
  "</details>",
  "",
  "## T1. Trap?",
  "",
  `${FENCE}js`,
  "typeof null",
  FENCE,
  "",
  "**Answer:** `object`, a legacy quirk.",
  "",
  "## Appendix — Study plan",
  "",
  "Day 1: read.",
  "",
].join("\n");

const GRAPH = {
  title: "Fixture Graph",
  sub: "Sub",
  foot: "Foot",
  tracks: [
    { k: "a", n: "Track A" },
    { k: "b", n: "Track B" },
  ],
  nodes: [
    { id: "one", tr: "a", t: "One", pre: [], s: "S1", p: ["p1", "p2"], c: "c1", pit: "pit1", u: "https://example.test/1" },
    { id: "two", tr: "b", t: "Two", pre: ["one"], s: "S2", p: ["p1", "p2"], c: "c2", pit: "pit2", u: "https://example.test/2" },
  ],
};

const SERIES = [
  { name: "01-intro.md", content: "# Intro\n\n## Images\n\nText." },
  { name: "02-net.md", content: "# Networking\n\n### Bridges\n\nMore." },
];

async function seed() {
  const common = { dryRun: false, publish: true, editedBy: "test" };
  const book = await runImport({ ...common, target: { kind: "book", slug: "fixture" }, title: "Fixture Book", source: { kind: "book", markdown: BOOK } });
  const graph = await runImport({ ...common, target: { kind: "graph", slug: "fixture-graph" }, title: "Fixture Graph", source: { kind: "graph", json: GRAPH } });
  const series = await runImport({ ...common, target: { kind: "series", slug: "fixture-notes" }, title: "Fixture Notes", source: { kind: "series", files: SERIES } });
  for (const r of [book, graph, series]) expect(r.errors).toEqual([]);
}

describe("pull round trip", () => {
  it("re-imports a pulled book with nothing to change", async () => {
    await seed();
    const pulled = await pullBook("fixture");
    expect(pulled.fileName).toBe("fixture.md");
    expect(pulled.content).toMatch(/<!-- learn:book id=[0-9a-f]{24} -->/);
    const report = await runImport({ target: { kind: "book", slug: "fixture" }, source: { kind: "book", markdown: pulled.content }, editedBy: "test" });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect({ creates: report.creates, updates: report.updates, unchanged: report.unchanged }).toEqual({ creates: 0, updates: 0, unchanged: 3 });
    expect(report.items.filter((i) => i.action !== "unchanged")).toEqual([]);
  });

  it("re-imports a pulled series with nothing to change", async () => {
    await seed();
    const pulled = await pullSeries("fixture-notes");
    expect(pulled.files.map((f) => f.name)).toEqual(["01-intro.md", "02-net.md"]);
    expect(pulled.files[0].content.startsWith("<!-- learn:note ")).toBe(true);
    const report = await runImport({ target: { kind: "series", slug: "fixture-notes" }, source: { kind: "series", files: pulled.files }, editedBy: "test" });
    expect(report.errors).toEqual([]);
    expect(report.items.filter((i) => i.action !== "unchanged")).toEqual([]);
  });

  it("re-imports a pulled graph with nothing to change", async () => {
    await seed();
    const pulled = await pullGraph("fixture-graph");
    expect(pulled.fileName).toBe("fixture-graph.json");
    const report = await runImport({ target: { kind: "graph", slug: "fixture-graph" }, source: { kind: "graph", json: pulled.json }, editedBy: "test" });
    expect(report.errors).toEqual([]);
    expect(report.items.filter((i) => i.action !== "unchanged")).toEqual([]);
  });

  it("updates exactly the edited question by id", async () => {
    await seed();
    const pulled = await pullBook("fixture");
    const edited = pulled.content.replace("X is a thing.", "X is a different thing.");
    const report = await runImport({
      target: { kind: "book", slug: "fixture" },
      source: { kind: "book", markdown: edited },
      dryRun: false,
      editedBy: "test",
    });
    expect(report.updates).toBe(1);
    expect(report.items.find((i) => i.action === "update")).toMatchObject({ type: "question", fields: ["answer"] });
    const q = await Question.findOne({ question: "What is X?" }).lean<{ answer: string }>();
    expect(q?.answer).toBe("X is a different thing.");
  });
});
