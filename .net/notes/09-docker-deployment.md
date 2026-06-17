# Phase 9 — Docker & Deployment

**Status:** Not started
**Notes file:** `notes/09-docker-deployment.md`

---

## How to read this phase

There is a **dedicated Docker module** at `docker/` (10 phases) that teaches Docker
properly — layers, caching, networking, volumes, Compose, security, CI/CD, and
production patterns *in general*. This Phase 9 is the **ASP.NET-specific slice**: how
the generic Docker knowledge maps onto a .NET stack, and the handful of things that
are genuinely different because you're shipping a CLR app instead of a Node process.

So this file is deliberately thin on generic theory and heavy on .NET specifics.
Wherever you see a cross-reference, go read it — don't expect it repeated here:

| Topic | Read this first |
|---|---|
| Layer caching, multi-stage theory, `.dockerignore`, `CMD` vs `ENTRYPOINT` | `docker/notes/02-dockerfiles.md` |
| Compose fundamentals, `depends_on`, networks, volumes | `docker/notes/05-compose.md` |
| GitHub Actions, registry push, build caching | `docker/notes/08-cicd.md` |
| Health checks, graceful shutdown, Nginx, rolling deploys, PID 1 | `docker/notes/09-production.md` |

**Node analogy for the whole phase:** Dockerizing .NET is the same mental model as
Dockerizing a TypeScript app — build with the full toolchain, ship the compiled
output on a slim runtime. `dotnet publish` is your `tsc` + `npm prune --production`
in one step; the `aspnet` runtime image is your "node image with no build tools."

---

## 9.1 Dockerizing ASP.NET Core

### The two images you care about

.NET publishes a family of official images on `mcr.microsoft.com`. For a web API you
only need two of them:

| Image | Contains | Node equivalent | Use as |
|---|---|---|---|
| `mcr.microsoft.com/dotnet/sdk:10.0` | full SDK: compiler, `dotnet` CLI, NuGet, MSBuild | `node` + `typescript` + all devDeps | **build stage** |
| `mcr.microsoft.com/dotnet/aspnet:10.0` | ASP.NET Core runtime only (no SDK) | a bare `node` image, no build tools | **runtime stage** |

There's also `dotnet/runtime:10.0` (console/worker apps, no ASP.NET bits) and
`dotnet/runtime-deps` (for self-contained publishes — see chiseled below). For a web
API, `aspnet` is the right runtime base.

> Why not just run on the `sdk` image? Same reason you don't ship `node_modules` with
> `typescript` and `@types/*` to production: the SDK image is ~800MB of compilers and
> tooling that are pure attack surface at runtime. The `aspnet` image is a fraction of
> the size and carries none of it. (See `docker/notes/02-dockerfiles.md` §2.3 for the
> full multi-stage rationale.)

### A production multi-stage Dockerfile (annotated)

This is the canonical Dockerfile for a single ASP.NET Core service. Put it at the
service root (next to the `.csproj`).

```dockerfile
# syntax=docker/dockerfile:1          # unlocks --mount=type=cache/secret (BuildKit)

# ---------- Stage 1: build + publish ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy ONLY the project file(s) first, then restore. This layer is cached unless a
# .csproj changes — exactly like copying package*.json before `npm ci`. (Layer-cache
# theory: docker/notes/02-dockerfiles.md §2.2.)
COPY ["Orders.Api/Orders.Api.csproj", "Orders.Api/"]
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore "Orders.Api/Orders.Api.csproj"
#   ^ the cache mount keeps the NuGet download cache across builds, so even a
#     cache-busting .csproj change re-downloads only the changed packages.

# NOW copy the rest of the source — source edits bust this layer but NOT restore above.
COPY . .
WORKDIR "/src/Orders.Api"
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet publish "Orders.Api.csproj" \
    -c Release \                      # Release config = optimizations on, no debug symbols
    -o /app/publish \                 # output folder we copy into the runtime stage
    /p:UseAppHost=false               # framework-dependent: no native ./Orders.Api launcher;
                                      # we'll run `dotnet Orders.Api.dll` instead. Smaller output.

# ---------- Stage 2: runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Container config via ENV (non-secret only — see the secrets warning below).
ENV ASPNETCORE_URLS=http://+:8080 \   # Kestrel binds here. NOTE the port — see gotcha.
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true   # hints the runtime it's containerized (GC, etc.)

# Copy ONLY the published output from the build stage. No SDK, no source, no NuGet cache.
COPY --from=build /app/publish .

# Drop root. The .NET runtime images ship a non-root user named `app` (UID 1654)
# built in — you do NOT have to create it (unlike Node where you `USER node`).
USER app

EXPOSE 8080                           # documentation only; you still -p map at run time

# Health check (see 9.1 + 9.6). aspnet images have NO curl/wget — use the trick below.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["dotnet", "Orders.Api.dll", "--healthcheck"] || exit 1

# ENTRYPOINT for the fixed binary. Exec form → dotnet is PID 1 → SIGTERM reaches it
# → ASP.NET's built-in graceful shutdown fires (9.6). Shell form would break this.
ENTRYPOINT ["dotnet", "Orders.Api.dll"]
```

