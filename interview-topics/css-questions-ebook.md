# The CSS Question Book

**A fully explained Q&A guide — from the cascade and box model to modern layout, architecture, and performance.**

---

## How to use this book

Every question follows the same shape:

- **Short answer** — what you'd say in one or two sentences.
- **Explanation** — why it works that way.
- **Code** — a runnable illustration where it helps.
- **Watch out** — the trap, the follow-up question, or the mistake people make.

Read it front-to-back once, then use the section index to drill weak areas. Most CSS interview questions come down to one of three things: **the cascade** (which rule wins), **the box** (how big things are), and **formatting contexts** (how things are laid out relative to each other).

### Contents

1. Fundamentals — cascade, specificity, inheritance, box model, units
2. Layout — flexbox, grid, positioning, stacking
3. Responsive design
4. Modern CSS — selectors, custom properties, layers, nesting, color
5. Architecture and tooling
6. Animation and motion
7. Rendering and performance
8. Accessibility and theming
9. Rapid-fire and "why doesn't this work?"

---

# Part 1 — Fundamentals

## Q1. How does the cascade decide which rule wins?

**Short answer.** When several declarations target the same property on the same element, the browser compares them in order: origin and importance, then context (shadow DOM), then style attribute, then cascade layer, then specificity, then source order. The first criterion that differs decides.

**Explanation.**

| Step | Rule |
|---|---|
| 1. Origin & importance | User-agent < user < author for normal declarations; `!important` reverses the order |
| 2. Context | Shadow DOM encapsulation |
| 3. Element-attached | Inline `style=""` beats selectors |
| 4. Layers | Later `@layer` beats earlier; unlayered styles beat all layers |
| 5. Specificity | Higher specificity wins |
| 6. Order of appearance | Later declaration wins |

```css
@layer base, components;
@layer components { .btn { color: blue; } }
@layer base { #main .btn { color: red; } }   /* higher specificity, but earlier layer — loses */
```

**Watch out.** Layers are checked *before* specificity. That's the whole point of `@layer`: a low-specificity rule in a later layer beats a high-specificity rule in an earlier one. Many people still answer "specificity first".

---

## Q2. How is specificity calculated?

**Short answer.** As a three-part score (A, B, C): A = ID selectors, B = classes, attributes, and pseudo-classes, C = type selectors and pseudo-elements. Compare A first, then B, then C. The universal selector and combinators add nothing.

**Explanation.**

| Selector | (A, B, C) |
|---|---|
| `p` | (0, 0, 1) |
| `.card p` | (0, 1, 1) |
| `#nav .item:hover` | (1, 2, 0) |
| `ul li a::before` | (0, 0, 4) |
| `:is(#id, .cls) p` | (1, 0, 1) — takes the most specific argument |
| `:where(#id, .cls) p` | (0, 0, 1) — `:where()` is always zero |
| `:not(.hidden)` | (0, 1, 0) — takes its argument's specificity |

Scores don't overflow: `(0, 11, 0)` never beats `(1, 0, 0)` — eleven classes lose to one ID.

**Watch out.** `!important` is not part of specificity — it's a different step in the cascade. Fighting specificity with `!important` starts an arms race; fix it with layers or `:where()` instead.

---

## Q3. What is inheritance, and which properties inherit?

**Short answer.** Some properties pass their computed value from parent to child automatically — mostly text-related ones (`color`, `font-*`, `line-height`, `text-align`, `visibility`, `cursor`). Box-related ones (`margin`, `padding`, `border`, `background`, `width`, `display`) don't.

**Explanation.** You can control it explicitly with global keywords:

| Keyword | Effect |
|---|---|
| `inherit` | Take the parent's computed value |
| `initial` | Use the property's spec-defined initial value |
| `unset` | `inherit` if the property inherits, else `initial` |
| `revert` | Roll back to the user-agent (browser) style |
| `revert-layer` | Roll back to the previous cascade layer |

```css
button { font: inherit; color: inherit; }   /* form controls don't inherit fonts by default */
```

**Watch out.** `initial` is often not what people expect: `display: initial` is `inline`, even on a `<div>`. To undo your own styles, `revert` is usually the right keyword.

---

## Q4. Explain the box model and `box-sizing`.

**Short answer.** Every element is a box of content, padding, border, and margin. With the default `box-sizing: content-box`, `width` sets only the content, so padding and border add to it. With `border-box`, `width` includes padding and border.

**Explanation.**

```css
.a { box-sizing: content-box; width: 200px; padding: 20px; border: 5px solid; }  /* renders 250px wide */
.b { box-sizing: border-box;  width: 200px; padding: 20px; border: 5px solid; }  /* renders 200px wide */
```

Most projects reset it globally:

```css
*, *::before, *::after { box-sizing: border-box; }
```

**Watch out.** Margin is never included in the box size under either model — it's space *outside* the border. And `outline` and `box-shadow` don't take up space at all.

---

## Q5. What is margin collapsing?

**Short answer.** Vertical margins between block elements in normal flow combine into a single margin equal to the largest of them, instead of adding up. It also happens between a parent and its first/last child when nothing separates them.

**Explanation.**

```css
h2 { margin-bottom: 24px; }
p  { margin-top: 16px; }      /* gap between them is 24px, not 40px */
```

Parent–child collapse:

```css
.card { background: #eee; }
.card h2 { margin-top: 32px; }   /* the margin "leaks" out above .card */
```

Margins don't collapse when the parent has padding or border, creates a new block formatting context (`display: flow-root`, `overflow` other than `visible`), or is a flex/grid container.

**Watch out.** Margins never collapse inside flex or grid layouts, and never horizontally. Many teams sidestep the whole topic by using `gap` on flex/grid containers or by only setting margins in one direction (e.g. only `margin-block-end`).

---

## Q6. Which CSS units should you use, and when?

**Short answer.** `rem` for font sizes and most spacing (respects user font settings), `em` for things that should scale with the element's own font size, `%` and `fr` for fluid layout, viewport units for full-screen sections, `ch` for text measure, and `px` for borders and fine details.

**Explanation.**

