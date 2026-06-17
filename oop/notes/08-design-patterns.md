# Phase 8 — Design Patterns

**Status:** Not started
**Notes file:** `notes/08-design-patterns.md`
**Builds on:** Phase 6 (interfaces/abstract classes) and Phase 7 (SOLID) — patterns are SOLID applied to recurring shapes.

---

## 8.1 What Design Patterns Are

A **design pattern** is a *named, reusable solution to a recurring design problem*. The canonical catalogue is the 1994 "Gang of Four" (GoF) book — 23 patterns split into **Creational** (how objects get made), **Structural** (how objects compose), and **Behavioral** (how objects collaborate and communicate).

The key mental shift: **patterns are a vocabulary, not a checklist.** When you say "the `LoanPolicy` is a Strategy" to another engineer, you've compressed a paragraph of design into one word. That's the real value — shared names for shapes you'd otherwise re-derive every time.

### Patterns are discovered, not installed

You don't start a feature by picking a pattern. You write the simplest thing that works, feel a specific pain (a `switch` that keeps growing, a constructor with twelve arguments, duplicated subclasses), and *then* recognise "ah, this is the problem Strategy/Builder/Decorator solves." The pattern is the cure for a diagnosed disease, not a vitamin you take preventively.

### How to learn them without overusing them

- **Learn the *problem* each pattern solves**, not just its UML diagram. The problem is the trigger; the structure is the response.
- **Recognise the ones you already use.** You've written Repository, DI, and Middleware for years (§8.5). Naming them is half the battle.
- **Prefer the language feature over the pattern** when one exists. A first-class function often *is* a Strategy; an `IDisposable` often beats a hand-rolled Proxy. TS/C# give you tools GoF (a C++/Smalltalk-era book) had to simulate with classes.
- **Resist "patternitis"** (§8.6). A pattern adds indirection. Indirection is a cost paid up front against a *future* change. If the change never comes, you paid for nothing.

> **TS vs C# note:** GoF assumes classes + interfaces + inheritance. Both languages have all three, so the patterns translate cleanly. The divergences are the same ones from earlier phases: C# interfaces are *nominal* (you must write `: IStrategy`), TS interfaces are *structural* (shape match is enough), and TS's first-class functions let you collapse several "one-method-interface" patterns into a plain function type.

---

## 8.2 Creational Patterns

How objects are created — decoupling *what* you need from *how* it's built.

### Factory Method & Abstract Factory

**Intent (Factory Method):** Defer the choice of *which concrete class to instantiate* to a single method, so callers depend on the abstraction, not the `new`.

In the Media Library, parsing an import feed shouldn't pepper your code with `if (type === 'book') new Book() else if ...`. Centralise it.

```ts
// TypeScript — Factory Method
interface LibraryItem { readonly title: string; lateFeePerDay(): number; }

class Book implements LibraryItem {
  constructor(readonly title: string, readonly author: string) {}
  lateFeePerDay() { return 0.25; }
}
class Audiobook implements LibraryItem {
  constructor(readonly title: string, readonly hours: number) {}
  lateFeePerDay() { return 0.10; }
}

type ItemKind = "book" | "audiobook";

// The factory: callers say "make me an item of this kind", not "new Book(...)".
function createItem(kind: ItemKind, data: Record<string, unknown>): LibraryItem {
  switch (kind) {
    case "book":      return new Book(data.title as string, data.author as string);
    case "audiobook": return new Audiobook(data.title as string, data.hours as number);
  }
}

const item = createItem("book", { title: "Dune", author: "Herbert" });
```

```csharp
// C# — Factory Method
public interface ILibraryItem { string Title { get; } decimal LateFeePerDay(); }

public class Book(string title, string author) : ILibraryItem
{
    public string Title { get; } = title;
    public decimal LateFeePerDay() => 0.25m;
}

public class Audiobook(string title, int hours) : ILibraryItem
{
    public string Title { get; } = title;
    public decimal LateFeePerDay() => 0.10m;
}

public enum ItemKind { Book, Audiobook }

public static class ItemFactory
{
    // One place that knows the concrete types; everyone else depends on ILibraryItem.
    public static ILibraryItem Create(ItemKind kind, string title, string extra) => kind switch
    {
        ItemKind.Book      => new Book(title, extra),
        ItemKind.Audiobook => new Audiobook(title, int.Parse(extra)),
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };
}
```

