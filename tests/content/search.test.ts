import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { searchContent } from "@/content/queries/search";
import { connectDb } from "@/lib/db";
import { Question } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedBook, seedGraph, seedQuestions, seedSeries } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

describe("searchContent (F17)", () => {
  it("finds books, graphs and series by title, published only", async () => {
    await seedBook("react");
    await seedBook("reactdraft", "draft");
    await seedGraph("react");
    await seedSeries("react");
    const hits = await searchContent("react title");
    expect(hits.map((h) => [h.kind, h.href]).sort()).toEqual(
      [
        ["book", "/interview/react"],
        ["graph", "/graphs/react"],
        ["series", "/notes/react"],
      ].sort(),
    );
  });

  it("ranks a title starting with the term ahead of others before the per-kind limit", async () => {
    const book = await seedBook("js");
    const ids = await seedQuestions(book, 12);
    await Promise.all(ids.map((id, i) => Question.updateOne({ _id: id }, { $set: { question: i === 11 ? "Closure basics" : `What is a closure ${i}` } })));
    const hits = (await searchContent("closure")).filter((h) => h.kind === "question");
    expect(hits).toHaveLength(6);
    expect(hits[0].title).toBe("Closure basics");
  });
});
