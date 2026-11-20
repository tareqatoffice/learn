import { beforeEach, describe, expect, it } from "vitest";
import { isCurrentRun, syncFocusStore, useFocusStore } from "@/features/focus/lib/store";
import { FOCUS_STORAGE_KEY, parseRun, startRun } from "@/features/focus/lib/timer";

const ctx = { area: "general" as const, label: "Notes", path: "/notes" };

describe("focus store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFocusStore.setState({ run: null });
  });

  it("writes the bare run JSON to localStorage and clears it", () => {
    useFocusStore.getState().start(ctx, 25, 1_000);
    const run = useFocusStore.getState().run!;
    expect(parseRun(window.localStorage.getItem(FOCUS_STORAGE_KEY))).toEqual(run);

    useFocusStore.getState().pause(61_000);
    expect(useFocusStore.getState().run).toMatchObject({ startedAt: null, elapsedMs: 60_000 });
    useFocusStore.getState().resume(70_000);
    expect(useFocusStore.getState().run?.startedAt).toBe(70_000);

    useFocusStore.getState().clear();
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBeNull();
  });

  it("hydrates from storage and follows other tabs", async () => {
    const stored = startRun(ctx, undefined, 5_000);
    window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(stored));
    const stop = syncFocusStore();
    await Promise.resolve();
    expect(useFocusStore.getState().run).toEqual(stored);
    expect(isCurrentRun(stored)).toBe(true);

    window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: FOCUS_STORAGE_KEY }));
    await Promise.resolve();
    expect(useFocusStore.getState().run).toBeNull();
    expect(isCurrentRun(stored)).toBe(false);
    stop();
  });

  it("ignores malformed stored data", async () => {
    window.localStorage.setItem(FOCUS_STORAGE_KEY, "{bad");
    const stop = syncFocusStore();
    await Promise.resolve();
    expect(useFocusStore.getState().run).toBeNull();
    stop();
  });
});
