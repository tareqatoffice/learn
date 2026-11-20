import type { ReactNode } from "react";
import { check, mount, typeInto, until, wait } from "../harness";
import type { Group } from "../harness";
import { AsyncText, FilterList, LikeButton, SubmitButton, SubscribeForm } from "./react-concurrent";

function gate(): { promise: Promise<void>; open: () => void; fail: () => void } {
  let open: () => void = () => {};
  let fail: () => void = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    open = resolve;
    fail = () => reject(new Error("rejected"));
  });
  return { promise, open, fail };
}

const textOf = (root: Element, selector: string): string | null | undefined => root.querySelector(selector)?.textContent;

function ActionForm({ action, label }: { action: () => Promise<void>; label: string }): ReactNode {
  return (
    <form action={action}>
      <SubmitButton label={label} />
    </form>
  );
}

export const reactConcurrent: Group = {
  slug: "react-concurrent",
  title: "React Concurrent",
  level: "Advanced",
  file: "coding/problems/react-concurrent/react-concurrent.tsx",
  questions: [
    {
      name: "AsyncText",
      checks: [
        check("Shows the fallback, then the value", async () => {
          let resolve: (value: string) => void = () => {};
          const promise = new Promise<string>((done) => {
            resolve = done;
          });
          const view = await mount(<AsyncText promise={promise} />);
          const before = view.container.textContent;
          resolve("Loaded");
          const after = await until(() => textOf(view.container, "p") === "Loaded", 1000);
          view.unmount();
          return (before === "Loading…" && after === true) || `showed "${before}"`;
        }),
      ],
    },
    {
      name: "LikeButton",
      checks: [
        check("Shows the new count while saving, then the prop", async () => {
          const save = gate();
          const view = await mount(<LikeButton likes={3} onLike={() => save.promise} />);
          const button = view.container.querySelector("button");
          if (!button) return "no button";
          const before = button.textContent;
          await view.act(() => button.click());
          const during = button.textContent;
          await view.rerender(<LikeButton likes={4} onLike={() => save.promise} />);
          save.open();
          await wait(20);
          await view.act();
          const after = button.textContent;
          view.unmount();
          if (!before?.includes("3")) return `started at "${before}"`;
          if (!during?.includes("4")) return `showed "${during}" while saving`;
          return after?.includes("4") || `ended at "${after}"`;
        }),
        check("Falls back when saving fails", async () => {
          const save = gate();
          const view = await mount(<LikeButton likes={3} onLike={() => save.promise.catch(() => {})} />);
          const button = view.container.querySelector("button");
          if (!button) return "no button";
          await view.act(() => button.click());
          save.fail();
          await wait(20);
          await view.act();
          const after = button.textContent;
          view.unmount();
          return after?.includes("3") || `ended at "${after}"`;
        }),
      ],
    },
    {
      name: "SubscribeForm",
      checks: [
        check("Disables the button while pending and shows success", async () => {
          const save = gate();
          const seen: string[] = [];
          const subscribe = async (email: string): Promise<null> => {
            seen.push(email);
            await save.promise;
            return null;
          };
          const view = await mount(<SubscribeForm subscribe={subscribe} />);
          const input = view.container.querySelector("input");
          const button = view.container.querySelector("button");
          if (!input || !button) return "the form needs an input and a button";
          input.value = "a@b.co";
          await view.act(() => button.click());
          const pending = await until(() => button.disabled, 500);
          save.open();
          const done = await until(() => textOf(view.container, "[role=status]") === "Subscribed", 1000);
          view.unmount();
          if (!pending) return "the button was not disabled";
          if (seen.join() !== "a@b.co") return `subscribe got ${seen.join()}`;
          return done === true || "no success message";
        }),
        check("Shows the error message", async () => {
          const view = await mount(<SubscribeForm subscribe={async () => "Bad email"} />);
          await view.act(() => view.container.querySelector("button")?.click());
          const shown = await until(() => textOf(view.container, "[role=alert]") === "Bad email", 1000);
          view.unmount();
          return shown === true || "no error message";
        }),
      ],
    },
    {
      name: "SubmitButton",
      checks: [
        check("Shows its label when idle", async () => {
          const view = await mount(<ActionForm action={async () => {}} label="Save" />);
          const text = view.container.textContent;
          view.unmount();
          return text === "Save" || `got ${text}`;
        }),
        check("Shows the pending state of the form", async () => {
          const save = gate();
          const view = await mount(<ActionForm action={() => save.promise} label="Save" />);
          const button = view.container.querySelector("button");
          if (!button) return "no button";
          await view.act(() => button.click());
          const pending = await until(() => button.disabled && button.textContent === "Saving…", 500);
          save.open();
          const idle = await until(() => !button.disabled && button.textContent === "Save", 1000);
          view.unmount();
          return (pending === true && idle === true) || `pending ${pending}, idle ${idle}`;
        }),
      ],
    },
    {
      name: "FilterList",
      checks: [
        check("Keeps the input current and filters the list", async () => {
          const view = await mount(<FilterList items={["apple", "pear"]} />);
          const input = view.container.querySelector("input");
          if (!input) return "no input";
          await view.act(() => typeInto(input, "pe"));
          const value = input.value;
          const filtered = await until(() => view.container.querySelectorAll("li").length === 1, 1000);
          const text = textOf(view.container, "li");
          view.unmount();
          return (value === "pe" && filtered === true && text === "pear") || `input "${value}", first row "${text}"`;
        }),
        check("aria-busy clears once the list is current", async () => {
          const view = await mount(<FilterList items={["apple"]} />);
          const input = view.container.querySelector("input");
          if (!input) return "no input";
          await view.act(() => typeInto(input, "a"));
          const settled = await until(() => view.container.querySelector("ul")?.getAttribute("aria-busy") !== "true", 1000);
          view.unmount();
          return settled === true || "the list stayed busy";
        }),
      ],
    },
  ],
};
