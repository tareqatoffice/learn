# Phase 1 — Containers & Images

---

## 1.1 What Is a Container (Not the Marketing Version)

The marketing line is "a lightweight VM." That's wrong and it'll mislead you. A container is **not** a tiny virtual machine. It's a normal Linux process — the same kind that runs your `node` server or `dotnet` app — that the kernel has been told to **lie to** about what it can see and limited in what it can use.

There is no "container" object in the Linux kernel. There is no `struct container` anywhere. A container is an *emergent* thing built from two unrelated kernel features bolted together:

- **namespaces** — control what a process can **see**
- **cgroups** — control what a process can **use**

That's it. Everything Docker does on Linux is orchestration on top of those two primitives.

```
        A "container" is just this:

   ┌──────────────────────────────────────────┐
   │  a normal Linux process (PID on the host) │
   │                                            │
   │   + namespaces  → restricted VISIBILITY    │
   │   + cgroups     → restricted RESOURCES     │
   │   + a root filesystem (the image layers)   │
   └──────────────────────────────────────────┘
```

### Namespaces — restricting what a process can *see*

A namespace wraps a global system resource in an abstraction so that the process inside *thinks* it has its own isolated copy. The kernel maintains separate "views" of the resource per namespace.

If you've used JS module scope or .NET `internal` access — same mental model: the thing exists globally, but you can only reach what your scope exposes. Namespaces are scope, enforced by the kernel.

