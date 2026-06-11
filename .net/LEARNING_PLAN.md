# ASP.NET & C# Learning Plan

**Learner profile:** Experienced frontend dev, Node.js backend experience, TypeScript fluency  
**Goal:** REST APIs + Microservices, production-quality, Clean Architecture  
**Pace:** Intensive (10+ hrs/week) — estimated ~6–8 weeks to intermediate  
**Database:** PostgreSQL + EF Core  

---

## How This Plan Works

- Each phase has theory + hands-on exercises + a mini-project
- Notes go into `notes/XX-topic.md` as you work through them
- Bigger projects live in `projects/`
- Node.js analogies are included throughout to accelerate learning

---

## Phase 1 — C# Fundamentals
**Estimated time:** ~1 week  
**Notes file:** `notes/01-csharp-fundamentals.md`

### 1.1 C# vs JavaScript/TypeScript — Mental Model Shift
- Compiled vs interpreted; static typing (no `any` escape hatch)
- `.NET` runtime (CLR) vs Node.js runtime (V8)
- `.csproj` vs `package.json`, `dotnet` CLI vs `npm`
- Namespaces vs ES modules
- `null` safety — nullable reference types (`string?` vs `string`)

### 1.2 Types & Variables
- Value types (`int`, `double`, `bool`, `struct`) vs reference types (`class`, `string`, `object`)
- `var` keyword (type inference — like `const` but still statically typed)
- `const` vs `readonly` vs `static readonly`
- String interpolation: `$"Hello {name}"` — same as template literals
- `string` vs `String` (alias — same thing)

### 1.3 Control Flow
- `if / else`, `switch` expressions (more powerful than JS)
- Pattern matching (`is`, `switch` with patterns)
- `for`, `foreach`, `while`
- Exception handling: `try / catch / finally / throw`

### 1.4 Object-Oriented Programming in C#
- Classes, constructors, properties (`get; set;`, `init`)
- `interface` — like TypeScript interfaces but enforced at compile time
- Abstract classes vs interfaces
- Inheritance (`: BaseClass`) and `override` / `virtual` / `sealed`
- `static` classes and members
- `record` types — immutable data objects (like frozen TS types)
- Generics: `List<T>`, `Dictionary<K,V>` — like TypeScript generics

### 1.5 Collections & LINQ
- `List<T>`, `Dictionary<K,V>`, `IEnumerable<T>`, `IReadOnlyList<T>`
- LINQ — like JS array methods but more powerful:
  - `.Where()` → `.filter()`
  - `.Select()` → `.map()`
  - `.FirstOrDefault()` → `.find()`
  - `.Any()` → `.some()`
  - `.All()` → `.every()`
  - `.OrderBy()`, `.GroupBy()`, `.Distinct()`
  - Deferred execution concept

### 1.6 Async/Await in C#
- `Task<T>` vs `Promise<T>` — the direct analogy
- `async Task<T> MyMethod()` — same concept as `async function`
- `await` keyword — same as JS
- `Task.WhenAll()` → `Promise.all()`
- `CancellationToken` — cancelling long-running operations (no JS equivalent)
- Common pitfall: `.Result` and `.Wait()` causing deadlocks

### 1.7 Functional C# Features
- Lambda expressions: `x => x * 2` (same syntax as JS arrow functions)
- `Func<T, TResult>` and `Action<T>` delegates
- Extension methods — add methods to existing types
- Nullable value types: `int?` — `null` for value types
- `??` (null coalescing), `?.` (null-conditional) — same as JS

### 1.8 Key C# Gotchas for JS Developers
- Strings are immutable; use `StringBuilder` for concatenation in loops
- `==` compares value for primitives, reference for objects (use `.Equals()` or `==` for records)
- No `undefined` — only `null`
- `int` division truncates: `7 / 2 == 3`
- `IDisposable` / `using` statement for resource cleanup

**Phase 1 Mini-Project:** Console app — a simple to-do list using collections, LINQ, async file I/O

---

## Phase 2 — ASP.NET Core Basics
**Estimated time:** ~1 week  
**Notes file:** `notes/02-aspnet-basics.md`

### 2.1 .NET CLI & Project Structure
- `dotnet new webapi`, `dotnet run`, `dotnet build`, `dotnet watch`
- Solution files (`.sln`) vs project files (`.csproj`) — like a monorepo workspace
- `Program.cs` — the entry point (like `index.js` / `server.js`)
- `appsettings.json` — like `.env` but structured JSON with environment overrides

