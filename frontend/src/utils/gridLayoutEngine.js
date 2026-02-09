/**
 * Grid Layout Engine - MySQL Workbench Style
 * 
 * Arranges tables in a clean grid pattern with consistent spacing
 * Similar to MySQL Workbench's organized layout
 */

/**
 * Calculate grid layout for tables
 * @param {Object} tables - Schema tables object
 * @param {Array} relationships - Schema relationships array
 * @returns {Object} { nodes, edges } for React Flow
 */
export const calculateGridLayout = (schemaData) => {
  const { tables, relationships = [] } = schemaData;
  
  if (!tables || Object.keys(tables).length === 0) {
    return { nodes: [], edges: [] };
  }

  // Grid configuration - like MySQL Workbench
  const GRID_CONFIG = {
    columnsPerRow: 6, // Number of tables per row
    cellWidth: 400, // Horizontal spacing between table centers
    cellHeight: 500, // Vertical spacing between table centers
    startX: 200, // Starting X position (padding from left)
    startY: 200, // Starting Y position (padding from top)
    tableWidth: 280, // Actual table width
  };

  const tableNames = Object.keys(tables);
  const nodes = [];
  const edges = [];

  // Calculate grid positions for each table
  tableNames.forEach((tableName, index) => {
    const tableData = tables[tableName];
    
    // Calculate grid position
    const row = Math.floor(index / GRID_CONFIG.columnsPerRow);
    const col = index % GRID_CONFIG.columnsPerRow;
    
    // Calculate actual position
    const x = GRID_CONFIG.startX + (col * GRID_CONFIG.cellWidth);
    const y = GRID_CONFIG.startY + (row * GRID_CONFIG.cellHeight);

    // Calculate table height based on number of columns
    const columns = tableData.columns || {};
    const columnCount = Object.keys(columns).length;
    const headerHeight = 40;
    const rowHeight = 28;
    const tableHeight = headerHeight + (columnCount * rowHeight) + 20;

    nodes.push({
      id: tableName,
      type: 'tableCard',
      position: { x, y },
      data: {
        tableName: tableName,
        columns: tableData.columns,
        isSelected: false,
      },
      width: GRID_CONFIG.tableWidth,
      height: tableHeight,
    });
  });

  // Create edges for relationships
  relationships.forEach((rel) => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;

    // Validate relationship
    if (!tables[fromTable] || !tables[toTable]) {
      return;
    }

    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];

    if (!sourceColumn || !targetColumn) {
      return;
    }

    // Determine relationship type
    let relationType = 'ONE_TO_MANY';
    if (sourceColumn.unique) {
      relationType = 'ONE_TO_ONE';
    }

    // Determine connection sides based on grid positions
    const sourceNode = nodes.find(n => n.id === fromTable);
    const targetNode = nodes.find(n => n.id === toTable);

    let sourceHandle = 'right';
    let targetHandle = 'left';

    if (sourceNode && targetNode) {
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;

      // Determine best connection sides based on relative positions
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal arrangement
        sourceHandle = dx > 0 ? 'right' : 'left';
        targetHandle = dx > 0 ? 'left' : 'right';
      } else {
        // Vertical arrangement
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
    }

    edges.push({
      id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`,
      source: fromTable,
      target: toTable,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      type: 'direct', // Use direct edge type for clean lines
      data: {
        fromTable: fromTable,
        fromColumn: fromColumn,
        toTable: toTable,
        toColumn: toColumn,
        relationType: relationType,
        constraintName: constraintName || `fk_${fromTable}_${fromColumn}`,
        isUserCreated: false,
      },
    });
  });

  return { nodes, edges };
};

/**
 * Recalculate grid layout with updated node positions
 * (For when user manually moves tables)
 * @param {Object} schemaData - Schema data
 * @param {Array} currentNodes - Current React Flow nodes
 * @returns {Object} { nodes, edges }
 */
export const recalculateGridLayout = (schemaData, currentNodes) => {
  // For grid layout, we preserve user's manual positions
  // Only recalculate edges
  const { tables, relationships = [] } = schemaData;
  const edges = [];

  relationships.forEach((rel) => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;

    if (!tables[fromTable] || !tables[toTable]) {
      return;
    }

    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];

    if (!sourceColumn || !targetColumn) {
      return;
    }

    let relationType = 'ONE_TO_MANY';
    if (sourceColumn.unique) {
      relationType = 'ONE_TO_ONE';
    }

    const sourceNode = currentNodes.find(n => n.id === fromTable);
    const targetNode = currentNodes.find(n => n.id === toTable);

    let sourceHandle = 'right';
    let targetHandle = 'left';

    if (sourceNode && targetNode) {
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        sourceHandle = dx > 0 ? 'right' : 'left';
        targetHandle = dx > 0 ? 'left' : 'right';
      } else {
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
    }

    edges.push({
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
    });
  });

  return { nodes: currentNodes, edges };
};

export default calculateGridLayout;
