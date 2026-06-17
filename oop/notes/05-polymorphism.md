# Phase 5 — Polymorphism

**Status:** Not started
**Prereqs:** Phase 4 (Inheritance) — `LibraryItem` → `Book` / `Audiobook` / `DVD`

> The previous phases built the machinery: classes hold state (Phase 2), encapsulation
> protects it (Phase 3), inheritance shares it (Phase 4). This phase is the payoff.
> Polymorphism is the pillar that turns a class hierarchy into *leverage* — it lets you
> write code against a general type and have the right specific behavior happen at runtime,
> with **zero** `if`/`switch` on the concrete type.

---

## 5.1 What Polymorphism Is — "Many Forms"

"Polymorphism" is Greek: *poly* (many) + *morph* (form). One name, one interface — **many
concrete behaviors**, with the actual behavior chosen at runtime based on what the object
really is.

You already use this every day without naming it:

```ts
// You call .toString() on anything. The SAME method name, DIFFERENT behavior,
// chosen by what the object actually is.
[1, 2, 3].toString();        // "1,2,3"
({ a: 1 }).toString();       // "[object Object]"
new Date(0).toString();      // "Thu Jan 01 1970 ..."
```

```csharp
// C# — identical idea. One method name, behavior decided by the runtime type.
new List<int> { 1, 2, 3 }.ToString();  // "System.Collections.Generic.List`1[System.Int32]"
"hello".ToString();                     // "hello"
DateTime.UnixEpoch.ToString();          // "1/1/1970 12:00:00 AM"
```

### Why polymorphism — not inheritance — is what makes OOP powerful

This is the key insight of the whole module. People say "OOP = inheritance," but inheritance
on its own is just **code reuse with a tree shape**. The power comes from what polymorphism
lets you do *with* that tree: write a single piece of code that operates on the base type and
automatically does the right thing for every present and future subtype.

```
WITHOUT polymorphism — caller must know every type (and re-edit when you add one):

    function totalFees(items):
        sum = 0
        for item in items:
            if item is Book:      sum += bookFee(item)       ┐
            elif item is DVD:     sum += dvdFee(item)         │ a giant switch that grows
            elif item is Audio:   sum += audioFee(item)       │ every time a type is added
            ...                                               ┘
        return sum

WITH polymorphism — caller knows ONLY the base type:

    function totalFees(items: LibraryItem[]):
        sum = 0
        for item in items:
            sum += item.lateFee()   ← each object supplies its own behavior
        return sum                    new types just work; this code never changes
```

The bottom version is **open for extension, closed for modification** — that's the Open/Closed
Principle (Phase 7), and polymorphism is the mechanism that delivers it. The whole point of the
Phase 5 exercise is to feel this: replace a type-checking `switch` with a polymorphic call.

### The three kinds (we'll cover all of them)

| Kind | Also called | Mechanism | Bound when |
|------|-------------|-----------|-----------|
| **Subtype** | inclusion, runtime | override a base method, call via base reference | runtime (§5.2) |
| **Ad-hoc** | overloading | same name, different parameter types | compile time (§5.3) |
| **Parametric** | generics | one definition, many type arguments | compile time (§5.4) |

Subtype polymorphism is "the main event" — when an OOP person says "polymorphism" unqualified,
they mean this one.

---

## 5.2 Subtype Polymorphism (the main event)

The setup: a **base-type reference** (variable typed as the base) holding an object that is
actually a **subtype**. When you call an overridden method through that reference, the runtime
runs the **subtype's** version — not the base's. The variable's *declared* type does not decide
which method runs; the object's *actual* type does.

### The classic example — shapes

```ts
// TypeScript: every method is virtual by default. Redeclare to override.
abstract class Shape {
  abstract area(): number;             // each subtype must supply its own
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area(): number { return Math.PI * this.radius ** 2; }
}

class Rectangle extends Shape {
  constructor(private w: number, private h: number) { super(); }
  area(): number { return this.w * this.h; }
}

// The variable is typed as the BASE (Shape), but each element is a different subtype.
const shapes: Shape[] = [new Circle(2), new Rectangle(3, 4)];

