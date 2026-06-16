# Docker Learning Plan

**Learner profile:** Frontend/Node.js dev, familiar with basic `docker run`, learning .NET and Node.js backend in parallel  
**Goal:** Design, secure, and operate multi-container production systems  
**Pace:** Intensive alongside other tracks  

---

## How This Plan Works

- Each phase has theory + annotated examples + a hands-on exercise
- Notes go into `notes/XX-topic.md`; actual Dockerfiles/Compose files go in `examples/`
- Cross-references to `.net/` and `javascript/` tracks where Docker is the infrastructure layer
- The plan ends with a Kubernetes intro — not to become a K8s operator, but to understand why it exists and how Compose maps to it

---

## Phase 1 — Containers & Images: Core Concepts
**Estimated time:** ~3 days  
**Notes file:** `notes/01-containers-images.md`

### 1.1 What Is a Container (Not the Marketing Version)
- Linux primitives underneath: **namespaces** (pid, net, mnt, uts, ipc, user) and **cgroups**
- Namespaces: isolate what a process can *see* (filesystem, network, process tree)
- cgroups: limit what a process can *use* (CPU, memory, I/O)
- A container = a process (or group of processes) with restricted namespaces + cgroup limits
- VMs vs containers: VMs virtualise hardware; containers share the host kernel
- Why containers are fast to start: no OS boot, just a process fork

### 1.2 Images — Layers & the Union Filesystem
- An image = a read-only stack of filesystem layers (UnionFS / OverlayFS)
- Each Dockerfile instruction that changes the filesystem adds a layer
- Layers are content-addressed (SHA256 hashes) and shared across images
- Container = image layers (read-only) + one thin writable layer on top
- Copy-on-write: reads from image layers, writes go to container layer
- Image manifest, config, and layer tarballs — what `docker image inspect` shows

### 1.3 Docker Architecture
- Docker daemon (`dockerd`) — background process managing containers/images
- Docker CLI (`docker`) — client that talks to the daemon via UNIX socket
- containerd — lower-level runtime that dockerd delegates to
- runc — actually spawns the container process (OCI runtime)
- Registry — where images are stored (Docker Hub, GHCR, ECR, etc.)
- `docker pull` → registry → local image store

### 1.4 Essential CLI — Images
```
docker pull nginx:alpine          # pull image
docker images                     # list local images
docker image inspect nginx:alpine # full metadata
docker image history nginx:alpine # show layers
docker rmi nginx:alpine           # remove image
docker image prune                # remove dangling images
docker image prune -a             # remove ALL unused images
```

### 1.5 Essential CLI — Containers
```
docker run nginx                            # run (foreground, attached)
docker run -d nginx                         # detached (background)
docker run -d -p 8080:80 nginx             # map host:container port
docker run -d --name web nginx             # named container
docker run --rm nginx echo "hello"         # run + auto-remove on exit
docker ps                                  # running containers
docker ps -a                               # all containers including stopped
docker stop web                            # graceful stop (SIGTERM → SIGKILL after 10s)
docker kill web                            # immediate SIGKILL
docker rm web                              # remove stopped container
docker logs web                            # stdout/stderr
docker logs -f web                         # follow logs
docker exec -it web sh                     # interactive shell into running container
docker inspect web                         # full metadata JSON
docker stats                               # live resource usage
```

### 1.6 Tags, Digests & Image References
- `image:tag` — mutable pointer to an image version (`latest` is just another tag)
- `image@sha256:abc123...` — immutable content-addressed reference
- Why `latest` is dangerous in production: it can silently change
- Semantic versioning tags: `nginx:1.25.3`, `nginx:1.25`, `nginx:1`
- Official images vs user images vs organisation images

### 1.7 The Container Lifecycle
```
created → running → paused → running → stopped → removed
                           ↘ stopped (exited)
```
- Exit codes: `0` = success, `1` = general error, `137` = killed (OOM or SIGKILL), `143` = SIGTERM
- Restart policies: `no`, `always`, `on-failure`, `unless-stopped`

**Phase 1 Exercise:** Pull three images of different base types (ubuntu, alpine, distroless), compare sizes with `docker images`, inspect their layers with `docker image history`, run a shell in each, note what's available (or not) in each.

---

