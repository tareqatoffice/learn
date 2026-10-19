import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDb } from "@/lib/db";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Subject } from "@/models";
import { importLegacy } from "../../scripts/import-legacy";
import { SUBJECTS, type ExpectedCounts } from "../../scripts/legacy-map";
import { resetDb } from "../setup/mongo";

const BOOK = [
  "# CSS Book", "",
  "Intro.", "",
  "# Part 1 — Basics", "",
  "## Q1. What is X?", "", "X.", "",
  "## Q2. What is Y?", "", "Y.", "",
  "## Q3. What is Z?", "", "Z.",
].join("\n");

const node = (id: string, pre: string[]) => ({
  id,
  tr: "basics",
  t: id.toUpperCase(),
  pre,
  s: `Summary ${id}`,
  p: ["one", "two"],
  c: "code()",
  pit: "pitfall",
  u: "https://example.com/docs",
});
const GRAPH = {
  title: "Go Graph",
  tracks: [{ k: "basics", n: "Basics" }, { k: "adv", n: "Advanced" }],
  nodes: [node("a", []), node("b", ["a"]), node("c", ["a", "b"]), node("d", ["c"])],
};

const EXPECTED: ExpectedCounts = { books: { "css-questions-ebook": 3 }, graphs: { go: 4 }, series: { docker: 2 } };
const REFUSAL = "database has content not created by the legacy import";
const ALL_MODELS = [Subject, QuestionBook, Question, Graph, GraphNode, NoteSeries, Note];

let repo: string;

