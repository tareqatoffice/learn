# The Node.js Question Book

**A fully explained Q&A guide — from fundamentals to production.**

---

## How to use this book

Every question follows the same shape:

- **Short answer** — what you'd say in one or two sentences.
- **Explanation** — why it works that way.
- **Code** — a runnable illustration where it helps.
- **Watch out** — the trap, the follow-up question, or the mistake people make.

Read it front-to-back once, then use the section index to drill weak areas.

### Contents

1. Fundamentals — what Node actually is
2. The event loop and asynchrony
3. Modules — CommonJS and ESM
4. Core APIs — buffers, streams, events, files
5. Processes, clusters, and worker threads
6. HTTP servers, Express, and API design
7. Databases and data access
8. Security
9. Performance, memory, and scaling
10. Errors, testing, and debugging
11. Production and deployment
12. Rapid-fire and "what does this print?"

---

# Part 1 — Fundamentals

## Q1. What is Node.js?

**Short answer.** Node.js is a runtime that lets JavaScript run outside the browser. It pairs Google's V8 engine with libuv, a C library that provides the event loop and asynchronous I/O.

**Explanation.** JavaScript by itself is only a language spec. It has no way to open a file, listen on a port, or read an environment variable. The browser adds DOM APIs; Node adds server APIs — `fs`, `net`, `http`, `crypto`, `process`. So "Node is JavaScript for the server" is a shorthand for: same language, different set of host objects.

The three pieces that matter:

| Piece | Role |
|---|---|
| V8 | Compiles and executes JavaScript |
| libuv | Event loop, thread pool, async file and network I/O |
| Node bindings | C++ glue exposing libuv and OS features as JS APIs |

**Watch out.** A common follow-up: "Is Node single-threaded?" The JavaScript you write runs on one thread. Node itself is not single-threaded — libuv keeps a thread pool (default 4) for file system work, DNS lookups, and some crypto.

---

## Q2. Why is Node good for I/O-heavy work and bad for CPU-heavy work?

**Short answer.** Node handles thousands of concurrent connections cheaply because waiting on I/O costs no thread. But any long synchronous computation blocks the single JS thread, and every other request stalls behind it.

**Explanation.** A traditional thread-per-request server allocates a thread (often ~1 MB of stack) per connection; 10,000 idle connections means 10,000 mostly-sleeping threads. Node instead registers a callback and moves on. Idle connections cost a file descriptor and a small object.

The flip side: there is exactly one thread running your code. This is the whole ballgame.

```js
// This freezes the entire server for ~2 seconds.
app.get('/bad', (req, res) => {
  let total = 0;
  for (let i = 0; i < 5e9; i++) total += i;
  res.json({ total });
});
```

During that loop, no other request is accepted, no timer fires, no socket is read.

**Fixes for CPU work:** offload to a `worker_threads` pool, spawn a child process, push the job to a queue consumed by a separate service, or use a native addon.

**Watch out.** "CPU-heavy" includes things people don't think of: huge `JSON.parse`, synchronous `bcrypt` with a high cost factor, large regex backtracking, image resizing, and `JSON.stringify` on a multi-megabyte object.

---

## Q3. Blocking vs non-blocking, synchronous vs asynchronous

**Short answer.** Blocking means the call does not return until the work finishes, holding the thread. Non-blocking returns immediately and delivers the result later via callback, promise, or event.

**Explanation.**

```js
const fs = require('fs');

// Blocking — nothing else runs until the disk answers
const data = fs.readFileSync('big.log', 'utf8');
console.log(data.length);

// Non-blocking — the read happens on the thread pool
fs.readFile('big.log', 'utf8', (err, data) => {
  if (err) return console.error(err);
  console.log(data.length);
});
console.log('this prints first');
```

**Watch out.** Sync APIs are fine in exactly two places: startup (loading config before the server listens) and CLI scripts where nothing else is running. They are never fine inside a request handler.

---

## Q4. What is `process` and what do you actually use it for?

**Short answer.** A global object representing the running Node process — its environment, arguments, streams, lifecycle events, and resource usage.

**Explanation.** The pieces worth knowing:

```js
process.env.NODE_ENV;        // environment variables
process.argv;                // [node, script, ...args]
process.cwd();               // working directory
process.pid;                 // process id
process.memoryUsage();       // heapUsed, rss, external
process.uptime();            // seconds since start
process.exit(1);             // exit with a status code
process.nextTick(fn);        // run fn right after the current operation
process.on('SIGTERM', shutdown);
process.on('uncaughtException', handler);
process.on('unhandledRejection', handler);
```

**Watch out.** `process.exit()` kills the process immediately, discarding pending writes to stdout and open sockets. In a shutdown handler, stop accepting connections, drain, then let Node exit naturally — or call `exit` only after the drain completes.

---

## Q5. What is `npm`, and what is the difference between `dependencies`, `devDependencies`, and `peerDependencies`?

**Short answer.** `dependencies` are needed at runtime. `devDependencies` are needed only to build or test. `peerDependencies` declare a package your consumer must supply — typical for plugins.

**Explanation.**

```json
{
  "dependencies":     { "express": "^4.19.2" },
  "devDependencies":  { "jest": "^29.7.0" },
  "peerDependencies": { "react": ">=18" }
}
```

`npm ci` installs strictly from `package-lock.json`, deletes `node_modules` first, and fails if the lock file disagrees with `package.json`. Use it in CI and Docker builds. Use `npm install` locally when you intend to change the dependency tree.

**Watch out.** Semver ranges: `^4.19.2` allows any 4.x above 4.19.2; `~4.19.2` allows 4.19.x only; `4.19.2` pins exactly. The lock file is what actually makes builds reproducible — commit it.

---

## Q6. What does the caret in `"^1.2.3"` mean for a `0.x` package?

**Short answer.** For `0.x` versions, caret behaves like tilde — `^0.2.3` allows `0.2.x` but not `0.3.0`.

**Explanation.** Semver treats `0.x` as unstable, so the minor position is treated as breaking. This surprises people who assume `^` always allows minor bumps.

---

# Part 2 — The Event Loop and Asynchrony

