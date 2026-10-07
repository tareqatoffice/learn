# The Next.js Question Book

**A fully explained Q&A guide — from the App Router to caching, Server Actions, and production.**

---

## How to use this book

Every question follows the same shape:

- **Short answer** — what you'd say in one or two sentences.
- **Explanation** — why it works that way.
- **Code** — a runnable illustration where it helps.
- **Watch out** — the trap, the follow-up question, or the mistake people make.

Read it front-to-back once, then use the section index to drill weak areas. This book assumes the React fundamentals in *The React Question Book* — especially Server Components, Suspense, and Actions.

Versions: written against Next.js 16 (App Router). Where behavior changed between 14, 15, and 16, the question says so — interviewers love asking about those changes.

### Contents

1. Fundamentals — what Next.js is, App Router vs Pages Router
2. Routing
3. Rendering — static, dynamic, streaming
4. Data fetching
5. Caching and revalidation
6. Mutations — Server Actions and Route Handlers
7. Proxy, authentication, and request data
8. Built-in optimizations
9. Configuration and deployment
10. Errors and testing
11. Rapid-fire and code puzzles

---

# Part 1 — Fundamentals

## Q1. What is Next.js, and why use it instead of plain React?

**Short answer.** Next.js is a React framework. React gives you components; Next adds routing, server rendering, data fetching, caching, bundling, and deployment conventions so you don't assemble them yourself.

**Explanation.** What Next provides on top of React:

| Concern | Plain React (Vite SPA) | Next.js |
|---|---|---|
| Routing | Add a router library | File-system routing |
| Rendering | Client-only | Static, dynamic, streaming server rendering |
| Server Components | Not available without a framework | Default |
| Data mutations | Your own API | Server Actions + Route Handlers |
| Images, fonts, scripts | Manual | `next/image`, `next/font`, `next/script` |
| Bundler | Vite | Turbopack (default since 16) |

**Watch out.** "Next.js is for SEO" is an incomplete answer. The bigger wins are less client JavaScript (Server Components), faster first paint (streaming), and colocated server code. A dashboard behind login still benefits, even with no SEO needs.

---

## Q2. App Router vs Pages Router

**Short answer.** The Pages Router (`pages/`) is the original: every page is a Client Component, data comes from `getServerSideProps`/`getStaticProps`. The App Router (`app/`, since 13.4) is built on React Server Components, nested layouts, streaming, and Server Actions. New projects should use the App Router.

**Explanation.**

| | Pages Router | App Router |
|---|---|---|
| Directory | `pages/` | `app/` |
| Default component type | Client | Server |
| Data fetching | `getServerSideProps`, `getStaticProps` | `async` components + `fetch` / DB calls |
| Layouts | `_app.js`, manual per-page | Nested `layout.js`, preserved on navigation |
| Loading / error UI | Manual | `loading.js`, `error.js` conventions |
| Mutations | API routes | Server Actions, Route Handlers |
| API endpoints | `pages/api/*` | `app/**/route.js` |

Both can coexist in one project during migration. A route must not exist in both.

**Watch out.** The Pages Router is still supported — saying "it's deprecated" is wrong. But new React features (Server Components, `use cache`, streaming per segment) only exist in the App Router.

---

## Q3. What are the App Router file conventions?

**Short answer.** Folders define URL segments; special files inside a folder define the UI for that segment. A folder becomes a public route only when it has a `page.js` or `route.js`.

**Explanation.**

```
app/
├─ layout.js          ← root layout (required, contains <html> and <body>)
├─ page.js            ← "/"
├─ not-found.js       ← 404 UI
├─ global-error.js    ← catches errors in the root layout
└─ dashboard/
   ├─ layout.js       ← wraps everything under /dashboard
   ├─ loading.js      ← Suspense fallback for this segment
   ├─ error.js        ← error boundary for this segment
   ├─ page.js         ← "/dashboard"
   └─ settings/
      └─ page.js      ← "/dashboard/settings"
```

| File | Purpose |
|---|---|
| `page.js` | Unique UI of a route; makes it public |
| `layout.js` | Shared UI; persists across navigation |
| `template.js` | Like layout, but remounts on every navigation |
| `loading.js` | Wraps the page in `<Suspense>` |
| `error.js` | Wraps the page in an error boundary (must be a Client Component) |
| `not-found.js` | UI for `notFound()` |
| `route.js` | HTTP endpoint (cannot coexist with `page.js` in the same folder) |
| `default.js` | Fallback for parallel route slots |

The rendered nesting is: `layout → template → error → loading → not-found → page`.

**Watch out.** Because only `page.js` and `route.js` are public, you can colocate components, tests, and utilities inside `app/` safely. Prefix a folder with `_` (`_components`) to opt it out of routing explicitly.

---

## Q4. Layout vs template — what's the difference?

**Short answer.** A layout is preserved across navigations between its child routes — its state, effects, and DOM stay alive. A template is re-created on every navigation, so state resets and effects re-run.

**Explanation.**

```jsx
// app/dashboard/layout.js
export default function DashboardLayout({ children }) {
  return (
    <div className="grid">
      <Sidebar />          {/* keeps scroll position and open menus across pages */}
      <main>{children}</main>
    </div>
  );
}
```

Use a template for things that should restart per page: enter animations, per-page analytics effects, or a form that must reset.

**Watch out.** Layouts don't receive `searchParams`, and they don't re-render on navigation between their children. If a layout needs the current pathname, use `usePathname()` in a Client Component inside it. Don't fetch page-specific data in a layout expecting it to refresh.

---

## Q5. Are components Server or Client Components by default in Next.js?

**Short answer.** Everything in `app/` is a Server Component by default. You opt into the client with `'use client'` at the top of a file, which makes that module and everything it imports part of the client bundle.

**Explanation.** Push `'use client'` as deep as possible:

```jsx
// app/products/[id]/page.js — Server Component
import { getProduct } from '@/lib/data';
import AddToCartButton from './AddToCartButton';

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  return (
    <>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <AddToCartButton id={product.id} />   {/* only this ships JS */}
    </>
  );
}
```