The main namespace types (you'll see all of these in `man namespaces`):

| Namespace | Isolates | Effect inside the container |
|-----------|----------|-----------------------------|
| **pid** | Process IDs | Your app sees itself as PID 1; can't see host processes |
| **net** | Network stack | Own interfaces, IPs, routing table, ports |
| **mnt** | Mount points | Own filesystem tree — this is *why* it sees the image, not your host disk |
| **uts** | Hostname/domain | Can set its own hostname without touching the host |
| **ipc** | Inter-process comm | Own shared memory, semaphores |
| **user** | UID/GID mapping | Can be "root" (UID 0) inside while being unprivileged on the host |

```bash
# Prove the pid namespace exists. Run a shell in a container and look at PIDs:
docker run --rm -it alpine sh        # --rm = delete container on exit, -it = interactive terminal
# inside the container:
ps aux
#   PID   USER  ...  COMMAND
#     1   root       sh             ← your shell is PID 1, like it's the only thing alive
# On the HOST, that same process has some high PID like 48211. Two views, one process.
```

```bash
# The user namespace is the spooky one. Inside, you can be "root":
docker run --rm -it alpine id
# uid=0(root) gid=0(root)            ← root INSIDE the container
# But on the host (by default) that maps to a constrained context. With user-namespace
# remapping enabled, container-root maps to an UNPRIVILEGED host UID — a key security layer.
```

**Why this matters:** the mnt namespace is the reason a container "has its own filesystem." It doesn't have a disk — it has a *mount namespace* whose root was set (via `pivot_root`) to the unpacked image layers. The net namespace is why `localhost` inside the container is not your machine's `localhost`. Internalize this early; half of all Docker confusion is forgetting that the container's view is not the host's view.

### cgroups — restricting what a process can *use*

Namespaces hide things. They do **not** stop a runaway process from eating all your RAM or pinning every CPU core — a process in its own namespaces can still starve the host. That's what **cgroups** (control groups) are for: hard limits and accounting on CPU, memory, block I/O, and process count.

```bash
# Limit a container to 256MB RAM and half a CPU core:
docker run --rm -it \
  --memory=256m \           # cgroup memory limit — exceed it and the kernel OOM-kills the process
  --cpus=0.5 \              # cgroup CPU quota — capped at 50% of one core
  alpine sh

# Watch live cgroup accounting across all running containers:
docker stats                # like `top`, but per-container, reading cgroup counters
```

**Why this matters in production:** without a memory cgroup limit, one leaking container can OOM the entire host and take down every other container with it. The Node track's lesson — "a memory leak eventually crashes the process" — becomes "a memory leak eventually crashes *every neighbour on the box*" unless you set `--memory`. Setting the limit deliberately a bit *below* peak is a feature: an OOM kill is a loud, attributable signal, far better than silent host-wide degradation.

### VMs vs containers — share the kernel, don't virtualize hardware

```
        VIRTUAL MACHINES                       CONTAINERS
   ┌───────────────────────────┐      ┌───────────────────────────┐
   │  App A   │  App B          │      │  App A   │  App B          │
   ├──────────┼─────────────────┤      ├──────────┼─────────────────┤
   │ Bins/Libs│ Bins/Libs       │      │ Bins/Libs│ Bins/Libs       │
   ├──────────┼─────────────────┤      ├──────────┴─────────────────┤
   │ Guest OS │ Guest OS        │      │   (no guest OS at all)     │
   │ (kernel) │ (kernel)        │      │                            │
   ├──────────┴─────────────────┤      ├────────────────────────────┤
   │       Hypervisor           │      │     Docker / containerd    │
   ├────────────────────────────┤      ├────────────────────────────┤
   │      Host OS / kernel       │      │   Host OS / SHARED kernel  │
   ├────────────────────────────┤      ├────────────────────────────┤
   │        Hardware             │      │        Hardware            │
   └────────────────────────────┘      └────────────────────────────┘
```

A **VM** virtualizes *hardware*. The hypervisor emulates CPU, disk, NICs; each VM boots a complete guest OS with its **own kernel**. Strong isolation, but you pay for a full OS boot and a full OS's worth of RAM per VM.

A **container** virtualizes the *operating system view*. There is no guest kernel — every container shares the **host's** kernel and asks it for namespaces + cgroups. The "OS" inside an image (`alpine`, `ubuntu`) is just userland files — libc, shell, package manager — **not a kernel**.

| | VM | Container |
|---|---|---|
| Boots a kernel? | Yes, its own | No, shares host's |
| Startup time | Seconds → minutes | Milliseconds |
| Overhead per instance | Hundreds of MB+ | A few MB |
| Isolation strength | Strong (hardware boundary) | Weaker (kernel is shared) |
| "OS" inside | Full guest OS | Just userland files |

### Why containers start in milliseconds

A VM has to: allocate virtual hardware → load a bootloader → boot a kernel → init system → start services. That's a real computer booting.

A container start is essentially: `clone()` a process with new namespace flags → apply cgroup limits → `pivot_root` into the image's filesystem → `exec` your binary. **It's a process fork, not a boot.** There's no kernel to initialize because it's borrowing the one already running.

The two big consequences:

1. **A container only lives as long as its main process (PID 1).** When PID 1 exits, the container stops. This is the single most common beginner surprise (see Common Mistakes). A container is not a box you put things in — it *is* the process.
2. **The host kernel is shared, so the kernel is the security boundary.** A kernel exploit can cross the container wall in a way it can't easily cross a hypervisor wall. This is why "don't run as root in the container" (Phase 7) actually matters.

---

## 1.2 Images — Layers & the Union Filesystem

An **image** is a read-only template: a stack of filesystem layers plus metadata describing how to run it. A **container** is what you get when you take that read-only stack and add a thin writable layer on top, then start a process in it.

If you want a JS analogy: an image is like a **frozen, published npm package version** — immutable, content-hashed, shareable. A container is a `node_modules` install of it that you can then mutate locally. The package never changes; your working copy does.

### Each filesystem-changing instruction is a layer

A Dockerfile (Phase 2 covers authoring) builds an image one instruction at a time. Every instruction that modifies the filesystem produces a new **layer** — a diff (tarball) of "what changed versus the previous layer."

```dockerfile
FROM ubuntu:24.04           # Layer 0: the base ubuntu rootfs
RUN apt-get update          # Layer 1: diff = the apt package index files it wrote
RUN apt-get install -y curl # Layer 2: diff = the curl binary + its dependencies
COPY ./app /app             # Layer 3: diff = your app files under /app
```

Each layer captures **only the delta**, not a full copy of the filesystem. Layer 3 doesn't contain ubuntu — it contains just `/app`.

```
   IMAGE = an ordered stack of read-only layers

   ┌────────────────────────────┐  Layer 3  COPY ./app /app   (top)
   ├────────────────────────────┤  Layer 2  RUN install curl
   ├────────────────────────────┤  Layer 1  RUN apt-get update
   ├────────────────────────────┤  Layer 0  FROM ubuntu:24.04 (base)
   └────────────────────────────┘
```

### The Union Filesystem (OverlayFS) — stacking layers into one view

How do separate diff layers become a single coherent `/` that the process sees? A **union filesystem** — on modern Docker, **OverlayFS**. It merges multiple directories ("lower" read-only layers + one "upper" writable layer) into a single unified mount.

```
                 What the process sees: a single merged /
   ┌─────────────────────────────────────────────────────────┐
   │                  merged view (overlay mount)             │
   └─────────────────────────────────────────────────────────┘
              ▲ overlay merges these bottom-up ▲
   ┌─────────────────────────────────────────────────────────┐
   │  UPPER (writable container layer)   ← writes land here   │
   ├─────────────────────────────────────────────────────────┤
   │  LOWER layer 3 (read-only image layer)                   │
   │  LOWER layer 2 (read-only image layer)                   │
   │  LOWER layer 1 (read-only image layer)                   │
   │  LOWER layer 0 (read-only image layer / base)            │
   └─────────────────────────────────────────────────────────┘
```

Rules of the merge: upper layers win. If `/etc/config` exists in layer 1 and is overwritten in layer 3, the process sees layer 3's version. Deleting a file from a lower layer is recorded with a special "whiteout" marker in the upper layer (you can't actually delete from a read-only layer — you mask it). This is why deleting a secret in a later Dockerfile `RUN` does **not** remove it from the image; the bytes still live in the earlier layer (Phase 2/7 — secrets in `docker history`).

