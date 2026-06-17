# Phase 7 — SOLID Principles

**Status:** In Progress
**Prereqs:** Phases 4–6 (inheritance, polymorphism, abstraction). The `LateFee` (Phase 5) and `ILoanPolicy` (Phase 6) exercises pay off here.

---

## Why SOLID, and How to Read This File

SOLID is five design principles (Robert C. Martin assembled the acronym) that together push you toward code that is **easy to change without fear**. None of them is new physics — they are names for habits good designers already had. The value of having names is that you can *talk* about a design and spot the smell before it metastasises.

The five:

| Letter | Principle | One-line summary | Smell it fixes |
|--------|-----------|------------------|----------------|
| **S** | Single Responsibility | A class should have one reason to change | God class / "and" in the description |
| **O** | Open/Closed | Open for extension, closed for modification | A growing `switch` you edit for every new case |
| **L** | Liskov Substitution | Subtypes must be usable wherever the base is | A subclass that throws or no-ops on inherited behaviour |
| **I** | Interface Segregation | Many small interfaces beat one fat one | `throw new NotImplementedException()` in an impl |
| **D** | Dependency Inversion | Depend on abstractions, not concretions | `new ConcreteThing()` buried in business logic |

We use one running domain — the **Media Library** (books, audiobooks, members, loans) — and every idea is shown in **both TypeScript and C#**. Where the two languages genuinely diverge (structural vs nominal typing, runtime presence of interfaces), it's called out.

> **Mental anchor for a TS/Node dev:** you already obey most of SOLID in NestJS without naming it. `@Injectable()` services injected by interface token = DIP. Small focused providers = SRP + ISP. Strategy-style `ILoanPolicy` swapped without editing callers = OCP. This phase makes the implicit explicit.

---

## 7.1 Single Responsibility Principle (SRP)

### The Idea: One Reason to Change

> "A class should have only one reason to change." — and "reason to change" means **one actor / one stakeholder** who can demand the code change.

The common misreading is "a class should do only one thing." That's too vague — every class does many small things. The sharper test is **cohesion of *reasons***: if the billing team and the reporting team and the DBA can each independently force you to edit the same class, that class has three responsibilities and three reasons to change. They will eventually collide in merge conflicts and accidental breakage.

A quick heuristic: describe the class out loud. If you need the word **"and"** ("it formats the loan receipt **and** saves it to the database **and** emails the member"), you probably have multiple responsibilities.

### Before — A God Class

This `LibraryService` is doing far too much: business rules, formatting, persistence, and notification all live together.

```ts
// TypeScript — BEFORE: one class, four reasons to change
class LibraryService {
  constructor(private db: PgClient, private smtp: SmtpClient) {}

  async checkout(memberId: string, bookId: string): Promise<void> {
    // (1) BUSINESS RULE — changes when loan policy changes
    const activeLoans = await this.db.query(
      'SELECT count(*) FROM loans WHERE member_id=$1 AND returned_at IS NULL', [memberId]);
    if (Number(activeLoans.rows[0].count) >= 5) {
      throw new Error('Loan limit reached');
    }

    // (2) PERSISTENCE — changes when the database/schema changes
    await this.db.query(
      'INSERT INTO loans (member_id, book_id, due_at) VALUES ($1,$2,$3)',
      [memberId, bookId, new Date(Date.now() + 14 * 86_400_000)]);

    // (3) FORMATTING — changes when the receipt layout changes
    const receipt = `Receipt\n=======\nMember: ${memberId}\nBook: ${bookId}\nDue in 14 days`;

    // (4) NOTIFICATION — changes when we switch from email to push/SMS
    await this.smtp.send(memberId, 'Your loan receipt', receipt);
  }
}
```

```csharp
// C# — BEFORE: same god class, four reasons to change
public class LibraryService
{
    private readonly NpgsqlConnection _db;
    private readonly SmtpClient _smtp;

    public LibraryService(NpgsqlConnection db, SmtpClient smtp) { _db = db; _smtp = smtp; }

    public async Task CheckoutAsync(string memberId, string bookId)
    {
        // (1) BUSINESS RULE
        var active = await CountActiveLoansAsync(memberId);
        if (active >= 5) throw new InvalidOperationException("Loan limit reached");

        // (2) PERSISTENCE
        await InsertLoanAsync(memberId, bookId, DateTime.UtcNow.AddDays(14));

        // (3) FORMATTING
        var receipt = $"Receipt\n=======\nMember: {memberId}\nBook: {bookId}\nDue in 14 days";

        // (4) NOTIFICATION
        await _smtp.SendMailAsync(memberId, "Your loan receipt", receipt);
    }
    // ... helper methods omitted
}
```

### After — Split by Reason to Change

Each collaborator now owns exactly one responsibility. `LoanService` *coordinates* them — orchestration is itself a legitimate single responsibility.

```ts
// TypeScript — AFTER: one reason to change per class
class LoanPolicy {                                  // (1) business rules only
  static readonly MAX_ACTIVE = 5;
  static readonly LOAN_DAYS = 14;
  ensureCanBorrow(activeLoanCount: number): void {
    if (activeLoanCount >= LoanPolicy.MAX_ACTIVE) throw new Error('Loan limit reached');
  }
  dueDate(from: Date): Date { return new Date(from.getTime() + LoanPolicy.LOAN_DAYS * 86_400_000); }
}

interface LoanRepository {                          // (2) persistence contract
  countActive(memberId: string): Promise<number>;
  add(loan: { memberId: string; bookId: string; dueAt: Date }): Promise<void>;
}

class ReceiptFormatter {                            // (3) formatting only
  format(memberId: string, bookId: string, dueAt: Date): string {
    return `Receipt\n=======\nMember: ${memberId}\nBook: ${bookId}\nDue: ${dueAt.toDateString()}`;
  }
}

interface Notifier {                                // (4) notification contract
  send(memberId: string, subject: string, body: string): Promise<void>;
}

class LoanService {                                 // coordinator — ONE reason: the checkout workflow
  constructor(
    private loans: LoanRepository,
    private policy: LoanPolicy,
    private receipts: ReceiptFormatter,
    private notifier: Notifier,
  ) {}

  async checkout(memberId: string, bookId: string): Promise<void> {
    const active = await this.loans.countActive(memberId);
    this.policy.ensureCanBorrow(active);
    const dueAt = this.policy.dueDate(new Date());
    await this.loans.add({ memberId, bookId, dueAt });
    await this.notifier.send(memberId, 'Your loan receipt',
      this.receipts.format(memberId, bookId, dueAt));
  }
}
```

