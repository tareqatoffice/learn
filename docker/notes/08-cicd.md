# Phase 8 — CI/CD Integration

---

The shift here is mental more than technical. On your laptop, `docker build` is incremental — BuildKit keeps a local cache, so editing one line of code rebuilds two layers, not the whole image. **CI runners are ephemeral.** Every job starts on a fresh VM with an empty Docker cache. Without help, every push does a *cold build*: re-run `npm ci`, re-download every base layer, recompile everything. A 4-minute incremental build becomes a 9-minute cold build, every single time.

So Phase 8 is really about two problems:
1. **Making CI builds fast** despite ephemeral runners (caching, optimisation).
2. **Making CI builds trustworthy** — test inside the same image you ship, tag for traceability, push to a registry you control.

If you know `git` and have used GitHub before, the YAML below will feel like reading a slightly verbose shell script. That's all a workflow is: a list of steps run top-to-bottom on a rented Linux box.

---

## 8.1 Docker in GitHub Actions

### The anatomy of a workflow

A GitHub Actions workflow is a YAML file under `.github/workflows/`. It has **triggers** (`on:`), one or more **jobs**, and each job has **steps**. Steps are either a shell command (`run:`) or a reusable action (`uses:`). Think of `uses:` like importing an npm package — someone published a unit of behaviour, you call it with `with:` arguments.

Here is a complete, realistic build-and-push workflow, fully annotated:

```yaml
# .github/workflows/docker.yml
name: Build & Push Image

on:
  push:
    branches: [main]          # build on every push to main
    tags: ["v*.*.*"]          # AND on semver tags like v1.4.2 (for releases)
  pull_request:               # also build PRs (but we won't push them — see below)

# Least-privilege permissions for the GITHUB_TOKEN this job receives.
# By default the token can't write packages; GHCR needs that explicitly.
permissions:
  contents: read              # to checkout code
  packages: write             # to push to ghcr.io

jobs:
  build:
    runs-on: ubuntu-latest    # the ephemeral VM — fresh every run, empty Docker cache

    steps:
      # 1. Pull your repo onto the runner. Without this, the runner is empty.
      - name: Checkout
        uses: actions/checkout@v4

      # 2. Install QEMU — only needed if you build for non-native CPU arches
      #    (e.g. arm64 images from an amd64 runner). Safe to keep; cheap.
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      # 3. Set up Buildx. This swaps Docker's classic builder for the BuildKit
      #    backend, which is what enables: external cache (type=gha/registry),
      #    multi-platform builds, and cache mounts. build-push-action REQUIRES this.
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # 4. Authenticate to the registry so we can push.
      #    github.actor = the user/bot that triggered the run.
      #    secrets.GITHUB_TOKEN = an auto-injected, short-lived token. You do NOT
      #    create this — Actions provides it. The `packages: write` permission
      #    above is what lets it push to GHCR.
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # 5. Compute tags & labels from git context. This action turns branch names,
      #    tags, and SHAs into a clean list of image tags so you don't hand-write
      #    them. See 8.5 for the tagging rationale.
      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}   # e.g. ghcr.io/tareq/myapp
          tags: |
            type=sha,prefix=,format=short    # short git SHA → myapp:a3f9b1c
            type=ref,event=branch            # branch name  → myapp:main
            type=semver,pattern={{version}}  # on v1.4.2 tag → myapp:1.4.2
            type=semver,pattern={{major}}.{{minor}}  #          → myapp:1.4

      # 6. The actual build. build-push-action wraps `docker buildx build`.
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .                              # build context = repo root
          file: ./Dockerfile                      # explicit Dockerfile path
          platforms: linux/amd64,linux/arm64      # multi-arch (see 8.3)
          # Only push on real pushes, never on pull_request events. A PR from a
          # fork shouldn't be able to publish an image. This is a security gate.
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}    # the tag list from step 5
          labels: ${{ steps.meta.outputs.labels }} # OCI labels (source, revision)
          cache-from: type=gha                    # READ cache from GitHub's cache
          cache-to: type=gha,mode=max             # WRITE cache back (see 8.2)
```