| Unit | Relative to |
|---|---|
| `px` | CSS pixel (not a device pixel) |
| `rem` | Root (`<html>`) font size |
| `em` | The element's font size (parent's, for `font-size` itself) |
| `%` | Parent's dimension (varies by property) |
| `vw` / `vh` | 1% of viewport width / height |
| `svh` / `lvh` / `dvh` | Small / large / dynamic viewport height (mobile toolbars) |
| `ch` | Width of the "0" glyph |
| `cqi` / `cqb` | 1% of the container's inline / block size |
| `fr` | A share of free space in a grid |

```css
article { max-width: 65ch; }               /* readable line length */
.hero { min-height: 100dvh; }              /* not 100vh — see the trap below */
```

**Watch out.** `100vh` on mobile is the height with the browser toolbar *hidden*, so content is cut off when it's visible. Use `100dvh` (changes as the toolbar moves) or `100svh` (always the smallest). Also, setting `html { font-size: 62.5% }` to make `1rem = 10px` breaks for users who changed their default font size.

---

## Q7. What do the main `display` values do?

**Short answer.** `display` sets two things: the *outer* type (how the box participates in its parent's layout — block or inline) and the *inner* type (how it lays out its children — flow, flex, grid, table). `none` removes the box entirely; `contents` removes the box but keeps its children.

**Explanation.**

| Value | Outer / inner |
|---|---|
| `block` | block / flow |
| `inline` | inline / flow — ignores `width`, `height`, vertical margins |
| `inline-block` | inline / flow-root — respects width and height |
| `flex` / `inline-flex` | block or inline / flex |
| `grid` / `inline-grid` | block or inline / grid |
| `flow-root` | block / new block formatting context |
| `contents` | no box; children promoted |
| `none` | not rendered, not in accessibility tree |

The two-value syntax makes this explicit: `display: inline flex`.

**Watch out.** `display: contents` used to remove the element's semantics in some browsers (a `<button>` or `<ul>` lost its role). Don't use it on interactive or semantic elements without testing with a screen reader.

---

## Q8. What is a block formatting context (BFC), and why does it matter?

**Short answer.** A BFC is an isolated layout region where floats are contained, margins don't collapse through the boundary, and the region doesn't overlap neighboring floats. `display: flow-root` creates one explicitly.

**Explanation.** Classic problem — a parent with only floated children has zero height:

```css
.parent { display: flow-root; }   /* now contains its floats — no clearfix hack */
```

Also created by: `overflow` other than `visible`/`clip`, `float`, `position: absolute/fixed`, `display: inline-block`, flex and grid items, `contain: layout`.

**Watch out.** The old fix, `overflow: hidden`, works but clips shadows and dropdowns. `flow-root` has no side effects.

---

# Part 2 — Layout

## Q9. Explain flexbox in one minute.

**Short answer.** Flexbox lays out items along one axis — a row or a column. The container controls direction, wrapping, alignment, and gaps; items control how they grow, shrink, and their starting size.

**Explanation.**

```css
.toolbar {
  display: flex;
  flex-direction: row;         /* main axis */
  justify-content: space-between;  /* along the main axis */
  align-items: center;         /* along the cross axis */
  gap: 0.5rem;
  flex-wrap: wrap;
}
.toolbar .search { flex: 1; }  /* take the remaining space */
```

| Container | Item |
|---|---|
| `flex-direction`, `flex-wrap` | `flex-grow`, `flex-shrink`, `flex-basis` |
| `justify-content` (main axis) | `align-self` |
| `align-items`, `align-content` (cross axis) | `order` |
| `gap` | `margin: auto` (pushes items apart) |

**Watch out.** `justify-*` and `align-*` swap meaning when `flex-direction` is `column` — "justify" always means the main axis. Also, `order` changes only visual order, not tab order or reading order, which can confuse keyboard and screen-reader users.

---

## Q10. What's the difference between `flex: 1`, `flex: auto`, and `flex: none`?

**Short answer.** They're shorthands for `flex-grow flex-shrink flex-basis`. `flex: 1` (`1 1 0%`) splits space equally regardless of content. `flex: auto` (`1 1 auto`) grows and shrinks from the content's size, so bigger content gets more space. `flex: none` (`0 0 auto`) is fixed at content size.

**Explanation.**

```css
.equal > * { flex: 1; }    /* three columns of identical width */
.fit > *   { flex: auto; } /* widths proportional to content */
.icon      { flex: none; } /* never shrinks */
```

**Watch out.** The famous overflow bug: a flex item's default `min-width` is `auto`, which means it refuses to shrink below its content width. A long URL or a `<pre>` inside a flex item breaks the layout. Fix it with `min-width: 0` (or `overflow: hidden`) on the item.

---

## Q11. Explain CSS Grid in one minute.

**Short answer.** Grid lays out items in two dimensions — rows and columns at the same time. You define tracks on the container, then place items onto lines or named areas, or let auto-placement fill cells.

**Explanation.**

```css
.page {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  gap: 1rem;
  min-height: 100dvh;
}
header  { grid-area: header; }
aside   { grid-area: sidebar; }
main    { grid-area: main; }
footer  { grid-area: footer; }
```

Useful functions: `repeat()`, `minmax()`, `fit-content()`, and the `fr` unit for shares of free space.

**Watch out.** `1fr` is really `minmax(auto, 1fr)` — a column won't shrink below its content's minimum width, so a long word can blow out the track. Use `minmax(0, 1fr)` when columns must stay equal.

---

## Q12. Flexbox or grid — how do you choose?

**Short answer.** Flexbox is content-out: items decide their size and the layout flows along one axis. Grid is layout-in: the container defines the structure and items are placed into it. Use flex for components in a line (toolbars, button groups, nav); use grid for page layouts and anything that must align in both directions (card galleries, forms, dashboards).

**Explanation.**

| Need | Pick |
|---|---|
| Items in a row that wrap naturally | Flex |
| Push one item to the end | Flex (`margin-left: auto`) |
| Columns that must line up across rows | Grid |
| Overlapping items | Grid (same cell) |
| Equal-width responsive cards | Grid (`auto-fit` + `minmax`) |

They nest freely — a grid page whose cells contain flex components is normal.

**Watch out.** A wrapped flex row can't align its items with the row above — the last row of cards ends up wider. If items must align in columns, that's a grid problem.

---

## Q13. How do you center something?

**Short answer.** Horizontally and vertically: `display: grid; place-items: center` on the parent, or flex with `justify-content` and `align-items`. For a block element horizontally only: `margin-inline: auto` with a set width.

**Explanation.**

```css
.center-grid { display: grid; place-items: center; }

.center-flex { display: flex; justify-content: center; align-items: center; }

.center-block { width: min(100% - 2rem, 60rem); margin-inline: auto; }

.center-abs {
  position: absolute; inset: 0; margin: auto;
  width: fit-content; height: fit-content;
}

/* Now works in normal block layout too */
.center-block-align { align-content: center; }
```

**Watch out.** `text-align: center` centers *inline content* inside a box, not the box itself. And `vertical-align` only works on inline and table-cell elements — it never centers a block.

---

## Q14. Explain the `position` values.

**Short answer.** `static` is normal flow. `relative` keeps the element in flow but lets you offset it, and makes it the containing block for absolute children. `absolute` removes it from flow and positions it relative to the nearest positioned ancestor. `fixed` positions relative to the viewport. `sticky` acts like relative until a scroll threshold, then sticks.

**Explanation.**

```css
.card { position: relative; }
.card .badge { position: absolute; top: 0.5rem; right: 0.5rem; }

.site-header { position: sticky; top: 0; }

.toast { position: fixed; inset: auto 1rem 1rem auto; }
```

**Watch out.** `fixed` is not always relative to the viewport: an ancestor with `transform`, `filter`, `perspective`, `contain: paint`, or `will-change: transform` becomes its containing block. A modal with `position: fixed` inside an animated container ends up in the wrong place — render modals at the top level or use `<dialog>`.

---

## Q15. Why isn't `position: sticky` working?

**Short answer.** Usually one of four reasons: no threshold (`top`, `bottom`, etc.) is set, an ancestor has `overflow: hidden/auto/scroll` and becomes the scroll container, the parent is no taller than the sticky element so it has nowhere to stick, or a flex/grid parent stretches the element to full height.

**Explanation.**

```css
.sidebar { position: sticky; top: 1rem; align-self: start; }  /* align-self fixes the grid/flex stretch case */
```

Debug by walking up the ancestors in DevTools and checking `overflow` on each one.

**Watch out.** `overflow: hidden` added to a wrapper "to fix a horizontal scrollbar" silently breaks every sticky element inside it. `overflow: clip` hides overflow without creating a scroll container, so sticky keeps working.

---

## Q16. How does `z-index` work, and what is a stacking context?

**Short answer.** `z-index` orders elements along the z-axis, but only *within the same stacking context*. A stacking context is a group that's flattened and stacked as one unit — a child can never escape above something its parent's context sits beneath, no matter how high its `z-index`.

**Explanation.** Things that create a stacking context:

- The root element
- `position` relative/absolute with a `z-index` other than `auto`; `fixed` and `sticky` always
- Flex or grid items with a `z-index`
- `opacity` below 1
- `transform`, `filter`, `backdrop-filter`, `perspective`, `clip-path`, `mask`
- `isolation: isolate`
- `will-change` on any of the above, `contain: paint`

```html
<div class="a" style="position: relative; z-index: 1">
  <div style="position: relative; z-index: 9999">I can't go above .b</div>
</div>
<div class="b" style="position: relative; z-index: 2"></div>
```

**Watch out.** "`z-index: 9999` doesn't work" is almost always a stacking-context problem, not a z-index value problem. The fix is to change the *parent's* context. For dropdowns, modals, and tooltips, the top layer (`<dialog>`, `popover`) sidesteps z-index entirely.

---

## Q17. What is subgrid?

**Short answer.** `grid-template-columns: subgrid` (or rows) lets a nested grid use its parent grid's tracks, so content in separate child components lines up across them.

**Explanation.** Classic case: cards in a row whose titles, bodies, and buttons should align even though each card has different content.

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
}
.card {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;   /* title / body / footer rows shared across the row of cards */
}
```

**Watch out.** A subgrid inherits the parent's tracks, so it can't define its own in that dimension. It also inherits `gap` unless you override it.

---

## Q18. What are floats still used for?

**Short answer.** Wrapping text around an element — images in articles, drop caps, pull quotes. They're no longer used for page layout; flexbox and grid replaced that.

**Explanation.**

```css
.article img.left { float: left; margin: 0 1rem 1rem 0; shape-outside: circle(); }
.article::after { content: ""; display: block; clear: both; }  /* or display: flow-root on .article */
```

`shape-outside` lets text wrap around non-rectangular shapes.

**Watch out.** Floats ignore `display` on flex and grid items — `float` has no effect on a flex child. If someone's float "doesn't work", check the parent's display.

---

# Part 3 — Responsive Design

## Q19. Mobile-first vs desktop-first media queries

**Short answer.** Mobile-first writes base styles for small screens and adds complexity with `min-width` queries. Desktop-first does the reverse with `max-width`. Mobile-first is preferred: small screens get less CSS to override, and layouts tend to simplify naturally.

**Explanation.**

```css
.grid { display: grid; gap: 1rem; }

