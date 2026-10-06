# The NestJS Interview Guide

**A progressive question bank with full explanations — Beginner → Intermediate → Advanced**

---

## How to use this guide

Each question follows the same structure:

- **Short answer** — what you actually say out loud in the first 20 seconds.
- **Full explanation** — the reasoning behind it, so you can defend the answer.
- **Code** — the minimum snippet that proves you've written this before.
- **Interviewer's angle** — what they're really testing, and the follow-up they'll ask next.

Don't memorise the short answers. Interviewers can tell. Read the explanation until you could re-derive the short answer yourself.

**Contents**

- Part 1 — Foundations (Q1–Q20)
- Part 2 — Working knowledge (Q21–Q42)
- Part 3 — Architecture and depth (Q43–Q65)
- Part 4 — System design and behavioural rounds
- Part 5 — Rapid-fire and a 7-day prep plan

---

# Part 1 — Foundations

*Expect these in a screening call or the first 15 minutes of a technical round. Getting one wrong here usually ends the interview, so over-prepare this section.*

---

## Q1. What is NestJS and what problem does it solve?

**Short answer**
NestJS is a Node.js server-side framework built on TypeScript that provides an opinionated, modular architecture out of the box. It solves the "empty Express project" problem — Express gives you routing and nothing else, so every team invents its own folder structure, DI approach, and testing strategy. Nest standardises that.

**Full explanation**

Express and Fastify are HTTP libraries. They're deliberately unopinionated: no prescribed structure, no dependency injection, no built-in validation layer, no first-class testing story. That's fine for a 300-line service. It falls apart on a 50-file codebase with six developers, because architectural decisions get made ad hoc and inconsistently.

Nest sits **on top of** Express (by default) or Fastify (optional adapter) and adds:

- A **module system** for organising features into cohesive, encapsulated units.
- A **dependency injection container**, so classes declare what they need instead of importing concrete instances.
- **Decorator-based metadata** (`@Controller`, `@Get`, `@Injectable`) that keeps routing declarations next to the code they route to.
- A defined **request lifecycle** with standard extension points — middleware, guards, interceptors, pipes, filters.
- Built-in support for testing, config, validation, OpenAPI, microservices, GraphQL, and WebSockets.

The design is openly borrowed from Angular, which is why it feels familiar to front-end developers and slightly alien to people coming straight from Express.

The trade-off is worth naming in an interview: Nest costs you a learning curve and some boilerplate, and it adds a layer of abstraction over the underlying HTTP library. You accept that in exchange for consistency across a team and across time.

**Interviewer's angle**
They want to hear that you chose Nest for a reason, not because it was trending. A strong follow-up is "when would you *not* use Nest?" — good answers: a tiny single-purpose microservice, a serverless function with cold-start sensitivity, or a team with no TypeScript experience and a two-week deadline.

---

## Q2. What are the three core building blocks of a Nest application?

**Short answer**
Modules, controllers, and providers.

**Full explanation**

- **Module** — an organisational unit. It declares which controllers it exposes, which providers it instantiates, what it imports from other modules, and what it exports for others to use. Every app has at least a root `AppModule`.
- **Controller** — handles incoming requests. It maps routes to handler methods, extracts data from the request, and returns a response. Controllers should be thin: parse, delegate, return.
- **Provider** — anything that can be injected. Usually a service holding business logic, but also repositories, factories, helpers, and third-party clients.

The mental model: a **module** is the box, **controllers** are the doors into the box, **providers** are the machinery inside it.

```ts
// users.service.ts
@Injectable()
export class UsersService {
  private readonly users: User[] = [];
  findAll(): User[] {
    return this.users;
  }
}

// users.controller.ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): User[] {
    return this.usersService.findAll();
  }
}

// users.module.ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**Interviewer's angle**
They'll immediately push on the separation: "why not put the database query in the controller?" Answer: testability (you can unit-test the service without an HTTP layer), reuse (a cron job or a message handler can call the same service), and single responsibility.

---

## Q3. What is a decorator, and how does NestJS use them?

**Short answer**
A decorator is a TypeScript function that attaches metadata to a class, method, property, or parameter. Nest reads that metadata at bootstrap time to wire the application together.

**Full explanation**

Decorators aren't magic — they're functions that run once when the class is defined. `@Controller('users')` stores the string `'users'` in a metadata registry keyed to that class, using `Reflect.defineMetadata` from the `reflect-metadata` package. At startup, Nest scans every class you registered, reads the metadata, and builds the routing table and DI graph.

That's why `reflect-metadata` is imported at the top of `main.ts` in older setups, and why `emitDecoratorMetadata` and `experimentalDecorators` must be `true` in `tsconfig.json`. Without `emitDecoratorMetadata`, TypeScript won't emit constructor parameter types, and DI by type resolution breaks.

Categories of Nest decorator:

| Category | Examples |
|---|---|
| Class | `@Module`, `@Controller`, `@Injectable`, `@Catch` |
| Method | `@Get`, `@Post`, `@UseGuards`, `@HttpCode` |
| Parameter | `@Body`, `@Param`, `@Query`, `@Req`, `@Headers` |
| Property | `@InjectRepository`, `@IsString` (class-validator) |

**Interviewer's angle**
The follow-up is usually "write a custom decorator." Have `@CurrentUser()` ready — it appears in Q34.

---

## Q4. Explain dependency injection in NestJS.

**Short answer**
Instead of a class creating its own dependencies, it declares them as constructor parameters and Nest's IoC container supplies them at runtime. Nest resolves them by type, using metadata TypeScript emits about constructor parameters.

**Full explanation**

Compare the two styles:

```ts
// Without DI — tightly coupled
export class UsersService {
  private db = new PostgresConnection('localhost:5432'); // hardcoded
}

// With DI — the dependency is declared, not constructed
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseConnection) {}
}
```

The second version can be tested by passing a mock `DatabaseConnection`, and swapped for a different implementation without touching the class.

The mechanics:

1. `@Injectable()` marks the class so Nest emits and stores its constructor parameter types.
2. You list the class in a module's `providers` array. This registers it in that module's injector.
3. When something needs `UsersService`, Nest looks up the token (the class itself, by default), finds or creates the instance, and injects it.
4. By default, instances are **singletons** scoped to the application — the same instance is shared everywhere.

For non-class dependencies (a config object, a string), the type can't be used as a token, so you use a string or symbol token with `@Inject`:

```ts
@Injectable()
export class MailService {
  constructor(@Inject('MAIL_CONFIG') private config: MailConfig) {}
}
```

**Interviewer's angle**
Common trap: "what happens if you forget to add a service to `providers`?" Answer: Nest throws a `Nest can't resolve dependencies of the X` error at bootstrap, listing the unresolved parameter index. That error message is worth recognising on sight — the `?` in the argument list marks the parameter it couldn't resolve.

---

## Q5. What is the purpose of `main.ts`?

**Short answer**
It's the entry point. It creates the Nest application instance from the root module, applies global configuration, and starts listening.

**Full explanation**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN });
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

`NestFactory.create()` walks the module graph starting at `AppModule`, instantiates every provider, builds the router, and returns an application object. Nothing is listening yet — `listen()` does that.

Things that belong here: global prefix, global pipes/filters/interceptors that need no DI, CORS, helmet, Swagger setup, shutdown hooks, body size limits.

One nuance worth mentioning: globals registered in `main.ts` with `new ValidationPipe()` are created **outside** the DI container, so they can't inject anything. If your global pipe or filter needs a service, register it as a provider with `APP_PIPE` instead (Q38).

**Interviewer's angle**
They may ask why `bootstrap` is async. Because `NestFactory.create` resolves async providers and module initialisation hooks, both of which return promises.

---

## Q6. How does routing work in NestJS?

**Short answer**
The path in `@Controller()` is the prefix, the path in the method decorator is the suffix, and Nest concatenates them into the final route.

**Full explanation**

```ts
@Controller('users')          // → /users
export class UsersController {
  @Get()                      // → GET /users
  findAll() {}

  @Get(':id')                 // → GET /users/:id
  findOne(@Param('id') id: string) {}

  @Get('active')              // → GET /users/active
  findActive() {}

  @Post()                     // → POST /users
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {}

  @Patch(':id')               // → PATCH /users/:id
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {}

  @Delete(':id')              // → DELETE /users/:id
  remove(@Param('id') id: string) {}
}
```

**The ordering gotcha, which interviewers love:** routes are matched in declaration order. If `@Get(':id')` is declared before `@Get('active')`, a request to `/users/active` matches the parameterised route with `id = 'active'`, and the `findActive` handler is never reached. Static segments must be declared before dynamic ones.

Default status codes: `200` for everything except `POST`, which is `201`. Override with `@HttpCode()`.

Wildcards (`@Get('ab*cd')`) exist but are rarely a good idea in production APIs.

**Interviewer's angle**
The route-ordering trap is a favourite. If they ask "why does `/users/active` return a 404 or a weird result?", that's the answer they're fishing for.

---

## Q7. What is a DTO and why use one?

**Short answer**
A Data Transfer Object defines the shape of data crossing a boundary — typically the request body. In Nest it's a class (not an interface), so it survives compilation and can carry validation decorators.

**Full explanation**

```ts
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  @IsOptional()
  age?: number;
}
```

**Why a class, not an interface?** Interfaces are erased at compile time — they don't exist in the emitted JavaScript. Nest's `ValidationPipe` needs a runtime constructor to inspect metadata against, and `class-validator` decorators need something to attach to. An interface gives you neither.

DTOs buy you four things: a single source of truth for request shape, runtime validation, automatic Swagger schema generation, and type safety in the handler.

Keep DTOs separate from entities. An entity models the database row; a DTO models what a client is allowed to send. Merging them is how you end up letting a client set `isAdmin: true`.

