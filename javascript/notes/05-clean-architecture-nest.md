# Phase 5 — Clean Architecture with NestJS

---

## 5.1 Why Clean Architecture in Node.js

### The Fat Controller Problem

The default Express experience drags everything into the route handler. Validation, business rules, database access, external calls — all tangled in one function:

```js
// Express — the classic "fat controller" anti-pattern
app.post('/users', async (req, res) => {
  // 1. Validation — inline, ad hoc
  if (!req.body.email || !req.body.email.includes('@')) {
    return res.status(400).json({ error: 'bad email' });
  }

  // 2. Business rule — buried in HTTP code
  const existing = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'email taken' });
  }

  // 3. Hashing — infrastructure concern leaking into the handler
  const hash = await bcrypt.hash(req.body.password, 10);

  // 4. Persistence — raw SQL right here
  const result = await db.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
    [req.body.email, hash],
  );

  // 5. Side effect — email send, also inline
  await sendgrid.send({ to: req.body.email, subject: 'Welcome' });

  // 6. Response shaping — leaks the DB row (including the password hash!)
  res.status(201).json(result.rows[0]);
});
```

**Why this hurts:** you cannot unit-test the business rule ("email must be unique") without a database, an HTTP request, and SendGrid. Swapping Postgres for another store touches every handler. The rules are invisible — scattered across 40 route files. This is the exact problem you saw in .NET before Clean Architecture: business logic in the controller instead of in a use case.

### The Dependency Rule — Always Point Inward

Clean Architecture is one rule applied ruthlessly: **source-code dependencies point only inward, toward higher-level policy.** The domain (the innermost circle) knows nothing about the database, HTTP, or NestJS itself. Outer layers depend on inner; never the reverse.

This is identical to the .NET track. In C# you achieve it with `Domain.csproj` having zero project references, and `Infrastructure.csproj` referencing `Domain` to implement its interfaces. In Node.js there are no project files enforcing it — discipline plus a lint rule (e.g. `eslint-plugin-boundaries` or `dependency-cruiser`) is your compiler. The mental model is the same.

The trick that makes inward-only dependencies possible is **Dependency Inversion**: the domain defines an *interface* (`UserRepository`), and the infrastructure provides the *implementation* (`PrismaUserRepository`). The arrow of control flows outward at runtime (the use case calls the DB), but the arrow of *source dependency* points inward (infrastructure imports the domain interface, not vice versa).

### NestJS Makes This Natural — DI Is Built In

In raw Express you'd hand-roll a DI container or pass dependencies through constructors manually. NestJS ships an IoC container out of the box — exactly like ASP.NET Core's `IServiceCollection`. You declare a class `@Injectable()`, register it in a module's `providers` array, and NestJS wires constructor parameters by type. That is precisely how Dependency Inversion gets wired in practice: bind the domain interface token to a concrete infrastructure class in one module file, and every layer above depends only on the abstraction.

```
ASP.NET Core                         NestJS
─────────────────────────────────   ─────────────────────────────────
builder.Services.AddScoped<          {
  IUserRepository,                     provide: USER_REPOSITORY,   // token
  UserRepository>();                   useClass: PrismaUserRepository,
                                     }
[ApiController] class                @Controller() class
MediatR ISender / IMediator          @nestjs/cqrs CommandBus / QueryBus
```

---

## 5.2 NestJS Core Concepts

### The Building Blocks

| Block | What it is | ASP.NET Core analogue |
|-------|-----------|----------------------|
| **Module** | A cohesive unit grouping providers/controllers; the DI scope boundary | A feature folder + its `AddXxx()` registrations |
| **Controller** | Handles inbound HTTP; maps routes to handlers | `[ApiController]` class |
| **Provider** | Anything injectable — services, repositories, factories, the bus | A service registered in DI |
| **Service** | A provider holding logic; just a conventional name | A scoped/singleton service class |

A **Provider** is the general concept; a **Service** is just a provider you happen to call a service. Repositories, use-case handlers, config objects — all providers.

### Dependency Injection via Decorators

`@Injectable()` marks a class as a provider so Nest can manage and inject it. `@Module()` declares which providers exist in a scope and which are exported to other modules.

```ts
// users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()                              // "I can be injected; Nest manages my lifecycle"
export class UsersService {
  // Nest reads the constructor parameter TYPES via reflect-metadata
  // and injects matching providers — same as ASP.NET constructor injection.
  constructor(private readonly mailer: MailerService) {}
}
```

```ts
// users.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [UsersController],         // HTTP entry points in this module
  providers: [UsersService, MailerService], // injectables available within this scope
  exports: [UsersService],                // make UsersService visible to importing modules
})
export class UsersModule {}
```

**The reflection trick:** NestJS DI relies on `emitDecoratorMetadata` in `tsconfig.json` (`"emitDecoratorMetadata": true`). The TS compiler emits the constructor parameter types as metadata; Nest reads them at startup to resolve dependencies by type — the JS analogue of ASP.NET reading constructor signatures via reflection.

