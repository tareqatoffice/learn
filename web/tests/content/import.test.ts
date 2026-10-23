import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { importKey } from "@/lib/ids";
import { runImport } from "@/content/import/run";
import type { ImportSource, ImportTarget } from "@/content/types";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Revision } from "@/models";
import { resetDb } from "../setup/mongo";

const md = (...lines: string[]) => lines.join("\n");
const editedBy = "tester@example.com";

const BOOK = md(
  "# Test Book", "",
  "Intro text.", "",
  "# Part 1 — Basics", "",
  "## Q1. What is X?", "", "X is a thing.", "",
  "## Q2. What is Y?", "", "Y is another.", "",
  "# Part 2 — More", "",
  "## Q3. What is Z?", "", "Z.",
);

const bookTarget: ImportTarget = { kind: "book", slug: "tb" };
const book = (markdown: string): ImportSource => ({ kind: "book", markdown });

async function counts() {
  const [questions, books, notes, series, nodes, graphs, revisions] = await Promise.all([
    Question.countDocuments(),
    QuestionBook.countDocuments(),
    Note.countDocuments(),
    NoteSeries.countDocuments(),
    GraphNode.countDocuments(),
    Graph.countDocuments(),
    Revision.countDocuments(),
  ]);
  return { questions, books, notes, series, nodes, graphs, revisions };
}

const commitBook = (markdown = BOOK, extra: { publish?: boolean; importedAt?: Date } = {}) =>
  runImport({ target: bookTarget, source: book(markdown), dryRun: false, editedBy, title: "Test Book", ...extra });

const node = (slug: string, tr: string, pre: string[], extra: Record<string, unknown> = {}) => ({
  id: slug,
  tr,
  t: slug.toUpperCase(),
  pre,
  s: `Summary ${slug}`,
  p: ["one", "two"],
  c: "code()",
  pit: "pitfall",
  u: "https://example.com/docs",
  ...extra,
});
const tracks = [{ k: "core", n: "Core" }, { k: "adv", n: "Advanced" }];
const graphTarget: ImportTarget = { kind: "graph", slug: "g" };
const graph = (nodes: unknown[]): ImportSource => ({ kind: "graph", json: { title: "G", tracks, nodes } });

