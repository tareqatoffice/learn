# Phase 3 — Node.js Production Patterns

> Builds directly on Phase 1 (`notes/01-js-internals.md`). The event loop phases
> (timers → pending → poll → check → close) and the rule "heavy synchronous work
> blocks I/O" are the foundation for everything here. Re-read §1.2 if the words
> "poll phase" or "starving the event loop" feel fuzzy.

---

## 3.1 Node.js Architecture for Production

### The Big Picture: V8 + libuv

In Phase 1 we said "Node.js = V8 + libuv". Let's make that concrete. V8 runs your
JavaScript. **libuv** is a C library that gives Node its asynchronous, event-driven
I/O — the event loop *is* libuv's loop. But libuv is not single-threaded under the
hood. It has two ways to do async work:

```
┌──────────────────────────────────────────────────────────────┐
│                     Your JS (single thread)                    │
│   runs on V8, drives the event loop (the libuv loop)           │
└───────────────┬───────────────────────────┬──────────────────┘
                │                            │
        ┌───────▼────────┐          ┌────────▼─────────┐
        │  Kernel async  │          │   libuv thread   │
        │  (epoll/kqueue │          │      pool        │
        │   /IOCP)       │          │  (default 4      │
        │                │          │   threads)       │
        │  network I/O   │          │  file I/O, DNS   │
        │  TCP/UDP       │          │  lookup, crypto, │
        │  sockets       │          │  zlib            │
        └────────────────┘          └──────────────────┘
```

**Two completely different mechanisms — this trips up almost everyone:**

1. **Network I/O is NOT on the thread pool.** Sockets use the OS's native async
   notification (epoll on Linux, kqueue on macOS, IOCP on Windows). The kernel
   tells libuv "this socket is readable" and the poll phase picks it up. This
   scales to tens of thousands of connections with zero extra threads.

2. **Some operations have no async OS API**, so libuv fakes async by running the
   blocking call on a background **thread pool**. These are:
   - **File system operations** (`fs.readFile`, `fs.writeFile`, etc.)
   - **DNS lookups** via `dns.lookup` (which calls `getaddrinfo`, a blocking C call)
   - **`crypto`** (`pbkdf2`, `randomBytes`, `scrypt`) — CPU-heavy
   - **`zlib`** (gzip/deflate compression)

> **.NET analogy:** This is similar to how .NET's `Task`-based I/O uses true async
> I/O completion ports for sockets, but `Task.Run` shoves CPU work onto the
> `ThreadPool`. libuv's thread pool is roughly the libuv equivalent of the CLR's
> managed thread pool — but much smaller by default.

### UV_THREADPOOL_SIZE — the 4-thread bottleneck

The thread pool defaults to **4 threads**. This is a classic production gotcha:
if you fire 5 concurrent `fs` reads, the 5th waits for a thread to free up.

```js
const crypto = require('crypto');

// Each pbkdf2 call grabs a thread-pool thread and holds it for the whole hash.
// With the default pool size of 4:
const start = Date.now();
for (let i = 0; i < 8; i++) {
  crypto.pbkdf2('secret', 'salt', 100000, 64, 'sha512', () => {
    // The first 4 finish at roughly time T.
    // The next 4 only START at T (they waited for a free thread),
    // so they finish at roughly 2T — a clear two-step staircase.
    console.log(`hash ${i} done at`, Date.now() - start, 'ms');
  });
}
```

Tune it with the **`UV_THREADPOOL_SIZE`** environment variable. It must be set
**before** the loop is created (i.e. before any I/O), so set it in the
environment, not at runtime:

```bash
# Bump to 8 if your workload does heavy parallel file/crypto/zlib work.
# Max is 1024. Rule of thumb: number of CPU cores is a sane starting point.
UV_THREADPOOL_SIZE=8 node server.js
```

```js
// Setting it from inside the process only works if you do it before ANY async
// I/O has happened — and even then it's fragile. Prefer the env var.
process.env.UV_THREADPOOL_SIZE = '8'; // ⚠️ unreliable once the loop is warm
```

**Key insight:** raising `UV_THREADPOOL_SIZE` does NOT help network throughput
(network isn't on the pool). It only helps file/DNS/crypto/zlib concurrency. And
more threads than CPU cores just causes context-switch thrash for CPU-bound work.

### worker_threads — real parallelism for CPU-bound work

The event loop is single-threaded for *your JavaScript*. A tight CPU loop (parsing,
hashing in JS, image manipulation, big JSON transforms) blocks every other request
(see Phase 1 §1.2 "Starving the Event Loop"). The thread pool above is internal to
libuv — you can't put *your* JS on it. For your own CPU-bound JS, use
**`worker_threads`**: real OS threads, each with its own V8 isolate and event loop.

```js
// ── main.js ───────────────────────────────────────────────────────────────
const { Worker } = require('node:worker_threads');

/**
 * Run a CPU-bound task in a worker thread and get a Promise back.
 * The main event loop stays free to handle HTTP requests during the work.
 */
function runFib(n) {
  return new Promise((resolve, reject) => {
    // Spawning a worker has real cost (~10-50ms + memory for a fresh V8 isolate).
    // In production you POOL workers rather than spawn per task — see piscina below.
    const worker = new Worker('./fib-worker.js', {
      workerData: { n }, // the only data passed in at construction
    });

    // Workers communicate via message passing — NOT shared memory by default.
    // Data is structured-cloned across the boundary (like postMessage in browsers).
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

(async () => {
  // These run truly in parallel on separate cores — not just concurrently.
  const [a, b] = await Promise.all([runFib(42), runFib(43)]);
  console.log({ a, b });
})();
```

```js
// ── fib-worker.js ─────────────────────────────────────────────────────────
const { workerData, parentPort } = require('node:worker_threads');

// Deliberately naive: a CPU-bound computation that would block the main thread.
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const result = fib(workerData.n);

// Send the result back to the main thread. After this the worker can exit.
parentPort.postMessage(result);
```

**Passing data without copying — `SharedArrayBuffer` & transferables:**

```js
// Structured clone COPIES data across the worker boundary. For a 100MB buffer
// that's a 100MB copy. Two ways to avoid it:

// 1. Transferable: ownership MOVES to the worker; the sender can no longer use it.
const buf = new ArrayBuffer(100 * 1024 * 1024);
worker.postMessage(buf, [buf]); // second arg = transfer list (zero-copy move)
// buf is now "detached" (byteLength === 0) in the main thread.

// 2. SharedArrayBuffer: BOTH threads see the same memory simultaneously.
const shared = new SharedArrayBuffer(1024);
const view = new Int32Array(shared);
worker.postMessage(shared); // no copy, no transfer — genuinely shared
// Use Atomics.* for safe concurrent reads/writes (Atomics.add, Atomics.wait, ...).
```

**In practice, use a worker pool.** Spawning a worker per request is wasteful.
The `piscina` library is the de-facto pool:

```js
const Piscina = require('piscina');
const path = require('node:path');

const pool = new Piscina({
  filename: path.resolve(__dirname, 'fib-worker.js'),
  maxThreads: 4, // typically = number of physical cores for CPU-bound work
});

// pool.run() queues the task and resolves when a free worker finishes it.
const result = await pool.run({ n: 42 });
```

> **.NET analogy:** `worker_threads` ≈ `Task.Run` onto the CLR thread pool for
> CPU-bound work, except each Node worker is a *fully isolated* V8 instance with no
> shared heap (so no lock contention, but you pay for message passing). `piscina`
> ≈ letting the .NET `ThreadPool` manage and reuse threads for you.

### cluster — multi-process across cores

`worker_threads` shares the process (and memory, if you opt in). The **`cluster`**
module takes a different approach: it **forks multiple Node *processes*** that all
share the same listening socket. The OS load-balances incoming connections across
them. This is how you use all your CPU cores for a *network-bound* server.

```js
const cluster = require('node:cluster');
const os = require('node:os');
const http = require('node:http');

if (cluster.isPrimary) {
  const cpuCount = os.availableParallelism(); // physical cores available to us
  console.log(`Primary ${process.pid} forking ${cpuCount} workers`);

  // Fork one worker per core. Each is a separate OS process with its own V8 + loop.
  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  // Self-healing: respawn a worker if one dies (crash resilience).
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}); restarting`);
    cluster.fork();
  });
} else {
  // Worker processes share the SAME server port — the primary distributes
  // incoming connections (round-robin on Linux/macOS by default).
  http
    .createServer((req, res) => {
      res.end(`Handled by worker ${process.pid}\n`);
    })
    .listen(3000);

  console.log(`Worker ${process.pid} listening`);
}
```

### worker_threads vs cluster — choosing

```
                  worker_threads                 cluster
                  ───────────────                ───────
