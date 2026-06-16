# JavaScript & Node.js Learning Plan

**Learner profile:** Experienced frontend dev, TypeScript fluency, Node.js backend experience  
**Goal:** Production-grade backend + Microservices, enterprise-level patterns  
**Pace:** Intensive (10+ hrs/week) — estimated ~6–8 weeks to advanced  
**Database:** PostgreSQL + Prisma / DrizzleORM  

---

## How This Plan Works

- Each phase has theory + hands-on exercises + a mini-project
- Notes go into `notes/XX-topic.md` as you work through them
- Bigger projects live in `examples/`
- .NET/C# comparisons are included throughout to reinforce cross-stack understanding

---

## Phase 1 — JavaScript Internals & Runtime
**Estimated time:** ~1 week  
**Notes file:** `notes/01-js-internals.md`

### 1.1 The V8 Engine
- How V8 compiles JS: parsing → AST → bytecode (Ignition) → optimized machine code (TurboFan)
- JIT compilation — why JS is fast despite being interpreted
- Hidden classes — how V8 optimises object property access
- Inline caches — how V8 speeds up repeated property lookups
- Deoptimisation — what breaks V8's optimisations (type changes, `delete`, `arguments`)

### 1.2 The Event Loop — Deep Mechanics
- Call stack, heap, task queue, microtask queue
- Phases: timers → I/O callbacks → idle → poll → check (setImmediate) → close callbacks
- `setTimeout(fn, 0)` vs `setImmediate()` vs `queueMicrotask()` vs `Promise.resolve()`
- Why microtasks (Promise callbacks) run before the next task
- `process.nextTick()` — runs before microtasks (Node.js specific)
- Starving the event loop — how heavy synchronous work blocks I/O

### 1.3 Closures & Scope In Depth
- Lexical environment and the scope chain
- Closure memory implications — when closures prevent garbage collection
- The module pattern vs ES modules scope
- `var` hoisting vs `let`/`const` temporal dead zone
- Closures in loops — the classic `setTimeout` in `for` trap

### 1.4 Prototypes & Inheritance
- Prototype chain — how property lookup works
- `__proto__` vs `Object.getPrototypeOf()` vs `prototype`
- `class` syntax is syntactic sugar over prototypes — what it compiles to
- `Object.create()`, `Object.assign()`, structural vs prototype inheritance
- Why `instanceof` can lie across realms (iframes, vm contexts)

### 1.5 Memory Management & Garbage Collection
- V8's generational GC: young (Scavenger) vs old (Mark-Sweep, Mark-Compact) generation
- Stack vs heap allocation
- Common memory leaks: closures over large objects, global variables, event listener accumulation, timers
- `WeakMap` / `WeakRef` / `FinalizationRegistry` — memory-conscious data structures
- Using Chrome DevTools / `--inspect` to profile heap snapshots

### 1.6 `this` — The Full Story
- How `this` is determined: default, implicit, explicit (`call/apply/bind`), `new`
- Arrow functions and `this` — lexical binding
- Class methods and lost `this` — why you need `.bind(this)` or arrow methods
- `this` in strict mode

### 1.7 Symbols, Iterators & Generators
- `Symbol` — unique keys, well-known symbols (`Symbol.iterator`, `Symbol.toPrimitive`)
- Iterables and the iterator protocol
- Generator functions (`function*`, `yield`) — lazy sequences
- Async generators and `for await...of`

**Phase 1 Mini-Project:** Build a custom async task scheduler using the event loop, generators, and closures — no `async/await` allowed

---

## Phase 2 — Advanced TypeScript
**Estimated time:** ~1 week  
**Notes file:** `notes/02-advanced-typescript.md`

