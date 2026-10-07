# The React Question Book

**A fully explained Q&A guide — from fundamentals to React 19 and Server Components.**

---

## How to use this book

Every question follows the same shape:

- **Short answer** — what you'd say in one or two sentences.
- **Explanation** — why it works that way.
- **Code** — a runnable illustration where it helps.
- **Watch out** — the trap, the follow-up question, or the mistake people make.

Read it front-to-back once, then use the section index to drill weak areas.

### Contents

1. Fundamentals — components, JSX, props, state, keys
2. Rendering and reconciliation
3. Hooks
4. State management
5. Performance
6. Concurrent React and React 19
7. Server rendering and Server Components
8. Component patterns
9. Forms and data fetching
10. Testing
11. Security and accessibility
12. Rapid-fire and "what does this render?"

---

# Part 1 — Fundamentals

## Q1. What is React?

**Short answer.** React is a JavaScript library for building user interfaces out of components. You describe what the UI should look like for a given state, and React works out how to update the DOM to match.

**Explanation.** The core idea is `UI = f(state)`. You never write "find this element and change its text". You write a function that returns a description of the UI, and when state changes React calls it again and applies the difference.

React itself is split into two parts:

| Piece | Role |
|---|---|
| `react` | Components, hooks, element creation — platform-agnostic |
| Renderer (`react-dom`, `react-native`, …) | Turns element trees into real platform output |

This split is why the same mental model works for web, mobile, PDFs, terminals, and 3D scenes.

**Watch out.** "Library vs framework" is a common follow-up. React handles rendering only — no router, no data layer, no build tooling. Frameworks such as Next.js and React Router (framework mode) add those. The React team now recommends starting new apps with a framework rather than a bare client-side setup.

---

## Q2. What is the virtual DOM, and is it why React is fast?

**Short answer.** The virtual DOM is the tree of plain JavaScript objects (React elements) your components return. React compares the new tree with the previous one and applies only the needed DOM changes. It is not inherently faster than well-written direct DOM code — it makes *declarative* code fast enough.

**Explanation.** A JSX expression produces an object, not a DOM node:

```jsx
const el = <h1 className="title">Hi</h1>;
// roughly: { type: 'h1', props: { className: 'title', children: 'Hi' }, key: null }
```

On every update React builds a new tree, *diffs* it against the old one (reconciliation), and commits the minimal set of mutations. The win is developer ergonomics: you re-describe the whole UI each time, and React avoids re-creating the whole DOM.

**Watch out.** Saying "the virtual DOM makes React faster than the DOM" is a red flag in interviews. The diff itself is overhead. Libraries such as Svelte and Solid skip the virtual DOM entirely and are often faster. The honest answer: the virtual DOM is a pragmatic trade-off for a simple programming model.

---

## Q3. What is JSX?

**Short answer.** JSX is a syntax extension that lets you write HTML-like markup inside JavaScript. A compiler turns it into function calls that create React elements.

**Explanation.**

```jsx
// You write
<Button variant="primary" onClick={save}>Save</Button>

// The modern JSX transform compiles to
import { jsx as _jsx } from 'react/jsx-runtime';
_jsx(Button, { variant: 'primary', onClick: save, children: 'Save' });
```

Differences from HTML that trip people up:

| HTML | JSX |
|---|---|
| `class` | `className` |
| `for` | `htmlFor` |
| `onclick="..."` | `onClick={fn}` |
| `style="color: red"` | `style={{ color: 'red' }}` |
| Unclosed `<img>` | Must self-close: `<img />` |

Expressions go in `{}`; statements (`if`, `for`) do not. Use ternaries, `&&`, or `.map()` instead.

**Watch out.** Since the new JSX transform (React 17) you no longer need `import React from 'react'` in every file. Interviewers sometimes check whether you know why that import used to be required — the old transform compiled to `React.createElement`.

---

## Q4. Props vs state — what's the difference?

**Short answer.** Props are inputs passed from a parent and are read-only to the child. State is data a component owns and can change over time, which triggers a re-render.

**Explanation.**

```jsx
function Counter({ step }) {          // step is a prop
  const [count, setCount] = useState(0); // count is state
  return <button onClick={() => setCount(c => c + step)}>{count}</button>;
}
```

| | Props | State |
|---|---|---|
| Owned by | Parent | The component itself |
| Mutable by the component? | No | Yes, via the setter |
| Change causes re-render? | Yes, when parent re-renders with new props | Yes |

Data flows down through props; events flow up through callbacks passed as props. This is "one-way data flow".

**Watch out.** Copying a prop into state (`useState(props.value)`) only uses the prop on the first render. Later prop changes are ignored. Either use the prop directly, or reset the component with a `key` (see Q6).

---

## Q5. What makes a valid component?

**Short answer.** A function that starts with a capital letter, takes a props object, and returns something React can render: JSX, a string, a number, an array, `null`, or a boolean.

**Explanation.** The capital letter matters: `<button>` is a DOM tag, `<Button>` is a component reference. Components must be *pure during render* — same props and state produce the same output, with no side effects like network calls, subscriptions, or mutating outside variables.

```jsx
let renders = 0;
function Bad() {
  renders++;                 // side effect during render — impure
  return <p>{renders}</p>;
}
```

Side effects belong in event handlers or effects.

**Watch out.** Class components still work but are legacy. Hooks are function-only, and new React features (Server Components, the React Compiler) assume function components. Error boundaries are the one thing that still needs a class (see Q48).

---

## Q6. Why do lists need keys, and why is the index a bad key?

**Short answer.** Keys tell React which item is which between renders, so it can move, insert, and remove items correctly instead of re-using the wrong DOM nodes and state. The index changes when items are reordered or inserted, so state gets attached to the wrong item.

**Explanation.**

```jsx
{todos.map((todo, i) => (
  <TodoRow key={i} todo={todo} />   // bug: insert at the top and every row's state shifts
))}

{todos.map(todo => (
  <TodoRow key={todo.id} todo={todo} />  // correct: stable identity
))}
```

If `TodoRow` has an `<input>` or local state and you prepend an item, with index keys the first row's input text "moves" to the new item.

Keys are also a reset tool. Changing a component's key throws away its state and mounts a fresh instance:

```jsx
<ProfileForm key={userId} userId={userId} />
```

**Watch out.** Index keys are acceptable only when the list is static — never reordered, filtered, or inserted into. Generating keys with `Math.random()` during render is worse than index: every render remounts every item.

---

# Part 2 — Rendering and Reconciliation

## Q7. What causes a component to re-render?

**Short answer.** Three things: its own state changes, its parent re-renders, or a context it consumes changes. Props changing is not a separate trigger — props only change because the parent re-rendered.

**Explanation.** By default, when a component renders, *every child renders too*, whether its props changed or not. React then diffs the output and touches the DOM only where something differs.

```jsx
function Parent() {
  const [n, setN] = useState(0);
  return (
    <>
      <button onClick={() => setN(n + 1)}>{n}</button>
      <ExpensiveChild />   {/* re-renders on every click */}
    </>
  );
}
```