### Content-addressed and shared

Each layer is identified by the **SHA256 hash of its contents** — it is *content-addressed*. Two images that share a base layer reference the **exact same** layer on disk; it's stored once.

```bash
docker pull node:20-alpine
docker pull node:20-alpine-something-else   # if it shares layers...
# ...the shared layers report "Already exists" instead of re-downloading.
```

```
   node:20-alpine            python:3.12-alpine
        │                          │
        └──────────┬───────────────┘
                   ▼
          alpine:3.x base layer  ← stored ONCE, referenced by both
```

This is the npm dedup / .NET NuGet global-package-cache idea applied to filesystem layers: identical content is stored once and shared. It's why pulling your tenth Alpine-based image is nearly instant — you already have the base.

### Container = read-only image layers + one thin writable layer (copy-on-write)

When you `docker run`, Docker adds **one** writable layer (the "upper" in the diagram) on top of the image's read-only layers. The process can read everything (merged view) and write anywhere — but writes never touch the image.

The mechanism is **copy-on-write (CoW)**:

- **Read** a file → served straight from whichever read-only image layer has it. Zero copying.
- **Write/modify** a file that lives in a read-only layer → the file is first **copied up** into the writable layer, then modified there. The original in the image layer is untouched.
- **New** file → created directly in the writable layer.

```
   Read /usr/bin/node      → read directly from image layer (shared, no copy)
   Modify /app/config.json → copy file UP into writable layer, then edit the copy
   Create /tmp/cache.dat   → created in writable layer
```

**Why this matters:**

1. **Many containers from one image are cheap.** Run 50 containers from the same image and you store the image layers *once*; each container only adds its own small writable layer. (50 copies of a heavy image would be wasteful — CoW avoids it.)
2. **The writable layer is ephemeral.** `docker rm` deletes it. Anything your app wrote to the container filesystem — uploaded files, a SQLite DB, logs written to disk — **is gone**. This is the #1 data-loss trap and the entire reason Volumes (Phase 4) exist. App data must go to a volume, never the container's writable layer.
3. **First write to a large file is slower** (the copy-up cost). Rarely matters, but it's why databases get a volume — you don't want CoW overhead on every page write.

### What `docker image inspect` actually shows: manifest, config, layers

An image on a registry is three kinds of things:

- **Manifest** — a JSON index: "this image = this config blob + these layer blobs (by digest), for this architecture." The thing a `@sha256:` digest actually points at.
- **Config** — JSON metadata: default `CMD`/`ENTRYPOINT`, `ENV`, `WORKDIR`, exposed ports, the ordered list of layer diff IDs, and the build history.
- **Layer blobs** — the gzipped tarballs of the actual filesystem diffs.

```bash
docker image inspect node:20-alpine
# Returns the config JSON. Useful fields:
#   .Config.Cmd / .Config.Entrypoint   → what runs by default
#   .Config.Env                        → baked-in environment variables
#   .RootFS.Layers                     → ordered SHA256 of each layer
#   .Architecture / .Os                → e.g. amd64 / linux

# Extract just one thing with Go templates (like jq, but built in):
docker image inspect node:20-alpine --format '{{.Config.Cmd}}'
# [node]

docker image inspect node:20-alpine --format '{{json .RootFS.Layers}}'
# ["sha256:...","sha256:...", ...]   ← the layer chain
```

---

## 1.3 Docker Architecture

"Docker" is not one program. When you type `docker run`, you're driving a **client** that hands work down a chain of increasingly low-level components. Understanding the chain demystifies a lot of error messages and lets you reason about what's actually running on the box.

```
   you ── docker run ──▶  docker CLI (client)
                              │  REST API over a UNIX socket
                              ▼  /var/run/docker.sock
                         dockerd  (the Docker daemon — long-running)
                              │  gRPC
                              ▼
                         containerd  (container lifecycle manager)
                              │  spawns a shim, then...
                              ▼
                         runc  (OCI runtime — actually creates the container)
                              │  clone() + namespaces + cgroups + pivot_root + exec
                              ▼
                         your process (PID 1 in the container)

   Separately:  dockerd ── pull/push ──▶  Registry (Docker Hub, GHCR, ECR...)
```

