# Frontend Best Practices — Ant Design v6 + Tailwind

> Stack: Next.js 16 · React Query · Ant Design v6 · Tailwind CSS

All rules from [`BEST-PRACTICES.md`](./BEST-PRACTICES.md) apply. This file adds and overrides sections specific to using Ant Design v6 alongside Tailwind CSS.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Next.js Guidelines](#nextjs-guidelines) — App Router · Routing · Data Fetching · Caching & Revalidation · Metadata & SEO · Server Actions
3. [React Query Guidelines](#react-query-guidelines)
4. [Ant Design + Tailwind Guidelines](#ant-design--tailwind-guidelines)
5. [Component Standards](#component-standards)
6. [State Management](#state-management)
7. [TypeScript Standards](#typescript-standards)
8. [Performance](#performance)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

---

## Project Structure

```
project-root/
├── CLAUDE.md                   # Claude Code instructions (auto-loaded)
├── docs/
│   ├── BEST-PRACTICES-ANTD.md  # This file
│   ├── DECISIONS.md            # Architecture decision records
│   ├── FAQ.md                  # Common questions
│   └── CONTRIBUTING.md        # How to propose changes
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
│   ├── antdTheme.ts            # AntD theme tokens (single source of truth)
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

> Do not pass server data as `initialData` to Client Components. Use `HydrationBoundary` + `dehydrate` so the configured `staleTime` is respected and no double-fetch occurs.

### Routing & Navigation

- Use `<Link>` for all internal navigation. Never `<a>`.
- Use `useRouter().push()` for programmatic navigation inside Client Components only. Import `useRouter` from `next/navigation`, not `next/router`.
- In Next.js 15+, `params` and `searchParams` are Promises. Always type and await them:

```tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
}
```

### Data Fetching

- Server Components: fetch directly via `async/await`.
- Client Components: use React Query. Never `useEffect` + `fetch`.
- Use `loading.tsx` for route-level loading UI and `error.tsx` for error boundaries.
- Initiate independent fetches in parallel with `Promise.all`:

```tsx
const [artist, albums] = await Promise.all([getArtist(username), getAlbums(username)]);
```

- Wrap slow Server Components in `<Suspense>` for component-level streaming.
- Wrap components that use runtime APIs (`cookies()`, `headers()`) in `<Suspense>`.

### Caching & Revalidation

Next.js 16 has two caching models. Use the new model for new projects.

**New model — `use cache` directive** (opt-in: `cacheComponents: true` in `next.config.ts`):

```ts
import { cacheLife, cacheTag } from "next/cache";

export async function getProducts() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.query("SELECT * FROM products");
}
```

- `revalidateTag("products")` — stale-while-revalidate (Server Actions or Route Handlers).
- `updateTag("products")` — immediately expires the cache (Server Actions only).

**Previous model** (default):

```ts
import { unstable_cache } from "next/cache";

export const getCachedUser = unstable_cache(
  async (id: string) => db.users.findById(id),
  ["user"],
  { tags: ["user"], revalidate: 3600 }
);
```

**Deduplication** — wrap shared fetches in `React.cache`:

```ts
import { cache } from "react";
export const getUser = cache(async (id: string) => db.users.findById(id));
```

### Environment Variables

- Prefix client-exposed variables with `NEXT_PUBLIC_`.
- Access server-only secrets exclusively in Server Components, API routes, or Server Actions.
- Never log or expose env vars in client bundles.

### Server Actions

```ts
"use server";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });

export async function createItem(formData: FormData) {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { success: false as const, errors: parsed.error.flatten() };
  return { success: true as const };
}
```

> Never `throw` on validation failure inside a Server Action. Return a structured result object so the calling component can display inline `Form.Item` errors.

### Metadata & SEO

```tsx
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

- Wrap shared data fetches in `React.cache` to avoid duplicate requests between `generateMetadata` and the page.
- File-based metadata: `favicon.ico`, `opengraph-image.jpg`, `robots.txt`, `sitemap.xml` in `app/`.

---

## React Query Guidelines

### Setup

```ts
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query Key Conventions

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

```ts
export function useUsers(filters: UserFilters) {
  return useQuery<User[], ApiError>({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters),
  });
}
```

### Mutations

```ts
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.lists() }),
  });
}
```

### Rules

- Never mix React Query with `useState` for server data.
- Never store React Query results in a global store.
- Always handle `isPending`, `isError`, and `data` states in the consuming component.

---

## Ant Design + Tailwind Guidelines

> Ant Design v6 requires **React 18+** and **`@ant-design/icons` v6**. Upgrade both together.

### Setup

Wrap the app in `<ConfigProvider>` at the root layout. Define the theme token once:

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

### Tables

Use `Table` with `columns` typed as `ColumnsType<T>`. Always define a `rowKey`:

```tsx
import type { ColumnsType } from "antd/es/table";