## Phase 2 — Writing Dockerfiles
**Estimated time:** ~4 days  
**Notes file:** `notes/02-dockerfiles.md`

### 2.1 Dockerfile Instructions — Complete Reference
- `FROM` — base image (every Dockerfile starts here)
- `RUN` — execute a command in a new layer
- `COPY` vs `ADD` — copy files (use `COPY`; `ADD` has implicit behaviour)
- `WORKDIR` — set working directory (also creates it)
- `ENV` — set environment variables (persist into runtime)
- `ARG` — build-time variables (not available at runtime)
- `EXPOSE` — document a port (does NOT publish — just metadata)
- `CMD` — default command when container starts (overridable)
- `ENTRYPOINT` — fixed executable; `CMD` becomes its arguments
- `USER` — switch to a non-root user
- `VOLUME` — declare a mount point
- `LABEL` — metadata key-value pairs
- `HEALTHCHECK` — how Docker tests if the container is healthy
- `ONBUILD` — instructions triggered when used as a base image

### 2.2 Layer Caching — The Key to Fast Builds
- Each instruction is a layer; Docker caches layers until one is invalidated
- Cache invalidation is top-down and sticky — if layer N is bust, N+1...end all rebuild
- **The golden rule:** order instructions from least-to-most frequently changing
- `COPY package.json .` then `RUN npm install` before `COPY . .` — so code changes don't reinstall deps
- `RUN --mount=type=cache` (BuildKit) — persistent cache across builds
- What breaks the cache: file changes, instruction text changes, base image updates

### 2.3 Multi-Stage Builds — The Most Important Pattern
- Problem: build tools (compilers, dev deps) in production images = bloat + attack surface
- Solution: multiple `FROM` stages; only copy artifacts from build stage to final stage
- Build stage has the full SDK; runtime stage has only the runtime
- Intermediate stages are discarded — not in the final image

```dockerfile
# Node.js example
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# Only dist + prod node_modules — no devDeps, no source
USER node
CMD ["node", "dist/main.js"]
```

