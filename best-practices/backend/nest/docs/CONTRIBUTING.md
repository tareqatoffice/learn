# Contributing to Backend Best Practices

This guide explains how to propose, review, and merge changes to the backend best practices documentation.

---

## When to update the best practices

- A new pattern has proven itself in production and the team agrees it should be standard
- An existing pattern has been found to be incorrect, outdated, or harmful
- A major dependency version introduces breaking changes or new recommended APIs
- A security advisory affects a documented pattern
- A code review surfaces a recurring mistake that a documented rule would prevent

Do not update the best practices for one-off or project-specific decisions. These docs are team-wide standards.

---

## How to propose a change

1. **Open a discussion first** — raise the proposed change in a team meeting or async channel before writing.
2. **Branch off `main`** — name the branch `docs/backend/<topic>`.
3. **Edit the correct file**:
   - MongoDB projects → `BEST-PRACTICES.md`
   - PostgreSQL-specific changes → `BEST-PRACTICES-POSTGRESQL.md`
4. **Update `docs/CHANGELOG.md`** — add an entry at the top with today's date, type, and a clear description.
5. **Open a PR** — at least one other backend developer must review and approve.

---

## Writing style

- Imperative mood: "Throw `NotFoundException`", not "You should throw `NotFoundException`".
- Lead with the rule, follow with the reason or a code example.
- Code examples must be accurate, runnable TypeScript with `strict: true`. No `any`.
- Keep examples minimal — use `// ...` to omit irrelevant boilerplate.
- No comments that explain what the code does. Only comments for non-obvious constraints (e.g., `// helmet must come first`).

---

## Agent configuration (multi-tool)

`CLAUDE.md` is the **single source of truth** for agent instructions. Every other AI tool reads the same content through its own native entry point — kept in sync by symlinks (plus one small pointer file for Cursor), so there is nothing to duplicate or let drift.

| Tool | Entry point | How |
|---|---|---|
| Claude Code | `CLAUDE.md` | Canonical file |
| OpenAI Codex | `AGENTS.md` | Symlink → `CLAUDE.md` |
| Cursor | `AGENTS.md` + `.cursor/rules/standards.mdc` | `alwaysApply: true` rule pointing to `CLAUDE.md` |
| Google Antigravity / Gemini | `GEMINI.md` + `AGENTS.md` | Symlinks → `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Symlink → `CLAUDE.md` |
| Windsurf · Zed · Aider | `AGENTS.md` | Symlink → `CLAUDE.md` |

Recreate the wiring in a new project from the repo root:

```bash
ln -s CLAUDE.md AGENTS.md
ln -s CLAUDE.md GEMINI.md
mkdir -p .github .cursor/rules
ln -s ../CLAUDE.md .github/copilot-instructions.md
# .cursor/rules/standards.mdc is a real file (needs MDC frontmatter) — copy it from this template
```

Edit only `CLAUDE.md`; the symlinks follow automatically. On Windows, enable symlink support (`git config core.symlinks true`) or replace the symlinks with copies and keep them in sync during review.

---

## Versioning policy

| Trigger | Action |
|---|---|
| NestJS major version bump | Review full `BEST-PRACTICES.md` against the migration guide. Check DI, decorator, and module API changes. Update all version references in `CLAUDE.md`. |
| `@nestjs/mongoose` / `mongoose` major bump | Review the Database section. Schema, model, and query APIs change between Mongoose major versions. |
| `@nestjs/typeorm` / `typeorm` major bump | Review `BEST-PRACTICES-POSTGRESQL.md`. Entity, migration, and repository APIs can change. |
| `@nestjs/cache-manager` major bump | Review the Cache section. The store adapter API broke completely between v2 and v3 (Keyv migration). |
| Security advisory on `bcrypt`, `jsonwebtoken`, `helmet` | Update immediately, skip normal PR cycle, notify the team. |

---

## Checklist before merging

- [ ] Rule is general enough to apply across projects, not just one app
- [ ] Code example included for non-trivial rules, using `strict: true` TypeScript — no `any`
- [ ] `docs/CHANGELOG.md` updated with today's date
- [ ] At least one reviewer approved
- [ ] No existing examples broken by the change
