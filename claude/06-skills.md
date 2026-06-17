# 6 · Skills, Artifacts & Other Main Things

> [Core Concepts](./03-core-concepts.md) introduced skills in a paragraph. This is the deep dive: how to **add** one, how they **work** under the hood, how to bundle scripts and references, plus a straight answer on **Artifacts** and a tour of the remaining big features.

---

## 🧩 What a Skill Actually Is

A **Skill** is a folder containing a `SKILL.md` file. That file has YAML frontmatter (metadata) and a markdown body (the instructions). It teaches Claude a repeatable procedure — "how we deploy", "how we write a migration", "how we review a PR" — that it can pull in **on demand**.

The key idea is **progressive disclosure**: Claude doesn't carry the whole skill in context all the time. It only ever sees the one-line description until the skill is actually needed. So you can have a library of 50 skills and pay almost nothing for the 49 you aren't using right now.

> 🧠 **JS/TS mental model:** a skill is a lazily‑imported module. The `description` is the entry in the package index Claude scans; the body is the module that only gets `import()`‑ed when something matches.

---

## 📁 Where Skills Live

| Scope | Path | Available in |
|-------|------|--------------|
| **Personal** | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| **Project** | `.claude/skills/<name>/SKILL.md` | This repo (commit it to share with the team) |
| **Plugin** | `<plugin>/skills/<name>/SKILL.md` | Invoked namespaced as `/plugin-name:skill-name` |
| **Nested** | `packages/web/.claude/skills/<name>/SKILL.md` | Monorepo sub‑packages can ship their own skills |