### docker CLI — the client

The `docker` command is **just a client**. It holds no containers and runs nothing itself. It serializes your command into an HTTP/REST call and sends it to the daemon. Mental model: the CLI is like `curl` hitting an API; `dockerd` is the API server. In fact you can talk to the daemon with raw curl:

```bash
# The CLI talks to the daemon over a UNIX domain socket by default:
curl --unix-socket /var/run/docker.sock http://localhost/v1.45/containers/json
# Returns the same JSON `docker ps` would render. The CLI is a thin wrapper over this API.
```

Because it's a network/socket API, your CLI can also point at a **remote** daemon via `DOCKER_HOST`. The client and the engine are decoupled on purpose.

### dockerd — the daemon

`dockerd` is the long-running background process (a system service). It owns the high-level concerns: the image store, networks, volumes, builds, the API surface the CLI calls. It does **not** itself create the low-level container — it delegates downward to containerd.

> **Security note you'll meet in Phase 7:** `dockerd` runs as **root**, and `/var/run/docker.sock` is the door to it. Anyone who can write to that socket can start a container that mounts the host's `/` and thereby own the machine. "Add my user to the `docker` group" is effectively "grant root." Treat the socket like root credentials.

### containerd — the container lifecycle manager

`containerd` is a daemon (an industry-standard, CNCF-graduated project — it's the same runtime Kubernetes uses directly, *without* Docker). `dockerd` delegates to it over gRPC. containerd manages the full lifecycle: pulling/unpacking images, managing snapshots (the layer storage), and supervising running containers. For each container it starts a small **shim** process so the container can keep running even if containerd restarts.

### runc — the OCI runtime that actually makes the container

`runc` is the lowest level: a small CLI that does the literal kernel calls to create a container — set up the namespaces, apply the cgroups, `pivot_root` into the image rootfs, and `exec` your process. It implements the **OCI Runtime Spec** (Open Container Initiative — the vendor-neutral standard for what a container is and how to run it). runc starts the container and then exits; the shim takes over supervision.

**The takeaway from this chain:** because each boundary is a standard (Docker uses the OCI image spec and OCI runtime spec, containerd is reusable, runc is swappable), nothing here is Docker-proprietary lock-in. An image you build with Docker runs on Kubernetes (which uses containerd + runc and never touches `dockerd`). This is why Phase 10's "Compose → K8s" migration is even possible: it's the *same* image format underneath.

### Registry — where images live

A **registry** is a server that stores and serves images (it speaks the OCI Distribution spec). Examples: Docker Hub (the default), GitHub Container Registry (GHCR), AWS ECR, Azure ACR, Google GCR. A registry holds **repositories**, each repository holds **tags/digests** pointing at manifests.

`docker pull` is: CLI → dockerd → resolve the reference → ask the registry for the manifest → download each layer blob it doesn't already have → store in the local image store (via containerd's snapshotter).

```bash
docker pull nginx:alpine
# nginx          ← repository
# :alpine        ← tag
# Implicit registry: docker.io (Docker Hub). Fully qualified it's:
#   docker.io/library/nginx:alpine
# GHCR example, fully qualified:
#   docker pull ghcr.io/some-org/some-app:1.2.3
```

If a registry host isn't specified, Docker assumes `docker.io`. If a namespace isn't specified for Docker Hub, it assumes `library/` (the namespace for Official Images) — that's why `nginx` resolves to `docker.io/library/nginx`.

---

## 1.4 Essential CLI — Images

These commands manage the local **image** store. Annotated so you know *why*, not just *what*.