**Custom tokens** — when the dependency is an interface (which doesn't exist at runtime in JS), you bind a string/`Symbol` token instead of a class:

```ts
// A token because interfaces vanish at compile time — you cannot inject `UserRepository` (the interface) by type.
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

@Module({
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository }, // bind token → impl
  ],
})
export class InfrastructureModule {}

// Inject it with @Inject(token):
constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}
```

This is the single most important pattern for Clean Architecture in Nest — it's how the domain's interface gets a concrete infrastructure implementation without the domain knowing.

### Provider Scopes

| Scope | Lifetime | ASP.NET analogue |
|-------|----------|-----------------|
| `DEFAULT` (singleton) | One instance for the whole app | `AddSingleton` |
| `REQUEST` | New instance per request | `AddScoped` |
| `TRANSIENT` | New instance per injection | `AddTransient` |

Default is **singleton** (note: opposite of ASP.NET's typical `AddScoped` default for EF contexts). Prefer singletons; use `REQUEST` scope sparingly — it forces the whole dependency chain request-scoped and hurts performance. For request context, prefer `AsyncLocalStorage` (see 5.8) over request-scoped providers.

### The Request Lifecycle — Order Matters

A request passes through a fixed pipeline. Memorise the order — it determines where each concern belongs:

```
Incoming HTTP request
        │
        ▼
┌──────────────────┐
│   Middleware     │   Express-style (req,res,next). Runs first. e.g. helmet, cors
└────────┬─────────┘
         ▼
┌──────────────────┐
│     Guards       │   AuthN/AuthZ — return true/false. ≈ [Authorize] / middleware
└────────┬─────────┘   (throws 403 if false — short-circuits here)
         ▼
┌──────────────────┐
│  Interceptors    │   PRE-controller half — wrap, transform, start timers
│   (before)       │   ≈ ASP.NET action filters (OnActionExecuting)
└────────┬─────────┘
         ▼
┌──────────────────┐
│      Pipes       │   Validate + transform the bound args (DTO validation)
└────────┬─────────┘   ≈ model binding + FluentValidation
         ▼
┌──────────────────┐
│   ROUTE HANDLER  │   your @Controller method runs here
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Interceptors    │   POST-controller half — map response, log duration
│    (after)       │
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Exception       │   catch anything thrown above → format HTTP error
│   Filters        │   ≈ exception filter middleware / IExceptionFilter
└────────┬─────────┘
         ▼
   HTTP response
```

- **Guards** decide *if* the request proceeds (auth). `@UseGuards(JwtAuthGuard)` ≈ `[Authorize]`.
- **Interceptors** wrap the handler — they see both sides (before/after) and can transform the response. They're the natural home for cross-cutting response mapping and timing.
- **Pipes** validate/transform the *inputs* just before the handler. `ValidationPipe` runs your `class-validator` rules.
- **Exception Filters** catch everything and produce a consistent error body. This is where domain exceptions become HTTP responses.

---

## 5.3 The Four Layers in NestJS

```
        ┌─────────────────────────────────────────────────────────┐
        │  PRESENTATION                                            │
        │  NestJS Controllers / GraphQL resolvers / DTOs out       │
        │  Thin — only translates HTTP <-> bus messages            │
        └───────────────────────────┬─────────────────────────────┘
                                     │ depends on
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │  APPLICATION                                             │
        │  Use cases: Commands / Queries / Handlers / Event hdlrs  │
        │  DTOs, orchestration, transactions. Knows Domain only.   │
        └───────────────────────────┬─────────────────────────────┘
                                     │ depends on
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │  DOMAIN   (the core — depends on NOTHING)                │
        │  Entities (rich), Value Objects, Domain Events,          │
        │  Repository INTERFACES, Domain Exceptions                │
        └───────────────────────────▲─────────────────────────────┘
                                     │ implements its interfaces
                                     │ (dependency inversion)
        ┌───────────────────────────┴─────────────────────────────┐
        │  INFRASTRUCTURE                                          │
        │  Prisma/Drizzle repos, HttpModule clients, Redis,        │
        │  email, message brokers. Implements Domain interfaces.   │
        └─────────────────────────────────────────────────────────┘

   Source-dependency arrows ALL point inward (toward Domain).
   Infrastructure points UP into Domain because it implements Domain's interfaces.
   At runtime control flows outward (use case -> repo -> DB), but no inner
   layer ever imports an outer one.
```

The crucial inversion: **Application depends on the `UserRepository` interface (Domain), never on `PrismaUserRepository` (Infrastructure).** Nest's DI binds the token at the composition root (`app.module.ts`) so the concrete class is injected at runtime without the inner layers importing it. Identical to your .NET `IUserRepository` in `Domain` / `UserRepository` in `Infrastructure` / DI registration in `Program.cs`.

A folder layout that mirrors the layers:

```
src/
├── domain/                  # zero framework imports — pure TS
│   ├── user/
│   │   ├── user.entity.ts
│   │   ├── value-objects/   email.vo.ts, user-id.vo.ts, money.vo.ts
│   │   ├── events/          user-registered.event.ts
│   │   ├── user.repository.ts   # the INTERFACE
│   │   └── user.errors.ts
├── application/             # use cases — imports domain only
│   └── user/
│       ├── commands/        create-user.command.ts + .handler.ts
│       ├── queries/         get-user-by-id.query.ts + .handler.ts
│       └── dto/             create-user.dto.ts, user.response.ts
├── infrastructure/          # implements domain interfaces
│   ├── prisma/              prisma.service.ts, prisma.module.ts
│   ├── persistence/         prisma-user.repository.ts
│   └── http/                some-external.client.ts
└── presentation/            # controllers
    └── http/                users.controller.ts
```

---

## 5.4 Domain Layer

The domain is plain TypeScript — **no `@Injectable()`, no Prisma, no Nest imports.** It must be testable with zero mocks.

### Rich Entities, Not Anemic

An **anemic** model is a bag of public getters/setters with the logic living elsewhere (the fat-controller smell). A **rich** entity guards its own invariants — you cannot put it into an invalid state.

```ts
// domain/user/user.entity.ts
import { Email } from './value-objects/email.vo';
import { UserId } from './value-objects/user-id.vo';
import { UserRegisteredEvent } from './events/user-registered.event';
import { EmailAlreadyVerifiedError } from './user.errors';

export class User {
  // Private fields — no setters. State changes only through methods that enforce rules.
  private _domainEvents: unknown[] = [];

  private constructor(
    public readonly id: UserId,         // a Value Object, not a raw string
    private _email: Email,              // a Value Object — guaranteed valid
    private _passwordHash: string,
    private _isVerified: boolean,
    public readonly createdAt: Date,
  ) {}

  // Factory — the ONLY way to create a brand-new user. Enforces invariants + raises an event.
  static register(id: UserId, email: Email, passwordHash: string): User {
    const user = new User(id, email, passwordHash, false, new Date());
    // Record (don't dispatch) a domain event — dispatched by the app layer after persist.
    user._domainEvents.push(new UserRegisteredEvent(id.value, email.value));
    return user;
  }

  // Rehydration factory — used by the repository to rebuild from the DB (no event).
  static fromPersistence(props: {
    id: string; email: string; passwordHash: string; isVerified: boolean; createdAt: Date;
  }): User {
    return new User(
      UserId.fromString(props.id),
      Email.create(props.email),
      props.passwordHash,
      props.isVerified,
      props.createdAt,
    );
  }

  // Behaviour lives WITH the data — this is the rich part.
  verify(): void {
    if (this._isVerified) {
      throw new EmailAlreadyVerifiedError(this._email.value); // a domain exception, not HTTP
    }
    this._isVerified = true;
  }

  // Controlled read access — outward only, no setter.
  get email(): Email { return this._email; }
  get isVerified(): boolean { return this._isVerified; }
  get passwordHash(): string { return this._passwordHash; }

  // The app layer pulls + clears events after a successful save.
  pullDomainEvents(): unknown[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }
}
```

This maps directly to a .NET aggregate root: private setters, a static factory, `AddDomainEvent`, and `PullDomainEvents`.

### Value Objects — Immutable, Identity-Less

A Value Object is defined by its *value*, not an ID. Two `Email`s with the same string are equal. They are immutable and self-validating — invalid values cannot exist. This is your .NET `record` value object (`Email`, `Money`).

```ts
// domain/user/value-objects/email.vo.ts
import { InvalidEmailError } from '../user.errors';

export class Email {
  // private constructor forces creation through the validating factory.
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    // The regex is intentionally simple — full RFC 5322 is overkill; reject the obvious.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new InvalidEmailError(raw);   // impossible to hold an invalid Email
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;    // value equality, not reference
  }
}
```

```ts
// domain/user/value-objects/money.vo.ts
// Money: classic VO — store integer minor units (cents) to avoid float errors.
export class Money {
  private constructor(
    public readonly amount: number,    // cents — integer
    public readonly currency: string,  // ISO 4217, e.g. "USD"
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isInteger(amount)) throw new Error('Money.amount must be integer cents');
    if (amount < 0) throw new Error('Money cannot be negative');
    return new Money(amount, currency.toUpperCase());
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
    return new Money(this.amount + other.amount, this.currency); // returns NEW Money (immutable)
  }
}
```

```ts
// domain/user/value-objects/user-id.vo.ts
import { randomUUID } from 'node:crypto';

// A branded ID VO — prevents passing a raw string or an OrderId where a UserId is expected.
export class UserId {
  private constructor(public readonly value: string) {}
  static create(): UserId { return new UserId(randomUUID()); }
  static fromString(value: string): UserId { return new UserId(value); }
  equals(other: UserId): boolean { return this.value === other.value; }
}
```

### Domain Events

A domain event records *something that already happened* ("UserRegistered"). It's immutable and named in the past tense. Side effects (send welcome email) live in handlers, keeping the entity pure.

```ts
// domain/user/events/user-registered.event.ts
import { IEvent } from '@nestjs/cqrs'; // marker interface only; domain stays logic-free

export class UserRegisteredEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
```

(If you want the domain *truly* framework-free, define your own empty `interface DomainEvent {}` instead of `IEvent` and adapt at the application boundary. Pragmatically, importing the `IEvent` marker is harmless.) Equivalent to a .NET `INotification` (MediatR) raised from an aggregate.

### Repository Interfaces Live in Domain

The domain declares *what persistence it needs*, not *how*. The interface speaks in domain types (`User`, `Email`, `UserId`) — never Prisma types.

```ts
// domain/user/user.repository.ts
import { User } from './user.entity';
import { Email } from './value-objects/email.vo';
import { UserId } from './value-objects/user-id.vo';

// Pure interface — the infrastructure implements it. ≈ .NET IUserRepository in Domain.
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

### Domain Exceptions

Domain errors are about *business rules*, not HTTP. They carry no status code — the exception filter maps them to HTTP later (5.7/5.8). This keeps the domain ignorant of the transport.

```ts
// domain/user/user.errors.ts
// A base class lets the global filter pattern-match domain errors cleanly.
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name; // useful in logs / stack traces
  }
}