Ways to stop that: move state down into a smaller component, pass the child as `children` from above (it's created by a component that did not re-render), or wrap it in `React.memo` (Q29).

**Watch out.** "Re-render" means calling the component function, not updating the DOM. A re-render that produces identical output costs CPU but no DOM work. Don't optimize re-renders you haven't measured.

---

## Q8. What is reconciliation and how does the diffing algorithm work?

**Short answer.** Reconciliation is how React compares the new element tree with the previous one. It uses two heuristics to make the diff O(n): elements of different types produce entirely different trees, and keys identify children across renders.

**Explanation.**

- **Different type at the same position** — React unmounts the old subtree (destroying its state) and mounts a new one. `<div>` → `<span>`, or `<UserCard>` → `<AdminCard>`, both reset everything below.
- **Same DOM type** — React keeps the node and updates only changed attributes.
- **Same component type** — React keeps the instance (and its state) and re-renders it with new props.
- **Lists** — matched by `key`.

```jsx
{isAdmin ? <Form role="admin" /> : <Form role="user" />}
// Same type, same position — state is PRESERVED when isAdmin flips.
```

**Watch out.** Defining a component inside another component creates a new type on every render, so React remounts it every time and its state is lost:

```jsx
function Page() {
  function Row() { /* ... */ }   // new function each render = new type
  return <Row />;                // remounts on every Page render
}
```

Always define components at module level.

---

## Q9. What are the render and commit phases?

**Short answer.** In the render phase React calls your components and computes what changed — this is pure and can be paused, repeated, or thrown away. In the commit phase React applies the changes to the DOM and runs effects — this is synchronous and cannot be interrupted.

**Explanation.**

| Phase | What happens | Side effects allowed? |
|---|---|---|
| Render | Call components, diff trees | No |
| Commit | Mutate DOM, attach refs, run `useLayoutEffect` | Yes |
| After paint | Run `useEffect` | Yes |

Because render can run multiple times before a commit (concurrent rendering, Strict Mode), anything impure there — logging analytics, mutating globals, starting requests — can happen twice or for a render that never commits.

**Watch out.** Fiber is the internal data structure that makes the render phase interruptible. You don't need its internals for most interviews, but you should know it is what enables time-slicing, Suspense, and transitions.

---

## Q10. What is batching?

**Short answer.** React groups multiple state updates that happen in the same tick into a single re-render. Since React 18 this is automatic everywhere — event handlers, promises, timeouts, native listeners.

**Explanation.**

```jsx
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // one re-render, not two
}

setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // also one re-render since React 18 (was two in React 17)
}, 0);
```

If you genuinely need the DOM updated before the next line runs, use `flushSync` from `react-dom` — rarely needed, and it hurts performance.

**Watch out.** Batching is why `console.log(count)` right after `setCount` shows the old value. The setter schedules an update; it does not change the variable in the current render (see Q13).

---

## Q11. Why does my component render twice in development?

**Short answer.** `<StrictMode>` intentionally double-invokes component functions, initializers, and reducers, and mounts → unmounts → remounts effects in development. It surfaces impure renders and effects missing cleanup. It does nothing in production.

**Explanation.** If your effect breaks when run twice, it was already broken — it would also break on fast refresh, on navigating away and back, or with features that preserve state while hiding UI (`<Activity>`).

```jsx
useEffect(() => {
  const conn = createConnection(roomId);
  conn.connect();
  return () => conn.disconnect();   // with cleanup, the double run is harmless
}, [roomId]);
```

**Watch out.** "How do I stop the double fetch?" — the wrong answer is a `useRef` flag to skip the second run. The right answers: add cleanup that ignores or aborts the stale request, or move fetching out of effects into a data library or framework loader.

---

# Part 3 — Hooks

## Q12. What are the rules of hooks, and why do they exist?

**Short answer.** Call hooks only at the top level of a component or custom hook — never inside conditions, loops, or nested functions, and never from regular functions. React identifies each hook by its call order, so the order must be the same on every render.

**Explanation.** React stores hook state in a list attached to the component. On each render it walks that list in order. A conditional hook shifts every subsequent hook to the wrong slot.

```jsx
function Bad({ isLoggedIn }) {
  if (isLoggedIn) {
    const [name, setName] = useState('');   // slot 0 only sometimes
  }
  const [theme] = useState('dark');         // sometimes slot 0, sometimes slot 1
}
```

`eslint-plugin-react-hooks` enforces this — treat its errors as bugs.

**Watch out.** `use()` (React 19) is the exception: it can be called inside conditions and loops, because it does not store state in a slot. It still must be called inside a component or hook.

---

## Q13. How does `useState` work, and when do you need the functional update form?

**Short answer.** `useState` returns the current value and a setter. The setter schedules a re-render with a new value. Use the functional form `setX(prev => ...)` when the new value depends on the old one, because `x` inside a closure is a snapshot of that render.

**Explanation.**

```jsx
const [count, setCount] = useState(0);

function addThree() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
  // count was 0 in this render for all three calls → result is 1
}

function addThreeCorrectly() {
  setCount(c => c + 1);
  setCount(c => c + 1);
  setCount(c => c + 1);
  // updates are queued and applied in order → result is 3
}
```

Other details:

- **Lazy initializer** — `useState(() => expensiveParse(data))` runs the function only on the first render. `useState(expensiveParse(data))` runs it on every render and throws the result away.
- **Bail-out** — setting the same value (by `Object.is`) skips the re-render.
- **Immutability** — state objects must be replaced, not mutated, or React won't see a change.

```jsx
setUser({ ...user, name: 'Ana' });   // new object — correct
user.name = 'Ana'; setUser(user);    // same reference — no re-render
```

**Watch out.** State is a per-render snapshot, not a live variable. Reading it after calling the setter in the same handler always gives the old value.

---

## Q14. Explain `useEffect` — dependencies, cleanup, and timing.

**Short answer.** `useEffect` synchronizes a component with something outside React — a subscription, a timer, a DOM API, a network connection. It runs after the browser paints. The dependency array says when to re-sync; the returned function cleans up before the next sync and on unmount.

**Explanation.**

```jsx
useEffect(() => {
  const id = setInterval(() => setTick(t => t + 1), 1000);
  return () => clearInterval(id);
}, []);
```

| Dependencies | Runs |
|---|---|
| none | After every render |
| `[]` | After mount only (and cleanup on unmount) |
| `[a, b]` | After mount, and whenever `a` or `b` changes (`Object.is`) |

Order on a dependency change: old cleanup → new effect.

Think of an effect as "keep X in sync with these values", not as a lifecycle method. The question is never "when does this run?" but "what does it synchronize with?".

**Watch out.** Lying about dependencies to make an effect run less often creates stale-closure bugs. If an effect re-runs too much, fix the cause: move objects/functions inside the effect, use the functional setter, or use `useEffectEvent` for non-reactive logic (Q20).

---

## Q15. When should you *not* use an effect?

**Short answer.** When there is no external system involved. Deriving data from props or state, handling a user event, and resetting state on prop change all have better tools than `useEffect`.

**Explanation.**

```jsx
// Bad: derived state through an effect — extra render, can drift
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(first + ' ' + last), [first, last]);

// Good: compute during render
const fullName = first + ' ' + last;
```

| Instead of an effect to… | Do this |
|---|---|
| Compute a value from props/state | Compute it in render (`useMemo` if expensive) |
| Respond to a click or submit | Put the logic in the event handler |
| Reset all state when a prop changes | Pass that prop as `key` |
| Notify a parent of a change | Call the parent callback in the same event handler |
| Fetch data | A framework loader or a data library (TanStack Query, SWR) |

**Watch out.** "Effect chains" — one effect sets state that triggers another effect — are a common smell. They cause cascading renders and are hard to follow. Collapse them into the event handler that started the chain.

---

## Q16. `useEffect` vs `useLayoutEffect`

**Short answer.** `useEffect` runs after the browser paints. `useLayoutEffect` runs after DOM mutations but *before* paint, blocking it. Use the layout version only when you must measure the DOM and change something before the user sees a flicker.

**Explanation.**

```jsx
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    setHeight(ref.current.getBoundingClientRect().height);
  }, []);

  const top = anchorRect.top - height;   // positioned correctly on first paint
  return <div ref={ref} style={{ top }}>{children}</div>;
}
```

With `useEffect` the tooltip would flash in the wrong place for one frame.

**Watch out.** `useLayoutEffect` does nothing during server rendering. It also blocks paint, so heavy work inside it makes the page feel slow. Default to `useEffect`.

---

## Q17. What is `useRef` used for?

**Short answer.** A ref is a mutable box `{ current }` that persists across renders without causing re-renders when changed. Two uses: holding a DOM node, and holding a value you need to remember but don't render (timer IDs, previous values, instance-like data).

**Explanation.**

```jsx
function Search() {
  const inputRef = useRef(null);
  return (
    <>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>Focus</button>
    </>
  );
}

function Stopwatch() {
  const intervalRef = useRef(null);
  const start = () => { intervalRef.current = setInterval(tick, 1000); };
  const stop  = () => clearInterval(intervalRef.current);
  // ...
}
```

| | `useState` | `useRef` |
|---|---|---|
| Changing it re-renders? | Yes | No |
| Value updated | On next render | Immediately |
| Read during render? | Yes | Avoid (except lazy initialization) |

**Watch out.** Don't read or write `ref.current` during render — the output then depends on something React doesn't track, which breaks purity. Refs belong in effects and event handlers.

---

## Q18. `useMemo` vs `useCallback` — and when are they worth it?

**Short answer.** `useMemo` caches a computed value; `useCallback` caches a function. Both recompute only when dependencies change. They're worth it when the computation is genuinely expensive, or when a stable reference prevents work downstream — a `React.memo` child or an effect dependency.

**Explanation.**

```jsx
const visible = useMemo(
  () => todos.filter(t => matches(t, filter)),   // expensive on 10k items
  [todos, filter]
);

const handleSelect = useCallback(id => setSelected(id), []);
// useCallback(fn, deps) is the same as useMemo(() => fn, deps)

return <MemoizedList items={visible} onSelect={handleSelect} />;
```

Without `useCallback`, `handleSelect` is a new function every render, and `MemoizedList`'s `React.memo` comparison always fails.

**Watch out.** Wrapping everything in `useMemo`/`useCallback` adds noise and some cost for no benefit. With the **React Compiler** most manual memoization becomes unnecessary — the compiler inserts it automatically (Q30). Interviewers increasingly ask whether you know this.

---

## Q19. When do you choose `useReducer` over `useState`?

**Short answer.** When state has several fields that change together, when the next state depends on the previous one in non-trivial ways, or when you want update logic testable outside the component.

**Explanation.**

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'added':
      return { ...state, items: [...state.items, action.item] };
    case 'removed':
      return { ...state, items: state.items.filter(i => i.id !== action.id) };
    case 'cleared':
      return { ...state, items: [] };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

const [state, dispatch] = useReducer(reducer, { items: [] });
dispatch({ type: 'added', item });
```

Benefits: event handlers describe *what happened*, the reducer decides *how state changes*, and `dispatch` is stable, so it can be passed down without `useCallback`.

**Watch out.** Reducers must be pure — no API calls, no `Date.now()`, no mutation. Strict Mode calls them twice in development to catch this.

---

## Q20. What is a stale closure, and how does `useEffectEvent` help?

**Short answer.** A stale closure is a function that captured values from an old render and keeps using them. `useEffectEvent` (stable in React 19.2) creates a function that always sees the latest props and state but is *not* a dependency, so it can be called from an effect without re-triggering it.

**Explanation.**

```jsx
function Chat({ roomId, theme }) {
  useEffect(() => {
    const conn = connect(roomId);
    conn.on('connected', () => showToast('Connected', theme));
    return () => conn.disconnect();
  }, [roomId, theme]);   // changing theme reconnects — wrong
}
```

`theme` is only *read* in the callback, it shouldn't cause a reconnect. The fix:

```jsx
function Chat({ roomId, theme }) {
  const onConnected = useEffectEvent(() => showToast('Connected', theme));

  useEffect(() => {
    const conn = connect(roomId);
    conn.on('connected', onConnected);
    return () => conn.disconnect();
  }, [roomId]);          // only roomId is reactive
}
```

The classic stale closure without this hook:

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);  // count is always 0
  return () => clearInterval(id);
}, []);
// Fix: setCount(c => c + 1)
```

**Watch out.** Effect events can only be called from inside effects — not passed to children or called during render.

---

## Q21. How does `useContext` work, and what are its performance pitfalls?

**Short answer.** Context passes a value down the tree without threading props through every level. Every component that reads the context re-renders when the provider's value changes by `Object.is` — even if it only uses one field.

**Explanation.**

```jsx
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext value={theme}>        {/* React 19: <Context> works as a provider */}
      <Page />
    </ThemeContext>
  );
}

function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>OK</button>;
}
```

The common bug:

```jsx
<AuthContext value={{ user, login, logout }}>   // new object every render
```

Every consumer re-renders whenever `App` re-renders. Fix by memoizing the value, or splitting into separate contexts (state vs actions), so components that only need `logout` don't re-render when `user` changes.

**Watch out.** Context is a transport mechanism, not a state manager. It's ideal for low-frequency values — theme, locale, current user. For high-frequency updates shared by many components, use an external store with selectors (Zustand, Redux) — see Q25.

---

## Q22. What is a custom hook, and what makes a good one?

**Short answer.** A custom hook is a function whose name starts with `use` that calls other hooks. It shares *stateful logic*, not state — each component that calls it gets its own independent copy.

**Explanation.**

```jsx
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
```

Good custom hooks have a concrete purpose (`useOnlineStatus`, `useDebouncedValue`, `useChatRoom`). Weak ones wrap lifecycle concepts (`useMount`, `useUpdateEffect`) and hide what the effect synchronizes with.

**Watch out.** For subscribing to an external store, prefer `useSyncExternalStore` — it handles concurrent rendering correctly (no "tearing"). The example above can be written as:

```jsx
const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
```

---

## Q23. What is `useId` for?

**Short answer.** It generates a unique, stable ID that matches between server and client render — used to link labels to inputs and for ARIA attributes.

**Explanation.**

```jsx
function EmailField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Email</label>
      <input id={id} type="email" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`}>We never share it.</p>
    </>
  );
}
```

A counter or `Math.random()` gives different values on server and client and causes hydration mismatches. A hardcoded ID breaks when the component appears twice on a page.

**Watch out.** `useId` is not for list keys. Keys must come from your data.

---

# Part 4 — State Management

## Q24. Where should state live?

**Short answer.** As close as possible to where it's used. Lift it to the nearest common parent only when siblings need to share it. Push it into context or a store only when it's needed widely.

**Explanation.** A useful decision order:

1. **Can it be derived?** Then it isn't state — compute it.
2. **Is it server data?** Use a server-state cache (TanStack Query, SWR, framework loaders), not `useState`.
3. **Is it URL-worthy?** Filters, tabs, pagination, search terms → put them in the URL so links and the back button work.
4. **Is it used by one component?** Local `useState`.
5. **Shared by a few nearby components?** Lift to the common parent.
6. **Used widely and updated rarely?** Context.
7. **Used widely and updated often?** External store with selectors.

**Watch out.** Duplicated state is the most common source of bugs. Storing both `items` and `selectedItem` (a copy) means they drift when the item is edited. Store `selectedId` and derive the item.

---

## Q25. Context vs Redux vs Zustand — how do you choose?

**Short answer.** Context avoids prop drilling but re-renders every consumer on change. Redux Toolkit and Zustand are external stores where components subscribe to slices through selectors, so only affected components re-render. Choose based on update frequency and team needs, not habit.

**Explanation.**

| | Context | Zustand | Redux Toolkit |
|---|---|---|---|
| Boilerplate | Minimal | Minimal | Moderate |
| Selective subscriptions | No | Yes | Yes |
| DevTools / time travel | No | Via middleware | Built in |
| Best for | Theme, auth, locale | Small–medium shared client state | Large apps, strict conventions, many contributors |

```jsx
// Zustand
const useCart = create(set => ({
  items: [],
  add: item => set(s => ({ items: [...s.items, item] })),
}));

