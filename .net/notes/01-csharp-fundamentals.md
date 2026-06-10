# Phase 1 — C# Fundamentals

**Status:** In Progress  
**Started:** 2026-06-10  

---

## 1.1 Mental Model Shift: C# vs JavaScript/TypeScript

### The Runtime

| | JavaScript/Node.js | C# / .NET |
|---|---|---|
| Runtime | V8 engine | CLR (Common Language Runtime) |
| Compilation | JIT via V8 | Compiled to IL, then JIT by CLR |
| Package manager | npm / pnpm | NuGet (`dotnet add package`) |
| Config file | `package.json` | `ProjectName.csproj` |
| Entry point | `index.js` / `server.js` | `Program.cs` |
| CLI | `npm run dev` | `dotnet run` / `dotnet watch` |
| Module system | ES modules / CommonJS | Namespaces |

### Key Mental Shifts

**1. Everything is statically typed — for real**  
TypeScript has `any` as an escape hatch. C# has no equivalent. The compiler enforces types everywhere, always.

```csharp
// This does NOT compile — types must match
string name = 42; // Error: cannot convert int to string
```

**2. Null is opt-in for reference types**  
With `<Nullable>enable</Nullable>` in the project (default in .NET 6+), the compiler warns you if a reference type might be null:

```csharp
string name = null;   // Warning: null literal assigned to non-nullable type
string? name = null;  // Fine — the ? means "this can be null"
```

**3. `using` ≠ ES `import`**  
`using` in C# is a namespace import (like `import` in TS) AND a resource cleanup statement. Both exist.

```csharp
using System.Collections.Generic;  // namespace import — like: import { List } from '...'
using var conn = new SqlConnection(); // resource cleanup — runs conn.Dispose() when leaving scope
```

**4. No `undefined` — only `null`**  
C# has one concept of "absence of value": `null`. A variable can never be "undefined".

**5. `string` is a special value type in behavior**  
`string` is a reference type in memory, but `==` compares content (like value types), not reference. Don't use `.Equals()` unless you need culture/case options.

```csharp
string a = "hello";
string b = "hello";
Console.WriteLine(a == b); // true — content comparison
```

### Tooling

```bash
# Like npm init
dotnet new webapi -n MyApi

# Like npm install <package>
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL

# Like npm run dev
dotnet watch run

# Like npm run build
dotnet build

# Like npm test
dotnet test
```

---

## 1.2 Types & Variables

### Variable Declaration

```csharp
// Explicit type
int age = 30;
string name = "Tareq";
bool isActive = true;

// Type inference with var (like const in TS — still statically typed)
var count = 10;        // inferred as int
var message = "hello"; // inferred as string

// Constants
const int MaxRetries = 3;         // compile-time constant (value must be known at compile time)
readonly int _maxItems;            // runtime constant — can be set in constructor only
static readonly string AppName = "MyApi"; // shared across all instances, set once
```

**Rule of thumb:** Use `var` when the type is obvious from the right-hand side. Use explicit types when it adds clarity.

### Value Types vs Reference Types

This is one of the biggest differences from JavaScript.

**Value types** — stored on the stack, copied when assigned:
```csharp
int a = 5;
int b = a;  // b is a copy
b = 10;
Console.WriteLine(a); // 5 — a is unchanged
```

**Reference types** — stored on the heap, assigned by reference:
```csharp
var list1 = new List<int> { 1, 2, 3 };
var list2 = list1;  // both point to same list
list2.Add(4);
Console.WriteLine(list1.Count); // 4 — list1 was also changed
```

| Value Types | Reference Types |
|---|---|
| `int`, `double`, `float`, `decimal` | `string`, `class`, `interface`, `array` |
| `bool`, `char` | `List<T>`, `Dictionary<K,V>` |
| `struct`, `enum` | your custom classes |
| Stack-allocated | Heap-allocated |
| Copied on assignment | Reference copied on assignment |

### Numbers — More Specific Than JS

```csharp
int age = 30;           // 32-bit integer (-2B to 2B)
long bigNumber = 9_000_000_000L; // 64-bit integer (note the _ separator — same as JS)
double price = 9.99;    // 64-bit float (like JS number)
decimal money = 9.99m;  // 128-bit high-precision — ALWAYS use for money/finance
float approx = 3.14f;   // 32-bit float — rarely used, use double instead

// Integer division truncates — common gotcha!
int result = 7 / 2;     // 3 (not 3.5!)
double result2 = 7.0 / 2; // 3.5 — one operand must be floating point
```

