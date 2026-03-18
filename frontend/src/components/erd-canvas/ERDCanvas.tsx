import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  NodeChange,
  EdgeChange,
  Connection,
  Node,
  ConnectionLineType,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TableCard } from "./TableCard";
import { RelationshipEdge } from "./RelationshipEdge";
import { DirectRelationshipEdge } from "./DirectRelationshipEdge";
import { CrowsFootEdge } from "./CrowsFootEdge";
import { DraggableMiniMap } from "./DraggableMiniMap";
import { ERDHeader } from "./ERDHeader";
import { CanvasControls } from "./CanvasControls";
import { Loader } from "../common/Loader";
import { LoadSchemasPrompt } from "./LoadSchemasPrompt";
import { RelationshipDetailsModal } from "../modals/RelationshipDetailsModal";
import { DeleteRelationshipModal } from "../modals/DeleteRelationshipModal";
import { ExportPDFModal } from "../modals/ExportPDFModal";
import { useApp } from "../../context/AppContext";
import { useERDLayout } from "../../hooks/useERDLayout";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { useRelationshipCreation } from "../../context/RelationshipCreationContext";
import { createRelationship, validateRelationshipCreation } from "../../services/relationshipCreationService";
import { exportERDToPDF } from "../../utils/erdExport";
import type { CanvasControls as CanvasControlsType, HighlightedColumnInfo } from "../../types";
import "./ERDCanvas.css";

// Extend window to hold the ReactFlow instance for export utility
declare global {
  interface Window {
    reactFlowInstance: ReturnType<typeof useReactFlow> | undefined;
  }
}

// Move nodeTypes and edgeTypes outside component to prevent React Flow warning
const nodeTypes = {
  tableCard: TableCard,
};

const edgeTypes = {
  relationship: RelationshipEdge,
  direct: DirectRelationshipEdge,
  crowsfoot: CrowsFootEdge,
};

interface ERDCanvasInnerProps {
  isSchemaCollapsed: boolean;
  onControlsReady: (controls: CanvasControlsType) => void;
}

