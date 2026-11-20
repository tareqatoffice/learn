import { eq } from "../harness";
import type { Group } from "../harness";
import { fuzzyMatch, isAnagram, levenshtein, longestCommonPrefix, wordWrap } from "./text";

export const text: Group = {
  slug: "text",
  title: "Text algorithms",
  level: "Advanced",
  questions: [
    {
      name: "levenshtein",
      checks: [
        eq("kitten to sitting is 3", () => levenshtein("kitten", "sitting"), 3),
        eq("Equal strings are 0", () => levenshtein("a", "a"), 0),
        eq("Empty string costs its length", () => levenshtein("", "abc"), 3),
      ],
    },
    {
      name: "isAnagram",
      checks: [
        eq("Detects an anagram", () => isAnagram("listen", "silent"), true),
        eq("Ignores case and spaces", () => isAnagram("Dormitory", "dirty room!"), true),
        eq("Counts repeats", () => isAnagram("aab", "abb"), false),
      ],
    },
    {
      name: "longestCommonPrefix",
      checks: [
        eq("Finds a prefix", () => longestCommonPrefix(["flower", "flow", "flight"]), "fl"),
        eq("No shared prefix", () => longestCommonPrefix(["a", "b"]), ""),
        eq("Empty list", () => longestCommonPrefix([]), ""),
      ],
    },
    {
      name: "fuzzyMatch",
      checks: [
        eq("Matches letters in order", () => fuzzyMatch("cmp", "Component"), true),
        eq("Rejects out-of-order letters", () => fuzzyMatch("pc", "cap"), false),
        eq("An empty query matches", () => fuzzyMatch("", "x"), true),
      ],
    },
    {
      name: "wordWrap",
      checks: [
        eq("Wraps between words", () => wordWrap("the quick brown fox", 10), ["the quick", "brown fox"]),
        eq("A long word gets its own line", () => wordWrap("a incredible b", 4), ["a", "incredible", "b"]),
        eq("Empty input has no lines", () => wordWrap("", 5), []),
      ],
    },
  ],
};
