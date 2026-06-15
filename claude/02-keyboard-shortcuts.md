# 2 · Keyboard Shortcuts & Input Modes

> The terminal is your cockpit. Learn these and you stop fighting the UI and start flying.

---

## ✨ The Four Input Prefixes (learn these first)

A single character at the **start of your input** changes its meaning:

| Prefix | Mode | Example | What happens |
|:------:|------|---------|--------------|
| `/` | **Command** | `/clear` | Run a slash command or skill |
| `!` | **Shell** | `!npm test` | Run a shell command directly; its output is added to the session so Claude sees it |
| `@` | **File mention** | `@src/auth.ts` | Autocomplete a path and pull that file into context |
| `#` | **Memory** | `# always use pnpm` | Save a note to `CLAUDE.md` for future sessions |

> 💡 `!` is gold for the "let me just check something" moments — run the command yourself, and Claude automatically gains the output without you copy‑pasting. `#` is the fastest way to teach Claude a lasting rule.

---

## 🎛️ Essential Controls

| Shortcut | Action |
|----------|--------|
| `Esc` | **Interrupt** Claude mid‑response (keeps the work done so far) |
| `Esc` `Esc` | Clear the input draft, or open the **rewind** menu if input is empty |
| `Shift+Tab` | **Cycle permission modes**: default → accept‑edits → plan → (bypass, if enabled) |
| `Ctrl+C` | Clear the current input; press again to **exit** |
| `Ctrl+D` | Exit Claude Code (EOF) |
| `Ctrl+L` | Redraw the screen (fixes garbled output) |
| `Ctrl+O` | Toggle the **transcript viewer** (detailed tool calls & execution) |
| `Ctrl+R` | Reverse‑search command history |
| `Ctrl+V` | Paste an image from the clipboard (becomes an `[Image #N]` chip) |
| `Ctrl+T` | Toggle the background task list |

> ⚙️ `Shift+Tab` is the one to internalize. It's how you flip between "ask me before every edit" and "go ahead and edit, ask before risky stuff," and into **plan mode** without typing a command.

---

## ⌨️ Model & Mode Toggles (no typing required)

| Mac | Windows / Linux | Action |
|-----|-----------------|--------|
| `Option+P` | `Alt+P` | Switch model without clearing your prompt |
| `Option+T` | `Alt+T` | Toggle extended thinking |
| `Option+O` | `Alt+O` | Toggle fast mode |

---

## 📝 Multiline Input

Writing a longer prompt or pasting a stack trace?

| Method | How | Works in |
|--------|-----|----------|
| Backslash | `\` then `Enter` | **All** terminals (universal fallback) |
| Shift+Enter | `Shift+Enter` | iTerm2, WezTerm, Ghostty, Kitty, Warp, Windows Terminal (run `/terminal-setup` for VS Code/Cursor) |
| Control‑J | `Ctrl+J` | Any terminal |
| Option+Enter | `Option+Enter` | macOS (Option as Meta) |

---

## 🧹 Text Editing (readline shortcuts)

These work like in bash/zsh:

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` / `Ctrl+E` | Jump to start / end of line |
| `Ctrl+K` | Delete to end of line |
| `Ctrl+U` | Delete to start of line |
| `Ctrl+W` | Delete previous word |
| `Ctrl+Y` | Paste the last deleted text |
| `Alt+B` / `Alt+F` | Move back / forward one word |

---

## 🅥 Vim Mode

Prefer modal editing? Enable it via `/config` → **Editor mode**. You then get a real NORMAL/INSERT/VISUAL split in the prompt:

- **Switch modes:** `Esc` → NORMAL · `i a o O` → INSERT · `v V` → VISUAL
- **Move:** `h j k l`, `w e b`, `0 ^ $`, `gg G`, `f{char}`
- **Edit:** `x dd D`, `dw cw`, `yy p P`, `u`, `.` (repeat)
- **Text objects:** `iw aw`, `i" a"`, `i( a(`, `i{ a{`

---

## 🔭 Transcript Viewer (`Ctrl+O`)

Opens a detailed view of every tool call Claude made — great for understanding *what it actually did*. In fullscreen rendering:

| Key | Action |
|-----|--------|
| `?` | Show the help panel |
| `{` / `}` | Jump to previous / next user prompt |
| `[` | Write the conversation to native scrollback (enables search) |
| `v` | Open the conversation in `$EDITOR` |
| `q` / `Esc` | Exit the viewer |