This is the single most-asked area. Understand it properly and half the interview answers itself.

## Q7. Explain the event loop.

**Short answer.** The event loop is libuv's cycle that repeatedly checks queues of completed work and runs the associated JavaScript callbacks, one at a time, on the main thread.

**Explanation.** Each turn of the loop moves through ordered phases:

1. **timers** — callbacks from `setTimeout` and `setInterval` whose time has come.
2. **pending callbacks** — deferred system-level callbacks, e.g. certain TCP errors.
3. **idle / prepare** — internal use.
4. **poll** — retrieve new I/O events; execute I/O callbacks. If nothing is scheduled, the loop may block here waiting for work.
5. **check** — `setImmediate` callbacks.
6. **close callbacks** — `socket.on('close')` and friends.

Between every callback, Node drains two microtask queues: first `process.nextTick`, then promise callbacks. Microtasks always run before the loop moves on.

```
   ┌───────────────┐
┌─▶│    timers     │  setTimeout / setInterval
│  ├───────────────┤
│  │ pending cbs   │
│  ├───────────────┤
│  │ idle, prepare │
│  ├───────────────┤     ┌───────────────┐
│  │     poll      │◀────│  incoming I/O │
│  ├───────────────┤     └───────────────┘
│  │     check     │  setImmediate
│  ├───────────────┤
└──│ close callbacks│
   └───────────────┘
```

**Watch out.** The classic follow-up: "So where do promises run?" Not in a phase — they run in the microtask queue that drains after each callback, so they always beat the next timer or I/O callback.

---

## Q8. `setTimeout(fn, 0)` vs `setImmediate(fn)` — which runs first?

**Short answer.** From the main module, the order is non-deterministic. From inside an I/O callback, `setImmediate` always runs first.

**Explanation.**

```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Order varies run to run — depends on how long process startup took.
```

Why: `setTimeout(fn, 0)` is clamped to 1 ms. If the loop takes longer than 1 ms to reach the timers phase, the timer is ready and fires first. If not, it waits a turn and `setImmediate` wins.

```js
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// Always: immediate, then timeout
```

Inside the I/O callback we are already in the poll phase. The next phase is **check**, so `setImmediate` runs; timers come around only on the following iteration.

---

## Q9. `process.nextTick()` vs `queueMicrotask()` vs `Promise.then()`

**Short answer.** All three defer work to before the next event loop phase. `process.nextTick` has the highest priority; promise callbacks and `queueMicrotask` share the standard microtask queue.

**Explanation.**

```js
setTimeout(() => console.log('1: timeout'));
setImmediate(() => console.log('2: immediate'));
Promise.resolve().then(() => console.log('3: promise'));
process.nextTick(() => console.log('4: nextTick'));
queueMicrotask(() => console.log('5: microtask'));
console.log('6: sync');

// 6: sync
// 4: nextTick
// 3: promise
// 5: microtask
// 1: timeout
// 2: immediate
```

Synchronous code first. Then the nextTick queue drains completely. Then microtasks (promises and `queueMicrotask` in FIFO order together). Only then does the loop proceed.

**Watch out.** `process.nextTick` can starve the loop:

```js
function loop() { process.nextTick(loop); }
loop(); // Server hangs forever — I/O never gets a turn.
```

The nextTick queue is drained *entirely* before moving on, so a self-scheduling tick never yields. `setImmediate` in the same pattern is safe.

---

## Q10. Callbacks, promises, async/await — what problem does each solve?

**Short answer.** Callbacks were the original async primitive but compose badly. Promises make async values first-class and chainable. `async/await` is syntax over promises that restores linear, try/catch-able code.

**Explanation.** The Node callback convention is error-first:

```js
fs.readFile(path, (err, data) => {
  if (err) return cb(err);
  // ...
});
```

Nesting three or four of these produces the pyramid everyone complains about, and — more importantly — errors must be manually forwarded at every level.

Promises fix composition:

```js
const fsp = require('fs/promises');

async function loadConfig(path) {
  try {
    const raw = await fsp.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Config load failed: ${err.message}`, { cause: err });
  }
}
```

Convert legacy callback APIs with `util.promisify`:

```js
const { promisify } = require('util');
const sleep = promisify(setTimeout);
await sleep(1000);
```

**Watch out.** `await` inside a loop serializes work. If the calls are independent, run them concurrently:

```js
// Slow — 10 sequential round trips
for (const id of ids) results.push(await fetchUser(id));

// Fast — all in flight at once
const results = await Promise.all(ids.map(fetchUser));
```

But be careful with `Promise.all` on thousands of items — you'll open thousands of sockets. Use a concurrency limiter (`p-limit`) for large sets.

---

## Q11. `Promise.all` vs `allSettled` vs `race` vs `any`

**Short answer.**

| Method | Resolves when | Rejects when |
|---|---|---|
| `all` | every promise fulfills | any one rejects (fails fast) |
| `allSettled` | every promise settles | never |
| `race` | first promise settles, either way | first settles as a rejection |
| `any` | first promise fulfills | all reject (`AggregateError`) |

**Explanation.** Use `allSettled` when partial success is acceptable — sending 100 notifications, three fail, you still want the other 97 and a report:

```js
const results = await Promise.allSettled(users.map(notify));
const failed = results.filter(r => r.status === 'rejected');
```

Use `race` for timeouts:

```js
const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
]);
```

**Watch out.** `Promise.all` rejecting does not cancel the other promises. They keep running; their results are discarded. If they have side effects, that matters.

---

## Q12. What is an unhandled promise rejection and how should you handle it?

**Short answer.** A rejected promise with no `.catch` handler. Since Node 15 this crashes the process by default.

**Explanation.**

```js
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  // Log, then let the process die and be restarted by the supervisor.
  process.exit(1);
});
```

The correct posture is: log with full context, then exit. An unhandled rejection means your program is in a state you did not anticipate; continuing risks corrupted data. Let PM2, Docker, systemd, or Kubernetes restart a clean process.

**Watch out.** Do not use these handlers as a general error mechanism to keep the server alive. They are a last-resort safety net and a signal that you missed a `catch`.

---

# Part 3 — Modules

## Q13. CommonJS vs ES Modules

**Short answer.** CommonJS (`require`/`module.exports`) is Node's original, synchronous, dynamically-resolved module system. ESM (`import`/`export`) is the JavaScript standard — statically analysable, asynchronous, and supports top-level `await`.

**Explanation.**

```js
// CommonJS
const express = require('express');
module.exports = { start };

