# Phase 2 — ASP.NET Core Basics

**Status:** In Progress  
**Started:** 2026-06-17  

> Mental model for this whole phase: ASP.NET Core is to Express what TypeScript is to JavaScript.
> Same shapes (a server, middleware, routes, handlers, JSON in/out), but everything is typed,
> the framework owns more, and there's a powerful built-in DI container you don't bolt on yourself.

---

## 2.1 .NET CLI & Project Structure

### The CLI — your `npm` equivalent

```bash
# Scaffold a new Web API project (like: npx express-generator, but first-party)
dotnet new webapi -n ProductsApi          # controller-based template
dotnet new webapi -n ProductsApi --use-minimal-apis   # minimal-API template (depends on SDK)

# Run it (like: node server.js  /  npm start)
dotnet run

# Hot reload (like: nodemon / ts-node-dev)
dotnet watch run        # or just: dotnet watch

# Compile to IL without running (like: tsc — type-checks + emits)
dotnet build

# Add a NuGet package (like: npm install <pkg>)
dotnet add package Microsoft.AspNetCore.OpenApi

# Restore packages (like: npm install with no args, from a lockfile)
dotnet restore
```

`dotnet run` implicitly does a `restore` + `build` first, so you rarely call those directly during dev.

### `.sln` vs `.csproj` ≈ a monorepo workspace

| .NET | Node.js analogy |
|---|---|
| `.csproj` (one per project) | a single `package.json` for one package |
| `.sln` (solution, references many `.csproj`) | the root `package.json` + workspaces config (pnpm/turbo/nx) |
| `dotnet sln add` | adding a package to the workspace list |

A **`.csproj`** is one buildable unit (an API, a class library, a test project). A **`.sln`** is just a container that groups multiple projects so your IDE and `dotnet build` can build them together. In Phase 4 (Clean Architecture) you'll have one `.sln` referencing 4 `.csproj` projects (Domain, Application, Infrastructure, Api) — exactly like a monorepo with 4 packages.

```bash
dotnet new sln -n ProductsSolution
dotnet sln add ProductsApi/ProductsApi.csproj   # register a project in the solution
```

A minimal `.csproj` (it's XML, not JSON — get used to it):

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>   <!-- which runtime to target -->
    <Nullable>enable</Nullable>                  <!-- the string? safety from Phase 1 -->
    <ImplicitUsings>enable</ImplicitUsings>      <!-- auto-imports common namespaces -->
  </PropertyGroup>

  <ItemGroup>
    <!-- NuGet packages — like "dependencies" in package.json -->
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.0" />
  </ItemGroup>

</Project>
```

> `ImplicitUsings` is why you won't see `using System;` at the top of files — common namespaces
> (`System`, `System.Linq`, `System.Collections.Generic`, etc.) are auto-imported globally.
> It's like having a tsconfig that auto-imports your most-used modules.

### `Program.cs` ≈ `index.js` / `server.js`

`Program.cs` is the entry point and where you wire up the whole app. Modern .NET (6+) uses the **minimal hosting model** with **top-level statements** — no `class Program { static void Main() }` boilerplate. The file just runs top to bottom, like a Node entry file.

Here is a complete, runnable `Program.cs` (controller-based). Read every comment:

```csharp
// Program.cs — the entry point. Runs top-to-bottom like index.js.

// 1) Create the builder. Think of this as `const app = express()` BEFORE you start
//    configuring — but split into two phases: configure services, then build, then configure pipeline.
var builder = WebApplication.CreateBuilder(args);

// 2) ---- SERVICE REGISTRATION (the DI container) ----
//    Everything you register here can be injected later. Roughly like setting up
//    your IoC container / wiring singletons in a Node app's composition root.
builder.Services.AddControllers();          // enable [ApiController] controllers
builder.Services.AddOpenApi();              // OpenAPI/Swagger document generation (.NET 9+)
builder.Services.AddScoped<IProductService, ProductService>(); // our own service (see DI section)

// 3) Build the app. After this line, the service container is "frozen".
var app = builder.Build();

// 4) ---- MIDDLEWARE PIPELINE ----
//    ORDER MATTERS, exactly like Express app.use(). Each app.UseXxx() is a middleware.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();   // expose the OpenAPI JSON at /openapi/v1.json in dev only
}