```jsx
// app/products/[id]/AddToCartButton.js
'use client';
export default function AddToCartButton({ id }) {
  const [pending, setPending] = useState(false);
  // ...
}
```

You need a Client Component for: state, effects, event handlers, browser APIs, and hooks such as `useRouter`, `usePathname`, `useSearchParams`.

**Watch out.** Putting `'use client'` on the root layout to "make things work" turns the whole app into client code and throws away the main benefit of the App Router. Also, use the `server-only` package in modules with secrets so importing them from a Client Component fails the build:

```js
import 'server-only';
```

---

# Part 2 — Routing

## Q6. How do dynamic routes work, and why is `params` a promise?

**Short answer.** A folder named `[slug]` matches one segment; `[...slug]` matches one or more; `[[...slug]]` matches zero or more. Since Next.js 15, `params` and `searchParams` are promises you must `await` — synchronous access was removed in 16.

**Explanation.**

```jsx
// app/blog/[slug]/page.js  →  /blog/hello-world
export default async function Post({ params, searchParams }) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const post = await getPost(slug);
  return <article>{post.title}</article>;
}
```

| Folder | Matches | `params` |
|---|---|---|
| `[slug]` | `/a` | `{ slug: 'a' }` |
| `[...slug]` | `/a/b/c` | `{ slug: ['a','b','c'] }` |
| `[[...slug]]` | `/` and `/a/b` | `{}` or `{ slug: ['a','b'] }` |

In a Client Component, unwrap with `use(params)` or read with `useParams()`.

**Watch out.** They became async so Next can start rendering parts of the page that don't depend on request data before the request data is known. Reading `searchParams` makes the page dynamic — read it only in the components that need it, inside a Suspense boundary, rather than at the top of the page.

---

## Q7. What are route groups?

**Short answer.** A folder in parentheses — `(marketing)` — organizes routes without affecting the URL. Used to give different sections different layouts, or to split the app into multiple root layouts.

**Explanation.**

```
app/
├─ (marketing)/
│  ├─ layout.js        ← public header/footer
│  ├─ page.js          ← "/"
│  └─ pricing/page.js  ← "/pricing"
└─ (app)/
   ├─ layout.js        ← authenticated shell with sidebar
   └─ dashboard/page.js ← "/dashboard"
```

**Watch out.** Two groups must not resolve to the same URL (`(a)/about` and `(b)/about` is a build error). Navigating between different root layouts triggers a full page load, not a client-side transition.

---

## Q8. What are parallel routes?

**Short answer.** Named slots, created with `@folder`, that render multiple pages in the same layout at once — each with its own loading and error states, and its own navigation.

**Explanation.**

```
app/dashboard/
├─ layout.js
├─ page.js
├─ @analytics/page.js
└─ @team/page.js
```

```jsx
export default function Layout({ children, analytics, team }) {
  return (
    <>
      {children}
      <div className="grid">
        {analytics}
        {team}
      </div>
    </>
  );
}
```

Uses: dashboards with independent panels, conditional rendering by role (`{isAdmin ? admin : user}`), and modals (with intercepting routes).

**Watch out.** On a hard refresh, Next can't know what a slot should show for an unmatched URL. Each slot needs a `default.js` (returning `null` or a fallback) — since Next.js 16 builds fail without it.

---

## Q9. What are intercepting routes?

**Short answer.** They let a route load inside the current layout during client navigation, while a direct visit or refresh shows the full page. The classic use: clicking a photo opens it in a modal with a shareable URL; refreshing shows the photo page.

**Explanation.** Conventions mirror relative paths: `(.)` same level, `(..)` one level up, `(...)` from the app root.

```
app/
├─ feed/
│  ├─ page.js
│  └─ @modal/
│     ├─ default.js            ← returns null
│     └─ (..)photo/[id]/page.js ← modal version, shown on client nav
└─ photo/[id]/page.js           ← full page, shown on refresh/direct link
```

```jsx
// app/feed/@modal/(..)photo/[id]/page.js
export default async function PhotoModal({ params }) {
  const { id } = await params;
  return <Modal><Photo id={id} /></Modal>;
}
```

Close the modal with `router.back()`.

**Watch out.** `(..)` is based on *route segments*, not file-system folders — slots like `@modal` don't count as a segment. This is the most common reason interception "doesn't work".

---

## Q10. How does navigation work — `<Link>`, prefetching, and `useRouter`?

**Short answer.** `<Link>` does client-side navigation and prefetches routes as they enter the viewport. `useRouter()` gives imperative navigation in Client Components. On the server, use `redirect()` and `notFound()`.

**Explanation.**

```jsx
import Link from 'next/link';
<Link href="/dashboard">Dashboard</Link>
```

```jsx
'use client';
import { useRouter } from 'next/navigation';   // NOT 'next/router' in the App Router

const router = useRouter();
router.push('/dashboard');
router.replace('/login');
router.refresh();   // re-fetch Server Components for the current route, keep client state
router.back();
```

```jsx
// Server Component or Server Action
import { redirect, notFound } from 'next/navigation';

const post = await getPost(slug);
if (!post) notFound();
if (!session) redirect('/login');
```

Prefetching: static routes are prefetched in full; dynamic routes prefetch down to the nearest `loading.js`, so the loading UI appears instantly on click.

**Watch out.** `redirect()` works by throwing a special error. Don't call it inside a `try/catch` that swallows errors — call it after the `try` block.

---

## Q11. What do `loading.js` and `error.js` do?

**Short answer.** `loading.js` wraps the segment's page in `<Suspense>` with your file as the fallback, so navigation shows it instantly while the page streams. `error.js` wraps the segment in an error boundary and shows a recovery UI.

**Explanation.**

```jsx
// app/dashboard/loading.js
export default function Loading() {
  return <DashboardSkeleton />;
}
```

