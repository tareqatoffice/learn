# Phase 3 — EF Core + PostgreSQL

**Status:** Not started
**Targets:** .NET 10, EF Core 9/10, Npgsql

---

## 3.1 Entity Framework Core Concepts

EF Core is the .NET ORM. If you know Prisma or TypeORM, you already understand 80% of it — the vocabulary just changes.

### The Mental Map

| EF Core | Prisma | TypeORM | What it is |
|---|---|---|---|
| `DbContext` | `PrismaClient` instance | `DataSource` / `EntityManager` | Your DB session + unit of work |
| `DbSet<Product>` | `prisma.product` | `Repository<Product>` | A queryable table |
| Entity class (POCO) | model in `schema.prisma` | `@Entity` class | A row's shape |
| Migrations | `prisma migrate` | TypeORM migrations | Versioned schema changes |
| LINQ | Prisma query API | QueryBuilder | The query language |
| Change tracker | (Prisma tracks via `update` calls) | Entity state tracking | Diffs what you changed |

**The biggest conceptual difference from Prisma:** Prisma is *explicit* — you call `prisma.product.update({...})` and pass exactly what changed. EF Core is *implicit* — you load an entity, mutate its properties like a normal object, and `SaveChangesAsync()` figures out the SQL by diffing against what it remembers. This is the **change tracker**, and it's the single most important EF Core concept (covered in 3.4).

### DbContext ≈ Unit of Work / Session

A `DbContext` is one conversation with the database. It is:
- **Scoped per HTTP request** in a web API (registered as `Scoped` in DI — like a per-request Prisma transaction context).
- **Short-lived** — never a singleton. Create it, use it, dispose it.
- **Not thread-safe** — don't share one instance across parallel `await`s.

```csharp
// This is your whole data layer surface. Think of it as PrismaClient,
// but you define the tables (DbSets) yourself as properties.
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Each DbSet<T> ≈ a table ≈ prisma.product
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
}
```

### Entities Are Just POCOs