### Strings

```csharp
string name = "Tareq";

// Interpolation — same syntax as JS template literals
string greeting = $"Hello, {name}!";

// Multi-line — raw string literals (C# 11+)
string json = """
    {
        "name": "Tareq"
    }
    """;

// Verbatim string — backslashes are literal (useful for paths)
string path = @"C:\Users\Tareq\file.txt";

// Common string methods
name.ToUpper()           // "TAREQ"
name.ToLower()           // "tareq"
name.Contains("are")     // true
name.StartsWith("Ta")    // true
name.Replace("Ta", "Mo") // "Moreq"
name.Trim()              // removes whitespace
name.Split(",")          // string[] — like .split() in JS
string.IsNullOrEmpty(name)      // check for null or ""
string.IsNullOrWhiteSpace(name) // check for null, "", or "   "
```

### Nullable Types

```csharp
// Reference types — nullable with ?
string? nullableName = null;   // can be null
string requiredName = "Tareq"; // compiler warns if you try to assign null

// Value types — nullable with ?  (wraps in Nullable<T>)
int? nullableAge = null;    // int can now hold null
int age = nullableAge ?? 0; // null-coalescing — same as JS ??

// Null-conditional — same as JS ?.
int? length = nullableName?.Length; // null if nullableName is null

// Null-forgiving operator ! — tells compiler "trust me, not null"
string definitelyNotNull = nullableName!; // use sparingly
```

---

## 1.3 Control Flow

### if / else — Identical to JS

```csharp
if (age >= 18)
{
    Console.WriteLine("Adult");
}
else if (age >= 13)
{
    Console.WriteLine("Teen");
}
else
{
    Console.WriteLine("Child");
}
```

### switch — Much More Powerful Than JS

```csharp
// Classic switch (same as JS)
switch (status)
{
    case "active":
        Console.WriteLine("Running");
        break;
    case "paused":
        Console.WriteLine("Paused");
        break;
    default:
        Console.WriteLine("Unknown");
        break;
}

// Switch EXPRESSION (C# 8+) — like a ternary for multiple cases
string label = status switch
{
    "active" => "Running",
    "paused" => "Paused",
    "stopped" => "Halted",
    _ => "Unknown"  // _ is the default case
};

// Pattern matching in switch
object obj = 42;
string result = obj switch
{
    int n when n > 0 => $"Positive int: {n}",
    int n             => $"Non-positive int: {n}",
    string s          => $"String: {s}",
    null              => "null",
    _                 => "Something else"
};
```

### Loops

```csharp
// for — identical to JS
for (int i = 0; i < 10; i++)
{
    Console.WriteLine(i);
}

// foreach — like JS for...of
var names = new List<string> { "Alice", "Bob", "Charlie" };
foreach (var name in names)
{
    Console.WriteLine(name);
}

// while — identical to JS
int count = 0;
while (count < 5)
{
    count++;
}
```

### Exception Handling

```csharp
try
{
    var result = int.Parse("not-a-number"); // throws FormatException
}
catch (FormatException ex)
{
    Console.WriteLine($"Format error: {ex.Message}");
}
catch (Exception ex) // catch-all — like catch(e) in JS
{
    Console.WriteLine($"Unexpected error: {ex.Message}");
    throw; // re-throw preserving stack trace — NOT "throw ex" (that resets stack trace)
}
finally
{
    // Always runs — like .finally() on a Promise
    Console.WriteLine("Cleanup");
}

// Throw inline
string name = user.Name ?? throw new ArgumentNullException(nameof(user.Name));
```

---

## 1.4 Object-Oriented Programming

### Classes

```csharp
public class User
{
    // Properties (not fields) — C# idiomatic, like getters/setters
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // default value
    public string Email { get; private set; } // can read from outside, set only inside

    // Constructor
    public User(int id, string name, string email)
    {
        Id = id;
        Name = name;
        Email = email;
    }

    // Method
    public string GetDisplayName() => $"{Name} <{Email}>";
}

// Usage
var user = new User(1, "Tareq", "tareq@example.com");
Console.WriteLine(user.GetDisplayName());
```