**Interviewer's angle**
"Why not just use an interface?" is asked constantly. The compile-time-erasure answer is the one they want.

---

## Q8. How do you handle validation?

**Short answer**
`ValidationPipe` from `@nestjs/common`, combined with `class-validator` and `class-transformer` decorators on DTOs. Register it globally in `main.ts`.

**Full explanation**

```bash
npm install class-validator class-transformer
```

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,             // strip properties with no decorator
  forbidNonWhitelisted: true,  // or throw 400 if extras are present
  transform: true,             // convert plain object → DTO instance
  transformOptions: {
    enableImplicitConversion: true, // "42" → 42 based on TS type
  },
}));
```

Each option matters:

- **`whitelist`** is a security control. Without it, a client can send `{ name, email, role: 'admin' }` and if you do `repo.save(dto)`, `role` gets persisted. This is mass assignment, and it's a real vulnerability.
- **`forbidNonWhitelisted`** is stricter — instead of silently dropping unknown fields, it rejects the request. Better for internal APIs where a stray field signals a client bug.
- **`transform`** turns the incoming plain object into an actual instance of your DTO class, which matters if the DTO has methods or getters.
- **`enableImplicitConversion`** handles the fact that query params and route params always arrive as strings.

When validation fails, the pipe throws `BadRequestException` with an array of messages, producing a `400` with a structured body. You can override that with a custom `exceptionFactory`.

**Interviewer's angle**
The mass-assignment point is the differentiator. Most candidates say "it validates input." Few mention `whitelist` as a security boundary.

---

## Q9. What's the difference between `@Body`, `@Param`, `@Query`, and `@Req`?

**Short answer**
They extract different parts of the HTTP request: the parsed body, route parameters, query string values, and the raw underlying request object respectively.

**Full explanation**

```ts
// POST /orders/42/items?expand=product&page=2
@Post(':orderId/items')
addItem(
  @Param('orderId', ParseIntPipe) orderId: number,  // 42
  @Query('page', ParseIntPipe) page: number,        // 2
  @Query() allQuery: Record<string, string>,        // { expand, page }
  @Body() dto: AddItemDto,                          // parsed JSON body
  @Headers('authorization') auth: string,
  @Req() req: Request,                              // raw Express request
) {}
```

Called with an argument, they extract one key; called bare, they return the whole object.

**Avoid `@Req()` unless you genuinely need it.** Using it couples your handler to Express, which breaks if you switch to the Fastify adapter, and makes unit testing harder because you must construct a fake request object. The specific decorators are platform-agnostic.

**Interviewer's angle**
Follow-up: "how do you get the authenticated user?" The naive answer is `@Req() req` then `req.user`. The better answer is a custom `@CurrentUser()` decorator (Q34).

---

## Q10. What are pipes and when do they run?

**Short answer**
Pipes transform or validate handler arguments. They run after guards and before the route handler executes.

**Full explanation**

A pipe is a class implementing `PipeTransform`. Its `transform(value, metadata)` method receives the incoming value and returns either the transformed value or throws an exception.

Two jobs:

- **Transformation** — `'42'` → `42`, `'true'` → `true`, string → Date.
- **Validation** — check the value and throw if invalid.

Built-in pipes: `ValidationPipe`, `ParseIntPipe`, `ParseFloatPipe`, `ParseBoolPipe`, `ParseArrayPipe`, `ParseUUIDPipe`, `ParseEnumPipe`, `DefaultValuePipe`, `ParseFilePipe`.

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  // id is guaranteed to be a number here, or a 400 was already thrown
}

@Get()
list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {}
```

A custom pipe:

```ts
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return typeof value === 'string' ? value.trim() : value;
  }
}
```

Binding levels: parameter, method (`@UsePipes()`), controller, or global.

**Interviewer's angle**
The precise ordering question — middleware → guards → interceptors (pre) → pipes → handler — comes up in Part 2 (Q30). Know it cold.

---

## Q11. What are the Nest CLI commands you use most?

**Short answer**
`nest new`, `nest g resource`, `nest g module|controller|service`, `nest start --watch`, `nest build`.

**Full explanation**

```bash
nest new my-app                    # scaffold a project
nest g module users                # module, auto-registered in AppModule
nest g controller users            # controller + spec file
nest g service users               # service + spec file
nest g resource users              # all of the above + DTOs + entity + CRUD
nest g guard auth
nest g pipe validation
nest g mo users --no-spec          # skip test file
nest start --watch                 # dev mode with reload
nest build                         # compile to dist/
```

`nest g resource` is the one that saves real time — it asks whether you want REST, GraphQL, microservice, or WebSocket transport, then generates a complete CRUD skeleton with DTOs.

The CLI also **auto-registers** what it generates. Running `nest g service users` inside the users module adds it to that module's `providers` array. That's a small thing that catches people out when they generate by hand and then get a resolution error.

**Interviewer's angle**
Low-stakes question, usually a warm-up. Don't over-answer it.

---

## Q12. How do you handle errors and exceptions?

**Short answer**
Throw one of Nest's built-in HTTP exceptions. The default global exception filter catches them and formats the response.

**Full explanation**

```ts
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';

async findOne(id: number) {
  const user = await this.repo.findOneBy({ id });
  if (!user) {
    throw new NotFoundException(`User ${id} not found`);
  }
  return user;
}
```

Produces:

```json
{ "statusCode": 404, "message": "User 42 not found", "error": "Not Found" }
```

All of these extend `HttpException`, which takes a response body and a status code. For a status without a dedicated class:

```ts
throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
```

Anything thrown that isn't an `HttpException` — a raw `Error`, a database driver error — is caught by the default filter and returned as a generic `500`, with the real message logged but not exposed. That's the correct default: leaking a Postgres error string to a client tells an attacker your schema.

**Where to throw:** in the service, not the controller. The service knows the business rule was violated; the controller just passes the result along.

**Interviewer's angle**
Follow-up: "what if you need a different error format for a client?" That's a custom exception filter — Q28.

---

## Q13. What is a module, and what do the four `@Module` properties do?

**Short answer**
A module groups related functionality. `imports` brings in other modules, `controllers` registers route handlers, `providers` registers injectables owned by this module, `exports` makes providers available to modules that import this one.

**Full explanation**

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

The critical concept is **encapsulation**. A provider in `providers` is private to that module by default. If `OrdersModule` wants `UsersService`, two things must both be true:

1. `UsersModule` lists `UsersService` in `exports`.
2. `OrdersModule` lists `UsersModule` in `imports`.

Importing a module does **not** give you access to everything inside it — only what it exports. This is the source of the most common beginner error in Nest: "I imported the module, why can't it resolve the service?" Because the service wasn't exported.

Also note: importing a module does not re-export it transitively. If A exports S, B imports A, and C imports B, then C cannot see S unless B also exports A.

**Interviewer's angle**
Ask yourself: can you explain why encapsulation is desirable at all? Because it makes the public surface of a feature explicit, so you can refactor internals without breaking consumers.

---

## Q14. What is a global module and when should you use one?

**Short answer**
`@Global()` makes a module's exported providers available everywhere without importing it. Use it sparingly — config, database, logging.

**Full explanation**

```ts
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

Now any module can inject `ConfigService` without listing `ConfigModule` in its imports.

The trade-off: it's convenient, but it hides dependencies. Reading a module's `imports` array should tell you what it depends on. Global modules break that. Nest's own documentation advises against overusing it, and I'd echo that — if three or four things are global, dependency tracing becomes guesswork.

Register global modules once, in the root module. Registering the same global module twice is a common misconfiguration.

**Interviewer's angle**
This is a judgement question disguised as a syntax question. The right answer includes the caveat, not just the mechanism.

---

## Q15. What's the difference between a service and a provider?

**Short answer**
Every service is a provider. Not every provider is a service. "Provider" is the DI concept; "service" is a conventional name for a provider that holds business logic.

**Full explanation**

A provider is anything registered in a module's `providers` array and resolvable by the injector. That includes:

- Services (`UsersService`)
- Repositories
- Factories
- Value providers (a config object, a constant)
- Third-party clients (a Redis client, an S3 client)
- Guards, interceptors, pipes, and filters when they need injection

The four provider forms:

```ts
providers: [
  UsersService,                                        // shorthand for useClass

  { provide: 'CONFIG', useValue: { retries: 3 } },     // value provider

  { provide: MailService,                              // class provider
    useClass: process.env.NODE_ENV === 'test' ? MockMailService : SmtpMailService },

  { provide: 'DB_CONNECTION',                          // factory provider
    useFactory: async (config: ConfigService) => createConnection(config.get('DB_URL')),
    inject: [ConfigService] },

  { provide: 'ALIAS', useExisting: UsersService },     // alias to an existing provider
]
```

**Interviewer's angle**
Knowing all four forms — especially `useFactory` with `inject` — reads as production experience. Most candidates only know the shorthand.

---

## Q16. How do you connect NestJS to a database?

**Short answer**
Through an ORM integration module. TypeORM and Prisma are the two dominant choices; Mongoose for MongoDB.

**Full explanation**

TypeORM:

```ts
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,   // NEVER true in production
      }),
    }),
  ],
})
export class AppModule {}
```

Then per feature:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
})
export class UsersModule {}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}
}
```

Prisma has no official Nest module, so you wrap the client yourself:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

**`synchronize: true` is the interview landmine.** It auto-alters your schema to match your entities on every boot. In development it's a convenience. In production it silently drops columns and destroys data. Always `false`, always use migrations.

**Interviewer's angle**
If you say "I use TypeORM," expect "how do you handle migrations?" Answer: `typeorm migration:generate` against a datasource file, committed to the repo, run in CI or on deploy — never auto-run from application code without a lock.

