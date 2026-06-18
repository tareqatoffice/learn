# Phase 8 — Microservices

> You already know the .NET microservices story: MassTransit over RabbitMQ, Hangfire for
> background jobs, Polly for resilience, YARP at the edge, OpenTelemetry for tracing. This
> phase maps every one of those onto the NestJS/Node.js ecosystem. The architecture is
> identical — only the libraries change. Wherever a .NET tool exists, you'll see the
> mapping inline so the mental model transfers directly.

| Concern | .NET | NestJS / Node.js |
|---------|------|------------------|
| Transport / broker abstraction | MassTransit | `@nestjs/microservices` |
| Background / job queue | Hangfire | BullMQ (`@nestjs/bullmq`) |
| Circuit breaker / retry | Polly | `opossum` + `got`/`p-retry` |
| API gateway / reverse proxy | YARP | NGINX / `http-proxy-middleware` |
| RPC (typed contracts) | gRPC | gRPC (`@grpc/grpc-js`) or NestJS gRPC transport |
| Tracing / metrics | OpenTelemetry .NET | `@opentelemetry/sdk-node` |
| Request-scoped context | `IHttpContextAccessor` / `AsyncLocal<T>` | `AsyncLocalStorage` |

---

## 8.1 Microservices Fundamentals

### Monolith vs Microservices — the same trade-offs

A monolith is **one deployable unit**: one process, one database, one CI pipeline. A
microservices system splits the same domain into **independently deployable services**,
each owning its data and communicating over the network.

```
   MONOLITH                             MICROSERVICES
┌──────────────────────┐        ┌────────┐  ┌────────┐  ┌────────┐
│  Users  Orders  Pay  │        │ Users  │  │ Orders │  │  Pay   │
│  ─────  ──────  ───  │        │  svc   │  │  svc   │  │  svc   │
│   shared codebase    │        └───┬────┘  └───┬────┘  └───┬────┘
│   shared DB          │            │           │           │
└──────────┬───────────┘         ┌──┴──┐     ┌──┴──┐     ┌──┴──┐
           │                     │ DB  │     │ DB  │     │ DB  │
        ┌──┴──┐                  └─────┘     └─────┘     └─────┘
        │ DB  │              (network calls + async messaging between)
        └─────┘
```

The trade-off table is the **same one you saw in the .NET track** — the runtime doesn't
change the economics:

| | Monolith | Microservices |
|---|----------|---------------|
| Deployment | One unit, simple | Many units, needs orchestration |
| Scaling | Scale the whole thing | Scale hot services independently |
| Team autonomy | Coordination-heavy | Teams own services end-to-end |
| Transactions | Local ACID, easy | Distributed → sagas, eventual consistency |
| Debugging | One stack trace | Distributed tracing required |
| Latency | In-process calls (ns) | Network calls (ms) + failure modes |
| Tech choice | One stack | Polyglot — per service |

**Rule of thumb (unchanged from .NET):** start with a well-structured monolith (a
*modular monolith* — your Phase 5 Clean Architecture app already is one). Split out a
service only when you have a concrete reason: independent scaling, independent deploy
cadence, or team boundaries. "Distributed monolith" — services that must deploy together
and share a DB — is the worst of both worlds.

### Service boundaries — DDD bounded contexts

You draw service boundaries the same way you do in DDD: along **bounded contexts**. A
bounded context is a region of the domain where a term has one unambiguous meaning. The
word "Order" means something different to the Sales context (a cart being built) than to
the Shipping context (a package to dispatch). Each context becomes a candidate service.

```
        ┌─────────────────────────────────────────────┐
        │              E-commerce Domain                │
        │                                               │
        │  ┌──────────────┐      ┌──────────────────┐  │
        │  │   Identity    │      │     Catalog      │  │
        │  │  context      │      │     context      │  │
        │  │ "User" = auth │      │ "Product" = SKU  │  │
        │  └──────────────┘      └──────────────────┘  │
        │  ┌──────────────┐      ┌──────────────────┐  │
        │  │   Ordering    │      │    Shipping      │  │
        │  │ "Order"=cart  │      │ "Order"=package  │  │   ← same word,
        │  └──────────────┘      └──────────────────┘  │     different model
        └─────────────────────────────────────────────┘
```

A **good** boundary minimises chatty cross-service calls: most use cases should be served
by one service touching its own data. If serving a single request always requires three
synchronous hops, the boundary is wrong.

### Data per service — no shared databases

The single most important rule: **each service owns its data, and no other service may
touch that database directly.** All access goes through the owning service's API or via
events it publishes.

```
   ✗ WRONG — shared DB                  ✓ RIGHT — DB per service
┌────────┐   ┌────────┐            ┌────────┐        ┌────────┐
│ Users  │   │ Orders │            │ Users  │  API   │ Orders │
│  svc   │   │  svc   │            │  svc   │◄──────►│  svc   │
└───┬────┘   └───┬────┘            └───┬────┘ events └───┬────┘
    │            │                     │                 │
    └──────┬─────┘                  ┌──┴──┐           ┌──┴──┐
       ┌───┴───┐                    │ DB  │           │ DB  │
       │  DB   │  ← coupling!       └─────┘           └─────┘
       └───────┘                  (private)          (private)
```

Why so strict? A shared DB re-couples everything you tried to decouple: a schema migration
in one service breaks another; you can no longer reason about who writes what; and you
lose the ability to deploy independently. This is exactly the same discipline MassTransit-
based .NET systems enforce — the broker, not the database, is the integration point.

**Consequence:** there are no cross-service `JOIN`s and no distributed transactions in the
naive sense. Orders service can't `JOIN` the users table. Instead it stores a *copy* of the
data it needs (e.g. a denormalised `customerName` snapshot) and keeps it fresh by listening
to `UserUpdated` events. This is **data duplication on purpose** — and it's normal.

### Polyglot persistence

Because each service owns its storage, each is free to pick the database that fits its
access pattern — *polyglot persistence*:

```
Users service     → PostgreSQL   (relational, transactional)
Catalog service   → MongoDB      (flexible product documents)
Search service    → Elasticsearch (full-text, faceting)
Cart service      → Redis        (ephemeral, fast key/value)
Analytics service → ClickHouse   (columnar, OLAP)
```

Don't reach for five databases on day one — every new datastore is an operational burden
(backups, monitoring, expertise). But the *option* is the point: nothing forces the whole
system onto one engine, unlike a shared-DB monolith.

---

## 8.2 NestJS Microservices Transport Layer

### `@nestjs/microservices` — the transport abstraction

