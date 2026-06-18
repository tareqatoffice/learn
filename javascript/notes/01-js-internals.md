# Phase 1 — JavaScript Internals & Runtime

---

## 1.1 The V8 Engine

### The Compilation Pipeline

V8 doesn't interpret JavaScript line by line. It compiles it — but not ahead of time like the C# compiler does. It uses **JIT (Just-In-Time) compilation**: compile as the code runs, optimise hot paths.

```
Source code
    ↓
Parser → AST (Abstract Syntax Tree)
    ↓
Ignition (interpreter) → Bytecode   ← runs immediately
    ↓ (hot functions profiled)
TurboFan (optimising compiler) → Optimised machine code
    ↓ (if assumptions break)
Deoptimisation → back to bytecode
```

**Why this matters:** The first time a function runs, it's bytecode — fast enough. Once it runs many times ("hot"), TurboFan kicks in and compiles it to native machine code that rivals C performance. But that optimisation comes with assumptions. Break the assumptions → deoptimise → slow path again.

### Hidden Classes

V8 doesn't store objects as hash maps. It tracks **hidden classes** (also called "shapes" or "maps") — an internal representation of an object's structure.

```js
// V8 creates hidden class C0 for {}
const obj = {};

// Transitions to new hidden class C1: { x: number }
obj.x = 1;

// Transitions to C2: { x: number, y: number }
obj.y = 2;
```

Two objects with the same properties added in the same order **share** the same hidden class — V8 can then treat them like a C struct, with property access as a fixed offset rather than a hash lookup.

**The trap — always build objects the same way:**

```js
// BAD: two different hidden classes → can't share optimised code
function makePoint(flip) {
  const p = {};
  if (flip) {
    p.y = 0; p.x = 0;  // C: { y, x }
  } else {
    p.x = 0; p.y = 0;  // C: { x, y }
  }
  return p;
}

// GOOD: always same order → same hidden class
function makePoint() {
  return { x: 0, y: 0 };
}
```

**`delete` is a hidden class killer:**

```js
const obj = { x: 1, y: 2 };
delete obj.x;  // transitions to a new hidden class — V8 may fall back to hash map
```

Never `delete` properties on hot objects. Set to `null` / `undefined` instead.

### Inline Caches (ICs)

When V8 sees `obj.x` for the first time, it looks up the hidden class to find the offset of `x`. Rather than do this every time, it caches the hidden class + offset pair — an **inline cache**.

- **Monomorphic IC:** same hidden class every time → fastest
- **Polymorphic IC:** 2–4 different hidden classes → still fast
- **Megamorphic IC:** 5+ different hidden classes → V8 gives up, generic lookup

```js
// Monomorphic — all points have same hidden class
function getX(point) { return point.x; }
getX({ x: 1, y: 2 });
getX({ x: 3, y: 4 });
getX({ x: 5, y: 6 });

// Megamorphic — each call passes a differently-shaped object
function getProp(obj) { return obj.value; }
getProp({ value: 1, a: 2 });
getProp({ value: 2, b: 3 });
getProp({ value: 3, c: 4 });
getProp({ value: 4, d: 5 });
getProp({ value: 5, e: 6 });  // IC goes megamorphic after this
```

### Deoptimisation Triggers

TurboFan compiles a function by making type assumptions. When those assumptions are violated at runtime, V8 **deoptimises** — discards the machine code, falls back to bytecode, and marks the function. It may re-optimise later, but deopt has a cost.

Common triggers:

```js
// 1. Changing an argument's type between calls
function add(a, b) { return a + b; }
add(1, 2);        // V8 assumes number + number
add('a', 'b');    // DEOPT — string + string

// 2. Out-of-bounds array access
const arr = [1, 2, 3];
arr[10];          // sparse access → may deopt array as "holey"

// 3. Using `arguments` object in modern code
function old() {
  return Array.from(arguments);  // prevents some optimisations
}
// BETTER: use rest params
function modern(...args) {
  return args;
}

// 4. try/catch around hot code (pre V8 8.x — mostly fixed now)
// 5. eval() — prevents static scope analysis entirely
```

**How to check:** `node --trace-deopt yourscript.js` or Chrome DevTools Performance tab → look for "Deoptimize" markers.

---

## 1.2 The Event Loop — Deep Mechanics

### The Components