function CartCount() {
  const count = useCart(s => s.items.length);   // re-renders only when length changes
  return <span>{count}</span>;
}
```

**Watch out.** Most "we need Redux" cases are actually server-state cases. Once API data moves into TanStack Query, the remaining global client state is often small enough for context or Zustand.

---

## Q26. What is the difference between server state and client state?

**Short answer.** Client state is owned by the browser — UI toggles, form drafts, selected tab. Server state is a cached copy of data owned by the backend — it can go stale and needs refetching, deduplication, and invalidation. They need different tools.

**Explanation.** Server-state problems that `useState + useEffect` doesn't solve: caching between screens, deduplicating identical requests, background refetch, retries, pagination, optimistic updates, and invalidation after mutations.

```jsx
function Todos() {
  const { data, isPending, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  });

  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: createTodo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });
  // ...
}
```

**Watch out.** Copying query data into a Redux store or `useState` "so it's global" defeats the cache. Any component can call the same `useQuery` key — the cache *is* the global store.

---

## Q27. Controlled vs uncontrolled components

**Short answer.** A controlled input's value comes from React state and changes through `onChange`. An uncontrolled input keeps its own value in the DOM, and you read it with a ref or from the form on submit.

**Explanation.**

```jsx
// Controlled — React is the source of truth
const [email, setEmail] = useState('');
<input value={email} onChange={e => setEmail(e.target.value)} />