`@nestjs/microservices` is NestJS's answer to **MassTransit**: a single programming model
(`@MessagePattern`, `@EventPattern`, `ClientProxy`) that runs over a pluggable transport.
Swap the transport in config; your handlers don't change.

Built-in transports:

| Transport | Use for | .NET analogue |
|-----------|---------|---------------|
| `TCP` | Simple service-to-service RPC (default) | raw TCP / custom |
| `Redis` | Pub/sub messaging | Redis transport |
| `RMQ` (RabbitMQ) | Reliable async messaging, work queues | MassTransit + RabbitMQ |
| `Kafka` | High-throughput event streaming, log | Confluent.Kafka / MassTransit Kafka |
| `NATS` | Lightweight, low-latency messaging | NATS client |
| `gRPC` | Typed RPC contracts (`.proto`) | gRPC |

### `@MessagePattern` vs `@EventPattern`

This is the **request/response vs fire-and-forget** distinction — the same split as
MassTransit's `IRequestClient<T>` (request) vs `IPublishEndpoint.Publish` (event).

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class UsersMicroserviceController {
  // @MessagePattern = REQUEST/RESPONSE. The caller awaits a reply.
  // Exactly one consumer handles it; the return value is sent back.
  @MessagePattern('users.get_by_id')          // the "pattern" is the routing key
  getUserById(@Payload() id: string) {
    return this.usersService.findById(id);     // returned value → reply to caller
  }

  // @EventPattern = FIRE-AND-FORGET. The publisher does NOT wait.
  // Zero, one, or many consumers may react. No return value is sent anywhere.
  @EventPattern('user.created')
  handleUserCreated(@Payload() event: { id: string; email: string }) {
    // e.g. send a welcome email — failures here don't propagate to the publisher
    this.mailService.sendWelcome(event.email);
  }
}
```

**Mental rule:** use `@MessagePattern` when the caller *needs an answer now* (it blocks on
the reply). Use `@EventPattern` to *announce that something happened* and let interested
services react in their own time. Events are how you keep services decoupled; over-using
request/response recreates a distributed monolith.

### Hybrid apps — HTTP + transport in one process

A common pattern: a service exposes an HTTP API to the outside world **and** listens on a
message transport for internal traffic. NestJS calls this a **hybrid application**.

```ts
// main.ts — a hybrid app: HTTP server + RabbitMQ microservice in one process
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1. Create the normal HTTP application
  const app = await NestFactory.create(AppModule);

  // 2. ATTACH a microservice transport to the same app instance.
  //    connectMicroservice can be called multiple times for multiple transports.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://guest:guest@rabbitmq:5672'], // 'rabbitmq' = Compose DNS name
      queue: 'users_queue',
      queueOptions: { durable: true },            // survive broker restart
    },
  });

  // 3. Start BOTH: the transport listeners first, then the HTTP server.
  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

The same controller class can hold `@Get()` HTTP routes *and* `@MessagePattern`/
`@EventPattern` handlers side by side.

### Client proxy — calling another service

To *send* a message you inject a `ClientProxy`. Register it in a module, then `.send()` for
request/response (returns an `Observable`) or `.emit()` for events.

```ts
// orders.module.ts — register a client that talks to the Users service
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_SERVICE',                  // DI token to inject later
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@rabbitmq:5672'],
          queue: 'users_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
})
export class OrdersModule {}
```

```ts
// orders.service.ts — using the proxy
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService {
  constructor(@Inject('USERS_SERVICE') private readonly usersClient: ClientProxy) {}

  async createOrder(userId: string) {
    // send() → REQUEST/RESPONSE. Returns a cold Observable; firstValueFrom awaits it.
    // The 'users.get_by_id' pattern must match a @MessagePattern on the other side.
    const user = await firstValueFrom(
      this.usersClient.send<UserDto>('users.get_by_id', userId),
    );
    if (!user) throw new Error('User not found');

    const order = await this.repo.save({ userId, status: 'PENDING' });

    // emit() → EVENT (fire-and-forget). Returns immediately; no reply awaited.
    this.usersClient.emit('order.created', { orderId: order.id, userId });

    return order;
  }
}
```

> **Gotcha:** `.send()` and `.emit()` return RxJS `Observable`s. Nothing is sent until you
> *subscribe* — `firstValueFrom()` does that. If you call `.send()` and never subscribe, no
> request goes out. `.emit()` you usually fire without awaiting, but it still needs a
> subscriber; NestJS subscribes internally for `emit` in most setups — to be safe, `await
> firstValueFrom(client.emit(...))` when you need delivery confirmation.

---

## 8.3 Synchronous Communication — HTTP

Sometimes you genuinely need a synchronous answer right now (e.g. the Orders service must
validate a user exists before creating an order). That's an HTTP (or gRPC) call. The danger
is **cascading failure** — a slow downstream drags everyone down — so synchronous calls
*must* be wrapped in timeouts, retries, and circuit breakers (your Polly playbook).

### `@nestjs/axios` / `axios`

`@nestjs/axios` wraps `axios` as an injectable `HttpService` returning Observables.

```ts
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

@Injectable()
export class UserClient {
  constructor(private readonly http: HttpService) {}

  async getUser(id: string): Promise<UserDto> {
    const res = await firstValueFrom(
      this.http
        .get<UserDto>(`http://users-service:3000/users/${id}`) // Compose DNS name
        .pipe(
          timeout(2000),                       // ALWAYS set a timeout — never hang forever
          catchError((err) => {
            throw new ServiceUnavailableException('users-service unreachable');
          }),
        ),
    );
    return res.data;
  }
}
```

### `got` — lighter, retry built in

`got` is a leaner HTTP client (no Observables) with first-class retry/timeout. Good when you
don't need the NestJS Observable wrapper.

```ts
import got from 'got';

const client = got.extend({
  prefixUrl: 'http://users-service:3000',
  timeout: { request: 2000 },                  // 2s hard timeout
  retry: {
    limit: 3,                                   // retry up to 3 times
    methods: ['GET'],                           // only retry idempotent methods!
    statusCodes: [408, 429, 500, 502, 503, 504],
    // got applies exponential backoff with jitter automatically between attempts
  },
});

const user = await client.get(`users/${id}`).json<UserDto>();
```

> Only auto-retry **idempotent** methods (GET, PUT, DELETE). Retrying a non-idempotent POST
> can create duplicate orders — see idempotency keys in 8.8.

### Circuit breaker with `opossum`

`opossum` is the Node equivalent of **Polly's circuit breaker**. It wraps an async function
and trips OPEN after a failure threshold, short-circuiting calls (failing fast) instead of
hammering a dead service. After a cooldown it goes HALF-OPEN to test recovery.

```
        CLOSED  ──(failures ≥ threshold)──►  OPEN
          ▲                                   │
          │                          (after resetTimeout)
   (test call succeeds)                       ▼
          └────────────  HALF-OPEN  ◄─────────┘
                            │
                  (test call fails → back to OPEN)