The **command name comes from the directory name**, not the frontmatter. `.claude/skills/deploy-staging/SKILL.md` → `/deploy-staging`. (The `name:` field is just a display label — except in a plugin's root skill, where it does set the command.)

---

## 🛠️ How to Add a Skill (Step by Step)

There's **no scaffold command** — you create the folder and file by hand.

```bash
# 1. Create the skill folder (project-scoped here)
mkdir -p .claude/skills/changelog

# 2. Write SKILL.md
```

```markdown
---
name: changelog
description: >
  Draft a changelog entry from the staged git diff. Use when the user asks to
  update the changelog, write release notes, or summarise what changed.
allowed-tools: Bash(git diff:*), Read, Edit
---

# Write a Changelog Entry

1. Run `git diff --staged` to see what's changing.
2. Group changes into Added / Changed / Fixed / Removed.
3. Write entries in the user's voice — imperative, one line each.
4. Prepend them under the `## [Unreleased]` heading in `CHANGELOG.md`.
5. Show the diff and stop — do not commit.
```

That's it. Start a session (or it's picked up live) and either let Claude auto‑invoke it, or type `/changelog`.

> ✅ **Verify it loaded:** the skill should appear when you type `/` and start typing its name. If it doesn't, check the folder name matches and the frontmatter YAML is valid.

---

## 📋 SKILL.md Frontmatter — Field Reference

`description` is the one field you should always write — it's how Claude decides to use the skill. Everything else is optional.

### The fields you'll use most

| Field | What it does |
|-------|--------------|
| `description` | When/what the skill is for. Claude reads this to auto‑invoke. **Write this carefully.** |
| `name` | Display label (defaults to the folder name). |
| `allowed-tools` | Tools the skill may use *without* a permission prompt while active (e.g. `Read, Edit, Bash(git status:*)`). |
| `disable-model-invocation` | `true` = manual‑only. Claude won't auto‑load it; only `/name` triggers it. Use for anything with side effects (deploy, send). |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]`. |

### The full optional set

| Field | Purpose |
|-------|---------|
| `when_to_use` | Extra trigger context appended to `description` (trigger phrases, example asks). |
| `arguments` | Named positional args for `$name` / `$0` / `$1` substitution in the body. |
| `user-invocable` | `false` = hide from the `/` menu (background knowledge Claude should have but you won't call directly). |
| `disallowed-tools` | Tools to remove from Claude's pool while the skill is active. |
| `model` | Force a model while the skill runs (same values as `/model`, or `inherit`). |
| `effort` | Reasoning effort while active: `low` / `medium` / `high` / `xhigh` / `max`. |
| `context: fork` | Run the skill in an **isolated subagent context** instead of the main thread. |
| `agent` | Which subagent type to fork into when `context: fork` (e.g. `Explore`, `Plan`). |
| `paths` | Glob(s) that gate auto‑activation — only offer the skill when working on matching files. |
| `hooks` | Hooks scoped to the skill's lifecycle. |
| `shell` | Shell for inline command blocks: `bash` (default) or `powershell`. |

> ⚠️ `description` + `when_to_use` are capped at ~**1,536 characters** in the skill listing. Lead with the use case; don't pad.

---

## 🔬 How Skills Work — The Loading Model

Three tiers, loaded lazily:

```
┌─ Tier 1: METADATA ─────────────────────────────────────┐
│ name + description for every model-invocable skill.    │
│ Always in context. Tiny. This is what Claude scans.    │
└────────────────────────────────────────────────────────┘
          ↓ (task matches a description, or you type /name)
┌─ Tier 2: SKILL.md BODY ────────────────────────────────┐
│ The full instructions load as one message and stay     │
│ in context for the rest of the session.                │
└────────────────────────────────────────────────────────┘
          ↓ (the body references another file / runs a script)
┌─ Tier 3: BUNDLED FILES ────────────────────────────────┐
│ Templates, reference docs, scripts — loaded or executed │
│ only when actually needed. Never sit in context idle.   │
└────────────────────────────────────────────────────────┘
```

- **Auto‑invocation:** Claude matches your request against Tier‑1 descriptions and loads the body itself.
- **Explicit:** `/skill-name` (with `/skill-name arg1 arg2` if it takes arguments).
- **Manual‑only:** set `disable-model-invocation: true` — the description is hidden from Claude, so it can never auto‑fire. Good for `/deploy`‑style actions.
- After a context compaction, invoked skills are restored from a token budget (≈5k per skill, ≈25k combined), favouring the most recently used — so a long session won't silently "forget" the skill you're mid‑way through.

---

## 📦 Bundling Scripts, Templates & References

A skill is a folder, so it can carry more than `SKILL.md`. This is where skills get powerful — you offload detail out of context until it's needed.

```
.claude/skills/api-client/
├── SKILL.md
├── references/
│   └── endpoints.md        # full API surface — loaded only when referenced
├── templates/
│   └── resource.ts.tpl     # boilerplate Claude fills in
└── scripts/
    └── gen-types.sh        # executed; only its OUTPUT enters context
```

How Claude uses each:

| Kind | Behaviour |
|------|-----------|
| **Reference docs** (`references/`, `docs/`) | Loaded into context **only when** `SKILL.md` points Claude to them — `See [endpoints.md](references/endpoints.md)`. |
| **Templates** (`templates/`) | Read when the body tells Claude to use them. |
| **Scripts** (`scripts/`) | **Executed**, not read — the command's *output* replaces the placeholder before Claude sees it. The script source never bloats context. |

The convention is just folders you reference from the body; nothing is enforced. The win: a 2,000‑line API reference costs **zero** context until the one time Claude needs to look something up.

> 🧠 **Mental model:** Tier‑3 files are like code‑split chunks and worker scripts. Reference docs are `import()`‑on‑click; scripts are a child process whose stdout you capture.

---

## ✍️ Writing a Description That Fires at the Right Time

The description is the whole ballgame for auto‑invocation. Be specific and include the phrases a user would actually say.

```yaml
# ❌ Too vague — Claude won't know when to use it
description: Helps with database stuff.

# ✅ Specific + trigger phrases + scope
description: >
  Create and apply a Prisma migration safely. Use when the user wants to add a
  column, change the schema, run "prisma migrate", or asks why a migration failed.
```

Rules of thumb:
- Lead with the **action and the situation**.
- Bake in **trigger phrases** ("review my diff", "what changed", "ship it").
- State scope so it doesn't fire on adjacent tasks.
- For manual‑only skills the description is hidden from Claude — write it for **your** clarity in the `/` menu instead.

---

## 🆚 Skills vs. Custom Commands vs. Subagents

| Use… | When you want… |
|------|----------------|
| **Custom command** (`.claude/commands/x.md`) | A quick prompt template fired by `/x`. No auto‑invocation, no bundled files. |
| **Skill** (`.claude/skills/x/SKILL.md`) | Auto‑invocation by description, bundled scripts/refs, tool scoping, optional forked context. |
| **Subagent** (`/agents`) | A separate Claude with its own clean context to delegate heavy/parallel work — returns a summary. |

A skill can even *combine* with subagents via `context: fork` — run the procedure in an isolated context and get back just the result.

---

## 🎨 Artifacts — Read This So You Don't Get Confused

**Artifacts are NOT a Claude Code (CLI) feature.** They belong to **claude.ai** (web chat + desktop app) and the Claude API.

| | Artifacts (claude.ai / API) | Claude Code (CLI) |
|--|------------------------------|-------------------|
| What it is | A live, browser‑rendered preview pane — code, HTML, React, SVG, diagrams, docs | A terminal agent that edits **real files** on disk |
| Output | A synchronous preview inside the chat UI; shareable as a link | Files in your repo you `git commit` |
| Setup | None | Runs in your project |
| Persistence | Lives in the conversation | Lives in version control |

So in Claude Code there's no "artifact viewer". If you ask it to build an `index.html`, it **writes the file** and you open it yourself. There is currently no built‑in bridge to pull a claude.ai artifact into a Claude Code session.

> 🧠 **One‑liner:** *Artifacts are for previewing in the browser; Claude Code is for shipping to the repo.*

---

## 🧱 Other Main Things (and where they're covered)

The machinery already documented in [Core Concepts](./03-core-concepts.md):

- **CLAUDE.md memory** — persistent per‑project / global instructions.
- **Subagents** — delegated, isolated, parallel work.
- **Hooks** — deterministic shell commands on lifecycle events (format‑on‑edit, etc.).
- **MCP** — connect external systems (GitHub, Linear, your DB) as tools.
- **Permission modes** — how much Claude can do without asking (`Shift+Tab`).
- **Settings hierarchy** — `~/.claude` → project → `.local` → CLI flags.

Worth knowing on top of those:

| Feature | What it is |
|---------|------------|
| **Plugins & Marketplaces** | Installable bundles of skills, commands, hooks, and MCP servers. Add with `/plugin`; configure marketplaces in `.claude/settings.json`. The clean way to share a whole capability set with a team. |
| **Custom subagents** | Define your own agent types (system prompt + allowed tools + model) with `/agents` — e.g. a strict `code-reviewer` or a read‑only `Explore`. |
| **Output styles** | Adjust how Claude communicates/formats responses for a session. |
| **Background tasks & headless mode** | `/background` (or `claude -p …`) to run detached/scripted — for CI, cron, and long jobs. See [CLI Flags](./04-cli-flags.md). |
| **Checkpoints / rewind** | Claude snapshots state so you can roll back an edit‑gone‑wrong instead of fighting git. |

---

## 🧪 Try It — A 5‑Minute Skill

1. `mkdir -p .claude/skills/explain-file`
2. Create `SKILL.md`:

   ```markdown
   ---
   name: explain-file
   description: >
     Explain what a source file does — its purpose, key exports, and gotchas.
     Use when the user asks "what does this file do" or to understand a module.
   allowed-tools: Read
   argument-hint: "[path]"
   ---

   # Explain a File

   1. Read the file at the given path (or the file in focus if none given).
   2. Summarise its purpose in 2–3 sentences.
   3. List its key exports / public surface.
   4. Flag anything surprising: side effects, globals, tight coupling.
   5. Keep it under 200 words.
   ```

3. In a session, run `/explain-file src/index.ts` — or just ask *"what does this file do?"* and watch it auto‑invoke.

---

## 🔗 Official Docs

- Skills: <https://code.claude.com/docs/en/skills>
- Features overview (context & loading): <https://code.claude.com/docs/en/features-overview>
- Plugins: <https://code.claude.com/docs/en/plugins>
- Subagents: <https://code.claude.com/docs/en/sub-agents>
- Settings: <https://code.claude.com/docs/en/settings>