export class InvalidEmailError extends DomainError {
  constructor(value: string) { super(`Invalid email: "${value}"`); }
}
export class EmailAlreadyTakenError extends DomainError {
  constructor(email: string) { super(`Email already in use: ${email}`); }
}
export class EmailAlreadyVerifiedError extends DomainError {
  constructor(email: string) { super(`Email already verified: ${email}`); }
}
export class UserNotFoundError extends DomainError {
  constructor(id: string) { super(`User not found: ${id}`); }
}
```

---

## 5.5 Application Layer — CQRS with `@nestjs/cqrs`

`@nestjs/cqrs` is the NestJS equivalent of **MediatR**. The mapping is almost 1:1:

| MediatR (.NET) | `@nestjs/cqrs` |
|----------------|----------------|
| `IRequest` + `IRequestHandler` (command) | `ICommand` + `@CommandHandler` |
| `IRequest<T>` + handler (query) | `IQuery` + `@QueryHandler` |
| `ISender.Send(command)` | `commandBus.execute(command)` |
| `ISender.Send(query)` | `queryBus.execute(query)` |
| `INotification` + `INotificationHandler` | `IEvent` + `@EventsHandler` |
| `IPublisher.Publish(event)` | `eventBus.publish(event)` |

**CQRS = Command Query Responsibility Segregation.** Commands change state and return little (or just an id); queries read and return data; they never mix. The buses decouple the controller from the handler — the controller dispatches a message and doesn't know which class handles it.

### A Command + Handler (write side)

```ts
// application/user/commands/create-user.command.ts
import { ICommand } from '@nestjs/cqrs';

// A plain message object. Immutable. ≈ a MediatR command record.
export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}
```

```ts
// application/user/commands/create-user.handler.ts
import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import * as argon2 from 'argon2';

import { CreateUserCommand } from './create-user.command';
import { USER_REPOSITORY } from '../../../infrastructure/tokens';
import { UserRepository } from '../../../domain/user/user.repository';
import { User } from '../../../domain/user/user.entity';
import { Email } from '../../../domain/user/value-objects/email.vo';
import { UserId } from '../../../domain/user/value-objects/user-id.vo';
import { EmailAlreadyTakenError } from '../../../domain/user/user.errors';

