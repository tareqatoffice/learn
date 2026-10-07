# The HTML Question Book

**A fully explained Q&A guide — from document structure to semantics, forms, accessibility, and modern HTML.**

---

## How to use this book

Every question follows the same shape:

- **Short answer** — what you'd say in one or two sentences.
- **Explanation** — why it works that way.
- **Code** — a runnable illustration where it helps.
- **Watch out** — the trap, the follow-up question, or the mistake people make.

Read it front-to-back once, then use the section index to drill weak areas. HTML questions look easy, which is exactly why interviewers use them: they reveal whether you understand semantics, accessibility, and how the browser actually loads a page.

### Contents

1. Fundamentals — documents, elements, the `<head>`
2. Semantic HTML
3. Forms
4. Accessibility
5. Images and media
6. Loading and performance
7. Modern HTML — dialog, popover, details, templates, web components
8. SEO and metadata
9. Security
10. How browsers parse HTML
11. Rapid-fire and "what's wrong with this markup?"

---

# Part 1 — Fundamentals

## Q1. What is HTML, and what is it *not*?

**Short answer.** HTML (HyperText Markup Language) describes the structure and meaning of content — headings, paragraphs, links, forms. It isn't a programming language and doesn't handle presentation (CSS) or behavior (JavaScript).

**Explanation.** The web's three layers:

| Layer | Technology | Answers |
|---|---|---|
| Structure and meaning | HTML | *What is this?* A heading, a list, a button |
| Presentation | CSS | *How does it look?* |
| Behavior | JavaScript | *What does it do?* |

HTML is maintained as a *Living Standard* by WHATWG — there's no "HTML6" coming. "HTML5" today just means "modern HTML".

