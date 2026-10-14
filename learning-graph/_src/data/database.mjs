// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  out: "database_learning_graph",
  title: "Database Learning Graph",
  sub: "SQL examples use PostgreSQL; the NoSQL topics use Redis and MongoDB.",
  foot: "Links go to the official PostgreSQL, Redis and MongoDB documentation, Use The Index, Luke, and OWASP.",
  key: "database-learning-graph-v1",
  tracks: [
    { k: "sql", n: "SQL basics" },
    { k: "model", n: "Modeling" },
    { k: "perf", n: "Indexes & performance" },
    { k: "tx", n: "Transactions" },
    { k: "ops", n: "Operations" },
    { k: "nosql", n: "Beyond relational" }
  ],
  nodes: [
    // ---------- SQL basics ----------
    {
      id: "relational-model",
      tr: "sql",
      t: "Relational model",
      pre: [],
      s: "A relational database stores data in tables of rows and columns. Each table describes one kind of thing, and tables relate to each other through shared key values.",
      p: [
        "A row is one fact; a column is one attribute with one data type.",
        "A primary key identifies each row; a foreign key points at a row in another table.",
        "SQL is declarative: you describe the result, the planner decides how to get it."
      ],
      c: "CREATE TABLE customers (\n  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL UNIQUE\n);\n\nCREATE TABLE orders (\n  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  customer_id bigint NOT NULL REFERENCES customers(id),\n  total       numeric(12,2) NOT NULL\n);",
      pit: "Treating a table like a spreadsheet: one wide table with repeated groups of columns (phone1, phone2, phone3) instead of a related table.",
      u: "https://www.postgresql.org/docs/current/tutorial-concepts.html"
    },
    {
      id: "select-filter",
      tr: "sql",
      t: "SELECT & filtering",
      pre: ["relational-model"],
      s: "SELECT reads rows. WHERE filters them, ORDER BY sorts them, and LIMIT caps how many come back.",
      p: [
        "Logical order: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT.",
        "Use bind parameters ($1) for values, never string concatenation.",
        "List the columns you need instead of SELECT * in application code."
      ],
      c: "SELECT id, email, created_at\nFROM customers\nWHERE created_at >= now() - interval '7 days'\n  AND email LIKE '%@example.com'\nORDER BY created_at DESC\nLIMIT 20;",
      pit: "Expecting rows in insertion order without ORDER BY. Without it the order is undefined and can change between runs.",
      u: "https://www.postgresql.org/docs/current/sql-select.html"
    },
    {
      id: "null-semantics",
      tr: "sql",
      t: "NULL semantics",
      pre: ["select-filter"],
      s: "NULL means unknown, not empty or zero. Any comparison with NULL yields NULL, which WHERE treats as false.",
      p: [
        "Use IS NULL / IS NOT NULL, never = NULL.",
        "IS DISTINCT FROM compares values treating NULL as a normal value.",
        "COUNT(col) and most aggregates skip NULLs; COUNT(*) counts rows.",
        "COALESCE(x, default) substitutes a value for NULL."
      ],
      c: "SELECT count(*)          AS rows,\n       count(phone)      AS with_phone\nFROM customers;\n\n-- returns nothing if any manager_id is NULL\nSELECT * FROM staff\nWHERE id NOT IN (SELECT manager_id FROM staff);\n\n-- safe version\nSELECT * FROM staff s\nWHERE NOT EXISTS (SELECT 1 FROM staff m WHERE m.manager_id = s.id);",
      pit: "Using NOT IN with a subquery that can return NULL. The whole predicate becomes unknown and silently returns zero rows.",
      u: "https://www.postgresql.org/docs/current/functions-comparison.html"
    },
    {
      id: "joins",
      tr: "sql",
      t: "Joins",
      pre: ["select-filter"],
      s: "A join combines rows from two tables on a matching condition. INNER JOIN keeps only matches; LEFT JOIN keeps every row from the left side and fills NULLs where nothing matched.",
      p: [
        "Join on keys: usually a foreign key to a primary key.",
        "LEFT JOIN plus WHERE right.id IS NULL finds rows with no match (anti-join).",
        "A join on a non-unique column multiplies rows; check the cardinality."
      ],
      c: "SELECT c.email, o.id AS order_id, o.total\nFROM customers c\nLEFT JOIN orders o\n       ON o.customer_id = c.id\n      AND o.status = 'paid'   -- filter here keeps customers without paid orders\nORDER BY c.email;",
      pit: "Filtering the right table of a LEFT JOIN in WHERE (WHERE o.status = 'paid'). That drops the NULL rows and quietly turns it into an INNER JOIN.",
      u: "https://www.postgresql.org/docs/current/tutorial-join.html"
    },
    {
      id: "aggregation",
      tr: "sql",
      t: "Aggregation & GROUP BY",
      pre: ["joins", "null-semantics"],
      s: "Aggregates (count, sum, avg, min, max) collapse many rows into one value per group. GROUP BY defines the groups; HAVING filters groups after aggregation.",
      p: [
        "WHERE filters rows before grouping; HAVING filters groups after.",
        "Every selected column must be grouped or aggregated (or depend on a grouped primary key).",
        "FILTER (WHERE ...) computes conditional aggregates in one pass."
      ],
      c: "SELECT c.id,\n       count(o.id)                                AS orders,\n       sum(o.total) FILTER (WHERE o.status = 'paid') AS paid_total\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.id\nHAVING count(o.id) >= 3;",
      pit: "Using count(*) after a LEFT JOIN. Customers with no orders still count as 1; use count(o.id) to count only matches.",
      u: "https://www.postgresql.org/docs/current/tutorial-agg.html"
    },
    {
      id: "subqueries-ctes",
      tr: "sql",
      t: "Subqueries & CTEs",
      pre: ["aggregation"],
      s: "A subquery is a query inside another query. A CTE (WITH ...) names a subquery so a complex query reads top to bottom. WITH RECURSIVE walks trees and graphs.",
      p: [
        "EXISTS is the clearest way to ask whether a related row exists.",
        "PostgreSQL inlines simple CTEs; add MATERIALIZED to force a single evaluation.",
        "Recursive CTEs need a termination condition, or they loop until memory runs out."
      ],
      c: "WITH big_spenders AS (\n  SELECT customer_id, sum(total) AS spent\n  FROM orders\n  WHERE status = 'paid'\n  GROUP BY customer_id\n  HAVING sum(total) > 1000\n)\nSELECT c.email, b.spent\nFROM big_spenders b\nJOIN customers c ON c.id = b.customer_id;",
      pit: "Writing a correlated subquery in the SELECT list that runs once per row, when a single join or GROUP BY would do the work in one pass.",
      u: "https://www.postgresql.org/docs/current/queries-with.html"
    },
    {
      id: "window-functions",
      tr: "sql",
      t: "Window functions",
      pre: ["subqueries-ctes"],
      s: "Window functions compute a value across related rows without collapsing them. Use them for rankings, running totals, and comparing a row to the previous one.",
      p: [
        "OVER (PARTITION BY ... ORDER BY ...) defines the window.",
        "row_number, rank, lag, lead, and sum() OVER are the everyday ones.",
        "Window functions run after WHERE, so filter on them in an outer query."
      ],
      c: "-- latest order per customer\nSELECT *\nFROM (\n  SELECT o.*,\n         row_number() OVER (PARTITION BY customer_id\n                            ORDER BY created_at DESC) AS rn\n  FROM orders o\n) t\nWHERE rn = 1;",
      pit: "Using last_value() with ORDER BY and the default frame. The frame ends at the current row, so it returns the current row, not the last one in the partition.",
      u: "https://www.postgresql.org/docs/current/tutorial-window.html"
    },
    {
      id: "writing-data",
      tr: "sql",
      t: "Writing data & upsert",
      pre: ["select-filter", "constraints-keys"],
      s: "INSERT, UPDATE and DELETE change rows. INSERT ... ON CONFLICT makes an upsert atomic, and RETURNING gives back the affected rows without a second query.",
      p: [
        "ON CONFLICT needs a unique index or constraint to detect the conflict.",
        "EXCLUDED refers to the row you tried to insert.",
        "Batch many rows in one statement instead of one round trip per row."
      ],
      c: "INSERT INTO customers (email, name)\nVALUES ($1, $2)\nON CONFLICT (email)\nDO UPDATE SET name = EXCLUDED.name\nRETURNING id;",
      pit: "Running SELECT then INSERT to implement an upsert. Two concurrent requests both see no row and one fails, or you get duplicates without a unique constraint.",
      u: "https://www.postgresql.org/docs/current/sql-insert.html"
    },

    // ---------- Modeling ----------
    {
      id: "data-types",
      tr: "model",
      t: "Data types",
      pre: ["relational-model"],
      s: "Pick the narrowest type that is correct. The type is your first constraint, and it decides how values compare, sort and index.",
      p: [
        "Money: numeric, never float or real.",
        "Time: timestamptz stores an absolute instant; plain timestamp has no time zone.",
        "Text: text and varchar(n) perform the same in PostgreSQL; varchar(n) only adds a length check.",
        "IDs: bigint identity or uuid; an int key can run out."
      ],
      c: "CREATE TABLE payments (\n  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  amount     numeric(12,2) NOT NULL,\n  currency   char(3)       NOT NULL,\n  paid_at    timestamptz   NOT NULL DEFAULT now(),\n  metadata   jsonb\n);",
      pit: "Storing times as timestamp without time zone. Values written from servers in different zones become ambiguous and daylight-saving bugs follow.",
      u: "https://www.postgresql.org/docs/current/datatype.html"
    },
    {
      id: "constraints-keys",
      tr: "model",
      t: "Constraints & keys",
      pre: ["relational-model", "data-types"],
      s: "Constraints make the database reject bad data no matter which code path writes it. Primary keys, foreign keys, UNIQUE, NOT NULL and CHECK are the core set.",
      p: [
        "Every table needs a primary key.",
        "Foreign keys keep references valid; choose ON DELETE behaviour deliberately.",
        "PostgreSQL does not index foreign key columns automatically.",
        "A CHECK constraint encodes a business rule once, for every writer."
      ],
      c: "CREATE TABLE order_items (\n  order_id   bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n  product_id bigint NOT NULL REFERENCES products(id),\n  quantity   int    NOT NULL CHECK (quantity > 0),\n  PRIMARY KEY (order_id, product_id)\n);\nCREATE INDEX ON order_items (product_id);",
      pit: "Forgetting to index the foreign key column. Deletes on the parent table then scan the whole child table and joins get slow.",
      u: "https://www.postgresql.org/docs/current/ddl-constraints.html"
    },
    {
      id: "normalization",
      tr: "model",
      t: "Normalization",
      pre: ["constraints-keys", "joins"],
      s: "Normalization means storing each fact once. It removes update anomalies: when a value lives in one place, it cannot disagree with itself.",
      p: [
        "1NF: one value per column, no lists packed into a string.",
        "2NF/3NF: non-key columns depend on the whole key and nothing but the key.",
        "Many-to-many relationships need a join table.",
        "Normalize first; denormalize only for a measured reason."
      ],
      c: "-- not normalized: tags = 'red,sale,new'\n-- normalized:\nCREATE TABLE tags (\n  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL UNIQUE\n);\nCREATE TABLE product_tags (\n  product_id bigint REFERENCES products(id),\n  tag_id     bigint REFERENCES tags(id),\n  PRIMARY KEY (product_id, tag_id)\n);",
      pit: "Storing comma-separated IDs in a text column. You lose foreign keys, indexes, and every query needs string parsing.",
      u: "https://en.wikipedia.org/wiki/Database_normalization"
    },
    {
      id: "denormalization",
      tr: "model",
      t: "When to denormalize",
      pre: ["normalization", "aggregation"],
      s: "Denormalizing copies or precomputes data to make reads cheaper. It trades write complexity and staleness for read speed, so do it only where a measured read path needs it.",
      p: [
        "Materialized views store a query result and refresh on demand.",
        "Counter or summary columns need triggers or app code to stay correct.",
        "Decide who owns the copy and how it gets back in sync."
      ],
      c: "CREATE MATERIALIZED VIEW daily_sales AS\nSELECT date_trunc('day', created_at) AS day,\n       sum(total)                    AS revenue\nFROM orders\nWHERE status = 'paid'\nGROUP BY 1;\n\nCREATE UNIQUE INDEX ON daily_sales (day);\nREFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;",
      pit: "Adding a cached total column without a plan to keep it correct. It drifts from the source rows and nobody notices until a report is wrong.",
      u: "https://www.postgresql.org/docs/current/rules-materializedviews.html"
    },
    {
      id: "jsonb",
      tr: "model",
      t: "JSONB",
      pre: ["data-types", "normalization"],
      s: "jsonb stores JSON in a parsed binary form you can query and index. It fits sparse or truly variable attributes alongside normal relational columns.",
      p: [
        "-> returns jsonb, ->> returns text.",
        "@> tests containment and can use a GIN index.",
        "Keep fields you filter, join or constrain on as real columns."
      ],
      c: "CREATE INDEX ON events USING gin (payload jsonb_path_ops);\n\nSELECT id, payload->>'plan' AS plan\nFROM events\nWHERE payload @> '{\"type\": \"signup\"}';",
      pit: "Putting the whole entity in one jsonb column. You lose types, NOT NULL, foreign keys and good statistics, and the planner guesses badly.",
      u: "https://www.postgresql.org/docs/current/datatype-json.html"
    },

    // ---------- Indexes & performance ----------
    {
      id: "btree-indexes",
      tr: "perf",
      t: "B-tree indexes",
      pre: ["constraints-keys", "select-filter"],
      s: "An index is a separate sorted structure that points at table rows. A B-tree index, the default, makes equality and range lookups and ORDER BY fast instead of scanning every row.",
      p: [
        "Primary keys and UNIQUE constraints create a B-tree index for you.",
        "Each index speeds reads but slows every insert and update.",
        "Use CREATE INDEX CONCURRENTLY on live tables to avoid blocking writes."
      ],
      c: "CREATE INDEX CONCURRENTLY idx_orders_created_at\n  ON orders (created_at);\n\n-- now uses the index for the range and the sort\nSELECT id, total\nFROM orders\nWHERE created_at >= '2026-10-01'\nORDER BY created_at\nLIMIT 50;",
      pit: "Wrapping the indexed column in a function, such as WHERE lower(email) = $1. A plain index on email is ignored; you need an expression index on lower(email).",
      u: "https://use-the-index-luke.com/sql/anatomy"
    },
    {
      id: "composite-indexes",
      tr: "perf",
      t: "Composite indexes",
      pre: ["btree-indexes"],
      s: "A composite index covers several columns in a fixed order. It helps queries that filter on a leftmost prefix of those columns.",
      p: [
        "Put equality columns first, then the range or sort column.",
        "An index on (a, b) serves WHERE a = ? and WHERE a = ? AND b > ?, but not WHERE b = ? alone.",
        "One well-chosen composite index often replaces several single-column ones."
      ],
      c: "CREATE INDEX idx_orders_customer_created\n  ON orders (customer_id, created_at DESC);\n\nSELECT id, total\nFROM orders\nWHERE customer_id = $1\nORDER BY created_at DESC\nLIMIT 10;",
      pit: "Putting the range column first, as in (created_at, customer_id). The index can no longer jump straight to one customer's rows.",
      u: "https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys"
    },
    {
      id: "partial-covering",
      tr: "perf",
      t: "Partial & covering",
      pre: ["composite-indexes"],
      s: "A partial index only includes rows matching a WHERE clause, so it stays small. A covering index adds INCLUDE columns so the query can be answered from the index alone.",
      p: [
        "The query's WHERE must imply the partial index predicate.",
        "INCLUDE columns are stored but not searchable.",
        "Index-only scans depend on the visibility map, which VACUUM keeps current."
      ],
      c: "-- only the few pending rows are indexed\nCREATE INDEX idx_jobs_pending\n  ON jobs (run_at) WHERE status = 'pending';\n\n-- covering: no heap visit for these columns\nCREATE INDEX idx_orders_cust_cover\n  ON orders (customer_id) INCLUDE (total, status);",
      pit: "Querying with a parameter for the partial-index condition (WHERE status = $1). The planner cannot prove the predicate matches, so the partial index may not be used.",
      u: "https://www.postgresql.org/docs/current/indexes-index-only-scans.html"
    },
    {
      id: "explain",
      tr: "perf",
      t: "EXPLAIN ANALYZE",
      pre: ["btree-indexes", "joins"],
      s: "EXPLAIN shows the plan the planner chose. EXPLAIN ANALYZE also runs the query and shows real row counts and timings, so you can see where estimates are wrong.",
      p: [
        "Read the plan from the innermost node outward.",
        "Compare estimated rows with actual rows; big gaps mean stale or missing statistics.",
        "Add BUFFERS to see how much data came from cache versus disk."
      ],
      c: "EXPLAIN (ANALYZE, BUFFERS)\nSELECT o.id, c.email\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.created_at >= now() - interval '1 day';\n\n-- look for: Seq Scan on large tables, rows=1 vs actual rows=50000",
      pit: "Running EXPLAIN ANALYZE on a DELETE or UPDATE in production. It really executes; wrap it in BEGIN ... ROLLBACK.",
      u: "https://www.postgresql.org/docs/current/using-explain.html"
    },
    {
      id: "n-plus-one",
      tr: "perf",
      t: "N+1 & ORMs",
      pre: ["explain"],
      s: "The N+1 problem is one query for a list, then one more query per item. ORMs cause it through lazy loading, and it hides in code that looks fine.",
      p: [
        "Fix it with a join, eager loading, or one batched WHERE id = ANY($1) query.",
        "Log SQL in development and count queries per request.",
        "Check the SQL your ORM generates, not just the code that calls it."
      ],
      c: "-- N+1: 1 query for orders, then 1 per order\n-- SELECT * FROM customers WHERE id = 7;  (x N)\n\n-- one batched query instead\nSELECT id, email\nFROM customers\nWHERE id = ANY($1::bigint[]);",
      pit: "Accessing a lazy navigation property inside a loop over results. A page of 50 rows quietly becomes 51 queries.",
      u: "https://use-the-index-luke.com/sql/join/nested-loops-join-n1-problem"
    },
    {
      id: "query-optimization",
      tr: "perf",
      t: "Query optimization",
      pre: ["partial-covering", "n-plus-one", "subqueries-ctes"],
      s: "Optimizing is measuring first, then changing one thing. Find the queries that cost the most in total, read their plans, and fix the access path.",
      p: [
        "pg_stat_statements ranks queries by total time.",
        "Keep predicates index-friendly: no functions or casts on the indexed column.",
        "Prefer keyset pagination over large OFFSET values.",
        "Run ANALYZE after bulk loads so the planner has fresh statistics."
      ],
      c: "-- keyset pagination: stays fast on page 1000\nSELECT id, created_at, total\nFROM orders\nWHERE (created_at, id) < ($1, $2)\nORDER BY created_at DESC, id DESC\nLIMIT 50;",
      pit: "Adding indexes for every slow query without checking the plan. Unused indexes still slow every write and take disk and cache.",
      u: "https://www.postgresql.org/docs/current/performance-tips.html"
    },
    {
      id: "full-text-search",
      tr: "perf",
      t: "Full-text search",
      pre: ["composite-indexes", "data-types"],
      s: "PostgreSQL full-text search turns text into a tsvector of normalized words and matches it against a tsquery. With a GIN index it handles many search features before you need a separate search engine.",
      p: [
        "websearch_to_tsquery accepts user-style input safely.",
        "A stored generated tsvector column keeps the index simple.",
        "ts_rank orders results by relevance."
      ],
      c: "ALTER TABLE articles ADD COLUMN search tsvector\n  GENERATED ALWAYS AS (\n    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))\n  ) STORED;\nCREATE INDEX ON articles USING gin (search);\n\nSELECT id, title\nFROM articles\nWHERE search @@ websearch_to_tsquery('english', $1);",
      pit: "Using WHERE body LIKE '%term%' for search. A leading wildcard cannot use a B-tree index and scans every row.",
      u: "https://www.postgresql.org/docs/current/textsearch-intro.html"
    },
    {
      id: "partitioning",
      tr: "perf",
      t: "Partitioning",
      pre: ["query-optimization", "migrations"],
      s: "Partitioning splits one large table into smaller tables by a key, usually time. Queries that filter on the key touch only the matching partitions, and old data can be dropped in one cheap step.",
      p: [
        "Declarative partitioning supports RANGE, LIST and HASH.",
        "Primary keys and unique constraints must include the partition key.",
        "It helps very large tables; it does not make small tables faster."
      ],
      c: "CREATE TABLE events (\n  id         bigint GENERATED ALWAYS AS IDENTITY,\n  created_at timestamptz NOT NULL,\n  payload    jsonb,\n  PRIMARY KEY (id, created_at)\n) PARTITION BY RANGE (created_at);\n\nCREATE TABLE events_2026_10 PARTITION OF events\n  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');",
      pit: "Querying without the partition key in WHERE. Partition pruning cannot happen, and every partition is scanned.",
      u: "https://www.postgresql.org/docs/current/ddl-partitioning.html"
    },

    // ---------- Transactions ----------
    {
      id: "transactions-acid",
      tr: "tx",
      t: "Transactions & ACID",
      pre: ["constraints-keys"],
      s: "A transaction groups statements so they all succeed or all fail. ACID: atomic, consistent, isolated, durable.",
      p: [
        "BEGIN ... COMMIT; any error means ROLLBACK.",
        "Without BEGIN, each statement is its own transaction.",
        "Keep transactions short: they hold locks and old row versions."
      ],
      c: "BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nINSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 100);\nCOMMIT;",
      pit: "Keeping a transaction open while calling an external HTTP API. Locks are held for seconds, and the session shows as idle in transaction.",
      u: "https://www.postgresql.org/docs/current/tutorial-transactions.html"
    },
    {
      id: "isolation-levels",
      tr: "tx",
      t: "Isolation levels",
      pre: ["transactions-acid"],
      s: "Isolation levels decide what a transaction can see of concurrent changes. Weaker levels allow anomalies such as non-repeatable reads, phantoms, and lost updates.",
      p: [
        "PostgreSQL default is Read Committed: each statement sees a fresh snapshot.",
        "Repeatable Read uses one snapshot for the whole transaction.",
        "Serializable prevents all anomalies but can fail with error 40001; the app must retry.",
        "Read Uncommitted behaves like Read Committed in PostgreSQL."
      ],
      c: "BEGIN ISOLATION LEVEL SERIALIZABLE;\nSELECT count(*) FROM on_call WHERE shift_id = 42;\n-- app checks count > 1, then:\nUPDATE on_call SET active = false\nWHERE shift_id = 42 AND doctor_id = 7;\nCOMMIT;  -- may raise SQLSTATE 40001: retry the whole transaction",
      pit: "Using Serializable or Repeatable Read without retry logic. Serialization failures are expected behaviour, not bugs.",
      u: "https://www.postgresql.org/docs/current/transaction-iso.html"
    },
    {
      id: "mvcc",
      tr: "tx",
      t: "MVCC",
      pre: ["isolation-levels"],
      s: "PostgreSQL uses multi-version concurrency control. An UPDATE writes a new row version instead of overwriting, so readers see a consistent snapshot and do not block writers.",
      p: [
        "Readers never block writers, and writers never block readers.",
        "Old row versions stay until no transaction can see them.",
        "Concurrent writers to the same row still wait for each other."
      ],
      c: "-- session A\nBEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT balance FROM accounts WHERE id = 1;  -- 500\n\n-- session B (not blocked)\nUPDATE accounts SET balance = 400 WHERE id = 1;\n\n-- session A still sees its snapshot\nSELECT balance FROM accounts WHERE id = 1;  -- 500\nCOMMIT;",
      pit: "Assuming an UPDATE is cheap because it changes one column. Every update writes a whole new row version and may update every index.",
      u: "https://www.postgresql.org/docs/current/mvcc-intro.html"
    },
    {
      id: "vacuum-bloat",
      tr: "tx",
      t: "VACUUM & bloat",
      pre: ["mvcc"],
      s: "VACUUM reclaims space from dead row versions and keeps statistics and the visibility map current. Autovacuum does this in the background; your job is to not block it.",
      p: [
        "Long-running or idle-in-transaction sessions stop cleanup everywhere.",
        "High-churn tables may need per-table autovacuum settings.",
        "VACUUM FULL rewrites the table under an exclusive lock; avoid it on live tables."
      ],
      c: "-- find tables with many dead rows\nSELECT relname, n_dead_tup, last_autovacuum\nFROM pg_stat_user_tables\nORDER BY n_dead_tup DESC\nLIMIT 10;\n\n-- find sessions holding back cleanup\nSELECT pid, state, xact_start\nFROM pg_stat_activity\nWHERE state = 'idle in transaction';",
      pit: "Disabling autovacuum because it shows up in monitoring. Bloat grows and, eventually, transaction ID wraparound forces an emergency vacuum.",
      u: "https://www.postgresql.org/docs/current/routine-vacuuming.html"
    },
    {
      id: "locking-deadlocks",
      tr: "tx",
      t: "Locks & deadlocks",
      pre: ["mvcc"],
      s: "Writes take row locks, and DDL takes table locks. A deadlock happens when two transactions each wait for a lock the other holds; PostgreSQL detects it and aborts one.",
      p: [
        "SELECT ... FOR UPDATE locks rows you are about to change.",
        "Lock rows in a consistent order (for example, by id) to avoid deadlocks.",
        "FOR UPDATE SKIP LOCKED builds a simple job queue.",
        "Set lock_timeout so a blocked statement fails fast instead of piling up."
      ],
      c: "BEGIN;\nSELECT id, payload\nFROM jobs\nWHERE status = 'pending'\nORDER BY id\nLIMIT 1\nFOR UPDATE SKIP LOCKED;\n-- process the job, then:\nUPDATE jobs SET status = 'done' WHERE id = $1;\nCOMMIT;",
      pit: "Updating the same rows in different orders from different code paths, such as transfer A to B and B to A. Under load this deadlocks.",
      u: "https://www.postgresql.org/docs/current/explicit-locking.html"
    },
    {
      id: "optimistic-concurrency",
      tr: "tx",
      t: "Optimistic concurrency",
      pre: ["locking-deadlocks", "writing-data"],
      s: "Optimistic concurrency does not hold locks while a user edits. Each row carries a version; an update only succeeds if the version has not changed since it was read.",
      p: [
        "Good for long edit sessions and low-contention data.",
        "Check the affected row count: 0 means someone else changed it first.",
        "Return a conflict (for example HTTP 409) and let the client reload."
      ],
      c: "UPDATE documents\nSET    body = $1,\n       version = version + 1\nWHERE  id = $2\n  AND  version = $3\nRETURNING version;\n-- no row returned: conflict, reload and retry",
      pit: "Ignoring the affected row count. The stale write silently does nothing, and the user thinks the save worked.",
      u: "https://www.postgresql.org/docs/current/applevel-consistency.html"
    },

    // ---------- Operations ----------
    {
      id: "security",
      tr: "ops",
      t: "Security & RLS",
      pre: ["select-filter", "constraints-keys"],
      s: "Give each application role only the privileges it needs, always pass values as parameters, and use row-level security when tenants share tables.",
      p: [
        "The app should not connect as a superuser or the table owner.",
        "Parameterized queries prevent SQL injection; escaping by hand does not.",
        "RLS policies filter rows per user or tenant inside the database.",
        "Table owners bypass RLS unless you use FORCE ROW LEVEL SECURITY."
      ],
      c: "CREATE ROLE app_rw LOGIN;\nGRANT SELECT, INSERT, UPDATE ON orders TO app_rw;\n\nALTER TABLE orders ENABLE ROW LEVEL SECURITY;\nCREATE POLICY tenant_isolation ON orders\n  USING (tenant_id = current_setting('app.tenant_id')::bigint);",
      pit: "Building SQL with string concatenation, such as \"WHERE email = '\" + input + \"'\". That is SQL injection; use bind parameters.",
      u: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
    },
    {
      id: "connection-pooling",
      tr: "ops",
      t: "Connection pooling",
      pre: ["transactions-acid"],
      s: "Each PostgreSQL connection is a separate server process, so connections are expensive. A pool reuses a small number of them across many requests.",
      p: [
        "App-side pools (in the driver) are the first layer.",
        "PgBouncer in transaction mode lets many app instances share few server connections.",
        "Transaction mode does not keep session state: SET, temp tables, session advisory locks.",
        "A smaller pool is often faster than a larger one."
      ],
      c: "; pgbouncer.ini\n[databases]\napp = host=10.0.0.5 dbname=app\n\n[pgbouncer]\npool_mode = transaction\ndefault_pool_size = 20\nmax_client_conn = 2000",
      pit: "Scaling app instances without counting connections. Each pool opens its own connections until the server hits max_connections and refuses new ones.",
      u: "https://www.pgbouncer.org/features.html"
    },
    {
      id: "migrations",
      tr: "ops",
      t: "Safe migrations",
      pre: ["locking-deadlocks", "constraints-keys"],
      s: "Schema changes run against a live database. Version them in code, and make each step backward compatible so old and new app versions can run at the same time.",
      p: [
        "Expand then contract: add new columns, deploy code, backfill, then remove the old.",
        "Set lock_timeout so a migration waiting on a lock does not block all traffic.",
        "Add foreign keys and CHECKs as NOT VALID, then VALIDATE separately.",
        "Build indexes with CREATE INDEX CONCURRENTLY (not inside a transaction)."
      ],
      c: "SET lock_timeout = '5s';\nALTER TABLE orders ADD COLUMN region text;\n\nALTER TABLE orders\n  ADD CONSTRAINT orders_region_fk\n  FOREIGN KEY (region) REFERENCES regions(code) NOT VALID;\n\nALTER TABLE orders VALIDATE CONSTRAINT orders_region_fk;",
      pit: "Renaming or dropping a column in the same deploy as the code change. Old app instances still running will fail on every request.",
      u: "https://www.postgresql.org/docs/current/sql-altertable.html"
    },
    {
      id: "backups-pitr",
      tr: "ops",
      t: "Backups & PITR",
      pre: ["transactions-acid"],
      s: "Point-in-time recovery combines a base backup with archived WAL so you can restore to any moment, such as just before a bad DELETE. pg_dump makes logical snapshots but cannot do PITR.",
      p: [
        "Base backup plus continuous WAL archiving gives PITR.",
        "pg_dump suits small databases, migrations between versions, and copying data.",
        "Store backups away from the primary and encrypt them.",
        "Test restores on a schedule; an untested backup is a guess."
      ],
      c: "# postgresql.conf\nwal_level = replica\narchive_mode = on\narchive_command = 'test ! -f /archive/%f && cp %p /archive/%f'\n\n# take a base backup\npg_basebackup -D /backups/base -Ft -z -P\n\n# restore: set recovery_target_time = '2026-10-14 09:59:00+00'",
      pit: "Never practising a restore. The first real restore is when you discover missing WAL files or how long recovery actually takes.",
      u: "https://www.postgresql.org/docs/current/continuous-archiving.html"
    },
    {
      id: "replication",
      tr: "ops",
      t: "Replication",
      pre: ["backups-pitr", "mvcc"],
      s: "Streaming replication ships WAL from a primary to standbys. Standbys provide failover and can serve read-only queries as read replicas.",
      p: [
        "Asynchronous replication is the default; replicas can lag behind.",
        "Synchronous replication waits for a standby and adds commit latency.",
        "Logical replication copies selected tables and can cross major versions.",
        "Route reads that must see the user's own writes to the primary."
      ],
      c: "-- on the primary: how far behind is each replica?\nSELECT client_addr,\n       state,\n       replay_lag\nFROM pg_stat_replication;\n\n-- on a replica\nSELECT pg_is_in_recovery();  -- true",
      pit: "Sending a read to a replica right after a write. The replica has not replayed it yet, and the user sees their change disappear.",
      u: "https://www.postgresql.org/docs/current/high-availability.html"
    },

    // ---------- Beyond relational ----------
    {
      id: "redis-caching",
      tr: "nosql",
      t: "Redis & caching",
      pre: ["query-optimization", "denormalization"],
      s: "Redis is an in-memory key-value store with rich data types. It is the usual choice for caching, rate limits, sessions and short-lived counters next to a relational database.",
      p: [
        "Cache-aside: read the cache, on a miss read the database and store with a TTL.",
        "Always set a TTL; decide how stale a value may be.",
        "Invalidate or overwrite the key when the source row changes.",
        "Treat Redis as a cache unless you have configured and tested its persistence."
      ],
      c: "# cache-aside for a product, 5 minute TTL\nGET product:42\n# miss -> read from PostgreSQL, then:\nSET product:42 '{\"id\":42,\"name\":\"Lamp\"}' EX 300\n\n# simple rate limit per user per minute\nINCR rl:user:7:202610140959\nEXPIRE rl:user:7:202610140959 60",
      pit: "Caching without TTLs or invalidation. Users see stale data, and memory fills until Redis starts evicting or rejecting writes.",
      u: "https://redis.io/docs/latest/develop/data-types/"
    },
    {
      id: "document-stores",
      tr: "nosql",
      t: "Document stores",
      pre: ["jsonb", "denormalization"],
      s: "Document databases such as MongoDB store each record as a JSON-like document. You model around how the app reads data: embed what is read together, reference what is shared or unbounded.",
      p: [
        "Embed one-to-few data that is always loaded with the parent.",
        "Reference data that is large, shared, or grows without limit.",
        "A single document write is atomic; multi-document transactions exist but cost more.",
        "A MongoDB document has a 16 MB size limit."
      ],
      c: "db.orders.insertOne({\n  customerId: ObjectId(\"665f1c2e9b1e8a3d4c2b1a01\"),\n  status: \"paid\",\n  items: [\n    { sku: \"LAMP-1\", qty: 2, price: 19.99 },\n    { sku: \"BULB-4\", qty: 4, price: 3.50 }\n  ],\n  createdAt: new Date()\n});\ndb.orders.createIndex({ customerId: 1, createdAt: -1 });",
      pit: "Embedding an array that grows without bound, such as every comment on a post. Documents get huge, slow to update, and can hit the size limit.",
      u: "https://www.mongodb.com/docs/manual/data-modeling/"
    },
    {
      id: "sharding",
      tr: "nosql",
      t: "Sharding",
      pre: ["partitioning", "replication"],
      s: "Sharding spreads data across several servers by a shard key. It scales writes and storage beyond one machine, at the cost of harder queries, transactions and operations.",
      p: [
        "The shard key decides everything: pick one with high cardinality and even load.",
        "Queries that include the shard key go to one shard; others fan out to all.",
        "Exhaust indexes, tuning, bigger hardware and read replicas first.",
        "For PostgreSQL, extensions such as Citus add sharding."
      ],
      c: "// MongoDB: hashed shard key spreads writes evenly\nsh.shardCollection(\"shop.orders\", { customerId: \"hashed\" })\n\n// targeted: hits one shard\ndb.orders.find({ customerId: ObjectId(\"665f1c2e9b1e8a3d4c2b1a01\") })\n\n// scatter-gather: hits every shard\ndb.orders.find({ status: \"pending\" })",
      pit: "Sharding on a monotonically increasing key such as a timestamp with range sharding. All new writes land on one hot shard.",
      u: "https://www.mongodb.com/docs/manual/sharding/"
    },
    {
      id: "column-timeseries",
      tr: "nosql",
      t: "Column & time-series",
      pre: ["document-stores", "partitioning"],
      s: "Wide-column stores (Cassandra, ScyllaDB) and time-series databases are built for very high write rates and queries known in advance. You design one table per query pattern, not per entity.",
      p: [
        "Wide-column: the partition key decides placement; queries must provide it.",
        "Time-series: data arrives in time order and is read by time range, then aged out.",
        "MongoDB time series collections and TimescaleDB on PostgreSQL cover many cases without a new system.",
        "Columnar analytics engines suit aggregates over huge history, not row lookups."
      ],
      c: "db.createCollection(\"readings\", {\n  timeseries: {\n    timeField: \"ts\",\n    metaField: \"sensorId\",\n    granularity: \"minutes\"\n  },\n  expireAfterSeconds: 60 * 60 * 24 * 90\n});\ndb.readings.insertOne({ sensorId: \"s-17\", ts: new Date(), temp: 21.4 });",
      pit: "Modeling a wide-column store like a relational schema and expecting ad-hoc joins and filters. Queries not designed into the keys are slow or impossible.",
      u: "https://www.mongodb.com/docs/manual/core/timeseries-collections/"
    },
    {
      id: "choosing-database",
      tr: "nosql",
      t: "Choosing a database",
      pre: ["sharding", "redis-caching", "column-timeseries", "optimistic-concurrency"],
      s: "Start from the access patterns, consistency needs and team skills, not from fashion. For most application data, PostgreSQL is the default and other stores are added for a specific job.",
      p: [
        "Relational: related entities, transactions, ad-hoc queries, reporting.",
        "Key-value (Redis): caching, sessions, counters, rate limits.",
        "Document: self-contained aggregates read and written as a unit.",
        "Wide-column and time-series: huge write volume with known query shapes.",
        "Every extra store adds backups, monitoring, and data to keep in sync."
      ],
      c: "-- decision checklist for a new feature\n-- 1. What are the top 5 queries and their latency targets?\n-- 2. Do writes across entities need to be atomic?\n-- 3. Expected size and write rate in 2 years?\n-- 4. Can PostgreSQL (indexes, jsonb, partitioning) meet it?\n-- 5. If not, which store, and who operates it?",
      pit: "Picking a NoSQL store for scale you do not have yet, then rebuilding joins, constraints and transactions in application code.",
      u: "https://www.postgresql.org/docs/current/intro-whatis.html"
    }
  ]
};