```jsx
// app/dashboard/error.js
'use client';
export default function Error({ error, reset }) {
  return (
    <div role="alert">
      <p>Couldn't load the dashboard.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

Key behaviors:

- The layout at the same level stays interactive — errors and loading replace only the page below it.
- `error.js` does not catch errors thrown by the layout in the same folder; that goes to the parent's `error.js`. The root layout needs `global-error.js`.
- In production, error messages from Server Components are replaced with a generic message plus a `digest` you can match in server logs — secrets don't leak.

**Watch out.** `loading.js` is one coarse boundary per segment. For finer control — showing the header immediately while a slow widget streams — add your own `<Suspense>` boundaries inside the page.

---

## Q12. How do you handle a 404?

**Short answer.** Call `notFound()` when data is missing; it renders the nearest `not-found.js` and returns a 404 status. Unmatched URLs render `app/not-found.js`.

**Explanation.**

```jsx
// app/blog/[slug]/page.js
import { notFound } from 'next/navigation';

export default async function Post({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  return <Article post={post} />;
}
```

**Watch out.** Returning `<p>Not found</p>` from the page renders the message with a **200** status — bad for SEO and monitoring. Always use `notFound()`.

---

# Part 3 — Rendering

## Q13. Static vs dynamic rendering — what decides which one a route gets?

**Short answer.** Static rendering happens at build time (or on revalidation) and the HTML is cached and served from a CDN. Dynamic rendering happens per request. A route becomes dynamic when it reads request-time data: `cookies()`, `headers()`, `searchParams`, `connection()`, or uncached data.

**Explanation.**

| Makes it dynamic | Why |
|---|---|
| `await cookies()` / `await headers()` | Values only exist per request |
| `await searchParams` | Query string is per request |
| `await connection()` | Explicit "wait for a real request" |
| `fetch(url, { cache: 'no-store' })` | Explicitly uncached data |
| `export const dynamic = 'force-dynamic'` | Route segment config |

Check the build output: Next prints which routes are static (`○`) and which are dynamic (`ƒ`).

**Watch out.** One `cookies()` call in the root layout makes *every* route dynamic. Read request data as low in the tree as possible — ideally inside a Suspense boundary so the rest of the page can still be prerendered (Q15).

---

## Q14. How does streaming work in Next.js?

**Short answer.** Next renders Server Components in chunks. The static shell is sent immediately; each `<Suspense>` boundary (including `loading.js`) shows its fallback and streams its real content when ready. The user sees and interacts with the page before slow data finishes.

**Explanation.**

```jsx
export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<CardSkeleton />}>
        <Revenue />           {/* awaits a slow query */}
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <LatestInvoices />    {/* independent, streams separately */}
      </Suspense>
    </>
  );
}

async function Revenue() {
  const data = await getRevenue();   // 3s
  return <Chart data={data} />;
}
```

Boundaries resolve independently, so the slowest query no longer blocks the whole page.

**Watch out.** Once streaming starts, the HTTP status is already 200. A `notFound()` or `redirect()` deep inside a streamed boundary works via injected client-side handling, but search engines and monitoring may see the 200. Do existence and auth checks before the first Suspense boundary.

---

## Q15. What are Cache Components and Partial Prerendering?

**Short answer.** Cache Components (enabled with `cacheComponents: true`, Next.js 16) make one route both static and dynamic: everything that can be prerendered becomes a static shell served instantly, and request-specific parts stream in through Suspense holes. This is the model formerly called Partial Prerendering (PPR).

**Explanation.** Under this model, data access is dynamic by default. You decide per component:

- Wrap request-time work in `<Suspense>` — it becomes a dynamic hole.
- Mark cacheable work with `'use cache'` — it becomes part of the static shell.

```jsx
// next.config.js
export default { cacheComponents: true };
```

```jsx
export default function ProductPage({ params }) {
  return (
    <>
      <ProductDetails params={params} />     {/* 'use cache' — in the static shell */}
      <Suspense fallback={<CartSkeleton />}>
        <CartSummary />                       {/* reads cookies — streamed per request */}
      </Suspense>
    </>
  );
}

async function CartSummary() {
  const cartId = (await cookies()).get('cart')?.value;
  const cart = await getCart(cartId);
  return <MiniCart cart={cart} />;
}
```

If a component reads uncached or request data outside a Suspense boundary, the build fails with a clear error — you're forced to choose "cache it" or "stream it".

**Watch out.** The mental model changed: in the old model you opted *out* of static rendering; with Cache Components you opt *in* to caching. Expect interviewers to ask which model a project uses.

---

## Q16. What is `generateStaticParams`?

**Short answer.** It tells Next which values of a dynamic segment to prerender at build time. Params not in the list are rendered on first request and then cached (unless you disable that with `dynamicParams = false`).

**Explanation.**

```jsx
// app/blog/[slug]/page.js
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export const dynamicParams = true;   // default: unknown slugs render on demand
```

For large sites, prerender only the most popular pages and let the rest render on demand — builds stay fast.

**Watch out.** `generateStaticParams` replaces `getStaticPaths` from the Pages Router. Fetch calls inside it and inside the page are deduplicated, so you don't pay twice for the same request.

---

## Q17. Node.js runtime vs Edge runtime

**Short answer.** The Node.js runtime is the default and supports all Node APIs and npm packages. The Edge runtime is a lighter, Web-API-only environment with faster cold starts, but no file system, no native modules, and limited package support.

**Explanation.**

| | Node.js | Edge |
|---|---|---|
| APIs | Full Node + Web APIs | Web APIs only |
| npm compatibility | Full | Partial |
| DB drivers | Any | HTTP-based drivers only |
| Cold start | Slower | Faster |
| Default | Yes | Opt-in: `export const runtime = 'edge'` |

**Watch out.** Edge compute near the user doesn't help if your database is in one region — every query crosses the world. Most apps should stay on Node.js. Since Next.js 16, `proxy.ts` runs on Node.js (Q31).

---

# Part 4 — Data Fetching

## Q18. How do you fetch data in the App Router?

**Short answer.** Make the Server Component `async` and `await` your data directly — `fetch`, an ORM, or any server SDK. No `useEffect`, no API route in between, no loading state boilerplate.

**Explanation.**

```jsx
// app/orders/page.js
import { db } from '@/lib/db';

