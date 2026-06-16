# Phase 3 — Networking

> **Goal of this phase:** stop treating container networking as magic. After this you should be able to reason about *why* `app` can reach `db` by name on one network but not another, debug a "connection refused" without guessing, and explain the difference between publishing a port and `EXPOSE`.

A quick mental model before the details. Docker networking is just standard Linux networking (virtual interfaces, bridges, iptables, network namespaces) wrapped in a friendlier CLI. A container's network is one of its **namespaces** (you met namespaces in Phase 1). When Docker "creates a network," it's building a virtual Layer-2 switch in the kernel and plugging container network namespaces into it with virtual ethernet (`veth`) cables.

```
        Host kernel
   ┌──────────────────────────────────────────────┐
   │                                                │
   │   eth0 (physical NIC) ── to the real world     │
   │     │                                          │
   │     │  NAT / iptables                          │
   │     │                                          │
   │   ┌─┴───────────────┐   ← a "bridge" = virtual │
   │   │   docker0 / br-* │     L2 switch in kernel  │
   │   └──┬──────────┬────┘                          │
   │      │ veth     │ veth   ← virtual cables       │
   │   ┌──┴──┐    ┌──┴──┐                            │
   │   │ ctr │    │ ctr │   ← each in its own        │
   │   │  A  │    │  B  │     network namespace      │
   │   └─────┘    └─────┘                            │
   └──────────────────────────────────────────────┘
```

**TS/Node analogy:** if you've run `localhost:5432` to talk to Postgres on your laptop, that's the host network. A container's `localhost` is *its own* namespace — `localhost` inside the container is not your laptop. That single fact is behind half of all Docker networking confusion. We'll come back to it.

---

## 3.1 Network Drivers

A **network driver** decides *how* containers get connected. Docker ships with several built-in drivers. You pick one when you create a network (`--driver`); if you don't, you get `bridge`.

```
┌──────────┬──────────────────────────────────────────────┬────────────────────────┐
│ Driver   │ What it does                                  │ Use it when…           │
├──────────┼──────────────────────────────────────────────┼────────────────────────┤
│ bridge   │ Private virtual L2 network on a single host.  │ Default. Almost always.│
│          │ Containers get private IPs, NAT to the host.  │                        │
│ host     │ Container shares the HOST's network namespace.│ Max network perf,      │
│          │ No isolation. Container's port 80 = host's 80.│ or need host's stack.  │
│ none     │ No networking at all. Only a loopback iface.  │ Pure compute, batch    │
│          │                                               │ jobs, paranoid isolation.│
│ overlay  │ One virtual network spanning MULTIPLE hosts.  │ Swarm / multi-node.    │
│          │ Built on VXLAN tunnels between daemons.       │ (K8s uses its own CNI.)│
│ macvlan  │ Container gets its own MAC + IP directly on   │ Legacy apps / appliances│
│          │ the physical LAN. Looks like a real machine.  │ that must be on the LAN.│
│ ipvlan   │ Like macvlan but shares the host's MAC.       │ When the switch limits │
│          │ (Same idea, L2 or L3 modes.)                  │ MACs per port.         │
└──────────┴──────────────────────────────────────────────┴────────────────────────┘
```

### bridge — the workhorse

A bridge network is a private subnet living entirely on one host. Containers on it get private IPs (e.g. `172.18.0.0/16`), can talk to each other, and reach the outside world via NAT (the host masquerades their traffic). Inbound traffic from outside the host does **not** reach them unless you *publish* a port (see 3.2).

There are two flavours and the distinction is the single most important thing in this whole phase:

- **The default bridge** (`docker0`, network name `bridge`) — what you get if you never create a network. **No DNS by container name.**
- **User-defined bridges** (anything you `docker network create`) — **automatic DNS by container name.**

Sections 3.2 and 3.3 dig into why. Just hold onto: *default bridge = no name resolution; your own bridge = name resolution.*

### host — share the host stack

```bash
docker run -d --network host nginx
# nginx now listens on the HOST's port 80 directly. No -p needed and -p is IGNORED.
# `curl localhost:80` on the host hits the container. Zero NAT overhead.
```

There is no network isolation — the container sees all host interfaces and can bind any host port. Useful for high-throughput proxies or tools that need to sniff the host network. **Caveat:** `host` networking only works as described on **Linux**. On Docker Desktop (Mac/Windows) Docker runs inside a Linux VM, so `--network host` means "the VM's network," not your laptop's — a frequent surprise.

