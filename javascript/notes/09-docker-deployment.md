# Phase 9 — Docker & Deployment

> **Scope note.** There is a dedicated, comprehensive Docker module at `docker/` (10 phases). This phase is the **Node.js/NestJS-specific slice** — how to Dockerize a Node app correctly, drain a NestJS process on `SIGTERM`, wire a Compose stack of NestJS services + Postgres + Redis + RabbitMQ, ship it with GitHub Actions, and run it in production. Generic Docker theory (layers, caching, the PID 1 problem, Nginx, OOM semantics, blue/green) is **not** re-taught here — it's cross-referenced. Read these alongside:
> - `docker/notes/02-dockerfiles.md` — layer caching, multi-stage, `.dockerignore`, `CMD` vs `ENTRYPOINT`, base images, BuildKit cache/secret mounts.
> - `docker/notes/05-compose.md` — Compose fundamentals, networks, volumes, `depends_on`, profiles.
> - `docker/notes/08-cicd.md` — GitHub Actions + Docker, buildx cache backends, registry auth.
> - `docker/notes/09-production.md` — health checks (liveness vs readiness), the PID 1 / `tini` problem, resource limits, logging, Nginx reverse proxy, rolling/blue-green deploys, the migration trap.
>
> .NET comparisons are kept where they sharpen the mental model — the same patterns appear in the `.net/` track.

---

## 9.1 Dockerizing Node.js Apps

The mechanics of multi-stage builds, layer-cache ordering, and base-image choice live in `docker/notes/02-dockerfiles.md`. Here we focus on what's *specific* to a Node/NestJS app: the `npm ci` vs `npm install` decision, the `node` user that ships in the official images, `COPY --chown`, the `.dockerignore` entries that actually matter for Node, and the signal-handling intro that 9.2 builds on.

### The Node-specific multi-stage pattern

A NestJS app has the same shape as any TypeScript build: `devDependencies` (incl. `typescript`, `@nestjs/cli`) are needed to **build** but must not ship to **runtime**. The trick is three stages — build, prune, runtime — so the final image carries only `dist/` + production `node_modules`.

```dockerfile
# syntax=docker/dockerfile:1
# (the syntax directive unlocks --mount=type=cache/secret — see docker/notes/02 §2.7)

# ---------- Stage 1: build ----------
FROM node:20.11.0-alpine AS builder
WORKDIR /app

# Copy ONLY the manifests first so the npm-ci layer is cached until deps change.
# (Layer-cache ordering theory: docker/notes/02 §2.2 — least-changing first.)
COPY package*.json ./
# Prisma's generate step needs the schema present at install time if you have a
# postinstall hook, so copy it before npm ci. (Skip if you generate explicitly.)
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci                          # ALL deps incl. devDeps — we need tsc, @nestjs/cli

COPY . .
RUN npm run build                   # nest build -> /app/dist
# If using Prisma, the client is generated here (or via a build script):
# RUN npx prisma generate

# ---------- Stage 2: production dependencies only ----------
FROM node:20.11.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev               # prod deps ONLY -> smaller image, fewer CVEs
# Prisma note: `npm ci --omit=dev` skips the generate postinstall in some setups.
# Copy the already-generated client from the builder instead (see runtime stage).

# ---------- Stage 3: runtime ----------
FROM node:20.11.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cap V8's heap below the container memory limit (see 9.7). 384MB heap for a 512MB
# container leaves headroom for buffers, native memory, the Prisma engine, etc.
ENV NODE_OPTIONS=--max-old-space-size=384

# Copy artifacts with the right ownership in ONE step — no extra `RUN chown` layer.
# `node` is a built-in non-root user (uid 1000) in the official node images.
COPY --chown=node:node --from=deps    /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist         ./dist
# Prisma ships a query-engine binary + generated client; copy them explicitly so a
# prod-only install doesn't miss the generated client:
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/prisma ./prisma

USER node                           # drop root BEFORE CMD (security: docker/notes/07)
EXPOSE 3000

# HEALTHCHECK theory + the distroless/no-curl gotcha: docker/notes/09 §9.1.
# alpine has no curl; use Node's own http so we don't install anything extra.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form => node is PID 1 => it receives SIGTERM directly => graceful shutdown
# works (9.2). Shell form would make /bin/sh PID 1 and eat the signal.
CMD ["node", "dist/main.js"]
```

### `npm ci` vs `npm install` — always `npm ci` in Docker

| | `npm install` | `npm ci` |
|---|---|---|
| Reads | `package.json`, may update lockfile | `package-lock.json` **only** — fails if it's missing or out of sync |
| Lockfile | can mutate it | never touches it |
| `node_modules` | reconciles in place | **deletes** it first, clean install |
| Reproducible | no — resolves ranges fresh | **yes** — installs exactly what's locked |
| Speed in CI/Docker | slower | faster (skips resolution) |

