# Phase 4 — Clean Architecture

**Status:** Not started
**Target runtime:** .NET 10
**Key libraries:** MediatR, FluentValidation, AutoMapper (or manual mapping), Serilog

---

## 4.1 Why Clean Architecture

### The problem it solves

If you've written Express APIs, you've probably seen route handlers grow like this:

```ts
// Express — everything crammed into the handler
app.post("/products", async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: "name required" });
  if (req.body.price <= 0) return res.status(400).json({ error: "bad price" });
  const existing = await db.query("SELECT * FROM products WHERE sku = $1", [req.body.sku]);
  if (existing.rows.length) return res.status(409).json({ error: "dup" });
  const result = await db.query("INSERT INTO products ...", [...]);
  await sendEmail(adminEmail, "New product");
  return res.status(201).json(result.rows[0]);
});
```

The handler now does HTTP parsing, validation, business rules, SQL, AND email. It's untestable without spinning up Express + a database, and the business rule ("price must be positive") is welded to Postgres and Express forever.

Clean Architecture fixes three things:

1. **Testability** — business logic runs with zero HTTP, zero database. You `new` up an entity and assert on it.
2. **Separation of concerns** — each layer has one job. HTTP stuff lives in one place, rules in another, SQL in another.
3. **Swappable infrastructure** — switch Postgres for SQL Server, or email for SMS, by writing a new class. Nothing in your business rules changes.

> **Node analogy:** This is the same instinct as pulling logic out of Express handlers into a `services/` layer that doesn't import `express` — except Clean Architecture is stricter about *which way the dependencies point*. NestJS pushes you toward this with `@Injectable()` services, modules, and providers; Clean Architecture is the same idea taken to its conclusion, with the domain at the very center.

### The Dependency Rule — point inward

The single rule that makes the whole thing work:

> **Source code dependencies always point inward, toward the domain. Inner layers know nothing about outer layers.**

The Domain (your business rules) is at the center. It depends on *nothing* — no EF Core, no ASP.NET, no MediatR. The outer layers depend on the inner ones, never the reverse.

How do you call the database from a use case if the use case can't depend on the database? **Dependency inversion**: the inner layer defines an *interface* (`IProductRepository`), and the outer layer *implements* it. At runtime, DI injects the implementation. The arrow of dependency points inward (Infrastructure → Domain), but the arrow of control flows outward at runtime.

```csharp
// Application layer references this interface (lives in Domain) — knows nothing of EF Core
public interface IProductRepository { Task AddAsync(Product p, CancellationToken ct); }

// Infrastructure implements it — references EF Core, references Domain
public class ProductRepository : IProductRepository { /* uses DbContext */ }
```

> **TS parallel:** This is "depend on abstractions, not concretions" — the D in SOLID. In NestJS you'd inject by a token (`@Inject('PRODUCT_REPO')`) against an interface; in .NET the DI container wires `IProductRepository` → `ProductRepository` for you.

---

## 4.2 The Four Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation  (API controllers / Minimal API)               │
│  - thin controllers, model binding, HTTP status codes        │
│         │ depends on                                          │
│         ▼                                                     │
│  Application  (use cases: commands, queries, DTOs, behaviors) │
│  - CQRS handlers, validation, mapping, orchestration         │
│         │ depends on                                          │
│         ▼                                                     │
│  Domain  (entities, value objects, domain events, interfaces) │  ◄── center
│  - business rules, NO external dependencies                  │
│         ▲                                                     │
│         │ implements Domain interfaces                        │
│  Infrastructure  (EF Core, PostgreSQL, email, HTTP clients)  │
└─────────────────────────────────────────────────────────────┘

Dependency direction:
  Presentation ──▶ Application ──▶ Domain ◀── Infrastructure

  Domain depends on NOTHING. Everyone depends on Domain.
```

Notice Infrastructure points **up** into Domain (it implements Domain's interfaces). That inverted arrow is dependency inversion in action — it's what lets the database depend on the business rules instead of the other way around.

In a .NET solution this maps to four separate `.csproj` projects, and the *project references* enforce the rule physically. The Domain project literally cannot call EF Core because it has no reference to it — the compiler stops you.

| Layer | Project | References | Node/Nest analogy |
|---|---|---|---|
| Domain | `Products.Domain` | (nothing) | Pure TS entity classes / domain models |
| Application | `Products.Application` | Domain | Nest services, use-case logic |
| Infrastructure | `Products.Infrastructure` | Application, Domain | TypeORM repos, mailer, API clients |
| Presentation | `Products.Api` | Application, Infrastructure | Nest controllers + `main.ts` bootstrap |

> The Api project references Infrastructure only so it can call `AddInfrastructure()` during DI wiring in `Program.cs`. It never *uses* Infrastructure types directly — it talks to the Application layer through MediatR.

---

## 4.3 Domain Layer

The innermost layer. Pure C#. No NuGet packages beyond maybe MediatR's contracts for domain events. This is where the business *lives*.

### Rich entities (not anemic data bags)

A common mistake (especially coming from JS, where models are often plain objects) is the **anemic domain model**: an entity with only public getters/setters and zero behavior, with all the logic sitting in services. A *rich* entity protects its own invariants.

```csharp
namespace Products.Domain.Entities;