**Abstract Factory** is one level up: a factory that produces a *family* of related objects that must be used together. Classic example: a UI toolkit factory that makes matching `Button` + `Checkbox` for a theme. The caller picks the factory once (`DarkThemeFactory`) and gets a consistent set. You'll rarely write a true Abstract Factory in app code — DI containers and configuration usually fill this role.

- **Use when:** creation logic is non-trivial, repeated, or you want callers decoupled from concrete types (so you can swap implementations or add new ones in one place).
- **Avoid when:** a plain constructor is enough. A factory that just calls `new Foo(x)` is ceremony. In DI-heavy code, the container *is* your factory — don't build a second one.

### Builder

**Intent:** Construct a complex object step by step, so you don't get a constructor with ten positional arguments (the "telescoping constructor" problem).

> Cross-reference: the **type-safe fluent builder** in `javascript/notes/02-advanced-typescript.md` §2.7 takes this further — it tracks *which fields have been set in the type* so `.build()` won't even compile until required steps are done. The version below is the runtime-only OOP form.

```ts
// TypeScript — Builder for a complex loan search query
class LoanQueryBuilder {
  private criteria: Record<string, unknown> = {};

  forMember(id: string)   { this.criteria.memberId = id; return this; } // return this → chainable
  overdueOnly()           { this.criteria.overdue = true; return this; }
  itemType(t: string)     { this.criteria.itemType = t; return this; }
  build()                 { return { ...this.criteria }; }
}

const query = new LoanQueryBuilder()
  .forMember("m_42")
  .overdueOnly()
  .build(); // { memberId: 'm_42', overdue: true }
```

```csharp
// C# — same Builder, fluent chaining
public class LoanQueryBuilder
{
    private readonly Dictionary<string, object> _criteria = new();

    public LoanQueryBuilder ForMember(string id) { _criteria["memberId"] = id; return this; }
    public LoanQueryBuilder OverdueOnly()         { _criteria["overdue"] = true; return this; }
    public LoanQueryBuilder ItemType(string t)    { _criteria["itemType"] = t; return this; }
    public IReadOnlyDictionary<string, object> Build() => _criteria;
}

var query = new LoanQueryBuilder()
    .ForMember("m_42")
    .OverdueOnly()
    .Build();
```

You meet Builder constantly in the wild: `StringBuilder`, EF Core's `modelBuilder`, ASP.NET's `WebApplication.CreateBuilder(args)`, and fluent test-data builders.

- **Use when:** an object has many optional parts, the construction has order/validation rules, or you want a readable, self-documenting call site.
- **Avoid when:** the object is small. For 2–3 fields, C# **object initialisers** (`new Foo { A = 1, B = 2 }`) or a TS object literal already give you named, optional construction for free.

### Singleton

**Intent:** Guarantee a class has exactly one instance and a global access point to it.

```ts
// TypeScript — classic Singleton (shown so you recognise it... then avoid it)
class ConfigService {
  private static instance: ConfigService;
  private constructor(public readonly maxLoans = 5) {} // private ctor blocks `new`

  static getInstance(): ConfigService {
    return (this.instance ??= new ConfigService()); // create once, reuse
  }
}

const a = ConfigService.getInstance();
const b = ConfigService.getInstance();
console.log(a === b); // true — same object
```

```csharp
// C# — thread-safe Singleton via static initialisation (lazy, CLR-guaranteed once)
public sealed class ConfigService
{
    public static ConfigService Instance { get; } = new ConfigService();
    public int MaxLoans { get; } = 5;
    private ConfigService() { } // private ctor blocks `new`
}

var a = ConfigService.Instance;
var b = ConfigService.Instance;
Console.WriteLine(ReferenceEquals(a, b)); // true
```

**Why DI usually replaces it.** The Singleton pattern bakes *lifetime* and *access* into the class itself. That creates two problems: it's a hidden global dependency (any code can reach it, so you can't see who depends on it), and it's hard to substitute in tests (the static instance is shared and sticky). Dependency Injection solves both: you register a type with **singleton lifetime** in the container and *inject it as an interface*. You get "one instance" without the global, and tests just inject a fake.

```csharp
// The modern answer: same one-instance guarantee, but injectable & testable
builder.Services.AddSingleton<IConfigService, ConfigService>(); // ASP.NET
// constructor(private config: IConfigService) {}  // NestJS — @Injectable, scope: DEFAULT is singleton
```

- **Use when:** truly almost never in app code. Maybe a process-wide cache or a logger where DI isn't available.
- **Avoid when:** you have a DI container (you do). Register a singleton lifetime and inject an interface instead — see §8.5.

---

## 8.3 Structural Patterns

