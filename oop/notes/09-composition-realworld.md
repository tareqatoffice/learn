# Phase 9 — Composition, Anti-Patterns & Real-World OOP

**Status:** Not started
**Notes file:** `notes/09-composition-realworld.md`
**Running domain:** the Media Library (books, audiobooks, DVDs, members, loans) — finalised here as the capstone.

---

This is the capstone. Phases 1–8 taught the four pillars, SOLID, and the patterns. This phase is about *judgment*: when inheritance is the wrong tool, what bad OOP actually looks like in the wild, where OOP and functional style meet, and when you should skip objects entirely. Everything compounds in the final Media Library project.

Every concept appears in **both TypeScript and C#**, as always.

---

## 9.1 Composition over Inheritance

### "Has-a" beats "is-a" more often than you'd think

Inheritance (Phase 4) models **is-a**: a `Book` *is a* `LibraryItem`. Composition models **has-a**: a `Book` *has a* loan policy, *has a* set of media tags. The industry advice "favour composition over inheritance" exists because inheritance has costs that don't show up until later:

- **It's the tightest coupling there is.** A subclass depends on the base class's internal implementation, not just its public API (the fragile base class problem from §4.7).
- **It's single-axis.** A class can extend exactly one base. The moment you need to vary along *two* axes (item type × loan rules, say), the hierarchy explodes combinatorially.
- **It bakes decisions in at compile time.** You can't change a `Book` into an `Audiobook` at runtime. With composition you swap a collaborator and the behavior changes.

The litmus test: if the relationship is a permanent, total "is-a" (a `Circle` *is a* `Shape`), inheritance is fine. If you're inheriting just to *reuse code*, or the relationship is "behaves like" / "has the capability of", reach for composition.

> **Phase 4 callback:** the "banana → gorilla → jungle" problem — you wanted one method, but inheritance dragged in the whole base class. Composition gives you exactly the one collaborator you asked for.

### The strained Phase 4 hierarchy

Recall the Phase 4 exercise: `LibraryItem` → `Book` / `Audiobook` / `DVD`. It looked clean at first:

```ts
// TypeScript — the Phase 4 inheritance version
abstract class LibraryItem {
  constructor(
    public readonly title: string,
    public readonly id: string,
  ) {}
  abstract lateFeePerDay(): number;
}

class Book extends LibraryItem {
  lateFeePerDay() { return 0.25; }
}

class Audiobook extends LibraryItem {
  constructor(title: string, id: string, public readonly narrator: string) {
    super(title, id);
  }
  lateFeePerDay() { return 0.15; }
}

class DVD extends LibraryItem {
  lateFeePerDay() { return 1.0; }
}
```

Where it strains (the note you wrote at the end of Phase 4): real items don't fit one slot. An **audiobook on a DVD**? A **large-print book**? A book that's *also* downloadable? Each new combination is a new subclass, and shared traits (like "is digital" or "has a narrator") get duplicated across branches or pushed up into a base class that becomes a junk drawer. The hierarchy is varying along several independent axes — format, fee rules, lending rules — but inheritance only gives you one axis.

### Refactoring to composition

Instead of *being* a kind of item, an item *has* the pieces that vary: a **format**, a **fee strategy** (your Phase 8 Strategy pattern), and optional **capabilities** (narrated, downloadable). The item class itself stops being abstract — there's only one `LibraryItem` now, configured differently.

```ts
// TypeScript — composition version

// Capabilities and varying behavior become collaborators, not subclasses.
interface FeePolicy {
  perDay(): number;
}

const standardFee: FeePolicy   = { perDay: () => 0.25 };
const audioFee:    FeePolicy   = { perDay: () => 0.15 };
const dvdFee:      FeePolicy   = { perDay: () => 1.0 };

type Format = "print" | "audio" | "video" | "ebook";

// Optional capabilities — present or absent, composed in.
interface Narration { narrator: string; }
interface Downloadable { sizeMb: number; }

class LibraryItem {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly format: Format,
    private readonly feePolicy: FeePolicy,        // HAS-A fee policy
    public readonly narration?: Narration,        // HAS-A narration (maybe)
    public readonly download?: Downloadable,      // HAS-A download (maybe)
  ) {}

  lateFeePerDay() { return this.feePolicy.perDay(); }
  isDigital() { return this.download !== undefined; }
}

// A narrated ebook — impossible to model as a single subclass, trivial here.
const item = new LibraryItem(
  "a1", "Dune", "audio", audioFee,
  { narrator: "Scott Brick" },
  { sizeMb: 540 },
);
```