Three .NET-specific points worth internalizing:

1. **`USER app` is free.** The `mcr.microsoft.com/dotnet/aspnet` and `sdk` images
   define a non-root `app` user (UID `1654`) since .NET 8. You don't create it; you
   just `USER app`. (Generic non-root rationale: `docker/notes/07-security.md`.)
2. **`/p:UseAppHost=false`** produces a framework-dependent deployment — a `.dll` you
   run with `dotnet MyApp.dll`. It's smaller and the canonical container approach.
   The native apphost (`./MyApp`) only matters for self-contained/AOT builds.
3. **The default port changed.** Since .NET 8, the official images default Kestrel to
   port **8080** (not 80) precisely so the non-root `app` user can bind it (binding
   <1024 needs root). Set `ASPNETCORE_URLS=http://+:8080` and `EXPOSE 8080`.

### `.dockerignore` for .NET

`COPY . .` ships the whole build context to the daemon. For .NET the big offenders
are `bin/` and `obj/` (local build output compiled for *your* OS, plus `obj/` holds
restore state that will confuse the in-container restore). Mirror your `.gitignore`.
(Full rationale: `docker/notes/02-dockerfiles.md` §2.5.)

```gitignore
# .dockerignore
**/bin/
**/obj/
**/.vs/
.git
.github
.vscode
**/appsettings.Development.json   # local-only config / secrets
**/*.user
Dockerfile
docker-compose*.yml
README.md
**/.dockerignore
```

> The `bin/`/`obj/` exclusion isn't just for size — copying a host `obj/` into the
> image can make `dotnet restore`/`publish` behave inconsistently because it carries
> machine-specific paths and a prior restore graph. Let the build stage produce them
> fresh. (Node analogy: never copy host `node_modules` in either.)

### Environment variables in .NET containers

`IConfiguration` reads environment variables automatically and they **override**
`appsettings.json`. The convention is double-underscore `__` for nested keys, because
`:` isn't legal in env var names on Linux:

```jsonc
// appsettings.json — the structure
{ "ConnectionStrings": { "Postgres": "..." }, "Redis": { "Endpoint": "..." } }
```

```bash
# These env vars override the JSON above. __ becomes the : section separator.
ConnectionStrings__Postgres="Host=db;Database=orders;Username=app;Password=..."
Redis__Endpoint="redis:6379"
ASPNETCORE_ENVIRONMENT=Production
```

This is exactly how you'll inject config in Compose / CI / the host — the same
`process.env` story you know from Node, but with structured-key flattening. (See
`notes/02-aspnet-basics.md` §2.6 for the configuration provider order.)

> ⚠️ **Never bake secrets into `ENV` or `ARG`.** Both are recoverable from the image
> via `docker history` / `docker inspect`. Connection strings and JWT keys come in at
> *run time* (env, Compose `env_file`, orchestrator secrets) — never in the
> Dockerfile. Full treatment: `docker/notes/02-dockerfiles.md` §2.6.

### Building a health-check binary mode (the .NET way around no-curl)

The `aspnet` image has no `curl` or `wget`. The cleanest .NET idiom is to make the
app health-check *itself*: add a tiny branch in `Program.cs` that, when launched with
`--healthcheck`, pings its own `/healthz` over HTTP and sets the exit code. That's
what the `HEALTHCHECK CMD ["dotnet","Orders.Api.dll","--healthcheck"]` above invokes.

```csharp
// Program.cs — very top, before building the web host.
// When Docker runs the HEALTHCHECK, the app is invoked with this arg; we do a quick
// self-probe and exit, instead of starting a second web server.
if (args.Contains("--healthcheck"))
{
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
    try
    {
        var res = await http.GetAsync("http://localhost:8080/healthz");
        return res.IsSuccessStatusCode ? 0 : 1;   // exit 0 = healthy, 1 = unhealthy
    }
    catch
    {
        return 1;                                  // connection refused etc. => unhealthy
    }
}
// ...normal host build continues below
```

Alternatives if you dislike the self-invoke trick: install `curl` in the runtime
stage (adds a CVE surface), or COPY a tiny static health binary. The self-invoke is
the most .NET-native and keeps the image clean. (Generic no-curl discussion:
`docker/notes/09-production.md` §9.1.)

### Chiseled & distroless images (smaller, harder)

For a hardened, tiny runtime, .NET ships **Ubuntu Chiseled** images — a distroless-style
base with no shell, no package manager, only what the runtime needs, and non-root by
default:

```dockerfile
# Chiseled runtime — ~50% smaller than the standard aspnet image, no shell.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS final
```

Notes specific to chiseled:
- **No shell** → you can't `docker exec ... bash` to poke around, and shell-form
  health checks won't work. Use the `--healthcheck` self-probe (above) since it's an
  exec-form `dotnet` call, not a shell command.
- For **AOT / fully self-contained** publishes use `runtime-deps:10.0-noble-chiseled`
  as the base (it has the native deps but not the managed runtime, which your
  self-contained output supplies).