app.UseHttpsRedirection();   // built-in middleware: redirect http -> https

app.MapControllers();        // map [Route] attributes on controllers to endpoints

// 5) Start listening. Like app.listen(3000). Blocks here until shutdown.
app.Run();
```

Two-phase shape to internalize:
1. **Before `builder.Build()`** → register *services* (the "what can be injected" phase).
2. **After `builder.Build()`** → register *middleware/endpoints* (the "what happens per request" phase).

### `appsettings.json` ≈ a structured `.env`

Instead of flat `KEY=value` in `.env`, .NET uses hierarchical JSON. You get typed access and environment-specific overrides for free.

```jsonc
// appsettings.json — base config (committed)
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ProductsApi": {
    "MaxPageSize": 50,
    "FeatureFlags": { "EnableDiscounts": true }
  }
}
```

```jsonc
// appsettings.Development.json — overrides applied only in Development
{
  "Logging": { "LogLevel": { "Default": "Debug" } }
}
```

Override precedence (later wins): `appsettings.json` → `appsettings.{Environment}.json` → environment variables → command-line args → user-secrets (dev). This is like `.env` → `.env.development` → real env vars, but defined by the framework. Reading these values is covered in 2.6.

---

## 2.2 The ASP.NET Core Pipeline

### Middleware ≈ Express `app.use()`, but typed and ordered

A request flows through a **pipeline** of middleware, hits an **endpoint** (your controller/handler), and the response flows back out through the same middleware in reverse. Identical mental model to Express.

```
            ┌──────────── request ────────────►
Client ──►  [ExceptionHandler] ─► [HttpsRedirect] ─► [Auth] ─► [Routing] ─► ENDPOINT
            ◄─────────── response ────────────┘ (unwinds back through each one)
```

In Express you'd write:

```js
// Express
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();                       // pass to the next middleware
});
```

In ASP.NET Core the equivalent inline middleware:

```csharp
app.Use(async (context, next) =>
{
    // context.Request / context.Response — strongly typed, no `any`
    Console.WriteLine($"{context.Request.Method} {context.Request.Path}");
    await next(context);   // call next() — await it, it returns a Task
    // code here runs on the way BACK OUT (after the endpoint) — like code after next() in Express
    Console.WriteLine($"-> {context.Response.StatusCode}");
});
```

- `next` is `await`-ed (it's async). Forgetting to `await next` is the classic bug.
- `context` (an `HttpContext`) bundles `Request`, `Response`, `User`, DI scope, etc. — it's the typed `(req, res)` pair fused into one object.
- `app.Run(handler)` (the terminal overload) is a middleware that does **not** call next — it short-circuits, like an Express handler that calls `res.send()` and never `next()`.

### Built-in middleware you'll use constantly

| Middleware | What it does | Express-ish analogy |
|---|---|---|
| `app.UseExceptionHandler()` | catches unhandled exceptions, returns clean error | error-handling middleware `(err, req, res, next)` |
| `app.UseHttpsRedirection()` | http → https | a redirect middleware |
| `app.UseStaticFiles()` | serve files from `wwwroot/` | `express.static()` |
| `app.UseRouting()` | matches the request to an endpoint | the router resolution step |
| `app.UseCors()` | cross-origin headers | `cors()` package |
| `app.UseAuthentication()` | identifies *who* you are | passport / decode-jwt middleware |
| `app.UseAuthorization()` | decides *what* you may do | `[Authorize]` gate (Phase 5) |
| `app.MapControllers()` | dispatches to controller actions | mounting your routers |

### Order matters — the canonical order

This is the single most common source of "why doesn't my auth work" bugs. The framework expects roughly this order:

```csharp
var app = builder.Build();

