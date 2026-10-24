import { describe, expect, it } from "vitest";
import { findCycle } from "@/content/cycles";

describe("findCycle", () => {
  it("finds a 2-node cycle as a closed path", () => {
    expect(findCycle({ a: ["b"], b: ["a"] })).toEqual(["a", "b", "a"]);
  });
  it("finds a 3-node loop", () => {
    expect(findCycle({ a: ["b"], b: ["c"], c: ["a"] })).toEqual(["a", "b", "c", "a"]);
  });
  it("reports only the loop, not the path leading into it", () => {
    expect(findCycle({ x: ["a"], a: ["b"], b: ["a"] })).toEqual(["a", "b", "a"]);
  });
  it("finds a self loop", () => {
    expect(findCycle({ a: ["a"] })).toEqual(["a", "a"]);
  });
  it("returns null for a DAG, including diamonds and unknown prerequisites", () => {
    expect(findCycle({ a: [], b: ["a"], c: ["a"], d: ["b", "c"], e: ["missing"] })).toBeNull();
  });
  it("does not treat inherited object keys as nodes", () => {
    expect(findCycle({ a: ["constructor", "toString"] })).toBeNull();
  });
});