How objects are composed into larger structures while keeping those structures flexible.

### Adapter

**Intent:** Make two incompatible interfaces work together by wrapping one in a translator that exposes the interface the other side expects. (The "power plug adapter" pattern.)

```ts
// TypeScript — adapt a 3rd-party SMS gateway to our INotifier interface
interface INotifier { send(to: string, message: string): void; }

// The library we can't change — wrong method name & signature for us:
class TwilioSdk { sendSms(opts: { phone: string; body: string }) { /* ... */ } }

class TwilioAdapter implements INotifier {
  constructor(private sdk: TwilioSdk) {}
  send(to: string, message: string) {            // our interface...
    this.sdk.sendSms({ phone: to, body: message }); // ...translated to theirs
  }
}

const notifier: INotifier = new TwilioAdapter(new TwilioSdk());
```

```csharp
// C# — same idea
public interface INotifier { void Send(string to, string message); }

public class TwilioSdk { public void SendSms(string phone, string body) { /* ... */ } }

public class TwilioAdapter(TwilioSdk sdk) : INotifier
{
    public void Send(string to, string message) => sdk.SendSms(to, message); // translate
}
```

- **Use when:** integrating a third-party/legacy API whose shape doesn't match your domain's interface, and you want the rest of your code to depend only on *your* interface.
- **Avoid when:** you control both sides — just change one interface. Don't adapt your own code to itself.

### Decorator

**Intent:** Add behavior to an object *dynamically*, by wrapping it in another object that implements the same interface — without subclassing and without touching the original.

> **Naming note:** the `@Decorator()` syntax in TS/C# is *inspired by* this pattern but is a different mechanism (compile/runtime metadata — see `javascript/notes/02-advanced-typescript.md` §2.6). The GoF Decorator below is plain wrapping. Same spirit ("layer behavior on"), different machinery.

```ts
// TypeScript — wrap a notifier to add logging, then retry, by composition
interface INotifier { send(to: string, message: string): void; }

class EmailNotifier implements INotifier {
  send(to: string, message: string) { /* actually send */ }
}

// A decorator IS-A INotifier and HAS-A INotifier — same interface in and out.
class LoggingNotifier implements INotifier {
  constructor(private inner: INotifier) {}
  send(to: string, message: string) {
    console.log(`[notify] -> ${to}`);
    this.inner.send(to, message); // delegate to the wrapped object
  }
}

// Stack them like layers of an onion:
const notifier: INotifier = new LoggingNotifier(new EmailNotifier());
```

```csharp
// C# — identical structure
public interface INotifier { void Send(string to, string message); }

public class EmailNotifier : INotifier
{
    public void Send(string to, string message) { /* actually send */ }
}

public class LoggingNotifier(INotifier inner) : INotifier
{
    public void Send(string to, string message)
    {
        Console.WriteLine($"[notify] -> {to}");
        inner.Send(to, message); // delegate
    }
}

INotifier notifier = new LoggingNotifier(new EmailNotifier());
```

This is the structural backbone of NestJS interceptors and ASP.NET middleware — each wraps the next and can act before/after.

- **Use when:** you want to add cross-cutting behavior (logging, caching, retry, validation) to *some* instances at runtime, composably. Open/Closed in action: add behavior without modifying the original class.
- **Avoid when:** there's exactly one fixed combination forever — then a plain method or subclass is simpler. Deep decorator stacks also make debugging stack traces harder.

### Facade

**Intent:** Provide one simple, high-level interface over a complicated subsystem, so callers don't have to orchestrate the parts.

```ts
// TypeScript — borrowing a book touches 4 subsystems; the facade hides that
class CheckoutFacade {
  constructor(
    private catalog: CatalogService,
    private members: MemberService,
    private loans: LoanService,
    private notifier: INotifier,
  ) {}

  // One call the controller can make, instead of coordinating four services:
  borrow(memberId: string, itemId: string): void {
    const member = this.members.requireActive(memberId);
    const item   = this.catalog.requireAvailable(itemId);
    this.loans.open(member, item);
    this.notifier.send(member.email, `You borrowed ${item.title}`);
  }
}
```

```csharp
// C# — same facade
public class CheckoutFacade(
    CatalogService catalog,
    MemberService members,
    LoanService loans,
    INotifier notifier)
{
    public void Borrow(string memberId, string itemId)
    {
        var member = members.RequireActive(memberId);
        var item   = catalog.RequireAvailable(itemId);
        loans.Open(member, item);
        notifier.Send(member.Email, $"You borrowed {item.Title}");
    }
}
```

