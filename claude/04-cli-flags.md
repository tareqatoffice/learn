# 4 · CLI Flags & Headless Mode

> Claude Code isn't only an interactive REPL — it's a Unix citizen you can pipe into, script around, and wire into CI. This is where it becomes *automation*.

---

## 🎬 Starting Sessions

```bash
claude                            # interactive session in the current dir
claude "explain this repo"        # interactive, with an opening prompt
claude -c                         # continue the most recent session here
claude -r "auth-refactor"         # resume a specific session by name/ID
```

| Flag | Purpose |
|------|---------|
| `-c`, `--continue` | Resume the most recent conversation in this directory |
| `-r`, `--resume <id>` | Resume a specific session |
| `--fork-session` | Resume but branch into a **new** session ID (keeps the original intact) |
| `-n <name>` | Name the session for easy `--resume` later |
| `--add-dir <paths>` | Grant access to extra directories |
| `-w [name]` | Start inside an isolated **git worktree** |

---

## 🤖 Headless / Print Mode — the automation workhorse

`-p` / `--print` runs a query and exits. This is how you put Claude in scripts, pre‑commit hooks, and CI.

```bash
# One-shot question
claude -p "what does the retry logic in src/queue.ts do?"

# Pipe content in
cat error.log | claude -p "summarize the root cause"

# Machine-readable output
claude -p "list every TODO in src/" --output-format json

# Enforce a response shape
claude -p "extract the version" --json-schema '{"type":"object","properties":{"version":{"type":"string"}},"required":["version"]}'
```

| Flag | Purpose |
|------|---------|
| `-p`, `--print` | Non‑interactive: answer and exit |
| `--output-format <text\|json\|stream-json>` | Structure the output for parsing |
| `--input-format <text\|stream-json>` | Structure the input |
| `--json-schema '<schema>'` | Force the final output to match a JSON Schema |
| `--verbose` | Full turn‑by‑turn logging |
| `--max-turns <n>` | Cap agentic turns (safety for unattended runs) |
| `--max-budget-usd <amount>` | Stop after spending this much |

> 🧰 **CI recipe:** in a GitHub Action, run `claude -p "review the diff for security issues" --max-turns 15 --output-format json` and fail the job on findings. Pair with `--permission-mode plan` or a tight allowlist so it can't mutate anything.

---

## 🧠 Model, Effort & Reliability

```bash
claude --model opus               # use Opus
claude --model sonnet             # use Sonnet (cheaper/faster)
claude --effort high              # crank reasoning effort
claude --fallback-model sonnet    # auto-fall back if the primary is overloaded
```

| Flag | Purpose |
|------|---------|
| `--model <name>` | `opus`, `sonnet`, `haiku`, `fable`, or a full ID |
| `--effort <level>` | `low` → `max` |
| `--fallback-model <list>` | Comma‑separated fallbacks for overload |

> 💡 **Cost instinct:** reach for `opus` on hard architecture/debugging, `sonnet` for everyday edits and bulk work, `haiku` for cheap mechanical passes. Switch mid‑session with `/model` — no restart needed.

---

## 🔐 Permissions & Safety Flags

| Flag | Purpose |
|------|---------|
| `--permission-mode <mode>` | Start in `default`, `acceptEdits`, `plan`, `auto`, or `bypassPermissions` |
| `--dangerously-skip-permissions` | Skip **all** prompts ⚠️ (sandboxes only) |
| `--allow-dangerously-skip-permissions` | Add bypass to the `Shift+Tab` cycle without *starting* in it |
| `--permission-prompt-tool <tool>` | Delegate prompt handling to an MCP tool (for headless runs) |

---

## 🧵 System Prompt & Context

| Flag | Purpose |
|------|---------|
| `--append-system-prompt "<text>"` | Add to the default system prompt |
| `--system-prompt "<text>"` | **Replace** the whole system prompt (advanced) |
| `--system-prompt-file <path>` | Load a system prompt from a file |

```bash
claude -p "convert these to async" --append-system-prompt "Prefer top-level await; target Node 20."
```

---

## 🧩 Extensions & Config

| Flag | Purpose |
|------|---------|
| `--mcp-config <files>` | Load MCP servers from JSON files/strings |
| `--strict-mcp-config` | Use *only* the MCP config passed in |
| `--settings <path\|json>` | Point at a settings file or inline JSON |
| `--setting-sources <list>` | Which sources to load: `user,project,local` |
| `--agents '<json>'` | Define subagents inline |

---

## 🐢 Troubleshooting & Diagnostics

| Flag | Purpose |
|------|---------|
| `--safe-mode` | Disable **all** customizations (CLAUDE.md, skills, plugins, hooks, MCP, themes) to isolate a problem |
| `--bare` | Minimal/fast mode: skip the heavy discovery steps |
| `--debug [categories]` | Debug logging, optionally filtered (e.g. `"api,mcp"`) |
| `-v`, `--version` | Print the version |

```bash
# "Something is misbehaving" — start clean
claude --safe-mode

# "Is it the API or my MCP server?" — targeted logs
claude --debug "api,mcp" -p "test"
```

---

## 🌥️ Background & Cloud

| Flag | Purpose |
|------|---------|
| `--bg [prompt]` | Launch a **background agent** and return immediately (prints a session ID) |
| `--remote "<task>"` | Create a web session on claude.ai |
| `--teleport` | Pull a web session into your local terminal |

```bash
claude --bg "investigate the flaky test in payments.test.ts"
# ... keep working; check on it later with /tasks
```
