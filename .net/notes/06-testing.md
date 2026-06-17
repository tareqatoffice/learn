# Phase 6 — Testing

**Status:** Not started
**Targets:** .NET 10 · xUnit · Moq · FluentAssertions · Testcontainers for .NET

---

## The Mental Model: .NET Testing vs the Jest/Supertest World

You already know how to test a Node backend. Map what you know onto .NET first, then the rest is just syntax.

| What you do in Node | What you do in .NET |
|---|---|
| `jest` test runner | **xUnit** (the de-facto standard) |
| `it("...", () => {})` | `[Fact]` method |
| `it.each([...])` | `[Theory]` + `[InlineData]` |
| `describe(...)` block | the test **class** (one class per unit under test) |
| `expect(x).toBe(y)` | `x.Should().Be(y)` (**FluentAssertions**) |
| `jest.fn()` / `jest.mock()` | `Mock<T>` + `.Setup()` / `.Returns()` (**Moq**) |
| `supertest(app).get('/x')` | `WebApplicationFactory<T>` + `HttpClient` |
| `beforeEach` / `afterEach` | constructor / `IDisposable.Dispose()` |
| `beforeAll` / `afterAll` (shared) | `IClassFixture<T>` / `ICollectionFixture<T>` |
| Docker in `globalSetup` | **Testcontainers** (`IAsyncLifetime`) |
| `npm test` | `dotnet test` |

The single biggest difference: **there is no global `describe`/`it`/`beforeEach`**. xUnit is class-based. A test class *is* the `describe` block, the constructor *is* `beforeEach`, and `Dispose()` *is* `afterEach`. xUnit creates a **new instance of the test class for every test method** — that is your isolation guarantee, the same way Jest gives each test a fresh closure.

---

## 6.1 Testing Fundamentals in .NET

### Why xUnit (and not the other two)

There are three frameworks in the wild: MSTest (old, Microsoft), NUnit (Java-JUnit heritage), and **xUnit** (modern, what new projects use). Stick with xUnit — it is what Clean Architecture templates, tutorials, and the .NET team itself reach for.

### Creating a test project

```bash
# Like `npm init` for a test package — scaffolds an xUnit project
dotnet new xunit -n MyApp.Domain.Tests

# Reference the project you're testing (like adding it to package.json deps)
dotnet add MyApp.Domain.Tests reference ../MyApp.Domain/MyApp.Domain.csproj

# Add the libraries we'll use throughout this phase
dotnet add MyApp.Domain.Tests package Moq
dotnet add MyApp.Domain.Tests package FluentAssertions
dotnet add MyApp.Domain.Tests package Testcontainers.PostgreSql

# Run every test in the solution (like `npm test`)
dotnet test

# Run one class / filter by name (like `jest -t "name"`)
dotnet test --filter "FullyQualifiedName~OrderTests"
```

The generated `.csproj` already wires up the runner. The key packages it pulls in:

```xml
<ItemGroup>
  <!-- the assertion + attribute library ([Fact], [Theory]) -->
  <PackageReference Include="xunit" Version="2.*" />
  <!-- the adapter so `dotnet test` / IDE test explorer can discover & run them -->
  <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
</ItemGroup>
```

### `[Fact]` ≈ `it()`

A `[Fact]` is a single test with no parameters. The attribute is how xUnit *discovers* it — there is no `it()` function call, you just decorate a method.

```csharp
public class CalculatorTests        // ≈ describe("Calculator", ...)
{
    [Fact]                          // ≈ it("adds two numbers", ...)
    public void Add_TwoPositiveNumbers_ReturnsSum()
    {
        // Arrange — set up inputs and the system under test (SUT)
        var calculator = new Calculator();

        // Act — call the one thing you're testing
        var result = calculator.Add(2, 3);

        // Assert — verify the outcome
        Assert.Equal(5, result);    // we'll swap this for FluentAssertions in 6.2
    }
}
```

### Arrange / Act / Assert (AAA)

This is the universal test skeleton. Same idea as the `// given / when / then` comments you might write in Jest, just formalized. Keep the three sections visually separated — it makes a test readable at a glance:

- **Arrange** — build inputs, construct the SUT, configure mocks.
- **Act** — exactly one action (the method under test).
- **Assert** — check what happened.

