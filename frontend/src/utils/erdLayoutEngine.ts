import dagre from 'dagre';
import { LAYOUT_CONFIG } from './constants';
import type { Node, Edge } from '@xyflow/react';

export const calculateLayout = (nodes: Node[], edges: Edge[], direction = 'TB'): Node[] => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: LAYOUT_CONFIG.RANK_SEP, nodesep: LAYOUT_CONFIG.NODE_SEP, edgesep: 100, marginx: 80, marginy: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.width || LAYOUT_CONFIG.NODE_WIDTH, height: node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT });
  });

  edges.forEach((edge) => {
    if (edge.source && edge.target) dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = node.width || LAYOUT_CONFIG.NODE_WIDTH;
    const nodeHeight = node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT;
    return { ...node, position: { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 } };
  });
};

export const getCenterPosition = (nodes: Node[]): { x: number; y: number; zoom: number } => {
  if (!nodes || nodes.length === 0) return { x: 0, y: 0, zoom: 1 };

  const bounds = nodes.reduce(
    (acc, node) => {
      const x = node.position.x, y = node.position.y;
      const width = node.width || LAYOUT_CONFIG.NODE_WIDTH;
      const height = node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT;
      return { minX: Math.min(acc.minX, x), minY: Math.min(acc.minY, y), maxX: Math.max(acc.maxX, x + width), maxY: Math.max(acc.maxY, y + height) };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, zoom: 0.8 };
};
