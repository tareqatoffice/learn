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

**Considered — `argon2id`**: OWASP's current *first* recommendation (memory-hard, more resistant to GPU/ASIC attacks than bcrypt). Equally valid for new projects via the `argon2` package with OWASP parameters (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`). bcrypt is kept as the documented default for its ubiquity and zero-config maturity; argon2id is the recommended upgrade where the dependency is acceptable. Keep whichever you choose behind the auth service so the algorithm is a one-place swap.

**Alternatives rejected**: MD5/SHA1/SHA256 — not designed for password hashing, computable at billions/second on consumer GPUs.

---

## ADR-006 — `@nestjs/cache-manager` v3 with Keyv

**Decision**: `@nestjs/cache-manager` v3 which uses Keyv as the storage adapter.

**Why**: v3 replaced the old `store` adapter pattern with Keyv, which is actively maintained and supports a wider range of backends. Multi-store configuration (in-memory L1 + Redis L2) is first-class in v3. `KeyvCacheableMemory` with LRU eviction prevents unbounded memory growth.

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

---

## ADR-009 — Provider-agnostic SMTP email, sent only from the backend

**Decision**: Send all transactional email from the backend, enqueued through BullMQ, behind a `MailProvider` port whose default implementation is a single **SMTP transport** (nodemailer). Resend (default), Brevo, and Google/Workspace are selected by configuration, not code. Never send email from the frontend.

**Why (backend-only)**: SMTP credentials must never reach the browser — anything in a client bundle is public, even behind a `NEXT_PUBLIC_` prefix. The backend is also where recipient validation, rate limiting, retries (BullMQ), and SPF/DKIM alignment belong. The frontend only triggers an endpoint (e.g. `POST /auth/forgot-password`) that enqueues a job.

**Why (provider-agnostic SMTP)**: Resend, Brevo, and Google/Workspace all expose standard SMTP, so one nodemailer transport swaps between them by changing `MAIL_HOST`/`MAIL_USER`/`MAIL_PASS` only. The `MailProvider` interface keeps the queue worker and templates (React Email → HTML) independent of the provider. Resend is the recommended default (good deliverability, domain auth, generous free tier).

**Trade-off**: Plain SMTP gives up provider-API niceties (tags, idempotency keys, batch send, native webhooks-by-SDK). When those are needed, add an API-based `MailProvider` (e.g. `ResendMailProvider`) and flip the single `useClass` binding in `mail.module.ts` — the rest of the app is unaffected.

**Alternatives rejected**:
- **Hard-coding one provider's SDK in the processor** — couples the queue worker to a vendor; switching means editing send logic. The port removes that coupling.
- **Gmail/Workspace SMTP as the *primary* provider** — fine as a swappable target, but not licensed for high-volume automated sending (~500 consumer / ~2,000 Workspace daily caps) and weaker deliverability; prefer Resend/Brevo for production volume.

**When to switch**: very high volume → Amazon SES (cheapest at scale); strictest deliverability → Postmark. Add them as another SMTP target or as an API-based `MailProvider`; the backend-only and queue rules are unchanged.

**Local dev**: point the SMTP vars at a local catcher (Mailpit / MailHog) or Mailtrap — not a real mailbox.

---

## ADR-010 — Isolate third-party dependencies behind a thin internal module

**Decision**: Every swappable third-party library is accessed through one internal wrapper (a NestJS provider/port). Application code depends on the wrapper, never the package directly. The email `MailProvider` is the reference example.

**Why**: Confines change. Replacing Resend with Brevo, the AWS SDK with another S3 client, or PostHog with another tool then touches a single provider instead of rippling across the codebase. It also centralizes credentials/config and makes each dependency trivially mockable in tests.

**Scope / trade-off**: Applies to libraries with a realistic chance of replacement (email, storage, analytics, cache, payments, SMS). It does **not** apply to the framework itself or to pervasive primitives — wrapping those is premature indirection that adds boilerplate for no benefit. Use an interface + DI token only when more than one implementation is plausible; otherwise a plain service is enough.