function write(rel: string, content: string) {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function writeFixtures(graph: unknown = GRAPH) {
  write("interview-topics/css-questions-ebook.md", BOOK);
  write("learning-graph/_src/data/go.mjs", `export default ${JSON.stringify(graph)};\n`);
  write("docker/notes/01-containers.md", "# Containers\n\nBody one.\n");
  write("docker/notes/02-images.md", "# Images\n\nBody two.\n");
  write("docker/LEARNING_PLAN.md", "# Docker plan\n\nLearn it.\n");
}

const row = (rows: { slug: string }[], slug: string) => rows.find((r) => r.slug === slug);
const contentCounts = () => Promise.all([Question, GraphNode, Note, Subject].map((m) => m.countDocuments()));

describe("importLegacy", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    repo = mkdtempSync(path.join(tmpdir(), "legacy-"));
    writeFixtures();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("imports a book, a graph and a series and verifies the counts", async () => {
    const result = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(result.ok).toBe(true);
    expect(result.rows).toMatchObject([
      { kind: "book", slug: "css-questions-ebook", expected: 3, actual: 3, creates: 3 },
      { kind: "graph", slug: "go", expected: 4, actual: 4, creates: 4 },
      { kind: "series", slug: "docker", expected: 2, actual: 2, creates: 2 },
    ]);

    const book = await QuestionBook.findOne({ slug: "css-questions-ebook" }).lean<Record<string, unknown>>();
    expect(book).toMatchObject({ title: "CSS", subjects: ["css", "frontend"], status: "published" });
    const graph = await Graph.findOne({ slug: "go" }).lean<Record<string, unknown>>();
    expect(graph).toMatchObject({ title: "Go Graph", subjects: ["go"], status: "published" });
    const series = await NoteSeries.findOne({ slug: "docker" }).lean<Record<string, unknown>>();
    expect(series).toMatchObject({
      title: "Docker",
      description: "# Docker plan\n\nLearn it.",
      subjects: ["docker"],
      status: "published",
    });
    expect(await Question.countDocuments({ status: "published" })).toBe(3);
  });

  it("seeds every subject in order and stamps one importedAt on the whole run", async () => {
    await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    const subjects = await Subject.find().sort({ order: 1 }).lean<{ slug: string; name: string; order: number }[]>();
    expect(subjects.map((s) => s.slug)).toEqual(SUBJECTS.map((s) => s.slug));
    expect(subjects.map((s) => s.order)).toEqual(SUBJECTS.map((_, i) => i + 1));
    expect(subjects.find((s) => s.slug === "csharp-dotnet")!.name).toBe("C# / .NET");

    const stamps = new Set<number>();
    for (const model of ALL_MODELS) {
      const docs = await model.find().lean<{ importedAt?: Date }[]>();
      expect(docs.length).toBeGreaterThan(0);
      for (const d of docs) {
        expect(d.importedAt).toBeInstanceOf(Date);
        stamps.add(d.importedAt!.getTime());
      }
    }
    expect(stamps.size).toBe(1);
  });

  it("a second run is idempotent: same counts, no creates or updates", async () => {
    await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });
    const before = await contentCounts();

    const again = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(again.ok).toBe(true);
    expect(again.rows.map((r) => [r.actual, r.creates, r.updates])).toEqual([[3, 0, 0], [4, 0, 0], [2, 0, 0]]);
    expect(await contentCounts()).toEqual(before);
  });

  it("dry run reports the plan and writes nothing", async () => {
    const result = await importLegacy({ repoRoot: repo, dryRun: true, expected: EXPECTED });

    expect(result.ok).toBe(true);
    expect(result.rows.map((r) => [r.actual, r.creates])).toEqual([[3, 3], [4, 4], [2, 2]]);
    expect(await Promise.all(ALL_MODELS.map((m) => m.countDocuments()))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("fails when the source has fewer questions than expected", async () => {
    const result = await importLegacy({
      repoRoot: repo,
      dryRun: false,
      expected: { ...EXPECTED, books: { "css-questions-ebook": 4 } },
    });

    expect(result.ok).toBe(false);
    expect(row(result.rows, "css-questions-ebook")).toMatchObject({ expected: 4, actual: 3 });
    expect(row(result.rows, "go")).toMatchObject({ expected: 4, actual: 4 });
    expect(result.message).toContain("css-questions-ebook");
  });

  it("counts what is in the database, not what the report says", async () => {
    await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });
    const book = await QuestionBook.findOne({ slug: "css-questions-ebook" }).lean<{ _id: unknown }>();
    await Question.create({ bookId: book!._id, partKey: "x", question: "Extra?", answer: "Yes", importedAt: new Date() });

    const result = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(result.ok).toBe(false);
    expect(row(result.rows, "css-questions-ebook")).toMatchObject({ expected: 3, actual: 4 });
  });

  it("refuses when a content doc was not created by the legacy import", async () => {
    await Question.create({ bookId: new mongoose.Types.ObjectId(), partKey: "x", question: "Q?", answer: "A" });

    const result = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(result).toEqual({ ok: false, message: REFUSAL, rows: [] });
    expect(await QuestionBook.countDocuments()).toBe(0);
  });

  it("refuses over a subject without importedAt, even on a dry run", async () => {
    await Subject.create({ slug: "html", name: "HTML", order: 1 });

    const result = await importLegacy({ repoRoot: repo, dryRun: true, expected: EXPECTED });

    expect(result).toMatchObject({ ok: false, message: REFUSAL });
  });

  it("fails when a graph does not validate", async () => {
    writeFixtures({ ...GRAPH, nodes: [node("a", []), node("b", ["missing"]), node("c", []), node("d", [])] });

    const result = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("unknown prerequisite missing");
    expect(await GraphNode.countDocuments()).toBe(0);
  });

  it("fails when a source file is missing", async () => {
    rmSync(path.join(repo, "interview-topics/css-questions-ebook.md"));

    const result = await importLegacy({ repoRoot: repo, dryRun: false, expected: EXPECTED });

    expect(result.ok).toBe(false);
    expect(row(result.rows, "css-questions-ebook")).toMatchObject({ expected: 3, actual: 0 });
    expect(result.message).toContain("css-questions-ebook");
  });

  it("fails when expected names a slug that is not in the legacy map", async () => {
    const result = await importLegacy({ repoRoot: repo, dryRun: true, expected: { ...EXPECTED, books: { nope: 1 } } });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("nope");
  });
});