```
┌─────────────────────────────────┐
│           Call Stack            │  ← synchronous execution
└─────────────────────────────────┘
          ↑ pops from queue
┌─────────────────────────────────┐
│      Microtask Queue            │  ← Promise callbacks, queueMicrotask
│  (drained completely each tick) │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│       Macrotask Queue           │  ← setTimeout, setInterval, I/O
│  (one task per event loop tick) │
└─────────────────────────────────┘
```

The rule: **after every macrotask, drain the entire microtask queue before moving to the next macrotask.**

### Node.js Event Loop Phases

Node's event loop has specific phases (from libuv):

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout, setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  I/O errors from prev iteration
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  internal use
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  retrieve new I/O events; blocks here if idle
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  socket.on('close', ...) etc.
   └───────────────────────────┘
```

**Between each phase, the microtask queue is drained** (and `process.nextTick` before that).

### Priority Order: nextTick > microtasks > timers

```js
setTimeout(() => console.log('1: setTimeout'), 0);

Promise.resolve().then(() => console.log('2: Promise'));

queueMicrotask(() => console.log('3: queueMicrotask'));

process.nextTick(() => console.log('4: nextTick'));

console.log('5: sync');
```

Output:
```
5: sync
4: nextTick          ← process.nextTick drains before microtask queue
2: Promise           ← microtask queue
3: queueMicrotask    ← also microtask queue (same queue as Promise.then)
1: setTimeout        ← macrotask, next event loop tick
```

**`process.nextTick` runs before the microtask queue** — it has its own queue that's drained first. This is a Node.js-specific behaviour with no browser equivalent.

### `setTimeout(fn, 0)` vs `setImmediate()`

```js
// When called from the main module (outside I/O):
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Order is NON-DETERMINISTIC here — depends on OS timer resolution
```

```js
// When called from inside an I/O callback:
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// Order IS deterministic: 'immediate' always first
// Because we're already in the poll phase — check phase comes next
```

**Rule of thumb:** inside I/O callbacks, `setImmediate` always runs before `setTimeout(fn, 0)`.

### Starving the Event Loop

The event loop can only process I/O callbacks when the call stack is empty. Heavy synchronous work blocks everything:

```js
// This blocks the event loop for ~1 second — no I/O handled during this time
function blockingWork() {
  const start = Date.now();
  while (Date.now() - start < 1000) {}
}

http.createServer((req, res) => {
  blockingWork();  // every other request waits 1 second
  res.end('done');
}).listen(3000);
```

**Fix options:**
1. Move to a **worker thread** (CPU-bound work)
2. Break into chunks with `setImmediate` between chunks
3. Use async I/O — never block on I/O

```js
// Breaking synchronous work into chunks — yields to event loop between chunks
function processInChunks(items, chunkSize, fn) {
  let index = 0;
  function processChunk() {
    const end = Math.min(index + chunkSize, items.length);
    for (; index < end; index++) {
      fn(items[index]);
    }
    if (index < items.length) {
      setImmediate(processChunk);  // yield to event loop
    }
  }
  processChunk();
}
```

---

## 1.3 Closures & Scope In Depth

### Lexical Environment

Every function execution creates a **Lexical Environment** — a record of variable bindings + a reference to the outer environment. This is the scope chain.

```js
function outer() {
  const x = 10;

  function inner() {
    const y = 20;
    console.log(x + y);  // inner's env has y; walks chain to find x in outer's env
  }

  return inner;
}

const fn = outer();  // outer() is done — its stack frame is gone
fn();  // 30 — but x is still alive because inner() holds a reference to outer's env
```

The **closure** is `inner` + its reference to `outer`'s lexical environment. The environment lives on the heap as long as `inner` is referenced.

### Closure Memory Implications

A closure keeps the **entire enclosing scope** alive, not just the variables it uses:

```js
function createLeak() {
  const bigData = new Array(1_000_000).fill('x');  // 1MB
  const small = 42;

  return function() {
    return small;  // only uses `small`...
  };
  // ...but `bigData` also stays in memory because it's in the same scope
}

