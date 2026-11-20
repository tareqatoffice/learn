import { eq, throws } from "../harness";
import type { Group } from "../harness";
import { buildTree, findPath, flattenTree, levels, mapTree } from "./trees";
import type { TreeNode } from "./trees";

const leaf = (value: number): TreeNode<number> => ({ value, children: [] });
const tree: TreeNode<number> = {
  value: 1,
  children: [{ value: 2, children: [leaf(3)] }, leaf(4)],
};

export const trees: Group = {
  slug: "trees",
  title: "Trees",
  level: "Intermediate",
  questions: [
    {
      name: "flattenTree",
      checks: [
        eq("Walks pre-order", () => flattenTree(tree), [1, 2, 3, 4]),
        eq("Handles a single node", () => flattenTree(leaf(1)), [1]),
        eq("Handles a deep chain", () => flattenTree({ value: 1, children: [{ value: 2, children: [leaf(3)] }] }), [1, 2, 3]),
      ],
    },
    {
      name: "levels",
      checks: [
        eq("Groups by depth", () => levels(tree), [[1], [2, 4], [3]]),
        eq("Handles a single node", () => levels(leaf(1)), [[1]]),
        eq("Keeps sibling order", () => levels({ value: 0, children: [leaf(2), leaf(1)] }), [[0], [2, 1]]),
      ],
    },
    {
      name: "buildTree",
      checks: [
        eq("Builds nesting", () => buildTree([{ id: 1, parentId: null, value: "a" }, { id: 2, parentId: 1, value: "b" }]), [{ value: "a", children: [{ value: "b", children: [] }] }]),
        eq("Accepts a child before its parent", () => buildTree([{ id: 2, parentId: 1, value: "b" }, { id: 1, parentId: null, value: "a" }]), [{ value: "a", children: [{ value: "b", children: [] }] }]),
        eq("Returns several roots", () => buildTree([{ id: 1, parentId: null, value: 1 }, { id: 2, parentId: null, value: 2 }]).length, 2),
        throws("Throws for an unknown parent", () => buildTree([{ id: 1, parentId: 9, value: 1 }])),
      ],
    },
    {
      name: "findPath",
      checks: [
        eq("Finds a deep value", () => findPath(tree, (v) => v === 3), [1, 2, 3]),
        eq("Finds the root", () => findPath(tree, (v) => v === 1), [1]),
        eq("Returns null when missing", () => findPath(tree, (v) => v === 9), null),
      ],
    },
    {
      name: "mapTree",
      checks: [
        eq("Maps every value", () => flattenTree(mapTree(tree, (v) => v * 2)), [2, 4, 6, 8]),
        eq("Can change the type", () => mapTree(leaf(1), String), { value: "1", children: [] }),
        eq("Does not mutate", () => {
          mapTree(tree, (v) => v + 1);
          return tree.value;
        }, 1),
      ],
    },
  ],
};
