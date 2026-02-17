import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableCard } from "./TableCard";
import { RelationshipEdge } from "./RelationshipEdge";
import { DirectRelationshipEdge } from "./DirectRelationshipEdge";
import { CrowsFootEdge } from "./CrowsFootEdge";
import { DraggableMiniMap } from "./DraggableMiniMap";
import { Legend } from "./Legend";
import { ERDHeader } from "./ERDHeader";
import { CanvasControls } from "./CanvasControls";
import { RelationshipToolbar } from "./RelationshipToolbar";
import { Loader } from "../common/Loader";
import { RelationshipDetailsModal } from "../modals/RelationshipDetailsModal";
import { DeleteRelationshipModal } from "../modals/DeleteRelationshipModal";
import { useApp } from "../../context/AppContext";
import { useERDLayout } from "../../hooks/useERDLayout";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { useRelationshipCreation } from "../../context/RelationshipCreationContext";
import { createRelationship, validateRelationshipCreation } from "../../services/relationshipCreationService";
import "./ERDCanvas.css";

// Move nodeTypes and edgeTypes outside component to prevent React Flow warning
const nodeTypes = {
  tableCard: TableCard,
};

const edgeTypes = {
  relationship: RelationshipEdge,
  direct: DirectRelationshipEdge,
  crowsfoot: CrowsFootEdge,
};

