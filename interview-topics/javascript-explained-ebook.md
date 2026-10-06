# JavaScript, Explained
### A question-driven handbook for interviews and real understanding

---

## How to use this book

Every entry follows the same shape: **the question**, a **short answer** you could say out loud, then **why it works that way** with runnable code. Read the short answer first. If it already makes sense, move on. If it doesn't, the explanation below it is where the actual learning is.

Sections 1–5 are the foundation. Sections 6–9 are where most interviews actually get decided.

---

# Section 1 — Types, Values and Coercion

---

### Q1. What are the data types in JavaScript?

**Short answer:** Seven primitives — `string`, `number`, `bigint`, `boolean`, `undefined`, `symbol`, `null` — plus one non-primitive type, `object` (which includes arrays, functions, dates, maps, etc.).

**Explanation**

Primitives are immutable and compared by value. Objects are mutable and compared by reference.

```js
let a = "hi";
a[0] = "H";
console.log(a); // "hi"  — strings can't be mutated

let obj1 = { x: 1 };
let obj2 = { x: 1 };
console.log(obj1 === obj2); // false — two different references
```

The one famous wart:

```js
typeof null; // "object"
```

This is a bug from 1995 that can never be fixed without breaking the web. `null` is a primitive despite what `typeof` says. To test for it, use `value === null`.

> **Where you'll hit this**
> Parsing an API response. A JSON payload gives you `{ "discount": null, "coupon": undefined }` — except `undefined` never survives JSON, so the field is simply absent. Knowing that `typeof null === "object"` is why `typeof res.discount === "object"` passes and your "is this a nested object?" check silently accepts nulls and crashes one line later.

---

### Q2. What's the difference between `null` and `undefined`?

**Short answer:** `undefined` means "no value has been assigned yet" — it's the language's default. `null` means "intentionally empty" — it's a value *you* assign.

**Explanation**

```js
let x;
console.log(x); // undefined — JS gave it this

let y = null;   // you chose this
```

You get `undefined` from: uninitialised variables, missing function arguments, missing object properties, and functions with no `return`.

They're loosely equal but not strictly equal:

```js
null == undefined;  // true
null === undefined; // false
typeof undefined;   // "undefined"
typeof null;        // "object"
```

**Practical rule:** never assign `undefined` manually. Use `null` when you mean "deliberately nothing".

> **Where you'll hit this**
> Form state. An untouched field is `undefined` (never rendered, never typed in). A field the user actively cleared is `null` or `""`. Your PATCH request needs that distinction: send `null` to clear a column in the database, omit the key entirely to leave it unchanged. Collapsing the two is how users lose data they didn't mean to.

---

### Q3. `==` vs `===` — what actually happens?

**Short answer:** `===` compares type and value with no conversion. `==` converts operands to a common type first, then compares.

**Explanation**

The coercion rules for `==` are specific:

```js
1 == "1";        // true  — string converted to number
0 == false;      // true  — boolean converted to number
"" == 0;         // true
null == 0;       // false — null only equals undefined
null == undefined; // true
NaN == NaN;      // false — NaN equals nothing, including itself
[] == false;     // true  — [] → "" → 0, false → 0
[1] == 1;        // true  — [1] → "1" → 1
```

`[] == false` being `true` is the standard example of why teams ban `==`.

**Use `===` everywhere.** The single legitimate exception is `x == null`, which is a compact check for "null or undefined":

```js
if (value == null) { /* catches both null and undefined */ }
```

> **Where you'll hit this**
> A search filter with `if (filters.status == 0)`. A status of `"0"` from a query string passes, `false` passes, and `""` passes. On an admin dashboard where "0" means Draft, that's the difference between showing drafts and showing everything.

---

### Q4. What is type coercion? Explain implicit vs explicit.

**Short answer:** Coercion is JavaScript converting a value from one type to another. Explicit coercion is you calling `Number()`, `String()`, `Boolean()`. Implicit is the engine doing it silently inside an operation.

**Explanation**

```js
// Explicit
Number("42");    // 42
String(42);      // "42"
Boolean(0);      // false

// Implicit
"5" - 2;   // 3   — minus only works on numbers, so "5" → 5
"5" + 2;   // "52" — plus prefers string concatenation if either side is a string
true + 1;  // 2    — true → 1
[] + {};   // "[object Object]"
```

The `+` operator is the troublemaker: it's both addition and concatenation. If **either** operand is a string, it concatenates. Every other arithmetic operator converts to number.

> **Where you'll hit this**
> Query params and form inputs are always strings. `page + 1` gives `"11"` instead of `12` when `page` came from `?page=1`. Every off-by-a-concatenation bug in pagination is this. Coerce at the boundary: `const page = Number(params.page) || 1`.

---

### Q5. What are truthy and falsy values?

**Short answer:** There are exactly eight falsy values. Everything else is truthy.

**Explanation**

The complete falsy list:

```js
false
0
-0
0n        // BigInt zero
""        // empty string
null
undefined
NaN
```

Everything else is truthy — including things people expect to be falsy:

```js
Boolean([]);        // true — empty array is truthy
Boolean({});        // true — empty object is truthy
Boolean("0");       // true — non-empty string
Boolean("false");   // true
Boolean(function(){}); // true
```

This is why `if (arr)` never tells you whether an array has items. Use `if (arr.length)`.

> **Where you'll hit this**
> `if (!cart.items)` never fires, because `[]` is truthy — so your "your cart is empty" message never shows. Same for `if (config)` on `{}`. And on a quantity field, `if (!qty)` treats a legitimate `0` as missing.

---

### Q6. What is `NaN` and how do you check for it?

**Short answer:** `NaN` is the result of a failed numeric operation. It's the only value in JavaScript not equal to itself, so you check it with `Number.isNaN()`.

**Explanation**

```js
0 / 0;            // NaN
parseInt("abc");  // NaN
Math.sqrt(-1);    // NaN

NaN === NaN;      // false
```

Two ways to check, and they differ:

```js
isNaN("hello");        // true  — coerces first, misleading
Number.isNaN("hello"); // false — correct: the string isn't NaN
Number.isNaN(NaN);     // true
```

Always use `Number.isNaN`. The global `isNaN` coerces its argument, so it really means "is not a number-ish thing", which is a different question.

> **Where you'll hit this**
> A price column with a stray `"N/A"` in it. `total += Number(row.price)` turns the whole total into `NaN`, and every downstream calculation, chart axis and currency format silently becomes `NaN` too. One bad row poisons the report. Guard with `Number.isNaN` at parse time, not at display time.

---

### Q7. Why does `0.1 + 0.2 !== 0.3`?

**Short answer:** JavaScript numbers are IEEE-754 64-bit floats. 0.1 and 0.2 have no exact binary representation, so the sum carries a tiny rounding error.

**Explanation**

```js
0.1 + 0.2;              // 0.30000000000000004
0.1 + 0.2 === 0.3;      // false
```

Fix it by comparing within a tolerance:

```js
const nearlyEqual = (a, b, eps = Number.EPSILON) => Math.abs(a - b) < eps;
nearlyEqual(0.1 + 0.2, 0.3); // true
```

For money, never use floats. Store amounts as integers in the smallest unit (paisa, cents) or use a decimal library.

> **Where you'll hit this**
> Invoice totals. `19.99 * 3` gives `59.97000000000001`, and comparing a computed total to a stored one with `===` fails on rows that are actually correct. Store money in paisa/cents as integers, divide only when you render.