Isolation         threads (1 process)            separate processes
Memory            can share (SharedArrayBuffer)  fully isolated, no sharing
Best for          CPU-bound JS computation       scaling network I/O across cores
Communication     postMessage / shared memory    IPC (slower) / shared socket
Crash blast       crashes whole process          one worker dies, others survive
Startup cost      lower (~10-50ms)               higher (full process fork)
```

- **CPU-bound work** (hashing, parsing, image resize) → **`worker_threads`** (often pooled with `piscina`).
- **Scale a web server across cores** → **`cluster`** (or just run N container replicas — see Phase 9).
- Both together is valid: a cluster of processes, each spawning workers for CPU tasks.

### PM2 vs native cluster

`cluster` is the low-level primitive. **PM2** is a process manager built on top of
it that you generally reach for in production *if you're not in a container*:

```bash
# Run app.js in cluster mode, one instance per CPU core, with a name.
pm2 start app.js -i max --name api

# PM2 gives you, for free, things cluster makes you write by hand:
pm2 reload api      # zero-downtime rolling restart (drains connections)
pm2 logs api        # aggregated logs across all instances
pm2 monit           # live CPU/memory dashboard
pm2 startup         # generate a systemd/init script to survive reboots
pm2 save            # persist the current process list
```

**When to use which:**
- **Native `cluster`** — when you want full control, minimal dependencies, or you're
  inside a single container and rolling your own supervision.
- **PM2** — VPS/bare-metal deploys where you want auto-restart, log management,
  zero-downtime reloads, and a monitoring dashboard without writing it yourself.
- **Neither** — in Kubernetes/Docker, prefer **one Node process per container** and
  let the orchestrator scale replicas (Phase 9). Running `cluster` *inside* a
  container fights the orchestrator's own scaling and complicates health checks.

> **.NET analogy:** PM2 is roughly the "Kestrel behind a process supervisor" story —
> like running your app under systemd or IIS with auto-restart and multiple worker
> processes, except IIS/ASP.NET typically scales with threads inside one process
> whereas Node scales with *processes* because of the single-threaded loop.

---

## 3.2 Streams

Streams are Node's abstraction for processing data **incrementally** — chunk by
chunk — instead of loading it all into memory. If you've ever done
`fs.readFile` on a 2GB file and watched your process OOM, streams are the fix.

> **.NET analogy:** Node streams ≈ `System.IO.Stream` + `IAsyncEnumerable<T>`.
> Backpressure (below) is conceptually `Channel<T>` with a bounded capacity.

### The Four Stream Types

```
Readable    →  source of data you read FROM   (fs.createReadStream, req, process.stdin)
Writable    →  sink you write TO               (fs.createWriteStream, res, process.stdout)
Duplex      →  both, independent R + W         (TCP socket, net.Socket)
Transform   →  Duplex where output = f(input)  (zlib.createGzip, crypto cipher, your own)
```

```
   Readable           Transform              Writable
  ┌─────────┐        ┌──────────┐          ┌─────────┐
  │ file.gz │──pipe─▶│ gunzip   │──pipe───▶│ stdout  │
  └─────────┘        └──────────┘          └─────────┘
   emits 'data'       in → transform → out  consumes, signals
   chunks             chunks                ready / full
```

### Backpressure — the whole point of `pipe()`

A fast Readable can produce data faster than a slow Writable can consume it. Without
flow control, chunks pile up in memory until you OOM. **Backpressure** is the
mechanism that makes the producer pause when the consumer is full.

```
producer fast ──────▶  [ internal buffer ]  ──────▶ consumer slow
                              │
            write() returns false when buffer is full (>= highWaterMark)
                              │
                  producer should .pause() until 'drain' fires
```

The naive manual version is full of footguns:

```js
// ❌ BROKEN: ignores the return value of write() → unbounded memory growth.
readable.on('data', (chunk) => {
  writable.write(chunk); // if this returns false, we're overflowing the buffer
});
```

The correct manual version respects backpressure:

```js
// ✅ Manual backpressure handling (this is roughly what pipe does for you):
readable.on('data', (chunk) => {
  // write() returns false when the internal buffer has hit highWaterMark.
  const ok = writable.write(chunk);
  if (!ok) {
    readable.pause();                 // stop pulling from the source
    writable.once('drain', () => {    // resume only when the sink has caught up
      readable.resume();
    });
  }
});
readable.on('end', () => writable.end());
```

**`pipe()` handles all of this for you** — pause/resume, drain, and `end`
propagation:

```js
// ✅ pipe() automatically manages backpressure. This is the whole reason it exists.
readable.pipe(writable);
```

But `pipe()` does **not** forward errors or clean up on failure. The modern,
correct API is **`pipeline`** (or its promise form), which propagates errors and
destroys all streams on failure to prevent leaks:

```js
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const zlib = require('node:zlib');

