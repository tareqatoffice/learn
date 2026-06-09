# FAQ — Backend (NestJS)

Answers to questions that come up repeatedly during code review or onboarding.

---

## NestJS & Architecture

**Q: When should I use `@UseGuards()` on a route vs `APP_GUARD` globally?**

- **`APP_GUARD`**: guards that apply to every route by default (e.g., `JwtAuthGuard`). Use `@Public()` to opt individual routes out.
- **`@UseGuards()`**: guards specific to one controller or route (e.g., `RolesGuard` on admin endpoints, `@Throttle()` with a stricter limit on login).

Do not register `RolesGuard` globally — it would run on every request and read role metadata even on public routes where there is none.

---

**Q: Should I put business logic in the controller or the service?**

Always in the service. Controllers handle HTTP only: extract request data, call the service, return the result. Rule of thumb: if the method would make sense in a CLI command or a queue worker, it belongs in the service.

---

**Q: When should I throw from a service vs return an error object?**

Always throw NestJS HTTP exceptions. Never return `{ error: "not found" }`. The global `HttpExceptionFilter` formats all `HttpException` subclasses into a consistent JSON response. Returning error objects bypasses the filter and sends inconsistent shapes to the client.

```ts
// Correct
throw new NotFoundException(`User ${id} not found`);

// Wrong
return { error: "User not found" };
```

---

**Q: Can I import `Request` from Express in my service?**

No. Services must not depend on HTTP types. If you need request data (user ID, role), extract it in the controller or guard and pass it as a typed argument to the service.

---

**Q: Should I use `async/await` or `.then()` for Mongoose queries?**

Always `async/await`. Always call `.exec()` at the end of Mongoose query chains to get a real `Promise`:

```ts
const user = await this.userModel.findById(id).exec();
```

Without `.exec()`, Mongoose returns a `Query` object. It resolves via `.then()` but lacks full Promise semantics and causes subtle issues with error handling and TypeScript types.

---

## Database (MongoDB)

**Q: When do I use `.lean()` on a Mongoose query?**

On read-only queries where you do not need Mongoose document methods (`.save()`, `.populate()`, virtual getters). `.lean()` returns plain JavaScript objects — significantly faster because Mongoose skips building the full document instance.

Do not use `.lean()` when you intend to mutate the document and call `.save()`, or when you need virtual properties.

---

**Q: When should I use MongoDB sessions (transactions)?**

When a single operation writes to two or more documents and all writes must succeed or fail together. Example: creating a user + creating an audit log entry.

Single-document operations (including array pushes) are atomic in MongoDB without a session. Sessions require a replica set — a standalone `mongod` does not support them.

---

**Q: My Mongoose query returns stale data after an update. Why?**

Use `{ new: true }` on `findByIdAndUpdate` / `findOneAndUpdate` to get the updated document back, rather than fetching it separately in a second query.

---

## Authentication

**Q: What should I store in the JWT payload?**

Only non-sensitive identifiers: `sub` (user ID), `role`, and `iat`/`exp` (set automatically by `@nestjs/jwt`). Never store passwords, emails, PII, or secrets. The payload is base64-encoded, not encrypted — anyone who intercepts the token can read it.

---

**Q: Where should refresh tokens be stored?**

Server-side — in the database or Redis — keyed by user ID. Store the hash of the refresh token, not the raw value. On refresh: look up the record, verify the provided token against the hash, issue a new access token, and rotate the refresh token. This allows invalidation by deleting the server-side record.

---

**Q: What is the `@Public()` decorator and how do I implement it?**

A custom decorator that sets metadata to opt a route out of the global `JwtAuthGuard`:

```ts
// common/decorators/public.decorator.ts
import { SetMetadata } from "@nestjs/common";
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// In JwtAuthGuard.canActivate():
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;
```

---

## Configuration & Security

**Q: Why can't I access `process.env` directly in services?**

Two reasons: (1) `process.env` values are unvalidated strings or `undefined`. `ConfigService` validates all variables at startup — a missing required variable fails the app immediately rather than silently at runtime. (2) Services that read `process.env` are harder to test — you must mutate the global environment. Services that inject `ConfigService` receive a mock in tests.

---

**Q: Why must `app.use(helmet())` come before `app.enableCors()`?**

Middleware runs in registration order. If `enableCors()` runs first, CORS headers are set before `helmet()` can add its security headers to the same response. Helmet must be first so its headers appear on CORS preflight responses too.

---

## Testing

**Q: Should I test guards and filters directly or via E2E tests?**

Both:
- **Unit tests**: test guards and filters in isolation using `Test.createTestingModule`. Mock `ExecutionContext` and `ArgumentsHost`.
- **E2E tests**: confirm the wiring — a protected route returns 401 without a token, a forbidden route returns 403 for the wrong role.

Do not rely solely on E2E tests for guards — they are slow and difficult to cover all edge cases through.

---

**Q: Why `mongodb-memory-server` for E2E tests instead of a real MongoDB?**

No external service to set up in CI. Tests are isolated — `dropDatabase()` in `afterEach` guarantees clean state. Fast startup (~1–2 seconds), no network latency.

For PostgreSQL E2E tests, use a dedicated test database (see `BEST-PRACTICES-POSTGRESQL.md`) — there is no equivalent in-process PostgreSQL server suitable for production-schema tests.

---

## Email

**Q: Where should email be sent from — backend or frontend?**

Always the backend. The provider API key must never reach the browser, and the backend owns validation, rate limiting, retries (BullMQ), and SPF/DKIM signing. The frontend only calls an endpoint (e.g. `POST /auth/forgot-password`) that enqueues a mail job. See [ADR-009](./DECISIONS.md).

---

**Q: Can I use Gmail SMTP instead of Resend?**

Not for application email. Gmail / Workspace SMTP isn't licensed for automated sending, caps you at ~500–2,000 messages/day, can't sign mail for your domain, and has no bounce/complaint webhooks — so it lands in spam and risks account suspension. Use Resend (or SES / Postmark at scale). Gmail SMTP is fine only for a quick local test — prefer Mailpit or Mailtrap even then.

---

**Q: Why enqueue email through BullMQ instead of sending inline?**

Sending inline blocks the request on a third-party API call and loses the message if that call fails. Enqueuing returns immediately, retries with backoff, and survives transient provider outages. See the Email Service section in `BEST-PRACTICES.md`.