export default async function Orders() {
  const orders = await db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  return <OrderTable orders={orders} />;
}
```

Calling your own Route Handler from a Server Component (`fetch('/api/orders')`) is an anti-pattern: it adds an HTTP hop to the same server. Call the data function directly.

**Watch out.** Put data access in a dedicated module (a "data access layer") that checks authorization and returns only the fields the UI needs. Server Components can't leak secrets by themselves, but passing a whole DB row to a Client Component as a prop sends every field to the browser.

---

## Q19. How do you avoid request waterfalls?

**Short answer.** Start independent requests in parallel with `Promise.all`, or split them into separate components under separate Suspense boundaries so each one streams on its own.

**Explanation.**

```jsx
// Waterfall: 3 sequential round-trips
const user = await getUser(id);
const posts = await getPosts(id);
const followers = await getFollowers(id);

// Parallel: one round-trip time
const [user, posts, followers] = await Promise.all([
  getUser(id),
  getPosts(id),
  getFollowers(id),
]);
```

Even better for UX, give each section its own component and boundary, so the fast data appears before the slow data.

**Watch out.** Nested layouts and pages are rendered in parallel by Next, but `await`s *within* one component are sequential. Some waterfalls are real dependencies (you need `user.teamId` to fetch the team) — those are fine.

---

## Q20. How does request deduplication work?

**Short answer.** Within one server render, identical `fetch` GET calls are memoized automatically. For non-`fetch` data sources (ORMs, SDKs), wrap the function in React's `cache()` so multiple components can call it and the query runs once per request.

**Explanation.**

```js
// lib/data.js
import { cache } from 'react';
import 'server-only';

export const getUser = cache(async (id) => {
  return db.user.findUnique({ where: { id } });
});
```

Now `layout.js`, `page.js`, and `generateMetadata` can all call `getUser(id)` — one query. This lets you fetch where you need data instead of drilling it down as props.

**Watch out.** React `cache()` lasts for **one request** only. It's deduplication, not caching across users or requests — for that, use `'use cache'` (Q23).

---

## Q21. When do you still fetch on the client?

**Short answer.** For data that depends on client-only state or must update without navigation: infinite scroll, polling, live search-as-you-type, user-specific widgets after interaction. Use TanStack Query or SWR rather than raw `useEffect`.

**Explanation.** A good hybrid: the server renders the first page of data, the client takes over for interaction.

```jsx
// Server Component
const initial = await getComments(postId);
return <Comments postId={postId} initial={initial} />;

// Client Component
'use client';
function Comments({ postId, initial }) {
  const { data } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => fetchComments(postId),
    initialData: initial,
  });
  // ...
}
```

You can also pass a promise from a Server Component and unwrap it with `use()` in a Client Component, so the client component streams without blocking the parent.

**Watch out.** Real-time data (chat, notifications) needs a WebSocket or SSE service. Serverless function platforms usually can't hold long-lived connections — use a dedicated service.

---

# Part 5 — Caching and Revalidation

## Q22. What are the caching layers in Next.js?

**Short answer.** Four: request memoization (per render), the Data Cache (fetch results across requests), the Full Route Cache (rendered HTML + RSC payload on the server), and the client-side Router Cache (RSC payloads in the browser for back/forward and prefetches).

**Explanation.**

| Layer | Where | What | Lifetime |
|---|---|---|---|
| Request memoization | Server | Duplicate `fetch` / `cache()` calls in one render | One request |
| Data Cache | Server | `fetch` results / `'use cache'` results | Until revalidated |
| Full Route Cache | Server | Rendered output of static routes | Until revalidated or redeployed |
| Router Cache | Browser | RSC payloads of visited/prefetched routes | Session, with staleness rules |

Invalidation flows top-down: revalidating data invalidates the routes built from it.

**Watch out.** Next.js 15 reversed the defaults: `fetch` is **not** cached by default, GET Route Handlers are not cached by default, and page segments are not reused from the client Router Cache by default. Many tutorials still describe the old aggressive-caching behavior — say which version you mean.

---

## Q23. How does `'use cache'` work?

**Short answer.** `'use cache'` marks a function, component, or whole file as cacheable. Its return value is cached, keyed automatically by its arguments and closed-over values. `cacheLife` sets how long; `cacheTag` labels it for on-demand invalidation.

**Explanation.**

```js
import { cacheLife, cacheTag } from 'next/cache';

export async function getProduct(id) {
  'use cache';
  cacheLife('hours');            // built-in profiles: seconds, minutes, hours, days, weeks, max
  cacheTag(`product-${id}`);
  return db.product.findUnique({ where: { id } });
}
```

```jsx
export default async function PricingTable() {
  'use cache';
  cacheLife('days');
  const plans = await getPlans();
  return <Table plans={plans} />;
}
```

It works for any data source, not just `fetch`, and replaces the older `unstable_cache` and most `fetch` cache options.

**Watch out.** A cached function can't read `cookies()`, `headers()`, or `searchParams` inside its body — that would leak one user's data to another. Read them outside and pass the values in as arguments, which then become part of the cache key.

---

## Q24. Time-based vs on-demand revalidation

**Short answer.** Time-based revalidation refreshes cached data after a period (stale-while-revalidate). On-demand revalidation refreshes it immediately when you know data changed — after a mutation or a CMS webhook — using tags or paths.

**Explanation.**

```js
// Time-based
fetch(url, { next: { revalidate: 3600 } });   // fetch option
cacheLife('hours');                            // 'use cache'
```

```js
// On-demand
import { revalidateTag, updateTag, revalidatePath } from 'next/cache';

revalidateTag('products', 'max');   // mark stale; next visitor gets stale, refresh happens in background
updateTag(`product-${id}`);         // Server Actions only: expire now, so the user sees their own write
revalidatePath('/blog');            // invalidate everything a path rendered
```

| API | Use when |
|---|---|
| `revalidateTag(tag, profile)` | Content changes elsewhere (CMS webhook); slight staleness OK |
| `updateTag(tag)` | User just edited something and must see it immediately ("read your own writes") |
| `revalidatePath(path)` | You don't have tags; coarse invalidation |
| `refresh()` | Refresh uncached data on the current page from a Server Action |

**Watch out.** Tags are more precise than paths. One product edit should invalidate `product-42`, not every page under `/shop`. Design tags around entities when you design the data layer.

---

## Q25. What is ISR, and how does it map to the App Router?

**Short answer.** Incremental Static Regeneration serves a static page and regenerates it in the background after it goes stale, without a full rebuild. In the App Router, it's simply a static route with time-based or on-demand revalidation.

**Explanation.**

```jsx
// app/blog/[slug]/page.js
export const revalidate = 3600;   // route segment config: regenerate at most hourly

