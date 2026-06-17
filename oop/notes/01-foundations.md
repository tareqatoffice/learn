# Phase 1 — OOP Foundations & Mental Model

**Status:** In Progress
**Started:** 2026-06-17

> You've written classes for years. This phase isn't about syntax — it's about the *discipline*: what OOP actually is, the problem it was invented to solve, and the mental model that makes the next eight phases click. Every idea is shown in **TypeScript and C#**, because the contrast is the lesson.

---

## 1.1 What OOP Is and Why It Exists

### The core idea: bundle state + behavior

Object-Oriented Programming is one answer to a single question: **how do you organise a large program so it doesn't collapse under its own weight?**

OOP's answer: take the **data** (state) and the **operations on that data** (behavior) and glue them together into one unit — an **object**. Instead of "here is some data, and over there are a hundred functions that might touch it," you get "here is a thing that knows its own data and knows how to act on it."

```
Procedural mindset                  OOP mindset
──────────────────                  ───────────
  data ─────┐                         ┌─────────────────┐
  data ─────┼──► functions            │  Object         │
  data ─────┘    (anyone can          │  ┌───────────┐  │
                  touch any data)     │  │ state     │  │  ← data lives INSIDE
                                      │  ├───────────┤  │
                                      │  │ behavior  │  │  ← functions that
                                      │  └───────────┘  │     own that data
                                      └─────────────────┘
```

That bundling is the whole seed. Everything else in OOP — encapsulation, inheritance, polymorphism, abstraction, SOLID, design patterns — grows out of "state and behavior travel together."

### Procedural vs OOP — the same program, both ways

Let's make it concrete with a tiny bank account. First, **procedural** — data and functions are separate, and nothing stops anyone from mutating the data directly.

```typescript
// ----- PROCEDURAL (TypeScript) -----
// State is a plain bag of data...
type Account = { balance: number };

// ...and behavior is free-floating functions that take the data as an argument.
function deposit(acc: Account, amount: number): void {
  acc.balance += amount;
}
function withdraw(acc: Account, amount: number): void {
  acc.balance -= amount; // nothing checks for overdraft here
}

const acc: Account = { balance: 100 };
deposit(acc, 50);
acc.balance = -9999;     // ⚠️ nothing stops this — the data is wide open
withdraw(acc, 1_000_000); // ⚠️ overdraft, silently allowed
```

```csharp
// ----- PROCEDURAL (C#) -----
// A struct/record used as a dumb data bag, with static helper functions.
record Account { public decimal Balance; }   // mutable field, fully exposed

static class AccountOps
{
    public static void Deposit(Account acc, decimal amount) => acc.Balance += amount;
    public static void Withdraw(Account acc, decimal amount) => acc.Balance -= amount; // no rules
}

var acc = new Account { Balance = 100 };
AccountOps.Deposit(acc, 50);
acc.Balance = -9999;                 // ⚠️ anyone can corrupt the state
AccountOps.Withdraw(acc, 1_000_000); // ⚠️ overdraft allowed
```

Now the **same program in OOP**. The data moves *inside* the object, becomes private, and the only way to change it is through methods that enforce the rules.

```typescript
// ----- OOP (TypeScript) -----
class Account {
  #balance: number;                  // #private — truly hidden, even at runtime

  constructor(initial: number) {
    if (initial < 0) throw new Error("Initial balance can't be negative");
    this.#balance = initial;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Deposit must be positive");
    this.#balance += amount;
  }

  withdraw(amount: number): void {
    if (amount > this.#balance) throw new Error("Insufficient funds"); // rule enforced HERE
    this.#balance -= amount;
  }

  get balance(): number { return this.#balance; } // read-only window onto the state
}

const acc = new Account(100);
acc.deposit(50);
// acc.#balance = -9999;          // ❌ compile error AND runtime error — can't reach it
// acc.withdraw(1_000_000);       // throws "Insufficient funds" — the object protects itself
```