public class Product
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public Money Price { get; private set; }      // value object — see below
    public int StockQuantity { get; private set; }

    // Audit fields (see 4.8)
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    // private setters mean the ONLY way to mutate state is through methods
    // that enforce the rules. No one can do product.Price = -5 from outside.

    private Product() { } // EF Core needs a parameterless ctor; keep it private

    public Product(string name, Money price, int initialStock)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Product name is required.");
        if (initialStock < 0)
            throw new DomainException("Initial stock cannot be negative.");

        Id = Guid.NewGuid();
        Name = name;
        Price = price;
        StockQuantity = initialStock;
        CreatedAt = DateTime.UtcNow;
    }

    // Behavior — business rules live HERE, not in a service
    public void DecreaseStock(int amount)
    {
        if (amount <= 0)
            throw new DomainException("Amount must be positive.");
        if (amount > StockQuantity)
            throw new DomainException(
                $"Cannot remove {amount} units; only {StockQuantity} in stock.");

        StockQuantity -= amount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ChangePrice(Money newPrice)
    {
        Price = newPrice;           // Money already guarantees it's valid & non-negative
        UpdatedAt = DateTime.UtcNow;
    }
}
```

> **Why private setters?** In TS you'd use `private` fields + methods to the same end, but TS `private` is only compile-time — JS can poke at it. C#'s `private set` is enforced by the runtime. The entity is a fortress: the only way in is through methods that uphold the rules.

### Value Objects — immutable, identity-less

A **value object** has no ID; it's defined entirely by its values. Two `Money(10, "USD")` are *equal* and interchangeable, the way two `5`s are. `record` gives you value equality for free (you saw this in Phase 1).

```csharp
namespace Products.Domain.ValueObjects;

public record Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    public Money(decimal amount, string currency)
    {
        if (amount < 0)
            throw new DomainException("Money amount cannot be negative.");
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            throw new DomainException("Currency must be a 3-letter ISO code.");

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    public Money Add(Money other)
    {
        if (other.Currency != Currency)
            throw new DomainException("Cannot add money of different currencies.");
        return new Money(Amount + other.Amount, Currency);
    }

    public override string ToString() => $"{Amount:0.00} {Currency}";
}
```

```csharp
// Another classic value object — validation lives in the type, so an Email
// instance is ALWAYS valid by construction.
public record Email
{
    public string Value { get; }
    public Email(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.Contains('@'))
            throw new DomainException("Invalid email address.");
        Value = value.ToLowerInvariant();
    }
    public override string ToString() => Value;
}
```

> **TS parallel:** Like a branded type (`type Email = string & { __brand: 'Email' }`) but actually enforced — you cannot construct an invalid `Email`. The validation can never be bypassed because there's no other constructor.

### Domain events — "something happened"

A domain event records a business fact ("a product went out of stock") so other parts of the system can react, without the entity knowing who's listening. MediatR can dispatch these as in-process notifications.

```csharp
using MediatR;

namespace Products.Domain.Events;

// INotification is MediatR's "fire to many handlers" contract (vs IRequest = one handler)
public record ProductOutOfStockEvent(Guid ProductId, string ProductName) : INotification;
```

```csharp
// Entity raises events into a list; the infrastructure dispatches them after SaveChanges.
public class Product
{
    private readonly List<INotification> _domainEvents = new();
    public IReadOnlyList<INotification> DomainEvents => _domainEvents.AsReadOnly();
    public void ClearDomainEvents() => _domainEvents.Clear();

    public void DecreaseStock(int amount)
    {
        // ... validation + StockQuantity -= amount ...
        if (StockQuantity == 0)
            _domainEvents.Add(new ProductOutOfStockEvent(Id, Name));
    }
}
```

> **Node analogy:** It's an `EventEmitter` baked into your domain, but the entity doesn't `emit` directly to listeners — it *records* the event and lets the dispatcher fan it out later. This keeps the domain decoupled from email senders, Slack notifiers, etc.

### Domain exceptions

A dedicated exception type lets the outer layers distinguish "the user broke a business rule" (→ HTTP 400/409) from "the database fell over" (→ 500).

```csharp
namespace Products.Domain.Exceptions;

public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
}

