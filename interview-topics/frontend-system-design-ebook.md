# Frontend System Design
### A Complete Question Bank with Worked Answers

*An interview and practice ebook for senior frontend / full-stack engineers*

---

## Table of Contents

**Part I — The Method**
1. What a frontend system design round actually tests
2. The RADIO framework
3. Time budget for a 45–60 minute round
4. How you get downgraded (failure modes)

**Part II — The Toolkit**
5. Rendering strategies
6. The network layer
7. Real-time data delivery
8. Client-side state architecture
9. Rendering performance & virtualization
10. Browser storage & caching
11. Offline, optimistic updates, and conflict resolution
12. Accessibility
13. Internationalization
14. Frontend security
15. Observability and metrics
16. Component API design

**Part III — The Question Bank (fully worked)**
17. News Feed (Facebook / Twitter)
18. Autocomplete / Typeahead
19. Chat application (Slack / Messenger)
20. Collaborative document editor (Google Docs)
21. E-commerce listing + product page (Amazon)
22. Infinite masonry photo grid (Pinterest)
23. Data grid / spreadsheet (Excel Online)
24. Analytics dashboard
25. Email client (Gmail)
26. Video streaming player (YouTube / Netflix)
27. Kanban board with drag & drop (Trello)
28. Resumable file uploader (Dropbox)
29. Google Calendar
30. Maps interface (Google Maps)
31. Rich text editor
32. Notification system
33. Multi-step checkout flow
34. Design system / component library
35. Micro-frontend architecture
36. Third-party embeddable widget
37. A/B testing & feature flag SDK
38. Frontend error monitoring SDK
39. Offline-first PWA (Notion-like)
40. High-frequency ticker (stocks / live scores)

**Part IV — Rapid-Fire Bank & Prep Plan**
41. 30 rapid-fire questions with condensed answers
42. Cheat sheets
43. A four-week preparation plan
44. Self-scoring rubric

---
---

# PART I — THE METHOD

## 1. What a frontend system design round actually tests

Backend system design asks "how do you handle 100M users?" Frontend system design asks **"how do you handle one user, well, on a bad phone, on a bad network, at scale of features and teams?"**

Interviewers are scoring five things:

| Signal | What it looks like |
|---|---|
| **Scoping** | You narrow an intentionally vague prompt before designing. |
| **Architecture** | You can draw components, boundaries, and data flow, and justify them. |
| **Depth** | You can go three levels deep in at least one area (rendering, caching, real-time, a11y). |
| **Tradeoffs** | Every choice has a named alternative and a reason for rejection. |
| **Product sense** | You mention loading states, empty states, errors, offline, and the user on 3G. |

The single biggest differentiator between mid and senior candidates: **seniors talk about failure states and degradation; mid-level candidates only design the happy path.**

## 2. The RADIO framework

Use it out loud. It gives the interviewer a map of where you are.

**R — Requirements (5 min)**
- Functional: what can the user do?
- Non-functional: latency targets, device/browser support, offline, a11y level, i18n, SEO.
- Scale: items per page, updates per second, concurrent editors, payload sizes.
- Explicitly state what you're **descoping**: "I'll assume auth exists and skip it."

**A — Architecture (10 min)**
Boxes and arrows. Server → API layer → client data layer → view layer. Name each module's responsibility. Draw the component tree for the UI.

**D — Data model (5–8 min)**
Two models, and say so:
- **Server entity model** (`Post`, `User`, `Comment`)
- **Client-side model** (normalized store, UI-only state like `isComposerOpen`, ephemeral state like draft text)

**I — Interface / API (5–8 min)**
- Network API: endpoints, params, response shape, pagination style.
- Component API: props of the reusable pieces.
Write actual shapes. Concrete beats abstract.

**O — Optimizations & deep dives (15 min)**
Performance, network, rendering, accessibility, offline, security, error handling. This is where seniority shows. Pick two or three and go deep rather than listing ten shallowly.

## 3. Time budget (45 minutes)

```
0–5    Clarify requirements, write them down
5–15   High-level architecture + component tree
15–22  Data model + API design
22–40  Deep dives (interviewer usually steers here)
40–45  Tradeoff summary, what you'd do with more time
```

If the interviewer interrupts to steer, abandon your plan and follow them. The steering *is* the question.

## 4. How you get downgraded

- **Designing before scoping.** Jumping to "I'd use React Query" in minute one.
- **Framework-name soup.** Naming tools instead of describing mechanisms. Say "a normalized cache keyed by entity id with a TTL", not "Redux Toolkit Query".
- **No numbers.** "It'll be fast" vs "the initial payload is ~40KB gzipped, so LCP under 2.5s on 4G is achievable".
- **Ignoring accessibility.** In a *frontend* interview this reads as inexperience, not as a missing nice-to-have.
- **One-way doors without acknowledgment.** Choosing WebSockets without mentioning SSE and polling.
- **Happy path only.** No empty state, no error state, no retry, no offline.
- **Not managing the clock.** Spending 25 minutes on requirements.

---
---

# PART II — THE TOOLKIT

These are the reusable primitives. Almost every question in Part III is a recombination of these.

## 5. Rendering strategies

| Strategy | How it works | Best for | Cost |
|---|---|---|---|
| **CSR** | Ship JS shell, fetch data in browser | Dashboards, logged-in apps, no SEO need | Poor FCP/LCP, blank screen, weak SEO |
| **SSR** | Render HTML per request on server | Personalized + SEO pages (feeds, PDPs) | Server cost, TTFB tied to data fetch |
| **SSG** | Render HTML at build time | Docs, marketing, blogs | Stale content, long builds at scale |
| **ISR / on-demand revalidation** | SSG + background regeneration | Large catalogs, semi-static pages | Cache invalidation complexity |
| **Streaming SSR** | Flush HTML in chunks as data resolves | Pages with slow sub-sections | Requires framework support, harder error handling |
| **Islands / partial hydration** | Static HTML, hydrate only interactive parts | Content sites with sparse interactivity | Cross-island communication is awkward |
| **Server Components** | Component tree split; some render only on server | Large apps wanting smaller bundles | New mental model, ecosystem gaps |

**Key insight to voice:** hydration is the hidden cost of SSR. HTML arrives fast (good LCP) but the page is not interactive until JS downloads, parses, and hydrates (bad INP/TTI). Streaming + selective hydration + code splitting is the mitigation.

**Choosing rule of thumb:**
- Content must be indexed by search engines → SSR or SSG.
- Content is personalized *and* indexable → SSR with edge caching keyed by segment.
- Behind login and interaction-heavy → CSR with an app shell + skeleton.

## 6. The network layer

### REST vs GraphQL vs RPC

- **REST** — cache-friendly (HTTP semantics work out of the box), simple, but over/under-fetching and N+1 round trips for composite screens.
- **GraphQL** — one round trip for a composite screen, client picks fields; but HTTP caching is lost (POST to a single endpoint), query cost control needed, larger client runtime.
- **RPC (tRPC / gRPC-Web)** — typed end-to-end, minimal overhead, great for internal apps; weak for public APIs.

Answer template: *"I'd use REST with a BFF. A Backend-For-Frontend endpoint like `GET /feed-page` aggregates the three calls the screen needs, so mobile clients make one request. That gives me GraphQL's round-trip benefit without giving up HTTP caching."*

### Pagination

| Type | Request | Pros | Cons |
|---|---|---|---|
| **Offset** | `?page=3&limit=20` | Jump to any page, simple | Item shift causes duplicates/skips; slow deep offsets |
| **Cursor** | `?after=eyJpZCI6...&limit=20` | Stable under inserts, fast | No random page access |

For feeds, chats, and any list where items are inserted at the head: **always cursor-based**. Say why: a new post arriving between page 1 and page 2 pushes item 20 to position 21, so offset pagination shows it twice.

### HTTP caching

```
Cache-Control: public, max-age=31536000, immutable   → hashed static assets
Cache-Control: private, no-cache                     → HTML, must revalidate
Cache-Control: public, s-maxage=60, stale-while-revalidate=600  → CDN-cached API
ETag / If-None-Match                                 → cheap 304s for JSON
```

`stale-while-revalidate` is the single most quotable header in these interviews: serve stale instantly, refresh in the background.

### Request lifecycle concerns
- **Deduplication** — two components asking for the same resource share one in-flight promise.
- **Cancellation** — `AbortController` on unmount and on new keystrokes.
- **Retry with jittered exponential backoff** — `min(cap, base * 2^n) ± random`, only for idempotent requests and 5xx/network errors, never 4xx.
- **Timeouts** — a request without a timeout is a hang.
- **Idempotency keys** — for POSTs like "place order", so a retry doesn't double-charge.

## 7. Real-time data delivery

| Technique | Direction | Cost | Use when |
|---|---|---|---|
| **Short polling** | C→S repeatedly | Wasteful, simple | Low-frequency updates, tolerant of delay |
| **Long polling** | C→S held open | Moderate | Fallback where WS is blocked |
| **SSE** | S→C only | Cheap, auto-reconnect, HTTP/2 friendly | Feeds, notifications, live scores, LLM token streams |
| **WebSocket** | Bidirectional | Stateful connections, needs its own scaling | Chat, collaborative editing, multiplayer |
| **WebRTC** | Peer-to-peer | Complex, NAT traversal | Audio/video, low-latency data |