```

```ts
import CircuitBreaker from 'opossum';

// The risky operation we want to protect.
async function fetchUser(id: string): Promise<UserDto> {
  return got.get(`http://users-service:3000/users/${id}`).json<UserDto>();
}

const breaker = new CircuitBreaker(fetchUser, {
  timeout: 2000,            // treat calls slower than 2s as failures
  errorThresholdPercentage: 50, // open the circuit once 50% of calls fail
  resetTimeout: 10_000,     // after 10s OPEN, go HALF-OPEN and try one test call
  rollingCountTimeout: 10_000, // stats window
});

// Fallback runs when the circuit is OPEN or the call fails — degrade gracefully.
breaker.fallback((id: string) => ({ id, name: 'Unknown', degraded: true }));

// Observability hooks
breaker.on('open',     () => logger.warn('users-service circuit OPEN'));
breaker.on('halfOpen', () => logger.log('users-service circuit HALF-OPEN'));
breaker.on('close',    () => logger.log('users-service circuit CLOSED'));

// Call through the breaker, not the raw function:
const user = await breaker.fire(id);   // returns fallback value if tripped
```

### Retry with exponential backoff

Retry transient failures, but **back off exponentially with jitter** so you don't
synchronise a thundering herd against a recovering service.

```ts
import pRetry from 'p-retry';

const user = await pRetry(
  () => fetchUser(id),
  {
    retries: 4,
    factor: 2,            // delays grow: 1s, 2s, 4s, 8s ...
    minTimeout: 1000,
    maxTimeout: 10_000,
    randomize: true,      // add jitter to spread retries out
    onFailedAttempt: (e) =>
      logger.warn(`attempt ${e.attemptNumber} failed; ${e.retriesLeft} left`),
  },
);
```

**Combine them in layers (same as Polly's policy wrap):** innermost = timeout, then retry,
then circuit breaker outermost. Retries happen *inside* the breaker so repeated failures
still count toward tripping it.

### Service discovery — DNS in Docker Compose

In Compose (and Kubernetes), you don't hardcode IPs. The platform runs a **DNS server** so a
service is reachable by its name on the shared network:

```yaml
services:
  orders-service:
    # ... can reach http://users-service:3000 — Docker resolves the name
  users-service:
    # listens on 3000 inside the container
```

`http://users-service:3000` resolves to whichever container(s) currently back that service.
This is "client-side discovery via DNS" — the simplest form. (Production-grade discovery uses
Consul/Eureka or a service mesh, but DNS covers Compose and basic K8s.)

---

## 8.4 Asynchronous Communication — RabbitMQ

Async messaging is the backbone of decoupled microservices. The publisher drops a message
and moves on; consumers process it whenever they can. This is exactly what **MassTransit**
gives you in .NET — `@nestjs/microservices` RMQ transport is the NestJS counterpart.

### RabbitMQ concepts: exchanges, queues, bindings, routing keys

The mental model trips up everyone at first because RabbitMQ uses the **AMQP** model:
publishers never publish to a queue directly — they publish to an **exchange**, which routes
to **queues** based on **bindings** and **routing keys**.

```
  Publisher                  Exchange                Queues          Consumers
     │      routing key       (router)    bindings      │
     │  "order.created"     ┌──────────┐  ───────►  ┌────────┐    ┌──────────┐
     └────────────────────► │  topic   │ ──key────► │ emails │ ──►│ mailer   │
                            │ exchange │            └────────┘    └──────────┘
                            │          │ ──key────► ┌────────┐    ┌──────────┐
                            └──────────┘            │ billing│ ──►│ invoicer │
                                                    └────────┘    └──────────┘
```

- **Exchange** — receives messages, decides where they go. Types:
  - `direct` — route by exact routing-key match
  - `topic` — route by pattern (`order.*`, `order.#`)
  - `fanout` — broadcast to every bound queue (ignores routing key)
  - `headers` — route by message header values
- **Queue** — an ordered buffer messages wait in until consumed. Make it `durable` to
  survive broker restarts.
- **Binding** — a rule linking an exchange to a queue (optionally with a routing-key pattern).
- **Routing key** — a label on the message the exchange uses to decide routing.

> NestJS's RMQ transport hides much of this: by default it creates one durable queue per
> service and treats the message `pattern` as the routing concept. When you need real topic
> exchanges and fine-grained bindings, reach for `@golevelup/nestjs-rabbitmq` (a thin, more
> AMQP-faithful layer) instead of the built-in transport.

### Publishing and consuming events

Publisher side (Orders) — reuse the `ClientProxy` from 8.2:

```ts
// Orders service emits an event after persisting the order.
this.client.emit('order.created', {
  orderId: order.id,
  userId: order.userId,
  total: order.total,
});
// emit() = fire-and-forget. Orders does not know or care who consumes this.
```

Consumer side (Notifications service):

```ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

@Controller()
export class NotificationsController {
  @EventPattern('order.created')
  async onOrderCreated(@Payload() data: OrderCreatedEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();      // raw amqplib channel
    const original = context.getMessage();         // raw message (for ack/nack)
    try {
      await this.mailer.sendOrderConfirmation(data);
      channel.ack(original);                       // MANUAL ack — message removed from queue
    } catch (err) {
      // requeue=false → send to dead-letter exchange instead of infinite redelivery
      channel.nack(original, false, false);
    }
  }
}
```

```ts
// To get manual acks, disable NestJS auto-ack when wiring the transport:
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: ['amqp://guest:guest@rabbitmq:5672'],
    queue: 'notifications_queue',
    queueOptions: { durable: true },
    noAck: false,        // <-- you must ack/nack yourself; gives at-least-once delivery
  },
});
```

> **Auto-ack vs manual-ack:** with `noAck: true` (default), RabbitMQ deletes the message the
> moment it's delivered — if your handler crashes, the message is lost. Set `noAck: false`
> and `ack` only after successful processing for **at-least-once** delivery. At-least-once
> means a message can be delivered twice (e.g. after a crash before ack), so handlers must be
> **idempotent** (see 8.8).

### Dead letter queues — handling failed messages

A message that can't be processed shouldn't loop forever (a "poison message" can wedge the
whole queue). Configure a **dead letter exchange (DLX)**: nacked/expired/rejected messages
get rerouted to a DLX, which routes them to a dead-letter queue for inspection or retry.

