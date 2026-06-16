# Phase 4 — Volumes & Storage

---

The mental model from Phase 1 carries everything here: a container is **image layers (read-only) + one thin writable layer on top**. That writable layer is *part of the container*, not part of your data. When the container is removed, the writable layer dies with it. Storage is the answer to one question: **where does data live so it outlives the container?**

Coming from Node.js, the analogy is: the container is the *process*, the writable layer is *process memory* — it's gone when the process exits. Volumes and bind mounts are the *disk* — they persist. You never store the database in process memory; same rule here.

---

## 4.1 The Three Storage Options

Docker gives you three ways to get data into or out of a container. They differ in **where the bytes actually live** and **who manages that location**.

```
                          HOST MACHINE
 ┌──────────────────────────────────────────────────────────────┐
 │                                                                │
 │   /home/me/project ───────┐        /var/lib/docker/volumes/    │
 │   (a path YOU control)    │        (a dir DOCKER controls)     │
 │                           │              │                     │
 │                           │              │      RAM (tmpfs)    │
 │                           │              │        │            │
 │   ┌───────────────────────┼──────────────┼────────┼──────────┐ │
 │   │  CONTAINER            │              │        │          │ │
 │   │                       ▼              ▼        ▼          │ │
 │   │   /app/src      /var/lib/postgresql/data   /tmp         │ │
 │   │   (bind mount)   (named volume)        (tmpfs mount)    │ │
 │   │                                                          │ │
 │   │   /app/build-output  ◄── thin WRITABLE LAYER (ephemeral) │ │
 │   └──────────────────────────────────────────────────────── │ │
 └──────────────────────────────────────────────────────────────┘
```

