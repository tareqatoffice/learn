import { eq, throws } from "../harness";
import type { Group } from "../harness";
import { clamp, formatBytes, range, roundTo } from "./numbers";

export const numbers: Group = {
  slug: "numbers",
  title: "Numbers",
  level: "Intermediate",
  questions: [
    {
      name: "clamp",
      checks: [
        eq("Keeps values in range", () => clamp(5, 0, 10), 5),
        eq("Raises to min", () => clamp(-1, 0, 10), 0),
        eq("Lowers to max", () => clamp(11, 0, 10), 10),
      ],
    },
    {
      name: "roundTo",
      checks: [
        eq("Rounds 1.005 up", () => roundTo(1.005, 2), 1.01),
        eq("Rounds to whole numbers", () => roundTo(2.5, 0), 3),
        eq("Keeps short decimals", () => roundTo(1.2, 3), 1.2),
      ],
    },
    {
      name: "range",
      checks: [
        eq("Counts up", () => range(0, 3), [0, 1, 2]),
        eq("Counts down", () => range(3, 0, -1), [3, 2, 1]),
        eq("Skips by step", () => range(0, 6, 2), [0, 2, 4]),
        throws("Throws a RangeError for step 0", () => range(0, 1, 0), RangeError),
      ],
    },
    {
      name: "formatBytes",
      checks: [
        eq("Formats zero", () => formatBytes(0), "0 B"),
        eq("Keeps one decimal", () => formatBytes(1536), "1.5 KB"),
        eq("Drops .0", () => formatBytes(2 * 1024 * 1024), "2 MB"),
        eq("Stops at TB", () => formatBytes(1024 ** 5), "1024 TB"),
      ],
    },
  ],
};