POCO = Plain Old CLR Object. No base class to inherit, no decorators required (unlike TypeORM's `@Entity`/`@Column`). EF Core infers the table from conventions:

```csharp
// EF Core conventions, no attributes needed:
//  - class name "Product" -> table "Products" (Npgsql pluralizes)
//  - property "Id" or "ProductId" -> primary key
//  - "string" -> text/varchar, "int" -> integer, "decimal" -> numeric
public class Product
{
    public int Id { get; set; }                 // PK by convention
    public string Name { get; set; } = "";      // NOT NULL by convention (non-nullable ref type)
    public string? Description { get; set; }    // nullable -> NULL allowed in DB
    public decimal Price { get; set; }          // ALWAYS decimal for money, never double
    public int Stock { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

> Nullable reference types matter here: `string` becomes a `NOT NULL` column, `string?` becomes nullable. This is the same `Nullable` setting from Phase 1 doing double duty as a schema hint.

---

## 3.2 Setting Up EF Core with PostgreSQL

### Install Packages

```bash
# The Npgsql EF Core provider — pulls in EF Core itself as a dependency.
# This is the PostgreSQL "driver + dialect" — like @prisma/client + the pg engine.
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL

# Design-time package: needed for migrations (the `dotnet ef` commands read it).
dotnet add package Microsoft.EntityFrameworkCore.Design
```

### Install the `dotnet ef` CLI Tool

`dotnet ef` is a separate global tool (like installing `prisma` globally). It is NOT part of the SDK by default.

```bash
# Install once, globally (like: npm i -g prisma)
dotnet tool install --global dotnet-ef

# Already installed? Keep it current:
dotnet tool update --global dotnet-ef

# Verify
dotnet ef --version
```

### Connection String in appsettings.json

Connection strings live under the conventional `ConnectionStrings` section. This is your `DATABASE_URL`, but in Npgsql's key=value format rather than a URL.

```jsonc
// appsettings.json
{
  "ConnectionStrings": {
    // Npgsql format — semicolon-delimited key=value pairs
    "Default": "Host=localhost;Port=5432;Database=products_db;Username=postgres;Password=postgres"
  }
}
```

> Never commit real passwords. For local dev use `dotnet user-secrets set "ConnectionStrings:Default" "..."` (the secrets store from Phase 2.6). In production, override via the `ConnectionStrings__Default` environment variable (double underscore = nested key).

### Register DbContext in DI

In `Program.cs`, register the context with the connection string. `AddDbContext` registers it as **Scoped** automatically — one per request, exactly what you want.

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default")));

// Now any controller/service can ask for AppDbContext via constructor injection.
var app = builder.Build();
```

```csharp
// Inject it like any other service (constructor injection, from Phase 2.3):
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) => _db = db;
}
```

---

## 3.3 Code-First Migrations

**Code-first** means: your C# entity classes are the source of truth, and EF generates SQL to make the database match. This is the same model as Prisma Migrate (schema file → SQL) and TypeORM migrations — except your "schema file" is your C# classes.

A migration is a generated, version-controlled C# class describing schema deltas. Think of it as a SQL migration script, but auto-diffed for you.

### The Core Workflow

```bash
# 1. Create the first migration by diffing entities against an empty DB.
#    "InitialCreate" is just a name (like a git commit message).
#    Prisma equivalent: prisma migrate dev --name init
dotnet ef migrations add InitialCreate

# 2. Apply pending migrations to the actual database (runs the SQL).
#    Prisma equivalent: prisma migrate deploy
dotnet ef database update
```

This generates a `Migrations/` folder:

```
Migrations/
├── 20260617090000_InitialCreate.cs            ← Up() / Down() in C#
├── 20260617090000_InitialCreate.Designer.cs   ← snapshot metadata for this migration
└── AppDbContextModelSnapshot.cs               ← current cumulative model state
```

A migration file has `Up` (apply) and `Down` (revert):

```csharp
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Products",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy",
                                NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                Name = table.Column<string>(nullable: false),
                Price = table.Column<decimal>(type: "numeric", nullable: false),
                Stock = table.Column<int>(nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Products", x => x.Id));
    }

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "Products");  // reverses Up()
}
```

### Iterating: Add a Column

Change an entity, then add another migration. EF diffs the new model against the last snapshot:

```bash
# After adding a property to Product:
dotnet ef migrations add AddProductDescription
dotnet ef database update
```

### Reverting Migrations

```bash
# Roll the DB back to a specific migration (runs Down() for everything after it).
dotnet ef database update InitialCreate

# Roll back ALL migrations (empty DB):
dotnet ef database update 0

# Delete the LAST migration file — ONLY if it hasn't been applied/shared yet.
# (Like deleting a local commit you haven't pushed.)
dotnet ef migrations remove

# Inspect what SQL a migration would run, without touching the DB:
dotnet ef migrations script           # all migrations
dotnet ef migrations script From To   # a range — useful for prod review
```

> **Golden rule (same as Prisma/TypeORM):** never edit or delete a migration that has already been applied to a shared/production database. Add a new migration forward instead.

### Applying Migrations at Startup (dev convenience)

```csharp
// Handy in dev; in production prefer `dotnet ef database update` in your deploy pipeline.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();   // applies any pending migrations
}
```

---

## 3.4 CRUD with EF Core

### The Change Tracker — Read This Twice

When you query an entity through a `DbContext`, EF keeps a reference to it and remembers its original values. When you call `SaveChangesAsync()`, EF compares current vs. original and generates the minimal `INSERT`/`UPDATE`/`DELETE`.

This is the big difference from Prisma. You don't say "update price to 10" — you just **set the property** and save:

```csharp
var product = await _db.Products.FindAsync(1); // tracked
product!.Price = 10m;                          // mutate like a normal object
await _db.SaveChangesAsync();                   // EF emits: UPDATE "Products" SET "Price" = 10 WHERE "Id" = 1
```

Each tracked entity has a **state**: `Unchanged`, `Added`, `Modified`, `Deleted`, or `Detached`. `SaveChangesAsync()` acts on those states and wraps everything in a single transaction.

### Create

```csharp
var product = new Product { Name = "Keyboard", Price = 49.99m, Stock = 100 };

_db.Products.Add(product);          // state -> Added (no SQL yet)
await _db.SaveChangesAsync();        // INSERT runs here, inside a transaction

// After save, product.Id is populated by the DB-generated identity value.
Console.WriteLine(product.Id);       // e.g. 1
```

### Read

```csharp
// FindAsync — by PRIMARY KEY only. Checks the change tracker first (no query if
// already loaded in this context), then the DB. No LINQ predicate allowed.
var byId = await _db.Products.FindAsync(1);

// FirstOrDefaultAsync — arbitrary predicate, returns null if no match (≈ .find()).
var firstCheap = await _db.Products
    .FirstOrDefaultAsync(p => p.Price < 20m);

// SingleOrDefaultAsync — like above but THROWS if more than one matches
// (use when the predicate should be unique, e.g. a SKU).
var bySku = await _db.Products.SingleOrDefaultAsync(p => p.Name == "Keyboard");

// ToListAsync — materialize the whole query (≈ .findMany()).
var all = await _db.Products.ToListAsync();
```

> **Always use the `Async` variants** (`ToListAsync`, `FirstOrDefaultAsync`, ...). The non-async ones block the thread — same spirit as never using sync `fs` calls in Node.

### Update

```csharp
// Preferred: load, mutate, save. The tracker handles the diff.
var product = await _db.Products.FindAsync(1);
if (product is not null)
{
    product.Price = 59.99m;
    product.Stock -= 1;
    await _db.SaveChangesAsync();  // UPDATE only the changed columns
}

// Disconnected update (e.g. an entity rebuilt from a PUT body that wasn't loaded):
var incoming = new Product { Id = 1, Name = "Keyboard Pro", Price = 79m, Stock = 50 };
_db.Products.Update(incoming);   // marks ALL columns Modified
await _db.SaveChangesAsync();
```

### Delete

```csharp
var product = await _db.Products.FindAsync(1);
if (product is not null)
{
    _db.Products.Remove(product);   // state -> Deleted
    await _db.SaveChangesAsync();    // DELETE FROM "Products" WHERE "Id" = 1
}

// EF Core 7+ bulk operations — run server-side, NO tracking, single SQL statement:
await _db.Products.Where(p => p.Stock == 0).ExecuteDeleteAsync();
await _db.Products.Where(p => p.Price < 5m)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, 0));
```

### AsNoTracking — Read-Only Performance

For read-only queries (the common case in a GET endpoint), tell EF not to track the results. It skips building the change-tracking snapshot — less memory, faster.

```csharp
// Use for any query whose results you won't modify and save.
var products = await _db.Products
    .AsNoTracking()                 // no snapshots; nothing to diff later
    .Where(p => p.Stock > 0)
    .ToListAsync();
```

> Rule of thumb: **reads → `AsNoTracking()`**, **writes → tracked (default)**. There's no Prisma equivalent because Prisma never tracks in the first place — its `findMany` is effectively always "no tracking".

---

## 3.5 Relationships

You model relationships with **navigation properties** (a reference to the related object/collection) plus, by convention, a **foreign key** property. EF wires up the FK from the names.

### One-to-Many

A `Category` has many `Product`s; a `Product` belongs to one `Category`.

```csharp
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    // Collection navigation — the "many" side (≈ Prisma `products Product[]`)
    public List<Product> Products { get; set; } = new();
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }

    // Foreign key (convention: <NavName>Id) -> creates "CategoryId" column + FK constraint
    public int CategoryId { get; set; }

    // Reference navigation — the "one" side (≈ Prisma `category Category @relation(...)`)
    public Category Category { get; set; } = null!;
}
```

EF infers the entire relationship from these names. No attributes needed. (If conventions aren't enough, you configure it in `OnModelCreating` with the Fluent API — covered properly in Phase 4.)

### One-to-One

```csharp
public class Product
{
    public int Id { get; set; }
    public ProductDetail? Detail { get; set; }   // optional one-to-one
}

public class ProductDetail
{
    public int Id { get; set; }
    public string Manufacturer { get; set; } = "";
    public int ProductId { get; set; }           // FK back to Product (also makes it 1:1)
    public Product Product { get; set; } = null!;
}
```

### Many-to-Many

EF Core 5+ creates the join table automatically — you don't write a join entity unless you need extra columns on it (like TypeORM's `@ManyToMany` vs. an explicit pivot).

```csharp
public class Product
{
    public int Id { get; set; }
    public List<Tag> Tags { get; set; } = new();
}

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<Product> Products { get; set; } = new();
}
// EF auto-creates a "ProductTag" join table with (ProductsId, TagsId). The migration
// reflects it. To add columns to the join, define an explicit join entity instead.
```

### Loading Related Data

There are three strategies. **Use `Include()` (eager). Avoid lazy. Reach for explicit rarely.**

```csharp
// 1. EAGER — Include() = JOIN, fetched in the same query. The default you want.
//    ≈ Prisma `include: { category: true }`
var products = await _db.Products
    .Include(p => p.Category)                 // join Categories
    .Include(p => p.Tags)                     // join the many-to-many
    .ToListAsync();

// Nested includes with ThenInclude:
var cats = await _db.Categories
    .Include(c => c.Products)
        .ThenInclude(p => p.Tags)
    .ToListAsync();

// 2. EXPLICIT — load a navigation on demand for an already-loaded entity.
var product = await _db.Products.FindAsync(1);
await _db.Entry(product!).Reference(p => p.Category).LoadAsync();   // single ref
await _db.Entry(product!).Collection(p => p.Tags).LoadAsync();     // collection

// 3. LAZY — navigations load automatically on first access. AVOID.
//    Requires Microsoft.EntityFrameworkCore.Proxies + virtual nav props. It silently
//    fires a query per access -> the N+1 problem below. Off by default; keep it off.
```

### The N+1 Problem (and the Fix)

This is the classic ORM trap, identical to what you've hit with lazy associations in TypeORM or careless Prisma loops.

```csharp
// BAD — N+1. One query for the list, then one MORE query per product's category.
var products = await _db.Products.ToListAsync();          // 1 query: SELECT * FROM Products
foreach (var p in products)
{
    // If lazy loading were on, THIS line fires a query EACH iteration:
    Console.WriteLine(p.Category.Name);                  // N queries: SELECT * FROM Categories WHERE Id = @id
}
// Total: 1 + N queries. With 500 products that's 501 round-trips.
```

```csharp
// GOOD — eager load with Include(). One query, one round-trip.
var products = await _db.Products
    .Include(p => p.Category)
    .ToListAsync();
foreach (var p in products)
    Console.WriteLine(p.Category.Name);                  // no extra queries — already loaded
```

**Generated SQL — the BAD version (lazy):**
```sql
SELECT p."Id", p."Name", p."CategoryId" FROM "Products" AS p;          -- 1
SELECT c."Id", c."Name" FROM "Categories" AS c WHERE c."Id" = 1;       -- 2
SELECT c."Id", c."Name" FROM "Categories" AS c WHERE c."Id" = 2;       -- 3
-- ... one per product ...
```

**Generated SQL — the GOOD version (`Include`):**
```sql
SELECT p."Id", p."Name", p."CategoryId", c."Id", c."Name"
FROM "Products" AS p
INNER JOIN "Categories" AS c ON p."CategoryId" = c."Id";               -- just 1
```

> If you only need a few fields, a `Select` projection (next section) is even better than `Include` — it avoids loading whole entity graphs.

---

## 3.6 Querying & Performance

### LINQ → SQL: Inspect the Generated SQL

EF translates LINQ into SQL. You should regularly *look* at what it produces — like running `EXPLAIN` or reading Prisma's query log.

```csharp
// .ToQueryString() returns the SQL without executing (EF Core 5+). Great for debugging.
var query = _db.Products.Where(p => p.Price > 50m).OrderBy(p => p.Name);
Console.WriteLine(query.ToQueryString());
```

```csharp
// Or log all SQL to the console during dev:
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connString)
           .LogTo(Console.WriteLine, LogLevel.Information)   // logs every SQL statement
           .EnableSensitiveDataLogging());                   // includes param values (DEV ONLY)
```

> **Deferred execution** (from Phase 1.5 LINQ) applies here too: the query doesn't hit the DB until you `await ToListAsync()` / `FirstOrDefaultAsync()` / enumerate it. Until then you're just composing an expression tree that EF will translate.

### Filtering & Ordering

```csharp
var results = await _db.Products
    .Where(p => p.Stock > 0 && p.Price < 100m)   // -> WHERE "Stock" > 0 AND "Price" < 100
    .OrderByDescending(p => p.CreatedAt)         // -> ORDER BY "CreatedAt" DESC
    .ThenBy(p => p.Name)
    .ToListAsync();
```

### Pagination — Skip / Take

`Skip`/`Take` translate to SQL `OFFSET`/`LIMIT`. Always pair with a deterministic `OrderBy`.

```csharp
int page = 2, pageSize = 20;

var pageItems = await _db.Products
    .AsNoTracking()
    .OrderBy(p => p.Id)                    // REQUIRED for stable paging
    .Skip((page - 1) * pageSize)          // OFFSET 20
    .Take(pageSize)                        // LIMIT 20
    .ToListAsync();

var total = await _db.Products.CountAsync();   // for total pages
```

### Projections with Select — Fetch Only What You Need

Project into a DTO/anonymous type so SQL selects only those columns. Faster, less data, and projected results are never tracked (no `AsNoTracking` needed).

```csharp
public record ProductListItem(int Id, string Name, decimal Price);

var items = await _db.Products
    .Select(p => new ProductListItem(p.Id, p.Name, p.Price))  // SELECT only Id, Name, Price
    .ToListAsync();
// Projecting a navigation avoids Include AND avoids over-fetching:
var withCat = await _db.Products
    .Select(p => new { p.Name, Category = p.Category.Name })  // JOIN, but only 2 columns
    .ToListAsync();
```

### Raw SQL — FromSqlRaw / FromSqlInterpolated

Drop to SQL for things LINQ can't express. Prefer the interpolated/parameterized forms — they parameterize input and are injection-safe (EF turns `{0}` / `{var}` into bound parameters).

```csharp
// Parameterized — SAFE. The value becomes a bound parameter, not string concat.
var min = 50m;
var rows = await _db.Products
    .FromSqlInterpolated($"SELECT * FROM \"Products\" WHERE \"Price\" > {min}")
    .AsNoTracking()
    .ToListAsync();

// FromSqlRaw with explicit params — also safe:
var rows2 = await _db.Products
    .FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Price\" > {0}", min)
    .ToListAsync();

// You can even keep composing LINQ on top of raw SQL:
var top = await _db.Products
    .FromSqlInterpolated($"SELECT * FROM \"Products\" WHERE \"Stock\" > {0}")
    .OrderBy(p => p.Price)
    .Take(5)
    .ToListAsync();
```

> **Never** do `FromSqlRaw($"... WHERE Name = '{userInput}'")` with string interpolation into `FromSqlRaw` — that's SQL injection. Use `FromSqlInterpolated` (which parameterizes) or `{0}` placeholders.

### Indexes — HasIndex

Define indexes in `OnModelCreating` with the Fluent API. EF emits `CREATE INDEX` into the next migration. (≈ Prisma `@@index` / `@unique`.)

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Product>()
        .HasIndex(p => p.Name);                       // CREATE INDEX

    modelBuilder.Entity<Product>()
        .HasIndex(p => p.Name)
        .IsUnique();                                  // CREATE UNIQUE INDEX

    modelBuilder.Entity<Product>()
        .HasIndex(p => new { p.CategoryId, p.Price }); // composite index
}
// Then: dotnet ef migrations add AddProductIndexes && dotnet ef database update
```

---

## 3.7 Repository Pattern (preview for Clean Architecture)

`DbContext` *is already* a unit of work, and `DbSet<T>` *is already* a repository. So why wrap it?

### Why Wrap EF Core

- **Decouple business logic from EF.** Your services depend on `IProductRepository`, not on EF types — swappable, mockable in tests (like injecting a fake repo instead of mocking PrismaClient).
- **Centralize query logic.** Common includes/filters live in one place.
- **Enforce boundaries** in Clean Architecture: the domain defines the interface, infrastructure implements it with EF.

> Caveat: a generic repository over EF is sometimes an anti-pattern (it hides EF's power — `Include`, projections, bulk ops). Many teams expose specific repositories instead. You'll wrestle with this trade-off in Phase 4. For now, learn the shape.

### A Generic Repository

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<IReadOnlyList<T>> GetAllAsync();
    Task AddAsync(T entity);
    void Update(T entity);
    void Remove(T entity);
}

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext Db;
    protected readonly DbSet<T> Set;

    public Repository(AppDbContext db)
    {
        Db = db;
        Set = db.Set<T>();
    }

    public async Task<T?> GetByIdAsync(int id) => await Set.FindAsync(id);

    public async Task<IReadOnlyList<T>> GetAllAsync() =>
        await Set.AsNoTracking().ToListAsync();

    public async Task AddAsync(T entity) => await Set.AddAsync(entity);

    public void Update(T entity) => Set.Update(entity);

    public void Remove(T entity) => Set.Remove(entity);
}
```

