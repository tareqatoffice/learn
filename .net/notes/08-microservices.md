# Phase 8 — Microservices

**Status:** Not started
**Targets:** .NET 10, `IHttpClientFactory` + Polly, `Grpc.AspNetCore`, MassTransit over RabbitMQ, YARP, OpenTelemetry

> There is a parallel `javascript/` microservices module. Where a .NET tool has a Node
> twin, it's noted inline (e.g. MassTransit ≈ amqplib/BullMQ). This file stays .NET-focused —
> use the Node names only as a mental anchor, not as the implementation.

---

## 8.1 Microservices Fundamentals

### Monolith vs Microservices

A **monolith** is one deployable unit: one process, one codebase, usually one database. Your
Phase 4 Clean Architecture API is a (well-structured) monolith. A **microservices** system is
many small services, each independently deployable, each owning its own data, talking over the
network.

```
   MONOLITH                          MICROSERVICES
 ┌───────────────────────┐       ┌──────────┐  ┌──────────┐  ┌──────────┐
 │  Users  Orders  Email │       │  Users   │  │  Orders  │  │  Email   │
 │  (one process)        │       │  svc     │  │  svc     │  │  svc     │
 │                       │       └────┬─────┘  └────┬─────┘  └────┬─────┘
 │  ┌─────────────────┐  │            │  HTTP/gRPC  │  RabbitMQ   │
 │  │  one database   │  │       ┌────┴───┐    ┌────┴───┐    ┌────┴───┐
 │  └─────────────────┘  │       │ users  │    │ orders │    │ (no db)│
 └───────────────────────┘       │  DB    │    │  DB    │    └────────┘
                                  └────────┘    └────────┘
   one deploy, in-process calls    many deploys, network calls, db-per-service
```

**The Node analogy:** a monolith is one Express app with all your routers mounted. Microservices
is the world you enter when each domain becomes its own Nest/Express app behind a gateway,
deployed separately, scaled separately.

### The trade-off table

| | Monolith | Microservices |
|---|---|---|
| Deploy | One unit, simple | Many units, needs CI/CD + orchestration |
| Calls between modules | In-process method call (fast, reliable) | Network call (slow, can fail) |
| Data | One DB, easy transactions/joins | DB per service, no cross-service joins |
| Scaling | Scale the whole app | Scale hot services independently |
| Team autonomy | Everyone in one repo | Teams own services end-to-end |
| Debugging | Single stack trace | Distributed trace across services |
| Consistency | ACID transactions | Eventual consistency, sagas |
| Failure blast radius | One bug can take down all | Isolate failures (if done right) |

### When microservices make sense — and when they don't

**Make sense when:**
- Multiple teams need to deploy independently without stepping on each other
- Parts of the system have wildly different scaling needs (e.g. an image-processing service)
- Bounded contexts are genuinely separate and stable
- You already have mature CI/CD, observability, and on-call culture

**Do NOT reach for them when:**
- You're a small team or solo (the operational tax will crush you)
- The domain boundaries aren't clear yet — you'll draw service lines in the wrong place and
  every change becomes a multi-service deploy ("distributed monolith" — the worst of both)
- You don't have distributed tracing and centralised logging yet

> **The standard advice — and it's correct:** start with a **modular monolith** (clean module
> boundaries, one deploy). Split out a service only when there's a concrete pressure (scaling,
> team ownership, deploy cadence) forcing your hand. You can't easily un-split a service.

### Service boundaries = DDD bounded contexts

Don't split by technical layer (a "controllers service" + a "database service" is nonsense).
Split by **bounded context** — a slice of the business domain with its own language and rules.

In Domain-Driven Design, a *bounded context* is the boundary within which a model is consistent.
"User" in the Identity context (credentials, roles) is a different model from "Customer" in the
Orders context (shipping address, order history) — even if they share a person. Each becomes a
candidate service.

```
  Identity context        Ordering context        Notification context
  ─────────────────       ─────────────────       ─────────────────────
  User, Role, Login   →   Customer, Order, Cart   Email, SmsMessage
  "authentication"        "fulfilment"            "delivery of messages"
       │                        │                        │
   Users service           Orders service          Email service
```

### Data per service — no shared database

The hard rule that makes microservices actually microservices: **each service owns its data and
no other service touches that database.** If Orders needs user data, it asks the Users service
(HTTP/gRPC) or listens for user events (messaging) — it never runs `SELECT * FROM users` against
the Users DB.

Why this is non-negotiable:
- A shared DB is a hidden coupling — change a column and you break services you didn't know existed
- Independent deploys become impossible (a migration locks everyone)
- Each service can pick the right storage (Orders → Postgres, Catalog → Elasticsearch, etc.)

The cost you pay: no cross-service `JOIN`, no distributed ACID transaction. You get
**eventual consistency** instead, which §8.4 (messaging) and §8.8 (outbox, sagas) exist to manage.

---

## 8.2 Synchronous Communication — HTTP

When Orders needs "give me user 42 *right now* to put the name on the order", that's a synchronous
request/response call. In .NET this is `HttpClient` — but how you create it matters enormously.

### `HttpClient` best practices — and the socket-exhaustion trap

The single most important .NET-specific lesson here. The naive pattern:

```csharp
// ❌ NEVER do this in a loop / per request
using var client = new HttpClient();          // new socket each time
var res = await client.GetAsync("https://users/api/users/42");
```