`npm ci` is the Docker/CI install. It's deterministic — the same lockfile produces the same tree every build, which is the whole point of a reproducible image. (.NET analogy: `npm ci` ≈ `dotnet restore --locked-mode` against `packages.lock.json`. `npm install` is the dev-time `dotnet add package` that can move versions.) `pnpm i --frozen-lockfile` / `yarn install --immutable` are the equivalents if you use those.

### The Node `.dockerignore` that matters

`.dockerignore` semantics are in `docker/notes/02 §2.5`. The Node-specific must-haves:

```gitignore
# .dockerignore
node_modules        # NEVER ship the host's — it has OS-specific native binaries
                    # (bcrypt, sharp, the Prisma engine) built for your Mac, not Linux.
                    # npm ci rebuilds them inside the image for the right platform.
.env                # SECRETS — must not enter the build context or any layer
.env.*
dist                # build artifacts — produced INSIDE the image by `nest build`
coverage            # jest output
.git
*.log
npm-debug.log*
Dockerfile
docker-compose*.yml
.github
test                # don't ship e2e/unit tests to the runtime image
**/*.spec.ts
```

The `node_modules` line is the load-bearing one for Node: copying the host's `node_modules` is both a correctness bug (native modules compiled for the wrong libc/arch — alpine's musl vs glibc, see `docker/notes/02 §2.4`) and a bloat/secret-leak risk.

### Signal handling — the intro (full treatment in 9.2)

Because the exec-form `CMD` makes `node` PID 1, the OS delivers `SIGTERM` straight to your process when Docker stops the container. PID 1 has **no default signal handlers** — if you don't register one, `SIGTERM` is silently ignored and Docker `SIGKILL`s you after the grace period (10s default). The PID 1 mechanics, why shell-form `CMD` breaks this, and when you need `tini` are all in `docker/notes/09 §9.2`. The Node/NestJS-specific draining logic is next.

---

## 9.2 Graceful Shutdown

This is the subsection that, done wrong, drops user requests on **every deploy**. The generic signal sequence (SIGTERM → grace period → SIGKILL), the PID 1 problem, and `tini` are in `docker/notes/09 §9.2`. Here: how to drain a **Node** server and, specifically, how NestJS automates most of it for you.

### The drain order (Node, framework-agnostic)

```
SIGTERM received
   │
   ├─► flip readiness to 503   ──► load balancer / Nginx stops routing NEW requests here
   ├─► server.close()          ──► stop accepting new connections; keep in-flight ones
   ├─► drain in-flight requests (with a hard cap below Docker's stop-timeout)
   ├─► close DB pool / Prisma, Redis, BullMQ workers, AMQP channels
   └─► process.exit(0)         ──► clean exit BEFORE the SIGKILL deadline
```

Plain Node/Express handler (the reference shape — `docker/notes/09 §9.2` has the annotated keep-alive caveat):

```js
const server = app.listen(3000);
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;                 // ignore a second SIGTERM
  shuttingDown = true;                      // readiness endpoint reads this -> 503

  server.close(async () => {                // fires once all in-flight reqs finish
    try {
      await prisma.$disconnect();
      await redis.quit();
    } finally {
      process.exit(0);
    }
  });
  server.closeIdleConnections?.();          // Node 18.2+: release idle keep-alive sockets
                                            // so server.close() can actually complete

  setTimeout(() => {                        // safety net: force-exit BELOW Docker's
    console.error('drain timed out');       // --stop-timeout (e.g. 8s when timeout is 10s)
    process.exit(1);
  }, 8000).unref();                         // unref so the timer never keeps us alive
}

process.on('SIGTERM', () => shutdown('SIGTERM'));  // docker stop / orchestrators
process.on('SIGINT', () => shutdown('SIGINT'));    // Ctrl-C in local dev
```

### NestJS does most of this for you — `enableShutdownHooks()`

NestJS has a lifecycle system. Calling `app.enableShutdownHooks()` registers process-signal listeners (`SIGTERM`, `SIGINT`, …) **once**, and on signal it runs every provider's lifecycle hooks in reverse dependency order, then closes the HTTP server. You implement the hooks; Nest sequences them.

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Registers listeners for SIGTERM/SIGINT and calls onModuleDestroy /
  // beforeApplicationShutdown / onApplicationShutdown across all providers,
  // then closes the underlying HTTP server. WITHOUT this, signals are ignored
  // and the container is SIGKILLed (no draining, dropped requests).
  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
