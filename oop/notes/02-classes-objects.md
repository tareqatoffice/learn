# Phase 2 — Classes, Objects & Members

**Status:** In Progress
**Started:** 2026-06-17

> You've *used* classes for years (React class components, NestJS services, EF entities). This phase makes the implicit explicit: what a class actually *is*, the parts it's built from, and where TypeScript and C# quietly disagree. Every concept is shown in **both languages**, using a running **Media Library** domain (`Book`, `Member`, `Loan`).

---

## 2.1 Defining a Class

A **class** is a blueprint. An **object** (instance) is a thing built from that blueprint with `new`. The blueprint says *what state exists* and *what behavior is available*; each instance carries its own copy of the state.

### Anatomy of a class

Every class is built from four kinds of members:

```
┌──────────────────────── class Book ────────────────────────┐
│                                                             │
│  FIELDS        raw storage     #copies, _isbn               │
│  PROPERTIES    controlled get/set over state   Title        │
│  CONSTRUCTORS  how to build a valid instance   new Book(..) │
│  METHODS       behavior — what the object DOES  borrow()    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
       blueprint (class)              →  new  →   object (instance)
                                                  has its OWN field values
```

### Side by side

```typescript
// TypeScript
class Book {
  // fields — raw storage (class field syntax)
  isbn: string;
  title: string;
  private copies: number; // compile-time private

  // constructor — builds a valid instance
  constructor(isbn: string, title: string, copies: number) {
    this.isbn = isbn;
    this.title = title;
    this.copies = copies;
  }

  // method — behavior
  describe(): string {
    return `${this.title} (${this.copies} copies)`;
  }
}

const b = new Book("978-0", "Dune", 3);
console.log(b.describe()); // "Dune (3 copies)"
```

```csharp
// C#
public class Book
{
    // fields — raw storage (private by convention)
    private string _isbn;
    private int _copies;

    // property — controlled access (the C# idiom, not a public field)
    public string Title { get; set; }

    // constructor — builds a valid instance
    public Book(string isbn, string title, int copies)
    {
        _isbn = isbn;
        Title = title;
        _copies = copies;
    }

    // method — behavior. Expression-bodied (=>) since it's a one-liner.
    public string Describe() => $"{Title} ({_copies} copies)";
}

var b = new Book("978-0", "Dune", 3);
Console.WriteLine(b.Describe()); // "Dune (3 copies)"
```

**The first divergence to notice:** in TS, `class Foo {}` is a runtime construct (it desugars to a constructor function + prototype — see `javascript/notes/01-js-internals.md` §1.4). In C#, a class is a compile-time type the CLR knows about directly. TS classes are also *structurally* typed (anything with the right shape is assignable); C# classes are *nominally* typed (you must declare the relationship).

---

## 2.2 Fields & Properties — Object State

This is where the two languages genuinely differ in idiom, so it's worth slowing down.

- A **field** is raw storage — a variable that lives on the instance.
- A **property** is *controlled access* — a `get`/`set` pair that looks like a field from the outside but runs code.

In JS/TS, you reach for properties (accessors) only when you need logic; plain fields are normal. In C#, the convention is the opposite: **expose almost everything as a property**, even when it's a trivial pass-through, because properties are the unit of binding, serialization, and future-proofing.

### Fields vs properties

```typescript
// TypeScript
class Member {
  // plain fields — the normal case in TS
  id: number;
  name: string;

  // a backing field + accessor pair, only when you need logic
  private _email = "";
  get email(): string {
    return this._email;
  }
  set email(value: string) {
    if (!value.includes("@")) throw new Error("Invalid email");
    this._email = value.toLowerCase();
  }

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

const m = new Member(1, "Tareq");
m.email = "Tareq@Example.com"; // setter runs
console.log(m.email);          // "tareq@example.com" (getter runs)
```

