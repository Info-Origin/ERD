/**
 * ELK.js Layout Engine
 */
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ERDData, TableData } from '../types';
import type { Node, Edge } from '@xyflow/react';

let elk: InstanceType<typeof ELK>;
try {
  elk = new ELK();
} catch (error) {
  console.error('ELK.js initialization failed:', error);
}

interface ELKPort {
  id: string;
  properties: Record<string, unknown>;
}

interface ELKNode {
  id: string;
  width: number;
  height: number;
  ports: ELKPort[];
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
  properties: Record<string, unknown>;
  sections?: Array<{ bendPoints?: Array<{ x: number; y: number }> }>;
}

interface ELKGraph {
  id: string;
  properties: Record<string, unknown>;
  children: ELKNode[];
  edges: ELKEdge[];
}

const createELKNodes = (tables: Record<string, TableData>): ELKNode[] => {
  const nodes: ELKNode[] = [];

  Object.entries(tables).forEach(([tableName, tableData]) => {
    const columns = tableData.columns || {};
    const columnEntries = Object.entries(columns);

    const orderedColumns = columnEntries.sort(([nameA, colA], [nameB, colB]) => {
      if (colA.pk && !colB.pk) return -1;
      if (!colA.pk && colB.pk) return 1;
      if (colA.fk && !colB.fk) return -1;
      if (!colA.fk && colB.fk) return 1;
      return nameA.localeCompare(nameB);
    });

    const ports: ELKPort[] = [];
    orderedColumns.forEach(([columnName, columnData], index) => {
      const basePortId = `${tableName}.${columnName}`;
      ['NORTH','SOUTH','EAST','WEST'].forEach((side) => {
        for (let portIndex = 0; portIndex < 3; portIndex++) {
          ports.push({ id: `${basePortId}.${side}.${portIndex}-source`, properties: { 'port.side': side, 'port.index': index * 6 + portIndex * 2, 'port.subIndex': portIndex, 'port.type': 'source', 'column.name': columnName, 'column.isPK': columnData.pk || false, 'column.isFK': columnData.fk || false, 'column.isUnique': columnData.unique || false, 'port.baseId': basePortId } });
          ports.push({ id: `${basePortId}.${side}.${portIndex}-target`, properties: { 'port.side': side, 'port.index': index * 6 + portIndex * 2 + 1, 'port.subIndex': portIndex, 'port.type': 'target', 'column.name': columnName, 'column.isPK': columnData.pk || false, 'column.isFK': columnData.fk || false, 'column.isUnique': columnData.unique || false, 'port.baseId': basePortId } });
        }
      });
      ports.push({ id: basePortId, properties: { 'port.side': 'UNDEFINED', 'port.index': index, 'port.type': 'both', 'column.name': columnName, 'column.isPK': columnData.pk || false, 'column.isFK': columnData.fk || false, 'column.isUnique': columnData.unique || false, 'port.baseId': basePortId } });
    });

    const headerHeight = 40, rowHeight = 28, nodeWidth = 280;
    const nodeHeight = headerHeight + orderedColumns.length * rowHeight + 20;
    nodes.push({ id: tableName, width: nodeWidth, height: nodeHeight, ports, properties: { 'table.name': tableName, 'table.columnCount': orderedColumns.length } });
  });

  return nodes;
};

