import { eq } from "../harness";
import type { Group } from "../harness";
import { camelCase, kebabCase, titleCase, truncate } from "./strings";

export const strings: Group = {
  slug: "strings",
  title: "Strings",
  level: "Intermediate",
  questions: [
    {
      name: "camelCase",
      checks: [
        eq("Converts spaces", () => camelCase("hello big world"), "helloBigWorld"),
        eq("Converts mixed separators", () => camelCase("foo_bar-baz"), "fooBarBaz"),
        eq("Lowers upper-case input", () => camelCase("HELLO WORLD"), "helloWorld"),
      ],
    },
    {
      name: "kebabCase",
      checks: [
        eq("Splits camelCase", () => kebabCase("helloWorld"), "hello-world"),
        eq("Splits snake_case", () => kebabCase("foo_bar"), "foo-bar"),
        eq("Collapses repeated separators", () => kebabCase("  a  b "), "a-b"),
      ],
    },
    {
      name: "truncate",
      checks: [
        eq("Leaves short text alone", () => truncate("abc", 3), "abc"),
        eq("Adds an ellipsis within max", () => truncate("abcdefgh", 6), "abc..."),
        eq("Handles an empty string", () => truncate("", 2), ""),
      ],
    },
    {
      name: "titleCase",
      checks: [
        eq("Capitalizes each word", () => titleCase("hello world"), "Hello World"),
        eq("Lowers the rest", () => titleCase("hELLO"), "Hello"),
        eq("Keeps spacing", () => titleCase("a  b"), "A  B"),
      ],
    },
  ],
};
