# Frontend Best Practices — Ant Design v6 + Tailwind

> Stack: Next.js 16 · React Query · Ant Design v6 · Tailwind CSS

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Next.js Guidelines](#nextjs-guidelines) — App Router · Routing · Data Fetching · Caching & Revalidation · Metadata & SEO · Server Actions
3. [App Router Special Files](#app-router-special-files) — loading.tsx · error.tsx · not-found.tsx · global-error.tsx
4. [Axios Instance](#axios-instance)
5. [React Query Guidelines](#react-query-guidelines)
6. [Ant Design + Tailwind Guidelines](#ant-design--tailwind-guidelines)
7. [Component Standards](#component-standards)
8. [State Management](#state-management)
9. [TypeScript Standards](#typescript-standards)
10. [Performance](#performance)
11. [Error Handling](#error-handling)
12. [Testing](#testing)
13. [Authentication — Auth.js v5](#authentication--authjs-v5)
14. [Analytics — PostHog](#analytics--posthog)
15. [Bot Protection — Cloudflare Turnstile](#bot-protection--cloudflare-turnstile)
16. [Notifications — SSE](#notifications--sse)
17. [Generated API Types](#generated-api-types)
18. [Accessibility](#accessibility)
19. [Security Headers](#security-headers)
20. [Observability — Error Tracking](#observability--error-tracking)
21. [Dependency Isolation](#dependency-isolation)

---

## Project Structure

```
project-root/
├── CLAUDE.md                    # Canonical agent instructions (Claude Code)
├── AGENTS.md                    # → CLAUDE.md  (Codex, Antigravity, Windsurf, Zed…)
├── GEMINI.md                    # → CLAUDE.md  (Antigravity / Gemini priority slot)
├── .cursor/rules/standards.mdc  # Cursor always-on rule → CLAUDE.md
├── .github/
│   └── copilot-instructions.md  # → CLAUDE.md  (GitHub Copilot)
├── .env.example                 # Every env var, keys only — committed
├── .nvmrc                       # Pinned Node version
├── auth.ts                      # Auth.js v5 config — exports { handlers, auth, signIn, signOut }
├── proxy.ts                     # Route protection (Next 16 — replaces middleware.ts)
├── docs/
│   ├── BEST-PRACTICES.md        # This file
│   ├── CICD.md                  # CI/CD & git workflow
│   ├── CHANGELOG.md             # Log of changes to these standards
│   ├── DECISIONS.md             # Architecture decision records
│   ├── FAQ.md                   # Common questions
│   └── CONTRIBUTING.md          # How to propose changes
├── app/
│   ├── layout.tsx               # Root layout — providers, fonts, metadata
│   ├── page.tsx                 # Home page (/)
│   ├── loading.tsx              # Root Suspense fallback
│   ├── error.tsx                # Root error boundary (client component)
│   ├── not-found.tsx            # 404 page
│   ├── global-error.tsx         # Fallback when root layout itself errors
│   ├── (auth)/                  # Route group — login, register (no URL segment)
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   └── register/
│   │       └── page.tsx
│   └── (dashboard)/             # Route group — protected pages
│       ├── layout.tsx           # Dashboard shell (sidebar, nav)
│       ├── dashboard/
│       │   ├── page.tsx
│       │   └── loading.tsx
│       └── [resource]/
│           ├── page.tsx         # List page
│           ├── [id]/
│           │   ├── page.tsx     # Detail page
│           │   ├── loading.tsx
│           │   └── error.tsx    # Segment-scoped error boundary
│           └── error.tsx
├── components/
│   ├── ui/                      # Generic, reusable app-owned primitives
│   └── features/                # Feature-scoped components
├── hooks/                       # Custom React hooks
├── lib/
│   ├── api/                     # Axios instance + per-domain fetch functions (client-only)
│   │   ├── client.ts            # axios instance, interceptors
│   │   └── users.ts
│   ├── server/                  # "server-only" data functions for Server Components
│   │   └── users.ts
│   ├── antdTheme.ts             # AntD ThemeConfig — single source of truth for tokens
│   └── utils.ts                 # cn() and other pure utilities
├── queries/                     # React Query key factories + hooks
├── providers/                   # Client-side context providers
├── types/                       # Shared types — incl. api.gen.ts (generated)
└── constants/                   # App-wide constants
```

- One component per file. Filename matches the exported component name.
- Co-locate tests, styles, and stories next to the component they belong to.
- Never import from `app/` inside `components/` — data flows down, not up.

---

## Next.js Guidelines

### App Router

- Use the App Router exclusively. Do not mix Pages Router.
- Mark components as `"use client"` only when they require browser APIs, event handlers, or hooks. Default to Server Components.
- Never fetch data inside a Client Component when a Server Component can do it.

```tsx
// Good — Server Component prefetches into the cache; Client Component reads from it
// app/users/page.tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { UserTable } from "@/components/features/UserTable";
import { getQueryClient } from "@/lib/queryClient";
import { getUsersServer } from "@/lib/server/users";
import { userKeys } from "@/queries/users.keys";

export default async function UsersPage() {
  const queryClient = getQueryClient(); // per-request client — see React Query Setup
  await queryClient.prefetchQuery({ queryKey: userKeys.lists(), queryFn: getUsersServer });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserTable />
    </HydrationBoundary>
  );
}
```

The prefetch goes through a **server-only** data module — never the client axios layer (`lib/api/*`), whose interceptor reads the session via `getSession()` and only works in the browser; importing it here compiles but silently prefetches unauthenticated. The `import "server-only"` marker turns that mistake into a build error:

```ts
// lib/server/users.ts — server-side data layer for Server Components
import "server-only";
import { auth } from "@/auth";
import type { User } from "@/types/user";

export async function getUsersServer(): Promise<User[]> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized"); // proxy.ts is optimistic — re-verify here
  const res = await fetch(`${process.env.API_URL}/users`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
  return res.json();
}
```

> Do not pass server data as `initialData` to Client Components. `initialData` is seeded into the cache untimed, so its `staleTime` is measured from client mount rather than when the server actually fetched the data (and under the common `staleTime: 0` it refetches on every mount) — and it has to be threaded down through props. `HydrationBoundary` + `dehydrate` instead transfers the full server cache *with* each query's real fetch timestamp, so the configured `staleTime` is honored across every prefetched query and no double-fetch occurs.

### Routing & Navigation

- Use `<Link>` for all internal navigation. Never `<a>`.
- Use `useRouter().push()` for programmatic navigation inside Client Components only. Import `useRouter` from `next/navigation`, not `next/router` (Pages Router).
- Enable typed routes (`typedRoutes: true` in `next.config.ts`) so `<Link href>` and `router.push()` are type-checked. Run `npx next typegen` to regenerate the route types without a full build.
- In Next.js 15+, `params` and `searchParams` are Promises. Always type and await them:

```tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
  // ...
}
```

### Data Fetching

- Server Components: fetch directly via `async/await` with `fetch()` or a server-side service layer.
- Client Components: use React Query (see below). Never `useEffect` + `fetch`.
- Use `loading.tsx` for route-level loading UI and `error.tsx` for error boundaries.
- Initiate independent fetches in parallel with `Promise.all` — never await them sequentially:

```tsx
// Bad — getAlbums blocks until getArtist resolves
const artist = await getArtist(username);
const albums = await getAlbums(username);

// Good — both start at the same time
const [artist, albums] = await Promise.all([getArtist(username), getAlbums(username)]);
```

- Wrap slow or dynamic Server Components in `<Suspense>` for component-level streaming. The fallback renders immediately while the async work completes:

```tsx
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <StaticHeader />
      <Suspense fallback={<Skeleton />}>
        <SlowDataComponent />   {/* streams in when ready */}
      </Suspense>
    </>
  );
}
```

- Wrap components that use runtime APIs (`cookies()`, `headers()`, `searchParams`) in `<Suspense>` so they don't block the static shell.
- Use `connection()` from `next/server` when a component must wait for an incoming request (e.g. fresh randomness or time) without reading `cookies()`/`headers()` — it marks the component dynamic the same way.

### Caching & Revalidation

Next.js 16 has two caching models. Use the new model for new projects.

**New model — `use cache` directive** (opt-in: `cacheComponents: true` in `next.config.ts`):

- Add `"use cache"` to the top of any async function or Server Component to cache its result.
- Use `cacheLife()` to set cache duration. Use `cacheTag()` to enable on-demand invalidation.

```ts
// lib/data.ts
import { cacheLife, cacheTag } from "next/cache";

export async function getProducts() {
  "use cache";
  cacheLife("hours");   // profiles: seconds | minutes | hours | days | weeks | max
  cacheTag("products");
  return db.query("SELECT * FROM products");
}
```

- `revalidateTag("products", "max")` — stale-while-revalidate (use in Server Actions or Route Handlers). In Next.js 16 the cache-profile second arg drives SWR behaviour; the single-arg `revalidateTag("products")` form is deprecated and now performs a blocking expire. Unlike `updateTag`, it does not also refresh the data within the same request — when the user must immediately see their own write, use `updateTag` in the Server Action.
- `updateTag("products")` — immediately expires the cache, user sees their change right away (Server Actions only).
- Prefer tag-based invalidation over `revalidatePath` — it is more precise.

**Previous model** (default, no config change needed):

- Cache individual `fetch` calls with `{ next: { revalidate: 3600 } }` (time-based) or `{ cache: "force-cache" }` (indefinite).
- Cache non-`fetch` async functions (e.g. DB queries) with `unstable_cache`:

```ts
import { unstable_cache } from "next/cache";

export const getCachedUser = unstable_cache(
  async (id: string) => db.users.findById(id),
  ["user"],
  { tags: ["user"], revalidate: 3600 }
);
```

- On-demand invalidation: call `revalidateTag("user")` or `revalidatePath("/profile")` in a Server Action after a mutation.

**Deduplication** — wrap shared data fetches in `React.cache` so the same request is only executed once per render, even when called from multiple components:

```ts
import { cache } from "react";

export const getUser = cache(async (id: string) => db.users.findById(id));
```

### Environment Variables

- Prefix client-exposed variables with `NEXT_PUBLIC_`.
- Access server-only secrets exclusively in Server Components, API routes, or server actions.
- Never log or expose env vars in client bundles.
- Commit a `.env.example` listing **every** variable the app reads — keys only, no values. Keep it in sync as you add variables; the real `.env*` files stay gitignored. It is the canonical list of required config for new developers and CI.

### Server Actions

- Use Server Actions for form submissions and mutations. For optimistic UI, pair them with `useOptimistic` (below).
- **Re-verify the session in every action.** `proxy.ts` is an optimistic, UX-level check that can be bypassed (cf. CVE-2025-29927) — every Server Action and server data function is a public endpoint and must check auth itself. Use a shared helper; see the [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security).
- Validate all input with Zod before any database or API call.

```ts
// lib/server/requireUser.ts — shared session guard for actions & server data functions
import "server-only";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  // Renders app/unauthorized.tsx (requires experimental.authInterrupts in next.config.ts).
  // Without the flag, throw instead — an auth failure is not a validation error.
  if (!session?.user) unauthorized();
  return session;
}
```

```ts
"use server";
import { z } from "zod";
import { requireUser } from "@/lib/server/requireUser";

const schema = z.object({ name: z.string().min(1) });

export async function createItem(_prevState: unknown, formData: FormData) {
  await requireUser(); // never trust proxy.ts alone
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { success: false as const, errors: parsed.error.flatten() };
  // ... perform action
  return { success: true as const };
}
```

> Never `throw` on validation failure inside a Server Action. A thrown error propagates to the nearest `error.tsx` boundary — a full-page crash screen. Return a structured result object instead so the calling component can display inline field errors.

**Consume results with the React 19 form hooks** — don't hand-roll pending/result state:

```tsx
"use client";
import { useActionState } from "react";
import { Alert, Button } from "antd";
import { createItem } from "@/app/items/actions";

export function CreateItemForm() {
  // useActionState expects the (prevState, formData) signature used above
  const [result, formAction, isPending] = useActionState(createItem, null);
  return (
    <form action={formAction}>
      {/* fields */}
      {result && !result.success && <Alert type="error" message="Please fix the highlighted fields." />}
      <Button type="primary" htmlType="submit" loading={isPending}>Create</Button>
    </form>
  );
}
```

> A form that posts to a Server Action via `action={...}` is a native `<form>` — AntD `Form` drives `onFinish`, which pairs with client-side mutations instead. AntD inputs and buttons still work inside a native form.

- `useFormStatus()` reads the pending state of the nearest parent `<form>` — use it inside shared submit-button components instead of prop-drilling `isPending`.
- `useOptimistic` handles optimistic UI for Server Actions: render the optimistic value immediately; React reverts it automatically if the action fails.
- Run post-response side effects (analytics capture, audit logging) with `after()` from `next/server` — it executes after the response has streamed, so it never delays the user.

**Hardening:**

- Behind a reverse proxy or multi-domain setup, set `serverActions.allowedOrigins` in `next.config.ts` so actions can't be invoked cross-origin.
- Closure variables captured by inline actions are encrypted but still round-trip through the client; bound arguments (`.bind(null, value)`) are serialized to the client **unencrypted**. Never put secrets in either.

### Metadata & SEO

- Export a static `metadata` object from any `layout.tsx` or `page.tsx` for fixed titles and descriptions:

```tsx
// app/blog/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Read our latest posts.",
};
```

- Use `generateMetadata` for pages where metadata depends on data (e.g. dynamic routes). `params` is a Promise in Next.js 16:

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post.title, description: post.description };
}
```

- When the same data is needed in both `generateMetadata` and the page component, wrap the fetch in `React.cache` to avoid a duplicate request:

```ts
// lib/data.ts
import { cache } from "react";
export const getPost = cache(async (slug: string) => db.posts.findBySlug(slug));
```

- Use file-based metadata conventions for static assets — place these files in the `app/` directory:

| File | Purpose |
|---|---|
| `favicon.ico` | Browser tab icon |
| `opengraph-image.jpg` | Default social share image |
| `robots.txt` | Crawler rules |
| `sitemap.xml` | Sitemap for search engines |

- Prefer the dynamic conventions `app/robots.ts` and `app/sitemap.ts` (returning `MetadataRoute.Robots` / `MetadataRoute.Sitemap`) over the static files when routes are data-driven.
- Generate dynamic OG images per route with `opengraph-image.tsx` and `ImageResponse`:

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return new ImageResponse(
    <div style={{ fontSize: 64, background: "white", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {post.title}
    </div>
  );
}
```

> `ImageResponse` supports flexbox and a subset of CSS. `display: grid` and other advanced layouts are not supported.

---

## App Router Special Files

Next.js App Router uses special filenames to define loading, error, and 404 states at every level of the route tree. Every route segment that loads data **must** have a `loading.tsx`. Every segment that can error **must** have an `error.tsx`.

### `loading.tsx` — Suspense fallback

Automatically wraps the segment's `page.tsx` in a `<Suspense>` boundary. Shown while the page's async work completes. Always use skeleton shapes that match the real layout to avoid layout shift.

```tsx
// app/(dashboard)/dashboard/loading.tsx
import { Skeleton } from "antd";

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton.Input active size="large" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton.Node active style={{ width: "100%", height: 128 }} />
        <Skeleton.Node active style={{ width: "100%", height: 128 }} />
        <Skeleton.Node active style={{ width: "100%", height: 128 }} />
      </div>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
```

```tsx
// app/(dashboard)/[resource]/[id]/loading.tsx — detail page skeleton
import { Skeleton } from "antd";

export default function DetailLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton.Input active size="large" />
      <Skeleton active title={false} paragraph={{ rows: 3 }} />
    </div>
  );
}
```

### `error.tsx` — segment error boundary

Must be a `"use client"` component — React error boundaries require client-side rendering. Shown when any error is thrown during rendering or data fetching within that segment. The `reset` function retries the segment without a full page reload.

```tsx
// app/(dashboard)/[resource]/[id]/error.tsx
"use client";

import { useEffect } from "react";
import { Button, Result } from "antd";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SegmentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to your error reporting service (Sentry, etc.)
    console.error(error);
  }, [error]);

  return (
    <Result
      status="500"
      title="Something went wrong"
      subTitle={error.message || "An unexpected error occurred. Please try again."}
      extra={
        <Button type="primary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
```

```tsx
// app/error.tsx — root-level error boundary (fallback for all unhandled route errors)
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Result } from "antd";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Result
        status="500"
        title="Something went wrong"
        subTitle={
          <>
            We encountered an unexpected error. Our team has been notified.
            {error.digest && <div className="mt-2 font-mono text-xs">Error ID: {error.digest}</div>}
          </>
        }
        extra={[
          <Button key="retry" type="primary" onClick={reset}>
            Try again
          </Button>,
          <Button key="home">
            <Link href="/">Go home</Link>
          </Button>,
        ]}
      />
    </div>
  );
}
```

### `not-found.tsx` — 404 page

Rendered when `notFound()` is called anywhere within the segment tree, or when the route does not match any segment. Place one at `app/not-found.tsx` as the global 404 page.

```tsx
// app/not-found.tsx
import Link from "next/link";
import { Button, Result } from "antd";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Result
        status="404"
        title="Page not found"
        subTitle="The page you're looking for doesn't exist or has been moved."
        extra={
          <Button type="primary">
            <Link href="/">Go home</Link>
          </Button>
        }
      />
    </div>
  );
}
```

Call `notFound()` from a page or layout when a resource doesn't exist — don't return a 200 with an empty state:

```tsx
// app/(dashboard)/users/[id]/page.tsx
import { notFound } from "next/navigation";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound(); // renders app/not-found.tsx
  return <UserDetail user={user} />;
}
```

### `global-error.tsx` — last-resort error boundary

Replaces the entire root layout (including `app/layout.tsx`) when it itself throws. Must include `<html>` and `<body>` tags. This is the rarest error state — only triggered if your root providers crash.

```tsx
// app/global-error.tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing else can report this — the root layout (and its providers) crashed.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>Critical error</h1>
          <p style={{ color: "#6b7280", maxWidth: "28rem", margin: 0 }}>
            The application encountered a critical error and could not recover. Please refresh or contact support.
          </p>
          <button
            onClick={reset}
            style={{
              borderRadius: "0.375rem",
              backgroundColor: "#111827",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

> `global-error.tsx` renders without `app/layout.tsx` — your `globals.css`, the AntD registry/`ConfigProvider`, and Tailwind `@theme` tokens are not loaded. Use plain inline styles only — no AntD components or Tailwind classes here.

### Coverage rules

| File | Where to place | When required |
|---|---|---|
| `loading.tsx` | Every segment that fetches data | Always — even if loading is fast |
| `error.tsx` | Every segment that can error | Any segment making API calls or DB queries |
| `not-found.tsx` | `app/` root | Once — covers all `notFound()` calls |
| `global-error.tsx` | `app/` root | Once — last-resort only |

> With `experimental.authInterrupts` enabled in `next.config.ts`, two more special files join this list: `unauthorized.tsx` and `forbidden.tsx` — rendered when server code calls `unauthorized()` / `forbidden()` from `next/navigation` (the 401/403 counterparts of `notFound()`).

---

## Axios Instance

All Client Component data fetching goes through a singleton Axios instance defined in `lib/api/client.ts`. Server Components use `fetch()` directly.

> **`apiClient` and every `lib/api/*` domain function are client-only.** The request interceptor reads the session via `getSession()` from `next-auth/react`, which only runs in the browser — importing a domain function into a Server Component compiles but silently sends an unauthenticated request. In Server Components, call `fetch()` directly and attach the token from `auth()` via a `lib/server/*` module (see [Server Component Data Fetching](#data-fetching)). Keep the two paths separate; don't share the axios layer across the server/client boundary — and enforce it at build time: `lib/api/client.ts` starts with `import "client-only"`, server data modules start with `import "server-only"` (`npm install client-only server-only`), so a wrong-side import fails the build instead of failing silently.

### Setup

```ts
// lib/api/client.ts
import "client-only"; // build error if this module is ever imported server-side
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});
```

### Request interceptor — attach bearer token

The interceptor reads the Auth.js session on every request so the token is always fresh. `getSession()` makes an HTTP call to `/api/auth/session` with no built-in cache, so concurrent requests in the same tick are deduplicated to a single session fetch:

```ts
import { getSession, type Session } from "next-auth/react";

// Deduplicate concurrent session fetches so a page with multiple parallel
// queries only pays for one /api/auth/session round-trip per tick.
let sessionFetch: Promise<Session | null> | null = null;

apiClient.interceptors.request.use(async (config) => {
  if (!sessionFetch) sessionFetch = getSession().finally(() => { sessionFetch = null; });
  const session = await sessionFetch;
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});
```

### Response interceptor — normalize errors

Throw a typed `ApiError` so query hooks have a consistent error shape:

```ts
// types/api.ts
// An Error subclass — NOT a plain object. Rejecting a plain object from the
// interceptor loses the stack trace, breaks `instanceof ApiError` narrowing,
// and ruins Sentry grouping.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Mirrors the backend `Paginated<T>` envelope for list endpoints.
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

```ts
// lib/api/client.ts (continued)
import { ApiError } from "@/types/api";

apiClient.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      new ApiError(
        error.response?.data?.message ?? "An unexpected error occurred",
        error.response?.status ?? 500,
        error.response?.data?.errors,
      ),
    ),
);
```

### Per-domain files

Each domain gets its own file in `lib/api/` that exports plain async functions (no hooks):

```ts
// lib/api/users.ts
import { apiClient } from "./client";
import type { User } from "@/types/user";

export async function fetchUsers(filters: UserFilters): Promise<User[]> {
  const { data } = await apiClient.get("/users", { params: filters });
  return data;
}

export async function fetchUser(id: string): Promise<User> {
  const { data } = await apiClient.get(`/users/${id}`);
  return data;
}

export async function createUser(payload: CreateUserDto): Promise<User> {
  const { data } = await apiClient.post("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserDto): Promise<User> {
  const { data } = await apiClient.patch(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
```

These functions are then called inside React Query hooks in `queries/` — never called directly inside components.

### Rules

- One `apiClient` instance for the entire app — no new `axios.create()` calls elsewhere.
- `lib/api/` functions are pure async functions. No hooks, no React imports.
- Never call `apiClient` directly inside a component or a Server Component — use the domain functions.
- Server Components fetch via `fetch()` with Next.js caching semantics, not Axios.
- Type request/response payloads with the **generated** API types (see [Generated API Types](#generated-api-types)) rather than hand-written interfaces, so they can't drift from the backend.

---

## React Query Guidelines

### Setup

- Never create a `QueryClient` at module scope — during SSR that single instance is shared by every server request, leaking one user's cached data into another's HTML. Use TanStack's Advanced SSR pattern: a new client per server request, a lazy singleton in the browser:

```ts
// lib/queryClient.ts
import { isServer, QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,   // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  // Server: always a fresh client per request — never shared across users.
  if (isServer) return makeQueryClient();
  // Browser: lazy singleton — survives suspends/re-renders without refetch storms.
  return (browserQueryClient ??= makeQueryClient());
}
```

```tsx
// providers/QueryProvider.tsx
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
```

- Server Components that prefetch (see [App Router](#app-router)) call the same `getQueryClient()` before `dehydrate`.
- Register the API error type once, so every hook's `error` is typed without per-call generics:

```ts
// types/react-query.d.ts
import "@tanstack/react-query";
import type { ApiError } from "@/types/api";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}
```

### Query Key Conventions

- Use a factory pattern for all query keys to avoid string typos:

```ts
// queries/users.keys.ts
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  // Widened to accept undefined — useUser may be called before the id exists
  detail: (id: string | undefined) => [...userKeys.all, "detail", id] as const,
};
```

### Query Hooks

- Define each query as a custom hook in `queries/`. Never call `useQuery` inline in components.

```ts
// queries/useUsers.ts
import { useQuery } from "@tanstack/react-query";
import { userKeys } from "./users.keys";
import { fetchUsers } from "@/lib/api/users";

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters), // data inferred as User[]; error is ApiError via Register
  });
}
```

```ts
// queries/useUser.ts
import { skipToken, useQuery } from "@tanstack/react-query";
import { userKeys } from "./users.keys";
import { fetchUser } from "@/lib/api/users";

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id),
    // skipToken disables the query until id exists — the type-safe `enabled: !!id`,
    // with no `fetchUser(id!)` assertion (which our TypeScript rules forbid).
    queryFn: id ? () => fetchUser(id) : skipToken,
  });
}
```

- Don't pass per-call generics to `useQuery` — let `data` infer from `queryFn`, and let the global `Register { defaultError: ApiError }` augmentation (see Setup) type `error` everywhere. No casts, no generics at the call site.

### Mutations

- Use `useMutation` with `onSuccess` cache invalidation. Never refetch manually.

```ts
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

- For optimistic updates, always roll back on `onError`.

### Rules

- Never mix React Query with `useState` for server data.
- Never store React Query results in a global store (Zustand, Context, etc.).
- Always handle `isPending`, `isError`, and `data` states in the consuming component.

---

## Ant Design + Tailwind Guidelines

> Ant Design v6 supports **React 19** (shipped with Next.js 16). Upgrade `@ant-design/icons` to **v6** alongside `antd` — they are versioned together.

### Setup

```bash
npm install antd @ant-design/icons @ant-design/nextjs-registry
```

Wrap the app in `<AntdRegistry>` at the root layout — it extracts AntD's styles during SSR so server-rendered pages don't flash unstyled (still required in v6 / CSS-variables mode). Put `ConfigProvider` + `App` in a `"use client"` providers file: a theme object can only cross the server/client boundary while it holds plain tokens — the moment you add `algorithm: theme.darkAlgorithm` (a function), it must live in a Client Component.

```tsx
// app/layout.tsx — Server Component
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "@/providers/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

```tsx
// providers/Providers.tsx — client boundary for ConfigProvider + App
"use client";
import { App, ConfigProvider } from "antd";
import { theme } from "@/lib/antdTheme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={theme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
```

Define the theme token once:

```ts
// lib/antdTheme.ts
import type { ThemeConfig } from "antd";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
  },
};
```

CSS variables are enabled by default in v6 — do not disable them.

**Tailwind alongside AntD:**

```css
/* app/globals.css */
@import "tailwindcss";

/* Sync Tailwind design tokens with AntD theme */
@theme {
  --color-primary: #1677ff;
  --radius-md: 6px;
}
```

Install the `cn()` utility for conditional class merging:

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### When to Use AntD vs Tailwind

| Use AntD for | Use Tailwind for |
|---|---|
| Forms, Tables, DatePicker, Select, Modal, Drawer | Page layout, spacing, flexbox/grid |
| Notification, Message, Popconfirm | Custom components with no AntD equivalent |
| Design tokens via ConfigProvider | Responsive utilities (`sm:`, `md:`, `lg:`) |

Do not reimplement what AntD already provides well. Do not use AntD layout components (`Row`/`Col`) — use Tailwind flex/grid instead.

### Forms

Use `Form` + `Form.Item` for all forms. Never control form state manually with `useState`:

```tsx
<Form form={form} onFinish={handleSubmit} layout="vertical">
  <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
    <Input />
  </Form.Item>
  <div className="flex justify-end gap-2">
    <Button onClick={() => form.resetFields()}>Cancel</Button>
    <Button type="primary" htmlType="submit">Submit</Button>
  </div>
</Form>
```

Use Tailwind for layout inside forms (`flex`, `gap`, `grid`) — not AntD `Space` or `Row/Col`.

> **Zod is still used at API/trust boundaries** — Server Action input parsing and validating external/API responses (see [TypeScript Standards](#typescript-standards)) — since AntD `rules` only run in the browser and don't validate untrusted server-side input.

> When a form submits through a Server Action, the action must **return** a structured result on validation failure, never `throw` — see [Server Actions](#server-actions).

### Tables

Use `Table` with `columns` typed as `TableColumnsType<T>` — import it from the `antd` root, not the `antd/es/table` deep path. Always define a `rowKey`:

```tsx
import { Table } from "antd";
import type { TableColumnsType } from "antd";

const columns: TableColumnsType<User> = [
  { key: "name", title: "Name", dataIndex: "name" },
  { key: "email", title: "Email", dataIndex: "email" },
];

<Table columns={columns} dataSource={users} rowKey="id" />
```

- Control pager placement with `pagination={{ position: ["bottomRight"] }}` on the `Table` itself.

### Component Structure

Follows the base [Component Standards](#component-standards) (named exports, props typed, under 150 lines) — only the imports differ: pull primitives from `antd`, and use `<Skeleton active />` for loading states.

```tsx
import { Button, Skeleton } from "antd";
// ...
if (isPending) return <Skeleton active />;
```

### Component Usage Rules (v6 API changes)

v6 is fully compatible with v5: the legacy APIs below still work but are **deprecated** (removal planned for v7). Use the replacements in new code.

- Use `Space.Compact` instead of `Button.Group` and `Input.Group` (deprecated in v6).
- Use `FloatButton.BackTop` instead of the `BackTop` component (deprecated in v6).
- In `notification.open()`, use `title` (not `message`) and `actions` (not `btn`) — both renamed in v6.
- `Tag` no longer has a default trailing margin in v6 — add spacing explicitly.
- Use `styles.header` / `styles.body` on Card, Modal, Drawer — `headStyle` / `bodyStyle` are deprecated in v6.
- Use `popupRender` on Select, Cascader, DatePicker — `dropdownRender` is deprecated in v6.
- Use `onOpenChange` on Select, Cascader, AutoComplete, DatePicker — `onDropdownVisibleChange` is deprecated in v6.
- Modal and Drawer mask blur is **opt-in** in v6 (the blur-by-default from early v6 betas was reverted for GPU performance). Enable it explicitly if the design calls for it:

```tsx
<ConfigProvider modal={{ styles: { mask: { backdropFilter: "blur(4px)" } } }}>
```

### Styling Rules

- Use AntD design tokens (`token.colorPrimary`, `token.borderRadius`) inside AntD components via `ConfigProvider`. Do not hardcode values.
- Use Tailwind utilities for layout, spacing, and custom components outside AntD.
- Do not override AntD internal class names (`.ant-btn`, etc.). Use `className` with Tailwind or override tokens via `ConfigProvider`.
- Follow mobile-first responsive design: `sm:`, `md:`, `lg:` breakpoints.
- Do not write custom CSS for anything Tailwind utilities already cover.

### CSS Specificity

AntD v6 uses CSS variables. Tailwind utilities and AntD styles generally do not conflict. If they do:

- Use `ConfigProvider` to override AntD tokens — do not fight specificity with Tailwind's `!important` modifier (`!text-red-500`).
- Wrap AntD-heavy sections in a scoped className and apply token overrides there.

---

## Component Standards

### Naming

| Type | Convention | Example |
|---|---|---|
| Component file | PascalCase | `UserCard.tsx` |
| Hook file | camelCase, `use` prefix | `useUserData.ts` |
| Utility file | camelCase | `formatDate.ts` |
| Constant file | camelCase | `apiRoutes.ts` |

### Component Structure

```tsx
// 1. Imports (external → internal → types)
import { Button, Skeleton } from "antd";
import { useUser } from "@/queries/useUser";
import type { User } from "@/types";

// 2. Types
interface UserCardProps {
  userId: string;
  onSelect: (user: User) => void;
}

// 3. Component
export function UserCard({ userId, onSelect }: UserCardProps) {
  // 4. Hooks
  const { data: user, isPending } = useUser(userId);

  // 5. Derived state
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";

  // 6. Handlers
  const handleClick = () => {
    if (user) onSelect(user);
  };

  // 7. Render
  if (isPending) return <Skeleton.Button active />;

  return (
    <Button onClick={handleClick}>{displayName}</Button>
  );
}
```

- No default exports. Use named exports for all components.
- Props interfaces must be explicitly typed — no `any`.
- Keep components under 150 lines. Extract sub-components or hooks when exceeded.

---

## State Management

- **Server state**: React Query only.
- **URL state**: `useSearchParams` / `useRouter` for filters, pagination, and tabs.
- **Local UI state**: `useState` / `useReducer` scoped to the component.
- **Shared client state**: Zustand for genuinely global UI state (e.g., sidebar collapsed, active theme). Keep stores small and flat.
- Do not put server data into Zustand or Context.

---

## TypeScript Standards

- `strict: true` in `tsconfig.json`. No exceptions.
- No `any`. Use `unknown` and narrow types instead.
- Define API response shapes in `types/api.ts`. Validate at runtime with Zod at API boundaries.
- Use `type` for unions, intersections, and aliases. Use `interface` for object shapes that may be extended.
- Avoid type assertions (`as`) unless narrowing from `unknown` after validation.
- Always type async function return values:

```ts
async function fetchUser(id: string): Promise<User> { ... }
```

---

## Performance

- Use `next/image` for all images. Never `<img>`.
- Use `next/font` for all fonts. Never load fonts via `<link>` in `<head>`.
- Lazy-load heavy Client Components with `next/dynamic`. Note: `dynamic(() => import(...), { ssr: false })` is **only allowed inside a Client Component** — calling it with `ssr: false` from a Server Component throws in the App Router (Next 15+). To defer a client-only chunk from a Server Component, wrap it in a small `"use client"` boundary (or use `React.lazy` + `<Suspense>` there). Server-rendered lazy chunks (`dynamic(() => import(...))` without `ssr: false`) are fine anywhere.
- Memoize expensive computations with `useMemo`. Memoize stable callbacks with `useCallback` only when passed to memoized children.
- Do not over-memoize. Profile before adding `React.memo`.
- Keep bundle size in check — run `next build` and review the output before each release.
- Load third-party scripts with `next/script` and the appropriate `strategy`:

```tsx
import Script from "next/script";

// afterInteractive (default) — loads after hydration. Use for: tag managers, analytics.
<Script src="https://www.googletagmanager.com/gtag/js" strategy="afterInteractive" />

// lazyOnload — loads during browser idle time. Use for: chat widgets, social plugins.
<Script src="https://cdn.example.com/chat.js" strategy="lazyOnload" />

// beforeInteractive — loads before Next.js code, blocks hydration. Use sparingly for: cookie consent, bot detectors.
// Must be placed in the root layout.
<Script src="https://cdn.example.com/consent.js" strategy="beforeInteractive" />
```

> Never use `<script>` tags directly — they bypass Next.js optimisations. The `worker` strategy is experimental and not supported in the App Router.

---

## Error Handling

See [App Router Special Files](#app-router-special-files) for `error.tsx`, `global-error.tsx`, and `not-found.tsx` templates.

**React Query errors:**

- Type via `useQuery<TData, TError>` generic — never cast with `as` at the call site.
- Never swallow errors silently. At minimum, log to console in dev; send to Sentry in production.
- For this stack, surface inline query errors with `<Alert type="error" />` instead of a plain paragraph:

```tsx
// error is typed as ApiError — no cast needed because useUsers is useQuery<User[], ApiError>
const { data, isError, error } = useUsers(filters);

if (isError) {
  return <Alert type="error" message={error.message} />;
}
```

**Mutation errors (React Query):**

Use `notification.error()` (via `App.useApp()`) instead of Sonner for mutations. In AntD v6 the static `notification.error()` / `message.x()` methods do **not** read `ConfigProvider` theme/locale context (and warn in the console). Wrap the tree once in `<App>` and pull context-aware instances from `App.useApp()`:

```tsx
// providers — wrap once, inside ConfigProvider
import { App, ConfigProvider } from "antd";
<ConfigProvider theme={theme}><App>{children}</App></ConfigProvider>

// in a component/hook
const { notification } = App.useApp();
notification.error({ title: "Failed to save" });
```

```ts
const { mutate } = useMutation({
  mutationFn: createUser,
  onError: (error: ApiError) => {
    // Only surface the backend message for client errors (4xx, which are
    // intentional and safe to show). For 5xx, show generic copy — the raw
    // message can leak internal/stack detail.
    const msg = error.statusCode < 500 ? error.message : "Failed to create user. Please try again.";
    notification.error({ title: msg });
  },
});
```

**Server Action errors:**

```ts
// Never throw from a Server Action — return a typed result instead
const result = await createItemAction(formData);
if (!result.success) {
  notification.error({ title: result.error });
  return;
}
```

**Rules:**
- Server Action validation errors → `Form.Item` validation (AntD) or `setError` for programmatic field errors
- Inline query errors → `<Alert type="error" />` in the component's render path
- Mutation network errors → `notification.error()` via `App.useApp()` in `onError`. Only echo the raw `error.message` for 4xx; map 5xx to generic copy so backend internals never reach the user.
- Route segment rendering errors → `error.tsx` boundary
- Missing resources → `notFound()` → `not-found.tsx`

---

## Testing

### Unit Tests

- Unit test pure utility functions with **Vitest**.
- Test custom hooks with `@testing-library/react` + `renderHook`. Wrap in a `QueryClientProvider` with a fresh `QueryClient` per test.

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

it("returns user data", async () => {
  const { result } = renderHook(() => useUser("123"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.email).toBe("test@example.com");
});
```

- Mock API calls with **MSW (Mock Service Worker)** — intercept at the network level, not by mocking modules.

```ts
// tests/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, email: "test@example.com" })
  ),
];

// tests/setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Component / Integration Tests

- Test pages and forms with **React Testing Library**. Query by accessible roles, not by class names or test IDs.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("submits the form and shows success message", async () => {
  render(<CreateUserForm />);
  await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(await screen.findByText(/user created/i)).toBeInTheDocument();
});
```

- Never test component library internals (e.g. dropdown open state). Test what the user sees and can do.

### E2E Tests

- Use **Playwright** for end-to-end tests. Test critical user journeys against the running app.

```ts
// e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("user can log in and see the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
```

- Keep E2E tests focused on happy paths and critical error paths (failed login, 404, form validation).
- Run E2E against a dedicated test environment — never against production.

### Rules

- Do not test implementation details (internal state, private methods). Test behavior.
- Aim for coverage on critical paths (auth flows, form submissions, data tables). Do not chase 100% coverage on UI scaffolding.
- Set `retry: false` on the test `QueryClient` to prevent React Query from masking errors with silent retries.

---

## Authentication — Auth.js v5

Auth.js v5 (NextAuth) manages the session. It calls the NestJS API to authenticate and stores the JWT inside Auth.js's encrypted session.

```bash
npm install next-auth@beta
```

```ts
// auth.ts (project root)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const res = await fetch(`${process.env.API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        if (!res.ok) return null;
        return res.json(); // { accessToken, refreshToken, user }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in — store both tokens from the NestJS response
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.userId = user.user.id;
        token.role = user.user.role;
        token.expiresAt = Date.now() + 14 * 60 * 1000; // match NestJS JWT TTL
        return token;
      }
      // Previous refresh failed — stop retrying, let proxy.ts redirect to login
      if (token.error === "RefreshAccessTokenError") return token;
      // Access token still valid
      if (Date.now() < (token.expiresAt as number)) return token;
      // Access token expired — refresh using the stored refresh token
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.userId as string;
      session.user.role = token.role as string;
      session.error = token.error;
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
});

async function refreshAccessToken(token: JWT) {
  const res = await fetch(`${process.env.API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Send the refresh token in the body — `credentials: "include"` is a
    // browser-only option that has no effect in Node.js server-side fetch.
    body: JSON.stringify({ refreshToken: token.refreshToken }),
  });
  if (!res.ok) return { ...token, error: "RefreshAccessTokenError" as const };
  const data = await res.json();
  return {
    ...token,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? token.refreshToken, // use rotated token if provided
    expiresAt: Date.now() + 14 * 60 * 1000,
    error: undefined,
  };
}
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Route protection via `proxy.ts` (Next.js 16):**

Next.js 16 renamed `middleware.ts` → `proxy.ts` and the export `middleware` → `proxy` (run `npx @next/codemod@canary middleware-to-proxy` to migrate). `proxy.ts` runs on the Node.js runtime. Auth.js v5 supports it directly — wrap `auth` and export it as `proxy`:

```ts
// proxy.ts
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const hasRefreshError = req.auth?.error === "RefreshAccessTokenError";
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");

  // Redirect to login if unauthenticated or if token refresh failed
  if (!isLoggedIn || hasRefreshError) {
    if (isAuthPage) return; // already headed there
    return Response.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isAuthPage) return Response.redirect(new URL("/dashboard", req.url));
});

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
```

> The legacy `middleware.ts` still works in 16 but is deprecated. Keep `proxy.ts` lightweight — routing and auth checks only, no heavy business logic.

**Authenticated API calls:**

Client Components call through the shared `apiClient` defined in the [Axios Instance](#axios-instance) section — its request interceptor already injects the bearer token from the Auth.js session (with concurrent-session deduplication). Do not create a second axios instance here.

```ts
// Server Components — read session directly
import { auth } from "@/auth";

export default async function Page() {
  const session = await auth();
  const res = await fetch(`${process.env.API_URL}/users`, {
    headers: { Authorization: `Bearer ${session?.accessToken}` },
  });
  const users = await res.json();
  return <UserList users={users} />;
}
```

**Type augmentation:**

```ts
// types/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    error?: "RefreshAccessTokenError"; // set when token refresh fails
    user: { id: string; role: string } & DefaultSession["user"];
  }
  // Augment the User returned by authorize() so the jwt callback is type-safe
  interface User {
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
    role?: string;
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}
```

---

## Analytics — PostHog

```bash
npm install posthog-js
```

**`lib/analytics.ts` is the only module that imports the analytics SDK.** It owns init, config, the API host, and every `capture`/`identify` call. The provider, page-view tracker, and identify hook below call *into* this wrapper — they never import `posthog-js` themselves — so swapping analytics tools (or stubbing it in tests) touches only this one file.

```ts
// lib/analytics.ts — the single SDK boundary: init, keys, host, and all calls live here
import posthog from "posthog-js";

export function initAnalytics() {
  // Idempotent: guards React Strict Mode's double-invoke and Fast Refresh re-runs.
  if (typeof window === "undefined" || posthog.__loaded) return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    // Ingestion endpoint — NOT app.posthog.com (that's the dashboard). EU: https://eu.i.posthog.com
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false, // App Router navigation is captured manually (see PostHogPageView)
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function trackPageView() {
  posthog.capture("$pageview");
}

export function identifyUser(id: string, traits?: Record<string, unknown>) {
  posthog.identify(id, traits);
}

export function resetAnalytics() {
  posthog.reset();
}
```

> PostHog also offers `capture_pageview: 'history_change'` to auto-track SPA navigations. We keep `false` + the manual `PostHogPageView` below **on purpose** — it routes every pageview through this wrapper, consistent with [Dependency Isolation](#dependency-isolation).

```tsx
// providers/PostHogProvider.tsx — initializes the wrapper once, client-side
"use client";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);
  return <>{children}</>;
}
```

```tsx
// providers/PostHogPageView.tsx — tracks App Router navigation through the wrapper
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => { trackPageView(); }, [pathname, searchParams]);
  return null;
}
```

```tsx
// app/layout.tsx
import { PostHogProvider } from "@/providers/PostHogProvider";
import { PostHogPageView } from "@/providers/PostHogPageView";

export default function RootLayout({ children }) {
  return (
    <html><body>
      <PostHogProvider>
        <PostHogPageView />
        {children}
      </PostHogProvider>
    </body></html>
  );
}
```

**Identify user after login** — through the wrapper, not the SDK:

```ts
// hooks/useIdentifyUser.ts
"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { identifyUser, resetAnalytics } from "@/lib/analytics";

export function useIdentifyUser() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  useEffect(() => {
    if (session?.user) {
      identifyUser(session.user.id, { email: session.user.email, role: session.user.role });
    } else {
      resetAnalytics();
    }
  }, [userId]); // key on stable identity, not the whole session object
}
```

**Track custom events through the wrapper** — feature code calls `trackEvent`, never `posthog` directly:

```ts
// usage
import { trackEvent } from "@/lib/analytics";

trackEvent("report_exported", { format: "csv", rowCount: 5000 });
```

---

## Bot Protection — Cloudflare Turnstile

Use **invisible** mode — no visible widget, no user friction. Cloudflare verifies the browser fingerprint silently and issues a token within 1–2 seconds of page load.

```bash
npm install @marsidev/react-turnstile
```

```tsx
// components/ui/TurnstileHidden.tsx
"use client";
import { Turnstile } from "@marsidev/react-turnstile";

export function TurnstileHidden({ onSuccess, onError }: { onSuccess: (t: string) => void; onError?: () => void }) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      options={{ appearance: "interaction-only" }}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={() => onError?.()}
    />
  );
}
```

**In a login form — invisible, no UX disruption:**

```tsx
export function LoginForm() {
  const form = useForm<LoginValues>();
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => signIn("credentials", { ...data, turnstileToken }))}>
        <FormField name="email" ... />
        <FormField name="password" ... />
        <TurnstileHidden onSuccess={setTurnstileToken} />
        <Button type="submit" disabled={!turnstileToken}>Log in</Button>
      </form>
    </Form>
  );
}
```

**In a Server Action:**

```ts
"use server";
import { headers } from "next/headers";

export async function registerAction(formData: FormData) {
  const token = formData.get("turnstileToken") as string;
  const ip = (await headers()).get("CF-Connecting-IP") ?? undefined;
  const valid = await verifyTurnstile(token, ip);
  if (!valid) return { success: false as const, error: "Verification failed. Please refresh and try again." };

  // ... perform registration logic ...

  return { success: true as const };
}

async function verifyTurnstile(token: string, ip?: string) {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) }),
    cache: "no-store",
  });
  return (await res.json()).success === true;
}
```

> Test site key (always passes): `1x00000000000000000000AA`. Use it in `.env.local` for local dev and in CI environment variables — never mock the Turnstile widget.

---

## Notifications — SSE

`EventSource` opens a persistent connection to the NestJS SSE endpoint. Because the connection is authenticated with a **single-use** ticket (below), you cannot rely on the browser's native auto-reconnect — it would replay the already-consumed ticket and loop on `401`. Handle `onerror` yourself: close, mint a fresh ticket, and reconnect with backoff (see the hook below).

> **Never put the access token in the URL** (`?token=<jwt>`). `EventSource` can't send an `Authorization` header, but URLs leak into server/proxy access logs, browser history, and `Referer` — a long-lived bearer token there is a real exposure. Instead, exchange it for a **short-lived, single-use SSE ticket**: call an authenticated endpoint through `apiClient` (which sends the bearer header normally), get back a ~30s one-time ticket, and pass *that* in the query string. The backend validates and immediately consumes the ticket. (Alternative: `@microsoft/fetch-event-source`, which is a `fetch`-based SSE client that *does* support headers — use it if you'd rather send the bearer token directly and skip the ticket round-trip.)

```ts
// lib/api/notifications.ts — authenticated ticket request (bearer header via apiClient)
import { apiClient } from "./client";

export async function getSseTicket(): Promise<string> {
  const { data } = await apiClient.post<{ ticket: string }>("/notifications/ticket");
  return data.ticket;
}
```

```ts
// hooks/useNotifications.ts
"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { notify } from "@/lib/notify";
import { getSseTicket } from "@/lib/api/notifications";

export function useNotifications() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const refreshFailed = session?.error === "RefreshAccessTokenError";

  useEffect(() => {
    // Stop if unauthenticated or if token refresh failed (proxy.ts will redirect).
    // Depend on a STABLE identity (userId), not session.accessToken — the access token
    // rotates on every refresh (~14 min), and keying the effect on it would tear down
    // and re-establish the stream on every refresh for no reason.
    if (!userId || refreshFailed) return;

    let es: EventSource | undefined;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;

    // Tickets are SINGLE-USE (the server redeems them with GETDEL). Native EventSource
    // auto-reconnect re-requests the same ?ticket= URL, but that ticket is already
    // consumed — so it would 401 in a loop. We must handle onerror ourselves: tear the
    // connection down, mint a FRESH ticket, and reconnect with exponential backoff.
    const connect = async () => {
      if (cancelled) return;

      let ticket: string;
      try {
        ticket = await getSseTicket();
      } catch {
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
        return;
      }
      if (cancelled) return;

      es = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream?ticket=${ticket}`,
      );
      es.onopen = () => {
        backoff = 1000; // reset backoff once the stream is healthy
      };
      es.onmessage = (event) => {
        const { type, payload } = JSON.parse(event.data);
        handleNotification(type, payload);
      };
      es.onerror = () => {
        // The current ticket is spent — close and reconnect with a new one.
        es?.close();
        if (cancelled) return;
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(retry);
      es?.close(); // cleanup on unmount / sign-out
    };
  }, [userId, refreshFailed]);
}

function handleNotification(type: string, payload: unknown) {
  switch (type) {
    case "report.ready":
      notify.success("Your report is ready", {
        action: { label: "Download", onClick: () => window.open((payload as any).downloadUrl) },
      });
      break;
    case "order.shipped":
      notify.success("Your order has shipped!");
      break;
  }
}
```

Mount once at root layout level:

```tsx
// components/NotificationListener.tsx
"use client";
import { useNotifications } from "@/hooks/useNotifications";
export function NotificationListener() { useNotifications(); return null; }

// app/layout.tsx
<NotificationListener />
```

---

## Generated API Types

The backend serves its OpenAPI spec at `/api/docs-json`. Generate the frontend's request/response types from it instead of hand-writing them — they then track the backend automatically, and a contract change breaks `typecheck` immediately instead of failing silently at runtime.

Use **`openapi-typescript`** (types only — it pairs with the hand-written domain functions in `lib/api/`):

```bash
npm install -D openapi-typescript
```

```json
// package.json
{
  "scripts": {
    "gen:api": "openapi-typescript $NEXT_PUBLIC_API_URL/api/docs-json -o types/api.gen.ts"
  }
}
```

```ts
// lib/api/users.ts — consume generated types
import { apiClient } from "./client";
import type { components } from "@/types/api.gen";
import type { Paginated } from "@/types/api";

type User = components["schemas"]["UserResponseDto"];

export async function fetchUsers(filters: UserFilters): Promise<Paginated<User>> {
  const { data } = await apiClient.get("/users", { params: filters });
  return data;
}
```

**Rules:**
- Commit `types/api.gen.ts` so contract changes show up in the diff for CI and reviewers.
- Regenerate (`npm run gen:api`) whenever the backend API changes; never hand-edit the generated file.
- Hand-write a type only for shapes the backend doesn't expose (third-party APIs, client-only models).
- For a full typed client + generated React Query hooks instead of types-only, `orval` is the heavier alternative — adopt it only if maintaining the `lib/api/` layer by hand becomes a burden.

---

## Accessibility

Accessibility is a requirement, not a finishing touch.

- Enable `eslint-plugin-jsx-a11y` (shipped with the Next.js ESLint config) and treat its findings as errors in CI.
- Use semantic HTML: `<button>` for actions, `<a>`/`<Link>` for navigation, one `<h1>` per page, landmarks (`<nav>`, `<main>`, `<header>`).
- Every form control has a label. shadcn/ui `Form` wires `FormLabel`'s `htmlFor`/`id` automatically — never substitute a placeholder for a label.
- All interactive elements must be keyboard-operable with a visible focus ring. Don't strip `outline` without an equivalent replacement.
- Prefer Radix-based shadcn/ui primitives (Dialog, Dropdown, etc.) — they handle focus trapping and `aria-*` correctly, unlike hand-rolled overlays.
- Give every `next/image` a meaningful `alt`; use `alt=""` only for purely decorative images.
- Never encode meaning in color alone; verify text/background contrast meets WCAG AA against your `@theme` tokens.
- Announce async results to assistive tech: Sonner toasts use polite live regions; for custom status use `aria-live`.

---

## Security Headers

Set security headers in `next.config.ts` via `headers()` — they apply to every route.

```ts
// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      // Turnstile loads its widget script; tighten with a per-request nonce where possible.
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      // Turnstile renders inside an iframe — without frame-src the challenge is blocked.
      "frame-src 'self' https://challenges.cloudflare.com",
      // API + the origins the documented stack actually calls (Turnstile, PostHog ingestion, Sentry).
      `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ""} https://challenges.cloudflare.com https://us.i.posthog.com https://*.ingest.sentry.io`,
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- The directives above already cover the documented stack (Turnstile in `script-src`/`frame-src`/`connect-src`, PostHog + Sentry in `connect-src`). Adjust the PostHog/Sentry hosts to your region/DSN, and add any other origin your app calls — start strict, widen only as needed. (`X-Frame-Options: DENY` is unaffected — it controls who may frame *your* pages, not the iframes you embed, so it does not block Turnstile.)
- `'unsafe-inline'` on `script-src` is a pragmatic default; for a hardened CSP, generate a per-request nonce in `proxy.ts` and drop `'unsafe-inline'`.
- HSTS only takes effect over HTTPS — browsers ignore it on `http://localhost`, so it is safe to leave enabled.

---

## Observability — Error Tracking

Capture client and server errors with full context instead of relying on `console.error`. Use **Sentry**.

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard creates `sentry.*.config.ts` / `instrumentation.ts` and wires source-map upload. Then:

- Report from the App Router error boundaries: replace the placeholder `console.error` in `error.tsx` and `global-error.tsx` with `Sentry.captureException(error)`.
- Use a low `tracesSampleRate` (e.g. `0.1`) in production; sample session replays even lower.
- Scrub PII via `beforeSend` — never send tokens, passwords, or full request bodies.
- `NEXT_PUBLIC_SENTRY_DSN` is a public build-time value (like other `NEXT_PUBLIC_*`); list it in `.env.example` and the CI build args.

```tsx
// app/error.tsx — report to Sentry instead of console
"use client";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  // ... same JSX as the App Router Special Files template
}
```

---

## Dependency Isolation

Wrap every swappable third-party library behind a thin module under `lib/`. Components and hooks import the wrapper — never the package — so replacing the library touches one file.

| Concern | Import this | Never import directly |
|---|---|---|
| HTTP | `lib/api/*` (the axios instance) | `axios` |
| Toasts | `lib/notify.ts` | `sonner` |
| Client analytics | `lib/analytics.ts` | `posthog-js` |
| Data fetching | hooks in `queries/` | `@tanstack/react-query` in components |
| Auth session | `auth.ts` / `useSession` wrapper | `next-auth` internals |

**Rules:**
- A component importing a third-party package directly (other than React/Next primitives and the UI kit) is a smell — route it through a `lib/` wrapper.
- Centralize the package's config/keys inside the wrapper, not at call sites.
- **Do not over-wrap.** This targets libraries with a real chance of replacement (HTTP, toasts, analytics, payments, SMS, date). It does **not** apply to Tailwind utility classes — those are mitigated by `@theme` tokens plus the `components/ui/` → `components/features/` layer — or to React/Next themselves. Abstracting those is premature indirection.