---

## Q17. What is the difference between `forRoot`, `forRootAsync`, and `forFeature`?

**Short answer**
`forRoot` configures a module once globally with static values. `forRootAsync` does the same but resolves configuration asynchronously, usually from `ConfigService`. `forFeature` registers scoped resources for one feature module.

**Full explanation**

These are conventions for **dynamic modules** — modules configured by a static method that returns a module definition object.

- `forRoot(options)` — called once in `AppModule`. Sets up the connection, the client, the global config. Returns a module whose providers include the parsed options.
- `forRootAsync(options)` — same, but options come from a `useFactory`, `useClass`, or `useExisting`. Needed whenever configuration depends on something else in the DI container, like environment config loaded at runtime.
- `forFeature(entities)` — called in each feature module. Doesn't create a connection; it registers narrower providers (repositories for these specific entities) into that module's injector.

The same pattern appears in `JwtModule`, `ConfigModule`, `BullModule`, `MongooseModule`, and `CacheModule`. Recognising it means you can read an unfamiliar Nest integration without documentation.

**Interviewer's angle**
Follow-up: "write your own dynamic module." That's Q46.

---

## Q18. How do you manage configuration and environment variables?

**Short answer**
`@nestjs/config`, loaded once in `AppModule` as a global module, with a Joi schema validating the environment at boot.

**Full explanation**

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      load: [databaseConfig, authConfig],
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
      }),
    }),
  ],
})
export class AppModule {}
```

Then inject it:

```ts
constructor(private readonly config: ConfigService) {}
const secret = this.config.get<string>('JWT_SECRET');
```

**Why validate?** Because without a schema, a missing `JWT_SECRET` doesn't fail at boot — it fails at 2am when the first user tries to log in, with a confusing error. Fail fast at startup instead.

**Never** read `process.env` directly inside services. It bypasses validation, can't be mocked in tests, and scatters environment knowledge across the codebase.

Registered config namespaces (`registerAs`) give you typed grouping:

```ts
export default registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
}));
```

**Interviewer's angle**
"How do you keep secrets out of the repo?" — `.env` gitignored, real secrets from a secret manager (AWS Secrets Manager, Vault, Doppler) injected as environment variables at deploy time.

---

## Q19. What are async providers and when do you need them?

**Short answer**
A provider whose `useFactory` returns a promise. Nest awaits it before the application finishes bootstrapping, so nothing receives a half-initialised dependency.

**Full explanation**

```ts
{
  provide: 'DB_CONNECTION',
  useFactory: async (config: ConfigService) => {
    const connection = await createConnection(config.get('DB_URL'));
    await connection.ping();
    return connection;
  },
  inject: [ConfigService],
}
```

The whole application bootstrap blocks until every async provider resolves. That's the point — it guarantees that by the time a request can arrive, connections are live.

The cost is startup time, and a failed async provider crashes the boot. That's usually correct behaviour: a service that can't reach its database shouldn't report itself as ready.

**Interviewer's angle**
Related: how is this different from `OnModuleInit`? Async providers block *creation* of the provider; `OnModuleInit` runs *after* all providers in the module are instantiated. Use the former for constructing a dependency, the latter for work that needs other dependencies present.

---

## Q20. How do you enable CORS, and what does it actually protect?

**Short answer**
`app.enableCors()` in `main.ts`, or `NestFactory.create(AppModule, { cors: true })`. It's a browser-enforced policy controlling which origins may read responses from your API.

**Full explanation**

```ts
app.enableCors({
  origin: ['https://app.example.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,          // required for cookies
  maxAge: 86400,              // cache preflight for a day
});
```

Two clarifications that separate a real answer from a memorised one:

1. **CORS is enforced by browsers, not servers.** curl, Postman, and any server-to-server client ignore it entirely. It is not an access-control mechanism — authentication and authorisation are. CORS stops a malicious website from reading your API's responses using a logged-in user's browser.

2. **`origin: '*'` and `credentials: true` are mutually exclusive.** The spec forbids the combination, and browsers will reject it. If you need cookies, you must enumerate origins.

**Interviewer's angle**
Saying "CORS is a security feature that protects my API from unauthorised access" is the wrong answer and a common one. Being precise here is a genuine signal.

---

# Part 2 — Working knowledge

*This is where most mid-level interviews are won or lost. The questions move from "do you know the syntax" to "do you know when to use which."*

---

## Q21. What is middleware in NestJS?

**Short answer**
A function that runs before the route handler is even matched to a controller. It has access to the raw request and response objects and a `next()` callback — the same contract as Express middleware.

**Full explanation**

```ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  }
}
```

Applied in a module:

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
```

Middleware runs **first** in the lifecycle, before guards. That has a consequence people miss: middleware cannot use `ExecutionContext`, so it has no idea which controller or handler will eventually handle the request. It only sees the raw request.

Use middleware for cross-cutting concerns that are genuinely request-level and framework-agnostic: logging, correlation IDs, helmet, compression, raw body capture for webhook signature verification.

Do **not** use it for authorisation. Guards exist for that and have the context middleware lacks.

**Interviewer's angle**
"Middleware vs interceptor?" is the follow-up. Middleware runs earlier, is Express-shaped, and can't access handler metadata. Interceptors wrap the handler, can see the return value, and work with RxJS.

---

## Q22. What are guards and how do they differ from middleware?

**Short answer**
A guard decides whether a request may proceed to the handler. It returns a boolean (or a promise/observable of one). Unlike middleware, it receives an `ExecutionContext`, so it knows the target class and handler.

**Full explanation**

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();

    try {
      request.user = await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

Returning `false` produces a `403 Forbidden`. If you want a different status or message, throw the exception yourself, as above.

The `Reflector` + metadata pattern is what makes guards powerful. You can decorate a handler with `@Roles('admin')` or `@Public()` and read that inside the guard. Middleware can't do this.

Binding: `@UseGuards()` at method or controller level, or globally via `APP_GUARD`.

**Interviewer's angle**
Almost always followed by "implement role-based access control" — Q23.

---

## Q23. How do you implement role-based authorisation?

**Short answer**
A custom `@Roles()` decorator that sets metadata, plus a `RolesGuard` that reads it with `Reflector` and compares against the authenticated user's roles.

**Full explanation**

```ts
// roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.some((role) => user?.roles?.includes(role));
  }
}

// usage
@Roles(Role.Admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
remove(@Param('id') id: string) {}
```

Order matters: `JwtAuthGuard` must run before `RolesGuard`, because the latter depends on `request.user` being populated. Guards execute in the order listed.

`getAllAndOverride` checks the handler first, then the class, and the handler wins. `getAllAndMerge` combines both instead. Choosing between them is a real design decision — override for "this endpoint is an exception to the controller default," merge for additive permissions.

**Interviewer's angle**
For anything beyond simple roles, mention CASL (`@casl/ability`), which Nest's own docs recommend for attribute-based access control — e.g. "a user may edit an article only if they authored it."

---

## Q24. What are interceptors and what can you do with them?

**Short answer**
Interceptors wrap the handler. They run code before and after it, can transform the returned value, can override it entirely, and can extend behaviour with RxJS operators.

**Full explanation**

```ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const now = Date.now();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: { durationMs: Date.now() - now },
      })),
    );
  }
}
```

`next.handle()` returns an Observable of whatever the handler returned. Everything before that line runs pre-handler; everything in `.pipe()` runs post-handler.

Common uses:

| Use case | Operator |
|---|---|
| Wrap responses in an envelope | `map` |
| Log execution time | `tap` |
| Convert errors | `catchError` |
| Enforce a timeout | `timeout` + `catchError` |
| Cache responses | return a cached Observable, skipping `next.handle()` |
| Strip sensitive fields | `map` + `classToPlain` |

```ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      timeout(5000),
      catchError((err) =>
        throwError(() => err instanceof TimeoutError
          ? new RequestTimeoutException()
          : err),
      ),
    );
  }
}
```

**Interviewer's angle**
Interceptors are the clearest AOP construct in Nest. If they ask "how would you add response caching without touching every controller?" — this is the answer.

---

## Q25. What is `ClassSerializerInterceptor` and how do you hide a password field?

**Short answer**
It runs `class-transformer` on the response, so `@Exclude()` on an entity property removes it from serialised output.

**Full explanation**

```ts
export class User {
  id: number;
  email: string;

  @Exclude()
  password: string;

  @Expose()
  get displayName(): string {
    return this.email.split('@')[0];
  }
}

@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {}
```

The catch that trips people up: **the handler must return an actual class instance**, not a plain object. If your ORM returns plain objects or you build a literal, `class-transformer` has no metadata to apply and the password leaks. Wrap it:

```ts
return new User(await this.repo.findOneBy({ id }));
```

`@Transform()` handles custom shaping, and `@Expose({ groups: ['admin'] })` plus `@SerializeOptions({ groups: ['admin'] })` lets you vary output per audience.

**Interviewer's angle**
An alternative and arguably safer answer: use explicit response DTOs and map to them, so nothing is exposed by default. Naming both approaches and stating a preference is a strong answer.

---

## Q26. Explain the request lifecycle in NestJS, in order.

**Short answer**
Incoming request → global middleware → module middleware → global guards → controller guards → route guards → global interceptors (pre) → controller interceptors (pre) → route interceptors (pre) → pipes → **route handler** → interceptors (post, in reverse) → exception filters if anything threw → response.

**Full explanation**

Two properties make this worth memorising precisely:

1. **Guards run before pipes.** So authorisation is decided before the body is validated. This is deliberate — an unauthenticated request shouldn't get detailed validation feedback about your schema.
2. **Interceptors are the only bidirectional component.** They run outermost-first on the way in and innermost-first on the way out, like a stack unwinding.

Exception filters sit outside the whole chain. Anything thrown at any stage after middleware is caught by them.

```
      ┌──────────── middleware ─────────────┐
      │  ┌────────── guards ─────────────┐  │
      │  │  ┌────── interceptors ──────┐ │  │
      │  │  │  ┌──── pipes ────┐       │ │  │
      │  │  │  │    HANDLER    │       │ │  │
      │  │  │  └───────────────┘       │ │  │
      │  │  └──────────────────────────┘ │  │
      │  └───────────────────────────────┘  │
      └─────────────────────────────────────┘
                filters wrap all of it
```

**Interviewer's angle**
This is the single most-asked intermediate question. If you can draw it and explain *why* guards precede pipes, you're ahead of most candidates.

---

## Q27. Where would you put logging, and why not in every service?

**Short answer**
Request-level logging in middleware or an interceptor; domain events in the service via the injected `Logger`. Never repeat try/catch logging in every method.

**Full explanation**

Nest ships a `Logger` class:

```ts
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  async cancel(id: string) {
    this.logger.log(`Cancelling order ${id}`);
  }
}
```

For production, replace it with `nestjs-pino` or Winston via `app.useLogger()`, so you get structured JSON logs, log levels per environment, and request correlation IDs.

The architectural point: logging is cross-cutting. If it appears in every method, you've spread an infrastructure concern through your domain code. Push it to the edges — an interceptor for timing and outcomes, an exception filter for errors, and explicit service logs only for business-meaningful events ("payment retried", "quota exceeded").

Correlation IDs are worth mentioning: generate one in middleware, attach it to an AsyncLocalStorage context or the request object, and include it in every log line so you can trace a single request across services.

**Interviewer's angle**
Follow-up: "how do you avoid logging PII?" Redaction config in Pino, or serialisers that strip known-sensitive keys.

---

## Q28. How do you write a custom exception filter?

**Short answer**
A class decorated with `@Catch()` implementing `ExceptionFilter`, bound at method, controller, or global level.

**Full explanation**

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId: request.headers['x-correlation-id'],
      message,
    });
  }
}
```

`@Catch()` with no argument catches everything. `@Catch(HttpException)` narrows it. `@Catch(QueryFailedError)` lets you translate a Postgres unique-constraint violation into a clean `409 Conflict` — a genuinely useful pattern:

```ts
@Catch(QueryFailedError)
export class DbExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    if ((exception as any).code === '23505') {
      // unique_violation
      throw new ConflictException('Resource already exists');
    }
    throw exception;
  }
}
```

`ArgumentsHost` rather than `ExecutionContext` because filters also handle non-HTTP contexts — RPC, WebSockets — and `host.getType()` tells you which.

**Interviewer's angle**
The database-error translation example is memorable and demonstrably practical. Have it ready.

---

## Q29. How do you implement JWT authentication end to end?

**Short answer**
`@nestjs/jwt` and `@nestjs/passport` with `passport-jwt`. A login endpoint validates credentials and signs a token; a `JwtStrategy` validates the token on each request; a guard applies the strategy.

**Full explanation**

```ts
// auth.module.ts
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}

// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  // return value becomes request.user
  async validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email, roles: payload.roles };
  }
}

// auth.service.ts
async login(email: string, password: string) {
  const user = await this.users.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedException('Invalid credentials');
  }
  return {
    accessToken: this.jwt.sign({ sub: user.id, email, roles: user.roles }),
  };
}
```

Points that earn credit:

- **Hash with bcrypt or argon2**, never store plaintext. Use a cost factor of at least 10–12.
- **Return one generic error** for both "no such user" and "wrong password", or you've built a user-enumeration oracle.
- **Short-lived access tokens plus refresh tokens.** 15 minutes and 7 days is a reasonable default. Store the refresh token hashed in the database so it can be revoked.
- **JWTs cannot be invalidated** before expiry without server-side state. If the interviewer asks about logout, that's the answer: either accept the window, or keep a denylist in Redis keyed by token `jti`.

**Interviewer's angle**
Almost guaranteed in any Node interview. The refresh-token rotation and revocation discussion is where seniority shows.

---

## Q30. Guards vs interceptors vs pipes vs middleware vs filters — when do you reach for each?

**Short answer**

| Component | Question it answers | Runs |
|---|---|---|
| Middleware | "What should happen to every raw request?" | First, pre-routing context |
| Guard | "Is this request allowed?" | After middleware, before pipes |
| Interceptor | "What should wrap the handler, in and out?" | Around the handler |
| Pipe | "Is this argument valid, and what shape should it be?" | Just before the handler |
| Filter | "How do I turn this thrown thing into a response?" | On any exception |

**Full explanation**

The distinctions that matter in practice:

- Middleware is the only one with no `ExecutionContext`. If you need to know which handler is targeted, you cannot use middleware.
- Guards are boolean-only. They don't transform anything. If you find yourself mutating data in a guard beyond attaching `request.user`, you want an interceptor.
- Interceptors are the only component that sees the response. If the requirement mentions the *return value*, it's an interceptor.
- Pipes operate on a single argument, not the whole request. That's why validation applies per-parameter.
- Filters are error-path only.

A worked example: "log every request with its duration and mask emails in the response, but only for admins." Duration → interceptor (`tap`). Admin check → guard. Masking → interceptor (`map`). Nothing here needs middleware.

**Interviewer's angle**
Being asked to place a concrete requirement into the right bucket is more common than being asked to define the terms. Practise with three or four made-up requirements.

---

## Q31. How do you write unit tests in NestJS?

**Short answer**
`Test.createTestingModule()` from `@nestjs/testing` builds a minimal DI container with real dependencies replaced by mocks, then compile it and pull out the class under test.

**Full explanation**

```ts
describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOneBy: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it('throws NotFoundException when the user is absent', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
  });
});
```

Key techniques:

- `getRepositoryToken(Entity)` gives you the injection token TypeORM uses.
- `.overrideProvider(X).useValue(mock)` replaces a provider in a larger module.
- `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` bypasses auth in controller tests.
- Unit tests should not touch the database. If you're spinning up Postgres, that's an integration test — which is fine, but call it what it is.

**Interviewer's angle**
"What do you actually test?" Good answer: business logic and branching in services, guard decisions, and the contract at the e2e level. Not: that a controller calls a service, which tests nothing but your own mock.

---

## Q32. How do you write e2e tests?

**Short answer**
Boot the real application via the testing module, wrap it with supertest, and assert on real HTTP responses.

**Full explanation**

```ts
describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ send: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => await app.close());

  it('rejects an invalid email', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Ada', email: 'not-an-email' })
      .expect(400);
  });
});
```

Two things people forget:

1. **Global pipes registered in `main.ts` are not applied** by `createNestApplication()`, because `main.ts` never runs. You must re-register them in the test, or your validation tests will pass requests they shouldn't. Registering globals via `APP_PIPE` in a module avoids this entirely.
2. **`app.close()` in `afterAll`**, or Jest hangs on open database handles.

For the database, use Testcontainers or a dedicated test schema, and truncate between tests rather than mocking — the whole value of e2e is exercising the real stack.

**Interviewer's angle**
The "globals don't apply in e2e" gotcha is a great thing to volunteer unprompted.

---

## Q33. What are lifecycle hooks?

**Short answer**
Interfaces you implement to run code at defined points in the application's startup and shutdown sequence.

**Full explanation**

In order:

| Hook | When |
|---|---|
| `OnModuleInit` | Once the host module's dependencies are resolved |
| `OnApplicationBootstrap` | Once all modules are initialised, before listening |
| `OnModuleDestroy` | Termination signal received, before teardown |
| `BeforeApplicationShutdown` | After all `OnModuleDestroy` complete |
| `OnApplicationShutdown` | Last, receives the signal name |

```ts
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await this.connection.connect();
  }

  async onApplicationShutdown(signal: string) {
    await this.connection.drain();   // finish in-flight jobs
    await this.connection.close();
  }
}
```

**Shutdown hooks require `app.enableShutdownHooks()`** in `main.ts`. Without it, SIGTERM kills the process immediately, dropping in-flight requests. In Kubernetes this shows up as intermittent 502s during rolling deploys, and it's a genuinely common production bug.

**Interviewer's angle**
Graceful shutdown is an infrastructure-awareness signal. Mention SIGTERM, connection draining, and readiness probes.

---

## Q34. How do you create a custom parameter decorator?

**Short answer**
`createParamDecorator`, which receives the data argument and the `ExecutionContext` and returns whatever should be injected.

**Full explanation**

```ts
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);

// usage
@Get('me')
getProfile(@CurrentUser() user: JwtPayload) {}