```csharp
// C#
public class Member
{
    // auto-properties — compiler generates the hidden backing field
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    // full property — explicit backing field + logic (same idea as TS get/set)
    private string _email = string.Empty;
    public string Email
    {
        get => _email;
        set
        {
            if (!value.Contains('@')) throw new ArgumentException("Invalid email");
            _email = value.ToLowerInvariant();
        }
    }

    public Member(int id, string name)
    {
        Id = id;
        Name = name;
    }
}

var m = new Member(1, "Tareq");
m.Email = "Tareq@Example.com"; // setter runs
Console.WriteLine(m.Email);    // "tareq@example.com"
```

### C# auto-properties: `get; set;`, `init`, computed

```csharp
public class Loan
{
    // read/write auto-property
    public int Id { get; set; }

    // read-only from outside, settable only in constructor/initializer
    public string BookIsbn { get; init; } = string.Empty;

    // read-only outside, writable only inside the class (private set)
    public DateTime? ReturnedAt { get; private set; }

    // fully computed — no backing field, recalculated each read
    public bool IsReturned => ReturnedAt is not null;

    public void Return() => ReturnedAt = DateTime.UtcNow; // legal: private set
}
```

| C# property form | Meaning | TS equivalent |
|---|---|---|
| `{ get; set; }` | read + write | public field, or `get`/`set` pair |
| `{ get; init; }` | set only during construction | `readonly` field set in ctor |
| `{ get; private set; }` | read outside, write inside | `get` accessor + `private` field |
| `=> expr` (computed) | recalculated, no storage | `get` accessor only |

> Note the TS analogue of `init` is `readonly` — but TS `readonly` is *compile-time only*; nothing stops a cast or plain JS from writing it. C# `init` is enforced by the runtime. (More on this in Phase 3.)

### Initialisers & defaults

Both languages let you assign a default right at the field declaration. This runs **before** the constructor body.

```typescript
class Book {
  copies = 1;             // default if not set otherwise
  tags: string[] = [];    // each instance gets its OWN array
}
```

```csharp
public class Book
{
    public int Copies { get; set; } = 1;
    public List<string> Tags { get; set; } = new(); // each instance gets its own list
}
```

> **Shared-default trap (both languages):** the *expression* runs per-instance, so `tags = []` / `new()` is fine — each object gets a fresh array. The danger is only if you point every instance at one *pre-existing* shared object (e.g., a `static readonly` list). Then mutating one mutates all. See Gotchas.

---

## 2.3 Methods — Object Behavior