### 2.2 The ASP.NET Core Pipeline
- Middleware pipeline — like Express `app.use()` but strongly typed
- Request → Middleware chain → Endpoint → Response
- Built-in middleware: routing, auth, CORS, static files, exception handling
- `app.Use()`, `app.UseRouting()`, `app.MapControllers()`
- Order matters — same as Express

### 2.3 Dependency Injection (DI)
- Built-in DI container — no need for external libraries like InversifyJS
- `builder.Services.AddSingleton<T>()` — one instance for app lifetime
- `builder.Services.AddScoped<T>()` — one per HTTP request (most common for services)
- `builder.Services.AddTransient<T>()` — new instance every time
- Constructor injection (preferred) vs property injection
- This is central to everything in ASP.NET — master it early

### 2.4 Controllers & Routing
- `[ApiController]` + `[Route("api/[controller]")]` decorators
- Action methods: `[HttpGet]`, `[HttpPost]`, `[HttpPut]`, `[HttpDelete]`, `[HttpPatch]`
- Route parameters: `[HttpGet("{id}")]` — like Express `:id`
- `IActionResult` return types: `Ok()`, `NotFound()`, `BadRequest()`, `Created()`
- Model binding: query params, route params, request body (`[FromBody]`, `[FromQuery]`)

### 2.5 Minimal APIs (Modern .NET 6+)
- Alternative to controllers — like Express route handlers
- `app.MapGet("/users/{id}", (int id) => ...)` 
- When to use Minimal APIs vs Controllers
- Route grouping with `MapGroup()`

### 2.6 Configuration & Environment
- `IConfiguration` — read `appsettings.json` values
- Options pattern: bind config sections to typed classes (`IOptions<T>`)
- `ASPNETCORE_ENVIRONMENT`: Development / Staging / Production
- Secrets management: `dotnet user-secrets` for local dev

### 2.7 Responses & Serialization
- `System.Text.Json` (built-in) — like `JSON.stringify/parse`
- Camel case vs Pascal case configuration
- `ActionResult<T>` — strongly typed responses
- Problem Details (`ProblemDetails`) — RFC 7807 error format

**Phase 2 Mini-Project:** Simple Products REST API with in-memory storage — `GET /products`, `POST /products`, `GET /products/{id}`, `PUT`, `DELETE`

---

## Phase 3 — EF Core + PostgreSQL
**Estimated time:** ~1 week  
**Notes file:** `notes/03-efcore-postgres.md`

### 3.1 Entity Framework Core Concepts
- ORM — like Prisma or TypeORM but for .NET
- `DbContext` — the unit of work / database session
- `DbSet<T>` — represents a table
- Entities — plain C# classes that map to tables

### 3.2 Setting Up EF Core with PostgreSQL
- `Npgsql.EntityFrameworkCore.PostgreSQL` package
- Connection strings in `appsettings.json`
- Registering `DbContext` in DI: `builder.Services.AddDbContext<AppDbContext>()`
- `dotnet ef` CLI tool

### 3.3 Code-First Migrations
- `dotnet ef migrations add InitialCreate`
- `dotnet ef database update`
- Migration files explained — like SQL migration scripts but auto-generated
- Reverting migrations

### 3.4 CRUD with EF Core
- `Add()`, `Update()`, `Remove()`, `SaveChangesAsync()`
- `FindAsync()`, `FirstOrDefaultAsync()`, `ToListAsync()`
- `AsNoTracking()` — read-only queries (performance)
- The change tracker — how EF knows what changed

### 3.5 Relationships
- One-to-many: navigation properties + foreign keys
- Many-to-many: join tables with EF Core
- One-to-one
- Eager loading (`Include()`), lazy loading (avoid), explicit loading
- N+1 problem and how to avoid it

### 3.6 Querying & Performance
- LINQ queries translate to SQL — inspect generated SQL
- Filtering, ordering, pagination (`Skip()` / `Take()`)
- Projections with `Select()` — only fetch what you need
- Raw SQL when needed: `FromSqlRaw()`
- Indexes in EF Core (`HasIndex()`)

### 3.7 Repository Pattern (preview for Clean Architecture)
- Why wrap EF Core in repositories
- Generic repository: `IRepository<T>`
- Unit of Work pattern

**Phase 3 Mini-Project:** Extend Phase 2 Products API with PostgreSQL persistence, migrations, and full CRUD

---

## Phase 4 — Clean Architecture
**Estimated time:** ~1.5 weeks  
**Notes file:** `notes/04-clean-architecture.md`

