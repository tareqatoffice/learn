# Claude Instructions — Next.js Frontend Project

This project follows strict frontend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Frontend Best Practices](./docs/BEST-PRACTICES.md)** · **[CI/CD](./docs/CICD.md)**

## Quick Reference

| Topic | Rule |
|---|---|
| Routing | App Router only. No Pages Router. |
| Special files | Every data-fetching segment needs `loading.tsx`. Every error-prone segment needs `error.tsx`. Root has `not-found.tsx` + `global-error.tsx`. |
| Data fetching | Server Components fetch by default. Client Components use React Query. Never `useEffect` + `fetch`. |
| React Query | All queries/mutations defined as custom hooks in `queries/`. Use key factories. |
| Components | Named exports only. One component per file. No `any`. Under 150 lines. |
| Forms | React Hook Form + Zod. shadcn/ui `Form` components. No manual `useState` form state. |
| Styling | Tailwind CSS v4. `cn()` for conditional classes. No arbitrary values unless from design spec. |
| State | Server state → React Query. URL state → `useSearchParams`. Global UI state → Zustand. |
| TypeScript | `strict: true`. No `any`. Validate external data with Zod at API boundaries. |
| Images/Fonts | `next/image` and `next/font` only. |
| Environment | `NEXT_PUBLIC_` prefix for client vars. Secrets in Server Components only. |
| Auth | Auth.js v5 (NextAuth). Credentials → NestJS. JWT in encrypted session. Middleware protects routes. |
| Bot protection | Invisible Turnstile (`appearance: "interaction-only"`). Disable submit until token ready. |
| Analytics | PostHog JS. `PostHogProvider` at root. `PostHogPageView` for App Router. `useIdentifyUser` hook. |
| Notifications | `EventSource` with `?token=` query param. `useNotifications` hook. Mount at root layout. |
| CI/CD | Conventional Commits · GitHub Actions · Docker standalone → GHCR → SSH deploy. |

## Stack Versions

- Next.js 16 (App Router)
- React Query (`@tanstack/react-query` v5)
- Tailwind CSS v4
- shadcn/ui · Radix UI
- React Hook Form · `@hookform/resolvers` · Zod
- Sonner (toasts) · TanStack Table v8
- Auth.js v5 (`next-auth`)
- PostHog JS (`posthog-js`)
- Cloudflare Turnstile (`@marsidev/react-turnstile`, invisible mode)

> For Ant Design v6 projects, use `docs/BEST-PRACTICES-ANTD.md` instead.