```

> **Cost note:** `enableShutdownHooks()` attaches process-level signal listeners. Each Nest app instance adds listeners — in tests that spin up many apps you can hit Node's `MaxListenersExceededWarning`. Enable it in real entrypoints, not in every test module.

### The lifecycle hooks — where you close connections

Nest calls these in this order on shutdown (reverse of init):

| Hook | When | Use for |
|---|---|---|
| `onModuleDestroy()` | each module is being destroyed | close that module's resources |
| `beforeApplicationShutdown(signal)` | after all `onModuleDestroy`, before close | flush, await in-flight work |
| `onApplicationShutdown(signal)` | last, after the server is closed | final cleanup |

```ts
// prisma.service.ts — close the Prisma connection pool cleanly on shutdown.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    // Called by Nest on SIGTERM (because enableShutdownHooks ran). Drains the
    // PG connection pool so we don't leave half-open connections on the server.
    await this.$disconnect();
  }
}
```

```ts
// redis / BullMQ — close the queue + its workers so jobs aren't abandoned mid-flight.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';

@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly queue = new Queue('email', { connection: { host: 'redis', port: 6379 } });
  private readonly worker: Worker;

  async onModuleDestroy() {
    // Order matters: stop the worker FIRST (finishes the active job, stops
    // pulling new ones), THEN close the queue's connection.
    await this.worker.close();   // waits for the in-flight job to complete
    await this.queue.close();    // closes the underlying ioredis connection
  }
}
```

```ts
// RabbitMQ via @nestjs/microservices — a hybrid app (HTTP + microservice transport).
// app.close() (triggered by the shutdown hooks) closes the microservice transport,
// which acks/cancels consumers and closes the AMQP channel + connection.
const app = await NestFactory.create(AppModule);
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: { urls: ['amqp://rabbitmq:5672'], queue: 'orders', queueOptions: { durable: true } },
});
app.enableShutdownHooks();      // also drains the RMQ consumer on SIGTERM
await app.startAllMicroservices();
await app.listen(3000);
```

### Readiness must reflect "shutting down"

The drain only prevents dropped requests if the load balancer **stops sending new ones**. That means your readiness probe (9.7) must return 503 the moment shutdown starts. With `@nestjs/terminus` you do this by flipping a flag that the readiness indicator reads, or by registering a `beforeApplicationShutdown` hook that sets it. The sequencing — flip readiness → LB drains → close server — is the same picture as `docker/notes/09 §9.2`.

### Kubernetes: `preStop` + `terminationGracePeriodSeconds`

In K8s (intro in `docker/notes/10`) there's a subtlety: when a Pod is deleted, the kubelet sends `SIGTERM` **and** removes the Pod from Service endpoints *concurrently* — but endpoint removal is eventually-consistent across kube-proxy/ingress, so for a brief moment traffic can still arrive after `SIGTERM`. The standard fix is a `preStop` sleep that delays the SIGTERM long enough for endpoint propagation:

```yaml
spec:
  terminationGracePeriodSeconds: 30   # total budget: preStop + SIGTERM drain before SIGKILL
  containers:
    - name: api
      lifecycle:
        preStop:
          exec:
            # Sleep so kube-proxy/ingress finish removing this Pod from rotation
            # BEFORE the app starts draining. Node's image has no `sleep`? use:
            command: ["/bin/sh", "-c", "sleep 5"]
      # Your app's internal drain-timeout MUST be < (grace period - preStop sleep),
      # e.g. drain in <=20s when grace=30s and preStop=5s, so SIGKILL never fires.
```

Match the budgets: `app drain timeout  <  terminationGracePeriodSeconds − preStop sleep`. In plain Docker/Compose the equivalent knob is `stop_grace_period` (Compose) / `--stop-timeout` (run), and your app's safety-net timer stays just under it.

---

## 9.3 Compose for Local Dev

Compose fundamentals — services, networks, named volumes, `depends_on` conditions, `profiles`, env files — are in `docker/notes/05-compose.md`. Here's a **Node microservices dev stack**: the NestJS app plus the three backing services it talks to (Postgres, Redis, RabbitMQ), with health-gated startup so the app never boots before its dependencies are actually accepting connections.

```yaml
# docker-compose.yml — local dev stack for a NestJS app
services:
  api:
    build:
      context: .
      target: builder            # build the dev/build stage, not the slim runtime,
                                  # so we have nest-cli + ts-node for watch mode
    command: npm run start:dev   # nest start --watch (HMR). Overrides the image CMD.
    environment:
      DATABASE_URL: postgres://app:secret@postgres:5432/app   # `postgres` = service DNS
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://rabbitmq:5672
    ports:
      - "3000:3000"
      - "9229:9229"              # node --inspect debug port for VS Code attach
    volumes:
      - .:/app                   # bind-mount source for live reload...
      - /app/node_modules        # ...but mask node_modules so the container's
                                 # (Linux-built) modules aren't clobbered by the host's
    depends_on:
      postgres: { condition: service_healthy }   # wait for ACTUAL readiness, not just
      redis:    { condition: service_healthy }    # "container started" — see note below
      rabbitmq: { condition: service_healthy }

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume => DB survives `compose down`
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]   # exits 0 only when PG accepts conns
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]   # expects "PONG"
      interval: 5s
      timeout: 3s
      retries: 10

  rabbitmq:
    image: rabbitmq:3.13-management        # -management adds the UI on :15672
    ports:
      - "15672:15672"                       # management UI (dev convenience)
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  # --- optional monitoring stack, only started when explicitly requested ---
  prometheus:
    image: prom/prometheus
    profiles: ["monitoring"]               # `docker compose --profile monitoring up`
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
  grafana:
    image: grafana/grafana
    profiles: ["monitoring"]               # not started by a plain `docker compose up`