describe("runImport", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterAll(() => mongoose.disconnect());

  describe("book", () => {
    it("dry run over an empty DB previews the creates and writes nothing", async () => {
      const report = await runImport({ target: bookTarget, source: book(BOOK), editedBy, title: "Test Book" });

      expect(report).toMatchObject({ dryRun: true, createdTarget: true, creates: 3, updates: 0, unchanged: 0, errors: [] });
      expect(report.items.filter((i) => i.type === "question").map((i) => i.action)).toEqual(["create", "create", "create"]);
      expect(report.items.find((i) => i.type === "container")).toMatchObject({ action: "create", key: "tb" });
      expect(await counts()).toMatchObject({ questions: 0, books: 0, revisions: 0 });
    });

    it("commit creates the book and its questions as published, ordered 1..n", async () => {
      const report = await commitBook(BOOK, { publish: true });

      expect(report).toMatchObject({ dryRun: false, createdTarget: true, creates: 3, errors: [] });
      const saved = await QuestionBook.findOne({ slug: "tb" }).lean<{ _id: unknown; title: string; intro: string; status: string; parts: { key: string; title: string }[] }>();
      expect(saved).toMatchObject({ title: "Test Book", intro: "Intro text.", status: "published" });
      expect(saved!.parts.map((p) => p.title)).toEqual(["Part 1 — Basics", "Part 2 — More"]);
      const questions = await Question.find({ bookId: saved!._id }).sort({ order: 1 }).lean();
      expect(questions.map((q) => [q.order, q.question, q.status])).toEqual([
        [1, "What is X?", "published"],
        [2, "What is Y?", "published"],
        [3, "What is Z?", "published"],
      ]);
      expect(questions[0].partKey).toBe(saved!.parts[0].key);
      expect(questions[2].partKey).toBe(saved!.parts[1].key);
      expect(questions[0].importKey).toBe(importKey("tb", "What is X?", ""));
      expect(await Revision.countDocuments()).toBe(0);
    });

    it("new items are draft unless publish", async () => {
      await commitBook();
      expect(await Question.distinct("status")).toEqual(["draft"]);
      expect((await QuestionBook.findOne({ slug: "tb" }).lean<{ status: string }>())!.status).toBe("draft");
    });

    it("re-importing the identical source reports everything unchanged", async () => {
      await commitBook();
      const report = await commitBook();

      expect(report).toMatchObject({ createdTarget: false, creates: 0, updates: 0, unchanged: 3, errors: [] });
      expect(report.items.every((i) => i.action === "unchanged")).toBe(true);
      expect(await counts()).toMatchObject({ questions: 3, books: 1, revisions: 0 });
    });

    it("an edited answer updates only that question, with fields ['answer'] and one revision", async () => {
      await commitBook();
      const report = await commitBook(BOOK.replace("Y is another.", "Y changed."));

      expect(report).toMatchObject({ creates: 0, updates: 1, unchanged: 2, errors: [] });
      expect(report.items.find((i) => i.action === "update")).toMatchObject({ type: "question", fields: ["answer"] });
      expect(await Revision.countDocuments()).toBe(1);
      const revision = await Revision.findOne().lean<{ entityType: string; editedBy: string; snapshot: { answer: string } }>();
      expect(revision).toMatchObject({ entityType: "Question", editedBy, snapshot: { answer: "Y is another." } });
      expect((await Question.findOne({ question: "What is Y?" }).lean<{ answer: string }>())!.answer).toBe("Y changed.");
    });

    it("a dry run of an edit writes nothing", async () => {
      await commitBook();
      const before = await counts();
      const report = await runImport({ target: bookTarget, source: book(BOOK.replace("Z.", "Zed.")), editedBy });

      expect(report).toMatchObject({ dryRun: true, updates: 1 });
      expect(await counts()).toEqual(before);
      expect((await Question.findOne({ question: "What is Z?" }).lean<{ answer: string }>())!.answer).toBe("Z.");
    });

    it("a question missing from the source stays in the DB unchanged", async () => {
      await commitBook();
      const before = await Question.findOne({ question: "What is Z?" }).lean<{ updatedAt: Date; status: string }>();
      const report = await commitBook(BOOK.replace(/## Q3[\s\S]*$/, "").trimEnd());

      expect(report).toMatchObject({ creates: 0, updates: 0, unchanged: 2, errors: [] });
      const after = await Question.findOne({ question: "What is Z?" }).lean<{ updatedAt: Date; status: string }>();
      expect(after).toEqual(before);
      expect(await Question.countDocuments()).toBe(3);
    });

    it("new questions go after the current max order; existing status is never changed", async () => {
      await commitBook();
      await Question.updateOne({ question: "What is X?" }, { status: "archived" });
      const report = await commitBook(md(BOOK.replace("X is a thing.", "X edited."), "", "## Q4. What is W?", "", "W."), {
        publish: true,
      });

      expect(report).toMatchObject({ creates: 1, updates: 1, unchanged: 2 });
      const x = await Question.findOne({ question: "What is X?" }).lean<{ status: string; answer: string }>();
      expect(x).toMatchObject({ status: "archived", answer: "X edited." });
      const w = await Question.findOne({ question: "What is W?" }).lean<{ order: number; status: string }>();
      expect(w).toMatchObject({ order: 4, status: "published" });
    });

    it("a canonical id updates the question even when its text (and so its importKey) changed", async () => {
      await commitBook();
      const x = await Question.findOne({ question: "What is X?" }).lean<{ _id: unknown; partKey: string; importKey: string }>();
      const canonical = md(
        "<!-- learn:book -->", "# Test Book", "",
        `<!-- learn:part key=${x!.partKey} -->`, "# Part 1 — Basics", "",
        `<!-- learn:question id=${String(x!._id)} -->`, "## Q1. What is X, really?", "",
        "<!-- learn:answer -->", "X is a thing.",
      );
      const report = await commitBook(canonical);

      expect(report).toMatchObject({ creates: 0, updates: 1, errors: [] });
      expect(report.items.find((i) => i.type === "question")).toMatchObject({
        action: "update",
        id: String(x!._id),
        fields: ["question"],
      });
      const after = await Question.findById(x!._id).lean<{ question: string; importKey: string }>();
      expect(after).toMatchObject({ question: "What is X, really?", importKey: x!.importKey });
      expect(await Question.countDocuments()).toBe(3);
    });

    it("identical question texts get key and key-2, and re-import matches both", async () => {
      const dup = md("# Dup", "", "# Part", "", "## Q1. Same?", "", "a", "", "## Q2. Same?", "", "b");
      await commitBook(dup);
      const keys = (await Question.find().sort({ order: 1 }).lean<{ importKey: string }[]>()).map((q) => q.importKey);
      const base = importKey("tb", "Same?", "");
      expect(keys).toEqual([base, `${base}-2`]);

      const report = await commitBook(dup);
      expect(report).toMatchObject({ creates: 0, updates: 0, unchanged: 2, errors: [] });
      expect(await Question.countDocuments()).toBe(2);
    });

    it("merges parts by key: appends new parts and updates titles and intros only when given", async () => {
      await commitBook(md(BOOK.replace("# Part 1 — Basics", "# Part 1 — Basics\n\nPart one intro.")));
      const saved = await QuestionBook.findOne({ slug: "tb" }).lean<{ parts: { key: string; intro: string }[] }>();
      expect(saved!.parts[0].intro).toBe("Part one intro.");

      const report = await commitBook(md(BOOK, "", "# Part 3 — New", "", "## Q9. New?", "", "N."));
      expect(report.items.filter((i) => i.type === "part").map((i) => i.action)).toEqual(["unchanged", "unchanged", "create"]);
      const after = await QuestionBook.findOne({ slug: "tb" }).lean<{ intro: string; parts: { title: string; intro: string; order: number }[] }>();
      expect(after!.parts.map((p) => [p.title, p.order])).toEqual([
        ["Part 1 — Basics", 1],
        ["Part 2 — More", 2],
        ["Part 3 — New", 3],
      ]);
      expect(after!.parts[0].intro).toBe("Part one intro.");
    });

    it("sets importedAt on created and updated docs only", async () => {
      const first = new Date("2026-01-01T00:00:00Z");
      const second = new Date("2026-02-01T00:00:00Z");
      await commitBook(BOOK, { importedAt: first });
      expect(await Question.distinct("importedAt")).toEqual([first]);

      await commitBook(BOOK.replace("Z.", "Zed."), { importedAt: second });
      const z = await Question.findOne({ question: "What is Z?" }).lean<{ importedAt: Date }>();
      const x = await Question.findOne({ question: "What is X?" }).lean<{ importedAt: Date }>();
      expect(z!.importedAt).toEqual(second);
      expect(x!.importedAt).toEqual(first);
    });

    it("reports a missing target without a title as an error and writes nothing", async () => {
      const report = await runImport({ target: bookTarget, source: book(BOOK), dryRun: false, editedBy });
      expect(report.errors).toEqual(["target not found"]);
      expect(await counts()).toMatchObject({ questions: 0, books: 0 });
    });

    it("turns a parser exception into an error instead of throwing", async () => {
      const report = await commitBook("Just some prose.");
      expect(report.errors.join("\n")).toMatch(/No questions found in tb/);
      expect(await counts()).toMatchObject({ questions: 0, books: 0 });
    });

    it("files a new partless question under a General part", async () => {
      await commitBook();
      const fragment = md("<!-- learn:book -->", "", "<!-- learn:question -->", "## Q1. Loose?", "", "<!-- learn:answer -->", "Yes.");
      const report = await commitBook(fragment);

      expect(report).toMatchObject({ creates: 1, errors: [] });
      const saved = await QuestionBook.findOne({ slug: "tb" }).lean<{ title: string; parts: { key: string; title: string }[] }>();
      expect(saved!.title).toBe("Test Book");
      expect(saved!.parts.map((p) => p.key).at(-1)).toBe("general");
      expect((await Question.findOne({ question: "Loose?" }).lean<{ partKey: string }>())!.partKey).toBe("general");
    });

    it("rejects a source whose kind differs from the target", async () => {
      const report = await runImport({ target: bookTarget, source: { kind: "graph", json: {} }, dryRun: false, editedBy, title: "T" });
      expect(report.errors).toEqual(["source kind graph does not match target kind book"]);
    });

    it("puts unaccounted lines into warnings without blocking", async () => {
      const src = md("Stray text.", "", "<!-- learn:book -->", "# Test Book", "", "<!-- learn:question -->", "## Q1. A?", "", "<!-- learn:answer -->", "One.");
      const report = await commitBook(src);
      expect(report.errors).toEqual([]);
      expect(report.warnings.join("\n")).toMatch(/Stray text\./);
      expect(await Question.countDocuments()).toBe(1);
    });
  });

  describe("series", () => {
    const files = [
      { name: "01-intro.md", content: md("# Intro", "", "## Setup", "", "Install it.", "", "### Detail", "", "More.") },
      { name: "02-next.md", content: md("# Next steps", "", "## Part A", "", "Text.") },
    ];
    const run = (dryRun = false) =>
      runImport({
        target: { kind: "series", slug: "s" },
        source: { kind: "series", files },
        dryRun,
        editedBy,
        title: "Series",
        description: "About it",
        subjects: ["docker"],
      });

    it("creates one note per file with toc, readMinutes and inherited subjects", async () => {
      const report = await run();

      expect(report).toMatchObject({ createdTarget: true, creates: 2, errors: [] });
      const series = await NoteSeries.findOne({ slug: "s" }).lean<{ description: string; subjects: string[] }>();
      expect(series).toMatchObject({ description: "About it", subjects: ["docker"] });
      const notes = await Note.find().sort({ order: 1 }).lean();
      expect(notes.map((n) => [n.slug, n.title, n.order, n.readMinutes])).toEqual([
        ["intro", "Intro", 1, 1],
        ["next", "Next steps", 2, 1],
      ]);
      expect(notes[0].toc.map((t: { anchor: string }) => t.anchor)).toEqual(["setup", "detail"]);
      expect(notes[1].subjects).toEqual(["docker"]);
    });

    it("matches notes by slug on re-import and recomputes toc on change", async () => {
      await run();
      expect(await run()).toMatchObject({ creates: 0, updates: 0, unchanged: 2 });

      files[1] = { name: "02-next.md", content: md("# Next steps", "", "## Part B", "", "Text.") };
      const report = await run();
      expect(report).toMatchObject({ creates: 0, updates: 1, unchanged: 1 });
      expect(report.items.find((i) => i.action === "update")!.fields).toEqual(["body", "toc"]);
      const next = await Note.findOne({ slug: "next" }).lean<{ toc: { anchor: string }[] }>();
      expect(next!.toc.map((t) => t.anchor)).toEqual(["part-b"]);
      expect(await Revision.countDocuments()).toBe(1);
    });

    it("a chapter without an H1 title is an error and nothing is written", async () => {
      const report = await runImport({
        target: { kind: "series", slug: "s" },
        source: { kind: "series", files: [{ name: "01-a.md", content: "No title here." }] },
        dryRun: false,
        editedBy,
        title: "Series",
      });
      expect(report.errors.join("\n")).toMatch(/title/);
      expect(await counts()).toMatchObject({ series: 0, notes: 0 });
    });
  });

  describe("graph", () => {
    const commit = (nodes: unknown[]) =>
      runImport({ target: graphTarget, source: graph(nodes), dryRun: false, editedBy, title: "G" });

    it("creates nodes and resolves prerequisite slugs to ids, including to new nodes", async () => {
      const report = await commit([node("a", "core", []), node("b", "adv", ["a"])]);

      expect(report).toMatchObject({ createdTarget: true, creates: 2, errors: [] });
      const saved = await Graph.findOne({ slug: "g" }).lean<{ tracks: { key: string }[] }>();
      expect(saved!.tracks.map((t) => t.key)).toEqual(["core", "adv"]);
      const a = await GraphNode.findOne({ slug: "a" }).lean<{ _id: unknown }>();
      const b = await GraphNode.findOne({ slug: "b" }).lean<{ prereqIds: unknown[]; order: number }>();
      expect(b!.prereqIds.map(String)).toEqual([String(a!._id)]);
      expect(b!.order).toBe(2);
    });

    it("a fragment may reference existing nodes as prerequisites", async () => {
      await commit([node("a", "core", []), node("b", "adv", ["a"])]);
      const report = await commit([node("c", "adv", ["b"])]);

      expect(report).toMatchObject({ creates: 1, errors: [] });
      const b = await GraphNode.findOne({ slug: "b" }).lean<{ _id: unknown }>();
      const c = await GraphNode.findOne({ slug: "c" }).lean<{ prereqIds: unknown[]; order: number }>();
      expect(c!.prereqIds.map(String)).toEqual([String(b!._id)]);
      expect(c!.order).toBe(3);
    });

    it("an incoming prerequisite that closes a cycle with existing nodes is an error and writes nothing", async () => {
      await commit([node("a", "core", []), node("b", "adv", ["a"])]);
      const before = await counts();
      const report = await commit([node("a", "core", ["b"])]);

      expect(report.errors.join("\n")).toMatch(/cycle/);
      expect(await counts()).toEqual(before);
      const a = await GraphNode.findOne({ slug: "a" }).lean<{ prereqIds: unknown[] }>();
      expect(a!.prereqIds).toEqual([]);
    });

    it("an unresolved prerequisite slug is an error", async () => {
      const report = await commit([node("a", "core", ["ghost"])]);
      expect(report.errors.join("\n")).toMatch(/unknown prerequisite ghost/);
      expect(await counts()).toMatchObject({ graphs: 0, nodes: 0 });
    });

    it("node validation errors block the import", async () => {
      const report = await commit([node("a", "core", [], { u: "http://insecure" })]);
      expect(report.errors.join("\n")).toMatch(/https/);
      expect(await counts()).toMatchObject({ graphs: 0, nodes: 0 });
    });

    it("updates only changed node fields", async () => {
      await commit([node("a", "core", []), node("b", "adv", ["a"])]);
      const report = await commit([node("a", "core", []), node("b", "adv", [], { s: "New summary" })]);

      expect(report).toMatchObject({ updates: 1, unchanged: 1 });
      expect(report.items.find((i) => i.action === "update")).toMatchObject({ key: "b", fields: ["summary", "prereqIds"] });
    });
  });

  it("refuses to commit over an item edited after the plan was made", async () => {
    await commitBook();
    const changed = BOOK.replace("X is a thing.", "X is a changed thing.");
    // The edit lands between planning (reads) and the commit transaction.
    const startSession = mongoose.startSession.bind(mongoose);
    const spy = vi.spyOn(mongoose, "startSession").mockImplementationOnce(async (...args) => {
      await Question.updateOne({ question: "What is X?" }, { $set: { answer: "Edited by an admin." } });
      return startSession(...args);
    });

    const report = await commitBook(changed);
    spy.mockRestore();
    expect(report.errors).toEqual([expect.stringContaining("edited since this import was planned")]);
    expect((await Question.findOne({ question: "What is X?" }).lean<{ answer: string }>())?.answer).toBe("Edited by an admin.");
  });
});