app.UseExceptionHandler("/error");  // FIRST — must wrap everything to catch all errors
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();                   // routing must come before auth...
app.UseCors();
app.UseAuthentication();            // ...because auth needs to know the matched endpoint
app.UseAuthorization();             // authorization always AFTER authentication
app.MapControllers();               // endpoint execution — effectively LAST

app.Run();
```

Rule: **Authentication before Authorization**, and both **after** `UseRouting`. In modern .NET, `UseRouting` and the endpoint dispatch are often added implicitly, but knowing the order saves you when things break.

---

## 2.3 Dependency Injection (DI) — master this early

DI is *the* central pattern in ASP.NET Core. In Node you might reach for InversifyJS, tsyringe, or just manual wiring. In .NET the container is **built in** — `builder.Services` is the container, and the framework injects dependencies into your constructors automatically.

### The three lifetimes

You register a service by mapping an interface to an implementation, choosing a **lifetime** that controls how often a new instance is created:

```csharp
// Interface → implementation, plus a lifetime
builder.Services.AddSingleton<IClock, SystemClock>();        // ONE instance for the whole app
builder.Services.AddScoped<IProductService, ProductService>(); // ONE per HTTP request
builder.Services.AddTransient<IEmailFormatter, EmailFormatter>(); // NEW every time it's asked for
```

| Lifetime | New instance… | Node analogy | Use for |
|---|---|---|---|
| **Singleton** | once, app-wide | a module-level `const cache = new Map()` shared everywhere | stateless helpers, caches, config, `HttpClient` factories |
| **Scoped** | once per HTTP request | a per-request object you'd attach to `req.context` | services, DbContext (Phase 3), repositories — **the default choice** |
| **Transient** | every single injection | calling `new Thing()` at every use site | lightweight, stateless, cheap-to-create objects |

> Why scoped is the default for services: a single request often touches several classes that should
> share the *same* unit of work (e.g. the same DbContext / transaction). Scoped guarantees they all
> get the same instance for that request, then it's disposed when the response is sent.

**The captive dependency trap:** never inject a *scoped* (or transient) service into a *singleton*. The singleton would capture that one instance forever, defeating the lifetime. The DI container will actually throw on this for scoped-into-singleton, which is a nice safety net you don't get from manual wiring.

### Constructor injection (the way you'll do it 99% of the time)

You declare what you need as constructor parameters; the container supplies them. No `new`, no service locator, no imports of concrete classes.

```csharp
// The abstraction (define interfaces — like a TS interface, but enforced)
public interface IProductService
{
    IEnumerable<Product> GetAll();
    Product? GetById(int id);
}

// The implementation
public class ProductService : IProductService
{
    private readonly ILogger<ProductService> _logger;  // framework service, injected for free

    // Constructor injection: the container sees this ctor and fills in the args.
    public ProductService(ILogger<ProductService> logger)
    {
        _logger = logger;
    }

    public IEnumerable<Product> GetAll() { /* ... */ return []; }
    public Product? GetById(int id) { /* ... */ return null; }
}
```

A controller then just *asks* for `IProductService` in its constructor — the framework builds the controller per request and injects the registered implementation:

```csharp
public class ProductsController : ControllerBase
{
    private readonly IProductService _service;

    // No `new ProductService(...)` anywhere. The container wires it.
    public ProductsController(IProductService service) => _service = service;
}
```

This is what makes testing easy: in a unit test you `new ProductsController(new FakeProductService())` and inject a stub — same idea as passing a mock into a constructor in Node, but the production wiring is centralized in `Program.cs`.

> **Modern C# shortcut — primary constructors (C# 12+):** you can declare the dependency right on the
> class header and use it directly, skipping the field boilerplate:
> ```csharp
> public class ProductsController(IProductService service) : ControllerBase
> {
>     // `service` is in scope in every method
> }
> ```

---

## 2.4 Controllers & Routing

A controller is a class that groups related endpoints — like an Express `Router` for one resource. Action methods are the route handlers.

### Anatomy of a controller

```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]                       // opts into API conventions (see below)
[Route("api/[controller]")]          // base route. [controller] => "Products" (class name minus "Controller")
public class ProductsController : ControllerBase   // ControllerBase = API base (no View support)
{
    private readonly IProductService _service;
    public ProductsController(IProductService service) => _service = service;