const fn = createLeak();  // bigData is now uncollectable via fn
```

**Fix — explicitly null out what you don't need:**

```js
function createLeak() {
  let bigData = new Array(1_000_000).fill('x');
  const result = process(bigData);
  bigData = null;  // release before closure captures scope

  return function() {
    return result;
  };
}
```

Modern V8 is smart enough to avoid capturing unused variables in some cases, but don't rely on it.

### `var` Hoisting vs `let`/`const` TDZ

```js
// var is hoisted to function scope, initialised to undefined
console.log(x);  // undefined — NOT ReferenceError
var x = 5;
console.log(x);  // 5

// Equivalent to:
var x;           // hoisted declaration
console.log(x);  // undefined
x = 5;
console.log(x);  // 5
```

```js
// let/const are hoisted to block scope but NOT initialised — Temporal Dead Zone (TDZ)
console.log(y);  // ReferenceError: Cannot access 'y' before initialization
let y = 5;
```

The TDZ exists from the start of the block until the declaration line. The variable exists in the scope but is not accessible.

### The Classic Loop Trap

```js
// var — all callbacks share the same `i` (the final value: 3)
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3

// let — each iteration creates a new binding
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 0, 1, 2

// var workaround before let existed — IIFE to capture value
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 100);
  })(i);
}
// Output: 0, 1, 2
```

### Module Pattern vs ES Modules

The module pattern uses closures to create private state before `import`/`export` existed:

```js
// Module pattern — IIFE returning public API
const Counter = (() => {
  let count = 0;  // private

  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
})();

Counter.increment();
Counter.increment();
console.log(Counter.value());  // 2
console.log(Counter.count);    // undefined — private
```

ES modules have **static** scope — the module's top-level scope is the closure, and exports are live bindings (not copies):

```js
// counter.mjs
let count = 0;
export const increment = () => ++count;
export const value = () => count;

// main.mjs
import { increment, value } from './counter.mjs';
increment();
console.log(value());  // 1 — the live binding, not a snapshot
```

---

## 1.4 Prototypes & Inheritance

### The Prototype Chain

Every object has an internal `[[Prototype]]` slot. When you access `obj.prop`, JS looks on the object, then walks the chain:

```
obj → obj's prototype → prototype's prototype → ... → Object.prototype → null
```

```js
const animal = { breathes: true };
const dog = Object.create(animal);  // dog.[[Prototype]] = animal
dog.barks = true;

console.log(dog.barks);    // true — own property
console.log(dog.breathes); // true — found on prototype
console.log(dog.hasOwnProperty('barks'));    // true
console.log(dog.hasOwnProperty('breathes')); // false
```

### `__proto__` vs `prototype` vs `Object.getPrototypeOf()`

- `obj.__proto__` — accessor to `[[Prototype]]`, deprecated but widely supported
- `Object.getPrototypeOf(obj)` — standard way to read `[[Prototype]]`
- `Object.setPrototypeOf(obj, proto)` — standard way to set it (avoid — kills V8 optimisations)
- `Fn.prototype` — the object that will become `[[Prototype]]` of instances created with `new Fn()`

```js
function Dog(name) {
  this.name = name;
}
Dog.prototype.bark = function() { return `${this.name} barks`; };

const rex = new Dog('Rex');
console.log(Object.getPrototypeOf(rex) === Dog.prototype); // true
console.log(rex.__proto__ === Dog.prototype);              // true (same thing)
console.log(rex.bark());  // "Rex barks" — found on Dog.prototype
```

### `class` is Syntactic Sugar

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound`;
  }
}

class Dog extends Animal {
  speak() {
    return `${this.name} barks`;
  }
}
```

This compiles to exactly the same prototype-based structure:

```js
// What class Animal roughly desugars to:
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  return `${this.name} makes a sound`;
};

// class Dog extends Animal desugars to:
function Dog(name) {
  Animal.call(this, name);  // super()
}
Object.setPrototypeOf(Dog.prototype, Animal.prototype);  // extends
Dog.prototype.speak = function() {
  return `${this.name} barks`;
};
```

**Key differences from C# inheritance:**
- No true private fields before `#field` syntax (Stage 4)
- No method overloading — same name replaces the prototype method
- Prototype chain is mutable at runtime (whereas .NET class hierarchy is fixed at compile time)

### `instanceof` and Realm Pitfalls

```js
[] instanceof Array;           // true
[] instanceof Object;          // true (Array.prototype is in Object.prototype's chain)
```

`instanceof` checks if `Constructor.prototype` appears anywhere in the prototype chain. It **lies across realms** (different `window`/`vm` contexts):

