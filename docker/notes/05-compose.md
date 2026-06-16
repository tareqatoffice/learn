# Phase 5 — Docker Compose

---

## 5.1 What Compose Is and Isn't

Docker Compose is a tool for defining and running **multi-container applications declaratively**. Instead of typing a dozen `docker run` commands with `-p`, `-v`, `-e`, `--network` flags (and remembering the right startup order), you write a single YAML file that describes the whole stack, then run `docker compose up`.

Think of it like `package.json` + a process manager for containers. `docker run` is the imperative equivalent of typing shell commands; Compose is the declarative equivalent of a config file you commit to git.

```
WITHOUT Compose (imperative, error-prone, order-dependent)
─────────────────────────────────────────────────────────
docker network create app-net
docker volume create pgdata
docker run -d --name db   --network app-net -v pgdata:/var/lib/postgresql/data postgres:16
docker run -d --name redis --network app-net redis:7
docker run -d --name api  --network app-net -p 3000:3000 -e DATABASE_URL=... myapi
docker run -d --name nginx --network app-net -p 80:80 nginx
# ...and you have to tear all of this down by hand, in the right order

WITH Compose (declarative, reproducible, one command)
─────────────────────────────────────────────────────────
docker compose up -d      # creates network, volumes, all 4 containers
docker compose down       # tears it ALL down cleanly
```

### `docker compose` (v2) vs `docker-compose` (v1)

This trips up everyone, so get it straight early:

| | v1 — `docker-compose` | v2 — `docker compose` |
|---|---|---|
| Form | Standalone Python binary, **hyphen** | Go plugin to the Docker CLI, **space** |
| Status | **Deprecated**, EOL since mid-2023 | Current, actively developed |
| Speaks | The Compose file (v2/v3 schema) | The **Compose Specification** (unified) |
| `version:` key | Required (`version: "3.8"`) | Ignored / obsolete — omit it |
| Invoke as | `docker-compose up` | `docker compose up` |

**Use `docker compose` (with a space).** It ships as part of modern Docker Desktop and Docker Engine. If `docker compose version` works, you have v2. The old hyphenated binary still exists on many machines but you should not write new projects against it.

> TS analogy: v1 vs v2 is like CommonJS `require` vs ESM `import`. Both "work" on most setups, but new code targets the modern one, and tutorials mixing the two cause real confusion.

### What Compose is NOT

- **Not a production orchestrator.** Compose runs on a **single host**. It has no concept of scheduling across machines, no self-healing across nodes, no rolling-update strategy with automatic rollback. That's Kubernetes (Phase 10) or Swarm.
- **Not a replacement for a Dockerfile.** Compose orchestrates images; the Dockerfile *builds* them. Compose can trigger a build, but it doesn't define how the image is assembled.
- **Not magic networking across hosts.** The default `bridge` network it creates is local to one machine.

The honest mental model: **Compose is fantastic for local development and small single-server deployments. The moment you need more than one host, you've outgrown it.**

---

## 5.2 The `compose.yaml` Top-Level Structure

A Compose file has a small number of **top-level keys**. Everything else nests under these.

```yaml
# compose.yaml  (modern default name; docker-compose.yml also works)
# NOTE: no `version:` key in v2 — it's obsolete. If you see `version: "3.8"`
#       at the top of a tutorial, that's the old v1 schema. Delete it.

name: myapp          # project name — namespaces containers/networks/volumes
                     # (defaults to the directory name if omitted)

services:            # THE CONTAINERS — the heart of the file. Each key is a service.
  api: { ... }
  db:  { ... }

networks:            # custom networks (optional — a default one is auto-created)
  backend: {}
  frontend: {}

volumes:             # named, Docker-managed volumes for persistent data
  pgdata: {}
  redisdata: {}

configs:             # config files (Swarm feature; usable locally to inject files)
  nginx_conf:
    file: ./nginx.conf

secrets:             # secrets — mounted as files at /run/secrets/<name>
  db_password:
    file: ./secrets/db_password.txt
```

```
File anatomy
────────────
compose.yaml
├── name:        project namespace (prefix for everything Compose creates)
├── services:    ← what runs (containers). You will spend 95% of your time here.
│   ├── api
│   ├── db
│   └── ...
├── networks:    ← how services find/reach each other
├── volumes:     ← what survives a container being destroyed
├── configs:     ← non-secret files injected into containers
└── secrets:     ← secret files injected into containers (not in env / inspect output)
```

