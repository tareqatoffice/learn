# Phase 4 — Inheritance

**Status:** In Progress
**Domain:** Media Library — `LibraryItem` → `Book` / `Audiobook` / `DVD`

> Inheritance is the most over-used pillar. This phase teaches the mechanics in both
> languages, then spends real time on *when it lies to you* — which sets up the
> composition-over-inheritance refactor in Phase 9.

---

## 4.1 What Inheritance Is — the "is-a" Relationship

Inheritance lets you derive a **specialised** type from a more **general** one. The
derived type gets the base type's state and behavior for free, then adds or changes
what makes it special.

The litmus test is the **is-a** relationship:

- A `Book` **is a** `LibraryItem`. ✅
- An `Audiobook` **is a** `LibraryItem`. ✅
- A `DVD` **is a** `LibraryItem`. ✅

All three share identity (`Id`, `Title`), shared behavior (checkout, return), and a
shared place in the catalogue. That shared core is exactly what belongs in a base class.

### When "is-a" genuinely holds vs when it's a lie

The relationship has to hold *behaviorally*, not just feel true in English.

```
GENUINE is-a                         A LIE (looks like is-a, isn't)
────────────                         ─────────────────────────────
Book        is-a LibraryItem         Stack    "is-a" List      (a Stack is NOT a List —
Audiobook   is-a LibraryItem                                    you must not index into it)
DVD         is-a LibraryItem         Square   "is-a" Rectangle (setWidth breaks the square —
                                                                the classic LSP violation)
                                     Member   "is-a" Person?    (maybe — but a Loan is NOT
                                                                a Member; that's has-a)
```

Two warning signs that an "is-a" is really a lie:

1. **You'd have to remove or forbid inherited behavior.** If `Square extends Rectangle`
   forces you to override `setWidth` so it secretly also sets the height, you've broken
   the base contract. The subtype is no longer substitutable (Liskov — Phase 7).
2. **The relationship is really "has-a" or "uses-a".** A `Loan` *has a* `Member` and
   *has a* `LibraryItem`; it is neither. Reach for a field, not `extends`.

> Rule of thumb: model the **shared role** with inheritance, model **shared parts** with
> composition. We'll see in 4.7 that even our clean `LibraryItem` hierarchy starts to
> strain.

---

## 4.2 Extending a Class

The syntax differs; the idea is identical — declare that one class builds on another.

**TypeScript** — `extends`:

```ts
class LibraryItem {
  constructor(
    public readonly id: string,
    public title: string,
  ) {}

  describe(): string {
    return `${this.title} (#${this.id})`;
  }
}

class Book extends LibraryItem {
  constructor(
    id: string,
    title: string,
    public author: string,
    public pageCount: number,
  ) {
    super(id, title); // must call base ctor first — see 4.3
  }
}
```

**C#** — the colon `:`:

```csharp
public class LibraryItem
{
    public string Id { get; }
    public string Title { get; set; }

    public LibraryItem(string id, string title)
    {
        Id = id;
        Title = title;
    }

    public string Describe() => $"{Title} (#{Id})";
}

public class Book : LibraryItem        // ": Base" is both "extends" and "implements"
{
    public string Author { get; set; }
    public int PageCount { get; set; }

