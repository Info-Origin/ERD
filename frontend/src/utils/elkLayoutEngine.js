/**
 * ELK.js Layout Engine for Professional MySQL Workbench ERD
 *
 * This module uses ELK.js as the "diagram brain" for layout, ports, and routing.
 * React Flow is only used as the "renderer" for nodes, edges, and interactions.
 */

import ELK from "elkjs/lib/elk.bundled.js";

// Initialize ELK instance
let elk;
try {
  elk = new ELK();
} catch (error) {
  console.error("ELK.js initialization failed:", error);
}

/**
 * Convert schema tables to ELK nodes with column ports
 * @param {Object} tables - Schema tables object
 * @returns {Array} ELK nodes with ports
 */
const createELKNodes = (tables) => {
  const nodes = [];

  Object.entries(tables).forEach(([tableName, tableData]) => {
    const columns = tableData.columns || {};
    const columnEntries = Object.entries(columns);

    // Professional column ordering: PK → FK → Others
    const orderedColumns = columnEntries.sort(
      ([nameA, colA], [nameB, colB]) => {
        if (colA.pk && !colB.pk) return -1;
        if (!colA.pk && colB.pk) return 1;
        if (colA.fk && !colB.fk) return -1;
        if (!colA.fk && colB.fk) return 1;
        return nameA.localeCompare(nameB);
      },
    );

    // Create ports for each column on all 4 sides
    const ports = [];
    orderedColumns.forEach(([columnName, columnData], index) => {
      const basePortId = `${tableName}.${columnName}`;

      // Create multiple distinct ports per column on each side
      ["NORTH", "SOUTH", "EAST", "WEST"].forEach((side) => {
        // Create 3 distinct ports per column per side for non-overlapping connections
        for (let portIndex = 0; portIndex < 3; portIndex++) {
          // Source port
          ports.push({
            id: `${basePortId}.${side}.${portIndex}-source`,
            properties: {
              "port.side": side,
              "port.index": index * 6 + portIndex * 2, // Unique index per port
              "port.subIndex": portIndex, // Sub-index for distribution along side
              "port.type": "source",
              "column.name": columnName,
              "column.isPK": columnData.pk || false,
              "column.isFK": columnData.fk || false,
              "column.isUnique": columnData.unique || false,
              "port.baseId": basePortId,
            },
          });

          // Target port
          ports.push({
            id: `${basePortId}.${side}.${portIndex}-target`,
            properties: {
              "port.side": side,
              "port.index": index * 6 + portIndex * 2 + 1, // Unique index per port
              "port.subIndex": portIndex, // Sub-index for distribution along side
              "port.type": "target",
              "column.name": columnName,
              "column.isPK": columnData.pk || false,
              "column.isFK": columnData.fk || false,
              "column.isUnique": columnData.unique || false,
              "port.baseId": basePortId,
            },
          });
        }
      });

      // Also create a base port that ELK can use for automatic selection
      ports.push({
        id: basePortId,
        properties: {
          "port.side": "UNDEFINED", // Let ELK choose
          "port.index": index,
          "port.type": "both",
          "column.name": columnName,
          "column.isPK": columnData.pk || false,
          "column.isFK": columnData.fk || false,
          "column.isUnique": columnData.unique || false,
          "port.baseId": basePortId,
        },
      });
    });

    // Calculate node dimensions based on content
    const headerHeight = 40;
    const rowHeight = 28;
    const nodeWidth = 280;
    const nodeHeight = headerHeight + orderedColumns.length * rowHeight + 20;

    nodes.push({
      id: tableName,
      width: nodeWidth,
      height: nodeHeight,
      ports: ports,
      properties: {
        "table.name": tableName,
        "table.columnCount": orderedColumns.length,
      },
    });
  });

  return nodes;
};
/**
 * Convert schema relationships to ELK edges with column-level connections
 * @param {Array} relationships - Schema relationships array
 * @param {Object} tables - Schema tables for column validation
 * @returns {Array} ELK edges
 */
const createELKEdges = (relationships, tables) => {
  const edges = [];

  relationships.forEach((rel, index) => {
    const { fromTable, fromColumn, toTable, toColumn } = rel;

    // Validate that columns exist
    const sourceColumn = tables[fromTable]?.columns?.[fromColumn];
    const targetColumn = tables[toTable]?.columns?.[toColumn];

    if (!sourceColumn || !targetColumn) {
      console.warn(
        `Invalid relationship: ${fromTable}.${fromColumn} → ${toTable}.${toColumn}`,
      );
      return;
    }

    // Determine relationship type
    let relationType = "ONE_TO_MANY";
    if (sourceColumn.unique) {
      relationType = "ONE_TO_ONE";
    }

    // Create ELK edge with flexible port selection
    // Let ELK choose the best ports automatically - don't hardcode sides
    const sourcePortId = `${fromTable}.${fromColumn}`;
    const targetPortId = `${toTable}.${toColumn}`;

    edges.push({
      id: `fk-${fromTable}-${fromColumn}-${toTable}-${toColumn}`,
      sources: [sourcePortId], // Let ELK choose the best source port
      targets: [targetPortId], // Let ELK choose the best target port
      properties: {
        "relationship.type": relationType,
        "relationship.fromTable": fromTable,
        "relationship.fromColumn": fromColumn,
        "relationship.toTable": toTable,
        "relationship.toColumn": toColumn,
        "relationship.constraintName":
          rel.constraintName || `fk_${fromTable}_${fromColumn}`,
      },
    });
  });

  return edges;
};

