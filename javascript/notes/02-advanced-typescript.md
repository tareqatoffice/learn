# Phase 2 — Advanced TypeScript

---

## 2.1 The Type System — Beyond the Basics

### Structural vs Nominal Typing

This is the single biggest mental shift coming from C#. TypeScript is **structurally typed** ("duck typing"): a value is assignable to a type if its *shape* matches — the name of the type is irrelevant. C# is **nominally typed**: assignability requires an explicit declared relationship (`: IFoo`, `: Base`), regardless of shape.

```ts
interface Point { x: number; y: number; }

function print(p: Point) { console.log(p.x, p.y); }

// No `implements Point` anywhere — the shape matches, so it's accepted.
const thing = { x: 1, y: 2, label: 'origin' }; // extra prop is fine
print(thing); // OK — structurally a Point
```

In C#, this would NOT compile unless `thing` explicitly implemented or derived from `Point`:

```csharp
// C# — nominal. This fails: anonymous object is not an IPoint.
void Print(IPoint p) { ... }
Print(new { X = 1, Y = 2 }); // compile error
```

The rule of thumb: **TS cares "can this value do what the type promises?", C# cares "was this value declared to be that type?"**

```ts
// Two unrelated interfaces with identical shape are interchangeable in TS:
interface Celsius { degrees: number; }
interface Fahrenheit { degrees: number; }

const c: Celsius = { degrees: 100 };
const f: Fahrenheit = c; // OK in TS — same shape. (This is a footgun — see branded types in 2.7)
```

**Excess property checks** are the one place structural typing tightens up: an *object literal* assigned directly to a typed target may NOT have extra properties. This is a deliberate typo-catcher. Note it only fires on fresh literals, not on a variable that's already been widened.

```ts
interface Options { width: number; }

const a: Options = { width: 10, height: 20 }; // ERROR: 'height' does not exist in type 'Options'

const tmp = { width: 10, height: 20 };
const b: Options = tmp; // OK — tmp is a variable, not a fresh literal; excess check skipped
```

`private`/`#` members partly reintroduce nominal behavior — two classes with a `private` field of the same name are NOT compatible (TS tracks the field's *declaring class*):

```ts
class A { private secret = 1; }
class B { private secret = 1; }
let x: A = new B(); // ERROR — private members originate in different declarations (nominal-ish)
```

### `type` vs `interface`

Both describe object shapes. The differences are real but narrow:

| Feature | `interface` | `type` |
|---|---|---|
| Object/class shape | yes | yes |
| Unions / intersections / primitives / tuples | no | yes (`type T = A \| B`) |
| Declaration merging (reopen & add members) | yes | no |
| `extends` / `implements` | yes | via `&` intersection |
| Mapped/conditional/template-literal types | no | yes |
| Performance on large object types | slightly faster (cached) | recomputed |

```ts
// interface — extendable, mergeable, ideal for public object/class contracts
interface User { id: string; name: string; }
interface User { email: string; } // declaration merging — User now has all three (see 2.4)

// type — everything else: unions, primitives, tuples, computed types
type ID = string | number;
type Pair = [number, number];
type Nullable<T> = T | null;
```

**Guidance:** use `interface` for public object shapes and anything you might want others to augment (library types, NestJS `Request`). Use `type` for unions, tuples, function types, and any computed/mapped type. C# analogy: `interface` is closest to a C# `interface`; `type` has no C# equivalent — it's a type-level alias engine.

### Unions, Intersections, Discriminated Unions

```ts
// Union — "one of". Like a constrained set; no direct C# equivalent (closest: a sealed hierarchy or a tagged struct).
type Status = 'idle' | 'loading' | 'error';

// Intersection — "all of". Merges members. Like multiple-interface implementation in C#.
type Timestamped = { createdAt: Date };
type Identified = { id: string };
type Entity = Timestamped & Identified; // { createdAt: Date; id: string }
```

**Discriminated (tagged) unions** are the workhorse pattern — a common literal field (the *discriminant*) lets TS narrow exhaustively. This is the TS replacement for C# pattern matching over a sealed type hierarchy.

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; width: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2; // s narrowed to circle — `.radius` exists
    case 'square': return s.side ** 2;
    case 'rect':   return s.width * s.height;
    default:
      // Exhaustiveness check: if a new variant is added and unhandled,
      // `s` is no longer `never` and this assignment errors at COMPILE time.
      const _exhaustive: never = s;
      return _exhaustive;
  }
}
```

That `never` trick is the TS equivalent of C#'s `_ => throw new ArgumentOutOfRangeException()` switch arm, except it fails at compile time, not runtime.

### Literal Types and `as const`

A literal type is a type whose only value is one literal: `type Yes = 'yes'`. By default TS *widens* literals when you assign them to a mutable binding:

```ts
let s = 'hello';        // type: string  (widened — `let` is mutable)
const c = 'hello';      // type: 'hello' (not widened — const can't change)