Note: none of these call `SaveChangesAsync()`. Saving belongs to the **Unit of Work**, so multiple repository operations can commit together in one transaction.

### Unit of Work

```csharp
public interface IUnitOfWork
{
    IRepository<Product> Products { get; }
    IRepository<Category> Categories { get; }
    Task<int> SaveChangesAsync();   // commits everything tracked, one transaction
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;
    public UnitOfWork(AppDbContext db)
    {
        _db = db;
        Products = new Repository<Product>(db);
        Categories = new Repository<Category>(db);
    }

    public IRepository<Product> Products { get; }
    public IRepository<Category> Categories { get; }

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
```

```csharp
// Register in DI:
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// Usage in a service — multiple ops, ONE commit:
await _uow.Products.AddAsync(product);
_uow.Categories.Update(category);
await _uow.SaveChangesAsync();   // both persisted in a single transaction
```

> Reality check: because `DbContext` is already a UoW, in many Clean Architecture setups people inject the `DbContext` (or specific repositories) directly and skip the generic `IUnitOfWork`. We'll revisit and likely simplify this in Phase 4.

---

## Gotchas for JS/TS Developers

| Gotcha | What bites you | Do this instead |
|---|---|---|
| Change tracking is implicit | You expect to "send an update" like Prisma; instead you mutate a loaded entity | Load → mutate property → `SaveChangesAsync()` |
| Forgetting `SaveChangesAsync()` | `Add`/`Update`/`Remove` change nothing on their own (no SQL) | Always save; nothing persists until you do |
| Tracking on read-heavy endpoints | Slower, more memory on big GET lists | `AsNoTracking()` for reads |
| N+1 from lazy loading | Loop accessing `p.Category` fires a query each time | `Include()` or a `Select` projection |
| `decimal` vs `double` for money | `double` loses precision → wrong totals | Always `decimal` (maps to `numeric`) |
| `DateTime` + Npgsql timezones | Npgsql maps `DateTime` to `timestamptz`; mixing Kind throws | Store UTC: `DateTime.UtcNow`, keep `Kind = Utc` |
| Sharing a `DbContext` across `await`s | Not thread-safe → runtime errors | One context per request (Scoped); don't parallelize on one |
| Editing an applied migration | Breaks teammates / prod schema state | Add a new forward migration instead |
| `FromSqlRaw` with string interpolation | SQL injection | `FromSqlInterpolated` or `{0}` params |
| `Find` vs `FirstOrDefault` | `FindAsync` is PK-only and checks the cache; `FirstOrDefaultAsync` takes a predicate | Pick based on whether you have the PK |
| `First` throws, `FirstOrDefault` returns null | `First` on no match = exception (like Prisma `findFirstOrThrow`) | Use `...OrDefault` unless you want the throw |
| LINQ that can't translate | Calling a C# method EF can't convert → runtime exception | Keep `Where`/`Select` translatable, or `AsEnumerable()` first (pulls to memory — careful) |

