# Frontend Developer Interview — Questions & Answers

React.js · Next.js · TypeScript · Tailwind · REST APIs · State · Performance · SEO · Browser · AI-assisted development · Testing · Git · DevOps · Behavioral · Tricky questions · Streaming/OTT (Toffee)

183 questions with answers, each with a short Bangla (বাংলা) explanation.

## Contents

- [0. Warm-up](#0-warm-up)
- [1. JavaScript & TypeScript](#1-javascript--typescript)
- [2. React.js](#2-reactjs)
- [3. Next.js](#3-nextjs)
- [4. HTML, CSS, Tailwind & Figma](#4-html-css-tailwind--figma)
- [5. REST APIs & State](#5-rest-apis--state)
- [6. Performance, SEO & Browsers](#6-performance-seo--browsers)
- [6b. Browser & networking](#6b-browser--networking)
- [7. AI-assisted development](#7-ai-assisted-development)
- [8. Testing](#8-testing)
- [9. Git, code review & clean code](#9-git-code-review--clean-code)
- [10. Docker, CI/CD, cloud & Node](#10-docker-cicd-cloud--node)
- [11. Behavioral (STAR)](#11-behavioral-star)
- [12. Tricky & trap questions](#12-tricky--trap-questions)
- [13. Toffee & streaming (OTT) frontend](#13-toffee--streaming-ott-frontend)

---

## 0. Warm-up

### Q1. Introduce yourself in 60 seconds.

> "Hi, I'm [Name]. I'm a frontend developer with [X] years of experience building responsive web apps with React, Next.js and TypeScript. Most recently at [Company/Project], I [built a dashboard / e-commerce site / SaaS app] where I converted Figma designs into reusable Tailwind components, integrated REST APIs using TanStack Query, and improved Lighthouse performance from [X] to [Y].
>
> I use AI tools like GitHub Copilot and Claude daily — for scaffolding components, writing tests and debugging — but I always review the output for security, types and edge cases before it goes into a PR. I enjoy working closely with designers and backend developers, and I'm looking for a team where I can ship quality product fast. That's why this role caught my attention."

**Why this works:** it touches every major keyword in the JD (React, Next.js, TypeScript, Figma, Tailwind, REST, state, performance, AI tools, collaboration) in under a minute, and ends with a reason you want the job.

**বাংলায়:**

"আসসালামু আলাইকুম, আমি [Name]। আমি একজন frontend developer, [X] বছর ধরে React, Next.js আর TypeScript দিয়ে responsive web app বানাচ্ছি। সম্প্রতি [Company/Project]-এ আমি একটা [dashboard / e-commerce site / SaaS app] বানিয়েছি, যেখানে Figma design থেকে reusable Tailwind component বানিয়েছি, TanStack Query দিয়ে REST API integrate করেছি, আর Lighthouse performance [X] থেকে [Y]-তে নিয়ে গেছি।

আমি প্রতিদিন GitHub Copilot আর Claude-এর মতো AI tool ব্যবহার করি — component scaffold করা, test লেখা আর debug করার জন্য — কিন্তু PR-এ যাওয়ার আগে সবসময় output-টা security, type আর edge case-এর দিক থেকে review করি। Designer আর backend developer-দের সাথে closely কাজ করতে আমার ভালো লাগে, আর আমি এমন একটা team খুঁজছি যেখানে quality product দ্রুত ship করতে পারব। এজন্যই এই role-টা আমার নজরে এসেছে।"

**কেন এটা কাজ করে:** এক মিনিটের মধ্যে JD-এর সব বড় keyword (React, Next.js, TypeScript, Figma, Tailwind, REST, state, performance, AI tool, collaboration) ছুঁয়ে যায়, আর শেষে বলে দেয় কেন আপনি job-টা চান।

### Q2. What formula should you use to answer any technical question?

1. **Define** it in one sentence.
2. **Explain why** it exists or what problem it solves.
3. **Give an example** from code or a project you did.
4. **Mention a trade-off or pitfall** — this is what separates mid-level from senior answers.

**বাংলায়:**

যেকোনো technical প্রশ্নের উত্তর এই চার ধাপে দিন:

- **Define করুন** — এক বাক্যে বলুন জিনিসটা কী।
- **Why বলুন** — কেন এটা আছে, বা কোন problem solve করে।
- **Example দিন** — code থেকে, বা নিজের করা কোনো project থেকে।
- **একটা trade-off বা pitfall বলুন** — এটাই mid-level আর senior উত্তরের মধ্যে পার্থক্য তৈরি করে।

---

## 1. JavaScript & TypeScript

### Q1. What is the difference between `var`, `let` and `const`?

**Say this:** `var` is function-scoped and hoisted with `undefined`; `let` and `const` are block-scoped and sit in a "temporal dead zone" until declared. `const` prevents reassignment, not mutation.

**Deeper:** `const user = {name: 'A'}; user.name = 'B'` is allowed, because the binding is constant but the object is not. In modern code, default to `const`, use `let` when you must reassign, and avoid `var`.

**বাংলায়:**

`var` হলো function-scoped, আর hoist হয়ে `undefined` value পায়। `let` আর `const` block-scoped, declare হওয়ার আগ পর্যন্ত "temporal dead zone"-এ থাকে। `const` reassignment আটকায়, কিন্তু mutation না — মানে `const user` object-এর `user.name` বদলানো যায়। Modern code-এ default `const`, reassign লাগলে `let`, আর `var` এড়িয়ে চলুন।

### Q2. Explain closures with a real use case.

**Say this:** A closure is a function that remembers the variables from the scope where it was created, even after that scope has finished running.

```javascript
function createCounter() {
  let count = 0;
  return () => ++count;
}
const next = createCounter();
next(); // 1
next(); // 2
```

**Real use in React:** every event handler and `useEffect` callback is a closure. The classic bug is a **stale closure** — a `setInterval` inside `useEffect` with an empty dependency array keeps reading the first value of state. Fix it with the functional updater `setCount(c => c + 1)` or by adding dependencies.

**বাংলায়:**

Closure হলো এমন একটা function, যেটা যে scope-এ তৈরি হয়েছে সেখানকার variable মনে রাখে — ওই scope শেষ হয়ে গেলেও। যেমন `createCounter`-এর ভেতরের `count` বাইরে থেকে access করা যায় না, কিন্তু returned function সেটা বাড়াতে পারে। React-এ প্রতিটা event handler আর `useEffect` callback-ই closure। Common bug হলো stale closure: empty dependency array-সহ `useEffect`-এর ভেতরে `setInterval` সবসময় state-এর প্রথম value পড়ে। Fix হলো `setCount(c => c + 1)` functional updater, অথবা dependency যোগ করা।

### Q3. How does the event loop work?

**Say this:** JavaScript is single-threaded. Synchronous code runs on the call stack; async callbacks wait in queues. When the stack is empty, the event loop first drains the **microtask queue** (Promises, `queueMicrotask`), then takes one **macrotask** (`setTimeout`, I/O, events).

```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
// Output: A, D, C, B
```

**বাংলায়:**

JavaScript single-threaded। Synchronous code call stack-এ চলে, আর async callback queue-তে অপেক্ষা করে। Stack খালি হলে event loop আগে পুরো microtask queue (Promise, `queueMicrotask`) শেষ করে, তারপর একটা macrotask (`setTimeout`, I/O, event) নেয়। তাই example-এর output হবে A, D, C, B — Promise-এর C আগে আসে, `setTimeout`-এর B পরে।

### Q4. `==` vs `===`?

`===` compares value and type with no conversion; `==` coerces types first (`'1' == 1` is true). Always use `===` except for the deliberate `x == null` check that covers both `null` and `undefined`.

**বাংলায়:**

`===` কোনো conversion ছাড়াই value আর type দুটোই compare করে। `==` আগে type coerce করে, তাই `'1' == 1` true হয়। সবসময় `===` ব্যবহার করুন। একমাত্র ব্যতিক্রম হলো ইচ্ছা করে `x == null` check, যেটা `null` আর `undefined` দুটোই ধরে।

### Q5. Explain `this`, and arrow functions vs regular functions.

**Say this:** In a regular function, `this` depends on how the function is called. Arrow functions don't have their own `this`; they take it from the surrounding scope. Arrow functions also have no `arguments` object and can't be used as constructors.

**বাংলায়:**

Regular function-এ `this` কী হবে সেটা নির্ভর করে function-টা কীভাবে call করা হলো তার ওপর। Arrow function-এর নিজের `this` নেই, সে বাইরের scope থেকে `this` নেয়। এছাড়া arrow function-এ `arguments` object নেই, আর এটাকে constructor হিসেবে ব্যবহার করা যায় না।

### Q6. Promises vs async/await, and how do you handle errors?

`async/await` is syntax on top of Promises that makes async code read top-down. Handle errors with `try/catch`. Run independent requests in parallel with `Promise.all` (fails fast on any rejection) or `Promise.allSettled` (waits for all, reports each result).

```javascript
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

**বাংলায়:**

`async/await` হলো Promise-এর ওপর একটা syntax, যেটা async code-কে ওপর থেকে নিচে পড়ার মতো সহজ করে। Error handle করা হয় `try/catch` দিয়ে। Independent request parallel-এ চালাতে `Promise.all` ব্যবহার করুন — কোনো একটা reject হলেই এটা সাথে সাথে fail করে। আর সবগুলোর result আলাদা করে চাইলে `Promise.allSettled`, যেটা সবার শেষ হওয়া পর্যন্ত অপেক্ষা করে।

### Q7. What are debounce and throttle? When do you use each?

**Debounce** waits until calls stop for N ms (search input, autosave). **Throttle** runs at most once every N ms (scroll, resize, mouse move).

```javascript
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

This is a very common live-coding question — practice writing it from memory.

**বাংলায়:**

Debounce call থামার পর N ms অপেক্ষা করে তারপর চালায় — search input বা autosave-এ লাগে। Throttle প্রতি N ms-এ সর্বোচ্চ একবার চালায় — scroll, resize, mouse move-এ লাগে। Debounce-এর implementation-এ closure-এ একটা `timer` রাখা হয়, প্রতি call-এ `clearTimeout` করে নতুন `setTimeout` বসানো হয়। এটা খুব common live-coding প্রশ্ন, তাই মুখস্থ লিখতে পারার মতো practice করে রাখুন।

### Q8. Shallow copy vs deep copy?

Spread (`{...obj}`) and `Object.assign` copy one level; nested objects are still shared. For a deep copy use `structuredClone(obj)` (modern browsers and Node 17+). It can't clone functions or DOM nodes (it throws), and class instances come back as plain objects (prototype lost). This matters in React because state must be updated immutably.

**বাংলায়:**

Spread (`{...obj}`) আর `Object.assign` শুধু এক level copy করে, nested object তখনও shared থাকে। Deep copy-র জন্য `structuredClone(obj)` ব্যবহার করুন (modern browser আর Node 17+)। তবে এটা function বা DOM node clone করতে পারে না (throw করে), আর class instance plain object হয়ে ফেরে, prototype হারিয়ে যায়। React-এ এটা গুরুত্বপূর্ণ, কারণ state সবসময় immutable-ভাবে update করতে হয়।

### Q9. Why TypeScript? What benefits have you seen?

**Say this:** TypeScript catches bugs at compile time, documents the shape of data, and makes refactoring safe because the editor finds every broken usage. It also makes AI-generated code safer, since type errors expose many hallucinated properties immediately.

**বাংলায়:**

TypeScript compile time-এই bug ধরে ফেলে, data-র shape document করে, আর refactoring safe করে — কারণ editor প্রতিটা ভাঙা usage খুঁজে দেয়। AI-generated code-ও এতে বেশি safe হয়, কারণ type error দিয়ে অনেক hallucinated property সাথে সাথে ধরা পড়ে।

### Q10. `interface` vs `type`?

Both describe object shapes. `interface` can be extended and **merged** (declared twice, combined) — good for public APIs and objects. `type` can express unions, intersections, tuples and mapped types. Many teams use `type` by default and `interface` for extendable component props; the key is consistency.

```typescript
type Status = 'idle' | 'loading' | 'success' | 'error';
interface ButtonProps { label: string; onClick: () => void; }
```

**বাংলায়:**

দুটোই object-এর shape describe করে। `interface` extend করা যায় আর merge হয় (দুইবার declare করলে একসাথে মিলে যায়) — public API আর object-এর জন্য ভালো। `type` দিয়ে union, intersection, tuple আর mapped type লেখা যায়, যেমন `'idle' | 'loading'`। অনেক team default-এ `type` আর extendable component props-এর জন্য `interface` ব্যবহার করে; আসল কথা হলো consistency রাখা।

### Q11. `any` vs `unknown` vs `never`?

- `any` turns off type checking — avoid it.
- `unknown` is the safe "I don't know yet": you must narrow it (`typeof`, type guard, Zod parse) before using it. Use it for API responses and `catch` errors.
- `never` means a value that can't exist; useful for exhaustive `switch` checks.

**বাংলায়:**

- `any` type checking পুরো বন্ধ করে দেয় — এটা এড়িয়ে চলুন।
- `unknown` হলো safe "এখনো জানি না": ব্যবহারের আগে narrow করতে হয় (`typeof`, type guard, Zod parse)। API response আর `catch` error-এর জন্য এটা ব্যবহার করুন।
- `never` মানে এমন value যেটা থাকতেই পারে না; exhaustive `switch` check-এ কাজে লাগে।

### Q12. What are generics? Give an example.

Generics let a function or component work with many types while staying type-safe.

```typescript
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
const users = await fetchJson<User[]>('/api/users');
```

Note: the cast is not checked at runtime — combine with Zod (see Q14).

**বাংলায়:**

Generics দিয়ে একটা function বা component অনেক রকম type-এর সাথে কাজ করতে পারে, আবার type-safe-ও থাকে। যেমন `fetchJson<T>` একবার লিখে `fetchJson<User[]>('/api/users')` call করলে result-এর type `User[]` হয়ে যায়। এতে প্রতিটা API-র জন্য আলাদা function লিখতে হয় না। তবে এটা শুধু cast, runtime-এ check হয় না — তাই Q14-এর মতো Zod দিয়ে validate করুন।

### Q13. Name utility types you use.

`Partial<T>` (all optional — update forms), `Required<T>`, `Pick<T, K>`, `Omit<T, K>` (e.g. a create form without `id`), `Record<K, V>` (lookup maps), `ReturnType<typeof fn>`, and `ComponentProps<'button'>` to extend native element props.

**বাংলায়:**

- `Partial<T>` সব field optional করে — update form-এ কাজে লাগে।
- `Pick<T, K>` আর `Omit<T, K>` দিয়ে কিছু field নেওয়া বা বাদ দেওয়া যায়, যেমন `id` ছাড়া create form।
- `Record<K, V>` lookup map-এর জন্য, `ReturnType<typeof fn>` function-এর return type বের করতে, আর `Required<T>` সব field required করতে।
- `ComponentProps<'button'>` দিয়ে native element-এর props extend করা যায়।

### Q14. How do you type API responses safely?

Types vanish at runtime, so the server can still send something unexpected. Define a schema with a library like **Zod**, validate at the boundary, then infer the type from it: `type User = z.infer<typeof UserSchema>`. Mentioning runtime validation is a strong signal of maturity.

**বাংলায়:**

Runtime-এ type থাকে না, তাই server অপ্রত্যাশিত কিছু পাঠাতেই পারে। এজন্য **Zod**-এর মতো library দিয়ে একটা schema define করুন, boundary-তে validate করুন, তারপর schema থেকেই type infer করুন: `type User = z.infer<typeof UserSchema>`। Interview-এ runtime validation-এর কথা বললে বোঝা যায় আপনি mature developer।

---

## 2. React.js

### Q1. What is the Virtual DOM and how does reconciliation work?

**Say this:** React keeps a lightweight in-memory tree of the UI. When state changes, it builds a new tree, compares it to the old one (diffing), and applies only the minimal changes to the real DOM. It assumes elements of different types produce different trees, and it uses `key` to match list items between renders.

**বাংলায়:**

React memory-তে UI-এর একটা হালকা tree রাখে। State change হলে নতুন tree বানায়, পুরনোটার সাথে compare করে (diffing), আর real DOM-এ শুধু minimum change গুলো apply করে। React ধরে নেয় ভিন্ন type-এর element ভিন্ন tree তৈরি করে, আর list item মেলাতে `key` ব্যবহার করে।

### Q2. Why are keys important in lists? Why not use the index?

Keys tell React which item is which between renders. Using the array index breaks when items are inserted, removed or reordered: React reuses the wrong component, so input values, focus or local state jump to the wrong row. Use a stable unique id from the data. Index is acceptable only for static lists that never change order.

**বাংলায়:**

Key দিয়ে React এক render থেকে আরেক render-এ বোঝে কোন item কোনটা। Array index key হলে item insert, remove বা reorder করলে React ভুল component reuse করে — input value, focus বা local state ভুল row-তে চলে যায়। তাই data থেকে একটা stable unique id ব্যবহার করুন। Index চলবে শুধু এমন static list-এ, যেটার order কখনো বদলায় না।

### Q3. What causes a component to re-render?

A component re-renders when (1) its own state changes, (2) its parent re-renders, (3) a context it consumes changes, or (4) an external store it subscribes to (`useSyncExternalStore`, e.g. Zustand/Redux) changes. A parent re-render skips a child only if the child is wrapped in `React.memo` with equal props, or is the same element reference (e.g. passed in as `children`). Props changing is not a separate cause — it happens because the parent re-rendered. A re-render is not automatically a DOM update; React only touches the DOM if output differs.

**বাংলায়:**

Component re-render হয় চার কারণে: নিজের state change, parent re-render, consume করা context change, অথবা subscribe করা external store (`useSyncExternalStore`, যেমন Zustand/Redux) change। Parent re-render হলেও child-এর re-render skip হয় শুধু তখনই, যদি child `React.memo`-তে wrapped থাকে আর props equal হয়, বা একই element reference হয় (যেমন `children` হিসেবে পাঠানো)। Props change আলাদা কারণ না — সেটা parent re-render-এর জন্যই হয়। আর re-render মানেই DOM update না; output বদলালেই শুধু React DOM-এ হাত দেয়।

### Q4. Explain `useState` and why state updates look "async".

State updates are scheduled and **batched**, so the new value is available on the next render, not on the next line. When the new value depends on the old one, use the functional form:

```tsx
setCount(prev => prev + 1); // safe even if called multiple times
```

**বাংলায়:**

State update schedule আর batch হয়, তাই নতুন value পরের line-এ না, পরের render-এ পাওয়া যায়। এজন্য মনে হয় update "async"। নতুন value যদি পুরনো value-র ওপর নির্ভর করে, তাহলে functional form ব্যবহার করুন: `setCount(prev => prev + 1)` — একাধিকবার call করলেও এটা safe।

### Q5. Explain `useEffect` — dependencies and cleanup.

**Say this:** `useEffect` synchronizes a component with something outside React (subscriptions, timers, manual DOM, analytics). It usually runs after the browser paints (effects caused by a click or keypress can run before paint). The dependency array controls when it re-runs, and the returned function cleans up before the next run and on unmount.

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${id}`, { signal: controller.signal })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(setUser)
    .catch(e => { if (e.name !== 'AbortError') setError(e); }); // ignore only aborts
  return () => controller.abort(); // avoids race conditions
}, [id]);
```

**Pitfalls to mention:** missing dependencies (stale data), objects/functions in dependencies causing infinite loops, and using effects for things that should be derived during render. In real apps, prefer TanStack Query or Server Components for data fetching instead of raw `useEffect`.

**বাংলায়:**

`useEffect` component-কে React-এর বাইরের জিনিসের সাথে sync রাখে — subscription, timer, manual DOM, analytics। এটা সাধারণত paint-এর পরে চলে (click-এর মতো interaction থেকে হলে paint-এর আগেও চলতে পারে)। Dependency array ঠিক করে কখন আবার চলবে, আর return করা function পরের run-এর আগে ও unmount-এ cleanup করে — যেমন `AbortController` দিয়ে fetch abort করে race condition এড়ানো। Pitfall হলো missing dependency (stale data), dependency-তে object/function দিয়ে infinite loop, আর render-এ derive করা যেত এমন জিনিসে effect ব্যবহার। Real app-এ data fetching-এর জন্য raw `useEffect`-এর বদলে TanStack Query বা Server Component ভালো।

### Q6. Why does `useEffect` run twice in development?

React 18+ **Strict Mode** mounts, unmounts and re-mounts components in development to expose effects that are missing cleanup. It does not happen in production. The fix is a correct cleanup function, not disabling Strict Mode.

**বাংলায়:**

React 18+-এর Strict Mode development-এ component mount, unmount, তারপর আবার mount করে, যাতে missing cleanup থাকা effect ধরা পড়ে। Production-এ এটা হয় না। Fix হলো সঠিক cleanup function লেখা, Strict Mode বন্ধ করা না।

### Q7. `useMemo` vs `useCallback` vs `React.memo`?

- `useMemo` caches a **computed value** (expensive filtering or sorting).
- `useCallback` caches a **function reference** so a memoized child doesn't re-render.
- `React.memo` wraps a **component** so it skips re-render when props are shallowly equal.

They work together: `React.memo` on a child is useless if you pass a new inline function every render. **Trade-off:** memoization has a cost; measure with React DevTools Profiler first. Also mention the **React Compiler** (1.0 stable since Oct 2025): it auto-memoizes, reducing manual use, but it's an opt-in build plugin, not built into React 19 (in Next.js: `reactCompiler: true` in `next.config.ts`).

**বাংলায়:**

- `useMemo` একটা computed value cache করে (expensive filter বা sort), `useCallback` function reference cache করে, আর `React.memo` component-কে wrap করে যাতে props shallowly equal হলে re-render skip হয়।
- এরা একসাথে কাজ করে: প্রতি render-এ নতুন inline function পাঠালে child-এর `React.memo` কোনো কাজে আসে না।
- Trade-off: memoization-এরও cost আছে, তাই আগে React DevTools Profiler দিয়ে measure করুন।
- React Compiler (Oct 2025 থেকে 1.0 stable) auto-memoize করে, তবে এটা opt-in build plugin, React 19-এ built-in না (Next.js-এ `next.config.ts`-এ `reactCompiler: true`)।

### Q8. What is `useRef` used for?

Two things: accessing DOM nodes (focus an input, measure size, scroll) and storing a mutable value that persists across renders **without** causing a re-render (timer ids, previous values).

**বাংলায়:**

`useRef`-এর দুইটা কাজ। এক, DOM node access করা — input focus, size measure বা scroll। দুই, এমন mutable value রাখা যেটা প্রতি render-এ একই থাকে কিন্তু বদলালে re-render হয় না, যেমন timer id বা previous value।

### Q9. What are custom hooks? Give an example.

A custom hook is a function starting with `use` that reuses stateful logic across components. It shares logic, not state — each component gets its own copy.

```tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

**বাংলায়:**

Custom hook হলো `use` দিয়ে শুরু হওয়া একটা function, যেটা একাধিক component-এ stateful logic reuse করে। এটা logic share করে, state না — প্রতিটা component নিজের আলাদা copy পায়। যেমন `useDebounce` একটা value নিয়ে delay শেষে debounced value return করে, আর cleanup-এ `clearTimeout` করে।

### Q10. What are the Rules of Hooks?

Call hooks only at the top level (not inside loops, conditions or nested functions) and only from React components or custom hooks. React tracks hooks by call order, so conditional calls break that order. One exception: React 19's `use()` can be called inside conditions and loops.

**বাংলায়:**

Hook শুধু top level-এ call করুন — loop, condition বা nested function-এর ভেতরে না — আর শুধু React component বা custom hook থেকে। কারণ React hook-গুলো call order দিয়ে track করে, conditional call করলে সেই order ভেঙে যায়। একটা ব্যতিক্রম: React 19-এর `use()` condition আর loop-এর ভেতরেও call করা যায়।

### Q11. Controlled vs uncontrolled components?

Controlled inputs keep their value in React state (`value` + `onChange`) — good for live validation. Uncontrolled inputs keep value in the DOM, read via `ref` or `FormData` — less re-rendering. **React Hook Form** uses uncontrolled inputs for performance, often paired with Zod for validation.

**বাংলায়:**

Controlled input-এর value React state-এ থাকে (`value` + `onChange`) — live validation-এর জন্য ভালো। Uncontrolled input-এর value DOM-এ থাকে, `ref` বা `FormData` দিয়ে পড়া হয় — এতে re-render কম হয়। React Hook Form performance-এর জন্য uncontrolled input ব্যবহার করে, আর validation-এর জন্য প্রায়ই Zod-এর সাথে ব্যবহার করা হয়।

### Q12. How do you design a reusable component?

Walk through these principles with a `Button` or `Modal` example:

1. **Typed, minimal props API** — extend native props so it behaves like a real element.
2. **Variants instead of booleans** — `variant="primary"` instead of `isPrimary`, `isDanger`.
3. **Composition over configuration** — accept `children` or compound parts (`<Card.Header>`) instead of 20 props.
4. **Pass `ref` through (a plain prop in React 19) and spread rest props** — so it works with forms, focus and tooltips.
5. **Accessible by default** — semantic element, focus styles, ARIA where needed.
6. **Style override** — accept `className` and merge with `tailwind-merge`.

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva('inline-flex items-center rounded-md font-medium transition focus-visible:ring-2 disabled:opacity-50', {
  variants: {
    variant: { primary: 'bg-blue-600 text-white hover:bg-blue-700', outline: 'border border-gray-300 hover:bg-gray-50' },
    size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof button>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  // default type="button" so it never submits a form by accident
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />;
}
```

Mention that this is the pattern used by **shadcn/ui**, which is common in Next.js + Tailwind projects. (In React 19, `ref` is a normal prop, so `forwardRef` is no longer needed.)

**বাংলায়:**

- Typed, minimal props API রাখুন, native props extend করুন যাতে real element-এর মতো behave করে।
- Boolean-এর বদলে variant (`variant="primary"`), আর ২০টা prop-এর বদলে composition (`children` বা `<Card.Header>`)।
- `ref` pass করুন (React 19-এ এটা plain prop, `forwardRef` আর লাগে না) আর rest props spread করুন; default `type="button"` দিন যাতে ভুল করে form submit না হয়।
- Default-এ accessible রাখুন (semantic element, focus style, দরকারে ARIA), আর `className` নিয়ে `tailwind-merge` দিয়ে merge করুন — এটাই shadcn/ui-এর `cva` pattern।

### Q13. How do you avoid prop drilling?

Options, in order: restructure with composition (pass components as `children`), use **Context** for low-frequency global values (theme, auth, locale), use **Zustand/Redux** for frequently changing shared client state, and use **TanStack Query** for server data. Context is not a performance-optimized state manager — every consumer re-renders when its value changes.

**বাংলায়:**

ক্রমানুসারে option হলো: composition দিয়ে restructure করা (component-কে `children` হিসেবে পাঠানো), কম বদলায় এমন global value-র জন্য Context (theme, auth, locale), ঘন ঘন বদলায় এমন shared client state-এর জন্য Zustand/Redux, আর server data-র জন্য TanStack Query। মনে রাখবেন, Context performance-optimized state manager না — value বদলালে প্রতিটা consumer re-render হয়।

### Q14. What are Error Boundaries?

Components that catch render errors in their child tree and show a fallback UI instead of a blank screen. They must be class components (or use the `react-error-boundary` library). They do not catch errors in plain event handlers or `setTimeout`/unawaited async code (though in React 19, errors thrown in Actions/transitions and rejected `use()` promises do reach the boundary). In Next.js App Router, `error.tsx` creates one per route segment; it must be a `'use client'` file, and it doesn't catch errors thrown in the same segment's `layout.tsx` (the parent's `error.tsx` does). Errors in the root layout need `app/global-error.tsx`.

**বাংলায়:**

Error Boundary হলো এমন component, যেটা child tree-এর render error ধরে blank screen-এর বদলে fallback UI দেখায়। এটা class component হতে হয় (অথবা `react-error-boundary` library)। সাধারণ event handler বা `setTimeout`-এর মতো async code-এর error এটা ধরে না (তবে React 19-এ Action/transition-এর error আর `use()`-এর rejected promise boundary-তে যায়)। Next.js App Router-এ `error.tsx` প্রতি route segment-এ একটা boundary বানায়; এটা `'use client'` file হতে হয়, আর একই segment-এর `layout.tsx`-এর error ধরে না (parent-এর `error.tsx` ধরে)। Root layout-এর error-এর জন্য `app/global-error.tsx` লাগে।

### Q15. What is new in React 19 that you know about?

Server Components and Server Functions/Actions as stable features; **Actions** — pass an async function to `<form action={...}>` and React handles pending state, errors and reset; `useActionState` and `useFormStatus` for forms; `useOptimistic` for optimistic UI; the `use()` hook for reading promises and context; `ref` as a regular prop; and native `<title>`/`<meta>`/`<link>` rendered anywhere and hoisted to `<head>`. React 19.2 added `<Activity>` (hide a subtree but keep its state) and `useEffectEvent` (read latest props/state in an effect without adding them as dependencies). The React Compiler (1.0) is a separate opt-in plugin for automatic memoization. You don't need every detail — knowing the direction shows you keep up.

**বাংলায়:**

- Server Component আর Server Functions/Actions এখন stable। Actions মানে `<form action={...}>`-এ async function দিলে React নিজেই pending state, error আর reset handle করে।
- Form-এর জন্য `useActionState` আর `useFormStatus`, optimistic UI-এর জন্য `useOptimistic`, promise আর context পড়ার জন্য `use()` hook, আর `ref` এখন regular prop।
- `<title>`/`<meta>`/`<link>` যেকোনো জায়গায় render করা যায়, React এগুলো `<head>`-এ hoist করে। React 19.2-এ এসেছে `<Activity>` (subtree hide করে কিন্তু state রাখে) আর `useEffectEvent` (dependency না বাড়িয়ে effect-এ latest props/state পড়া)।
- React Compiler (1.0) আলাদা opt-in plugin। সব detail জানা লাগবে না — direction জানলেই বোঝা যায় আপনি update থাকেন।

---

## 3. Next.js

### Q1. Why use Next.js instead of plain React (e.g. Vite)?

**Say this:** Next.js adds server-side rendering, static generation, file-based routing, image and font optimization, API routes, request interception (`proxy.ts`, called `middleware.ts` before Next 16) and built-in SEO metadata. Plain React renders in the browser, so the first HTML is empty — worse for SEO and first load on slow devices. (Create React App has been deprecated since February 2025; Vite or a framework is the default now.)

**বাংলায়:**

Next.js হলো React-এর উপর একটা framework, যেটা server-side rendering, static generation, file-based routing, image/font optimization আর SEO metadata built-in দেয়। Plain React browser-এ render হয়, তাই প্রথম HTML খালি থাকে। এতে SEO খারাপ হয় আর slow device-এ first load দেরি হয়। Next.js-এ server থেকেই ready HTML আসে, তাই এই সমস্যা থাকে না। (Create React App ২০২৫-এর ফেব্রুয়ারি থেকে deprecated, এখন Vite বা কোনো framework ব্যবহার হয়।)

### Q2. Explain SSR, SSG, ISR and CSR.

| Strategy | When HTML is built | Best for | App Router way |
| --- | --- | --- | --- |
| SSG (Static) | At build time | Marketing pages, blogs, docs | Default for routes with no dynamic data |
| ISR (Incremental Static Regeneration) | At build; after N seconds the next request gets the stale page and triggers a background re-build | Product listings, CMS content | `export const revalidate = 60` or `fetch(url, { next: { revalidate: 60 } })` |
| SSR (Dynamic) | On every request | Personalized pages, dashboards, auth data | Reading `searchParams`, `cookies()`, `headers()` or `connection()`, or `cache: 'no-store'` |
| CSR (Client) | In the browser after JS loads | Highly interactive widgets behind login | `'use client'` + TanStack Query (the component is still pre-rendered on the server for the first HTML; only the fetched data renders client-side) |

**Strong answer:** "I pick per page — static where possible for speed and cost, ISR for content that changes occasionally, dynamic only when the data is per-user." After a mutation, use on-demand revalidation: `revalidatePath('/products')` or `revalidateTag('products', 'max')` from a Server Action or webhook. Next 16 needs a cache profile as the 2nd argument, and `'max'` means stale-while-revalidate: the next visitor may still get the old page while it refreshes in the background. For immediate expiry from a webhook use `revalidateTag('products', { expire: 0 })`; inside a Server Action use `updateTag('products')` so the user sees their own write immediately.

**Next 16 (current):** with `cacheComponents: true` in `next.config.ts`, caching is explicit — mark a component or function with `'use cache'` and control it with `cacheLife('hours')` and `cacheTag('products')`. This enables **Partial Prerendering**: a static shell is served instantly and dynamic parts stream in inside `<Suspense>`. With `cacheComponents` on, route segment config like `export const revalidate` or `export const dynamic` is no longer allowed (build error) — use `cacheLife(...)` inside `'use cache'` instead. Caching defaults changed a lot from 14 → 15 → 16 (fetch is no longer cached by default since 15), so always check the version the team uses.

**বাংলায়:**

- SSG: build time-এ HTML তৈরি হয়, blog বা docs-এর জন্য ভালো।
- ISR: static, কিন্তু N সেকেন্ড পার হওয়ার পর প্রথম request-টা পুরনো page পায় আর background-এ নতুন build শুরু হয়, যেমন product listing।
- SSR: প্রতি request-এ HTML তৈরি হয়, per-user dashboard-এর জন্য।
- CSR: data browser-এ JS load হওয়ার পর আসে ও render হয় (তবে `'use client'` component-এর প্রথম HTML server-এও pre-render হয়), login-এর পেছনের interactive widget-এর জন্য।
- আমি page অনুযায়ী বেছে নিই। Mutation-এর পর `revalidatePath` বা `revalidateTag('products', 'max')` ব্যবহার করি। Next 16-এ দ্বিতীয় argument হিসেবে profile লাগে, আর `'max'` মানে stale-while-revalidate — পরের visitor হয়তো পুরনো page পাবে, background-এ refresh হবে। Webhook থেকে সাথে সাথে expire করতে `revalidateTag('products', { expire: 0 })`, আর Server Action-এর ভেতরে `updateTag` দিই, যাতে user নিজের change সাথে সাথে দেখে। Next 16-এ `'use cache'` দিয়ে caching explicit, আর version ভেদে default বদলায়, তাই team-এর version দেখে নিতে হয়। `cacheComponents` চালু থাকলে `export const revalidate` বা `dynamic` segment config দিলে build error হয়, তখন `'use cache'`-এর ভেতরে `cacheLife` ব্যবহার করতে হয়।

### Q3. App Router vs Pages Router?

Pages Router (`pages/`) uses `getServerSideProps`/`getStaticProps`. App Router (`app/`, Next 13.4+) is built on React Server Components with nested layouts, `loading.tsx`, `error.tsx`, streaming, and fetch-in-component data loading. New projects use App Router; many existing codebases still have Pages Router, so knowing both is valuable.

**বাংলায়:**

Pages Router (`pages/`) পুরনো পদ্ধতি, সেখানে `getServerSideProps`/`getStaticProps` দিয়ে data আনা হয়। App Router (`app/`) React Server Components-এর উপর তৈরি, এতে nested layout, `loading.tsx`, `error.tsx` আর streaming আছে। নতুন project-এ App Router ব্যবহার করা হয়। কিন্তু অনেক পুরনো codebase এখনো Pages Router-এ, তাই দুটোই জানা কাজে লাগে।

### Q4. Server Components vs Client Components?

**Say this:** In the App Router, components are Server Components by default. They run only on the server, can fetch data directly or query a database, and send zero JavaScript to the browser. Client Components (marked `'use client'`) are needed for state, effects, event handlers and browser APIs.

**Best practice:** keep `'use client'` as low in the tree as possible — make the page a Server Component and only the interactive pieces (a like button, a filter dropdown) client components. You can pass Server Components as `children` into Client Components. Props passed from a Server to a Client Component must be serializable (plain objects, arrays, strings, numbers, Dates, promises) — no regular functions (only Server Functions) and no class instances.

```tsx
// app/products/page.tsx — Server Component
export default async function ProductsPage() {
  const products = await getProducts(); // runs on server
  return <ProductGrid products={products} />;
}
```

**Common mistake:** importing server-only code (DB clients, secrets) into a client file. Use the `server-only` package to make that a build error.

**বাংলায়:**

App Router-এ component default-ভাবে Server Component, এগুলো শুধু server-এ চলে আর browser-এ কোনো JavaScript পাঠায় না। State, effect, event handler বা browser API লাগলে `'use client'` দিয়ে Client Component বানাতে হয়। Best practice হলো `'use client'` tree-এর যত নিচে সম্ভব রাখা, যেমন শুধু like button-টা client। Server থেকে Client-এ পাঠানো props serializable হতে হবে, সাধারণ function বা class instance চলবে না, তবে Server Function পাঠানো যায়। আর DB client বা secret ভুল করে client file-এ import হওয়া ঠেকাতে `server-only` package ব্যবহার করুন।

### Q5. What are Server Actions?

React's official name is **Server Functions**: async functions marked `'use server'` that run on the server and can be called directly from forms or client components — no separate API route needed for mutations. When used in a form `action` or a transition they're called **Server Actions**. Each one is a public POST endpoint under the hood, so always validate input (Zod) and check auth/authorization inside it.

**বাংলায়:**

Server Functions হলো `'use server'` দেওয়া async function, যেগুলো server-এ চলে আর form বা client component থেকে সরাসরি call করা যায়। Form `action` বা transition-এ ব্যবহার করলে এদের Server Action বলে। এতে mutation-এর জন্য আলাদা API route লাগে না। কিন্তু প্রতিটা আসলে একটা public POST endpoint, তাই ভেতরে Zod দিয়ে input validate আর auth check অবশ্যই করতে হবে।

### Q6. Explain special files in the App Router.

`layout.tsx` (shared UI that persists across navigation), `page.tsx` (the route), `loading.tsx` (Suspense fallback while streaming), `error.tsx` (error boundary), `not-found.tsx`, `route.ts` (API endpoint), and `proxy.ts` at the root (called `middleware.ts` before Next 16; runs before requests on the Node runtime — auth redirects, i18n, A/B tests).

**বাংলায়:**

- `layout.tsx`: shared UI, navigation-এর সময় থেকে যায়।
- `page.tsx`: route-টা নিজে।
- `loading.tsx`: streaming-এর সময় Suspense fallback, আর `error.tsx`: error boundary।
- `not-found.tsx` 404-এর জন্য, `route.ts` API endpoint-এর জন্য।
- Root-এ `proxy.ts` (Next 16-এর আগে `middleware.ts`) request-এর আগে চলে, যেমন auth redirect, i18n বা A/B test।

### Q7. How do you handle SEO in Next.js?

- `export const metadata` or `generateMetadata()` for title, description, Open Graph and Twitter cards per page.
- `app/sitemap.ts` and `app/robots.ts` to generate sitemap and robots files.
- Server rendering so crawlers get full HTML.
- Semantic HTML, one `h1` per page, descriptive `alt` text.
- JSON-LD structured data for products, articles, FAQs.
- Canonical URLs to avoid duplicate content.

```tsx
import type { Metadata } from 'next';

// params is a Promise since Next 15 (sync access removed in 16)
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return {
    title: `${product.name} | Store`,
    description: product.summary,
    openGraph: { images: [product.image] },
  };
}
```

**বাংলায়:**

SEO-র জন্য প্রতিটা page-এ `metadata` বা `generateMetadata()` দিয়ে title, description আর Open Graph দিই। `app/sitemap.ts` আর `app/robots.ts` দিয়ে sitemap আর robots file তৈরি হয়। Server rendering থাকায় crawler পুরো HTML পায়। এর সাথে semantic HTML, প্রতি page-এ একটাই `h1`, ভালো `alt` text, JSON-LD structured data আর duplicate content এড়াতে canonical URL ব্যবহার করি। Next 15 থেকে `params` একটা Promise, তাই await করতে হয়।

### Q8. What does `next/image` do?

It automatically resizes, serves modern formats (WebP by default, AVIF if enabled in `images.formats`), lazy-loads below-the-fold images, and needs width/height (or `fill`) to prevent layout shift (CLS) — required for remote images, inferred automatically for static imports. Mark the hero/LCP image with `preload` (Next 16; replaces the deprecated `priority`) or `fetchPriority="high"` so it loads immediately.

**বাংলায়:**

`next/image` image-কে automatically resize করে, WebP format দেয় (config-এ চালু করলে AVIF-ও) আর নিচের image lazy-load করে। Width/height (বা `fill`) দিলে layout shift (CLS) হয় না। Remote image-এ এটা দিতে হয়, static import-এ নিজে থেকেই বুঝে নেয়। Hero বা LCP image-এ `preload` (Next 16, পুরনো `priority`-র বদলে) বা `fetchPriority="high"` দিন, যাতে সাথে সাথে load হয়।

### Q9. What does `next/font` do?

It self-hosts Google or local fonts at build time, removes external network requests, and avoids layout shift from font swapping.

**বাংলায়:**

`next/font` Google বা local font build time-এ self-host করে। ফলে font-এর জন্য বাইরের network request লাগে না। Font swap-এর কারণে যে layout shift হয়, সেটাও এড়ানো যায়।

### Q10. How do you handle environment variables?

Variables are server-only by default. Only those prefixed `NEXT_PUBLIC_` are bundled into browser code. Never put secrets in `NEXT_PUBLIC_` variables — anyone can read them in the JS bundle. They are inlined at **build time**, so changing one needs a rebuild; to ship the same Docker image to staging and prod, read it at request time on the server (a dynamically rendered Server Component — call `await connection()` first, or a statically prerendered page freezes the build-time value — or a route handler) and pass it down.

**বাংলায়:**

Environment variable default-ভাবে server-only। শুধু `NEXT_PUBLIC_` prefix দেওয়াগুলো browser bundle-এ যায়, তাই সেখানে কখনো secret রাখবেন না, JS bundle থেকে যে কেউ পড়তে পারে। এগুলো build time-এ inline হয়, তাই value বদলালে rebuild লাগে। একই Docker image staging আর prod-এ চালাতে চাইলে request time-এ server-এ value পড়ুন (dynamic Server Component-এ আগে `await connection()`, নাহলে static page-এ build-এর value আটকে যায়, বা route handler), তারপর নিচে পাঠান।

### Q11. How do you protect routes / handle auth?

Check the session in `proxy.ts` (called `middleware.ts` before Next 16) for fast redirects, and **also** re-check authorization on the server where data is read (Server Components, Server Actions, route handlers). Middleware/proxy alone is not enough — CVE-2025-29927 let attackers skip Next.js middleware entirely with a crafted header, so apps that only checked auth there were exposed. Libraries commonly used: Auth.js (NextAuth), Clerk, or a custom JWT/cookie flow with httpOnly cookies.

**বাংলায়:**

`proxy.ts` (আগে `middleware.ts`)-এ session check করে দ্রুত redirect করি। কিন্তু data যেখানে পড়া হয়, যেমন Server Component, Server Action বা route handler, সেখানেও আবার authorization check করি। শুধু middleware-এর উপর ভরসা করা যায় না। CVE-2025-29927-এ একটা crafted header দিয়ে middleware পুরো skip করা যেত। সাধারণত Auth.js, Clerk বা httpOnly cookie দিয়ে custom JWT flow ব্যবহার হয়।

### Q12. Dynamic routes and route groups?

`app/blog/[slug]/page.tsx` for dynamic segments, `[...slug]` for catch-all, `generateStaticParams()` to pre-build dynamic pages at build time, and `(group)` folders to organize routes or share a layout without affecting the URL.

**বাংলায়:**

`[slug]` folder দিয়ে dynamic segment হয়, যেমন `app/blog/[slug]/page.tsx`। `[...slug]` হলো catch-all। `generateStaticParams()` দিয়ে dynamic page build time-এ আগেই তৈরি করা যায়। আর `(group)` folder দিয়ে route organize করা বা layout share করা যায়, URL-এ কোনো প্রভাব পড়ে না।

### Q13. How do you structure a scalable React/Next.js app?

**Say this:** "I organize by feature, not by file type, keep a small shared layer, and make the boundaries explicit — server vs client, feature vs shared, app code vs API contract — and enforce them with tooling, not just code review."

```text
src/
  app/                          routes only: page, layout, loading, error — thin, composes features
    (marketing)/                route groups: different layouts, same URL space
    (app)/dashboard/page.tsx
  features/
    cart/
      components/               CartDrawer.tsx, CartDrawer.test.tsx
      hooks/                    useCartSummary.ts
      api/                      cart.api.ts, cart.queries.ts (query keys + TanStack Query hooks)
      server/                   cart.actions.ts ('use server'), cart.data.ts (import 'server-only')
      types.ts
      index.ts                  the feature's public API — other code imports only from here
    checkout/
  components/ui/                shared design-system pieces: Button, Input, Dialog — no business logic
  lib/                          api client, env.ts, auth helpers, utils
  styles/globals.css            Tailwind @theme tokens
```

- **Feature-based folders:** everything for one feature lives together, so a change touches one folder and a feature can be removed cleanly. `app/` only holds routing files that compose features. Keep tests next to the code they test.
- **Shared UI and design tokens:** `components/ui` is generic — no data fetching, no business rules — and built on tokens defined once in Tailwind v4's `@theme` (colors, spacing, radius, fonts) that match the Figma variables. Document the pieces in Storybook so designers and developers share one vocabulary.
- **Server/client boundaries:** Server Components by default; push `'use client'` down to the small interactive leaves. Modules with database access or secrets start with `import 'server-only'`, so importing one from client code fails the build. Server Actions live in their own `'use server'` files, and only serializable props cross the boundary.
- **Typed API layer:** one `api()` client in `lib/` handles the base URL, auth and errors (section 5, Q2); each feature exposes typed functions on top of it. Generate types from the backend's OpenAPI spec (e.g. `openapi-typescript`) or share them, validate responses with Zod at the boundary, and keep TanStack Query keys in one factory per feature (`cartKeys.all`, `cartKeys.detail(id)`).
- **Import rules:** absolute imports through the `@/` alias; features import each other only through their `index.ts`, never deep paths; `components/ui` and `lib` never import from `features`. Enforce it with ESLint (`no-restricted-imports`, `import/no-cycle` or `eslint-plugin-boundaries`). Keep `index.ts` files small — huge barrel files slow down dev builds and can hurt tree-shaking.
- **Environment config:** one `lib/env.ts` validates `process.env` with Zod and exports typed values, so a missing variable fails at startup instead of in production. Server-only values stay in server-only modules; only `NEXT_PUBLIC_` values reach the browser, and they are inlined at build time (Q10). Commit `.env.example`, never real `.env` files.
- **Code ownership:** a `.github/CODEOWNERS` file maps folders to people or teams (`/src/features/payments/ @acme/payments`), and branch protection requires their review. Feature folders make this mapping natural.
- **When a monorepo helps:** when several apps share code — e.g. the customer site, an admin panel and a design system. Use pnpm workspaces with Turborepo or Nx: `apps/web`, `apps/admin`, `packages/ui`, `packages/api-types`, `packages/config` (shared ESLint, TypeScript and Tailwind presets). One PR can change the UI library and every app together, and builds are cached. For a single app it's overhead — a well-structured single repo is simpler.

**Close with:** CI runs lint, type-check, tests and build on every PR, so these rules hold as the team grows.

**বাংলায়:**

File type অনুযায়ী না, feature অনুযায়ী organize করি, shared layer ছোট রাখি, আর boundary-গুলো পরিষ্কার রাখি — server বনাম client, feature বনাম shared, app code বনাম API contract — আর শুধু code review-এর উপর না ছেড়ে tooling দিয়ে enforce করি।

- **Feature-based folder:** একটা feature-এর সব কিছু (component, hook, API, server code, type, test) এক folder-এ থাকে, তাই change এক জায়গায় হয় আর feature পরিষ্কারভাবে সরানো যায়। `app/`-এ শুধু routing file থাকে, যেগুলো feature-গুলো জুড়ে দেয়।
- **Shared UI আর design token:** `components/ui` generic — data fetching বা business rule নেই — আর Tailwind v4-এর `@theme`-এ একবার define করা token (color, spacing, radius, font) দিয়ে বানানো, যেগুলো Figma variable-এর সাথে মেলে। Storybook-এ document করি, যাতে designer আর developer একই ভাষায় কথা বলে।
- **Server/client boundary:** default-ভাবে Server Component; `'use client'` শুধু ছোট interactive leaf-এ। Database বা secret থাকা module-এ `import 'server-only'` দিই, ফলে client code থেকে import করলে build fail করে। Server Action আলাদা `'use server'` file-এ, আর boundary পার হয় শুধু serializable props।
- **Typed API layer:** `lib/`-এ একটাই `api()` client (base URL, auth, error), তার উপর প্রতিটা feature-এর typed function। Backend-এর OpenAPI spec থেকে type generate করি, boundary-তে Zod দিয়ে response validate করি, আর প্রতি feature-এ TanStack Query key-এর একটা factory রাখি।
- **Import rule:** `@/` alias দিয়ে absolute import; এক feature আরেকটাকে শুধু তার `index.ts` দিয়ে import করে, deep path দিয়ে না; `components/ui` আর `lib` কখনো `features` import করে না। ESLint দিয়ে enforce করি। `index.ts` ছোট রাখি — বড় barrel file dev build ধীর করে আর tree-shaking-এ সমস্যা করতে পারে।
- **Environment config:** `lib/env.ts` Zod দিয়ে `process.env` validate করে typed value export করে, যাতে কোনো variable না থাকলে production-এ না, startup-এই fail করে। Server-only value server-only module-এ থাকে; browser-এ যায় শুধু `NEXT_PUBLIC_` value, আর সেগুলো build time-এ inline হয়। `.env.example` commit করি, আসল `.env` কখনো না।
- **Code ownership:** `.github/CODEOWNERS` file folder-কে team-এর সাথে map করে, আর branch protection তাদের review বাধ্যতামূলক করে; feature folder থাকলে এই mapping সহজ হয়।
- **Monorepo কখন:** যখন কয়েকটা app code share করে — যেমন customer site, admin panel আর design system। তখন pnpm workspace-এর সাথে Turborepo বা Nx: `apps/web`, `apps/admin`, `packages/ui`, `packages/api-types`, `packages/config`। এক PR-এ UI library আর সব app একসাথে বদলানো যায়, আর build cache হয়। একটা মাত্র app হলে এটা বাড়তি ঝামেলা — ভালোভাবে সাজানো single repo-ই সহজ।
- শেষে বলুন: প্রতিটা PR-এ CI lint, type-check, test আর build চালায়, তাই team বড় হলেও এই নিয়মগুলো টিকে থাকে।

---

## 4. HTML, CSS, Tailwind & Figma

### Q1. What is semantic HTML and why does it matter?

Using elements that describe meaning — `header`, `nav`, `main`, `article`, `section`, `button`, `footer` — instead of `div` everywhere. It improves accessibility (screen readers navigate by landmarks), SEO (crawlers understand structure), and keyboard behavior (a real `button` is focusable and responds to Enter/Space; a `div` with `onClick` is not).

**বাংলায়:**

Semantic HTML মানে সব জায়গায় `div` না দিয়ে অর্থবোধক element ব্যবহার করা, যেমন `header`, `nav`, `main`, `article`, `button`। এতে accessibility ভালো হয়, কারণ screen reader landmark দিয়ে navigate করে। SEO-ও ভালো হয়, crawler structure বোঝে। আর আসল `button` focus হয় আর Enter/Space-এ কাজ করে, কিন্তু `onClick` দেওয়া `div` তা করে না।

### Q2. What accessibility (a11y) practices do you follow?

Semantic elements, `alt` on images (empty `alt=""` for decorative), labels tied to inputs, visible focus states (`focus-visible:`), color contrast at least 4.5:1 for normal text and 3:1 for large text and UI components/icons (target **WCAG 2.2 AA**, which also adds a 24×24px minimum target size and "focus not obscured" by sticky headers), keyboard navigation and focus trapping in modals, and ARIA only when no native element works. Test with Lighthouse, axe DevTools and by tabbing through the page.

**বাংলায়:**

- Semantic element, image-এ `alt` (decorative হলে `alt=""`), input-এর সাথে label।
- Visible focus state (`focus-visible:`), normal text-এ কমপক্ষে 4.5:1 আর বড় text, UI component (input border, button, focus ring) ও icon-এ 3:1 contrast।
- লক্ষ্য WCAG 2.2 AA, এতে 24×24px minimum target size আর sticky header-এর নিচে focus ঢাকা না পড়ার নিয়মও আছে।
- Keyboard navigation, modal-এ focus trap, আর native element না চললে তবেই ARIA।
- Lighthouse, axe DevTools আর Tab চেপে page ঘুরে test করি।

### Q3. Explain the CSS box model and `box-sizing`.

Every element is content + padding + border + margin. With `box-sizing: border-box`, width includes padding and border, which makes layout math predictable. Tailwind's Preflight sets this globally.

**বাংলায়:**

প্রতিটা element হলো content + padding + border + margin। `box-sizing: border-box` দিলে width-এর মধ্যে padding আর border ধরা হয়, তাই layout-এর হিসাব সহজ আর predictable হয়। Tailwind-এর Preflight এটা globally set করে দেয়।

### Q4. Flexbox vs Grid — when do you use each?

**Flexbox** is one-dimensional (a row *or* a column): navbars, button groups, centering, aligning items in a card. **Grid** is two-dimensional (rows *and* columns): page layouts, card galleries, dashboards. Rule of thumb: content-driven sizing → flex; layout-driven structure → grid.

```html
<!-- Responsive card grid: 1 col mobile, 2 tablet, 4 desktop -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">...</div>
```

**বাংলায়:**

Flexbox one-dimensional, মানে row অথবা column, যেমন navbar, button group বা centering। Grid two-dimensional, row আর column দুটোই, যেমন page layout, card gallery বা dashboard। Rule of thumb: content অনুযায়ী size হলে flex, layout-এর structure হলে grid।

### Q5. CSS specificity and positioning?

The cascade decides in this order: origin and `!important` → cascade layers (`@layer`) → specificity → source order. Specificity: inline styles > IDs > classes/attributes/pseudo-classes > elements; `:where()` adds zero. Layers matter in Tailwind v4: its utilities live in `@layer utilities`, so any unlayered CSS you write beats them regardless of specificity. `!important` overrides normal rules — avoid it. Position: `relative` (offset from itself, creates a positioning context), `absolute` (relative to nearest positioned ancestor), `fixed` (to the viewport — unless an ancestor has `transform`/`filter`, which becomes its container), `sticky` (scrolls until a threshold, then sticks — great for headers and table headers).

**বাংলায়:**

Cascade এই order-এ ঠিক করে: origin আর `!important`, তারপর `@layer`, তারপর specificity, শেষে source order। Specificity-তে inline > ID > class/attribute/pseudo-class > element, আর `:where()` zero যোগ করে। Tailwind v4-এ utility গুলো `@layer utilities`-এ থাকে, তাই আপনার unlayered CSS specificity যাই হোক জিতে যায়। Position-এ `absolute` নিকটতম positioned ancestor অনুযায়ী বসে। `fixed` viewport-এ বসে, তবে ancestor-এ `transform`/`filter` থাকলে সেটাই container হয়ে যায়, আর `sticky` header-এর জন্য দারুণ।

### Q6. How do you approach responsive design?

**Mobile-first:** write base styles for small screens, then add `sm:`, `md:`, `lg:`, `xl:` overrides for larger screens (Tailwind breakpoints are min-width: 640, 768, 1024, 1280, 1536 px). Use relative units (`rem`, `%`, `fr`), fluid typography with `clamp()`, `max-w-*` containers, responsive images (`srcset` or `next/image` `sizes`), and test on real devices plus DevTools device mode. Mention **container queries** (`@container`, Tailwind `@container`/`@md:`) for components that adapt to their parent's width, not the screen.

**বাংলায়:**

আমি mobile-first কাজ করি: ছোট screen-এর base style আগে, তারপর `sm:`, `md:`, `lg:` দিয়ে বড় screen-এর override। Tailwind breakpoint min-width ভিত্তিক: 640, 768, 1024, 1280, 1536 px। `rem`, `%`, `fr`, `clamp()` দিয়ে fluid typography, responsive image আর real device-এ test করি। Component যদি screen না, parent-এর width অনুযায়ী বদলাতে হয়, তখন container query (`@container`) ব্যবহার করি।

### Q7. Why Tailwind? What are its downsides?

**Pros:** fast development, no naming fatigue, consistent spacing/color scale from a design system, tiny production CSS (only used classes are generated), styles live with the markup, easy responsive and state variants.

**Cons and how you handle them:** long class strings (extract components, use `cva` for variants), learning curve, and conflicting classes when overriding (solve with `tailwind-merge`). Avoid building class names dynamically like `text-${color}-500` — Tailwind can't detect them at build time; use a full-class lookup map instead.

**বাংলায়:**

Tailwind-এ development দ্রুত হয়, class-এর নাম ভাবতে হয় না, design system থেকে consistent spacing/color পাওয়া যায়, আর production CSS ছোট থাকে। Downside হলো লম্বা class string, যেটা component extract আর `cva` দিয়ে সামলাই। Override করার সময় class conflict হলে `tailwind-merge` ব্যবহার করি। আর `text-${color}-500`-এর মতো dynamic class বানাবেন না, build time-এ Tailwind এটা detect করতে পারে না, তাই full-class lookup map ব্যবহার করুন।

### Q8. How do you customize Tailwind to match a design system?

Put the Figma tokens (colors, fonts, spacing, radii, shadows) into the theme. In **Tailwind v4** (released 2025) this is done in CSS with `@theme { --color-brand-500: #2563eb; }`; in v3 it's `tailwind.config.js` under `theme.extend`. Use CSS variables for theming so dark mode is just a variable swap.

**বাংলায়:**

Figma-র token, মানে color, font, spacing, radius, shadow, Tailwind theme-এ বসাই। Tailwind v4-এ এটা CSS-এ `@theme { ... }` দিয়ে হয়, আর v3-এ `tailwind.config.js`-এর `theme.extend`-এ। Theming-এর জন্য CSS variable ব্যবহার করি, তাহলে dark mode শুধু variable swap।

### Q9. How do you implement dark mode?

Tailwind's `dark:` variant. In v4 it follows `prefers-color-scheme` by default; for a user toggle (a `.dark` class on `html`, saved), override it in CSS with `@custom-variant dark (&:where(.dark, .dark *));` — this CSS-first approach replaces v3's `darkMode: 'class'` (that option only still works through a legacy `@config` JS file). In Next.js, `next-themes` prevents the flash of wrong theme on load.

**বাংলায়:**

Tailwind-এর `dark:` variant দিয়ে dark mode করি। v4-এ default-ভাবে এটা `prefers-color-scheme` follow করে। User toggle চাইলে (`html`-এ `.dark` class) CSS-এ `@custom-variant dark` দিয়ে override করতে হয় — v3-এর `darkMode: 'class'`-এর বদলে এখন এই CSS-first পদ্ধতি (পুরনো `@config` JS file দিয়েই শুধু ওটা এখনো চলে)। Next.js-এ load-এর সময় ভুল theme-এর flash ঠেকাতে `next-themes` ব্যবহার করি।

### Q10. Walk me through converting a Figma design into a pixel-perfect, responsive UI.

1. **Study the whole design first** — all screens, breakpoints (mobile/tablet/desktop frames), hover/focus/disabled/empty/loading/error states. Ask the designer about anything missing *before* coding.
2. **Extract design tokens** — colors, typography scale, spacing, radius, shadows — from Figma styles/variables (Dev Mode shows them), and map them into the Tailwind theme.
3. **Break the page into components** — identify repeated pieces (buttons, inputs, cards, navbar) and build them first as reusable components, ideally matching Figma component names and variants.
4. **Build layout with Flex/Grid** using Figma's Auto Layout as a hint (Auto Layout ≈ flexbox: direction, gap, padding).
5. **Make it responsive** — mobile-first, define behavior between the designed breakpoints, not just at them.
6. **Export assets correctly** — SVG for icons/logos, WebP/AVIF for photos, use `next/image`.
7. **Verify pixel accuracy** — compare side by side or with an overlay tool (e.g. PerfectPixel extension), check spacing in DevTools, and test real content lengths (long names, translations).
8. **Review with the designer** — share a preview deployment (Vercel preview URL) for feedback.

**Bonus to mention:** AI tools and Figma's Dev Mode / MCP integrations can generate a first draft of a component from a frame, but you always refactor the output to use your design tokens and existing components rather than hard-coded pixel values.

**বাংলায়:**

- আগে পুরো design দেখি: সব screen, breakpoint আর hover/empty/loading/error state। কিছু missing থাকলে coding-এর আগেই designer-কে জিজ্ঞেস করি।
- Figma Dev Mode থেকে design token নিয়ে Tailwind theme-এ map করি, তারপর reusable component আগে বানাই।
- Auto Layout দেখে Flex/Grid দিয়ে layout করি, mobile-first, breakpoint-এর মাঝের অবস্থাও ঠিক রাখি।
- Icon-এ SVG, photo-তে WebP/AVIF আর `next/image`। Overlay tool আর DevTools দিয়ে pixel মিলাই, লম্বা নাম বা translation দিয়েও test করি।
- শেষে Vercel preview URL দিয়ে designer-এর review নিই। AI বা Figma MCP দিয়ে first draft হতে পারে, কিন্তু সেটা design token আর existing component দিয়ে refactor করি।

### Q11. What do you do when a design isn't feasible or breaks on some screens?

Don't silently change it. Flag it to the designer with a screenshot and a proposed alternative ("the 4-column table won't fit at 375px — can we switch to stacked cards on mobile?"). This shows collaboration, which the JD explicitly asks for.

**বাংলায়:**

Design নিজে নিজে চুপচাপ বদলাই না। Screenshot আর একটা বিকল্প প্রস্তাব নিয়ে designer-কে জানাই, যেমন "375px-এ 4-column table ধরছে না, mobile-এ stacked card করলে কেমন হয়?"। এতে collaboration দেখা যায়, যেটা JD-তে সরাসরি চাওয়া হয়েছে।

---

## 5. REST APIs & State

### Q1. What is REST? Explain HTTP methods and status codes.

REST is an API style where URLs represent resources (`/users/42`) and HTTP methods represent actions: `GET` read, `POST` create, `PUT` replace, `PATCH` partial update, `DELETE` remove. `GET`, `PUT` and `DELETE` should be idempotent: repeating the request has the same effect on server state, though the response may differ (a second `DELETE` usually returns `404`). `GET` is also *safe* — it has no side effects.

Status codes to know: `200` OK, `201` Created, `204` No Content, `400` Bad Request (validation), `401` Unauthorized (not logged in), `403` Forbidden (logged in, no permission), `404` Not Found, `409` Conflict, `422` Unprocessable, `429` Too Many Requests, `500` Server Error.

**বাংলায়:**

REST হলো এমন API style যেখানে URL হলো resource (`/users/42`) আর HTTP method হলো action: `GET` read, `POST` create, `PUT` replace, `PATCH` partial update, `DELETE` remove। `GET`, `PUT`, `DELETE` idempotent হওয়া উচিত, মানে বারবার করলেও server state-এ effect একই থাকে (response আলাদা হতে পারে, যেমন দ্বিতীয় `DELETE`-এ `404`)। `GET` আবার *safe* — এর কোনো side effect নেই। Status code-এ `401` মানে login করা নেই, আর `403` মানে login আছে কিন্তু permission নেই। এই পার্থক্যটা interview-তে প্রায়ই জিজ্ঞেস করে।

### Q2. How do you structure API calls in a frontend app?

Centralize them in an API layer instead of calling `fetch` inside components:

```typescript
// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json'); // only JSON strings; FormData/Blob/URLSearchParams set their own
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T; // No Content
  return res.json() as Promise<T>;
}

// init lets callers pass a signal (TanStack Query, AbortController)
export const getUsers = (page: number, init?: RequestInit) =>
  api<User[]>(`/users?page=${page}`, init);
```

Benefits: one place for base URL, auth headers, error handling, token refresh and typing. With Axios you'd use interceptors for the same purpose.

**বাংলায়:**

Component-এর ভেতরে সরাসরি `fetch` না করে একটা আলাদা API layer-এ সব call রাখি। এতে base URL, auth header, error handling, token refresh আর typing এক জায়গায় থাকে। উদাহরণের `api()` function error হলে `ApiError` throw করে, `204`-এ body parse করে না, আর শুধু JSON string body-তে `Content-Type` set করে, FormData বা Blob-এ করে না। Axios হলে একই কাজ interceptor দিয়ে করা যায়।

### Q3. How do you handle loading, error and empty states?

Every data-driven component has four states: loading (skeleton, not just a spinner, to avoid layout shift), error (friendly message + retry button), empty (helpful message + call to action), and success. Interviewers like candidates who mention the empty state — it's often forgotten.

**বাংলায়:**

Data-নির্ভর প্রতিটা component-এর চারটা state থাকে: loading, error, empty আর success। Loading-এ শুধু spinner না, skeleton দেখাই যাতে layout shift না হয়। Error-এ friendly message আর retry button দিই। Empty-তে helpful message আর call to action দিই। Empty state অনেকেই ভুলে যায়, তাই এটা mention করলে interviewer খুশি হন।

### Q4. What is CORS?

A browser security rule: a page on `app.com` can't read responses from `api.com` unless the server sends `Access-Control-Allow-Origin` headers allowing it. It's fixed on the **server**, not the frontend. For non-simple requests the browser sends an `OPTIONS` preflight first; simple requests still reach the server — the browser just blocks the page from reading the response, so CORS is not CSRF protection. With cookies (`credentials: 'include'`) the server must send `Access-Control-Allow-Credentials: true` and a specific origin, not `*`. CORS headers alone don't get cookies sent, though — `SameSite` works per *site*: `app.shop.com` → `api.shop.com` is same-site, so `Lax` cookies are sent, but a truly cross-site API (`app.com` → `api.com`) only receives `SameSite=None; Secure` cookies, and Safari and Firefox block those third-party cookies by default. So put the API on a subdomain of the same site, or proxy it: in Next.js, through a route handler or `rewrites`.

**বাংলায়:**

CORS হলো browser-এর security rule: `app.com`-এর page `api.com`-এর response পড়তে পারবে না, যদি server `Access-Control-Allow-Origin` header দিয়ে অনুমতি না দেয়। এটা server-এ fix করতে হয়, frontend-এ না। Non-simple request-এর আগে browser `OPTIONS` preflight পাঠায়। Simple request কিন্তু server-এ পৌঁছায়, browser শুধু response পড়তে দেয় না, তাই CORS কোনো CSRF protection না। Cookie পাঠালে `Access-Control-Allow-Credentials: true` আর `*`-এর বদলে নির্দিষ্ট origin লাগে। তবে শুধু CORS header দিলেই cookie যায় না — `SameSite` site ধরে কাজ করে: `app.shop.com` → `api.shop.com` same-site, তাই `Lax` cookie যায়; কিন্তু `app.com` → `api.com` cross-site, সেখানে শুধু `SameSite=None; Secure` cookie যায়, আর Safari/Firefox default-ভাবে এমন third-party cookie block করে। তাই API একই site-এর subdomain-এ রাখুন, অথবা proxy করুন — Next.js-এ route handler বা `rewrites` দিয়ে।

### Q5. Where do you store auth tokens?

Prefer **httpOnly, Secure, SameSite cookies** set by the server — JavaScript can't read them, so XSS can't steal them (though XSS can still make requests as the user while they're on the page). Cookies are sent automatically, which brings CSRF risk: use `SameSite=Lax` or `Strict` plus a CSRF token for mutations. `localStorage` is readable by any script on the page, so it's riskier. A common pattern: short-lived access token in memory, refresh token in an httpOnly cookie, and handle `401` by refreshing then retrying.

**বাংলায়:**

Server-set httpOnly, Secure, SameSite cookie সবচেয়ে ভালো, কারণ JavaScript এটা পড়তে পারে না, তাই XSS token চুরি করতে পারে না। তবে XSS তখনও user হিসেবে request পাঠাতে পারে। Cookie automatically যায় বলে CSRF risk থাকে, তাই `SameSite=Lax`/`Strict` আর mutation-এ CSRF token দিই। `localStorage` যে কোনো script পড়তে পারে, তাই বেশি risky। Common pattern: short-lived access token memory-তে, refresh token httpOnly cookie-তে, আর `401` পেলে refresh করে retry।

### Q6. Server state vs client state?

| | Server state | Client (UI) state |
| --- | --- | --- |
| Examples | Users, products, orders from the API | Modal open, selected tab, theme, form draft, cart before checkout |
| Owner | The backend; you have a cached copy | The browser |
| Problems | Caching, staleness, refetching, deduping, pagination, retries | Sharing across components |
| Tool | TanStack Query, SWR, RTK Query, Server Components | `useState`, Context, Zustand, Redux |

**Say this:** "I don't put API data into Redux anymore. TanStack Query handles server state, and I use Zustand or local state for the small amount of true client state."

**বাংলায়:**

Server state হলো API থেকে আসা data, যেমন user, product, order। এর মালিক backend, আমাদের কাছে শুধু cached copy, তাই caching, staleness, refetch, retry সামলাতে হয়। Client state হলো শুধু browser-এর, যেমন modal খোলা কি না, selected tab বা theme। আমি এখন API data Redux-এ রাখি না। Server state-এর জন্য TanStack Query, আর অল্প যে client state থাকে তার জন্য Zustand বা local state।

### Q7. What does TanStack Query give you?

Caching by query key, automatic background refetching, request deduplication, retries, loading/error states, pagination and infinite scroll, mutations with cache invalidation, and optimistic updates.

```tsx
const { data, isPending, isError, refetch } = useQuery({
  queryKey: ['users', page],
  queryFn: ({ signal }) => getUsers(page, { signal }), // signal enables cancellation
  staleTime: 60_000,
});

const qc = useQueryClient();
const addUser = useMutation({
  mutationFn: createUser,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
});
```

**Key concepts:** `staleTime` (how long data counts as fresh — no refetch), `gcTime` (formerly `cacheTime`, how long unused data stays in memory), and query keys as dependency arrays — when `page` changes, it fetches the new page automatically.

**বাংলায়:**

TanStack Query query key দিয়ে caching, background refetch, request deduplication, retry, loading/error state, pagination, infinite scroll আর mutation-এর পর cache invalidation দেয়। `staleTime` হলো data কতক্ষণ fresh থাকবে, এই সময়ে refetch হয় না। `gcTime` (আগের নাম `cacheTime`) হলো unused data কতক্ষণ memory-তে থাকবে। Query key dependency array-এর মতো, `page` বদলালে নতুন page নিজে থেকেই fetch হয়।

### Q8. How do optimistic updates work?

Update the UI immediately before the server responds, then roll back if it fails. In TanStack Query: in `onMutate`, cancel ongoing queries, snapshot the old cache, set the new value; in `onError`, restore the snapshot; in `onSettled`, invalidate to sync with the server. Good for likes, toggles, todo checkboxes.

**বাংলায়:**

Optimistic update মানে server-এর response আসার আগেই UI update করা, আর fail করলে আগের অবস্থায় ফেরত যাওয়া। TanStack Query-তে `onMutate`-এ চলমান query cancel করি, পুরনো cache-এর snapshot রাখি আর নতুন value বসাই। `onError`-এ snapshot ফেরত আনি, আর `onSettled`-এ invalidate করে server-এর সাথে sync করি। Like, toggle বা todo checkbox-এর জন্য এটা ভালো।

### Q9. Redux vs Zustand — when would you choose each?

**Redux Toolkit:** structured (slices, actions, reducers), excellent DevTools with time-travel, middleware, strong conventions for large teams and complex state logic; RTK Query included for API caching. More boilerplate than Zustand.

**Zustand:** tiny, minimal boilerplate, no provider needed, components subscribe to slices of state so they re-render only when that slice changes. Great for small-to-medium apps. **Next.js App Router caveat:** a module-level store is shared across all server requests (one user's data can leak into another's render), so create the store per request inside a context provider, as the Zustand Next.js guide shows. In Zustand v5, wrap selectors that return a new object/array in `useShallow`, or you get an infinite re-render loop.

```typescript
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
};

export const useCart = create<CartState>()((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

// Hooks must be called inside a component or a custom hook
export function useCartSummary() {
  // Select only what you need to avoid extra re-renders
  const count = useCart((s) => s.items.length);
  // Returning an object? Use useShallow so v5 doesn't loop
  const { add, remove } = useCart(useShallow((s) => ({ add: s.add, remove: s.remove })));
  return { count, add, remove };
}
```

**বাংলায়:**

- Redux Toolkit: structured (slice, action, reducer), time-travel সহ চমৎকার DevTools, বড় team আর complex logic-এর জন্য ভালো। RTK Query সাথেই আছে। তবে Zustand-এর তুলনায় boilerplate বেশি।
- Zustand: ছোট, boilerplate কম, provider লাগে না, component শুধু নিজের slice বদলালে re-render হয়। ছোট-মাঝারি app-এর জন্য দারুণ।
- Next.js App Router-এ module-level store সব server request-এ share হয়, ফলে এক user-এর data আরেকজনের render-এ leak করতে পারে। তাই context provider-এর ভেতরে per request store বানাতে হয়।
- Zustand v5-এ selector যদি নতুন object/array return করে, `useShallow` দিয়ে wrap করতে হয়, নাহলে infinite re-render loop হয়।

### Q10. Explain Redux data flow.

UI dispatches an **action** → a **reducer** (pure function) computes new state from old state + action → the **store** updates → subscribed components re-render via `useSelector`. Redux Toolkit uses Immer, so you can write "mutating" code in reducers that is converted to immutable updates.

**বাংলায়:**

UI একটা action dispatch করে। Reducer, যেটা pure function, পুরনো state আর action থেকে নতুন state বের করে। তারপর store update হয়, আর `useSelector` দিয়ে subscribe করা component re-render হয়। Redux Toolkit Immer ব্যবহার করে, তাই reducer-এ "mutate" করার মতো code লিখলেও সেটা immutable update-এ রূপান্তরিত হয়।

### Q11. How would you implement search with an API?

Debounce the input (300ms), put the term in the query key, keep previous results visible while loading (`placeholderData: keepPreviousData`), cancel outdated requests (TanStack passes an `AbortSignal`, but it only cancels if you forward it: `queryKey: ['users', debouncedTerm], queryFn: ({ signal }) => searchUsers(debouncedTerm, { signal })`), and sync the term to the URL (`?q=`) so results are shareable and survive refresh. This combines several JD skills in one answer.

**বাংলায়:**

Input 300ms debounce করি আর search term query key-তে রাখি। Loading-এর সময় আগের result দেখাতে `placeholderData: keepPreviousData` দিই। পুরনো request cancel করতে TanStack `AbortSignal` দেয়, কিন্তু সেটা `queryFn`-এ forward না করলে cancel হয় না। আর term-টা URL-এ (`?q=`) sync করি, যাতে result share করা যায় আর refresh-এর পরও থাকে।

### Q12. Pagination vs infinite scroll?

Pagination: better for SEO, jumping to a page, and data tables. Infinite scroll: better for feeds on mobile; use `useInfiniteQuery` and an `IntersectionObserver` to load more; virtualize very long lists (TanStack Virtual).

**বাংলায়:**

Pagination SEO, নির্দিষ্ট page-এ যাওয়া আর data table-এর জন্য ভালো। Infinite scroll mobile feed-এর জন্য ভালো। এর জন্য `useInfiniteQuery` আর `IntersectionObserver` দিয়ে আরও data load করি। List অনেক লম্বা হলে TanStack Virtual দিয়ে virtualize করি।

---

## 6. Performance, SEO & Browsers

### Q1. What are Core Web Vitals?

| Metric | Measures | Good target | Common fixes |
| --- | --- | --- | --- |
| LCP (Largest Contentful Paint) | Loading — when the main content appears | ≤ 2.5 s | Optimize hero image (`next/image` + `preload`), SSR/SSG, CDN, preload fonts |
| INP (Interaction to Next Paint) | Responsiveness — delay after clicks/typing | ≤ 200 ms | Less JS, split long tasks, `useTransition`, move work off the main thread |
| CLS (Cumulative Layout Shift) | Visual stability — content jumping | ≤ 0.1 | Set image width/height, reserve space for ads/embeds, `next/font`, skeletons |

INP replaced FID (First Input Delay) as a Core Web Vital in March 2024 — mentioning this shows you're current. INP = input delay + processing time + presentation delay. Google judges CWV on **field data** (real Chrome users, CrUX) at the 75th percentile; Lighthouse is lab-only; its default navigation report can't measure INP and shows TBT as a proxy (timespan mode can record INP for interactions you perform). Collect your own field data with the `web-vitals` library.

**বাংলায়:**

Core Web Vitals হলো Google-এর তিনটা metric: LCP (main content কত দ্রুত দেখায়, ≤ 2.5 s), INP (click/typing-এর পর UI কত দ্রুত respond করে, ≤ 200 ms) আর CLS (content কতটা লাফায়, ≤ 0.1)। March 2024-এ INP, FID-কে replace করেছে — এটা বললে বোঝা যায় আপনি updated। Google **field data** (CrUX, p75) দিয়ে বিচার করে; Lighthouse শুধু lab tool; default navigation report INP মাপতে পারে না, তাই TBT দেখায় (timespan mode-এ নিজে interact করলে INP পাওয়া যায়)। নিজের real-user data-র জন্য `web-vitals` library ব্যবহার করুন।

### Q2. How would you approach a slow page?

1. **Measure:** PageSpeed Insights / Search Console for real-user field data (CrUX, p75), `web-vitals` for your own RUM, Lighthouse for lab debugging (TBT, not INP), Chrome DevTools Performance tab, React DevTools Profiler, and `@next/bundle-analyzer` for bundle size.
2. **Identify the bottleneck:** big JS bundle? slow API? huge images? too many re-renders? render-blocking resources?
3. **Fix the biggest issue first**, then re-measure to prove the improvement with numbers.

Then list fixes by category:

- **Less JavaScript:** Server Components, code splitting with `next/dynamic` / `React.lazy` for heavy components (charts, editors, modals), per-method imports (`import debounce from 'lodash/debounce'`) or ESM packages like `lodash-es` that bundlers can tree-shake, not all of lodash, remove unused dependencies.
- **Assets:** `next/image`, WebP/AVIF, SVG icons, `next/font`, lazy-load below-the-fold media.
- **Rendering:** avoid unnecessary re-renders (memoization where profiled, state colocation, Zustand selectors), virtualize long lists (TanStack Virtual), debounce expensive handlers.
- **Network:** caching (ISR, TanStack Query `staleTime`, HTTP cache headers), CDN, prefetching (Next.js `Link` prefetches automatically), parallel requests instead of waterfalls.
- **Third-party scripts:** load with `next/script` and `strategy="lazyOnload"` or `afterInteractive`.

Have one real story ready: "Our product page LCP was 4.1s; the hero image was a 2MB PNG. Switching to `next/image` with `preload` and AVIF brought it to 1.9s."

**বাংলায়:**

আগে measure করুন: PageSpeed Insights/CrUX, `web-vitals`, Lighthouse, DevTools Performance tab, React Profiler আর bundle analyzer দিয়ে। তারপর bottleneck খুঁজুন — বড় bundle, slow API, ভারী image নাকি অতিরিক্ত re-render। সবচেয়ে বড় সমস্যা আগে fix করে আবার measure করে সংখ্যা দিয়ে প্রমাণ করুন। Fix-গুলো category ধরে বলুন: কম JavaScript, asset optimization, rendering, network caching, third-party script। একটা real story রাখুন, যেমন 2MB PNG hero image বদলে LCP 4.1s থেকে 1.9s।

### Q3. What is code splitting and lazy loading?

Splitting the JS bundle into chunks so users download only what the current page needs. Next.js splits by route automatically; you add manual splits for heavy components:

```tsx
'use client'; // ssr: false is only allowed in a Client Component in the App Router
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const Chart = dynamic(() => import('@/components/Chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />,
});
```

**বাংলায়:**

Code splitting মানে JS bundle-কে ছোট chunk-এ ভাগ করা, যাতে user শুধু এই page-এর দরকারি code download করে। Next.js route অনুযায়ী নিজে থেকেই split করে। Chart বা editor-এর মতো ভারী component-এর জন্য `next/dynamic` দিয়ে lazy load করা হয়, সাথে একটা `loading` skeleton। খেয়াল রাখবেন, App Router-এ `ssr: false` শুধু Client Component-এ (`'use client'`) চলে।

### Q4. What is hydration, and what causes hydration errors?

Hydration is React attaching event handlers to server-rendered HTML so it becomes interactive. A **hydration mismatch** happens when server HTML differs from the first client render — common causes: `Date.now()`/`Math.random()` in render, reading `window`/`localStorage` during render, locale-specific date formatting, or invalid HTML nesting (a `div` inside a `p`). Fix by moving browser-only logic into `useEffect`, or using `dynamic(..., { ssr: false })` from `next/dynamic` (only inside a `'use client'` file in the App Router).

**বাংলায়:**

Hydration হলো server-rendered HTML-এ React event handler লাগিয়ে সেটাকে interactive করা। Server HTML আর client-এর first render না মিললে hydration mismatch হয়। Common কারণ: render-এ `Date.now()`/`Math.random()`, render-এর সময় `window`/`localStorage` পড়া, locale-ভিত্তিক date format, বা `p`-এর ভেতরে `div`-এর মতো invalid HTML। সমাধান: browser-only logic `useEffect`-এ নিন, অথবা `'use client'` file-এ `dynamic(..., { ssr: false })` ব্যবহার করুন।

### Q5. What else improves SEO beyond metadata?

Fast Core Web Vitals (a ranking signal), mobile-friendliness, server-rendered content, clean URLs (`/products/blue-shoes` not `?id=123`), internal linking with real `<a>` tags (Next.js `Link` renders them), structured data (JSON-LD), sitemap, canonical tags, correct `lang` attribute, and proper 404/301 handling.

**বাংলায়:**

Metadata ছাড়াও SEO-তে অনেক কিছু লাগে। দ্রুত Core Web Vitals (এটা ranking signal), mobile-friendly design, server-rendered content আর clean URL (`/products/blue-shoes`, `?id=123` না)। এছাড়া real `<a>` tag দিয়ে internal linking, JSON-LD structured data, sitemap, canonical tag, সঠিক `lang` attribute আর ঠিকঠাক 404/301 handling।

### Q6. How do you ensure cross-browser compatibility?

- Define target browsers with **Browserslist**; Next.js/SWC uses it to transpile JS. Tailwind v4 uses Lightning CSS for prefixing (no Autoprefixer needed) and targets Safari 16.4+, Chrome 111+, Firefox 128+ — if you must support older browsers, stay on Tailwind v3.4.
- Check feature support on **caniuse.com** before using newer APIs (e.g. `:has()`, container queries, `structuredClone`).
- Use **progressive enhancement** and feature detection (`@supports`, `'IntersectionObserver' in window`) with fallbacks.
- Test on real Safari/iOS — it's the most common source of bugs (`100vh` with the mobile address bar → use `100dvh`; date input styling; flex `gap` in very old versions).
- Use cross-browser testing tools like **BrowserStack** or **Playwright** (which runs Chromium, Firefox and WebKit).
- CSS reset/normalize (Tailwind Preflight already does this; v4 builds on modern CSS like `@layer` and `color-mix()`, which is why it needs those newer browsers).

**বাংলায়:**

- **Browserslist** দিয়ে target browser ঠিক করুন; Tailwind v4 শুধু Safari 16.4+, Chrome 111+, Firefox 128+ support করে, পুরনো browser লাগলে v3.4-এ থাকুন।
- নতুন API (`:has()`, container queries) ব্যবহারের আগে caniuse.com দেখুন, `@supports` দিয়ে feature detection আর fallback রাখুন।
- Real Safari/iOS-এ test করুন — বেশিরভাগ bug ওখানেই, যেমন `100vh`-এর বদলে `100dvh`।
- BrowserStack বা Playwright (Chromium, Firefox, WebKit) দিয়ে cross-browser test চালান।

### Q7. What are web performance quick wins you always apply?

Image optimization, font optimization, lazy-loading heavy components, avoiding layout shift, compressing (Brotli/gzip, handled by Vercel/CDN), caching static assets with long `Cache-Control` and hashed filenames, and keeping dependencies lean (check size on bundlephobia before installing).

**বাংলায়:**

এগুলো প্রায় প্রতিটা project-এ apply করা যায়: image আর font optimization, ভারী component lazy-load, layout shift এড়ানো। Brotli/gzip compression সাধারণত Vercel/CDN নিজেই করে। Hashed filename-ওয়ালা static asset লম্বা `Cache-Control` দিয়ে cache করুন। আর কোনো dependency install করার আগে bundlephobia-তে size দেখে নিন।

---

## 6b. Browser & networking

### B1. What happens when you type a URL and press Enter?

1. **URL parsing** — the browser checks whether it's a URL or a search term.
2. **Service worker, then cache** — if the site registered a service worker, it intercepts the request first and may answer from its own cache; otherwise the browser checks its HTTP cache. If a fresh copy exists, no network is needed.
3. **DNS lookup** — the domain is resolved to an IP address (browser cache → OS → router → ISP/DNS resolver).
4. **TCP connection** — a three-way handshake (SYN, SYN-ACK, ACK) with the server. HTTP/3 uses QUIC over UDP instead.
5. **TLS handshake** — for HTTPS, the browser verifies the certificate and agrees on encryption keys (with HTTP/3, TLS 1.3 is built into the QUIC handshake, saving a round trip).
6. **HTTP request** — `GET /` with headers (cookies, `Accept`, `User-Agent`).
7. **Server response** — status code, headers and the HTML body, often through a CDN.
8. **Rendering** — the browser parses HTML, fetches CSS/JS/images, and paints the page (see B2).

This is a classic question; a clear, ordered answer impresses more than extreme detail.

**বাংলায়:**

- Browser আগে দেখে এটা URL নাকি search term; তারপর service worker বা HTTP cache-এ fresh copy থাকলে network লাগে না।
- না থাকলে DNS lookup করে domain থেকে IP বের করে, তারপর TCP handshake (SYN, SYN-ACK, ACK) — HTTP/3 হলে QUIC over UDP।
- HTTPS-এ TLS handshake হয়: certificate verify আর encryption key ঠিক করা (HTTP/3-এ TLS আলাদা ধাপ না, QUIC handshake-এর ভেতরেই হয়)।
- তারপর HTTP request যায়, server (প্রায়ই CDN হয়ে) status, header আর HTML পাঠায়, আর browser সেটা parse করে render করে।
- Interview-এ অতিরিক্ত detail-এর চেয়ে পরিষ্কার, ক্রমানুসারে বলাটাই বেশি impress করে।

### B2. How does the browser render (paint) HTML? Explain the critical rendering path.

1. **Parse HTML → DOM** (Document Object Model), a tree of nodes. Parsing is incremental, so the browser starts before the whole file arrives.
2. **Parse CSS → CSSOM** (CSS Object Model). CSS is **render-blocking**: the browser won't paint until it has the CSS, to avoid a flash of unstyled content.
3. **JavaScript** — a normal `<script>` **blocks HTML parsing** while it downloads and runs, because JS can change the DOM.
4. **Render tree** — DOM + CSSOM combined, containing only visible elements (`display: none` is excluded).
5. **Layout (reflow)** — calculate the exact size and position of every element.
6. **Paint** — fill in pixels: text, colors, borders, shadows, images, in layers.
7. **Composite** — the GPU combines layers in the right order and shows them on screen.

**How to optimize it:** inline or preload critical CSS, use `defer` on scripts, reduce render-blocking resources, and keep the DOM small. This is why SSR helps LCP: real HTML arrives in step 1.

**বাংলায়:**

Browser HTML parse করে DOM বানায়, CSS parse করে CSSOM বানায় — CSS render-blocking, আর সাধারণ `<script>` HTML parsing আটকে দেয়। DOM আর CSSOM মিলে render tree হয় (`display: none` বাদ)। তারপর layout-এ প্রতিটা element-এর size/position হিসাব হয়, paint-এ pixel আঁকা হয়, আর composite-এ GPU layer-গুলো মিলিয়ে screen-এ দেখায়। Optimize করতে critical CSS inline/preload, script-এ `defer`, আর ছোট DOM রাখুন। SSR LCP-তে সাহায্য করে কারণ real HTML প্রথম ধাপেই চলে আসে।

### B3. Reflow vs repaint vs composite — what's the difference?

- **Reflow (layout):** geometry changes — width, height, margin, adding/removing elements, changing font size. Most expensive, because it can affect the whole page and is followed by paint.
- **Repaint:** visual-only changes — color, background, visibility. No layout, but pixels are redrawn.
- **Composite only:** `transform` and `opacity` changes can skip layout and paint and run on the GPU. Cheapest.

**Practical tips:** animate `transform` and `opacity`, not `top`/`left`/`width`. Avoid **layout thrashing** — reading layout (`offsetHeight`, `getBoundingClientRect`) and writing styles in a loop forces repeated reflows; batch reads, then writes. Use `requestAnimationFrame` for visual updates.

**বাংলায়:**

Reflow (layout) হয় geometry বদলালে — width, margin, element add/remove; এটা সবচেয়ে expensive, আর এরপর paint-ও হয়। Repaint শুধু visual change, যেমন color বা background; layout লাগে না। `transform` আর `opacity` শুধু composite হয়, GPU-তে চলে, performance-এর দিক থেকে সবচেয়ে cheap। তাই animation-এ `top`/`left`/`width` না, `transform` আর `opacity` ব্যবহার করুন। Loop-এ layout read আর style write মেশালে layout thrashing হয় — আগে সব read, তারপর write করুন, আর `requestAnimationFrame` ব্যবহার করুন।

### B4. `<script>` vs `async` vs `defer`?

| Attribute | Download | Execution | Order kept? | Use for |
| --- | --- | --- | --- | --- |
| none | Blocks parsing | Immediately, blocks parsing | Yes | Rarely — avoid in `<head>` |
| `async` | In parallel | As soon as downloaded (may interrupt parsing) | No | Independent scripts: analytics, ads |
| `defer` | In parallel | After HTML is parsed, before `DOMContentLoaded` | Yes | App scripts that need the DOM |

ES modules (`type="module"`) are deferred by default. In Next.js, `next/script` handles this with `strategy`.

**বাংলায়:**

সাধারণ `<script>` download আর execute দুইটার সময়ই HTML parsing আটকে রাখে, তাই `<head>`-এ এড়িয়ে চলুন। `async` parallel-এ download করে, download শেষ হলেই চালায় — order ঠিক থাকে না, analytics বা ads-এর মতো independent script-এর জন্য ভালো। `defer` parallel-এ download করে, HTML parse শেষে `DOMContentLoaded`-এর আগে order মেনে চালায় — DOM লাগে এমন app script-এর জন্য। `type="module"` default-ভাবেই deferred, আর Next.js-এ `next/script`-এর `strategy` এটা handle করে।

### B5. Walk me through how an API call goes from this client (browser) to the API and back.

Use a concrete example: `fetch('https://api.shop.com/products')` from a React component.

1. **JS calls `fetch`** — it returns a Promise immediately; the request runs off the main thread, so the UI isn't blocked.
2. **Same-origin check** — if the API is on a different origin (protocol, domain or port), CORS rules apply. For non-simple requests (custom headers like `Authorization`, a `Content-Type: application/json` header, `PUT`/`DELETE`), the browser first sends an **`OPTIONS` preflight** asking permission.
3. **Connection** — DNS lookup, TCP and TLS handshake, unless an existing connection is reused (keep-alive, HTTP/2).
4. **Request sent** — method, URL, headers (`Content-Type`, `Authorization: Bearer …`), cookies (if `credentials: 'include'`), and a body for `POST`/`PUT`/`PATCH`.
5. **Server side** — load balancer → API server → routing → auth middleware checks the token → controller runs business logic → database query → builds the response.
6. **Response** — status code (`200`, `201`, `404`…), headers (`Content-Type: application/json`, `Cache-Control`, `Access-Control-Allow-Origin`) and body.
7. **Browser checks CORS headers** — if they don't allow your origin, the browser blocks JS from reading the response (you see a CORS error, even though the server responded).
8. **Promise resolves** with a `Response` object; you call `await res.json()` to parse the body stream into a JS object.
9. **App updates** — set state (or TanStack Query cache), React re-renders, the UI shows the data.

**Bonus point:** with Next.js Server Components or route handlers, the fetch happens **server-to-server**, so there's no CORS, secrets stay on the server, and the browser receives ready HTML.

**বাংলায়:**

- `fetch` সাথে সাথে একটা Promise দেয়, request main thread-এর বাইরে চলে, তাই UI block হয় না।
- অন্য origin হলে CORS apply হয়; `Authorization` header বা `Content-Type: application/json` header থাকলে browser আগে `OPTIONS` preflight পাঠায়।
- DNS, TCP, TLS হয় (keep-alive/HTTP/2 থাকলে connection reuse হয়), তারপর request যায়; server-এ load balancer → auth middleware → business logic → database।
- Response আসার পর browser CORS header check করে; allow না করলে server respond করলেও JS response পড়তে পারে না।
- তারপর `await res.json()`, state update, re-render। Server Component বা route handler-এ fetch server-to-server হয়, তাই CORS নেই আর secret server-এই থাকে।

### B6. What does a REST API return? What is the return type?

**Say this:** A REST API returns an **HTTP response**, made of three parts: a **status code**, **headers**, and an optional **body**. The body is most commonly **JSON**, indicated by the `Content-Type: application/json` header, but it can also be XML, plain text, HTML, binary files (images, PDFs) or empty (`204 No Content`).

On the frontend, `fetch()` returns a `Promise<Response>`. The `Response` object has `status`, `ok` (true for 200–299), `headers`, and methods to read the body: `.json()` (returns a Promise of the parsed object), `.text()`, `.blob()`, `.arrayBuffer()`, `.formData()`. The body can only be read once.

```typescript
const res = await fetch('/api/users/42');   // Promise<Response>
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const user: User = await res.json();       // Promise<any> → typed as User
```

A typical JSON response shape:

```json
{
  "data": [{ "id": 1, "name": "Asha" }],
  "meta": { "page": 1, "pageSize": 20, "total": 134 }
}
```

And a typical error response: `{ "error": { "code": "VALIDATION_ERROR", "message": "Email is invalid", "fields": { "email": "Invalid format" } } }` with status `400` or `422`.

**Trap to mention:** `fetch` only rejects on **network failure**. A `404` or `500` still resolves successfully, so you must check `res.ok`. Axios, by contrast, rejects on any non-2xx status and parses JSON automatically.

**বাংলায়:**

REST API একটা **HTTP response** দেয়, যার তিন অংশ: status code, headers আর optional body। Body বেশিরভাগ সময় JSON (`Content-Type: application/json`), তবে XML, text, binary বা empty (`204 No Content`)-ও হতে পারে। Frontend-এ `fetch()` দেয় `Promise<Response>`; body পড়তে `.json()`, `.text()`, `.blob()` ইত্যাদি, আর body একবারই পড়া যায়। Trap: `fetch` শুধু network failure-এ reject করে, `404`/`500`-এ না — তাই `res.ok` check করতেই হবে। Axios আবার যেকোনো non-2xx-এ reject করে আর JSON auto parse করে।

### B7. `fetch` vs Axios?

`fetch` is built into browsers and Node 18+, no dependency, works with Next.js caching. You must check `res.ok` and call `.json()` yourself, and timeouts need `AbortController`. **Axios** adds automatic JSON parsing, rejects on HTTP errors, request/response **interceptors** (attach tokens, refresh on 401), timeouts, and upload progress. In Next.js App Router projects, `fetch` is usually preferred.

**বাংলায়:**

`fetch` browser আর Node 18+-এ built-in, কোনো dependency লাগে না, আর Next.js caching-এর সাথে কাজ করে। কিন্তু `res.ok` check আর `.json()` নিজে করতে হয়, timeout-এর জন্য `AbortController` লাগে। Axios auto JSON parsing, HTTP error-এ reject, interceptors (token লাগানো, 401-এ refresh), timeout আর upload progress দেয়। Next.js App Router project-এ সাধারণত `fetch`-ই prefer করা হয়।

### B8. Cookies vs localStorage vs sessionStorage vs IndexedDB?

| Storage | Size | Lifetime | Sent with requests? | Readable by JS? | Use for |
| --- | --- | --- | --- | --- | --- |
| Cookies | ~4 KB each | Until expiry | Yes, automatically | Not if `httpOnly` | Sessions, auth tokens |
| localStorage | ~5–10 MB | Until cleared | No | Yes (synchronous) | Preferences, theme, drafts |
| sessionStorage | ~5 MB | Until the tab closes | No | Yes | Per-tab temporary state, multi-step forms |
| IndexedDB | Large (hundreds of MB+) | Until cleared | No | Yes (async) | Offline data, large structured data |

Never store sensitive tokens in localStorage — any XSS can read it.

**বাংলায়:**

Cookie ছোট (~4 KB), প্রতিটা request-এ automatically যায়, আর `httpOnly` হলে JS পড়তে পারে না — তাই session/auth token-এর জন্য। localStorage (~5–10 MB) clear না করা পর্যন্ত থাকে, synchronous — theme, preference, draft-এর জন্য। sessionStorage tab বন্ধ হলেই মুছে যায় — multi-step form-এর মতো per-tab data। IndexedDB async আর অনেক বড় data রাখতে পারে — offline data-র জন্য। Sensitive token কখনো localStorage-এ রাখবেন না, যেকোনো XSS সেটা পড়ে ফেলতে পারে।

### B9. How does browser caching work?

The server controls it with headers. `Cache-Control: max-age=31536000, immutable` caches a file for a year (used for hashed JS/CSS files like `main.a1b2c3.js`). `no-cache` means "check with the server before using" — the browser sends `If-None-Match` with the **ETag**, and the server replies `304 Not Modified` (no body) if unchanged. `no-store` means never cache (sensitive data). CDNs cache at the edge using similar rules.

**বাংলায়:**

Browser caching server-এর header দিয়ে control হয়। `Cache-Control: max-age=31536000, immutable` দিয়ে hashed JS/CSS file এক বছর cache থাকে। `no-cache` মানে ব্যবহারের আগে server-এর সাথে check — browser ETag দিয়ে `If-None-Match` পাঠায়, file না বদলালে server body ছাড়া `304 Not Modified` দেয়। `no-store` মানে কখনোই cache না, sensitive data-র জন্য। CDN-ও edge-এ একই রকম rule মেনে cache করে।

### B10. HTTP/1.1 vs HTTP/2 vs HTTP/3?

**HTTP/1.1:** one request at a time per connection, so browsers open ~6 connections per domain; head-of-line blocking. **HTTP/2:** multiplexing many requests over one connection, header compression, binary protocol — bundling every file into one is less critical now. **HTTP/3:** runs over QUIC (UDP), faster connection setup and no TCP head-of-line blocking, better on unreliable mobile networks.

**বাংলায়:**

HTTP/1.1-এ একটা connection-এ একবারে একটা request, তাই browser domain প্রতি ~6টা connection খোলে, আর head-of-line blocking হয়। HTTP/2 একটা connection-এ অনেক request multiplex করে, header compress করে — তাই সব file একটায় bundle করা এখন কম জরুরি। HTTP/3 QUIC (UDP)-এর ওপর চলে, connection setup দ্রুত, TCP head-of-line blocking নেই, unstable mobile network-এ ভালো।

### B11. What are XSS and CSRF, and how do you prevent them?

**XSS (Cross-Site Scripting):** an attacker injects script into your page (e.g. through a comment field). React escapes text by default; dangers are `dangerouslySetInnerHTML`, `href="javascript:…"`, and third-party scripts. Prevent with sanitizing (DOMPurify) and a **Content Security Policy** header. httpOnly cookies don't prevent XSS, but they limit the damage — the injected script can't read and steal the token.

**CSRF (Cross-Site Request Forgery):** another site makes the user's browser send an authenticated request to your API using their cookies. Prevent with `SameSite=Lax/Strict` cookies, CSRF tokens, and checking the `Origin` header. Next.js Server Actions include origin checks.

**বাংলায়:**

XSS মানে attacker আপনার page-এ script ঢুকিয়ে দেয়, যেমন comment field দিয়ে। React default-ভাবে text escape করে; ঝুঁকি হলো `dangerouslySetInnerHTML`, `javascript:` href আর third-party script — DOMPurify আর Content Security Policy দিয়ে ঠেকান। httpOnly cookie XSS ঠেকায় না, তবে script token পড়ে চুরি করতে পারে না বলে ক্ষতি কমায়। CSRF মানে অন্য site user-এর cookie ব্যবহার করে আপনার API-তে authenticated request পাঠায়। এটা ঠেকাতে `SameSite=Lax/Strict` cookie, CSRF token আর `Origin` header check করুন; Next.js Server Actions-এ origin check built-in।

### B12. Explain event bubbling, capturing and delegation.

A DOM event travels in three phases: **capturing** (window down to the target), **target**, then **bubbling** (back up to window). Listeners run in the bubbling phase by default. **Event delegation** attaches one listener to a parent and uses `event.target` to handle clicks from many children — efficient for long lists. `e.stopPropagation()` stops bubbling; `e.preventDefault()` stops the default action (form submit, link navigation). React attaches its listeners at the root and uses delegation internally.

**বাংলায়:**

DOM event তিন phase-এ চলে: capturing (window থেকে target পর্যন্ত নিচে), target, তারপর bubbling (আবার ওপরে)। Default-ভাবে listener bubbling phase-এ চলে। Event delegation মানে parent-এ একটা listener লাগিয়ে `event.target` দিয়ে অনেক child-এর click handle করা — লম্বা list-এর জন্য efficient। `e.stopPropagation()` bubbling থামায়, `e.preventDefault()` default action (form submit, link navigation) থামায়। React নিজেও root-এ listener লাগিয়ে delegation ব্যবহার করে।

### B13. What are Web Workers and Service Workers?

**Web Workers** run JavaScript on a background thread for heavy computation (parsing large files, image processing) so the UI stays responsive; they can't touch the DOM and communicate with `postMessage`. **Service Workers** sit between the page and the network as a programmable proxy: offline support, caching strategies, push notifications — the basis of **PWAs**. MSW uses a service worker to mock APIs in the browser.

**বাংলায়:**

Web Worker background thread-এ JavaScript চালায়, ভারী কাজ (বড় file parse, image processing) করার সময় UI responsive থাকে। Worker DOM touch করতে পারে না, `postMessage` দিয়ে communicate করে। Service Worker page আর network-এর মাঝে programmable proxy — offline support, caching strategy, push notification, মানে PWA-র ভিত্তি। MSW browser-এ API mock করতে service worker ব্যবহার করে।

### B14. Why does a long JavaScript task freeze the page?

The main thread handles JS, style calculation, layout, paint and user input. A task longer than **50 ms** (a "long task") blocks clicks, typing and other input handling (and scrolling only if non-passive scroll/touch listeners are attached), which hurts INP. Fixes: split work into chunks and yield (`setTimeout`, `scheduler.yield()` where supported), move heavy work to a Web Worker, use `useTransition`/`useDeferredValue` in React for non-urgent updates, and virtualize long lists.

**বাংলায়:**

Main thread একসাথে JS, style, layout, paint আর user input সব handle করে। 50 ms-এর বেশি লম্বা task (long task) click আর typing আটকে দেয় (non-passive scroll/touch listener থাকলে scroll-ও), ফলে INP খারাপ হয়। সমাধান: কাজ ছোট chunk-এ ভাগ করে yield করুন (`setTimeout`, support থাকলে `scheduler.yield()`), ভারী কাজ Web Worker-এ পাঠান। React-এ non-urgent update-এর জন্য `useTransition`/`useDeferredValue` আর লম্বা list virtualize করুন।

---

## 7. AI-assisted development

### Q1. Which AI tools do you use, and for what?

Name tools and match each to a task — concrete beats generic:

| Tool | What you use it for |
| --- | --- |
| GitHub Copilot (inline + chat) | Autocomplete for boilerplate, repetitive JSX, types, small functions while typing |
| Claude Code / Cursor (agentic, repo-aware) | Multi-file changes, refactors, scaffolding a feature, running tests and fixing failures, explaining unfamiliar parts of a codebase |
| ChatGPT / Claude chat | Thinking through architecture, comparing approaches, debugging an error with context, writing docs and regex |
| v0 / Figma Dev Mode / design-to-code tools | First draft of a UI from a design or description, which you then refactor into your components |

**Sample answer:** "I use Copilot all day for autocomplete. For bigger tasks I use Claude Code — for example, I asked it to migrate our data fetching from `useEffect` to TanStack Query across 12 components. It did the bulk in minutes, and I spent my time reviewing each diff, fixing two places where it dropped error handling, and adding tests."

**বাংলায়:**

Tool-এর নাম বলুন আর প্রতিটা কোন কাজে ব্যবহার করেন সেটা মিলিয়ে বলুন — generic কথার চেয়ে concrete বেশি ভালো। যেমন: Copilot autocomplete-এর জন্য, Claude Code/Cursor multi-file refactor আর test চালানোর জন্য, ChatGPT/Claude chat architecture ভাবা বা debugging-এর জন্য, v0/Figma Dev Mode UI-র first draft-এর জন্য। একটা real উদাহরণ দিন: AI দিয়ে 12টা component `useEffect` থেকে TanStack Query-তে migrate করেছেন। আর জোর দিয়ে বলুন যে প্রতিটা diff review করে যে দুই জায়গায় AI error handling বাদ দিয়ে ফেলেছিল সেগুলো ঠিক করেছেন আর test লিখেছেন।

### Q2. Walk me through your AI-assisted workflow on a feature.

1. **Understand the task myself first** — I can't evaluate output for a problem I haven't thought about.
2. **Give context** — relevant files, types, the API contract, existing components to reuse, coding conventions (many tools support a project rules file like `CLAUDE.md`, `AGENTS.md`, Cursor's `.cursor/rules/` or Copilot's `.github/copilot-instructions.md`).
3. **Ask for a plan before code** on anything non-trivial, and correct the plan.
4. **Generate in small, reviewable chunks**, not a whole feature at once.
5. **Review every line**, run the type checker, linter and tests.
6. **Use AI for tests and docs too**, then verify those tests actually fail when the code is broken.
7. **Commit with a clear message** and go through normal code review — AI code gets the same scrutiny as human code.

**বাংলায়:**

- আগে নিজে task-টা বুঝি, নাহলে AI-এর output evaluate করতে পারব না।
- Context দিই: relevant file, type, API contract, existing component, আর `CLAUDE.md`, `AGENTS.md` বা `.cursor/rules/`-এর মতো rules file।
- বড় কাজে আগে plan চাই, plan ঠিক করি, তারপর ছোট ছোট reviewable chunk-এ code generate করাই।
- প্রতিটা line review করি, type checker, linter, test চালাই; test আর docs লেখাতেও AI ব্যবহার করি, তারপর code ভাঙলে AI-লেখা test আসলেই fail করে কিনা দেখি।
- পরিষ্কার commit message দিয়ে normal code review-তে পাঠাই — AI code-ও human code-এর মতোই scrutiny পায়।

### Q3. What is prompt engineering? How do you write a good prompt for code?

**Say this:** It's structuring instructions and context so the model produces accurate, usable output. For code, the key ingredients are context, constraints, examples and a clear output format.

**Weak prompt:** "Make a login form."

**Strong prompt:**

> "Create a `LoginForm` component in Next.js 16 App Router with TypeScript and Tailwind. Use React Hook Form with a Zod schema: email (valid email) and password (min 8 chars). Reuse our `Button` and `Input` from `@/components/ui`. On submit call the existing `login()` server action from `@/app/actions/auth.ts`, show field errors under inputs, disable the button while submitting, and show a server error message at the top. It must be keyboard accessible with proper labels. Don't add new dependencies. Return only the component file."

Techniques worth naming: give a role and context, specify versions (models often default to outdated APIs like Pages Router), show an example of your existing code style, ask it to reason step by step or plan first, ask for edge cases and tests, and iterate with specific feedback ("the error state doesn't reset when the user types — fix only that").

**বাংলায়:**

Prompt engineering মানে instruction আর context এমনভাবে সাজানো যাতে model সঠিক, ব্যবহারযোগ্য output দেয়। Code-এর জন্য মূল উপাদান: context, constraints, example আর পরিষ্কার output format। "Make a login form" weak prompt; strong prompt-এ version (Next.js 16 App Router), library (React Hook Form + Zod), reuse করার component, accessibility আর "নতুন dependency না" সব বলা থাকে। Version উল্লেখ করা জরুরি, কারণ model প্রায়ই Pages Router-এর মতো পুরনো API দেয়। তারপর নির্দিষ্ট feedback দিয়ে iterate করুন।

### Q4. How do you review and validate AI-generated code?

- **Correctness:** Does it actually solve the requirement? Test edge cases: empty arrays, null/undefined, slow or failed network, very long text, double clicks.
- **Hallucinations:** Do the imported packages, functions and API options really exist in our versions? (A classic: invented props or deprecated Next.js APIs.)
- **Types:** No `any`, no unsafe `as` casts hiding problems; `tsc` passes.
- **Security:** No secrets in client code, no `dangerouslySetInnerHTML` with user input, input validated on the server, auth checked in server actions/routes, no SQL/command injection.
- **Performance:** No fetching in loops, unnecessary re-renders, effects without cleanup, or huge new dependencies.
- **Accessibility:** Semantic elements, labels, keyboard support — AI often outputs clickable `div`s.
- **Consistency/maintainability:** Matches our patterns, reuses existing components and utils instead of duplicating, readable naming, no dead code.
- **Licensing/dependencies:** Any new package is justified, maintained and license-compatible.
- **Tests:** Run existing tests; add new ones; make sure AI-written tests assert meaningful behavior and aren't just written to pass.

**The golden rule to say out loud:** "If I can't explain a line in code review, it doesn't get merged — regardless of who or what wrote it."

**বাংলায়:**

- Correctness আর edge case: empty array, null, network fail, double click।
- Hallucination: imported package বা API option আসলেই আমাদের version-এ আছে কিনা; `any` বা unsafe `as` cast নেই, `tsc` pass করে।
- Security (client-এ secret নেই, user input-এ `dangerouslySetInnerHTML` নেই, server-এ validation আর auth), performance আর accessibility — AI প্রায়ই clickable `div` দেয়।
- আমাদের pattern মানছে কিনা, নতুন package justified আর license ঠিক কিনা, test meaningful কিনা।
- Golden rule: "কোনো line code review-তে explain করতে না পারলে সেটা merge হবে না — যে-ই লিখুক।"

### Q5. Give an example where AI gave you wrong or bad code.

Prepare a real story. Typical, believable examples:

- It used `getServerSideProps` inside an App Router project (outdated API).
- It wrote a `useEffect` fetch with no cleanup, causing a race condition when the user switched tabs quickly.
- It suggested storing a JWT in `localStorage`.
- It invented a prop on a library component that didn't exist.
- It made tests pass by mocking the very function under test.

Structure: what you asked → what it produced → how you caught it (types, test, review, docs) → what you changed → what you learned (e.g. "now I always state the Next.js version in my prompt").

**বাংলায়:**

একটা real story রেডি রাখুন। বিশ্বাসযোগ্য উদাহরণ: App Router project-এ `getServerSideProps`, cleanup ছাড়া `useEffect` fetch যেটা race condition বানিয়েছে, `localStorage`-এ JWT রাখার পরামর্শ, বা library-তে নেই এমন prop বানিয়ে ফেলা। কিংবা যে function test হচ্ছে সেটাকেই mock করে test pass করানো। গল্পটা এভাবে সাজান: কী চেয়েছিলেন → AI কী দিল → কীভাবে ধরলেন (type, test, review, docs) → কী বদলালেন → কী শিখলেন।

### Q6. How do you use AI for debugging?

Give the full error message and stack trace, the relevant code, what you expected vs what happened, and what you already tried. Ask it for **possible causes ranked by likelihood** rather than a single fix, then verify each with logs or breakpoints. AI speeds up the hypothesis step; you still confirm the root cause. For agentic tools, let them run the failing test and iterate, but review the final diff.

**বাংলায়:**

AI-কে পুরো error message, stack trace, relevant code, কী আশা করেছিলেন আর কী হলো, আর কী already try করেছেন — সব দিন। একটা fix না চেয়ে likelihood অনুযায়ী সম্ভাব্য কারণের list চান। তারপর log বা breakpoint দিয়ে প্রতিটা verify করুন — AI hypothesis দ্রুত দেয়, root cause আপনাকেই confirm করতে হবে। Agentic tool-কে failing test চালিয়ে iterate করতে দিতে পারেন, কিন্তু final diff review করবেন।

### Q7. How do you use AI for testing and documentation?

Testing: generate test cases from a component, especially edge cases you may forget; generate mock data and MSW handlers. Then review that assertions check behavior. Documentation: JSDoc comments, README setup steps, PR descriptions, Storybook stories, and explaining legacy code to new teammates.

**বাংলায়:**

Testing-এ AI দিয়ে component থেকে test case বানানো যায়, বিশেষ করে যেসব edge case ভুলে যেতে পারেন; mock data আর MSW handler-ও বানানো যায়। তবে assertion আসলেই behavior check করছে কিনা review করতে হবে। Documentation-এ JSDoc comment, README setup step, PR description, Storybook story, আর নতুন teammate-দের জন্য legacy code explain করাতে AI কাজে লাগে।

### Q8. What are the risks of AI coding tools for a team, and how do you manage them?

- **Security & privacy:** never paste secrets, credentials, customer data or proprietary code into tools the company hasn't approved; use enterprise versions with no-training data policies.
- **Code quality drift:** inconsistent patterns and duplicate code → solve with shared rules files, linting, and code review.
- **Over-reliance / skill atrophy:** keep understanding fundamentals; use AI as a pair programmer, not an autopilot.
- **Hallucinated or vulnerable dependencies:** verify every package (typosquatting is real).
- **License concerns:** check that generated code doesn't reproduce licensed code verbatim; many tools offer filters for this.

**বাংলায়:**

- Security/privacy: company approve করেনি এমন tool-এ secret, customer data বা proprietary code paste করবেন না; no-training policy-ওয়ালা enterprise version ব্যবহার করুন।
- Code quality drift আর duplicate code — shared rules file, linting আর code review দিয়ে সামলান।
- Over-reliance: fundamentals বুঝতে থাকুন, AI pair programmer, autopilot না।
- Hallucinated বা vulnerable dependency (typosquatting) verify করুন, আর generated code যেন licensed code হুবহু copy না করে সেটা দেখুন।

### Q9. Does AI make developers less necessary?

Good balanced answer: "It shifts the work. Typing code is faster, so more of the value is in understanding requirements, designing components, reviewing, testing and making judgment calls on trade-offs. A developer who uses AI well and reviews carefully ships much more than one who doesn't — but someone still has to own the quality."

**বাংলায়:**

Balanced উত্তর: AI কাজটাকে shift করে। Code টাইপ করা দ্রুত হয়, তাই value বেশি আসে requirement বোঝা, component design, review, testing আর trade-off-এ সিদ্ধান্ত নেওয়া থেকে। যে developer AI ভালোভাবে ব্যবহার করে আর যত্ন নিয়ে review করে, সে অনেক বেশি ship করে। কিন্তু quality-র দায়িত্ব কাউকে না কাউকে নিতেই হয়।

### Q10. Have you heard of MCP or agents?

**MCP (Model Context Protocol)** is an open standard that lets AI tools connect to external systems — GitHub, Figma, databases, issue trackers — so an assistant can read a Figma frame or a Jira ticket directly. **Agentic tools** like Claude Code can plan, edit multiple files, run commands and tests, and iterate. Mention that you still keep them on a review loop: small tasks, clear instructions, inspect the diff.

**বাংলায়:**

MCP (Model Context Protocol) একটা open standard, যেটা দিয়ে AI tool GitHub, Figma, database বা issue tracker-এর মতো external system-এ connect করতে পারে — যেমন সরাসরি Figma frame বা Jira ticket পড়া। Claude Code-এর মতো agentic tool plan করতে, অনেক file edit করতে, command আর test চালাতে, আর iterate করতে পারে। তবে বলবেন যে এগুলো review loop-এ রাখেন: ছোট task, পরিষ্কার instruction, আর diff inspect করা।

### Q11. Review this AI-generated component. What's wrong with it?

```tsx
'use client';
export default function UserList() {
  const [users, setUsers] = useState<any>([]);
  useEffect(() => {
    fetch('https://api.example.com/users?key=sk_live_123')
      .then(res => res.json())
      .then(data => setUsers(data));
  });
  return (
    <div>
      {users.map((u, i) => (
        <div key={i} onClick={() => alert(u.name)}
          dangerouslySetInnerHTML={{ __html: u.bio }} />
      ))}
    </div>
  );
}
```

**Answer:** missing dependency array → infinite fetch loop; API secret exposed in client code; `any` type; no `res.ok` check, loading, error or empty states; no abort/cleanup; index as key; clickable `div` (not accessible — use `button`); `dangerouslySetInnerHTML` with user data → XSS (sanitize with DOMPurify or render as text); could be a Server Component or use TanStack Query; missing imports for `useState`/`useEffect`.

**বাংলায়:**

- Dependency array নেই, তাই প্রতি render-এ fetch হয়ে infinite loop হয়; আর client code-এ `sk_live` API secret exposed।
- `any` type, `res.ok` check নেই, loading/error/empty state নেই, abort/cleanup নেই।
- Index দিয়ে key, আর clickable `div` accessible না — `button` ব্যবহার করুন।
- User data দিয়ে `dangerouslySetInnerHTML` মানে XSS — DOMPurify দিয়ে sanitize করুন বা text হিসেবে render করুন।
- `useState`/`useEffect` import নেই; এটা Server Component হতে পারত বা TanStack Query ব্যবহার করতে পারত।

---

## 8. Testing

### Q1. What types of tests are there?

- **Unit:** one function or component in isolation (utils, hooks, a `Button`). Fast, many of them.
- **Integration:** several pieces together (a form + validation + mocked API). Often the best value for frontend.
- **End-to-end (E2E):** a real browser running real user flows (login → add to cart → checkout) with **Playwright** or Cypress. Slower, fewer of them, cover critical paths.

Mention the **testing trophy** idea (Kent C. Dodds): static checks (TypeScript, ESLint) at the base, most effort on integration tests.

**বাংলায়:**

Unit test একটা function বা component আলাদাভাবে test করে — দ্রুত, সংখ্যায় বেশি। Integration test কয়েকটা অংশ একসাথে test করে, যেমন form + validation + mocked API — frontend-এ প্রায়ই এটাই সবচেয়ে বেশি value দেয়। E2E test Playwright বা Cypress দিয়ে real browser-এ login → cart → checkout-এর মতো critical flow চালায়, ধীর তাই কম লেখা হয়। Kent C. Dodds-এর testing trophy বলুন: base-এ static check (TypeScript, ESLint), সবচেয়ে বেশি effort integration test-এ।

### Q2. Jest vs Vitest?

Same API style (`describe`, `it`, `expect`, mocks). **Vitest** is built on Vite, faster, and has native ESM/TypeScript support — popular for new projects. **Jest** is the long-time standard with a large ecosystem; Next.js has an official `next/jest` setup. Switching between them is mostly changing `jest.fn()` to `vi.fn()`.

**বাংলায়:**

দুইটার API style একই — `describe`, `it`, `expect`, mock। Vitest Vite-এর ওপর বানানো, দ্রুত, আর native ESM/TypeScript support আছে, তাই নতুন project-এ জনপ্রিয়। Jest অনেক দিনের standard, বড় ecosystem, আর Next.js-এর official `next/jest` setup আছে। একটা থেকে আরেকটায় যাওয়া মূলত `jest.fn()`-কে `vi.fn()` করা।

### Q3. What is the philosophy of React Testing Library?

"The more your tests resemble the way your software is used, the more confidence they give you." Test behavior the user sees, not implementation details (no checking internal state or component methods). Query elements the way a user or screen reader would.

**Query priority:** `getByRole` (best — also verifies accessibility) → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByTestId` (last resort).

**Query variants:** `getBy` (throws if missing — for elements that should exist), `queryBy` (returns null — to assert something is *not* there), `findBy` (async — waits for elements that appear after fetching).

**বাংলায়:**

মূল কথা: test যত বেশি real ব্যবহারের মতো হবে, তত বেশি confidence দেবে। তাই user যা দেখে সেই behavior test করুন, internal state বা implementation detail না। Query priority: `getByRole` সবচেয়ে ভালো (accessibility-ও verify হয়), তারপর `getByLabelText` → `getByPlaceholderText` → `getByText`, আর শেষ উপায় `getByTestId`। `getBy` না পেলে throw করে, `queryBy` null দেয় (কিছু নেই সেটা assert করতে), `findBy` async — fetch-এর পরে আসা element-এর জন্য।

### Q4. Write a test for a Counter component.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect } from 'vitest';
// RTL auto-cleans the DOM only when afterEach is global: with globals: false, call afterEach(cleanup) in the setup file.
// toBeInTheDocument needs '@testing-library/jest-dom/vitest' in setupFiles.
import { Counter } from './Counter';

test('increments the count when the button is clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  expect(screen.getByText('Count: 0')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

Prefer `userEvent` over `fireEvent` — it simulates real interactions (focus, typing key by key, hover).

**বাংলায়:**

Test-টা `userEvent.setup()` দিয়ে শুরু হয়, `<Counter />` render করে, প্রথমে `Count: 0` আছে কিনা check করে। তারপর `getByRole('button', { name: /increment/i })` দিয়ে button খুঁজে click করে, আর `Count: 1` দেখা যাচ্ছে কিনা assert করে। `fireEvent`-এর চেয়ে `userEvent` prefer করুন, কারণ এটা focus, key-by-key typing, hover-এর মতো real interaction simulate করে।

### Q5. How do you test components that call APIs?

Mock at the network level with **MSW (Mock Service Worker)** rather than mocking `fetch` or your API module. Components run their real fetching code, and the same handlers can be reused in Storybook and development.

```tsx
server.use(
  http.get('/api/users', () => HttpResponse.json([{ id: '1', name: 'Asha' }]))
);
render(<UserList />, { wrapper: QueryProvider });
expect(await screen.findByText('Asha')).toBeInTheDocument();
```

Also test the error path by returning a 500 and asserting the error message and retry button appear. Create the test `QueryClient` with `defaultOptions: { queries: { retry: false } }`, otherwise the default 3 retries make `findBy*` time out before the error UI appears.

**বাংলায়:**

`fetch` বা API module mock না করে MSW (Mock Service Worker) দিয়ে network level-এ mock করুন। এতে component নিজের real fetching code চালায়, আর একই handler Storybook আর development-এও reuse করা যায়। Data আসার পর `findByText` দিয়ে async-ভাবে element খুঁজুন। Error path-ও test করুন: 500 return করে error message আর retry button আসছে কিনা assert করুন। Test-এর `QueryClient`-এ `retry: false` দিন, নাহলে default 3 বার retry-র কারণে `findBy` error UI আসার আগেই timeout হয়ে যাবে।

### Q6. How do you test custom hooks?

With `renderHook` from React Testing Library, wrapping state changes in `act`.

**বাংলায়:**

Custom hook test করা হয় React Testing Library-র `renderHook` দিয়ে। Hook-এর state বদলায় এমন কাজগুলো `act`-এর ভেতরে wrap করতে হয়।

### Q7. What should and shouldn't you test?

**Test:** user-visible behavior, conditional rendering, form validation, loading/error/empty states, utility functions with edge cases, critical flows with E2E. **Don't test:** library internals (that React's `useState` works), CSS details, or implementation details that change when you refactor. Code coverage is a guide, not a goal — 100% coverage with weak assertions is worse than 70% with meaningful tests.

**বাংলায়:**

Test করুন user-visible behavior, conditional rendering, form validation, loading/error/empty state, edge case সহ utility function, আর E2E দিয়ে critical flow। Test করবেন না library internals (React-এর `useState` কাজ করে কিনা), CSS detail, বা refactor করলে বদলে যায় এমন implementation detail। Code coverage একটা guide, goal না — weak assertion-ওয়ালা 100% coverage, meaningful test-ওয়ালা 70% coverage-এর চেয়েও খারাপ।

### Q8. What about snapshot tests?

Useful for small, stable output, but large snapshots get blindly updated and stop catching bugs. Prefer explicit assertions. For visual regressions, use tools like Chromatic or Playwright screenshots.

**বাংলায়:**

Snapshot test ছোট আর stable output-এর জন্য কাজের। কিন্তু বড় snapshot মানুষ না দেখেই update করে ফেলে, তখন আর bug ধরে না। তাই explicit assertion prefer করুন। Visual regression ধরতে Chromatic বা Playwright screenshot-এর মতো tool ব্যবহার করুন।

---

## 9. Git, code review & clean code

### Q1. Describe your Git workflow.

A typical answer: "I create a feature branch from `main` (e.g. `feat/user-profile`), commit small logical changes with clear messages, push and open a pull request. CI runs lint, type check, tests and a preview deploy. After review and approval, it's squash-merged into `main`, which deploys automatically." This is **GitHub Flow**; mention **Git Flow** (develop/release/hotfix branches) if the team does scheduled releases.

**বাংলায়:**

`main` থেকে feature branch (যেমন `feat/user-profile`) বানাই, ছোট logical commit করি পরিষ্কার message দিয়ে, push করে pull request খুলি। CI-তে lint, type check, test আর preview deploy চলে। Review আর approval-এর পর `main`-এ squash-merge হয়, যেটা automatically deploy হয়। এটা GitHub Flow; team scheduled release করলে Git Flow (develop/release/hotfix branch)-এর কথাও বলুন।

### Q2. `git merge` vs `git rebase`?

**Merge** combines branches with a merge commit and keeps full history. **Rebase** replays your commits on top of the target branch, giving a clean linear history. Rule: rebase your own local/feature branch to update it; never rebase a shared branch others have pulled, because it rewrites history.

**বাংলায়:**

Merge একটা merge commit দিয়ে branch মিলায় আর পুরো history রাখে। Rebase আপনার commit-গুলো target branch-এর ওপর আবার replay করে, তাই history clean আর linear হয়। Rule হলো: নিজের local/feature branch update করতে rebase করুন, কিন্তু অন্যরা pull করেছে এমন shared branch কখনো rebase করবেন না, কারণ এটা history rewrite করে।

### Q3. How do you resolve a merge conflict?

Pull the latest `main`, run the merge or rebase, open the conflicted files, understand **both** changes (talk to the other developer if unclear), keep the correct combination, remove the conflict markers, run the app and tests, then `git add` the files and `git commit` (or `git rebase --continue` if rebasing). Never just pick "accept mine" without understanding the other change.

**বাংলায়:**

Latest `main` pull করে merge বা rebase চালান, তারপর conflict হওয়া file খুলুন। **দুই দিকের** change-ই বুঝুন — পরিষ্কার না হলে অন্য developer-এর সাথে কথা বলুন। সঠিক combination রেখে conflict marker মুছুন, app আর test চালিয়ে file `git add` করে commit করুন (rebase হলে `git rebase --continue`)। অন্যের change না বুঝে শুধু "accept mine" চাপবেন না।

### Q4. Which other Git commands should you know?

- `git stash` / `git stash pop` — temporarily shelve uncommitted work.
- `git cherry-pick <sha>` — apply one commit to another branch (e.g. a hotfix).
- `git reset --soft HEAD~1` — undo the last commit but keep changes; `git revert <sha>` — undo a commit safely on a shared branch by creating a new commit.
- `git commit --amend` — fix the last commit message or add a forgotten file (before pushing).
- `git log --oneline --graph`, `git diff`, `git blame` — investigate history.
- `git bisect` — binary search for the commit that introduced a bug.

**বাংলায়:**

- `git stash` / `git stash pop` — uncommitted কাজ সাময়িকভাবে সরিয়ে রাখা; `git cherry-pick <sha>` — একটা commit অন্য branch-এ আনা, যেমন hotfix।
- `git reset --soft HEAD~1` শেষ commit undo করে কিন্তু change রাখে; shared branch-এ নিরাপদে undo করতে `git revert <sha>`, যেটা নতুন commit বানায়।
- `git commit --amend` — push করার আগে শেষ commit message ঠিক করা বা ভুলে যাওয়া file যোগ করা।
- `git log --oneline --graph`, `git diff`, `git blame` দিয়ে history দেখা, আর `git bisect` দিয়ে binary search করে bug আনা commit খোঁজা।

### Q5. What makes a good commit message and PR?

Commits: **Conventional Commits** format — `feat: add product filters`, `fix: prevent double submit on checkout`, `refactor:`, `test:`, `docs:`, `chore:`. Small, focused PRs (ideally under ~400 lines) with a description covering what changed, why, how to test, screenshots or a video for UI changes, and a linked ticket.

**বাংলায়:**

Commit-এ Conventional Commits format ব্যবহার করুন: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` — যেমন `fix: prevent double submit on checkout`। PR ছোট আর focused রাখুন, আদর্শভাবে ~400 line-এর কম। Description-এ থাকবে কী বদলেছে, কেন, কীভাবে test করবে, UI change হলে screenshot বা video, আর linked ticket।

### Q6. What do you look for when reviewing someone's code?

In priority order: correctness and edge cases → security → readability and naming → consistency with project patterns and reuse of existing components → performance → accessibility → tests. Automate style (Prettier, ESLint) so reviews focus on logic rather than formatting.

**বাংলায়:**

Priority অনুযায়ী দেখি: correctness আর edge case → security → readability আর naming → project pattern মানছে কিনা আর existing component reuse হচ্ছে কিনা → performance → accessibility → test। Style-এর কাজ Prettier আর ESLint দিয়ে automate করি, যাতে review formatting না, logic-এ focus করে।

### Q7. How do you give and receive code review feedback?

**Giving:** be specific and kind, explain *why*, ask questions instead of commanding ("What happens if `items` is empty here?"), label minor points as `nit:`, and praise good solutions. **Receiving:** don't take it personally, ask for clarification, push back respectfully with reasoning when you disagree, and thank the reviewer. Interviewers want someone who is easy to work with.

**বাংলায়:**

Feedback দেওয়ার সময় specific আর ভদ্র থাকুন, *কেন* সেটা explain করুন, হুকুম না দিয়ে প্রশ্ন করুন ("`items` empty হলে এখানে কী হবে?"), ছোট বিষয়ে `nit:` লিখুন, আর ভালো solution-এর প্রশংসা করুন। Feedback নেওয়ার সময় personally নেবেন না, clarification চান, দ্বিমত থাকলে যুক্তি দিয়ে সম্মানের সাথে বলুন, আর reviewer-কে ধন্যবাদ দিন। Interviewer দেখতে চায় আপনার সাথে কাজ করা সহজ কিনা।

### Q8. What does "clean, maintainable, testable code" mean to you?

- **Readable names** — `isLoading`, `fetchUserOrders`, not `flag`, `doStuff`.
- **Small, single-purpose functions and components** — if a component is 400 lines, split it.
- **Separation of concerns** — UI components separate from data fetching and business logic (custom hooks, service layer), which also makes them easy to test.
- **DRY, but not too early** — extract on the second or third repetition, not the first.
- **Strong types**, no magic numbers (named constants), early returns instead of deep nesting.
- **Consistent folder structure** — e.g. feature-based: `features/cart/{components,hooks,api}`.
- **Tooling** — ESLint, Prettier, TypeScript strict mode, Husky + lint-staged to run checks before commit.

**বাংলায়:**

- পরিষ্কার নাম (`isLoading`, `fetchUserOrders`; `flag` বা `doStuff` না), আর ছোট single-purpose function/component — 400 line-এর component হলে ভাগ করুন।
- Separation of concerns: UI আলাদা, data fetching আর business logic custom hook বা service layer-এ — এতে test করাও সহজ।
- DRY, কিন্তু তাড়াহুড়ো করে না — দ্বিতীয় বা তৃতীয় repetition-এ extract করুন।
- Strong type, magic number-এর বদলে named constant, deep nesting-এর বদলে early return, আর feature-based folder structure।
- Tooling: ESLint, Prettier, TypeScript strict mode, আর commit-এর আগে check চালাতে Husky + lint-staged।

### Q9. What principles do you follow? (SOLID, KISS, YAGNI)

**KISS** — keep it simple. **YAGNI** — don't build features or abstractions you don't need yet. **Single Responsibility** — each component/hook does one thing. **Composition over inheritance** — React's model. Briefly connecting these to your component design is enough.

**বাংলায়:**

KISS মানে জিনিস simple রাখা। YAGNI মানে এখন দরকার নেই এমন feature বা abstraction বানাবেন না। Single Responsibility মানে প্রতিটা component/hook একটাই কাজ করবে। Composition over inheritance — এটাই React-এর model। এগুলোকে নিজের component design-এর সাথে সংক্ষেপে connect করে বললেই যথেষ্ট।

---

## 10. Docker, CI/CD, cloud & Node

### Q1. What is Docker and why use it for a frontend app?

Docker packages an app with its runtime and dependencies into an **image** that runs the same everywhere as a **container**. It removes "works on my machine" problems and makes deploying to any cloud consistent. An image is the blueprint; a container is a running instance.

**বাংলায়:**

Docker একটা app-কে তার runtime আর dependency সহ একটা **image**-এ package করে, যেটা যেকোনো জায়গায় **container** হিসেবে একইভাবে চলে। এতে "আমার machine-এ তো চলে" টাইপের problem থাকে না, আর যেকোনো cloud-এ deploy consistent হয়। Image হলো blueprint, আর container হলো সেই image-এর একটা running instance।

### Q2. What does a Dockerfile for Next.js look like?

A **multi-stage build** keeps the final image small:

```dockerfile
FROM node:24-alpine AS deps
# some native packages need glibc compatibility on alpine (optional)
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

This requires `output: 'standalone'` in `next.config`. `HOSTNAME=0.0.0.0` makes the server listen on all interfaces so it's reachable from outside the container, and `USER node` (a user the official Node images already include) avoids running as root. Use Node 24 — Node 20 reached end of life in April 2026. Also use a `.dockerignore` (exclude `node_modules`, `.next`, `.env`). Docker Compose runs multiple services together locally (frontend + API + database).

**বাংলায়:**

- **Multi-stage build** ব্যবহার করা হয়: `deps` stage-এ `npm ci`, `builder` stage-এ `npm run build`, আর শেষ `runner` stage-এ শুধু দরকারি file copy হয় — তাই final image ছোট থাকে।
- এর জন্য `next.config`-এ `output: 'standalone'` লাগবে।
- `HOSTNAME=0.0.0.0` দিলে server সব interface-এ listen করে, তাই container-এর বাইরে থেকে reach করা যায়। `USER node` দিলে root হিসেবে চলে না।
- Node 24 ব্যবহার করুন, কারণ Node 20 April 2026-এ end of life হয়ে গেছে। `.dockerignore`-এ `node_modules`, `.next`, `.env` বাদ দিন।
- Local-এ frontend + API + database একসাথে চালাতে Docker Compose ব্যবহার করা হয়।

### Q3. What is CI/CD? Describe a pipeline you'd set up.

**CI (Continuous Integration):** every PR and every push to `main` automatically installs, lints, type-checks, tests and builds. **CD (Continuous Delivery/Deployment):** passing code is automatically deployed to staging or production.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test # Vitest and Jest both run once (no watch) when CI=true
      - run: npm run build
```

Vercel or Netlify add automatic **preview deployments** per PR — great for designer and QA review.

**বাংলায়:**

**CI** মানে প্রতিটা PR আর `main`-এ প্রতিটা push-এ automatically install, lint, type-check, test আর build চলে। **CD** মানে pass করা code automatically staging বা production-এ deploy হয়। উদাহরণের GitHub Actions workflow-এ `npm ci`, lint, `tsc --noEmit`, test আর build — এই step-গুলো আছে। Vercel বা Netlify প্রতিটা PR-এর জন্য **preview deployment** দেয়, যেটা designer আর QA review-এর জন্য খুব কাজের।

### Q4. Which cloud platforms/hosting have you used?

Common answers: **Vercel** (made by the Next.js team; zero-config, edge network, preview URLs), **Netlify**, **AWS** (Amplify, S3 + CloudFront for static sites, ECS/EC2 for Docker containers, Lambda), **GCP Cloud Run** or **Azure**. Know the basic idea of a **CDN** (caches assets on servers close to users) and **environment variables per environment** (dev/staging/prod).

**বাংলায়:**

Common উত্তর হলো Vercel (Next.js team-এর বানানো, zero-config, edge network, preview URL), Netlify, AWS (Amplify, static site-এর জন্য S3 + CloudFront, Docker container-এর জন্য ECS/EC2, Lambda), GCP Cloud Run বা Azure। এর সাথে **CDN**-এর basic idea জানা দরকার — user-এর কাছাকাছি server-এ asset cache করে রাখে। আর dev/staging/prod প্রতিটা environment-এর জন্য আলাদা environment variable রাখার ব্যাপারটাও জানতে হবে।

### Q5. What Node.js knowledge is relevant for a frontend developer?

- npm/pnpm/yarn, `package.json` scripts, semantic versioning (`^1.2.3` allows minor updates), lockfiles and why `npm ci` is used in CI.
- Node is the runtime for Next.js server code, route handlers and build tools.
- Building simple REST APIs with **Express** or Next.js route handlers: routes, middleware, JSON parsing, error handling.
- Async I/O and the event loop. The core idea is like the browser (call stack, then microtasks, then macrotasks), but Node's loop runs in phases (timers → poll → check) and adds `setImmediate` and `process.nextTick`; the nextTick queue runs even before promise microtasks.
- Environment variables via `process.env`.

```typescript
// app/api/users/route.ts — a Next.js route handler
export async function GET() {
  const users = await db.user.findMany();
  return Response.json(users);
}
```

**বাংলায়:**

- npm/pnpm/yarn, `package.json` script, semantic versioning (`^1.2.3` মানে minor update allow করে), lockfile আর CI-তে কেন `npm ci` ব্যবহার হয় — এগুলো জানা দরকার।
- Next.js-এর server code, route handler আর build tool সব Node runtime-এ চলে।
- Express বা Next.js route handler দিয়ে simple REST API বানাতে পারা উচিত: route, middleware, JSON parsing, error handling।
- Event loop-এর মূল idea browser-এর মতো (call stack, তারপর microtask, তারপর macrotask), কিন্তু Node-এর loop phase-এ চলে (timers → poll → check), আর এতে `setImmediate` ও `process.nextTick` আছে — nextTick queue promise microtask-এরও আগে চলে। Environment variable পড়া হয় `process.env` দিয়ে।

### Q6. What is the difference between edge and Node.js runtime in Next.js?

The **Node.js runtime** supports all Node APIs and is the default. The **Edge runtime** runs on lightweight servers close to users with faster cold starts but a limited API (no file system, many Node packages unsupported). It used to be the only option for middleware, but in Next.js 16 `middleware.ts` was renamed to **`proxy.ts`** and runs on the Node.js runtime, so Edge is now a niche choice for a few simple, latency-sensitive responses.

**বাংলায়:**

**Node.js runtime** default, আর এটা সব Node API support করে। **Edge runtime** user-এর কাছাকাছি lightweight server-এ চলে, cold start দ্রুত, কিন্তু API limited — file system নেই, অনেক Node package চলে না। আগে middleware-এর জন্য এটাই একমাত্র option ছিল, কিন্তু Next.js 16-এ `middleware.ts` rename হয়ে **`proxy.ts`** হয়েছে আর এটা Node.js runtime-এ চলে। তাই এখন Edge শুধু কিছু simple, latency-sensitive response-এর জন্য niche choice।

---

## 11. Behavioral (STAR)

### Q1. Tell me about a challenging bug you solved.

Use STAR: Situation, Task, Action (most of the answer), Result (with a number). Sample:

> **S:** Users on iPhones reported the checkout button sometimes did nothing. **T:** I owned the checkout UI. **A:** I couldn't reproduce on desktop, so I used Safari remote debugging on a real device and found a hydration mismatch caused by formatting a date with the device locale during render. React threw away the server HTML and re-rendered on the client, and taps during that slow re-render on older iPhones were lost. I moved the formatting into a client-only effect, added a test, and documented the pattern for the team. **R:** The issue disappeared and checkout completion on iOS rose about 6% the following week.

**বাংলায়:**

STAR মানে Situation, Task, Action (উত্তরের বেশিরভাগ অংশ এখানে), আর Result (একটা number সহ)। আমি এভাবে বলব:

**S:** iPhone user-রা report করছিল যে checkout button মাঝে মাঝে কিছুই করে না। **T:** Checkout UI-এর দায়িত্ব আমার ছিল। **A:** Desktop-এ আমি reproduce করতে পারছিলাম না, তাই real device-এ Safari remote debugging দিয়ে দেখলাম। দেখা গেল render-এর সময় device locale দিয়ে date format করার কারণে একটা hydration mismatch হচ্ছিল, আর সেই mismatch-এর কারণে React server HTML বাদ দিয়ে client-এ আবার render করছিল, আর পুরনো iPhone-এ সেই সময়ের tap-গুলো হারিয়ে যাচ্ছিল। আমি formatting-টা একটা client-only effect-এ সরিয়ে নিলাম, একটা test যোগ করলাম, আর team-এর জন্য pattern-টা document করলাম। **R:** Issue-টা চলে গেল, আর পরের সপ্তাহে iOS-এ checkout completion প্রায় 6% বেড়ে গেল।

### Q2. Tell me about a time you disagreed with a designer or backend developer.

> **S:** A designer wanted a data table with 9 columns on mobile. **T:** I needed to ship a usable mobile view. **A:** I built a quick prototype showing horizontal scrolling was awkward, then proposed a stacked card layout with the 3 key fields visible and a details expand. I showed both on a preview URL instead of arguing in abstract. **R:** The designer agreed, updated the Figma, and we used that pattern for other tables too.

Key message: disagree with evidence, stay respectful, focus on the user.

**বাংলায়:**

**S:** একজন designer mobile-এ 9 column-এর একটা data table চাইছিলেন। **T:** আমার কাজ ছিল একটা usable mobile view ship করা। **A:** আমি দ্রুত একটা prototype বানিয়ে দেখালাম যে horizontal scrolling-টা বেশ awkward। তারপর একটা stacked card layout propose করলাম, যেখানে 3টা key field দেখা যায় আর details expand করা যায়। Abstract-ভাবে তর্ক না করে আমি দুটো version-ই একটা preview URL-এ দেখালাম। **R:** Designer রাজি হলেন, Figma update করলেন, আর পরে অন্য table-গুলোতেও আমরা এই pattern ব্যবহার করেছি।

মূল কথা হলো: evidence দিয়ে disagree করুন, respectful থাকুন, আর user-এর দিকে focus রাখুন।

### Q3. How do you work with backend developers when the API isn't ready?

Agree on the API contract early (OpenAPI/Swagger spec or shared TypeScript types), build the UI against **mock data with MSW**, and switch to the real endpoint when it's ready. Raise contract issues early (missing fields, pagination format, error shapes) rather than working around them in the frontend.

**বাংলায়:**

আমি শুরুতেই backend-এর সাথে API contract ঠিক করে নিই — OpenAPI/Swagger spec বা shared TypeScript type দিয়ে। তারপর **MSW দিয়ে mock data**-র উপর UI বানাই, আর real endpoint ready হলে সেটাতে switch করি। Contract-এ কোনো issue থাকলে, যেমন missing field, pagination format বা error shape — সেটা আমি আগেভাগেই raise করি, চুপচাপ frontend-এ workaround দিয়ে চালিয়ে দিই না।

### Q4. How do you work with QA?

Write clear PR descriptions with test steps, share preview deployments, reproduce reported bugs before fixing, add a regression test for each bug fixed, and treat QA as partners. Ask them about edge cases early during development, not just at the end.

**বাংলায়:**

আমি PR description-এ পরিষ্কার test step লিখি, preview deployment share করি, আর কোনো bug fix করার আগে নিজে reproduce করে নিই। প্রতিটা fix করা bug-এর জন্য একটা regression test যোগ করি। QA-কে আমি partner হিসেবে দেখি। Development চলার সময়েই তাদের কাছে edge case জিজ্ঞেস করি, শুধু শেষে গিয়ে না।

### Q5. Tell me about a time you missed a deadline or a task took longer than expected.

Show ownership: you noticed early, communicated to the lead/PM with a revised estimate and options (cut scope, ship in phases), and learned something (e.g. "now I break tasks into smaller pieces and flag risk at standup"). Never blame others.

**বাংলায়:**

এখানে ownership দেখাতে হবে। যেমন বলব: আমি আগেভাগেই বুঝতে পেরেছিলাম যে task-টা সময়মতো শেষ হবে না, তাই lead/PM-কে একটা revised estimate দিলাম, সাথে কিছু option — scope কমানো বা phase-এ ship করা। আর এখান থেকে আমি শিখেছি, এখন আমি task-গুলো ছোট ছোট ভাগে ভাগ করি আর standup-এ risk থাকলে আগেই flag করি। আর মনে রাখবেন, কখনো অন্য কাউকে blame করবেন না।

### Q6. Tell me about a project you're proud of.

Pick one that hits the JD: Next.js + TypeScript, reusable components, API integration, measurable performance or business results. Explain the problem, your architecture choices and **why**, a challenge, and the result. Prepare to go deep — interviewers often ask follow-ups on folder structure, state management choices and what you'd do differently.

**বাংলায়:**

এমন একটা project বেছে নিন যেটা JD-এর সাথে মেলে: Next.js + TypeScript, reusable component, API integration, আর measurable performance বা business result। বলুন problem-টা কী ছিল, কোন architecture choice নিয়েছেন আর **কেন** নিয়েছেন, কোন challenge এসেছিল, আর result কী হলো। গভীরে যাওয়ার জন্য প্রস্তুত থাকুন — interviewer প্রায়ই folder structure, state management choice আর এখন হলে কী অন্যভাবে করতেন, এসব নিয়ে follow-up করেন।

### Q7. How do you keep up with frontend changes?

Name specific sources: official React and Next.js blogs/docs, release notes, newsletters (e.g. *This Week in React*, *JavaScript Weekly*), YouTube or podcasts you actually follow, and side projects where you try new features (React 19, Tailwind v4, Server Actions). Mention you also experiment with new AI coding tools.

**বাংলায়:**

আমি নির্দিষ্ট source-এর নাম বলি: official React আর Next.js blog/docs, release notes, newsletter যেমন *This Week in React* আর *JavaScript Weekly*, আর যে YouTube channel বা podcast আমি আসলেই follow করি। এছাড়া side project-এ নতুন feature try করি, যেমন React 19, Tailwind v4, Server Actions। আর নতুন AI coding tool নিয়েও আমি experiment করি।

### Q8. How do you handle unclear requirements?

Ask clarifying questions early, write down assumptions and confirm them with the PM, build a small version first, and get feedback quickly. A wrong assumption caught on day one costs much less than on the last day.

**বাংলায়:**

আমি শুরুতেই clarifying প্রশ্ন করি, আমার assumption-গুলো লিখে PM-এর সাথে confirm করে নিই। তারপর আগে একটা ছোট version বানাই আর দ্রুত feedback নিই। কারণ প্রথম দিনে একটা ভুল assumption ধরা পড়লে খরচ অনেক কম, শেষ দিনে ধরা পড়লে অনেক বেশি।

### Q9. Why do you want this role / this company?

Research the company's product beforehand. Connect three things: their product or mission, the tech stack (React/Next.js/TypeScript — your strength), and their emphasis on AI-assisted development (you already work this way and want a team that embraces it).

**বাংলায়:**

আগে থেকেই company-র product নিয়ে research করে যান। তারপর তিনটা জিনিস connect করে বলুন: তাদের product বা mission, তাদের tech stack (React/Next.js/TypeScript — যেটা আপনার strength), আর AI-assisted development-এ তাদের জোর — আপনি already এভাবে কাজ করেন, আর এমন একটা team চান যারা এটা embrace করে।

### Q10. What is your biggest weakness?

Pick a real, non-critical one with active improvement. Example: "I used to over-polish UI details before getting feedback. Now I share a preview early, get input from design and product, and polish afterwards — it's made me faster and reduced rework."

**বাংলায়:**

একটা real কিন্তু non-critical weakness বলুন, সাথে দেখান যে আপনি সেটা নিয়ে কাজ করছেন। যেমন: "আগে আমি feedback নেওয়ার আগেই UI detail অনেক বেশি polish করতাম। এখন আমি আগেভাগে একটা preview share করি, design আর product থেকে input নিই, তারপর polish করি — এতে আমি আরো fast হয়েছি আর rework কমেছে।"

### Q11. Tell me about a recent problem you faced and how you solved it (real-time chess clock).

Use STAR, and keep the Action technical. Sample from a real-time chess game:

> **S:** I was building a real-time online chess game where each player has a countdown clock (for example 10 minutes each). Players reported that the clocks didn't agree: the same game showed different time left on Windows, Linux and iPhone, and the gap grew as the game went on. **T:** I owned the game UI, so I had to make the clock accurate and the same on every device. **A:** My first version used `setInterval` and subtracted 1000 ms on every tick. I learned that `setInterval` only promises a *minimum* delay: a tick fires late when the main thread is busy, when the OS or browser groups timers together to save power, and in background tabs, where browsers slow timers to once a second or less and iOS can pause them completely. Because every tick subtracted a fixed second, each late tick added drift, and every OS and power mode drifted differently. I rewrote the clock with `requestAnimationFrame`: I stored the moment the turn started (`performance.now()`) and the time left at that moment, and on every frame I computed the time left from those two numbers instead of counting ticks. The frame loop repaints in step with the screen, so the display is smooth and never stale, and it only runs for the player whose turn it is. **R:** Both clocks showed the same time on Windows, Linux and iOS, drift no longer built up in long games, and the complaints stopped.

```ts
// Runs the clock of the player whose turn it is.
// Time left comes from timestamps, so a late frame or a paused tab never adds drift.
function runClock(msLeftAtTurnStart: number, onFrame: (msLeft: number) => void, onFlag: () => void) {
  const turnStart = performance.now(); // monotonic: not affected by system clock changes
  let id = 0;
  const tick = () => {
    const msLeft = Math.max(0, msLeftAtTurnStart - (performance.now() - turnStart));
    onFrame(msLeft); // update the UI only when the shown value changes
    if (msLeft === 0) onFlag();
    else id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id); // call it when the move is made, or on unmount
}
```

**Follow-ups to expect:**

- **"Why did `requestAnimationFrame` fix it?"** Be precise: rAF alone doesn't — computing the time from timestamps does. rAF only repaints in step with the screen. Never count frames either: the frame rate can be 60, 90 or 120 Hz, and iOS drops it to 30 in Low Power Mode.
- **"What happens in a background tab?"** rAF pauses while the tab is hidden. That's fine for the display, because the first frame after the tab comes back computes the correct time. But the client must not decide that time ran out: the server should store each move's timestamp and both players' remaining time, send them with every move, and decide when a player loses on time. The client clock is only a display that re-syncs on every move.
- **"Why `performance.now()` and not `Date.now()`?"** `performance.now()` is monotonic; `Date.now()` jumps if the user or the OS changes the system clock.
- **"Isn't setState 60 times a second slow?"** Only set state when the shown value changes (whole seconds, or tenths in the last 10 seconds), or write to the DOM node through a ref.
- **"Would `setInterval` with timestamps also work?"** Yes, for accuracy. rAF is smoother when you show tenths of a second, and it does no work while the tab is hidden.

**Make it yours:** use your real details — the time control, how far apart the clocks were (e.g. how many seconds after a 10-minute game) and what the server sends on each move. Only claim what you actually built.

**বাংলায়:**

STAR-এ বলুন, আর Action অংশটা technical রাখুন:

**S:** আমি একটা real-time online chess game বানাচ্ছিলাম, যেখানে প্রত্যেক player-এর একটা countdown clock আছে (যেমন দুজনের 10 মিনিট করে)। Player-রা report করল যে clock মিলছে না — একই game Windows, Linux আর iPhone-এ আলাদা সময় দেখাচ্ছে, আর game যত এগোয় পার্থক্য তত বাড়ে। **T:** Game UI আমার দায়িত্বে ছিল, তাই clock-কে সঠিক আর সব device-এ একই রকম করতে হতো। **A:** প্রথম version-এ আমি `setInterval` দিয়ে প্রতি tick-এ 1000 ms কমাতাম। পরে বুঝলাম `setInterval` শুধু *সর্বনিম্ন* delay-এর promise দেয়: main thread busy থাকলে, power বাঁচাতে OS বা browser timer একসাথে group করলে, আর background tab-এ tick দেরিতে আসে — সেখানে timer সেকেন্ডে একবার বা তারও কম চলে, আর iOS পুরোপুরি থামিয়েও দিতে পারে। প্রতি tick-এ নির্দিষ্ট 1 সেকেন্ড কমানোয় প্রতিটা দেরি drift হিসেবে জমছিল, আর প্রতিটা OS আর power mode আলাদাভাবে drift করছিল। তাই আমি `requestAnimationFrame` দিয়ে clock নতুন করে লিখলাম: turn শুরুর মুহূর্ত (`performance.now()`) আর সেই মুহূর্তে বাকি সময় store করলাম, আর প্রতি frame-এ tick না গুনে এই দুটো থেকে বাকি সময় হিসাব করলাম। Frame loop screen-এর repaint-এর সাথে মিলে চলে, তাই display smooth থাকে আর কখনো পুরনো value দেখায় না, আর এটা শুধু যার turn তার clock-এর জন্য চলে। **R:** Windows, Linux আর iOS-এ দুটো clock একই সময় দেখাল, লম্বা game-এও drift জমল না, আর complaint বন্ধ হলো।

Follow-up-এর জন্য মনে রাখুন: rAF একা সমস্যার সমাধান করে না — timestamp থেকে সময় হিসাব করাটাই আসল fix, rAF শুধু screen-এর সাথে মিলিয়ে repaint করে। Frame-ও গুনবেন না, কারণ frame rate 60, 90 বা 120 Hz হতে পারে, আর iOS Low Power Mode-এ 30-এ নেমে যায়। Background tab-এ rAF থেমে যায়, ফিরে এলে প্রথম frame-এই সঠিক সময় দেখায় — কিন্তু সময় শেষ হয়েছে কিনা সেটা client ঠিক করবে না; server প্রতিটা move-এর timestamp আর দুজনের বাকি সময় রাখবে, প্রতি move-এ পাঠাবে, আর time-out ঠিক করবে। `Date.now()` system clock বদলালে লাফ দেয়, `performance.now()` monotonic। প্রতি frame-এ setState না করে শুধু দেখানো value বদলালে update করুন, বা ref দিয়ে সরাসরি DOM-এ লিখুন। নিজের আসল detail দিয়ে বলুন (time control, clock কতটা আলাদা ছিল, server প্রতি move-এ কী পাঠায়) — যা নিজে বানিয়েছেন শুধু সেটাই claim করুন।

### Q12. Tell me about a complex feature you built (an Excel-style sheet in the browser with FortuneSheet).

Sample STAR answer:

> **S:** Our users worked with data in Excel files — they downloaded them, edited them and uploaded them again, which was slow and caused "which version is the latest?" problems. The product needed an Excel-style sheet inside the web app: formulas, cell formatting, merged cells, multiple sheets and frozen header rows. **T:** I had to choose a library and build the feature in our React/Next.js app. **A:** I compared the options and chose **FortuneSheet** (`@fortune-sheet/react`) — MIT-licensed, React + TypeScript, with an Excel-like UI. Then I solved the integration problems: it can't render on the server, it needs a sized container, `.xlsx` files have to be converted to its JSON format, and saving on every keystroke was too much. **R:** Users edit sheets directly in the browser instead of passing files around, the server keeps one saved version, and they can still download an `.xlsx` when they need one.

**Why FortuneSheet — say the trade-off:**

- Data grids such as AG Grid or TanStack Table are built for lists of records, not free-form sheets with formulas and formatting.
- Handsontable needs a paid license for commercial use.
- Luckysheet, which FortuneSheet is based on, is no longer maintained (its team moved on to Univer, which is more powerful but much heavier).
- SheetJS only reads and writes files — it has no editing UI.

**Technical details to explain:**

- **Client-only:** FortuneSheet uses `window` and draws the grid on a canvas, so it fails during SSR. Load it with `dynamic(..., { ssr: false })` from a Client Component, only on the sheet page — this also keeps its large bundle off every other page.
- **Sized container:** the workbook fills its parent, so the parent needs an explicit height, otherwise nothing shows.
- **Data format:** FortuneSheet keeps each sheet as JSON (`name`, `celldata` cells like `{ r, c, v }`, merges, column widths). Convert uploaded `.xlsx` files with an import/export package such as FortuneExcel (`@corbe30/fortune-excel`), store the sheet JSON on the backend, and export back to `.xlsx` for downloads. Test with real files early — styles, merged cells and formulas are where conversions lose detail.
- **Saving:** `onChange` fires on every edit, so debounce the save (about 1 s), show "Saving… / Saved", and flush pending changes on unmount and `pagehide`.
- **Trust:** the browser calculates formulas for display, but totals the business relies on are recalculated or validated on the server.

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import type { Sheet } from '@fortune-sheet/core';
import '@fortune-sheet/react/dist/index.css';

// FortuneSheet uses window and canvas, so it must never render on the server
const Workbook = dynamic(() => import('@fortune-sheet/react').then((m) => m.Workbook), {
  ssr: false,
  loading: () => <div className="h-[70vh] w-full animate-pulse bg-gray-100" />,
});

// onSave should be stable (useCallback in the parent), or the debounce resets
export function SheetEditor({ initial, onSave }: { initial: Sheet[]; onSave: (sheets: Sheet[]) => void }) {
  const save = useMemo(() => debounce(onSave, 1000), [onSave]);
  useEffect(() => () => save.flush(), [save]); // don't lose the last edit on unmount
  return (
    <div className="h-[70vh] w-full">
      <Workbook data={initial} onChange={save} />
    </div>
  );
}
```

**Follow-ups to expect:**

- **"Why not build it yourself?"** A spreadsheet engine — formula parser, cell dependencies, selection, copy-paste from Excel, undo — is months of work. A library plus solid integration was the right call. Know the risk: FortuneSheet is a smaller open-source project, so pin the version and keep it behind your own `SheetEditor` component so it can be swapped later.
- **"Could several people edit at once?"** FortuneSheet reports each change as an operation (`onOp`) and can apply remote ones (`applyOp`), so you can sync operations over a WebSocket. For heavy simultaneous editing you'd add conflict handling (OT or CRDT) on the server.
- **"Any security concerns?"** Cell values are user input: never inject them as HTML elsewhere in the app, and validate values and formulas on the server.

**Make it yours:** say what the sheet was for, which Excel features users needed, how big the files were, and what you actually did for import, export and saving.

**বাংলায়:**

**S:** আমাদের user-রা Excel file-এ data নিয়ে কাজ করত — download করত, edit করত, আবার upload করত; এটা ধীর ছিল আর "কোনটা latest version?" নিয়ে ঝামেলা হতো। Product-এর দরকার ছিল web app-এর ভেতরেই Excel-এর মতো sheet: formula, cell formatting, merged cell, একাধিক sheet আর freeze করা header row। **T:** একটা library বেছে নিয়ে আমাদের React/Next.js app-এ feature-টা বানানো ছিল আমার কাজ। **A:** Option-গুলো তুলনা করে আমি **FortuneSheet** (`@fortune-sheet/react`) বেছে নিলাম — MIT license, React + TypeScript, Excel-এর মতো UI। তারপর integration-এর সমস্যাগুলো সমাধান করলাম: এটা server-এ render হয় না, এর জন্য নির্দিষ্ট size-এর container লাগে, `.xlsx` file-কে এর JSON format-এ convert করতে হয়, আর প্রতি keystroke-এ save করা অতিরিক্ত ছিল। **R:** User-রা file আদান-প্রদান না করে সরাসরি browser-এ sheet edit করে, server-এ একটাই saved version থাকে, আর দরকার হলে এখনো `.xlsx` download করা যায়।

কেন FortuneSheet: AG Grid বা TanStack Table-এর মতো data grid record-এর list-এর জন্য, formula-সহ free-form sheet-এর জন্য না; Handsontable commercial কাজে paid license চায়; Luckysheet (যার উপর FortuneSheet তৈরি) আর maintain হয় না; আর SheetJS শুধু file পড়ে-লেখে, এর কোনো editing UI নেই।

Technical detail: FortuneSheet `window` আর canvas ব্যবহার করে, তাই SSR-এ ভাঙে — Client Component থেকে শুধু sheet page-এ `dynamic(..., { ssr: false })` দিয়ে load করুন, এতে বড় bundle অন্য page-এ যায় না। Parent container-এর নির্দিষ্ট height না দিলে কিছুই দেখায় না। Data প্রতি sheet-এ JSON (`celldata`-তে `{ r, c, v }` cell) — upload করা `.xlsx` FortuneExcel-এর মতো package দিয়ে convert করে backend-এ JSON রাখুন, download-এর সময় আবার `.xlsx`-এ export করুন, আর শুরুতেই real file দিয়ে test করুন, কারণ style, merged cell আর formula-তেই conversion-এ detail হারায়। `onChange` প্রতি edit-এ fire হয়, তাই save debounce করুন (~1 সেকেন্ড), "Saving… / Saved" দেখান, আর unmount ও `pagehide`-এ বাকি change flush করুন। Business যে total-এর উপর নির্ভর করে, সেটা server-এ আবার হিসাব বা validate করুন।

Follow-up: নিজে না বানানোর কারণ — formula parser, cell dependency, selection, Excel থেকে copy-paste আর undo মিলিয়ে spreadsheet engine বানাতে কয়েক মাস লাগে; তবে FortuneSheet ছোট open-source project, তাই version pin করে নিজের `SheetEditor` component-এর পেছনে রাখুন, যাতে পরে বদলানো যায়। একসাথে কয়েকজন edit করতে চাইলে `onOp` দিয়ে change operation পাঠিয়ে `applyOp` দিয়ে অন্যদের change apply করা যায়, WebSocket-এর মাধ্যমে; বেশি conflict হলে server-এ OT বা CRDT লাগবে। Cell value user input, তাই কোথাও HTML হিসেবে inject করবেন না, আর server-এ validate করুন। নিজের আসল detail দিয়ে বলুন — sheet কী কাজে লাগত, কোন Excel feature লাগত, file কত বড় ছিল, আর import, export ও save-এর জন্য আসলে কী করেছিলেন।

---

## 12. Tricky & trap questions

### T1. What does this print?

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
```

**Answer:** `3, 3, 3`. `var` is function-scoped, so all three callbacks share one `i`. By the time the timeouts run, the loop has finished and `i` is 3. Change `var` to `let` and it prints `0, 1, 2`, because `let` creates a new binding for each loop iteration.

**বাংলায়:**

Output হবে `3, 3, 3`। `var` function-scoped, তাই তিনটা callback একই `i` share করে, আর timeout চলার সময় loop শেষ হয়ে `i` 3 হয়ে গেছে। `var`-এর বদলে `let` দিলে প্রতিটা iteration-এ নতুন binding তৈরি হয়, তখন print হবে `0, 1, 2`।

### T2. What does this print?

```javascript
async function run() {
  console.log(1);
  await null;
  console.log(2);
}
console.log(3);
run();
console.log(4);
```

**Answer:** `3, 1, 4, 2`. An async function runs synchronously until the first `await`. Everything after `await` is scheduled as a microtask, which runs only after the current synchronous code (`console.log(4)`) finishes.

**বাংলায়:**

Output হবে `3, 1, 4, 2`। Async function প্রথম `await` পর্যন্ত synchronously চলে। `await`-এর পরের সব কিছু microtask হিসেবে schedule হয়, যেটা current synchronous code (`console.log(4)`) শেষ হওয়ার পরেই চলে।

### T3. What are these values?

```javascript
typeof null;        // ?
typeof NaN;         // ?
NaN === NaN;        // ?
0.1 + 0.2 === 0.3;  // ?
```

**Answer:** `"object"` (a famous historical bug in JavaScript), `"number"`, `false` (NaN is the only value not equal to itself — use `Number.isNaN()`), and `false` (floating-point rounding gives `0.30000000000000004`). For money, store integers like cents. For other floats, compare with a tolerance — `Number.EPSILON` alone only works for values near 1, so use a relative one: `Math.abs(a - b) <= Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))`.

**বাংলায়:**

- `typeof null` হলো `"object"` — এটা JavaScript-এর একটা বিখ্যাত পুরনো bug।
- `typeof NaN` হলো `"number"`।
- `NaN === NaN` হলো `false` — NaN একমাত্র value যেটা নিজের সমান না, তাই `Number.isNaN()` ব্যবহার করুন।
- `0.1 + 0.2 === 0.3` হলো `false`, কারণ floating-point rounding-এ `0.30000000000000004` আসে।
- টাকার জন্য cents-এর মতো integer রাখুন। অন্য float compare করতে relative tolerance দিন, কারণ শুধু `Number.EPSILON` 1-এর কাছাকাছি value-তেই কাজ করে।

### T4. What are these results?

```javascript
'5' + 3;    // ?
'5' - 3;    // ?
true + 1;   // ?
[] + [];    // ?
[] + {};    // ?
```

**Answer:** `"53"` (`+` with a string concatenates), `2` (`-` converts to numbers), `2` (true becomes 1), `""` (arrays become empty strings), `"[object Object]"`. The lesson: implicit type coercion is surprising, which is why we use `===` and TypeScript.

**বাংলায়:**

Result হলো: `'5' + 3` = `"53"` (string থাকলে `+` concatenate করে), `'5' - 3` = `2` (`-` number-এ convert করে), `true + 1` = `2` (true হয় 1), `[] + []` = `""` (array empty string হয়ে যায়), আর `[] + {}` = `"[object Object]"`। শিক্ষা হলো implicit type coercion অনেক surprising, তাই আমরা `===` আর TypeScript ব্যবহার করি।

### T5. What does this print?

```javascript
const user = {
  name: 'Asha',
  regular() { return this.name; },
  arrow: () => this?.name,
};
console.log(user.regular());
console.log(user.arrow());
const fn = user.regular;
console.log(fn());
```

**Answer:** It depends on where the code runs:

- **ES module** (all bundled React/Next code — strict mode, top-level `this` is `undefined`): `'Asha'`, then `undefined` (the `?.` stops it throwing), then a **TypeError** — `fn()` has no object, so `this` is `undefined` and `this.name` throws.
- **Classic browser script** (sloppy mode, top-level `this` is `window`): `'Asha'`, then `''`, then `''` — both read `window.name`, which defaults to an empty string.

A regular method gets `this` from the object it's called on. The arrow function takes `this` from the outer scope, not the object. Pulling the method out into `fn` loses the object, so `this` is lost — this is why you bind handlers or use arrow functions in callbacks.

**বাংলায়:**

- Output নির্ভর করে code কোথায় চলছে তার উপর।
- **ES module**-এ (সব bundled React/Next code, strict mode, top-level `this` হলো `undefined`): `'Asha'`, তারপর `undefined` (`?.` থাকায় throw করে না), তারপর একটা **TypeError** — কারণ `fn()`-এর কোনো object নেই, `this` হলো `undefined`, তাই `this.name` throw করে।
- **Classic browser script**-এ (sloppy mode, top-level `this` হলো `window`): `'Asha'`, তারপর `''`, তারপর `''` — দুটোই `window.name` পড়ে, যার default empty string।
- Regular method `this` পায় যে object-এর উপর call হয় সেখান থেকে, arrow function নেয় outer scope থেকে। Method-টা `fn`-এ বের করে নিলে object হারিয়ে যায়, তাই callback-এ handler bind করা হয় বা arrow function ব্যবহার করা হয়।

### T6. What happens here?

```javascript
console.log(a);
var a = 1;

console.log(b);
let b = 2;

sayHi();
function sayHi() { console.log('hi'); }

sayBye();
const sayBye = () => console.log('bye');
```

**Answer:** `undefined` (`var` is hoisted and initialized to undefined), then a `ReferenceError` for `b` (temporal dead zone). Taken separately: `sayHi()` works because function declarations are hoisted with their body, and `sayBye()` throws a ReferenceError because it's a `const` in the temporal dead zone.

**বাংলায়:**

প্রথমে `undefined` print হয়, কারণ `var` hoist হয়ে undefined দিয়ে initialize হয়। তারপর `b`-এর জন্য `ReferenceError` আসে (temporal dead zone)। আলাদাভাবে দেখলে, `sayHi()` কাজ করে কারণ function declaration তার body সহ hoist হয়। আর `sayBye()` ReferenceError throw করে, কারণ এটা temporal dead zone-এ থাকা একটা `const`।

### T7. What does this return?

```javascript
[10, 1, 2].sort();
['1', '2', '3'].map(parseInt);
```

**Answer:** `[1, 10, 2]` — the default sort compares values as **strings**. Use `.sort((a, b) => a - b)`. Note that `sort` also mutates the original array; use `toSorted()` or `[...arr].sort()` for React state. The second gives `[1, NaN, NaN]`, because `map` passes `(value, index)`, so it calls `parseInt('1', 0)` (radix 0 is treated as 10, giving `1`), `parseInt('2', 1)` (radix 1 is invalid, so `NaN`) and `parseInt('3', 2)` (radix 2 is valid, but `3` is not a binary digit, so `NaN`). Use `.map(Number)`.

**বাংলায়:**

`[10, 1, 2].sort()` দেয় `[1, 10, 2]`, কারণ default sort value-গুলোকে **string** হিসেবে compare করে — `.sort((a, b) => a - b)` ব্যবহার করুন। `sort` original array-কেও mutate করে, তাই React state-এর জন্য `toSorted()` বা `[...arr].sort()` ব্যবহার করুন। `['1', '2', '3'].map(parseInt)` দেয় `[1, NaN, NaN]`, কারণ `map` `(value, index)` pass করে, ফলে `parseInt('1', 0)` (radix 0 মানে 10, তাই `1`), `parseInt('2', 1)` (radix 1 invalid, তাই `NaN`) আর `parseInt('3', 2)` call হয় — radix 2 valid, কিন্তু binary-তে `3` বলে কোনো digit নেই, তাই `NaN`। এর বদলে `.map(Number)` ব্যবহার করুন।

### T8. Is JavaScript pass-by-reference? What does this print?

```javascript
function update(obj) { obj.x = 2; obj = { x: 3 }; }
const a = { x: 1 };
update(a);
console.log(a.x);
```

**Answer:** `2`. JavaScript is always pass-by-value, but for objects the value is a reference. Mutating through the reference (`obj.x = 2`) affects the original; reassigning the parameter (`obj = {...}`) only changes the local variable.

**বাংলায়:**

Output হবে `2`। JavaScript সবসময় pass-by-value, কিন্তু object-এর ক্ষেত্রে সেই value-টা নিজেই একটা reference। Reference দিয়ে mutate করলে (`obj.x = 2`) original object বদলায়। কিন্তু parameter reassign করলে (`obj = {...}`) শুধু local variable বদলায়।

### T9. What is the count after one click, and what is logged?

```tsx
const [count, setCount] = useState(0);
const handleClick = () => {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
  console.log(count);
};
```

**Answer:** The count becomes `1`, not 3, and the log prints `0`. Each call uses the same `count` captured by this render's closure, and updates are batched. The log shows the old value because state updates apply on the next render. Use `setCount(c => c + 1)` three times to get 3.

**বাংলায়:**

এক click-এর পর count হবে `1`, 3 না, আর log print করবে `0`। প্রতিটা call এই render-এর closure-এ ধরা একই `count` ব্যবহার করে, আর update-গুলো batch হয়। Log পুরনো value দেখায় কারণ state update পরের render-এ apply হয়। 3 পেতে চাইলে তিনবার `setCount(c => c + 1)` ব্যবহার করুন।

### T10. Why doesn't this re-render?

```tsx
const [user, setUser] = useState({ name: 'Asha' });
const rename = () => {
  user.name = 'Ravi';
  setUser(user);
};
```

**Answer:** React compares old and new state with `Object.is`. Mutating the object keeps the same reference, so React thinks nothing changed and skips the render. Always create a new object: `setUser({ ...user, name: 'Ravi' })`.

**বাংলায়:**

React পুরনো আর নতুন state `Object.is` দিয়ে compare করে। Object mutate করলে reference একই থাকে, তাই React ভাবে কিছুই বদলায়নি আর render skip করে। সবসময় নতুন object তৈরি করুন: `setUser({ ...user, name: 'Ravi' })`।

### T11. What renders when `items` is empty?

```tsx
{items.length && <List items={items} />}
```

**Answer:** It renders a literal `0` on the screen. `0 && ...` returns `0`, and React renders numbers. Use `items.length > 0 && ...` or a ternary.

**বাংলায়:**

Screen-এ একটা literal `0` render হবে। `0 && ...` return করে `0`, আর React number render করে। এর বদলে `items.length > 0 && ...` বা ternary ব্যবহার করুন।

### T12. Why does this cause an infinite loop?

```tsx
function Products({ category }) {
  const [data, setData] = useState([]);
  const filters = { category, limit: 10 };
  useEffect(() => {
    fetchProducts(filters).then(setData);
  }, [filters]);
}
```

**Answer:** `filters` is a new object on every render, so the dependency always looks changed. The effect runs, sets state, which re-renders, which creates a new `filters`, and so on forever. Depend on primitives (`[category]`), create the object inside the effect, or `useMemo` it. Better still, use TanStack Query with `queryKey: ['products', category]`.

**বাংলায়:**

`filters` প্রতিটা render-এ একটা নতুন object, তাই dependency সবসময় changed মনে হয়। Effect চলে, state set করে, re-render হয়, নতুন `filters` তৈরি হয় — এভাবে চলতেই থাকে। Fix হলো primitive-এর উপর depend করা (`[category]`), object-টা effect-এর ভেতরে বানানো, বা `useMemo` করা। আরো ভালো হলো TanStack Query-তে `queryKey: ['products', category]` ব্যবহার করা।

### T13. In what order do these logs appear?

```tsx
function Child() {
  console.log('child render');
  useEffect(() => console.log('child effect'), []);
  return null;
}
function Parent() {
  console.log('parent render');
  useEffect(() => console.log('parent effect'), []);
  return <Child />;
}
```

**Answer:** `parent render`, `child render`, `child effect`, `parent effect`. Rendering goes top-down, but effects run bottom-up — children's effects fire first because the parent isn't "mounted" until its children are. That is the production order. In development **Strict Mode**, React also calls each component twice (the second log is dimmed in the console), then simulates unmount + remount, so effects run again: `parent render`, `parent render`, `child render`, `child render`, `child effect`, `parent effect`, `child effect`, `parent effect`.

**বাংলায়:**

Production-এ order হলো `parent render`, `child render`, `child effect`, `parent effect`। Render top-down হয়, কিন্তু effect চলে bottom-up — child-এর effect আগে চলে, কারণ child-রা mount না হওয়া পর্যন্ত parent "mounted" হয় না। Development **Strict Mode**-এ React প্রতিটা component দুবার call করে (দ্বিতীয় log console-এ dimmed থাকে), তারপর unmount + remount simulate করে, তাই effect আবার চলে: `parent render`, `parent render`, `child render`, `child render`, `child effect`, `parent effect`, `child effect`, `parent effect`।

### T14. Why does the input lose focus after every keystroke?

```tsx
function Form() {
  const [name, setName] = useState('');
  const Field = () => <input value={name} onChange={e => setName(e.target.value)} />;
  return <Field />;
}
```

**Answer:** `Field` is defined inside `Form`, so every render creates a brand-new component type. React sees a different type, unmounts the old input and mounts a new one, losing focus. Define components at the top level of the module, never inside another component.

**বাংলায়:**

`Field` component-টা `Form`-এর ভেতরে define করা, তাই প্রতিটা render-এ একটা একদম নতুন component type তৈরি হয়। React আলাদা type দেখে পুরনো input unmount করে নতুন একটা mount করে, ফলে focus হারিয়ে যায়। Component সবসময় module-এর top level-এ define করুন, কখনো অন্য component-এর ভেতরে না।

### T15. Does `React.memo` prevent the re-render here?

```tsx
const Row = React.memo(({ onSelect }) => <button onClick={onSelect}>Pick</button>);
// in parent:
<Row onSelect={() => select(id)} />
```

**Answer:** No. The arrow function is a new reference every render, so the shallow prop comparison fails and `Row` re-renders anyway. Wrap the handler in `useCallback` (or rely on the React Compiler). Similarly, a Context `value={{ user, setUser }}` creates a new object each render and re-renders every consumer — memoize it with `useMemo`.

**বাংলায়:**

না, prevent করে না। Arrow function প্রতিটা render-এ নতুন reference, তাই shallow prop comparison fail করে আর `Row` তবুও re-render হয়। Handler-টা `useCallback`-এ wrap করুন, অথবা React Compiler-এর উপর ভরসা করুন। একইভাবে Context-এ `value={{ user, setUser }}` প্রতিটা render-এ নতুন object বানায় আর সব consumer re-render করে — তাই এটাকে `useMemo` দিয়ে memoize করুন।

### T16. How do you reset a component's state when a prop changes, without `useEffect`?

**Answer:** Give it a `key`: `<ProfileForm key={userId} user={user} />`. When the key changes, React unmounts the old instance and mounts a fresh one with new initial state. This is cleaner than syncing state with an effect.

**বাংলায়:**

Component-কে একটা `key` দিন: `<ProfileForm key={userId} user={user} />`। Key বদলালে React পুরনো instance unmount করে নতুন initial state সহ একটা fresh instance mount করে। Effect দিয়ে state sync করার চেয়ে এটা অনেক clean।

### T17. Does changing `ref.current` re-render the component?

**Answer:** No. Refs are mutable boxes React doesn't track. If the UI needs to show the value, it belongs in state. Corollary: don't read `ref.current` during render to decide what to display.

**বাংলায়:**

না, re-render হয় না। Ref হলো mutable box, যেটা React track করে না। UI-তে value-টা দেখাতে হলে সেটা state-এ রাখা উচিত। এর সাথে আরেকটা কথা: কী display হবে সেটা ঠিক করতে render-এর সময় `ref.current` পড়বেন না।

### T18. Next.js traps — true or false?

1. "A `'use client'` component only runs in the browser."
2. "A Server Component can render a Client Component."
3. "A Client Component can import a Server Component."
4. "Changing a `NEXT_PUBLIC_` env variable on the server takes effect without rebuilding."
5. "Checking auth in middleware (`proxy.ts` since Next.js 16) is enough to protect data."

**Answer:** (1) **False** — client components are still pre-rendered on the server for the first HTML, which is why `window is not defined` errors happen; use `useEffect` or `dynamic(..., { ssr: false })` (only from a Client Component) for browser-only code. (2) **True.** (3) **False** — importing it turns it into client code; instead pass the Server Component in as `children` or a prop. (4) **False** — `NEXT_PUBLIC_` values are inlined into the JS bundle at build time, so a rebuild is required. (5) **False** — always re-check authorization where data is read or mutated (Server Components, Server Actions, route handlers). Proof: CVE-2025-29927 let attackers skip middleware entirely by sending an `x-middleware-subrequest` header. Proxy is for redirects and rewrites, not your only security layer.

**বাংলায়:**

- (1) **False** — client component-ও প্রথম HTML-এর জন্য server-এ pre-render হয়, এজন্যই `window is not defined` error আসে। Browser-only code-এর জন্য `useEffect` বা (শুধু Client Component থেকে) `dynamic(..., { ssr: false })` ব্যবহার করুন।
- (2) **True**।
- (3) **False** — import করলে সেটা client code হয়ে যায়। বরং Server Component-কে `children` বা prop হিসেবে pass করুন।
- (4) **False** — `NEXT_PUBLIC_` value build time-এ JS bundle-এ inline হয়ে যায়, তাই rebuild লাগবে।
- (5) **False** — যেখানে data read বা mutate হয় (Server Component, Server Action, route handler) সেখানে আবার authorization check করুন। CVE-2025-29927-এ attacker `x-middleware-subrequest` header পাঠিয়ে middleware পুরোপুরি skip করতে পারত। Proxy redirect আর rewrite-এর জন্য, একমাত্র security layer না।

### T19. CSS traps

1. "I set `z-index: 9999` but the element is still behind another one. Why?"
2. "Two stacked paragraphs each have `margin: 20px`. Why is the gap 20px, not 40px?"
3. "Center a div horizontally and vertically in one line of Tailwind."

**Answer:** (1) `z-index` only works on positioned elements (or flex/grid children), and it only competes **within the same stacking context**. A parent with `transform`, `opacity < 1`, `filter`, `position: fixed/sticky`, `isolation: isolate`, or (when positioned or a flex/grid child) its own `z-index` creates a new context, trapping the child beneath elements outside it. (2) **Margin collapsing** — vertical margins between block elements merge into the larger one. It doesn't happen in flex or grid containers, which is another reason to use `gap`. (3) `grid place-items-center` (or `flex items-center justify-center`) on the parent, with a height.

**বাংলায়:**

- (1) `z-index` শুধু positioned element (বা flex/grid child)-এ কাজ করে, আর শুধু **একই stacking context**-এর ভেতরে compete করে। Parent-এ `transform`, `opacity < 1`, `filter`, `position: fixed/sticky`, `isolation: isolate`, বা (positioned অথবা flex/grid child হলে) নিজের `z-index` থাকলে নতুন context তৈরি হয়, আর child বাইরের element-এর নিচে আটকে যায়।
- (2) এটা **margin collapsing** — block element-এর মধ্যে vertical margin merge হয়ে বড়টা থাকে। Flex বা grid container-এ এটা হয় না, এটাও `gap` ব্যবহারের আরেকটা কারণ।
- (3) Parent-এ `grid place-items-center` (বা `flex items-center justify-center`), সাথে একটা height।

### T20. What's wrong with this "optimized" code an AI suggested?

```tsx
const total = useMemo(() => a + b, [a, b]);
const handleClick = useCallback(() => setOpen(true), []);
// passed to a plain <button>, not a memoized component
```

**Answer:** Both memoizations cost more than they save. Adding two numbers is cheaper than `useMemo`'s bookkeeping, and `useCallback` only helps when the function goes to a memoized child or into a dependency array. It's a good example of "looks smart, adds noise" — measure with the Profiler before optimizing.

**বাংলায়:**

দুটো memoization-ই যতটা save করে তার চেয়ে বেশি খরচ করে। দুটো number যোগ করা `useMemo`-এর bookkeeping-এর চেয়ে সস্তা। আর `useCallback` তখনই কাজে আসে যখন function-টা memoized child-এ বা dependency array-তে যায়, plain `<button>`-এ না। এটা "দেখতে smart, কিন্তু শুধু noise বাড়ায়"-এর ভালো উদাহরণ — optimize করার আগে Profiler দিয়ে measure করুন।

---

## 13. Toffee & streaming (OTT) frontend

### Q1. What is Toffee, and why do you want to work on it?

> "Toffee is Banglalink's streaming platform — when I used it I saw live TV channels, live sports, dramas and movies, on the web and in the mobile app. From the page source, the web app looks like it's built with Next.js. What excites me is that streaming is one of the hardest frontend problems: video has to start fast and keep playing on cheap phones and slow mobile data, while a huge number of people open the same match at the same moment. I want to work on a product where frontend performance is directly visible to users — every second of buffering is someone closing the app."

**Why this works:** it shows you looked at the product (live sports, Next.js, multi-platform), names the real engineering challenge (scale + weak devices + weak networks), and connects it to user impact. Before the interview, actually use the site and app for a few minutes and mention one concrete thing you noticed. Verify the Next.js claim yourself first (for example, `/_next/` asset paths in the page source) — only say what you have checked.

**বাংলায়:**

"Toffee হলো Banglalink-এর streaming platform — আমি ব্যবহার করে দেখেছি live TV channel, live sports, drama আর movie, web-এ আর mobile app-এ। Page source দেখে মনে হলো web app-টা Next.js দিয়ে বানানো। আমাকে যেটা সবচেয়ে বেশি excite করে, সেটা হলো streaming frontend-এর সবচেয়ে কঠিন problem-গুলোর একটা: সস্তা phone আর slow mobile data-তেও video দ্রুত start হতে হবে আর থেমে না গিয়ে চলতে হবে, অথচ একই মুহূর্তে বিপুল সংখ্যক মানুষ একই match খুলছে। আমি এমন একটা product-এ কাজ করতে চাই যেখানে frontend performance user সরাসরি দেখতে পায় — buffering-এর প্রতিটা সেকেন্ড মানে কেউ একজন app বন্ধ করে দিচ্ছে।"

**কেন এটা কাজ করে:** এতে বোঝা যায় আপনি product-টা সত্যিই দেখেছেন (live sports, Next.js, multi-platform), আসল engineering challenge-টা ধরতে পেরেছেন (scale + দুর্বল device + দুর্বল network), আর সেটাকে user impact-এর সাথে connect করেছেন। Interview-এর আগে কয়েক মিনিট নিজে site আর app ব্যবহার করুন, আর নিজের চোখে খেয়াল করা একটা concrete জিনিস উল্লেখ করুন। Next.js-এর কথাটা আগে নিজে যাচাই করুন (যেমন page source-এ `/_next/` asset path) — শুধু যা নিজে check করেছেন সেটাই বলুন।

### Q2. Progressive download vs adaptive streaming — what's the difference?

**Progressive download** plays one MP4 file over HTTP: the browser downloads it from the start and plays while downloading. Simple, but there is one fixed quality — on a slow network it stalls, and on a fast one it can't improve. Seeking far ahead needs range requests.

**Adaptive streaming (HLS/DASH)** encodes the video at several qualities (for example 240p, 480p, 720p, 1080p), cuts each into small segments of 2–6 seconds, and lists them in a manifest. The player downloads segment by segment and picks the quality of each next segment based on current network speed and buffer. That is how one stream can serve both a fast 4G user in Dhaka and a weak 3G user outside the city. At CDN scale, live TV is practically always delivered this way; WebRTC is used instead only for sub-second, interactive cases (video calls, auctions, watch parties) because it is much harder to scale to millions.

**বাংলায়:**

Progressive download মানে একটাই MP4 file HTTP দিয়ে download হতে হতে play হয় — সহজ, কিন্তু quality একটাই, তাই slow network-এ আটকে যায় আর fast network-এ quality বাড়ে না। Adaptive streaming (HLS/DASH)-এ video কয়েকটা quality-তে encode করে 2–6 সেকেন্ডের segment-এ কেটে একটা manifest-এ list করা হয়। Player network speed আর buffer দেখে প্রতিটা পরের segment-এর quality বেছে নেয়, তাই Dhaka-র fast 4G user আর শহরের বাইরের weak 3G user একই stream দেখতে পারে। CDN scale-এ live TV প্রায় সবসময় এভাবেই যায়; WebRTC শুধু sub-second interactive case-এ (video call, auction, watch party) ব্যবহার হয়, কারণ সেটা লাখো user-এ scale করা অনেক কঠিন।

### Q3. HLS vs DASH? What are a manifest and segments?

| | HLS | MPEG-DASH |
|---|---|---|
| Made by | Apple | MPEG standard |
| Manifest | `.m3u8` text playlist | `.mpd` XML file |
| Native browser support | Safari (macOS, iOS), Chrome on Android; desktop Chrome is only recently adding it | Practically none — needs a JS player |
| DRM usually paired | FairPlay (Apple), also Widevine | Widevine, PlayReady |

The **manifest** is the table of contents. In HLS there is a **master playlist** listing each quality (bitrate, resolution, codecs) and a **media playlist** per quality listing its segments. For live streams the media playlist keeps changing — the player re-fetches it to discover new segments.

**Segments** were traditionally `.ts` files; modern setups use **CMAF** (fragmented MP4), which lets one set of segment files serve both HLS and DASH, halving storage and CDN cache usage. With DRM, that only works if the segments are encrypted once with the **`cbcs`** scheme: FairPlay requires it, and modern Widevine and PlayReady support it. If you must support legacy devices that only understand `cenc`, you end up packaging twice.

**বাংলায়:**

HLS Apple-এর বানানো, manifest হলো `.m3u8` playlist, আর Safari ও Android Chrome-এ native চলে (desktop Chrome-এ সম্প্রতি আসছে); DASH হলো MPEG standard, manifest `.mpd` XML, browser-এ চালাতে JS player লাগে। Manifest হলো table of contents — HLS-এ master playlist-এ সব quality থাকে, আর প্রতিটা quality-র media playlist-এ তার segment-গুলো; live-এ player বারবার playlist re-fetch করে নতুন segment খোঁজে। আগে segment ছিল `.ts`, এখন CMAF (fragmented MP4) দিয়ে একই segment HLS আর DASH দুটোতেই চলে, ফলে storage আর CDN cache অর্ধেক লাগে। DRM থাকলে এটা কাজ করে শুধু `cbcs` scheme-এ encrypt করলে; legacy device শুধু `cenc` বুঝলে দুইবার package করতে হয়।

### Q4. How does adaptive bitrate (ABR) decide which quality to play?

The player measures how fast the last segments downloaded and how many seconds of video are already buffered, then chooses the next segment's quality.

- **Throughput-based:** "the last segments came at 3 Mbps, so pick the highest rendition safely below that."
- **Buffer-based (e.g. BOLA):** "the buffer is healthy, I can afford higher quality; the buffer is draining, drop down now."
- Real players are mostly throughput-based with buffer safeguards (hls.js, Shaka); dash.js switches between throughput and BOLA. All of them avoid switching up and down too often, because flickering quality looks worse than steady medium quality.

Frontend levers: the **start quality** (start low for a fast first frame, then climb), capping quality to the player's size (no 1080p in a 360px-wide mini player — hls.js `capLevelToPlayerSize`), and a user-facing quality menu or data-saver mode.

**বাংলায়:**

ABR হলো player-এর logic, যেটা শেষ segment-গুলো কত দ্রুত download হলো আর কত সেকেন্ড buffer আছে দেখে পরের segment-এর quality ঠিক করে। Throughput-based ABR speed দেখে, আর buffer-based (যেমন BOLA) buffer ভরা নাকি খালি হচ্ছে সেটা দেখে; hls.js আর Shaka মূলত throughput-based (সাথে buffer safeguard), আর dash.js throughput আর BOLA-র মধ্যে switch করে; সবাই বারবার quality ওঠানামা এড়ায়, কারণ flicker করা quality স্থির medium quality-র চেয়ে খারাপ লাগে। Frontend-এ আমরা start quality low রাখতে পারি যাতে first frame দ্রুত আসে, player size অনুযায়ী quality cap করতে পারি (hls.js `capLevelToPlayerSize`), আর quality menu বা data-saver mode দিতে পারি।

### Q5. How does a browser play HLS if only Safari supports it natively?

Through **Media Source Extensions (MSE)**. A JavaScript player such as hls.js, Shaka Player or dash.js downloads the manifest and segments itself, then feeds the bytes into a `MediaSource` attached to a normal `<video>` element. The browser just decodes what it's given; the JS library does all the streaming logic (ABR, retries, live playlist refresh).

Safari on macOS and iOS (and Chrome on Android) can play an `.m3u8` URL directly with `video.src = url`. Historically iPhone Safari had no MSE at all, so native HLS was the only option. Since iOS 17.1 Safari has **`ManagedMediaSource`** (MMS), and hls.js 1.5+ uses it, so `Hls.isSupported()` is true on modern iPhones too. With MMS, `disableRemotePlayback` must be true or an AirPlay alternative `<source>` must exist — hls.js sets this itself; you only handle it in custom MSE code or to keep AirPlay working.

Many teams still keep **two code paths** — hls.js for most browsers and native HLS on Safari — mainly because FairPlay DRM, AirPlay and battery use are simplest with Apple's native player. That's why some bugs appear "only on iPhone".

**বাংলায়:**

বেশিরভাগ browser-এ HLS চলে Media Source Extensions (MSE) দিয়ে: hls.js, Shaka বা dash.js নিজেই manifest আর segment download করে `MediaSource`-এ bytes ঢুকিয়ে দেয়, browser শুধু decode করে। Safari (macOS, iOS) আর Android Chrome-এ `video.src = url` দিয়ে সরাসরি `.m3u8` চালানো যায়। আগে iPhone Safari-তে MSE ছিলই না, কিন্তু iOS 17.1 থেকে `ManagedMediaSource` আছে আর hls.js 1.5+ সেটা ব্যবহার করে; MMS-এ `disableRemotePlayback` true থাকতে হয় বা AirPlay alternative `<source>` লাগে — hls.js এটা নিজেই set করে, শুধু নিজের MSE code লিখলে বা AirPlay চালু রাখতে চাইলে আপনাকে handle করতে হবে। তবু অনেক team দুইটা code path রাখে, কারণ FairPlay DRM, AirPlay আর battery Apple-এর native player-এ সবচেয়ে সহজ — এজন্যই কিছু bug "শুধু iPhone-এ" দেখা যায়।

### Q6. Build a simple HLS video player component for a Next.js app.

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let destroy = () => {};

    (async () => {
      const { default: Hls } = await import('hls.js'); // browser-only, own chunk
      if (cancelled) return; // src changed or unmounted while loading
      setError(null);

      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true });
        let netRetries = 0;
        let mediaRetries = 0;
        let lastRecovery = 0;
        let retryTimer: number | undefined;
        const fail = () => {
          clearTimeout(retryTimer);
          hls.destroy();
          destroy = () => {}; // already torn down, make cleanup a no-op
          setError('Playback failed. Please try again.');
        };
        // 30 s of healthy playback since the last recovery: give the next failure a fresh budget
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (Date.now() - lastRecovery > 30_000) { netRetries = 0; mediaRetries = 0; }
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return; // hls.js retries non-fatal errors itself
          const manifestFailed =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !manifestFailed && ++netRetries <= 3) {
            // hls.js has already retried internally, so wait before restarting (2 s, 4 s, 8 s)
            lastRecovery = Date.now();
            retryTimer = window.setTimeout(() => hls.startLoad(), 1000 * 2 ** netRetries);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && ++mediaRetries <= 3) {
            lastRecovery = Date.now();
            if (mediaRetries > 1) hls.swapAudioCodec(); // repeated media error
            hls.recoverMediaError();
          } else {
            fail(); // includes manifest failures: startLoad() can't re-fetch the manifest
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => { clearTimeout(retryTimer); hls.destroy(); };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        const onErr = () => setError('Playback failed. Please try again.');
        video.addEventListener('error', onErr);
        video.src = src; // native HLS (older iOS Safari)
        destroy = () => {
          video.removeEventListener('error', onErr);
          video.removeAttribute('src');
          video.load();
        };
      } else {
        setError('Your browser cannot play this stream.');
      }
    })();

    return () => { cancelled = true; destroy(); }; // stop old downloads
  }, [src]);

  return (
    <div className="relative aspect-video w-full bg-black">
      <video ref={videoRef} controls playsInline muted autoPlay className="h-full w-full" />
      {error && (
        <p role="alert" className="absolute inset-0 grid place-items-center p-4 text-center text-white">
          {error}
        </p>
      )}
    </div>
  );
}
```

**Points to say out loud:** it must be a Client Component (it touches the browser and the video element); hls.js is imported **inside the effect**, so it never runs during SSR and lives in its own chunk; check `Hls.isSupported()` first, because `canPlayType` also returns a value in browsers like Chrome on Android, and it is not a "Safari check"; fatal errors get a few recovery attempts, counted separately for network and media errors — network errors are retried with a growing delay (hls.js has already retried internally, so restarting instantly can loop), and a repeated media error gets `swapAudioCodec()` then `recoverMediaError()`; the counters reset only after 30 s of healthy playback, so a long live match doesn't run out of retries, but an error that comes back after every fragment can't loop forever; a manifest failure (wrong or expired URL, offline at start) can't be fixed by `startLoad()`, so it goes straight to the message; after that the player is destroyed once (cleanup clears the retry timer and becomes a no-op, so no double destroy) and the user sees a message instead of a dead black box — the native-HLS path listens for the video `error` event for the same reason; the **cleanup** sets `cancelled`, removes listeners and destroys the player so switching channels doesn't leave the old stream downloading in the background; `aspect-video` reserves space so there's no layout shift; `playsInline` stops iPhone from forcing fullscreen. To keep the whole component out of the home page bundle, load it from a Client Component (`ssr: false` is an error in a Server Component) with `dynamic(() => import('./VideoPlayer').then(m => m.VideoPlayer), { ssr: false, loading: () => <div className="aspect-video w-full bg-black" /> })` — `.then` is needed because `VideoPlayer` is a named export, and without the `loading` placeholder nothing renders until the chunk arrives, so the page shifts.

**বাংলায়:**

এটা একটা Client Component, কারণ browser আর video element লাগে; hls.js effect-এর ভেতরে dynamic import করা হয়, তাই SSR-এ চলে না আর আলাদা chunk-এ থাকে। আগে `Hls.isSupported()` check করা হয়, কারণ `canPlayType` Android Chrome-এও value দেয় — এটা "Safari check" না। Fatal error হলে কয়েকবার recovery চেষ্টা হয় — network আর media error আলাদা গোনা হয়। Network error-এ delay বাড়িয়ে retry হয় (hls.js নিজে আগেই retry করে ফেলেছে, তাই সাথে সাথে retry করলে loop হতে পারে), আর repeated media error-এ `swapAudioCodec()` তারপর `recoverMediaError()`। Counter শুধু 30 সেকেন্ড ঠিকঠাক playback-এর পর reset হয়, যাতে লম্বা live match-এ retry ফুরিয়ে না যায়, আবার প্রতি fragment-এর পর ফিরে আসা error অনন্ত loop-ও না করে। Manifest load fail হলে (ভুল বা expired URL, শুরুতেই offline) `startLoad()` কিছু করে না, তাই সরাসরি message দেখানো হয়। তারপর player একবারই destroy হয় (cleanup retry timer clear করে no-op হয়ে যায়, তাই double destroy হয় না) আর user একটা message দেখে, কালো box না — native HLS path-এও একই কারণে video-র `error` event শোনা হয়। Cleanup-এ `cancelled` set করে listener সরিয়ে player destroy করা হয়, যাতে channel বদলালে পুরনো stream background-এ download না হয়; `aspect-video` layout shift আটকায় আর `playsInline` iPhone-এ জোর করে fullscreen হওয়া থামায়। Home page bundle থেকে পুরো component বাইরে রাখতে একটা Client Component থেকে `dynamic(..., { ssr: false, loading: () => <div className="aspect-video w-full bg-black" /> })` দিয়ে load করুন (Server Component-এ `ssr: false` দিলে error হয়) — named export বলে `.then` লাগে, আর `loading` placeholder না দিলে chunk আসা পর্যন্ত জায়গা থাকে না, layout shift হয়।

### Q7. Why doesn't my video autoplay?

Browsers block **autoplay with sound** until the user has interacted with the site. Muted autoplay is allowed. So:

- Autoplay previews and hero banners **muted**, with a visible "tap to unmute" button.
- `video.play()` returns a promise — always `.catch()` it. If it rejects with `NotAllowedError`, show a big play button instead of a frozen black box.
- Even muted autoplay isn't guaranteed: iOS **Low Power Mode** can block it, a video inside a cross-origin iframe needs `allow="autoplay"`, and unmuting from code without a user gesture makes Chrome pause the video. That's why the `.catch()` is always needed.
- On iOS also add `playsInline`, or the video jumps to fullscreen.
- Chrome uses a Media Engagement score, so autoplay may work on your machine (you visit often) but fail for a new user. Test in a fresh profile.

**বাংলায়:**

Browser sound সহ autoplay block করে যতক্ষণ না user site-এ interact করে; muted autoplay allowed। তাই preview আর hero banner muted রাখুন সাথে "tap to unmute" button, আর `video.play()`-এর promise সবসময় `.catch()` করুন — `NotAllowedError` হলে বড় play button দেখান। Muted autoplay-ও guaranteed না: iOS Low Power Mode block করতে পারে, cross-origin iframe-এ `allow="autoplay"` লাগে, আর user gesture ছাড়া code থেকে unmute করলে Chrome video pause করে দেয়। iOS-এ `playsInline` দিন, আর Chrome-এর Media Engagement score-এর কারণে আপনার machine-এ চললেও নতুন user-এর জন্য fail করতে পারে — তাই fresh profile-এ test করুন।

### Q8. What is DRM, and how does it work in the browser?

DRM encrypts the video so only an authorized player can decrypt it — required by studios and sports rights holders.

Flow: segments are encrypted with **Common Encryption (CENC, ISO 23001-7)** — usually the `cbcs` scheme today so one file works for FairPlay, Widevine and PlayReady → the player reads the manifest and sees the content is protected → the browser's **EME** (Encrypted Media Extensions) API — available only on HTTPS (a secure context) — creates a key request (for FairPlay, key system `com.apple.fps`, the player must first fetch the provider's **server certificate**) → the player sends it to the **license server** with the user's auth token → the server checks entitlement and returns a license → the browser's **CDM** (content decryption module) decrypts and plays. JavaScript never sees the actual key.

| DRM | Where |
|---|---|
| Widevine (Google) | Chrome, Firefox, Edge, Android, Android TV |
| FairPlay (Apple) | Safari, iOS, Apple TV |
| PlayReady (Microsoft) | Edge, Windows, many smart TVs |

So a real OTT web app needs **multi-DRM**. Also know: Widevine has security levels — Chrome and Firefox on desktop are usually **L3** (software only), so providers often cap them around 720p. Edge with **PlayReady SL3000** and Safari with FairPlay are hardware-backed, so they can get higher resolutions, as can hardware-secured TVs and phones.

**বাংলায়:**

DRM video encrypt করে রাখে যাতে শুধু authorized player decrypt করতে পারে — studio আর sports rights holder-রা এটা চায়। Flow হলো: segment Common Encryption (CENC) দিয়ে encrypted — এখন সাধারণত `cbcs` scheme, যাতে FairPlay, Widevine, PlayReady সবাই এক file চালাতে পারে → player দেখে content protected → browser-এর EME API (শুধু HTTPS-এ) key request বানায় (FairPlay-তে আগে provider-এর server certificate আনতে হয়) → player সেটা user-এর auth token সহ license server-এ পাঠায় → server entitlement check করে license দেয় → browser-এর CDM decrypt করে চালায়; JavaScript আসল key কখনো দেখে না। Chrome/Firefox/Android-এ Widevine, Apple-এ FairPlay, Edge/Windows/অনেক TV-তে PlayReady, তাই real OTT app-এ multi-DRM লাগে। Desktop Chrome/Firefox সাধারণত Widevine L3 (শুধু software), তাই প্রায়ই 720p-এ cap করা হয়, আর hardware-backed Edge PlayReady SL3000 বা Safari FairPlay বেশি resolution পায়।

### Q9. Toffee's site registers your device before you can watch. Why, and how would you build that on the frontend?

Phrase it as an observation, not inside knowledge: "When I used Toffee's site I saw a device-registration step — I assume it's for..." Likely reasons: limit **devices per account**, limit **concurrent streams** (stop login sharing), tie DRM licenses and entitlements to a device, and detect fraud.

Frontend side:

- Generate a stable **device ID** on first visit (random UUID, stored in `localStorage` or a long-lived cookie) — not browser fingerprinting, which is unreliable and privacy-hostile.
- Send it with login and license requests; the server returns a device token.
- During playback, send a **heartbeat** every ~30–60 seconds ("device X is still watching"). If the server says the limit is exceeded, stop the player and show a clear message: "You're watching on too many devices. Stop one to continue."
- Handle the failure path well — a "Device Registration Failed" page should explain why and offer retry, not be a dead end.

**Trade-off to mention:** the frontend can only *ask*; real enforcement must be on the API and license server, because anyone can edit client code.

**বাংলায়:**

এটা ভেতরের তথ্য হিসেবে না, নিজের observation হিসেবে বলুন: "Toffee-র site ব্যবহার করার সময় আমি একটা device-registration step দেখেছি — আমার ধারণা এটা..." সম্ভাব্য কারণ: account-প্রতি device সংখ্যা সীমিত রাখা, concurrent stream limit করা (login sharing আটকাতে), DRM license আর entitlement device-এর সাথে বাঁধা, আর fraud ধরা। Frontend-এ প্রথম visit-এ একটা stable device ID (random UUID, `localStorage` বা long-lived cookie-তে) বানাই — fingerprinting না, কারণ সেটা unreliable আর privacy-র জন্য খারাপ। Login আর license request-এ ID পাঠাই, server device token দেয়; playback-এর সময় প্রতি ~30–60 সেকেন্ডে heartbeat পাঠাই, limit পার হলে player থামিয়ে পরিষ্কার message দেখাই। Failure page-এ কারণ আর retry থাকা উচিত; আর মনে রাখবেন frontend শুধু *অনুরোধ* করতে পারে, আসল enforcement API আর license server-এ।

### Q10. How do you stop people from copying the stream URL and sharing it?

The frontend alone can't — anything in the browser is visible in DevTools. The protection is server-side, and the frontend cooperates:

- **Signed URLs or signed cookies** from the CDN with a short expiry (minutes), sometimes bound to the user. The player gets a fresh signed manifest URL from the API right before playback — and the token must also cover segment requests (signed cookies, or a CDN/packager that carries the token into every segment URL); signing only the manifest isn't enough, because segment URLs can still be shared.
- **DRM** for premium content, so even a downloaded segment is useless without a license.
- **Token in the license request**, checked against the user's subscription.
- Concurrency heartbeats (previous question).

Frontend responsibilities: never hard-code stream URLs in the bundle, refresh tokens before they expire mid-match, and handle a 403 from the CDN by fetching a new signed URL instead of showing an error.

**বাংলায়:**

শুধু frontend দিয়ে এটা আটকানো যায় না, কারণ browser-এ যা থাকে DevTools-এ দেখা যায়; protection server-side, frontend শুধু সহযোগিতা করে। CDN-এর short expiry-র signed URL বা signed cookie (শুধু manifest sign করলে হবে না — segment request-এও token লাগবে, signed cookie বা এমন CDN/packager দিয়ে যে প্রতিটা segment URL-এ token বসায়), premium content-এ DRM, license request-এ token check, আর concurrency heartbeat — এগুলোই আসল ব্যবস্থা। Frontend-এর কাজ হলো bundle-এ stream URL hard-code না করা, match-এর মাঝে token expire হওয়ার আগেই refresh করা, আর CDN থেকে 403 এলে error না দেখিয়ে নতুন signed URL আনা।

### Q11. Why is a live stream 20–30 seconds behind TV, and how can it be reduced?

Classic HLS uses ~6-second segments and the player starts about 3 segments behind the live edge (Apple's recommended hold-back), plus encoding, packaging and CDN time — that adds up to 20–30 seconds. During a cricket match, users hear the neighbours cheer before they see the wicket.

Ways to reduce it:

- **Shorter segments** (2s) — lower latency, but more requests and less efficient encoding.
- **Low-Latency HLS / LL-DASH** — can reach a few seconds. LL-HLS splits segments into **partial segments** (~0.3–1s) published as they're produced; the player uses **blocking playlist reload** (the server holds the request until the next part exists, so no polling), **preload hints** (request the next part before it's ready) and **delta playlist updates** (fetch only the changed end of a long playlist).
- Player settings: target latency, catching up by playing slightly faster (e.g. 1.05×) when behind, and a "Go live" button when the user drifts. In hls.js these are `lowLatencyMode`, `liveSyncDuration` (or `liveSyncDurationCount` in segments) and `maxLiveSyncPlaybackRate`. Native Safari HLS handles LL-HLS itself and doesn't expose these knobs.

**Trade-off:** lower latency means a smaller buffer, so more rebuffering on bad networks. For a mass-market audience on mobile data, a slightly higher but stable latency is often the right choice.

**বাংলায়:**

Classic HLS-এ ~6 সেকেন্ডের segment, player live edge থেকে প্রায় 3টা segment পিছনে start করে (Apple-এর recommended hold-back), সাথে encoding, packaging আর CDN-এর সময় — সব মিলিয়ে 20–30 সেকেন্ড latency, তাই পাশের বাসার চিৎকার আগে শোনা যায়, wicket পরে দেখা যায়। কমাতে shorter segment (2s) ব্যবহার করা যায় (বেশি request, কম efficient encoding), অথবা Low-Latency HLS / LL-DASH, যেখানে partial segment, blocking playlist reload, preload hint আর delta playlist update দিয়ে কয়েক সেকেন্ডে নামানো যায়। Player-এ target latency, পিছিয়ে পড়লে একটু দ্রুত (যেমন 1.05×) চালানো আর "Go live" button — hls.js-এ `lowLatencyMode`, `liveSyncDuration`, `maxLiveSyncPlaybackRate`; native Safari এগুলো নিজে handle করে। Trade-off হলো কম latency মানে ছোট buffer, তাই খারাপ network-এ বেশি rebuffering — mass-market mobile audience-এর জন্য একটু বেশি কিন্তু stable latency প্রায়ই ঠিক choice।

### Q12. A big cricket match starts and a huge number of users open Toffee at once. What can the frontend do?

The CDN and backend carry most of the load, but the frontend can make it much worse or much better:

- **Make pages cacheable.** Serve the same HTML/JSON to everyone from the CDN (static or ISR pages), and fetch user-specific bits (profile, continue watching) separately. A page personalized on the server for every request can't be cached.
- **Retry with exponential backoff and jitter**, never a fixed interval. If a million clients all retry every 2 seconds, they hit the server in synchronized waves (the "thundering herd").

```ts
function retryDelay(attempt: number) {
  const base = Math.min(30_000, 1_000 * 2 ** attempt); // 1s, 2s, 4s… max 30s
  return base * (0.5 + Math.random() / 2); // jitter spreads clients out
}
```

- **Don't over-poll.** A score widget polling every second from millions of tabs is a self-made DDoS; use a sensible interval, SSE, or push.
- **Degrade gracefully:** if recommendations fail, still show the player. Use feature flags to switch off non-essential widgets during the match.
- **Pre-warm:** publish the match page and stream URL before the start so caches are already hot.

**বাংলায়:**

মূল load CDN আর backend নেয়, কিন্তু frontend পরিস্থিতি অনেক ভালো বা খারাপ করতে পারে। Page cacheable রাখুন — সবার জন্য একই HTML/JSON CDN থেকে দিন, user-specific অংশ আলাদা fetch করুন; retry করুন exponential backoff আর jitter দিয়ে, fixed interval-এ না, নাহলে লাখো client একসাথে ঢেউয়ের মতো server-এ আঘাত করে (thundering herd)। Score widget প্রতি সেকেন্ডে poll করা নিজেই নিজের DDoS — sensible interval, SSE বা push ব্যবহার করুন। Recommendation fail করলেও player দেখান, feature flag দিয়ে non-essential widget বন্ধ করুন, আর match-এর আগে page ও stream URL publish করে cache warm রাখুন।

### Q13. How would you show live match scores next to the player?

Three options:

- **Polling** (fetch every N seconds) — simplest and cache-friendly (the CDN can cache the score JSON for a few seconds and serve millions), slightly delayed.
- **Server-Sent Events** — one-way server-to-client stream over HTTP; good fit for scores and commentary; reconnects automatically.
- **WebSocket** — two-way; needed for chat, polls and reactions. Hardest to scale to millions of viewers.

For scores alone, **CDN-cached polling or SSE** is usually the best trade-off. Remember the video is 20+ seconds behind — showing the score instantly can **spoil** the moment before the viewer sees it, so consider delaying score updates to match the stream latency.

**বাংলায়:**

তিনটা option: polling (সবচেয়ে সহজ, CDN কয়েক সেকেন্ড score JSON cache করে লাখো user-কে দিতে পারে, একটু delay), Server-Sent Events (HTTP-তে one-way stream, score আর commentary-র জন্য ভালো, নিজে reconnect করে), আর WebSocket (two-way, chat/poll/reaction-এ লাগে, কিন্তু লাখো viewer-এ scale করা সবচেয়ে কঠিন)। শুধু score-এর জন্য CDN-cached polling বা SSE সাধারণত best trade-off। খেয়াল রাখবেন video 20+ সেকেন্ড পিছিয়ে, তাই score instantly দেখালে viewer দেখার আগেই moment spoil হয়ে যায় — score update stream latency-র সাথে মিলিয়ে delay করার কথা ভাবুন।

### Q14. How would you split rendering in Next.js for a streaming site like Toffee?

- **Home / category pages:** server-rendered and cached (ISR with a short `revalidate`) for shared rows — Trending, Live now, Bangla dramas. Personalized rows (Continue watching, Recommended for you) load after the shell, so the main page stays cacheable. With Next.js 16 **Cache Components** (Partial Prerendering), this fits in one page: a static shell plus shared rows marked `'use cache'` with `cacheLife('minutes')` (route-level `revalidate` config doesn't apply once Cache Components is enabled), and personalized rows streamed in inside `<Suspense>`. Fetching personalized rows on the client is the fallback.
- **Movie / show / channel detail pages:** Server Components with static generation or ISR — great for SEO and a fast first paint.
- **Player:** Client Component, loaded lazily; it needs the browser, DRM and user auth anyway.
- **Search:** client-side with debounce, results from an API.
- **Account, subscription, payment:** dynamic, never cached, authorization checked on the server.

The principle: **cache everything that's the same for all users, personalize at the edges.**

**বাংলায়:**

Home আর category page server-rendered আর cached (short `revalidate`-সহ ISR) — Trending, Live now-এর মতো shared row; Continue watching-এর মতো personalized row shell-এর পরে load হয়, তাই page cacheable থাকে। Next.js 16-এর Cache Components (Partial Prerendering) দিয়ে এটা এক page-এ হয়: static shell আর `cacheLife('minutes')`-সহ `'use cache'` দেওয়া shared row (Cache Components চালু থাকলে route-level `revalidate` config কাজ করে না), personalized row `<Suspense>`-এর ভেতরে stream হয়; client-এ fetch করা হলো fallback। Detail page Server Component-এ static বা ISR (SEO আর দ্রুত first paint), player lazy Client Component, search client-side debounce দিয়ে, আর account/subscription/payment dynamic, কখনো cached না, server-এ authorization check। মূল নীতি: যা সবার জন্য একই সেটা cache করুন, আর personalization শুধু আলাদা ছোট অংশে রাখুন।

### Q15. How do you do SEO for a movie or drama page?

- `generateMetadata()` per page: title, description, canonical URL.
- Open Graph and Twitter images (the poster), so shared links look good on Facebook and messaging apps.
- **JSON-LD structured data:** `Movie`, `TVSeries`/`TVEpisode`, and `VideoObject` (name, thumbnail, upload date, duration). For live matches, a `VideoObject` whose `publication` is a `BroadcastEvent` with `isLiveBroadcast: true`, `startDate` and `endDate`.
- `hreflang` alternates between the English and Bangla versions.
- Sitemaps that include every title and episode, and real HTML content (synopsis, cast) rendered on the server — not an empty page that only fills in with JS.

**বাংলায়:**

প্রতিটা page-এ `generateMetadata()` দিয়ে title, description, canonical URL দিন, আর poster দিয়ে Open Graph/Twitter image, যাতে Facebook বা messaging app-এ share করা link সুন্দর দেখায়। JSON-LD structured data দিন: `Movie`, `TVSeries`/`TVEpisode`, `VideoObject`, আর live match-এ `VideoObject`-এর `publication`-এ `isLiveBroadcast: true`, `startDate`, `endDate`-সহ `BroadcastEvent`। English আর Bangla version-এর মধ্যে `hreflang`, সব title আর episode-সহ sitemap, আর synopsis ও cast-এর মতো আসল HTML content server-এ render করুন — JS দিয়ে পরে ভরা খালি page না।

### Q16. The home page has 15 horizontal rows of posters. How do you keep it fast?

- **Images:** `next/image` with correct `sizes` so phones get small posters; modern formats (AVIF/WebP); `preload` (or `fetchPriority="high"`) only on the hero banner (usually the LCP element) — `priority` is deprecated in Next.js 16; everything else lazy.
- **Load rows lazily:** render the first 2–3 rows on the server, load the rest as the user scrolls (IntersectionObserver).
- **Inside a row:** native horizontal scroll with CSS `scroll-snap` is lighter than a heavy carousel library; render a limited number of cards and add more as the user scrolls sideways.
- **Reserve space:** fixed aspect-ratio poster boxes and skeletons, so there's no layout shift (CLS).
- **Hover previews:** start a muted preview only after a short hover delay and only one at a time — never preload video for every card.
- Measure with Lighthouse and real-user Core Web Vitals on a throttled mid-range Android, not only on a fast laptop.

**বাংলায়:**

Image-এর জন্য সঠিক `sizes`-সহ `next/image`, AVIF/WebP, আর শুধু hero banner-এ (সাধারণত LCP element) `preload` বা `fetchPriority="high"` — Next.js 16-এ `priority` deprecated; বাকি সব lazy। প্রথম 2–3টা row server-এ render করুন, বাকিগুলো scroll করলে IntersectionObserver দিয়ে load করুন; row-এর ভেতরে heavy carousel library-র চেয়ে CSS `scroll-snap`-সহ native horizontal scroll হালকা। Fixed aspect-ratio poster box আর skeleton দিয়ে জায়গা reserve করুন যাতে CLS না হয়, hover preview একটু delay-এর পর আর একবারে একটাই চালান। Throttled mid-range Android-এ Lighthouse আর real-user Core Web Vitals দিয়ে measure করুন, শুধু fast laptop-এ না।

### Q17. Many users are on budget Android phones and mobile data. What changes in your approach?

- **JavaScript budget:** low-end CPUs parse JS slowly. Code-split by route, keep the player and heavy libraries out of the initial bundle, prefer Server Components for static content.
- **Data costs money:** default to a moderate quality on mobile networks, offer a **data saver** option, and show quality choices clearly. Respect the `Save-Data` header where available.
- **Fast first frame:** start at a low bitrate and climb; `preconnect` to the video CDN and license server before the user presses play.
- **Unreliable networks:** strong retry logic, resume playback instead of restarting, friendly offline messages.
- **Test real conditions:** Chrome DevTools CPU slowdown + a slow network profile, and ideally a real cheap phone.

**বাংলায়:**

Low-end CPU JavaScript ধীরে parse করে, তাই route অনুযায়ী code-split করুন, player আর heavy library initial bundle-এর বাইরে রাখুন, static content-এ Server Component ব্যবহার করুন। Data-র খরচ আছে, তাই mobile network-এ moderate quality default রাখুন, data saver option দিন, আর `Save-Data` header মানুন। First frame দ্রুত আনতে low bitrate-এ start করে ওপরে উঠুন, আর play চাপার আগেই video CDN আর license server-এ `preconnect` করুন। Unreliable network-এ শক্ত retry logic, restart না করে resume, আর friendly offline message রাখুন; DevTools-এর CPU slowdown আর slow network profile দিয়ে, সম্ভব হলে আসল সস্তা phone-এ test করুন।

### Q18. How do you measure whether video playback is good (QoE)?

Key metrics:

- **Video start time** — from pressing play to the first frame.
- **Rebuffering ratio** — time spent buffering ÷ watch time; the metric most tied to people leaving.
- **Exits before video start** — users who gave up while it was loading.
- **Playback failures** — error rate by device, browser, network and DRM type.
- **Average bitrate and number of quality switches.**

Implementation: listen to `<video>` events (`playing`, `waiting`, `error`) and player-library events. Count rebuffering as the time from a `waiting` event after playback has started (ignoring waits caused by a seek, i.e. between `seeking` and `seeked`) until the next `playing` — not `stalled`, which only means data stopped arriving for a moment. Batch the events, and send with `navigator.sendBeacon` so data isn't lost when the tab closes. Page analytics can go through a tag manager, but player QoE usually needs its own pipeline because event volume is high. Then segment the data: "rebuffering is 3× higher on network X" is an actionable finding. Also mention **CMCD** (Common Media Client Data): the player attaches buffer length, bitrate and a session ID to each segment request (hls.js `cmcd` config), so the CDN logs can be joined with player QoE.

**বাংলায়:**

QoE-র মূল metric হলো video start time, rebuffering ratio (buffering time ÷ watch time — user চলে যাওয়ার সাথে সবচেয়ে বেশি জড়িত), video start-এর আগে exit, device/browser/network/DRM অনুযায়ী playback failure, আর average bitrate ও quality switch-এর সংখ্যা। `<video>`-এর `playing`, `waiting`, `error` event আর player library event শুনুন; rebuffering গুনুন playback শুরুর পরের `waiting` থেকে পরের `playing` পর্যন্ত (seek-এর কারণে হওয়া waiting, মানে `seeking` আর `seeked`-এর মাঝেরটা বাদ দিয়ে) — `stalled` না, কারণ সেটা শুধু মুহূর্তের জন্য data আসা বন্ধ বোঝায়। Event batch করে `navigator.sendBeacon` দিয়ে পাঠান যাতে tab বন্ধ হলেও data না হারায়, আর player QoE-র জন্য সাধারণত আলাদা pipeline লাগে কারণ event volume অনেক বেশি। Data segment করুন ("network X-এ rebuffering 3× বেশি"), আর CMCD-র কথা বলুন — player প্রতিটা segment request-এ buffer length, bitrate আর session ID জুড়ে দেয়, তাই CDN log আর QoE join করা যায়।

### Q19. How do you handle player errors well?

- Distinguish **network errors** (retry with backoff, maybe drop quality), **media/decode errors** (hls.js `recoverMediaError`), **DRM/license errors** (often entitlement — show "subscribe" or "log in again", not a generic error), **geo-blocking** (sports rights are often country-limited — say so clearly) and **auth expiry** (refresh the token silently).
- User-facing messages must be specific and offer an action — Retry, Lower quality, Contact support — with an error code users can report.
- Remember the position and **resume** at the same point after recovery.
- Log the error with context (device, browser, content ID, CDN, error code) for monitoring.

**বাংলায়:**

Error-এর ধরন আলাদা করুন: network error-এ backoff দিয়ে retry (দরকারে quality কমান), media/decode error-এ `recoverMediaError`, DRM/license error-এ সাধারণত entitlement সমস্যা, তাই generic error না দেখিয়ে "subscribe" বা "log in again" দেখান, geo-blocking হলে পরিষ্কার বলুন, আর auth expire হলে চুপচাপ token refresh করুন। User message নির্দিষ্ট হবে আর একটা action দেবে — Retry, Lower quality, Contact support — সাথে report করার মতো error code। Recovery-র পর একই position থেকে resume করুন, আর device, browser, content ID, CDN, error code-সহ error log করুন monitoring-এর জন্য।

### Q20. What's different about building for smart TVs?

- **No mouse or touch** — only the remote's arrow keys, OK and Back. You need **spatial navigation**: arrow keys move focus to the nearest item in that direction (libraries like Norigin Spatial Navigation help).
- **Focus must always be visible** and predictable; remember the focus position when returning to a row.
- **Remote key codes differ per platform** (Tizen for Samsung, webOS for LG), so map them in one place.
- **Weak hardware:** limited memory and slow CPUs — fewer animations, virtualized lists, small bundles, careful image sizes.
- **10-foot UI:** larger text, safe margins (TVs can crop edges), high contrast.

**বাংলায়:**

Smart TV-তে mouse বা touch নেই, শুধু remote-এর arrow key, OK আর Back — তাই spatial navigation লাগে, যেখানে arrow key ওই দিকের সবচেয়ে কাছের item-এ focus নেয় (Norigin Spatial Navigation-এর মতো library সাহায্য করে)। Focus সবসময় দৃশ্যমান আর predictable রাখুন, row-তে ফিরলে আগের focus position মনে রাখুন; remote key code platform-ভেদে আলাদা (Samsung-এর Tizen, LG-এর webOS), তাই এক জায়গায় map করুন। Hardware দুর্বল, তাই কম animation, virtualized list, ছোট bundle; আর 10-foot UI-এর জন্য বড় text, safe margin (TV edge crop করতে পারে) আর high contrast।

### Q21. How do video ads work in a streaming app?

- **VAST/VMAP** are standard XML formats describing an ad and when to play it (pre-roll, mid-roll, post-roll).
- **Client-side ad insertion (CSAI):** the player pauses content and plays the ad through an SDK such as Google IMA. Easy and flexible targeting, but ad blockers can block it and switching streams can cause a black gap.
- **Server-side ad insertion (SSAI):** ads are stitched into the stream itself. Smooth and hard to block — ideal for live sports breaks — but tracking and targeting are more complex.
- **Server-guided ad insertion (SGAI) / HLS Interstitials:** a hybrid. The server marks ad breaks in the playlist with `EXT-X-DATERANGE` tags using `CLASS="com.apple.hls.interstitial"`, and the player fetches and plays the ads as separate streams at those points. You get SSAI-like timing with client-side flexibility. Safari supports it natively, and hls.js added support in 1.6.

Frontend concerns: an ad failure must never break content playback, handle ad breaks during live streams, and report ad events accurately because they are revenue.

**বাংলায়:**

VAST/VMAP হলো standard XML format, যা বলে কোন ad কখন চলবে (pre-roll, mid-roll, post-roll)। CSAI-তে player content থামিয়ে Google IMA-র মতো SDK দিয়ে ad চালায় — সহজ আর flexible targeting, কিন্তু ad blocker আটকাতে পারে আর stream switch-এ কালো gap হতে পারে। SSAI-তে ad stream-এর ভেতরেই stitch করা থাকে — smooth আর block করা কঠিন, live sports break-এর জন্য আদর্শ, কিন্তু tracking আর targeting জটিল। SGAI / HLS Interstitials হলো hybrid: server playlist-এ `EXT-X-DATERANGE` tag দিয়ে ad break mark করে, player আলাদা stream হিসেবে ad চালায় — Safari native support করে, hls.js 1.6-এ এসেছে। Frontend-এ খেয়াল রাখতে হবে ad fail করলে content যেন না ভাঙে, live-এ ad break handle করা, আর ad event সঠিকভাবে report করা, কারণ এটাই revenue।

### Q22. How do you build a subscription paywall and payment flow?

- **Entitlement is decided on the server.** The UI can show a lock icon, but the stream URL and DRM license must only be issued if the server confirms the user's pack. Never trust a client-side `isPremium` flag.
- **Clear content states:** free, premium-locked, included in your pack, expired, not available in your region.
- **Purchase flow:** choose pack → pay (for a mobile operator, often **carrier billing** charged to the mobile balance, plus wallets or cards) → poll or receive the result → refresh entitlements → return the user to exactly the content they wanted.
- Handle **pending** payments and **idempotency**: a double tap must not charge twice; show "processing" rather than an error while the payment is being confirmed.

**বাংলায়:**

Entitlement server-এ ঠিক হয় — UI lock icon দেখাতে পারে, কিন্তু stream URL আর DRM license শুধু server user-এর pack confirm করলে দেবে; client-side `isPremium` flag কখনো trust করবেন না। Content-এর state পরিষ্কার রাখুন: free, premium-locked, আপনার pack-এ included, expired, আপনার region-এ নেই। Purchase flow হলো pack বাছা → pay (mobile operator-এ প্রায়ই carrier billing, মানে mobile balance থেকে কাটা, সাথে wallet বা card) → result poll বা receive → entitlement refresh → user যে content চাইছিল ঠিক সেখানে ফেরত। Pending payment আর idempotency handle করুন: double tap-এ দুইবার charge হবে না, আর confirm হওয়ার সময় error না দেখিয়ে "processing" দেখান।

### Q23. Toffee uses `/en` routes. How do you handle Bangla and English?

Check the live site first and say "If Toffee uses locale routes like `/en`, ..." rather than stating it as fact.

- Locale in the URL (`/en/...`, `/bn/...`) via a `[locale]` segment and a library like `next-intl`; proxy (middleware before Next.js 16) redirects based on a cookie or `Accept-Language`.
- All UI strings in translation files, never hard-coded.
- Bangla font: load a proper Bengali font with `next/font`; conjunct letters need correct shaping, so test with real Bangla text, not lorem ipsum.
- Use `Intl.NumberFormat('bn-BD')` and `Intl.DateTimeFormat` for numbers and dates (Bangla digits), and plural rules from the i18n library.
- Bangla text is often taller and longer — design cards that don't break with long titles.
- `hreflang` tags and a language switcher that keeps the user on the same page.

**বাংলায়:**

আগে live site check করুন, আর fact হিসেবে না বলে বলুন "Toffee যদি `/en`-এর মতো locale route ব্যবহার করে, ..."। URL-এ locale রাখুন (`/en/...`, `/bn/...`) `[locale]` segment আর `next-intl`-এর মতো library দিয়ে; proxy (Next.js 16-এর আগে middleware) cookie বা `Accept-Language` দেখে redirect করে। সব UI string translation file-এ, hard-code না; `next/font` দিয়ে ঠিকঠাক Bengali font load করুন আর যুক্তাক্ষরের shaping আসল Bangla text দিয়ে test করুন, lorem ipsum দিয়ে না। Number আর date-এর জন্য `Intl.NumberFormat('bn-BD')` আর `Intl.DateTimeFormat` (Bangla digit), plural rule i18n library থেকে। Bangla text প্রায়ই লম্বা আর উঁচু, তাই card এমনভাবে design করুন যাতে লম্বা title-এ না ভাঙে, আর `hreflang` ও এমন language switcher দিন যেটা user-কে একই page-এ রাখে।

### Q24. How would you implement "Continue watching"?

- Save the playback position periodically — e.g. every 10–15 seconds and on pause — not on every `timeupdate` event (it fires several times per second).
- On `visibilitychange` to hidden (or `pagehide`), send the last position with `navigator.sendBeacon` so closing the tab doesn't lose it. `sendBeacon` is POST-only and can't set an `Authorization` header, so it works with cookie auth; with bearer tokens use `fetch(url, { method: 'POST', keepalive: true, headers })` instead.
- The server stores it per user + content, so it syncs across phone, web and TV.
- On open: "Resume from 23:14" or "Start over". Mark content finished at ~90–95% (credits) and drop it from the row.
- Live streams don't resume to a position — they jump to the live edge.

**বাংলায়:**

Playback position প্রতি 10–15 সেকেন্ডে আর pause-এ save করুন, প্রতিটা `timeupdate`-এ না (সেটা সেকেন্ডে কয়েকবার fire হয়)। `visibilitychange`-এ hidden হলে (বা `pagehide`) `navigator.sendBeacon` দিয়ে শেষ position পাঠান; `sendBeacon` শুধু POST আর `Authorization` header দিতে পারে না, তাই cookie auth-এ চলে — bearer token হলে `fetch(..., { keepalive: true })` ব্যবহার করুন। Server user + content অনুযায়ী store করে, তাই phone, web আর TV-তে sync হয়; খুললে "Resume from 23:14" বা "Start over" দেখান, ~90–95%-এ (credits) finished ধরে row থেকে সরান। Live stream position-এ resume হয় না, live edge-এ চলে যায়।

### Q25. Design the frontend of a "watch" page for a live match.

Use the structure: **requirements → components → data → performance → edge cases.**

- **Requirements:** player, match info, live score, related matches and highlights, maybe chat or reactions; mobile-first; works for guests and logged-in users.
- **Components:** server-rendered shell (title, teams, schedule — cacheable, SEO) + lazy Client Component player + score widget (polling/SSE) + related rows.
- **Data flow:** page loads → check entitlement and get a signed stream URL → start the player with DRM → heartbeat for concurrency → QoE analytics.
- **Performance:** reserve player space (no CLS), preconnect to the CDN, start at low quality, don't load chat until the user opens it.
- **Edge cases:** not subscribed, geo-blocked, too many devices, match not started yet (countdown), match ended (switch to highlights), stream down (retry with backoff + status message), token expiry mid-match.

**বাংলায়:**

Structure হলো requirements → components → data → performance → edge cases। Requirement: player, match info, live score, related match আর highlights, হয়তো chat; mobile-first, guest আর logged-in দুজনের জন্যই। Component: server-rendered cacheable shell + lazy Client Component player + score widget (polling/SSE) + related row; data flow হলো entitlement check আর signed stream URL → DRM দিয়ে player start → concurrency heartbeat → QoE analytics। Performance-এ player-এর জায়গা reserve, CDN-এ preconnect, low quality-তে start, chat খোলার আগে load না; edge case-এ not subscribed, geo-blocked, too many devices, match শুরু হয়নি (countdown), শেষ (highlights), stream down (backoff-সহ retry) আর match-এর মাঝে token expiry।

### Q26. Trap: "The stream plays in Chrome but shows a black screen on iPhone." Where do you look?

**Answer:** Likely causes, in order: (1) the code only uses hls.js/MSE with no **native HLS fallback** — with hls.js 1.5+ this only breaks iOS below 17.1 (newer iPhones get ManagedMediaSource), but an older hls.js, or code that checks `window.MediaSource` directly, fails on every iPhone; (2) DRM is Widevine-only but Apple devices need **FairPlay**; (3) `playsInline` is missing or autoplay with sound is blocked, so `play()` rejected silently; (4) the stream uses a codec or container Safari doesn't support. Debug with Safari Web Inspector on a real device — not Chrome's device emulation, which still uses Chrome's media stack.

**বাংলায়:**

সম্ভাব্য কারণ ক্রমানুসারে: (1) code শুধু hls.js/MSE ব্যবহার করে, native HLS fallback নেই — hls.js 1.5+ হলে এটা শুধু iOS 17.1-এর নিচে ভাঙে (নতুন iPhone ManagedMediaSource পায়), কিন্তু পুরনো hls.js বা সরাসরি `window.MediaSource` check করা code সব iPhone-এ ভাঙে; (2) DRM শুধু Widevine, কিন্তু Apple device-এ FairPlay লাগে; (3) `playsInline` নেই বা sound-সহ autoplay block হয়েছে, তাই `play()` চুপচাপ reject করেছে; (4) stream-এর codec বা container Safari support করে না। Debug করুন আসল device-এ Safari Web Inspector দিয়ে — Chrome-এর device emulation দিয়ে না, কারণ সেটা এখনো Chrome-এর media stack ব্যবহার করে।

### Q27. Trap: users say data usage keeps growing after they switch channels. What's the bug?

**Answer:** The previous player instance was never destroyed — the `useEffect` has no cleanup calling `hls.destroy()`, or the effect creates a new player on every render because of an unstable dependency (e.g. a config object created inline). The old instance keeps downloading segments in the background. Fix: create the player in an effect keyed on `src`, destroy it in the cleanup, and check the Network tab for segment requests from the old stream after switching. React Strict Mode's double effect run in development helps catch exactly this.

**বাংলায়:**

Bug হলো আগের player instance কখনো destroy হয়নি — `useEffect`-এ `hls.destroy()` call করা cleanup নেই, অথবা unstable dependency-র (যেমন inline বানানো config object) কারণে প্রতি render-এ নতুন player তৈরি হচ্ছে। পুরনো instance background-এ segment download করতেই থাকে, তাই data usage বাড়ে। Fix: `src` key করে effect-এ player বানান, cleanup-এ destroy করুন, আর channel switch-এর পর Network tab-এ পুরনো stream-এর segment request আছে কিনা দেখুন। Development-এ React Strict Mode-এর double effect run ঠিক এই bug ধরতে সাহায্য করে।

### Q28. What questions should you ask the Toffee team?

- "Which player do you use on web — hls.js, Shaka, or something in-house — and how do you handle DRM across browsers?"
- "What does a big live match day look like for the frontend? What broke last time?"
- "Which playback metrics do you track, and what's the biggest QoE problem right now?"
- "How is the web codebase shared with the TV and mobile apps?"
- "How do you test on low-end devices and slow networks?"
- "What would success look like for this role in the first three months?"

**Why ask:** good questions show you understand streaming is different from a normal website, and the answers tell you whether the team takes performance seriously.

**বাংলায়:**

- "Web-এ আপনারা কোন player ব্যবহার করেন — hls.js, Shaka, নাকি in-house কিছু — আর বিভিন্ন browser-এ DRM কীভাবে handle করেন?"
- "বড় live match-এর দিন frontend-এর জন্য কেমন যায়? গতবার কী ভেঙেছিল?"
- "আপনারা কোন playback metric track করেন, আর এই মুহূর্তে সবচেয়ে বড় QoE problem কোনটা?"
- "Web codebase TV আর mobile app-এর সাথে কীভাবে share করা হয়?"
- "Low-end device আর slow network-এ আপনারা কীভাবে test করেন?"
- "প্রথম তিন মাসে এই role-এ success দেখতে কেমন হবে?"

**কেন জিজ্ঞেস করবেন:** ভালো প্রশ্ন দেখায় যে আপনি বোঝেন streaming একটা সাধারণ website থেকে আলাদা, আর উত্তরগুলো থেকে আপনি বুঝবেন team performance-কে সত্যিই গুরুত্ব দেয় কিনা।

### Q29. System design: design the frontend of Toffee (live TV + on-demand OTT) end to end.

This is the full 45-minute system design round. Say the **RADIO** steps out loud (Requirements → Architecture → Data model → Interface/API → Optimizations) so the interviewer always knows where you are. Frame it as "a Toffee-like platform", not as inside knowledge of their system.

```text
0–5    Requirements, and what I'm descoping
5–15   Architecture + component tree
15–22  Data model + API shapes
22–40  Deep dives: player state machine, EPG + channel switching, live vs VOD, match-day spike
40–45  Trade-offs, metrics, what I'd build next
```

**R — Requirements (5 min)**

- **Functional:** home page of rails (Live now, Sports, Dramas, Movies, Continue watching); live TV channels with a programme guide (EPG); live matches; on-demand movies and series with episodes; search; sign-in (e.g. phone number + OTP) and device registration; subscription paywall; continue watching; Bangla and English.
- **Non-functional (targets I'd propose):** video starts in about 2 seconds on 4G; rebuffering under 1% of watch time; works on budget Android Chrome, iPhone Safari and desktop, with smart TVs later; SEO for title and match pages; WCAG 2.2 AA; `bn` and `en` routes.
- **Scale:** I'd ask for real numbers. Assume a big cricket match brings millions of concurrent viewers who all arrive in the same few minutes, about 100+ live channels and thousands of on-demand titles.
- **Descoped:** encoding and packaging, CDN internals, recommendation ML, payment gateway internals (we only redirect to bKash/Nagad/card), native apps.

**A — Architecture (10 min)**

```text
Browser — Next.js App Router
  ├─ Server Components: home rails, title/match pages, EPG shell   (cached, SEO)
  ├─ Client islands: Player, live score, EPG "now" line, search, paywall
  └─ Service worker (optional): app shell + posters only, never video segments
          │
          ▼
BFF / API: catalog, EPG, entitlement, playback, progress, heartbeat
          │
          ├─ Playback service → signed manifest URL + DRM license URL + session token
          ├─ Multi-CDN → HLS/DASH (CMAF) manifests and segments
          └─ DRM license servers → Widevine / FairPlay / PlayReady
```

```text
<AppShell>                header, language switch, auth state
  <HomePage>              <Rail kind="live | vod | continue"> → <PosterCard>
  <LiveTvPage>            <EpgGrid> (channels × time) + <MiniPlayer>
  <WatchPage>             <Player> → <VideoSurface> + <Controls> + <GoLiveButton>
                          + <ScoreWidget> + <RelatedRail>
  <TitlePage>             hero, seasons/episodes, cast, JSON-LD (Server Component)
```

Server Components fetch catalog and EPG data with `'use cache'` + `cacheLife`, so pages come from the cache. The player is one Client Component loaded with `dynamic(..., { ssr: false })`. Its logic lives in a framework-free `PlayerController` (a state machine around hls.js or Shaka Player), so the same core can later run inside a smart TV shell.

**D — Data model (5–8 min)**

Server entities (times are ISO 8601 in UTC):

```ts
type Access = 'free' | 'ads' | 'subscription';
type Channel = { id: string; number: number; name: string; logo: string; access: Access };
type Programme = { id: string; channelId: string; title: string; start: string; end: string; catchupUntil?: string };
type Title = {
  id: string;
  kind: 'movie' | 'series' | 'episode' | 'match';
  name: { en: string; bn: string };
  poster: string;
  durationSec?: number;
  access: Access;
};
type Rail = { id: string; kind: 'live' | 'vod' | 'continue'; title: string; items: Title[]; nextCursor?: string };
type WatchProgress = { titleId: string; positionSec: number; durationSec: number; updatedAt: string };
```

Client side, say there are three kinds of state:

- **Server state** (RSC or TanStack Query): rails, EPG windows keyed by `['epg', windowStart, channelIds]`, title details, entitlement.
- **Player state** (inside `PlayerController` only): status, current source, bitrate, buffer level, last error. It changes several times a second, so it must not live in a global store, or the whole app re-renders.
- **UI and preferences:** selected channel, EPG scroll position, open panels; language, quality cap and data saver in `localStorage`.

Render all times in Dhaka time: `new Intl.DateTimeFormat('bn-BD', { timeZone: 'Asia/Dhaka', timeStyle: 'short' })`.

**I — Interface / API (5–8 min)**

```text
GET  /v1/home?lang=bn                        → { rails: Rail[] }              public, CDN-cached
GET  /v1/epg?from=<ISO>&hours=6&channels=…   → { programmes: Programme[] }    public, CDN-cached
GET  /v1/titles/:id                          → Title + seasons + related      public, CDN-cached
GET  /v1/me/continue-watching                → { items: WatchProgress[] }     private, no CDN cache
POST /v1/playback      { contentId, type: 'live' | 'vod', deviceId }
     → { sessionId, manifestUrl, drm: { scheme, licenseUrl }, token, expiresAt, startPositionSec?, heartbeatSec }
POST /v1/playback/heartbeat  { sessionId, positionSec }  → 200 | 401 token expired | 409 too many devices
PUT  /v1/progress/:titleId   { positionSec }             (also sent with sendBeacon on pagehide)
```

The key decision: split **public, shared, cacheable** data (home, EPG, title pages) from **private, per-user** data (continue watching, entitlement, playback). During a spike the CDN serves the heavy shared part, and only small per-user calls reach the origin.

Component API for the player:

```tsx
<Player
  source={{ kind: 'live', channelId: 'ch-12' }} // or { kind: 'vod', titleId, startAt }
  autoPlay
  muted
  onStatusChange={(status) => track('player_status', { status })}
  onBlocked={(reason) => openPaywallOrLogin(reason)}
/>
```

**O — Deep dive 1: player state machine**

```text
idle → authorizing → loading → playing ⇄ buffering
            │            │          │
            ▼            ▼          ▼
         blocked       error ──retry with backoff──→ loading
   (login, paywall,      │
    too many devices)    └──→ failed (message + Retry button)
playing → ended   (VOD: "Up next"; live: event over → highlights)
```

- One explicit `status` makes impossible combinations (a spinner and an error at the same time) impossible.
- Video events map to transitions: `waiting` → buffering, `playing` → playing, a fatal hls.js error → error, a `409` heartbeat → blocked.
- Every transition is a natural place to log QoE events: startup time, rebuffer start and end, errors.
- React subscribes with `useSyncExternalStore`, so only the controls re-render, not the page. A reducer is enough; XState is fine if the team already uses it.

**O — Deep dive 2: EPG grid and channel switching**

- The EPG is a grid of channels (rows) × time (columns). Server-render the "now" window for a fast first paint, then fetch more 6-hour windows as the user scrolls, cached per window.
- Virtualize **both** directions — 100 channels × 24 hours is thousands of cells. A cell's width is its duration × pixels per minute; clip programmes that started before the window.
- The "now" line and the LIVE badges move on a client timer once a minute; don't refetch the grid for that.
- Keyboard: arrow keys move between cells (roving `tabindex`), Enter plays. The same code works for a TV remote later.
- **Zap time** (how long a channel switch takes) is mostly network: playback API → manifest → first segment → DRM license. To cut it, prefetch the playback token and manifest of the neighbouring channels (or of an EPG row the user rests on for ~300 ms).
- Keep the same `<video>` element, start the new channel at the lowest rendition and let ABR climb, and show the new channel's logo and name instantly so the switch *feels* fast.
- Abort the old channel's requests on every switch — the data-usage bug from Q27.

**O — Deep dive 3: live vs on-demand**

| Aspect | Live (channel, match) | On-demand (movie, drama) |
| --- | --- | --- |
| Manifest | Sliding window, reloaded about every target duration; no `#EXT-X-ENDLIST` | Complete list, fetched once; ends with `#EXT-X-ENDLIST` |
| Seek bar | Only the DVR window (e.g. last 2 hours) + a "Go live" button | Full duration, thumbnail previews |
| Start position | Near the live edge (lower latency vs fewer stalls) | Saved position from continue watching |
| Buffer | Small — the live edge is close | Larger, e.g. 30 s+ on Wi-Fi |
| CDN caching | Manifest with a very short TTL (about half a segment); segments cached | Everything cached for a long time |
| Progress | Don't save a position; remember the last channel | Save every ~10 s and on `pagehide` |
| Ads | Server-side ad insertion at break markers | Pre-roll/mid-roll or server-side insertion |
| SEO | Match page with `BroadcastEvent` JSON-LD | Title page with `Movie` / `TVEpisode` JSON-LD |

Catch-up TV sits in between: a programme that has just ended plays like on-demand content from the archive until `catchupUntil`.

**O — Deep dive 4: match-day spike**

- **Serve the shared part from the CDN:** page shell (static, with Partial Prerendering for the dynamic bits), EPG, posters and score JSON. The origin sees only small per-user calls.
- **Spread the herd:** don't let every client call `/playback` in the same second when the match starts — add random jitter to prefetching, use exponential backoff with jitter on retries, and respect `Retry-After` on `429`/`503`. Heartbeats get jitter too.
- **Degrade, don't die:** feature flags or kill switches turn off chat, reactions and recommendation rails, or cap the top bitrate, when the backend says it's under load. The video must keep playing.
- **Waiting room:** if the playback service sheds load, show a friendly queue page with a countdown instead of a broken player.
- **CDN failover:** the playback API returns more than one CDN host; the player switches host on repeated segment errors (HLS redundant streams or Content Steering, DASH multiple `BaseURL`s).
- **Live score:** one SSE stream, or polling a CDN-cached endpoint every 10–15 s — not a WebSocket per user.
- **Rehearse:** load-test the APIs, test on a budget phone with throttled 3G, and practise flipping the kill switches before the match.

**Other areas, one line each:** performance (virtualized rails, lazy AVIF/WebP posters, preconnect to the CDN); accessibility (WebVTT captions, keyboard controls, focus management in the player); i18n (`/en` and `/bn` routes, Bangla digits); security (signed URLs and DRM, entitlement always checked on the server); observability (QoE — startup time, rebuffer ratio, errors by device and CDN — plus real-user Core Web Vitals).

**Close (40–45 min):** name the trade-offs — server-rendered shell + client player; hls.js (lighter, HLS-focused) vs Shaka Player (stronger DASH and DRM support); polling vs SSE for scores. Then say what you'd build next: downloads in the app, personalized rails, and the same `PlayerController` inside a smart TV shell. For detail, point to earlier answers: the player code (Q6), live latency (Q11), the spike (Q12), QoE (Q18) and the watch page (Q25).

**বাংলায়:**

এটা পুরো 45 মিনিটের system design round, তাই RADIO-র ধাপগুলো মুখে বলে বলে এগোন — Requirements → Architecture → Data model → Interface/API → Optimizations — যাতে interviewer সবসময় বোঝেন আপনি কোথায় আছেন। Toffee-র ভেতরের তথ্য হিসেবে না, "Toffee-র মতো একটা platform" design করছেন — এভাবে বলুন।

- **Requirements:** home-এর rail (Live now, Sports, Drama, Movie, Continue watching), EPG-সহ live TV channel, live match, episode-সহ VOD, search, OTP login, device registration, subscription paywall আর Bangla/English। Non-functional target: 4G-তে ~2 সেকেন্ডে video start, rebuffering খুব কম, budget Android আর iPhone Safari-তে চলবে, SEO আর accessibility। Scale-এর আসল সংখ্যা জিজ্ঞেস করুন — ধরে নিন বড় cricket match-এ একই কয়েক মিনিটে লাখো viewer ঢোকে। Encoding, CDN-এর ভেতরের কাজ, recommendation ML আর payment gateway-এর ভেতরের অংশ descope করুন।
- **Architecture:** Next.js App Router-এ home rail, title/match page আর EPG shell হলো Server Component (cache করা, SEO-friendly); player, live score, search আর paywall হলো Client island। Player একটা Client Component, `dynamic(..., { ssr: false })` দিয়ে load হয়, আর আসল logic একটা framework-free `PlayerController`-এ থাকে, যাতে পরে TV app-ও একই core ব্যবহার করতে পারে। পেছনে BFF/API → playback service (signed URL + DRM license URL), multi-CDN আর DRM license server।
- **Data model:** server entity হলো `Channel`, `Programme` (UTC-তে start/end), `Title`, `Rail` আর `WatchProgress`। Client-এ rail, EPG window আর entitlement-এর মতো server state থাকে RSC বা TanStack Query-তে; player state শুধু `PlayerController`-এর ভেতরে, কারণ এটা সেকেন্ডে কয়েকবার বদলায় — global store-এ রাখলে পুরো app re-render হবে। Language, quality cap আর data saver-এর মতো preference `localStorage`-এ। সব সময় `Asia/Dhaka` timezone-এ দেখান।
- **API:** public, cacheable data (home rail, EPG, title page) আর private, per-user data (continue watching, entitlement, playback) আলাদা endpoint-এ রাখুন, যাতে spike-এর সময় ভারী shared অংশটা CDN থেকে আসে আর origin-এ শুধু ছোট per-user call যায়। `POST /v1/playback` দেয় manifest URL, DRM info, token, expiry আর heartbeat interval; heartbeat-এ `409` মানে device বেশি হয়ে গেছে।
- **Player state machine:** idle → authorizing → loading → playing ⇄ buffering, সাথে blocked (login, paywall, too many devices), error (backoff-সহ retry), failed আর ended। একটাই `status` থাকলে spinner আর error একসাথে দেখানোর মতো অসম্ভব অবস্থা তৈরি হয় না, প্রতিটা transition-এ QoE event log করা যায়, আর `useSyncExternalStore` দিয়ে শুধু controls re-render হয়, পুরো page না।
- **EPG আর channel switching:** EPG হলো channel × সময়ের grid — "এখন"-এর window server-এ render হয়, বাকিটা scroll করলে 6 ঘণ্টার window ধরে fetch হয়, আর দুই দিকেই virtualize করতে হয়। "Now" line client timer দিয়ে প্রতি মিনিটে সরে। Arrow key দিয়ে cell-এ cell-এ যাওয়া যায় (roving `tabindex`), যেটা পরে TV remote-এও কাজে লাগে। Zap time-এর বেশিরভাগই network-এর সময়, তাই পাশের channel-এর (বা user যে EPG row-এ ~300 ms থেমেছে তার) token আর manifest prefetch করুন, একই `<video>` element রাখুন, সবচেয়ে কম quality-তে শুরু করুন, channel-এর logo আর নাম সাথে সাথে দেখান, আর প্রতিবার switch-এ পুরনো channel-এর request abort করুন।
- **Live vs VOD:** live-এ manifest sliding window আর বারবার reload হয়, seek শুধু DVR window-এ আর "Go live" button লাগে, start হয় live edge-এর কাছে, buffer ছোট, আর position save হয় না। VOD-এ manifest সম্পূর্ণ, পুরো seek bar, continue watching-এর saved position থেকে start, buffer বড়, আর প্রতি ~10 সেকেন্ডে ও `pagehide`-এ position save হয়। সদ্য শেষ হওয়া programme catch-up হিসেবে `catchupUntil` পর্যন্ত VOD-এর মতো চলে।
- **Match-day spike:** page shell, EPG, poster আর score JSON — shared সব কিছু CDN থেকে আসে। Match শুরুর মুহূর্তে সবাই যেন একই সেকেন্ডে `/playback` hit না করে, তাই prefetch আর retry-তে random jitter আর exponential backoff দিন, `429`/`503`-এ `Retry-After` মানুন, heartbeat-এও jitter দিন। Load বেশি হলে feature flag দিয়ে chat, reaction আর recommendation rail বন্ধ করুন বা সবচেয়ে বেশি bitrate cap করুন — video যেন চলতেই থাকে। দরকার হলে ভাঙা player-এর বদলে waiting room page দেখান; CDN host fail করলে player নিজেই অন্য host-এ যাবে; live score SSE বা CDN-cached polling দিয়ে, প্রতি user-এর জন্য WebSocket না। Match-এর আগে load test, throttled 3G-তে budget phone-এ test আর kill switch চালানোর practice করে রাখুন।
- **শেষে:** trade-off বলুন (server-rendered shell + client player, hls.js বনাম Shaka Player, polling বনাম SSE), আর সময় পেলে কী বানাতেন — app-এ download, personalized rail, TV shell-এ একই `PlayerController`। বিস্তারিত দরকার হলে আগের উত্তরগুলো দেখান: player code (Q6), live latency (Q11), spike (Q12), QoE (Q18) আর watch page (Q25)।