```
  work queue ──(nack, requeue=false / TTL expired / max retries)──► DLX ──► dead-letter queue
                                                                              │
                                                                  inspect / alert / replay
```

```ts
queueOptions: {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'orders.dlx',     // where rejected msgs go
    'x-dead-letter-routing-key': 'order.created.failed',
    'x-message-ttl': 60000,                      // optional: expire after 60s
  },
}
```

A common pattern is a **retry-with-delay loop**: DLX → a delay queue with a TTL → back to
the work queue, with a retry-count header you increment; once it exceeds N, route to a
*parking* queue and alert. (This is the same dead-letter / redelivery story MassTransit
automates with its retry and redelivery middleware.)

### Sagas — choreography vs orchestration

A business transaction spanning services can't use a single ACID transaction (no shared DB).
A **saga** coordinates it as a sequence of local transactions, each publishing an event that
triggers the next — with **compensating actions** to undo prior steps on failure.

**Choreography** — no central coordinator; services react to each other's events:

```
Order svc            Payment svc           Inventory svc
   │  order.created ──►  │                      │
   │                     │ payment.succeeded ──►│
   │                     │                      │ stock.reserved
   │ ◄─────────────────────────────────── (order confirmed)
   │
   │  If payment FAILS:  │ payment.failed ─────►│ (release stock)
   │ ◄──────────────────── order.cancelled (compensate)
```
- ✅ Decoupled, no single point of failure.
- ❌ Hard to see the whole flow; logic is scattered across services.

**Orchestration** — a central saga orchestrator tells each service what to do and reacts to
replies (this is MassTransit's `MassTransitStateMachine`; in NestJS you'd model it with
`@nestjs/cqrs` Sagas or a dedicated orchestrator service):

```
                  ┌──────────────────────────┐
                  │   Order Saga Orchestrator │
                  └───┬─────────┬─────────┬───┘
            ProcessPayment   ReserveStock  ShipOrder
                  ▼            ▼             ▼
              Payment svc  Inventory svc  Shipping svc
        (orchestrator handles failures & compensations centrally)
```
- ✅ Flow is explicit and centralised; easy to reason about and monitor.
- ❌ The orchestrator is a coupling point and must be kept available.

**Choose:** choreography for simple 2–3 step flows; orchestration once the flow has branches,
timeouts, and compensations you need to see in one place.

---

## 8.5 Asynchronous Communication — BullMQ

RabbitMQ is for **inter-service messaging**. BullMQ is for **background jobs within (or
behind) a service** — image processing, sending emails, generating reports, scheduled work.
It is the direct equivalent of **Hangfire**: a Redis-backed durable job queue with retries,
delays, priorities, and recurring (cron) jobs.

```
  Producer (.add)        Redis (durable store)        Worker (process)
     │   add('email')    ┌────────────────────┐         │
     └─────────────────► │  waiting → active   │ ───────►│ runs job fn
                         │  → completed/failed │         │ retries on throw
                         └────────────────────┘         │
```

### `@nestjs/bullmq` integration

```ts
// app.module.ts — connect BullMQ to Redis and register a named queue
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: 'redis', port: 6379 },   // 'redis' = Compose DNS name
    }),
    BullModule.registerQueue({
      name: 'emails',
      defaultJobOptions: {
        attempts: 3,                                 // retry up to 3 times
        backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s between retries
        removeOnComplete: 100,                       // keep last 100 completed (housekeeping)
        removeOnFail: 1000,
      },
    }),
  ],
})
export class AppModule {}
```

### A worker with retries, delays, priority, rate limiting

```ts
// email.producer.ts — enqueue jobs
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailProducer {
  constructor(@InjectQueue('emails') private readonly queue: Queue) {}

  async sendWelcome(email: string) {
    await this.queue.add(
      'welcome',                          // job name (a worker can switch on this)
      { email },                          // job payload (must be JSON-serialisable)
      {
        delay: 5000,                      // wait 5s before the job becomes active
        priority: 1,                      // lower number = higher priority
        jobId: `welcome:${email}`,        // dedupe key — same id won't be added twice
      },
    );
  }
}
```

```ts
// email.processor.ts — the worker. @Processor binds it to the 'emails' queue.
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('emails', {
  concurrency: 5,                          // process up to 5 jobs in parallel
  limiter: { max: 100, duration: 60_000 }, // RATE LIMIT: ≤100 jobs per 60s (e.g. SMTP cap)
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  // Called for every job. THROW to fail → BullMQ retries per backoff config.
  async process(job: Job): Promise<void> {
    this.logger.log(`processing ${job.name} attempt ${job.attemptsMade + 1}`);
    switch (job.name) {
      case 'welcome':
        await this.mailer.send(job.data.email, 'Welcome!');
        break;
      default:
        throw new Error(`unknown job ${job.name}`);
    }
    // Returning normally = success. After attempts exhausted, job moves to 'failed'.
  }
}
```

### Recurring (cron) jobs — BullMQ vs `@nestjs/schedule`

Two ways to run scheduled work; pick based on whether you need **durability/distribution**:

```ts
// BullMQ repeatable job — survives restarts, runs once across a cluster (Redis-coordinated).
// Best for real background work you can't afford to miss. ≈ Hangfire RecurringJob.
await this.queue.add(
  'nightly-report',
  {},
  { repeat: { pattern: '0 2 * * *' } },    // cron: every day at 02:00
);
```

```ts
// @nestjs/schedule @Cron — runs IN-PROCESS. Simple, but every instance fires it
// (no coordination) and it does NOT survive a crash mid-run. ≈ a hosted timer.
import { Cron } from '@nestjs/schedule';

@Cron('0 2 * * *')
handleNightly() { /* ... */ }
```

**Rule:** if it must run exactly once across N replicas and tolerate restarts → BullMQ
repeatable job. If it's a trivial in-process tick on a single instance → `@Cron`.

### Job lifecycle events & monitoring with Bull Board

Listen to lifecycle events for metrics/alerting:

```ts
import { OnWorkerEvent } from '@nestjs/bullmq';

@OnWorkerEvent('completed')
onCompleted(job: Job) { this.metrics.inc('jobs_completed'); }

@OnWorkerEvent('failed')
onFailed(job: Job, err: Error) {
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    this.logger.error(`job ${job.id} permanently failed: ${err.message}`);
  }
}
```

**Bull Board** is the Hangfire Dashboard equivalent — a web UI to inspect queues, retry/
remove jobs, and watch throughput:

```ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailsQueue)], serverAdapter });
app.use('/admin/queues', serverAdapter.getRouter()); // protect with auth in prod!
```

---

## 8.6 API Gateway