**Watch out.** Choosing elements for how they look (`<h3>` because it's the right size, `<blockquote>` for indentation) is the core mistake. Pick elements for meaning; style with CSS.

---

## Q2. What does `<!DOCTYPE html>` do?

**Short answer.** It tells the browser to render the page in *standards mode*. Without it, browsers fall back to *quirks mode*, which emulates old browser bugs in layout.

**Explanation.**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page title</title>
  </head>
  <body>
    <!-- content -->
  </body>
</html>
```

In quirks mode the box model, table sizing, and inline image spacing behave differently, so CSS that works elsewhere breaks.

**Watch out.** The doctype must come first — only whitespace and comments may precede it, and even a stray character before it triggers quirks mode. Check with `document.compatMode`: `"CSS1Compat"` means standards mode, `"BackCompat"` means quirks mode.

---

## Q3. What belongs in the `<head>`, and why do `charset` and `viewport` matter?

**Short answer.** The `<head>` holds metadata: character encoding, viewport, title, description, stylesheets, scripts, icons, and social-sharing tags. `charset` must come early so text decodes correctly; `viewport` makes the page responsive on mobile.

**Explanation.**

```html
<head>
  <meta charset="utf-8">                                   <!-- within the first 1024 bytes -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pricing — Acme</title>
  <meta name="description" content="Plans for teams of every size.">
  <link rel="canonical" href="https://acme.com/pricing">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js" defer></script>
</head>
```

- **`charset`** — without it the browser guesses the encoding; `é` can become `Ã©`.
- **`viewport`** — without it mobile browsers render a ~980px-wide desktop page and zoom out, so media queries never match.

**Watch out.** Never add `maximum-scale=1` or `user-scalable=no` to stop zooming. It blocks low-vision users from enlarging text and fails WCAG.

---

## Q4. Element vs tag vs attribute

**Short answer.** A tag is the markup syntax (`<p>`, `</p>`). An element is the whole thing — start tag, content, end tag — and becomes a node in the DOM. Attributes are name/value pairs on the start tag that configure the element.

**Explanation.**

```html
<a href="/docs" class="link">Read the docs</a>
<!-- start tag: <a ...>   attributes: href, class   content: "Read the docs"   end tag: </a> -->
```

Attributes vs properties: the attribute is what's written in HTML; the property is the live value on the DOM object. For `<input value="a">`, typing changes `input.value` (property) but `input.getAttribute('value')` stays `"a"` — the attribute is the *default*.

**Watch out.** Boolean attributes are true by *presence*, not value. `<input disabled="false">` is still disabled. Remove the attribute to turn it off.

---

## Q5. Block vs inline elements — and why is that a CSS question now?

**Short answer.** Historically, block elements (`<div>`, `<p>`, `<h1>`) start on a new line and take full width; inline elements (`<span>`, `<a>`, `<strong>`) flow within text. Today that's just the default CSS `display` value — HTML defines *content models* instead (flow, phrasing, interactive content, …).

**Explanation.** Content models decide what can nest where:

- `<p>` accepts only *phrasing content* — so `<p><div>…</div></p>` is invalid; the parser closes the `<p>` before the `<div>`.
- `<a>` can wrap block content (`<a><div>card</div></a>` is valid) but must not contain other interactive content (`<a>` inside `<a>`, `<button>` inside `<a>`).
- `<button>` must not contain interactive content either.

**Watch out.** Invalid nesting isn't just a validator complaint. The parser silently restructures the DOM, which breaks CSS selectors and causes hydration mismatches in React/Next.js.

---

## Q6. What are void elements?

**Short answer.** Elements that can't have content and have no end tag: `<img>`, `<input>`, `<br>`, `<hr>`, `<meta>`, `<link>`, `<source>`, `<track>`, `<wbr>`, `<area>`, `<col>`, `<embed>`, `<base>`.

**Explanation.** `<img src="a.png">` and `<img src="a.png" />` are both valid HTML — the trailing slash is ignored. It's required in JSX and XHTML, which is why you see it.

**Watch out.** The slash does *not* self-close non-void elements in HTML. `<div />` is parsed as an open `<div>`, and everything after it becomes its child.

---

## Q7. What are `data-*` attributes for?

**Short answer.** Custom attributes for storing extra information on an element that has no standard attribute — read in JavaScript via `element.dataset` and in CSS via attribute selectors.

**Explanation.**

```html
<button data-product-id="42" data-variant="large">Add to cart</button>
```

```js
btn.dataset.productId;   // "42"   (kebab-case → camelCase)
btn.dataset.variant;     // "large"
```

```css
button[data-variant="large"] { padding: 1rem 2rem; }
```

**Watch out.** Values are always strings. Don't use `data-*` for things that have a real attribute (`disabled`, `aria-expanded`, `hidden`) — assistive technology reads the real ones, not your custom ones.

---

## Q8. What does the `lang` attribute do?

**Short answer.** It declares the language of the content. Screen readers use it to choose pronunciation, browsers use it for hyphenation, spell-check, and font selection, and translation tools use it to detect the source language.

**Explanation.**

```html
<html lang="en">
  ...
  <p>The French call it <span lang="fr">l'esprit de l'escalier</span>.</p>
</html>
```

**Watch out.** A missing `lang` on `<html>` is one of the most common automated accessibility failures — and one of the easiest to fix.

---

# Part 2 — Semantic HTML

## Q9. What is semantic HTML, and why does it matter?

**Short answer.** Using elements that describe what content *is* — `<nav>`, `<button>`, `<article>`, `<h2>` — instead of generic `<div>`s and `<span>`s. It gives you accessibility, keyboard behavior, SEO, and readable code for free.

**Explanation.**

```html
<!-- Div soup -->
<div class="header"><div class="nav">…</div></div>
<div class="btn" onclick="save()">Save</div>

<!-- Semantic -->
<header><nav aria-label="Main">…</nav></header>
<button type="button" onclick="save()">Save</button>
```

What the `<button>` gives you that the `<div>` doesn't: focusable with Tab, activates on Enter and Space, announced as "button" by screen readers, `disabled` support, and form submission behavior.

**Watch out.** The interview follow-up is "what does the `<div>` version need to match?" — `role="button"`, `tabindex="0"`, keydown handlers for Enter *and* Space, focus styles, and disabled handling. Then ask why you'd write all that instead of using `<button>`.

---

## Q10. What are the landmark elements?

**Short answer.** `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, plus `<section>` and `<form>` when they have an accessible name. Screen-reader users jump between landmarks the way sighted users scan a page.

**Explanation.**

```html
<body>
  <header>…logo, site search…</header>
  <nav aria-label="Main">…</nav>
  <main>
    <h1>Article title</h1>
    …
  </main>
  <aside aria-label="Related articles">…</aside>
  <footer>…</footer>
</body>
```

| Element | Landmark role | Note |
|---|---|---|
| `<header>` | `banner` | Only when not inside `<article>`/`<section>`/`<main>` |
| `<nav>` | `navigation` | Label each one if there are several |
| `<main>` | `main` | Exactly one visible per page |
| `<aside>` | `complementary` | Tangential content |
| `<footer>` | `contentinfo` | Only when top-level |

**Watch out.** Not every group of links needs `<nav>` — reserve it for major navigation blocks. Too many landmarks are as unhelpful as none.

---

## Q11. `<article>` vs `<section>` vs `<div>`

**Short answer.** `<article>` is self-contained content that makes sense on its own (a blog post, a comment, a product card). `<section>` is a thematic grouping that usually has a heading. `<div>` has no meaning — use it purely for styling or scripting hooks.

**Explanation.** A quick test:

- Could it be syndicated or shared independently? → `<article>`
- Is it a chapter of the page with its own heading? → `<section>`
- Is it just a wrapper for layout? → `<div>`

```html
<article>
  <h2>How we cut build times by 70%</h2>
  <section>
    <h3>The problem</h3>
    …
  </section>
  <section>
    <h3>The fix</h3>
    …
  </section>
</article>
```

**Watch out.** `<div>` is not bad. Wrapping things in `<section>` "to be semantic" when there's no theme or heading adds noise. Use `<div>` freely for layout.

---

## Q12. How should headings be structured?

**Short answer.** One `<h1>` describing the page, then `<h2>`–`<h6>` nested in order without skipping levels. Headings form the page outline that screen-reader users navigate by.

**Explanation.**

```html
<h1>Product docs</h1>
  <h2>Installation</h2>
    <h3>macOS</h3>
    <h3>Windows</h3>
  <h2>Configuration</h2>
```

**Watch out.** The "document outline algorithm" — where each `<section>` resets heading levels so every section could use `<h1>` — was never implemented by browsers or screen readers and has been removed from the spec. Use explicit heading levels.

---

## Q13. `<b>` vs `<strong>`, `<i>` vs `<em>`

**Short answer.** `<strong>` marks importance; `<em>` marks stress emphasis that changes meaning. `<b>` and `<i>` are for text that is stylistically offset without extra importance — keywords, product names, foreign words, technical terms.

**Explanation.**

```html
<p><strong>Warning:</strong> this deletes all data.</p>
<p>I <em>never</em> said she stole it.</p>          <!-- stress changes meaning -->
<p>The <i lang="la">status quo</i> remains.</p>     <!-- foreign phrase -->
<p>Select the <b>Export</b> option.</p>             <!-- UI label -->
```

**Watch out.** Most screen readers don't change voice for any of these by default, so don't rely on them alone to convey critical meaning. And if you only want bold styling, use CSS.

---

## Q14. Which lesser-known semantic elements should you know?

**Short answer.** `<time>`, `<address>`, `<figure>`/`<figcaption>`, `<blockquote>`/`<cite>`/`<q>`, `<abbr>`, `<mark>`, `<code>`/`<kbd>`/`<samp>`/`<pre>`, `<dl>`/`<dt>`/`<dd>`, `<search>`, and `<output>`.

**Explanation.**

```html
<time datetime="2026-10-07T09:00">7 Oct, 9am</time>

<figure>
  <img src="chart.png" alt="Revenue up 30% year over year">
  <figcaption>Figure 1: Revenue, 2025–2026</figcaption>
</figure>

<p>Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.</p>

<dl>
  <dt>TTL</dt><dd>Time to live</dd>
  <dt>CDN</dt><dd>Content delivery network</dd>
</dl>

<search>
  <form action="/search"><input type="search" name="q" aria-label="Search"></form>
</search>
```

**Watch out.** `<address>` is for contact information of the nearest `<article>` or the page — not for any postal address in content.

---

## Q15. When should you use a table?

**Short answer.** For tabular data — rows and columns where relationships matter. Never for page layout. Use `<caption>`, `<thead>`, `<tbody>`, `<th>` with `scope` so screen readers can announce headers for each cell.

**Explanation.**

```html
<table>
  <caption>Q3 sales by region</caption>
  <thead>
    <tr><th scope="col">Region</th><th scope="col">Revenue</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">EMEA</th><td>$1.2M</td></tr>
    <tr><th scope="row">APAC</th><td>$0.9M</td></tr>
  </tbody>
</table>
```

**Watch out.** Setting `display: flex` or `grid` on table elements can strip their table semantics in some browsers. Make tables responsive with a horizontally scrolling wrapper instead.

---

# Part 3 — Forms

## Q16. How does a form submit, and GET vs POST?

**Short answer.** On submit, the browser collects every named, enabled control in the form and sends it to `action` using `method`. GET puts the data in the URL query string; POST puts it in the request body.

**Explanation.**

```html
<form action="/search" method="get">
  <input type="search" name="q">       <!-- → /search?q=shoes -->
  <button>Search</button>
</form>

<form action="/login" method="post">
  <input name="email" type="email" autocomplete="username">
  <input name="password" type="password" autocomplete="current-password">
  <button>Sign in</button>
</form>
```

| | GET | POST |
|---|---|---|
| Data location | URL | Body |
| Bookmarkable / shareable | Yes | No |
| Use for | Searches, filters | Anything that changes state, sensitive data |
| File uploads | No | Yes (`enctype="multipart/form-data"`) |

**Watch out.** Controls without a `name` aren't submitted. Neither are `disabled` controls — use `readonly` if the value must be sent but not edited.

---

## Q17. How do you correctly label a form control?

**Short answer.** With a `<label>` linked by `for`/`id`, or by wrapping the control inside the label. This gives an accessible name and makes clicking the label focus the control.

**Explanation.**

```html
<!-- Explicit -->
<label for="email">Email</label>
<input id="email" name="email" type="email">

<!-- Implicit -->
<label>
  <input type="checkbox" name="terms"> I agree to the terms
</label>

<!-- Extra description -->
<label for="pw">Password</label>
<input id="pw" type="password" aria-describedby="pw-hint">
<p id="pw-hint">At least 12 characters.</p>
```

**Watch out.** A `placeholder` is not a label. It disappears when typing starts, usually has poor contrast, and isn't reliably announced. Use it only for an example format, if at all.

---

## Q18. Which input types should you know, and why do they matter?

**Short answer.** `email`, `tel`, `url`, `number`, `search`, `password`, `date`, `time`, `datetime-local`, `month`, `color`, `range`, `file`, `checkbox`, `radio`, `hidden`. The right type gives the correct mobile keyboard, built-in validation, and native pickers.

**Explanation.**

```html
<input type="email" autocomplete="email">        <!-- @ key on mobile, format validation -->
<input type="tel" autocomplete="tel">            <!-- phone keypad -->
<input inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code">  <!-- OTP -->
<input type="date" min="2026-01-01">
```

`inputmode` changes only the virtual keyboard without changing validation — useful for things that are digits but not numbers.

**Watch out.** Don't use `type="number"` for credit cards, ZIP codes, or phone numbers. It strips leading zeros, allows `e`, shows spinners, and changes value on scroll. Use `type="text" inputmode="numeric"`.

---

## Q19. How does built-in form validation work?

**Short answer.** Attributes like `required`, `type`, `min`, `max`, `minlength`, `maxlength`, `pattern`, and `step` define constraints. The browser blocks submission and shows messages if they fail. The Constraint Validation API lets you customize messages and check validity in JavaScript.

**Explanation.**

```html
<form>
  <input name="username" required minlength="3" pattern="[a-z0-9_]+"
         title="Lowercase letters, numbers, and underscores">
  <button>Create</button>
</form>
```

```js
const input = form.elements.username;
input.addEventListener('input', () => {
  if (input.validity.patternMismatch) {
    input.setCustomValidity('Use lowercase letters, numbers, or _');
  } else {
    input.setCustomValidity('');   // must clear, or the field stays invalid forever
  }
});
```

CSS hooks: `:valid`, `:invalid`, and `:user-invalid` (only after the user interacts — avoids showing errors on page load).

**Watch out.** Client-side validation is UX, not security. Anyone can bypass it with DevTools or `curl`. Always validate on the server too.

---

## Q20. What are the `<button>` types, and why is the default a common bug?

**Short answer.** `submit` (the default), `button`, and `reset`. A `<button>` inside a form without a `type` submits the form — so a "Show password" or "Add row" button accidentally submits it.

**Explanation.**

```html
<form>
  <input type="password" id="pw">
  <button type="button" onclick="togglePassword()">Show</button>   <!-- explicit -->
  <button type="submit">Save</button>
</form>
```

**Watch out.** Always set `type` explicitly on buttons. `reset` is rarely wanted — users click it by accident and lose everything they typed.

---

## Q21. What are `<fieldset>` and `<legend>` for?

**Short answer.** They group related controls and give the group a name. Essential for radio buttons and checkbox groups, so screen readers announce the question along with each option.

**Explanation.**

```html
<fieldset>
  <legend>Shipping speed</legend>
  <label><input type="radio" name="ship" value="std" checked> Standard</label>
  <label><input type="radio" name="ship" value="exp"> Express</label>
</fieldset>
```

Bonus: `<fieldset disabled>` disables every control inside it.

**Watch out.** Without the `<legend>`, a screen reader announces only "Express, radio button, 2 of 2" — the user never hears what they're choosing.

---

## Q22. What does `autocomplete` do, and why does it matter?

**Short answer.** It tells the browser and password managers what kind of data a field expects, so they can autofill correctly. It's also a WCAG requirement for fields collecting user information.

**Explanation.**

```html
<input name="name" autocomplete="name">
<input name="email" autocomplete="email">
<input name="address" autocomplete="street-address">
<input name="cc" autocomplete="cc-number" inputmode="numeric">
<input name="new-pw" type="password" autocomplete="new-password">
<input name="code" autocomplete="one-time-code">
```

`new-password` triggers strong-password suggestions; `current-password` triggers saved-password fill; `one-time-code` enables SMS code autofill on mobile.

**Watch out.** `autocomplete="off"` on login fields hurts security — it pushes users toward weak, reused passwords. Most browsers ignore it for passwords anyway.

---

## Q23. Name the other form elements worth knowing.

**Short answer.** `<select>`/`<option>`/`<optgroup>`, `<textarea>`, `<datalist>` for suggestions, `<output>` for computed results, `<progress>` and `<meter>` for values, and the `form` attribute for controls outside their form.

**Explanation.**

```html
<label for="browser">Browser</label>
<input id="browser" list="browsers">
<datalist id="browsers">
  <option value="Chrome"><option value="Firefox"><option value="Safari">
</datalist>

<progress value="70" max="100">70%</progress>    <!-- task completion -->
<meter value="0.8" low="0.3" high="0.7">80%</meter> <!-- a measurement in a range, e.g. disk use -->

<form id="checkout">…</form>
<button form="checkout">Pay</button>              <!-- submits a form it's not inside -->
```

**Watch out.** `<progress>` vs `<meter>` is a classic question: progress is how far a task has got; meter is a scalar value within a known range.

---

# Part 4 — Accessibility

## Q24. How do you write good `alt` text?

**Short answer.** Describe the image's *purpose* in context, not its appearance. Informative images get concise descriptions; decorative images get `alt=""`; images that are links or buttons describe the action.

**Explanation.**

```html
<img src="logo.svg" alt="Acme">                         <!-- inside a link home: "Acme home" -->
<img src="divider.png" alt="">                          <!-- decorative: skipped by screen readers -->
<img src="q3.png" alt="Revenue rose from $2M to $3M in Q3">  <!-- the point, not "a bar chart" -->
<a href="/cart"><img src="cart.svg" alt="Cart (3 items)"></a>
```

**Watch out.** Omitting `alt` entirely is worse than `alt=""` — screen readers often read the file name ("IMG underscore 4021 dot jpeg"). And don't start with "Image of…" — the screen reader already says "image".

---

## Q25. What are the rules of ARIA?

**Short answer.** First rule: don't use ARIA if a native element does the job. ARIA only changes what assistive technology is *told* — it adds no behavior, no focus, no keyboard support.

**Explanation.** The five rules, condensed:

1. Prefer native HTML (`<button>` over `role="button"`).
2. Don't change native semantics unless you must (`<h2 role="tab">` is wrong; wrap it instead).
3. All interactive ARIA controls must be keyboard-operable.
4. Don't put `role="presentation"` or `aria-hidden="true"` on focusable elements.
5. Every interactive element needs an accessible name.

Commonly used ARIA that *is* appropriate:

```html
<button aria-expanded="false" aria-controls="menu">Menu</button>
<ul id="menu" hidden>…</ul>

<button aria-label="Close"><svg aria-hidden="true">…</svg></button>

<div role="status" aria-live="polite">Saved.</div>
```

**Watch out.** Studies of large site samples consistently find pages *with* ARIA have more accessibility errors than pages without. "No ARIA is better than bad ARIA."

---

## Q26. What is an accessible name, and how is it computed?

**Short answer.** It's what assistive technology announces for an element — "Submit, button". The browser computes it in priority order: `aria-labelledby`, then `aria-label`, then native labeling (`<label>`, `alt`, `<caption>`, `<legend>`), then text content, then `title` as a last resort.

**Explanation.**

```html
<button>Save</button>                                    <!-- "Save" from content -->
<button aria-label="Close dialog">×</button>             <!-- "Close dialog" -->
<h2 id="billing">Billing</h2>
<section aria-labelledby="billing">…</section>            <!-- region named "Billing" -->
```

You can inspect it in DevTools → Accessibility pane.

**Watch out.** `aria-label` overrides visible text. If a button says "Buy" but has `aria-label="Purchase item"`, voice-control users saying "click Buy" fail. Keep the visible text in the accessible name (WCAG "Label in Name").

---

## Q27. How does `tabindex` work?

**Short answer.** `tabindex="0"` puts a non-interactive element into the natural tab order. `tabindex="-1"` makes it focusable by script but not by Tab. Positive values force a custom order — and should never be used.

**Explanation.**

```html
<div tabindex="0" role="region" aria-label="Code sample">…</div>   <!-- scrollable region -->
<h1 tabindex="-1" id="page-title">Dashboard</h1>                   <!-- focus target after route change -->
```

```js
document.getElementById('page-title').focus();
```

**Watch out.** `tabindex="5"` jumps that element ahead of everything with `0`, creating a confusing order that breaks as the page changes. Fix the DOM order instead.

---

## Q28. What is a skip link?

**Short answer.** A link at the very start of the page that jumps keyboard users past repeated navigation straight to the main content. Usually visually hidden until focused.

**Explanation.**

```html
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header>…40 nav links…</header>
  <main id="main" tabindex="-1">…</main>
</body>
```

```css
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 1rem; top: 1rem; }
```

**Watch out.** Hiding it with `display: none` makes it unfocusable and useless. Hide it off-screen so it appears on focus.

---

## Q29. How do you hide content — and from whom?

**Short answer.** It depends who it should be hidden from: everyone, only screen readers, or only sighted users.

**Explanation.**

| Goal | Technique |
|---|---|
| Hidden from everyone | `hidden` attribute, `display: none` |
| Visible, hidden from screen readers | `aria-hidden="true"` (decorative icons) |
| Hidden visually, read by screen readers | `.visually-hidden` CSS class |
| Visible but non-interactive and hidden from AT | `inert` attribute |

```css
.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
```

```html
<button><svg aria-hidden="true">…</svg><span class="visually-hidden">Search</span></button>
```

**Watch out.** `aria-hidden="true"` on a container doesn't remove focusable children from the tab order — keyboard users land on invisible-to-AT elements. Use `inert` for that.

---

## Q30. Button or link?

**Short answer.** Links (`<a href>`) navigate to a URL. Buttons perform an action on the current page. The difference matters for keyboard behavior, screen-reader expectations, and browser features like open-in-new-tab.

**Explanation.**

| | `<a href>` | `<button>` |
|---|---|---|
| Purpose | Go somewhere | Do something |
| Keyboard | Enter | Enter and Space |
| Middle-click / new tab | Yes | No |
| Announced as | "link" | "button" |

```html
<a href="/settings">Settings</a>
<button type="button" onclick="openDialog()">Edit profile</button>
```

**Watch out.** `<a href="#" onclick="…">` and `<a>` without `href` are anti-patterns — an `<a>` without `href` isn't focusable or announced as a link. If it doesn't have a URL, it's a button.

---

## Q31. How do live regions work?

**Short answer.** Elements with `aria-live` (or roles like `status` and `alert`) announce content changes to screen readers without moving focus — for toasts, form errors, search result counts, and chat messages.

**Explanation.**

```html
<div role="status" aria-live="polite" id="results-count"></div>   <!-- waits for a pause -->
<div role="alert" id="form-error"></div>                          <!-- interrupts immediately -->
```

```js
document.getElementById('results-count').textContent = '24 results';
```

**Watch out.** The live region must exist in the DOM *before* the content changes. Inserting a new element that already contains text is often not announced. Render the empty container on page load and update its text.

---

# Part 5 — Images and Media

## Q32. How do responsive images work — `srcset` and `sizes`?

**Short answer.** `srcset` lists candidate files with their widths (or pixel densities); `sizes` tells the browser how wide the image will be displayed. The browser picks the smallest file that still looks sharp for the screen.

**Explanation.**

```html
<!-- Width-based: for images that change size with the layout -->
<img src="hero-800.jpg"
     srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
     sizes="(max-width: 600px) 100vw, 50vw"
     width="1600" height="900"
     alt="Team planning on a whiteboard">

<!-- Density-based: for fixed-size images like logos -->
<img src="logo.png" srcset="logo.png 1x, logo@2x.png 2x" width="120" height="40" alt="Acme">
```

The browser needs `sizes` because it picks the file before CSS has loaded. Without it, it assumes `100vw` and downloads oversized images.

**Watch out.** Always set `width` and `height` — the browser uses their ratio to reserve space before the image loads, preventing layout shift (CLS). CSS `height: auto` keeps it responsive.

---

## Q33. When do you use `<picture>`?

**Short answer.** For *art direction* (different crops at different sizes) or *format fallback* (AVIF → WebP → JPEG). For simple resolution switching, `<img srcset>` is enough.

**Explanation.**

```html
<picture>
  <source type="image/avif" srcset="photo.avif">
  <source type="image/webp" srcset="photo.webp">
  <img src="photo.jpg" alt="Mountain lake at sunrise" width="1200" height="800">
</picture>

<picture>
  <source media="(max-width: 600px)" srcset="hero-square.jpg">
  <img src="hero-wide.jpg" alt="Product on a desk" width="1600" height="600">
</picture>
```

The browser uses the first matching `<source>`; the `<img>` is required and is what actually renders (and carries `alt`).

**Watch out.** Styles and `alt` go on the `<img>`, not on `<picture>` or `<source>`.

---

## Q34. What do `loading="lazy"`, `decoding`, and `fetchpriority` do?

**Short answer.** `loading="lazy"` defers off-screen images and iframes until the user scrolls near them. `fetchpriority="high"` tells the browser to fetch a resource early — typically the LCP image. `decoding="async"` lets image decoding happen off the main rendering path.

**Explanation.**

```html
<!-- Hero image: the Largest Contentful Paint element -->
<img src="hero.jpg" fetchpriority="high" alt="…" width="1600" height="900">

<!-- Below the fold -->
<img src="gallery-12.jpg" loading="lazy" alt="…" width="400" height="300">
<iframe src="https://maps.example.com/embed" loading="lazy" title="Office location"></iframe>
```

**Watch out.** Lazy-loading the hero image is a common LCP regression — the browser waits for layout before starting the download. Never lazy-load above-the-fold images.

---

## Q35. What do you need for accessible video and audio?

**Short answer.** Native `<video>`/`<audio>` with `controls`, captions via `<track kind="captions">`, a transcript for audio, no autoplay with sound, and a way to pause any motion.

**Explanation.**

```html
<video controls width="640" height="360" preload="metadata" poster="thumb.jpg">
  <source src="demo.webm" type="video/webm">
  <source src="demo.mp4" type="video/mp4">
  <track kind="captions" src="demo.en.vtt" srclang="en" label="English" default>
  <a href="demo.mp4">Download the video</a>
</video>
```

**Watch out.** Browsers block autoplay with sound. Background videos need `autoplay muted loop playsinline` — `playsinline` stops iOS from going fullscreen — and should respect `prefers-reduced-motion`.

---

## Q36. Inline `<svg>` vs `<img src="icon.svg">`

**Short answer.** Inline SVG can be styled with CSS (`fill: currentColor`), animated, and scripted, and adds no request. `<img>` SVGs are cached, keep HTML small, and are isolated from page CSS and scripts.

**Explanation.**

```html
<!-- Inline icon, inherits text color, hidden from screen readers -->
<button>
  <svg aria-hidden="true" width="16" height="16"><use href="/icons.svg#trash"></use></svg>
  Delete
</button>

<!-- Meaningful standalone SVG -->
<svg role="img" aria-labelledby="t1"><title id="t1">Uptime: 99.9%</title>…</svg>
```

**Watch out.** An icon-only button needs an accessible name (`aria-label` or visually hidden text). The SVG itself should be `aria-hidden="true"`.

---

# Part 6 — Loading and Performance

## Q37. `<script>` vs `async` vs `defer` vs `type="module"`

**Short answer.** A plain `<script>` blocks HTML parsing while it downloads and runs. `async` downloads in parallel and runs as soon as it arrives, in any order. `defer` downloads in parallel and runs after parsing, in document order. Module scripts are deferred by default.

**Explanation.**

| | Blocks parsing | Execution order | Runs when |
|---|---|---|---|
| `<script>` | Yes | Document order | Immediately |
| `async` | No | Whichever loads first | As soon as downloaded |
| `defer` | No | Document order | After parsing, before `DOMContentLoaded` |
| `type="module"` | No | Document order | Like `defer` (or `async` if marked) |

```html
<script src="/app.js" defer></script>               <!-- your app: needs DOM, order matters -->
<script src="https://analytics.example.js" async></script>   <!-- independent third party -->
<script type="module" src="/main.js"></script>
```

**Watch out.** `async` scripts that depend on each other break randomly, because order isn't guaranteed. Use `defer` for anything that depends on other scripts or the full DOM.

---

## Q38. What is the critical rendering path?

**Short answer.** The steps from receiving HTML to painting pixels: parse HTML into the DOM, parse CSS into the CSSOM, combine them into the render tree, calculate layout, paint, and composite. Anything that blocks those steps delays first render.

**Explanation.**

- **CSS is render-blocking** — the browser won't paint until stylesheets in `<head>` load.
- **Classic scripts are parser-blocking** — and they wait for preceding CSS, since scripts may read styles.
- **Fonts** can delay text paint (FOIT) unless `font-display: swap` is used.

Optimizations: inline critical CSS, `defer` scripts, preload key resources, compress and cache assets, and reduce the number of requests on the critical path.

**Watch out.** Moving scripts to the end of `<body>` was the old fix. `defer` in `<head>` is better — the download starts earlier, and execution still waits for the parser.

---

## Q39. `preload` vs `prefetch` vs `preconnect` vs `dns-prefetch`

**Short answer.** `preload` fetches a resource needed for *this* page now, at high priority. `prefetch` fetches something likely needed for the *next* page, at low priority. `preconnect` opens the connection (DNS + TCP + TLS) to an origin early. `dns-prefetch` does only the DNS lookup.

**Explanation.**

```html
<link rel="preconnect" href="https://cdn.example.com" crossorigin>
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.avif" as="image" fetchpriority="high">
<link rel="prefetch" href="/checkout.js">
<link rel="modulepreload" href="/app.mjs">
```

**Watch out.** Preloading too much competes with genuinely critical resources and slows the page down. Preloaded resources that aren't used within a few seconds trigger a console warning. Font preloads need `crossorigin` even on the same origin, or they're fetched twice.

---

## Q40. What are the Speculation Rules API and bfcache?

**Short answer.** The Speculation Rules API lets a page tell the browser to prefetch or *prerender* likely next pages, so navigation feels instant. bfcache (back/forward cache) keeps a full page snapshot in memory so Back and Forward restore it instantly.

**Explanation.**

```html
<script type="speculationrules">
{
  "prerender": [{ "where": { "href_matches": "/products/*" }, "eagerness": "moderate" }]
}
</script>
```

Things that make a page ineligible for bfcache: `unload` event listeners, `Cache-Control: no-store` (in some browsers), and open connections that aren't closed in `pagehide`.

**Watch out.** Prerendering runs the page's JavaScript before the user visits. Analytics must wait for the `prerenderingchange` event (or check `document.prerendering`) to avoid counting page views that never happened.

---

# Part 7 — Modern HTML

## Q41. What does the `<dialog>` element give you?

**Short answer.** A native modal or non-modal dialog. `showModal()` gives you a top-layer modal with a `::backdrop`, focus moved into the dialog, `Escape` to close, and the rest of the page made inert — work that used to need a library.

**Explanation.**

```html
<button type="button" onclick="confirmDlg.showModal()">Delete</button>

<dialog id="confirmDlg" aria-labelledby="dlg-title">
  <h2 id="dlg-title">Delete this file?</h2>
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```

```js
confirmDlg.addEventListener('close', () => {
  if (confirmDlg.returnValue === 'delete') deleteFile();
});
```

A form with `method="dialog"` closes the dialog and sets `returnValue` to the clicked button's `value` — no submit handler needed. `closedby="any"` enables closing by clicking the backdrop where supported.

**Watch out.** `show()` opens a *non-modal* dialog — no backdrop, no inert background. Use `showModal()` for true modals. Focus returns to the trigger on close automatically.

---

## Q42. What is the Popover API?

**Short answer.** The `popover` attribute turns any element into a top-layer popup — menus, tooltips, toasts — with light dismiss (click outside or `Escape`), no z-index fights, and no JavaScript required.

**Explanation.**

```html
<button popovertarget="menu">Options</button>
<div id="menu" popover>
  <button>Rename</button>
  <button>Duplicate</button>
</div>
```

| Value | Behavior |
|---|---|
| `popover` / `popover="auto"` | Light dismiss; opening one closes other auto popovers |
| `popover="manual"` | Only closes when you close it (toasts) |
| `popover="hint"` | For tooltips; doesn't close auto popovers |

Combine with CSS anchor positioning to place the popover next to its trigger.

**Watch out.** Popover vs dialog: a popover is non-modal — the rest of the page stays interactive. If the user must respond before continuing, use `<dialog>` with `showModal()`.

---

## Q43. What are `<details>` and `<summary>`?

**Short answer.** A native disclosure widget: `<summary>` is the always-visible toggle, the rest is shown when open. Keyboard and screen-reader support is built in. The `name` attribute groups several into an exclusive accordion.

**Explanation.**

```html
<details name="faq" open>
  <summary>How do refunds work?</summary>
  <p>Refunds are processed within 5 business days.</p>
</details>
<details name="faq">
  <summary>Can I change plans?</summary>
  <p>Yes, at any time.</p>
</details>
```

Listen for the `toggle` event to react in JavaScript. Content inside closed `<details>` is still found by find-in-page, which opens the element automatically.

**Watch out.** Don't put interactive elements (links, buttons) inside `<summary>` — they conflict with its own toggle behavior.

---

## Q44. What are `<template>` and `<slot>`?

**Short answer.** `<template>` holds inert markup that isn't rendered or executed until cloned with JavaScript. `<slot>` is a placeholder inside a web component's shadow DOM where the component's light-DOM children are projected.

**Explanation.**

```html
<template id="row">
  <tr><td class="name"></td><td class="price"></td></tr>
</template>
```

```js
const tpl = document.getElementById('row');
const row = tpl.content.cloneNode(true);
row.querySelector('.name').textContent = 'Widget';
tbody.append(row);
```

Declarative Shadow DOM lets the server render shadow roots in plain HTML:

```html
<user-card>
  <template shadowrootmode="open">
    <style>:host { display: block; border: 1px solid; }</style>
    <slot name="name"></slot>
  </template>
  <span slot="name">Ana</span>
</user-card>
```

**Watch out.** Images in a `<template>` don't load and scripts don't run until the content is inserted into the document — that's the point, but it surprises people who expect preloading.

---

## Q45. What are Web Components?

**Short answer.** A set of browser standards for reusable custom elements: Custom Elements (define `<my-tag>` with a class), Shadow DOM (encapsulated DOM and styles), and templates/slots. They work in any framework or none.

**Explanation.**

```js
class CopyButton extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<button type="button">Copy</button>`;
    this.querySelector('button').addEventListener('click', () =>
      navigator.clipboard.writeText(this.getAttribute('text'))
    );
  }
}
customElements.define('copy-button', CopyButton);
```

```html
<copy-button text="npm install acme"></copy-button>
```

Custom element names must contain a hyphen, so they never collide with future HTML elements.

**Watch out.** Shadow DOM also encapsulates accessibility relationships — a `<label for>` outside can't point to an `<input>` inside a shadow root. Form-associated custom elements and `ElementInternals` exist to address part of this.

---

## Q46. What do `contenteditable`, `hidden`, `inert`, and `translate` do?

**Short answer.** Global attributes worth knowing: `contenteditable` makes any element editable; `hidden` removes an element from rendering; `inert` makes a subtree non-interactive and hidden from assistive technology; `translate="no"` tells translation tools to leave content alone.

**Explanation.**

```html
<div contenteditable="plaintext-only">Edit me</div>
<section hidden>Shown later by script</section>
<div hidden="until-found">Revealed by find-in-page</div>
<main inert>…background while a custom modal is open…</main>
<span translate="no">Acme Cloud</span>
```

**Watch out.** `hidden` is overridden by any CSS that sets `display` on the element (e.g. `.card { display: flex }`). Add `[hidden] { display: none !important; }` to your base styles.

---

# Part 8 — SEO and Metadata

## Q47. Which tags matter most for SEO?

**Short answer.** A unique, descriptive `<title>`; a `<meta name="description">`; a clean heading structure; descriptive link text; `alt` text; a canonical URL; and crawlable links (`<a href>`, not click handlers). Content and performance matter more than any meta tag.

**Explanation.**

```html
<title>Running Shoes for Flat Feet | Acme</title>
<meta name="description" content="Compare 24 stability running shoes, tested by podiatrists.">
<link rel="canonical" href="https://acme.com/shoes/flat-feet">
<meta name="robots" content="index, follow">
```

- **Canonical** — tells search engines which URL is the original when the same content is reachable at several (`?sort=price`, tracking params).
- **Robots** — `noindex` keeps a page out of results; `nofollow` stops link-following.

**Watch out.** `<meta name="keywords">` has been ignored by Google for over 15 years. Mentioning it as an SEO technique is a red flag.

---

## Q48. What are Open Graph and Twitter Card tags?

**Short answer.** Metadata that controls how a link looks when shared on social platforms and chat apps — title, description, image, and type.

**Explanation.**

```html
<meta property="og:title" content="How we cut build times by 70%">
<meta property="og:description" content="Notes from migrating to Turbopack.">
<meta property="og:image" content="https://acme.com/og/build-times.png">
<meta property="og:url" content="https://acme.com/blog/build-times">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
```

**Watch out.** `og:image` must be an absolute URL, and crawlers don't run JavaScript — tags injected client-side are invisible to them. Recommended image size is 1200×630.

---

## Q49. What is structured data (JSON-LD)?

**Short answer.** Machine-readable descriptions of page content using the schema.org vocabulary, embedded in a `<script type="application/ld+json">`. Search engines use it for rich results — ratings, prices, FAQs, breadcrumbs, events.

**Explanation.**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Trail Runner 3",
  "offers": { "@type": "Offer", "price": "129.00", "priceCurrency": "USD" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "212" }
}
</script>
```