An application service / use-case handler in Clean Architecture is essentially a Facade over your domain + infrastructure.

- **Use when:** a common task requires coordinating several lower-level pieces, and you want one obvious entry point.
- **Avoid when:** the facade becomes a god object that grows a method per use case forever (§8.6 / SRP). Split it before it swallows the whole app.

### Proxy

**Intent:** A stand-in object with the *same interface* as the real one, controlling access to it — for lazy loading, access control, caching, or remote calls.

```ts
// TypeScript — a caching proxy over a slow catalog lookup
interface ICatalog { getItem(id: string): LibraryItem; }

class CachingCatalogProxy implements ICatalog {
  private cache = new Map<string, LibraryItem>();
  constructor(private real: ICatalog) {}

  getItem(id: string): LibraryItem {
    if (!this.cache.has(id)) {
      this.cache.set(id, this.real.getItem(id)); // delegate only on a miss
    }
    return this.cache.get(id)!;
  }
}
```

```csharp
// C# — same interface, controls access (here: caching)
public interface ICatalog { ILibraryItem GetItem(string id); }

public class CachingCatalogProxy(ICatalog real) : ICatalog
{
    private readonly Dictionary<string, ILibraryItem> _cache = new();

    public ILibraryItem GetItem(string id)
    {
        if (!_cache.TryGetValue(id, out var item))
            _cache[id] = item = real.GetItem(id); // delegate only on a miss
        return item;
    }
}
```

Proxy vs Decorator: same wrapping structure, different intent. Decorator *adds behavior*; Proxy *controls access* to the same behavior. EF Core's lazy-loading proxies and JS's built-in `Proxy` object are real examples.

- **Use when:** you need lazy initialisation, access control, caching, or to represent a remote/expensive resource behind a local interface.
- **Avoid when:** the access control is trivial — an `if` guard in the caller may be clearer than a whole class.

### Composite

**Intent:** Treat individual objects and *groups* of objects uniformly through a common interface, so client code doesn't care whether it's holding a leaf or a tree.

```ts
// TypeScript — a Collection contains items OR other collections, uniformly
interface CatalogNode { totalItems(): number; }

class ItemLeaf implements CatalogNode {
  totalItems() { return 1; }
}

class Collection implements CatalogNode {
  private children: CatalogNode[] = [];
  add(node: CatalogNode) { this.children.push(node); return this; }
  // Recurse — leaves and sub-collections answer the same method:
  totalItems() { return this.children.reduce((sum, c) => sum + c.totalItems(), 0); }
}

const scifi = new Collection().add(new ItemLeaf()).add(new ItemLeaf());
const library = new Collection().add(scifi).add(new ItemLeaf());
console.log(library.totalItems()); // 3
```

```csharp
// C# — same tree, uniform interface
public interface ICatalogNode { int TotalItems(); }

public class ItemLeaf : ICatalogNode
{
    public int TotalItems() => 1;
}

public class Collection : ICatalogNode
{
    private readonly List<ICatalogNode> _children = new();
    public Collection Add(ICatalogNode node) { _children.Add(node); return this; }
    public int TotalItems() => _children.Sum(c => c.TotalItems()); // recurse uniformly
}

var scifi = new Collection().Add(new ItemLeaf()).Add(new ItemLeaf());
var library = new Collection().Add(scifi).Add(new ItemLeaf());
Console.WriteLine(library.TotalItems()); // 3
```

- **Use when:** you have a genuine part-whole hierarchy (file systems, org charts, UI trees, nested categories) and want to apply operations recursively without type-checking each node.
- **Avoid when:** your data isn't actually a tree. Forcing a flat list into Composite adds recursion for no reason.

---

## 8.4 Behavioral Patterns

How objects collaborate, delegate, and communicate.

### Strategy

**Intent:** Define a family of interchangeable algorithms behind one interface, so the algorithm can vary independently from the code that uses it.

> **You already built this.** The `ILoanPolicy` from Phase 6 (standard / student / staff) *is* Strategy — each policy is an interchangeable algorithm for "how long can this member borrow, and what's the fee?"

```ts
// TypeScript — loan policies as interchangeable strategies
interface ILoanPolicy {
  maxDays(): number;
  lateFee(daysLate: number): number;
}

class StandardPolicy implements ILoanPolicy {
  maxDays() { return 14; }
  lateFee(d: number) { return d * 0.25; }
}
class StudentPolicy implements ILoanPolicy {
  maxDays() { return 30; }                 // longer loans
  lateFee(d: number) { return d * 0.10; }  // gentler fees
}

// The context depends on the interface, not a concrete policy:
class Loan {
  constructor(private policy: ILoanPolicy) {}
  dueInDays() { return this.policy.maxDays(); }
}

new Loan(new StudentPolicy()).dueInDays(); // 30 — swap policy, behavior changes
```