export async function generateStaticParams() { /* popular slugs */ }
```

Flow: request 1 after the hour gets the stale page instantly and triggers a rebuild; the next request gets the fresh page. With a CMS webhook calling `revalidateTag`, pages update within seconds of publishing.

**Watch out.** When self-hosting multiple instances, each instance has its own file-system cache — revalidating on one doesn't update the others. Configure a shared cache handler (e.g. Redis) via `cacheHandler` in `next.config.js`.

---

## Q26. Why isn't my page showing updated data?

**Short answer.** Something is still cached: a static route never revalidated, a `'use cache'` function with a long `cacheLife`, the client Router Cache holding an old RSC payload, or a CDN in front caching the response.

**Explanation.** Debugging order:

1. **Build output** — is the route `○` static? Then it's prerendered until revalidated.
2. **Data layer** — is the function cached? With what lifetime and tags?
3. **After a mutation** — did the Server Action call `updateTag` / `revalidatePath`?
4. **Client** — the page was navigated to before; `router.refresh()` or invalidation from an action fixes it.
5. **CDN / proxy** — check `Cache-Control` and `x-nextjs-cache` response headers.

**Watch out.** Development mode doesn't behave like production for caching. Always reproduce cache bugs with `next build && next start`.

---

## Q27. How do you cache per-user data safely?

**Short answer.** Don't put user-specific data into a shared cache keyed without the user. Either keep it dynamic (stream it in a Suspense boundary), or pass the user ID as an argument to a cached function so it's part of the key.

**Explanation.**

```js
// Safe: userId is part of the cache key
async function getRecommendations(userId) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`recs-${userId}`);
  return recommender.forUser(userId);
}

// Caller reads the session outside the cached scope
const session = await auth();
const recs = await getRecommendations(session.userId);
```

For data that must never be cached on shared infrastructure, Next provides `'use cache: private'`, which caches only in the browser.

**Watch out.** The classic incident: a page that reads cookies is accidentally made static (or a CDN caches it), and every visitor sees the first visitor's account. Make sure authenticated responses carry `Cache-Control: private, no-store` at the edge.

---

# Part 6 — Mutations: Server Actions and Route Handlers

## Q28. What are Server Actions?

**Short answer.** Async functions marked `'use server'` that run on the server but can be called from the client — as a form `action`, from an event handler, or via `useActionState`. Next generates the endpoint, serializes arguments, and can return updated UI in the same round-trip.

**Explanation.**

```js
// app/todos/actions.js
'use server';
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { auth } from '@/lib/auth';

const schema = z.object({ title: z.string().min(1).max(200) });

export async function createTodo(prevState, formData) {
  const session = await auth();
  if (!session) return { error: 'Not signed in' };

  const parsed = schema.safeParse({ title: formData.get('title') });
  if (!parsed.success) return { error: 'Title is required' };

  await db.todo.create({ data: { title: parsed.data.title, userId: session.userId } });
  updateTag(`todos-${session.userId}`);
  return { error: null };
}
```

```jsx
'use client';
import { useActionState } from 'react';
import { createTodo } from './actions';