@Get('id')
getId(@CurrentUser('userId') id: string) {}
```

This is better than `@Req() req` then `req.user` for three reasons: it's typed, it's platform-agnostic, and it's trivially mockable in tests.

You can compose decorators too:

```ts
export function Auth(...roles: Role[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

// then simply:
@Auth(Role.Admin)
@Delete(':id')
remove() {}
```

`applyDecorators` collapsing four decorators into one is a nice thing to show — it's real DX improvement, not a party trick.

**Interviewer's angle**
Being asked to write `@CurrentUser()` on a whiteboard is common. Practise it until it's muscle memory.

---

## Q35. How do you document an API with Swagger?

**Full explanation**

```ts
const config = new DocumentBuilder()
  .setTitle('Orders API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

Then annotate:

```ts
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateUserDto) {}
}

export class CreateUserDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email: string;
}
```

The CLI plugin (`"plugins": ["@nestjs/swagger"]` in `nest-cli.json`) infers most `@ApiProperty` metadata from TypeScript types, removing much of the annotation burden.

Mapped types are the underrated part:

```ts
export class UpdateUserDto extends PartialType(CreateUserDto) {}
export class PublicUserDto extends OmitType(User, ['password'] as const) {}
export class LoginDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}
```

These preserve both validation and Swagger metadata, so you define the shape once.

**Interviewer's angle**
"Do you expose Swagger in production?" — usually no, or behind auth, because it hands an attacker a complete map of your API.

---

## Q36. How do you handle background jobs and queues?

**Short answer**
`@nestjs/bullmq` with Redis. The producer adds jobs; a processor consumes them in a separate worker process.

**Full explanation**

```ts
@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'redis', port: 6379 } }),
    BullModule.registerQueue({ name: 'emails' }),
  ],
})
export class EmailModule {}

@Injectable()
export class EmailService {
  constructor(@InjectQueue('emails') private queue: Queue) {}

  async sendWelcome(userId: string) {
    await this.queue.add('welcome', { userId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
    });
  }
}

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  async process(job: Job) {
    switch (job.name) {
      case 'welcome':
        return this.mailer.sendWelcome(job.data.userId);
    }
  }
}
```

Why queues at all: anything slow, failure-prone, or third-party-dependent shouldn't run inside a request. Email, PDF generation, image processing, webhook delivery, report exports.

Points that show experience: **idempotency** (a job may run twice, so design handlers to tolerate it), **dead-letter handling** for permanently failed jobs, **concurrency limits** to protect downstream systems, and running workers in a separate deployment from the API so a job spike doesn't degrade request latency.

**Interviewer's angle**
"What happens if the worker crashes mid-job?" BullMQ marks stalled jobs and retries them — which is exactly why idempotency matters.

---

## Q37. How do you schedule recurring tasks?

**Full explanation**

```ts
@Module({ imports: [ScheduleModule.forRoot()] })
export class AppModule {}

@Injectable()
export class ReportsService {
  @Cron('0 2 * * *', { name: 'daily-report', timeZone: 'Asia/Dhaka' })
  async generateDaily() {}

  @Interval(30000)
  heartbeat() {}

  @Timeout(5000)
  warmCache() {}
}
```

The production caveat that matters: **if you run three replicas, the cron fires three times.** `@nestjs/schedule` is in-process and has no coordination. Solutions: a distributed lock in Redis (Redlock), a dedicated single-replica scheduler deployment, or an external scheduler (Kubernetes CronJob, EventBridge) that hits an endpoint.

Volunteering this shows you've operated a Nest app rather than just built one.

---

## Q38. How do you register a guard globally when it needs dependency injection?

**Short answer**
Use the `APP_GUARD` token in a module's providers rather than `app.useGlobalGuards()` in `main.ts`.

**Full explanation**

```ts
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

`app.useGlobalGuards(new JwtAuthGuard())` requires you to construct the instance yourself, outside the DI container, so it can't inject `Reflector`, `ConfigService`, or anything else. The `APP_*` token approach registers it as a normal provider, fully injectable.

It also means the global applies in e2e tests that import `AppModule`, which the `main.ts` approach does not.

With a global auth guard you need an escape hatch:

```ts
export const Public = () => SetMetadata('isPublic', true);

@Public()
@Post('login')
login() {}
```

Deny-by-default with explicit `@Public()` opt-outs is the safer design: forgetting a decorator locks an endpoint down rather than opening it up.

**Interviewer's angle**
This deny-by-default reasoning is a strong senior signal.

---

## Q39. How do you implement caching?

**Full explanation**

```ts
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        host: 'redis',
        ttl: 60_000,
      }),
    }),
  ],
})
export class AppModule {}
```

Declarative caching for GET routes:

```ts
@UseInterceptors(CacheInterceptor)
@CacheKey('all-products')
@CacheTTL(30_000)
@Get()
findAll() {}
```

Programmatic, for finer control:

```ts
constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

async findOne(id: string) {
  const key = `product:${id}`;
  const cached = await this.cache.get<Product>(key);
  if (cached) return cached;

  const product = await this.repo.findOneBy({ id });
  await this.cache.set(key, product, 60_000);
  return product;
}
```

The hard part isn't caching, it's **invalidation**. Discuss: TTL-based expiry as the simple default, explicit deletion on write, and cache-key versioning for bulk invalidation. Also note that the in-memory default store is per-replica, so with multiple instances you get inconsistent reads — use Redis for anything multi-instance.

---

## Q40. How do you handle file uploads?

**Full explanation**

```ts
@Post('avatar')
@UseInterceptors(FileInterceptor('file', {
  storage: diskStorage({ destination: './uploads' }),
  limits: { fileSize: 2 * 1024 * 1024 },
}))
uploadAvatar(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 2_000_000 }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
      ],
    }),
  )
  file: Express.Multer.File,
) {}
```

`FilesInterceptor` for arrays, `FileFieldsInterceptor` for named fields.

Security notes worth raising unprompted: validate MIME type by inspecting magic bytes, not the client-supplied `Content-Type` header, which is trivially spoofed; never use the original filename on disk; enforce size limits at the reverse proxy as well as in the app; and in production, stream directly to S3 with a pre-signed URL rather than through your API server at all.

---

## Q41. How do you implement rate limiting?

**Full explanation**

```ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

@Throttle({ short: { limit: 1, ttl: 60000 } })
@Post('login')
login() {}

@SkipThrottle()
@Get('health')
health() {}
```

Two operational points: behind a load balancer you must configure `app.set('trust proxy', 1)` or every request appears to come from the proxy's IP and one user can exhaust the global limit. And the default in-memory storage doesn't work across replicas — use `@nest-lab/throttler-storage-redis`.

Rate limiting is also often better placed at the edge (Cloudflare, nginx, API gateway) so abusive traffic never reaches your Node process at all. Application-level throttling then acts as a second layer for per-user or per-endpoint rules.

---

## Q42. How do you structure a large NestJS project?

**Short answer**
By feature, not by technical layer. Each feature is a module owning its controllers, services, DTOs, and entities.

**Full explanation**

```
src/
  common/          decorators, filters, guards, interceptors, pipes
  config/          configuration factories and validation schema
  database/        migrations, seeds, datasource
  modules/
    users/
      dto/
      entities/
      users.controller.ts
      users.service.ts
      users.module.ts
    orders/
    payments/
  app.module.ts
  main.ts
```

Grouping by type (`controllers/`, `services/`, `dtos/`) looks tidy but means every feature change touches four distant folders, and it gives you no signal about coupling. Feature folders keep related code together and make it obvious when a module is doing too much.

For larger systems, discuss layering within a module — controller (transport) → service (application) → repository (persistence) → domain — and where you'd draw the line before it becomes over-engineering. Full hexagonal architecture is justified in a long-lived core domain; it's a burden in a CRUD admin panel.

Nest monorepo mode (`nest g app`, `nest g library`) is worth knowing for multi-service setups where you want shared libraries without publishing packages.

**Interviewer's angle**
There's no single right answer; they're testing whether you can justify a structure and name its trade-offs.

---

# Part 3 — Architecture and depth

*Senior and lead rounds. Here the interviewer is less interested in whether you can use a feature and more in whether you know what it costs.*

---

## Q43. What are injection scopes, and what's the cost of each?

**Short answer**
`DEFAULT` (singleton), `REQUEST` (one instance per request), and `TRANSIENT` (a fresh instance per consumer). Singleton is the default and almost always the right choice.

**Full explanation**

```ts
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}
}
```

The cost is the important part. **Scope bubbles upward.** If a request-scoped provider is injected into a service, that service becomes request-scoped too, and so does the controller that uses it. The whole dependency chain is instantiated per request. On a high-throughput API that's real garbage-collection pressure and measurable latency.

It also breaks things you might not expect: a request-scoped provider can't be injected into a global interceptor cleanly, and lifecycle hooks behave differently.

`TRANSIENT` means each injecting class gets its own private instance. The classic legitimate use is a logger that needs to know its consumer's class name.

**The better alternative for request context:** `AsyncLocalStorage` from `node:async_hooks`. It gives you per-request state (correlation IDs, tenant IDs, the current user) with no scope propagation and no per-request instantiation cost.

```ts
@Injectable()
export class ContextService {
  private readonly als = new AsyncLocalStorage<Map<string, unknown>>();
  run(store: Map<string, unknown>, fn: () => void) { this.als.run(store, fn); }
  get<T>(key: string): T | undefined { return this.als.getStore()?.get(key) as T; }
}
```

**Interviewer's angle**
Anyone can recite the three scopes. Explaining scope bubbling and offering AsyncLocalStorage as the alternative is what marks a senior answer.

---

## Q44. What is a circular dependency and how do you resolve it?

**Short answer**
Two modules or providers that depend on each other. Resolve it with `forwardRef()` — but treat it as a design smell first.

**Full explanation**

```ts
// users.module.ts
@Module({ imports: [forwardRef(() => AuthModule)] })
export class UsersModule {}

// auth.module.ts
@Module({ imports: [forwardRef(() => UsersModule)] })
export class AuthModule {}

// and for providers
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}
}
```

`forwardRef` works by deferring resolution of the reference until both classes are defined, sidestepping the JavaScript module-loading order problem.

But the better answer starts earlier: a circular dependency usually means responsibilities are in the wrong place. Three ways out that don't need `forwardRef`:

1. **Extract the shared piece** into a third module both depend on.
2. **Invert the direction** using an event — `EventEmitter2` or a domain event — so `UsersService` emits `user.created` and `AuthService` listens, with no direct reference.
3. **Move the method.** Often one of the two calls belongs in the other class anyway.

The runtime alternative is `ModuleRef`, resolving lazily:

```ts
constructor(private moduleRef: ModuleRef) {}
onModuleInit() {
  this.authService = this.moduleRef.get(AuthService, { strict: false });
}
```

**Interviewer's angle**
Say `forwardRef` first so they know you can unblock yourself, then immediately say you'd rather redesign. Both halves matter.

---

## Q45. What is `ModuleRef` and when do you need it?

**Full explanation**

`ModuleRef` gives you programmatic access to the DI container at runtime, for cases where static constructor injection isn't possible.

```ts
@Injectable()
export class NotificationDispatcher {
  constructor(private moduleRef: ModuleRef) {}