@media (width >= 48rem) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (width >= 75rem) {
  .grid { grid-template-columns: repeat(4, 1fr); }
}
```

The range syntax (`width >= 48rem`) is clearer than `min-width` and avoids off-by-one gaps between `max-width: 767px` and `min-width: 768px`.

**Watch out.** Breakpoints should come from where *your content* breaks, not from specific device sizes. Using `em`/`rem` in media queries makes them respect browser zoom and font settings.

---

## Q20. What are container queries, and how are they different from media queries?

**Short answer.** Media queries respond to the viewport. Container queries respond to the size of a parent container, so a component adapts to the space it's actually given — the same card works in a sidebar and in a wide main column.

**Explanation.**

```css
.card-wrapper { container-type: inline-size; container-name: card; }

.card { display: grid; gap: 1rem; }

@container card (width >= 30rem) {
  .card { grid-template-columns: 10rem 1fr; }   /* image beside text when there's room */
}

.card h2 { font-size: clamp(1rem, 4cqi, 1.5rem); }  /* container query units */
```

Style queries check custom property values on the container: `@container style(--variant: compact) { … }`.

**Watch out.** An element can't query itself — it queries its nearest container ancestor. And `container-type: inline-size` applies size containment on the inline axis, so the container's width must come from its parent, not from its content.

---

## Q21. How do `clamp()`, `min()`, and `max()` help responsive design?

**Short answer.** They compute values from several options, so sizes adapt fluidly without breakpoints. `clamp(min, preferred, max)` is the most common — e.g. fluid typography that scales with the viewport but never gets too small or too large.

**Explanation.**

```css
h1 { font-size: clamp(1.75rem, 1rem + 3vw, 3rem); }
.container { width: min(100% - 2rem, 70rem); margin-inline: auto; }
.sidebar { width: max(15rem, 25%); }
.section { padding-block: clamp(2rem, 6vw, 6rem); }
```

**Watch out.** Font sizes using only `vw` (`font-size: 4vw`) don't grow when users zoom, which fails WCAG resize-text requirements. Always mix in `rem` (`1rem + 3vw`), as above.

---

## Q22. How do you build a responsive grid without media queries?

**Short answer.** `repeat(auto-fit, minmax(MIN, 1fr))` creates as many columns as fit, each at least `MIN` wide, stretching to fill the row.

**Explanation.**

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
```

