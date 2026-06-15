# 3 · Core Concepts

> Slash commands are the *what*. These concepts are the *how* — the machinery that makes Claude Code feel less like a chatbot and more like an engineer on your team.

---

## 📄 CLAUDE.md — Persistent Memory

Think of `CLAUDE.md` as a **README written for the AI**. It's loaded automatically at the start of every session, so anything in it becomes standing instruction without you repeating yourself.

**Where it lives (most → least specific):**

| Location | Scope |
|----------|-------|
| `./CLAUDE.md` (and subdirectories) | This project / module |
| `~/.claude/CLAUDE.md` | All your projects |

**What belongs in it:**

```markdown
# Project: Payments API

## Conventions
- TypeScript strict mode; no `any`.
- Use `pnpm`, never `npm` or `yarn`.
- Tests live next to source as `*.test.ts` and run with `vitest`.

## Architecture
- `src/domain` is pure logic — no I/O, no framework imports.
- All HTTP handlers validate input with Zod before touching the domain.

## Don't
- Don't edit generated files in `src/generated/`.
- Don't commit without running `pnpm lint && pnpm test`.
```

> 🛠️ Generate a first draft with **`/init`**, then prune it. Add rules on the fly with the `#` prefix (`# we deploy from main only`). Keep it tight — it costs context on every session, so curate ruthlessly.

**Auto‑memory** is a related feature: Claude can record durable facts it learns (your preferences, project quirks) so they persist across sessions. Manage it with `/memory`.

---

## 🧑‍🚀 Subagents

A **subagent** is a fresh Claude instance with its own clean context that you delegate a task to. It does the work, then returns just a **summary** — so the heavy reading/searching never bloats *your* conversation.

Why this matters:

- **Parallelism** — fan out independent tasks (search 5 modules at once).
- **Context hygiene** — a subagent can read 40 files; you only get its conclusion.
- **Specialization** — some are tuned for exploration, planning, or review.

**Ways to use them:**

| Method | Use |
|--------|-----|
| Claude delegates automatically | For big searches and multi‑step research |
| `/agents` | Create/manage custom agent definitions |
| `/fork <directive>` | Spawn a forked agent that inherits your conversation and works in parallel |
| `/background` | Detach the whole session to run headless |

> 🧠 **Mental model:** subagents are worker threads. Use them when answering would mean reading across many files and you only need the verdict, not the file dump.

---

## 🧩 Skills & Custom Commands

**Skills** are reusable, model‑invokable capabilities defined in markdown. They load **on demand**, so you can have a big library of them and only pay context cost for the one being used.

**Structure:**

```
.claude/skills/deploy/SKILL.md      # project skill
~/.claude/skills/deploy/SKILL.md    # global skill
```

```markdown
---
name: deploy
description: Build, tag, and push a release. Use when the user wants to ship.
---
1. Run the test suite; abort if anything fails.
2. Bump the version per semver based on commit messages.
3. Tag and push; open the release notes for review.
```

- Claude can **auto‑invoke** a skill when the `description` matches the task (set `disable-model-invocation: true` to make it manual‑only).
- You can always invoke explicitly with `/deploy`.

**Custom commands** (`.claude/commands/*.md`) are the simpler cousin — a prompt template triggered by `/name`. Use skills when you want auto‑invocation and richer behavior; use commands for quick prompt shortcuts.

---

## 🪝 Hooks

**Hooks** run *your* shell commands automatically on lifecycle events — they're executed by the harness, not decided by Claude, so they're deterministic and run even in headless mode.

Configured in `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "prettier --write \"$CLAUDE_FILE_PATHS\"" }
        ]
      }
    ]
  }
}
```

Common uses: **format on edit**, run tests after a bash command, block edits to protected paths, notify Slack on session end, set up the environment on session start.

> ⚙️ Rule of thumb: if you ever want "*every time* X happens, do Y" — that's a hook, not a request to Claude. View them with `/hooks`.

---

## 🔗 MCP — Model Context Protocol

**MCP** is an open standard that connects Claude Code to external systems — databases, issue trackers, design tools, internal APIs — as first‑class tools.

Configured via `.claude/mcp.json` or `~/.claude/mcp.json`:

```jsonc
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "..." }
    }
  }
}
```

- Manage connections and OAuth with **`/mcp`**.
- Tool schemas are **deferred** — loaded on demand — so a big server doesn't bloat context.
- Servers can also expose prompts, surfaced as `/mcp__<server>__<prompt>`.

Examples already common: Linear, Asana, Atlassian/Jira, Notion, Figma, HubSpot, Sentry, and your own internal servers.

---

## 🔐 Permission Modes

How much Claude can do without asking. Cycle live with **`Shift+Tab`**.

| Mode | Behavior | Use when |
|------|----------|----------|
| **Default** | Asks before edits & shell commands | Normal work, unfamiliar code |
| **Accept Edits** | Auto‑accepts file edits & safe FS commands; still asks for risky ones | You trust the plan and want flow |
| **Plan** | Explores & proposes — **won't edit source** | Designing an approach before committing |
| **Auto** | Evaluates every action with background safety checks | Hands‑off runs you still want guarded |
| **Bypass Permissions** | Asks for nothing ⚠️ | Throwaway sandboxes only — never on anything you can't afford to lose |

Fine‑grained rules (allow/ask/deny specific tools or command patterns) live in settings and are managed with **`/permissions`**.

> ⚠️ **Bypass mode is a loaded gun.** It will happily `rm -rf` if a plan goes wrong. Reserve it for disposable containers, never your real repo.

---

## ⚙️ Settings Hierarchy

Settings are JSON, merged from least to most specific (**later wins**):

| File | Scope | Commit it? |
|------|-------|------------|
| `~/.claude/settings.json` | All your projects | n/a (personal) |
| `.claude/settings.json` | This project, **shared with the team** | ✅ yes |
| `.claude/settings.local.json` | This project, **just you** | ❌ gitignored |
| CLI flags (`--settings`, `--model`, …) | This invocation | n/a |

Common keys: `model`, `permissions`, `hooks`, `env`, `defaultMode`, `theme`. Open the interactive editor with **`/config`**.

> 🤝 **Team tip:** commit `.claude/settings.json` with shared hooks, permissions, and conventions so every teammate's Claude behaves consistently. Keep personal tweaks in `settings.local.json`.