// A more specific one for "not found" — maps cleanly to 404 later
public class NotFoundException : Exception
{
    public NotFoundException(string entity, object key)
        : base($"{entity} with key '{key}' was not found.") { }
}
```

### Repository interfaces — defined here, implemented in Infrastructure

This is the dependency inversion linchpin. The interface lives in Domain (the inner layer that needs to persist things); the implementation lives in Infrastructure (the outer layer that knows about EF Core).

```csharp
using Products.Domain.Entities;

namespace Products.Domain.Repositories;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(Product product, CancellationToken ct = default);
    void Update(Product product);            // EF tracks changes; no async needed
    void Remove(Product product);
    Task<bool> ExistsByNameAsync(string name, CancellationToken ct = default);
}
```

> Note the return type is `Product` (the domain entity), never an EF-specific or DTO type. The Domain has no idea EF Core exists; it just trusts *someone* will fulfill this contract.

---

## 4.4 Application Layer

This is the orchestration layer — your **use cases**. Each use case is one command or one query (CQRS, see 4.7). The Application layer depends on Domain interfaces and coordinates them; it does *not* contain business rules (those are in the entities) and does *not* know about HTTP or SQL.

### MediatR — an in-process bus

MediatR is a tiny mediator: you `Send` a request object, and it finds the one handler registered for that request type and runs it. No controller-to-service wiring by hand, and it gives you a **pipeline** (middleware) for cross-cutting concerns.

> **Node analogy:** Think of it as a typed, in-process command bus — closer to a CQRS message bus than to `EventEmitter`. `IRequest<T>` = "one handler, returns T" (a command/query); `INotification` = "zero-to-many handlers, returns nothing" (a domain event). The pipeline behaviors are exactly like Express/Nest middleware, but for *application messages* instead of HTTP requests.

### Commands — mutate state

```csharp
using MediatR;

namespace Products.Application.Products.Commands.CreateProduct;

// The command is just a data record describing intent. IRequest<Guid> = returns the new id.
public record CreateProductCommand(
    string Name,
    decimal Price,
    string Currency,
    int InitialStock) : IRequest<Guid>;
```

```csharp
using MediatR;
using Products.Domain.Entities;
using Products.Domain.Exceptions;
using Products.Domain.Repositories;
using Products.Domain.ValueObjects;

namespace Products.Application.Products.Commands.CreateProduct;

public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IUnitOfWork _unitOfWork;   // wraps SaveChangesAsync — see 4.5

    public CreateProductCommandHandler(IProductRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> Handle(CreateProductCommand request, CancellationToken ct)
    {
        // Application-level rule: uniqueness needs the DB, so it lives in the use case,
        // not in the entity (the entity can't see other products).
        if (await _repository.ExistsByNameAsync(request.Name, ct))
            throw new DomainException($"A product named '{request.Name}' already exists.");

        // Construct value object + entity — invariants enforced inside the domain
        var price = new Money(request.Price, request.Currency);
        var product = new Product(request.Name, price, request.InitialStock);

        await _repository.AddAsync(product, ct);
        await _unitOfWork.SaveChangesAsync(ct);   // one transaction per use case

        return product.Id;
    }
}
```

### Queries — read state

```csharp
using MediatR;

namespace Products.Application.Products.Queries.GetProductById;

public record GetProductByIdQuery(Guid Id) : IRequest<ProductDto>;
```

```csharp
using MediatR;
using Products.Domain.Exceptions;
using Products.Domain.Repositories;

namespace Products.Application.Products.Queries.GetProductById;

public class GetProductByIdQueryHandler : IRequestHandler<GetProductByIdQuery, ProductDto>
{
    private readonly IProductRepository _repository;

    public GetProductByIdQueryHandler(IProductRepository repository)
        => _repository = repository;

    public async Task<ProductDto> Handle(GetProductByIdQuery request, CancellationToken ct)
    {
        var product = await _repository.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Product), request.Id);

        // Map entity -> DTO before returning. NEVER return the entity itself (see below).
        return new ProductDto(
            product.Id,
            product.Name,
            product.Price.Amount,
            product.Price.Currency,
            product.StockQuantity);
    }
}
```

### DTOs — never expose entities

A **DTO** is the shape that crosses the boundary out to the client. Returning entities directly leaks your domain (private setters get serialized as read-only, domain events serialize as junk, and you couple your API contract to your DB schema — change one, break the other).

```csharp
namespace Products.Application.Products.Queries.GetProductById;

public record ProductDto(
    Guid Id,
    string Name,
    decimal Price,
    string Currency,
    int StockQuantity);
```

> **TS parallel:** Same reason you don't return your TypeORM entity straight from a Nest controller — you map to a response DTO/`class-transformer` view. The DTO is your public API contract; the entity is a private implementation detail.

### Mapping — AutoMapper or by hand

**Manual mapping** (shown above) is explicit, debuggable, and has zero magic — for a learning project and for small DTOs it's often the better call. **AutoMapper** removes boilerplate when you have many similar mappings, at the cost of "where did this value come from?" indirection.

```csharp
// AutoMapper version: define a Profile in the Application layer
using AutoMapper;
using Products.Domain.Entities;