```js
// In Node.js:
const vm = require('vm');
const arr = vm.runInNewContext('[]');  // array from different context
arr instanceof Array;  // false — different Array.prototype
Array.isArray(arr);    // true — isArray checks internal [[Class]], not prototype
```

**Use `Array.isArray()` instead of `instanceof Array`.**

---

## 1.5 Memory Management & Garbage Collection

### Stack vs Heap

- **Stack:** primitive values (`number`, `boolean`, `string` references, `undefined`, `null`), function call frames — fast allocation, automatic deallocation when frame pops
- **Heap:** objects, arrays, closures, functions — managed by GC

```js
function example() {
  const x = 42;         // stack — gone when function returns
  const obj = { a: 1 }; // reference on stack, actual object on heap
}
```

### V8's Generational GC

V8 splits the heap into generations — based on the observation that most objects die young:

**Young generation (Nursery → Intermediate):**
- Small (~1–8MB), collected frequently (every few ms)
- Algorithm: **Scavenger** (Cheney's copying GC) — copies survivors to a new space, discards the old
- Objects that survive two scavenges are promoted to the old generation

**Old generation:**
- Large (100s of MB), collected infrequently
- Algorithm: **Mark-Sweep** (finds live objects, sweeps dead) + **Mark-Compact** (defragments)
- Concurrent and incremental — runs in background to reduce pause times

```
New Space (Young Gen)      Old Space (Old Gen)
┌──────────────────┐       ┌──────────────────────────┐
│  From-Space      │  ──►  │  Long-lived objects       │
│  (active)        │       │  (promoted after 2 GCs)   │
├──────────────────┤       └──────────────────────────┘
│  To-Space        │
│  (survivors go)  │
└──────────────────┘
```

### Common Memory Leaks

**1. Closures holding large objects:**

```js
// See section 1.3 for the detailed example
```

**2. Forgotten timers:**

```js
class Widget {
  constructor() {
    this.timer = setInterval(() => {
      this.render();  // `this` is captured → Widget can't be GC'd
    }, 1000);
  }

  destroy() {
    clearInterval(this.timer);  // MUST do this — otherwise Widget leaks
  }
}
```

**3. Accumulating event listeners:**

```js
// Leak — listener accumulates every time addHandler is called
function addHandler() {
  document.addEventListener('click', () => {
    console.log('clicked');
  });
}

// Fix — use a named function so you can removeEventListener
function handler() { console.log('clicked'); }
document.addEventListener('click', handler);
// later:
document.removeEventListener('click', handler);
```

**4. Global variable accumulation:**

```js
function process(data) {
  globalCache = data;  // accidentally global (missing `const`/`let`)
}
```

### `WeakMap`, `WeakRef`, `FinalizationRegistry`

`WeakMap` — keys held weakly: if the key object is GC'd, the entry is automatically removed. Perfect for attaching metadata to objects without preventing collection:

```js
const metadata = new WeakMap();

class Node {
  constructor(value) {
    this.value = value;
    metadata.set(this, { createdAt: Date.now() });
  }
}

let node = new Node(42);
console.log(metadata.get(node));  // { createdAt: ... }
node = null;  // node object can be GC'd; WeakMap entry also disappears
```

`WeakRef` — hold a reference that doesn't prevent GC:

```js
let obj = { data: 'heavy payload' };
const ref = new WeakRef(obj);

obj = null;  // allow GC

// Later:
const current = ref.deref();
if (current) {
  // object is still alive
} else {
  // GC'd — need to recreate
}
```

`FinalizationRegistry` — run a callback when an object is GC'd (non-deterministic timing):

```js
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`Object was GC'd: ${heldValue}`);
});

let obj = { data: 'stuff' };
registry.register(obj, 'my-object');
obj = null;  // at some point: "Object was GC'd: my-object"
```

### Profiling Heap in Node.js

```bash
# Take a heap snapshot
node --inspect yourscript.js
# Then open chrome://inspect → Memory → Take snapshot
```

```js
// Programmatic heap snapshot (Node.js)
const v8 = require('v8');
const fs = require('fs');

