# Backend Best Practices

> Stack: NestJS

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
10. [TypeScript Standards](#typescript-standards)
11. [Testing](#testing)
12. [Performance & Security](#performance--security)

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

- Register global pipes, filters, and interceptors in `main.ts` using `app.useGlobalXxx()`, not by decorating `AppModule`.

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

    const user = this.userRepo.create(dto);
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
  }),
);
```

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
- Use `@Exclude()` and `@Expose()` from `class-transformer` on response DTOs to control what is serialized. Enable `ClassSerializerInterceptor` globally.

```ts
// entities/user.entity.ts
import { Exclude } from "class-transformer";

export class User {
  id: string;
  email: string;

  @Exclude()
  password: string;
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

- Use `@nestjs/passport` with `passport-jwt` for JWT-based authentication.
- Store only non-sensitive data in the JWT payload (user ID, role). Never store passwords or PII.
- Short-lived access tokens (15 min). Use refresh tokens stored server-side (DB or Redis) for re-issuance.
- Hash passwords with `bcrypt` (min cost factor 12). Never store plaintext passwords or use weak hashing (MD5, SHA1).

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

- Apply `JwtAuthGuard` globally. Use `@Public()` decorator on routes that are intentionally unauthenticated.

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
          : (exceptionResponse as any).message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- Log unexpected errors (5xx) with full stack traces. Do not log 4xx errors as errors — they are expected client mistakes.
- Never leak stack traces or internal error details to API responses in production.

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
});
```

- Validate environment variables at startup using `Joi` or `class-validator` schema in `ConfigModule.forRoot({ validationSchema })`. Fail fast on missing required variables.
- Inject config via `ConfigService`:

```ts
constructor(private readonly config: ConfigService) {}

const secret = this.config.get<string>("jwt.secret");
```

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
- Cache expensive, rarely-changing reads with Redis via `@nestjs/cache-manager`.

### Security

- Enable `helmet` for HTTP security headers.
- Enable `throttler` (`@nestjs/throttler`) to rate-limit public endpoints.
- Sanitize and validate all user input via `ValidationPipe`. Never trust request data.
- Use parameterized queries or the ORM at all times. Never interpolate user input into SQL.
- Rotate JWT secrets and never commit secrets to version control. Use environment variables or a secrets manager.
- Set CORS policy explicitly in `main.ts`. Do not use `origin: "*"` in production.

```ts
// main.ts
import helmet from "helmet";

app.use(helmet());
app.enableCors({ origin: process.env.ALLOWED_ORIGINS?.split(",") });
```