```dockerfile
# ASP.NET Core example
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
USER app
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### 2.4 Base Image Choices
- `ubuntu` / `debian` — full OS, large, many tools, good for debugging
- `alpine` — ~5MB, musl libc, can cause issues with native modules
- `distroless` (Google) — no shell, no package manager, minimal attack surface
- `scratch` — literally empty; for static binaries only
- Size vs debuggability tradeoff — use distroless in production, full image for dev

### 2.5 `.dockerignore`
- Same syntax as `.gitignore`
- Always exclude: `node_modules`, `.git`, `.env`, `dist`, `*.log`, `coverage/`
- Critical: without `.dockerignore`, `COPY . .` sends everything to the daemon (slow + leaks secrets)

### 2.6 Build Arguments & Environment Variables
- `ARG` for build-time: `docker build --build-arg VERSION=1.2.3 .`
- `ENV` for runtime: available in the container, baked into image
- **Never put secrets in `ARG` or `ENV`** — they appear in `docker history` and image metadata
- Use Docker secrets or mount files at build time: `RUN --mount=type=secret,id=npmrc`

### 2.7 BuildKit Features
- Enable: `DOCKER_BUILDKIT=1` or `docker buildx build` (modern default)
- `--mount=type=cache` — persistent build cache (npm, pip, dotnet, apt)
- `--mount=type=secret` — inject secrets without baking them into layers
- `--mount=type=ssh` — forward SSH agent for private repos
- `--platform linux/amd64,linux/arm64` — multi-arch images

**Phase 2 Exercise:** Write a production-grade multi-stage Dockerfile for a Node.js Express app and a .NET API. Compare final image sizes. Verify build times with and without cache. Check `docker history` to confirm no secrets in layers.

---

## Phase 3 — Networking
**Estimated time:** ~3 days  
**Notes file:** `notes/03-networking.md`

### 3.1 Network Drivers Overview
- `bridge` — default; containers on the same bridge can talk to each other
- `host` — container shares host network stack; no isolation, best performance
- `none` — no networking at all
- `overlay` — multi-host networking (Swarm / K8s)
- `macvlan` — container gets its own MAC address on the physical network

### 3.2 The Default Bridge Network
- All containers on `docker0` bridge by default
- Containers communicate by IP only — no automatic DNS on the default bridge
- `docker run -p 8080:80 nginx` — publishes port 80 inside to 8080 on host
- Port mapping: `hostPort:containerPort`, or `containerPort` only (random host port)
- `docker port container_name` — see active port mappings

### 3.3 User-Defined Bridge Networks — Use These
- `docker network create mynet`
- Containers on the same user-defined bridge get **automatic DNS** by container name
- Isolated from other networks by default
- Better isolation than default bridge

```bash
docker network create mynet
docker run -d --name db --network mynet postgres
docker run -d --name app --network mynet -e DB_HOST=db myapp
# app can reach db at hostname "db" — built-in DNS
```

### 3.4 Container-to-Container Communication
- Same network: use container name as hostname (user-defined bridge)
- `host.docker.internal` — special DNS name to reach the host machine from inside a container (Mac/Windows built-in; Linux needs `--add-host`)
- Linking containers (legacy `--link`) — don't use this; use networks

### 3.5 DNS in Docker
- Each container gets its own `/etc/resolv.conf` pointing to Docker's embedded DNS (`127.0.0.11`)
- On user-defined networks, container names and aliases are registered
- `--network-alias` — give a container an extra DNS name on a network
- Network-scoped aliases — multiple containers can share an alias (round-robin DNS)

### 3.6 Network Inspection & Debugging
```bash
docker network ls
docker network inspect mynet
docker run --rm --network mynet nicolaka/netshoot nslookup db
docker run --rm --network mynet nicolaka/netshoot curl http://app:3000/health
```

**Phase 3 Exercise:** Create a two-container setup (app + database) on a custom network. Verify DNS resolution works. Try to reach one container from outside its network — confirm it fails.

---

## Phase 4 — Volumes & Storage
**Estimated time:** ~2 days  
**Notes file:** `notes/04-volumes-storage.md`

### 4.1 The Three Storage Options
- **Bind mounts** — map a host path into the container (`-v /host/path:/container/path`)
- **Named volumes** — Docker-managed storage (`-v myvolume:/container/path`)
- **tmpfs mounts** — in-memory, not persisted (`--tmpfs /tmp`)

### 4.2 Bind Mounts
- Good for: dev hot-reload, injecting config files, sharing build artifacts
- Bad for: production data — tied to host path, not portable
- File permission gotchas — container user may not match host user UID
- Read-only bind mounts: `-v ./config:/config:ro`

### 4.3 Named Volumes
- Docker manages the location (`/var/lib/docker/volumes/`)
- Survive container removal; must be explicitly deleted
- Portable — volume data can be backed up, moved
- Good for: database data, persistent app state

```bash
docker volume create pgdata
docker run -d -v pgdata:/var/lib/postgresql/data postgres
docker volume ls
docker volume inspect pgdata
docker volume rm pgdata   # only if no container is using it
docker volume prune       # remove all unused volumes
```

### 4.4 Volume Drivers & Plugins
- Default driver: `local` — host filesystem
- Third-party drivers: NFS, AWS EBS, Azure Disk — for shared/remote storage
- `--mount` syntax (preferred over `-v` for clarity):

```bash
docker run -d \
  --mount type=volume,source=pgdata,target=/var/lib/postgresql/data \
  postgres
```

### 4.5 Data Backup & Migration
```bash
# Backup a volume
docker run --rm \
  -v pgdata:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pgdata.tar.gz -C /data .

# Restore
docker run --rm \
  -v pgdata:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/pgdata.tar.gz -C /data