### `[Theory]` + `[InlineData]` ≈ `it.each()`

When you want the same test body run with different inputs, use a `[Theory]`. Each `[InlineData(...)]` is one row of `it.each`'s table.

```csharp
// Jest:
//   it.each([
//     [2, 3, 5],
//     [-1, 1, 0],
//     [0, 0, 0],
//   ])("adds %i + %i = %i", (a, b, expected) => {
//     expect(add(a, b)).toBe(expected);
//   });

[Theory]                            // ≈ it.each(...)
[InlineData(2, 3, 5)]               // each line = one test case
[InlineData(-1, 1, 0)]
[InlineData(0, 0, 0)]
public void Add_VariousInputs_ReturnsExpectedSum(int a, int b, int expected)
{
    var calculator = new Calculator();

    var result = calculator.Add(a, b);

    result.Should().Be(expected);   // runs 3 times, reported as 3 separate tests
}
```

For data that can't fit in an attribute (objects, lists, computed values), use `[MemberData]` or `[ClassData]` — the equivalent of passing a real array to `it.each`:

```csharp
public static IEnumerable<object[]> EmailCases => new List<object[]>
{
    new object[] { "a@b.com", true },
    new object[] { "not-an-email", false },
};

[Theory]
[MemberData(nameof(EmailCases))]
public void IsValidEmail_VariousInputs_ReturnsExpected(string input, bool expected)
{
    input.IsValidEmail().Should().Be(expected);
}
```

### Lifecycle: constructor / Dispose / fixtures

```csharp
public class OrderServiceTests : IDisposable
{
    private readonly HttpClient _client;

    public OrderServiceTests()          // ≈ beforeEach — runs before EVERY test
    {
        _client = new HttpClient();
    }

    public void Dispose()               // ≈ afterEach — runs after EVERY test
    {
        _client.Dispose();
    }
}
```

Because xUnit news-up the class per test, *don't* store mutable shared state in fields expecting it to persist between tests — it won't. That is a feature: it kills test coupling (see 6.6). For genuinely shared expensive setup (a DB container, a `WebApplicationFactory`), use `IClassFixture<T>` (shared across one class) or `ICollectionFixture<T>` (shared across many classes) — these are the real `beforeAll`/`afterAll`.

---

## 6.2 Unit Testing

A unit test exercises one piece of logic in isolation — **no database, no HTTP, no file system, no clock**. In Clean Architecture this is your **Domain** and **Application** layers.

### FluentAssertions ≈ `expect()` but reads like English

You *can* use built-in `Assert.Equal(expected, actual)`, but FluentAssertions gives you `expect`-style fluent chains plus far better failure messages.

```csharp
// built-in xUnit                       // FluentAssertions
Assert.Equal(5, result);                result.Should().Be(5);
Assert.True(isActive);                  isActive.Should().BeTrue();
Assert.Null(user);                      user.Should().BeNull();
Assert.NotNull(user);                   user.Should().NotBeNull();
Assert.Contains(item, list);            list.Should().Contain(item);
Assert.Throws<MyException>(() => ...);  act.Should().Throw<MyException>();

// where FluentAssertions really wins — readable, specific assertions:
order.Total.Should().Be(100m);
order.Lines.Should().HaveCount(3);
order.Lines.Should().OnlyContain(l => l.Quantity > 0);
order.Status.Should().Be(OrderStatus.Confirmed);
result.Should().BeOfType<NotFoundResult>();

// asserting an exception is thrown (≈ expect(fn).toThrow())
Action act = () => order.AddItem(product, quantity: -1);
act.Should().Throw<ArgumentException>()
   .WithMessage("*quantity*");   // * = wildcard, like a partial match
```

The payoff is the failure message. `Assert.Equal(5, result)` failing tells you "Expected 5, actual 3". `result.Should().Be(5, "because three items at unit prices should total 5")` tells you the *intent*, which is gold when a test breaks six months later.

### Testing a domain entity (pure, no mocks)

This is the purest kind of test — construct an object, call a method, assert on state or thrown exceptions. No test doubles at all, because the domain has no outward dependencies.