volumes:
  pgdata:                                  # declared named volume
```

### Why `condition: service_healthy`, not just `depends_on`

A bare `depends_on: [postgres]` only waits for the container to **start** — not for Postgres to finish its internal init and start accepting connections. Your NestJS app would race ahead, fail its first `prisma.$connect()`, and crash-loop. `condition: service_healthy` gates startup on the dependency's `healthcheck` passing. This is the single most useful Compose feature for a Node app with a DB. (Full `depends_on` condition matrix: `docker/notes/05 §5.x`.)

> Belt-and-braces: even with health gating, keep a retry on your DB connect at boot (Prisma/TypeORM both support it) — health checks reduce races but a DB can still blip during a restart.

### Dev-mode specifics for Node

- **`target: builder`** — build the stage that still has `@nestjs/cli`/`ts-node`, run `start:dev` for watch-mode HMR. The slim runtime stage has no compiler.
- **The `node_modules` volume trick** — bind-mounting `.:/app` is what gives live reload, but it would also overlay the host's `node_modules` (wrong platform) on top of the container's. The anonymous volume `/app/node_modules` masks that path so the container keeps its own Linux-built modules.
- **`9229` inspect port** — exposes the V8 inspector so you can attach a debugger (Phase 1 `--inspect`).
- **`profiles`** — keep Prometheus/Grafana/Bull-Board out of the default `up`; start them only with `--profile monitoring`.

---

## 9.4 Compose for Microservices

Building on 9.3, a microservices stack (the Phase 8 Users + Orders services) is just *more app services on shared networks*, talking to each other by **service DNS name**. Compose creates a default network where every service is resolvable by its name — `http://users:3000` reaches the `users` service from `orders`, no service-discovery infra needed (the Docker-DNS mechanics are in `docker/notes/03-networking.md` and `docker/notes/05-compose.md`).

```yaml
# docker-compose.yml — two NestJS services + shared infra
services:
  gateway:
    build: ./apps/gateway
    ports: ["8080:3000"]              # ONLY the gateway is published
    environment:
      USERS_URL: http://users:3000    # resolve peers by service name (Docker DNS)
      ORDERS_URL: http://orders:3000
    depends_on:
      users:  { condition: service_healthy }
      orders: { condition: service_healthy }
    networks: [frontend, backend]

  users:
    build: ./apps/users
    environment:
      DATABASE_URL: postgres://app:secret@users-db:5432/users
      RABBITMQ_URL: amqp://rabbitmq:5672
    depends_on:
      users-db: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    networks: [backend]               # no `ports:` — reachable only inside the network

  orders:
    build: ./apps/orders
    environment:
      DATABASE_URL: postgres://app:secret@orders-db:5432/orders
      USERS_URL: http://users:3000    # synchronous HTTP call to a sibling service
      RABBITMQ_URL: amqp://rabbitmq:5672
    depends_on:
      orders-db: { condition: service_healthy }
      rabbitmq:  { condition: service_healthy }
    networks: [backend]

  # database-per-service (Phase 8 rule: no shared DB across services)
  users-db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: secret, POSTGRES_DB: users }
    volumes: [usersdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }
    networks: [backend]
  orders-db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: secret, POSTGRES_DB: orders }
    volumes: [ordersdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }
    networks: [backend]

  rabbitmq:
    image: rabbitmq:3.13-management
    healthcheck: { test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"], interval: 10s, retries: 10 }
    networks: [backend]

networks:
  frontend:        # public-facing edge (only the gateway lives here)
  backend:         # internal mesh — services + DBs + broker, not published
volumes:
  usersdata:
  ordersdata:
```

Key microservices points (Node specifics — patterns themselves are Phase 8):

- **Database per service.** `users-db` and `orders-db` are separate containers with separate volumes. No shared schema — that's the Phase 8 bounded-context rule, expressed in Compose.
- **Network segmentation.** Only the `gateway` is on `frontend` and publishes a port. Everything else lives on `backend` with no `ports:` — unreachable from the host, only from peers. (Security: `docker/notes/07`.)
- **Sync vs async.** `orders` calls `users` over HTTP (`USERS_URL`) for queries and publishes domain events to `rabbitmq` for async work — exactly the Phase 8 split.

