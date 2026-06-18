# Phase 7 — Testing

> **Mental model from .NET:** `Jest = xUnit`, `jest.fn()/jest.mock() = Moq`, `supertest = WebApplicationFactory + HttpClient`, `testcontainers (npm) = Testcontainers (.NET)`. The architecture of a good test suite is identical across both stacks — only the syntax differs. Everything you know about the test pyramid, AAA (Arrange-Act-Assert), and "don't mock what you don't own" transfers directly.

---

## 7.1 Jest Fundamentals (Refresher + Advanced)

### `describe` / `it` / `expect`

Jest's structure maps cleanly onto xUnit, but the grouping is explicit and nestable rather than class-based.

```ts
// describe = a test class / logical grouping (xUnit has no direct equivalent — it's the file/class)
describe('Money', () => {
  // it (alias: test) = [Fact] in xUnit
  it('adds two amounts of the same currency', () => {
    // Arrange
    const a = new Money(100, 'USD');
    const b = new Money(50, 'USD');

    // Act
    const sum = a.add(b);

    // Assert — expect(...).matcher() is Assert.Equal(...) in xUnit
    expect(sum.amount).toBe(150);
  });
});
```

Common matchers (the `Assert.*` equivalents):

```ts
expect(2 + 2).toBe(4);                 // Assert.Equal — Object.is, strict identity for primitives
expect({ a: 1 }).toEqual({ a: 1 });    // Assert.Equal — DEEP structural equality (use this for objects)
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); // partial match — only checks listed keys
expect([1, 2, 3]).toContain(2);        // Assert.Contains
expect(value).toBeNull();              // Assert.Null
expect(value).toBeDefined();           // not undefined
expect(value).toBeTruthy();            // loose truthiness — prefer specific matchers
expect(fn).toThrow(DomainError);       // Assert.Throws<DomainError>
expect(fn).toThrow('insufficient');    // throws AND message contains substring
await expect(promise).rejects.toThrow(NotFoundError); // async throw — note `await` + `.rejects`
await expect(promise).resolves.toBe(42);              // async resolve
```

**`toBe` vs `toEqual` — the #1 beginner trap.** `toBe` uses `Object.is` (reference identity for objects). Two structurally-identical objects are NOT `toBe` equal. Use `toEqual` (deep) for objects/arrays, `toBe` for primitives. (In xUnit, `Assert.Equal` already does structural comparison via `IEquatable`/records — Jest forces you to pick.)

### Lifecycle Hooks

Direct parallels to xUnit's constructor / `IDisposable` / `IClassFixture`:

```ts
describe('UserService', () => {
  let service: UserService;

  // beforeAll = IClassFixture constructor — runs ONCE for the whole describe block
  beforeAll(async () => {
    await connectToTestInfra();
  });

  // beforeEach = xUnit constructor — runs before EVERY test (fresh state per test)
  beforeEach(() => {
    service = new UserService(/* fresh mocks */);
  });

  // afterEach = IDisposable.Dispose — cleanup after every test
  afterEach(() => {
    jest.clearAllMocks(); // reset mock call history between tests (see below)
  });

  // afterAll = IClassFixture Dispose — runs ONCE at the end
  afterAll(async () => {
    await teardownTestInfra();
  });
});
```

**Execution order for nested describes:** all `beforeAll`s outer→inner, then per test: outer `beforeEach`→inner `beforeEach`→test→inner `afterEach`→outer `afterEach`. Same nesting semantics as collection/class/test fixtures in xUnit.

### `jest.fn()`, `jest.spyOn()`, `jest.mock()` — the Moq Trio

These are the three levels of test doubles. Map them onto Moq:

**`jest.fn()` — a standalone mock function (≈ `new Mock<T>()` for a delegate/interface method):**

```ts
// Create a mock function with a canned return — like .Setup(...).Returns(...)
const findById = jest.fn().mockResolvedValue({ id: '1', name: 'Alice' });
//                          ^ mockResolvedValue = Returns(Task.FromResult(...)) for async

const repo = { findById }; // hand-rolled mock object implementing the interface shape

await repo.findById('1');

// Assertions on calls — the Moq .Verify(...) equivalents:
expect(findById).toHaveBeenCalled();                  // Verify(x => x.FindById(It.IsAny()), Times.Once)
expect(findById).toHaveBeenCalledTimes(1);            // Times.Once
expect(findById).toHaveBeenCalledWith('1');           // Verify with specific arg
expect(findById).toHaveBeenNthCalledWith(1, '1');     // verify the Nth call's args
expect(findById).toHaveReturned();
```

Configuring behaviour (Moq `.Setup`):

```ts
const fn = jest.fn();
fn.mockReturnValue(42);                  // .Returns(42)
fn.mockResolvedValue(user);              // .ReturnsAsync(user)
fn.mockRejectedValue(new Error('boom')); // .ThrowsAsync(...)
fn.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValue(3); // sequence: 1, 2, 3, 3, 3...
fn.mockImplementation((x: number) => x * 2); // .Returns((int x) => x * 2) — full custom logic
```

**`jest.spyOn()` — wrap a real object's method, optionally intercept (≈ partial mock / `CallBase = true`):**

```ts
const logger = new Logger();

// Spy WITHOUT replacing — real method still runs, but calls are recorded
const spy = jest.spyOn(logger, 'warn');
logger.warn('hi');
expect(spy).toHaveBeenCalledWith('hi'); // recorded; real warn also executed

// Spy AND replace implementation (like Moq partial mock overriding one method)
jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

spy.mockRestore(); // restore the original — IMPORTANT, otherwise it leaks into other tests
```

**`jest.mock()` — module-level mocking (no clean Moq equivalent — closer to replacing the whole DI registration):**

