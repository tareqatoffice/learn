# Phase 6 — Development Workflows

The point of this phase: stop treating containers as "build once, run in prod" artifacts and start using them as your **actual development environment**. The end state is that your code, your runtime, your database, and your tooling all live in containers — and editing a file on your host instantly reflects inside the running container without a rebuild.

If you've done frontend work, the mental model is: this is `vite dev` / `next dev` hot-reload, but the dev server is running inside a container and the files are being shuttled in from your host. Most of the friction in this phase comes from the boundary between **host filesystem** and **container filesystem** — get that boundary right and everything else is easy.

---

## 6.1 Hot Reload in Containers

### The core idea

In production you `COPY . .` into the image at build time — the code is *baked in*. To change code you rebuild the image. That's correct for prod and miserable for dev (rebuild on every keystroke).

For dev you invert it: **don't bake the code in — mount it in at runtime** with a bind mount, and run a file-watcher inside the container that restarts/reloads the process when files change.

```
PRODUCTION                          DEVELOPMENT
┌────────────────────┐              ┌────────────────────┐
│ image layer:       │              │ container fs:      │
│   /app/src  (baked)│              │   /app/src ────────┼──► bind-mounted
│   immutable        │              │   from host ./src  │    from host
└────────────────────┘              └────────────────────┘
   rebuild to change                   edit on host → watcher reloads
```

Two pieces are required together:

1. **A bind mount** — maps your host source directory into the container (`./src` → `/app/src`). Covered in Phase 4. This is what makes host edits visible inside the container.
2. **A file watcher inside the container** — `nodemon` / `ts-node-dev` for Node, `dotnet watch` for .NET. This is what actually restarts the process when a mounted file changes.

A bind mount with no watcher = changes are visible but the process never picks them up. A watcher with no bind mount = the watcher never sees your edits because the container has the baked-in copy. You need both.

### Node.js — nodemon and ts-node-dev

`nodemon` watches files and restarts `node` on change. `ts-node-dev` does the same but for TypeScript, compiling on the fly and keeping the process warm between restarts (faster than `nodemon + ts-node`).

```jsonc
// package.json — dev scripts
{
  "scripts": {
    // Plain JS: nodemon restarts `node src/index.js` on any change under watched dirs
    "dev": "nodemon src/index.js",

    // TypeScript: ts-node-dev recompiles + restarts; --respawn keeps watching after a crash,
    // --transpile-only skips type-checking for speed (tsc/your editor still type-checks)
    "dev:ts": "ts-node-dev --respawn --transpile-only src/index.ts"
  }
}
```

```jsonc
// nodemon.json — optional config (otherwise pass flags on the CLI)
{
  "watch": ["src"],            // only watch src/ — not node_modules, not dist
  "ext": "ts,js,json",         // file extensions that trigger a restart
  "ignore": ["**/*.test.ts"],  // don't restart on test-file edits
  "exec": "node --inspect=0.0.0.0:9229 -r ts-node/register src/index.ts"
}
```

```yaml
# docker-compose.yml (or docker-compose.override.yml for dev-only) — Node hot reload
services:
  api:
    build:
      context: .
      target: dev            # multi-stage: a "dev" stage that installs devDeps + nodemon
    command: npm run dev:ts  # override the image's prod CMD with the watcher
    volumes:
      - ./:/app              # bind-mount the whole project so edits are visible
      - /app/node_modules    # <-- the anonymous-volume trick (explained below)
    ports:
      - "3000:3000"
```

### The `node_modules` shadowing problem — and the anonymous volume trick

This is the single most important thing in 6.1. It bites everyone exactly once and then never again.

**Why mounting source over the container shadows `node_modules`:**

A bind mount doesn't *merge* the host directory with the container directory — it **replaces** it. When you mount `./` (your host project) onto `/app` (the container's app dir), the container's `/app` now shows *exactly* what's on your host at `./`, and **nothing else**. The container's original `/app` contents are hidden underneath the mount, like sliding a sheet of paper over a desk — the desk is still there, you just can't see it.