// ESM
import express from 'express';
export { start };
```

| | CommonJS | ESM |
|---|---|---|
| Loading | synchronous | asynchronous |
| Resolution | at runtime | at parse time |
| Conditional import | `if (x) require('y')` works | needs dynamic `import()` |
| Top-level await | no | yes |
| `__dirname` | available | use `import.meta.url` |
| Tree shaking | poor | good |

Enable ESM by setting `"type": "module"` in `package.json`, or using the `.mjs` extension. CommonJS files can be forced with `.cjs`.

```js
// __dirname replacement in ESM
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
```

**Watch out.** ESM can import CommonJS (usually as a default export). CommonJS cannot `require` an ESM module — it must use dynamic `await import()`. This asymmetry is the source of most "Cannot use import statement outside a module" pain.

---

## Q14. What does `require()` actually do?

**Short answer.** It resolves the path, loads the file, wraps it in a function, executes it once, caches the result, and returns `module.exports`.

**Explanation.** Every CommonJS file is wrapped before execution:

```js
(function (exports, require, module, __filename, __dirname) {
  // your file's code lives here
});
```

That is why those five identifiers exist without being declared, and why top-level `var` in a module is not global.

Resolution order for `require('foo')`:
1. Core module? (`fs`, `http`) → return it.
2. Starts with `./`, `../`, `/`? → resolve as file, then as directory (`index.js` or the `main` field of its `package.json`).
3. Otherwise walk up `node_modules` folders from the current directory to the filesystem root.

**Watch out.** The module cache is keyed by resolved filename. A module's top-level code runs **once** per process, no matter how many files require it. This is what makes the singleton pattern trivial in Node:

```js
// db.js
const pool = createPool(process.env.DATABASE_URL);
module.exports = pool;   // every requirer gets the same pool
```

---

## Q15. `exports` vs `module.exports`

**Short answer.** `exports` is just a local variable initially pointing at the same object as `module.exports`. Reassigning `exports` breaks the link; only `module.exports` is actually returned.

**Explanation.**

```js
// Works — mutating the shared object
exports.add = (a, b) => a + b;

// Broken — rebinds the local variable only
exports = { add: (a, b) => a + b };

// Correct way to export a single thing
module.exports = (a, b) => a + b;
```

**Watch out.** Mixing both in one file is a classic bug: `module.exports = X` followed later by `exports.y = z` silently discards `y`.

---

## Q16. What are circular dependencies and how does Node handle them?

**Short answer.** When A requires B and B requires A, Node returns B a *partially populated* copy of A's exports rather than looping forever.

**Explanation.**

```js
// a.js
exports.name = 'A';
const b = require('./b');
console.log('in a, b.name =', b.name);

// b.js
const a = require('./a');
console.log('in b, a.name =', a.name);  // 'A' — set before the require
exports.name = 'B';
```

If you move `exports.name = 'A'` below the `require('./b')` line, b sees `undefined`.

**Watch out.** The fix is almost never a clever require trick. It's a design change: extract the shared piece into a third module, or pass the dependency in rather than importing it.

---

# Part 4 — Core APIs

## Q17. What is a Buffer?

**Short answer.** A fixed-length chunk of raw binary data outside the V8 heap — Node's way of handling bytes before JavaScript had typed arrays.

**Explanation.**

```js
const buf = Buffer.from('হ্যালো', 'utf8');
console.log(buf.length);          // bytes, not characters
console.log(buf.toString('hex'));
console.log(buf.toString('base64'));

const empty = Buffer.alloc(10);        // zero-filled, safe
const fast  = Buffer.allocUnsafe(10);  // faster, may contain old memory
```

Buffers appear everywhere: file reads without an encoding, socket data, crypto output, image bytes.

**Watch out.** `Buffer.allocUnsafe` can leak previously used memory into your output if you don't overwrite every byte. Never send it anywhere without filling it first. Also: `buf.length` is byte length — a multi-byte character counts more than once, which breaks naive slicing of UTF-8 text.

---

## Q18. What are streams, and what are the four types?

**Short answer.** Streams process data in chunks instead of loading it all into memory. The four types are Readable, Writable, Duplex, and Transform.

**Explanation.** Reading a 4 GB file into a Buffer will exhaust memory. Streaming it uses a constant, small buffer:

```js
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

await pipeline(
  fs.createReadStream('access.log'),
  zlib.createGzip(),
  fs.createWriteStream('access.log.gz')
);
```

| Type | Example |
|---|---|
| Readable | `fs.createReadStream`, HTTP request |
| Writable | `fs.createWriteStream`, HTTP response |
| Duplex | TCP socket (both ends independent) |
| Transform | `zlib.createGzip`, `crypto.createCipheriv` |

**Watch out.** Use `pipeline`, not `.pipe()`. `.pipe()` does not forward errors or destroy the remaining streams on failure, which leaks file descriptors. `pipeline` cleans up everything.

---

## Q19. What is backpressure?

**Short answer.** The mechanism that stops a fast producer from overwhelming a slow consumer. `write()` returns `false` when the internal buffer is full; you should pause until `'drain'`.

**Explanation.**

```js
// Wrong — memory grows without bound if the socket is slow
readable.on('data', chunk => writable.write(chunk));