### Interfaces

Like TypeScript interfaces, but:
1. They define a **contract** that must be implemented
2. Used heavily with dependency injection
3. A class can implement multiple interfaces

```csharp
public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<IReadOnlyList<User>> GetAllAsync();
    Task AddAsync(User user);
}

// Implementation
public class UserRepository : IUserRepository
{
    public async Task<User?> GetByIdAsync(int id)
    {
        // ... implementation
    }

    public async Task<IReadOnlyList<User>> GetAllAsync()
    {
        // ... implementation
    }

    public async Task AddAsync(User user)
    {
        // ... implementation
    }
}
```

### Records — Immutable Data Objects

`record` is like a frozen TypeScript object — value equality, immutable by default (with `record`).

```csharp
// Record — immutable, value equality
public record Point(double X, double Y);

var p1 = new Point(1.0, 2.0);
var p2 = new Point(1.0, 2.0);
Console.WriteLine(p1 == p2); // true — value equality (unlike class which compares reference)

// "Modify" with with expression — creates a new record
var p3 = p1 with { X = 5.0 };  // p3 = Point(5.0, 2.0), p1 unchanged

// Records are great for DTOs and Value Objects
public record CreateUserRequest(string Name, string Email);
public record UserResponse(int Id, string Name, string Email);
```

### Inheritance

```csharp
public abstract class Animal
{
    public string Name { get; }

    protected Animal(string name) => Name = name;

    public abstract string Speak(); // must be overridden

    public virtual string Describe() => $"I am {Name}"; // can be overridden
}

public class Dog : Animal
{
    public Dog(string name) : base(name) { } // call base constructor

    public override string Speak() => "Woof!";

    public override string Describe() => base.Describe() + ", a dog";
}
```

### Generics — Same as TypeScript

```csharp
// Generic class
public class Repository<T> where T : class
{
    private readonly List<T> _items = new();

    public void Add(T item) => _items.Add(item);
    public T? FindFirst(Func<T, bool> predicate) => _items.FirstOrDefault(predicate);
}

// Generic method
public T Max<T>(T a, T b) where T : IComparable<T>
{
    return a.CompareTo(b) >= 0 ? a : b;
}

// Usage
var userRepo = new Repository<User>();
userRepo.Add(new User(1, "Tareq", "t@example.com"));
```

---

## 1.5 Collections & LINQ

### Common Collections

```csharp
// List<T> — like JS Array
var names = new List<string> { "Alice", "Bob" };
names.Add("Charlie");
names.Remove("Bob");
names.Count;       // length
names[0];          // index access

// Dictionary<K,V> — like JS Map / plain object
var scores = new Dictionary<string, int>
{
    { "Alice", 95 },
    { "Bob", 87 }
};
scores["Charlie"] = 92;  // add or update
scores.ContainsKey("Alice"); // true
scores.TryGetValue("Dave", out int score); // safe get — returns false if missing

// HashSet<T> — unique values, like JS Set
var tags = new HashSet<string> { "api", "rest" };
tags.Add("api"); // ignored — already exists
```

### LINQ — The JS Array Methods Equivalent

LINQ (Language Integrated Query) — works on any `IEnumerable<T>`:

```csharp
var users = new List<User>
{
    new User(1, "Alice", "alice@example.com"),
    new User(2, "Bob", "bob@example.com"),
    new User(3, "Charlie", "charlie@example.com")
};

// .Where() — like .filter()
var activeUsers = users.Where(u => u.Name.StartsWith("A"));

// .Select() — like .map()
var names = users.Select(u => u.Name); // IEnumerable<string>

// .Select() for transformation
var responses = users.Select(u => new UserResponse(u.Id, u.Name, u.Email));

// .FirstOrDefault() — like .find() (returns null if not found)
var user = users.FirstOrDefault(u => u.Id == 2);

// .First() — throws if not found (use when you're sure it exists)
var user2 = users.First(u => u.Id == 1);

// .Any() — like .some()
bool hasAdmins = users.Any(u => u.Name == "Admin");

// .All() — like .every()
bool allHaveEmails = users.All(u => !string.IsNullOrEmpty(u.Email));

// .OrderBy() / .OrderByDescending() — like .sort()
var sorted = users.OrderBy(u => u.Name);

// .Count() — like .filter().length
int count = users.Count(u => u.Name.StartsWith("A"));

// Chaining
var result = users
    .Where(u => u.Id > 1)
    .OrderBy(u => u.Name)
    .Select(u => u.Name)
    .ToList(); // materialize — see below

// .GroupBy()
var grouped = users.GroupBy(u => u.Name[0]); // group by first letter

// .ToList() / .ToArray() — materialize
// IMPORTANT: LINQ is lazy (deferred execution) — query runs when enumerated
var query = users.Where(u => u.Id > 0); // nothing runs yet
var list = query.ToList(); // NOW it runs
```