---

### Q8. What is `BigInt` and when do you need it?

**Short answer:** `BigInt` represents integers beyond `Number.MAX_SAFE_INTEGER` (2^53 − 1). You need it for large IDs, precise counters, and cryptography.

**Explanation**

```js
Number.MAX_SAFE_INTEGER;      // 9007199254740991
9007199254740991 + 2;         // 9007199254740992  ← wrong

const big = 9007199254740991n;
big + 2n;                     // 9007199254740993n ← correct
```

You cannot mix BigInt and Number in arithmetic:

```js
1n + 1;   // TypeError
1n + BigInt(1); // 2n
```

> **Where you'll hit this**
> Snowflake IDs from Twitter/Discord, or 64-bit primary keys from a database. `JSON.parse` reads them as Numbers and quietly rounds the last few digits, so you fetch the wrong record. The fix is to keep such IDs as strings end-to-end, or use BigInt with a custom reviver.

---

# Section 2 — Scope, Hoisting and Declarations

---

### Q9. `var`, `let`, and `const` — what's the real difference?

**Short answer:** `var` is function-scoped and hoisted as `undefined`. `let` and `const` are block-scoped and sit in the temporal dead zone until initialised. `const` prevents reassignment, not mutation.

**Explanation**

| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | function | block | block |
| Hoisted | yes, as `undefined` | yes, but TDZ | yes, but TDZ |
| Redeclare in same scope | yes | no | no |
| Reassign | yes | yes | no |
| On `globalThis` | yes | no | no |

```js
function demo() {
  if (true) {
    var a = 1;
    let b = 2;
  }
  console.log(a); // 1 — var escaped the block
  console.log(b); // ReferenceError
}
```

The `const` misunderstanding:

```js
const user = { name: "Ana" };
user.name = "Bea";   // fine — the object is mutable
user = {};           // TypeError — the binding can't be reassigned
```

`const` freezes the *binding*, not the value. For a shallow immutable object use `Object.freeze()`.

> **Where you'll hit this**
> The classic: a table of rows with `var row` inside a loop, where every "Edit" button ends up editing the last row. Also `const` on a config object that a helper function then mutates — the lint rule passes, the bug ships. `const` is a promise about the variable, not about the data.

---

### Q10. What is hoisting?

**Short answer:** During compilation, declarations are registered in their scope before any code runs. `var` and function declarations become usable early; `let`/`const`/`class` are registered but unusable until their line executes.

**Explanation**

```js
console.log(x);   // undefined — declaration hoisted, assignment not
var x = 5;

console.log(y);   // ReferenceError: Cannot access 'y' before initialization
let y = 5;

greet();          // "hi" — function declarations are fully hoisted
function greet() { console.log("hi"); }

speak();          // TypeError: speak is not a function
var speak = function () {};  // only the var is hoisted, as undefined
```

Note the two different errors. `ReferenceError` means the binding exists but is in the TDZ. `TypeError` means the binding exists, holds `undefined`, and you tried to call it.

> **Where you'll hit this**
> A utility file where you call `formatDate()` at the top and define it at the bottom — works, because function declarations hoist. Convert it to `const formatDate = () => {}` during a refactor and it throws immediately. That's why "arrow functions everywhere" refactors break in ways that look unrelated.

---

### Q11. What is the Temporal Dead Zone?

**Short answer:** The stretch between entering a scope and the line where a `let`/`const`/`class` binding is initialised. Touching the variable in that window throws.

**Explanation**

```js
{
  // TDZ for `n` starts here
  console.log(typeof n); // ReferenceError — even typeof throws in the TDZ
  let n = 1;             // TDZ ends here
  console.log(n);        // 1
}
```

The TDZ exists so that `const` genuinely means "assigned exactly once" and so that using a variable before its declaration is a loud error rather than a silent `undefined`.

> **Where you'll hit this**
> Circular imports between modules. Module A imports B, B imports A, and one of them reads an exported `const` before the other has finished evaluating — `ReferenceError: Cannot access 'X' before initialization`. The TDZ is what turns a silent `undefined` into a loud error pointing at the real problem.

---

### Q12. Explain lexical scope and the scope chain.

**Short answer:** A function's scope is determined by where it's *written* in the source, not where it's called. Lookups walk outward through enclosing scopes until they hit the global scope.

**Explanation**

```js
const level = "global";

function outer() {
  const level = "outer";
  function inner() {
    console.log(level); // "outer" — found in the nearest enclosing scope
  }
  inner();
}
outer();
```

Even if `inner` were passed elsewhere and called from a completely different place, it would still print `"outer"`. That's what "lexical" means — fixed at authoring time.

> **Where you'll hit this**
> A `createLogger(prefix)` factory. Every logger it returns keeps its own `prefix` because of where it was written, not where it's called — so the same logger works identically whether it's invoked from a route handler, a worker, or a test.

---

### Q13. What is a closure? Give a real use.

**Short answer:** A closure is a function bundled with the scope it was created in. It keeps that scope alive after the outer function has returned.

**Explanation**

```js
function counter() {
  let count = 0;              // stays alive
  return {
    increment: () => ++count,
    get value() { return count; }
  };
}

const c = counter();
c.increment();
c.increment();
console.log(c.value); // 2
console.log(c.count); // undefined — genuinely private
```

Real uses: private state, function factories, memoisation caches, `once()` wrappers, and every debounce/throttle implementation.

The classic interview trap:

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 3, 3, 3 — one shared `i`, read after the loop ends

for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 0, 1, 2 — `let` creates a fresh binding per iteration
```

> **Where you'll hit this**
> Rate limiters, connection pools, and "run this only once" guards. Also every React hook: `useState` returns a setter that closes over which slot in the component it owns. And the stale-closure bug — an event handler capturing an old `count` — is the same mechanism working against you.

---

### Q14. What is an IIFE and why was it used?

**Short answer:** An Immediately Invoked Function Expression runs the moment it's defined. Before ES6 modules and `let`, it was the only way to avoid polluting the global scope.

**Explanation**

```js
(function () {
  var secret = "hidden";
})();
console.log(typeof secret); // "undefined"
```

The wrapping parentheses turn the function *declaration* into an *expression*, which can then be called.

Today, blocks with `let` and ES modules cover most of what IIFEs were for. You'll still see them in bundled library code and in `(async () => { ... })()` when you need `await` at the top level of a non-module script.

> **Where you'll hit this**
> Legacy scripts loaded with `<script>` tags where two vendor libraries both define `$`. Also useful today for top-level `await` in a plain script: `(async () => { await init(); })()`.

---

# Section 3 — Functions and `this`

---

### Q15. How does `this` get its value?

**Short answer:** For normal functions, `this` is decided at call time by *how* the function is called. Arrow functions have no `this` of their own — they inherit it lexically.

**Explanation**

Five binding rules, in priority order:

```js
// 1. new binding
function Person(n) { this.name = n; }
const p = new Person("Ana");   // this = the new object

// 2. explicit binding
function show() { console.log(this.tag); }
show.call({ tag: "A" });       // this = { tag: "A" }

// 3. method / implicit binding
const obj = { tag: "B", show };
obj.show();                    // this = obj

// 4. default binding
show();  // this = globalThis (or undefined in strict mode)