// Right — respect the return value
readable.on('data', chunk => {
  if (!writable.write(chunk)) {
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});

// Best — pipeline handles all of this for you
await pipeline(readable, writable);
```

**Watch out.** This is the number one cause of mysterious memory growth when proxying uploads or streaming database results to a client on a slow connection.

---

## Q20. What is `EventEmitter`?

**Short answer.** Node's implementation of the observer pattern. Objects emit named events; listeners subscribe. Most core objects — servers, sockets, streams, processes — are emitters.

**Explanation.**

```js
const { EventEmitter } = require('events');

class Job extends EventEmitter {
  async run() {
    this.emit('start');
    try {
      const result = await doWork();
      this.emit('done', result);
    } catch (err) {
      this.emit('error', err);
    }
  }
}

const job = new Job();
job.on('done', r => console.log('finished', r));
job.on('error', e => console.error(e));   // required, see below
job.once('start', () => console.log('started once'));
```

**Watch out.** Two traps.

1. An `'error'` event with **no listener** throws and crashes the process. Always attach one.
2. Listeners are called **synchronously** in registration order. A slow listener blocks the emitter. And more than 10 listeners on one event logs a memory-leak warning — usually a real bug where you attach inside a request handler and never remove.

---

## Q21. How do you read and write files properly?

**Short answer.** Use the promise API `fs/promises` for one-shot operations, and streams for large files.

**Explanation.**

```js
const fs = require('fs/promises');
const path = require('path');

// Read
const text = await fs.readFile(path.join(__dirname, 'data.json'), 'utf8');

// Write atomically-ish: write to temp, then rename
const tmp = `${target}.${process.pid}.tmp`;
await fs.writeFile(tmp, payload);
await fs.rename(tmp, target);   // rename is atomic on the same filesystem

// Directory
await fs.mkdir(dir, { recursive: true });
const entries = await fs.readdir(dir, { withFileTypes: true });
```

**Watch out.** Never build paths with string concatenation — use `path.join` so it works on every OS, and validate any user-supplied segment. `path.join('/uploads', '../../etc/passwd')` escapes the directory. Resolve and then check the prefix:

```js
const full = path.resolve(UPLOAD_DIR, userInput);
if (!full.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) throw new Error('bad path');
```

---

## Q22. `path.join` vs `path.resolve`

**Short answer.** `join` concatenates segments and normalizes. `resolve` processes right-to-left until it builds an absolute path, treating a leading `/` as a reset.

```js
path.join('/a', 'b', '../c');   // '/a/c'
path.resolve('/a', '/b', 'c');  // '/b/c'   — the second absolute path wins
path.resolve('b', 'c');         // '<cwd>/b/c'
```

---

# Part 5 — Processes, Clusters, and Worker Threads

## Q23. `child_process`: `spawn` vs `exec` vs `fork`

**Short answer.** `spawn` streams output and is safe for large or long-running commands. `exec` buffers all output and runs through a shell. `fork` is a special case of spawn for launching another Node script with an IPC channel.

**Explanation.**

```js
const { spawn, exec, fork } = require('child_process');

// spawn — streams, no shell by default
const p = spawn('ffmpeg', ['-i', input, output]);
p.stdout.on('data', d => console.log(d.toString()));
p.on('close', code => console.log('exit', code));

// exec — buffered, shell interpretation
exec('git rev-parse HEAD', (err, stdout) => console.log(stdout.trim()));

// fork — another Node process with message passing
const worker = fork('./report-builder.js');
worker.send({ reportId: 42 });
worker.on('message', msg => console.log('got', msg));
```

**Watch out.** `exec` runs your string through `/bin/sh`. Interpolating user input into it is command injection. Use `spawn` with an argument array, which never touches a shell. Also, `exec` has a `maxBuffer` (1 MB default) — exceed it and the child is killed.

---

## Q24. What is the `cluster` module?

**Short answer.** It forks the Node process once per CPU core, letting all workers share one listening port so you use the whole machine.

**Explanation.**

```js
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    console.log(`worker ${worker.process.pid} died (${code}), restarting`);
    cluster.fork();
  });
} else {
  require('./server');   // each worker runs a full server
}
```

The primary process accepts connections and distributes them (round-robin on Linux by default).

**Watch out.** Workers share nothing. In-memory sessions, caches, rate-limit counters, and WebSocket connection maps all break the moment you cluster. Move that state to Redis. In containerized deployments, most teams skip `cluster` entirely and run one process per container, letting the orchestrator scale — simpler and more observable.

---

## Q25. `cluster` vs `worker_threads` — when do you use which?

**Short answer.** `cluster` scales I/O throughput with separate processes and separate memory. `worker_threads` runs CPU-bound JavaScript on other threads inside one process, with the ability to share memory.

**Explanation.**

```js
// main.js
const { Worker } = require('worker_threads');

function hashInWorker(payload) {
  return new Promise((resolve, reject) => {
    const w = new Worker('./hash-worker.js', { workerData: payload });
    w.on('message', resolve);
    w.on('error', reject);
    w.on('exit', code => code !== 0 && reject(new Error(`exit ${code}`)));
  });
}

// hash-worker.js
const { workerData, parentPort } = require('worker_threads');
parentPort.postMessage(expensiveHash(workerData));
```

| | cluster | worker_threads |
|---|---|---|
| Unit | process | thread |
| Memory | isolated | can share via `SharedArrayBuffer` |
| Startup cost | high (~30 ms+) | lower (~5 ms) |
| Crash blast radius | one worker | can take down the process |
| Use for | HTTP concurrency | CPU tasks: parsing, hashing, image work |

**Watch out.** Spawning a worker per request is slower than doing the work inline. Keep a pool (e.g. `piscina`).

---

# Part 6 — HTTP, Express, and API Design

## Q26. Build an HTTP server without a framework.

**Short answer.** The `http` module gives you a request/response callback; everything Express does is built on it.

```js
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404).end('Not Found');
});

server.listen(3000, () => console.log('listening on 3000'));
```

**Watch out.** `req` is a Readable stream. The body has not arrived when the handler is called — you must collect `'data'` chunks and wait for `'end'`, which is exactly what `express.json()` does for you.

---

## Q27. What is middleware?

**Short answer.** A function with the signature `(req, res, next)` that runs in order on the way to a route handler. It can inspect, modify, respond, or pass control onward.

**Explanation.**

```js
// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.originalUrl,
                  status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/orders', requireAuth, listOrders);
