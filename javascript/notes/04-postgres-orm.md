# Phase 4 — PostgreSQL with Prisma & DrizzleORM

---

## 4.1 Prisma — The Modern ORM

### Schema-First vs Code-First

EF Core is **code-first**: you write C# entity classes, decorate them with attributes / Fluent API, and EF reflects over them to build a model. Prisma is **schema-first**: there is one canonical source of truth — `schema.prisma` — and *everything* (the migrations, the typed client, the validation) is generated from it.

```prisma
// prisma/schema.prisma

// 1. Where the generated client goes (the typed query API)
generator client {
  provider = "prisma-client-js"
}

// 2. The datasource — connection string read from env at generate/migrate time
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // never hardcode — read from .env
}

// 3. Models map to tables. This is your "entity" + "DbContext config" in one place.
model User {
  id        Int      @id @default(autoincrement())   // PK, SERIAL/IDENTITY
  email     String   @unique                          // UNIQUE constraint
  name      String?                                   // nullable column (note the ?)
  createdAt DateTime @default(now())                  // DEFAULT now()
  posts     Post[]                                    // 1-to-many navigation (no column)
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int                                        // the actual FK column
  author   User   @relation(fields: [authorId], references: [id])  // navigation + FK mapping
}
```

**Mental mapping to EF Core:**

| Prisma | EF Core |
|--------|---------|
| `model User { ... }` | `public class User { ... }` + `DbSet<User>` |
| `@id` | `[Key]` / `HasKey()` |
| `@unique` | `[Index(IsUnique = true)]` / `HasIndex().IsUnique()` |
| `@default(now())` | `HasDefaultValueSql("now()")` |
| `String?` | `string?` (nullable reference type) |
| `@relation(fields:..., references:...)` | `HasOne().WithMany().HasForeignKey()` |
| `posts Post[]` | `public List<Post> Posts { get; set; }` |

The big difference: in EF Core the *types* are the source of truth and the DB schema is derived. In Prisma the *schema file* is the source of truth and the TypeScript types are derived. You never hand-write a DTO that mirrors a table — Prisma generates exact types.

### Migrations — `migrate dev` vs `migrate deploy`

This maps almost 1:1 onto the EF CLI:

```bash
# Create + apply a migration in development.
# Generates SQL from the schema diff, applies it, regenerates the client.
npx prisma migrate dev --name add_posts_table
# ≈ dotnet ef migrations add AddPostsTable  +  dotnet ef database update

# Apply already-created migrations in production. NO schema diffing, NO client gen.
# Idempotent: runs only pending migrations from prisma/migrations/.
npx prisma migrate deploy
# ≈ dotnet ef database update (against prod) — but never generates new migrations

# Push schema to DB WITHOUT a migration file (prototyping only — like EnsureCreated)
npx prisma db push

# Regenerate the typed client after editing schema.prisma (no DB touch)
npx prisma generate
```

`migrate dev` is **development-only** and will, if it detects drift, offer to reset (drop) the database. Never run it against production. `migrate deploy` is the production command — it only forward-applies committed migration files and never resets.

A generated migration is plain SQL you can read and review (unlike EF's C# migration classes):

```sql
-- prisma/migrations/20260616_add_posts_table/migration.sql
CREATE TABLE "Post" (
    "id"       SERIAL NOT NULL,
    "title"    TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT;
```

### `PrismaClient` ≈ `DbContext`

`PrismaClient` is the typed query gateway. It is the closest thing to `DbContext` — but it is **not** a unit of work / change tracker. EF Core tracks loaded entities and computes a diff on `SaveChanges()`. Prisma has **no change tracker**: every method (`update`, `create`, ...) is an explicit, immediate statement. There is no `SaveChanges()`.

```ts
import { PrismaClient } from '@prisma/client';

// ONE instance per process. It owns the connection pool.
// Creating many instances = exhausting Postgres connections (classic mistake).
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({ where: { id: 1 } });
// ^ TS knows this is `User | null` — inferred straight from the schema model
```

```ts
// Singleton pattern (important in dev with hot-reload — avoids leaking clients)
// globalThis trick: survive module reloads so you don't open a new pool each save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['query', 'warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Type Inference — No Manual DTOs

In EF Core you often write DTOs and `.Select(x => new UserDto { ... })` projections. Prisma infers the exact result shape from your query at compile time. The shape *changes* based on `select` / `include`:

```ts
// Result type is { id: number; email: string } — ONLY the fields you selected.
const partial = await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, email: true },
});
// partial.name → TS ERROR: Property 'name' does not exist. It wasn't selected.

// Helper types when you DO need a named type for a function boundary:
import { Prisma } from '@prisma/client';

type UserWithPosts = Prisma.UserGetPayload<{ include: { posts: true } }>;
// ^ exact type of a user-with-posts query — your hand-written-DTO replacement
```

### Prisma vs EF Core — Key Differences

| Aspect | EF Core | Prisma |
|--------|---------|--------|
| Source of truth | C# classes | `schema.prisma` |
| Change tracking | Yes (`SaveChanges` diffs) | No — every op is explicit SQL |
| Lazy loading | Optional (proxies) | None — you must `include` |
| LINQ provider | Full LINQ → SQL translation | Fixed query API (no arbitrary expressions) |
| Unit of Work | `DbContext` is the UoW | `$transaction` is the UoW |
| Raw escape hatch | `FromSqlRaw` | `$queryRaw` / `$executeRaw` |
| Migrations format | C# migration classes | Plain `.sql` files |
| Type generation | Compile-time (your classes) | Codegen step (`prisma generate`) |

The mental shift: Prisma is **not** an expression-tree ORM. There is no `Where(x => x.Age > 18 && SomeCSharpMethod(x))`. You build query *objects*, and anything the query API can't express, you drop to raw SQL. This is intentional — it keeps the generated SQL predictable.

---

## 4.2 Prisma CRUD & Relations

### The Read Methods

```ts
// findUnique — by a UNIQUE field only (PK or @unique). Returns T | null.
// Uses an index → fastest. ≈ context.Users.FindAsync(1)
const u1 = await prisma.user.findUnique({ where: { id: 1 } });

