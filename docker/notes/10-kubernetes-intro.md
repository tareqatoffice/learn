# Phase 10 — Kubernetes Intro

> **Goal of this phase:** Not to become a Kubernetes operator. The goal is to understand *why* K8s exists, *when you actually need it* (spoiler: less often than the hype implies), and how everything you already know from Docker Compose maps onto it. You speak Compose fluently by now — we'll use that as the Rosetta Stone for every K8s concept.

---

## 10.1 Why Kubernetes (The Real Answer)

### The one-sentence version

**Compose orchestrates containers on *one machine*. Kubernetes orchestrates containers across a *cluster* of machines, and keeps them in the state you declared even when machines and processes die.**

That's it. Everything else is detail hanging off that sentence.

### The mental model: declarative desired state

This is the single most important idea in K8s, and it's different from how Compose feels.

- **Compose (imperative-ish):** you run `docker compose up`. It creates containers. If a container crashes and you don't have `restart:`, it stays dead. Compose is a *thing you run*.
- **Kubernetes (declarative):** you submit a document that says "I want 3 replicas of this image, healthy, reachable on port 80." K8s runs a **control loop** forever: *observe actual state → compare to desired state → act to close the gap → repeat.* K8s is a *system that runs continuously*.

```
            ┌──────────────────────────────────────────┐
            │              CONTROL LOOP                  │
            │   (runs forever, every few seconds)        │
            │                                            │
   You ───► │   desired state  ──┐                       │
  (YAML)    │                    ▼                       │
            │              ┌──────────┐                  │
            │              │ reconcile │ ◄── actual state │
            │              └────┬─────┘                  │
            │                   │ "I want 3, I see 2"     │
            │                   ▼                         │
            │            start 1 more pod                 │
            └──────────────────────────────────────────┘
```

This is why you don't "restart" things in K8s the way you do in Compose. You *change the desired state* and the cluster converges to it.

### What you actually get from this loop

**1. Self-healing**
- Pod (container) crashes → K8s restarts it. (Like `restart: always`, but smarter.)
- The *node* (whole machine) dies → K8s notices the pods are gone and reschedules them onto other healthy nodes. **Compose cannot do this — it only knows one machine.**
- A pod fails its health probe → K8s stops sending it traffic and eventually restarts it.

**2. Horizontal autoscaling**
- The **HorizontalPodAutoscaler (HPA)** watches CPU/memory (or custom metrics) and adds/removes replicas automatically.
- Black Friday traffic spike → 3 pods become 20. Traffic drops → back to 3.
- Compose has `deploy.replicas`, but it's a fixed number you set by hand; nothing scales it for you.

**3. Rolling updates with automatic rollback**
- Deploy a new image version → K8s replaces pods *gradually* (e.g. one at a time), waiting for each new pod to pass health checks before killing an old one. Zero downtime.
- If the new pods never become healthy, the rollout stalls and you can `kubectl rollout undo` to snap back to the previous version.
- In Compose, `docker compose up -d` with a new tag recreates containers with a brief blip of downtime and no built-in rollback.

**4. Service discovery + load balancing**
- You get a stable internal DNS name (e.g. `api`) that load-balances across all healthy replicas. Pods are cattle — they come and go with changing IPs — but the **Service** name stays constant.
- This is the Compose "service name is a hostname" feature, but it transparently spreads traffic across N replicas and only routes to *healthy* ones.

### When you do NOT need Kubernetes (read this twice)

K8s is genuinely powerful, and genuinely *a lot*. As a Node/.NET developer, your instinct should be **resist it until the pain is real**. You do **not** need K8s when:

- **Your app fits on one server.** A single VPS running `docker compose up -d` behind Nginx serves an enormous amount of traffic. Most side projects, internal tools, and early-stage products live here happily for years.
- **You're a small team.** K8s has a steep operational tax: cluster upgrades, RBAC, networking (CNI), ingress controllers, secrets rotation, monitoring. That's potentially a full-time job. If nobody on the team wants that job, don't sign up for it.
- **A managed platform already does the orchestration.** Render, Railway, Fly.io, AWS App Runner, Azure Container Apps, Google Cloud Run — these take a container and give you autoscaling + rolling deploys + health checks *without* you touching K8s. Often the right answer.
- **Your database is managed.** Stateful workloads (Postgres, etc.) are the *hardest* thing to run well on K8s. Use RDS / Cloud SQL / Neon / Supabase and you sidestep the scariest part entirely.