const createELKEdges = (relationships: ERDData['relationships'], tables: Record<string, TableData>): ELKEdge[] => {
  const edges: ELKEdge[] = [];
  (relationships || []).forEach((rel) => {
    const { fromTable, fromColumn, toTable, toColumn } = rel;
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];
    if (!sourceColumn || !targetColumn) {
      console.warn(`Invalid relationship: ${fromTable}.${fromColumn} → ${toTable}.${toColumn}`);
      return;
    }
    const relationType = sourceColumn.unique ? 'ONE_TO_ONE' : 'ONE_TO_MANY';
    edges.push({ id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`, sources: [`${fromTable}.${fromColumn}`], targets: [`${toTable}.${toColumn}`], properties: { 'relationship.type': relationType, 'relationship.fromTable': fromTable, 'relationship.fromColumn': fromColumn, 'relationship.toTable': toTable, 'relationship.toColumn': toColumn, 'relationship.constraintName': rel.constraintName || `fk_${fromTable}_${fromColumn}` } });
  });
  return edges;
};

const createELKGraph = (schemaData: ERDData): ELKGraph => {
  const { tables, relationships } = schemaData;
  return {
    id: 'root',
    properties: { 'elk.algorithm': 'force', 'elk.direction': 'DOWN', 'elk.force.repulsion': '200.0', 'elk.force.temperature': '0.3', 'elk.force.iterations': '500', 'elk.edgeRouting': 'ORTHOGONAL', 'elk.portConstraints': 'FREE', 'elk.spacing.nodeNode': '200', 'elk.layered.spacing.nodeNodeBetweenLayers': '250', 'elk.spacing.edgeNode': '80', 'elk.spacing.edgeEdge': '40', 'elk.padding': '[top=100,left=100,bottom=100,right=100]' },
    children: createELKNodes(tables),
    edges: createELKEdges(relationships, tables),
  };
};

const getUniquePort = (tableName: string, columnName: string, side: string, type: string, usedPorts: Map<string, boolean>): string => {
  const baseId = `${tableName}.${columnName}`;
  for (let portIndex = 0; portIndex < 3; portIndex++) {
    const portId = `${baseId}.${side}.${portIndex}-${type}`;
    if (!usedPorts.has(portId)) { usedPorts.set(portId, true); return portId; }
  }
  const fallbackId = `${baseId}-${type}`;
  usedPorts.set(fallbackId, true);
  return fallbackId;
};

const convertELKToReactFlow = (elkResult: ELKGraph & { children: (ELKNode & { x: number; y: number })[] }, originalTables: Record<string, TableData>): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  (elkResult.children as (ELKNode & { x: number; y: number })[]).forEach((elkNode) => {
    const tableName = elkNode.id;
    const tableData = originalTables[tableName];
    nodes.push({ id: tableName, type: 'tableCard', position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 }, data: { tableName, columns: tableData.columns, isSelected: false, elkPorts: elkNode.ports || [] } });
  });

  const usedPorts = new Map<string, boolean>();
  elkResult.edges.forEach((elkEdge) => {
    const props = elkEdge.properties || {};
    const sourceTable = props['relationship.fromTable'] as string;
    const targetTable = props['relationship.toTable'] as string;
    const sourceColumn = props['relationship.fromColumn'] as string;
    const targetColumn = props['relationship.toColumn'] as string;

    const sourceNode = elkResult.children.find((n) => n.id === sourceTable);
    const targetNode = elkResult.children.find((n) => n.id === targetTable);

    let sourceSide = 'EAST', targetSide = 'WEST';
    if (sourceNode && targetNode) {
      const dx = (targetNode.x ?? 0) - (sourceNode.x ?? 0);
      const dy = (targetNode.y ?? 0) - (sourceNode.y ?? 0);
      if (Math.abs(dx) > Math.abs(dy)) {
        sourceSide = dx > 0 ? 'EAST' : 'WEST';
        targetSide = dx > 0 ? 'WEST' : 'EAST';
      } else {
        sourceSide = dy > 0 ? 'SOUTH' : 'NORTH';
        targetSide = dy > 0 ? 'NORTH' : 'SOUTH';
      }
    }

    const sourceHandle = getUniquePort(sourceTable, sourceColumn, sourceSide, 'source', usedPorts);
    const targetHandle = getUniquePort(targetTable, targetColumn, targetSide, 'target', usedPorts);

    edges.push({ id: elkEdge.id, source: sourceTable, target: targetTable, sourceHandle, targetHandle, type: 'elkRelationship', data: { fromTable: sourceTable, fromColumn: sourceColumn, toTable: targetTable, toColumn: targetColumn, relationType: props['relationship.type'], constraintName: props['relationship.constraintName'], isUserCreated: false, elkSections: elkEdge.sections || [] } });
  });

  return { nodes, edges };
};

export const recalculateERDLayout = async (schemaData: ERDData, currentNodes: Node[]): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  if (!elk) throw new Error('ELK.js not initialized');
  if (!schemaData?.tables) throw new Error('Invalid schema data: missing tables');

  const elkGraph = createELKGraph(schemaData);
  elkGraph.children.forEach((elkNode) => {
    const reactFlowNode = currentNodes.find((node) => node.id === elkNode.id);
    if (reactFlowNode) { elkNode.x = reactFlowNode.position.x; elkNode.y = reactFlowNode.position.y; }
  });

  const elkResult = await elk.layout(elkGraph as unknown as Parameters<typeof elk.layout>[0]);
  const reactFlowData = convertELKToReactFlow(elkResult as unknown as ELKGraph & { children: (ELKNode & { x: number; y: number })[] }, schemaData.tables);

  reactFlowData.nodes.forEach((node) => {
    const currentNode = currentNodes.find((n) => n.id === node.id);
    if (currentNode) { node.position = currentNode.position; node.data = { ...node.data, ...currentNode.data }; }
  });

  return reactFlowData;
};

export const calculateERDLayout = async (schemaData: ERDData): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  if (!elk) throw new Error('ELK.js not initialized');
  if (!schemaData?.tables) throw new Error('Invalid schema data: missing tables');

  const testSchemaData = { ...schemaData };
  if (!testSchemaData.relationships || testSchemaData.relationships.length === 0) {
    const tableNames = Object.keys(testSchemaData.tables);
    if (tableNames.length >= 2) {
      const [table1, table2] = tableNames;
      const t1Cols = Object.keys(testSchemaData.tables[table1].columns);
      const t2Cols = Object.keys(testSchemaData.tables[table2].columns);
      if (t1Cols.length > 0 && t2Cols.length > 0) {
        testSchemaData.relationships = [{ fromTable: table1, fromColumn: t1Cols[0], toTable: table2, toColumn: t2Cols[0], type: 'ONE_TO_MANY' }];
      }
    }
  }

  try {
    const elkGraph = createELKGraph(testSchemaData);
    const elkResult = await elk.layout(elkGraph as unknown as Parameters<typeof elk.layout>[0]);
    return convertELKToReactFlow(elkResult as unknown as ELKGraph & { children: (ELKNode & { x: number; y: number })[] }, testSchemaData.tables);
  } catch (error) {
    console.error('ELK Layout Error:', error);
    const fallbackNodes: Node[] = Object.keys(schemaData.tables || {}).map((tableName, index) => ({
      id: tableName, type: 'tableCard',
      position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 250 },
      data: { tableName, columns: schemaData.tables[tableName].columns, isSelected: false },
    }));
    return { nodes: fallbackNodes, edges: [] };
  }
};

export default calculateERDLayout;