Practical answers to give:
- Choose **SSE** when updates are server→client only. It's a one-liner with `EventSource`, reconnects automatically, and survives proxies.
- Choose **WebSocket** when the client sends high-frequency messages (typing indicators, cursor positions).
- Always design the **fallback ladder**: WS → SSE → long polling.
- Always handle **reconnect + backfill**: on reconnect, send `lastEventId` and fetch the gap over REST. Without this, users silently lose messages.
- **Backpressure**: if the server pushes 200 updates/sec, don't re-render 200 times. Buffer in a queue, flush on `requestAnimationFrame`, coalesce updates for the same entity id.

## 8. Client-side state architecture

Split state into four categories out loud — this alone signals seniority:

1. **Server cache state** — data owned by the server (posts, users). Needs TTL, revalidation, deduplication, invalidation. Tools: React Query / SWR / Apollo / RTK Query.
2. **Global UI state** — theme, sidebar, current workspace. Small, rarely changing. Context or a tiny store.
3. **Local component state** — form inputs, hover, open/closed. `useState`. Keep it local; lifting everything to global is a common anti-pattern.
4. **URL state** — filters, sort, page, selected tab, modal id. If a user should be able to refresh or share the link and get the same screen, it belongs in the URL.

### Normalization
Store entities flat, keyed by id, and store lists as arrays of ids:

```js
{
  entities: {
    posts: { p1: { id:'p1', authorId:'u1', text:'…', likeCount: 12 } },
    users: { u1: { id:'u1', name:'Ada', avatar:'…' } }
  },
  feeds: { home: { ids: ['p1','p2'], nextCursor: 'abc', status: 'idle' } }
}
```

Why: one user object updated in one place updates every post that references it. Denormalized trees force you to hunt and patch duplicates — the classic source of "the like count is wrong in one place".

## 9. Rendering performance & virtualization

### Core Web Vitals (know the thresholds)
- **LCP** ≤ 2.5s — largest text/image paint. Fix with SSR, priority hints, preloading the hero image, avoiding lazy-loading above the fold.
- **INP** ≤ 200ms — interaction to next paint. Fix by breaking long tasks (`scheduler.yield`, `isInputPending`), debouncing, moving work to Web Workers.
- **CLS** ≤ 0.1 — layout shift. Fix by reserving space: explicit `width/height` or `aspect-ratio` on images, skeletons sized like the real content, `font-display: optional/swap` with size-adjusted fallbacks.

### List virtualization
Render only the visible window plus an overscan buffer.

- **Fixed height** — trivial: `startIndex = floor(scrollTop / rowHeight)`.
- **Variable height** — measure with `ResizeObserver`, keep a cumulative-offset array (or a Fenwick tree for O(log n) updates), estimate unmeasured rows.
- **Bidirectional / anchored** (chat, feeds) — when prepending items, adjust `scrollTop` by the inserted height in the same frame, or use CSS `overflow-anchor`, otherwise the viewport jumps.
- Trade-off to name: virtualization breaks Ctrl+F, breaks naive screen-reader traversal, and breaks anchor links. Mitigate with `aria-setsize`/`aria-posinset` and a "load all" escape hatch for print/export.

### Bundle strategy
- Route-level code splitting first, then component-level for heavy widgets (editors, charts, maps).
- Preload on intent: `mouseenter`/`focus`/viewport-visible on a link → prefetch the route chunk.
- Ship modern syntax to modern browsers (`module`/`nomodule` or build targets); differential loading commonly cuts 15–20%.
- Budget it: "≤170KB gzipped JS for the critical path" is a defensible number to state.

### Rendering hygiene
- Avoid layout thrash: batch DOM reads then writes; `getBoundingClientRect` in a loop after writes forces sync layout each iteration.
- Animate only `transform` and `opacity` (compositor-only properties).
- Use `content-visibility: auto` for long off-screen sections.
- Use `IntersectionObserver` rather than scroll listeners.
- Offload parsing/diffing/sorting of large datasets to a **Web Worker**; keep the main thread for input.

## 10. Browser storage & caching

| Store | Size | Sync/Async | Good for |
|---|---|---|---|
| Memory | RAM | Sync | Hot cache within a session |
| `sessionStorage` | ~5MB | Sync | Per-tab wizard state |
| `localStorage` | ~5MB | Sync (blocks main thread) | Small prefs, feature flags |
| **IndexedDB** | Large (quota-based) | Async | Offline data, message history, drafts, blobs |
| **Cache API** | Quota-based | Async | Service worker asset/response caching |
| Cookies | ~4KB | Sync | Auth tokens (`HttpOnly; Secure; SameSite=Lax`) |

Notes worth saying: storage can be **evicted** under pressure, so treat it as a cache, not a database; use `navigator.storage.persist()` when data matters. Never put access tokens in `localStorage` if you can avoid it — any XSS reads it.

## 11. Offline, optimistic updates, and conflict resolution

**Optimistic update pattern**
1. Generate a client-side temp id (`tmp_uuid`).
2. Apply the change to the store immediately; mark it `pending`.
3. Enqueue the mutation in a durable queue (IndexedDB).
4. On success, reconcile: swap temp id for the server id.
5. On failure, roll back and surface a retry affordance — never a silent revert.

**Ordering**: mutations touching the same entity must be applied in order. Queue per-entity, not globally, so one stuck upload doesn't block unrelated edits.

**Conflict resolution ladder**
- **Last-write-wins** — simple, lossy. Fine for a "read" flag.
- **Version / ETag check** — server rejects stale writes with 409; client merges or prompts. Good default for documents and forms.
- **Operational Transformation (OT)** — transform concurrent ops against each other; requires a central server; what Google Docs historically used.
- **CRDTs** — data structures that merge deterministically without a server (Yjs, Automerge). Better for P2P/offline; larger metadata footprint.

## 12. Accessibility (say this in every interview)

- **Semantics first**: `<button>`, `<nav>`, `<main>`, headings in order. ARIA is a patch, not a foundation.
- **Keyboard**: everything reachable, visible focus ring, logical tab order, Escape closes overlays.
- **Focus management**: move focus into a dialog on open, trap it, restore it to the trigger on close.
- **Live regions**: `aria-live="polite"` for async results ("12 results found"), `assertive` only for errors.
- **Composite widgets**: follow the ARIA Authoring Practices pattern (combobox, listbox, grid, tabs) — roving tabindex, arrow-key navigation.
- **Contrast** 4.5:1 for body text; don't encode meaning in color alone.
- **Motion**: honor `prefers-reduced-motion`.
- **Testing**: axe in CI, plus manual keyboard + screen reader passes.

## 13. Internationalization

- Externalize strings with ICU message format; support plurals and gender, never string concatenation.
- **RTL**: use logical CSS properties (`margin-inline-start`, `padding-block`), mirror icons, `dir="rtl"` on `<html>`.
- Locale-aware formatting via `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.Collator`.
- Split translation bundles per locale and load lazily; don't ship 40 languages to everyone.
- Design for **text expansion** — German/Finnish can run 30–40% longer than English; avoid fixed-width buttons.
- Store and transmit timestamps in UTC; render in the user's timezone.

## 14. Frontend security

- **XSS** — never `innerHTML` untrusted content; sanitize with DOMPurify if you must render HTML; enforce a strict **CSP** (`script-src 'self' 'nonce-…'`, no `unsafe-inline`); use Trusted Types where supported.
- **CSRF** — `SameSite=Lax/Strict` cookies plus a per-session anti-CSRF token for state-changing requests.
- **Token storage** — prefer `HttpOnly` cookies. If you must use JS-readable tokens, keep them in memory with a short TTL and a refresh flow.
- **Clickjacking** — `X-Frame-Options: DENY` / `frame-ancestors 'none'`.
- **Third-party scripts** — the largest real-world risk. Use SRI, self-host where possible, sandbox in iframes, and audit what they can reach.
- **Dependency hygiene** — lockfiles, automated audit, minimize transitive surface.
- **Never trust the client** — validation on the client is UX; authorization happens on the server.

## 15. Observability

- **RUM**: collect LCP/INP/CLS/TTFB via `web-vitals`, send with `navigator.sendBeacon` on `visibilitychange` (not `unload`).
- **Errors**: `window.onerror`, `unhandledrejection`, framework error boundaries; upload source maps privately for symbolication.
- **Sampling**: 100% of errors, 1–10% of performance events at scale; always tag release version + user segment.
- **Custom timings**: `performance.mark`/`measure` around key flows ("time to first message rendered").
- **Watch p75/p95, not averages.** Averages hide the users who are suffering.

## 16. Component API design

For any reusable component, discuss:
- **Props**: minimal, typed, no boolean explosion (prefer `variant="danger"` over five booleans).
- **Controlled vs uncontrolled**: support both (`value` + `defaultValue`).
- **Composition over configuration**: `<Select><Option/></Select>` beats `options={[…]}` when consumers need custom rendering.
- **Escape hatches**: `className`, `render` props / slots, forwarded refs.
- **Events**: `onChange(value, meta)` — pass useful payloads, not just raw DOM events.
- **A11y baked in**: the component owns its ARIA wiring so consumers can't get it wrong.
- **Theming**: CSS custom properties over prop-based styles.

---
---

# PART III — THE QUESTION BANK

Each question follows the same shape: **Prompt → Clarify → Requirements → Architecture → Data & API → Deep dives → Edge cases → Follow-ups.**

---

## 17. Design a News Feed (Facebook / Twitter)

