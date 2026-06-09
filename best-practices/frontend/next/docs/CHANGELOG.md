# Changelog — Frontend Best Practices

All notable changes to the frontend best-practices documentation are recorded here. Newest entries at the top.

Entry format: `type — description`, where `type` is one of `added`, `changed`, `removed`, `fixed`. Group entries under a dated heading.

---

## 2026-06-09

- added — Agent-facing sections to `CLAUDE.md`: `Working Agreement` (definition of done, no-commit-without-approval) and `Commands` (canonical scripts incl. single-test invocation).
- added — Multi-tool agent wiring so Claude Code, Codex, Cursor, Antigravity/Gemini, and Copilot all auto-load the same rules from a single source (`CLAUDE.md`): `AGENTS.md` + `GEMINI.md` + `.github/copilot-instructions.md` symlinks, plus a Cursor `.cursor/rules/standards.mdc` always-on rule. Documented in `CONTRIBUTING.md`.
- added — "Generated API Types" section: generate `types/api.gen.ts` from the backend OpenAPI spec with `openapi-typescript` (`gen:api` script) instead of hand-writing payload types. Added `Paginated<T>` mirroring the backend envelope.
- added — "Accessibility" section (`eslint-plugin-jsx-a11y`, semantic HTML, labels, keyboard/focus, contrast).
- added — "Security Headers" section (CSP + headers via `next.config.ts` `headers()`).
- added — "Observability — Error Tracking" section (Sentry via `@sentry/nextjs`, wired into `error.tsx`/`global-error.tsx`).
- added — `.env.example` convention and Node runtime pinning (`.nvmrc` + `engines`); CI now uses `node-version-file: .nvmrc`.
- added — "Developer Experience — Formatting, Linting & Git Hooks" section to `CICD.md`: Prettier + `eslint-config-prettier` + `prettier-plugin-tailwindcss`, Husky + lint-staged pre-commit, commitlint commit-msg, and a pre-push gate (typecheck + unit/component tests + build; E2E stays in CI). Added `format`, `format:check`, and `prepare` scripts.
- fixed — Unified the API client on a single `apiClient` export in `lib/api/client.ts`; the Auth.js section now references it instead of redefining a conflicting `api` export. Concurrent-session deduplication is documented in the canonical Axios Instance section.
- fixed — Corrected case-sensitive cross-references from `best-practices.md` to `BEST-PRACTICES.md`.
- changed — Lint script uses the ESLint CLI directly (`eslint`) since `next lint` was removed in Next.js 16.
- added — Recreated this `CHANGELOG.md` (referenced by `CONTRIBUTING.md` but missing after the docs reorganization).

## 2026-01

- changed — Renamed docs to uppercase, reorganized into `docs/`, added App Router special-files and auth/SSE templates, switched the default styling stack to Tailwind, added the Ant Design v6 variant.
- added — `CONTRIBUTING.md`, `DECISIONS.md`, and `FAQ.md`.