```

**Watch out.** Forgetting `next()` hangs the request silently — no error, no response, just a client timeout. And calling `next()` *after* sending a response produces "Cannot set headers after they are sent". Always `return` when you respond.

---

## Q28. How does Express error handling work?

**Short answer.** An error-handling middleware takes **four** arguments `(err, req, res, next)` and must be registered last. Errors reach it via `next(err)` or by throwing in a synchronous handler.

**Explanation.**

```js
class AppError extends Error {
  constructor(message, status = 500, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wrapper so async rejections reach Express
const ca = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/users/:id', ca(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  res.json(user);
}));

// 404 fallthrough
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — four args, registered last
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) logger.error({ err, url: req.originalUrl });
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    code: err.code
  });
});
```

**Watch out.** In Express 4, a rejected promise in an async handler is **not** caught automatically — the request hangs. Either wrap every async handler as above or upgrade to Express 5, which forwards rejections to the error handler.

---

## Q29. `app.use` vs `app.get` vs `router`

**Short answer.** `app.use` mounts middleware for all methods on a path prefix. `app.get` matches one method and an exact path pattern. `Router` is a mountable mini-app for grouping routes.

```js
const router = express.Router();
router.get('/', listProducts);
router.post('/', requireAuth, createProduct);
router.get('/:id', getProduct);

app.use('/api/v1/products', router);
```

---

## Q30. Design a REST API — what makes it good?

**Short answer.** Nouns for resources, HTTP verbs for actions, correct status codes, versioning, pagination, consistent error shapes, and idempotency where it matters.

**Explanation.**

```
GET    /api/v1/orders?page=2&limit=20&status=pending
POST   /api/v1/orders
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id
DELETE /api/v1/orders/:id
POST   /api/v1/orders/:id/cancel      // an action that isn't CRUD
```

Status codes that actually get used:

| Code | Meaning |
|---|---|
| 200 / 201 / 204 | OK / Created / No Content |
| 400 | Malformed or invalid input |
| 401 / 403 | Not authenticated / authenticated but not allowed |
| 404 | Resource does not exist |
| 409 | Conflict — duplicate, version mismatch |
| 422 | Semantically invalid |
| 429 | Rate limited |
| 500 / 503 | Server fault / temporarily unavailable |

Consistent error envelope:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Only 3 units left", "field": "quantity" } }
```

**Watch out.** PUT should be idempotent (same request twice = same state). POST is not — so for payments and order creation, accept an `Idempotency-Key` header and de-duplicate on it. Ask this in an interview and few candidates mention it.

---

## Q31. How do you handle file uploads?

**Short answer.** Use `multer` for `multipart/form-data`, cap the size, validate the type, and stream large files straight to object storage rather than through your process memory.

```js
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new AppError('Unsupported file type', 400), ok);
  }
});

app.post('/documents', requireAuth, upload.single('file'), handler);
```

**Watch out.** `file.mimetype` comes from the client and is trivially spoofed. For anything sensitive, sniff the magic bytes server-side. Never store an uploaded file under its original name — generate one, or you inherit path traversal and overwrite bugs.

---

## Q32. What is CORS and when do you hit it?

**Short answer.** A browser security policy. The browser refuses cross-origin responses unless the server sends `Access-Control-Allow-Origin` headers permitting it.

```js
const cors = require('cors');
app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,      // required to send cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE']
}));
```

**Watch out.** `origin: '*'` and `credentials: true` are incompatible — the browser rejects the combination. Also, CORS is enforced by the browser only; it protects your users, not your server. Postman and curl ignore it entirely, so CORS is never an authorization mechanism.

---

# Part 7 — Databases and Data Access

## Q33. Why do you need a connection pool?

**Short answer.** Opening a database connection costs a TCP handshake plus authentication — tens of milliseconds. A pool keeps a set of connections open and hands them out per query.

```js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
```

**Watch out.** Pool size is per process. Four clustered workers with `max: 20` means 80 connections — which may exceed your Postgres `max_connections`. Size the pool as `db_limit / process_count`, with room for migrations and admin tools.

---

## Q34. How do you prevent SQL injection?

**Short answer.** Parameterized queries. Always. Never build SQL by string concatenation.

```js
// Vulnerable
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// Safe — the driver sends the value separately from the statement
db.query('SELECT * FROM users WHERE email = $1', [email]);
```

**Watch out.** Parameters can only substitute *values*, not identifiers. `ORDER BY $1` won't work for a column name, so dynamic sorting must be validated against a whitelist:

```js
const SORTABLE = new Set(['created_at', 'total', 'status']);
if (!SORTABLE.has(sortBy)) throw new AppError('Invalid sort field', 400);
```

---

## Q35. What is the N+1 query problem?

**Short answer.** Fetching a list with one query, then issuing one more query per row to load a relation — 1 + N round trips where 2 would do.

```js
// N+1
const orders = await Order.find();
for (const o of orders) o.customer = await Customer.findById(o.customerId);

// Fixed with a join / populate
const orders = await Order.find().populate('customer');

// Or batch it
const ids = [...new Set(orders.map(o => o.customerId))];
const customers = await Customer.find({ _id: { $in: ids } });
const byId = new Map(customers.map(c => [String(c._id), c]));
orders.forEach(o => { o.customer = byId.get(String(o.customerId)); });
```

**Watch out.** N+1 is invisible in development with 10 rows and catastrophic in production with 10,000. Log query counts per request in staging.

---

## Q36. How do you use transactions?

**Short answer.** Wrap the operations in BEGIN/COMMIT, roll back on any error, and always release the connection in a `finally`.

```js
async function transfer(fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**Watch out.** Never call an external HTTP API inside an open transaction. A slow third party holds a database lock for its entire timeout window and can cascade into pool exhaustion.

---

## Q37. When would you choose SQL vs NoSQL for a Node app?

**Short answer.** Relational when your data has relationships and you need transactional integrity — orders, payments, inventory. Document when your records are self-contained, schema varies, and read patterns are known — event logs, CMS content, product catalogs with irregular attributes.

**Watch out.** "MongoDB because Node" is not a reason. The real questions are: do you need multi-row atomicity, do you need ad-hoc joins, and how will the access pattern change. Most business applications are relational underneath and are poorly served by pretending otherwise.

---
# Part 8 — Security

## Q38. How do you store passwords?

**Short answer.** Hash them with a slow, salted algorithm — bcrypt, scrypt, or Argon2. Never encrypt, never use MD5 or SHA-256 alone.

```js
const bcrypt = require('bcrypt');