### `docker-compose.override.yml` — dev tweaks without forking the base file

`docker compose` automatically merges `docker-compose.yml` (base, committed, prod-shaped) with `docker-compose.override.yml` (local, dev-only) when both exist. Keep the base file deployment-ready and put dev conveniences in the override:

```yaml
# docker-compose.override.yml — auto-merged on `docker compose up` (don't commit secrets)
services:
  users:
    build:
      target: builder            # dev build stage instead of the slim runtime
    command: npm run start:dev   # watch mode locally
    volumes:
      - ./apps/users:/app        # live reload
      - /app/node_modules
    ports:
      - "9229:9229"              # debug port, dev only
  orders:
    build: { target: builder }
    command: npm run start:dev
    ports: ["9230:9229"]
```

```bash
docker compose up                          # base + override (dev: watch mode, debug ports)
docker compose -f docker-compose.yml up     # base ONLY (prod-shaped, no override)
```

This is the idiomatic way to have one Compose definition that's prod-realistic by default but dev-friendly on your machine. (Merge precedence rules: `docker/notes/05`.)

---

## 9.5 CI/CD

The GitHub Actions ↔ Docker mechanics — `docker/build-push-action`, buildx cache backends, registry login, multi-arch — are in `docker/notes/08-cicd.md`. This is the **Node-shaped pipeline**: `npm ci` → lint → test (with Testcontainers) → `nest build` → Docker build → push, plus the Node-specific caching and secrets bits.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm                 # caches ~/.npm keyed on package-lock.json hash

      - run: npm ci                  # deterministic install (see 9.1)
      - run: npm run lint            # eslint
      - run: npm run build           # nest build — fail fast on type errors

      # Testcontainers: the test suite (Phase 7) spins up a real Postgres container.
      # GitHub's ubuntu runners ALREADY have a Docker daemon, so Testcontainers works
      # out of the box — no docker-in-docker setup needed. It talks to the host socket.
      - run: npm run test:e2e
        env:
          # Testcontainers reads these; defaults are fine on GitHub runners.
          TESTCONTAINERS_RYUK_DISABLED: "false"   # ryuk cleans up leftover containers

  build-and-push:
    needs: test                      # only build the image if tests passed
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write                # to push to GitHub Container Registry (ghcr.io)
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3   # enables buildx + cache backends

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # auto-provided; no PAT needed for ghcr

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha       # pull layer cache from GitHub Actions cache
          cache-to: type=gha,mode=max # push ALL layers (incl. intermediate) to the cache
          # Inject a private-registry token WITHOUT baking it into a layer:
          secrets: |
            npmrc=${{ secrets.NPM_RC }}     # consumed via --mount=type=secret in Dockerfile
```

Node/NestJS-specific notes:

- **Two caches, two purposes.** `actions/setup-node` with `cache: npm` speeds up the `npm ci` that runs *on the runner* (lint/test). `cache-from/to: type=gha` caches the *Docker layers* of the image build. They're independent — you usually want both. (Buildx cache backend details: `docker/notes/08`.)
- **`npm ci`, not `npm install`** — same determinism argument as 9.1; a non-reproducible install in CI defeats the point.
- **Testcontainers in CI** — works on GitHub's hosted runners with zero extra config because a Docker daemon is present and Testcontainers talks to the host socket. Self-hosted runners need Docker installed + the runner user in the `docker` group. (`docker/notes/08` covers the docker-in-docker vs host-socket tradeoff.)
- **Secrets** — repo/org secrets are injected as env (`${{ secrets.X }}`) for runner steps, and as BuildKit secret mounts (`secrets:` on build-push-action) for the image build. **Never** pass a token via `--build-arg` — it's recoverable from `docker history` (the why is in `docker/notes/02 §2.6`).
- **`@nestjs/cli` is a devDependency** — `npm ci` (not `--omit=dev`) on the runner so `nest build` is available; the *image*'s runtime stage still prunes dev deps (9.1).

---

## 9.6 Deployment Options

Where to actually run the container. The generic deployment-rung ladder (single host Compose → Swarm → K8s), the Nginx reverse-proxy config, TLS, and blue/green are all in `docker/notes/09 §9.5–9.7`. Here's the Node-flavored decision guide.

### The honest ladder for a Node app

| Option | What you do | Good when | Node gotchas |
|---|---|---|---|
| **VPS + Docker + Nginx** | `git pull` + `docker compose up -d` on a Hetzner/DO box; Nginx terminates TLS, proxies to the app | Full control, cheap, most apps | You own the OS, backups, rotation. Set `trust proxy` (below). |
| **Railway / Render** | Connect repo; it builds (Nixpacks or your Dockerfile) and runs it | Fastest to ship; managed Postgres/Redis add-ons | They inject `PORT` — your app **must** `listen(process.env.PORT)`. |
| **Fly.io** | `fly launch` → `fly deploy`; runs your container on edge regions | Want multi-region / runs your Dockerfile as-is | `fly.toml` sets internal port + health checks; Postgres is a separate app. |

### VPS + Nginx — the Node-relevant bits

The full annotated Nginx config (the four `X-Forwarded-*` headers, WebSocket upgrade, TLS, load-balancing across replicas) is in `docker/notes/09 §9.6`. What your **Node app** must do to live behind it:

```ts
// Express: trust the proxy so req.ip / req.protocol read X-Forwarded-* (set by Nginx)
app.set('trust proxy', 1);

