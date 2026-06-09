# Claude Instructions — NestJS Backend Project

This project follows strict backend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Backend Best Practices](./best-practices.md)**

## Quick Reference

| Topic | Rule |
|---|---|
| Structure | One module per feature. Controllers, services, DTOs, entities all scoped to their module. |
| Controllers | HTTP concerns only. No business logic. Always type return values. |
| Services | All business logic lives here. No HTTP types (`Request`, `@Req`) in services. |
| Validation | `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. |
| DTOs | Every request body/query has a DTO with `class-validator` decorators. |
| Responses | Use `@Exclude()` on sensitive entity fields. Enable `ClassSerializerInterceptor` globally. |
| Database | Mongoose Model pattern. `@InjectModel`. `.lean()` for reads. Sessions for multi-doc transactions. |
| Auth | JWT (short-lived) + refresh tokens. `@Public()` decorator for open routes. Guards for roles. |
| Errors | NestJS HTTP exceptions from services. Global `HttpExceptionFilter`. Never leak stack traces. |
| Config | `@nestjs/config` only. No direct `process.env` in services/controllers. Validate at startup. |
| TypeScript | `strict: true`. No `any`. Explicit return types on all public methods. |
| Security | `helmet`, `throttler`, parameterized queries, explicit CORS. No `origin: "*"` in production. |

## Stack Versions

- NestJS v11 (latest stable: v11.1.26)
- Node.js >= 20
- MongoDB (default database)
- `@nestjs/mongoose` v11 · Mongoose v8
- `@nestjs/jwt` v11
- `@nestjs/passport` v11 · passport `^0.7`
- `@nestjs/cache-manager` v3 (Keyv-based)

> For PostgreSQL projects, use `best-practices-postgresql.md` instead.
