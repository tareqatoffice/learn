# Object-Oriented Programming Learning Plan

**Learner profile:** Experienced TS/Node.js dev, also learning C#/.NET — has used classes for years, now studying OOP as a discipline  
**Goal:** Master the four pillars, SOLID, and design patterns; know when OOP helps and when it hurts  
**Approach:** Concept-first, every idea shown in **TypeScript AND C#**  
**Pace:** Intensive, alongside the `.net/` and `javascript/` tracks  

---

## How This Plan Works

- Each phase explains the concept, then shows it in **both TypeScript and C#** (side by side where it teaches something)
- Notes go into `notes/XX-topic.md`; runnable code goes in `examples/`
- A single running domain — a **Media Library** (books, audiobooks, members, loans) — is modeled with increasing sophistication across phases, so the concepts compound instead of living in isolation
- Cross-references to `.net/` and `javascript/` where OOP appears in real frameworks (EF Core entities, NestJS DI, Clean Architecture domain models)
- Divergences between TS (structural typing) and C# (nominal typing) are called out explicitly

---

## Phase 1 — OOP Foundations & Mental Model
**Estimated time:** ~2 days  
**Notes file:** `notes/01-foundations.md`

### 1.1 What OOP Is and Why It Exists
- The core idea: bundle **state + behavior** into objects that model a problem domain
- Procedural vs OOP — the same program written both ways, and what changes
- The problems OOP set out to solve: managing complexity, code reuse, modeling the real world
- Why "everything is an object" languages exist (and why TS/C# are multi-paradigm, not pure OOP)

### 1.2 Objects and Classes — The Core Idea
- A **class** is a blueprint; an **object** is an instance created from it
- Identity vs equality (two objects with the same data are still distinct)
- The "object as a little machine with internal state and a public interface" mental model

### 1.3 The Four Pillars (Overview)
- **Encapsulation** — hide internal state behind a controlled interface
- **Inheritance** — derive new types from existing ones (is-a)
- **Polymorphism** — one interface, many implementations
- **Abstraction** — model the essentials, hide the detail
- How they relate — and why "abstraction vs encapsulation" confuses everyone

### 1.4 OOP vs Other Paradigms
- Procedural, functional, OOP — strengths and weaknesses of each
- Why modern TS and C# blend OOP + functional (LINQ, records, immutability, first-class functions)
- "Objects vs functions" is a false dichotomy — when to reach for which

### 1.5 Mental Model for a JS/TS Developer
- You've already used OOP (React class components, NestJS services, EF entities) — what you did implicitly, made explicit
- JS objects + prototypes vs "classical" OOP (cross-reference `javascript/notes/01-js-internals.md` §1.4)
- Where C# will feel stricter (nominal typing, compile-time enforcement) and where it'll feel familiar

**Phase 1 Exercise:** Take a small procedural script (e.g., a function-and-globals "shopping cart") and rewrite it in object form. Articulate, in writing, what improved and what didn't.

---

## Phase 2 — Classes, Objects & Members
**Estimated time:** ~3 days  
**Notes file:** `notes/02-classes-objects.md`

### 2.1 Defining a Class (TS & C#)
- Class declaration syntax in both languages, side by side
- The anatomy of a class: fields, properties, methods, constructors

### 2.2 Fields & Properties — Object State
- Fields (raw storage) vs properties (controlled access)
- C# auto-properties (`get; set;`, `init`) vs TS fields + accessors (`get`/`set`)
- Property initialisers and default values

### 2.3 Methods — Object Behavior
- Instance methods; method signatures
- Expression-bodied members (C#) and concise method syntax
- Method overloading (C# has it; TS uses overload signatures / unions)

### 2.4 Constructors & Initialization
- Constructors in both languages; constructor parameters
- C# primary constructors (modern) and TS parameter properties (`constructor(private x: T)`)
- Constructor chaining (`: this(...)`, `super(...)`)
- Object initialisers (C#) vs object literals

### 2.5 `this`, Static vs Instance Members
- `this` in methods — and the JS `this` binding trap vs C#'s simpler `this` (cross-ref `javascript/notes/01-js-internals.md` §1.6)
- Static fields, methods, and constructors — class-level vs instance-level
- Static classes (C#) and namespace-like usage

### 2.6 Object Lifecycle
- Creation (`new`), reference semantics, what a variable actually holds
- Garbage collection in both runtimes (cross-ref the GC notes in the JS track)
- Deterministic cleanup: `IDisposable`/`using` (C#) and `Symbol.dispose`/`using` (TS 5.2)

### 2.7 Reference vs Value Semantics
- Reference types vs value types (C# `struct` vs `class`); everything-is-a-reference in JS
- C# `record` and `record struct`; structural equality
- Copy semantics, aliasing, and the bugs they cause

**Phase 2 Exercise:** Model `Book`, `Member`, and `Loan` classes for the Media Library — fields, properties, constructors, and a couple of behaviors — in both TS and C#.

---

## Phase 3 — Encapsulation
**Estimated time:** ~2 days  
**Notes file:** `notes/03-encapsulation.md`

### 3.1 What Encapsulation Is and Why It Matters
- Hiding internal state; exposing a controlled, intentional interface
- The goal: protect invariants so an object can never be in an invalid state

### 3.2 Access Modifiers
- C#: `public`, `private`, `protected`, `internal`, `protected internal`, `private protected`
- TS: `public`, `private`, `protected` (compile-time only) vs JS `#private` (runtime-enforced) — the crucial difference
- Convention vs enforcement — why TS `private` leaks at runtime and `#private` doesn't

### 3.3 Properties, Getters & Setters
- Computed/derived properties; validation in setters
- Read-only from outside, writable inside (`private set`, `init`)
- When a getter/setter pair is a code smell (anemic wrapping)

### 3.4 Protecting Invariants
- Validating in the constructor so an object is born valid
- Keeping mutation behind methods that enforce rules (e.g., `loan.Return()` not `loan.ReturnedAt = ...`)
- Failing loudly: throwing on invalid state transitions

### 3.5 Information Hiding & API Design
- Public surface area as a contract — keep it small
- Encapsulation across modules (TS module exports, C# `internal`)

### 3.6 Immutability
- `readonly` fields (C#), `readonly` properties, `init`-only setters
- Records as immutable-by-default; `with` expressions
- TS `readonly`, `as const`, `Object.freeze` — and their limits
- Why immutability makes encapsulation easier

**Phase 3 Exercise:** Harden the Media Library `Loan` so it can never be in an invalid state — no public setters, all transitions via methods (`borrow`, `return`, `renew`) that enforce the rules.

---

## Phase 4 — Inheritance
**Estimated time:** ~3 days  
**Notes file:** `notes/04-inheritance.md`

### 4.1 What Inheritance Is — the "is-a" Relationship
- Deriving a specialised type from a general one
- When "is-a" genuinely holds (and when it's a lie)

### 4.2 Extending a Class
- `class Derived extends Base` (TS) vs `class Derived : Base` (C#)
- Inherited members; what's accessible in the subclass

### 4.3 Constructors, `super` and `base`
- Calling the base constructor (`super(...)` / `: base(...)`)
- Initialisation order up the chain

### 4.4 Overriding Behavior
- C#: `virtual` / `override` / `new` (shadowing) — explicit opt-in
- TS/JS: every method is virtual; just redeclare to override; `super.method()`
- The difference between overriding and overloading and shadowing

### 4.5 The Inheritance Chain & Method Resolution
- How a call walks the chain (C# vtable vs JS prototype chain — cross-ref `javascript/notes/01-js-internals.md` §1.4)
- `protected` members for subclass extension points

### 4.6 Controlling Inheritance
- `sealed` (C#) / `final`-style patterns; sealing methods
- Abstract base classes as a preview of Phase 6

### 4.7 When Inheritance Hurts
- The fragile base class problem
- Deep hierarchies and tight coupling
- The "banana → gorilla → jungle" problem — inheriting more than you wanted
- Foreshadowing: composition over inheritance (Phase 9)

**Phase 4 Exercise:** Model `LibraryItem` → `Book` / `Audiobook` / `DVD` with a base class. Then write a short note on at least one place the hierarchy already feels strained (sets up Phase 9).

---

## Phase 5 — Polymorphism
**Estimated time:** ~3 days  
**Notes file:** `notes/05-polymorphism.md`

### 5.1 What Polymorphism Is — "Many Forms"
- One interface, many concrete behaviors chosen at runtime
- Why polymorphism is what makes OOP powerful (not inheritance itself)

### 5.2 Subtype Polymorphism (the main event)
- Calling an overridden method through a base-type reference
- Runtime dispatch — the method that runs depends on the actual object, not the variable type
- The classic `shapes.forEach(s => s.area())` example in both languages

### 5.3 Ad-hoc Polymorphism — Overloading
- C# method overloading (same name, different signatures) resolved at compile time
- TS function/method overload signatures; union-type dispatch
- Operator overloading (C#) — and why JS/TS has none

### 5.4 Parametric Polymorphism — Generics
- Generic classes and methods in both languages
- Constraints (`where T : ...` in C#, `T extends ...` in TS)
- Why generics are "polymorphism over types"

### 5.5 Dynamic Dispatch Under the Hood
- Virtual method tables (C#) vs prototype chain lookup (JS)
- The cost of dispatch and why it's usually negligible

### 5.6 Substitutability (LSP preview)
- A subtype must be usable wherever the base type is expected
- Examples where overriding breaks the contract — sets up SOLID's L

**Phase 5 Exercise:** Add a `LateFee` calculation that differs per item type, invoked polymorphically through the `LibraryItem` base — no `if (item is Book)` type checks allowed.

---

## Phase 6 — Abstraction (Interfaces & Abstract Classes)
**Estimated time:** ~3 days  
**Notes file:** `notes/06-abstraction.md`

### 6.1 What Abstraction Is
- Modeling the essential, hiding the incidental
- Abstraction vs encapsulation — the difference, finally made clear

### 6.2 Interfaces
- Defining and implementing interfaces in both languages
- **The big divergence:** C# interfaces are *nominal* (must explicitly implement) vs TS interfaces are *structural* (shape matching / "duck typing") — cross-ref `javascript/notes/02-advanced-typescript.md` §2.1
- Interfaces as contracts; multiple interface implementation

### 6.3 Abstract Classes
- Abstract classes and abstract methods; partial implementation
- Why you can't instantiate an abstract class
- Template method pattern preview (abstract + concrete methods together)

### 6.4 Interface vs Abstract Class — When Each
- Decision guide: capability/contract → interface; shared implementation + identity → abstract class
- C# single inheritance + multiple interfaces; TS the same
- "Prefer interfaces" and why

### 6.5 Default Implementations
- C# default interface methods (C# 8+)
- TS — no default interface methods; how mixins / abstract classes fill the gap

### 6.6 Programming to an Interface, Not an Implementation
- Depending on abstractions decouples code (DI preview — cross-ref `.net/notes/04-clean-architecture.md` and NestJS DI)
- Repository interface example carried into Clean Architecture

**Phase 6 Exercise:** Define an `ILoanPolicy` abstraction with multiple implementations (standard, student, staff) and have the library depend only on the interface.

---

## Phase 7 — SOLID Principles
**Estimated time:** ~4 days  
**Notes file:** `notes/07-solid.md`

### 7.1 Single Responsibility Principle (SRP)
- One reason to change; cohesion
- Splitting a "god class" — before/after in both languages

### 7.2 Open/Closed Principle (OCP)
- Open for extension, closed for modification
- Achieving it with polymorphism and interfaces (the `LateFee`/`LoanPolicy` examples pay off here)

### 7.3 Liskov Substitution Principle (LSP)
- Subtypes must be substitutable for their base types
- The classic Rectangle/Square violation, explained properly
- Behavioral contracts, preconditions, postconditions

### 7.4 Interface Segregation Principle (ISP)
- Many small focused interfaces beat one fat one
- The "fat interface forces empty implementations" smell

### 7.5 Dependency Inversion Principle (DIP)
- Depend on abstractions, not concretions
- High-level vs low-level modules; who owns the interface
- How DIP makes Dependency Injection natural (cross-ref `.net/notes/02-aspnet-basics.md` §2.3 and NestJS DI)

### 7.6 SOLID Together
- How the five reinforce each other
- SOLID as a means, not an end — over-applying it
- The connection: SOLID → DI containers → Clean Architecture

**Phase 7 Exercise:** Take a deliberately bad "LibraryManager does everything" class and refactor it to satisfy all five principles. Keep the before and after side by side.

---

## Phase 8 — Design Patterns
**Estimated time:** ~5 days  
**Notes file:** `notes/08-design-patterns.md`

### 8.1 What Design Patterns Are
- Named solutions to recurring design problems (Gang of Four)
- Patterns are a vocabulary, not a checklist; how to learn them without overusing them

### 8.2 Creational Patterns
- **Factory Method** & **Abstract Factory** — decoupling creation
- **Builder** — constructing complex objects step by step (cross-ref the fluent builder in `javascript/notes/02-advanced-typescript.md` §2.7)
- **Singleton** — the one everyone misuses; why DI usually replaces it

### 8.3 Structural Patterns
- **Adapter** — making incompatible interfaces work together
- **Decorator** — adding behavior without subclassing (cross-ref TS/C# decorators are inspired by this)
- **Facade** — a simple front over a complex subsystem
- **Proxy** — stand-in / lazy / guarding access
- **Composite** — tree structures of uniform parts

### 8.4 Behavioral Patterns
- **Strategy** — interchangeable algorithms (your `LoanPolicy` is already this)
- **Observer** — publish/subscribe (cross-ref the type-safe event emitter in the JS track)
- **Command** — actions as objects (cross-ref CQRS commands in Clean Architecture)
- **Template Method** — fixed skeleton, overridable steps
- **State** — behavior that changes with internal state (the `Loan` lifecycle)

### 8.5 Patterns You're Already Using
- Repository, Unit of Work, Dependency Injection, Middleware/Chain of Responsibility, Mediator
- Spotting patterns in NestJS, ASP.NET, EF Core

### 8.6 The Anti-Pattern: Pattern Overuse
- "Patternitis" — when a pattern adds ceremony, not value
- Simpler is usually better; reach for a pattern when the problem actually appears

**Phase 8 Exercise:** Implement Strategy (loan policies), Observer (overdue notifications), and Factory (item creation) in the Media Library — in whichever language you prefer, then port one to the other.

---

## Phase 9 — Composition, Anti-Patterns & Real-World OOP
**Estimated time:** ~3 days  
**Notes file:** `notes/09-composition-realworld.md`

### 9.1 Composition over Inheritance
- "Has-a" beats "is-a" more often than you'd think
- Refactoring the strained Phase 4 hierarchy into composition
- Mixins (TS) and interface + delegation (C#)

### 9.2 Common OOP Anti-Patterns
- God object / blob
- Anemic domain model (cross-ref rich vs anemic models in `.net/notes/04-clean-architecture.md`)
- Yo-yo problem, deep inheritance, leaky abstractions
- Primitive obsession → value objects as the fix

### 9.3 Blending OOP and Functional
- Immutability, pure functions, and objects coexisting
- When records + functions beat classes + methods
- Modern C# (records, pattern matching, LINQ) and modern TS (discriminated unions) as the functional side

### 9.4 Domain Modeling with OOP
- Rich domain models, value objects, aggregates (the OOP foundation under DDD / Clean Architecture)
- Encapsulation + polymorphism + composition working together
- This is where every earlier phase pays off

### 9.5 Testing Object-Oriented Code
- Why good encapsulation and DIP make code testable (cross-ref `.net/notes/06-testing.md` and `javascript/notes/07-testing.md`)
- Test doubles via interfaces; the seams abstraction gives you

### 9.6 When NOT to Use OOP
- Scripts, data pipelines, simple transforms — functions are fine
- The cost of ceremony; judgment over dogma

**Phase 9 Project:** Finalise the Media Library as a small, well-modeled domain — rich entities, value objects, polymorphic policies, composition where inheritance was strained, an event for overdue loans, and a thin test suite proving the invariants hold. The capstone that uses every pillar.

---

## Cross-Cutting Reference

### The Four Pillars in One Table

| Pillar | One-line definition | Mechanism (TS / C#) |
|--------|--------------------|--------------------|
| Encapsulation | Hide state behind a controlled interface | `#private` / `private`, properties |
| Inheritance | Derive specialised types (is-a) | `extends` / `:` base class |
| Polymorphism | One interface, many behaviors | overriding, generics, interfaces |
| Abstraction | Model essentials, hide detail | interfaces, abstract classes |

### TypeScript vs C# — Key OOP Divergences

| Aspect | TypeScript | C# |
|--------|-----------|----|
| Typing | Structural (shape match) | Nominal (declared relationship) |
| Privacy | `private` (compile-time) / `#x` (runtime) | `private` (runtime-enforced) |
| Interfaces | Structural, no runtime presence | Nominal, must explicitly implement |
| Method virtuality | All methods virtual by default | Opt-in via `virtual`/`override` |
| Value types | None — all objects are references | `struct` / `record struct` |
| Immutability | `readonly`, `as const`, `Object.freeze` | `readonly`, `init`, `record` |
| Overloading | Overload signatures only | True method/operator overloading |
| Default interface methods | No | Yes (C# 8+) |

### Common Packages / Where OOP Shows Up
| Concept | Shows up in (this repo) |
|---------|------------------------|
| Interfaces + DIP | NestJS DI, ASP.NET DI, Clean Architecture repositories |
| Rich domain models | `.net/notes/04-clean-architecture.md`, `javascript/notes/05-clean-architecture-nest.md` |
| Strategy / Command | CQRS handlers, loan policies |
| Decorator | TS/C# decorators, NestJS guards/interceptors |
| Repository / Unit of Work | EF Core, Prisma wrappers |

---

## Milestones

| Milestone | What you can do |
|-----------|----------------|
| After Phase 2 | Write well-structured classes with proper members in TS and C# |
| After Phase 3 | Design objects that protect their own invariants |
| After Phase 5 | Use polymorphism to eliminate type-checking branches |
| After Phase 6 | Program to interfaces and decouple your code |
| After Phase 7 | Apply (and judge when to apply) SOLID |
| After Phase 8 | Recognise and implement the patterns that matter |
| After Phase 9 | Model a real domain with the right blend of OOP, composition, and functional style |

---

## How to Use This Plan

1. Work through phases sequentially — the Media Library domain compounds across them
2. Write every concept in **both** TypeScript and C# — the contrast is the lesson
3. Update `notes/XX-topic.md` as you learn — include both-language examples and "aha" moments
4. Update the progress table in `CLAUDE.md` as phases complete
5. Connect each concept back to where it appears in the `.net/` and `javascript/` tracks