```csharp
// C# — same Strategy
public interface ILoanPolicy
{
    int MaxDays();
    decimal LateFee(int daysLate);
}

public class StandardPolicy : ILoanPolicy
{
    public int MaxDays() => 14;
    public decimal LateFee(int d) => d * 0.25m;
}
public class StudentPolicy : ILoanPolicy
{
    public int MaxDays() => 30;
    public decimal LateFee(int d) => d * 0.10m;
}

public class Loan(ILoanPolicy policy)
{
    public int DueInDays() => policy.MaxDays();
}
```

**TS shortcut:** when a Strategy has one method, a plain function type often replaces the interface entirely — `type LoanPolicy = (daysLate: number) => number`. C# does the same with `Func<int, decimal>`. The interface earns its keep when the strategy has *multiple* related methods (as above).

- **Use when:** you have several ways to do one thing (pricing, sorting, validation, routing) and want to choose at runtime — and especially when you keep adding `if/switch` branches for new variants (that's the smell Strategy cures; it satisfies Open/Closed).
- **Avoid when:** there's only one algorithm and no realistic second one coming. A direct method call is fine.

### Observer

**Intent:** Define a one-to-many dependency so that when one object (the *subject*) changes state, all its dependents (*observers*) are notified automatically — publish/subscribe.

> Cross-reference: the **type-safe event emitter** in `javascript/notes/02-advanced-typescript.md` §2.8 is Observer with the payload types enforced by the compiler. The version below is the plain OOP shape.

```ts
// TypeScript — overdue loans notify subscribers (Observer)
interface ILoanObserver { onOverdue(loan: Loan): void; }

class Loan {
  private observers: ILoanObserver[] = [];
  subscribe(o: ILoanObserver) { this.observers.push(o); }

  markOverdue() {
    // Subject doesn't know or care WHO is listening — just broadcasts:
    this.observers.forEach(o => o.onOverdue(this));
  }
}

class EmailReminder implements ILoanObserver {
  onOverdue(loan: Loan) { /* send email */ }
}
class AuditLog implements ILoanObserver {
  onOverdue(loan: Loan) { /* write audit row */ }
}

const loan = new Loan();
loan.subscribe(new EmailReminder());
loan.subscribe(new AuditLog());
loan.markOverdue(); // both observers fire
```

```csharp
// C# — idiomatic Observer uses the built-in event / delegate system
public class Loan
{
    // `event` is C#'s first-class Observer support — multicast delegate.
    public event Action<Loan>? Overdue;

    public void MarkOverdue() => Overdue?.Invoke(this); // notify all subscribers
}

var loan = new Loan();
loan.Overdue += l => { /* send email */ };  // subscribe
loan.Overdue += l => { /* write audit  */ }; // subscribe again (multicast)
loan.MarkOverdue(); // both handlers fire
```

C# bakes Observer into the language with `event`/`delegate` and the `IObservable<T>`/`IObserver<T>` interfaces (the foundation of Rx). You rarely hand-roll the observer list in C# — use `event`.

- **Use when:** several independent parts must react to an event without the source knowing about them (notifications, logging, cache invalidation, UI updates). Keeps the subject decoupled from its reactions.
- **Avoid when:** the flow is a simple, fixed A-then-B call. Observer's indirection makes control flow harder to trace ("who fired this?"). Also watch for memory leaks: forgetting to unsubscribe keeps observers alive.

### Command

**Intent:** Encapsulate a request as an object — turning an action into a first-class value you can store, queue, log, pass around, or undo.

> Cross-reference: **CQRS commands** (e.g. MediatR `IRequest`, NestJS `@CommandHandler`) are exactly this — `BorrowBookCommand` is a data object describing intent; a separate handler executes it. See `.net/notes/04-clean-architecture.md`.

```ts
// TypeScript — actions as objects, with undo
interface ICommand { execute(): void; undo(): void; }

class RenewLoanCommand implements ICommand {
  private previousDue?: Date;
  constructor(private loan: { due: Date }) {}
  execute() { this.previousDue = this.loan.due; this.loan.due = addDays(this.loan.due, 14); }
  undo()    { if (this.previousDue) this.loan.due = this.previousDue; } // reversible
}

// An invoker can run, log, and undo without knowing what the command does:
const history: ICommand[] = [];
function run(cmd: ICommand) { cmd.execute(); history.push(cmd); }
function undoLast() { history.pop()?.undo(); }
```

```csharp
// C# — same, command + handler
public interface ICommand { void Execute(); void Undo(); }

public class RenewLoanCommand(Loan loan) : ICommand
{
    private DateTime _previousDue;
    public void Execute() { _previousDue = loan.Due; loan.Due = loan.Due.AddDays(14); }
    public void Undo()    => loan.Due = _previousDue; // reversible
}

var history = new Stack<ICommand>();
void Run(ICommand cmd) { cmd.Execute(); history.Push(cmd); }
void UndoLast() { if (history.Count > 0) history.Pop().Undo(); }
```

- **Use when:** you need undo/redo, queuing, scheduling, audit logs of actions, or to decouple "the thing that requests an action" from "the thing that performs it" (the core of CQRS).
- **Avoid when:** you just need to call a method. Wrapping every call in a Command object is textbook over-engineering unless you genuinely need to reify the action.

### Template Method

**Intent:** Define the *skeleton* of an algorithm in a base class, letting subclasses override specific steps without changing the overall structure.

```ts
// TypeScript — fixed import pipeline, overridable parse step
abstract class ImportJob {
  // The template: fixed order, no overriding allowed here.
  run(raw: string): void {
    const records = this.parse(raw); // the variable step
    this.validate(records);
    this.save(records);
  }
  protected abstract parse(raw: string): unknown[]; // subclasses fill this in
  protected validate(records: unknown[]) { /* shared default */ }
  protected save(records: unknown[]) { /* shared default */ }
}

class CsvImportJob extends ImportJob {
  protected parse(raw: string) { return raw.split("\n").map(l => l.split(",")); }
}
```

```csharp
// C# — skeleton in base, abstract step in subclass
public abstract class ImportJob
{
    public void Run(string raw) // template method — the fixed skeleton
    {
        var records = Parse(raw);
        Validate(records);
        Save(records);
    }
    protected abstract IReadOnlyList<object> Parse(string raw); // the hole to fill
    protected virtual void Validate(IReadOnlyList<object> records) { } // overridable default
    protected virtual void Save(IReadOnlyList<object> records) { }
}

public class CsvImportJob : ImportJob
{
    protected override IReadOnlyList<object> Parse(string raw) =>
        raw.Split('\n').Select(l => (object)l.Split(',')).ToList();
}
```

Template Method and Strategy solve the same "the algorithm varies" problem two ways: Template Method uses **inheritance** (override a step), Strategy uses **composition** (inject the whole algorithm). Strategy is usually more flexible (composition over inheritance — Phase 9); Template Method is lighter when the variation is just one or two steps in a fixed flow.

- **Use when:** several variants share an identical overall flow and differ only in a step or two, and the flow itself should be locked down.
- **Avoid when:** the variation is large or you'd benefit from swapping behavior at runtime — reach for Strategy instead.

### State

**Intent:** Let an object change its behavior when its internal state changes — as if it changed class. Each state is an object that knows which transitions are legal.

> **Media Library fit:** the `Loan` lifecycle — `Requested → Active → Overdue → Returned` — is a State machine. Each state allows different operations (you can't `return` a loan that's only `Requested`).

```ts
// TypeScript — Loan lifecycle as State
interface LoanState {
  return(loan: Loan): void;
  renew(loan: Loan): void;
}

class ActiveState implements LoanState {
  return(loan: Loan) { loan.setState(new ReturnedState()); }
  renew(loan: Loan)  { /* extend due date, stay Active */ }
}
class ReturnedState implements LoanState {
  return(_: Loan) { throw new Error("Already returned"); } // illegal transition
  renew(_: Loan)  { throw new Error("Cannot renew a returned loan"); }
}

class Loan {
  constructor(private state: LoanState = new ActiveState()) {}
  setState(s: LoanState) { this.state = s; }
  return() { this.state.return(this); } // delegate to current state
  renew()  { this.state.renew(this); }
}
```

```csharp
// C# — same State machine
public interface ILoanState
{
    void Return(Loan loan);
    void Renew(Loan loan);
}

public class ActiveState : ILoanState
{
    public void Return(Loan loan) => loan.SetState(new ReturnedState());
    public void Renew(Loan loan)  { /* extend due date */ }
}
public class ReturnedState : ILoanState
{
    public void Return(Loan loan) => throw new InvalidOperationException("Already returned");
    public void Renew(Loan loan)  => throw new InvalidOperationException("Cannot renew a returned loan");
}

public class Loan(ILoanState? state = null)
{
    private ILoanState _state = state ?? new ActiveState();
    public void SetState(ILoanState s) => _state = s;
    public void Return() => _state.Return(this); // delegate to current state
    public void Renew()  => _state.Renew(this);
}
```

For simple lifecycles, an `enum` + a `switch` is often clearer than a class per state. State earns its keep when each state has rich, distinct behavior and the transition rules are complex enough that a `switch` would sprawl. (This is the OOP cousin of the TS *phantom-type state machine* in `javascript/notes/02-advanced-typescript.md` §2.7 — that one makes illegal transitions a *compile* error; this one makes them a *runtime* error.)

- **Use when:** an object's behavior depends heavily on its state, transitions have rules, and you want each state's logic isolated and the illegal transitions explicit.
- **Avoid when:** the lifecycle is two or three states with trivial behavior — an enum + guard clauses is simpler.

---

## 8.5 Patterns You're Already Using

You've shipped most of GoF without naming it. Recognising these is what turns "I write framework code" into "I understand the design underneath."

| Pattern | Where you've already used it | What it is |
|---|---|---|
| **Repository** | EF Core `DbSet<T>`, a Prisma/Drizzle wrapper, NestJS `*.repository.ts` | Abstracts data access behind a collection-like interface, so the domain doesn't know about SQL. |
| **Unit of Work** | EF Core `DbContext` + `SaveChanges()`, Prisma `$transaction` | Tracks a set of changes and commits them as one atomic transaction. |
| **Dependency Injection** | ASP.NET `builder.Services.Add*`, NestJS `@Injectable` + constructor injection | Hands an object its dependencies instead of letting it construct them — the runtime replacement for Singleton (§8.2). |
| **Middleware / Chain of Responsibility** | ASP.NET middleware pipeline, NestJS guards/interceptors, Express `app.use` | Each handler processes the request then optionally passes it to the next — a chain where any link can short-circuit. |
| **Mediator** | MediatR, NestJS `CommandBus`/`@CommandHandler` | Components talk to one mediator instead of to each other, decoupling sender from handler (pairs with Command, §8.4). |

```ts
// You write Repository + DI every day in NestJS without thinking "pattern":
@Injectable()
class LoanService {
  // DI: the service is HANDED its repository (an abstraction), doesn't `new` it.
  constructor(private loans: ILoanRepository) {} // ILoanRepository = Repository pattern
}
```

```csharp
// ...and the exact same shape in ASP.NET:
public class LoanService(ILoanRepository loans) // DI + Repository, both patterns at once
{
    public Task<Loan?> Find(string id) => loans.GetByIdAsync(id);
}
// Registration wires the abstraction to a concrete (this is also Strategy at the container level):
builder.Services.AddScoped<ILoanRepository, EfLoanRepository>();
```

**Middleware = Chain of Responsibility** is worth dwelling on: each middleware decides whether to handle the request, mutate it, and/or call `next()`. That "handle-or-pass-along" is the textbook CoR pattern, and the Decorator structure (§8.3) is what makes each link wrap the next.

The lesson: the frameworks you use are *built out of these patterns*. Knowing the names lets you read framework source, reason about extension points, and recognise when your own code is reinventing one.

---

## 8.6 The Anti-Pattern: Pattern Overuse

The most common pattern mistake is **using patterns**. Once you learn the catalogue, every problem looks like it needs a Factory wrapping a Strategy injected via an Abstract Factory. This is **"patternitis"** — adding ceremony that solves no real problem.

```ts
// PATTERNITIS — a "Strategy" + "Factory" for something that is one line:
interface IGreetingStrategy { greet(name: string): string; }
class FormalGreeting implements IGreetingStrategy { greet(n: string) { return `Hello, ${n}.`; } }
class GreetingFactory { static create(): IGreetingStrategy { return new FormalGreeting(); } }
GreetingFactory.create().greet("Tareq");

// WHAT IT SHOULD BE:
const greet = (name: string) => `Hello, ${name}.`;
greet("Tareq");
```

Every pattern is a trade: it buys *flexibility for a future change* at the cost of *indirection today*. The bill comes due immediately (more files, more concepts, harder-to-trace control flow); the benefit only arrives **if** the anticipated change actually happens. Speculative flexibility is the enemy.

### A sane decision procedure

1. **Write the simplest direct code first.** A function, an `if`, a constructor. Ship it.
2. **Wait for the pain.** A `switch` that grows with every feature → Strategy. A constructor with ten args → Builder. Duplicated wrapping logic → Decorator. The pain is the signal.
3. **Refactor *into* the pattern when the third case appears.** "Two is a coincidence, three is a pattern" — by the third variant you actually know the axis of change.
4. **Prefer the language feature.** A function over a one-method Strategy interface; an `enum` over a trivial State machine; DI over Singleton; object initialisers over a small Builder.
5. **Name what you have, don't force what you don't.** If your code already *is* a Strategy, call it one. Don't manufacture one for a problem you don't have.

> Patterns are a *destination you refactor toward when the problem appears*, not a *blueprint you start from*. The senior move isn't knowing the most patterns — it's knowing which ones the situation does **not** need.

---

## Gotchas

- **A pattern is a response to a problem, not a goal.** "Where can I use the Observer pattern?" is the wrong question. "What's the simplest thing that solves this?" is the right one — sometimes the answer happens to be Observer.
- **Singleton is almost always the wrong tool now.** If you have a DI container, register a singleton *lifetime* and inject an interface. The classic static-instance Singleton is a global in disguise and a testing headache (§8.2).
- **Decorator (GoF) ≠ `@decorator` (syntax).** They share a name and a spirit but are different mechanisms. The wrapping pattern is plain composition; the `@` syntax is metadata-driven (`javascript/notes/02-advanced-typescript.md` §2.6).
- **Strategy with one method is just a function** in both TS (`type P = (x) => y`) and C# (`Func<...>`). Don't reach for an interface + class until the strategy has multiple related methods.
- **Template Method vs Strategy is inheritance vs composition.** Default to Strategy (composition) — it's more flexible and you can swap at runtime (Phase 9: composition over inheritance).
- **Observer leaks memory.** Subscribing without unsubscribing keeps observers (and everything they reference) alive. In C# use weak event patterns or remember `-=`; in TS clear listeners on teardown.
- **Proxy vs Decorator look identical in code.** Same wrapping shape; the difference is *intent* — Decorator adds behavior, Proxy controls access. Name it by why it exists.
- **Don't confuse Factory with DI.** In a DI app the container already constructs your objects. A hand-rolled factory that just calls `new` duplicates the container's job — only build a factory for genuinely conditional/runtime-driven creation.
- **C# gives you several patterns as language features:** `event`/`delegate` (Observer), `IDisposable`/`using` (a guarding Proxy of sorts), records + `with` (immutable construction). Use them before hand-rolling the GoF version.

---

## Phase 8 Exercise

**Goal:** Implement three patterns in the Media Library, then port one across languages to feel the divergence.

**Location:** `examples/phase8-patterns/`

**Part A — pick your primary language (TS or C#) and implement all three:**

1. **Strategy — loan policies.** Define `ILoanPolicy` with `maxDays()` and `lateFee(daysLate)`. Provide `StandardPolicy` (14 days, $0.25/day), `StudentPolicy` (30 days, $0.10/day), and `StaffPolicy` (90 days, no fee). A `Loan` takes a policy in its constructor and exposes `dueDate(from)` and `feeIfReturnedOn(date)` — with **no `if`/`switch` on policy type** anywhere (that's the whole point).

2. **Observer — overdue notifications.** Give `Loan` a way to subscribe observers and a `checkOverdue(today)` that, when past due, notifies all subscribers. Implement two observers: `EmailReminder` and `AuditLog`. In the C# version, do it idiomatically with an `event` instead of a hand-rolled list — and note the difference in your notes.

3. **Factory — item creation.** Write `createItem(kind, data)` / `ItemFactory.Create(...)` that produces `Book`, `Audiobook`, or `DVD` (each `implements ILibraryItem` with its own `lateFeePerDay()`), so the import code never sees a concrete constructor.

**Part B — port one pattern to the other language.** Take your **Strategy** implementation and rewrite it in the other language. In a short note, answer:

- Where did **nominal vs structural typing** change what you had to write? (Did C# force an explicit `: ILoanPolicy` that TS inferred structurally?)
- Could you collapse any single-method strategy into a plain function (`Func<...>` / function type)? Where did that help and where did it hurt readability?
- Which patterns did your solution *not* need — and would adding them have been patternitis (§8.6)?

**Stretch:** add a **Decorator** — wrap any `ILoanPolicy` in a `HolidayGracePolicy` that adds 7 days to `maxDays()` and delegates `lateFee` unchanged. Notice you added behavior to *every* policy without touching any of them (Open/Closed).