const ERDCanvasInner = ({ isSchemaCollapsed, onControlsReady }) => {
  const { 
    erdData, 
    erdLoading, 
    erdError, 
    selectedSchema, 
    selectedTable, 
    setHighlightedRelationship, 
    highlightedRelationship, 
    routingMode, 
    crowsFootMode, 
    gridBackground, 
    showNotification,
    // Relationship modals
    relationshipDetailsModal,
    closeRelationshipDetailsModal,
    relationshipDeleteModal,
    closeRelationshipDeleteModal,
    openRelationshipDeleteModal,
    deleteRelationships
  } = useApp();
  const virtualSchema = useVirtualSchema(); // Get full virtual schema context
  const { 
    selectedTables, 
    relationshipType, 
    canCompleteRelationship, 
    completeRelationshipCreation,
    cancelRelationshipCreation 
  } = useRelationshipCreation();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  // Table filtering state
  const [filteredTables, setFilteredTables] = useState(null);
  const [highlightedTable, setHighlightedTable] = useState(null); // Track highlighted table
  const [highlightedColumn, setHighlightedColumn] = useState(null); // NEW: Track highlighted column

  const { nodes, edges: rawEdges, getInitialViewport, onNodesChange, onEdgesChange, forceLayout, layoutError } = useERDLayout(
    erdData,
    selectedTable,
    filteredTables, // Pass filtered tables to layout hook
    highlightedTable, // Pass highlighted table to layout hook
    highlightedColumn // NEW: Pass highlighted column to layout hook
  );

  // Handle table filtering from ERD header
  const handleTableFilter = useCallback((tableNames, lastSelectedTable, highlightedColumnInfo = null) => {
    setFilteredTables(tableNames);
    setHighlightedTable(lastSelectedTable); // Set the highlighted table
    setHighlightedColumn(highlightedColumnInfo); // NEW: Set the highlighted column
    
    // Auto fit view when filter changes
    if (tableNames) {
      setTimeout(() => {
        fitView({ duration: 500, padding: 0.2 });
      }, 100);
    }
  }, [fitView]);

  // Transform edges based on routing mode and crow's foot mode
  const edges = useMemo(() => {
    if (!rawEdges) return [];
    
    const transformedEdges = rawEdges.map(edge => {
      let edgeType;
      
      // Determine edge type based on crow's foot mode
      if (crowsFootMode) {
        edgeType = 'crowsfoot';
      } else {
        edgeType = 'direct'; // Always use direct when not in crow's foot mode
      }
      
      const newEdge = {
        ...edge,
        type: edgeType,
        data: {
          ...edge.data,
          routingMode,
          crowsFootMode
        },
        // Add data attribute for CSS targeting
        'data-routing-mode': routingMode,
        'data-crows-foot': crowsFootMode
      };
      
      return newEdge;
    });
    
    return transformedEdges;
  }, [rawEdges, routingMode, crowsFootMode]);

  // Auto fit view when new ERD data loads
  useEffect(() => {
    if (nodes.length > 0 && erdData && selectedSchema) {
      // Small delay to ensure nodes are rendered
      const timer = setTimeout(() => {
        fitView({ duration: 500, padding: 0.2 });
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [selectedSchema, nodes.length, fitView]); // Trigger when schema changes or nodes are loaded

  // Handle drag events to prevent sticky cursor bug
  const onNodeDragStart = useCallback((event, node) => {
    // Ensure proper drag state initialization
    event.stopPropagation();
  }, []);

  const onNodeDrag = useCallback((event, node) => {
    // Prevent event bubbling during drag
    event.stopPropagation();
  }, []);

  const onNodeDragStop = useCallback((event, node) => {
    // Ensure drag state is properly cleared
    event.stopPropagation();
    
    // Multiple methods to ensure cursor reset
    const resetCursor = () => {
      // Reset body cursor
      document.body.style.cursor = 'default';
      
      // Reset canvas cursor
      const canvas = event.target.closest('.react-flow');
      if (canvas) {
        canvas.style.cursor = 'default';
      }
      
      // Reset pane cursor
      const pane = document.querySelector('.react-flow__pane');
      if (pane) {
        pane.style.cursor = 'default';
      }
      
      // Reset all node cursors
      const nodes = document.querySelectorAll('.react-flow__node');
      nodes.forEach(node => {
        node.style.cursor = 'grab';
      });
    };
    
    // Immediate reset
    resetCursor();
    
    // Delayed reset to handle any async issues
    setTimeout(resetCursor, 10);
    setTimeout(resetCursor, 50);
    setTimeout(resetCursor, 100);
  }, []);

  // Handle mouse events to prevent cursor sticking
  const onPaneMouseLeave = useCallback(() => {
    // Reset cursor when mouse leaves the canvas
    document.body.style.cursor = 'default';
  }, []);

  const onPaneClick = useCallback((event) => {
    // Reset cursor on pane click
    document.body.style.cursor = 'default';
  }, []);
  useEffect(() => {
    const handleDeleteRelationship = (event) => {
      const { relationshipId } = event.detail;
      // For now, just log the delete request since we're using ELK-based relationships
    };

    window.addEventListener('deleteRelationship', handleDeleteRelationship);
    return () => {
      window.removeEventListener('deleteRelationship', handleDeleteRelationship);
    };
  }, []);

  // Add global mouse event listeners to prevent cursor sticking
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Reset cursor on any mouse up event
      document.body.style.cursor = 'default';
    };

    const handleGlobalMouseMove = (event) => {
      // If no mouse buttons are pressed, ensure cursor is default
      if (event.buttons === 0) {
        document.body.style.cursor = 'default';
      }
    };

    const handleGlobalKeyDown = (event) => {
      // Reset cursor on Escape key
      if (event.key === 'Escape') {
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Cleanup cursor on component unmount
  useEffect(() => {
    return () => {
      // Reset cursor when component unmounts
      document.body.style.cursor = 'default';
    };
  }, []);

  // Handle relationship creation when two tables are selected
  useEffect(() => {
    if (canCompleteRelationship && virtualSchema.workingSchema) {
      const relationshipData = completeRelationshipCreation();
      
      if (relationshipData) {
        try {
          // Validate the relationship
          const errors = validateRelationshipCreation(
            virtualSchema.workingSchema,
            relationshipData.parentTable,
            relationshipData.childTable,
            relationshipData.type
          );

          if (errors.length > 0) {
            console.error('❌ Relationship validation failed:', errors);
            showNotification(`Cannot create relationship: ${errors.join(', ')}`, 'error');
            return;
          }

          // Create the relationship
          const updatedSchema = createRelationship(virtualSchema.workingSchema, relationshipData);
          
          // Update the working schema
          virtualSchema.updateWorkingSchema(updatedSchema);
          
          console.log('✅ Relationship created successfully');
          showNotification('Relationship created successfully!', 'success');
          
        } catch (error) {
          console.error('❌ Failed to create relationship:', error);
          showNotification(`Failed to create relationship: ${error.message}`, 'error');
        }
      }
    }
  }, [canCompleteRelationship, selectedTables, relationshipType, virtualSchema]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.2 });
  }, [fitView]);

  // Expose canvas controls to parent
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady({
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onFitView: handleFitView
      });
    }
  }, [onControlsReady, handleZoomIn, handleZoomOut, handleFitView]);

  // Handle new connections between tables (disabled)
  const onConnect = useCallback(() => {
    // Disabled - no manual connections
  }, []);

  // Handle relationship creation completion (disabled)
  // Removed all relationship creation functionality
  
  const handleRecalculatePorts = useCallback(() => {
    forceLayout();
  }, [forceLayout]);

  // Routing toggle removed - using direct stepped lines only

  if (!selectedSchema) {
    return (
      <div className="erd-canvas-empty">
        <div className="empty-state">
          <h2>No Schema Selected</h2>
          <p>Select a schema from the left panel to visualize its structure</p>
        </div>
      </div>
    );
  }

  if (erdLoading) {
    return (
      <div className="erd-canvas-loading">
        <Loader size="lg" text="Loading ERD..." />
      </div>
    );
  }

  if (erdError || layoutError) {
    return (
      <div className="erd-canvas-error">
        <h2>Error Loading ERD</h2>
        <p>{erdError || layoutError}</p>
      </div>
    );
  }

  if (!erdData || !erdData.tables || Object.keys(erdData.tables).length === 0) {
    return (
      <div className="erd-canvas-empty">
        <div className="empty-state">
          <h2>No Tables Found</h2>
          <p>This schema appears to be empty</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erd-canvas-container">
      <ERDHeader onTableFilter={handleTableFilter} isSchemaCollapsed={isSchemaCollapsed} />
      
      <div className="erd-canvas-content">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneMouseLeave={onPaneMouseLeave}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={true} // Enable auto-fit to show all tables centered
          fitViewOptions={{ padding: 0.15, maxZoom: 0.9, minZoom: 0.3 }} // Comfortable zoom levels
          minZoom={0.2}
          maxZoom={1.2} // Limit max zoom to prevent viewport box from becoming too small
          defaultViewport={{ x: 0, y: 0, zoom: 0.75 }} // Start with comfortable zoom
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true} // Always allow dragging
          nodesConnectable={false} // Disable manual connections completely
          elementsSelectable={true} // Always allow selection
          elevateEdgesOnSelect={false} // Prevent edges from coming to front
          elevateNodesOnSelect={true} // Keep nodes on top when selected
          connectionLineType="straight"
          connectionLineStyle={{ 
            display: 'none' // Hide connection line completely
          }}
          connectionMode="loose"
          connectOnClick={false} // Disable click connections
          onConnectStart={null} // Disable connection start
          onConnectEnd={null} // Disable connection end
          snapToGrid={false}
          snapGrid={[15, 15]}
          panOnDrag={true}
          selectionOnDrag={false}
          multiSelectionKeyCode={null}
          deleteKeyCode={null}
          className={gridBackground ? 'grid-background' : ''} // Apply grid CSS class
          defaultEdgeOptions={{
            type: 'relationship',
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: null,
            markerStart: null,
            zIndex: -1, // Force edges behind nodes
          }}
          onInit={(reactFlowInstance) => {
            // Use ReactFlow's fitView to automatically center and zoom to show all tables
            setTimeout(() => {
              reactFlowInstance.fitView({ 
                padding: 0.2, // 20% padding around tables
                duration: 300, // Smooth animation
                maxZoom: 1, // Don't zoom in more than 100%
                minZoom: 0.3 // Allow zooming out to 30% if needed
              });
            }, 100); // Small delay to ensure nodes are rendered
          }}
        >
          {/* Draggable MiniMap for navigation overview */}
          <DraggableMiniMap
            nodeColor={(node) => {
              // Color nodes based on selection/highlight
              if (node.data?.isSelected) return '#3b82f6'; // Blue for selected
              if (node.data?.isHighlighted) return '#10b981'; // Green for highlighted
              return '#94a3b8'; // Gray for normal
            }}
            nodeStrokeColor={(node) => {
              if (node.data?.isSelected) return '#2563eb';
              if (node.data?.isHighlighted) return '#059669';
              return '#64748b';
            }}
            nodeBorderRadius={4}
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{
              backgroundColor: 'var(--bg-primary)',
            }}
          />
        </ReactFlow>

        {/* Canvas Controls - Only Compare Button */}
        <CanvasControls isCollapsed={isSchemaCollapsed} />

        {/* Legend is now in the header, so we don't render it here */}
        
        {/* <RelationshipToolbar /> */}

        {/* Relationship Info Panel - Hidden to avoid overlap with legend */}
        {/* {highlightedRelationship && (
          <div className="relationship-info-panel">
            <div className="relationship-info-header">
              <span className="relationship-info-title">Highlighted Relationship</span>
              <button 
                className="relationship-info-close"
                onClick={() => setHighlightedRelationship(null)}
                title="Clear highlight"
              >
                ×
              </button>
            </div>
            <div className="relationship-info-content">
              <div className="relationship-info-row">
                <span className="relationship-info-label">From:</span>
                <span className="relationship-info-value pk-highlight">
                  {highlightedRelationship.fromTable}.{highlightedRelationship.fromColumn} (PK)
                </span>
              </div>
              <div className="relationship-info-row">
                <span className="relationship-info-label">To:</span>
                <span className="relationship-info-value fk-highlight">
                  {highlightedRelationship.toTable}.{highlightedRelationship.toColumn} (FK)
                </span>
              </div>
              <div className="relationship-info-row">
                <span className="relationship-info-label">Type:</span>
                <span className="relationship-info-value">
                  {highlightedRelationship.relationType || 'ONE_TO_MANY'}
                </span>
              </div>
            </div>
          </div>
        )} */}
      </div>

      {/* Relationship Details Modal */}
      <RelationshipDetailsModal
        isOpen={relationshipDetailsModal.isOpen}
        onClose={closeRelationshipDetailsModal}
        relationships={relationshipDetailsModal.relationships}
        onDelete={(rels) => {
          closeRelationshipDetailsModal();
          openRelationshipDeleteModal(rels);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteRelationshipModal
        isOpen={relationshipDeleteModal.isOpen}
        onClose={closeRelationshipDeleteModal}
        relationships={relationshipDeleteModal.relationships}
        onConfirm={async (rels) => {
          closeRelationshipDeleteModal();
          await deleteRelationships(rels);
        }}
      />
    </div>
  );
};

export const ERDCanvas = ({ isSchemaCollapsed, onControlsReady }) => {
  return (
    <ReactFlowProvider>
      <ERDCanvasInner isSchemaCollapsed={isSchemaCollapsed} onControlsReady={onControlsReady} />
    </ReactFlowProvider>
  );
};
