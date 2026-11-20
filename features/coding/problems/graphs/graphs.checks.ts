import { components, hasCycle, shortestPath, topoSort } from "./graphs";
import { check, eq, throws } from "../harness";
import type { Group } from "../harness";

export const graphs: Group = {
  slug: "graphs",
  title: "Graphs",
  level: "Advanced",
  questions: [
    {
      name: "shortestPath",
      checks: [
        eq("Finds the fewest edges", () => shortestPath({ a: ["b", "c"], b: ["d"], c: ["e"], d: ["e"] }, "a", "e"), ["a", "c", "e"]),
        eq("Returns null when unreachable", () => shortestPath({ a: [], b: ["a"] }, "a", "b"), null),
        eq("A node reaches itself", () => shortestPath({ a: [] }, "a", "a"), ["a"]),
      ],
    },
    {
      name: "topoSort",
      checks: [
        check("Orders dependencies", () => {
          const order = topoSort({ a: ["b"], b: ["c"], c: [] });
          return order.join() === "a,b,c" || `got ${order.join()}`;
        }),
        eq("Includes leaf-only nodes", () => topoSort({ a: ["b"] }).sort(), ["a", "b"]),
        throws("Throws on a cycle", () => topoSort({ a: ["b"], b: ["a"] })),
      ],
    },
    {
      name: "hasCycle",
      checks: [
        eq("Detects a cycle", () => hasCycle({ a: ["b"], b: ["c"], c: ["a"] }), true),
        eq("A diamond is not a cycle", () => hasCycle({ a: ["b", "c"], b: ["d"], c: ["d"], d: [] }), false),
        eq("Detects a self-loop", () => hasCycle({ a: ["a"] }), true),
      ],
    },
    {
      name: "components",
      checks: [
        eq("Splits groups", () => components({ a: ["b"], c: ["d"] }), [["a", "b"], ["c", "d"]]),
        eq("Ignores direction", () => components({ a: ["c"], b: ["c"] }), [["a", "b", "c"]]),
        eq("Keeps isolated nodes", () => components({ a: [] }), [["a"]]),
      ],
    },
  ],
};