| | **Bind mount** | **Named volume** | **tmpfs mount** |
|---|---|---|---|
| **What it is** | A host path mapped into the container | Docker-managed storage area | In-memory filesystem (RAM) |
| **Where bytes live** | Wherever you point it (`/home/me/...`) | `/var/lib/docker/volumes/<name>/_data` | RAM only — never touches disk |
| **Who manages it** | You (host filesystem) | Docker | Docker (kernel tmpfs) |
| **Survives `docker rm`?** | Yes (it's on the host) | Yes (until `docker volume rm`) | **No** — dies with the container |
| **Survives host reboot?** | Yes | Yes | No |
| **Portable across hosts?** | No (tied to a host path) | Yes (back up & move the volume) | N/A |
| **Performance** | Native host FS (can be slow on Mac/Win via VM) | Native, optimised | Fastest (RAM) |
| **`-v` short syntax** | `-v /host/path:/container/path` | `-v myvol:/container/path` | n/a (use `--tmpfs`) |
| **Primary use** | Dev hot-reload, config injection | DB data, persistent app state | Secrets, scratch, caches you never want on disk |

The one rule that decides almost everything:

- **Anything a host human/editor needs to touch live → bind mount.** (Your source code during dev.)
- **Anything the app owns and must persist → named volume.** (Postgres data dir.)
- **Anything sensitive or throwaway that must never hit disk → tmpfs.** (Decrypted secrets, temp files under a read-only root.)

> A subtle 4th category: **anonymous volumes** — a named volume with no name (`-v /container/path`, no `source:`). Docker assigns a random hash as the name. Used for the `node_modules`-shadowing trick in Phase 6, and as a footgun otherwise (they pile up; see Common Mistakes).

---

## 4.2 Bind Mounts

A bind mount takes an existing **host path** and makes it appear at a path inside the container. There is no copy — it's the *same inode*. Write from the host, the container sees it instantly; write from the container, the host file changes. This is exactly the behaviour you want for development.

```bash
# Mount the current project dir into the container at /app
# Source code edits on the host show up instantly inside the container.
docker run -d \
  --name dev \
  -v "$(pwd)":/app \           # HOST path : CONTAINER path  (absolute host path required with -v)
  -w /app \                    # set working dir inside the container
  -p 3000:3000 \
  node:20-alpine \
  npm run dev                  # nodemon/ts-node-dev inside container picks up host file changes
```

**Good for:**
- Dev hot-reload — edit on host, `nodemon`/`dotnet watch` reloads inside the container.
- Injecting a single config file: `-v "$(pwd)/nginx.conf":/etc/nginx/nginx.conf:ro`.
- Pulling build artifacts out of a one-shot container onto the host.

**Bad for:**
- Production data. A bind mount is glued to a specific host directory layout. Move to another server and the path doesn't exist. Not portable, not Docker-managed, not backed up by the volume tooling.

### The empty-source gotcha (bind mounts vs volumes differ here!)

```bash
# If /app already had files in the IMAGE, a bind mount HIDES them.
# The host dir is laid OVER the image dir — like mounting a USB stick over a folder.
docker run -v "$(pwd)/empty-dir":/app myimage   # /app now shows ONLY empty-dir's contents
```

This bites people who bind-mount over a directory the image populated (e.g. an image that `COPY`'d code to `/app`, then you mount an empty host dir there → the code vanishes). **Named volumes behave differently**: an *empty* named volume mounted over a populated image dir gets *pre-seeded* with the image's contents. Bind mounts never pre-seed.

### The UID / permission mismatch problem — the #1 bind-mount pain

This is the gotcha that eats an afternoon. Linux file permissions are by **numeric UID/GID**, not username. The kernel doesn't know or care about names — only numbers. A bind mount shares the host's raw inodes, so **the UIDs are shared too, even though the username-to-UID mapping is different on each side.**

```
 HOST                                CONTAINER
 ────                                ─────────
 user "me"      = UID 1000           user "node"  = UID 1000   ← lucky: matches
 file owner     = UID 1000           sees files owned by 1000  ← read/write OK

 BUT:

 user "me"      = UID 1000           user "app"   = UID 1001   ← mismatch!
 file owner     = UID 1000           sees files owned by "1000" (no name)
                                     → app (1001) gets EACCES / Permission denied
```

Concretely, you'll see:

```bash
# Container runs as a non-root user (good security practice) whose UID
# does NOT match your host UID. The app tries to write a log/cache file
# into the bind-mounted dir and gets:
#   Error: EACCES: permission denied, open '/app/.cache/x'
```

Or the reverse — the container runs as **root** (UID 0), writes files into the bind mount, and now on the *host* those files are owned by root and you can't edit/delete them without `sudo`.

**How to fix it:**

```bash
# Option A — run the container as YOUR host UID:GID at runtime.
# Files the container creates are then owned by you on the host.
docker run --rm \
  -u "$(id -u):$(id -g)" \      # e.g. 1000:1000 — match the host caller
  -v "$(pwd)":/app -w /app \
  node:20-alpine npm install
```

```dockerfile
# Option B — bake a user with a KNOWN, fixed UID into the image, then
# make sure the host dir is owned by that same UID.
RUN addgroup --system --gid 1001 appgroup \
 && adduser  --system --uid 1001 --ingroup appgroup appuser
USER appuser
# On the host: chown -R 1001:1001 ./data   (so the UIDs line up)
```

```bash
# Option C (Linux 20.10+) — user-namespace remapping or runtime UID flags.
# For named volumes specifically you can also let Docker create the volume
# and chown it as root in an init step — but for BIND mounts the UID must
# physically match because you share the host's inodes.
```

> **TS/Node analogy:** it's like a file written by `process.getuid()` 1000 that another process running as 1001 can't `fs.open()` for write. The fix is always: make the writer and the dir-owner agree on a UID.

> **Mac/Windows note:** Docker Desktop runs Linux in a VM, so bind mounts cross a VM boundary (gRPC-FUSE / virtiofs). UID mismatch is usually papered over, but **performance** is the cost — bind-mounting `node_modules` on a Mac is notoriously slow. Prefer a *named volume* for `node_modules` even in dev.

### Read-only bind mounts — `:ro`

If the container only needs to *read* the mounted path (config files, certs, static assets), mount it read-only. The container physically cannot write there — a cheap, strong guardrail.

```bash
docker run -d \
  -v "$(pwd)/nginx.conf":/etc/nginx/nginx.conf:ro \   # :ro = read-only
  -v "$(pwd)/certs":/etc/ssl/private:ro \
  -p 443:443 nginx:alpine
# nginx can read its config and certs but cannot modify or delete them.
```

---

## 4.3 Named Volumes

A named volume is **Docker-managed storage**. You give it a name; Docker decides where the bytes physically live (under `/var/lib/docker/volumes/<name>/_data` for the default `local` driver). You never reference a host path — you reference the *name*. That indirection is the whole point: the volume is decoupled from any specific host layout, so it's portable and Docker can manage its lifecycle.

```bash
# Create explicitly (optional — Docker auto-creates on first use)
docker volume create pgdata

# Run Postgres with the volume mounted at its data directory.
# Postgres writes to /var/lib/postgresql/data → that's now the volume.
docker run -d \
  --name pg \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \   # NAME : path  (no leading slash on the name = volume)
  postgres:16

docker volume ls                 # list volumes
docker volume inspect pgdata     # JSON: Mountpoint, Driver, CreatedAt, Labels
docker volume rm pgdata          # remove — FAILS if any container (even stopped) uses it
docker volume prune              # remove ALL volumes not referenced by any container
docker volume prune -a           # also remove named (not just anonymous) unused volumes
```

> The `-v` syntax disambiguates by the **first character**: a leading `/` (or `.`/`~` that resolves to a path) → bind mount; a plain name → named volume. `-v pgdata:/data` is a volume; `-v /pgdata:/data` is a bind mount of the host's `/pgdata`. One slash changes everything.

### Lifecycle — volumes outlive containers *on purpose*

```
docker run -v pgdata:/...   →  container A using pgdata
docker stop A; docker rm A  →  container gone, pgdata UNTOUCHED  ✔ data safe
docker run -v pgdata:/...   →  container B reusing pgdata → sees A's data
docker volume rm pgdata     →  NOW the data is actually deleted
```

This decoupling is exactly what you want for a database: you can upgrade Postgres `16 → 17` by removing the old container and starting a new image **against the same volume**, and the data is right there. This is the heart of the Phase 4 exercise.

> `docker rm -v A` removes a container *and its anonymous volumes*, but **named** volumes are never auto-removed — they require an explicit `docker volume rm` or `docker compose down -v`. This is a safety feature: Docker refuses to silently delete data you named.

**Good for:** database data, uploaded files, persistent caches, anything the app owns and must keep. **Portable** — see backup/migration below.

---

## 4.4 Volume Drivers & Plugins (and `--mount` over `-v`)

### Drivers

The volume *driver* decides where and how the bytes are stored. The default is `local` — bytes on the host's own filesystem. Plugins swap that backend out without changing your app.

- **`local`** — default; host filesystem under `/var/lib/docker/volumes/`.
- **NFS / CIFS** — back a volume with a network share so multiple hosts mount the same data.
- **Cloud block storage** — AWS EBS, Azure Disk, GCE PD via plugins; the volume follows the workload across nodes.
- **Distributed** — drivers like Portworx/Longhorn for clustered/replicated storage.

```bash
# A "local" driver volume that's actually an NFS mount — driver options
# tell the local driver to mount NFS instead of using a plain host dir.
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=10.0.0.5,rw \
  --opt device=:/exported/path \
  nfsdata
```

The benefit: your container still just says `-v nfsdata:/data`. The storage backend is an infrastructure detail, not an app concern — the same separation-of-concerns instinct you'd apply in code.

### `--mount` — prefer it over `-v`

`-v` is terse and historic; it crams everything into one colon-delimited string where the *meaning depends on the shape* of the string (slash or no slash, two parts or three). `--mount` is explicit `key=value` — self-documenting, harder to get subtly wrong, and the only syntax for some advanced options.

```bash
# Named volume — the explicit, readable form
docker run -d \
  --mount type=volume,source=pgdata,target=/var/lib/postgresql/data \
  postgres:16
# type=volume | bind | tmpfs    source/src = name or host path    target/dst = path inside

# Bind mount, read-only
docker run -d \
  --mount type=bind,source="$(pwd)"/config,target=/config,readonly \
  myapp

# tmpfs via --mount
docker run -d \
  --mount type=tmpfs,target=/tmp,tmpfs-size=64m \
  myapp
```

| Concept | `-v` short syntax | `--mount` explicit syntax |
|---|---|---|
| Named volume | `-v pgdata:/data` | `--mount type=volume,source=pgdata,target=/data` |
| Bind mount | `-v "$(pwd)":/app` | `--mount type=bind,source="$(pwd)",target=/app` |
| Read-only | `-v ./c:/c:ro` | `--mount ...,readonly` |
| Missing host path | **auto-creates** a dir | **errors** (safer — catches typos) |

That last row is the practical reason to prefer `--mount`: with `-v`, a typo'd host path is silently created as an empty directory and your config "mysteriously" doesn't load. `--mount` fails loudly instead.

---

## 4.5 Data Backup & Migration

Named volumes are portable, but `/var/lib/docker/volumes/...` is root-owned plumbing you should not poke at directly. The idiomatic pattern: run a **throwaway helper container** that mounts both the volume and a host backup dir, and uses `tar` to move bytes between them. The helper (`alpine`, ~3.5 MB) exists only for the length of the `tar` command thanks to `--rm`.

```bash
# ── BACKUP ─────────────────────────────────────────────────────────────
docker run --rm \
  -v pgdata:/data \              # mount the volume to back up (read source)
  -v "$(pwd)":/backup \          # mount host CWD as the backup destination
  alpine \
  tar czf /backup/pgdata.tar.gz -C /data .
#       │   │                    │       │  └ archive everything in the dir...
#       │   │                    │       └──── ...changing into /data first (so paths are relative)
#       │   │                    └──────────── output file lands in the host CWD via the /backup mount
#       │   └───────────────────────────────── z = gzip, c = create, f = file
#       └───────────────────────────────────── tar runs INSIDE the helper container
# Result: ./pgdata.tar.gz on the host — a portable, movable snapshot.
```

```bash
# ── RESTORE ────────────────────────────────────────────────────────────
docker volume create pgdata          # ensure the target volume exists (often a NEW empty one)
docker run --rm \
  -v pgdata:/data \                  # target volume to restore INTO
  -v "$(pwd)":/backup \              # where the tarball lives
  alpine \
  tar xzf /backup/pgdata.tar.gz -C /data
#       │                       │
#       │                       └ extract into the volume root
#       └ x = extract (vs c = create)
```

**Migration to another host** is just: backup → `scp pgdata.tar.gz otherhost:` → restore on the other host into a freshly created volume. The tarball is the unit of portability.

> **Critical caveat for databases:** stop the database container (or use a DB-native dump) before a `tar` backup of a *live* data dir. Copying Postgres/MySQL files while the engine is mid-write can capture a torn, inconsistent state. For zero-downtime DB backups, prefer `pg_dump` / `mysqldump` (logical dumps) over a raw filesystem tar. The tar pattern is perfect for *quiesced* volumes and non-DB data (uploads, caches, generated assets).

```bash
# DB-native backup is safer for a live database than tar'ing its files:
docker exec pg pg_dump -U postgres mydb > backup.sql          # logical dump from a running DB
docker exec -i pg psql  -U postgres mydb < backup.sql          # restore
```

---

## 4.6 Filesystem Considerations

### Why you must NOT store app data in the writable layer

Recall the layered model: image layers are read-only and shared; each container adds **one thin writable layer** via copy-on-write (CoW). Anything you write *that isn't on a mount* lands in that writable layer. That layer has three fatal properties for data:

1. **Ephemeral.** `docker rm` deletes the writable layer. Your data is gone — no warning, no recovery. A container is supposed to be disposable; treating its writable layer as storage breaks that contract.
2. **Slow.** Writes go through the CoW/OverlayFS machinery. The first write to a file existing in a lower layer copies the whole file up first. Heavy write workloads (a database!) on the writable layer are markedly slower than on a volume, which bypasses CoW.
3. **Not portable / not shareable.** It's locked inside one container. You can't back it up with the volume tooling, can't share it, can't move it.

```
WRONG                                   RIGHT
─────                                   ─────
container writes /var/lib/.../data      mount a volume at /var/lib/.../data
        │                                       │
   writable layer (CoW)                   named volume (no CoW, persists)
        │                                       │
   docker rm  →  DATA LOST  ✘              docker rm  →  data safe  ✔
```

The discipline: **treat the container filesystem as read-only-ish and disposable.** Every path the app writes meaningful data to should be a mount (volume for persistence, tmpfs for throwaway). If you can `docker rm` the container and lose nothing important, you've done it right. This is the "cattle, not pets" principle — and it's what makes containers safe to kill, scale, and replace.

### Read-only root filesystem + tmpfs — security hardening

You can flip the writable layer off entirely with `--read-only`. The container's root FS becomes immutable. This is a strong security posture: malware/exploits can't drop a payload, can't modify binaries, can't write a webshell. But almost every real app needs *some* writable scratch space (PID files, `/tmp`, caches), so you punch precise holes with **tmpfs** (in-RAM, ephemeral, never on disk) or named volumes for the few paths that genuinely need writing.

```bash
docker run -d \
  --read-only \                          # entire root filesystem is immutable
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \# writable in-RAM scratch; noexec blocks running files from /tmp
  --tmpfs /run \                         # PID files, sockets
  -v applogs:/var/log/app \              # logs that must persist → a real volume
  myapp
# Everything else is read-only. The app can ONLY write where you explicitly allowed.
```

The same in Compose (Phase 5/7 will revisit this):

```yaml
services:
  api:
    image: myapp
    read_only: true
    tmpfs:
      - /tmp
      - /run
    volumes:
      - applogs:/var/log/app
```

> **tmpfs is also the right home for secrets.** A decrypted secret written to tmpfs lives in RAM and never lands on a disk that could be imaged/forensically recovered. Note Docker's *secrets* feature already mounts secrets under `/run/secrets` as a tmpfs for exactly this reason — covered in Phase 7. Prefer dedicated secrets management over stashing secrets in either a volume or a bind mount.

### Volumes vs bind mounts vs the writable layer — the final decision tree

```
Does the data need to persist past `docker rm`?
├─ No  → is it sensitive or must-never-hit-disk?
│        ├─ Yes → tmpfs
│        └─ No  → writable layer is fine (truly throwaway scratch)
└─ Yes → does a host human/editor need to touch it live?
         ├─ Yes (source code, live config) → bind mount
         └─ No  (DB data, uploads, app state) → named volume   ← the default for real data
```

---

## Common Mistakes

- **Storing the database in the writable layer.** `docker run postgres` with no `-v` "works" — until the first `docker rm` (or `docker compose down`, or a crash that recreates the container) silently wipes every row. Always mount a named volume at the DB data dir.

- **Bind-mounting an empty host dir over a populated image dir.** The mount *hides* the image's files (bind mounts never pre-seed). Symptom: "my code disappeared inside the container." Fix: mount the right path, or use a named volume (which *does* pre-seed from the image).

- **UID mismatch → `EACCES` on bind mounts.** Container's non-root user UID ≠ host file owner UID → permission denied. Fix with `-u "$(id -u):$(id -g)"` or a fixed-UID image user whose UID matches the host dir owner. (See 4.2.)

- **Container runs as root, leaves root-owned files on the host.** After a bind-mount build, `rm -rf ./node_modules` needs `sudo`. Same root cause as above, opposite direction — run as your UID.

- **`-v` silently creating a directory from a typo.** `-v "$(pwd)/confg":/etc/app/config` (typo'd `confg`) → Docker makes an empty `confg/` dir and the app loads no config, with no error. Use `--mount type=bind,...` which errors on a missing source path.

- **Expecting `docker volume rm` to work while a (stopped) container references it.** It fails. Remove the container first, or `docker volume prune`. Named volumes are intentionally hard to delete.

- **`docker compose down -v` in the wrong place.** The `-v` flag deletes the project's named volumes — i.e. your data. Great for resetting a dev DB, catastrophic if you muscle-memory it against something that matters.

- **Anonymous volumes piling up.** Forgetting a `source:` (`-v /container/path`) or images with a `VOLUME` instruction create *anonymous* volumes on every `docker run`. They accumulate as orphaned `<random-hash>` entries eating disk. Audit with `docker volume ls -f dangling=true` and clear with `docker volume prune`.

- **`tar`-ing a live database's volume.** Copies a torn, mid-write state → a backup that won't restore cleanly. Stop the DB, or use `pg_dump`/`mysqldump`. (See 4.5.)

- **Editing files directly under `/var/lib/docker/volumes/`.** It's root-owned internal plumbing; bypassing Docker invites permission and consistency problems. Go through a helper container instead.

- **Assuming tmpfs survives anything.** It doesn't survive a container restart, let alone `rm`. It's RAM. Never put data you want to keep there — that's the whole point of it.

- **Forgetting `:ro` on config/cert mounts.** A read-write mount of secrets/config is a needless write surface. If the container only reads it, mark it `:ro` / `readonly`.

---

## Phase 4 Exercise

**Goal:** Prove to yourself, hands-on, that a named volume decouples data from a container's lifecycle — and that you can back it up and restore it.

**Steps (from the plan):**
1. Run a PostgreSQL container backed by a **named volume**.
2. Insert some data.
3. Stop **and remove** the container entirely.
4. Start a **new** container against the **same volume** — confirm the data survived.
5. Back up the volume, then restore it.

**Concrete hints:**

```bash
# 1. Named volume + Postgres. Mount it at Postgres's data dir.
docker volume create pgdata
docker run -d --name pg1 \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

# 2. Insert data — shell in with psql and create something you'll recognise.
docker exec -it pg1 psql -U postgres -c \
  "CREATE TABLE notes(id serial primary key, body text); \
   INSERT INTO notes(body) VALUES ('phase 4 survived');"

# 3. Destroy the container — NOT the volume.
docker stop pg1 && docker rm pg1
docker volume ls            # pgdata is still listed → data is safe on the volume

# 4. Brand-new container, SAME volume. The new Postgres sees the old data dir.
docker run -d --name pg2 \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16
docker exec -it pg2 psql -U postgres -c "SELECT * FROM notes;"
#   → 'phase 4 survived'  ← persistence proven across container destruction

# 5a. Backup. Stop the DB first so the files are quiesced, then tar via a helper.
docker stop pg2
docker run --rm \
  -v pgdata:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/pgdata.tar.gz -C /data .
ls -lh pgdata.tar.gz        # your portable snapshot

# 5b. Restore into a FRESH volume to prove the tarball is self-contained.
docker volume create pgrestore
docker run --rm \
  -v pgrestore:/data -v "$(pwd)":/backup \
  alpine tar xzf /backup/pgdata.tar.gz -C /data
docker run -d --name pg3 \
  -e POSTGRES_PASSWORD=secret \
  -v pgrestore:/var/lib/postgresql/data \
  postgres:16
docker exec -it pg3 psql -U postgres -c "SELECT * FROM notes;"
#   → 'phase 4 survived'  ← restored from the tarball into a different volume
```

**Stretch goals:**
- Repeat step 4 but with `postgres:17` instead of `:16` against the same `pgdata` — observe an in-place major-version upgrade (note: Postgres major upgrades may need `pg_upgrade`; watch the logs — a great way to see *why* logical `pg_dump` backups matter).
- Redo the backup with `pg_dump` instead of `tar` and compare: which one let you back up *without* stopping the database?
- Add `--read-only` plus `--tmpfs /tmp` to a throwaway container and watch what breaks — then fix it by punching the right tmpfs/volume holes.

**Cleanup when done:**
```bash
docker rm -f pg1 pg2 pg3 2>/dev/null
docker volume rm pgdata pgrestore
```
