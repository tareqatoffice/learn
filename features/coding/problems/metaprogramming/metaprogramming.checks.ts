/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
import { check, eq } from "../harness";
import type { Group } from "../harness";
import { negativeArray, observable, parseLogLine, Range, weakMemoize } from "./metaprogramming";

export const metaprogramming: Group = {
  slug: "metaprogramming",
  title: "Metaprogramming",
  level: "Advanced",
  questions: [
    {
      name: "observable",
      checks: [
        eq("Reports a change", () => {
          const log: unknown[] = [];
          const state = observable({ a: 1 }, (...change) => log.push(change));
          state.a = 2;
          return log;
        }, [["a", 2, 1]]),
        eq("Writes to the target", () => {
          const target = { a: 1 };
          observable(target, () => {}).a = 5;
          return target.a;
        }, 5),
        eq("Skips an unchanged value", () => {
          let calls = 0;
          const state = observable({ a: 1 }, () => calls++);
          state.a = 1;
          return calls;
        }, 0),
      ],
    },
    {
      name: "negativeArray",
      checks: [
        eq("Reads from the end", () => negativeArray([1, 2, 3])[-1], 3),
        eq("Keeps normal indexes", () => negativeArray([1, 2])[0], 1),
        eq("Keeps array methods", () => negativeArray([1, 2]).map((n) => n * 2), [2, 4]),
        check("Copies the input", () => {
          const input = [1];
          negativeArray(input).push(2);
          return input.length === 1 || "input changed";
        }),
      ],
    },
    {
      name: "Range",
      checks: [
        eq("Spreads into an array", () => [...new Range(0, 3)], [0, 1, 2]),
        eq("Uses a step", () => [...new Range(0, 7, 3)], [0, 3, 6]),
        eq("Can be iterated twice", () => {
          const range = new Range(1, 3);
          return [[...range], [...range]];
        }, [[1, 2], [1, 2]]),
      ],
    },
    {
      name: "weakMemoize",
      checks: [
        eq("Calls fn once per key", () => {
          let calls = 0;
          const fn = weakMemoize((_key: object) => ++calls);
          const key = {};
          return [fn(key), fn(key), fn({})];
        }, [1, 1, 2]),
        eq("Caches an undefined result", () => {
          let calls = 0;
          const fn = weakMemoize((_key: object) => {
            calls++;
            return undefined;
          });
          const key = {};
          fn(key);
          fn(key);
          return calls;
        }, 1),
      ],
    },
    {
      name: "parseLogLine",
      checks: [
        eq("Parses a line", () => parseLogLine("2026-01-31 12:00:05 [ERROR] disk full"), {
          date: "2026-01-31",
          time: "12:00:05",
          level: "ERROR",
          message: "disk full",
        }),
        eq("Returns null for other text", () => parseLogLine("nothing here"), null),
      ],
    },
  ],
};