@CommandHandler(CreateUserCommand)   // ≈ IRequestHandler<CreateUserCommand>
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository, // the INTERFACE, via token
    private readonly publisher: EventPublisher, // wires domain events into the event bus
  ) {}

  async execute(command: CreateUserCommand): Promise<{ id: string }> {
    // 1. Build value objects — invalid input throws domain errors here.
    const email = Email.create(command.email);

    // 2. Enforce the business rule the fat controller buried (uniqueness).
    const existing = await this.users.findByEmail(email);
    if (existing) throw new EmailAlreadyTakenError(email.value);

    // 3. Hashing is an app-level concern; argon2 > bcrypt (see Phase 6).
    const passwordHash = await argon2.hash(command.password);

    // 4. Create the aggregate through its factory (records UserRegisteredEvent inside).
    //    mergeObjectContext lets us publish the entity's recorded events afterwards.
    const user = this.publisher.mergeObjectContext(
      User.register(UserId.create(), email, passwordHash),
    );

    // 5. Persist via the interface. Concrete repo is bound by DI — this layer doesn't care.
    await this.users.save(user);

    // 6. Flush recorded domain events onto the event bus (handlers run e.g. welcome email).
    user.commit();

    return { id: user.id.value }; // commands return minimal data
  }
}
```

> `mergeObjectContext` + `user.commit()` is the `@nestjs/cqrs` mechanism for dispatching the events the entity recorded — the analogue of MediatR's "publish domain events after `SaveChanges`" interceptor. (For this to work the entity should extend `AggregateRoot` from `@nestjs/cqrs`, or you publish the pulled events manually via `eventBus.publish(...)` if you keep the domain framework-free.)

### A Query + Handler (read side)

```ts
// application/user/queries/get-user-by-id.query.ts
import { IQuery } from '@nestjs/cqrs';

export class GetUserByIdQuery implements IQuery {
  constructor(public readonly id: string) {}
}
```

```ts
// application/user/queries/get-user-by-id.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { GetUserByIdQuery } from './get-user-by-id.query';
import { USER_REPOSITORY } from '../../../infrastructure/tokens';
import { UserRepository } from '../../../domain/user/user.repository';
import { UserId } from '../../../domain/user/value-objects/user-id.vo';
import { UserNotFoundError } from '../../../domain/user/user.errors';
import { UserResponse } from '../dto/user.response';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(query: GetUserByIdQuery): Promise<UserResponse> {
    const user = await this.users.findById(UserId.fromString(query.id));
    if (!user) throw new UserNotFoundError(query.id);

    // Map domain entity -> response DTO. NEVER return the entity (it has passwordHash!).
    return {
      id: user.id.value,
      email: user.email.value,
      isVerified: user.isVerified,
    };
  }
}
```

> **Read-side shortcut:** for heavy read models you may skip the domain entity entirely and have the query handler hit Prisma directly, projecting straight into a DTO. CQRS explicitly permits this — the write side stays rich; the read side optimises for queries.

### DTOs — Never Expose Domain Entities

DTOs are the *contract* at the boundary. Input DTOs are validated; output DTOs hide internals (like the password hash). The domain entity stays inside.

```ts
// application/user/dto/create-user.dto.ts — input contract + validation
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()                              // ≈ [EmailAddress] / FluentValidation rule
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
```

```ts
// application/user/dto/user.response.ts — output contract (no secrets)
export class UserResponse {
  id!: string;
  email!: string;
  isVerified!: boolean;
}
```

### Validation: `class-validator` + `class-transformer`

`class-validator` declares rules via decorators; `class-transformer` turns the raw JSON body into a typed class instance so those decorators apply. NestJS's `ValidationPipe` runs both. This is your **FluentValidation + model binding** equivalent.

```ts
// Two distinct jobs:
// class-transformer: plain object  ->  CreateUserDto instance
// class-validator:   run @IsEmail / @MinLength on that instance
// ValidationPipe does both automatically when whitelist + transform are on (see 5.7).
```

### `zod` as an Alternative

`class-validator` is decorator/class-based (closest to .NET attributes). `zod` is schema-first and gives you both runtime validation *and* a static type from one source — no decorators, works on plain objects, integrates via `nestjs-zod`.

```ts
// zod alternative — one schema yields validation + the TS type
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// The DTO type is INFERRED from the schema — single source of truth.
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Parse at the boundary; throws a ZodError your filter maps to 400.
const input = CreateUserSchema.parse(rawBody);
```

Pick one per project. `class-validator` integrates more idiomatically with Nest pipes and Swagger; `zod` is preferred when you already use it for env/config validation (Phase 3) and want a single validation story.

---

## 5.6 Infrastructure Layer

Infrastructure is where the interfaces get real implementations. It imports the domain (to implement its interfaces) and the outside world (Prisma, axios, Redis).

### PrismaModule — Wrapping PrismaClient as a Provider

`PrismaClient` is wrapped in an `@Injectable()` service so it participates in DI and the Nest lifecycle (connect on startup, disconnect on shutdown). This is your `DbContext` registered in DI.

```ts
// infrastructure/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();      // open the pool when the module boots
  }
  async onModuleDestroy() {
    await this.$disconnect();   // clean shutdown (pairs with app.enableShutdownHooks())
  }
}
```

```ts
// infrastructure/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()                       // make PrismaService injectable everywhere without re-importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Repository Implementation

The implementation translates between domain objects and Prisma rows. The **mapping** (domain `User` ⇄ Prisma row) lives here — the only place that knows both worlds.

```ts
// infrastructure/persistence/prisma-user.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../../domain/user/user.repository';   // implements the interface
import { User } from '../../domain/user/user.entity';
import { Email } from '../../domain/user/value-objects/email.vo';
import { UserId } from '../../domain/user/value-objects/user-id.vo';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;   // map DB row -> rich entity
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    // Upsert keeps create + update in one place; map entity -> DB shape (toPersistence).
    await this.prisma.user.upsert({
      where: { id: user.id.value },
      create: {
        id: user.id.value,
        email: user.email.value,
        password: user.passwordHash,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      update: {
        email: user.email.value,
        password: user.passwordHash,
        isVerified: user.isVerified,
      },
    });
  }

  // Private mapper: Prisma row -> domain entity (rehydration, no events fired).
  private toDomain(row: {
    id: string; email: string; password: string; isVerified: boolean; createdAt: Date;
  }): User {
    return User.fromPersistence({
      id: row.id,
      email: row.email,
      passwordHash: row.password,
      isVerified: row.isVerified,
      createdAt: row.createdAt,
    });
  }
}
```

### External HTTP Clients — `@nestjs/axios` HttpModule

`HttpModule` wraps axios as an injectable `HttpService` returning RxJS Observables. Wrap third-party APIs behind a domain interface too, so the application layer depends on *your* abstraction, not on axios.