// 5. arrow functions — ignore all of the above
const arrow = () => console.log(this);
```

The most common bug in real code:

```js
const timer = {
  seconds: 0,
  startBroken() {
    setInterval(function () {
      this.seconds++;   // `this` is not `timer` here
    }, 1000);
  },
  startFixed() {
    setInterval(() => {
      this.seconds++;   // arrow inherits `this` from startFixed
    }, 1000);
  }
};
```

> **Where you'll hit this**
> A class method passed straight to `addEventListener` or `setTimeout` loses `this` and throws "cannot read property of undefined". This is the single most common runtime error in class-based components, and the reason `this.handleClick = this.handleClick.bind(this)` filled every old React constructor.

---

### Q16. Arrow functions vs regular functions.

**Short answer:** Arrows have no own `this`, no `arguments`, no `prototype`, can't be called with `new`, and can't be generators. They're for short callbacks, not for object methods or constructors.

**Explanation**

```js
const obj = {
  name: "Ana",
  regular() { return this.name; },
  arrow: () => this?.name
};
obj.regular(); // "Ana"
obj.arrow();   // undefined — `this` came from the module/global scope
```

Never use an arrow as an object method that needs `this`, or as a prototype method. Do use them for callbacks inside methods, where lexical `this` is exactly what you want.

> **Where you'll hit this**
> Arrow for the `.map` callback inside a component, regular function for the object method that needs `this`. Get it backwards and either your callback can't see the component or your method can't see the object. Also: an arrow can't be a constructor, so `new` on one throws — worth knowing before you convert a factory function.

---

### Q17. `call`, `apply`, and `bind` — differences?

**Short answer:** `call` invokes with a given `this` and comma-separated args. `apply` is the same but takes an array. `bind` doesn't invoke — it returns a new permanently bound function.

**Explanation**

```js
function intro(greeting, punct) {
  return `${greeting}, I'm ${this.name}${punct}`;
}
const user = { name: "Ana" };

intro.call(user, "Hi", "!");     // "Hi, I'm Ana!"
intro.apply(user, ["Hi", "!"]);  // same, array form
const bound = intro.bind(user);
bound("Hey", ".");               // "Hey, I'm Ana."
```

Memory hook: **c**all = **c**ommas, **a**pply = **a**rray, **b**ind = **b**ound for later.

`bind` also supports partial application:

```js
const double = ((a, b) => a * b).bind(null, 2);
double(21); // 42
```

A bound function cannot be re-bound — the first `bind` wins.

> **Where you'll hit this**
> Borrowing array methods on a NodeList or `arguments`: `Array.prototype.slice.call(nodeList)`. And in event handling, `handler.bind(this, itemId)` gives you a listener that already knows which row it belongs to — no closure or data attribute needed.

---

### Q18. What is currying?

**Short answer:** Transforming `f(a, b, c)` into `f(a)(b)(c)` — a chain of single-argument functions.

**Explanation**

```js
const curry = (fn) =>
  function curried(...args) {
    return args.length >= fn.length
      ? fn.apply(this, args)
      : (...rest) => curried.apply(this, [...args, ...rest]);
  };

const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1)(2)(3);   // 6
curriedAdd(1, 2)(3);   // 6
curriedAdd(1)(2, 3);   // 6
```

`fn.length` is the number of declared parameters, which is how the wrapper knows when it has enough. Currying is useful for building specialised functions from general ones: `const addTax = curriedRate(0.15)`.

> **Where you'll hit this**
> Configured API clients: `const api = request(baseUrl)` then `api('/users')`. Or validation: `const minLength = (n) => (val) => val.length >= n`, letting you build `minLength(8)` once and reuse it across every password field.

---

### Q19. Default, rest, and spread — what's the difference?

**Short answer:** Rest (`...` in a parameter list) collects many values into an array. Spread (`...` in a call or literal) expands one iterable into many values. Same syntax, opposite directions.

**Explanation**

```js
// rest — gathers
function sum(first, ...others) {
  return others.reduce((t, n) => t + n, first);
}
sum(1, 2, 3, 4); // 10

// spread — scatters
const nums = [1, 2, 3];
Math.max(...nums);           // 3
const copy = [...nums];      // shallow copy
const merged = { ...a, ...b }; // later keys win
```

Defaults are evaluated at call time, left to right, and can reference earlier parameters:

```js
function area(w, h = w) { return w * h; }
area(5);    // 25
area(5, 2); // 10
```

Note: `undefined` triggers the default, `null` does not.

```js
area(5, undefined); // 25
area(5, null);      // 0
```

> **Where you'll hit this**
> `function createUser({ role = "viewer", ...profile })` — rest collects whatever extra fields the caller sent so you can pass them through untouched, while defaults fill in what's missing. Spread is how you build the next state object in Redux or `useState` without mutating the old one.

---

### Q20. What is a pure function?

**Short answer:** Same input always gives the same output, and it causes no side effects.

**Explanation**

```js
// Pure
const add = (a, b) => a + b;

// Impure — mutates its argument
const pushItem = (arr, x) => { arr.push(x); return arr; };

// Pure alternative
const withItem = (arr, x) => [...arr, x];

// Impure — depends on external state
let rate = 0.15;
const tax = (amt) => amt * rate;
```

Pure functions are trivially testable, cacheable, and safe to reorder or parallelise. React's rendering model, Redux reducers, and `Array.map` callbacks all assume purity.

> **Where you'll hit this**
> Redux reducers must be pure or time-travel debugging breaks. React re-renders assume pure render functions. And a pure `calculateTotal(cart)` can be unit-tested with no database, no mocks, and no setup — which is the difference between a test suite you run and one you skip.

---

### Q21. What is a higher-order function?

**Short answer:** A function that takes a function as an argument, returns a function, or both.

**Explanation**

```js
// Takes a function
[1, 2, 3].map(n => n * 2);

// Returns a function
const multiplier = (factor) => (n) => n * factor;
const triple = multiplier(3);
triple(5); // 15

// Both
const withLogging = (fn) => (...args) => {
  console.log("calling with", args);
  const result = fn(...args);
  console.log("→", result);
  return result;
};
```

`map`, `filter`, `reduce`, `setTimeout`, `addEventListener`, and every decorator pattern are higher-order functions.

> **Where you'll hit this**
> Middleware. Express's `app.use(authenticate)`, a `withRetry(fetchUser)` wrapper, a `requireRole("admin")(handler)` guard — all higher-order functions. Every React HOC and every decorator is this pattern.

---

# Section 4 — Objects, Prototypes and Classes

---

### Q22. Explain prototypal inheritance.

**Short answer:** Every object has an internal link to another object — its prototype. When a property isn't found on an object, the engine walks up this chain until it finds it or reaches `null`.

**Explanation**

```js
const animal = {
  speak() { return `${this.name} makes a sound`; }
};

const dog = Object.create(animal);
dog.name = "Rex";