**Deferred Execution — Key Gotcha:**
```csharp
var query = users.Where(u => u.Id > 0); // just a description of the query
users.Add(new User(4, "Dave", "d@example.com")); // added AFTER query defined
var result = query.ToList(); // Dave IS included — query runs NOW against current list
```

---

## 1.6 Async/Await

Async in C# maps almost 1:1 to JavaScript async/await. `Task<T>` is `Promise<T>`.

```csharp
// JS:   async function getUser(id: number): Promise<User>
// C#:
public async Task<User?> GetUserAsync(int id)
{
    // await works exactly like JS
    var response = await httpClient.GetAsync($"/users/{id}");
    var json = await response.Content.ReadAsStringAsync();
    return JsonSerializer.Deserialize<User>(json);
}

// Void async (fire and forget — use carefully, same warning as in JS)
// JS:   async function logEvent(): Promise<void>
// C#:
public async Task LogEventAsync(string message) // use Task not void
{
    await File.WriteAllTextAsync("log.txt", message);
}

// Task.WhenAll — like Promise.all()
var task1 = GetUserAsync(1);
var task2 = GetUserAsync(2);
var results = await Task.WhenAll(task1, task2); // User?[]

// Task.WhenAny — like Promise.race()
var first = await Task.WhenAny(task1, task2);
```

### CancellationToken — No JS Equivalent

Used to cancel long-running operations. ASP.NET passes one automatically to controllers.

```csharp
public async Task<List<User>> GetUsersAsync(CancellationToken cancellationToken = default)
{
    // Pass the token to everything that accepts it
    await Task.Delay(5000, cancellationToken); // will throw OperationCanceledException if cancelled
    return await _db.Users.ToListAsync(cancellationToken);
}

// In a controller — token is automatically injected by ASP.NET
[HttpGet]
public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
{
    var users = await _service.GetUsersAsync(cancellationToken);
    return Ok(users);
}
```

### Common Async Pitfalls

```csharp
// WRONG — .Result blocks the thread (can cause deadlocks)
var user = GetUserAsync(1).Result; // never do this

// WRONG — async void (exceptions are unobservable)
async void LoadData() { ... } // only acceptable for event handlers

// RIGHT
var user = await GetUserAsync(1);

// WRONG — not awaiting (fire and forget silently)
SendEmailAsync(user); // returns Task but you're not awaiting it

// RIGHT — if you intentionally don't await, be explicit
_ = SendEmailAsync(user); // discard operator — explicit "I know I'm not awaiting"
```

---

## 1.7 Functional C# Features

### Extension Methods

Add methods to types you don't own — like monkey-patching in JS but type-safe.

```csharp
// Define in a static class
public static class StringExtensions
{
    public static bool IsValidEmail(this string value) // "this" = the type being extended
    {
        return value.Contains("@") && value.Contains(".");
    }

    public static string Truncate(this string value, int maxLength)
    {
        return value.Length <= maxLength ? value : value[..maxLength] + "...";
    }
}

// Use as if it's a method on string
"tareq@example.com".IsValidEmail(); // true
"Hello World".Truncate(5);         // "Hello..."
```

### Lambda & Delegates

```csharp
// Same arrow function syntax as JS
Func<int, int> double = x => x * 2;
Func<int, int, int> add = (a, b) => a + b;
Action<string> log = message => Console.WriteLine(message); // void return

// Passing functions (same as passing callbacks in JS)
var numbers = new List<int> { 1, 2, 3, 4, 5 };
var evens = numbers.Where(n => n % 2 == 0).ToList();
```

