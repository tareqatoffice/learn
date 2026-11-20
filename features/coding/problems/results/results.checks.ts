import { eq } from "../harness";
import type { Group } from "../harness";
import { andThen, collectResults, err, mapResult, ok, tryAsync, unwrapOr } from "./results";
import type { Result } from "./results";

const success: Result<number, string> = ok(2);
const failure: Result<number, string> = err("bad");
const half = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n / 2) : err("odd"));

export const results: Group = {
  slug: "results",
  title: "Result types",
  level: "Intermediate",
  questions: [
    {
      name: "mapResult",
      checks: [
        eq("Maps a success", () => mapResult(success, (n) => n * 2), { ok: true, value: 4 }),
        eq("Passes a failure", () => mapResult(failure, (n) => n * 2), { ok: false, error: "bad" }),
        eq("Can change the type", () => mapResult(success, String), { ok: true, value: "2" }),
      ],
    },
    {
      name: "andThen",
      checks: [
        eq("Chains a success", () => andThen(success, half), { ok: true, value: 1 }),
        eq("Returns the step's failure", () => andThen(ok(3), half), { ok: false, error: "odd" }),
        eq("Skips after a failure", () => andThen(failure, half), { ok: false, error: "bad" }),
      ],
    },
    {
      name: "unwrapOr",
      checks: [
        eq("Returns the value", () => unwrapOr(success, 9), 2),
        eq("Returns the fallback", () => unwrapOr(failure, 9), 9),
        eq("Keeps falsy values", () => unwrapOr(ok(0), 9), 0),
      ],
    },
    {
      name: "tryAsync",
      checks: [
        eq("Wraps a value", () => tryAsync(async () => 1), { ok: true, value: 1 }),
        eq("Wraps a rejection", () => tryAsync(() => Promise.reject("x")), { ok: false, error: "x" }),
        eq("Wraps a synchronous throw", async () => {
          const fail = (): Promise<number> => {
            throw "x";
          };
          return tryAsync(fail);
        }, { ok: false, error: "x" }),
      ],
    },
    {
      name: "collectResults",
      checks: [
        eq("Collects values", () => collectResults([ok(1), ok(2)]), { ok: true, value: [1, 2] }),
        eq("Returns the first failure", () => collectResults<number, string>([ok(1), err("a"), err("b")]), { ok: false, error: "a" }),
        eq("Handles an empty list", () => collectResults([]), { ok: true, value: [] }),
      ],
    },
  ],
};