dog.speak();                        // "Rex makes a sound"
Object.getPrototypeOf(dog) === animal; // true
```

The chain for a plain array:

```
[1,2,3] → Array.prototype → Object.prototype → null
```

That's why every array has `.map` (from `Array.prototype`) and `.toString` (from `Object.prototype`).

Unlike class-based languages, there is no copying. `dog` doesn't own `speak` — it borrows it live from `animal`. Change `animal.speak` and `dog` sees the change immediately.

> **Where you'll hit this**
> Why `[].hasOwnProperty` exists even though you never defined it, and why adding to `Array.prototype` breaks unrelated libraries. Also why a "class" from an old library still works with `extends` — under the hood it's all the same chain.

---

### Q23. What does `new` actually do?

**Short answer:** It creates an empty object, links its prototype to the constructor's `.prototype`, calls the constructor with `this` bound to that object, and returns it unless the constructor returns its own object.

**Explanation**

A faithful reimplementation:

```js
function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype); // steps 1 & 2
  const result = Constructor.apply(obj, args);      // step 3
  return (result !== null && typeof result === "object") ? result : obj; // step 4
}
```

This is why forgetting `new` used to be catastrophic — `this` would leak onto the global object. ES6 `class` constructors throw a `TypeError` if called without `new`, which closes that hole.

> **Where you'll hit this**
> Debugging a factory that sometimes returns `undefined`: the constructor had an early `return` on a validation failure, which returns a primitive, which `new` ignores — so you get a half-built object instead of an error. Knowing the four steps tells you where to look.

---

### Q24. Are ES6 classes just syntactic sugar?

**Short answer:** Mostly, but not entirely. They compile down to prototypes, yet they add real semantics you can't replicate with functions.

**Explanation**

```js
class Animal {
  #secret = "private";              // truly private field
  static count = 0;                 // static field

  constructor(name) { this.name = name; }
  speak() { return `${this.name} speaks`; }
  get label() { return `<${this.name}>`; }
  static create(n) { return new Animal(n); }
}

class Dog extends Animal {
  speak() { return super.speak() + " (barks)"; }
}
```

What classes add beyond sugar:

- Always run in strict mode
- Not hoisted for use (TDZ applies)
- Constructors throw if called without `new`
- `#private` fields are inaccessible from outside, even via bracket notation
- `super` works properly, including in static methods
- `extends` can subclass built-ins like `Array` and `Error` correctly

> **Where you'll hit this**
> Custom error classes (`class ApiError extends Error`) so your catch blocks can branch on type. And `#private` fields for things like an API token that must not leak through `Object.keys`, `JSON.stringify`, or a devtools inspection.

---

### Q25. `__proto__` vs `prototype` — what's the difference?

**Short answer:** `prototype` is a property on constructor *functions*, holding the object that instances will inherit from. `__proto__` is on every *object* and points to its actual prototype.

**Explanation**

```js
function Dog() {}
const rex = new Dog();

rex.__proto__ === Dog.prototype;   // true
Dog.prototype.constructor === Dog; // true
rex.prototype;                     // undefined — instances don't have one
```

Use the standard accessors rather than `__proto__`, which is legacy:

```js
Object.getPrototypeOf(rex);
Object.setPrototypeOf(rex, someOtherProto); // avoid — deoptimises the engine
```

> **Where you'll hit this**
> Reading a stack trace or a devtools inspector, where you see `[[Prototype]]` on the instance and `prototype` on the constructor and need to know which one to patch. Monkey-patching a library method means editing `Lib.prototype.method`, not the instance.

---

### Q26. Shallow copy vs deep copy — how do you do each?

**Short answer:** A shallow copy duplicates the top level and shares nested references. A deep copy duplicates everything recursively. Use `structuredClone()` for deep copies in modern environments.

**Explanation**

```js
const original = { a: 1, nested: { b: 2 } };

// Shallow
const shallow = { ...original };
shallow.nested.b = 99;
original.nested.b; // 99 — shared reference

// Deep
const deep = structuredClone(original);
deep.nested.b = 42;
original.nested.b; // unchanged
```

`JSON.parse(JSON.stringify(obj))` is the old trick and it silently breaks on: `Date` (becomes a string), `undefined` and functions (dropped), `Infinity`/`NaN` (become `null`), `Map`/`Set` (become `{}`), and circular references (throws).

`structuredClone` handles Dates, Maps, Sets, RegExp, typed arrays and cycles. It does not clone functions, DOM nodes, or prototype chains.

> **Where you'll hit this**
> Editing a form: you copy the record with `{...record}`, the user edits a nested address field, and hitting Cancel doesn't restore anything — because the nested object was shared the whole time. Every "cancel doesn't work" bug in a nested form is a shallow copy.

---

### Q27. How do you make an object immutable?

**Short answer:** `Object.freeze()` — but it's shallow. Deep immutability requires recursion.

**Explanation**

```js
const config = Object.freeze({ url: "/api", opts: { retry: 3 } });

config.url = "x";       // silently ignored (throws in strict mode)
config.opts.retry = 99; // works! nested object isn't frozen

function deepFreeze(obj) {
  Object.values(obj).forEach(v => {
    if (v && typeof v === "object") deepFreeze(v);
  });
  return Object.freeze(obj);
}
```

Related: `Object.seal()` prevents adding or deleting properties but allows editing existing ones. `Object.preventExtensions()` only blocks additions.

> **Where you'll hit this**
> A frozen config object exported from a module, so no feature can quietly flip a flag at runtime and leave you debugging why staging behaves differently from production. Also useful as a cheap runtime guard around constants that a junior dev might otherwise "fix".

---

### Q28. What are getters and setters?

**Short answer:** Accessor properties that look like plain fields but run a function when read or written.

**Explanation**

```js
class Temperature {
  #celsius = 0;

  get fahrenheit() { return this.#celsius * 9 / 5 + 32; }
  set fahrenheit(f) {
    if (typeof f !== "number") throw new TypeError("number required");
    this.#celsius = (f - 32) * 5 / 9;
  }
}

const t = new Temperature();
t.fahrenheit = 212;      // calls the setter
console.log(t.fahrenheit); // 212 — calls the getter
```

Good for validation, computed values, and lazy loading. Keep them cheap — callers assume property access is fast, so a getter doing a network call is a nasty surprise.

> **Where you'll hit this**
> A model class where `fullName` is derived from `first` and `last`, so templates can read `user.fullName` without knowing it's computed. Or a setter that normalises phone numbers to E.164 on assignment, so bad formats never reach the database.

---

### Q29. `Object.keys` vs `for...in` vs `Object.entries`?

**Short answer:** `Object.keys` gives own enumerable string keys. `for...in` also walks the prototype chain. `Object.entries` gives `[key, value]` pairs.

**Explanation**

```js
const parent = { inherited: 1 };
const child = Object.create(parent);
child.own = 2;

Object.keys(child);          // ["own"]
Object.entries(child);       // [["own", 2]]
for (const k in child) console.log(k); // "own", then "inherited"
```

If you must use `for...in`, guard it:

```js
for (const k in child) {
  if (Object.hasOwn(child, k)) { /* ... */ }
}
```

`Object.hasOwn` is the modern replacement for `obj.hasOwnProperty(k)`, which breaks on objects created with `Object.create(null)`.

> **Where you'll hit this**
> Rendering a table from an API object. `Object.entries(row).map(([k, v]) => ...)` builds cells directly. And `for...in` over an object whose prototype was extended by a library is how you end up with a phantom column in your UI.

---

# Section 5 — Arrays and Iteration

---

### Q30. `map` vs `forEach` vs `filter` vs `reduce`.

**Short answer:** `map` transforms and returns a new array of the same length. `forEach` just iterates and returns `undefined`. `filter` returns a subset. `reduce` folds the array into a single value of any shape.