```csharp
// Domain entity under test
public class Order
{
    private readonly List<OrderLine> _lines = new();
    public IReadOnlyList<OrderLine> Lines => _lines;
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public decimal Total => _lines.Sum(l => l.UnitPrice * l.Quantity);

    public void AddLine(Guid productId, decimal unitPrice, int quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantity must be positive.", nameof(quantity));
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException("Cannot modify a confirmed order.");

        _lines.Add(new OrderLine(productId, unitPrice, quantity));
    }

    public void Confirm()
    {
        if (_lines.Count == 0)
            throw new InvalidOperationException("Cannot confirm an empty order.");
        Status = OrderStatus.Confirmed;
    }
}
```

```csharp
public class OrderTests
{
    [Fact]
    public void AddLine_ValidLine_IncreasesTotal()
    {
        // Arrange
        var order = new Order();

        // Act
        order.AddLine(Guid.NewGuid(), unitPrice: 10m, quantity: 3);

        // Assert
        order.Total.Should().Be(30m);
        order.Lines.Should().HaveCount(1);
    }

    [Fact]
    public void AddLine_NegativeQuantity_ThrowsArgumentException()
    {
        var order = new Order();

        // capture the call in an Action so FluentAssertions can invoke it
        Action act = () => order.AddLine(Guid.NewGuid(), 10m, quantity: -1);

        act.Should().Throw<ArgumentException>()
           .WithParameterName("quantity");   // checks the nameof() we passed
    }

    [Fact]
    public void Confirm_EmptyOrder_ThrowsInvalidOperation()
    {
        var order = new Order();

        Action act = () => order.Confirm();

        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*empty*");
    }
}
```

### Testing a value object

Value objects are immutable, identity-less, and compared by value (think a `record` like `Money` or `Email`). The thing worth testing is their equality semantics and their validation rules.

```csharp
public sealed record Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.Contains('@'))
            throw new ArgumentException("Invalid email.", nameof(value));
        Value = value.Trim().ToLowerInvariant();
    }
}
```

```csharp
public class EmailTests
{
    [Theory]
    [InlineData("tareq@example.com")]
    [InlineData("  Tareq@Example.COM  ")]   // gets trimmed + lowercased
    public void Ctor_ValidInput_Succeeds(string input)
    {
        var email = new Email(input);

        email.Value.Should().Be(input.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no-at-sign")]
    public void Ctor_InvalidInput_Throws(string input)
    {
        Action act = () => new Email(input);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Equality_SameNormalizedValue_AreEqual()
    {
        // records give value equality for free — verify it holds after normalization
        var a = new Email("Tareq@Example.com");
        var b = new Email("tareq@example.com");

        a.Should().Be(b);                 // value equality, like p1 == p2 for records
        (a == b).Should().BeTrue();
    }
}
```

### Moq ≈ `jest.fn()` / `jest.mock()`

When a unit *does* have a dependency (a repository interface, a clock, an email sender), you replace it with a mock so the unit is tested in isolation. Moq is the standard mocking library.

```csharp
// Jest:                                      // Moq:
// const repo = { getById: jest.fn() };       var repo = new Mock<IOrderRepository>();
//
// repo.getById.mockResolvedValue(order);     repo.Setup(r => r.GetByIdAsync(id, default))
//                                                .ReturnsAsync(order);
//
// expect(repo.getById).toHaveBeenCalled();   repo.Verify(r => r.GetByIdAsync(id, default),
//                                                Times.Once);
```

Anatomy of a Moq mock:

```csharp
var repo = new Mock<IOrderRepository>();        // create a fake implementing the interface

// .Setup() — define behavior, like .mockReturnValue / .mockResolvedValue
repo.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
    .ReturnsAsync(existingOrder);               // ReturnsAsync for Task<T>-returning methods

// It.IsAny<T>() — argument matcher, like expect.any(String) — "match any value of this type"
// It.Is<T>(x => ...) — match by predicate, like expect.objectContaining(...)

repo.Object;                                    // .Object is the actual instance you inject
                                                // (the mock itself is the controller around it)

// .Verify() — assert it was called, like expect(fn).toHaveBeenCalledWith(...)
repo.Verify(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Once);
repo.Verify(r => r.DeleteAsync(It.IsAny<Guid>(), default), Times.Never);
```

