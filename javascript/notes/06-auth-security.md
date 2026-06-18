# Phase 6 — Authentication & Security

> **Mental model carry-over from .NET:** Authentication answers *"who are you?"*, authorization answers *"what are you allowed to do?"*. In ASP.NET you wire this with the authentication middleware (`AddAuthentication().AddJwtBearer()`), `[Authorize]` attributes, and policy handlers. In NestJS the equivalent building blocks are **Passport strategies** (the `AddJwtBearer` part), **Guards** (the `[Authorize]` part), and **custom guards + decorators** (the policy-handler part). The wiring is more explicit, but the concepts map one-to-one.

---

## 6.1 Authentication Fundamentals in NestJS

### The cast of characters

NestJS doesn't ship its own auth implementation — it wraps **Passport**, the de-facto Node.js authentication library, via `@nestjs/passport`. Passport's unit of work is a **strategy**: a self-contained class that knows how to extract credentials from a request and validate them. `passport-jwt` is the strategy for bearer JWTs; `passport-local` for username/password.

```
@nestjs/passport   →  the NestJS adapter (gives you AuthGuard, PassportStrategy base class)
passport           →  the underlying engine that runs strategies
passport-jwt       →  a strategy: extract Bearer token, verify signature, decode payload
passport-local     →  a strategy: pull username+password from the body
```

Install:

```bash
npm i @nestjs/passport passport @nestjs/jwt passport-jwt passport-local
npm i -D @types/passport-jwt @types/passport-local
```

### Guards — the `[Authorize]` of NestJS

A **Guard** is a class implementing `CanActivate`. It runs **after** middleware but **before** the route handler, pipes, and interceptors. It returns `true` (let the request through) or `false`/throws (reject — Nest turns a `false` into a `403 Forbidden`, a thrown `UnauthorizedException` into `401`).

```ts
// The simplest possible guard — illustrates the contract.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AlwaysAllowGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true; // returning false here → 403; throwing UnauthorizedException → 401
  }
}
```

`@UseGuards(JwtAuthGuard)` on a controller method is the direct analogue of `[Authorize]` on an ASP.NET action:

```ts
@Controller('users')
export class UsersController {
  @UseGuards(JwtAuthGuard)       // ≈ [Authorize] — must present a valid JWT
  @Get('me')
  getProfile(@Req() req) {
    return req.user;              // populated by the JWT strategy's validate()
  }
}
```

| ASP.NET Core | NestJS |
|---|---|
| `[Authorize]` | `@UseGuards(JwtAuthGuard)` |
| `[Authorize(Roles="Admin")]` | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` |
| `[AllowAnonymous]` | a `@Public()` decorator your guard checks (see below) |
| Authentication middleware | the Passport strategy run by `AuthGuard('jwt')` |
| `User.Identity` / `ClaimsPrincipal` | `request.user` |

### `AuthGuard('jwt')` — how the magic name resolves

`@nestjs/passport` exports a factory `AuthGuard(strategyName)`. Calling `AuthGuard('jwt')` returns a guard class that, when activated, runs the registered Passport strategy whose name is `'jwt'`. You almost always subclass it so you can attach decorators, override error handling, or add public-route bypass:

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // 'jwt' must match the name of the registered JwtStrategy (default name 'jwt').
  // Subclassing lets us add behaviour; see the @Public() bypass in 6.3.
}
```

**The flow when a request hits a `@UseGuards(JwtAuthGuard)` route:**

```
Request ──► JwtAuthGuard.canActivate()
              └─► runs Passport 'jwt' strategy
                    ├─► jwtFromRequest: extract Bearer token from Authorization header
                    ├─► verify signature + expiry with the secret
                    ├─► if invalid → throw → 401 Unauthorized
                    └─► if valid → call strategy.validate(payload)
                          └─► whatever validate() returns becomes request.user
              └─► returns true ──► route handler runs, req.user is populated
```

### `ExecutionContext` — reaching the request inside a guard

Guards (and interceptors/filters) receive an `ExecutionContext`, not the raw request. This is because Nest is **transport-agnostic** — the same guard can run over HTTP, WebSockets, or microservice (TCP/RabbitMQ) messages. You narrow it to the transport you're in:

```ts
canActivate(context: ExecutionContext): boolean {
  // HTTP — the common case
  const request = context.switchToHttp().getRequest();
  const user = request.user;

  // (For WebSockets you'd use context.switchToWs().getClient();
  //  for microservices, context.switchToRpc().getData().)

  // getHandler()/getClass() expose the target method/controller —
  // this is how decorator metadata (like @Roles) is read. See 6.4.
  return !!user;
}
```

> **.NET parallel:** `ExecutionContext.switchToHttp().getRequest()` is the moral equivalent of injecting `IHttpContextAccessor` to reach `HttpContext` from inside a policy handler. `context.getHandler()` is how you read attribute metadata, like reading custom attributes via reflection in a `.NET` `AuthorizationHandler`.

---

