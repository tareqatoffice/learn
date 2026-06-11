# FAQ — Frontend (Next.js)

Answers to questions that come up repeatedly during code review or onboarding.

---

## Next.js

**Q: When should a component be a Server Component vs a Client Component?**

Default to Server Components. Add `"use client"` only when the component needs browser APIs (`window`, `localStorage`), React hooks (`useState`, `useEffect`), event handlers, or a third-party library that is not Server Component compatible. If a component only renders UI from props or fetches data, it is a Server Component.

---

**Q: When should I use Server Actions vs React Query mutations?**

| Use Server Actions when… | Use React Query mutations when… |
|---|---|
| Submitting a form with no optimistic UI | You need optimistic updates or rollback on error |
| The result drives a full navigation (`redirect()`) | The result updates cached client-side data |
| Logic fits naturally in a form `action` | You need granular `isPending` / `isError` states |

---

**Q: Can I use `initialData` to pass server-fetched data to a Client Component?**

Prefer not to. `initialData` is seeded untimed — its `staleTime` counts from client mount rather than the real server fetch (so under the default `staleTime: 0` it refetches immediately), and it has to be threaded through props. Use `HydrationBoundary` + `dehydrate` + `prefetchQuery` in the Server Component instead: it transfers each query's real fetch timestamp and the whole dehydrated cache, so `staleTime` is honored and there's no double-fetch.

---

**Q: Should I fetch data in `layout.tsx` or `page.tsx`?**

Prefer `page.tsx`. Layouts are shared across routes — fetching in a layout couples the data to the layout's lifetime and can cause unexpected caching behaviour. Fetch in the component that needs the data.

---

**Q: When do I use `revalidateTag` vs `updateTag`?**

- **`revalidateTag`**: stale-while-revalidate — the current user sees stale content immediately while fresh data loads in the background. Good for blog posts, product catalogs. Can be called from Server Actions or Route Handlers.
- **`updateTag`**: immediately expires the cache — the next render fetches fresh data. Use when the user must see their own change right away (e.g. after publishing a post). Server Actions only.

---

**Q: What is the `use cache` directive and when do I use it?**

`"use cache"` is Next.js 16's opt-in caching primitive (requires `cacheComponents: true` in `next.config.ts`). Add it to any async function or Server Component to cache its return value across requests.

Use it for data that does not depend on per-request runtime values (`cookies`, `headers`, `searchParams`) and where serving slightly stale data is acceptable. For per-request dynamic data, wrap the component in `<Suspense>` instead.

---

**Q: Can the frontend send email?**

No. Email is sent only from the backend (NestJS) — the provider API key must never be in a client bundle, even behind `NEXT_PUBLIC_`. The frontend triggers a backend endpoint (e.g. a form posting to `POST /auth/forgot-password`); the backend enqueues and sends. The same rule applies to any third-party secret (payment keys, SMS, etc.): keep it server-side.

---

## React Query

**Q: My query returns `undefined` even though the request succeeds. Why?**

Common causes:
1. The query key in `prefetchQuery` (Server Component) does not match `useQuery` (Client Component). Use the same key factory in both.
2. `staleTime` is `0` — the client immediately considers hydrated data stale and refetches. Set `staleTime` to match your cache strategy.
3. You are using `initialData` instead of `HydrationBoundary`.

---

**Q: Should every API call have a custom hook?**

Yes. Define every `useQuery` and `useMutation` as a custom hook in `queries/`. Never call `useQuery` inline in a component. Reasons: reusable across components, single place to update when the API changes, easier to test with `renderHook`.

---

**Q: When should I use `invalidateQueries` vs `setQueryData`?**

- **`invalidateQueries`**: marks data stale and triggers a background refetch. Use when the server is the source of truth and a refetch is cheap. Safest default.
- **`setQueryData`**: writes to the cache without a network request. Use for optimistic updates — always pair with `onError` rollback.

---

## Testing

**Q: Should I test loading and error states?**

Yes for loading on critical components (tables, profile pages). For errors, test explicitly handled paths (e.g. "shows error message when API returns 4xx"). Do not test every possible HTTP status code — that is the API layer's concern.

---

**Q: Why `retry: false` on the test `QueryClient`?**

React Query retries failed requests 3 times with exponential backoff by default. In tests, a request expected to fail should fail immediately and show `isError`. Without `retry: false`, tests wait for all retries, making them slow and flaky.

---

**Q: Should I mock `next/navigation` in component tests?**

Yes, when the component calls `useRouter`, `useSearchParams`, or `usePathname`. These throw in a test environment without a Next.js context. Add to your test setup:

```ts
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
}));
```