const snapshot = v8.writeHeapSnapshot();
console.log(`Snapshot written to: ${snapshot}`);
```

---

## 1.6 `this` — The Full Story

`this` is not lexically scoped like variables — it's determined by **how a function is called**, not where it's defined. (Exception: arrow functions.)

### The Four Rules (in priority order)

**1. `new` binding — highest priority:**

```js
function Person(name) {
  this.name = name;
}
const p = new Person('Alice');
// `this` inside the call = the newly created object
```

**2. Explicit binding — `call`, `apply`, `bind`:**

```js
function greet() { return `Hello, ${this.name}`; }

const obj = { name: 'Alice' };
greet.call(obj);   // "Hello, Alice"
greet.apply(obj);  // "Hello, Alice" — same but args as array
const bound = greet.bind(obj);
bound();           // "Hello, Alice" — returns new function, `this` permanently bound
```

**3. Implicit binding — method call:**

```js
const obj = {
  name: 'Alice',
  greet() { return `Hello, ${this.name}`; },
};
obj.greet();  // "Hello, Alice" — `this` = obj (the object before the dot)

// The trap — lost implicit binding
const fn = obj.greet;
fn();  // "Hello, undefined" — no object before the dot → default binding
```

**4. Default binding — lowest priority:**

```js
function show() { return this; }
show();  // `this` = global object (window/global) in non-strict, undefined in strict mode
```

### Arrow Functions — Lexical `this`

Arrow functions don't have their own `this`. They capture `this` from the **lexically enclosing scope** at the time of definition:

```js
class Timer {
  constructor() {
    this.seconds = 0;
  }

  start() {
    // Regular function — `this` is undefined inside callback (strict mode)
    setInterval(function() {
      this.seconds++;  // TypeError: Cannot read property 'seconds' of undefined
    }, 1000);

    // Arrow function — captures `this` from start() method scope = Timer instance
    setInterval(() => {
      this.seconds++;  // works correctly
    }, 1000);
  }
}
```

### Class Methods and Lost `this`

```js
class Button {
  constructor(label) {
    this.label = label;
  }

  handleClick() {
    console.log(`Clicked: ${this.label}`);
  }
}

const btn = new Button('Submit');
document.addEventListener('click', btn.handleClick);
// `this` inside handleClick = the DOM element, not the Button instance

// Fix 1 — bind in constructor
constructor(label) {
  this.label = label;
  this.handleClick = this.handleClick.bind(this);
}

// Fix 2 — arrow method (class field syntax)
handleClick = () => {
  console.log(`Clicked: ${this.label}`);
};
// Arrow class field is syntactic sugar for binding in the constructor
```

---

## 1.7 Symbols, Iterators & Generators

### Symbols

`Symbol()` creates a globally unique value — no two symbols are ever equal:

```js
const id1 = Symbol('id');
const id2 = Symbol('id');
console.log(id1 === id2);  // false — always unique

// Use case: non-colliding object keys
const KEY = Symbol('internalKey');
const obj = { [KEY]: 'secret', name: 'public' };
console.log(Object.keys(obj));  // ['name'] — symbols don't appear
console.log(obj[KEY]);          // 'secret'
```

**Well-known symbols — hooks into JS built-in behaviour:**

```js
// Symbol.iterator — make any object iterable
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  },
};

for (const n of range) {
  console.log(n);  // 1 2 3 4 5
}
console.log([...range]);  // [1, 2, 3, 4, 5]

// Symbol.toPrimitive — control type coercion
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    if (hint === 'string') return `${this.amount} ${this.currency}`;
    return this.amount;  // default
  }
}

const price = new Money(42, 'USD');
console.log(+price);       // 42 (number hint)
console.log(`${price}`);   // "42 USD" (string hint)
console.log(price + 10);   // 52 (default hint)
```

### The Iterator Protocol

An **iterable** has `[Symbol.iterator]()` returning an **iterator**. An **iterator** has `next()` returning `{ value, done }`.

```js
// Manual iterator — anything with this shape is iterable
function makeCounter(start, end) {
  let current = start;
  return {
    [Symbol.iterator]() { return this; },  // iterator is also iterable
    next() {
      return current <= end
        ? { value: current++, done: false }
        : { value: undefined, done: true };
    },
  };
}

const counter = makeCounter(1, 3);
console.log([...counter]);  // [1, 2, 3]
```

### Generator Functions

Generators let you **pause** function execution and resume later — much cleaner way to write iterators:

```js
function* counter(start, end) {
  for (let i = start; i <= end; i++) {
    yield i;  // pause here, return i
  }
}

