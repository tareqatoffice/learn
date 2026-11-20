import { formatList, ordinal, pluralize, relativeTime } from "./format";
import { eq } from "../harness";
import type { Group } from "../harness";

export const format: Group = {
  slug: "format",
  title: "Formatting",
  level: "Intermediate",
  questions: [
    {
      name: "pluralize",
      checks: [
        eq("Singular", () => pluralize(1, "item"), "1 item"),
        eq("Zero is plural", () => pluralize(0, "item"), "0 items"),
        eq("Custom plural", () => pluralize(2, "person", "people"), "2 people"),
      ],
    },
    {
      name: "ordinal",
      checks: [
        eq("1st, 2nd, 3rd", () => [1, 2, 3].map((n) => ordinal(n)), ["1st", "2nd", "3rd"]),
        eq("Teens use th", () => [11, 12, 13].map((n) => ordinal(n)), ["11th", "12th", "13th"]),
        eq("Larger numbers", () => [21, 101, 112].map((n) => ordinal(n)), ["21st", "101st", "112th"]),
      ],
    },
    {
      name: "formatList",
      checks: [
        eq("Empty and one item", () => [formatList([]), formatList(["a"])], ["", "a"]),
        eq("Two items", () => formatList(["a", "b"]), "a and b"),
        eq("Three items", () => formatList(["a", "b", "c"]), "a, b, and c"),
      ],
    },
    {
      name: "relativeTime",
      checks: [
        eq("Under a minute", () => relativeTime(-30_000), "just now"),
        eq("Past minutes", () => relativeTime(-300_000), "5 minutes ago"),
        eq("One hour", () => relativeTime(-3_600_000), "1 hour ago"),
        eq("Future days", () => relativeTime(172_800_000), "in 2 days"),
      ],
    },
  ],
};
