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
  const { setHighlightedRelationship, highlightedRelationship } = useApp();
  const [isClicked, setIsClicked] = useState(false);

  // Check if this is a self-join relationship (define early)
  const selfJoin = data?.fromTable === data?.toTable;

  // Use CSS variables for theme-aware colors (same as orthogonal lines)
  // Instead of computing colors in JS, we'll use CSS variables directly
  const lineColor = 'var(--erd-line-color)';
  const highlightColor = '#3b82f6';
  
  // Check if this edge is currently highlighted (with corrected semantics)
  const isHighlighted = highlightedRelationship && 
    data?.fromTable && data?.toTable && data?.fromColumn && data?.toColumn &&
    // Compare with corrected semantic direction
    highlightedRelationship.fromTable === data.toTable &&     // PK table
    highlightedRelationship.toTable === data.fromTable &&     // FK table  
    highlightedRelationship.fromColumn === data.toColumn &&   // PK column
    highlightedRelationship.toColumn === data.fromColumn;     // FK column

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
      
      let highlightData = null;
      
      // For all relationships, we should have column information
      if (data.fromColumn && data.toColumn && data.fromTable && data.toTable) {
        // IMPORTANT: Fix ERD semantic direction
        // Database stores: FK → PK (for foreign key constraint direction)
        // ERD semantics: PK → FK (for user display - parent to child)
        
        // Determine which side is PK and which is FK based on column names and relationship
        // In most cases: fromTable.fromColumn is FK, toTable.toColumn is PK
        // So we need to reverse for proper ERD semantics
        
        highlightData = {
          // Semantic "From" = PK side (parent) - this is usually the "to" in database terms
          fromTable: data.toTable,     // PK table (parent)
          fromColumn: data.toColumn,   // PK column (parent)
          // Semantic "To" = FK side (child) - this is usually the "from" in database terms
          toTable: data.fromTable,     // FK table (child)
          toColumn: data.fromColumn,   // FK column (child)
          relationType: data.relationType || 'ONE_TO_MANY'
        };
        
        // Set the highlighted relationship
        setHighlightedRelationship(highlightData);
        
        // Clear highlight after 8 seconds
        setTimeout(() => {
          setHighlightedRelationship(null);
        }, 8000);
        
      } else {
        // Try to extract basic info for fallback highlighting
        if (data.fromTable && data.toTable) {
          const pkColumn = 'id';
          const fkColumn = `${data.fromTable}_id`;
          
          highlightData = {
            fromTable: data.fromTable,
            fromColumn: pkColumn,
            toTable: data.toTable,
            toColumn: fkColumn,
            relationType: 'ONE_TO_MANY'
          };
          
          setHighlightedRelationship(highlightData);
          
          setTimeout(() => {
            setHighlightedRelationship(null);
          }, 8000);
        } else {
          // Missing table data - skip highlighting
        }
      }
    } else {
      // No data available for edge - skip highlighting
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
            stroke={isHighlighted ? highlightColor : lineColor}
            strokeWidth={1.5}
            strokeDasharray={strokeDasharray}
            fill="none"
            markerEnd={markerEnd}
            markerStart={markerStart}
            style={{
              cursor: 'pointer',
              pointerEvents: 'all',
              filter: isClicked || isHighlighted ? "drop-shadow(0 0 6px #3b82f6)" : "none",
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
          
          {/* Optional: Relationship label at calculated position */}
          {label && (
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill={lineColor}
              fontSize="12"
              fontWeight="500"
              style={{
                cursor: 'pointer',
                pointerEvents: 'all',
                userSelect: 'none'
              }}
              onClick={handleEdgeClick}
              data-relationship-id={id}
            >
              {label}
            </text>
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