External clients shouldn't call ten services directly — they hit a single **gateway** that
routes, terminates TLS, enforces auth/rate limits, and hides your internal topology. This is
the role **YARP** plays in .NET.

```
                         ┌──────────────────────────┐
  Browser / Mobile ────► │       API Gateway         │
                         │  TLS · auth · rate-limit  │
                         └───┬───────┬───────┬───────┘
                  /users/*   │  /orders/* │   /search/*
                             ▼           ▼            ▼
                       Users svc    Orders svc   Search svc
```

### NGINX as a reverse proxy / API gateway

NGINX is the workhorse: fast, battle-tested, config-driven. Good for path-based routing, TLS
termination, and load balancing across replicas.

```nginx
# nginx.conf — route by path prefix to upstream services (Compose DNS names)
upstream users   { server users-service:3000; }
upstream orders  { server orders-service:3000; }

server {
  listen 80;

  location /api/users/  { proxy_pass http://users/;  }   # strip prefix via trailing /
  location /api/orders/ { proxy_pass http://orders/; }

  # forward the real client info downstream (used for logging / rate limiting)
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Request-Id    $request_id;          # correlation id (see 8.7)
}
```

### `http-proxy-middleware` — a lightweight Node gateway

When you want gateway logic *in code* (custom auth, request shaping, BFF aggregation),
build a tiny Express/NestJS gateway with `http-proxy-middleware`. This is the
"YARP-in-process" approach.

```ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Per-route proxies. pathRewrite strips the gateway prefix before forwarding.
app.use('/api/users',  createProxyMiddleware({
  target: 'http://users-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' },
}));
app.use('/api/orders', createProxyMiddleware({
  target: 'http://orders-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '' },
}));

app.listen(8080);
```

### Rate limiting at the gateway

Enforce limits once, at the edge, so every service is protected without each reimplementing
it. In NGINX:

```nginx
# define a shared-memory zone keyed by client IP: 10 req/sec, burst of 20
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
  limit_req zone=api burst=20 nodelay;   # 429 when exceeded
  proxy_pass http://orders/;
}
```

In a Node gateway, use `express-rate-limit` (or `@nestjs/throttler` if the gateway is NestJS,
which you already met in Phase 6).

### BFF (Backend for Frontend)

A **BFF** is a gateway tailored to one client type. The web app and the mobile app have
different needs (payload size, aggregation, auth flows), so you give each its own gateway
that aggregates downstream calls into client-shaped responses.

```
  Web app  ──► Web BFF   ──┐
                           ├──► Users · Orders · Catalog services
  Mobile   ──► Mobile BFF ─┘    (each BFF aggregates & trims for its client)
```

The BFF can call three services and stitch one response, hiding chattiness from the client.
The risk is logic creeping into the BFF — keep it about *presentation/aggregation*, not
business rules (those belong in the services).

---

## 8.7 Distributed Observability

In a monolith, a stack trace tells the whole story. In a distributed system, one user action
fans out across services, queues, and DBs. You need the three pillars — **traces, metrics,
logs** — correlated by a shared id. The standard, cross-language, vendor-neutral toolkit is
**OpenTelemetry (OTel)** — the very same project the .NET track uses.

### OpenTelemetry for Node — `@opentelemetry/sdk-node`

OTel auto-instruments common libraries (HTTP, Express/Nest, `pg`, `ioredis`, `amqplib`) so a
trace is propagated across service boundaries via headers (`traceparent`) automatically.

```ts
// tracing.ts — MUST be imported FIRST, before any instrumented module loads.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'orders-service', // shows up in traces
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4318/v1/traces',   // export to an OTel Collector
  }),
  instrumentations: [getNodeAutoInstrumentations()], // auto-trace http/pg/redis/amqp/nest
});

sdk.start();   // call before bootstrapping Nest

// node --require ./dist/tracing.js dist/main.js   ← load tracing before everything
```

A single trace then spans every hop:

```
trace_id=abc123
 ├─ span: POST /api/orders          (gateway)
 │   └─ span: orders-service handle
 │       ├─ span: GET users-service/users/42   (HTTP, child trace via traceparent header)
 │       ├─ span: INSERT orders               (pg)
 │       └─ span: publish order.created        (amqp)
 │           └─ span: notifications consume    (continues in another service!)
```

### Correlation IDs via `AsyncLocalStorage`

Even with OTel, you want a human-friendly **correlation id** stamped on every log line so you
can `grep` one request across all services. `AsyncLocalStorage` (your `IHttpContextAccessor`/
`AsyncLocal<T>` equivalent from Phase 3) carries it implicitly through async call chains — no
threading a parameter through every function.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const als = new AsyncLocalStorage<{ correlationId: string }>();

// NestJS middleware: pull the id from the incoming header (set by the gateway) or mint one,
// then run the rest of the request inside the ALS context.
export function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-request-id'] ?? randomUUID();
  res.setHeader('x-request-id', correlationId);
  als.run({ correlationId }, () => next());   // everything downstream can read it
}

// Anywhere deep in the call stack — no param passing needed:
function currentCorrelationId() {
  return als.getStore()?.correlationId;
}
```

**Crucial:** when you make a downstream call, forward the id (`x-request-id` header for HTTP,
a message header for RabbitMQ) so the chain stays linked across services.

### Centralised logging: structured JSON → ELK / Loki + Grafana

Each service logs **structured JSON** (via `pino`/`nestjs-pino` from Phase 5) to stdout. A
collector ships those lines to a central store you can query across services.

```ts
// pino with correlation id auto-injected from ALS
import pino from 'pino';
const logger = pino({
  mixin() { return { correlationId: als.getStore()?.correlationId }; }, // on every line
});
logger.info({ orderId }, 'order created'); // → {"level":30,"correlationId":"...","orderId":...}
```

```
services  ──stdout JSON──►  shipper  ──►  store + query  ──►  dashboards
                          (Promtail/        (Loki or          (Grafana /
                           Filebeat)         Elasticsearch)     Kibana)