public class ProductMappingProfile : Profile
{
    public ProductMappingProfile()
    {
        CreateMap<Product, ProductDto>()
            // flatten the Money value object into two DTO fields
            .ForCtorParam("Price", o => o.MapFrom(s => s.Price.Amount))
            .ForCtorParam("Currency", o => o.MapFrom(s => s.Price.Currency));
    }
}

// Then in a handler:
// var dto = _mapper.Map<ProductDto>(product);
```

> **Recommendation for this repo:** start with **manual mapping** — it keeps the value-object flattening obvious. Reach for AutoMapper only once the boilerplate genuinely hurts.

### FluentValidation — input shape checks

FluentValidation handles *input* validation (is the string non-empty? is the price > 0?) — distinct from *domain* invariants (which live in the entity as a last line of defense). The validator runs automatically in the MediatR pipeline (next: behaviors in 4.7), so handlers never start with a wall of `if`-guards.

```csharp
using FluentValidation;

namespace Products.Application.Products.Commands.CreateProduct;

public class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200);

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be positive.");

        RuleFor(x => x.Currency)
            .NotEmpty().Length(3).WithMessage("Currency must be a 3-letter ISO code.");

        RuleFor(x => x.InitialStock)
            .GreaterThanOrEqualTo(0);
    }
}
```

> **TS parallel:** This is Zod/Joi for your command objects. The difference: it's wired into the message pipeline so every command of this type is validated before its handler ever runs — no per-handler `schema.parse(input)` call.

---

## 4.5 Infrastructure Layer

The outer layer that talks to the real world: the database, email providers, HTTP APIs. It **implements** the interfaces defined in Domain. This is the only layer that references EF Core, Npgsql, SMTP clients, etc.

### DbContext + IEntityTypeConfiguration<T>

The `DbContext` is your DB session (Phase 3). Mapping config goes in per-entity `IEntityTypeConfiguration<T>` classes — keeps the context clean and each entity's mapping in its own file.

```csharp
using Microsoft.EntityFrameworkCore;
using Products.Domain.Entities;

namespace Products.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Auto-apply every IEntityTypeConfiguration in this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
```

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Products.Domain.Entities;

namespace Products.Infrastructure.Persistence.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.HasIndex(p => p.Name).IsUnique();
        builder.Property(p => p.StockQuantity).IsRequired();

        // Map the Money value object into owned columns (no separate table)
        builder.OwnsOne(p => p.Price, price =>
        {
            price.Property(m => m.Amount).HasColumnName("Price").HasColumnType("numeric(18,2)");
            price.Property(m => m.Currency).HasColumnName("Currency").HasMaxLength(3);
        });

        // Domain events are not persisted — tell EF to ignore the list
        builder.Ignore(p => p.DomainEvents);
    }
}
```

> `OwnsOne` is how EF Core stores a value object inline on the owner's table — the `Money` becomes `Price` + `Currency` columns on the `Products` table, with no `Id` of its own. That's exactly the value-object semantics: no identity.

### Repository implementation + Unit of Work

```csharp
using Microsoft.EntityFrameworkCore;
using Products.Domain.Entities;
using Products.Domain.Repositories;
using Products.Infrastructure.Persistence;

namespace Products.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly AppDbContext _db;
    public ProductRepository(AppDbContext db) => _db = db;

    public async Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken ct = default)
        => await _db.Products.AsNoTracking().ToListAsync(ct);   // read-only -> no tracking

    public async Task AddAsync(Product product, CancellationToken ct = default)
        => await _db.Products.AddAsync(product, ct);

    public void Update(Product product) => _db.Products.Update(product);
    public void Remove(Product product) => _db.Products.Remove(product);

    public async Task<bool> ExistsByNameAsync(string name, CancellationToken ct = default)
        => await _db.Products.AnyAsync(p => p.Name == name, ct);
}
```

```csharp
// IUnitOfWork lives in Domain/Application; implementation wraps the DbContext.
// Keeps SaveChanges out of the repository so a use case controls the transaction boundary.
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;
    public UnitOfWork(AppDbContext db) => _db = db;
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
```

### External service clients

Same pattern: Application/Domain defines `IEmailSender`, Infrastructure implements it with the actual SMTP/SendGrid/HTTP code.

```csharp
// Interface (Application layer)
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct = default);
}

// Implementation (Infrastructure layer) — only this file knows about the email provider
public class SmtpEmailSender : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        // ... real SMTP / HTTP client call here ...
        return Task.CompletedTask;
    }
}
```

### Migrations live here

Because the `DbContext` lives in Infrastructure, migrations are generated against that project. You point the EF tools at Infrastructure for the model and at the Api project as the startup (it has the connection string + DI):

