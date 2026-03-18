import { LAYOUT_CONFIG, NODE_TYPES } from './constants';
import type { TableData } from '../types';
import type { Node } from '@xyflow/react';

export const calculateNodeHeight = (columnCount: number): number => {
  return LAYOUT_CONFIG.HEADER_HEIGHT + columnCount * LAYOUT_CONFIG.ROW_HEIGHT + LAYOUT_CONFIG.PADDING * 2;
};

export const createNodesFromTables = (tables: Record<string, TableData>, selectedTable: string | null = null): Node[] => {
  if (!tables) return [];
  return Object.entries(tables).map(([tableName, tableData]) => {
    const columns = tableData.columns || {};
    const columnCount = Object.keys(columns).length;
    return {
      id: tableName,
      type: NODE_TYPES.TABLE,
      data: { tableName, columns, isSelected: selectedTable === tableName },
      position: { x: 0, y: 0 },
      width: LAYOUT_CONFIG.NODE_WIDTH,
      height: calculateNodeHeight(columnCount),
    };
  });
};

export const updateNodeSelection = (nodes: Node[], selectedTable: string): Node[] => {
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, isSelected: node.id === selectedTable },
  }));
};