### Testing a MediatR handler (the bread-and-butter Application test)

In Clean Architecture your use cases are MediatR command/query **handlers**. A handler is just a class with a `Handle` method and constructor-injected dependencies — perfect for unit testing with mocked repos.

```csharp
// The command + handler under test (Application layer)
public record CreateOrderCommand(Guid CustomerId, List<OrderItemDto> Items)
    : IRequest<Guid>;

public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, Guid>
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _uow;

    public CreateOrderCommandHandler(IOrderRepository orders, IUnitOfWork uow)
    {
        _orders = orders;
        _uow = uow;
    }

    public async Task<Guid> Handle(CreateOrderCommand request, CancellationToken ct)
    {
        var order = new Order(request.CustomerId);
        foreach (var item in request.Items)
            order.AddLine(item.ProductId, item.UnitPrice, item.Quantity);

        await _orders.AddAsync(order, ct);
        await _uow.SaveChangesAsync(ct);
        return order.Id;
    }
}
```

```csharp
public class CreateOrderCommandHandlerTests
{
    private readonly Mock<IOrderRepository> _orders = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly CreateOrderCommandHandler _sut;   // System Under Test

    public CreateOrderCommandHandlerTests()
    {
        // constructor ≈ beforeEach — fresh mocks + SUT per test
        _sut = new CreateOrderCommandHandler(_orders.Object, _uow.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsOrderAndReturnsId()
    {
        // Arrange
        var command = new CreateOrderCommand(
            CustomerId: Guid.NewGuid(),
            Items: new() { new OrderItemDto(Guid.NewGuid(), UnitPrice: 10m, Quantity: 2) });

        // Act
        var result = await _sut.Handle(command, CancellationToken.None);

        // Assert — the returned id is real
        result.Should().NotBeEmpty();

        // Assert — it actually persisted (verify the side effects)
        _orders.Verify(r => r.AddAsync(
            It.Is<Order>(o => o.CustomerId == command.CustomerId && o.Total == 20m),
            It.IsAny<CancellationToken>()), Times.Once);

        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_EmptyItems_DoesNotSave()
    {
        var command = new CreateOrderCommand(Guid.NewGuid(), Items: new());

        Func<Task> act = () => _sut.Handle(command, CancellationToken.None);

        // for async exceptions, use ThrowAsync
        await act.Should().ThrowAsync<InvalidOperationException>();
        _uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

> Note: `It.IsAny<CancellationToken>()` vs `default`. If your `.Setup`/`.Verify` uses a *specific* matcher for one argument, every argument must use a matcher — you cannot mix a raw `default` with `It.IsAny<>`. Use `It.IsAny<CancellationToken>()` consistently to avoid surprises.

---

## 6.3 Integration Testing

Unit tests mock everything; integration tests wire real components together. The flagship tool is `WebApplicationFactory<T>` — it boots your **entire ASP.NET app in memory** (real DI container, real middleware pipeline, real routing) and hands you an `HttpClient` that talks to it without opening a network socket. This is the direct analog of `supertest(app)`.

```bash
dotnet add MyApp.Api.Tests package Microsoft.AspNetCore.Mvc.Testing
```

Your API project needs a public `Program` class for the factory to reference. With top-level statements in `Program.cs`, add this line at the bottom so tests can see it:

```csharp
// at the end of Program.cs
public partial class Program { }   // makes the implicit Program class referenceable in tests
```

### A basic integration test

```csharp
// Supertest:                                      // WebApplicationFactory:
// const res = await request(app).get('/products');  var res = await client.GetAsync("/products");
// expect(res.status).toBe(200);                      res.StatusCode.Should().Be(HttpStatusCode.OK);