// The classic one-liner. `s` is typed Shape; the RIGHT area() runs for each object.
shapes.forEach(s => console.log(s.area()));   // 12.566..., 12
```

```csharp
// C#: virtuality is OPT-IN. The base must mark the method `virtual` (or `abstract`),
// and the subtype must say `override`. This is the single biggest divergence from TS.
public abstract class Shape
{
    public abstract double Area();          // abstract ⇒ implicitly virtual, no body
}

public class Circle : Shape
{
    private readonly double _radius;
    public Circle(double radius) => _radius = radius;
    public override double Area() => Math.PI * _radius * _radius;   // `override` required
}

public class Rectangle : Shape
{
    private readonly double _w, _h;
    public Rectangle(double w, double h) { _w = w; _h = h; }
    public override double Area() => _w * _h;
}

// Variable typed as the base; runtime picks the actual type's Area().
List<Shape> shapes = new() { new Circle(2), new Rectangle(3, 4) };

foreach (var s in shapes)               // `s` is Shape; correct Area() runs per object
    Console.WriteLine(s.Area());        // 12.566..., 12
```

### What "the actual object, not the variable type" means

```csharp
Shape s = new Circle(2);   // declared type: Shape   |   actual type: Circle
double a = s.Area();       // runs Circle.Area() — the ACTUAL type wins. a ≈ 12.566
```

```ts
const s: Shape = new Circle(2);  // declared: Shape | actual: Circle
s.area();                        // runs Circle.area() — actual type wins
```

The compiler only lets you call members it can see on the **declared** type (`Shape.area()` is
visible, but `s.radius` is not — that's a `Circle` detail). At **runtime**, the dispatch follows
the **actual** type. Declared type = "what you're allowed to call"; actual type = "whose code runs."

### The Media Library version — polymorphic late fees

This is the running domain and the whole reason this phase matters. `LibraryItem` declares a
`lateFee(daysOverdue)` and each subtype computes it differently.

```ts
// TypeScript
abstract class LibraryItem {
  constructor(public readonly title: string) {}

  // The polymorphic hook. Subtypes override this; callers never branch on type.
  abstract lateFee(daysOverdue: number): number;
}

class Book extends LibraryItem {
  lateFee(days: number): number {
    return days * 0.25;                  // 25¢/day, no cap
  }
}

class DVD extends LibraryItem {
  lateFee(days: number): number {
    return Math.min(days * 1.0, 20);     // $1/day, capped at $20 (replacement-ish)
  }
}

// Caller sees only LibraryItem. Adds NEW item types without touching this loop.
function totalLateFees(items: LibraryItem[], days: number): number {
  return items.reduce((sum, item) => sum + item.lateFee(days), 0);
}
```

```csharp
// C#
public abstract class LibraryItem
{
    public string Title { get; }
    protected LibraryItem(string title) => Title = title;

    public abstract decimal LateFee(int daysOverdue);   // decimal for money — never double
}

public class Book : LibraryItem
{
    public Book(string title) : base(title) { }
    public override decimal LateFee(int days) => days * 0.25m;
}

public class Dvd : LibraryItem
{
    public Dvd(string title) : base(title) { }
    public override decimal LateFee(int days) => Math.Min(days * 1.0m, 20m);
}

public static decimal TotalLateFees(IEnumerable<LibraryItem> items, int days)
    => items.Sum(item => item.LateFee(days));   // polymorphic call inside LINQ
```

---

## 5.3 Ad-hoc Polymorphism — Overloading

"Ad-hoc" = same operation *name* providing different implementations chosen by the **argument
types**, decided at **compile time**. This is a different axis from subtype polymorphism: subtype
dispatch happens at runtime on `this`; overload resolution happens at compile time on the arguments.

### C# method overloading — real, compile-time resolved

C# lets you declare several methods with the **same name** but **different signatures**. The
compiler picks one based on the static (compile-time) types of the arguments.

```csharp
public class Renderer
{
    public string Render(int n)    => $"int: {n}";
    public string Render(double d) => $"double: {d}";
    public string Render(string s) => $"string: {s}";

    // Overloads can differ by arity too
    public string Render(int a, int b) => $"two ints: {a}, {b}";
}

var r = new Renderer();
r.Render(42);        // "int: 42"      — picked at COMPILE time
r.Render(3.14);      // "double: 3.14"
r.Render("hi");      // "string: hi"
r.Render(1, 2);      // "two ints: 1, 2"
```

Because resolution is by *static* type, this surprises people:

```csharp
object x = 42;       // static type is `object`, runtime type is int
r.Render(x);         // COMPILE ERROR? No — but it would call Render(object) IF it existed.
                     // With only the overloads above, this won't compile: no Render(object).
                     // The runtime type (int) is NOT used to pick the overload.