```

### 4.6 Filesystem Considerations
- Container writable layer — don't write application data here; it's gone on `docker rm`
- Volume vs bind mount for secrets — prefer secrets management over either
- Read-only root filesystem (`--read-only`) + tmpfs for writable paths = security hardening

**Phase 4 Exercise:** Run a PostgreSQL container with a named volume. Insert data. Stop and remove the container. Create a new container using the same volume — confirm data persisted. Then back up and restore the volume.

---

## Phase 5 — Docker Compose
**Estimated time:** ~4 days  
**Notes file:** `notes/05-compose.md`

### 5.1 What Compose Is and Isn't
- A tool for defining and running **multi-container** applications declaratively
- `docker-compose.yml` (v1 CLI) vs `docker compose` (v2 CLI plugin — use this)
- For local dev and simple deployments — NOT a production orchestrator (that's K8s/Swarm)

### 5.2 The `docker-compose.yml` Structure
```yaml
services:        # the containers
networks:        # custom networks
volumes:         # named volumes
configs:         # config files (Swarm feature, but can be used locally)
secrets:         # secrets (Swarm, or file-based locally)
```

### 5.3 Service Definition — Every Important Field
```yaml
services:
  api:
    image: myapp:latest          # use pre-built image
    build:                        # OR build from Dockerfile
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    container_name: api           # fixed name (avoid in scaling scenarios)
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/mydb
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy  # wait for health check, not just start
    networks:
      - backend
    volumes:
      - ./src:/app/src             # bind mount (dev hot-reload)
      - uploads:/app/uploads       # named volume
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
```

### 5.4 `depends_on` and Health Checks
- `depends_on` with `condition: service_started` — waits for container to start (not ready!)
- `depends_on` with `condition: service_healthy` — waits for health check to pass
- `depends_on` with `condition: service_completed_successfully` — for init containers
- Without `condition: service_healthy`, apps often start before the DB is accepting connections

### 5.5 Networks in Compose
- All services in a Compose file share a default network automatically
- Service names are DNS hostnames within that network
- Explicit networks for isolation between service groups:

```yaml
networks:
  frontend:
  backend:

services:
  nginx:
    networks: [frontend, backend]  # bridge between the two
  api:
    networks: [backend]
  db:
    networks: [backend]
```

### 5.6 Volumes in Compose
```yaml
volumes:
  pgdata:           # named volume, Docker-managed
  redisdata:

services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql/data
```

### 5.7 Profiles — Optional Services
```yaml
services:
  app:
    image: myapp
  mailhog:            # only starts with --profile tools
    image: mailhog/mailhog
    profiles: [tools]
  adminer:
    image: adminer
    profiles: [tools]
```
```bash
docker compose up                    # only starts services without a profile
docker compose --profile tools up    # also starts profiled services
```

### 5.8 Override Files
- `docker-compose.yml` — base (shared across all environments)
- `docker-compose.override.yml` — auto-merged for local dev (add ports, bind mounts, debug flags)
- `docker-compose.prod.yml` — production overrides

```bash
docker compose up                                              # uses base + override.yml
docker compose -f docker-compose.yml -f docker-compose.prod.yml up  # explicit files
```

### 5.9 Essential Compose Commands
```bash
docker compose up -d              # start in background
docker compose up -d --build      # rebuild images before starting
docker compose down               # stop and remove containers + networks
docker compose down -v            # also remove volumes
docker compose ps                 # status of services
docker compose logs api           # logs for a service
docker compose logs -f api        # follow logs
docker compose exec api sh        # shell into running container
docker compose run --rm api sh    # one-off shell (new container)
docker compose restart api        # restart a service
docker compose pull               # pull latest images
docker compose build              # build all images
docker compose config             # validate and print merged config
```

**Phase 5 Exercise:** Write a Compose file for: Node.js API + PostgreSQL + Redis + Nginx (reverse proxy). Add health checks to all services. Use profiles to add pgAdmin and Redis Commander as optional tools.

---

## Phase 6 — Development Workflows
**Estimated time:** ~3 days  
**Notes file:** `notes/06-dev-workflows.md`

### 6.1 Hot Reload in Containers
- Node.js: bind-mount `src/`, run with `nodemon` or `ts-node-dev` inside the container
- .NET: `dotnet watch` inside the container with source mounted
- Prevent mounting `node_modules` from host — use an anonymous volume trick:

```yaml
services:
  api:
    volumes:
      - .:/app               # mount source
      - /app/node_modules    # anonymous volume "shadows" node_modules mount
