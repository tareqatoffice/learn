import { floodFill, rotate, spiral, transpose } from "./grids";
import { check, eq } from "../harness";
import type { Group } from "../harness";

export const grids: Group = {
  slug: "grids",
  title: "Grids",
  level: "Intermediate",
  questions: [
    {
      name: "transpose",
      checks: [
        eq("Swaps a square", () => transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]]),
        eq("Reshapes a rectangle", () => transpose([[1, 2, 3]]), [[1], [2], [3]]),
        eq("Handles an empty grid", () => transpose([]), []),
      ],
    },
    {
      name: "rotate",
      checks: [
        eq("Rotates a square", () => rotate([[1, 2], [3, 4]]), [[3, 1], [4, 2]]),
        eq("Rotates a rectangle", () => rotate([[1, 2, 3]]), [[1], [2], [3]]),
        check("Does not mutate", () => {
          const grid = [[1, 2], [3, 4]];
          rotate(grid);
          return grid[0][0] === 1 || "input changed";
        }),
      ],
    },
    {
      name: "spiral",
      checks: [
        eq("Walks a square", () => spiral([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), [1, 2, 3, 6, 9, 8, 7, 4, 5]),
        eq("Walks a wide grid", () => spiral([[1, 2, 3, 4], [5, 6, 7, 8]]), [1, 2, 3, 4, 8, 7, 6, 5]),
        eq("Walks a tall grid", () => spiral([[1], [2], [3]]), [1, 2, 3]),
      ],
    },
    {
      name: "floodFill",
      checks: [
        eq("Fills a region", () => floodFill([[0, 0, 1], [1, 0, 1]], 0, 0, 7), [[7, 7, 1], [1, 7, 1]]),
        eq("Does not cross diagonals", () => floodFill([[0, 1], [1, 0]], 0, 0, 7), [[7, 1], [1, 0]]),
        eq("Same value changes nothing", () => floodFill([[1]], 0, 0, 1), [[1]]),
      ],
    },
  ],
};
