# Thin route pages Implementation Plan

> **For agentic workers:** Native execution in session. Mechanical extract; no behavior change.

**Goal:** Every fat `page.tsx` is a thin route; UI lives under `components/<feature>/`.

**Architecture:** Page keeps `metadata`, auth, `connectDb`, data fetch, and renders one feature component. Markup and helpers move into that component. Server Components stay server; do not add `"use client"` unless the page already needed it.

**Tech Stack:** Next.js App Router, existing `@/components/*` feature folders.

**Spec:** Conversation design 2026-11-16 — approach 1 (feature folders), fat-first (≥80 lines).

## Global Constraints

- No UI or behavior change.
- No new commits unless the user asks (user rule overrides plan commit steps).
- Prefer existing folders: `components/dashboard`, `components/profile`, `components/interview`, `components/notes`, `components/ielts`, `components/speaking`, `components/admin`, and top-level for landing/access.

## Review Focus

- Accidental `"use client"` on a former server page → keep server unless already client.
- Lost `metadata` / `generateMetadata` on the route → must stay on `page.tsx`.
- Prop typing drift vs query return types → import shared types from domain modules.

---

### Task 1: Dashboard

**Files:**
- Create: `components/dashboard/Dashboard.tsx`
- Modify: `app/(app)/dashboard/page.tsx` → thin route

**Interfaces:**
- Produces: `Dashboard({ dash, speaking, firstName }: { dash: Awaited<ReturnType<typeof getDashboard>>; speaking: Awaited<ReturnType<typeof getToday>>; firstName?: string })`

- [ ] Extract UI + helpers into `Dashboard`
- [ ] Page: auth, fetch, `<Dashboard … />`
- [ ] `npx tsc --noEmit` clean for these files

### Task 2: Profile

**Files:**
- Create: `components/profile/Profile.tsx`
- Modify: `app/(app)/profile/page.tsx` → thin route

**Interfaces:**
- Produces: `Profile({ d, tab, timeZone }: { d: ProfileData; tab: ProfileTab; timeZone: string })`

- [ ] Move Overview/tabs/helpers into `Profile.tsx`
- [ ] Page: auth, parse tab, fetch, render `<Profile … />`

### Task 3: Remaining fat pages (≥80 lines)

Same pattern for interview, notes, ielts, speaking, admin/users, landing, access (see conversation list).

- [ ] Extract each; thin the route
- [ ] `npx tsc --noEmit` and `npm run lint`

### Task 4: Verify

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
