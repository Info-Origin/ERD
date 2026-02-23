/**
 * Hybrid Layout Engine
 * 
 * Combines hierarchical layout for parent-child relationships
 * with grid layout for isolated tables
 */

/**
 * Build parent-child relationship map
 * @param {Array} relationships - Schema relationships
 * @returns {Map} Map of parent -> children
 */
const buildRelationshipMap = (relationships) => {
  const parentToChildren = new Map();
  const childToParent = new Map();
  
  relationships.forEach(rel => {
    // Parent is the table being referenced (toTable)
    // Child is the table with the foreign key (fromTable)
    if (!parentToChildren.has(rel.toTable)) {
      parentToChildren.set(rel.toTable, []);
    }
    parentToChildren.get(rel.toTable).push(rel.fromTable);
    
    // Track child to parent for reverse lookup
    if (!childToParent.has(rel.fromTable)) {
      childToParent.set(rel.fromTable, []);
    }
    childToParent.get(rel.fromTable).push(rel.toTable);
  });
  
  return { parentToChildren, childToParent };
};

/**
 * Find root tables (tables that are parents but not children)
 * @param {Set} allTables - All table names
 * @param {Map} parentToChildren - Parent to children map
 * @param {Map} childToParent - Child to parent map
 * @returns {Set} Root table names
 */
const findRootTables = (allTables, parentToChildren, childToParent) => {
  const roots = new Set();
  
  allTables.forEach(tableName => {
    const hasChildren = parentToChildren.has(tableName);
    const hasParents = childToParent.has(tableName);
    
    // Root if it has children but no parents
    if (hasChildren && !hasParents) {
      roots.add(tableName);
    }
  });
  
  return roots;
};

/**
 * Build hierarchy tree starting from a root table
 * @param {string} rootTable - Root table name
 * @param {Map} parentToChildren - Parent to children map
 * @param {Set} visited - Already visited tables
 * @returns {Object} Hierarchy tree
 */
const buildHierarchyTree = (rootTable, parentToChildren, visited = new Set()) => {
  if (visited.has(rootTable)) {
    return null; // Prevent circular references
  }
  
  visited.add(rootTable);
  const children = parentToChildren.get(rootTable) || [];
  
  return {
    table: rootTable,
    children: children
      .map(child => buildHierarchyTree(child, parentToChildren, new Set(visited)))
      .filter(Boolean)
  };
};

/**
 * Calculate positions for a hierarchy tree
 * @param {Object} tree - Hierarchy tree
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {Object} config - Layout configuration
 * @returns {Array} Array of { table, x, y, depth }
 */
const layoutHierarchyTree = (tree, startX, startY, config) => {
  const positions = [];
  const { verticalSpacing, horizontalSpacing } = config;
  
  // Track horizontal position for each depth level
  const depthXPositions = new Map();
  
  const traverse = (node, depth, parentX) => {
    // Get or initialize X position for this depth
    if (!depthXPositions.has(depth)) {
      depthXPositions.set(depth, parentX);
    }
    
    const x = depthXPositions.get(depth);
    const y = startY + (depth * verticalSpacing);
    
    positions.push({
      table: node.table,
      x,
      y,
      depth
    });
    
    // Update X position for next sibling at this depth
    depthXPositions.set(depth, x + horizontalSpacing);
    
    // Process children
    if (node.children && node.children.length > 0) {
      const childStartX = x;
      node.children.forEach(child => {
        traverse(child, depth + 1, childStartX);
      });
    }
  };
  
  traverse(tree, 0, startX);
  return positions;
};

/**
 * Calculate hybrid layout combining hierarchical and grid layouts
 * @param {Object} schemaData - Schema data with tables and relationships
 * @param {Object} savedPositions - Previously saved table positions
 * @returns {Object} { nodes, edges }
 */
