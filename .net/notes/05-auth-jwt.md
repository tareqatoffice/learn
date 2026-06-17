# Phase 5 — Authentication & JWT

**Status:** Not started
**Notes file for:** LEARNING_PLAN.md → Phase 5

> **Node.js mental model going in:** In Express you reach for `jsonwebtoken` to sign/verify tokens and either Passport (`passport-jwt` strategy) or a hand-rolled middleware to gate routes. ASP.NET Core bakes all of this into the framework: a JWT bearer **authentication handler** (replaces `passport-jwt`), the `[Authorize]` **attribute** (replaces your `requireAuth` middleware), and a **policy/role system** (replaces your scattered `if (req.user.role !== 'admin')` checks). The big shift: instead of stuffing a user object onto `req.user`, the framework builds a typed `ClaimsPrincipal` and hangs it off `HttpContext.User`.

---

## 5.1 Auth Fundamentals

### Authentication vs Authorization

Two words people blur together. Keep them straight:

| | Authentication (AuthN) | Authorization (AuthZ) |
|---|---|---|
| Question | **Who are you?** | **Are you allowed to do this?** |
| Output | An identity (a set of claims) | A yes/no decision |
| Express analogy | Verifying the JWT and setting `req.user` | Checking `req.user.role === 'admin'` |
| ASP.NET piece | `UseAuthentication()`, the JwtBearer handler | `UseAuthorization()`, `[Authorize]`, policies |

Authentication always comes first — you can't decide what someone is *allowed* to do until you know *who* they are.

### The Identity Model: Claim, ClaimsIdentity, ClaimsPrincipal

This is the part with no clean Express equivalent. In Express, `req.user` is just whatever object you decoded from the JWT. In ASP.NET Core, identity is a structured three-level model:

```
ClaimsPrincipal          ← the user (HttpContext.User). Can hold multiple identities.
   └─ ClaimsIdentity     ← one "identity card" (e.g. from a JWT). Has an AuthenticationType.
        └─ Claim          ← a single key/value fact: { type: "email", value: "t@x.com" }
        └─ Claim          ← { type: "role", value: "Admin" }
        └─ Claim          ← { type: "sub",  value: "42" }
```

- **`Claim`** — one statement about the user. Just a typed key/value pair. The "payload entries" of your JWT become claims.
- **`ClaimsIdentity`** — a bundle of claims from one source, plus an `AuthenticationType` (e.g. `"Bearer"`). `IsAuthenticated` is true only if the identity has an auth type set.
- **`ClaimsPrincipal`** — the user as the app sees them. Wraps one or more identities. This is what lives at `HttpContext.User`.

```csharp
// Reading the current user inside a controller (think: req.user)
[HttpGet("me")]
[Authorize]
public IActionResult Me()
{
    // ClaimsPrincipal — same object the framework built from the validated JWT
    ClaimsPrincipal user = User; // controllers expose it as `User`

    // Pull individual claims. FindFirstValue returns null if absent (no throw).
    string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier); // the "sub"
    string? email  = User.FindFirstValue(ClaimTypes.Email);
    bool isAdmin   = User.IsInRole("Admin"); // checks role claims

    return Ok(new { userId, email, isAdmin });
}
```

> **Gotcha — claim type names get rewritten.** Microsoft's JWT handler maps short JWT claim names to long URI-style names by default. `sub` becomes `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier`, `role` becomes `.../claims/role`, etc. `ClaimTypes.NameIdentifier` is a constant for that long URI, which is why the code above works. You can turn the remapping off — see 5.2.

### Middleware Order — This Trips Everyone Up

Same rule as Express: middleware runs in the order you register it. But these two have a **mandatory order** relative to each other:

```csharp
var app = builder.Build();

app.UseHttpsRedirection();

app.UseAuthentication();  // 1. Reads the token, builds HttpContext.User. MUST come first.
app.UseAuthorization();   // 2. Reads HttpContext.User, enforces [Authorize]. MUST come second.

app.MapControllers();     // 3. Endpoints run after both.

app.Run();
```