```ts
// At the top of the file, BEFORE imports are used. Jest hoists this above imports.
jest.mock('./email-client'); // auto-mock: every export becomes a jest.fn() returning undefined

import { sendEmail } from './email-client';

it('sends a welcome email', async () => {
  (sendEmail as jest.Mock).mockResolvedValue({ ok: true });
  // ... code under test calls sendEmail internally ...
  expect(sendEmail).toHaveBeenCalledWith('alice@example.com', expect.any(String));
});
```

**Mock reset functions — know the difference (this trips people up):**

```ts
jest.clearAllMocks();   // clears call history (mock.calls, mock.results) — keeps implementations
jest.resetAllMocks();   // clears history AND removes mockImplementation/mockReturnValue
jest.restoreAllMocks(); // restores spies created with jest.spyOn back to originals
```

Best practice: `clearAllMocks()` in `afterEach` (or set `clearMocks: true` in config) so call counts don't bleed between tests. This is the equivalent of getting a fresh `Mock<T>` per test via the xUnit constructor.

### Module Mocking — `jest.mock('./path')`

There are three flavours:

```ts
// 1. Auto-mock — replace all exports with jest.fn()s
jest.mock('./payment-gateway');

// 2. Factory mock — provide your own replacement module
jest.mock('./config', () => ({
  getConfig: () => ({ apiUrl: 'http://test.local', timeout: 100 }),
}));

// 3. Partial mock with jest.requireActual — keep most, override some
jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils'); // the REAL module
  return {
    ...actual,
    randomId: jest.fn(() => 'fixed-id'), // override only this export
  };
});
```

> **Note for the NestJS world:** you rarely need `jest.mock()` for application/domain code because NestJS DI lets you swap providers (see 7.2). Reserve `jest.mock()` for mocking *third-party modules* and *Node built-ins* that aren't injected (e.g., `fs`, an SDK imported directly). In .NET you'd inject an interface instead — same instinct: prefer DI swapping over module patching.

### `jest.useFakeTimers()` — Controlling Time

The equivalent of injecting an `IClock`/`TimeProvider` (.NET 8+) — except Jest can fake time *globally* without you abstracting it.

```ts
describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers(); // hijack setTimeout, setInterval, Date.now, etc.
  });

  afterEach(() => {
    jest.useRealTimers(); // ALWAYS restore — fake timers leak across files otherwise
  });

  it('only fires once after the delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 1000);

    debounced();
    debounced();
    debounced(); // called 3x rapidly

    expect(fn).not.toHaveBeenCalled(); // nothing fired yet — no real time passed

    jest.advanceTimersByTime(1000); // fast-forward 1 second instantly
    //   ^ also: jest.runAllTimers() (run every pending timer)
    //          jest.runOnlyPendingTimers() (avoid infinite setInterval loops)

    expect(fn).toHaveBeenCalledTimes(1); // fired exactly once
  });
});
```

Faking `Date.now()` and `new Date()`:

```ts
jest.useFakeTimers();
jest.setSystemTime(new Date('2026-06-16T00:00:00Z')); // pin "now"

expect(Date.now()).toBe(new Date('2026-06-16T00:00:00Z').getTime());
expect(new Date().getFullYear()).toBe(2026);
```

> **Gotcha:** if your code uses `await`/promises *and* `setTimeout`, prefer `jest.advanceTimersByTimeAsync()` (the async variant) so the microtask queue gets flushed between timer ticks. Mixing fake timers with real promises is the single most common source of "my test hangs" bugs.

### TypeScript with Jest: `ts-jest` vs `@swc/jest`

Jest runs JS; your tests are TS — so you need a transform.

| Transform | How it works | Speed | Type-checks? |
|-----------|--------------|-------|--------------|
| `ts-jest` | Runs the real TS compiler (`tsc`) per file | Slower | **Yes** — fails the test run on type errors |
| `@swc/jest` | Transpiles via SWC (Rust), strips types only | **Much faster** | No — types checked separately by `tsc --noEmit` in CI |

```js
// jest.config.js — @swc/jest (recommended for large suites; type-check separately)
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': '@swc/jest', // strips types, blazing fast — no type safety at test time
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1', // mirror tsconfig "paths"
  },
};
```

```js
// jest.config.js — ts-jest (type errors fail the test; slower)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
```

**Recommendation:** `@swc/jest` for runtime + a separate `tsc --noEmit` step in CI. You get fast tests *and* type safety, just decoupled. This is analogous to `dotnet build` (type check) and `dotnet test` (run) being separate phases.

---

## 7.2 Unit Testing

A unit test exercises one unit in isolation — **no DB, no HTTP, no real clock, no file system.** Same definition as the .NET track.

### Testing Domain Logic in Isolation

