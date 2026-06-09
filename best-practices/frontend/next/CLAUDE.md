# Claude Instructions — Next.js Frontend Project

This project follows strict frontend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Frontend Best Practices](./docs/BEST-PRACTICES.md)**

## Quick Reference

| Topic | Rule |
|---|---|
| Routing | App Router only. No Pages Router. |
| Data fetching | Server Components fetch by default. Client Components use React Query. Never `useEffect` + `fetch`. |
| React Query | All queries/mutations defined as custom hooks in `queries/`. Use key factories. |
| Components | Named exports only. One component per file. No `any`. Under 150 lines. |
| Forms | React Hook Form + Zod. shadcn/ui `Form` components. No manual `useState` form state. |
| Styling | Tailwind CSS v4. `cn()` for conditional classes. No arbitrary values unless from design spec. |
| State | Server state → React Query. URL state → `useSearchParams`. Global UI state → Zustand. |
| TypeScript | `strict: true`. No `any`. Validate external data with Zod at API boundaries. |
| Images/Fonts | `next/image` and `next/font` only. |
| Environment | `NEXT_PUBLIC_` prefix for client vars. Secrets in Server Components only. |

## Stack Versions

- Next.js 16 (App Router)
- React Query (`@tanstack/react-query` v5)
- Tailwind CSS v4
- shadcn/ui · Radix UI
- React Hook Form · `@hookform/resolvers` · Zod
- Sonner (toasts) · TanStack Table v8

> For Ant Design v6 projects, use `docs/BEST-PRACTICES-ANTD.md` instead.