// pipeline: backpressure + error propagation + automatic cleanup of ALL streams.
async function gzipFile(src, dest) {
  await pipeline(
    fs.createReadStream(src),   // Readable
    zlib.createGzip(),          // Transform (also runs on the libuv thread pool!)
    fs.createWriteStream(dest), // Writable
  );
  // If ANY stage errors, pipeline rejects AND destroys every stream. No leaks.
  console.log('done');
}
```

### Streaming a large file without blowing memory

```js
// ❌ Loads the ENTIRE file into RAM. A 2GB file = 2GB resident + GC pressure.
const data = await fs.promises.readFile('huge.log');
res.end(data);

// ✅ Streams it in highWaterMark-sized chunks (default 64KB). Constant memory.
fs.createReadStream('huge.log').pipe(res);
```

### highWaterMark — the buffer threshold

Every stream has a `highWaterMark` — the buffer size at which it applies
backpressure. Defaults: **64KB** for byte streams, **16 objects** for object-mode
streams.

```js
// Tune for throughput vs memory. Bigger = fewer syscalls but more memory per stream.
const rs = fs.createReadStream('huge.log', { highWaterMark: 256 * 1024 }); // 256KB
```

### A backpressure-aware Transform stream

Here's a custom Transform that uppercases text, written to respect backpressure
correctly — the `callback` is the backpressure signal:

```js
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');

class UppercaseTransform extends Transform {
  constructor(options) {
    // objectMode: false means we deal in Buffers/strings, not arbitrary objects.
    super({ ...options, highWaterMark: 64 * 1024 });
  }

  /**
   * Called for each chunk. The framework will NOT send the next chunk until we
   * call `callback()` — THAT is how a Transform participates in backpressure.
   * If transforming is slow, calling back late naturally slows the source.
   */
  _transform(chunk, _encoding, callback) {
    const upper = chunk.toString('utf8').toUpperCase();

    // Two ways to emit output:
    //   this.push(upper); callback();
    // OR pass it as the 2nd arg to callback (equivalent, cleaner):
    callback(null, upper);

    // If we wanted to emit MANY chunks for one input, we'd call this.push()
    // multiple times, then callback() once with no data.
  }

  /**
   * Optional: called once when the input ends, BEFORE 'finish'. Use it to flush
   * any buffered remainder (e.g. a partial line, a final cipher block).
   */
  _flush(callback) {
    // e.g. this.push(leftoverBuffer);
    callback();
  }
}

// Wire it up with full backpressure + error handling:
await pipeline(
  fs.createReadStream('input.txt', { highWaterMark: 64 * 1024 }),
  new UppercaseTransform(),
  fs.createWriteStream('output.txt'),
);
```

### Streams as async iterables (ties back to Phase 1 §1.7)

Readable streams implement `Symbol.asyncIterator`, so `for await...of` works — often
the most readable consumer pattern:

```js
// Each iteration yields a chunk; the loop body naturally applies backpressure
// because the stream waits for your `await`ed work before producing the next chunk.
async function countBytes(path) {
  let total = 0;
  for await (const chunk of fs.createReadStream(path)) {
    total += chunk.length;
  }
  return total;
}
```

### Streams in HTTP

This is where streams matter most in real servers — `req` and `res` *are* streams.

```js
const http = require('node:http');
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');

http
  .createServer(async (req, res) => {
    // req is a Readable (the request BODY). Frameworks like Express buffer it for
    // you into req.body — but for uploads you want to stream it straight to disk
    // WITHOUT buffering the whole thing in memory.
    if (req.method === 'POST' && req.url === '/upload') {
      try {
        // Stream the incoming body directly to a file. Constant memory regardless
        // of upload size. pipeline handles backpressure + cleanup.
        await pipeline(req, fs.createWriteStream('./uploaded.bin'));
        res.writeHead(201).end('uploaded\n');
      } catch (err) {
        res.writeHead(500).end('upload failed\n');
      }
      return;
    }

    // res is a Writable (the response). Stream a big file out to the client.
    if (req.url === '/download') {
      // If the client is slow, backpressure pauses the file read automatically.
      fs.createReadStream('./huge.log').pipe(res);
      return;
    }

    res.writeHead(404).end();
  })
  .listen(3000);
```

---

## 3.3 Error Handling — Production-Grade

### Error vs Operational Error — the core distinction

```
Operational errors                 Programmer errors (bugs)
──────────────────                 ────────────────────────
Expected at runtime.               Unexpected. A defect in the code.
The system anticipated them.       The system did NOT anticipate them.

  - invalid user input               - reading a property of undefined
  - failed DB connection             - calling a non-function
  - 404 / record not found           - passing wrong type to a function
  - request timeout                  - forgot to handle a Promise
  - rate limit exceeded              - off-by-one / logic bug

→ HANDLE them: return 4xx/5xx,      → DON'T try to recover. Log, alert, and
  retry, degrade gracefully.          CRASH (let the supervisor restart clean).
  The process stays healthy.          A buggy process is in an unknown state.
```

The dangerous mistake is treating programmer errors as operational — swallowing a
bug in a `try/catch` and limping along with corrupted state. The robust posture:
**recover from operational errors; crash-and-restart on programmer errors.**

```js
// A custom Error subclass that marks an error as operational (expected/handled).
class AppError extends Error {
  /**
   * @param {string}  message     human-readable message
   * @param {number}  statusCode  HTTP status to map to (operational errors map cleanly)
   * @param {boolean} isOperational  true = expected, safe to handle and keep running
   */
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Preserve the stack trace, excluding this constructor frame (V8-specific).
    Error.captureStackTrace(this, this.constructor);
  }
}

// Concrete operational errors:
class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, true);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, true);
  }
}
```

### Centralised error handler

Don't scatter error-to-HTTP mapping across every route. Funnel everything through
one handler that decides: respond, log, and (for non-operational errors) crash.

```js
// errorHandler.js — the single place that knows how to react to ANY error.
function handleError(err, res) {
  // 1. Always log it (structured — see §3.3 logging below).
  logger.error({ err }, 'request failed');

  // 2. Operational errors → map to a clean client response. Process stays up.
  if (err instanceof AppError && err.isOperational) {
    return res?.writeHead(err.statusCode, { 'content-type': 'application/json' })
      .end(JSON.stringify({ error: err.message }));
  }

  // 3. Programmer error / unknown → respond 500, then CRASH. We're in an unknown
  //    state; restarting is safer than continuing. Let PM2/K8s restart us.
  res?.writeHead(500).end(JSON.stringify({ error: 'Internal Server Error' }));

  // Give logs/inflight responses a moment to flush, then exit non-zero.
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 100).unref();
}
```

### Unhandled rejections & uncaught exceptions — the last line of defence

```js
// An unhandled Promise rejection means a programmer FORGOT to .catch() or await.
// As of Node 15+, the default is to CRASH (terminate the process). Make it explicit
// and log first so you have a forensic trail.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandledRejection — crashing');
  throw reason; // promote to uncaughtException → triggers the handler below
});

