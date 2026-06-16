# Phase 9 — Production Patterns

This phase is the bridge between "the container runs on my laptop" and "the container survives a real deployment, behind a load balancer, getting restarted and redeployed without dropping requests." Everything here is about how a container behaves as a *long-lived process under an orchestrator* — not as a thing you `docker run` once and watch.

Mental model for the whole phase: **a container is a process, and orchestrators are just very opinionated process supervisors.** They start it, poll it to see if it's healthy, route traffic to it, signal it to stop, and replace it. Each subsection below is one part of that contract.

---

## 9.1 Health Checks

### What a health check actually is

A health check is a command Docker runs *inside* the container on a schedule. If the command exits `0`, the container is **healthy**; non-zero, it's **unhealthy**. That's the entire mechanism — it's just an exit code, exactly like a shell `&&` chain.

The container's health state is separate from whether the process is *running*. A Node process can be alive (PID exists, `docker ps` shows "Up") but wedged — event loop blocked, DB pool exhausted, deadlocked. From the kernel's point of view it's fine. The health check is how you express "alive is not the same as working."

### `HEALTHCHECK` in a Dockerfile

```dockerfile
# --interval     how often to run the check (default 30s)
# --timeout      how long to wait before the check counts as failed (default 30s)
# --start-period grace window after start where failures DON'T count against
#                retries — gives the app time to boot before being judged
# --retries      consecutive failures before the container flips to "unhealthy"
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
#        │  │                              │
#        │  └─ -f makes curl exit non-zero on HTTP >= 400 (without -f, curl
#        │     exits 0 even on a 500 — a classic silent-failure bug)
#        └──── the command runs INSIDE the container, so localhost = the app
```

State machine Docker tracks per container:

```
starting ──(check passes)──────────────► healthy
   │                                         │
   │ (during start-period,                   │ (retries consecutive fails)
   │  failures are ignored)                  ▼
   └──(start-period over, retries exhausted) unhealthy
```

Inspect it:

```bash
docker inspect --format '{{.State.Health.Status}}' web   # starting | healthy | unhealthy
docker inspect --format '{{json .State.Health}}' web      # full log of recent probe runs
```

### A real gotcha: distroless and `scratch` have no `curl`

The `curl -f ...` pattern assumes a shell and curl exist. In a `distroless` or `scratch` image (Phase 2/7), neither does. Two fixes:

```dockerfile
# Option A — ship a tiny health binary and exec it directly (no shell needed)
HEALTHCHECK CMD ["/healthcheck"]   # a static Go binary you built in the build stage

# Option B — have the app expose a CLI health mode and call the runtime
# (Node example: the app checks itself over HTTP and process.exit()s)
HEALTHCHECK CMD ["node", "/app/healthcheck.js"]
```

```js
// healthcheck.js — no curl needed, uses Node's own http
const http = require('http');
const req = http.get('http://localhost:3000/health', (res) => {
  // exit 0 if 2xx, non-zero otherwise — same contract as `curl -f`
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));   // connection refused etc. => unhealthy
req.setTimeout(4000, () => { req.destroy(); process.exit(1); });
```

### Liveness vs Readiness — the distinction that matters

Docker's single `HEALTHCHECK` conflates two questions that Kubernetes (Phase 10) splits into two probes. You should design your endpoints with the distinction in mind even on plain Docker, because it's the difference between "restart me" and "stop sending me traffic."