    // GET /api/products
    [HttpGet]
    public IActionResult GetAll()
        => Ok(_service.GetAll());     // 200 + JSON body

    // GET /api/products/42      ({id} is a route param, like Express :id)
    [HttpGet("{id:int}")]            // :int = route constraint, only matches integers
    public IActionResult GetById(int id)
    {
        var product = _service.GetById(id);
        if (product is null)
            return NotFound();        // 404
        return Ok(product);           // 200 + product
    }

    // POST /api/products   — body bound from JSON
    [HttpPost]
    public IActionResult Create([FromBody] CreateProductRequest request)
    {
        var created = _service.Add(request);
        // 201 Created + Location header pointing at the new resource (RESTful)
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }
}
```

### What `[ApiController]` gives you for free

- **Automatic 400 on invalid models** — if validation attributes fail, you never even enter the method; it returns a `ValidationProblemDetails` (RFC 7807, see 2.7). In Express you'd wire up `express-validator` and check it manually.
- **Automatic `[FromBody]` inference** for complex types — you can usually omit `[FromBody]`.
- **Attribute routing required** — clean, explicit routes.

### Routing & route parameters ≈ Express `:id`

| ASP.NET attribute | Express equivalent |
|---|---|
| `[HttpGet("{id}")]` | `router.get("/:id")` |
| `[HttpGet("{id:int}")]` | `:id` + manual `Number.isInteger` check |
| `[HttpGet("search")]` | `router.get("/search")` |
| `[Route("api/[controller]")]` | `app.use("/api/products", router)` |

Route **constraints** (`{id:int}`, `{slug:alpha}`, `{id:guid}`) are a typed bonus Express doesn't have — non-matching requests never reach your method.

### Return types: `IActionResult` and the helper methods

`ControllerBase` gives helper methods that produce the right status code + body. These replace `res.status(200).json(...)`:

| Helper | Status | Express equivalent |
|---|---|---|
| `Ok(value)` | 200 | `res.json(value)` |
| `CreatedAtAction(...)` / `Created(...)` | 201 | `res.status(201).json(...)` + `Location` header |
| `NoContent()` | 204 | `res.status(204).end()` |
| `BadRequest(error)` | 400 | `res.status(400).json(error)` |
| `NotFound()` | 404 | `res.status(404).end()` |
| `Conflict()` | 409 | `res.status(409).end()` |
| `Problem(...)` | any | a structured error (see 2.7) |

### Model binding — where data comes from

ASP.NET inspects each parameter and binds it from the right part of the request. Sources are explicit attributes; for `[ApiController]` many are inferred:

```csharp
[HttpGet]
public IActionResult Search(
    [FromQuery] string? name,        // from ?name=...        (like req.query.name)
    [FromQuery] int page = 1)        // ?page=2, defaults to 1
{ /* ... */ return Ok(); }