### Pattern Matching (Powerful C# Feature)

```csharp
// Type pattern
object shape = new Circle(5.0);
if (shape is Circle c)
{
    Console.WriteLine($"Circle with radius {c.Radius}");
}

// Null check pattern
if (user is not null)
{
    Console.WriteLine(user.Name);
}

// Property pattern
if (user is { Name: "Admin", IsActive: true })
{
    Console.WriteLine("Admin is active");
}

// List pattern (C# 11+)
int[] numbers = { 1, 2, 3 };
if (numbers is [1, _, 3])
{
    Console.WriteLine("Starts with 1, ends with 3");
}
```

---

## 1.8 Gotchas for JS/TS Developers

| Gotcha | JS/TS behavior | C# behavior |
|--------|---------------|-------------|
| Integer division | `7 / 2 === 3.5` | `7 / 2 == 3` (truncates) |
| `==` on objects | reference equality | reference equality for classes, value equality for records |
| `string` mutability | immutable | immutable (use `StringBuilder` for loop concatenation) |
| `null` vs `undefined` | both exist | only `null` |
| Array `.length` | property | `Count` for List, `Length` for arrays |
| `typeof` | runtime type check | use `is` or `GetType()` |
| Object spread `{...obj}` | shallow copy | `with` expression for records, no built-in for classes |
| Async void | rarely matters | NEVER do `async void` (exceptions disappear) |
| Implicit returns | arrow functions | only with expression bodies: `=> value` |
| Module system | ES modules | Namespaces + `using` directives |

---

## Phase 1 Mini-Project — Console To-Do App

**Goal:** Practice types, collections, LINQ, async file I/O

```bash
dotnet new console -n TodoApp
cd TodoApp
dotnet run
```

```csharp
// Program.cs
using System.Text.Json;

var todos = await TodoStorage.LoadAsync();

while (true)
{
    Console.WriteLine("\n1) List  2) Add  3) Complete  4) Quit");
    var choice = Console.ReadLine();

    switch (choice)
    {
        case "1":
            var pending = todos.Where(t => !t.IsCompleted).OrderBy(t => t.CreatedAt);
            foreach (var todo in pending)
                Console.WriteLine($"  [{todo.Id}] {todo.Title}");
            break;

        case "2":
            Console.Write("Title: ");
            var title = Console.ReadLine() ?? "";
            todos.Add(new Todo(todos.Count + 1, title, false, DateTime.UtcNow));
            await TodoStorage.SaveAsync(todos);
            break;

        case "3":
            Console.Write("ID: ");
            if (int.TryParse(Console.ReadLine(), out int id))
            {
                var todo = todos.FirstOrDefault(t => t.Id == id);
                if (todo is not null)
                {
                    todos.Remove(todo);
                    todos.Add(todo with { IsCompleted = true });
                    await TodoStorage.SaveAsync(todos);
                }
            }
            break;

        case "4":
            return;
    }
}

// Record — immutable, value equality
record Todo(int Id, string Title, bool IsCompleted, DateTime CreatedAt);

static class TodoStorage
{
    private const string FilePath = "todos.json";

    public static async Task<List<Todo>> LoadAsync()
    {
        if (!File.Exists(FilePath)) return new List<Todo>();
        var json = await File.ReadAllTextAsync(FilePath);
        return JsonSerializer.Deserialize<List<Todo>>(json) ?? new List<Todo>();
    }

    public static async Task SaveAsync(List<Todo> todos)
    {
        var json = JsonSerializer.Serialize(todos, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(FilePath, json);
    }
}
```

---

## Summary

| Concept | C# | JS/TS Equivalent |
|---------|----|-|
| `Task<T>` | `Promise<T>` |
| `List<T>` | `Array` / `T[]` |
| `Dictionary<K,V>` | `Map<K,V>` / object |
| `IEnumerable<T>` | `Iterable<T>` |
| LINQ `.Where()` | `.filter()` |
| LINQ `.Select()` | `.map()` |
| `record` | `readonly` / frozen object |
| `interface` | `interface` (enforced, not structural) |
| Extension methods | Prototype extension (but safe) |
| `CancellationToken` | `AbortController` (similar idea) |
| `?.` operator | `?.` operator (identical) |
| `??` operator | `??` operator (identical) |