export function NewTodo() {
  const [state, action, pending] = useActionState(createTodo, { error: null });
  return (
    <form action={action}>
      <input name="title" />
      <button disabled={pending}>Add</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

Forms using a Server Action work before JavaScript loads (progressive enhancement).

**Watch out.** Server Actions are POST requests and run one at a time per client. They're for mutations — don't use them to fetch data for rendering.

---

## Q29. Why are Server Actions a security concern?

**Short answer.** Each Server Action is a public HTTP endpoint. Anyone can call it with any arguments, even if your UI only shows the button to admins. Every action must authenticate, authorize, and validate its input itself.

**Explanation.** Checklist for every action:

1. **Authenticate** — read the session inside the action.
2. **Authorize** — check the user may act on *this* resource (`where: { id, ownerId: session.userId }`).
3. **Validate** — parse arguments with a schema; never trust types from the client.
4. **Return minimal data** — no full DB rows, no stack traces.

Next adds protections: action IDs are encrypted and non-deterministic, unused actions are removed from the build, POST-only with an `Origin` vs `Host` check against CSRF, and closed-over variables are encrypted. These don't replace authorization.

**Watch out.** Checking auth in `proxy.ts` or the page that renders the form is not enough — the action can be called directly. The check must be in the action (or the data layer it calls).

---

## Q30. Server Actions vs Route Handlers — when to use which?

**Short answer.** Use Server Actions for mutations triggered by your own Next.js UI. Use Route Handlers (`route.js`) for public or external APIs: webhooks, mobile clients, third parties, file downloads, streaming responses, and non-POST methods.

**Explanation.**

```js
// app/api/webhooks/stripe/route.js
export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  if (event.type === 'checkout.session.completed') {
    await fulfillOrder(event.data.object);
    revalidateTag('orders', 'max');
  }
  return Response.json({ received: true });
}
```

| | Server Action | Route Handler |
|---|---|---|
| Caller | Your React UI | Anyone over HTTP |
| Methods | POST only | GET, POST, PUT, PATCH, DELETE, … |
| URL | Generated, internal | Stable, documented |
| Returns | Serializable values / UI update | Any `Response` |

**Watch out.** Don't build a Route Handler just so your own Server Components can call it — call the data function directly (Q18).

---

# Part 7 — Proxy, Authentication, and Request Data

## Q31. What is `proxy.ts` (formerly middleware)?

**Short answer.** Code that runs before a request is routed — for redirects, rewrites, setting headers and cookies, and cheap checks like "has a session cookie". Next.js 16 renamed `middleware.ts` to `proxy.ts` and runs it on the Node.js runtime.

**Explanation.**

```ts
// proxy.ts (project root or src/)
import { NextResponse } from 'next/server';

export function proxy(request) {
  const session = request.cookies.get('session');
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

Good uses: locale redirects, A/B test bucketing via rewrites, auth redirects, adding security headers.

**Watch out.** Proxy is an optimistic check, not authorization. In 2025 a vulnerability (CVE-2025-29927) let attackers skip middleware entirely with a crafted header — apps that relied on it as their only auth check were exposed. Always re-check auth in the data layer and in Server Actions.

---

## Q32. How do you implement authentication in the App Router?

**Short answer.** Store the session in an `HttpOnly`, `Secure`, `SameSite` cookie (a signed/encrypted token or a session ID). Do an optimistic redirect in `proxy.ts`, then enforce real authorization close to the data — in a data access layer, Server Components, and Server Actions. Libraries: Auth.js, Better Auth, Clerk, or your provider's SDK.

**Explanation.**

```js
// lib/dal.js — data access layer
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const verifySession = cache(async () => {
  const token = (await cookies()).get('session')?.value;
  const session = await decrypt(token);
  if (!session?.userId) redirect('/login');
  return { userId: session.userId, role: session.role };
});

export async function getInvoices() {
  const { userId } = await verifySession();
  return db.invoice.findMany({
    where: { userId },
    select: { id: true, amount: true, status: true },   // DTO, not the whole row
  });
}
```

**Watch out.** Checking auth only in a layout is a mistake. Layouts don't re-render on client navigation between their children, and a page or action can be reached without the layout's check running. Check in each page/action — `cache()` makes repeated checks cheap.

---

## Q33. How do you read cookies, headers, and search params?

**Short answer.** On the server: `await cookies()`, `await headers()` from `next/headers`, and `await searchParams` in a page. On the client: `useSearchParams()`, `usePathname()`, `useParams()`. Setting cookies is only allowed in Server Actions, Route Handlers, and proxy — not during rendering.

**Explanation.**

```js
import { cookies, headers } from 'next/headers';

const cookieStore = await cookies();
const theme = cookieStore.get('theme')?.value ?? 'light';
const ua = (await headers()).get('user-agent');
```

```js
'use server';
export async function setTheme(theme) {
  (await cookies()).set('theme', theme, { httpOnly: true, sameSite: 'lax', path: '/' });
}
```

**Watch out.** `useSearchParams()` in a Client Component on a static route makes that component client-rendered up to the nearest Suspense boundary. Without a boundary the whole page falls back to client rendering, and builds warn about it. Wrap it in `<Suspense>`.

---

## Q34. How do you keep secrets out of the client bundle?

**Short answer.** Only env vars prefixed `NEXT_PUBLIC_` are inlined into client JavaScript; everything else is server-only. Mark server modules with `import 'server-only'`, and never pass secret-bearing objects as props to Client Components.

**Explanation.**

```bash
DATABASE_URL=postgres://...         # server only
STRIPE_SECRET_KEY=sk_live_...       # server only
NEXT_PUBLIC_STRIPE_KEY=pk_live_...  # bundled into the browser
```

Leak paths interviewers look for:

- A `NEXT_PUBLIC_` prefix on a secret "to make it work in a component".
- A Server Component passing `user` (with `passwordHash`) as a prop to a Client Component.
- A Server Action returning a full DB record.

React's taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`) can block specific objects or values from ever crossing to the client.

**Watch out.** `NEXT_PUBLIC_` values are inlined at **build** time. Changing them in the deployment environment without rebuilding has no effect — a common Docker gotcha (Q40).

---

# Part 8 — Built-in Optimizations

## Q35. What does `next/image` do?

**Short answer.** It serves responsive, lazily loaded, modern-format (WebP/AVIF) images resized on demand, and reserves space to prevent layout shift.

**Explanation.**

```jsx
import Image from 'next/image';
import hero from './hero.jpg';   // static import: width/height/blur inferred

<Image src={hero} alt="Team at work" placeholder="blur" preload />

<Image
  src={product.imageUrl}
  alt={product.name}
  width={600}
  height={400}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

- `sizes` tells the browser which width to download — without it, responsive images download too large.
- Mark the LCP image with `preload` (formerly `priority`) so it isn't lazy-loaded.
- Remote domains must be allowed in `images.remotePatterns`.

**Watch out.** The optimizer runs on your server or platform and can be costly at scale. For a CDN that already optimizes images, configure a custom `loader` or set `unoptimized`.

---

## Q36. What does `next/font` do?

**Short answer.** It downloads fonts at build time and self-hosts them — no request to Google at runtime — and generates fallback metrics so text doesn't shift when the web font loads.

**Explanation.**

```jsx
// app/layout.js
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Benefits: no layout shift (CLS), no third-party request (privacy, GDPR), and fonts are preloaded only on routes that use them.

**Watch out.** Each `Inter()` call creates a separate font instance. Define fonts once in a shared module and import them.

---

## Q37. How do you set metadata and SEO tags?

**Short answer.** Export a static `metadata` object or an async `generateMetadata` function from a layout or page. Next merges them down the tree and renders the `<head>` tags. File conventions handle icons, Open Graph images, `sitemap`, and `robots`.

**Explanation.**

```jsx
// app/layout.js
export const metadata = {
  title: { default: 'Acme', template: '%s | Acme' },
  description: 'Acme store',
};

// app/products/[id]/page.js
export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);   // deduplicated with the page's call
  return {
    title: product.name,
    description: product.summary,
    openGraph: { images: [product.imageUrl] },
    alternates: { canonical: `/products/${id}` },
  };
}
```

File conventions: `favicon.ico`, `icon.png`, `opengraph-image.tsx` (generated with `ImageResponse`), `sitemap.ts`, `robots.ts`.

**Watch out.** `metadata` and `generateMetadata` work only in Server Components. Setting `document.title` from a Client Component isn't seen by crawlers that don't run JavaScript.

---

## Q38. How do you load third-party scripts?

**Short answer.** With `next/script` and a loading strategy, so analytics and widgets don't block rendering.

**Explanation.**

```jsx
import Script from 'next/script';

<Script src="https://example.com/analytics.js" strategy="afterInteractive" />
<Script src="https://example.com/chat.js" strategy="lazyOnload" />
```

| Strategy | Loads |
|---|---|
| `beforeInteractive` | Before hydration — only for critical scripts, root layout only |
| `afterInteractive` (default) | Right after hydration |
| `lazyOnload` | During browser idle time |

For Google Analytics and Tag Manager, `@next/third-parties` provides optimized components.

**Watch out.** Third-party scripts are one of the biggest causes of poor INP. Audit them, load late, and remove the ones nobody uses.

---

## Q39. How do you reduce bundle size in a Next.js app?

**Short answer.** Keep components on the server, push `'use client'` to leaves, lazy-load heavy client components with `next/dynamic`, and analyze the bundle to find large dependencies.

**Explanation.**

```jsx
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('./Editor'), {
  loading: () => <EditorSkeleton />,
});

const Map = dynamic(() => import('./Map'), { ssr: false });  // only allowed in Client Components
```

Other levers:

- Run a bundle analyzer and check what each `'use client'` boundary pulls in.
- `optimizePackageImports` in `next.config.js` for libraries with many exports (icon sets, utility libraries).
- Do formatting (dates, markdown, syntax highlighting) in Server Components, so those libraries never ship.

**Watch out.** A Client Component imported by a Server Component is a *boundary* — the client component and all its imports ship. A tiny `'use client'` wrapper that imports a whole UI library can be the biggest file in your bundle.

---

# Part 9 — Configuration and Deployment

## Q40. How do environment variables work?

**Short answer.** `.env`, `.env.local`, `.env.development`, and `.env.production` are loaded automatically. Server code reads any variable from `process.env`; client code can only read `NEXT_PUBLIC_*`, which are inlined at build time.

**Explanation.** Load order (first wins): `process.env` → `.env.$(NODE_ENV).local` → `.env.local` (not loaded in test) → `.env.$(NODE_ENV)` → `.env`.

Rules of thumb:

- Commit `.env.example`, never `.env.local`.
- Validate env vars at startup with a schema, so a missing variable fails the deploy, not a user request.
- Runtime-only values (different per environment, same build) must be read on the server, not via `NEXT_PUBLIC_`.

**Watch out.** "Build once, deploy everywhere" breaks with `NEXT_PUBLIC_` variables — they're baked into the JS. Read them on the server and pass them down, or expose them through a small endpoint.

---

## Q41. How do you self-host Next.js?

**Short answer.** Run `next build` then `next start` on a Node server, or use `output: 'standalone'` to produce a minimal folder with only the needed `node_modules` — ideal for Docker. Put a CDN in front for static assets.

**Explanation.**

```js
// next.config.js
export default { output: 'standalone' };
```

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

Self-hosting concerns: shared cache handler for multiple instances (Q25), image optimization CPU cost, graceful shutdown, and the same build ID across instances so Server Action IDs match.

**Watch out.** `output: 'export'` is a different thing — a fully static site with no server. No Server Actions, no dynamic rendering, no ISR, no proxy.

---

## Q42. What is Turbopack?

**Short answer.** A Rust-based bundler built for Next.js. It's the default for both `next dev` and `next build` since Next.js 16, replacing webpack, with much faster startup and Fast Refresh.

**Explanation.** It's incremental: it caches work at the function level, so changing one file recomputes only what depends on it. You can still opt back into webpack with `--webpack` if a project depends on custom webpack configuration.

**Watch out.** Custom `webpack()` config in `next.config.js` doesn't apply to Turbopack. Projects with webpack loaders or plugins need to migrate them to `turbopack` config options or stay on webpack.

---

## Q43. How do you add observability?

**Short answer.** Use `instrumentation.ts` to initialize monitoring (OpenTelemetry, Sentry) once when the server starts, and its `onRequestError` hook to report server errors with route context.

**Explanation.**

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./otel.node');
  }
}

