# 1 · Slash Commands

> Type `/` at any time to open the command menu. Slash commands trigger built‑in features, skills, and custom workflows. This is the single most important page to skim.

The commands below are grouped by **what you're trying to do**, not alphabetically — because that's how you'll reach for them.

---

## 🗂️ Session & Context — your most‑used commands

| Command | What it does | When to reach for it |
|---------|--------------|----------------------|
| `/clear` | Starts a fresh conversation with **empty context** (the old one is still in `/resume`) | ⭐ Between unrelated tasks — keeps Claude sharp and cheap |
| `/compact [focus]` | Summarizes the conversation to **free up context** while keeping key facts; optional focus hint | When context is filling up mid‑task and you want to continue |
| `/context [all]` | Visualizes what's eating your context window as a colored grid | When responses feel sluggish or you're near the limit |
| `/resume [session]` | Reopen a past session by name/ID, or pick from a list | Coming back to yesterday's work |
| `/rewind` | Roll back the **conversation and/or code** to an earlier point | "That edit was wrong, undo the last few steps" |
| `/rename [name]` | Give the current session a readable name | So `/resume` is findable later |
| `/recap` | One‑line summary of the current session | Quick "where was I?" |

> 💡 **The golden habit:** `/clear` between tasks. A focused context produces better, faster, cheaper answers. Don't let one session sprawl across five unrelated jobs.

---

## 🔍 Code Review & Verification

| Command | What it does |
|---------|--------------|
| `/review [PR]` | Reviews a **pull request** |
| `/code-review [level] [--fix] [--comment]` | Reviews your current **diff** for bugs and cleanups. `--fix` applies the findings; `--comment` posts them as inline PR comments. Levels scale depth (low → max) |
| `/security-review` | Scans pending changes for **security vulnerabilities** (injection, auth, data exposure) |
| `/simplify [target]` | Reviews changed code for **reuse / simplification / efficiency** and applies the cleanups (quality only — no bug hunting) |
| `/verify` | Confirms a change works by **building, running, and observing** real behavior |
| `/run` | Launches and drives the **actual app** to see a change working (not just tests) |

> 🧪 **Reviewer's combo:** finish a feature → `/code-review high` → `/security-review` → `/verify`. You catch bugs, security holes, and "does it actually run" in three commands.

---

## 🚀 Project Setup & Memory

| Command | What it does |
|---------|--------------|
| `/init` | Scans the repo and generates a starter **`CLAUDE.md`** describing the project |
| `/memory` | Edit `CLAUDE.md` files, toggle auto‑memory, view what Claude has remembered |
| `/add-dir <path>` | Add another working directory to the session's file access |

---

## 🧠 Planning & Large‑Scale Work

| Command | What it does |
|---------|--------------|
| `/plan [description]` | Enter **plan mode** — Claude explores and proposes a plan *before* touching code |
| `/goal [condition]` | Set a goal; Claude keeps working until the condition is met |
| `/batch <instruction>` | Orchestrate large changes across **many subagents** in isolated git worktrees |
| `/deep-research <question>` | Fan out web searches, fetch sources, cross‑check, and return a **cited report** |
| `/loop [interval] [prompt]` | Run a prompt/command repeatedly (e.g. poll CI); omit interval to self‑pace |
| `/schedule [description]` | Create recurring cloud agents that run on a cron schedule |

> 🗺️ **Plan mode is underrated.** For anything non‑trivial, `/plan` first. You review the approach before any file changes — far cheaper than letting Claude charge ahead and redo it.

---

## ⚙️ Model, Effort & Config

| Command | What it does |
|---------|--------------|
| `/model [name]` | Switch model — `opus`, `sonnet`, `haiku`, `fable`, or a full ID |
| `/effort [level]` | Set reasoning effort: `low`, `medium`, `high`, `xhigh`, `max` |
| `/config` | Open the **Settings** UI (theme, model, editor mode, preferences) |
| `/fast` / `/slow` | Toggle fast mode (faster Opus output) on/off |
| `/theme [color]` | Set the prompt‑bar color |

---

## 🔌 Tools & Extensions

| Command | What it does |
|---------|--------------|
| `/mcp` | Manage **MCP server** connections and OAuth auth |
| `/agents` | Manage subagent configurations |
| `/skills` | List available **skills**; hide ones you don't want auto‑invoked |
| `/hooks` | View configured **hooks** (tool‑event automation) |
| `/permissions` | Manage allow / ask / deny rules; review recent denials |
| `/plugin [list\|install\|enable\|disable]` | Manage plugins |
| `/keybindings` | Open the keyboard‑shortcuts file for customization |

---

## 🛠️ Diagnostics & Utilities

| Command | What it does |
|---------|--------------|
| `/diff` | Open an interactive **diff viewer** of uncommitted changes |
| `/copy [N]` | Copy the last (or Nth‑latest) assistant response to clipboard |
| `/export [file]` | Export the conversation as plain text |
| `/usage` (aka `/cost`, `/stats`) | Show session cost, plan limits, and activity |
| `/doctor` | Diagnose your install/settings (press `f` to auto‑fix) |
| `/status` | Version, model, account, connectivity |
| `/debug [desc]` | Enable debug logging, optionally focused on an issue |
| `/feedback` | Report a bug or share a conversation with Anthropic |
| `/help` | Show help and the command list |
| `/release-notes` | Browse the changelog |

---

## 🌐 Account, IDE & Background

| Command | What it does |
|---------|--------------|
| `/login` · `/logout` | Sign in / out of your Anthropic account |
| `/ide` | Manage IDE integrations |
| `/terminal-setup` | Configure `Shift+Enter` for newlines in VS Code, Cursor, etc. |
| `/install-github-app` | Set up Claude GitHub Actions for a repo |
| `/background [prompt]` | Detach the session to run as a **background agent**, freeing your terminal |
| `/tasks` | View and manage everything running in the background |

---

## 🧩 Custom Slash Commands

You aren't limited to the built‑ins. Drop a markdown file in `.claude/commands/` (project) or `~/.claude/commands/` (global) and it becomes a slash command:

```markdown
<!-- .claude/commands/changelog.md -->
---
description: Summarize commits since the last tag into a changelog
---
Look at `git log $(git describe --tags --abbrev=0)..HEAD`,
then write a clean CHANGELOG entry grouped by feat/fix/chore.
```

Invoke it with `/changelog`. Arguments after the command are available as `$ARGUMENTS`. These are the spiritual cousins of npm scripts — codify the workflows you repeat.

> 👉 Custom commands and **Skills** overlap; for richer, auto‑invokable capability (with their own context budget), see [Core Concepts → Skills](./03-core-concepts.md#-skills--custom-commands).
