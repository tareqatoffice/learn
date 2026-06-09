# Backend Best Practices

> Stack: NestJS v11 · Node.js >= 20 · TypeORM ^0.3 · `@nestjs/typeorm` v11 · `@nestjs/jwt` v11 · `@nestjs/passport` v11

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Modules](#modules)
3. [Controllers](#controllers)
4. [Services](#services)
5. [DTOs & Validation](#dtos--validation)
6. [Database & Repositories](#database--repositories)
7. [Authentication & Authorization](#authentication--authorization)
8. [Error Handling](#error-handling)
9. [Configuration](#configuration)
10. [Logging](#logging)
11. [TypeScript Standards](#typescript-standards)
12. [Testing](#testing)
13. [Performance & Security](#performance--security)

---

## Project Structure

```
src/
├── modules/
│   └── users/
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   └── update-user.dto.ts
│       ├── entities/
│       │   └── user.entity.ts
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
├── database/
│   └── database.module.ts
├── app.module.ts
└── main.ts
```

- One module per domain/feature. Never flatten all files into a single directory.
- Shared cross-cutting concerns (guards, filters, interceptors, decorators) live in `common/`. Never duplicate them across modules.
- Entities belong to the module that owns them, not a global `entities/` folder.

---

## Modules

- Every feature is a NestJS module. Each module is self-contained: it declares its controllers, providers, and explicitly exports what other modules may use.
- Use `forRoot` / `forFeature` patterns for configurable modules (database, config, JWT).
- Avoid circular dependencies. If two modules depend on each other, extract the shared logic into a third module.

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

---

## Controllers

- Controllers handle HTTP only: routing, input extraction, response shaping.
- No business logic in controllers. Delegate everything to the service.
- Always type the return value. Use a DTO or typed interface as the response shape.

```ts
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  getUser(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }
}
```

- Use built-in pipes (`ParseUUIDPipe`, `ParseIntPipe`, `ParseEnumPipe`) for path/query params.
- Use `@HttpCode()` explicitly when the default status code is wrong.
- Apply guards and interceptors at the controller or route level, not globally, when they are route-specific.

---

## Services

- Services contain all business logic. They are the only layer allowed to call repositories, external APIs, or other services.
- Services must not import controllers or anything HTTP-specific (`@Req`, `Request`).
- Keep methods focused. If a service method exceeds 30 lines, extract a private helper or split into a sub-service.

```ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, passwordHash });
    return this.userRepo.save(user);
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

> `disableErrorMessages: true` in production prevents exposing validation field names and constraints to clients.

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
- Use `PartialType` / `OmitType` / `PickType` from `@nestjs/mapped-types` to build update DTOs. Never duplicate property decorators manually.

```ts
// dto/update-user.dto.ts
import { PartialType, OmitType } from "@nestjs/mapped-types";
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

---

## Database & Repositories

- Use TypeORM with the Repository pattern. Never use raw `EntityManager` directly in services unless you need multi-entity transactions.
- Use `Repository<T>` injected via `@InjectRepository(Entity)`.
- Never construct raw SQL strings. Use QueryBuilder or the ORM API.

```ts
// Prefer
const users = await this.userRepo.find({ where: { isActive: true } });

// Over raw SQL
const users = await this.userRepo.query("SELECT * FROM users WHERE is_active = true");
```

- For complex queries, use `createQueryBuilder`. Name all aliases explicitly.
- Wrap multi-step operations in a transaction:

```ts
await this.dataSource.transaction(async (manager) => {
  const user = manager.create(User, dto);
  await manager.save(user);
  await manager.save(AuditLog, { userId: user.id, action: "created" });
});
```

- Never enable `synchronize: true` in production. It auto-aligns the schema with your entities and **can silently drop columns and data**. Use TypeORM migrations for all schema changes in non-development environments.

```ts
TypeOrmModule.forRoot({
  synchronize: process.env.NODE_ENV === "development", // never true in production
  migrations: ["dist/migrations/*.js"],
  migrationsRun: true,
})
```

- Keep entities clean: only persistence concerns (columns, relations, indexes). No business logic in entities.
- Always define explicit column types in entity definitions. Never rely on TypeORM inference for production entities.

```ts
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar" })
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

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
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedException();
    try {
      request.user = await this.jwtService.verifyAsync(token);
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
- Short-lived access tokens (15 min). Use refresh tokens stored server-side (DB or Redis) for re-issuance.
- Hash passwords with `bcrypt` (min cost factor 12). Never store plaintext passwords or use weak hashing (MD5, SHA1). Always use the async form — `bcrypt.hash()` not `bcrypt.hashSync()` — to avoid blocking the event loop.

```ts
const hash = await bcrypt.hash(plaintext, 12);
```

### Authorization

- Use Guards for authorization. Never check roles/permissions inside a service method.
- Define a `@Roles()` decorator and a `RolesGuard` that reads from route metadata.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Delete(":id")
deleteUser(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
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
- Register a global `HttpExceptionFilter` to normalize all error responses.

```ts
// common/filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      message:
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as { message: string | string[] }).message,
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
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    name: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
  },
});
```

- Set `isGlobal: true` on `ConfigModule` so it is available across all feature modules without repeated imports:

```ts
ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema })
```

- Validate environment variables at startup using `Joi` or `class-validator` schema in `ConfigModule.forRoot({ validationSchema })`. Fail fast on missing required variables.
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
- In NestJS v11, `@Inject()` enforces **strict token typing** — injection tokens must be typed as `string`, `symbol`, or a class/abstract class. Raw untyped tokens will produce TypeScript errors. Use `InjectionToken<T>` or typed constants:

```ts
// Use a typed token
export const USER_REPO = Symbol("USER_REPO");

// Or use registerAs() which returns a typed ConfigType key
@Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>
```

---

## Testing

### Unit Tests

- Test services in isolation. Mock all dependencies with `jest.fn()` or `@nestjs/testing`'s `createMock`.
- One `describe` block per service. One `it` per behavior, not per line.

```ts
describe("UsersService", () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  it("throws NotFoundException when user does not exist", async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.findById("non-existent")).rejects.toThrow(NotFoundException);
  });
});
```

### Integration / E2E Tests

- Use `@nestjs/testing` + `supertest` for E2E tests against a real HTTP server.
- Use a separate test database. Never run E2E tests against the development or production database.
- Reset test data between tests with transactions that roll back, or by truncating tables in `afterEach`.

### Rules

- Do not test NestJS internals (routing, DI wiring). Test your code's behavior.
- Test all happy paths and all explicitly handled error paths.
- Name tests as readable sentences: `it("returns 404 when user is not found")`.

---

## Performance & Security

### Performance

- Use indexes on all columns used in `WHERE`, `JOIN`, or `ORDER BY` clauses.
- Paginate all list endpoints. Never return an unbounded list from the database.
- Use `select` in TypeORM queries to fetch only required columns for list endpoints.
- Cache expensive, rarely-changing reads with `@nestjs/cache-manager` v3+. This version uses **Keyv** under the hood — the old `store` adapter pattern is gone. Redis setup:

```ts
// npm install @nestjs/cache-manager @keyv/redis cacheable-memory

CacheModule.registerAsync({
  isGlobal: true,
  useFactory: () => ({
    stores: [
      new Keyv({ store: new KeyvCacheableMemory({ ttl: 60_000, lruSize: 5000 }) }),
      new KeyvRedis(process.env.REDIS_URL),
    ],
  }),
})
```

The first store is primary (in-memory), the second is fallback (Redis). For in-memory-only caching, omit the `KeyvRedis` entry.

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
