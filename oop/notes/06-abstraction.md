# Phase 6 — Abstraction (Interfaces & Abstract Classes)

**Status:** Not started
**Running domain:** Media Library — this phase introduces the `ILoanPolicy` abstraction
**Prereqs:** Phase 4 (Inheritance), Phase 5 (Polymorphism) — abstraction is what polymorphism is *for*

---

## 6.1 What Abstraction Is

Abstraction is the discipline of **modeling the essential and hiding the incidental**. You decide *what* a thing does and let the *how* live somewhere you don't have to look. When you call `Array.prototype.sort`, you don't know (or care) whether it's Timsort, quicksort, or something V8 swapped in last release — you depend on the *idea* "this sorts," not the implementation.

In OOP, abstraction is delivered through two tools, which this whole phase is about:

- **Interfaces** — a pure contract: a list of capabilities with no implementation.
- **Abstract classes** — a partial implementation: some behavior filled in, some left as holes for subclasses.

Both let you write code against "the shape of a thing" rather than "this specific concrete type."

### Abstraction vs Encapsulation — the difference, finally

These two get conflated constantly. They are related (both involve "hiding") but they answer different questions, at different levels.

| | **Encapsulation** (Phase 3) | **Abstraction** (this phase) |
|---|---|---|
| Question it answers | *"How do I protect this object's internal state?"* | *"How do I model only what callers need to know?"* |
| Level | Implementation level — inside one class | Design level — across types |
| Mechanism | access modifiers, properties, invariants | interfaces, abstract classes |
| Hides | the **data** and the **wiring** | the **type** and the **how** |
| Failure mode if absent | objects reach invalid states | callers coupled to concrete classes |

A one-liner that sticks: **encapsulation hides the *insides* of one object; abstraction hides the *identity of which object* you're even talking to.**

```ts
// ENCAPSULATION: this single class protects its own state.
// The #private field can't be poked from outside; the rule lives in return().
class Loan {
  #returnedAt: Date | null = null;         // hidden data (encapsulation)
  return(): void {                         // controlled mutation (encapsulation)
    if (this.#returnedAt) throw new Error('already returned');
    this.#returnedAt = new Date();
  }
  get isReturned() { return this.#returnedAt !== null; }
}

// ABSTRACTION: callers depend on a CONTRACT, not on a concrete class.
// They never learn which implementation actually computes the fee.
interface ILoanPolicy {
  loanPeriodDays(): number;                // the essential "what"
}
function dueDate(borrowedAt: Date, policy: ILoanPolicy): Date {
  const d = new Date(borrowedAt);
  d.setDate(d.getDate() + policy.loanPeriodDays()); // we don't know "how" — and don't care
  return d;
}
```

```csharp
// ENCAPSULATION — one class guarding its own state
public class Loan
{
    private DateTime? _returnedAt;           // hidden data
    public void Return()                     // controlled mutation
    {
        if (_returnedAt is not null) throw new InvalidOperationException("already returned");
        _returnedAt = DateTime.UtcNow;
    }
    public bool IsReturned => _returnedAt is not null;
}

// ABSTRACTION — callers depend on the contract, not the concrete type
public interface ILoanPolicy
{
    int LoanPeriodDays();
}
public static DateTime DueDate(DateTime borrowedAt, ILoanPolicy policy)
    => borrowedAt.AddDays(policy.LoanPeriodDays()); // no idea which policy this is
```