Here's the failure in sequence:

```
1. Dockerfile build:   RUN npm ci  →  installs deps into  /app/node_modules  (inside image)
2. docker compose up:  volume ./:/app  →  mounts HOST ./ over /app
3. Result:             /app/node_modules now shows the HOST's node_modules
```

Now the problem branches into two common cases, both broken:

- **You have no `node_modules` on the host** (clean checkout, or you `.dockerignore`d it). The mount makes `/app/node_modules` empty → the app crashes with `Cannot find module 'express'`. The deps you carefully installed in step 1 are *still there in the image layer underneath*, but the mount hides them.
- **You DO have a host `node_modules`** (you ran `npm install` locally). The mount makes the container use your **host-built** modules. These were compiled against your host OS/arch (e.g. macOS arm64, or Windows), but the container is Linux. Native modules (`bcrypt`, `sharp`, `esbuild`, `better-sqlite3`, anything with a `.node` binary) will be the wrong binary → `invalid ELF header` / segfaults / "was compiled against a different Node.js version".

**The fix — an anonymous volume on `node_modules`:**

```yaml
volumes:
  - ./:/app              # mount #1: host source onto /app
  - /app/node_modules    # mount #2: anonymous volume — NO host path before the colon
```

Mount #2 is a **volume mount with only a container path and no source**. Docker creates an anonymous (Docker-managed) volume and mounts it at `/app/node_modules`. Mount points are resolved most-specific-path-wins, so `/app/node_modules` (deeper) takes precedence over `/app` (shallower) for that subtree.

What actually happens, step by step:

```
- Mount ./:/app                  → /app reflects host source
- Mount <anon>:/app/node_modules → carves out /app/node_modules from the host mount

  On the volume's FIRST use, Docker COPIES the image's existing /app/node_modules
  (the one `npm ci` built during the image build) INTO the empty anonymous volume.

  Net effect:
    /app            = your live host source        (edit → watcher reloads)
    /app/node_modules = the container-built deps    (correct Linux/arch binaries, host can't shadow them)
```

So you get the best of both: **source is live-mounted from the host**, but **`node_modules` comes from inside the container** and is immune to host shadowing. The "copy image contents into a fresh anonymous volume" behavior is specific to *volume* mounts (named or anonymous) — bind mounts never do this copy, which is exactly why the bare bind mount fails.

> Gotcha: this copy-on-first-use only happens when the anonymous volume is **empty**. If you change dependencies (`package.json`) and rebuild the image, the *old* anonymous volume still has the *old* `node_modules` and won't be refreshed. Fix: `docker compose down -v` (removes anonymous volumes) then `up`, or use a named volume you can target explicitly, or rely on Compose Watch `rebuild` (§6.6).

> The named-volume variant: `- node_modules:/app/node_modules` with a top-level `volumes: { node_modules: }`. Same mechanics, but the volume has a stable name so you can inspect/remove it deliberately instead of it being a random hash.

### .NET — `dotnet watch`

`dotnet watch` is the .NET equivalent of `nodemon`: it watches source files and, on change, recompiles and restarts (or hot-reloads) the app. For an ASP.NET Core API this is `dotnet watch run`.

```yaml
# docker-compose.override.yml — .NET hot reload
services:
  api:
    build:
      context: .
      target: dev
    # `dotnet watch run` recompiles + restarts on .cs/.cshtml change.
    # DOTNET_USE_POLLING_FILE_WATCHER is the .NET analogue of nodemon's legacyWatch —
    # required when inotify events don't cross the host→container boundary (common on
    # Docker Desktop / bind mounts on macOS & Windows).
    command: dotnet watch run --project ./src/MyApi
    environment:
      DOTNET_USE_POLLING_FILE_WATCHER: "true"
      DOTNET_WATCH_RESTART_ON_RUDE_EDIT: "true"  # restart if a change can't be hot-applied
      ASPNETCORE_ENVIRONMENT: Development
    volumes:
      - ./:/src                 # mount source
      - /src/bin                # anonymous volume — keep container's compiled output
      - /src/obj                # anonymous volume — keep container's intermediate build files
    ports:
      - "8080:8080"
```