// An uncaught synchronous exception: the process is in an undefined state.
// Log it, then crash. Do NOT resume serving requests — that's the trap.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException — crashing');
  // Flush logs, then hard-exit. A supervisor restarts a clean process.
  process.exit(1);
});
```

> **Why crash instead of recover?** After an uncaught exception, a connection might
> be half-written, a transaction half-committed, a lock held. There is no safe way
> to know. A fresh process is the only guaranteed-clean state. This is the
> "let it crash" philosophy (Erlang/OTP) applied to Node.

### AsyncLocalStorage — request-scoped context without prop-drilling

You want a correlation/request ID attached to *every* log line for a request, but
threading a `requestId` parameter through every function is miserable.
**`AsyncLocalStorage`** gives you a value that's available anywhere in the async
call chain of a request — and *isolated per request* even though everything shares
one thread.

```js
const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');

// One store for the whole app. Think of it as thread-local storage, but for
// async contexts on a single thread.
const als = new AsyncLocalStorage();

function requestContextMiddleware(req, res, next) {
  const store = {
    requestId: req.headers['x-request-id'] ?? crypto.randomUUID(),
    startedAt: Date.now(),
  };
  // EVERYTHING async that happens inside this callback — awaits, timers, DB calls,
  // nested function calls — can read `store` via als.getStore(). Each concurrent
  // request gets its OWN store; they never bleed into each other.
  als.run(store, () => next());
}

// Anywhere deep in the call stack — no parameter passing needed:
function getRequestId() {
  return als.getStore()?.requestId ?? 'no-context';
}

// A logger that auto-injects the request id into every line:
function log(message, extra = {}) {
  console.log(JSON.stringify({
    requestId: getRequestId(), // pulled from async context, magically
    message,
    ...extra,
  }));
}
```

> **.NET analogy:** `AsyncLocalStorage` is the direct counterpart of
> `AsyncLocal<T>` in .NET (and how `IHttpContextAccessor` flows `HttpContext`
> across `await` boundaries). Same concept, same purpose: ambient context that
> follows the logical async flow rather than the physical thread.

### Error serialisation & structured logging

`JSON.stringify(error)` returns `{}` — `Error` properties (`message`, `stack`) are
non-enumerable. You must serialise deliberately, and you should log **structured
JSON**, not interpolated strings, so log aggregators (ELK, Loki, Datadog) can query
fields.

```js
// ❌ JSON.stringify(new Error('boom')) === '{}'   — message & stack are lost!

// ✅ Use a logger that knows how to serialise errors. Pino is the production default
//    (fast, structured JSON, ~5x faster than Winston, async by design).
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // serializers turn an `err` field into { type, message, stack } automatically.
  serializers: { err: pino.stdSerializers.err },
});

try {
  throw new ValidationError('email is required');
} catch (err) {
  // Pass the error under the `err` key so the serializer kicks in.
  // Output is one-line JSON: {"level":50,"err":{"type":"ValidationError",
  //   "message":"email is required","stack":"..."},"msg":"validation failed"}
  logger.error({ err, requestId: getRequestId() }, 'validation failed');
}
```

> **.NET analogy:** Pino ≈ Serilog. Structured logging with key/value pairs that
> sinks can index — the same philosophy as Serilog's message templates and enrichers.

---

## 3.4 Configuration Management

### The 12-Factor config principle

> **Store config in the environment.** Anything that varies between deploys (dev /
> staging / prod) — DB URLs, ports, API keys, feature flags — lives in environment
> variables, not in code. Code is identical across environments; only the env differs.

This is **Factor III** of the [12-Factor App](https://12factor.net/config). The
litmus test: *could you open-source the codebase right now without leaking
secrets?* If config is in env vars, yes.

> **.NET analogy:** This is `appsettings.json` + environment-specific overrides
> (`appsettings.Production.json`) + `IConfiguration` + `IOptions<T>`. The env-var
> approach is exactly ASP.NET's `ASPNETCORE_ENVIRONMENT` + env-var configuration
> provider.

### dotenv / dotenv-flow

`dotenv` loads a `.env` file into `process.env` for **local development only**
(in real deploys the platform injects env vars directly).

```bash
# .env  — local development. NEVER commit this (see secrets below).
DATABASE_URL=postgres://localhost:5432/dev
PORT=3000
LOG_LEVEL=debug
```

```js
// Load .env into process.env as the VERY FIRST thing the app does.
require('dotenv').config(); // mutates process.env

// dotenv-flow extends this with NODE_ENV cascading, like ASP.NET's appsettings:
//   .env                (committed defaults, no secrets)
//   .env.local          (local overrides, gitignored)
//   .env.development    (per-environment)
//   .env.production
require('dotenv-flow').config();
```

### Typed config with zod — fail fast at startup

Raw `process.env` values are all `string | undefined`. Reading them ad-hoc scattered
through the code means a missing `DATABASE_URL` blows up *at request time*, in
production, hours after deploy. The fix: **validate and parse the entire config
once at startup, and refuse to boot if anything is wrong.**

```js
// config.js — the single source of truth for all configuration.
const { z } = require('zod');

// Define the SHAPE and TYPES of valid configuration. zod coerces strings → typed.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // z.coerce.number() parses the string env var into a real number, with bounds.
  PORT: z.coerce.number().int().positive().default(3000),

  // A required secret: if missing, validation fails and we crash at boot.
  DATABASE_URL: z.string().url(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Optional with a default; coerce '8' → 8.
  UV_THREADPOOL_SIZE: z.coerce.number().int().min(1).max(1024).default(4),
});