- There's a `-chiseled-extra` variant if you need a few more native libs (e.g.
  globalization/ICU, some crypto).

Rule of thumb (mirrors the generic guidance in `docker/notes/02-dockerfiles.md` §2.4):
standard `aspnet:10.0` for most apps and for anything you want to debug; chiseled for
hardened production once the app is stable.

---

## 9.2 Docker Compose for Local Dev

The goal of local Compose is "one `docker compose up` gives me the app plus every
backing service it needs, wired together, with the DB persisting between runs." For
the .NET stack that's: the API + PostgreSQL + Redis + RabbitMQ. (Compose
fundamentals — networks, `depends_on`, volumes — live in `docker/notes/05-compose.md`;
here's the .NET-flavored stack.)

```yaml
# docker-compose.yml — local dev stack for one ASP.NET service
services:
  api:
    build:
      context: .
      dockerfile: Orders.Api/Dockerfile
    ports:
      - "8080:8080"                  # host:container — Kestrel listens on 8080 (9.1)
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ASPNETCORE_URLS: http://+:8080
      # Service names below are DNS names on the Compose network — see 9.3.
      ConnectionStrings__Postgres: "Host=db;Port=5432;Database=orders;Username=app;Password=devpass"
      Redis__Endpoint: "redis:6379"
      RabbitMq__Host: "rabbitmq"
    depends_on:
      db:        { condition: service_healthy }   # wait until Postgres passes its health check
      redis:     { condition: service_healthy }
      rabbitmq:  { condition: service_healthy }
    init: true                       # Docker injects tini as PID 1 (zombie reaping; 9.6)

  db:
    image: postgres:17
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpass
    volumes:
      - pgdata:/var/lib/postgresql/data    # named volume => data survives `down`/recreate
    healthcheck:
      # pg_isready exits 0 when Postgres can accept connections — gates depends_on above.
      test: ["CMD-SHELL", "pg_isready -U app -d orders"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]   # prints PONG, exit 0 when ready
      interval: 5s
      timeout: 3s
      retries: 10

  rabbitmq:
    image: rabbitmq:3-management           # -management adds the web UI on 15672
    ports:
      - "15672:15672"                       # management UI (handy in dev; don't expose in prod)
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s                     # RabbitMQ is slow to boot — give it room

volumes:
  pgdata:                                    # declared named volume (persists on disk)
```

Why each piece matters for .NET specifically:

- **`depends_on: condition: service_healthy`** is doing real work here. Without it,
  the API starts before Postgres accepts connections and your first `DbContext` call
  throws `Npgsql.NpgsqlException: Connection refused`. The health-gated start order
  removes the "race the database" flakiness. (Mechanism: `docker/notes/05-compose.md`.)
- **Service names are DNS names.** `Host=db` in the connection string resolves to the
  `db` container — Compose runs an internal DNS resolver. This is why your connection
  strings use `db`/`redis`/`rabbitmq` instead of `localhost`. (More in 9.3.)
- **The `pgdata` named volume** is what makes your migrations and seed data survive a
  `docker compose down` and recreate. An *anonymous* volume or no volume = fresh DB
  every restart. (Volume theory: `docker/notes/04-volumes-storage.md`.)

> Migrations note: don't run `dotnet ef database update` from inside the runtime image
> (it has no SDK). Either (a) run migrations from your host against the Compose DB, (b)
> add a tiny `BackgroundService`/startup hook that calls `db.Database.MigrateAsync()`
> on boot for dev, or (c) ship a separate one-shot migrator service built from the
> `sdk` image. Option (b) is the usual dev convenience; for prod prefer an explicit
> migration step in CI/CD (9.4).

### Hot-reload dev variant (optional)

For an inner-loop closer to `dotnet watch`, mount the source and run the SDK image
with `dotnet watch` instead of building. This trades image purity for fast feedback —
keep it in an override file (9.3), never in your production Compose.

```yaml
# docker-compose.override.yml (dev-only)
services:
  api:
    image: mcr.microsoft.com/dotnet/sdk:10.0
    working_dir: /src/Orders.Api
    command: ["dotnet", "watch", "run", "--urls", "http://+:8080"]
    volumes:
      - ./:/src                       # bind-mount source so file changes trigger reload
```

---

## 9.3 Docker Compose for Microservices

Phase 8 gave you multiple .NET services (e.g. Users, Orders) talking over HTTP and
RabbitMQ, with a YARP gateway out front. Compose is how you run that whole graph
locally. The new ideas vs 9.2 are **service DNS across many services**, **shared vs
segmented networks**, and **override files**.