You can have one without the other, but they compound: well-encapsulated objects make good abstractions, and good abstractions make encapsulation worth the effort (callers can't peek even if they wanted to).

---

## 6.2 Interfaces

An **interface** is a contract: a set of members (methods, properties) a type promises to provide, with **no implementation**. It answers "what can this thing do?" and says nothing about "how" or "what is it made of."

### Defining and implementing — both languages

```ts
// TypeScript — interface is a pure type, erased at runtime
interface ILoanPolicy {
  loanPeriodDays(): number;
  maxRenewals(): number;
}

class StandardLoanPolicy implements ILoanPolicy {
  loanPeriodDays(): number { return 21; }
  maxRenewals(): number { return 2; }
}
```

```csharp
// C# — interface is a real, nominal type that exists at runtime
public interface ILoanPolicy
{
    int LoanPeriodDays();
    int MaxRenewals();
}

public class StandardLoanPolicy : ILoanPolicy   // ': ILoanPolicy' is the explicit declaration
{
    public int LoanPeriodDays() => 21;
    public int MaxRenewals() => 2;
}
```

Convention note: C# interfaces are named with a leading `I` (`ILoanPolicy`) — this is a hard idiom in .NET. TypeScript *can* do the same, but the modern community leans toward no prefix (`LoanPolicy`); I'm using the `I` prefix in both here so the two columns line up.

### THE BIG DIVERGENCE — nominal (C#) vs structural (TS)

This is the most important slide of the phase, and it's the exact same divergence covered from the TS side in `javascript/notes/02-advanced-typescript.md` §2.1.

- **C# interfaces are *nominal*.** A class implements an interface only if it *says so* (`: ILoanPolicy`). Having all the right methods is not enough — the declared relationship must exist. The compiler checks "was this declared to be an `ILoanPolicy`?"
- **TS interfaces are *structural* ("duck typing").** Any value whose *shape* matches the interface is accepted, whether or not it ever wrote `implements`. The compiler checks "can this value do what the interface promises?"

```ts
// TypeScript — STRUCTURAL. No `implements` needed; the shape is the contract.
interface ILoanPolicy { loanPeriodDays(): number; maxRenewals(): number; }

// This object never mentions ILoanPolicy, but it MATCHES the shape:
const adHocPolicy = {
  loanPeriodDays: () => 7,
  maxRenewals: () => 0,
};

function use(p: ILoanPolicy) { /* ... */ }
use(adHocPolicy);            // ✅ OK in TS — shape matches, that's all it takes

// `implements` in TS is just an OPT-IN assertion that the compiler checks your
// class against the interface. It is NOT what makes the class assignable —
// the shape is. Removing `implements` below changes nothing about assignability:
class StudentLoanPolicy implements ILoanPolicy {
  loanPeriodDays() { return 42; }
  maxRenewals() { return 3; }
}
```

```csharp
// C# — NOMINAL. The class must DECLARE the relationship.
public interface ILoanPolicy { int LoanPeriodDays(); int MaxRenewals(); }

// A class with the exact same methods but NO ': ILoanPolicy' is NOT an ILoanPolicy:
public class LooksLikeAPolicy
{
    public int LoanPeriodDays() => 7;
    public int MaxRenewals() => 0;
}

public static void Use(ILoanPolicy p) { /* ... */ }

// Use(new LooksLikeAPolicy());  // ❌ COMPILE ERROR — not declared to implement ILoanPolicy
// Use(new StudentLoanPolicy()); // ✅ only works because StudentLoanPolicy : ILoanPolicy
```

**Why it matters in practice:**
- In C#, you can't accidentally satisfy an interface — and you can't satisfy one you don't control without subclassing or an adapter. The relationship is intentional and discoverable ("find all implementations of `ILoanPolicy`").
- In TS, mocks and test doubles are trivial (any matching object works — no class needed), but two unrelated interfaces with the same shape are interchangeable (the `Celsius`/`Fahrenheit` footgun from §2.1). When meaning must differ despite identical shape, TS reaches for **branded types** (`javascript/notes/02-advanced-typescript.md` §2.7); C# gets this distinction for free because the names differ.

### Interfaces as contracts; multiple implementation

A type can implement **many** interfaces — this is true in both languages and is the key to "compose capabilities" instead of "inherit one big base." A class has *one* base class but *any number* of interfaces.

```ts
interface ILoanPolicy { loanPeriodDays(): number; }
interface IDescribable { describe(): string; }

// One class, two contracts:
class StaffLoanPolicy implements ILoanPolicy, IDescribable {
  loanPeriodDays() { return 90; }
  describe() { return 'Staff: 90-day loans'; }
}
```

```csharp
public interface ILoanPolicy { int LoanPeriodDays(); }
public interface IDescribable { string Describe(); }

// Comma-separated list — one base class allowed, many interfaces allowed:
public class StaffLoanPolicy : ILoanPolicy, IDescribable
{
    public int LoanPeriodDays() => 90;
    public string Describe() => "Staff: 90-day loans";
}
```

> C# extra: **explicit interface implementation** lets a class implement two interfaces that declare a member with the same name but different meaning, keeping each accessible only through its interface type:
> ```csharp
> public class Combo : ILoanPolicy, IDescribable
> {
>     int ILoanPolicy.LoanPeriodDays() => 14;  // only visible via an ILoanPolicy reference
>     public string Describe() => "combo";
> }
> ```
> TS has no equivalent because methods are keyed purely by name/shape.

---

## 6.3 Abstract Classes

An **abstract class** sits between a plain class and an interface: it can provide *real implementation* for some members while leaving others as **abstract methods** — declared but unimplemented holes that every concrete subclass *must* fill. It's "a base class that refuses to be complete on its own."

### Abstract methods + partial implementation

```ts
// TypeScript
abstract class LoanPolicyBase {
  // Concrete: shared, fully implemented — subclasses inherit it for free.
  dueDate(borrowedAt: Date): Date {
    const d = new Date(borrowedAt);
    d.setDate(d.getDate() + this.loanPeriodDays()); // calls the abstract hole below
    return d;
  }

  // Abstract: a hole. No body. Every concrete subclass MUST implement it.
  abstract loanPeriodDays(): number;
}

class StandardLoanPolicy extends LoanPolicyBase {
  loanPeriodDays(): number { return 21; }   // fills the hole
}
```

```csharp
// C#
public abstract class LoanPolicyBase
{
    // Concrete shared method — inherited as-is
    public DateTime DueDate(DateTime borrowedAt)
        => borrowedAt.AddDays(LoanPeriodDays());   // calls the abstract member

    // Abstract member — no body, must be overridden
    public abstract int LoanPeriodDays();
}

public class StandardLoanPolicy : LoanPolicyBase
{
    public override int LoanPeriodDays() => 21;    // 'override' is REQUIRED in C#
}
```

Note the syntax asymmetry from Phase 4: C# *requires* `override` when filling an abstract member; TS just redeclares the method (every TS method is already virtual).

### Why you can't instantiate an abstract class

An abstract class has unfilled holes — `new LoanPolicyBase()` would produce an object where `loanPeriodDays()` has no behavior. Both compilers forbid it:

```ts
// const p = new LoanPolicyBase(); // ❌ TS error: Cannot create an instance of an abstract class.
```

```csharp
// var p = new LoanPolicyBase(); // ❌ CS0144: Cannot create an instance of the abstract type.
```

You *can* still use the abstract type as a **variable/parameter type** — that's the whole point (polymorphism through the base):

```ts
const policies: LoanPolicyBase[] = [new StandardLoanPolicy(), new StudentLoanPolicy()];
policies.forEach(p => console.log(p.dueDate(new Date()))); // dispatches to each subclass
```

### Template Method preview

Notice what `dueDate` / `DueDate` above is doing: the **base class owns the algorithm skeleton** (the fixed steps) and delegates the *variable* step (`loanPeriodDays()`) to subclasses. That's the **Template Method pattern** — a fixed sequence with overridable holes. Abstract classes are its natural home because they can mix concrete (the skeleton) and abstract (the holes) members in one type. We'll formalize it in Phase 8; for now just notice that "concrete method calls abstract method" is a recurring, powerful shape.

---

## 6.4 Interface vs Abstract Class — When Each

Both give you abstraction and both enable polymorphism. The decision comes down to **contract vs identity**.

| Use an **interface** when… | Use an **abstract class** when… |
|---|---|
| You're describing a **capability/contract** ("can be loaned", "can be described") | You're describing **what something is** + sharing implementation |
| Unrelated types need the same ability | A family of closely-related types shares real code |
| You want a type to satisfy **many** of them | You have fields/state and common method bodies to inherit |
| You need a test double / mock easily | You want a Template-Method skeleton with enforced holes |
| Consumers should depend on the abstraction (DIP) | Subclasses genuinely form an "is-a" hierarchy |

Rule of thumb: **interface = "can do" (a *role*); abstract class = "is a" (a *kind*).** A `StaffLoanPolicy` *is a* kind of loan policy (abstract base fits) but it also *can be* described (interface fits) — and these aren't mutually exclusive.

### Single inheritance + multiple interfaces — both languages

This is the structural reason "prefer interfaces" exists. In **both** TS and C#, a class may extend **at most one** (abstract) base class but implement **any number** of interfaces.

```ts
abstract class LoanPolicyBase { abstract loanPeriodDays(): number; }
interface IDescribable { describe(): string; }
interface IAuditable { auditTag(): string; }

class StaffLoanPolicy
  extends LoanPolicyBase              // exactly ONE base class
  implements IDescribable, IAuditable // as MANY interfaces as you like
{
  loanPeriodDays() { return 90; }
  describe() { return 'Staff policy'; }
  auditTag() { return 'POLICY_STAFF'; }
}
```

```csharp
public abstract class LoanPolicyBase { public abstract int LoanPeriodDays(); }
public interface IDescribable { string Describe(); }
public interface IAuditable { string AuditTag(); }

// In C# the base class must come FIRST in the list, then interfaces:
public class StaffLoanPolicy : LoanPolicyBase, IDescribable, IAuditable
{
    public override int LoanPeriodDays() => 90;
    public string Describe() => "Staff policy";
    public string AuditTag() => "POLICY_STAFF";
}
```

### "Prefer interfaces" — and why

The common advice is **prefer interfaces over abstract classes for your public abstractions.** The reasons:

1. **Single-inheritance budget.** Every class gets exactly one base class. Spend it on an abstract class and you've blocked any *other* base. Interfaces don't consume that budget — a type can implement dozens.
2. **No coupling to implementation.** An interface promises *nothing* about internals, so consumers can't accidentally depend on inherited behavior that later changes (the fragile base class problem from Phase 4.7).
3. **Easier substitution / testing.** Anything matching the interface works — real impl, fake, mock, decorator.
4. **It's what DI containers want.** Both ASP.NET DI and NestJS DI register a *contract* and resolve an *implementation* (next section).

Reach for an **abstract class** specifically when subclasses share real implementation/state and form a true is-a family — and even then, consider exposing an *interface* as the public type and keeping the abstract class as an internal convenience. (A very common combo: `ILoanPolicy` interface for consumers + an `abstract LoanPolicyBase : ILoanPolicy` for implementers to inherit shared code from.)

---

## 6.5 Default Implementations

What happens when you want to add a method to an interface *after* implementations exist, without breaking them all? The languages diverge hard here.

### C# — default interface methods (C# 8+)

Since C# 8, an interface member can ship a **body**. Implementers get it for free and may override it. This is the closest C# comes to multiple inheritance of *behavior*.

```csharp
public interface ILoanPolicy
{
    int LoanPeriodDays();                 // still abstract — must implement

    // DEFAULT IMPLEMENTATION — bodies allowed in interfaces since C# 8.
    // Existing implementers keep compiling without writing this.
    bool IsLongTerm() => LoanPeriodDays() > 30;

    int MaxRenewals() => 2;               // a sensible default, overridable
}

public class StudentLoanPolicy : ILoanPolicy
{
    public int LoanPeriodDays() => 42;    // only the abstract member is required
    // IsLongTerm() inherited from the interface → returns true (42 > 30)
    // MaxRenewals() inherited → returns 2
}
```

Caveat: a default interface method is only callable through the **interface type**, not through the concrete class reference, unless the class also declares it:

```csharp
ILoanPolicy p = new StudentLoanPolicy();
p.IsLongTerm();                  // ✅ via interface reference
// new StudentLoanPolicy().IsLongTerm(); // ❌ not visible on the class itself
```

### TS — no default interface methods; how the gap is filled

TS interfaces are pure types with **zero runtime presence**, so they cannot carry a body. There is no `default` method. Two idiomatic fills:

```ts
// FILL 1 — abstract class with a concrete (default) method.
// Implementers extend it instead of implementing a bare interface.
interface ILoanPolicy { loanPeriodDays(): number; maxRenewals(): number; }

abstract class LoanPolicyBase implements ILoanPolicy {
  abstract loanPeriodDays(): number;
  maxRenewals(): number { return 2; }          // the "default", supplied by the base
  isLongTerm(): boolean { return this.loanPeriodDays() > 30; } // shared helper
}

class StudentLoanPolicy extends LoanPolicyBase {
  loanPeriodDays() { return 42; }              // maxRenewals/isLongTerm inherited
}
```

```ts
// FILL 2 — a mixin: a function that adds behavior to any base class.
// Useful when you can't spend the single-inheritance slot on a base.
type Ctor<T = {}> = new (...args: any[]) => T;

function WithLongTerm<TBase extends Ctor<{ loanPeriodDays(): number }>>(Base: TBase) {
  return class extends Base {
    isLongTerm(): boolean { return this.loanPeriodDays() > 30; } // mixed-in default
  };
}

class BarePolicy { loanPeriodDays() { return 42; } }
const MixedPolicy = WithLongTerm(BarePolicy);
new MixedPolicy().isLongTerm(); // true — behavior added without inheritance
```

**Summary:** C# can put defaults *on the interface*; TS puts them on an **abstract class** (the common case) or a **mixin** (when the inheritance slot is taken). Mixins are revisited under composition in Phase 9.1.

---

## 6.6 Programming to an Interface, Not an Implementation

This is the principle that makes everything above *pay off*. State it as a slogan:

> **Depend on abstractions, not concretions.**

When a high-level component (the library) holds a reference typed as `ILoanPolicy` rather than `StandardLoanPolicy`, you can swap the concrete policy without touching the library. The dependency points at a *contract*, and contracts don't change when implementations do. This is the seam that decouples your code — and it's the foundation of the Dependency Inversion Principle (Phase 7.5) and Dependency Injection.

```ts
// ❌ Programming to an IMPLEMENTATION — Library is welded to one concrete class.
class LibraryBad {
  private policy = new StandardLoanPolicy(); // hard-coded; can't swap, hard to test
  due(borrowedAt: Date) { /* uses this.policy */ }
}

// ✅ Programming to an INTERFACE — the dependency is injected as a contract.
class Library {
  constructor(private readonly policy: ILoanPolicy) {} // depends on the abstraction
  due(borrowedAt: Date): Date {
    const d = new Date(borrowedAt);
    d.setDate(d.getDate() + this.policy.loanPeriodDays());
    return d;
  }
}
// Swap freely — Library never changes:
new Library(new StandardLoanPolicy());
new Library(new StudentLoanPolicy());
new Library({ loanPeriodDays: () => 1, maxRenewals: () => 0 }); // even an inline fake (TS structural)
```

```csharp
// ✅ C# — constructor injection of the abstraction
public class Library
{
    private readonly ILoanPolicy _policy;
    public Library(ILoanPolicy policy) => _policy = policy;  // depends on the contract

    public DateTime Due(DateTime borrowedAt) => borrowedAt.AddDays(_policy.LoanPeriodDays());
}

var lib = new Library(new StudentLoanPolicy()); // pick the impl at the composition root
```

### DI preview — where this lands in the real frameworks

You don't usually `new` the implementation yourself — a **DI container** wires the contract to a concrete type at the *composition root*, then hands it to constructors. Both your tracks do exactly this:

```csharp
// ASP.NET Core (cross-ref .net/notes/04-clean-architecture.md, and 02-aspnet-basics.md §2.3)
// "When someone asks for ILoanPolicy, give them StandardLoanPolicy."
builder.Services.AddScoped<ILoanPolicy, StandardLoanPolicy>();
// Library's constructor receives an ILoanPolicy automatically — it never sees the concrete type.
```

```ts
// NestJS — bind a token (the interface) to a provider (the class)
@Module({
  providers: [
    { provide: 'ILoanPolicy', useClass: StandardLoanPolicy }, // interface→impl mapping
    Library,
  ],
})
export class LibraryModule {}

@Injectable()
export class Library {
  constructor(@Inject('ILoanPolicy') private readonly policy: ILoanPolicy) {}
}
```

> Why the string token in NestJS? Because TS interfaces are **erased at runtime** (§2.1 / §6.2) — there's no `ILoanPolicy` value left for the container to key on, so you supply an explicit token. ASP.NET doesn't need this: C# interfaces are real runtime types, so `typeof(ILoanPolicy)` *is* the key.

### The repository interface — carried into Clean Architecture

The canonical industrial use of "program to an interface" is the **Repository**: the domain/application layer declares *what* persistence it needs as an interface and depends only on that; the infrastructure layer provides the *how* (EF Core, Prisma). The dependency arrow points *inward* toward the abstraction — the entire premise of Clean Architecture (cross-ref `.net/notes/04-clean-architecture.md`).

```csharp
// Application layer — owns the CONTRACT, knows nothing about databases
public interface ILoanRepository
{
    Task<Loan?> GetByIdAsync(Guid id);
    Task AddAsync(Loan loan);
}

// Infrastructure layer — provides the CONCRETION (EF Core), depends inward on the contract
public class EfLoanRepository : ILoanRepository
{
    private readonly AppDbContext _db;
    public EfLoanRepository(AppDbContext db) => _db = db;
    public Task<Loan?> GetByIdAsync(Guid id) => _db.Loans.FindAsync(id).AsTask();
    public Task AddAsync(Loan loan) { _db.Loans.Add(loan); return _db.SaveChangesAsync(); }
}
```

```ts
// NestJS / Clean Architecture (cross-ref javascript/notes/05-clean-architecture-nest.md)
export interface ILoanRepository {
  getById(id: string): Promise<Loan | null>;
  add(loan: Loan): Promise<void>;
}

// Infrastructure implementation (Prisma) — depends on the contract, not vice versa
export class PrismaLoanRepository implements ILoanRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async getById(id: string) { return this.prisma.loan.findUnique({ where: { id } }); }
  async add(loan: Loan) { await this.prisma.loan.create({ data: loan }); }
}
```

The payoff is the same everywhere: the high-level code is **testable** (swap a fake repo), **portable** (swap EF for Prisma for an in-memory store), and **decoupled** (infrastructure can change without rippling into domain logic).

---

## Gotchas

- **Abstraction ≠ encapsulation.** Encapsulation hides one object's *insides*; abstraction hides *which concrete type* you're talking to. Don't say "abstraction" when you mean "I made the field private" (§6.1).
- **TS `implements` doesn't create assignability — the shape does.** Deleting `implements ILoanPolicy` from a TS class changes nothing about what it's assignable to. `implements` is just a compiler-checked promise. In C#, deleting `: ILoanPolicy` breaks every use site (§6.2).
- **Two same-shaped TS interfaces are interchangeable.** Structural typing means `ILoanPolicy` and an unrelated `IRentalPolicy` with identical members are the same type to TS. Use branded types when the distinction must hold (§6.2, cross-ref §2.7). C# never has this problem.
- **You can't `new` an abstract class** — but you *can* and *should* use it as a parameter/variable type. Forgetting the second half throws away the polymorphism (§6.3).
- **C# requires `override` to fill an abstract member; TS just redeclares.** Forgetting `override` in C# is a compile error; in TS there's no keyword to forget (though `noImplicitOverride` can require one) (§6.3).
- **C# default interface methods are only visible through the interface reference**, not the concrete class — surprises people expecting them to behave like inherited base-class methods (§6.5).
- **TS interfaces have zero runtime presence.** You cannot reflect over them, `instanceof` them, or use them as a DI token — hence NestJS's string/symbol `@Inject` tokens. C# interfaces are real runtime types (§6.5, §6.6).
- **"Prefer interfaces" is a default, not a law.** When implementations genuinely share state and code and form an is-a family, an abstract class is correct. The single-inheritance budget is the deciding cost (§6.4).
- **Programming to an interface only helps if you inject the implementation.** An interface-typed field that you still `new` inside the class buys you nothing — the concrete dependency is still hard-wired (§6.6).

---

## Phase 6 Exercise

**Goal:** Define an `ILoanPolicy` abstraction with three implementations — **standard**, **student**, **staff** — and make the `Library` depend **only** on the interface, never on a concrete policy. Do it in **both** languages.

**Contract:** `ILoanPolicy` should expose `loanPeriodDays()` and `maxRenewals()`. Differences to encode:

| Policy | Loan period | Max renewals |
|---|---|---|
| Standard | 21 days | 2 |
| Student | 42 days | 3 |
| Staff | 90 days | 5 |

**Requirements:**
1. `Library` takes an `ILoanPolicy` via its constructor and uses it to compute a due date and to decide whether a renewal is allowed. `Library` must contain **zero** references to any concrete policy class and **no** `if (policy is StaffLoanPolicy)`-style type checks.
2. Swap all three policies through the *same* `Library` code path and print the resulting due dates.
3. **TS only:** prove structural typing by passing an inline object literal (no class) that satisfies `ILoanPolicy` and confirm it works.
4. **C# only:** wire it through the ASP.NET DI container conceptually — write the one-line `AddScoped<ILoanPolicy, StaffLoanPolicy>()` registration and a constructor that receives it.
5. **Stretch:** add a `bool isLongTerm()` default — in C# as a *default interface method*, in TS via an `abstract LoanPolicyBase` (or a mixin). Note in writing which approach each language forced on you and why.

**TS starter:**

```ts
interface ILoanPolicy {
  loanPeriodDays(): number;
  maxRenewals(): number;
}

class StandardLoanPolicy implements ILoanPolicy { /* 21 / 2 */ }
class StudentLoanPolicy  implements ILoanPolicy { /* 42 / 3 */ }
class StaffLoanPolicy    implements ILoanPolicy { /* 90 / 5 */ }

class Library {
  constructor(private readonly policy: ILoanPolicy) {}
  dueDate(borrowedAt: Date): Date { /* borrowedAt + policy.loanPeriodDays() */ }
  canRenew(timesRenewedSoFar: number): boolean { /* < policy.maxRenewals() */ }
}

// TODO: run all three through Library; then pass an inline {loanPeriodDays, maxRenewals} literal.
```

**C# starter:**

```csharp
public interface ILoanPolicy
{
    int LoanPeriodDays();
    int MaxRenewals();
    bool IsLongTerm() => LoanPeriodDays() > 30; // stretch: default interface method
}

public class StandardLoanPolicy : ILoanPolicy { /* 21 / 2 */ }
public class StudentLoanPolicy  : ILoanPolicy { /* 42 / 3 */ }
public class StaffLoanPolicy    : ILoanPolicy { /* 90 / 5 */ }

public class Library
{
    private readonly ILoanPolicy _policy;
    public Library(ILoanPolicy policy) => _policy = policy;
    public DateTime DueDate(DateTime borrowedAt) => borrowedAt.AddDays(_policy.LoanPeriodDays());
    public bool CanRenew(int timesRenewedSoFar) => timesRenewedSoFar < _policy.MaxRenewals();
}

// TODO (conceptual DI):
// builder.Services.AddScoped<ILoanPolicy, StaffLoanPolicy>();
// builder.Services.AddScoped<Library>();
```

**Reflection prompt (write a few sentences):** Where did C#'s *nominal* typing force ceremony that TS's *structural* typing let you skip? Where did TS's structural typing cost you a safety guarantee that C# gave for free? This is the exact trade-off you'll meet again in Phase 7 (DIP) and Phase 8 (Strategy — your `ILoanPolicy` is already a Strategy).
