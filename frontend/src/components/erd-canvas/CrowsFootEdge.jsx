import { memo, useState } from 'react';
import { getSmoothStepPath } from '@xyflow/react';
import { useApp } from "../../context/AppContext";
import './RelationshipEdge.css';

export const CrowsFootEdge = memo(({
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
  const { setHighlightedRelationship, highlightedRelationship } = useApp();
  const [isClicked, setIsClicked] = useState(false);

  // Check if this is a self-join relationship (define early)
  const selfJoin = data?.fromTable === data?.toTable;

  // Use CSS variables for theme-aware colors
  // Instead of computing colors in JS, we'll use CSS variables directly in SVG
  const lineColor = 'var(--erd-line-color)';
  const bgColor = 'var(--bg-primary)';
  const highlightColor = '#3b82f6';
  
  // Check if this edge is currently highlighted
  const isHighlighted = highlightedRelationship && 
    data?.fromTable && data?.toTable && data?.fromColumn && data?.toColumn &&
    highlightedRelationship.fromTable === data.toTable &&
    highlightedRelationship.toTable === data.fromTable &&
    highlightedRelationship.fromColumn === data.toColumn &&
    highlightedRelationship.toColumn === data.fromColumn;

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
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 5000);
      
      if (data.fromColumn && data.toColumn && data.fromTable && data.toTable) {
        const highlightData = {
          fromTable: data.toTable,
          fromColumn: data.toColumn,
          toTable: data.fromTable,
          toColumn: data.fromColumn,
          relationType: data.relationType || 'ONE_TO_MANY'
        };
        
        setHighlightedRelationship(highlightData);
        
        setTimeout(() => {
          setHighlightedRelationship(null);
        }, 8000);
      }
    }
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
          fill={isHighlighted ? highlightColor : bgColor}
          stroke={isHighlighted ? highlightColor : lineColor}
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
            fill={isHighlighted ? highlightColor : bgColor}
            stroke={isHighlighted ? highlightColor : lineColor}
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
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={targetCenterEndX + spreadX * crowsFootSpread}
              y2={targetCenterEndY - spreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={targetCenterEndX - spreadX * crowsFootSpread}
              y2={targetCenterEndY + spreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
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
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={sourceCrowsFootBaseX}
              y1={sourceCrowsFootBaseY}
              x2={sourceCenterEndX + sourceSpreadX * crowsFootSpread}
              y2={sourceCenterEndY - sourceSpreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={sourceCrowsFootBaseX}
              y1={sourceCrowsFootBaseY}
              x2={sourceCenterEndX - sourceSpreadX * crowsFootSpread}
              y2={sourceCenterEndY + sourceSpreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
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
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Top/Right line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={centerEndX + spreadX * crowsFootSpread}
              y2={centerEndY - spreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Bottom/Left line */}
            <line
              x1={targetBaseX}
              y1={targetBaseY}
              x2={centerEndX - spreadX * crowsFootSpread}
              y2={centerEndY + spreadY * crowsFootSpread}
              stroke={isHighlighted ? highlightColor : lineColor}
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
            stroke={isHighlighted ? highlightColor : lineColor}
            strokeWidth={1.5}
            strokeDasharray={relationshipStyle.strokeDasharray}
            fill="none"
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              filter: isClicked || isHighlighted ? "drop-shadow(0 0 6px #3b82f6)" : "none",
              transition: 'all 0.2s ease'
            }}
            onClick={handleEdgeClick}
            data-relationship-id={id}
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
            data-relationship-id={id}
          />
          
          {/* Cardinality label */}
          <text
            x={labelX}
            y={labelY - 10}
            textAnchor="middle"
            fill={lineColor}
            fontSize="10"
            fontWeight="500"
            fontFamily="monospace"
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              userSelect: 'none',
              background: 'var(--bg-primary)',
              padding: '2px 4px',
              borderRadius: '2px'
            }}
            onClick={handleEdgeClick}
            data-relationship-id={id}
          >
            {data?.cardinalityType || relationshipStyle.cardinality}
            {data?.type === 'ONE_TO_ONE_UNIQUE' && ' (U)'}
          </text>
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
          data-relationship-id={id}
        />
      )}
    </g>
  );
});

CrowsFootEdge.displayName = 'CrowsFootEdge';