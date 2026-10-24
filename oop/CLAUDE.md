# Object-Oriented Programming Learning Journey

## Who I am

Experienced frontend developer with TypeScript fluency and Node.js backend experience, also learning ASP.NET Core & C# (see `../.net/`). I've *used* classes and objects for years but never studied OOP as a discipline — the four pillars, SOLID, and design patterns from first principles.

## Why I am here

OOP is the conceptual backbone under both the C#/.NET track and a lot of TypeScript code (NestJS, domain models, Clean Architecture). This module teaches OOP **concept-first**, with every idea shown in **both TypeScript and C#** so it reinforces both of my active tracks at once.

## Goals

- **Primary:** Master OOP as a discipline — the four pillars, not just the syntax
- **Deep focus:** SOLID principles, the GoF design patterns that actually matter, composition over inheritance
- **Cross-language:** See each concept in TypeScript AND C# — understand where they agree (and where structural vs nominal typing makes them differ)
- **Practical:** Know when OOP helps and when it hurts; blend it with functional style
- **Pace:** Intensive, alongside the .net/ and javascript/ tracks


---

## Where the notes live

This track's notes are the chapters of the **OOP** series (slug `oop`) in the
Learn app (`../web/`). The old `notes/*.md` and `LEARNING_PLAN.md` files were imported
into the app and removed. Read progress is tracked per user in the app, not here.

### Phases

| Phase | Topic |
|-------|-------|
| 1 | OOP Foundations & Mental Model |
| 2 | Classes, Objects & Members |
| 3 | Encapsulation |
| 4 | Inheritance |
| 5 | Polymorphism |
| 6 | Abstraction (Interfaces & Abstract Classes) |
| 7 | SOLID Principles |
| 8 | Design Patterns |
| 9 | Composition, Anti-Patterns & Real-World OOP |

### Adding or editing chapters

Do not create `notes/*.md` or `LEARNING_PLAN.md` files. Instead:

1. Write each chapter as its own markdown file whose first line is the H1 title.
2. Preview, from `web/` with paths relative to it: `cd ../web && npm run content -- push ../oop/<file>.md --series oop`
3. Apply: run the same command with `--commit` (add `--publish` to publish new chapters).
4. To edit existing chapters: `npm run content -- pull series oop --out tmp`, edit the
   files (keep the `<!-- learn:… -->` markers), then push them as above.

The CLI needs `LEARN_API_URL` and `LEARN_API_TOKEN` in `web/.env.local` (create the token in
Admin → API tokens). See `web/README.md` → "Adding content with Claude Code".