```bash
# Run from the solution root
dotnet ef migrations add InitialCreate \
  --project src/Products.Infrastructure \
  --startup-project src/Products.Api

dotnet ef database update \
  --project src/Products.Infrastructure \
  --startup-project src/Products.Api
```

---

## 4.6 Presentation Layer

Controllers are **thin**. Their entire job: bind the HTTP request to a command/query, `Send` it through MediatR, and translate the result to an HTTP response. **Zero business logic.**

```csharp
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Products.Application.Products.Commands.CreateProduct;
using Products.Application.Products.Queries.GetProductById;

namespace Products.Api.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/products")]
[ApiVersion("1.0")]
public class ProductsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProductsController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    public async Task<IActionResult> Create(CreateProductCommand command, CancellationToken ct)
    {
        var id = await _mediator.Send(command, ct);
        // 201 + Location header pointing at the new resource
        return CreatedAtAction(nameof(GetById), new { id, version = "1.0" }, new { id });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken ct)
    {
        var product = await _mediator.Send(new GetProductByIdQuery(id), ct);
        return Ok(product);
    }
}
```

Notice what's *missing*: no validation (the pipeline did it), no try/catch (global handler does it), no mapping (the handler did it), no DB calls. If a controller action is more than a few lines, logic has leaked in.

> **Node analogy:** This is the disciplined version of "controllers stay skinny, services do the work" — except here the controller doesn't even call a service directly; it dispatches a message. In NestJS terms, imagine every controller method being a one-liner `return this.commandBus.execute(new CreateProductCommand(...))` using `@nestjs/cqrs` — same shape.

### Global exception handling middleware

Instead of try/catch in every controller, one place translates exceptions to HTTP responses. .NET 8+ offers `IExceptionHandler`; here's the explicit middleware form so the mapping is visible:

```csharp
using Products.Domain.Exceptions;
using FluentValidation;

namespace Products.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)   // from FluentValidation pipeline behavior
        {
            await Write(context, StatusCodes.Status400BadRequest, "Validation failed",
                ex.Errors.Select(e => e.ErrorMessage));
        }
        catch (NotFoundException ex)
        {
            await Write(context, StatusCodes.Status404NotFound, ex.Message);
        }
        catch (DomainException ex)       // business-rule violation
        {
            await Write(context, StatusCodes.Status409Conflict, ex.Message);
        }
        catch (Exception ex)             // anything unexpected -> 500, and LOG it
        {
            _logger.LogError(ex, "Unhandled exception");
            await Write(context, StatusCodes.Status500InternalServerError, "An unexpected error occurred.");
        }
    }

    private static Task Write(HttpContext ctx, int status, string title, object? errors = null)
    {
        ctx.Response.StatusCode = status;
        // ProblemDetails = RFC 7807, the standard .NET error shape (Phase 2)
        return ctx.Response.WriteAsJsonAsync(new { title, status, errors });
    }
}
```

> **Node analogy:** This is your Express error-handling middleware (`app.use((err, req, res, next) => ...)`) — the one with four args that catches everything thrown downstream. Same job, mapping domain exceptions to status codes in a single place.

### API versioning

Use the `Asp.Versioning.Mvc` package so you can evolve the contract without breaking existing clients. URL versioning (`/api/v1/products`) is the most discoverable:

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;        // adds api-supported-versions response header
}).AddMvc();
```

---

## 4.7 CQRS (Command Query Responsibility Segregation)

**CQRS** = separate the *write* model from the *read* model. Commands change state and return little (an id, or nothing). Queries read state and return DTOs, mutating nothing.

| | Command | Query |
|---|---|---|
| Purpose | Change state | Read state |
| Returns | id / void | DTO / DTO list |
| Side effects | Yes | No |
| Example | `CreateProductCommand` | `GetProductByIdQuery` |
| Can use `AsNoTracking()` | No (it mutates) | Yes (read-only, faster) |

### Why separate them?

- **Clarity of intent** — the type name tells you whether something mutates. No guessing.
- **Independent optimization** — queries can bypass the domain entities entirely and project straight to DTOs with raw SQL or `Select()` for speed; commands go through rich entities to enforce rules.
- **Single Responsibility** — each handler does exactly one thing, so it's trivial to test.

> You do **not** need separate databases or event sourcing for CQRS. At this level it's simply "commands and queries are different classes with different handlers." Don't over-engineer it.

### MediatR pipeline behaviors

A behavior wraps every `Send` like middleware wraps every HTTP request — it runs before/after the handler. This is where cross-cutting concerns go, written *once* instead of in every handler.

```csharp
using MediatR;

namespace Products.Application.Common.Behaviors;