```

### 6.2 Environment Management
- `.env` file — automatically loaded by Compose for variable substitution in the YAML
- `env_file:` — inject a file of `KEY=VALUE` pairs into the container
- `environment:` — inline values; override `env_file` values
- Never commit `.env` — commit `.env.example` instead
- Multiple env files: `.env.local`, `.env.test`, `.env.production`

### 6.3 Debugging Inside Containers
- Interactive shell: `docker compose exec api sh`
- Attach a debugger: expose debug port (Node.js `--inspect=0.0.0.0:9229`)
- VS Code Remote Containers / Dev Containers extension
- `docker compose run --rm api node --inspect-brk dist/main.js`

### 6.4 Dev Containers (VS Code)
- `.devcontainer/devcontainer.json` — defines the development container
- VS Code opens the entire workspace inside the container
- Extensions, settings, port forwards all configured in the file
- Works with Compose: `dockerComposeFile` + `service` fields

### 6.5 Init Containers Pattern in Compose
- Use a service that runs migrations then exits:

```yaml
services:
  migrate:
    build: .
    command: ["npx", "prisma", "migrate", "deploy"]
    depends_on:
      db:
        condition: service_healthy

  api:
    build: .
    depends_on:
      migrate:
        condition: service_completed_successfully
```

### 6.6 Watching for Changes — Compose Watch (v2.22+)
```yaml
services:
  api:
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json
```
```bash
docker compose watch   # auto-sync changes, rebuild on dep changes
```

**Phase 6 Exercise:** Set up a full dev environment with hot reload for a Node.js API. Add a migrate service. Configure VS Code Dev Container. Verify source changes reflect without rebuilding.

---

## Phase 7 — Security
**Estimated time:** ~3 days  
**Notes file:** `notes/07-security.md`

### 7.1 Don't Run as Root
- Default: most base images run as root — a container escape = root on host
- Add a non-root user in your Dockerfile:

```dockerfile
# Node.js — node user is built into the official image
USER node

# Custom user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser
```

### 7.2 Read-Only Root Filesystem
```dockerfile
# In Compose
services:
  api:
    read_only: true
    tmpfs:
      - /tmp          # writable in-memory for temp files
      - /app/logs     # if app writes logs to filesystem
```
- Forces you to be explicit about what's writable — reduces attack surface

### 7.3 Drop Linux Capabilities
```yaml
services:
  api:
    cap_drop:
      - ALL              # drop everything
    cap_add:
      - NET_BIND_SERVICE # only add back what's needed
```

### 7.4 Secrets Management
- **Never** put secrets in environment variables in production (`docker inspect` exposes them)
- Docker secrets (Swarm) — encrypted, mounted as files at `/run/secrets/`
- Compose `secrets:` with `file:` source — for local dev only
- Production: AWS Secrets Manager, HashiCorp Vault, K8s Secrets, Doppler

```yaml
# dev-only file-based secret
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  api:
    secrets:
      - db_password
    # available at /run/secrets/db_password inside container
```

### 7.5 Image Scanning
- `docker scout cves myimage:latest` — Docker Scout (built-in, replaces Snyk in Docker Desktop)
- `trivy image myimage:latest` — Aqua Trivy (open source, excellent)
- `grype myimage:latest` — Anchore Grype
- Pin base image versions AND digests in production: `FROM node:20.11.0-alpine@sha256:abc...`

### 7.6 Minimise the Attack Surface
- Use `distroless` or `alpine` — fewer binaries = fewer CVEs
- Multi-stage: build tools don't exist in the runtime image
- Don't install debugging tools in production images
- Avoid `apt-get upgrade` in Dockerfiles — unpinned upgrades break reproducibility
- Use `COPY --chown` to set correct file ownership without running as root

### 7.7 Network Security
- Don't expose container ports unless needed: remove `ports:` mappings in production
- Use internal networks for service-to-service traffic
- Expose only the ingress (Nginx/traefik) publicly

**Phase 7 Exercise:** Audit an existing Dockerfile for security issues: running as root, exposed secrets, unpinned base image, unnecessary capabilities. Apply all fixes. Run Trivy against before and after — compare CVE count.

---

## Phase 8 — CI/CD Integration
**Estimated time:** ~3 days  
**Notes file:** `notes/08-cicd.md`

### 8.1 Docker in GitHub Actions
```yaml
# .github/workflows/docker.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha        # GitHub Actions cache
          cache-to: type=gha,mode=max
