# 🤖 Claude Code — The Engineer's Field Guide

> A beautiful, practical reference for **Claude Code** (the CLI), written for software engineers who want to go from "I type prompts" to "I drive an AI pair‑programmer like a power tool."

Claude Code is Anthropic's official command‑line coding agent. It lives in your terminal, reads and edits your repo, runs commands, reviews diffs, and orchestrates background agents — all while you stay in control.

This guide is current as of **Claude Code v2.1.x** (June 2026).

---

## 📚 Table of Contents

| # | Guide | What's inside |
|---|-------|---------------|
| 1 | [**Slash Commands**](./01-slash-commands.md) | Every `/command` — `/clear`, `/review`, `/compact`, `/init`, and the rest, grouped by purpose |
| 2 | [**Keyboard Shortcuts & Input Modes**](./02-keyboard-shortcuts.md) | `!` bash mode, `@` file refs, `Esc`, `Shift+Tab`, vim mode, multiline |
| 3 | [**Core Concepts**](./03-core-concepts.md) | CLAUDE.md memory, subagents, skills, hooks, MCP, permission modes, settings |
| 4 | [**CLI Flags & Headless Mode**](./04-cli-flags.md) | `-p`, `--continue`, `--resume`, `--model`, scripting & automation |
| 5 | [**Best Practices**](./05-best-practices.md) | The workflows that separate beginners from power users |

---

## ⚡ 60‑Second Quick Start

```bash
# Install (one time)
npm install -g @anthropic-ai/claude-code

# Start in your project directory
cd my-project
claude

# Tell Claude what you want, in plain English
> refactor the auth module to use async/await and add tests
```

Inside the session, the four moves you'll use constantly:

| You type… | …and Claude |
|-----------|-------------|
| `your request` | Reads code, plans, edits files, runs commands |
| `@src/app.ts` | Pulls a specific file into context |
| `!npm test` | Runs a shell command and keeps the output |
| `/clear` | Wipes context to start a fresh task |

---

## 🧭 How to Think About Claude Code

If you come from a JS/TS background, here's a useful mental model:

- **The session is a long‑lived process** with a *context window* (like RAM). It fills up with conversation, file contents, and command output. You manage it with `/clear` and `/compact`.
- **`CLAUDE.md` is your `.env` + README for the agent** — persistent instructions that load every session, so you don't repeat yourself.
- **Skills and subagents are like importable modules and worker threads** — reusable capability and isolated parallel work that doesn't pollute your main context.
- **Permission modes are your `sudo` policy** — how much you trust Claude to act without asking.

Start with the [Slash Commands](./01-slash-commands.md) guide, then read [Best Practices](./05-best-practices.md) — those two alone will make you dangerous.

---

## 🔗 Official Docs

- Commands: <https://code.claude.com/docs/en/commands>
- CLI reference: <https://code.claude.com/docs/en/cli-reference>
- Interactive mode: <https://code.claude.com/docs/en/interactive-mode>
- Full docs map: <https://code.claude.com/docs/en/claude_code_docs_map>