// Runs for EVERY request: logs name in, logs name + timing out.
public class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;
    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger) => _logger = logger;

    public async Task<TResponse> Handle(
        TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var name = typeof(TRequest).Name;
        _logger.LogInformation("Handling {RequestName}", name);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var response = await next();           // call the next behavior / the handler
        sw.Stop();

        // Performance monitoring rolled into the same behavior
        if (sw.ElapsedMilliseconds > 500)
            _logger.LogWarning("{RequestName} took {Elapsed}ms (slow)", name, sw.ElapsedMilliseconds);
        else
            _logger.LogInformation("Handled {RequestName} in {Elapsed}ms", name, sw.ElapsedMilliseconds);

        return response;
    }
}
```

```csharp
using FluentValidation;
using MediatR;

namespace Products.Application.Common.Behaviors;

// Runs all registered FluentValidation validators for the request type before the handler.
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;
    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators) => _validators = validators;

    public async Task<TResponse> Handle(
        TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (_validators.Any())
        {
            var context = new ValidationContext<TRequest>(request);
            var failures = _validators
                .Select(v => v.Validate(context))
                .SelectMany(r => r.Errors)
                .Where(f => f is not null)
                .ToList();

            if (failures.Count != 0)
                throw new ValidationException(failures);   // caught by global handler -> 400
        }
        return await next();   // valid -> proceed to the handler
    }
}
```

> **Node analogy:** Pipeline behaviors are Express/Nest middleware, but scoped to your *application messages*. `LoggingBehavior` is your request logger; `ValidationBehavior` is your validation middleware (`celebrate`/`zod` middleware) — written once and applied to every command and query automatically.

---

## 4.8 Cross-Cutting Concerns

Things every layer needs but none should own: logging, error handling, validation, auditing. Behaviors and middleware are how Clean Architecture keeps these out of your business code.

### Serilog — structured logging

Plain string logs are hard to query. **Structured logging** logs key/value pairs (JSON), so you can later filter by `RequestName` or `Elapsed` in Seq/ELK. Note the `{RequestName}` placeholders in the behaviors above — those become *queryable fields*, not just interpolated text.

```csharp
// Program.cs — configure Serilog as the logging provider
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)   // read sinks/levels from appsettings.json
    .Enrich.FromLogContext()                         // attach contextual props (e.g. request id)
    .WriteTo.Console());                             // add .WriteTo.Seq(...) etc. in prod
```

> **Node analogy:** Serilog is Winston/Pino. Structured logging is the `logger.info({ requestName, elapsed }, "...")` style over plain `console.log` — so logs are searchable, not just readable.

### Global exception handling

Covered in 4.6 — one middleware (or `IExceptionHandler`) maps `DomainException` → 409, `NotFoundException` → 404, `ValidationException` → 400, everything else → 500 (and logs it). No try/catch scattered through handlers or controllers.

### Validation pipeline

Covered in 4.4 + 4.7 — FluentValidation validators run inside `ValidationBehavior`, so validation happens automatically before every handler. The handler can assume its input is shape-valid.

### Audit fields

Track `CreatedAt`, `UpdatedAt`, `CreatedBy` on entities. You can set them in entity methods (as `Product` does for `CreatedAt`/`UpdatedAt` above), but the clean approach is to centralize it by overriding `SaveChangesAsync`:

```csharp
// A marker interface for auditable entities (put in Domain)
public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    DateTime? UpdatedAt { get; set; }
    string? CreatedBy { get; set; }
}

// In AppDbContext — stamp audit fields automatically on every save
public override Task<int> SaveChangesAsync(CancellationToken ct = default)
{
    foreach (var entry in ChangeTracker.Entries<IAuditable>())
    {
        if (entry.State == EntityState.Added)
        {
            entry.Entity.CreatedAt = DateTime.UtcNow;
            entry.Entity.CreatedBy = _currentUser.UserId;   // inject ICurrentUserService
        }
        else if (entry.State == EntityState.Modified)
        {
            entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
    }
    return base.SaveChangesAsync(ct);
}
```

> **Why centralize?** Like a TypeORM `@BeforeInsert()`/`@BeforeUpdate()` hook or a Mongoose pre-save hook — you set timestamps in one place so no developer can forget to stamp `UpdatedAt` on a write.

### The DI wiring (Program.cs)

Each layer exposes one extension method (`AddApplication`, `AddInfrastructure`) so `Program.cs` stays readable and each layer owns its own registrations.

```csharp
// Products.Application/DependencyInjection.cs
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Products.Application.Common.Behaviors;
using System.Reflection;

namespace Products.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        // Register all MediatR handlers in this assembly
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(assembly));

        // Register all FluentValidation validators in this assembly
        services.AddValidatorsFromAssembly(assembly);

        // Register pipeline behaviors — ORDER MATTERS: logging wraps validation wraps handler
        services.AddTransient(typeof(MediatR.IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        services.AddTransient(typeof(MediatR.IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        // services.AddAutoMapper(assembly); // only if using AutoMapper
        return services;
    }
}
```

```csharp
// Products.Infrastructure/DependencyInjection.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Products.Domain.Repositories;
using Products.Infrastructure.Persistence;
using Products.Infrastructure.Repositories;

namespace Products.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Default")));

        // Wire each Domain interface to its Infrastructure implementation (Scoped = per request)
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        return services;
    }
}
```

```csharp
// Products.Api/Program.cs — the composition root, the ONLY place all layers meet
var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog(/* ... */);

