/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Language
 *
 * Closures, `this`, prototypes and tagged templates. No `any`.
 */

/** Like Function.prototype.bind, without using bind: fix `thisArg` and leading arguments. */
export function customBind<A extends unknown[], B extends unknown[], R>(
  _fn: (this: unknown, ...args: [...A, ...B]) => R,
  _thisArg: unknown,
  ..._bound: A
): (...rest: B) => R {
  throw new Error("Not implemented");
}

export interface Constructor<A extends unknown[]> {
  (this: object, ...args: A): unknown;
  prototype: object;
}

/**
 * Do what `new ctor(...args)` does, without `new` or Reflect.construct: link the
 * prototype, run the constructor, and return its result when that is an object.
 */
export function construct<A extends unknown[]>(_ctor: Constructor<A>, ..._args: A): object {
  throw new Error("Not implemented");
}

/** Walk the prototype chain of `value`. Primitives are never instances. Do not use `instanceof`. */
export function isInstanceOf(_value: unknown, _ctor: { prototype: object }): boolean {
  throw new Error("Not implemented");
}

export type Curried = (...args: number[]) => Curried | number;

/** Curry by `fn.length`: arguments may arrive in any grouping, and `fn` runs once all have arrived. */
export function curry(_fn: (...args: number[]) => number): Curried {
  throw new Error("Not implemented");
}

/** A tagged template: sql`a = ${1} and b = ${2}` gives { text: "a = $1 and b = $2", values: [1, 2] }. */
export function sql(_strings: TemplateStringsArray, ..._values: readonly unknown[]): { text: string; values: unknown[] } {
  throw new Error("Not implemented");
}
