/**
 * Detect circular dependencies in table relationships
 * Returns an object with:
 * - tables: array of table names that are part of circular dependencies (cycles of 3+ tables)
 * - relationships: array of relationships that are part of circular dependencies
 * 
 * Edge Cases Handled:
 * ✅ Simple 3+ table cycles
 * ✅ Multiple separate cycles
 * ✅ Overlapping/nested cycles
 * ✅ Long cycles (5+ tables)
 * ❌ Self-joins (1-table cycles) - IGNORED
 * ❌ 2-table bidirectional cycles - IGNORED
 * ❌ Linear chains (no cycles)
 * ❌ Tree structures
 */
export const detectCircularDependencies = (relationships) => {
  // Edge Case: Empty, null, or undefined relationships
  if (!relationships || relationships.length === 0) {
    return { tables: [], relationships: [] };
  }

  // Build adjacency list from relationships
  const graph = {};
  const allTables = new Set();
  const relationshipMap = new Map(); // Map to track relationships by edge
  
  relationships.forEach(rel => {
    const from = rel.fromTable;
    const to = rel.toTable;
    
    // Track all tables
    allTables.add(from);
    allTables.add(to);
    
    // Initialize graph nodes
    if (!graph[from]) graph[from] = [];
    if (!graph[to]) graph[to] = [];
    
    // Add edge from 'from' table to 'to' table (child → parent)
    // Avoid duplicate edges
    if (!graph[from].includes(to)) {
      graph[from].push(to);
      // Store relationship for this edge
      const edgeKey = `${from}->${to}`;
      if (!relationshipMap.has(edgeKey)) {
        relationshipMap.set(edgeKey, []);
      }
      relationshipMap.get(edgeKey).push(rel);
    }
  });

  // Set to store all tables involved in cycles of length >= 3
  const tablesInCycles = new Set();
  const relationshipsInCycles = new Set();

  // DFS to detect cycles with proper cycle length validation
  const detectCycles = (node, visited, recStack, path) => {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph[node] || [];
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        // Continue DFS
        detectCycles(neighbor, visited, recStack, path);
      } else if (recStack.has(neighbor)) {
        // Found a back edge - potential cycle
        const cycleStartIndex = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStartIndex);
        const cycleLength = cycleNodes.length;
        
        // CRITICAL: Only flag cycles with 3 or more UNIQUE tables
        // This excludes:
        // - Self-joins (1 table: A → A)
        // - 2-table bidirectional (2 tables: A → B → A)
        if (cycleLength >= 3) {
          // Add all nodes in the cycle
          cycleNodes.forEach(table => tablesInCycles.add(table));
          // Add the closing node to complete the cycle
          tablesInCycles.add(neighbor);
          
          // Add all relationships in the cycle
          for (let i = 0; i < cycleNodes.length; i++) {
            const from = cycleNodes[i];
            const to = cycleNodes[(i + 1) % cycleNodes.length];
            const edgeKey = `${from}->${to}`;
            const rels = relationshipMap.get(edgeKey);
            if (rels) {
              rels.forEach(rel => relationshipsInCycles.add(rel));
            }
          }
          // Add the closing edge
          const closingEdgeKey = `${cycleNodes[cycleNodes.length - 1]}->${neighbor}`;
          const closingRels = relationshipMap.get(closingEdgeKey);
          if (closingRels) {
            closingRels.forEach(rel => relationshipsInCycles.add(rel));
          }
        }
      }
    }

    path.pop();
    recStack.delete(node);
  };

  // Check all nodes for cycles
  // Use a global visited set to avoid redundant checks
  const globalVisited = new Set();
  
  for (const node of allTables) {
    if (!globalVisited.has(node)) {
      const recStack = new Set();
      const path = [];
      detectCycles(node, globalVisited, recStack, path);
    }
  }

  return {
    tables: Array.from(tablesInCycles),
    relationships: Array.from(relationshipsInCycles)
  };
};