builder.Services.AddApplication();                       // Application layer
builder.Services.AddInfrastructure(builder.Configuration); // Infrastructure layer
builder.Services.AddControllers();
builder.Services.AddApiVersioning(/* ... */).AddMvc();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();  // first, so it catches everything
app.UseSerilogRequestLogging();                    // one tidy log line per HTTP request
app.MapControllers();
app.Run();
```

> **Node analogy:** `Program.cs` is your `main.ts` / `server.js` — the composition root where you wire concrete implementations to abstractions, exactly like a NestJS root module's `providers` array or manual `container.bind()` calls in InversifyJS.

---

## Gotchas for JS/TS Developers

| Gotcha | What trips up JS/TS devs |
|---|---|
| **Domain depends on nothing** | Tempting to `import` EF Core into an entity for convenience. Don't — the project reference doesn't even exist, so it won't compile. That's the point. |
| **Anemic models** | Coming from plain-object models, you'll want getters/setters + logic in services. Push behavior *into* entities; keep services (handlers) thin. |
| **Entities ≠ DTOs** | Returning the entity from a query "just works" in JS. In C# it serializes private setters oddly, leaks domain events, and couples your API to your DB. Always map to a DTO. |
| **`private set` is real** | Unlike TS `private` (compile-time only), C#'s `private set` is runtime-enforced. Lean on it to protect invariants. |
| **Value objects need value equality** | Use `record`, not `class`, or two equal `Money`s compare as unequal (reference equality). |
| **Pipeline behavior order** | Behaviors run in registration order, outermost first. Register logging before validation if you want to log invalid requests too. |
| **`IRequest` vs `INotification`** | `IRequest<T>` = exactly one handler (command/query). `INotification` = zero-to-many handlers (domain event). Mixing them up means your handler silently never runs. |
| **`async void` in handlers** | Same Phase 1 rule: handlers return `Task`/`Task<T>`, never `void`. Exceptions in `async void` vanish. |
| **Migrations need two projects** | `--project` (where DbContext lives = Infrastructure) and `--startup-project` (where config + DI live = Api). Forgetting `--startup-project` gives a confusing "no connection string" error. |
| **Over-engineering CQRS** | You do NOT need separate read/write databases or event sourcing. CQRS here just means "commands and queries are separate classes." |

---

## Phase 4 Project — Rebuild the Products API with Clean Architecture

**Goal:** Take the Phase 2/3 Products API and restructure it into four projects following the Dependency Rule. This is the **main reference project** every later phase (auth, testing, microservices) builds on.

### Solution & project structure

```bash
# From .net/examples/
mkdir phase4-clean-arch && cd phase4-clean-arch
dotnet new sln -n Products

# Four projects (classlibs for the inner three, webapi for the outer)
dotnet new classlib -n Products.Domain         -o src/Products.Domain
dotnet new classlib -n Products.Application    -o src/Products.Application
dotnet new classlib -n Products.Infrastructure -o src/Products.Infrastructure
dotnet new webapi    -n Products.Api           -o src/Products.Api

# Add all to the solution
dotnet sln add src/Products.Domain src/Products.Application src/Products.Infrastructure src/Products.Api

# Wire project references to ENFORCE the dependency rule (this is the whole game)
dotnet add src/Products.Application    reference src/Products.Domain
dotnet add src/Products.Infrastructure reference src/Products.Application
dotnet add src/Products.Api            reference src/Products.Application src/Products.Infrastructure
```

```
phase4-clean-arch/
├── Products.sln
└── src/
    ├── Products.Domain/
    │   ├── Entities/          Product.cs
    │   ├── ValueObjects/      Money.cs, Email.cs
    │   ├── Events/            ProductOutOfStockEvent.cs
    │   ├── Exceptions/        DomainException.cs, NotFoundException.cs
    │   └── Repositories/      IProductRepository.cs, IUnitOfWork.cs
    ├── Products.Application/
    │   ├── Common/Behaviors/  LoggingBehavior.cs, ValidationBehavior.cs
    │   ├── Products/
    │   │   ├── Commands/CreateProduct/   Command + Handler + Validator
    │   │   └── Queries/GetProductById/   Query + Handler + ProductDto
    │   └── DependencyInjection.cs
    ├── Products.Infrastructure/
    │   ├── Persistence/       AppDbContext.cs
    │   │   └── Configurations/ ProductConfiguration.cs
    │   ├── Repositories/      ProductRepository.cs, UnitOfWork.cs
    │   ├── Services/          SmtpEmailSender.cs
    │   ├── Migrations/        (generated by EF)
    │   └── DependencyInjection.cs
    └── Products.Api/
        ├── Controllers/       ProductsController.cs
        ├── Middleware/        ExceptionHandlingMiddleware.cs
        ├── Program.cs
        └── appsettings.json