`HttpClient` is `IDisposable`, so instinct says wrap it in `using`. **Wrong.** Disposing it
leaves the underlying TCP socket stuck in `TIME_WAIT` for up to ~240s. Under load you exhaust the
OS's ephemeral ports — `SocketException: Only one usage of each socket address...`. This is the
.NET equivalent of creating a brand-new `axios` instance (with its own connection pool) on every
single request and never letting Node reuse keep-alive sockets.

The *other* naive fix — one `static HttpClient` for the whole app — solves sockets but creates a
new bug: it caches DNS forever, so it won't notice a service's IP changing.

**The correct answer: `IHttpClientFactory`.** It pools and reuses `HttpMessageHandler`s (the part
that holds the sockets) and rotates them on a schedule so DNS stays fresh. You get a cheap
`HttpClient` per call backed by a shared, healthy connection pool.

### Named clients

Register a configured client by name, resolve it via the factory:

```csharp
// Program.cs
builder.Services.AddHttpClient("users", client =>
{
    client.BaseAddress = new Uri("http://users-service");   // Docker DNS name (see §8.6)
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// Consume it
public class OrderService(IHttpClientFactory factory)
{
    public async Task<UserDto?> GetUserAsync(int id, CancellationToken ct)
    {
        HttpClient client = factory.CreateClient("users");   // cheap — pulls a pooled handler
        return await client.GetFromJsonAsync<UserDto>($"/api/users/{id}", ct);
    }
}
```

### Typed clients (preferred)

A typed client wraps the `HttpClient` in your own strongly-typed class. The DI container injects a
correctly-configured `HttpClient`; consumers depend on *your* interface, not raw HTTP. This is the
idiomatic choice — think of it as a generated API SDK for the downstream service.

```csharp
// 1. The typed client — owns the HttpClient, exposes domain methods
public interface IUsersApi
{
    Task<UserDto?> GetUserAsync(int id, CancellationToken ct = default);
}

public class UsersApi(HttpClient http) : IUsersApi   // HttpClient injected by the factory
{
    public async Task<UserDto?> GetUserAsync(int id, CancellationToken ct = default)
    {
        // GetFromJsonAsync returns null on 404; throws on other non-2xx
        return await http.GetFromJsonAsync<UserDto>($"/api/users/{id}", ct);
    }
}

// 2. Registration — binds UsersApi to a configured HttpClient
builder.Services.AddHttpClient<IUsersApi, UsersApi>(client =>
{
    client.BaseAddress = new Uri("http://users-service");
    client.Timeout = TimeSpan.FromSeconds(30);   // outer ceiling; per-try timeout via Polly below
});

// 3. Consume — no HTTP details leak in
public class OrdersController(IUsersApi users) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrder cmd, CancellationToken ct)
    {
        var user = await users.GetUserAsync(cmd.UserId, ct);
        if (user is null) return BadRequest("User not found");
        // ... create order
    }
}

public record UserDto(int Id, string Name, string Email);
```

### Polly — retry, circuit breaker, timeout

The network *will* fail: transient blips, a service mid-deploy, a slow dependency. **Polly** is
.NET's resilience library (≈ `axios-retry` + a circuit-breaker lib, but far richer). In .NET 8+
it's wired through `Microsoft.Extensions.Http.Resilience`, which adds a ready-made pipeline to any
named/typed client.

```csharp
// dotnet add package Microsoft.Extensions.Http.Resilience
builder.Services.AddHttpClient<IUsersApi, UsersApi>(client =>
    {
        client.BaseAddress = new Uri("http://users-service");
    })
    .AddResilienceHandler("users-pipeline", pipeline =>
    {
        // 1) total timeout for the whole operation incl. retries
        pipeline.AddTimeout(TimeSpan.FromSeconds(15));

        // 2) retry transient failures with exponential backoff + jitter
        pipeline.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            BackoffType      = DelayBackoffType.Exponential, // 1s, 2s, 4s …
            UseJitter        = true,   // spreads retries so clients don't stampede together
            // by default handles 5xx, 408, and HttpRequestException — i.e. transient faults
        });

        // 3) circuit breaker — stop hammering a service that's clearly down (see §8.8)
        pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
        {
            FailureRatio     = 0.5,                       // open if ≥50% of calls fail
            MinimumThroughput = 10,                       // …over a sample of ≥10 calls
            SamplingDuration  = TimeSpan.FromSeconds(30),
            BreakDuration     = TimeSpan.FromSeconds(15), // stay open 15s, then half-open to test
        });

        // 4) per-attempt timeout — fail one slow try fast so retry can fire
        pipeline.AddTimeout(TimeSpan.FromSeconds(3));
    });
```

**Order matters.** The pipeline wraps outermost → innermost: total-timeout ▸ retry ▸ breaker ▸
per-try-timeout ▸ the HTTP call. The retry sits *outside* the breaker so the breaker counts each
individual attempt; the per-try timeout sits *inside* so a single hung attempt is abandoned and
retried rather than eating the whole budget.

> **Only retry idempotent operations.** Retrying a `GET` is safe. Retrying a `POST` that creates
> an order can create duplicates — guard it with idempotency (§8.8).

### REST vs gRPC (quick decision)

REST/JSON is universal, human-readable, browser/curl-friendly — perfect for public APIs and the
edge. gRPC is binary, contract-first, fast, with streaming — perfect for chatty internal
service-to-service calls. More in §8.3.