Domain entities and value objects have *no dependencies* (that's the point of Clean Architecture), so their tests need **no mocks at all** — the cleanest tests you'll ever write.

```ts
// domain/entities/order.ts
export class Order {
  private items: OrderItem[] = [];
  private constructor(public readonly id: string, private status: OrderStatus) {}

  static create(id: string): Order {
    return new Order(id, 'DRAFT');
  }

  addItem(productId: string, quantity: number, unitPrice: number): void {
    if (this.status !== 'DRAFT') {
      throw new DomainError('Cannot modify a submitted order');
    }
    if (quantity <= 0) {
      throw new DomainError('Quantity must be positive');
    }
    this.items.push(new OrderItem(productId, quantity, unitPrice));
  }

  get total(): number {
    return this.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  }

  submit(): void {
    if (this.items.length === 0) {
      throw new DomainError('Cannot submit an empty order');
    }
    this.status = 'SUBMITTED';
  }
}
```

```ts
// domain/entities/order.spec.ts — PURE unit test, zero mocks
import { Order } from './order';
import { DomainError } from '../errors/domain-error';

describe('Order', () => {
  describe('addItem', () => {
    it('addItem / draft order / accumulates into the total', () => {
      // Arrange
      const order = Order.create('order-1');

      // Act
      order.addItem('product-1', 2, 10); // 2 × 10 = 20
      order.addItem('product-2', 1, 5);  // 1 × 5  = 5

      // Assert — one logical assertion (the computed total)
      expect(order.total).toBe(25);
    });

    it('addItem / non-positive quantity / throws DomainError', () => {
      const order = Order.create('order-1');

      // expect(() => ...) wraps the throwing call — Assert.Throws<DomainError>
      expect(() => order.addItem('product-1', 0, 10)).toThrow(DomainError);
    });

    it('addItem / submitted order / rejects modification', () => {
      const order = Order.create('order-1');
      order.addItem('product-1', 1, 10);
      order.submit();

      expect(() => order.addItem('product-2', 1, 5)).toThrow('Cannot modify');
    });
  });

  describe('submit', () => {
    it('submit / empty order / throws', () => {
      const order = Order.create('order-1');
      expect(() => order.submit()).toThrow('Cannot submit an empty order');
    });
  });
});
```

This is *identical* in spirit to a pure xUnit `[Fact]` test of a C# domain entity — no Moq, no fixtures, just the object and its invariants.

### Testing Value Objects

Value objects are immutable and identity-less — test construction validation and equality.

```ts
// domain/value-objects/email.spec.ts
describe('Email', () => {
  it('create / valid address / normalises to lowercase', () => {
    const email = Email.create('Alice@Example.COM');
    expect(email.value).toBe('alice@example.com');
  });

  it('create / missing @ / throws', () => {
    expect(() => Email.create('not-an-email')).toThrow(DomainError);
  });

  it('equals / same value / are equal', () => {
    // VOs compare by value, not reference (like C# record struct)
    const a = Email.create('a@b.com');
    const b = Email.create('a@b.com');
    expect(a.equals(b)).toBe(true);
  });
});
```

### Testing NestJS Services with `Test.createTestingModule()`

When a service has dependencies (repositories, other services), use the NestJS testing module to build a real DI container and inject **mock providers**. This is the equivalent of constructing a SUT with mocked constructor args, but routed through the real DI container so `@Injectable()` wiring is exercised.

```ts
// application/users/create-user.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserHandler } from './create-user.handler';
import { USER_REPOSITORY, UserRepository } from '../../domain/users/user.repository';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  // Typed mock — jest.Mocked<T> makes every method a jest.fn() with full type safety
  let repo: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    // Build a hand-rolled mock implementing the repository INTERFACE.
    // Equivalent to: var repoMock = new Mock<IUserRepository>();
    const repoMock: jest.Mocked<UserRepository> = {
      findByEmail: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserHandler, // the REAL SUT
        // Swap the repo token for our mock — { provide, useValue } is the key pattern.
        // This is services.AddScoped<IUserRepository>(_ => repoMock.Object) for a test.
        { provide: USER_REPOSITORY, useValue: repoMock },
      ],
    }).compile();

    handler = module.get(CreateUserHandler);
    repo = module.get(USER_REPOSITORY); // pull the SAME mock instance back out to assert on it
  });

  afterEach(() => jest.clearAllMocks());

  it('execute / new email / saves the user and returns its id', async () => {
    // Arrange — set up the mock (Moq .Setup)
    repo.findByEmail.mockResolvedValue(null); // no existing user
    repo.save.mockResolvedValue(undefined);

    // Act
    const result = await handler.execute(
      new CreateUserCommand('alice@example.com', 'Alice'),
    );

    // Assert — behaviour: the repo was asked to save (Moq .Verify)
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.objectContaining({ value: 'alice@example.com' }) }),
    );
    expect(result.id).toBeDefined();
  });

  it('execute / duplicate email / throws and never saves', async () => {
    // Arrange — an existing user is returned
    repo.findByEmail.mockResolvedValue({ id: '1', email: Email.create('alice@example.com') } as any);

    // Act + Assert — async throw needs await + .rejects
    await expect(
      handler.execute(new CreateUserCommand('alice@example.com', 'Alice')),
    ).rejects.toThrow(DuplicateEmailError);

    // And critically — no write happened (verify the negative)
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

> **`{ provide, useValue }` is the workhorse.** The repository is registered under an injection *token* (`USER_REPOSITORY`, usually a `Symbol` or string, because TS interfaces vanish at runtime and can't be DI tokens — unlike C# interfaces). In tests you provide `useValue: mock` for that token. Other forms: `useClass` (swap for a fake class), `useFactory` (compute the provider).

### Testing CQRS Command/Query Handlers

In `@nestjs/cqrs`, handlers are just `@Injectable()` classes with an `execute()` method — so they unit-test exactly like the service above. You don't need the command/query *bus* in a unit test; instantiate the handler directly with mocked deps and call `execute()`.

```ts
// Query handler test — same shape, read side
describe('GetUserByIdHandler', () => {
  let handler: GetUserByIdHandler;
  let repo: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    repo = { findById: jest.fn(), save: jest.fn(), findByEmail: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [GetUserByIdHandler, { provide: USER_REPOSITORY, useValue: repo }],
    }).compile();
    handler = module.get(GetUserByIdHandler);
  });

  it('execute / unknown id / throws NotFoundError', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(handler.execute(new GetUserByIdQuery('nope'))).rejects.toThrow(NotFoundError);
  });
});
```

> You *could* skip `Test.createTestingModule` entirely and just write `new CreateUserHandler(repoMock)` for the purest unit test — that's faster and perfectly valid. Use the testing module when you want NestJS to do the wiring (catches DI misconfiguration) or when the SUT has many deps.

---

## 7.3 Integration Testing

An integration test wires up **real collaborators** (real services, real DI graph) and drives the app through its HTTP boundary. The DB may be mocked or real (real → see 7.4). This is the `WebApplicationFactory<Program>` + `HttpClient` pattern from .NET.

### `supertest` — HTTP Assertions Against an In-Process App

`supertest` makes real HTTP requests against your NestJS app *without binding a port* — it talks to the underlying Node `http.Server` in-memory. Exactly like `WebApplicationFactory.CreateClient()` returning an `HttpClient` that hits the in-memory test server (`TestServer`).

```ts
// test/users.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/domain/users/user.repository';