```

### 8.2 Layer Caching in CI
- Without caching: every CI run rebuilds all layers — slow and expensive
- `type=gha` — GitHub Actions cache (built into docker/build-push-action)
- `type=registry` — cache in the registry itself (works on any CI)
- `type=s3` — S3/R2 bucket as cache (enterprise scale)
- Max mode vs min mode: max caches all intermediate layers; min caches only final

### 8.3 Build Optimisation
- Pass `--build-arg BUILDKIT_INLINE_CACHE=1` to embed cache metadata in the image
- Multi-platform builds with `--platform linux/amd64,linux/arm64` (required for Apple Silicon deployments)
- `docker buildx bake` — build multiple images from a single HCL file

### 8.4 Running Tests Inside Docker in CI
```yaml
- name: Run tests
  run: docker compose -f docker-compose.test.yml run --rm test
```
- `docker-compose.test.yml` — dedicated Compose file for test environment
- Testcontainers in CI: either Docker-in-Docker (DinD) or host Docker socket

### 8.5 Image Tagging Strategy
- `latest` — don't use in CI/CD (no rollback, no traceability)
- `git SHA` — exact traceability: `myapp:a3f9b1c`
- Semantic version: `myapp:1.2.3`, `myapp:1.2`, `myapp:1`
- Both: tag with SHA + semver on release

### 8.6 Registries
- Docker Hub — public default; rate-limited for free accounts
- GHCR (GitHub Container Registry) — free for public repos, good GitHub integration
- ECR (AWS), GCR (Google), ACR (Azure) — cloud-native, integrate with IAM
- Self-hosted: Harbour, Gitea

**Phase 8 Exercise:** Write a GitHub Actions workflow that: builds the image, runs tests, scans with Trivy (fail on HIGH/CRITICAL), pushes to GHCR on main branch with SHA tag.

---

## Phase 9 — Production Patterns
**Estimated time:** ~3 days  
**Notes file:** `notes/09-production.md`

### 9.1 Health Checks
- Docker health checks: tells Docker if the container is healthy
- Orchestrators (K8s, ECS) use this for traffic routing and restarts
- Liveness: is the app alive? Readiness: is it ready to serve traffic?

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### 9.2 Graceful Shutdown
- Docker `stop` sends SIGTERM → waits `--stop-timeout` seconds → sends SIGKILL
- Your app must catch SIGTERM and drain in-flight requests before exiting
- Node.js: `process.on('SIGTERM', () => server.close(() => process.exit(0)))`
- .NET: `IHostApplicationLifetime.ApplicationStopping`
- If PID 1 doesn't handle signals properly, use `tini` as init process:

```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

### 9.3 Resource Limits
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
```
- Without limits, one container can starve others on the host
- Set memory limit below what you'd expect the app to use at peak — OOM kills are a signal

### 9.4 Logging
- Containers log to stdout/stderr — that's the convention, not an option
- Docker log drivers: `json-file` (default), `syslog`, `journald`, `fluentd`, `awslogs`
- `json-file` with rotation:

```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```
- Production: ship logs to a centralised system (ELK, Loki, Datadog) via a sidecar or log driver

### 9.5 Multi-Container Deployment Patterns
- Single host with Compose: simplest, fine for small apps
- `docker compose up` on a server behind Nginx — the basic VPS deployment
- Docker Swarm: multi-host, built-in, simpler than K8s but less ecosystem
- When to stop using Compose alone and reach for Swarm or K8s

### 9.6 Nginx as Reverse Proxy
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 9.7 Rolling Deployments Without Downtime
- Blue/green: run two versions, switch traffic, keep old as rollback
- `docker compose pull && docker compose up -d` — pulls new images, recreates containers (brief downtime)
- Zero-downtime: Swarm rolling updates, or K8s RollingUpdate strategy
- Caution: database migrations must be backwards-compatible during rollout

**Phase 9 Exercise:** Deploy a full stack (API + DB + Nginx) to a VPS using Docker Compose. Configure health checks, resource limits, log rotation, and graceful shutdown. Test rolling update by changing the API image tag.

---

## Phase 10 — Kubernetes Intro
**Estimated time:** ~4 days  
**Notes file:** `notes/10-kubernetes-intro.md`

### 10.1 Why Kubernetes (The Real Answer)
- Compose is for one host; K8s is for many hosts (cluster)
- Self-healing: restarts failed pods, replaces unhealthy nodes
- Auto-scaling: horizontal pod autoscaler responds to CPU/memory
- Rolling updates: zero-downtime deploys with automatic rollback
- Service discovery + load balancing built in
- When you do NOT need K8s: single-server apps, small teams, Compose + managed DB is fine

### 10.2 Core Concepts — Compose → K8s Mapping

| Docker Compose | Kubernetes |
|----------------|-----------|
| service | Deployment + Service |
| container | Pod (one or more containers) |
| named volume | PersistentVolumeClaim |
| network | Service (ClusterIP) |
| ports: | Service (NodePort / LoadBalancer) |
| env_file | ConfigMap / Secret |
| healthcheck | livenessProbe / readinessProbe |
| restart: always | restartPolicy: Always |
| replicas: | `spec.replicas` in Deployment |

### 10.3 Running K8s Locally
- `minikube` — single-node K8s cluster in a VM or container
- `kind` (K8s in Docker) — multi-node cluster using Docker containers as nodes
- `k3d` — k3s (lightweight K8s) in Docker — fastest for dev

```bash
# kind
kind create cluster --name dev
kubectl cluster-info --context kind-dev
```

### 10.4 Essential kubectl
```bash
kubectl get pods
kubectl get deployments
kubectl get services
kubectl describe pod <name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- sh
kubectl apply -f manifest.yaml
kubectl delete -f manifest.yaml
kubectl rollout status deployment/api
kubectl rollout undo deployment/api   # rollback
```

### 10.5 A Minimal Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
          resources:
            limits:
              memory: "256Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3000
```

