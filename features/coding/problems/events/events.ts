/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Events
 *
 * Implement every export. Listeners run in the order they were added. A
 * listener removed during an emit must not stop the others. No `any`.
 */

export class Emitter<E extends Record<string, unknown>> {
  /** Add a listener and return a function that removes it. */
  on<K extends keyof E>(_event: K, _listener: (payload: E[K]) => void): () => void {
    throw new Error("Not implemented");
  }

  /** Add a listener that runs for the next emit only. */
  once<K extends keyof E>(_event: K, _listener: (payload: E[K]) => void): () => void {
    throw new Error("Not implemented");
  }

  /** Call the listeners for `event`. */
  emit<K extends keyof E>(_event: K, _payload: E[K]): void {
    throw new Error("Not implemented");
  }
}

/** Resolve with the next payload of `event` on an EventTarget; reject with `signal.reason` on abort. Remove listeners afterwards. */
export function waitForEvent(_target: EventTarget, _event: string, _signal?: AbortSignal): Promise<Event> {
  throw new Error("Not implemented");
}

/** Holds a current value. New subscribers get it at once, then every change. */
export class BehaviorSubject<T> {
  

  constructor(_initial: T) {
    throw new Error("Not implemented");
  }

  get value(): T {
    throw new Error("Not implemented");
  }

  /** Store the value and notify subscribers, even when it is unchanged. */
  next(_value: T): void {
    throw new Error("Not implemented");
  }

  /** Call `listener` with the current value now and on each change. Return an unsubscribe function. */
  subscribe(_listener: (value: T) => void): () => void {
    throw new Error("Not implemented");
  }
}

/** Topics are dotted. "user.*" matches one more segment, as in "user.created", but not "user.a.b" or "user". */
export class TopicBus {
  subscribe(_pattern: string, _listener: (topic: string) => void): () => void {
    throw new Error("Not implemented");
  }

  publish(_topic: string): void {
    throw new Error("Not implemented");
  }
}