// Uncontrolled — DOM is the source of truth
<form action={async formData => { await save(formData.get('email')); }}>
  <input name="email" defaultValue="" />
</form>
```

| | Controlled | Uncontrolled |
|---|---|---|
| Live validation / formatting | Easy | Harder |
| Re-render per keystroke | Yes | No |
| Code | More | Less |

React 19 form Actions make uncontrolled forms a first-class choice again (Q38).

**Watch out.** Switching an input from `value={undefined}` to `value="x"` triggers "A component is changing an uncontrolled input to be controlled". Initialize controlled state with `''`, not `undefined`.

---

## Q28. What is prop drilling and how do you avoid it?

**Short answer.** Prop drilling is passing props through intermediate components that don't use them, just to reach a deep child. Fix it with composition first, context second.

**Explanation.** Composition is often overlooked:

```jsx
// Drilling: Layout and Sidebar pass `user` through without using it
<Layout user={user} />

// Composition: the component that has `user` builds the deep child directly
<Layout sidebar={<Sidebar><UserMenu user={user} /></Sidebar>} />
```

`Layout` now receives a ready-made element and doesn't need to know about `user` at all.

**Watch out.** Passing props two or three levels is fine and keeps data flow explicit. Reaching for context immediately makes components harder to reuse and test.

---

# Part 5 — Performance

## Q29. What does `React.memo` do?

**Short answer.** `React.memo` wraps a component so it skips re-rendering when its props are shallowly equal to the previous props. It only helps if the props are actually stable.

**Explanation.**

```jsx
const Row = memo(function Row({ item, onSelect }) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function List({ items }) {
  const [selected, setSelected] = useState(null);
  const onSelect = useCallback(id => setSelected(id), []);
  return items.map(i => <Row key={i.id} item={i} onSelect={onSelect} />);
}
```

Things that silently break memo: inline objects (`style={{...}}`), inline arrays, inline functions, and `children` JSX (a new element object every render).

**Watch out.** `memo` doesn't stop re-renders caused by the component's own state or by context it consumes. And with the React Compiler enabled, explicit `memo` is mostly unnecessary.

---

## Q30. What is the React Compiler?

**Short answer.** A build-time tool (v1.0 stable since October 2025) that analyzes components and hooks and automatically memoizes values, functions, and JSX — the work you used to do by hand with `useMemo`, `useCallback`, and `memo`.

**Explanation.** It works because components are supposed to be pure and follow the rules of hooks. If they do, the compiler can prove which values depend on which inputs and cache them at a finer granularity than manual memoization usually achieves.

It ships as a Babel plugin, with integrations for Vite, Next.js, and Expo. Components that break the rules — mutating props, reading refs during render — are skipped rather than miscompiled.

**Watch out.** The compiler doesn't fix architecture problems: a context that changes on every keystroke, or a 10,000-row list that isn't virtualized, is still slow. It also makes the rules of React stricter in practice — code that "worked" while impure may behave differently.

---

## Q31. How do you code-split a React app?

**Short answer.** Use dynamic `import()` with `React.lazy` and wrap the lazy component in `<Suspense>` with a fallback. Split at route level first, then at heavy, rarely-used components.

**Explanation.**

```jsx
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('./Chart'));   // separate chunk

function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <Chart />
    </Suspense>
  );
}
```

Good candidates: routes, modals, rich text editors, charting and map libraries, admin-only screens.

**Watch out.** Calling `lazy` inside a component recreates it every render and resets state. Declare it at module level. Also preload on intent (hover over a link) to hide the loading delay.

---

## Q32. How do you render a list of 10,000 items?

**Short answer.** Virtualize it: render only the rows visible in the viewport plus a small buffer, and use spacers to keep the scrollbar correct. Libraries: TanStack Virtual, react-window, react-virtuoso.

**Explanation.**

```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

