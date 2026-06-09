# Frontend Best Practices

> Stack: Next.js 16 · React Query · Ant Design

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Next.js Guidelines](#nextjs-guidelines)
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
// Good — Server Component fetches, Client Component renders
// app/users/page.tsx
import { UserTable } from "@/components/features/UserTable";
import { getUsers } from "@/lib/api/users";

export default async function UsersPage() {
  const users = await getUsers();
  return <UserTable initialData={users} />;
}
```

### Routing & Navigation

- Use `<Link>` for all internal navigation. Never `<a>`.
- Use `useRouter().push()` for programmatic navigation inside Client Components only.
- Define route params with typed `params` props:

```tsx
interface PageProps {
  params: { id: string };
}
```

### Data Fetching

- Server Components: fetch directly via `async/await` with `fetch()` or a server-side service layer.
- Client Components: use React Query (see below). Never `useEffect` + `fetch`.
- Use `loading.tsx` and `error.tsx` for route-level Suspense and error boundaries.

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
  if (!parsed.success) throw new Error("Invalid input");
  // ...
}
```

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

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => fetchUsers(filters),
  });
}
```

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
import { useState } from "react";
import { Button } from "antd";
import { useUsers } from "@/queries/useUsers";
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

---

## Error Handling

- Wrap route segments with `error.tsx` to catch rendering errors.
- API errors from React Query must be typed. Inspect `error` as `AxiosError` or a typed API error shape.
- Show user-facing errors via `notification.error()` or inline `Form.Item` validation messages.
- Never swallow errors silently. At minimum, log them.

```tsx
const { data, isError, error } = useUsers(filters);

if (isError) {
  return <Alert type="error" message={(error as ApiError).message} />;
}
```

---

## Testing

- Unit test pure utilities with Vitest.
- Test hooks with `@testing-library/react` + `renderHook`.
- Integration-test pages and forms with React Testing Library. Mock React Query with `QueryClientProvider` wrapping a fresh `QueryClient` per test.
- Do not test implementation details (internal state, private methods). Test behavior.
- Aim for coverage on critical paths (auth flows, form submissions, data tables). Do not chase 100% coverage on UI scaffolding.