// Parse process.env ONCE. If anything is invalid/missing, this THROWS immediately.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: print exactly what's wrong and exit BEFORE the server starts.
  // Far better than a cryptic crash three hours into production.
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Export a frozen, fully-typed config object. The rest of the app imports THIS,
// never process.env directly. (In TS you'd get full inference: config.PORT is number.)
module.exports = Object.freeze(parsed.data);
```

```js
// Everywhere else:
const config = require('./config');
server.listen(config.PORT); // a real number, validated, guaranteed present
```

> **.NET analogy:** This is `IOptions<T>` + `ValidateOnStart()` + data annotations /
> `IValidateOptions<T>`. zod is your FluentValidation, applied to configuration, with
> the fail-fast-at-boot behaviour `services.AddOptions<T>().ValidateOnStart()` gives.

### Secrets management

```
NEVER commit secrets.                 Where secrets actually come from in prod:
─────────────────────                 ─────────────────────────────────────────
- add `.env` to .gitignore            - AWS Secrets Manager / SSM Parameter Store
- commit a `.env.example` with         - HashiCorp Vault
  KEYS but NO values (documents       - Kubernetes Secrets (mounted as env/files)
  what's needed)                       - Doppler / Infisical
- rotate any secret that leaks        - the platform's env var UI (Railway, Render)
  immediately
```

```bash
# .env.example  — COMMIT this. Documents required keys, leaks nothing.
DATABASE_URL=
PORT=3000
LOG_LEVEL=info
```

The app shouldn't care *where* env vars come from — that's the power of Factor III.
Locally it's `.env`; in prod the secret manager injects them. Same `config.js`
validates both.

---

## 3.5 Performance & Profiling

> First principle (from Phase 1): the killer is **blocking the event loop**. Most
> Node perf work is finding the synchronous hot path or the leak, not micro-tuning.

### `--prof` — the built-in V8 profiler

```bash
# Run with the V8 sampling profiler. Produces an isolate-*.log tick file.
node --prof server.js
# ...exercise the app (run load against it), then stop it.

# Turn the raw tick log into a human-readable summary:
node --prof-process isolate-0x*.log > processed.txt
```

```
# processed.txt highlights where CPU time went — look at "Summary":
 ticks  total  nonlib   name
 9523   48.1%   60.2%   JavaScript      ← your JS hot paths
 4102   20.7%          C++              ← native / libuv
  214    1.1%           GC              ← garbage collection pressure
# Then "Bottom up (heavy) profile" shows the hottest individual functions.
```

### clinic.js — the production-grade toolkit

`clinic` wraps the low-level tools with diagnosis and flamegraphs. Three sub-tools:

```bash
npm i -g clinic

# 1. Doctor — diagnoses the CLASS of problem and tells you what to look at.
#    Generates a report: "this looks like an I/O issue" / "event loop is blocked".
clinic doctor --on-port 'autocannon localhost:$PORT' -- node server.js

# 2. Bubbleprof — visualises ASYNC operations and where time is spent waiting
#    (great for "why is my request slow?" when it's I/O latency, not CPU).
clinic bubbleprof --on-port 'autocannon localhost:$PORT' -- node server.js

# 3. Flame — a CPU flamegraph: wide bars = functions burning the most CPU time.
clinic flame --on-port 'autocannon localhost:$PORT' -- node server.js
```

```
Clinic Doctor's recommendation engine maps symptoms → likely cause:
  high event-loop delay + low CPU   → blocked on a slow sync call / I/O
  high CPU, flat event loop         → CPU-bound hot path → move to worker_threads
  sawtooth memory + GC spikes       → allocation churn / possible leak
```

### 0x — one-command flamegraphs

```bash
npx 0x server.js
# Run load, Ctrl-C. It opens an interactive flamegraph in the browser.
# Read it: x-axis = % of samples (NOT time order), y-axis = call-stack depth.
# WIDE frames are where CPU is spent — those are your optimisation targets.
```

### Measuring event-loop lag with `perf_hooks`

The single most important production health metric for Node: **how long is the event
loop delayed?** If it climbs, you're blocking it and every request suffers.

```js
const { monitorEventLoopDelay } = require('node:perf_hooks');

// A high-resolution histogram of event-loop delay, sampled every 20ms.
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

setInterval(() => {
  // Values are in NANOSECONDS. Convert to ms. Watch the mean and p99.
  // A healthy loop: mean < a few ms. If p99 climbs into 10s/100s of ms,
  // something is blocking the loop — go profile it.
  console.log({
    meanMs: (h.mean / 1e6).toFixed(2),
    p99Ms: (h.percentile(99) / 1e6).toFixed(2),
    maxMs: (h.max / 1e6).toFixed(2),
  });
  h.reset();
}, 1000).unref();
```

```js
// Quick-and-dirty lag probe without the histogram: schedule a timer for "now+0"
// and measure how late it actually fires. The lateness IS the loop delay.
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const lagMs = now - last - 1000; // expected 1000ms gap; excess = lag
  if (lagMs > 50) console.warn(`event loop lagging by ${lagMs.toFixed(0)}ms`);
  last = now;
}, 1000).unref();
```

### `process.hrtime.bigint()` — precision timing

`Date.now()` has ~1ms resolution and can jump (NTP, clock adjustments). For measuring
*durations*, use a **monotonic** high-resolution clock.

```js
// Returns nanoseconds as a BigInt from a monotonic source — immune to clock changes.
const start = process.hrtime.bigint();

doExpensiveThing();

const end = process.hrtime.bigint();
// BigInt subtraction → nanoseconds. Divide for ms. Note the 'n' literal & Number().
const durationMs = Number(end - start) / 1e6;
console.log(`took ${durationMs.toFixed(3)} ms`);

// performance.now() (from perf_hooks / global) is the other monotonic option —
// returns fractional milliseconds as a Number; nicer ergonomics, slightly less precision.
```

> **.NET analogy:** `process.hrtime.bigint()` ≈ `Stopwatch` (which wraps
> `QueryPerformanceCounter`) — a monotonic high-resolution timer. `Date.now()` ≈
> `DateTime.UtcNow`: wall-clock, not for measuring elapsed time.

---

## 3.6 HTTP Internals

### `http.IncomingMessage` & `http.ServerResponse` — what frameworks wrap

When you write Express/Fastify, the `req`/`res` you touch are (or wrap) Node's raw
core objects. Knowing them demystifies every framework.

```js
const http = require('node:http');

const server = http.createServer((req, res) => {
  // req is an http.IncomingMessage — and (key insight) a READABLE STREAM (§3.2).
  //   req.method, req.url, req.headers  → the request line + headers
  //   req.on('data') / for await        → the body, as a stream of chunks
  console.log(req.method, req.url, req.httpVersion);

  // res is an http.ServerResponse — and a WRITABLE STREAM.
  //   res.writeHead(status, headers)  → sets status + headers (before any body)
  //   res.write(chunk) / res.end()    → streams the body out (backpressure applies)
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

// keepAliveTimeout: how long an idle keep-alive socket stays open (default 5s).
// headersTimeout: max time to receive the full headers (slow-loris protection).
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000; // should be > keepAliveTimeout
server.listen(3000);
```

> **.NET analogy:** `IncomingMessage`/`ServerResponse` ≈ `HttpContext.Request` /
> `HttpContext.Response`. Express/Fastify are the "middleware + routing" layer the
> way ASP.NET's middleware pipeline sits on top of Kestrel's raw connection handling.

### Keep-alive & connection reuse

Opening a TCP connection (and TLS handshake) is expensive. **HTTP keep-alive** reuses
one connection for many requests instead of reconnecting each time.

```
Without keep-alive:  [TCP+TLS handshake][req/res][close]  × N  ← N handshakes
With keep-alive:     [TCP+TLS handshake][req/res][req/res][req/res]...  ← 1 handshake
```

```js
// As a CLIENT, reuse connections with a keep-alive Agent — huge win for
// service-to-service calls (microservices, §Phase 8). Without this, every outbound
// request pays a fresh handshake.
const https = require('node:https');
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,        // cap concurrent sockets per host
  keepAliveMsecs: 1000,  // how often to send keep-alive probes
});
// pass { agent } to your request / fetch options
```

### HTTP/2

HTTP/2 adds **multiplexing**: many concurrent requests/responses over a single
connection (no head-of-line blocking at the HTTP layer), plus header compression
(HPACK) and server push.

```js
const http2 = require('node:http2');
const fs = require('node:fs');

