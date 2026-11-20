/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
import { check, mountHook, wait } from "../harness";
import type { Group } from "../harness";
import { useDebouncedValue, useEventListener, useFetch, useInterval, useLocalStorage } from "./react-effects";
import type { FetchState } from "./react-effects";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const statusOf = (state: FetchState<string>): string =>
  state.status === "success" ? `success:${state.data}` : state.status;

export const reactEffects: Group = {
  slug: "react-effects",
  title: "React Effects",
  level: "Advanced",
  questions: [
    {
      name: "useDebouncedValue",
      checks: [
        check("Returns the first value at once", async () => {
          const hook = await mountHook((value: string) => useDebouncedValue(value, 30), "a");
          const value = hook.result.current;
          hook.unmount();
          return value === "a" || `got ${value}`;
        }),
        check("Updates after the delay", async () => {
          const hook = await mountHook((value: string) => useDebouncedValue(value, 40), "a");
          await hook.rerender("b");
          const early = hook.result.current;
          await wait(100);
          await hook.act();
          const late = hook.result.current;
          hook.unmount();
          return (early === "a" && late === "b") || `got ${early}, then ${late}`;
        }),
        check("Each change restarts the wait", async () => {
          const hook = await mountHook((value: string) => useDebouncedValue(value, 80), "a");
          await hook.rerender("b");
          await wait(50);
          await hook.rerender("c");
          await wait(50);
          const middle = hook.result.current;
          await wait(90);
          await hook.act();
          const last = hook.result.current;
          hook.unmount();
          return (middle === "a" && last === "c") || `got ${middle}, then ${last}`;
        }),
      ],
    },
    {
      name: "useFetch",
      checks: [
        check("A null key stays idle and never fetches", async () => {
          let calls = 0;
          const hook = await mountHook(
            () =>
              useFetch<string>(null, async () => {
                calls++;
                return "x";
              }),
            undefined,
          );
          const { status } = hook.result.current;
          hook.unmount();
          return (status === "idle" && calls === 0) || `status ${status}, ${calls} calls`;
        }),
        check("Goes from loading to success", async () => {
          const gate = deferred<string>();
          const hook = await mountHook(() => useFetch("k", () => gate.promise), undefined);
          const first = statusOf(hook.result.current);
          gate.resolve("done");
          await wait(10);
          await hook.act();
          const second = statusOf(hook.result.current);
          hook.unmount();
          return (first === "loading" && second === "success:done") || `got ${first}, then ${second}`;
        }),
        check("A rejection becomes an error message", async () => {
          const hook = await mountHook(
            () =>
              useFetch<string>("k", async () => {
                throw new Error("nope");
              }),
            undefined,
          );
          await wait(10);
          await hook.act();
          const state = hook.result.current;
          hook.unmount();
          return (state.status === "error" && state.error === "nope") || `got ${JSON.stringify(state)}`;
        }),
        check("A new key aborts the old request, and a late answer is ignored", async () => {
          const gates: Record<string, ReturnType<typeof deferred<string>>> = { a: deferred<string>(), b: deferred<string>() };
          const signals: Record<string, AbortSignal> = {};
          const hook = await mountHook(
            (key: string) =>
              useFetch(key, (k, signal) => {
                signals[k] = signal;
                return gates[k].promise;
              }),
            "a",
          );
          await hook.rerender("b");
          const aborted = signals.a?.aborted;
          gates.b.resolve("new");
          await wait(10);
          gates.a.resolve("old");
          await wait(10);
          await hook.act();
          const final = statusOf(hook.result.current);
          hook.unmount();
          return (aborted && final === "success:new") || `aborted ${aborted}, final ${final}`;
        }),
        check("An aborted request never shows as an error", async () => {
          const hook = await mountHook(
            (key: string) =>
              useFetch(
                key,
                (k, signal) =>
                  new Promise<string>((resolve, reject) => {
                    if (k === "b") resolve("b");
                    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
                  }),
              ),
            "a",
          );
          await hook.rerender("b");
          await wait(10);
          await hook.act();
          const final = statusOf(hook.result.current);
          hook.unmount();
          return final === "success:b" || `got ${final}`;
        }),
        check("Unmounting aborts the request", async () => {
          let signal: AbortSignal | undefined;
          const hook = await mountHook(
            () =>
              useFetch("k", (_key, s) => {
                signal = s;
                return new Promise<string>(() => {});
              }),
            undefined,
          );
          hook.unmount();
          return signal?.aborted === true || "the signal was not aborted";
        }),
        check("A new fetcher identity does not refetch", async () => {
          let calls = 0;
          const hook = await mountHook(
            (_tick: number) =>
              useFetch("k", async () => {
                calls++;
                return "x";
              }),
            0,
          );
          await hook.rerender(1);
          await hook.rerender(2);
          hook.unmount();
          return calls === 1 || `fetched ${calls} times`;
        }),
      ],
    },
    {
      name: "useInterval",
      checks: [
        check("Ticks repeatedly", async () => {
          let ticks = 0;
          const hook = await mountHook(() => useInterval(() => ticks++, 15), undefined);
          await wait(80);
          hook.unmount();
          return ticks >= 2 || `ticked ${ticks} times`;
        }),
        check("A null delay pauses", async () => {
          let ticks = 0;
          const hook = await mountHook(() => useInterval(() => ticks++, null), undefined);
          await wait(40);
          hook.unmount();
          return ticks === 0 || `ticked ${ticks} times`;
        }),
        check("Calls the latest callback without restarting", async () => {
          const seen: number[] = [];
          const hook = await mountHook((n: number) => useInterval(() => seen.push(n), 60), 1);
          // Re-render faster than the delay: a restarted timer would never fire.
          for (let i = 2; i < 12; i++) await hook.rerender(i);
          await hook.rerender(12);
          for (let i = 13; i < 30; i++) await hook.rerender(i);
          hook.unmount();
          return (seen.length > 0 && seen.every((n) => n > 1)) || `saw ${JSON.stringify(seen)}`;
        }),
        check("Stops on unmount", async () => {
          let ticks = 0;
          const hook = await mountHook(() => useInterval(() => ticks++, 10), undefined);
          hook.unmount();
          const after = ticks;
          await wait(40);
          return ticks === after || "still ticking after unmount";
        }),
      ],
    },
    {
      name: "useEventListener",
      checks: [
        check("Calls the latest handler", async () => {
          const target = new EventTarget();
          const seen: number[] = [];
          const hook = await mountHook((n: number) => useEventListener(target, "ping", () => seen.push(n)), 1);
          await hook.rerender(2);
          target.dispatchEvent(new Event("ping"));
          hook.unmount();
          return seen.join() === "2" || `saw ${seen.join()}`;
        }),
        check("Does not re-subscribe on re-render", async () => {
          const target = new EventTarget();
          let adds = 0;
          const add = target.addEventListener.bind(target);
          target.addEventListener = (...args: Parameters<EventTarget["addEventListener"]>) => {
            adds++;
            add(...args);
          };
          const hook = await mountHook((_n: number) => useEventListener(target, "ping", () => {}), 1);
          await hook.rerender(2);
          await hook.rerender(3);
          hook.unmount();
          return adds === 1 || `subscribed ${adds} times`;
        }),
        check("Removes the listener on unmount", async () => {
          const target = new EventTarget();
          let calls = 0;
          const hook = await mountHook(() => useEventListener(target, "ping", () => calls++), undefined);
          hook.unmount();
          target.dispatchEvent(new Event("ping"));
          return calls === 0 || "the listener was still attached";
        }),
      ],
    },
    {
      name: "useLocalStorage",
      checks: [
        check("Reads a stored value after mount", async () => {
          localStorage.setItem("check-a", JSON.stringify({ n: 1 }));
          const hook = await mountHook(() => useLocalStorage("check-a", { n: 0 }), undefined);
          await hook.act();
          const { n } = hook.result.current[0];
          hook.unmount();
          localStorage.removeItem("check-a");
          return n === 1 || `got ${n}`;
        }),
        check("Writes JSON on set", async () => {
          const hook = await mountHook(() => useLocalStorage("check-b", 0), undefined);
          await hook.act(() => hook.result.current[1](5));
          await hook.act();
          const stored = localStorage.getItem("check-b");
          const value = hook.result.current[0];
          hook.unmount();
          localStorage.removeItem("check-b");
          return (stored === "5" && value === 5) || `stored ${stored}, value ${value}`;
        }),
        check("Keeps initial when stored JSON is invalid", async () => {
          localStorage.setItem("check-c", "{oops");
          const hook = await mountHook(() => useLocalStorage("check-c", 7), undefined);
          await hook.act();
          const value = hook.result.current[0];
          hook.unmount();
          localStorage.removeItem("check-c");
          return value === 7 || `got ${value}`;
        }),
      ],
    },
  ],
};