```yaml
# docker-compose.yml — microservices stack
services:
  gateway:
    build: { context: ., dockerfile: Gateway/Dockerfile }   # YARP reverse proxy (Phase 8.5)
    ports:
      - "8080:8080"                  # ONLY the gateway is published to the host
    environment:
      # YARP routes to services by their Compose DNS names + container port.
      ReverseProxy__Clusters__users__Destinations__d1__Address: "http://users:8080"
      ReverseProxy__Clusters__orders__Destinations__d1__Address: "http://orders:8080"
    depends_on:
      users:  { condition: service_healthy }
      orders: { condition: service_healthy }
    networks: [edge, backend]

  users:
    build: { context: ., dockerfile: Users.Api/Dockerfile }
    environment:
      ConnectionStrings__Postgres: "Host=users-db;Database=users;Username=app;Password=devpass"
      RabbitMq__Host: "rabbitmq"
    depends_on:
      users-db: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    networks: [backend]              # NOT on edge — unreachable from host directly

  orders:
    build: { context: ., dockerfile: Orders.Api/Dockerfile }
    environment:
      ConnectionStrings__Postgres: "Host=orders-db;Database=orders;Username=app;Password=devpass"
      RabbitMq__Host: "rabbitmq"
      Services__Users: "http://users:8080"   # sync HTTP call target = service DNS name
    depends_on:
      orders-db: { condition: service_healthy }
      rabbitmq:  { condition: service_healthy }
    networks: [backend]

  users-db:
    image: postgres:17
    environment: { POSTGRES_DB: users, POSTGRES_USER: app, POSTGRES_PASSWORD: devpass }
    volumes: [users-pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d users"]
      interval: 5s
      retries: 10
    networks: [backend]

  orders-db:
    image: postgres:17
    environment: { POSTGRES_DB: orders, POSTGRES_USER: app, POSTGRES_PASSWORD: devpass }
    volumes: [orders-pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d orders"]
      interval: 5s
      retries: 10
    networks: [backend]

  rabbitmq:
    image: rabbitmq:3-management
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      retries: 10
      start_period: 20s
    networks: [backend]

networks:
  edge:                              # public-facing: only gateway sits here
  backend:                           # internal service mesh: services + DBs + broker

volumes:
  users-pgdata:
  orders-pgdata:
```

Key microservices-on-Compose points:

- **Database-per-service.** Each service owns its own Postgres (`users-db`,
  `orders-db`) with its own volume — no shared schema. This enforces the Phase 8
  bounded-context rule at the infrastructure level. (See `notes/08-microservices.md`
  §8.1.)
- **Service DNS = the service discovery.** `Services__Users: "http://users:8080"` and
  the YARP destinations all resolve via Compose's DNS. This is the "service discovery"
  bullet from the plan (§8.6) — for local/single-host you don't need Consul; the
  Compose network *is* the registry. Configure these URLs via env so the *same* code
  runs locally and in prod with different values.
- **Network segmentation.** Putting only the gateway on `edge` and everyone else on
  `backend` means the host can only reach the gateway — services and DBs aren't
  publishable. This mirrors the production "only the proxy is exposed" rule (9.5/9.6).
  (Network theory: `docker/notes/03-networking.md`.)

### Override files for different environments

Compose automatically merges `docker-compose.override.yml` on top of
`docker-compose.yml`. Keep the base file environment-agnostic; put dev conveniences in
the override and prod settings in an explicitly-named file:

```bash
# Local dev: base + override.yml auto-merged (override.yml has watch/mounts/extra ports)
docker compose up

# Production-ish: base + an explicit prod file, override IGNORED
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

```yaml
# docker-compose.prod.yml — only the deltas from base
services:
  gateway:
    image: ghcr.io/me/gateway:${TAG}   # pull a pushed image instead of building
    build: !reset null                 # disable build; we deploy prebuilt images
    restart: unless-stopped
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }   # log rotation (docker/notes/09 §9.4)
```

The pattern: **base file = the service graph and DNS wiring** (stable across
environments), **override/prod files = environment-specific deltas** (image vs build,
published ports, resource limits, log rotation, secrets source). This is the .NET
realization of the override-files bullet in the plan.

---

## 9.4 CI/CD Basics (GitHub Actions for ASP.NET)

The pipeline for a .NET service is: **restore → build → test → docker build → push to
registry**. The Docker/registry mechanics (caching, `docker/login-action`,
`build-push-action`, secrets) are covered in `docker/notes/08-cicd.md` — here's the
.NET-specific job and the gluing.

```yaml
# .github/workflows/ci.yml
name: ci

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  # ---- Job 1: build + test on the SDK (no Docker yet) ----
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "10.0.x"     # install the .NET 10 SDK on the runner

      # Cache the NuGet package cache between runs (like caching ~/.npm).
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-${{ hashFiles('**/*.csproj', '**/packages.lock.json') }}
          restore-keys: nuget-

      - run: dotnet restore
      - run: dotnet build --no-restore -c Release
      # Testcontainers tests (Phase 6.4) spin up real Postgres via Docker — the
      # ubuntu-latest runner has Docker available, so integration tests Just Work.
      - run: dotnet test --no-build -c Release --logger "trx" --results-directory ./test-results

      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: test-results, path: ./test-results }

  # ---- Job 2: build + push the image (only after tests pass, only on main) ----
  docker:
    needs: test                        # gate: don't build/push unless tests are green
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write                  # needed to push to GitHub Container Registry (ghcr.io)
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3   # enables BuildKit + layer cache export

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}    # auto-provided; no manual secret needed

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Orders.Api/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/orders:latest
            ghcr.io/${{ github.repository }}/orders:${{ github.sha }}   # immutable, traceable tag
          cache-from: type=gha          # reuse the GitHub Actions layer cache...
          cache-to: type=gha,mode=max   # ...and write it back (mode=max caches all stages)