/**
 * Create ELK graph from schema data
 * @param {Object} schemaData - Complete schema data with tables and relationships
 * @returns {Object} ELK graph object
 */
const createELKGraph = (schemaData) => {
  const { tables, relationships } = schemaData;

  const nodes = createELKNodes(tables);
  const edges = createELKEdges(relationships || [], tables);

  return {
    id: "root",
    properties: {
      // ELK Force-Based Algorithm for Better Spacing
      "elk.algorithm": "force",
      "elk.direction": "DOWN",

      // Force-based spacing parameters
      "elk.force.repulsion": "200.0", // Strong repulsion between nodes
      "elk.force.temperature": "0.3", // Lower temperature for stable layout
      "elk.force.iterations": "500", // More iterations for better convergence

      // Orthogonal Edge Routing
      "elk.edgeRouting": "ORTHOGONAL",

      // Port Constraints - FREE allows ELK to choose optimal sides
      "elk.portConstraints": "FREE",

      // Spacing Configuration - Significantly increased for clean, consistent gaps
      "elk.spacing.nodeNode": "200", // Horizontal spacing between tables (much larger)
      "elk.layered.spacing.nodeNodeBetweenLayers": "250", // Vertical spacing between layers (much larger)
      "elk.spacing.edgeNode": "80", // Space between edges and nodes
      "elk.spacing.edgeEdge": "40", // Space between parallel edges
      
      // Additional padding around nodes
      "elk.padding": "[top=100,left=100,bottom=100,right=100]",
    },
    children: nodes,
    edges: edges,
  };
};
/**
 * Get a unique port for a relationship to prevent overlapping connections
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @param {string} side - Connection side (NORTH, SOUTH, EAST, WEST)
 * @param {string} type - Port type (source or target)
 * @param {Map} usedPorts - Map of used ports to avoid duplicates
 * @returns {string} Unique port ID
 */
const getUniquePort = (tableName, columnName, side, type, usedPorts) => {
  const baseId = `${tableName}.${columnName}`;

  // Try each port index until we find an unused one
  for (let portIndex = 0; portIndex < 3; portIndex++) {
    const portId = `${baseId}.${side}.${portIndex}-${type}`;
    if (!usedPorts.has(portId)) {
      usedPorts.set(portId, true);
      return portId;
    }
  }

  // Fallback to base port if all specific ports are used
  const fallbackId = `${baseId}-${type}`;
  usedPorts.set(fallbackId, true);
  return fallbackId;
};

/**
 * Convert ELK layout result to React Flow format
 * @param {Object} elkResult - ELK layout result
 * @param {Object} originalTables - Original table data for node content
 * @returns {Object} { nodes, edges } for React Flow
 */
const convertELKToReactFlow = (elkResult, originalTables) => {
  const nodes = [];
  const edges = [];

  // Convert ELK nodes to React Flow nodes
  elkResult.children.forEach((elkNode) => {
    const tableName = elkNode.id;
    const tableData = originalTables[tableName];

    nodes.push({
      id: tableName,
      type: "tableCard",
      position: { x: elkNode.x, y: elkNode.y },
      data: {
        tableName: tableName,
        columns: tableData.columns,
        isSelected: false,
        // Pass ELK port information to the node
        elkPorts: elkNode.ports || [],
      },
    });
  });

  // Convert ELK edges to React Flow edges with distinct connection points
  const usedPorts = new Map(); // Track used ports to prevent overlap

  elkResult.edges.forEach((elkEdge) => {
    const props = elkEdge.properties || {};

    const sourceTable = props["relationship.fromTable"];
    const targetTable = props["relationship.toTable"];
    const sourceColumn = props["relationship.fromColumn"];
    const targetColumn = props["relationship.toColumn"];

    // Determine connection sides based on table positions
    const sourceNode = elkResult.children.find((n) => n.id === sourceTable);
    const targetNode = elkResult.children.find((n) => n.id === targetTable);

    let sourceSide = "EAST";
    let targetSide = "WEST";

    if (sourceNode && targetNode) {
      // Calculate relative positions to determine best connection sides
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal arrangement
        sourceSide = dx > 0 ? "EAST" : "WEST";
        targetSide = dx > 0 ? "WEST" : "EAST";
      } else {
        // Vertical arrangement
        sourceSide = dy > 0 ? "SOUTH" : "NORTH";
        targetSide = dy > 0 ? "NORTH" : "SOUTH";
      }
    }

    // Get unique ports to prevent overlapping connections
    const sourceHandle = getUniquePort(
      sourceTable,
      sourceColumn,
      sourceSide,
      "source",
      usedPorts,
    );
    const targetHandle = getUniquePort(
      targetTable,
      targetColumn,
      targetSide,
      "target",
      usedPorts,
    );

    edges.push({
      id: elkEdge.id,
      source: sourceTable,
      target: targetTable,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      type: "elkRelationship",
      data: {
        fromTable: sourceTable,
        fromColumn: sourceColumn,
        toTable: targetTable,
        toColumn: targetColumn,
        relationType: props["relationship.type"],
        constraintName: props["relationship.constraintName"],
        isUserCreated: false,
        elkSections: elkEdge.sections || [],
      },
      // Use ELK bend points for orthogonal routing
      ...(elkEdge.sections &&
        elkEdge.sections.length > 0 && {
          pathfindingType: "elk-orthogonal",
          elkBendPoints: elkEdge.sections[0].bendPoints || [],
        }),
    });
  });

  return { nodes, edges };
};