describe('Users (integration)', () => {
  let app: INestApplication;
  let repo: jest.Mocked<UserRepository>;

  beforeAll(async () => {
    repo = { findById: jest.fn(), findByEmail: jest.fn(), save: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule], // the WHOLE app — real controllers, pipes, handlers, DI graph
    })
      // overrideProvider = customizing services in WebApplicationFactory.WithWebHostBuilder(...)
      // Here we override JUST the repository so no real DB is touched.
      .overrideProvider(USER_REPOSITORY)
      .useValue(repo)
      .compile();

    app = moduleRef.createNestApplication();
    // Re-apply global config that main.ts normally sets — pipes/filters aren't auto-applied in tests
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init(); // boots the app WITHOUT app.listen() — no real port
  });

  afterAll(async () => {
    await app.close(); // dispose — releases handles so Jest exits cleanly
  });

  afterEach(() => jest.clearAllMocks());

  it('POST /users / valid body / 201 with created id', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockResolvedValue(undefined);

    // request(app.getHttpServer()) — the supertest entry; like client.PostAsJsonAsync(...)
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'alice@example.com', name: 'Alice' })
      .expect(201); // assert the status inline — also throws on mismatch

    expect(res.body).toMatchObject({ id: expect.any(String) });
    expect(repo.save).toHaveBeenCalledTimes(1); // verify it flowed all the way through to the repo
  });

  it('POST /users / invalid email / 400 from ValidationPipe', async () => {
    // This exercises the REAL ValidationPipe + class-validator — a key reason to integration-test
    await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'nope', name: '' })
      .expect(400);

    expect(repo.save).not.toHaveBeenCalled(); // pipe rejected before reaching the handler
  });

  it('GET /users/:id / unknown id / 404 via exception filter', async () => {
    repo.findById.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/users/unknown').expect(404);
    // ↑ verifies your global exception filter maps NotFoundError → 404 (the RFC 7807 mapping)
  });
});
```

**What integration tests catch that unit tests can't:** validation pipes, guards, interceptors, exception filters, serialization, routing, and the full DI graph actually resolving. This is the same value proposition as `WebApplicationFactory` tests in .NET — the request pipeline is real.

### Overriding Providers — the Full Toolkit

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(USER_REPOSITORY).useValue(mockRepo)       // swap for a mock object
  .overrideProvider(EmailService).useClass(FakeEmailService)  // swap for a fake class
  .overrideProvider(CONFIG).useFactory({ factory: () => testConfig }) // computed
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })  // bypass auth in tests
  .compile();
```

`overrideGuard` is especially handy — it's how you bypass `[Authorize]`-style guards so an integration test can hit a protected route without forging a JWT (or you inject a test token instead).

---

## 7.4 Database Testing with Testcontainers

The same concept, package, and philosophy as .NET Testcontainers: spin up a **real PostgreSQL in a throwaway Docker container** for the test run, run migrations against it, test the real repository implementations and SQL, then destroy it. No in-memory SQLite fakes, no shared dev DB — the DB under test is identical to production.

```bash
npm i -D testcontainers
# Requires a running Docker daemon (locally and in CI — same as .NET).
```

### Real Postgres Container Per Suite

```ts
// test/setup/postgres-container.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export interface TestDb {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  url: string;
}

export async function startTestDb(): Promise<TestDb> {
  // Boot a real Postgres 16 container — equivalent to new PostgreSqlBuilder().Build() in .NET
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Each container gets a random host port — read the generated connection string
  const url = container.getConnectionUri();

  // Run Prisma migrations against THIS container's DB.
  // `migrate deploy` applies committed migrations (CI-safe); `db push` is faster for a throwaway DB.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  // Point a PrismaClient at the container (override the env-based datasource URL)
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();

  return { container, prisma, url };
}

export async function stopTestDb(db: TestDb): Promise<void> {
  await db.prisma.$disconnect();
  await db.container.stop(); // destroy the container — Testcontainers also auto-reaps via Ryuk
}
```

### Using It in a Repository Integration Test

```ts
// infrastructure/users/prisma-user.repository.spec.ts
import { startTestDb, stopTestDb, TestDb } from '../../../test/setup/postgres-container';
import { PrismaUserRepository } from './prisma-user.repository';

describe('PrismaUserRepository (real Postgres)', () => {
  let db: TestDb;
  let repo: PrismaUserRepository;

  // One container for the whole file — booting Postgres takes a few seconds, so amortise it.
  // The Jest default per-test timeout is 5s; raise it for the container boot.
  beforeAll(async () => {
    db = await startTestDb();
    repo = new PrismaUserRepository(db.prisma);
  }, 60_000); // 60s timeout — pulling the image + boot can be slow on a cold cache

  afterAll(async () => {
    await stopTestDb(db);
  });

  // Cleanup strategy 1: TRUNCATE between tests — simple, resets identity sequences.
  afterEach(async () => {
    // CASCADE handles FKs; RESTART IDENTITY resets autoincrement counters.
    await db.prisma.$executeRawUnsafe('TRUNCATE TABLE "User" RESTART IDENTITY CASCADE');
  });

  it('save then findByEmail / round-trips the entity', async () => {
    // Arrange + Act
    await repo.save(User.create('alice@example.com', 'Alice'));
    const found = await repo.findByEmail(Email.create('alice@example.com'));

    // Assert — this hits REAL SQL, REAL constraints, REAL Prisma mapping
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Alice');
  });

  it('save / duplicate email / violates the unique constraint', async () => {
    await repo.save(User.create('dup@example.com', 'A'));
    // The real UNIQUE index throws — something an in-memory fake would never catch
    await expect(repo.save(User.create('dup@example.com', 'B'))).rejects.toThrow();
  });
});
```