`auto-fill` vs `auto-fit`: `auto-fill` keeps empty tracks when there are few items (items stay at their minimum width); `auto-fit` collapses empty tracks so the existing items stretch.

**Watch out.** Without the inner `min(16rem, 100%)`, a container narrower than `16rem` overflows horizontally. That guard is what makes the pattern safe on small screens.

---

## Q23. What are logical properties?

**Short answer.** Properties defined relative to writing direction instead of physical sides: `inline` (the text direction) and `block` (the line-stacking direction), with `start` and `end`. Layouts then flip automatically for right-to-left languages and vertical writing modes.

**Explanation.**

| Physical | Logical |
|---|---|
| `margin-left` | `margin-inline-start` |
| `padding-top` / `padding-bottom` | `padding-block` |
| `width` / `height` | `inline-size` / `block-size` |
| `left` | `inset-inline-start` |
| `text-align: left` | `text-align: start` |
| `border-top-left-radius` | `border-start-start-radius` |

```css
.callout { padding-inline: 1rem; border-inline-start: 4px solid; margin-block-end: 1.5rem; }
```

**Watch out.** Physical properties aren't wrong — use them when the direction is truly physical (a shadow that always falls down, an arrow pointing right regardless of language). Use logical ones for anything that follows the text.

---

## Q24. How do `aspect-ratio` and `object-fit` work?

**Short answer.** `aspect-ratio` gives a box a preferred width-to-height ratio, so its height is derived from its width. `object-fit` controls how an image or video fills its box — `cover` crops to fill, `contain` letterboxes.

**Explanation.**

```css
.thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  object-position: center top;   /* keep faces in view when cropping */
}

.video-embed { aspect-ratio: 16 / 9; width: 100%; }   /* replaces the old padding-top: 56.25% hack */
```

**Watch out.** `aspect-ratio` is a *preferred* ratio. Content taller than the box overrides it unless you also set `overflow` or `min-height: 0`.

---

# Part 4 — Modern CSS

## Q25. What do `:is()`, `:where()`, and `:has()` do?

**Short answer.** `:is()` and `:where()` match any selector in a list — they shorten repetitive selectors. They differ only in specificity: `:is()` takes the highest argument's, `:where()` is always zero. `:has()` is the "parent selector": it matches an element based on what it contains or what follows it.

**Explanation.**

```css
/* Shorter selectors */
:is(h1, h2, h3):hover { text-decoration: underline; }

/* Zero-specificity defaults that are trivial to override */
:where(ul, ol)[role="list"] { list-style: none; padding: 0; }

/* Parent selector */
.card:has(img) { grid-template-rows: 12rem auto; }
form:has(:user-invalid) .submit { opacity: 0.5; }
label:has(+ input:required)::after { content: " *"; }

/* Quantity query */
.list:has(> :nth-child(6)) { columns: 2; }
```

**Watch out.** `:has()` can be expensive when the subject is broad (`body:has(...)`, `*:has(...)`), because changes deep in the tree must re-check ancestors. Anchor it to a specific component class. Also, an invalid selector inside `:is()`/`:where()` is ignored instead of invalidating the whole rule — which is useful, but hides typos.

---

## Q26. Pseudo-classes vs pseudo-elements

**Short answer.** A pseudo-class (single colon) selects an element in a particular *state* — `:hover`, `:focus-visible`, `:checked`, `:nth-child()`. A pseudo-element (double colon) targets a *part* of an element or creates a virtual one — `::before`, `::after`, `::placeholder`, `::marker`, `::selection`.

**Explanation.**

```css
li:nth-child(odd) { background: var(--stripe); }
input:focus-visible { outline: 2px solid var(--focus); }

.required::after { content: " *"; color: var(--danger); }
li::marker { color: var(--accent); }
::selection { background: var(--highlight); }
```

`::before` and `::after` require `content` (even `content: ""`) to render.

**Watch out.** Generated `content` text is read by most screen readers but can't be selected or copied, and isn't translated reliably. Don't put meaningful text in pseudo-elements. Also, `::before`/`::after` don't work on void elements like `<img>` and `<input>`.

---

## Q27. CSS custom properties vs Sass variables

**Short answer.** Sass variables are replaced at build time — they're gone by the time CSS reaches the browser. Custom properties (`--name`) are live in the browser: they cascade, inherit, can be changed per element, overridden in media queries, and updated from JavaScript.

**Explanation.**

```css
:root {
  --space-md: 1rem;
  --color-accent: oklch(62% 0.19 255);
}

.button {
  --button-bg: var(--color-accent);
  background: var(--button-bg);
  padding: var(--space-md, 1rem);    /* fallback */
}
.button.danger { --button-bg: crimson; }     /* override per component */

@media (width >= 60rem) { :root { --space-md: 1.5rem; } }
```

```js
el.style.setProperty('--progress', '42%');
```

**Watch out.** A custom property with an invalid value doesn't fall back to the previous declaration — it makes the property "invalid at computed-value time", which resolves to `inherit` or `initial`. `color: var(--size)` where `--size: 20px` silently gives you the inherited color.

---

## Q28. What is `@property`?

**Short answer.** It registers a custom property with a type, an initial value, and whether it inherits. Typed custom properties can be animated and transitioned — untyped ones just flip between values.

**Explanation.**

```css
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.spinner-border {
  background: conic-gradient(from var(--angle), var(--accent), transparent);
  animation: spin 2s linear infinite;
}
@keyframes spin { to { --angle: 360deg; } }
```

