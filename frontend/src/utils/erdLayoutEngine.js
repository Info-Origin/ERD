import dagre from "dagre";
import { LAYOUT_CONFIG } from "./constants";

/**
 * Calculate auto-layout positions for nodes using Dagre with improved spacing
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {string} direction - Layout direction ('TB' or 'LR')
 * @returns {Array} Nodes with calculated positions
 */
export const calculateLayout = (nodes, edges, direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: LAYOUT_CONFIG.RANK_SEP,
    nodesep: LAYOUT_CONFIG.NODE_SEP,
    edgesep: 100, // Increased edge separation
    marginx: 80, // Increased margin
    marginy: 80,
  });

  // Add nodes to dagre graph with proper dimensions
  nodes.forEach((node) => {
    const nodeWidth = node.width || LAYOUT_CONFIG.NODE_WIDTH;
    const nodeHeight = node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT;
    
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    if (edge.source && edge.target) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes with better spacing
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = node.width || LAYOUT_CONFIG.NODE_WIDTH;
    const nodeHeight = node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};

/**
 * Center the diagram in the viewport
 * @param {Array} nodes - Nodes with positions
 * @returns {Object} { x, y, zoom } for fitView
 */
export const getCenterPosition = (nodes) => {
  if (!nodes || nodes.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const bounds = nodes.reduce(
    (acc, node) => {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.width || LAYOUT_CONFIG.NODE_WIDTH;
      const height = node.height || LAYOUT_CONFIG.NODE_MIN_HEIGHT;

      return {
        minX: Math.min(acc.minX, x),
        minY: Math.min(acc.minY, y),
        maxX: Math.max(acc.maxX, x + width),
        maxY: Math.max(acc.maxY, y + height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return { x: centerX, y: centerY, zoom: 0.8 };
};