const hash = await bcrypt.hash(password, 12);   // cost factor 12
const ok = await bcrypt.compare(candidate, hash);
```

**Explanation.** Fast hashes are the problem: a GPU tries billions of SHA-256 guesses per second. bcrypt is deliberately slow and includes a per-password salt, so rainbow tables are useless and brute force is expensive. The cost factor is a tunable exponent — raise it as hardware improves.

**Watch out.** Use the async version. `bcrypt.hashSync` with cost 12 blocks the event loop for ~250 ms, so a login burst becomes a self-inflicted denial of service. Also, compare with `bcrypt.compare`, never `===`, so the comparison stays constant-time.

---

## Q39. JWT vs session cookies

**Short answer.** Sessions store state server-side and hand the client an opaque ID — easy to revoke. JWTs are self-contained signed tokens — stateless and scalable, but you cannot un-issue one before it expires.

**Explanation.**

```js
const token = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
```

The standard compromise: a short-lived access token (10–15 minutes) plus a long-lived refresh token stored in the database, so revocation works by deleting the refresh token.

| | Session | JWT |
|---|---|---|
| Server state | yes (store/Redis) | none |
| Revocation | immediate | hard — needs a blocklist |
| Payload visible to client | no | yes (base64, not encrypted) |
| Scales across services | needs shared store | naturally |

**Watch out.** JWT payloads are **encoded, not encrypted** — anyone can read them. Never put anything sensitive inside. And always specify the algorithm on verify; accepting `alg: none` or letting the token dictate the algorithm is a well-known attack.

---

## Q40. Where should you store a token in the browser?

**Short answer.** An `httpOnly`, `Secure`, `SameSite` cookie. `localStorage` is readable by any injected script, so any XSS becomes full account takeover.

```js
res.cookie('refresh', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

**Watch out.** Cookies bring CSRF risk back, which `SameSite=strict` or `lax` largely handles; add a CSRF token for state-changing requests if you support older browsers or cross-site flows.

---

## Q41. Name the common Node security mistakes and their fixes.

| Risk | Fix |
|---|---|
| SQL / NoSQL injection | Parameterized queries; validate and cast input types |
| XSS in rendered templates | Escape output; set a Content-Security-Policy |
| Secrets in git | Environment variables, a secret manager, `.gitignore` |
| Vulnerable dependencies | `npm audit`, Dependabot, lock files, fewer deps |
| Missing security headers | `helmet()` |
| No rate limiting | `express-rate-limit`, stricter on auth endpoints |
| Verbose error responses | Generic message to client, full detail to logs |
| Unbounded request body | `express.json({ limit: '100kb' })` |
| Command injection | `spawn` with an args array, never `exec` with interpolation |
| Path traversal | `path.resolve` + prefix check |

```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 10 }));
app.use(express.json({ limit: '100kb' }));
app.disable('x-powered-by');
```

**Watch out.** NoSQL injection is real: if `req.body.password` arrives as `{ "$ne": null }` and you pass it straight into a Mongo query, the comparison always matches. Validate that inputs are the type you expect — `zod`, `joi`, or an explicit `String()` cast.

---

## Q42. How do you validate input?

**Short answer.** At the boundary, with a schema, before anything touches business logic. Reject early with a 400 and a field-level message.

```js
const { z } = require('zod');

const createOrder = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  note: z.string().max(500).optional()
});

const validate = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
  }
  req.body = result.data;   // parsed and coerced
  next();
};

app.post('/orders', requireAuth, validate(createOrder), handler);
```

**Watch out.** Validation is not authorization. Confirming the payload is well-formed says nothing about whether *this* user may act on *that* resource. Check ownership separately — a huge share of real-world breaches are broken object-level authorization, not injection.

---

# Part 9 — Performance, Memory, and Scaling

## Q43. How do you find out why a Node app is slow?

**Short answer.** Measure before guessing. Use the built-in profiler, `--inspect` with Chrome DevTools, event loop lag metrics, and APM traces.

```bash
node --prof app.js && node --prof-process isolate-*.log > profile.txt
node --inspect app.js         # then chrome://inspect
node --cpu-prof app.js        # writes a .cpuprofile
clinic doctor -- node app.js  # high-level diagnosis
```

Event loop lag is the single most useful number:

```js
let last = Date.now();
setInterval(() => {
  const lag = Date.now() - last - 1000;
  if (lag > 100) logger.warn({ lag }, 'event loop lag');
  last = Date.now();
}, 1000);
```

**Watch out.** Slowness in Node is usually one of four things: a blocked event loop, an N+1 query, a missing index, or a serial `await` chain that should be parallel. Check those before optimizing algorithms.

---

## Q44. How do you find a memory leak?

**Short answer.** Watch `heapUsed` over time; if it climbs and never returns after GC, take two heap snapshots under load and compare retained objects.

```js
setInterval(() => {
  const { heapUsed, rss } = process.memoryUsage();
  logger.info({ heapMB: (heapUsed / 1e6).toFixed(1), rssMB: (rss / 1e6).toFixed(1) });
}, 30_000);
```

Common causes:

- A module-level array or `Map` that only ever grows (a cache with no eviction).
- Listeners added per request to a long-lived emitter and never removed.
- Closures capturing large objects held by a timer that is never cleared.
- Unbounded buffering because backpressure was ignored.
- Global variables written accidentally.

```js
// Leak
const cache = new Map();
app.get('/x/:id', (req, res) => { cache.set(req.params.id, buildBig()); /* ... */ });

// Fixed — bounded LRU with TTL
const LRU = require('lru-cache');
const cache = new LRU({ max: 1000, ttl: 5 * 60_000 });
```

**Watch out.** Rising RSS is not automatically a leak — V8 grows the heap lazily and only compacts under pressure. The signal is that heap usage after a full GC keeps trending up across hours.

---

## Q45. What caching strategies apply to a Node API?

**Short answer.** Cache at the layer with the best hit ratio and the cheapest invalidation: HTTP headers at the edge, Redis for shared computed data, in-process for tiny hot lookups.

```js
// Cache-aside with Redis
async function getProduct(id) {
  const key = `product:${id}`;
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const product = await db.products.findById(id);
  await redis.set(key, JSON.stringify(product), 'EX', 300);
  return product;
}

// Invalidate on write
async function updateProduct(id, patch) {
  const updated = await db.products.update(id, patch);
  await redis.del(`product:${id}`);
  return updated;
}
```

**Watch out.** Two things kill naive caches: a stampede (a thousand requests miss simultaneously and all hit the database — fix with a lock or `stale-while-revalidate`), and forgotten invalidation paths (an admin tool that writes directly to the database never clears Redis).

---

## Q46. How would you scale a Node application?

**Short answer.** Vertically first (use all cores), then horizontally (multiple instances behind a load balancer), with all shared state moved out of process.

The order I'd actually work through:

1. Fix the obvious — indexes, N+1s, serial awaits, blocked loop.
2. Cache what's read-heavy.
3. Move slow work off the request path into a queue (BullMQ, RabbitMQ).
4. Run multiple instances; put sessions, rate limits, and caches in Redis.
5. Add a CDN for static and cacheable responses.
6. Read replicas for the database.
7. Split out the one service with a different scaling profile — not a full microservice rewrite.

**Watch out.** "We'll go microservices" is rarely the right first answer. It trades a performance problem for a distributed-systems problem, and interviewers notice when a candidate reaches for it too early.

---

## Q47. How do you handle long-running jobs?

**Short answer.** Accept the request, enqueue the work, return `202` with a job ID, and process it in a separate worker.

```js
// API
app.post('/reports', async (req, res) => {
  const job = await reportQueue.add('monthly', { userId: req.user.sub, ...req.body });
  res.status(202).json({ jobId: job.id, status: 'queued' });
});

// Worker process
new Worker('reports', async job => {
  const file = await buildReport(job.data);
  await notify(job.data.userId, file);
}, { connection: redisConfig, concurrency: 5 });
```

**Watch out.** Jobs must be idempotent — queues guarantee at-least-once delivery, so the same job can run twice after a crash. Also set attempts, backoff, and a dead-letter path.

---
# Part 10 — Errors, Testing, and Debugging

## Q48. Operational errors vs programmer errors

**Short answer.** Operational errors are expected runtime failures — a timeout, a 404, invalid input. Programmer errors are bugs — calling `undefined`, a typo, a broken invariant. Handle the first; crash on the second.

**Explanation.** The distinction drives your strategy. A failed database call should be retried or surfaced as a 503. A `TypeError` means your assumptions are wrong and continuing risks writing bad data — log it and restart.

```js
class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Watch out.** Swallowing errors is worse than crashing. `catch (e) {}` turns a five-minute bug into a five-day one.

---

## Q49. How do you handle `uncaughtException` correctly?

**Short answer.** Log it with full context, attempt a fast graceful shutdown, and exit. Do not resume normal operation.

```js
process.on('uncaughtException', err => {
  logger.fatal({ err }, 'Uncaught exception');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();  // hard stop if drain stalls
});
```

**Explanation.** After an uncaught exception, the stack unwound in the middle of unknown work. Locks may be held, a transaction may be half-applied, an object may be partly mutated. A restarted process is a known-good state; a limping one is not.

---

## Q50. How do you shut down gracefully?

**Short answer.** Stop accepting new connections, finish in-flight requests, close database and queue connections, then exit — all within a deadline.

```js
async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    try {
      await Promise.all([pool.end(), redis.quit(), queue.close()]);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown error');
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

**Watch out.** Kubernetes sends `SIGTERM` then `SIGKILL` after a grace period. If you ignore `SIGTERM`, every deployment drops in-flight requests. Also flip your readiness probe to failing *before* closing the server, so the load balancer stops routing to you first.

---

## Q51. What should logging look like in production?

**Short answer.** Structured JSON to stdout, with levels, a request correlation ID, and no secrets. Let the platform handle shipping and rotation.

```js
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'password', '*.token']
});

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  req.log = logger.child({ reqId: req.id });
  next();
});
```

**Watch out.** `console.log` to stdout is synchronous when stdout is a file or a TTY — under heavy traffic that blocks the event loop. Use a proper logger.

---

## Q52. How do you test a Node application?

**Short answer.** Unit tests for pure logic, integration tests for routes plus a real database, and a thin layer of end-to-end tests. Mock the network boundary, not your own code.

```js
// Integration test with supertest
const request = require('supertest');

describe('POST /orders', () => {
  it('rejects a negative quantity', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: id, quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
```

Node 20+ ships a built-in runner if you'd rather avoid Jest:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('adds', () => assert.equal(add(2, 3), 5));
```

**Watch out.** Over-mocking produces tests that pass while production breaks. Mocking your own repository layer tests only that your mocks agree with each other. Run integration tests against a real database in a container (Testcontainers) — it catches the bugs that matter.

---

## Q53. How do you debug a running Node process?

```bash
node --inspect=0.0.0.0:9229 app.js    # attach Chrome DevTools or VS Code
node --inspect-brk app.js             # break before the first line
kill -SIGUSR1 <pid>                   # enable the inspector on a live process
```

Plus: `NODE_OPTIONS='--stack-trace-limit=50'` for deeper traces, and `--trace-warnings` to get a stack for that "MaxListenersExceeded" message instead of a bare line.

---

# Part 11 — Production and Deployment

## Q54. How do you manage configuration and secrets?

**Short answer.** Environment variables, validated at startup, never committed. Fail loudly on boot if something required is missing.

```js
const { z } = require('zod');

const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32)
}).parse(process.env);

