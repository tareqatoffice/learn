/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Data structures
 *
 * Implement each class on top of plain arrays or objects. No `any`.
 */

/** Last in, first out. `pop` and `peek` return undefined when empty. */
export class Stack<T> {
  push(_item: T): void {
    throw new Error("Not implemented");
  }

  pop(): T | undefined {
    throw new Error("Not implemented");
  }

  peek(): T | undefined {
    throw new Error("Not implemented");
  }

  get size(): number {
    throw new Error("Not implemented");
  }
}

/** First in, first out, with O(1) `dequeue`: Array.prototype.shift is not allowed. */
export class Queue<T> {
  

  enqueue(_item: T): void {
    throw new Error("Not implemented");
  }

  dequeue(): T | undefined {
    throw new Error("Not implemented");
  }

  get size(): number {
    throw new Error("Not implemented");
  }
}

/** Fixed capacity. When full, `push` overwrites the oldest item. `toArray` returns oldest first. */
export class RingBuffer<T> {
  

  constructor(_capacity: number) {
    throw new Error("Not implemented");
  }

  push(_item: T): void {
    throw new Error("Not implemented");
  }

  toArray(): T[] {
    throw new Error("Not implemented");
  }

  get size(): number {
    throw new Error("Not implemented");
  }
}

/** A binary min-heap. `compare` works like an Array.prototype.sort comparator. */
export class MinHeap<T> {
  

  constructor(_compare: (a: T, b: T) => number) {
    throw new Error("Not implemented");
  }

  push(_item: T): void {
    throw new Error("Not implemented");
  }

  pop(): T | undefined {
    throw new Error("Not implemented");
  }

  get size(): number {
    throw new Error("Not implemented");
  }
}

/** A prefix tree of words. `startsWith` returns matching words sorted. */
export class Trie {
  add(_word: string): void {
    throw new Error("Not implemented");
  }

  has(_word: string): boolean {
    throw new Error("Not implemented");
  }

  startsWith(_prefix: string): string[] {
    throw new Error("Not implemented");
  }
}