---

## 8.3 Synchronous Communication — gRPC

gRPC is a high-performance RPC framework: you define the service contract in a `.proto` file,
generate strongly-typed client + server stubs, and calls feel like local method calls over HTTP/2
with Protocol Buffers (compact binary) on the wire. **Node twin:** `@grpc/grpc-js` +
`@grpc/proto-loader`, same `.proto` files.

### Protocol Buffers — the `.proto` contract

The `.proto` is the single source of truth, shared by both services. The compiler generates C#
(and would generate TS) from it — like a typed contract you can't drift from.

```protobuf
// Protos/users.proto
syntax = "proto3";

option csharp_namespace = "Users.Grpc";   // generated C# namespace

package users;

// The service = the set of RPC methods
service UserService {
  // unary: one request, one response (the common case)
  rpc GetUser (GetUserRequest) returns (UserReply);

  // server streaming: one request, a stream of responses
  rpc ListUsers (ListUsersRequest) returns (stream UserReply);
}

message GetUserRequest {
  int32 id = 1;          // the numbers are field tags (wire identity) — never reuse/renumber
}

message ListUsersRequest {
  string name_filter = 1;
}

message UserReply {
  int32 id = 1;
  string name = 2;
  string email = 3;
}
```

### `Grpc.AspNetCore` — server side

```xml
<!-- Users.csproj -->
<ItemGroup>
  <PackageReference Include="Grpc.AspNetCore" Version="2.*" />
  <!-- GrpcServices="Server" generates the abstract base class to inherit -->
  <Protobuf Include="Protos/users.proto" GrpcServices="Server" />
</ItemGroup>
```

```csharp
// Services/UserGrpcService.cs — inherit the generated base
public class UserGrpcService(IUserRepository repo) : UserService.UserServiceBase
{
    public override async Task<UserReply> GetUser(GetUserRequest request, ServerCallContext context)
    {
        var user = await repo.GetByIdAsync(request.Id, context.CancellationToken);
        if (user is null)
            throw new RpcException(new Status(StatusCode.NotFound, $"User {request.Id} not found"));

        return new UserReply { Id = user.Id, Name = user.Name, Email = user.Email };
    }

    // server-streaming: push items as they're produced
    public override async Task ListUsers(ListUsersRequest request,
        IServerStreamWriter<UserReply> responseStream, ServerCallContext context)
    {
        await foreach (var u in repo.StreamAsync(request.NameFilter, context.CancellationToken))
            await responseStream.WriteAsync(new UserReply { Id = u.Id, Name = u.Name, Email = u.Email });
    }
}

// Program.cs
builder.Services.AddGrpc();
app.MapGrpcService<UserGrpcService>();
```

### Client side (in the Orders service)

```xml
<Protobuf Include="Protos/users.proto" GrpcServices="Client" />
```

```csharp
// Register a typed gRPC client (same factory machinery as HTTP, Polly works too)
builder.Services.AddGrpcClient<UserService.UserServiceClient>(o =>
{
    o.Address = new Uri("http://users-service");   // HTTP/2; use https in prod
});

// Consume — feels like a local async method
public class OrderEnricher(UserService.UserServiceClient users)
{
    public async Task<string> GetUserNameAsync(int id, CancellationToken ct)
    {
        UserReply reply = await users.GetUserAsync(new GetUserRequest { Id = id },
                                                   cancellationToken: ct);
        return reply.Name;
    }
}
```

### The four call types

| Type | Shape | Example |
|---|---|---|
| **Unary** | 1 req → 1 resp | `GetUser(id)` — the 90% case |
| **Server streaming** | 1 req → stream resp | `ListUsers()` returning a live feed |
| **Client streaming** | stream req → 1 resp | upload many records, get one summary |
| **Bidirectional** | stream ↔ stream | chat, live telemetry, multiplayer |

```
unary:        C ──req──▶ S            server-stream: C ──req──▶ S
              C ◀─resp── S                           C ◀─resp── S
                                                     C ◀─resp── S  (…)

client-stream:C ──req──▶ S            bidi:          C ⇄ req/resp ⇄ S
              C ──req──▶ S                            C ⇄ req/resp ⇄ S
              C ◀─resp── S  (one)                     (independent streams)
```

### When gRPC vs REST

**Reach for gRPC when:** internal service-to-service calls, high call volume / low latency
matters, you want a strict shared contract, or you need streaming. **Stick with REST when:**
public-facing API, browser clients (gRPC needs gRPC-Web + a proxy), third-party integrators,
or you just want curl-debuggable JSON. A common shape: **REST at the edge (gateway), gRPC
between internal services.**

---

## 8.4 Asynchronous Communication — Message Brokers

Synchronous HTTP/gRPC couples services in time: if Users is down when Orders calls it, the order
fails. **Asynchronous messaging** breaks that coupling — Orders publishes "OrderPlaced" to a
broker and moves on; whoever cares (Email, Inventory) consumes it whenever they're ready, even
minutes later.

```
   SYNC (temporal coupling)              ASYNC (decoupled via broker)
   Orders ──HTTP──▶ Email                Orders ──publish──▶ [ RabbitMQ ] ──▶ Email
        (Email down ⇒ order fails)            (fire & forget)      │      ──▶ Inventory
                                                                   └──────▶ Analytics
                                          Email down? message waits in its queue.
```

