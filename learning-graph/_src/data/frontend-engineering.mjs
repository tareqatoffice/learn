// id, tr (track key), t (title, <=22 chars), pre (prerequisite ids), s (summary), p (key points), c (code), pit (common mistake), u (docs URL)
export default {
  out: "frontend_engineering_learning_graph",
  title: "Frontend Engineering Learning Graph",
  sub: "Framework-agnostic core, with React as the example where a framework is needed.",
  foot: "Links go to MDN, web.dev, react.dev, W3C WAI and the TypeScript docs.",
  key: "frontend-engineering-learning-graph-v1",
  tracks: [
    { k: "web", n: "Web platform" },
    { k: "css", n: "CSS & layout" },
    { k: "comp", n: "Components & state" },
    { k: "data", n: "Data & rendering" },
    { k: "perf", n: "Build & performance" },
    { k: "quality", n: "Quality" }
  ],
  nodes: [
    {
      id: "html-semantics",
      tr: "web",
      t: "Semantic HTML",
      pre: [],
      s: "HTML describes what content is, not how it looks. The right element gives you meaning, keyboard behavior and accessibility for free.",
      p: [
        "Use landmarks: header, nav, main, aside, footer.",
        "Headings form an outline; do not skip levels for styling.",
        "A button does something, a link goes somewhere. Pick the element by behavior."
      ],
      c: "<main>\n  <h1>Orders</h1>\n  <nav aria-label=\"Pagination\">\n    <a href=\"?page=2\">Next page</a>\n  </nav>\n  <button type=\"button\">Export CSV</button>\n</main>",
      pit: "Using a div with an onclick handler as a button: it is not focusable and does not respond to Enter or Space.",
      u: "https://developer.mozilla.org/en-US/docs/Glossary/Semantics"
    },
    {
      id: "event-loop",
      tr: "web",
      t: "Event loop & async",
      pre: [],
      s: "JavaScript in the browser runs on one main thread. Long tasks block input and rendering. Promises and async/await schedule work without blocking.",
      p: [
        "Promise callbacks run as microtasks, before the next task such as a timer.",
        "await pauses the function, not the thread.",
        "Rendering can only happen between tasks, so a long task freezes the page."
      ],
      c: "async function load() {\n  const res = await fetch(\"/api/user\");\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}\n\nload().then(console.log).catch(console.error);",
      pit: "Forgetting to await or catch a promise, so errors become silent unhandled rejections.",
      u: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises"
    },
    {
      id: "dom-events",
      tr: "web",
      t: "DOM & events",
      pre: ["html-semantics", "event-loop"],
      s: "The DOM is the live tree the browser builds from HTML. Events are dispatched to a target and then bubble up through its ancestors.",
      p: [
        "event.target is where it happened; event.currentTarget is where the listener sits.",
        "Event delegation: one listener on a parent handles many children.",
        "preventDefault stops the browser action; stopPropagation stops bubbling."
      ],
      c: "const list = document.querySelector(\"#todo-list\");\n\nlist.addEventListener(\"click\", (event) => {\n  const btn = event.target.closest(\"button[data-id]\");\n  if (!btn) return;\n  removeTodo(btn.dataset.id);\n});",
      pit: "Calling stopPropagation everywhere, which breaks delegated handlers and analytics higher up the tree.",
      u: "https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener"
    },
    {
      id: "css-cascade",
      tr: "css",
      t: "Cascade & specificity",
      pre: ["html-semantics"],
      s: "When several rules target the same element, the cascade decides which wins: origin and importance, then cascade layers, then specificity, then source order.",
      p: [
        "Specificity is compared as (ids, classes/attributes/pseudo-classes, elements).",
        "Some properties inherit (color, font); most layout properties do not.",
        "@layer lets you order whole groups of styles, independent of specificity."
      ],
      c: "@layer base, components;\n\n@layer base {\n  a { color: blue; }\n}\n@layer components {\n  .link-muted { color: gray; } /* wins: later layer */\n}",
      pit: "Fixing a conflict with !important or an id selector, which starts a specificity arms race.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity"
    },
    {
      id: "browser-rendering",
      tr: "web",
      t: "How browsers render",
      pre: ["dom-events", "css-cascade"],
      s: "The critical rendering path turns HTML and CSS into pixels: DOM and CSSOM, render tree, layout, paint, composite. CSS and synchronous scripts block it.",
      p: [
        "Layout (reflow) computes geometry; paint fills pixels; composite stacks layers.",
        "Changing width or top triggers layout; transform and opacity can skip it.",
        "Reading layout (offsetHeight) right after writing styles forces a synchronous reflow."
      ],
      c: "// Bad: read/write interleaved forces layout on every loop\nfor (const el of items) {\n  el.style.height = el.offsetHeight + 10 + \"px\";\n}\n\n// Better: read all, then write all\nconst heights = items.map((el) => el.offsetHeight);\nitems.forEach((el, i) => (el.style.height = heights[i] + 10 + \"px\"));",
      pit: "Animating top/left or width instead of transform, causing layout on every frame.",
      u: "https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path"
    },
    {
      id: "forms",
      tr: "web",
      t: "Forms & validation",
      pre: ["dom-events"],
      s: "Native forms give you labels, submission, autofill and constraint validation. Client validation is for user experience; the server must validate again.",
      p: [
        "Every input needs a label linked by for/id or by wrapping.",
        "required, type, min, max and pattern give built-in validation.",
        "Use the right type and autocomplete so mobile keyboards and password managers work."
      ],
      c: "<form action=\"/signup\" method=\"post\">\n  <label for=\"email\">Email</label>\n  <input id=\"email\" name=\"email\" type=\"email\"\n         autocomplete=\"email\" required>\n  <button>Sign up</button>\n</form>",
      pit: "Using placeholder text instead of a label; it disappears on typing and is not a reliable accessible name.",
      u: "https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation"
    },
    {
      id: "http-fetch",
      tr: "web",
      t: "HTTP & fetch",
      pre: ["event-loop"],
      s: "The frontend talks to servers over HTTP. fetch returns a promise for a Response; you decide how to handle status codes, bodies and cancellation.",
      p: [
        "fetch only rejects on network failure; a 404 or 500 still resolves. Check res.ok.",
        "Know the methods (GET is safe and cacheable, POST is not) and status code classes.",
        "AbortController cancels a request you no longer need."
      ],
      c: "const controller = new AbortController();\n\nconst res = await fetch(\"/api/orders\", {\n  method: \"POST\",\n  headers: { \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({ sku: \"A-1\", qty: 2 }),\n  signal: controller.signal,\n});\nif (!res.ok) throw new Error(`HTTP ${res.status}`);",
      pit: "Assuming fetch throws on HTTP errors, so a 500 response is parsed as if it were data.",
      u: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch"
    },
    {
      id: "storage-cookies",
      tr: "web",
      t: "Storage & cookies",
      pre: ["http-fetch"],
      s: "Cookies are sent with requests; localStorage and sessionStorage stay in the browser; IndexedDB holds larger structured data. Each has different scope and risk.",
      p: [
        "HttpOnly cookies cannot be read by JavaScript, which protects session tokens from XSS.",
        "SameSite and Secure attributes control when cookies are sent.",
        "localStorage is synchronous, string-only and readable by any script on the origin."
      ],
      c: "// Server response header for a session cookie\nSet-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/\n\n// Fine for a UI preference\nlocalStorage.setItem(\"theme\", \"dark\");",
      pit: "Storing auth tokens in localStorage, where any injected script can read and exfiltrate them.",
      u: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies"
    },
    {
      id: "box-model",
      tr: "css",
      t: "Box model",
      pre: ["css-cascade"],
      s: "Every element is a box: content, padding, border, margin. box-sizing decides whether width includes padding and border.",
      p: [
        "box-sizing: border-box makes widths predictable.",
        "Vertical margins between blocks can collapse into one.",
        "display (block, inline, inline-block) changes how a box sits in the flow."
      ],
      c: "*, *::before, *::after {\n  box-sizing: border-box;\n}\n\n.card {\n  width: 300px;      /* total width, padding included */\n  padding: 16px;\n  border: 1px solid #ddd;\n}",
      pit: "Setting width: 100% plus padding under content-box, causing horizontal overflow.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing"
    },
    {
      id: "flexbox",
      tr: "css",
      t: "Flexbox",
      pre: ["box-model"],
      s: "Flexbox lays out items along one axis. It is the default tool for rows of controls, toolbars and centering.",
      p: [
        "justify-content works on the main axis, align-items on the cross axis.",
        "flex: 1 means grow and shrink from a zero basis.",
        "gap spaces items without margin hacks."
      ],
      c: ".toolbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.toolbar .spacer {\n  flex: 1; /* pushes the next items to the right */\n}",
      pit: "Long text overflowing a flex item because min-width defaults to auto; add min-width: 0.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox"
    },
    {
      id: "grid",
      tr: "css",
      t: "Grid",
      pre: ["box-model"],
      s: "CSS Grid lays out in two dimensions. Use it for page structure and card grids where rows and columns must line up.",
      p: [
        "fr units share leftover space.",
        "repeat(auto-fill, minmax(...)) gives responsive columns without media queries.",
        "Named grid areas make page layouts readable."
      ],
      c: ".cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 16px;\n}",
      pit: "Reordering items visually with grid placement, so visual order and keyboard tab order no longer match.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout"
    },
    {
      id: "responsive",
      tr: "css",
      t: "Responsive design",
      pre: ["flexbox", "grid"],
      s: "One codebase must work from phone to wide desktop. Media queries react to the viewport; container queries react to the size of a component's container.",
      p: [
        "Start with the viewport meta tag and a mobile-first base style.",
        "Prefer fluid units (%, rem, clamp()) over fixed pixel widths.",
        "Container queries let a component adapt wherever it is placed."
      ],
      c: ".sidebar { container-type: inline-size; }\n\n.profile { display: block; }\n\n@container (min-width: 400px) {\n  .profile { display: flex; gap: 12px; }\n}\n\n@media (min-width: 768px) {\n  .layout { grid-template-columns: 240px 1fr; }\n}",
      pit: "Testing only at a few device widths, so layouts break at the sizes in between.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries"
    },
    {
      id: "css-tokens",
      tr: "css",
      t: "Tokens & CSS variables",
      pre: ["css-cascade"],
      s: "Design tokens are named design decisions: colors, spacing, radii, type scale. CSS custom properties carry them through the cascade at runtime.",
      p: [
        "Custom properties inherit, so a parent can retheme a whole subtree.",
        "Name tokens by role (--color-text-muted), not by value (--gray-500).",
        "Dark mode becomes a token swap, not a second stylesheet."
      ],
      c: ":root {\n  --color-bg: #fff;\n  --color-text: #1a1a1a;\n  --space-2: 8px;\n}\n[data-theme=\"dark\"] {\n  --color-bg: #121212;\n  --color-text: #eee;\n}\nbody { background: var(--color-bg); color: var(--color-text); }",
      pit: "Hard-coding hex values in components, so a theme change means editing every file.",
      u: "https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties"
    },
    {
      id: "typescript-ui",
      tr: "comp",
      t: "TypeScript in UI code",
      pre: ["event-loop"],
      s: "TypeScript catches wrong props, missing fields and null access before the code runs. Types describe the data your UI receives and the contracts between components.",
      p: [
        "Type API responses at the boundary and validate untrusted data at runtime.",
        "Use union types for states: 'loading' | 'error' | 'ready'.",
        "Avoid any; prefer unknown and narrow it."
      ],
      c: "type User = { id: string; name: string; email?: string };\n\ntype Status =\n  | { kind: \"loading\" }\n  | { kind: \"error\"; message: string }\n  | { kind: \"ready\"; user: User };\n\nfunction label(s: Status) {\n  return s.kind === \"ready\" ? s.user.name : s.kind;\n}",
      pit: "Casting API responses with 'as User', which silences the compiler but proves nothing at runtime.",
      u: "https://react.dev/learn/typescript"
    },
    {
      id: "components",
      tr: "comp",
      t: "Component model",
      pre: ["dom-events", "typescript-ui"],
      s: "A component is a function that turns inputs into UI. You build screens by composing small components instead of manipulating the DOM by hand.",
      p: [
        "Components must be pure during render: same inputs, same output, no side effects.",
        "Composition with children beats deep configuration props.",
        "Keep components small enough to name by what they do."
      ],
      c: "type CardProps = { title: string; children: React.ReactNode };\n\nfunction Card({ title, children }: CardProps) {\n  return (\n    <section className=\"card\">\n      <h2>{title}</h2>\n      {children}\n    </section>\n  );\n}",
      pit: "Defining a component inside another component, which remounts it and loses its state on every render.",
      u: "https://react.dev/learn/your-first-component"
    },
    {
      id: "props-state",
      tr: "comp",
      t: "Props & state",
      pre: ["components"],
      s: "Props come from the parent and are read-only. State is data a component owns and changes over time; changing it schedules a re-render.",
      p: [
        "Treat state as immutable: create new objects and arrays instead of mutating.",
        "Derive values during render instead of storing them in extra state.",
        "Lift state up to the closest common parent when siblings need it."
      ],
      c: "function Counter() {\n  const [count, setCount] = useState(0);\n  const isEven = count % 2 === 0; // derived, not state\n\n  return (\n    <button onClick={() => setCount((c) => c + 1)}>\n      {count} ({isEven ? \"even\" : \"odd\"})\n    </button>\n  );\n}",
      pit: "Mutating state in place (items.push(x); setItems(items)), so React sees the same reference and may skip the update.",
      u: "https://react.dev/learn/state-a-components-memory"
    },
    {
      id: "lists-keys",
      tr: "comp",
      t: "Lists & keys",
      pre: ["props-state"],
      s: "When rendering lists, keys tell React which item is which between renders. Stable keys preserve state and DOM; bad keys cause bugs.",
      p: [
        "Use a stable id from the data as the key.",
        "Keys only need to be unique among siblings.",
        "Changing a key on purpose resets a component's state."
      ],
      c: "function TodoList({ todos }: { todos: Todo[] }) {\n  return (\n    <ul>\n      {todos.map((todo) => (\n        <li key={todo.id}>{todo.text}</li>\n      ))}\n    </ul>\n  );\n}",
      pit: "Using the array index as key in a list that can be reordered or filtered, so input state jumps to the wrong row.",
      u: "https://react.dev/learn/rendering-lists"
    },
    {
      id: "hooks-effects",
      tr: "comp",
      t: "Hooks & effects",
      pre: ["props-state"],
      s: "Hooks let function components hold state and connect to the outside world. Effects synchronize a component with an external system after render.",
      p: [
        "Call hooks at the top level, never in conditions or loops.",
        "List every reactive value an effect uses in its dependency array.",
        "Return a cleanup function to undo subscriptions and timers."
      ],
      c: "function OnlineStatus() {\n  const [online, setOnline] = useState(navigator.onLine);\n\n  useEffect(() => {\n    const update = () => setOnline(navigator.onLine);\n    window.addEventListener(\"online\", update);\n    window.addEventListener(\"offline\", update);\n    return () => {\n      window.removeEventListener(\"online\", update);\n      window.removeEventListener(\"offline\", update);\n    };\n  }, []);\n\n  return <span>{online ? \"Online\" : \"Offline\"}</span>;\n}",
      pit: "Using an effect to compute derived data or respond to a click; that belongs in render or in the event handler.",
      u: "https://react.dev/learn/you-might-not-need-an-effect"
    },
    {
      id: "react-forms",
      tr: "comp",
      t: "Forms in React",
      pre: ["forms", "props-state"],
      s: "An input is controlled when React state drives its value, uncontrolled when the DOM keeps it. Both are valid; choose per form.",
      p: [
        "Controlled inputs need value plus onChange, every keystroke goes through state.",
        "Uncontrolled inputs with defaultValue and FormData are simpler for submit-only forms.",
        "Keep native validation and labels; React does not replace them."
      ],
      c: "function Search({ onSearch }: { onSearch: (q: string) => void }) {\n  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {\n    e.preventDefault();\n    const q = new FormData(e.currentTarget).get(\"q\");\n    onSearch(String(q ?? \"\"));\n  }\n  return (\n    <form onSubmit={handleSubmit}>\n      <label htmlFor=\"q\">Search</label>\n      <input id=\"q\" name=\"q\" defaultValue=\"\" />\n    </form>\n  );\n}",
      pit: "Passing value without onChange, which makes the input read-only and triggers a warning.",
      u: "https://react.dev/reference/react-dom/components/input"
    },
    {
      id: "state-mgmt",
      tr: "comp",
      t: "State management",
      pre: ["hooks-effects"],
      s: "Sort state by kind: local UI state, shared client state, server state (a cached copy of backend data) and URL state. Each kind has a better home.",
      p: [
        "Keep state as local as possible; lift it only when needed.",
        "Context passes values down without prop drilling; it is not a cache.",
        "Server state belongs in a fetching/caching layer, filters often belong in the URL."
      ],
      c: "const ThemeContext = createContext<\"light\" | \"dark\">(\"light\");\n\nfunction App() {\n  const [theme, setTheme] = useState<\"light\" | \"dark\">(\"light\");\n  return (\n    <ThemeContext.Provider value={theme}>\n      <Page onToggle={() => setTheme((t) => (t === \"light\" ? \"dark\" : \"light\"))} />\n    </ThemeContext.Provider>\n  );\n}",
      pit: "Copying server data into a global store by hand, then fighting stale and duplicated data.",
      u: "https://react.dev/learn/managing-state"
    },
    {
      id: "data-fetching",
      tr: "data",
      t: "Fetching & caching",
      pre: ["hooks-effects", "http-fetch"],
      s: "Fetching data means handling loading, errors, races, caching and refetching. Frameworks and query libraries solve most of this; know what they do for you.",
      p: [
        "Ignore or abort stale responses when inputs change quickly.",
        "Cache by a key (such as the URL and params) and decide when data goes stale.",
        "Avoid request waterfalls: start independent requests in parallel."
      ],
      c: "useEffect(() => {\n  let ignore = false;\n  fetch(`/api/users/${userId}`)\n    .then((r) => r.json())\n    .then((data) => {\n      if (!ignore) setUser(data);\n    });\n  return () => {\n    ignore = true; // drop the response if userId changed\n  };\n}, [userId]);",
      pit: "Fetching in an effect without cleanup, so a slow old response overwrites the newer one.",
      u: "https://react.dev/reference/react/useEffect#fetching-data-with-effects"
    },
    {
      id: "routing",
      tr: "data",
      t: "Routing",
      pre: ["components", "http-fetch"],
      s: "Routing maps URLs to screens. Client-side routers update the URL with the History API and render the matching view without a full page load.",
      p: [
        "The URL is state: put shareable state such as filters and tabs in it.",
        "Every route must also work on a hard refresh and a direct link.",
        "Move focus and announce the new page after client navigation."
      ],
      c: "// What a client router does underneath\nfunction navigate(path: string) {\n  history.pushState({}, \"\", path);\n  render(matchRoute(path));\n}\n\nwindow.addEventListener(\"popstate\", () => {\n  render(matchRoute(location.pathname));\n});",
      pit: "Using onClick handlers instead of real links, which breaks open-in-new-tab, copy link and crawlers.",
      u: "https://developer.mozilla.org/en-US/docs/Web/API/History_API"
    },
    {
      id: "loading-errors",
      tr: "data",
      t: "Loading & error states",
      pre: ["data-fetching"],
      s: "Every async view has at least three states: loading, error and success, often also empty. Design and code all of them, not just the happy path.",
      p: [
        "Suspense shows a fallback while children are waiting for code or data.",
        "Error boundaries catch render errors in a subtree and show a fallback.",
        "Reserve space for loading content to avoid layout shift."
      ],
      c: "<ErrorBoundary fallback={<p>Could not load orders.</p>}>\n  <Suspense fallback={<OrdersSkeleton />}>\n    <Orders />\n  </Suspense>\n</ErrorBoundary>",
      pit: "Showing a blank screen or an endless spinner when a request fails, with no retry.",
      u: "https://react.dev/reference/react/Suspense"
    },
    {
      id: "rendering-strategies",
      tr: "data",
      t: "CSR, SSR & SSG",
      pre: ["routing", "data-fetching"],
      s: "Where HTML is produced shapes speed, SEO and cost. CSR renders in the browser, SSR renders per request on the server, SSG renders at build time.",
      p: [
        "CSR: simple hosting, slower first content, needs JavaScript to show anything.",
        "SSR: fast first content with fresh data, but server cost and time to first byte matter.",
        "SSG: fastest and cacheable, only for content that does not change per request."
      ],
      c: "// SSR in plain terms\napp.get(\"/products/:id\", async (req, res) => {\n  const product = await db.getProduct(req.params.id);\n  const html = renderToString(<ProductPage product={product} />);\n  res.send(layout(html, product));\n});",
      pit: "Choosing SSR for an internal dashboard behind login where CSR would be simpler and good enough.",
      u: "https://web.dev/articles/rendering-on-the-web"
    },
    {
      id: "hydration",
      tr: "data",
      t: "Hydration & streaming",
      pre: ["rendering-strategies"],
      s: "Hydration attaches event handlers to server-rendered HTML so it becomes interactive. Streaming sends HTML in chunks so the page can show before all data is ready.",
      p: [
        "The first client render must match the server HTML exactly.",
        "Until hydration finishes, the page is visible but may not respond to input.",
        "Suspense boundaries mark where streamed HTML can arrive later."
      ],
      c: "// Bad: differs between server and client -> hydration mismatch\nfunction Clock() {\n  return <span>{new Date().toLocaleTimeString()}</span>;\n}\n\n// Better: render a stable value, update after mount\nfunction Clock() {\n  const [time, setTime] = useState<string | null>(null);\n  useEffect(() => setTime(new Date().toLocaleTimeString()), []);\n  return <span>{time ?? \"--:--\"}</span>;\n}",
      pit: "Reading window, localStorage or the current time during render, causing hydration mismatches.",
      u: "https://react.dev/reference/react-dom/client/hydrateRoot"
    },
    {
      id: "modules-bundlers",
      tr: "perf",
      t: "Modules & bundlers",
      pre: ["typescript-ui"],
      s: "ES modules (import/export) are the standard module system. Bundlers resolve imports, compile TypeScript and JSX, and output optimized files for the browser.",
      p: [
        "Static imports let tools tree-shake unused exports.",
        "Side effects at module top level can prevent tree shaking.",
        "Check bundle size with an analyzer before adding a dependency."
      ],
      c: "// utils.ts\nexport function formatPrice(cents: number) {\n  return (cents / 100).toFixed(2);\n}\nexport function unusedHelper() { /* dropped by tree shaking */ }\n\n// app.ts\nimport { formatPrice } from \"./utils\";",
      pit: "Importing a whole library (import _ from \"lodash\") for one function and shipping all of it.",
      u: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules"
    },
    {
      id: "code-splitting",
      tr: "perf",
      t: "Code splitting",
      pre: ["modules-bundlers", "routing"],
      s: "Code splitting breaks the bundle into chunks loaded on demand. Users download the code for the screen they are on, not the whole app.",
      p: [
        "Dynamic import() creates a split point.",
        "Split by route first; then by heavy, rarely used widgets.",
        "Wrap lazy components in Suspense to show a fallback while the chunk loads."
      ],
      c: "import { lazy, Suspense } from \"react\";\n\nconst Reports = lazy(() => import(\"./Reports\"));\n\nfunction ReportsRoute() {\n  return (\n    <Suspense fallback={<p>Loading reports...</p>}>\n      <Reports />\n    </Suspense>\n  );\n}",
      pit: "Declaring lazy() inside a component, which creates a new component each render and resets its state.",
      u: "https://react.dev/reference/react/lazy"
    },
    {
      id: "core-web-vitals",
      tr: "perf",
      t: "Core Web Vitals",
      pre: ["browser-rendering", "hydration", "code-splitting"],
      s: "Core Web Vitals measure real user experience: LCP for loading, INP for responsiveness, CLS for visual stability. Measure in the field, not only in a lab.",
      p: [
        "Good thresholds at the 75th percentile: LCP within 2.5 s, INP within 200 ms, CLS within 0.1.",
        "INP replaced FID as the responsiveness metric in 2024.",
        "Lab tools (Lighthouse) help debug; field data (real users) is what counts."
      ],
      c: "// Field measurement with the web-vitals library\nimport { onLCP, onINP, onCLS } from \"web-vitals\";\n\nfunction send(metric) {\n  navigator.sendBeacon(\"/analytics\", JSON.stringify(metric));\n}\nonLCP(send);\nonINP(send);\nonCLS(send);",
      pit: "Optimizing only for a Lighthouse score on a fast laptop while real users on mid-range phones see poor INP.",
      u: "https://web.dev/articles/vitals"
    },
    {
      id: "images-fonts",
      tr: "perf",
      t: "Images & fonts",
      pre: ["core-web-vitals", "responsive"],
      s: "Images and fonts are often the heaviest bytes on a page and the usual LCP and CLS culprits. Size them, choose formats and load them with intent.",
      p: [
        "Always set width and height (or aspect-ratio) to reserve space.",
        "Use srcset and sizes so devices download an appropriate size.",
        "Lazy-load below-the-fold images, never the LCP image; font-display controls text during font load."
      ],
      c: "<img src=\"hero-800.avif\"\n     srcset=\"hero-400.avif 400w, hero-800.avif 800w, hero-1600.avif 1600w\"\n     sizes=\"(min-width: 768px) 50vw, 100vw\"\n     width=\"800\" height=\"450\"\n     fetchpriority=\"high\" alt=\"Team at work\">\n\n<img src=\"chart.png\" loading=\"lazy\" width=\"600\" height=\"300\" alt=\"Sales by month\">",
      pit: "Adding loading=\"lazy\" to the hero image, which delays the LCP element.",
      u: "https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images"
    },
    {
      id: "render-perf",
      tr: "perf",
      t: "Re-render performance",
      pre: ["state-mgmt", "lists-keys"],
      s: "React re-renders a component when its state changes or its parent re-renders. Usually that is cheap; measure with the Profiler before optimizing.",
      p: [
        "Move state down so fewer components re-render.",
        "memo skips re-rendering when props are equal; new objects or functions as props defeat it.",
        "Virtualize long lists instead of rendering thousands of rows."
      ],
      c: "const Row = memo(function Row({ item, onSelect }: RowProps) {\n  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;\n});\n\nfunction List({ items }: { items: Item[] }) {\n  const [selected, setSelected] = useState<string | null>(null);\n  const onSelect = useCallback((id: string) => setSelected(id), []);\n  return <ul>{items.map((i) => <Row key={i.id} item={i} onSelect={onSelect} />)}</ul>;\n}",
      pit: "Wrapping everything in useMemo and useCallback by default, adding complexity with no measured gain.",
      u: "https://react.dev/reference/react/memo"
    },
    {
      id: "accessibility",
      tr: "quality",
      t: "ARIA, keyboard & focus",
      pre: ["forms", "dom-events"],
      s: "Accessible UI works with a keyboard, a screen reader and zoom. Native HTML comes first; ARIA fills gaps for custom widgets and must match real behavior.",
      p: [
        "No ARIA is better than bad ARIA: a role promises keyboard behavior you must implement.",
        "Every interactive element needs a visible focus style and an accessible name.",
        "Manage focus in dialogs: move it in, trap it, return it on close."
      ],
      c: "<button aria-expanded=\"false\" aria-controls=\"filters\">\n  Filters\n</button>\n<div id=\"filters\" hidden>...</div>\n\n<script>\n  const btn = document.querySelector(\"[aria-controls=filters]\");\n  btn.addEventListener(\"click\", () => {\n    const open = btn.getAttribute(\"aria-expanded\") === \"true\";\n    btn.setAttribute(\"aria-expanded\", String(!open));\n    document.getElementById(\"filters\").hidden = open;\n  });\n</script>",
      pit: "Removing focus outlines with outline: none and no replacement, leaving keyboard users lost.",
      u: "https://www.w3.org/WAI/ARIA/apg/"
    },
    {
      id: "security",
      tr: "quality",
      t: "XSS, CSP, CSRF, CORS",
      pre: ["storage-cookies", "dom-events"],
      s: "The browser runs whatever script reaches the page. Frontend security means never turning data into code, limiting what can run, and understanding which requests carry credentials.",
      p: [
        "XSS: insert user data as text, not HTML. React escapes by default; dangerouslySetInnerHTML does not.",
        "CSP restricts where scripts can load from and blocks inline script.",
        "CSRF is mitigated by SameSite cookies and tokens; CORS is enforced by the browser and is not an auth mechanism."
      ],
      c: "// Unsafe: user input becomes HTML\nel.innerHTML = comment.text;\n\n// Safe: user input stays text\nel.textContent = comment.text;\n\n// Response header\nContent-Security-Policy: default-src 'self'; script-src 'self'",
      pit: "Setting Access-Control-Allow-Origin: * on an API and assuming CORS protects it; CORS only restricts browsers reading responses.",
      u: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"
    },
    {
      id: "i18n",
      tr: "quality",
      t: "Internationalization",
      pre: ["components"],
      s: "i18n prepares the UI for many languages and regions: translated strings, plural rules, number, date and currency formats, and right-to-left layout.",
      p: [
        "Use Intl APIs for numbers, dates, currencies and plurals instead of string concatenation.",
        "Translate whole messages with placeholders, not sentence fragments.",
        "Use logical CSS properties (margin-inline-start) so RTL layouts work."
      ],
      c: "const price = new Intl.NumberFormat(\"de-DE\", {\n  style: \"currency\",\n  currency: \"EUR\",\n}).format(1234.5); // \"1.234,50 €\"\n\nconst rules = new Intl.PluralRules(\"en-US\");\nrules.select(1); // \"one\"\nrules.select(5); // \"other\"",
      pit: "Building messages like count + \" item\" + (count > 1 ? \"s\" : \"\"), which fails in most languages.",
      u: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl"
    },
    {
      id: "component-tests",
      tr: "quality",
      t: "Unit & component tests",
      pre: ["hooks-effects", "accessibility"],
      s: "Unit tests check logic; component tests render a component and interact with it like a user would. Query by role and label, assert on what the user sees.",
      p: [
        "Test behavior, not implementation details such as internal state.",
        "Querying by role and accessible name also checks accessibility.",
        "Mock the network at the boundary, not your own components."
      ],
      c: "test(\"adds a todo\", async () => {\n  render(<TodoApp />);\n  await user.type(screen.getByRole(\"textbox\", { name: /new todo/i }), \"Buy milk\");\n  await user.click(screen.getByRole(\"button\", { name: /add/i }));\n  expect(screen.getByText(\"Buy milk\")).toBeInTheDocument();\n});",
      pit: "Snapshot-testing whole components, so every markup change breaks tests and reviewers just update snapshots.",
      u: "https://react.dev/reference/react/act"
    },
    {
      id: "e2e-tests",
      tr: "quality",
      t: "End-to-end tests",
      pre: ["component-tests", "routing"],
      s: "End-to-end tests drive a real browser through the real app. They are slow and costly, so keep them for critical user journeys.",
      p: [
        "Cover a few key flows: sign in, checkout, core create/edit.",
        "Wait for visible conditions, never for fixed timeouts.",
        "Seed test data so each test is independent."
      ],
      c: "test(\"user can check out\", async ({ page }) => {\n  await page.goto(\"/products/a-1\");\n  await page.getByRole(\"button\", { name: \"Add to cart\" }).click();\n  await page.getByRole(\"link\", { name: \"Cart\" }).click();\n  await page.getByRole(\"button\", { name: \"Checkout\" }).click();\n  await expect(page.getByText(\"Order confirmed\")).toBeVisible();\n});",
      pit: "Adding sleep(2000) to fix flaky tests, which makes the suite slow and still flaky.",
      u: "https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/Automated_testing"
    },
    {
      id: "design-systems",
      tr: "quality",
      t: "Design systems",
      pre: ["css-tokens", "accessibility", "props-state"],
      s: "A design system is shared tokens, components and guidelines that keep products consistent. Accessibility and behavior are built in once and reused everywhere.",
      p: [
        "Tokens are the foundation; components consume tokens, never raw values.",
        "Components have documented props, states and accessibility behavior.",
        "Version it and treat breaking changes like an API change."
      ],
      c: "type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {\n  variant?: \"primary\" | \"secondary\";\n};\n\nexport function Button({ variant = \"primary\", className, ...rest }: ButtonProps) {\n  return <button className={`btn btn-${variant} ${className ?? \"\"}`} {...rest} />;\n}",
      pit: "Letting teams fork components locally, so fixes and accessibility improvements never reach them.",
      u: "https://www.w3.org/WAI/ARIA/apg/patterns/"
    }
  ]
};
