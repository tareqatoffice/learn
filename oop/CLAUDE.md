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

## Progress Tracker

| Phase | Topic | Status | Notes File |
|-------|-------|--------|------------|
| 1 | OOP Foundations & Mental Model | Not started | `notes/01-foundations.md` |
| 2 | Classes, Objects & Members | Not started | `notes/02-classes-objects.md` |
| 3 | Encapsulation | Not started | `notes/03-encapsulation.md` |
| 4 | Inheritance | Not started | `notes/04-inheritance.md` |
| 5 | Polymorphism | Not started | `notes/05-polymorphism.md` |
| 6 | Abstraction (Interfaces & Abstract Classes) | Not started | `notes/06-abstraction.md` |
| 7 | SOLID Principles | Not started | `notes/07-solid.md` |
| 8 | Design Patterns | Not started | `notes/08-design-patterns.md` |
| 9 | Composition, Anti-Patterns & Real-World OOP | Not started | `notes/09-composition-realworld.md` |

---

## Currently Learning

_Nothing started yet._

## Completed Topics

_Nothing completed yet._

## Next Steps

1. Start Phase 1: OOP Foundations (`LEARNING_PLAN.md` → Phase 1)
2. Internalise the mental model and the four pillars at a high level
3. Create `notes/01-foundations.md` as you progress

---

## Project Structure (will grow over time)

```
oop/
├── CLAUDE.md               ← this file (always-on context)
├── LEARNING_PLAN.md        ← full roadmap with all topics
├── notes/                  ← per-phase notes with TS + C# examples
│   ├── 01-foundations.md
│   ├── 02-classes-objects.md
│   └── ...
└── examples/               ← runnable example code per phase
    ├── phase2-classes/
    ├── phase7-solid/
    ├── phase8-patterns/
    └── ...
```

---

## Key Conventions for This Learning Journey

- Concept-first: explain the *idea*, then show it in **TypeScript and C#** side by side
- Call out where the two languages diverge (structural vs nominal typing, `#private` vs `private`, default interface methods, etc.)
- Every notes file has a "Gotchas" section and a hands-on exercise
- Cross-reference the `.net/` and `javascript/` tracks where OOP shows up in real frameworks (NestJS DI, EF Core entities, Clean Architecture domain models)
- Be honest about OOP's limits — composition, functional style, and "when not to use OOP" are first-class topics, not afterthoughts