const columns: ColumnsType<User> = [
  { key: "name", title: "Name", dataIndex: "name" },
  { key: "email", title: "Email", dataIndex: "email" },
];

<Table columns={columns} dataSource={users} rowKey="id" />
```

- Use `placement` prop on columns (not `position` — renamed in v6).

### Component Usage Rules

- Use `Space.Compact` instead of the removed `Button.Group` and `Input.Group`.
- Use `FloatButton.BackTop` instead of the removed `BackTop` component.
- In `notification.open()`, use `title` (not `message`) and `actions` (not `btn`) — both renamed in v6.
- `Tag` no longer has a default trailing margin in v6 — add spacing explicitly.
- Modal and Drawer show a mask blur by default. Disable via `ConfigProvider` if needed:

```tsx
<ConfigProvider modal={{ styles: { mask: { backdropFilter: "none" } } }}>
```

### Styling Rules

- Use AntD design tokens (`token.colorPrimary`, `token.borderRadius`) inside AntD components via `ConfigProvider`. Do not hardcode values.
- Use Tailwind utilities for layout, spacing, and custom components outside AntD.
- Do not override AntD internal class names (`.ant-btn`, etc.). Use `className` with Tailwind or override tokens via `ConfigProvider`.
- Use `styles.header` / `styles.body` on Card, Modal, Drawer — `headStyle` / `bodyStyle` were removed in v6.
- Use `popupRender` on Select, Cascader, DatePicker — `dropdownRender` was removed in v6.
- Use `onOpenChange` on Select, Cascader, AutoComplete, DatePicker — `onDropdownVisibleChange` was removed in v6.

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
  const { data: user, isPending } = useUser(userId);
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";

  if (isPending) return <Skeleton active />;

  return (
    <Button onClick={() => user && onSelect(user)}>{displayName}</Button>
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
- **Shared client state**: Zustand for genuinely global UI state (sidebar collapsed, active theme).
- Do not put server data into Zustand or Context.

---

## TypeScript Standards

- `strict: true` in `tsconfig.json`. No exceptions.
- No `any`. Use `unknown` and narrow types instead.
- Define API response shapes in `types/api.ts`. Validate at runtime with Zod at API boundaries.
- Use `type` for unions, intersections, and aliases. Use `interface` for object shapes that may be extended.
- Avoid type assertions (`as`) unless narrowing from `unknown` after validation.

---

## Performance

- Use `next/image` for all images. Never `<img>`.
- Use `next/font` for all fonts. Never load fonts via `<link>`.
- Lazy-load heavy Client Components with `dynamic(() => import(...), { ssr: false })`.
- Memoize expensive computations with `useMemo`. Use `useCallback` only when passing stable callbacks to memoized children.
- Load third-party scripts with `next/script` (`afterInteractive`, `lazyOnload`, `beforeInteractive`).

---

## Error Handling

- Wrap route segments with `error.tsx` to catch rendering errors.
- API errors from React Query must be typed via `useQuery<TData, TError>` generic.
- Show user-facing errors via `notification.error()` or inline `Form.Item` validation messages.
- Never swallow errors silently.

```tsx
const { data, isError, error } = useUsers(filters);

if (isError) {
  return <Alert type="error" message={error.message} />;
}
```

---

## Testing

### Unit Tests

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
});
```

Mock API calls with **MSW**:

```ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, email: "test@example.com" })
  ),
];
```

### Component / Integration Tests

```tsx
it("submits the form and shows success message", async () => {
  render(<CreateUserForm />);
  await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(await screen.findByText(/user created/i)).toBeInTheDocument();
});
```

- Never test AntD internals (e.g. dropdown open state). Test what the user sees and can do.

### E2E Tests

```ts
test("user can log in and see the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
});
```

### Rules

- Do not test implementation details. Test behavior.
- Set `retry: false` on the test `QueryClient`.
- Run E2E against a dedicated test environment — never against production.