### Why each piece exists

- **`actions/checkout`** — the runner starts empty. No code until you check it out.
- **`setup-buildx-action`** — the classic Docker builder can't use `type=gha` cache or do multi-platform. Buildx (BuildKit) can. This is the single most important enabler in the file.
- **`login-action`** — pushing requires auth. `GITHUB_TOKEN` is ephemeral and scoped to this repo, which is far safer than a long-lived PAT.
- **`metadata-action`** — separates *tag policy* from *build mechanics*. You change tagging rules in one place.
- **`build-push-action`** — does build + push + cache wiring in one step, with first-class cache support that raw `docker build` in a `run:` step would make you script by hand.

> Mental model for a Node dev: `uses: docker/build-push-action@v5` is `import buildPush from 'docker/build-push-action'` pinned to a major version. `with:` is the options object. `steps.meta.outputs.tags` is reading a return value from an earlier function call.

---

## 8.2 Layer Caching in CI

### Why this matters (the teaching point)

A Docker image is a stack of layers. Each Dockerfile instruction produces one. On your laptop, BuildKit stores those layers locally, so a rebuild only re-runs instructions *at and after* the first changed line. That is **incremental build**, and it's the whole reason a well-ordered Dockerfile (deps before source) is fast to iterate on.

A CI runner has no local cache — it's a brand-new VM. So unless you give BuildKit somewhere external to read its previous layers from, every run is a **cold build**: it re-executes `RUN npm ci`, re-pulls base images, recompiles native modules. That's wasted minutes and money on every commit, even when you only changed a README.

The fix is **remote cache import/export**: at the end of a build, push the layer cache somewhere durable (`cache-to`); at the start of the next build, pull it back (`cache-from`). BuildKit then matches incoming instructions against the imported cache and skips anything unchanged — incremental builds, on ephemeral runners.

```
Laptop:                          CI runner (ephemeral):
┌──────────────┐                 ┌──────────────┐   ┌─────────────────┐
│ local cache  │ ← reused        │ empty cache  │ ──▶│ remote cache    │
│ every build  │   automatically │ every run    │ ◀──│ (gha/registry)  │
└──────────────┘                 └──────────────┘   └─────────────────┘
                                  cache-from reads ↑   cache-to writes ↑
```

### `type=gha` — GitHub Actions cache (and how it works)

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

`type=gha` uses the **GitHub Actions Cache service** — the same backing store as `actions/cache`, but BuildKit talks to it directly via the Cache API. Mechanically:

- At build end, BuildKit serialises its layer blobs + a manifest and uploads them to the GHA cache, keyed by scope (branch/ref).
- On the next run, `cache-from: type=gha` downloads that manifest, and for each instruction BuildKit checks "do I already have this layer?" If yes → cache hit, skip execution.
- The cache is **scoped per branch** with fallback to the default branch, and subject to GitHub's cache eviction (10 GB/repo limit, LRU). So your `main` builds warm the cache that PR builds then read from.

It's the path of least resistance on GitHub: zero infra, built into `build-push-action`. The catch is the 10 GB repo cap and occasional eviction on busy repos.

### `type=registry` — cache in the registry itself

```yaml
cache-from: type=registry,ref=ghcr.io/myorg/myapp:buildcache
cache-to:   type=registry,ref=ghcr.io/myorg/myapp:buildcache,mode=max
```

Stores the cache as a **separate image tag** in your registry. Pros: works on *any* CI (GitLab, CircleCI, Jenkins, self-hosted), survives across runners and even across repos, no GitHub cap. Cons: you manage a `:buildcache` tag (and its lifecycle/cleanup), and it costs registry storage + pull bandwidth.

This is the portable choice. If you ever leave GitHub Actions, this keeps working.

### `type=s3` (and `type=gcs`, `type=azblob`) — object storage cache

```yaml
cache-to: type=s3,region=eu-west-1,bucket=my-buildcache,name=myapp,mode=max
cache-from: type=s3,region=eu-west-1,bucket=my-buildcache,name=myapp
```