const obj = { method: 'GET' };       // method type: string (widened — object props are mutable)
const obj2 = { method: 'GET' } as const; // method type: 'GET' (readonly, narrowed)
```

`as const` ("const assertion") freezes a literal as deeply as possible: all properties become `readonly`, arrays become `readonly` tuples, and every literal stays narrow.

```ts
const config = {
  retries: 3,
  endpoints: ['/a', '/b'],
} as const;
// type: { readonly retries: 3; readonly endpoints: readonly ['/a', '/b'] }

config.retries = 5;          // ERROR — readonly
config.endpoints.push('/c'); // ERROR — readonly tuple has no push

// Classic use: derive a union from a runtime array (single source of truth)
const ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = typeof ROLES[number]; // 'admin' | 'editor' | 'viewer'
```

That last pattern — `as const` + `typeof X[number]` — is how you keep a runtime value list and its type in lockstep. It's the idiomatic TS answer to a C# `enum` when you also need the values at runtime as plain strings.

---

## 2.2 Generics In Depth

Generics are TS's answer to C# generics, but far more powerful because TS generics participate in a full type-level computation language (conditional types, inference, mapping).

### Constraints (`extends`)

`T extends Constraint` restricts what `T` can be — exactly like C#'s `where T : IFoo`. Inside the function, `T` is known to have at least the constraint's members.

```ts
// Without a constraint, `key` could be anything → no guarantee obj has it.
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]; // safe: K is provably a key of T
}

const user = { id: 1, name: 'Ada' };
const n = getProp(user, 'name'); // type: string
const bad = getProp(user, 'xxx'); // ERROR — 'xxx' is not 'id' | 'name'
```

`keyof T` is the union of T's keys (`'id' | 'name'`). `T[K]` is an *indexed access type* — "the type of the property at key K". These two together are the foundation of type-safe property access.

### Default Type Parameters

Like C#... actually C# has no default generic parameters, so this is a TS extra:

```ts
interface ApiResponse<TData = unknown, TError = Error> {
  data?: TData;
  error?: TError;
}

const r1: ApiResponse = {};                 // TData=unknown, TError=Error
const r2: ApiResponse<User> = {};           // TData=User,   TError=Error
const r3: ApiResponse<User, string> = {};   // both supplied
```

### Conditional Types (`T extends U ? X : Y`)

A type-level ternary. This is where TS leaves C# behind entirely — C# has no equivalent.

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'hi'>;  // true
type B = IsString<42>;    // false

// Practical: unwrap a Promise's value type
type Awaited1<T> = T extends Promise<infer U> ? U : T;
type R = Awaited1<Promise<number>>; // number
```

### `infer` — Extracting Types

`infer R` declares a type variable *inside* a conditional type's `extends` clause, capturing whatever matched. Think of it as destructuring at the type level.

```ts
// Extract the element type of an array
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>;  // string
type E2 = ElementOf<number>;    // never (not an array)

// Extract a function's return type (this is literally how ReturnType works — see 2.3)
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type Fn = () => { ok: boolean };
type Out = MyReturnType<Fn>; // { ok: boolean }

// Multiple infers in one pattern
type FirstArg<T> = T extends (first: infer A, ...rest: any[]) => any ? A : never;
type A1 = FirstArg<(name: string, age: number) => void>; // string
```

### Distributive Conditional Types

When the checked type in a conditional is a *naked type parameter* and you pass a union, the conditional **distributes** over each union member individually, then re-unions the results. This surprises everyone the first time.

```ts
type ToArray<T> = T extends any ? T[] : never;

type R = ToArray<string | number>;
// Distributes:  ToArray<string> | ToArray<number>
//             = string[] | number[]
// NOT (string | number)[]
```

To **disable** distribution, wrap both sides in a tuple (`[T]`) so the parameter is no longer "naked":

```ts
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type R2 = ToArrayNonDist<string | number>; // (string | number)[]
```

This is exactly how the built-in `Exclude`/`Extract` work (next section). Distribution is also why `T extends never ? ... : ...` behaves oddly: distributing over the empty union produces `never`.

```ts
// Filtering a union via distribution
type Filter<T, U> = T extends U ? T : never;
type Nums = Filter<1 | 'a' | 2 | 'b', number>; // 1 | 2
```

---

## 2.3 Mapped & Template Literal Types

### Mapped Types

A mapped type iterates over the keys of a type and produces a new type — the type-level equivalent of `Object.keys(obj).map(...)`.