// findUniqueOrThrow — throws P2025 if not found (saves the null check)
const u2 = await prisma.user.findUniqueOrThrow({ where: { id: 1 } });

// findFirst — first row matching ANY filter (not just unique). T | null.
// ≈ context.Users.FirstOrDefaultAsync(x => x.Name == "Alice")
const u3 = await prisma.user.findFirst({
  where: { name: 'Alice' },
  orderBy: { createdAt: 'desc' },
});

// findMany — the list query. ≈ context.Users.Where(...).ToListAsync()
const users = await prisma.user.findMany({
  where: {
    email: { endsWith: '@asthait.com' },   // LIKE '%@asthait.com'
    posts: { some: { title: { contains: 'Prisma' } } },  // EXISTS subquery
  },
  orderBy: { createdAt: 'desc' },
  skip: 20,        // OFFSET
  take: 10,        // LIMIT  (your Skip().Take())
});
```

### Create, Update, Upsert, Delete

```ts
// CREATE
const created = await prisma.user.create({
  data: { email: 'a@b.com', name: 'Alice' },
});

// UPDATE — by unique where. Throws P2025 if the row doesn't exist.
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Alice B.' },
});

// UPDATE MANY — bulk, returns { count }, no entities returned
const { count } = await prisma.user.updateMany({
  where: { name: null },
  data: { name: 'Anonymous' },
});

// UPSERT — insert or update in one statement (Postgres ON CONFLICT under the hood)
const upserted = await prisma.user.upsert({
  where: { email: 'a@b.com' },        // the conflict target (must be unique)
  create: { email: 'a@b.com', name: 'New' },  // run if not found
  update: { name: 'Existing Updated' },         // run if found
});

// DELETE
await prisma.user.delete({ where: { id: 1 } });
```

### Nested Writes — Create With Relations in One Query

EF Core lets you add a parent with children in its object graph and `SaveChanges` walks it. Prisma does this with a **nested write** — one transaction, no manual FK juggling:

```ts
const userWithPosts = await prisma.user.create({
  data: {
    email: 'author@example.com',
    name: 'Author',
    posts: {
      create: [                          // INSERT children, FK auto-wired
        { title: 'First post' },
        { title: 'Second post' },
      ],
    },
  },
  include: { posts: true },              // return the created children too
});
// Prisma wraps the inserts in an implicit transaction automatically.

// connect — link to an EXISTING related row instead of creating one
await prisma.post.create({
  data: {
    title: 'Linked',
    author: { connect: { id: 1 } },      // set authorId = 1
  },
});

// connectOrCreate — connect if exists, else create (common for tags/categories)
await prisma.post.create({
  data: {
    title: 'Tagged',
    author: { connectOrCreate: {
      where: { email: 'author@example.com' },
      create: { email: 'author@example.com', name: 'Author' },
    } },
  },
});
```

### `include` (eager loading) vs `select` (projection)

```ts
// include → load relations alongside ALL scalar fields of the parent.
// ≈ context.Users.Include(u => u.Posts)
const withPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true },
});
// Type: User & { posts: Post[] }

// select → projection: pick EXACTLY which fields (and relations) come back.
// ≈ .Select(u => new { u.Email, Posts = ... })
const projected = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    email: true,
    posts: { select: { title: true } },   // nested projection
  },
});
// Type: { email: string; posts: { title: string }[] }
```

Rule: `select` and `include` are **mutually exclusive at the same level** (you either pick fields or take all-plus-relations). Use `select` for read endpoints to avoid over-fetching; use `include` when you genuinely need the whole entity.

### The N+1 Problem — Concrete Example and Fix

N+1 happens the same way it does in EF Core: a loop that lazily/repeatedly hits the DB once per parent.

```ts
// ❌ N+1: 1 query for users + 1 query PER user for their posts = N+1 round trips
const users = await prisma.user.findMany();          // SELECT * FROM "User"  (1)
for (const u of users) {
  const posts = await prisma.post.findMany({         // SELECT ... WHERE authorId=$1
    where: { authorId: u.id },                       // runs N times!
  });
  console.log(u.email, posts.length);
}
```

```ts
// ✅ FIX 1: include — Prisma batches relation loading.
// Emits ~2 queries total: users, then posts WHERE authorId IN (...).
const usersWithPosts = await prisma.user.findMany({
  include: { posts: true },
});
for (const u of usersWithPosts) {
  console.log(u.email, u.posts.length);   // already loaded — zero extra queries
}
```

The SQL Prisma actually emits for the fix (it does NOT do a giant JOIN — it does a second batched query, which avoids row-multiplication / cartesian blowup):

```sql
SELECT "id", "email", "name" FROM "User";
SELECT "id", "title", "authorId" FROM "Post"
  WHERE "authorId" IN ($1, $2, $3, ...);   -- one round trip for ALL children
```

```ts
// ✅ FIX 2 (if you only need an aggregate): groupBy / _count instead of loading rows
const counts = await prisma.post.groupBy({
  by: ['authorId'],
  _count: { _all: true },
});
// One query, no post bodies loaded. Like a GROUP BY in EF.

