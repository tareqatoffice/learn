/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
import { compose, memoize, once, partial, pipe } from "./functional";
import { check, eq } from "../harness";
import type { Group } from "../harness";

const add1 = (n: number): number => n + 1;
const double = (n: number): number => n * 2;

export const functional: Group = {
  slug: "functional",
  title: "Functional helpers",
  level: "Intermediate",
  questions: [
    {
      name: "compose",
      checks: [
        eq("Runs right to left", () => compose(add1, double)(3), 7),
        eq("Handles one function", () => compose(add1)(1), 2),
        eq("Is identity with no functions", () => compose<number>()(5), 5),
      ],
    },
    {
      name: "pipe",
      checks: [
        eq("Runs left to right", () => pipe(add1, double)(3), 8),
        eq("Handles one function", () => pipe(double)(2), 4),
        eq("Is identity with no functions", () => pipe<number>()(5), 5),
      ],
    },
    {
      name: "partial",
      checks: [
        eq("Fixes one argument", () => partial((a: number, b: number) => a - b, 5)(2), 3),
        eq("Fixes two arguments", () => partial((a: string, b: string, c: string) => a + b + c, "x", "y")("z"), "xyz"),
        eq("Can fix no arguments", () => partial((a: number) => a)(4), 4),
      ],
    },
    {
      name: "once",
      checks: [
        check("Calls fn once and keeps the result", () => {
          let calls = 0;
          const fn = once(() => ++calls);
          fn();
          return (fn() === 1 && calls === 1) || `called ${calls} times`;
        }),
        eq("Passes arguments", () => once((a: number, b: number) => a + b)(1, 2), 3),
        check("Retries after a throw", () => {
          let calls = 0;
          const fn = once(() => {
            calls++;
            if (calls === 1) throw new Error("first");
            return "ok";
          });
          try {
            fn();
          } catch {
            // expected
          }
          return fn() === "ok" || "did not retry";
        }),
      ],
    },
    {
      name: "memoize",
      checks: [
        check("Caches by first argument", () => {
          let calls = 0;
          const fn = memoize((n: number) => {
            calls++;
            return n * 2;
          });
          fn(2);
          fn(2);
          fn(3);
          return calls === 2 || `expected 2 calls, got ${calls}`;
        }),
        check("Caches undefined", () => {
          let calls = 0;
          const fn = memoize((_n: number): undefined => {
            calls++;
          });
          fn(1);
          fn(1);
          return calls === 1 || `expected 1 call, got ${calls}`;
        }),
        check("Uses a custom key", () => {
          let calls = 0;
          const fn = memoize(
            (a: number, b: number) => {
              calls++;
              return a + b;
            },
            (a, b) => `${a}:${b}`,
          );
          fn(1, 2);
          fn(1, 3);
          return calls === 2 || `expected 2 calls, got ${calls}`;
        }),
      ],
    },
  ],
};