If you put `UseAuthorization()` before `UseAuthentication()`, the authorization step runs against an **empty, unauthenticated** user — every `[Authorize]` endpoint returns 401 even with a valid token. It's the classic "I sent the right token and still get 401" bug.

> Both must also sit **after** `UseRouting()` (it's added implicitly in the minimal hosting model) and **before** `MapControllers()`.

### The `[Authorize]` Attribute ≈ Express Auth Middleware

`[Authorize]` is the declarative version of slapping `requireAuth` onto a route:

```csharp
// Express:  router.get('/orders', requireAuth, handler)
// ASP.NET:
[Authorize]                       // every action in this controller needs a valid identity
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok(/* ... */); // protected

    [HttpGet("public-stats")]
    [AllowAnonymous]              // opt this one action back out — like skipping the middleware
    public IActionResult Stats() => Ok(/* ... */);
}
```

- `[Authorize]` on a controller protects all its actions; on a single action protects just that one.
- `[AllowAnonymous]` always wins — it punches a hole even through a controller-level `[Authorize]`.
- Bare `[Authorize]` means "any authenticated user." Add `Roles=` or `Policy=` to narrow it (5.4).

---

## 5.2 JWT Authentication

### JWT Structure — Identical to What You Know

Nothing new here versus the frontend. A JWT is three base64url chunks joined by dots:

```
header.payload.signature
  │       │         │
  │       │         └─ HMAC/RSA signature over header+payload, proves it wasn't tampered with
  │       └─ claims (sub, email, role, exp, iat, iss, aud) — base64, NOT encrypted, anyone can read it
  └─ { "alg": "HS256", "typ": "JWT" }
```

Same rules as always: **the payload is readable by anyone** (it's just base64), so never put secrets in it. The signature only guarantees integrity, not confidentiality. Standard registered claims you'll validate:

| Claim | Meaning | Validated by |
|---|---|---|
| `iss` | issuer (who minted it) | `ValidateIssuer` |
| `aud` | audience (who it's for) | `ValidateAudience` |
| `exp` | expiry (unix seconds) | `ValidateLifetime` |
| `nbf` | not-before | `ValidateLifetime` |
| `sub` | subject (user id) | you read it |

### The JwtBearer Package

```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

This is the framework's equivalent of `passport-jwt`: a registered authentication **scheme** named `"Bearer"` that, on every request, looks for an `Authorization: Bearer <token>` header, validates the token, and populates `HttpContext.User`. You configure it once; it runs for free thereafter.

### Configuring TokenValidationParameters in Program.cs

This is the heart of it. `TokenValidationParameters` is the rulebook the handler checks every token against — the equivalent of the options object you'd pass to `jwt.verify(token, secret, options)`.

```csharp
// Program.cs
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Bind a strongly-typed settings object from appsettings.json (options pattern, Phase 2.6)
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme) // default scheme = "Bearer"
    .AddJwtBearer(options =>
    {
        // In production, leave this true (only allow tokens over HTTPS metadata).
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = true; // keep the raw token in HttpContext for later if needed

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,

            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,

            ValidateLifetime = true,        // enforce exp / nbf
            ValidateIssuerSigningKey = true, // verify the signature
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),

            // Default clock skew is a generous 5 minutes — tighten it so expiry means expiry.
            ClockSkew = TimeSpan.FromSeconds(30),

            // Which claim the framework treats as "name" and "role"
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = "role",
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();

// Strongly-typed settings record (bound from config)
public record JwtSettings
{
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required string SigningKey { get; init; }   // NEVER hard-code; load from secrets
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 7;
}
```

```jsonc
// appsettings.json — note: SigningKey here is a PLACEHOLDER only.
// The real key comes from user-secrets / env vars (see 5.5). Never commit a real key.
{
  "Jwt": {
    "Issuer": "https://myapi.example.com",
    "Audience": "https://myapi.example.com",
    "SigningKey": "dev-only-placeholder-change-me-min-32-chars",
    "AccessTokenMinutes": 15,
    "RefreshTokenDays": 7
  }
}
```

> **Gotcha — `ClockSkew` defaults to 5 minutes.** A token marked expired is still accepted for up to 5 minutes unless you shrink this. Surprising when you're testing short-lived tokens and they "won't expire."

> **Gotcha — the symmetric key must be long enough.** HS256 needs at least 256 bits (32 bytes). A short key throws `IDX10720` at startup, not at request time.

To stop the long-URI claim remapping mentioned in 5.1, clear the default map once at startup so `sub`, `role`, etc. stay as their short names:

```csharp
JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();
// (older handler) JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
```

### Generating JWTs — A Token Service

In Express you'd call `jwt.sign(payload, secret, { expiresIn })`. The C# equivalent is a handler class. Two options exist:

- **`JwtSecurityTokenHandler`** — the original, in `System.IdentityModel.Tokens.Jwt`. Works everywhere, tons of examples.
- **`JsonWebTokenHandler`** — the newer, faster one in `Microsoft.IdentityModel.JsonWebTokens`. **Preferred for new .NET 10 code.**

Wrap token creation in an injectable service (Phase 2.3 DI):

```csharp
public interface ITokenService
{
    string CreateAccessToken(Guid userId, string email, IEnumerable<string> roles);
    string CreateRefreshToken(); // opaque random string, NOT a JWT — see below
}

public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;
    private readonly SigningCredentials _credentials;

    public TokenService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SigningKey));
        _credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public string CreateAccessToken(Guid userId, string email, IEnumerable<string> roles)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),       // who
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) // unique token id
        };
        // One role claim per role — the framework reads these for [Authorize(Roles=...)]
        claims.AddRange(roles.Select(r => new Claim("role", r)));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _settings.Issuer,
            Audience = _settings.Audience,
            Expires = DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes),
            SigningCredentials = _credentials
        };

        // Modern handler — returns the compact "header.payload.signature" string
        var handler = new JsonWebTokenHandler();
        return handler.CreateToken(descriptor);
    }

    // A refresh token is just a high-entropy random string. It is NOT a JWT —
    // it carries no claims, it's only a lookup key into the DB.
    public string CreateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64); // 512 bits of entropy
        return Convert.ToBase64String(bytes);
    }
}
```

Register it: `builder.Services.AddScoped<ITokenService, TokenService>();`

### Access + Refresh Token Pattern

Short-lived access tokens are great for security but annoying for users (re-login every 15 min). The fix is the same pattern you'd use with `jsonwebtoken`:

```
Access token   — JWT, short life (~15 min), sent on every request as Bearer.
                 Stateless: the API validates the signature, never hits the DB.