**Explanation**

```js
const nums = [1, 2, 3, 4];

nums.map(n => n * 2);              // [2, 4, 6, 8]
nums.filter(n => n % 2 === 0);     // [2, 4]
nums.reduce((sum, n) => sum + n, 0); // 10
nums.forEach(n => console.log(n)); // undefined
```

`reduce` is the general one — the others can all be written with it:

```js
const map = (arr, fn) => arr.reduce((acc, x) => [...acc, fn(x)], []);
```

A very common real use — grouping:

```js
const users = [
  { name: "Ana", city: "Dhaka" },
  { name: "Bea", city: "Dhaka" },
  { name: "Cy",  city: "Chittagong" }
];

const byCity = users.reduce((acc, u) => {
  (acc[u.city] ||= []).push(u.name);
  return acc;
}, {});
// { Dhaka: ["Ana", "Bea"], Chittagong: ["Cy"] }
```

Note: you cannot `break` out of `map`/`forEach`. Use `for...of`, `some`, or `find` when you need early exit.

> **Where you'll hit this**
> A dashboard: `filter` to the selected date range, `map` to chart points, `reduce` to the summary totals — usually all three in one pipeline. The grouping reduce above is exactly how you build a "sales by branch" widget from a flat API response.

---

### Q31. Why does `[10, 9, 1].sort()` give `[1, 10, 9]`?

**Short answer:** The default sort converts every element to a string and compares UTF-16 code units. `"10"` sorts before `"9"`.

**Explanation**

```js
[10, 9, 1].sort();               // [1, 10, 9]
[10, 9, 1].sort((a, b) => a - b); // [1, 9, 10]
```

The comparator contract: return negative if `a` comes first, positive if `b` comes first, zero to leave the order alone.

```js
// Numbers ascending
arr.sort((a, b) => a - b);
// Strings, locale-aware
arr.sort((a, b) => a.localeCompare(b));
// Objects by field, then by name
users.sort((a, b) => b.age - a.age || a.name.localeCompare(b.name));
```

Two more gotchas: `sort` **mutates** the original array, and since ES2019 it's guaranteed stable. Use `toSorted()` for a non-mutating version.

> **Where you'll hit this**
> A leaderboard sorted by score that puts 100 below 9. Or a sorted list that mysteriously reorders itself on re-render — because `sort` mutated the prop array you were handed. `toSorted()` or `[...arr].sort()` fixes both.

---

### Q32. What are the non-mutating array methods added recently?

**Short answer:** `toSorted`, `toReversed`, `toSpliced`, and `with` — copy-and-modify versions of the classic mutators.

**Explanation**

```js
const arr = [3, 1, 2];

arr.toSorted();      // [1, 2, 3], arr unchanged
arr.toReversed();    // [2, 1, 3], arr unchanged
arr.with(0, 99);     // [99, 1, 2], arr unchanged
arr.toSpliced(1, 1); // [3, 2], arr unchanged
```

Also worth knowing:

```js
[1, [2, [3, [4]]]].flat(2);        // [1, 2, 3, [4]]
[1, 2].flatMap(n => [n, n * 10]);  // [1, 10, 2, 20]
[1, 2, 3].at(-1);                  // 3 — negative indexing
[1, 2, 3].findLast(n => n < 3);    // 2
Object.groupBy(users, u => u.city); // native grouping
```

> **Where you'll hit this**
> React and Vue state updates. `setItems(items.with(i, updated))` replaces one row immutably in a single expression, where before you needed a `map` with an index comparison. `Object.groupBy` replaces the grouping reduce for straightforward cases.

---

### Q33. `slice` vs `splice`.

**Short answer:** `slice` copies a section and leaves the original alone. `splice` cuts into the original and changes it.

**Explanation**

```js
const arr = [1, 2, 3, 4, 5];

arr.slice(1, 3);   // [2, 3]  — arr is still [1,2,3,4,5]
arr.splice(1, 2);  // [2, 3]  — arr is now [1, 4, 5]

// splice can also insert
const b = [1, 4];
b.splice(1, 0, 2, 3); // b → [1, 2, 3, 4]
```

Memory hook: sp**l**ice has an **l** for "alters".

> **Where you'll hit this**
> `slice` for pagination (`rows.slice(page * size, (page + 1) * size)`) — never mutates your source data. `splice` for a genuine in-place removal, like dropping an item from a cart array you own. Mixing them up is how a "remove one row" button deletes rows from the master list.

---

### Q34. How do you deduplicate an array?

**Short answer:** `[...new Set(arr)]` for primitives. For objects, dedupe by a key using a `Map`.

**Explanation**

```js
[...new Set([1, 2, 2, 3])]; // [1, 2, 3]

// Objects — Set won't help, references differ
const unique = [...new Map(users.map(u => [u.id, u])).values()];
```

The `Map` version keeps the *last* occurrence of each id. Reverse the array first if you want the first.

> **Where you'll hit this**
> Merging results from two API endpoints that overlap, or cleaning a tag input where users type the same tag twice with different casing. The `Map` version is the one you want for records, since two API calls returning the same user produce two different objects.

---

### Q35. What makes something iterable?

**Short answer:** An object is iterable if it has a `[Symbol.iterator]` method returning an iterator — an object with a `next()` that yields `{ value, done }`.

**Explanation**

```js
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from, last = this.to;
    return {
      next: () => current <= last
        ? { value: current++, done: false }
        : { value: undefined, done: true }
    };
  }
};

[...range];                       // [1, 2, 3]
for (const n of range) console.log(n); // 1 2 3
```

Iterables work with `for...of`, spread, destructuring, `Array.from`, `Promise.all`, and `new Set()`. Strings, arrays, Maps, Sets and NodeLists are all iterable. Plain objects are **not** — which is why `for...of` on `{}` throws.

> **Where you'll hit this**
> Paginated APIs. Make the client an async iterable and callers write `for await (const user of api.users())` without ever thinking about cursors or page tokens. Also why `Promise.all` accepts a Set, and why spreading a `FileList` from a file input works.

---

### Q36. `for...of` vs `for...in`.

**Short answer:** `for...of` iterates **values** of an iterable. `for...in` iterates **keys** of an object, including inherited ones.

**Explanation**

```js
const arr = ["a", "b"];
arr.extra = "x";

for (const v of arr) console.log(v);  // "a", "b"
for (const k in arr) console.log(k);  // "0", "1", "extra"
```

Rule of thumb: `for...in` for objects, `for...of` for arrays and everything iterable. `for...in` on an array gives you string indices and any stray properties — almost never what you want.

> **Where you'll hit this**
> Iterating `document.querySelectorAll` results, `FormData` entries, or a `Map` of settings — all `for...of`. Reach for `for...in` on an array and you'll get string indices, which quietly breaks any arithmetic you do with them.

---

### Q37. Explain destructuring, including nested and default cases.

**Short answer:** Syntax for pulling values out of arrays and objects into variables in one statement.

**Explanation**

```js
// Array
const [first, , third = 0, ...rest] = [1, 2];
// first = 1, third = 0, rest = []

// Object with rename and default
const { name: userName, age = 18, address: { city } = {} } = user;

// Swap
let a = 1, b = 2;
[a, b] = [b, a];

// Function parameters — very common in React
function Card({ title, items = [], onClick }) { /* ... */ }
```

The one that trips people up:

```js
const { x } = null; // TypeError — cannot destructure null
const { x } = {};   // fine, x is undefined
```

Guard with a default: `function f({ x } = {}) {}`.

> **Where you'll hit this**
> Every React component signature, every `const { data, error, isLoading } = useQuery(...)`, and every Node handler that pulls `{ id }` off `req.params`. The nested-default form matters when an API sometimes omits a whole sub-object — `{ address: { city } = {} }` is what stops the page from crashing on incomplete records.

---

# Section 6 — Asynchronous JavaScript

---

### Q38. Explain the event loop.

**Short answer:** JavaScript runs one call stack. Async work is handed to the host (browser or Node), and when it finishes, the callback is queued. The event loop moves queued callbacks onto the stack whenever the stack is empty — draining all microtasks before taking the next macrotask.

**Explanation**

The pieces:

- **Call stack** — where synchronous code executes, one frame at a time
- **Web APIs / libuv** — timers, network, I/O, handled outside the engine
- **Macrotask queue** — `setTimeout`, `setInterval`, I/O, UI events
- **Microtask queue** — promise callbacks, `queueMicrotask`, `MutationObserver`
- **Event loop** — the scheduler

Each tick: run one macrotask → drain the **entire** microtask queue → render (in browsers) → repeat.

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");

// 1, 4, 3, 2
```

`3` beats `2` because microtasks are drained completely before the next macrotask, regardless of the `0ms` delay.

This is also why an infinite microtask chain freezes the page — the loop never gets to rendering.

---

### Q39. What is a Promise and what are its states?

**Short answer:** An object representing a value that will exist later. It's in exactly one of three states: `pending`, `fulfilled`, or `rejected`. Once settled, it never changes.

**Explanation**

```js
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve("done"), 100);
});

p.then(v => console.log(v))
 .catch(e => console.error(e))
 .finally(() => console.log("cleanup"));
```

Key behaviours:

- `.then` always returns a **new** promise, which is what makes chaining work
- Returning a value from `.then` fulfils the next promise with it
- Returning a promise from `.then` waits for it to settle first
- Throwing inside `.then` rejects the next promise
- `.catch(fn)` is just `.then(undefined, fn)`
- `.finally` passes the value or error straight through

```js
Promise.resolve(1)
  .then(v => v + 1)          // 2
  .then(v => { throw new Error("boom"); })
  .then(v => console.log("skipped"))
  .catch(e => e.message)     // "boom" — recovers
  .then(v => console.log(v)); // "boom"
```

---

### Q40. `Promise.all` vs `allSettled` vs `race` vs `any`.

**Short answer:** `all` fails fast, `allSettled` never rejects, `race` settles on the first result either way, `any` resolves on the first success.

**Explanation**

```js
const ok = Promise.resolve("ok");
const bad = Promise.reject(new Error("bad"));

Promise.all([ok, bad]);
// rejects immediately with the first error

Promise.allSettled([ok, bad]);
// [{status:"fulfilled", value:"ok"}, {status:"rejected", reason:Error}]

Promise.race([ok, bad]);
// settles with whichever finishes first — could be a rejection

Promise.any([bad, ok]);
// "ok" — ignores rejections; rejects with AggregateError only if all fail
```

When to use which:

- `all` — you need every result and any failure means abort
- `allSettled` — dashboards, batch jobs, "show what loaded"
- `race` — timeouts (`race([fetchData(), timeout(5000)])`)
- `any` — mirror servers, first responder wins

Important with `all`: the other promises don't get cancelled on failure, they just get ignored.

---

### Q41. How does `async/await` relate to promises?

**Short answer:** `async` functions always return a promise. `await` pauses the function until a promise settles, unwrapping the value or throwing the rejection.

**Explanation**

```js
async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
// equivalent to a .then chain, but reads top-to-bottom
```

Error handling uses ordinary `try/catch`:

```js
try {
  const user = await getUser(1);
} catch (err) {
  console.error(err);
} finally {
  setLoading(false);
}
```

The performance mistake everyone makes:

```js
// Sequential — 3 seconds
const a = await taskA();
const b = await taskB();
const c = await taskC();

// Parallel — 1 second
const [a, b, c] = await Promise.all([taskA(), taskB(), taskC()]);
```

Only await sequentially when a later call genuinely depends on an earlier result.

---

### Q42. Why doesn't `await` work inside `forEach`?

**Short answer:** `forEach` ignores the promise its callback returns, so nothing waits. Use `for...of` for sequential work or `Promise.all(map(...))` for parallel.

**Explanation**

```js
// Broken — logs "done" before any user arrives
ids.forEach(async (id) => { await save(id); });
console.log("done");

// Sequential
for (const id of ids) await save(id);

// Parallel
await Promise.all(ids.map(id => save(id)));
```

`forEach`'s implementation calls the callback and discards the return value — it has no concept of async.

---

### Q43. What is callback hell and how did promises solve it?

**Short answer:** Deeply nested callbacks with duplicated error handling at every level. Promises flattened the nesting into a chain with one error handler.

**Explanation**

```js
// Before
getUser(id, (err, user) => {
  if (err) return handle(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handle(err);
    getItems(orders[0].id, (err, items) => {
      if (err) return handle(err);
      render(items);
    });
  });
});

// After
getUser(id)
  .then(user => getOrders(user.id))
  .then(orders => getItems(orders[0].id))
  .then(render)
  .catch(handle);

// Now
try {
  const user = await getUser(id);
  const orders = await getOrders(user.id);
  render(await getItems(orders[0].id));
} catch (e) { handle(e); }
```

---

### Q44. `setTimeout(fn, 0)` — does it run immediately?

**Short answer:** No. It runs after the current synchronous code finishes and after all pending microtasks, and browsers clamp nested timeouts to a minimum of about 4ms.

**Explanation**

```js
setTimeout(() => console.log("timeout"), 0);
queueMicrotask(() => console.log("micro"));
console.log("sync");

// sync, micro, timeout
```

The legitimate use is yielding to the browser so it can paint or handle input before you continue with more work.

---

### Q45. What are generators and where are they useful?

**Short answer:** Functions that can pause and resume. Calling one returns an iterator; each `next()` runs until the next `yield`.

**Explanation**

```js
function* idGenerator() {
  let id = 1;
  while (true) yield id++;
}

const ids = idGenerator();
ids.next().value; // 1
ids.next().value; // 2
```

Two-way communication — `yield` also *receives* a value:

```js
function* dialogue() {
  const name = yield "What's your name?";
  yield `Hello, ${name}`;
}
const d = dialogue();
d.next().value;        // "What's your name?"
d.next("Ana").value;   // "Hello, Ana"
```

Real uses: infinite sequences without infinite memory, lazy pagination, `redux-saga`, and custom iterables. Async generators (`for await...of`) are excellent for consuming streams:

```js
async function* readLines(stream) { /* ... */ }
for await (const line of readLines(s)) process(line);
```

---

### Q46. How do you cancel an in-flight request?

**Short answer:** `AbortController` — pass its `signal` to `fetch` and call `abort()`.

**Explanation**

```js
const controller = new AbortController();

fetch("/api/data", { signal: controller.signal })
  .then(r => r.json())
  .catch(err => {
    if (err.name === "AbortError") return; // expected
    throw err;
  });

controller.abort();
```

A timeout built on it:

```js
const withTimeout = (url, ms) =>
  fetch(url, { signal: AbortSignal.timeout(ms) });