export async function onRequestError(error, request, context) {
  await reportError(error, {
    path: request.path,
    routeType: context.routeType,   // 'render' | 'route' | 'action' | 'proxy'
  });
}
```

Client-side, `instrumentation-client.ts` runs before hydration — the place for client error tracking and analytics. `useReportWebVitals` reports LCP, CLS, and INP.

**Watch out.** Production error messages from Server Components are replaced with a `digest`. Log the digest on the server so you can match a user's error screen to the real stack trace.

---

# Part 10 — Errors and Testing

## Q44. How does error handling differ between Server Components, Server Actions, and Route Handlers?

**Short answer.** In rendering, thrown errors go to the nearest `error.js`. In Server Actions, return expected errors as values (validation, "not allowed") and let unexpected ones throw. In Route Handlers, return an appropriate status code with `Response.json`.

**Explanation.**

```js
// Server Action — expected errors are data
export async function updateProfile(prev, formData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  await save(parsed.data);
  return { errors: null };
}
```

```js
// Route Handler — HTTP semantics
export async function GET(req, { params }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(item);
}
```

**Watch out.** Throwing for validation errors in a Server Action sends the user to the error boundary and loses their form input. Model expected failures as return values.

---

## Q45. How do you test a Next.js app?

**Short answer.** Unit and component tests with Vitest or Jest + React Testing Library for Client Components and pure logic; test data-layer functions and Server Actions as plain async functions; use Playwright end-to-end tests for routes, async Server Components, and full flows.

**Explanation.**

| What | How |
|---|---|
| Client Components | RTL + Vitest/Jest |
| Utilities, schemas, reducers | Unit tests |
| Data access layer, Server Actions | Call directly, mock DB or use a test DB |
| Async Server Components | E2E (Playwright) — unit runners don't fully support them |
| Proxy, redirects, caching | E2E against `next build && next start` |

```ts
// e2e/checkout.spec.ts
test('guest can checkout', async ({ page }) => {
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByText('1 item')).toBeVisible();
});
```

**Watch out.** Run E2E tests against a production build. Dev mode compiles on demand and caches differently, so it hides timing and caching bugs.

---

# Part 11 — Rapid-Fire and Code Puzzles

## Q46. What's wrong with this page?

```jsx
export default function Page({ params }) {
  const post = getPost(params.slug);
  return <h1>{post.title}</h1>;
}
```

<details><summary>Answer</summary>

Two bugs. `params` is a promise since Next.js 15 (sync access removed in 16), and `getPost` is presumably async but isn't awaited. Fix: `export default async function Page({ params }) { const { slug } = await params; const post = await getPost(slug); ... }`.
</details>

---

## Q47. Why does this fail to build?

```jsx
// app/dashboard/page.js
import { useState } from 'react';