Refresh token  — opaque random string, long life (~7 days), stored in DB.
                 Stateful: exchanged for a NEW access token when the old one expires.
```

The flow:

```
1. POST /login  → server returns { accessToken (15m), refreshToken (7d) }
2. Client calls APIs with the access token until it 401s.
3. POST /refresh { refreshToken }
     → server looks it up in DB, checks it's valid + not expired + not revoked
     → issues a NEW access token AND a NEW refresh token (rotation)
     → marks the old refresh token used/revoked
4. On logout → revoke the refresh token in DB.
```

### Storing Refresh Tokens Securely in the DB

Two non-negotiable rules:

1. **Hash refresh tokens before storing them.** Treat them like passwords. If your DB leaks, raw tokens are instantly usable; hashes are not. Store a SHA-256 hash, look up by hash.
2. **Rotate on every use.** Each refresh issues a brand-new refresh token and invalidates the old one. If an old (already-used) token is ever presented again, that's a theft signal — revoke the whole token family.

```csharp
// Entity (EF Core, Phase 3)
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; } // SHA-256 of the token, never the raw value
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }       // set when rotated or logged out
    public string? ReplacedByTokenHash { get; set; } // links the rotation chain (theft detection)

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;
}
```

```csharp
// Hashing helper — deterministic so we can look up by hash
public static class TokenHasher
{
    public static string Hash(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes); // store the hex string
    }
}
```

The rotation flow as a service method:

```csharp
public async Task<AuthResult> RefreshAsync(string presentedToken, CancellationToken ct)
{
    var hash = TokenHasher.Hash(presentedToken);
    var stored = await _db.RefreshTokens
        .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

    // Unknown token, expired, or already revoked → reject.
    if (stored is null || !stored.IsActive)
    {
        // Optional hardening: if the token exists but was already revoked,
        // it may have been stolen — revoke every active token for that user.
        if (stored is not null)
            await RevokeAllForUserAsync(stored.UserId, ct);
        throw new UnauthorizedAccessException("Invalid refresh token.");
    }

    var user = await _db.Users
        .Include(u => u.Roles)
        .FirstAsync(u => u.Id == stored.UserId, ct);

    // Issue the new pair
    var newRefreshRaw = _tokenService.CreateRefreshToken();
    var newRefresh = new RefreshToken
    {
        Id = Guid.NewGuid(),
        UserId = user.Id,
        TokenHash = TokenHasher.Hash(newRefreshRaw),
        ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenDays),
        CreatedAt = DateTime.UtcNow
    };

    // Rotate: revoke the old one and link it to the new one (chain for theft detection)
    stored.RevokedAt = DateTime.UtcNow;
    stored.ReplacedByTokenHash = newRefresh.TokenHash;

    _db.RefreshTokens.Add(newRefresh);
    await _db.SaveChangesAsync(ct);

    var accessToken = _tokenService.CreateAccessToken(
        user.Id, user.Email, user.Roles.Select(r => r.Name));

    // Return the RAW refresh token to the client (only place it ever appears in plaintext)
    return new AuthResult(accessToken, newRefreshRaw);
}