**Prompt:** Design the frontend for an infinite news feed with posts, likes, comments, and image/video media.

### Clarifying questions
- Feed ordering: chronological or ranked by the server? (Assume server-ranked.)
- Are new posts pushed live, or is there a "new posts" pill?
- Media types? Do we autoplay video?
- SEO required? (For a logged-in feed, usually no.)
- Do we support editing/deleting posts inline?

### Requirements
- Functional: infinite scroll, create post, like/unlike, comment, view media, report.
- Non-functional: LCP < 2.5s on 4G, smooth 60fps scroll, works with 10k posts scrolled in a session without memory growth, WCAG 2.1 AA, offline read of cached feed.

### Architecture

```
        ┌──────────────────────────────────────────┐
        │              App Shell                   │
        │  ┌────────┐  ┌──────────────────────┐    │
        │  │ NavBar │  │ FeedContainer        │    │
        │  └────────┘  │  ├ Composer          │    │
        │              │  ├ NewPostsPill      │    │
        │              │  ├ VirtualList       │    │
        │              │  │   └ PostCard[]    │    │
        │              │  │       ├ Header    │    │
        │              │  │       ├ Content   │    │
        │              │  │       ├ Media     │    │
        │              │  │       ├ Actions   │    │
        │              │  │       └ Comments  │    │
        │              │  └ Sentinel(IO)      │    │
        │              └──────────────────────┘    │
        └──────────────────────────────────────────┘
                    │            ▲
             mutations           │ normalized entities
                    ▼            │
        ┌──────────────────────────────────────────┐
        │  Data layer: cache + dedupe + retry      │
        │  ├ HTTP client (fetch + AbortController) │
        │  ├ Normalized entity store               │
        │  └ SSE/WS channel for live counts        │
        └──────────────────────────────────────────┘
                    │
                  BFF  →  Feed svc / Post svc / User svc / Media CDN
```

### Data model (client, normalized)

```ts
type Post = {
  id: string; authorId: string; createdAt: string;
  text: string; media: Media[];
  likeCount: number; commentCount: number;
  viewerHasLiked: boolean;
  status?: 'pending' | 'failed';   // for optimistic posts
};
type Media = { id: string; type: 'image'|'video'; url: string;
               width: number; height: number; blurhash: string;
               hlsUrl?: string; posterUrl?: string };
```

`width/height` are **required** — they let you reserve space and keep CLS at zero.

### API

```
GET /api/feed?cursor=<opaque>&limit=10
→ { items: Post[], users: User[], nextCursor: string|null }

POST /api/posts            { text, mediaIds[] }   Idempotency-Key: <uuid>
POST /api/posts/:id/like   → { likeCount, viewerHasLiked }
DELETE /api/posts/:id/like
GET  /api/posts/:id/comments?cursor=&limit=20
```

Cursor pagination, not offset — new posts arriving at the head would otherwise duplicate items across pages.

### Deep dive: infinite scroll
- `IntersectionObserver` on a sentinel element ~2 viewports before the end, with `rootMargin: '800px'`, so the next page loads before the user hits the bottom.
- Guard against duplicate fetches with an `isFetchingNextPage` flag keyed by cursor.
- Render skeleton cards while loading; keep them the same height as real cards.
- Keep the feed list **virtualized** with dynamic measurement — a 2,000-post feed with images will otherwise consume hundreds of MB and destroy scroll performance.
- Preserve scroll position on back-navigation: persist `{ cursor, scrollTop, renderedIds }` in `sessionStorage` or router state, and restore after the first page is rehydrated.

### Deep dive: likes (optimistic)
```
onLike():
  prev = post.viewerHasLiked
  patch(post, { viewerHasLiked: !prev, likeCount: count + (prev ? -1 : 1) })
  enqueue(mutation)
  on failure → restore prev + toast "Couldn't like this post. Retry"
```
Debounce rapid toggling: collapse to the final state and send one request; use an idempotency key so retries can't double-count.

### Deep dive: media
- Serve responsive images: `srcset` + `sizes`, AVIF/WebP with fallback.
- Show a **blurhash/LQIP** placeholder while loading, sized by the stored aspect ratio.
- `loading="lazy"` below the fold, `fetchpriority="high"` on the first visible image.
- Video: HLS/DASH adaptive bitrate; autoplay muted only when ≥50% visible via `IntersectionObserver`; pause when scrolled out; respect `prefers-reduced-motion` and Data Saver (`navigator.connection.saveData`).

### Deep dive: live updates
Use **SSE** — the feed is server→client only. Push `{type:'like_count', postId, count}` and `{type:'new_posts', count}`. Don't inject new posts into the viewport (it moves content under the user's finger); show a **"12 new posts"** pill that scrolls to top on tap. Coalesce count updates in a buffer flushed on `requestAnimationFrame`.

### Accessibility
- Each post is an `<article>` with an accessible name from the author + timestamp.
- Like button: `<button aria-pressed="true">`, label "Like, 12 likes".
- Announce loaded pages via a polite live region: "10 more posts loaded".
- Because virtualization hides DOM, set `aria-setsize="-1"` and `aria-posinset` on posts.

### Edge cases
Deleted post while in view → tombstone card. Blocked author. Failed image → alt text + retry. Rapid network flapping → show cached feed with a stale banner. Very long text → clamp with "See more" (avoid `-webkit-line-clamp` alone for a11y; keep full text in the DOM).

### Follow-ups
- *How do you keep memory flat over a long session?* Virtualize, and evict entity data for posts far outside the window, keeping only ids so scroll-back can refetch.
- *How would you A/B test feed ranking?* Server assigns a variant, returns it in the payload, client tags all analytics events with it.

---

## 18. Design an Autocomplete / Typeahead component

**Prompt:** Design a reusable, production-grade autocomplete used across search, mentions, and address fields.

### Clarifying questions
- Single or multi-select? Free text allowed?
- Data source: remote, local, or hybrid?
- How large is the dataset? Are results ranked server-side?
- Do we need grouping, icons, keyboard shortcuts, recent searches?

### Requirements
Latency: results feel instant (< 100ms perceived). Must be fully keyboard accessible, screen-reader correct, and must never show results for a stale query.

### Architecture

```
<Combobox>
 ├ <Input>            (aria-expanded, aria-controls, aria-activedescendant)
 ├ <Popover>
 │   └ <Listbox role="listbox">
 │        └ <Option role="option" aria-selected>
 └ controller: query → debounce → cache → fetch(abort) → rank → render
```

### The query pipeline (the heart of the answer)

1. **Trim & normalize** (lowercase, strip diacritics).
2. **Minimum length gate** (usually ≥ 2 chars) — but always show *recent/popular* on empty focus.
3. **Debounce ~150–250ms** on keystrokes. Use *throttle* instead if you want incremental results while typing fast.
4. **Cache lookup**: an LRU `Map<queryString, Result[]>` with a TTL. Also a **prefix trick** — if `"lap"` returned < pageSize results, `"lapt"` can be filtered client-side without a request.
5. **Fetch with `AbortController`**, aborting the previous in-flight request.
6. **Race guard**: even with abort, keep a monotonically increasing `requestId` and drop responses whose id isn't the latest. This is the classic bug: fast typing shows results for an earlier query.
7. **Render**, highlighting the matched substring (escape user input before highlighting — this is an XSS vector).

```js
let seq = 0, ctrl;
async function search(q) {
  const id = ++seq;
  ctrl?.abort(); ctrl = new AbortController();
  if (cache.has(q)) return render(cache.get(q));
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    const data = await res.json();
    if (id !== seq) return;          // stale response guard
    cache.set(q, data.items);
    render(data.items);
  } catch (e) { if (e.name !== 'AbortError') showError(); }
}
```

### Accessibility (ARIA combobox pattern)
- Input: `role="combobox"`, `aria-expanded`, `aria-controls="listbox-id"`, `aria-autocomplete="list"`.
- Active option tracked via `aria-activedescendant` — **focus stays in the input**, never move DOM focus into the list.
- Keys: ↓/↑ move, Home/End jump, Enter select, Esc close (then Esc again clears), Tab closes and commits or moves on.
- Announce result counts in a live region: "5 suggestions available."
- Options must be reachable by pointer, keyboard, and touch; hit targets ≥ 44px.

### Performance
- Virtualize if the list can exceed ~100 options.
- Precompute a **trie** or use an inverted index for large local datasets; run matching in a **Web Worker** for 100k+ entries.
- Prefetch on focus (fire the "empty query / popular" request when the input is focused, before typing).

### Edge cases
No results → helpful empty state with a suggestion. Network error → inline retry, don't close the popover. Very slow response → keep the previous results with a subtle loading indicator rather than flashing empty. IME composition (Chinese/Japanese/Korean) → ignore keystrokes while `isComposing` is true. Mobile → account for the virtual keyboard covering the list; use `visualViewport`.

### Follow-ups
- *How do you rank results?* Server-side by popularity + personalization; client only re-orders exact-prefix matches to the top.
- *How do you log for relevance tuning?* Log query, shown result ids, selected index, and time-to-select; sample and batch with `sendBeacon`.

---

## 19. Design a Chat Application (Slack / Messenger)

**Prompt:** Design the frontend for a real-time chat with channels, threads, presence, and typing indicators.

### Requirements
- Functional: send/receive messages, history scrollback, threads, reactions, attachments, presence, typing, unread counts, search.
- Non-functional: message delivery feels instant, no lost messages across reconnects, works offline for reading and queues sends, 10k+ message channels scroll smoothly.

