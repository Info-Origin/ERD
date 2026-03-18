import type { Relationship } from '../types';

interface CircularDependencyResult {
  tables: string[];
  relationships: Relationship[];
}

export const detectCircularDependencies = (
  relationships: Relationship[],
): CircularDependencyResult => {
  if (!relationships || relationships.length === 0) {
    return { tables: [], relationships: [] };
  }

  const graph: Record<string, string[]> = {};
  const allTables = new Set<string>();
  const relationshipMap = new Map<string, Relationship[]>();

  relationships.forEach((rel) => {
    const { fromTable: from, toTable: to } = rel;
    allTables.add(from);
    allTables.add(to);
    if (!graph[from]) graph[from] = [];
    if (!graph[to]) graph[to] = [];
    if (!graph[from].includes(to)) {
      graph[from].push(to);
      const edgeKey = `${from}->${to}`;
      if (!relationshipMap.has(edgeKey)) relationshipMap.set(edgeKey, []);
      relationshipMap.get(edgeKey)!.push(rel);
    }
  });

  const tablesInCycles = new Set<string>();
  const relationshipsInCycles = new Set<Relationship>();

  const detectCycles = (
    node: string,
    visited: Set<string>,
    recStack: Set<string>,
    path: string[],
  ) => {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        detectCycles(neighbor, visited, recStack, path);
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStartIndex);
        if (cycleNodes.length >= 3) {
          cycleNodes.forEach((t) => tablesInCycles.add(t));
          tablesInCycles.add(neighbor);
          for (let i = 0; i < cycleNodes.length; i++) {
            const edgeKey = `${cycleNodes[i]}->${cycleNodes[(i + 1) % cycleNodes.length]}`;
            relationshipMap.get(edgeKey)?.forEach((r) => relationshipsInCycles.add(r));
          }
          const closingKey = `${cycleNodes[cycleNodes.length - 1]}->${neighbor}`;
          relationshipMap.get(closingKey)?.forEach((r) => relationshipsInCycles.add(r));
        }
      }
    }

    path.pop();
    recStack.delete(node);
  };

  const globalVisited = new Set<string>();
  for (const node of allTables) {
    if (!globalVisited.has(node)) {
      detectCycles(node, globalVisited, new Set(), []);
    }
  }

  return {
    tables: Array.from(tablesInCycles),
    relationships: Array.from(relationshipsInCycles),
  };
};