```

The same signal works with `addEventListener`, which is the cleanest way to remove many listeners at once.

---

# Section 7 — Modern Language Features

---

### Q47. Optional chaining and nullish coalescing.

**Short answer:** `?.` short-circuits to `undefined` instead of throwing on null/undefined. `??` falls back only for `null` or `undefined`, unlike `||` which falls back for any falsy value.

**Explanation**

```js
user?.address?.city;      // undefined instead of TypeError
user?.getName?.();        // safe method call
arr?.[0];                 // safe index

// The important difference
const count = 0;
count || 10;   // 10  ← bug: 0 is valid
count ?? 10;   // 0   ← correct

const name = "";
name || "Anon"; // "Anon"
name ?? "Anon"; // ""
```

Use `??` for defaults whenever `0`, `""` or `false` are legitimate values. Logical assignment operators follow the same rules:

```js
config.retries ??= 3;   // only if null/undefined
counts[key] ||= 0;
flags.enabled &&= isValid;
```

---

### Q48. `Map` vs plain object. `Set` vs array.

**Short answer:** `Map` allows any key type, keeps insertion order, has a `.size`, and is faster for frequent additions and removals. `Set` gives O(1) membership tests and automatic uniqueness.

**Explanation**

```js
const m = new Map();
m.set({ id: 1 }, "object key");
m.set(fn, "function key");
m.set(NaN, "even NaN works");
m.size;         // 3
m.has(NaN);     // true

const obj = {};
obj[{ id: 1 }] = "x";  // key becomes "[object Object]" — collision
```

Choose an object for JSON-shaped records with string keys. Choose a `Map` for a cache, a registry, or anything keyed by objects.

```js
const seen = new Set();
seen.add(1); seen.add(1);
seen.size;      // 1
seen.has(1);    // true, O(1) — vs arr.includes which is O(n)
```

---

### Q49. What are `WeakMap` and `WeakSet` for?

**Short answer:** Collections that hold keys weakly, so entries disappear when the key object is garbage collected. They prevent memory leaks in caches and private-data patterns.

**Explanation**

```js
const cache = new WeakMap();

function getData(node) {
  if (!cache.has(node)) cache.set(node, expensiveComputation(node));
  return cache.get(node);
}
// When the DOM node is removed, its cache entry is freed automatically
```

Restrictions: keys must be objects, and you cannot iterate or check `.size` — because the contents can change at any moment due to GC.

With a regular `Map`, that cache would keep every node alive forever. That's a genuine, common production leak.

---

### Q50. What are Symbols?

**Short answer:** Unique, immutable primitives used as collision-proof property keys and as hooks into language behaviour.

**Explanation**

```js
const id = Symbol("id");
const obj = { [id]: 123, name: "Ana" };

Object.keys(obj);      // ["name"] — symbol keys are skipped
JSON.stringify(obj);   // {"name":"Ana"}
obj[id];               // 123

Symbol("a") === Symbol("a"); // false — always unique
Symbol.for("a") === Symbol.for("a"); // true — global registry
```

Well-known symbols customise built-in operations:

```js
class Collection {
  *[Symbol.iterator]() { yield* this.items; }
  get [Symbol.toStringTag]() { return "Collection"; }
}
```

Practical use: attaching metadata to objects you don't own, without any risk of clashing with existing or future properties.

---

### Q51. ES modules vs CommonJS.

**Short answer:** ESM (`import`/`export`) is static, hoisted, asynchronous and supports tree-shaking. CommonJS (`require`/`module.exports`) is dynamic, synchronous, and evaluated at call time.

**Explanation**

```js
// ESM
import { helper } from "./util.js";
export default function App() {}
const mod = await import("./heavy.js"); // dynamic, code-splitting

// CommonJS
const { helper } = require("./util");
module.exports = App;
```

Differences that actually bite:

- ESM imports are hoisted and read-only *live bindings*; CJS exports are a copied snapshot
- ESM is always strict mode
- `this` at top level is `undefined` in ESM, `module.exports` in CJS
- ESM has top-level `await`; CJS doesn't
- ESM's static structure is what allows bundlers to tree-shake dead code

---

### Q52. What are template literals and tagged templates?

**Short answer:** Backtick strings with interpolation and multi-line support. A tagged template hands the string parts and values to a function so you can process them.

**Explanation**

```js
const name = "Ana";
const msg = `Hello, ${name}!
This spans lines.`;