const gen = counter(1, 3);
console.log(gen.next());  // { value: 1, done: false }
console.log(gen.next());  // { value: 2, done: false }
console.log(gen.next());  // { value: 3, done: false }
console.log(gen.next());  // { value: undefined, done: true }

// Generators are iterable
console.log([...counter(1, 3)]);  // [1, 2, 3]
for (const n of counter(1, 3)) {
  console.log(n);  // 1 2 3
}
```

**Generators are lazy** — values computed on demand, no array allocated:

```js
// Infinite sequence — works because lazy
function* naturals() {
  let n = 1;
  while (true) yield n++;
}

function* take(n, iterable) {
  for (const item of iterable) {
    if (n-- <= 0) break;
    yield item;
  }
}

console.log([...take(5, naturals())]);  // [1, 2, 3, 4, 5]
```

**Two-way communication — `gen.next(value)` sends a value back in:**

```js
function* adder() {
  let sum = 0;
  while (true) {
    const input = yield sum;  // yields current sum, receives next input
    if (input === null) return sum;
    sum += input;
  }
}

const gen = adder();
gen.next();       // start (run to first yield)
gen.next(5);      // input = 5, sum = 5
gen.next(3);      // input = 3, sum = 8
console.log(gen.next(null).value);  // 8 — final return
```

### Async Generators

Combine generators with async/await for **async lazy sequences**:

```js
async function* paginate(url) {
  let page = 1;
  while (true) {
    const res = await fetch(`${url}?page=${page}`);
    const data = await res.json();
    if (data.items.length === 0) return;
    yield data.items;
    page++;
  }
}

// Consume with for await...of
for await (const items of paginate('https://api.example.com/posts')) {
  console.log(items);  // one page at a time, fetched lazily
}
```

**Node.js readable streams are async iterables:**

```js
const fs = require('fs');
const readline = require('readline');

async function processLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
  });

  for await (const line of rl) {
    console.log(line);  // one line at a time, memory efficient
  }
}
```

---

## Gotchas

- **`typeof null === 'object'`** — a historic bug in JS, never fixed for backwards compat. Use `=== null` to check for null.
- **`NaN !== NaN`** — the only value not equal to itself. Use `Number.isNaN(x)`, not `x === NaN`.
- **`0 === -0`** is `true` — use `Object.is(0, -0)` → `false` if you need to distinguish.
- **`[] + []` is `""`** and **`[] + {}` is `"[object Object]"`** — type coercion in `+`.
- **`delete` on array elements** — creates a hole, length unchanged. Use `splice` instead.
- **`parseInt('08')` used to return `0`** — always pass radix: `parseInt('08', 10)`.
- **`setTimeout` minimum delay is ~4ms** in browsers after 5 nested calls — `setTimeout(fn, 0)` is not truly 0.
- **Generators are not async by default** — `function*` is synchronous. Use `async function*` for async iteration.
- **`process.nextTick` can starve I/O** — if callbacks keep scheduling more `nextTick`s, the event loop never advances to I/O phases.

---

## Phase 1 Mini-Project

**Task:** Build a custom async task scheduler using the event loop, generators, and closures — no `async`/`await` allowed.

**Requirements:**
- Schedule tasks with a priority level (high/normal/low)
- High-priority tasks run before normal, normal before low
- Tasks can yield control mid-execution (cooperative multitasking via generators)
- Scheduler exposes: `schedule(generatorFn, priority)`, `run()`, `stats()`
- `run()` processes tasks without blocking the event loop (use `setImmediate` between tasks)

**Location:** `examples/phase1-scheduler/`

**Hints:**
- Use a closure to hold the three priority queues
- Use generator functions for tasks — each `yield` is a cooperative handoff back to the scheduler
- `setImmediate` between tasks lets I/O callbacks fire (the event loop gets a turn)
- `stats()` can use another closure to accumulate completed task counts per priority

```js
// Usage target:
const scheduler = createScheduler();

scheduler.schedule(function* taskA() {
  console.log('A: step 1');
  yield;  // hand control back
  console.log('A: step 2');
}, 'normal');

scheduler.schedule(function* taskB() {
  console.log('B: high priority');
}, 'high');

scheduler.run(() => {
  console.log('All done:', scheduler.stats());
});