public record AuthResult(string AccessToken, string RefreshToken);
```

> **Gotcha — the raw refresh token only exists at issue time.** You hand it to the client once and store only its hash. There is no way to recover it later, which is exactly the point.

---

## 5.3 ASP.NET Core Identity

`Microsoft.AspNetCore.Identity` is a full user-management framework: user store, password hashing, lockout, email/phone confirmation, 2FA, external logins. Think of it as Passport's local strategy + `bcrypt` + account-management plumbing, all pre-built and wired to EF Core.

```bash
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
```

### The Two Managers

| Service | Job | Express analogy |
|---|---|---|
| `UserManager<TUser>` | CRUD users, hash/verify passwords, manage roles & claims | your `User` model + `bcrypt` calls |
| `SignInManager<TUser>` | Validate credentials, handle lockout, sign-in/out | the login logic in your Passport strategy |

```csharp
// DbContext inherits Identity's schema (Users, Roles, Claims, Tokens tables)
public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
}

// Extend the built-in user with your own fields
public class AppUser : IdentityUser<Guid> // Guid keys instead of the default string
{
    public string? DisplayName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

```csharp
// Program.cs registration
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail = true;
        options.Lockout.MaxFailedAccessAttempts = 5; // built-in brute-force protection
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>();
```

Register and verify users through the manager — never touch password hashing yourself:

```csharp
public async Task<AppUser> RegisterAsync(string email, string password, string displayName)
{
    var user = new AppUser { UserName = email, Email = email, DisplayName = displayName };

    // UserManager hashes the password (PBKDF2 w/ HMAC-SHA256, salted, many iterations).
    var result = await _userManager.CreateAsync(user, password);
    if (!result.Succeeded)
        throw new ValidationException(string.Join("; ", result.Errors.Select(e => e.Description)));

    await _userManager.AddToRoleAsync(user, "User");
    return user;
}

public async Task<AppUser?> ValidateCredentialsAsync(string email, string password)
{
    var user = await _userManager.FindByEmailAsync(email);
    if (user is null) return null;

    // Verifies the hash; honors lockout if you pass lockoutOnFailure: true
    var ok = await _userManager.CheckPasswordAsync(user, password);
    return ok ? user : null;
}
```

### Built-in Password Hashing

Identity's `IPasswordHasher<T>` uses PBKDF2 (HMAC-SHA256, per-user salt, high iteration count) and can transparently re-hash on the next login when the algorithm is upgraded. You get the security properties of `bcrypt`/`argon2` without managing salts or iteration counts yourself.

### When to Use Identity vs Roll Your Own

| Use **ASP.NET Core Identity** when… | Roll your own (just `UserManager`-free + JWT) when… |
|---|---|
| You need registration, password reset, email confirm, lockout, 2FA | You only need login + JWT and store users yourself |
| You want battle-tested password hashing for free | You already have an external identity source |
| Standard username/password app | You want a minimal schema / full control |

> Practical default: use **Identity for the user store + password hashing**, but **issue your own JWTs** with the token service from 5.2. `AddIdentityCore` (not `AddIdentity`) gives you exactly that — the managers without the cookie-based UI plumbing. That's the combo the Phase 5 project uses.

---

## 5.4 Authorization

Once the user is authenticated, authorization decides what they can do. Four mechanisms, increasing in power.

### Role-Based — `[Authorize(Roles = "Admin")]`

The simplest gate. Matches against the user's `role` claims:

```csharp
[Authorize(Roles = "Admin")]                // must have the Admin role
[HttpDelete("{id}")]
public IActionResult Delete(Guid id) => NoContent();

[Authorize(Roles = "Admin,Manager")]        // Admin OR Manager (comma = OR)
[HttpGet("reports")]
public IActionResult Reports() => Ok();

[Authorize(Roles = "Admin")]
[Authorize(Roles = "Manager")]              // stacked attributes = AND (both required)
[HttpGet("sensitive")]
public IActionResult Sensitive() => Ok();
```

This is the `if (req.user.role !== 'admin') return res.sendStatus(403)` pattern, but declarative.

### Policy-Based — Requirements + Handlers

Roles get coarse fast. Policies let you express richer rules ("must be 18+", "must own the resource", "must have a verified email") as reusable, named units. A policy = one or more **requirements**, each satisfied by a **handler**.

```csharp
// 1. The requirement — a plain data carrier (the rule's parameters)
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }
    public MinimumAgeRequirement(int minimumAge) => MinimumAge = minimumAge;
}

// 2. The handler — the logic that decides if the requirement is met
public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        MinimumAgeRequirement requirement)
    {
        var dobClaim = context.User.FindFirst("date_of_birth");
        if (dobClaim is null || !DateTime.TryParse(dobClaim.Value, out var dob))
            return Task.CompletedTask; // not met → leave unfulfilled (results in 403)

        var age = DateTime.UtcNow.Year - dob.Year;
        if (dob > DateTime.UtcNow.AddYears(-age)) age--;

        if (age >= requirement.MinimumAge)
            context.Succeed(requirement); // explicitly mark satisfied

        return Task.CompletedTask;
    }
}
```

```csharp
// 3. Register the policy + handler in Program.cs
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Adult", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(18)));

    // Simple claim-based policies don't even need a custom handler:
    options.AddPolicy("EmailVerified", policy =>
        policy.RequireClaim("email_verified", "true"));
});
builder.Services.AddScoped<IAuthorizationHandler, MinimumAgeHandler>();
```

```csharp
// 4. Apply it
[Authorize(Policy = "Adult")]
[HttpPost("purchase")]
public IActionResult Purchase() => Ok();
```

> Key insight: call `context.Succeed(requirement)` to approve. Doing **nothing** = denial. There's also `context.Fail()` to force a hard deny even if another handler succeeds.

### Resource-Based Authorization

Some checks need the *actual resource* — "can this user edit **this** document?" You can't know that from claims alone; you need to load the document and compare ownership. Roles/policies in attributes can't do this because the resource isn't loaded yet. Use `IAuthorizationService` inside the action:

```csharp
// A requirement with no data, plus a handler that takes the resource as a generic arg
public class DocumentOwnerHandler
    : AuthorizationHandler<OperationAuthorizationRequirement, Document>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OperationAuthorizationRequirement requirement,
        Document resource) // <-- the loaded resource
    {
        var userId = context.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (requirement.Name == "Edit" && resource.OwnerId.ToString() == userId)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

### `IAuthorizationService` — Programmatic Checks

Inject `IAuthorizationService` to run a policy/resource check in code, exactly where you have the data:

```csharp
public class DocumentsController : ControllerBase
{
    private readonly IAuthorizationService _authz;
    private readonly IDocumentRepository _docs;

