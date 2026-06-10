# Backend Best Practices

> Stack: NestJS v11 · Node.js >= 20 · MongoDB · `@nestjs/mongoose` v11 · Mongoose v8 · `@nestjs/jwt` v11 · `@nestjs/passport` v11

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Modules](#modules)
3. [Controllers](#controllers)
4. [API Versioning](#api-versioning)
5. [Services](#services)
6. [DTOs & Validation](#dtos--validation)
7. [Database & Repositories](#database--repositories)
8. [Authentication & Authorization](#authentication--authorization)
9. [Error Handling](#error-handling)
10. [Configuration](#configuration)
11. [Logging](#logging)
12. [Request Context & Correlation IDs](#request-context--correlation-ids)
13. [TypeScript Standards](#typescript-standards)
14. [Testing](#testing)
15. [Performance & Security](#performance--security)
16. [Swagger / OpenAPI](#swagger--openapi)
17. [Health Checks](#health-checks)
18. [Graceful Shutdown](#graceful-shutdown)
19. [Email Service](#email-service)
20. [Queues & Background Jobs](#queues--background-jobs)
21. [Scheduled Jobs](#scheduled-jobs)
22. [File Storage — Cloudflare R2](#file-storage--cloudflare-r2)
23. [Bot Protection — Cloudflare Turnstile](#bot-protection--cloudflare-turnstile)
24. [Analytics — PostHog](#analytics--posthog)
25. [Notifications — SSE](#notifications--sse)
26. [API Response Shape & Pagination](#api-response-shape--pagination)
27. [Idempotency](#idempotency)
28. [Observability — Error Tracking](#observability--error-tracking)
29. [Dependency Isolation](#dependency-isolation)

---

## Project Structure

```
project-root/
├── CLAUDE.md                    # Canonical agent instructions (Claude Code)
├── AGENTS.md                    # → CLAUDE.md  (Codex, Antigravity, Windsurf, Zed…)
├── GEMINI.md                    # → CLAUDE.md  (Antigravity / Gemini priority slot)
├── .cursor/rules/standards.mdc  # Cursor always-on rule → CLAUDE.md
├── .github/
│   └── copilot-instructions.md  # → CLAUDE.md  (GitHub Copilot)
├── .env.example                 # Every env var, keys only — committed
├── .nvmrc                       # Pinned Node version
├── docs/
│   ├── BEST-PRACTICES.md        # This file
│   ├── BEST-PRACTICES-POSTGRESQL.md  # PostgreSQL/TypeORM variant
│   ├── CICD.md                  # CI/CD & git workflow
│   ├── CHANGELOG.md             # Log of changes to these standards
│   ├── DECISIONS.md             # Architecture decision records
│   ├── FAQ.md                   # Common questions
│   └── CONTRIBUTING.md          # How to propose changes
└── src/
    ├── modules/
    │   └── users/
    │       ├── dto/
    │       │   ├── create-user.dto.ts
    │       │   └── update-user.dto.ts
    │       ├── schemas/
    │       │   └── user.schema.ts
    │       ├── users.controller.ts
    │       ├── users.service.ts
    │       ├── users.module.ts
    │       └── users.service.spec.ts
    ├── common/
    │   ├── decorators/
    │   ├── filters/
    │   ├── guards/
    │   ├── interceptors/
    │   └── pipes/
    ├── config/
    │   └── configuration.ts
    ├── app.module.ts
    └── main.ts
```

- One module per domain/feature. Never flatten all files into a single directory.
- Shared cross-cutting concerns (guards, filters, interceptors, decorators) live in `common/`. Never duplicate them across modules.
- Schemas belong to the module that owns them, not a global `schemas/` folder.

---

## Modules

- Every feature is a NestJS module. Each module is self-contained: it declares its controllers, providers, and explicitly exports what other modules may use.
- Use `forRoot` / `forFeature` patterns for configurable modules (database, config, JWT).
- Avoid circular dependencies. They almost always mean a responsibility sits in the wrong module, not just a wiring problem — see [Circular Dependencies](#circular-dependencies) below.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- For global pipes, filters, guards, and interceptors that need dependency injection, register them with `APP_PIPE` / `APP_FILTER` / `APP_GUARD` / `APP_INTERCEPTOR` tokens inside a module provider — not via `app.useGlobalXxx()` in `main.ts`, which bypasses the DI container.

```ts
// Preferred — supports DI (e.g. ConfigService inside the filter)
@Module({
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}

// Only use useGlobalXxx() for things with zero dependencies
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

### Circular Dependencies

A circular dependency — module A imports module B while B imports A, or two providers inject each other — is almost always a sign that a responsibility lives in the wrong place, not something to work around. NestJS may fail to resolve one side and inject `undefined`, so the failure often surfaces at call time rather than at startup.

Resolve it in this order — reach for the escape hatch only after the first three fail:

1. **Make the dependency one-directional.** Decide which module is lower-level (owns the data or primitive) and which is higher-level (orchestrates a flow). Point the arrow one way: the higher-level module imports the lower-level one and calls into it; the lower-level module stays completely unaware of the higher-level one.
2. **Move the misplaced responsibility.** The cycle usually exists because a piece of logic sits in the wrong module — typically a lower-level service reaching back into a higher-level one to finish an operation. Relocate that logic, or let a controller/flow orchestrate the two services in sequence, so the back-reference disappears.
3. **Extract a shared module.** If both modules genuinely need the same logic, pull it into a third, lower-level module that both import. Neither original module then depends on the other.
4. **`forwardRef()` — last resort only.** When two providers truly must reference each other, NestJS offers `forwardRef()` at both the module and provider level. It works, but it hides the cycle instead of removing it — treat every `forwardRef` as tech debt and a prompt to revisit the boundary.

```ts
// Escape hatch — prefer options 1–3 first
@Module({ imports: [forwardRef(() => OtherModule)] })
export class FeatureModule {}

@Injectable()
export class FeatureService {
  constructor(
    @Inject(forwardRef(() => OtherService))
    private readonly other: OtherService,
  ) {}
}
```

---

## Controllers

- Controllers handle HTTP only: routing, input extraction, response shaping.
- No business logic in controllers. Delegate everything to the service.
- Always type the return value. Return the entity/document and let `ClassSerializerInterceptor` strip `@Exclude()` fields; document the wire shape as `UserResponseDto` in Swagger (see [Swagger / OpenAPI](#swagger--openapi)).

```ts
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  getUser(@Param("id", ParseObjectIdPipe) id: string): Promise<UserDocument> {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto): Promise<UserDocument> {
    return this.usersService.create(dto);
  }
}
```

- Use built-in pipes (`ParseIntPipe`, `ParseEnumPipe`, `ParseBoolPipe`) for primitive path/query params. **`ParseUUIDPipe` is for UUID primary keys (the PostgreSQL variant) — it rejects MongoDB `ObjectId`s.** For Mongo `_id` params, use a small custom `ParseObjectIdPipe`:

```ts
// common/pipes/parse-object-id.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { isValidObjectId } from "mongoose";

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) throw new BadRequestException(`Invalid id: ${value}`);
    return value;
  }
}
```

- Validate `ObjectId` fields inside DTOs with `@IsMongoId()` (from `class-validator`) for the same reason.
- Use `@HttpCode()` explicitly when the default status code is wrong.
- Apply guards and interceptors at the controller or route level, not globally, when they are route-specific.

---

## API Versioning

Version the API from day one so the contract can evolve without breaking existing clients (including the generated frontend types). Use **URI versioning** — explicit, cache-friendly, and visible in logs.

```ts
// main.ts
import { VersioningType } from "@nestjs/common";

app.enableVersioning({
  type: VersioningType.URI, // /v1/users
  defaultVersion: "1",
});
```

```ts
@Controller({ path: "users", version: "1" })
export class UsersController {}
```

- Routes are then served under `/v1/...`. Set `defaultVersion` so unversioned controllers still resolve.
- Bump the version only on a **breaking** change (removed field, changed type, different semantics). Additive changes (new optional field, new endpoint) stay on the current version.
- Run versions side by side during a migration: keep `UsersV1Controller` and `UsersV2Controller` until clients move off v1, then delete v1.
- Reflect the version in Swagger (`DocumentBuilder().setVersion(...)`) and regenerate the frontend types after any bump.

---

## Services

- Services contain all business logic. They are the only layer allowed to call repositories, external APIs, or other services.
- Services must not import controllers or anything HTTP-specific (`@Req`, `Request`).
- Keep methods focused. If a service method exceeds 30 lines, extract a private helper or split into a sub-service.

```ts
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return new this.userModel({ ...dto, passwordHash }).save();
  }
}
```

- Throw NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, etc.) from the service, not the controller. The global exception filter handles them.

---

## DTOs & Validation

- Every incoming request body, query string, or param set must have a DTO.
- Use `class-validator` decorators on DTOs. Enable `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true`.

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === "production",
  }),
);
```

> `disableErrorMessages: true` in production prevents exposing validation field names and constraints to clients. **Trade-off:** it also hides legitimate messages the UI may want to surface (e.g. "email is invalid"). If the frontend relies on per-field messages, keep them enabled and instead avoid leaking internals by using explicit, user-safe DTO messages — don't depend on `disableErrorMessages` as your only guard.

```ts
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

- `whitelist: true` strips properties not in the DTO. `forbidNonWhitelisted: true` rejects requests with unknown properties.
- `transform: true` auto-coerces primitive types (strings to numbers, etc.) based on TS types.
- Never use `import type { CreateUserDto }` — TypeScript erases type-only imports at runtime, destroying the metadata `ValidationPipe` needs to validate. Use a regular `import { CreateUserDto }`.
- Use `PartialType` / `OmitType` / `PickType` to build update DTOs — never duplicate property decorators manually. Import them from `@nestjs/mapped-types` in a plain app, but **when the app uses Swagger (it does — see [Swagger / OpenAPI](#swagger--openapi)) import the same helpers from `@nestjs/swagger`** so `@ApiProperty()` metadata is carried over to the derived DTO.

```ts
// dto/update-user.dto.ts — import from @nestjs/swagger since this app exposes Swagger docs
import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ["email"] as const)) {}
```

- Use `@Exclude()` and `@Expose()` from `class-transformer` on response DTOs to control what is serialized. Enable `ClassSerializerInterceptor` globally.

```ts
// entities/user.entity.ts
import { Exclude } from "class-transformer";

export class User {
  id: string;
  email: string;

  @Exclude()
  passwordHash: string;
}
```

```ts
// main.ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

> **Mongoose caveat — `@Exclude()` on a `@Schema` class is NOT honored.** `ClassSerializerInterceptor` only applies `class-transformer` decorators to instances of the decorated class. A Mongoose `HydratedDocument` returned from a controller is **not** such an instance, so `@Exclude()` placed on the schema (or on a separate entity class the document isn't an instance of) silently does nothing — `passwordHash` leaks. Pick one of:
> - **Schema-level transform** (simplest for Mongoose): strip sensitive fields in the schema's `toJSON` so every serialization path is safe — `@Schema({ toJSON: { transform: (_, ret) => { delete ret.passwordHash; return ret; } } })`. Combine with `.select("-passwordHash")` on reads so the field never loads in the first place.
> - **Explicit DTO mapping**: return a real class instance — `plainToInstance(UserResponseDto, doc.toObject())` — so `@Exclude()`/`@Expose()` on `UserResponseDto` apply as intended. Use this when the wire shape diverges from the document.

---

## Database & Repositories

### Connection

- Connect via `MongooseModule.forRootAsync()` so `ConfigService` provides the URI — never hardcode connection strings.

```ts
// app.module.ts
MongooseModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>("database.uri"),
  }),
  inject: [ConfigService],
})
```

- Add `database.uri` to the config factory and validate it at startup so a missing `MONGODB_URI` fails fast.

### Schema Definition

- Define schemas with `@Schema()` / `@Prop()` decorators from `@nestjs/mongoose`. Export both the class and the `HydratedDocument` type.

```ts
// schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: Role, default: Role.USER })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

- Keep schemas clean: only persistence concerns. No business logic.
- Always set `{ timestamps: true }` — it adds `createdAt` and `updatedAt` automatically.
- Add indexes at the schema level, not in service code:

```ts
UserSchema.index({ email: 1 }, { unique: true });
```

### Module Registration

```ts
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Model Injection & Querying

- Inject via `@InjectModel(Entity.name)` and type as `Model<EntityDocument>`.
- Always call `.exec()` at the end of Mongoose queries to get a real Promise.
- Use `.lean()` for read-only list queries — returns plain objects, significantly faster than full Mongoose documents.

```ts
// List — lean for performance
const users = await this.userModel.find({ isActive: true }).lean().exec();

// Single document — full Mongoose doc for mutation
const user = await this.userModel.findById(id).exec();
```

- Never construct raw query strings. Use Mongoose query API or aggregation pipelines.

### Transactions

- Use MongoDB sessions for multi-document atomic operations (requires a replica set or Atlas):

```ts
const session = await this.connection.startSession();
try {
  session.startTransaction();
  await this.userModel.create([{ ...dto, passwordHash }], { session });
  await this.auditModel.create([{ action: "user.created" }], { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

- Inject `InjectConnection()` to access the Mongoose connection for session management.

---

## Authentication & Authorization

### Authentication

NestJS v11 supports two JWT authentication approaches — choose one per project and stay consistent:

**Option A — Native `@nestjs/jwt` (recommended for new projects)**
Simpler, no Passport dependency. Use `@nestjs/jwt` directly to sign and verify tokens in a custom `AuthGuard`.

```ts
// auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException();
    try {
      // Pin the algorithm and validate iss/aud. Without `algorithms`, a project that
      // later moves to asymmetric keys is exposed to algorithm-confusion attacks.
      request.user = await this.jwtService.verifyAsync(token, {
        algorithms: ["HS256"], // or ["RS256"] for asymmetric keys
        issuer: this.config.get("jwt.issuer"),
        audience: this.config.get("jwt.audience"),
      });
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
```

**Option B — `@nestjs/passport` with `passport-jwt`**
Use when you need multiple strategies (local + JWT, OAuth, etc.) or are extending an existing passport-based project.

- Store only non-sensitive data in the JWT payload (user ID, role). Never store passwords or PII.
- Short-lived access tokens (15 min). Use refresh tokens stored server-side (DB or Redis) for re-issuance, with **rotation + reuse detection** (below).
- Hash passwords with `bcrypt` (min cost factor 12). Never store plaintext passwords or use weak hashing (MD5, SHA1). Always use the async form — `bcrypt.hash()` not `bcrypt.hashSync()` — to avoid blocking the event loop.

```ts
const hash = await bcrypt.hash(plaintext, 12);
```

**Refresh-token rotation with reuse detection.** Never return a long-lived token the client keeps forever. On every refresh, issue a *new* refresh token and invalidate the old one; if an already-used (rotated-out) token is presented, treat it as theft and revoke the whole token family. Store only a **hash** of the refresh token (it's a credential), keyed by user + a per-token `jti`.

```ts
// auth.service.ts — sketch
async refresh(presentedToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const { sub, jti } = await this.jwtService.verifyAsync(presentedToken, {
    algorithms: ["HS256"],
    secret: this.config.get("jwt.refreshSecret"),
  });

  const stored = await this.refreshStore.find(sub, jti); // e.g. Redis key refresh:{sub}:{jti}
  // Reuse detection: a valid-but-unknown jti means this token was already rotated out → theft.
  if (!stored || !(await argon2.verify(stored.hash, presentedToken))) {
    await this.refreshStore.revokeAllForUser(sub); // nuke the family
    throw new UnauthorizedException("Refresh token reuse detected");
  }

  await this.refreshStore.revoke(sub, jti); // one-time use
  const newJti = randomUUID();
  const refreshToken = await this.jwtService.signAsync(
    { sub, jti: newJti },
    { secret: this.config.get("jwt.refreshSecret"), expiresIn: "7d" },
  );
  await this.refreshStore.save(sub, newJti, await argon2.hash(refreshToken), /* ttl */ 7 * 86_400);

  const accessToken = await this.jwtService.signAsync({ sub }, { expiresIn: "15m" });
  return { accessToken, refreshToken };
}
```

> **`argon2id` is OWASP's current first recommendation** for new projects (memory-hard, more GPU/ASIC-resistant than bcrypt). Use `argon2` (`npm i argon2`) with the OWASP-suggested parameters (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`); bcrypt at cost 12 remains acceptable. Whichever you pick, keep it behind the auth service so the algorithm is a one-place change — see [ADR-005](./DECISIONS.md).

### Authorization

- Use Guards for authorization. Never check roles/permissions inside a service method.
- Define a `@Roles()` decorator and a `RolesGuard` that reads from route metadata.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Delete(":id")
deleteUser(@Param("id", ParseObjectIdPipe) id: string): Promise<void> {
  return this.usersService.delete(id);
}
```

- Register `JwtAuthGuard` globally using `APP_GUARD` (not `app.useGlobalGuards()`) so it participates in DI and can read metadata. Use a `@Public()` decorator for intentionally unauthenticated routes.

```ts
// app.module.ts
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

- Guards should throw a specific exception (`UnauthorizedException`, `ForbiddenException`) when denying access — not just return `false`. Returning `false` produces a generic 403 with no useful message.

---

## Error Handling

- Use NestJS built-in HTTP exceptions. Never throw plain `Error` from a service.
- Register a global `HttpExceptionFilter` to normalize all error responses. Use a **catch-all `@Catch()`** (not `@Catch(HttpException)`): third-party libraries, drivers, and plain `Error`s throw non-`HttpException`s, and a filter scoped to `HttpException` lets those fall through to Nest's default 500 — a different body that breaks the "every endpoint returns a predictable shape" guarantee. The filter handles `HttpException`s normally and maps everything else to a sanitized 500.

```ts
// common/filters/http-exception.filter.ts
@Catch() // catch-all — HttpExceptions AND unexpected errors
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unexpected errors (5xx / non-HttpException): log with stack, never leak details.
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const message = isHttp
      ? (() => {
          const res = exception.getResponse();
          return typeof res === "string"
            ? res
            : (res as { message: string | string[] }).message;
        })()
      : "Internal server error"; // never echo the raw error to the client

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- Register `HttpExceptionFilter` with `APP_FILTER` in `AppModule` (not `useGlobalFilters`) so it supports dependency injection (e.g. injecting a logger).
- Log unexpected errors (5xx) with full stack traces. Do not log 4xx errors as errors — they are expected client mistakes.
- Never leak stack traces or internal error details to API responses in production.
- Include the error `cause` when constructing exceptions for internal logging — it is not serialized into the response:

```ts
throw new NotFoundException(`User ${id} not found`, { cause: originalError });
```

---

## Configuration

- Use `@nestjs/config` with a typed configuration factory. Never access `process.env` directly in services or controllers.

```ts
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT ?? "3000", 10),
  database: {
    uri: process.env.MONGODB_URI,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
  },
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT ?? "587", 10),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
  },
});
```

- Set `isGlobal: true` on `ConfigModule` so it is available across all feature modules without repeated imports:

```ts
ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema })
```

- Validate environment variables at startup using `Joi` or `class-validator` schema in `ConfigModule.forRoot({ validationSchema })`. Fail fast on missing required variables.
- Commit a `.env.example` listing **every** variable the app reads — keys only, no values. Keep it in sync with the validation schema; the real `.env` stays gitignored. It is the canonical list of required config for new developers and CI.
- Use `registerAs()` to namespace related config, then inject the namespace directly for strong typing:

```ts
// config/jwt.config.ts
export const jwtConfig = registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
}));

// In service constructor:
constructor(@Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>) {}
```

- Inject config via `ConfigService` when namespace injection is not needed:

```ts
constructor(private readonly config: ConfigService) {}

const secret = this.config.get<string>("jwt.secret");
```

---

## Logging

- Use NestJS's built-in `Logger` in every service. Never use `console.log`.

```ts
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async findById(id: string): Promise<User> {
    this.logger.debug(`Finding user ${id}`);
    // ...
  }
}
```

- In production, enable JSON logging for log aggregators (AWS CloudWatch, Datadog, ELK):

```ts
// main.ts
const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({ json: true }),
  bufferLogs: true,
});
```

- Use `bufferLogs: true` to capture early bootstrap log messages before the logger is set.
- Log levels: use `error` for 5xx failures, `warn` for recoverable issues, `log` for significant business events, `debug` for development traces. Never log sensitive data (passwords, tokens, PII).
- For advanced needs (Winston, Pino), create a custom logger that implements `LoggerService` and register it via `app.useLogger()`.

---

## Request Context & Correlation IDs

Every log line and outbound call should be tied to the request that caused it. A correlation (request) ID makes a single request traceable across async boundaries, queue jobs, and downstream services.

- Accept an inbound `X-Request-Id` (or generate one) at the edge and echo it back on the response.
- Propagate it without threading it through every function signature using `AsyncLocalStorage` (Node's built-in request-scoped store). `nestjs-cls` wraps this cleanly:

```bash
npm install nestjs-cls
```

```ts
// app.module.ts
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req: Request) => (req.headers["x-request-id"] as string) ?? randomUUID(),
    setup: (cls, req) => cls.set("requestId", cls.getId()),
  },
})
```

- Include the ID in every log line — with `nestjs-pino` set `genReqId` to the same value; with the built-in JSON logger, read it from CLS in a custom logger.
- Forward it on outbound HTTP/queue calls (`X-Request-Id` header, or as job data) so the ID survives across service hops.
- Set it as a Sentry tag (`Sentry.setTag("request_id", id)`) so an error links straight back to its logs.
- Prefer this over a request-scoped (`Scope.REQUEST`) provider, which forces a new instance of the whole dependency chain per request and hurts throughput.

---

## TypeScript Standards

- `strict: true` in `tsconfig.json`. No exceptions.
- No `any`. Type everything. Use `unknown` and narrow when dealing with external/untyped data.
- Use `interface` for public API shapes (DTOs, service contracts). Use `type` for unions and computed types.
- Always declare return types on public methods.
- Use enums for fixed sets of string/number constants that appear in logic and APIs.

```ts
export enum Role {
  ADMIN = "admin",
  USER = "user",
}
```

- Avoid non-null assertions (`!`). Prefer explicit null checks or optional chaining.
- For custom-provider injection, identify tokens with a `Symbol` (or `string`) constant instead of a magic string, and recover the type at the injection site. NestJS's `InjectionToken<T>` is a **type alias** (`string | symbol | Type<T> | Abstract<T> | Function`) used in signatures — not an instantiable class, so there is no `new InjectionToken()` (that is Angular's API):

```ts
// Symbol token + interface — both the binding and the consumer stay type-safe
export const USER_REPO = Symbol("USER_REPO");

@Inject(USER_REPO) private readonly userRepo: UserRepository;

// For namespaced config, registerAs() exposes a typed `.KEY` + ConfigType<T>
@Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>;
```

---

## Testing

### Unit Tests

- Test services in isolation. Mock the Mongoose model using `getModelToken(Entity.name)`.
- One `describe` block per service. One `it` per behavior, not per line.

```ts
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";

describe("UsersService", () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<UserDocument>>;

  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  it("throws NotFoundException when user does not exist", async () => {
    userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) } as any);
    await expect(service.findById("non-existent-id")).rejects.toThrow(NotFoundException);
  });
});
```

- Chain `.exec()` on mocked query methods to match the production code pattern.

### E2E Tests

- Use `@nestjs/testing` + `supertest` for E2E tests against a real HTTP server.
- Use **`mongodb-memory-server`** for an in-process MongoDB instance — no external database needed in CI.

```ts
// test/users.e2e-spec.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import * as mongoose from "mongoose";

describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it("POST /users — creates a user and returns 201", () => {
    return request(app.getHttpServer())
      .post("/users")
      .send({ email: "test@example.com", password: "password123" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.email).toBe("test@example.com");
        expect(body.passwordHash).toBeUndefined();
      });
  });
});
```

- Drop the database in `afterEach` to isolate tests. Never share state between test cases.
- Apply the same global pipes/interceptors in the test app as in production — otherwise tests don't reflect real behaviour.

### Rules

- Do not test NestJS internals (routing, DI wiring). Test your code's behaviour.
- Test all happy paths and all explicitly handled error paths.
- Name tests as readable sentences: `it("returns 404 when user is not found")`.

---

## Performance & Security

### Performance

- Add indexes on all fields used in queries, sorts, or unique constraints (see Schema Definition section).
- Paginate all list endpoints. Never return an unbounded list from the database.
- Use `.select()` in Mongoose queries to fetch only required fields for list endpoints.
- Cache expensive, rarely-changing reads with `@nestjs/cache-manager` v3+. This version uses **Keyv** under the hood — the old `store` adapter pattern is gone. Redis setup:

```ts
// npm install @nestjs/cache-manager cache-manager @keyv/redis keyv cacheable
import { CacheModule } from "@nestjs/cache-manager";
import { createKeyv } from "@keyv/redis";
import { Keyv } from "keyv";
import { CacheableMemory } from "cacheable";