// NestJS (Express adapter): same, on the underlying instance
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);

// NestJS (Fastify adapter): set it in the adapter options instead
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ trustProxy: true }),
);
```

Without this, `@nestjs/throttler` rate-limits everyone as Nginx's single IP, your logs show Nginx's IP for every request, and `secure` cookies / HTTPS redirects break because the app thinks it's on plain HTTP. (Why, in detail: `docker/notes/09 §9.6`.)

### Platforms inject `PORT` — bind to it

Railway, Render, Fly, Heroku-likes all set a `PORT` env var and route to it. A hardcoded `listen(3000)` silently never receives traffic:

```ts
await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000, '0.0.0.0');
//                                                                  ^^^^^^^^^
// Bind 0.0.0.0, NOT localhost — inside a container, localhost is only the
// container's loopback, so the platform's proxy can't reach you on 127.0.0.1.
```

### TLS: Let's Encrypt vs Caddy

- **Caddy** as the reverse proxy gets you **automatic HTTPS** with zero config — it provisions and renews Let's Encrypt certs itself. For a Node app this is the lowest-effort path: `reverse_proxy api:3000` and you're done with TLS.
- **Nginx + Certbot** is the manual route — Certbot obtains/renews the cert, Nginx serves it. More moving parts; use it when you already run Nginx.
- Managed platforms (Railway/Render/Fly) terminate TLS for you — nothing to configure.

### Zero-downtime

Combine the graceful shutdown from 9.2 with the deployment strategy from `docker/notes/09 §9.7`. The one Node-specific reminder: a `docker compose up -d` recreate has a real gap (it stops then starts the single container). To get *true* zero-downtime you need blue/green or an orchestrator's rolling update — and your SIGTERM drain (9.2) is what makes those gap-free instead of just fast. **And** heed the migration trap (`docker/notes/09 §9.7`): a Prisma migration that drops/renames a column will break the still-running old version mid-rollout — use expand/contract.

---

## 9.7 Production Considerations

The generic versions of these — resource-limit semantics, OOM exit code 137, the heap-vs-cgroup trap, logging to stdout — are in `docker/notes/09 §9.3–9.4`. Here's the Node/NestJS-specific configuration.

### Config: env only, validated, no secrets in the image

12-factor config (Phase 3) means **everything environment-specific comes from env vars at runtime**, never baked into the image. Validate it at boot and crash immediately if something's missing — fail fast beats a 3am `undefined is not a function`:

```ts
// config validation with zod (Phase 2/3) — crash on bad/missing env at startup
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
});

export const env = Env.parse(process.env);   // throws (process exits non-zero) if invalid
```

Secrets (`DATABASE_URL` password, JWT secret, API keys) are injected at runtime — `docker run -e`, Compose `environment:`/`env_file:`, or the platform's secret store — **never** via `ENV`/`ARG` in the Dockerfile (recoverable from `docker history`, see `docker/notes/02 §2.6`).

### Health endpoints with `@nestjs/terminus`

The liveness-vs-readiness distinction is the most important production idea here, and it's covered conceptually in `docker/notes/09 §9.1`. The NestJS-native way to expose them is `@nestjs/terminus`:

```ts
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService,
  PrismaHealthIndicator, MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  // LIVENESS: "is my process wedged?" — must NOT touch the DB. A DB blip should
  // never restart the container. Just confirms the event loop reaches the handler.
  @Get('live')
  @HealthCheck()
  liveness() {
    // memory heap check is fine (it's about THIS process), DB check is NOT.
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),  // 300MB
    ]);
  }

  // READINESS: "can I serve traffic right now?" — DOES check dependencies. If the
  // DB is down, return 503 so the load balancer pulls this instance from rotation
  // (it does NOT restart — that's the liveness job).
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),   // SELECT 1 under the hood
      // add redis/rabbitmq indicators here as your deps grow
    ]);
  }
}
```

```dockerfile
# point the Dockerfile HEALTHCHECK at readiness (see the 9.1 Dockerfile):
HEALTHCHECK CMD node -e "fetch('http://localhost:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

