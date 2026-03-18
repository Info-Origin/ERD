import type { ERDData } from '../types';
import type { Node, Edge } from '@xyflow/react';

const GRID_CONFIG = {
  columnsPerRow: 6,
  cellWidth: 400,
  cellHeight: 500,
  startX: 200,
  startY: 200,
  tableWidth: 280,
};

export const calculateGridLayout = (schemaData: ERDData): { nodes: Node[]; edges: Edge[] } => {
  const { tables, relationships = [] } = schemaData;
  if (!tables || Object.keys(tables).length === 0) return { nodes: [], edges: [] };

  const tableNames = Object.keys(tables);
  const nodes: Node[] = tableNames.map((tableName, index) => {
    const tableData = tables[tableName];
    const row = Math.floor(index / GRID_CONFIG.columnsPerRow);
    const col = index % GRID_CONFIG.columnsPerRow;
    const columns = tableData.columns || {};
    const columnCount = Object.keys(columns).length;
    const tableHeight = 40 + columnCount * 28 + 20;

    return {
      id: tableName, type: 'tableCard',
      position: { x: GRID_CONFIG.startX + col * GRID_CONFIG.cellWidth, y: GRID_CONFIG.startY + row * GRID_CONFIG.cellHeight },
      data: { tableName, columns: tableData.columns, isSelected: false },
      width: GRID_CONFIG.tableWidth, height: tableHeight,
    };
  });

  const edges: Edge[] = [];
  relationships.forEach((rel) => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;
    if (!tables[fromTable] || !tables[toTable]) return;
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];
    if (!sourceColumn || !targetColumn) return;

    const relationType = sourceColumn.unique ? 'ONE_TO_ONE' : 'ONE_TO_MANY';
    const sourceNode = nodes.find((n) => n.id === fromTable);
    const targetNode = nodes.find((n) => n.id === toTable);
    let sourceHandle = 'right', targetHandle = 'left';

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

    edges.push({ id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`, source: fromTable, target: toTable, sourceHandle, targetHandle, type: 'direct', data: { fromTable, fromColumn, toTable, toColumn, relationType, constraintName: constraintName || `fk_${fromTable}_${fromColumn}`, isUserCreated: false } });
  });

  return { nodes, edges };
};

export const recalculateGridLayout = (schemaData: ERDData, currentNodes: Node[]): { nodes: Node[]; edges: Edge[] } => {
  const { tables, relationships = [] } = schemaData;
  const edges: Edge[] = [];

  relationships.forEach((rel) => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;
    if (!tables[fromTable] || !tables[toTable]) return;
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];
    if (!sourceColumn || !targetColumn) return;

    const relationType = sourceColumn.unique ? 'ONE_TO_ONE' : 'ONE_TO_MANY';
    const sourceNode = currentNodes.find((n) => n.id === fromTable);
    const targetNode = currentNodes.find((n) => n.id === toTable);
    let sourceHandle = 'right', targetHandle = 'left';

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

    edges.push({ id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`, source: fromTable, target: toTable, sourceHandle, targetHandle, type: 'direct', data: { fromTable, fromColumn, toTable, toColumn, relationType, constraintName: constraintName || `fk_${fromTable}_${fromColumn}`, isUserCreated: false } });
  });

  return { nodes: currentNodes, edges };
};

export default calculateGridLayout;