CacheModule.registerAsync({
  isGlobal: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    stores: [
      new Keyv({ store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }) }),
      createKeyv(config.get<string>("redis.url")),
    ],
  }),
})
```

The first store is primary (in-memory), the second is fallback (Redis). For in-memory-only caching, omit the `createKeyv` entry. (Class names match the current `@nestjs/cache-manager` v3 docs: `CacheableMemory` from `cacheable`, `createKeyv` from `@keyv/redis`, `Keyv` from `keyv`.)

### Security

- Enable `helmet` for HTTP security headers. It **must be registered before any other `app.use()` call** — middleware runs in definition order, so late registration leaves earlier routes unprotected.
- Enable `throttler` (`@nestjs/throttler`) globally. Apply stricter per-route limits on auth endpoints (login, register, password reset) using `@Throttle()`. Skip throttling on internal or health-check routes with `@SkipThrottle()`.

```ts
// Global default — 100 req / minute
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])

// Stricter on auth routes
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post("login")
login(@Body() dto: LoginDto) { ... }

// Skip on health check
@SkipThrottle()
@Get("health")
health() { ... }
```

> **Multi-instance deployments need shared storage.** `@nestjs/throttler`'s default storage is in-memory and **per-process**, so behind N replicas a limit of 5 becomes effectively 5×N — the brute-force protection on auth routes silently weakens as you scale. Configure a shared store (`@nest-lab/throttler-storage-redis`) via the `storage` option so counters are global across instances.

- Sanitize and validate all user input via `ValidationPipe`. Never trust request data.
- Use parameterized queries or the ORM at all times. Never interpolate user input into SQL.
- Rotate JWT secrets and never commit secrets to version control. Use environment variables or a secrets manager.
- Set CORS policy explicitly in `main.ts`. Do not use `origin: "*"` in production.

```ts
// main.ts — helmet must come first
import helmet from "helmet";