export const calculateHybridLayout = (schemaData, savedPositions = {}) => {
  const { tables, relationships = [] } = schemaData;
  
  if (!tables || Object.keys(tables).length === 0) {
    return { nodes: [], edges: [] };
  }

  // Configuration
  const HIERARCHY_CONFIG = {
    verticalSpacing: 400,   // Vertical space between parent and child
    horizontalSpacing: 350, // Horizontal space between siblings
    startX: 200,
    startY: 200,
  };
  
  const GRID_CONFIG = {
    columnsPerRow: 6,
    cellWidth: 400,
    cellHeight: 500,
    startX: 200,
    startY: 200,
  };

  // Build relationship maps
  const { parentToChildren, childToParent } = buildRelationshipMap(relationships);
  const allTables = new Set(Object.keys(tables));
  
  // Find root tables (parents with no parents)
  const rootTables = findRootTables(allTables, parentToChildren, childToParent);
  
  // Track which tables are part of hierarchies
  const hierarchyTables = new Set();
  const hierarchyPositions = [];
  
  // Build and layout hierarchies
  let currentHierarchyX = HIERARCHY_CONFIG.startX;
  rootTables.forEach(rootTable => {
    const tree = buildHierarchyTree(rootTable, parentToChildren);
    if (tree) {
      const positions = layoutHierarchyTree(
        tree, 
        currentHierarchyX, 
        HIERARCHY_CONFIG.startY, 
        HIERARCHY_CONFIG
      );
      
      hierarchyPositions.push(...positions);
      positions.forEach(pos => hierarchyTables.add(pos.table));
      
      // Move X position for next hierarchy
      const maxX = Math.max(...positions.map(p => p.x));
      currentHierarchyX = maxX + HIERARCHY_CONFIG.horizontalSpacing * 2;
    }
  });
  
  // Find isolated tables (no relationships)
  const isolatedTables = Array.from(allTables).filter(
    table => !hierarchyTables.has(table)
  );
  
  // Layout isolated tables in grid below hierarchies
  const maxHierarchyY = hierarchyPositions.length > 0
    ? Math.max(...hierarchyPositions.map(p => p.y)) + GRID_CONFIG.cellHeight
    : GRID_CONFIG.startY;
  
  const gridPositions = isolatedTables.map((tableName, index) => {
    const row = Math.floor(index / GRID_CONFIG.columnsPerRow);
    const col = index % GRID_CONFIG.columnsPerRow;
    
    return {
      table: tableName,
      x: GRID_CONFIG.startX + (col * GRID_CONFIG.cellWidth),
      y: maxHierarchyY + (row * GRID_CONFIG.cellHeight),
      depth: -1 // Mark as grid layout
    };
  });
  
  // Combine all positions
  const allPositions = [...hierarchyPositions, ...gridPositions];
  
  // Remove duplicate tables (keep first occurrence)
  const uniquePositions = [];
  const seenTables = new Set();
  allPositions.forEach(pos => {
    if (!seenTables.has(pos.table)) {
      seenTables.add(pos.table);
      uniquePositions.push(pos);
    }
  });
  
  // Create nodes - filter out tables that don't exist in the filtered tables object
  const nodes = uniquePositions
    .filter(pos => tables[pos.table]) // Skip tables that don't exist
    .map(pos => {
      const tableData = tables[pos.table];
      const columns = tableData.columns || {};
      const columnCount = Object.keys(columns).length;
      
      // Detect if this is a junction table (for both DB and user-created)
      const columnValues = Object.values(columns);
      const pkColumns = columnValues.filter(col => col.pk);
      const fkColumns = columnValues.filter(col => col.fk);
      
      // Junction table criteria:
      // 1. Has exactly 2 FK columns
      // 2. Both FK columns are part of PK (identifying relationships)
      // 3. PK is composite (2 columns)
      const isDetectedJunctionTable = 
        fkColumns.length === 2 && 
        pkColumns.length === 2 && 
        fkColumns.every(fk => fk.pk);
      
      // Use explicit flag OR detected structure
      const isJunctionTable = tableData.isJunctionTable || isDetectedJunctionTable;
      
      // Calculate table height
      const headerHeight = 40;
      const rowHeight = 28;
      const tableHeight = headerHeight + (columnCount * rowHeight) + 20;
      const tableWidth = 280;
      
      // Use saved position if available, otherwise use calculated position
      const finalPosition = savedPositions[pos.table] || { x: pos.x, y: pos.y };
      
      return {
        id: pos.table,
        type: 'tableCard',
        position: finalPosition,
        data: {
          tableName: pos.table,
          columns: tableData.columns,
          isSelected: false,
          hierarchyDepth: pos.depth, // Store depth for styling
          isJunctionTable: isJunctionTable, // NEW: Pass junction table flag (detected or explicit)
        },
      width: tableWidth,
      height: tableHeight,
    };
  });
  
  // Create edges
  const edges = relationships.map(rel => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;
    
    // Validate relationship
    if (!tables[fromTable] || !tables[toTable]) {
      return null;
    }
    
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];
    
    if (!sourceColumn || !targetColumn) {
      return null;
    }
    
    // Determine relationship type
    let relationType = 'ONE_TO_MANY';
    if (sourceColumn.unique) {
      relationType = 'ONE_TO_ONE';
    }
    
    // Determine connection sides based on positions
    const sourceNode = nodes.find(n => n.id === fromTable);
    const targetNode = nodes.find(n => n.id === toTable);
    
    let sourceHandle = 'right';
    let targetHandle = 'left';
    
    if (sourceNode && targetNode) {
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      
      // For hierarchical relationships (parent-child), prefer vertical
      const isHierarchical = hierarchyTables.has(fromTable) && hierarchyTables.has(toTable);
      
      if (isHierarchical && Math.abs(dy) > 100) {
        // Vertical arrangement for hierarchy
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      } else if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal arrangement
        sourceHandle = dx > 0 ? 'right' : 'left';
        targetHandle = dx > 0 ? 'left' : 'right';
      } else {
        // Vertical arrangement
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
    }
    
    return {
      id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`,
      source: fromTable,
      target: toTable,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      type: 'direct',
      data: {
        fromTable: fromTable,
        fromColumn: fromColumn,
        toTable: toTable,
        toColumn: toColumn,
        relationType: relationType,
        constraintName: constraintName || `fk_${fromTable}_${fromColumn}`,
        isUserCreated: false,
      },
    };
  }).filter(Boolean);
  
  return { nodes, edges };
};

export default calculateHybridLayout;
