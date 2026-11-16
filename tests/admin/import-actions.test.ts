import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/import/route";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { Question, QuestionBook } from "@/models";
import { resetDb } from "../setup/mongo";

const session = vi.hoisted(() => ({ email: "owner@example.test" }));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "64b000000000000000000001", email: session.email, name: "Owner" } }),
}));

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  session.email = "owner@example.test";
  vi.stubEnv("ADMIN_EMAILS", "owner@example.test");
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});
afterAll(() => mongoose.disconnect());

const BOOK = {
  target: { kind: "book", slug: "new-book" },
  title: "New Book",
  subjects: ["react", "frontend"],
  publish: true,
  source: { kind: "book", markdown: "# Part 1 — Basics\n\n## Q1. What is Z?\n\nZ." },
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }));

describe("POST /api/admin/import (S7)", () => {
  it("commits with dryRun false and gives a new target the chosen subjects", async () => {
    const res = await post({ input: BOOK, dryRun: false });
    expect(res.status).toBe(200);
    expect((await res.json()).errors).toEqual([]);
    expect((await QuestionBook.findOne({ slug: "new-book" }).lean<{ subjects: string[] }>())?.subjects).toEqual(["react", "frontend"]);
    expect((await Question.findOne({}).lean<{ subjects: string[] }>())?.subjects).toEqual(["react", "frontend"]);
  });

  it("previews by default and writes nothing", async () => {
    const res = await post({ input: BOOK });
    expect((await res.json()).dryRun).toBe(true);
    expect(await QuestionBook.countDocuments()).toBe(0);
  });

  it("refuses non-admins, bodies over the limit (S9) and bad input", async () => {
    session.email = "someone@example.test";
    expect((await post({ input: BOOK })).status).toBe(403);
    session.email = "owner@example.test";
    expect((await post({ input: BOOK }, { "Content-Length": String(20_000_000) })).status).toBe(413);
    expect((await post({ input: { ...BOOK, target: { kind: "series", slug: "x" } } })).status).toBe(400);
  });
});