### none — no network

```bash
docker run --rm --network none alpine ip addr
# Shows only `lo` (loopback). No eth0. The container is network-isolated.
```

Good for CPU-bound jobs that read from a mounted volume and write results out — no reason to give them a network at all (smaller attack surface).

### overlay — multi-host

A single logical network that spans several Docker hosts, implemented with VXLAN tunnels between the daemons. This is what lets a Swarm service on node A talk to one on node B as if they were on the same LAN. You won't create these by hand in single-host dev; they appear once you `docker swarm init`. Kubernetes does the same job with its own CNI plugins (Calico, Cilium, etc.) rather than Docker's overlay driver — but the *concept* (flat virtual network across nodes) is identical, which is the Phase 10 payoff.

### macvlan / ipvlan — be a real machine on the LAN

`macvlan` gives the container its own MAC address and an IP on your actual physical network, so your router hands it a DHCP lease and other machines on the LAN see it as a distinct device. Niche: migrating a legacy app that expects to *be* a host on the network. Most teams never need it.

---

## 3.2 The Default Bridge Network

When you `docker run` without specifying `--network`, the container joins the pre-created network literally named `bridge`, backed by the kernel bridge interface `docker0`.

```bash
docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# a1b2c3d4e5f6   bridge    bridge    local      ← the default one. docker0.
# 9f8e7d6c5b4a   host      host      local
# 0a1b2c3d4e5f   none      null      local
```

Let's prove the famous limitation: **containers on the default bridge cannot resolve each other by name.**

```bash
docker run -d --name web nginx                     # joins default bridge
docker run -d --name api nginx                     # also default bridge

docker exec api ping -c1 web
# ping: bad address 'web'                            ← NAME RESOLUTION FAILS

docker inspect -f '{{.NetworkSettings.IPAddress}}' web
# 172.17.0.2                                          ← but it DOES have an IP

docker exec api ping -c1 172.17.0.2
# 64 bytes from 172.17.0.2: seq=0 ttl=64 time=0.1 ms  ← reaching it BY IP works fine
```

So connectivity exists; **only name resolution is missing**. On the default bridge you must hard-code IP addresses — and those IPs change every time a container restarts. That's miserable, which is exactly why nobody uses the default bridge for multi-container apps. (Docker keeps it only for backward compatibility with very old setups.)

### Port publishing — getting traffic IN from the host

A bridge container is reachable by *other containers on the same bridge*, but **not** from your laptop's browser or from outside the host — unless you **publish** a port. Publishing creates an iptables DNAT rule: traffic hitting the host on `hostPort` is forwarded to `containerPort` inside the container.

```bash
docker run -d -p 8080:80 nginx
#               │    │
#               │    └── containerPort: the port the process listens on INSIDE the container
#               └─────── hostPort:      the port opened on the HOST machine
# Read it as "host 8080 → container 80". Now `curl localhost:8080` on the host hits nginx's 80.
```

More publishing forms:

```bash
docker run -d -p 80 nginx                  # only containerPort → Docker picks a RANDOM free host port
docker run -d -p 127.0.0.1:8080:80 nginx   # bind only to localhost (not 0.0.0.0) — don't expose to LAN
docker run -d -p 8080:80/udp myapp         # publish a UDP port
docker run -d -P nginx                      # capital -P: publish ALL EXPOSEd ports to random host ports

docker port web
# 80/tcp -> 0.0.0.0:8080                     ← see what's actually mapped
```

```
   Your browser                Host                       Container
   ┌──────────┐         ┌──────────────────┐         ┌──────────────┐
   │ localhost│ ──────► │  :8080            │  DNAT   │  nginx :80   │
   │  :8080   │         │  (iptables rule)  │ ──────► │              │
   └──────────┘         └──────────────────┘         └──────────────┘
        publish = -p hostPort:containerPort  punches a hole from host → container
```

### Publishing (`-p`) vs `EXPOSE` — they are NOT the same

This trips up almost everyone, so let's nail it.

- **`EXPOSE 3000`** in a Dockerfile is **pure documentation/metadata.** It opens nothing, forwards nothing. It records "this image's process is expected to listen on 3000" so humans and tooling (`docker run -P`, Compose, orchestrators) know. You can `EXPOSE` a port and the app is still totally unreachable from the host.
- **`-p 8080:3000`** at `docker run` time is what **actually** forwards host traffic into the container.

