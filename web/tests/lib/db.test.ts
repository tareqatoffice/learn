import mongoose from "mongoose";
import { afterAll, describe, expect, it } from "vitest";
import { connectDb, inTransaction } from "@/lib/db";
import { Subject } from "@/models";
import { resetDb } from "../setup/mongo";

afterAll(() => mongoose.disconnect());

describe("connectDb", () => {
  it("shares one connect between concurrent callers", () => {
    const first = connectDb();
    expect(connectDb()).toBe(first);
    return first;
  });

  it("connects again after an explicit close", async () => {
    await connectDb();
    await mongoose.disconnect();
    expect(mongoose.connection.readyState).toBe(0);
    await connectDb();
    expect(mongoose.connection.readyState).toBe(1);
  });
});

describe("inTransaction", () => {
  it("returns the work's result and rolls back every write when it throws", async () => {
    await connectDb();
    await resetDb();
    expect(await inTransaction(async (session) => (await Subject.create([{ slug: "a", name: "A" }], { session }))[0].slug)).toBe("a");
    await expect(
      inTransaction(async (session) => {
        await Subject.create([{ slug: "b", name: "B" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await Subject.distinct("slug")).toEqual(["a"]);
  });
});