```

That last point is the crux: **overloading is NOT polymorphism over the runtime type.** Use
`virtual`/`override` (subtype dispatch) when you need runtime behavior selection.

### TypeScript — overload signatures + union dispatch

JS has no real overloading (a second function with the same name just **replaces** the first).
TS fakes it with **overload signatures**: multiple declared signatures sitting on top of a single
**implementation signature**, and you branch by hand inside that one body.

```ts
class Renderer {
  // ── Overload signatures (visible to callers; no bodies) ──
  render(n: number): string;
  render(s: string): string;
  render(a: number, b: number): string;

  // ── Single implementation signature (NOT visible to callers) ──
  // It must be broad enough to cover all the overloads, then you discriminate.
  render(a: number | string, b?: number): string {
    if (typeof a === "number" && typeof b === "number") return `two numbers: ${a}, ${b}`;
    if (typeof a === "number") return `number: ${a}`;
    return `string: ${a}`;
  }
}

const r = new Renderer();
r.render(42);       // "number: 42"   — TS picks the matching overload signature
r.render("hi");     // "string: hi"
r.render(1, 2);     // "two numbers: 1, 2"
// r.render(true);  // compile error — no overload accepts boolean
```

The modern idiomatic alternative is often a **union parameter** with a discriminator, which is
cleaner than overloads when the shapes are related:

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; w: number; h: number };

// One signature, narrowed by the `kind` tag. TS exhaustiveness-checks the switch.
function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2;
    case "rect":   return s.w * s.h;
  }
}
```

> Divergence: C# overloads are **separate methods**, each fully type-checked independently. TS
> overloads are **one method** whose body you must write defensively — the overload signatures are
> a compile-time facade, erased at runtime (there are no real multiple methods underneath).

### Operator overloading — C# has it, JS/TS does not

C# lets a type define what `+`, `==`, `<`, etc. mean for it. This is ad-hoc polymorphism applied
to operators.

```csharp
public readonly struct Money
{
    public decimal Amount { get; }
    public Money(decimal amount) => Amount = amount;

    // Define what `+` means for Money
    public static Money operator +(Money a, Money b) => new(a.Amount + b.Amount);

    // Operators come in required pairs: == needs !=, < needs >, etc.
    public static bool operator ==(Money a, Money b) => a.Amount == b.Amount;
    public static bool operator !=(Money a, Money b) => a.Amount != b.Amount;

    public override bool Equals(object? o) => o is Money m && m == this;
    public override int GetHashCode() => Amount.GetHashCode();
}

var total = new Money(10) + new Money(5);   // Money(15) — operator+ ran
bool same  = new Money(10) == new Money(10); // true — operator== ran
```

**JS/TS has no operator overloading at all.** `+` on objects falls back to coercion via
`valueOf` / `Symbol.toPrimitive` / `toString`, which is a blunt instrument, not real overloading:

```ts
class Money {
  constructor(public amount: number) {}
  // The closest hook — coercion, not operator overloading. There is no `operator+`.
  [Symbol.toPrimitive](hint: string): number | string {
    return hint === "string" ? `$${this.amount}` : this.amount;
  }
}

const a = new Money(10);
const b = new Money(5);
console.log(a + b);     // 15 — but this is COERCION to number, not Money + Money.
                        // The result is a plain number, not a Money. You lose the type.
```

So in TS you write a named method instead: `a.plus(b)` returning a `Money`. Explicit, type-safe,
no surprises.

---

## 5.4 Parametric Polymorphism — Generics

Subtype polymorphism is "one piece of code, many subtypes." **Parametric** polymorphism is "one
piece of code, many *types*, with full type safety." The code is parameterized by a type variable
`T` and works uniformly for every `T`. That's why generics are called **polymorphism over types**.

### Generic classes

```ts
// TypeScript — a type-safe box that works for any element type.
class Box<T> {
  private items: T[] = [];
  add(item: T): void { this.items.push(item); }
  first(): T | undefined { return this.items[0]; }
}

const books = new Box<Book>();    // T = Book
books.add(new Book("Dune"));
const b = books.first();          // typed Book | undefined — no casting needed
```