// HTTP/2 in browsers requires TLS, so we need a cert/key.
const server = http2.createSecureServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
});

server.on('stream', (stream, headers) => {
  // In HTTP/2 you work with STREAMS, not req/res. Each request is a multiplexed
  // stream over the shared connection.
  stream.respond({ ':status': 200, 'content-type': 'text/plain' });
  stream.end('hello over h2\n');
});

server.listen(8443);
```

### HTTPS / TLS termination — in Node vs upstream

**TLS termination** = where encrypted HTTPS gets decrypted to plain HTTP.

```
Option A — terminate UPSTREAM (the common production setup):

  client ──HTTPS──▶ [ Nginx / ALB / Cloudflare ] ──HTTP──▶ [ Node ]
                     (handles certs, TLS, h2)               (plain HTTP,
                                                             simpler, faster)

Option B — terminate IN Node (simpler infra, fewer hops):

  client ──HTTPS──▶ [ Node https.createServer({cert,key}) ]
```

```js
// Terminating TLS directly in Node (Option B) — fine for small/edge deploys.
const https = require('node:https');
const fs = require('node:fs');

https
  .createServer(
    { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') },
    (req, res) => res.end('secure\n'),
  )
  .listen(443);
```

**Production guidance:** terminate TLS **upstream** (load balancer / reverse proxy /
CDN). It centralises certificate management (Let's Encrypt auto-renewal), offloads
crypto from Node, and lets the proxy handle HTTP/2, compression, and rate limiting.
Node then speaks plain, fast HTTP on the private network. (More in Phase 6 §Security
and Phase 9 §Deployment.)

---

## 3.7 Fastify vs Express — Production Comparison

### Why Fastify is faster

Express is venerable but slow by modern standards. Fastify routinely benchmarks
2–3× its throughput. The speed comes from concrete engineering choices, not magic:

**1. Schema-based serialization (the biggest win).** `JSON.stringify` is slow
because it has to inspect every value's type at runtime. If Fastify knows the
*shape* of your response ahead of time (via a JSON Schema), it compiles a
specialised serializer with `fast-json-stringify` — straight-line code that knows
each field is a string/number, skipping all the runtime type checks.

```js
const fastify = require('fastify')();

fastify.get(
  '/user/:id',
  {
    schema: {
      // Fastify COMPILES this into a bespoke serializer. ~2x faster than
      // JSON.stringify, and it also acts as a whitelist (extra fields are dropped).
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  },
  async (req) => {
    // The returned object is serialized by the compiled serializer, not JSON.stringify.
    return { id: req.params.id, name: 'Alice', secret: 'dropped' }; // `secret` is stripped
  },
);
```

**2. Ajv for validation.** Request validation (params, query, body, headers) uses
**Ajv**, which *compiles* JSON Schemas to optimised validation functions — far
faster than hand-rolled checks running on every request.

**3. Radix-tree router.** Fastify's router (`find-my-way`) uses a radix tree for
O(k) route matching, vs Express's linear scan through a regex array.

**4. Less per-request overhead.** Express runs every request through a middleware
*array* (each `next()` is a closure hop). Fastify's encapsulated plugin model and
lighter request lifecycle do less work per request.

### Plugin architecture vs middleware

```
Express — flat, ordered middleware chain (everything is global by default):

  req → [mw1] → [mw2] → [router] → [mw3] → [errorHandler] → res
        (each calls next(); order is everything; all share one app scope)

Fastify — encapsulated plugin tree (scopes are isolated by default):

  root
   ├── plugin: db (decorates fastify.db)
   ├── plugin: auth   ─┐ these decorators/hooks are
   │                   │ scoped to this branch unless
   └── plugin: routes ─┘ explicitly shared (fastify-plugin)
```

Fastify **plugins** create encapsulated contexts. A decorator or hook registered in
a plugin is visible only within that plugin and its children — *not* leaked
globally. This prevents the "everything is global" entanglement of Express
middleware. To deliberately share across the whole app, wrap with `fastify-plugin`.

```js
const fp = require('fastify-plugin');

// Without fp: `db` is only available inside THIS plugin's encapsulated scope.
// With fp: the decorator breaks out and is available app-wide.
module.exports = fp(async (fastify) => {
  const db = await connectToDb();
  fastify.decorate('db', db); // now fastify.db works everywhere
  fastify.addHook('onClose', async () => db.end()); // clean shutdown hook
});
```

> **.NET analogy:** Fastify plugins with encapsulation are closer to ASP.NET's DI
> *scopes* and modular service registration than Express's flat middleware (which is
> more like a raw `IApplicationBuilder.Use(...)` chain). Hooks (`onRequest`,
> `preHandler`, `onSend`...) map to ASP.NET middleware/filter pipeline stages.

### Type-safe route schemas in Fastify

With TypeScript, the JSON Schema can drive *both* runtime validation and
compile-time types — no duplication. Using a type provider (e.g. `@fastify/type-provider-typebox` or zod):

```ts
import Fastify from 'fastify';
import { z } from 'zod';
import { serializerCompiler, validatorCompiler, ZodTypeProvider }
  from 'fastify-type-provider-zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.post('/users', {
  schema: {
    // One zod schema → runtime validation AND inferred TS types for req.body.
    body: z.object({ name: z.string().min(1), age: z.number().int() }),
    response: { 201: z.object({ id: z.string() }) },
  },
}, async (req) => {
  // req.body is fully typed as { name: string; age: number } — no `as` casting,
  // and it's already validated at runtime by Ajv-compiled-from-zod.
  const { name } = req.body;
  return { id: crypto.randomUUID() };
});
```

### When to still use Express

Fastify is the better default for *new* performance-sensitive services. But Express
still wins when:

- **Ecosystem compatibility** — a huge catalogue of battle-tested middleware
  (`passport` strategies, niche `connect`-style middleware) targets Express's API.
- **Team familiarity / legacy** — the mental model is simpler; existing apps and
  tutorials assume it.
- **Tiny scripts / prototypes** — when raw throughput is irrelevant.
- **Framework on top** — note many higher-level frameworks (incl. NestJS, Phase 5)
  default to Express as the underlying adapter (NestJS supports a Fastify adapter too).

> **Rule of thumb:** new high-throughput API service → **Fastify**. Maintaining or
> extending something that already uses Express, or needing a specific Express-only
> middleware → **Express**. NestJS abstracts over both, so the choice there is an
> adapter detail.

---

## Gotchas

- **`UV_THREADPOOL_SIZE` must be set before the first I/O** — setting `process.env`
  at runtime after the loop is warm usually does nothing. Use the env var.
- **Raising the thread pool does NOT speed up network I/O** — network uses the
  kernel's async (epoll/kqueue/IOCP), not the pool. Only file/DNS/crypto/zlib benefit.
- **`dns.lookup` is on the thread pool; `dns.resolve` is not.** A flood of
  `dns.lookup` calls (the default for `http`/`net`) can starve your 4-thread pool.
  Consider `dns.resolve*` or caching for high-fan-out clients.
- **`pipe()` does not forward errors or clean up.** Use `stream/promises`
  `pipeline` — otherwise an error mid-stream leaks file descriptors.
- **Ignoring `write()`'s return value** → unbounded memory growth. Either honour the
  `false`/`'drain'` dance or use `pipe`/`pipeline`.
- **`JSON.stringify(error)` is `{}`** — `message` and `stack` are non-enumerable.
  Use a logger with an error serializer (Pino `stdSerializers.err`).
- **Don't recover from `uncaughtException` and keep serving** — the process is in an
  unknown state. Log, then crash; let the supervisor restart a clean process.
- **`unhandledRejection` crashes by default in Node 15+** — relying on the old
  "warn and continue" behaviour will bite you on upgrade.
- **`AsyncLocalStorage` context is lost across some callback boundaries** — e.g. if
  you queue work onto a raw `EventEmitter` listener registered outside the `als.run`.
  Most `await`/Promise/timer chains preserve it; raw C++-bound callbacks may not.
- **Worker threads structured-clone their messages** — passing a big object copies
  it. Use transferables or `SharedArrayBuffer` for large payloads.
- **Running `cluster` inside a container** fights the orchestrator. One process per
  container, scale with replicas (Phase 9).
- **`Date.now()` for measuring durations is wrong** — it's wall-clock and can jump
  backwards (NTP). Use `process.hrtime.bigint()` or `performance.now()`.
- **`res.writeHead` after writing the body throws** — headers must be set before any
  `res.write`/`res.end` body bytes go out.

---

## Phase 3 Mini-Project

**Task:** Build a production-shaped **Fastify** server that combines everything in
this phase: worker threads for CPU-bound work, a streaming file-upload endpoint,
typed config, structured logging, and centralised error handling.

**Location:** `examples/phase3-nodejs-server/`

**Requirements:**

1. **Typed config (§3.4):** A `config.ts`/`config.js` that validates `process.env`
   with **zod** at startup and **exits non-zero with a clear message** if anything
   is missing/invalid. The rest of the app imports the frozen config, never
   `process.env`.

2. **Structured logging + request context (§3.3):** Use **Pino** (Fastify ships with
   it built in). Attach a per-request **correlation ID** using **`AsyncLocalStorage`**
   so every log line for a request carries the same `requestId` without
   prop-drilling.

3. **CPU-bound endpoint via worker threads (§3.1):** `POST /hash` accepts a payload
   and runs an intentionally expensive computation (e.g. `crypto.pbkdf2` with high
   iterations, or a naive fib) in a **`piscina` worker pool** — proving the main
   event loop stays responsive. Add a `GET /ping` that must keep replying instantly
   while `/hash` is churning.

4. **Streaming upload endpoint (§3.2):** `POST /upload` streams the request body
   straight to disk with **`stream/promises` `pipeline`** — constant memory
   regardless of file size, with proper backpressure and cleanup on error. Reject
   if `content-length` exceeds a configured max.

5. **Centralised error handling (§3.3):** A single Fastify `setErrorHandler` that
   distinguishes **operational** `AppError`s (→ clean 4xx/5xx JSON) from unexpected
   **programmer errors** (→ 500 + log + the process should be restartable). Wire
   `process.on('unhandledRejection')` and `'uncaughtException')`.

6. **Graceful shutdown (preview of Phase 9):** On `SIGTERM`, stop accepting new
   connections, drain in-flight requests, close the worker pool, then exit 0.

**Hints:**

- `fastify({ logger: true })` gives you Pino for free. Set
  `genReqId` to your correlation-ID function and use a Fastify `onRequest` hook to
  enter the `AsyncLocalStorage` context.
- For the worker pool: `new Piscina({ filename: resolve(__dirname, 'hash-worker.js') })`,
  then `await pool.run(payload)` inside the route handler. Prove non-blocking by
  hammering `/ping` with `autocannon` while `/hash` runs.
- For the upload: `await pipeline(request.raw, createWriteStream(dest))`. Disable
  Fastify's body parsing for that route (`addContentTypeParser` or
  `bodyLimit`) so you get the raw stream.
- Validate `/hash` body and serialize responses with a **schema** so you also get the
  Fastify serialization speedup (§3.7).
- Measure it: run `clinic doctor` (§3.5) against the server under `autocannon` load
  and confirm the event-loop delay stays low while `/hash` runs on the worker pool —
  if you (wrongly) ran the hash on the main thread, Doctor would flag a blocked loop.

**Stretch goals:**

- Add `monitorEventLoopDelay` (§3.5) and expose mean/p99 loop lag on a
  `GET /metrics` endpoint.
- Swap the single process for `cluster` (or run multiple container replicas) and
  confirm `/ping` latency under load improves across cores.
- Add an HTTP/2 variant of the server (§3.6) and compare with `autocannon`.

---

## Interview Questions

### Node.js Architecture

1. Explain the difference between how Node.js handles network I/O versus file system I/O under the hood, and why that distinction matters in production.
2. Why does Node.js use the OS kernel's async notification (epoll/kqueue/IOCP) for TCP sockets instead of the libuv thread pool?
3. What exactly happens inside libuv when you call `fs.readFile` — walk through the path from JavaScript call to callback execution.
4. Why does `dns.lookup` use the thread pool while `dns.resolve` does not, and what are the production implications of this difference?
5. How can a flood of `dns.lookup` calls stall your entire application even when it has nothing to do with file I/O?
6. If you have 4 thread pool threads and fire 10 concurrent `crypto.pbkdf2` calls, what exactly does the execution timeline look like and why?
7. What is the "staircase" pattern you see when benchmarking thread-pool-bound operations, and how do you diagnose it?
8. When does setting `process.env.UV_THREADPOOL_SIZE` inside your application code have no effect, and why?
9. Why does increasing `UV_THREADPOOL_SIZE` beyond the number of CPU cores hurt CPU-bound thread-pool operations rather than help them?
10. What does `os.availableParallelism()` return, and how does it differ from `os.cpus().length` for production use?
11. If network I/O doesn't use the thread pool, why would a Node.js server handling only HTTP requests ever be affected by `UV_THREADPOOL_SIZE`?
12. Describe the relationship between the V8 heap and the libuv event loop — what does each own, and what crosses the boundary between them?
13. What is a V8 isolate, and why does each `worker_threads` worker have its own isolate rather than sharing the main thread's?

### Streams & Backpressure

14. What happens to memory when you call `readable.on('data', chunk => writable.write(chunk))` and the writable is slower than the readable?
15. Walk through what `pipe()` does internally — what does it subscribe to, and what signals does it respond to?
16. Why does `pipe()` not forward errors, and what resource leak does that cause in practice?
17. What is `highWaterMark` and what does it represent differently for byte streams versus object-mode streams?
18. Explain the `write() returns false` → `pause()` → `'drain'` → `resume()` cycle in your own words, and why skipping any step leads to problems.
19. In a custom `Transform` stream, what is the role of the `callback` parameter in `_transform`, and how does calling it late affect upstream throughput?
20. What is the purpose of `_flush` in a Transform stream, and give a concrete example of when you'd need it.
21. How does consuming a Readable with `for await...of` apply backpressure, and how does that differ from using `'data'` events?
22. When streaming a file download with `fs.createReadStream().pipe(res)`, what happens if the client disconnects mid-download — are file descriptors leaked?
23. Why would you tune `highWaterMark` upward on a file read stream, and what is the trade-off?
24. What is the difference between a Duplex and a Transform stream, and when would you choose one over the other?
25. Describe a production scenario where using `fs.readFile` instead of `fs.createReadStream` caused an outage, and what the symptoms looked like.
26. How does `stream/promises` `pipeline` differ from `pipe()` in terms of error handling and stream cleanup?
27. If one stage in a `pipeline` throws asynchronously, what happens to every other stream in the pipeline?

### Clustering & Worker Threads

28. What is the fundamental architectural difference between `cluster` and `worker_threads`, and what class of problem is each designed to solve?
29. How does the `cluster` module share a single listening port across multiple worker processes — what does the OS actually do?
30. What is the blast radius of an unhandled exception in a `worker_threads` worker versus a `cluster` worker process?
31. Why is spawning a new `Worker` per request considered an anti-pattern, and what does `piscina` do to address it?
32. When would you use `SharedArrayBuffer` between worker threads instead of structured-clone message passing, and what synchronisation primitive do you need alongside it?
33. What is the cost of transferring an `ArrayBuffer` via the transfer list versus structured-clone, and what constraint does the transfer impose on the sender?
34. You have a CPU-bound image resizing operation. Describe the architecture you would use — what pool size, how would you pass data, and how would you prevent the main event loop from stalling?
35. Why is running `cluster` inside a container considered an anti-pattern in a Kubernetes environment, and what should you do instead?
36. Explain the zero-downtime reload mechanism in PM2's `pm2 reload` — how does it drain connections without dropping requests?
37. What does PM2 offer over raw `cluster` that makes it worth the dependency in a bare-metal or VPS deployment?
38. If a cluster worker exits with code 1, how would you implement self-healing in raw `cluster` code, and what is the risk of always restarting unconditionally?
39. You are running a Node.js service with 4 cluster workers on a 4-core machine. A new request that requires a shared in-memory cache comes in — what are your options for sharing state across workers?
40. What is the IPC channel between a cluster primary and its workers, what is its performance characteristic, and when does it become a bottleneck?

### Memory & Performance

41. How would you diagnose a memory leak in a long-running Node.js process — what tools would you use and in what order?
42. What is the difference between a V8 heap snapshot and a heap sampling profile, and when do you reach for each?
43. Explain event-loop delay as a metric: what causes it to increase, how do you measure it, and what threshold should trigger an alert?
44. Why is `monitorEventLoopDelay` with a histogram more accurate than the naive "schedule a timer and measure lateness" approach?
45. What does a "sawtooth" memory graph with GC spikes in clinic.js Doctor indicate, and how do you trace it to source code?
46. Describe how to read a CPU flamegraph: what does the x-axis represent, what does the width of a frame mean, and how do you find the optimisation target?
47. You run `clinic doctor` and it reports "I/O issue" despite the server not doing file I/O — what are the likely suspects?
48. Why is `Date.now()` unsuitable for measuring function execution time in production, and what should you use instead?
49. What is `Error.captureStackTrace` and why do you call it in a custom Error constructor — what does it actually do to the stack?
50. Explain the `global.gc()` trick used during heap-dump analysis — why do you force GC before taking a snapshot?
51. A Node.js service's memory grows steadily over 24 hours but heap snapshots show the heap is stable — where else could the memory be going?
52. What is the difference between resident set size (RSS) and heap used in `process.memoryUsage()`, and which one do you alert on?
53. How does allocating many short-lived objects affect GC pause times in V8, and what coding patterns minimise allocation churn?

### Graceful Shutdown & Process Management

54. Walk through a complete graceful shutdown sequence for a Fastify server — what events do you listen for, in what order do you perform actions, and why does the order matter?
55. Why should you call `server.close()` before closing database connections during shutdown?
56. What is the difference between `SIGTERM` and `SIGKILL`, and why can you not write a signal handler for `SIGKILL`?
57. How do you give in-flight HTTP requests time to complete during shutdown without leaving the process running forever if something stalls?
58. What does `.unref()` do on a timer or server handle, and why is it important in shutdown and health-monitoring code?
59. Why does `process.exit(1)` inside `uncaughtException` need a short `setTimeout` before it fires in some patterns, and what is the risk of skipping it?
60. What is the difference between `process.exitCode = 1` and `process.exit(1)`, and when is the former preferable?
61. How does a Kubernetes readiness probe differ from a liveness probe in terms of what they should check in a Node.js application?
62. Explain why the "let it crash" philosophy from Erlang/OTP applies directly to `uncaughtException` in Node.js.

### Production Patterns

63. You notice that `JSON.stringify` is showing up as a hot path in your flamegraph. What is the Fastify-specific solution and how does it work mechanically?
64. Why does Fastify's Ajv-based request validation outperform hand-written validation code, even well-written hand-written code?
65. Explain Fastify's plugin encapsulation model — what is the default scope of a decorator, and how do you break out of it intentionally?
66. What is `AsyncLocalStorage` and how does it avoid the "prop-drilling" problem for request correlation IDs without using globals?
67. Why does `JSON.stringify(new Error('boom'))` return `{}`, and how do you correctly serialize an Error to JSON?
68. What is the difference between an operational error and a programmer error, and why is it dangerous to handle a programmer error with a `try/catch` that lets the process continue?
69. You deploy a new version of your Node.js service and `DATABASE_URL` is missing from the environment. With a zod-validated config, when does the process fail — at startup or at the first database query — and why does the timing matter?
70. Explain how `keepAliveTimeout` and `headersTimeout` relate to each other on an `http.Server`, and what happens if `headersTimeout` is set lower than `keepAliveTimeout`.
71. What is a slow-loris attack and how does `headersTimeout` mitigate it?
72. In a microservices architecture, why is using a keep-alive `Agent` for outbound HTTP requests critical for performance, and what happens if you omit it?
73. When would you terminate TLS in Node.js directly versus upstream at a load balancer or reverse proxy, and what are the trade-offs for each approach?
74. What is HTTP/2 multiplexing, and how does it solve the head-of-line blocking problem that exists in HTTP/1.1 keep-alive?
75. You are writing a structured logging strategy for a production service. Why should every log line be a JSON object rather than an interpolated string, and what downstream systems benefit from this?
