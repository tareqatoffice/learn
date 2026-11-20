import { delegate, escapeHtml, h, serializeForm } from "./dom";
import { check, eq } from "../harness";
import type { Group } from "../harness";

function formWith(html: string): HTMLFormElement {
  const form = document.createElement("form");
  form.innerHTML = html;
  return form;
}

export const dom: Group = {
  slug: "dom",
  title: "DOM",
  level: "Intermediate",
  questions: [
    {
      name: "escapeHtml",
      checks: [
        eq("Escapes tags", () => escapeHtml("<b>"), "&lt;b&gt;"),
        eq("Escapes quotes", () => escapeHtml(`"'`), "&quot;&#39;"),
        eq("Escapes & first", () => escapeHtml("&lt;"), "&amp;lt;"),
      ],
    },
    {
      name: "h",
      checks: [
        eq("Sets the tag and attributes", () => {
          const el = h("a", { href: "/x" });
          return [el.tagName, el.getAttribute("href")];
        }, ["A", "/x"]),
        eq("Nests children", () => h("ul", {}, h("li", {}, "a"), h("li", {}, "b")).children.length, 2),
        check("Strings stay text", () => {
          const el = h("p", {}, "<b>x</b>");
          return (el.children.length === 0 && el.textContent === "<b>x</b>") || "string was parsed as HTML";
        }),
      ],
    },
    {
      name: "delegate",
      checks: [
        eq("Fires for a matching child", () => {
          const root = h("div", {}, h("button", { class: "go" }, h("span", {}, "x")));
          const seen: string[] = [];
          delegate(root, "click", ".go", (match) => seen.push(match.tagName));
          root.querySelector("span")?.dispatchEvent(new Event("click", { bubbles: true }));
          return seen;
        }, ["BUTTON"]),
        eq("Ignores other elements", () => {
          const root = h("div", {}, h("p", {}));
          let calls = 0;
          delegate(root, "click", ".go", () => calls++);
          root.querySelector("p")?.dispatchEvent(new Event("click", { bubbles: true }));
          return calls;
        }, 0),
        eq("The remover stops it", () => {
          const root = h("div", {}, h("p", { class: "go" }));
          let calls = 0;
          delegate(root, "click", ".go", () => calls++)();
          root.querySelector("p")?.dispatchEvent(new Event("click", { bubbles: true }));
          return calls;
        }, 0),
      ],
    },
    {
      name: "serializeForm",
      checks: [
        eq("Reads text inputs", () => serializeForm(formWith('<input name="a" value="1">')), { a: "1" }),
        eq("Skips unchecked and disabled", () => serializeForm(formWith('<input type="checkbox" name="a" value="1"><input name="b" value="2" disabled>')), {}),
        eq("Repeated names become arrays", () => serializeForm(formWith('<input name="a" value="1"><input name="a" value="2">')), { a: ["1", "2"] }),
      ],
    },
  ],
};