// You can also get relation counts inline:
const withCounts = await prisma.user.findMany({
  select: { id: true, _count: { select: { posts: true } } },
});
// each row: { id, _count: { posts: number } }
```

### `$transaction` — Atomic Operations

EF Core scopes a transaction around a `SaveChangesAsync()` (or an explicit `BeginTransaction`). Prisma offers two flavours:

```ts
// 1. Array form — runs each op in ONE transaction, returns results in order.
//    All succeed or all roll back. Great for independent writes.
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'x@y.com', name: 'X' } }),
  prisma.post.create({ data: { title: 'Hi', authorId: 1 } }),
]);
```

```ts
// 2. Interactive form — a callback receiving a transactional client `tx`.
//    Use when later writes DEPEND on earlier reads (e.g. check stock, then decrement).
const result = await prisma.$transaction(async (tx) => {
  const account = await tx.account.findUniqueOrThrow({ where: { id: 1 } });
  if (account.balance < 100) {
    throw new Error('Insufficient funds');   // throwing rolls the whole thing back
  }
  await tx.account.update({ where: { id: 1 }, data: { balance: { decrement: 100 } } });
  await tx.account.update({ where: { id: 2 }, data: { balance: { increment: 100 } } });
  return 'transferred';
}, {
  isolationLevel: 'Serializable',   // map to PG isolation levels when needed
  timeout: 5000,                    // ms; interactive txns hold a connection — keep short
});
```

**Gotcha:** an interactive transaction holds a pooled connection open for its whole duration. Never do slow network calls (HTTP, email) inside `$transaction` — you'll exhaust the pool. Do the I/O outside, the DB writes inside.

---

## 4.3 Prisma Advanced

### Raw SQL — `$queryRaw` and `$executeRaw`

When the query API can't express something (window functions, CTEs, full-text), drop to raw SQL. The tagged-template versions are **parameterised** (safe against injection) — the interpolations become `$1`, `$2` placeholders, not string concatenation.

```ts
import { Prisma } from '@prisma/client';

// $queryRaw — returns rows. Tagged template = parameterised & safe.
const email = "a@b.com'; DROP TABLE users; --";    // malicious input
const rows = await prisma.$queryRaw<{ id: number; email: string }[]>`
  SELECT id, email FROM "User" WHERE email = ${email}
`;
// Sent as: SELECT ... WHERE email = $1  with $1 bound separately. Injection impossible.

// $executeRaw — for writes; returns the affected row COUNT (number), not rows.
const affected = await prisma.$executeRaw`
  UPDATE "User" SET name = 'Anon' WHERE name IS NULL
`;

// Building dynamic SQL safely with Prisma.sql / Prisma.join (NOT string concat):
const ids = [1, 2, 3];
const dynamic = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE id IN (${Prisma.join(ids)})
`;
```

```ts
// ⚠️ The Unsafe variants exist but take a plain string — YOU must sanitise.
// Avoid unless you fully control the input. This is the injection footgun:
await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE id = ${userInput}`); // ❌ danger
```

`$queryRaw` is your `FromSqlInterpolated` / `FromSqlRaw` from EF Core. Same trade-off: you lose Prisma's result-type inference (hence the explicit `<...>` generic) and must keep the SQL DB-specific.

### Client Extensions (the modern replacement for middleware)

Older Prisma had `$use()` middleware (Express-style `(params, next) => ...`). It still works but is **deprecated** in favour of **Client Extensions** (TS 5 based, fully typed). Use extensions for new code.

```ts
// Extend the `query` component to intercept every operation on every model.
const extended = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        const result = await query(args);              // run the real query
        const ms = (performance.now() - start).toFixed(1);
        console.log(`${model}.${operation} took ${ms}ms`);
        return result;
      },
    },
  },
});
// `extended` is a NEW client; use it instead of `prisma`. The base client is untouched.
```

```ts
// Add computed fields and custom model methods — fully typed, no codegen:
const withExtras = prisma.$extends({
  result: {
    user: {
      // a virtual field derived from existing ones
      fullLabel: {
        needs: { name: true, email: true },
        compute(user) { return `${user.name} <${user.email}>`; },
      },
    },
  },
  model: {
    user: {
      async findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });  // custom repo-like method
      },
    },
  },
});
```

### Soft Deletes

A soft delete sets a `deletedAt` flag instead of physically deleting, and silently filters out "deleted" rows on reads. The clean way is an extension that rewrites `delete` → `update` and injects a `WHERE deletedAt IS NULL` filter on finds.

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  deletedAt DateTime?           // null = alive, timestamp = soft-deleted
}
```

```ts
const softDelete = prisma.$extends({
  query: {
    user: {
      // turn delete into an update
      async delete({ args, query }) {
        // @ts-expect-error rewriting delete to update payload
        return prisma.user.update({ ...args, data: { deletedAt: new Date() } });
      },
      // auto-filter dead rows from reads
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
    },
  },
});
```

This mirrors EF Core's **global query filters** (`HasQueryFilter(e => e.DeletedAt == null)`). The key caution is the same in both worlds: the filter must be applied *everywhere*, and you need an escape hatch (a separate client / `IgnoreQueryFilters`) to read deleted rows for audits.

### Connection Pooling — PgBouncer / Accelerate

`PrismaClient` already maintains its own pool (default size ≈ `num_cpus * 2 + 1`). The problem is **serverless / many-instances**: every Lambda or container opens its own pool, and Postgres has a hard `max_connections` (often ~100). 50 containers × 10 connections = pool exhaustion.

```bash
# Set pool size on the connection string
DATABASE_URL="postgresql://u:p@host:5432/db?connection_limit=10&pool_timeout=20"
```

```bash
# Through PgBouncer (transaction-mode pooling), you MUST disable prepared statements,
# because PgBouncer in transaction mode can't keep server-side prepared stmts pinned.
DATABASE_URL="postgresql://u:p@pgbouncer:6432/db?pgbouncer=true"
```

```ts
// Prisma Accelerate — a managed connection pool + global cache in front of your DB.
// Use the accelerate extension; great for serverless to collapse N pools into one.
import { withAccelerate } from '@prisma/extension-accelerate';
const prisma = new PrismaClient().$extends(withAccelerate());

const users = await prisma.user.findMany({
  cacheStrategy: { ttl: 60 },   // cache this query for 60s at the edge
});
```

The .NET parallel: ADO.NET / Npgsql also pools per process, and you'd put PgBouncer in front for the same serverless fan-out reason. The advice is identical: **keep per-instance pools small, pool externally when you scale horizontally.**