### Architecture

```
UI: <Sidebar channels/unreads>  <MessageList virtualized>  <Composer>
                      │                    ▲
                      ▼                    │
        ┌───────────────────────────────────────────┐
        │ SyncEngine                                │
        │  ├ WebSocket client (heartbeat, backoff)  │
        │  ├ Outbox queue (IndexedDB, per-channel)  │
        │  ├ Message store (normalized, per channel)│
        │  └ Gap filler (REST backfill by cursor)   │
        └───────────────────────────────────────────┘
```

### Transport
**WebSocket**, because the client sends high-frequency events too (typing, read receipts). Details to state:
- Heartbeat ping every ~25s; if no pong in 10s, tear down and reconnect.
- Reconnect with exponential backoff + jitter, capped at ~30s.
- On reconnect: send `lastSeenSeq` per subscribed channel; server replays or the client backfills via `GET /channels/:id/messages?after=<seq>`. **This gap-filling step is what separates a real answer from a toy one.**
- Multiplex all channels over one socket; subscribe/unsubscribe as the user navigates.
- Multiple tabs: elect a leader via `BroadcastChannel` or use a `SharedWorker` so one socket serves all tabs.

### Message model & delivery states

```ts
type Message = {
  id: string;              // server id
  clientId: string;        // uuid generated before send (dedupe key)
  channelId: string; authorId: string;
  seq: number;             // server-assigned monotonic ordering
  body: string; attachments: Attachment[];
  createdAt: string;
  state: 'queued'|'sending'|'sent'|'delivered'|'read'|'failed';
};
```

Send flow: append locally with `state:'queued'` and a `clientId` → enqueue in IndexedDB outbox → send over WS → on ack, replace with the server message matched by `clientId` (prevents duplicates when the ack is lost and the client retries).

**Ordering:** never sort by `createdAt` (clock skew). Sort by server `seq`. Optimistic messages sort last until acked.

### Deep dive: the message list
This is the hardest scroll surface in frontend engineering.
- Virtualized, **variable height**, **reverse-ordered** (newest at bottom).
- **Scroll anchoring**: when prepending older history, capture `scrollHeight` before insert and set `scrollTop += (newHeight - oldHeight)` in the same frame — otherwise the view jumps.
- **Stick to bottom** only if the user is already within ~50px of the bottom; otherwise show a "Jump to latest ↓" button with an unread count.
- Load history in pages of 50 triggered by a top sentinel.
- Group consecutive messages by the same author within 5 minutes (fewer DOM nodes, better readability).
- Images/attachments must have reserved dimensions or the list will shift as they load.

### Presence & typing
- Typing is ephemeral and high-frequency: throttle to one event per 3s while typing, auto-expire client-side after 5s. Never persist.
- Presence at scale: don't push per-user events to everyone. Subscribe presence only for members visible on screen; server aggregates and sends deltas.

### Unread counts
Server is the source of truth (`lastReadSeq` per channel per device). Client computes badge = `latestSeq - lastReadSeq`. Mark read on visibility (`IntersectionObserver` on the last message + `document.visibilityState === 'visible'`), debounced.

### Offline
Read from IndexedDB cache; composer stays enabled and queues sends; a banner states "Offline — messages will send when you reconnect." On reconnect, flush the outbox in order per channel.

### Accessibility
Message list as an `aria-live="polite"` log (`role="log"`) — but only announce new incoming messages, and only when the window is focused, or screen reader users get flooded. Keyboard: `Ctrl+K` channel switcher, arrow navigation between messages, Escape to leave a thread.

### Follow-ups
- *A message fails permanently?* Persist in outbox, show inline "Not delivered — Retry / Delete".
- *End-to-end encryption?* Encrypt in a Web Worker, store keys in IndexedDB (non-extractable `CryptoKey`), and accept that server-side search is no longer possible — search becomes local over decrypted content.

---

## 20. Design a Collaborative Document Editor (Google Docs)

**Prompt:** Multiple users editing one rich-text document simultaneously.

### Requirements
Concurrent editing without lost updates; live cursors and selections; offline editing that merges on reconnect; undo/redo that is *per-user*, not global; comments and suggestions.

### The core decision: OT vs CRDT

| | OT | CRDT |
|---|---|---|
| Model | Transform ops against concurrent ops | Data structures that merge commutatively |
| Needs central server | Yes | No (works P2P) |
| Metadata overhead | Low | Higher (tombstones, per-char ids) |
| Implementation risk | Transform functions are subtle and hard | Library-provided (Yjs, Automerge) |
| Offline for long periods | Painful | Natural |

**Answer:** "I'd use a CRDT — Yjs-style — because it makes offline editing and reconnection a non-event, and I don't want to hand-write transform functions. The cost is document metadata growth, which I'd mitigate with periodic snapshot compaction and garbage collection of tombstones."

### Architecture

```
Editor view (contenteditable + custom model, e.g. ProseMirror/Lexical)
        │  local ops
        ▼
   Document CRDT  ── update ──►  Awareness (cursors, selections, names)
        │                                  │
        └── encoded update ────► WebSocket provider ────► relay server
                                              (broadcast + persist)
```

### Key design points

- **Never trust `contenteditable` to be the model.** Maintain a document model; the DOM is a projection. Intercept `beforeinput`, apply to the model, re-render.
- **Awareness channel is separate from document state.** Cursor positions are ephemeral — never persisted, high frequency (throttle to ~50ms / on animation frame), and dropped on disconnect.
- **Cursor positions must be relative positions** (anchored to CRDT ids), not integer offsets — otherwise a remote insert above shifts everyone's cursor.
- **Undo must be scoped to the local client's origin.** Ctrl+Z should never undo a colleague's paragraph. CRDT libraries expose an origin-filtered undo manager; say this explicitly, it's a classic follow-up.
- **Persistence & load**: server stores the latest snapshot + an update log. On open, client loads snapshot then applies deltas. Snapshot every N updates to keep load fast.
- **Large documents**: virtualize the rendering of pages/blocks; only render blocks near the viewport. Pagination/print layout is computed lazily.
- **Presence list** shows avatars with deterministic per-user colors; selections rendered as absolutely-positioned overlays (not DOM wrappers) so they don't corrupt the text tree.

### Performance
- Batch remote updates and apply on `requestAnimationFrame`.
- Diff at the block level so a remote edit in paragraph 40 doesn't re-render 39 others.
- Move CRDT encode/decode into a **Web Worker** for very large docs.
- IME/composition events must not be interrupted by remote patches — buffer remote updates until composition ends.

### Edge cases
Two users deleting the same range; paste of 3MB of HTML (sanitize + chunk the transaction); a user offline for a week (snapshot mismatch → fall back to full state sync); permission downgrade mid-session (server rejects ops; client switches to read-only with a toast).

---

## 21. Design an E-commerce Listing + Product Page (Amazon)

### Requirements
- SEO-critical, so server rendering is mandatory.
- Faceted filtering, sorting, pagination on the listing page.
- PDP: gallery, variants, price, stock, reviews, add-to-cart.
- Conversion is money: LCP and CLS budgets are hard requirements.

### Rendering strategy
- **Listing (PLP)**: SSR with edge caching. Cache key = path + normalized filter params + locale + currency. Personalized bits (recently viewed, your price) are hydrated client-side or streamed in later so the cached shell stays shareable.
- **PDP**: ISR/SSG for the static core (title, description, images) + client fetch for volatile fields (price, stock, delivery estimate). Never cache stock counts.
- Product schema.org JSON-LD for rich results; canonical URLs; `rel=next/prev` semantics or a clean paginated URL structure.

### URL as state
```
/laptops?brand=dell,hp&price=500-1000&sort=price_asc&page=3
```
Filters belong in the URL: shareable, back-button correct, cacheable, indexable (with care — use `robots` rules to avoid indexing infinite facet combinations).

### Deep dive: filters
- Apply filters optimistically in the UI (checkbox flips instantly) while the request is in flight; show a subtle loading veil over the grid, keep old results visible rather than blanking.
- Debounce range sliders (300ms), cancel superseded requests.
- Facet counts come from the server; grey out zero-count options rather than removing them (removal makes the UI jump).
- Keep scroll position stable when filters change: reset to top intentionally, and announce "48 results" in a live region.

### Deep dive: cart
- Cart lives server-side for logged-in users, in `localStorage` for guests, and merges on login (union with quantity max, then re-validate prices).
- Add-to-cart is optimistic with rollback; use an **idempotency key** so a double tap doesn't add two.
- Price/stock must be re-validated at checkout — never trust the client-side price.

### Performance specifics
- Hero product image: preloaded, `fetchpriority="high"`, correct `srcset`, AVIF.
- Reserve space for every image and for the price block (prices arriving late are a top CLS source).
- Defer reviews, recommendations, and "customers also bought" — load on scroll.
- Third-party tags (analytics, ads, chat) are usually the biggest INP offenders: load them with `async`, after interaction, or in a partytown-style worker.

### Follow-ups
- *Multi-currency/locale?* Currency in URL or cookie, formatting via `Intl.NumberFormat`, cache key includes locale.
- *Flash sale traffic spike?* Static shell from CDN, queue page, and stock polled with `stale-while-revalidate` rather than per-user SSR.

---

## 22. Design an Infinite Masonry Photo Grid (Pinterest)

