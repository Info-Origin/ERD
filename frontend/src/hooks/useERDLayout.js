import { useCallback, useState, useEffect } from "react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { useApp } from "../context/AppContext";
import { useDebounce } from "./useDebounce";
import { distributeRelationshipPorts, generateHandleId } from "../utils/smartPortDistribution";

/**
 * Simple ERD Layout Hook
 * Basic layout without complex ELK.js routing
 */
export const useERDLayout = (erdData, selectedTable, filteredTables = null, highlightedTable = null) => {
  const { 
    tablePositions, 
    updateTablePosition
  } = useApp();

  // State for simple layout
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [layoutError, setLayoutError] = useState(null);
  
  // Debounced position updates to reduce localStorage writes
  const [pendingPositionUpdates, setPendingPositionUpdates] = useState({});
  const debouncedPositionUpdates = useDebounce(pendingPositionUpdates, 300);
  
  // Apply debounced position updates
  useEffect(() => {
    if (Object.keys(debouncedPositionUpdates).length > 0) {
      Object.entries(debouncedPositionUpdates).forEach(([nodeId, position]) => {
        updateTablePosition(nodeId, position);
      });
      setPendingPositionUpdates({});
    }
  }, [debouncedPositionUpdates, updateTablePosition]);

  // Force re-layout with port recalculation
  const forceLayout = useCallback(() => {
    if (!erdData || !erdData.tables || Object.keys(erdData.tables).length === 0) {
      return;
    }

    try {
      // Get current nodes for position-aware port distribution
      setNodes(currentNodes => {
        // SCHEMA-SCOPED RELATIONSHIP FILTERING
        const currentTableNames = new Set(Object.keys(erdData.tables));
        const visibleTableNames = filteredTables ? new Set(filteredTables) : currentTableNames;
        
        const schemaFilteredRelationships = (erdData.relationships || []).filter(rel => {
          const hasSourceTable = currentTableNames.has(rel.fromTable);
          const hasTargetTable = currentTableNames.has(rel.toTable);
          const sourceVisible = visibleTableNames.has(rel.fromTable);
          const targetVisible = visibleTableNames.has(rel.toTable);
          
          if (!hasSourceTable || !hasTargetTable) {
            console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
            return false;
          }
          
          return sourceVisible && targetVisible;
        });
        
        // Create edges using current node positions
        const distributedRelationships = distributeRelationshipPorts(
          schemaFilteredRelationships, 
          currentNodes
        );
        
        const newEdges = distributedRelationships.map((rel) => {
          const sourceHandle = generateHandleId(
            rel.fromTable, 
            rel.sourceSide, 
            rel.sourcePortIndex, 
            'source'
          );
          const targetHandle = generateHandleId(
            rel.toTable, 
            rel.targetSide, 
            rel.targetPortIndex, 
            'target'
          );

          return {
            id: `db-rel-${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`,
            source: rel.fromTable,
            target: rel.toTable,
            sourceHandle: sourceHandle,
            targetHandle: targetHandle,
            type: 'relationship',
            data: {
              fromTable: rel.fromTable,
              fromColumn: rel.fromColumn,
              toTable: rel.toTable,
              toColumn: rel.toColumn,
              relationType: rel.type || 'ONE_TO_MANY',
              type: rel.type || 'ONE_TO_MANY', // For backward compatibility
              cardinalityType: rel.cardinalityType || '1:N',
              constraintName: rel.constraintName,
              isUserCreated: false,
              isIdentifying: rel.isIdentifying, // Pass through identifying relationship flag
              isUnique: rel.isUnique, // Pass through unique constraint flag
              isJunctionTable: rel.isJunctionTable, // Pass through junction table flag
              sourceSide: rel.sourceSide,
              targetSide: rel.targetSide,
              sourcePortIndex: rel.sourcePortIndex,
              targetPortIndex: rel.targetPortIndex
            }
          };
        });

        // Update edges with new port distribution
        const uniqueEdges = [];
        const seenIds = new Set();
        
        newEdges.forEach(edge => {
          if (!seenIds.has(edge.id)) {
            seenIds.add(edge.id);
            uniqueEdges.push(edge);
          }
        });

        setEdges(uniqueEdges);
        return currentNodes; // Return unchanged nodes
      });
    } catch (error) {
      console.error('❌ Force layout failed:', error);
    }
  }, [erdData, filteredTables]);

  // Simple layout calculation - optimized to reduce re-renders
  const calculateLayout = useCallback(() => {
    if (!erdData || !erdData.tables || Object.keys(erdData.tables).length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setLayoutError(null);

    try {
      // Filter tables if filteredTables is provided
      let tablesToShow = Object.entries(erdData.tables);
      if (filteredTables && Array.isArray(filteredTables)) {
        tablesToShow = tablesToShow.filter(([tableName]) => 
          filteredTables.includes(tableName)
        );
      }

      // Create grid layout for tables - MySQL Workbench style
      const GRID_CONFIG = {
        columnsPerRow: 4, // 4 tables per row like Workbench
        cellWidth: 400, // Horizontal spacing
        cellHeight: 500, // Vertical spacing
        startX: 200, // Starting position
        startY: 200,
      };
      
      const simpleNodes = tablesToShow.map(([tableName, tableData], index) => {
        // Calculate grid position
        const row = Math.floor(index / GRID_CONFIG.columnsPerRow);
        const col = index % GRID_CONFIG.columnsPerRow;
        
        const gridPosition = {
          x: GRID_CONFIG.startX + (col * GRID_CONFIG.cellWidth),
          y: GRID_CONFIG.startY + (row * GRID_CONFIG.cellHeight)
        };
        
        // Check if saved position exists
        const savedPosition = tablePositions[tableName];
        let finalPosition = gridPosition;
        
        if (savedPosition) {
          // Use saved position if it exists
          finalPosition = savedPosition;
        }
        
        return {
          id: tableName,
          type: 'tableCard',
          position: finalPosition,
          data: {
            tableName: tableName,
            columns: tableData.columns,
            isSelected: tableName === selectedTable,
            isHighlighted: tableName === highlightedTable // Add highlight information
          }
        };
      });

      // SCHEMA-SCOPED RELATIONSHIP FILTERING
      // Only process relationships where BOTH source and target tables exist in current schema
      // AND are in the filtered tables list (if filtering is active)
      const currentTableNames = new Set(Object.keys(erdData.tables));
      const visibleTableNames = filteredTables ? new Set(filteredTables) : currentTableNames;
      
      const schemaFilteredRelationships = (erdData.relationships || []).filter(rel => {
        const hasSourceTable = currentTableNames.has(rel.fromTable);
        const hasTargetTable = currentTableNames.has(rel.toTable);
        const sourceVisible = visibleTableNames.has(rel.fromTable);
        const targetVisible = visibleTableNames.has(rel.toTable);
        
        if (!hasSourceTable || !hasTargetTable) {
          // Keep the existing console warning for debugging (as requested)
          console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
          return false; // Skip this relationship
        }
        
        // Only show relationships where both tables are visible
        return sourceVisible && targetVisible;
      });
      
      // Create edges using smart port distribution with initial node positions
      const distributedRelationships = distributeRelationshipPorts(
        schemaFilteredRelationships, 
        simpleNodes
      );
      
      const simpleEdges = distributedRelationships.map((rel) => {
        // Generate smart handle IDs based on port distribution
        const sourceHandle = generateHandleId(
          rel.fromTable, 
          rel.sourceSide, 
          rel.sourcePortIndex, 
          'source'
        );
        const targetHandle = generateHandleId(
          rel.toTable, 
          rel.targetSide, 
          rel.targetPortIndex, 
          'target'
        );

        return {
          id: `db-rel-${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`,
          source: rel.fromTable,
          target: rel.toTable,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          type: 'relationship',
          data: {
            fromTable: rel.fromTable,
            fromColumn: rel.fromColumn,
            toTable: rel.toTable,
            toColumn: rel.toColumn,
            relationType: rel.type || 'ONE_TO_MANY',
            type: rel.type || 'ONE_TO_MANY', // For backward compatibility
            cardinalityType: rel.cardinalityType || '1:N',
            constraintName: rel.constraintName,
            isUserCreated: false,
            isIdentifying: rel.isIdentifying, // Pass through identifying relationship flag
            isUnique: rel.isUnique, // Pass through unique constraint flag
            isJunctionTable: rel.isJunctionTable, // Pass through junction table flag
            // Port distribution metadata
            sourceSide: rel.sourceSide,
            targetSide: rel.targetSide,
            sourcePortIndex: rel.sourcePortIndex,
            targetPortIndex: rel.targetPortIndex
          }
        };
      });

      // Use smart distributed edges
      const uniqueEdges = [];
      const seenIds = new Set();
      
      simpleEdges.forEach(edge => {
        if (!seenIds.has(edge.id)) {
          seenIds.add(edge.id);
          uniqueEdges.push(edge);
        }
      });

      // Always update nodes and edges for initial layout
      setNodes(simpleNodes);
      setEdges(uniqueEdges);

    } catch (error) {
      console.error('❌ Layout failed:', error);
      setLayoutError(error.message);
    }
  }, [erdData, selectedTable, filteredTables, highlightedTable]); // Added highlightedTable dependency

  // Initial positioning - only runs when schema changes, not on every position update
  const applyInitialPositions = useCallback((nodes) => {
    return nodes.map(node => {
      const savedPosition = tablePositions[node.id];
      if (savedPosition) {
        // Validate saved position
        const maxDistance = 2000;
        const distance = Math.sqrt(savedPosition.x * savedPosition.x + savedPosition.y * savedPosition.y);
        
        if (distance <= maxDistance) {
          return { ...node, position: savedPosition };
        }
      }
      return node; // Keep original grid position
    });
  }, [tablePositions]);

  // Calculate layout when data changes - but not when positions change
  useEffect(() => {
    if (erdData && Object.keys(erdData.tables || {}).length > 0) {
      calculateLayout();
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [erdData, calculateLayout]);

  // Apply saved positions after initial layout - separate from layout calculation
  useEffect(() => {
    if (nodes.length > 0 && Object.keys(tablePositions).length > 0) {
      const nodesWithSavedPositions = applyInitialPositions(nodes);
      // Only update if positions actually changed
      const hasChanges = nodesWithSavedPositions.some((node, index) => 
        node.position.x !== nodes[index].position.x || 
        node.position.y !== nodes[index].position.y
      );
      
      if (hasChanges) {
        setNodes(nodesWithSavedPositions);
      }
    }
  }, [erdData?.schemaName]); // Only run when schema changes, not on every position update

  // Handle node changes (dragging, selection, etc.) - optimized for smooth dragging
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      
      // Check if any nodes were dragged (position changed and dragging stopped)
      const dragStoppedChanges = changes.filter(change => 
        change.type === 'position' && 
        change.dragging === false && 
        change.position &&
        !change.positionAbsolute
      );
      
      // Only save positions when dragging is complete (not during drag)
      if (dragStoppedChanges.length > 0) {
        const newUpdates = {};
        dragStoppedChanges.forEach(change => {
          const node = updatedNodes.find(n => n.id === change.id);
          if (node) {
            newUpdates[node.id] = change.position;
          }
        });
        
        setPendingPositionUpdates(prev => ({ ...prev, ...newUpdates }));
        
        // Trigger port redistribution after drag stops
        setTimeout(() => {
          // Recalculate edges with new positions using forceLayout
          forceLayout();
        }, 100);
      }
      
      return updatedNodes;
    });
  }, [forceLayout]);

  // Handle edge changes (selection only)
  const onEdgesChange = useCallback((changes) => {
    const allowedChanges = changes.filter(change => 
      change.type === 'select' || change.type === 'position'
    );
    setEdges((eds) => applyEdgeChanges(allowedChanges, eds));
  }, []);

  // Get initial viewport - calculate based on nodes if available
  const getInitialViewport = useCallback(() => {
    if (nodes.length === 0) {
      return {
        x: 0,
        y: 0,
        zoom: 1,
      };
    }

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const nodeWidth = 320; // Default table width
      const nodeHeight = 200; // Estimated table height
      
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    // Calculate center point
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate zoom to fit content (assuming viewport is ~1200x800)
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const viewportWidth = 1200;
    const viewportHeight = 800;
    
    const zoomX = viewportWidth / (contentWidth + 200); // Add padding
    const zoomY = viewportHeight / (contentHeight + 200); // Add padding
    const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.3), 1.5); // Clamp zoom
    
    return {
      x: viewportWidth / 2 - centerX * zoom,
      y: viewportHeight / 2 - centerY * zoom,
      zoom: zoom,
    };
  }, [nodes]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    getInitialViewport,
    forceLayout,
    layoutError,
  };
};

export default useERDLayout;