A **method** is a function that belongs to a class and runs against an instance's state (via `this`). A method's **signature** is its name + parameter types (and, in C#, it participates in overload resolution; the return type is *not* part of the signature for overloading).

### Instance methods

```typescript
// TypeScript
class Loan {
  constructor(
    public bookIsbn: string,
    public memberId: number,
    public dueDate: Date,
  ) {}

  isOverdue(asOf: Date = new Date()): boolean {
    return asOf > this.dueDate;
  }

  // concise: arrow not needed; method shorthand is the norm
  renew(days: number): void {
    this.dueDate = new Date(this.dueDate.getTime() + days * 86_400_000);
  }
}
```

```csharp
// C#
public class Loan
{
    public string BookIsbn { get; }
    public int MemberId { get; }
    public DateTime DueDate { get; private set; }

    public Loan(string bookIsbn, int memberId, DateTime dueDate)
    {
        BookIsbn = bookIsbn;
        MemberId = memberId;
        DueDate = dueDate;
    }

    // expression-bodied member — the C# "concise method"
    public bool IsOverdue(DateTime? asOf = null) => (asOf ?? DateTime.UtcNow) > DueDate;

    // block body when there's more than one statement
    public void Renew(int days) => DueDate = DueDate.AddDays(days);
}
```

### Expression-bodied members (C#)

C# lets you replace `{ return expr; }` with `=> expr` for methods, properties, constructors, and more. It's purely cosmetic — same behavior, less ceremony.

```csharp
public string Label => $"Loan of {BookIsbn}";       // computed property
public bool CanRenew() => !IsOverdue();             // method
public override string ToString() => Label;         // override
```

TS has no separate "expression-bodied member" concept; method bodies are always `{ ... }`. (Arrow *class fields* are different — they're about `this`-binding, §2.5.)

### Method overloading

This is a real divergence.

**C# has true overloading:** multiple methods, same name, *different parameter lists*. The compiler picks the match at compile time.

```csharp
public class Library
{
    public Book? Find(int id)       => /* look up by id */ null;
    public Book? Find(string isbn)  => /* look up by isbn */ null;
    public List<Book> Find(string title, bool fuzzy) => new();
}

var lib = new Library();
lib.Find(42);            // calls Find(int)
lib.Find("978-0");       // calls Find(string)
lib.Find("Dune", true);  // calls Find(string, bool)
```

**TypeScript has no real overloading** — only **one implementation**. You can *declare* multiple overload signatures, but you write a single body that handles all of them (usually via unions / runtime checks). JS itself just replaces the method, so there's nothing to overload at runtime.

```typescript
class Library {
  // overload signatures (no body) — these are what callers see
  find(id: number): Book | undefined;
  find(isbn: string): Book | undefined;
  // single implementation signature (not directly callable as-is)
  find(key: number | string): Book | undefined {
    if (typeof key === "number") {
      return undefined; // look up by id
    }
    return undefined;   // look up by isbn
  }
}
```

| | TypeScript | C# |
|---|---|---|
| Multiple bodies | No — one implementation | Yes — one per signature |
| Dispatch | You branch at runtime (`typeof`) | Compiler picks at compile time |
| Mechanism | overload signatures + union types | true overload resolution |
| Default params | yes (`x = 5`) — often replaces overloads | yes; also `params` for varargs |

---

## 2.4 Constructors & Initialization

A **constructor** runs when you `new` an object. Its job: leave the instance in a valid initial state.

### Basic constructors

```typescript
class Book {
  isbn: string;
  title: string;
  constructor(isbn: string, title: string) {
    this.isbn = isbn;
    this.title = title;
  }
}
```

```csharp
public class Book
{
    public string Isbn { get; }
    public string Title { get; }
    public Book(string isbn, string title)
    {
        Isbn = isbn;
        Title = title;
    }
}
```

### TS parameter properties — the assignment shortcut

TypeScript lets you declare *and* assign a field straight from a constructor parameter by adding an access modifier (`public`/`private`/`protected`/`readonly`). This is the single most common TS class idiom (NestJS DI relies on it).

```typescript
class Loan {
  // each modifier'd param becomes a field, assigned automatically
  constructor(
    public readonly bookIsbn: string,
    public readonly memberId: number,
    private dueDate: Date,
  ) {}
  // no `this.bookIsbn = bookIsbn` needed — TS generates it
}
```

### C# primary constructors — the modern shortcut

C# 12 added **primary constructors**: parameters declared on the class header, in scope throughout the class body. Note the subtle difference from TS: a C# primary-constructor parameter is *not automatically a property* — it's a captured parameter you can use in initialisers/methods. Promote it to a property explicitly if you want one exposed.

```csharp
// C# 12 primary constructor
public class Loan(string bookIsbn, int memberId, DateTime dueDate)
{
    // expose as properties explicitly (params themselves aren't properties)
    public string BookIsbn { get; } = bookIsbn;
    public int MemberId { get; } = memberId;

    // or just use the param directly in members
    public bool IsOverdue() => DateTime.UtcNow > dueDate;
}
```

| | TS parameter property | C# primary constructor |
|---|---|---|
| Syntax | `constructor(private x: T)` | `class C(T x)` |
| Auto-creates a field? | Yes (and exposes per modifier) | No — captured param; promote manually |
| Multiple constructors | one `constructor` only | primary + extra `public C(...) : this(...)` |

### Constructor chaining

Calling one constructor from another (same class), or the base class constructor.

```typescript
// TS: only super(...) — chaining to a base constructor. No "this(...)" overloads.
class Audiobook extends Book {
  constructor(isbn: string, title: string, public narrator: string) {
    super(isbn, title); // MUST call base ctor before using `this`
  }
}
```

```csharp
// C#: ": this(...)" chains to another ctor in the SAME class
//     ": base(...)" chains to the BASE class ctor
public class Book
{
    public string Isbn { get; }
    public string Title { get; }
    public int Copies { get; }

    public Book(string isbn, string title, int copies)
    {
        Isbn = isbn; Title = title; Copies = copies;
    }

    // delegate to the 3-arg ctor with a default — no duplicated logic
    public Book(string isbn, string title) : this(isbn, title, 1) { }
}

public class Audiobook : Book
{
    public string Narrator { get; }
    public Audiobook(string isbn, string title, string narrator)
        : base(isbn, title) // call base ctor
    {
        Narrator = narrator;
    }
}
```

### Object initialisers (C#) vs object literals (TS)

C# object initialisers let you set properties *after* the constructor runs, in one expression. They look superficially like TS object literals but are fundamentally different: an object literal in TS/JS **creates** the object's shape; a C# initialiser just **assigns properties** on an already-constructed instance.

```csharp
// C# object initialiser — runs the parameterless/used ctor, THEN sets properties
var book = new Book("978-0", "Dune")
{
    Copies = 5,           // settable because it's get;set; (or init)
};
```

```typescript
// TS object literal — creates a plain object (NOT an instance of a class)
const bookDto = {
  isbn: "978-0",
  title: "Dune",
  copies: 5,
};
// To make a class instance you must call the constructor:
const book = new Book("978-0", "Dune");
```

> Key point for a TS dev: in C#, `new Book { ... }` is still a real `Book` (constructor ran first). In TS, `{ ... }` is a structurally-typed bag, not a `Book` instance — it won't have methods or pass `instanceof Book`.

---

## 2.5 `this`, Static vs Instance Members

### `this` in instance methods

Inside an instance method, `this` refers to the object the method was called on. In a method body it's intuitive in both languages — the difference is **what happens when you detach the method from its object**.

In C#, `this` is bound to the instance by the runtime; you cannot accidentally lose it. A method group always carries its receiver.

```csharp
public class Member
{
    public string Name { get; set; } = "";
    public string Greet() => $"Hi, {Name}";
}

var m = new Member { Name = "Tareq" };
Func<string> g = m.Greet; // delegate captures `m` as the receiver
Console.WriteLine(g());   // "Hi, Tareq" — `this` is never lost
```

### The JS `this`-binding trap

In JS/TS, `this` is decided by **how a function is called**, not where it's defined (full rules in `javascript/notes/01-js-internals.md` §1.6). Detaching a method drops its `this`:

```typescript
class Member {
  constructor(public name: string) {}

  greet(): string {
    return `Hi, ${this.name}`;
  }

  // arrow CLASS FIELD: `this` is captured lexically, survives detachment
  greetBound = (): string => `Hi, ${this.name}`;
}

const m = new Member("Tareq");

const g = m.greet;        // detached — lost `this`
// g();                   // TypeError: Cannot read properties of undefined (reading 'name')

const g2 = m.greetBound;  // arrow field — `this` baked in
console.log(g2());        // "Hi, Tareq"

// or fix at the call site:
console.log(m.greet.call(m)); // "Hi, Tareq"
```

```
  C# method group        TS plain method          TS arrow field
  ───────────────        ───────────────          ──────────────
  receiver travels       receiver = "thing         `this` captured at
  with the delegate      before the dot"           construction time
       ✓ safe            ✗ lost when detached         ✓ safe (but one
                                                        function per instance)
```

> Practical rule for TS: if a method will be passed as a callback (event handlers, `setTimeout`, React props), use an **arrow class field** or `.bind(this)`. In C# you never think about this.

### Static members — class-level, not instance-level

A **static** member belongs to the *class itself*, not to any instance. There's exactly one copy, shared across everything. No `this`. Use it for constants, factory helpers, and counters.

```typescript
// TypeScript
class Loan {
  static readonly LOAN_PERIOD_DAYS = 14; // shared constant
  static count = 0;                       // shared mutable state

  id: number;
  constructor() {
    Loan.count++;                // refer via the class name, not `this`
    this.id = Loan.count;
  }

  // static method — no access to instance state
  static defaultDueDate(from: Date = new Date()): Date {
    return new Date(from.getTime() + Loan.LOAN_PERIOD_DAYS * 86_400_000);
  }
}

const a = new Loan();
const b = new Loan();
console.log(Loan.count);          // 2
console.log(Loan.defaultDueDate); // accessed on the class
```

```csharp
// C#
public class Loan
{
    public const int LoanPeriodDays = 14;   // compile-time constant
    public static int Count { get; private set; } // shared mutable state

    public int Id { get; }

    public Loan()
    {
        Count++;          // refer via the type, implicitly here
        Id = Count;
    }

    // static method
    public static DateTime DefaultDueDate(DateTime? from = null)
        => (from ?? DateTime.UtcNow).AddDays(LoanPeriodDays);

    // static constructor — runs ONCE, before first use of the type. No params.
    static Loan()
    {
        // one-time setup for static state
        Count = 0;
    }
}

Console.WriteLine(Loan.Count);            // shared across all instances
Console.WriteLine(Loan.DefaultDueDate()); // called on the type
```

**Static constructors:** C# has a dedicated `static C() { }` that runs once, lazily, before the type is first used — handy for initialising static state. TS has no static constructor, but you can run a static initialisation block:

```typescript
class Config {
  static settings: Record<string, string>;
  static {
    // static initialisation block (TS 4.4+ / ES2022) — runs once at class eval
    Config.settings = { env: "dev" };
  }
}
```

### Static classes (C#)

C# has fully `static class`es — they can't be instantiated and contain only static members. The idiom for "a bag of related functions / utilities" (this is also how extension methods are declared — see `.net/notes/01-csharp-fundamentals.md` §1.7).

```csharp
public static class LoanRules
{
    public static decimal LateFeePerDay => 0.50m;
    public static decimal CalculateFee(int daysLate) => daysLate * LateFeePerDay;
}

// LoanRules.CalculateFee(3) — no `new LoanRules()` possible
```

TS has no `static class` keyword. The equivalents are: a class with only `static` members, a plain object of functions, or (most idiomatically) a **module** that exports functions:

```typescript
// loanRules.ts — a module IS the "static class" in TS
export const LATE_FEE_PER_DAY = 0.5;
export function calculateFee(daysLate: number): number {
  return daysLate * LATE_FEE_PER_DAY;
}
```

---

## 2.6 Object Lifecycle

### Creation with `new`, and what a variable holds

`new` does three things in both languages: allocate memory for the object, run the constructor, and hand back a **reference** to it. The variable you assign does **not** hold the object — it holds a reference (a pointer) to the object on the heap.

```
let a = new Book(...)        a ─────────┐
let b = a                              ▼
                              ┌──────────────────┐
                              │  Book on the heap │   ← one object
                              │  title: "Dune"    │
                              └──────────────────┘
                                       ▲
b ─────────────────────────────────────┘
   a and b are TWO references to ONE object
```

```typescript
const a = new Book("978-0", "Dune");
const b = a;          // copies the REFERENCE, not the object
b.title = "Dune II";  // mutates the one shared object
console.log(a.title); // "Dune II" — a and b point to the same thing
```

```csharp
var a = new Book("978-0", "Dune"); // (Title made settable for the demo)
var b = a;            // copies the reference
b.Title = "Dune II";
Console.WriteLine(a.Title); // "Dune II" — same object
```

This is identical in both languages **for classes**. The story changes for C# `struct`s — see §2.7.

### Garbage collection in both runtimes

Neither language has manual `free`. An object lives as long as something can still reach it; once unreachable, the garbage collector reclaims it — eventually, on its own schedule.

- **Node/V8:** generational GC (young/old spaces, scavenger + mark-sweep). Most objects die young. Details in `javascript/notes/01-js-internals.md` §1.5.
- **.NET CLR:** also a generational GC (Gen 0/1/2 + Large Object Heap). Same core idea — track reachability, collect the unreachable, promote survivors.

The practical takeaways are the same in both: GC handles **memory**, but it is **non-deterministic** (you don't know *when* it runs) and it does **not** manage non-memory resources like file handles, sockets, or DB connections. For those you need deterministic cleanup.

### Deterministic cleanup

When an object owns an OS resource, "the GC will get to it eventually" isn't good enough — you want to release it *now*, at a known point. Both ecosystems have a `using` construct for exactly this.

```csharp
// C#: IDisposable + using
public class FileLoanLog : IDisposable
{
    private readonly StreamWriter _writer;
    public FileLoanLog(string path) => _writer = new StreamWriter(path);

    public void Write(string line) => _writer.WriteLine(line);

    public void Dispose() => _writer.Dispose(); // release the handle deterministically
}

// using statement — Dispose() runs at the end of the block, even on exception
using (var log = new FileLoanLog("loans.txt"))
{
    log.Write("Loan created");
} // <- Dispose() called here, guaranteed

// using DECLARATION (C# 8+) — disposed at end of enclosing scope
using var log2 = new FileLoanLog("loans.txt");
log2.Write("Another loan");
// Dispose() runs when the method/scope exits
```

```typescript
// TypeScript 5.2+: Symbol.dispose + `using` declaration
class FileLoanLog {
  // implements Disposable via the well-known symbol
  [Symbol.dispose](): void {
    console.log("closing file handle"); // release resource deterministically
  }
  write(line: string): void {
    /* ... */
  }
}

function record(): void {
  using log = new FileLoanLog(); // `using` declaration
  log.write("Loan created");
} // <- log[Symbol.dispose]() runs here, even if an exception is thrown

// async resources use Symbol.asyncDispose + `await using`
```

| | C# | TypeScript |
|---|---|---|
| Interface | `IDisposable` (`Dispose()`) | `Disposable` (`[Symbol.dispose]()`) |
| Async | `IAsyncDisposable` (`DisposeAsync()`) | `AsyncDisposable` (`[Symbol.asyncDispose]()`) |
| Statement | `using (...) { }` / `using var x = ...` | `using x = ...` / `await using x = ...` |
| Since | C# 1.0 / 8.0 declarations | TS 5.2 (ES proposal) |

> Both run cleanup on **scope exit, including exceptions** — it's `try/finally` made declarative. Use it for files, sockets, DB connections, locks; *not* for plain in-memory objects (let the GC handle those).

---

## 2.7 Reference vs Value Semantics

This is the single biggest mental shift between the two languages, because **JS has no value types** and **C# does**.

### The two semantics

- **Reference semantics:** a variable holds a *reference*. Assigning or passing copies the reference; both names point to the same object. Mutating through one is visible through the other.
- **Value semantics:** a variable holds the *value itself*. Assigning or passing copies the whole value; the two are independent. Mutating one never affects the other.

```
REFERENCE (class)              VALUE (struct)
a ──┐                          a = { x:1 }   (the bytes live IN a)
    ▼                          b = a          (full copy of the bytes)
  ┌─────┐                      b.x = 9
b─┤ obj │←─ b also points here a.x is still 1  (independent)
  └─────┘
```

### JS/TS: everything is a reference

In JavaScript, every object/array/class instance is a reference type. There is no way to declare a value type. (Primitives — `number`, `string`, `boolean` — are copied by value, but you can't make your own value types.)

```typescript
class Point {
  constructor(public x: number, public y: number) {}
}

const a = new Point(1, 1);
const b = a;       // reference copy
b.x = 9;
console.log(a.x);  // 9 — same object. ALWAYS reference semantics for objects.

// To "copy" you must do it explicitly:
const c = new Point(a.x, a.y); // or { ...a } for a plain object (shallow!)
```

### C#: `class` (reference) vs `struct` (value)

C# lets you choose. `class` → reference type (heap, reference semantics). `struct` → value type (often stack/inline, value semantics, copied on assignment).

```csharp
// reference type
public class PointClass { public int X; public int Y; }

// value type
public struct PointStruct { public int X; public int Y; }

var a = new PointClass { X = 1, Y = 1 };
var b = a;          // reference copy
b.X = 9;
Console.WriteLine(a.X); // 9 — same object

var s1 = new PointStruct { X = 1, Y = 1 };
var s2 = s1;        // FULL VALUE COPY
s2.X = 9;
Console.WriteLine(s1.X); // 1 — independent copy
```

> Rule of thumb for `struct`: small, immutable, value-like data (coordinates, money, a date). Keep them small — large structs are expensive to copy. When in doubt, use a `class`.

### Structural equality: `record` and `record struct`

By default, two distinct `class` instances are **never** equal (`==` compares references — identity, not data). A `record` changes that: the compiler generates value-based `Equals`, `GetHashCode`, and a `ToString`, so two records with the same data are equal.

```csharp
// plain class — reference equality
public class BookClass { public string Isbn = ""; }
var c1 = new BookClass { Isbn = "978-0" };
var c2 = new BookClass { Isbn = "978-0" };
Console.WriteLine(c1 == c2); // False — different objects

// record (reference type) — VALUE equality, immutable-friendly
public record Book(string Isbn, string Title);
var r1 = new Book("978-0", "Dune");
var r2 = new Book("978-0", "Dune");
Console.WriteLine(r1 == r2); // True — same data
Console.WriteLine(r1);       // Book { Isbn = 978-0, Title = Dune } (auto ToString)

// non-destructive copy with `with`
var r3 = r1 with { Title = "Dune Messiah" }; // r1 unchanged

// record struct — value type AND value equality
public record struct Money(decimal Amount, string Currency);
```

There is no built-in TS equivalent for value equality — `===` is always identity for objects. You roll your own or use a library:

```typescript
// TS — no value equality for objects out of the box
const a = { isbn: "978-0", title: "Dune" };
const b = { isbn: "978-0", title: "Dune" };
console.log(a === b); // false — identity, always

// you compare fields manually, or via a helper
function bookEquals(x: Book, y: Book): boolean {
  return x.isbn === y.isbn && x.title === y.title;
}
// "copy with change" is a spread:
const c = { ...a, title: "Dune Messiah" };
```

| | TS object/class | C# `class` | C# `record` | C# `struct` | C# `record struct` |
|---|---|---|---|---|---|
| Semantics | reference | reference | reference | value | value |
| `==` compares | identity | identity | data | data | data |
| Copy on assign | no | no | no | yes | yes |
| Immutable-friendly | manual | manual | `init` + `with` | manual | `with` |

### Copy & aliasing bugs

The classic bug: you think you have a copy, but you have an **alias** (a second reference to the same object). Mutating "your copy" silently mutates the original. This bites in both languages because class instances are references in both.

```typescript
// TS — aliasing bug
function addTag(book: Book, tag: string): Book {
  book.tags.push(tag); // MUTATES the caller's book!
  return book;
}
const original = new Book("978-0", "Dune"); // tags: []
const tagged = addTag(original, "scifi");
console.log(original.tags); // ["scifi"] — original was changed. Surprise.

// Safer: don't mutate inputs; produce a new value
function withTag(book: Book, tag: string): Book {
  return { ...book, tags: [...book.tags, tag] };
}
```

```csharp
// C# — same aliasing trap with a class
void AddTag(Book book, string tag) => book.Tags.Add(tag); // mutates caller's object

// records sidestep it: `with` makes a copy, original stays put
var original = new BookRec("978-0", "Dune", new());
var tagged = original with { Tags = new() { "scifi" } }; // original unchanged

// and shallow-copy gotcha: `with` copies the record's fields, NOT nested objects.
// original.Tags and a naive copy can still share the SAME list reference.
```

> **Shallow vs deep:** spread (`{...x}`), `with`, and `struct` copies are all **shallow** — nested objects/collections are still shared references. If you need true isolation, copy the nested structures too.

---

## Gotchas

- **TS `private` is a lie at runtime.** `private`/`protected`/`readonly` are erased after compilation; plain JS can still reach the field. Use `#field` (true private) when you need real enforcement (covered in Phase 3). C# `private` is runtime-enforced.
- **TS class vs object literal are not the same type of thing.** `new Book(...)` is a real instance with a prototype and methods; `{ isbn, title }` is a structurally-typed bag. The literal won't have methods and won't pass `instanceof Book`. C# `new Book { ... }` is always a real `Book` (the constructor ran first).
- **C# primary-constructor params are NOT auto-properties.** Unlike TS parameter properties, `class Loan(string isbn)` captures `isbn` as a parameter; you must write `public string Isbn { get; } = isbn;` to expose it. Easy to assume otherwise coming from TS.
- **Detached methods lose `this` in TS, never in C#.** Passing `obj.method` as a callback drops `this` in JS/TS. Use an arrow class field or `.bind`. C# delegates carry their receiver.
- **`==` means different things.** C# `class`: identity. C# `record`/`struct`: value. TS objects: always identity (`===`). Don't expect `new Book() == new Book()` to be true in C# unless it's a `record`.
- **Static initialiser shared-reference trap.** A `static readonly List<>` (C#) or a module-level array (TS) assigned as a default makes *every* instance share one object. Mutating it mutates "everyone's." Initialise per-instance (`= new()` / `= []`) instead.
- **`with` / spread / struct copies are shallow.** Nested collections are still shared. Believing a copy is deep is a top source of "I didn't touch that!" bugs.
- **Integer division and `decimal` for money (C#).** Unrelated to OOP but it'll bite in `LateFee`: `7 / 2 == 3` in C#, and you must use `decimal` (`0.50m`) for currency. (See `.net/notes/01-csharp-fundamentals.md` §1.8.)
- **GC won't close your file.** Memory is collected automatically; OS resources are not. Implement `IDisposable` / `Symbol.dispose` and use `using` for anything holding a handle, socket, or connection.
- **Field initialisers run before the constructor body.** In both languages. If your constructor depends on an initialiser order, know that declarations run first, top to bottom, then the ctor body.

---

## Phase 2 Exercise

**Goal:** Model the Media Library core — `Book`, `Member`, and `Loan` — in **both** TS and C#, exercising fields, properties, constructors, a couple of behaviors, static members, and value vs reference semantics.

**Requirements**

1. **`Book`** — `isbn`, `title`, `copiesTotal`, `copiesAvailable`.
   - Behavior: `borrowCopy()` (decrements available, throws if none left), `returnCopy()` (increments, never exceeds total).
   - Expose `isAvailable` as a computed/derived value (no backing storage).
2. **`Member`** — `id`, `name`, validated `email` (lowercase, must contain `@`).
   - A `static` counter that auto-assigns the next `id` on construction.
3. **`Loan`** — links a `Book` and a `Member`, plus `dueDate` and nullable `returnedAt`.
   - Constructor sets `dueDate` using a **static** `LOAN_PERIOD_DAYS` default.
   - Behavior: `return()` (sets `returnedAt`, calls `book.returnCopy()`), `isOverdue(asOf)`, computed `isReturned`.
   - Creating a `Loan` should `borrowCopy()` from the book.
4. **Prove reference vs value semantics:** assign one `Loan` to a second variable, mutate via one, and show the other sees it (reference). In C#, additionally model `Money` (late fee) as a `record struct` and show two equal-valued instances compare equal with `==`.
5. Make `Loan` (or a `LoanLog`) implement deterministic cleanup (`IDisposable` / `Symbol.dispose`) that writes a "loan closed" line, and consume it with `using`.

**Stretch**

- Add a C# **object initialiser** construction path and a TS **object-literal DTO** (`CreateLoanRequest`) and note how they differ.
- Add a deliberate **aliasing bug** (a method that mutates a passed-in `Book`), then fix it with a non-mutating version (`with` in C#, spread in TS).
- Give `Member` a method passed as a callback (e.g., to `setTimeout` / a delegate) and show the TS `this`-loss vs C#'s safety.

**Where it goes**

- TS: `examples/phase2-classes/media-library.ts`
- C#: `examples/phase2-classes/MediaLibrary/` (a `dotnet new console`)

**What to write down afterward (the "aha" log)**

- One thing that's strictly nicer in C# here (e.g., `record` value equality, real overloading, runtime `private`).
- One thing that's strictly nicer in TS here (e.g., parameter properties, object literals, no `this` ceremony once you use arrow fields... wait — that one's a wash).
- The single bug the reference/value section made obvious that you'd written before without noticing.