### Why async — decoupling & resilience

- **Decoupling:** the publisher doesn't know or care who consumes. Add a new consumer (Analytics)
  without touching the publisher.
- **Resilience:** a down consumer doesn't fail the publisher; messages buffer in the queue and are
  processed when it recovers.
- **Load levelling:** a burst of orders queues up and consumers drain it at their own pace instead
  of being overwhelmed.

**Node twins:** RabbitMQ via `amqplib`; for in-process/Redis job queues, `BullMQ`. MassTransit
plays the role a hand-rolled message-bus wrapper or NestJS's microservice transport would.

### RabbitMQ core concepts

RabbitMQ doesn't deliver messages straight to queues. Publishers send to an **exchange**, and
the exchange routes copies to **queues** according to **bindings** and **routing keys**.

```
  Publisher ──▶  EXCHANGE  ──(binding, routing key)──▶  QUEUE  ──▶ Consumer
                  │                                       (durable buffer)
   exchange types: ├─ direct  : routing key must match exactly
                   ├─ topic   : routing key matched with wildcards (order.*.created)
                   ├─ fanout  : copy to every bound queue (ignore routing key)
                   └─ headers : route on header values
```

- **Exchange** — the router. Publishers only ever talk to exchanges.
- **Queue** — a durable buffer holding messages until a consumer acks them.
- **Binding** — a rule linking an exchange to a queue (optionally with a routing-key pattern).
- **Routing key** — a label on the message the exchange uses to decide which queues get it.

You *can* drive this by hand with `RabbitMQ.Client`, but it's tedious and error-prone. So:

### MassTransit — the message-bus framework

MassTransit sits on top of RabbitMQ and hides exchange/queue/binding wiring behind a clean
publish/consume API. You define a **message** (a record), publish it, and write a **consumer**;
MassTransit creates the exchanges and queues, handles serialization, retries, and acks.

```csharp
// dotnet add package MassTransit.RabbitMQ

// 1) The message contract — a shared record (often in a small shared "Contracts" library)
public record OrderPlaced(Guid OrderId, int UserId, decimal Total, DateTime PlacedAt);

// 2) Configure MassTransit (same in both services)
builder.Services.AddMassTransit(x =>
{
    // register all consumers found in this assembly
    x.AddConsumers(typeof(Program).Assembly);

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("rabbitmq", h =>            // Docker service name (§8.6)
        {
            h.Username("guest");
            h.Password("guest");
        });

        // auto-create exchanges/queues from registered consumers + naming conventions
        cfg.ConfigureEndpoints(context);

        // built-in retry: 3 tries, 5s apart (consumer-side resilience)
        cfg.UseMessageRetry(r => r.Interval(3, TimeSpan.FromSeconds(5)));
    });
});
```

**Publisher (Orders service):**

```csharp
public class OrdersController(IPublishEndpoint publisher) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrder cmd, CancellationToken ct)
    {
        var order = /* ... persist the order ... */;

        // Publish = broadcast to anyone subscribed (fanout-ish). Fire and continue.
        await publisher.Publish(new OrderPlaced(order.Id, order.UserId, order.Total, DateTime.UtcNow), ct);

        return Accepted();
    }
}
```

**Consumer (Email service):**

```csharp
public class OrderPlacedConsumer(IEmailSender email) : IConsumer<OrderPlaced>
{
    public async Task Consume(ConsumeContext<OrderPlaced> ctx)
    {
        OrderPlaced msg = ctx.Message;
        await email.SendAsync(msg.UserId, $"Your order {msg.OrderId} for {msg.Total:C} is confirmed.");
        // No throw = MassTransit acks the message and removes it from the queue.
        // Throw = it retries, then (if still failing) moves it to an _error queue (a DLQ).
    }
}
```

> **Publish vs Send.** `Publish` = event broadcast to *all* subscribers ("OrderPlaced happened").
> `Send` = command to *one* specific queue ("ChargeCard, you specifically"). Events are past-tense
> facts; commands are imperatives.

### Sagas — distributed transactions

You can't wrap a transaction across services (no shared DB, no distributed ACID). A **saga** is a
sequence of local transactions, each emitting an event that triggers the next — and if a step
fails, **compensating** actions undo the earlier ones (cancel order, refund payment).

Two coordination styles:

```
  CHOREOGRAPHY (events, no central brain)        ORCHESTRATION (a coordinator)
  Order ─OrderPlaced▶ Payment ─Paid▶ Shipping     ┌──────────────┐
        ◀─Failed── (each reacts to events)        │ Saga (state  │──▶ Payment
                                                   │  machine)    │──▶ Shipping
  + simple, decoupled                              └──────────────┘──▶ Inventory
  − logic smeared across services, hard to trace   + central, visible flow & state
                                                   − the orchestrator is a dependency
```

- **Choreography:** each service listens for events and reacts. No central controller. Great for
  simple flows; the business process becomes implicit and hard to follow as it grows.
- **Orchestration:** a saga state machine (MassTransit has `MassTransitStateMachine`) explicitly
  drives the steps and holds the state. Easier to reason about and to add compensation, at the
  cost of a central component. Prefer orchestration once a flow has 3+ steps or needs compensation.

---

## 8.5 API Gateway

