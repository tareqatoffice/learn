"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type { FocusContext } from "@/features/focus/context";
import {
  addParked,
  FOCUS_STORAGE_KEY,
  type FocusRun,
  parseRun,
  pauseRun,
  resumeRun,
  startRun,
} from "@/features/focus/lib/timer";

type FocusState = {
  run: FocusRun | null;
  start: (context: FocusContext, minutes: number | undefined, now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  park: (text: string) => void;
  restore: (run: FocusRun) => void;
  clear: () => void;
};

type Persisted = Pick<FocusState, "run">;

function readRaw(): string | null | undefined {
  try {
    return window.localStorage.getItem(FOCUS_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

const storage: PersistStorage<Persisted> = {
  getItem: () => {
    const raw = readRaw();
    return raw === undefined ? null : { state: { run: parseRun(raw) } };
  },
  setItem: (_name, { state }) => {
    try {
      if (state.run) window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(state.run));
      else window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    } catch {
    }
  },
  removeItem: () => {
    try {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    } catch {
    }
  },
};

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      run: null,
      start: (context, minutes, now = Date.now()) => set({ run: startRun(context, minutes, now) }),
      pause: (now = Date.now()) => {
        const { run } = get();
        if (run) set({ run: pauseRun(run, now) });
      },
      resume: (now = Date.now()) => {
        const { run } = get();
        if (run) set({ run: resumeRun(run, now) });
      },
      park: (text) => {
        const { run } = get();
        if (run) set({ run: addParked(run, text) });
      },
      restore: (run) => set({ run }),
      clear: () => set({ run: null }),
    }),
    {
      name: FOCUS_STORAGE_KEY,
      storage,
      partialize: ({ run }) => ({ run }),
      skipHydration: true,
    },
  ),
);

export function isCurrentRun(run: FocusRun): boolean {
  const raw = readRaw();
  const stored = raw === undefined ? useFocusStore.getState().run : parseRun(raw);
  return stored?.id === run.id;
}

export function syncFocusStore(): () => void {
  void useFocusStore.persist.rehydrate();
  const onStorage = (e: StorageEvent) => {
    if (e.key === FOCUS_STORAGE_KEY || e.key === null) void useFocusStore.persist.rehydrate();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
