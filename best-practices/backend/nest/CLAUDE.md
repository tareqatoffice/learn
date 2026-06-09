# Claude Instructions — NestJS Backend Project

This project follows strict backend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Backend Best Practices](./docs/BEST-PRACTICES.md)** · **[CI/CD](./docs/CICD.md)**

## Working Agreement

- **Definition of done**: before declaring a task complete, run `npm run typecheck`, `npm run lint`, and the relevant tests — all must pass. Report failures honestly; do not claim success on red.
- **Tests are part of the change**: add or update unit tests for any new or changed service logic. New endpoints get at least one happy-path and one error-path test.
- **Never commit or push without explicit approval.** Show the diff and wait. If on `main`, create a branch first.
- **Ask before destructive or outward-facing actions** (dropping data, deleting files you didn't create, calling external services, force-pushing).
- **Stay in scope**: change what the task needs. Match the surrounding style; don't reformat unrelated code.
- **Secrets never leave config**: no hardcoded credentials, no real secrets in examples, no `.env` committed.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (sets up Husky hooks via `prepare`) |
| `npm run start:dev` | Run the API in watch mode |
| `npm run build` | Production build (`nest build`) |
| `npm run typecheck` | `tsc --noEmit` — type-check without emitting |
| `npm run lint` | ESLint over `src`/`test` |
| `npm run format` | Prettier write · `npm run format:check` to verify only |
| `npm test` | Unit tests (Jest) · add `-- --coverage` to enforce thresholds |
| `npm test -- users.service` | Run a single test file / pattern |
| `npm run test:e2e` | E2E tests (`mongodb-memory-server`, no external DB needed) |
| `npm run migration:run` | (PostgreSQL only) apply TypeORM migrations |

> Exact script names live in `docs/CICD.md`. If a command is missing from `package.json`, add it there rather than inventing an ad-hoc invocation.

## Quick Reference

| Topic | Rule |
|---|---|
| Structure | One module per feature. Controllers, services, DTOs, entities all scoped to their module. |
| Controllers | HTTP concerns only. No business logic. Always type return values. |
| Services | All business logic lives here. No HTTP types (`Request`, `@Req`) in services. |
| Validation | `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. |
| DTOs | Every request body/query has a DTO with `class-validator` decorators. |
| Responses | Use `@Exclude()` on sensitive entity fields. Enable `ClassSerializerInterceptor` globally. |
| Pagination | List endpoints return `{ data, meta }`. `PaginationQueryDto` — `page` / `limit` (max 100) / `sort` / `order`. Single resource returned bare. |
| Database | Mongoose Model pattern. `@InjectModel`. `.lean()` for reads. Sessions for multi-doc transactions. |
| Auth | JWT (short-lived) + refresh tokens. `@Public()` decorator for open routes. Guards for roles. |
| Errors | NestJS HTTP exceptions from services. Global `HttpExceptionFilter`. Never leak stack traces. |
| Config | `@nestjs/config` only. No direct `process.env` in services/controllers. Validate at startup. |
| TypeScript | `strict: true`. No `any`. Explicit return types on all public methods. |
| Security | `helmet`, `throttler`, parameterized queries, explicit CORS. No `origin: "*"` in production. |
| Email | BullMQ queue → `MailProcessor` → `MailProvider` (SMTP via nodemailer). Provider-agnostic — Resend/Brevo/Google swap by env. Never send synchronously or from the frontend. |
| Queues | BullMQ. Always set `attempts`, `backoff`, `removeOnComplete`. |
| Files | Presigned URL → Cloudflare R2. Store key only. Serve via custom domain. |
| Bot protection | `TurnstileGuard` on login, register, forgot-password. Invisible widget. |
| Analytics | PostHog Node SDK. `capture()` on business events. `shutdown()` on destroy. |
| Notifications | `@Sse()` + Redis pub/sub for multi-instance fan-out. |
| CI/CD | Conventional Commits · GitHub Actions · Docker → GHCR → SSH deploy. |
| Dependency isolation | Every third-party SDK behind a provider (`MailProvider`, `FilesService`, `AnalyticsService`…). Never instantiate an SDK or read `process.env` outside its wrapper. Don't over-wrap. |
| Dev tooling | Prettier + ESLint (`eslint-config-prettier`). Husky: `lint-staged` pre-commit, commitlint commit-msg, typecheck + test + build pre-push. |

## Stack Versions

- NestJS v11 (latest stable: v11.1.26)
- Node.js >= 20
- MongoDB (default database)
- `@nestjs/mongoose` v11 · Mongoose v8
- `@nestjs/jwt` v11
- `@nestjs/passport` v11 · passport `^0.7`
- `@nestjs/cache-manager` v3 (Keyv-based)
- BullMQ · `@nestjs/bullmq` · `@nestjs/schedule`
- Cloudflare R2 (`@aws-sdk/client-s3`)
- Cloudflare Turnstile (invisible)
- PostHog (`posthog-node`)
- Email: SMTP via `nodemailer` (provider-agnostic — Resend/Brevo/Google) + React Email templates

> For PostgreSQL projects, use `docs/BEST-PRACTICES-POSTGRESQL.md` instead.