function BigList({ rows }) {
  const parentRef = useRef(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
  });

  return (
    <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map(item => (
          <div key={item.key}
               style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)`, height: item.size }}>
            {rows[item.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Watch out.** Virtualization breaks browser find-in-page and complicates accessibility (screen readers see only rendered rows). Pagination or "load more" may be the better product answer for some lists. CSS `content-visibility: auto` is a lighter alternative for long, non-interactive content.

---

## Q33. `useTransition` vs `useDeferredValue`

**Short answer.** Both mark work as non-urgent so React can keep the UI responsive. `useTransition` wraps the *state update* you control. `useDeferredValue` gives you a lagging copy of a *value* you receive, typically a prop.

**Explanation.**

```jsx
// useTransition — you own the setter
const [isPending, startTransition] = useTransition();

function onTabClick(tab) {
  startTransition(() => setTab(tab));   // heavy tab render can be interrupted
}

// useDeferredValue — you only have the value
function Results({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <SlowList query={deferredQuery} />
    </div>
  );
}
```

Typing stays instant: the urgent update (the input) renders first, the deferred render happens in the background and is thrown away if a newer value arrives.

**Watch out.** Transitions don't make slow code faster, they make it interruptible. `SlowList` should still be memoized so the deferred value actually skips work. And a controlled input's own state must **not** be updated inside a transition — that makes typing lag.

---

## Q34. How do you find out why a React app is slow?

**Short answer.** Measure before changing anything. Use the React DevTools Profiler to see which components render, how often, and why; use the browser Performance panel for long tasks and layout; check Core Web Vitals (especially INP) in the field.

**Explanation.** A practical checklist:

1. **Profiler** with "Record why each component rendered" — look for components re-rendering on every keystroke.
2. **Highlight updates** in DevTools — flashing areas that shouldn't change.
3. **Performance panel** — long tasks over 50 ms, forced reflows, big scripting blocks.
4. **Bundle analyzer** — oversized dependencies (moment.js, full lodash import, icon packs).
5. **Field data** — INP, LCP, CLS from real users.

Common fixes in rough order of payoff: move state down, split context, virtualize long lists, code-split heavy routes, memoize expensive children, use transitions for heavy updates.

**Watch out.** Profiling a development build overstates costs (Strict Mode double rendering, dev-only checks). Confirm with a production build before optimizing.

---

# Part 6 — Concurrent React and React 19

## Q35. What is Suspense?

**Short answer.** `<Suspense>` shows a fallback while something inside it isn't ready yet — lazy code, or data read through a Suspense-enabled source. It lets you declare loading states by *position in the tree* instead of with `isLoading` flags in every component.

**Explanation.**

```jsx
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Suspense fallback={<FeedSkeleton />}>
    <Feed />
  </Suspense>
</Suspense>
```

Nested boundaries let parts of the page reveal independently. During a transition, React keeps the old UI on screen instead of swapping back to a fallback.

What can suspend: `React.lazy`, `use(promise)`, Suspense-enabled data libraries (TanStack Query's `useSuspenseQuery`, Relay), and async Server Components.

**Watch out.** Suspense does not detect a `fetch` inside `useEffect`. Data only suspends if the source integrates with Suspense. Also pair Suspense with an error boundary — a rejected promise throws to the nearest one.

---

## Q36. What is the `use` API?

**Short answer.** `use(resource)` reads the value of a promise or a context. With a promise, the component suspends until it resolves. Unlike hooks, it can be called conditionally.

**Explanation.**

```jsx
// Server Component starts the fetch, passes the promise down
export default function Page() {
  const commentsPromise = getComments();
  return (
    <Suspense fallback={<p>Loading comments…</p>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}

// Client Component reads it
'use client';
function Comments({ commentsPromise }) {
  const comments = use(commentsPromise);
  return comments.map(c => <p key={c.id}>{c.text}</p>);
}
```

```jsx
function Heading({ show }) {
  if (!show) return null;
  const theme = use(ThemeContext);   // conditional context read — allowed
  return <h1 className={theme}>Hi</h1>;
}
```

**Watch out.** Don't create the promise inside the Client Component during render — every render creates a new promise and it suspends forever. Promises passed to `use` must be cached: created in a Server Component, a loader, or a data library.

---

## Q37. What are Actions?

**Short answer.** In React 19, an Action is an async function used as a transition. React tracks its pending state, errors, and optimistic updates for you. You can pass an Action to `<form action>`, `startTransition`, `useActionState`, or `useOptimistic`.

**Explanation.** Before:

```jsx
const [isPending, setIsPending] = useState(false);
const [error, setError] = useState(null);

async function handleSubmit(e) {
  e.preventDefault();
  setIsPending(true);
  const err = await updateName(name);
  setIsPending(false);
  if (err) setError(err);
}
```

After:

```jsx
const [isPending, startTransition] = useTransition();

function handleSubmit() {
  startTransition(async () => {
    const err = await updateName(name);
    if (err) {
      startTransition(() => setError(err));
    }
  });
}
```

`isPending` is true for the whole async function. Updates inside it are batched and committed when it finishes.

**Watch out.** State updates after an `await` inside a transition need their own `startTransition` wrapper to be marked as transitions (shown above). This is a known limitation interviewers sometimes probe.

---

## Q38. `useActionState`, `useFormStatus`, and form actions

**Short answer.** `<form action={fn}>` calls `fn(formData)` on submit, resets uncontrolled fields on success, and treats it as an Action. `useActionState` wraps an action and gives you its last result and pending flag. `useFormStatus` lets a child of a form read whether the form is submitting.

**Explanation.**

```jsx
async function signup(prevState, formData) {
  const email = formData.get('email');
  if (!email.includes('@')) return { error: 'Invalid email' };
  await createAccount(email);
  return { error: null };
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, { error: null });
  return (
    <form action={formAction}>
      <input name="email" />
      <SubmitButton />
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();   // reads the parent <form>
  return <button disabled={pending}>{pending ? 'Saving…' : 'Sign up'}</button>;
}
```

With a framework that supports Server Functions, `signup` can be a `'use server'` function and the form works even before JavaScript loads (progressive enhancement).

**Watch out.** `useFormStatus` only reads the status of a `<form>` that is a *parent* of the component calling it — not a form rendered in the same component.

---

## Q39. What is `useOptimistic`?

**Short answer.** It shows a temporary, optimistic value while an Action is in flight, and automatically reverts to the real state when the Action finishes or fails.

**Explanation.**

```jsx
function Thread({ messages, sendMessage }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, text) => [...state, { text, sending: true }]
  );

  async function action(formData) {
    const text = formData.get('text');
    addOptimistic(text);
    await sendMessage(text);   // parent updates `messages` on success
  }

  return (
    <>
      {optimistic.map((m, i) => (
        <p key={i} style={{ opacity: m.sending ? 0.5 : 1 }}>{m.text}</p>
      ))}
      <form action={action}><input name="text" /></form>
    </>
  );
}
```

**Watch out.** Optimistic UI must be honest about failure. If `sendMessage` throws, the optimistic item disappears — show an error so the user knows their message didn't send.

---

## Q40. What else changed in React 19?

**Short answer.** `ref` is a regular prop for function components (no more `forwardRef`), `<Context>` can be used as a provider, ref callbacks can return cleanup functions, document metadata (`<title>`, `<meta>`, `<link>`) can be rendered anywhere and is hoisted to `<head>`, and hydration errors are reported as a single readable diff.

**Explanation.**

```jsx
// ref as a prop — forwardRef no longer needed
function TextInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// ref callback cleanup
<div ref={node => {
  const observer = new ResizeObserver(onResize);
  observer.observe(node);
  return () => observer.disconnect();
}} />

// metadata from any component
function BlogPost({ post }) {
  return (
    <article>
      <title>{post.title}</title>
      <meta name="description" content={post.summary} />
      <h1>{post.title}</h1>
    </article>
  );
}
```

Also: stylesheet and script deduplication with `precedence`, resource preloading APIs (`preload`, `preinit`), and full support for custom elements. React 19.2 added `<Activity>` to hide parts of the UI while preserving their state, and stabilized `useEffectEvent`.

**Watch out.** Removed in 19: `propTypes` and `defaultProps` on function components (use default parameters), string refs, legacy context, `ReactDOM.render` (use `createRoot`), and `ReactDOM.hydrate` (use `hydrateRoot`).

---

# Part 7 — Server Rendering and Server Components

## Q41. CSR vs SSR vs SSG vs ISR

**Short answer.** CSR renders in the browser after JavaScript loads. SSR renders HTML on the server per request. SSG renders HTML at build time. ISR is SSG that regenerates pages in the background after a time or on demand.

**Explanation.**

| | When HTML is made | First paint | Freshness | Server cost |
|---|---|---|---|---|
| CSR | In browser | Slow (after JS) | Always fresh | None |
| SSR | Each request | Fast | Always fresh | Per request |
| SSG | Build time | Fastest (CDN) | Stale until rebuild | None at runtime |
| ISR | Build + periodic regen | Fastest (CDN) | Bounded staleness | Occasional |

Pick by page: marketing and docs → SSG; product pages → ISR; dashboards behind login → CSR or SSR; personalized feeds → SSR with streaming.

**Watch out.** SSR shows content sooner but the page isn't interactive until hydration finishes. A big JS bundle still means a slow time to interactive — SSR alone doesn't fix that.

---

## Q42. What is hydration, and what causes a hydration mismatch?

**Short answer.** Hydration is React attaching event handlers and state to server-rendered HTML instead of re-creating it. A mismatch happens when the first client render produces different output than the server did.

**Explanation.** Common causes:

- `Date.now()`, `new Date().toLocaleString()`, `Math.random()` in render
- `typeof window !== 'undefined'` branches that render differently
- Reading `localStorage` during render
- Invalid HTML nesting (`<div>` inside `<p>`, `<a>` inside `<a>`) that the browser "fixes"
- Browser extensions injecting attributes

Fix for client-only values: render the server-safe version first, then update after mount.

```jsx
function LocalTime({ iso }) {
  const [text, setText] = useState(null);
  useEffect(() => setText(new Date(iso).toLocaleTimeString()), [iso]);
  return <time dateTime={iso}>{text ?? iso}</time>;
}
```

**Watch out.** `suppressHydrationWarning` silences the warning on one element's text — it doesn't fix the mismatch, and it only goes one level deep. Use it sparingly, for things like timestamps.

---

## Q43. What are React Server Components?

**Short answer.** Server Components run only on the server (at request or build time). They can be `async`, read databases and files directly, and send their *rendered output* — not their code — to the client. Their dependencies never enter the JS bundle.

**Explanation.**

```jsx
// app/products/page.jsx — Server Component (the default in RSC frameworks)
import db from '@/lib/db';
import AddToCart from './AddToCart';

export default async function ProductsPage() {
  const products = await db.product.findMany();
  return products.map(p => (
    <article key={p.id}>
      <h2>{p.name}</h2>
      <AddToCart productId={p.id} />     {/* Client Component island */}
    </article>
  ));
}
```

| | Server Component | Client Component |
|---|---|---|
| Runs | Server only | Server (SSR) + client |
| `useState`, `useEffect`, event handlers | No | Yes |
| `async` / direct DB access | Yes | No |
| Code shipped to browser | No | Yes |

**Watch out.** RSC is not the same as SSR. SSR turns any component into HTML for the first load; Client Components still hydrate and ship their code. Server Components produce a serialized tree that also works on client-side navigation, and their code never ships.

---

## Q44. What do `'use client'` and `'use server'` mean?

**Short answer.** `'use client'` marks a module as the boundary where the tree crosses from server to client — that module and everything it imports become Client Components. `'use server'` marks functions as Server Functions that the client can call like an RPC.

**Explanation.**

```jsx
// AddToCart.jsx
'use client';
import { addToCart } from './actions';

export default function AddToCart({ productId }) {
  const [added, setAdded] = useState(false);
  return <button onClick={async () => { await addToCart(productId); setAdded(true); }}>Add</button>;
}

// actions.js
'use server';
export async function addToCart(productId) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  await db.cart.add(session.userId, productId);
}
```

Rules worth knowing:

- Props from Server to Client Components must be serializable — no functions (except Server Functions), no class instances.
- A Client Component can render a Server Component only if it receives it as `children` or another prop.
- `'use client'` is not needed in every client file — only at the entry of the client subtree.

**Watch out.** A Server Function is a **public HTTP endpoint**. Anyone can call it with any arguments. Always authenticate, authorize, and validate input inside it — never trust that only your form calls it.

---

## Q45. What is streaming SSR?

**Short answer.** Instead of waiting for the whole page to render, the server sends HTML in chunks as each Suspense boundary resolves. The shell shows immediately; slower sections stream in and hydrate independently.

**Explanation.** With `renderToPipeableStream` (Node) or `renderToReadableStream` (web streams), React sends the shell plus fallbacks first, then later sends the content for each boundary with a small inline script that swaps it into place.

Benefits: faster first byte and first paint, slow data doesn't block fast data, and **selective hydration** — React hydrates the part the user interacts with first.

**Watch out.** Once the first byte is sent, the status code and headers are fixed. Errors in streamed sections can't turn into a 500 or a redirect — handle them with error boundaries, and do auth checks before the shell renders.

---

# Part 8 — Component Patterns

## Q46. Composition vs inheritance

**Short answer.** React favors composition: build complex components by combining simpler ones and passing elements through `children` or other props. Inheritance between components is practically never used.

**Explanation.**

```jsx
function Dialog({ title, children, footer }) {
  return (
    <div role="dialog" aria-labelledby="dlg-title">
      <h2 id="dlg-title">{title}</h2>
      <div>{children}</div>
      <footer>{footer}</footer>
    </div>
  );
}

<Dialog title="Delete file?" footer={<><Button>Cancel</Button><Button danger>Delete</Button></>}>
  This cannot be undone.
</Dialog>
```

"Specialization" is done by wrapping, not extending: `function DeleteDialog(props) { return <Dialog title="Delete?" {...props} /> }`.

**Watch out.** A component with ten boolean props (`isCompact`, `hasIcon`, `showFooter`, …) is a sign composition was skipped. Prefer slots (`icon={<Icon />}`) or compound components.

---

## Q47. What are compound components?

**Short answer.** A set of components that work together and share implicit state through context — like `<select>` and `<option>`. The parent owns state; children read it. Users control layout and order.

**Explanation.**

```jsx
const TabsContext = createContext(null);

function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext value={{ value, setValue }}>{children}</TabsContext>;
}