**Watch out.** Without registration, the browser doesn't know `--angle` is an angle, so it can't interpolate — the gradient jumps instead of rotating. Registration also gives you type validation: a bad value falls back to `initial-value`.

---

## Q29. What are cascade layers (`@layer`)?

**Short answer.** Layers let you group styles and set their priority explicitly, independent of specificity. Later layers win over earlier ones; unlayered styles win over all layers. They solve "third-party CSS beats mine" and specificity wars.

**Explanation.**

```css
@layer reset, base, vendor, components, utilities;

@import url("bootstrap.css") layer(vendor);

@layer reset      { *, *::before, *::after { box-sizing: border-box; } }
@layer base       { a { color: var(--link); } }
@layer components { .btn { padding: 0.5rem 1rem; } }
@layer utilities  { .mt-0 { margin-top: 0; } }   /* always wins over components, whatever the specificity */
```

**Watch out.** `!important` reverses layer order: an `!important` declaration in an *earlier* layer beats one in a later layer. That's intentional — it lets resets and base layers protect critical rules — but it surprises people.

---

## Q30. What is native CSS nesting?

**Short answer.** Writing child rules inside a parent rule, as in Sass, but natively in the browser. `&` refers to the parent selector.

**Explanation.**

```css
.card {
  padding: 1rem;

  & h2 { font-size: 1.25rem; }
  &:hover { box-shadow: var(--shadow-lg); }
  &.featured { border-color: var(--accent); }

  @media (width >= 48rem) {
    padding: 2rem;
  }
}
```

**Watch out.** Native nesting is *not* string concatenation like Sass: `&__title` (BEM-style suffixing) doesn't work. Nested selectors are also wrapped in `:is()`, so specificity follows `:is()` rules — `.a, #b { & .c {} }` gives `.c` the specificity of the ID.

---

## Q31. What is `@scope`?

**Short answer.** It limits styles to a DOM subtree, with an optional lower boundary, without increasing specificity. Rules inside also get *proximity*: when two scopes match, the closer scope root wins.

**Explanation.**

```css
@scope (.card) to (.card-content) {
  img { border-radius: 8px; }   /* images in the card, but not inside its slotted content area */
}

@scope (.theme-dark) { a { color: lightblue; } }
@scope (.theme-light) { a { color: navy; } }
/* A link inside light-inside-dark gets navy — the nearest scope wins */
```

**Watch out.** Proximity is checked *after* specificity, so a more specific selector from a farther scope still wins. Keep selectors inside scopes simple.

---

## Q32. What's new with color in CSS?

**Short answer.** Wide-gamut and perceptual color spaces (`oklch()`, `oklab()`, `display-p3`), `color-mix()` for mixing colors, relative color syntax for deriving variants, and `light-dark()` for theme-aware values.

**Explanation.**

```css
:root {
  --brand: oklch(60% 0.2 260);
  --brand-hover: oklch(from var(--brand) calc(l - 10%) c h);      /* relative color: 10% darker */
  --brand-subtle: color-mix(in oklch, var(--brand) 15%, white);   /* tint */
  color-scheme: light dark;
  --surface: light-dark(white, #111);
}
```

OKLCH is popular for design systems because equal changes in lightness *look* equally different, unlike HSL, where yellow at 50% lightness looks far brighter than blue at 50%.

**Watch out.** `light-dark()` only works when `color-scheme` is set to include both `light` and `dark`.

---

## Q33. What are anchor positioning and `field-sizing`?

**Short answer.** Anchor positioning tethers one element (a tooltip, menu, popover) to another without JavaScript, including fallback positions when there's no room. `field-sizing: content` makes inputs and textareas grow with their content.

**Explanation.**

```css
.trigger { anchor-name: --menu-anchor; }

.menu {
  position: absolute;
  position-anchor: --menu-anchor;
  position-area: block-end span-inline-end;   /* below, aligned to the start */
  position-try-fallbacks: flip-block;          /* flip above if no room below */
}

textarea { field-sizing: content; min-block-size: 3lh; max-block-size: 12lh; }
```

**Watch out.** Check current browser support before relying on newer features in production, and provide a sensible fallback (e.g. a fixed position) using `@supports`.

---

## Q34. What does `@supports` do?

**Short answer.** It applies styles only if the browser supports a property-value pair or selector. It's the way to use new features with a fallback.

**Explanation.**

```css
.layout { display: flex; flex-wrap: wrap; }

@supports (display: grid) {
  .layout { display: grid; grid-template-columns: repeat(3, 1fr); }
}

@supports selector(:has(a)) {
  .card:has(a:hover) { outline: 2px solid; }
}
```

**Watch out.** Unsupported declarations are already ignored, so a simple fallback is often just two declarations in a row: `width: 100vh; width: 100dvh;`. Reach for `@supports` when the fallback needs several properties to change together.

---

# Part 5 — Architecture and Tooling

## Q35. How do you organize CSS in a large project?

**Short answer.** Pick a strategy that controls scope and specificity: a naming methodology (BEM), scoped styles (CSS Modules, Shadow DOM, `@scope`), utility classes (Tailwind), or CSS-in-JS. Combine it with design tokens and cascade layers.

**Explanation.**

| Approach | How it avoids collisions | Trade-off |
|---|---|---|
| BEM | Naming convention (`.card__title--large`) | Discipline-dependent, verbose names |
| CSS Modules | Build tool hashes class names per file | Needs a bundler |
| Utility-first (Tailwind) | Tiny single-purpose classes in markup | Long class lists; design constraints are a feature |
| CSS-in-JS (runtime) | Generated class names from JS | Runtime cost, problems with Server Components |
| Zero-runtime CSS-in-JS | Extracted at build time | Build complexity |

Most mature systems layer: tokens as custom properties → reset/base → component styles → utilities.

**Watch out.** Runtime CSS-in-JS libraries (styled-components, Emotion) inject styles during render, which conflicts with React Server Components and streaming. Many teams have moved to CSS Modules, Tailwind, or zero-runtime solutions for that reason.

---

## Q36. What is BEM?

**Short answer.** Block, Element, Modifier — a naming convention: `.block`, `.block__element`, `.block--modifier`. Every selector is a single class, so specificity stays flat and names describe structure.

**Explanation.**