Cache blobs live in an S3 bucket (or R2/GCS/Azure Blob). For **enterprise scale**: shared across many pipelines and runners, with bucket lifecycle rules for eviction, no 10 GB cap, and you control the region/cost. More setup (IAM/credentials, bucket policy), so reach for it only when `gha`/`registry` actually hurt.

### `mode=max` vs `mode=min`

This controls **how much** gets exported, and it's a real footgun:

- **`mode=min`** (the default) — exports cache only for layers in the **final image**. In a multi-stage build, intermediate stages (your `builder` stage with the full SDK, `npm ci`, compilation) are **not cached**. So the expensive build stage runs cold every time even though the small runtime stage is cached. Usually the *opposite* of what you want.
- **`mode=max`** — exports cache for **every layer of every stage**, including the build stage. Bigger cache upload, but the expensive `RUN npm ci` / `dotnet restore` / compile steps get cache hits. For multi-stage builds (which is all production Dockerfiles), **you almost always want `mode=max`.**

```yaml
# Multi-stage build → you want the builder stage cached:
cache-to: type=gha,mode=max   # ✅ caches builder stage too
# cache-to: type=gha          # ⚠️ mode=min: builder stage rebuilds cold every run
```

---

## 8.3 Build Optimisation

### `BUILDKIT_INLINE_CACHE` — cache metadata baked into the image

Before `type=gha`/`type=registry` existed as first-class options, the trick was to embed cache metadata *inside the pushed image itself*, then use that image as a cache source on the next run:

```yaml
- name: Build with inline cache
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/myorg/myapp:latest
    build-args: |
      BUILDKIT_INLINE_CACHE=1            # write cache manifest into the image
    cache-from: type=registry,ref=ghcr.io/myorg/myapp:latest  # reuse it next time
```

What it does: with `BUILDKIT_INLINE_CACHE=1`, BuildKit writes the layer-cache manifest into the image's metadata. Next build, `cache-from` pointing at that same image tag can reconstruct the cache from the pushed layers — **no separate cache store needed**. The limitation: inline cache is effectively `mode=min` only (it can't carry intermediate build-stage layers), so for multi-stage builds a dedicated `type=gha`/`type=registry` with `mode=max` caches more. Inline cache is the "good enough, zero extra infra" option.

### Multi-platform builds with Buildx

Apple Silicon laptops and AWS Graviton are `arm64`; most CI runners and older servers are `amd64`. A single-arch image fails to run (or runs slowly under emulation) on the wrong CPU. Buildx builds a **multi-arch manifest** — one tag that resolves to the right architecture per puller:

```yaml
- name: Set up QEMU            # emulates arm64 on an amd64 runner
  uses: docker/setup-qemu-action@v3
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
- name: Build multi-arch
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    platforms: linux/amd64,linux/arm64   # one tag, two architectures
    tags: ghcr.io/myorg/myapp:1.4.2
```

How it works: QEMU lets the amd64 runner *emulate* arm64 to run that arch's build steps; Buildx builds each platform, then publishes an **OCI image index** (a manifest list) under one tag. `docker pull` on an M2 Mac gets arm64; on an EC2 amd64 box gets amd64 — transparently. Note: emulated arm64 builds are **slow** (native instructions run through QEMU). For heavy builds, consider native arm64 runners instead of emulation.

### `docker buildx bake` — build many images declaratively

When you have several images (api, worker, migrations) you don't want a giant shell loop. `bake` is to `docker build` what Compose is to `docker run` — a declarative file describing multiple build targets:

```hcl
# docker-bake.hcl
group "default" {
  targets = ["api", "worker"]    # `bake` with no args builds both
}

target "api" {
  context    = "."
  dockerfile = "Dockerfile.api"
  platforms  = ["linux/amd64", "linux/arm64"]
  tags       = ["ghcr.io/myorg/api:latest"]
  cache-from = ["type=gha,scope=api"]
  cache-to   = ["type=gha,scope=api,mode=max"]
}

target "worker" {
  context    = "."
  dockerfile = "Dockerfile.worker"
  tags       = ["ghcr.io/myorg/worker:latest"]
  cache-from = ["type=gha,scope=worker"]   # separate cache scope per image
  cache-to   = ["type=gha,scope=worker,mode=max"]
}
```