```ts
// Syntax: { [K in Keys]: ValueType }
type Flags<T> = { [K in keyof T]: boolean };

interface Settings { darkMode: string; fontSize: number; }
type SettingFlags = Flags<Settings>;
// { darkMode: boolean; fontSize: boolean }
```

**Mapping modifiers** add/remove `readonly` and `?` (optional). A `+`/`-` prefix adds/removes them:

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };   // strip readonly
type Concrete<T> = { [K in keyof T]-?: T[K] };          // strip optional (-?)
type ReadonlyOpt<T> = { +readonly [K in keyof T]+?: T[K] }; // add both
```

**Key remapping** with `as` lets you rename or filter keys (TS 4.1+). Returning `never` for a key drops it:

```ts
// Prefix every key with "get" and capitalize: { name } -> { getName }
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

// Filter out keys whose value is a function
type DataProps<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};
```

### How the Built-in Utility Types Actually Work

These are not magic compiler intrinsics (mostly) — they're plain mapped/conditional types in `lib.es5.d.ts`. Knowing the implementations means you can write your own variants.

```ts
// Partial — every property optional
type Partial<T> = { [P in keyof T]?: T[P] };

// Required — every property required (strip optional via -?)
type Required<T> = { [P in keyof T]-?: T[P] };

// Readonly — every property readonly
type Readonly<T> = { readonly [P in keyof T]: T[P] };

// Pick — keep only the named keys K
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// Record — build an object type from a key union and a value type
type Record<K extends keyof any, T> = { [P in K]: T };
// keyof any === string | number | symbol

// Exclude — remove from union U the members assignable to E (DISTRIBUTIVE — see 2.2)
type Exclude<U, E> = U extends E ? never : U;

// Extract — keep only union members assignable to E (distributive)
type Extract<U, E> = U extends E ? U : never;

// Omit — Pick the keys of T that are NOT in K. Built FROM Pick + Exclude.
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

// NonNullable — strip null and undefined
type NonNullable<T> = T & {}; // (modern impl; older: T extends null | undefined ? never : T)

// ReturnType — infer the return type of a function (see infer, 2.2)
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;

// Parameters — infer the tuple of argument types
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

// InstanceType — the instance type of a constructor function
type InstanceType<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: any) => infer R ? R : any;
```

Walking through `Omit<User, 'password'>`:

```ts
interface User { id: string; name: string; password: string; }

type Public = Omit<User, 'password'>;
// 1. Exclude<keyof User, 'password'>  ->  Exclude<'id'|'name'|'password', 'password'>
//    distributes: 'id'|'name'  (password becomes never, dropped from union)
// 2. Pick<User, 'id' | 'name'>  ->  { id: string; name: string }
```

### Template Literal Types

String literal types you can build with interpolation. Combined with `infer`, you can parse strings at the type level.

```ts
type Greeting = `Hello, ${string}!`;
const g1: Greeting = 'Hello, world!'; // OK
const g2: Greeting = 'Hi';            // ERROR

// Unions multiply (cartesian product)
type Color = 'red' | 'blue';
type Shade = 'light' | 'dark';
type Variant = `${Shade}-${Color}`;
// 'light-red' | 'light-blue' | 'dark-red' | 'dark-blue'

// Intrinsic string manipulation types (compiler built-ins):
type U = Uppercase<'abc'>;   // 'ABC'
type L = Lowercase<'ABC'>;   // 'abc'
type C = Capitalize<'abc'>;  // 'Abc'
type Un = Uncapitalize<'Abc'>; // 'abc'

// Parsing a string type with infer — extract the route param
type ParseParam<T> = T extends `:${infer Name}` ? Name : never;
type P = ParseParam<':userId'>; // 'userId'
```

### Combining Mapped + Template Literal Types

This combination powers the type-safe event emitter (this phase's mini-project) and patterns like generating an `onX` handler API:

```ts
// Generate React-style event handler props from an events object
type EventHandlers<E> = {
  [K in keyof E as `on${Capitalize<string & K>}`]: (payload: E[K]) => void;
};

type Events = { click: { x: number; y: number }; focus: undefined };
type Handlers = EventHandlers<Events>;
// {
//   onClick: (payload: { x: number; y: number }) => void;
//   onFocus: (payload: undefined) => void;
// }
```

---

## 2.4 Declaration Merging & Module Augmentation

### Interface Merging

Multiple `interface` declarations with the same name in the same scope merge into one. (Type aliases cannot do this — a duplicate `type` name is an error.) This is intentional and is how the standard library lets you extend built-in types.

```ts
interface Box { width: number; }
interface Box { height: number; }
// Merged: Box has width AND height
const b: Box = { width: 10, height: 20 };
```

### Augmenting Third-Party Modules

`declare module 'pkg'` reopens another package's declarations to add members. The classic case: adding a `user` property to Express's `Request`.

```ts
// types/express.d.ts  (ensure it's included by tsconfig)
import 'express'; // import so we augment the existing module, not redeclare it

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; roles: string[] }; // merges into Express's Request
  }
}
```

Now `req.user` is typed everywhere with no casting. This is the TS analogue of C# extension methods, but for *type shape* rather than behavior.

### `declare global`

Inside a module, `declare global { ... }` reaches into the global scope. Use it to add to `globalThis`, `Window`, `process.env`, etc.

```ts
export {}; // make this file a module so `declare global` is allowed