---

## 4.4 DrizzleORM — The SQL-First Alternative

### Why Drizzle

Prisma generates a query engine (a Rust binary) and a heavy client; it abstracts SQL away. **Drizzle** is the opposite philosophy: a thin, fully type-safe SQL query builder that *looks like SQL*, ships as pure TypeScript (no binary engine, tiny bundle), and runs everywhere including edge runtimes.

| | Prisma | Drizzle |
|---|--------|---------|
| Philosophy | ORM abstraction over SQL | SQL, but type-safe |
| Runtime | Rust query engine binary | Pure TS, no binary |
| Bundle / cold start | Heavier | Tiny — edge-friendly |
| Learning curve | Lower (don't need SQL) | Need to know SQL |
| Query shape | Object API | SQL-like builder |
| Migrations | `prisma migrate` | `drizzle-kit` |

### Schema in TypeScript (`pgTable`)

Drizzle's schema is *code*, defined with table builders — closer to EF Core's Fluent API than to Prisma's DSL:

```ts
import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),                                // nullable by default
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),  // FK + cascade
}, (table) => ({
  authorIdx: index('posts_author_idx').on(table.authorId),  // explicit index
}));

// Inferred row types — your "entities", derived from the table definitions:
export type User = typeof users.$inferSelect;   // shape when SELECTing
export type NewUser = typeof users.$inferInsert; // shape when INSERTing (optional defaults)
```

### Migrations with `drizzle-kit`

```bash
# Generate SQL migration from the TS schema diff (like prisma migrate dev's diff step)
npx drizzle-kit generate

# Apply pending migrations to the DB
npx drizzle-kit migrate

# push (prototype, no migration file — like prisma db push)
npx drizzle-kit push
```

### Query Builder API vs ORM (Relational) API

Drizzle gives you **two** ways to read. The SQL-like builder, and a Prisma-ish relational API.

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from './schema';

const db = drizzle(pool, { schema });

// (A) Query-builder API — reads almost exactly like the SQL it generates:
const rows = await db
  .select({ id: users.id, email: users.email })   // projection
  .from(users)
  .where(and(eq(users.name, 'Alice'), sql`${users.createdAt} > now() - interval '7 days'`))
  .orderBy(desc(users.createdAt))
  .limit(10);
// SQL: SELECT id, email FROM users WHERE name = $1 AND created_at > ... ORDER BY ... LIMIT 10

// Explicit JOIN — you control it (no hidden second query):
const joined = await db
  .select({ email: users.email, title: posts.title })
  .from(users)
  .innerJoin(posts, eq(posts.authorId, users.id));

// (B) Relational query API — declarative, Prisma-like, avoids N+1 for you:
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },        // ≈ Prisma's include
  where: (u, { eq }) => eq(u.name, 'Alice'),
});
```

```ts
// Writes are equally explicit:
await db.insert(users).values({ email: 'a@b.com', name: 'Alice' });
await db.update(users).set({ name: 'Alice B.' }).where(eq(users.id, 1));
await db.delete(users).where(eq(users.id, 1));

// Transactions — callback style, like Prisma's interactive txn:
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql`balance - 100` }).where(eq(accounts.id, 1));
  await tx.update(accounts).set({ balance: sql`balance + 100` }).where(eq(accounts.id, 2));
});
```

### When to Prefer Drizzle over Prisma

- **Edge / serverless** where cold-start and bundle size matter (no Rust engine to ship).
- You **know SQL well** and want the generated SQL to be obvious and controllable.
- Heavy use of **complex SQL** (CTEs, window functions, weird joins) — Drizzle's `sql` template makes this first-class instead of a raw-SQL escape hatch.
- You want zero codegen step (types are inferred directly from the TS schema).

**Prefer Prisma** when you want the gentler abstraction, richer tooling (Studio, migration UX), nested-write ergonomics, and your team is less SQL-fluent. For this learning track and the Phase 5 NestJS work, Prisma is the default — but knowing Drizzle's model makes you better at *both*.

---

## 4.5 PostgreSQL Features Worth Using

These are DB-level features. Most are reached via raw SQL in Prisma, or `sql` in Drizzle.

### JSONB — Query and Index

`JSONB` stores JSON in a binary, indexable form. Use it for flexible/semi-structured columns (settings, metadata) — but don't use it as an excuse to avoid real columns.

```sql
-- A table with a JSONB column
CREATE TABLE products (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  attrs JSONB NOT NULL DEFAULT '{}'   -- e.g. {"color":"red","sizes":["S","M"]}
);

-- Operators:
SELECT * FROM products WHERE attrs->>'color' = 'red';      -- ->>  = text value
SELECT * FROM products WHERE attrs->'sizes' @> '"M"';      -- @>   = "contains"
SELECT * FROM products WHERE attrs ? 'color';              -- ?    = key exists

-- GIN index makes containment (@>) and key-exists (?) queries fast:
CREATE INDEX products_attrs_gin ON products USING GIN (attrs);
```

```prisma
// Prisma maps JSONB to the Json type and offers typed JSON filters:
model Product {
  id    Int  @id @default(autoincrement())
  name  String
  attrs Json @default("{}")
}
```

```ts
// Prisma JSON filtering (Postgres):
const red = await prisma.product.findMany({
  where: { attrs: { path: ['color'], equals: 'red' } },
});
```

### Full-Text Search — `tsvector` / `tsquery`

Postgres has built-in full-text search: documents become a `tsvector` (lexemes + positions), queries become a `tsquery`, matched with `@@`.

```sql
-- Ad-hoc search:
SELECT id, title
FROM posts
WHERE to_tsvector('english', title || ' ' || body) @@ to_tsquery('english', 'prisma & orm');

-- For performance: store a generated tsvector column + GIN index
ALTER TABLE posts ADD COLUMN search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED;
CREATE INDEX posts_search_gin ON posts USING GIN (search);

