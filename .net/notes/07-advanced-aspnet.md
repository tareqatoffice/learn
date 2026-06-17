# Phase 7 — Advanced ASP.NET Core

**Status:** Not started
**Targets:** .NET 10

---

This phase is the "production hardening" layer — the cross-cutting concerns you bolt onto a working API so it survives real traffic: validation, error handling, structured logging, caching, background work, health probes, versioning, and API docs. In Node terms, this is the stuff you reach for `zod`, `pino`, `node-cache`, `bullmq`, and `swagger-jsdoc` to solve. .NET has a first-class, built-in (or near-built-in) equivalent for each.

There's no mini-project this phase — it's a toolbox. Treat each section as a recipe you'll drop into the Clean Architecture project from Phase 4.

---

## 7.1 Validation with FluentValidation

### The Node analogy

You've used `zod` or `joi` to validate request bodies before they hit your business logic. **FluentValidation** is the .NET equivalent — a separate, declarative validation library that lives outside your models.

| | Zod / Joi | FluentValidation |
|---|---|---|
| Schema location | separate `z.object({...})` | separate `AbstractValidator<T>` class |
| Rule style | chained: `.string().min(1).max(100)` | chained: `.NotEmpty().MaximumLength(100)` |
| Custom rules | `.refine(fn, msg)` | `.Must(fn)` / `.Custom(...)` |
| Async rules | `.refine(async ...)` | `.MustAsync(...)` |
| Conditional | `.optional()` / refinements | `.When(...)` / `.Unless(...)` |

> ASP.NET also has built-in *DataAnnotations* (`[Required]`, `[MaxLength]` attributes on properties — like `class-validator` decorators in Nest). They work, but they clutter your DTOs and can't express complex cross-field rules cleanly. FluentValidation keeps validation in its own class, which is why Clean Architecture projects prefer it.

```bash
dotnet add package FluentValidation
dotnet add package FluentValidation.DependencyInjectionExtensions
```

### A validator — `AbstractValidator<T>`

A validator is just a class that inherits `AbstractValidator<TheThingToValidate>` and wires up rules in its constructor.

```csharp
using FluentValidation;

// The command we want to validate (a MediatR command from Phase 4)
public record CreateUserCommand(string Name, string Email, int Age) : IRequest<Guid>;

// The validator — one class per thing-to-validate
public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        // RuleFor picks a property; the chain after it adds rules.
        // Each rule has a default message you can override with .WithMessage(...)
        RuleFor(x => x.Name)
            .NotEmpty()                       // like zod .min(1) — not null, not ""
            .MaximumLength(100);              // like zod .max(100)

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()                   // built-in email rule
            .WithMessage("Provide a valid email address.");

        RuleFor(x => x.Age)
            .InclusiveBetween(18, 120)        // 18 <= age <= 120
            .WithMessage("Age must be between 18 and 120.");
    }
}
```

### Custom validators — `.Must()`, `.MustAsync()`, and reusable extensions

`.Must()` is your `.refine()`. For DB-backed checks (e.g. "email not already taken") use `.MustAsync()` and inject a repository into the validator (validators are registered in DI, so constructor injection just works).

```csharp
public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator(IUserRepository users)
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            // .Must runs a sync predicate — return true if valid
            .Must(name => !name.Contains("admin", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Name cannot contain 'admin'.");

        RuleFor(x => x.Email)
            .NotEmpty().EmailAddress()
            // .MustAsync runs an async predicate — perfect for uniqueness checks
            .MustAsync(async (email, ct) => !await users.EmailExistsAsync(email, ct))
            .WithMessage("Email is already registered.");
    }
}

// Reusable rule via an extension method — like writing a shared zod helper.
// IRuleBuilder<T, string> is "a rule chain currently focused on a string property".
public static class ValidationExtensions
{
    public static IRuleBuilderOptions<T, string> StrongPassword<T>(
        this IRuleBuilder<T, string> rule)
    {
        return rule
            .NotEmpty()
            .MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Must contain an uppercase letter.")
            .Matches("[0-9]").WithMessage("Must contain a digit.");
    }
}

// Usage: RuleFor(x => x.Password).StrongPassword();
```