The classic mistake (from `docker/notes/09 §9.1`): putting the DB check in `/health/live`. A 5-second DB hiccup then fails liveness on *every* replica at once, the orchestrator restarts them all simultaneously, and you get a cold-start thundering herd on top of a flaky DB. Dependency checks belong in **readiness** only.

### Node memory in containers — `--max-old-space-size`

This is the Node-specific production footgun (full cgroup theory: `docker/notes/09 §9.3`). V8's default old-space heap (~2GB on 64-bit) is set from a built-in default — it does **not** read the container's cgroup memory limit. So a 512MB container running Node with the default heap will let V8 grow toward 2GB, blow past the 512MB cgroup limit, and the kernel **OOM-kills** it (exit code **137**), looking like a random crash.

```dockerfile
# Cap the heap BELOW the container limit, leaving headroom for buffers, native
# memory (Prisma's query engine, sharp), and the C++ side of Node.
ENV NODE_OPTIONS=--max-old-space-size=384   # for a ~512MB container limit
```

```yaml
# and set the actual container limit (Compose single-host):
services:
  api:
    mem_limit: 512m            # hard ceiling; over this => OOM kill (137)
    environment:
      NODE_OPTIONS: --max-old-space-size=384   # heap stays under the ceiling
```

Rule of thumb: `--max-old-space-size ≈ container_limit − 128MB` (the gap covers non-heap memory). If you see exit code 137 with no obvious leak, this misconfiguration is the usual culprit. (.NET contrast: modern .NET is cgroup-aware and sizes its heap from the limit automatically — Node is not, so you must set it yourself.)

### Postgres connection pool sizing for Node

Each Node process opens its **own** pool to Postgres. Postgres has a hard `max_connections` (default ~100). The trap: with horizontal scaling, total connections = `pool_size × number_of_app_instances`, and it's easy to exceed `max_connections` and start getting `too many clients` errors.

```
total_connections = pool_size_per_instance × app_instances   (+ other clients)
                    must stay comfortably under Postgres max_connections
```

```ts
// Prisma: pool size is set via the connection string's connection_limit.
// Default = num_cpus * 2 + 1, which is often too high once you run several replicas.
// DATABASE_URL=postgres://app:secret@db:5432/app?connection_limit=10
```

Guidance for Node specifically:

- **Size per-instance pool small**, then multiply by replica count and stay under `max_connections`. E.g. 4 replicas × `connection_limit=10` = 40 connections — fine under 100.
- **A bigger pool is not faster** — Postgres can only do so much work in parallel; an oversized pool just queues at the DB and wastes connections. Pool size should track concurrency you can actually service.
- **PgBouncer / Prisma Accelerate** for many instances: a transaction-mode pooler multiplexes many app connections onto few DB connections — essential when replica count is high or you're on serverless (where each invocation is a fresh process). (Phase 4 covered this; it's a *deployment* concern too.)
- Don't forget the connection used by **migrations** (`prisma migrate deploy`) and any **BullMQ/Redis-adjacent** services — they count against the budget too.

---

## Gotchas

- **Shell-form `CMD node dist/main.js`** — `/bin/sh` becomes PID 1, eats `SIGTERM`, never forwards it to node → no graceful shutdown, always SIGKILLed after the grace timeout. Use exec form `["node", "dist/main.js"]`. (Deep dive: `docker/notes/09 §9.2`.)
- **Forgetting `app.enableShutdownHooks()`** — without it NestJS registers no signal listeners, so `onModuleDestroy` never fires, DB/queue connections aren't drained, and every deploy hard-kills in-flight requests.
- **DB check in the liveness probe** — a DB blip restarts every replica simultaneously (self-inflicted outage). Dependency checks go in **readiness** (`/health/ready`), liveness (`/health/live`) stays dependency-free.
- **No `--max-old-space-size`** — V8's ~2GB default heap ignores the cgroup limit; a 512MB container OOM-kills (exit 137) once V8 grows past it. Cap the heap below the limit.
- **Copying host `node_modules` into the image** — drags in native modules (bcrypt, Prisma engine) built for your Mac/glibc into a Linux/musl container → segfaults. Always `.dockerignore` it and `npm ci` inside the image.
- **`npm install` in CI/Docker** — non-deterministic; can resolve different versions than the lockfile. Use `npm ci` (needs `package-lock.json`).
- **`listen(3000)` on Railway/Render/Fly** — they inject `PORT`; a hardcoded port silently gets no traffic. Bind `process.env.PORT` on `0.0.0.0`.
- **Missing `trust proxy` behind Nginx** — `@nestjs/throttler` rate-limits everyone as Nginx's IP, logs show the proxy IP, and HTTPS detection breaks (secure cookies/redirects).
- **`depends_on` without `condition: service_healthy`** — the app boots before Postgres accepts connections and crash-loops. Gate on the dependency's health check.
- **`enableShutdownHooks()` in every test module** — attaches signal listeners per app instance → `MaxListenersExceededWarning` in suites that create many Nest apps. Use it only in real entrypoints.
- **Prune (`--omit=dev`) drops the generated Prisma client** — a prod-only install can skip the generate postinstall. Generate in the build stage and `COPY --from=builder` the `.prisma` dir into the runtime image.
- **Drain timeout ≥ Docker's stop-timeout** — if your safety-net timer is 12s but `stop_grace_period`/`--stop-timeout` is 10s, SIGKILL fires first and your graceful logic never finishes. Keep the app timer below it.
- **Oversized PG pool × replica count** — `pool_size × instances` can exceed Postgres `max_connections` → `too many clients`. Size the per-instance pool small; use PgBouncer at scale.

