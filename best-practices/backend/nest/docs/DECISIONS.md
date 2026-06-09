# Architecture Decision Records — Backend (NestJS)

Key technology and pattern choices with the reasoning behind each. Understanding the **why** helps the team make consistent decisions in cases not explicitly covered by `BEST-PRACTICES.md`.

---

## ADR-001 — NestJS as the backend framework

**Decision**: NestJS as the primary backend framework.

**Why**: Module-based architecture enforces clear feature boundaries. First-class TypeScript support with decorators, DI, and metadata reflection. Rich ecosystem of official modules (`@nestjs/mongoose`, `@nestjs/jwt`, `@nestjs/config`, `@nestjs/cache-manager`, `@nestjs/terminus`) versioned against each NestJS release. `APP_GUARD` / `APP_FILTER` tokens give cross-cutting concerns full DI access — impossible with plain Express middleware.

**Trade-off**: Higher learning curve than Express for developers new to decorators and DI. Requires `emitDecoratorMetadata: true` in `tsconfig.json`.

---

## ADR-002 — MongoDB as the default database

**Decision**: MongoDB with `@nestjs/mongoose` for new projects. PostgreSQL available via `BEST-PRACTICES-POSTGRESQL.md`.

**Why**: Schema flexibility fits rapid iteration. `{ timestamps: true }` on `@Schema` adds `createdAt`/`updatedAt` automatically with no migration. Atlas provides managed replica sets, enabling multi-document transactions without infrastructure overhead. `.lean()` on read queries returns plain objects — significantly faster for list endpoints than full Mongoose document instances.

**Trade-off**: Multi-document ACID transactions require a replica set (not available on standalone `mongod`). Schema validation is application-side, not enforced at the database level as strictly as relational constraints.

**Use PostgreSQL when**: relational integrity, complex joins, or strict schema enforcement are requirements.

---

## ADR-003 — Native `@nestjs/jwt` over `@nestjs/passport` for new projects

**Decision**: `@nestjs/jwt` with a custom `AuthGuard` for new projects. `@nestjs/passport` only when multiple auth strategies are needed simultaneously.

**Why**: `@nestjs/passport` adds an abstraction layer introducing `PassportStrategy`, `AuthGuard('jwt')` magic strings, and a two-file setup per strategy. A custom guard that calls `jwtService.verifyAsync()` is ~20 lines, fully typed, and easier to debug.

**Use `@nestjs/passport`**: projects needing multiple strategies simultaneously (local login + JWT + OAuth).

---

## ADR-004 — `APP_GUARD` / `APP_FILTER` tokens over `useGlobalXxx()`

**Decision**: Register global guards, filters, interceptors, and pipes with DI tokens in `AppModule`. Not via `app.useGlobalXxx()` in `main.ts`.

**Why**: `app.useGlobalXxx()` registers the instance outside the DI container. If the guard or filter needs to inject a service (e.g., `ConfigService` inside a filter, `Reflector` in a guard), it fails silently or throws at runtime. Token-registered providers participate in the DI container and support constructor injection.

**Exception**: `ValidationPipe` with no dependencies can safely use `app.useGlobalPipes()`.

---

## ADR-005 — `bcrypt` async with cost factor 12

**Decision**: `bcrypt.hash` / `bcrypt.compare` (async) with cost factor 12.

**Why**: bcrypt is purpose-built for password hashing — slow by design, resistant to GPU attacks, automatically salted. Cost factor 12 balances security (~200–300ms per hash on modern hardware, slow enough to hinder brute-force) with performance. Async form is mandatory — `bcrypt.hashSync` blocks the event loop, degrading all concurrent requests during a hash.

**Alternatives rejected**: MD5/SHA1/SHA256 — not designed for password hashing, computable at billions/second on consumer GPUs.

---

## ADR-006 — `@nestjs/cache-manager` v3 with Keyv

**Decision**: `@nestjs/cache-manager` v3 which uses Keyv as the storage adapter.

**Why**: v3 replaced the old `store` adapter pattern with Keyv, which is actively maintained and supports a wider range of backends. Multi-store configuration (in-memory L1 + Redis L2) is first-class in v3. `CacheableMemory` with LRU eviction prevents unbounded memory growth.

**Breaking change**: v2 used a different store API — see `docs/CHANGELOG.md` for migration details.

---

## ADR-007 — Services throw, controllers do not

**Decision**: Services throw NestJS HTTP exceptions. Controllers only call services and return results.

**Why**: Services contain the business rules that determine valid state ("user must exist", "email must be unique"). If controllers throw, exception logic splits across two layers, making services harder to test in isolation. The global `HttpExceptionFilter` catches all `HttpException` subclasses regardless of which layer throws — there is no functional difference, only a clarity and testability difference.

---

## ADR-008 — `registerAs()` for typed namespaced config

**Decision**: `registerAs()` creates typed configuration namespaces. Inject via `ConfigType<typeof configFactory>` for strong typing.

**Why**: `ConfigService.get<string>("jwt.secret")` returns `string | undefined` — callers must handle undefined or use non-null assertions. `ConfigType<typeof jwtConfig>` gives fully typed access with no `| undefined`. Namespaced configs can be validated independently at startup.

**Trade-off**: One file per namespace. Acceptable cost for the type safety gained in services.