```

### NuGet packages

```bash
dotnet add src/Products.Application package MediatR
dotnet add src/Products.Application package FluentValidation
dotnet add src/Products.Application package FluentValidation.DependencyInjectionExtensions
# dotnet add src/Products.Application package AutoMapper   # optional

dotnet add src/Products.Infrastructure package Microsoft.EntityFrameworkCore
dotnet add src/Products.Infrastructure package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add src/Products.Infrastructure package Microsoft.EntityFrameworkCore.Design

dotnet add src/Products.Api package Serilog.AspNetCore
dotnet add src/Products.Api package Asp.Versioning.Mvc
```

### Build order (step hints)

1. **Domain first.** Build `Product` (rich, private setters, `DecreaseStock`), `Money` value object, `DomainException`/`NotFoundException`, and `IProductRepository` + `IUnitOfWork`. Compile — it has no dependencies, so it should build clean.
2. **Application next.** `CreateProductCommand` + handler + validator, `GetProductByIdQuery` + handler + `ProductDto`. Add the two pipeline behaviors and `AddApplication()`. Map entity → DTO manually for now.
3. **Infrastructure.** `AppDbContext` + `ProductConfiguration` (with `OwnsOne` for `Money`), `ProductRepository`, `UnitOfWork`, and `AddInfrastructure()`. Generate the migration (`--project Infrastructure --startup-project Api`).
4. **Api last.** `ProductsController` (thin — only `_mediator.Send`), `ExceptionHandlingMiddleware`, Serilog, API versioning, and the `Program.cs` composition root.
5. **Verify the Dependency Rule:** try to reference `AppDbContext` from a controller — you can (Api references Infrastructure for DI), but try to reference EF Core from `Product` and confirm it won't compile. That failed compile is Clean Architecture working.
6. **Test the boundary:** in a later phase you'll unit-test `Product.DecreaseStock` with no DB and no HTTP — prove the payoff.

### Acceptance checklist

- [ ] `POST /api/v1/products` creates a product, returns 201 + id
- [ ] `GET /api/v1/products/{id}` returns a `ProductDto` (never the entity)
- [ ] Invalid input → 400 via `ValidationBehavior` (no `if`-guards in the handler)
- [ ] Duplicate name → 409 via `DomainException` + global handler
- [ ] Unknown id → 404 via `NotFoundException`
- [ ] Every request logs name + timing via `LoggingBehavior`
- [ ] `Products.Domain` has zero NuGet references to EF Core / ASP.NET

---

## Summary

| Concept | What it is | Node/Nest analogy |
|---|---|---|
| **Dependency Rule** | Dependencies point inward to Domain | "Depend on abstractions" (SOLID-D) |
| **Domain layer** | Entities + value objects + interfaces, no deps | Pure model classes, no `express`/ORM import |
| **Rich entity** | Behavior + invariants inside the entity | Model methods over service-only logic |
| **Value object** | Immutable, identity-less, value equality (`record`) | Branded type, but enforced |
| **Application layer** | Use cases as commands/queries (CQRS) | Nest services / `@nestjs/cqrs` handlers |
| **MediatR** | In-process command/query/event bus | Typed command bus (not just EventEmitter) |
| **Command vs Query** | Write (returns id) vs Read (returns DTO) | Mutation vs query resolver |
| **DTO** | Boundary shape; never expose entities | Response DTO / serialization view |
| **FluentValidation** | Declarative input validation in the pipeline | Zod/Joi as middleware |
| **Pipeline behavior** | Middleware for application messages | Express/Nest middleware |
| **Infrastructure** | EF Core, repos, clients; implements interfaces | TypeORM repos + mailer + API clients |
| **`IEntityTypeConfiguration<T>`** | Per-entity EF mapping | Entity decorators / schema files |
| **Presentation** | Thin controllers, only `_mediator.Send` | Skinny controllers dispatching commands |
| **Global exception middleware** | One place maps exceptions → status codes | Express 4-arg error handler |
| **Serilog** | Structured (JSON) logging | Winston / Pino |
| **Audit fields** | `CreatedAt`/`UpdatedAt`/`CreatedBy`, auto-stamped | TypeORM/Mongoose pre-save hooks |
| **Composition root** | `Program.cs` wires everything via DI | `main.ts` / root module `providers` |