### 4.1 Why Clean Architecture
- The problem it solves: testability, separation of concerns, swappable infrastructure
- Analogy: like separating business logic from Express route handlers in Node.js
- Dependency Rule — dependencies always point inward

### 4.2 The Four Layers

```
Presentation (API controllers / Minimal API)
    ↓ depends on
Application (use cases, commands, queries, DTOs)
    ↓ depends on
Domain (entities, value objects, domain events, interfaces)
    ↑ Infrastructure implements Domain interfaces
Infrastructure (EF Core, PostgreSQL, external APIs, email, etc.)
```

### 4.3 Domain Layer
- Entities with business logic (rich domain model)
- Value Objects — immutable, identity-less objects (e.g., `Money`, `Email`)
- Domain Events — things that happened in the domain
- Domain exceptions
- Interfaces for repositories (`IUserRepository`) — defined here, implemented in Infrastructure

### 4.4 Application Layer
- Use cases as commands and queries (CQRS pattern)
- **MediatR** library — in-process messaging (like an internal event bus)
- Commands: `CreateUserCommand` + `CreateUserCommandHandler`
- Queries: `GetUserByIdQuery` + `GetUserByIdQueryHandler`
- DTOs (Data Transfer Objects) — never expose domain entities directly
- `IMapper` with AutoMapper (or manual mapping)
- Validation with **FluentValidation** — pipeline behaviors

### 4.5 Infrastructure Layer
- EF Core `DbContext` and entity configurations (`IEntityTypeConfiguration<T>`)
- Repository implementations
- External service clients (HTTP clients, email, SMS)
- Database migrations live here

### 4.6 Presentation Layer
- ASP.NET controllers are thin — they only call MediatR
- No business logic in controllers
- `_mediator.Send(new CreateUserCommand(...))` pattern
- Global exception handling middleware
- API versioning

### 4.7 CQRS (Command Query Responsibility Segregation)
- Commands mutate state, Queries read state
- Why this separation leads to better code
- MediatR pipeline behaviors: logging, validation, performance monitoring

### 4.8 Cross-Cutting Concerns
- Logging with **Serilog** — structured logging
- Global exception handling
- Validation pipeline (FluentValidation + MediatR behavior)
- Audit fields (`CreatedAt`, `UpdatedAt`, `CreatedBy`)

**Phase 4 Project:** Rebuild the Products API from scratch using Clean Architecture — this is the main reference project

---

## Phase 5 — Authentication & JWT
**Estimated time:** ~1 week  
**Notes file:** `notes/05-auth-jwt.md`

### 5.1 ASP.NET Core Auth Fundamentals
- Authentication vs Authorization
- `ClaimsPrincipal`, `ClaimsIdentity`, `Claim` — the identity model
- Middleware: `UseAuthentication()` + `UseAuthorization()`
- `[Authorize]` attribute — like auth middleware in Express

### 5.2 JWT Authentication
- JWT structure — same as in frontend (header.payload.signature)
- `Microsoft.AspNetCore.Authentication.JwtBearer` package
- Configuring JWT validation parameters
- Generating JWTs: `JwtSecurityTokenHandler`
- Access tokens + refresh tokens pattern
- Storing refresh tokens securely (database)

### 5.3 ASP.NET Core Identity (optional but important)
- Built-in user management: `UserManager<T>`, `SignInManager<T>`
- `IdentityUser` entity
- Password hashing (built-in)
- When to use Identity vs roll your own

### 5.4 Authorization
- Role-based: `[Authorize(Roles = "Admin")]`
- Policy-based: custom requirements and handlers
- Resource-based authorization
- `IAuthorizationService` for programmatic checks

### 5.5 Security Best Practices
- HTTPS enforcement
- CORS configuration
- Rate limiting (`Microsoft.AspNetCore.RateLimiting`)
- Input validation
- SQL injection prevention (EF Core parameterizes by default)
- Secrets management — never commit connection strings

**Phase 5 Project:** Add auth to the Clean Architecture project — register, login, refresh token, protected endpoints

---

## Phase 6 — Testing
**Estimated time:** ~1 week  
**Notes file:** `notes/06-testing.md`

### 6.1 Testing Fundamentals in .NET
- xUnit — the standard test framework (like Jest for .NET)
- `[Fact]` — single test (like `it()`)
- `[Theory]` + `[InlineData]` — parameterized tests (like `it.each()`)
- Arrange / Act / Assert pattern
- Test project setup: `dotnet new xunit`