app.use(helmet());
const allowedOrigins = app.get(ConfigService).get<string[]>("cors.allowedOrigins") ?? [];
app.enableCors({ origin: allowedOrigins });
```

> Always read CORS origins from `ConfigService`, not directly from `process.env`. If `ALLOWED_ORIGINS` is missing from `.env`, `process.env.ALLOWED_ORIGINS?.split(",")` silently returns `undefined`, which NestJS/Express treats as allowing all origins. Registering it in the config factory ensures it is validated at startup and fails fast when absent.

---

## Swagger / OpenAPI

- Use `@nestjs/swagger` to generate interactive API documentation from decorators. It is the standard way to document NestJS APIs.

```bash
npm install @nestjs/swagger
```

```ts
// main.ts
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const config = new DocumentBuilder()
  .setTitle("API")
  .setDescription("API description")
  .setVersion("1.0")
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api/docs", app, document);
```

- Annotate DTOs with `@ApiProperty()` so request/response shapes appear in the docs.

```ts
export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "securePassword123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
```

- Declare a **response DTO** as the documented wire shape. This class is what `@ApiResponse({ type })` emits into the OpenAPI schema and what the frontend generates its `components["schemas"]["UserResponseDto"]` type from — so it must list exactly the fields the client receives (no `passwordHash`):

```ts
// dto/user-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: "user@example.com" }) email: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() createdAt: Date;
}
```

- Use `@ApiResponse()` on controller methods to document possible status codes. The runtime return type stays `UserDocument` (serialized by `ClassSerializerInterceptor`); `type: UserResponseDto` documents the shape:

```ts
@ApiResponse({ status: 201, description: "User created.", type: UserResponseDto })
@ApiResponse({ status: 409, description: "Email already in use." })
@Post()
createUser(@Body() dto: CreateUserDto): Promise<UserDocument> { ... }
```

- Protect the docs endpoint in production — either disable it (`if (env !== "production")`) or guard it behind basic auth.
- The raw OpenAPI JSON is served at `/api/docs-json` automatically. This spec is the **source of truth for the frontend API client** (see the frontend "Generated API Types" section) — keep `@ApiProperty()`, DTO types, and `@ApiResponse()` accurate so generated frontend types match runtime behaviour.
- Use `@ApiBearerAuth()` on controllers or routes that require JWT so the docs UI can send the `Authorization` header.

---

## Health Checks

- Use `@nestjs/terminus` to expose a `/health` endpoint. This is required for Kubernetes liveness/readiness probes and load balancer health checks.

```bash
npm install @nestjs/terminus
```

```ts
// health/health.module.ts
import { TerminusModule } from "@nestjs/terminus";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

