import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { publicMessage } from "@/lib/errors";

describe("publicMessage (S12)", () => {
  it("keeps our own messages and hides database errors behind the fallback", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(publicMessage(new Error("book x was edited since"), "fallback")).toBe("book x was edited since");
    const dup = new mongoose.mongo.MongoServerError({ message: "E11000 duplicate key error collection: learn.notes index: slug_1 dup key" });
    expect(publicMessage(dup, "fallback")).toBe("fallback");
    expect(publicMessage(new mongoose.Error.CastError("ObjectId", "zz", "_id"), "fallback")).toBe("fallback");
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