[HttpPut("{id:int}")]
public IActionResult Update(
    [FromRoute] int id,              // from the URL path     (like req.params.id)
    [FromBody]  UpdateProductRequest body)  // from JSON body  (like req.body)
{ /* ... */ return NoContent(); }
```

| Attribute | Source | Express |
|---|---|---|
| `[FromRoute]` | URL path segment | `req.params` |
| `[FromQuery]` | query string | `req.query` |
| `[FromBody]` | request JSON body | `req.body` |
| `[FromHeader]` | a header | `req.headers` |
| `[FromServices]` | the DI container | resolving from your IoC container |

> DTO tip: bind to dedicated request **records**, not your domain entity. `CreateProductRequest` is your
> Zod schema's `infer` type — the validated shape coming over the wire — kept separate from the stored model.

---

## 2.5 Minimal APIs (modern .NET)

Minimal APIs let you define endpoints directly in `Program.cs` with lambdas — no controller class. This is the closest thing to plain Express route handlers.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IProductService, ProductService>();
var app = builder.Build();

// app.MapGet("/path", handler) — like app.get("/path", (req,res) => ...)
app.MapGet("/products", (IProductService svc) => svc.GetAll());   // returns JSON automatically

app.MapGet("/products/{id:int}", (int id, IProductService svc) =>
{
    var p = svc.GetById(id);
    return p is null
        ? Results.NotFound()              // Results.* == the controller helpers (Ok/NotFound/...)
        : Results.Ok(p);
});

app.MapPost("/products", (CreateProductRequest req, IProductService svc) =>
{
    var created = svc.Add(req);
    return Results.Created($"/products/{created.Id}", created);  // 201
});

app.Run();
```

Notes:
- Handler **parameters are injected by source the same way as controllers**: route params, query, body, and DI services all resolve from the lambda signature. `IProductService svc` is pulled from the container automatically.
- `Results.Xxx` is the minimal-API counterpart to the controller's `Ok()/NotFound()/Created()`.

### `MapGroup()` — grouping routes

Like `express.Router()` mounted at a prefix, with shared metadata:

```csharp
var products = app.MapGroup("/products");   // shared prefix

products.MapGet("/", (IProductService svc) => svc.GetAll());
products.MapGet("/{id:int}", (int id, IProductService svc) => /* ... */ Results.Ok());
products.MapPost("/", (CreateProductRequest req, IProductService svc) => /* ... */ Results.Created());
// You can chain .RequireAuthorization(), .WithTags(...) etc. onto the whole group.
```

### When to use which

| Use **Minimal APIs** when… | Use **Controllers** when… |
|---|---|
| small/medium service, microservice, prototype | large app with many endpoints |
| you want the least ceremony | you want attribute-based grouping & filters |
| performance-sensitive (slightly leaner) | you rely on model binding conventions, action filters |
| handler logic is thin | you want familiar MVC structure |

They're not mutually exclusive — you can mix both in one app. For this learning track we'll lean on controllers (they map cleanly onto Clean Architecture in Phase 4), but knowing minimal APIs is essential.

---

## 2.6 Configuration & Environment

### Reading config with `IConfiguration`

`IConfiguration` is the merged view of all config sources from 2.1. Inject it anywhere:

```csharp
public class ProductService(IConfiguration config)
{
    public int GetMaxPageSize()
    {
        // ":" walks the JSON hierarchy: ProductsApi -> MaxPageSize
        return config.GetValue<int>("ProductsApi:MaxPageSize");
    }
}
```

It works, but raw key strings are stringly-typed and unsafe — like reaching into `process.env.FOO` everywhere. The Options pattern fixes that.

### Options pattern — typed config (`IOptions<T>`)

Bind a config **section** to a strongly-typed class, then inject the typed object. This is like parsing `process.env` once into a validated, typed config module.

```csharp
// 1) A POCO matching the JSON section shape
public class ProductsApiOptions
{
    public const string SectionName = "ProductsApi";   // matches the JSON key
    public int MaxPageSize { get; set; }
    public FeatureFlags FeatureFlags { get; set; } = new();
}
public class FeatureFlags { public bool EnableDiscounts { get; set; } }

// 2) Bind it in Program.cs (before Build)
builder.Services.Configure<ProductsApiOptions>(
    builder.Configuration.GetSection(ProductsApiOptions.SectionName));

// 3) Inject IOptions<T> and read .Value
public class ProductService(IOptions<ProductsApiOptions> options)
{
    private readonly ProductsApiOptions _opts = options.Value;
    public int CapPageSize(int requested) => Math.Min(requested, _opts.MaxPageSize);
}
```

Variants: `IOptions<T>` (singleton, read once), `IOptionsSnapshot<T>` (re-read per request — picks up file changes), `IOptionsMonitor<T>` (live updates + change callbacks).