### The core problem
Variable-height items in multiple columns, virtualized, with images loading asynchronously.

### Layout algorithm
1. Compute column count from container width (`ResizeObserver`, not `window.resize`).
2. Maintain `columnHeights[]`. For each item, place it in the **shortest column**, then add its height.
3. Item height is computable *before* the image loads because the API returns intrinsic `width`/`height`: `renderedHeight = columnWidth * (h / w) + captionHeight`. This is what keeps CLS at zero.
4. Store absolute `{x, y, w, h}` per item; render with `transform: translate(x, y)` inside a positioned container of total height.

### Virtualization
- Only render items whose `y` range intersects `[scrollTop - overscan, scrollTop + viewportHeight + overscan]`.
- Binary-search the sorted-by-`y` item list to find the visible window.
- On resize, recompute layout in a Web Worker for large collections, then swap in the new positions.

### Image pipeline
- `srcset` with column-width-appropriate sizes; request the exact rendered width from an image CDN (`?w=236&fm=avif`).
- Placeholder = dominant color or blurhash, so the grid looks complete instantly.
- Decode off the main thread: `img.decode()` before insertion for smoother scroll.
- Unload far-off-screen images (`src=''` or rely on unmount) to bound memory on long sessions.

### Follow-ups
- *Back navigation restores position?* Persist scroll offset + loaded page cursors + layout seed; restore synchronously before paint.
- *Right-to-left locales?* Mirror column ordering with logical properties.

---

## 23. Design a Data Grid / Spreadsheet (Excel Online, Airtable)

### Requirements
100k+ rows × 100+ columns, sticky headers, column resize/reorder, sorting, filtering, inline editing, cell selection ranges, copy/paste, keyboard navigation.

### Architecture

```
GridContainer (scroll owner)
 ├ CornerCell   ├ HeaderRow (sticky, horizontally virtualized)
 ├ RowHeaders (sticky, vertically virtualized)
 └ Viewport → renders cells for [rowStart..rowEnd] × [colStart..colEnd]
Data layer: page cache keyed by row range + sort/filter signature
```

### Key techniques
- **2D virtualization**: virtualize rows *and* columns. Rendering 100 columns × 40 rows = 4,000 cells is already heavy; render only what's visible plus overscan.
- **Windowed data fetching**: don't load 100k rows. `GET /rows?offset=&limit=&sort=&filter=` in pages of 100–200; keep an LRU of pages; render skeleton cells for unloaded ranges and fetch on scroll idle (debounce during fast scroll so you don't request every intermediate page).
- **Sort/filter server-side** for large datasets — client-side sorting 100k rows blocks the main thread. If it must be client-side, do it in a Web Worker with a typed-array-backed columnar store.
- **Columnar storage** (`{ colId: Float64Array | string[] }`) beats an array of objects for memory and iteration speed.
- **Editing**: only the focused cell is a real `<input>`; every other cell is a plain div. This is the single biggest perf win in grid design.
- **Selection**: store as ranges `{r1,c1,r2,c2}`, not per-cell booleans. Render the selection outline as one absolutely-positioned overlay.
- **Formulas**: build a dependency graph, topologically sort, recompute only dirty cells; detect cycles and surface `#CIRCULAR`.
- **Copy/paste**: intercept `copy`/`paste`, write both `text/plain` (TSV) and `text/html` so Excel interop works.

### Accessibility
Use `role="grid"` / `row` / `gridcell`, with `aria-rowcount`/`aria-colcount` set to the **full** logical size and `aria-rowindex` on rendered rows, so screen readers understand a virtualized grid. Roving tabindex: one cell in the tab order, arrows move.

---

## 24. Design an Analytics Dashboard

### Requirements
Multiple widgets (line, bar, funnel, table, big-number), a global date range + filters, drill-down, refresh, export, saved layouts.

### Architecture
- Each widget is **self-contained**: owns its own query, loading, error, and empty states. It receives the global filter context as props.
- A **query orchestrator** dedupes identical queries across widgets, batches them into one request where possible, and cancels in-flight queries when filters change.
- Layout is a persisted grid (`{ id, x, y, w, h }`) with drag/resize.

### Data concerns
- **Aggregate server-side.** Never ship 1M rows to compute a daily average. Request pre-bucketed series: `?metric=signups&granularity=day&from=&to=`.
- **Downsample for pixels**: a 1200px-wide chart cannot show 100k points. Use LTTB (largest-triangle-three-buckets) downsampling so the visual shape survives.
- **Cache by query signature** with `stale-while-revalidate`: show the previous result immediately, refresh in background, mark "updated 2m ago".
- **Progressive load**: widgets in the viewport first (`IntersectionObserver`), the rest on scroll.
- **Timezone** is a first-class filter — daily buckets differ by timezone; always state the timezone in the UI.

### Rendering choice
- **SVG** for < ~1,000 elements: accessible, hit-testable, styleable.
- **Canvas** for 10k+ points; implement hit-testing via a spatial index or an offscreen color-keyed buffer.
- **WebGL** only for very large scatter/heatmap workloads.

### Accessibility (charts are usually failed here)
Provide a data table alternative (`<table>` visually hidden or in a "View as table" toggle), `role="img"` with a summarizing `aria-label`, keyboard-navigable data points, and never encode series only by color — use shape/pattern too.

### Follow-ups
- *Real-time dashboard?* SSE stream of deltas; append to series and drop points beyond the window; throttle re-render to 1–2fps for charts, which is plenty.
- *Export to CSV/PDF?* Generate server-side for large data; client-side only for what's already loaded.

---

## 25. Design an Email Client (Gmail)

### Requirements
Threaded list, reading pane, compose with drafts, search, labels, bulk actions, keyboard shortcuts, offline.

### Architecture
Three-pane shell: sidebar (labels) / list (virtualized) / reading pane. All three read from a shared normalized store.

### Sync model
- **Delta sync**, not full refetch: the client stores a `historyId`/sync token; `GET /sync?since=<token>` returns added/changed/deleted message ids.
- Store messages in **IndexedDB** for offline reading and instant startup: render from local cache first, then reconcile with the server (a stale-while-revalidate at the app level).
- Bulk actions (archive 500 emails) apply optimistically to the store and send one batched mutation; roll back the whole batch on failure with an "Undo" snackbar (which is really a 5-second delayed send).

### Compose & drafts
- Autosave drafts on a debounce (~2s) and on blur/visibility change; keep drafts in IndexedDB so a crash doesn't lose them.
- Support multiple concurrent compose windows → each is an isolated state machine.
- Attachments: chunked upload with progress, resumable (see §28), block send until uploads complete or send with a placeholder link.

### Rendering untrusted HTML email — the security centerpiece
Email bodies are attacker-controlled HTML. Options:
1. **Sanitize** (DOMPurify) + strict CSP + strip `<script>`, event handlers, `javascript:` URLs.
2. **Sandboxed iframe** with `sandbox="allow-popups allow-popups-to-escape-sandbox"` (note: *no* `allow-same-origin`), served from a **separate origin** so it can't touch your cookies or DOM.
3. **Proxy remote images** through your servers and block them by default ("Display images below") to defeat tracking pixels and IP leakage.
State option 2 + 3 as the production answer.

### Keyboard & a11y
`j/k` navigation, `e` archive, `/` search — implemented with a central shortcut manager that respects input focus. The list is `role="list"` with `aria-selected` items; bulk selection announced ("3 conversations selected").

---

## 26. Design a Video Streaming Player (YouTube / Netflix)

### Requirements
Adaptive quality, seek, subtitles, resume position, fullscreen/PiP, low startup latency, works on flaky networks, DRM for premium content.

### Streaming pipeline
- **HLS or DASH**: the video is split into 2–6s segments at multiple bitrates, described by a manifest.
- Use **Media Source Extensions**: JS fetches segments and appends them to a `SourceBuffer`. This is what enables client-side ABR.
- **ABR algorithm**: estimate throughput (EWMA of recent segment download speeds) *and* watch buffer level. Switch up only if buffer is healthy (> ~15s) and sustained bandwidth supports it; switch down aggressively when buffer drains. Mention hybrid buffer-based + throughput-based (BOLA-style) approaches.
- **Startup**: request the lowest-quality first segment for fast first frame, then upshift. Preload the manifest + first segment on hover over the thumbnail.
- **Buffer targets**: ~10s forward buffer on mobile/metered, 30s+ on desktop wifi. Evict past buffer to bound memory.
- **DRM**: EME with Widevine/FairPlay/PlayReady; license request via a keyed endpoint; never ship keys to the client.

### UI concerns
- Controls: custom UI over the `<video>` element; auto-hide after 3s of inactivity, always show on keyboard focus.
- Seek bar shows buffered ranges (`video.buffered`) and a thumbnail sprite preview (a single sprite sheet + a VTT index).
- Resume: persist `currentTime` every ~5s and on `pagehide` via `sendBeacon`.
- Subtitles: WebVTT tracks, user-stylable (size, background) — an accessibility requirement, not a nice-to-have.
- Keyboard: space play/pause, ←/→ ±5s, ↑/↓ volume, `f` fullscreen, `c` captions. Announce state changes politely.
- Handle autoplay policy: browsers block unmuted autoplay; start muted with a visible unmute affordance.

### Metrics that matter
Startup time, rebuffer ratio, average bitrate, seek latency, playback failures by error code. These are your product's real quality signal — collect them per session and slice by device/network.

---

