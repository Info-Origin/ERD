import { memo, useState } from 'react';
import { getSmoothStepPath } from '@xyflow/react';
import { useApp } from "../../context/AppContext";
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
    // NEW: Hover-based highlighting
    hoverHighlightedRelationships 
  } = useApp();
  const [isClicked, setIsClicked] = useState(false);

  // Check if this is a self-join relationship (define early)
  const selfJoin = data?.fromTable === data?.toTable;

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
              isHighlighted ? '#ff6b35' : // Pearl orange for click-based highlighting
              isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : // Green for PK hover, Blue for FK hover
              lineColor // Default color
            }
            strokeWidth={isHighlighted || isHoverHighlighted ? 2.5 : 1.5}
            strokeDasharray={strokeDasharray}
            fill="none"
            markerEnd={markerEnd}
            markerStart={markerStart}
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              filter: isClicked || isHighlighted || isHoverHighlighted ? 
                `drop-shadow(0 0 6px ${
                  isHighlighted ? '#ff6b35' : 
                  isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') : 
                  '#3b82f6'
                })` : "none",
              transition: 'all 0.2s ease'
            }}
            onClick={handleEdgeClick}
            data-relationship-id={id}
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
            data-relationship-id={id}
          />
          
        {/* Optional: Relationship label at calculated position with background */}
        {label && (
          <g onClick={handleEdgeClick} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
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
    </g>
  );
});

DirectRelationshipEdge.displayName = 'DirectRelationshipEdge';