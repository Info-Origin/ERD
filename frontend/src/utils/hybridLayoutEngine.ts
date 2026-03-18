import type { ERDData, Relationship } from '../types';
import type { Node, Edge } from '@xyflow/react';

const buildRelationshipMap = (relationships: Relationship[]) => {
  const parentToChildren = new Map<string, string[]>();
  const childToParent = new Map<string, string[]>();
  relationships.forEach((rel) => {
    if (!parentToChildren.has(rel.toTable)) parentToChildren.set(rel.toTable, []);
    parentToChildren.get(rel.toTable)!.push(rel.fromTable);
    if (!childToParent.has(rel.fromTable)) childToParent.set(rel.fromTable, []);
    childToParent.get(rel.fromTable)!.push(rel.toTable);
  });
  return { parentToChildren, childToParent };
};

const findRootTables = (allTables: Set<string>, parentToChildren: Map<string, string[]>, childToParent: Map<string, string[]>): Set<string> => {
  const roots = new Set<string>();
  allTables.forEach((tableName) => {
    if (parentToChildren.has(tableName) && !childToParent.has(tableName)) roots.add(tableName);
  });
  return roots;
};

interface HierarchyNode { table: string; children: HierarchyNode[]; }

const buildHierarchyTree = (rootTable: string, parentToChildren: Map<string, string[]>, visited = new Set<string>()): HierarchyNode | null => {
  if (visited.has(rootTable)) return null;
  visited.add(rootTable);
  const children = parentToChildren.get(rootTable) || [];
  return { table: rootTable, children: children.map((child) => buildHierarchyTree(child, parentToChildren, new Set(visited))).filter(Boolean) as HierarchyNode[] };
};

interface LayoutConfig { verticalSpacing: number; horizontalSpacing: number; }
interface PositionEntry { table: string; x: number; y: number; depth: number; }

const layoutHierarchyTree = (tree: HierarchyNode, startX: number, startY: number, config: LayoutConfig): PositionEntry[] => {
  const positions: PositionEntry[] = [];
  const depthXPositions = new Map<number, number>();

  const traverse = (node: HierarchyNode, depth: number, parentX: number) => {
    if (!depthXPositions.has(depth)) depthXPositions.set(depth, parentX);
    const x = depthXPositions.get(depth)!;
    const y = startY + depth * config.verticalSpacing;
    positions.push({ table: node.table, x, y, depth });
    depthXPositions.set(depth, x + config.horizontalSpacing);
    node.children.forEach((child) => traverse(child, depth + 1, x));
  };

  traverse(tree, 0, startX);
  return positions;
};

export const calculateHybridLayout = (schemaData: ERDData, savedPositions: Record<string, { x: number; y: number }> = {}): { nodes: Node[]; edges: Edge[] } => {
  const { tables, relationships = [] } = schemaData;
  if (!tables || Object.keys(tables).length === 0) return { nodes: [], edges: [] };

  const HIERARCHY_CONFIG = { verticalSpacing: 400, horizontalSpacing: 350, startX: 200, startY: 200 };
  const GRID_CONFIG = { columnsPerRow: 6, cellWidth: 400, cellHeight: 500, startX: 200, startY: 200 };

  const { parentToChildren, childToParent } = buildRelationshipMap(relationships);
  const allTables = new Set(Object.keys(tables));
  const rootTables = findRootTables(allTables, parentToChildren, childToParent);

  const hierarchyTables = new Set<string>();
  const hierarchyPositions: PositionEntry[] = [];
  let currentHierarchyX = HIERARCHY_CONFIG.startX;

  rootTables.forEach((rootTable) => {
    const tree = buildHierarchyTree(rootTable, parentToChildren);
    if (tree) {
      const positions = layoutHierarchyTree(tree, currentHierarchyX, HIERARCHY_CONFIG.startY, HIERARCHY_CONFIG);
      hierarchyPositions.push(...positions);
      positions.forEach((pos) => hierarchyTables.add(pos.table));
      const maxX = Math.max(...positions.map((p) => p.x));
      currentHierarchyX = maxX + HIERARCHY_CONFIG.horizontalSpacing * 2;
    }
  });

  const isolatedTables = Array.from(allTables).filter((table) => !hierarchyTables.has(table));
  const maxHierarchyY = hierarchyPositions.length > 0 ? Math.max(...hierarchyPositions.map((p) => p.y)) + GRID_CONFIG.cellHeight : GRID_CONFIG.startY;

  const gridPositions: PositionEntry[] = isolatedTables.map((tableName, index) => ({
    table: tableName,
    x: GRID_CONFIG.startX + (index % GRID_CONFIG.columnsPerRow) * GRID_CONFIG.cellWidth,
    y: maxHierarchyY + Math.floor(index / GRID_CONFIG.columnsPerRow) * GRID_CONFIG.cellHeight,
    depth: -1,
  }));

  const allPositions = [...hierarchyPositions, ...gridPositions];
  const uniquePositions: PositionEntry[] = [];
  const seenTables = new Set<string>();
  allPositions.forEach((pos) => { if (!seenTables.has(pos.table)) { seenTables.add(pos.table); uniquePositions.push(pos); } });

  const nodes: Node[] = uniquePositions
    .filter((pos) => tables[pos.table])
    .map((pos) => {
      const tableData = tables[pos.table];
      const columns = tableData.columns || {};
      const columnValues = Object.values(columns);
      const pkColumns = columnValues.filter((col) => col.pk);
      const fkColumns = columnValues.filter((col) => col.fk);
      const isDetectedJunctionTable = fkColumns.length === 2 && pkColumns.length === 2 && fkColumns.every((fk) => fk.pk);
      const isJunctionTable = (tableData as { isJunctionTable?: boolean }).isJunctionTable || isDetectedJunctionTable;
      const columnCount = Object.keys(columns).length;
      const tableHeight = 40 + columnCount * 28 + 20;
      const finalPosition = savedPositions[pos.table] || { x: pos.x, y: pos.y };

      return {
        id: pos.table, type: 'tableCard', position: finalPosition,
        data: { tableName: pos.table, columns: tableData.columns, isSelected: false, hierarchyDepth: pos.depth, isJunctionTable },
        width: 280, height: tableHeight,
      };
    });

  const edges: Edge[] = relationships.map((rel) => {
    const { fromTable, fromColumn, toTable, toColumn, constraintName } = rel;
    if (!tables[fromTable] || !tables[toTable]) return null;
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];
    if (!sourceColumn || !targetColumn) return null;

    const relationType = sourceColumn.unique ? 'ONE_TO_ONE' : 'ONE_TO_MANY';
    const sourceNode = nodes.find((n) => n.id === fromTable);
    const targetNode = nodes.find((n) => n.id === toTable);
    let sourceHandle = 'right', targetHandle = 'left';

    if (sourceNode && targetNode) {
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      const isHierarchical = hierarchyTables.has(fromTable) && hierarchyTables.has(toTable);
      if (isHierarchical && Math.abs(dy) > 100) {
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      } else if (Math.abs(dx) > Math.abs(dy)) {
        sourceHandle = dx > 0 ? 'right' : 'left';
        targetHandle = dx > 0 ? 'left' : 'right';
      } else {
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
    }

    return { id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`, source: fromTable, target: toTable, sourceHandle, targetHandle, type: 'direct', data: { fromTable, fromColumn, toTable, toColumn, relationType, constraintName: constraintName || `fk_${fromTable}_${fromColumn}`, isUserCreated: false } };
  }).filter(Boolean) as Edge[];

  return { nodes, edges };
};

export default calculateHybridLayout;