## 6.2 JWT Authentication

### JWT structure — identical to the .NET track

A JWT is three Base64URL-encoded segments joined by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOiIxMjMiLCJyb2xlIjoiYWRtaW4ifQ . dBjftJeZ4CVP...
└────────── header ──────────────────┘ └────────── payload ──────────────┘ └─── signature ───┘
```

```jsonc
// HEADER — algorithm + token type
{ "alg": "HS256", "typ": "JWT" }

// PAYLOAD — claims. Registered claims (sub, iat, exp, iss, aud) + your custom ones.
{
  "sub": "123",          // subject = the user id (standard claim)
  "email": "a@b.com",
  "role": "admin",
  "iat": 1718500000,     // issued-at (epoch seconds)
  "exp": 1718500900      // expiry (epoch seconds)
}

// SIGNATURE — HMACSHA256( base64url(header) + "." + base64url(payload), secret )
```

**Critical truths (same as in .NET):**

- The payload is **encoded, not encrypted**. Anyone can decode and read it. Never put secrets (passwords, PII you don't want exposed) in a JWT.
- The **signature** is what makes it trustworthy: only someone holding the secret (HS256) or private key (RS256) can produce a valid signature, so the server can detect tampering.
- HS256 (symmetric, one shared secret) is fine for a monolith. **RS256** (asymmetric: sign with private key, verify with public key) is preferred across microservices — services verify with the public key without being able to mint tokens.

### `@nestjs/jwt` — signing and verifying

`JwtModule` registers a configured `JwtService`. Register it `async` so the secret comes from config, never a literal:

```ts
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' }, // access tokens are short-lived
      }),
    }),
  ],
})
export class AuthModule {}
```

```ts
// Signing and verifying with JwtService
const accessToken = this.jwt.sign(
  { sub: user.id, email: user.email, role: user.role }, // payload claims
  // options can override module defaults:
  { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '15m' },
);

// verify() throws if signature invalid or token expired
const payload = this.jwt.verify(accessToken, {
  secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
});

// verifyAsync is the same but non-blocking — prefer it in handlers
const payload2 = await this.jwt.verifyAsync(accessToken, { secret });
```

> **.NET parallel:** `JwtService.sign()` ≈ `JwtSecurityTokenHandler.WriteToken(new JwtSecurityToken(...))`; `JwtService.verify()` ≈ the validation `JwtBearer` middleware performs against `TokenValidationParameters`. `expiresIn: '15m'` ≈ `Expires = DateTime.UtcNow.AddMinutes(15)`.

### Access + refresh token pattern — why two tokens

A single long-lived token is a security liability: if stolen, the attacker has access until it expires, and you can't revoke it (JWTs are stateless). The standard fix:

- **Access token** — short-lived (5–15 min), sent on every request as `Authorization: Bearer ...`. Stateless: validated by signature alone, never hits the DB. If stolen, it expires fast.
- **Refresh token** — long-lived (days/weeks), sent *only* to the `/auth/refresh` endpoint to mint a new access token. **Stored server-side (hashed)** so it can be revoked.

```
Login            ──► returns { accessToken (15m), refreshToken (7d) }
Every API call   ──► Authorization: Bearer <accessToken>
Access expires   ──► POST /auth/refresh { refreshToken }
                       └─► server validates refresh token against DB
                       └─► returns a NEW access token (+ a new refresh token — rotation)