```ts
// health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "@/common/decorators/public.decorator";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @SkipThrottle()
  check() {
    return this.health.check([
      () => this.db.pingCheck("mongodb"),
    ]);
  }
}
```

- Add additional indicators as needed: `HttpHealthIndicator` for downstream APIs, `MemoryHealthIndicator` for heap limits, `DiskHealthIndicator` for disk usage.
- The health endpoint must be public — exclude it from JWT guard with `@Public()`.
- Respond with `200` when healthy, `503` when any indicator fails — Terminus handles this automatically.

---

## Graceful Shutdown

- Enable shutdown hooks so NestJS can clean up open connections (database, Redis, queues) when the process receives `SIGTERM` or `SIGINT`. Without this, Kubernetes pod termination can interrupt in-flight requests.

```ts
// main.ts
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(3000);
```

- Implement `OnModuleDestroy` on services that hold long-lived connections:

```ts
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.connection.close();
  }
}
```

- Set a termination grace period in Kubernetes (`terminationGracePeriodSeconds`) that is longer than your slowest request. 30 seconds is a safe default.
- Use `SIGTERM` as the shutdown signal in Docker: `CMD ["node", "dist/main.js"]` (not `npm start`) so Node receives the signal directly, not via an npm wrapper that may not forward it.

---