    public DocumentsController(IAuthorizationService authz, IDocumentRepository docs)
    {
        _authz = authz;
        _docs = docs;
    }

    [Authorize] // any authenticated user can attempt; ownership decided below
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateDoc dto, CancellationToken ct)
    {
        var doc = await _docs.GetByIdAsync(id, ct);
        if (doc is null) return NotFound();

        // Run the resource-based check now that we have the document
        var result = await _authz.AuthorizeAsync(
            User, doc, new OperationAuthorizationRequirement { Name = "Edit" });

        if (!result.Succeeded) return Forbid(); // 403, not 404

        // ... apply update
        return NoContent();
    }
}
```

Register: `builder.Services.AddScoped<IAuthorizationHandler, DocumentOwnerHandler>();`

> **401 vs 403.** Return/produce **401 Unauthorized** when there's no valid identity (not logged in) — `Challenge()`. Return **403 Forbidden** when the user *is* authenticated but not allowed — `Forbid()`. The framework picks the right one automatically for `[Authorize]`; with manual checks, use `Forbid()`.

---

## 5.5 Security Best Practices

### HTTPS Enforcement

```csharp
app.UseHttpsRedirection();                 // redirect HTTP → HTTPS
app.UseHsts();                             // tell browsers "HTTPS only" (skip in Development)
// In appsettings/launch settings, bind to https endpoints.
```

Bearer tokens travel in headers in plaintext — without HTTPS they're trivially sniffable. Non-negotiable in production.

### CORS

Same concept as the `cors` npm package, but configured in the pipeline. Be specific — never reflect `*` when you allow credentials.

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy => policy
        .WithOrigins("https://app.example.com") // explicit origins, not "*"
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// Order matters: CORS goes BEFORE auth.
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
```

