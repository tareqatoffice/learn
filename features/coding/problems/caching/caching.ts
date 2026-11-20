/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Caching
 *
 * Use the injected `now` where there is one. No `any`.
 */

/** Least-frequently-used cache. `get` and `set` count as uses. Ties evict the least recently used. Capacity is at least 1. */
export class LFUCache<K, V> {
  

  constructor(_capacity: number) {
    throw new Error("Not implemented");
  }

  get(_key: K): V | undefined {
    throw new Error("Not implemented");
  }

  set(_key: K, _value: V): void {
    throw new Error("Not implemented");
  }

  has(_key: K): boolean {
    throw new Error("Not implemented");
  }
}

/** Cache resolved values by key and share in-flight calls. A rejection is not cached. */
export function memoizeAsync<K, V>(_fn: (key: K) => Promise<V>): (key: K) => Promise<V> {
  throw new Error("Not implemented");
}

/** A map whose entries read as missing `ttlMs` after being set. `size` ignores expired entries. */
export class TtlMap<K, V> {
  

  constructor(_ttlMs: number, _now: () => number) {
    throw new Error("Not implemented");
  }

  set(_key: K, _value: V): void {
    throw new Error("Not implemented");
  }

  get(_key: K): V | undefined {
    throw new Error("Not implemented");
  }

  get size(): number {
    throw new Error("Not implemented");
  }
}

/**
 * Stale-while-revalidate: the first call awaits `fn`. Later calls return the last
 * value at once. If that value is older than `maxAgeMs`, they also start one
 * background refresh; a failed refresh keeps the old value.
 */
export function staleWhileRevalidate<V>(_fn: () => Promise<V>, _maxAgeMs: number, _now: () => number): () => Promise<V> {
  throw new Error("Not implemented");
}