Logout           ──► server deletes/invalidates the stored refresh token
```

### Refresh token rotation + DB storage + invalidation

**Rotation** = every time a refresh token is used, it is invalidated and a brand-new one is issued. This makes a stolen refresh token detectable: if both the attacker and the legitimate user try to use the same token, one of them presents an already-rotated token → you detect reuse and revoke the whole token family.

Store a **hash** of the refresh token, never the raw value — if your DB leaks, the tokens aren't directly usable (same reasoning as hashing passwords).

```prisma
// schema.prisma — one row per active refresh token
model RefreshToken {
  id         String   @id @default(uuid())
  userId     String
  tokenHash  String                       // argon2 hash of the raw refresh token
  expiresAt  DateTime
  revokedAt  DateTime?                     // set when rotated or on logout
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

```ts
// auth.service.ts — the rotation flow, annotated
import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Issue a fresh access+refresh pair and persist the (hashed) refresh token. */
  private async issueTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    // Refresh token: give it a unique jti so each token is distinct even for the same user.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );

    // Store ONLY the hash. The raw token lives only in the client.
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /** Called by POST /auth/refresh. Validates, rotates, and re-issues. */
  async refresh(rawRefreshToken: string) {
    // 1. Verify signature + expiry first (cheap, no DB).
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(rawRefreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Find a NON-revoked stored token for this user whose hash matches.
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched = null;
    for (const c of candidates) {
      if (await argon2.verify(c.tokenHash, rawRefreshToken)) {
        matched = c;
        break;
      }
    }

    // 3. No match among active tokens? Either expired/logged-out OR reuse of a
    //    rotated token. Treat reuse as compromise → nuke ALL of the user's tokens.
    if (!matched) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException('Refresh token reuse detected');
    }

    // 4. Rotate: revoke the one just used, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens(user);
  }

  /** Logout = revoke the presented refresh token (or all of the user's). */
  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

> This rotation-with-reuse-detection scheme is the same pattern ASP.NET teams implement manually (there's no built-in refresh-token store in `JwtBearer` either). The difference is purely syntactic.

### JWT secret rotation strategy

Secrets get compromised or simply age out of policy. You can't flip the secret instantly — every token signed with the old secret would 401 mid-session. Strategy:

1. Keep a **list** of accepted secrets, not a single one. Sign with the *current* secret; verify against *all* still-accepted secrets.
2. Introduce the new secret as accepted (verify-only), then promote it to the signing secret, then later retire the old one once all old tokens have expired (≤ access-token lifetime).

```ts
// Verify against a set of secrets during a rotation window.
function verifyWithAnySecret(token: string, secrets: string[]) {
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret); // first one that validates wins
    } catch {
      /* try next */
    }
  }
  throw new UnauthorizedException();
}
```

For RS256 this is even cleaner: publish multiple public keys via a **JWKS** endpoint, each tagged with a `kid` (key id) in the JWT header, and verifiers pick the matching key — exactly how Azure AD / Auth0 / Cognito do it.

---

## 6.3 Passport Strategies

A strategy extends `PassportStrategy(BaseStrategy)` and implements `validate()`. Whatever `validate()` returns is attached to `request.user`. If it throws, the request is rejected.

### LocalStrategy — username + password login

Used only on the `/auth/login` route. It pulls credentials from the request body, verifies them, and returns the user.

```ts
// local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // passport-local defaults to fields named 'username' and 'password'.
    // Override to use 'email'.
    super({ usernameField: 'email' });
  }

  // Receives the raw credentials. Return value → request.user.
  async validate(email: string, password: string) {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return user; // becomes req.user, consumed by the login handler
  }
}
```

```ts
// auth.service.ts — credential check (constant-time via argon2.verify)
async validateCredentials(email: string, password: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await argon2.verify(user.passwordHash, password);
  return ok ? user : null;
}
```

```ts
// Guard that runs the local strategy, used ONLY on login.
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}

