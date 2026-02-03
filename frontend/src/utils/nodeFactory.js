import { LAYOUT_CONFIG, NODE_TYPES } from "./constants";

/**
 * Calculate the height of a table node based on number of columns
 * @param {number} columnCount - Number of columns in the table
 * @returns {number} Node height in pixels
 */
export const calculateNodeHeight = (columnCount) => {
  const headerHeight = LAYOUT_CONFIG.HEADER_HEIGHT;
  const rowHeight = LAYOUT_CONFIG.ROW_HEIGHT;
  const padding = LAYOUT_CONFIG.PADDING * 2;

  return headerHeight + columnCount * rowHeight + padding;
};

/**
 * Convert ERD table data to React Flow nodes
 * @param {Object} tables - Tables object from API
 * @param {string} selectedTable - Currently selected table name
 * @returns {Array} React Flow nodes array
 */
export const createNodesFromTables = (tables, selectedTable = null) => {
  if (!tables) return [];

  return Object.entries(tables).map(([tableName, tableData]) => {
    const columns = tableData.columns || {};
    const columnCount = Object.keys(columns).length;

    return {
      id: tableName,
      type: NODE_TYPES.TABLE,
      data: {
        tableName,
        columns,
        isSelected: selectedTable === tableName,
      },
      position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
      width: LAYOUT_CONFIG.NODE_WIDTH,
      height: calculateNodeHeight(columnCount),
    };
  });
};

/**
 * Update node selection state
 * @param {Array} nodes - Current nodes array
 * @param {string} selectedTable - Selected table name
 * @returns {Array} Updated nodes array
 */
export const updateNodeSelection = (nodes, selectedTable) => {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isSelected: node.id === selectedTable,
    },
  }));
};