```

Two common stacks (functionally equivalent for our purposes):
- **ELK** — Elasticsearch + Logstash/Beats + Kibana
- **Loki + Grafana** — lighter, label-based; Promtail ships, Grafana queries

The point: never SSH into ten containers to `tail` logs. Search one place by `correlationId`.

### Distributed health checks

Each service exposes liveness/readiness endpoints so the orchestrator (Compose healthcheck,
K8s probes) and the gateway know who's healthy. NestJS provides `@nestjs/terminus`:

```ts
import { HealthCheck, HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private http: HttpHealthIndicator,
  ) {}

  @Get('live')                       // liveness: am I running? (cheap, no deps)
  @HealthCheck()
  live() { return this.health.check([]); }

  @Get('ready')                      // readiness: can I serve traffic? (check deps)
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.http.pingCheck('users-service', 'http://users-service:3000/health/live'),
    ]);
  }
}
```

**Liveness vs readiness:** a failing *liveness* probe means "restart me". A failing
*readiness* probe means "stop sending me traffic, but don't restart" — used during startup or
when a dependency (DB, broker) is temporarily down.

---

## 8.8 Resilience Patterns

Networks fail, services restart, messages arrive twice. Resilience is about *expecting*
failure and degrading gracefully. (See 8.3 for the `opossum` circuit breaker and backoff
mechanics — this section adds the data-correctness patterns.)

### Circuit breaker + retry + backoff + jitter (recap, layered)

The full defensive stack around a synchronous call, ordered from inside out:

```
  ┌─ circuit breaker (opossum) ──────────────────────────┐
  │  ┌─ retry (p-retry: exp backoff + jitter) ─────────┐ │
  │  │  ┌─ timeout (got/axios: fail slow calls) ────┐  │ │
  │  │  │            the actual HTTP call            │  │ │
  │  │  └────────────────────────────────────────────┘  │ │
  │  └────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────┘
```

**Jitter** matters: without it, every client retries at *exactly* t+1s, t+2s, t+4s — a
synchronised "thundering herd" that re-knocks-over the recovering service. Randomising the
delay (`randomize: true` in p-retry) spreads the load.

### Idempotency keys — safe retries for state-changing ops

At-least-once delivery (RabbitMQ) and HTTP retries mean a "create order" request can arrive
twice. **Idempotency keys** make a repeated operation a no-op: the client sends a unique key;
the server records it and returns the original result on replay instead of acting again.

```ts
@Post('orders')
async create(
  @Headers('Idempotency-Key') key: string,    // client-generated UUID per logical request
  @Body() dto: CreateOrderDto,
) {
  if (!key) throw new BadRequestException('Idempotency-Key required');

  // Atomic check-and-store. The UNIQUE constraint on `key` is the real guard against races.
  const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
  if (existing) return JSON.parse(existing.response);   // replay → return cached result

  const order = await this.ordersService.create(dto);

  await this.prisma.idempotencyRecord.create({
    data: { key, response: JSON.stringify(order) },     // store under the same key
  });
  return order;
}
```

The same idea applies to message consumers: store processed `messageId`s and skip
duplicates. A unique DB constraint (not just a `findFirst`) is what actually prevents two
concurrent requests from both passing the check.

### Outbox pattern — reliable event publishing with Prisma

The classic distributed bug: you save an order to your DB **and** publish `order.created` to
RabbitMQ. If the DB commit succeeds but the broker publish fails (or vice-versa, or the
process crashes between them), your systems diverge — there's no shared transaction across
DB + broker (the *dual-write problem*).

The **outbox pattern** fixes it: write the event into an `outbox` table **in the same DB
transaction** as the business change. A separate relay polls the outbox and publishes to the
broker, marking rows as sent. Now the event is published *if and only if* the business data
committed.

```
   ┌─────────── ONE DB transaction ───────────┐
   │  INSERT order (status=PENDING)             │   ← business write
   │  INSERT outbox (type=order.created, ...)   │   ← event row, same txn
   └────────────────────────────────────────────┘
                       │  (committed atomically)
                       ▼
            ┌──────────────────────┐
            │  Outbox relay (poll)  │ ── reads unsent rows
            └──────────┬───────────┘
                       ▼  publish to RabbitMQ, then mark sent=true
                  RabbitMQ ──► consumers