## Email Service

Never send email synchronously. Always enqueue via BullMQ. Send through a **provider-agnostic SMTP transport** so Resend, Brevo, or Google/Workspace are interchangeable by configuration — never by code.

> Email is sent **only from the backend** — the SMTP credentials (`MAIL_*`) never reach the frontend. The client merely calls an endpoint that enqueues a job. Rationale: [ADR-009](./DECISIONS.md).

```bash
npm install @nestjs/bullmq bullmq ioredis nodemailer @react-email/render
npm install -D @types/nodemailer
```

```ts
// queue/queue.constants.ts
export const QUEUES = {
  MAIL: "mail",
  NOTIFICATIONS: "notifications",
  REPORTS: "reports",
} as const;
```

```ts
// app.module.ts — global BullMQ registration
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: { url: config.get<string>("redis.url") },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  }),
})
```

### Provider port

The rest of the app depends on this interface, not on any provider. Swapping transports never touches the service or processor.

```ts
// mail/mail-provider.interface.ts
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol("MAIL_PROVIDER");
```

```ts
// mail/smtp-mail.provider.ts — one transport for Resend / Brevo / Google
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const port = this.config.get<number>("mail.port")!;
    this.from = this.config.get<string>("mail.from")!;
    this.transport = createTransport({
      host: this.config.get<string>("mail.host"),
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: {
        user: this.config.get<string>("mail.user"),
        pass: this.config.get<string>("mail.pass"),
      },
    });
  }

  async send({ to, subject, html }: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject, html });
  }
}
```