> **Gotcha — `AllowAnyOrigin()` + `AllowCredentials()` is illegal** and the framework throws. With credentials you must name explicit origins.

### Rate Limiting

Built into .NET (no external package needed — it's in the shared framework). Protects login/refresh endpoints from brute-force and abuse.

```csharp
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // A fixed-window limiter: 5 requests per 10s per client, named "auth"
    options.AddFixedWindowLimiter("auth", o =>
    {
        o.PermitLimit = 5;
        o.Window = TimeSpan.FromSeconds(10);
        o.QueueLimit = 0;
    });
});

app.UseRateLimiter(); // after routing, before endpoints

// Apply to sensitive endpoints:
[EnableRateLimiting("auth")]
[HttpPost("login")]
public async Task<IActionResult> Login(LoginDto dto) { /* ... */ }
```

### Input Validation

Never trust the client. Validate at the edge — bad input is the root of most vulnerabilities. Use Data Annotations for simple cases, FluentValidation (Phase 4/7) for real apps:

```csharp
public record LoginDto(
    [property: Required, EmailAddress] string Email,
    [property: Required, MinLength(8)] string Password);
```

With `[ApiController]`, invalid models auto-return a 400 `ValidationProblemDetails` before your action even runs — no manual `if (!ModelState.IsValid)` needed.

### SQL Injection Prevention via EF Core

EF Core parameterizes everything by default. LINQ queries and even interpolated `FromSql` are safe because values become bound parameters, not concatenated strings:

```csharp
// SAFE — LINQ → parameterized SQL. `email` is a bound parameter.
var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

// SAFE — FromSql treats interpolation holes as parameters, NOT string concat.
var users = await _db.Users
    .FromSql($"SELECT * FROM \"Users\" WHERE \"Email\" = {email}")
    .ToListAsync(ct);

// DANGER — FromSqlRaw with a manually concatenated string defeats this. Don't.
// _db.Users.FromSqlRaw("SELECT * FROM Users WHERE Email = '" + email + "'"); // ❌ injectable
```

The only way to reintroduce injection is to hand-build raw SQL strings yourself. Don't.

### Secrets Management — Never Commit Connection Strings or Signing Keys

Same rule as `.env` files in `.gitignore`, with first-class tooling.

```bash
# Local dev — stored OUTSIDE the repo, in your user profile. Like an untracked .env.
dotnet user-secrets init
dotnet user-secrets set "Jwt:SigningKey" "a-real-long-random-key-at-least-32-bytes"
dotnet user-secrets set "ConnectionStrings:Default" "Host=...;Password=..."
```

```csharp
// Read them the normal way — user-secrets layer over appsettings in Development.
var signingKey = builder.Configuration["Jwt:SigningKey"];
```

| Environment | Where secrets live |
|---|---|
| Local dev | `dotnet user-secrets` (outside the repo) |
| CI | masked pipeline / GitHub Actions secrets |
| Production | environment variables, Azure Key Vault, AWS Secrets Manager |

What goes in `appsettings.json` and is committed: structure and non-secret values (issuer, audience, token lifetimes). What never gets committed: the signing key, DB password, any API secret.

---

## Gotchas for JS/TS Developers

| Gotcha | What bites you | Fix |
|---|---|---|
| Middleware order | `UseAuthorization()` before `UseAuthentication()` → every protected route 401s with a valid token | Authentication first, always |
| `ClockSkew` | tokens stay valid ~5 min past `exp` by default | set `ClockSkew = TimeSpan.FromSeconds(30)` |
| Claim type remapping | `User.FindFirst("sub")` returns null because it was remapped to a long URI | use `ClaimTypes.*` constants, or clear `DefaultInboundClaimTypeMap` |
| Short signing key | HS256 key < 32 bytes throws `IDX10720` at startup | use a 32+ byte random key |
| 401 vs 403 | returning 401 when the user *is* logged in but lacks permission | `Forbid()` (403) for permission, `Challenge()` (401) for no identity |
| Refresh tokens as JWTs | making refresh tokens JWTs means you can't revoke them | use opaque random strings stored (hashed) in the DB |
| Storing raw refresh tokens | DB leak = instant account takeover | hash with SHA-256 before storing, look up by hash |
| `[AllowAnonymous]` precedence | expecting controller-level `[Authorize]` to win | `[AllowAnonymous]` always overrides it |
| CORS `*` + credentials | runtime throw, or silent CORS failures in the browser | name explicit origins when allowing credentials |
| Rolling your own hashing | reinventing salt/iterations badly | use Identity's `UserManager` / `IPasswordHasher<T>` |

---

## Phase 5 Project — Add Auth to the Clean Architecture API

**Goal:** Bolt a complete auth flow onto the Phase 4 Clean Architecture project — register, login, refresh-token rotation, and protected endpoints with roles.

Respect the layer boundaries from Phase 4 (Domain ← Application ← Infrastructure, Presentation on top):

**Domain layer**
- Add a `RefreshToken` entity (fields from 5.2: `TokenHash`, `ExpiresAt`, `RevokedAt`, `ReplacedByTokenHash`, `IsActive`).
- Define `ITokenService` and `IPasswordHasher` (or lean on Identity's) as interfaces here.

**Application layer**
- Commands/queries via MediatR (Phase 4.4): `RegisterCommand`, `LoginCommand`, `RefreshTokenCommand`, `RevokeTokenCommand`.
- DTOs: `AuthResult(AccessToken, RefreshToken)`, `LoginDto`, `RegisterDto`.
- FluentValidation validators for the DTOs (email format, password length).

**Infrastructure layer**
- `TokenService : ITokenService` using `JsonWebTokenHandler` (5.2).
- Wire up `AddIdentityCore<AppUser>()` + `AddEntityFrameworkStores` for the user store + password hashing (5.3).
- `RefreshToken` entity configuration + a migration (`dotnet ef migrations add AddAuth`).
- Configure JwtBearer with `TokenValidationParameters` (5.2).

**Presentation layer**
- Thin `AuthController` (calls MediatR only):
  - `POST /api/auth/register` → 201, creates user, returns token pair.
  - `POST /api/auth/login` → 200, returns `{ accessToken, refreshToken }`.
  - `POST /api/auth/refresh` → 200, rotates and returns a new pair.
  - `POST /api/auth/logout` → 204, revokes the presented refresh token.
- Protect a business controller: `[Authorize]` on the class, `[Authorize(Roles = "Admin")]` on destructive actions, one resource-based check via `IAuthorizationService`.
- Pipeline order in `Program.cs`: `UseHttpsRedirection` → `UseCors` → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization` → `MapControllers`.

**Steps / hints**
1. `dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer` and `Microsoft.AspNetCore.Identity.EntityFrameworkCore` in Infrastructure.
2. `dotnet user-secrets set "Jwt:SigningKey" "<32+ byte random>"` — keep it out of git.
3. Bind `JwtSettings` via the options pattern; inject `IOptions<JwtSettings>` into `TokenService`.
4. Seed two roles (`Admin`, `User`) in a startup seeder; assign `User` on register.
5. Add `[EnableRateLimiting("auth")]` to `login`/`refresh`.
6. Test the full loop with `curl`/REST client: register → login → call a protected route → let the access token expire → refresh → confirm the old refresh token is now rejected.

**Acceptance check:** A valid access token reaches protected endpoints; an expired one 401s; refresh issues a new pair and invalidates the old refresh token; an Admin-only route 403s for a normal user.

---

## Summary

| Concept | C# / ASP.NET Core | Node.js / Express Equivalent |
|---|---|---|
| Verify token, set user | JwtBearer handler + `UseAuthentication()` | `passport-jwt` strategy |
| Current user | `HttpContext.User` (`ClaimsPrincipal`) | `req.user` |
| Gate a route | `[Authorize]` attribute | `requireAuth` middleware |
| Open a route back up | `[AllowAnonymous]` | skip the middleware |
| Sign a token | `JsonWebTokenHandler.CreateToken()` | `jwt.sign()` |
| Verify rules | `TokenValidationParameters` | options to `jwt.verify()` |
| Role check | `[Authorize(Roles = "Admin")]` | `if (req.user.role !== 'admin')` |
| Rich rules | policies (requirement + handler) | custom middleware |
| Resource ownership check | `IAuthorizationService.AuthorizeAsync` | inline check in handler |
| User store + hashing | ASP.NET Core Identity (`UserManager`) | custom model + `bcrypt` |
| Password hash | PBKDF2 via `IPasswordHasher<T>` | `bcrypt` / `argon2` |
| Refresh tokens | opaque, hashed, rotated in DB | same pattern, hand-rolled |
| Rate limit | `Microsoft.AspNetCore.RateLimiting` | `express-rate-limit` |
| CORS | `AddCors` + `UseCors` | `cors` package |
| Secrets | `dotnet user-secrets` / env / Key Vault | `.env` + `.gitignore` |
| SQL injection safety | EF Core parameterization | parameterized queries / ORM |
