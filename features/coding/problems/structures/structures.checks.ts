import { eq } from "../harness";
import type { Group } from "../harness";
import { MinHeap, Queue, RingBuffer, Stack, Trie } from "./structures";

export const structures: Group = {
  slug: "structures",
  title: "Data structures",
  level: "Intermediate",
  questions: [
    {
      name: "Stack",
      checks: [
        eq("Pops last in first", () => {
          const s = new Stack<number>();
          s.push(1);
          s.push(2);
          return [s.pop(), s.pop()];
        }, [2, 1]),
        eq("peek does not remove", () => {
          const s = new Stack<number>();
          s.push(1);
          return [s.peek(), s.size];
        }, [1, 1]),
        eq("Empty pop is undefined", () => new Stack<number>().pop() === undefined, true),
      ],
    },
    {
      name: "Queue",
      checks: [
        eq("Dequeues first in first", () => {
          const q = new Queue<number>();
          q.enqueue(1);
          q.enqueue(2);
          return [q.dequeue(), q.dequeue()];
        }, [1, 2]),
        eq("Tracks size", () => {
          const q = new Queue<number>();
          q.enqueue(1);
          q.enqueue(2);
          q.dequeue();
          return q.size;
        }, 1),
        eq("Handles 100k items quickly", () => {
          const q = new Queue<number>();
          for (let i = 0; i < 100_000; i++) q.enqueue(i);
          let last = -1;
          while (q.size > 0) last = q.dequeue() ?? -1;
          return last;
        }, 99_999),
      ],
    },
    {
      name: "RingBuffer",
      checks: [
        eq("Keeps items in order", () => {
          const r = new RingBuffer<number>(3);
          r.push(1);
          r.push(2);
          return r.toArray();
        }, [1, 2]),
        eq("Overwrites the oldest", () => {
          const r = new RingBuffer<number>(2);
          [1, 2, 3].forEach((n) => r.push(n));
          return r.toArray();
        }, [2, 3]),
        eq("Size stops at capacity", () => {
          const r = new RingBuffer<number>(2);
          [1, 2, 3].forEach((n) => r.push(n));
          return r.size;
        }, 2),
      ],
    },
    {
      name: "MinHeap",
      checks: [
        eq("Pops in sorted order", () => {
          const h = new MinHeap<number>((a, b) => a - b);
          [5, 1, 4, 2, 3].forEach((n) => h.push(n));
          return [h.pop(), h.pop(), h.pop(), h.pop(), h.pop()];
        }, [1, 2, 3, 4, 5]),
        eq("Uses the comparator", () => {
          const h = new MinHeap<number>((a, b) => b - a);
          [1, 3, 2].forEach((n) => h.push(n));
          return h.pop();
        }, 3),
        eq("Empty pop is undefined", () => new MinHeap<number>((a, b) => a - b).pop() === undefined, true),
      ],
    },
    {
      name: "Trie",
      checks: [
        eq("Finds added words", () => {
          const t = new Trie();
          t.add("car");
          return [t.has("car"), t.has("ca")];
        }, [true, false]),
        eq("Lists by prefix, sorted", () => {
          const t = new Trie();
          ["cat", "car", "dog"].forEach((w) => t.add(w));
          return t.startsWith("ca");
        }, ["car", "cat"]),
        eq("Unknown prefix is empty", () => new Trie().startsWith("x"), []),
      ],
    },
  ],
};
