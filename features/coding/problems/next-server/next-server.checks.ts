import { fetchPage, routeCheck, typeInto, until, withFrame } from "../harness";
import type { Group } from "../harness";

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const unique = (): string => `note ${Date.now()}`;

function formParts(doc: Document): { input: HTMLInputElement; button: HTMLButtonElement } | null {
  const input = doc.querySelector<HTMLInputElement>("form input:not([type=hidden])");
  const button = doc.querySelector<HTMLButtonElement>("form button");
  return input && button ? { input, button } : null;
}

const row = (doc: Document, text: string): HTMLElement | undefined =>
  [...doc.querySelectorAll("li")].find((li) => li.textContent?.includes(text));

export const nextServer: Group = {
  slug: "next-server",
  title: "Next.js Server",
  level: "Advanced",
  file: "app/sandbox/ and app/api/sandbox/",
  questions: [
    {
      name: "Comment form",
      href: "/sandbox/comments",
      spec: `Create app/sandbox/comments/page.tsx, a Server Component that shows listComments from coding/lib/comments.ts, plus app/sandbox/comments/actions.ts with a server action, and a Client Component form. Keep "use client" as low as you can.

- The form has one text input and one submit button. Comments render in \`li\` elements
- Trim the text and require 3 to 200 characters. On a bad length show an inline error with role="alert" (state "invalid" from CommentFormState)
- addComment takes about 800 ms and rejects if the text contains "fail". Show that with role="alert" too (state "failed") without crashing the page
- On any error, keep the text the user typed in the field
- Use useActionState for the form state and pending flag, and disable the button while pending
- Use useOptimistic: the new comment appears at once with \`data-pending\` on its \`li\`, is removed if the save fails, and the list shows saved data after success
- Revalidate the path after a successful save`,
      checks: [
        routeCheck("Lists stored comments on the server", async () => {
          const { text } = await fetchPage("/sandbox/comments");
          return text.includes("First comment") || "the stored comment is missing";
        }),
        routeCheck("A short comment shows an inline error and keeps the text", () =>
          withFrame("/sandbox/comments", async (doc) => {
            const form = await until(() => formParts(doc), 5000);
            if (!form) return "the page needs a form with an input and a button";
            typeInto(form.input, "ab");
            form.button.click();
            const alert = await until(() => doc.querySelector("main [role=alert], form [role=alert]"), 3000);
            return (alert !== null && formParts(doc)?.input.value === "ab") || `input holds "${formParts(doc)?.input.value}"`;
          }),
        ),
        routeCheck("A new comment is optimistic, then saved", () =>
          withFrame("/sandbox/comments", async (doc) => {
            const form = await until(() => formParts(doc), 5000);
            if (!form) return "the page needs a form with an input and a button";
            const text = unique();
            typeInto(form.input, text);
            form.button.click();
            const pending = await until(() => row(doc, text)?.hasAttribute("data-pending"), 500);
            if (!pending) return "the comment did not appear at once with data-pending";
            if (!form.button.disabled) return "the button is not disabled while pending";
            const saved = await until(() => {
              const li = row(doc, text);
              return li && !li.hasAttribute("data-pending");
            }, 12000);
            return saved === true || "the comment did not settle";
          }),
        ),
        routeCheck("A failed save removes the comment and keeps the text", () =>
          withFrame("/sandbox/comments", async (doc) => {
            const form = await until(() => formParts(doc), 5000);
            if (!form) return "the page needs a form with an input and a button";
            const text = `please fail ${Date.now()}`;
            typeInto(form.input, text);
            form.button.click();
            const alert = await until(() => doc.querySelector("main [role=alert], form [role=alert]"), 4000);
            if (!alert) return "no error shown";
            return (!row(doc, text) && formParts(doc)?.input.value === text) || `input holds "${formParts(doc)?.input.value}"`;
          }),
        ),
      ],
    },
    {
      name: "Todos API",
      href: "/api/sandbox/todos",
      spec: `Create app/api/sandbox/todos/route.ts using listTodos and addTodo from coding/lib/todos.ts.

- GET returns all todos as JSON. \`?done=true\` or \`?done=false\` filters them
- POST reads a JSON body \`{ title }\`, trims the title, and responds 201 with the new todo
- A POST with a missing, blank or non-string title responds 400 with \`{ error }\`
- A POST with a body that is not JSON responds 400 with \`{ error }\` too`,
      checks: [
        routeCheck("GET returns JSON", async () => {
          const response = await fetch("/api/sandbox/todos");
          if (!response.ok) return `status ${response.status}`;
          const body: unknown = await response.json();
          return (Array.isArray(body) && body.length > 0) || "expected a list of todos";
        }),
        routeCheck("GET filters by done", async () => {
          const response = await fetch("/api/sandbox/todos?done=false");
          if (!response.ok) return `status ${response.status}`;
          const body: { done: boolean }[] = await response.json();
          return body.every((todo) => todo.done === false) || "the filter is wrong";
        }),
        routeCheck("POST creates a todo with a trimmed title", async () => {
          const response = await fetch("/api/sandbox/todos", json({ title: "  Buy milk " }));
          if (response.status !== 201) return `status ${response.status}`;
          const body: { title?: string; id?: string } = await response.json();
          if (body.id) await fetch(`/api/sandbox/todos/${body.id}`, { method: "DELETE" });
          return body.title === "Buy milk" || `title "${body.title}"`;
        }),
        routeCheck("POST rejects a bad title with 400", async () => {
          for (const body of [{}, { title: "  " }, { title: 5 }]) {
            const response = await fetch("/api/sandbox/todos", json(body));
            if (response.status !== 400) return `${JSON.stringify(body)} gave ${response.status}`;
            const parsed: { error?: string } = await response.json();
            if (!parsed.error) return "the response needs an error";
          }
          return true;
        }),
        routeCheck("POST rejects a non-JSON body with 400", async () => {
          const response = await fetch("/api/sandbox/todos", { method: "POST", body: "oops" });
          return response.status === 400 || `status ${response.status}`;
        }),
      ],
    },
    {
      name: "Todo item API",
      href: "/api/sandbox/todos/t0",
      spec: `Create app/api/sandbox/todos/[id]/route.ts using getTodo and deleteTodo from coding/lib/todos.ts. Type the context with the global RouteContext helper.

- GET returns the todo, or 404 with \`{ error }\`
- DELETE responds 204 with no body, or 404 with \`{ error }\``,
      checks: [
        routeCheck("GET returns one todo", async () => {
          const response = await fetch("/api/sandbox/todos/t0");
          if (!response.ok) return `status ${response.status}`;
          const body: { id?: string } = await response.json();
          return body.id === "t0" || `got ${body.id}`;
        }),
        routeCheck("GET responds 404 with an error for an unknown id", async () => {
          const response = await fetch("/api/sandbox/todos/none");
          const type = response.headers.get("content-type") ?? "";
          return (response.status === 404 && type.includes("json")) || `status ${response.status}, ${type}`;
        }),
        routeCheck("DELETE removes a todo", async () => {
          const posted = await fetch("/api/sandbox/todos", json({ title: "Temporary" }));
          if (posted.status !== 201) return `POST gave ${posted.status}`;
          const created: { id: string } = await posted.json();
          const removed = await fetch(`/api/sandbox/todos/${created.id}`, { method: "DELETE" });
          const gone = await fetch(`/api/sandbox/todos/${created.id}`);
          return (removed.status === 204 && gone.status === 404) || `statuses ${removed.status}, ${gone.status}`;
        }),
      ],
    },
    {
      name: "Theme cookie",
      href: "/sandbox/theme",
      spec: `Create app/sandbox/theme/page.tsx, a Server Component.

- Read the \`theme\` cookie with cookies() from next/headers. It is "light" or "dark", and any other value means "light"
- Render a \`main\` with \`data-theme\` set to the theme
- Render a form with a button whose action is an inline or imported server action that flips the cookie (no client code). Set \`path: "/"\` on the cookie`,
      checks: [
        routeCheck("Defaults to light", async () => {
          document.cookie = "theme=; path=/; max-age=0";
          const { doc } = await fetchPage("/sandbox/theme");
          return doc.querySelector("main[data-theme=light]") !== null || "no main with data-theme=light";
        }),
        routeCheck("Treats an unknown cookie as light", async () => {
          document.cookie = "theme=blue; path=/";
          const { doc } = await fetchPage("/sandbox/theme");
          document.cookie = "theme=; path=/; max-age=0";
          return doc.querySelector("main[data-theme=light]") !== null || "no main with data-theme=light";
        }),
        routeCheck("The action flips the cookie and the page", () =>
          withFrame("/sandbox/theme", async (doc) => {
            const read = (): string | null | undefined => doc.querySelector("main")?.getAttribute("data-theme");
            const before = await until(read, 5000);
            doc.querySelector<HTMLButtonElement>("form button")?.click();
            const flipped = await until(() => {
              const theme = read();
              return theme && theme !== before;
            }, 5000);
            doc.querySelector<HTMLButtonElement>("form button")?.click();
            await until(() => read() === before, 5000);
            return flipped === true || "data-theme did not change";
          }),
        ),
      ],
    },
  ],
};
