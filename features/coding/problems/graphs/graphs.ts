/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: Graphs
 *
 * Graphs are adjacency lists: each key lists the nodes it points to. Nodes that
 * only appear in a list have no outgoing edges. No `any`.
 */

export type Graph = Record<string, readonly string[]>;

/** The fewest-edges path from `from` to `to`, inclusive, or null. */
export function shortestPath(_graph: Graph, _from: string, _to: string): string[] | null {
  throw new Error("Not implemented");
}

/** Order nodes so each comes before the nodes it points to. Throw an Error on a cycle. */
export function topoSort(_graph: Graph): string[] {
  throw new Error("Not implemented");
}

/** True when a directed cycle exists. */
export function hasCycle(_graph: Graph): boolean {
  throw new Error("Not implemented");
}

/** Treat edges as undirected and return the connected groups, each sorted, ordered by first member. */
export function components(_graph: Graph): string[][] {
  throw new Error("Not implemented");
}
