# Phase 3 — Encapsulation

**Status:** In Progress
**Started:** 2026-06-17

> The first pillar. Phase 1 named it; this phase makes you *do* it.
> The one-line idea: **an object should be impossible to put into an invalid state from the outside.** Everything below is in service of that sentence.

---

## 3.1 What Encapsulation Is and Why It Matters

Encapsulation is two ideas welded together:

1. **Hide internal state** — the data an object holds is its own business, not the caller's.
2. **Expose a controlled, intentional interface** — callers interact through methods/properties you chose, not by poking fields directly.

The *payoff* is the third idea, and it's the one that matters most:

3. **Protect invariants** — rules that must *always* be true for the object to make sense (`a Loan that is returned has a returnedAt date`; `a Loan can't be renewed after it's returned`). If callers can reach in and set fields, they can break these rules. If they can only go through methods you wrote, you enforce the rules on every change.

You already do a weak version of this in JS with the module pattern (closures hiding `count`, see `javascript/notes/01-js-internals.md` §1.3). Classes make it first-class.

### The anemic anti-example (what NOT to do)

```ts
// TypeScript — everything public. This is a struct with a class keyword.
class Loan {
  public bookId: string;
  public memberId: string;
  public borrowedAt: Date | null = null;
  public dueAt: Date | null = null;
  public returnedAt: Date | null = null;
}

const loan = new Loan();
loan.returnedAt = new Date();   // "returned"... but never borrowed. Invalid state, no complaint.
loan.borrowedAt = new Date();   // now returned-before-borrowed. Still no complaint.
```

```csharp
// C# — same disease.
public class Loan
{
    public string BookId { get; set; } = "";
    public string MemberId { get; set; } = "";
    public DateTime? BorrowedAt { get; set; }
    public DateTime? DueAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
}

var loan = new Loan();
loan.ReturnedAt = DateTime.UtcNow; // returned but never borrowed — the object lies about reality
```

Nothing here protects anything. The object can't defend itself. Encapsulation is the cure, and the rest of this phase builds it up piece by piece, hardening this exact `Loan`.

---

## 3.2 Access Modifiers

Access modifiers are the *mechanism* for "hide internal state". This is the single biggest TS-vs-C# divergence in the whole pillar, so read this section slowly.

### C# — the full set (all runtime-enforced)

C# has six access levels. All of them are enforced by the compiler **and** by the runtime — there is no way to reach a `private` field from outside the class without reflection.

| Modifier | Visible to |
|---|---|
| `public` | Everyone, any assembly |
| `private` | Only this class (the default for class members) |
| `protected` | This class + derived classes |
| `internal` | Any code in the **same assembly** (≈ same package/project) |
| `protected internal` | Same assembly **OR** derived classes (the union — broader) |
| `private protected` | Derived classes **that are also in the same assembly** (the intersection — narrower) |

```csharp
public class Account
{
    public string Owner { get; set; } = "";          // anyone
    private decimal _balance;                         // only Account
    protected int FailedAttempts;                     // Account + subclasses
    internal string AuditTag = "";                    // anything in this project
    protected internal bool IsFlagged;                // subclasses OR same project
    private protected int _internalRetryCount;        // subclasses IN this project only
}
```

The two compound ones trip people up — remember:
- `protected internal` = **OR** (wider: pick either door)
- `private protected` = **AND** (narrower: must satisfy both)

`internal` is the one with no TS keyword equivalent — it's "package-private". We come back to it in §3.5 for cross-module API design.

### TypeScript — `public`/`private`/`protected` are COMPILE-TIME ONLY

TS has `public` (default), `private`, and `protected`. They look like C#'s, but there is a crucial, dangerous difference:

> **TS's `private`/`protected` are erased at compile time. They are checked by `tsc` and then they are GONE. At runtime, the field is a plain, fully-accessible JavaScript property.**

```ts
class Account {
  private balance = 100;
}

const a = new Account();
// a.balance;            // ❌ tsc error: Property 'balance' is private
console.log((a as any).balance);    // ✅ 100 — the cast erases the check
console.log(a["balance"]);          // ✅ 100 — bracket access bypasses it too
console.log(JSON.stringify(a));     // ✅ {"balance":100} — it serializes! it's just a property
```