function Tab({ value, children }) {
  const ctx = useContext(TabsContext);
  return (
    <button role="tab" aria-selected={ctx.value === value} onClick={() => ctx.setValue(value)}>
      {children}
    </button>
  );
}

function Panel({ value, children }) {
  const ctx = useContext(TabsContext);
  return ctx.value === value ? <div role="tabpanel">{children}</div> : null;
}

Tabs.Tab = Tab;
Tabs.Panel = Panel;

<Tabs defaultValue="a">
  <Tabs.Tab value="a">Account</Tabs.Tab>
  <Tabs.Tab value="b">Billing</Tabs.Tab>
  <Tabs.Panel value="a">…</Tabs.Panel>
  <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs>
```

Headless libraries (Radix, React Aria, Headless UI, Base UI) use this pattern.

**Watch out.** Throw a helpful error when a child is used outside its parent (`if (!ctx) throw new Error('Tab must be inside Tabs')`), otherwise users get a cryptic "cannot read properties of null".

---

## Q48. What is an error boundary?

**Short answer.** A component that catches JavaScript errors thrown while rendering its children, logs them, and shows fallback UI instead of unmounting the whole app. It must be a class component (or use a library like `react-error-boundary`).

**Explanation.**

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, info.componentStack);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

<ErrorBoundary fallback={<p>Something went wrong.</p>}>
  <Widget />
</ErrorBoundary>
```

Error boundaries do **not** catch errors in: event handlers, async code (`setTimeout`, promise callbacks outside render), server rendering, or the boundary itself.

**Watch out.** Place boundaries at meaningful granularity — around routes and independent widgets — so one broken chart doesn't blank the dashboard. React 19 adds `onCaughtError` and `onUncaughtError` options on `createRoot` for central reporting.

---

## Q49. HOCs vs render props vs hooks

**Short answer.** All three share logic between components. Hooks replaced HOCs and render props for most use cases because they don't add wrapper components, don't collide on prop names, and make data flow explicit.

**Explanation.**