// Expected output:
// B: high priority
// A: step 1
// A: step 2
// All done: { high: 1, normal: 1, low: 0 }
```

---

## Interview Questions

### V8 & JIT

1. Why does V8 use JIT compilation instead of ahead-of-time compilation, and what specific trade-offs does that choice introduce?
2. What is the role of Ignition in V8's pipeline, and why does bytecode exist as an intermediate step rather than going straight to machine code?
3. When does TurboFan kick in, and what criteria does V8 use to decide a function is "hot" enough to optimise?
4. What exactly gets discarded during a deoptimisation, and how does V8 decide whether to attempt re-optimisation of the same function?
5. Why does passing arguments of different types across multiple calls to the same function cause a deoptimisation, and how would you reproduce and confirm this with Node.js flags?
6. What is a hidden class in V8, and why is it more efficient than treating an object as a hash map?
7. Under what conditions do two objects share the same hidden class, and why does property insertion order matter?
8. Why does using `delete` on an object property degrade V8 performance, and what should you do instead?
9. What is an inline cache and what are the three states (monomorphic, polymorphic, megamorphic) — when does each occur and what are the performance implications?
10. How would you identify a megamorphic function call site in a production codebase, and what refactoring would fix it?
11. What optimisations does V8 skip when `eval()` is present in a function's scope, and why?
12. Why does using the `arguments` object in a function hinder certain V8 optimisations, and how do rest parameters solve this?
13. Explain how `Object.setPrototypeOf()` at runtime affects V8's ability to optimise property accesses on that object.
14. How does V8's feedback vector work, and what role does it play in informing TurboFan's type assumptions?
15. What does the `--trace-deopt` flag actually output, and how would you use it to locate a performance bottleneck in a Node.js server?

### Event Loop

16. Describe precisely what happens between two consecutive macrotask executions in the Node.js event loop — what queues are drained and in what order?
17. Why does `process.nextTick` run before Promise microtasks, and what design decision in Node.js explains this ordering?
18. Under what conditions is the ordering between `setTimeout(fn, 0)` and `setImmediate()` non-deterministic, and why does being inside an I/O callback make it deterministic?
19. What does it mean to "starve the event loop" and what are three concrete ways it can happen in a Node.js server?
20. Why does a long-running synchronous loop inside an HTTP handler affect all other in-flight requests, not just the current one?
21. What is the poll phase responsible for in the Node.js event loop, and under what condition does it block?
22. How would you break a CPU-intensive synchronous task into chunks to avoid blocking the event loop, and what are the trade-offs of using `setImmediate` vs `setTimeout(fn, 0)` for yielding?
23. If a Promise `.then` callback schedules another `.then`, and that schedules another, could this theoretically starve the macrotask queue? Explain the mechanism.
24. What is `queueMicrotask()` and how does its scheduling position compare to `Promise.resolve().then()` — are they on the same queue?
25. Explain why `process.nextTick` recursion can block I/O in Node.js while the same pattern with `Promise.resolve()` would not block I/O indefinitely.
26. What happens to the call stack between event loop ticks — is it completely empty, and what does "empty call stack" mean for the event loop's ability to process the next macrotask?
27. How does libuv's thread pool relate to the event loop, and which Node.js APIs use the thread pool rather than OS-level async I/O?

### Memory & GC

28. Why does V8 use a generational garbage collector rather than a single-pass mark-sweep collector over the entire heap?
29. What is the Scavenger algorithm and why is copying live objects to a new space (Cheney's algorithm) more efficient for short-lived objects than mark-sweep?
30. When does an object get promoted from the young generation to the old generation, and what happens to its collection cost after promotion?
31. How can a closure cause a memory leak even if it only references a single small variable from its enclosing scope?
32. What is the difference between a `WeakMap` key being GC'd and a regular `Map` key being GC'd — what happens to the associated value in each case?
33. When would you use `WeakRef` over `WeakMap`, and what is the key constraint you must code defensively against when using `WeakRef.deref()`?
34. Why is `FinalizationRegistry` callback timing non-deterministic, and what category of problems is it appropriate for given that constraint?
35. Describe three patterns that commonly cause memory leaks in long-running Node.js servers and explain the GC mechanism that prevents collection in each case.
36. How does holding a reference to a DOM node inside a closure in a single-page application prevent the node from being GC'd even after it's removed from the DOM?
37. What tools and techniques would you use to diagnose a gradual memory increase (slow leak) in a production Node.js service without causing downtime?
38. Why does setting an object reference to `null` not immediately free the memory, and what does "eligible for collection" actually mean in practice?
39. What is the difference between a memory leak and heap fragmentation, and which does V8's Mark-Compact phase address?

### Closures & Scope

40. Why does `let` in a `for` loop create a new binding per iteration while `var` does not — what is happening at the specification level with each iteration's lexical environment?
41. What is the Temporal Dead Zone and why does the spec require it for `let`/`const` rather than just initialising them to `undefined` like `var`?
42. A function is returned from a factory and holds a closure over a large array, but only ever reads one small integer from that scope. Under what V8 conditions might the large array still remain in memory, and how would you guarantee it's released?
43. How do ES module exports differ from CommonJS exports in terms of live bindings vs value copies, and what closure mechanics underpin the ES module behaviour?
44. Explain how the module pattern (IIFE with a returned API object) achieves private state, and what specific limitation does it have compared to `#privateField` class syntax?
45. How does `var` hoisting interact with function declarations inside blocks in non-strict mode, and why is this a source of inconsistent behaviour across environments?