@Controller('auth')
export class AuthController {
  @UseGuards(LocalAuthGuard)         // runs LocalStrategy.validate() before the handler
  @Post('login')
  login(@Req() req) {
    return this.authService.login(req.user); // req.user set by the strategy → issue tokens
  }
}
```

### JwtStrategy — token validation on protected routes

This is the workhorse, run on every protected request. It extracts the bearer token, verifies it (Passport does signature+expiry for you), and `validate()` receives the decoded payload.

```ts
// jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy /* 'jwt' by default */) {
  constructor(private readonly config: ConfigService) {
    super({
      // Where to find the token: the Authorization: Bearer <token> header.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Reject expired tokens (default behaviour; explicit for clarity).
      ignoreExpiration: false,
      // The secret used to VERIFY the signature.
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Only called AFTER the signature and expiry have already been verified.
  // The return value becomes request.user.
  async validate(payload: JwtPayload) {
    // Keep this lean — it runs on every request. Don't hit the DB unless you
    // truly need fresh data (e.g. to check the account isn't banned/deleted).
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
```

Register both strategies as providers in the `AuthModule`:

```ts
@Module({
  imports: [PassportModule, JwtModule.registerAsync({ /* ... */ })],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

### A `@Public()` bypass + global JWT guard

A common production setup: make the JWT guard **global** (everything is protected by default), then opt routes out with a `@Public()` decorator — the inverse of `[AllowAnonymous]`.

```ts
// public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```ts
// jwt-auth.guard.ts — read the metadata and skip auth for @Public() routes
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Reflector reads metadata set by @Public(). Check BOTH the handler and the
    // controller class so @Public() works at either level.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;       // skip JWT validation entirely
    return super.canActivate(context); // otherwise run the normal jwt strategy
  }
}
```

```ts
// app.module.ts — register globally (APP_GUARD), so every route is protected by default
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

### Custom strategies — API keys and OAuth

**API-key strategy** (for machine-to-machine / service clients) using `passport-headerapikey`:

```ts
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
  constructor(private readonly clients: ApiClientService) {
    // Look for the key in the X-API-KEY header.
    super({ header: 'X-API-KEY', prefix: '' }, false);
  }

  // passport-headerapikey calls this with the raw key + a done callback.
  async validate(apiKey: string, done: (err: Error | null, client?: unknown) => void) {
    const client = await this.clients.findByKey(apiKey); // compare against hashed keys in DB
    if (!client) return done(new UnauthorizedException(), undefined);
    return done(null, client); // → request.user
  }
}
// Use with @UseGuards(AuthGuard('api-key')) — note the named strategy 'api-key'.
```

**OAuth** (e.g. Google) uses `passport-google-oauth20`; `validate()` receives the OAuth profile and you upsert a local user. The shape is identical — extend `PassportStrategy`, implement `validate()`. The strategy name you pass (`'google'`) is what you reference in `AuthGuard('google')`.

> **.NET parallel:** registering multiple strategies ≈ chaining `.AddJwtBearer().AddCookie().AddGoogle()` and selecting a scheme. `AuthGuard('api-key')` ≈ `[Authorize(AuthenticationSchemes = "ApiKey")]`.

---

## 6.4 Authorization

Authentication is done — `request.user` exists. Authorization decides whether *that* user may perform *this* action.

### Role-based: custom `@Roles()` decorator + `RolesGuard`

This is the canonical NestJS RBAC pattern and the direct equivalent of `[Authorize(Roles = "Admin,Manager")]`.

```ts
// roles.decorator.ts — attaches the required roles as route metadata
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```ts
// roles.guard.ts — reads the metadata and compares against req.user.role
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // What roles does this route demand? (handler-level overrides class-level)
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @Roles → no restriction

    // req.user was set by JwtStrategy.validate(). The JWT guard must run FIRST.
    const { user } = context.switchToHttp().getRequest();
    return required.some((role) => user?.role === role); // user has one of the roles?
  }
}
```

```ts
// Usage — order matters: JwtAuthGuard authenticates, RolesGuard authorizes.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Roles('admin')                 // ≈ [Authorize(Roles = "admin")]
  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
```

### Permissions-based RBAC

Roles are coarse; permissions are fine-grained (`users:delete`, `orders:read`). Map roles → permissions, store permissions on the user (or resolve them at login and stuff them in the JWT), and gate on the permission rather than the role. Same guard shape, you just check `user.permissions.includes(required)`:

```ts
export const RequirePermissions = (...perms: string[]) =>
  SetMetadata('permissions', perms);

// In the guard:
const required = this.reflector.getAllAndOverride<string[]>('permissions', [
  context.getHandler(), context.getClass(),
]);
return required.every((p) => user.permissions?.includes(p)); // user must have ALL of them
```

Permissions scale better: adding a new role is a config change (which permissions it grants), not a code change scattered across every `@Roles()`.

### Resource-based authorization — ownership checks

Role/permission checks can't answer *"is this **the user's own** order?"* — that needs the resource. Ownership checks generally can't live in a pure guard cleanly (the guard would have to fetch the resource), so they're commonly done in the **service/use-case layer**, or in a guard that loads the resource:

```ts
// In the application/use-case layer (cleanest — the domain decides ownership)
async function getOrder(orderId: string, currentUser: { userId: string; role: string }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw new NotFoundException();

  // Admins bypass; otherwise you must own the resource.
  if (order.userId !== currentUser.userId && currentUser.role !== 'admin') {
    throw new ForbiddenException('You do not own this order');
  }
  return order;
}
```

> **.NET parallel:** this is exactly `IAuthorizationService.AuthorizeAsync(User, resource, "OwnerPolicy")` with a resource-based `AuthorizationHandler<OwnerRequirement, Order>`. NestJS has no built-in resource-based authorization primitive, so you do it explicitly — or reach for CASL.

### CASL — attribute-based access control (ABAC)

`@casl/ability` lets you define rules like *"a user can `update` an `Order` **if** `order.userId === user.id`"* declaratively, combining role, permission, **and** resource attributes — true ABAC. This is the closest analogue to ASP.NET's **custom policy handlers**.

```ts
// ability.factory.ts
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects = 'Order' | 'User' | 'all';
export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilityFor(user: { id: string; role: string }): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'admin') {
    can('manage', 'all');                       // admin can do everything
  } else {
    can('read', 'Order');                        // anyone can read orders...
    can('update', 'Order', { userId: user.id }); // ...but only update their OWN (attribute condition)
    cannot('delete', 'Order');                   // and never delete
  }

  return build();
}
```

```ts
// In a handler / use case — check against the actual resource instance
const ability = defineAbilityFor(currentUser);
if (ability.cannot('update', subject('Order', order))) {
  throw new ForbiddenException();
}
```

| ASP.NET Core | NestJS |
|---|---|
| `[Authorize(Roles = "admin")]` | `@Roles('admin')` + `RolesGuard` |
| Permission-based policies | `@RequirePermissions()` + permission guard |
| Resource-based `AuthorizationHandler<TReq, TResource>` | ownership check in service / CASL |
| Custom `IAuthorizationPolicyProvider` / policy handlers | CASL ability rules |

---

## 6.5 Security Best Practices

### `helmet` — secure HTTP headers

`helmet` sets a battery of defensive response headers (CSP, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, removes `X-Powered-By`, etc.) with one line.

```ts
// main.ts
import helmet from 'helmet';
const app = await NestFactory.create(AppModule);
app.use(helmet()); // ≈ adding security headers middleware / UseHsts() in ASP.NET
```

### `@nestjs/throttler` — rate limiting

Throttling caps requests per IP per window — your first line of defence against brute-force login and credential stuffing.

```ts
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // 100 req / 60s globally
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