```csharp
// C# — AFTER: one reason to change per class
public class LoanPolicy                              // (1) business rules only
{
    public const int MaxActive = 5;
    public const int LoanDays = 14;
    public void EnsureCanBorrow(int activeLoanCount)
    {
        if (activeLoanCount >= MaxActive) throw new InvalidOperationException("Loan limit reached");
    }
    public DateTime DueDate(DateTime from) => from.AddDays(LoanDays);
}

public interface ILoanRepository                     // (2) persistence contract
{
    Task<int> CountActiveAsync(string memberId);
    Task AddAsync(Loan loan);
}

public class ReceiptFormatter                         // (3) formatting only
{
    public string Format(string memberId, string bookId, DateTime dueAt) =>
        $"Receipt\n=======\nMember: {memberId}\nBook: {bookId}\nDue: {dueAt:D}";
}

public interface INotifier                            // (4) notification contract
{
    Task SendAsync(string memberId, string subject, string body);
}

public class LoanService                              // coordinator — ONE reason
{
    private readonly ILoanRepository _loans;
    private readonly LoanPolicy _policy;
    private readonly ReceiptFormatter _receipts;
    private readonly INotifier _notifier;

    public LoanService(ILoanRepository loans, LoanPolicy policy,
                       ReceiptFormatter receipts, INotifier notifier)
    {
        _loans = loans; _policy = policy; _receipts = receipts; _notifier = notifier;
    }

    public async Task CheckoutAsync(string memberId, string bookId)
    {
        var active = await _loans.CountActiveAsync(memberId);
        _policy.EnsureCanBorrow(active);
        var dueAt = _policy.DueDate(DateTime.UtcNow);
        await _loans.AddAsync(new Loan(memberId, bookId, dueAt));
        await _notifier.SendAsync(memberId, "Your loan receipt",
            _receipts.Format(memberId, bookId, dueAt));
    }
}
```

### What SRP Bought Us

- **Cohesion went up:** each unit reads top-to-bottom as one job.
- **Testability:** you can unit-test `LoanPolicy.ensureCanBorrow` with zero database and zero SMTP — pure logic. (This is the same payoff as the rich domain entity in `javascript/notes/05-clean-architecture-nest.md` §5.4: logic you can test with no mocks.)
- **Independent change:** the receipt layout changes without risking the loan limit rule.

> **Caution (revisited in 7.6):** SRP taken to extremes produces a swarm of one-method classes and a coordinator that does nothing but pass data around. "One reason to change" is about *actors*, not *line count*. Don't split `dueDate` and `ensureCanBorrow` apart — they change for the same reason (the loan policy).

---

## 7.2 Open/Closed Principle (OCP)

### The Idea: Open for Extension, Closed for Modification

> Software entities should be **open for extension, but closed for modification.**

You should be able to add new behaviour by adding new code, not by editing existing, tested, shipped code. The enemy is the **growing `switch`/`if-else` over a type tag**: every new item type forces you back into the same function, re-testing everything you didn't change.

The mechanism is **polymorphism behind an abstraction** — exactly the muscle you built in Phases 5 and 6. This is where the Phase 5 `LateFee` exercise ("no `if (item is Book)` allowed") pays off.

### Before — A Switch That Grows

Every new item type means editing `calculateLateFee`. It's *closed* to extension and *open* to modification — backwards.

```ts
// TypeScript — BEFORE: edit this function for every new item type
type ItemKind = 'book' | 'audiobook' | 'dvd';

function calculateLateFee(kind: ItemKind, daysLate: number): number {
  switch (kind) {
    case 'book':      return daysLate * 0.25;
    case 'audiobook': return daysLate * 0.15;
    case 'dvd':       return daysLate * 1.00;   // add 'magazine' here → re-touch + re-test all
    default:          throw new Error(`Unknown item kind: ${kind}`);
  }
}
```

```csharp
// C# — BEFORE: the same growing switch
public enum ItemKind { Book, Audiobook, Dvd }

public static decimal CalculateLateFee(ItemKind kind, int daysLate) => kind switch
{
    ItemKind.Book      => daysLate * 0.25m,
    ItemKind.Audiobook => daysLate * 0.15m,
    ItemKind.Dvd       => daysLate * 1.00m,   // every new kind reopens this method
    _ => throw new ArgumentOutOfRangeException(nameof(kind)),
};
```

### After — Polymorphism via a Base/Interface

Each item type owns its own fee rule. Adding `Magazine` is a *new file*; nothing existing is touched.

```ts
// TypeScript — AFTER: closed for modification, open for extension
abstract class LibraryItem {
  constructor(public readonly title: string) {}
  abstract lateFeePerDay(): number;                 // the extension point
  lateFee(daysLate: number): number { return daysLate * this.lateFeePerDay(); }
}

class Book extends LibraryItem      { lateFeePerDay() { return 0.25; } }
class Audiobook extends LibraryItem { lateFeePerDay() { return 0.15; } }
class Dvd extends LibraryItem       { lateFeePerDay() { return 1.00; } }

// ADDING A NEW TYPE — a new class, zero edits to existing code:
class Magazine extends LibraryItem  { lateFeePerDay() { return 0.10; } }

// Callers never branch on type — pure polymorphic dispatch:
function totalLateFees(items: { item: LibraryItem; daysLate: number }[]): number {
  return items.reduce((sum, { item, daysLate }) => sum + item.lateFee(daysLate), 0);
}
```