### `ASPNETCORE_ENVIRONMENT`

The environment name drives which `appsettings.{Environment}.json` loads and the `app.Environment.IsDevelopment()` checks. Standard values: `Development`, `Staging`, `Production` (defaults to `Production` if unset). It's the `NODE_ENV` of .NET.

```bash
# Linux/macOS — set for one run
ASPNETCORE_ENVIRONMENT=Development dotnet run
```

`launchSettings.json` (under `Properties/`, dev-only, not deployed) sets this automatically when you `dotnet run` — it's like your local run scripts in `package.json`.

### Secrets: `dotnet user-secrets` (local dev)

Never commit connection strings / API keys. In dev, user-secrets stores them **outside** the repo (in your user profile), but they merge into `IConfiguration` exactly like `appsettings.json` — so your code reads them identically. Think of it as a `.env.local` that physically lives outside the project and is git-ignored by construction.

```bash
dotnet user-secrets init        # adds a UserSecretsId to the .csproj
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Database=products"
dotnet user-secrets list
```

In production you use real environment variables or a secrets vault instead — same `IConfiguration` lookups, different source.

---

## 2.7 Responses & Serialization

### `System.Text.Json` ≈ `JSON.stringify` / `JSON.parse`

ASP.NET serializes return values to JSON automatically with the built-in `System.Text.Json` (STJ). You rarely call it by hand, but it's the engine. Direct use:

```csharp
using System.Text.Json;

var json = JsonSerializer.Serialize(product);          // ≈ JSON.stringify(product)
var obj  = JsonSerializer.Deserialize<Product>(json);  // ≈ JSON.parse, but typed to Product
```

### camelCase vs PascalCase

C# properties are `PascalCase` (`ProductName`), but JSON APIs conventionally use `camelCase` (`productName`). **Good news:** ASP.NET's default for web APIs already serializes to camelCase — `Name` → `"name"`. If you ever need to customize:

```csharp
builder.Services.ConfigureHttpJsonOptions(o =>      // for minimal APIs
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.PropertyNameCaseInsensitive = true; // tolerant deserialization
});

builder.Services.AddControllers()                    // for controllers
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
```

> Deserialization is case-insensitive-friendly but property *names* must match (modulo casing). Unknown
> JSON fields are ignored by default (no error), similar to a loose Zod `.passthrough()`.

### `ActionResult<T>` — typed responses

`IActionResult` says "some HTTP result". `ActionResult<T>` says "either an HTTP result *or* a `T`" — giving you the status-code flexibility **and** the concrete type for OpenAPI/Swagger and the compiler.

```csharp
// IActionResult: status flexible, but return type is opaque
[HttpGet("{id:int}")]
public IActionResult GetByIdLoose(int id) { /* ... */ return Ok(new Product()); }

// ActionResult<T>: status flexible AND the success type is documented as Product
[HttpGet("{id:int}")]
public ActionResult<Product> GetById(int id)
{
    var p = _service.GetById(id);
    if (p is null) return NotFound();   // an ActionResult
    return p;                            // implicitly wrapped as 200 Ok(p) — note: just `return p;`
}
```

Prefer `ActionResult<T>` — better tooling, self-documenting, and you can still return `NotFound()`/`BadRequest()`.

### Problem Details (RFC 7807) — standard error format

RFC 7807 defines a standard JSON error shape so all your errors look the same. ASP.NET produces these automatically (e.g. the 400 from `[ApiController]` validation), and you can produce them explicitly:

```jsonc
// A ProblemDetails response body
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  "title": "Not Found",
  "status": 404,
  "detail": "Product 42 does not exist.",
  "instance": "/api/products/42"
}
```

```csharp
// Produce one explicitly from a controller:
return Problem(
    title: "Not Found",
    detail: $"Product {id} does not exist.",
    statusCode: StatusCodes.Status404NotFound);

// Opt in globally so even unhandled exceptions become ProblemDetails (do this in Program.cs):
builder.Services.AddProblemDetails();
```