```ts
// mail/mail.module.ts — the single line that picks the transport
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.MAIL })],
  providers: [
    MailService,
    MailProcessor,
    { provide: MAIL_PROVIDER, useClass: SmtpMailProvider },
  ],
  exports: [MailService],
})
export class MailModule {}
```

### Service & processor

```ts
// mail/mail.service.ts — enqueues, never sends directly
@Injectable()
export class MailService {
  constructor(@InjectQueue(QUEUES.MAIL) private readonly mailQueue: Queue) {}

  async sendWelcome(to: string, name: string) {
    await this.mailQueue.add("welcome", { to, name });
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    await this.mailQueue.add("password-reset", { to, resetUrl });
  }

  async sendVerifyEmail(to: string, verifyUrl: string) {
    await this.mailQueue.add("verify-email", { to, verifyUrl });
  }
}
```

```ts
// mail/mail.processor.ts — renders templates, delegates sending to the injected provider
@Processor(QUEUES.MAIL)
export class MailProcessor extends WorkerHost {
  constructor(@Inject(MAIL_PROVIDER) private readonly mail: MailProvider) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case "welcome":        return this.sendWelcome(job.data);
      case "password-reset": return this.sendPasswordReset(job.data);
      case "verify-email":   return this.sendVerifyEmail(job.data);
      default: throw new Error(`Unknown mail job: ${job.name}`);
    }
  }

  private async sendWelcome({ to, name }: { to: string; name: string }) {
    const html = await render(WelcomeEmail({ name }));
    await this.mail.send({ to, subject: "Welcome", html });
  }
}
```

### Switching provider (env only)

All three are standard SMTP — change credentials, not code:

| Provider | `MAIL_HOST` | `MAIL_PORT` | `MAIL_USER` | `MAIL_PASS` |
|---|---|---|---|---|
| Resend | `smtp.resend.com` | `587` | `resend` | Resend API key |
| Brevo | `smtp-relay.brevo.com` | `587` | Brevo SMTP login | Brevo SMTP key |
| Google Workspace | `smtp.gmail.com` | `587` | your address | app password |

> To use a provider's **native API** features (tags, idempotency keys, batch send), write an API-based `MailProvider` (e.g. `ResendMailProvider` using the `resend` SDK) and change the single `useClass` binding in `mail.module.ts`. Nothing else changes.

Email templates live in `mail/templates/` as React Email components (`WelcomeEmail.tsx`, `PasswordResetEmail.tsx`, `VerifyEmailEmail.tsx`) — rendered to HTML with `render()`, transport-agnostic.

---

## Queues & Background Jobs

```ts
// Fire and forget
await queue.add("job-name", data);

// Delayed (e.g. follow-up email 24h after signup)
await queue.add("follow-up", data, { delay: 24 * 60 * 60 * 1000 });

// Priority (1 = highest)
await queue.add("urgent", data, { priority: 1 });

// Repeatable (survives restarts, distributed-safe)
await queue.add("daily-digest", {}, { repeat: { pattern: "0 8 * * *" } });
```

Add **Bull Board** for a queue dashboard in non-production environments:

```ts
BullBoardModule.forRoot({ route: "/queues", adapter: ExpressAdapter }),
BullBoardModule.forFeature({ name: QUEUES.MAIL, adapter: BullMQAdapter }),
```

Protect `/queues` behind a guard so it is never exposed in production.

---

## Scheduled Jobs

```bash
npm install @nestjs/schedule redlock
```

```ts
// scheduler/scheduler.service.ts
import { Logger } from "@nestjs/common";
import Redlock, { type Lock } from "redlock";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private redlock: Redlock;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redlock = new Redlock([redis], { retryCount: 0 });
  }

  @Cron("0 2 * * *") // 2 am daily
  async purgeExpiredTokens() {
    let lock: Lock | undefined;
    try {
      lock = await this.redlock.acquire(["lock:purge-tokens"], 30_000);
      await this.authService.purgeExpiredRefreshTokens();
    } catch (err) {
      if (lock === undefined) {
        // Lock contention — another instance is running this job. Skip silently.
      } else {
        // Job failed after acquiring the lock.
        this.logger.error("purgeExpiredTokens failed", err);
      }
    } finally {
      await lock?.release().catch(() => undefined);
    }
  }
}
```

Use Redlock on every `@Cron` job when running multiple instances — without it, all instances execute the job simultaneously. If a job can fail and needs retry, use a BullMQ repeatable job instead.

---

## File Storage — Cloudflare R2

R2 is S3-compatible with zero egress fees. Use the AWS SDK with a custom endpoint.

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```ts
// files/r2.client.ts
export function createR2Client(config: ConfigService): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.get("r2.accountId")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.get("r2.accessKeyId"),
      secretAccessKey: config.get("r2.secretAccessKey"),
    },
  });
}
```

```ts
// files/files.service.ts
@Injectable()
export class FilesService {
  private r2: S3Client;

  constructor(private readonly config: ConfigService) {
    this.r2 = createR2Client(config);
  }

  async getPresignedUploadUrl(userId: string, filename: string, contentType: string) {
    const ext = filename.split(".").pop();
    const key = `uploads/${userId}/${Date.now()}.${ext}`;
    const url = await getSignedUrl(
      this.r2,
      new PutObjectCommand({ Bucket: this.config.get("r2.bucket"), Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { uploadUrl: url, key };
  }

  getPublicUrl(key: string): string {
    return `${this.config.get("r2.publicUrl")}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.r2.send(new DeleteObjectCommand({ Bucket: this.config.get("r2.bucket"), Key: key }));
  }
}
```

**Rules:**
- Always use presigned URLs — never proxy file bytes through NestJS
- Store only the `key` in the database, never the full URL
- Validate MIME type from magic bytes (`file-type` package), not the `Content-Type` header
- Serve assets via an R2 custom domain — never expose the raw `*.r2.cloudflarestorage.com` URL
- Delete the R2 object when the DB record is deleted

---

## Bot Protection — Cloudflare Turnstile

Apply to login, register, password reset, and any public form endpoint. Use **invisible** widget type (set in Cloudflare dashboard) — no user interaction required.

```ts
// common/turnstile/turnstile.service.ts
@Injectable()
export class TurnstileService {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    const body = new URLSearchParams({
      secret: this.config.get<string>("turnstile.secretKey")!,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json();
    return data.success === true;
  }
}
```

```ts
// common/guards/turnstile.guard.ts
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.body as any)?.turnstileToken;
    if (!token) throw new BadRequestException("Turnstile token required");
    const ip = req.headers["cf-connecting-ip"] as string | undefined;
    const valid = await this.turnstile.verify(token, ip);
    if (!valid) throw new BadRequestException("Turnstile verification failed");
    return true;
  }
}
```

```ts
// Apply to public auth endpoints
@UseGuards(TurnstileGuard)
@Post("register")
register(@Body() dto: RegisterDto) { ... }