**The honest heuristic:** Reach for K8s when you have (a) multiple machines you *must* coordinate, (b) real need for autoscaling or zero-downtime deploys you can't get from a PaaS, and (c) someone willing to own the platform. Until then, Compose + a managed DB + a PaaS is not "less professional" — it's *less risk*.

> **TS/Node analogy:** K8s is like adopting a full microservices + message-bus + service-mesh architecture. Sometimes you need it. Often a well-structured monolith (one server, one Compose file) ships faster and breaks less.

---

## 10.2 Core Concepts — Compose → K8s Mapping

Here's the table to internalize. Everything on the left you already know.

| Docker Compose | Kubernetes | Notes |
|----------------|-----------|-------|
| `service` | **Deployment** + **Service** | One Compose service splits into *two* K8s objects: the Deployment (runs the pods) and the Service (gives them a stable network identity). |
| `container` | **Pod** (one or more containers) | A Pod is the smallest unit. Usually 1 container; sometimes a main container + a "sidecar" (e.g. a log shipper) sharing the same network/storage. |
| `image:` | `spec.template.spec.containers[].image` | Same image references you already use. |
| `deploy.replicas` / `replicas` | `spec.replicas` in the Deployment | How many copies of the pod to run. |
| named volume | **PersistentVolumeClaim (PVC)** | A *request* for storage. The PVC binds to a PersistentVolume that the cluster provisions. |
| network | **Service** (type `ClusterIP`) | Internal-only stable DNS + load balancing. This is the "service name = hostname" feature. |
| `ports:` (publishing) | **Service** type `NodePort` / `LoadBalancer`, or an **Ingress** | Exposing to the outside world. ClusterIP is internal-only; NodePort/LoadBalancer/Ingress make it reachable externally. |
| `env_file:` / `environment:` | **ConfigMap** (non-secret) / **Secret** (sensitive) | Config split by sensitivity. |
| `healthcheck:` | **livenessProbe** / **readinessProbe** / **startupProbe** | Compose has one health check; K8s splits the concept (see below). |
| `restart: always` | `restartPolicy: Always` (the default for Deployments) | You rarely write this — it's the default. |
| `depends_on` | (no direct equivalent — use probes + init containers) | K8s deliberately has no `depends_on`. Apps must tolerate dependencies not being ready yet (retry/backoff). Readiness probes + initContainers cover the rest. |
| `docker compose up` | `kubectl apply -f .` | Submit desired state. |
| `docker compose down` | `kubectl delete -f .` | Remove the objects. |

### The probe split is worth dwelling on

Compose has *one* `healthcheck`. K8s splits "is this container okay?" into three distinct questions:

```
startupProbe    "Has the app finished booting?"
                → Gives slow starters time. Liveness/readiness wait for this to pass first.
                → (.NET apps with cold JIT, or Node apps loading big models, benefit here.)

livenessProbe   "Is the app deadlocked / wedged?"
                → If it FAILS, K8s KILLS and restarts the container.
                → Be conservative — a too-aggressive liveness probe causes restart loops.

readinessProbe  "Can the app serve traffic right now?"
                → If it FAILS, K8s stops sending traffic (removes pod from the Service)
                  but does NOT kill it. Pod recovers and traffic resumes.
                → Use this for "DB connection is temporarily down" or "warming up."
```

**The classic confusion:** using liveness where you want readiness. If your DB blips and your *liveness* probe checks the DB, K8s will kill perfectly good pods in a loop. Liveness = "is the *process* alive?"; readiness = "is it *ready for traffic*?".

### Why one service becomes two objects

This trips up everyone coming from Compose. In Compose, `api:` is one block. In K8s:

```
            ┌─────────────────────────────────────────────┐
            │  Service "api"  (ClusterIP, stable IP+DNS)    │  ← stable identity
            │  selector: app=api                            │
            └───────────────┬───────────────────────────────┘
                            │ load-balances to pods with label app=api
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ Pod api │         │ Pod api │         │ Pod api │   ← ephemeral, IPs change
   │ app=api │         │ app=api │         │ app=api │
   └─────────┘         └─────────┘         └─────────┘
        ▲                   ▲                   ▲
        └───────────────────┴───────────────────┘
                            │
            ┌───────────────┴───────────────────────────────┐
            │  Deployment "api"  (manages the pods)           │  ← desired-state controller
            │  replicas: 3, template: {image, probes, ...}    │
            └─────────────────────────────────────────────────┘
```

- The **Deployment** is the controller that ensures N pods exist and rolls out new versions.
- The **Service** is the stable front door — its IP/DNS never changes even as pods churn underneath.
- They're glued together by **labels**: the Service's `selector: app=api` matches any pod the Deployment stamps with `labels: app=api`. **Labels are the connective tissue of all of K8s.**

---

## 10.3 Running K8s Locally

You do not need a cloud account to learn this. Three popular local options:

| Tool | What it is | Best for |
|------|-----------|----------|
| **minikube** | Single-node cluster in a VM or container. The "official" beginner tool. | First-time learners; has nice addons (dashboard, ingress). |
| **kind** | "**K**ubernetes **in** **D**ocker" — runs nodes as Docker containers. Can do *multi-node*. | CI pipelines; testing multi-node behavior. (Used in the exercise.) |
| **k3d** | k3s (a lightweight K8s distro) wrapped in Docker. Fastest to spin up. | Quick dev loops; resource-constrained laptops. |

All three give you a real `kubectl`-compatible API. Pick one; the manifests are identical.

```bash
# ── kind (we'll use this for the Phase 10 exercise) ──────────────────────────
kind create cluster --name dev          # spins up a single-node cluster named "dev"
kubectl cluster-info --context kind-dev # confirm the API server is reachable
kubectl get nodes                       # should show one node, STATUS Ready

# Loading a locally-built image INTO kind (important — kind can't see your
# host's Docker images by default; there's no registry involved):
docker build -t myapp:dev .
kind load docker-image myapp:dev --name dev   # push the image into the kind node
# Then reference image: myapp:dev with imagePullPolicy: IfNotPresent in your manifest

kind delete cluster --name dev          # tear it all down when finished

# ── minikube (alternative) ───────────────────────────────────────────────────
minikube start                          # boots a single-node cluster
minikube image load myapp:dev           # equivalent of "kind load docker-image"
minikube dashboard                      # opens a web UI (handy for visualizing objects)
minikube stop

# ── k3d (alternative, fastest) ───────────────────────────────────────────────
k3d cluster create dev                  # create
k3d image import myapp:dev -c dev       # load local image
k3d cluster delete dev                  # delete
```

> **The local-image gotcha (bites everyone):** With Compose, `build:` and `image:` share your machine's Docker. With local K8s, the cluster runs *inside* its own container(s) and **cannot see images you built on the host**. You must explicitly load them (`kind load docker-image`, `minikube image load`, `k3d image import`). Forgetting this gives you `ErrImagePull` / `ImagePullBackOff` even though `docker images` shows the image right there.

---

## 10.4 Essential kubectl

`kubectl` is to K8s what the `docker`/`docker compose` CLI is to Docker. Learn these and you can operate 90% of day-to-day tasks.