The `bin/` and `obj/` anonymous volumes are the **exact same trick** as `node_modules`: `bin/obj` are build outputs compiled *inside the Linux container*; you don't want your host's `bin/obj` (possibly built on Windows/macOS, or stale) shadowing them. Carve them out with anonymous volumes for the same reason.

### File watching across the host/container boundary — polling

Native file-change notifications (`inotify` on Linux) don't always propagate across the virtualization layer Docker Desktop uses on macOS and Windows. If your watcher just doesn't fire on host edits, switch it to **polling mode** (it stats files on an interval instead of waiting for kernel events):

```bash
# nodemon
nodemon --legacy-watch src/index.js          # or "legacyWatch": true in nodemon.json

# chokidar-based tools (vite, many others) read this env var
CHOKIDAR_USEPOLLING=true

# .NET
DOTNET_USE_POLLING_FILE_WATCHER=true
```

Polling costs more CPU (it's a busy loop of `stat()` calls), so only enable it if event-based watching genuinely doesn't work. On native Linux (no Docker Desktop VM) you usually don't need it.

---

## 6.2 Environment Management

Compose deals with environment variables in **two completely different places** that beginners constantly conflate. Getting this distinction right is most of the battle.

### The two worlds: substitution vs injection

```
WORLD 1 — Variable substitution INTO the YAML (build/parse time)
  Source: a file literally named `.env` in the same dir as the compose file
  Used for: ${VAR} placeholders inside docker-compose.yml itself
  Audience: Compose (the tool), NOT your app

WORLD 2 — Variables injected INTO the container (runtime)
  Source: `environment:` (inline) and `env_file:` (a file you point at)
  Used for: the env vars your application process actually reads
  Audience: your app (process.env / Environment.GetEnvironmentVariable)
```

These are not the same `.env`. The auto-loaded `.env` (World 1) fills in `${...}` in the YAML. It does **not** automatically end up inside your container unless you also wire it through with `env_file:` or `environment:`.

### World 1 — the auto-loaded `.env` (substitution)

```bash
# .env  (sits next to docker-compose.yml — auto-discovered, no config needed)
TAG=1.4.2
POSTGRES_PASSWORD=devsecret
API_PORT=3000
```

```yaml
# docker-compose.yml — ${...} placeholders are filled from the .env above
services:
  api:
    image: myapp:${TAG}              # → myapp:1.4.2
    ports:
      - "${API_PORT}:3000"           # → "3000:3000"
  db:
    image: postgres:16
    environment:
      # Here the .env value IS reaching the container, but only because we
      # explicitly referenced it. The .env didn't inject it automatically.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

```yaml
# Default values and required-checks in substitution:
services:
  api:
    image: myapp:${TAG:-latest}      # use "latest" if TAG is unset/empty
    environment:
      SECRET: ${SECRET:?must be set} # FAIL the command if SECRET is unset/empty
```

Verify what Compose actually resolved — this is the single most useful debugging command in this whole section:

```bash
docker compose config   # prints the fully merged + substituted YAML, with all ${...} resolved
```

### World 2 — `env_file:` and `environment:` (injection into the container)

```bash
# api.env — a file of KEY=VALUE pairs to inject into the API container
DATABASE_URL=postgres://app:devsecret@db:5432/app
LOG_LEVEL=debug
NODE_ENV=development
```

```yaml
services:
  api:
    env_file:
      - api.env                  # inject every KEY=VALUE from this file into the container
      - ./config/shared.env      # multiple files allowed; later files win on conflict
    environment:
      LOG_LEVEL: trace           # inline value — OVERRIDES LOG_LEVEL from api.env
      NODE_ENV: development       # inline values can also be ${substituted} from World 1
```

### Precedence — who wins when the same key is set in multiple places

From **highest** priority (wins) to **lowest**:

```
1. `docker compose run -e KEY=value`        # CLI flag on a one-off run — highest
2. Shell environment, IF referenced         # `environment: [KEY]` with no value pulls from your shell
3. `environment:` in the compose file       # inline values
4. `env_file:` in the compose file          # later files override earlier ones
5. ENV baked into the image (Dockerfile)    # lowest — the fallback default
```

```yaml
services:
  api:
    environment:
      # Two syntaxes:
      LOG_LEVEL: debug    # KEY: value  → sets it explicitly
      - HOME              # bare KEY (list syntax) → "pass through whatever HOME is in my shell"
```

Mental model: the closer the definition is to the specific container invocation, the higher it ranks. CLI beats file beats image. The Dockerfile `ENV` is just the last-resort default if nobody overrides it.

### Never commit `.env` — commit `.env.example`

Real `.env` files hold secrets (DB passwords, API keys) and machine-specific values. They must be git-ignored. Instead commit a `.env.example` documenting *which* keys exist, with placeholder/dummy values:

```bash
# .gitignore
.env
*.env
!*.env.example      # but DO commit the examples
```

```bash
# .env.example  (committed — this is documentation + onboarding)
TAG=latest
API_PORT=3000
POSTGRES_PASSWORD=changeme          # placeholder, not a real secret
DATABASE_URL=postgres://app:changeme@db:5432/app
```

A new teammate runs `cp .env.example .env`, fills in real values, and is running. The example file doubles as the canonical list of every environment variable the project needs — keep it in sync when you add a new variable.

```bash
# Multiple environments — point Compose at a specific env file:
docker compose --env-file .env.staging up   # use .env.staging for World-1 substitution
```

---

## 6.3 Debugging Inside Containers

Two layers of debugging: (1) poke around the running container with a shell, and (2) attach a real step-through debugger to the process.

### Getting a shell inside a running container

```bash
# exec runs a NEW process inside an ALREADY-RUNNING container
docker compose exec api sh        # interactive shell (alpine images: sh, not bash)
docker compose exec api bash      # if the image has bash (debian/ubuntu-based)

# -it = interactive + allocate a TTY (you need both for a usable shell)
docker exec -it <container> sh

# Run a one-off command without an interactive shell:
docker compose exec api env                 # dump the container's actual env vars
docker compose exec api cat /etc/hosts      # what hostnames resolve inside the container
docker compose exec api node -e "console.log(process.env.DATABASE_URL)"
docker compose exec db psql -U app -d app   # straight into psql inside the db container
```

`exec` vs `run` — a distinction that matters:

```bash
docker compose exec api sh   # attaches to the EXISTING running container — see its real state
docker compose run --rm api sh
# ^ creates a brand-NEW throwaway container from the same service definition.
#   Different filesystem state, fresh process. --rm auto-deletes it on exit.
#   Use `run` when the service is crash-looping and won't stay up for `exec`.
```

If the container has no shell at all (distroless / scratch images), you can't `exec sh`. Options: temporarily swap to a debug image, or use `docker debug` (Docker Desktop) which injects a toolbox.

### Attaching a Node.js debugger — `--inspect=0.0.0.0:9229`

Node's V8 inspector listens on a TCP port (default `9229`) and speaks the Chrome DevTools Protocol. VS Code, Chrome DevTools, and `node --inspect`-aware clients connect to it. Two things must be true for it to work from outside the container:

```bash
# 1. Node must bind the inspector to 0.0.0.0, NOT the default 127.0.0.1
node --inspect=0.0.0.0:9229 dist/index.js
#              ^^^^^^^
# 127.0.0.1 inside the container = the container's OWN loopback, unreachable from the host.
# 0.0.0.0 = bind all interfaces so the host can connect through the published port.

# --inspect-brk pauses on the very first line until a debugger attaches
# (use when you need to debug startup code before it runs)
node --inspect-brk=0.0.0.0:9229 dist/index.js
```

```yaml
# docker-compose.override.yml — debug-enabled Node service
services:
  api:
    command: node --inspect=0.0.0.0:9229 dist/index.js
    # With a watcher: nodemon --inspect=0.0.0.0:9229 src/index.js
    ports:
      - "3000:3000"
      - "9229:9229"        # 2. PUBLISH the inspector port to the host
```

```jsonc
// .vscode/launch.json — attach VS Code to the in-container Node process
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",        // attach to a running process (not "launch")
      "name": "Attach to API in Docker",
      "address": "localhost",
      "port": 9229,               // matches the published port above
      "localRoot": "${workspaceFolder}",  // host path to your source
      "remoteRoot": "/app",                // container path where source lives
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

`localRoot`/`remoteRoot` are critical: the debugger gets file paths from the container (`/app/src/x.js`) but your breakpoints are set against host paths (`/Users/you/proj/src/x.js`). This pair maps between them so breakpoints actually bind. Mismatched roots = grey "unbound breakpoint" circles.

```bash
# One-off debug run of a crashing service:
docker compose run --rm -p 9229:9229 api node --inspect-brk=0.0.0.0:9229 dist/index.js
```

### Attaching a .NET debugger

ASP.NET Core debugging in containers normally goes through VS Code's C# Dev Kit / `vsdbg`, which the Dev Containers / Docker extension installs into the container for you. The plumbing is the same idea — the debugger connects to the dotnet process inside the container — but it's mostly handled by tooling rather than a raw published port. The `.NET` track covers `vsdbg` specifics; for Phase 6 the takeaway is: the *mechanism* (debugger client on host ↔ debuggee process in container) mirrors the Node `--inspect` flow.

---

## 6.4 Dev Containers (VS Code)

Hot reload solves "my code runs in a container." Dev Containers solve "my whole **editor + toolchain** runs against a container." VS Code opens the workspace *inside* the container: the language server, linters, extensions, terminal, and `node`/`dotnet` all execute in the container, not on your host. Your host needs nothing but Docker + VS Code.

This is the answer to "works on my machine" — the dev environment itself is version-controlled and reproducible.

```jsonc
// .devcontainer/devcontainer.json — standalone (build from an image/Dockerfile)
{
  "name": "Node API Dev",

  // Either reference an image, or build from a Dockerfile:
  "build": {
    "dockerfile": "../Dockerfile",
    "target": "dev"               // use the dev multi-stage target
  },

  // "Features" = composable add-ons injected into the container (no Dockerfile edits)
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "20" }
  },

  "forwardPorts": [3000, 9229],   // auto-forward these container ports to the host
  "postCreateCommand": "npm ci",  // run once after the container is created
  "remoteUser": "node",           // don't develop as root

  "customizations": {
    "vscode": {
      "extensions": [             // installed INTO the container automatically
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
      ],
      "settings": {
        "editor.formatOnSave": true
      }
    }
  }
}
```

### Dev Containers backed by Compose

When your app needs a database/redis alongside it, point the dev container at your existing Compose stack instead of a lone Dockerfile. VS Code attaches to *one* service; the rest of the stack comes up around it.

```jsonc
// .devcontainer/devcontainer.json — Compose-backed
{
  "name": "Full Stack Dev",
  "dockerComposeFile": [
    "../docker-compose.yml",
    "../docker-compose.override.yml"   // dev overrides merged in
  ],
  "service": "api",          // VS Code opens INSIDE this service's container
  "workspaceFolder": "/app", // the dir to open in the editor (matches your bind mount)
  "forwardPorts": [3000, 9229],
  "shutdownAction": "stopCompose"  // `docker compose down` when VS Code closes
}
```

The `api` service still gets its `depends_on: [db, redis]`, so opening the dev container brings up Postgres + Redis automatically. You edit `api` from inside its container, with `db` reachable at hostname `db` exactly as in §3 (Compose DNS).

```jsonc
// You may need to keep the dev container alive even though the prod CMD exits:
// in the compose override for the api service:
//   command: sleep infinity      // VS Code runs the real process; the container just needs to stay up
```

---

## 6.5 Init Containers Pattern (run-once, then exit)

Some work must happen **once, before** your app starts, and must **finish successfully** first — most commonly **database migrations**. You don't want every API replica racing to run migrations on boot. The pattern: a dedicated short-lived service that runs the task and exits, with the app gated on its successful completion.

This relies on the three `depends_on` conditions from Phase 5:

```
service_started               → container has started (NOT necessarily ready)
service_healthy               → its healthcheck is passing
service_completed_successfully→ the container ran and EXITED with code 0   ← init-container gate
```

```yaml
# docker-compose.yml — migrate-then-start (Node + Prisma)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: app
    healthcheck:
      # Don't run migrations until Postgres is actually ACCEPTING connections.
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 5

  migrate:
    build: .
    command: ["npx", "prisma", "migrate", "deploy"]  # runs pending migrations, then exits 0
    environment:
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/app
    depends_on:
      db:
        condition: service_healthy            # wait until Postgres is ready
    restart: "no"                              # one-shot — do NOT restart after it exits

  api:
    build: .
    command: node dist/index.js
    environment:
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/app
    depends_on:
      migrate:
        condition: service_completed_successfully  # start ONLY after migrate exits 0
      db:
        condition: service_healthy
    ports:
      - "3000:3000"
```

Startup ordering this produces:

```
db starts → db healthcheck passes
              ↓
            migrate runs `prisma migrate deploy` → exits 0
              ↓
            api starts (guaranteed: DB is up AND schema is migrated)
```

If `migrate` exits **non-zero** (a migration fails), `service_completed_successfully` is *not* met, so `api` never starts — exactly what you want. A broken migration shouldn't leave you with an API running against a half-migrated schema.

```yaml
# .NET EF Core variant — same pattern, different command:
  migrate:
    build: .
    command: ["dotnet", "ef", "database", "update"]   # apply EF Core migrations, then exit
    depends_on:
      db:
        condition: service_healthy
    restart: "no"
```

> Note: this is Compose's emulation of Kubernetes **initContainers**. In K8s, init containers are a first-class field on the Pod spec that must complete before app containers start — Phase 10 will map this over. The Compose version is "good enough" for single-host dev/deploy.

> `restart: "no"` matters: without it, a default/`always` restart policy makes a successfully-exited migrate container restart forever, which can confuse `service_completed_successfully` and waste resources.

---

## 6.6 Compose Watch (`develop.watch`)

Bind mounts + a watcher (§6.1) work, but have rough edges: native-module shadowing, polling CPU cost, and no clean way to say "for *this* change rebuild, for *that* change just copy the file." **Compose Watch** (Docker Compose v2.22+) is the purpose-built answer. You declare watch rules under `develop.watch`, run `docker compose watch`, and Compose monitors host paths and reacts per-rule.

### The three actions

```
sync         → copy changed files from host INTO the running container (no restart).
               For interpreted code where a watcher inside the container reloads it
               (nodemon/ts-node-dev). Fast — it's just a file copy into the container.

sync+restart → sync the files AND restart the container.
               For changes that need a process restart but not an image rebuild
               (e.g. a config file the app reads only at boot).

rebuild      → rebuild the image and recreate the container.
               For changes that invalidate the image: package.json / lockfile / Dockerfile.
```

```yaml
# docker-compose.yml — Compose Watch for a Node API
services:
  api:
    build:
      context: .
      target: dev
    command: npm run dev:ts     # ts-node-dev still runs inside; sync feeds it fresh files
    ports:
      - "3000:3000"
    develop:
      watch:
        # Source edits: copy into the container; the in-container watcher reloads. No rebuild.
        - action: sync
          path: ./src
          target: /app/src

        # Public assets: copy in, no restart needed.
        - action: sync
          path: ./public
          target: /app/public

        # Dependency change: must reinstall → rebuild the whole image.
        - action: rebuild
          path: package.json

        # Lockfile too — npm ci keys off it.
        - action: rebuild
          path: package-lock.json

        # A config the app reads once at startup: copy in AND restart the process.
        - action: sync+restart
          path: ./config/app.config.json
          target: /app/config/app.config.json
```

```bash
docker compose watch          # start watching (also brings the stack up)
docker compose up --watch     # equivalent: bring up + watch in one command
```

### Why Watch is often better than a raw bind mount for dev

```
Bind mount (./:/app)                 Compose Watch (sync)
- continuous 2-way mapping           - one-way push host → container on change
- needs node_modules anon-vol trick  - you choose exactly which paths sync (node_modules
- inotify may not cross the VM         simply isn't in the watch list, so it can't shadow)
  boundary → polling → CPU cost      - rebuild action handles dep changes automatically
- "rebuild on dep change" is manual   - declarative, per-path rules
```

With Watch you typically **don't bind-mount source at all** and **don't need the `node_modules` anonymous-volume trick** — because nothing is mounted over the container's `/app`. The image's `node_modules` stays intact; Watch just *copies your edited source files in* on top of it, and the `rebuild` rule rebuilds when deps change. The shadowing problem from §6.1 disappears because there's no bind mount doing the shadowing.

> Caveat: `sync` copies files but does not itself restart your process — you still need an in-container watcher (nodemon/ts-node-dev/`dotnet watch`) to pick up the synced files, OR use `sync+restart`. Watch moves the bytes; something still has to reload the process.

> `ignore:` under a watch rule lets you exclude paths (e.g. test files) from triggering. `target:` is required for `sync`/`sync+restart` (where the file lands) but not for `rebuild` (which rebuilds the whole image regardless).

---

## Common Mistakes

- **Bind-mounting source over `node_modules` without the anonymous-volume trick.** The #1 dev-Docker bug. You mount `./:/app`, the container's image-built `node_modules` gets shadowed by the host's (or by nothing), and you get `Cannot find module` or native-module ABI crashes. Always add `- /app/node_modules` (and `/app/bin`, `/app/obj` for .NET). See §6.1.

- **Expecting the auto-loaded `.env` to land inside the container.** The top-level `.env` does **substitution into the YAML** (`${VAR}`), not **injection into the container**. If your app can't see a variable, you forgot to wire it through `env_file:` or `environment:`. Run `docker compose config` to see what's actually resolved.

- **`--inspect` bound to `127.0.0.1`.** The default loopback bind is the *container's* loopback — unreachable from the host even with the port published. Must be `--inspect=0.0.0.0:9229`, and the port must be in `ports:`.

- **Debugger breakpoints stay grey/unbound.** `localRoot`/`remoteRoot` in `launch.json` don't match the host-source ↔ container-source mapping (`${workspaceFolder}` ↔ `/app`). The debugger can't map container file paths back to your local files.

- **Stale `node_modules` in the anonymous volume after a dependency change.** The image copies into the anon volume only when it's empty. Add a dep, rebuild, and the old volume still serves old modules. `docker compose down -v` then `up`, or use Compose Watch's `rebuild` action keyed on `package.json`.

- **File watcher silently never fires.** On Docker Desktop (macOS/Windows), `inotify` events often don't cross the VM boundary. Enable polling: `nodemon --legacy-watch`, `CHOKIDAR_USEPOLLING=true`, or `DOTNET_USE_POLLING_FILE_WATCHER=true`.

- **Init/migrate container restarts forever.** A one-shot migrate service with a default restart policy keeps relaunching after it exits 0. Set `restart: "no"`. Also gate it on `db` `condition: service_healthy`, not `service_started`, or it races the database before it accepts connections.

- **Gating the app on `migrate` with the wrong condition.** Use `service_completed_successfully` for init containers — `service_started`/`service_healthy` don't mean "the run-once task finished," and a healthcheck on a container that immediately exits is meaningless.

- **Using `exec` on a crash-looping container.** `docker compose exec` needs the container to be *running*. If it keeps dying, use `docker compose run --rm <svc> sh` to get a fresh container with a shell instead.

- **Committing `.env`.** It holds secrets. Git-ignore it, commit `.env.example` with placeholders. A leaked `.env` in git history means rotating every secret in it.

- **`sync` alone with no in-container reloader.** Compose Watch `sync` copies files in but doesn't restart the process. Without nodemon/`dotnet watch` inside (or `sync+restart`), your synced changes sit on disk and the running process never picks them up.

- **`dotnet watch` not reloading on host edits.** Same VM-boundary issue as Node — set `DOTNET_USE_POLLING_FILE_WATCHER=true`. Also remember to carve out `bin/` and `obj/` as anonymous volumes so host build artifacts don't shadow the container's.

---

## Phase 6 Exercise

**Goal (from the plan):** Set up a full dev environment with hot reload for a Node.js API. Add a migrate service. Configure a VS Code Dev Container. Verify source changes reflect without rebuilding.

Build it in `examples/phase6-dev-workflow/`.

**1. Hot-reload Node API**
- Multi-stage Dockerfile with a `dev` target that installs **all** deps (incl. devDeps + a watcher) and a `runtime` target for prod.
- `docker-compose.yml` (base) + `docker-compose.override.yml` (dev): in dev, override `command` to `npm run dev:ts` (ts-node-dev) and add `--inspect=0.0.0.0:9229`.
- Hint: dev volumes are `- ./:/app` **plus** `- /app/node_modules`. Confirm the trick works by deleting `node_modules` on the host and re-running — the app must still start (it's using the anon-volume copy).

**2. Migrate service (init container)**
- Add a `db` (Postgres) with a `pg_isready` healthcheck.
- Add a `migrate` service running `npx prisma migrate deploy` (or `dotnet ef database update`), gated on `db: service_healthy`, with `restart: "no"`.
- Gate `api` on `migrate: service_completed_successfully` AND `db: service_healthy`.
- Hint: prove the gate by introducing a deliberately broken migration — `api` should never start, and `docker compose ps` should show `migrate` exited non-zero.

**3. VS Code Dev Container**
- `.devcontainer/devcontainer.json` using `dockerComposeFile` + `service: api`, `workspaceFolder: /app`, `forwardPorts: [3000, 9229]`.
- Hint: if the prod `CMD` exits, add `command: sleep infinity` to the api service in the dev override so VS Code can keep the container alive and run the process itself.

**4. Verify reflect-without-rebuild**
- Start with `docker compose up` (or `docker compose watch`). Edit a route handler in `./src`, save, and confirm the API serves the new response **without any `docker build`/`up --build`**.
- Hint: tail `docker compose logs -f api` — you should see ts-node-dev/nodemon log a restart on save. If nothing happens on macOS/Windows, switch the watcher to polling.

**5. Stretch — Compose Watch**
- Add a `develop.watch` block: `sync` for `./src`, `rebuild` for `package.json`/`package-lock.json`, `sync+restart` for a config file.
- Hint: with Watch you can drop the `./:/app` bind mount **and** the `node_modules` anonymous volume entirely — verify the shadowing problem is gone because nothing is mounted over `/app`. Change a dependency and watch Compose auto-rebuild.

**Verification checklist:**
- [ ] `Cannot find module` does NOT occur after deleting host `node_modules` (anon-volume trick proven)
- [ ] VS Code can attach a debugger and hit a breakpoint (port 9229 published, roots mapped)
- [ ] A broken migration prevents `api` from starting (init-container gate proven)
- [ ] Editing a `./src` file changes the live response with no rebuild
- [ ] `docker compose config` shows all `${...}` resolved and the intended env vars present