```csharp
// ----- OOP (C#) -----
public class Account
{
    private decimal _balance;                       // private — invisible from outside

    public Account(decimal initial)
    {
        if (initial < 0) throw new ArgumentException("Initial balance can't be negative");
        _balance = initial;
    }

    public void Deposit(decimal amount)
    {
        if (amount <= 0) throw new ArgumentException("Deposit must be positive");
        _balance += amount;
    }

    public void Withdraw(decimal amount)
    {
        if (amount > _balance) throw new InvalidOperationException("Insufficient funds");
        _balance -= amount;
    }

    public decimal Balance => _balance;             // expression-bodied read-only property
}

var acc = new Account(100);
acc.Deposit(50);
// acc._balance = -9999;     // ❌ compile error — _balance is private
// acc.Withdraw(1_000_000);  // throws InvalidOperationException
```

**What actually changed?** Not the feature set — both versions deposit and withdraw. What changed is *where the rules live and who can break them*:

| | Procedural | OOP |
|---|---|---|
| Where is the state? | In the open, anyone can touch it | Hidden inside the object |
| Where do the rules live? | Scattered across functions (and easy to skip) | Centralised in the object's methods |
| Can the data go invalid? | Yes — direct assignment bypasses everything | No — the object guards its own invariants |
| To understand "how balance changes" | Grep the whole codebase | Read one class |

That last row is the real payoff: **the object becomes the single source of truth for its own correctness.**

### The problems OOP set out to solve