-- Then queries use the index, and you can rank results:
SELECT id, title, ts_rank(search, q) AS rank
FROM posts, to_tsquery('english', 'prisma <-> orm') q   -- <-> = followed-by
WHERE search @@ q
ORDER BY rank DESC;
```

```ts
// Via Prisma raw SQL:
const hits = await prisma.$queryRaw<{ id: number; title: string }[]>`
  SELECT id, title FROM posts
  WHERE search @@ to_tsquery('english', ${query})
  ORDER BY ts_rank(search, to_tsquery('english', ${query})) DESC
  LIMIT 20
`;
```

### CTEs (Common Table Expressions)

`WITH` clauses name a subquery so complex logic reads top-to-bottom. They can be recursive (great for trees/hierarchies).

```sql
-- Non-recursive: readable multi-step query
WITH recent_orders AS (
  SELECT * FROM orders WHERE created_at > now() - interval '30 days'
),
totals AS (
  SELECT customer_id, SUM(total) AS spent
  FROM recent_orders
  GROUP BY customer_id
)
SELECT c.name, t.spent
FROM totals t JOIN customers c ON c.id = t.customer_id
WHERE t.spent > 1000;

-- Recursive: walk a category tree downward from a root
WITH RECURSIVE subtree AS (
  SELECT id, parent_id, name FROM categories WHERE id = 1   -- anchor
  UNION ALL
  SELECT c.id, c.parent_id, c.name
  FROM categories c JOIN subtree s ON c.parent_id = s.id    -- recurse
)
SELECT * FROM subtree;
```

### Window Functions — Running Totals, Rankings

Window functions compute across a set of rows *related to the current row* without collapsing them (unlike `GROUP BY`).

```sql
-- Rank products by revenue within each category
SELECT
  category,
  name,
  revenue,
  RANK()       OVER (PARTITION BY category ORDER BY revenue DESC) AS rank_in_cat,
  SUM(revenue) OVER (PARTITION BY category)                       AS category_total,
  SUM(revenue) OVER (ORDER BY revenue DESC)                       AS running_total
FROM products;
```

`PARTITION BY` = the window group; `ORDER BY` inside `OVER()` defines accumulation order (for running totals). Common functions: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, `SUM()/AVG() OVER(...)`.

### Partial & Composite Indexes

```sql
-- COMPOSITE index — multi-column. Column ORDER matters:
-- this index serves WHERE author_id = ? AND created_at > ?, and WHERE author_id = ?
-- but NOT a query filtering on created_at alone (leftmost-prefix rule).
CREATE INDEX posts_author_created ON posts (author_id, created_at DESC);

-- PARTIAL index — only indexes rows matching a predicate. Smaller, faster, cheaper.
-- Perfect companion to soft deletes: only index live rows.
CREATE INDEX users_active_email ON users (email) WHERE deleted_at IS NULL;

-- Partial unique: "email must be unique AMONG non-deleted users"
CREATE UNIQUE INDEX users_email_unique_active ON users (email) WHERE deleted_at IS NULL;
```

### `EXPLAIN ANALYZE` — Reading Query Plans

`EXPLAIN` shows the planner's intended plan; `EXPLAIN ANALYZE` actually *runs* it and reports real timings + row counts.

```sql
EXPLAIN ANALYZE
SELECT * FROM posts WHERE author_id = 42 ORDER BY created_at DESC LIMIT 10;
```

```
Limit  (cost=0.42..8.91 rows=10 width=...) (actual time=0.03..0.05 rows=10 loops=1)
  ->  Index Scan using posts_author_created on posts
        (actual time=0.02..0.04 rows=10 loops=1)
        Index Cond: (author_id = 42)
Planning Time: 0.10 ms
Execution Time: 0.07 ms
```

What to look for:
- **Seq Scan** on a big table in a hot query → you're missing an index.
- **Index Scan / Index Only Scan** → good, the index is being used.
- **`rows=` estimate vs `actual rows`** wildly off → stale stats; run `ANALYZE table;`.
- **`loops=N`** on an inner node → that's your N+1 / nested-loop blowup signal.

This is exactly the same instinct you'd apply reading a SQL Server execution plan in the .NET world — different output format, identical reasoning.

---

## 4.6 Repository Pattern in TypeScript

### Should You Even Wrap Prisma?

Honest answer, same as EF Core: **Prisma is already a repository + unit of work.** Wrapping it in a generic `IRepository<T>` for its own sake usually *loses* power (you can no longer express `include`/`select`/nested writes through a `findById(id)` signature) and adds indirection.

**Wrap it when** you want a clean Domain boundary (Clean Architecture — Phase 5), to keep the persistence library out of your business logic, to make swapping/mocking trivial in tests, or to centralise cross-cutting query rules. **Use it directly** in small apps, scripts, or read-heavy endpoints where the query shape is the point.

### A Generic Repository with Prisma

```ts
// Domain-facing contract — note it speaks in domain terms, not Prisma terms.
export interface IRepository<T, ID = number> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}
```

```ts
// A concrete repository. Keep ONE per aggregate — don't force everything through
// a single generic base, because each aggregate needs its own meaningful queries.
import { PrismaClient, User, Prisma } from '@prisma/client';

export class UserRepository implements IRepository<User> {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(id: number, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.prisma.user.delete({ where: { id } });
  }

