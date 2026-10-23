# ASP.NET & C# Learning Journey

## Who I am

Experienced frontend developer with Node.js backend experience. Learning ASP.NET and C# from beginner to intermediate level. Familiar with TypeScript, REST APIs, async/await, and general backend concepts — so explanations should use Node.js/Express/TypeScript analogies where helpful.

## Why I am here

To learn ASP.NET Core (Web API), Clean Architecture, and Microservices with PostgreSQL — aiming for production-quality code with best practices: JWT auth, testing, Docker, and deployment.

## Goals

- **Primary:** REST APIs + Microservices
- **Database:** PostgreSQL with EF Core
- **Deep focus:** Clean Architecture, Authentication & JWT, Testing (xUnit + integration), Docker & deployment
- **Pace:** Intensive (10+ hrs/week)


---

## Where the notes live

This track's notes are the chapters of the **C# / .NET** series (slug `dotnet`) in the
Learn app (`../web/`). The old `notes/*.md` and `LEARNING_PLAN.md` files were imported
into the app and removed. Read progress is tracked per user in the app, not here.

Runnable code still lives in `examples/` (real files, not snippets).

### Phases

| Phase | Topic |
|-------|-------|
| 1 | C# Fundamentals |
| 2 | ASP.NET Core Basics |
| 3 | EF Core + PostgreSQL |
| 4 | Clean Architecture |
| 5 | Authentication & JWT |
| 6 | Testing (xUnit + Integration) |
| 7 | Advanced ASP.NET Core |
| 8 | Microservices |
| 9 | Docker & Deployment |

### Adding or editing chapters

Do not create `notes/*.md` or `LEARNING_PLAN.md` files. Instead:

1. Write each chapter as its own markdown file whose first line is the H1 title.
2. Preview, from `web/` with paths relative to it: `cd ../web && npm run content -- push ../.net/<file>.md --series dotnet`
3. Apply: run the same command with `--commit` (add `--publish` to publish new chapters).
4. To edit existing chapters: `npm run content -- pull series dotnet --out tmp`, edit the
   files (keep the `<!-- learn:… -->` markers), then push them as above.

The CLI needs `LEARN_API_URL` and `LEARN_API_TOKEN` in `web/.env.local` (create the token in
Admin → API tokens). See `web/README.md` → "Adding content with Claude Code".
