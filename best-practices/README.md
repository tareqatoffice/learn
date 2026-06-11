# Engineering Best Practices

Team-wide coding standards for our **NestJS** backends and **Next.js** frontends, written so the same rules load automatically into every AI coding tool (Claude Code, Cursor, Copilot, Codex, Gemini).

`CLAUDE.md` is the **single source of truth** in each stack. Every other tool reads the same content through its own native entry point, kept in sync by symlinks — so there is nothing to duplicate or let drift.

---

## What's here

```
best-practices/
├── backend/nest/
│   ├── without-pg/    NestJS + MongoDB (default)
│   │   ├── CLAUDE.md
│   │   ├── .cursor/rules/standards.mdc
│   │   └── docs/      BEST-PRACTICES.md, CICD.md, CONTRIBUTING.md,
│   │                  DECISIONS.md, FAQ.md, CHANGELOG.md
│   └── with-pg/       NestJS + PostgreSQL (TypeORM)
│       ├── CLAUDE.md
│       ├── .cursor/rules/standards.mdc
│       └── docs/      BEST-PRACTICES.md, CICD.md, CONTRIBUTING.md,
│                      DECISIONS.md, FAQ.md, CHANGELOG.md
└── frontend/next/
    ├── without-antd/  Next.js + Tailwind + shadcn/ui (default)
    │   ├── CLAUDE.md
    │   ├── .cursor/rules/standards.mdc
    │   └── docs/      BEST-PRACTICES.md, CICD.md, CONTRIBUTING.md,
    │                  DECISIONS.md, FAQ.md, CHANGELOG.md
    └── with-antd/     Next.js + Ant Design v6 + Tailwind
        ├── CLAUDE.md
        ├── .cursor/rules/standards.mdc
        └── docs/      BEST-PRACTICES.md, CICD.md, CONTRIBUTING.md,
                       DECISIONS.md, FAQ.md, CHANGELOG.md
```

| Doc | What it covers |
|---|---|
| `CLAUDE.md` | Working agreement (definition of done, no-commit-without-approval), canonical commands, a one-line-per-topic Quick Reference, and pinned stack versions. |
| `docs/BEST-PRACTICES.md` | The full standard for that variant — every rule with rationale and a code example. |
| `docs/CICD.md` | Branch strategy, GitHub Actions, Docker, Dependabot, Husky/lint-staged, required `package.json` scripts. |
| `docs/CONTRIBUTING.md` | How to propose/review/merge changes to the standard itself. |
| `docs/DECISIONS.md` | ADRs — *why* each major choice was made, with trade-offs. |
| `docs/FAQ.md` | Common confusion points, answered authoritatively. |
| `docs/CHANGELOG.md` | Dated log of every change to the standard. |

---

## Using it in a project

### 1. Copy the standard for your stack

From the **target project root**, pick the folder that matches your stack exactly:

```bash
# Next.js + Tailwind + shadcn/ui (default)
VARIANT=/path/to/best-practices/frontend/next/without-antd
cp    "$VARIANT/CLAUDE.md"  ./CLAUDE.md
cp -r "$VARIANT/docs"       ./docs

# Next.js + Ant Design v6
VARIANT=/path/to/best-practices/frontend/next/with-antd
cp    "$VARIANT/CLAUDE.md"  ./CLAUDE.md
cp -r "$VARIANT/docs"       ./docs

# NestJS + MongoDB (default)
VARIANT=/path/to/best-practices/backend/nest/without-pg
cp    "$VARIANT/CLAUDE.md"  ./CLAUDE.md
cp -r "$VARIANT/docs"       ./docs

# NestJS + PostgreSQL
VARIANT=/path/to/best-practices/backend/nest/with-pg
cp    "$VARIANT/CLAUDE.md"  ./CLAUDE.md
cp -r "$VARIANT/docs"       ./docs
```

No cleanup needed — each folder contains only what that stack uses.

### 2. Wire up the other AI tools

Run from the **target project root**. This makes Codex, Cursor, Copilot, Gemini, Windsurf, Zed, and Aider all read the same rules from `CLAUDE.md`:

```bash
ln -s CLAUDE.md AGENTS.md                              # Codex · Windsurf · Zed · Aider
ln -s CLAUDE.md GEMINI.md                              # Antigravity / Gemini
mkdir -p .github .cursor/rules
ln -s ../CLAUDE.md .github/copilot-instructions.md     # GitHub Copilot

# Cursor needs a real file (MDC frontmatter), not a symlink — copy the template:
cp "$VARIANT/.cursor/rules/standards.mdc" .cursor/rules/standards.mdc
```

`$VARIANT` is the same path you set in step 1.

> **Windows:** enable symlink support with `git config core.symlinks true`, or replace the symlinks with copies and keep them in sync.

### 3. Verify

```bash
ls -la AGENTS.md GEMINI.md .github/copilot-instructions.md   # each should show "-> CLAUDE.md"
cat .cursor/rules/standards.mdc                              # real file, alwaysApply: true
```

Open the project in any of the supported tools — the standards load automatically. **Edit only `CLAUDE.md`; the symlinks follow.**

---

## Tool wiring at a glance

| Tool | Entry point | How |
|---|---|---|
| Claude Code | `CLAUDE.md` | Canonical file |
| OpenAI Codex | `AGENTS.md` | Symlink → `CLAUDE.md` |
| Cursor | `AGENTS.md` + `.cursor/rules/standards.mdc` | `alwaysApply: true` rule pointing to `CLAUDE.md` |
| Antigravity / Gemini | `GEMINI.md` + `AGENTS.md` | Symlinks → `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Symlink → `CLAUDE.md` |
| Windsurf · Zed · Aider | `AGENTS.md` | Symlink → `CLAUDE.md` |

---

## Changing the standard

Don't edit a project's copy to change the team rule — that only changes one app. To change the standard for everyone, follow `docs/CONTRIBUTING.md` in the relevant stack:

1. Open a discussion first; the rule must be general, not project-specific.
2. Branch off `main` (`docs/<stack>/<topic>`), edit `BEST-PRACTICES.md`, and add a dated `CHANGELOG.md` entry.
3. Open a PR; at least one other developer on that stack reviews and approves.

When a project needs a one-off deviation, document it in **that project's** `CLAUDE.md`, not here.