```ts
// infrastructure/http/geo.client.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeoClient {
  constructor(private readonly http: HttpService) {}

  async countryForIp(ip: string): Promise<string> {
    // HttpService returns an Observable; firstValueFrom converts to a Promise.
    const res = await firstValueFrom(this.http.get(`https://ipapi.co/${ip}/country/`));
    return res.data;
  }
}
```

```ts
// register with timeouts/retries in a module
HttpModule.register({ timeout: 5000, maxRedirects: 3 });
```

### Redis for Caching / Sessions

Wrap Redis as a provider (e.g. via `ioredis`) and expose a small interface. Use it for cache-aside reads, rate-limit counters, refresh-token storage (Phase 6).

```ts
// infrastructure/cache/redis.module.ts
import { Module } from '@nestjs/common';
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS',                         // token
      useFactory: () => new Redis(process.env.REDIS_URL!), // single shared connection
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
```

---

## 5.7 Presentation Layer

### Thin Controllers — Just Dispatch to the Bus

The controller does *nothing but* translate HTTP ⇄ bus messages. No business logic, no DB. Compare to the fat controller in 5.1 — all that logic now lives in the handler.

```ts
// presentation/http/users.controller.ts
import { Body, Controller, Get, Param, Post, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CreateUserDto } from '../../application/user/dto/create-user.dto';
import { CreateUserCommand } from '../../application/user/commands/create-user.command';
import { GetUserByIdQuery } from '../../application/user/queries/get-user-by-id.query';
import { UserResponse } from '../../application/user/dto/user.response';

@Controller('users')                 // base route — ≈ [Route("users")] [ApiController]
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus, // ≈ ISender (writes)
    private readonly queryBus: QueryBus,     // ≈ ISender (reads)
  ) {}

  @Version('1')                       // -> /v1/users
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<{ id: string }> {
    // ValidationPipe already validated `dto`. Just hand off to the command bus.
    return this.commandBus.execute(new CreateUserCommand(dto.email, dto.password));
  }

  @Version('1')
  @Get(':id')                         // -> GET /v1/users/:id
  async getById(@Param('id') id: string): Promise<UserResponse> {
    return this.queryBus.execute(new GetUserByIdQuery(id));
  }
}
```

### Global `ValidationPipe`

Register the pipe once in `main.ts`. `whitelist` strips unknown properties (security — drops fields a client tries to smuggle in); `forbidNonWhitelisted` rejects them outright; `transform` produces real DTO instances.

```ts
// main.ts (excerpt)
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,             // strip props not in the DTO (≈ ignore unknown JSON)
    forbidNonWhitelisted: true,  // 400 if client sends extra props
    transform: true,             // plain object -> DTO class instance (enables type coercion)
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

### Global Exception Filter — Domain Errors → HTTP

The filter is the single translation point from domain/app exceptions to HTTP status codes. Domain stays HTTP-ignorant; the filter owns the mapping. Full RFC 7807 version is in 5.8.

```ts
// presentation/http/domain-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  DomainError, UserNotFoundError, EmailAlreadyTakenError,
} from '../../domain/user/user.errors';

@Catch(DomainError)                  // only catches our domain errors; others fall through
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Map domain error TYPE -> HTTP status. The domain never knew these numbers.
    const status =
      error instanceof UserNotFoundError ? HttpStatus.NOT_FOUND :       // 404
      error instanceof EmailAlreadyTakenError ? HttpStatus.CONFLICT :   // 409
      HttpStatus.BAD_REQUEST;                                           // 400 default

    res.status(status).json({ message: error.message, code: error.name });
  }
}
```

### API Versioning — `@nestjs/versioning`

Enable versioning once; then `@Version('1')` (or controller-level) selects the version. URI versioning is the most common (`/v1/users`).

```ts
// main.ts (excerpt)
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,   // /v1/... ; alternatives: HEADER, MEDIA_TYPE
  defaultVersion: '1',
});
```

### Wiring It All — The Composition Root

This is where Clean Architecture is *assembled*: the token binds the domain interface to the Prisma implementation. This file is the only place that knows every layer — the .NET `Program.cs`.

```ts
// users.module.ts — the composition root for the User feature
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { UsersController } from './presentation/http/users.controller';
import { CreateUserHandler } from './application/user/commands/create-user.handler';
import { GetUserByIdHandler } from './application/user/queries/get-user-by-id.handler';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { USER_REPOSITORY } from './infrastructure/tokens';

const CommandHandlers = [CreateUserHandler];
const QueryHandlers = [GetUserByIdHandler];

@Module({
  imports: [CqrsModule],            // provides CommandBus / QueryBus / EventBus
  controllers: [UsersController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    // THE INVERSION: domain interface token -> infrastructure implementation.
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class UsersModule {}
```

---

## 5.8 Cross-Cutting Concerns

### Structured Logging — Pino + `nestjs-pino`

`pino` emits JSON logs (machine-parseable, fast). `nestjs-pino` wires it as the Nest logger and auto-logs each request/response. This is your **Serilog** equivalent — structured logs, not `console.log` strings.

```ts
// app.module.ts (excerpt)
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    // Pretty-print only in dev; raw JSON in prod (for ELK/Loki ingestion).
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
    // Attach the correlation id (see below) to EVERY log line of a request.
    customProps: (req) => ({ correlationId: (req as any).correlationId }),
    redact: ['req.headers.authorization', 'req.body.password'], // never log secrets
  },
});
```

### `AsyncLocalStorage` — Correlation IDs Without Param Drilling

A correlation id ties all logs of one request together (and propagates across services in Phase 8). `AsyncLocalStorage` (from Phase 3) carries it implicitly through the async call chain — the **`IHttpContextAccessor`** of Node.js. No passing it through every function.

```ts
// infrastructure/context/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface Store { correlationId: string; }
export const requestContext = new AsyncLocalStorage<Store>();

// A middleware seeds the store at the very start of the request.
export function correlationMiddleware(req: any, _res: any, next: () => void) {
  const correlationId = req.headers['x-correlation-id'] ?? crypto.randomUUID();
  req.correlationId = correlationId;
  // Everything downstream (handlers, repos) runs inside this store —
  // requestContext.getStore()?.correlationId is available without passing args.
  requestContext.run({ correlationId }, () => next());
}
```

