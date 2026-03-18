/**
 * Smart Port Distribution System
 */
import type { Relationship } from '../types';
import type { Node } from '@xyflow/react';

export type ConnectionSide = 'top' | 'bottom' | 'left' | 'right';

export interface DistributedRelationship extends Relationship {
  sourceSide: ConnectionSide;
  targetSide: ConnectionSide;
  sourcePortIndex: number;
  targetPortIndex: number;
  sourceMaxPorts: number;
  targetMaxPorts: number;
  isVirtualNM?: boolean;
  junctionTable?: string;
  isBundled?: boolean;
  bundledRelationships?: Relationship[];
  bundleCount?: number;
}

const calculateOptimalSides = (
  sourceNode: Node,
  targetNode: Node
): { sourceSide: ConnectionSide; targetSide: ConnectionSide } => {
  if (!sourceNode || !targetNode) return { sourceSide: 'right', targetSide: 'left' };

  const sourceCenter = { x: sourceNode.position.x + 160, y: sourceNode.position.y + 100 };
  const targetCenter = { x: targetNode.position.x + 160, y: targetNode.position.y + 100 };
  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  } else {
    return deltaY > 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
};

const calculateDynamicPortCount = (tableName: string, relationships: Relationship[]): number => {
  const count = relationships.filter(
    (rel) => rel.fromTable === tableName || rel.toTable === tableName
  ).length;
  if (count <= 5) return 5;
  if (count <= 20) return 8;
  if (count <= 50) return 12;
  return 15;
};

export const distributeRelationshipPorts = (
  relationships: (Relationship & { isVirtualNM?: boolean; junctionTable?: string; isBundled?: boolean; bundledRelationships?: Relationship[]; bundleCount?: number })[],
  nodes: Node[]
): DistributedRelationship[] => {
  const nodeMap: Record<string, Node> = {};
  nodes.forEach((node) => { nodeMap[node.id] = node; });

  const tablePortCounts: Record<string, number> = {};
  nodes.forEach((node) => {
    tablePortCounts[node.id] = calculateDynamicPortCount(node.id, relationships);
  });

  const tableConnections: Record<string, number> = {};
  const distributedRelationships: DistributedRelationship[] = [];

  relationships.forEach((rel) => {
    const sourceNode = nodeMap[rel.fromTable];
    const targetNode = nodeMap[rel.toTable];

    if (!sourceNode || !targetNode) {
      console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
      return;
    }

    const { sourceSide, targetSide } = calculateOptimalSides(sourceNode, targetNode);
    const sourceKey = `${rel.fromTable}-${sourceSide}`;
    const targetKey = `${rel.toTable}-${targetSide}`;

    if (!tableConnections[sourceKey]) tableConnections[sourceKey] = 0;
    if (!tableConnections[targetKey]) tableConnections[targetKey] = 0;

    const sourcePortIndex = tableConnections[sourceKey]++;
    const targetPortIndex = tableConnections[targetKey]++;

    distributedRelationships.push({
      ...rel,
      sourceSide,
      targetSide,
      sourcePortIndex,
      targetPortIndex,
      sourceMaxPorts: tablePortCounts[rel.fromTable] || 5,
      targetMaxPorts: tablePortCounts[rel.toTable] || 5,
    });
  });

  return distributedRelationships;
};

export const generateHandleId = (
  tableName: string,
  side: ConnectionSide,
  portIndex: number,
  type: 'source' | 'target'
): string => `${tableName}-${side}-${portIndex}-${type}`;

export interface PortPositionStyle {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform: string;
}

export const calculatePortPosition = (
  side: ConnectionSide,
  portIndex: number,
  totalPorts: number
): PortPositionStyle => {
  const spacing = totalPorts > 1 ? 80 / (totalPorts + 1) : 50;
  const offset = (portIndex + 1) * spacing;

  switch (side) {
    case 'top':    return { top: '0px', left: `${offset}%`, transform: 'translate(-50%, -2px)' };
    case 'bottom': return { bottom: '0px', left: `${offset}%`, transform: 'translate(-50%, 2px)' };
    case 'left':   return { left: '0px', top: `${offset}%`, transform: 'translate(-2px, -50%)' };
    case 'right':  return { right: '0px', top: `${offset}%`, transform: 'translate(2px, -50%)' };
    default:       return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
};