```dockerfile
# In a Dockerfile:
EXPOSE 3000          # says "I listen on 3000". Publishes NOTHING. Reachable from host? No.
```

```bash
docker run -d -p 8080:3000 myapi   # THIS is what makes the host able to reach it.
docker run -d -P myapi             # -P reads EXPOSE and publishes 3000 to a RANDOM host port.
```

> **One-liner to remember:** `EXPOSE` *documents*; `-p` *publishes*. Containers on the same user-defined network reach each other on the container port directly with **no publishing at all** — publishing is only for host↔container, never container↔container.

---

## 3.3 User-Defined Bridge Networks — Use These

Create your own bridge and the world gets better immediately:

```bash
docker network create mynet
# Creates a user-defined bridge. Docker assigns a subnet (e.g. 172.18.0.0/16) automatically.

docker network create \
  --driver bridge \
  --subnet 172.28.0.0/16 \
  --gateway 172.28.0.1 \
  appnet                       # optionally pin the subnet/gateway yourself
```

Now run two containers on it and resolve by name:

```bash
docker network create mynet
docker run -d --name db   --network mynet postgres:16
docker run -d --name api  --network mynet -e DB_HOST=db myapi

docker exec api ping -c1 db
# 64 bytes from 172.18.0.2 ...                 ← NAME RESOLUTION WORKS. No IP hard-coding.
docker exec api getent hosts db
# 172.18.0.2  db                                ← Docker's embedded DNS answered
```

The app connects to `db:5432` by name, and that keeps working even if `db` restarts and gets a new IP, because the DNS record follows the container. This is *the* reason user-defined bridges exist.

Other wins over the default bridge:

- **Isolation.** Each user-defined network is a separate broadcast domain. A container on `frontend-net` cannot even reach a container on `backend-net` unless you explicitly attach it to both. The default bridge has no such grouping — everything shares it.
- **Hot attach/detach** without restarting:

```bash
docker network connect    backend-net api    # add a 2nd network to a running container
docker network disconnect frontend-net api   # remove one
# A container CAN be on multiple networks at once — this is how you build a DMZ
# (e.g. nginx on both frontend-net and backend-net, bridging the two).
```

### WHY does the user-defined bridge have DNS but the default bridge doesn't?

This is the crucial teaching point of the phase, so here's the real mechanism — not just "because Docker."

Every modern Docker container has an **embedded DNS server run by the daemon, reachable at `127.0.0.11`** inside the container (more on this in 3.5). The question is *what records that DNS server is willing to answer.*

1. **On a user-defined network**, the daemon maintains a DNS registry **scoped to that network**: every container attached to it is registered under its `--name` (and any `--network-alias`). When `api` asks `127.0.0.11` "who is `db`?", the daemon looks in *mynet's* registry, finds `db`, and returns its current IP. Names are network-scoped, so there's no global collision and the daemon can safely auto-populate the table.

2. **On the default bridge**, Docker deliberately does **not** populate that name registry. The legacy mechanism for default-bridge name resolution was the old `--link` flag, which injected `/etc/hosts` entries manually. Without `--link`, no names exist — only IPs. Docker chose not to retrofit automatic DNS onto the default bridge to avoid breaking decades of existing behaviour and because the default bridge is a single flat shared network where auto-registering every container's name globally would cause collisions and leak names between unrelated containers.

```
   DEFAULT BRIDGE                          USER-DEFINED BRIDGE (mynet)
   ┌───────────────────────────┐          ┌───────────────────────────────┐
   │ embedded DNS @127.0.0.11   │          │ embedded DNS @127.0.0.11        │
   │   name table: (empty)      │          │   name table:                   │
   │   "db"? → ¯\_(ツ)_/¯ NXDOMAIN│          │     db   → 172.18.0.2           │
   │                            │          │     api  → 172.18.0.3           │
   │ resolve by IP only         │          │   "db"? → 172.18.0.2  ✔         │
   └───────────────────────────┘          └───────────────────────────────┘
```

So: **DNS isn't a property of "bridge" the driver — it's a property of having a per-network name registry, which Docker only auto-maintains for networks you create yourself.** That's the whole answer. Always create a network.