This replaces inventing your own `{ "error": "..." }` shape per project. Validation failures use the richer `ValidationProblemDetails` (adds an `errors` map of field → messages). We'll lean on this heavily in Phase 7's global error handling.

---

## Gotchas for JS/TS Developers

| Gotcha | What trips you up | The fix / reality |
|---|---|---|
| Two-phase startup | mixing service registration with middleware | register services **before** `builder.Build()`, middleware **after** |
| Middleware order | auth "doesn't work" | `UseRouting` → `UseAuthentication` → `UseAuthorization` → `MapControllers`, in that order |
| Forgetting `await next` | request hangs / response missing | always `await next(context)` in custom middleware |
| Captive dependency | injecting Scoped into Singleton | container throws; make the consumer Scoped, or restructure |
| Default lifetime | reaching for Singleton everywhere | **Scoped** is the default for services/repos/DbContext |
| `[ApiController]` magic | "why is my 400 happening before my code?" | automatic model validation returns 400 before the action runs |
| `string` vs `string?` in DTOs | non-nullable props warn / arrive empty | model required fields as non-nullable + validation; optional as `?` |
| camelCase | expecting `ProductName` in JSON | web API default is camelCase (`productName`) — your frontend is happy |
| `IActionResult` vs `ActionResult<T>` | losing the response type | prefer `ActionResult<T>` for docs + compiler help |
| Config keys | flat env-var habits | hierarchical keys use `:` (`"ProductsApi:MaxPageSize"`); bind with Options instead |
| Secrets in `appsettings.json` | committing connection strings | `dotnet user-secrets` in dev, env vars/vault in prod |
| `CreatedAtAction` name typo | 500 on POST | the `nameof(GetById)` must reference a real action with a route |

---

## Phase 2 Mini-Project — In-Memory Products REST API

**Goal:** Build a full CRUD REST API with controllers, DI, model binding, and proper status codes — no database yet (that's Phase 3). Everything lives in an in-memory list behind a service.

**Endpoints to implement:**

| Verb | Route | Returns |
|---|---|---|
| GET | `/api/products` | 200 + all products |
| GET | `/api/products/{id}` | 200 + product, or 404 |
| POST | `/api/products` | 201 + created product + `Location` header |
| PUT | `/api/products/{id}` | 204, or 404 |
| DELETE | `/api/products/{id}` | 204, or 404 |

### Step 1 — Scaffold

```bash
cd examples
dotnet new webapi -n phase2-products-api
cd phase2-products-api
dotnet watch run
```

### Step 2 — Model + DTOs

Use a `record` for DTOs (immutable, value equality — Phase 1) and a small class for the stored entity.

```csharp
// Models/Product.cs
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }   // decimal for money — Phase 1 gotcha
}

// DTOs — the wire shapes (no Id on create; the server assigns it)
public record CreateProductRequest(string Name, decimal Price);
public record UpdateProductRequest(string Name, decimal Price);
```

### Step 3 — Service behind an interface (so DI + tests are easy)

**Hints:**
- Store items in a `List<Product>` and an `int _nextId`.
- Register it as a **Singleton** here *only because* the in-memory list must survive across requests (a real DB-backed repo would be Scoped — note this distinction).

```csharp
// Services/IProductService.cs
public interface IProductService
{
    IEnumerable<Product> GetAll();
    Product? GetById(int id);
    Product Add(CreateProductRequest request);
    bool Update(int id, UpdateProductRequest request);
    bool Delete(int id);
}

// Services/ProductService.cs
public class ProductService : IProductService
{
    private readonly List<Product> _products = new();
    private int _nextId = 1;

    public IEnumerable<Product> GetAll() => _products;

    public Product? GetById(int id) =>
        _products.FirstOrDefault(p => p.Id == id);   // LINQ .find()

    public Product Add(CreateProductRequest request)
    {
        var product = new Product { Id = _nextId++, Name = request.Name, Price = request.Price };
        _products.Add(product);
        return product;
    }

    public bool Update(int id, UpdateProductRequest request)
    {
        var product = GetById(id);
        if (product is null) return false;
        product.Name = request.Name;
        product.Price = request.Price;
        return true;
    }

    public bool Delete(int id)
    {
        var product = GetById(id);
        if (product is null) return false;
        _products.Remove(product);
        return true;
    }
}
```

### Step 4 — Register the service in `Program.cs`

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IProductService, ProductService>(); // singleton: keep the list alive

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();
app.MapControllers();
app.Run();
```

### Step 5 — The controller

```csharp
// Controllers/ProductsController.cs
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _service;
    public ProductsController(IProductService service) => _service = service;

    // GET /api/products
    [HttpGet]
    public ActionResult<IEnumerable<Product>> GetAll() => Ok(_service.GetAll());

    // GET /api/products/{id}
    [HttpGet("{id:int}")]
    public ActionResult<Product> GetById(int id)
    {
        var product = _service.GetById(id);
        return product is null ? NotFound() : Ok(product);
    }

    // POST /api/products
    [HttpPost]
    public ActionResult<Product> Create(CreateProductRequest request)
    {
        var created = _service.Add(request);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created); // 201 + Location
    }

    // PUT /api/products/{id}
    [HttpPut("{id:int}")]
    public IActionResult Update(int id, UpdateProductRequest request)
        => _service.Update(id, request) ? NoContent() : NotFound();   // 204 or 404

    // DELETE /api/products/{id}
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
        => _service.Delete(id) ? NoContent() : NotFound();            // 204 or 404
}
```

### Step 6 — Test it

Use the generated `.http` file, `curl`, or Swagger UI:

```bash
# Create
curl -k -X POST https://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{ "name": "Keyboard", "price": 49.99 }'

