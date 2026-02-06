import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableCard } from "./TableCard";
import { RelationshipEdge } from "./RelationshipEdge";
import { DirectRelationshipEdge } from "./DirectRelationshipEdge";
import { CrowsFootEdge } from "./CrowsFootEdge";
import { Legend } from "./Legend";
import { ERDHeader } from "./ERDHeader";
import { RelationshipToolbar } from "./RelationshipToolbar";
import { Loader } from "../common/Loader";
import { useApp } from "../../context/AppContext";
import { useERDLayout } from "../../hooks/useERDLayout";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
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
  const { erdData, erdLoading, erdError, selectedSchema, selectedTable, setHighlightedRelationship, highlightedRelationship, routingMode, crowsFootMode } =
    useApp();
  const virtualSchema = useVirtualSchema(); // Get full virtual schema context
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  // Table filtering state
  const [filteredTables, setFilteredTables] = useState(null);
  const [highlightedTable, setHighlightedTable] = useState(null); // Track highlighted table

  const { nodes, edges: rawEdges, getInitialViewport, onNodesChange, onEdgesChange, forceLayout, layoutError } = useERDLayout(
    erdData,
    selectedTable,
    filteredTables, // Pass filtered tables to layout hook
    highlightedTable // Pass highlighted table to layout hook
  );

  // Handle table filtering from ERD header
  const handleTableFilter = useCallback((tableNames, lastSelectedTable) => {
    setFilteredTables(tableNames);
    setHighlightedTable(lastSelectedTable); // Set the highlighted table
    
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
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.5, minZoom: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
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
          defaultEdgeOptions={{
            type: 'relationship',
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: null,
            markerStart: null,
            zIndex: -1, // Force edges behind nodes
          }}
          onInit={(reactFlowInstance) => {
            // ReactFlow initialization complete - fit view after init
            setTimeout(() => {
              reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
            }, 100);
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={25}
            size={0.8}
            color="var(--border-color)"
            style={{ opacity: 0.3 }}
          />
          <MiniMap
            nodeStrokeColor="#4682B4"
            nodeColor="#87CEEB"
            nodeBorderRadius={2}
            maskColor="transparent"
            maskStrokeColor="#333333"
            maskStrokeWidth={2}
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid var(--border-color)',
            }}
            pannable
            zoomable
            ariaLabel="Schema Overview"
            position="bottom-right"
          />
        </ReactFlow>

        {/* CanvasControls removed - now in VerticalToolbar */}

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