```csharp
// C# — same shape. One definition, many concrete instantiations.
public class Box<T>
{
    private readonly List<T> _items = new();
    public void Add(T item) => _items.Add(item);
    public T? First() => _items.Count > 0 ? _items[0] : default;
}

var books = new Box<Book>();      // T = Book
books.Add(new Book("Dune"));
Book? b = books.First();          // typed Book? — no casting needed
```

### Generic methods

```ts
// TS — a free function (or method) parameterized by T
function firstOrNull<T>(items: T[]): T | null {
  return items.length > 0 ? items[0] : null;
}
const x = firstOrNull([1, 2, 3]);   // T inferred as number → number | null
```

```csharp
// C# — note the <T> after the method name
public static T? FirstOrNull<T>(IReadOnlyList<T> items) where T : class
    => items.Count > 0 ? items[0] : null;

var x = FirstOrNull(new[] { "a", "b" });  // T inferred as string → string?
```

### Constraints — limiting what `T` can be

A bare `T` can do almost nothing (you can't call `.area()` on an unknown type). **Constraints**
say "T must be at least this," which unlocks members on `T`.

```ts
// TS: `T extends X` means T is assignable to X — you can use X's members on T.
interface HasArea { area(): number; }

function largest<T extends HasArea>(items: T[]): T {
  return items.reduce((max, it) => (it.area() > max.area() ? it : max));
  //                                  ^^^^^^^ allowed because T extends HasArea
}
```

```csharp
// C#: `where T : ...`. Multiple, comma-separated. Some C#-only flavors have no TS analog.
public interface IHasArea { double Area(); }

public static T Largest<T>(IReadOnlyList<T> items) where T : IHasArea
{
    var max = items[0];
    foreach (var it in items)
        if (it.Area() > max.Area()) max = it;   // Area() available thanks to the constraint
    return max;
}
```

C# constraint kinds (the common ones):

```csharp
where T : class            // T must be a reference type
where T : struct           // T must be a value type
where T : new()            // T must have a public parameterless constructor  ← no TS equivalent
where T : IHasArea         // T must implement/inherit this
where T : Base             // T must derive from Base
where T : notnull          // T cannot be a nullable type
// Combined:
public T Make<T>() where T : LibraryItem, new() => new T();  // construct a T! TS can't do this
```

> Divergence: TS constraints are purely about **shape** (`extends`), erased at runtime. C#
> constraints include capabilities TS lacks — `new()` (construct a `T`), `struct`/`class`
> (value vs reference), and constraints survive to runtime because C# generics are **reified**
> (a `List<int>` truly knows it holds `int` at runtime; a TS `T[]` is just `Array` after erasure).

---

## 5.5 Dynamic Dispatch Under the Hood

When you call `item.lateFee(days)` through a base reference, *something* has to figure out which
concrete method to run. That lookup is **dynamic dispatch**. The two runtimes do it very
differently — and this connects straight back to Phase 4's method-resolution notes and the
prototype-chain section of `javascript/notes/01-js-internals.md` §1.4.

### C# — virtual method tables (vtables)

Each class with virtual methods has a **vtable**: an array of function pointers, one slot per
virtual method. Every object header points to its class's vtable. A virtual call is:

```
1. Read the object's type pointer (in its header)
2. Index into that type's vtable at the method's fixed slot
3. Jump to the function pointer there

    Circle instance ──► [type ptr] ──► Circle vtable
                                        ┌────────────────────────┐
                          slot 0 ──────►│ &Circle.Area           │
                          slot 1 ──────►│ &Object.ToString       │
                                        └────────────────────────┘
    Rectangle instance ─► [type ptr] ─► Rectangle vtable
                                        ┌────────────────────────┐
                          slot 0 ──────►│ &Rectangle.Area        │  ← same slot, diff target
                                        └────────────────────────┘
```

The slot index is fixed at compile time; only the table differs per type. That's two pointer
dereferences and an indexed load — a handful of cycles. **Non-virtual** methods skip all this:
the target is known at compile time and the call is direct (and inlinable).

### JS — prototype chain lookup

JS has no vtables. A method call `obj.lateFee()` is a **property lookup** that walks the
prototype chain until it finds `lateFee`:

```
obj ──► Book.prototype ──► LibraryItem.prototype ──► Object.prototype ──► null
         (has lateFee? ──► yes, stop and call it)

If Book didn't define it, the search continues up to LibraryItem.prototype, etc.
```

Naively this is slower (a chain walk + string-keyed lookup). V8 makes it fast with **inline
caches** (see `javascript/notes/01-js-internals.md` §1.1): the first lookup records "for this
object shape, `lateFee` lives at *here*," and subsequent calls hit the cache. Monomorphic call
sites (always the same shape) approach vtable speed; megamorphic ones (5+ shapes) fall back to
the slow generic path.

### The cost is usually negligible

```
Direct (non-virtual) call ........ ~1 unit   (often inlined to ~0)
Virtual call (vtable) ............ ~1–3 units (a couple of indirect loads)
Monomorphic JS call (IC hit) ..... close to virtual
Megamorphic JS call .............. noticeably slower, but still nanoseconds
```

For ordinary application code (web requests, business logic, the Media Library), dispatch cost is
**lost in the noise** next to I/O, allocation, and the actual work. Do not contort a design to
avoid virtual calls. The places it matters — tight numeric loops over millions of elements — are
exactly the places you'd reach for a non-polymorphic, data-oriented design anyway. Clarity first;
optimize dispatch only with a profiler in hand.

---

## 5.6 Substitutability — LSP Preview

Polymorphism only *works* if a subtype is genuinely usable wherever the base type is expected.
That requirement has a name: the **Liskov Substitution Principle** (the "L" in SOLID, Phase 7).

> **LSP, informally:** If `S` is a subtype of `B`, then objects of type `B` may be replaced with
> objects of type `S` **without breaking the program's correctness.** A subtype must honor the
> base type's *contract* — not just its method signatures, but its behavioral promises.

Subtyping the compiler accepts (signatures line up) is **necessary but not sufficient**. The
compiler checks shapes; LSP is about *behavior*, which the compiler can't verify.

### An example where overriding breaks the contract

The base contract: a `LibraryItem.lateFee(days)` returns a **non-negative** fee that is
**non-decreasing** in `days` (more overdue ⇒ never cheaper). Calling code relies on these
promises — e.g. `totalLateFees` assumes it can sum the results and never go negative.

```ts
// A subtype that VIOLATES the contract — it compiles fine, but it lies.
class CursedItem extends LibraryItem {
  lateFee(days: number): number {
    return -days;        // negative fee: "we pay YOU to keep it late" — breaks the promise
  }
}

// The polymorphic caller is now silently wrong:
const items: LibraryItem[] = [new Book("Dune"), new CursedItem("???")];
totalLateFees(items, 10);   // Book: 2.5, Cursed: -10  →  total -7.5  (nonsense!)
```

```csharp
// C# — same violation, equally compilable, equally wrong.
public class CursedItem : LibraryItem
{
    public CursedItem(string title) : base(title) { }
    public override decimal LateFee(int days) => -days;   // breaks "non-negative" promise
}
```

The bug isn't a type error — it's a **broken behavioral contract**. `CursedItem` *is-a*
`LibraryItem` to the compiler but is **not substitutable** in practice: any code that trusted the
base's promises now misbehaves. That's an LSP violation.

### The rules of thumb (full treatment in Phase 7 §7.3)

A safe override must, relative to the base method:

- **Not strengthen preconditions** — don't demand *more* of callers than the base did
  (e.g. base accepts any `days >= 0`; a subtype rejecting `days > 7` would break callers).
- **Not weaken postconditions** — don't promise *less* than the base
  (e.g. base guarantees a non-negative result; a subtype returning negatives weakens it).
- **Preserve invariants** the base maintained.
- **Not throw new exception types** the base didn't document.

When "is-a" passes the compiler but fails these behavioral rules, that's the signal you may have
the wrong abstraction — and it's the bridge from this phase into SOLID (Phase 7) and composition
over inheritance (Phase 9). Polymorphism gives you the gun; LSP tells you not to point it at your
own foot.

---

## Gotchas

| Gotcha | TypeScript | C# |
|--------|-----------|----|
| Forgetting to opt in to virtuality | N/A — all methods virtual by default | Forget `virtual` on the base and the subtype's method is *shadowing*, not overriding — dispatch uses the **declared** type. Silent bug. |
| `new` vs `override` | N/A | `new` (method hiding) compiles with only a warning and **breaks polymorphism** — calls via the base reference run the base method. Almost never what you want. |
| Overloading ≠ runtime dispatch | TS overloads are compile-time facades; the body discriminates by hand | C# overload resolution uses **static** argument types, not runtime types. Pass an `object` and you get the `object` overload. |
| Calling subtype-only members | Allowed only after narrowing (`if (s instanceof Circle)`) | Allowed only after a cast or pattern match (`if (s is Circle c)`). The declared type gates what you can call. |
| Overriding a method that calls `this`/another virtual in the constructor | Method runs on a half-constructed object | Same trap, worse: a base constructor calling a virtual method runs the **override** before the subtype's fields are initialized — they're still `null`/default. |
| Generics give no runtime type info (TS) | `T` is erased; you can't do `new T()` or `x instanceof T` | C# generics are **reified** — `typeof(T)` and `new T()` (with `new()` constraint) work. |
| "It compiles, so it substitutes" | False — LSP is behavioral, not structural | False — same. The compiler checks signatures, not promises. |
| Operator overloading expectations | Doesn't exist; `+` coerces and loses your type | Exists, but must implement pairs (`==`/`!=`) and override `Equals`/`GetHashCode` or you get inconsistencies. |
| Value-type "polymorphism" | N/A | Calling a virtual/interface method on a `struct` **boxes** it (heap allocation). A subtle perf cost in hot paths. |

---

## Phase 5 Exercise

**Goal:** Make late-fee calculation fully polymorphic — each item type computes its own fee, and
the billing code invokes it **through the `LibraryItem` base reference only**.

**Hard rule:** No type checks. No `if (item is Book)`, no `instanceof`, no `switch (item.type)`,
no casting to a subtype. If you find yourself branching on the concrete type, the polymorphism is
in the wrong place — push the behavior down into the subtype.

**Requirements:**

1. Base `LibraryItem` declares an abstract `lateFee(daysOverdue)` (the polymorphic hook).
2. At least three subtypes with genuinely different rules, e.g.:
   - `Book` — 25¢/day, no cap.
   - `Dvd` — $1.00/day, capped at $20.
   - `Audiobook` — free for the first 3 days (grace period), then 50¢/day after that.
3. A `Billing` helper with `totalLateFees(items, days)` that loops over `LibraryItem[]` and sums
   `item.lateFee(days)` — and contains **zero** references to any concrete subtype.
4. Prove substitutability: write a tiny check that every item's fee is **non-negative** and
   **non-decreasing** in `days` (this is the LSP contract from §5.6 — and a `CursedItem` that
   returns a negative fee should make your check fail).
5. Do it in **both** TypeScript and C#.

**Acceptance check:** Adding a fourth item type (say, `MagazineIssue` — flat $2 after 14 days,
$0 before) must require **only** a new class. The `Billing` code must not change by a single
character. If it has to change, you used a type check somewhere — go find it.

**Starter shape (TypeScript):**

```ts
abstract class LibraryItem {
  constructor(public readonly title: string) {}
  abstract lateFee(daysOverdue: number): number;   // the hook — override per type
}

// TODO: Book, Dvd, Audiobook ...

class Billing {
  // NO type checks allowed inside here.
  totalLateFees(items: LibraryItem[], days: number): number {
    return items.reduce((sum, item) => sum + item.lateFee(days), 0);
  }
}
```

**Starter shape (C#):**

```csharp
public abstract class LibraryItem
{
    public string Title { get; }
    protected LibraryItem(string title) => Title = title;
    public abstract decimal LateFee(int daysOverdue);   // the hook — override per type
}

// TODO: Book, Dvd, Audiobook ...

public static class Billing
{
    // NO type checks allowed inside here.
    public static decimal TotalLateFees(IEnumerable<LibraryItem> items, int days)
        => items.Sum(item => item.LateFee(days));
}
```

**Location:** `examples/phase5-polymorphism/` (one folder per language, or two files).

**Why this matters:** This exact `LateFee` hierarchy pays off again in Phase 7 (Open/Closed
Principle — adding fee types without modifying billing) and Phase 8 (Strategy pattern, where the
fee rule becomes an injectable object instead of a subclass). You're building the foundation the
later phases stand on.
