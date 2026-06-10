# Changelog — Backend Best Practices

All notable changes to the backend best-practices documentation are recorded here. Newest entries at the top.

Entry format: `type — description`, where `type` is one of `added`, `changed`, `removed`, `fixed`. Group entries under a dated heading.

---

## 2026-06-10

- fixed — Corrected the `@nestjs/cache-manager` v3 example (and ADR-006) to match the current official docs: `KeyvCacheableMemory` from `cacheable` (not the lower-level `CacheableMemory`, which doesn't implement the Keyv store interface) and the default-imported `KeyvRedis` from `@keyv/redis` (not `createKeyv`).
- added — Controllers note that NestJS 11 runs on Express 5, so catch-all route paths use named wildcards (`/*splat` / `/{*splat}`), not the bare `*`.
- fixed — Controllers used `ParseUUIDPipe` on MongoDB `_id` params, which rejects valid `ObjectId`s. Replaced with a custom `ParseObjectIdPipe` (and `@IsMongoId()` for DTOs); noted that `ParseUUIDPipe` belongs to the PostgreSQL/UUID variant.
- fixed — Controller return types referenced an undefined `UserResponseDto` while services returned `UserDocument` (type mismatch). Controllers now return `UserDocument`; added a defined `UserResponseDto` response class in the Swagger section as the documented wire shape the frontend generates from.
- fixed — Auth guard now checks the `Bearer` scheme (not just `split(" ")[1]`); removed the unused `MongooseHealthIndicator` import from the health module example.
- added — "API Versioning" section (URI versioning via `enableVersioning`, bump-on-breaking-change policy).
- added — "Request Context & Correlation IDs" section (`nestjs-cls` / `AsyncLocalStorage`, propagation to logs, Sentry, outbound calls).
- added — "Idempotency" section (`Idempotency-Key` header, Redis-backed replay, concurrent-retry guard) for retry-unsafe `POST`s.
- changed — SSE stream is now authenticated with a short-lived single-use Redis ticket (`SseTicketService`, atomic `GETDEL`) instead of the access token in the query string, which leaks into logs/history. Frontend updated in lockstep.
- changed — ADR-005 + Auth section now document `argon2id` (OWASP's first recommendation) as the equal-footing alternative to bcrypt; bcrypt stays the default.
- changed — Dependency Isolation table: removed the misleading "Database" row and added a note that the ORM is deliberately *not* behind a port (DIP applied where a runtime swap is realistic, not to the persistence library).
- changed — `disableErrorMessages` note now flags the UX trade-off (it also hides legitimate field messages).

## 2026-06-09

- added — "Dependency Isolation" section + ADR-010: every third-party SDK lives behind a provider/port (the email `MailProvider` is the reference); call sites never touch the SDK or `process.env`. Includes a "don't over-wrap" caveat.
- changed — Refactored the Email Service to a **provider-agnostic** `MailProvider` port with a single SMTP transport (nodemailer); Resend/Brevo/Google now swap by env (`MAIL_*`) with no code change. Processor injects the provider via DI (`ConfigService`, not `process.env`). Added a `mail` config namespace; updated runtime-secrets list (`RESEND_API_KEY` → `MAIL_*`).
- added — ADR-009 (provider-agnostic SMTP email, backend-only) and FAQ "Email" entries; reinforced "backend-only, credentials never in frontend" in the Email Service section.
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
