import { wait } from "../harness";
import { LFUCache, TtlMap, memoizeAsync, staleWhileRevalidate } from "./caching";
import { eq } from "../harness";
import type { Group } from "../harness";

export const caching: Group = {
  slug: "caching",
  title: "Caching",
  level: "Advanced",
  questions: [
    {
      name: "LFUCache",
      checks: [
        eq("Evicts the least used", () => {
          const c = new LFUCache<string, number>(2);
          c.set("a", 1);
          c.set("b", 2);
          c.get("a");
          c.set("c", 3);
          return [c.has("a"), c.has("b"), c.has("c")];
        }, [true, false, true]),
        eq("Ties evict the oldest", () => {
          const c = new LFUCache<string, number>(2);
          c.set("a", 1);
          c.set("b", 2);
          c.set("c", 3);
          return c.has("a");
        }, false),
        eq("Updating evicts nothing", () => {
          const c = new LFUCache<string, number>(1);
          c.set("a", 1);
          c.set("a", 2);
          return c.get("a");
        }, 2),
      ],
    },
    {
      name: "memoizeAsync",
      checks: [
        eq("Shares in-flight calls", async () => {
          let calls = 0;
          const fn = memoizeAsync(async (n: number) => {
            calls++;
            await wait(5);
            return n;
          });
          await Promise.all([fn(1), fn(1)]);
          return calls;
        }, 1),
        eq("Caches resolved values", async () => {
          let calls = 0;
          const fn = memoizeAsync(async (n: number) => {
            calls++;
            return n;
          });
          await fn(1);
          await fn(1);
          return calls;
        }, 1),
        eq("Does not cache rejections", async () => {
          let calls = 0;
          const fn = memoizeAsync(async (n: number) => {
            if (++calls === 1) throw new Error("x");
            return n;
          });
          await fn(1).catch(() => undefined);
          return fn(1);
        }, 1),
      ],
    },
    {
      name: "TtlMap",
      checks: [
        eq("Reads live entries", () => {
          const m = new TtlMap<string, number>(100, () => 0);
          m.set("a", 0);
          return m.get("a");
        }, 0),
        eq("Expires at ttlMs", () => {
          let time = 0;
          const m = new TtlMap<string, number>(100, () => time);
          m.set("a", 1);
          time = 99;
          const alive = m.get("a");
          time = 100;
          return [alive, m.get("a") === undefined];
        }, [1, true]),
        eq("size skips expired", () => {
          let time = 0;
          const m = new TtlMap<string, number>(100, () => time);
          m.set("a", 1);
          time = 100;
          m.set("b", 2);
          return m.size;
        }, 1),
      ],
    },
    {
      name: "staleWhileRevalidate",
      checks: [
        eq("Awaits the first call", () => staleWhileRevalidate(async () => 1, 100, () => 0)(), 1),
        eq("Fresh values skip fn", async () => {
          let calls = 0;
          const get = staleWhileRevalidate(async () => ++calls, 100, () => 0);
          await get();
          await get();
          return calls;
        }, 1),
        eq("Stale values return, then refresh", async () => {
          let time = 0;
          let calls = 0;
          const get = staleWhileRevalidate(async () => ++calls, 100, () => time);
          await get();
          time = 200;
          const stale = await get();
          await wait(5);
          return [stale, await get()];
        }, [1, 2]),
        eq("A failed refresh keeps the value", async () => {
          let time = 0;
          let calls = 0;
          const get = staleWhileRevalidate(async () => {
            if (++calls === 2) throw new Error("x");
            return calls;
          }, 100, () => time);
          await get();
          time = 200;
          await get();
          await wait(5);
          return get();
        }, 1),
      ],
    },
  ],
};
