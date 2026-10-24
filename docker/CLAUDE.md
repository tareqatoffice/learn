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

## Where the notes live

This track's notes are the chapters of the **Docker** series (slug `docker`) in the
Learn app (`../web/`). The old `notes/*.md` and `LEARNING_PLAN.md` files were imported
into the app and removed. Read progress is tracked per user in the app, not here.

### Phases

| Phase | Topic |
|-------|-------|
| 1 | Containers & Images — Core Concepts |
| 2 | Writing Dockerfiles |
| 3 | Networking |
| 4 | Volumes & Storage |
| 5 | Docker Compose |
| 6 | Development Workflows |
| 7 | Security |
| 8 | CI/CD Integration |
| 9 | Production Patterns |
| 10 | Kubernetes Intro |

### Adding or editing chapters

Do not create `notes/*.md` or `LEARNING_PLAN.md` files. Instead:

1. Write each chapter as its own markdown file whose first line is the H1 title.
2. Preview, from `web/` with paths relative to it: `cd ../web && npm run content -- push ../docker/<file>.md --series docker`
3. Apply: run the same command with `--commit` (add `--publish` to publish new chapters).
4. To edit existing chapters: `npm run content -- pull series docker --out tmp`, edit the
   files (keep the `<!-- learn:… -->` markers), then push them as above.

The CLI needs `LEARN_API_URL` and `LEARN_API_TOKEN` in `web/.env.local` (create the token in
Admin → API tokens). See `web/README.md` → "Adding content with Claude Code".
