import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSmoothStepPath } from '@xyflow/react';
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import './RelationshipEdge.css';

export const DirectRelationshipEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  markerStart,
  label,
  source,
  target,
  sourceHandle,
  targetHandle,
}) => {
  const { 
    setHighlightedRelationship, 
    highlightedRelationship,
    setHighlightedRelationshipWithTimer, // NEW: Improved timer management
    setHighlightedNMRelationshipWithTimer, // NEW: N:M highlighting
    highlightedNMRelationship, // NEW: N:M highlight state
    // NEW: Hover-based highlighting
    hoverHighlightedRelationships,
    // Relationship deletion
    deleteRelationships,
    showNotification,
    // Relationship modals
    openRelationshipDetailsModal,
    openRelationshipDeleteModal
  } = useApp();
  
  const { workingSchema } = useVirtualSchema();
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

  // Check if this is a self-join relationship (define early)
  const selfJoin = data?.fromTable === data?.toTable;

  // NEW: Check if this is a user-created relationship (permanent orange highlight)
  const isUserCreated = data?.bundledRelationships?.some(rel => rel.isUserCreated) || data?.isUserCreated;

  // Use CSS variables for theme-aware colors (same as orthogonal lines)
  // Instead of computing colors in JS, we'll use CSS variables directly
  const lineColor = 'var(--erd-line-color)';
  const highlightColor = '#3b82f6';
  
  // Check if this edge is currently highlighted (with corrected semantics)
  // For bundled relationships, check against ALL relationships in the bundle
  const isHighlighted = highlightedRelationship && data?.bundledRelationships && 
    data.bundledRelationships.some(rel => 
      highlightedRelationship.fromTable === rel.toTable &&     // PK table
      highlightedRelationship.toTable === rel.fromTable &&     // FK table  
      highlightedRelationship.fromColumn === rel.toColumn &&   // PK column
      highlightedRelationship.toColumn === rel.fromColumn      // FK column
    );

  // NEW: Check if this edge is hover-highlighted
  // For bundled relationships, check against ALL relationships in the bundle
  const hoverHighlight = data?.bundledRelationships && hoverHighlightedRelationships.find(hoverRel => 
    data.bundledRelationships.some(rel =>
      hoverRel.fromTable === rel.toTable &&     // PK table
      hoverRel.toTable === rel.fromTable &&     // FK table  
      hoverRel.fromColumn === rel.toColumn &&   // PK column
      hoverRel.toColumn === rel.fromColumn      // FK column
    )
  );

  const isHoverHighlighted = !!hoverHighlight;

  // NEW: Check if this is a junction table line that should be highlighted (purple)
  // This happens when user clicks on N:M virtual line
  const isNMJunctionLine = highlightedNMRelationship && 
    data.fromTable === highlightedNMRelationship.junctionTable &&
    (data.toTable === highlightedNMRelationship.table1 || 
     data.toTable === highlightedNMRelationship.table2);

  // NEW: Check if this N:M virtual line itself should be highlighted (purple)
  const isNMVirtualLineHighlighted = data?.isVirtualNM && highlightedNMRelationship &&
    data.junctionTable === highlightedNMRelationship.junctionTable &&
    ((data.fromTable === highlightedNMRelationship.table1 && data.toTable === highlightedNMRelationship.table2) ||
     (data.fromTable === highlightedNMRelationship.table2 && data.toTable === highlightedNMRelationship.table1));

  // Determine line style based on identifying relationship
  const isIdentifying = data?.isIdentifying === true;
  const strokeDasharray = isIdentifying ? "none" : "6,3"; // Solid for identifying, dashed for non-identifying

  // Create custom path for self-join relationships
  let edgePath;
  
  if (selfJoin) {
    // Simple self-join indicator - just a small loop on the right side
    const loopSize = 30;   // Small, simple loop
    const offset = 15;     // Close to table edge
    
    // Create a simple curved loop on the right side
    const tableRightEdge = Math.max(sourceX, targetX);
    const loopX = tableRightEdge + offset;
    const midY = (sourceY + targetY) / 2;
    
    // Simple semicircle loop
    edgePath = `M ${sourceX} ${sourceY}
                L ${loopX} ${sourceY}
                A ${loopSize/2} ${loopSize/2} 0 0 1 ${loopX} ${targetY}
                L ${targetX} ${targetY}`;
  } else {
    // Use React Flow's getSmoothStepPath for regular relationships
    [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0, // Sharp corners, no curves
    });
  }

  // Calculate label position (middle of the line)
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const handleEdgeClick = (e) => {
    e.stopPropagation();
    
    if (data) {
      // For virtual N:M edges, highlight the 3 tables (2 main + junction)
      if (data.isVirtualNM) {
        const nmHighlightData = {
          table1: data.fromTable,
          table2: data.toTable,
          junctionTable: data.junctionTable
        };
        setHighlightedNMRelationshipWithTimer(nmHighlightData);
        return;
      }
      
      // For bundled relationships, highlight the FIRST relationship in the bundle
      // The edge highlighting logic will check ALL bundled relationships
      const relationshipToHighlight = data.bundledRelationships?.[0] || data;
      
      if (relationshipToHighlight.fromColumn && relationshipToHighlight.toColumn && 
          relationshipToHighlight.fromTable && relationshipToHighlight.toTable) {
        const highlightData = {
          fromTable: relationshipToHighlight.toTable,     // PK table (parent)
          fromColumn: relationshipToHighlight.toColumn,   // PK column (parent)
          toTable: relationshipToHighlight.fromTable,     // FK table (child)
          toColumn: relationshipToHighlight.fromColumn,   // FK column (child)
          relationType: relationshipToHighlight.relationType || 'ONE_TO_MANY'
        };
        
        setHighlightedRelationshipWithTimer(highlightData);
      }
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0 });
  };

  const handleViewDetails = () => {
    const rels = getAllRelationships();
    closeContextMenu();
    openRelationshipDetailsModal(rels);
  };

  const handleDeleteClick = () => {
    closeContextMenu();
    const rels = getAllRelationships().filter(rel => rel.isUserCreated);
    openRelationshipDeleteModal(rels);
  };

  // Get all relationships for this edge (bundled or single)
  const getAllRelationships = () => {
    // For N:M virtual edges, get the actual relationships from the junction table
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      const junctionRels = workingSchema.relationships.filter(rel => 
        rel.fromTable === data.junctionTable
      );
      return junctionRels;
    }
    
    if (data?.bundledRelationships && data.bundledRelationships.length > 0) {
      return data.bundledRelationships;
    }
    // If no bundled relationships, create array from data
    if (data?.fromTable && data?.fromColumn && data?.toTable && data?.toColumn) {
      return [data];
    }
    return [];
  };

  // Check if any relationship is user-created
  const hasUserCreatedRelationships = () => {
    return getAllRelationships().some(rel => rel.isUserCreated);
  };

  return (
    <g 
      key={`direct-relationship-${id}`}
      style={{ zIndex: selfJoin ? 1000 : 'auto' }}
      className={selfJoin ? 'self-join-group' : ''}
    >
      {/* Only render path for non-self-join relationships */}
      {!selfJoin && (
        <>
          {/* Main edge path */}
          <path
            id={id}
            className={`react-flow__edge-path direct-edge-path ${selected ? 'selected' : ''}`}
            d={edgePath}
            stroke={
              isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : // Purple for N:M junction lines and virtual line
              isUserCreated ? '#125da8aa' : // Your custom blue for user-created (always visible)
              isHighlighted ? '#ff6b35' : // Orange for click-based highlighting
              isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : // Green for PK hover, Blue for FK hover
              lineColor // Default color for database relationships
            }
            strokeWidth={isNMJunctionLine || isNMVirtualLineHighlighted ? 2.5 : (isUserCreated ? 2.5 : (isHighlighted || isHoverHighlighted ? 2.5 : 1.5))}
            strokeDasharray={strokeDasharray}
            fill="none"
            markerEnd={markerEnd}
            markerStart={markerStart}
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              filter: isNMJunctionLine || isNMVirtualLineHighlighted || isUserCreated || isHighlighted || isHoverHighlighted ? 
                `drop-shadow(0 0 6px ${
                  isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : // Purple for N:M junction lines and virtual line
                  isUserCreated ? '#125da8aa' : // Blue for user-created
                  isHighlighted ? '#ff6b35' : 
                  isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : 
                  '#3b82f6'
                })` : "none",
              transition: 'all 0.2s ease'
            }}
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            data-relationship-id={id}
            data-user-created={isUserCreated ? 'true' : 'false'}
          />
          
          {/* Wider invisible clickable area for easier clicking */}
          <path
            d={edgePath}
            stroke="transparent"
            strokeWidth="20"
            fill="none"
            style={{
              cursor: 'pointer',
              pointerEvents: 'all'
            }}
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            data-relationship-id={id}
          />
          
        {/* Optional: Relationship label at calculated position with background */}
        {label && (
          <g onClick={handleEdgeClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
            {/* Background rectangle for better visibility */}
            <rect
              x={labelX - 20}
              y={labelY - 18}
              width="40"
              height="16"
              fill="var(--bg-primary)"
              stroke="var(--border-color)"
              strokeWidth="0.5"
              rx="3"
              opacity="0.95"
            />
            {/* Label text */}
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill={lineColor}
              fontSize="12"
              fontWeight="500"
              style={{
                userSelect: 'none',
                pointerEvents: 'none'
              }}
              data-relationship-id={id}
            >
              {label}
            </text>
          </g>
        )}
        </>
      )}
      
      {/* Self-join indicator - visible curved arrow */}
      {selfJoin && (
        <g>
          {/* Curved self-referencing arrow */}
          <path
            d={`M ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2}
                Q ${Math.max(sourceX, targetX) + 40} ${(sourceY + targetY) / 2 - 20}
                  ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2 - 40}
                Q ${Math.max(sourceX, targetX) + 40} ${(sourceY + targetY) / 2 - 60}
                  ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2 - 40}`}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.5"
            strokeDasharray="5,5"
            markerEnd="url(#arrowhead)"
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
          />
          {/* Label */}
          <text
            x={Math.max(sourceX, targetX) + 50}
            y={(sourceY + targetY) / 2 - 30}
            fill={lineColor}
            fontSize="10"
            fontFamily="monospace"
          >
            self-join
          </text>
        </g>
      )}

      {/* Context Menu */}
      {contextMenu.isOpen && createPortal(
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998
            }}
            onClick={closeContextMenu}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 9999,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              minWidth: '180px',
              padding: '4px 0'
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
              }}
              onClick={handleViewDetails}
              onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              View Details {data?.isBundled && `(${data.bundleCount})`}
            </div>
            {hasUserCreatedRelationships() && (
              <div
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontSize: '0.9rem'
                }}
                onClick={handleDeleteClick}
                onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Delete Relationship{data?.isBundled && 's...'}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </g>
  );
});

DirectRelationshipEdge.displayName = 'DirectRelationshipEdge';