### Auto-validation via a MediatR pipeline behavior

The clean way to run validators is **not** in your controllers and **not** in your handlers — it's in a MediatR *pipeline behavior*. A behavior wraps every `Send()` call (think Express middleware, but for the in-process command bus). One behavior validates every command automatically; if it fails, the handler never runs.

```csharp
using FluentValidation;
using MediatR;

// TRequest/TResponse make this run for EVERY MediatR request.
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    // DI injects ALL validators registered for TRequest (usually 0 or 1).
    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
        => _validators = validators;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,   // "next()" — calls the actual handler
        CancellationToken ct)
    {
        // No validator for this request type? Skip straight to the handler.
        if (!_validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);

        // Run every validator; collect all failures across all of them.
        var results = await Task.WhenAll(
            _validators.Select(v => v.ValidateAsync(context, ct)));

        var failures = results
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        // Throw FluentValidation's own exception — section 7.2 turns this into a 400.
        if (failures.Count > 0)
            throw new ValidationException(failures);

        return await next();   // all good — run the handler
    }
}
```

Register everything in `Program.cs`:

```csharp
// Scans the assembly and registers every AbstractValidator<T> it finds.
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserCommandValidator>();

// Register MediatR + the behavior. Behaviors run in registration order.
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblyContaining<CreateUserCommandValidator>();
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));  // <,> = open generic
});
```

Now any command with a validator is validated before its handler runs — zero code in the controller or handler. That `ValidationException` becomes a clean 400 response in the next section.

---

## 7.2 Global Error Handling

### The problem

In Express you have one error-handling middleware (`app.use((err, req, res, next) => ...)`) that catches everything and shapes a consistent JSON error. Without it, a thrown error leaks a stack trace to the client. ASP.NET is the same: you want one place that converts exceptions into a consistent, documented error body — and never leaks internals in production.

### ProblemDetails — the standard error shape

.NET has a built-in, RFC 9457 (formerly 7807) error format called **`ProblemDetails`**. Instead of inventing your own `{ error: "..." }` shape, you return this standardized object. `ValidationProblemDetails` extends it with a per-field `errors` dictionary.

```jsonc
// ProblemDetails
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Email is already registered.",
  "traceId": "00-abc123...-..."   // correlation id, auto-added — great for log lookups
}

// ValidationProblemDetails (note the per-field "errors")
{
  "type": "...",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Email": ["Email is already registered."],
    "Age": ["Age must be between 18 and 120."]
  }
}
```

### `IExceptionHandler` — the modern approach (.NET 8+)

The old way was a try/catch middleware. The modern, recommended way is to implement **`IExceptionHandler`** — a clean, testable, DI-friendly class. You can register several; they're tried in order until one returns `true` (handled). Think of it as a typed chain of error handlers.

```csharp
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

// Handler #1: turns FluentValidation failures into a 400 ValidationProblemDetails.
public class ValidationExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;

    public ValidationExceptionHandler(IProblemDetailsService problemDetails)
        => _problemDetails = problemDetails;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken ct)
    {
        // Only handle ValidationException — let others fall through to the next handler.
        if (exception is not ValidationException validationException)
            return false;

        // Group failures by property name into the errors dictionary.
        var errors = validationException.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;

        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred."
            }
        });
    }
}

// Handler #2: the catch-all. Logs the real error, returns a safe 500.
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(
        IProblemDetailsService problemDetails,
        ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetails = problemDetails;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        // Log the FULL exception server-side (structured — see 7.3)...
        _logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        // ...but return a generic message to the client. Never leak stack traces.
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Detail = "Please contact support if the problem persists."
            }
        });
    }
}
```

Wire it up in `Program.cs`. Order matters — specific handlers first, catch-all last:

```csharp
builder.Services.AddProblemDetails();                       // enables IProblemDetailsService
builder.Services.AddExceptionHandler<ValidationExceptionHandler>();  // tried first
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();      // catch-all, last

var app = builder.Build();

// One line activates the chain. Put it early in the pipeline.
app.UseExceptionHandler();
```

> `UseExceptionHandler()` is the umbrella middleware that drives the handler chain; the `IExceptionHandler` classes are where the logic lives. Custom domain exceptions (e.g. `NotFoundException`, `ForbiddenException`) get their own handlers mapping to 404 / 403 — same pattern, different `if` check and status code.

---

## 7.3 Logging with Serilog

### Structured logging — log objects, not strings

`Console.WriteLine` and even the built-in `ILogger` text output are fine for dev, but in production you want **structured logs**: each log line is a JSON object with named fields you can filter and aggregate on. This is exactly the Winston/Pino mindset.

```
// Text logging (hard to query):
"User 42 placed order 9981 for $59.99"

// Structured logging (queryable: filter by UserId=42):
{ "Message": "User placed order", "UserId": 42, "OrderId": 9981, "Total": 59.99 }
```

**Serilog** is the de-facto structured logging library for .NET — the Pino/Winston of the ecosystem. It plugs into the standard `ILogger<T>` you already inject, so your code doesn't change, only the output does.

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq          # optional structured-log server
dotnet add package Serilog.Enrichers.Environment
```

### Setup in `Program.cs`

```csharp
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Replace the default logging with Serilog, configured from appsettings.json.
builder.Host.UseSerilog((context, services, config) => config
    .ReadFrom.Configuration(context.Configuration)  // read sinks/levels from config
    .ReadFrom.Services(services)                     // let DI contribute enrichers
    .Enrich.FromLogContext()                         // include pushed context properties
    .Enrich.WithMachineName());

var app = builder.Build();

// Logs ONE structured line per HTTP request (method, path, status, elapsed ms)
// instead of the noisy multi-line default. Like pino-http / morgan.
app.UseSerilogRequestLogging();
```

Configuration lives in `appsettings.json` — **sinks** are output destinations (Pino "transports"):

```jsonc
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": { "Microsoft.AspNetCore": "Warning" }  // quiet the framework
    },
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": {
          "path": "logs/app-.json",
          "rollingInterval": "Day",                 // new file each day
          "formatter": "Serilog.Formatting.Json.JsonFormatter, Serilog"
      }},
      { "Name": "Seq", "Args": { "serverUrl": "http://localhost:5341" } }
    ]
  }
}
```

### Log levels

Maps almost 1:1 to Pino/Winston, ordered least → most severe:

| Serilog | Pino/Winston | Use for |
|---|---|---|
| `Verbose` | `trace` | extremely fine-grained tracing |
| `Debug` | `debug` | dev diagnostics |
| `Information` | `info` | normal events (request handled, order placed) |
| `Warning` | `warn` | recoverable oddities (retry, deprecated path) |
| `Error` | `error` | a request/operation failed |
| `Fatal` | `fatal` | the app is going down |

### Writing structured logs (message templates)

The killer feature: **named placeholders are captured as fields, not interpolated into a string.** Do NOT use C# string interpolation (`$"..."`) here — that destroys the structure.

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;
    public OrderService(ILogger<OrderService> logger) => _logger = logger;

    public void PlaceOrder(int userId, int orderId, decimal total)
    {
        // RIGHT — {UserId}, {OrderId}, {Total} become queryable fields.
        _logger.LogInformation(
            "User placed order {OrderId} for {Total:C}", orderId, total);

        // WRONG — interpolation flattens everything into one opaque string.
        // _logger.LogInformation($"User placed order {orderId} for {total}");
    }
}
```

### Enrichers — request id, user id, correlation id

Enrichers attach the same fields to *every* log line within a scope — so every log produced during one request automatically carries its `CorrelationId`, `UserId`, etc. This is how you trace one request across dozens of log entries (and, later, across microservices).