The **project name** matters more than it looks. Compose prefixes every resource it creates with it: `myapp-api-1`, `myapp_backend` (network), `myapp_pgdata` (volume). Two projects with different names won't collide. By default the name comes from the directory, so the *same* file in two folders gives two independent stacks.

---

## 5.3 Service Definition — Every Important Field

A **service** is a recipe for one (or more, when scaled) containers. Here is a fully annotated service showing the fields you will actually use. You will never use all of these on one service — this is a reference, not a template.

```yaml
services:
  api:
    # ── IMAGE SOURCE: either pull a prebuilt image OR build one ─────────────
    image: myorg/myapi:1.4.2     # pull this prebuilt image...
    build:                        # ...OR build from a Dockerfile.
      context: .                  #   build context dir sent to the daemon
      dockerfile: Dockerfile      #   defaults to "Dockerfile" in the context
      target: runtime             #   which multi-stage target to build (Phase 2)
      args:                       #   build-time ARGs (NOT available at runtime)
        NODE_ENV: production
    # If BOTH image and build are present: build, then tag the result as `image`.

    # ── IDENTITY ────────────────────────────────────────────────────────────
    container_name: api          # FIXED name. Avoid it if you ever scale this
                                 # service — only ONE container can hold a name,
                                 # so `--scale api=3` will fail. Let Compose
                                 # auto-name (myapp-api-1, -2, -3) instead.

    # ── PORTS: publish a container port to the host (host:container) ──────────
    ports:
      - "3000:3000"              # host 3000 -> container 3000
      - "127.0.0.1:9229:9229"    # bind to localhost only (debugger, not public)
    expose:
      - "3000"                   # documents the port to OTHER containers only;
                                 # does NOT publish to the host. Rarely needed —
                                 # services on the same network reach each other
                                 # regardless of `expose`.

    # ── ENVIRONMENT: runtime config ──────────────────────────────────────────
    environment:                 # inline values (highest precedence)
      NODE_ENV: production
      DATABASE_URL: postgres://app:secret@db:5432/appdb  # NOTE host = "db"
      REDIS_URL: redis://redis:6379                       #       = service name!
    env_file:                    # load KEY=VALUE pairs from a file
      - .env                     # values here are OVERRIDDEN by `environment:`

    # ── STARTUP ORDERING & READINESS (see 5.4 — the big teaching point) ───────
    depends_on:
      db:
        condition: service_healthy   # wait until db's healthcheck passes
      redis:
        condition: service_healthy

    # ── COMMAND OVERRIDES ─────────────────────────────────────────────────────
    entrypoint: ["node"]         # overrides the image's ENTRYPOINT
    command: ["dist/main.js"]    # overrides the image's CMD (the args)
    working_dir: /app            # overrides WORKDIR
    user: "node"                 # run as this user (overrides Dockerfile USER)

    # ── NETWORKING ────────────────────────────────────────────────────────────
    networks:
      - backend                  # attach to these networks (see 5.5)
    # extra_hosts:               # add static /etc/hosts entries
    #   - "host.docker.internal:host-gateway"   # reach the host on Linux

    # ── STORAGE ───────────────────────────────────────────────────────────────
    volumes:
      - ./src:/app/src           # BIND mount: host path -> container (dev reload)
      - uploads:/app/uploads     # NAMED volume (declared under top-level volumes:)
      - /app/node_modules        # ANONYMOUS volume — "shadows" node_modules so the
                                 # host bind mount above doesn't clobber installed
                                 # deps (Phase 6 trick)

    # ── LIFECYCLE ──────────────────────────────────────────────────────────────
    restart: unless-stopped      # no | always | on-failure | unless-stopped
    stop_grace_period: 30s       # SIGTERM, then wait this long, then SIGKILL
    init: true                   # run an init (tini) as PID 1 to reap zombies &
                                 # forward signals — important for graceful shutdown

    # ── HEALTH CHECK: how Compose decides this service is "healthy" ────────────
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]  # exit 0 = healthy
      interval: 30s              # run the test every 30s
      timeout: 10s               # a single test fails if it runs longer than this
      retries: 3                 # mark unhealthy after this many consecutive fails
      start_period: 40s          # grace window at boot — failures here don't count
      # start_interval: 5s       # (newer) faster checks DURING start_period

    # ── RESOURCE LIMITS ────────────────────────────────────────────────────────
    deploy:
      resources:
        limits:                  # hard ceiling
          cpus: "0.50"           # max half a core
          memory: 512M           # OOM-killed if it exceeds this
        reservations:            # soft guarantee (scheduling hint)
          cpus: "0.25"
          memory: 128M
    # NOTE: under plain `docker compose up`, `deploy.resources.limits` IS honored.
    #       Other `deploy:` keys (replicas, update_config) are Swarm-only and
    #       silently ignored by Compose.

    # ── LOGGING ─────────────────────────────────────────────────────────────────
    logging:
      driver: json-file
      options:
        max-size: "10m"          # rotate at 10MB...
        max-file: "3"            # ...keep 3 files. Without this, logs grow forever.
```