```bash
docker pull nginx:alpine
# Download the nginx:alpine image into the local store. Pulls only layers you
# don't already have (content-addressed dedup). No container is created or run.

docker images
# List local images: REPOSITORY  TAG  IMAGE ID  CREATED  SIZE
# (`docker image ls` is the modern synonym — Docker reorganized commands into
#  `docker <object> <verb>` groups; old top-level forms still work as aliases.)

docker image inspect nginx:alpine
# Full metadata JSON: default Cmd/Entrypoint, Env, exposed ports, the layer chain,
# architecture/OS. Use --format '{{.Config.Cmd}}' to pull out a single field.

docker image history nginx:alpine
# Show the layer-by-layer build history: which instruction created each layer and
# how big each layer's diff is. THIS is how you find image bloat — the fat layer is
# usually a `RUN apt-get install ...` or a `COPY` of node_modules. Also where leaked
# secrets show up: build-time ARG/ENV values are visible here forever.

docker rmi nginx:alpine
# Remove (un-tag and delete) the image. Fails if a container — even a stopped one —
# still references it; remove the container first, or force with `docker rmi -f`.
# (`docker image rm` is the modern synonym.)

docker image prune
# Delete DANGLING images only: layers with no tag (<none>:<none>), typically
# orphaned by rebuilds where a tag moved to a newer image. Safe, frees disk.

docker image prune -a
# Delete ALL images not currently used by a container — not just dangling ones.
# Aggressive: you'll re-pull next time you need them. Great for reclaiming a full
# disk; dangerous if you expected an offline image to still be there.
```

Disk reality check — Docker silently hoards layers, build cache, dangling images, and dead containers:

```bash
docker system df            # show how much disk images / containers / volumes / cache use
docker system prune         # reclaim: stopped containers, unused networks, dangling images, build cache
docker system prune -a --volumes   # nuclear: also unused images AND unused volumes — careful with volumes!
```

---

## 1.5 Essential CLI — Containers

These run and manage **containers** (running or stopped instances of an image).

```bash
docker run nginx
# Create + start a container from nginx. FOREGROUND, attached: your terminal is now
# wired to the container's stdout/stderr. Ctrl-C sends SIGINT to PID 1 → stops it.
# (`run` = pull-if-needed + create + start, all in one.)

docker run -d nginx
# -d = detached: run in the background, print the container ID, return your prompt.
# This is how long-lived services are normally run.

docker run -d -p 8080:80 nginx
# -p HOST:CONTAINER publishes a port. Map host 8080 → container's port 80.
# WITHOUT -p the container's ports are NOT reachable from the host, even though the
# process is listening. The container's net namespace is isolated (see 1.1) — you
# must explicitly punch a hole. Browse http://localhost:8080 to hit nginx.

docker run -d --name web nginx
# --name gives a stable, human name instead of a random one ("web" vs "vibrant_swan").
# You can then target it by name in later commands. Names must be unique on the host.

docker run --rm nginx echo "hello"
# Two things: a trailing command ("echo hello") OVERRIDES the image's default CMD,
# and --rm auto-deletes the container the instant it exits. The container runs echo,
# prints hello, PID 1 exits → container stops → --rm removes it. Perfect for one-offs;
# without --rm you accumulate dozens of dead containers (see `docker ps -a`).

docker ps
# List RUNNING containers: ID, image, command, status, ports, name.

docker ps -a
# List ALL containers including stopped/exited ones. This is where "where did my
# container go?" gets answered — a crashed container is stopped, not deleted, and
# shows here with its exit code in STATUS (e.g. "Exited (137) 2 minutes ago").

docker stop web
# GRACEFUL stop: send SIGTERM to PID 1, wait up to 10s (--time to change), then SIGKILL
# if it hasn't exited. A well-behaved app catches SIGTERM and drains in-flight work.
# (Node: process.on('SIGTERM', ...);  .NET: IHostApplicationLifetime.ApplicationStopping.)

docker kill web
# IMMEDIATE SIGKILL — no grace period, no cleanup. The process is terminated hard.
# Use only when a container is wedged and ignoring SIGTERM.

docker rm web
# Remove a STOPPED container (frees its writable layer). Fails on a running container
# unless you force with -f (which kills then removes). This is also when container-only
# filesystem data is permanently destroyed.

docker logs web
# Print the container's captured stdout/stderr. Docker captures these by the json-file
# log driver. (Containerized apps log to stdout/stderr by CONVENTION — don't write to
# log files inside the container; let Docker/the platform collect the streams.)

docker logs -f web
# -f = follow (like `tail -f`): stream new log lines live until you Ctrl-C.

docker exec -it web sh
# Run a NEW process (an interactive shell) INSIDE an already-running container.
# -i keep stdin open, -t allocate a TTY. This does NOT restart the container — it
# joins the existing one's namespaces. Your way "inside" to poke around, check files,
# run diagnostics. (Try `bash` first; minimal images like alpine only ship `sh`.)

docker inspect web
# Full low-level JSON for the container: state, exit code, mounts, networks, the
# resolved config, env, IP address. The container-level twin of `docker image inspect`.

docker stats
# Live, streaming resource usage per running container (CPU %, mem usage/limit, net,
# block I/O) — read straight from cgroup counters. Add a name to scope: `docker stats web`.
```

`run` vs `start` vs `exec` — a frequent point of confusion:

- `docker run` → make a **new** container from an image and start it.
- `docker start web` → restart an **existing, stopped** container (same writable layer, same data).
- `docker exec web ...` → run an extra command **inside a running** container.

If you `docker run` every time you want to "restart my app," you create a brand-new container each time and silently pile up stopped ones. To restart *the same* container, use `docker start`/`docker restart`.

---

## 1.6 Tags, Digests & Image References

A full image reference has up to four parts:

```
   ghcr.io / some-org / api : 1.2.3
   └──┬───┘ └───┬────┘ └┬┘   └─┬─┘
   registry  namespace  repo   tag
```

### Tags — mutable, human-friendly pointers

A **tag** is a *named pointer* to a specific image, much like a **git branch** points to a commit. `nginx:1.25` means "whatever image the maintainer currently labels 1.25." Crucially, **tags are mutable**: the maintainer can move `nginx:1.25` to a new image (e.g. a patched 1.25.4) at any time. The tag string stays the same; the image it resolves to changes.

`latest` is **not magic** — it's just the conventional default tag applied when you don't specify one. `docker pull nginx` is exactly `docker pull nginx:latest`. It does **not** mean "newest" or "stable"; it means "the tag literally named latest," which the maintainer points wherever they like.

### Digests — immutable, content-addressed references

A **digest** references an image by the SHA256 hash of its manifest:

```
nginx@sha256:a1b2c3d4e5f6...        # pin to EXACT image content, forever
```

Because it's the hash of the content, a digest is **immutable** — it can only ever resolve to one exact image. If even one byte differed, the hash would differ. This is the git **commit SHA** to a tag's **branch name**: the branch moves, the SHA is permanent.

```bash
# See the digest of an image you've pulled:
docker images --digests nginx
# REPOSITORY  TAG     DIGEST                  IMAGE ID  ...
# nginx       alpine  sha256:abc123...        ...

docker image inspect nginx:alpine --format '{{json .RepoDigests}}'
# ["nginx@sha256:abc123..."]   ← the immutable reference for this exact image

# Pull by digest — guaranteed identical bytes everywhere, regardless of tag movement:
docker pull nginx@sha256:abc123...
```

### Why `latest` is dangerous in production

```bash
# Monday: latest points at image A. You deploy.
docker run -d myapp:latest        # runs image A
# Wednesday: maintainer (or your CI) moves latest to image B with a breaking change.
# A host that re-pulls now silently runs B. Two servers, "same tag," DIFFERENT code.
```