```csharp
// C# — AFTER: same shape, with explicit virtual/override
public abstract class LibraryItem
{
    public string Title { get; }
    protected LibraryItem(string title) => Title = title;
    public abstract decimal LateFeePerDay();          // extension point
    public decimal LateFee(int daysLate) => daysLate * LateFeePerDay();
}

public class Book : LibraryItem
{
    public Book(string title) : base(title) { }
    public override decimal LateFeePerDay() => 0.25m;
}
public class Audiobook : LibraryItem
{
    public Audiobook(string title) : base(title) { }
    public override decimal LateFeePerDay() => 0.15m;
}
public class Dvd : LibraryItem
{
    public Dvd(string title) : base(title) { }
    public override decimal LateFeePerDay() => 1.00m;
}

// ADDING A NEW TYPE — a new class, no edits anywhere else:
public class Magazine : LibraryItem
{
    public Magazine(string title) : base(title) { }
    public override decimal LateFeePerDay() => 0.10m;
}

// Caller — no type checks, just dispatch:
public static decimal TotalLateFees(IEnumerable<(LibraryItem item, int daysLate)> rows) =>
    rows.Sum(r => r.item.LateFee(r.daysLate));
```

### OCP via a Strategy Interface (the `ILoanPolicy` payoff)

OCP isn't only about subclasses. The Phase 6 `ILoanPolicy` is the **Strategy pattern** — and it's OCP applied to *behaviour you inject* rather than *types you subclass*. The library is closed: it depends on the interface and never changes. New policies are new implementations.

```ts
// TypeScript — OCP via injected strategy
interface LoanPolicy {
  maxActiveLoans(): number;
  loanDays(): number;
}
class StandardPolicy implements LoanPolicy { maxActiveLoans() { return 5; }  loanDays() { return 14; } }
class StudentPolicy  implements LoanPolicy { maxActiveLoans() { return 10; } loanDays() { return 28; } }
class StaffPolicy    implements LoanPolicy { maxActiveLoans() { return 50; } loanDays() { return 90; } }

class Library {
  constructor(private policy: LoanPolicy) {}        // closed: depends only on the abstraction
  canBorrow(activeLoans: number): boolean { return activeLoans < this.policy.maxActiveLoans(); }
}
// New tier? Add `class VipPolicy implements LoanPolicy {...}` — Library is untouched.
```

```csharp
// C# — OCP via injected strategy
public interface ILoanPolicy
{
    int MaxActiveLoans();
    int LoanDays();
}
public class StandardPolicy : ILoanPolicy { public int MaxActiveLoans() => 5;  public int LoanDays() => 14; }
public class StudentPolicy  : ILoanPolicy { public int MaxActiveLoans() => 10; public int LoanDays() => 28; }
public class StaffPolicy    : ILoanPolicy { public int MaxActiveLoans() => 50; public int LoanDays() => 90; }

public class Library
{
    private readonly ILoanPolicy _policy;            // closed: only the abstraction
    public Library(ILoanPolicy policy) => _policy = policy;
    public bool CanBorrow(int activeLoans) => activeLoans < _policy.MaxActiveLoans();
}
// New tier? Add a new ILoanPolicy class — Library never changes.
```

> **Judgment:** OCP costs an abstraction up front. Apply it where you *expect variation* (item types, loan tiers, payment providers). Don't pre-abstract a thing that has exactly one implementation and no foreseeable second one — that's speculative generality (see 7.6). The honest rule: when you reach for a *third* `case`, that's the signal to invert to polymorphism.

---

## 7.3 Liskov Substitution Principle (LSP)

### The Idea: Subtypes Must Honour the Base Type's Contract

> If `S` is a subtype of `T`, then objects of type `T` may be replaced with objects of type `S` **without altering the correctness** of the program.

In plain terms: anywhere code expects a base type, *any* subtype must work — not just compile, but **behave** according to what callers were promised. LSP is about the *behavioural* contract, which the type system cannot fully check for you. A subclass that overrides a method to throw, to no-op, or to silently change the meaning of the inputs/outputs **violates LSP even though it compiles**.

The contract has three parts (Bertrand Meyer, "Design by Contract"):

- **Preconditions** (what the method requires of callers) — a subtype may **weaken** them (accept more), never strengthen them (demand more). If the base accepts any positive number, the subtype must not suddenly reject odd numbers.
- **Postconditions** (what the method guarantees on return) — a subtype may **strengthen** them (promise more), never weaken them. If the base guarantees a sorted list, the subtype must not return an unsorted one.
- **Invariants** — properties true before and after every call must be preserved by the subtype.

Slogan: **"Require no more, promise no less."**

### The Classic Violation: Rectangle / Square — Explained Properly

The textbook example is misunderstood as often as it's cited. The point is **not** "a square isn't a rectangle in geometry." Mathematically it is. The point is that a *mutable* `Square` cannot satisfy the **behavioural contract** of a *mutable* `Rectangle`.

The Rectangle contract includes an implicit postcondition: **setting width does not change height, and vice versa.** A Square must keep its sides equal — so it *must* break that postcondition. Inheritance forces the Square to lie.

```ts
// TypeScript — the violation
class Rectangle {
  constructor(protected w: number, protected h: number) {}
  setWidth(w: number)  { this.w = w; }              // contract: changing width leaves height alone
  setHeight(h: number) { this.h = h; }
  get area(): number { return this.w * this.h; }
}

class Square extends Rectangle {
  // To stay square, setting one side MUST change the other —
  // which silently violates Rectangle's postcondition.
  setWidth(w: number)  { this.w = w; this.h = w; }
  setHeight(h: number) { this.w = h; this.h = h; }
}

// A function written against the BASE contract:
function resizeAndCheck(rect: Rectangle): void {
  rect.setWidth(5);
  rect.setHeight(4);
  // The Rectangle contract guarantees area === 20. Caller relies on this.
  console.assert(rect.area === 20, `expected 20, got ${rect.area}`);
}

resizeAndCheck(new Rectangle(0, 0)); // ✓ area 20
resizeAndCheck(new Square(0, 0));    // ✗ area 16 — Square broke the substitution
```

```csharp
// C# — the same violation (note: methods must be virtual to override behaviour)
public class Rectangle
{
    protected int W, H;
    public Rectangle(int w, int h) { W = w; H = h; }
    public virtual void SetWidth(int w)  => W = w;     // contract: width-only change
    public virtual void SetHeight(int h) => H = h;
    public int Area => W * H;
}

public class Square : Rectangle
{
    public Square(int s) : base(s, s) { }
    public override void SetWidth(int w)  { W = w; H = w; }  // breaks the postcondition
    public override void SetHeight(int h) { W = h; H = h; }
}

public static void ResizeAndCheck(Rectangle rect)
{
    rect.SetWidth(5);
    rect.SetHeight(4);
    // Base contract guarantees 20; a Square yields 16.
    if (rect.Area != 20) throw new InvalidOperationException($"expected 20, got {rect.Area}");
}
// ResizeAndCheck(new Square(0)); // throws — substitution is unsafe
```