```csharp
// Correlation-id middleware: read or generate an id, push it into the log context.
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                        ?? Guid.NewGuid().ToString();

    // Everything logged inside this using-block gets a CorrelationId field.
    using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
    {
        context.Response.Headers["X-Correlation-Id"] = correlationId;
        await next();
    }
});
```

`UseSerilogRequestLogging()` already enriches with method, path, status, and elapsed time — that covers your "performance logging" need (slow requests show up with high `Elapsed` values you can alert on).

---

## 7.4 Caching

### Two flavours

| | `IMemoryCache` | `IDistributedCache` (+ Redis) |
|---|---|---|
| Node analogy | a `Map` / `node-cache` | a shared Redis via `ioredis` |
| Scope | **per process** | **shared across all instances** |
| Survives restart | no | yes (Redis persists) |
| When | single instance, hot config | multiple instances behind a load balancer |
| Stores | any object (no serialization) | `byte[]` / string (you serialize) |

Rule of thumb: the moment you run more than one instance of your API, in-memory caching gives inconsistent results (instance A caches, instance B doesn't). That's when you move to Redis.

### `IMemoryCache` — in-process

```csharp
builder.Services.AddMemoryCache();   // register once
```

```csharp
public class ProductService
{
    private readonly IMemoryCache _cache;
    private readonly IProductRepository _repo;

    public ProductService(IMemoryCache cache, IProductRepository repo)
    {
        _cache = cache;
        _repo = repo;
    }

    public async Task<Product?> GetAsync(int id, CancellationToken ct)
    {
        // GetOrCreateAsync = "return cached value, or run the factory and cache it".
        // Like a memoize helper around the DB call.
        return await _cache.GetOrCreateAsync($"product:{id}", async entry =>
        {
            // Expire 5 min after last write (absolute) OR 2 min of no reads (sliding).
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            entry.SlidingExpiration = TimeSpan.FromMinutes(2);
            return await _repo.GetByIdAsync(id, ct);
        });
    }
}
```

### `IDistributedCache` + Redis — shared

```bash
dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis
```

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "myapi:";   // key prefix — like a Redis namespace
});
```

The distributed cache only stores bytes, so you serialize yourself (a tiny generic helper makes this ergonomic):

```csharp
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

public class CacheService
{
    private readonly IDistributedCache _cache;
    public CacheService(IDistributedCache cache) => _cache = cache;

    public async Task<T?> GetOrSetAsync<T>(
        string key, Func<Task<T>> factory, TimeSpan ttl, CancellationToken ct)
    {
        var cached = await _cache.GetStringAsync(key, ct);
        if (cached is not null)
            return JsonSerializer.Deserialize<T>(cached);   // cache hit

        var value = await factory();                        // cache miss — load it
        await _cache.SetStringAsync(
            key,
            JsonSerializer.Serialize(value),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
            ct);
        return value;
    }
}
```

### Output caching — caching the whole response

.NET 7+ has **output caching**: cache the entire HTTP response (status + headers + body), keyed by URL/query. This is the closest thing to an Express response-cache middleware or a reverse-proxy cache, but built in.

```csharp
builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(b => b.Expire(TimeSpan.FromSeconds(30)));
});

var app = builder.Build();
app.UseOutputCache();   // pipeline middleware

// Per-endpoint: cache this response for 60s, vary by the ?category= query value.
app.MapGet("/api/products", GetProducts)
   .CacheOutput(p => p.Expire(TimeSpan.FromSeconds(60)).SetVaryByQuery("category"));