Right now every client would need to know the address of every service, and each service would
re-implement auth, CORS, and rate limiting. An **API gateway** is a single front door: one public
endpoint that routes incoming requests to the right internal service and handles cross-cutting
concerns in one place.

```
                         ┌──────────────────────────────┐
   Browser / Mobile ───▶ │   API GATEWAY (YARP)         │
                         │  • routing  • auth/JWT        │
                         │  • rate limit  • CORS         │
                         └───────┬───────────┬──────────┘
            /api/users/*  ───────┘           └─────── /api/orders/*
                    ▼                                  ▼
              Users service                       Orders service
        (internal, not publicly exposed)   (internal, not publicly exposed)
```

**Why a gateway:**
- **Single entry point** — clients hit one host; internal topology stays private and movable.
- **Routing** — path/host-based routing to the right backend.
- **Cross-cutting auth** — validate the JWT once at the edge instead of in every service.
- **Rate limiting, CORS, TLS termination** — configured once.

**Node twin:** `http-proxy` / `express-gateway`, or a NestJS app acting as the gateway.

### YARP — Microsoft's reverse proxy

**YARP** (Yet Another Reverse Proxy) is a library you host inside a normal ASP.NET app and drive
mostly from config — so the gateway is *just another .NET service*, fully programmable when needed.

```csharp
// Gateway project — dotnet add package Yarp.ReverseProxy
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();
app.UseAuthentication();   // validate JWT once, here at the edge
app.UseAuthorization();
app.MapReverseProxy();     // hand matching requests to the proxy
app.Run();
```

```jsonc
// appsettings.json — routes map an inbound match to a cluster of backends
{
  "ReverseProxy": {
    "Routes": {
      "users-route": {
        "ClusterId": "users-cluster",
        "Match": { "Path": "/api/users/{**catch-all}" }
      },
      "orders-route": {
        "ClusterId": "orders-cluster",
        "Match": { "Path": "/api/orders/{**catch-all}" }
      }
    },
    "Clusters": {
      "users-cluster": {
        "Destinations": {
          "d1": { "Address": "http://users-service" }   // Docker DNS (§8.6)
        }
      },
      "orders-cluster": {
        "Destinations": {
          "d1": { "Address": "http://orders-service" }
        }
      }
    }
  }
}
```

A request to `GET http://gateway/api/users/42` matches `users-route` and is proxied to
`http://users-service/api/users/42`. Adding a second destination to a cluster gives you
round-robin load balancing for free.

### Ocelot — the alternative

**Ocelot** is the older, more opinionated .NET gateway (config-driven JSON of "ReRoutes", built-in
rate limiting and JWT). It's batteries-included but less performant and less flexible than YARP.
**Use YARP for new projects;** know Ocelot exists because older codebases use it.

### BFF — Backend for Frontend

One gateway rarely fits all clients: a web SPA and a mobile app want different payload shapes and
aggregations. The **BFF pattern** gives each frontend its *own* gateway tailored to it — the
mobile BFF might combine three calls into one slim response, while the web BFF returns richer data.
The BFF is also where you keep tokens server-side (cookie ⇄ JWT exchange) instead of in the browser.

```
  Web SPA ──▶ Web BFF  ─┐
                        ├─▶ Users / Orders / … services
  Mobile  ──▶ Mobile BFF┘
```

---

## 8.6 Service Discovery & Configuration

When Orders calls `http://users-service`, how does that name resolve to an actual container? In
local/Compose setups, you don't need a discovery server — **Docker's built-in DNS** does it.

### Docker Compose service names as DNS

Every service on the same Docker network is reachable by its **service name** as a hostname.
Define `users-service` in Compose and any other container can `GET http://users-service:8080/...`.
Docker resolves it to the right container IP and load-balances across replicas. **This is your
"service discovery" for the whole Phase 8 project — no extra tooling.**

```yaml
# docker-compose.yml (sketch — full version in Phase 9)
services:
  users-service:        # ← this name IS the DNS hostname
    build: ./Users
    environment:
      - ASPNETCORE_URLS=http://+:8080

  orders-service:
    build: ./Orders
    environment:
      - ASPNETCORE_URLS=http://+:8080
      # Orders finds Users purely by the Compose service name:
      - Services__UsersBaseUrl=http://users-service:8080

  rabbitmq:
    image: rabbitmq:3-management

  gateway:
    build: ./Gateway
    ports:
      - "8080:8080"     # only the gateway is published to the host
```

> Note `users-service` and `orders-service` both listen on `:8080` internally — no clash, because
> each is its own container with its own network namespace. Only the gateway maps a host port.

### Environment-based service URLs

**Never hard-code service URLs in source.** Read them from configuration so the same image runs
locally, in Compose, and in prod with only env vars changing — exactly like `process.env` in Node.

```csharp
// Bind a config section to a typed options object
public class ServiceUrls
{
    public string UsersBaseUrl { get; set; } = "";
}

builder.Services.Configure<ServiceUrls>(builder.Configuration.GetSection("Services"));

// ASP.NET maps the env var  Services__UsersBaseUrl  →  Services:UsersBaseUrl
builder.Services.AddHttpClient<IUsersApi, UsersApi>((sp, client) =>
{
    var urls = sp.GetRequiredService<IOptions<ServiceUrls>>().Value;
    client.BaseAddress = new Uri(urls.UsersBaseUrl);
});
```

