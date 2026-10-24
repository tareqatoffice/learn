import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQuestion } from "@/admin/service";
import { restoreRevisionAction } from "@/app/(app)/admin/revisions/actions";
import { listRevisions } from "@/content/revisions";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { Question } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedBook, seedQuestions } from "../progress/seed";

const ADMIN = "owner@example.test";
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "64b000000000000000000001", email: "owner@example.test", name: "Owner" } }),
}));

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});
afterAll(() => mongoose.disconnect());

describe("restoreRevisionAction", () => {
  it("puts the old text back and records the restore as a revision", async () => {
    const book = await seedBook("js");
    const [q] = await seedQuestions(book, 1);
    const input = { id: q, bookId: book, partKey: "p1", question: "Q", prompt: "", answer: "first", subjects: [], status: "published" as const };
    await saveQuestion(input, ADMIN);
    await saveQuestion({ ...input, answer: "second" }, ADMIN);

    const [, oldest] = await listRevisions("Question", q);
    const result = await restoreRevisionAction(oldest.id);
    expect(result).toEqual({ ok: true, id: q });
    expect((await Question.findById(q).lean<{ answer: string }>())?.answer).toBe("answer 0");
    const after = await listRevisions("Question", q);
    expect(after).toHaveLength(3);
    expect(after[0].editedBy).toBe(ADMIN);
  });

  it("reports an unknown revision instead of throwing", async () => {
    expect(await restoreRevisionAction("64b0000000000000000000ff")).toMatchObject({ ok: false });
  });
});