```

.NET-specific CI notes:

- **`dotnet test` with Testcontainers needs Docker on the runner.** `ubuntu-latest`
  has it, so your Phase 6 integration tests (real Postgres in a container) run
  unchanged in CI — no SQLite faking. (See `notes/06-testing.md` §6.4.)
- **Cache `~/.nuget/packages`** keyed on the `.csproj`/lock files. This is the CI
  equivalent of the `--mount=type=cache` you used in the Dockerfile, and the Node
  `~/.npm` cache you already know.
- **Tag with the commit SHA**, not just `latest`. The SHA tag is immutable and lets
  you redeploy/roll back to an exact build. `latest` is a moving pointer — fine for
  "newest" but useless for "which build is in prod right now."

### Secrets in GitHub Actions

`GITHUB_TOKEN` is injected automatically and is enough to push to **ghcr.io**. For
anything else — Docker Hub creds, a deploy SSH key, a Railway token, cloud
credentials — add them under **Settings → Secrets and variables → Actions** and read
them via `${{ secrets.NAME }}`. They're masked in logs. Never hardcode a connection
string or JWT signing key in the workflow file. (Registry-auth specifics:
`docker/notes/08-cicd.md`.)

### Deploy step (one common pattern: SSH to a VPS)

After the image is pushed, a deploy job can SSH into the VPS and pull+up. (Other
targets in 9.5 use their own actions — Railway/Azure have dedicated ones.)

```yaml
  deploy:
    needs: docker
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}        # private deploy key, stored as a secret
          script: |
            cd /opt/orders
            docker compose pull                  # grab the image the docker job just pushed
            docker compose up -d                 # recreate changed services
            docker image prune -f                # clean up dangling old images
```

---

## 9.5 Deployment Options

A ladder from least-managed (most control, most ops) to most-managed (least control,
least ops). The right rung depends on how much infra you want to own. (The generic
single-host-vs-Swarm-vs-K8s decision tree is in `docker/notes/09-production.md` §9.5 —
this is the .NET/hosting-provider angle.)

### VPS + Docker (DigitalOcean, Hetzner) — the 90% answer

One Linux box, your Compose file, Nginx out front. Cheapest and most portable; you own
patching and uptime.

```bash
# On the VPS, first time:
mkdir -p /opt/orders && cd /opt/orders
# copy docker-compose.yml + docker-compose.prod.yml + nginx/ + .env here (scp/git)
docker login ghcr.io                                   # so it can pull your private image
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps                                      # confirm everything (healthy)
```

This is what the GitHub Actions `deploy` job above automates. Hetzner is dramatically
cheaper than the hyperscalers for a learning/side-project fleet; DigitalOcean has a
gentler UX and 1-click Docker droplets. Either is fine for the Phase 9 project.

### Railway / Render — push-to-deploy PaaS

Point the platform at your repo; it builds (it auto-detects the Dockerfile, or uses
its .NET buildpack) and runs the container. You get managed Postgres/Redis add-ons,
TLS, and a URL — no server to patch.

- **Railway:** add a Postgres + Redis plugin; it injects `DATABASE_URL`-style env vars.
  Map them to your `ConnectionStrings__Postgres` via Railway's variables UI. Deploys on
  git push or via the Railway CLI/GitHub Action.
- **Render:** a "Web Service" from your Dockerfile + a managed Postgres. Set the health
  check path to `/healthz` so Render gates traffic on readiness.

Trade-off: fastest to a running URL, but pricier at scale and less control than a VPS.
Great for the Phase 9 "deploy somewhere real, quickly" goal.

### Azure Container Apps — the .NET-native managed option

ACA is the natural PaaS for ASP.NET: serverless containers with built-in scale-to-zero,
revisions (built-in blue/green), Dapr, and managed ingress with TLS. You push your
image to Azure Container Registry and ACA runs it.

```bash
az acr build --registry myregistry --image orders:latest .   # build in ACR (no local Docker)
az containerapp up \
  --name orders \
  --resource-group rg-learn \
  --image myregistry.azurecr.io/orders:latest \
  --target-port 8080 \                 # matches Kestrel's container port (9.1)
  --ingress external \                 # ACA provisions HTTPS + a public URL automatically
  --env-vars ASPNETCORE_ENVIRONMENT=Production