### 2.1 The Type System — Beyond the Basics
- Structural typing vs nominal typing (how TypeScript differs from C#)
- Type vs interface — when each applies
- Union types, intersection types, discriminated unions
- Literal types and const assertion (`as const`)

### 2.2 Generics In Depth
- Generic constraints (`extends`)
- Default type parameters
- Conditional types (`T extends U ? X : Y`)
- Infer — extracting types from generics (`infer R`)
- Distributive conditional types

### 2.3 Mapped & Template Literal Types
- Mapped types: `{ [K in keyof T]: T[K] }`
- Built-in utility types and how they work: `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `ReturnType`, `Parameters`, `InstanceType`
- Template literal types: `type EventName = \`on${Capitalize<string>}\``
- Combining mapped + template literal types for powerful APIs

### 2.4 Declaration Merging & Module Augmentation
- Interface merging
- Augmenting third-party module types
- Global augmentation (`declare global`)
- Ambient declarations (`.d.ts` files)

### 2.5 The `satisfies` Operator & `const` Generics (TS 5+)
- `satisfies` — validate shape without losing literal type
- `const` type parameter — preserve literal types in generic functions
- `using` / `await using` — explicit resource management (TS 5.2)

### 2.6 Decorators (TS 5 / Stage 3)
- Class decorators, method decorators, property decorators, accessor decorators
- Decorator metadata (used by NestJS, TypeORM, etc.)
- Difference between legacy decorators (emitDecoratorMetadata) and Stage 3
- How NestJS uses decorators under the hood

### 2.7 Type-Safe Patterns
- Builder pattern with TypeScript
- Phantom types — encoding state in the type system
- Branded types / Opaque types — `UserId` vs `OrderId` both being `string`
- `zod` — runtime + compile-time validation (your Joi/FluentValidation for TS)
- Typing Express/NestJS request/response objects safely

### 2.8 tsconfig Deep Dive
- `strict` mode and what each flag does
- Module resolution: `node`, `bundler`, `node16`
- `paths` mapping — like tsconfig-paths
- `composite` + `references` — monorepo project references
- `verbatimModuleSyntax` — why `import type` matters for bundlers

**Phase 2 Mini-Project:** Build a type-safe event emitter with full TypeScript inference — event names and their payload types enforced at compile time

---

## Phase 3 — Node.js Production Patterns
**Estimated time:** ~1 week  
**Notes file:** `notes/03-nodejs-production.md`

### 3.1 Node.js Architecture for Production
- `libuv` — the async I/O layer under Node.js
- Thread pool (UV_THREADPOOL_SIZE) — what runs off the event loop (file I/O, DNS, crypto)
- Worker threads (`worker_threads`) — CPU-bound work without blocking
- `cluster` module — multi-process on multi-core vs worker threads
- When to use PM2 vs native cluster

### 3.2 Streams
- Readable, Writable, Duplex, Transform streams
- Backpressure — why `pipe()` matters
- Streaming large files without blowing memory
- `stream/promises` API
- Streams in HTTP: request body parsing, file upload, response streaming

### 3.3 Error Handling — Production-Grade
- Error vs OperationalError — distinguishing expected vs unexpected failures
- Centralised error handler pattern
- Unhandled promise rejections — `process.on('unhandledRejection')`
- `AsyncLocalStorage` — request-scoped context (correlation IDs without passing params)
- Error serialisation and structured logging

### 3.4 Configuration Management
- `dotenv` / `dotenv-flow` — environment-based config
- Typed config with `zod` at startup — fail fast on missing env vars
- 12-Factor App config principles
- Secrets management — never commit `.env`; use Vault, AWS Secrets Manager, etc.

### 3.5 Performance & Profiling
- `--prof` flag and V8 profiling output
- `clinic.js` (Doctor, Bubbleprof, Flame) — production profiling
- `0x` — flamegraph generator
- Identifying event loop lag with `perf_hooks`
- `process.hrtime.bigint()` for precision timing

### 3.6 HTTP Internals
- `http.IncomingMessage` and `http.ServerResponse` — what frameworks wrap
- Keep-alive connections and connection reuse
- HTTP/2 with Node.js
- HTTPS — TLS termination in Node vs upstream proxy

### 3.7 Fastify vs Express — Production Comparison
- Why Fastify is faster: schema-based serialization, Ajv, no middleware overhead
- Plugin architecture (Fastify) vs middleware (Express)
- Type-safe route schemas in Fastify
- When to still use Express (ecosystem compatibility)

**Phase 3 Mini-Project:** Fastify server with worker threads for CPU-bound tasks, streaming file upload endpoint, full structured logging and error handling

---

## Phase 4 — PostgreSQL with Prisma & DrizzleORM
**Estimated time:** ~1 week  
**Notes file:** `notes/04-postgres-orm.md`

### 4.1 Prisma — The Modern ORM
- Schema-first approach (`schema.prisma`) vs code-first (EF Core analogy)
- `prisma migrate dev`, `prisma migrate deploy` — like `dotnet ef migrations`
- `PrismaClient` — the typed query client (like `DbContext`)
- Type inference from schema — no manual DTOs needed
- Prisma vs EF Core: key differences

### 4.2 Prisma CRUD & Relations
- `findUnique`, `findFirst`, `findMany`, `create`, `update`, `upsert`, `delete`
- Nested writes — create with relations in one query
- `include` (eager loading) vs `select` (projection) — EF Core analogy
- N+1 problem with `include` and how to avoid it
- `$transaction` — atomic operations (like `SaveChangesAsync()` scoping)

### 4.3 Prisma Advanced
- Raw SQL: `$queryRaw`, `$executeRaw`
- Middleware and lifecycle hooks
- Soft deletes with middleware
- Prisma Client extensions (TS 5 based)
- Connection pooling with PgBouncer / Prisma Accelerate

### 4.4 DrizzleORM — The SQL-First Alternative
- Why Drizzle: closer to SQL, better performance, smaller bundle
- Schema definition in TypeScript (`pgTable`, `text`, `integer`, etc.)
- `drizzle-kit` for migrations
- Query builder API vs ORM API
- When to prefer Drizzle over Prisma

### 4.5 PostgreSQL Features Worth Using
- JSONB — querying and indexing JSON columns
- Full-text search with `tsvector` / `tsquery`
- CTEs (Common Table Expressions) — readable complex queries
- Window functions — running totals, rankings
- Partial indexes, composite indexes
- `EXPLAIN ANALYZE` — reading query plans

### 4.6 Repository Pattern in TypeScript
- Generic repository with Prisma: `IRepository<T>`
- Unit of Work — wrapping `$transaction`
- Why (and when) to wrap Prisma vs use it directly

**Phase 4 Mini-Project:** Products + Orders API with Prisma, migrations, full CRUD, N+1-free queries, and raw SQL for a reporting endpoint

---

## Phase 5 — Clean Architecture with NestJS
**Estimated time:** ~1.5 weeks  
**Notes file:** `notes/05-clean-architecture-nest.md`

### 5.1 Why Clean Architecture in Node.js
- The problem: fat Express controllers with business logic
- Same dependency rule as .NET: dependencies always point inward
- NestJS makes Clean Architecture more natural — DI is built in

### 5.2 NestJS Core Concepts
- Modules, Controllers, Services, Providers
- Dependency Injection — `@Injectable()`, `@Module()` providers array
- Comparing to ASP.NET: `[ApiController]` = NestJS Controller, `builder.Services.AddScoped<T>()` = NestJS providers
- Pipes, Guards, Interceptors, Filters — the NestJS request lifecycle

### 5.3 The Four Layers in NestJS

```
Presentation (NestJS Controllers / resolvers)
    ↓ depends on
Application (use cases / commands / queries / DTOs)
    ↓ depends on
Domain (entities, value objects, domain events, repository interfaces)
    ↑ Infrastructure implements Domain interfaces
Infrastructure (Prisma/Drizzle, external APIs, Redis, email, etc.)
```

### 5.4 Domain Layer
- Domain entities with business logic (rich domain model, not anemic)
- Value Objects — immutable, identity-less: `Money`, `Email`, `UserId`
- Domain Events — `UserRegisteredEvent`, dispatched after state change
- Repository interfaces defined in Domain — implemented in Infrastructure
- Domain exceptions

### 5.5 Application Layer — CQRS with NestJS CQRS Module
- `@nestjs/cqrs` — command bus, query bus, event bus
- Commands: `CreateUserCommand` + `CreateUserHandler`
- Queries: `GetUserByIdQuery` + `GetUserByIdHandler`
- DTOs — never expose domain entities at the API boundary
- Validation with `class-validator` + `class-transformer` (Pipes)
- `zod` as alternative validation at application boundary

### 5.6 Infrastructure Layer
- `PrismaModule` — wraps PrismaClient as a NestJS provider
- Repository implementations
- External HTTP clients with `HttpModule` (`@nestjs/axios`)
- Redis integration for caching / sessions

### 5.7 Presentation Layer
- Controllers are thin — they only call the command/query bus
- `ValidationPipe` for automatic DTO validation
- Global exception filter — maps domain errors to HTTP responses
- API versioning (`@nestjs/versioning`)

### 5.8 Cross-Cutting Concerns
- Logging with `Pino` + `nestjs-pino` — structured JSON logs
- `AsyncLocalStorage` for request-scoped correlation IDs
- Global `ExceptionFilter` — consistent error format (RFC 7807 Problem Details)
- Audit fields via Prisma middleware

**Phase 5 Project:** Rebuild the Phase 4 API from scratch using Clean Architecture — NestJS, CQRS, Prisma, domain entities, application layer, thin controllers

---

## Phase 6 — Authentication & Security
**Estimated time:** ~1 week  
**Notes file:** `notes/06-auth-security.md`

### 6.1 Authentication Fundamentals in NestJS
- `@nestjs/passport` + `passport-jwt`
- Guards — `@UseGuards(JwtAuthGuard)` — like `[Authorize]` in ASP.NET
- `AuthGuard('jwt')` and how Passport strategies work
- `ExecutionContext` — accessing request in guards

### 6.2 JWT Authentication
- JWT structure — same as in .NET (header.payload.signature)
- `@nestjs/jwt` — `JwtService.sign()`, `JwtService.verify()`
- Access token + refresh token pattern
- Refresh token rotation — storing in DB, invalidating old tokens
- JWT secret rotation strategy

### 6.3 Passport Strategies
- `LocalStrategy` — username + password login
- `JwtStrategy` — token validation on protected routes
- Custom strategies — API keys, OAuth

### 6.4 Authorization
- Role-based: custom `@Roles()` decorator + `RolesGuard`
- Permissions-based RBAC
- Resource-based authorization — does this user own this resource?
- CASL — attribute-based access control library for Node.js

### 6.5 Security Best Practices
- `helmet` — sets security HTTP headers
- `express-rate-limit` / `@nestjs/throttler` — rate limiting
- CORS configuration — exact origin, not `*` in production
- Input sanitisation — `class-validator` whitelisting (`whitelist: true`)
- SQL injection prevention — Prisma parameterises by default
- `bcrypt` vs `argon2` for password hashing — why argon2 is better
- HTTPS — TLS termination upstream (Nginx/load balancer)
- Secrets in environment — never hardcode

**Phase 6 Project:** Add auth to the Clean Architecture project — register, login, refresh token, role-based protected endpoints

---

## Phase 7 — Testing
**Estimated time:** ~1 week  
**Notes file:** `notes/07-testing.md`

### 7.1 Jest Fundamentals (Refresher + Advanced)
- `describe`, `it`/`test`, `expect` — same as always
- `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
- `jest.fn()`, `jest.spyOn()`, `jest.mock()` — like Moq in .NET
- Module mocking — `jest.mock('./path/to/module')`
- `jest.useFakeTimers()` — control `setTimeout`, `Date.now()`
- TypeScript with Jest: `ts-jest` or `@swc/jest` (faster)

### 7.2 Unit Testing
- Testing domain logic in isolation — no DB, no HTTP
- Testing NestJS services with `Test.createTestingModule()`
- Mock providers in NestJS DI: `{ provide: UserRepository, useValue: mockRepo }`
- Testing CQRS command/query handlers
- Testing domain entities and value objects

### 7.3 Integration Testing
- `@nestjs/testing` `Test.createTestingModule()` — spins up NestJS in-process
- `supertest` — HTTP assertions (like `WebApplicationFactory` + `HttpClient` in .NET)
- Testing full request → controller → service → repository cycles
- Overriding providers for integration tests

### 7.4 Database Testing with Testcontainers
- `testcontainers` npm package — same concept as .NET Testcontainers
- Spin up a real PostgreSQL container per test suite
- Run Prisma migrations against the test DB
- Cleanup: `afterEach` truncate tables or per-test transactions

### 7.5 Clean Architecture Testing Strategy
- Domain layer: pure unit tests — no mocks needed (no deps)
- Application layer: unit tests with mocked repository interfaces
- Infrastructure layer: integration tests with real DB (Testcontainers)
- API layer: E2E tests with `supertest` + real NestJS app

### 7.6 Test Best Practices
- Test naming: `methodName / state under test / expected behaviour`
- One logical assertion per test
- Test builders / object mothers for test data
- `faker` — generating realistic test data
- Avoiding test coupling and shared mutable state

**Phase 7 Project:** Full test suite for the Clean Architecture project — unit, integration, E2E with Testcontainers

---

## Phase 8 — Microservices
**Estimated time:** ~1.5 weeks  
**Notes file:** `notes/08-microservices.md`

### 8.1 Microservices Fundamentals
- Monolith vs microservices — same trade-offs as .NET track
- Service boundaries — DDD bounded contexts
- Data per service — no shared databases
- Polyglot persistence — each service picks its own DB

### 8.2 NestJS Microservices Transport Layer
- `@nestjs/microservices` — built-in transports: TCP, Redis, RabbitMQ, Kafka, NATS
- Message patterns (`@MessagePattern`) vs events (`@EventPattern`)
- Hybrid apps — one process serving HTTP + microservice transport
- Client proxy — calling a microservice from another service

### 8.3 Synchronous Communication — HTTP
- `@nestjs/axios` / `axios` — HTTP clients
- `got` — lighter alternative with retry built in
- Circuit breaker with `opossum`
- Retry with exponential backoff
- Service discovery — DNS-based in Docker Compose

### 8.4 Asynchronous Communication — RabbitMQ
- RabbitMQ concepts: exchanges, queues, bindings, routing keys
- `@nestjs/microservices` RabbitMQ transport
- Publishing and consuming events
- Dead letter queues — handling failed messages
- Sagas — choreography vs orchestration

### 8.5 Asynchronous Communication — BullMQ
- `bullmq` — Redis-backed job queue (like Hangfire in .NET)
- `@nestjs/bullmq` integration
- Job retries, delays, priority queues, rate limiting
- Recurring jobs (cron-like) — use cases vs Cron in NestJS
- Job lifecycle events and monitoring with Bull Board

### 8.6 API Gateway
- NGINX as a reverse proxy / API gateway
- `http-proxy-middleware` for a lightweight Node.js gateway
- Rate limiting at the gateway level
- BFF (Backend for Frontend) pattern

### 8.7 Distributed Observability
- OpenTelemetry for Node.js — tracing, metrics, logs
- `@opentelemetry/sdk-node` setup
- Correlation IDs across services via `AsyncLocalStorage`
- Centralised logging: structured JSON → ELK / Loki + Grafana
- Distributed health checks

### 8.8 Resilience Patterns
- Circuit breaker with `opossum`
- Retry + exponential backoff + jitter
- Idempotency keys — safe retries for state-changing operations
- Outbox pattern — reliable event publishing with Prisma

**Phase 8 Project:** Two microservices (Users + Orders) communicating via HTTP and RabbitMQ, deployed with Docker Compose

---

## Phase 9 — Docker & Deployment
**Estimated time:** ~1 week  
**Notes file:** `notes/09-docker-deployment.md`

### 9.1 Dockerizing Node.js Apps
- Multi-stage `Dockerfile`: build stage (full Node) + runtime stage (slim/distroless)
- `.dockerignore` — exclude `node_modules`, `.env`, dist artifacts
- Non-root user in container — security hardening
- `COPY --chown` and file permissions
- Node.js signal handling — `SIGTERM` for graceful shutdown

### 9.2 Graceful Shutdown
- `process.on('SIGTERM')` — handle in-flight requests before exit
- NestJS `app.enableShutdownHooks()` + lifecycle hooks
- Connection draining — close DB connections and queues cleanly
- K8s `preStop` hook and `terminationGracePeriodSeconds`

### 9.3 Docker Compose for Local Dev
- `docker-compose.yml` — app + PostgreSQL + Redis + RabbitMQ
- Volumes for DB persistence
- `depends_on` with health checks (not just `condition: service_started`)
- `profiles` — optional services (e.g., monitoring stack)

### 9.4 Docker Compose for Microservices
- Composing multiple NestJS services
- Shared networks and DNS-based service discovery
- Environment overrides: `docker-compose.override.yml`

### 9.5 CI/CD
- GitHub Actions workflow: install → lint → test → build → Docker build → push
- Layer caching for Docker builds (`buildx` cache-from/cache-to)
- Running Testcontainers in CI (Docker-in-Docker or host socket)
- Environment secrets in GitHub Actions

### 9.6 Deployment Options
- VPS deployment with Docker + Nginx reverse proxy (DigitalOcean, Hetzner)
- Railway / Render — quick Node.js deploys
- Fly.io — containers on the edge
- HTTPS with Let's Encrypt (Certbot / Caddy auto-HTTPS)
- Rolling deployments with zero downtime

### 9.7 Production Considerations
- Environment-based config — never commit secrets
- Health check endpoints — `/health/live` and `/health/ready`
- Node.js memory limits (`--max-old-space-size`) in containers
- Connection pool sizing for PostgreSQL

**Phase 9 Project:** Dockerize the microservices project, Docker Compose with health checks, GitHub Actions CI/CD, deploy to VPS or Railway

---

## Cross-Cutting: Best Practices Reference

### Code Conventions
- `camelCase` for variables, functions, file names
- `PascalCase` for classes, types, interfaces, decorators
- `SCREAMING_SNAKE_CASE` for constants
- `I` prefix for interfaces is optional in TS (unlike C#) — be consistent within a project
- Async functions always return `Promise<T>` — name them without `Async` suffix (unlike C#)

### Common Packages Ecosystem
| Purpose | Package | .NET Equivalent |
|---------|---------|----------------|
| Framework | NestJS | ASP.NET Core |
| ORM | Prisma / DrizzleORM | EF Core |
| Validation | zod / class-validator | FluentValidation |
| CQRS / Messaging | @nestjs/cqrs | MediatR |
| Message queue | BullMQ | Hangfire |
| Message broker | RabbitMQ via @nestjs/microservices | MassTransit |
| Logging | Pino + nestjs-pino | Serilog |
| Testing | Jest + supertest + testcontainers | xUnit + Moq + Testcontainers |
| Auth | @nestjs/passport + passport-jwt | Microsoft.Identity + JwtBearer |
| HTTP client | axios / got | HttpClient + Polly |
| API docs | @nestjs/swagger | Swashbuckle / Scalar |
| Rate limiting | @nestjs/throttler | Microsoft.AspNetCore.RateLimiting |
| Authorization | CASL | custom policies + IAuthorizationService |
| Job queues | BullMQ | Hangfire |
| Circuit breaker | opossum | Polly |

---

## .NET ↔ Node.js Quick Reference

| Concept | .NET / C# | JavaScript / Node.js |
|---------|-----------|---------------------|
| Runtime | CLR | V8 + libuv (Node.js) |
| Package manager | NuGet | npm / pnpm |
| Entry point | `Program.cs` | `main.ts` / `index.ts` |
| DI container | Built-in ASP.NET DI | NestJS DI (Reflect Metadata) |
| Async primitive | `Task<T>` | `Promise<T>` |
| Parallel tasks | `Task.WhenAll()` | `Promise.all()` |
| Cancellation | `CancellationToken` | `AbortController` / `AbortSignal` |
| Config | `IOptions<T>` + appsettings | `zod` + dotenv |
| Request-scoped context | `IHttpContextAccessor` | `AsyncLocalStorage` |
| Background jobs | `BackgroundService` | BullMQ workers |
| Migrations | `dotnet ef migrations add` | `prisma migrate dev` |
| Test framework | xUnit | Jest |
| Mocking | Moq | `jest.fn()` / `jest.mock()` |
| API testing | WebApplicationFactory + HttpClient | supertest |
| DB testing | Testcontainers (.NET) | testcontainers (npm) |

---

## Milestones

| Milestone | What you can do |
|-----------|----------------|
| After Phase 2 | Write type-safe TypeScript with advanced patterns |
| After Phase 3 | Build production-grade Node.js servers with proper error handling and profiling |
| After Phase 4 | Persist data to PostgreSQL with type-safe queries and migrations |
| After Phase 5 | Structure professional-grade NestJS APIs with Clean Architecture |
| After Phase 6 | Add complete auth flow with JWT, refresh tokens, and RBAC |
| After Phase 7 | Write full test suites — unit, integration, E2E with real DB |
| After Phase 8 | Build distributed microservices with async messaging |
| After Phase 9 | Deploy and operate containerized Node.js apps in production |

---

## How to Use This Plan

1. Work through phases sequentially — each builds on the last
2. Don't skip the mini-projects — they cement the concepts
3. Update `notes/XX-topic.md` as you learn — include code examples, gotchas, and "aha" moments
4. Update the progress table in `CLAUDE.md` as phases complete
5. Cross-reference the .NET track — same architecture, different language: the mental model transfers
