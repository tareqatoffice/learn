import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook } from "@/models";
import { isLocalMongoUri, seedDev } from "../../scripts/seed-dev";
import { resetDb } from "../setup/mongo";

beforeEach(async () => {
  await connectDb();
  await resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const published = { status: "published", importedAt: { $ne: null } };

describe("seedDev", () => {
  it("imports published fixtures stamped with importedAt, with related links on the graph", async () => {
    const reports = await seedDev();
    expect(reports.flatMap((r) => r.errors)).toEqual([]);

    expect(await QuestionBook.countDocuments(published)).toBe(2);
    expect(await Question.countDocuments(published)).toBe(5);
    expect(await Question.countDocuments({ prompt: { $ne: "" } })).toBeGreaterThanOrEqual(1);
    expect(await Graph.countDocuments(published)).toBe(1);
    expect(await GraphNode.countDocuments(published)).toBe(6);
    expect(await NoteSeries.countDocuments(published)).toBe(1);
    expect(await Note.countDocuments(published)).toBe(3);

    const closures = await GraphNode.findOne({ slug: "closures" }).lean<{
      related: { questionIds: unknown[]; notes: { anchor: string }[] };
    }>();
    expect(closures!.related.questionIds).toHaveLength(2);
    expect(closures!.related.notes[0].anchor).toBeTruthy();
    expect(await GraphNode.countDocuments({ "related.questionIds.0": { $exists: true } })).toBe(2);
  });

  it("is safe to run twice", async () => {
    await seedDev();
    const second = await seedDev();
    expect(second.flatMap((r) => r.errors)).toEqual([]);
    expect(second.every((r) => r.creates === 0 && r.updates === 0)).toBe(true);
    expect(await Question.countDocuments()).toBe(5);
    expect(await GraphNode.countDocuments({ "related.questionIds.0": { $exists: true } })).toBe(2);
  });

  it("refuses to run in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(seedDev()).rejects.toThrow(/production/);
    expect(await QuestionBook.countDocuments()).toBe(0);
  });

  it("refuses a database that is not local and writes nothing", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb+srv://x.mongodb.net/learn");
    resetEnvCache();
    await expect(seedDev()).rejects.toThrow(/local database/);
    expect(await QuestionBook.countDocuments()).toBe(0);
  });
});

describe("isLocalMongoUri", () => {
  it.each([
    "mongodb://localhost:27017/learn?replicaSet=rs0",
    "mongodb://127.0.0.1:50000/learn_test",
    "mongodb://[::1]:27017/learn",
    "mongodb://user:p%40ss@db.localhost/learn",
    "mongodb://localhost:27017,127.0.0.1:27018/learn",
  ])("accepts %s", (uri) => expect(isLocalMongoUri(uri)).toBe(true));

  it.each([
    "mongodb+srv://x.mongodb.net/learn",
    "mongodb://db.example.com:27017/learn",
    "mongodb://localhost:27017,db.example.com:27017/learn",
    "mongodb://localhost@evil.com/learn",
    "mongodb://notlocalhost/learn",
    "",
  ])("rejects %s", (uri) => expect(isLocalMongoUri(uri)).toBe(false));
});
