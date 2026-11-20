import { wait } from "../harness";
import { check, eq, throws } from "../harness";
import type { Group } from "../harness";
import { promiseAll, promiseAllSettled, promiseAny, promiseRace } from "./promises";

const later = async <T,>(value: T, ms: number): Promise<T> => {
  await wait(ms);
  return value;
};
const fail = (message: string, ms: number): Promise<never> => {
  const promise = wait(ms).then(() => {
    throw new Error(message);
  });
  promise.catch(() => undefined);
  return promise;
};

export const promises: Group = {
  slug: "promises",
  title: "Promise combinators",
  level: "Intermediate",
  questions: [
    {
      name: "promiseAll",
      checks: [
        eq("Keeps input order", () => promiseAll([later(1, 20), later(2, 5), 3]), [1, 2, 3]),
        eq("Resolves [] for no values", () => promiseAll([]), []),
        throws("Rejects on the first rejection", () => promiseAll([later(1, 500), fail("x", 5)])),
      ],
    },
    {
      name: "promiseAllSettled",
      checks: [
        eq("Reports fulfilled values", () => promiseAllSettled([1]), [{ status: "fulfilled", value: 1 }]),
        check("Reports rejections", async () => {
          const [row] = await promiseAllSettled([fail("x", 1)]);
          return (row.status === "rejected" && row.reason instanceof Error) || "not reported as rejected";
        }),
        eq("Resolves [] for no values", () => promiseAllSettled([]), []),
      ],
    },
    {
      name: "promiseRace",
      checks: [
        eq("The fastest wins", () => promiseRace([later("slow", 30), later("fast", 5)]), "fast"),
        eq("Accepts plain values", () => promiseRace([later("slow", 30), "now"]), "now"),
        throws("Rejects when the fastest rejects", () => promiseRace([later(1, 50), fail("x", 5)])),
      ],
    },
    {
      name: "promiseAny",
      checks: [
        eq("Skips rejections", () => promiseAny([fail("x", 1), later("ok", 10)]), "ok"),
        check("Rejects with an AggregateError in input order", async () => {
          try {
            await promiseAny([fail("a", 20), fail("b", 1)]);
          } catch (err: unknown) {
            if (!(err instanceof AggregateError)) return "not an AggregateError";
            const messages = err.errors.map(String).join();
            return messages === "Error: a,Error: b" || `got ${messages}`;
          }
          return "expected a rejection";
        }),
        throws("Rejects for no values", () => promiseAny([]), AggregateError),
      ],
    },
  ],
};