public class ProductsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ProductsApiTests(WebApplicationFactory<Program> factory)
    {
        // IClassFixture shares ONE factory across all tests in this class (≈ beforeAll)
        _client = factory.CreateClient();   // ≈ supertest(app)
    }

    [Fact]
    public async Task GetProducts_ReturnsOkWithJson()
    {
        var response = await _client.GetAsync("/api/products");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // deserialize the body — extension from System.Net.Http.Json
        var products = await response.Content.ReadFromJsonAsync<List<ProductDto>>();
        products.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateProduct_ValidPayload_Returns201()
    {
        var payload = new { name = "Keyboard", price = 49.99m };

        // PostAsJsonAsync serializes the object to JSON for you
        var response = await _client.PostAsJsonAsync("/api/products", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();   // the Location header on 201
    }
}
```

### Overriding services for tests

The killer feature: a custom factory can swap real dependencies for test ones — replacing the real email sender with a fake, pointing the `DbContext` at a test database, stubbing an external HTTP client. Subclass `WebApplicationFactory<T>` and override `ConfigureWebHost`.

```csharp
public class CustomWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // remove the real registration...
            services.RemoveAll<IEmailSender>();
            // ...and register a fake (like jest.mock('./email'))
            services.AddSingleton<IEmailSender, FakeEmailSender>();

            // repoint the DbContext at a test connection string (see 6.4 for the container)
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(opt =>
                opt.UseNpgsql(TestDatabase.ConnectionString));
        });

        builder.UseEnvironment("Testing");   // so appsettings.Testing.json applies
    }
}
```

`ConfigureTestServices` runs *after* `Program.cs` registers everything, so your overrides win. `RemoveAll<T>()` comes from `Microsoft.Extensions.DependencyInjection.Extensions`.

---

## 6.4 Database Testing with Testcontainers

The old way to test EF Core code was the in-memory provider or SQLite — both *lie*. They don't enforce real PostgreSQL constraints, don't run your real migrations, and silently accept SQL that real Postgres rejects (JSONB, `citext`, partial indexes, case sensitivity, transactions). **Testcontainers** runs a real PostgreSQL in a throwaway Docker container for the duration of your tests. Requires Docker running on the machine/CI.

```bash
dotnet add MyApp.Infrastructure.Tests package Testcontainers.PostgreSql
```

### The PostgreSQL fixture

`IAsyncLifetime` is xUnit's async setup/teardown hook — `InitializeAsync` ≈ `beforeAll`, `DisposeAsync` ≈ `afterAll`. We spin the container up once, apply migrations, and expose a connection string.

```csharp
public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")     // pin a real version — same as prod
        .WithDatabase("testdb")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()       // ≈ beforeAll
    {
        await _container.StartAsync();        // pulls image (first run) + boots Postgres

        // apply your REAL migrations against the REAL database
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();     // runs migrations, not EnsureCreated()
    }

    public async Task DisposeAsync()          // ≈ afterAll — container is destroyed
    {
        await _container.DisposeAsync();
    }
}
```

### Using the fixture + cleanup between tests

Share the container across a class with `IClassFixture<PostgresFixture>`. The container is expensive (a few seconds to boot), so you do *not* want one per test. But you *do* want a clean database per test — handle that by resetting data in the constructor (`beforeEach`).

```csharp
public class OrderRepositoryTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly AppDbContext _db;
    private readonly OrderRepository _sut;

    public OrderRepositoryTests(PostgresFixture fixture)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(fixture.ConnectionString)
            .Options;

        _db = new AppDbContext(options);
        _sut = new OrderRepository(_db);
    }

    // cleanup BETWEEN tests so they don't see each other's rows (≈ afterEach)
    public Task InitializeAsync() => Task.CompletedTask;
    public async Task DisposeAsync()
    {
        // truncate the tables this test touched — keeps tests independent (see 6.6)
        await _db.Database.ExecuteSqlRawAsync(
            "TRUNCATE TABLE orders, order_lines RESTART IDENTITY CASCADE;");
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_ThenGetById_ReturnsPersistedOrder()
    {
        // Arrange — a real order
        var order = new Order(Guid.NewGuid());
        order.AddLine(Guid.NewGuid(), 10m, 2);

        // Act — write through the repo, then read it back from the real DB
        await _sut.AddAsync(order, default);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();           // forget cached entities → force a real DB read

        var fetched = await _sut.GetByIdAsync(order.Id, default);

        // Assert
        fetched.Should().NotBeNull();
        fetched!.Total.Should().Be(20m);
        fetched.Lines.Should().HaveCount(1);
    }
}
```

> For faster cleanup than TRUNCATE, the `Respawn` library can reset the whole DB to empty between tests by deleting in FK-dependency order — a common companion to Testcontainers. Either works; TRUNCATE is fine to start.

A bigger pattern: combine Testcontainers with the `CustomWebAppFactory` from 6.3. The factory points the app's `DbContext` at the container's connection string, giving you **true end-to-end tests** — real HTTP, real pipeline, real Postgres.

---

## 6.5 Clean Architecture Testing Strategy

Each layer of Clean Architecture has a natural test style. Match the test to the layer and you avoid both over-mocking and slow, brittle suites. This is the testing pyramid expressed in your architecture.

```
        ┌─────────────────────────────────────────────┐
   few  │ API layer        → E2E: WebApplicationFactory │  slow, high confidence
        │                    (+ Testcontainers DB)       │
        ├─────────────────────────────────────────────┤
        │ Infrastructure   → Integration: real DB       │
        │                    (Testcontainers + EF Core)  │
        ├─────────────────────────────────────────────┤
        │ Application      → Unit: handlers + mocked     │
        │                    repos (Moq)                 │
        ├─────────────────────────────────────────────┤
   many │ Domain           → Pure unit: NO mocks at all  │  fast, foundational
        └─────────────────────────────────────────────┘