```

ACA gives you rolling revisions, autoscaling (incl. KEDA on queue length — pairs well
with the RabbitMQ work from Phase 8), and managed certs without you touching Nginx or
Let's Encrypt. Most "Azure" for a .NET shop; vendor-locked compared to the VPS path.

### Nginx as a reverse proxy in front of ASP.NET

On the VPS path you put Nginx in front of Kestrel. Kestrel *can* face the internet, but
the convention is a reverse proxy for TLS termination, static files, and buffering slow
clients. The full annotated Nginx config (TLS, `X-Forwarded-*` headers, upstreams,
WebSocket upgrade) is in `docker/notes/09-production.md` §9.6 — don't duplicate it; the
**.NET-specific** requirement is that Kestrel must be told to trust those forwarded
headers (covered in 9.6 below).

```nginx
# The essence (full config: docker/notes/09-production.md §9.6)
upstream orders { server orders:8080; }   # Compose service DNS + Kestrel's container port
server {
    listen 443 ssl;
    location / {
        proxy_pass http://orders;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # ASP.NET reads this to know it's HTTPS
    }
}
```

---

## 9.6 Production Considerations

Generic production behavior — health-check state machine, the PID 1 problem, log
rotation, rolling-deploy strategies, the migration trap — is all in
`docker/notes/09-production.md`. This section covers the parts that are **specific to
ASP.NET Core**.

### HTTPS in production (Let's Encrypt)

Don't make Kestrel manage public certs. Terminate TLS at the reverse proxy and let it
handle Let's Encrypt renewal. Two common setups:

- **Nginx + Certbot**, or
- **Caddy** as the proxy — it does automatic HTTPS (ACME) with zero config, which is
  the lowest-effort option for a VPS.

```yaml
# Caddy as an auto-HTTPS proxy in front of the API (Compose)
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data            # persists the issued certs across restarts
    depends_on:
      orders: { condition: service_healthy }
volumes:
  caddy_data:
```

```caddyfile
# Caddyfile — auto-provisions + renews a Let's Encrypt cert for the domain
orders.example.com {
    reverse_proxy orders:8080       # Caddy adds X-Forwarded-* automatically
}
```

Inside the container Kestrel still speaks plain HTTP on 8080; TLS lives at the edge.

### Kestrel behind a reverse proxy — `ForwardedHeaders` (the must-do)

When a request passes through Nginx/Caddy, Kestrel's socket connects to the *proxy*,
not the client. So without configuration, `HttpContext.Connection.RemoteIpAddress` is
the proxy's IP and `Request.Scheme` is `http` even though the user came in over HTTPS.
That breaks `RequireHttpsMetadata`, secure-cookie issuance, IP-based rate limiting
(Phase 5.5), and generated absolute URLs.

The fix is the `ForwardedHeaders` middleware, applied **early** in the pipeline:

```csharp
// Program.cs
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // SECURITY: by default ASP.NET only trusts a loopback proxy. In a container the
    // proxy is a *different* container, so you must allow it. Either clear the known
    // lists (trust the immediate upstream — fine when only your proxy can reach the app
    // on an internal network), or add the proxy's specific network.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Must run BEFORE UseAuthentication/UseRouting/etc. so downstream sees the real
// scheme + client IP. This is the single most-forgotten .NET-behind-proxy step.
app.UseForwardedHeaders();
```

> Security caveat (same as the generic note in §9.6): only clear the known-proxy lists
> when the app is reachable *solely* via your proxy on an internal network. If clients
> can hit Kestrel directly, a forged `X-Forwarded-For` lets them spoof their IP — then
> scope `KnownNetworks` to the proxy's subnet instead.

### Environment-based configuration & connection-string secrets

- `ASPNETCORE_ENVIRONMENT=Production` selects `appsettings.Production.json` and turns
  off the developer exception page. (See `notes/02-aspnet-basics.md` §2.6.)
- **Connection strings and JWT keys never live in the image.** Inject them at runtime:
  Compose `env_file:`/secrets, the VPS host environment, or the platform's secret store
  (Railway/Render variables, Azure Key Vault + `AddAzureKeyVault`). `IConfiguration`
  merges env vars over JSON automatically (the `__` convention from 9.1), so the same
  binary reads `ConnectionStrings__Postgres` from whatever the environment provides.

```yaml
# Compose: keep secrets out of the committed YAML — load from an untracked .env file
services:
  orders:
    image: ghcr.io/me/orders:${TAG}
    env_file: [.env.production]      # gitignored; holds ConnectionStrings__Postgres, Jwt__Key, ...
```

### Graceful shutdown in ASP.NET Core (`IHostApplicationLifetime`)

This is the .NET version of the §9.2 graceful-shutdown topic. ASP.NET Core handles the
common case **for free**: on SIGTERM the generic host triggers `ApplicationStopping`,
stops accepting new connections, and **drains in-flight HTTP requests** within the
shutdown timeout — provided `dotnet` is PID 1 (which the exec-form `ENTRYPOINT` in 9.1
guarantees). Your job is the *extra* cleanup: background workers, message consumers,
flushing.

```csharp
// Program.cs
// Keep the host's shutdown timeout BELOW Docker's stop grace period, or SIGKILL cuts
// you off mid-drain. Docker default stop-timeout is 10s; set the host to ~8s.
builder.Services.Configure<HostOptions>(o =>
    o.ShutdownTimeout = TimeSpan.FromSeconds(8));

var app = builder.Build();

var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();

