import { wait } from "../harness";
import { createBatcher, pollUntil, series, waterfall } from "./async-flow";
import { check, eq, throws } from "../harness";
import type { Group } from "../harness";

export const asyncFlow: Group = {
  slug: "async-flow",
  title: "Async flow",
  level: "Advanced",
  questions: [
    {
      name: "series",
      checks: [
        check("Runs one at a time", async () => {
          let active = 0;
          let peak = 0;
          const task = async (): Promise<number> => {
            peak = Math.max(peak, ++active);
            await wait(5);
            active--;
            return peak;
          };
          await series([task, task, task]);
          return peak === 1 || `${peak} ran at once`;
        }),
        eq("Returns results in order", () => series([async () => 1, async () => 2]), [1, 2]),
        check("Stops at the first rejection", async () => {
          const ran: string[] = [];
          const failing = async (): Promise<number> => {
            ran.push("failing");
            throw new Error("x");
          };
          const after = async (): Promise<number> => {
            ran.push("after");
            return 1;
          };
          await series([failing, after]).catch(() => undefined);
          return ran.join() === "failing" || `ran [${ran.join()}]`;
        }),
      ],
    },
    {
      name: "waterfall",
      checks: [
        eq("Feeds each result forward", () => waterfall(1, [async (n) => n + 1, async (n) => n * 3]), 6),
        eq("Returns initial with no steps", () => waterfall(5, []), 5),
        throws("Rejects when a step rejects", () => waterfall(1, [() => Promise.reject(new Error("x"))])),
      ],
    },
    {
      name: "pollUntil",
      checks: [
        eq("Resolves right away when ready", () => pollUntil(async () => "ok", { intervalMs: 5, timeoutMs: 50 }), "ok"),
        check("Keeps polling until ready", async () => {
          let calls = 0;
          const value = await pollUntil(async () => (++calls === 3 ? calls : null), { intervalMs: 5, timeoutMs: 500 });
          return value === 3 || `got ${value}`;
        }),
        throws("Rejects after the timeout", () => pollUntil(async () => null, { intervalMs: 5, timeoutMs: 20 })),
      ],
    },
    {
      name: "createBatcher",
      checks: [
        check("Batches one tick into one load", async () => {
          let loads = 0;
          const get = createBatcher(async (keys: number[]) => {
            loads++;
            return keys.map((k) => k * 2);
          });
          const values = await Promise.all([get(1), get(2)]);
          if (loads !== 1) return `expected 1 load, got ${loads}`;
          return values.join() === "2,4" || `got ${values.join()}`;
        }),
        check("Dedupes keys", async () => {
          let seen: number[] = [];
          const get = createBatcher(async (keys: number[]) => {
            seen = keys;
            return keys;
          });
          await Promise.all([get(1), get(1)]);
          return seen.length === 1 || `load got ${seen.length} keys`;
        }),
        check("Starts a new batch next tick", async () => {
          let loads = 0;
          const get = createBatcher(async (keys: number[]) => {
            loads++;
            return keys;
          });
          await get(1);
          await get(2);
          return loads === 2 || `expected 2 loads, got ${loads}`;
        }),
        check("Rejects every caller when load fails", async () => {
          const get = createBatcher<number, number>(() => Promise.reject(new Error("x")));
          const results = await Promise.allSettled([get(1), get(2)]);
          return results.every((r) => r.status === "rejected") || "a caller resolved";
        }),
      ],
    },
  ],
};
