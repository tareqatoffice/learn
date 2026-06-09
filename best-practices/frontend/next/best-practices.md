# Frontend Best Practices

> Stack: Next.js 16 · React Query · Ant Design

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Next.js Guidelines](#nextjs-guidelines) — App Router · Routing · Data Fetching · Caching & Revalidation · Metadata & SEO · Server Actions
3. [React Query Guidelines](#react-query-guidelines)
4. [Ant Design Guidelines](#ant-design-guidelines)
5. [Component Standards](#component-standards)
6. [State Management](#state-management)
7. [TypeScript Standards](#typescript-standards)
8. [Performance](#performance)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Route groups (no URL segment)
│   ├── (dashboard)/
│   └── layout.tsx
├── components/
│   ├── ui/                     # Generic, reusable primitives
│   └── features/               # Feature-scoped components
├── hooks/                      # Custom React hooks
├── lib/
│   ├── api/                    # Axios/fetch instances, interceptors
│   └── utils/                  # Pure utility functions
├── queries/                    # React Query query/mutation definitions
├── types/                      # Shared TypeScript types and interfaces
└── constants/                  # App-wide constants
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
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { UserTable } from "@/components/features/UserTable";
import { getUsers } from "@/lib/api/users";
import { userKeys } from "@/queries/users.keys";

export default async function UsersPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ queryKey: userKeys.lists(), queryFn: getUsers });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserTable />
    </HydrationBoundary>
  );
}
```

> Do not pass server data as `initialData` to Client Components. React Query v5 treats `initialData` without `initialDataUpdatedAt` as immediately stale, triggering a background refetch on every client mount regardless of `staleTime`. Use `HydrationBoundary` + `dehydrate` so the configured `staleTime` is respected and no double-fetch occurs.

### Routing & Navigation

- Use `<Link>` for all internal navigation. Never `<a>`.
- Use `useRouter().push()` for programmatic navigation inside Client Components only. Import `useRouter` from `next/navigation`, not `next/router` (Pages Router).
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

- `revalidateTag("products")` — stale-while-revalidate (use in Server Actions or Route Handlers).
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

### Server Actions

- Use Server Actions for form submissions and mutations that don't need optimistic UI.
- Validate all input with Zod before any database or API call.

```ts
"use server";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });

export async function createItem(formData: FormData) {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { success: false as const, errors: parsed.error.flatten() };
  // ... perform action
  return { success: true as const };
}
```

> Never `throw` on validation failure inside a Server Action. A thrown error propagates to the nearest `error.tsx` boundary — a full-page crash screen. Return a structured result object instead so the calling component can display inline `Form.Item` errors.

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

- Generate dynamic OG images per route with `opengraph-image.tsx` and `ImageResponse`:

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  return new ImageResponse(
    <div style={{ fontSize: 64, background: "white", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {post.title}
    </div>
  );
}
```

> `ImageResponse` supports flexbox and a subset of CSS. `display: grid` and other advanced layouts are not supported.

---

## React Query Guidelines

### Setup

- Create a single `QueryClient` instance with sensible defaults:

```ts
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query Key Conventions

- Use a factory pattern for all query keys to avoid string typos:

```ts
// queries/users.keys.ts
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};
```

### Query Hooks

- Define each query as a custom hook in `queries/`. Never call `useQuery` inline in components.

```ts
// queries/useUsers.ts
import { useQuery } from "@tanstack/react-query";
import { userKeys } from "./users.keys";
import { fetchUsers } from "@/lib/api/users";
import type { ApiError } from "@/types/api";

export function useUsers(filters: UserFilters) {
  return useQuery<User[], ApiError>({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters),
  });
}
```

```ts
// queries/useUser.ts
import { useQuery } from "@tanstack/react-query";
import { userKeys } from "./users.keys";
import { fetchUser } from "@/lib/api/users";
import type { ApiError } from "@/types/api";

export function useUser(id: string) {
  return useQuery<User, ApiError>({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
  });
}
```

- Always type both data and error generics on `useQuery<TData, TError>`. This makes `error` typed without any cast at the call site.

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

## Ant Design Guidelines

### Setup

- Wrap the app in `<ConfigProvider>` at the root layout. Define the theme token once.

```tsx
// app/layout.tsx
import { ConfigProvider } from "antd";
import { theme } from "@/lib/antdTheme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ConfigProvider theme={theme}>{children}</ConfigProvider>
      </body>
    </html>
  );
}
```

- Define the theme in a single file (`lib/antdTheme.ts`). Do not spread token overrides across components.

### Component Usage

- Use Ant Design components for all form controls, tables, modals, and feedback elements. Do not reimplement what AntD already provides.
- Use `Form` + `Form.Item` for all forms. Never control form state manually with `useState`.

```tsx
<Form form={form} onFinish={handleSubmit} layout="vertical">
  <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
    <Input />
  </Form.Item>
</Form>
```

- Use `Table` with `columns` typed as `ColumnsType<T>`. Always define a `rowKey`.
- Use `notification` or `message` for user feedback. Never `alert()`.

### Styling

- Prefer AntD design tokens (`token.colorPrimary`, `token.borderRadius`) over hardcoded values.
- Use CSS Modules for component-specific styles. Never use inline `style` props except for dynamic values.
- Do not override AntD internal class names (e.g., `.ant-btn`). Use `className` with CSS Modules or token overrides via `ConfigProvider`.

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
  if (isPending) return <Skeleton />;

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
- Lazy-load heavy Client Components with `dynamic(() => import(...), { ssr: false })`.
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

- Wrap route segments with `error.tsx` to catch rendering errors.
- API errors from React Query must be typed via the `useQuery<TData, TError>` generic — never with a type assertion at the call site.
- Show user-facing errors via `notification.error()` or inline `Form.Item` validation messages.
- Never swallow errors silently. At minimum, log them.

```tsx
// error is typed as ApiError — no cast needed because useUsers is useQuery<User[], ApiError>
const { data, isError, error } = useUsers(filters);

if (isError) {
  return <Alert type="error" message={error.message} />;
}
```

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

- Never test AntD internals (e.g. dropdown open state). Test what the user sees and can do.

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