```jsx
// HOC — wraps a component, injects props
const withUser = Comp => props => <Comp {...props} user={useUser()} />;

// Render prop — a function child decides what to render
<MouseTracker>{({ x, y }) => <Cursor x={x} y={y} />}</MouseTracker>

// Hook — just call it
function Cursor() {
  const { x, y } = useMousePosition();
  return <div style={{ left: x, top: y }} />;
}
```

| Problem | HOC | Render prop | Hook |
|---|---|---|---|
| Wrapper hell in DevTools | Yes | Yes | No |
| Prop name collisions | Yes | No | No |
| Obvious data source | No | Yes | Yes |

**Watch out.** HOCs are still reasonable for cross-cutting wrapping that isn't about data — e.g. adding an error boundary or auth gate around a route component. Render props survive in libraries that control *what* renders (virtualized lists, form libraries).

---

## Q50. What are portals?

**Short answer.** `createPortal(children, domNode)` renders children into a different DOM node — typically `document.body` — while keeping them in the same place in the React tree. Used for modals, tooltips, and toasts that must escape `overflow: hidden` or `z-index` stacking.

**Explanation.**

```jsx
function Modal({ children, onClose }) {
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

Context, state, and **event bubbling** follow the React tree, not the DOM tree. A click inside the portal bubbles to React ancestors of `<Modal>` even though the DOM node is elsewhere.

**Watch out.** Portals don't make a modal accessible. You still need focus trapping, `Escape` to close, returning focus to the trigger, and `inert` on the background. The native `<dialog>` element with `showModal()` now handles most of that for you.

---

# Part 9 — Forms and Data Fetching

## Q51. What's wrong with fetching data in `useEffect`, and how do you do it correctly?

**Short answer.** The naive version has a race condition — a slow earlier response can overwrite a newer one — and it re-implements caching, deduplication, and retries badly. If you must use an effect, add cleanup that ignores or aborts stale requests.

**Explanation.**

```jsx
// Bug: type "re" then "react" — if "re" resolves last, it wins
useEffect(() => {
  fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
}, [query]);

// Fix: abort stale requests
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setResults)
    .catch(err => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, [query]);
```

Other effect-fetching problems: network waterfalls (parent fetches, renders child, child fetches), no caching across navigation, nothing rendered on the server.

Preferred options, in order: framework data loading (Server Components, route loaders), a server-state library (TanStack Query, SWR), then a carefully written effect.

**Watch out.** Interviewers love the race-condition question. Be ready to write the abort version from memory.

---

## Q52. How do you build a form with validation?

**Short answer.** For simple forms, React 19 form Actions with `useActionState` plus HTML validation attributes. For complex forms — many fields, dynamic arrays, cross-field rules — a form library (React Hook Form, TanStack Form) with a schema validator (Zod, Valibot). Always validate again on the server.

**Explanation.**

```jsx
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit(login)} noValidate>
      <input type="email" {...register('email')} aria-invalid={!!errors.email} />
      {errors.email && <p role="alert">{errors.email.message}</p>}
      <input type="password" {...register('password')} />
      <button disabled={isSubmitting}>Log in</button>
    </form>
  );
}
```

React Hook Form uses uncontrolled inputs under the hood, so typing doesn't re-render the whole form.

**Watch out.** Client validation is a UX feature, not a security feature. The same schema should run on the server, and server errors (e.g. "email already taken") must be shown on the right field.

---

## Q53. How do you debounce a search input in React?

**Short answer.** Keep the input's value as immediate state, and derive a debounced copy that drives the expensive work. Either a small `useDebouncedValue` hook, or `useDeferredValue` if the cost is rendering rather than network.

**Explanation.**

```jsx
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Search() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q);
  const { data } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => search(debouncedQ),
    enabled: debouncedQ.length > 1,
  });
  return <input value={q} onChange={e => setQ(e.target.value)} />;
}
```

**Watch out.** Writing `const debounced = debounce(fn, 300)` in the component body creates a new debouncer each render, so it never actually debounces. If you use a debounce utility, keep it stable with `useMemo` or `useRef`.

---

# Part 10 — Testing

## Q54. How do you test React components?

**Short answer.** With React Testing Library and a test runner (Vitest or Jest): render the component, interact with it the way a user would, and assert on what the user sees. Don't test implementation details like state values or which hooks were called.

**Explanation.**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('adds a todo', async () => {
  const user = userEvent.setup();
  render(<TodoApp />);

  await user.type(screen.getByRole('textbox', { name: /new todo/i }), 'Buy milk');
  await user.click(screen.getByRole('button', { name: /add/i }));

  expect(screen.getByRole('listitem')).toHaveTextContent('Buy milk');
});
```

Query priority: `getByRole` → `getByLabelText` → `getByText` → `getByTestId` as a last resort. Role-based queries double as an accessibility check.

A balanced test strategy: many component/integration tests, some unit tests for pure logic (reducers, utilities), a few end-to-end tests (Playwright) for critical user flows.

**Watch out.** Prefer `userEvent` over `fireEvent` — it simulates the full sequence (focus, keydown, input, keyup) a real user produces. And `getBy*` throws if nothing matches; use `queryBy*` to assert something is *absent*.

---

## Q55. How do you test async behavior and API calls?

**Short answer.** Mock the network, not your modules — Mock Service Worker (MSW) intercepts requests at the network layer. Use `findBy*` queries, which wait for elements to appear.

**Explanation.**

```jsx
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/user', () => HttpResponse.json({ name: 'Ana' }))
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('shows the user name', async () => {
  render(<Profile />);
  expect(await screen.findByText('Ana')).toBeInTheDocument();
});

test('shows an error', async () => {
  server.use(http.get('/api/user', () => new HttpResponse(null, { status: 500 })));
  render(<Profile />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i);
});
```

**Watch out.** "not wrapped in act(...)" warnings usually mean a state update happened after the test finished asserting. The fix is to await the final UI state (`findBy*`, `waitFor`), not to sprinkle `act` everywhere.

---

## Q56. How do you test a custom hook?

**Short answer.** Through a component that uses it, if possible. For reusable hooks, use `renderHook` from React Testing Library.

**Explanation.**

```jsx
import { renderHook, act } from '@testing-library/react';

test('counter increments', () => {
  const { result } = renderHook(() => useCounter(5));
  act(() => result.current.increment());
  expect(result.current.count).toBe(6);
});

test('debounced value updates after the delay', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
    initialProps: { value: 'a' },
  });
  rerender({ value: 'b' });
  expect(result.current).toBe('a');
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe('b');
  vi.useRealTimers();
});
```

Hooks that need context are tested by passing a `wrapper` option that renders the providers.

**Watch out.** If a hook is only used by one component, testing it in isolation couples tests to an internal detail. Test the component instead.

---

# Part 11 — Security and Accessibility

## Q57. How does React protect against XSS, and where are the gaps?

**Short answer.** React escapes every string rendered as text or attribute, so `<div>{userInput}</div>` is safe. The gaps are anything that bypasses escaping: `dangerouslySetInnerHTML`, `javascript:` URLs in `href`, spreading untrusted objects as props, and server data injected into inline scripts.

**Explanation.**

```jsx
// Safe — escaped
<p>{comment.text}</p>

// Dangerous — raw HTML
<div dangerouslySetInnerHTML={{ __html: comment.html }} />
// Fix: sanitize first
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.html) }} />

// Dangerous — javascript: URL
<a href={user.website}>Website</a>   // "javascript:alert(1)"
// Fix: allow only http(s)
const safe = /^https?:\/\//i.test(user.website) ? user.website : '#';

// Dangerous — attacker controls props
<div {...JSON.parse(untrusted)} />   // could inject dangerouslySetInnerHTML
```

