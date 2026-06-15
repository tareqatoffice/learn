# 5 · Best Practices

> The commands are easy. The *workflow* is what separates someone who occasionally uses Claude from someone whose output doubles. Here's the hard‑won stuff.

---

## 🎯 The Core Loop: Explore → Plan → Code → Verify

Don't jump straight to "write the code." The reliable rhythm is:

1. **Explore** — let Claude read the relevant code first. *"Read the auth module and the user model, then tell me how login works."* No edits yet.
2. **Plan** — `/plan` or *"propose an approach, don't write code yet."* Review it. Course‑correct cheaply, in words.
3. **Code** — approve the plan, switch to **Accept Edits** (`Shift+Tab`), let it work.
4. **Verify** — `/code-review` → `/verify` or run the tests. Never trust "done" without seeing it run.

> The single biggest mistake is skipping step 2. A 30‑second plan review saves you from a 20‑minute wrong implementation.

---

## 🧹 Context Is a Budget — Spend It Wisely

Claude's context window is finite, like RAM. A bloated context makes answers slower, dumber, and pricier.

- **`/clear` between unrelated tasks.** This is the #1 habit. Finished the bug? `/clear` before the next feature.
- **`/compact` mid‑task** when you're deep in something and the window fills up.
- **Use subagents for big reads** — let them digest 30 files and report back a paragraph.
- **Watch `/context`** when things feel off.
- **Don't paste huge files** — reference them with `@path` so Claude reads only what it needs.

---

## 📝 Invest in CLAUDE.md Early

Every correction you make twice belongs in `CLAUDE.md`. It's the difference between re‑explaining your conventions every session and never again.

- Run `/init` on day one, then **prune** the result.
- Capture: package manager, test command, code style, architectural boundaries, "never touch" paths.
- Use the `#` prefix to add rules in the moment.
- Keep it lean — it loads every session, so dead rules cost you.

---

## ✍️ Write Prompts Like Tickets, Not Tweets

Vague in, vague out. Compare:

| ❌ Weak | ✅ Strong |
|---------|----------|
| "fix the bug" | "Users report login fails with a 500 on expired tokens. Reproduce it in `auth.test.ts`, find the cause, fix it, and keep the test." |
| "add caching" | "Add an in‑memory LRU cache (max 1000 entries, 5‑min TTL) to `getUser()` in `src/users.ts`. Invalidate on `updateUser()`." |

Give it: the **goal**, the **constraints**, the **relevant files**, and how you'll know it **worked**.

---

## 🔍 Review Everything — Trust, but Verify

Claude is fast and usually right, which is exactly why you must check it.

- **Read the diff.** Use `/diff` or your editor. Treat it like a colleague's PR.
- **Run the dedicated reviewers:** `/code-review` for bugs, `/security-review` before anything touching auth/input/secrets.
- **Actually run it:** `/verify` or `/run`. "The code looks right" is not "the code works."
- **Lean on git.** Commit at green states so you can always roll back. Use `/rewind` for in‑session undo.

---

## 🎚️ Match the Tool to the Job

- **Model:** `opus` for gnarly debugging and design; `sonnet` for everyday edits; `haiku` for cheap mechanical sweeps. Switch with `/model`.
- **Permission mode:** **Default** in unfamiliar code, **Accept Edits** once you trust the plan, **Plan** for design, never **Bypass** on real repos.
- **Effort:** bump `/effort high` for hard reasoning; keep it low for trivial tasks.

---

## ⚡ Automate the Repetitive

- **Hooks** for "every time" rules — format on save, lint before commit, block protected paths. (See [Core Concepts → Hooks](./03-core-concepts.md#-hooks).)
- **Skills / custom commands** for multi‑step workflows you repeat — deploys, changelog generation, scaffolding.
- **Headless mode** (`claude -p`) in CI for automated review, triage, or doc generation.
- **`/loop`** to poll a long‑running job; **`/background`** to offload work and keep your terminal.

---

## 🤝 Make It a Team Sport

- Commit `.claude/settings.json` with shared **hooks, permissions, and MCP servers** so everyone's Claude behaves the same.
- Commit `CLAUDE.md` so the whole team encodes conventions once.
- Keep personal preferences in `.claude/settings.local.json` (gitignored).
- Share useful **skills** via the repo so the whole team levels up at once.

---

## 🧯 When Things Go Sideways

| Symptom | Move |
|---------|------|
| Claude seems confused / off‑track | `Esc` to interrupt, then redirect. Or `/clear` and restart the task clean |
| Responses got slow or dumb | Check `/context`; `/compact` or `/clear` |
| A weird config/plugin issue | `claude --safe-mode` to rule out customizations; `/doctor` to diagnose |
| A bad edit landed | `/rewind`, or `git checkout` if committed |
| Not sure what it changed | `Ctrl+O` (transcript) or `/diff` |

---

## 🏁 The One‑Paragraph Summary

Work in the **Explore → Plan → Code → Verify** loop. Guard your context with `/clear` and subagents. Encode conventions in `CLAUDE.md` and automation in hooks/skills. Write prompts like tickets. Review every diff and *run* the result. Pick the right model and permission mode for the risk. Do that, and Claude Code stops being a novelty and becomes the most productive teammate you've got.