**Watch out.** Structured data must match visible content. Marking up reviews or prices that users can't see violates search guidelines and can get rich results removed.

---

## Q50. How do you handle a multilingual site?

**Short answer.** Set `lang` on `<html>`, use separate URLs per language, link versions together with `hreflang` alternates, and set `dir="rtl"` for right-to-left languages.

**Explanation.**

```html
<html lang="ar" dir="rtl">
<head>
  <link rel="alternate" hreflang="en" href="https://acme.com/en/pricing">
  <link rel="alternate" hreflang="ar" href="https://acme.com/ar/pricing">
  <link rel="alternate" hreflang="x-default" href="https://acme.com/pricing">
</head>
```

Use CSS logical properties (`margin-inline-start` instead of `margin-left`) so layouts flip correctly for RTL.

**Watch out.** `hreflang` annotations must be reciprocal — every version must list all the others, including itself — or search engines ignore them.

---

# Part 9 — Security

## Q51. Why use `rel="noopener noreferrer"` on external links?

**Short answer.** A page opened with `target="_blank"` used to get a `window.opener` reference to your page and could redirect it to a phishing page ("reverse tabnabbing"). `noopener` removes that reference; `noreferrer` also hides the `Referer` header.

**Explanation.**

```html
<a href="https://external.example" target="_blank" rel="noopener noreferrer">Partner site</a>
```

