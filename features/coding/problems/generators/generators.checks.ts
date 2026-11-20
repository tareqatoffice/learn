import { batched, collectAsync, mapIter, naturals, take } from "./generators";
import { check, eq } from "../harness";
import type { Group } from "../harness";

export const generators: Group = {
  slug: "generators",
  title: "Generators",
  level: "Intermediate",
  questions: [
    {
      name: "naturals",
      checks: [
        check("Starts at 1", () => naturals().next().value === 1 || "wrong first value"),
        eq("Counts up", () => {
          const source = naturals();
          return [source.next().value, source.next().value, source.next().value];
        }, [1, 2, 3]),
        eq("Never ends", () => {
          const source = naturals();
          for (let i = 0; i < 1000; i++) source.next();
          return source.next().done;
        }, false),
      ],
    },
    {
      name: "take",
      checks: [
        eq("Takes from an array", () => [...take([1, 2, 3], 2)], [1, 2]),
        eq("Handles a shorter source", () => [...take([1], 5)], [1]),
        check("Does not read past count", () => {
          let pulled = 0;
          function* source(): Generator<number> {
            for (;;) yield ++pulled;
          }
          Array.from(take(source(), 2));
          return pulled === 2 || `read ${pulled} items`;
        }),
      ],
    },
    {
      name: "mapIter",
      checks: [
        eq("Maps items", () => [...mapIter([1, 2], (n) => n * 2)], [2, 4]),
        eq("Handles an empty source", () => [...mapIter([], (n) => n)], []),
        check("Is lazy", () => {
          let calls = 0;
          const mapped = mapIter(naturals(), (n) => {
            calls++;
            return n;
          });
          mapped.next();
          return calls === 1 || `called ${calls} times`;
        }),
      ],
    },
    {
      name: "batched",
      checks: [
        eq("Groups items", () => [...batched([1, 2, 3, 4], 2)], [[1, 2], [3, 4]]),
        eq("Keeps a short last batch", () => [...batched([1, 2, 3], 2)], [[1, 2], [3]]),
        eq("Works on endless sources", () => batched(naturals(), 2).next().value, [1, 2]),
      ],
    },
    {
      name: "collectAsync",
      checks: [
        eq("Collects items", () => {
          async function* source(): AsyncGenerator<number> {
            yield 1;
            yield 2;
          }
          return collectAsync(source());
        }, [1, 2]),
        eq("Handles an empty source", () => {
          async function* source(): AsyncGenerator<number> {}
          return collectAsync(source());
        }, []),
        check("Rejects when the source throws", async () => {
          async function* source(): AsyncGenerator<number> {
            yield 1;
            throw new Error("x");
          }
          try {
            await collectAsync(source());
          } catch (err: unknown) {
            return (err instanceof Error && err.message === "x") || "wrong error";
          }
          return "expected a rejection";
        }),
      ],
    },
  ],
};