```csharp
// C# — composition version
namespace MediaLibrary.Domain;

public interface IFeePolicy
{
    decimal PerDay();
}

public sealed class StandardFeePolicy : IFeePolicy { public decimal PerDay() => 0.25m; }
public sealed class AudioFeePolicy    : IFeePolicy { public decimal PerDay() => 0.15m; }
public sealed class DvdFeePolicy      : IFeePolicy { public decimal PerDay() => 1.00m; }

public enum Format { Print, Audio, Video, Ebook }

// Capabilities as small records, composed in (null = absent).
public record Narration(string Narrator);
public record Downloadable(int SizeMb);

public sealed class LibraryItem
{
    public string Id { get; }
    public string Title { get; }
    public Format Format { get; }
    private readonly IFeePolicy _feePolicy;        // HAS-A
    public Narration? Narration { get; }           // HAS-A (maybe)
    public Downloadable? Download { get; }         // HAS-A (maybe)

    public LibraryItem(string id, string title, Format format, IFeePolicy feePolicy,
                       Narration? narration = null, Downloadable? download = null)
    {
        Id = id; Title = title; Format = format;
        _feePolicy = feePolicy; Narration = narration; Download = download;
    }

    public decimal LateFeePerDay() => _feePolicy.PerDay();
    public bool IsDigital() => Download is not null;
}

// Same impossible-under-inheritance item, trivial now:
var item = new LibraryItem("a1", "Dune", Format.Audio, new AudioFeePolicy(),
                           new Narration("Scott Brick"),
                           new Downloadable(540));
```

The combinatorial explosion is gone. Format, fee rules, and capabilities each vary independently because they're separate objects bolted onto one item — not branches of a tree.

### Mixins (TS) and interface + delegation (C#)

Sometimes you genuinely want to *share behavior* across unrelated classes without a common base. TypeScript and C# solve this differently.

**TypeScript — mixins.** A mixin is a function that takes a base class and returns an extended one. You layer capabilities on.

```ts
// TypeScript mixin — share "timestamped" behavior with no shared base class.
type Ctor<T = {}> = new (...args: any[]) => T;

function Timestamped<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
    createdAt = new Date();
    touch() { return new Date(); }
  };
}

function Taggable<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
    tags = new Set<string>();
    addTag(t: string) { this.tags.add(t); }
  };
}

class BareItem {
  constructor(public title: string) {}
}

// Compose capabilities — order is just function application.
const RichItem = Taggable(Timestamped(BareItem));
const r = new RichItem("Dune");
r.addTag("sci-fi");
r.touch();
console.log(r.createdAt, r.tags);
```

**C# — interface + delegation (the idiomatic equivalent).** C# has no mixins. Instead you define a capability interface and *delegate* to a small helper object that implements it. You get the same "share behavior across unrelated types" outcome, explicitly.

```csharp
// C# — interface + delegation. The "mixin" is a field you forward to.
public interface ITaggable
{
    IReadOnlyCollection<string> Tags { get; }
    void AddTag(string tag);
}

// Reusable implementation, dropped into any class that wants tagging.
public sealed class TagSet : ITaggable
{
    private readonly HashSet<string> _tags = new();
    public IReadOnlyCollection<string> Tags => _tags;
    public void AddTag(string tag) => _tags.Add(tag);
}

public sealed class CatalogItem : ITaggable
{
    private readonly TagSet _tags = new();          // HAS-A tagging behavior

    public string Title { get; }
    public CatalogItem(string title) => Title = title;

    // Delegate the interface to the helper — one line each.
    public IReadOnlyCollection<string> Tags => _tags.Tags;
    public void AddTag(string tag) => _tags.AddTag(tag);
}
```

> **Divergence:** TS mixins literally rewrite the class hierarchy at definition time (structural typing makes this seamless). C# can't, so it leans on composition + delegation, which is more verbose but more explicit — you can always see *which object* actually does the work. C# 8 default interface methods can supply default behavior, but they can't hold state, so delegation remains the go-to for stateful capabilities like a tag set.

---

## 9.2 Common OOP Anti-Patterns

A catalogue of how OOP goes wrong — recognising these by name is half the battle.

### God object / blob

One class that knows and does everything. It violates SRP (Phase 7) maximally: every change touches it, nothing can be tested in isolation, and it becomes a merge-conflict magnet.

```ts
// TypeScript — the god object (DON'T)
class LibraryManager {
  addMember(...) { /* ... */ }
  removeMember(...) { /* ... */ }
  catalogItem(...) { /* ... */ }
  searchCatalog(...) { /* ... */ }
  checkoutLoan(...) { /* ... */ }
  calculateLateFee(...) { /* ... */ }
  sendOverdueEmail(...) { /* ... */ }
  generateMonthlyReport(...) { /* ... */ }
  backupDatabase(...) { /* ... */ }   // wildly unrelated
  // ...600 more lines
}
```

The fix is the SRP refactor from Phase 7: split by responsibility into `MemberService`, `Catalog`, `LoanService`, `FeeCalculator`, `NotificationService`. Each has one reason to change.

### Anemic domain model

Entities that are bags of public getters/setters with **no behavior** — all the logic lives in services. It's "OOP" in syntax only; it's really procedural code with the data and the operations on that data ripped apart.

```ts
// TypeScript — ANEMIC (anti-pattern): Loan is just data
class Loan {
  id!: string;
  itemId!: string;
  dueDate!: Date;
  returnedAt: Date | null = null;
}

// All rules live OUTSIDE the object — anyone can put it in an invalid state.
class LoanService {
  return(loan: Loan) {
    if (loan.returnedAt) throw new Error("already returned");
    loan.returnedAt = new Date();   // service mutates the entity's guts
  }
}
```