```bash
# ── INSPECTING (the verbs you'll use constantly) ─────────────────────────────
kubectl get pods                     # list pods (like `docker ps`)
kubectl get pods -o wide             # + node, IP, etc.
kubectl get pods --watch             # live-update as pods change state
kubectl get deployments              # list Deployments
kubectl get services                 # list Services (note their CLUSTER-IP / PORTS)
kubectl get all                      # pods + deployments + services + replicasets at once
kubectl get pods -l app=api          # filter by LABEL (labels are everywhere)

kubectl describe pod <name>          # full detail + EVENTS (scheduling, pulls, probe fails)
                                     # ^ THE first command to run when something is broken.

# ── LOGS & SHELL (your Compose muscle memory transfers) ──────────────────────
kubectl logs <pod-name>              # like `docker logs`
kubectl logs -f <pod-name>           # follow (like `docker logs -f`)
kubectl logs <pod-name> --previous   # logs from the PREVIOUS crashed container — vital for crash loops
kubectl logs -l app=api --all-containers  # logs across all pods matching a label

kubectl exec -it <pod-name> -- sh    # shell into a running pod (like `docker exec -it`)
                                     # note the `--` separating kubectl args from the command

# ── APPLYING & DELETING DESIRED STATE ────────────────────────────────────────
kubectl apply -f manifest.yaml       # create OR update to match the file (idempotent)
kubectl apply -f ./k8s/              # apply every manifest in a directory
kubectl delete -f manifest.yaml      # remove the objects defined in the file
kubectl diff -f manifest.yaml        # preview what `apply` WOULD change — do this before applying

# ── ROLLOUTS (rolling updates & rollback — the headline feature) ─────────────
kubectl rollout status deployment/api   # watch a rollout progress; exits 0 when done, non-zero if it fails
kubectl rollout history deployment/api  # list previous revisions
kubectl rollout undo deployment/api     # ROLL BACK to the previous revision
kubectl rollout undo deployment/api --to-revision=3   # roll back to a specific one
kubectl rollout restart deployment/api  # cleanly recreate all pods (e.g. to pick up a changed Secret)

# ── SCALING ──────────────────────────────────────────────────────────────────
kubectl scale deployment/api --replicas=5   # imperative scale (handy in a pinch)

# ── PORT-FORWARDING (reach an internal Service from your laptop) ─────────────
kubectl port-forward service/api 8080:80   # localhost:8080 → Service "api" port 80
                                           # ^ how you hit a ClusterIP service locally

# ── CONTEXTS (which cluster am I talking to?!) ───────────────────────────────
kubectl config get-contexts          # list clusters you can talk to
kubectl config current-context       # WHICH ONE AM I POINTED AT (check before destructive ops)
kubectl config use-context kind-dev  # switch
```

> **`kubectl apply` vs `kubectl create`:** Use `apply` (declarative — repeatable, updates in place). `create` is imperative and errors if the object already exists. Treat `apply -f` as your `docker compose up`.

> **TS/Node analogy:** `kubectl apply -f` is like `git push` to a state-reconciling system — you push the *desired* config and the cluster figures out the diff. `kubectl describe` is like reading the stack trace; `kubectl logs --previous` is the stack trace from *before the process restarted*.

---

## 10.5 A Minimal Deployment

Here is a complete, heavily-annotated Deployment + Service. This is the K8s equivalent of a single Compose service for a Node/.NET API. Read every comment.

