import { check, mountHook } from "../harness";
import type { Group } from "../harness";
import { useCounter, useList, usePrevious, useToggle, useUndoRedo } from "./react-state";

export const reactState: Group = {
  slug: "react-state",
  title: "React State",
  level: "Intermediate",
  questions: [
    {
      name: "useToggle",
      checks: [
        check("Starts from the initial value", async () => {
          const hook = await mountHook(() => useToggle(true), undefined);
          const value = hook.result.current[0];
          hook.unmount();
          return value === true || "expected true";
        }),
        check("toggle flips and setValue sets", async () => {
          const hook = await mountHook(() => useToggle(), undefined);
          await hook.act(() => hook.result.current[1]());
          const flipped = hook.result.current[0];
          await hook.act(() => hook.result.current[2](false));
          const set = hook.result.current[0];
          hook.unmount();
          return (flipped === true && set === false) || `got ${flipped}, then ${set}`;
        }),
        check("toggle keeps its identity", async () => {
          const hook = await mountHook(() => useToggle(), undefined);
          const first = hook.result.current[1];
          await hook.act(() => first());
          const stable = hook.result.current[1] === first;
          hook.unmount();
          return stable || "toggle changed between renders";
        }),
      ],
    },
    {
      name: "useCounter",
      checks: [
        check("Counts up and down", async () => {
          const hook = await mountHook(() => useCounter({ initial: 5 }), undefined);
          await hook.act(() => hook.result.current.increment());
          await hook.act(() => hook.result.current.decrement());
          await hook.act(() => hook.result.current.decrement());
          const { count } = hook.result.current;
          hook.unmount();
          return count === 4 || `expected 4, got ${count}`;
        }),
        check("Two increments in one batch both count", async () => {
          const hook = await mountHook(() => useCounter(), undefined);
          await hook.act(() => {
            hook.result.current.increment();
            hook.result.current.increment();
          });
          const { count } = hook.result.current;
          hook.unmount();
          return count === 2 || `expected 2, got ${count}`;
        }),
        check("Stays inside min and max", async () => {
          const hook = await mountHook(() => useCounter({ initial: 1, min: 0, max: 2 }), undefined);
          for (let i = 0; i < 3; i++) await hook.act(() => hook.result.current.increment());
          const high = hook.result.current.count;
          for (let i = 0; i < 4; i++) await hook.act(() => hook.result.current.decrement());
          const low = hook.result.current.count;
          hook.unmount();
          return (high === 2 && low === 0) || `got ${high} and ${low}`;
        }),
        check("reset returns to initial", async () => {
          const hook = await mountHook(() => useCounter({ initial: 3 }), undefined);
          await hook.act(() => hook.result.current.increment());
          await hook.act(() => hook.result.current.reset());
          const { count } = hook.result.current;
          hook.unmount();
          return count === 3 || `expected 3, got ${count}`;
        }),
      ],
    },
    {
      name: "usePrevious",
      checks: [
        check("Is undefined on the first render", async () => {
          const hook = await mountHook((value: number) => usePrevious(value), 1);
          const value = hook.result.current;
          hook.unmount();
          return value === undefined || `got ${value}`;
        }),
        check("Returns the value from the last render", async () => {
          const hook = await mountHook((value: number) => usePrevious(value), 1);
          await hook.rerender(2);
          const after2 = hook.result.current;
          await hook.rerender(3);
          const after3 = hook.result.current;
          hook.unmount();
          return (after2 === 1 && after3 === 2) || `got ${after2}, then ${after3}`;
        }),
      ],
    },
    {
      name: "useList",
      checks: [
        check("Pushes and removes", async () => {
          const hook = await mountHook(() => useList(["a", "b"]), undefined);
          await hook.act(() => hook.result.current.push("c"));
          await hook.act(() => hook.result.current.removeAt(0));
          const items = hook.result.current.items.join();
          hook.unmount();
          return items === "b,c" || `got ${items}`;
        }),
        check("clear empties the list", async () => {
          const hook = await mountHook(() => useList([1]), undefined);
          await hook.act(() => hook.result.current.clear());
          const size = hook.result.current.items.length;
          hook.unmount();
          return size === 0 || `got ${size} items`;
        }),
        check("Actions keep their identity", async () => {
          const hook = await mountHook(() => useList([1]), undefined);
          const { push, removeAt, clear } = hook.result.current;
          await hook.act(() => push(2));
          const now = hook.result.current;
          hook.unmount();
          return (now.push === push && now.removeAt === removeAt && now.clear === clear) || "an action changed";
        }),
      ],
    },
    {
      name: "useUndoRedo",
      checks: [
        check("Undoes and redoes", async () => {
          const hook = await mountHook(() => useUndoRedo(0), undefined);
          await hook.act(() => hook.result.current.set(1));
          await hook.act(() => hook.result.current.set(2));
          await hook.act(() => hook.result.current.undo());
          const undone = hook.result.current.value;
          await hook.act(() => hook.result.current.redo());
          const redone = hook.result.current.value;
          hook.unmount();
          return (undone === 1 && redone === 2) || `got ${undone}, then ${redone}`;
        }),
        check("set drops the redo entries", async () => {
          const hook = await mountHook(() => useUndoRedo(0), undefined);
          await hook.act(() => hook.result.current.set(1));
          await hook.act(() => hook.result.current.undo());
          await hook.act(() => hook.result.current.set(2));
          const { canRedo, value } = hook.result.current;
          hook.unmount();
          return (!canRedo && value === 2) || `canRedo ${canRedo}, value ${value}`;
        }),
        check("Reports canUndo and canRedo, and ignores empty steps", async () => {
          const hook = await mountHook(() => useUndoRedo("a"), undefined);
          const start = hook.result.current.canUndo || hook.result.current.canRedo;
          await hook.act(() => hook.result.current.undo());
          const { value } = hook.result.current;
          await hook.act(() => hook.result.current.set("b"));
          const { canUndo } = hook.result.current;
          hook.unmount();
          return (!start && value === "a" && canUndo) || `start ${start}, value ${value}, canUndo ${canUndo}`;
        }),
      ],
    },
  ],
};