**Why it matters:** `resizeAndCheck` is *correct* code written against the `Rectangle` contract. Passing a `Square` breaks it — and the compiler said nothing. That's the danger: LSP violations are **silent**. The fix is almost never "make the override smarter"; it's to stop pretending the *is-a* holds for *mutable* shapes.

### The Fix: Don't Force a False "is-a"

Several escapes, in rough order of preference:

1. **Make them immutable.** An immutable `Square` that returns a *new* shape from `withWidth` has no postcondition to break — there's no "changing width independently" to violate.
2. **Drop the inheritance.** Model `Shape` with a read-only `area`; `Square` and `Rectangle` are siblings, not parent/child.
3. **Don't expose the mutator that can't be honoured.**

```ts
// TypeScript — fix via a read-only abstraction (siblings, not subtype)
interface Shape { area(): number; }
class Rectangle2 implements Shape {
  constructor(private readonly w: number, private readonly h: number) {}
  area() { return this.w * this.h; }
}
class Square2 implements Shape {
  constructor(private readonly side: number) {}
  area() { return this.side ** 2; }
}
// Any Shape is freely substitutable — there is no mutator contract to break.
```

```csharp
// C# — same fix; records make immutability + value equality free
public interface IShape { double Area(); }
public record Rectangle2(double W, double H) : IShape { public double Area() => W * H; }
public record Square2(double Side) : IShape { public double Area() => Side * Side; }
```

### A Media-Library LSP Trap

A subtler, on-domain example. Suppose `LibraryItem` has `checkout()`. Someone adds a `ReferenceBook` (encyclopedias — must stay in the building) and overrides `checkout()` to throw.

```ts
// TypeScript — LSP violation in the domain
class LibraryItem3 {
  checkout(): void { /* records the loan */ }       // base contract: this succeeds for any item
}
class ReferenceBook extends LibraryItem3 {
  checkout(): void { throw new Error('Reference items cannot be checked out'); } // ✗ breaks callers
}

function checkoutAll(items: LibraryItem3[]): void {
  for (const item of items) item.checkout();        // expects every item to be checkout-able
}
```

This compiles and blows up at runtime. The override **strengthened the precondition** ("only if not a reference item"), which LSP forbids. The honest fix is to model the capability explicitly so the type system separates checkout-able items — which is exactly **Interface Segregation** (7.4):

```ts
// TypeScript — fix: model the capability, don't fake the hierarchy
interface Borrowable { checkout(): void; }
class Book3 implements Borrowable { checkout() { /* ... */ } }
class ReferenceBook3 { /* a LibraryItem, but simply NOT Borrowable */ }

function checkoutAll2(items: Borrowable[]): void {  // type now guarantees every item is borrowable
  for (const item of items) item.checkout();
}
```

```csharp
// C# — same fix via interface capability
public interface IBorrowable { void Checkout(); }
public class Book3 : IBorrowable { public void Checkout() { /* ... */ } }
public class ReferenceBook3 { /* a library item, but does NOT implement IBorrowable */ }

public static void CheckoutAll(IEnumerable<IBorrowable> items)
{
    foreach (var item in items) item.Checkout();    // every element is borrowable by construction
}
```

> **LSP is the principle the compiler can't enforce.** Inheritance gives you *syntactic* substitutability (it compiles); LSP demands *semantic* substitutability (it behaves). When an override has to throw, no-op, or quietly redefine a method's meaning, the inheritance was a lie — reach for composition or a narrower interface.

---

## 7.4 Interface Segregation Principle (ISP)

### The Idea: No Client Should Depend on Methods It Doesn't Use

> Many small, client-specific interfaces are better than one large, general-purpose interface.

A **fat interface** forces its implementers to provide methods that make no sense for them — and the giveaway smell is **empty implementations**: `throw new NotImplementedException()`, an empty body, or a `return null` that nobody should call. Each such stub is a latent LSP violation (it breaks the contract) and a coupling trap (clients drag in methods they never touch).

### Before — One Fat Interface

Every media item is forced to implement *everything*, even when it makes no sense. A digital ebook has no physical condition; an audiobook has no page count.

```ts
// TypeScript — BEFORE: a fat interface forces nonsense implementations
interface MediaItem {
  getTitle(): string;
  play(): void;                 // only audio/video
  getPageCount(): number;       // only paper/ebook
  getPhysicalCondition(): string; // only physical copies
  download(): void;             // only digital
}

class PaperBook implements MediaItem {
  getTitle() { return 'Dune'; }
  getPageCount() { return 412; }
  getPhysicalCondition() { return 'good'; }
  play() { throw new Error('A paper book cannot be played'); }     // ✗ stub smell
  download() { throw new Error('A paper book cannot be downloaded'); } // ✗ stub smell
}
```

```csharp
// C# — BEFORE: the same fat interface
public interface IMediaItem
{
    string GetTitle();
    void Play();
    int GetPageCount();
    string GetPhysicalCondition();
    void Download();
}

public class PaperBook : IMediaItem
{
    public string GetTitle() => "Dune";
    public int GetPageCount() => 412;
    public string GetPhysicalCondition() => "good";
    public void Play()    => throw new NotImplementedException("A paper book cannot be played");
    public void Download()=> throw new NotImplementedException("A paper book cannot be downloaded");
}
```

### After — Small, Focused, Role-Based Interfaces

Split the fat interface into **capabilities**. A type implements exactly the roles it actually fills, and clients depend only on the slice they use.

```ts
// TypeScript — AFTER: segregated, role-based interfaces
interface Titled    { getTitle(): string; }
interface Playable  { play(): void; }
interface Paginated { getPageCount(): number; }
interface Physical  { getPhysicalCondition(): string; }
interface Digital   { download(): void; }

// Each type composes ONLY the capabilities it truly has:
class PaperBook2 implements Titled, Paginated, Physical {
  getTitle() { return 'Dune'; }
  getPageCount() { return 412; }
  getPhysicalCondition() { return 'good'; }
  // no play(), no download() — and nothing forces empty stubs
}
class Ebook implements Titled, Paginated, Digital {
  getTitle() { return 'Dune'; }
  getPageCount() { return 412; }
  download() { /* stream bytes */ }
}
class Audiobook2 implements Titled, Playable, Digital {
  getTitle() { return 'Dune'; }
  play() { /* start playback */ }
  download() { /* ... */ }
}

// A client depends on the narrowest interface it needs:
function playEverythingPlayable(items: Playable[]): void {
  for (const it of items) it.play();   // can ONLY be handed playable things
}
```

