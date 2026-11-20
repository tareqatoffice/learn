import { eq } from "../harness";
import type { Group } from "../harness";
import { joinPath, parseQuery, stringifyQuery, withQuery } from "./urls";

export const urls: Group = {
  slug: "urls",
  title: "URLs",
  level: "Intermediate",
  questions: [
    {
      name: "parseQuery",
      checks: [
        eq("Parses pairs", () => parseQuery("?a=1&b=2"), { a: "1", b: "2" }),
        eq("Repeats become arrays", () => parseQuery("a=1&a=2&a=3"), { a: ["1", "2", "3"] }),
        eq("Decodes values", () => parseQuery("q=a%20b+c&flag"), { q: "a b c", flag: "" }),
        eq("Handles an empty string", () => parseQuery(""), {}),
      ],
    },
    {
      name: "stringifyQuery",
      checks: [
        eq("Sorts keys", () => stringifyQuery({ b: "2", a: "1" }), "a=1&b=2"),
        eq("Repeats arrays", () => stringifyQuery({ a: ["1", "2"] }), "a=1&a=2"),
        eq("Encodes values", () => stringifyQuery({ q: "a b&c" }), "q=a%20b%26c"),
      ],
    },
    {
      name: "joinPath",
      checks: [
        eq("Joins parts", () => joinPath("a", "b"), "a/b"),
        eq("Removes extra slashes", () => joinPath("/a/", "/b/"), "/a/b/"),
        eq("Skips empty parts", () => joinPath("a", "", "b"), "a/b"),
      ],
    },
    {
      name: "withQuery",
      checks: [
        eq("Adds a param", () => withQuery("https://x.io/p?a=1", { b: "2" }), "https://x.io/p?a=1&b=2"),
        eq("Removes with null", () => withQuery("https://x.io/p?a=1&b=2", { a: null }), "https://x.io/p?b=2"),
        eq("Keeps the hash", () => withQuery("https://x.io/p#top", { a: "1" }), "https://x.io/p?a=1#top"),
      ],
    },
  ],
};