declare global {
  // Strongly type environment variables
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      PORT: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }

  interface Window {
    __APP_VERSION__: string;
  }
}

process.env.NODE_ENV; // type: 'development' | 'production' | 'test'
```

### Ambient Declarations (`.d.ts`)

`.d.ts` files contain *only* type information — no emitted JS. They describe the shape of things that exist at runtime but have no TS source: untyped JS libraries, globals, non-code imports.

```ts
// globals.d.ts — declare a global that some script injects at runtime
declare const __BUILD_HASH__: string;

// Describe an untyped JS module so `import x from 'legacy-lib'` type-checks
declare module 'legacy-lib' {
  export function doThing(input: string): number;
  const _default: { version: string };
  export default _default;
}

// Let non-code imports type-check (bundler handles them at runtime)
declare module '*.svg' {
  const src: string;
  export default src;
}
```

`declare` means "this exists at runtime, trust me — emit nothing." It's the TS equivalent of a C# `extern`/forward declaration: you're describing a contract the compiler can't see the implementation of.

---

## 2.5 The `satisfies` Operator, `const` Generics, `using`/`await using`

### `satisfies` (TS 4.9)

`satisfies` checks that an expression conforms to a type **without widening it to that type**. You get validation *and* keep the precise inferred type. This solves the long-standing "annotate-vs-infer" tension.

```ts
type Config = Record<string, string | number>;

// With a type annotation — value is widened to Config, precise keys/values lost:
const a: Config = { host: 'localhost', port: 5432 };
a.port.toFixed(); // ERROR — a.port is `string | number`, not number

// With satisfies — validated against Config, but the precise type is preserved:
const b = { host: 'localhost', port: 5432 } satisfies Config;
b.port.toFixed();   // OK — b.port is inferred as number
b.host.toUpperCase(); // OK — b.host is inferred as string
b.nope;             // ERROR at definition if it violated Config

// Common pattern: validate a palette has the right keys, keep literal values
const palette = {
  primary: '#ff0000',
  secondary: '#00ff00',
} satisfies Record<string, `#${string}`>;
// palette.primary type: '#ff0000' (literal), not string
```

Mental model: `: T` says "treat it as T". `satisfies T` says "make sure it's a valid T, but remember what it really is."

### `const` Type Parameters (TS 5.0)

A generic parameter declared `const` infers literal/narrow types from arguments as if the caller wrote `as const` — without making them do so.

```ts
// Without const: T widens
function first<T>(arr: T[]): T { return arr[0]; }
const x = first(['a', 'b']); // type: string

// With const type param: T preserves literals
function firstConst<const T>(arr: readonly T[]): T { return arr[0]; }
const y = firstConst(['a', 'b']); // type: 'a' | 'b'

// Real use: a function that takes a config and reflects exact shape back
function defineRoutes<const T>(routes: T): T { return routes; }
const r = defineRoutes({ home: '/', user: '/user/:id' });
// r.home type: '/'  (literal preserved, no `as const` needed at call site)
```

### `using` / `await using` — Explicit Resource Management (TS 5.2)

Implements the TC39 Explicit Resource Management proposal. A `using` declaration disposes the resource automatically when the scope exits — the JS/TS answer to C#'s `using` statement and `IDisposable`/`IAsyncDisposable`.

```ts
// A disposable resource implements Symbol.dispose (sync) or Symbol.asyncDispose (async).
class FileHandle {
  constructor(public path: string) { /* open... */ }
  [Symbol.dispose]() { console.log(`closing ${this.path}`); }
}

function readConfig() {
  using file = new FileHandle('config.json');
  // ...use file...
  // file[Symbol.dispose]() runs automatically here, even on throw/early return
}

// Async variant — disposes via Symbol.asyncDispose, awaited at scope exit
class DbConnection {
  async [Symbol.asyncDispose]() { console.log('closing connection'); }
}

