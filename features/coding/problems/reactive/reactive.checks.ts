import { eq } from "../harness";
import type { Group } from "../harness";
import { batch, createComputed, createEffect, createSignal } from "./reactive";

export const reactive: Group = {
  slug: "reactive",
  title: "Reactive signals",
  level: "Advanced",
  questions: [
    {
      name: "createSignal",
      checks: [
        eq("Reads the initial value", () => createSignal(1).get(), 1),
        eq("set changes the value", () => {
          const s = createSignal(1);
          s.set(2);
          return s.get();
        }, 2),
        eq("Stores falsy values", () => {
          const s = createSignal<number | null>(1);
          s.set(null);
          return s.get();
        }, null),
      ],
    },
    {
      name: "createEffect",
      checks: [
        eq("Runs now and on change", () => {
          const seen: number[] = [];
          const s = createSignal(1);
          createEffect(() => void seen.push(s.get()));
          s.set(2);
          return seen;
        }, [1, 2]),
        eq("Skips equal values", () => {
          let runs = 0;
          const s = createSignal(1);
          createEffect(() => {
            s.get();
            runs++;
          });
          s.set(1);
          return runs;
        }, 1),
        eq("dispose stops it", () => {
          let runs = 0;
          const s = createSignal(1);
          const stop = createEffect(() => {
            s.get();
            runs++;
          });
          stop();
          s.set(2);
          return runs;
        }, 1),
        eq("Re-tracks branches", () => {
          let runs = 0;
          const flag = createSignal(true);
          const other = createSignal(0);
          createEffect(() => {
            runs++;
            if (flag.get()) other.get();
          });
          flag.set(false);
          other.set(1);
          return runs;
        }, 2),
      ],
    },
    {
      name: "createComputed",
      checks: [
        eq("Derives a value", () => {
          const s = createSignal(2);
          return createComputed(() => s.get() * 2)();
        }, 4),
        eq("Updates after a change", () => {
          const s = createSignal(2);
          const double = createComputed(() => s.get() * 2);
          s.set(3);
          return double();
        }, 6),
        eq("Reads do not recompute", () => {
          let runs = 0;
          const s = createSignal(1);
          const value = createComputed(() => {
            runs++;
            return s.get();
          });
          value();
          value();
          return runs;
        }, 1),
        eq("Effects can depend on it", () => {
          const seen: number[] = [];
          const s = createSignal(1);
          const double = createComputed(() => s.get() * 2);
          createEffect(() => void seen.push(double()));
          s.set(2);
          return seen;
        }, [2, 4]),
      ],
    },
    {
      name: "batch",
      checks: [
        eq("Effects run once", () => {
          let runs = 0;
          const a = createSignal(1);
          const b = createSignal(1);
          createEffect(() => {
            a.get();
            b.get();
            runs++;
          });
          batch(() => {
            a.set(2);
            b.set(2);
          });
          return runs;
        }, 2),
        eq("Nested batches flush at the end", () => {
          const seen: number[] = [];
          const a = createSignal(1);
          createEffect(() => void seen.push(a.get()));
          batch(() => {
            batch(() => a.set(2));
            a.set(3);
          });
          return seen;
        }, [1, 3]),
        eq("Flushes even when fn throws", () => {
          const seen: number[] = [];
          const a = createSignal(1);
          createEffect(() => void seen.push(a.get()));
          try {
            batch(() => {
              a.set(2);
              throw new Error("x");
            });
          } catch {
            // expected
          }
          return seen;
        }, [1, 2]),
      ],
    },
  ],
};
