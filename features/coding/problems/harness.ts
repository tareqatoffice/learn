import { createElement, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export type CheckOutcome = true | string;

export interface GroupCheck {
  name: string;
  run: () => CheckOutcome | Promise<CheckOutcome>;
  timeoutMs?: number;
}

export interface Question {
  name: string;
  checks: readonly GroupCheck[];
  spec?: string;
  href?: string;
}

export interface Group {
  slug: string;
  title: string;
  level: "Intermediate" | "Advanced";
  file?: string;
  questions: readonly Question[];
}

export interface GroupCheckResult {
  question: string;
  name: string;
  passed: boolean;
  detail: string;
}

export const countChecks = (group: Group): number => group.questions.reduce((sum, q) => sum + q.checks.length, 0);

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const sortKeys = (_key: string, value: unknown): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
    : value;

export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a, sortKeys) === JSON.stringify(b, sortKeys);

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const CHECK_TIMEOUT_MS = 3000;
const ROUTE_TIMEOUT_MS = 30000;

async function runWithTimeout(item: GroupCheck): Promise<CheckOutcome> {
  const limit: number = item.timeoutMs ?? CHECK_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckOutcome>((resolve) => {
    timer = setTimeout(() => resolve(`timed out after ${limit} ms: a promise never settled`), limit);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => item.run()), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function eq(name: string, actual: () => unknown, expected: unknown): GroupCheck {
  return {
    name,
    run: async () => {
      const value = await actual();
      return same(value, expected) || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`;
    },
  };
}

export function throws(name: string, fn: () => unknown, errorClass?: new (...args: never[]) => Error): GroupCheck {
  return {
    name,
    run: async () => {
      try {
        await fn();
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not implemented") return "Not implemented";
        if (!errorClass || err instanceof errorClass) return true;
        return `threw the wrong error: ${describeError(err)}`;
      }
      return "expected an error, but none was thrown";
    },
  };
}

export function check(name: string, run: () => boolean | string | Promise<boolean | string>): GroupCheck {
  return {
    name,
    run: async () => {
      const outcome = await run();
      return outcome === false ? "check failed" : outcome;
    },
  };
}

export function routeCheck(name: string, run: () => boolean | string | Promise<boolean | string>): GroupCheck {
  return { ...check(name, run), timeoutMs: ROUTE_TIMEOUT_MS };
}

export async function runQuestion(question: Question): Promise<GroupCheckResult[]> {
  const results: GroupCheckResult[] = [];
  for (const item of question.checks) {
    try {
      const outcome = await runWithTimeout(item);
      results.push({
        question: question.name,
        name: item.name,
        passed: outcome === true,
        detail: outcome === true ? "" : outcome,
      });
    } catch (err: unknown) {
      results.push({ question: question.name, name: item.name, passed: false, detail: `threw: ${describeError(err)}` });
    }
  }
  return results;
}

export interface Mounted {
  container: HTMLElement;
  rerender: (element: ReactNode) => Promise<void>;
  act: (update?: () => void) => Promise<void>;
  unmount: () => void;
}

export async function mount(element: ReactNode): Promise<Mounted> {
  const container: HTMLDivElement = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:800px";
  document.body.append(container);
  let failure: { error: unknown } | null = null;
  const root = createRoot(container, {
    onUncaughtError: (error) => {
      failure = { error };
    },
    onCaughtError: () => {},
  });
  const unmount = (): void => {
    root.unmount();
    container.remove();
  };
  const act = async (update?: () => void): Promise<void> => {
    if (update) flushSync(update);
    await wait(5);
    if (failure) {
      unmount();
      throw failure.error;
    }
  };
  const rerender = (next: ReactNode): Promise<void> => act(() => root.render(next));
  await rerender(element);
  return { container, rerender, act, unmount };
}

export interface MountedHook<P, R> extends Pick<Mounted, "act" | "unmount"> {
  result: { readonly current: R };
  rerender: (props: P) => Promise<void>;
}

export async function mountHook<P, R>(hook: (props: P) => R, initialProps: NoInfer<P>): Promise<MountedHook<P, R>> {
  const box: { latest?: { value: R } } = {};
  function Probe({ props }: { props: P }): ReactNode {
    const value: R = hook(props);
    useLayoutEffect(() => {
      box.latest = { value };
    });
    return null;
  }
  const mounted = await mount(createElement(Probe, { props: initialProps }));
  return {
    result: {
      get current(): R {
        if (!box.latest) throw new Error("the hook did not render");
        return box.latest.value;
      },
    },
    rerender: (props) => mounted.rerender(createElement(Probe, { props })),
    act: mounted.act,
    unmount: mounted.unmount,
  };
}

export function typeInto(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export async function until<T>(read: () => T, timeoutMs = 4000): Promise<T | null> {
  const end: number = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value: T = read();
    if (value) return value;
    await wait(20);
  }
  return null;
}

export interface FetchedPage {
  response: Response;
  doc: Document;
  text: string;
}

export async function fetchPage(path: string): Promise<FetchedPage> {
  const response: Response = await fetch(path, { cache: "no-store" });
  const doc: Document = new DOMParser().parseFromString(await response.text(), "text/html");
  doc.querySelectorAll("script, style").forEach((node) => node.remove());
  return { response, doc, text: doc.body.textContent ?? "" };
}

export async function withFrame<T>(path: string, body: (doc: Document, frame: HTMLIFrameElement) => Promise<T>): Promise<T> {
  const frame: HTMLIFrameElement = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px;opacity:0;pointer-events:none";
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.src = path;
  document.body.append(frame);
  try {
    await loaded;
    await wait(300);
    const doc: Document | null = frame.contentDocument;
    if (!doc) throw new Error(`could not open ${path}`);
    return await body(doc, frame);
  } finally {
    frame.remove();
  }
}