lifetime.ApplicationStopping.Register(() =>
{
    // Fires on SIGTERM, at the START of shutdown. Use it to flip readiness to
    // "unhealthy" so the load balancer/orchestrator stops routing new traffic here,
    // and to begin winding down background work.
    app.Logger.LogInformation("ApplicationStopping: draining, no new traffic.");
});

lifetime.ApplicationStopped.Register(() =>
    app.Logger.LogInformation("ApplicationStopped: clean exit."));
```

For background work, a `BackgroundService` (Phase 7.5) gets a cancellation token tied
to shutdown — honor it so in-flight jobs/messages finish or requeue cleanly:

```csharp
public class OrderConsumer : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // stoppingToken is cancelled on SIGTERM. Loop on it; when it trips, stop
        // pulling new messages and let the current one finish (or nack to requeue).
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessNextMessageAsync(stoppingToken);
        }
    }
    // Optionally override StopAsync for final flush (called during ApplicationStopping).
}
```

Tie it together with Compose so the timing lines up (host drain 8s < grace 10s):

```yaml
services:
  orders:
    image: ghcr.io/me/orders:${TAG}
    init: true                       # tini reaps zombies + forwards SIGTERM (9.6 generic)
    stop_grace_period: 10s           # Docker waits this long after SIGTERM before SIGKILL
```

Prove it works: `docker compose stop orders` should exit with code **143**
(`128 + SIGTERM`) within a second or two — *not* hang for 10s and exit **137**
(SIGKILL), which would mean SIGTERM never reached the app (usually a shell-form
`ENTRYPOINT` — see the PID 1 deep-dive in `docker/notes/09-production.md` §9.2).

### Rolling deployments

The strategies — naive `compose pull && up -d` (brief blip), blue/green, orchestrated
rolling updates — and the **destructive-migration trap** (old and new code hit the
same DB during rollout) are covered fully in `docker/notes/09-production.md` §9.7.

The **.NET-specific discipline** to carry over: with EF Core, follow expand/contract.
Never ship a migration that the currently-running version can't tolerate. Generate the
migration (`dotnet ef migrations add`) so it's *additive* (add nullable column → deploy
code that writes it → backfill → tighten constraint → later deploy drops the old
column). And run migrations as an explicit deploy step (a one-shot SDK-image job or a
gated CI step), not silently on app startup in production — startup migration races all
your replicas trying to migrate at once.

---

## Gotchas for JS/TS Developers

| Gotcha | What bites you | Fix |
|---|---|---|
| Default container port | Since .NET 8 the official images listen on **8080**, not 80/5000 | `ASPNETCORE_URLS=http://+:8080`, `EXPOSE 8080`, map `-p 8080:8080` |
| Binding port <1024 as non-root | `USER app` can't bind port 80 (needs root) | use 8080 in-container; let the proxy own 80/443 |
| `obj/`/`bin/` copied in | host build output corrupts/inflates the in-container restore | `.dockerignore` `**/bin/ **/obj/` (like ignoring `node_modules`) |
| Secrets in `ENV`/`ARG` | recoverable via `docker history`/`inspect` — same as committing `.env` | runtime env / `env_file` / orchestrator secrets only |
| No `curl` in `aspnet`/chiseled | shell-form `HEALTHCHECK curl ...` silently never works | `--healthcheck` self-probe (9.1) or install curl |
| Shell-form `ENTRYPOINT` | `sh` becomes PID 1, eats SIGTERM → graceful shutdown never fires, exit 137 | exec form `ENTRYPOINT ["dotnet","App.dll"]` |
| Behind a proxy without ForwardedHeaders | app sees proxy IP + thinks it's on HTTP → broken HTTPS redirects, secure cookies, rate limits | `app.UseForwardedHeaders()` early, clear known-proxy lists |
| `localhost` in connection strings | inside a container `localhost` is the container, not the DB | use the **service DNS name** (`Host=db`) |
| Host shutdown timeout > Docker grace | SIGKILL fires mid-drain → dropped requests, exit 137 | `HostOptions.ShutdownTimeout` (8s) < `stop_grace_period` (10s) |
| Migrating on startup in prod | every replica races to migrate the same DB | explicit migration step in CI/CD; expand/contract migrations |
| Building on the SDK image for runtime | ~800MB image, full toolchain as attack surface | multi-stage: `sdk` to build, `aspnet`/chiseled to run |

---

## Phase 9 Project — Dockerize, Compose, CI/CD, Deploy the Microservices

**Goal:** Take the Phase 8 microservices (e.g. Users + Orders + a YARP gateway,
PostgreSQL per service, RabbitMQ) from "runs with `dotnet run`" to "containerized,
health-gated, built and pushed by CI, and deployed to a real host." Put artifacts in
`examples/phase9-deploy/`.

**Concrete steps & hints:**

