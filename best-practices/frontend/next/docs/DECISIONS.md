# Architecture Decision Records — Frontend (Next.js)

Key technology and pattern choices with the reasoning behind each. Understanding the **why** helps the team make consistent decisions in cases not explicitly covered by `best-practices.md`.

---

## ADR-001 — Next.js App Router exclusively

**Decision**: Use the App Router only. No Pages Router.

**Why**: App Router is the default from Next.js 13+ and Pages Router is in maintenance mode. Server Components eliminate client-side data-fetching logic, reducing JS payload. Layouts, loading states, and error boundaries are composable per-route segment. Partial Prerendering (PPR) — available in Next.js 16 — is App Router only.

**Trade-off**: Higher learning curve (Server vs Client Components, `use cache`, `<Suspense>`). Some third-party libraries still have limited Server Component support — use `"use client"` wrappers as needed.

---

## ADR-002 — React Query for all client-side server state

**Decision**: `@tanstack/react-query` v5 for all server state in Client Components.

**Why**: Provides caching, background refetching, deduplication, pagination, optimistic updates, and typed error handling in one package. `HydrationBoundary` + `dehydrate` integrates seamlessly with App Router server-prefetch — data fetched on the server reaches the client without a second network request. Strongly typed via `useQuery<TData, TError>` generics.

**Alternatives rejected**:
- **SWR**: Simpler but no mutation utilities, no optimistic rollback, no `HydrationBoundary` pattern.
- **Zustand for server data**: No cache invalidation, deduplication, or background refetch. Using it for server data creates a second source of truth that drifts.
- **`useEffect` + `fetch`**: No caching, no deduplication, banned.

---

## ADR-003 — Tailwind CSS as default styling

**Decision**: Tailwind CSS v4 + shadcn/ui as the default design stack. Ant Design v6 is an opt-in alternative for data-heavy admin/internal tools.

**Why (Tailwind default)**: Tailwind v4 is CSS-first (no config file), tree-shaken by default, and generates minimal CSS. shadcn/ui gives accessible, unstyled-by-default components that live in your codebase — no version lock. React Hook Form is lighter and more flexible than AntD Form for complex validation flows. The combination produces smaller bundles and fewer layout constraints than AntD.

**Why (AntD alternative)**: Ant Design v6 covers complex components (DatePicker, Table with virtual scroll, Cascader) that take significant effort to replicate with primitives. For internal dashboards where bundle size is not critical and time-to-feature matters, AntD + Tailwind (for layout) is the pragmatic choice.

**Trade-off (Tailwind)**: shadcn/ui components must be built and maintained by the team. No built-in DatePicker or complex Table — reach for `@tanstack/react-table` and a headless date library.

**Trade-off (AntD)**: Larger bundle. Opinionated design system — requires `lib/antdTheme.ts` as the single source of truth to prevent token drift. See `BEST-PRACTICES-ANTD.md` for full setup.

**v5 → v6 key breaking changes (if migrating)**: `@ant-design/icons` must also be v6; `Button.Group` / `Input.Group` → `Space.Compact`; `BackTop` → `FloatButton.BackTop`; `headStyle`/`bodyStyle` → `styles.header`/`styles.body`; `dropdownRender` → `popupRender`; `onDropdownVisibleChange` → `onOpenChange`; notification `message` → `title`, `btn` → `actions`; Modal/Drawer mask blur on by default.

---

## ADR-004 — Named exports only for components

**Decision**: All components use named exports. No default exports.

**Why**: Default exports allow import aliasing (`import Whatever from './Button'`), which breaks searchability and `grep`. Named exports force the import name to match the export name. Rename-symbol refactoring tools work reliably.

---

## ADR-005 — MSW for API mocking in tests

**Decision**: Mock Service Worker (MSW) for intercepting API calls in tests.

**Why**: Intercepts at the network level, not the module level. Tests exercise the same `fetch` path as production — no mocking of internal implementation details. A single handler file serves both Node (Vitest) and browser tests. Handler reset between tests prevents state leakage.

**Alternatives rejected**:
- **`vi.mock` on fetch**: Mocks the module, not the network. Tests pass even if the URL or method changes.
- **Recorded fixtures**: Brittle — server responses change and fixtures become stale silently.

---

## ADR-006 — Playwright for E2E tests

**Decision**: Playwright for end-to-end tests.

**Why**: Cross-browser support (Chromium, Firefox, WebKit). Built-in accessible locators (`getByRole`, `getByLabel`) are consistent with React Testing Library. Reliable auto-waiting reduces flakiness. Official Next.js docs use Playwright as the primary E2E example.

---

## ADR-007 — Zustand for global client UI state only

**Decision**: Zustand for shared client-side UI state (sidebar, theme, modals). Never for server data.

**Why**: Lightweight, no boilerplate, no Provider required. Server data belongs in React Query — it has cache invalidation, background sync, and hydration. Duplicating it in Zustand creates two sources of truth that diverge.