    public Book(string id, string title, string author, int pageCount)
        : base(id, title)              // call base ctor — see 4.3
    {
        Author = author;
        PageCount = pageCount;
    }
}
```

> Divergence: in C# the single `:` is overloaded — it introduces the base class **and**
> any interfaces (`class Book : LibraryItem, IComparable<Book>`). The base class, if
> present, must come first. TS keeps them separate: `extends Base implements IFoo`.

### Inherited member accessibility — what's visible in the subclass

The access modifier on a base member decides whether the derived class can touch it.

| Modifier | Visible in derived class? | Visible to outside callers? |
|----------|---------------------------|------------------------------|
| `public` | yes | yes |
| `protected` | **yes** | no |
| `private` (C#) / `#field` (JS) | **no** — truly hidden, even from subclasses | no |
| `private` (TS, compile-time) | no (compiler blocks it) — but present at runtime | no (compiler) |
| `internal` (C#) | yes, if in the same assembly | same-assembly only |

`protected` is the key inheritance tool: "part of the family's internal contract, but
not the public API." We use it for extension points in 4.5.

```ts
class LibraryItem {
  #serialNumber: string;            // truly private — Book cannot see it
  protected loanCount = 0;          // Book CAN see and bump this
  public title: string;

  constructor(serial: string, title: string) {
    this.#serialNumber = serial;
    this.title = title;
  }
}

class Book extends LibraryItem {
  checkout() {
    this.loanCount++;               // ✅ protected — accessible
    // this.#serialNumber;          // ❌ private field — not in scope here
  }
}
```

```csharp
public class LibraryItem
{
    private string _serialNumber;   // hidden from Book entirely
    protected int LoanCount;        // Book can read/write
    public string Title { get; set; }

    public LibraryItem(string serial, string title)
    {
        _serialNumber = serial;
        Title = title;
    }
}

public class Book : LibraryItem
{
    public Book(string serial, string title) : base(serial, title) { }

    public void Checkout()
    {
        LoanCount++;                // ✅ protected
        // _serialNumber;          // ❌ private to LibraryItem
    }
}
```

---

## 4.3 Constructors, `super` and `base`

A derived object is built **base-part-first**. Before `Book` can initialise *its* fields,
the `LibraryItem` slice of the object must already exist. Both languages enforce this — you
must call the base constructor.

- **TS/JS:** `super(...)` — and you **must** call it before touching `this`.
- **C#:** `: base(...)` in the constructor header (runs before the body).

```ts
class Book extends LibraryItem {
  constructor(id: string, title: string, public author: string) {
    // console.log(this.title);  // ❌ ReferenceError — `this` not allowed before super()
    super(id, title);            // base slice initialised first
    this.author = author;        // now `this` is legal
  }
}
```

```csharp
public class Book : LibraryItem
{
    public string Author { get; set; }

    public Book(string id, string title, string author)
        : base(id, title)        // runs BEFORE this constructor's body
    {
        Author = author;
    }
}
```

If you omit the call, the language tries to call the base's **parameterless** constructor.
In C# that's a compile error when no parameterless base ctor exists. In TS, omitting
`super()` in a subclass constructor is a compile error outright.

### Initialisation order up the chain

For a three-level chain `LibraryItem` → `Book` → `SignedBook`, construction walks
**down to the base, then unwinds back up**:

```
new SignedBook(...)
        │
        ▼  SignedBook ctor starts → calls super()/base()
        ▼  Book ctor starts        → calls super()/base()
        ▼  LibraryItem ctor RUNS first (base fields set)
        ▲  ...back into Book ctor body  (Book fields set)
        ▲  ...back into SignedBook body (SignedBook fields set)
        ✓  fully-constructed object
```

The base is *fully initialised before* the derived constructor body runs. That's why a
base constructor can safely call methods the subclass overrides — though doing so is a
trap (see Gotchas: virtual calls from constructors).

C# also has field/property **initialisers**, and their order is worth knowing: derived
field initialisers run *before* the base constructor body, but *after* the base field
initialisers. In practice, prefer initialising in the constructor to avoid surprises.

---

## 4.4 Overriding Behavior

Overriding = a subclass **replaces** an inherited method with its own implementation,
and that replacement is chosen at runtime based on the object's actual type. This is the
engine of polymorphism (Phase 5).

### C# — explicit opt-in: `virtual` / `override` / `new`

C# methods are **non-virtual by default**. The base must *permit* overriding with
`virtual` (or `abstract`), and the subclass must *announce* it with `override`.

```csharp
public class LibraryItem
{
    public string Title { get; set; } = "";

    public virtual int LoanDurationDays() => 21;   // virtual = "subclasses may override"
    public string Describe() => $"{Title}: {LoanDurationDays()} day loan";
}

public class DVD : LibraryItem
{
    public override int LoanDurationDays() => 7;    // override = "I am replacing it"
}

LibraryItem item = new DVD { Title = "Dune" };
Console.WriteLine(item.LoanDurationDays());          // 7  — runtime dispatch
Console.WriteLine(item.Describe());                  // "Dune: 7 day loan"
```

`base.Method()` calls the parent version (handy for "do the default, then extend"):

```csharp
public class Audiobook : LibraryItem
{
    public override int LoanDurationDays() => base.LoanDurationDays() + 7; // 21 + 7 = 28
}
```

### `new` — shadowing (almost never what you want)

`new` hides the base method instead of overriding it. The version called now depends on
the **variable's compile-time type**, not the object's real type — the opposite of
polymorphism. This silently breaks subtype behavior.

```csharp
public class Book : LibraryItem
{
    public new int LoanDurationDays() => 14;   // SHADOWS, does not override
}

Book asBook       = new Book { Title = "X" };
LibraryItem asBase = asBook;

Console.WriteLine(asBook.LoanDurationDays());   // 14 — calls Book's hidden version
Console.WriteLine(asBase.LoanDurationDays());   // 21 — calls LibraryItem's! (wrong-looking)
```

> Treat `new` shadowing as a code smell. If you wanted different behavior, you wanted
> `override`. The compiler even warns you when you forget `new` — that warning means
> "you accidentally shadowed; you probably meant `override`."

### TS/JS — every method is virtual

There is no `virtual`/`override` keyword machinery. Every method lives on the prototype,
and a subclass method with the same name simply replaces it in the lookup chain. Dispatch
is always based on the real object.

```ts
class LibraryItem {
  title = "";
  loanDurationDays(): number { return 21; }
  describe(): string { return `${this.title}: ${this.loanDurationDays()} day loan`; }
}

class DVD extends LibraryItem {
  loanDurationDays(): number { return 7; }            // just redeclare — it overrides
}

class Audiobook extends LibraryItem {
  loanDurationDays(): number { return super.loanDurationDays() + 7; } // super.method()
}

const item: LibraryItem = new DVD();
item.title = "Dune";
console.log(item.loanDurationDays());                  // 7 — dispatch on real type
```

TS 4.3+ offers an **opt-in** `override` keyword (with `noImplicitOverride`) that's purely
a compile-time safety check — it does nothing at runtime, it just yells if you typo the
method name or the base method disappears:

```ts
class DVD extends LibraryItem {
  override loanDurationDays(): number { return 7; } // compiler verifies a base method exists
}
```

### Overriding vs overloading vs shadowing — don't confuse them

| Term | What it means | TS | C# |
|------|---------------|----|----|
| **Override** | Replace a base method; dispatched on the **runtime** type | redeclare same name | `virtual` + `override` |
| **Overload** | Same name, **different parameter lists** in the *same* class; chosen at **compile time** | overload *signatures* only (one impl) | true overloading (multiple impls) |
| **Shadow / hide** | Subclass member hides base member; dispatched on the **compile-time** type | not a first-class concept | `new` modifier |

```csharp
// Overloading — same name, different signatures, resolved at compile time
public class Catalogue
{
    public LibraryItem Find(string title) => /* ... */ null!;
    public LibraryItem Find(int index)    => /* ... */ null!;  // different param type
}
```

```ts
// TS overloading is just multiple signatures over ONE implementation
class Catalogue {
  find(title: string): LibraryItem;
  find(index: number): LibraryItem;
  find(arg: string | number): LibraryItem {
    return typeof arg === "string" ? /* by title */ null! : /* by index */ null!;
  }
}
```

---

## 4.5 The Inheritance Chain & Method Resolution

When you call `item.loanDurationDays()`, the runtime has to find *which* implementation to
run. Both languages walk a chain — but the machinery differs.

```
        Chain for: new Audiobook().describe()

   Audiobook  ──has?── describe()   no  ─┐
       │ extends                          │ walk up
   LibraryItem ─has?── describe()   YES ◄─┘   ← runs here
       │ extends
    Object / object base
```

### C# — the vtable (virtual method table)

For `virtual`/`override` methods, the compiler builds a **vtable** per type: an array of
function pointers, one slot per virtual method. Each object header points at its type's
vtable. A virtual call is "look up the slot index, jump to whatever pointer is there" —
the derived type's vtable has the overriding pointer in that slot, so the right method
runs. This is O(1) and resolved at *runtime* but with near-zero overhead.

Non-virtual methods skip the vtable entirely — the call target is baked in at compile
time (which is exactly why `new`-shadowed methods dispatch on the static type).

### JS — the prototype chain

JS has no vtable. `item.loanDurationDays()` does a **prototype-chain lookup**: check the
object's own properties, then `Object.getPrototypeOf(it)`, then *its* prototype, up to
`Object.prototype`, then `null`. `class Audiobook extends LibraryItem` wires
`Audiobook.prototype`'s prototype to be `LibraryItem.prototype`, so the walk finds the
nearest definition first.

> Cross-reference: `javascript/notes/01-js-internals.md` §1.4 covers this in depth —
> `class` is sugar over `Object.setPrototypeOf(Dog.prototype, Animal.prototype)`, and V8
> speeds up the repeated lookup with **inline caches** (the JS equivalent of a vtable's
> fast path). The big difference from C#: the prototype chain is **mutable at runtime**,
> whereas a .NET class hierarchy is fixed at compile time.

```
C# vtable                         JS prototype chain
─────────                         ──────────────────
[type] → [vtable]                 obj → __proto__ → __proto__ → ... → null
          [0] LoanDurationDays ●    │      │            │
          [1] Describe         ●    │   Audiobook    LibraryItem
fixed slots, O(1) jump            .prototype     .prototype   (dynamic walk, IC-cached)
```

### `protected` members as extension points

`protected` is how a base class deliberately offers subclasses a hook without exposing it
publicly. The base controls the *flow*; subclasses fill in the *gaps*. (This is the seed
of the Template Method pattern — Phase 8.)

```ts
abstract class LibraryItem {
  protected abstract baseLoanDays(): number;   // subclass extension point
  protected condition: "new" | "worn" = "new"; // shared protected state

  // Public flow uses the protected hook + protected state
  loanDurationDays(): number {
    const penalty = this.condition === "worn" ? -3 : 0;
    return this.baseLoanDays() + penalty;
  }
}

class DVD extends LibraryItem {
  protected baseLoanDays(): number { return 7; }
}
```

```csharp
public abstract class LibraryItem
{
    protected abstract int BaseLoanDays();          // extension point
    protected string Condition { get; set; } = "new";

    public int LoanDurationDays()
    {
        var penalty = Condition == "worn" ? -3 : 0;
        return BaseLoanDays() + penalty;            // base owns the flow
    }
}

public class DVD : LibraryItem
{
    protected override int BaseLoanDays() => 7;
}
```

---

## 4.6 Controlling Inheritance

Sometimes the right call is to **stop** inheritance — to say "this is the end of the line"
or "this method may not be re-overridden."

### C# — `sealed`

`sealed` on a class forbids deriving from it. `sealed` on an overriding method stops
*further* overrides down the chain (you can only seal a method you are currently
overriding).

```csharp
public sealed class DVD : LibraryItem        // nothing may extend DVD
{
    public override int LoanDurationDays() => 7;
}

// public class SpecialDVD : DVD { }         // ❌ compile error — DVD is sealed

public class Book : LibraryItem
{
    // seal the override so subclasses of Book can't change it again
    public sealed override int LoanDurationDays() => 14;
}
```

Why seal? Intent ("this type isn't designed to be a base"), a tiny perf win (sealed
virtual calls can be devirtualised), and protecting an invariant from a careless subclass.

### TS/JS — no `sealed` keyword; patterns instead

TS/JS has no `sealed`/`final`. Common approximations:

```ts
// 1. A runtime guard in the constructor: forbid further subclassing
class DVD extends LibraryItem {
  constructor(id: string, title: string) {
    super(id, title);
    if (new.target !== DVD) {
      throw new Error("DVD is final and cannot be subclassed");
    }
  }
}

// 2. Convention: don't export the class, only a factory function
export function createDvd(id: string, title: string): LibraryItem { /* ... */ return null!; }

// 3. Object.freeze(DVD.prototype) — prevents method tampering, not subclassing
```

In practice TS leans on convention and code review here; the language won't enforce it.

### Abstract base classes — a preview of Phase 6

The opposite of sealing: a class that *must* be inherited. An **abstract** class can't be
instantiated and can declare **abstract** members that subclasses are forced to implement.
It's the natural home for `LibraryItem`, since "a generic library item" isn't a real thing
you'd ever stock — only books, audiobooks, and DVDs are.

```csharp
public abstract class LibraryItem
{
    public string Title { get; set; } = "";
    public abstract string MediaType { get; }     // no body — subclass MUST provide
    public abstract int LoanDurationDays();        // no body — subclass MUST provide
    public string Describe() => $"[{MediaType}] {Title}"; // concrete, shared
}

// var x = new LibraryItem();   // ❌ cannot instantiate an abstract class

public class Book : LibraryItem
{
    public override string MediaType => "Book";
    public override int LoanDurationDays() => 21;
}
```

```ts
abstract class LibraryItem {
  title = "";
  abstract get mediaType(): string;       // must be implemented
  abstract loanDurationDays(): number;    // must be implemented
  describe(): string { return `[${this.mediaType}] ${this.title}`; } // shared
}

// new LibraryItem();   // ❌ TS2511: Cannot create an instance of an abstract class

class Book extends LibraryItem {
  get mediaType() { return "Book"; }
  loanDurationDays() { return 21; }
}
```

> Full treatment of abstract classes vs interfaces — and C#'s nominal vs TS's structural
> interfaces — is Phase 6. For now: abstract class = shared identity + partial
> implementation you're forced to complete.

---

## 4.7 When Inheritance Hurts

Inheritance is the tightest coupling in OOP: a subclass depends on the base's *public
and protected surface, its initialisation order, and even its internal call patterns.*
That coupling causes recurring pain.

### The fragile base class problem

A change to the base — perfectly reasonable in isolation — silently breaks subclasses you
didn't even open. Classic example: the base refactors one method to call another, and a
subclass that overrode *both* now double-counts.

```csharp
public class LibraryItem
{
    protected List<string> Tags = new();

    public virtual void AddTag(string tag) => Tags.Add(tag);

    // Later "improvement": batch-add reuses AddTag for consistency
    public virtual void AddTags(IEnumerable<string> tags)
    {
        foreach (var t in tags) AddTag(t);   // ← now routes through AddTag
    }
}

public class Book : LibraryItem
{
    // Book overrode AddTag to also log. After the base change, AddTags now
    // logs once per tag too — behavior the base author never intended.
    public override void AddTag(string tag)
    {
        Console.WriteLine($"Tagging: {tag}");
        base.AddTag(tag);
    }
}
```

Nothing in `Book` changed, yet `Book`'s behavior changed. That's fragility: the base's
*internal* decisions leaked through the inheritance seam.

### Deep hierarchies and tight coupling

Each level adds coupling and cognitive load. By the time you're at
`LibraryItem → DigitalItem → StreamableItem → Audiobook`, understanding `Audiobook`
means reading four files, and changing any ancestor risks all descendants. Deep trees
are also rigid: a new requirement that cuts *across* the tree (e.g. "some books are also
streamable") has no clean home — single inheritance forces an awkward choice.

```
Shallow & flexible              Deep & brittle
──────────────────              ──────────────
LibraryItem                     LibraryItem
├── Book                        └── PhysicalItem
├── Audiobook                       └── PrintedItem
└── DVD                                 └── PagedItem
                                            └── Book   ← what does each layer even add?
```

### The "banana → gorilla → jungle" problem

> "You wanted a banana, but what you got was a gorilla holding the banana — and the
> entire jungle." — Joe Armstrong

When you inherit, you don't get the one method you wanted; you get **everything** the base
exposes, plus its dependencies, plus its assumptions. Extend `LibraryItem` just to reuse
its `describe()` formatting, and you've also signed up for its loan logic, its tag list,
its construction requirements, and every future method someone adds to it. You took the
jungle to get the banana.

```ts
// I only wanted formatTitle()... but `extends` drags in the whole base contract.
class PromoBanner extends LibraryItem {   // a banner is NOT a library item!
  render() {
    return this.describe();               // ← the one thing I wanted
  }
  // ...and now PromoBanner also "has" loanDurationDays, tags, id, checkout — nonsense.
}

// Better: just use the function/part you need (composition — Phase 9)
class PromoBannerBetter {
  constructor(private formatter: { describe(): string }) {}
  render() { return this.formatter.describe(); }
}
```

### Foreshadowing: composition over inheritance (Phase 9)

The fix for most of the above is **"has-a" instead of "is-a"** — give an object the
behavior it needs as a *collaborator* (a field) rather than inheriting it. Composition is
looser coupling, mix-and-match (a thing can be `Loanable` *and* `Streamable` without a
brittle tree), and no jungle. Phase 9 refactors the strained parts of this very hierarchy
into composition. Keep that in mind as you do the exercise below — you'll be asked to
*spot* the strain now and *fix* it later.

---

## Gotchas

- **C# methods are non-virtual by default; JS/TS methods are always virtual.** If you
  "override" in C# without `virtual` on the base and `override` on the child, you've
  silently *shadowed* (`new`), and calls through a base reference run the *base* version.
  This bites every JS dev moving to C#.
- **Calling a virtual/overridable method from a constructor is a trap.** The base ctor
  runs *before* the derived ctor body, so an overridden method may execute against
  half-initialised derived state (its fields still default/`undefined`). Avoid virtual
  calls in constructors in both languages.
- **`super()` must come before `this` in a TS subclass constructor** — accessing `this`
  first is a runtime `ReferenceError`, not just a type error.
- **C# `new`-shadowing dispatches on the *variable* type, not the object.** `LibraryItem x
  = new Book()` calls `LibraryItem`'s shadowed method. Almost always a bug; the compiler
  warns you (that warning = "you meant `override`").
- **TS `private` is compile-time only.** A subclass is blocked by the compiler but the
  field is fully present at runtime (and reachable via `obj["field"]`). Use `#private` for
  real, runtime-enforced hiding that even subclasses can't reach.
- **TS `override` keyword does nothing at runtime** — it's a compile-time guard. Worth
  turning on `noImplicitOverride` so renames/removals in the base are caught.
- **C# `protected` members are accessible to subclasses *and* widen your contract.**
  Anything `protected` is now something every subclass (forever) may depend on — treat it
  as carefully as `public`.
- **You can't `: base(...)` *and* `: this(...)` at once** in C# — a constructor chains to
  exactly one. Same in TS: one `super()` call.
- **Deep hierarchies break single inheritance.** When a requirement cuts across the tree
  ("some books stream, some DVDs don't"), there's no clean inheritance answer — that's the
  signal to reach for interfaces (Phase 6) and composition (Phase 9).

---

## Phase 4 Exercise

**Goal:** Model `LibraryItem` → `Book` / `Audiobook` / `DVD` with a real base class in
**both** languages, using an abstract base, a protected extension point, `super`/`base`
constructor chaining, and at least one override. Then write the "where it's already
strained" note that sets up Phase 9.

### TypeScript

```ts
abstract class LibraryItem {
  protected loanCount = 0;

  constructor(
    public readonly id: string,
    public title: string,
  ) {}

  // Extension point — each medium decides its own base loan window
  protected abstract baseLoanDays(): number;
  abstract get mediaType(): string;

  // Shared flow, written once, reused by all subtypes
  loanDurationDays(): number {
    return this.baseLoanDays();
  }

  checkout(): void {
    this.loanCount++;
  }

  describe(): string {
    return `[${this.mediaType}] "${this.title}" — ${this.loanDurationDays()}d loan`;
  }
}

class Book extends LibraryItem {
  constructor(
    id: string,
    title: string,
    public author: string,
    public pageCount: number,
  ) {
    super(id, title);
  }
  get mediaType() { return "Book"; }
  protected baseLoanDays() { return 21; }
}

class Audiobook extends LibraryItem {
  constructor(
    id: string,
    title: string,
    public narrator: string,
    public durationMinutes: number,
  ) {
    super(id, title);
  }
  get mediaType() { return "Audiobook"; }
  protected baseLoanDays() { return 14; }
}

class DVD extends LibraryItem {
  constructor(
    id: string,
    title: string,
    public runtimeMinutes: number,
    public rating: string,
  ) {
    super(id, title);
  }
  get mediaType() { return "DVD"; }
  protected baseLoanDays() { return 7; }
}

// Polymorphism preview (Phase 5): one loop, many behaviors
const catalogue: LibraryItem[] = [
  new Book("b1", "Dune", "Herbert", 412),
  new Audiobook("a1", "Project Hail Mary", "Ray Porter", 960),
  new DVD("d1", "Blade Runner", 117, "R"),
];
for (const item of catalogue) console.log(item.describe());
// [Book] "Dune" — 21d loan
// [Audiobook] "Project Hail Mary" — 14d loan
// [DVD] "Blade Runner" — 7d loan
```

### C#

```csharp
public abstract class LibraryItem
{
    protected int LoanCount;

    public string Id { get; }
    public string Title { get; set; }

    protected LibraryItem(string id, string title)   // protected: only subclasses construct
    {
        Id = id;
        Title = title;
    }

    protected abstract int BaseLoanDays();           // extension point
    public abstract string MediaType { get; }

    public virtual int LoanDurationDays() => BaseLoanDays();

    public void Checkout() => LoanCount++;

    public string Describe() =>
        $"[{MediaType}] \"{Title}\" — {LoanDurationDays()}d loan";
}

public class Book : LibraryItem
{
    public string Author { get; set; }
    public int PageCount { get; set; }

    public Book(string id, string title, string author, int pageCount)
        : base(id, title)
    {
        Author = author;
        PageCount = pageCount;
    }

    public override string MediaType => "Book";
    protected override int BaseLoanDays() => 21;
}

public class Audiobook : LibraryItem
{
    public string Narrator { get; set; }
    public int DurationMinutes { get; set; }

    public Audiobook(string id, string title, string narrator, int durationMinutes)
        : base(id, title)
    {
        Narrator = narrator;
        DurationMinutes = durationMinutes;
    }

    public override string MediaType => "Audiobook";
    protected override int BaseLoanDays() => 14;
}

public class DVD : LibraryItem
{
    public int RuntimeMinutes { get; set; }
    public string Rating { get; set; }

    public DVD(string id, string title, int runtimeMinutes, string rating)
        : base(id, title)
    {
        RuntimeMinutes = runtimeMinutes;
        Rating = rating;
    }

    public override string MediaType => "DVD";
    protected override int BaseLoanDays() => 7;
}

// Polymorphism preview (Phase 5)
var catalogue = new List<LibraryItem>
{
    new Book("b1", "Dune", "Herbert", 412),
    new Audiobook("a1", "Project Hail Mary", "Ray Porter", 960),
    new DVD("d1", "Blade Runner", 117, "R"),
};
foreach (var item in catalogue)
    Console.WriteLine(item.Describe());
```

### Where the hierarchy already feels strained (sets up Phase 9)

Write a short note in your own words. Things to notice — at least one of these is already
true in the model above:

1. **`Audiobook` is in the wrong dimension.** A `Book` and an `Audiobook` of the same
   novel share *everything content-wise* (title, author, ISBN) and differ only in
   **format**. Forcing them into sibling subclasses duplicates that shared data and makes
   "the audiobook edition of this book" impossible to express through inheritance. Format
   feels like a **has-a** (`item.format`), not an **is-a**.

2. **Cross-cutting capabilities have no home.** Suppose *some* items are downloadable
   (audiobook, some DVDs) and *some* are reservable and *some* incur damage fees (physical
   only). These are independent axes. Single inheritance can model exactly one axis;
   the rest become either a bloated base (every item "has" download logic it ignores) or a
   combinatorial explosion of subclasses (`DownloadableReservableDVD`). That's the
   banana→gorilla→jungle smell appearing in our own domain.

3. **`loanDurationDays` only varies by a constant.** The entire reason we built the
   abstract `baseLoanDays()` hook is a single integer. A `Map`/`Dictionary` of policies —
   or a `LoanPolicy` collaborator passed in (composition) — would carry that data without
   a class hierarchy at all. We over-reached for inheritance to vary *data*.

**Phase 9 promise:** we'll refactor `format` and the cross-cutting capabilities into
composition (`item.format`, an `ILoanPolicy` strategy, `Downloadable`/`Reservable` as
delegated parts), and `LibraryItem` will shrink to just the genuinely shared identity.