/**
 * Re-calculate layout with updated node positions (for dynamic port selection)
 * @param {Object} schemaData - Schema data with tables and relationships
 * @param {Array} currentNodes - Current React Flow nodes with updated positions
 * @returns {Promise<Object>} Promise resolving to { nodes, edges } for React Flow
 */
export const recalculateERDLayout = async (schemaData, currentNodes) => {
  try {
    if (!elk) {
      throw new Error("ELK.js not initialized");
    }

    // Validate input data
    if (!schemaData || !schemaData.tables) {
      throw new Error("Invalid schema data: missing tables");
    }

    // Create ELK graph from schema
    const elkGraph = createELKGraph(schemaData);

    // Update node positions in ELK graph based on current React Flow positions
    elkGraph.children.forEach((elkNode) => {
      const reactFlowNode = currentNodes.find((node) => node.id === elkNode.id);
      if (reactFlowNode) {
        elkNode.x = reactFlowNode.position.x;
        elkNode.y = reactFlowNode.position.y;
      }
    });

    // Run ELK layout with updated positions
    const elkResult = await elk.layout(elkGraph);

    // Convert to React Flow format
    const reactFlowData = convertELKToReactFlow(elkResult, schemaData.tables);

    // Preserve the updated positions from currentNodes
    reactFlowData.nodes.forEach((node) => {
      const currentNode = currentNodes.find((n) => n.id === node.id);
      if (currentNode) {
        node.position = currentNode.position;
        node.data = { ...node.data, ...currentNode.data };
      }
    });

    return reactFlowData;
  } catch (error) {
    console.error(" ELK Re-layout Error:", error);
    throw error;
  }
};

/**
 * Main function to calculate ERD layout using ELK.js
 * @param {Object} schemaData - Schema data with tables and relationships
 * @returns {Promise<Object>} Promise resolving to { nodes, edges } for React Flow
 */
export const calculateERDLayout = async (schemaData) => {
  try {
    if (!elk) {
      throw new Error("ELK.js not initialized");
    }

    // Validate input data
    if (!schemaData || !schemaData.tables) {
      throw new Error("Invalid schema data: missing tables");
    }

    // Add a test relationship if none exist (for debugging)
    const testSchemaData = { ...schemaData };
    if (
      !testSchemaData.relationships ||
      testSchemaData.relationships.length === 0
    ) {
      const tableNames = Object.keys(testSchemaData.tables);
      if (tableNames.length >= 2) {
        const table1 = tableNames[0];
        const table2 = tableNames[1];
        const table1Columns = Object.keys(
          testSchemaData.tables[table1].columns,
        );
        const table2Columns = Object.keys(
          testSchemaData.tables[table2].columns,
        );

        if (table1Columns.length > 0 && table2Columns.length > 0) {
          testSchemaData.relationships = [
            {
              fromTable: table1,
              fromColumn: table1Columns[0],
              toTable: table2,
              toColumn: table2Columns[0],
              type: "ONE_TO_MANY",
            },
          ];
        }
      }
    }

    // Create ELK graph from schema
    const elkGraph = createELKGraph(testSchemaData);

    // Validate edges before sending to ELK (critical for debugging)
    elkGraph.edges.forEach((edge) => {
      if (!edge.sources || edge.sources.length !== 1) {
        console.error(
          "Invalid ELK edge - sources must be array with exactly 1 element:",
          edge,
        );
      }
      if (!edge.targets || edge.targets.length !== 1) {
        console.error(
          "Invalid ELK edge - targets must be array with exactly 1 element:",
          edge,
        );
      }
    });

    // Run ELK layout
    const elkResult = await elk.layout(elkGraph);

    // Convert to React Flow format
    const reactFlowData = convertELKToReactFlow(
      elkResult,
      testSchemaData.tables,
    );

    return reactFlowData;
  } catch (error) {
    console.error(" ELK Layout Error:", error);

    // Fallback: return simple layout if ELK fails
    const fallbackNodes = Object.keys(schemaData.tables || {}).map(
      (tableName, index) => ({
        id: tableName,
        type: "tableCard",
        position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 250 },
        data: {
          tableName: tableName,
          columns: schemaData.tables[tableName].columns,
          isSelected: false,
        },
      }),
    );

    return { nodes: fallbackNodes, edges: [] };
  }
};

export default calculateERDLayout;