### 10.6 ConfigMaps & Secrets
```bash
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgres://..."
kubectl create configmap app-config \
  --from-file=config.json
```

### 10.7 Helm — Package Manager for K8s
- Helm charts = reusable K8s application packages (like npm packages)
- `values.yaml` — configuration overrides
- `helm install`, `helm upgrade`, `helm rollback`
- Public charts: `helm repo add bitnami https://charts.bitnami.com/bitnami`

**Phase 10 Exercise:** Migrate the Phase 9 Compose deployment to K8s using kind. Write Deployment + Service manifests. Use a Secret for the DB password. Verify rolling update works (`kubectl rollout status`).

---

## Cross-Cutting: Best Practices Reference

### Dockerfile Checklist
- [ ] Multi-stage build — no build tools in final image
- [ ] Non-root user (`USER`)
- [ ] `.dockerignore` excludes `node_modules`, `.git`, `.env`
- [ ] Dependencies installed before source copy (layer cache)
- [ ] Pinned base image tag (`node:20.11.0-alpine`, not `node:latest`)
- [ ] `HEALTHCHECK` defined
- [ ] No secrets in `ENV` or `ARG`
- [ ] Minimal base image (alpine/distroless where practical)

### Compose Checklist
- [ ] `depends_on` uses `condition: service_healthy` where needed
- [ ] All services have `healthcheck:`
- [ ] Named volumes for any persistent data
- [ ] No bind-mounting `node_modules` from host
- [ ] Resource limits on all services
- [ ] Log rotation configured
- [ ] `.env.example` committed (not `.env`)
- [ ] Profiles for optional tooling services

### Common Size Reference

| Base Image | Compressed Size |
|------------|----------------|
| ubuntu:24.04 | ~30MB |
| debian:slim | ~28MB |
| node:20-alpine | ~45MB |
| node:20-slim | ~65MB |
| mcr.microsoft.com/dotnet/aspnet:10.0 | ~120MB |
| gcr.io/distroless/nodejs20-debian12 | ~55MB |
| alpine:3.20 | ~3.5MB |
| scratch | 0MB |

---

## Milestones

| Milestone | What you can do |
|-----------|----------------|
| After Phase 2 | Write production-quality Dockerfiles for any app |
| After Phase 3 | Reason about container networking — debug connection issues |
| After Phase 5 | Define any multi-service stack in Compose |
| After Phase 6 | Efficient local dev with hot-reload inside containers |
| After Phase 7 | Harden containers for production security |
| After Phase 8 | Full CI/CD pipeline: test → scan → build → push |
| After Phase 9 | Deploy and operate containerized apps on a VPS |
| After Phase 10 | Migrate a Compose stack to Kubernetes |
