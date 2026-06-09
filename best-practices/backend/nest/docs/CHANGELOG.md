# Changelog — Backend Best Practices (NestJS)

All notable changes to `best-practices.md` and `best-practices-postgresql.md` are recorded here.
Format: `[YYYY-MM-DD] Type — Description`.

---

## [2026-06-09] feat — Add Swagger, Health Checks, Graceful Shutdown; fix inconsistencies

**Fixed** (`best-practices.md`)
- Config factory: replaced PostgreSQL-style `database.host/port/name` keys with `database.uri` (MongoDB URI) and added `redis.url`
- `CacheModule`: now injects `ConfigService` and reads `redis.url` via `config.get()` instead of `process.env` directly — consistent with the no-`process.env`-in-modules rule
- Performance section: replaced TypeORM terminology ("select in TypeORM queries", "columns") with Mongoose equivalents (`.select()`, "fields", index guidance)

**Added** (`best-practices.md`)
- **Swagger / OpenAPI**: `DocumentBuilder` + `SwaggerModule` setup, `@ApiProperty` on DTOs, `@ApiResponse` on controllers, `@ApiBearerAuth`, production protection guidance
- **Health Checks**: `@nestjs/terminus` with `MongooseHealthIndicator`, correct import merge, `@Public()` + `@SkipThrottle()` both shown with imports
- **Graceful Shutdown**: `enableShutdownHooks()`, `OnModuleDestroy`, Docker `CMD` and Kubernetes `terminationGracePeriodSeconds` guidance

**Updated** (`best-practices-postgresql.md`)
- Extended referenced-sections list to include the three new sections (Swagger / OpenAPI, Health Checks, Graceful Shutdown)

---

## [2026-06-09] fix — Expand and correct Testing sections

**Fixed** (`best-practices.md`)
- Unit test: replaced `getRepositoryToken` (TypeORM) with `getModelToken(User.name)` from `@nestjs/mongoose`
- Mock now chains `.exec()` to match the production Mongoose query pattern
- E2E: replaced generic pattern with `mongodb-memory-server` (`MongoMemoryServer.create()`, `dropDatabase()` in `afterEach`, `mongod.stop()` in `afterAll`)

**Added** (`best-practices-postgresql.md`)
- Complete Testing section with TypeORM `getRepositoryToken(User)` unit tests, dedicated test PostgreSQL DB E2E using `runMigrations()` + `TRUNCATE … RESTART IDENTITY CASCADE` cleanup, `.env.test` + Jest `setupFiles` pattern

**Fixed** (`frontend/next/best-practices.md` — same commit)
- Frontend testing section also expanded (see frontend CHANGELOG)

---

## [2026-06-09] docs — Switch default DB to MongoDB; add PostgreSQL guide

**Changed** (`best-practices.md`)
- Default database changed from PostgreSQL to **MongoDB**
- All repository/entity references updated to Mongoose schema pattern (`@Schema`, `@Prop`, `HydratedDocument`, `@InjectModel`, `.lean()`, sessions)
- Auth section updated: Option A native `@nestjs/jwt` (recommended), Option B `@nestjs/passport` for multi-strategy
- `@nestjs/cache-manager` v3 Keyv-based setup added

**Added**
- `best-practices-postgresql.md` — standalone PostgreSQL guide covering: project structure (entities), TypeORM connection, entity definition, repository pattern, QueryBuilder, transactions, migrations (`data-source.ts`, CLI workflow), performance, performance

---

## [2026-06-09] docs — Align with NestJS v11

**Changed**
- Version bumped from v10 → v11 (latest stable: v11.1.26)
- `@nestjs/jwt` v11, `@nestjs/passport` v11, `@nestjs/cache-manager` v3 (Keyv-based, breaking change from v2)
- `@Inject()` now enforces strict token typing — added `InjectionToken<T>` guidance
- `CLAUDE.md` stack versions updated

---

## [2026-06-09] docs — Apply improvements from official NestJS docs

**Added / Updated**
- `APP_PIPE` / `APP_FILTER` / `APP_GUARD` / `APP_INTERCEPTOR` token pattern (preferred over `useGlobalXxx()`)
- `disableErrorMessages: true` in production `ValidationPipe`
- `registerAs()` for namespaced config with `ConfigType<typeof config>` strong typing
- `bufferLogs: true` for bootstrap log capture
- JSON logger setup (`ConsoleLogger({ json: true })`) for log aggregators
- Guards returning `false` vs throwing `UnauthorizedException` / `ForbiddenException`
- Exception `cause` option for internal logging without leaking to response
- CORS origins read via `ConfigService`, not `process.env` directly

---

## [2026-06-09] fix — Code review corrections (10 findings)

**Fixed**
- Plaintext password in `create()` → added `bcrypt.hash()` before `userRepo.create()`
- `@Exclude()` target changed from `password` to `passwordHash`
- `(exceptionResponse as any).message` → typed cast `(exceptionResponse as { message: string | string[] }).message`
- `process.env.ALLOWED_ORIGINS` in CORS → moved to config factory, read via `ConfigService` in `main.ts`

---

## [2026-06-09] docs — Initial creation

**Added**
- Full best practices document covering: Project Structure, Modules, Controllers, Services, DTOs & Validation, Database & Repositories, Authentication & Authorization, Error Handling, Configuration, Logging, TypeScript Standards, Testing, Performance & Security
- `CLAUDE.md` quick-reference file