### 6.2 Unit Testing
- Testing domain logic in isolation — no dependencies
- **Moq** library — like Jest `jest.fn()` / `jest.mock()`
- `Mock<T>`, `.Setup()`, `.Returns()`, `.Verify()`
- Testing MediatR handlers
- Testing domain entities and value objects
- FluentAssertions — expressive assertions (like `expect().toBe()` but readable)

### 6.3 Integration Testing
- `WebApplicationFactory<T>` — spins up the full app in-memory (like Supertest)
- `HttpClient` for making requests in tests
- Testing full request/response cycles
- Overriding services for tests

### 6.4 Database Testing with TestContainers
- **Testcontainers** — spins up a real PostgreSQL Docker container for tests
- No more in-memory SQLite faking
- Database migrations in tests
- Cleanup between tests

### 6.5 Clean Architecture Testing Strategy
- Domain layer: pure unit tests (no mocks needed)
- Application layer: unit tests with mocked repositories
- Infrastructure layer: integration tests with real DB
- API layer: end-to-end tests with `WebApplicationFactory`

### 6.6 Test Best Practices
- Test naming: `MethodName_StateUnderTest_ExpectedBehavior`
- One assert per test (ideally)
- Test data builders / object mothers
- Avoiding test coupling

**Phase 6 Project:** Full test suite for the Clean Architecture project

---

## Phase 7 — Advanced ASP.NET Core
**Estimated time:** ~1 week  
**Notes file:** `notes/07-advanced-aspnet.md`

### 7.1 Validation
- FluentValidation — declarative, powerful validation
- `AbstractValidator<T>`, `.RuleFor()`, `.NotEmpty()`, `.MaximumLength()`
- MediatR pipeline behavior for automatic validation
- Custom validators

### 7.2 Global Error Handling
- `IExceptionHandler` (modern approach)
- `UseExceptionHandler()` middleware
- Problem Details (`ProblemDetails`, `ValidationProblemDetails`)
- Consistent error response format

### 7.3 Logging with Serilog
- Structured logging — log as JSON, not plain text
- Sinks: console, file, Seq, Application Insights
- Log levels: Trace, Debug, Information, Warning, Error, Fatal
- Enrichers: request ID, user ID, correlation ID
- Performance logging

### 7.4 Caching
- `IMemoryCache` — in-process cache (like a Map in Node.js)
- `IDistributedCache` + Redis — shared cache across instances
- Output caching (response-level)
- Cache invalidation strategies

### 7.5 Background Services
- `IHostedService` / `BackgroundService` — like Node.js `setInterval` but proper
- `IServiceScopeFactory` — resolving scoped services from singletons
- Queued background work
- Scheduled jobs with Quartz.NET or Hangfire

### 7.6 Health Checks
- `AddHealthChecks()` — readiness and liveness probes
- Database health check
- Custom health checks
- Health check UI

### 7.7 API Versioning
- URL versioning: `/api/v1/users`
- Header versioning
- `Asp.Versioning.Mvc` package

### 7.8 OpenAPI / Swagger
- `Swashbuckle` or `Scalar` for API documentation
- XML comments for endpoint docs
- Authentication in Swagger UI

---

## Phase 8 — Microservices
**Estimated time:** ~1.5 weeks  
**Notes file:** `notes/08-microservices.md`

