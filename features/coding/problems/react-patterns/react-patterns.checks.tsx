import { createRef, useState } from "react";
import type { ReactNode } from "react";
import { check, mount, mountHook } from "../harness";
import type { Group } from "../harness";
import { createStrictContext, FancyInput, Row, useStableCallback, useStoreSelector } from "./react-patterns";
import type { ExternalStore, FancyInputHandle } from "./react-patterns";

interface Counts {
  a: number;
  b: number;
}

function makeStore(state: Counts): ExternalStore<Counts> & { set: (next: Counts) => void } {
  let current = state;
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      current = next;
      listeners.forEach((listener) => listener());
    },
  };
}

function Shown<T>({ read }: { read: () => T }): ReactNode {
  return <p>{String(read())}</p>;
}

function RowHost({ label, onRender }: { label: string; onRender: () => void }): ReactNode {
  const [tick, setTick] = useState<number>(0);
  return (
    <>
      <button onClick={() => setTick(tick + 1)}>tick {tick}</button>
      <Row item={{ id: 1, label }} onSelect={() => {}} onRender={onRender} />
    </>
  );
}

export const reactPatterns: Group = {
  slug: "react-patterns",
  title: "React Patterns",
  level: "Advanced",
  file: "coding/problems/react-patterns/react-patterns.tsx",
  questions: [
    {
      name: "createStrictContext",
      checks: [
        check("Passes the value down", async () => {
          const [Provider, useValue] = createStrictContext<string>("Theme");
          const view = await mount(<Provider value="dark"><Shown read={useValue} /></Provider>);
          const text = view.container.textContent;
          view.unmount();
          return text === "dark" || `got ${text}`;
        }),
        check("A falsy value still counts as provided", async () => {
          const [Provider, useValue] = createStrictContext<number>("Count");
          const view = await mount(<Provider value={0}><Shown read={useValue} /></Provider>);
          const text = view.container.textContent;
          view.unmount();
          return text === "0" || `got ${text}`;
        }),
        check("Throws an error naming the context without a Provider", async () => {
          const [, useValue] = createStrictContext<string>("Theme");
          try {
            const view = await mount(<Shown read={useValue} />);
            view.unmount();
          } catch (err: unknown) {
            return (err instanceof Error && err.message.includes("Theme")) || "the error must name the context";
          }
          return "nothing was thrown";
        }),
      ],
    },
    {
      name: "useStoreSelector",
      checks: [
        check("Reads and follows the slice", async () => {
          const store = makeStore({ a: 1, b: 1 });
          const hook = await mountHook(() => useStoreSelector(store, (s) => s.a), undefined);
          const first = hook.result.current;
          await hook.act(() => store.set({ a: 2, b: 1 }));
          const second = hook.result.current;
          hook.unmount();
          return (first === 1 && second === 2) || `got ${first}, then ${second}`;
        }),
        check("A change elsewhere does not re-render", async () => {
          const store = makeStore({ a: 1, b: 1 });
          let renders = 0;
          const hook = await mountHook(() => {
            renders++;
            return useStoreSelector(store, (s) => s.a);
          }, undefined);
          const before = renders;
          await hook.act(() => store.set({ a: 1, b: 2 }));
          hook.unmount();
          return renders === before || `rendered ${renders - before} extra times`;
        }),
        check("Unsubscribes on unmount", async () => {
          const store = makeStore({ a: 1, b: 1 });
          let active = 0;
          const counted: ExternalStore<Counts> = {
            getState: store.getState,
            subscribe: (listener) => {
              active++;
              const off = store.subscribe(listener);
              return () => {
                active--;
                off();
              };
            },
          };
          const hook = await mountHook(() => useStoreSelector(counted, (s) => s.a), undefined);
          hook.unmount();
          return active === 0 || `${active} listeners left`;
        }),
      ],
    },
    {
      name: "useStableCallback",
      checks: [
        check("Keeps its identity", async () => {
          const hook = await mountHook((n: number) => useStableCallback(() => n), 1);
          const first = hook.result.current;
          await hook.rerender(2);
          const stable = hook.result.current === first;
          hook.unmount();
          return stable || "the function changed";
        }),
        check("Calls the latest function", async () => {
          const hook = await mountHook((n: number) => useStableCallback(() => n), 1);
          const first = hook.result.current;
          await hook.rerender(2);
          const value = first();
          hook.unmount();
          return value === 2 || `got ${value}`;
        }),
      ],
    },
    {
      name: "FancyInput",
      checks: [
        check("Exposes only focus and clear", async () => {
          const ref = createRef<FancyInputHandle>();
          const view = await mount(<FancyInput ref={ref} />);
          const keys = Object.keys(ref.current ?? {}).sort().join();
          view.unmount();
          return keys === "clear,focus" || `ref holds ${keys}`;
        }),
        check("focus focuses the input", async () => {
          const ref = createRef<FancyInputHandle>();
          const view = await mount(<FancyInput ref={ref} />);
          ref.current?.focus();
          const focused = document.activeElement === view.container.querySelector("input");
          view.unmount();
          return focused || "the input is not focused";
        }),
        check("clear empties the input", async () => {
          const ref = createRef<FancyInputHandle>();
          const view = await mount(<FancyInput ref={ref} defaultValue="text" />);
          await view.act(() => ref.current?.clear());
          const value = view.container.querySelector("input")?.value;
          view.unmount();
          return value === "" || `input holds "${value}"`;
        }),
      ],
    },
    {
      name: "Row",
      checks: [
        check("Skips a parent re-render with equal data", async () => {
          let renders = 0;
          const view = await mount(<RowHost label="a" onRender={() => renders++} />);
          const before = renders;
          await view.act(() => view.container.querySelector("button")?.click());
          view.unmount();
          return (before > 0 && renders === before) || `rendered ${before}, then ${renders}`;
        }),
        check("Re-renders when the label changes", async () => {
          let renders = 0;
          const view = await mount(<RowHost label="a" onRender={() => renders++} />);
          const before = renders;
          await view.rerender(<RowHost label="b" onRender={() => renders++} />);
          view.unmount();
          return renders > before || "the row did not update";
        }),
      ],
    },
  ],
};