const ERDCanvasInner = ({ isSchemaCollapsed, onControlsReady }: ERDCanvasInnerProps) => {
  const {
    erdData,
    erdLoading,
    erdError,
    selectedSchema,
    selectSchema,
    schemas,
    selectedTable,
    setHighlightedRelationship,
    highlightedRelationship,
    setHighlightedRelationshipWithTimer,
    setHighlightedNMRelationship,
    setHighlightedNMRelationshipWithTimer,
    routingMode,
    crowsFootMode,
    gridBackground,
    showNotification,
    schemasHasLoaded,
    refetchSchemas,
    loadAllSchemasFirstTime,
    // Relationship modals
    relationshipDetailsModal,
    closeRelationshipDetailsModal,
    relationshipDeleteModal,
    closeRelationshipDeleteModal,
    openRelationshipDeleteModal,
    deleteRelationships,
    // Export PDF modal
    exportPDFModal,
    closeExportPDFModal,
    // Lock checks
    isSchemaLockedByOther,
    schemaLocks,
    isDynamicConnected,
  } = useApp();

  const virtualSchema = useVirtualSchema();
  const {
    selectedTables,
    relationshipType,
    completeRelationshipCreation,
    canCompleteRelationship,
  } = useRelationshipCreation();

  const reactFlowInstance = useReactFlow();
  const { zoomIn, zoomOut, fitView } = reactFlowInstance;

  // Store React Flow instance globally for export utility
  useEffect(() => {
    window.reactFlowInstance = reactFlowInstance;
    return () => {
      window.reactFlowInstance = undefined;
    };
  }, [reactFlowInstance]);

  // Table filtering state
  const [filteredTables, setFilteredTables] = useState<string[] | null>(null);
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const [highlightedColumn, setHighlightedColumn] = useState<HighlightedColumnInfo | null>(null);
  const [layoutResetKey, setLayoutResetKey] = useState(0);

  // Auto-select is handled by AppContext
  useEffect(() => {
    // Auto-select logic moved to AppContext for better control
  }, [schemasHasLoaded, schemas, selectedSchema, selectSchema]);

  const { nodes, edges: rawEdges, getInitialViewport, onNodesChange, onEdgesChange, forceLayout, layoutError } = useERDLayout(
    erdData,
    selectedTable,
    filteredTables,
    highlightedTable,
    highlightedColumn,
    layoutResetKey
  );

  const handleTableFilter = useCallback((
    tableNames: string[] | null,
    lastSelectedTable: string | null,
    highlightedColumnInfo: HighlightedColumnInfo | null = null
  ) => {
    setFilteredTables(tableNames);
    setHighlightedTable(lastSelectedTable);
    setHighlightedColumn(highlightedColumnInfo);

    if (tableNames) {
      setTimeout(() => {
        fitView({ duration: 500, padding: 0.2 });
      }, 100);
    }
  }, [fitView]);

  // Transform edges based on routing mode and crow's foot mode
  const edges = useMemo(() => {
    if (!rawEdges) return [];

    return rawEdges.map(edge => {
      const edgeType = crowsFootMode ? 'crowsfoot' : 'direct';
      return {
        ...edge,
        type: edgeType,
        data: {
          ...edge.data,
          routingMode,
          crowsFootMode,
        },
        'data-routing-mode': routingMode,
        'data-crows-foot': crowsFootMode,
      };
    });
  }, [rawEdges, routingMode, crowsFootMode]);

  // Auto fit view when new ERD data loads
  useEffect(() => {
    if (nodes.length > 0 && erdData && selectedSchema) {
      const timer = setTimeout(() => {
        fitView({ duration: 500, padding: 0.2 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedSchema, nodes.length, fitView]);

  const onNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
  }, []);

  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
  }, []);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();

    const resetCursor = () => {
      document.body.style.cursor = 'default';
      const canvas = (event.target as HTMLElement).closest('.react-flow') as HTMLElement | null;
      if (canvas) canvas.style.cursor = 'default';
      const pane = document.querySelector('.react-flow__pane') as HTMLElement | null;
      if (pane) pane.style.cursor = 'default';
      document.querySelectorAll<HTMLElement>('.react-flow__node').forEach(n => {
        n.style.cursor = 'grab';
      });
    };

    resetCursor();
    setTimeout(resetCursor, 10);
    setTimeout(resetCursor, 50);
    setTimeout(resetCursor, 100);
  }, []);

  const onPaneMouseLeave = useCallback(() => {
    document.body.style.cursor = 'default';
  }, []);

  const onPaneClick = useCallback(() => {
    document.body.style.cursor = 'default';
    setHighlightedNMRelationshipWithTimer(null);
    setHighlightedRelationshipWithTimer(null);
  }, [setHighlightedNMRelationshipWithTimer, setHighlightedRelationshipWithTimer]);

  useEffect(() => {
    const handleDeleteRelationship = (event: Event) => {
      const { relationshipId } = (event as CustomEvent).detail;
      // For now, just log the delete request since we're using ELK-based relationships
    };
    window.addEventListener('deleteRelationship', handleDeleteRelationship);
    return () => window.removeEventListener('deleteRelationship', handleDeleteRelationship);
  }, []);

  // Add global mouse event listeners to prevent cursor sticking
  useEffect(() => {
    const handleGlobalMouseUp = () => { document.body.style.cursor = 'default'; };
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (event.buttons === 0) document.body.style.cursor = 'default';
    };
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') document.body.style.cursor = 'default';
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

  useEffect(() => {
    return () => { document.body.style.cursor = 'default'; };
  }, []);

  // Handle relationship creation when two tables are selected
  useEffect(() => {
    if (canCompleteRelationship && virtualSchema.workingSchema) {
      const relationshipData = completeRelationshipCreation();

      if (relationshipData) {
        if (isDynamicConnected) {
          showNotification('Connected to a dynamic database — view only, cannot create relationships', 'error');
          return;
        }
        if (isSchemaLockedByOther(selectedSchema ?? '')) {
          const lockInfo = schemaLocks[selectedSchema!];
          showNotification(`Schema is locked by ${lockInfo?.userDisplayName || 'another user'} — cannot create relationships`, 'error');
          return;
        }

        try {
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

          const updatedSchema = createRelationship(virtualSchema.workingSchema, relationshipData);
          virtualSchema.updateWorkingSchema(updatedSchema);

          setHighlightedRelationshipWithTimer({
            fromTable: relationshipData.parentTable,
            fromColumn: relationshipData.parentColumn ?? '',
            toTable: relationshipData.childTable,
            toColumn: relationshipData.childColumn ?? '',
            type: 'ONE_TO_MANY',
          });

          showNotification('Relationship created successfully!', 'success');
        } catch (error) {
          console.error('❌ Failed to create relationship:', error);
          showNotification(`Failed to create relationship: ${(error as Error).message}`, 'error');
        }
      }
    }
  }, [canCompleteRelationship, selectedTables, relationshipType, virtualSchema]);

  const handleZoomIn = useCallback(() => { zoomIn({ duration: 300 }); }, [zoomIn]);
  const handleZoomOut = useCallback(() => { zoomOut({ duration: 300 }); }, [zoomOut]);
  const handleFitView = useCallback(() => { fitView({ duration: 300, padding: 0.2 }); }, [fitView]);

  const handleResetLayout = useCallback(() => {
    setLayoutResetKey(prev => prev + 1);
    setTimeout(() => {
      forceLayout();
      setTimeout(() => { fitView({ duration: 500, padding: 0.2 }); }, 100);
    }, 50);
  }, [forceLayout, fitView]);

  // Expose canvas controls to parent
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady({
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onFitView: handleFitView,
        onResetLayout: handleResetLayout,
      });
    }
  }, [onControlsReady, handleZoomIn, handleZoomOut, handleFitView, handleResetLayout]);

  const onConnect = useCallback((_connection: Connection) => {
    // Disabled - no manual connections
  }, []);

  const handleRecalculatePorts = useCallback(() => { forceLayout(); }, [forceLayout]);

  // Show LoadSchemasPrompt if no schemas have been loaded yet
  if (!schemasHasLoaded) {
    return <LoadSchemasPrompt onLoadSchemas={() => loadAllSchemasFirstTime().then(() => {})} />;
  }

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
          key={`reactflow-${selectedSchema}-${layoutResetKey}`}
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
          fitView={true}
          fitViewOptions={{ padding: 0.15, maxZoom: 0.9, minZoom: 0.3 }}
          minZoom={0.2}
          maxZoom={1.2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          elevateEdgesOnSelect={false}
          elevateNodesOnSelect={true}
          connectionLineType={ConnectionLineType.Straight}
          connectionLineStyle={{ display: 'none' }}
          connectionMode={ConnectionMode.Loose}
          connectOnClick={false}
          onConnectStart={undefined}
          onConnectEnd={undefined}
          snapToGrid={false}
          snapGrid={[15, 15]}
          panOnDrag={true}
          selectionOnDrag={false}
          multiSelectionKeyCode={null}
          deleteKeyCode={null}
          className={gridBackground ? 'grid-background' : ''}
          defaultEdgeOptions={{
            type: 'relationship',
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: undefined,
            markerStart: undefined,
            zIndex: -1,
          }}
          onInit={(instance) => {
            setTimeout(() => {
              instance.fitView({
                padding: 0.2,
                duration: 300,
                maxZoom: 1,
                minZoom: 0.3,
              });
            }, 100);
          }}
        >
          <DraggableMiniMap
            key={`minimap-${layoutResetKey}`}
            nodeColor={(node) => {
              if (node.data?.isSelected) return '#3b82f6';
              if (node.data?.isHighlighted) return '#10b981';
              return '#94a3b8';
            }}
            nodeStrokeColor={(node) => {
              if (node.data?.isSelected) return '#2563eb';
              if (node.data?.isHighlighted) return '#059669';
              return '#64748b';
            }}
            nodeBorderRadius={4}
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          />
        </ReactFlow>

        <CanvasControls isCollapsed={isSchemaCollapsed} />
      </div>

      <RelationshipDetailsModal
        isOpen={relationshipDetailsModal.isOpen}
        onClose={closeRelationshipDetailsModal}
        relationships={relationshipDetailsModal.relationships}
        onDelete={(rels) => {
          closeRelationshipDetailsModal();
          openRelationshipDeleteModal(rels);
        }}
      />

      <DeleteRelationshipModal
        isOpen={relationshipDeleteModal.isOpen}
        onClose={closeRelationshipDeleteModal}
        relationships={relationshipDeleteModal.relationships}
        onConfirm={async (rels) => {
          closeRelationshipDeleteModal();
          await deleteRelationships(rels);
        }}
      />

      <ExportPDFModal
        isOpen={exportPDFModal.isOpen}
        onClose={closeExportPDFModal}
        onExport={async (options, progressCallback) => {
          await exportERDToPDF({
            ...options,
            format: options.format as 'svg' | 'pdf' | undefined,
            quality: options.quality as import('../../utils/erdExport').ExportQuality | undefined,
            schemaName: selectedSchema,
          }, progressCallback);
        }}
        schemaName={selectedSchema}
      />
    </div>
  );
};

interface ERDCanvasProps {
  isSchemaCollapsed: boolean;
  onControlsReady: (controls: CanvasControlsType) => void;
}

export const ERDCanvas = ({ isSchemaCollapsed, onControlsReady }: ERDCanvasProps) => {
  return (
    <ReactFlowProvider>
      <ERDCanvasInner isSchemaCollapsed={isSchemaCollapsed} onControlsReady={onControlsReady} />
    </ReactFlowProvider>
  );
};