async function query() {
  await using conn = new DbConnection();
  // conn's asyncDispose is awaited when this function's scope exits
}
```

Disposal order is **reverse of declaration** (LIFO), exactly like nested C# `using` blocks. Comparison:

```csharp
// C# equivalent
using var file = new FileHandle("config.json"); // Dispose() at scope end
await using var conn = new DbConnection();       // DisposeAsync() at scope end
```

---

## 2.6 Decorators (TS 5 / Stage 3)

A decorator is a function that observes or modifies a declaration. Two incompatible systems exist; knowing which one you're in matters enormously.

### Legacy vs Stage 3 — the critical distinction

| | **Legacy (experimental)** | **Stage 3 (TS 5.0+ standard)** |
|---|---|---|
| Enabled by | `experimentalDecorators: true` | default (no flag) |
| Spec | old TS-specific design | TC39 Stage 3 proposal |
| Signature | `(target, key, descriptor)` | `(value, context)` |
| Parameter decorators | yes | **no** (not in Stage 3) |
| `emitDecoratorMetadata` | yes (reflect-metadata) | not part of the standard (separate metadata) |
| Used by | NestJS, TypeORM, Angular (today) | new code, future frameworks |

**Important practical note:** NestJS, TypeORM and Angular still rely on **legacy** decorators + `emitDecoratorMetadata` because they need parameter decorators and runtime type metadata for DI. If you work in NestJS, you set `experimentalDecorators: true` and `emitDecoratorMetadata: true`. Stage 3 is the future and what you'd use in greenfield non-framework code.

### Stage 3 decorators by kind

Every Stage 3 decorator receives `(value, context)` where `context.kind` tells you what's decorated. Returning a value can replace the decorated thing.

```ts
// --- Class decorator: value = the class; can return a replacement class ---
function sealed<T extends new (...args: any[]) => any>(value: T, ctx: ClassDecoratorContext): T {
  Object.seal(value);
  Object.seal(value.prototype);
  return value;
}

// --- Method decorator: value = the method; wrap it for logging/timing ---
function logged(value: Function, ctx: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) {
    console.log(`calling ${String(ctx.name)}`);
    return value.apply(this, args);
  };
}

// --- Field decorator: value is undefined; return an initializer transform ---
function uppercase(_value: undefined, ctx: ClassFieldDecoratorContext) {
  return (initial: string) => initial.toUpperCase(); // transforms the initial value
}

// --- Accessor decorator: decorates an `accessor` field (auto get/set) ---
function logAccess<T>(value: { get: () => T; set: (v: T) => void }, ctx: ClassAccessorDecoratorContext) {
  return {
    get() { console.log(`read ${String(ctx.name)}`); return value.get.call(this); },
    set(v: T) { console.log(`write ${String(ctx.name)}`); value.set.call(this, v); },
  };
}

@sealed
class Service {
  @uppercase name = 'svc';

  accessor count = 0; // an "auto-accessor" — required for accessor decorators

  @logged
  run() { return 'done'; }
}
```

`context` also offers `addInitializer()` (run logic at construction time) and `ctx.access` (read/write the member), plus `ctx.metadata` for the new decorator-metadata channel.

### Decorator Metadata

- **Stage 3 metadata**: each decorator context has a shared `context.metadata` object, surfaced at runtime via `Symbol.metadata` on the class. No `reflect-metadata` needed.
- **Legacy metadata**: with `emitDecoratorMetadata: true`, the compiler emits design-time type info (`design:type`, `design:paramtypes`, `design:returntype`) readable via the `reflect-metadata` polyfill. This is how NestJS knows the *types* of constructor parameters.

```ts
// Stage 3 metadata channel
function tagged(tag: string) {
  return function (_v: any, ctx: ClassFieldDecoratorContext) {
    (ctx.metadata as any)[ctx.name] = tag; // stash info on the shared metadata object
  };
}
class M { @tagged('id') field = ''; }
const meta = (M as any)[Symbol.metadata]; // { field: 'id' }
```

### How NestJS Uses Decorators Under the Hood

NestJS is built on **legacy** decorators + `reflect-metadata`. The mechanism:

1. `@Injectable()` / `@Controller()` mark a class; with `emitDecoratorMetadata`, the compiler emits `design:paramtypes` — the *types* of the constructor parameters.
2. At bootstrap, Nest reads `design:paramtypes` via `Reflect.getMetadata(...)` to learn what each constructor argument *is*, then resolves each from the DI container and instantiates the class. This is **constructor injection by type** — exactly like ASP.NET Core's container resolving `ctor(IFooService foo)`.
3. Route/param decorators (`@Get('/x')`, `@Param('id')`, `@Body()`) attach metadata that the router and pipes read per request.

```ts
import 'reflect-metadata';

@Controller('users') // metadata: path 'users'
class UsersController {
  // emitDecoratorMetadata records design:paramtypes = [UsersService]
  constructor(private readonly users: UsersService) {}