```ts
// TypeScript — RICH (the fix): the Loan protects its own invariants
class Loan {
  #returnedAt: Date | null = null;

  constructor(
    public readonly id: string,
    public readonly itemId: string,
    public readonly dueDate: Date,
  ) {}

  get returnedAt() { return this.#returnedAt; }
  get isReturned() { return this.#returnedAt !== null; }

  return(now: Date): void {
    if (this.isReturned) throw new Error("Loan already returned");
    this.#returnedAt = now;          // the ONLY way to mutate, and it enforces the rule
  }
}
```

```csharp
// C# — RICH version (the fix). Compare with the anemic .net/notes/04 §4.3 discussion.
public sealed class Loan
{
    public Guid Id { get; }
    public Guid ItemId { get; }
    public DateOnly DueDate { get; }
    public DateOnly? ReturnedAt { get; private set; }   // private set = fortress

    public bool IsReturned => ReturnedAt is not null;

    public Loan(Guid id, Guid itemId, DateOnly dueDate)
    {
        Id = id; ItemId = itemId; DueDate = dueDate;
    }

    public void Return(DateOnly today)
    {
        if (IsReturned) throw new DomainException("Loan already returned.");
        ReturnedAt = today;
    }
}
```

> **Cross-ref:** this is exactly the *rich vs anemic* distinction in `.net/notes/04-clean-architecture.md` §4.3 ("Rich entities (not anemic data bags)"). The Clean Architecture domain layer *is* the cure for the anemic anti-pattern. Coming from JS, where models are usually plain objects, this is the habit to break: push behavior **into** the entity, keep services thin.

### Yo-yo problem

To understand a method you bounce up and down a deep inheritance chain — `Derived.foo()` calls `base.foo()` which calls a `protected` helper overridden three levels up, which calls back down via a template method. Reading the code becomes a yo-yo. **Cause:** deep inheritance + heavy use of `protected` extension points. **Fix:** flatten with composition; favour explicit collaborators over inherited `protected` plumbing.

### Deep inheritance