  // Domain-specific queries belong HERE, not leaked into the service layer:
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

This is the same shape as a .NET `IRepository<T>` over `DbSet<T>` — and the same advice holds: prefer **specific** repositories per aggregate (`IUserRepository`) over a single leaky generic one.

### Unit of Work — Wrapping `$transaction`

EF Core's `DbContext` *is* the Unit of Work; `SaveChanges` commits. With Prisma, the Unit of Work is the **interactive `$transaction`**: it hands you a transactional client (`tx`) that all repositories must use, so multiple repository calls commit atomically.

```ts
export class UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  // Run a batch of repository operations inside ONE transaction.
  // The callback receives transaction-scoped repositories.
  async execute<T>(
    work: (repos: { users: UserRepository; posts: PostRepository }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Build repos bound to the transactional client `tx` (typed as PrismaClient).
      const txClient = tx as unknown as PrismaClient;
      return work({
        users: new UserRepository(txClient),
        posts: new PostRepository(txClient),
      });
    });
  }
}

// Usage — both writes commit together or roll back together:
await uow.execute(async ({ users, posts }) => {
  const user = await users.create({ email: 'a@b.com', name: 'A' });
  await posts.create({ title: 'Hello', author: { connect: { id: user.id } } });
});
```

The key insight that maps straight from .NET: **the repositories must share the same transactional client** for atomicity. In Prisma that's the `tx` from `$transaction`; in EF Core it's the shared `DbContext`. Pass it in; don't let each repository open its own connection.

---

## Gotchas

- **No `SaveChanges()`** — Prisma has no change tracker. Every `create`/`update` is an immediate statement. Don't go looking for a "commit" call; there isn't one outside `$transaction`.
- **One `PrismaClient` per process.** Instantiating per-request exhausts Postgres connections. Use a singleton; in dev with hot-reload, stash it on `globalThis`.
- **`select` and `include` are mutually exclusive at the same level.** Pick fields *or* take-all-plus-relations — you can't do both in one object.
- **`findUnique` only accepts unique fields.** To filter on a non-unique field, use `findFirst`. Passing a non-unique `where` to `findUnique` is a type error.
- **Interactive `$transaction` holds a connection.** No HTTP/email/slow I/O inside it — do that work outside the transaction or you'll starve the pool.
- **`$queryRawUnsafe` / `$executeRawUnsafe` take raw strings — injection risk.** Prefer the tagged-template `$queryRaw` (parameterised). Use `Prisma.join` for `IN (...)`, never string concat.
- **PgBouncer transaction mode needs `?pgbouncer=true`** (disables prepared statements), or you'll get cryptic "prepared statement already exists" errors.
- **`updateMany`/`deleteMany` return `{ count }`, not entities** — they don't load rows. Reach for them for bulk ops; use `update`/`delete` when you need the row back.
- **`update` on a missing row throws `P2025`.** Use `upsert` if "create-or-update" is the intent, or catch the Prisma error code.
- **JSONB `->>` returns text, `->` returns JSON.** Comparing `attrs->'n' = 5` fails (json vs int); use `(attrs->>'n')::int = 5`.
- **Composite index leftmost-prefix rule.** An index on `(a, b)` helps `WHERE a` and `WHERE a AND b`, but NOT `WHERE b` alone — same as SQL Server.
- **Drizzle vs Prisma migration files are not interchangeable.** Pick one migration tool per project; don't mix `prisma migrate` and `drizzle-kit` against the same DB.
- **Decimal/BigInt come back as special types**, not JS `number` (`Prisma.Decimal`, `bigint`). Don't blindly `JSON.stringify` a `bigint` — it throws. Money should be `Decimal`, never float.

---

## Phase 4 Mini-Project

**Task:** Build a **Products + Orders API** backed by PostgreSQL + Prisma, with migrations, full CRUD, N+1-free queries, and a raw-SQL reporting endpoint.

**Location:** `examples/phase4-products-orders/`

### Domain

```prisma
// prisma/schema.prisma — model it like this:
model Product {
  id        Int         @id @default(autoincrement())
  name      String
  price     Decimal     @db.Decimal(10, 2)   // money → Decimal, NOT Float
  stock     Int         @default(0)
  deletedAt DateTime?                          // soft delete
  items     OrderItem[]
  createdAt DateTime    @default(now())
}

model Order {
  id        Int         @id @default(autoincrement())
  customer  String
  status    OrderStatus @default(PENDING)
  items     OrderItem[]
  createdAt DateTime    @default(now())
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  unitPrice Decimal @db.Decimal(10, 2)         // snapshot price at order time
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])

  @@index([orderId])     // FK lookups
  @@index([productId])
}

enum OrderStatus { PENDING PAID SHIPPED CANCELLED }
```

### Requirements

1. **Migrations:** initialise with `prisma migrate dev --name init`. Commit the generated SQL.
2. **Products CRUD:** `POST/GET/GET:id/PATCH/DELETE` — `DELETE` is a **soft delete** (set `deletedAt`), and list/get must filter out soft-deleted rows (use a Client Extension so the filter is automatic).
3. **Create order (nested write + transaction):** `POST /orders` accepts `{ customer, items: [{ productId, quantity }] }`. In **one interactive `$transaction`**:
   - read each product, check `stock >= quantity` (throw → rollback if not),
   - snapshot `unitPrice` from the product,
   - `decrement` stock,
   - create the `Order` with nested `OrderItem` creates.
4. **N+1-free list:** `GET /orders` returns each order with its items and product names in **≤ 2 queries** — use `include` (verify with `log: ['query']` that you don't see one query per order).
5. **Reporting endpoint (raw SQL):** `GET /reports/top-products` returns the top 5 products by revenue in the last 30 days, using a **window function or `GROUP BY` with a CTE** via `$queryRaw`. Example shape of the query:

```ts
const report = await prisma.$queryRaw<{ id: number; name: string; revenue: Prisma.Decimal }[]>`
  WITH recent AS (
    SELECT oi.product_id, oi.quantity * oi.unit_price AS line_total
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi.order_id
    WHERE o.created_at > now() - interval '30 days'
      AND o.status IN ('PAID','SHIPPED')
  )
  SELECT p.id, p.name, SUM(r.line_total) AS revenue
  FROM recent r JOIN "Product" p ON p.id = r.product_id
  GROUP BY p.id, p.name
  ORDER BY revenue DESC
  LIMIT 5
`;
```

### Hints

- One `PrismaClient` singleton, exported from `db.ts`. Turn on `log: ['query']` while developing so you can *see* the SQL and catch N+1.
- Validate request bodies with `zod` (from Phase 2/3) before they reach Prisma.
- Add a **partial unique/index** for soft delete if you need name uniqueness among live products: `WHERE "deletedAt" IS NULL`.
- For the order transaction, do all reads + writes inside the `$transaction` callback; do nothing slow (no HTTP) in there.
- Run `EXPLAIN ANALYZE` on the reporting query against seeded data; add an index on `OrderItem(order_id)` / `Order(created_at)` and confirm the plan switches off a Seq Scan.
- **Stretch:** rebuild just the `GET /orders` and the report in **Drizzle** alongside the Prisma version, and compare the generated SQL and the bundle size. This sets you up to make an informed Prisma-vs-Drizzle call in Phase 5.

---

## Interview Questions

### Prisma

1. What is the fundamental difference between a schema-first ORM like Prisma and a code-first ORM like EF Core, and what are the practical trade-offs of each approach?
2. Why does Prisma not have a change tracker or a `SaveChanges()` equivalent, and how does this affect how you reason about data consistency across multiple operations?
3. What happens when you call `prisma.user.findUnique()` with a field that is not marked `@unique` or `@id` in the schema?
4. Why should you never instantiate a new `PrismaClient` on every request, and what exact Postgres resource gets exhausted when you do?
5. Explain the `globalThis` singleton pattern used for `PrismaClient` in hot-reload environments — what problem does it solve and why does module re-evaluation cause it?
6. What is the difference between `findFirst` and `findUnique`, and in what situations would using `findFirst` with a unique field be a subtle mistake?
7. How does Prisma infer the TypeScript return type of a query, and how does using `select` vs `include` change the inferred type at compile time?
8. What is `Prisma.UserGetPayload<...>` used for, and when would you need it over letting TypeScript infer the type directly from the query call?
9. What SQL does Prisma actually emit when you use `include: { posts: true }` on a `findMany` — is it a JOIN or a second query — and what is the reason for that design choice?
10. What is the difference between `connect`, `create`, and `connectOrCreate` in a nested write, and when would you choose `connectOrCreate` over `upsert`?
11. Why are `select` and `include` mutually exclusive at the same nesting level in Prisma, and how do you do a nested projection when you need both a scalar field selection and a relation?
12. How does `upsert` differ from calling `findUnique` followed by `create` or `update` manually, and what Postgres construct does it map to under the hood?
13. What does `updateMany` return, and why does it not return the updated rows — what are the performance implications of this design?
14. What is the Prisma error code `P2025`, when is it thrown, and how would you distinguish it from a generic unexpected error in a catch block?
15. How do Client Extensions differ from the deprecated `$use()` middleware, and what specific advantages do they offer in terms of type safety?
16. How would you implement a global soft-delete filter using a Prisma Client Extension, and what escape hatch would you need for admin endpoints that must see deleted rows?
17. Why does a PgBouncer connection string require `?pgbouncer=true` in Prisma, and what specifically breaks without that flag when using transaction-mode pooling?
18. What is the default connection pool size Prisma uses, and how would you tune it for a serverless environment with many short-lived instances?

### Migrations

19. What is the exact difference between `prisma migrate dev` and `prisma migrate deploy`, and why is it dangerous to run `migrate dev` against a production database?
20. What does `prisma db push` do, when is it appropriate to use it, and what data-safety risk does it carry compared to `migrate dev`?
21. If you run `prisma migrate dev` and Prisma detects schema drift (the DB state doesn't match the migration history), what does it offer to do and why is that dangerous?
22. How does Prisma track which migrations have already been applied to a database, and what happens if someone manually modifies a migration SQL file after it has been applied?
23. When would you manually edit a generated migration SQL file, and what risks does that introduce?
24. How would you handle a migration that requires a data backfill — for example, splitting a `name` column into `firstName` and `lastName` — safely in production with zero downtime?
25. What is the `prisma generate` command, when must you run it, and what happens to your application if you skip it after changing `schema.prisma`?
26. How do Prisma migration files differ from EF Core migration classes, and what are the practical maintenance trade-offs between plain SQL migration files and C# migration code?
27. How would you roll back a Prisma migration in production, and why doesn't Prisma have an automatic "down" migration unlike EF Core's `migrations remove`?

### Transactions & Concurrency

28. What is the difference between the array form and the interactive callback form of `prisma.$transaction`, and when must you use the interactive form?
29. Why is it a serious mistake to perform a slow HTTP call (for example, sending an email) inside a `prisma.$transaction` callback, and what is the correct pattern instead?
30. What does the `isolationLevel` option on `prisma.$transaction` map to in Postgres, and in what real-world scenario would you need `Serializable` instead of the default?
31. What is a phantom read, and which Postgres isolation level prevents it?
32. What is the difference between optimistic and pessimistic locking, and how would you implement each pattern with Prisma?
33. How does Postgres handle two concurrent transactions both trying to `UPDATE` the same row — what happens at the database level, and how does that surface in your application code?
34. How would you implement an idempotent order-creation endpoint that prevents double-submission under concurrent requests, using only Prisma and Postgres?
35. In the interactive `$transaction` pattern, you receive a `tx` parameter — why must all repository calls inside that callback use `tx` instead of the global `prisma` client?
36. What is a deadlock in Postgres, how can it occur in a multi-step transaction that updates multiple rows, and how would you detect and prevent it?

### Query Optimization & N+1

37. Describe the N+1 problem precisely: what does the "1" refer to, what does the "N" refer to, and why is it not always caught in development but causes serious performance issues in production?
38. How would you detect an N+1 problem in a Prisma application in production, and what logging or tooling setup would make it visible during development?
39. When Prisma resolves an `include` with a `findMany`, it uses a batched `WHERE id IN (...)` query rather than a JOIN — what specific problem does this solve that a JOIN would not?
40. What is the Prisma `_count` select, how does it avoid loading relation rows, and when is it preferable to `include` + `.length`?
41. How would you use `groupBy` in Prisma to compute aggregated data without loading all rows into memory, and what is the equivalent SQL?
42. If a `select` projection on a Prisma query is missing a field that the calling code later accesses, what happens at compile time vs runtime?
43. What is an index-only scan in Postgres, when does it occur, and how would you design a `select` projection in Prisma to take advantage of it?
44. How would you debug a query that is slow in production but fast in development — what factors differ between environments that affect query performance?
45. What does `EXPLAIN ANALYZE` tell you that `EXPLAIN` alone does not, and which specific nodes in the output indicate a performance problem you should act on?
46. What does the `loops` value in an `EXPLAIN ANALYZE` output signify, and when does a high `loops` value on an inner node indicate an application-level problem rather than a missing index?

### PostgreSQL Internals

47. What is the difference between a B-tree index and a GIN index in Postgres, and for which types of queries is each appropriate?
48. Explain the leftmost-prefix rule for composite indexes — given an index on `(author_id, created_at)`, list all the `WHERE` clauses that can use it and those that cannot.
49. What is a partial index, and what are two concrete scenarios from this file where a partial index is significantly better than a full index?
50. What is the difference between `tsvector` and `tsquery` in Postgres full-text search, and why is storing a generated `tsvector` column preferable to calling `to_tsvector()` inline in the `WHERE` clause?
51. How does a GIN index accelerate JSONB `@>` (containment) queries, and why would a regular B-tree index not work for that operator?
52. What is the difference between `->` and `->>` when querying JSONB columns, and what type error occurs when you forget the distinction in a comparison?
53. What is a CTE (Common Table Expression), and in what situation does using a CTE with `WITH` instead of a subquery affect the query plan in Postgres?
54. What is the difference between `RANK()` and `DENSE_RANK()` window functions — give a concrete example where the results differ?
55. What does `PARTITION BY` do inside an `OVER()` clause, and how is it different from `GROUP BY`?
56. What are the implications of running `ANALYZE table` vs `VACUUM ANALYZE table`, and why might stale statistics cause Postgres to choose a Seq Scan over an index?
57. What is connection multiplexing in PgBouncer's session mode vs transaction mode, and why does transaction mode require disabling prepared statements?
58. How does Postgres `SERIAL` differ from `IDENTITY` columns, and which should you prefer in a new schema and why?
59. What is a covering index in Postgres (`INCLUDE`), and how would you use one to turn an Index Scan into an Index Only Scan for a frequently-run reporting query?
60. What is the MVCC (Multi-Version Concurrency Control) model in Postgres, and why does it mean that `DELETE` does not immediately free disk space?

### DrizzleORM

61. What is the fundamental philosophical difference between Drizzle and Prisma, and how does that difference manifest in the generated bundle size and cold-start behavior?
62. In Drizzle, what is the difference between `$inferSelect` and `$inferInsert` on a table definition, and why do they produce different types?
63. How does Drizzle's query-builder API map to SQL — if you write `.select().from().where().orderBy().limit()`, what does each method correspond to in the generated SQL?
64. What is Drizzle's relational query API (`db.query.users.findMany({ with: ... })`) and how does it differ from the query-builder API in terms of the SQL it generates and when you would prefer it?
65. How does Drizzle handle the N+1 problem when you use `with:` in the relational API — does it use a JOIN or a batched second query?
66. When would you use the `sql` template literal in Drizzle, and how does it differ from using `$queryRaw` in Prisma in terms of type safety and composability?
67. How does Drizzle's migration workflow with `drizzle-kit` compare to Prisma's — what is the equivalent of `prisma migrate dev`, `migrate deploy`, and `db push`?
68. What are the trade-offs of Drizzle's "no Rust binary engine" approach — what capabilities does Prisma's engine provide that Drizzle cannot replicate in pure TypeScript?

### Connection Pooling

69. Why does running Prisma in a serverless environment (AWS Lambda, Vercel Edge) cause Postgres `max_connections` to be exhausted, even if each individual function instance has a small pool?
70. What is the difference between PgBouncer's session mode, transaction mode, and statement mode pooling, and which mode does Prisma recommend and why?
71. What is Prisma Accelerate, what problem does it solve beyond what a self-hosted PgBouncer solves, and what is the trade-off of using a managed pooler?
72. How would you set the connection pool size on a Prisma connection string, and what heuristics would you use to choose the right value for a given workload?
73. What happens if `pool_timeout` is exceeded while waiting for a connection from the Prisma pool — how does that surface in your application, and how would you handle it gracefully?

### Raw SQL vs ORM

74. When should you drop from Prisma's query API to `$queryRaw`, and what do you lose (in terms of type safety and portability) when you do?
75. What is the difference between `$queryRaw` (tagged template) and `$queryRawUnsafe` in terms of SQL injection prevention, and in what scenario might someone incorrectly reach for `$queryRawUnsafe`?
76. How do you safely build a dynamic `IN (...)` clause with a variable-length array of IDs in Prisma raw SQL, and why is string concatenation the wrong approach?
77. If you need a window function or a recursive CTE in Prisma, what is the recommended approach, and how do you preserve type safety on the result?
78. What are the portability implications of writing raw SQL in an ORM-backed application — what breaks if you switch from Postgres to another database, and how would you mitigate that risk architecturally?

### Seeding & Data Management

79. How would you implement a deterministic, idempotent database seed script in Prisma that can be safely re-run without creating duplicates?
80. What is the difference between using `upsert` and `createMany({ skipDuplicates: true })` in a seed script, and when would each be preferable?
81. How would you seed related data (for example, users with posts) in the correct order to satisfy foreign key constraints, and how does a nested write simplify this?
82. What is the risk of running a seed script against a production database, and how would you guard against that in code?