```

### Invalidation strategies

"There are only two hard things in CS..." — invalidation is the hard part. Common approaches:

- **TTL / expiration** (above) — simplest; tolerate slightly stale data. Default choice.
- **Write-through eviction** — when you update/delete an entity, remove its key:
  ```csharp
  await _repo.UpdateAsync(product, ct);
  _cache.Remove($"product:{product.Id}");          // memory cache
  await _distributedCache.RemoveAsync($"product:{product.Id}", ct);  // redis
  ```
- **Tag-based eviction** (output cache) — tag related responses, evict the group at once:
  ```csharp
  // tag a group of endpoints
  .CacheOutput(p => p.Tag("products"));
  // then, after a mutation:
  await outputCacheStore.EvictByTagAsync("products", ct);
  ```

> Cache the *result of expensive reads* (DB queries, external API calls), key by something that uniquely identifies the inputs, and pick the shortest TTL your product can tolerate. Don't cache per-user data in a shared output cache without varying by user.

---

## 7.5 Background Services

### The Node analogy — done right

In Node you'd reach for `setInterval`, a worker process, or `BullMQ`. .NET has a proper, lifecycle-managed primitive: **`IHostedService`** (and its friendly base class **`BackgroundService`**). The host starts it on app startup and signals it to stop on shutdown — no orphaned timers, graceful cancellation included.

```csharp
// A long-running loop — like a setInterval that the framework owns and can stop cleanly.
public class CleanupService : BackgroundService
{
    private readonly ILogger<CleanupService> _logger;
    public CleanupService(ILogger<CleanupService> logger) => _logger = logger;

    // ExecuteAsync runs once at startup; you loop inside it until shutdown.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // stoppingToken is cancelled on app shutdown — the loop exits gracefully.
        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Running cleanup at {Time}", DateTimeOffset.UtcNow);

            // ... do periodic work ...

            // PeriodicTimer is the modern, allocation-friendly "setInterval".
            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }
}

// Register it — the host manages its start/stop.
builder.Services.AddHostedService<CleanupService>();
```

### `IServiceScopeFactory` — using scoped services from a singleton

The gotcha: a `BackgroundService` is a **singleton** (one instance for the app's life). But your `DbContext` and repositories are **scoped** (one per HTTP request). You cannot inject scoped services into a singleton — there's no request scope. The fix: inject `IServiceScopeFactory` and create a scope manually for each unit of work.

```csharp
public class OutboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessor> _logger;

    public OutboxProcessor(IServiceScopeFactory scopeFactory, ILogger<OutboxProcessor> logger)
    {
        _scopeFactory = scopeFactory;   // singleton-safe
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // Create a fresh DI scope per tick — mirrors a per-request scope.
            using var scope = _scopeFactory.CreateScope();

            // Now it's safe to resolve scoped services like DbContext.
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            try
            {
                var pending = await db.OutboxMessages
                    .Where(m => !m.Processed)
                    .ToListAsync(stoppingToken);

                foreach (var message in pending)
                {
                    // ... publish the message, then mark processed ...
                    message.Processed = true;
                }
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // Swallow + log: an exception escaping ExecuteAsync kills the service.
                _logger.LogError(ex, "Outbox processing failed");
            }
        }
    }
}
```

### Queued background work

This is the in-process equivalent of pushing a job onto a BullMQ queue: an HTTP handler enqueues work and returns immediately (202 Accepted); a background service drains the queue. The queue is a thread-safe `Channel<T>` (think a typed, bounded async queue).

```csharp
using System.Threading.Channels;

// The queue abstraction — injected as a singleton.
public interface IBackgroundTaskQueue
{
    ValueTask EnqueueAsync(Func<CancellationToken, Task> workItem);
    ValueTask<Func<CancellationToken, Task>> DequeueAsync(CancellationToken ct);
}

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    // Bounded channel = backpressure (like BullMQ concurrency limits).
    private readonly Channel<Func<CancellationToken, Task>> _queue =
        Channel.CreateBounded<Func<CancellationToken, Task>>(100);

    public async ValueTask EnqueueAsync(Func<CancellationToken, Task> workItem)
        => await _queue.Writer.WriteAsync(workItem);

    public async ValueTask<Func<CancellationToken, Task>> DequeueAsync(CancellationToken ct)
        => await _queue.Reader.ReadAsync(ct);
}

// The consumer — drains the queue continuously.
public class QueuedHostedService : BackgroundService
{
    private readonly IBackgroundTaskQueue _queue;
    private readonly ILogger<QueuedHostedService> _logger;

