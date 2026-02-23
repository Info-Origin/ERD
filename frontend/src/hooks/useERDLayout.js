import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { useApp } from "../context/AppContext";
import { useVirtualSchema } from "../context/VirtualSchemaContext";
import { useDebounce } from "./useDebounce";
import { distributeRelationshipPorts, generateHandleId } from "../utils/smartPortDistribution";
import { calculateHybridLayout } from "../utils/hybridLayoutEngine";
import { bundleRelationships } from "../utils/relationshipBundler";

/**
 * Simple ERD Layout Hook
 * Basic layout without complex ELK.js routing
 */
export const useERDLayout = (erdData, selectedTable, filteredTables = null, highlightedTable = null, highlightedColumn = null, layoutResetKey = 0) => {
  const { 
    tablePositions, 
    updateTablePosition
  } = useVirtualSchema();

  // State for simple layout
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [layoutError, setLayoutError] = useState(null);
  
  // Use ref to track if we're currently calculating layout to prevent cascading updates
  const isCalculatingRef = useRef(false);
  
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
        
        // Bundle relationships with same type between same tables
        const bundledRelationships = bundleRelationships(schemaFilteredRelationships);
        
        // CREATE VIRTUAL N:M RELATIONSHIPS BEFORE PORT DISTRIBUTION
        // Find all junction tables and create virtual N:M relationships between main tables
        const junctionTables = new Map(); // Map<junctionTableName, [table1, table2]>
        
        // Identify junction tables by finding tables that have exactly 2 FK relationships
        // and both FKs are part of the composite PK
        Object.entries(erdData.tables || {}).forEach(([tableName, tableData]) => {
          const columns = Object.values(tableData.columns || {});
          const pkColumns = columns.filter(col => col.pk);
          const fkColumns = columns.filter(col => col.fk);
          
          // Junction table criteria:
          // 1. Has exactly 2 FK columns
          // 2. Both FK columns are part of PK (identifying relationships)
          // 3. PK is composite (2 columns)
          if (fkColumns.length === 2 && pkColumns.length === 2) {
            const fk1IsPK = fkColumns[0].pk;
            const fk2IsPK = fkColumns[1].pk;
            
            if (fk1IsPK && fk2IsPK) {
              // This is a junction table
              // Find the two parent tables
              const rels = schemaFilteredRelationships.filter(rel => rel.fromTable === tableName);
              if (rels.length === 2) {
                junctionTables.set(tableName, [rels[0].toTable, rels[1].toTable]);
              }
            }
          }
        });
        
        // Create virtual N:M relationships
        const virtualNMRelationships = [];
        junctionTables.forEach(([table1, table2], junctionTable) => {
          if (visibleTableNames.has(table1) && visibleTableNames.has(table2)) {
            // Check if junction table is user-created by checking if any FK from it is user-created
            const junctionFKs = schemaFilteredRelationships.filter(rel => rel.fromTable === junctionTable);
            const isUserCreatedJunction = junctionFKs.some(fk => fk.isUserCreated);
            
            virtualNMRelationships.push({
              fromTable: table1,
              toTable: table2,
              fromColumn: null,
              toColumn: null,
              type: 'MANY_TO_MANY',
              cardinalityType: 'N:M',
              isVirtualNM: true,
              junctionTable: junctionTable,
              isUserCreated: isUserCreatedJunction // Mark as user-created if junction table is user-created
            });
          }
        });
        
        // COMBINE regular relationships and virtual N:M relationships for unified port distribution
        const allRelationshipsForDistribution = [...bundledRelationships, ...virtualNMRelationships];
        
        // Create edges using current node positions
        const distributedRelationships = distributeRelationshipPorts(
          allRelationshipsForDistribution, 
          currentNodes
        );
        
        // Separate regular relationships from virtual N:M relationships after distribution
        const distributedRegularRels = distributedRelationships.filter(rel => !rel.isVirtualNM);
        const distributedNMRels = distributedRelationships.filter(rel => rel.isVirtualNM);
        
        const newEdges = distributedRegularRels.map((rel) => {
          // For visual display: parent should be source (circle), child should be target (crow's foot)
          // But relationship is stored as: fromTable=child, toTable=parent
          // So we need to SWAP for visual rendering
          
          const visualSource = rel.toTable;   // Parent (will get circle)
          const visualTarget = rel.fromTable; // Child (will get crow's foot)
          
          // Generate handles based on VISUAL direction (swapped)
          const sourceHandle = generateHandleId(
            visualSource,      // Parent
            rel.targetSide,    // Use parent's side (was targetSide)
            rel.targetPortIndex,
            'source'
          );
          const targetHandle = generateHandleId(
            visualTarget,      // Child
            rel.sourceSide,    // Use child's side (was sourceSide)
            rel.sourcePortIndex,
            'target'
          );

          // Create unique ID for bundled relationships
          const edgeId = rel.isBundled 
            ? `db-rel-bundle-${rel.fromTable}-${rel.toTable}-${rel.cardinalityType}-${rel.isIdentifying}`
            : `db-rel-${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;

          return {
            id: edgeId,
            source: visualSource,  // Parent (circle)
            target: visualTarget,  // Child (crow's foot)
            sourceHandle: sourceHandle,
            targetHandle: targetHandle,
            type: 'relationship',
            data: {
              // Keep original DB direction in data for FK detection
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
              targetPortIndex: rel.targetPortIndex,
              // Bundle information
              isBundled: rel.isBundled || false,
              bundledRelationships: rel.bundledRelationships || [rel],
              bundleCount: rel.bundleCount || 1
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

        // Create virtual N:M edges from already-distributed relationships
        distributedNMRels.forEach((rel) => {
          // STABLE ID: Use sorted table names to ensure consistent ID regardless of direction
          const [table1, table2] = [rel.fromTable, rel.toTable].sort();
          const nmEdgeId = `virtual-nm-${table1}-${table2}-via-${rel.junctionTable}`;
          
          // Generate handles with distributed ports
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
          
          const nmEdge = {
            id: nmEdgeId,
            source: rel.fromTable,
            target: rel.toTable,
            sourceHandle: sourceHandle,
            targetHandle: targetHandle,
            type: 'relationship',
            data: {
              fromTable: rel.fromTable,
              fromColumn: null,
              toTable: rel.toTable,
              toColumn: null,
              relationType: 'MANY_TO_MANY',
              type: 'MANY_TO_MANY',
              cardinalityType: 'N:M',
              isUserCreated: rel.isUserCreated || false, // Use the isUserCreated flag from relationship
              isIdentifying: false,
              isVirtualNM: true,
              junctionTable: rel.junctionTable,
              sourceSide: rel.sourceSide,
              targetSide: rel.targetSide,
              sourcePortIndex: rel.sourcePortIndex,
              targetPortIndex: rel.targetPortIndex
            }
          };
          
          // Only add if not already in uniqueEdges (prevent duplicates)
          if (!seenIds.has(nmEdgeId)) {
            seenIds.add(nmEdgeId);
            uniqueEdges.push(nmEdge);
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
    // Prevent cascading layout calculations
    if (isCalculatingRef.current) {
      console.log('⚠️ Layout calculation already in progress, skipping');
      return;
    }
    
    if (!erdData || !erdData.tables || Object.keys(erdData.tables).length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    isCalculatingRef.current = true;
    setLayoutError(null);

    try {
      // Filter tables if filteredTables is provided
      let tablesToShow = Object.entries(erdData.tables);
      if (filteredTables && Array.isArray(filteredTables)) {
        tablesToShow = tablesToShow.filter(([tableName]) => 
          filteredTables.includes(tableName)
        );
      }

      // Identify root parent tables (tables that are parents but NOT children)
      const allParents = new Set();
      const allChildren = new Set();
      
      (erdData.relationships || []).forEach(rel => {
        allParents.add(rel.toTable); // toTable is the parent (being referenced)
        allChildren.add(rel.fromTable); // fromTable is the child (referencing)
      });
      
      // Root parents are those that are parents but NOT children
      const parentTables = new Set(
        [...allParents].filter(table => !allChildren.has(table))
      );
      
      // Use hybrid layout (only layout mode)
      const filteredSchemaData = {
        tables: Object.fromEntries(tablesToShow),
        relationships: erdData.relationships || []
      };
      
      const { nodes: hybridNodes } = calculateHybridLayout(filteredSchemaData, tablePositions);
      const simpleNodes = hybridNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === selectedTable,
          isHighlighted: node.id === highlightedTable,
          isParent: parentTables.has(node.id), // Mark as parent table
          highlightedColumn: highlightedColumn?.tableName === node.id ? highlightedColumn.columnName : null // NEW: Pass highlighted column
        }
      }));

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
      
      // Bundle relationships with same type between same tables
      const bundledRelationships = bundleRelationships(schemaFilteredRelationships);
      
      // CREATE VIRTUAL N:M RELATIONSHIPS BEFORE PORT DISTRIBUTION
      // Find all junction tables and create virtual N:M relationships between main tables
      const junctionTables = new Map(); // Map<junctionTableName, [table1, table2]>
      
      // Identify junction tables by finding tables that have exactly 2 FK relationships
      // and both FKs are part of the composite PK
      Object.entries(erdData.tables || {}).forEach(([tableName, tableData]) => {
        const columns = Object.values(tableData.columns || {});
        const pkColumns = columns.filter(col => col.pk);
        const fkColumns = columns.filter(col => col.fk);
        
        // Junction table criteria:
        // 1. Has exactly 2 FK columns
        // 2. Both FK columns are part of PK (identifying relationships)
        // 3. PK is composite (2 columns)
        if (fkColumns.length === 2 && pkColumns.length === 2) {
          const fk1IsPK = fkColumns[0].pk;
          const fk2IsPK = fkColumns[1].pk;
          
          if (fk1IsPK && fk2IsPK) {
            // This is a junction table
            // Find the two parent tables
            const rels = schemaFilteredRelationships.filter(rel => rel.fromTable === tableName);
            if (rels.length === 2) {
              junctionTables.set(tableName, [rels[0].toTable, rels[1].toTable]);
            }
          }
        }
      });
      
      // Create virtual N:M relationships
      const virtualNMRelationships = [];
      junctionTables.forEach(([table1, table2], junctionTable) => {
        if (visibleTableNames.has(table1) && visibleTableNames.has(table2)) {
          // Check if junction table is user-created by checking if any FK from it is user-created
          const junctionFKs = schemaFilteredRelationships.filter(rel => rel.fromTable === junctionTable);
          const isUserCreatedJunction = junctionFKs.some(fk => fk.isUserCreated);
          
          virtualNMRelationships.push({
            fromTable: table1,
            toTable: table2,
            fromColumn: null,
            toColumn: null,
            type: 'MANY_TO_MANY',
            cardinalityType: 'N:M',
            isVirtualNM: true,
            junctionTable: junctionTable,
            isUserCreated: isUserCreatedJunction // Mark as user-created if junction table is user-created
          });
        }
      });
      
      // COMBINE regular relationships and virtual N:M relationships for unified port distribution
      const allRelationshipsForDistribution = [...bundledRelationships, ...virtualNMRelationships];
      
      // Create edges using smart port distribution with initial node positions
      // This ensures N:M edges don't overlap with existing 1:N junction table edges
      const distributedRelationships = distributeRelationshipPorts(
        allRelationshipsForDistribution, 
        simpleNodes
      );
      
      // Separate regular relationships from virtual N:M relationships after distribution
      const distributedRegularRels = distributedRelationships.filter(rel => !rel.isVirtualNM);
      const distributedNMRels = distributedRelationships.filter(rel => rel.isVirtualNM);
      
      const simpleEdges = distributedRegularRels.map((rel) => {
        // For visual display: parent should be source (circle), child should be target (crow's foot)
        // But relationship is stored as: fromTable=child, toTable=parent
        // So we need to SWAP for visual rendering
        
        const visualSource = rel.toTable;   // Parent (will get circle)
        const visualTarget = rel.fromTable; // Child (will get crow's foot)
        
        // Generate handles based on VISUAL direction (swapped)
        const sourceHandle = generateHandleId(
          visualSource,      // Parent
          rel.targetSide,    // Use parent's side (was targetSide)
          rel.targetPortIndex,
          'source'
        );
        const targetHandle = generateHandleId(
          visualTarget,      // Child
          rel.sourceSide,    // Use child's side (was sourceSide)
          rel.sourcePortIndex,
          'target'
        );

        // Create unique ID for bundled relationships
        const edgeId = rel.isBundled 
          ? `db-rel-bundle-${rel.fromTable}-${rel.toTable}-${rel.cardinalityType}-${rel.isIdentifying}`
          : `db-rel-${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;

        return {
          id: edgeId,
          source: visualSource,  // Parent (circle)
          target: visualTarget,  // Child (crow's foot)
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          type: 'relationship',
          data: {
            // Keep original DB direction in data for FK detection
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
            targetPortIndex: rel.targetPortIndex,
            // Bundle information
            isBundled: rel.isBundled || false,
            bundledRelationships: rel.bundledRelationships || [rel],
            bundleCount: rel.bundleCount || 1
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

      // Create virtual N:M edges from already-distributed relationships
      distributedNMRels.forEach((rel) => {
        // STABLE ID: Use sorted table names to ensure consistent ID regardless of direction
        const [table1, table2] = [rel.fromTable, rel.toTable].sort();
        const nmEdgeId = `virtual-nm-${table1}-${table2}-via-${rel.junctionTable}`;
        
        // Generate handles with distributed ports
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
        
        const nmEdge = {
          id: nmEdgeId,
          source: rel.fromTable,
          target: rel.toTable,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          type: 'relationship',
          data: {
            fromTable: rel.fromTable,
            fromColumn: null,
            toTable: rel.toTable,
            toColumn: null,
            relationType: 'MANY_TO_MANY',
            type: 'MANY_TO_MANY',
            cardinalityType: 'N:M',
            isUserCreated: rel.isUserCreated || false, // Use the isUserCreated flag from relationship
            isIdentifying: false,
            isVirtualNM: true,
            junctionTable: rel.junctionTable,
            sourceSide: rel.sourceSide,
            targetSide: rel.targetSide,
            sourcePortIndex: rel.sourcePortIndex,
            targetPortIndex: rel.targetPortIndex
          }
        };
        
        // Only add if not already in uniqueEdges (prevent duplicates)
        if (!seenIds.has(nmEdgeId)) {
          seenIds.add(nmEdgeId);
          uniqueEdges.push(nmEdge);
        }
      });

      // Always update nodes and edges for initial layout
      setNodes(simpleNodes);
      setEdges(uniqueEdges);

    } catch (error) {
      console.error('❌ Layout failed:', error);
      setLayoutError(error.message);
    } finally {
      isCalculatingRef.current = false;
    }
  }, [erdData, selectedTable, filteredTables, highlightedTable, highlightedColumn, tablePositions, layoutResetKey]); // Added layoutResetKey

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
        
        // Trigger port redistribution after drag stops with longer delay
        // This prevents edge recreation while user might be clicking
        setTimeout(() => {
          // Recalculate edges with new positions using forceLayout
          forceLayout();
        }, 300); // Increased from 100ms to 300ms to avoid race conditions
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