---

## Phase 3 Mini-Project — Persist the Products API to PostgreSQL

**Goal:** Take the Phase 2 in-memory Products API and back it with PostgreSQL via EF Core — entities, migrations, full async CRUD, a relationship, and pagination.

### Step 0 — Spin up PostgreSQL (Docker)

```bash
docker run --name learn-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=products_db -p 5432:5432 -d postgres:17
```

### Step 1 — Add packages & the EF tool

```bash
cd examples/phase2-products-api
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet tool install --global dotnet-ef   # skip if already installed
```

### Step 2 — Entities with a relationship

Create `Product` and `Category` (one Category → many Products) as in 3.5. Use `decimal Price`, `DateTime CreatedAt = DateTime.UtcNow`, and a `CategoryId` FK + `Category` nav.

### Step 3 — The DbContext

Write `AppDbContext : DbContext` with `DbSet<Product>` and `DbSet<Category>`. In `OnModelCreating`, add `HasIndex(p => p.Name)` on Product (3.6).

### Step 4 — Wire up DI + connection string

- Put the connection string under `ConnectionStrings:Default` in `appsettings.json` (3.2), or better, `dotnet user-secrets`.
- `builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(...))` in `Program.cs`.
- Add `.LogTo(Console.WriteLine, LogLevel.Information)` in dev so you can watch the SQL.