```ts
// Anywhere deep in the call chain — pull the id without it being a parameter:
const cid = requestContext.getStore()?.correlationId;
```

### Global ExceptionFilter — RFC 7807 Problem Details

RFC 7807 is the standard "Problem Details" error shape (`type`, `title`, `status`, `detail`, `instance`) — identical to ASP.NET Core's `ProblemDetails`. A catch-all filter produces a consistent body for every error.

```ts
// presentation/http/problem-details.filter.ts
import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError, UserNotFoundError, EmailAlreadyTakenError } from '../../domain/user/user.errors';
import { requestContext } from '../../infrastructure/context/request-context';

@Catch()                              // catch EVERYTHING (last line of defence)
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // Decide status + title from the error type.
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';

    if (error instanceof HttpException) {           // Nest HTTP errors (incl. validation 400)
      status = error.getStatus();
      title = error.name;
      detail = error.message;
    } else if (error instanceof UserNotFoundError) {
      status = HttpStatus.NOT_FOUND; title = 'Resource Not Found'; detail = error.message;
    } else if (error instanceof EmailAlreadyTakenError) {
      status = HttpStatus.CONFLICT; title = 'Conflict'; detail = error.message;
    } else if (error instanceof DomainError) {
      status = HttpStatus.BAD_REQUEST; title = 'Bad Request'; detail = error.message;
    }

    // Log 5xx with the correlation id so you can trace it in your log store.
    if (status >= 500) {
      this.logger.error(
        { err: error, correlationId: requestContext.getStore()?.correlationId },
        'Unhandled error',
      );
    }

    // RFC 7807 body — same shape as ASP.NET ProblemDetails.
    res.status(status).type('application/problem+json').json({
      type: `https://httpstatuses.io/${status}`,
      title,
      status,
      detail,
      instance: req.url,
      correlationId: requestContext.getStore()?.correlationId, // tie error to logs
    });
  }
}
```

Register it globally in `main.ts`: `app.useGlobalFilters(new ProblemDetailsFilter());`. Order: more specific filters (`@Catch(DomainError)`) before the catch-all if you register several — Nest applies the last-matching.

### Audit Fields via Prisma Middleware (Client Extension)

Auto-stamp `createdAt`/`updatedAt` (and optionally `createdBy` from the correlation context) so handlers never set them manually. This is your EF Core `SaveChanges` override / interceptor.

```ts
// infrastructure/prisma/prisma.service.ts (audit via Client Extension — modern Prisma)
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      // Runs on every write — stamp timestamps automatically.
      async create({ args, query }) {
        args.data = { ...args.data, createdAt: new Date(), updatedAt: new Date() };
        return query(args);
      },
      async update({ args, query }) {
        args.data = { ...args.data, updatedAt: new Date() }; // bump on every update
        return query(args);
      },
    },
  },
});
// (Older Prisma used prisma.$use((params, next) => {...}) middleware — same idea.)
```

---

## Gotchas

- **`emitDecoratorMetadata` must be `true`** in `tsconfig.json`, or DI by type silently breaks — Nest can't read constructor param types. Also enable `experimentalDecorators`.
- **You cannot inject an interface by type.** Interfaces don't exist at runtime in JS. Always bind via a `Symbol`/string token (`{ provide: TOKEN, useClass: Impl }`) and `@Inject(TOKEN)`.
- **Default provider scope is singleton**, not scoped (opposite of EF's typical `AddScoped`). A `REQUEST`-scoped provider makes its *entire* dependency chain request-scoped — measurable perf hit. Use `AsyncLocalStorage` for request data instead.
- **Lifecycle order is fixed:** Middleware → Guards → Interceptors(pre) → Pipes → Handler → Interceptors(post) → Filters. Putting auth logic in a pipe or validation in a guard fights the framework.
- **`@nestjs/cqrs` `EventBus` is in-process and synchronous by default** — not a durable message queue. For cross-service or guaranteed delivery, publish to RabbitMQ/BullMQ (Phase 8). Don't treat domain-event handlers as transactional with the command unless you make them so (outbox pattern).
- **`HttpService` returns RxJS Observables, not Promises.** Wrap with `firstValueFrom()` or you'll `await` an Observable (which doesn't do what you think).
- **Returning a domain entity from a query handler leaks internals** (e.g. `passwordHash`). Always map to an output DTO at the application boundary.
- **`class-validator` needs `transform: true`** on `ValidationPipe` to receive a real class instance; on a plain object the decorators don't run as expected. Forgetting it means validation appears to "not work".
- **Circular module dependencies** (`UsersModule` ↔ `AuthModule`) throw at boot. Use `forwardRef(() => OtherModule)` — but prefer restructuring; a cycle usually signals a missing shared module.
- **Don't put `@Injectable()` in the domain layer.** The moment the domain imports from `@nestjs/common`, you've coupled your core to the framework. Keep it pure TS.
- **`app.enableShutdownHooks()` is required** for `onModuleDestroy` (Prisma `$disconnect`) to fire on `SIGTERM`. Without it, connections leak on container shutdown (relevant in Phase 9).

---

## Phase 5 Project

**Task:** Rebuild the Phase 4 Products + Orders API from scratch using Clean Architecture — NestJS, `@nestjs/cqrs`, Prisma, rich domain entities, an application layer of commands/queries, and thin controllers. Same database and behaviour as Phase 4; completely different *structure*.

**Why:** This is the direct parallel to your .NET Clean Architecture phase. You already have the schema and the queries from Phase 4 — the work here is *architecture*, not features. The payoff: domain logic you can unit-test with zero mocks, and a controller you could swap from REST to GraphQL without touching a business rule.

**Location:** `examples/phase5-clean-arch/`

**Folder structure:**

```
examples/phase5-clean-arch/
├── prisma/
│   └── schema.prisma            # reuse Phase 4 schema: Product, Order, OrderItem
├── src/
│   ├── main.ts                  # ValidationPipe, versioning, global filter, shutdown hooks
│   ├── app.module.ts            # composition root: imports all feature + infra modules
│   │
│   ├── domain/
│   │   ├── product/
│   │   │   ├── product.entity.ts        # rich: changePrice(), decrementStock() guard invariants
│   │   │   ├── value-objects/           money.vo.ts, product-id.vo.ts, sku.vo.ts
│   │   │   ├── product.repository.ts    # interface
│   │   │   └── product.errors.ts        # InsufficientStockError, etc.
│   │   └── order/
│   │       ├── order.entity.ts          # aggregate root: addItem(), total(), place()
│   │       ├── order-item.ts            # entity within the Order aggregate
│   │       ├── events/                  order-placed.event.ts
│   │       ├── order.repository.ts      # interface
│   │       └── order.errors.ts
│   │
│   ├── application/
│   │   ├── product/
│   │   │   ├── commands/   create-product, adjust-stock (+ handlers)
│   │   │   ├── queries/    get-product-by-id, list-products (+ handlers)
│   │   │   └── dto/
│   │   └── order/
│   │       ├── commands/   place-order (+ handler — uses $transaction)
│   │       ├── queries/    get-order, sales-report (raw-SQL read model)
│   │       └── dto/
│   │
│   ├── infrastructure/
│   │   ├── tokens.ts                    # PRODUCT_REPOSITORY, ORDER_REPOSITORY symbols
│   │   ├── prisma/                      prisma.service.ts (+ audit extension), prisma.module.ts
│   │   ├── persistence/                 prisma-product.repository.ts, prisma-order.repository.ts
│   │   └── context/                     request-context.ts (AsyncLocalStorage)
│   │
│   └── presentation/
│       └── http/
│           ├── products.controller.ts   # thin — dispatches to the bus
│           ├── orders.controller.ts
│           └── problem-details.filter.ts # RFC 7807
└── package.json
```

**Step hints:**

1. **Scaffold:** `nest new phase5-clean-arch`. Add `@nestjs/cqrs`, `@prisma/client`, `class-validator`, `class-transformer`, `nestjs-pino`, `pino-pretty`, `argon2` (if you carry users over).
2. **Domain first, no framework:** build `Product`, `Order`, value objects, repository *interfaces*, and domain errors as pure TS. Write unit tests for the invariants now (e.g. "placing an order with insufficient stock throws") — they need no DB and no Nest.
3. **Application layer:** one command per write use case (`CreateProductCommand`, `PlaceOrderCommand`), one query per read (`GetProductByIdQuery`, `SalesReportQuery`). Handlers depend only on repository *interfaces* via tokens. The `PlaceOrderHandler` should wrap stock-decrement + order-insert in `prisma.$transaction` (your Phase 4 atomic write, now behind a repo).
4. **Infrastructure:** `PrismaService` + module; implement each repository, doing the entity ⇄ row mapping in private `toDomain`/`toPersistence` methods. Add the audit Client Extension. Keep the Phase 4 raw-SQL reporting query — expose it through the `SalesReportQuery` handler (the read-side shortcut: project Prisma → DTO directly).
5. **Presentation:** thin controllers calling `commandBus`/`queryBus` only. Add `@nestjs/versioning` (`/v1`). DTOs with `class-validator`.
6. **Cross-cutting in `main.ts`:** global `ValidationPipe` (`whitelist`, `transform`), correlation-id middleware + `AsyncLocalStorage`, `nestjs-pino` logger, global `ProblemDetailsFilter` (RFC 7807), `app.enableShutdownHooks()`.
7. **Wire the composition root:** in each feature module, bind `{ provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository }`. Confirm no `domain/` file imports from `application/`, `infrastructure/`, or `@nestjs/*` (except the harmless `IEvent`/`ICommand` markers if you chose to use them).

**Done when:**
- The same endpoints as Phase 4 work, with identical behaviour.
- Every business rule lives in the domain or a handler — controllers contain no logic.
- Domain unit tests pass with zero mocks; handler tests pass with a fake repository implementing the interface (preview of Phase 7).
- Errors come back as RFC 7807 Problem Details with a correlation id, and every log line carries that same id.

---

## Interview Questions

### Clean Architecture Principles

1. What is the Dependency Rule in Clean Architecture, and why does violating it in even one place undermine the whole architecture?
2. Explain the difference between the direction of control flow and the direction of source-code dependency in Clean Architecture, and why they can point in opposite directions.
3. How does Dependency Inversion (the D in SOLID) make the inward-only dependency rule possible in practice?
4. What distinguishes an anemic domain model from a rich domain model, and what concrete problems does each approach cause in a large codebase?
5. Why does the domain layer define repository *interfaces* rather than letting the application layer call infrastructure directly?
6. What is the "composition root" and why should it be the only place that knows every layer?
7. If you find yourself importing a Prisma type inside a domain entity, what architectural boundary has been violated, and how would you fix it?
8. How would you enforce the layer dependency rule automatically in a Node.js project that has no compiler to do it for you?
9. What is the trade-off between putting domain-event dispatching in the domain entity itself versus letting the application layer pull and publish events after the save?
10. Why does the domain layer in this architecture contain no `@Injectable()` decorators, and what happens if it does?

### NestJS Core

11. Explain the difference between a Module, a Provider, and a Service in NestJS, and how they relate to each other.
12. What does `emitDecoratorMetadata: true` do in `tsconfig.json`, and what breaks if you leave it out?
13. Walk through the full NestJS request lifecycle in order — which stage runs first and why does that order matter for real-world concerns like auth and validation?
14. What is the difference between `exports` and `providers` in a `@Module()` decorator, and what happens if you forget to export a provider that another module needs?
15. Why would you use `@Global()` on a module, and what are the risks of overusing it?
16. What is the purpose of `OnModuleInit` and `OnModuleDestroy`, and what real-world problem do they solve for database connections?
17. How does NestJS resolve constructor dependencies at startup, and what error do you get when a dependency cannot be resolved?
18. What happens when two modules have a circular dependency, and what does `forwardRef` actually do to break the cycle?
19. How does NestJS's DI container differ from ASP.NET Core's `IServiceCollection` in terms of default provider scope, and why does that difference matter?
20. What is the role of `CqrsModule` in the composition root, and what would break if you forgot to import it?

### Dependency Injection

21. Why can you not inject a TypeScript interface by type in NestJS, even though you can in ASP.NET Core?
22. What is the difference between using a `string` token, a `Symbol` token, and a class as a DI token, and when would you prefer each?
23. Explain the difference between `useClass`, `useValue`, `useFactory`, and `useExisting` provider definitions — give a concrete use case for each.
24. What is the `REQUEST` provider scope, why does it force the entire dependency chain to become request-scoped, and what is the recommended alternative for carrying per-request data?
25. How would you inject a configuration value (e.g. a database URL) from `ConfigService` into an infrastructure provider without coupling the provider to `@nestjs/config`?
26. What does `@Inject(TOKEN)` do differently from relying on type-based injection, and when is it required?
27. How would you write a unit test for a command handler that depends on a `UserRepository` interface — what do you inject in place of the real repository?
28. Explain what `AsyncLocalStorage` is, how it replaces request-scoped DI for carrying request context, and what the performance difference is.
29. If two feature modules both need a `LoggerService`, how would you share it without repeating the provider registration?
30. What is a "factory provider" (`useFactory`) and how would you use one to create a Redis client that requires async initialization?

### Pipes, Guards & Interceptors

31. Explain the architectural difference between a Guard and a Pipe — what question does each one answer, and why can't a Pipe do authorization?
32. What does the `whitelist: true` option on `ValidationPipe` do, and what security problem does it prevent?
33. Why does `ValidationPipe` need `transform: true` to work correctly with `class-validator` decorators, and what happens without it?
34. How would you write a custom Pipe that converts a route param string into a domain Value Object, and at what point in the lifecycle does it run?
35. What is the difference between applying a Guard at the method level with `@UseGuards()` versus registering it globally in `main.ts`?
36. How do Interceptors differ from Middleware in NestJS, and what can an Interceptor do that Middleware cannot?
37. Explain the RxJS `Observable` contract that an Interceptor's `intercept` method must return, and why wrapping `next.handle()` gives you both the pre- and post-handler execution points.
38. How would you implement a response-transformation Interceptor that wraps every successful response in a `{ data: T, timestamp: string }` envelope without touching any controller?
39. What is an Exception Filter, where does it sit in the request lifecycle relative to Interceptors, and what is the purpose of `@Catch()` with no arguments?
40. How would you implement the RFC 7807 Problem Details shape in a global Exception Filter, and how does it map domain exceptions to HTTP status codes without the domain knowing HTTP?
41. What is the difference between registering a filter with `app.useGlobalFilters()` in `main.ts` versus with `APP_FILTER` in a module's providers, and when does the difference matter for DI?
42. If a Guard throws an exception, does the Interceptor's post-handler logic still run? Explain why or why not.

### CQRS

43. What does CQRS stand for, and what problem does separating Commands from Queries solve compared to a single service class with both read and write methods?
44. What is the difference between a Command and a Query in `@nestjs/cqrs`, and what should each return?
45. Explain how `@nestjs/cqrs` relates to MediatR in .NET — what is the equivalent of `ISender.Send()`, `INotification`, and `INotificationHandler`?
46. Why does a controller dispatch a `Command` to `CommandBus` rather than calling a service method directly, and what does that indirection give you architecturally?
47. What is the role of `EventPublisher` and `mergeObjectContext` in `@nestjs/cqrs`, and what problem would you have publishing domain events without them?
48. Explain the read-side shortcut in CQRS: when is it acceptable for a query handler to bypass the domain entity and project Prisma rows directly into a DTO?
49. What is the "Outbox Pattern" and why is it relevant when `@nestjs/cqrs`'s in-process `EventBus` is not sufficient for guaranteed domain-event delivery?
50. How would you handle a domain event (`UserRegisteredEvent`) to send a welcome email without coupling the email logic to the `CreateUserHandler`?
51. If a command handler and its domain event handler need to be atomic (both succeed or both roll back), how would you design that, given that the event bus runs after the save?
52. What is the trade-off between having many small command handlers versus fewer larger ones that orchestrate multiple domain operations?

### Repository Pattern

53. Why does the `UserRepository` interface speak only in domain types (`UserId`, `Email`, `User`) and never in Prisma types, even though the implementation uses Prisma?
54. Where does the mapping between a domain entity and a database row belong, and why is it wrong to put that mapping in the application layer?
55. What is the difference between `save(user)` with an upsert versus having separate `create` and `update` methods on a repository, and what are the trade-offs?
56. How would you handle a case where a query needs data from two aggregates — should the repository return both, or should the query handler call two repositories?
57. Explain why using Prisma's generated types directly as return values from a repository method is an architectural violation, even if it's convenient.
58. How would you implement a transactional `PlaceOrderHandler` that decrements stock on a `ProductRepository` and creates an order on an `OrderRepository` atomically using Prisma?
59. What is a "read model" in the context of CQRS, and how does it differ from calling the same repository used on the write side?
60. If you needed to swap Prisma for Drizzle ORM, which files would need to change and which would not, assuming the repository pattern is correctly applied?

### Module Organization

61. How would you decide whether to put a feature's command handlers, repository binding, and controller in a single "feature module" versus splitting them across separate application and infrastructure modules?
62. What is the difference between a feature module and a shared/common module in a NestJS monolith, and when should a provider be extracted into a shared module?
63. How does NestJS module scoping prevent provider name collisions between features, and what does that mean for token naming strategy?
64. What are the risks of the `@Global()` decorator, and what patterns make it safe versus problematic?
65. How would you organize a NestJS project to prepare it for extraction into separate microservices later — what folder boundaries would you draw today?

### Domain Layer Design

66. Why does a Value Object use a private constructor with a static factory method rather than a public constructor with validation in the body?
67. What is the difference between a domain entity and a Value Object in terms of identity, mutability, and equality?
68. Explain the two static factory methods on the `User` entity — `register` and `fromPersistence` — and why they must remain separate.
69. Why do domain exceptions extend a base `DomainError` class rather than throwing plain `Error` objects, and how does the exception filter use that hierarchy?
70. What does it mean for an entity to "record" a domain event versus "dispatch" it, and why is that distinction important for transactional safety?
71. How would you design a `Money` Value Object to prevent floating-point precision errors, and what operations should it expose?
72. If a domain entity's invariant depends on data that only a database query can provide (e.g. uniqueness), where does that check belong — in the entity, the application handler, or the repository — and why?
73. What is a "branded" or "opaque" ID Value Object (like `UserId`), and how does it prevent passing a `ProductId` where a `UserId` is expected at compile time?
