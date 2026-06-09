# Changelog — Frontend Best Practices (Next.js)

All notable changes to `best-practices.md` are recorded here.
Format: `[YYYY-MM-DD] Type — Description`.

---

## [2026-06-09] feat — Add Caching, Streaming, Metadata/SEO, next/script

Verified against Next.js 16.2.7 official documentation.

**Added**
- **Data Fetching**: `Promise.all` parallel fetching pattern; component-level `<Suspense>` streaming; note to wrap runtime API components (`cookies`, `headers`) in `<Suspense>`
- **Caching & Revalidation** (new section):
  - New model (`cacheComponents: true`): `use cache` directive, `cacheLife` profiles, `cacheTag`, `revalidateTag` (stale-while-revalidate) vs `updateTag` (immediate expiry)
  - Previous model (default): `fetch` cache options, `unstable_cache` for non-fetch functions, `revalidatePath`
  - `React.cache` for request deduplication within a render
- **Metadata & SEO** (new section): static `metadata` export, `generateMetadata` for dynamic routes (`params` as `Promise`), `React.cache` dedup between `generateMetadata` and page, file-based metadata table (`favicon.ico`, `opengraph-image.jpg`, `robots.txt`, `sitemap.xml`), dynamic OG images with `ImageResponse`
- **Performance**: `next/script` with `afterInteractive` / `lazyOnload` / `beforeInteractive` strategies and correct use cases; note that `worker` is experimental and unsupported in App Router

---

## [2026-06-09] fix — Expand and correct Testing section

**Fixed**
- Replaced stub testing section with full examples
- Unit tests: `renderHook` + `QueryClientProvider` wrapper with `retry: false`; MSW setup (`setupServer`, handler lifecycle)
- Component tests: React Testing Library with `userEvent`, query by accessible role
- E2E tests: Playwright golden path + assertion on URL and heading

---

## [2026-06-09] fix — Code review corrections (10 findings)

**Fixed**
- `params: { id: string }` → `params: Promise<{ id: string }>` with `await params` (Next.js 15+ breaking change)
- Server Action now returns `{ success: false as const, errors: ... }` instead of throwing on validation failure
- `initialData` replaced with `HydrationBoundary` + `dehydrate` + `prefetchQuery` to prevent double-fetch
- Added missing `useUser` hook definition; fixed `useUsers` vs `useUser` mismatch in component template
- Added `Skeleton` to `antd` import in component example
- Typed `useQuery<User[], ApiError>` — removed `error as ApiError` cast at call site

---

## [2026-06-09] docs — Initial creation

**Added**
- Full best practices document covering: Project Structure, App Router, Routing & Navigation, Data Fetching, Environment Variables, Server Actions, React Query (setup, key factories, hooks, mutations), Ant Design (setup, components, styling), Component Standards, State Management, TypeScript Standards, Performance, Error Handling
- `CLAUDE.md` quick-reference file