### Step 5 — Migrate

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
# Inspect what was generated:
dotnet ef migrations script
```

### Step 6 — Replace the in-memory store with EF in the controller

Convert each Phase 2 endpoint to async EF calls:

- `GET /products` → `await _db.Products.AsNoTracking().Include(p => p.Category).ToListAsync()`
  - Add pagination: accept `?page=&pageSize=` query params and apply `OrderBy().Skip().Take()` (3.6). Return total count too.
  - **Project** into a `ProductResponse` DTO with `Select` so you don't leak the entity / over-fetch.
- `GET /products/{id}` → `await _db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id)`; `NotFound()` if null.
- `POST /products` → map the request DTO to a `Product`, `Add`, `SaveChangesAsync`, return `CreatedAtAction` with the new `Id`.
- `PUT /products/{id}` → `FindAsync`, mutate properties, `SaveChangesAsync` (let the change tracker do the diff); `NotFound()` if missing.
- `DELETE /products/{id}` → `FindAsync`, `Remove`, `SaveChangesAsync`.

Remember to inject `CancellationToken` (Phase 1.6) into the actions and pass it to every async EF call.

### Step 7 — Prove the N+1 fix

1. Seed ~3 categories and ~20 products (a quick loop in a dev-only endpoint or `MigrateAsync` seeding block).
2. Hit `GET /products` and read the SQL in the console — confirm it's a **single JOIN** because you used `Include`.
3. Temporarily remove `Include` and access `p.Category.Name` in a projection to see EF either error (no lazy loading) or, if you enabled proxies, fire N queries. Restore `Include`.

### Stretch Goals

- Add a `Tag` entity and make Product↔Tag **many-to-many** (3.5). Inspect the auto-generated join table in the migration.
- Add a composite `HasIndex(p => new { p.CategoryId, p.Price })` and migrate.
- Introduce `IProductRepository` + `IUnitOfWork` (3.7) and move EF calls out of the controller.
- Add a `GET /products/search?q=` endpoint using a `FromSqlInterpolated` query.

---

## Summary

| Concept | EF Core | Prisma / TypeORM Equivalent |
|---|---|---|
| ORM client / session | `DbContext` (Scoped) | `PrismaClient` / `DataSource` |
| Table | `DbSet<T>` | `prisma.x` / `Repository<T>` |
| Entity | POCO class | model / `@Entity` |
| Create | `Add` + `SaveChangesAsync` | `create` |
| Read by PK | `FindAsync` | `findUnique` |
| Read one | `FirstOrDefaultAsync` | `findFirst` |
| Read many | `ToListAsync` | `findMany` |
| Update | mutate tracked entity + save | `update` |
| Delete | `Remove` + save | `delete` |
| Bulk write | `ExecuteUpdate/DeleteAsync` | `updateMany` / `deleteMany` |
| Read-only opt | `AsNoTracking()` | (always untracked) |
| Eager load relation | `Include()` / `ThenInclude()` | `include` |
| Projection | `Select(p => new Dto(...))` | `select` |
| Pagination | `Skip()` / `Take()` | `skip` / `take` |
| Index | `HasIndex()` | `@@index` / `@unique` |
| Raw SQL | `FromSqlInterpolated` | `$queryRaw` |
| Migrations | `dotnet ef migrations add` / `database update` | `prisma migrate dev` / `deploy` |
| Inspect SQL | `.ToQueryString()` / `.LogTo()` | query logging |

**Key takeaways:**
- The **change tracker** is the heart of EF — load, mutate, save; nothing persists without `SaveChangesAsync()`.
- **Reads → `AsNoTracking()`; writes → tracked.**
- Default to **eager loading with `Include()`**; never enable lazy loading; kill N+1 with `Include` or `Select`.
- Entities are plain classes; relationships are nav properties + FKs by convention.
- Migrations are auto-generated, version-controlled SQL deltas — never edit an applied one.
- The repository/UoW pattern is a Phase 4 stepping stone; remember `DbContext` is already a unit of work.