---

## 3.4 Container-to-Container Communication

The decision tree:

```
Do the two containers need to talk?
│
├─ Are they on the SAME user-defined network?
│     └─ YES → use the other container's NAME as hostname, on its CONTAINER port.
│              e.g.  postgres://db:5432   (NO -p needed for this — publishing is host-only)
│
├─ On the DEFAULT bridge?
│     └─ Use IP (ugh) or attach both to a user-defined network instead. Do the latter.
│
└─ Does the container need to reach a service running on the HOST (not another container)?
      └─ Use host.docker.internal  (see below)
```

### Container → container (the normal case)

```bash
docker network create appnet
docker run -d --name db  --network appnet -e POSTGRES_PASSWORD=secret postgres:16
docker run -d --name api --network appnet \
  -e DATABASE_URL="postgres://postgres:secret@db:5432/postgres" \
  myapi
# `api` connects to host "db", port 5432 — the CONTAINER port, reached directly over the
# private network. No -p on the db container is required or wanted for internal traffic.
```

Only publish (`-p`) the things the *outside world* must reach (usually just your nginx / API gateway). Internal services like the database should have **no published ports at all** — that's both cleaner and more secure (Phase 7 will hammer this).

### Container → the host machine: `host.docker.internal`

Classic scenario: your API runs in a container, but during local dev your database (or another service) runs natively on your laptop, listening on `localhost:5432`. Inside the container, `localhost` means *the container itself* — not your laptop — so `localhost:5432` fails. The special DNS name **`host.docker.internal`** resolves to the host machine from inside the container.

```bash
# Mac / Windows (Docker Desktop): host.docker.internal works out of the box.
docker run --rm curlimages/curl curl http://host.docker.internal:5432

# Linux: it is NOT automatic. Add it explicitly:
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  curlimages/curl curl http://host.docker.internal:5432
#   └── host-gateway is a magic value Docker resolves to the host's bridge gateway IP
```

In Compose (Phase 5 preview) you'd write it as:

```yaml
services:
  api:
    extra_hosts:
      - "host.docker.internal:host-gateway"   # needed on Linux
```

### Legacy `--link` — do not use

```bash
docker run -d --name api --link db:database myapi   # DEPRECATED. Don't.
```

`--link` predates user-defined networks. It wires `/etc/hosts` entries and shares env vars one-directionally between two specific containers. It's clunky, doesn't survive restarts well, and is superseded entirely by user-defined network DNS. If you see it in a tutorial, the tutorial is old. Use a network.

---

## 3.5 DNS in Docker

### The embedded DNS server at `127.0.0.11`

Every container on a user-defined network gets a `/etc/resolv.conf` pointing at Docker's embedded resolver:

```bash
docker run --rm --network appnet alpine cat /etc/resolv.conf
# nameserver 127.0.0.11                  ← Docker's embedded DNS, INSIDE the container's netns
# options ndots:0
```

Why `127.0.0.11` (a loopback address)? Because the resolver lives in the container's own network namespace. The daemon transparently intercepts traffic to `127.0.0.11:53` and answers it. How resolution flows:

```
container asks "db" ─► 127.0.0.11 (embedded DNS)
                            │
                ┌───────────┴────────────┐
                │ Is "db" a container/    │
                │ alias on THIS network?  │
                └───────────┬─────────────┘
                  yes │              │ no
                      ▼              ▼
              return its IP   forward to the host's
                              upstream DNS (e.g. 8.8.8.8)
                              → resolves real domains like
                                api.github.com
```

So the same resolver handles both **service discovery** (other containers) *and* **normal internet DNS** (external hostnames), falling through to your host's upstream resolvers for anything it doesn't own.

### `--network-alias` — extra DNS names

A container is reachable by its `--name`. `--network-alias` gives it *additional* DNS names **on a specific network**:

```bash
docker network create appnet
docker run -d --name pg --network appnet \
  --network-alias database \
  --network-alias primary-db \
  -e POSTGRES_PASSWORD=secret postgres:16

docker run --rm --network appnet alpine sh -c \
  'getent hosts pg && getent hosts database && getent hosts primary-db'
# all three resolve to the SAME container IP
```

This is handy when several services expect different conventional names (`db`, `database`, `postgres`) for the same backend — you don't have to rename the container, just alias it.

