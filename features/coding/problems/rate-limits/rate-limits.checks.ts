import { wait } from "../harness";
import { check, eq } from "../harness";
import type { Group } from "../harness";
import { Mutex, Semaphore, SlidingWindow, TokenBucket } from "./rate-limits";

export const rateLimits: Group = {
  slug: "rate-limits",
  title: "Rate limiting and locks",
  level: "Advanced",
  questions: [
    {
      name: "TokenBucket",
      checks: [
        eq("Starts full, then denies", () => {
          const b = new TokenBucket({ capacity: 2, refillPerSecond: 1, now: () => 0 });
          return [b.tryTake(), b.tryTake(), b.tryTake()];
        }, [true, true, false]),
        eq("Refills over time", () => {
          let time = 0;
          const b = new TokenBucket({ capacity: 1, refillPerSecond: 2, now: () => time });
          b.tryTake();
          time = 500;
          return b.tryTake();
        }, true),
        eq("Never exceeds capacity", () => {
          let time = 0;
          const b = new TokenBucket({ capacity: 1, refillPerSecond: 10, now: () => time });
          time = 10_000;
          return [b.tryTake(), b.tryTake()];
        }, [true, false]),
      ],
    },
    {
      name: "SlidingWindow",
      checks: [
        eq("Stops at the limit", () => {
          const w = new SlidingWindow({ limit: 2, windowMs: 100, now: () => 0 });
          return [w.allow(), w.allow(), w.allow()];
        }, [true, true, false]),
        eq("Frees at exactly windowMs", () => {
          let time = 0;
          const w = new SlidingWindow({ limit: 1, windowMs: 100, now: () => time });
          w.allow();
          time = 99;
          const early = w.allow();
          time = 100;
          return [early, w.allow()];
        }, [false, true]),
        eq("Denied calls do not count", () => {
          let time = 0;
          const w = new SlidingWindow({ limit: 1, windowMs: 100, now: () => time });
          w.allow();
          time = 50;
          w.allow();
          time = 100;
          return w.allow();
        }, true),
      ],
    },
    {
      name: "Semaphore",
      checks: [
        check("Grants up to its permits", async () => {
          const s = new Semaphore(2);
          await s.acquire();
          await s.acquire();
          return true;
        }),
        check("Blocks until release", async () => {
          const s = new Semaphore(1);
          await s.acquire();
          let got = false;
          const next = s.acquire().then(() => {
            got = true;
          });
          await wait(10);
          if (got) return "acquired too early";
          s.release();
          await next;
          return true;
        }),
        eq("Serves in order", async () => {
          const s = new Semaphore(1);
          const seen: number[] = [];
          await s.acquire();
          const waiting = [1, 2].map((n) => s.acquire().then(() => seen.push(n)));
          s.release();
          await wait(5);
          s.release();
          await Promise.all(waiting);
          return seen;
        }, [1, 2]),
      ],
    },
    {
      name: "Mutex",
      checks: [
        check("Runs one at a time", async () => {
          const m = new Mutex();
          let active = 0;
          let peak = 0;
          const task = async (): Promise<void> => {
            peak = Math.max(peak, ++active);
            await wait(5);
            active--;
          };
          await Promise.all([m.run(task), m.run(task), m.run(task)]);
          return peak === 1 || `${peak} ran at once`;
        }),
        eq("Returns the task's value", () => new Mutex().run(async () => 5), 5),
        eq("A failure does not block", async () => {
          const m = new Mutex();
          const failed = m.run(() => Promise.reject(new Error("x"))).catch(() => "caught");
          return [await failed, await m.run(async () => "next")];
        }, ["caught", "next"]),
      ],
    },
  ],
};
