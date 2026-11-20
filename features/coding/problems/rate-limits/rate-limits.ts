/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Rate limiting and locks
 *
 * Use the injected `now` for time so behaviour is deterministic. No `any`.
 */

export interface BucketOptions {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
}

/** Starts full. `tryTake` removes one token and returns true, or returns false. Tokens refill continuously up to capacity. */
export class TokenBucket {
  

  constructor(_options: BucketOptions) {
    throw new Error("Not implemented");
  }

  tryTake(): boolean {
    throw new Error("Not implemented");
  }
}

export interface WindowOptions {
  limit: number;
  windowMs: number;
  now: () => number;
}

/** Allow at most `limit` calls in any rolling window. A call exactly windowMs old no longer counts. Denied calls do not count. */
export class SlidingWindow {
  

  constructor(_options: WindowOptions) {
    throw new Error("Not implemented");
  }

  allow(): boolean {
    throw new Error("Not implemented");
  }
}

/** `acquire` resolves when a permit is free, first come first served; `release` frees one. */
export class Semaphore {
  

  constructor(_permits: number) {
    throw new Error("Not implemented");
  }

  acquire(): Promise<void> {
    throw new Error("Not implemented");
  }

  release(): void {
    throw new Error("Not implemented");
  }
}

/** `run` executes tasks one at a time in call order. A failed task rejects its own promise and does not block the next. */
export class Mutex {
  run<T>(_task: () => Promise<T>): Promise<T> {
    throw new Error("Not implemented");
  }
}