1. **Dockerize each service (9.1).** Add a multi-stage `Dockerfile` to every service:
   `sdk:10.0` build/publish stage → `aspnet:10.0` runtime stage, `USER app`, exec-form
   `ENTRYPOINT`, `ASPNETCORE_URLS=http://+:8080`. Add a `.dockerignore`
   (`**/bin/ **/obj/ .git ...`). Add the `--healthcheck` self-probe and a `HEALTHCHECK`.
   *Verify:* `docker images` — runtime image should be a fraction of an `sdk`-based
   build; `docker history` shows no secrets. *Stretch:* switch one service to a
   `-noble-chiseled` runtime and compare size.

2. **Local Compose stack (9.2/9.3).** Write `docker-compose.yml`: gateway (published
   `8080`), each service (no published ports), a Postgres per service with named
   volumes, RabbitMQ. Wire `depends_on: condition: service_healthy` everywhere; give
   Postgres a `pg_isready` check and RabbitMQ a `rabbitmq-diagnostics ping`. Use
   service DNS names in connection strings and inter-service URLs. Put dev conveniences
   (`dotnet watch`, source mounts) in `docker-compose.override.yml`.
   *Verify:* `docker compose up` → all services `(healthy)`, gateway routes to both
   services, data survives `down`/`up`.

3. **Graceful shutdown (9.6).** Add the `IHostApplicationLifetime` hooks + `HostOptions.
   ShutdownTimeout = 8s`, `init: true`, `stop_grace_period: 10s`. Make the RabbitMQ
   consumer honor the `stoppingToken`. *Verify:* `docker compose stop orders` exits
   **143** within ~2s, not **137** after 10s.

4. **CI/CD (9.4).** Add `.github/workflows/ci.yml`: a `test` job
   (`setup-dotnet@10.0.x`, NuGet cache, `dotnet test` with Testcontainers) and a
   `docker` job (`needs: test`, build+push each service to `ghcr.io` tagged with the
   commit SHA + `latest`, GHA layer cache). *Verify:* push to a branch → green tests;
   merge to main → images appear in the GitHub Packages tab.

5. **Deploy (9.5).** Pick one:
   - **VPS (Hetzner/DigitalOcean):** provision a droplet, install Docker, `scp` the
     compose + prod override + `.env.production`, add the `appleboy/ssh-action` deploy
     job (pull + `up -d`). Put **Caddy** in front for auto-HTTPS (9.6) and
     `app.UseForwardedHeaders()` in each service.
   - **Railway/Render:** point it at the repo, add managed Postgres, map the env var to
     `ConnectionStrings__Postgres`, set the health path to `/healthz`.
   *Verify:* hit the public HTTPS URL; check the app logs the **real client IP** (proof
   `ForwardedHeaders` is working), not the proxy's.

6. **Rolling update (9.6).** Change a response string, tag `:v2`, push, redeploy. Run a
   `while true; do curl -s https://.../healthz; sleep 0.2; done` loop and observe the
   blip on a naive `compose up -d`. *Stretch:* do a manual blue/green flip behind
   Caddy/Nginx for a gap-free switch. *Stretch 2:* ship an additive (nullable-column)
   EF migration and confirm v1 keeps serving while the new schema exists.

**Where it lives:** `examples/phase9-deploy/` — per-service `Dockerfile` +
`.dockerignore`, `docker-compose.yml` + `docker-compose.override.yml` +
`docker-compose.prod.yml`, `Caddyfile` (or `nginx/app.conf`),
`.github/workflows/ci.yml`, and a short `DEPLOY.md` with the exact commands you ran.

---

## Summary

| Concept | .NET specifics | Cross-reference |
|---|---|---|
| Build image | `mcr.microsoft.com/dotnet/sdk:10.0` | `docker/notes/02-dockerfiles.md` §2.3 |
| Runtime image | `aspnet:10.0` (or `-noble-chiseled`) | `docker/notes/02-dockerfiles.md` §2.4 |
| Publish | `dotnet publish -c Release /p:UseAppHost=false` | — |
| Non-root | `USER app` (built into the images, UID 1654) | `docker/notes/07-security.md` |
| Container port | 8080 (`ASPNETCORE_URLS`) since .NET 8 | — |
| Config/secrets | env vars with `__` override `appsettings.json` | `notes/02-aspnet-basics.md` §2.6 |
| Health check | `--healthcheck` self-probe (no curl in image) | `docker/notes/09-production.md` §9.1 |
| Compose stack | api + Postgres + Redis + RabbitMQ, health-gated `depends_on` | `docker/notes/05-compose.md` |
| Microservices | service DNS, DB-per-service, segmented networks, override files | `notes/08-microservices.md` |
| CI/CD | `setup-dotnet`, NuGet cache, Testcontainers, build-push to ghcr | `docker/notes/08-cicd.md` |
| Deploy | VPS+Docker / Railway / Render / Azure Container Apps | `docker/notes/09-production.md` §9.5 |
| Behind proxy | `app.UseForwardedHeaders()` early, clear known-proxy lists | `docker/notes/09-production.md` §9.6 |
| Graceful shutdown | `IHostApplicationLifetime`, `ShutdownTimeout` < `stop_grace_period` | `docker/notes/09-production.md` §9.2 |
| Rolling deploys | expand/contract EF migrations; migrate in CI, not on startup | `docker/notes/09-production.md` §9.7 |