### Cleanup Strategies — Truncate vs Per-Test Transaction

| Strategy | How | Trade-off |
|----------|-----|-----------|
| **Truncate** (`afterEach`) | `TRUNCATE ... RESTART IDENTITY CASCADE` after each test | Simple, works with any code; slightly slower; resets sequences |
| **Per-test transaction** | Begin a tx in `beforeEach`, roll back in `afterEach` | Fast, perfect isolation; **breaks if the code under test manages its own transactions/commits** |

In .NET you'd use `Respawn` (truncate-based) or a transaction rollback via `TransactionScope` — same two options, same trade-offs. With Prisma, true per-test transaction rollback is awkward (the client doesn't expose an ambient transaction the repo transparently joins), so **truncate is the pragmatic default**. Use a fresh container per *file* + truncate per *test*.

> **CI note:** Testcontainers needs Docker available in CI. On GitHub Actions the Docker daemon is present on `ubuntu-latest` by default — just ensure the runner can reach `/var/run/docker.sock`. Same requirement as the .NET track; the `Ryuk` reaper container cleans up orphans automatically.

---

## 7.5 Clean Architecture Testing Strategy

The layered architecture dictates the test type per layer — and this mapping is **identical** to the .NET Clean Architecture track. Each inner layer is easier to test (fewer deps); the outer layers need more infrastructure.

```
Layer            | Test type        | Mocks?              | Speed   | .NET parallel
-----------------|------------------|---------------------|---------|----------------------------
Domain           | Pure unit        | NONE (no deps)      | fastest | xUnit, no Moq
Application      | Unit             | Mock repo interfaces| fast    | xUnit + Moq on IRepository
Infrastructure   | Integration      | Real DB (Testcont.) | slow    | xUnit + Testcontainers
Presentation/API | E2E              | supertest, real app | slowest | WebApplicationFactory + HttpClient
```

**The test pyramid maps onto the architecture:**

```
         ╱╲          E2E (few)        — API layer: supertest hits the running NestJS app
        ╱  ╲
       ╱    ╲        Integration (some) — Infrastructure: real Postgres via Testcontainers
      ╱      ╲
     ╱        ╲      Unit (many)       — Domain (no mocks) + Application (mocked repos)
    ╱__________╲
```

- **Domain layer → pure unit tests, no mocks.** Entities/value objects have zero dependencies (the dependency rule guarantees this). If a domain test needs a mock, your domain has leaked a dependency — a design smell. (See 7.2 `Order`/`Email` tests.)
- **Application layer → unit tests with mocked repository interfaces.** Handlers depend only on *interfaces* defined in the domain; mock them with `{ provide: TOKEN, useValue: mock }`. (See 7.2 `CreateUserHandler` test.)
- **Infrastructure layer → integration tests with a real DB.** The whole point of the Prisma repository is the SQL/mapping — only a real DB validates it. (See 7.4.)
- **API layer → E2E with supertest + real app.** Exercises pipes, guards, filters, routing, serialization end-to-end. (See 7.3.)

**Why this works:** you mock *across* architectural boundaries (the repository interface) but never *within* a layer. You test infrastructure against reality (real DB) because mocking a DB tells you nothing about whether your SQL is correct — the exact same reasoning that drives Testcontainers adoption in .NET.

---

## 7.6 Test Best Practices

### Test Naming

Use a structured, three-part name so a failing test reads like a spec: **`unitOfWork / state under test / expected behaviour`**.

```ts
it('addItem / submitted order / throws DomainError', ...);
it('execute / duplicate email / does not save', ...);
it('GET /users/:id / unknown id / returns 404', ...);
```

This is the same `MethodName_StateUnderTest_ExpectedBehavior` convention recommended for xUnit — just with `/` separators reading naturally inside the `describe` context.

### One Logical Assertion Per Test

Not literally one `expect` — one *concept*. Multiple `expect`s checking facets of the same outcome are fine; testing two unrelated behaviours in one test is not.

```ts
// GOOD — multiple expects, one logical outcome (the created user)
it('create / valid input / returns a fully-formed user', () => {
  const user = User.create('a@b.com', 'Alice');
  expect(user.email.value).toBe('a@b.com');
  expect(user.name).toBe('Alice');
  expect(user.id).toBeDefined();
});

// BAD — two unrelated behaviours; if the first fails you never learn about the second
it('handles create and delete', () => {
  /* ...create assertions... */
  /* ...delete assertions... */ // split into two tests
});
```

### Test Builders / Object Mothers

Avoid repeating object construction in every test. Two patterns (both straight from the .NET/DDD playbook):

```ts
// Object Mother — named canonical instances ("a typical valid user")
export const UserMother = {
  valid: () => User.create('alice@example.com', 'Alice'),
  withEmail: (email: string) => User.create(email, 'Alice'),
};

// Test Data Builder — fluent, override only what the test cares about
export class OrderBuilder {
  private id = 'order-1';
  private items: Array<[string, number, number]> = [['p1', 1, 10]];

  withId(id: string): this { this.id = id; return this; }
  withItem(productId: string, qty: number, price: number): this {
    this.items.push([productId, qty, price]);
    return this;
  }
  build(): Order {
    const order = Order.create(this.id);
    for (const [p, q, pr] of this.items) order.addItem(p, q, pr);
    return order;
  }
}

// Usage — the test states ONLY what's relevant; defaults fill the rest
const order = new OrderBuilder().withItem('p2', 3, 5).build();
```

This is the `Bogus`/builder pattern from C# tests — keep construction noise out of the test body so the *intent* is visible.

### `faker` — Realistic Test Data