## 27. Design a Kanban Board with Drag & Drop (Trello)

### Requirements
Columns of cards, drag cards within/across columns, reorder columns, real-time multi-user updates, keyboard-accessible reordering.

### Ordering data model — the key insight
Don't store integer indexes (moving one card would rewrite every sibling). Use **fractional / lexicographic ranks**: to move a card between `a` (rank "n") and `b` (rank "p"), assign "o". Use a base-62 lexorank scheme with rebalancing when strings grow too long. One card move = one field update on one row.

```ts
type Card = { id: string; columnId: string; rank: string; title: string; };
```

### Drag & drop implementation
- Prefer **pointer events** over HTML5 drag-and-drop: HTML5 DnD has inconsistent styling, no touch support, and poor control over the drag image.
- Track pointer offsets, render a floating drag preview with `transform` (compositor-only), and compute the drop target from cached column/card rects (measure once on drag start, not per move).
- Use `FLIP` (First-Last-Invert-Play) for the reflow animation of siblings.
- Auto-scroll when dragging near a container edge, with speed proportional to proximity.
- Throttle move handling to `requestAnimationFrame`.

### Accessibility (this is the follow-up they'll ask)
Drag and drop must have a keyboard equivalent: focus a card, press Space to "pick up", arrows to move between positions/columns, Space to drop, Escape to cancel — announcing each step in a live region ("Card moved to In Progress, position 2 of 5"). Provide a "Move to…" menu as a redundant path.

### Real-time
Broadcast `{cardId, columnId, rank}` over WS. Because ranks are absolute, concurrent moves converge without a full reorder. Optimistic local move; on server rejection, animate back and toast.

---

## 28. Design a Resumable File Uploader (Dropbox / Drive)

### Requirements
Multi-GB files, resume after network loss or page reload, parallel uploads, progress, pause/cancel, integrity check, drag-drop + folder upload.

### Design
1. **Chunk** the file with `File.slice()` into 5–10MB parts (larger chunks on fast networks; adapt).
2. **Initiate**: `POST /uploads` with `{name, size, mimeType, fileHash}` → returns `uploadId` and possibly pre-signed URLs per part.
3. **Hash** the file in a **Web Worker** (streaming SHA-256) for dedupe and integrity — never on the main thread.
4. **Upload parts in parallel** (concurrency 3–6), each with retry + backoff; a failed part retries independently.
5. **Persist progress** — `{uploadId, fileHandle/name, uploadedPartIds}` in IndexedDB. On reload, ask the server which parts it already has (`GET /uploads/:id`) and resume only the gaps.
6. **Complete**: `POST /uploads/:id/complete` with the part list + checksum; server assembles and verifies.

### UX details
- Real progress = bytes acked by the server, not bytes handed to `fetch` (the browser buffers, so naive progress hits 100% then hangs).
- Aggregate progress across files with per-file rows, pause/resume/cancel each.
- Warn on `beforeunload` while uploads are active.
- Validate type/size client-side for UX, but the server re-validates.
- Show ETA from a rolling throughput average, not instantaneous.
- Large folders: process the file list incrementally so the UI doesn't freeze on 10,000 entries.

---

## 29. Design Google Calendar

### Requirements
Day/week/month/agenda views, create/edit/drag events, recurring events, multiple calendars, timezones, invites/RSVP, reminders.

### Hard parts
- **Recurrence**: store RRULE (iCalendar) plus exception dates (`EXDATE`) and modified instances (`RECURRENCE-ID`). **Expand occurrences lazily for the visible window only** — an infinite weekly series must never be materialized. Editing asks: "this event / this and following / all events", each a different mutation.
- **Timezones**: store UTC + the event's original timezone (a 9am Tokyo meeting stays 9am Tokyo even if the organizer travels). Render in the viewer's timezone with a DST-aware library. All-day events are *floating* dates with no timezone — a classic bug source.
- **Overlap layout**: for each day column, sort events by start; group into clusters of overlapping events; within a cluster compute columns via a greedy interval-graph coloring; width = 1/columns, offset by column index.

### Interaction
- Drag to create (pointer down on the grid → live preview snapped to 15-min increments), drag to move, resize edges to change duration.
- Optimistic updates with rollback; conflicting edits resolved by version/ETag with a "someone else changed this" prompt.
- Virtualize the month/agenda views for long ranges; prefetch adjacent weeks so navigation is instant.

---

## 30. Design a Maps Interface (Google Maps)

### Core mechanics
- **Tiles**: the world is split into 256px tiles per zoom level (`z/x/y`). Fetch only visible tiles + a ring of neighbours; cache in memory + Cache API; show the parent zoom tile upscaled while the sharper tile loads (no blank map).
- **Rendering**: raster tiles are simple; **vector tiles + WebGL** give smooth zoom/rotate, restyling without refetch, and smaller payloads. Say you'd choose vector tiles for a modern product.
- **Panning**: transform the tile layer with `translate3d` during drag (compositor thread), only recompute the visible tile set on drag end / throttled.
- **Markers at scale**: clustering (server-side or a client quadtree/supercluster) — never mount 50k DOM markers. Render markers into a canvas/WebGL layer and hit-test with a spatial index.
- **Search & directions**: debounced geocoding autocomplete (see §18), route polylines simplified with Ramer–Douglas–Peucker per zoom level.
- **Offline**: cache tiles for a downloaded region with a size cap and eviction policy.

### Accessibility
A map is not usable by screen reader alone — always provide a list view of results and text directions as the primary accessible path, keyboard panning/zooming, and full-page fallbacks for every map interaction.

---

## 31. Design a Rich Text Editor

### The first thing to say
`contenteditable` is a browser-controlled black box with different behavior per engine. Production editors keep their **own document model** and treat the DOM as a render target — this is how ProseMirror, Lexical, and Slate work.

### Architecture
```
Input events (beforeinput, composition, paste, keydown)
        ▼
  Command layer  →  Transaction  →  Document model (tree of nodes/marks)
        ▼                                  │
  Plugins (history, lists, links, mentions)│
        ▼                                  ▼
  Reconciler → DOM      Selection mapper (model offsets ↔ DOM ranges)
```

### Key decisions
- **Schema-driven model**: nodes (paragraph, heading, list, image) and marks (bold, link). A schema lets you reject invalid structures and makes paste sanitization principled.
- **Transactions**: every change is an immutable step. This gives you undo/redo, collaboration hooks, and change tracking for free.
- **Selection**: map model positions to DOM ranges after each render; restore selection precisely or the caret jumps.
- **Paste**: parse pasted HTML against the schema, dropping unknown nodes and styles. Also handle `text/plain` and image paste (upload then insert a placeholder node that swaps to the real URL).
- **IME/composition**: never re-render during `compositionstart` → `compositionend`; buffer changes.
- **Plugins**: keep features (mentions, slash menu, tables, markdown shortcuts) as plugins over the transaction stream, not tangled in the core.

### Performance
Only re-render the affected blocks (node-level diffing keyed by node id). For very long documents, virtualize blocks and lazily mount heavy embeds.

### Accessibility
`role="textbox" aria-multiline="true"`, toolbar with roving tabindex and `aria-pressed` on format buttons, keyboard shortcuts documented and discoverable, and screen-reader announcement of formatting changes.

---

## 32. Design a Notification System (in-app + push)

### Scope split
- **In-app center**: bell icon with unread badge, dropdown list, "mark all read", infinite history, grouping ("Ana and 3 others liked your post").
- **Toasts**: transient, stacked, dismissible, pause-on-hover, queue with a max visible count.
- **Web Push**: service worker + Push API for when the tab is closed.

### Delivery
- SSE or WS for live in-app notifications; REST for history (`GET /notifications?cursor=`).
- Unread count from the server (`unreadCount`), incremented locally on push, reconciled on fetch.
- **Multi-tab consistency**: `BroadcastChannel` so marking read in one tab updates all others without extra requests.

### Web Push specifics
- Request permission **contextually**, never on page load — a permission prompt on first paint is the classic anti-pattern (and browsers now penalize it).
- Subscribe with VAPID keys; store the subscription server-side keyed by user + device; handle `pushsubscriptionchange`.
- Service worker `push` handler shows the notification; `notificationclick` focuses an existing client or opens the deep link.
- Respect quiet hours and per-category preferences; always provide a granular settings page.

### Toast component design
```ts
toast.show({ id?, title, description?, variant, duration=5000,
             action?: {label, onClick}, dismissible=true })
```
- `role="status"` (polite) for info, `role="alert"` (assertive) for errors.
- Never auto-dismiss a toast containing an action a user must take — WCAG requires enough time; pause timers on hover/focus.
- Deduplicate by id so a retry loop doesn't spawn 40 identical toasts.

---

## 33. Design a Multi-Step Checkout / Wizard

### Requirements
Address → shipping → payment → review → confirm. Resumable, validated, accessible, resilient to refresh and double-submit.