@UseGuards(TurnstileGuard)
@Post("login")
login(@Body() dto: LoginDto) { ... }

@UseGuards(TurnstileGuard)
@Post("forgot-password")
forgotPassword(@Body() dto: ForgotPasswordDto) { ... }
```

Add `turnstileToken: string` with `@IsString() @IsNotEmpty()` to every affected DTO.

> Test secret key (always passes): `1x0000000000000000000000000000000AA`. Use it in `.env.test` and CI — never mock Turnstile verification in tests.

---

## Analytics — PostHog

Track server-side events that should not be exposed to the client (signups, purchases, job completions).

```bash
npm install posthog-node
```

```ts
// analytics/analytics.service.ts
@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private client: PostHog;

  constructor(private readonly config: ConfigService) {
    this.client = new PostHog(config.get<string>("posthog.key")!, {
      host: config.get("posthog.host") ?? "https://us.i.posthog.com", // ingestion host, not app.posthog.com (EU: https://eu.i.posthog.com)
      flushAt: 20,
      flushInterval: 10_000,
    });
  }

  capture(distinctId: string, event: string, properties?: Record<string, unknown>) {
    this.client.capture({ distinctId, event, properties });
  }

  async onModuleDestroy() {
    await this.client.shutdown(); // flush remaining events before process exits
  }
}
```

```ts
// Usage — track meaningful business events from services
async create(dto: CreateUserDto) {
  const user = await this.userModel.create(dto);
  this.analytics.capture(user.id, "user_signed_up", { role: user.role });
  await this.mailService.sendWelcome(user.email, user.name);
  return user;
}
```

Always call `client.shutdown()` in `onModuleDestroy` — PostHog batches events and a process exit without flushing loses the last batch.

---

## Notifications — SSE

Server-Sent Events: unidirectional (server → client), HTTP/1.1, auto-reconnects. Use Redis pub/sub so any instance can push to any connected client.

```ts
// notifications/notifications.service.ts
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private events$ = new Subject<{ userId: string; type: string; payload: unknown }>();

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRedis() private readonly sub: Redis,
  ) {}

  async onModuleInit() {
    await this.sub.subscribe("notifications");
    this.sub.on("message", (_, msg) => this.events$.next(JSON.parse(msg)));
  }

  async onModuleDestroy() {
    await this.sub.unsubscribe("notifications");
  }

  async publish(userId: string, type: string, payload: unknown) {
    await this.redis.publish("notifications", JSON.stringify({ userId, type, payload }));
  }

  subscribe(userId: string): Observable<MessageEvent> {
    return this.events$.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: { type: e.type, payload: e.payload } }) as MessageEvent),
    );
  }
}
```

The stream itself can't be protected by the normal JWT guard: browsers' `EventSource` can't send an `Authorization` header. **Do not work around this by accepting the access token in the query string** — URLs leak into access logs and history. Instead issue a **short-lived, single-use ticket** from a normally-authenticated endpoint, and authenticate the stream with that ticket.

```ts
// notifications/sse-ticket.service.ts — mint & redeem one-time tickets in Redis
@Injectable()
export class SseTicketService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async issue(userId: string): Promise<string> {
    const ticket = randomUUID();
    await this.redis.set(`sse:ticket:${ticket}`, userId, "EX", 30); // 30s TTL
    return ticket;
  }

  async redeem(ticket: string): Promise<string> {
    // GETDEL is atomic — a ticket can be consumed exactly once.
    const userId = await this.redis.getdel(`sse:ticket:${ticket}`);
    if (!userId) throw new UnauthorizedException("Invalid or expired SSE ticket");
    return userId;
  }
}
```

```ts
// notifications/notifications.controller.ts
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly tickets: SseTicketService,
  ) {}

  // Normal JWT guard applies (header-authenticated via the frontend apiClient).
  @Post("ticket")
  issueTicket(@CurrentUser() user: JwtPayload): Promise<{ ticket: string }> {
    return this.tickets.issue(user.sub).then((ticket) => ({ ticket }));
  }

  // Public to the JWT guard (@Public) — authenticated by the one-time ticket instead.
  @Public()
  @Sse("stream")
  async stream(@Query("ticket") ticket: string): Promise<Observable<MessageEvent>> {
    const userId = await this.tickets.redeem(ticket);
    return this.notifications.subscribe(userId);
  }
}
```

Because `redeem` consumes the ticket atomically (`GETDEL`), every ticket works for exactly one connection. The browser's native `EventSource` auto-reconnect re-requests the same `?ticket=` URL, so it would hit a `401` loop after the first drop — the client must instead detect the drop, request a **fresh** ticket via `POST /notifications/ticket`, and open a new stream (see the frontend `useNotifications` hook). This is the deliberate trade-off for single-use tickets: stronger replay protection in exchange for client-managed reconnection.

Publish from any service:

```ts
await this.notificationsService.publish(userId, "report.ready", { downloadUrl });
```

---

## API Response Shape & Pagination

Every endpoint returns a predictable shape so clients never special-case per route.

- **Single resource** → return the resource directly (serialized by `ClassSerializerInterceptor`).
- **Collection** → return `{ data, meta }`, where `meta` carries pagination state.
- **Error** → the shape produced by the global `HttpExceptionFilter` (`statusCode`, `message`, `timestamp`). Never invent ad-hoc error bodies.

### Pagination contract

Accept pagination through query params with one shared DTO. Defaults: `page=1`, `limit=20`; hard-cap `limit ≤ 100` so a client can never request an unbounded page.

```
GET /users?page=2&limit=20&sort=createdAt&order=desc
```

```ts
// common/dto/pagination-query.dto.ts
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @IsString()
  @IsOptional()
  sort: string = "createdAt";

  @IsIn(["asc", "desc"])
  @IsOptional()
  order: "asc" | "desc" = "desc";
}
```

```ts
// common/interfaces/paginated.interface.ts
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