So TS `private` is a **convention enforced by the type-checker**, not a runtime guarantee. Anyone who casts to `any`, uses bracket notation, or looks at the object in a debugger / `JSON.stringify` / a logger sees everything. This matters for security (never put secrets in a TS `private` field and assume they're hidden) and for libraries (consumers using plain JS get zero protection).

### JavaScript `#private` — RUNTIME-enforced

ES2022 added true private fields with the `#` prefix. These are enforced by the **JavaScript engine itself** — not the type system — so they survive compilation and protect even plain-JS callers.

```ts
class Account {
  #balance = 100;                 // real private — part of the runtime

  getBalance() { return this.#balance; }
}

const a = new Account();
// a.#balance;                    // ❌ SyntaxError — can't even reference # from outside
// (a as any).#balance;          // ❌ still a SyntaxError
console.log(a["#balance"]);       // undefined — '#balance' is NOT a normal property key
console.log(JSON.stringify(a));   // {} — # fields do not serialize
console.log(a.getBalance());      // 100 — only the class's own code can touch it
```

`#balance` is genuinely inaccessible. Even `Object.keys`, `JSON.stringify`, the debugger's property list, and reflection won't surface it. This is the C#-level guarantee.

### The crucial difference, in one table

| | TS `private balance` | JS `#balance` | C# `private _balance` |
|---|---|---|---|
| Checked by | `tsc` (compile time) | JS engine (runtime) | compiler **and** CLR (runtime) |
| Survives to runtime? | No — erased | Yes | Yes |
| Reachable via cast / bracket? | Yes (`(x as any).balance`) | No (SyntaxError) | No (only reflection) |
| Appears in `JSON.stringify`? | Yes | No | n/a |
| Real privacy guarantee? | **No** | **Yes** | **Yes** |

**Practical rule for the learner:** in TypeScript, prefer `#private` for state you genuinely need to protect (real invariants, anything sensitive). Use `private` (the keyword) when you only want the design-time discipline and you're sure all callers are TS — it reads cleaner and supports `private set` patterns C#-style, but understand it's a polite fence, not a wall.

> Caveat worth knowing: `#private` and TS `private` don't mix freely — you can't have a getter/`private set` pair on a `#field` the same way, and TS `private` can't be accessed across instances as flexibly. We use `#` for the hardened `Loan` exercise where the guarantee matters.

---

## 3.3 Properties, Getters & Setters

Properties are the "controlled interface" half of encapsulation: a field looks like data from outside but runs *your code* on read/write.

### Computed / derived properties

A property with no backing field — computed from other state. This is encapsulation's friend: derived values can't drift out of sync because they're never stored.

```ts
class Loan {
  #borrowedAt: Date;
  #dueAt: Date;

  constructor(borrowedAt: Date, dueAt: Date) {
    this.#borrowedAt = borrowedAt;
    this.#dueAt = dueAt;
  }

  // derived — recomputed each access, can never be "wrong"
  get isOverdue(): boolean {
    return !this.#returnedAt && new Date() > this.#dueAt;
  }
  #returnedAt: Date | null = null;
}
```

```csharp
public class Loan
{
    private readonly DateTime _borrowedAt;
    private readonly DateTime _dueAt;
    private DateTime? _returnedAt;

    public Loan(DateTime borrowedAt, DateTime dueAt)
    {
        _borrowedAt = borrowedAt;
        _dueAt = dueAt;
    }

    // expression-bodied derived property — no setter, nothing to corrupt
    public bool IsOverdue => _returnedAt is null && DateTime.UtcNow > _dueAt;
}
```

### Validation in setters

If you *must* allow writes, the setter is where you enforce rules so a bad value never lands.

```ts
class Member {
  #email = "";

  get email() { return this.#email; }
  set email(value: string) {
    if (!value.includes("@")) {
      throw new Error(`Invalid email: ${value}`);
    }
    this.#email = value.toLowerCase().trim();   // normalize on the way in
  }
}

const m = new Member();
m.email = "  TAREQ@EXAMPLE.COM ";  // stored as "tareq@example.com"
// m.email = "nope";               // throws — invalid value never persists
```

```csharp
public class Member
{
    private string _email = "";

    public string Email
    {
        get => _email;
        set
        {
            if (!value.Contains('@'))
                throw new ArgumentException($"Invalid email: {value}");
            _email = value.ToLowerInvariant().Trim();
        }
    }
}
```

### Read-only from outside, writable inside

The most useful encapsulation move: callers can *read* a property but only the class can *change* it. Each language has a clean idiom.

```ts
// TypeScript — getter only, no setter ⇒ read-only to the world.
// The class mutates the #field directly.
class Loan {
  #returnedAt: Date | null = null;

  get returnedAt() { return this.#returnedAt; }   // read from outside ✅

  return() {
    this.#returnedAt = new Date();                // write only via a method ✅
  }
}
```

```csharp
// C# — private set: read anywhere, write only inside the class.
public class Loan
{
    public DateTime? ReturnedAt { get; private set; }

    public void Return() => ReturnedAt = DateTime.UtcNow;
}

// C# — init: settable ONLY during object construction/initializer, then frozen.
public class Loan2
{
    public string BookId { get; init; } = "";   // set once at creation, never again
}
var l = new Loan2 { BookId = "b-1" };            // ✅ allowed during init
// l.BookId = "b-2";                              // ❌ compile error — init-only
```

`private set` = "mutable, but only by me". `init` = "set at birth, then permanently read-only". TS has no direct `init` equivalent — the closest is a constructor parameter assigned to a `readonly`/`#` field (covered in §3.6).

### When a getter/setter pair is a code smell

A `get`/`set` pair that does nothing but read and write a field is **not encapsulation** — it's a public field wearing a costume. This is the *anemic* anti-pattern.

```ts
// SMELL — this is identical to `public status: string`, just noisier.
class Loan {
  #status = "active";
  get status() { return this.#status; }
  set status(v: string) { this.#status = v; }   // accepts ANY string, enforces NOTHING
}
loan.status = "banana";   // 🤦 invalid, accepted
```

The fix is almost never "add validation to the setter". It's **remove the setter** and expose *intent-revealing methods* instead:

```ts
// FIX — no setter at all. State changes only through meaningful operations.
class Loan {
  #status: "active" | "returned" = "active";
  get status() { return this.#status; }

  return() {
    if (this.#status === "returned") throw new Error("Already returned");
    this.#status = "returned";
  }
}
```

> Rule of thumb: if you find yourself writing a setter, ask "what *operation* is the caller actually doing?" `loan.return()` carries meaning and enforces rules; `loan.status = "returned"` carries neither. This is the bridge straight into §3.4.

---

## 3.4 Protecting Invariants

This is the *point* of the whole pillar. An **invariant** is a statement that must be true for the lifetime of the object. For our `Loan`:

- A loan always has a `bookId` and `memberId` (non-empty).
- `dueAt` is after `borrowedAt`.
- A returned loan has a `returnedAt`; an active one doesn't.
- You can't return a loan twice, or renew one that's already returned.

Three techniques enforce these.

### 1. Validate in the constructor — so the object is *born valid*

If the constructor rejects bad input, **there is no such thing as an invalid instance.** Every method afterward can trust the state.

```ts
class Loan {
  readonly #bookId: string;
  readonly #memberId: string;
  readonly #borrowedAt: Date;
  #dueAt: Date;

  constructor(bookId: string, memberId: string, borrowedAt: Date, dueAt: Date) {
    if (!bookId.trim()) throw new Error("bookId is required");
    if (!memberId.trim()) throw new Error("memberId is required");
    if (dueAt <= borrowedAt) throw new Error("dueAt must be after borrowedAt");

    this.#bookId = bookId;
    this.#memberId = memberId;
    this.#borrowedAt = borrowedAt;
    this.#dueAt = dueAt;
  }
}
// From this point on, no Loan can exist with an empty bookId or a backwards due date.
```

```csharp
public class Loan
{
    private readonly string _bookId;
    private readonly string _memberId;
    private readonly DateTime _borrowedAt;
    private DateTime _dueAt;

    public Loan(string bookId, string memberId, DateTime borrowedAt, DateTime dueAt)
    {
        if (string.IsNullOrWhiteSpace(bookId))
            throw new ArgumentException("bookId is required", nameof(bookId));
        if (string.IsNullOrWhiteSpace(memberId))
            throw new ArgumentException("memberId is required", nameof(memberId));
        if (dueAt <= borrowedAt)
            throw new ArgumentException("dueAt must be after borrowedAt", nameof(dueAt));

        _bookId = bookId;
        _memberId = memberId;
        _borrowedAt = borrowedAt;
        _dueAt = dueAt;
    }
}
```

### 2. Mutation behind methods that enforce rules

This is `loan.return()` **not** `loan.returnedAt = ...`. The field is private; the *only* path to changing it is a method that checks the rules first. Compare the two worlds:

```ts
// ❌ field assignment: caller is responsible for the rules (and will forget)
loan.returnedAt = new Date();

// ✅ method: the object is responsible for the rules (and never forgets)
loan.return();   // checks "not already returned" internally, then sets the date
```

The behavior *and* the state change live together, so the rule can't be skipped.

### 3. Fail loudly on invalid transitions

A `Loan` is a little **state machine**: `active → returned`, `active → active (renewed)`. Illegal transitions must throw, not silently no-op, so bugs surface immediately rather than corrupting data downstream.

```ts
return() {
  if (this.#returnedAt) {
    throw new Error("Cannot return a loan that is already returned");
  }
  this.#returnedAt = new Date();
}
```

```csharp
public void Return()
{
    if (_returnedAt is not null)
        throw new InvalidOperationException("Cannot return an already-returned loan");
    _returnedAt = DateTime.UtcNow;
}
```

> `InvalidOperationException` is C#'s idiomatic "you called this at the wrong time / in the wrong state" exception — exactly right for bad transitions. (`ArgumentException` is for bad *inputs*; use it in constructors/parameters.)

These three together give you the guarantee from §3.1: **the object cannot be invalid.** The full hardened version is the Phase 3 exercise.

---

## 3.5 Information Hiding & API Design

Encapsulation isn't only per-object — it scales up to whole modules. The principle is the same at every level: **expose the smallest surface that does the job, and treat it as a contract.**

### Public surface area is a contract

Every `public` member is a promise you have to keep. Once a caller depends on it, changing it is a breaking change. So the default for *anything* should be the most private level that works, and you widen access only deliberately.

- C# member default is `private`. Lean on that; only add `public`/`internal` when needed.
- In TS, only `export`ed things leave the module — non-exported declarations are module-private (a real, runtime boundary, unlike the `private` keyword).

### Encapsulation across modules

This is where the **TS `export` vs C# `internal`** distinction earns its keep.

```ts
// loan.ts — module-level information hiding
function calculateFee(daysLate: number): number {   // NOT exported → invisible outside this file
  return daysLate * 0.5;
}

export class Loan {                                  // exported → part of the public contract
  // ...uses calculateFee internally
}
// Importers can use Loan; they can never import or even see calculateFee.
```

```csharp
// In C#, the equivalent of "visible inside my module but not to consumers"
// is `internal` — visible within the assembly (project), hidden from referencing assemblies.

internal class FeeCalculator              // usable inside this project, invisible to consumers
{
    public decimal Calculate(int daysLate) => daysLate * 0.5m;
}

public class Loan                         // the public contract the outside world sees
{
    private readonly FeeCalculator _fees = new();
}
```

The mapping to remember:

| Boundary | TypeScript | C# |
|---|---|---|
| Hidden inside one *class* | `#field` (runtime) / `private` (compile-time) | `private` |
| Hidden inside one *file/module* | not `export`ed | `file` modifier (C# 11, rare) |
| Hidden inside one *project/package* | not exported from the package's entry (`index.ts`) | `internal` |
| Public contract | `export` | `public` |

`internal` is the level TS developers underuse because the keyword doesn't exist — TS approximates it with "what the package's `index.ts` re-exports". In C# it's a precise, compiler-enforced boundary, and it's the right tool for "this helper is shared across my project but is not part of my published API".

> Cross-reference: this same "depend on a small public contract" instinct becomes **programming to an interface** (Phase 6) and powers DI in NestJS and ASP.NET — see `.net/notes/04-clean-architecture.md` and the NestJS DI notes.

---

## 3.6 Immutability

Immutability is encapsulation's force-multiplier: **if state can't change after construction, there are no setters to guard, no invalid transitions to police, and no aliasing bugs (`.net/notes/01-csharp-fundamentals.md` §1.2 reference vs value).** An immutable object validated once in its constructor is *guaranteed* valid forever.

### C# — `readonly`, `init`, records, and `with`

```csharp
public class Loan
{
    private readonly string _bookId;   // readonly field — assignable only in ctor, then frozen
    public string BookId => _bookId;
}
```

```csharp
// init-only properties — public to set during creation, read-only thereafter
public class LoanSnapshot
{
    public string BookId { get; init; } = "";
    public DateTime BorrowedAt { get; init; }
}
var s = new LoanSnapshot { BookId = "b-1", BorrowedAt = DateTime.UtcNow };
// s.BookId = "b-2";   // ❌ init-only — compile error
```

```csharp
// records — immutable-by-default value objects with structural equality + `with`
public record LoanRecord(string BookId, string MemberId, DateTime DueAt);

var loan = new LoanRecord("b-1", "m-1", DateTime.UtcNow.AddDays(14));
var renewed = loan with { DueAt = loan.DueAt.AddDays(7) };  // NEW record; `loan` untouched

Console.WriteLine(loan == new LoanRecord("b-1", "m-1", loan.DueAt)); // value equality
```

`with` is "non-destructive mutation" — you never change the original, you produce a modified copy. This is the same idea as React state updates (`{ ...prev, dueAt }`) but compiler-supported and value-equal. See `.net/notes/01-csharp-fundamentals.md` §1.4 for more on records.

### TypeScript — `readonly`, `as const`, `Object.freeze` (and their limits)

TS gives you three tools, each weaker than C#'s in a specific way — know the limits.

```ts
// 1. readonly modifier — COMPILE-TIME only (same erasure caveat as `private` from §3.2)
class Loan {
  constructor(readonly bookId: string) {}   // can't reassign... per tsc
}
const l = new Loan("b-1");
// l.bookId = "b-2";          // ❌ tsc error
(l as any).bookId = "b-2";    // ✅ runtime: it mutated. readonly is erased.
```

```ts
// 2. as const — deep readonly + literal types, but only for literals at definition
const policy = { maxRenewals: 3, loanDays: 14 } as const;
// type is { readonly maxRenewals: 3; readonly loanDays: 14 }
// policy.maxRenewals = 5;    // ❌ tsc error — but again, compile-time only
```

```ts
// 3. Object.freeze — the ONLY runtime-enforced option, but SHALLOW
const loan = Object.freeze({ bookId: "b-1", tags: ["new"] });
loan.bookId = "b-2";          // silently ignored (throws in strict mode) — top level frozen ✅
loan.tags.push("popular");    // ✅ MUTATES — freeze is shallow, the nested array is not frozen ⚠️
```

The takeaways:
- `readonly` and `as const` are **compile-time** — real discipline, zero runtime protection (just like TS `private`).
- `Object.freeze` is **runtime** but **shallow** — nested objects/arrays stay mutable. Deep immutability needs recursive freezing or a library.
- There is **no built-in TS equivalent to C# records' `with`**. You spread manually: `const renewed = { ...loan, dueAt }` — and that's shallow too.

### Why immutability eases encapsulation

| Problem encapsulation fights | How immutability removes it |
|---|---|
| Setters can corrupt state | There are no setters |
| Invalid state transitions | No transitions — you make a new object instead |
| Aliasing bugs (shared reference mutated) | Shared references are safe; nobody can change them |
| Re-validating after every mutation | Validate once in the constructor; valid forever |
| Thread-safety (C#) | Immutable objects are inherently thread-safe |

The catch: not everything *should* be immutable. A `Loan` genuinely changes over its life (it gets returned, renewed). The right design is **immutable where you can, controlled mutation where you must** — which is exactly the hardened `Loan` below: identity fields immutable, lifecycle state changed only through guarded methods.

---

## Gotchas

- **TS `private`/`protected`/`readonly` are erased at runtime.** `(obj as any).x`, `obj["x"]`, the debugger, `JSON.stringify`, and any plain-JS caller all see "private" fields. Only `#field` is real privacy. Never assume TS `private` hides a secret.
- **`#field` is not a property.** `obj["#x"]` is `undefined` (it's looking for a literal `"#x"` key), `JSON.stringify` skips it, `Object.keys` won't list it. That's the feature, but it surprises people serializing class instances.
- **`Object.freeze` is shallow.** A frozen object with a nested array/object is still mutable one level down. `freeze` the nested pieces too, or use `as const` (compile-time) plus discipline.
- **`readonly` field vs `const`:** `const` is a compile-time constant known at build (C#); `readonly` is set once at runtime in the constructor. They are not interchangeable (`.net/notes/01-csharp-fundamentals.md` §1.2).
- **`init` ≠ immutable contents.** `public List<int> Items { get; init; }` stops *reassigning* the list, but the list itself is still `.Add`-able. Init-only protects the reference, not what it points to — same shallow trap as `Object.freeze`.
- **`protected internal` is OR; `private protected` is AND.** The names read backwards from their meaning. OR = wider, AND = narrower.
- **A getter/setter pair with no logic is a public field in disguise** — it's the anemic smell (§3.3), and the Phase 9 "anemic domain model" anti-pattern in miniature. Prefer intent-revealing methods.
- **C# `record` gives value equality; `class` gives reference equality.** Two `record`s with equal contents are `==`; two `class` instances with equal contents are not (`.net/notes/01-csharp-fundamentals.md` §1.8). Don't put a mutable `class` where you assumed value semantics.
- **Throwing the wrong exception type in C#:** bad *input* → `ArgumentException`; bad *state/timing* → `InvalidOperationException`. Using `Exception` for everything loses that signal for callers.
- **Validating in a setter still leaves the object briefly invalid during construction** if you set fields one by one. Prefer constructor validation so the object is never observable in a half-built state.

---

## Phase 3 Exercise

**Goal:** Harden the Media Library `Loan` so it can **never** be in an invalid state. Requirements:

- No public setters. Identity fields (`bookId`, `memberId`, `borrowedAt`) are immutable.
- The object is born valid (constructor validates; throws on bad input).
- All state changes go through intent-revealing methods: `borrow` (here, the constructor *is* the borrow), `return`, and `renew` — each enforces its rules and throws on invalid transitions.
- Rules to enforce: `dueAt` after `borrowedAt`; can't return an already-returned loan; can't renew a returned loan; cap renewals (say, 2); renewing extends `dueAt`.
- Implement in **both** TypeScript (use `#private` for real enforcement) and C#.

### TypeScript

```ts
type LoanStatus = "active" | "returned";

class Loan {
  // Identity — set once, runtime-private, never mutated.
  readonly #bookId: string;
  readonly #memberId: string;
  readonly #borrowedAt: Date;

  // Lifecycle state — private, changed only by methods below.
  #dueAt: Date;
  #returnedAt: Date | null = null;
  #renewals = 0;

  static readonly #MAX_RENEWALS = 2;

  constructor(bookId: string, memberId: string, borrowedAt: Date, dueAt: Date) {
    if (!bookId.trim()) throw new Error("bookId is required");
    if (!memberId.trim()) throw new Error("memberId is required");
    if (dueAt <= borrowedAt) throw new Error("dueAt must be after borrowedAt");

    this.#bookId = bookId;
    this.#memberId = memberId;
    this.#borrowedAt = borrowedAt;
    this.#dueAt = dueAt;
  }

  // --- Read-only window into state (getters, no setters) ---
  get bookId() { return this.#bookId; }
  get memberId() { return this.#memberId; }
  get dueAt() { return this.#dueAt; }
  get returnedAt() { return this.#returnedAt; }
  get renewals() { return this.#renewals; }
  get status(): LoanStatus { return this.#returnedAt ? "returned" : "active"; }
  get isOverdue(): boolean {
    return this.status === "active" && new Date() > this.#dueAt;
  }

  // --- Transitions (the only way to change state) ---
  return(at: Date = new Date()): void {
    if (this.status === "returned") {
      throw new Error("Cannot return a loan that is already returned");
    }
    this.#returnedAt = at;
  }

  renew(extraDays = 14): void {
    if (this.status === "returned") {
      throw new Error("Cannot renew a returned loan");
    }
    if (this.#renewals >= Loan.#MAX_RENEWALS) {
      throw new Error(`Renewal limit reached (${Loan.#MAX_RENEWALS})`);
    }
    this.#renewals++;
    this.#dueAt = new Date(this.#dueAt.getTime() + extraDays * 86_400_000);
  }
}

// --- Proof it defends itself ---
const loan = new Loan("b-1", "m-1", new Date("2026-06-01"), new Date("2026-06-15"));
loan.renew();                 // ok → renewals = 1, dueAt +14d
loan.renew();                 // ok → renewals = 2
// loan.renew();              // throws: Renewal limit reached (2)
loan.return();                // ok → status "returned"
// loan.return();             // throws: already returned
// loan.renew();              // throws: cannot renew a returned loan
// (loan as any).#returnedAt; // ❌ SyntaxError — can't even reach the field
console.log(JSON.stringify(loan)); // {} — no private state leaks
```

### C#

```csharp
public enum LoanStatus { Active, Returned }

public sealed class Loan
{
    private const int MaxRenewals = 2;

    // Identity — readonly, set once in the constructor, never reassigned.
    private readonly string _bookId;
    private readonly string _memberId;
    private readonly DateTime _borrowedAt;

    // Lifecycle state — private fields, mutated only by the methods below.
    private DateTime _dueAt;
    private DateTime? _returnedAt;
    private int _renewals;

    public Loan(string bookId, string memberId, DateTime borrowedAt, DateTime dueAt)
    {
        if (string.IsNullOrWhiteSpace(bookId))
            throw new ArgumentException("bookId is required", nameof(bookId));
        if (string.IsNullOrWhiteSpace(memberId))
            throw new ArgumentException("memberId is required", nameof(memberId));
        if (dueAt <= borrowedAt)
            throw new ArgumentException("dueAt must be after borrowedAt", nameof(dueAt));

        _bookId = bookId;
        _memberId = memberId;
        _borrowedAt = borrowedAt;
        _dueAt = dueAt;
    }

    // --- Read-only window into state (get-only / private set) ---
    public string BookId => _bookId;
    public string MemberId => _memberId;
    public DateTime DueAt => _dueAt;
    public DateTime? ReturnedAt => _returnedAt;
    public int Renewals => _renewals;
    public LoanStatus Status => _returnedAt is null ? LoanStatus.Active : LoanStatus.Returned;
    public bool IsOverdue => Status == LoanStatus.Active && DateTime.UtcNow > _dueAt;

    // --- Transitions (the only way to change state) ---
    public void Return(DateTime? at = null)
    {
        if (Status == LoanStatus.Returned)
            throw new InvalidOperationException("Cannot return an already-returned loan");
        _returnedAt = at ?? DateTime.UtcNow;
    }

    public void Renew(int extraDays = 14)
    {
        if (Status == LoanStatus.Returned)
            throw new InvalidOperationException("Cannot renew a returned loan");
        if (_renewals >= MaxRenewals)
            throw new InvalidOperationException($"Renewal limit reached ({MaxRenewals})");
        _renewals++;
        _dueAt = _dueAt.AddDays(extraDays);
    }
}

// --- Proof it defends itself ---
var loan = new Loan("b-1", "m-1",
    new DateTime(2026, 6, 1), new DateTime(2026, 6, 15));
loan.Renew();                  // renewals = 1
loan.Renew();                  // renewals = 2
// loan.Renew();               // throws InvalidOperationException: Renewal limit reached (2)
loan.Return();                 // Status = Returned
// loan.Return();              // throws: already returned
// loan.Renew();               // throws: cannot renew a returned loan
// loan._returnedAt = null;    // ❌ compile error — private, runtime-enforced
```

**Reflection prompts (write the answers in this file as you go):**
1. Which fields did you make immutable and why? Which *had* to stay mutable?
2. List every invalid state the old anemic `Loan` (§3.1) allowed, and name the technique (§3.4) that now prevents each.
3. In the TS version, what specifically would break if you used `private` instead of `#`? Try `(loan as any)` on both and observe.
4. Could you model `Loan` as an immutable C# `record` where `return`/`renew` produce a *new* loan via `with` instead of mutating? What do you gain (immutability) and lose (identity, in-place lifecycle)? This is the §3.6 trade-off made concrete — and a preview of the OOP-vs-functional blend in Phase 9.

**Location:** `examples/phase3-encapsulation/`