```ts
// Tighten specific routes (login is the prime brute-force target).
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 login attempts / minute
@Post('login')
login(/* ... */) {}
```

> ≈ ASP.NET's `Microsoft.AspNetCore.RateLimiting` (`AddRateLimiter` + `[EnableRateLimiting]`). Behind a proxy, configure `app.set('trust proxy', 1)` so the throttler sees the real client IP, not the proxy's.

### CORS — exact origin, never `*` in production

```ts
// main.ts — whitelist exact origins; '*' + credentials is forbidden by the spec anyway.
app.enableCors({
  origin: ['https://app.example.com'], // exact origin(s), from config
  credentials: true,                    // allow cookies/Authorization to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
```

A wildcard `*` lets any site call your API with the user's credentials. ≈ ASP.NET's `WithOrigins("https://app.example.com")` instead of `AllowAnyOrigin()`.

### Input validation — `class-validator` with `whitelist: true`

A global `ValidationPipe` validates incoming DTOs and, crucially, **strips unknown properties** — defending against mass-assignment / over-posting.

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strip any property not in the DTO
    forbidNonWhitelisted: true, // OR reject the request entirely if extras are present
    transform: true,            // coerce payloads into DTO class instances (and types)
  }),
);
```

```ts
// login.dto.ts — only these fields survive validation; anything else is dropped.
import { IsEmail, IsString, MinLength } from 'class-validator';
export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}
```

> `whitelist: true` is the equivalent of `[Bind]` / explicit view-model binding in ASP.NET MVC — it stops a client from setting `isAdmin: true` on a payload your DTO never declared.

### SQL injection — Prisma parameterises by default

Prisma's query methods are **always** parameterised — values never get string-concatenated into SQL, so `findUnique({ where: { email } })` is injection-safe regardless of what `email` contains.

```ts
// SAFE — parameterised, even with hostile input
await prisma.user.findUnique({ where: { email: userInput } });

// SAFE — tagged template, values bound as parameters ($1, $2, ...)
await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${userInput}`;

// DANGER — $queryRawUnsafe with string concatenation = classic SQL injection
await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE email = '${userInput}'`); // NEVER
```

The rule: use the typed query API or the **tagged-template** `$queryRaw`. Never build SQL with string concatenation. (Same principle as parameterised `SqlCommand` / EF `FromSqlInterpolated` vs `FromSqlRaw` in .NET.)

### `bcrypt` vs `argon2` — why argon2 wins

Both are deliberately slow, salted, adaptive password hashes (never use a plain SHA for passwords). The difference:

- **bcrypt** — battle-tested, but **CPU-hard only** and capped at a 72-byte input. A GPU/ASIC farm can parallelise attacks cheaply.
- **argon2** (specifically **argon2id**) — winner of the Password Hashing Competition; **memory-hard** *and* CPU-hard. Forcing each guess to consume lots of RAM neutralises cheap GPU/ASIC parallelism. It's the current OWASP-recommended default.

```ts
import * as argon2 from 'argon2';

// Hash at registration. argon2id is the default variant — good against both
// GPU (memory-hard) and side-channel attacks.
const passwordHash = await argon2.hash(plainPassword, {
  type: argon2.argon2id,
  memoryCost: 19_456, // ~19 MiB per hash (OWASP min); raise on capable hardware
  timeCost: 2,        // iterations
  parallelism: 1,
});

// Verify at login. Constant-time comparison built in — no timing leak.
const ok = await argon2.verify(passwordHash, plainPassword);

// NOTE: the salt and all parameters are embedded IN the hash string, so you
// store just `passwordHash` — no separate salt column needed.
```

> .NET equivalents: bcrypt → `BCrypt.Net-Next`; argon2 → `Konscious.Security.Cryptography.Argon2`. ASP.NET Identity defaults to PBKDF2, which is weaker than argon2 for the same reasons bcrypt is — prefer argon2 for new systems on either stack.

### HTTPS / TLS termination upstream

Don't terminate TLS in Node in production. Put **Nginx / a load balancer / a cloud ingress** in front; it handles the certificate and HTTPS, and forwards plain HTTP over the private network to your app. This offloads crypto, centralises cert renewal (Let's Encrypt/Certbot/Caddy), and lets you scale horizontally behind one cert.

```
Internet ──HTTPS──► Nginx / ALB (TLS termination) ──HTTP──► NestJS (port 3000)
                          │
                          └─ sets X-Forwarded-Proto: https, X-Forwarded-For: <client ip>
```

When behind a proxy, trust the forwarded headers so redirects, throttling, and logging see the real client:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1); // honour X-Forwarded-* from the first proxy hop
```

> Mirrors ASP.NET's `UseForwardedHeaders()` behind a reverse proxy. Also send `Strict-Transport-Security` (helmet does this) so browsers force HTTPS thereafter.