// Tagged
function safe(strings, ...values) {
  return strings.reduce((out, s, i) =>
    out + s + (values[i] != null ? escapeHtml(values[i]) : ""), "");
}
const html = safe`<p>${userInput}</p>`;
```

Tagged templates power `styled-components`, GraphQL `gql`, and SQL escaping libraries.

---

# Section 8 — Practical Patterns

---

### Q53. Implement debounce.

**Short answer:** Delay running a function until it has stopped being called for N milliseconds. Use it for search-as-you-type and resize handlers.

**Explanation**

```js
function debounce(fn, delay) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const search = debounce((q) => fetchResults(q), 300);
```

Note `fn.apply(this, args)` rather than an arrow — that preserves `this` when the debounced function is used as a method or DOM handler.

---

### Q54. Implement throttle. How does it differ from debounce?

**Short answer:** Throttle runs the function at most once every N ms. Debounce waits for silence. Throttle for scroll position; debounce for autocomplete.

**Explanation**

```js
function throttle(fn, limit) {
  let waiting = false, lastArgs = null;
  return function (...args) {
    if (waiting) { lastArgs = args; return; }
    fn.apply(this, args);
    waiting = true;
    setTimeout(() => {
      waiting = false;
      if (lastArgs) { fn.apply(this, lastArgs); lastArgs = null; }
    }, limit);
  };
}
```

With rapid calls over one second at a 200ms setting: throttle fires roughly five times, debounce fires once, after the calls stop.

---

### Q55. Implement memoization.

**Short answer:** Cache results keyed by arguments so repeated calls skip the work. Only valid for pure functions.

**Explanation**

```js
function memoize(fn, keyFn = (...a) => JSON.stringify(a)) {
  const cache = new Map();
  return function (...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const slowFib = (n) => n < 2 ? n : slowFib(n - 1) + slowFib(n - 2);
const fib = memoize((n) => n < 2 ? n : fib(n - 1) + fib(n - 2));
fib(40); // instant; slowFib(40) takes seconds
```

Watch out: an unbounded cache is a memory leak. In production, cap the size (LRU) or use a `WeakMap` when the key is an object.

---

### Q56. What is event delegation?

**Short answer:** Attach one listener to a common ancestor and use `event.target` to work out which child was clicked. It scales to any number of children, including ones added later.

**Explanation**

```js
document.querySelector("#list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  handle(btn.dataset.action, btn.dataset.id);
});
```

This relies on **bubbling** — events travel from the target up through its ancestors. The full cycle is capture (down), target, then bubble (up). Pass `{ capture: true }` to listen on the way down.

`e.stopPropagation()` halts the journey; `e.preventDefault()` cancels the browser's default action. They're independent.

---

### Q57. What causes memory leaks in JavaScript?

**Short answer:** Anything that keeps a reference alive after it's needed — forgotten timers, detached DOM nodes, unremoved listeners, and unbounded caches.

**Explanation**

```js
// 1. Timer never cleared
const id = setInterval(poll, 1000);
// fix: clearInterval(id) on teardown

// 2. Detached DOM held by a closure
let cached = document.getElementById("big-table");
document.body.removeChild(cached);
// The node is gone from the page but not from memory until cached = null

// 3. Listener on a long-lived object
window.addEventListener("resize", onResize);
// fix: removeEventListener, or use an AbortController signal

// 4. Growing cache
const cache = new Map(); // never evicts → use WeakMap or an LRU
```

In a component framework, the cleanup function (React's `useEffect` return, Vue's `onUnmounted`) exists precisely for cases 1–3.

---

### Q58. Explain `try/catch/finally` and custom errors.

**Short answer:** `try` runs risky code, `catch` handles a thrown value, `finally` always runs. Extend `Error` to create meaningful error types.

**Explanation**

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

try {
  throw new ValidationError("email", "Invalid format");
} catch (err) {
  if (err instanceof ValidationError) console.log(err.field);
  else throw err;   // re-throw what you don't understand
} finally {
  cleanup();        // runs even if you return or throw above
}
```

Two things to know:

- `try/catch` does **not** catch errors thrown inside async callbacks or in a later tick — only what's on the current stack
- A `return` inside `finally` overrides a `return` in `try`, which is almost always a bug

Use the `cause` option to preserve context when wrapping:

```js
throw new Error("Failed to load config", { cause: originalError });
```

---

### Q59. What's the difference between `Object.assign` and spread?

**Short answer:** Both do a shallow merge. `Object.assign` mutates its first argument and triggers setters on the target; spread always creates a new object and copies plain values.

**Explanation**

```js
const target = { a: 1 };
Object.assign(target, { b: 2 });  // target is modified
const fresh = { ...target, b: 2 }; // target untouched
```

Prefer spread for its immutability. Reach for `Object.assign` when you deliberately want to mutate an existing object, such as updating a class instance in place.

Neither copies getters as getters — both invoke them and copy the resulting value. `Object.getOwnPropertyDescriptors` plus `Object.defineProperties` is the faithful copy.

---

### Q60. How does `JSON.stringify` handle unusual values?

**Short answer:** It drops `undefined`, functions and symbols in objects; converts them to `null` in arrays; calls `toJSON` when present; and throws on circular references and BigInt.

**Explanation**

```js
JSON.stringify({ a: undefined, b: () => {}, c: 1 }); // {"c":1}
JSON.stringify([undefined, () => {}, 1]);            // [null,null,1]
JSON.stringify(new Date());        // ISO string via Date.prototype.toJSON
JSON.stringify({ n: NaN });        // {"n":null}
JSON.stringify(10n);               // TypeError
```

The second and third arguments are underused:

```js
JSON.stringify(user, ["id", "name"], 2);          // whitelist keys + indent
JSON.stringify(obj, (k, v) => k === "password" ? undefined : v);
```

---

# Section 9 — Output Prediction Puzzles

These are the questions interviewers use to see whether you actually understand the model. Try to answer before reading on.

---

### Q61.
```js
console.log(typeof typeof 1);
```
**`"string"`.** The inner `typeof 1` gives `"number"`, and `typeof "number"` is `"string"`.

---

### Q62.
```js
const arr = [1, 2, 3];
arr.length = 0;
console.log(arr);
```
**`[]`.** Setting `length` lower truncates the array in place. This is a legitimate (if blunt) way to empty an array while keeping the same reference.

---

### Q63.
```js
console.log([..."hello"]);
console.log([, , ,].length);
```
**`["h","e","l","l","o"]`** — strings are iterable.
**`3`** — trailing commas create holes; the last one is ignored.

---

### Q64.
```js
const obj = { a: 1 };
const copy = obj;
copy.a = 2;
console.log(obj.a);
```
**`2`.** Objects are assigned by reference. `copy` and `obj` point at the same thing.

---

### Q65.
```js
function foo() { return this; }
const bar = { foo };
console.log(foo() === bar.foo());
```
**`false`.** `foo()` uses default binding (`globalThis` or `undefined`); `bar.foo()` uses implicit binding, so `this` is `bar`.

---

### Q66.
```js
async function f() {
  console.log("A");
  await null;
  console.log("B");
}
f();
console.log("C");
```
**A, C, B.** Everything before the first `await` runs synchronously. `await` — even on a non-promise — schedules the rest as a microtask, so `C` runs first.

---

### Q67.
```js
console.log([1, 2, 3] + [4, 5]);
```
**`"1,2,34,5"`.** `+` has no array behaviour, so both are converted to strings via `join(",")` and concatenated.

---

### Q68.
```js
let a = { x: 1 };
let b = { x: 1 };
const set = new Set([a, b, a]);
console.log(set.size);
```
**`2`.** `Set` uses SameValueZero, which compares objects by reference. `a` and `b` are different objects.

---

### Q69.
```js
console.log(1 < 2 < 3);
console.log(3 > 2 > 1);
```
**`true`, then `false`.** Comparisons are left-associative. `3 > 2` is `true`, then `true > 1` becomes `1 > 1`, which is `false`.

---

### Q70.
```js
const obj = {
  name: "Ana",
  greet: function () {
    const inner = () => `Hi ${this.name}`;
    return inner();
  }
};
console.log(obj.greet());
```
**`"Hi Ana"`.** The arrow inherits `this` from `greet`, which was called as a method, so `this` is `obj`. Change `inner` to a regular function and it breaks.

---

### Q71.
```js
console.log(Math.max());
console.log(Math.min());
```
**`-Infinity` and `Infinity`.** With no arguments, `max` returns the identity for maximum (the smallest possible value) and vice versa. Consistent, if surprising.

---

### Q72.
```js
const p = Promise.resolve(1);
p.then(v => { console.log(v); return v + 1; });
p.then(v => console.log(v));
```
**`1`, then `1`.** Both handlers attach to the *same* promise, so both receive `1`. Chaining (`p.then().then()`) is what passes values forward.

---

# Appendix A — Quick reference

**Equality**
- `===` for everything; `x == null` for the null/undefined check
- `Object.is(a, b)` distinguishes `-0` from `0` and treats `NaN` as equal to itself

**Copying**
- Shallow: `{...obj}`, `[...arr]`, `Object.assign`
- Deep: `structuredClone(obj)`

**Async**
- Parallel by default: `Promise.all(items.map(fn))`
- Sequential only when there's a real dependency
- Always attach a `.catch` or wrap in `try/catch`

**Performance**
- `Set`/`Map` lookups are O(1); `Array.includes`/`indexOf` are O(n)
- Debounce input, throttle scroll
- Avoid layout thrash: batch DOM reads, then batch writes

---

# Appendix B — Study path

1. **Week 1** — Sections 1 and 2. Do not move on until hoisting, the TDZ, and closures feel obvious.
2. **Week 2** — Sections 3 and 4. Write the `myNew` implementation from memory.
3. **Week 3** — Section 5. Rewrite `map`, `filter` and `reduce` from scratch.
4. **Week 4** — Section 6. Draw the event loop and trace ten mixed sync/micro/macro snippets by hand.
5. **Week 5** — Sections 7 and 8. Implement debounce, throttle, memoize and a deep clone without looking.
6. **Week 6** — Section 9, plus explain any five answers out loud to someone else. If you can't explain it, you don't have it yet.