OOP (Simula in the '60s, Smalltalk in the '70s, then C++/Java/C#) was a response to programs getting too big to reason about. The specific problems:

- **Managing complexity.** A 100k-line procedural program is a web of functions all reaching into shared global data. OOP draws boundaries: each object owns a small slice of state, so you reason about one object at a time instead of the whole web.
- **Modeling the real world.** Domains are full of "things" — a `Customer`, an `Order`, a `Loan`. Objects let your code's structure mirror the problem's structure, which makes it easier to map requirements to code.
- **Code reuse.** Inheritance and polymorphism let you write a behavior once and specialise it, instead of copy-pasting. (Modern OOP leans more on *composition* for reuse — Phase 9 — but reuse was a founding motivation.)
- **Localising change.** If the rules for changing a balance live in one class, changing those rules touches one file. Encapsulation turns "change ripples everywhere" into "change stays put."

### Why TS and C# are multi-paradigm, not "pure OOP"

Some languages take "everything is an object" literally. In **Smalltalk** and **Ruby**, even `5` is an object you send messages to. There's no other way to compute — OOP isn't a choice, it's the substrate.

TypeScript and C# are **not** like that. They are *multi-paradigm*: OOP is one tool among several.

- **TypeScript** is JavaScript with types. JS started as a scripting language with first-class functions and prototypes; classes came later as sugar (see `../../javascript/notes/01-js-internals.md` §1.4). You can write an entire TS program with nothing but functions and plain objects — no `class` keyword in sight.
- **C#** started OOP-centric (everything lives in a class), but over 20 years absorbed heavy **functional** features: LINQ, lambdas, `record` types, pattern matching, immutability helpers. Idiomatic modern C# freely mixes objects and functional pipelines.

```typescript
// Perfectly valid, idiomatic TypeScript — zero classes, pure functions
const total = orders
  .filter(o => o.status === "paid")
  .map(o => o.amount)
  .reduce((sum, a) => sum + a, 0);
```

```csharp
// Perfectly valid, idiomatic C# — functional LINQ pipeline, no custom class needed
var total = orders
    .Where(o => o.Status == "paid")
    .Select(o => o.Amount)
    .Sum();
```

> **Takeaway:** In TS and C#, OOP is a *choice you make when it pays off*, not a law you obey. A big chunk of this course's later wisdom (Phases 4, 9) is learning *when* to reach for objects and when functions are simply better.

---

## 1.2 Objects and Classes — The Core Idea

### Class = blueprint, object = instance

A **class** is a description of a kind of thing — what state it holds and what it can do. It is not the thing itself. An **object** (or *instance*) is a concrete thing built from that blueprint, with its own actual data.

```
   class Book              (the blueprint — exists once, defines structure)
        │  new()
        ├──────────────► book1  { title: "Dune",   isbn: "...111" }   (instance)
        ├──────────────► book2  { title: "1984",   isbn: "...222" }   (instance)
        └──────────────► book3  { title: "Hobbit", isbn: "...333" }   (instance)

   One blueprint, many independent instances — each with its own state.
```

A house analogy that sticks: the **class** is the architectural drawing; the **objects** are the actual houses built from it. Many houses, one drawing. Repainting one house's door doesn't touch the others.

```typescript
// TypeScript — define the blueprint once...
class Book {
  constructor(
    public readonly title: string,
    public readonly isbn: string,
  ) {}
}

// ...stamp out independent instances
const b1 = new Book("Dune", "111");
const b2 = new Book("1984", "222");
console.log(b1.title); // "Dune"
console.log(b2.title); // "1984" — b1 and b2 are separate objects
```

```csharp
// C# — same idea
public class Book
{
    public string Title { get; }
    public string Isbn { get; }
    public Book(string title, string isbn) => (Title, Isbn) = (title, isbn);
}

var b1 = new Book("Dune", "111");
var b2 = new Book("1984", "222");
Console.WriteLine(b1.Title); // "Dune"
Console.WriteLine(b2.Title); // "1984"
```

### Identity vs equality

This trips up everyone coming from data-bag thinking. Two distinct questions:

- **Identity:** "Are these the *same object* — the same thing in memory?"
- **Equality:** "Do these two objects *hold the same data*?"

Two objects can have byte-for-byte identical data and still be **different objects**. Two `Book("Dune", "111")` instances are *equal in content* but are *not the same object* — they occupy different memory, and changing one doesn't change the other.

```typescript
// TypeScript — by default, === is IDENTITY (same reference), not content equality
const a = new Book("Dune", "111");
const b = new Book("Dune", "111");
const c = a;

console.log(a === b); // false — different objects, even though same data (IDENTITY)
console.log(a === c); // true  — c is the SAME object as a (same reference)

// Content equality is something YOU must define:
function sameBook(x: Book, y: Book): boolean {
  return x.isbn === y.isbn; // your rule for "equal"
}
console.log(sameBook(a, b)); // true — same content
```

```csharp
// C# — class: == is IDENTITY by default (reference equality)
var a = new Book("Dune", "111");
var b = new Book("Dune", "111");
var c = a;

Console.WriteLine(a == b); // false — different objects (IDENTITY)
Console.WriteLine(a == c); // true  — same reference
Console.WriteLine(ReferenceEquals(a, b)); // false — explicit identity check

// BUT: a `record` opts into VALUE (content) equality automatically:
public record BookRec(string Title, string Isbn);
var x = new BookRec("Dune", "111");
var y = new BookRec("Dune", "111");
Console.WriteLine(x == y); // true — record compares CONTENT, not reference
```

> **Divergence to file away:** C# `class` → reference equality; C# `record` → value equality (it auto-generates `Equals`/`GetHashCode`). TypeScript has no built-in value equality at all — `===` is always identity for objects, and you compare content by hand or with a library. This connects to Phase 2.7 (reference vs value semantics).

### The "little machine" mental model

Here is the model to carry through the entire course. **An object is a little machine.** It has:

- **Internal state** — gauges, dials, and tanks *inside* the casing that you can't reach directly.
- **A public interface** — the buttons and readouts on the *outside* that you're allowed to press and read.

You operate a vending machine through its buttons (`insertCoin`, `selectItem`). You don't pry open the casing and yank the dispensing motor. The internal mechanism is the object's *private state*; the buttons are its *public methods*.

```
        ┌─────────── Account (the machine) ───────────┐
        │                                             │
  press │   PUBLIC INTERFACE (the buttons/readouts)   │
  ──────┼──►  deposit()  withdraw()  balance ─────────┼──► read
        │   ─────────────────────────────────────     │
        │   PRIVATE STATE (sealed inside the casing)   │
        │       #balance = 150   ← you can't reach     │
        │                          this directly       │
        └─────────────────────────────────────────────┘
```

```typescript
class Account {
  #balance = 0;                    // ── inside the casing: nobody outside sees this
  deposit(n: number) { this.#balance += n; } // ── a button on the outside
  get balance() { return this.#balance; }    // ── a readout on the outside
}
```

```csharp
public class Account
{
    private decimal _balance = 0;                  // inside the casing
    public void Deposit(decimal n) => _balance += n; // a button
    public decimal Balance => _balance;            // a readout
}
```

Once this clicks, encapsulation (Phase 3) stops being a rule you memorise and becomes obvious: *of course* the internals are hidden — that's what makes it a reliable machine rather than a pile of exposed wires.

---

## 1.3 The Four Pillars (Overview)

OOP is conventionally summarised as four pillars. Here they are in one line each — we'll spend a whole phase on each later, so this is just the map.

- **Encapsulation** — *Hide internal state behind a controlled interface.* The machine's casing. (Phase 3)
- **Inheritance** — *Derive a new, more specialised type from an existing one* ("a `Dog` **is-a** `Animal`"). (Phase 4)
- **Polymorphism** — *One interface, many implementations*; the right behavior is chosen by the actual object at runtime. (Phase 5)
- **Abstraction** — *Model the essentials, hide the incidental detail*; expose a simple concept over a complex reality. (Phase 6)

One micro-example touching all four:

```typescript
// ABSTRACTION: an interface saying "things that can make a sound" — essentials only
interface Speaker { speak(): string; }

// ENCAPSULATION: name is private; only readable behavior is exposed
abstract class Animal implements Speaker {
  constructor(protected name: string) {}
  abstract speak(): string;            // each subclass fills this in
}

// INHERITANCE: Dog IS-A Animal, reuses its structure
class Dog extends Animal {
  speak() { return `${this.name} says Woof`; }   // POLYMORPHISM: Dog's own version
}
class Cat extends Animal {
  speak() { return `${this.name} says Meow`; }   // POLYMORPHISM: Cat's own version
}

// One interface (Speaker / Animal), many behaviors chosen at runtime:
const animals: Speaker[] = [new Dog("Rex"), new Cat("Tom")];
animals.forEach(a => console.log(a.speak())); // "Rex says Woof", "Tom says Meow"
```

```csharp
// ABSTRACTION
public interface ISpeaker { string Speak(); }

// ENCAPSULATION (protected name) + ABSTRACTION (abstract method)
public abstract class Animal : ISpeaker
{
    protected string Name;
    protected Animal(string name) => Name = name;
    public abstract string Speak();
}

// INHERITANCE + POLYMORPHISM
public class Dog : Animal
{
    public Dog(string name) : base(name) { }
    public override string Speak() => $"{Name} says Woof";
}
public class Cat : Animal
{
    public Cat(string name) : base(name) { }
    public override string Speak() => $"{Name} says Meow";
}

ISpeaker[] animals = { new Dog("Rex"), new Cat("Tom") };
foreach (var a in animals) Console.WriteLine(a.Speak()); // polymorphic dispatch
```

### How the pillars relate

They aren't four equal independent ideas — they build on each other:

```
   Abstraction  ──── defines the simplified concept / contract
        │              (e.g. "a Speaker has speak()")
        ▼
   Encapsulation ──── enforces that concept by hiding the messy internals
        │              behind it (you can't see HOW speak works)
        ▼
   Inheritance  ──── lets you specialise the concept into related types
        │              (Dog and Cat are kinds of Animal)
        ▼
   Polymorphism ──── is what makes inheritance/abstraction USEFUL:
                      call one interface, get the right behavior per object
```

Most practitioners agree **polymorphism is the real payoff** — inheritance without polymorphism is just code sharing; polymorphism is what lets you write `a.speak()` and have it do the right thing without `if/else` chains (you'll prove this in the Phase 5 exercise).

### Why "abstraction vs encapsulation" confuses everyone

This is the single most common point of confusion, so let's nail it now. They sound similar ("both hide things!") but they hide *different things for different reasons*:

| | **Abstraction** | **Encapsulation** |
|---|---|---|
| What it hides | *Complexity* — the existence of detail | *Data* — access to the internal state |
| The question it answers | "What should this thing **look like** to a user?" (design) | "How do I **protect** this thing's data?" (implementation) |
| Level | Design / conceptual | Implementation / mechanical |
| Example | "A `Loan` has `borrow()` and `return()`" — you decide the *concept* | `#dueDate` is `#private` and only changed via methods — you *enforce* it |
| Mechanism | Interfaces, abstract classes | Access modifiers (`private`, `#`), getters/setters |

A clean one-liner:

> **Abstraction is about the *outside view* you design (what the thing means).
> Encapsulation is about the *inside* you hide (how it protects itself).**

The reason they blur: when you do encapsulation well, you naturally end up with a clean abstraction, and vice versa. They're two sides of the same boundary — abstraction designs the boundary's *shape*, encapsulation *guards* it. Phase 6.1 makes this fully concrete; for now, just hold the two-column table.

---

## 1.4 OOP vs Other Paradigms

### Procedural, functional, OOP — the trade-offs

Three ways to organise a program. None is "best"; each has a sweet spot.

| Paradigm | Organising unit | Core idea | Shines at | Struggles with |
|---|---|---|---|---|
| **Procedural** | Functions + shared data | Step-by-step instructions over open data | Small scripts, linear tasks | Scaling — shared mutable data becomes a tangle |
| **Object-Oriented** | Objects (state + behavior) | Model the domain as interacting things | Large domains with stateful entities & rules | Ceremony for simple tasks; over-modelling |
| **Functional** | Pure functions + immutable data | Transform data; avoid side effects | Data pipelines, concurrency, predictability | Inherently stateful / identity-heavy problems |

The same "sum the paid orders" task in all three:

```typescript
// PROCEDURAL — loop, mutate an accumulator
let total = 0;
for (const o of orders) {
  if (o.status === "paid") total += o.amount;
}

// FUNCTIONAL — describe the transformation, no mutation
const total2 = orders
  .filter(o => o.status === "paid")
  .map(o => o.amount)
  .reduce((a, b) => a + b, 0);

// OOP — give the collection an object that owns this behavior
class OrderBook {
  constructor(private orders: Order[]) {}
  paidTotal(): number {
    return this.orders.filter(o => o.status === "paid")
                      .reduce((a, o) => a + o.amount, 0);
  }
}
new OrderBook(orders).paidTotal();
```

For *this* trivial task the functional one-liner is clearly the cleanest — a sign that you shouldn't reach for a class reflexively. OOP earns its keep when there's **state to protect and invariants to enforce** (the `Account`), not when you're just transforming a list.

### Why modern TS and C# blend OOP + functional

Both languages deliberately ship strong functional tooling alongside their object model, because the two paradigms cover each other's weaknesses:

- **C#:** LINQ (functional query pipelines), lambdas / `Func<>` / `Action<>` (first-class functions), `record` types (immutable value objects), `with` expressions (non-destructive update), pattern matching, expression-bodied members.
- **TypeScript:** first-class functions (JS heritage), `Array.map/filter/reduce`, `readonly` / `as const`, discriminated unions + exhaustive `switch`, structural typing that makes plain data + functions ergonomic.

```csharp
// Idiomatic modern C#: a record (functional immutability) used inside OOP code,
// transformed by a LINQ (functional) pipeline. Both paradigms in four lines.
public record Order(string Status, decimal Amount);

decimal Total(IEnumerable<Order> orders) =>
    orders.Where(o => o.Status == "paid").Sum(o => o.Amount);
```

```typescript
// Idiomatic modern TS: a discriminated union (functional modelling) handled
// exhaustively, living happily next to classes elsewhere in the app.
type Shape =
  | { kind: "circle"; r: number }
  | { kind: "square"; side: number };

const area = (s: Shape): number =>
  s.kind === "circle" ? Math.PI * s.r ** 2 : s.side ** 2; // no class needed
```

### "Objects vs functions" is a false dichotomy

It's tempting to treat it as a holy war — OOP people vs FP people. In TS and C# that framing is just wrong. They're complementary tools:

- Reach for an **object** when you have **identity + state + invariants** that must be protected over time (an `Account` whose balance can never go negative; a `Loan` that moves through a lifecycle).
- Reach for a **function / immutable data** when you're **transforming data** with no long-lived state (mapping a DTO, computing a total, validating input).

A healthy codebase has both: rich objects modelling the domain's stateful core, and functional pipelines doing the data-shuffling around them. Phase 9.3 ("Blending OOP and Functional") is entirely about getting this mix right; for now, just retire the idea that you have to pick a side.

---

## 1.5 Mental Model for a JS/TS Developer

### You've already been doing OOP — let's make it explicit

You haven't been avoiding OOP; you've been using it without naming the pillars. Three things you've almost certainly shipped:

- **React class components** (the old style). `class Todo extends React.Component` is *inheritance*. `this.state` is *encapsulated* state. `render()` is a method you *override* (polymorphism over the base `Component`). You were doing all four pillars to render a button.

  ```tsx
  class Counter extends React.Component<Props, State> { // INHERITANCE (extends Component)
    state = { count: 0 };                               // ENCAPSULATED instance state
    increment = () => this.setState(s => ({ count: s.count + 1 })); // behavior
    render() { return <button onClick={this.increment}>{this.state.count}</button>; } // OVERRIDE
  }
  ```

- **NestJS services.** A `@Injectable()` service *is* an object — bundled state + behavior — that NestJS instantiates and hands to controllers. Constructor injection (`constructor(private repo: UserRepository)`) is *programming to an interface* and *dependency inversion* (Phases 6 & 7). You've been doing DIP every day.

  ```typescript
  @Injectable()
  export class UserService {
    constructor(private readonly repo: UserRepository) {} // depends on an abstraction
    findOne(id: string) { return this.repo.findById(id); } // behavior over injected state
  }
  ```

- **EF Core / Prisma entities.** A `User` entity class with properties and (in rich models) methods is a domain object. When you give it a method like `user.deactivate()` instead of mutating fields from outside, you're doing *encapsulation* and building a *rich domain model* (Phase 9.4) instead of an anemic data bag.

> The point: this course isn't teaching you a new skill from zero. It's **naming and sharpening** instincts you already have, then showing you the principles that tell you *when* each one is the right call.

### JS objects + prototypes vs "classical" OOP

Here's where your JS background helps *and* can mislead. In a classical OOP language like C#, a class is a fixed, compile-time blueprint. In JavaScript, "classes" are sugar over the **prototype chain** — a fundamentally different, more dynamic mechanism. (Full deep-dive: `../../javascript/notes/01-js-internals.md` §1.4.)

```js
// JS class is SUGAR. This...
class Dog { bark() { return "woof"; } }

// ...desugars to prototype manipulation under the hood:
function Dog() {}
Dog.prototype.bark = function () { return "woof"; };
// `new Dog()` creates an object whose [[Prototype]] is Dog.prototype.
// Method lookup WALKS the prototype chain at runtime.
```

Consequences that matter for the mental model — these are real JS behaviors that **do not exist** in C#:

- **The prototype chain is mutable at runtime.** You can add a method to every existing `Dog` by assigning to `Dog.prototype.fetch` *after* instances exist. C#'s class hierarchy is frozen at compile time — there is no equivalent.
- **No real method overloading.** Defining `speak()` twice just replaces the first — last one wins. C# has true overloading by signature (Phase 5.3).
- **`#private` is recent and runtime-enforced;** TS's `private` is *only* a compile-time fiction (more below).
- **`this` is bound by *how a function is called*,** not where it's defined — the classic lost-`this` trap (`../../javascript/notes/01-js-internals.md` §1.6). C#'s `this` always means "the current instance," full stop. This is a genuine relief when you move to C#.

So when this course says "a class is a blueprint," that's *literally* true in C# and an *approximation* in JS/TS — useful, but remember there's a live prototype chain underneath.

### Where C# will feel stricter (and where it'll feel familiar)

Moving your OOP instincts from TS to C#, the friction is almost entirely about **strictness**, and the biggest single divergence is **structural vs nominal typing**.

**Structural typing (TS): "if it has the right shape, it fits."** A class doesn't have to *declare* that it implements an interface — if its shape matches, it counts (duck typing).

```typescript
interface HasName { name: string; }

class Person { constructor(public name: string) {} }

// Person never said "implements HasName" — but it has a `name: string`,
// so structurally it IS a HasName. This compiles fine:
const x: HasName = new Person("Tareq"); // ✅ shape matches → accepted
```

**Nominal typing (C#): "you must *declare* the relationship."** Matching the shape is not enough — you have to explicitly say `: IHasName`, by name.

```csharp
public interface IHasName { string Name { get; } }

public class Person                  // ❌ note: does NOT say ": IHasName"
{
    public string Name { get; }
    public Person(string name) => Name = name;
}

IHasName x = new Person("Tareq");    // ❌ COMPILE ERROR: Person does not implement IHasName,
                                     //    even though it has a matching Name property.
// To fix, you must DECLARE it:  public class Person : IHasName { ... }
```

The rest of the strictness map:

| Aspect | TypeScript (looser) | C# (stricter) |
|---|---|---|
| Type relationships | **Structural** — shape match, no declaration needed | **Nominal** — must explicitly declare `: Interface` |
| Privacy enforcement | `private` is compile-time only (leaks at runtime); `#x` is real | `private` is enforced by the runtime, always |
| Interfaces at runtime | Erased — gone after compilation | Real types that exist at runtime |
| Method virtuality | Every method is overridable | Opt-in: `virtual` + `override` required |
| Null safety | `strictNullChecks` (opt-in, escapable via `any`) | Nullable reference types; no `any` escape hatch |
| `this` binding | Depends on call site — can be lost | Always the current instance — never lost |

**What will feel familiar:** generics (`List<T>` ≈ `Array<T>`, `where T :` ≈ `T extends`), `async/await` (`Task<T>` ≈ `Promise<T>`), `?.` and `??` (identical), interfaces-as-contracts, and the overall class syntax. See `../../.net/notes/01-csharp-fundamentals.md` §1.1 for the broader runtime mental shift.

> **Net mental model:** C# takes the OOP ideas you already use in TS and makes the compiler *enforce* them. Less freedom, fewer footguns. Where TS trusts you ("the shape matches, good enough"), C# makes you say what you mean ("declare the relationship, by name").

---

## Gotchas

- **A class is not an object.** The class is the blueprint (defined once); objects are instances (`new`'d many times). "I created a class" usually means "I created an instance." Keep the words straight — the rest of the course depends on it.
- **Same data ≠ same object.** Two instances with identical fields are *equal in content* but distinct in *identity*. C# `record` gives you value equality for free; C# `class` and all TS objects compare by reference (`===` / `==`) unless you write the comparison yourself.
- **TS `private` is a lie at runtime.** `private balance` is erased after compilation — the field is fully reachable from plain JS (`(obj as any).balance`). Only `#balance` is *actually* private. C#'s `private` is genuinely enforced. (Detail lands in Phase 3.2.)
- **Structural vs nominal will bite you.** In TS, anything shaped right "is" the type. In C#, you must *declare* `: IFoo` — a perfectly shaped class is rejected unless it says so. This is the #1 surprise crossing from TS to C#.
- **Don't reach for a class reflexively.** A pure data transform (sum a list, map a DTO) is cleaner as a function in both languages. OOP earns its place when there's **state to protect and invariants to enforce**, not for everything.
- **"Abstraction vs encapsulation" — keep them apart.** Abstraction = the simplified *outside view you design*. Encapsulation = *hiding the internals* to protect them. Re-read the §1.3 table whenever they blur.
- **In JS, "class" is sugar over prototypes.** No real overloading (last definition wins), the prototype chain is mutable at runtime, and `this` is call-site bound. None of that is true in C#, where the hierarchy is fixed and `this` is always the instance.
- **Inheritance is not the point — polymorphism is.** Beginners over-focus on `extends`. The value is being able to call one interface and get the right behavior per object, killing `if (type === ...)` chains (you'll feel this in Phase 5).

---

## Phase 1 Exercise

**Goal:** take a procedural script and rewrite it in object form, then articulate — *in writing* — what improved and what didn't. The reflection is the actual deliverable; the code is just the means.

### Step 1 — Start from this procedural shopping cart

Here's a working procedural cart. Notice the shape: a plain data array and free-floating functions, with rules that are easy to skip and state that anyone can corrupt.

```typescript
// procedural-cart.ts — the BEFORE
type CartItem = { name: string; price: number; qty: number };

const cart: CartItem[] = [];

function addItem(name: string, price: number, qty: number): void {
  cart.push({ name, price, qty }); // no validation: negative price/qty slip through
}

function removeItem(name: string): void {
  const i = cart.findIndex(item => item.name === name);
  if (i !== -1) cart.splice(i, 1);
}

function total(): number {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function applyDiscount(percent: number): number {
  return total() * (1 - percent / 100); // operates on global `cart` — implicit dependency
}

// Usage
addItem("Book", 20, 2);
addItem("Pen", -5, 100);   // ⚠️ nonsense data, silently accepted
cart[0].qty = -999;        // ⚠️ external code mutates internal state directly
console.log(total());      // garbage, because state was corrupted
```

### Step 2 — Rewrite it as an object (your task — both languages)

Turn `cart` into a `ShoppingCart` class (and an `Item`/`CartItem` type). Requirements:

1. The item list is **private** — outside code cannot reach in and mutate it.
2. `addItem` **validates**: reject non-positive price or quantity (throw).
3. All behavior (`addItem`, `removeItem`, `total`, `applyDiscount`) lives **on the object**.
4. Expose a **read-only** view of the items (a getter returning a copy or `readonly` array) so callers can *see* but not *corrupt*.
5. Do it once in **TypeScript** (use `#private`) and once in **C#** (use `private` + a read-only property).

A TypeScript skeleton to get you moving (fill in the C# version yourself — it's good reps):

```typescript
// shopping-cart.ts — the AFTER (skeleton)
class CartItem {
  constructor(
    public readonly name: string,
    public readonly price: number,
    public readonly qty: number,
  ) {
    if (price <= 0) throw new Error("price must be positive");
    if (qty <= 0)   throw new Error("qty must be positive");   // born valid (Phase 3 preview)
  }
}

class ShoppingCart {
  #items: CartItem[] = [];                       // PRIVATE — the casing is sealed

  addItem(name: string, price: number, qty: number): void {
    this.#items.push(new CartItem(name, price, qty)); // validation happens in CartItem
  }

  removeItem(name: string): void {
    this.#items = this.#items.filter(i => i.name !== name);
  }

  get total(): number {
    return this.#items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  applyDiscount(percent: number): number {
    return this.total * (1 - percent / 100);     // no global dependency — uses own state
  }

  get items(): readonly CartItem[] {
    return [...this.#items];                      // read-only copy — see but don't corrupt
  }
}

const cart = new ShoppingCart();
cart.addItem("Book", 20, 2);
// cart.addItem("Pen", -5, 100); // ✅ now THROWS — bad data can't get in
// cart.#items[0]... ;           // ❌ unreachable — state is protected
console.log(cart.total);
```

### Step 3 — Write down what improved and what didn't

This is the graded part. In a short note (a `## Reflection` section below, or a comment block), answer honestly:

**What improved (expect to find):**
- State is **protected** — no more `cart[0].qty = -999` from outside.
- Rules are **centralised and unskippable** — validation lives in one place and runs on every add.
- The cart is the **single source of truth** for its own correctness — to understand "how can total go wrong," you read one class.
- No **implicit global dependency** — `applyDiscount` used to secretly depend on the global `cart`; now it uses its own state explicitly.

**What did *not* improve (be honest — this is the valuable part):**
- For a script this small, the OOP version is **more code / more ceremony**. If this cart is used once in a 30-line script, the procedural version was arguably fine.
- You added a `CartItem` class — is that **over-modelling**? Could a `readonly` record / plain object have done the job? (It could — note where the line is.)
- Encapsulation has a **cost**: the read-only-copy getter allocates a new array each call. Usually negligible, but it's a real trade-off, not free.
- OOP didn't make the *math* better — `total` is the same reduce either way. OOP improved **structure and safety**, not the core computation.

> **The lesson to internalise:** OOP isn't automatically better — it's better *for problems with state to protect and invariants to enforce*. A shopping cart that guards its own validity is a great fit. A one-off data transform is not. Knowing the difference is the entire point of Phase 1.

**Stretch (optional):** make the cart immutable instead — `addItem` returns a *new* `ShoppingCart` rather than mutating. Compare the feel against the mutable version. This previews the OOP-meets-functional blend of Phase 9.3 and C# `record` `with` expressions.

---

## Summary

| Concept | One-liner | Lands fully in |
|---|---|---|
| OOP's core idea | Bundle state + behavior into objects | this phase |
| Class vs object | Blueprint vs instance | Phase 2 |
| Identity vs equality | Same object vs same data | Phase 2.7 |
| Encapsulation | Hide state behind a controlled interface | Phase 3 |
| Inheritance | Derive specialised types (is-a) | Phase 4 |
| Polymorphism | One interface, many behaviors (the real payoff) | Phase 5 |
| Abstraction | Model essentials, hide detail | Phase 6 |
| Abstraction ≠ encapsulation | Outside view you design vs internals you hide | Phase 6.1 |
| Multi-paradigm | TS & C# blend OOP + functional — pick the right tool | Phase 9.3 |
| TS vs C# | Structural/loose vs nominal/strict; compiler enforces more | throughout |