### Secrets in environment — never hardcode

JWT secrets, DB URLs, and API keys live in environment variables (loaded via `@nestjs/config`), never in source. Validate them **at startup** so the app fails fast on a missing/blank secret rather than minting unsigned tokens at runtime.

```ts
// config validation with @nestjs/config + Joi/zod — refuse to boot if a secret is absent
ConfigModule.forRoot({
  validationSchema: Joi.object({
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    DATABASE_URL: Joi.string().uri().required(),
  }),
});
```

In production, source these from a secrets manager (AWS Secrets Manager, Vault, Doppler) injected as env vars at deploy — never commit `.env`; add it to `.gitignore`. ≈ .NET's user-secrets in dev and Key Vault / `IOptions<T>` validation in prod.

---

## Gotchas

- **Guard order matters.** `@UseGuards(JwtAuthGuard, RolesGuard)` runs left-to-right. `RolesGuard` reads `req.user`, which only exists after `JwtAuthGuard` populated it. Swap the order and roles checks silently see `undefined`.
- **A global `ValidationPipe` without `whitelist: true` lets clients over-post.** Unknown fields pass straight through to your service — the door to mass-assignment (`isAdmin: true`).
- **`JwtStrategy.validate()` runs on every request.** Hitting the DB there adds a query to every protected call. Only do it if you must check live state (banned/deleted). Otherwise trust the (short-lived) token.
- **`ignoreExpiration` defaults to `false` — good.** But if you ever set it `true` "to debug", you've disabled expiry checking. Don't ship that.
- **Don't store raw refresh tokens.** Hash them like passwords. A DB leak otherwise hands out live sessions.
- **`AuthGuard('jwt')` returning a 401 with no body** usually means the strategy threw before `validate()` (bad signature/expired) — not your code. Override `handleRequest()` on the guard to customise the error.
- **CORS `origin: '*'` with `credentials: true` is silently ignored by browsers** — the spec forbids it. You must list exact origins for cookie/Authorization-bearing requests.
- **Putting sensitive data in a JWT payload.** It's Base64, not encryption — `jwt.io` decodes it instantly. Keep only ids and coarse claims in there.
- **`$queryRawUnsafe` and `$executeRawUnsafe` exist for a reason but are footguns.** If you type "Unsafe", you own the injection risk. Prefer the tagged-template `$queryRaw`.
- **bcrypt silently truncates input at 72 bytes.** Long passphrases past 72 bytes all hash the same. argon2 has no such limit.
- **Throttler behind a proxy counts the proxy's IP.** Without `trust proxy`, every client looks like one IP and you rate-limit your whole user base together.

---

## Phase 6 Project

**Task:** Add a complete authentication & authorization layer to the Phase 5 Clean Architecture NestJS project — register, login, refresh, logout, and role-protected endpoints.

**Location:** `examples/phase5-clean-arch/` (extend the existing project — add an `AuthModule`).

**Required endpoints:**

| Method | Route | Auth | Behaviour |
|---|---|---|---|
| `POST` | `/auth/register` | public | create user, hash password with **argon2**, return tokens |
| `POST` | `/auth/login` | public (`LocalAuthGuard`) | verify credentials, issue access + refresh |
| `POST` | `/auth/refresh` | public (refresh token in body) | validate, **rotate**, re-issue |
| `POST` | `/auth/logout` | `JwtAuthGuard` | revoke the user's refresh token(s) |
| `GET` | `/users/me` | `JwtAuthGuard` | return `req.user` |
| `DELETE` | `/admin/users/:id` | `JwtAuthGuard` + `RolesGuard` + `@Roles('admin')` | admin-only delete |

**Architectural placement (respect the dependency rule from Phase 5):**

- **Domain:** a `User` entity with a `Role` value object; a `RefreshToken` concept; repository *interfaces* (`IUserRepository`, `IRefreshTokenRepository`). No framework imports here.
- **Application:** use cases / CQRS handlers — `RegisterUserHandler`, `LoginCommandHandler`, `RefreshTokenHandler`. DTOs (`RegisterDto`, `LoginDto`) validated with `class-validator`. Password hashing exposed via a domain `IPasswordHasher` interface (so the domain never imports `argon2` directly).
- **Infrastructure:** `Argon2PasswordHasher implements IPasswordHasher`; Prisma implementations of the repositories; the `RefreshToken` Prisma model.
- **Presentation:** thin `AuthController` / `UsersController` / `AdminController` that delegate to the command/query bus; strategies (`LocalStrategy`, `JwtStrategy`) and guards (`JwtAuthGuard`, `RolesGuard`) live here.

**Concrete hints:**