```

| Layer | Test type | Dependencies | Tools | Project |
|---|---|---|---|---|
| **Domain** | Pure unit | None — entities/value objects are self-contained | xUnit + FluentAssertions | `Domain.Tests` |
| **Application** | Unit | Repos/services **mocked** | xUnit + Moq + FluentAssertions | `Application.Tests` |
| **Infrastructure** | Integration | **Real** PostgreSQL | xUnit + Testcontainers + EF Core | `Infrastructure.Tests` |
| **API / Presentation** | End-to-end | Full app + real DB | xUnit + WebApplicationFactory + Testcontainers | `Api.Tests` |

Guiding principle: **mock at the boundary of the layer you're testing, never inside the domain.** If you find yourself mocking a domain entity, that's a smell — domain logic should be pure enough to test directly. The more tests you have toward the bottom (fast domain tests), the better; the few at the top (slow E2E) are there to confirm the wiring, not to test business rules that lower tests already cover.

---

## 6.6 Test Best Practices

### Naming: `MethodName_StateUnderTest_ExpectedBehavior`

A test name should read as a sentence describing a scenario, so a failing test in CI tells you exactly what broke without opening the code.

```csharp
// good — three parts, scannable
AddLine_NegativeQuantity_ThrowsArgumentException
Handle_ValidCommand_PersistsOrderAndReturnsId
GetByIdAsync_OrderDoesNotExist_ReturnsNull

// bad — tells you nothing when it fails
TestAddLine
Order_Works
Test1
```

### One logical assert per test

Test one behavior per test. It's fine to have multiple `.Should()` lines if they all describe *the same outcome* (e.g. asserting several properties of one returned object), but don't test "creates an order" and "sends a confirmation email" in the same `[Fact]` — split them so a failure points at one cause. This is the same discipline as keeping Jest `it()` blocks focused.

### Test data builders / object mothers ≈ test factories

Constructing complex objects inline clutters tests and couples them to constructors. Use a **builder** (fluent, for variation) or an **object mother** (named, canonical instances) — the same role as a `makeUser()` factory in your Jest suites.

```csharp
// Builder — fluent, good when tests need slightly different variations
public class OrderBuilder
{
    private Guid _customerId = Guid.NewGuid();
    private readonly List<(Guid, decimal, int)> _lines = new();

    public OrderBuilder ForCustomer(Guid id) { _customerId = id; return this; }
    public OrderBuilder WithLine(decimal price, int qty)
    {
        _lines.Add((Guid.NewGuid(), price, qty));
        return this;
    }

    public Order Build()
    {
        var order = new Order(_customerId);
        foreach (var (pid, price, qty) in _lines)
            order.AddLine(pid, price, qty);
        return order;
    }
}

// usage in a test — reads like a description of the scenario:
var order = new OrderBuilder()
    .WithLine(price: 10m, qty: 2)
    .WithLine(price: 5m, qty: 1)
    .Build();