### 8.1 Microservices Fundamentals
- Monolith vs microservices — trade-offs
- When microservices make sense (and when they don't)
- Service boundaries — Domain-Driven Design (DDD) bounded contexts
- Data per service — no shared databases

### 8.2 Synchronous Communication — HTTP
- `HttpClient` best practices
- `IHttpClientFactory` — avoids socket exhaustion (important!)
- Named clients and typed clients
- Polly — retry, circuit breaker, timeout policies
- REST vs gRPC

### 8.3 Synchronous Communication — gRPC
- Protocol Buffers (`.proto` files)
- `Grpc.AspNetCore` package
- Unary, server streaming, client streaming, bidirectional
- When to use gRPC vs REST

### 8.4 Asynchronous Communication — Message Brokers
- Why async messaging: decoupling, resilience
- RabbitMQ concepts: exchanges, queues, bindings, routing keys
- **MassTransit** — abstraction over RabbitMQ (like a message bus framework)
- Publishing and consuming messages
- Sagas — managing distributed transactions (choreography vs orchestration)

### 8.5 API Gateway
- Why an API gateway — single entry point, routing, auth, rate limiting
- **YARP** (Yet Another Reverse Proxy) — Microsoft's reverse proxy
- Ocelot (alternative)
- Gateway patterns: BFF (Backend for Frontend)

### 8.6 Service Discovery & Configuration
- Docker Compose service names as DNS
- Environment-based configuration for service URLs
- Consul (optional, advanced)

### 8.7 Distributed Observability
- Distributed tracing with OpenTelemetry
- Correlation IDs across services
- Centralized logging (Seq, ELK)
- Distributed health checks

### 8.8 Resilience Patterns
- Circuit breaker
- Retry with exponential backoff
- Bulkhead isolation
- Outbox pattern — ensuring messages are sent when saving to DB
- Idempotency

**Phase 8 Project:** Two microservices (e.g., Users service + Orders service) communicating via HTTP and RabbitMQ

---

## Phase 9 — Docker & Deployment
**Estimated time:** ~1 week  
**Notes file:** `notes/09-docker-deployment.md`

### 9.1 Dockerizing ASP.NET Core
- Multi-stage `Dockerfile` for ASP.NET Core — build + runtime stages
- `.dockerignore`
- Environment variables in containers
- Health check in Dockerfile

### 9.2 Docker Compose for Local Dev
- `docker-compose.yml` — run app + PostgreSQL + Redis + RabbitMQ together
- Volumes for database persistence
- Networks for service-to-service communication
- `depends_on` and health checks

### 9.3 Docker Compose for Microservices
- Composing multiple services locally
- Shared networks and service DNS
- Override files for different environments

### 9.4 CI/CD Basics
- GitHub Actions workflow for ASP.NET
- Build → Test → Docker build → Push to registry
- Environment secrets in GitHub Actions

### 9.5 Deployment Options
- VPS deployment with Docker (DigitalOcean, Hetzner)
- Railway / Render for quick deploys
- Azure Container Apps (PaaS option)
- Nginx as reverse proxy in front of ASP.NET

### 9.6 Production Considerations
- HTTPS in production (Let's Encrypt)
- Environment-based configuration
- Connection string secrets management
- Rolling deployments

**Phase 9 Project:** Dockerize the microservices project, write Docker Compose, deploy to a VPS or Railway

---

## Cross-Cutting: Best Practices Reference

These apply throughout all phases:

### SOLID in C#
- **S**ingle Responsibility — one reason to change
- **O**pen/Closed — open for extension, closed for modification
- **L**iskov Substitution — subtypes must be substitutable
- **I**nterface Segregation — small, focused interfaces
- **D**ependency Inversion — depend on abstractions (DI makes this natural in .NET)

### Code Conventions
- PascalCase for classes, methods, properties, constants
- camelCase for local variables and parameters (same as JS)
- `_camelCase` for private fields
- Async methods named with `Async` suffix: `GetUserAsync()`
- Interface names start with `I`: `IUserRepository`

### Common Packages Ecosystem
| Purpose | Package | Node.js Equivalent |
|---------|---------|-------------------|
| ORM | EF Core | Prisma / TypeORM |
| Validation | FluentValidation | Zod / Joi |
| Mapping | AutoMapper | custom mappers |
| Messaging | MediatR | EventEmitter / event bus |
| Message broker | MassTransit | BullMQ / amqplib |
| Logging | Serilog | Winston / Pino |
| Testing | xUnit + Moq | Jest |
| Auth | Microsoft.Identity + JwtBearer | jsonwebtoken + Passport |
| HTTP client resilience | Polly | axios-retry |
| API docs | Swashbuckle / Scalar | Swagger-jsdoc |

---

## Milestones

| Milestone | What you can do |
|-----------|----------------|
| After Phase 2 | Build a working REST API from scratch |
| After Phase 3 | Persist data to PostgreSQL with migrations |
| After Phase 4 | Structure professional-grade production APIs |
| After Phase 5 | Add complete auth flow to any API |
| After Phase 6 | Write tests for the full stack |
| After Phase 7 | Production-ready observability and resilience |
| After Phase 8 | Build distributed microservices systems |
| After Phase 9 | Deploy and operate containerized .NET apps |

---

## How to Use This Plan

1. Work through phases sequentially — each builds on the last
2. Don't skip the mini-projects — they cement the concepts
3. Update `notes/XX-topic.md` as you learn — include code examples, gotchas, and "aha" moments
4. Update the progress table in `CLAUDE.md` as phases complete
5. Ask questions freely — use Node.js analogies to connect new concepts to what you already know