```html
<article class="card card--featured">
  <h2 class="card__title">…</h2>
  <p class="card__body">…</p>
</article>
```

```css
.card { … }
.card--featured { border-color: var(--accent); }
.card__title { … }
```

**Watch out.** Don't nest element names: `.card__body__link` mirrors the DOM and breaks when markup changes. Use `.card__link`. And BEM doesn't help with styles that leak *in* from elsewhere — a reset layer and `:where()` defaults handle that.

---

## Q37. What are the pros and cons of utility-first CSS (Tailwind)?

**Short answer.** Pros: no naming, no dead CSS growth, styles live next to markup, a constrained design scale, tiny production CSS. Cons: long class strings, a learning curve for the vocabulary, and repeated class lists unless you extract components.

**Explanation.**

```html
<button class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline-2">
  Save
</button>
```

The duplication problem is solved at the component level (a `<Button>` component), not by inventing CSS classes.

**Watch out.** Building class names dynamically (`` `bg-${color}-600` ``) breaks — the build scans source files for complete class names, so the class never gets generated. Map to full class names instead.

---

## Q38. Reset vs normalize — what's the difference?

**Short answer.** A reset strips browser default styles to a blank slate. Normalize keeps useful defaults and only fixes inconsistencies between browsers. Modern projects use a small "modern reset" that does a bit of both.

**Explanation.**

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: none; text-size-adjust: none; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
p, h1, h2, h3 { overflow-wrap: break-word; }
```

**Watch out.** Don't reset `outline` on focus or `list-style` on every list. Removing list styles also removes list semantics in Safari unless the list has `role="list"`.

---

## Q39. What are design tokens, and how do you implement them in CSS?

**Short answer.** Named design decisions — colors, spacing, type scale, radii, shadows — stored in one place and consumed everywhere. In CSS they're usually custom properties, often in two tiers: primitive tokens (raw values) and semantic tokens (what they're used for).

**Explanation.**

```css
:root {
  /* primitives */
  --blue-600: oklch(55% 0.2 260);
  --gray-50: oklch(98% 0 0);
  --space-4: 1rem;

  /* semantic */
  --color-action: var(--blue-600);
  --color-surface: var(--gray-50);
  --space-inset: var(--space-4);
}

[data-theme="dark"] {
  --color-surface: oklch(18% 0 0);
}
```

Components use only semantic tokens, so theming means changing a handful of variables.

**Watch out.** If components reference primitive tokens directly (`--blue-600`), dark mode and rebranding require editing every component. The semantic layer is what makes tokens worth having.

---

# Part 6 — Animation and Motion

## Q40. Transitions vs animations

**Short answer.** A transition animates a property between two states when its value changes (on hover, class toggle). An animation runs keyframes on its own, can loop, have many steps, and doesn't need a state change.

**Explanation.**

```css
.button { transition: background-color 150ms ease, transform 150ms ease; }
.button:hover { background-color: var(--accent-hover); transform: translateY(-1px); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.skeleton { animation: pulse 1.5s ease-in-out infinite; }
```

**Watch out.** `transition: all` animates properties you didn't intend (including layout ones) and makes performance unpredictable. List the properties explicitly.

---

## Q41. Which properties are cheap to animate, and why?

**Short answer.** `transform` and `opacity` — they can be handled by the compositor on the GPU without recalculating layout or repainting. Animating `width`, `height`, `top`, `left`, `margin`, or `padding` triggers layout on every frame and causes jank.

**Explanation.** The rendering pipeline: **style → layout → paint → composite**. Changing a property re-runs the pipeline from the earliest stage it affects:

| Property changed | Re-runs |
|---|---|
| `width`, `top`, `margin`, `font-size` | Layout + paint + composite |
| `color`, `background`, `box-shadow` | Paint + composite |
| `transform`, `opacity` | Composite only |

```css
/* Janky */
.panel { transition: left 300ms; }
/* Smooth */
.panel { transition: transform 300ms; }
.panel.open { transform: translateX(0); }
```

**Watch out.** `will-change: transform` promotes an element to its own layer ahead of time, but every layer costs GPU memory. Apply it just before an animation and remove it after — never globally (`* { will-change: transform }`).

---

## Q42. How do you respect `prefers-reduced-motion`?

**Short answer.** Users with vestibular disorders can ask the OS to reduce motion. Honor it by removing or replacing large movements, parallax, and auto-playing animation with fades or no animation.

**Explanation.**

```css
@media (prefers-reduced-motion: no-preference) {
  .hero { animation: slide-in 600ms ease-out; }
}

/* Or a global safety net */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Watch out.** "Reduced" doesn't mean "none" — a subtle opacity fade is usually fine and keeps state changes understandable. What should go is motion across the screen, zooming, and parallax.

---

## Q43. What are View Transitions?

**Short answer.** An API that animates between two DOM states — or between two pages — by snapshotting the old and new views and cross-fading or morphing them. Shared elements (a thumbnail becoming a hero image) are matched by `view-transition-name`.

**Explanation.**

```js
document.startViewTransition(() => updateTheDOM());
```

```css
/* Cross-document transitions between pages of a multi-page site */
@view-transition { navigation: auto; }

.product-thumb { view-transition-name: product-image; }

::view-transition-old(root),
::view-transition-new(root) { animation-duration: 250ms; }
```

**Watch out.** Each `view-transition-name` must be unique on the page at the moment of the transition — duplicates cancel it. In lists, generate names per item (`view-transition-name: card-42`) or use `view-transition-name: match-element`.

---

## Q44. What are scroll-driven animations?

**Short answer.** Animations whose progress is tied to scroll position instead of time — reading progress bars, reveal-on-scroll, parallax — done in CSS and run off the main thread.

**Explanation.**

```css
.progress {
  position: fixed; inset: 0 0 auto; height: 4px;
  transform-origin: left;
  animation: grow linear;
  animation-timeline: scroll(root);
}
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.reveal {
  animation: fade-up linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}
```

**Watch out.** Wrap these in `prefers-reduced-motion: no-preference`, and provide a non-animated default for browsers without support (`@supports (animation-timeline: view())`).

---

# Part 7 — Rendering and Performance

## Q45. Why is CSS render-blocking, and what is critical CSS?

**Short answer.** The browser won't paint until it has the CSS for the page, to avoid showing unstyled content. Critical CSS means inlining the small amount of CSS needed for above-the-fold content in the `<head>` and loading the rest without blocking.

**Explanation.**

```html
<head>
  <style>/* critical: layout shell, header, hero */</style>
  <link rel="preload" href="/full.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/full.css"></noscript>
</head>
```

Other levers: split CSS per route, remove unused CSS, use `media` attributes on `<link>` so print or large-screen styles don't block (`<link rel="stylesheet" href="print.css" media="print">`).

**Watch out.** `@import` inside CSS files creates a request chain — the imported file isn't discovered until the parent downloads and parses. Use `<link>` tags or let the bundler inline imports.

---

## Q46. Do selectors affect performance?

**Short answer.** Rarely in practice. Browsers match selectors right-to-left and are highly optimized. Layout, paint, huge DOMs, and expensive properties (big blurs, shadows on many elements) matter far more. The main exceptions are broad `:has()` and very large stylesheets recalculated often.

**Explanation.** Browsers evaluate `.nav a` by finding every `a`, then checking for a `.nav` ancestor. A key selector like `*` or a bare element type means more candidates, but the cost is usually microseconds.

What genuinely costs time:

- Style recalculation on a large DOM after class changes high in the tree.
- Layout thrashing from JavaScript (reading `offsetHeight` after writing styles in a loop).
- Paint-heavy effects: large `box-shadow`, `filter: blur()`, `backdrop-filter` on scrolling content.

**Watch out.** Use DevTools' Performance panel and "Selector stats" before optimizing selectors. Rewriting CSS for selector speed without measuring is usually wasted effort.

---

## Q47. What do `contain` and `content-visibility` do?

**Short answer.** `contain` tells the browser an element's internals don't affect the rest of the page, so it can limit layout and paint work to that subtree. `content-visibility: auto` goes further and skips rendering off-screen content entirely until it's near the viewport.

**Explanation.**

```css
.widget { contain: layout paint; }

.article-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 800px;   /* placeholder size to keep the scrollbar stable */
}
```

On long pages this can cut initial rendering time dramatically.

**Watch out.** Without `contain-intrinsic-size`, skipped sections collapse to zero height and the scrollbar jumps as you scroll. `contain: paint` also clips overflow and creates a containing block for fixed elements — check dropdowns and tooltips inside.

---

## Q48. How do you load web fonts without hurting performance?

**Short answer.** Self-host WOFF2, subset to the characters you need, preload the one or two critical files, use `font-display: swap` (or `optional`), and adjust fallback metrics so the swap doesn't shift the layout.

**Explanation.**

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-weight: 100 900;          /* one variable font file instead of many weights */
  font-display: swap;
}