order.Total.Should().Be(25m);
```

```csharp
// Object mother — named canonical instances, good for "the standard happy-path object"
public static class Orders
{
    public static Order Confirmed()
    {
        var o = new Order(Guid.NewGuid());
        o.AddLine(Guid.NewGuid(), 10m, 1);
        o.Confirm();
        return o;
    }
}
// usage: var order = Orders.Confirmed();
```

### Avoiding test coupling

- **No shared mutable state between tests.** xUnit's per-test instance helps, but watch out for `static` fields and a shared database. Clean the DB between tests (TRUNCATE/Respawn) as shown in 6.4.
- **Tests must not depend on execution order.** xUnit runs tests in a non-deterministic order on purpose. If test B only passes after test A ran, they're coupled — fix it.
- **Don't assert on incidental details.** Asserting the exact wording of every error message or the exact order of an unordered list makes tests fragile. Assert on what matters to the behavior.
- **Arrange everything the test needs inside the test** (or via a builder). A reader should understand a test without scrolling to find hidden setup.

---

## Gotchas for JS/TS Developers

| Gotcha | JS/Jest behavior | C#/xUnit behavior |
|---|---|---|
| Test grouping | `describe` blocks, nestable | the **class** is the group; constructor = `beforeEach` |
| Per-test isolation | shared module scope, manual reset | **new class instance per test** — fields reset automatically |
| `beforeEach` / `afterEach` | hooks | constructor / `Dispose()` |
| `beforeAll` / `afterAll` | hooks | `IClassFixture<T>` / `ICollectionFixture<T>` / `IAsyncLifetime` |
| Parameterized tests | `it.each([...])` | `[Theory]` + `[InlineData]` / `[MemberData]` |
| Async assertions | `await expect(p).rejects.toThrow()` | `await act.Should().ThrowAsync<T>()` (sync uses `.Throw<T>`) |
| Mock a module | `jest.mock('./mod')` | inject a `Mock<IInterface>` — **mock interfaces, not classes** |
| Auto-mocking | Jest can auto-mock a module | Moq mocks one interface at a time; no auto-mock of concretes |
| Verifying calls | `expect(fn).toHaveBeenCalledWith(...)` | `mock.Verify(m => m.X(...), Times.Once)` |
| Arg matchers | `expect.any(String)` | `It.IsAny<string>()` / `It.Is<T>(predicate)` |
| In-memory DB for tests | common, "good enough" | **avoid** — use Testcontainers; in-memory provider lies |
| Forgetting `await` | unhandled rejection warning | test may pass falsely — **always `await` async asserts** |
| Mixing matchers & literals | n/a | if one arg uses `It.IsAny`, **all** args must use matchers |
| Mocking a sealed/non-virtual member | trivial in JS | Moq **can't** — only interfaces & virtual members are mockable |

> The async-assert trap is the one that bites JS devs hardest. `act.Should().ThrowAsync<T>()` returns a `Task`. If you forget to `await` it, the assertion never runs and the test passes even when nothing threw. Always `await` it.

---

## Phase 6 Project — Full Test Suite for the Clean Architecture Project

**Goal:** add a complete, layered test suite to the Clean Architecture Products/Orders API you built in Phase 4 (and secured in Phase 5). One test project per layer, matching the strategy in 6.5.

### Step 1 — Scaffold the test projects

```bash
# from the solution root
dotnet new xunit -n MyApp.Domain.Tests
dotnet new xunit -n MyApp.Application.Tests
dotnet new xunit -n MyApp.Infrastructure.Tests
dotnet new xunit -n MyApp.Api.Tests

# add each to the solution (so `dotnet test` finds them all)
dotnet sln add MyApp.Domain.Tests MyApp.Application.Tests \
               MyApp.Infrastructure.Tests MyApp.Api.Tests

# reference the projects under test
dotnet add MyApp.Domain.Tests        reference ../MyApp.Domain/MyApp.Domain.csproj
dotnet add MyApp.Application.Tests   reference ../MyApp.Application/MyApp.Application.csproj
dotnet add MyApp.Infrastructure.Tests reference ../MyApp.Infrastructure/MyApp.Infrastructure.csproj
dotnet add MyApp.Api.Tests           reference ../MyApp.Api/MyApp.Api.csproj