Modern browsers now apply `noopener` by default for `target="_blank"`, but adding it explicitly still matters for older browsers and makes intent clear.

**Watch out.** `noreferrer` breaks referral analytics for the destination site. Use only `noopener` if partners need to see where traffic came from — or set a `referrerpolicy`.

---

## Q52. How do you sandbox an `<iframe>`?

**Short answer.** The `sandbox` attribute applies maximum restrictions — no scripts, no forms, no popups, unique origin — and you add back only what's needed with tokens like `allow-scripts` or `allow-forms`. The `allow` attribute controls feature access (camera, geolocation, fullscreen).

**Explanation.**

```html
<iframe src="https://widgets.example.com/embed"
        sandbox="allow-scripts allow-popups"
        allow="fullscreen"
        referrerpolicy="no-referrer"
        loading="lazy"
        title="Pricing calculator"></iframe>
```

To stop *your* page being framed by others (clickjacking), send `Content-Security-Policy: frame-ancestors 'self'` (or the older `X-Frame-Options: DENY`).

**Watch out.** `allow-scripts` together with `allow-same-origin` on same-origin content lets the framed page remove its own sandbox. Never combine them for untrusted content. Every iframe also needs a `title` for accessibility.

---

## Q53. Where does XSS enter through HTML?

**Short answer.** Anywhere untrusted data is inserted as markup rather than text: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `javascript:` URLs, inline event handler attributes, and unescaped server templates.