| | **Liveness** | **Readiness** |
|---|---|---|
| Question | "Is the process broken beyond repair?" | "Can I serve traffic *right now*?" |
| Fail action | **Restart the container** | **Remove from load balancer** (don't restart) |
| Should it check the DB? | **No** — a DB blip should not kill your app | **Yes** — if the DB is down you can't serve |
| Typical endpoint | `/healthz` — returns 200 if the event loop responds | `/readyz` — checks dependencies (DB ping, cache) |

The classic mistake: putting a DB check in your **liveness** probe. The DB hiccups for 5 seconds, every replica fails liveness simultaneously, the orchestrator restarts *all of them at once*, and now you have a cold-start thundering herd on top of a flaky DB. Liveness = "is *my* process wedged"; readiness = "are *my dependencies* available."

```js
// Express: two distinct endpoints
app.get('/healthz', (req, res) => res.sendStatus(200)); // liveness: did we reach the handler?
app.get('/readyz', async (req, res) => {                // readiness: can we actually work?
  try {
    await db.query('SELECT 1');                          // dependency check lives HERE
    res.sendStatus(200);
  } catch {
    res.sendStatus(503);                                 // 503 => pull me from rotation
  }
});
```

```csharp
// ASP.NET Core has first-class health checks — closer to K8s's model than Node's
// Program.cs
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddNpgSql(connString, tags: ["ready"]);   // package: AspNetCore.HealthChecks.NpgSql

app.MapHealthChecks("/healthz", new() { Predicate = c => c.Tags.Contains("live") });
app.MapHealthChecks("/readyz",  new() { Predicate = c => c.Tags.Contains("ready") });
```

### How orchestrators *use* it

- **Compose** uses health for `depends_on: { condition: service_healthy }` (Phase 5) — start order gating.
- **Swarm / Kubernetes / ECS** use it for **traffic routing** (don't send requests to an unready replica) and **self-healing** (restart on liveness failure).
- A `restart: on-failure` policy reacts to the *process exiting*; a health check reacts to the process *misbehaving while still running*. They're complementary, not redundant.

---

## 9.2 Graceful Shutdown

This is the subsection that, if you get it wrong, silently drops user requests during every single deploy. It's the most under-appreciated production topic.

### The signal sequence

When you `docker stop` (or an orchestrator decides to replace a container), this happens:

```
docker stop web
   │
   ├─► sends SIGTERM to PID 1 in the container        ← "please wind down"
   │
   ├─► waits up to --stop-timeout seconds (default 10s)
   │
   └─► if still running, sends SIGKILL                ← "you're dead now" (uncatchable)
```

`SIGTERM` is a **polite request** — your process can catch it and finish cleanly. `SIGKILL` is **not catchable** — the kernel terminates the process immediately, mid-request, connections severed. The window between them (default 10 seconds) is your entire budget to drain.

Exit codes you'll see (from Phase 1): `143` = `128 + 15` = killed by SIGTERM (you handled it and exited), `137` = `128 + 9` = killed by SIGKILL (you ran out of time, or OOM).

### Why this prevents dropped requests

Picture a rolling deploy. The load balancer is still sending requests to the old container at the moment the orchestrator decides to replace it. If the container dies instantly on SIGTERM:

- In-flight requests get a TCP reset — user sees a 502.
- A request that was mid-transaction never commits or rolls back cleanly.

Graceful shutdown means: **on SIGTERM, stop accepting new connections, let in-flight requests finish, then exit.** Combined with the load balancer being told "this instance is going away" (readiness flips to 503), no request is ever handed to a process that's about to vanish.

```
SIGTERM received
   │
   ├─► flip /readyz to 503  ──► LB stops routing new requests here
   ├─► server.close()       ──► stop accepting new connections, keep existing ones
   ├─► wait for in-flight requests to finish (with a hard cap)
   ├─► close DB pool, flush logs, release locks
   └─► process.exit(0)      ──► clean exit BEFORE the SIGKILL deadline
```

### Node.js handler

```js
const server = app.listen(3000);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;          // ignore a second SIGTERM
  shuttingDown = true;
  console.log(`${signal} received, draining...`);

  // 1. Stop the LB from sending new work (readiness must read this flag)
  //    app.get('/readyz', (_, res) => res.sendStatus(shuttingDown ? 503 : 200));

  // 2. Stop accepting new connections; the callback fires once all
  //    in-flight requests have completed and sockets are closed.
  server.close(async () => {
    try {
      await db.end();                // close the connection pool cleanly
      await redis.quit();
    } finally {
      process.exit(0);               // 0 => clean shutdown
    }
  });

  // 3. Safety net: if draining hangs (a stuck keep-alive socket, a slow
  //    query), force-exit BEFORE Docker's SIGKILL deadline. Pick a value
  //    below --stop-timeout (e.g. 8s when timeout is 10s).
  setTimeout(() => {
    console.error('Drain timed out, forcing exit');
    process.exit(1);
  }, 8000).unref();                  // unref so the timer doesn't keep us alive
}

process.on('SIGTERM', () => shutdown('SIGTERM'));  // sent by docker stop / orchestrators
process.on('SIGINT', () => shutdown('SIGINT'));    // Ctrl-C in local dev
```

> Keep-alive note: HTTP keep-alive sockets can keep `server.close()` from ever completing because the connection stays open between requests. In Node 18.2+ use `server.closeIdleConnections()` after `server.close()`, or set `server.keepAliveTimeout` low. This is exactly why the timeout safety net exists.

### .NET handler

ASP.NET Core has this built in and wired correctly by default — but you should understand the hook.

```csharp
// The generic host listens for SIGTERM and triggers ApplicationStopping,
// then waits up to ShutdownTimeout (default 30s in .NET, but Docker's
// --stop-timeout of 10s wins — so LOWER your Docker grace period or RAISE
// the host timeout to match, otherwise SIGKILL cuts you off).
builder.Services.Configure<HostOptions>(o =>
    o.ShutdownTimeout = TimeSpan.FromSeconds(8));   // keep below docker stop-timeout

var app = builder.Build();

var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    // Fires on SIGTERM, BEFORE the server stops accepting requests fully.
    // Flip readiness, stop background workers, finish in-flight messages.
    Console.WriteLine("ApplicationStopping: draining...");
});
lifetime.ApplicationStopped.Register(() =>
{
    Console.WriteLine("ApplicationStopped: clean exit.");
});
```

For an ASP.NET Core web app the framework already drains in-flight HTTP requests during the shutdown timeout — your job is mainly background services (`BackgroundService.StopAsync` gets the cancellation token) and external resources.

### The PID 1 problem (the most important teaching point in this phase)

On Linux, **PID 1 is special.** It's the `init` process. Two kernel behaviours make PID 1 different from every other process:

1. **PID 1 does not get default signal handlers.** For a normal process, the kernel installs default actions for signals (e.g. SIGTERM's default action is "terminate"). PID 1 gets **no default handlers** — the kernel assumes init knows what it's doing. So if your process is PID 1 and has *not* explicitly registered a SIGTERM handler, **SIGTERM is silently ignored.** `docker stop` then waits the full timeout and SIGKILLs you. Every stop takes 10 seconds and is never graceful.

2. **PID 1 is responsible for reaping zombies.** When a child process exits, it becomes a "zombie" until its parent calls `wait()`. Orphaned children get re-parented to PID 1, and PID 1 is expected to reap them. A typical app process doesn't reap, so zombies accumulate.

When you write `CMD ["node", "dist/main.js"]`, **node becomes PID 1.** Now:

- If node *does* register a SIGTERM handler (like the snippet above), graceful shutdown works — Node handles its own signals fine.
- But the shell form `CMD node dist/main.js` runs `/bin/sh -c "node ..."`, so **`sh` is PID 1** and node is a child. `sh` does *not* forward SIGTERM to node. SIGTERM hits the shell, the shell ignores it (PID 1, no handler), node never hears about it → no graceful shutdown, always SIGKILLed.

```dockerfile
# BAD: shell form. /bin/sh is PID 1; it eats SIGTERM and never forwards it.
CMD node dist/main.js

# BETTER: exec form. node is PID 1 directly. Works IF node handles SIGTERM.
CMD ["node", "dist/main.js"]
```

### Why `tini` matters

`tini` is a ~10KB init process whose entire job is to be a *correct* PID 1: it installs signal handlers, **forwards signals to your app**, and **reaps zombies**. You make tini PID 1, and tini runs your app as a child.

```dockerfile
# Alpine: install tini
RUN apk add --no-cache tini

# tini becomes PID 1; the "--" separates tini's args from your command.
# tini forwards SIGTERM to node AND reaps any zombie children.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

When do you actually need tini?

- **You spawn child processes** (a worker pool, shelling out to ffmpeg/imagemagick, `child_process.fork`) → you need zombie reaping → use tini.
- **Your process doesn't handle signals itself** → use tini so SIGTERM is forwarded.
- **Shortcut:** `docker run --init ...` (or `init: true` in Compose) injects Docker's own tini automatically, no Dockerfile change needed.

```yaml
# Compose: let Docker inject tini as PID 1 for this service
services:
  api:
    image: myapp
    init: true        # docker's built-in tini becomes PID 1
```

A well-behaved Node/.NET web server that handles its own SIGTERM and spawns no children technically doesn't *need* tini for signals — but it's cheap insurance, and the moment someone adds a `child_process` call, you'll be glad it's there.

---

## 9.3 Resource Limits

A container with no limits can consume the entire host's CPU and memory. One memory-leaking service then takes down every other container on the box. Limits are how you contain blast radius. Under the hood these map directly to the **cgroups** from Phase 1 — Docker is just writing cgroup files.

### Limits vs reservations

```yaml
services:
  api:
    deploy:
      resources:
        limits:           # HARD CEILING — the container cannot exceed this
          cpus: "1.0"     #   1.0 = one full CPU core's worth of time
          memory: 512M    #   exceed this => the kernel OOM-kills the process
        reservations:     # SOFT FLOOR — scheduler guarantees at least this much
          cpus: "0.25"    #   used for placement decisions (Swarm/K8s)
          memory: 128M    #   "don't schedule me where I can't get 128M"
```

- **`limits`** = the wall you cannot pass. Memory over the limit → OOM kill. CPU over the limit → *throttled* (not killed) — the kernel just gives you fewer time slices.
- **`reservations`** = a guarantee the scheduler uses to place the container; it does not throttle.

> Compose gotcha: the `deploy:` key is natively a **Swarm** concept. With plain `docker compose up` (non-Swarm), `deploy.resources.limits` *is* honored by modern Compose v2, but `reservations` and `replicas` are mostly ignored outside Swarm. For a single-host `docker run`, use the flags directly:

```bash
docker run -d \
  --cpus="1.0" \          # CPU limit (cgroup cpu.max)
  --memory="512m" \       # hard memory limit (cgroup memory.max)
  --memory-reservation="128m" \  # soft limit — reclaimed under host pressure
  myapp
```

### CPU semantics — `--cpus` is time, not cores

`--cpus="0.5"` does **not** pin you to a specific half-core. It means "in any 100ms scheduling window, you get 50ms of CPU time, summed across all cores." Your threads can run on any core; the *total* is capped. This trips up people expecting core affinity (that's `--cpuset-cpus="0,1"`, a different and rarely-needed flag).

### OOM kills — read them as a signal

When a container hits its memory limit, the kernel's **OOM killer** terminates a process inside it (usually PID 1, killing the container). The container exits with code **137**.

```bash
docker inspect --format '{{.State.OOMKilled}}' web   # true if the kernel OOM-killed it
docker inspect --format '{{.State.ExitCode}}' web    # 137 => SIGKILL (OOM or docker kill)
```

Counterintuitive advice from the plan: **set the memory limit a bit below where you'd expect peak usage, on purpose.** An OOM kill is a loud, visible signal that your app has a memory problem (a leak, an unbounded cache, a query loading too many rows). Without a limit, the leak silently grows until it takes down the *host* instead of just one container — a much worse failure that's far harder to attribute.

### The JVM/Node/.NET heap-vs-cgroup trap

Runtimes that size their heap based on "available memory" can misread the host's total instead of the container's limit, then try to grow past the cgroup limit and get OOM-killed.

- **Node:** the V8 old-space default (~2GB on 64-bit) is independent of the cgroup. If your limit is 512M, cap V8: `NODE_OPTIONS=--max-old-space-size=384` (leave headroom below the 512M container limit for buffers, native memory, etc.).
- **.NET:** modern .NET is **cgroup-aware** — `GCHeapHardLimit` is derived from the container memory limit automatically, and server GC adjusts. Mostly handled, but verify with `DOTNET_GCHeapHardLimitPercent` if you see surprise 137s.

---

## 9.4 Logging

### The cardinal rule: log to stdout/stderr

In a container, **you do not write logs to files.** You write to **stdout** (normal output) and **stderr** (errors), and let the platform capture the streams. This is not a style preference — it's the [twelve-factor](https://12factor.net/logs) convention that the entire container ecosystem is built around.

Why: the container is ephemeral. A log file inside it dies with `docker rm`. By writing to stdout/stderr, the log stream becomes a thing the *platform* owns and can route, rotate, and ship — independent of the container's lifecycle. Your app treats logs as an event stream and stays dumb about where they go.

```js
// Node: console.log → stdout, console.error → stderr. That's it. Don't open a
// file. A structured logger (pino/winston) should be configured to write JSON
// to stdout, NOT to a file path.
console.log(JSON.stringify({ level: 'info', msg: 'server started', port: 3000 }));
```

```csharp
// ASP.NET Core's default console logger already writes to stdout/stderr.
// Just don't add a File sink in production containers.
builder.Logging.AddJsonConsole();   // structured JSON to stdout
```

### Log drivers

Docker captures stdout/stderr and hands it to a **log driver**:

| Driver | What it does | When |
|---|---|---|
| `json-file` | writes JSON lines to a file on the host (the default) | local, single host |
| `local` | like json-file but more compact + auto-rotated | single host, prefer over json-file |
| `journald` | sends to systemd's journal | systemd hosts |
| `syslog` | forwards to a syslog server | centralized syslog infra |
| `fluentd` | forwards to a Fluentd/Fluent Bit collector | aggregation pipelines |
| `awslogs` / `gcplogs` | ships straight to CloudWatch / GCP Logging | cloud-managed |

`docker logs <container>` only works with `json-file`, `local`, and `journald`. With `syslog`/`fluentd`/`awslogs` the logs left the host, so `docker logs` shows nothing — you read them in the destination system instead. People get confused by this constantly.

### The default driver will fill your disk — rotate it

`json-file` has **no rotation by default.** A chatty container writes its log file forever until the host disk is full and *everything* on the box dies. This is one of the most common ways a Docker host falls over in production.

```yaml
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "10m"   # rotate when the current log file hits 10 megabytes
        max-file: "3"     # keep 3 rotated files => 30MB max per container
                          # (oldest is deleted when a 4th would be created)
```

Set it once, host-wide, in the daemon config so you never forget per-service:

```json
// /etc/docker/daemon.json — applies to every container by default
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

```bash
sudo systemctl restart docker   # daemon.json changes need a daemon restart
```

### Centralized logging

On a single host, `docker logs` + rotation is fine. Once you have multiple hosts/services, you ship logs to one place so you can search across everything:

- **Loki + Grafana** (Promtail/Grafana Agent tails container logs) — lightweight, cheap, the common self-hosted choice today.
- **ELK / OpenSearch** (Elasticsearch + Logstash/Fluentd + Kibana) — powerful, heavier to run.
- **Datadog / managed** — agent as a sidecar or daemon; least ops effort, costs money.

Two delivery shapes: a **log driver** (`fluentd`, `awslogs`) pushes from Docker directly, or a **collector sidecar/agent** (Promtail, Fluent Bit) reads the json-file/journald stream and forwards it. The sidecar approach keeps your app's only job as "write JSON to stdout."

> Structured logging compounds here: emit JSON lines (not free-text) so the aggregator can index fields (`level`, `requestId`, `userId`) and you can query `level=error AND service=api`. Include a correlation/request ID so one request's logs across services can be stitched together.

---

## 9.5 Multi-Container Deployment Patterns

A spectrum from simplest to most powerful. The skill here is **stopping at the right rung** — most apps never need Kubernetes, and reaching for it early is a classic over-engineering tax.

### Rung 1 — Single host with Compose

The 90% solution. One VPS, `docker compose up -d`, an Nginx reverse proxy out front (9.6).

```
        Internet
           │
       ┌───▼────┐    one Linux box (VPS)
       │ Nginx  │ :80/:443  ← only thing exposed publicly
       └───┬────┘
     ┌─────┼─────┐
  ┌──▼─┐ ┌─▼──┐ ┌▼───┐
  │api │ │api │ │ db │   (internal network, not published)
  └────┘ └────┘ └────┘
```

```bash
# The entire deploy story for a small app:
git pull
docker compose pull          # get new images (or --build to build on the box)
docker compose up -d          # recreate changed services
docker compose ps             # confirm everything healthy
```

Pros: dead simple, one mental model, the same Compose file you dev with. Cons: one machine = single point of failure; recreating a service has a brief blip (see 9.7); no built-in multi-host scaling.

**This is enough for:** internal tools, side projects, most B2B apps, anything where a few seconds of deploy blip and "the server can reboot" are acceptable.

### Rung 2 — Docker Swarm

Swarm is Docker's built-in clustering. Same `docker` CLI, same Compose-ish file (the `deploy:` block finally does something), but across **multiple hosts** with a manager scheduling tasks onto workers.

```bash
docker swarm init                                  # turn this host into a manager
docker stack deploy -c docker-compose.yml myapp    # deploy the stack to the swarm
docker service scale myapp_api=4                    # run 4 replicas across nodes
docker service update --image myapp:v2 myapp_api    # ROLLING update, built in
```

You get for free: multi-host scheduling, an internal overlay network with DNS + load balancing across replicas, rolling updates with automatic rollback, secrets, and self-healing (a dead replica is rescheduled). It's "Kubernetes lite."

**Reach for Swarm when:** you've outgrown one host but the team is small and you don't want the K8s operational burden. The honest caveat: Swarm's momentum has faded — the ecosystem, hiring pool, and managed offerings have consolidated around Kubernetes. Great for a homelab or a small fleet; a harder sell for a team that will eventually want the broader tooling.

### Rung 3 — Kubernetes

Covered in Phase 10. Reach for it when you genuinely need: autoscaling on metrics, zero-downtime rollouts as a first-class guarantee, multi-team isolation (namespaces/RBAC), a rich ecosystem (ingress controllers, cert-manager, operators), or your cloud already gives you managed control plane (EKS/GKE/AKS) so the operational cost is lower than self-running it.

**Decision heuristic:**

```
Do you have more than one server that needs to share load?
  NO  → Compose on one host. Stop here. (most apps)
  YES → Do you need autoscaling / rich ecosystem / multi-team / managed K8s already?
          NO  → Swarm (simple multi-host)
          YES → Kubernetes
```

Don't choose K8s for the resume. Choose it when the problems it solves are problems you actually have.

---

## 9.6 Nginx as a Reverse Proxy

Nginx sits in front of your app(s) as the single public entry point. It terminates TLS, serves static files, load-balances across replicas, and forwards everything else to your backend. Your app containers stay on an internal network, unpublished — only Nginx is exposed.

Why bother instead of publishing the app's port directly? TLS termination in one place, static asset serving (don't make Node serve a 2MB JS bundle), load balancing across replicas, rate limiting, and a buffer that absorbs slow clients so a slow-loris client ties up cheap Nginx workers instead of expensive app workers.

### Fully annotated config

```nginx
# /etc/nginx/conf.d/app.conf

# Define the backend pool. "api" is the Docker DNS name of the service;
# on a user-defined/Compose network Docker resolves it to the container(s).
# List multiple servers (or scale a Compose service) for load balancing.
upstream backend {
    server api:3000;            # round-robin by default across listed servers
    # server api2:3000;         # add more for load balancing
    keepalive 32;               # reuse upstream connections (needs http1.1 below)
}

# Redirect all plain HTTP to HTTPS (assumes TLS configured below).
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;   # 301 permanent redirect to https
}

server {
    listen 443 ssl;
    http2 on;                              # HTTP/2 (modern Nginx syntax)
    server_name example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # Serve static assets directly — never proxy these to the app.
    location /static/ {
        root /var/www;
        expires 1y;                        # let browsers cache hashed assets hard
        access_log off;
    }

    location / {
        proxy_pass http://backend;         # forward to the upstream pool above

        # --- The four headers you almost always need ---
        # Without these, your app sees Nginx's identity, not the real client.
        proxy_set_header Host              $host;             # original Host header
        proxy_set_header X-Real-IP         $remote_addr;      # client's real IP
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;  # IP chain
        proxy_set_header X-Forwarded-Proto $scheme;           # http or https

        # WebSocket / HTTP-keepalive upgrade support. Required if your app uses
        # WebSockets (socket.io, SignalR); harmless otherwise.
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts — tune to your app. Defaults (60s) are fine for most.
        proxy_connect_timeout 5s;          # time to establish connection to app
        proxy_read_timeout   60s;          # time to wait for app's response
    }
}
```

### Why `X-Forwarded-*` matters to your app

When a request passes through Nginx, your app's socket connects to *Nginx*, not the client. So `req.ip` is Nginx's container IP, and `req.protocol` is `http` (Nginx talked to you over plain HTTP internally) even though the user came in over HTTPS. Get this wrong and:

- Rate-limiting/logging records Nginx's IP for everyone.
- `secure` cookies and HTTPS redirects break because the app thinks it's on HTTP.

The `X-Forwarded-*` headers carry the truth, but your app must be told to *trust* them:

```js
// Express: trust the first proxy so req.ip / req.protocol read the X-Forwarded-* headers
app.set('trust proxy', 1);
```

```csharp
// ASP.NET Core: apply forwarded headers EARLY in the pipeline
app.UseForwardedHeaders(new ForwardedHeadersOptions {
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```

> Security note: only trust `X-Forwarded-For` from proxies you control. If a client could reach your app directly and forge the header, trusting it blindly lets them spoof their IP. Behind a known Nginx on an internal network, you're fine.

### As a Compose service

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"                          # only nginx is published
    volumes:
      - ./nginx/app.conf:/etc/nginx/conf.d/app.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      api:
        condition: service_healthy         # don't route until the app is healthy
    networks: [frontend, backend]

  api:
    image: myapp:1.0
    # NO ports: here — api is reachable only via nginx on the internal network
    networks: [backend]
```

---

## 9.7 Rolling Deployments Without Downtime

The goal: ship a new version with no user seeing an error. The strategies form a ladder of "how much downtime is acceptable vs how much machinery you'll run."

### The naive Compose deploy (brief downtime — be honest about it)

```bash
docker compose pull             # download the new image tag
docker compose up -d            # recreate any service whose image changed
```

`docker compose up -d` recreates a changed service by **stopping the old container, then starting the new one.** For a single-replica service that's a gap — a few seconds where requests fail (or queue at Nginx, then time out). For many apps that gap, during a low-traffic deploy, is acceptable. **Don't pretend it's zero-downtime — it isn't.**

You can shrink (not eliminate) the gap and keep it graceful by combining everything above: a `HEALTHCHECK` (Nginx `depends_on: service_healthy`), a SIGTERM handler (old container drains instead of dropping), and `stop_grace_period` tuned to your drain time.

### Blue/Green — the simplest true zero-downtime pattern

Run **two complete environments**: "blue" (current, live) and "green" (new version). Bring green up fully, health-check it, then flip the router from blue to green atomically. Blue stays running as an instant rollback.

```
            ┌──────────┐                     ┌──────────┐
 traffic ──►│  Nginx   │ ──► BLUE (v1) live  │  Nginx   │ ──► GREEN (v2) live
            └──────────┘     GREEN (v2) warm  └──────────┘     BLUE (v1) standby
              before flip                        after flip
```

```bash
# 1. Green is up alongside blue, on a different internal name/port.
docker compose -f green.yml up -d
# 2. Verify green is actually healthy BEFORE sending it traffic.
curl -f http://green-internal:3000/readyz
# 3. Flip Nginx upstream from blue -> green and reload (reload is graceful:
#    existing connections finish on old workers, new ones use the new config).
#    Swap the upstream "server" line, then:
nginx -s reload
# 4. Watch metrics. If green misbehaves, flip back to blue instantly.
# 5. Once confident, tear down blue.
docker compose -f blue.yml down
```

Cost: you need capacity to run two versions at once. Benefit: the flip is instant and rollback is *also* instant — you never re-deploy to roll back, you just point at blue again.

### Orchestrated rolling updates

Swarm (`docker service update --image`) and Kubernetes (`RollingUpdate`) do this for you: replace replicas a few at a time, wait for each new one to pass readiness before continuing, and roll back automatically if the new ones never go healthy. This is the production-grade answer and the main reason to climb to rung 2/3 in 9.5.

```bash
# Swarm: roll out v2 two replicas at a time, pausing for readiness between batches
docker service update \
  --image myapp:v2 \
  --update-parallelism 2 \
  --update-delay 10s \
  --update-order start-first \   # start new BEFORE stopping old => overlap, no gap
  myapp_api
```

### The migration trap — this breaks "zero downtime" if you ignore it

During *any* rolling deploy there is a window where **old and new code run at the same time against the same database.** If your DB migration is destructive, the old code breaks the instant the schema changes.

```
            migration runs
                 │
old code (v1) ───┼──────────► still serving during rollout  ⚠️ sees NEW schema
                 │
new code (v2) ───┼──────────► coming up                      sees NEW schema
```

The fix is the **expand / contract** (parallel change) pattern — never make a single migration that's incompatible with the currently-running code:

- **Renaming a column?** Don't `RENAME`. Instead: (1) add the new column, (2) deploy code that writes to both and reads from new, (3) backfill, (4) deploy code that uses only new, (5) *later, separate deploy*, drop the old column.
- **Dropping a column?** Deploy code that stops using it first; drop it in a *subsequent* release.
- **Adding a NOT NULL column?** Add it nullable with a default first; tighten the constraint after all code writes it.

The rule: **every migration must be backwards-compatible with the version of the app currently running.** Schema changes and the code that depends on them ship in *separate* deploys. This is the discipline that makes the fancy zero-downtime machinery actually deliver zero downtime — without it, blue/green and rolling updates just give you a fast, automated outage.

---

## Common Mistakes

- **`curl` without `-f` in a HEALTHCHECK.** Plain `curl` exits 0 even on HTTP 500, so the check passes while the app is broken. Always `curl -f`.
- **Health check using a binary the image doesn't have.** `curl`/`wget` don't exist in distroless/scratch. Use a tiny health binary or the runtime itself (`node healthcheck.js`).
- **Putting a DB check in the *liveness* probe.** A DB blip then restarts every replica simultaneously — a self-inflicted outage. Dependency checks belong in *readiness*.
- **Shell-form `CMD node app.js`.** `/bin/sh` becomes PID 1, ignores SIGTERM (no default handler at PID 1), and never forwards it to node — so every stop is a 10s timeout followed by SIGKILL. Use exec form `["node","app.js"]`.
- **No SIGTERM handler at all.** Every deploy hard-kills in-flight requests → intermittent 502s that are maddening to reproduce. Drain on SIGTERM.
- **Drain timeout >= Docker's stop-timeout.** If your safety-net timeout is 12s but `--stop-timeout` is 10s, SIGKILL fires first and your graceful logic never finishes. Keep the app's drain timer *below* Docker's.
- **Spawning child processes without tini.** Zombies pile up (no reaper at PID 1) and signals don't propagate to children. Use `--init` / `init: true` / tini.
- **No memory limit.** A leak grows until it OOMs the *whole host* instead of one container. Set a limit so the kill is contained and visible (exit 137 is your signal).
- **Node heap larger than the container limit.** V8's default ~2GB heap ignores a 512M cgroup limit → OOM kill. Set `--max-old-space-size` below the limit.
- **`json-file` driver with no rotation.** Logs grow unbounded and fill the host disk, taking everything down. Set `max-size`/`max-file` (ideally in `daemon.json`).
- **Writing logs to a file inside the container.** They die with the container and can't be shipped. Log to stdout/stderr; let the platform route them.
- **Forgetting `trust proxy` / forwarded-headers behind Nginx.** App logs everyone as Nginx's IP and breaks HTTPS detection (secure cookies, redirects).
- **Publishing app ports in production.** Only the reverse proxy should be exposed; app containers stay on the internal network with no `ports:`.
- **Calling `compose pull && up -d` "zero downtime."** It recreates containers with a real gap. It's *brief-downtime*; use blue/green or an orchestrator for true zero-downtime.
- **Destructive migrations during a rolling deploy.** Old code still running hits the new schema and breaks. Use expand/contract; ship schema and dependent code in separate, backwards-compatible steps.
- **Reaching for Kubernetes on a single-server app.** Operational cost with no payoff. Stay on Compose until you actually need multi-host scaling.

---

## Phase 9 Exercise

**From the plan:** Deploy a full stack (API + DB + Nginx) to a VPS using Docker Compose. Configure health checks, resource limits, log rotation, and graceful shutdown. Test a rolling update by changing the API image tag.

**Concrete steps and hints:**

1. **Stack:** a Compose file with three services — `nginx` (published `80:80`), `api` (a Node/Express or ASP.NET app, **no published ports**), and `db` (Postgres with a named volume from Phase 4). Put `api` + `db` on a `backend` network and `nginx` on both `frontend` and `backend`.

2. **Health checks (9.1):** give `api` a `/healthz` (liveness, always 200) and `/readyz` (readiness, pings the DB). Add a `HEALTHCHECK` in the Dockerfile (or `healthcheck:` in Compose) hitting `/readyz`. Give `db` a `pg_isready` health check. Wire `nginx depends_on api: service_healthy` and `api depends_on db: service_healthy`.

3. **Graceful shutdown (9.2):** add a SIGTERM handler to the API that flips `/readyz` to 503, calls `server.close()`, drains, closes the DB pool, and exits — with a safety-net timer (e.g. 8s) *below* the Compose `stop_grace_period: 10s`. Add `init: true` to the api service. Prove it: `docker compose stop api` should exit cleanly (code 143) within a couple seconds, not hang for 10s then SIGKILL (137).

4. **Resource limits (9.3):** add `mem_limit` / `cpus` (single-host) to `api` and `db`. Set `NODE_OPTIONS=--max-old-space-size=<below limit>`. Optional: deliberately set a tiny memory limit, hammer the app, and watch it get OOM-killed (137) — then read `docker inspect ... OOMKilled`.

5. **Log rotation (9.4):** add a `logging:` block with `max-size: "10m"`, `max-file: "3"` to every service. Make the API log structured JSON to stdout. Verify with `docker inspect` that the log opts applied, and confirm `docker logs api` shows the JSON.

6. **Nginx (9.6):** write the reverse-proxy config with the four `X-Forwarded-*` headers and `proxy_pass http://api:3000`. Set `trust proxy` / forwarded-headers middleware in the app and confirm the app logs the *real* client IP, not Nginx's.

7. **Rolling update (9.7):** tag the API `v1`, deploy, then build `v2` (change a response string). Run `docker compose pull && docker compose up -d api` and time the gap with a `while true; do curl -s localhost/healthz; sleep 0.2; done` loop in another terminal — observe the brief blip. **Stretch:** scale the api to 2 replicas, point the Nginx `upstream` at both, and do a manual blue/green flip (`nginx -s reload`) to achieve a gap-free switch. **Stretch 2:** write a backwards-compatible migration (add a nullable column) and confirm v1 keeps serving while the new schema exists.

**Where it lives:** `examples/phase9-production/` — `docker-compose.yml`, `nginx/app.conf`, the API with its health endpoints and SIGTERM handler, and a short `DEPLOY.md` capturing the commands you ran on the VPS.
