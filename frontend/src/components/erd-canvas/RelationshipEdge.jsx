import { memo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import "./RelationshipEdge.css";

/**
 * MySQL Workbench Style: Orthogonal routing with column-level handle positioning
 * Handles format: table.column.side or target.table.column.side
 */
const getMySQLWorkbenchPath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  portIndex = 1,
  totalRelationships = 1,
  sourceHandle,
  targetHandle,
}) => {
  let path = `M ${sourceX} ${sourceY}`;
  let labelX, labelY;

  // MySQL Workbench spacing: Each relationship gets its own lane
  const laneSpacing = 15; // Distance between parallel lines
  const laneOffset = (portIndex - 1) * laneSpacing; // Offset for this specific lane

  // Extract actual position from handle (remove table.column prefix)
  const getPositionFromHandle = (handle) => {
    if (!handle) return sourcePosition || targetPosition;
    
    // Handle formats: "table.column.side" or "target.table.column.side"
    const parts = handle.split('.');
    return parts[parts.length - 1]; // Get the last part (side)
  };

  const actualSourcePosition = getPositionFromHandle(sourceHandle);
  const actualTargetPosition = getPositionFromHandle(targetHandle);

  // Self-join handling with external loops (each gets its own lane)
  if (actualSourcePosition === actualTargetPosition) {
    const loopSize = 80 + laneOffset; // Each loop gets progressively larger
    if (actualSourcePosition === "right") {
      path += ` L ${sourceX + loopSize} ${sourceY} L ${sourceX + loopSize} ${targetY + loopSize} L ${targetX} ${targetY + loopSize} L ${targetX} ${targetY}`;
      labelX = sourceX + loopSize + 20;
      labelY = sourceY + loopSize / 2;
    } else if (actualSourcePosition === "bottom") {
      path += ` L ${sourceX} ${sourceY + loopSize} L ${targetX - loopSize} ${sourceY + loopSize} L ${targetX - loopSize} ${targetY} L ${targetX} ${targetY}`;
      labelX = sourceX - loopSize / 2;
      labelY = sourceY + loopSize + 20;
    } else if (actualSourcePosition === "left") {
      path += ` L ${sourceX - loopSize} ${sourceY} L ${sourceX - loopSize} ${targetY - loopSize} L ${targetX} ${targetY - loopSize} L ${targetX} ${targetY}`;
      labelX = sourceX - loopSize - 20;
      labelY = sourceY - loopSize / 2;
    } else { // top
      path += ` L ${sourceX} ${sourceY - loopSize} L ${targetX + loopSize} ${sourceY - loopSize} L ${targetX + loopSize} ${targetY} L ${targetX} ${targetY}`;
      labelX = sourceX + loopSize / 2;
      labelY = sourceY - loopSize - 20;
    }
    return [path, labelX, labelY];
  }

  // Standard orthogonal routing with lane-based parallel spacing
  if (actualSourcePosition === 'right' && actualTargetPosition === 'left') {
    // Horizontal connection with parallel lanes
    if (Math.abs(sourceY - targetY) < 10) {
      // Direct horizontal - add vertical offset for parallel lanes
      const adjustedSourceY = sourceY + laneOffset;
      const adjustedTargetY = targetY + laneOffset;
      path = `M ${sourceX} ${adjustedSourceY} L ${targetX} ${adjustedTargetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = adjustedSourceY - 20;
    } else {
      // L-shaped with lane spacing
      const midX = sourceX + 50 + laneOffset;
      path += ` L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      labelX = midX + 20;
      labelY = (sourceY + targetY) / 2;
    }
  } else if (actualSourcePosition === 'left' && actualTargetPosition === 'right') {
    // Horizontal connection (opposite) with parallel lanes
    if (Math.abs(sourceY - targetY) < 10) {
      // Direct horizontal - add vertical offset for parallel lanes
      const adjustedSourceY = sourceY + laneOffset;
      const adjustedTargetY = targetY + laneOffset;
      path = `M ${sourceX} ${adjustedSourceY} L ${targetX} ${adjustedTargetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = adjustedSourceY - 20;
    } else {
      // L-shaped with lane spacing
      const midX = sourceX - 50 - laneOffset;
      path += ` L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      labelX = midX - 20;
      labelY = (sourceY + targetY) / 2;
    }
  } else if (actualSourcePosition === 'bottom' && actualTargetPosition === 'top') {
    // Vertical connection with parallel lanes
    if (Math.abs(sourceX - targetX) < 10) {
      // Direct vertical - add horizontal offset for parallel lanes
      const adjustedSourceX = sourceX + laneOffset;
      const adjustedTargetX = targetX + laneOffset;
      path = `M ${adjustedSourceX} ${sourceY} L ${adjustedTargetX} ${targetY}`;
      labelX = adjustedSourceX + 30;
      labelY = (sourceY + targetY) / 2;
    } else {
      // L-shaped with lane spacing
      const midY = sourceY + 50 + laneOffset;
      path += ` L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = midY + 25;
    }
  } else if (actualSourcePosition === 'top' && actualTargetPosition === 'bottom') {
    // Vertical connection (opposite) with parallel lanes
    if (Math.abs(sourceX - targetX) < 10) {
      // Direct vertical - add horizontal offset for parallel lanes
      const adjustedSourceX = sourceX + laneOffset;
      const adjustedTargetX = targetX + laneOffset;
      path = `M ${adjustedSourceX} ${sourceY} L ${adjustedTargetX} ${targetY}`;
      labelX = adjustedSourceX + 30;
      labelY = (sourceY + targetY) / 2;
    } else {
      // L-shaped with lane spacing
      const midY = sourceY - 50 - laneOffset;
      path += ` L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = midY - 20;
    }
  } else {
    // Cross connections - use L-shaped routing with lane spacing
    const midOffset = 50 + laneOffset; // Each lane gets progressively more offset
    
    if (actualSourcePosition === 'right') {
      const bendX = sourceX + midOffset;
      path += ` L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`;
      labelX = bendX + 20;
      labelY = (sourceY + targetY) / 2;
    } else if (actualSourcePosition === 'left') {
      const bendX = sourceX - midOffset;
      path += ` L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`;
      labelX = bendX - 20;
      labelY = (sourceY + targetY) / 2;
    } else if (actualSourcePosition === 'bottom') {
      const bendY = sourceY + midOffset;
      path += ` L ${sourceX} ${bendY} L ${targetX} ${bendY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = bendY + 25;
    } else if (actualSourcePosition === 'top') {
      const bendY = sourceY - midOffset;
      path += ` L ${sourceX} ${bendY} L ${targetX} ${bendY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = bendY - 20;
    }
  }

  return [path, labelX, labelY];
};

/**
 * Get Crow's Foot symbols based on relationship type
 */
const getCrowsFootSymbols = (relationType) => {
  switch (relationType) {
    case "ONE_TO_ONE":
      return { source: "one", target: "one" };
    case "ONE_TO_MANY":
      return { source: "one", target: "many" };
    case "MANY_TO_ONE":
      return { source: "many", target: "one" };
    case "MANY_TO_MANY":
      return { source: "many", target: "many" };
    default:
      return { source: "one", target: "many" };
  }
};

/**
 * Check if this is a self-join relationship
 */
const isSelfJoin = (data) => {
  return data?.fromTable === data?.toTable;
};

export const RelationshipEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    label,
    markerEnd,
    data,
    style,
    source,
    target,
    sourceHandle,
    targetHandle,
  }) => {
    const { 
      setHighlightedRelationship, 
      highlightedRelationship, 
      routingMode,
      setHighlightedRelationshipWithTimer, // NEW: Improved timer management
      // NEW: Hover-based highlighting
      hoverHighlightedRelationships 
    } = useApp();
    const { theme } = useTheme();
    const [isClicked, setIsClicked] = useState(false);
    
    // Theme-aware colors
    const lineColor = theme === 'dark' ? '#bdc3c7' : '#2c3e50';
    
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
    
    // Extract MySQL Workbench port lane data
    const portIndex = data?.portIndex || 1;
    const totalRelationships = data?.totalRelationships || 1;
    
    // Create MySQL Workbench style orthogonal path with column-level handle positioning
    const [edgePath, labelX, labelY] = getMySQLWorkbenchPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      portIndex,
      totalRelationships,
      sourceHandle,
      targetHandle,
    });

    // Create straight path for simple routing mode
    const straightPath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    const straightLabelX = (sourceX + targetX) / 2;
    const straightLabelY = (sourceY + targetY) / 2;

    // Choose path based on routing mode
    const pathToUse = routingMode === 'orthogonal' ? edgePath : straightPath;
    const labelXToUse = routingMode === 'orthogonal' ? labelX : straightLabelX;
    const labelYToUse = routingMode === 'orthogonal' ? labelY : straightLabelY;

    const handleEdgeClick = (e) => {
      e.stopPropagation();
      
      if (data) {
        // Visual feedback - highlight the edge line itself
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 5000);
        
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

    // Get relationship type for self-join detection
    const selfJoin = isSelfJoin(data);

    // MySQL Workbench style: theme-aware lines, dashed for self-joins
    const edgeStyle = {
      // Remove hardcoded stroke - let CSS handle theme-aware colors
      strokeWidth: isHighlighted || isHoverHighlighted ? 2.5 : 1,
      strokeDasharray: selfJoin ? "5,5" : "none", // Dashed only for self-joins
      cursor: "pointer",
      filter: isClicked || isHighlighted || isHoverHighlighted ? 
        `drop-shadow(0 0 6px ${
          isHighlighted ? '#ff6b35' : 
          isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : 
          '#3b82f6'
        })` : "none",
      ...style,
    };

    // ROUTING MODE TOGGLE - Use orthogonal or straight paths
    return (
      <g key={`relationship-${id}`}>
        {/* Main path with routing mode support */}
        <path
          d={pathToUse}
          stroke={
            isHighlighted ? '#ff6b35' : // Pearl orange for click-based highlighting
            isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : // Green for PK hover, Blue for FK hover
            lineColor // Default color
          }
          strokeWidth={edgeStyle.strokeWidth}
          strokeDasharray={edgeStyle.strokeDasharray}
          fill="none"
          style={{
            cursor: 'pointer',
            pointerEvents: 'all',
            filter: edgeStyle.filter
          }}
          onClick={handleEdgeClick}
          data-relationship-id={id}
        />
        
        {/* Wider invisible clickable area that follows the chosen path */}
        <path
          d={pathToUse}
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
        
        {/* Optional: Relationship label at calculated position with background */}
        {label && (
          <g onClick={handleEdgeClick} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
            {/* Background rectangle for better visibility */}
            <rect
              x={labelXToUse - 20}
              y={labelYToUse - 18}
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
              x={labelXToUse}
              y={labelYToUse}
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
      </g>
    );
  },
);

RelationshipEdge.displayName = "RelationshipEdge";