**Explanation.**

```js
el.innerHTML = userComment;          // dangerous — <img src=x onerror=alert(1)> runs
el.textContent = userComment;        // safe — treated as text

el.setHTML(userComment);             // Sanitizer API: parses and strips unsafe content
el.innerHTML = DOMPurify.sanitize(userComment);  // library fallback
```

Defenses in depth:

- Escape output by context (HTML body, attribute, URL, JS).
- A Content Security Policy that blocks inline scripts.
- Trusted Types to make dangerous sinks reject raw strings.
- Validate URL schemes (`https:` only) before putting user data in `href`/`src`.

**Watch out.** `sandbox` and CSP are mitigations, not substitutes for escaping. And an HTML `<meta http-equiv="Content-Security-Policy">` can't set `frame-ancestors` or reporting — set CSP as an HTTP header when you can.

---

## Q54. What is Subresource Integrity (SRI)?

**Short answer.** An `integrity` attribute with a hash of the expected file. If a CDN serves a modified script or stylesheet, the hash won't match and the browser refuses to run it.

**Explanation.**

```html
<script src="https://cdn.example.com/lib@4.2.0/lib.min.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

**Watch out.** SRI only works with version-pinned URLs. A "latest" URL changes content on every release and breaks the hash — which is the point: you shouldn't load unpinned third-party code.

---

# Part 10 — How Browsers Parse HTML

## Q55. Why doesn't invalid HTML throw an error?

**Short answer.** The HTML parsing algorithm is specified to recover from errors in a defined way, so every browser builds the same DOM from the same broken markup. Missing end tags are inferred, misnested tags are restructured, and unknown elements become `HTMLUnknownElement`.

**Explanation.**

```html
<p>One
<p>Two
<!-- Parsed as two separate <p> elements: the second <p> implicitly closes the first -->