1. **Two secrets, two lifetimes.** `JWT_ACCESS_SECRET` (15m) and `JWT_REFRESH_SECRET` (7d) — validate both at startup with the config schema. Never reuse one secret for both.
2. **Hash passwords with argon2id** (`argon2.hash` / `argon2.verify`) behind the `IPasswordHasher` interface — keep `argon2` in Infrastructure only.
3. **Refresh tokens:** store the **hash** in a `RefreshToken` table, implement **rotation with reuse-detection** exactly as in §6.2 — on reuse, revoke the whole family and 403.
4. **Make `JwtAuthGuard` global** via `APP_GUARD` and add a `@Public()` decorator so `register`/`login`/`refresh` opt out. Everything else is protected by default.
5. **Roles:** `@Roles()` + `RolesGuard`. Put `role` in the access-token payload so `RolesGuard` needs no DB lookup. Remember guard order: `JwtAuthGuard` before `RolesGuard`.
6. **Security middleware in `main.ts`:** `helmet()`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, exact-origin CORS, and `ThrottlerModule` with a tight 5/min limit on `/auth/login`.
7. **`/users/me`** is the smoke test that the whole chain works: header extraction → signature verify → `validate()` → `req.user`.

**Stretch goals:**
- Swap role checks for **CASL** abilities and an ownership rule ("a user can read/update only their own resources").
- Add an **API-key strategy** for a service-to-service endpoint.
- Implement **JWT secret rotation** with a verify-against-many-secrets window (§6.2).

---

## Interview Questions

### JWT & Token Management

1. Why is the JWT payload Base64URL-encoded rather than encrypted, and what are the security implications of that choice?
2. What is the difference between HS256 and RS256 signing algorithms, and when would you choose RS256 over HS256 in a distributed system?
3. How would you design a token revocation system for JWTs given that they are stateless by nature?
4. What happens when an access token expires mid-request in a client application, and how should the client handle that gracefully?
5. Why should access tokens be kept short-lived (5–15 minutes) rather than making them last longer for user convenience?
6. What is the `jti` claim in a JWT, and in what scenario does it become essential?
7. How would you implement JWT secret rotation in a production system without causing a wave of 401 errors for active users?
8. What is the trade-off between storing user roles in the JWT payload versus fetching them from the database on every request?
9. How would you detect and respond to a JWT that has a valid signature but references a user that has since been deleted or banned?
10. What security risk arises if you use the same secret for both access tokens and refresh tokens?
11. How does the `aud` (audience) claim protect against a token issued for one service being used against a different service?
12. What is the `kid` (key ID) header parameter in a JWT, and how does a JWKS endpoint use it during verification?
13. Why is it dangerous to set `ignoreExpiration: true` in a JWT strategy even temporarily for debugging?
14. What information should you never put into a JWT payload, and why?
15. How would you implement a "logout from all devices" feature in a stateless JWT-based system?

### Refresh Tokens & Session Management

16. What is refresh token rotation, and how does it help detect token theft compared to a simple long-lived refresh token?
17. When a refresh token reuse is detected, why is the correct response to revoke all of the user's refresh tokens rather than just the one being replayed?
18. Why should refresh tokens be stored as hashes in the database rather than in plaintext?
19. What is the security benefit of using a separate `JWT_REFRESH_SECRET` instead of reusing the access token secret for refresh tokens?
20. How would you implement a "remember me" feature using refresh tokens while keeping the default session short-lived?
21. What is the difference between revoking a refresh token on logout versus invalidating all sessions, and when would you choose each approach?
22. How would you handle a race condition where a legitimate client and an attacker both try to use the same refresh token nearly simultaneously?
23. Where is the safest place to store a refresh token on the client side in a browser application, and what are the trade-offs between `httpOnly` cookies and `localStorage`?
24. What is a refresh token "family," and how does family-based revocation improve security against stolen tokens?

### Passport & Guards

25. What is the execution order of NestJS middleware, guards, interceptors, and pipes, and why does that order matter for authentication?
26. Why does `RolesGuard` need to run after `JwtAuthGuard`, and what silent failure occurs if the order is reversed?
27. What is `ExecutionContext` in NestJS, and why is it used instead of passing the raw request directly to a guard?
28. How does `AuthGuard('jwt')` know which Passport strategy to invoke, and what happens if a strategy with that name is not registered?
29. What is the purpose of subclassing `AuthGuard('jwt')` rather than using it directly, and what customisations does subclassing enable?
30. How does `Reflector.getAllAndOverride` differ from `Reflector.get`, and why is the override behaviour important when `@Public()` is set at both the controller and the handler level?
31. How would you write a guard that allows access only during business hours without touching the authentication layer?
32. What does `canActivate` returning `false` produce versus throwing `UnauthorizedException`, and when would you choose each?
33. How would you design a guard that supports multiple authentication schemes (JWT for users, API key for services) on the same endpoint?
34. Why is registering `JwtAuthGuard` via `APP_GUARD` preferable to applying `@UseGuards` on every controller, and what pitfall does the `@Public()` pattern solve?
35. How would you unit-test a custom guard that reads decorator metadata via `Reflector`?

### Password Security

