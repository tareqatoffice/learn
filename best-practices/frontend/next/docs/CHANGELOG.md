# Changelog — Frontend Best Practices

All notable changes to the frontend best-practices documentation are recorded here. Newest entries at the top.

Entry format: `type — description`, where `type` is one of `added`, `changed`, `removed`, `fixed`. Group entries under a dated heading.

---

## 2026-06-09

- added — "Developer Experience — Formatting, Linting & Git Hooks" section to `CICD.md`: Prettier + `eslint-config-prettier` + `prettier-plugin-tailwindcss`, Husky + lint-staged pre-commit, commitlint commit-msg, and a pre-push gate (typecheck + unit/component tests + build; E2E stays in CI). Added `format`, `format:check`, and `prepare` scripts.
- fixed — Unified the API client on a single `apiClient` export in `lib/api/client.ts`; the Auth.js section now references it instead of redefining a conflicting `api` export. Concurrent-session deduplication is documented in the canonical Axios Instance section.
- fixed — Corrected case-sensitive cross-references from `best-practices.md` to `BEST-PRACTICES.md`.
- changed — Lint script uses the ESLint CLI directly (`eslint`) since `next lint` was removed in Next.js 16.
- added — Recreated this `CHANGELOG.md` (referenced by `CONTRIBUTING.md` but missing after the docs reorganization).

## 2026-01

- changed — Renamed docs to uppercase, reorganized into `docs/`, added App Router special-files and auth/SSE templates, switched the default styling stack to Tailwind, added the Ant Design v6 variant.
- added — `CONTRIBUTING.md`, `DECISIONS.md`, and `FAQ.md`.