### State design
- A **state machine** (XState-style) with explicit states and guards beats a `step` integer: it prevents illegal transitions (you can't reach payment without a valid address).
- Persist progress in `sessionStorage` (or server-side for logged-in users) so refresh doesn't lose data — but **never persist raw card data**.
- Each step is its own route (`/checkout/shipping`) so back/forward and deep links work.

### Validation
- Client-side per-field on blur, per-step on continue, plus server validation as truth.
- Show errors inline, tie them with `aria-describedby`, set `aria-invalid`, and move focus to the first error on submit.
- An error summary at the top of the form (linked to each field) is the accessible pattern for long forms.

### Payment & correctness
- Card fields inside a PSP-hosted **iframe** (Stripe Elements style) so your app never touches PAN data — this is a PCI scope answer, say it.
- **Idempotency key** generated when the user reaches the review step and reused on every retry of "Place order" — prevents duplicate charges.
- Disable the submit button while in flight *and* guard server-side; a disabled button alone is not a solution.
- Handle 3DS redirects/popups and return-URL resumption.
- Address autocomplete via a debounced geocoding API with a manual-entry fallback (always — autocomplete fails for many addresses worldwide).

### Edge cases
Price changed while in checkout → re-confirm. Item went out of stock → remove with explanation and recalc. Payment timed out with unknown status → poll order status rather than re-submitting. Slow 3G → make each step's payload small and independent.

---

## 34. Design a Design System / Component Library

### Layers
```
Design tokens (JSON)  →  CSS custom properties / theme
      ▼
Primitives (Box, Text, Stack, Icon)
      ▼
Components (Button, Input, Select, Modal, Table)
      ▼
Patterns (Form, DataGrid, PageLayout)
```

### Distribution & versioning
- Publish as an ESM package with **tree-shaking** (`sideEffects: false`), per-component entry points, and no bundled peer dependencies.
- **SemVer discipline**: visual changes are breaking to some consumers; use codemods for breaking API changes; support at least one deprecation cycle with console warnings.
- Ship types, and document with a live playground (Storybook) including a11y and interaction tests.

### Theming
CSS custom properties over runtime CSS-in-JS: zero runtime cost, works with SSR, supports dark mode and multi-brand via a `data-theme` attribute.

### Governance (they will ask)
- Contribution process, a component maturity ladder (experimental → stable → deprecated), and an intake process for one-off requests.
- Adoption metrics: percentage of components imported from the library vs local, tracked by a lint rule or bundle analysis.
- Escape hatches matter: if teams can't extend a component, they fork it, and the system dies.

### Testing
Unit (behavior), visual regression (Chromatic/Playwright screenshots), a11y (axe), and cross-browser smoke tests.

---

## 35. Design a Micro-Frontend Architecture

**Prompt:** 12 teams, one web app. How do you let them ship independently?

### Composition options

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Build-time (packages)** | Each team publishes an npm package | Simple, fast runtime | No independent deploy — host must rebuild |
| **Server-side composition (SSI/edge)** | Edge assembles HTML fragments | Great SEO/perf, framework-agnostic | Infra complexity |
| **Runtime via Module Federation** | Host loads remote modules at runtime | True independent deploy, shared deps | Version skew, runtime failure modes |
| **iframes** | Hard isolation | Bulletproof isolation, easy legacy embedding | Bad UX (routing, sizing, modals), duplicated deps |
| **Web Components** | Custom elements as boundary | Framework-agnostic contract | SSR & a11y/focus across shadow boundaries are awkward |

### Answer shape
"Module Federation for the app shell + fragments, with a shared singleton for the framework, router, design system, and auth. Contract between shell and remotes is a small typed interface: mount(el, props), unmount, and an event bus."

### Cross-cutting concerns to name
- **Shared dependencies**: singletons with version ranges; a mismatched React copy breaks hooks.
- **Routing**: shell owns the top-level route; remotes own sub-routes and must not manipulate history directly.
- **Design consistency**: enforced by shared design tokens + component library version floor.
- **Performance budget per team**: measured in CI; a remote exceeding its budget fails the build. Without this, micro-frontends become a bundle-size tragedy.
- **Failure isolation**: wrap each remote in an error boundary + timeout; if a remote fails to load, render a graceful placeholder, not a white screen.
- **Observability**: tag every metric/error with the owning remote and its version.

### Honest tradeoff to state
Micro-frontends solve an *organizational* problem and cost you *performance and consistency*. Below ~5 teams, a monorepo with independent deploy pipelines is usually better.

---

## 36. Design an Embeddable Third-Party Widget

**Prompt:** A comments/chat/checkout widget that any customer can drop onto their site with one script tag.

### Requirements
Must not break the host page, must not be broken by the host page, must be secure, small, and updatable without customers changing code.

### Design
- **Loader script** (tiny, < 3KB, cached briefly) that creates an **iframe** and passes config via URL/`postMessage`. The heavy app lives inside the iframe on *your* origin.
- **Why iframe**: CSS and JS isolation both ways, its own origin for cookies/storage, and the host's CSP can't wreck you. Shadow DOM gives style isolation only — the host's global JS can still interfere.
- **Sizing**: the widget reports its content height via `postMessage`; the loader resizes the iframe. Debounce with `ResizeObserver`.
- **Communication contract**: strict `postMessage` protocol with `targetOrigin` set explicitly (never `'*'`), a versioned message schema, and origin validation on receive.
- **Auth**: never embed secrets in the snippet; use a public key + server-signed token; validate the referring origin server-side against the customer's allowlist.
- **Performance**: load the iframe lazily (on scroll into view or on click of a launcher button), `loading="lazy"`, and keep the launcher a pure-CSS button so it costs nothing.
- **Versioning**: `widget.js` is the stable entry (short cache), which pins an immutable versioned bundle (long cache). Gradual rollout by percentage with instant rollback.
- **Resilience**: everything wrapped in try/catch; a widget error must never surface as a host page error. Report errors to your own endpoint with the host domain tagged.

### Accessibility
The launcher must be a real focusable button with a label; opening moves focus into the iframe; Escape closes and restores focus. Announce unread counts politely.

---

## 37. Design an A/B Testing & Feature Flag Client SDK

### Requirements
Evaluate flags with near-zero latency, no flicker, consistent assignment, offline-safe, minimal bundle cost, and correct exposure logging.

### Design
- **Evaluate server-side where possible.** Injecting variant assignments into the SSR HTML kills the flicker problem outright.
- If client-side: fetch the flag payload **before first paint** (blocking, from an edge endpoint, < 50ms) or accept a controlled skeleton. Never render variant A and swap to B — that's the "flash of original content" everyone notices.
- **Bucketing**: `hash(userId + experimentKey) % 10000` → deterministic, sticky, and computable identically on client and server. Sticky by a stable id (logged-out users get a persistent anonymous id in a first-party cookie).
- **Caching**: keep the last known flag set in `localStorage` for instant startup; refresh in background. Include a version/etag.
- **Exposure events**: log when a flag is *actually used to render*, not when it's fetched — otherwise your analysis includes users who never saw the treatment.
- **Kill switch**: flags must be flippable without a deploy, with a short TTL/poll or SSE push for emergency changes.
- **Guardrails**: default value required at every call site so a fetch failure degrades to control.

### API shape
```ts
flags.get('new_checkout', { default: false });        // boolean flag
flags.variant('checkout_exp', { default: 'control' }); // multivariate
flags.onChange(cb);                                    // live updates
```

### Analysis hygiene to mention
Sample ratio mismatch checks, no peeking without sequential testing, minimum detectable effect and duration computed before launch.

---

## 38. Design a Frontend Error Monitoring SDK (Sentry-like)

### Capture surface
- `window.onerror` (and `error` event for resource failures), `unhandledrejection`, framework error boundaries, console.error hook (optional), failed network requests, CSP violation reports.

### Enrichment
Release version, environment, user id (hashed), session id, breadcrumbs (last N navigations, clicks, XHRs, console logs), device/network info, and the component stack.

### Hard problems to talk about
- **Source maps**: minified stacks are useless. Upload maps at build time to a private endpoint and symbolicate server-side; never serve maps publicly.
- **Grouping/fingerprinting**: group by normalized stack frames + error type, stripping URLs, query params, and dynamic ids, or you get a million "unique" issues.
- **Noise**: browser-extension errors, `ResizeObserver loop limit exceeded`, cross-origin `Script error.` (fix with `crossorigin` + CORS headers). Maintain a denylist.
- **Volume control**: client-side rate limiting (e.g. max 30 events/min/session), deduplication within a session, and server-side sampling.
- **Delivery**: batch and send with `sendBeacon` on `visibilitychange`; retry from a small IndexedDB buffer if offline. The SDK must never block the app or throw.
- **PII**: scrub request bodies, query strings, and DOM text from breadcrumbs by default; make redaction opt-out, not opt-in.
- **Size budget**: the SDK itself must be a few KB and load without delaying the app — it's the definition of an anti-pattern if your monitoring tool hurts your metrics.

---

## 39. Design an Offline-First App (Notion-like)

### Principle
The local database is the source of truth for the UI; the network is a background sync process. Every read hits local storage; every write goes to local storage plus an outbox.

### Architecture
```
UI ──reads──► Local store (IndexedDB, indexed by workspace/page)
UI ──writes─► Local store + Outbox
                    │
              Sync engine (service worker or shared worker)
                    ├ push: flush outbox with retries
                    └ pull: delta sync since <cursor>, merge
```

### Details
- **Service worker** with a Workbox-style strategy: cache-first for the app shell (precached, versioned), network-first for API GETs with a cache fallback, and Background Sync for queued mutations.
- **Merge strategy**: per-block CRDT or version-vector + field-level merge. Say which and why (see §11).
- **Storage limits**: track quota (`navigator.storage.estimate()`), evict least-recently-opened pages, request persistence for the current workspace.
- **UX honesty**: a clear connection indicator, per-item sync state (synced / syncing / conflict), and a conflict resolution UI rather than silent data loss.
- **Search offline**: maintain a local inverted index (built in a Worker) for pages that are cached.
- **Update flow**: service worker updates need an explicit "New version available — Reload" prompt; silently swapping assets mid-session breaks lazy chunk loading (a real production failure: old HTML requesting deleted chunk hashes → mitigate with long asset retention and chunk-load-error retry that forces reload).

---

## 40. Design a High-Frequency Ticker (Stock prices / Live scores)

**Prompt:** 500 symbols updating up to 20 times per second each.

### The real problem
10,000 updates/sec cannot become 10,000 React renders/sec. This question is about **decoupling the data rate from the render rate.**

### Design
1. **Transport**: WebSocket with a binary protocol (protobuf/flatbuffers or a compact typed-array frame) — JSON parsing alone would saturate the main thread.
2. **Decode in a Web Worker.** The worker maintains the authoritative price map and posts only *diffs* to the main thread, transferring `ArrayBuffer`s (zero-copy).
3. **Subscribe to visible symbols only.** As the virtualized table scrolls, send subscribe/unsubscribe deltas. Rendering 500 rows when 30 are visible is wasted bandwidth *and* CPU.
4. **Coalesce and flush on a frame budget**: buffer updates in a `Map<symbol, latestValue>` and flush once per `requestAnimationFrame` (or every 100–250ms for a human-readable ticker — humans can't read 60 price changes per second anyway).
5. **Bypass the framework for the hot path**: keep row components memoized and static; update the price text via a direct DOM write or a per-cell subscription store, so a price tick doesn't re-render the row tree.
6. **Flash animations** (green up / red down) via CSS classes with `transform`/`color` only, and honor `prefers-reduced-motion`.
7. **Backpressure**: if the buffer exceeds a threshold, drop intermediate values — only the latest price matters. Tell the server to reduce update frequency (server-side conflation) when the tab is hidden (`visibilitychange` → unsubscribe or throttle).

### Accessibility
Never put a rapidly changing region in `aria-live` — it will scream continuously. Provide a per-row "announce updates" opt-in, or announce a summary on demand.

---
---

# PART IV — RAPID-FIRE BANK & PREP PLAN

## 41. Thirty rapid-fire questions with condensed answers

1. **CSR vs SSR — when do you pick which?** SEO/first-paint-critical and personalized → SSR; behind auth and interaction-heavy → CSR with an app shell.
2. **Why is offset pagination wrong for feeds?** Inserts at the head shift indices, causing duplicated and skipped items. Use cursors.
3. **How do you prevent a stale response overwriting a fresh one?** Monotonic request ids + `AbortController`; drop non-latest responses.
4. **Debounce vs throttle?** Debounce fires after quiet (search input); throttle fires at a max rate (scroll, resize, cursor sync).
5. **How do you keep CLS at zero?** Reserve space: intrinsic dimensions or `aspect-ratio` on media, sized skeletons, no content injected above existing content, font fallback metric matching.
6. **How do you improve INP?** Break long tasks, yield to the main thread, move computation to Workers, reduce hydration cost, avoid synchronous layout in handlers.
7. **Where do you store an auth token?** `HttpOnly; Secure; SameSite` cookie. If JS must hold it, memory only, short-lived, with silent refresh.
8. **When is GraphQL the wrong choice?** Public, highly cacheable, read-heavy APIs; small teams; when HTTP caching and CDN edge caching matter more than round-trip count.
9. **How do you version a component library breaking change?** Deprecation warning → codemod → major bump → support window. Never silent visual breaks.
10. **How do you virtualize variable-height rows?** Estimate first, measure with `ResizeObserver`, keep cumulative offsets, correct scroll position after measurement.
11. **How do you avoid a scroll jump when prepending?** Capture `scrollHeight` before insert, restore `scrollTop + delta` before paint, or use CSS `overflow-anchor`.
12. **How do you make an optimistic update safe?** Temp ids, durable queue, per-entity ordering, idempotency keys, explicit rollback with retry UI.
13. **How do you test a design system?** Unit behavior, visual regression, axe a11y checks, and interaction tests in a real browser.
14. **How do you lazy-load without hurting LCP?** Never lazy-load above-the-fold media; use `fetchpriority` and preload the LCP element.
15. **How would you cut a 900KB bundle?** Measure first (bundle analyzer), route-split, drop moment/lodash-style heavyweights, dynamic-import heavy widgets, ship modern syntax, tree-shake icons.
16. **SSE vs WebSocket?** SSE if server→client only (simpler, auto-reconnect, HTTP/2). WS if the client also emits frequently.
17. **How do you handle multi-tab state?** `BroadcastChannel` for sync, leader election for a single socket, storage events as a fallback.
18. **How do you make a modal accessible?** `role="dialog" aria-modal`, focus moved in and trapped, Escape closes, focus restored, background inert, labelled by title.
19. **What breaks when you virtualize?** Ctrl+F, print, anchor links, screen-reader item counts. Mitigate with ARIA position attributes and an escape hatch.
20. **How do you handle images at scale?** Image CDN with per-breakpoint widths, AVIF/WebP, blurhash placeholders, `srcset`/`sizes`, lazy below fold.
21. **How do you prevent XSS in a rich text product?** Own the model, schema-validate on paste, sanitize on render, strict CSP with nonces, Trusted Types.
22. **How do you measure real user performance?** `web-vitals` → beacon on `visibilitychange`, sampled, tagged by release and segment, tracked at p75.
23. **Client-side vs server-side routing tradeoff?** Client routing gives instant transitions but risks stale chunks and larger bundles; server routing is simpler and more resilient.
24. **How do you handle a 500 from a partial widget?** Error boundary → localized fallback with retry; never let one widget blank the page.
25. **How do you sync scroll position across navigation?** Persist per-route `{scrollTop, cursors}` in history state; restore before paint after data hydration.
26. **How do you do i18n for a live app?** Lazy-load locale bundles, ICU messages, `Intl` for formatting, logical CSS for RTL, pseudo-localization in CI to catch truncation.
27. **How do you rate-limit client requests?** Debounce/throttle at source, dedupe in-flight, backoff on 429 honoring `Retry-After`, and a client token bucket for bursty actions.
28. **How do you decide canvas vs DOM?** DOM up to a few thousand nodes with rich interaction; canvas beyond that or for continuous animation; always add an accessible parallel representation.
29. **What's your caching layer strategy?** Memory (session) → IndexedDB (durable) → HTTP/CDN (`stale-while-revalidate`) → server. Define TTL and invalidation per entity type.
30. **How do you roll out a risky frontend change?** Flag it, canary by percentage, watch error rate + Core Web Vitals + a business metric, auto-rollback thresholds, and a kill switch that needs no deploy.

## 42. Cheat sheets

**Numbers worth memorizing**
- LCP ≤ 2.5s · INP ≤ 200ms · CLS ≤ 0.1 (good, at p75)
- JS budget for the critical path: ~170KB gzipped
- 60fps = 16.7ms per frame; a task over 50ms is "long"
- `localStorage`/`sessionStorage` ≈ 5MB; cookies ≈ 4KB; IndexedDB = quota-based
- Typical typeahead debounce: 150–250ms; page size for feeds: 10–20; for grids: 100–200

**The universal deep-dive checklist**
Loading states · empty states · error + retry · offline · slow network · large datasets · concurrency/races · accessibility · i18n/RTL · security · analytics · testing · rollout.

**Sentence templates that score**
- "I'd choose X over Y because ___; the cost is ___, which I'd mitigate with ___."
- "The failure mode here is ___, so I'd ___."
- "Let me quantify that: at N items and M bytes each, the payload is ___, so ___."
- "I'm descoping ___ for now; if we have time I'd come back to it."

## 43. A four-week preparation plan

**Week 1 — Fundamentals.** Read Part II end to end. Implement from scratch: a debounce/throttle, an LRU cache, a fetch wrapper with retry/dedupe/abort, a fixed-height virtual list.

**Week 2 — Components.** Build (with full a11y) an accessible autocomplete, a modal with focus trap, a toast system, and a virtualized variable-height list. Test each with keyboard only and a screen reader.

**Week 3 — Systems.** Work Questions 17–27 on a whiteboard, 45 minutes each, out loud, timed. Record yourself once; the pacing problems will be obvious.

**Week 4 — Depth and polish.** Work Questions 28–40, then do 3–4 mock interviews with a peer. Focus the last week on the follow-up questions — that's where most rounds are actually decided.

## 44. Self-scoring rubric

Score yourself 1–4 on each after every practice run.

| Dimension | 1 (weak) | 4 (strong) |
|---|---|---|
| Scoping | Started designing immediately | Wrote requirements, named descoped items and scale numbers |
| Architecture | Vague boxes | Clear modules, boundaries, data flow, component tree |
| Data & API | Hand-waved shapes | Concrete types, pagination style, error contract |
| Depth | Broad and shallow | Three levels deep in at least two areas |
| Tradeoffs | Asserted choices | Named alternatives with reasons and costs |
| Failure states | Happy path only | Loading, empty, error, offline, slow, concurrent |
| Accessibility | Not mentioned | Specific patterns, keyboard, ARIA, live regions |
| Communication | Rambling, unstructured | Signposted, paced, responsive to steering |

**Passing bar for senior:** no 1s, at least three 4s, including one in Depth or Tradeoffs.

---

*End of ebook.*