# Get all
curl -k https://localhost:5001/api/products

# Get one
curl -k https://localhost:5001/api/products/1

# Update
curl -k -X PUT https://localhost:5001/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{ "name": "Mechanical Keyboard", "price": 89.99 }'

# Delete
curl -k -X DELETE https://localhost:5001/api/products/1
```

### Stretch goals

- Add `[FromQuery] string? name` to `GetAll` and filter with LINQ `.Where()`.
- Add validation attributes (`[Required]`, `[Range(0, 10000)]`) to the DTOs and watch `[ApiController]` auto-return a 400 `ValidationProblemDetails`.
- Add `builder.Services.AddProblemDetails()` and return `Problem(...)` for the 404s.
- Rebuild the same API as **Minimal APIs** in a second file to feel the difference.

---

## Summary

| Concept | ASP.NET Core | Node.js / Express Equivalent |
|---|---|---|
| Entry point | `Program.cs` | `index.js` / `server.js` |
| Project/workspace files | `.csproj` / `.sln` | `package.json` / workspaces |
| Config | `appsettings.json` + `IConfiguration` | `.env` + `process.env` |
| Typed config | Options pattern `IOptions<T>` | parsed/validated config module |
| Local secrets | `dotnet user-secrets` | `.env.local` (git-ignored) |
| Middleware | `app.Use(...)` (typed `HttpContext`) | `app.use((req,res,next) => ...)` |
| Routing | `[Route]` / `MapGet` | `router.get(...)` |
| Route params | `[HttpGet("{id:int}")]` | `:id` |
| DI container | built-in `builder.Services` | InversifyJS / manual wiring |
| Service lifetimes | Singleton / Scoped / Transient | shared / per-request / per-use |
| Controller | `ControllerBase` + `[ApiController]` | `express.Router()` |
| Responses | `Ok()` / `NotFound()` / `ActionResult<T>` | `res.status().json()` |
| Serialization | `System.Text.Json` (camelCase) | `JSON.stringify` / `parse` |
| Errors | `ProblemDetails` (RFC 7807) | custom `{ error }` shape |
| Lightweight routes | Minimal APIs (`MapGet`, `MapGroup`) | bare Express handlers |