export default async function Dashboard() {
  const [tab, setTab] = useState('overview');
  const data = await getData();
  return <Tabs value={tab} onChange={setTab} data={data} />;
}
```

<details><summary>Answer</summary>

Server Components can't use state or pass event handlers, and Client Components can't be `async`. Split it: keep `Dashboard` as an async Server Component that fetches `data`, and move the tab state into a `'use client'` `DashboardTabs` component that receives `data` as a prop.
</details>

---

## Q48. Spot the bug.

```js
'use server';
export async function deleteInvoice(id) {
  try {
    await db.invoice.delete({ where: { id } });
    redirect('/invoices');
  } catch (e) {
    return { error: 'Failed to delete' };
  }
}
```

<details><summary>Answer</summary>

Three problems. `redirect()` throws a special error, so the `catch` swallows it and the user gets `{ error: 'Failed to delete' }` after a successful delete — call `redirect` after the `try/catch`. There's no auth or ownership check — any caller can delete any invoice. And nothing invalidates the cached invoice list (`updateTag` / `revalidatePath`).
</details>

---

## Q49. Why is the whole site dynamic?

```jsx
// app/layout.js
import { cookies } from 'next/headers';

export default async function RootLayout({ children }) {
  const theme = (await cookies()).get('theme')?.value ?? 'light';
  return <html className={theme}><body>{children}</body></html>;
}
```

<details><summary>Answer</summary>

Reading cookies in the root layout makes every route request-dependent, so nothing can be prerendered. Options: set the theme class on the client with a small inline script, read the cookie in a small component inside a Suspense boundary, or use a CSS `prefers-color-scheme` default with a client toggle.
</details>

---

## Q50. Why does this leak data?

```jsx
// Server Component
const user = await db.user.findUnique({ where: { id } });
return <ProfileCard user={user} />;   // ProfileCard is 'use client'
```

<details><summary>Answer</summary>

Every field on `user` — including `passwordHash`, `email`, internal flags — is serialized into the RSC payload and visible in the browser. Select only the fields the client needs (`select: { name: true, avatarUrl: true }`) or map to a DTO before passing it across the boundary.
</details>

---

## Q51. Why is `useRouter` undefined / throwing here?

```jsx
'use client';
import { useRouter } from 'next/router';
```

<details><summary>Answer</summary>

`next/router` is the Pages Router API. In the App Router, import `useRouter`, `usePathname`, and `useSearchParams` from `next/navigation`. Note that the App Router's `useRouter` has no `pathname` or `query` — use the separate hooks.
</details>

---

## Q52. The user updated their profile but still sees the old name. Why?

```js
'use server';
export async function updateName(formData) {
  const { userId } = await verifySession();
  await db.user.update({ where: { id: userId }, data: { name: formData.get('name') } });
}
```

```js
export async function getUser(id) {
  'use cache';
  cacheTag(`user-${id}`);
  return db.user.findUnique({ where: { id } });
}
```

<details><summary>Answer</summary>

The action writes to the database but never invalidates the cached `getUser` result. Add ``updateTag(`user-${userId}`)`` at the end of the action — `updateTag` (not `revalidateTag`) so the user immediately reads their own write.
</details>

---

## Q53. Quick definitions

| Term | One line |
|---|---|
| **App Router** | `app/` directory router built on React Server Components |
| **Segment** | One part of the URL path, mapped to a folder |
| **Layout** | Shared UI preserved across navigation between child routes |
| **Route group** | `(folder)` — organizes routes without changing the URL |
| **Parallel route** | `@slot` — renders multiple pages in one layout |
| **Intercepting route** | `(..)path` — shows a route in the current context (e.g. a modal) |
| **Static rendering** | HTML generated at build time or on revalidation |
| **Dynamic rendering** | HTML generated per request |
| **Cache Components** | Opt-in model mixing a static shell with streamed dynamic holes |
| **`'use cache'`** | Directive that caches a function or component's output |
| **`cacheTag` / `updateTag`** | Label cached data / expire it immediately after a mutation |
| **ISR** | Static pages regenerated in the background after they go stale |
| **Server Action** | `'use server'` function callable from the client — a public POST endpoint |
| **Route Handler** | `route.js` — a custom HTTP endpoint |
| **`proxy.ts`** | Pre-routing request hook (formerly `middleware.ts`) |
| **Standalone output** | Minimal server bundle for Docker / self-hosting |

---

# Appendix — A 10-day study plan

| Day | Focus | Prove it by |
|---|---|---|
| 1 | App vs Pages Router, file conventions, Server vs Client Components | Building a 3-page app and explaining every file in `app/` |
| 2 | Dynamic, grouped, parallel, and intercepting routes | A photo feed with a modal that survives refresh as a full page |
| 3 | Static vs dynamic rendering, streaming, `loading.js` | Reading the build output and turning a `ƒ` route into `○` |
| 4 | Data fetching, waterfalls, `cache()` deduplication | Cutting a page's load time with `Promise.all` and Suspense |
| 5 | Caching layers, `'use cache'`, `cacheLife`, tags | Explaining every cache a request passes through |
| 6 | Revalidation — time-based, `revalidateTag`, `updateTag`, ISR | A CMS webhook that updates one page within seconds |
| 7 | Server Actions, forms, `useActionState`, validation | A CRUD form with server validation and immediate UI update |
| 8 | Auth — cookies, proxy, data access layer, action security | Attacking your own Server Action with curl and failing |
| 9 | Image, font, script, metadata, bundle size | Raising Lighthouse scores and shrinking the client bundle |
| 10 | Deployment, env vars, observability, testing | Dockerizing with standalone output and running Playwright against it |

---

## Final note

The questions that separate a good Next.js answer from a memorized one are almost always about **where code runs** and **what is cached**. If you can say, for any line in a page, whether it runs on the server or the client, at build time or per request, and which cache will serve it next time, you understand Next.js.