  async dispatch(channel: 'email' | 'sms', payload: Payload) {
    const token = channel === 'email' ? EmailSender : SmsSender;
    const sender = this.moduleRef.get(token, { strict: false });
    return sender.send(payload);
  }
}
```

- `get(token)` — retrieve an existing singleton. `strict: false` searches the whole application, not just the host module.
- `resolve(token)` — for scoped providers; returns a promise and creates a new instance per call.
- `create(SomeClass)` — instantiate a class that isn't registered as a provider at all, with its dependencies injected.

Legitimate uses: dynamic strategy selection, plugin systems, breaking a circular dependency, and instantiating handlers discovered at runtime.

Misuse: reaching for `ModuleRef` because you didn't want to wire a dependency properly. It's a service-locator pattern, which hides dependencies and undermines the reason you're using DI. Use it deliberately and rarely.

---

## Q46. How do you build a custom dynamic module?

**Full explanation**

A dynamic module is one configured by the consumer. The pattern is a static method returning a `DynamicModule` object.

```ts
export interface StorageOptions {
  bucket: string;
  region: string;
}

export const STORAGE_OPTIONS = Symbol('STORAGE_OPTIONS');

@Module({})
export class StorageModule {
  static forRoot(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      providers: [
        { provide: STORAGE_OPTIONS, useValue: options },
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => Promise<StorageOptions> | StorageOptions;
  }): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
```

`StorageService` then injects `@Inject(STORAGE_OPTIONS)`.

Nest also provides `ConfigurableModuleBuilder`, which generates this boilerplate for you:

```ts
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<StorageOptions>().build();

@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule extends ConfigurableModuleClass {}
```

**Interviewer's angle**
Being able to write `forRootAsync` by hand demonstrates you understand what every third-party Nest module is doing internally.

---

## Q47. How do you handle database transactions?

**Full explanation**

The naive approach — starting a transaction in a service and passing a `QueryRunner` down through every method — works but pollutes every signature.

TypeORM, explicit:

```ts
async transfer(fromId: string, toId: string, amount: number) {
  return this.dataSource.transaction(async (manager) => {
    const from = await manager.findOne(Account, {
      where: { id: fromId },
      lock: { mode: 'pessimistic_write' },
    });
    if (from.balance < amount) throw new BadRequestException('Insufficient funds');

    await manager.decrement(Account, { id: fromId }, 'balance', amount);
    await manager.increment(Account, { id: toId }, 'balance', amount);
    await manager.save(LedgerEntry, { fromId, toId, amount });
  });
}
```

Everything inside the callback uses `manager`, or it runs outside the transaction — a subtle and common bug.

The cleaner pattern for larger codebases is a **transactional context** using `AsyncLocalStorage` (the `typeorm-transactional` package does this), so a `@Transactional()` decorator makes every repository call in that async context join the same transaction without changing any signatures.

Points worth raising:

- **Isolation levels.** Default `READ COMMITTED` allows non-repeatable reads; use `SERIALIZABLE` or explicit row locks for balance-style invariants.
- **Keep transactions short.** Never make an HTTP call inside one — you're holding locks at the mercy of a third party's latency.
- **Distributed transactions don't exist in practice** across microservices. Use the saga pattern with compensating actions, or the outbox pattern for reliable event publishing.

**Interviewer's angle**
The "no HTTP calls inside a transaction" rule and the outbox pattern are both strong senior signals.

---

## Q48. How do NestJS microservices work?

**Full explanation**

Nest abstracts transport behind a common interface, so the same service code runs over TCP, Redis, NATS, RabbitMQ, Kafka, gRPC, or MQTT.

```ts
// consumer side
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.NATS,
  options: { servers: ['nats://localhost:4222'] },
});
await app.listen();

@Controller()
export class OrdersController {
  @MessagePattern({ cmd: 'get_order' })       // request/response
  getOrder(@Payload() data: { id: string }) {}

  @EventPattern('order.created')              // fire and forget
  handleOrderCreated(@Payload() data: OrderCreatedEvent) {}
}

// producer side
@Injectable()
export class Gateway {
  constructor(@Inject('ORDERS') private client: ClientProxy) {}

  getOrder(id: string) {
    return this.client.send({ cmd: 'get_order' }, { id });  // Observable
  }

  announce(event: OrderCreatedEvent) {
    return this.client.emit('order.created', event);        // fire and forget
  }
}
```

The distinction that matters: `send()` is request/response and returns an Observable you must subscribe to (or `firstValueFrom`); `emit()` is a one-way event and doesn't wait.

A **hybrid application** listens on HTTP and a message transport simultaneously:

```ts
const app = await NestFactory.create(AppModule);
app.connectMicroservice({ transport: Transport.NATS, options: {} });
await app.startAllMicroservices();
await app.listen(3000);
```

Real-world caveats to raise: at-least-once delivery means consumers must be idempotent; you need a dead-letter strategy; and the framework's convenience doesn't remove the hard parts of distributed systems — partial failure, ordering, and eventual consistency are still yours to design around.

---

## Q49. How does GraphQL work in NestJS, and what is the N+1 problem?

**Full explanation**

```ts
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',   // code-first
    }),
  ],
})
export class AppModule {}

@ObjectType()
export class Author {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => [Post]) posts: Post[];
}

@Resolver(() => Author)
export class AuthorsResolver {
  @Query(() => [Author])
  authors() { return this.service.findAll(); }

  @ResolveField(() => [Post])
  posts(@Parent() author: Author) {
    return this.postsService.findByAuthor(author.id);
  }

  @Mutation(() => Author)
  createAuthor(@Args('input') input: CreateAuthorInput) {}
}
```

Code-first generates the SDL from decorated classes; schema-first starts from `.graphql` files and generates types. Code-first is more common in Nest because it keeps a single source of truth in TypeScript.

**The N+1 problem:** querying 100 authors with their posts fires 1 query for the authors and then 100 more, one per `@ResolveField` invocation. The fix is DataLoader, which batches all the per-author calls occurring in the same tick into a single `WHERE author_id IN (...)` query and caches per request.

```ts
const postsLoader = new DataLoader<string, Post[]>(async (authorIds) => {
  const posts = await repo.find({ where: { authorId: In([...authorIds]) } });
  return authorIds.map((id) => posts.filter((p) => p.authorId === id));
});
```

The loader must be **per-request**, or you'll serve one user's cached data to another.

Also worth mentioning: query depth limiting and complexity analysis, because GraphQL lets a client construct an arbitrarily expensive query unless you constrain it.

---

## Q50. How do WebSockets work in NestJS?

**Full explanation**

```ts
@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    const user = await this.auth.verify(client.handshake.auth.token);
    if (!user) return client.disconnect();
    client.join(`user:${user.id}`);
  }

  handleDisconnect(client: Socket) {}

  @SubscribeMessage('message')
  onMessage(@MessageBody() body: MessageDto, @ConnectedSocket() client: Socket) {
    this.server.to(body.roomId).emit('message', body);
  }
}
```

Guards, pipes, interceptors, and filters all work, but with `WsException` instead of `HttpException` and `context.switchToWs()` instead of `switchToHttp()`.

Scaling is the interesting part: with multiple replicas, a client connected to instance A won't receive an event emitted on instance B. The fix is a **Redis adapter** (`@socket.io/redis-adapter`) that broadcasts across instances. Sticky sessions are also needed if you allow the HTTP long-polling fallback.

Authentication happens at handshake time rather than per message — a common design mistake is validating only on connect and never re-checking a long-lived connection after the token expires.

---

## Q51. What is CQRS and when is it worth the complexity?

**Full explanation**

Command Query Responsibility Segregation separates the write model (commands) from the read model (queries). `@nestjs/cqrs` provides commands, queries, events, sagas, and their handlers.

```ts
export class CreateOrderCommand {
  constructor(public readonly userId: string, public readonly items: Item[]) {}
}

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(private readonly repo: OrderRepository, private readonly bus: EventBus) {}

  async execute(command: CreateOrderCommand) {
    const order = Order.create(command.userId, command.items);
    await this.repo.save(order);
    this.bus.publish(new OrderCreatedEvent(order.id));
    return order.id;
  }
}
```

The honest answer to "when is it worth it": **rarely.** CQRS pays off when reads and writes have genuinely different shapes or scaling profiles — a write model enforcing complex invariants alongside denormalised read projections serving dashboards. It also fits naturally with event sourcing.

For a CRUD service, it adds a class per operation and an indirection layer for no benefit. Saying this plainly is a better answer than enthusiasm. Interviewers are wary of candidates who apply heavy patterns reflexively.

A lighter middle ground worth naming: keep normal services, but use `EventEmitter2` for decoupling side effects. You get most of the modularity benefit at a fraction of the cost.

---

## Q52. How do you optimise NestJS performance?

**Full explanation**

Work through it in order of impact:

1. **Fix the database first.** Most Node performance problems are missing indexes, N+1 queries, or `SELECT *` on wide tables. Profile before touching anything else.
2. **Switch to the Fastify adapter** if HTTP overhead is genuinely the bottleneck — roughly 2× throughput on trivial handlers, less on realistic ones. `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`. Costs you Express middleware compatibility.
3. **Cache** at the right layer — HTTP cache headers, Redis for computed results, in-process for small hot data.
4. **Avoid request-scoped providers** on hot paths (Q43).
5. **Move slow work to queues** so request latency isn't hostage to third parties.
6. **Use streaming** for large payloads instead of buffering entire files in memory.
7. **Offload CPU-bound work** to worker threads or a separate service — Node's event loop is single-threaded, and a synchronous JSON parse of a 50MB payload blocks every concurrent request.
8. **Run multiple processes** via the cluster module or, better, multiple container replicas behind a load balancer.
9. **Enable compression** and set appropriate body size limits.

And measure: `clinic.js`, `autocannon`, OpenTelemetry traces. Optimising without a profile is guessing.

**Interviewer's angle**
The mature answer leads with "measure first" and puts the database ahead of the framework. Candidates who open with "switch to Fastify" are reciting a blog post.

---

## Q53. How do you implement health checks?

**Full explanation**

```ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([]);   // is the process up?
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
```

The distinction is the actual question being asked. **Liveness** answers "should this container be restarted?" — it should check almost nothing, because a failing dependency shouldn't cause a restart loop. **Readiness** answers "should this container receive traffic?" — it checks dependencies, so a pod with a dead database connection is pulled from the load balancer without being killed.

Getting these backwards causes cascading restarts during a database blip, which is a real and painful outage pattern.

Combine with `enableShutdownHooks` (Q33) for zero-downtime deploys.

---

## Q54. What is the `Reflector` and how does metadata-driven design work?

**Full explanation**

`Reflector` is Nest's utility for reading metadata attached by decorators.

```ts
this.reflector.get<string[]>('roles', context.getHandler());
this.reflector.getAllAndOverride<boolean>('isPublic', [
  context.getHandler(),
  context.getClass(),
]);
this.reflector.getAllAndMerge<string[]>('permissions', [
  context.getHandler(),
  context.getClass(),
]);
```

The modern approach uses `Reflector.createDecorator`, which is type-safe and removes the string key entirely:

```ts
export const Roles = Reflector.createDecorator<Role[]>();