```

```ts
// 1. Write business data + outbox row atomically (Prisma $transaction).
async createOrder(dto: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: { userId: dto.userId, total: dto.total, status: 'PENDING' },
    });

    // Same transaction → both commit or neither does. No dual-write.
    await tx.outbox.create({
      data: {
        eventType: 'order.created',
        payload: JSON.stringify({ orderId: order.id, userId: order.userId }),
        // sent defaults to false
      },
    });
    return order;
  });
}
```

```ts
// 2. Relay: poll unsent rows, publish, mark sent. Run on an interval (or BullMQ repeatable).
@Cron('*/5 * * * * *')                            // every 5 seconds
async relayOutbox() {
  const pending = await this.prisma.outbox.findMany({
    where: { sent: false },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  for (const row of pending) {
    // emit() to RabbitMQ. Because delivery is at-least-once, consumers must be idempotent.
    await firstValueFrom(this.client.emit(row.eventType, JSON.parse(row.payload)));
    await this.prisma.outbox.update({ where: { id: row.id }, data: { sent: true } });
  }
}
```

> The relay gives **at-least-once** publishing (a crash after publish but before marking
> `sent` re-publishes the row), which is exactly why downstream consumers need idempotency.
> This is the same guarantee MassTransit's transactional outbox provides in .NET — here you
> build it explicitly with Prisma.

---

## Gotchas

- **`.send()`/`.emit()` are lazy Observables.** Nothing leaves the process until something
  subscribes. Forgetting `firstValueFrom()` means the request silently never fires.
- **`@MessagePattern` is request/response, `@EventPattern` is fire-and-forget.** Returning a
  value from an `@EventPattern` handler does nothing — there's no caller waiting.
- **Auto-ack loses messages on crash.** With RMQ `noAck: true` (default), a handler crash
  drops the message. Use `noAck: false` + manual `ack` for at-least-once delivery.
- **At-least-once ⇒ duplicates.** Any at-least-once channel (RMQ manual-ack, outbox relay,
  HTTP retries) can deliver twice. Consumers/endpoints handling state changes **must** be
  idempotent — this is not optional.
- **Never auto-retry non-idempotent HTTP methods.** Retrying a POST can double-charge a card.
  Retry GET/PUT/DELETE freely; gate POST behind an idempotency key.
- **Dual-write is a trap.** "Save to DB, then publish to broker" is not atomic. Use the
  outbox pattern; do not rely on try/catch to keep them in sync.
- **Retries without jitter cause thundering herds.** Synchronised exponential backoff re-DDoSes
  the recovering service. Always randomise.
- **A circuit breaker with no fallback just fails faster.** Pair `breaker.fire()` with a
  `breaker.fallback()` (cached/default value) so callers degrade gracefully, not just error.
- **OTel `tracing.ts` must load first.** Auto-instrumentation patches libraries at
  `require` time — load it via `node --require` before any other module, or spans go missing.
- **Don't share a database between services.** A `JOIN` across service tables, or a second
  service quietly reading the first's tables, silently rebuilds the monolith you split apart.
- **Compose DNS names, not localhost.** Inside the network a service is reachable at
  `http://users-service:3000`, never `localhost` — `localhost` is the container itself.
- **`@Cron` fires on every replica.** In-process `@nestjs/schedule` jobs run on *each*
  instance. For run-once-across-the-cluster scheduled work, use a BullMQ repeatable job.

---

## Phase 8 Project

**Task:** Build two microservices — **Users** and **Orders** — that communicate over **HTTP**
(synchronous validation) and **RabbitMQ** (asynchronous events), all wired together with
**Docker Compose**.

**Architecture:**

```
                        ┌──────────────────────┐
   client ─────────────►│  NGINX API gateway    │  :8080
                        └───┬───────────────┬───┘
                /users/*    │               │   /orders/*
                            ▼               ▼
                    ┌──────────────┐  ┌──────────────┐
                    │ Users svc    │  │ Orders svc   │
                    │ HTTP + RMQ   │  │ HTTP + RMQ   │
                    └──────┬───────┘  └──────┬───────┘
                           │                 │
                      ┌────┴────┐       ┌────┴─────┐
                      │ users-db │       │ orders-db│   (separate Postgres each)
                      └─────────┘       └──────────┘
                           ▲                 │
                           │   RabbitMQ      │
                           └──── broker ◄────┘   (order.created, user.updated)
```

**Requirements:**

1. **Users service** — NestJS hybrid app (HTTP + RMQ).
   - HTTP: `POST /users`, `GET /users/:id`.
   - Exposes `@MessagePattern('users.get_by_id')` so Orders can validate a user synchronously.
   - On user create, `emit('user.created', {...})`.
   - Own PostgreSQL (`users-db`) via Prisma.

2. **Orders service** — NestJS hybrid app (HTTP + RMQ).
   - HTTP: `POST /orders` (requires an `Idempotency-Key` header), `GET /orders/:id`.
   - On create: validate the user via **HTTP** to `users-service` (wrapped in an `opossum`
     circuit breaker + timeout), then persist the order **and** an outbox row in one Prisma
     transaction.
   - An outbox relay (`@Cron` every 5s) publishes `order.created` to RabbitMQ.
   - Listens for `@EventPattern('user.updated')` to keep a denormalised `customerName` fresh.
   - Own PostgreSQL (`orders-db`) via Prisma.

3. **Gateway** — NGINX routing `/api/users/*` and `/api/orders/*`, with edge rate limiting.

4. **Cross-cutting** — every service: structured JSON logs (`nestjs-pino`) carrying a
   `correlationId` from `AsyncLocalStorage` (forwarded as `x-request-id` over HTTP and as a
   message header over RMQ), and `@nestjs/terminus` `/health/live` + `/health/ready`.

5. **Docker Compose** — `users-service`, `orders-service`, `users-db`, `orders-db`,
   `rabbitmq` (with management UI), `gateway`. Use `depends_on` with health-check conditions.

**Location:** `examples/phase8-microservices/`

**Hints:**
- Start RabbitMQ with the management plugin (`rabbitmq:3-management`) so you can watch
  exchanges/queues at `:15672` (guest/guest).
- Make both services hybrid apps: `connectMicroservice()` + `startAllMicroservices()` +
  `listen()` (see 8.2).
- Give Orders a `USERS_SERVICE` `ClientProxy` (RMQ) for `users.get_by_id`, **and** an
  `HttpService`/`got` client for the synchronous validation path — practise both styles.
- Seed the circuit breaker's value: stop the Users container mid-test and confirm Orders
  returns the `degraded` fallback instead of hanging — then restart and watch it close.
- Prove idempotency: replay the same `POST /orders` with an identical `Idempotency-Key` and
  confirm exactly one order row exists.
- Prove the outbox: kill the Orders process *after* the DB commit but *before* the relay runs;
  on restart the relay should still publish `order.created` (nothing lost).
- Verify a single `correlationId` appears in logs of all three components for one request.

**Stretch goals:**
- Add a dead-letter queue for `order.created` and a poison-message test.
- Add OpenTelemetry tracing to all services exporting to an OTel Collector → Jaeger; confirm
  one trace spans gateway → orders → users → broker → consumer.
- Add a BullMQ-backed `emails` queue in Users for the welcome email, with Bull Board at
  `/admin/queues`.
- Model the order flow as a **choreography saga** with a `payment` service and a compensating
  `order.cancelled` path.

---

## Interview Questions

### Microservices Fundamentals

1. What is the single most important rule about data ownership in a microservices architecture, and what breaks if you violate it?
2. Why is a "distributed monolith" considered the worst of both worlds, and how do you recognise one in a codebase?
3. How do bounded contexts from DDD map onto service boundaries, and what signal tells you a boundary is drawn in the wrong place?
4. When should you NOT split a monolith into microservices, and what concrete criteria would make you pull the trigger on a split?
5. If the Orders service needs the customer's name in its responses but owns no user data, how do you handle that without a cross-service JOIN, and what are the consistency trade-offs?
6. What is polyglot persistence, what operational burden does it introduce, and when is that burden worth paying?
7. How would you handle a schema migration in a service that is consumed by five other services without a coordinated deploy?
8. What is the difference between a modular monolith and a microservices system, and why might you prefer the former as a starting point?
9. How do you decide the granularity of a service — what makes a service too small, and what makes it too large?
10. What problems arise when two services share a library that contains domain logic, and how would you handle shared code across services?

### NestJS Microservices Transport

11. What is the fundamental difference between `@MessagePattern` and `@EventPattern` in NestJS, and when would using the wrong one cause a silent failure?
12. Why does calling `.send()` on a `ClientProxy` without subscribing result in no message being sent, and how does this differ from a traditional HTTP client call?
13. How does `@nestjs/microservices` achieve transport portability, and what would you need to change in your handlers if you swapped from RabbitMQ to Kafka?
14. What is a hybrid NestJS application, and what problem does it solve compared to running two separate processes?
15. What are the trade-offs between NestJS's built-in RMQ transport and a library like `@golevelup/nestjs-rabbitmq` when you need topic exchanges and fine-grained bindings?
16. How would you pass a correlation ID through a RabbitMQ message so that the consuming service can include it in its own logs?
17. What happens if a `@MessagePattern` handler throws an unhandled exception — does the calling service get an error back or does the call hang, and how do you handle this gracefully?
18. How do you register a `ClientProxy` for multiple different services in the same NestJS module without them colliding?
19. Why is `firstValueFrom()` used to await an Observable from `ClientProxy.send()` rather than just `.toPromise()`, and what is the practical difference?
20. How would you test a NestJS microservices controller that uses `@EventPattern` in isolation, without spinning up a real broker?

### Messaging & Events (RabbitMQ)

21. Walk through the AMQP model: publisher → exchange → binding → queue → consumer. What happens if no binding matches a message's routing key?
22. What is the difference between `direct`, `topic`, and `fanout` exchange types, and give a concrete use case for each?
23. What is the difference between `noAck: true` and `noAck: false`, and what guarantee does each provide about message delivery?
24. Why does at-least-once delivery require consumers to be idempotent, and what breaks if they are not?
25. What is a dead-letter exchange, how do you configure one in RabbitMQ, and what should happen to messages that land in the dead-letter queue?
26. How would you implement a retry-with-delay loop using RabbitMQ's dead-letter mechanism and a TTL queue?
27. What is a "poison message", and how do you prevent one from wedging an entire queue indefinitely?
28. What is the difference between choreography and orchestration in a saga, and what are the failure-visibility trade-offs of each?
29. In a choreography-based saga where payment fails after inventory was reserved, how does the compensating transaction get triggered, and what happens if the compensation itself fails?
30. How would you add a timeout to a saga step — for example, if the Payment service never responds to an `order.created` event?

### BullMQ & Job Queues

31. What is the fundamental difference in use case between BullMQ and the NestJS RMQ transport, and when would using RabbitMQ for background jobs be the wrong choice?
32. How does BullMQ's exponential backoff work, and why does it not protect you from thundering herds without jitter?
33. What is the `jobId` option in BullMQ used for, and how does it provide deduplication?
34. Why does a BullMQ repeatable job survive a restart when an `@Cron` decorator does not, and what mechanism makes the difference?
35. If you have five replicas of a service each running a `@Cron` job, how many times will the job fire per tick, and how would you fix that using BullMQ?
36. What is the `concurrency` option on a BullMQ `@Processor`, and what are the risks of setting it too high in a Node.js process?
37. How does BullMQ's rate limiter differ from a per-request rate limit at the API gateway, and when do you need both?
38. What is the difference between a job moving to `failed` state versus `delayed` state in BullMQ, and how does `attempts` interact with `backoff`?
39. How would you drain a BullMQ queue safely during a deployment without losing in-flight jobs?
40. Describe a scenario where Bull Board's visibility would reveal a production bug that structured logs alone would not surface quickly.

### Resilience Patterns

41. Explain the three states of a circuit breaker and what triggers each state transition in `opossum`.
42. Why does the order matter when layering timeout, retry, and circuit breaker — what goes wrong if you put the circuit breaker inside the retry loop?
43. What is the `errorThresholdPercentage` in `opossum` measuring, and why is a rolling window more useful than a cumulative counter?
44. What is the dual-write problem, and why is a try/catch block around "save to DB then publish to broker" not an adequate solution?
45. Walk through the outbox pattern step by step and explain why it provides at-least-once (not exactly-once) publishing.
46. How does an idempotency key actually prevent duplicate orders when two concurrent requests arrive with the same key — what database-level mechanism is the real guard?
47. What is the difference between an idempotency key and a message deduplication ID, and where does each live in your stack?
48. If the outbox relay crashes after publishing to RabbitMQ but before marking the row as `sent`, what happens on restart, and how must downstream consumers handle it?
49. What is a thundering herd, and how does jitter in exponential backoff prevent it?
50. How would you make an HTTP `POST /orders` endpoint safe to retry, given that POST is not idempotent by default?

### Service Discovery & API Gateway

51. How does Docker Compose DNS-based service discovery work, and what are its limitations compared to a service mesh like Consul or Istio?
52. What is the difference between client-side and server-side service discovery, and which model does Kubernetes' DNS service use?
53. What concerns should live at the API gateway versus inside individual services, and what happens when business logic creeps into the gateway?
54. What is the Backend for Frontend (BFF) pattern, and when does the added complexity of maintaining two gateways justify the split?
55. How does `http-proxy-middleware` differ from NGINX as an API gateway, and what are the trade-offs in terms of performance, flexibility, and operational overhead?
56. How would you implement JWT validation at the NGINX gateway level so that downstream services do not each need to re-validate the token?
57. What is the risk of doing aggressive rate limiting only at the gateway when you have services that also receive internal traffic from other services?
58. How would you propagate a `x-request-id` correlation header from NGINX to downstream services, and what configuration achieves that?

### Distributed Tracing & Observability

59. What is a trace, what is a span, and how does the `traceparent` header propagate context across service boundaries in OpenTelemetry?
60. Why must the OpenTelemetry SDK be loaded via `node --require` before any other module, and what breaks if it loads after `express` or `@nestjs/core`?
61. What is the difference between a trace and a correlation ID, and why do you need both in a production system?
62. How does `AsyncLocalStorage` carry a correlation ID through an async call chain without passing it as a function argument, and what pitfall arises when you cross a callback-based boundary?
63. What is the difference between liveness and readiness health probes, and what happens in Kubernetes if a service's readiness probe fails versus its liveness probe fails?
64. Why should structured JSON be logged to stdout rather than to a file, and what collects and ships those logs in a typical ELK or Loki stack?
65. How would you correlate a log line from the Orders service with the trace span that triggered it, given both OTel tracing and `pino` structured logging are in use?
66. What are the three pillars of observability, and what specific gap does each pillar fill that the others cannot?
67. How would you add a custom span attribute to an OpenTelemetry trace inside a NestJS service method without changing the auto-instrumentation setup?

### gRPC & Service Communication

68. What are the trade-offs between gRPC and REST for internal service-to-service communication, and which would you choose for a high-throughput internal API and why?
69. What is a `.proto` file and what role does it play in gRPC's type safety guarantee across polyglot services?
70. How does NestJS's gRPC transport differ from the TCP transport, and when would you reach for gRPC over the built-in TCP?
71. What is gRPC server-streaming, and give a use case where it is a better fit than a polling REST endpoint?
72. How would you handle backward-compatible `.proto` schema evolution — adding a new field to a message — without breaking existing clients?

### CQRS & Event Sourcing

73. What problem does CQRS solve, and why does splitting reads from writes become particularly valuable in a microservices context?
74. How does `@nestjs/cqrs` separate command handlers from query handlers, and what is the benefit of that separation in terms of testability?
75. What is eventual consistency in the context of CQRS read models, and how would you explain the read-your-own-writes problem to a frontend developer?
76. What is event sourcing, how does it differ from storing only current state, and what are the recovery and auditability benefits?
77. What is a projection in event sourcing, and how do you rebuild one after a bug is discovered in the original projection logic?
78. What is the difference between a domain event and an integration event, and why should you not publish raw domain events directly to a message broker?
