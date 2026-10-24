# JavaScript & Node.js Learning Journey

## Who I am

Experienced frontend developer with TypeScript fluency and Node.js backend experience. Not learning JS from scratch — deepening expertise into production-grade patterns: internals, enterprise architecture, microservices, and performance.

## Why I am here

To go from "can build things" to "understands why things work", production-level Node.js patterns, Clean Architecture in the JS ecosystem, and microservices — mirroring the depth being built in the `.net/` track.

## Goals

- **Primary:** Production-grade Node.js backend + Microservices
- **Database:** PostgreSQL with Prisma / DrizzleORM
- **Deep focus:** JS engine internals, Advanced TypeScript, Clean Architecture (NestJS), Testing (Jest + Testcontainers), Docker & deployment
- **Pace:** Intensive (10+ hrs/week)


---

## Where the notes live

This track's notes are the chapters of the **JavaScript & Node (backend)** series (slug `javascript`) in the
Learn app (`../web/`). The old `notes/*.md` and `LEARNING_PLAN.md` files were imported
into the app and removed. Read progress is tracked per user in the app, not here.

### Phases

| Phase | Topic |
|-------|-------|
| 1 | JavaScript Internals & Runtime |
| 2 | Advanced TypeScript |
| 3 | Node.js Production Patterns |
| 4 | PostgreSQL with Prisma & DrizzleORM |
| 5 | Clean Architecture with NestJS |
| 6 | Authentication & Security |
| 7 | Testing (Jest + Integration + Testcontainers) |
| 8 | Microservices |
| 9 | Docker & Deployment |

### Adding or editing chapters

Do not create `notes/*.md` or `LEARNING_PLAN.md` files. Instead:

1. Write each chapter as its own markdown file whose first line is the H1 title.
2. Preview, from `web/` with paths relative to it: `cd ../web && npm run content -- push ../javascript/<file>.md --series javascript`
3. Apply: run the same command with `--commit` (add `--publish` to publish new chapters).
4. To edit existing chapters: `npm run content -- pull series javascript --out tmp`, edit the
   files (keep the `<!-- learn:… -->` markers), then push them as above.

The CLI needs `LEARN_API_URL` and `LEARN_API_TOKEN` in `web/.env.local` (create the token in
Admin → API tokens). See `web/README.md` → "Adding content with Claude Code".
