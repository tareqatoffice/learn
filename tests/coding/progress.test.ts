import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: async () => (await import("../setup/session")).approvedSession(session.userId),
}));

import { saveCodingResultsAction } from "@/app/(app)/coding/actions";
import { getCodingProgress, saveCodingResults } from "@/features/coding/progress";
import { connectDb } from "@/lib/db";
import { CodingResult } from "@/models";
import { resetDb } from "../setup/mongo";

const id = () => String(new Types.ObjectId());
const pass = { name: "works", passed: true, detail: "" };
const fail = { name: "edge case", passed: false, detail: "expected 1, got 2" };

describe("coding progress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    session.userId = id();
  });
  afterAll(() => mongoose.disconnect());

  it("keeps only the last run of each question, per user", async () => {
    const user = id();
    await saveCodingResults(user, "classics", [{ question: "retry", checks: [fail] }]);
    await saveCodingResults(user, "classics", [
      { question: "retry", checks: [pass, fail] },
      { question: "groupBy", checks: [pass] },
    ]);
    await saveCodingResults(id(), "classics", [{ question: "retry", checks: [pass] }]);

    expect(await getCodingProgress(user)).toEqual({ classics: { retry: [pass, fail], groupBy: [pass] } });
    expect(await getCodingProgress(user, "arrays")).toEqual({});
    const doc = await CodingResult.findOne({ userId: user, question: "retry" }).lean<{ passed: number; total: number }>();
    expect(doc).toMatchObject({ passed: 1, total: 2 });
  });

  it("saves the signed-in user's run from the action", async () => {
    const result = await saveCodingResultsAction({ group: "classics", results: [{ question: "retry", checks: [pass] }] });
    expect(result).toEqual({ ok: true });
    expect(await getCodingProgress(session.userId!)).toEqual({ classics: { retry: [pass] } });
  });

  it.each([
    ["a malformed group", { group: "../classics", results: [{ question: "retry", checks: [pass] }] }],
    ["an unknown group", { group: "nope", results: [{ question: "retry", checks: [pass] }] }],
    ["an unknown question", { group: "classics", results: [{ question: "made-up", checks: [pass] }] }],
    ["an empty run", { group: "classics", results: [] }],
  ])("rejects %s without saving anything", async (_label, input) => {
    expect((await saveCodingResultsAction(input)).ok).toBe(false);
    expect(await CodingResult.countDocuments()).toBe(0);
  });
});