```yaml
# deployment.yaml  — two objects in one file, separated by "---"

# ─────────────────────────────────────────────────────────────────────────────
# OBJECT 1: the Deployment — runs and supervises the pods
# ─────────────────────────────────────────────────────────────────────────────
apiVersion: apps/v1          # API group/version for Deployments (apps/v1 is stable)
kind: Deployment             # the *type* of object
metadata:
  name: api                  # the Deployment's name
  labels:
    app: api                 # label on the Deployment object itself (organizational)
spec:
  replicas: 2                # desired pod count. Compose: deploy.replicas / scale=2
  selector:
    matchLabels:
      app: api               # "this Deployment manages pods labeled app=api"
                             # MUST match template.metadata.labels below, or apply fails.
  strategy:
    type: RollingUpdate      # the default; rolls pods one batch at a time (zero-downtime)
    rollingUpdate:
      maxUnavailable: 0      # never drop below desired count during a rollout
      maxSurge: 1            # may temporarily add 1 extra pod while rolling
  template:                  # ── the POD blueprint stamped out `replicas` times ──
    metadata:
      labels:
        app: api             # pods get this label → matched by selector AND by the Service
    spec:
      containers:
        - name: api          # container name (within the pod)
          image: ghcr.io/myorg/api:1.4.2   # PIN a version — never :latest in real clusters
          imagePullPolicy: IfNotPresent    # for local (kind) images; use Always for remote tags
          ports:
            - containerPort: 3000          # the port the app listens on INSIDE the container
          env:
            # Non-secret config pulled from a ConfigMap (see 10.6):
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: node-env
            # Secret config pulled from a Secret (see 10.6):
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          # ── PROBES (Compose's single healthcheck, split into three) ──
          startupProbe:                    # "has it finished booting?" — protects slow starts
            httpGet:
              path: /health
              port: 3000
            failureThreshold: 30           # allow 30 * periodSeconds before giving up
            periodSeconds: 2               # → up to 60s to boot before liveness kicks in
          livenessProbe:                   # "is it wedged?" — FAIL → restart the container
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 0         # startupProbe already guarded the boot window
            periodSeconds: 10
          readinessProbe:                  # "ready for traffic?" — FAIL → pulled from Service
            httpGet:
              path: /ready                 # ideally checks DB/deps; liveness should NOT
              port: 3000
            periodSeconds: 5
          # ── RESOURCES (Compose: deploy.resources) ──
          resources:
            requests:                      # what the scheduler GUARANTEES (used for placement)
              memory: "128Mi"
              cpu: "100m"                  # 100m = 0.1 CPU core
            limits:                        # hard ceiling; exceeding memory → OOMKilled
              memory: "256Mi"
              cpu: "500m"
---
# ─────────────────────────────────────────────────────────────────────────────
# OBJECT 2: the Service — stable network identity + load balancing
# ─────────────────────────────────────────────────────────────────────────────
apiVersion: v1               # core API group (Services are v1, not apps/v1)
kind: Service
metadata:
  name: api                  # ← THIS becomes the internal DNS name: other pods reach it at "api"
spec:
  type: ClusterIP            # internal-only (default). NodePort/LoadBalancer to expose externally.
  selector:
    app: api                 # route to any pod labeled app=api — THE GLUE to the Deployment's pods
  ports:
    - port: 80               # the port the Service listens on (what callers connect to)
      targetPort: 3000       # the containerPort to forward to inside the pod
# Now any pod in the cluster can do: http://api:80  (or just http://api)
# and traffic load-balances across the 2 healthy replicas.
```

Apply and watch it converge:

```bash
kubectl apply -f deployment.yaml
kubectl get pods -l app=api --watch       # watch 2 pods go ContainerCreating → Running
kubectl rollout status deployment/api     # blocks until the rollout is complete
kubectl port-forward service/api 8080:80  # then curl http://localhost:8080/health
```

> **`requests` vs `limits` (the bit Compose hand-waves):** `requests` is what the scheduler *reserves* to decide which node has room. `limits` is the hard cap. Exceed the *memory* limit → the kernel OOM-kills the container (exit 137 — same code you saw in Phase 1). Exceed the *CPU* limit → you get throttled, not killed. Set requests realistically; set limits to catch runaways.

---

## 10.6 ConfigMaps & Secrets

Compose lumps config into `env_file` / `environment`. K8s splits it by sensitivity:

- **ConfigMap** — non-sensitive config (feature flags, log levels, URLs, `node-env`).
- **Secret** — sensitive values (DB passwords, API keys, JWT signing keys).

### Creating them imperatively (quick, for dev)

```bash
# A ConfigMap from literal key/values:
kubectl create configmap app-config \
  --from-literal=node-env=production \
  --from-literal=log-level=info

# A ConfigMap from a file (the whole file becomes one key):
kubectl create configmap app-config-file \
  --from-file=config.json                  # key "config.json", value = file contents

# A Secret from literals:
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgres://user:pass@db:5432/mydb" \
  --from-literal=jwt-secret="super-secret-value"
```

### Declaratively (so it lives in version control — preferred)

