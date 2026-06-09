# Claude Instructions — Next.js Frontend Project

This project follows strict frontend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Frontend Best Practices](./best-practices.md)**

## Quick Reference

| Topic | Rule |
|---|---|
| Routing | App Router only. No Pages Router. |
| Data fetching | Server Components fetch by default. Client Components use React Query. Never `useEffect` + `fetch`. |
| React Query | All queries/mutations defined as custom hooks in `queries/`. Use key factories. |
| Components | Named exports only. One component per file. No `any`. Under 150 lines. |
| Forms | AntD `Form` + `Form.Item` only. No manual `useState` form state. |
| Styling | CSS Modules + AntD tokens. No inline `style` except dynamic values. No `.ant-*` overrides. |
| State | Server state → React Query. URL state → `useSearchParams`. Global UI state → Zustand. |
| TypeScript | `strict: true`. No `any`. Validate external data with Zod at API boundaries. |
| Images/Fonts | `next/image` and `next/font` only. |
| Environment | `NEXT_PUBLIC_` prefix for client vars. Secrets in Server Components only. |

## Stack Versions

- Next.js 16 (App Router)
- React Query (`@tanstack/react-query` v5)
- Ant Design v5