The single most important thing to internalize here: **`environment` host names are service names.** `DATABASE_URL=postgres://...@db:5432/...` works because Compose puts every service on a shared network with DNS, and the service key `db` becomes a resolvable hostname. No IP addresses, ever (see 5.5).

---

## 5.4 `depends_on` and Health Checks — "Started" Is Not "Ready"

This is the most important concept in the whole phase, and the one that bites every newcomer in production.

### The naive form

```yaml
services:
  api:
    depends_on:
      - db        # short form: "start db before api"
  db:
    image: postgres:16
```

This *looks* like it solves startup ordering. It does — but only the wrong half of the problem. The short `depends_on` (and `condition: service_started`) guarantees only that **the db container has been created and its process has started.** It says **nothing** about whether Postgres inside that container is ready to accept TCP connections.

```
Timeline of a Postgres container starting
──────────────────────────────────────────────────────────────────────
t=0.0s  container process STARTS        ◄── service_started is satisfied HERE
t=0.1s  postgres binary launches
t=0.4s  reads config, initializes WAL
t=1.5s  (first run) initdb: creates the data directory, runs init scripts
t=3.0s  binds to 0.0.0.0:5432, starts ACCEPTING CONNECTIONS  ◄── actually READY here
        └────────────────────────────────────────────────┘
              this gap is where your API crashes:
              "ECONNREFUSED" / "the database system is starting up"
```

Your API, started at t=0.1s because the container "started", tries to connect at t=0.2s, gets `ECONNREFUSED`, and crashes. On a fast laptop you might get lucky and never see it; in CI or on a cold server you'll see it constantly. **"The container started" and "the service inside it is ready" are different events, often seconds apart.**

### The fix: `condition: service_healthy`

Give the dependency a **healthcheck**, then make the dependent wait for *health*, not *start*:

```yaml
services:
  api:
    image: myorg/myapi:1.4.2
    depends_on:
      db:
        condition: service_healthy   # ◄── wait for db's HEALTHCHECK to pass
      redis:
        condition: service_healthy

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    healthcheck:
      # pg_isready returns 0 ONLY when Postgres is actually accepting connections.
      # -U / -d narrow the check to the real user+db, not just "is the port open".
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s   # don't count failures during the first 10s (initdb etc.)

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]   # returns "PONG" + exit 0 when ready
      interval: 5s
      timeout: 3s
      retries: 5
```

Now Compose will not start `api` until `pg_isready` and `redis-cli ping` actually succeed. The race is gone.

### The three conditions

| Condition | Waits until... | Use for |
|---|---|---|
| `service_started` | dependency container has started (the default of the short form) | dependencies with no readiness concept, or where the app retries on its own |
| `service_healthy` | dependency's **healthcheck passes** | **databases, caches, brokers** — anything you must connect to |
| `service_completed_successfully` | dependency **ran and exited 0** | one-shot **init / migration** containers |