```yaml
# config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  node-env: "production"        # plain strings — readable, diffable, safe to commit
  log-level: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque                    # generic secret
stringData:                     # stringData = you write PLAINTEXT; K8s base64-encodes it for you
  database-url: "postgres://user:pass@db:5432/mydb"
  jwt-secret: "super-secret-value"
# (If you use `data:` instead of `stringData:`, YOU must base64-encode the values yourself.)
```

### Consuming them in a pod

**As individual env vars** (shown in 10.5 — `configMapKeyRef` / `secretKeyRef`).

**Or import every key at once:**

```yaml
spec:
  containers:
    - name: api
      image: ghcr.io/myorg/api:1.4.2
      envFrom:
        - configMapRef:
            name: app-config        # every key becomes an env var
        - secretRef:
            name: app-secrets       # every secret key becomes an env var
```

**Or mount a secret as files** (the production-preferred way for things like TLS certs):

```yaml
spec:
  containers:
    - name: api
      volumeMounts:
        - name: secret-vol
          mountPath: /run/secrets   # files appear here, one per key (like Docker secrets!)
          readOnly: true
  volumes:
    - name: secret-vol
      secret:
        secretName: app-secrets
```

> **The big honesty caveat about K8s Secrets:** A `Secret` is **NOT encrypted by default** — it is merely **base64-encoded**, which is *encoding, not encryption*. Anyone with read access to the namespace can `kubectl get secret app-secrets -o yaml | base64 -d` and read it. Treat base64 as "obscured," not "secure." For real protection: enable **encryption at rest** on the cluster, lock down **RBAC**, and for serious setups use an external manager (**HashiCorp Vault**, **External Secrets Operator**, **Sealed Secrets**, or your cloud's secret store). And **never commit a real Secret manifest with live values to git** — that's exactly the leak base64 won't save you from.

> **Changing config = recreate pods.** Updating a ConfigMap/Secret does **not** automatically restart pods that read it as env vars (env is captured at start). After editing, run `kubectl rollout restart deployment/api` to roll new pods with the new values. (Mounted files *do* update live, but the app must re-read them.)

---

## 10.7 Helm — The Package Manager for K8s

Once you have more than a handful of manifests, copy-pasting YAML across environments (dev/staging/prod) gets painful — the files are 90% identical and differ only in a few values (replica count, image tag, resource sizes). **Helm** solves this.

### The mental model

- **Helm is to K8s manifests what `npm` is to JS libraries** — a package manager.
- A **Chart** = a packaged, *templated* set of manifests (your app, parameterized). Like an npm package.
- **`values.yaml`** = the default configuration knobs for a chart. Like a package's default config.
- A **Release** = one installed instance of a chart in your cluster (you can install the same chart many times with different values — `api-staging`, `api-prod`).

```
my-chart/
├── Chart.yaml            # chart metadata: name, version, appVersion (like package.json)
├── values.yaml           # DEFAULT values — overridable at install time
└── templates/            # manifests with {{ }} placeholders
    ├── deployment.yaml   # uses {{ .Values.replicaCount }}, {{ .Values.image.tag }}, ...
    ├── service.yaml
    └── _helpers.tpl      # reusable template snippets
```

### A templated manifest + its values

```yaml
# templates/deployment.yaml — note the {{ }} Go-template placeholders
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-api          # e.g. "api-prod-api" — release name injected by Helm
spec:
  replicas: {{ .Values.replicaCount }}    # value pulled from values.yaml (or --set / -f override)
  selector:
    matchLabels:
      app: {{ .Release.Name }}-api
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}-api
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          resources:
            limits:
              memory: {{ .Values.resources.limits.memory | quote }}
```

```yaml
# values.yaml — the DEFAULTS; override per-environment without touching templates
replicaCount: 2

image:
  repository: ghcr.io/myorg/api
  tag: "1.4.2"

resources:
  limits:
    memory: "256Mi"
```

### The lifecycle commands (this is the payoff)

```bash
# ── Using PUBLIC charts (e.g. run Postgres without writing manifests) ─────────
helm repo add bitnami https://charts.bitnami.com/bitnami   # add a chart repository
helm repo update                                           # refresh the index
helm search repo postgres                                  # find charts

# ── INSTALL: create a release from a chart ────────────────────────────────────
helm install api-prod ./my-chart                  # install local chart as release "api-prod"
helm install api-prod ./my-chart \
  -f values.prod.yaml                             # override defaults with a prod values file
helm install api-prod ./my-chart \
  --set replicaCount=5 --set image.tag=1.5.0      # override single values inline

helm install pg bitnami/postgresql \
  --set auth.password=secret                      # install a public chart with overrides

# ── UPGRADE: change config or roll out a new image version ────────────────────
helm upgrade api-prod ./my-chart --set image.tag=1.5.0   # triggers a rolling update
helm upgrade --install api-prod ./my-chart               # "install if absent, upgrade if present"

# ── ROLLBACK: the headline safety feature — undo a bad upgrade ────────────────
helm history api-prod                              # list revisions of this release
helm rollback api-prod 1                           # snap back to revision 1

# ── INSPECT / DEBUG ───────────────────────────────────────────────────────────
helm list                                          # all releases in the namespace
helm template api-prod ./my-chart                  # render manifests LOCALLY (no cluster) — great for diffing
helm upgrade api-prod ./my-chart --dry-run         # show what WOULD change, don't apply
helm uninstall api-prod                            # remove the release and its objects
```

> **Why this matters as a learner:** Even if you never *write* a chart, you will *consume* them constantly — almost every off-the-shelf component (Postgres, Redis, ingress-nginx, cert-manager, monitoring stacks) ships as a Helm chart. `helm install bitnami/postgresql` is the K8s equivalent of `docker run postgres` — one command instead of hundreds of lines of YAML.

> **TS/Node analogy:** A Helm chart is a parameterized template library; `values.yaml` is its default props; `helm install`/`upgrade` is `npm install`/`npm update`; `helm rollback` is the thing npm *wishes* it had — a one-command revert to the last known-good install.

---

## Common Mistakes

- **Reaching for K8s too early.** The #1 mistake. If one server + Compose + a managed DB serves your load, K8s adds operational cost and complexity with zero user-facing benefit. "Resume-driven development" is real — resist it.
- **`ImagePullBackOff` on a local cluster.** Your locally-built image isn't *in* the cluster. Run `kind load docker-image myapp:dev` (or the minikube/k3d equivalent) and set `imagePullPolicy: IfNotPresent`. The cluster does not share your host's Docker image store.
- **Selector/label mismatch.** The Deployment's `selector.matchLabels`, the pod template's `metadata.labels`, and the Service's `selector` must agree. A typo → the Service routes to nothing (`kubectl get endpoints api` shows none) or `apply` is rejected.
- **Confusing liveness and readiness probes.** Checking the database in a *liveness* probe means a transient DB blip restart-loops all your healthy pods. DB/dependency checks belong in *readiness*; liveness should only ask "is the process itself wedged?".
- **No probes at all.** Without probes, K8s thinks a pod is healthy the instant the container starts — it'll route traffic to an app that's still booting, and won't restart a deadlocked-but-not-crashed process. You lose most of the self-healing you came for.
- **Treating Secrets as encrypted.** Base64 is encoding, not encryption. Don't commit live Secret values to git; enable encryption at rest and lock down RBAC.
- **Setting a memory `limit` too low.** Exceeding the memory limit gets the container OOM-killed (exit 137) — and it looks like a mysterious crash loop. Watch `kubectl describe pod` events for `OOMKilled`.
- **Expecting `depends_on` to exist.** It doesn't. K8s assumes services start in any order and may be temporarily unavailable. Your app must retry connections with backoff. Use `initContainers` for true one-time prerequisites (e.g. run migrations before the app starts).
- **Using `image: latest`.** Same trap as Compose, worse consequences: rollouts and rollbacks become non-deterministic because the tag can silently point at different content. Pin versions.
- **Forgetting which context you're on.** `kubectl config current-context` before any destructive command. Running `kubectl delete` against prod instead of `kind-dev` is a very bad afternoon.
- **Editing a ConfigMap/Secret and expecting pods to pick it up.** Env vars are read at container start. Run `kubectl rollout restart deployment/<name>` after changing config consumed as env.

---

## Phase 10 Exercise

**Task (from the plan):** Migrate your Phase 9 Compose deployment (API + DB + Nginx) to Kubernetes using **kind**. Write Deployment + Service manifests, use a **Secret** for the DB password, and verify that a **rolling update** works (`kubectl rollout status`).

**Concrete steps & hints:**

1. **Spin up the cluster.**
   ```bash
   kind create cluster --name dev
   kubectl config use-context kind-dev      # make sure you're pointed at it
   ```

2. **Get your API image into the cluster.** Build it, then load it (don't skip this — see Common Mistakes):
   ```bash
   docker build -t myapi:v1 .
   kind load docker-image myapi:v1 --name dev
   ```
   In the Deployment, use `image: myapi:v1` and `imagePullPolicy: IfNotPresent`.

3. **Create the Secret for the DB password** — declaratively (`stringData:`) so you understand the format, but **do not commit real values**. Reference it from both the Postgres pod (its `POSTGRES_PASSWORD`) and the API pod (inside its `DATABASE_URL`) via `secretKeyRef`.

4. **Write the manifests** (a directory `k8s/` with one file per concern is tidy):
   - `postgres.yaml`: a Deployment (or, more correctly, a *StatefulSet* — but a Deployment + PVC is acceptable for this learning exercise) + a `ClusterIP` Service named `db`, plus a **PersistentVolumeClaim** for the data (this is your Compose named volume → PVC mapping). The API reaches it at hostname `db` — same as Compose service-name DNS.
   - `api.yaml`: the Deployment + Service from section 10.5. Set `replicas: 3` so the rolling update is observable. Add liveness **and** readiness probes.
   - `nginx.yaml`: an Nginx Deployment + Service. To reach it from your laptop, either use `type: NodePort` or just `kubectl port-forward service/nginx 8080:80`. (A full Ingress controller is beyond this intro — port-forward is fine.)
   - Apply everything: `kubectl apply -f k8s/`

5. **Verify it's healthy.**
   ```bash
   kubectl get all
   kubectl get pods -l app=api --watch       # all 3 Running and READY 1/1
   kubectl get endpoints api                 # confirm the Service found 3 pod IPs (label glue works)
   kubectl port-forward service/nginx 8080:80   # hit http://localhost:8080 in another terminal
   ```

6. **Prove the rolling update + rollback (the whole point).**
   ```bash
   # Build & load a v2 of the API (change a response string so you can see the difference):
   docker build -t myapi:v2 . && kind load docker-image myapi:v2 --name dev

   # Trigger the rollout by changing the image:
   kubectl set image deployment/api api=myapi:v2
   kubectl rollout status deployment/api      # watch it replace pods one batch at a time, zero downtime
   kubectl rollout history deployment/api     # see revisions 1 and 2

   # Now practice the safety net:
   kubectl rollout undo deployment/api        # roll back to v1
   kubectl rollout status deployment/api
   ```

   **What to observe and write up in your notes:** Did any request fail during the rollout? (With `maxUnavailable: 0` + working readiness probes, it shouldn't.) How long did each batch take? What happens if you set the API image to a tag that doesn't exist — does the rollout stall, and can you `rollout undo` out of it?

7. **Tear down.** `kind delete cluster --name dev`

**Stretch goals (optional):**
- Package the API as a tiny **Helm chart** (`replicaCount`, `image.tag`, `resources` in `values.yaml`) and deploy it with `helm install`; then `helm upgrade --set image.tag=v2` and `helm rollback` — compare the experience to raw `kubectl`.
- Add a **HorizontalPodAutoscaler** targeting 50% CPU and generate load to watch replicas grow.
- Reflect honestly in your notes: for *this* app, would you actually run K8s in production, or is Compose-on-a-VPS / a PaaS the better call? Justify it. (This reflection is the real learning objective of the phase.)