  @Get(':id')                    // metadata: method GET, path ':id'
  findOne(@Param('id') id: string) { // @Param metadata: bind route param 'id'
    return this.users.find(id);
  }
}
```

Direct ASP.NET parallel: `@Controller` ≈ `[ApiController]`/`[Route]`, `@Get(':id')` ≈ `[HttpGet("{id}")]`, `@Param('id')` ≈ `[FromRoute] id`, constructor injection is identical in spirit (resolve-by-type from the container).

---

## 2.7 Type-Safe Patterns

### Builder Pattern (tracking state in the type)

Use a generic that accumulates which fields have been set, so `.build()` is only callable once required fields exist.

```ts
class QueryBuilder<Set extends string = never> {
  private parts: Record<string, unknown> = {};

  from<T extends string>(table: T): QueryBuilder<Set | 'from'> {
    this.parts.from = table;
    return this as any;
  }
  where(cond: string): QueryBuilder<Set | 'where'> {
    this.parts.where = cond;
    return this as any;
  }
  // build() only exists when 'from' has been set (conditional method gating)
  build(this: QueryBuilder<'from' | Set>): string {
    return `SELECT * FROM ${this.parts.from}` + (this.parts.where ? ` WHERE ${this.parts.where}` : '');
  }
}

new QueryBuilder().from('users').where('id = 1').build(); // OK
new QueryBuilder().where('id = 1').build();                // ERROR — 'from' not set yet
```

The `this:` parameter is the trick: it constrains *who* can call `build()` based on the accumulated type state.

### Phantom Types — encoding state in the type system

A phantom type parameter carries compile-time-only information that has no runtime representation. Useful for state machines where illegal transitions should not compile.

```ts
declare const phantom: unique symbol;
type Connection<State extends 'open' | 'closed'> = { id: string; [phantom]?: State };

function open(): Connection<'open'> { return { id: 'c1' }; }
function close(c: Connection<'open'>): Connection<'closed'> { return c as any; }
function send(c: Connection<'open'>, msg: string): void { /* ... */ }

const c = open();
send(c, 'hi');          // OK — c is open
const closed = close(c);
send(closed, 'late');   // ERROR — closed is Connection<'closed'>, not 'open'
```

### Branded / Opaque Types

Defeats structural typing on purpose: two `string`s with different *meanings* (`UserId` vs `OrderId`) become non-interchangeable. This recovers the nominal safety C# gives you for free.

```ts
// A brand is a phantom property that exists only in the type, never at runtime.
type Brand<T, B extends string> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

// Smart constructors — the only sanctioned way to create a branded value.
const UserId = (s: string): UserId => s as UserId;
const OrderId = (s: string): OrderId => s as OrderId;

function getUser(id: UserId) { /* ... */ }

const uid = UserId('u_1');
const oid = OrderId('o_9');
getUser(uid); // OK
getUser(oid); // ERROR — OrderId is not assignable to UserId
getUser('u_1'); // ERROR — raw string is not branded
```

At runtime `uid` is just `'u_1'` — the brand is erased. You get C#'s "a `UserId` is not an `OrderId`" guarantee with zero runtime cost.

### `zod` — runtime + compile-time validation

`zod` is the TS-ecosystem equivalent of FluentValidation/Joi: define a schema once, get **runtime validation** and a **statically inferred type** from the same source. This bridges the gap TS can't cross alone — TS types vanish at runtime, so external input (HTTP bodies, env, JSON) must be validated at the boundary.

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  role: z.enum(['admin', 'user']),
});

// Derive the static type from the schema — single source of truth
type User = z.infer<typeof UserSchema>;
// { id: string; email: string; age?: number; role: 'admin' | 'user' }

// At a boundary: parse throws on invalid; safeParse returns a result union
const result = UserSchema.safeParse(req.body);
if (!result.success) {
  // result.error — structured validation errors
} else {
  const user = result.data; // type: User, fully validated at runtime
}
```

Pattern: validate-then-trust at the edges, and let TS carry the proven type inward. In NestJS you'd use a `ZodValidationPipe` (or `class-validator` DTOs — the framework-native option).

### Typing Express/NestJS request/response

**Express** — use generics on `Request`/`Response` plus module augmentation for custom props:

```ts
import { Request, Response } from 'express';

// Request<Params, ResBody, ReqBody, Query>
type CreateUserReq = Request<{ }, User, { email: string; password: string }>;

app.post('/users', (req: CreateUserReq, res: Response<User>) => {
  req.body.email;     // type: string  (typed body)
  req.user;           // type: { id: string; roles: string[] } | undefined  (from 2.4 augmentation)
  res.json(/* must be User */);
});
```

**NestJS** — prefer DTO classes (decorated for validation) over typing raw `req`; the framework binds and validates them:

```ts
class CreateUserDto {
  @IsEmail() email!: string;
  @MinLength(8) password!: string;
}

@Post()
create(@Body() dto: CreateUserDto): Promise<User> {
  // dto is validated by ValidationPipe before this runs
  return this.service.create(dto);
}
```