### Closures & `this`

46. Explain the four `this`-binding rules in priority order and give a scenario where each rule applies, including how `new` interacts with `bind`.
47. Why does extracting a method from an object and assigning it to a variable cause `this` to become `undefined` in strict mode — what is the binding mechanism at play?
48. What does an arrow function's `this` resolve to when it is defined inside a `constructor`, and how does this differ from a regular method on the class prototype?
49. Why can't you use `call`, `apply`, or `bind` to change the `this` of an arrow function, even though they accept a `thisArg` argument?
50. What is the difference between `Function.prototype.bind` returning a new function vs `call`/`apply` invoking immediately, and in what scenarios does each approach matter?
51. When a class field arrow function (e.g., `handleClick = () => {}`) is used as an event listener, where does `this` come from and what is the memory cost compared to a prototype method?

### Async/Await & Generators

52. What does the JavaScript engine create under the hood when it encounters `await` inside an `async` function — in terms of Promises and generator-like suspension?
53. Why does `await` inside a `try/catch` correctly catch rejected Promises, while `.then().catch()` chains can sometimes swallow errors silently?
54. What is the difference between `Promise.all`, `Promise.allSettled`, `Promise.race`, and `Promise.any` in terms of failure semantics — when would you choose each in a microservice context?
55. How does `for await...of` differ from `for...of` on a regular iterable — what protocol must the object implement and what happens if the async iterator throws?
56. Explain two-way communication in a generator using `gen.next(value)` — what does the value sent into `next()` become inside the generator, and why does the first `next()` call's argument get discarded?
57. What is a generator-based coroutine and how does it model cooperative multitasking — what is the generator analogue of a context switch?
58. How would you implement `Promise.all`-like concurrency using async generators, and what backpressure problem can arise if you don't consume the generator fast enough?
59. Why are generators lazy, and what are the memory advantages of using an infinite generator like `naturals()` over generating a large array upfront?
60. How does `yield*` work when delegating to another generator, and how does `return` from the delegated generator interact with the outer generator's iteration?
61. What happens to unhandled rejections inside an `async function` — how does the Node.js runtime surface them, and what changed between Node.js v14 and v15 regarding the default behaviour?

### Prototype Chain

62. How does `Object.create(null)` differ from `{}` in terms of the prototype chain, and in what use case would you deliberately want an object with no prototype?
63. Why does `instanceof` fail to correctly identify objects created in a different V8 context (realm), and what is the reliable alternative for arrays?
64. What is the difference between an object's `[[Prototype]]` and a constructor function's `.prototype` property — how do they relate when `new` is invoked?
65. Why is calling `Object.setPrototypeOf()` on an existing object considered a performance anti-pattern in V8, even if done only once?
66. How does property shadowing work on the prototype chain — what happens when you assign a property to an instance that already exists on its prototype, and does this always create an own property?
67. What is the performance cost of a property lookup that must traverse three levels of the prototype chain compared to an own property access, and how do inline caches mitigate this?
68. Why does `class Dog extends Animal` set up two prototype chains (one for instances and one for the constructor functions themselves), and what does `Dog.__proto__ === Animal` mean in practice?