Defense in depth: a Content Security Policy, auth tokens in `HttpOnly` cookies rather than `localStorage`, and authorization checks on the server (especially in Server Functions — Q44).

**Watch out.** React warns about `javascript:` URLs in development, but don't rely on it. Validate URL schemes yourself.

---

## Q58. How do you make a React app accessible?

**Short answer.** Use semantic HTML first, label every control, manage focus on route changes and in dialogs, make everything keyboard-operable, and test with a screen reader and an automated checker. React doesn't add accessibility — it just doesn't get in the way.

**Explanation.** The checklist interviewers look for:

- `<button>` for actions, `<a href>` for navigation — never a clickable `<div>`.
- Every input has a `<label htmlFor>` (or `aria-label` when there's no visible label). `useId` for IDs.
- Images have meaningful `alt`, or `alt=""` if decorative.
- Error messages use `role="alert"` or `aria-live` so screen readers announce them.
- On client-side route change, move focus to the main heading and update `document.title`.
- Modals trap focus, close on `Escape`, and return focus to the trigger.
- Color contrast meets WCAG AA (4.5:1 for body text).
- `eslint-plugin-jsx-a11y` in CI, axe in tests, plus manual keyboard and screen-reader passes.

```jsx
// Bad
<div onClick={save}>Save</div>

// Good — focusable, keyboard-operable, announced as a button
<button type="button" onClick={save}>Save</button>
```

**Watch out.** ARIA can make things worse. "No ARIA is better than bad ARIA" — a `role="button"` on a `<div>` still needs `tabIndex`, Enter and Space handling, and focus styles. The native element gives you all of that for free.

---

# Part 12 — Rapid-Fire and Code Puzzles

## Q59. What does this log after one click?

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount(count + 1);
    setCount(count + 1);
    console.log(count);
  }
  return <button onClick={handleClick}>{count}</button>;
}
```

<details><summary>Answer</summary>

Logs `0`, and the button then shows `1`. `count` is a snapshot of the current render (0), so both calls set it to `0 + 1`. The log reads the same snapshot. Use `setCount(c => c + 1)` twice to get 2.
</details>

---

## Q60. What does this render?

```jsx
function Cart({ items }) {
  return <div>{items.length && <p>{items.length} items</p>}</div>;
}
<Cart items={[]} />
```

<details><summary>Answer</summary>

It renders `0`. `0 && …` evaluates to `0`, and React renders numbers. Use `items.length > 0 && …` or a ternary. (`false`, `null`, and `undefined` render nothing; `0` and `NaN` do render.)
</details>

---

## Q61. Why does this effect run in an infinite loop?

```jsx
function Users({ filter }) {
  const [users, setUsers] = useState([]);
  const options = { filter, limit: 20 };

  useEffect(() => {
    fetchUsers(options).then(setUsers);
  }, [options]);
}
```

<details><summary>Answer</summary>

`options` is a new object on every render, so the dependency always "changes". Each fetch sets state, which re-renders, which creates a new `options`, which re-runs the effect. Fix: move the object inside the effect and depend on `[filter]`.
</details>

---

## Q62. Spot the bug.

```jsx
function Timer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setInterval(() => setSeconds(seconds + 1), 1000);
  }, []);
  return <p>{seconds}</p>;
}
```

<details><summary>Answer</summary>

Two bugs. First, a stale closure: `seconds` is always `0` inside the interval, so the display stops at `1`. Use `setSeconds(s => s + 1)`. Second, no cleanup: the interval keeps running after unmount, and Strict Mode creates two of them. Store the id and return `() => clearInterval(id)`.
</details>

---

## Q63. What's wrong with this state update?

```jsx
function addTag(tag) {
  post.tags.push(tag);
  setPost(post);
}
```

<details><summary>Answer</summary>

It mutates state and passes the same reference back. `Object.is(post, post)` is true, so React bails out and nothing re-renders. Create new objects: `setPost(p => ({ ...p, tags: [...p.tags, tag] }))`.
</details>

---

## Q64. Why does this input lose focus on every keystroke?

```jsx
function Form() {
  const [name, setName] = useState('');
  const Field = () => <input value={name} onChange={e => setName(e.target.value)} />;
  return <Field />;
}
```

<details><summary>Answer</summary>

`Field` is defined inside `Form`, so each render creates a new component type. React sees a different type at that position, unmounts the old input, and mounts a new one — losing focus. Define `Field` outside `Form` and pass props, or inline the `<input>`.
</details>

---

## Q65. Why is this a security problem?

```jsx
'use server';
export async function deletePost(postId) {
  await db.post.delete({ where: { id: postId } });
}
```

<details><summary>Answer</summary>

A Server Function is a public endpoint. Anyone can call it with any `postId` — no authentication and no ownership check. Verify the session and scope the delete: `where: { id: postId, authorId: session.userId }`, and validate `postId` with a schema.
</details>

---

## Q66. Quick definitions

| Term | One line |
|---|---|
| **JSX** | Syntax that compiles to `jsx()` calls creating React elements |
| **Element** | Plain object describing what to render — cheap, immutable |
| **Component** | Function that takes props and returns elements |
| **Reconciliation** | Diffing the new element tree against the previous one |
| **Fiber** | Internal unit of work that makes rendering interruptible |
| **Hydration** | Attaching React to server-rendered HTML |
| **Strict Mode** | Dev-only checks that double-invoke renders and effects |
| **Transition** | Non-urgent update that can be interrupted |
| **Suspense** | Boundary that shows a fallback while children aren't ready |
| **Action** | Async function run in a transition with tracked pending state |
| **Server Component** | Component that runs only on the server; its code never ships |
| **Server Function** | `'use server'` function callable from the client — a public endpoint |
| **React Compiler** | Build-time tool that auto-memoizes components and hooks |
| **Portal** | Renders children into a different DOM node |
| **Prop drilling** | Passing props through components that don't use them |

---

# Appendix — A 10-day study plan

| Day | Focus | Prove it by |
|---|---|---|
| 1 | JSX, components, props vs state, keys | Building a todo list with stable keys and explaining the index-key bug |
| 2 | Rendering, reconciliation, batching, Strict Mode | Predicting re-renders in a 3-level tree before checking the Profiler |
| 3 | `useState`, `useEffect`, cleanup, dependencies | Writing a fetch-with-abort and an interval timer with no stale closures |
| 4 | `useRef`, `useReducer`, context, custom hooks | Extracting a `useChatRoom` hook and a reducer-driven form |
| 5 | State architecture — local, lifted, URL, server state | Moving API data from `useState` to TanStack Query |
| 6 | Performance — memo, compiler, splitting, virtualization | Cutting re-renders on a 10k-row list and measuring before/after |
| 7 | Concurrent features — Suspense, transitions, `use` | A search page that stays responsive while filtering heavy results |
| 8 | React 19 — Actions, `useActionState`, `useOptimistic` | A form with server validation, pending UI, and an optimistic list |
| 9 | SSR, hydration, Server Components, Server Functions | A Next.js page with server data, a client island, and a secured action |
| 10 | Patterns, testing, security, accessibility | Testing a compound component with RTL + MSW and passing axe |

---

## Final note

The questions that separate a good React answer from a memorized one are almost always about **render as a pure snapshot** and **effects as synchronization**. If you can explain why `count` doesn't change after calling `setCount`, and why most `useEffect` calls in a codebase shouldn't exist, you understand React.
