/**
 * Finds a dependency cycle in `edges` (node -> prerequisites). Returns a closed path such as
 * `['a','b','a']`, or null for a DAG. Edges to nodes that are not keys of `edges` are ignored.
 */
export function findCycle(edges: Record<string, string[]>): string[] | null {
  const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = fully explored
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    if (!Object.hasOwn(edges, id) || state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...path.slice(path.indexOf(id)), id];
    state.set(id, 1);
    path.push(id);
    for (const next of edges[id]) {
      const found = visit(next);
      if (found) return found;
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of Object.keys(edges)) {
    const found = visit(id);
    if (found) return found;
  }
  return null;
}
