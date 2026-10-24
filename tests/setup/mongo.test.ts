import mongoose from "mongoose";
import { afterAll, describe, expect, it } from "vitest";
import { resetDb } from "./mongo";

describe("mongo test setup", () => {
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("exposes a replica-set MONGODB_URI so transactions work", async () => {
    expect(process.env.MONGODB_URI).toMatch(/^mongodb:\/\//);
    await mongoose.connect(process.env.MONGODB_URI!);
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await mongoose.connection.collection("probe").insertOne({ a: 1 }, { session });
    });
    await session.endSession();
    expect(await mongoose.connection.collection("probe").countDocuments({ a: 1 })).toBe(1);
  });

  it("resetDb empties collections but keeps them usable", async () => {
    await mongoose.connection.collection("probe").insertOne({ a: 2 });
    await resetDb();
    expect(await mongoose.connection.collection("probe").countDocuments()).toBe(0);
  });
});