@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;          /* match Inter's metrics so swapping causes no layout shift */
}

body { font-family: "Inter", "Inter Fallback", system-ui, sans-serif; }
```

| `font-display` | Behavior |
|---|---|
| `block` | Invisible text up to ~3s (FOIT) |
| `swap` | Fallback immediately, swap when loaded (FOUT) |
| `optional` | Use the font only if it loads almost instantly |

**Watch out.** Each weight and style is a separate file. Loading regular, medium, semibold, bold, and italics can easily add 300 KB — a variable font or a system font stack is often the better choice.

---

# Part 8 — Accessibility and Theming

## Q49. Why is `outline: none` a problem, and what's `:focus-visible`?

**Short answer.** Removing the focus outline makes the page unusable for keyboard users — they can't see where they are. `:focus-visible` shows focus styles only when the browser decides they're needed (keyboard navigation), not on mouse clicks, which removes the reason people deleted outlines in the first place.

**Explanation.**

```css
/* Don't */
*:focus { outline: none; }

/* Do */
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
```

`:focus-within` styles a parent when anything inside it has focus — useful for highlighting a whole form field group.

**Watch out.** `outline` is preferred over `box-shadow` for focus rings, because Windows High Contrast / forced-colors mode removes box shadows but keeps outlines.

---

## Q50. How do you implement dark mode?

**Short answer.** Define colors as semantic custom properties, switch their values with `prefers-color-scheme` (system preference) and optionally a `[data-theme]` attribute (user override), and set `color-scheme` so form controls and scrollbars match.

**Explanation.**

```css
:root {
  color-scheme: light dark;
  --bg: white;
  --text: #1a1a1a;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #121212; --text: #e8e8e8; }
}
:root[data-theme="dark"] { --bg: #121212; --text: #e8e8e8; }

body { background: var(--bg); color: var(--text); }
```

Avoid pure black backgrounds with pure white text — the high contrast causes halation for many readers. Reduce image brightness slightly and re-check shadows, which barely show on dark surfaces.

**Watch out.** Applying the saved theme from JavaScript after load causes a flash of the wrong theme. Set the attribute in a tiny inline script in `<head>` before CSS renders, or store the preference in a cookie and render it on the server.

---

## Q51. What do you check for color contrast?

**Short answer.** WCAG AA requires 4.5:1 for normal text, 3:1 for large text (24px, or ~18.7px bold), and 3:1 for UI component boundaries and focus indicators. Never rely on color alone to convey meaning.

**Explanation.**

```css
.error {
  color: var(--danger);
  /* plus an icon or text — red alone fails for color-blind users */
}
.error::before { content: "⚠ "; }
```

DevTools shows contrast ratios in the color picker and flags failures in Lighthouse.

**Watch out.** Placeholder text, disabled-looking-but-enabled buttons, and text over images are the most common failures. For text on images, add a scrim (`linear-gradient` overlay) to guarantee contrast.

---

## Q52. What is forced-colors mode?

**Short answer.** A high-contrast mode (e.g. Windows Contrast Themes) where the OS overrides your colors with a limited user-chosen palette. Backgrounds images, shadows, and most colors are replaced; borders and outlines stay.

**Explanation.**

```css
.card { border: 1px solid transparent; box-shadow: var(--shadow); }   /* transparent border becomes visible */

@media (forced-colors: active) {
  .icon-button svg { fill: ButtonText; }   /* system color keywords */
  .badge { border: 1px solid CanvasText; }
}
```

**Watch out.** UI that relies only on background color or shadows to show boundaries (cards, selected tabs, toggles) disappears in forced-colors mode. A transparent border costs nothing and fixes it.

---

## Q53. What other user-preference media features should you know?

**Short answer.** `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `prefers-reduced-transparency`, `forced-colors`, and interaction features `hover` and `pointer`.

**Explanation.**

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }   /* only on devices that really hover */
}

