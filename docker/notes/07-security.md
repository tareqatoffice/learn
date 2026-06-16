# Phase 7 — Security

---

Security in Docker is mostly about **assuming the container will be breached** and limiting the blast radius when it is. A container is not a VM — it shares the host kernel (see Phase 1: namespaces + cgroups, *not* hardware virtualisation). That single fact drives almost every rule in this phase: if an attacker breaks out of the container, the only thing between them and your host is the Linux kernel and whatever privileges you handed the process.

The mental model from frontend/Node.js work — "validate input, least privilege, don't trust the client" — maps directly here. The container *is* the untrusted client. Harden it accordingly.

---

## 7.1 Don't Run as Root

### Why this is the single most important rule

By default, most base images run their process as **UID 0 (root)** *inside* the container. The trap: that UID is not isolated from the host unless you explicitly enable the **user namespace** (most setups don't). So root-in-container is, by default, **root-on-host** as far as the kernel's UID accounting is concerned.

Now chain that with a container escape:

```
Attacker exploits your app (RCE)
    ↓ they now run commands as root INSIDE the container
Kernel bug / misconfigured mount / privileged flag
    ↓ container escape
Attacker runs as root ON THE HOST  ← game over: every other container, the daemon, the disk
```

A non-root container turns that last step from "host root" into "an unprivileged user who escaped into a locked room". The kernel attack surface for privilege escalation is dramatically smaller for a non-root process. This is exactly the *least privilege* principle: the process gets the smallest identity that still lets it do its job.

Concrete dangers of root-in-container even *without* an escape:
- A bind-mounted host directory (`-v /etc:/host-etc`) is writable as root → tamper with host files.
- The process can `chmod`/`chown` anything inside the container, install packages, rewrite binaries — handy for an attacker building a foothold.
- Many capabilities (see 7.3) are only dangerous *because* you're root.

### Use the built-in user when the image provides one

The official Node.js images ship a ready-made `node` user (UID 1000). The .NET images ship an `app` user.

```dockerfile
# Node.js — the official image already created the `node` user for you
FROM node:20.11.0-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./   # files owned by node, not root
RUN npm ci --omit=dev
COPY --chown=node:node . .
USER node                                  # everything AFTER this runs as `node`
CMD ["node", "dist/main.js"]
```

```dockerfile
# ASP.NET Core — `app` user exists in the runtime image (UID 1654 on newer tags)
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --chown=app:app ./publish .
USER app                                   # drop to non-root before ENTRYPOINT
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Creating your own non-root user

When the base image has no suitable user (e.g. you built `FROM debian:slim`), create one. Pin the UID/GID so it's stable across rebuilds — this matters for volume permissions.

```dockerfile
FROM debian:bookworm-slim

# --system  : no password, no aging, intended for service accounts (not humans)
# --gid/uid : pin explicit numeric IDs so file ownership is reproducible
RUN groupadd --system --gid 1001 appgroup \
 && useradd  --system --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app
COPY --chown=appuser:appgroup ./build .

USER appuser            # 1001:1001 — never touches root again
ENTRYPOINT ["./server"]
```

On Alpine the tools differ (BusyBox `adduser`/`addgroup`):

```dockerfile
FROM alpine:3.20
RUN addgroup --system --gid 1001 appgroup \
 && adduser  --system --uid 1001 --ingroup appgroup --no-create-home appuser
USER appuser
```

### Key subtleties

- **`USER` only affects instructions *after* it.** `RUN apt-get install` must come *before* `USER appuser`, since installing packages needs root.
- **`USER` does not retroactively fix ownership.** Files copied as root stay root-owned and may be unreadable/unwritable by your non-root user. Use `COPY --chown=...` (see 7.6) or a `RUN chown -R` step *before* dropping privileges.
- **`EXPOSE` / binding ports < 1024 needs a capability** when non-root (covered in 7.3). The clean fix is to listen on a high port (e.g. 3000, 8080) and let the reverse proxy map it.
- **You can also force it at runtime** without editing the Dockerfile: `docker run --user 1001:1001 myimage`. Useful for auditing third-party images, but baking `USER` into the image is the durable fix.

---

## 7.2 Read-Only Root Filesystem

### The idea

A running container has a thin writable layer on top of the read-only image layers (Phase 1: copy-on-write). Making the root filesystem **read-only** removes that writable layer entirely. The payoff: an attacker who lands code execution **cannot write a backdoor binary, drop a cron job, or modify your app files** — the filesystem rejects the write.

This forces a healthy discipline: you must declare *exactly* which paths are writable, and everything else is locked. It surfaces accidental writes (apps that scribble cache/temp files into random directories) at build time instead of in production.

### Read-only + tmpfs for the writable bits

Most apps still need *some* writable space: `/tmp`, a cache dir, maybe a PID file. Mount those as **tmpfs** — an in-memory filesystem that is wiped when the container stops and never touches the image.

```bash
# Raw docker run
docker run \
  --read-only \                      # entire root FS is read-only
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \   # writable in RAM, but no executing binaries from it
  myimage
```

```yaml
# Compose — the form you'll actually use day to day
services:
  api:
    image: myorg/api:1.4.2
    read_only: true                  # lock the whole root filesystem
    tmpfs:
      - /tmp                          # framework temp files, upload buffering
      - /run                          # PID files, runtime sockets
    # If your app insists on writing logs to disk (prefer stdout — see Phase 9),
    # give it a dedicated writable mount instead of unlocking everything:
    volumes:
      - app-logs:/app/logs            # named volume = persistent + writable
```

`tmpfs` mount options worth knowing (defence in depth):
- `noexec` — files written here cannot be executed (blocks "download payload to /tmp, run it").
- `nosuid` — setuid bits are ignored (blocks a class of privilege escalation).
- `size=64m` — cap it so a runaway process can't exhaust host RAM.

### Gotchas

- **Many apps write more than you think.** Node's `npm`/`pnpm` caches, .NET's temp dirs, nginx's `/var/cache/nginx` and `/var/run`. When `read_only: true` first breaks something, the error is usually `EROFS: read-only file system` or `Permission denied` — that's your cue to add a precise `tmpfs`/volume, not to remove `read_only`.
- **Combine with `USER`** (7.1). Read-only root + non-root user + dropped capabilities (7.3) is the standard hardened trio.

---

## 7.3 Drop Linux Capabilities

### What capabilities are

Historically, a Linux process was either root (can do everything) or not (can do almost nothing). **Capabilities** break "everything" into ~40 discrete privileges, so you can grant a specific power without full root. Examples:

| Capability | What it lets you do |
|------------|---------------------|
| `NET_BIND_SERVICE` | Bind to ports below 1024 |
| `NET_RAW` | Craft raw packets (ping, but also spoofing) |
| `SYS_ADMIN` | A huge grab-bag — mount, namespaces; basically near-root |
| `CHOWN` | Change file ownership |
| `SETUID` / `SETGID` | Change process UID/GID |
| `DAC_OVERRIDE` | Bypass file permission checks |

Docker grants a **default set** of ~14 capabilities to every container. Most apps need *none* of them. Each retained capability is extra attack surface — a kernel bug in that subsystem becomes exploitable.

### Drop everything, add back only what you need

```yaml
services:
  api:
    image: myorg/api:1.4.2
    cap_drop:
      - ALL                          # start from zero privileges
    cap_add:
      - NET_BIND_SERVICE             # ONLY if the app must bind to port 80/443 directly
    # If you listen on a high port (3000/8080) behind a proxy, you can omit cap_add
    # entirely — drop ALL and add nothing.
    security_opt:
      - no-new-privileges:true       # process can never GAIN privileges later (blocks setuid escalation)
```

```bash
# Equivalent with docker run
docker run \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges \
  myimage
```

### `no-new-privileges` — the cheap, high-value flag

`no-new-privileges:true` tells the kernel: this process and its children can **never** acquire more privileges than they start with, even via setuid binaries. It neutralises a whole category of privilege-escalation exploits (e.g. a setuid `sudo`/`su` left in the image). Pair it with `cap_drop: [ALL]`.

### Verifying

```bash
# Inspect what a running container actually has
docker inspect --format '{{.HostConfig.CapAdd}} {{.HostConfig.CapDrop}}' api

# From inside the container (if `capsh` is present):
docker exec api sh -c 'cat /proc/1/status | grep Cap'
# Then decode with: capsh --decode=<hex>
```

### Never do this

- **`--privileged`** disables almost all isolation (all capabilities, all devices, relaxed seccomp/AppArmor). It's the opposite of this section. The only legitimate uses are Docker-in-Docker and certain hardware access — and even then, prefer narrowly-scoped `--cap-add`/`--device`.
- **`--cap-add SYS_ADMIN`** is "privileged lite". Treat it with the same suspicion.

---

## 7.4 Secrets Management

### Why environment variables leak

Env vars *feel* private, but they're broadcast in more places than you'd guess. For a frontend dev: think of them like a value you logged to the console "just for debugging" — it ends up everywhere.

```bash
# 1. Anyone who can talk to the Docker daemon sees them in plaintext:
docker inspect api | grep -A20 '"Env"'
# "Env": [ "DATABASE_PASSWORD=hunter2", ... ]   ← right there

# 2. They're inherited by every child process and visible via /proc:
docker exec api cat /proc/1/environ        # null-separated, fully readable

# 3. Crash/error reporters (Sentry, etc.) often dump process.env into reports.
# 4. `docker history` / image metadata exposes any secret baked in with ENV/ARG at build time.
# 5. They appear in orchestrator state, logs, and `ps eww` output.
```

Compounding it: env vars are inherited by **every subprocess**. Spawn a shell, a build tool, a child worker — they all inherit `DATABASE_PASSWORD`. There's no scoping. That's the structural flaw.

> Build-time recap from Phase 2: **never** put secrets in `ARG` or `ENV` in a Dockerfile — they're permanently visible in `docker history` and the image config. Use BuildKit secret mounts (`RUN --mount=type=secret,id=...`) instead.

### The better pattern: secrets as files at `/run/secrets/`

Docker's secret mechanism mounts each secret as a **file** inside the container (default path `/run/secrets/<name>`), backed by tmpfs (in-memory, never on disk). Files are better than env vars because:
- They are **not** inherited by child processes automatically.
- They don't show up in `docker inspect`'s Env, `/proc/<pid>/environ`, or crash dumps.
- Access is gated by file permissions; you read them deliberately, not ambiently.

```yaml
# docker-compose.yml — file-based secrets (fine for local dev / single-host Compose)
services:
  api:
    image: myorg/api:1.4.2
    secrets:
      - db_password                  # mounted at /run/secrets/db_password
    environment:
      # Don't pass the secret itself — pass a POINTER to the file.
      # The app reads the file at startup. (Common convention: a *_FILE suffix.)
      DB_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt  # dev only; gitignore this, never commit it
```

App-side, you read the file instead of `process.env`:

```ts
// Node.js — read the secret from the mounted file, with an env-var fallback for local dev
import { readFileSync } from "node:fs";

function readSecret(name: string): string {
  const filePath = process.env[`${name}_FILE`];
  if (filePath) return readFileSync(filePath, "utf8").trim();   // preferred path
  const inline = process.env[name];
  if (inline) return inline;                                    // fallback (dev only)
  throw new Error(`Secret ${name} not provided`);
}

const dbPassword = readSecret("DB_PASSWORD");   // looks for DB_PASSWORD_FILE first
```

Many official images already support the `_FILE` convention out of the box — e.g. Postgres reads `POSTGRES_PASSWORD_FILE`, MySQL reads `MYSQL_ROOT_PASSWORD_FILE`. Prefer those over the plain env var.

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password   # native _FILE support
    secrets:
      - db_password
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### Production secret stores

File-based Compose secrets are a dev convenience. In production, secrets live in a dedicated system that handles encryption-at-rest, access policy, audit logging, and **rotation**:

- **HashiCorp Vault** — dynamic, short-lived credentials (e.g. a DB password that expires in 1 hour), fine-grained policies, audit log. The gold standard for self-managed.
- **AWS Secrets Manager / SSM Parameter Store** — IAM-scoped, automatic rotation, integrates with ECS/EKS task definitions (injected as files or env at task launch).
- **Azure Key Vault / GCP Secret Manager** — cloud-native equivalents.
- **Kubernetes Secrets** — base64 (NOT encrypted by default!) objects mounted as files or env. Enable encryption-at-rest and RBAC; often paired with the External Secrets Operator pulling from Vault/AWS.
- **Doppler / Infisical** — secrets-as-a-service that sync into your runtime.

The common thread: the secret is **fetched at runtime** by an authenticated identity (an IAM role, a Vault token, a service account), never baked into the image and never sitting in plaintext `docker inspect` output.

---

## 7.5 Image Scanning

### What scanning does

Your image is a stack of OS packages and language dependencies (Phase 1: layers). Each one can carry a **known vulnerability** (a CVE). Scanners compare the exact package versions in your image against vulnerability databases (NVD, GitHub Advisories, distro feeds) and report what's exploitable. It's `npm audit`, but for the *entire* image — OS libs, system packages, and your app deps together.

This is not optional in a real pipeline. Base images drift: an image that was clean last month accumulates new CVEs as vulnerabilities are disclosed in already-shipped packages. You scan on every build *and* periodically re-scan deployed images.

### The three common tools

```bash
# --- Docker Scout (built into Docker Desktop / CLI; replaced the old Snyk integration) ---
docker scout cves myorg/api:1.4.2          # list known CVEs in the image
docker scout quickview myorg/api:1.4.2     # summary: how many critical/high/etc.
docker scout recommendations myorg/api:1.4.2   # suggests safer base image tags

# --- Trivy (Aqua) — open source, fast, the de facto CI choice ---
trivy image myorg/api:1.4.2                # scan an image
# Fail the build on serious findings — exactly what you'd put in CI:
trivy image \
  --severity HIGH,CRITICAL \               # only care about these
  --exit-code 1 \                          # non-zero exit => CI step fails
  --ignore-unfixed \                       # skip CVEs with no fix available yet (reduce noise)
  myorg/api:1.4.2
trivy image --scanners vuln,secret,misconfig myorg/api:1.4.2   # also catch leaked secrets + IaC misconfig

# --- Grype (Anchore) — open source, pairs with `syft` for SBOM generation ---
grype myorg/api:1.4.2
grype myorg/api:1.4.2 --fail-on high       # CI gate
syft myorg/api:1.4.2 -o spdx-json          # generate a Software Bill of Materials
```

### Reading results sanely

- **Triage by severity AND reachability.** A CRITICAL CVE in a library you never call is lower priority than a HIGH one in your request path. `--ignore-unfixed` trims CVEs you literally cannot patch yet.
- **Most fixes are "rebuild on a newer base."** A scan flagging OS packages usually means your base image tag is stale — bump it and rebuild. App-dependency CVEs mean bumping the offending package.
- **Scanning a smaller image finds fewer CVEs** — which is the whole point of 7.6. Distroless images often report near-zero OS CVEs because there are barely any packages to be vulnerable.

### Pin tags AND digests in production

A tag like `node:20-alpine` is a **mutable pointer** — the registry can repoint it to a new build at any time (Phase 1.6). That's great for getting patches, terrible for reproducibility and supply-chain trust: the image you scanned and approved is not guaranteed to be the image that deploys.

Pin **both** a specific version tag (human-readable intent) **and** the immutable digest (cryptographic guarantee):

```dockerfile
# tag = "what I meant",  @sha256 = "exactly these bytes, verified"
FROM node:20.11.0-alpine@sha256:abc123def456...    # immutable: cannot silently change
```

```bash
# Find the digest of an image you've pulled and trust:
docker images --digests node
docker inspect --format '{{index .RepoDigests 0}}' node:20.11.0-alpine
```

The trade-off: pinned digests don't auto-update, so you must deliberately re-pin (via Dependabot/Renovate, which can bump digest pins for you) — turning silent drift into reviewed, scanned, intentional updates.

---

## 7.6 Minimise the Attack Surface

### The principle

Every binary, shell, package manager, and tool in your image is something an attacker can use — and something that can have a CVE. The smallest image that still runs your app is the most secure. "There's no shell to get a shell" is a real defence.

### Base image spectrum (smaller → fewer tools → harder to debug, more secure)

| Base | Size | Has a shell? | Notes |
|------|------|--------------|-------|
| `ubuntu` / `debian` | ~30 MB+ | Yes, full | Lots of tools = lots of attack surface; great for *dev* |
| `*-slim` | ~28–65 MB | Yes, minimal | Stripped debian; reasonable default |
| `alpine` | ~5 MB | Yes (BusyBox) | Tiny; musl libc can break native modules — test it |
| `distroless` (Google) | ~20–55 MB | **No shell, no package manager** | Just your app + runtime + CA certs; excellent for prod |
| `scratch` | 0 MB | No | Truly empty; only for static binaries (Go, Rust, .NET AOT) |

### Multi-stage build = no build tools in the final image

This is the most effective single technique (Phase 2.3 recap, now framed for security). The build stage has the full SDK/compiler/dev-deps; the runtime stage copies *only the artifact*. The compiler, source code, and dev dependencies — all juicy attacker targets — simply don't exist in the shipped image.

```dockerfile
# ---------- build stage: has everything, gets thrown away ----------
FROM node:20.11.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                       # ALL deps incl. devDependencies + build toolchain
COPY . .
RUN npm run build                # produces dist/

# ---------- runtime stage: distroless, no shell, no npm, no source ----------
FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /app
# Copy ONLY the build output and production deps — nothing else crosses the boundary
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
# Distroless nodejs images already run as non-root (UID 65532) and have no shell.
# There is no `RUN`, no `apk`, no `sh` here — an attacker who lands code has almost nothing to use.
CMD ["dist/main.js"]             # distroless nodejs sets node as the entrypoint
```

```dockerfile
# ASP.NET Core — multi-stage to a minimal runtime
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# (or, smaller still: mcr.microsoft.com/dotnet/runtime-deps:10.0 + a self-contained/AOT publish)
WORKDIR /app
COPY --from=build --chown=app:app /app/publish .   # set ownership during copy, no root chown step
USER app
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Other surface-reduction tactics

- **`COPY --chown=user:group`** sets correct ownership *during* the copy — no separate `RUN chown -R` step (which would add a layer and run as root). Already used above.
- **Don't install debug tools in production images** — no `curl`, `vim`, `netcat`, `ps`, `bash`. When you must debug a distroless/minimal container, attach an ephemeral debugger instead of baking tools in: `docker debug` (Docker Desktop) or `kubectl debug --image=nicolaka/netshoot` (K8s ephemeral containers). The tools live in a *separate* throwaway container, not your image.
- **Avoid `apt-get upgrade` / `apk upgrade`** in Dockerfiles — unpinned upgrades pull whatever is newest at build time, breaking reproducibility (the digest changes for the same Dockerfile). Pin the base image and bump it deliberately (7.5) instead.
- **Clean package manager caches in the same `RUN`** so they don't persist in a layer:
  ```dockerfile
  RUN apt-get update \
   && apt-get install -y --no-install-recommends ca-certificates \
   && rm -rf /var/lib/apt/lists/*          # same layer = cache never ships
  ```
- **A tight `.dockerignore`** (Phase 2.5) keeps `.git`, `.env`, secrets, and `node_modules` out of the build context entirely — so they can't accidentally be `COPY`'d in.

---

## 7.7 Network Security

### Don't publish ports you don't need

Publishing a port (`-p 8080:80` / `ports:` in Compose) opens a hole from the **host network** (often the public internet) straight to the container. The trap: every published port is an entry point an attacker can reach. Internal services — your database, Redis, a backend API — should be reachable *only* by sibling containers, never from outside.

Containers on the same Docker network can already talk to each other by service name via Docker's embedded DNS (Phase 3.3) **without any published ports**. Publishing is only for traffic coming *from the host/internet*.

```yaml
services:
  nginx:                         # the ONLY service the outside world can reach
    image: nginx:1.27-alpine
    ports:
      - "443:443"                # single public ingress — TLS terminates here
    networks: [frontend, backend]

  api:
    image: myorg/api:1.4.2
    # NO `ports:` — the host cannot reach it directly.
    # nginx reaches it as http://api:3000 over the backend network.
    expose:
      - "3000"                   # EXPOSE is documentation only — does NOT publish to host
    networks: [backend]

  db:
    image: postgres:16
    # NO `ports:` either. If you map 5432 to the host "just for dev", you've exposed
    # your database to anything that can reach the host. Use a tunnel/exec instead.
    networks: [backend]

networks:
  frontend:                      # nginx <-> outside world
  backend:
    internal: true               # services here can talk to each other but have NO route
                                 # to the outside — even outbound. Strong isolation for db tier.
```

### Segment with internal networks + single ingress

The pattern above is the standard production shape:

```
            Internet
               │  (only 443 published)
        ┌──────▼──────┐
        │    nginx    │   ← single ingress, on frontend + backend
        └──────┬──────┘
       backend │ network  (no port published to host)
        ┌──────▼──────┐
        │     api     │
        └──────┬──────┘
        ┌──────▼──────┐
        │     db      │   ← on an `internal: true` network: no inbound, no outbound to internet
        └─────────────┘
```

- **Single ingress:** exactly one container (a reverse proxy — nginx, Traefik, Caddy) is publicly reachable. It terminates TLS and forwards to internal services. Everything else is unpublished.
- **`internal: true` networks:** containers on them can reach each other but have **no gateway to the outside** — neither inbound nor outbound. Ideal for a database tier that should never phone home.
- **Network segmentation:** put service tiers on separate networks (`frontend`, `backend`) and only bridge them where genuinely needed (nginx sits on both). The DB tier never shares a network with the public-facing layer, so even a compromised nginx can't reach the DB directly — it must go through the API.
- **`expose` vs `ports`:** `expose` is pure metadata/documentation; it publishes nothing. Only `ports` (or `docker run -p`) actually opens a host-facing port. (Phase 2.1 / Phase 3.2.)

### Bind to localhost when you *must* publish for local dev

If you really need a host-facing port during development (e.g. connecting a GUI DB client), bind it to loopback so it isn't exposed on the machine's external interfaces:

```yaml
ports:
  - "127.0.0.1:5432:5432"        # reachable only from the host itself, not the LAN/internet
```

---

## Common Mistakes

- **Leaving the default root user.** No `USER` line → the process runs as root, and a breach is a host-root breach. Add a non-root `USER` (7.1). This is the #1 finding in audits.
- **`USER` placed before the steps that need root.** `apt-get install` after `USER appuser` fails with permission errors. Install first, drop privileges last.
- **Forgetting `--chown` and getting permission errors.** Files copied as root, then run as non-root → `EACCES`. Use `COPY --chown=user:group`.
- **Secrets in `ENV` / `ARG` / `docker-compose.yml`.** Visible in `docker inspect`, `docker history`, `/proc/1/environ`, and crash reports. Use file-based secrets / a secret store (7.4). Also: committing `.env` to git.
- **Baking secrets into image layers at build time** with `ARG SECRET=...`. Permanent in `docker history` even if "removed" in a later layer — layers are additive. Use BuildKit `--mount=type=secret`.
- **Using `latest` (or any bare tag) in production.** Mutable, non-reproducible, no rollback story, and the scanned image ≠ the deployed image. Pin version + digest (7.5).
- **Never scanning images**, or scanning once and never again. CVEs are disclosed *after* you ship. Scan in CI on every build and re-scan deployed images on a schedule.
- **Reaching for `--privileged` to "make it work."** It disables the isolation this whole phase is about. Find the specific `--cap-add`/`--device` you actually need instead.
- **Publishing the database port** (`5432:5432`, `27017:27017`, `6379:6379`) to the host "for convenience." That's an internet-facing database if the host is public. Keep it on an internal network; tunnel or `exec` for occasional access (7.7).
- **Shipping the build image as the runtime image.** The SDK, compiler, source, and dev-deps are all attack surface and bloat. Multi-stage to a minimal/distroless runtime (7.6).
- **Treating `EXPOSE` as if it publishes a port.** It's documentation only. Only `ports:` / `-p` opens a host port — a false sense of "it's not exposed" cuts both ways.
- **Removing `read_only: true` at the first `EROFS` error.** The error is telling you the app writes somewhere unexpected — add a precise `tmpfs`/volume for that path instead of unlocking the whole filesystem (7.2).

---

## Phase 7 Exercise

**Audit and harden a Dockerfile + Compose stack, and prove the improvement with a scanner.**

Start from a deliberately insecure setup: a Dockerfile that runs as root, bakes a secret into `ENV`, uses an unpinned `latest` base image, and a Compose file that publishes the database port and grants default capabilities.

1. **Audit — list every issue.** Walk the checklist: Is it running as root? Are secrets in `ENV`/`ARG`? Is the base image pinned (tag *and* digest)? Are unnecessary ports published? Is the root FS writable? Are capabilities dropped? Is it a single-stage image shipping build tools?
   - *Hint:* run `docker history <image>` and `docker inspect <container>` to literally see the leaked secret and the root user, so the audit isn't theoretical.

2. **Scan BEFORE.** Run `trivy image --severity HIGH,CRITICAL <image>` against the original and record the CVE count. Save the output.
   - *Hint:* also try `docker scout quickview` for a second opinion and `--scanners secret` to catch the baked-in secret.

3. **Apply the fixes:**
   - Add a non-root `USER` and `COPY --chown` (7.1).
   - Convert to a **multi-stage** build with a minimal/distroless runtime (7.6).
   - Pin the base image to a version **and** digest (7.5).
   - Move the secret to a **file-based Docker secret** read via a `*_FILE` env pointer (7.4).
   - In Compose: `read_only: true` + `tmpfs` for writable paths (7.2), `cap_drop: [ALL]` + `no-new-privileges` (7.3), remove the DB `ports:` mapping and put it on an `internal: true` network (7.7).

4. **Scan AFTER.** Re-run Trivy on the hardened image and **compare CVE counts** before vs after. The distroless/multi-stage change alone should drop the OS-package CVEs dramatically.
   - *Hint:* expect the biggest single drop from switching the runtime base to distroless/alpine — that's the attack-surface principle (7.6) made measurable.

5. **Verify the hardening actually holds:**
   - `docker inspect --format '{{.Config.User}}' <container>` → confirm it's non-root.
   - `docker exec <container> whoami` → not `root` (and on distroless, confirm there's no shell at all).
   - Try `docker exec <container> sh -c 'touch /test'` → should fail with read-only FS.
   - Confirm the secret is **not** in `docker inspect`'s `Env` and **is** present at `/run/secrets/...`.

**Deliverable:** a `before/` and `after/` pair under `examples/phase7-hardening/`, plus a short note recording the Trivy CVE counts on each. The number going down is the whole point — you've turned the abstract rules of this phase into a measurable security improvement.
