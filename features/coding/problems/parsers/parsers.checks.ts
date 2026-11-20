import { eq, throws } from "../harness";
import type { Group } from "../harness";
import { evalRpn, isBalanced, parseCsvLine, renderTemplate } from "./parsers";

export const parsers: Group = {
  slug: "parsers",
  title: "Parsers",
  level: "Advanced",
  questions: [
    {
      name: "parseCsvLine",
      checks: [
        eq("Splits fields", () => parseCsvLine("a,b,c"), ["a", "b", "c"]),
        eq("Keeps commas in quotes", () => parseCsvLine('"a,b",c'), ["a,b", "c"]),
        eq("Unescapes quotes", () => parseCsvLine('"a""b"'), ['a"b']),
        eq("Keeps empty fields", () => parseCsvLine("a,,"), ["a", "", ""]),
      ],
    },
    {
      name: "evalRpn",
      checks: [
        eq("Evaluates", () => evalRpn("3 4 + 2 *"), 14),
        eq("Respects operand order", () => evalRpn("10 2 /"), 5),
        throws("Throws on too few operands", () => evalRpn("1 +")),
        throws("Throws on leftovers", () => evalRpn("1 2")),
      ],
    },
    {
      name: "isBalanced",
      checks: [
        eq("Accepts nesting", () => isBalanced("{[a(b)]}"), true),
        eq("Rejects crossing", () => isBalanced("([)]"), false),
        eq("Rejects unclosed", () => isBalanced("(("), false),
        eq("Rejects a stray closer", () => isBalanced(")"), false),
      ],
    },
    {
      name: "renderTemplate",
      checks: [
        eq("Fills values", () => renderTemplate("Hi {{ name }}", { name: "Ann" }), "Hi Ann"),
        eq("Reads nested paths", () => renderTemplate("{{a.b}}", { a: { b: 1 } }), "1"),
        eq("Missing values are empty", () => renderTemplate("[{{x}}]", {}), "[]"),
        eq("Keeps 0", () => renderTemplate("{{n}}", { n: 0 }), "0"),
      ],
    },
  ],
};