Hierarchies more than 2–3 levels deep. Each level adds coupling and fragility (§4.7's fragile base class). `Stream → FileStream → BufferedFileStream → EncryptedBufferedFileStream`… every base change ripples down. **Fix:** decorators (Phase 8) or composition — wrap, don't extend.

### Leaky abstractions

An abstraction that forces you to know its implementation to use it correctly. A `IRepository<T>` that "works" but throws a `SqlException` (an EF/SQL-specific type) leaks its database backing into every caller — now your Application layer secretly depends on SQL Server. **Fix:** translate at the boundary (catch infra exceptions, rethrow as domain exceptions, as the Clean Architecture middleware does in `.net/notes/04` §4.6).

```csharp
// LEAKY — the abstraction promises "save an item" but leaks SQL details
public interface IItemRepository
{
    void Add(LibraryItem item);   // ...but callers must catch SqlException? That's a leak.
}

// SEALED — infra translates its own exceptions; callers only know domain exceptions
public sealed class ItemRepository : IItemRepository
{
    public void Add(LibraryItem item)
    {
        try { /* db.Items.Add(item); db.SaveChanges(); */ }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            throw new DomainException($"An item titled '{item.Title}' already exists.");
        }
    }
    private static bool IsUniqueViolation(Exception ex) => /* inspect provider code */ true;
}
```

### Primitive obsession → value objects

Modeling domain concepts with raw primitives (`string`, `int`, `decimal`) instead of dedicated types. The classic smell: a method signature like `loan(string memberId, string itemId, int days)` — three values you can trivially pass in the wrong order, with no validation, no meaning attached.

```ts
// TypeScript — PRIMITIVE OBSESSION (anti-pattern)
function createLoan(memberId: string, itemId: string, days: number) {
  // nothing stops createLoan(itemId, memberId, days) — silently wrong
}

// Loan period is "just a number" everywhere — validation scattered or missing.
```

```ts
// TypeScript — VALUE OBJECTS as the fix
class MemberId {
  private constructor(public readonly value: string) {}
  static of(value: string): MemberId {
    if (!value.startsWith("M-")) throw new Error("Invalid member id");
    return new MemberId(value);
  }
}

class LoanPeriod {
  private constructor(public readonly days: number) {}
  static of(days: number): LoanPeriod {
    if (days < 1 || days > 90) throw new Error("Loan period must be 1–90 days");
    return new LoanPeriod(days);
  }
}

// Now the wrong order won't compile, and an invalid period can't exist.
function createLoan(memberId: MemberId, itemId: ItemId, period: LoanPeriod) { /* ... */ }
```

```csharp
// C# — value objects via records (value equality for free, see .net/notes/01 §1.4)
public readonly record struct MemberId
{
    public string Value { get; }
    private MemberId(string value) => Value = value;
    public static MemberId Of(string value) =>
        value.StartsWith("M-")
            ? new MemberId(value)
            : throw new DomainException("Invalid member id.");
}

public readonly record struct LoanPeriod
{
    public int Days { get; }
    private LoanPeriod(int days) => Days = days;
    public static LoanPeriod Of(int days) =>
        days is >= 1 and <= 90
            ? new LoanPeriod(days)
            : throw new DomainException("Loan period must be 1–90 days.");
}

// Compiler now rejects createLoan(itemId, memberId, ...) — different types.
```

> **TS parallel:** the C# value object is what a *branded type* (`type MemberId = string & { __brand }`) gestures at, but actually enforced — there is no way to construct an invalid one. This is the same `Money`/`Email` pattern from `.net/notes/04` §4.3.

---

## 9.3 Blending OOP and Functional

OOP and FP aren't enemies. Modern C# and TS are both multi-paradigm, and the best real-world code uses each where it's strongest: **objects for things with identity and protected state; functions and immutable data for transformations.**

### Immutability, pure functions, and objects coexisting

A pure function has no side effects and returns the same output for the same input — trivially testable, trivially parallelisable. Immutable data can't be corrupted by aliasing (the Phase 2 reference-semantics trap). You can have all this *and* objects.

```ts
// TypeScript — immutable data + pure functions, used alongside an object
type Fee = Readonly<{ amount: number; currency: "USD" }>;

// Pure: no I/O, no mutation, output depends only on inputs.
const lateFee = (perDay: number, daysLate: number): Fee => ({
  amount: Math.max(0, perDay * daysLate),
  currency: "USD",
});

// The Loan object owns identity + invariants; fee math is a pure function it calls.
class Loan {
  // ...constructor, return(), etc. from §9.2...
  feeOn(today: Date, perDay: number): Fee {
    const daysLate = this.daysLate(today);
    return lateFee(perDay, daysLate);   // delegate the math to a pure function
  }
  private daysLate(today: Date): number { /* pure date diff */ return 0; }
}
```

```csharp
// C# — pure static function + immutable record, alongside the Loan entity
public readonly record struct Fee(decimal Amount, string Currency);

public static class Fees
{
    // Pure: deterministic, no side effects.
    public static Fee Late(decimal perDay, int daysLate) =>
        new(Math.Max(0, perDay * daysLate), "USD");
}

public sealed partial class Loan
{
    public Fee FeeOn(DateOnly today, decimal perDay) =>
        Fees.Late(perDay, DaysLate(today));      // entity delegates math to a pure function

    private int DaysLate(DateOnly today) =>
        IsReturned || today <= DueDate ? 0 : today.DayNumber - DueDate.DayNumber;
}
```

### When records + functions beat classes + methods

Reach for **records + functions** (data-oriented) instead of **classes + methods** (object-oriented) when:

- The thing is **data, not an entity** — a DTO, an event, a coordinate, a config. No identity, no invariants to protect beyond construction.
- You're doing a **pipeline of transforms** — parse → validate → map → reduce. Functions chain; objects get in the way.
- You want **value equality** out of the box — `record` gives it; a `class` would need you to override equality by hand.

Reach for **classes + methods** when there's identity (two `Member`s with the same name are different members), protected mutable state, or polymorphic behavior.

### Modern C# functional side: records, pattern matching, LINQ

```csharp
// Discriminated-union-style hierarchy via records + exhaustive pattern matching.
public abstract record LoanEvent;
public record Borrowed(Guid LoanId, DateOnly On)             : LoanEvent;
public record Returned(Guid LoanId, DateOnly On)             : LoanEvent;
public record Overdue(Guid LoanId, int DaysLate, decimal Fee): LoanEvent;

// A pure function over the union — the switch is exhaustive and self-documenting.
public static string Describe(LoanEvent e) => e switch
{
    Borrowed b => $"Borrowed on {b.On}",
    Returned r => $"Returned on {r.On}",
    Overdue o  => $"Overdue {o.DaysLate}d, fee {o.Fee:0.00}",
    _          => "Unknown event"
};

// LINQ = the functional pipeline. Map/filter/reduce over a collection, no loops, no mutation.
public static decimal TotalFees(IEnumerable<LoanEvent> events) =>
    events.OfType<Overdue>()            // filter to overdue events
          .Sum(o => o.Fee);             // reduce to a total
```

### Modern TS functional side: discriminated unions

```ts
// TypeScript discriminated union — the structural twin of the C# record hierarchy above.
type LoanEvent =
  | { kind: "borrowed"; loanId: string; on: Date }
  | { kind: "returned"; loanId: string; on: Date }
  | { kind: "overdue";  loanId: string; daysLate: number; fee: number };

// Exhaustive narrowing — TS errors if you add a variant and forget a case (with never check).
function describe(e: LoanEvent): string {
  switch (e.kind) {
    case "borrowed": return `Borrowed on ${e.on.toISOString()}`;
    case "returned": return `Returned on ${e.on.toISOString()}`;
    case "overdue":  return `Overdue ${e.daysLate}d, fee ${e.fee.toFixed(2)}`;
    default: {
      const _exhaustive: never = e;   // compile error if a case is missing
      return _exhaustive;
    }
  }
}

// The functional pipeline — map/filter/reduce, same shape as LINQ.
const totalFees = (events: LoanEvent[]): number =>
  events
    .filter((e): e is Extract<LoanEvent, { kind: "overdue" }> => e.kind === "overdue")
    .reduce((sum, e) => sum + e.fee, 0);
```

> **Divergence:** C#'s `switch` on record types and TS's `switch` on a `kind` discriminant solve the same problem (sum types / "one of N shapes"). C# leans on the nominal type; TS leans on a literal discriminant property. Both give exhaustiveness — C# via the compiler analysis on sealed hierarchies, TS via the `never` trick.

---

## 9.4 Domain Modeling with OOP

This is where every earlier phase pays off at once. A **rich domain model** combines encapsulation (Phase 3), polymorphism (Phase 5), abstraction (Phase 6), and composition (§9.1) to model a business domain so that *invalid states are unrepresentable* and *business rules live with the data they govern*. It's the OOP foundation under DDD and the Clean Architecture domain layer.

### The three building blocks

- **Entity** — has identity that persists over time and through changes. A `Member` is the same member even after they change their name. Equality is by ID, not by value.
- **Value object** — no identity; defined entirely by its values; immutable. `Money(10, "USD")`, `LoanPeriod(14)`, `Email`. Two equal value objects are interchangeable. (§9.2's fix for primitive obsession.)
- **Aggregate** — a cluster of entities + value objects treated as one consistency boundary, with one **aggregate root** as the only entry point. Outside code holds a reference to the root, never to an inner entity. The root enforces all invariants across the cluster.

```ts
// TypeScript — a Member aggregate root guarding its loans (the inner entities)
class Member {                          // ENTITY — identity by id
  #loans: Loan[] = [];

  constructor(
    public readonly id: MemberId,       // VALUE OBJECT
    public name: string,
    private readonly policy: LoanPolicy, // COMPOSITION — pluggable rules (Strategy)
  ) {}

  // The ONLY way to add a loan — the root enforces the cross-loan invariant.
  borrow(item: LibraryItem, today: Date): Loan {
    if (this.#loans.filter(l => !l.isReturned).length >= this.policy.maxLoans())
      throw new Error(`Borrow limit of ${this.policy.maxLoans()} reached`);
    const due = this.policy.dueDate(today);
    const loan = new Loan(crypto.randomUUID(), item.id, due);
    this.#loans.push(loan);
    return loan;
  }

  get activeLoans(): readonly Loan[] {  // expose a read-only view, never the array
    return this.#loans.filter(l => !l.isReturned);
  }
}
```

```csharp
// C# — the same Member aggregate root
public sealed class Member                       // ENTITY — identity by Id
{
    private readonly List<Loan> _loans = new();
    private readonly ILoanPolicy _policy;        // COMPOSITION (Strategy, Phase 8)

    public MemberId Id { get; }                  // VALUE OBJECT
    public string Name { get; private set; }

    public Member(MemberId id, string name, ILoanPolicy policy)
    {
        Id = id; Name = name; _policy = policy;
    }

    // Only entry point for borrowing — invariant lives with the root.
    public Loan Borrow(LibraryItem item, DateOnly today)
    {
        if (_loans.Count(l => !l.IsReturned) >= _policy.MaxLoans())
            throw new DomainException($"Borrow limit of {_policy.MaxLoans()} reached.");

        var due = _policy.DueDate(today);
        var loan = new Loan(Guid.NewGuid(), item.Id, due);
        _loans.Add(loan);
        return loan;
    }

    // Read-only projection — outsiders never touch the backing list.
    public IReadOnlyList<Loan> ActiveLoans =>
        _loans.Where(l => !l.IsReturned).ToList();

    // Entity equality is by identity, not value:
    public override bool Equals(object? obj) => obj is Member m && m.Id.Equals(Id);
    public override int GetHashCode() => Id.GetHashCode();
}
```

### Polymorphic policies — abstraction + polymorphism together

The `LoanPolicy` is your Phase 6 `ILoanPolicy` abstraction with Phase 8 Strategy implementations (standard / student / staff). The `Member` depends only on the interface — DIP (Phase 7) in action.

```csharp
public interface ILoanPolicy
{
    int MaxLoans();
    DateOnly DueDate(DateOnly from);
    decimal LateFeeMultiplier();
}

public sealed class StandardPolicy : ILoanPolicy
{
    public int MaxLoans() => 5;
    public DateOnly DueDate(DateOnly from) => from.AddDays(14);
    public decimal LateFeeMultiplier() => 1.0m;
}

public sealed class StudentPolicy : ILoanPolicy
{
    public int MaxLoans() => 10;
    public DateOnly DueDate(DateOnly from) => from.AddDays(28);   // longer term
    public decimal LateFeeMultiplier() => 0.5m;                   // gentler fees
}

public sealed class StaffPolicy : ILoanPolicy
{
    public int MaxLoans() => 50;
    public DateOnly DueDate(DateOnly from) => from.AddDays(90);
    public decimal LateFeeMultiplier() => 0.0m;                   // no fees
}
```

```ts
// TypeScript twin
interface LoanPolicy {
  maxLoans(): number;
  dueDate(from: Date): Date;
  lateFeeMultiplier(): number;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const standardPolicy: LoanPolicy = {
  maxLoans: () => 5,
  dueDate: (from) => addDays(from, 14),
  lateFeeMultiplier: () => 1.0,
};
const studentPolicy: LoanPolicy = {
  maxLoans: () => 10,
  dueDate: (from) => addDays(from, 28),
  lateFeeMultiplier: () => 0.5,
};
const staffPolicy: LoanPolicy = {
  maxLoans: () => 50,
  dueDate: (from) => addDays(from, 90),
  lateFeeMultiplier: () => 0.0,
};
```

Notice the payoff: adding a "VIP" policy is a *new class*, zero edits to `Member` (Open/Closed). No `if (member.type === "student")` branches anywhere — polymorphism erased them (Phase 5). The fee math is a pure function (§9.3). The item is composed, not subclassed (§9.1). Every pillar is pulling its weight.

---

## 9.5 Testing Object-Oriented Code

Good OOP is *testable* OOP — and the two properties that make it so are the ones you've spent this whole module building: **encapsulation** and **dependency inversion**.

### Why encapsulation + DIP make code testable

- **Encapsulation** means an object has a small public surface and protects its invariants. You test through that public API — call `loan.return()`, assert on `loan.isReturned`. You never reach into internals, so tests don't break when internals change. (If a test *needs* to poke private state, that's a design smell, not a testing problem.)
- **DIP** (depend on abstractions, Phase 7) gives you **seams** — points where you can substitute a fake. Because `Member` depends on `ILoanPolicy` (not a concrete one) and a use case depends on `IItemRepository` (not EF Core), you can inject a test double and run the logic with zero database, zero network, zero clock.

> The anemic model (§9.2) is *hard* to test well: the rules are scattered across services, so you can't assert "a returned loan can't be returned again" against the object — you have to stand up the service and its dependencies. The rich model lets you `new` up the entity and assert directly. That's the Phase 4 promise ("business logic runs with zero HTTP, zero database") cashed in.

### Test doubles via interfaces — the seams abstraction gives you

```ts
// TypeScript (Vitest-style) — pure entity test, no doubles needed at all.
import { describe, it, expect } from "vitest";

describe("Loan invariants", () => {
  it("cannot be returned twice", () => {
    const loan = new Loan("L1", "I1", new Date("2026-07-01"));
    loan.return(new Date("2026-06-20"));
    expect(() => loan.return(new Date("2026-06-21"))).toThrow("already returned");
  });
});

// Where a collaborator exists, the interface is the seam — inject a fake policy.
describe("Member.borrow", () => {
  it("rejects borrowing past the limit", () => {
    const fakePolicy: LoanPolicy = {
      maxLoans: () => 1,                      // tiny limit makes the test fast & obvious
      dueDate: (d) => d,
      lateFeeMultiplier: () => 1,
    };
    const member = new Member(MemberId.of("M-1"), "Tareq", fakePolicy);
    member.borrow(item1, new Date());
    expect(() => member.borrow(item2, new Date())).toThrow("limit");
  });
});
```

```csharp
// C# (xUnit + a hand-rolled fake) — see .net/notes/06-testing.md for the full toolkit.
public class LoanTests
{
    [Fact]
    public void Return_Twice_Throws()
    {
        var loan = new Loan(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 7, 1));
        loan.Return(new DateOnly(2026, 6, 20));

        var ex = Assert.Throws<DomainException>(() => loan.Return(new DateOnly(2026, 6, 21)));
        Assert.Contains("already returned", ex.Message);
    }
}

public class MemberTests
{
    // A test double implementing the interface — the seam DIP gave us.
    private sealed class TinyLimitPolicy : ILoanPolicy
    {
        public int MaxLoans() => 1;
        public DateOnly DueDate(DateOnly from) => from;
        public decimal LateFeeMultiplier() => 1m;
    }

    [Fact]
    public void Borrow_PastLimit_Throws()
    {
        var member = new Member(MemberId.Of("M-1"), "Tareq", new TinyLimitPolicy());
        member.Borrow(SampleItem(), new DateOnly(2026, 6, 17));

        Assert.Throws<DomainException>(() => member.Borrow(SampleItem(), new DateOnly(2026, 6, 17)));
    }
}
```

> **Cross-ref:** `.net/notes/06-testing.md` (xUnit `[Fact]`/`[Theory]`, Moq, integration tests) and `javascript/notes/07-testing.md` (Vitest/Jest, mocks, fakes) cover the tooling. The *design* lesson here is upstream of the tools: a well-encapsulated, dependency-inverted object is testable in any framework, because the seams are built into the design. You barely need a mocking library — a small hand-written fake implementing the interface is often clearer than `Moq`/`vi.fn()`.

---

## 9.6 When NOT to Use OOP

The final piece of judgment: OOP is a tool, not a religion. For a lot of code, a class is pure ceremony — a wrapper that adds indirection without adding protection.

**Skip OOP — just write functions — when:**

- **It's a script or a one-off.** A migration, a data fix, a build step. `main()` and a few functions. Wrapping it in a `MigrationRunner` class with injected dependencies is over-engineering.
- **It's a data pipeline / transform.** Parse → filter → map → aggregate → write. This is functional territory: immutable data flowing through pure functions (LINQ / array methods). A class per stage adds nothing.
- **There's no state to protect and no polymorphism to exploit.** If your "object" is just a namespace for one method, it should have been a function. A class with a single public method and no fields is a function wearing a costume.

```ts
// TypeScript — a transform. Functions are the right tool; no class needed.
type Row = { title: string; borrowedDays: number };

const overdueReport = (rows: Row[], limitDays: number): string[] =>
  rows
    .filter((r) => r.borrowedDays > limitDays)             // filter
    .sort((a, b) => b.borrowedDays - a.borrowedDays)       // sort
    .map((r) => `${r.title}: ${r.borrowedDays}d`);         // map

// A `ReportGenerator` class here would be ceremony — these three pure steps are clearer.
```

```csharp
// C# — same transform, top-level statements + LINQ. No class, no DI, no interface.
record Row(string Title, int BorrowedDays);

IEnumerable<string> OverdueReport(IEnumerable<Row> rows, int limitDays) =>
    rows.Where(r => r.BorrowedDays > limitDays)
        .OrderByDescending(r => r.BorrowedDays)
        .Select(r => $"{r.Title}: {r.BorrowedDays}d");
```

**The cost of ceremony.** Every interface, every injected dependency, every class is indirection a reader has to hold in their head. It pays off when it buys you testability, swappability, or invariant protection. It's pure cost when it doesn't. The rich `Member` aggregate earns its classes (identity, invariants, polymorphic policies). The overdue report does not.

**Judgment over dogma.** "Always use OOP" and "OOP is dead, use FP" are both wrong. The skill this module builds is knowing *which* tool fits *this* problem — and being able to defend the choice. Reach for objects when you have identity + state + behavior + polymorphism; reach for functions when you have a transformation; blend them freely (§9.3).

---

## Gotchas

| Gotcha | What trips people up |
|---|---|
| **Composition isn't "no inheritance"** | It's "prefer has-a *when the relationship isn't a true is-a*." A `Circle` genuinely *is a* `Shape` — inheritance is right there. Don't cargo-cult composition onto real is-a relationships. |
| **TS mixins ≠ C# anything** | TS mixins rewrite the class at definition time (structural typing). C# has no equivalent — use interface + delegation. Don't go looking for a C# `mixin` keyword. |
| **C# 8 default interface methods can't hold state** | They give *default behavior*, not the stateful "mixin" you may want. A tag set needs a backing field → delegate to a helper object, don't try to cram it into the interface. |
| **Anemic-by-accident** | Coming from JS plain-object models, the *default* is anemic. Rich models take deliberate effort: private setters, behavior methods, no public mutators. If your entity has only getters/setters, you've drifted anemic. |
| **Value object equality** | In C#, use `record`/`record struct` or two equal `Money`s compare *unequal* (reference equality). In TS there's no built-in value equality — compare fields by hand or wrap in a helper. |
| **Entity equality is by ID** | Don't make an entity a `record` — two different members with the same name would compare equal. Entities = identity equality (override `Equals`); value objects = value equality (`record`). |
| **Exhaustiveness needs help** | C# `switch` on a sealed record hierarchy can warn on missing cases; TS needs the `const _: never = x` trick. Without it, adding a union variant silently skips a branch. |
| **Leaky abstraction via exceptions** | An interface that throws provider-specific exceptions (`SqlException`) leaks. Translate to domain exceptions at the infra boundary. |
| **Don't test private state** | If a test reaches into `#private`/`private`, the design is wrong, not the test. Test through the public API; the need to peek means behavior is misplaced. |
| **Over-applying OOP** | A class with one method and no state is a function in disguise. Ceremony is a real cost — only pay it for testability, swappability, or invariant protection. |
| **Aggregate boundary leaks** | Returning the internal `List<Loan>` from `Member` lets callers mutate it behind the root's back. Always expose a read-only projection (`IReadOnlyList`, `readonly[]`), never the backing collection. |

---

## Phase 9 Project — Media Library Capstone

**Goal:** Finalise the Media Library as a small, well-modeled domain that exercises **every pillar at once**: rich entities, value objects, polymorphic policies, composition where inheritance was strained, a domain event for overdue loans, and a thin test suite proving the invariants hold. Build it in your stronger language first, then port the domain to the other — the contrast is the lesson.

### What to build

A console-runnable (or test-only) domain — no HTTP, no DB. Pure domain + a thin test project. This mirrors the Clean Architecture *Domain* layer (`.net/notes/04` §4.3): zero infrastructure dependencies.

```
oop/examples/phase9-media-library/
├── domain/
│   ├── value-objects/   MemberId, ItemId, LoanPeriod, Money, Email
│   ├── entities/        LibraryItem (composed), Loan, Member (aggregate root)
│   ├── policies/        ILoanPolicy + Standard / Student / Staff
│   ├── events/          LoanOverdueEvent (+ a tiny in-process dispatcher)
│   └── fees/            pure fee functions (§9.3)
└── tests/               invariant tests (§9.5)
```

### Concrete steps (hints, not full solutions)

1. **Value objects first** (§9.2 / §9.4). Build `MemberId`, `ItemId`, `LoanPeriod`, `Money`, `Email` — each *unconstructable in an invalid state* (private ctor + static factory in TS; `record` + guard in C#). Kills primitive obsession before it starts.
2. **Compose `LibraryItem`** (§9.1). One non-abstract class with a `Format`, an injected `IFeePolicy`, and optional `Narration` / `Downloadable` capabilities. Prove you can model a narrated ebook — the thing the Phase 4 hierarchy couldn't.
3. **Rich `Loan`** (§9.2). Private `returnedAt`, a `return()` method that throws if already returned, and a `daysLate(today)` calc. No public setters anywhere.
4. **`Member` aggregate root** (§9.4). Holds loans privately; `borrow(item, today)` enforces the policy's `maxLoans`; exposes only a read-only `activeLoans` view. Entity equality by ID.
5. **Polymorphic policies** (§9.4 / Phase 6+8). `ILoanPolicy` with Standard / Student / Staff. `Member` depends only on the interface (DIP). Adding a policy = new class, zero edits to `Member` (verify OCP holds).
6. **Overdue event** (§9.3 events + Phase 8 Observer). When a loan crosses its due date, the domain *records* a `LoanOverdueEvent(loanId, daysLate, fee)` (don't have the entity email anyone — record the fact, let a dispatcher fan it out, exactly like `.net/notes/04` §4.3 domain events). Fee = pure function × the policy's multiplier.
7. **Fee math as pure functions** (§9.3). `lateFee(perDay, daysLate)` and `member`'s effective fee (policy multiplier applied) — no I/O, fully deterministic.
8. **Thin test suite** (§9.5). Prove the invariants, not the implementation:
   - a returned loan can't be returned again;
   - borrowing past `maxLoans` throws (inject a tiny-limit fake policy — the DIP seam);
   - an invalid `LoanPeriod` / `Email` can't be constructed;
   - an overdue loan raises exactly one `LoanOverdueEvent` with the right `daysLate` and fee;
   - student vs staff policies produce different due dates and fees through the *same* `Member.borrow` call (polymorphism, no type checks).
9. **Port the domain** to the other language. Note where structural vs nominal typing changed your hand (mixins vs delegation; discriminated unions vs record hierarchies; branded types vs real value objects).

### Acceptance checklist

- [ ] No value object can be constructed in an invalid state
- [ ] `LibraryItem` is composed (format + fee policy + optional capabilities), not subclassed — and models a narrated ebook
- [ ] `Loan` and `Member` are rich (private setters, behavior methods, no public mutators)
- [ ] `Member` is an aggregate root: loans only reachable through it, exposed read-only
- [ ] Loan policies are polymorphic; adding one requires zero edits to `Member` (OCP)
- [ ] Zero `if (item is Book)` / `if (member.type === "...")` type-checks anywhere (polymorphism did the work)
- [ ] An overdue loan records a `LoanOverdueEvent`; the entity never sends the notification itself
- [ ] Fee calculation is a pure function (deterministic, no side effects)
- [ ] Tests assert invariants through the public API only — none reach into private state
- [ ] Tests use an interface-based fake policy (the DIP seam), not a heavyweight mock
- [ ] The same domain exists in both TypeScript and C#, with the divergences noted

> **The payoff:** this single small domain uses encapsulation (Phase 3), inheritance-vs-composition judgment (Phase 4 → §9.1), polymorphism (Phase 5), abstraction/interfaces (Phase 6), SOLID (Phase 7 — especially OCP + DIP), patterns (Phase 8 — Strategy + Observer), and the functional blend + testability of this phase. If you can build it cleanly in both languages and defend each design choice, you've finished the module.

---

## Summary

| Concept | What it is | TS / C# mechanism |
|---|---|---|
| **Composition over inheritance** | Prefer has-a unless it's a true is-a | injected collaborators; one item class + policies |
| **Mixin vs delegation** | Share behavior across unrelated types | TS mixin function / C# interface + helper field |
| **God object** | One class does everything | split by responsibility (SRP) |
| **Anemic model** | Data bag, logic in services | rich entity with private setters + methods |
| **Primitive obsession** | Domain concepts as raw primitives | value objects (`record` / factory class) |
| **Leaky abstraction** | Implementation forced on the caller | translate at the boundary (domain exceptions) |
| **OOP + FP blend** | Objects for identity, functions for transforms | pure functions + immutable records alongside entities |
| **Discriminated union / sum type** | One of N shapes, exhaustive | TS `kind` union / C# record hierarchy + `switch` |
| **Rich domain model** | Invalid states unrepresentable | entities + value objects + aggregates |
| **Aggregate root** | One entry point, one consistency boundary | private collection + read-only projection |
| **Testable OO** | Encapsulation + DIP create seams | public-API tests + interface fakes |
| **When NOT to use OOP** | Scripts, pipelines, stateless transforms | plain functions + LINQ / array methods |