module.exports = env;
```

**Watch out.** Crashing at startup for a missing variable is correct. Discovering it at 2 a.m. because one rarely-hit endpoint needed `SMTP_HOST` is not.

---

## Q55. What does a good production Dockerfile look like?

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

**Watch out.** Three details people miss: copy `package*.json` before the source so the dependency layer caches; run as a non-root `USER`; and use `CMD ["node", ...]` rather than `npm start`, so your process is PID 1 and actually receives `SIGTERM`.

---

## Q56. What is PM2 and do you still need it?

**Short answer.** A process manager providing clustering, auto-restart, log management, and zero-downtime reloads. Useful on a plain VM; largely redundant under Docker or Kubernetes, which already supervise and restart.

```bash
pm2 start ecosystem.config.js
pm2 reload app        # zero-downtime rolling restart
pm2 logs / pm2 monit
```

---

## Q57. What should a health check endpoint return?

**Short answer.** Two endpoints. Liveness answers "is the process alive" cheaply. Readiness answers "can I serve traffic" and checks dependencies.

```js
app.get('/livez', (req, res) => res.json({ ok: true }));

app.get('/readyz', async (req, res) => {
  const checks = await Promise.allSettled([pool.query('SELECT 1'), redis.ping()]);
  const healthy = checks.every(c => c.status === 'fulfilled');
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    db: checks[0].status,
    cache: checks[1].status
  });
});
```

**Watch out.** If liveness checks the database, a brief database blip makes the orchestrator kill every healthy pod — turning a small outage into a full one. Keep liveness dumb.

---

## Q58. What do you monitor?

Golden signals plus Node specifics:

- **Latency** — p50, p95, p99 per route (averages hide everything).
- **Traffic** — requests per second.
- **Errors** — 5xx rate, unhandled rejections.
- **Saturation** — CPU, RSS, heap used, event loop lag, pool utilization.

Event loop lag and 99th-percentile latency are the two numbers that tell you the truth about a Node service.

---

# Part 12 — Rapid-Fire and Code Puzzles

## Q59. What does this print?

```js
console.log('start');
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('tick'));
console.log('end');
```

<details><summary>Answer</summary>

```
start
end
tick
promise
timeout
```
Sync code → nextTick queue → microtask queue → timers phase.
</details>

---

## Q60. Why does this loop print `3 3 3` and how do you fix it?

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);
```

