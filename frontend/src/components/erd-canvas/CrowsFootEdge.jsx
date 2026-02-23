import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSmoothStepPath } from '@xyflow/react';
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import './RelationshipEdge.css';

export const CrowsFootEdge = ({
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
    openRelationshipDeleteModal,
    // NEW: Circular dependency detection
    tablesInCircularDependency,
    relationshipsInCircularDependency,
  } = useApp();
  
  const { workingSchema } = useVirtualSchema();
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

  // Check if this is a self-join relationship (define early)
  const selfJoin = data?.fromTable === data?.toTable;

  // NEW: Check if this is a user-created relationship (permanent orange highlight)
  const isUserCreated = data?.bundledRelationships?.some(rel => rel.isUserCreated) || data?.isUserCreated;

  // NEW: Check if this line connects to a circular dependency table (show in red)
  // Only show red if THIS SPECIFIC RELATIONSHIP is part of the circular dependency cycle
  const isCircularDependencyLine = data?.bundledRelationships?.some(rel => 
    relationshipsInCircularDependency?.some(circRel =>
      circRel.fromTable === rel.fromTable &&
      circRel.fromColumn === rel.fromColumn &&
      circRel.toTable === rel.toTable &&
      circRel.toColumn === rel.toColumn
    )
  ) || relationshipsInCircularDependency?.some(circRel =>
    circRel.fromTable === data?.fromTable &&
    circRel.fromColumn === data?.fromColumn &&
    circRel.toTable === data?.toTable &&
    circRel.toColumn === data?.toColumn
  );

  // Use CSS variables for theme-aware colors
  // Instead of computing colors in JS, we'll use CSS variables directly in SVG
  const lineColor = 'var(--erd-line-color)';
  const bgColor = 'var(--bg-primary)';
  const highlightColor = '#3b82f6';
  
  // Check if this edge is currently highlighted
  // For bundled relationships, check against ALL relationships in the bundle
  const isHighlighted = highlightedRelationship && data?.bundledRelationships && 
    data.bundledRelationships.some(rel => 
      highlightedRelationship.fromTable === rel.toTable &&
      highlightedRelationship.toTable === rel.fromTable &&
      highlightedRelationship.fromColumn === rel.toColumn &&
      highlightedRelationship.toColumn === rel.fromColumn
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
  // Check both single relationship and bundled relationships
  const isNMJunctionLine = highlightedNMRelationship && (
    // Check single relationship
    (data.fromTable === highlightedNMRelationship.junctionTable &&
     (data.toTable === highlightedNMRelationship.table1 || 
      data.toTable === highlightedNMRelationship.table2)) ||
    // Check bundled relationships
    (data?.bundledRelationships?.some(rel => 
      rel.fromTable === highlightedNMRelationship.junctionTable &&
      (rel.toTable === highlightedNMRelationship.table1 || 
       rel.toTable === highlightedNMRelationship.table2)
    ))
  );

  // NEW: Check if this N:M virtual line itself should be highlighted (purple)
  const isNMVirtualLineHighlighted = data?.isVirtualNM && highlightedNMRelationship &&
    data.junctionTable === highlightedNMRelationship.junctionTable &&
    ((data.fromTable === highlightedNMRelationship.table1 && data.toTable === highlightedNMRelationship.table2) ||
     (data.fromTable === highlightedNMRelationship.table2 && data.toTable === highlightedNMRelationship.table1));

  // Determine relationship cardinality and line style
  const getRelationshipStyle = () => {
    // MySQL Workbench style rules:
    // - Solid line: Identifying relationship (FK is part of PK)
    // - Dashed line: Non-identifying relationship (FK is not part of PK)
    // - Dotted line: Unique FK relationship (special case)
    
    // Use backend-provided isIdentifying field for accurate detection
    const isIdentifying = data?.isIdentifying === true;
    const isUnique = data?.isUnique === true;
    const relationType = data?.type || 'ONE_TO_MANY';
    
    // Determine line style
    let strokeDasharray = "none"; // Default solid
    if (relationType === 'ONE_TO_ONE_UNIQUE') {
      strokeDasharray = "3,2"; // Dotted for unique FK
    } else if (!isIdentifying) {
      strokeDasharray = "6,3"; // Dashed for non-identifying
    }
    
    // Determine cardinality display
    let cardinality = data?.cardinalityType || '1:N';
    
    return {
      strokeDasharray,
      cardinality,
      isIdentifying,
      isUnique
    };
  };

  const relationshipStyle = getRelationshipStyle();

  // Create path for regular relationships (self-join handled separately)
  let edgePath;
  if (selfJoin) {
    // Simple self-join indicator - no complex path
    edgePath = '';
  } else {
    // Create path that connects properly with the outward crow's foot
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      const unitX = dx / length;
      const unitY = dy / length;
      
      // Adjust endpoints to connect with markers
      const adjustedSourceX = sourceX + unitX * 8; // Start after circle
      const adjustedSourceY = sourceY + unitY * 8;
      const adjustedTargetX = targetX - unitX * 3; // End at crow's foot base
      const adjustedTargetY = targetY - unitY * 3;
      
      [edgePath] = getSmoothStepPath({
        sourceX: adjustedSourceX,
        sourceY: adjustedSourceY,
        targetX: adjustedTargetX,
        targetY: adjustedTargetY,
        sourcePosition,
        targetPosition,
        borderRadius: 0,
      });
    } else {
      edgePath = '';
    }
  }

  // Calculate label position
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
          fromTable: relationshipToHighlight.toTable,
          fromColumn: relationshipToHighlight.toColumn,
          toTable: relationshipToHighlight.fromTable,
          toColumn: relationshipToHighlight.fromColumn,
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
    let rels = getAllRelationships();
    
    // If this is a junction table relationship, include ALL relationships from the junction table
    if (rels.length > 0 && rels[0].isJunctionRelationship) {
      const junctionTable = rels[0].junctionTable;
      // Get all relationships involving this junction table
      const allJunctionRels = data?.bundledRelationships?.filter(r => 
        r.fromTable === junctionTable || r.toTable === junctionTable
      ) || rels;
      rels = allJunctionRels;
    }
    
    closeContextMenu();
    openRelationshipDetailsModal(rels);
  };

  const handleDeleteClick = () => {
    closeContextMenu();
    
    // For N:M virtual edges, check if the junction table is user-created
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      const junctionTable = workingSchema.tables[data.junctionTable];
      
      // Only allow deletion if junction table is user-created
      if (junctionTable?.isUserCreated) {
        // Get ALL relationships from the junction table (including both FKs)
        const junctionRels = workingSchema.relationships.filter(rel => 
          rel.fromTable === data.junctionTable
        );
        
        // Mark them as part of junction table deletion
        const relsWithJunctionFlag = junctionRels.map(rel => ({
          ...rel,
          isJunctionRelationship: true,
          junctionTable: data.junctionTable
        }));
        
        openRelationshipDeleteModal(relsWithJunctionFlag);
      }
      return;
    }
    
    // For regular FK lines from junction table, check if junction table is user-created
    const junctionTableName = data?.bundledRelationships?.[0]?.fromTable;
    if (junctionTableName && workingSchema?.tables[junctionTableName]) {
      const junctionTable = workingSchema.tables[junctionTableName];
      
      // Check if this is a junction table by looking at its structure
      const isJunctionTable = junctionTable.isUserCreated && 
        Object.values(junctionTable.columns).filter(col => col.fk).length === 2;
      
      if (isJunctionTable) {
        // Get ALL relationships from the junction table
        const junctionRels = workingSchema.relationships.filter(rel => 
          rel.fromTable === junctionTableName
        );
        
        // Mark them as part of junction table deletion
        const relsWithJunctionFlag = junctionRels.map(rel => ({
          ...rel,
          isJunctionRelationship: true,
          junctionTable: junctionTableName
        }));
        
        openRelationshipDeleteModal(relsWithJunctionFlag);
        return;
      }
    }
    
    // For regular relationships, only show user-created ones
    const rels = getAllRelationships().filter(rel => rel.isUserCreated);
    if (rels.length > 0) {
      openRelationshipDeleteModal(rels);
    }
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

  // Check if any relationship is user-created OR if this is a user-created junction table
  const hasUserCreatedRelationships = () => {
    // For N:M virtual edges, check if junction table is user-created
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      const junctionTable = workingSchema.tables[data.junctionTable];
      return junctionTable?.isUserCreated === true;
    }
    
    // For FK lines from junction table, check if junction table is user-created
    const junctionTableName = data?.bundledRelationships?.[0]?.fromTable;
    if (junctionTableName && workingSchema?.tables[junctionTableName]) {
      const junctionTable = workingSchema.tables[junctionTableName];
      const isJunctionTable = junctionTable.isUserCreated && 
        Object.values(junctionTable.columns).filter(col => col.fk).length === 2;
      
      if (isJunctionTable) {
        return true;
      }
    }
    
    // For regular relationships, check if any are user-created
    const rels = getAllRelationships();
    return rels.some(rel => rel.isUserCreated);
  };

  // Create crow's foot markers with proper cardinality notation
  const createCrowsFootMarkers = () => {
    const markers = [];
    
    // Calculate direction vector
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return markers; // Avoid division by zero
    
    const unitX = dx / length;
    const unitY = dy / length;
    
    // FIXED CARDINAL DIRECTION - Based on connection side, not line angle
    // Define fixed perpendicular directions for crow's foot spread
    let spreadX, spreadY, dirX, dirY;
    
    // Determine FIXED directions based on which side of the table the connection is on
    // Direction points INWARD toward the table
    switch (targetPosition) {
      case 'left':
        // Connection from left - crow's foot points INWARD (RIGHT), spreads VERTICALLY
        dirX = 1;
        dirY = 0;
        spreadX = 0;
        spreadY = 1;
        break;
      case 'right':
        // Connection from right - crow's foot points INWARD (LEFT), spreads VERTICALLY
        dirX = -1;
        dirY = 0;
        spreadX = 0;
        spreadY = 1;
        break;
      case 'top':
        // Connection from top - crow's foot points INWARD (DOWN), spreads HORIZONTALLY
        dirX = 0;
        dirY = 1;
        spreadX = 1;
        spreadY = 0;
        break;
      case 'bottom':
      default:
        // Connection from bottom - crow's foot points INWARD (UP), spreads HORIZONTALLY
        dirX = 0;
        dirY = -1;
        spreadX = 1;
        spreadY = 0;
        break;
    }
    
    // Determine SOURCE fixed directions (for MANY_TO_MANY relationships)
    // Direction points INWARD toward the source table
    let sourceDirX, sourceDirY, sourceSpreadX, sourceSpreadY;
    switch (sourcePosition) {
      case 'left':
        // Connection from left - crow's foot points INWARD (RIGHT), spreads VERTICALLY
        sourceDirX = 1;
        sourceDirY = 0;
        sourceSpreadX = 0;
        sourceSpreadY = 1;
        break;
      case 'right':
        // Connection from right - crow's foot points INWARD (LEFT), spreads VERTICALLY
        sourceDirX = -1;
        sourceDirY = 0;
        sourceSpreadX = 0;
        sourceSpreadY = 1;
        break;
      case 'top':
        // Connection from top - crow's foot points INWARD (DOWN), spreads HORIZONTALLY
        sourceDirX = 0;
        sourceDirY = 1;
        sourceSpreadX = 1;
        sourceSpreadY = 0;
        break;
      case 'bottom':
      default:
        // Connection from bottom - crow's foot points INWARD (UP), spreads HORIZONTALLY
        sourceDirX = 0;
        sourceDirY = -1;
        sourceSpreadX = 1;
        sourceSpreadY = 0;
        break;
    }
    
    // Marker dimensions - increased sizes
    const crowsFootLength = 10; // Increased from 8
    const crowsFootSpread = 8; // Increased from 6
    const circleRadius = 4; // Increased from 3
    const sourceMarkerDistance = 8; // Increased from 6
    const targetMarkerDistance = 3; // Increased from 2
    
    // Determine relationship type and create appropriate markers
    const relationType = data?.type || 'ONE_TO_MANY';
    const cardinalityType = data?.cardinalityType || '1:N';
    
    // SOURCE SIDE (Parent/One side) - Circle for "one" side only (not for MANY_TO_MANY)
    const circleX = sourceX + unitX * sourceMarkerDistance;
    const circleY = sourceY + unitY * sourceMarkerDistance;
    
    // Only show circle if NOT many-to-many (for many-to-many, we'll show crow's foot only)
    if (relationType !== 'MANY_TO_MANY') {
      markers.push(
        <circle
          key="source-marker"
          cx={circleX}
          cy={circleY}
          r={circleRadius}
          fill={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : bgColor))}
          stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
          strokeWidth="1.5"
        />
      );
    }
    
    // TARGET SIDE (Child/Many side) - Varies by relationship type
    const targetBaseX = targetX - unitX * targetMarkerDistance;
    const targetBaseY = targetY - unitY * targetMarkerDistance;
    
    switch (relationType) {
      case 'ONE_TO_ONE':
      case 'ONE_TO_ONE_UNIQUE':
        // 1:1* - Circle on both ends with dotted line for unique FK (o.....o)
        markers.push(
          <circle
            key="target-marker-unique"
            cx={targetBaseX}
            cy={targetBaseY}
            r={circleRadius}
            fill={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : bgColor))}
            stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
            strokeWidth="1.5"
          />
        );
        break;
        
      case 'MANY_TO_MANY':
        // N:M - Crow's foot on both ends (>------<)
        // Target side crow's foot - using FIXED direction
        const targetCenterEndX = targetBaseX + dirX * crowsFootLength;
        const targetCenterEndY = targetBaseY + dirY * crowsFootLength;
        
        markers.push(
          <g key="target-crows-foot">
            {/* Center line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={targetCenterEndX}
              y2={targetCenterEndY}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={targetCenterEndX + spreadX * crowsFootSpread}
              y2={targetCenterEndY - spreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={targetCenterEndX - spreadX * crowsFootSpread}
              y2={targetCenterEndY + spreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        );
        
        // Source side crow's foot for N:M - using FIXED direction
        // No circle on many side, so position directly at source
        const sourceCrowsFootBaseX = sourceX + unitX * sourceMarkerDistance;
        const sourceCrowsFootBaseY = sourceY + unitY * sourceMarkerDistance;
        const sourceCenterEndX = sourceCrowsFootBaseX + sourceDirX * crowsFootLength;
        const sourceCenterEndY = sourceCrowsFootBaseY + sourceDirY * crowsFootLength;
        
        markers.push(
          <g key="source-crows-foot">
            {/* Center line */}
            <line
              x1={sourceCrowsFootBaseX}
              y1={sourceCrowsFootBaseY}
              x2={sourceCenterEndX}
              y2={sourceCenterEndY}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={sourceCrowsFootBaseX}
              y1={sourceCrowsFootBaseY}
              x2={sourceCenterEndX + sourceSpreadX * crowsFootSpread}
              y2={sourceCenterEndY - sourceSpreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={sourceCrowsFootBaseX}
              y1={sourceCrowsFootBaseY}
              x2={sourceCenterEndX - sourceSpreadX * crowsFootSpread}
              y2={sourceCenterEndY + sourceSpreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        );
        break;
        
      case 'ONE_TO_MANY':
      default:
        // 1:N - Crow's foot on many side (o------<) - using FIXED direction
        const centerEndX = targetBaseX + dirX * crowsFootLength;
        const centerEndY = targetBaseY + dirY * crowsFootLength;
        
        markers.push(
          <g key="target-crows-foot">
            {/* Center line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={centerEndX}
              y2={centerEndY}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={centerEndX + spreadX * crowsFootSpread}
              y2={centerEndY - spreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={centerEndX - spreadX * crowsFootSpread}
              y2={centerEndY + spreadY * crowsFootSpread}
              stroke={isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : (isUserCreated ? '#125da8aa' : (isCircularDependencyLine ? '#ef4444' : lineColor))}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        );
        break;
    }
    
    return markers;
  };

  return (
    <g key={`crows-foot-relationship-${id}`}>
      {/* Only render path for non-self-join relationships */}
      {!selfJoin && (
        <>
          {/* Main edge path */}
          <path
            id={id}
            className="react-flow__edge-path crows-foot-edge-path"
            d={edgePath}
            stroke={
              isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : // Purple for N:M (HIGHEST priority)
              isUserCreated ? '#125da8aa' : // Blue for user-created (permanent)
              isCircularDependencyLine ? '#ef4444' : // Red for circular dependency lines
              isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : // Green for PK hover, Blue for FK hover
              lineColor // Default color for database relationships
            }
            strokeWidth={isNMJunctionLine || isNMVirtualLineHighlighted ? 2.5 : (isUserCreated || isCircularDependencyLine ? 2.5 : (isHoverHighlighted ? 2.5 : 1.5))}
            strokeDasharray={relationshipStyle.strokeDasharray}
            fill="none"
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              filter: isNMJunctionLine || isNMVirtualLineHighlighted || isHoverHighlighted ?
                `drop-shadow(0 0 6px ${
                  isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : // Purple for N:M
                  isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : 
                  '#3b82f6'
                })` : (isUserCreated ? `drop-shadow(0 0 4px #125da8aa)` : (isCircularDependencyLine ? `drop-shadow(0 0 4px #ef4444)` : "none")), // Subtle glow for user-created and circular dependency
              transition: 'all 0.2s ease'
            }}
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            data-relationship-id={id}
            data-user-created={isUserCreated ? 'true' : 'false'}
            data-nm-highlighted={(isNMJunctionLine || isNMVirtualLineHighlighted) ? 'true' : 'false'}
          />
          
          {/* Crow's foot markers */}
          {createCrowsFootMarkers()}
          
          {/* Wider invisible clickable area */}
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
          
          {/* Cardinality label with background */}
          <g onClick={handleEdgeClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
            {/* Background rectangle for better visibility */}
            <rect
              x={labelX - 18}
              y={labelY - 20}
              width="36"
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
              y={labelY - 10}
              textAnchor="middle"
              fill={lineColor}
              fontSize="10"
              fontWeight="500"
              fontFamily="monospace"
              style={{
                userSelect: 'none',
                pointerEvents: 'none'
              }}
              data-relationship-id={id}
            >
              {data?.cardinalityType || relationshipStyle.cardinality}
              {data?.type === 'ONE_TO_ONE_UNIQUE' && ' (U)'}
            </text>
          </g>
        </>
      )}
      
      {/* Self-join indicator - same as DirectRelationshipEdge */}
      {selfJoin && (
        <circle
          cx={Math.max(sourceX, targetX) + 25}
          cy={(sourceY + targetY) / 2}
          r="8"
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeDasharray="3,3"
          style={{
            cursor: 'pointer',
            pointerEvents: 'all'
          }}
          onClick={handleEdgeClick}
          onContextMenu={handleContextMenu}
          data-relationship-id={id}
        />
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
};

CrowsFootEdge.displayName = 'CrowsFootEdge';