<table><div>oops</div><tr><td>cell</td></tr></table>
<!-- The <div> is "foster-parented" — moved before the <table> in the DOM -->
```

**Watch out.** "It renders fine" doesn't mean the DOM matches your source. Check the Elements panel, not View Source — they can differ dramatically, and frameworks that hydrate expect them to match.

---

## Q56. What's the difference between HTML source and the DOM?

**Short answer.** HTML is text sent over the network. The DOM is the live object tree the browser builds from it — then modified by the parser's error recovery, by JavaScript, and by browser extensions.

**Explanation.** The DOM is what CSS selectors match, what `querySelector` searches, what screen readers read (via the accessibility tree), and what you see in DevTools. View Source shows only the original text.

Related trees:

| Tree | Built from | Used for |
|---|---|---|
| DOM | HTML + scripts | Scripting, selectors |
| CSSOM | Stylesheets | Computing styles |
| Render tree | DOM + CSSOM (visible nodes only) | Layout and paint |
| Accessibility tree | DOM + ARIA + computed roles/names | Assistive technology |

**Watch out.** Elements with `display: none` are in the DOM but not in the render tree or the accessibility tree. `visibility: hidden` elements take up space but are hidden from screen readers; `opacity: 0` elements are still read by screen readers and still clickable.

---

## Q57. When do `DOMContentLoaded` and `load` fire?

**Short answer.** `DOMContentLoaded` fires when the HTML is fully parsed and deferred scripts have run — stylesheets and images may still be loading. `load` fires when everything, including images, iframes, and stylesheets, has finished.

**Explanation.**

```js
document.addEventListener('DOMContentLoaded', () => { /* DOM ready, start the app */ });
window.addEventListener('load', () => { /* all resources loaded */ });
```

Page lifecycle events beyond these: `pageshow`/`pagehide` (fire on bfcache restores too), and `visibilitychange` (tab hidden or shown — the reliable place to send analytics before the user leaves).

**Watch out.** Don't use `unload` or `beforeunload` for analytics — they're unreliable on mobile and `unload` blocks bfcache. Use `visibilitychange` with `navigator.sendBeacon()`.

---

# Part 11 — Rapid-Fire and Markup Puzzles

## Q58. What's wrong with this markup?

```html
<p>
  <div class="card">Hello</div>
