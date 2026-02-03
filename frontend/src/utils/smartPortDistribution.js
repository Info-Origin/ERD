/**
 * Smart Port Distribution System
 * 
 * This system distributes relationship connections across different points on table sides,
 * similar to MySQL Workbench reverse engineering. It:
 * 1. Calculates optimal connection sides based on shortest route
 * 2. Distributes multiple connections across different ports on the same side
 * 3. Ensures no two relationships use the same connection point
 * 4. Works with straight lines (no complex routing needed)
 */

/**
 * Calculate the optimal connection side based on table positions
 * @param {Object} sourceNode - Source table node with position
 * @param {Object} targetNode - Target table node with position
 * @returns {Object} { sourceSide, targetSide }
 */
const calculateOptimalSides = (sourceNode, targetNode) => {
  if (!sourceNode || !targetNode) {
    return { sourceSide: 'right', targetSide: 'left' };
  }

  const sourceCenter = {
    x: sourceNode.position.x + 160, // Half of table width (320px)
    y: sourceNode.position.y + 100  // Half of table height (200px)
  };
  
  const targetCenter = {
    x: targetNode.position.x + 160,
    y: targetNode.position.y + 100
  };

  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;
  
  // Determine primary direction (horizontal vs vertical)
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // Horizontal connection preferred
    return deltaX > 0 
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  } else {
    // Vertical connection preferred
    return deltaY > 0 
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
};

/**
 * Calculate dynamic port count based on table's relationship density
 * @param {string} tableName - Name of the table
 * @param {Array} relationships - All relationships in the schema
 * @returns {number} Number of ports needed per side for this table
 */
const calculateDynamicPortCount = (tableName, relationships) => {
  // Count relationships involving this table
  const tableRelationships = relationships.filter(rel => 
    rel.fromTable === tableName || rel.toTable === tableName
  );
  
  const relationshipCount = tableRelationships.length;
  
  // Dynamic scaling with reasonable limits
  if (relationshipCount <= 5) return 5;        // Default: 5 ports per side
  if (relationshipCount <= 20) return 8;       // Medium: 8 ports per side  
  if (relationshipCount <= 50) return 12;      // High: 12 ports per side
  return 15;                                    // Maximum: 15 ports per side
};

/**
 * Distribute relationships across multiple ports on table sides
 * @param {Array} relationships - Array of relationship objects
 * @param {Array} nodes - Array of table nodes with positions
 * @returns {Array} Relationships with assigned port information
 */
export const distributeRelationshipPorts = (relationships, nodes) => {
  // Create a map of nodes by ID for quick lookup
  const nodeMap = {};
  nodes.forEach(node => {
    nodeMap[node.id] = node;
  });

  // Calculate dynamic port counts for each table
  const tablePortCounts = {};
  nodes.forEach(node => {
    tablePortCounts[node.id] = calculateDynamicPortCount(node.id, relationships);
  });

  // Group relationships by table pairs and calculate optimal sides
  const tableConnections = {};
  const distributedRelationships = [];
  
  relationships.forEach((rel, index) => {
    const sourceNode = nodeMap[rel.fromTable];
    const targetNode = nodeMap[rel.toTable];
    
    if (!sourceNode || !targetNode) {
      console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
      return;
    }

    // Calculate optimal connection sides
    const { sourceSide, targetSide } = calculateOptimalSides(sourceNode, targetNode);
    
    // Create unique key for this table side
    const sourceKey = `${rel.fromTable}-${sourceSide}`;
    const targetKey = `${rel.toTable}-${targetSide}`;
    
    // Initialize connection tracking
    if (!tableConnections[sourceKey]) {
      tableConnections[sourceKey] = 0;
    }
    if (!tableConnections[targetKey]) {
      tableConnections[targetKey] = 0;
    }
    
    // Assign port indices
    const sourcePortIndex = tableConnections[sourceKey];
    const targetPortIndex = tableConnections[targetKey];
    
    // Increment counters
    tableConnections[sourceKey]++;
    tableConnections[targetKey]++;
    
    // Create distributed relationship with dynamic port info
    distributedRelationships.push({
      ...rel,
      sourceSide,
      targetSide,
      sourcePortIndex,
      targetPortIndex,
      // Add dynamic port metadata for handle generation
      sourceMaxPorts: tablePortCounts[rel.fromTable] || 5,
      targetMaxPorts: tablePortCounts[rel.toTable] || 5
    });
  });

  return distributedRelationships;
};

/**
 * Generate handle IDs for React Flow based on port distribution
 * @param {string} tableName - Name of the table
 * @param {string} side - Connection side (top, bottom, left, right)
 * @param {number} portIndex - Port index on that side
 * @param {string} type - Handle type (source or target)
 * @returns {string} Handle ID
 */
export const generateHandleId = (tableName, side, portIndex, type) => {
  return `${tableName}-${side}-${portIndex}-${type}`;
};

/**
 * Calculate port position on table side - positioned exactly at table border
 * @param {string} side - Connection side (top, bottom, left, right)
 * @param {number} portIndex - Port index on that side
 * @param {number} totalPorts - Total ports on that side
 * @returns {Object} Position style object
 */
export const calculatePortPosition = (side, portIndex, totalPorts) => {
  const spacing = totalPorts > 1 ? 80 / (totalPorts + 1) : 50; // Distribute across 80% of side
  const offset = (portIndex + 1) * spacing;
  
  switch (side) {
    case 'top':
      return {
        top: '0px',
        left: `${offset}%`,
        transform: 'translate(-50%, -2px)' // Slightly outside the border for better connection
      };
    case 'bottom':
      return {
        bottom: '0px',
        left: `${offset}%`,
        transform: 'translate(-50%, 2px)' // Slightly outside the border for better connection
      };
    case 'left':
      return {
        left: '0px',
        top: `${offset}%`,
        transform: 'translate(-2px, -50%)' // Slightly outside the border for better connection
      };
    case 'right':
      return {
        right: '0px',
        top: `${offset}%`,
        transform: 'translate(2px, -50%)' // Slightly outside the border for better connection
      };
    default:
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
  }
};