```csharp
// C# — AFTER: segregated interfaces (a class can implement many)
public interface ITitled    { string GetTitle(); }
public interface IPlayable  { void Play(); }
public interface IPaginated { int GetPageCount(); }
public interface IPhysical  { string GetPhysicalCondition(); }
public interface IDigital   { void Download(); }

public class PaperBook2 : ITitled, IPaginated, IPhysical
{
    public string GetTitle() => "Dune";
    public int GetPageCount() => 412;
    public string GetPhysicalCondition() => "good";
}
public class Ebook : ITitled, IPaginated, IDigital
{
    public string GetTitle() => "Dune";
    public int GetPageCount() => 412;
    public void Download() { /* ... */ }
}
public class Audiobook2 : ITitled, IPlayable, IDigital
{
    public string GetTitle() => "Dune";
    public void Play() { /* ... */ }
    public void Download() { /* ... */ }
}

public static void PlayEverything(IEnumerable<IPlayable> items)
{
    foreach (var it in items) it.Play();   // the type guarantees each is playable
}
```

### The TS / C# Divergence That Matters Here

This is one of the clearest places the two languages differ:

- **C# is nominal.** A class must *explicitly declare* `: IPlayable`. If it doesn't, it isn't playable, full stop — even if it happens to have a `Play()` method.
- **TypeScript is structural.** A type satisfies `Playable` if it merely *has the right shape* (`play(): void`), whether or not it says `implements Playable`. (See `javascript/notes/02-advanced-typescript.md` §2.1.) `implements` in TS is an assertion the compiler checks, not a runtime relationship — and at runtime the interface doesn't exist at all. That last fact is exactly why NestJS/DI must inject interfaces via a **token**, not by type (7.5).

> **The ISP test:** look at each implementer. If any method is a stub (`throw`, no-op, `return null` "because it'll never be called"), the interface is too fat — segregate it. ISP and LSP are two views of the same health check: a stub both fails ISP (unused method forced on you) *and* fails LSP (the stub breaks the contract).

---

## 7.5 Dependency Inversion Principle (DIP)

### The Idea: Depend on Abstractions, Not Concretions

DIP is two statements:

1. **High-level modules should not depend on low-level modules. Both should depend on abstractions.**
2. **Abstractions should not depend on details. Details should depend on abstractions.**

"High-level" = policy, the *why* of your app (the loan workflow). "Low-level" = mechanism, the *how* (Postgres, SMTP, the file system). The intuition most people start with — "high-level code calls low-level code, so it depends on it" — is exactly the dependency DIP **inverts**.

### Before — High-Level Code Nailed to a Detail

`LoanService` reaches out and `new`s a concrete Postgres repository. The business policy now *depends on* Postgres. Swap the database, and you edit business code; unit-test it, and you need a real database.

```ts
// TypeScript — BEFORE: high-level depends on a concrete low-level detail
import { PostgresLoanRepository } from '../infra/postgres-loan-repository';

class LoanService {
  private repo = new PostgresLoanRepository();      // ✗ hard dependency on a detail
  async checkout(memberId: string, bookId: string) {
    await this.repo.add(memberId, bookId);          // can't test without real Postgres
  }
}
```

```csharp
// C# — BEFORE: same hard coupling
public class LoanService
{
    private readonly PostgresLoanRepository _repo = new();  // ✗ concrete dependency
    public async Task CheckoutAsync(string memberId, string bookId)
        => await _repo.AddAsync(memberId, bookId);
}
```

The dependency arrow points the wrong way:

```
   LoanService  ──depends on──▶  PostgresLoanRepository   (policy chained to a detail)
   (high-level)                  (low-level)
```

### After — Both Depend on an Abstraction the High-Level Module Owns

Introduce an interface. The crucial, often-missed point: **the abstraction belongs to the high-level module, not the low-level one.** The domain *declares what it needs* (`LoanRepository`); the infrastructure *implements* it. The arrow flips.

```ts
// TypeScript — AFTER: high-level owns the abstraction; detail implements it

// --- owned by the high-level/domain side ---
interface LoanRepository {                           // the abstraction lives WITH the policy
  add(memberId: string, bookId: string): Promise<void>;
}

class LoanService {
  constructor(private repo: LoanRepository) {}        // depends only on the abstraction
  async checkout(memberId: string, bookId: string) {
    await this.repo.add(memberId, bookId);           // testable with a fake repo
  }
}

// --- the low-level detail, which now depends on (implements) the abstraction ---
class PostgresLoanRepository implements LoanRepository {
  async add(memberId: string, bookId: string) { /* INSERT ... */ }
}
```

```csharp
// C# — AFTER: identical inversion
// owned by the domain/high-level side:
public interface ILoanRepository
{
    Task AddAsync(string memberId, string bookId);
}

public class LoanService
{
    private readonly ILoanRepository _repo;
    public LoanService(ILoanRepository repo) => _repo = repo;   // abstraction only
    public async Task CheckoutAsync(string memberId, string bookId)
        => await _repo.AddAsync(memberId, bookId);
}

// the detail implements the abstraction:
public class PostgresLoanRepository : ILoanRepository
{
    public async Task AddAsync(string memberId, string bookId) { /* INSERT ... */ }
}
```

Now both arrows point at the abstraction — and the abstraction sits on the high-level side:

```
   LoanService  ──▶  ILoanRepository  ◀──  PostgresLoanRepository
   (high-level)      (abstraction,         (low-level detail now
                      owned by domain)      depends on the abstraction)
```

This *is* the Clean Architecture "dependency rule" from `javascript/notes/05-clean-architecture-nest.md` §5.1: source dependencies point inward, infrastructure points *up* into the domain to implement its interfaces. DIP is the principle; Clean Architecture is DIP applied at the scale of whole layers.

### Who Owns the Interface? (the part everyone gets wrong)

