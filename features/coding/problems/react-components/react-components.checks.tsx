import { useState } from "react";
import type { ReactNode } from "react";
import { check, mount, typeInto, wait } from "../harness";
import type { Group } from "../harness";
import { ErrorBoundary, Modal, TagInput, Tabs, VirtualList } from "./react-components";

const rows = (count: number): string[] => Array.from({ length: count }, (_, i) => `Row ${i}`);

const list = (count: number, height = 100): ReactNode => (
  <VirtualList items={rows(count)} rowHeight={20} height={height} renderRow={(item) => <span>{item}</span>} />
);

const pressKey = (target: EventTarget, key: string): void => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
};

const tabs = [
  { id: "a", label: "One", content: <p>First</p> },
  { id: "b", label: "Two", content: <p>Second</p> },
];

function byRole(root: ParentNode, role: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
}

function Bomb({ armed }: { armed: boolean }): ReactNode {
  if (armed) throw new Error("boom");
  return <p>Safe</p>;
}

function Recovering(): ReactNode {
  const [armed, setArmed] = useState<boolean>(true);
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <button
          onClick={() => {
            setArmed(false);
            reset();
          }}
        >
          {error.message}
        </button>
      )}
    >
      <Bomb armed={armed} />
    </ErrorBoundary>
  );
}

function ControlledTags({ initial }: { initial: string[] }): ReactNode {
  const [tags, setTags] = useState<string[]>(initial);
  return <TagInput tags={tags} onChange={setTags} />;
}