---

## 2.8 tsconfig Deep Dive

### `strict` mode and its flags

`"strict": true` is an umbrella enabling the whole family. Know what each does so you can reason about errors:

- `strictNullChecks` — `null`/`undefined` are not in every type; you must handle them. **The single most important flag.** (C# nullable reference types are the direct analogue.)
- `strictFunctionTypes` — contravariant parameter checking for function types (catches unsound callbacks).
- `strictBindCallApply` — type-checks `.bind`/`.call`/`.apply` arguments.
- `strictPropertyInitialization` — class fields must be initialized (or marked `!`/optional). Like C#'s non-nullable field warnings.
- `noImplicitAny` — error when a type silently infers to `any`.
- `noImplicitThis` — error on `this` of implicit `any` type.
- `alwaysStrict` — emit `"use strict"` and parse in strict mode.
- `useUnknownInCatchVariables` — `catch (e)` gives `unknown`, not `any` (forces narrowing — like C# catching `Exception` then checking the concrete type).

Beyond `strict`, frequently-added safety flags: `noUncheckedIndexedAccess` (indexing adds `| undefined`), `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.

### Module Resolution: `node` vs `node16`/`nodenext` vs `bundler`

How TS resolves `import 'x'` to a file. Pick based on *what actually runs/bundles your code*.

- `node` (a.k.a. `node10`) — legacy CommonJS resolution. No support for `package.json` `exports`. Avoid in new projects.
- `node16` / `nodenext` — models modern Node's dual ESM/CJS resolution: respects `package.json` `"type"` and `"exports"`, and **requires explicit file extensions in relative ESM imports** (`import './x.js'`). Use when you ship code that Node runs directly.
- `bundler` — for code processed by a bundler (Vite, esbuild, webpack). Understands `exports` but does **not** force extensions. Use for frontend / bundled apps.

```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext" // these two move together in modern setups
  }
}
```

### `paths` — alias mapping

Maps import specifiers to locations, like a custom resolution table. Removes `../../../` chains. **Caveat:** `paths` only affects type-checking; the runtime/bundler must apply the same mapping (e.g. `tsconfig-paths`, or the bundler's alias config).

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/*"],
      "@domain": ["src/domain/index.ts"]
    }
  }
}
// import { User } from '@app/users/user';  ->  src/users/user
```

### `composite` + `references` — project references (monorepos)

Splits a large codebase into independently-built sub-projects with a dependency graph. `tsc --build` builds them in topological order and skips unchanged ones (incremental). This is the TS equivalent of a C# solution with multiple `.csproj` and project references.

```jsonc
// packages/core/tsconfig.json
{ "compilerOptions": { "composite": true, "declaration": true, "outDir": "dist" } }

// packages/api/tsconfig.json — depends on core
{
  "compilerOptions": { "composite": true, "outDir": "dist" },
  "references": [{ "path": "../core" }]
}
```

`composite: true` forces `declaration` output and `.tsbuildinfo` caching. Build with `tsc --build packages/api` and core builds first.

### `verbatimModuleSyntax` — why `import type` matters

Tells TS to emit imports/exports **exactly as written** (modulo dropping `import type`), instead of trying to elide unused imports. The problem it fixes: a *value* import that's only used as a *type* would, under old "isolatedModules" rules, be ambiguously dropped — breaking side-effecting imports and confusing bundlers/transpilers (esbuild, swc) that compile file-by-file and can't know if an import is type-only.

The rule it enforces: mark type-only imports/exports with `type` so single-file transpilers can safely erase them.

```ts
// With verbatimModuleSyntax: true
import { type User, createUser } from './user'; // `type User` erased, createUser kept
import type { Config } from './config';         // whole import erased at emit

import './polyfills'; // side-effect import — preserved verbatim (no longer wrongly elided)
```

Practically: any project transpiled by a non-tsc tool (esbuild/swc/Vite/Babel) should enable `verbatimModuleSyntax` and use `import type` for type-only imports. It's the modern replacement for `isolatedModules` + `importsNotUsedAsValues`.

---

## Gotchas