A repository interface defined inside the *infrastructure* package, next to its Postgres implementation, has **not** inverted anything — the domain still effectively depends on infrastructure. The inversion only happens when the interface lives where the **consumer** (the high-level policy) can own it. Rule of thumb: **the client owns the interface it depends on.** In Clean Architecture terms, `ILoanRepository` lives in `Domain`, `PostgresLoanRepository` lives in `Infrastructure`.

### DIP Makes Dependency Injection Natural

Once your high-level code depends only on abstractions, *something* must supply the concrete implementation at runtime. That "something" is **Dependency Injection** — and the DI container is just an automated way to do it. DIP is the *principle*; DI is the *mechanism*; a DI container is the *tool*.

**ASP.NET Core** (see `.net/notes/02-aspnet-basics.md` §2.3) — register the binding once at the composition root:

```csharp
// Program.cs — the composition root: abstraction → implementation
builder.Services.AddScoped<ILoanRepository, PostgresLoanRepository>();
builder.Services.AddScoped<LoanService>();
// LoanService's constructor asks for ILoanRepository; the container supplies the Postgres one.
// To switch databases or test, change ONE line here — no business code changes.
```

**NestJS** — same idea, but because TS interfaces vanish at runtime you must bind via a **token** (this is the single most important Clean-Architecture pattern in Nest, per `javascript/notes/05-clean-architecture-nest.md` §5.2):

```ts
// a token, because the `LoanRepository` interface doesn't exist at runtime in JS
export const LOAN_REPOSITORY = Symbol('LOAN_REPOSITORY');

@Module({
  providers: [
    LoanService,
    { provide: LOAN_REPOSITORY, useClass: PostgresLoanRepository }, // bind token → impl
  ],
})
export class LoanModule {}

// inject by token:
@Injectable()
export class LoanService {
  constructor(@Inject(LOAN_REPOSITORY) private readonly repo: LoanRepository) {}
}
```

> **The TS/C# divergence, one more time:** in C# you inject `ILoanRepository` *by its type* — the container resolves it because interfaces are real, nominal runtime entities. In TS the interface is erased at compile time, so you inject a `Symbol`/string **token** mapped to a class. Same DIP, different plumbing — and the reason for the difference is structural vs nominal typing plus interface erasure.

### The Testing Payoff

DIP is what makes the seams that tests plug into. Because `LoanService` depends on `LoanRepository` (abstraction), a unit test injects an in-memory fake — no database, no container.

```ts
// TypeScript — a fake implementation, injected for a unit test
class InMemoryLoanRepository implements LoanRepository {
  public readonly added: { memberId: string; bookId: string }[] = [];
  async add(memberId: string, bookId: string) { this.added.push({ memberId, bookId }); }
}

// test:
const repo = new InMemoryLoanRepository();
const service = new LoanService(repo);
await service.checkout('m1', 'b1');
console.assert(repo.added.length === 1);
```

```csharp
// C# — same, with a hand-rolled fake (or Moq)
public class InMemoryLoanRepository : ILoanRepository
{
    public List<(string, string)> Added { get; } = new();
    public Task AddAsync(string memberId, string bookId)
    { Added.Add((memberId, bookId)); return Task.CompletedTask; }
}

// test:
var repo = new InMemoryLoanRepository();
var service = new LoanService(repo);
await service.CheckoutAsync("m1", "b1");
Assert.Single(repo.Added);
```

This is the same seam the Phase 5 clean-arch project relies on ("handler tests pass with a fake repository implementing the interface").

---

## 7.6 SOLID Together

### How the Five Reinforce One Another

SOLID isn't five unrelated rules — they form a chain, each enabling the next:

- **SRP** gives you small, single-purpose classes. Small classes are the *units* the other principles operate on. (Hard to apply OCP/DIP to a 2,000-line god class.)
- **ISP** keeps the interfaces those classes depend on small and role-shaped — which is just SRP applied to *interfaces*.
- **DIP** says depend on those (small) interfaces, not concretions — and small interfaces (ISP) make the dependencies honest and easy to fake.
- **OCP** is *achieved through* DIP + polymorphism: because callers depend on an abstraction, you extend by adding an implementation, not editing the caller.
- **LSP** is the quality gate on OCP: substituting a new implementation only works if it actually honours the contract. An LSP violation turns an OCP extension point into a runtime landmine.

A way to see the whole machine at once, on the Media Library:

```
ILoanPolicy / ILoanRepository  (small, role-shaped interfaces)   ← ISP shapes them
        ▲                              ▲
        │ depends on                   │ depends on
   LoanService (one job: checkout)  ────────────────────────     ← SRP sizes the class
        │ injected at the composition root                       ← DIP wires it
        ▼
   Standard/Student/StaffPolicy, Postgres/InMemory repos          ← OCP: add, don't edit
   (each a faithful substitute for its interface)                 ← LSP keeps them honest
```

### SOLID Is a Means, Not an End

The goal was never "obey five principles." The goal is **code you can change safely and cheaply.** SOLID is a set of heuristics that *usually* moves you toward that goal. When a principle, applied to a particular case, makes the code *harder* to understand or change, the principle loses — not your judgment.

**Over-application is a real and common failure mode:**

- **SRP taken too far** → a cloud of anaemic one-method classes and a coordinator that only forwards calls. You traded one big readable file for ten tiny files and a jigsaw puzzle. (Cross-ref the *anemic domain model* anti-pattern, Phase 9 / `.net/notes/04-clean-architecture.md`.)
- **OCP / DIP taken too far** → an interface for every class, a factory for every `new`, indirection you must trace through five files to answer "what actually runs?" This is **speculative generality**: paying for flexibility you don't need yet (YAGNI).
- **ISP taken too far** → interfaces so granular they're noise (`ITitled`, `IIdentifiable`, `INameable` everywhere).

The honest defaults:

- Start concrete. A single implementation needs **no interface**. Introduce the abstraction when the *second* implementation (or the *test seam*) actually appears — the "rule of three" applies to abstractions too.
- Let the smell pull the principle, not the other way around. A growing `switch` pulls OCP. A stub method pulls ISP. A `new ConcreteThing()` in business logic that you need to fake in a test pulls DIP.
- The five principles are *most* valuable at the seams where your code meets the volatile outside world (databases, transports, third-party APIs) and at points of genuine, known variation. They're *least* valuable deep inside stable, simple logic.