(The double underscore `__` in `Services__UsersBaseUrl` is how .NET maps a flat env var onto a
nested JSON config path — `Services:UsersBaseUrl`.)

### Consul — advanced / dynamic discovery

Compose DNS is static — fine for a fixed set of services. In a dynamic cluster where instances
come and go (Kubernetes, autoscaling VMs), you may want a discovery registry: services register
themselves on startup and clients query the registry for healthy instances. **Consul** (with
`Steeltoe` or `Consul` .NET clients) does this, plus distributed key/value config and health-based
routing. **Out of scope for the Phase 8 project** — Kubernetes' own DNS or a service mesh usually
covers this in production. Know the concept; don't build it now.

---

## 8.7 Distributed Observability

In a monolith a bug is one stack trace. Across services, a single user action becomes calls
through gateway → Orders → Users → RabbitMQ → Email. Without distributed observability you're
debugging blind. Three pillars: **tracing**, **logging**, **health**.

### Distributed tracing with OpenTelemetry

A **trace** follows one request across every service it touches; each hop is a **span**. A shared
**trace id** ties them together so you can see the whole timeline and where the time went.
**OpenTelemetry** (OTel) is the vendor-neutral standard — same project you'd use in Node
(`@opentelemetry/*`), exporting to Jaeger, Tempo, Zipkin, etc.

```
   trace id: abc123  (one request, many spans)
   ├─ span: gateway        [■■■■■■■■■■■■■■■■■■]  120ms
   │   └─ span: orders POST   [■■■■■■■■■■■■■]    95ms
   │        ├─ span: HTTP GET users  [■■■]       22ms
   │        └─ span: publish OrderPlaced [■]      4ms
   └─ (Email consumer span links back via the same trace id)
```

```csharp
// dotnet add package OpenTelemetry.Extensions.Hosting
//                    OpenTelemetry.Instrumentation.AspNetCore
//                    OpenTelemetry.Instrumentation.Http
//                    OpenTelemetry.Exporter.OpenTelemetryProtocol
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("orders-service"))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()   // auto-span every incoming request
        .AddHttpClientInstrumentation()   // auto-span outgoing HttpClient calls + propagate trace id
        .AddSource("MassTransit")         // trace message publish/consume
        .AddOtlpExporter());              // ship to a collector (Jaeger/Tempo/…)
```

The magic: `HttpClient` and MassTransit instrumentation automatically **propagate the trace
context** — the trace id rides along in the `traceparent` HTTP header (and message headers), so
the downstream service continues the *same* trace instead of starting a new one. You get the
end-to-end picture without manually threading anything.

### Correlation IDs across services

Trace ids are the modern correlation id. If you also want a human-friendly id in logs (e.g. to
hand to a customer), generate/accept an `X-Correlation-ID` header at the gateway and enrich every
log line with it (Serilog `LogContext`). The principle from Phase 7's logging applies — just make
sure it's *propagated* on every outbound call so it survives the hop.

### Centralised logging — Seq / ELK