```bash
docker buildx bake                 # builds the "default" group (api + worker) in parallel
docker buildx bake api             # build just one target
docker buildx bake --push          # build all and push
docker buildx bake --print         # dump the resolved config as JSON (validate, no build)
```

Bake builds targets **in parallel** and shares layers between them where possible. Use a distinct `scope=` per target so their caches don't clobber each other. There's a `docker/bake-action` for calling it from a workflow.

---

## 8.4 Running Tests Inside Docker in CI

The principle: **test the artifact you ship.** Running tests on the bare runner (host Node, host Postgres) tests a *different environment* than production. Running them inside containers — ideally the same image you build — closes that gap.

### A dedicated test Compose file

Keep a separate Compose file so the test environment (test DB, fixtures, run-once-and-exit semantics) never bleeds into dev or prod:

```yaml
# docker-compose.test.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    # health check so the test service waits until Postgres ACCEPTS connections,
    # not just until the container starts (a classic flaky-CI cause).
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d testdb"]
      interval: 5s
      timeout: 3s
      retries: 10

  test:
    build:
      context: .
      target: test            # a multi-stage "test" stage with devDeps + test runner
    environment:
      DATABASE_URL: postgres://postgres:test@db:5432/testdb
    depends_on:
      db:
        condition: service_healthy   # don't start tests before DB is ready
    # `test` is a one-shot: it runs the suite and exits with the suite's code.
    command: ["npm", "test"]
```

```yaml
# In the workflow:
- name: Run tests in Docker
  run: |
    # --build: rebuild the test image; --abort-on-container-exit: stop the whole
    # stack as soon as `test` exits; --exit-code-from test: make `docker compose`
    # return the TEST service's exit code so a failing suite fails the CI job.
    docker compose -f docker-compose.test.yml up \
      --build --abort-on-container-exit --exit-code-from test
- name: Tear down
  if: always()                      # run even if tests failed
  run: docker compose -f docker-compose.test.yml down -v   # -v: drop the test DB volume
```

The `--exit-code-from test` flag is the load-bearing detail: without it, `docker compose up` returns 0 even when your test suite failed, and CI goes green on broken code.

### Testcontainers in CI — DinD vs host socket