    public QueuedHostedService(IBackgroundTaskQueue queue, ILogger<QueuedHostedService> logger)
    {
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var workItem = await _queue.DequeueAsync(stoppingToken);
            try { await workItem(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Queued work item failed"); }
        }
    }
}

// Registration:
// builder.Services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
// builder.Services.AddHostedService<QueuedHostedService>();

// In a controller — enqueue and return immediately:
// await _queue.EnqueueAsync(async ct => await _emailSender.SendWelcomeAsync(userId, ct));
// return Accepted();
```

### Scheduled jobs — Quartz.NET / Hangfire

`BackgroundService` + a timer covers simple recurring work. For real cron-style scheduling, persistence (jobs survive restarts), retries, and a dashboard, use a dedicated library:

| Library | Node analogy | Strengths |
|---|---|---|
| **Quartz.NET** | `node-cron` (powerful) | rich cron expressions, clustering, no DB required for basics |
| **Hangfire** | `BullMQ` + Bull Board | persistent jobs, automatic retries, built-in web dashboard |

```csharp
// Quartz example — register a job on a cron schedule.
builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("ReportJob");
    q.AddJob<ReportJob>(opts => opts.WithIdentity(jobKey));
    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithCronSchedule("0 0 2 * * ?"));   // every day at 02:00 — standard cron
});
builder.Services.AddQuartzHostedService();   // runs Quartz as a hosted service
```

---

## 7.6 Health Checks

### Why

Load balancers and orchestrators (Docker, Kubernetes) need to ask your app "are you alive?" and "are you ready for traffic?". .NET has built-in **health checks** for exactly this — a standard endpoint that returns Healthy/Degraded/Unhealthy. In Node you'd hand-roll a `GET /health` route; here it's a first-class feature with DB checks, custom checks, and tagging.

**Liveness vs readiness:**
- **Liveness** — "is the process up?" Cheap. If it fails, restart the container.
- **Readiness** — "can it serve traffic *right now*?" Includes dependencies (DB, Redis). If it fails, stop routing traffic but don't restart.

### Registration

```bash
dotnet add package AspNetCore.HealthChecks.NpgSql    # Postgres check
dotnet add package AspNetCore.HealthChecks.Redis     # Redis check
```

```csharp
builder.Services.AddHealthChecks()
    // Built-in DB check — pings Postgres. Tagged "ready" for readiness probe.
    .AddNpgSql(
        builder.Configuration.GetConnectionString("Default")!,
        name: "postgres",
        tags: new[] { "ready" })
    // Built-in Redis check.
    .AddRedis(
        builder.Configuration.GetConnectionString("Redis")!,
        name: "redis",
        tags: new[] { "ready" })
    // Your own custom check (below), also tagged "ready".
    .AddCheck<ExternalApiHealthCheck>("payment-gateway", tags: new[] { "ready" });

var app = builder.Build();

// Liveness: no dependency checks — just "the app responds".
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false   // run NO checks; 200 = process is up
});

// Readiness: run only the checks tagged "ready" (DB, Redis, gateway).
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

### A custom health check

Implement `IHealthCheck` — return Healthy / Degraded / Unhealthy. Degraded is the useful middle ground ("slow but working").

```csharp
using Microsoft.Extensions.Diagnostics.HealthChecks;

public class ExternalApiHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory;
    public ExternalApiHealthCheck(IHttpClientFactory f) => _httpClientFactory = f;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync("https://payments.example.com/ping", ct);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("Payment gateway reachable.")
                : HealthCheckResult.Degraded($"Gateway returned {(int)response.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Payment gateway unreachable.", ex);
        }
    }
}
```

> For a visual dashboard (like Bull Board for health), add the `AspNetCore.HealthChecks.UI` package — it polls your health endpoints and renders a status page. Nice-to-have, not essential.

---

## 7.7 API Versioning

### Why

