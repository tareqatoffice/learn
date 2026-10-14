// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  "out": "c#asp.net_learning_graph",
  "title": "C# and ASP.NET Learning Graph",
  "sub": "Targets .NET 10 (LTS).",
  "foot": "Links go to Microsoft’s official documentation. .NET 10 is an LTS release supported through November 2028; .NET 8 and .NET 9 reach end of support on November 10, 2026\n    (<a href=\"https://dotnet.microsoft.com/en-US/platform/support/policy\">.NET support policy</a>).",
  "key": "dotnet-learning-graph-v1",
  "tracks": [
    {
      "k": "csharp",
      "n": "C# basics"
    },
    {
      "k": "oop",
      "n": "OOP"
    },
    {
      "k": "modern",
      "n": "Modern C#"
    },
    {
      "k": "platform",
      "n": ".NET platform"
    },
    {
      "k": "web",
      "n": "ASP.NET Core"
    }
  ],
  "nodes": [
    {
      "id": "types",
      "tr": "csharp",
      "t": "Types & variables",
      "pre": [],
      "s": "Everything in C# has a static type. Value types (int, bool, struct, enum) hold their data directly. Reference types (class, string, arrays) hold a pointer to an object.",
      "p": [
        "Value vs reference: assignment copies the value, or copies the pointer.",
        "var only infers the type at compile time; it does not make the variable dynamic.",
        "string is a reference type but immutable, so every change creates a new string."
      ],
      "c": "int count = 3;                 // value type\nstring name = \"Docomate\";      // reference type, immutable\nvar items = new List<int>();   // var: inferred, still statically typed\nConsole.WriteLine($\"{name}: {count}\");",
      "pit": "Reading a struct out of a List or property gives you a copy. var p = list[0]; p.X = 5; or calling a mutating method on list[0] changes the copy, not the item in the list.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/"
    },
    {
      "id": "flow",
      "tr": "csharp",
      "t": "Control flow & methods",
      "pre": [
        "types"
      ],
      "s": "Branching, loops, and methods are how you shape logic. Expression-bodied members and switch expressions keep small methods short.",
      "p": [
        "if, switch, for, foreach, while; prefer foreach when you do not need the index.",
        "Parameters can be ref, out, in, optional, or params.",
        "Local functions keep helper logic next to where it is used."
      ],
      "c": "static int Clamp(int value, int min, int max) =>\n    value < min ? min : value > max ? max : value;\n\nforeach (var n in new[] { -5, 5, 50 })\n    Console.WriteLine(Clamp(n, 0, 10)); // 0, 5, 10",
      "pit": "Changing a collection inside a foreach over it throws InvalidOperationException.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/methods"
    },
    {
      "id": "structs",
      "tr": "csharp",
      "t": "Structs & enums",
      "pre": [
        "types"
      ],
      "s": "A struct is a value type: assigning it copies the data. An enum names a fixed set of constants. Both are small tools with sharp edges.",
      "p": [
        "Use a struct for small, immutable, short-lived data (a point, an amount); default to class otherwise.",
        "readonly struct and record struct make accidental changes to a copy harder.",
        "Give enum value 0 a meaningful member, and use [Flags] with powers of two for combinable values."
      ],
      "c": "var p = new Point(1, 2);\nvar q = p with { X = 5 };   // p is unchanged: a copy, not a shared reference\n\npublic readonly record struct Point(int X, int Y);\npublic enum Status { Draft = 0, Paid, Shipped }\n[Flags] public enum Perm { None = 0, Read = 1, Write = 2 }",
      "pit": "Casting any int to an enum compiles and succeeds even when no member matches. Check with Enum.IsDefined.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct"
    },
    {
      "id": "dispose",
      "tr": "csharp",
      "t": "IDisposable & using",
      "pre": [
        "cls",
        "exc"
      ],
      "s": "Objects that hold files, connections, or sockets implement IDisposable. using releases them at a known point instead of whenever the garbage collector runs.",
      "p": [
        "A using declaration disposes at the end of the scope; await using does the same for IAsyncDisposable.",
        "Whoever creates an object disposes it. The DI container disposes what it created, so never dispose an injected service.",
        "Get HttpClient from IHttpClientFactory instead of creating one per call."
      ],
      "c": "public string ReadAll(string path)\n{\n    using var reader = new StreamReader(path);   // disposed when the method ends\n    return reader.ReadToEnd();\n}",
      "pit": "A missing using works in testing and then exhausts the connection or file-handle pool under load.",
      "u": "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/using-objects"
    },
    {
      "id": "sdk",
      "tr": "platform",
      "t": "SDK, runtime, NuGet",
      "pre": [
        "types"
      ],
      "s": "The SDK builds and runs code, the runtime (CLR) executes it, NuGet brings in libraries. The dotnet CLI is the daily tool.",
      "p": [
        "A .csproj file declares target framework, packages, and project references.",
        "Build produces IL; the JIT compiles it to machine code at run time.",
        "global.json pins the SDK version for the whole team."
      ],
      "c": "dotnet new webapi -n Demo\ncd Demo\ndotnet add package Serilog.AspNetCore\ndotnet build\ndotnet run",
      "pit": "Different SDK versions on different machines give different build results. Pin with global.json.",
      "u": "https://learn.microsoft.com/en-us/dotnet/core/introduction"
    },
    {
      "id": "coll",
      "tr": "csharp",
      "t": "Collections",
      "pre": [
        "flow"
      ],
      "s": "List, Dictionary, HashSet, Queue and friends live in System.Collections.Generic. Choose by access pattern, then expose the narrowest interface.",
      "p": [
        "Dictionary and HashSet give near O(1) lookup; List is index access and append.",
        "Return IReadOnlyList<T> or IEnumerable<T> from APIs, not the concrete List<T>.",
        "TryGetValue avoids a double lookup and a KeyNotFoundException."
      ],
      "c": "var byId = new Dictionary<int, string> { [1] = \"ada\", [2] = \"linus\" };\nif (byId.TryGetValue(2, out var user)) Console.WriteLine(user);\nIReadOnlyList<int> ids = [1, 2, 3];   // collection expression (C# 12)",
      "pit": "Searching a List with Contains inside a loop is O(n²). Use a HashSet.",
      "u": "https://learn.microsoft.com/en-us/dotnet/standard/collections/"
    },
    {
      "id": "exc",
      "tr": "csharp",
      "t": "Exceptions",
      "pre": [
        "flow"
      ],
      "s": "Exceptions signal that a method could not do its job. Catch only what you can handle, and let the rest travel up to one place that logs it.",
      "p": [
        "Use throw; to rethrow. throw ex; resets the stack trace.",
        "using / await using guarantees cleanup even when an exception is thrown.",
        "Do not use exceptions for normal control flow, such as an expected 'not found'."
      ],
      "c": "try\n{\n    var order = repo.Get(id) ?? throw new KeyNotFoundException($\"Order {id}\");\n    Console.WriteLine(order.Total);\n}\ncatch (KeyNotFoundException ex)\n{\n    Console.WriteLine($\"Not found: {ex.Message}\");   // handle what you expect\n}\nfinally\n{\n    Console.WriteLine(\"always runs\");\n}",
      "pit": "An empty catch block hides the bug and the evidence at the same time.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/exceptions/"
    },
    {
      "id": "cls",
      "tr": "oop",
      "t": "Classes & objects",
      "pre": [
        "flow"
      ],
      "s": "A class is a blueprint that bundles data (fields, properties) with behavior (methods). An object is one instance, created with new.",
      "p": [
        "Properties wrap fields: { get; set; }, { get; init; }, or { get; private set; }.",
        "Constructors establish a valid object; primary constructors (C# 12) cut the boilerplate.",
        "Two variables can point at the same object; assigning a class variable copies the reference."
      ],
      "c": "var o = new Order(40m);   // o points at an object on the heap\n\npublic class Order\n{\n    public Guid Id { get; } = Guid.NewGuid();\n    public decimal Total { get; private set; }\n    public Order(decimal total) => Total = total;\n}",
      "pit": "Object initializers can leave required fields unset. Use required members or a constructor.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/"
    },
    {
      "id": "enc",
      "tr": "oop",
      "t": "Encapsulation",
      "pre": [
        "cls"
      ],
      "s": "Hide internal state and expose only operations that keep the object valid. The rules about the data live next to the data.",
      "p": [
        "Default to private; widen access only when a caller needs it.",
        "Put invariants in one method, not in every caller.",
        "Access levels: private, protected, internal, public, plus private protected and file."
      ],
      "c": "public class Account\n{\n    private decimal _balance;\n    public decimal Balance => _balance;     // read-only outside\n    public void Withdraw(decimal amount)\n    {\n        if (amount <= 0 || amount > _balance)\n            throw new ArgumentOutOfRangeException(nameof(amount));\n        _balance -= amount;                // invariant enforced here\n    }\n}",
      "pit": "A public List<T> property lets any caller add items and bypass your rules. Expose IReadOnlyList<T>.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/access-modifiers"
    },
    {
      "id": "inh",
      "tr": "oop",
      "t": "Inheritance",
      "pre": [
        "cls"
      ],
      "s": "A derived class reuses and extends a base class. It models an 'is-a' relationship. C# allows one base class but many interfaces.",
      "p": [
        "virtual lets a base method be overridden; override replaces it; sealed stops further overriding.",
        "base(...) calls the parent constructor; base.Method() calls the parent version.",
        "Deep hierarchies are hard to change; prefer shallow ones."
      ],
      "c": "public class Animal { public virtual string Sound() => \"...\"; }\npublic class Dog : Animal { public override string Sound() => \"woof\"; }",
      "pit": "Hiding a member with new instead of override gives different results depending on the variable's type.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance"
    },
    {
      "id": "itf",
      "tr": "oop",
      "t": "Interfaces",
      "pre": [
        "cls"
      ],
      "s": "An interface is a contract: a set of members a type promises to provide, with no state. A class can implement many interfaces.",
      "p": [
        "Name by capability: IClock, IEmailSender, IRepository<T>.",
        "Callers depend on the interface, so you can swap implementations, including fakes in tests.",
        "Default interface methods exist, but use them sparingly (mainly for evolving public APIs)."
      ],
      "c": "public interface IClock { DateTimeOffset UtcNow { get; } }\n\npublic sealed class SystemClock : IClock\n{ public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }\n\npublic sealed class FakeClock(DateTimeOffset now) : IClock\n{ public DateTimeOffset UtcNow => now; }   // for tests",
      "pit": "An interface with exactly one implementation and no test double is usually noise. Add one when there is a real second implementation or a seam you need.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces"
    },
    {
      "id": "poly",
      "tr": "oop",
      "t": "Polymorphism",
      "pre": [
        "inh",
        "itf"
      ],
      "s": "Code written against a base type or interface works with any derived type, and the runtime type picks the method that runs.",
      "p": [
        "Method calls on virtual or interface members dispatch at run time.",
        "Overloading (same name, different parameters) is resolved at compile time, which is a different thing.",
        "Pattern matching and type checks (is, as) are the escape hatch, not the default."
      ],
      "c": "Animal a = new Dog();\nConsole.WriteLine(a.Sound());   // \"woof\": the object's type decides, not the variable's",
      "pit": "A long if/else or switch on type inside a method usually means the behavior belongs in a virtual method.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/polymorphism"
    },
    {
      "id": "abs",
      "tr": "oop",
      "t": "Abstract classes",
      "pre": [
        "inh"
      ],
      "s": "An abstract class is a partly built base class. It cannot be instantiated, can hold state and shared code, and can force subclasses to fill in the rest.",
      "p": [
        "abstract members have no body and must be overridden by non-abstract subclasses.",
        "It can have constructors, fields, and concrete methods.",
        "Template Method pattern: the base defines the steps, subclasses supply some of them."
      ],
      "c": "public abstract class Shape\n{\n    public abstract double Area();                        // must override\n    public string Describe() => $\"{GetType().Name}: {Area():F2}\";   // shared\n}\npublic sealed class Circle(double r) : Shape\n{ public override double Area() => Math.PI * r * r; }",
      "pit": "Making everything abstract 'for flexibility' locks every type into one base class. Single inheritance is a scarce slot.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract"
    },
    {
      "id": "avi",
      "tr": "oop",
      "t": "Abstract vs interface",
      "pre": [
        "abs",
        "itf"
      ],
      "s": "Interface answers 'what can it do?'. Abstract class answers 'what is it, and what do all of its kinds share?'. They often work together.",
      "p": [
        "Interface: no instance state, many per class, ideal for dependencies and test seams.",
        "Abstract class: shared state and code, only one per class, ideal for a family of related types.",
        "Common shape: expose an interface, give implementers an abstract base for the boilerplate."
      ],
      "c": "public interface IExporter { string Export(Report r); }          // capability\n\npublic abstract class ExporterBase : IExporter                  // shared skeleton\n{\n    public string Export(Report r) => Header() + Body(r);\n    protected virtual string Header() => \"\";\n    protected abstract string Body(Report r);\n}",
      "pit": "Adding a member with no body to an interface breaks every implementer unless you also give it a default implementation. Adding a virtual member to an abstract class rarely breaks subclasses.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces"
    },
    {
      "id": "comp",
      "tr": "oop",
      "t": "Composition",
      "pre": [
        "poly",
        "itf"
      ],
      "s": "Build behavior by combining small objects ('has-a') instead of stacking subclasses ('is-a'). Easier to change and to test.",
      "p": [
        "Pass collaborators in through the constructor.",
        "Swap a part without touching the whole.",
        "Reach for inheritance only when the 'is-a' statement is true and stays true."
      ],
      "c": "public sealed class OrderService(IPaymentGateway payments, INotifier notifier)\n{\n    public void Place(Order o)\n    {\n        payments.Charge(o);\n        notifier.Send(o);\n    }\n}",
      "pit": "A base class that exists only to share helper methods is a utility class in disguise. Use a service or extension methods.",
      "u": "https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles"
    },
    {
      "id": "solid",
      "tr": "oop",
      "t": "SOLID principles",
      "pre": [
        "avi",
        "comp",
        "enc"
      ],
      "s": "Five design guidelines that keep object-oriented code changeable. Use them as questions in code review, not as rules to apply everywhere.",
      "p": [
        "S: one reason to change.  O: extend without editing existing code.",
        "L: a subtype must work wherever its base type is expected.",
        "I: small, focused interfaces.  D: depend on abstractions, not concrete classes."
      ],
      "c": "// D: the high-level class depends on an abstraction it was given\npublic sealed class Welcome(IEmailSender email)\n{\n    public Task RunAsync(User u) => email.SendAsync(u.Email, \"Hi\");\n}",
      "pit": "Splitting a class into five just to satisfy 'S' can make the code harder to follow. Split when change pressure is real.",
      "u": "https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles"
    },
    {
      "id": "gen",
      "tr": "modern",
      "t": "Generics",
      "pre": [
        "coll",
        "cls"
      ],
      "s": "Write a type or method once and use it with many types, checked at compile time. List<T> is the everyday example.",
      "p": [
        "Constraints (where T : class, new(), IComparable<T>) say what T can do.",
        "Generic interfaces like IRepository<T> and IEnumerable<T> show up everywhere in ASP.NET Core.",
        "Variance (in / out) lets IEnumerable<Dog> be used as IEnumerable<Animal>."
      ],
      "c": "public interface IRepository<T> where T : class\n{\n    Task<T?> FindAsync(Guid id, CancellationToken ct = default);\n    Task AddAsync(T entity, CancellationToken ct = default);\n}",
      "pit": "Over-generic base repositories often leak EF Core details to every caller.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics"
    },
    {
      "id": "null",
      "tr": "modern",
      "t": "Nullable references",
      "pre": [
        "cls"
      ],
      "s": "With nullable reference types on, the compiler tracks which references may be null and warns before you hit a NullReferenceException.",
      "p": [
        "string means never null; string? means may be null.",
        "?. and ?? handle null concisely; ! silences the compiler, so use it rarely.",
        "Validate public input at the boundary: ArgumentNullException.ThrowIfNull."
      ],
      "c": "string? nickname = GetNickname();\nint len = nickname?.Length ?? 0;\nArgumentNullException.ThrowIfNull(user);",
      "pit": "Treat warnings as errors in CI. A project full of CS86xx warnings has the feature on in name only.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/nullable-references"
    },
    {
      "id": "rec",
      "tr": "modern",
      "t": "Records & immutability",
      "pre": [
        "cls",
        "structs"
      ],
      "s": "Records are types built for data: value-based equality, a readable ToString, and non-destructive copies with with.",
      "p": [
        "record (class) vs record struct; both give positional syntax.",
        "init-only properties let you set values at creation and never again.",
        "Ideal for DTOs, commands, queries, and value objects."
      ],
      "c": "var a = new Money(5, \"USD\");\nvar b = a with { Amount = 10 };               // copy with one change\nConsole.WriteLine(a == new Money(5, \"USD\")); // True\n\npublic record Money(decimal Amount, string Currency);",
      "pit": "Equality compares every field, not identity. Two different Orders with the same values would be equal, so entities with an Id are usually classes.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/records"
    },
    {
      "id": "pat",
      "tr": "modern",
      "t": "Pattern matching",
      "pre": [
        "flow",
        "inh"
      ],
      "s": "switch expressions, property patterns, and relational patterns replace chains of if/else with compact, exhaustive-looking code.",
      "p": [
        "is, switch, and switch expressions all use the same patterns.",
        "Property patterns: { Length: 0 }; relational: < 0; logical: and, or, not.",
        "The compiler warns when a switch expression misses a case."
      ],
      "c": "string Label(object o) => o switch\n{\n    int n when n < 0           => \"negative\",\n    int                        => \"int\",\n    string { Length: 0 }       => \"empty string\",\n    Money { Currency: \"USD\" } m => $\"${m.Amount}\",\n    null                       => \"null\",\n    _                          => \"other\"\n};",
      "pit": "Order matters: the first matching arm wins, so put specific patterns before general ones.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching"
    },
    {
      "id": "del",
      "tr": "modern",
      "t": "Delegates & events",
      "pre": [
        "cls"
      ],
      "s": "A delegate is a type-safe reference to a method. Lambdas, Func, Action, and events are all built on it. Middleware in ASP.NET Core is a chain of delegates.",
      "p": [
        "Func<...> returns a value; Action<...> does not.",
        "Lambdas can capture local variables, which keeps them alive.",
        "Events let a publisher notify subscribers without knowing them."
      ],
      "c": "Func<int, int> twice = x => x * 2;     // lambda stored in a delegate\nAction<string> log = Console.WriteLine;\n\npublic class OrderHub\n{\n    public event EventHandler<OrderPlaced>? Placed;\n    public void Place(Guid id) => Placed?.Invoke(this, new OrderPlaced(id));\n}\n// subscriber: hub.Placed += (sender, e) => log(\"placed\");",
      "pit": "Subscribing to a long-lived publisher without unsubscribing keeps the subscriber alive (a memory leak).",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/delegates/"
    },
    {
      "id": "linq",
      "tr": "modern",
      "t": "LINQ",
      "pre": [
        "gen",
        "del"
      ],
      "s": "Query any sequence with Where, Select, GroupBy, OrderBy and more. Against a database (EF Core), the same query is translated to SQL.",
      "p": [
        "Queries are deferred: they run when you enumerate (foreach, ToList, Count).",
        "On IEnumerable the code runs in memory; on IQueryable it becomes SQL.",
        "Enumerating the same query twice runs it twice."
      ],
      "c": "var top = orders\n    .Where(o => o.Total > 100)\n    .GroupBy(o => o.CustomerId)\n    .Select(g => new { g.Key, Sum = g.Sum(o => o.Total) })\n    .OrderByDescending(x => x.Sum)\n    .Take(5)\n    .ToList();            // runs here",
      "pit": "Calling ToList() too early pulls the whole table into memory before Where runs.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/linq/"
    },
    {
      "id": "async",
      "tr": "modern",
      "t": "async / await",
      "pre": [
        "del",
        "exc"
      ],
      "s": "async methods let a thread do other work while waiting for I/O (database, HTTP, disk). It is about throughput, not about making one request faster.",
      "p": [
        "Return Task / Task<T>; avoid async void except for event handlers.",
        "Pass CancellationToken through; ASP.NET Core gives you one per request.",
        "Never block with .Result or .Wait(): it wastes threads and can deadlock."
      ],
      "c": "public async Task<Report> BuildAsync(Guid id, CancellationToken ct)\n{\n    var orders = await repo.ListAsync(id, ct);   // thread is free while waiting\n    return new Report(orders);\n}",
      "pit": "Forgetting await returns a running Task nobody observes. Exceptions disappear and work races ahead.",
      "u": "https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/"
    },
    {
      "id": "cfg",
      "tr": "platform",
      "t": "Config & options",
      "pre": [
        "sdk"
      ],
      "s": "Settings come from layered sources (appsettings.json, environment variables, user secrets, command line). The options pattern binds them to typed classes.",
      "p": [
        "Later sources override earlier ones; environment variables win over appsettings.json.",
        "Never commit secrets; use user secrets locally and a secret store in production.",
        "ValidateOnStart makes a bad config fail at startup, not at first use. It only runs validators you registered, such as ValidateDataAnnotations.",
        "IOptions reads once, on first use; IOptionsSnapshot re-reads per request; IOptionsMonitor reacts to changes while the app runs."
      ],
      "c": "// appsettings.json: { \"Smtp\": { \"Host\": \"localhost\", \"Port\": 25 } }\nbuilder.Services.AddOptions<SmtpOptions>()\n    .BindConfiguration(\"Smtp\")\n    .ValidateDataAnnotations()   // registers the validator\n    .ValidateOnStart();          // runs it at startup\n\npublic sealed class SmtpOptions\n{\n    [Required] public string Host { get; set; } = \"\";\n    [Range(1, 65535)] public int Port { get; set; }\n}\npublic sealed class Mailer(IOptions<SmtpOptions> opts) { /* opts.Value.Host */ }",
      "pit": "Reading IConfiguration[\"a:b\"] all over the code base makes typos invisible. Bind to an options class once.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/"
    },
    {
      "id": "di",
      "tr": "platform",
      "t": "Dependency injection",
      "pre": [
        "itf",
        "sdk"
      ],
      "s": "A class asks for the interfaces it needs in its constructor, and the container supplies them. This is how interfaces turn into swappable, testable parts.",
      "p": [
        "Singleton: one for the app. Scoped: one per request. Transient: new each time.",
        "A longer-lived service must not depend on a shorter-lived one (singleton cannot take scoped).",
        "Register at startup; resolve through constructors, not by calling the container."
      ],
      "c": "builder.Services.AddSingleton<IClock, SystemClock>();\nbuilder.Services.AddScoped<IOrderService, OrderService>();\nbuilder.Services.AddTransient<IReportBuilder, ReportBuilder>();",
      "pit": "Injecting a scoped service (like a DbContext) into a singleton is the classic 'captive dependency' bug.",
      "u": "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection"
    },
    {
      "id": "log",
      "tr": "platform",
      "t": "Logging",
      "pre": [
        "di"
      ],
      "s": "ILogger<T> is injected like any service. Use message templates so each value is kept as a structured property you can search.",
      "p": [
        "Levels: Trace, Debug, Information, Warning, Error, Critical.",
        "Log the exception object, not just its message.",
        "Do not log secrets or personal data."
      ],
      "c": "logger.LogInformation(\"Order {OrderId} placed for {Total}\", order.Id, order.Total);\nlogger.LogError(ex, \"Charge failed for {OrderId}\", order.Id);",
      "pit": "String interpolation in a log call builds the string even when the level is off and loses structure.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/logging/"
    },
    {
      "id": "host",
      "tr": "web",
      "t": "Hosting & Program.cs",
      "pre": [
        "di",
        "cfg"
      ],
      "s": "Program.cs is the whole startup story: create the builder, register services, build the app, set up the request pipeline, run.",
      "p": [
        "builder.Services.* registers services; app.Use* / app.Map* configure the pipeline.",
        "Kestrel is the built-in web server; a reverse proxy usually sits in front in production.",
        "Environment (Development, Staging, Production) switches behavior via ASPNETCORE_ENVIRONMENT."
      ],
      "c": "var builder = WebApplication.CreateBuilder(args);\nbuilder.Services.AddControllers();     // 1. register services\nvar app = builder.Build();\napp.MapGet(\"/health\", () => \"ok\");     // 2. build the pipeline\napp.Run();",
      "pit": "Registering a service after Build() throws InvalidOperationException, because the service collection is read-only once the app is built.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/"
    },
    {
      "id": "mw",
      "tr": "web",
      "t": "Middleware pipeline",
      "pre": [
        "host",
        "del"
      ],
      "s": "A request flows through a chain of middleware, each able to act before and after the next one. Order in Program.cs is the order requests travel.",
      "p": [
        "Each piece either calls next(context) or short-circuits with a response.",
        "Typical order: exception handling, HTTPS, routing, authentication, authorization, endpoints.",
        "Custom middleware is a delegate or a class with InvokeAsync."
      ],
      "c": "app.Use(async (ctx, next) =>\n{\n    var sw = Stopwatch.StartNew();\n    await next(ctx);                      // rest of the pipeline\n    app.Logger.LogInformation(\"{Path} took {Ms}ms\",\n        ctx.Request.Path, sw.ElapsedMilliseconds);\n});",
      "pit": "Wrong order breaks auth: UseAuthorization before UseRouting throws at request time, and before UseAuthentication every user looks anonymous, so protected endpoints return 401.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/"
    },
    {
      "id": "route",
      "tr": "web",
      "t": "Routing",
      "pre": [
        "mw"
      ],
      "s": "Routing matches the URL and HTTP method to an endpoint and extracts values from the path.",
      "p": [
        "Route templates: /orders/{id:guid}. Constraints reject bad values with a 404.",
        "Endpoints carry metadata (auth policy, rate limit, OpenAPI info).",
        "Use MapGroup to share a prefix and metadata."
      ],
      "c": "app.MapGet(\"/orders/{id:guid}\", (Guid id) => Results.Ok(id));\n\n// controller style\n[HttpGet(\"{id:guid}\")]\npublic IActionResult Get(Guid id) => Ok(id);",
      "pit": "Two endpoints that match the same URL throw AmbiguousMatchException at request time, not at startup.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/routing"
    },
    {
      "id": "min",
      "tr": "web",
      "t": "Minimal APIs",
      "pre": [
        "route"
      ],
      "s": "Endpoints as lambdas or method groups, with parameters bound from route, query, body, and services. Less ceremony than controllers.",
      "p": [
        "Services are injected straight into the handler parameters.",
        "Return Results.* or TypedResults.* for explicit status codes and good OpenAPI output.",
        "Group endpoints into static classes with extension methods to keep Program.cs small."
      ],
      "c": "var orders = app.MapGroup(\"/orders\");\norders.MapGet(\"/{id:guid}\", async (Guid id, IOrderService svc) =>\n    await svc.FindAsync(id) is { } o ? Results.Ok(o) : Results.NotFound());",
      "pit": "Putting business logic in the lambda makes it untestable without HTTP. Call a service.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis"
    },
    {
      "id": "ctrl",
      "tr": "web",
      "t": "Controllers",
      "pre": [
        "route",
        "abs"
      ],
      "s": "Controller classes group related actions. They derive from ControllerBase, which is an abstract class that supplies helpers like Ok() and NotFound().",
      "p": [
        "[ApiController] adds automatic 400 responses and parameter binding rules.",
        "Keep controllers thin: bind, call a service, map the result.",
        "Return ActionResult<T> to document the success type and still allow error results."
      ],
      "c": "[ApiController, Route(\"orders\")]\npublic class OrdersController(IOrderService svc) : ControllerBase\n{\n    [HttpGet(\"{id:guid}\")]\n    public async Task<ActionResult<OrderDto>> Get(Guid id) =>\n        await svc.FindAsync(id) is { } o ? o : NotFound();\n}",
      "pit": "Fat controllers that talk to the database directly are hard to test and hard to reuse.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/web-api/"
    },
    {
      "id": "bind",
      "tr": "web",
      "t": "Binding & validation",
      "pre": [
        "min",
        "ctrl"
      ],
      "s": "Binding turns the request into C# objects. Validation checks them before your code runs, and failures become a 400 ProblemDetails response.",
      "p": [
        "Bind to dedicated request DTOs, never straight to database entities.",
        "Data annotations are the built-in option; FluentValidation is a common alternative.",
        "Validate at the edge; the domain still protects its own invariants."
      ],
      "c": "public sealed record CreateOrder(\n    [Required] Guid? CustomerId,     // Guid? so a missing value is null and [Required] can catch it\n    [Range(1, 1000)] int Quantity);\n\n// [ApiController] returns 400 automatically for an invalid model.\n// Minimal APIs: built-in validation via builder.Services.AddValidation().",
      "pit": "Binding to an entity lets a client set fields you never meant to expose (over-posting).",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/mvc/models/validation"
    },
    {
      "id": "ef",
      "tr": "web",
      "t": "EF Core",
      "pre": [
        "linq",
        "async",
        "di",
        "dispose"
      ],
      "s": "An object-relational mapper. DbContext is a unit of work, DbSet<T> is a table, LINQ queries become SQL, and migrations evolve the schema.",
      "p": [
        "Register DbContext as scoped; it is not thread-safe.",
        "AsNoTracking for read-only queries; Include or projection (Select) to avoid N+1 queries.",
        "Review the generated SQL when a query is slow.",
        "Migrations (dotnet ef migrations add) version the schema. Read the generated migration before it touches production data."
      ],
      "c": "public class AppDb(DbContextOptions<AppDb> o) : DbContext(o)\n{ public DbSet<Order> Orders => Set<Order>(); }\n\nvar recent = await db.Orders\n    .AsNoTracking()\n    .Where(o => o.Total > 100)\n    .ToListAsync(ct);",
      "pit": "Lazy loading and loops of queries produce the N+1 problem: one query per row instead of one in total.",
      "u": "https://learn.microsoft.com/en-us/ef/core/"
    },
    {
      "id": "auth",
      "tr": "web",
      "t": "AuthN & AuthZ",
      "pre": [
        "mw",
        "route"
      ],
      "s": "Authentication answers 'who are you?' (cookie, JWT). Authorization answers 'what may you do?' (roles, policies, resource checks).",
      "p": [
        "UseAuthentication must come before UseAuthorization.",
        "Prefer policy-based authorization over scattering role names.",
        "Check ownership of the resource, not only the role, to prevent access to other people's data."
      ],
      "c": "builder.Services.AddAuthentication().AddCookie();\nbuilder.Services.AddAuthorization();\n\napp.UseAuthentication();\napp.UseAuthorization();\napp.MapGet(\"/me\", (ClaimsPrincipal u) => u.Identity?.Name)\n   .RequireAuthorization();",
      "pit": "Hiding a button in the UI is not authorization. Every endpoint must enforce its own rule.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/security/"
    },
    {
      "id": "test",
      "tr": "web",
      "t": "Testing",
      "pre": [
        "route",
        "di"
      ],
      "s": "Unit-test logic behind interfaces with fakes. Integration-test the real pipeline with WebApplicationFactory, ideally against a real database.",
      "p": [
        "Dependency injection is what makes the unit tests cheap.",
        "WebApplicationFactory<Program> hosts the app in memory for HTTP tests.",
        "Test behavior (status code, response body), not private methods."
      ],
      "c": "public class HealthTests(WebApplicationFactory<Program> factory)\n    : IClassFixture<WebApplicationFactory<Program>>\n{\n    [Fact]\n    public async Task Health_returns_ok()\n    {\n        var res = await factory.CreateClient().GetAsync(\"/health\");\n        Assert.Equal(HttpStatusCode.OK, res.StatusCode);\n    }\n}",
      "pit": "Mocking the database layer in every test proves the mock works, not the query.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests"
    },
    {
      "id": "errors",
      "tr": "web",
      "t": "Error handling",
      "pre": [
        "mw",
        "exc"
      ],
      "s": "Handle unhandled exceptions in one place and return a consistent ProblemDetails body instead of a stack trace.",
      "p": [
        "AddProblemDetails() plus UseExceptionHandler() give a standard JSON error for unhandled exceptions.",
        "IExceptionHandler maps specific exceptions to status codes in one class.",
        "Expected outcomes (not found, invalid input) are 4xx results, not exceptions."
      ],
      "c": "builder.Services.AddProblemDetails();\nbuilder.Services.AddExceptionHandler<NotFoundHandler>();\napp.UseExceptionHandler();\n\npublic sealed class NotFoundHandler : IExceptionHandler\n{\n    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)\n    {\n        if (ex is not KeyNotFoundException) return false;   // not ours, try the next handler\n        ctx.Response.StatusCode = StatusCodes.Status404NotFound;\n        await ctx.Response.WriteAsJsonAsync(new ProblemDetails { Status = 404, Title = \"Not found\" }, ct);\n        return true;\n    }\n}",
      "pit": "Returning ex.ToString() in the response leaks internals. Log the exception and return a generic problem.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling"
    },
    {
      "id": "openapi",
      "tr": "web",
      "t": "OpenAPI",
      "pre": [
        "min",
        "ctrl"
      ],
      "s": "OpenAPI describes your endpoints as a JSON document. Tools turn it into docs, typed clients, and contract checks, so front end and back end stay in agreement.",
      "p": [
        "AddOpenApi() and MapOpenApi() generate the document. They come from the Microsoft.AspNetCore.OpenApi NuGet package, which the webapi template already references.",
        "TypedResults and [ProducesResponseType] make the documented response shapes accurate.",
        "Treat the document as the contract and generate client types from it."
      ],
      "c": "// dotnet add package Microsoft.AspNetCore.OpenApi   (already in the webapi template)\nbuilder.Services.AddOpenApi();\nvar app = builder.Build();\nif (app.Environment.IsDevelopment())\n    app.MapOpenApi();          // serves /openapi/v1.json",
      "pit": "A handler that returns Results.Ok(x) documents no response type. Return TypedResults.Ok(x) so the schema is inferred.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/overview"
    },
    {
      "id": "deploy",
      "tr": "web",
      "t": "Deployment",
      "pre": [
        "auth",
        "test",
        "log"
      ],
      "s": "Publish a release build, run it behind a reverse proxy or in a container, and give the platform a health endpoint to probe.",
      "p": [
        "dotnet publish produces the deployable output; the SDK can also build container images.",
        "Health checks let the orchestrator know when to route traffic or restart.",
        "Set ASPNETCORE_ENVIRONMENT=Production and supply secrets through the environment."
      ],
      "c": "dotnet publish -c Release -o out\n\n// Program.cs\nbuilder.Services.AddHealthChecks();\napp.MapHealthChecks(\"/healthz\");",
      "pit": "Developer exception pages and detailed errors left on in production leak internals.",
      "u": "https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/"
    }
  ]
};