# packages
dotnet add MyApp.Domain.Tests         package FluentAssertions
dotnet add MyApp.Application.Tests    package Moq
dotnet add MyApp.Application.Tests    package FluentAssertions
dotnet add MyApp.Infrastructure.Tests package Testcontainers.PostgreSql
dotnet add MyApp.Infrastructure.Tests package FluentAssertions
dotnet add MyApp.Api.Tests            package Microsoft.AspNetCore.Mvc.Testing
dotnet add MyApp.Api.Tests            package Testcontainers.PostgreSql
dotnet add MyApp.Api.Tests            package FluentAssertions
```

### Step 2 — Domain tests (pure unit)

- Test every entity invariant: `Order.AddLine` rejects non-positive quantity, can't modify a confirmed order, `Confirm` rejects empty orders.
- Test value objects (`Email`, `Money`) for validation + value equality.
- **Hint:** no Moq here at all. If you reach for a mock, your domain has a hidden dependency — push it out.

### Step 3 — Application tests (unit + Moq)

- For each MediatR handler: one happy-path test (verifies the repo was called and the right result returned) and the failure paths.
- Use `Mock<IOrderRepository>`, `Mock<IUnitOfWork>`, etc. Verify side effects with `.Verify(..., Times.Once/Never)`.
- **Hint:** assert *both* the return value and the interactions — a handler that returns the right id but never saved is still broken.

### Step 4 — Infrastructure tests (integration + Testcontainers)

- Build the `PostgresFixture` from 6.4. Apply real migrations in `InitializeAsync`.
- Test repository round-trips (write → `ChangeTracker.Clear()` → read back), relationship loading (`Include`), and any custom queries.
- **Hint:** `ChangeTracker.Clear()` (or a fresh `DbContext`) between write and read, or EF returns the cached object and you never actually hit the DB.

### Step 5 — API tests (end-to-end)

- Build `CustomWebAppFactory : WebApplicationFactory<Program>` that points the `DbContext` at the Testcontainers connection string and swaps external services for fakes.
- Test full flows over `HttpClient`: create a product → 201 + Location header; create an order → fetch it → assert the JSON; hit a protected endpoint without a JWT → 401, with a valid JWT → 200.
- **Hint:** add `public partial class Program { }` to `Program.cs` or the factory can't reference it.

### Step 6 — Run it all

```bash
dotnet test                          # whole suite
dotnet test --filter "FullyQualifiedName~Domain"   # just one layer
dotnet test --collect:"XPlat Code Coverage"        # with coverage (coverlet)
```

**Stretch goals:**
- Add a GitHub Actions step that runs `dotnet test` (Docker is available on GitHub-hosted runners, so Testcontainers works in CI).
- Introduce `Respawn` for faster DB reset between tests.
- Add `[Trait("Category", "Integration")]` to tag slow tests and run unit-only locally: `dotnet test --filter "Category!=Integration"`.

---

## Summary

| Concept | .NET tool | JS/Jest Equivalent |
|---|---|---|
| Test runner | xUnit (`dotnet test`) | Jest (`npm test`) |
| Single test | `[Fact]` | `it()` |
| Parameterized test | `[Theory]` + `[InlineData]` | `it.each()` |
| Test grouping | the test class | `describe()` |
| `beforeEach` / `afterEach` | constructor / `Dispose()` | hooks |
| `beforeAll` / `afterAll` | `IClassFixture` / `IAsyncLifetime` | hooks |
| Assertions | FluentAssertions `.Should()` | `expect()` |
| Async throw assert | `await act.Should().ThrowAsync<T>()` | `await expect(p).rejects.toThrow()` |
| Mocking | Moq `Mock<T>` / `.Setup()` / `.Verify()` | `jest.fn()` / `jest.mock()` |
| Arg matchers | `It.IsAny<T>()` / `It.Is<T>(...)` | `expect.any()` / `objectContaining()` |
| In-memory API tests | `WebApplicationFactory<T>` + `HttpClient` | `supertest(app)` |
| Real DB in tests | Testcontainers (real PostgreSQL) | testcontainers-node / docker-compose |
| Test layout | one test project per Clean Arch layer | folders per module |

**The one rule to remember:** match the test to the layer — pure unit tests for the domain, mocked-repo unit tests for the application, real-DB integration tests for infrastructure, and full end-to-end tests for the API. Push as much logic as possible into fast domain tests at the base of the pyramid.