export const reactComponents: Group = {
  slug: "react-components",
  title: "React Components",
  level: "Advanced",
  file: "coding/problems/react-components/react-components.tsx",
  questions: [
    {
      name: "VirtualList",
      checks: [
        check("The scroll height is the full list height", async () => {
          const view = await mount(list(10000));
          const box = view.container.querySelector("[data-testid=viewport]");
          const height = box?.scrollHeight;
          view.unmount();
          return height === 200000 || `scrollHeight was ${height}`;
        }),
        check("Renders the visible rows plus overscan, not the whole list", async () => {
          const view = await mount(list(10000));
          const text = view.container.textContent ?? "";
          const count = view.container.querySelectorAll("span").length;
          view.unmount();
          if (!text.includes("Row 0") || !text.includes("Row 7")) return "the first rows are missing";
          return count <= 10 || `rendered ${count} rows, expected 8`;
        }),
        check("Scrolling shows the right rows at the right offset", async () => {
          const view = await mount(list(10000));
          const box = view.container.querySelector("[data-testid=viewport]");
          if (!box) return "no viewport";
          box.scrollTop = 2000;
          box.dispatchEvent(new Event("scroll"));
          await view.act();
          await wait(20);
          const row = [...view.container.querySelectorAll("span")].find((node) => node.textContent === "Row 100");
          const offset = row ? row.getBoundingClientRect().top - box.getBoundingClientRect().top : null;
          view.unmount();
          return offset !== null && Math.abs(offset) <= 1 ? true : `Row 100 was at ${offset}`;
        }),
        check("Handles the list shrinking while scrolled to the end", async () => {
          const view = await mount(list(1000));
          const box = view.container.querySelector("[data-testid=viewport]");
          if (!box) return "no viewport";
          box.scrollTop = 19900;
          box.dispatchEvent(new Event("scroll"));
          await view.act();
          await view.rerender(list(10));
          box.dispatchEvent(new Event("scroll"));
          await view.act();
          await wait(20);
          const text = view.container.textContent ?? "";
          view.unmount();
          return text.includes("Row 9") || "the last rows did not show";
        }),
      ],
    },
    {
      name: "Tabs",
      checks: [
        check("Shows the first tab by default", async () => {
          const view = await mount(<Tabs tabs={tabs} />);
          const panel = byRole(view.container, "tabpanel")[0]?.textContent;
          const selected = byRole(view.container, "tab")[0]?.getAttribute("aria-selected");
          view.unmount();
          return (panel === "First" && selected === "true") || `panel ${panel}, aria-selected ${selected}`;
        }),
        check("A click switches when uncontrolled", async () => {
          const seen: string[] = [];
          const view = await mount(<Tabs tabs={tabs} onChange={(id) => seen.push(id)} />);
          await view.act(() => byRole(view.container, "tab")[1].click());
          const text = view.container.textContent ?? "";
          view.unmount();
          return (text.includes("Second") && !text.includes("First") && seen.join() === "b") || `saw ${text}`;
        }),
        check("Only the value prop switches when controlled", async () => {
          const seen: string[] = [];
          const view = await mount(<Tabs tabs={tabs} value="a" onChange={(id) => seen.push(id)} />);
          await view.act(() => byRole(view.container, "tab")[1].click());
          const stayed = byRole(view.container, "tabpanel")[0]?.textContent === "First";
          await view.rerender(<Tabs tabs={tabs} value="b" />);
          const moved = byRole(view.container, "tabpanel")[0]?.textContent === "Second";
          view.unmount();
          return (stayed && moved && seen.join() === "b") || `stayed ${stayed}, moved ${moved}`;
        }),
      ],
    },
    {
      name: "Modal",
      checks: [
        check("Renders nothing when closed", async () => {
          const view = await mount(<Modal open={false} onClose={() => {}}>Hello</Modal>);
          const dialogs = byRole(document.body, "dialog").length;
          view.unmount();
          return dialogs === 0 || "a dialog is in the page";
        }),
        check("Portals into document.body", async () => {
          const view = await mount(<Modal open onClose={() => {}}>Hello</Modal>);
          const dialog = byRole(document.body, "dialog")[0];
          const inside = dialog ? view.container.contains(dialog) : null;
          view.unmount();
          return inside === false || "the dialog must render outside the parent";
        }),
        check("Escape closes only while open", async () => {
          let closes = 0;
          const view = await mount(<Modal open onClose={() => closes++}>Hello</Modal>);
          pressKey(document, "Escape");
          const open = closes;
          await view.rerender(<Modal open={false} onClose={() => closes++}>Hello</Modal>);
          pressKey(document, "Escape");
          view.unmount();
          return (open === 1 && closes === 1) || `closed ${open}, then ${closes} times`;
        }),
        check("Backdrop closes, the dialog does not", async () => {
          let closes = 0;
          const view = await mount(<Modal open onClose={() => closes++}>Hello</Modal>);
          byRole(document.body, "dialog")[0]?.click();
          const inner = closes;
          document.querySelector<HTMLElement>("[data-testid=backdrop]")?.click();
          view.unmount();
          return (inner === 0 && closes === 1) || `inside ${inner}, total ${closes}`;
        }),
      ],
    },
    {
      name: "ErrorBoundary",
      checks: [
        check("Shows children when nothing throws", async () => {
          const view = await mount(<ErrorBoundary fallback={() => "failed"}><Bomb armed={false} /></ErrorBoundary>);
          const text = view.container.textContent;
          view.unmount();
          return text === "Safe" || `got ${text}`;
        }),
        check("Shows the fallback with the error", async () => {
          const view = await mount(<ErrorBoundary fallback={(error) => error.message}><Bomb armed /></ErrorBoundary>);
          const text = view.container.textContent;
          view.unmount();
          return text === "boom" || `got ${text}`;
        }),
        check("reset renders children again", async () => {
          const view = await mount(<Recovering />);
          const button = view.container.querySelector("button");
          if (!button) return "no fallback rendered";
          await view.act(() => button.click());
          const text = view.container.textContent;
          view.unmount();
          return text === "Safe" || `got ${text}`;
        }),
      ],
    },
    {
      name: "TagInput",
      checks: [
        check("Enter adds the trimmed text and clears the input", async () => {
          const view = await mount(<ControlledTags initial={["a"]} />);
          const input = view.container.querySelector("input");
          if (!input) return "no input";
          await view.act(() => typeInto(input, "  b "));
          await view.act(() => pressKey(input, "Enter"));
          const tags = [...view.container.querySelectorAll("li")].map((li) => li.textContent).join();
          const left = input.value;
          view.unmount();
          return (tags.startsWith("a") && tags.includes("b") && left === "") || `tags ${tags}, input "${left}"`;
        }),
        check("Skips empty text and duplicates", async () => {
          const view = await mount(<ControlledTags initial={["a"]} />);
          const input = view.container.querySelector("input");
          if (!input) return "no input";
          await view.act(() => pressKey(input, "Enter"));
          await view.act(() => typeInto(input, "a"));
          await view.act(() => pressKey(input, "Enter"));
          const count = view.container.querySelectorAll("li").length;
          view.unmount();
          return count === 1 || `got ${count} tags`;
        }),
        check("Backspace in an empty input removes the last tag", async () => {
          const view = await mount(<ControlledTags initial={["a", "b"]} />);
          const input = view.container.querySelector("input");
          if (!input) return "no input";
          await view.act(() => pressKey(input, "Backspace"));
          const count = view.container.querySelectorAll("li").length;
          view.unmount();
          return count === 1 || `got ${count} tags`;
        }),
      ],
    },
  ],
};
