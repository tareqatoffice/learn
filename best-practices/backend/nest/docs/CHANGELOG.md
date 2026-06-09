# Changelog — Backend Best Practices

All notable changes to the backend best-practices documentation are recorded here. Newest entries at the top.

Entry format: `type — description`, where `type` is one of `added`, `changed`, `removed`, `fixed`. Group entries under a dated heading.

---

## 2026-06-09

- added — "Developer Experience — Formatting, Linting & Git Hooks" section to `CICD.md`: Prettier + `eslint-config-prettier`, Husky + lint-staged pre-commit, commitlint commit-msg, and a pre-push gate (typecheck + tests + build). Added `format`, `format:check`, and `prepare` scripts.
- fixed — Corrected case-sensitive cross-references from `best-practices.md` / `best-practices-postgresql.md` to the actual uppercase filenames (`BEST-PRACTICES.md` / `BEST-PRACTICES-POSTGRESQL.md`).
- changed — Dockerfile uses `npm ci --omit=dev` instead of the deprecated `--only=production`.
- added — Recreated this `CHANGELOG.md` (referenced by `CONTRIBUTING.md` and `DECISIONS.md` but missing after the docs reorganization).

## 2026-01

- changed — Renamed docs to uppercase, reorganized into `docs/`, added App Router special-files and auth/SSE templates (frontend), switched frontend default to Tailwind, added the Ant Design variant.
- added — `CONTRIBUTING.md`, `DECISIONS.md`, and `FAQ.md`.