Consequences: no reproducibility (the same command yields different results over time), no clean rollback (there's no name for "the previous latest"), and "works on my machine" because your machine cached an older `latest`. The fix is the same discipline as not deploying off a moving git branch:

```bash
# Bad — moving target:
FROM node:latest
# Better — pinned semver tag (still mutable, but specific & rarely moves surprisingly):
FROM node:20.11.0-alpine
# Best for prod / supply-chain integrity — pin tag AND digest:
FROM node:20.11.0-alpine@sha256:abc123...
# The tag documents WHICH version; the digest guarantees the EXACT bytes.
```

### Semantic versioning tags — the rolling-pointer convention

Maintainers usually publish several tags pointing at the *same* image, at different precisions:

```
nginx:1.25.3   → exact patch. Moves essentially never. Most reproducible.
nginx:1.25     → "latest 1.25.x". Moves forward on each patch release.
nginx:1        → "latest 1.x.x". Moves on minor AND patch releases.
nginx:latest   → wherever the maintainer points it.
```

Trade-off: pin precisely (`1.25.3`) and you get reproducibility but must bump manually to get security patches; pin loosely (`1`) and you get patches automatically but lose reproducibility. Production leans precise (often tag-plus-digest); local dev can tolerate looser.

### Official vs user vs organization images

- **Official Images** — curated, maintained, security-scanned by Docker/upstream. No namespace prefix on Docker Hub: `nginx`, `node`, `postgres` (internally `library/nginx`). Default to these for base images.
- **User images** — `username/image`, e.g. `bitnami/postgresql`. Anyone's account; trust accordingly.
- **Organization images** — under an org namespace, e.g. `mcr.microsoft.com/dotnet/aspnet` (Microsoft's registry) or `ghcr.io/your-org/api`. Vendor- or team-owned.

Treat a random `someuser/database:latest` like a random npm package from an unknown author — you're running their code as (container) root. Prefer official images or verified publishers; in Phase 7 you'll scan whatever you use.

---

## 1.7 The Container Lifecycle

A container moves through a small set of states. Knowing them turns "my container disappeared" into "right, it exited and I didn't use `-a`."

```
            docker create / docker run
                       │
                       ▼
   ┌──────────┐  start  ┌──────────┐  pause   ┌──────────┐
   │ created  │────────▶│ running  │─────────▶│  paused  │
   └──────────┘         └────┬─────┘◀─────────└──────────┘
                             │      unpause
                  PID 1 exits│ / docker stop / kill
                             ▼
                       ┌──────────┐  docker rm  ┌──────────┐
                       │ exited   │────────────▶│ removed  │
                       │(stopped) │             │ (gone)   │
                       └────┬─────┘             └──────────┘
                            │ docker start
                            └──────────────▶ (back to running)
```

- **created** — container object + writable layer exist, but PID 1 hasn't started. (`docker create`, or the brief instant inside `docker run`.)
- **running** — PID 1 is alive. The container exists for exactly as long as this process does.
- **paused** — all processes frozen via the cgroup freezer (`docker pause`/`unpause`). They consume RAM but no CPU. Rarely used in practice.
- **exited (stopped)** — PID 1 has ended (clean exit, crash, or signal). The writable layer **still exists** — data and logs are recoverable, and `docker start` can bring it back. Visible only under `docker ps -a`.
- **removed** — `docker rm` deleted the container and its writable layer. Now it's truly gone; container-local data is unrecoverable.

The core rule again, because it governs everything here: **a container lives only as long as its PID 1 process.** A web server stays "running" because the server process blocks forever. `docker run ubuntu` exits *immediately* because `bash` with no TTY has nothing to do and returns — the container goes straight to `exited`. It didn't fail; PID 1 simply finished.

### Exit codes — read them, they tell you how it died

When a container exits, PID 1's exit code is recorded (see it in `docker ps -a` STATUS or `docker inspect --format '{{.State.ExitCode}}'`):

| Code | Meaning |
|------|---------|
| `0` | Clean success — the process finished normally. |
| `1` | General application error (an unhandled exception, a thrown error). |
| `125` | Docker itself failed (bad flag, bad image) — the container never started. |
| `126` | Command found but not executable (permission / not a binary). |
| `127` | Command **not found** (typo'd entrypoint, missing binary in a minimal image). |
| `137` | Killed by **SIGKILL** (128 + 9). Almost always an **OOM kill** (hit the memory cgroup limit) or `docker kill`. |
| `143` | Terminated by **SIGTERM** (128 + 15) — e.g. a `docker stop` the app honored. |

The `128 + signal` pattern is a UNIX convention shared by bash and any shell-spawned process — the same arithmetic you'd see scripting in Node's `child_process` or .NET's `Process.ExitCode`. So `137 = 128 + 9` (SIGKILL) and `143 = 128 + 15` (SIGTERM). Seeing `137` repeatedly screams "raise the memory limit or fix the leak," not "random crash."

### Restart policies — automatic recovery

By default a stopped container stays stopped. A **restart policy** (set at `run`) tells the daemon to bring it back automatically:

```bash
docker run -d --restart=no            nginx   # default: never auto-restart
docker run -d --restart=on-failure:5  nginx   # restart only on non-zero exit, max 5 attempts
docker run -d --restart=always        nginx   # always restart; also starts on Docker daemon boot
docker run -d --restart=unless-stopped nginx  # like always, BUT respects a manual `docker stop`
```

- `no` — never. Default.
- `on-failure[:N]` — restart only on a **non-zero** exit code (a crash), optionally capped at N tries. A clean exit (`0`) is left alone. Ideal for "keep this running, but if I cleanly shut it down, stay down."
- `always` — restart on any exit, *and* re-launch on daemon/host reboot. Even a manual `docker stop` is overridden once the daemon restarts.
- `unless-stopped` — same as `always`, except a container you **manually stopped** stays stopped across daemon restarts. Usually the one you want for long-lived services.

These are Docker's own supervision (think `systemd`/`pm2`/.NET's host restart, but at the container layer). In Compose this becomes the `restart:` field (Phase 5); in Kubernetes it becomes `restartPolicy` + the controller's reconciliation (Phase 10).

---

## Common Mistakes

- **Expecting a container to stay running with no foreground process.** `docker run ubuntu` exits instantly. A container lives only as long as PID 1. To keep an interactive one alive, give it something to block on: `docker run -it ubuntu bash` (the TTY keeps bash waiting on you). A service stays up because the server process blocks — not because Docker keeps the box open.

- **"My container disappeared."** It didn't — it stopped. `docker ps` only shows *running* containers. Use `docker ps -a` to see exited ones and read the exit code in STATUS. The container (and its logs) are still there until you `docker rm` them.

- **Writing app data to the container filesystem.** Uploads, a SQLite file, a database's data dir — anything written to the writable layer is **destroyed on `docker rm`** and isn't shared between containers. This is the biggest data-loss trap. App state belongs in a volume (Phase 4), never the container layer.

- **Forgetting `-p`, then "the server isn't reachable."** The process is listening, but the container's network namespace is isolated. Without `-p host:container` there's no path from the host. Also: the *left* number is the host port, the *right* is the container port — `-p 8080:80` ≠ `-p 80:8080`.

- **Thinking deleting a file in a later layer removes it from the image.** Layers are additive; a later layer only *masks* an earlier file with a whiteout. `RUN rm secret.txt` after `COPY secret.txt .` leaves the secret in an earlier layer — fully visible via `docker image history` / `docker save`. Never let a secret touch a layer in the first place.

- **Trusting `:latest`.** It's just the default tag name, not "newest" or "stable," and it's mutable. Two machines running `myapp:latest` can run different code. Pin a real version tag (and a digest in production).

- **`docker run` every time you mean "restart."** Each `run` builds a *new* container (fresh writable layer, lost data) and leaves the old one stopped, piling up clutter. Use `docker start`/`docker restart` to bring the *same* container back.

- **Reading `137` as a mystery crash.** `137 = 128 + 9` = SIGKILL, and on a container that's almost always the memory cgroup OOM-killing your process. The fix is raising `--memory` or fixing the leak, not retrying.

- **Confusing image and container commands.** `docker rmi` removes *images*; `docker rm` removes *containers*. `docker image inspect` vs `docker inspect` (the latter defaults to containers). And `docker rmi` will refuse while any container — even a stopped one — still references the image.

- **Treating "container root" as harmless.** UID 0 inside a container, with the kernel shared and a writable docker socket around, is a real escalation path to the host. Running as a non-root user (Phase 7) is not optional hardening for production.

---

## Phase 1 Exercise

**Task (from the plan):** Pull three images of different base types — `ubuntu`, `alpine`, and a `distroless` image — compare their sizes, inspect their layers, run a shell in each, and note what is (and isn't) available in each.

```bash
# 1. Pull one image of each base philosophy:
docker pull ubuntu:24.04                              # full-fat OS userland (~30MB compressed)
docker pull alpine:3.20                               # tiny, musl libc, busybox tools (~3.5MB)
docker pull gcr.io/distroless/nodejs20-debian12       # no shell, no package manager — runtime only

# 2. Compare sizes side by side:
docker images
#   Note the order-of-magnitude differences and WHY: ubuntu ships a whole userland,
#   alpine ships a minimal one, distroless ships essentially just the language runtime.

# 3. Inspect the layers of each:
docker image history ubuntu:24.04
docker image history alpine:3.20
docker image history gcr.io/distroless/nodejs20-debian12
#   Notice how few layers a base image has, and where the size sits.

# 4. Try to get a shell in each:
docker run --rm -it ubuntu:24.04 bash      # works — bash is present
docker run --rm -it alpine:3.20 sh         # works — but it's `sh` (busybox), not bash
docker run --rm -it gcr.io/distroless/nodejs20-debian12 sh
#   ^ This FAILS. Expected exit 127 / "no such file" — distroless has NO shell at all.
```

**What to observe and write up:**

- **Size:** rank them (alpine < distroless ≈ depends < ubuntu) and explain the *cause* — userland contents, not magic compression.
- **Tools available:** in `ubuntu` you have `apt`, `bash`, `curl`-able. In `alpine` you have `apk`, `sh`, busybox versions of common tools (note `bash` is absent unless installed). In `distroless` you have *nothing* to poke with — no shell, no package manager, no `ls`.
- **The trade-off:** ubuntu is the easiest to debug and the largest attack surface; distroless is the hardest to debug (you literally can't `exec` a shell) and the smallest attack surface. This is the exact tension Phase 2 (base image choice) and Phase 7 (security) build on.

**Hints / gotchas:**

- The distroless shell failure is the *point*, not a setup error — that's its security property (no shell = far less an attacker can do after a breach). Note the exit code (`127`, command not found).
- Use `alpine:3.20 sh`, not `bash` — Alpine doesn't ship bash by default. Confusing the two is a classic first stumble.
- To peek inside an image that has *no* shell, you can't `exec` — instead inspect statically: `docker image inspect ...` and `docker image history ...`, or (advanced) `docker save` the image to a tarball and extract the layers. This previews why Phase 6 keeps a separate, debuggable dev image from the lean prod one.
- Run everything with `--rm` so you don't accumulate dead containers; verify a clean slate afterward with `docker ps -a`.