</p>
```

<details><summary>Answer</summary>

`<p>` can only contain phrasing content. The parser closes the `<p>` when it sees `<div>`, producing an empty `<p>`, the `<div>`, then a stray `</p>` that creates another empty `<p>`. Use a `<div>` wrapper, or replace the inner `<div>` with a `<span>`.
</details>

---

## Q59. Why doesn't this "button" work for keyboard users?

```html
<div class="btn" onclick="checkout()">Checkout</div>
```

<details><summary>Answer</summary>

A `<div>` isn't focusable, doesn't respond to Enter or Space, and isn't announced as a button. Replace it with `<button type="button" onclick="checkout()">Checkout</button>`.
</details>

---

## Q60. Why does clicking "Add item" reload the page?

```html
<form action="/order">
  <input name="item">
  <button onclick="addRow()">Add item</button>
  <button>Place order</button>
</form>
```

<details><summary>Answer</summary>

A `<button>` inside a form defaults to `type="submit"`, so "Add item" submits the form. Set `type="button"` on it.
</details>

---

## Q61. What's wrong with these images?

```html
<img src="hero.jpg" loading="lazy">
<img src="spacer.gif">
```

<details><summary>Answer</summary>

The hero is lazy-loaded (hurts LCP), has no `width`/`height` (causes layout shift), and has no `alt`. The spacer has no `alt` — screen readers may read the file name; give it `alt=""`, or better, remove it and use CSS spacing.
</details>

---

## Q62. Why is this a security issue?

```html
<a href="https://partner.example" target="_blank">Partner</a>
<div id="bio"></div>
<script>bio.innerHTML = new URLSearchParams(location.search).get('bio');</script>
```

<details><summary>Answer</summary>

The `innerHTML` line is reflected DOM XSS — `?bio=<img src=x onerror=alert(document.cookie)>` runs script. Use `textContent`. The link should also carry `rel="noopener"` for older browsers.
</details>

---

## Q63. Why is the disabled field missing from the submitted data?

```html
<form method="post">
  <input name="plan" value="pro" disabled>
  <button>Continue</button>
