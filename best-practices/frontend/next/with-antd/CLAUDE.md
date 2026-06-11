# Claude Instructions — Next.js Frontend Project

This project follows strict frontend coding standards. Before writing or reviewing any code, read and apply all guidelines in:

**[Frontend Best Practices](./docs/BEST-PRACTICES.md)** · **[CI/CD](./docs/CICD.md)**

## Working Agreement

- **Definition of done**: before declaring a task complete, run `npm run typecheck`, `npm run lint`, and the relevant tests — all must pass. Report failures honestly; do not claim success on red.
- **Tests are part of the change**: add or update tests for new hooks, components, and flows. Critical paths (auth, forms, data tables) must stay covered.
- **Never commit or push without explicit approval.** Show the diff and wait. If on `main`, create a branch first.
- **Ask before destructive or outward-facing actions** (deleting files you didn't create, calling external services, force-pushing).
- **Stay in scope**: change what the task needs. Match the surrounding style; don't reformat unrelated code.
- **Secrets never leave config**: only `NEXT_PUBLIC_*` reaches the client; no server secrets in client components or examples; no `.env` committed.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (sets up Husky hooks via `prepare`) |
| `npm run dev` | Run the dev server |
| `npm run build` | Production build (`next build`) · `npm start` serves it |
| `npm run typecheck` | `tsc --noEmit` — type-check without emitting |
| `npm run lint` | ESLint (`eslint .`) |
| `npm run format` | Prettier write · `npm run format:check` to verify only |
| `npm test` | Unit/component tests (Vitest) · add `-- --coverage` to enforce thresholds |
| `npm test -- UserCard` | Run a single test file / pattern |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run gen:api` | Regenerate API types from the backend OpenAPI spec |

> Exact script names live in `docs/CICD.md`. If a command is missing from `package.json`, add it there rather than inventing an ad-hoc invocation.

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
| API types | Generate from the backend OpenAPI spec (`openapi-typescript`) into `types/api.gen.ts`. Don't hand-write request/response types. |
| Accessibility | Semantic HTML, label every input, keyboard-operable. `eslint-plugin-jsx-a11y` enforced. |
| Security headers | CSP + security headers via `headers()` in `next.config.ts`. |
| Environment | `NEXT_PUBLIC_` prefix for client vars. Secrets in Server Components only. |
| Auth | Auth.js v5 (NextAuth). Credentials → NestJS. JWT in encrypted session. `proxy.ts` (renamed from `middleware.ts` in Next 16) protects routes. |
| Bot protection | Invisible Turnstile (`appearance: "interaction-only"`). Disable submit until token ready. |
| Analytics | PostHog JS. `PostHogProvider` at root. `PostHogPageView` for App Router. `useIdentifyUser` hook. |
| Notifications | `EventSource` authed with a short-lived single-use ticket (never the token in `?token=`). `useNotifications` hook. Mount at root layout. |
| CI/CD | Conventional Commits · GitHub Actions · Docker standalone → GHCR → SSH deploy. |
| Dependency isolation | Swappable libs behind a `lib/` wrapper (`lib/api` axios, `lib/notify` Sonner, `lib/analytics` PostHog). Import the wrapper, never the package. Excludes Tailwind/framework. |
| Dev tooling | Prettier (+ `prettier-plugin-tailwindcss`) + ESLint (`eslint-config-prettier`). Husky: `lint-staged` pre-commit, commitlint commit-msg, typecheck + test + build pre-push. |

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
- Sentry (optional observability for production)