// in the guard
const roles = this.reflector.get(Roles, context.getHandler());
```

The broader idea is worth articulating: decorators declare *intent* at the point of use, and a single guard or interceptor interprets that intent centrally. That's how you get `@Roles('admin')` reading like documentation while the enforcement lives in one testable place. It's the same principle behind `@Public()`, `@SkipThrottle()`, and `@CacheKey()`.

---

## Q55. How do you handle multi-tenancy?

**Full explanation**

Three models, in increasing isolation and cost:

1. **Shared schema, tenant column.** One database, every table has `tenant_id`, every query filters on it. Cheapest, but one missing `WHERE` clause is a data breach. Enforce it centrally — a TypeORM subscriber, a global query filter, or Postgres row-level security — never by relying on developers to remember.
2. **Schema per tenant.** One database, a schema per tenant, connection switches `search_path`. Better isolation, migrations must run per schema, and it stops scaling somewhere in the low thousands of tenants.
3. **Database per tenant.** Strongest isolation, simplest queries, highest operational cost. Usual choice for enterprise contracts with data-residency requirements.

Implementation in Nest: resolve the tenant in middleware (from subdomain, JWT claim, or header), store it in `AsyncLocalStorage`, and have a connection factory or repository wrapper read it.

```ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Missing tenant');
    tenantContext.run(new Map([['tenantId', tenantId]]), () => next());
  }
}
```

Avoid the request-scoped-provider approach for tenant context — it's the textbook example, but it drags scope propagation through your whole dependency graph.

**Interviewer's angle**
If you've built SaaS, lead with the failure mode: cross-tenant data leakage, and how you'd prevent it structurally rather than by code review.

---

## Q56. How do you add observability — logging, metrics, tracing?

**Full explanation**

The three pillars, mapped to Nest:

- **Logs** — `nestjs-pino` for structured JSON with automatic request context, shipped to a log aggregator. Include correlation IDs.
- **Metrics** — `@willsoto/nestjs-prometheus` exposing `/metrics`. Track the RED method: request Rate, Error rate, Duration. Add domain counters for things that matter (payments failed, jobs retried).
- **Traces** — OpenTelemetry auto-instrumentation for HTTP, database, and Redis, exported to Jaeger, Tempo, or a vendor. This is what tells you *which* downstream call made a request slow.

```ts
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();   // must run before the Nest app is created
```

The ordering detail matters: OpenTelemetry patches modules at require time, so the SDK must start before importing `AppModule`. Usually it lives in a `tracing.ts` imported first in `main.ts`.

Also mention alerting on symptoms (error rate, p99 latency, queue depth) rather than causes (CPU), and health endpoints excluded from your latency metrics so probes don't skew percentiles.

---

## Q57. What security measures do you apply to a production Nest API?

**Full explanation**

A checklist you can walk through:

- **Helmet** for security headers (`app.use(helmet())`).
- **Validation with `whitelist: true`** to prevent mass assignment (Q8).
- **Parameterised queries only.** ORMs do this by default; raw queries with string interpolation are how SQL injection happens.
- **Rate limiting** on auth endpoints especially (Q41).
- **Password hashing** with bcrypt or argon2, never MD5/SHA.
- **Short-lived JWTs with rotating refresh tokens**, stored hashed.
- **CSRF protection** only if you use cookie-based auth; irrelevant for bearer tokens.
- **Secrets from a secret manager**, never in the repo or the image.
- **`disable('x-powered-by')`** and no framework version leakage.
- **Dependency scanning** — `npm audit`, Snyk, or Dependabot in CI.
- **Payload size limits** to prevent memory-exhaustion DoS.
- **Never return raw errors** to clients (Q12).
- **Log auth events** — failed logins, privilege changes, token refreshes.
- **Deny by default** on authorisation (Q38).

If asked to prioritise: authentication and authorisation correctness first, input validation second, everything else after. Most real breaches are broken access control, not exotic exploits — it's been the top item in the OWASP Top Ten for good reason.

---

## Q58. How do you deploy a NestJS app, and what does the Dockerfile look like?

**Full explanation**

```dockerfile
# build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

Points that earn credit:

- **Multi-stage build** so dev dependencies and source don't ship.
- **`npm ci`, not `npm install`**, for reproducible builds from the lockfile.
- **Copy `package*.json` before source** so the dependency layer caches.
- **Run as a non-root user.**
- **`node dist/main.js`, not `npm start`** — npm swallows signals, so SIGTERM never reaches your process and graceful shutdown silently doesn't happen. This is a genuinely common production bug.
- **Migrations run as a separate step** (an init container or a deploy job), not on application boot, or N replicas race each other.

Then readiness/liveness probes pointing at the endpoints from Q53, resource limits, and a rolling deploy strategy.

---

## Q59. How do you version an API?

**Full explanation**

```ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {}

@Version('2')
@Get()
findAllV2() {}
```

Nest supports URI (`/v1/users`), header, media type, and custom versioning. URI is the most common because it's visible, cacheable, and trivially debuggable.

The strategic points matter more than the syntax: version only on breaking changes; additive changes don't need a new version. Maintain a deprecation policy with a stated sunset date and `Deprecation`/`Sunset` headers. And keep versions thin — share the service layer, version only the transport layer, or you'll be maintaining two copies of your business logic.

---

## Q60. How would you migrate a monolith to microservices?

**Full explanation**

The senior answer starts by questioning the premise. Microservices buy independent deployment and scaling at the cost of network failure modes, distributed debugging, and operational overhead. A modular monolith — Nest modules with strictly enforced boundaries — delivers most of the organisational benefit with none of the distributed-systems tax. Split when you have a specific problem that splitting solves: a team that can't ship independently, or a component with a wildly different scaling profile.

If you do split:

1. **Enforce module boundaries first** inside the monolith. If modules reach into each other's internals, extracting one will fail.
2. **Pick a seam with low coupling and clear ownership** — notifications, reporting, and file processing are usually first.
3. **Strangler fig pattern** — route a slice of traffic to the new service behind a facade, keeping the old path as fallback.
4. **Split the data.** This is the hard part. Two services sharing a database aren't independent; you've built a distributed monolith. Expect to duplicate some data and accept eventual consistency.
5. **Introduce async messaging** between services rather than synchronous chains, so one slow service doesn't cascade.
6. **Invest in observability before** you split, not after. Distributed tracing is not optional once a request crosses three services.

**Interviewer's angle**
Willingness to say "probably don't" is often the answer they're hoping for, especially from a lead candidate.

---

## Q61. How do you test guards, interceptors, and pipes?

**Full explanation**

They're just classes, so you can construct them directly and pass a fabricated `ExecutionContext`:

```ts
const createContext = (user?: unknown, handlerMeta?: Role[]): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('denies a user without the required role', () => {
    const reflector = { getAllAndOverride: () => [Role.Admin] } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(createContext({ roles: [Role.User] }))).toBe(false);
  });
});
```

For interceptors, mock the `CallHandler`:

```ts
const next: CallHandler = { handle: () => of({ id: 1 }) };
const result = await firstValueFrom(interceptor.intercept(ctx, next));
expect(result).toEqual({ success: true, data: { id: 1 } });
```

The general principle: because Nest components are plain classes with explicit inputs, almost everything is unit-testable without booting the framework. When you find something that isn't, that's usually a sign it has a hidden dependency.

---

## Q62. What's the difference between `@nestjs/event-emitter` and a message queue?

**Full explanation**

`EventEmitter2` is **in-process**. Events are synchronous by default, stay within a single Node process, and are lost if the process crashes mid-handler.

