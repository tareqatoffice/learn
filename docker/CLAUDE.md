# Docker Learning Journey

## Who I am

Experienced frontend developer with TypeScript fluency and Node.js backend experience. Currently also learning ASP.NET Core (.net/) and advanced JavaScript internals (javascript/). Familiar with running `docker run` and basic Compose — not a Docker expert.

## Why I am here

Docker is the common infrastructure layer under both the .NET and Node.js tracks. Goal: go from "I can run containers" to "I can design, secure, and operate multi-container production systems."

## Goals

- **Primary:** Understand containers deeply enough to Dockerize any app correctly
- **Tooling:** Docker CLI, Buildx, Docker Compose, GitHub Actions integration
- **Deep focus:** Multi-stage builds, networking, Compose for microservices, security hardening, CI/CD, production patterns
- **Kubernetes:** Intro-level — understand why K8s exists and how Compose maps to it
- **Pace:** Intensive alongside the other two tracks

---

## Progress Tracker

| Phase | Topic | Status | Notes File |
|-------|-------|--------|------------|
| 1 | Containers & Images — Core Concepts | Not started | `notes/01-containers-images.md` |
| 2 | Writing Dockerfiles | Not started | `notes/02-dockerfiles.md` |
| 3 | Networking | Not started | `notes/03-networking.md` |
| 4 | Volumes & Storage | Not started | `notes/04-volumes-storage.md` |
| 5 | Docker Compose | Not started | `notes/05-compose.md` |
| 6 | Development Workflows | Not started | `notes/06-dev-workflows.md` |
| 7 | Security | Not started | `notes/07-security.md` |
| 8 | CI/CD Integration | Not started | `notes/08-cicd.md` |
| 9 | Production Patterns | Not started | `notes/09-production.md` |
| 10 | Kubernetes Intro | Not started | `notes/10-kubernetes-intro.md` |

---

## Currently Learning

_Nothing started yet._

## Completed Topics

_Nothing completed yet._

## Next Steps

1. Start Phase 1: Containers & Images (`LEARNING_PLAN.md` → Phase 1)
2. Work through namespaces, cgroups, image layers, and the Docker CLI
3. Create `notes/01-containers-images.md` as you progress

---

## Project Structure (will grow over time)

```
docker/
├── CLAUDE.md               ← this file (always-on context)
├── LEARNING_PLAN.md        ← full roadmap with all topics
├── notes/                  ← per-phase notes with examples and exercises
│   ├── 01-containers-images.md
│   ├── 02-dockerfiles.md
│   └── ...
└── examples/               ← Dockerfiles, Compose files, sample apps
    ├── phase1-basics/
    ├── phase2-multistage/
    ├── phase5-compose-stack/
    └── ...
```

---

## Key Conventions for This Learning Journey

- Each phase has a notes file with concepts, CLI commands, annotated Dockerfiles/Compose files
- Practical examples go in `examples/` — real files, not just snippets
- Cross-references to .NET and Node.js tracks where Docker is the glue
- Each notes file has a "Common Mistakes" section for things that bite everyone
