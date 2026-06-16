# Phase 2 — Writing Dockerfiles

A Dockerfile is a recipe: a deterministic-ish script that turns a base image plus
your source into a new image. Each instruction that touches the filesystem produces
a **layer** (a content-addressed tarball of changes). Understanding "what is a layer"
and "when is it cached" is 80% of writing good Dockerfiles — the rest is knowing the
instructions and a few security rules.

Mental model coming from Node.js: think of a Dockerfile less like a shell script you
run top-to-bottom every time, and more like a memoised build graph. If the inputs to
an instruction haven't changed, Docker reuses the previously computed layer — exactly
like a build cache (`tsc --incremental`, Vite's module cache). Get the ordering wrong
and you bust the cache constantly; get it right and rebuilds take seconds.

```
Dockerfile                          Image (read-only layer stack)
─────────────                       ──────────────────────────────
FROM node:20-alpine     ──────────► [ layer 0: base OS + node ]
WORKDIR /app            ──────────► [ layer 1: metadata only  ]
COPY package*.json ./   ──────────► [ layer 2: 2 files        ]
RUN npm ci              ──────────► [ layer 3: node_modules   ]
COPY . .                ──────────► [ layer 4: app source      ]
                                    ───────────────────────────
                            container = stack above + 1 writable layer on top
```

---

## 2.1 Dockerfile Instructions — Complete Reference

### `FROM` — the base image

Every Dockerfile starts with `FROM` (the only thing allowed before it is `ARG`).
It sets the starting filesystem and defines a **build stage**.

```dockerfile
FROM node:20.11.0-alpine            # repository:tag — pin the tag in production
FROM node:20.11.0-alpine AS builder # named stage (used by multi-stage, see 2.3)
FROM scratch                        # the empty image — for static binaries only
```

Pin the tag (`20.11.0-alpine`, not `latest` or even `20`). `latest` silently changes
under you and destroys reproducibility — the Docker equivalent of `"dependency": "*"`
in `package.json`. For maximum determinism, also pin the digest:

```dockerfile
FROM node:20.11.0-alpine@sha256:abc123...   # tag is a label; digest is the identity
```

### `RUN` — execute a command, producing a layer

`RUN` runs a command **at build time** in a new layer on top of the current image.

```dockerfile
# Two forms:
RUN npm ci                                   # shell form: runs via /bin/sh -c "npm ci"
RUN ["npm", "ci"]                            # exec form: no shell, exec'd directly
```

The big rule: **chain related commands into one `RUN`** to avoid extra layers and to
make cleanup actually shrink the image. Each `RUN` is a separate layer, and a later
layer cannot truly delete bytes from an earlier one — it only masks them.

```dockerfile
# BAD — three layers; the apt cache is baked into layer 1 forever,
# the "rm" in layer 3 just hides it but the image still carries the bytes.
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# GOOD — one layer; cleanup happens before the layer is finalised.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*           # cleanup in the SAME layer = real savings
```

### `COPY` vs `ADD` — almost always use `COPY`

Both copy files from the build context into the image. The difference is that `ADD`
has two "magic" behaviours that surprise people:

```dockerfile
COPY package.json ./                 # plain, predictable file copy — PREFER THIS
COPY --chown=node:node . .           # copy + set ownership (no extra RUN chown layer)
COPY --from=builder /app/dist ./dist # copy from another build stage (multi-stage)

ADD https://example.com/file.tar.gz /tmp/   # ADD can fetch URLs (don't — use RUN curl)
ADD archive.tar.gz /opt/                     # ADD auto-EXTRACTS local tarballs into /opt
```

`ADD`'s URL-fetch is uncacheable and unverifiable; its auto-extraction is a footgun
when you actually wanted the tarball as-is. The one legitimate use of `ADD` is
deliberate local-tarball extraction. Otherwise: `COPY`.

### `WORKDIR` — set (and create) the working directory

```dockerfile
WORKDIR /app                         # creates /app if missing, then cd's into it
COPY package.json ./                 # "./" is now /app/
RUN npm ci                           # runs with cwd = /app
```

Always use `WORKDIR`. Do **not** use `RUN cd /app && ...` — `cd` doesn't persist
across instructions (each `RUN` is a fresh shell), so it silently does nothing for
the next instruction.

### `ENV` — runtime environment variables (baked into the image)

```dockerfile
ENV NODE_ENV=production              # available at BUILD time AND in the running container
ENV PORT=3000 \
    LOG_LEVEL=info                   # multiple vars in one instruction
```

`ENV` values persist into the container and show up in `docker inspect`. Use for
non-secret config (`NODE_ENV`, `PORT`). **Never** for secrets (see 2.6).

### `ARG` — build-time variables (NOT present at runtime)

```dockerfile
ARG NODE_VERSION=20                  # default value; override with --build-arg
FROM node:${NODE_VERSION}-alpine     # ARG before FROM can parameterise the base image

ARG BUILD_DATE                       # no default; must be passed in
RUN echo "Built on $BUILD_DATE"      # available during build only
```

```bash
docker build --build-arg NODE_VERSION=22 --build-arg BUILD_DATE=$(date -u +%FT%TZ) .
```

Key distinction vs `ENV`:

| | `ARG` | `ENV` |
|---|---|---|
| Available at build time | yes | yes |
| Available in running container | **no** | yes |
| Set via | `--build-arg` | `ENV` instruction / `docker run -e` |
| Scope | per-stage (re-declare after each `FROM`) | persists down the stage |

Gotcha: an `ARG` declared before the first `FROM` is **not** visible inside a build
stage unless you re-declare it (bare `ARG NAME`) after the `FROM`.

### `EXPOSE` — documentation only, does NOT publish

```dockerfile
EXPOSE 3000                          # metadata: "this app listens on 3000"
```

This publishes nothing. It's a hint for humans and tools. You still need
`docker run -p 8080:3000` to actually map a host port. (The one functional effect:
`docker run -P` — capital P — publishes all EXPOSEd ports to random host ports.)

### `CMD` vs `ENTRYPOINT` — the part everyone gets wrong

See the dedicated deep-dive below (it's worth its own subsection), but the reference:

```dockerfile
CMD ["node", "dist/main.js"]         # default command; fully overridden by `docker run` args
ENTRYPOINT ["node"]                  # fixed executable; CMD becomes its default arguments
CMD ["dist/main.js"]                 # → effectively runs: node dist/main.js
```

### `USER` — drop root

```dockerfile
USER node                            # switch to the 'node' user (built into node images)
# Everything after this — RUN, CMD, ENTRYPOINT — runs as 'node', not root.
```

Containers run as **root by default**, which means a container escape = root on the
host. Always drop to a non-root user before `CMD`. (Full treatment in Phase 7.)

### `VOLUME` — declare a mount point

```dockerfile
VOLUME ["/var/lib/postgresql/data"]  # this path should be backed by a volume
```

Declares that a path holds persistent/external data. Anything written there at
runtime goes to an anonymous volume (or whatever you mount). Mostly relevant to
database images; app images rarely need it. Caveat: writes to a `VOLUME` path *during
the build* (in later layers) are discarded — don't `RUN` something that writes there.

### `LABEL` — metadata key/value pairs

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/me/app" \
      org.opencontainers.image.version="1.2.3" \
      maintainer="md.tareq@asthait.com"
```

Inspectable with `docker inspect`. Use the OCI standard keys
(`org.opencontainers.image.*`) so registries and tooling pick them up automatically.

### `HEALTHCHECK` — how Docker decides "is this container healthy?"

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
#  --interval     time between checks
#  --timeout      a check that runs longer than this counts as a failure
#  --start-period grace window on startup; failures here don't count against retries
#  --retries      consecutive failures before the container is marked "unhealthy"
#  exit 0 = healthy, exit 1 = unhealthy
```

Container status becomes `healthy` / `unhealthy`, which orchestrators and Compose's
`depends_on: condition: service_healthy` rely on. Note: the check runs *inside* the
container, so `curl` must exist there (alpine doesn't ship it — install it or use
`wget`/a tiny healthcheck binary, or Node's own `http`).

### `ONBUILD` — deferred instructions for downstream images

```dockerfile
# In a base image you publish:
ONBUILD COPY . /app                  # runs NOT now, but when someone FROMs this image
ONBUILD RUN npm ci
```

`ONBUILD` triggers register on *this* image but only fire in a child image's build
(at its `FROM`). Niche — used by some "framework base image" patterns. It hides
behaviour from the child Dockerfile's author, so use sparingly.

---

## 2.1b CMD vs ENTRYPOINT — the deep dive

This is the single most confusing pair in Docker. Two orthogonal questions:

1. **Shell form vs exec form** — how the command is launched.
2. **CMD vs ENTRYPOINT** — what role the command plays and what `docker run` args do.

### Shell form vs exec form

```dockerfile
CMD node dist/main.js                # SHELL form  → runs: /bin/sh -c "node dist/main.js"
CMD ["node", "dist/main.js"]         # EXEC form   → runs: node dist/main.js  (no shell)
```

Why it matters — **signal handling and PID 1**:

```
SHELL form:                          EXEC form:
  PID 1 = /bin/sh                       PID 1 = node
            └── node (child)
  docker stop → SIGTERM to sh         docker stop → SIGTERM to node
  sh often does NOT forward it        node receives it directly
  → node never gets SIGTERM           → app can gracefully shut down
  → 10s later, SIGKILL (hard kill)    → clean exit
```

The container's main process is PID 1. With shell form, PID 1 is `sh`, and `node`
is a child that frequently never receives the `SIGTERM` from `docker stop` — so your
graceful-shutdown handler never fires and the container is hard-killed after the
timeout. **Always prefer exec form** (`["...", "..."]`) for the final command.

(Shell form does buy you shell features — variable expansion, pipes, `&&`. If you
need those in the entrypoint, the fix is an entrypoint script, not shell form.)

### CMD — the default, fully overridable

```dockerfile
CMD ["node", "dist/main.js"]
```

```bash
docker run myapp                     # runs: node dist/main.js
docker run myapp node --version      # CMD is REPLACED → runs: node --version
docker run myapp sh                  # runs an interactive shell instead
```

`CMD` is the *default* — any command you append to `docker run` overrides it entirely.
Great for "the normal thing to run, but let me poke around with a shell when debugging."

### ENTRYPOINT — the fixed executable; CMD supplies its arguments

```dockerfile
ENTRYPOINT ["node"]                  # always runs node...
CMD ["dist/main.js"]                 # ...with this as the default argument
```

```bash
docker run myapp                     # runs: node dist/main.js
docker run myapp --version           # ENTRYPOINT stays → runs: node --version
docker run myapp other.js            # runs: node other.js
```

With `ENTRYPOINT` set, `docker run` args are *appended to* it (they replace `CMD`,
not `ENTRYPOINT`). This turns your image into a parameterised tool — like a binary
whose name is fixed but whose flags you pass.

### The combined model (read this twice)

```
Final command = ENTRYPOINT (if any) + (docker run args  OR  CMD if no args given)
```

| Dockerfile | `docker run myimg` | `docker run myimg foo` |
|---|---|---|
| `CMD ["node","app.js"]` | `node app.js` | `foo` |
| `ENTRYPOINT ["node"]` | `node` | `node foo` |
| `ENTRYPOINT ["node"]` + `CMD ["app.js"]` | `node app.js` | `node foo` |

The recommended pattern for apps: `ENTRYPOINT` = the binary, `CMD` = default args.
The entrypoint-script pattern for setup-then-run:

```dockerfile
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]  # script does setup, then `exec "$@"`
CMD ["node", "dist/main.js"]         # "$@" = this, unless overridden at run time
```

```bash
#!/bin/sh
# docker-entrypoint.sh
set -e
echo "running migrations..."
node dist/migrate.js
exec "$@"                            # exec REPLACES the shell with the CMD process
                                     # → the app becomes PID 1 → signals work
```

The `exec "$@"` is the crucial bit: without `exec`, the shell stays as PID 1 and you
lose signal forwarding again.

---

## 2.2 Layer Caching — the key to fast builds

Each instruction produces a layer, and Docker caches them. On rebuild, Docker walks
the Dockerfile top-down and, for each instruction, asks: *"have the inputs to this
layer changed?"* If no, it reuses the cached layer and moves on. The moment one
instruction's inputs change, that layer **and every layer after it** are rebuilt.

```
Cache invalidation is top-down and STICKY:

  FROM node:20-alpine     [cached] ✓
  WORKDIR /app            [cached] ✓
  COPY package*.json ./   [cached] ✓   ← package.json unchanged
  RUN npm ci              [cached] ✓   ← so deps NOT reinstalled
  COPY . .                [BUSTED] ✗   ← you edited src/index.ts
  RUN npm run build       [rebuild]    ← everything from here down reruns
```

What invalidates a layer:

- `COPY`/`ADD`: any change to the **contents** of the copied files (hash of files).
- `RUN`/`ENV`/etc.: any change to the **instruction text** itself.
- A change to a base image (new `FROM` digest) busts everything.
- An invalidated earlier layer busts all later layers, unconditionally.

### The golden rule: least-changing first, most-changing last

Dependencies change rarely; your source changes constantly. So copy + install
dependencies **before** copying your source. This is the single most impactful
Dockerfile optimisation.

```dockerfile
# ❌ BEFORE — naive ordering: every source edit reinstalls ALL dependencies
FROM node:20-alpine
WORKDIR /app
COPY . .                  # ← ANY file change (even a typo fix) busts this layer...
RUN npm ci                # ← ...so npm ci reruns on EVERY build (~30-90s wasted)
RUN npm run build
CMD ["node", "dist/main.js"]
```

```dockerfile
# ✅ AFTER — dependency manifest copied first, isolated from source churn
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./     # ← only changes when you add/remove a dependency
RUN npm ci                # ← cached as long as package*.json is unchanged

COPY . .                  # ← source edits bust THIS layer, but not npm ci above
RUN npm run build         # ← rebuild is just: copy source + build (fast)
CMD ["node", "dist/main.js"]
```

The "before" reinstalls dependencies on every code change. The "after" reinstalls
only when `package.json`/`package-lock.json` actually change. Same trick for every
ecosystem:

```dockerfile
# ASP.NET Core — copy .csproj, restore, THEN copy the rest
COPY *.csproj ./
RUN dotnet restore        # cached unless the project file / its references change
COPY . .
RUN dotnet publish -c Release -o /app/publish
```

```dockerfile
# Python
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .
```

### BuildKit cache mounts — persistent cache across builds

The ordering trick caches the *layer* but a bust still re-downloads packages from the
network. BuildKit's `--mount=type=cache` keeps the package manager's cache directory
**persisted across builds** (it's not part of the image — it lives on the builder):

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci                # npm's download cache survives between builds → even a
                          # cache-busting package.json change re-downloads only deltas
```

```dockerfile
# Equivalent for other tools:
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN --mount=type=cache,target=/root/.nuget/packages dotnet restore
RUN --mount=type=cache,target=/var/cache/apt apt-get update && apt-get install -y curl
```

---

## 2.3 Multi-Stage Builds — the most important pattern

The problem: building an app needs a full toolchain (compilers, SDKs, dev
dependencies, source code). Running it needs almost none of that. If you build and
run in one image, the result is bloated (hundreds of MB of build tools) and a bigger
attack surface (every tool is a potential CVE).

The solution: multiple `FROM` stages in one Dockerfile. The **build stage** has the
full SDK; the **runtime stage** is a minimal image into which you copy *only the
built artifacts*. Intermediate stages are discarded — they never ship.

```
┌─────────────── builder stage ───────────────┐   ┌──── runtime stage ────┐
│ FROM node:20-alpine AS builder               │   │ FROM node:20-alpine   │
│   full source + devDeps + tsc + build output │   │   COPY --from=builder │
│   (big, throwaway)                           │──►│     dist + prod deps  │
└──────────────────────────────────────────────┘   │   (small, shipped)    │
                discarded after build               └───────────────────────┘
```

### Node.js example (production-grade)

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:20.11.0-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci                            # ALL deps incl. devDependencies (need tsc, etc.)

COPY . .
RUN npm run build                     # produces /app/dist

# ---------- Stage 2: prune deps ----------
# Reinstall with ONLY production deps so node_modules is lean in the final image.
FROM node:20.11.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev                 # no devDependencies → smaller, fewer CVEs

# ---------- Stage 3: runtime ----------
FROM node:20.11.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps    /app/node_modules ./node_modules   # prod-only deps
COPY --from=builder /app/dist         ./dist           # compiled output only
# Note: no source .ts files, no tsc, no devDependencies in this image.

USER node                             # drop root
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]          # exec form → app is PID 1 → graceful shutdown
```

### ASP.NET Core example (production-grade)

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: build + publish ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY *.csproj ./                      # restore layer cached unless project file changes
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish \
    /p:UseAppHost=false               # framework-dependent publish (no native apphost)

# ---------- Stage 2: runtime ----------
# aspnet image = .NET runtime only (NO SDK) → much smaller, fewer tools.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

COPY --from=build /app/publish ./     # only the published output, no SDK, no source

USER app                              # 'app' user is built into the .NET runtime images
EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApp.dll"]    # ENTRYPOINT for the fixed binary
```

Two .NET notes worth knowing coming from Node:

- `sdk` image ≈ the full toolchain (like having the TypeScript compiler + all build
  tooling). `aspnet` image ≈ the runtime only (like a Node image with no global build
  tools). You build with the first, ship on the second.
- The published output is self-contained enough that the runtime image needs nothing
  else — analogous to shipping `dist/` + prod `node_modules` and nothing more.

You can also target an intermediate stage for debugging:

```bash
docker build --target build -t myapp:debug .   # stop at the SDK stage, get a shell
```

---

## 2.4 Base Image Choices

The base image is a size/debuggability/security tradeoff. Smaller = faster pulls,
smaller attack surface, but harder to debug (fewer tools, maybe no shell).

| Base | Size (compressed) | Has shell? | pkg mgr? | Use when |
|---|---|---|---|---|
| `ubuntu:24.04` / `debian` | ~30 MB | yes | apt | need lots of tools / debugging |
| `debian:slim` | ~28 MB | yes | apt | trimmed Debian, still familiar |
| `node:20-slim` | ~65 MB | yes | apt | glibc + native modules, debuggable |
| `node:20-alpine` | ~45 MB | yes (ash) | apk | small, glibc-free (musl) |
| `alpine:3.20` | ~3.5 MB | yes (ash) | apk | tiny base to build on |
| `distroless` (Google) | ~55 MB (node) | **no** | **no** | hardened production runtime |
| `scratch` | 0 MB | no | no | single static binary (Go, Rust) |

### The alpine gotcha (musl vs glibc)

Alpine uses **musl libc** instead of **glibc**. Most pure-JS/.NET works fine, but
native modules compiled against glibc can break or silently misbehave. Symptoms:
mysterious segfaults, DNS resolution quirks, `sharp`/`bcrypt`/native-addon failures.
If you hit these, switch to `-slim` (Debian, glibc) — the ~20 MB extra is cheap
insurance.

### distroless — no shell, no package manager

```dockerfile
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /app/dist ./dist
CMD ["dist/main.js"]                  # note: entrypoint is node, baked into the image
```

distroless ships the runtime and your app — nothing else. No `sh`, no `apt`, no
`curl`. That's the point: an attacker who lands a shell... can't, because there's no
shell. The cost: you can't `docker exec -it ... sh` to poke around (use the `:debug`
distroless tag locally, which adds busybox). Best paired with multi-stage: build in a
full image, run on distroless.

**Rule of thumb:** alpine or slim for most apps; distroless for hardened production;
full Debian/Ubuntu for the build stage and for local dev images you want to debug.

---

## 2.5 `.dockerignore`

`COPY . .` sends the *entire build context* (your project directory) to the Docker
daemon first, then copies it in. Without a `.dockerignore`, that means uploading
`node_modules`, `.git`, build output, and — dangerously — `.env` files. This is
slow, bloats the image, and **leaks secrets into layers**.

Same syntax as `.gitignore`:

```gitignore
# .dockerignore
node_modules        # rebuilt inside the image via npm ci — never copy host copy
.git                # huge, irrelevant to runtime, and leaks history
.env                # SECRETS — must never enter the build context
.env.*
dist                # build artifacts — produced inside the image, not copied in
build
coverage            # test output
*.log
npm-debug.log*
.DS_Store
Dockerfile          # not needed inside the image
docker-compose*.yml
.github
.vscode
README.md           # optional — exclude docs from the image

# .NET
bin/
obj/
```

Why `node_modules` matters specifically: copying the host's `node_modules` can drag
in OS-specific native binaries (compiled for your Mac, not the Linux container) and
bloats the context by hundreds of MB. Let `npm ci` rebuild them inside the image.

Verify what you're actually shipping:

```bash
docker build -t myapp .              # watch the "transferring context" size at the top
docker run --rm myapp ls -la /app    # confirm no .env, no .git inside
```

---

## 2.6 Build Arguments & Environment Variables (and the secrets warning)

Recap of the two mechanisms (full reference in 2.1):

```dockerfile
ARG APP_VERSION                       # build time only; gone at runtime
ENV NODE_ENV=production               # baked into image; present at runtime
```

```bash
docker build --build-arg APP_VERSION=1.2.3 -t myapp:1.2.3 .
docker run -e LOG_LEVEL=debug myapp   # override/add ENV at run time
```

### ⚠️ Never put secrets in ARG or ENV

Both `ARG` and `ENV` values are **stored in the image metadata and the build
history** — anyone with the image can read them back:

```bash
docker history --no-trunc myapp       # shows every instruction, INCLUDING --build-arg values
docker inspect myapp                  # shows all ENV values in plain text
```

```dockerfile
# ❌ NEVER — this token is permanently recoverable from the image, forever.
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc \
    && npm ci
# Even if you `rm ~/.npmrc` later, the token is in docker history + the layer.
```

A secret that ever entered a layer is compromised even if a later layer deletes it —
layers are immutable and the bytes remain. Rotate any secret that touched a build arg.

### ✅ Use BuildKit secret mounts instead

`--mount=type=secret` makes a secret available to a single `RUN` as a file, **without
ever writing it into a layer**:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci                            # reads /root/.npmrc during this RUN only;
                                      # the file is NOT persisted in any layer
COPY . .
```

```bash
# Provide the secret at build time (from a file or an env var):
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
docker build --secret id=npmrc,env=NPM_RC_CONTENT -t myapp .
```

`docker history` shows the `RUN` but **not** the secret content. This is the correct
way to use a private-registry token, a GitHub PAT, or cloud credentials during build.

---

## 2.7 BuildKit Features

BuildKit is the modern build engine (default in current Docker; explicitly via
`DOCKER_BUILDKIT=1` or `docker buildx build`). It enables the `--mount` features above
plus parallelism, better caching, and multi-arch builds. Opt into its Dockerfile
features with the syntax directive on line 1:

```dockerfile
# syntax=docker/dockerfile:1               ← unlocks --mount=type=cache/secret/ssh, etc.
```

### `--mount=type=cache` — persistent build cache (recap from 2.2)

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci
RUN --mount=type=cache,target=/root/.nuget/packages dotnet restore
```

Caches the package manager's download dir between builds. Not stored in the image —
lives on the builder. Survives even cache-busting manifest changes.

### `--mount=type=secret` — inject secrets without baking them (recap from 2.6)

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

### `--mount=type=ssh` — forward your SSH agent for private git deps

```dockerfile
RUN --mount=type=ssh \
    npm install                       # can clone private git+ssh:// deps without
                                      # copying your private key into the image
```

```bash
docker build --ssh default -t myapp . # forwards the host SSH agent during build
```

### Multi-arch builds — one command, multiple CPU architectures

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \   # build for Intel AND ARM (e.g. Apple Silicon → x86 servers)
  -t myorg/myapp:1.2.3 \
  --push .                                # multi-arch images must be pushed, not loaded
```

This produces a single image *tag* that's actually a manifest list — the registry
serves the right architecture per puller automatically. Essential when you develop on
an ARM Mac but deploy to amd64 servers.

### Parallelism

BuildKit builds independent stages concurrently. In the 3-stage Node example above,
the `deps` stage and the `builder` stage have no dependency on each other, so BuildKit
runs them in parallel — another reason to structure multi-stage builds cleanly.

---

## Common Mistakes

- **Shell-form `CMD`/`ENTRYPOINT` for the main process.** PID 1 becomes `sh`, which
  doesn't forward `SIGTERM`, so `docker stop` hard-kills your app after the timeout
  and graceful shutdown never runs. Use exec form: `CMD ["node", "dist/main.js"]`.

- **`COPY . .` before installing dependencies.** Busts the dependency-install cache
  on every source edit. Copy `package*.json` (or `*.csproj`) and install *first*.

- **No `.dockerignore`.** `COPY . .` then ships `node_modules`, `.git`, and `.env`
  into the build context and image — slow builds and leaked secrets.

- **Secrets in `ARG`/`ENV`.** Permanently recoverable via `docker history` /
  `docker inspect`, even if a later layer "deletes" them. Use `--mount=type=secret`.

- **`apt-get install` and cleanup in separate `RUN`s.** The `rm -rf` in a later layer
  doesn't shrink the image — the bytes are already baked into the earlier layer.
  Chain install + cleanup in one `RUN`.

- **Running as root.** Default user is root; a breakout = host root. Add `USER node`
  (or a custom non-root user) before `CMD`.

- **Using `latest` (or even a bare major) as the base tag.** Silent, unreproducible
  drift. Pin `node:20.11.0-alpine`, ideally with a digest.

- **`ADD` when you meant `COPY`.** `ADD` auto-extracts tarballs and fetches URLs —
  surprising behaviour. Use `COPY` unless you specifically want local-tarball
  extraction.

- **`RUN cd /some/dir`.** `cd` doesn't persist to the next instruction. Use `WORKDIR`.

- **Single-stage image carrying the whole SDK.** Compilers and dev deps ship to
  production = bloat + CVEs. Use multi-stage; copy only artifacts to a runtime image.

- **`HEALTHCHECK` calling `curl` on alpine/distroless.** `curl` isn't installed
  there. Install it explicitly, use `wget`, or use the runtime's own HTTP client
  (Node's `fetch`/`http`).

- **Copying host `node_modules` into the image.** Drags in OS-specific native
  binaries built for your Mac, not Linux. Always `npm ci` inside the image.

- **Forgetting `exec "$@"` in an entrypoint script.** Without `exec`, the shell stays
  PID 1 and you lose signal forwarding all over again.

---

## Phase 2 Exercise

**Task (from the plan):** Write a production-grade multi-stage Dockerfile for a
Node.js Express app *and* a .NET API. Compare final image sizes. Verify build times
with and without cache. Check `docker history` to confirm no secrets in layers.

Put real files in `examples/phase2-multistage/` (a `node-express/` and a `dotnet-api/`
subfolder, each with its own Dockerfile + `.dockerignore`).

**Concrete steps & hints:**

1. **Scaffold two tiny apps.**
   - Node: `express` with a `GET /health` returning 200, a `package.json`, a build
     step (even just `tsc` or a no-op `build` script). Make it listen on `PORT`.
   - .NET: `dotnet new webapi -o dotnet-api`, add a `/health` endpoint.

2. **Write multi-stage Dockerfiles** following 2.3:
   - Node: `builder` (npm ci + build) → `deps` (npm ci --omit=dev) → `runtime`
     (copy `dist` + prod `node_modules`, `USER node`, exec-form `CMD`).
   - .NET: `sdk` stage (restore + publish) → `aspnet` runtime stage (`USER app`,
     `ENTRYPOINT ["dotnet","DotnetApi.dll"]`).
   - Add a `.dockerignore` to each (node: `node_modules .git .env dist`; .NET:
     `bin/ obj/ .git .env`).

3. **Compare sizes** — expect the Node runtime image to land well under a naive
   single-stage build, and the .NET `aspnet` image to be far smaller than an `sdk`
   image:
   ```bash
   docker build -t ex-node ./node-express
   docker build -t ex-dotnet ./dotnet-api
   docker images | grep -E "ex-node|ex-dotnet"
   ```

4. **Measure cache impact.** Time a clean build vs a rebuild after a one-line source
   change. The dependency-install layer should stay cached on the second build:
   ```bash
   docker build --no-cache -t ex-node ./node-express     # cold build (time it)
   # edit one line in src, then:
   time docker build -t ex-node ./node-express           # warm — npm ci should be CACHED
   ```
   Hint: watch the build log for `CACHED` next to the `npm ci` / `dotnet restore`
   step. If it re-runs on a pure source change, your layer ordering is wrong (revisit
   2.2).

5. **Prove no secrets leaked.** Use a BuildKit secret for something (e.g. a fake
   `.npmrc` token) via `--mount=type=secret`, then confirm it's absent:
   ```bash
   docker build --secret id=npmrc,src=./fake.npmrc -t ex-node ./node-express
   docker history --no-trunc ex-node | grep -i token   # → no matches = success
   docker inspect ex-node | grep -i token              # → nothing
   ```

6. **Stretch:** add a `HEALTHCHECK` to both and confirm `docker ps` shows
   `(healthy)`. Then try a multi-arch build with
   `docker buildx build --platform linux/amd64,linux/arm64 ...` (no `--push`, use
   `--load` won't work for multi-arch — observe the error and understand why).
