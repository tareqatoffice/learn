import { wait } from "../harness";
import { check, eq, throws } from "../harness";
import type { Group } from "../harness";
import { TimeoutError, debounce, sleep, throttle, withTimeout } from "./timing";

export const timing: Group = {
  slug: "timing",
  title: "Timing",
  level: "Intermediate",
  questions: [
    {
      name: "debounce",
      checks: [
        check("Runs once with the latest arguments", async () => {
          const seen: number[] = [];
          const fn = debounce((n: number) => seen.push(n), 20);
          fn(1);
          fn(2);
          await wait(60);
          return seen.join() === "2" || `got [${seen.join()}]`;
        }),
        check("Each call restarts the wait", async () => {
          const calls: number[] = [];
          const fn = debounce(() => calls.push(1), 40);
          fn();
          await wait(20);
          fn();
          await wait(25);
          if (calls.length > 0) return "ran too early";
          await wait(50);
          return calls.length === 1 || `expected 1 call, got ${calls.length}`;
        }),
        check("cancel drops the pending run", async () => {
          const calls: number[] = [];
          const fn = debounce(() => calls.push(1), 10);
          fn();
          fn.cancel();
          await wait(40);
          return calls.length === 0 || "ran after cancel";
        }),
      ],
    },
    {
      name: "throttle",
      checks: [
        check("Runs at once on the first call", () => {
          const calls: number[] = [];
          throttle(() => calls.push(1), 50)();
          return calls.length === 1 || "did not run";
        }),
        check("Ignores calls inside the window", () => {
          const calls: number[] = [];
          const fn = throttle(() => calls.push(1), 50);
          fn();
          fn();
          fn();
          return calls.length === 1 || `expected 1 call, got ${calls.length}`;
        }),
        check("Runs again after the window", async () => {
          const calls: number[] = [];
          const fn = throttle(() => calls.push(1), 20);
          fn();
          await wait(40);
          fn();
          return calls.length === 2 || `expected 2 calls, got ${calls.length}`;
        }),
      ],
    },
    {
      name: "sleep",
      checks: [
        check("Waits at least ms", async () => {
          const start = Date.now();
          await sleep(30);
          return Date.now() - start >= 27 || "resolved early";
        }),
        throws("Rejects when already aborted", () => sleep(1000, AbortSignal.abort(new Error("stop")))),
        check("Rejects with the abort reason", async () => {
          const reason = new Error("stop");
          const controller = new AbortController();
          const promise = sleep(1000, controller.signal);
          controller.abort(reason);
          try {
            await promise;
          } catch (err: unknown) {
            return err === reason || "wrong reason";
          }
          return "expected a rejection";
        }),
      ],
    },
    {
      name: "withTimeout",
      checks: [
        eq("Resolves when in time", () => withTimeout(Promise.resolve("ok"), 50), "ok"),
        throws("Rejects with a TimeoutError", () => withTimeout(wait(200), 10), TimeoutError),
        throws("Passes on the promise's rejection", () => {
          const rejected = Promise.reject(new RangeError("no"));
          rejected.catch(() => undefined);
          return withTimeout(rejected, 50);
        }, RangeError),
      ],
    },
  ],
};