</form>
```

<details><summary>Answer</summary>

Disabled controls are never submitted. Use `readonly` (for text-like inputs) if the value should be sent but not edited, or a `type="hidden"` input alongside the visible disabled one.
</details>

---

## Q64. Quick definitions

| Term | One line |
|---|---|
| **DOCTYPE** | Declaration that triggers standards mode |
| **Void element** | Element with no content and no end tag (`<img>`, `<input>`) |
| **Semantic HTML** | Choosing elements by meaning, not appearance |
| **Landmark** | Region role (`main`, `nav`, …) screen-reader users can jump between |
| **Accessible name** | What assistive technology announces for an element |
| **ARIA** | Attributes that adjust the accessibility tree — no behavior |
| **Live region** | Element whose changes are announced without moving focus |
| **`srcset` / `sizes`** | Candidate images and their display width for responsive loading |
| **`defer`** | Download in parallel, run after parsing, in order |
| **`async`** | Download in parallel, run as soon as ready, in any order |
| **Critical rendering path** | DOM + CSSOM → render tree → layout → paint |
| **Top layer** | Layer above all z-index, used by `<dialog>` and popovers |
| **`inert`** | Makes a subtree non-interactive and hidden from assistive tech |
| **Canonical URL** | The preferred URL for duplicate content |
| **SRI** | Hash check that blocks tampered third-party files |
| **bfcache** | Browser cache of full pages for instant back/forward |

---

# Appendix — A 10-day study plan

| Day | Focus | Prove it by |
|---|---|---|
| 1 | Document structure, `<head>`, doctype, charset, viewport | Writing a valid page skeleton from memory and explaining each line |
| 2 | Semantic elements, landmarks, headings | Rewriting a div-soup page with landmarks and a correct heading outline |
| 3 | Forms — labels, input types, buttons, fieldsets | A signup form that's fully usable with keyboard only |
| 4 | Validation and `autocomplete` | Custom validation messages with the Constraint Validation API |
| 5 | Accessibility — alt text, ARIA rules, accessible names, focus | Passing an axe scan and a screen-reader walkthrough of your form |
| 6 | Responsive images, `<picture>`, lazy loading, media | Cutting image bytes in half on a product page with no layout shift |
| 7 | Script loading, critical rendering path, resource hints | Moving a page's LCP under 2.5s on a throttled connection |
| 8 | `<dialog>`, popover, `<details>`, templates, web components | A confirm dialog and a menu built with zero JavaScript libraries |
| 9 | SEO metadata, Open Graph, structured data, i18n | A blog post that previews correctly when shared and passes rich-result tests |
| 10 | Security — XSS sinks, iframe sandbox, SRI, `noopener` | Finding and fixing every injection point in a small demo page |

---

## Final note

The questions that separate a good HTML answer from a memorized one are almost always about **meaning** and **built-in behavior**. If you can explain what a `<button>` gives you that a `<div>` doesn't, and why the browser's DOM may not match your source, you understand HTML.