### Shared aliases = round-robin DNS (poor-man's load balancing)

The genuinely useful trick: **multiple containers can share the same alias.** The embedded DNS then returns all their IPs, and clients round-robin across them.

```bash
docker network create web
docker run -d --name web1 --network web --network-alias backend nginx
docker run -d --name web2 --network web --network-alias backend nginx
docker run -d --name web3 --network web --network-alias backend nginx

docker run --rm --network web nicolaka/netshoot dig +short backend
# 172.x.x.2
# 172.x.x.3      ← all three IPs returned; order rotates per query → DNS round-robin
# 172.x.x.4
```

This is exactly how a Compose service with `replicas` (and a Swarm service's VIP) spreads traffic. It's DNS-level only — no health checking, no real load balancing — but it's the foundation the higher-level orchestration builds on.

---

## 3.6 Network Inspection & Debugging

### Listing and inspecting

```bash
docker network ls                       # all networks
docker network inspect appnet           # full JSON: subnet, gateway, and CONNECTED containers
docker network inspect appnet \
  -f '{{range .Containers}}{{.Name}} → {{.IPv4Address}}{{println}}{{end}}'
# db  → 172.18.0.2/16
# api → 172.18.0.3/16                    ← exactly who is on this network, and their IPs

docker inspect -f '{{json .NetworkSettings.Networks}}' api | python3 -m json.tool
#                                         ← which networks a single container is attached to
```

### `nicolaka/netshoot` — the network debugger's swiss army knife

Most production images are minimal (alpine/distroless) — no `ping`, `dig`, `curl`, `nslookup`, `tcpdump`. Rather than polluting your image with debug tools, run a throwaway **`nicolaka/netshoot`** container *on the same network* as the container you're debugging. It ships with every network tool you'll ever want.

```bash
# Drop into an interactive shell ON the target network:
docker run --rm -it --network appnet nicolaka/netshoot
#         │    │  └── interactive terminal
#         │    └───── auto-remove when you exit (don't leave debug junk around)
#         └────────── join appnet so you see what appnet containers see

# ── inside netshoot, you can now: ──
nslookup db                 # does DNS resolve? what IP?
dig +short api              # short answer; great for spotting round-robin (multiple IPs)
ping -c3 db                 # is it reachable at L3 at all?
curl -v http://api:3000/health   # is the HTTP service actually up on that port?
nc -zv db 5432              # is the TCP port open? (connection refused vs timeout matters)
ss -tlnp                    # what's listening (run this INSIDE the target container instead)
```

Or run a single command and exit (great for scripts):

```bash
docker run --rm --network appnet nicolaka/netshoot nslookup db
docker run --rm --network appnet nicolaka/netshoot curl -fsS http://api:3000/health
```

### A debugging recipe — "api can't reach db"

Work bottom-up through the stack; each step tells you which layer is broken:

```bash
# 0. Are they even on the same network?  (Most common cause.)
docker network inspect appnet -f '{{range .Containers}}{{.Name}} {{end}}'
#    → if "db" isn't listed here, that's your bug. `docker network connect appnet db`.

# 1. DNS: does the name resolve?
docker run --rm --network appnet nicolaka/netshoot nslookup db
#    NXDOMAIN → name not registered (wrong network? default bridge? typo in --name?)

# 2. L3: is the IP reachable?
docker run --rm --network appnet nicolaka/netshoot ping -c2 db
#    100% packet loss → routing/network problem (rare on a single bridge)

# 3. L4: is the PORT open?
docker run --rm --network appnet nicolaka/netshoot nc -zv db 5432
#    "connection refused" → db process isn't listening (crashed? wrong port? not started yet?)
#    "timed out"          → firewall / wrong network / db on a different net

# 4. Is the db process actually listening, and on the RIGHT interface?
docker exec db ss -tlnp
#    listening on 127.0.0.1:5432  → BUG: bound to loopback, unreachable from other containers.
#    listening on 0.0.0.0:5432    → good, reachable from the network.
```

Step 4 catches a subtle, very common one: a service bound to `127.0.0.1` inside the container is reachable only from *that* container. To accept connections from peers it must bind `0.0.0.0` (e.g. Postgres `listen_addresses = '*'`, an Express app `app.listen(3000, '0.0.0.0')`).

---

## Common Mistakes

- **Expecting DNS on the default bridge.** `ping web` fails because you never created a network. *Fix:* `docker network create mynet` and put both containers on it. This is the #1 networking gotcha and the reason 3.3 exists.
- **Confusing `EXPOSE` with publishing.** `EXPOSE 3000` in the Dockerfile does nothing at runtime; you still need `-p 8080:3000`. Conversely, you *don't* need to publish anything for container-to-container traffic on a shared network.
- **Publishing internal services unnecessarily.** Slapping `-p 5432:5432` on your database exposes it to your whole LAN. Internal services need **no** published ports — other containers reach them over the private network by name.
- **Using `localhost` to reach another container.** Inside a container, `localhost` is *that container*. To reach `db`, use `db:5432`, not `localhost:5432`. To reach a service on your **laptop**, use `host.docker.internal` (with `--add-host=host.docker.internal:host-gateway` on Linux).
- **Binding a service to `127.0.0.1` then wondering why peers can't connect.** A loopback bind is container-private. Bind `0.0.0.0` to accept connections from the network.
- **Hard-coding container IPs.** They change on restart. Always use names + a user-defined network so DNS tracks the moving IP for you.
- **Assuming `--network host` reaches your laptop on Docker Desktop.** On Mac/Windows, `host` is the internal Linux VM, not your machine. `host` networking behaves as documented only on Linux.
- **Reaching for `--link`.** Deprecated. It's a museum piece. Use a user-defined network.
- **Forgetting random host ports with `-p 80` / `-P`.** Without an explicit `hostPort`, Docker picks a random one. Run `docker port <ctr>` to find it, or specify the host port explicitly.
- **Cross-network expectations.** Containers on `frontend-net` cannot see `backend-net` by default — that's the *point* of separate networks. Attach a bridging container (e.g. nginx) to both if you need to cross.
- **Trying to debug DNS from a distroless image.** It has no `nslookup`/`curl`. Don't bloat the image — attach `nicolaka/netshoot` to the same network instead.

---

## Phase 3 Exercise

**The task (from the plan):** Create a two-container setup (app + database) on a custom network. Verify DNS resolution works. Then try to reach one container from *outside* its network and confirm it fails.

**Concrete steps & hints:**

1. **Create an isolated network.**
   ```bash
   docker network create appnet
   ```

2. **Start a database on it — with NO published port** (internal-only is the point).
   ```bash
   docker run -d --name db --network appnet \
     -e POSTGRES_PASSWORD=secret postgres:16
   ```

3. **Start an "app" on the same network.** Use `nicolaka/netshoot` as your stand-in app so you have tools to probe with. Prove DNS + connectivity:
   ```bash
   docker run --rm -it --network appnet nicolaka/netshoot
   #   inside:
   nslookup db          # expect: resolves to db's 172.x IP  → DNS works
   nc -zv db 5432       # expect: "open"                       → reachable by name+port
   exit
   ```
   *Hint:* if `nslookup db` returns NXDOMAIN, you almost certainly started `db` on the default bridge — re-check `--network appnet` on the `docker run`.

4. **Now prove isolation — reach `db` from OUTSIDE `appnet`.** Run a probe container *without* joining the network (it lands on the default bridge):
   ```bash
   docker run --rm -it nicolaka/netshoot      # NOTE: no --network appnet
   #   inside:
   nslookup db          # expect: NXDOMAIN — the name doesn't exist off the network
   ping -c2 <db's IP>   # expect: 100% packet loss — different network, no route
   exit
   ```
   *Hint:* grab `db`'s IP with
   `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' db`
   to attempt the ping-by-IP and watch it fail — that's the isolation you're demonstrating.

5. **Confirm the topology** so you can articulate *why* each result happened:
   ```bash
   docker network inspect appnet \
     -f '{{range .Containers}}{{.Name}} → {{.IPv4Address}}{{println}}{{end}}'
   ```

**What you should be able to explain afterwards:**
- Why `db` resolves by name on `appnet` but not from the default bridge (the per-network DNS registry — see 3.3).
- Why no `-p` was needed for app↔db, and why adding one would have been a security mistake.
- The difference between "connection refused" (process not listening) and "timed out" (wrong network / firewall) when probing with `nc`.

**Stretch goal:** add a second `db` replica sharing `--network-alias database`, then `dig +short database` from netshoot and watch DNS round-robin return both IPs (ties back to 3.5).