[Testcontainers](https://testcontainers.com/) (you'll meet it in the JS track's Phase 7) spins up real dependencies — a real Postgres, Kafka, etc. — *from inside your test code*, programmatically. In CI this needs your test process to be able to talk to a Docker daemon. Two ways:

**Option A — Host Docker socket (recommended on GitHub Actions):**

```yaml
- name: Tests with Testcontainers
  run: npm run test:integration
  # GitHub-hosted runners already have Docker running. Testcontainers
  # auto-detects /var/run/docker.sock and launches sibling containers on the
  # host daemon. Nothing to configure — this "just works" on ubuntu-latest.
```

This is **Docker-out-of-Docker / sibling containers**: your test process (or its container) uses the *host's* daemon, so Testcontainers' containers are siblings, not nested. Fast, no privileged mode. If your tests themselves run inside a container, mount the socket: `-v /var/run/docker.sock:/var/run/docker.sock`.

**Option B — Docker-in-Docker (DinD):**

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      dind:
        image: docker:27-dind
        options: --privileged        # DinD needs privileged mode
    steps:
      - uses: actions/checkout@v4
      - name: Tests against DinD daemon
        env:
          DOCKER_HOST: tcp://localhost:2375   # point Testcontainers at the nested daemon
        run: npm run test:integration
```

DinD runs a **whole second Docker daemon** inside a container. Use it when you need isolation between the CI daemon and test containers, or on platforms (GitLab CI commonly) where mounting the host socket isn't available. Downsides: needs `--privileged` (a security concession), is slower (cold daemon, no shared image cache), and is fiddlier to wire up. **Default to the host socket; reach for DinD only when forced.**

---

## 8.5 Image Tagging Strategy

### Why not `latest`

`latest` is just a tag like any other — it is **not** "the newest" automatically; it's whatever you last pushed there. In CI/CD it's actively harmful:

- **No traceability** — "prod is running `latest`" tells you nothing about *which commit* is live. You can't map an incident back to a diff.
- **No rollback** — if `latest` is broken, there's no previous `latest` to revert to; you've overwritten it.
- **Cache/pull ambiguity** — a node pulling `latest` may get a stale cached image; `imagePullPolicy` and CDN caches make "what's actually running" nondeterministic.

### Git SHA — the foundation

```
ghcr.io/myorg/myapp:a3f9b1c        # short SHA of the exact commit
```

A SHA tag is **immutable and exact**: it maps one-to-one to a commit. Every build gets one. This is what you deploy and what you roll back to. You can always answer "what's running?" → `git show a3f9b1c`. Make this the tag your deployment manifests reference.

### Semantic version — for releases

```
ghcr.io/myorg/myapp:1.4.2          # exact release
ghcr.io/myorg/myapp:1.4            # moving pointer → latest patch of 1.4
ghcr.io/myorg/myapp:1              # moving pointer → latest minor of 1.x
```

On a release (a `v1.4.2` git tag), publish the cascade above. Consumers pick their risk tolerance: pin `1.4.2` for reproducibility, track `1.4` for auto-patches. The `metadata-action` config in 8.1 generates these from the git tag automatically.

### Both, in practice

Tag **every** build with the SHA (always traceable); tag **release** builds *additionally* with semver. That's exactly what the `tags:` block in the 8.1 `metadata-action` does — SHA on every push, semver only on `v*.*.*` tags. Deploy by SHA; let humans reason in semver.

---

## 8.6 Registries

A registry is just a server that stores image layers + manifests, addressed by content hash. Where you push matters for cost, auth, and rate limits.

### Docker Hub — and the rate limit trap

The public default. The gotcha that bites CI hard: **anonymous and free-tier pulls are rate-limited** (historically ~100 pulls / 6h anonymous, 200 authenticated — limits change, check current policy). A busy CI pipeline pulling `node:20-alpine` on every cold job hits this fast and starts failing with `toomanyrequests`. Mitigations:

- **Authenticate** your pulls even for public images (`docker/login-action` against `docker.io`) — authenticated limits are higher.
- **Mirror** base images into your own registry (GHCR/ECR) and pull from there.
- Use a **pull-through cache** mirror.

### GHCR — GitHub Container Registry

```
ghcr.io/<owner>/<image>:<tag>
```

Free for public images, tight GitHub integration: the `GITHUB_TOKEN` can push with just `permissions: packages: write` (no PAT to manage), images link to the repo, and visibility follows the repo. This is the natural choice when your code lives on GitHub — it's what every example in this file uses.

### Cloud-native: ECR / GCR (Artifact Registry) / ACR

- **ECR** (AWS), **Artifact Registry/GCR** (Google), **ACR** (Azure). The win is **IAM integration**: your ECS/EKS/GKE/AKS workloads pull using their cloud identity (instance role / workload identity) — no static registry passwords. CI auths via short-lived OIDC tokens (`aws-actions/configure-aws-credentials` + `aws ecr get-login-password`). Use the registry that matches where you deploy, so pulls stay in-cloud (fast, free egress) and auth is your existing IAM.

### Self-hosted: Harbor, Gitea, plain `registry:2`

- **Harbor** — full-featured: RBAC, vulnerability scanning (Trivy built in), image signing, replication. The serious on-prem / air-gapped choice.
- **Gitea** — its package registry includes container support; lightweight if you already self-host Gitea.
- **`registry:2`** — the bare OCI registry; fine for a private mirror, no UI/auth bells.

Reach for self-hosted when compliance, air-gap, or egress cost rules out a SaaS registry.

---

## Common Mistakes

- **No `cache-from`/`cache-to` at all.** Every CI build is a cold build. The single biggest CI-build time sink — and the easiest fix.
- **Using `mode=min` (the default) on a multi-stage build.** Your runtime layers cache but the expensive `builder` stage (`npm ci`, `dotnet restore`, compile) rebuilds cold every run. Use `mode=max`.
- **Forgetting `setup-buildx-action`.** Without it you're on the classic builder; `type=gha` cache and multi-platform silently don't work (or error). Buildx is a prerequisite, not an optimisation.
- **`push: true` on pull requests.** A PR from a fork could publish a malicious image to your registry. Gate with `push: ${{ github.event_name != 'pull_request' }}`.
- **Over-broad `GITHUB_TOKEN` permissions** (or forgetting `packages: write`). Either the push fails, or you grant more than needed. Set `permissions:` explicitly, least-privilege.
- **`docker compose up` without `--exit-code-from`.** The job goes green even when tests failed, because `up` returns the *Compose* exit code, not the test container's. Always `--exit-code-from test --abort-on-container-exit`.
- **No DB health check / `depends_on: condition: service_healthy`.** Tests start before Postgres accepts connections → intermittent, maddening flakes that pass on retry.
- **Pulling public base images anonymously from Docker Hub in CI.** You'll eventually hit `toomanyrequests`. Authenticate or mirror.
- **Deploying `latest`.** No rollback, no traceability. Deploy the SHA tag.
- **Multi-arch via QEMU for heavy builds and wondering why CI is slow.** Emulated arm64 is dramatically slower than native. Use native arm64 runners for big builds.
- **Never cleaning up `type=registry`/`type=s3` cache tags.** They grow unbounded and cost storage. Add lifecycle/retention rules.
- **Forgetting `if: always()` on teardown.** A failed test step skips the cleanup step, leaking volumes/containers on self-hosted runners.

---

## Phase 8 Exercise

**Task (from the plan):** Write a GitHub Actions workflow that builds the image, runs tests, scans with Trivy (fail on HIGH/CRITICAL), and pushes to GHCR on the `main` branch with a SHA tag.

**Location:** `examples/phase8-cicd/.github/workflows/ci.yml` (plus a `docker-compose.test.yml`).

**Concrete hints:**

1. **Trigger** on `push` to `main` and on `pull_request`. Set `permissions: { contents: read, packages: write }`.
2. **Order the steps as a gate:** checkout → setup-qemu → setup-buildx → **build (don't push yet)** → test → scan → **push only if everything passed AND we're on main**. Tests and scan must run *before* the push, so a failing image never reaches the registry.
3. **Build once, reuse the image.** Use `build-push-action` with `load: true` (loads the built image into the runner's local Docker so the next steps can run it) and `push: false` for the test/scan phase. Tag it locally as e.g. `myapp:ci`.
4. **Run tests** via `docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test`. Give the DB a `pg_isready` health check and gate `test` on `condition: service_healthy`.
5. **Scan with Trivy** using `aquasecurity/trivy-action@master`:
   ```yaml
   - uses: aquasecurity/trivy-action@master
     with:
       image-ref: myapp:ci
       severity: HIGH,CRITICAL     # only care about these
       exit-code: "1"              # ← fail the job if any are found
       ignore-unfixed: true        # don't fail on CVEs with no fix available yet
   ```
   The `exit-code: "1"` is what turns the scan into a *gate* rather than a report.
6. **Push only on success + main.** Add a final `build-push-action` step (or re-run with `push: true`) guarded by:
   ```yaml
   if: github.ref == 'refs/heads/main' && github.event_name == 'push'
   ```
   Tag with the short SHA: use `docker/metadata-action` with `type=sha,prefix=,format=short`, or `${{ github.sha }}` directly.
7. **Wire caching** so reruns are fast: `cache-from: type=gha`, `cache-to: type=gha,mode=max` on every build step.
8. **Stretch goals:** add multi-arch (`platforms: linux/amd64,linux/arm64`); also tag semver on `v*.*.*` tags; upload the Trivy results as SARIF (`format: sarif` + `github/codeql-action/upload-sarif`) so findings show in the Security tab.

**Done when:** a PR build runs tests + scan but does NOT push; a broken test or a HIGH/CRITICAL CVE fails the job; a green push to `main` lands an image at `ghcr.io/<you>/<repo>:<short-sha>`; and the second run is visibly faster than the first (cache working).
