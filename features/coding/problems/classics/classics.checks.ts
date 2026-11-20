import { groupBy, LRUCache, promisePool, retry } from "./classics";
import { same, wait } from "../harness";
import type { Group } from "../harness";

const TOLERANCE_MS = 3;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

export const classics: Group = {
  slug: "classics",
  title: "Classics",
  level: "Advanced",
  questions: [
    {
      name: "retry",
      checks: [
        {
          name: "Resolves on the first try and calls fn once",
          run: async () => {
            let calls = 0;
            const promise = retry(
              async () => {
                calls++;
                return "ok";
              },
              { retries: 3, baseDelayMs: 10 },
            );
            const result = await settle(promise);
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            if (result.value !== "ok") return `expected "ok", got ${String(result.value)}`;
            return calls === 1 || `expected 1 call, got ${calls}`;
          },
        },
        {
          name: "Succeeds on the third attempt and passes attempts 1, 2, 3",
          run: async () => {
            const attempts: number[] = [];
            const promise = retry(
              async (attempt) => {
                attempts.push(attempt);
                if (attempt < 3) throw new Error(`fail ${attempt}`);
                return "done";
              },
              { retries: 5, baseDelayMs: 10 },
            );
            const result = await settle(promise);
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            if (result.value !== "done") return `expected "done", got ${String(result.value)}`;
            return same(attempts, [1, 2, 3]) || `expected attempts [1,2,3], got ${JSON.stringify(attempts)}`;
          },
        },
        {
          name: "Rejects with the last error after retries + 1 calls",
          run: async () => {
            let calls = 0;
            const promise = retry(
              async () => {
                calls++;
                throw new Error(`fail ${calls}`);
              },
              { retries: 2, baseDelayMs: 10 },
            );
            const result = await settle(promise);
            if (result.ok) return "expected a rejection, but it resolved";
            if (calls !== 3) return `expected 3 calls, got ${calls}`;
            const message = result.error instanceof Error ? result.error.message : String(result.error);
            return message === "fail 3" || `expected the last error "fail 3", got "${message}"`;
          },
        },
        {
          name: "With retries: 0 calls once and rejects with the original error",
          run: async () => {
            let calls = 0;
            const original = new Error("boom");
            const promise = retry(
              async () => {
                calls++;
                throw original;
              },
              { retries: 0, baseDelayMs: 10 },
            );
            const result = await settle(promise);
            if (result.ok) return "expected a rejection, but it resolved";
            if (calls !== 1) return `expected 1 call, got ${calls}`;
            return result.error === original || "did not reject with the original error";
          },
        },
        {
          name: "Delays keep doubling: base, 2x base, 4x base",
          run: async () => {
            const base = 100;
            const times: number[] = [];
            const promise = retry(
              async () => {
                times.push(Date.now());
                throw new Error("fail");
              },
              { retries: 3, baseDelayMs: base },
            );
            await settle(promise);
            if (times.length !== 4) return `expected 4 calls, got ${times.length}`;
            const gaps = [times[1] - times[0], times[2] - times[1], times[3] - times[2]];
            const expected = [base, 2 * base, 4 * base];
            for (let i = 0; i < gaps.length; i++) {
              if (gaps[i] < expected[i] - TOLERANCE_MS) {
                return `gap ${i + 1} was ${gaps[i]} ms, expected at least ${expected[i]} ms (delays should double)`;
              }
              if (gaps[i] > expected[i] + 80) {
                return `gap ${i + 1} was ${gaps[i]} ms, expected about ${expected[i]} ms`;
              }
            }
            return true;
          },
        },
        {
          name: "Already aborted: fn is never called and rejects with signal.reason",
          run: async () => {
            let calls = 0;
            const reason = new Error("stop");
            const controller = new AbortController();
            controller.abort(reason);
            const promise = retry(
              async () => {
                calls++;
                return "ok";
              },
              { retries: 3, baseDelayMs: 10, signal: controller.signal },
            );
            const result = await settle(promise);
            if (calls !== 0) return `fn was called ${calls} time(s)`;
            if (result.ok) return "expected a rejection, but it resolved";
            return result.error === reason || "did not reject with signal.reason";
          },
        },
        {
          name: "Abort during a wait rejects promptly and makes no further call",
          run: async () => {
            let calls = 0;
            const reason = new Error("stop");
            const controller = new AbortController();
            const promise = retry(
              async () => {
                calls++;
                throw new Error("fail");
              },
              { retries: 3, baseDelayMs: 500, signal: controller.signal },
            );
            const settled = settle(promise);
            await wait(50); // first call has failed; retry is now waiting 500 ms
            const abortedAt = Date.now();
            controller.abort(reason);
            const result = await settled;
            const elapsed = Date.now() - abortedAt;
            if (result.ok) return "expected a rejection, but it resolved";
            if (result.error !== reason) return "did not reject with signal.reason";
            if (elapsed > 250) return `took ${elapsed} ms to reject after abort; it should not wait out the delay`;
            await wait(600); // long enough for a leaked timer to fire
            return calls === 1 || `expected 1 call, got ${calls}`;
          },
        },
        {
          name: "Abort while fn is in flight starts no further attempt",
          run: async () => {
            let calls = 0;
            const reason = new Error("stop");
            const controller = new AbortController();
            const promise = retry(
              async () => {
                calls++;
                await wait(40);
                throw new Error("fail");
              },
              { retries: 3, baseDelayMs: 10, signal: controller.signal },
            );
            const settled = settle(promise);
            await wait(10);
            controller.abort(reason);
            const result = await settled;
            if (result.ok) return "expected a rejection, but it resolved";
            await wait(100);
            if (calls !== 1) return `expected 1 call, got ${calls}`;
            return result.error === reason || "did not reject with signal.reason";
          },
        },
        {
          name: "Abort during the last attempt rejects with signal.reason, not fn's error",
          run: async () => {
            const reason = new Error("stop");
            const controller = new AbortController();
            const promise = retry(
              async () => {
                await wait(40);
                throw new Error("fail");
              },
              { retries: 0, baseDelayMs: 10, signal: controller.signal },
            );
            const settled = settle(promise);
            await wait(10);
            controller.abort(reason);
            const result = await settled;
            if (result.ok) return "expected a rejection, but it resolved";
            return result.error === reason || "did not reject with signal.reason";
          },
        },
        {
          name: "Abort wins even when the in-flight attempt then resolves",
          run: async () => {
            const reason = new Error("stop");
            const controller = new AbortController();
            const promise = retry(
              async () => {
                await wait(40);
                return "ok";
              },
              { retries: 3, baseDelayMs: 10, signal: controller.signal },
            );
            const settled = settle(promise);
            await wait(10);
            controller.abort(reason);
            const result = await settled;
            if (result.ok) return "expected a rejection, but it resolved";
            return result.error === reason || "did not reject with signal.reason";
          },
        },
      ],
    },
    {
      name: "groupBy",
      checks: [
        {
          name: "Groups words by length",
          run: () => {
            const result = groupBy(["one", "two", "three"], (w: string) => w.length);
            return same(result, { 3: ["one", "two"], 5: ["three"] }) || `got ${JSON.stringify(result)}`;
          },
        },
        {
          name: "Keeps input order within each group",
          run: () => {
            const result = groupBy([5, 2, 9, 4, 7, 6], (n: number) => (n % 2 === 0 ? "even" : "odd"));
            return (
              same(result, { odd: [5, 9, 7], even: [2, 4, 6] }) ||
              `got ${JSON.stringify(result)}`
            );
          },
        },
        {
          name: "Returns an empty object for an empty array",
          run: () => {
            const result = groupBy([], (x: string) => x);
            return same(result, {}) || `got ${JSON.stringify(result)}`;
          },
        },
        {
          name: 'Handles the keys "constructor", "toString" and "__proto__"',
          run: () => {
            const result = groupBy(["constructor", "toString", "__proto__"], (w: string) => w);
            const expected: unknown = JSON.parse(
              '{"constructor":["constructor"],"toString":["toString"],"__proto__":["__proto__"]}',
            );
            return same(result, expected) || `got ${JSON.stringify(result)}`;
          },
        },
        {
          name: "Does not change the input array",
          run: () => {
            const input = ["one", "two", "three"];
            groupBy(input, (w: string) => w.length);
            return same(input, ["one", "two", "three"]) || `input became ${JSON.stringify(input)}`;
          },
        },
      ],
    },
    {
      name: "promisePool",
      checks: [
        {
          name: "Returns results in input order even when later tasks finish first",
          run: async () => {
            const delays = [40, 10, 25];
            const tasks = delays.map((ms, i) => async () => {
              await wait(ms);
              return i;
            });
            const result = await settle(promisePool(tasks, 3));
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            return same(result.value, [0, 1, 2]) || `got ${JSON.stringify(result.value)}`;
          },
        },
        {
          name: "Never exceeds the limit, and uses all of it",
          run: async () => {
            let active = 0;
            let peak = 0;
            const tasks = Array.from({ length: 8 }, (_, i) => async () => {
              active++;
              peak = Math.max(peak, active);
              await wait(15);
              active--;
              return i;
            });
            const result = await settle(promisePool(tasks, 3));
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            if (peak > 3) return `${peak} tasks ran at once, limit was 3`;
            if (peak < 3) return `only ${peak} tasks ran at once; it should use the full limit of 3`;
            return same(result.value, [0, 1, 2, 3, 4, 5, 6, 7]) || `got ${JSON.stringify(result.value)}`;
          },
        },
        {
          name: "Starts the next task as soon as one finishes",
          run: async () => {
            let cStartedAt = -1;
            const start = Date.now();
            const tasks = [
              async () => {
                await wait(50);
                return "A";
              },
              async () => {
                await wait(10);
                return "B";
              },
              async () => {
                cStartedAt = Date.now() - start;
                return "C";
              },
            ];
            const result = await settle(promisePool(tasks, 2));
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            if (cStartedAt < 0) return "the third task never started";
            return cStartedAt < 40 || `third task started after ${cStartedAt} ms; it should start when the second one finishes`;
          },
        },
        {
          name: "Resolves an empty array for no tasks",
          run: async () => {
            const result = await settle(promisePool<number>([], 3));
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            return same(result.value, []) || `got ${JSON.stringify(result.value)}`;
          },
        },
        {
          name: "Works when the limit is above the task count",
          run: async () => {
            const tasks = [1, 2].map((n) => async () => n);
            const result = await settle(promisePool(tasks, 10));
            if (!result.ok) return `rejected unexpectedly: ${String(result.error)}`;
            return same(result.value, [1, 2]) || `got ${JSON.stringify(result.value)}`;
          },
        },
        {
          name: "Rejects on the first failure and starts no new tasks after it",
          run: async () => {
            const boom = new Error("boom");
            let started = 0;
            const tasks = Array.from({ length: 5 }, (_, i) => async () => {
              started++;
              if (i === 0) {
                await wait(10);
                throw boom;
              }
              await wait(30);
              return i;
            });
            const result = await settle(promisePool(tasks, 2));
            if (result.ok) return "expected a rejection, but it resolved";
            if (result.error !== boom) return "did not reject with the task's error";
            await wait(80); // let the other in-flight task finish; nothing new may start
            return started === 2 || `expected 2 tasks started, got ${started}`;
          },
        },
        {
          name: "A task that throws synchronously rejects the pool",
          run: async () => {
            const boom = new Error("sync boom");
            const tasks: (() => Promise<number>)[] = [
              async () => 1,
              () => {
                throw boom;
              },
              async () => 3,
            ];
            const result = await settle(promisePool(tasks, 2));
            if (result.ok) return "expected a rejection, but it resolved";
            return result.error === boom || "did not reject with the thrown error";
          },
        },
        {
          name: "A task started later that throws synchronously rejects the pool",
          run: async () => {
            const boom = new Error("sync boom");
            let started = 0;
            const tasks: (() => Promise<number>)[] = [
              async () => {
                started++;
                return 1;
              },
              () => {
                started++;
                throw boom;
              },
              async () => {
                started++;
                return 3;
              },
            ];
            const result = await settle(promisePool(tasks, 1));
            if (result.ok) return "expected a rejection, but it resolved";
            if (result.error !== boom) return "did not reject with the thrown error";
            await wait(20); // nothing new may start after the rejection
            return started === 2 || `expected 2 tasks started, got ${started}`;
          },
        },
        {
          name: "Rejects with a RangeError when the limit is below 1",
          run: async () => {
            for (const limit of [0, -1, 0.5]) {
              const result = await settle(promisePool([async () => 1], limit));
              if (result.ok) return `limit ${limit} resolved; expected a rejection`;
              if (!(result.error instanceof RangeError)) {
                return `limit ${limit} rejected with ${String(result.error)}, expected a RangeError`;
              }
            }
            return true;
          },
        },
      ],
    },
    {
      name: "LRUCache",
      checks: [
        {
          name: "Evicts the least recently used entry when full",
          run: () => {
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            cache.set("a", 1);
            cache.set("b", 2);
            cache.set("c", 3);
            if (cache.has("a")) return '"a" should have been evicted';
            if (cache.get("b") !== 2) return '"b" should still be cached';
            return cache.get("c") === 3 || '"c" should be cached';
          },
        },
        {
          name: "get makes an entry the most recently used",
          run: () => {
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            cache.set("a", 1);
            cache.set("b", 2);
            cache.get("a");
            cache.set("c", 3);
            if (cache.has("b")) return '"b" should have been evicted, not "a"';
            return cache.get("a") === 1 || '"a" should still be cached';
          },
        },
        {
          name: "has does not change the recency order",
          run: () => {
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            cache.set("a", 1);
            cache.set("b", 2);
            cache.has("a");
            cache.set("c", 3);
            return !cache.has("a") || '"a" should have been evicted: has must not refresh it';
          },
        },
        {
          name: "set on an existing key updates it, restarts the TTL and evicts nothing",
          run: () => {
            let time = 0;
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 100, now: () => time });
            cache.set("a", 1);
            cache.set("b", 2);
            time = 60;
            cache.set("a", 10);
            if (cache.size !== 2) return `expected size 2, got ${cache.size}`;
            if (!cache.has("b")) return '"b" was evicted by an update of "a"';
            time = 130; // "a" was set 70 ms ago, "b" 130 ms ago
            if (cache.get("a") !== 10) return 'expected "a" to be 10 and still alive after its TTL restarted';
            return !cache.has("b") || '"b" should have expired';
          },
        },
        {
          name: "set on an existing key makes it the most recently used",
          run: () => {
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            cache.set("a", 1);
            cache.set("b", 2);
            cache.set("a", 3);
            cache.set("c", 4);
            if (!cache.has("a")) return '"a" should still be cached: set must refresh its recency';
            if (cache.has("b")) return '"b" should have been evicted';
            return cache.get("c") === 4 || '"c" should be cached';
          },
        },
        {
          name: "Works without options.now (defaults to Date.now)",
          run: async () => {
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 60 });
            cache.set("a", 1);
            if (cache.get("a") !== 1) return "expected a live entry right after set";
            const sizeBefore: number = cache.size;
            if (sizeBefore !== 1) return `expected size 1, got ${sizeBefore}`;
            await wait(120);
            if (cache.has("a")) return "the entry should have expired after 120 ms with ttlMs 60";
            return cache.size === 0 || `expected size 0, got ${cache.size}`;
          },
        },
        {
          name: "A full cache drops an expired entry before evicting a live one",
          run: () => {
            let time = 0;
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 100, now: () => time });
            cache.set("a", 1);
            time = 60;
            cache.set("b", 2);
            cache.get("a"); // "a" is now more recent than "b", but "a" expires first
            time = 100; // "a" expired (set at 0), "b" alive (set at 60)
            cache.set("c", 3);
            if (!cache.has("b")) return '"b" is live and was evicted; the expired "a" should have gone first';
            if (!cache.has("c")) return '"c" should be cached';
            return cache.size === 2 || `expected size 2, got ${cache.size}`;
          },
        },
        {
          name: "Expired entries read as missing and do not count toward size",
          run: () => {
            let time = 0;
            const cache = new LRUCache<string, number>({ capacity: 5, ttlMs: 100, now: () => time });
            cache.set("a", 1);
            time = 50;
            cache.set("b", 2);
            time = 100;
            if (cache.get("a") !== undefined) return '"a" should read as undefined once expired';
            if (cache.has("a")) return 'has("a") should be false once expired';
            return cache.size === 1 || `expected size 1, got ${cache.size}`;
          },
        },
        {
          name: "An entry is alive at ttlMs - 1 and expired at ttlMs",
          run: () => {
            let time = 0;
            const cache = new LRUCache<string, number>({ capacity: 2, ttlMs: 100, now: () => time });
            cache.set("a", 1);
            time = 99;
            if (cache.get("a") !== 1) return "expected the entry to be alive at ttlMs - 1";
            time = 100;
            return cache.get("a") === undefined || "expected the entry to be expired at ttlMs";
          },
        },
        {
          name: "Stores falsy values such as 0, an empty string and false",
          run: () => {
            const numbers = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            numbers.set("zero", 0);
            if (!numbers.has("zero")) return "has(zero) should be true";
            if (numbers.get("zero") !== 0) return "get(zero) should return 0";
            const strings = new LRUCache<string, string>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            strings.set("empty", "");
            if (!strings.has("empty")) return "has(empty) should be true";
            if (strings.get("empty") !== "") return 'get(empty) should return ""';
            const booleans = new LRUCache<string, boolean>({ capacity: 2, ttlMs: 1000, now: () => 0 });
            booleans.set("no", false);
            if (!booleans.has("no")) return "has(no) should be true";
            return booleans.get("no") === false || "get(no) should return false";
          },
        },
        {
          name: "With capacity 1 only the newest entry is kept",
          run: () => {
            const cache = new LRUCache<string, number>({ capacity: 1, ttlMs: 1000, now: () => 0 });
            cache.set("a", 1);
            cache.set("b", 2);
            if (cache.has("a")) return '"a" should have been evicted';
            if (cache.get("b") !== 2) return '"b" should be cached';
            return cache.size === 1 || `expected size 1, got ${cache.size}`;
          },
        },
      ],
    },
  ],
};
