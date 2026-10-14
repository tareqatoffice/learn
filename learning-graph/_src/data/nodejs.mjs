// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  out: "nodejs_learning_graph",
  title: "Node.js Learning Graph",
  sub: "Targets Node.js 24 (LTS). Assumes you already know core JavaScript.",
  foot: "Links go to the official Node.js, npm, Express, and Fastify documentation. Check which release lines are still supported on the\n    <a href=\"https://nodejs.org/en/about/previous-releases\">Node.js releases page</a>.",
  key: "nodejs-learning-graph-v1",
  tracks: [
    { k: "core", n: "Runtime core" },
    { k: "modules", n: "Modules & packages" },
    { k: "io", n: "I/O & streams" },
    { k: "async", n: "Async & concurrency" },
    { k: "web", n: "HTTP & web" },
    { k: "prod", n: "Production" }
  ],
  nodes: [
    {
      id: "what-is-node",
      tr: "core",
      t: "What Node.js is",
      pre: [],
      s: "Node.js runs JavaScript outside the browser on the V8 engine. It adds system APIs (files, network, processes) and an event loop built on libuv. There is no DOM and no window.",
      p: [
        "One main JavaScript thread runs your code; I/O happens in the background.",
        "Built-in modules use the node: prefix, for example node:fs and node:http.",
        "Run a file with node app.js; use node --watch app.js to restart on changes."
      ],
      c: "// app.mjs\nimport os from 'node:os';\n\nconsole.log('Node', process.version);\nconsole.log('Platform', os.platform(), os.arch());\nconsole.log('CPUs', os.availableParallelism());",
      pit: "Using browser globals like window or document in server code; they do not exist in Node.js.",
      u: "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"
    },
    {
      id: "process-env",
      tr: "core",
      t: "process, env & argv",
      pre: ["what-is-node"],
      s: "The global process object describes the running program. It exposes environment variables, command-line arguments, the working directory, the exit code, and signals.",
      p: [
        "process.env values are always strings (or undefined); parse numbers and booleans yourself.",
        "process.argv starts with the node binary and the script path; util.parseArgs parses the rest.",
        "Set process.exitCode instead of calling process.exit() so pending work can finish."
      ],
      c: "import { parseArgs } from 'node:util';\n\nconst { values } = parseArgs({\n  options: { port: { type: 'string', default: '3000' } }\n});\nconst port = Number(process.env.PORT ?? values.port);\nconsole.log(`cwd=${process.cwd()} port=${port}`);\nif (Number.isNaN(port)) process.exitCode = 1;",
      pit: "Writing if (process.env.DEBUG) and expecting DEBUG=false to disable it; the string 'false' is truthy.",
      u: "https://nodejs.org/docs/latest/api/process.html"
    },
    {
      id: "modules",
      tr: "modules",
      t: "ESM vs CommonJS",
      pre: ["what-is-node"],
      s: "Node.js has two module systems. ES modules use import/export and are the standard. CommonJS uses require/module.exports and is still common in older packages.",
      p: [
        ".mjs is always ESM, .cjs is always CommonJS; .js follows the nearest package.json \"type\" field.",
        "ESM has no __dirname or require; use import.meta.dirname and import.meta.filename.",
        "ESM can import CommonJS. Recent Node.js versions can also require() synchronous ESM."
      ],
      c: "// package.json: { \"type\": \"module\" }\n// math.js\nexport function add(a, b) { return a + b; }\n\n// main.js\nimport { add } from './math.js';   // extension is required\nimport { readFile } from 'node:fs/promises';\nconsole.log(add(2, 3), import.meta.dirname);",
      pit: "Leaving off the file extension in an ESM import path; ESM resolution does not guess .js for you.",
      u: "https://nodejs.org/docs/latest/api/esm.html"
    },
    {
      id: "npm-package-json",
      tr: "modules",
      t: "npm & package.json",
      pre: ["modules"],
      s: "package.json describes a project: name, version, module type, dependencies, and scripts. npm installs packages into node_modules and records them there.",
      p: [
        "dependencies ship to production; devDependencies are only for building and testing.",
        "engines.node documents which Node.js versions the project supports.",
        "npx runs a package binary without installing it globally."
      ],
      c: "{\n  \"name\": \"orders-api\",\n  \"version\": \"1.0.0\",\n  \"type\": \"module\",\n  \"engines\": { \"node\": \">=24\" },\n  \"dependencies\": { \"express\": \"^5.1.0\" },\n  \"devDependencies\": { \"eslint\": \"^9.0.0\" }\n}",
      pit: "Putting a build or test tool in dependencies, so it gets installed in every production image.",
      u: "https://docs.npmjs.com/cli/v10/configuring-npm/package-json"
    },
    {
      id: "semver-lockfiles",
      tr: "modules",
      t: "Semver & lockfiles",
      pre: ["npm-package-json"],
      s: "Versions follow MAJOR.MINOR.PATCH. Ranges like ^1.4.0 allow compatible updates. package-lock.json pins the exact tree so every machine installs the same thing.",
      p: [
        "^1.4.0 allows 1.x.x from 1.4.0; ~1.4.0 allows only 1.4.x patches.",
        "Always commit package-lock.json for applications.",
        "npm ci installs exactly what the lockfile says and fails if it disagrees with package.json."
      ],
      c: "# local development: may update the lockfile\nnpm install express@^5\n\n# CI and Docker builds: reproducible, never edits the lockfile\nnpm ci\n\n# see what is out of date\nnpm outdated",
      pit: "Running npm install in CI; it can resolve different versions than the ones you tested.",
      u: "https://docs.npmjs.com/about-semantic-versioning"
    },
    {
      id: "npm-scripts",
      tr: "modules",
      t: "npm scripts",
      pre: ["npm-package-json", "process-env"],
      s: "The scripts field gives the team one shared set of commands. npm run adds node_modules/.bin to PATH, so local tools run without a global install.",
      p: [
        "npm start and npm test are shortcuts; other scripts need npm run name.",
        "Pass extra arguments after --, for example npm test -- --watch.",
        "Keep scripts short and cross-platform; avoid shell-only syntax if teammates use Windows."
      ],
      c: "{\n  \"scripts\": {\n    \"dev\": \"node --watch src/server.js\",\n    \"start\": \"node src/server.js\",\n    \"test\": \"node --test\",\n    \"lint\": \"eslint .\"\n  }\n}",
      pit: "Using rm -rf or VAR=value in scripts; they fail in the default Windows shell.",
      u: "https://docs.npmjs.com/cli/v10/using-npm/scripts"
    },
    {
      id: "event-loop",
      tr: "async",
      t: "The event loop",
      pre: ["what-is-node"],
      s: "The event loop lets one thread handle many connections. It runs in phases: timers, pending callbacks, poll (I/O), check (setImmediate), and close callbacks.",
      p: [
        "While your JavaScript runs, nothing else on that thread runs.",
        "A slow synchronous loop or JSON.parse of a huge payload blocks every request.",
        "Network I/O uses OS async APIs; some work (files, DNS lookup, crypto) uses the libuv thread pool."
      ],
      c: "import http from 'node:http';\n\nhttp.createServer((req, res) => {\n  if (req.url === '/block') {\n    const end = Date.now() + 5000;\n    while (Date.now() < end) {} // every other request waits 5s\n  }\n  res.end('ok');\n}).listen(3000);",
      pit: "Using sync APIs like fs.readFileSync inside request handlers; it stalls the whole server.",
      u: "https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick"
    },
    {
      id: "timers-ticks",
      tr: "async",
      t: "Timers & nextTick",
      pre: ["event-loop"],
      s: "setTimeout runs in the timers phase, setImmediate in the check phase. process.nextTick and promise callbacks run before the loop moves on, after the current operation.",
      p: [
        "nextTick queue runs first, then the promise microtask queue.",
        "Inside an I/O callback, setImmediate always fires before setTimeout(fn, 0).",
        "node:timers/promises gives awaitable setTimeout and setInterval."
      ],
      c: "import { setTimeout as sleep } from 'node:timers/promises';\n\nsetTimeout(() => console.log('timeout'), 0);\nsetImmediate(() => console.log('immediate'));\nPromise.resolve().then(() => console.log('promise'));\nprocess.nextTick(() => console.log('nextTick'));\n// nextTick, promise, then timeout/immediate\nawait sleep(100);",
      pit: "Calling process.nextTick recursively; it starves I/O because the loop never reaches the poll phase.",
      u: "https://nodejs.org/docs/latest/api/timers.html"
    },
    {
      id: "async-patterns",
      tr: "async",
      t: "Callbacks to promises",
      pre: ["event-loop"],
      s: "Older Node.js APIs use error-first callbacks: (err, result). Modern code uses promise APIs (node:fs/promises) and async/await. util.promisify converts old callback functions.",
      p: [
        "Prefer the promise variants of built-in modules when they exist.",
        "Use Promise.all for independent work; await in a loop runs things one by one.",
        "Never mix styles in one function; it makes error paths hard to follow."
      ],
      c: "import { readFile } from 'node:fs/promises';\nimport { promisify } from 'node:util';\nimport { scrypt } from 'node:crypto';\n\nconst scryptAsync = promisify(scrypt);\nconst [config, key] = await Promise.all([\n  readFile('config.json', 'utf8'),\n  scryptAsync('secret', 'salt', 32)\n]);",
      pit: "Forgetting to await a promise, so its error escapes and the code continues with undefined.",
      u: "https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks"
    },
    {
      id: "errors",
      tr: "async",
      t: "Error handling",
      pre: ["async-patterns"],
      s: "Errors arrive three ways: thrown synchronously, as a rejected promise, or as an 'error' event. Each needs its own handling. Since Node.js 15, an unhandled rejection crashes the process.",
      p: [
        "Use try/catch around await; check err.code (for example ENOENT) instead of parsing messages.",
        "Throw Error objects, not strings; use the cause option to keep the original error.",
        "process.on('uncaughtException') is for logging then exiting, not for carrying on."
      ],
      c: "import { readFile } from 'node:fs/promises';\n\nasync function loadConfig(path) {\n  try {\n    return JSON.parse(await readFile(path, 'utf8'));\n  } catch (err) {\n    if (err.code === 'ENOENT') return {};\n    throw new Error(`Bad config at ${path}`, { cause: err });\n  }\n}\nprocess.on('unhandledRejection', (r) => { console.error(r); process.exit(1); });",
      pit: "Swallowing errors with an empty catch block, so failures turn into silent wrong results.",
      u: "https://nodejs.org/docs/latest/api/errors.html"
    },
    {
      id: "event-emitter",
      tr: "async",
      t: "EventEmitter",
      pre: ["async-patterns"],
      s: "EventEmitter is the publish/subscribe base class behind streams, servers, and sockets. You register listeners with on() and trigger them with emit().",
      p: [
        "Listeners run synchronously, in registration order, when emit() is called.",
        "An 'error' event with no listener throws and usually crashes the process.",
        "events.once(emitter, name) returns a promise you can await."
      ],
      c: "import { EventEmitter, once } from 'node:events';\n\nclass Job extends EventEmitter {}\nconst job = new Job();\njob.on('progress', (pct) => console.log(`${pct}%`));\njob.on('error', (err) => console.error('job failed', err));\n\nsetTimeout(() => { job.emit('progress', 50); job.emit('done'); }, 10);\nawait once(job, 'done');",
      pit: "Adding a listener on every request and never removing it; this leaks memory and triggers MaxListenersExceededWarning.",
      u: "https://nodejs.org/docs/latest/api/events.html"
    },
    {
      id: "abort-controller",
      tr: "async",
      t: "AbortController",
      pre: ["async-patterns", "timers-ticks"],
      s: "AbortController is the standard way to cancel async work. Pass its signal to fetch, timers, fs, streams, and your own functions. AbortSignal.timeout() gives a ready-made deadline.",
      p: [
        "Cancelling rejects the operation with an AbortError.",
        "AbortSignal.any() combines signals, for example a timeout plus a shutdown signal.",
        "Check signal.aborted or call signal.throwIfAborted() in your own long loops."
      ],
      c: "import { setTimeout as sleep } from 'node:timers/promises';\n\nconst ac = new AbortController();\nsetTimeout(() => ac.abort(), 100);\n\ntry {\n  await sleep(5000, null, { signal: ac.signal });\n} catch (err) {\n  if (err.name === 'AbortError') console.log('cancelled');\n  else throw err;\n}",
      pit: "Creating a signal but never passing it down, so the inner call keeps running after the caller gave up.",
      u: "https://nodejs.org/docs/latest/api/globals.html#class-abortcontroller"
    },
    {
      id: "fs-path",
      tr: "io",
      t: "fs & path",
      pre: ["async-patterns", "modules"],
      s: "node:fs reads and writes files and directories. node:path builds file paths that work on every operating system. Use the promise API in servers.",
      p: [
        "Build paths with path.join or path.resolve, never with string concatenation and '/'.",
        "Relative paths resolve against process.cwd(), not the file's folder; use import.meta.dirname.",
        "fs.mkdir with { recursive: true } does not fail if the folder exists."
      ],
      c: "import { mkdir, writeFile, readdir } from 'node:fs/promises';\nimport path from 'node:path';\n\nconst dir = path.join(import.meta.dirname, 'out');\nawait mkdir(dir, { recursive: true });\nawait writeFile(path.join(dir, 'report.txt'), 'done\\n');\nconsole.log(await readdir(dir));",
      pit: "Checking fs.existsSync before opening a file; the file can change between the check and the open, so handle ENOENT instead.",
      u: "https://nodejs.org/docs/latest/api/fs.html"
    },
    {
      id: "buffer",
      tr: "io",
      t: "Buffer & binary data",
      pre: ["fs-path"],
      s: "A Buffer is a fixed-size chunk of raw bytes, a subclass of Uint8Array. Files, sockets, and crypto work in bytes; strings appear only when you decode with an encoding.",
      p: [
        "Buffer.from(str, 'utf8') encodes; buf.toString('utf8') decodes.",
        "buf.length is a byte count, which differs from string length for non-ASCII text.",
        "Buffer.alloc zero-fills memory; Buffer.allocUnsafe does not."
      ],
      c: "const buf = Buffer.from('héllo', 'utf8');\nconsole.log(buf.length);              // 6 bytes, 5 characters\nconsole.log(buf.toString('hex'));\nconsole.log(buf.toString('base64'));\n\nconst joined = Buffer.concat([buf, Buffer.from('!')]);\nconsole.log(joined.toString());",
      pit: "Concatenating chunks as strings (data += chunk); a multi-byte character split across chunks gets corrupted.",
      u: "https://nodejs.org/docs/latest/api/buffer.html"
    },
    {
      id: "streams",
      tr: "io",
      t: "Streams",
      pre: ["buffer", "event-emitter"],
      s: "Streams process data piece by piece instead of loading it all into memory. There are four kinds: Readable, Writable, Duplex, and Transform. HTTP requests, responses, and files are all streams.",
      p: [
        "Readable streams are async iterables: for await (const chunk of stream).",
        "Transform streams change data as it flows, like gzip or CSV parsing.",
        "Use streams for anything that can be large: uploads, exports, logs."
      ],
      c: "import { createReadStream } from 'node:fs';\nimport readline from 'node:readline';\n\nconst rl = readline.createInterface({\n  input: createReadStream('access.log'),\n  crlfDelay: Infinity\n});\nlet errors = 0;\nfor await (const line of rl) if (line.includes(' 500 ')) errors++;\nconsole.log({ errors });",
      pit: "Reading a multi-gigabyte file with readFile; it loads the whole file into memory at once.",
      u: "https://nodejs.org/docs/latest/api/stream.html"
    },
    {
      id: "backpressure",
      tr: "io",
      t: "Backpressure",
      pre: ["streams", "errors"],
      s: "Backpressure stops a fast producer from overwhelming a slow consumer. stream.pipeline connects streams, handles backpressure, forwards errors, and cleans up every stream.",
      p: [
        "write() returning false means stop and wait for the 'drain' event.",
        "pipeline from node:stream/promises can be awaited and accepts a signal.",
        "src.pipe(dst) does not forward errors or destroy streams on failure."
      ],
      c: "import { pipeline } from 'node:stream/promises';\nimport { createReadStream, createWriteStream } from 'node:fs';\nimport { createGzip } from 'node:zlib';\n\nawait pipeline(\n  createReadStream('export.csv'),\n  createGzip(),\n  createWriteStream('export.csv.gz')\n);\nconsole.log('compressed');",
      pit: "Chaining .pipe() calls with no error handling; one failing stream leaves the others open and leaks file handles.",
      u: "https://nodejs.org/en/learn/modules/backpressuring-in-streams"
    },
    {
      id: "thread-pool",
      tr: "async",
      t: "libuv thread pool",
      pre: ["event-loop", "fs-path"],
      s: "libuv runs some blocking work on a small thread pool: fs calls, dns.lookup, and heavy crypto and zlib functions. The pool has 4 threads by default.",
      p: [
        "UV_THREADPOOL_SIZE changes the size; it must be set before the pool is first used.",
        "Many slow fs or crypto calls at once queue up behind each other.",
        "Network sockets do not use the pool; they use OS-level async I/O."
      ],
      c: "import { pbkdf2 } from 'node:crypto';\n\nconst start = Date.now();\nfor (let i = 1; i <= 8; i++) {\n  pbkdf2('pw', 'salt', 200_000, 64, 'sha512', () => {\n    console.log(i, Date.now() - start, 'ms');\n  });\n}\n// with 4 threads, results arrive in two waves",
      pit: "Using the Sync variant (pbkdf2Sync, readFileSync) in a server; it blocks the main thread instead of using the pool.",
      u: "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
    },
    {
      id: "child-process",
      tr: "async",
      t: "child_process",
      pre: ["streams", "process-env"],
      s: "node:child_process starts other programs. spawn streams output and suits long or large jobs. execFile runs a program with an argument array and buffers its output.",
      p: [
        "Prefer spawn or execFile with an args array; exec runs a shell string.",
        "Child stdout and stderr are streams; read them or the child can block.",
        "Check the exit code; a non-zero code is a failure even if nothing was thrown."
      ],
      c: "import { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\n\nconst run = promisify(execFile);\nconst { stdout } = await run('git', ['rev-parse', '--short', 'HEAD']);\nconsole.log('commit', stdout.trim());",
      pit: "Passing user input into exec(`convert ${file}`); a crafted file name becomes shell command injection.",
      u: "https://nodejs.org/docs/latest/api/child_process.html"
    },
    {
      id: "worker-threads",
      tr: "async",
      t: "worker_threads",
      pre: ["thread-pool", "buffer"],
      s: "Worker threads run JavaScript in parallel on other threads, each with its own event loop. Use them for CPU-heavy work like image processing or parsing, not for I/O.",
      p: [
        "Communicate with postMessage; data is copied unless you transfer it.",
        "SharedArrayBuffer and Atomics allow true shared memory when needed.",
        "Creating a worker is costly; reuse a pool of workers for repeated jobs."
      ],
      c: "import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';\n\nif (isMainThread) {\n  const w = new Worker(new URL(import.meta.url), { workerData: 40 });\n  w.on('message', (r) => console.log('fib =', r));\n  w.on('error', console.error);\n} else {\n  const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));\n  parentPort.postMessage(fib(workerData));\n}",
      pit: "Moving async I/O into workers expecting a speedup; I/O is already non-blocking, so you only add overhead.",
      u: "https://nodejs.org/docs/latest/api/worker_threads.html"
    },
    {
      id: "http-module",
      tr: "web",
      t: "The http module",
      pre: ["streams", "errors"],
      s: "node:http is the low-level server every framework builds on. A handler gets a request (Readable stream) and a response (Writable stream).",
      p: [
        "The request body arrives as a stream; you must read and parse it yourself.",
        "Set status and headers before writing the body; always end the response.",
        "server.close() stops new connections; existing keep-alive sockets stay open."
      ],
      c: "import http from 'node:http';\n\nconst server = http.createServer(async (req, res) => {\n  if (req.method === 'POST' && req.url === '/echo') {\n    const chunks = [];\n    for await (const c of req) chunks.push(c);\n    res.writeHead(200, { 'content-type': 'application/json' });\n    return res.end(Buffer.concat(chunks));\n  }\n  res.writeHead(404).end();\n});\nserver.listen(3000);",
      pit: "Forgetting to call res.end() on one branch, so the client hangs until it times out.",
      u: "https://nodejs.org/docs/latest/api/http.html"
    },
    {
      id: "fetch",
      tr: "web",
      t: "Built-in fetch",
      pre: ["abort-controller"],
      s: "Node.js ships a global fetch (based on Undici), matching the browser API. Use it to call other HTTP services without adding a dependency.",
      p: [
        "fetch only rejects on network errors; check res.ok for 4xx and 5xx statuses.",
        "There is no default request timeout; pass signal: AbortSignal.timeout(ms).",
        "Always read or cancel the body so the connection can be reused."
      ],
      c: "const res = await fetch('https://api.example.com/orders/42', {\n  headers: { authorization: `Bearer ${process.env.API_TOKEN}` },\n  signal: AbortSignal.timeout(5000)\n});\nif (!res.ok) throw new Error(`Upstream ${res.status}`);\nconst order = await res.json();\nconsole.log(order.id);",
      pit: "Treating every resolved fetch as success; a 500 response resolves normally and needs an explicit res.ok check.",
      u: "https://nodejs.org/docs/latest/api/globals.html#fetch"
    },
    {
      id: "express",
      tr: "web",
      t: "Express & Fastify",
      pre: ["http-module", "npm-package-json"],
      s: "Frameworks add routing, body parsing, and error handling on top of node:http. Express is the most widely used. Fastify focuses on speed and built-in schema validation.",
      p: [
        "Express 5 forwards rejected promises from async handlers to the error handler.",
        "Fastify has a plugin system, schema validation, and a built-in logger (Pino).",
        "Pick one per service and use its idioms; do not wrap one inside the other."
      ],
      c: "import express from 'express';\n\nconst app = express();\napp.use(express.json());\n\napp.get('/health', (req, res) => res.json({ ok: true }));\n\napp.listen(3000, () => console.log('listening on 3000'));",
      pit: "Following Express 4 tutorials on Express 5; some route path syntax and APIs changed, so read the migration guide.",
      u: "https://expressjs.com/en/starter/hello-world.html"
    },
    {
      id: "routing",
      tr: "web",
      t: "Routing",
      pre: ["express"],
      s: "Routing maps an HTTP method and path to a handler. Route parameters, query strings, and routers let you group endpoints by resource.",
      p: [
        "req.params holds path parameters, req.query holds the query string; both are strings.",
        "express.Router() groups routes and is mounted under a prefix.",
        "Return proper status codes: 201 for created, 404 for missing, 400 for bad input."
      ],
      c: "import { Router } from 'express';\n\nexport const orders = Router();\n\norders.get('/:id', async (req, res) => {\n  const order = await db.findOrder(Number(req.params.id));\n  if (!order) return res.status(404).json({ error: 'not found' });\n  res.json(order);\n});\n\n// app.use('/orders', orders);",
      pit: "Declaring /:id before a fixed route like /summary, so 'summary' is captured as an id.",
      u: "https://expressjs.com/en/guide/routing.html"
    },
    {
      id: "middleware",
      tr: "web",
      t: "Middleware",
      pre: ["express"],
      s: "Middleware is a function that runs in order for each request. It can read or change req and res, end the response, or call next() to pass control on.",
      p: [
        "Order matters: body parsers and auth must be registered before the routes that need them.",
        "Error middleware has four arguments (err, req, res, next) and goes last.",
        "Call next() exactly once, or send a response, never both."
      ],
      c: "app.use((req, res, next) => {\n  const start = performance.now();\n  res.on('finish', () => {\n    console.log(req.method, req.url, res.statusCode, Math.round(performance.now() - start), 'ms');\n  });\n  next();\n});\n\napp.use((err, req, res, next) => {\n  res.status(err.status ?? 500).json({ error: 'internal error' });\n});",
      pit: "Sending a response and then also calling next(), causing 'Cannot set headers after they are sent'.",
      u: "https://expressjs.com/en/guide/using-middleware.html"
    },
    {
      id: "validation",
      tr: "web",
      t: "Input validation",
      pre: ["routing", "middleware"],
      s: "Never trust request data. Validate body, params, and query against a schema at the edge, and reject bad input with a clear 400 response before it reaches business logic.",
      p: [
        "Fastify validates with JSON Schema built in; with Express, add a schema library.",
        "Validate types, ranges, lengths, and allowed fields; strip unknown fields.",
        "Return field-level error messages, but never echo internal details or stack traces."
      ],
      c: "fastify.post('/orders', {\n  schema: {\n    body: {\n      type: 'object',\n      required: ['productId', 'qty'],\n      additionalProperties: false,\n      properties: {\n        productId: { type: 'string', minLength: 1 },\n        qty: { type: 'integer', minimum: 1, maximum: 100 }\n      }\n    }\n  }\n}, async (req) => createOrder(req.body));",
      pit: "Passing req.body straight into a database query or object merge, allowing injection or prototype pollution.",
      u: "https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/"
    },
    {
      id: "auth",
      tr: "web",
      t: "Auth basics",
      pre: ["validation"],
      s: "Authentication proves who the caller is; authorization decides what they may do. Common options are session cookies for browsers and bearer tokens for APIs.",
      p: [
        "Hash passwords with a slow algorithm (scrypt, bcrypt, or argon2), never plain SHA.",
        "Cookies for sessions should be httpOnly, secure, and sameSite.",
        "Check authorization on every request for the specific resource, not just login status."
      ],
      c: "import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';\nimport { promisify } from 'node:util';\nconst scryptAsync = promisify(scrypt);\n\nexport async function hash(pw) {\n  const salt = randomBytes(16);\n  return { salt, key: await scryptAsync(pw, salt, 64) };\n}\nexport async function verify(pw, { salt, key }) {\n  return timingSafeEqual(key, await scryptAsync(pw, salt, 64));\n}",
      pit: "Checking only that a user is logged in, so user A can read user B's order by changing the id in the URL.",
      u: "https://nodejs.org/en/learn/getting-started/security-best-practices"
    },
    {
      id: "config-secrets",
      tr: "prod",
      t: "Config & secrets",
      pre: ["process-env", "npm-scripts"],
      s: "Configuration comes from environment variables so the same build runs in every environment. Read and validate it once at startup, then pass a typed config object around.",
      p: [
        "node --env-file=.env loads a .env file without extra packages.",
        "Fail fast at startup if a required variable is missing.",
        "Keep .env out of git; commit a .env.example with placeholder values instead."
      ],
      c: "// node --env-file=.env src/server.js\nfunction required(name) {\n  const v = process.env[name];\n  if (!v) throw new Error(`Missing env var ${name}`);\n  return v;\n}\nexport const config = Object.freeze({\n  port: Number(process.env.PORT ?? 3000),\n  dbUrl: required('DATABASE_URL')\n});",
      pit: "Committing a real .env file or logging the whole config object, leaking secrets into git history or logs.",
      u: "https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs"
    },
    {
      id: "logging",
      tr: "prod",
      t: "Structured logging",
      pre: ["middleware", "config-secrets"],
      s: "Production logs should be structured JSON lines with a level, time, message, and context like a request id. A log platform can then search and alert on them.",
      p: [
        "Use a logger such as Pino (built into Fastify) instead of console.log.",
        "Attach a request id to every log line so one request can be traced end to end.",
        "Log to stdout and let the platform collect it; do not manage log files in the app."
      ],
      c: "import Fastify from 'fastify';\n\nconst app = Fastify({\n  logger: { level: process.env.LOG_LEVEL ?? 'info',\n            redact: ['req.headers.authorization'] }\n});\napp.get('/orders/:id', async (req) => {\n  req.log.info({ orderId: req.params.id }, 'loading order');\n  return { id: req.params.id };\n});\nawait app.listen({ port: 3000 });",
      pit: "Logging full request bodies or headers, which writes passwords and tokens into the log store.",
      u: "https://fastify.dev/docs/latest/Reference/Logging/"
    },
    {
      id: "node-test",
      tr: "prod",
      t: "node:test runner",
      pre: ["modules", "errors", "npm-scripts"],
      s: "Node.js has a built-in test runner and assertion library. node --test finds and runs test files, with no extra framework required.",
      p: [
        "Use node:assert/strict so comparisons are strict by default.",
        "describe/it and test() are both available; tests can be async.",
        "t.mock and mock.timers let you stub functions and fake time."
      ],
      c: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/math.js';\n\ntest('adds numbers', () => {\n  assert.equal(add(2, 3), 5);\n});\n\ntest('rejects bad config', async () => {\n  await assert.rejects(loadConfig('broken.json'), /Bad config/);\n});",
      pit: "Forgetting to await an async assertion, so the test passes before the check runs.",
      u: "https://nodejs.org/docs/latest/api/test.html"
    },
    {
      id: "api-testing",
      tr: "prod",
      t: "Testing HTTP APIs",
      pre: ["node-test", "routing"],
      s: "Test routes through the HTTP layer so you cover parsing, validation, status codes, and error handling together. Keep the app separate from listen() so tests can build it.",
      p: [
        "Export a buildApp() function; only server.js calls listen().",
        "Fastify's inject() sends fake requests without opening a port.",
        "Replace external services (database, upstream APIs) with test doubles or a test instance."
      ],
      c: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { buildApp } from '../src/app.js';\n\ntest('POST /orders rejects qty 0', async (t) => {\n  const app = buildApp();\n  t.after(() => app.close());\n  const res = await app.inject({ method: 'POST', url: '/orders',\n    payload: { productId: 'p1', qty: 0 } });\n  assert.equal(res.statusCode, 400);\n});",
      pit: "Starting the server on a fixed port in every test file, so parallel test runs collide with EADDRINUSE.",
      u: "https://fastify.dev/docs/latest/Guides/Testing/"
    },
    {
      id: "debugging",
      tr: "prod",
      t: "Debugging & profiling",
      pre: ["event-loop", "node-test"],
      s: "node --inspect opens a debugger that Chrome DevTools or VS Code can attach to. The same tools record CPU profiles that show where time is spent.",
      p: [
        "--inspect-brk pauses on the first line so you can set breakpoints.",
        "--cpu-prof writes a CPU profile you can open in DevTools.",
        "Never expose the inspector port publicly; it allows running arbitrary code."
      ],
      c: "# attach Chrome (chrome://inspect) or VS Code\nnode --inspect src/server.js\n\n# pause before the first line\nnode --inspect-brk --test test/orders.test.js\n\n# record a CPU profile on exit\nnode --cpu-prof src/batch-job.js",
      pit: "Binding the inspector to 0.0.0.0 on a server; anyone who can reach the port can execute code.",
      u: "https://nodejs.org/en/learn/getting-started/debugging"
    },
    {
      id: "memory-leaks",
      tr: "prod",
      t: "Memory leaks",
      pre: ["debugging", "event-emitter"],
      s: "A leak is memory that stays reachable after it is no longer needed, so the garbage collector cannot free it. In servers it shows as heap growing with traffic until the process crashes.",
      p: [
        "Common causes: unbounded caches, global arrays, forgotten listeners, and timers.",
        "Compare two heap snapshots taken minutes apart to find what keeps growing.",
        "--max-old-space-size sets the heap limit; raising it hides a leak, it does not fix it."
      ],
      c: "// leaks: grows forever, one entry per request\nconst seen = new Map();\napp.use((req, res, next) => { seen.set(req.id, req); next(); });\n\n// fix: bound it\nconst MAX = 1000;\nfunction remember(key, value) {\n  if (seen.size >= MAX) seen.delete(seen.keys().next().value);\n  seen.set(key, value);\n}",
      pit: "Using a plain object or Map as a cache with no size limit or expiry.",
      u: "https://nodejs.org/en/learn/diagnostics/memory"
    },
    {
      id: "security-deps",
      tr: "prod",
      t: "Dependency security",
      pre: ["semver-lockfiles"],
      s: "Most of your code is other people's packages. Keep dependencies few, updated, and audited, and treat install scripts as code that runs on your machine.",
      p: [
        "npm audit reports known vulnerabilities in the installed tree.",
        "Review new packages: maintenance, download counts, and what they pull in.",
        "Run the app on a supported Node.js release line and update it regularly."
      ],
      c: "# list known vulnerabilities\nnpm audit\n\n# fail CI only on high or critical issues\nnpm audit --audit-level=high\n\n# see why a package is installed\nnpm explain lodash",
      pit: "Running npm audit fix --force blindly; it can install breaking major versions.",
      u: "https://docs.npmjs.com/cli/v10/commands/npm-audit"
    },
    {
      id: "cluster",
      tr: "async",
      t: "cluster & scaling",
      pre: ["http-module", "child-process"],
      s: "One Node.js process uses one core for JavaScript. node:cluster forks several workers that share a port. In containers, running more replicas is usually simpler.",
      p: [
        "Workers are separate processes with separate memory; they share no state.",
        "Keep sessions and caches in an external store (for example Redis) so any worker can serve any request.",
        "Process managers and orchestrators can do the same job outside your code."
      ],
      c: "import cluster from 'node:cluster';\nimport { availableParallelism } from 'node:os';\n\nif (cluster.isPrimary) {\n  for (let i = 0; i < availableParallelism(); i++) cluster.fork();\n  cluster.on('exit', (w) => { console.log(`worker ${w.process.pid} died`); cluster.fork(); });\n} else {\n  await import('./server.js');\n}",
      pit: "Storing sessions in process memory, so users get logged out when the next request hits another worker.",
      u: "https://nodejs.org/docs/latest/api/cluster.html"
    },
    {
      id: "graceful-shutdown",
      tr: "prod",
      t: "Graceful shutdown",
      pre: ["http-module", "abort-controller"],
      s: "When the platform sends SIGTERM, stop accepting new requests, finish the ones in flight, close database pools, then exit. Otherwise deploys cut off users mid-request.",
      p: [
        "Listen for SIGTERM and SIGINT with process.on.",
        "server.close() waits for in-flight requests; closeIdleConnections() drops idle keep-alive sockets.",
        "Add a hard timeout so a stuck request cannot block exit forever."
      ],
      c: "async function shutdown(signal) {\n  console.log(`${signal}: shutting down`);\n  setTimeout(() => process.exit(1), 10_000).unref();\n  server.close(async () => {\n    await db.end();\n    process.exit(0);\n  });\n  server.closeIdleConnections();\n}\nprocess.on('SIGTERM', shutdown);\nprocess.on('SIGINT', shutdown);",
      pit: "Starting the app with npm start in a container; npm may not forward SIGTERM, so the app is killed without cleanup.",
      u: "https://nodejs.org/docs/latest/api/process.html#signal-events"
    },
    {
      id: "deployment",
      tr: "prod",
      t: "Containers & deploy",
      pre: ["graceful-shutdown", "logging", "security-deps"],
      s: "Ship a small image built from a pinned Node.js LTS base, with production dependencies only, running as a non-root user. Set NODE_ENV=production and configure through env vars.",
      p: [
        "Copy package files and run npm ci --omit=dev before copying source, for better layer caching.",
        "Run node directly as the container command so it receives signals.",
        "Add a health endpoint the platform can probe."
      ],
      c: "FROM node:24-slim\nWORKDIR /app\nENV NODE_ENV=production\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev\nCOPY src ./src\nUSER node\nEXPOSE 3000\nCMD [\"node\", \"src/server.js\"]",
      pit: "Copying the local node_modules into the image; native modules built for your OS break inside Linux containers.",
      u: "https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production"
    }
  ]
};