Per-container log files are useless when you have ten containers. Ship **structured logs**
(Phase 7's Serilog) from every service to one searchable place:

- **Seq** — dead-simple, .NET-friendly log server; run it as one container, point Serilog at it,
  query/filter across all services by trace id. Best choice for this project.
- **ELK** (Elasticsearch + Logstash + Kibana) — the heavyweight, language-agnostic standard;
  more power, much more to operate.

```csharp
// Serilog → Seq, with the trace id attached so you can pivot logs ↔ traces
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "orders-service")
    .WriteTo.Console()
    .WriteTo.Seq("http://seq:5341")     // Docker service name
    .CreateLogger();
```

### Distributed health checks

Each service exposes a health endpoint (Phase 7's `AddHealthChecks`); in a distributed system the
gateway and the orchestrator poll them to route around / restart sick instances.

```csharp
builder.Services.AddHealthChecks()
    .AddNpgSql(connString, name: "db")
    .AddRabbitMQ(name: "broker");
    // optionally .AddUrlGroup(new Uri("http://users-service/health/ready"), "users")

app.MapHealthChecks("/health/live");    // liveness: is the process up? (no deps)
app.MapHealthChecks("/health/ready");   // readiness: are my deps (db, broker) reachable?
```

Split **liveness** (restart me if this fails) from **readiness** (don't send me traffic / wait for
my deps) — same distinction Kubernetes probes use.

---

## 8.8 Resilience Patterns

§8.2 introduced the Polly mechanics; here's the *why* and the patterns that matter most when the
network is unreliable and services come and go.

### Circuit breaker

If a service is down, retrying just piles on load and makes every caller slow (each request waits
for the full timeout before failing). A **circuit breaker** watches the failure rate and, once it
crosses a threshold, **trips open** — for a cooldown it fails calls *instantly* without even trying,
giving the sick service room to recover. Then it goes **half-open**, lets one trial call through,
and closes again if it succeeds.

```
   CLOSED ──(failures exceed threshold)──▶ OPEN ──(cooldown elapses)──▶ HALF-OPEN
     ▲  calls flow normally          fail fast,        try one probe call    │
     └──────────────(probe succeeds)────────────────────────────────────────┘
                     (probe fails ⇒ back to OPEN)
```

This is the analog of axios-retry plus a breaker like `opossum` in Node. Configured via Polly in
§8.2's `AddCircuitBreaker`.

### Retry with exponential backoff

Retry transient failures — but **back off exponentially** (1s, 2s, 4s…) and **add jitter** (random
offset) so a thousand clients that failed at once don't all retry in lockstep and re-DoS the
recovering service. Cap the attempts; pair retries with a circuit breaker so you stop retrying a
service that's genuinely down. **Only retry idempotent operations** (see idempotency below).

### Bulkhead isolation

Named after a ship's watertight compartments: partition resources so one flooding compartment can't
sink the ship. If calls to a slow Users service can consume *all* your threads/connections, your
whole app hangs — including endpoints that don't touch Users. A **bulkhead** caps the concurrent
calls (and a bounded queue) allowed to one dependency, so its failure is contained.

```csharp
// Polly: limit concurrent in-flight calls to a dependency
pipeline.AddConcurrencyLimiter(permitLimit: 20, queueLimit: 10);
// at most 20 simultaneous calls to Users; 10 more may wait; the rest fail fast
```

### Outbox pattern — reliable messaging

The nastiest distributed bug: you save an order to the DB **and** publish `OrderPlaced` to
RabbitMQ as two separate operations. If the process crashes *between* them, you've either got an
order with no event (Email never fires) or — worse — an event with no order. There's no shared
transaction across DB and broker.

The **outbox pattern** fixes this. Instead of publishing directly, write the message into an
`outbox` table **in the same DB transaction** as the business data. A background dispatcher then
reads the outbox and publishes to the broker, marking rows sent. The DB commit is atomic, so the
message can't be lost; the dispatcher retries until the broker confirms.

```
  ┌─ single DB transaction ─────────────────┐
  │  INSERT order                            │      background dispatcher
  │  INSERT into outbox (OrderPlaced event)  │  ──▶ poll outbox ──▶ publish ──▶ broker
  └──────────────────────────────────────────┘      mark row as sent
        atomic: both commit or neither               retries until acked
```

MassTransit has this built in — turn it on and `Publish` is captured to the outbox automatically:

```csharp
builder.Services.AddMassTransit(x =>
{
    x.AddConsumers(typeof(Program).Assembly);

    // transactional outbox backed by EF Core — saved in the same SaveChanges as your data
    x.AddEntityFrameworkOutbox<OrdersDbContext>(o =>
    {
        o.UsePostgres();
        o.UseBusOutbox();              // Publish/Send go to the outbox, dispatched after commit
    });

    x.UsingRabbitMq((ctx, cfg) => { cfg.Host("rabbitmq"); cfg.ConfigureEndpoints(ctx); });
});
```

(There's a matching **inbox** for consumers — dedupe incoming messages by id so re-delivery is
safe, which is exactly idempotency.)

### Idempotency

Brokers guarantee **at-least-once** delivery — a message *can* arrive twice (e.g. the consumer
processed it but crashed before acking, so it's redelivered). And HTTP retries can re-send a POST.
So consumers and write endpoints must be **idempotent**: processing the same message/request twice
has the same effect as once.

Common techniques:
- **Dedupe by id:** record each processed message/request id; skip if already seen (the inbox).
- **Idempotency keys:** client sends an `Idempotency-Key` header on POST; the server returns the
  cached result for a repeat key instead of creating a duplicate.
- **Natural idempotency:** design operations as upserts / set-state ("set status = paid") rather
  than deltas ("add to balance"), so repetition is harmless.

> Idempotency is what makes retries (§8.2) and at-least-once messaging (§8.4) *safe*. Without it,
> resilience patterns create duplicates. Treat it as a requirement, not an afterthought.

---

## Gotchas for JS/TS Developers

| Gotcha | What bites you | Do this instead |
|---|---|---|
| `new HttpClient()` per call | Socket exhaustion under load (TIME_WAIT) | `IHttpClientFactory` — named/typed clients |
| `using var client = new HttpClient()` | The "correct" `IDisposable` instinct is the bug here | Don't dispose; let the factory pool handlers |
| One `static HttpClient` forever | Fixes sockets but caches DNS — stale IPs | Factory rotates handlers, keeps DNS fresh |
| Retrying every request | Retrying a POST duplicates writes | Retry only idempotent ops; add idempotency keys |
| Treating network calls like local | They're slow and *fail* — no exceptions | Timeouts + retry + circuit breaker on every hop |
| Sharing one DB between services | Hidden coupling, blocks independent deploy | DB per service; talk via HTTP/gRPC/events |
| `.proto` field renumbering | Changing a field tag breaks the wire format | Tags are forever; only add new ones |
| Publish then save (or save then publish) | Crash between the two = lost/orphan event | Outbox pattern — one atomic transaction |
| Expecting exactly-once delivery | Brokers are at-least-once; dups happen | Make consumers idempotent (inbox/dedupe) |
| Hard-coding `http://localhost:5001` | Breaks in Docker/prod | Config + env vars; Docker service-name DNS |
| Choreography for a complex flow | Business logic smeared across services, untraceable | Orchestration saga (state machine) for 3+ steps |
| No distributed tracing | A cross-service bug is undebuggable | OpenTelemetry; trace id auto-propagates over HTTP |

---

## Phase 8 Project — Users + Orders microservices

**Goal:** two services that talk **both** synchronously (Orders → Users over HTTP) and
asynchronously (Orders → RabbitMQ → a consumer), fronted by a YARP gateway. This is the spine of
the Phase 9 Docker work.

### Target shape

```
                         ┌───────────── Gateway (YARP) ─────────────┐
   client ─────────────▶ │  /api/users/*  →  Users    :8080         │
                         │  /api/orders/* →  Orders   :8080          │
                         └───────┬────────────────────┬─────────────┘
                                 ▼                     ▼
                          Users service          Orders service ──HTTP──▶ Users
                          (users_db)             (orders_db)
                                                       │  publish OrderPlaced
                                                       ▼
                                                   RabbitMQ ──▶ OrderPlacedConsumer
                                                                 (logs / "sends email")
```

### Steps

1. **Solution scaffold.** Create a solution with three projects under `examples/phase8-microservices/`:
   ```bash
   dotnet new sln -n Phase8
   dotnet new webapi -n Users
   dotnet new webapi -n Orders
   dotnet new web    -n Gateway
   dotnet sln add Users Orders Gateway
   ```
   *Hint:* add a tiny `Contracts` class library for the shared `OrderPlaced` message record so both
   Orders and the consumer reference the *same* type.

2. **Users service.** A normal Phase 2/3 API: `GET /api/users/{id}`, `GET /api/users`. Back it with
   Postgres + EF Core (`users_db`). Seed a couple of users.

3. **Orders service — sync call to Users.** Add a **typed client** `IUsersApi` (§8.2) with a Polly
   resilience handler (timeout + retry + circuit breaker). On `POST /api/orders`, call
   `users.GetUserAsync(userId)`; reject with `400` if the user doesn't exist; otherwise persist the
   order to `orders_db`.

4. **Orders service — async publish.** Add MassTransit + RabbitMQ (§8.4). After saving the order,
   `Publish(new OrderPlaced(...))`. *Hint (stretch):* wire up `AddEntityFrameworkOutbox` (§8.8) so
   the publish is transactional with the save — then deliberately throw right after `SaveChanges`
   and confirm no orphan event is sent.

5. **Consumer.** In a small worker (or the Email service), implement
   `IConsumer<OrderPlaced>` that logs `"Order {id} placed for user {userId}"`. Stop Orders,
   queue a few via the broker UI, restart, watch them drain — that's the resilience payoff.

6. **Gateway (YARP).** Route `/api/users/**` → Users and `/api/orders/**` → Orders via config
   (§8.5). Verify `GET http://gateway/api/users/1` reaches Users.

7. **Discovery & config.** Replace all hard-coded URLs with config bound to env vars (§8.6); use
   Docker service names (`users-service`, `rabbitmq`). (Compose itself lands in Phase 9 — for now
   you can run services on different localhost ports and point config at them.)

8. **Observability.** Add OpenTelemetry tracing to all three services and Serilog → Seq (§8.7).
   Make one `POST /api/orders` and find the **single trace** spanning gateway → Orders → Users →
   publish in Jaeger/Seq. That end-to-end view is the whole point of the phase.

9. **Resilience demo.** Kill the Users service and hit `POST /api/orders` repeatedly. Watch Polly
   retry, then the circuit breaker trip open and start failing fast. Bring Users back; watch it
   half-open and recover.

### Stretch goals

- Swap the Orders → Users sync call from HTTP to **gRPC** (§8.3) and compare.
- Add a **saga** (orchestration) for an Order → Payment → Shipping flow with a compensating
  "cancel/refund" path (§8.4).
- Add an **idempotency key** to `POST /api/orders` so a client retry never double-books (§8.8).
- Add distributed **health checks** and have the gateway route around an unhealthy instance (§8.7).

---

## Summary

| Concept | .NET tool | Node.js equivalent |
|---|---|---|
| Sync HTTP client (pooled) | `IHttpClientFactory` + typed clients | `axios`/`got` (shared instance) |
| HTTP resilience | Polly / `Http.Resilience` | `axios-retry` + `opossum` |
| Binary RPC + streaming | `Grpc.AspNetCore` + `.proto` | `@grpc/grpc-js` (same `.proto`) |
| Message broker | RabbitMQ | RabbitMQ |
| Bus framework | MassTransit | `amqplib` / `BullMQ` / Nest transport |
| Saga / distributed txn | `MassTransitStateMachine` | hand-rolled or `node-saga` |
| API gateway | YARP (or Ocelot) | `http-proxy` / NestJS gateway |
| Service discovery (local) | Docker Compose DNS | Docker Compose DNS |
| Service discovery (dynamic) | Consul / k8s DNS | Consul / k8s DNS |
| Distributed tracing | OpenTelemetry | OpenTelemetry (`@opentelemetry/*`) |
| Centralised logs | Serilog → Seq / ELK | Pino/Winston → Seq / ELK |
| Health checks | `AddHealthChecks` (live/ready) | `terminus` / custom |
| Reliable publish | Outbox (MassTransit EF outbox) | transactional outbox (manual) |

**Mental model to keep:** every arrow between services is a network call that is *slow* and *can
fail*. Sync (HTTP/gRPC) couples services in time; async (messaging) decouples them but trades away
strong consistency. Microservices don't remove complexity — they move it from your code into the
network and the operations layer, which is why you only pay that price when independent
deploys/scaling/teams make it worth it. Default to a modular monolith; split with intent.

---

**Next:** Phase 9 — Docker & Deployment (`notes/09-docker-deployment.md`) — containerise these
services, write the Compose file that wires up Postgres + RabbitMQ + Seq, and deploy.