---

## Phase 9 Project

**Task (from the plan):** Dockerize the Phase 8 microservices project, run it under Docker Compose with health checks, build a GitHub Actions CI/CD pipeline, and deploy to a VPS or Railway.

**Location:** `examples/phase9-deployment/`

**Build it in this order:**

1. **Multi-stage Dockerfiles (9.1)** — for each NestJS service (`users`, `orders`, `gateway`), write a 3-stage Dockerfile: `builder` (`npm ci` + `nest build`), `deps` (`npm ci --omit=dev`), `runtime` (`COPY --chown=node:node` the `dist` + prod `node_modules` + Prisma `.prisma` dir, `USER node`, exec-form `CMD`, `ENV NODE_OPTIONS=--max-old-space-size=384`). Add a Node `.dockerignore` (`node_modules`, `.env`, `dist`, tests). Confirm with `docker history` that no secret leaked and the final image is far smaller than a naive single-stage build.

2. **Graceful shutdown (9.2)** — in each `main.ts` call `app.enableShutdownHooks()`. Give `PrismaService` an `onModuleDestroy` that `$disconnect()`s; give any BullMQ service an `onModuleDestroy` that closes the worker then the queue. Prove it: `docker compose stop users` should exit clean (code **143**) within a couple seconds, not hang 10s then SIGKILL (137).

3. **Compose stack with health checks (9.3 + 9.4)** — one `docker-compose.yml`: `gateway` (published), `users` + `orders` (no published ports, `backend` network), per-service `users-db`/`orders-db` (named volumes, `pg_isready` health check), `redis`, `rabbitmq` (`rabbitmq-diagnostics ping`). Gate every app on `condition: service_healthy`. Add a `docker-compose.override.yml` for dev (watch mode via `target: builder`, debug ports). Put Prometheus/Grafana behind a `monitoring` profile.

4. **Health endpoints (9.7)** — add `@nestjs/terminus` to each service: `/health/live` (memory only, no DB) and `/health/ready` (`PrismaHealthIndicator.pingCheck`). Point each Dockerfile `HEALTHCHECK` at `/health/ready` using Node's `fetch` (no curl on alpine).

5. **CI/CD (9.5)** — a GitHub Actions workflow: `npm ci` → `lint` → `build` → `test:e2e` (Testcontainers Postgres — works on the hosted runner's Docker socket) → on `main`, `docker/build-push-action` to `ghcr.io` with `cache-from/to: type=gha`. Inject any private-registry token as a BuildKit secret, never a build-arg.

6. **Deploy (9.6)** — pick one:
   - **VPS:** Hetzner/DO box, `docker compose up -d`, Nginx (or Caddy for auto-HTTPS) in front of the gateway only. Set `trust proxy` in the gateway so the real client IP reaches `@nestjs/throttler` and the logs.
   - **Railway:** connect the repo, add a managed Postgres + Redis, set env vars (validated by zod at boot), confirm the app binds `process.env.PORT` on `0.0.0.0`.

**Stretch goals:**

- **Zero-downtime:** scale `gateway` to 2 replicas behind Nginx and do a manual blue/green flip (`nginx -s reload`); confirm a `while true; do curl -s localhost:8080/health/live; done` loop sees no gap.
- **Migration safety:** write an expand/contract Prisma migration (add a nullable column) and confirm the old version keeps serving while the new schema exists (`docker/notes/09 §9.7`).
- **OOM demo:** set `mem_limit: 256m` with `--max-old-space-size=512` (deliberately wrong), hammer the service, watch it OOM-kill (137), then fix the heap cap and confirm it survives — `docker inspect --format '{{.State.OOMKilled}}'`.
- **K8s preview:** translate the gateway service to a Deployment with `terminationGracePeriodSeconds` + a `preStop` sleep and liveness/readiness probes pointing at `/health/live` and `/health/ready` (then see `docker/notes/10`).