```ts
this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id));

@OnEvent('order.created', { async: true })
handleOrderCreated(event: OrderCreatedEvent) {}
```

A message queue (BullMQ, RabbitMQ, Kafka) is **out-of-process and durable**. Messages survive restarts, can be retried, can be consumed by other services, and can be replayed.

Choose the emitter for decoupling within one deployable — "when an order is created, also update the search index" where losing the event on crash is tolerable or recoverable. Choose a queue when the work must not be lost, must be retried, must cross a service boundary, or must be rate-limited independently.

A good hybrid: emit a domain event in-process, and have one listener enqueue a durable job. You get clean decoupling in the domain and durability at the edge.

The strongest version of this answer mentions the **transactional outbox**: writing the event to a table inside the same transaction as the business change, then publishing it from there, so you can't commit the change and lose the event.

---

## Q63. How do you handle validation that depends on the database?

**Full explanation**

Class-validator decorators are synchronous and stateless by design, so "is this email already taken?" doesn't belong there — though a custom async validator is possible:

```ts
@ValidatorConstraint({ async: true })
@Injectable()
export class IsEmailAvailable implements ValidatorConstraintInterface {
  constructor(private readonly users: UsersService) {}
  async validate(email: string) {
    return !(await this.users.findByEmail(email));
  }
}
```

This requires `useContainer(app.select(AppModule), { fallbackOnErrors: true })` in `main.ts` so class-validator can resolve injected dependencies.

But the better answer names the race condition: a uniqueness check followed by an insert is a TOCTOU bug. Two concurrent requests both pass validation, both insert, and one fails at the database anyway. **The database constraint is the real guarantee**; the application check is a UX nicety that produces a friendlier error most of the time. So keep the unique index, catch the constraint violation, and translate it to a `409` (Q28).

**Interviewer's angle**
Spotting the race condition unprompted is one of the clearest concurrency signals available in a framework interview.

---

## Q64. How do you keep the domain layer independent of NestJS?

**Full explanation**

The concern: decorators, `HttpException`, and ORM entities scattered through business logic make the domain untestable in isolation and unmovable to another context.

The approach, roughly hexagonal:

- **Domain layer** — plain TypeScript classes with business rules and domain-specific errors (`InsufficientFundsError`). No Nest imports, no ORM imports, no decorators.
- **Application layer** — use cases that orchestrate domain objects, depending on **interfaces** (ports) for persistence and external services.
- **Infrastructure layer** — Nest-specific: controllers, ORM repositories implementing the ports, HTTP clients.
- **Mapping at the edges** — an exception filter translates `InsufficientFundsError` into a `400`; a mapper converts entities to domain objects.

```ts
// domain — no framework
export class Account {
  withdraw(amount: Money): void {
    if (this.balance.lessThan(amount)) throw new InsufficientFundsError();
    this.balance = this.balance.minus(amount);
  }
}

// application — depends on an interface
export class WithdrawUseCase {
  constructor(private readonly accounts: AccountRepository) {}   // port
}

// infrastructure — Nest wires the implementation
{ provide: AccountRepository, useClass: TypeOrmAccountRepository }
```

Be honest about the cost: more files, more mapping, and it's over-engineering for a CRUD service. It earns its keep in a complex, long-lived core domain where business rules change more often than infrastructure.

---

## Q65. What don't you like about NestJS?

**Short answer**
The honest ones: heavy decorator magic makes errors hard to trace, the abstraction layer over Express adds overhead you can't always control, and the framework makes it easy to over-architect small services.

**Full explanation**

Interviewers ask this to see whether you evaluate tools or adopt them. Genuine criticisms worth raising:

- **Error messages from the DI container** can be cryptic. "Nest can't resolve dependencies of X (?, Y)" tells you the index but not always the cause, and circular imports produce especially confusing failures.
- **Decorator metadata depends on TypeScript compiler flags**, so a misconfigured `tsconfig` produces failures that look like framework bugs. The move toward stage-3 decorators in the wider ecosystem adds friction here.
- **Boilerplate.** A trivial CRUD endpoint touches a module, controller, service, DTO, and entity. Justified at scale, heavy for a small service.
- **The abstraction can hide performance characteristics** — request-scoped providers are the clearest example, where an innocuous annotation changes instantiation behaviour across the whole dependency chain.
- **Ecosystem coupling.** Many integrations are maintained by the core team and track their own release cadence, so major-version upgrades can be a coordinated effort.

None of these are reasons to avoid Nest. They're reasons to use it deliberately.

**Interviewer's angle**
A candidate who says "nothing, I love it" reads as inexperienced. Have two or three specific criticisms and a sentence on how you work around each.

---

# Part 4 — System design and behavioural rounds

## Design prompts you should be able to walk through

For each, structure your answer as: clarify requirements → sketch the module boundaries → data model → the two or three hard parts → trade-offs.

**1. Design a URL shortener.**
Modules: `links`, `redirect`, `analytics`. Hard parts: key generation (counter + base62 vs random with collision retry), read-heavy access pattern so cache aggressively, and analytics writes that must not slow the redirect — queue them.

**2. Design a multi-tenant SaaS billing service.**
Hard parts: tenant isolation (Q55), idempotency on payment webhooks (store the provider's event ID and reject duplicates), reconciliation between your state and the payment provider's, and never trusting webhook payloads without signature verification.

**3. Design an order/inventory system.**
Hard parts: overselling under concurrency — pessimistic locking or optimistic concurrency with a version column; transaction boundaries (Q47); and the saga for order → payment → fulfilment with compensating actions on failure.

**4. Design a notification service.**
Hard parts: multiple channels behind a strategy interface, per-user preferences and quiet hours, rate limiting per recipient, retry with exponential backoff, and idempotency so a retry doesn't double-send.

**5. Design a file-processing pipeline.**
Hard parts: pre-signed direct-to-S3 upload so files never touch your API, queue-driven processing with progress reporting over WebSockets, and handling partial failure on multi-stage pipelines.

## Behavioural questions with a technical core

- **"Tell me about a production incident you handled."** Structure: what broke, how you detected it, what you did to stop the bleeding, root cause, and what you changed so it can't recur. The last part is what they're listening for.
- **"Describe a technical decision you got wrong."** Pick something real and non-trivial, explain what you'd do differently, and avoid blaming a teammate.
- **"How do you handle disagreement about architecture?"** Good answers involve making the trade-offs explicit, writing it down, agreeing on a reversible experiment, and committing once the decision is made.
- **"How do you onboard someone to a Nest codebase?"** README that actually runs, a diagram of module boundaries, a starter ticket that touches one vertical slice, and pairing on the first PR.

---

# Part 5 — Rapid-fire and a prep plan

## Rapid-fire

| Question | Answer |
|---|---|
| Default HTTP status for `@Post()`? | 201 |
| How to change it? | `@HttpCode(200)` |
| DTO: class or interface? | Class — interfaces are erased at compile time |
| Which component sees the response body? | Interceptors |
| Which runs first, guards or pipes? | Guards |
| How do you make a provider available to another module? | `exports` in the owner, `imports` in the consumer |
| Default injection scope? | Singleton (`Scope.DEFAULT`) |
| How to inject a non-class dependency? | `@Inject('TOKEN')` with a value/factory provider |
| What does `@Global()` do? | Makes exported providers available without importing |
| Which decorator marks a class injectable? | `@Injectable()` |
| Which package provides validation decorators? | `class-validator` |
| How do you skip a global auth guard on one route? | A `@Public()` metadata decorator the guard checks |
| Difference between `send()` and `emit()` on `ClientProxy`? | Request/response vs fire-and-forget |
| What blocks bootstrap until it resolves? | Async providers (`useFactory` returning a promise) |
| How do you enable graceful shutdown? | `app.enableShutdownHooks()` |
| What does `synchronize: true` do, and when? | Auto-alters schema — development only, never production |
| How do you get metadata inside a guard? | `Reflector` |
| What's the fix for GraphQL N+1? | DataLoader, instantiated per request |
| Where should business logic live? | Services, not controllers |
| How do you mock a TypeORM repository in a test? | `getRepositoryToken(Entity)` with `useValue` |

## A 7-day prep plan

**Day 1 — Foundations.** Read Part 1. Then build a small CRUD module from scratch without the CLI, so you feel where the wiring goes.

**Day 2 — Lifecycle.** Draw the request lifecycle from memory. Write one guard, one interceptor, one pipe, one filter, and log inside each to confirm the order empirically.

**Day 3 — Auth.** Implement JWT login with refresh tokens, a global auth guard, `@Public()`, and role-based access. This single exercise covers Q22, Q23, Q29, Q34, and Q38.

**Day 4 — Data.** Set up TypeORM with migrations, write a transactional operation, and deliberately create then fix an N+1 query.

**Day 5 — Testing.** Unit-test a service with mocks, e2e-test one endpoint, and test a guard in isolation. Notice the `main.ts` globals gotcha yourself.

**Day 6 — Depth.** Read Part 3. Write a dynamic module with `forRootAsync`. Read the source of one small `@nestjs/*` package — it demystifies the framework faster than any tutorial.

**Day 7 — Rehearsal.** Answer Q26, Q30, Q43, and Q65 out loud, timed to 90 seconds each. Then walk through two design prompts from Part 4 on paper.

## Final advice

Three things separate strong candidates from adequate ones in Nest interviews:

1. **Naming trade-offs unprompted.** Every answer should end with what it costs, not just what it does.
2. **Production awareness.** Migrations, graceful shutdown, multi-replica behaviour, and observability come up constantly and are where most candidates go quiet.
3. **Saying "it depends" and then resolving it.** The phrase alone is a dodge. "It depends on X; here, X is likely true, so I'd do Y" is an answer.

Good luck.
