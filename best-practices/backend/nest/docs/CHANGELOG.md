# Changelog — Backend Best Practices

All notable changes to the backend best-practices documentation are recorded here. Newest entries at the top.

Entry format: `type — description`, where `type` is one of `added`, `changed`, `removed`, `fixed`. Group entries under a dated heading.

---

## 2026-06-09

- changed — Removed duplication in `BEST-PRACTICES-POSTGRESQL.md`: the Testing "Rules" block (verbatim copy of the base) and the Performance principles (paginate/index/cache) now reference the base instead of restating it; only TypeORM-specific guidance remains.
- added — Agent-facing sections to `CLAUDE.md`: `Working Agreement` (definition of done, no-commit-without-approval) and `Commands` (canonical scripts incl. single-test invocation).
- added — Multi-tool agent wiring so Claude Code, Codex, Cursor, Antigravity/Gemini, and Copilot all auto-load the same rules from a single source (`CLAUDE.md`): `AGENTS.md` + `GEMINI.md` + `.github/copilot-instructions.md` symlinks, plus a Cursor `.cursor/rules/standards.mdc` always-on rule. Documented in `CONTRIBUTING.md`.
- added — "API Response Shape & Pagination" section: `{ data, meta }` envelope, shared `PaginationQueryDto` (`page`/`limit` max 100/`sort`/`order`), and `Paginated<T>`. Mirrored in the PostgreSQL variant.
- added — "Observability — Error Tracking" section (Sentry via `@sentry/nestjs`, 4xx filtering, no PII).
- added — `.env.example` convention (Configuration section) and Node runtime pinning (`.nvmrc` + `engines`); CI now uses `node-version-file: .nvmrc`.
- added — Swagger section now flags `/api/docs-json` as the source of truth for the generated frontend client.
- added — "Developer Experience — Formatting, Linting & Git Hooks" section to `CICD.md`: Prettier + `eslint-config-prettier`, Husky + lint-staged pre-commit, commitlint commit-msg, and a pre-push gate (typecheck + tests + build). Added `format`, `format:check`, and `prepare` scripts.
- fixed — Corrected case-sensitive cross-references from `best-practices.md` / `best-practices-postgresql.md` to the actual uppercase filenames (`BEST-PRACTICES.md` / `BEST-PRACTICES-POSTGRESQL.md`).
- changed — Dockerfile uses `npm ci --omit=dev` instead of the deprecated `--only=production`.
- added — Recreated this `CHANGELOG.md` (referenced by `CONTRIBUTING.md` and `DECISIONS.md` but missing after the docs reorganization).

## 2026-01

- changed — Renamed docs to uppercase, reorganized into `docs/`, added App Router special-files and auth/SSE templates (frontend), switched frontend default to Tailwind, added the Ant Design variant.
- added — `CONTRIBUTING.md`, `DECISIONS.md`, and `FAQ.md`.