```ts
import { faker } from '@faker-js/faker';

// Generate realistic-but-random data — the JS equivalent of Bogus in .NET
const user = User.create(faker.internet.email(), faker.person.fullName());
const price = faker.number.float({ min: 1, max: 1000, fractionDigits: 2 });
```

> **Caution:** random data makes failures non-reproducible. Pin a seed (`faker.seed(123)`) when you need determinism, and *never* assert on faked values you didn't control — assert on transformations (`email normalised to lowercase`), not on the random input itself. Prefer fixed values for assertions; use faker to fill *irrelevant* fields.

### Avoiding Test Coupling & Shared Mutable State

The cardinal rule: **tests must be independent and order-agnostic.** Jest runs test *files* in parallel (separate workers) and may reorder tests within a file.

```ts
// BAD — shared mutable state leaks between tests; test order now matters
let users: User[] = [];
it('adds a user', () => { users.push(UserMother.valid()); expect(users).toHaveLength(1); });
it('has no users initially', () => { expect(users).toHaveLength(0); }); // FAILS if it ran second

// GOOD — fresh state per test via beforeEach (the xUnit constructor pattern)
let users: User[];
beforeEach(() => { users = []; }); // reset before EVERY test → order-independent
```

Checklist:
- Reset all shared state in `beforeEach`; never rely on a previous test's side effects.
- Reset mocks (`jest.clearAllMocks()` / `clearMocks: true`) so call counts don't bleed.
- For DB tests, truncate per test (7.4) so rows from one test don't pollute the next.
- Don't share a single mutable fixture object across tests — build a fresh one each time.
- Avoid `test.only`/`describe.only` slipping into commits (a lint rule like `eslint-plugin-jest`'s `no-focused-tests` catches it — analogous to forbidding `Skip` creeping in).

---

## Gotchas

- **`toBe` vs `toEqual`** — `toBe` is reference identity (`Object.is`); use `toEqual` for objects/arrays. The most common false-failure in Jest.
- **Forgetting `await` on `.rejects`/`.resolves`** — `expect(promise).rejects.toThrow()` *without* `await` passes silently even when wrong. Always `await expect(...)` for async matchers.
- **Fake timers + real promises** — mixing `jest.useFakeTimers()` with `await` hangs unless you use the `*Async` timer advancers and flush microtasks. Restore with `useRealTimers()` in `afterEach`.
- **`jest.mock` is hoisted** — Jest moves `jest.mock(...)` calls above your imports at compile time. Don't reference outer-scope variables inside the factory (they don't exist yet) — Jest throws "out-of-scope variables" unless the name starts with `mock`.
- **Mock state bleeds across tests** — without `clearMocks: true` (or `clearAllMocks()` in `afterEach`), `toHaveBeenCalledTimes` accumulates across tests in the same file.
- **`jest.spyOn` not restored** — a spy that replaces a method leaks into later tests in the file. Use `restoreAllMocks()` / `mockRestore()` or set `restoreMocks: true`.
- **Jest "did not exit one second after the test run"** — you left a handle open: an unclosed `PrismaClient`, a live server, or a container. Call `app.close()`, `prisma.$disconnect()`, `container.stop()` in `afterAll`. Run with `--detectOpenHandles` to find the culprit.
- **Interface as a DI token** — TS interfaces don't exist at runtime, so you can't `{ provide: UserRepository }` if `UserRepository` is an interface. Use a `Symbol`/string token (`USER_REPOSITORY`) and `@Inject(USER_REPOSITORY)`. (C# interfaces *are* runtime types — this is a TS-specific tax.)
- **Global pipes/filters not applied in tests** — `app.useGlobalPipes(...)` from `main.ts` is NOT auto-run by `createNestApplication()`. Re-apply them in the test setup or your 400-validation tests silently pass through.
- **Testcontainers needs Docker** — tests fail with a connection error if the Docker daemon isn't running (locally or in CI). It's not an in-process fake.
- **`@swc/jest` skips type-checking** — a test can pass while the code has type errors. Run `tsc --noEmit` separately in CI to keep type safety.
- **`faker` non-determinism** — random data → flaky failures you can't reproduce. Seed it, and assert on transformations, not on the random inputs.

---

## Phase 7 Project

**Task:** Build a complete test suite for the Phase 5 Clean Architecture project (the Users/Orders API) — unit, integration, and E2E with Testcontainers — proving each architectural layer with the right test type.

**Location:** `examples/phase5-clean-arch/` (add tests alongside the code: `*.spec.ts` next to units, `test/*.e2e-spec.ts` for E2E).

**Requirements:**

1. **Domain unit tests (no mocks)** — for at least one entity (`Order` with `addItem`/`submit`/`total` invariants) and one value object (`Email`/`Money` validation + equality). Pure, fast, zero infrastructure.
2. **Application unit tests (mocked repos)** — for one command handler (`CreateUserHandler`: happy path saves, duplicate-email path throws and never saves) and one query handler (`GetUserByIdHandler`: not-found throws). Use `Test.createTestingModule` with `{ provide: TOKEN, useValue: mock }`.
3. **Infrastructure integration tests (real DB)** — for `PrismaUserRepository` against a real Postgres via Testcontainers. Cover round-trip save/find and a unique-constraint violation. One container per file, truncate per test.
4. **API E2E tests (supertest)** — `POST /users` 201 happy path, 400 on invalid body (real `ValidationPipe`), 404 on unknown id (real exception filter). Bypass auth with `overrideGuard` if the route is protected.
5. **Test infrastructure** — a reusable `startTestDb`/`stopTestDb` helper, a couple of test builders / object mothers, and `faker` for irrelevant fields.
6. **Config** — `@swc/jest` for speed + a separate `tsc --noEmit` script; `clearMocks: true` and `restoreMocks: true` in `jest.config.js`; a dedicated `jest-e2e.config.js` for the E2E suite.

**Hints:**

- Mirror the layer→test-type table from 7.5. If a domain test needs a mock, the domain has a leaked dependency — fix the design, not the test.
- Keep the unit suite (domain + application) able to run with **no Docker** (`npm test`), and the integration/E2E suite (which needs Docker) behind a separate script (`npm run test:e2e`). This keeps the fast feedback loop fast — same split as `dotnet test --filter Category!=Integration` in the .NET track.
- For the duplicate-email test, drive it through the *real* unique index in the integration test (constraint violation) **and** through the *mocked* `findByEmail` in the application test (business-rule rejection). Two layers, two angles on the same rule.
- Re-apply `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` and your global exception filter in the E2E setup — otherwise the 400/404 tests give false passes.
- Always `await app.close()` / `prisma.$disconnect()` / `container.stop()` in `afterAll`, and run the suite once with `--detectOpenHandles` to confirm a clean exit.
- Add a CI workflow step later (Phase 9) that runs both suites with Docker available — the Testcontainers requirement is the same as the .NET track.

**Stretch goals:**

- Add a `OrderBuilder` test-data builder and use it across the order tests.
- Measure and assert on the test pyramid shape: many unit, fewer integration, fewest E2E.
- Add a per-test-transaction cleanup variant and observe where it breaks (handlers that commit their own transactions) — proving why truncate is the safer default with Prisma.

---

## Interview Questions

### Jest Fundamentals

1. What is the difference between `toBe` and `toEqual` in Jest, and when would using `toBe` on an object lead to a false negative?
2. Why does `expect(promise).rejects.toThrow()` pass silently when you forget to `await` it, and what does that mean for test reliability?
3. What is the execution order of `beforeAll`, `beforeEach`, `afterEach`, and `afterAll` hooks when `describe` blocks are nested two levels deep?
4. How does `toMatchObject` differ from `toEqual`, and what are the trade-offs of using partial matching in assertions?
5. When would you choose `toThrow(DomainError)` over `toThrow('message substring')`, and what are the risks of each approach?
6. Explain how `expect.objectContaining` and `expect.any` work as asymmetric matchers, and give a scenario where they are the right tool.
7. Why does Jest run test *files* in parallel but run tests within a file serially, and what does this mean for shared mutable state?
8. What happens if a `beforeAll` hook throws — which tests in the describe block are skipped, and which (if any) lifecycle hooks still run?
9. How does `test.each` (or `it.each`) work, and what types of test scenarios benefit most from it?
10. What is the difference between `describe.skip` / `test.skip` and `describe.only` / `test.only`, and why should neither slip into a committed test suite?

### Mocking & Spies

11. Explain the difference between `jest.clearAllMocks()`, `jest.resetAllMocks()`, and `jest.restoreAllMocks()` — what does each reset, and what does it leave intact?
12. Why does mock state (call counts, return values) bleed between tests in the same file, and what is the idiomatic way to prevent it?
13. What is the difference between `mockReturnValue` and `mockImplementation`, and when is one preferable to the other?
14. How does `mockReturnValueOnce` behave once the single-use return values are exhausted, and how does the sequence fall back?
15. Explain why `jest.spyOn` without calling `mockRestore()` can cause test pollution across a file, especially when testing `Date.now` or `Math.random`.
16. What is `jest.Mocked<T>` in TypeScript, and why is it safer to type a mock object as `jest.Mocked<UserRepository>` rather than a plain object literal?
17. `jest.mock()` is hoisted above `import` statements by Jest — what constraint does this impose on variables referenced inside the factory function, and why does Jest enforce it?
18. What is the difference between auto-mocking (`jest.mock('./module')`) and a factory mock (`jest.mock('./module', () => ({...}))`), and when would you need the factory form?
19. How does `jest.requireActual` work inside a `jest.mock` factory, and why is it useful for partial mocks of a module?
20. Why is it generally better to swap providers via NestJS DI (`useValue`) than to use `jest.mock()` for application service dependencies, and when would `jest.mock()` still be the right choice?
21. Explain the difference between a stub, a spy, and a mock in the context of test doubles — how do `jest.fn()`, `jest.spyOn()`, and a hand-rolled object map to these categories?
22. If `jest.spyOn(console, 'error')` is used to suppress noise in tests, what risk does it introduce, and how should you guard against it?

### Fake Timers & Async Testing

23. Why does mixing `jest.useFakeTimers()` with `await`-based promises sometimes cause a test to hang indefinitely, and what is the recommended fix?
24. What is the difference between `jest.runAllTimers()` and `jest.runOnlyPendingTimers()`, and why does `runAllTimers()` risk an infinite loop with `setInterval`?
25. How does `jest.advanceTimersByTimeAsync()` differ from `jest.advanceTimersByTime()`, and when is the async variant necessary?
26. Why must `jest.useRealTimers()` be called in `afterEach` rather than just at the end of the test, and what can go wrong if it is omitted?
27. How would you pin `Date.now()` to a specific timestamp in a test, and what is the Jest API to do this without injecting a clock abstraction?
28. What is the risk of asserting on return values from `mockResolvedValue` vs asserting on side effects (e.g., `toHaveBeenCalledWith`) in async unit tests?

### Integration Testing

29. How does `supertest` make HTTP requests against a NestJS app without binding to a real port, and what is the equivalent mechanism in .NET's `WebApplicationFactory`?
30. Why must `app.useGlobalPipes(new ValidationPipe(...))` be re-applied in the test setup, and what class of test failures silently disappears if you forget it?
31. What is the difference between `.overrideProvider(TOKEN).useValue(mock)` and `.overrideProvider(TOKEN).useClass(FakeClass)` — when would you choose each?
32. How does `overrideGuard` work in the NestJS testing module, and what is the risk of bypassing a guard globally across all tests in a suite?
33. If a global exception filter maps a domain `NotFoundError` to a 404 response, how do you verify it is working correctly in a supertest integration test?
34. Why is `await app.close()` in `afterAll` critical for Jest to exit cleanly, and what symptom appears if it is omitted?
35. Explain the trade-off between placing the NestJS app bootstrap in `beforeAll` (once per file) vs `beforeEach` (once per test) in an integration test suite.
36. When an integration test passes in isolation but fails when the full suite runs, what categories of root cause should you investigate first?
37. How would you test that a request interceptor (e.g., one that attaches a correlation ID to every response) is correctly applied, using supertest?
38. What does `request(app.getHttpServer()).post('/users').send({...}).expect(201)` actually assert, and what additional assertions should typically follow it?

### NestJS Testing Module

39. Why can't a TypeScript interface be used directly as a NestJS DI token, and what two alternatives does the ecosystem use instead?
40. Explain the difference between `Test.createTestingModule({ providers: [...] })` used with a specific handler vs with `imports: [AppModule]` — what does each approach exercise?
41. What is the purpose of `module.get(TOKEN)` in a test, and why must you pull the mock *out* of the module rather than referencing the mock object directly?
42. When would you use `useFactory` instead of `useValue` for a mock provider in a test module, and what does `useFactory` let you do that `useValue` cannot?
43. How do you test a NestJS `@nestjs/cqrs` command handler — should the full command bus be set up, or is there a lighter alternative, and why?
44. What is the risk of not calling `.compile()` on a `TestingModuleBuilder`, and what error would you see?
45. If a NestJS service has a circular dependency that is resolved with `forwardRef` in production, how does that complexity surface in the testing module setup?
46. How does `overrideModule` differ from `overrideProvider` in the NestJS testing module, and when would module-level overriding be needed?

### Database Testing & Testcontainers

47. Why does running repository integration tests against an in-memory SQLite database give false confidence compared to a real PostgreSQL container?
48. Explain the trade-off between the truncate-per-test cleanup strategy and the per-test transaction rollback strategy when using Prisma.
49. Why does per-test transaction rollback break when the code under test manages its own transactions or issues explicit `COMMIT` calls?
50. What does `RESTART IDENTITY CASCADE` do in a `TRUNCATE` statement, and why are both clauses important when cleaning up between tests?
51. Why is the Jest default 5-second test timeout insufficient for the `beforeAll` that boots a Testcontainers PostgreSQL container, and how do you raise it?
52. What is the Ryuk container in Testcontainers, and what problem does it solve in CI environments where test processes can be killed abruptly?
53. Describe the CI/CD setup required to run Testcontainers tests on GitHub Actions — what must the runner have, and what pitfalls exist?
54. Why should the Testcontainers test suite be in a separate Jest config and run under a separate npm script from the unit test suite?
55. How would you test that a real unique-constraint violation at the database level is correctly caught and surfaced by your repository implementation?
56. What is the difference between `prisma migrate deploy` and `prisma db push` when setting up a throwaway test database, and which is safer for CI?

### Test Design Principles

57. What does the test pyramid prescribe about the ratio of unit to integration to E2E tests, and why does violating it (e.g., an inverted pyramid) hurt CI feedback cycles?
58. Explain the principle "don't mock what you don't own" — what does it mean in practice, and why does mocking a third-party ORM directly lead to brittle tests?
59. Why is a domain entity test that requires a mock considered a design smell, and what does it reveal about the domain model's dependency structure?
60. What is the difference between testing *state* (asserting on return values) and testing *behaviour* (asserting on interactions via `toHaveBeenCalledWith`), and when is each appropriate?
61. Explain the "one logical assertion per test" principle — does it mean one `expect` call, and what is the practical consequence of asserting two unrelated behaviours in a single test?
62. What is the Object Mother pattern, and how does it differ from the Test Data Builder pattern in terms of flexibility and use case?
63. Why is using `faker` with unseeded randomness potentially dangerous in a test suite, and what specific failure mode does it introduce?
64. Describe "test coupling" in the context of shared mutable state — give a concrete example of how test order dependence can cause intermittent failures.
65. What is TDD's red-green-refactor cycle, and how does writing the test first change the design of the production code compared to writing tests after?
66. Why does the principle "test behaviour, not implementation" suggest you should avoid asserting on private methods or internal state directly?

### Test Doubles

67. What are the five canonical types of test doubles (dummy, stub, spy, mock, fake), and give a one-line definition of each in the context of Jest?
68. When is a fake (e.g., an in-memory repository implementation) preferable to a mock (`jest.fn()`), and what are the maintenance trade-offs of maintaining a fake?
69. What is the difference between a stub that returns a canned value and a spy that records calls but delegates to the real implementation — when would you use each?
70. Explain "over-specification" in mock assertions — why can asserting on every `toHaveBeenCalledWith` argument sometimes make tests brittle to refactoring?
71. Why is `expect.objectContaining({...})` a useful tool for avoiding over-specified mock assertions, and what is the risk of making the partial match too loose?

### Code Coverage & TDD

72. What does line coverage measure, and why can a codebase with 95% line coverage still have critical untested paths?
73. What is branch coverage, and how does it differ from line coverage — give an example of code with 100% line coverage but less than 100% branch coverage?
74. What is mutation testing, and why does it reveal gaps that coverage metrics miss?
75. Why is enforcing a coverage threshold in CI (e.g., `--coverage --coverageThreshold`) a useful gate, but not a sufficient indicator of test quality?
76. In TDD, why does writing a failing test first (red phase) produce better-designed interfaces than retrofitting tests onto existing code?
77. What is the difference between "inside-out" (classicist) TDD and "outside-in" (London school / mockist) TDD, and how do they differ in their use of test doubles?
78. How does the `@swc/jest` transform affect the feedback loop during TDD compared to `ts-jest`, and what must you compensate for in CI?