Once clients depend on your API, you can't break them. Versioning lets you ship `v2` while `v1` keeps working. The standard library is **`Asp.Versioning`** (the renamed successor to `Microsoft.AspNetCore.Mvc.Versioning`).

```bash
dotnet add package Asp.Versioning.Mvc
dotnet add package Asp.Versioning.Mvc.ApiExplorer   # so Swagger sees the versions
```

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;     // no version = v1
    options.ReportApiVersions = true;                       // adds api-supported-versions header

    // Pick how clients specify the version. You can combine several readers.
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),                   // /api/v1/users
        new HeaderApiVersionReader("X-Api-Version"),        // header: X-Api-Version: 1.0
        new QueryStringApiVersionReader("api-version"));    // ?api-version=1.0
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";          // formats version groups for Swagger
    options.SubstituteApiVersionInUrl = true;    // replaces {version} in route templates
});
```

### URL versioning (most common)

```csharp
[ApiController]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/users")]   // {version:apiVersion} becomes "v1" / "v2"
public class UsersController : ControllerBase
{
    [HttpGet]
    [MapToApiVersion("1.0")]                   // this action serves /api/v1/users
    public IActionResult GetV1() => Ok("v1 response");

    [HttpGet]
    [MapToApiVersion("2.0")]                   // this action serves /api/v2/users
    public IActionResult GetV2() => Ok("v2 response");
}
```

> **URL vs header versioning:** URL (`/api/v1/...`) is the most visible and cache-friendly — easy to see in logs and browser. Header versioning keeps URLs clean but is invisible and harder to test by hand. Most teams default to URL versioning; the config above supports both at once so clients can choose.

---

## 7.8 OpenAPI / Swagger

### The Node analogy

This is `swagger-jsdoc` + Swagger UI, but you don't hand-write the spec — ASP.NET generates the OpenAPI document from your controllers, types, and attributes. Two tooling choices:

- **Swashbuckle** — the long-standing generator + the classic Swagger UI.
- **Scalar** — a modern, prettier API reference UI that renders the same OpenAPI doc. Often paired with .NET 9+'s built-in `Microsoft.AspNetCore.OpenAPI` document generator.

```bash
dotnet add package Swashbuckle.AspNetCore
# or, for the modern stack:
# dotnet add package Scalar.AspNetCore   (renders the doc from AddOpenApi)
```

### Swashbuckle setup with XML comments

XML doc comments (`/// <summary>`) on your endpoints become the descriptions in the UI — like JSDoc annotations feeding Swagger. You must enable XML output in the `.csproj` first:

```xml
<!-- In the .csproj -->
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>   <!-- don't warn on undocumented members -->
</PropertyGroup>
```

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "My API", Version = "v1" });

    // Feed the generated XML comments into the docs.
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFile));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())   // usually dev-only — don't expose in prod
{
    app.UseSwagger();        // serves /swagger/v1/swagger.json (the OpenAPI doc)
    app.UseSwaggerUI();      // serves the interactive UI at /swagger
    // Scalar alternative: app.MapScalarApiReference();  -> /scalar/v1
}
```

```csharp
/// <summary>Gets a user by id.</summary>
/// <param name="id">The user's unique identifier.</param>
/// <response code="200">User found.</response>
/// <response code="404">No user with that id.</response>
[HttpGet("{id}")]
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<IActionResult> GetById(int id) { /* ... */ }
```

`[ProducesResponseType]` tells the spec which status codes and bodies an endpoint returns — without it the UI can't document non-200 responses or the response shape.

### Authentication in Swagger UI

To use the "Authorize" button (paste a JWT and have it sent on every request — like Postman's auth tab), declare the security scheme:

```csharp
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste your JWT (without the 'Bearer ' prefix)."
    });

    // Require the scheme globally so the UI sends the token on every request.
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
```

Now an "Authorize" button appears; paste your token once and every "Try it out" call carries the `Authorization: Bearer ...` header.

---

## Gotchas for JS/TS Developers

| Gotcha | What trips you up | The fix |
|---|---|---|
| Logging with `$"..."` | Interpolating into Serilog kills structured fields | Use message templates: `LogInformation("...{UserId}", id)` |
| Scoped service in a `BackgroundService` | `DbContext` injected into a singleton throws at runtime | Inject `IServiceScopeFactory`, `CreateScope()` per work unit |
| `IMemoryCache` across instances | Works in dev (1 process), inconsistent in prod (N processes) | Switch to `IDistributedCache` + Redis when scaling out |
| Exception escaping `ExecuteAsync` | One unhandled error silently kills the whole background service | Wrap the loop body in try/catch and log |
| `app.UseExceptionHandler()` order | Placed too late, earlier middleware errors slip past it | Register it early in the pipeline |
| Validation in the controller | Re-validating in every handler is boilerplate | One MediatR `ValidationBehavior` covers all commands |
| Forgetting `AddApiExplorer()` | Versioned endpoints don't show up in Swagger | Add `.AddApiExplorer()` after `AddApiVersioning()` |
| XML comments not showing | Enabled in code but not in `.csproj` | Set `<GenerateDocumentationFile>true` |
| Distributed cache stores bytes | `IDistributedCache` has no "store an object" method | Serialize to JSON yourself (helper in 7.4) |
| Health check returns 200 always | Liveness with `Predicate => false` skips dependency checks (by design) | Use a separate readiness endpoint with tagged checks |
| Leaking stack traces | Returning `ex.Message`/`ex.ToString()` to clients | Log full error server-side, return generic `ProblemDetails` |
| `swagger-jsdoc` mindset | Expecting to hand-write the spec | The spec is generated; you annotate code with attributes/XML |

---

## Summary

| Concern | .NET tool | Node.js equivalent |
|---|---|---|
| Validation | FluentValidation (`AbstractValidator<T>`) | Zod / Joi |
| Auto-validation | MediatR `IPipelineBehavior` | Express validation middleware |
| Error handling | `IExceptionHandler` + `UseExceptionHandler` | Express error middleware |
| Error format | `ProblemDetails` / `ValidationProblemDetails` (RFC 9457) | custom `{ error }` JSON |
| Structured logging | Serilog (`ILogger<T>`, message templates) | Pino / Winston |
| Log destinations | sinks (Console / File / Seq) | transports |
| Request tracing | enrichers (correlation id) | `pino-http` child loggers |
| In-process cache | `IMemoryCache` | `Map` / `node-cache` |
| Shared cache | `IDistributedCache` + Redis | `ioredis` |
| Response cache | output caching (`CacheOutput`) | response-cache middleware |
| Recurring work | `BackgroundService` + `PeriodicTimer` | `setInterval` (managed) |
| Queued work | `Channel<T>` + hosted consumer | BullMQ |
| Scheduled jobs | Quartz.NET / Hangfire | node-cron / BullMQ |
| Health checks | `AddHealthChecks` (liveness/readiness) | hand-rolled `/health` |
| API versioning | `Asp.Versioning.Mvc` | path/header conventions |
| API docs | Swashbuckle / Scalar (generated) | swagger-jsdoc |

### Putting It Together

A production-ready ASP.NET endpoint, end to end, exercises most of this phase at once:

1. Request hits a **versioned** route (`/api/v1/...`), documented in **Swagger**.
2. The controller calls `_mediator.Send(command)`.
3. The **`ValidationBehavior`** validates it (FluentValidation); failures become a **`ValidationProblemDetails`** via your **`IExceptionHandler`**.
4. The handler checks the **cache** (`IMemoryCache`/Redis) before hitting the DB.
5. Slow or side-effecting work is **enqueued** to a `BackgroundService` so the response returns fast.
6. Every step logs **structured** lines (Serilog) carrying the request's **correlation id**.
7. A **health check** endpoint lets the load balancer confirm the app and its DB/Redis are ready.

A great exercise: take your Phase 4 Clean Architecture Products API and layer all eight of these in, one section at a time.