@media (pointer: coarse) {
  .button { min-height: 44px; }   /* larger touch targets */
}

@media (prefers-contrast: more) {
  :root { --border: CanvasText; }
}
```

**Watch out.** Hover-only interactions (menus that open on hover, actions revealed on hover) don't exist on touch screens. Gate hover effects with `(hover: hover)` and make sure everything is reachable by tap and keyboard.

---

# Part 9 — Rapid-Fire and Debugging Puzzles

## Q54. Which color is the text?

```html
<p id="intro" class="lead">Hello</p>
```

```css
#intro { color: red; }
p.lead.lead.lead { color: blue; }
.lead { color: green !important; }
```

<details><summary>Answer</summary>

Green. `!important` wins over normal declarations regardless of specificity. Without it, red wins: `#intro` is (1, 0, 0) and beats `p.lead.lead.lead` at (0, 3, 1) — classes never add up to an ID.
</details>

---

## Q55. Why is there a gap under this image?

```html
<div class="frame"><img src="photo.jpg" alt="…"></div>
```

<details><summary>Answer</summary>

`<img>` is inline by default, so it sits on the text baseline, leaving room below for letter descenders. Fix with `img { display: block; }` or `vertical-align: middle`.
</details>

---

## Q56. Why does this flex item overflow its container?

```css
.row { display: flex; }
.row .content { flex: 1; }
/* .content contains a long unbroken URL */
```

<details><summary>Answer</summary>

Flex items default to `min-width: auto`, so they won't shrink below their content's minimum width. Add `min-width: 0` to `.content`, plus `overflow-wrap: anywhere` to break the URL.
</details>

---

## Q57. Why is `height: 100%` not working?

```css
.child { height: 100%; }
```

<details><summary>Answer</summary>

Percentage heights resolve against the parent's *definite* height. If the parent's height is `auto` (set by content), `100%` of it resolves to `auto`. Give the parent a height, or use flex/grid on the parent (`display: grid` with the child stretching), or `min-height: 100dvh` on the outer container.
</details>

---

## Q58. Why doesn't the modal cover the screen?

```css
.page { transform: translateZ(0); }
.page .modal { position: fixed; inset: 0; z-index: 1000; }
```

<details><summary>Answer</summary>

`transform` on `.page` makes it the containing block for fixed descendants and creates a new stacking context. The modal is positioned relative to `.page`, not the viewport, and can't stack above things outside `.page`. Move the modal to the document root (a portal) or use `<dialog>`, which renders in the top layer.
</details>

---

## Q59. Why doesn't this transition animate?

```css
.panel { display: none; opacity: 0; transition: opacity 200ms; }
.panel.open { display: block; opacity: 1; }
```

<details><summary>Answer</summary>

`display` historically isn't animatable, and the element has no "before" style when it first appears, so it pops in. Modern fix: `transition: opacity 200ms, display 200ms allow-discrete;` plus `@starting-style { .panel.open { opacity: 0; } }` to define the entry state. Older fix: toggle `visibility` and `opacity` instead of `display`.
</details>

---

## Q60. Why do these margins not add up?

```css
.a { margin-bottom: 40px; }
.b { margin-top: 20px; }
```

<details><summary>Answer</summary>

Vertical margins between adjacent blocks collapse to the larger value, so the gap is 40px, not 60px. Inside a flex or grid container, they wouldn't collapse — or use `gap` instead of margins.
</details>

---

## Q61. Quick definitions

| Term | One line |
|---|---|
| **Cascade** | Algorithm that picks the winning declaration among conflicting ones |
| **Specificity** | (IDs, classes/attributes/pseudo-classes, types) score for selectors |
| **Cascade layer** | `@layer` group whose order outranks specificity |
| **Box model** | Content + padding + border + margin |
| **BFC** | Block formatting context — isolates floats and margins |
| **Stacking context** | Group of elements flattened into one z-layer |
| **Containing block** | The box that percentages and positioned offsets are measured against |
| **`fr`** | Fraction of free space in a grid track |
| **Container query** | Style rule based on a parent container's size |
| **Custom property** | `--name` variable that cascades and inherits at runtime |
| **`:has()`** | Selects an element based on its descendants or following siblings |
| **Logical properties** | Direction-relative properties (`inline`, `block`, `start`, `end`) |
| **Compositing** | Final pipeline stage; `transform`/`opacity` animate here cheaply |
| **Critical CSS** | Inlined CSS needed to render above-the-fold content |
| **`:focus-visible`** | Focus style shown only when the browser deems it useful |
| **Forced-colors** | OS high-contrast mode that overrides author colors |

---

# Appendix — A 10-day study plan

| Day | Focus | Prove it by |
|---|---|---|
| 1 | Cascade, specificity, inheritance, `!important` | Predicting the winner of 10 conflicting-rule puzzles |
| 2 | Box model, units, display, margin collapse, BFC | Explaining every pixel of a box in DevTools' box-model view |
| 3 | Flexbox — axes, `flex` shorthand, `min-width: 0` | A responsive toolbar and a sticky-footer layout |
| 4 | Grid — tracks, areas, `auto-fit`, `minmax`, subgrid | A dashboard and a card gallery with aligned card sections |
| 5 | Positioning, stacking contexts, sticky | Debugging a "z-index doesn't work" bug from first principles |
| 6 | Responsive — media queries, container queries, `clamp()` | A card component that adapts in a sidebar and in a main column |
| 7 | Modern CSS — `:has()`, custom properties, layers, nesting, color | Refactoring a stylesheet into layers with tokens and no `!important` |
| 8 | Architecture — BEM, modules, utilities, tokens | Comparing one component built three ways and defending a choice |
| 9 | Animation and performance — compositor, fonts, critical CSS | A 60fps menu animation and a page with no layout shift on font load |
| 10 | Accessibility and theming — focus, contrast, motion, dark mode | A theme switcher with no flash, respecting every user preference |

---

## Final note

The questions that separate a good CSS answer from a memorized one are almost always about **which rule wins** and **what the box is relative to**. If you can explain why `z-index: 9999` doesn't help, why a flex item overflows, and why `height: 100%` resolves to nothing, you understand CSS.
