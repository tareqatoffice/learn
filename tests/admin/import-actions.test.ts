import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { commitImportAction } from "@/app/(app)/admin/import/actions";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { Question, QuestionBook } from "@/models";
import { resetDb } from "../setup/mongo";

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "64b000000000000000000001", email: "owner@example.test", name: "Owner" } }),
}));

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("ADMIN_EMAILS", "owner@example.test");
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});
afterAll(() => mongoose.disconnect());

describe("commitImportAction", () => {
  it("gives a new target the chosen subjects, inherited by its items", async () => {
    const report = await commitImportAction({
      target: { kind: "book", slug: "new-book" },
      title: "New Book",
      subjects: ["react", "frontend"],
      publish: true,
      source: { kind: "book", markdown: "# Part 1 — Basics\n\n## Q1. What is Z?\n\nZ." },
    });
    expect("error" in report ? report.error : report.errors).toEqual([]);
    expect((await QuestionBook.findOne({ slug: "new-book" }).lean<{ subjects: string[] }>())?.subjects).toEqual(["react", "frontend"]);
    expect((await Question.findOne({}).lean<{ subjects: string[] }>())?.subjects).toEqual(["react", "frontend"]);
  });
});