`service_completed_successfully` is the init-container pattern (you'll see it again in Phase 6):

```yaml
services:
  migrate:                          # runs migrations ONCE, then exits 0
    image: myorg/myapi:1.4.2
    command: ["npx", "prisma", "migrate", "deploy"]
    depends_on:
      db:
        condition: service_healthy  # don't migrate until DB accepts connections

  api:
    image: myorg/myapi:1.4.2
    depends_on:
      migrate:
        condition: service_completed_successfully  # don't serve until migrated
      db:
        condition: service_healthy
```

### Defense in depth: don't rely on Compose alone

`depends_on` only orders startup. It does **not** restart your API if the DB later goes down and connections drop. A robust app should *also* retry its connections with backoff at the application layer. `condition: service_healthy` removes the boot-time race; application-level retries handle the steady-state. Use both.

> Mental model: `service_started` = "the lights are on." `service_healthy` = "someone answered the phone." You want the phone answered before you start talking.

---

## 5.5 Networks in Compose

### The default network — free DNS

When you run `docker compose up`, Compose **automatically creates one network** for the project and attaches every service to it. The huge payoff: **service names become DNS hostnames.**

```
Default network (auto-created, named "<project>_default")
──────────────────────────────────────────────────────────
        ┌──────────────────────────────────────────┐
        │           myapp_default (bridge)          │
        │                                            │
        │   [api]  [db]  [redis]  [nginx]            │
        │     │      │      │        │               │
        │     └──────┴──────┴────────┘               │
        │      all can resolve each other by         │
        │      SERVICE NAME via embedded DNS         │
        └──────────────────────────────────────────┘

  Inside `api`:   ping db      -> resolves to db container's IP
                  curl redis:6379, postgres://...@db:5432, etc.
```

You never hardcode IPs. `db`, `redis`, `nginx` are hostnames. This is why `DATABASE_URL=postgres://app:secret@db:5432/appdb` in 5.3 works.

### Custom networks — isolation between tiers

Sometimes you want a service to be **unreachable** from another. Classic example: the database should be reachable from the API but not directly from the public-facing edge. Define explicit networks and attach services selectively.

```yaml
networks:
  frontend: {}     # public-facing tier
  backend: {}      # internal tier (db, cache)

services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["80:80"]
    networks:
      - frontend        # nginx is the only thing the outside world hits
      - backend         # ...and it can also reach the api on the backend

  api:
    networks:
      - backend         # NOT on frontend — only reachable via nginx

  db:
    image: postgres:16
    networks:
      - backend         # db is on backend ONLY

  redis:
    image: redis:7-alpine
    networks:
      - backend
```

```
Two-tier isolation
──────────────────────────────────────────────────────────
  Internet
     │  :80
     ▼
 ┌────────┐         frontend network
 │ nginx  │◄────────────────────────────
 └───┬────┘
     │            backend network (db & redis live ONLY here)
     ▼        ┌──────────────────────────────────┐
 ┌────────┐   │  [api]   [db]   [redis]           │
 │  api   │───┤    can talk to db/redis,           │
 └────────┘   │    but db/redis are NOT on         │
              │    frontend, so the edge can't     │
              │    reach them directly             │
              └──────────────────────────────────┘
```

Useful extras:

```yaml
networks:
  backend:
    internal: true     # NO external/internet access at all — fully isolated
  legacy:
    name: shared-net   # join a PRE-EXISTING network by its real name...
    external: true     #   ...that Compose did NOT create (don't try to manage it)
```

A service can also advertise extra DNS names:

```yaml
services:
  db:
    networks:
      backend:
        aliases:
          - postgres    # now reachable as BOTH "db" and "postgres" on backend
```

---

## 5.6 Volumes in Compose

Volumes are how data **survives** a container being destroyed (`docker compose down`, image upgrades, crashes). Three kinds appear in Compose:

```yaml
volumes:               # top-level: declare NAMED, Docker-managed volumes
  pgdata: {}           # Compose creates "myapp_pgdata"
  redisdata: {}
  uploads:
    driver: local      # default driver; can be NFS/cloud for shared storage

services:
  db:
    image: postgres:16
    volumes:
      # 1) NAMED volume  ── persistent, Docker-managed. USE THIS for databases.
      - pgdata:/var/lib/postgresql/data

  api:
    volumes:
      # 2) BIND mount  ── host path : container path. Great for dev hot-reload,
      #    injecting config. Bad for prod data (tied to a specific host path).
      - ./src:/app/src
      - ./config/app.yaml:/app/config/app.yaml:ro   # :ro = read-only

      # 3) ANONYMOUS volume ── no host side, no name. Used to "shadow" a path
      #    inside a bind mount so the host doesn't overwrite it (node_modules).
      - /app/node_modules
```

```
short syntax:   SOURCE : TARGET : OPTIONS
                  │        │        │
  pgdata ─────────┘        │        └─ ro  (read-only), z/Z (SELinux), etc.
  (named volume)           └─ mount point inside the container
```

Named vs bind — the rule of thumb:

| | Named volume | Bind mount |
|---|---|---|
| Location | Docker-managed (`/var/lib/docker/volumes/`) | A path you choose on the host |
| Portable | Yes (backup/restore, move) | No (tied to host layout) |
| Best for | **DB data, persistent state** | **dev source mounts, config files** |
| Survives `down` | Yes | Yes (it's just a host dir) |
| Survives `down -v` | **No** — `-v` deletes named volumes | Yes (host dir untouched) |

Long syntax (more explicit, preferred in serious files):

```yaml
services:
  db:
    volumes:
      - type: volume
        source: pgdata
        target: /var/lib/postgresql/data
      - type: bind
        source: ./config
        target: /app/config
        read_only: true
```

> Gotcha: `docker compose down` keeps named volumes. `docker compose down -v` **deletes them** — that's how you nuke your dev database. Muscle-memory `down -v` has destroyed many a local dataset.

---

## 5.7 Profiles — Optional Services

Profiles let you keep optional services (admin UIs, mail catchers, debug tools) in the **same file** without starting them every time. A service with a `profiles:` list is **inert** unless that profile is explicitly activated.

```yaml
services:
  api:
    image: myorg/myapi:1.4.2
    # no `profiles:` → ALWAYS starts (part of the "core" stack)

  db:
    image: postgres:16
    # no profile → core

  pgadmin:                       # DB admin UI — only when you want it
    image: dpage/pgadmin4
    profiles: ["tools"]          # tagged with the "tools" profile
    ports: ["5050:80"]

  redis-commander:               # Redis GUI — also a dev tool
    image: rediscommander/redis-commander
    profiles: ["tools"]
    ports: ["8081:8081"]

  smtp:                          # mail catcher for testing emails
    image: axllent/mailpit
    profiles: ["debug"]
    ports: ["8025:8025"]
```

```bash
docker compose up -d
# starts: api, db, redis  (everything with NO profile)
# skips:  pgadmin, redis-commander, smtp

docker compose --profile tools up -d
# starts: core services + pgadmin + redis-commander
# skips:  smtp (it's on the "debug" profile, not "tools")

docker compose --profile tools --profile debug up -d
# starts: EVERYTHING

# You can also activate via env var:
COMPOSE_PROFILES=tools,debug docker compose up -d
```

```
Profile gating
──────────────────────────────────────────────
  no profile      ─► always started  (core)
  profiles:[tools]─► started ONLY if "tools" active
  profiles:[debug]─► started ONLY if "debug" active

  Note: a service in a profile that ISN'T active is invisible — even as a
  `depends_on` target. If `api` depends on a profiled service, activating
  `api` pulls that service's profile in automatically.
```

The win: one file describes the full toolbox, but `docker compose up` stays lean and fast. No more commented-out blocks or a separate `compose.tools.yaml`.

---

## 5.8 Override Files — base + override + prod

Compose merges multiple files so you can keep a **shared base** and layer **environment-specific** tweaks on top. By default, Compose automatically reads two files if present:

```
compose.yaml              ← base: things true in EVERY environment
  + compose.override.yaml ← auto-merged on top (intended for LOCAL DEV)
  ───────────────────────
  = effective config for `docker compose up`
```

`compose.override.yaml` is loaded **automatically** with no `-f` flags. That's the convention: base file is production-shaped and committed, the override adds dev conveniences (source bind mounts, exposed debug ports, `build` instead of `image`, looser limits).

```yaml
# ── compose.yaml (BASE — minimal, production-shaped) ───────────────────────
services:
  api:
    image: myorg/myapi:1.4.2     # base assumes a prebuilt, tagged image
    restart: unless-stopped
    environment:
      NODE_ENV: production
    depends_on:
      db: { condition: service_healthy }
  db:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata: {}
```

```yaml
# ── compose.override.yaml (DEV — auto-merged) ──────────────────────────────
services:
  api:
    build: .                     # dev BUILDS locally instead of pulling
    environment:
      NODE_ENV: development       # override the base value
    ports:
      - "3000:3000"               # expose to host for local browsing
      - "127.0.0.1:9229:9229"     # debugger port
    volumes:
      - ./src:/app/src            # hot-reload source
      - /app/node_modules         # shadow node_modules
    command: ["npm", "run", "dev"]
  db:
    ports: ["5432:5432"]          # expose DB to host GUI tools in dev only
```

```yaml
# ── compose.prod.yaml (PROD — applied EXPLICITLY, never auto-loaded) ────────
services:
  api:
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    # NOTE: no source mounts, no debug port — prod stays locked down.
```

How the commands map to files:

```bash
# DEV (default): base + override are BOTH auto-loaded
docker compose up -d
#   == docker compose -f compose.yaml -f compose.override.yaml up -d

# PROD: you must name files EXPLICITLY. Naming any -f disables the auto-override.
docker compose -f compose.yaml -f compose.prod.yaml up -d

# Inspect the final MERGED result (invaluable for debugging override logic):
docker compose -f compose.yaml -f compose.prod.yaml config
```

### Merge semantics — the part people get wrong

When two files define the same service, Compose merges field by field:

```
Scalars (image, command, restart, a single env value)  ─► LAST file WINS (replace)
Mappings (environment:, labels:)                        ─► merged key-by-key
Sequences (ports:, volumes:, command-as-array)          ─► APPENDED, not replaced
```

The sequence rule surprises people: if base has `ports: ["80:80"]` and the override has `ports: ["8080:80"]`, you get **both**, not the override alone. To truly replace a list you must either restructure or use the `!reset` / `!override` tags (newer Compose). When in doubt, run `docker compose ... config` and read the merged output.

---

## 5.9 Essential Compose Commands

```bash
# ── BRINGING THE STACK UP ──────────────────────────────────────────────────
docker compose up                 # start everything, ATTACHED (logs stream, Ctrl-C stops)
docker compose up -d              # start DETACHED (background) — the usual way
docker compose up -d --build      # rebuild images first, then start
docker compose up -d api          # start ONLY the `api` service (+ its deps)
docker compose up -d --no-deps api  # start `api` WITHOUT touching its dependencies
docker compose up -d --force-recreate  # recreate containers even if config unchanged

# ── TEARING IT DOWN ────────────────────────────────────────────────────────
docker compose down               # stop + REMOVE containers and the default network
docker compose down -v            # ALSO delete named volumes  ⚠ destroys DB data
docker compose down --rmi all     # also remove images built/used by the stack
docker compose stop               # stop containers but KEEP them (faster restart)
docker compose start              # start previously-stopped containers

# ── INSPECTION ─────────────────────────────────────────────────────────────
docker compose ps                 # status of services (running? healthy? ports?)
docker compose ps -a              # include stopped/exited containers
docker compose top                # processes running inside each service
docker compose config             # validate + print the fully MERGED config (lint!)
docker compose config --services  # just list service names

# ── LOGS ───────────────────────────────────────────────────────────────────
docker compose logs               # all services, interleaved
docker compose logs api           # just the api service
docker compose logs -f api        # FOLLOW (tail -f) api logs
docker compose logs --tail=100 -f api   # last 100 lines, then follow

# ── EXECUTING THINGS ───────────────────────────────────────────────────────
docker compose exec api sh        # shell INTO the ALREADY-RUNNING api container
docker compose exec db psql -U app -d appdb   # run psql inside the db container
docker compose run --rm api sh    # NEW one-off container, removed on exit
docker compose run --rm api npm test   # run a one-off command (deps started too)
#   exec  = step into a running container   |   run = spin up a fresh one

# ── IMAGES & BUILDS ────────────────────────────────────────────────────────
docker compose build              # build all images (respecting build: blocks)
docker compose build --no-cache api  # rebuild api from scratch
docker compose pull               # pull latest of all `image:` services
docker compose push               # push built images to their registries

# ── DAY-TO-DAY ─────────────────────────────────────────────────────────────
docker compose restart api        # restart one service
docker compose stop api           # stop one service
docker compose rm api             # remove a stopped service's container
docker compose --profile tools up -d   # include profiled services (see 5.7)
docker compose -f compose.yaml -f compose.prod.yaml up -d   # explicit files (5.8)
docker compose watch              # auto-sync/rebuild on file changes (v2.22+, Phase 6)
```

```
exec  vs  run  — the distinction that confuses everyone
─────────────────────────────────────────────────────────
docker compose exec api sh   →  attach a shell to the api container that is
                                ALREADY running. Same process namespace, same
                                env, same mounts. Use to debug a live service.

docker compose run --rm api sh → create a BRAND-NEW throwaway container from the
                                api image, run sh in it, delete it on exit.
                                Use for one-offs: migrations, REPLs, test runs.
                                Does NOT reuse the running container.
```

---

## A Complete, Realistic Example: Node.js API + Postgres + Redis + Nginx

This is the Phase 5 target stack. Read the comments — every line earns its place.

```yaml
# compose.yaml — Node API behind Nginx, with Postgres + Redis,
#                two-tier networking, health checks everywhere,
#                and optional admin tools behind a profile.

name: shop

services:
  # ── EDGE: Nginx reverse proxy — the ONLY thing exposed to the host ─────────
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"                       # public entrypoint
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro   # proxy_pass -> api:3000
    depends_on:
      api:
        condition: service_healthy    # don't accept traffic until api is healthy
    networks:
      - frontend
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  # ── APP: the Node.js API ───────────────────────────────────────────────────
  api:
    build:
      context: .
      target: runtime               # multi-stage prod target (Phase 2)
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: postgres://app:secret@db:5432/appdb  # host = service name "db"
      REDIS_URL: redis://redis:6379                       # host = service name
    depends_on:
      db:
        condition: service_healthy   # wait for Postgres to ACCEPT CONNECTIONS
      redis:
        condition: service_healthy   # wait for Redis to answer PING
    networks:
      - backend                      # NOT on frontend → only reachable via nginx
    restart: unless-stopped
    init: true                       # tini reaps zombies + forwards SIGTERM
    stop_grace_period: 30s           # let in-flight requests drain
    healthcheck:
      # The app's /health should check DB + Redis connectivity, not just "200 OK".
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }

  # ── DATA: PostgreSQL ────────────────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret      # dev only! use secrets in prod (Phase 7)
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume → data survives `down`
    networks:
      - backend                      # internal tier only — no host port published
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]   # 0 only when READY
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s

  # ── CACHE: Redis ──────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    volumes:
      - redisdata:/data
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]   # "PONG" + exit 0 when ready
      interval: 5s
      timeout: 3s
      retries: 5

  # ── OPTIONAL TOOLS (start with: docker compose --profile tools up -d) ───────
  pgadmin:
    image: dpage/pgadmin4
    profiles: ["tools"]
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@example.com
      PGADMIN_DEFAULT_PASSWORD: dev
    ports: ["5050:80"]
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend

  redis-commander:
    image: rediscommander/redis-commander:latest
    profiles: ["tools"]
    environment:
      REDIS_HOSTS: local:redis:6379    # "redis" = service-name DNS again
    ports: ["8081:8081"]
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - backend

networks:
  frontend: {}                       # public tier (nginx only)
  backend:
    internal: false                  # set true to fully isolate (no egress)

volumes:
  pgdata: {}                         # Postgres data — survives container removal
  redisdata: {}                      # Redis persistence
```

```
The running stack
──────────────────────────────────────────────────────────────────────
                      Internet :80
                          │
                          ▼
                   ┌─────────────┐   frontend network
                   │   nginx     │◄──────────────────
                   └──────┬──────┘
                          │ proxy_pass http://api:3000
                          ▼            backend network
   ┌──────────────────────────────────────────────────────────────┐
   │   ┌────────┐      ┌──────────┐      ┌─────────┐                │
   │   │  api   │─────►│   db     │      │  redis  │                │
   │   │        │─────────────────────► │         │                │
   │   └────────┘      └──────────┘      └─────────┘                │
   │      ▲  waits for db (service_healthy) + redis (service_healthy)│
   │      │  before it starts; nginx waits for api to be healthy     │
   │   (pgadmin, redis-commander attach here only with --profile tools)│
   └──────────────────────────────────────────────────────────────┘
   Persisted: pgdata, redisdata  (named volumes, survive `down`)
```

A minimal companion `nginx.conf` so the example actually runs:

```nginx
# nginx.conf
server {
    listen 80;

    location /healthz { return 200 "ok\n"; }   # nginx's own health endpoint

    location / {
        proxy_pass http://api:3000;             # "api" = Compose service-name DNS
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Common Mistakes

- **Leaving `version: "3.8"` at the top.** That's v1 schema. In `docker compose` (v2) it's obsolete and triggers a warning. Delete it and add `name:` instead.

- **Using `docker-compose` (hyphen) for new projects.** It's the deprecated v1 binary. Use `docker compose` (space). Mixing tutorials across the two is a top source of "works for them, not for me."

- **Trusting bare `depends_on` to mean "ready."** `depends_on: [db]` (or `condition: service_started`) only waits for the container to *start*, not for Postgres to accept connections. Your API connects too early and crashes with `ECONNREFUSED`. Use `condition: service_healthy` with a real healthcheck (`pg_isready`), and *also* retry at the app layer. This is the #1 Compose bug.

- **A healthcheck that lies.** `test: ["CMD", "true"]` or pinging the wrong port reports "healthy" while the service is broken. For Postgres use `pg_isready -U <user> -d <db>` (not just a TCP check); for an API, hit a `/health` route that actually verifies downstream connections.

- **Forgetting `start_period`.** Without it, slow-booting services (Postgres `initdb`, a JIT-warming app) rack up failed checks during startup and get marked unhealthy before they ever had a chance. `start_period` is a grace window where failures don't count.

- **`container_name` + scaling.** A fixed `container_name` means only one container can exist for that service. `docker compose up --scale api=3` then fails with a name conflict. Omit `container_name` and let Compose auto-name (`shop-api-1`, `-2`, `-3`).

- **`docker compose down -v` muscle memory.** `-v` deletes named volumes — i.e., your local database. People type it reflexively to "clean up" and lose their seed data. Use plain `down` unless you truly want to wipe data.

- **Bind-mounting over `node_modules`.** `- ./:/app` clobbers the `node_modules` that were installed in the image with the (empty or host-OS) version from your machine. Add an anonymous volume `- /app/node_modules` after the source mount to shadow it.

- **Expecting `expose:` to publish to the host.** `expose:` only documents a port to other containers (which can already reach each other anyway). To reach a service from your browser you need `ports:` (`"3000:3000"`).

- **Publishing the database to the host in production.** `ports: ["5432:5432"]` on `db` exposes Postgres to anything that can reach the host. Keep databases on an internal network with no `ports:`; only the edge (nginx) should publish.

- **Assuming all of `deploy:` works under Compose.** `deploy.resources.limits` is honored by `docker compose up`, but `deploy.replicas`, `deploy.update_config`, etc. are **Swarm-only** and silently ignored. To scale locally use `--scale`, not `replicas`.

- **Expecting override lists to replace, not append.** `ports:`/`volumes:` from an override file are **appended** to the base file's lists, not substituted. Run `docker compose ... config` to see the true merged result before you're surprised in prod.

- **Naming any `-f` file and expecting `compose.override.yaml` to still load.** The auto-load of the override file only happens when you pass *no* `-f`. The moment you do `-f compose.yaml -f compose.prod.yaml`, the override is **not** included — which is exactly what you want for prod, but a gotcha if you didn't intend it.

---

## Phase 5 Exercise

**Task (from the plan):** Write a Compose file for a **Node.js API + PostgreSQL + Redis + Nginx (reverse proxy)**. Add **health checks to all services**. Use **profiles** to add **pgAdmin** and **Redis Commander** as optional tools.

Build it in `examples/phase5-compose-stack/`.

**Concrete steps & hints:**

1. **Scaffold the directory.**
   ```
   examples/phase5-compose-stack/
   ├── compose.yaml
   ├── compose.override.yaml      # dev: build, ports, source mount
   ├── nginx.conf
   ├── .env.example               # commit this, NOT .env
   ├── Dockerfile                 # tiny Node API (or reuse Phase 2's)
   └── src/                       # a trivial Express/Fastify app
   ```

2. **The API** can be a 30-line Express app exposing `/` and `/health`. Make `/health` actually check the DB and Redis (e.g. `SELECT 1` and `PING`) so the healthcheck is honest — that's the whole point of the exercise.

3. **Wire startup ordering correctly.** `api.depends_on` → `db: service_healthy` AND `redis: service_healthy`. `nginx.depends_on` → `api: service_healthy`. Prove to yourself the race exists: temporarily change the db dependency to `condition: service_started`, add an artificial delay, and watch the API crash on first connect. Then switch back to `service_healthy` and confirm it's gone.

4. **Health checks for each:**
   - `db`: `pg_isready -U <user> -d <db>` (use `CMD-SHELL`)
   - `redis`: `redis-cli ping`
   - `api`: hit your `/health` route (return non-200 if DB/Redis are down)
   - `nginx`: `wget -qO- http://localhost/healthz`
   - Give the slow ones a `start_period`.

5. **Two-tier networking.** Put `db` and `redis` on a `backend` network with **no published ports**. Put `nginx` on both `frontend` and `backend`. Confirm from your host that `localhost:80` works but `localhost:5432` does **not** (`docker compose exec api sh` → you *can* reach `db:5432` from inside).

6. **Profiles.** Tag `pgadmin` and `redis-commander` with `profiles: ["tools"]`. Verify:
   ```bash
   docker compose up -d                  # tools NOT started
   docker compose ps                     # confirm 4 services, no pgadmin
   docker compose --profile tools up -d  # pgadmin + redis-commander appear
   ```
   Open pgAdmin at `localhost:5050` and connect to host `db` (service-name DNS), and Redis Commander at `localhost:8081`.

7. **Persistence check.** Insert a row, `docker compose down` (no `-v`), `up -d` again — data should survive (named volume). Then `down -v` and confirm it's gone. Feel the difference.

8. **Validate before you run.** `docker compose config` to see the merged dev config; `docker compose -f compose.yaml config` to see the prod-shaped base alone. Compare them and make sure the override only adds dev conveniences.

**Stretch goals:**
- Add a `migrate` service using `condition: service_completed_successfully` so the API waits for migrations to finish (the init-container pattern from 5.4).
- Add a `compose.prod.yaml` with resource limits + log rotation and bring the stack up the "explicit files" way.
- Add `COMPOSE_PROFILES=tools` to a local `.env` and confirm tools start without the CLI flag.