36. Why is MD5 or SHA-256 unsuitable for hashing passwords even though they are cryptographic hash functions?
37. What makes argon2id superior to bcrypt for password hashing, and what specific attack does its memory-hardness mitigate?
38. What is a "timing attack" in the context of password verification, and how does `argon2.verify` defend against it?
39. Why does bcrypt silently truncate passwords beyond 72 bytes, and what real-world risk does this create for users with long passphrases?
40. What parameters (memory cost, time cost, parallelism) should you tune when configuring argon2, and how do you decide the right values for your hardware?
41. How would you handle a password-hashing algorithm migration (e.g. bcrypt to argon2) for an existing user base without forcing a mass password reset?
42. Why should the salt be embedded in the hash output rather than stored in a separate database column, and how does argon2 handle this?
43. What is a pepper in the context of password hashing, and what threat does it mitigate that salting alone does not?
44. How would you securely expose a "forgot password" flow without leaking whether a given email address is registered?

### Authorization & RBAC

45. What is the difference between role-based access control (RBAC) and attribute-based access control (ABAC), and when does the complexity of ABAC become justified?
46. Why do permissions scale better than roles as a system grows, and what specific problem arises when you gate logic directly on coarse role names?
47. Why are ownership checks ("is this the user's own resource?") awkward to implement purely in a guard, and where in the application layer should they live?
48. How does CASL's `subject()` helper enable attribute-level authorization conditions, and what is the equivalent concept in ASP.NET Core policy handlers?
49. What is privilege escalation, and how would you prevent a user from elevating their own role via a PUT `/users/:id` endpoint?
50. How would you design a multi-tenant RBAC system where the same user can have different roles in different tenants?
51. What is the principle of least privilege, and how would you apply it when deciding what claims to embed in an access token?
52. How would you audit authorization decisions in a production system so that you can answer "who accessed what resource and when?"

### OAuth 2.0

53. What is the difference between the OAuth 2.0 Authorization Code flow and the Implicit flow, and why is the Implicit flow now deprecated?
54. What is a PKCE (Proof Key for Code Exchange) challenge, and which class of attack does it prevent in public OAuth clients?
55. When implementing "Sign in with Google" in NestJS via `passport-google-oauth20`, what does the `validate()` method receive and what should it return?
56. What is the difference between an OAuth access token and an OpenID Connect ID token, and which one should you use to identify the user in your own system?
57. How would you handle the case where an OAuth provider returns an email address that already exists in your database under a different authentication method?
58. What is the `state` parameter in the OAuth Authorization Code flow, and what attack does it prevent?
59. Why should you never use OAuth's access token as your own internal session token, and what should you do instead?

### API Security & HTTPS

60. What HTTP headers does `helmet` set by default, and which one is most critical for preventing clickjacking?
61. What is `Strict-Transport-Security`, what does the `includeSubDomains` directive add, and what is the risk of setting a very long `max-age` prematurely?
62. What is `X-Content-Type-Options: nosniff`, and what MIME-sniffing attack does it block?
63. Why is `CORS origin: '*'` with `credentials: true` silently rejected by browsers, and how do you correctly configure cross-origin cookie or Authorization header requests?
64. What is the difference between CORS and CSRF? Can CORS configuration alone protect against CSRF attacks?
65. How does rate limiting at the application level differ from rate limiting at the API gateway level, and when do you need both?
66. What happens to rate limiting accuracy when your Node app is behind a reverse proxy and `trust proxy` is not configured, and how do you fix it?
67. How would you design a rate-limiting strategy that distinguishes between anonymous and authenticated users and applies different thresholds?
68. What is TLS termination, and why is it considered a better practice to terminate TLS at the reverse proxy rather than inside the Node.js process?
69. What does `app.set('trust proxy', 1)` do in Express/NestJS, and what security risk does blindly trusting all proxy headers introduce?

### Common Vulnerabilities & Input Validation

70. What is a mass-assignment (over-posting) vulnerability, and how does `ValidationPipe({ whitelist: true })` prevent it in NestJS?
71. What is the difference between `whitelist: true` and `forbidNonWhitelisted: true` in a NestJS `ValidationPipe`, and when would you prefer one over the other?
72. What is SQL injection, and why does Prisma's query API eliminate it even when passing user-supplied data as values?
73. When is `$queryRawUnsafe` necessary in Prisma, and what developer discipline must be applied whenever it is used?
74. What is a stored XSS attack, and what output-encoding or CSP strategy would you use to mitigate it in a NestJS API that returns user-supplied data?
75. What is SSRF (Server-Side Request Forgery), and how would you prevent it in an endpoint that fetches a user-supplied URL?
76. What is credential stuffing, and how does a tight rate limit on `/auth/login` combined with argon2 hashing reduce its effectiveness?
77. Why is it important to validate and sanitise secrets at application startup rather than at the moment they are first used?
78. What is the risk of logging JWT tokens or raw passwords in application logs, and what should you log instead to aid debugging without exposing credentials?
79. How would you prevent an attacker from enumerating valid usernames through a login endpoint that returns different error messages for "user not found" vs "wrong password"?