<details><summary>Answer</summary>

`var` is function-scoped, so all three callbacks close over the same binding, which is `3` by the time any timer fires. Change to `let` — it creates a fresh binding per iteration, printing `0 1 2`.
</details>

---

## Q61. What is wrong here?

```js
app.get('/users', async (req, res) => {
  const users = await db.users.find();
  res.json(users);
});
```

<details><summary>Answer</summary>

No error handling. In Express 4, if `find()` rejects, nothing catches it — the request hangs until the client times out and you get an unhandled rejection. Wrap with an async handler helper or upgrade to Express 5.
</details>

---

## Q62. How long does this take, and how would you speed it up?

```js
const a = await fetchA();  // 300ms
const b = await fetchB();  // 300ms
const c = await fetchC();  // 300ms
```

<details><summary>Answer</summary>

900 ms. If they're independent: `const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);` → ~300 ms.
</details>

---

## Q63. Spot the bug.

```js
async function getAll(ids) {
  return ids.map(async id => await fetchItem(id));
}
```

<details><summary>Answer</summary>

It returns an array of pending promises, not values. `map` does not await. Fix: `return Promise.all(ids.map(fetchItem));`
</details>

---

## Q64. Why is this a security problem?

```js
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  res.json(order);
});
```

<details><summary>Answer</summary>

Authentication without authorization. Any logged-in user can read any order by guessing an ID. Scope the query: `Order.findOne({ _id: req.params.id, userId: req.user.sub })`, and return 404 rather than 403 so you don't leak existence.
</details>

---

## Q65. What's the difference between `null`, `undefined`, and a missing key in JSON output?

<details><summary>Answer</summary>

`undefined` values are **dropped** by `JSON.stringify`; `null` is serialized. So `{ a: undefined, b: null }` becomes `{"b":null}`. This bites when an API client distinguishes "field absent" (don't change) from "field null" (clear it) — as PATCH semantics usually do.
</details>

---

## Q66. Quick definitions

| Term | One line |
|---|---|
| **REPL** | Read-Eval-Print Loop — the interactive `node` shell |
| **libuv** | C library providing the event loop, thread pool, and async I/O |
| **V8** | Google's JavaScript engine — parses, JIT-compiles, manages the heap |
| **npx** | Runs a package binary without installing it globally |
| **`package-lock.json`** | Exact resolved dependency tree for reproducible installs |
| **CORS** | Browser policy controlling cross-origin requests |
| **Middleware** | `(req, res, next)` function in the request pipeline |
| **Backpressure** | Slowing a producer when the consumer's buffer is full |
| **Idempotency** | Repeating the request produces the same final state |
| **Thread pool** | libuv's 4 default threads for fs, DNS, and some crypto |
| **`--max-old-space-size`** | Flag to raise the V8 heap limit |
| **Graceful shutdown** | Drain in-flight work on SIGTERM before exiting |

---

# Appendix — A 10-day study plan

| Day | Focus | Prove it by |
|---|---|---|
| 1 | Runtime, V8, libuv, blocking vs non-blocking | Explaining Node to a non-engineer in 90 seconds |
| 2 | Event loop phases, nextTick, microtasks | Predicting output of 10 ordering puzzles |
| 3 | Callbacks → promises → async/await | Refactoring a callback pyramid; using `Promise.all` correctly |
| 4 | Modules, CommonJS vs ESM, circular deps | Converting a small CJS project to ESM |
| 5 | Streams, buffers, EventEmitter, backpressure | Building a gzip pipeline over a 1 GB file |
| 6 | HTTP, Express, middleware, error handling | A CRUD API with central error handling and validation |
| 7 | Databases, pooling, transactions, N+1 | Adding transactions and fixing an N+1 in your own code |
| 8 | Security — auth, hashing, injection, headers | Running an audit on your own project and fixing every finding |
| 9 | Performance, memory, clustering, queues | Profiling a slow endpoint and cutting p95 in half |
| 10 | Production — Docker, health checks, shutdown, logs | Deploying with graceful shutdown and structured logs |

---

## Final note

The questions that separate a good Node answer from a memorized one are almost always about **the single thread** and **what happens when things fail**. If you can explain why a request handler must never block, and what your service does when the database goes away mid-transaction, you understand Node.