```ts
// service — build the envelope once; count and page in parallel
async findAll(query: PaginationQueryDto): Promise<Paginated<UserDocument>> {
  const { page, limit, sort, order } = query;
  const [data, total] = await Promise.all([
    this.userModel
      .find()
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    this.userModel.countDocuments().exec(),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

> The PostgreSQL variant uses the same DTO with `findAndCount` + `take`/`skip` (see `BEST-PRACTICES-POSTGRESQL.md`). The frontend mirrors `Paginated<T>` — or, better, generates its types from this API's OpenAPI spec.

---

## Idempotency

A client that retries a `POST` after a timeout (or a flaky network) must not create a duplicate resource or charge a card twice. Make state-changing, non-idempotent endpoints **safe to retry** with an idempotency key — the standard pattern for payments, signups, and order creation.

- The client sends a unique `Idempotency-Key` header (a UUID) per logical operation. Retries reuse the **same** key.
- The server stores the key with the result; a repeat with the same key returns the stored response instead of re-executing.

```ts
// common/interceptors/idempotency.interceptor.ts — sketch
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers["idempotency-key"] as string | undefined;
    if (!key || req.method !== "POST") return next.handle();

    // Scope per user + route so one client can't replay another's response.
    const cacheKey = `idem:${req.user?.sub ?? "anon"}:${req.route?.path}:${key}`;

    const cached = await this.redis.get(cacheKey);
    if (cached === PROCESSING) {
      throw new ConflictException("Request with this Idempotency-Key is still in flight");
    }
    if (cached) return of(JSON.parse(cached)); // replay stored response

    // Atomically claim the key: SET NX fails if another retry already claimed it.
    const claimed = await this.redis.set(cacheKey, PROCESSING, "EX", 86_400, "NX");
    if (claimed !== "OK") {
      throw new ConflictException("Request with this Idempotency-Key is still in flight");
    }

    return next.handle().pipe(
      // Overwrite the "processing" marker with the real response on success...
      tap((body) => this.redis.set(cacheKey, JSON.stringify(body), "EX", 86_400)),
      // ...and release the claim on failure so a genuine retry can proceed.
      catchError((err) => this.redis.del(cacheKey).then(() => { throw err; })),
    );
  }
}
// const PROCESSING = "__processing__";
```

- Scope keys per user/route so one client can't replay another's response (shown above via `req.user.sub` + route path).
- Set a TTL (24h is typical) — keys are short-lived retry guards, not permanent history.
- The `SET … NX` claim above closes the race where two retries arrive before the first finishes: the loser gets `409 Conflict`, and the claim is released on failure so a genuine later retry can still succeed. (One nuance left out of the sketch: `tap` fires per emitted value — for a single-response handler that's exactly once, but if you adapt it to streams, store only the final response.)
- This complements, but does not replace, a unique DB constraint (e.g. `unique` on `email`) — the constraint is the last line of defence.

---

## Observability — Error Tracking

Structured logging records *what happened*; error tracking captures *unhandled failures with full context* (stack, request, release) and alerts on them. Use **Sentry**.

```bash
npm install @sentry/nestjs
```

```ts
// instrument.ts
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Config-driven, not hardcoded — tune per environment via SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  beforeSend(event, hint) {
    // Don't report expected client errors (4xx) — only unexpected failures.
    const status = (hint.originalException as { status?: number })?.status;
    return status && status < 500 ? null : event;
  },
});
```

```ts
// main.ts — must be the FIRST import so Sentry instruments everything
import "./instrument";
import { NestFactory } from "@nestjs/core";
```

- Register `SentryModule.forRoot()` in `AppModule`, **and** register `SentryGlobalFilter` via `APP_FILTER` — `Sentry.init` alone instruments the runtime but does not capture exceptions handled inside Nest's request lifecycle. Per Sentry's NestJS guide, `SentryGlobalFilter` must be registered **before** any other exception filter in the providers array; it reports the error and then delegates to the next filter, so your `HttpExceptionFilter` still owns the client-facing response shape.

```ts
// app.module.ts
providers: [
  { provide: APP_FILTER, useClass: SentryGlobalFilter }, // first — reports to Sentry, then delegates
  { provide: APP_FILTER, useClass: HttpExceptionFilter }, // shapes the client-facing response
],
```
- Never send PII — leave `sendDefaultPii: false` (the default). Scrub tokens, passwords, and emails from breadcrumbs and request bodies.
- `SENTRY_DSN` is environment config like any other — load it through `ConfigService` and list it in `.env.example`.
- For cross-service request tracing, add OpenTelemetry — `@sentry/nestjs` integrates with it. Optional until you run more than one service.

---

## Dependency Isolation

Every swappable third-party integration lives behind a NestJS provider (a service, or an injected port). Controllers and other services depend on the wrapper, never the SDK — so replacing the underlying package touches one file.

| Concern | Wrapper (depend on this) | Package hidden behind it |
|---|---|---|
| Email | `MailProvider` / `SmtpMailProvider` | `nodemailer` (Resend/Brevo/Google) |
| File storage | `FilesService` | `@aws-sdk/client-s3` |
| Server analytics | `AnalyticsService` | `posthog-node` |
| Bot check | `TurnstileService` | Cloudflare HTTP API |
| Cache | `CacheModule` factory | Keyv / Redis |
| Config & secrets | `ConfigService` | `process.env` |

> **The persistence library is deliberately *not* behind a port.** Services inject the Mongoose `Model` / TypeORM `Repository` directly — swapping Mongoose↔TypeORM is a documented stack migration (you change the whole `BEST-PRACTICES` variant), not a runtime swap, so an abstraction over it would be premature indirection. If a project genuinely needs storage-engine independence, introduce a repository interface + token then — not by default.

**Rules:**
- Never instantiate an SDK client outside its provider. Never read `process.env` outside the config factory.
- When more than one implementation is realistic, inject an **interface + token** (like `MAIL_PROVIDER`) so the binding is a one-line change and the dependency is trivially mockable in tests.
- **Do not over-wrap.** This applies to libraries with a real chance of replacement (email, storage, analytics, payments, SMS). Wrapping the framework itself or a dependency you will never swap (the ORM, the DI container) is premature indirection — it adds cost for no benefit.