### The Chain: SOLID → DI Containers → Clean Architecture

These three are the same idea at three scales:

| Scale | What it is | Driven by |
|-------|-----------|-----------|
| **Class** | A class depends on an abstraction it's handed | DIP + ISP |
| **Application** | A DI container wires every abstraction → implementation at one composition root | DIP, automated |
| **System** | Layers (Domain / Application / Infrastructure) with dependencies pointing inward | DIP at architectural scale = Clean Architecture |

DIP at the class level, repeated and automated, *is* a DI container. The dependency rule of Clean Architecture (`javascript/notes/05-clean-architecture-nest.md` §5.1; `.net/notes/04-clean-architecture.md`) is just DIP applied to whole layers: the domain owns the interfaces, infrastructure implements them, and the container binds them at the edge. Understand DIP and you understand why Clean Architecture is shaped the way it is — it's not a new idea, it's SOLID at architectural scale.

---

## Gotchas

- **SRP is about *actors*, not verbs.** "One reason to change" means one stakeholder. `dueDate()` and `ensureCanBorrow()` are two verbs but one reason (the loan policy) — keep them together. Splitting by verb produces anaemic over-fragmentation.
- **OCP doesn't mean "never edit code."** It means stable, *tested abstractions* stay closed while *behaviour* is added via new implementations. Fixing a bug inside an implementation is fine. And don't pre-abstract for a second case that may never come.
- **LSP violations are silent — the compiler won't catch them.** Inheritance gives syntactic substitutability; LSP demands behavioural substitutability. The tells: an override that `throw`s, no-ops, strengthens a precondition, or weakens a postcondition. When you see them, the *is-a* was a lie — use composition or a narrower interface.
- **The Rectangle/Square problem is about mutability, not geometry.** Immutable shapes (returning new instances) have no postcondition to break and don't violate LSP. The trap only exists for mutable state.
- **A fat interface's tell is the empty implementation.** `throw new NotImplementedException()` / no-op / `return null!` means the interface is too big. Segregate by role. (This same stub is also an LSP violation — ISP and LSP catch the same illness.)
- **TS interfaces are structural and vanish at runtime; C# interfaces are nominal and real.** In C# you `implements`/`: IFoo` explicitly and inject by type. In TS a shape match is enough, but you must inject by **token** (`@Inject(SYMBOL)`) because the interface doesn't exist at runtime. Same DIP, different wiring — this is the single most important TS-vs-C# divergence for DI.
- **DIP is not "use a DI container."** You can obey DIP with hand-wired constructors and no container at all; you can *have* a container and still violate DIP by injecting concretions. DIP is the principle, DI the mechanism, the container the tool. Don't conflate them.
- **The interface must be owned by the consumer.** A repository interface sitting in the infrastructure package next to its impl has inverted nothing. Put `ILoanRepository` in the domain. The client owns the abstraction it depends on.
- **`virtual`/`override` (C#) vs everything-virtual (TS).** LSP/OCP examples in C# only override correctly when the base member is `virtual`/`abstract`. In TS every method is overridable by default — easier to override, *and* easier to violate LSP by accident.
- **SOLID is a means, not a religion.** Over-applied, it produces indirection, ceremony, and speculative generality (YAGNI). Optimise for "easy and safe to change," and let the *smell* pull the principle in — not dogma.

---

## Phase 7 Exercise

**Goal:** Take a deliberately awful `LibraryManager` that does everything, and refactor it until it satisfies all five SOLID principles. Keep the **before** and **after** side by side, **in both languages**, and write one sentence per principle naming where you applied it.

### The Before — `LibraryManager` Does Everything

```ts
// TypeScript — BEFORE: a god class violating all five principles
class LibraryManager {
  private loans: { memberId: string; itemId: string; kind: string; dueAt: Date }[] = [];

  // Violates SRP: business rules + persistence + fees + notification + formatting in one class.
  // Violates OCP: late-fee logic is a switch you must edit for every new item kind.
  // Violates DIP: hard-codes console + an in-class array store; no abstractions.
  async checkout(memberId: string, itemId: string, kind: string): Promise<void> {
    // business rule
    const active = this.loans.filter(l => l.memberId === memberId).length;
    if (active >= 5) throw new Error('Limit reached');

    // persistence (concrete, in-class)
    this.loans.push({ memberId, itemId, kind, dueAt: new Date(Date.now() + 14 * 86_400_000) });

    // notification (concrete: console)
    console.log(`Email to ${memberId}: you borrowed ${itemId}`);
  }

  lateFee(kind: string, daysLate: number): number {       // OCP violation: type switch
    switch (kind) {
      case 'book':      return daysLate * 0.25;
      case 'audiobook': return daysLate * 0.15;
      case 'dvd':       return daysLate * 1.00;
      default:          throw new Error('Unknown kind');
    }
  }
}
```

```csharp
// C# — BEFORE: the same god class
public class LibraryManager
{
    private readonly List<(string MemberId, string ItemId, string Kind, DateTime DueAt)> _loans = new();

    public void Checkout(string memberId, string itemId, string kind)
    {
        var active = _loans.Count(l => l.MemberId == memberId);   // business rule
        if (active >= 5) throw new InvalidOperationException("Limit reached");

        _loans.Add((memberId, itemId, kind, DateTime.UtcNow.AddDays(14))); // concrete persistence
        Console.WriteLine($"Email to {memberId}: you borrowed {itemId}");  // concrete notification
    }

    public decimal LateFee(string kind, int daysLate) => kind switch  // OCP violation
    {
        "book"      => daysLate * 0.25m,
        "audiobook" => daysLate * 0.15m,
        "dvd"       => daysLate * 1.00m,
        _ => throw new ArgumentException("Unknown kind"),
    };
}
```

### The After — All Five Principles Applied

```ts
// TypeScript — AFTER

// ── OCP + LSP: each item type owns its fee; new types are new classes; all substitutable ──
abstract class LibraryItem {
  constructor(public readonly id: string) {}
  abstract lateFeePerDay(): number;
  lateFee(daysLate: number): number { return daysLate * this.lateFeePerDay(); }
}
class Book extends LibraryItem      { lateFeePerDay() { return 0.25; } }
class Audiobook extends LibraryItem { lateFeePerDay() { return 0.15; } }
class Dvd extends LibraryItem       { lateFeePerDay() { return 1.00; } }

// ── ISP: small, role-shaped abstractions, each owned by the high-level policy ──
interface LoanRepository {                              // DIP abstraction (owned by domain)
  countActive(memberId: string): Promise<number>;
  add(memberId: string, itemId: string, dueAt: Date): Promise<void>;
}
interface Notifier { send(memberId: string, message: string): Promise<void>; }
interface LoanPolicy { maxActive(): number; loanDays(): number; }

// ── SRP: one job each ──
class StandardPolicy implements LoanPolicy { maxActive() { return 5; } loanDays() { return 14; } }

class CheckoutService {                                 // SRP: only the checkout workflow
  constructor(                                          // DIP: depends on abstractions only
    private repo: LoanRepository,
    private notifier: Notifier,
    private policy: LoanPolicy,
  ) {}
  async checkout(memberId: string, item: LibraryItem): Promise<void> {
    const active = await this.repo.countActive(memberId);
    if (active >= this.policy.maxActive()) throw new Error('Limit reached');
    const dueAt = new Date(Date.now() + this.policy.loanDays() * 86_400_000);
    await this.repo.add(memberId, item.id, dueAt);
    await this.notifier.send(memberId, `You borrowed ${item.id}, due ${dueAt.toDateString()}`);
  }
}

// ── OCP/DIP: swap implementations without touching CheckoutService ──
class InMemoryLoanRepository implements LoanRepository {
  private rows: { memberId: string; itemId: string; dueAt: Date }[] = [];
  async countActive(m: string) { return this.rows.filter(r => r.memberId === m).length; }
  async add(memberId: string, itemId: string, dueAt: Date) { this.rows.push({ memberId, itemId, dueAt }); }
}
class EmailNotifier implements Notifier {
  async send(memberId: string, message: string) { /* real SMTP */ }
}

// composition root — the only place that knows concretes (DIP in action):
const service = new CheckoutService(new InMemoryLoanRepository(), new EmailNotifier(), new StandardPolicy());
```

```csharp
// C# — AFTER

// OCP + LSP: polymorphic fee, every subtype a faithful substitute
public abstract class LibraryItem
{
    public string Id { get; }
    protected LibraryItem(string id) => Id = id;
    public abstract decimal LateFeePerDay();
    public decimal LateFee(int daysLate) => daysLate * LateFeePerDay();
}
public class Book : LibraryItem      { public Book(string id) : base(id) {} public override decimal LateFeePerDay() => 0.25m; }
public class Audiobook : LibraryItem { public Audiobook(string id) : base(id) {} public override decimal LateFeePerDay() => 0.15m; }
public class Dvd : LibraryItem       { public Dvd(string id) : base(id) {} public override decimal LateFeePerDay() => 1.00m; }

// ISP: small role interfaces owned by the domain (DIP)
public interface ILoanRepository
{
    Task<int> CountActiveAsync(string memberId);
    Task AddAsync(string memberId, string itemId, DateTime dueAt);
}
public interface INotifier { Task SendAsync(string memberId, string message); }
public interface ILoanPolicy { int MaxActive(); int LoanDays(); }

// SRP: one job each
public class StandardPolicy : ILoanPolicy { public int MaxActive() => 5; public int LoanDays() => 14; }

public class CheckoutService                              // SRP: only the checkout workflow
{
    private readonly ILoanRepository _repo;               // DIP: abstractions only
    private readonly INotifier _notifier;
    private readonly ILoanPolicy _policy;
    public CheckoutService(ILoanRepository repo, INotifier notifier, ILoanPolicy policy)
    { _repo = repo; _notifier = notifier; _policy = policy; }

    public async Task CheckoutAsync(string memberId, LibraryItem item)
    {
        var active = await _repo.CountActiveAsync(memberId);
        if (active >= _policy.MaxActive()) throw new InvalidOperationException("Limit reached");
        var dueAt = DateTime.UtcNow.AddDays(_policy.LoanDays());
        await _repo.AddAsync(memberId, item.Id, dueAt);
        await _notifier.SendAsync(memberId, $"You borrowed {item.Id}, due {dueAt:D}");
    }
}

// OCP/DIP: interchangeable implementations
public class InMemoryLoanRepository : ILoanRepository
{
    private readonly List<(string M, string I, DateTime D)> _rows = new();
    public Task<int> CountActiveAsync(string m) => Task.FromResult(_rows.Count(r => r.M == m));
    public Task AddAsync(string m, string i, DateTime d) { _rows.Add((m, i, d)); return Task.CompletedTask; }
}
public class EmailNotifier : INotifier
{
    public Task SendAsync(string memberId, string message) => Task.CompletedTask; // real SMTP
}

// composition root — wired by hand, or by builder.Services.AddScoped<...>() in ASP.NET:
// var service = new CheckoutService(new InMemoryLoanRepository(), new EmailNotifier(), new StandardPolicy());
```

### Write-Up (do this part too)

For each principle, write one sentence naming exactly where you applied it. Target answers:

- **SRP** — split the god class into `CheckoutService` (workflow), the repository (persistence), the notifier (messaging), the policy (rules), and `LibraryItem` (fee behaviour); each has one reason to change.
- **OCP** — the late-fee `switch` became polymorphic `lateFeePerDay()`; adding `Magazine` is a new class, no edits to existing code.
- **LSP** — every `LibraryItem` subtype faithfully honours `lateFee`/`lateFeePerDay` (no throws, no no-ops), so any subtype is substitutable.
- **ISP** — instead of one fat `ILibraryManager`, the service depends on three small role interfaces (`LoanRepository`, `Notifier`, `LoanPolicy`); no class is forced to stub a method it doesn't use.
- **DIP** — `CheckoutService` depends only on abstractions it owns; concretions are injected at the composition root, so swapping the store/notifier/policy (and testing with fakes) changes no business code.

**Stretch:** wire the C# version through ASP.NET DI (`builder.Services.AddScoped<...>()`, see `.net/notes/02-aspnet-basics.md` §2.3) and the TS version through NestJS with a `LOAN_REPOSITORY` token (see `javascript/notes/05-clean-architecture-nest.md` §5.2). Then add a `StudentPolicy` and confirm you touched zero existing code — that's OCP + DIP working together.
```