- **Excess property checks only fire on fresh object literals** — assign through an intermediate variable and the extra-property error disappears (see 2.1). Don't mistake "it compiled" for "the shape is exactly right."
- **Two structurally identical types are interchangeable** — `Celsius` and `Fahrenheit` both `{ degrees: number }` are the same to TS. Use **branded types** when meaning matters (2.7).
- **Distributive conditionals surprise you** — `T extends U ? ...` over a union distributes member-by-member. Wrap in `[T]` to stop it (2.2).
- **`any` poisons silently; `unknown` forces a check** — prefer `unknown` for untrusted input. `catch (e)` is `unknown` under strict mode — narrow before use.
- **Types are erased at runtime** — `typeof`, `instanceof` work on values, not TS types. You cannot reflect over an interface. This is why zod/class-validator exist (2.7) and why NestJS needs `emitDecoratorMetadata`.
- **`as` is an unchecked assertion, not a conversion** — `value as Foo` tells the compiler to shut up; it does not validate. A bad cast surfaces as a runtime bug. `satisfies` validates without asserting (2.5).
- **`enum` has runtime cost and quirks** — numeric enums are bidirectional objects and allow out-of-range numbers; `const enum` is inlined but breaks under `isolatedModules`. Prefer `as const` unions (2.1) for most cases.
- **Decorator system mismatch** — turning on `experimentalDecorators` switches you to the *legacy* system with a totally different signature than Stage 3. NestJS/TypeORM need legacy; don't mix mental models (2.6).
- **`paths` doesn't rewrite emitted JS** — type-checking resolves the alias, but Node won't at runtime unless you add `tsconfig-paths` or a bundler alias (2.8).
- **`Object.keys()` returns `string[]`, not `(keyof T)[]`** — a deliberate soundness choice (objects can have extra keys at runtime). Cast or use a typed helper if you need narrow keys.
- **Mapped types over unions vs objects** — `keyof (A | B)` is only the *common* keys; `keyof (A & B)` is all keys. Easy to get backwards.

---

## Phase 2 Mini-Project

**Task:** Build a type-safe event emitter with full TypeScript inference. Event names map to specific payload types, and the compiler enforces that `emit`, `on`, and `off` use the correct payload for each event — wrong payloads are *compile errors*, not runtime surprises.

**Location:** `examples/phase2-event-emitter/`

**Core idea:** A single `EventMap` interface (one source of truth) maps each event name to its payload type. Generics + indexed access types (`EventMap[K]`) thread that payload through every method.

**Implementation hints:**

- Define the public API as a generic class `TypedEmitter<TEvents extends Record<string, any>>`.
- Storage: a `Map<keyof TEvents, Set<Function>>` (or a `Partial<{ [K in keyof TEvents]: Set<...> }>`).
- `on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void)` — `K` is constrained to the event keys; `TEvents[K]` indexes the matching payload type.
- `emit<K extends keyof TEvents>(event: K, payload: TEvents[K])` — same constraint forces the right payload.
- `off` mirrors `on` and removes the listener from the set.
- Use `keyof TEvents` everywhere a name is accepted so unknown event names are compile errors too.
- Stretch: a `once` method (auto-unsubscribe), and a void-payload ergonomic overload so events with `void` payload don't require a second argument.

**Target usage (with the compile errors it must produce):**

```ts
interface AppEvents {
  login: { userId: string; at: Date };
  logout: void;
  message: { from: string; text: string };
}

const bus = new TypedEmitter<AppEvents>();

// payload type is inferred from the event name:
bus.on('login', (p) => {
  p.userId; // type: string  — inferred, no annotation needed
  p.at;     // type: Date
});

bus.on('message', (p) => console.log(p.from, p.text)); // p: { from; text }

// emitting with the correct payload — OK:
bus.emit('login', { userId: 'u1', at: new Date() });
bus.emit('logout');                       // OK — void payload needs no argument

// --- all of these must be COMPILE ERRORS ---
bus.emit('login', { userId: 'u1' });      // ERROR — missing 'at'
bus.emit('login', { userId: 42, at: new Date() }); // ERROR — userId must be string
bus.emit('message', { from: 'a' });       // ERROR — missing 'text'
bus.emit('unknown', {});                  // ERROR — 'unknown' is not a key of AppEvents
bus.on('login', (p: { wrong: boolean }) => {}); // ERROR — listener payload mismatch
```

**Skeleton to flesh out:**

```ts
type Listener<T> = (payload: T) => void;

class TypedEmitter<TEvents extends Record<string, any>> {
  private listeners: { [K in keyof TEvents]?: Set<Listener<TEvents[K]>> } = {};

  on<K extends keyof TEvents>(event: K, fn: Listener<TEvents[K]>): this {
    (this.listeners[event] ??= new Set()).add(fn);
    return this;
  }

  off<K extends keyof TEvents>(event: K, fn: Listener<TEvents[K]>): this {
    this.listeners[event]?.delete(fn);
    return this;
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners[event]?.forEach((fn) => fn(payload));
  }
  // TODO: once(), and a void-payload-friendly emit signature
}
```

**.NET parallel:** this is the typed-event equivalent of a C# `event EventHandler<TArgs>` — each event carries a fixed payload type the compiler enforces — except here a *single generic class* serves any event map, with the payload types flowing entirely from inference.
