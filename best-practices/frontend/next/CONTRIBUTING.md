# Contributing to Frontend Best Practices

This guide explains how to propose, review, and merge changes to the frontend best practices documentation.

---

## When to update the best practices

- A new pattern has proven itself in production and the team agrees it should be standard
- An existing pattern has been found to be incorrect, outdated, or harmful
- A major dependency version introduces breaking changes or new recommended APIs
- A code review surfaces a recurring mistake that a documented rule would prevent

Do not update the best practices for one-off or project-specific decisions. These docs are team-wide standards.

---

## How to propose a change

1. **Open a discussion first** — raise the proposed change in a team meeting or async channel before writing.
2. **Branch off `main`** — name the branch `docs/frontend/<topic>`.
3. **Edit `best-practices.md`** — keep changes focused; one topic per PR.
4. **Update `docs/CHANGELOG.md`** — add an entry at the top with today's date, type, and a clear description.
5. **Open a PR** — at least one other frontend developer must review and approve.

---

## Writing style

- Imperative mood: "Use `next/image`", not "You should use `next/image`".
- Lead with the rule, follow with the reason or a code example.
- Code examples must compile under `strict: true`. No `any`.
- Keep examples minimal — show only what illustrates the rule.
- No comments that explain what the code does. Only comments that clarify a non-obvious constraint (e.g., `// Must be placed in root layout`).

---

## Versioning policy

| Trigger | Action |
|---|---|
| Next.js major version bump | Review full `best-practices.md` against the migration guide. Update version references in `CLAUDE.md`. |
| React Query major version bump | Review the React Query section. v4 → v5 renamed `cacheTime`, removed `isLoading` — this level of change requires a full section review. |
| Ant Design major version bump | Review Ant Design section. Test `ConfigProvider` theme token API for breaking changes. |
| Security advisory | Update immediately, skip normal PR cycle, notify the team. |

---

## Checklist before merging

- [ ] Rule is general enough to apply across projects, not just one app
- [ ] Code example included for non-trivial rules
- [ ] `docs/CHANGELOG.md` updated with today's date
- [ ] At least one reviewer approved
- [ ] No existing examples broken by the change
