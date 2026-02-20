/**
 * Detect circular dependencies in table relationships
 * Returns an array of table names that are part of circular dependencies (cycles of 3+ tables)
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
    return [];
  }

  // Build adjacency list from relationships
  const graph = {};
  const allTables = new Set();
  
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
    }
  });

  // Set to store all tables involved in cycles of length >= 3
  const tablesInCycles = new Set();

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

  return Array.from(tablesInCycles);
};
