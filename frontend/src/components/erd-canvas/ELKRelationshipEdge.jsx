import { memo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";

/**
 * ELK-based Relationship Edge Component
 * Uses ELK.js routing information for professional orthogonal paths
 */
export const ELKRelationshipEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    style,
  }) => {
    const { setHighlightedRelationship, highlightedRelationship } = useApp();
    const { theme } = useTheme();
    const [isClicked, setIsClicked] = useState(false);
    
    // Theme-aware colors
    const lineColor = theme === 'dark' ? '#bdc3c7' : '#2c3e50';
    const hoverColor = theme === 'dark' ? '#ecf0f1' : '#34495e';
    
    // Check if this edge is currently highlighted (with corrected semantics)
    // For bundled relationships, check against ALL relationships in the bundle
    const isHighlighted = highlightedRelationship && data?.bundledRelationships && 
      data.bundledRelationships.some(rel => 
        highlightedRelationship.fromTable === rel.toTable &&     // PK table
        highlightedRelationship.toTable === rel.fromTable &&     // FK table  
        highlightedRelationship.fromColumn === rel.toColumn &&   // PK column
        highlightedRelationship.toColumn === rel.fromColumn      // FK column
      );

    const handleEdgeClick = (e) => {
      e.stopPropagation();
      
      if (data?.fromTable && data?.toTable && data?.fromColumn && data?.toColumn) {
        // For bundled relationships, highlight the FIRST relationship in the bundle
        // The edge highlighting logic will check ALL bundled relationships
        const relationshipToHighlight = data.bundledRelationships?.[0] || data;
        
        const highlightData = {
          fromTable: relationshipToHighlight.toTable,     // PK table (parent)
          fromColumn: relationshipToHighlight.toColumn,   // PK column (parent)
          toTable: relationshipToHighlight.fromTable,     // FK table (child)
          toColumn: relationshipToHighlight.fromColumn,   // FK column (child)
          relationType: relationshipToHighlight.relationType || 'ONE_TO_MANY'
        };
        
        setHighlightedRelationship(highlightData);
        
        // Clear highlight after 8 seconds
        setTimeout(() => {
          setHighlightedRelationship(null);
        }, 8000);
      }
    };

    // Create orthogonal path using ELK bend points or calculate our own
    const createPath = () => {
      if (data?.elkBendPoints && data.elkBendPoints.length > 0) {
        // Use ELK bend points for orthogonal routing
        let path = `M ${sourceX} ${sourceY}`;
        
        data.elkBendPoints.forEach(point => {
          path += ` L ${point.x} ${point.y}`;
        });
        
        path += ` L ${targetX} ${targetY}`;
        return path;
      } else {
        // Create professional orthogonal path (MySQL Workbench style)
        const deltaX = targetX - sourceX;
        const deltaY = targetY - sourceY;
        
        // Use a more sophisticated routing algorithm
        const minDistance = 30; // Minimum distance for bends
        
        if (Math.abs(deltaX) < minDistance && Math.abs(deltaY) < minDistance) {
          // Very close - use simple L-shape
          return `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`;
        }
        
        // Determine best routing based on positions
        const isTargetToRight = deltaX > 0;
        const isTargetBelow = deltaY > 0;
        
        // Calculate intermediate points for clean orthogonal routing
        const horizontalOffset = Math.abs(deltaX) * 0.6;
        const verticalOffset = Math.abs(deltaY) * 0.6;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal routing preferred
          const midX = isTargetToRight 
            ? sourceX + horizontalOffset 
            : sourceX - horizontalOffset;
          
          return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
        } else {
          // Vertical routing preferred
          const midY = isTargetBelow 
            ? sourceY + verticalOffset 
            : sourceY - verticalOffset;
          
          return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
        }
      }
    };

    const edgePath = createPath();
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    // Determine relationship symbols
    const relationType = data?.relationType || 'ONE_TO_MANY';
    const isSelfJoin = data?.fromTable === data?.toTable;

    return (
      <g>
        {/* Main relationship line */}
        <path
          d={edgePath}
          stroke={isHighlighted ? '#3b82f6' : lineColor}
          strokeWidth={isHighlighted ? 3 : 2}
          strokeDasharray={isSelfJoin ? "5,5" : "none"}
          fill="none"
          style={{
            cursor: 'pointer',
            filter: isHighlighted ? 'drop-shadow(0 0 6px #3b82f6)' : 'none'
          }}
          onClick={handleEdgeClick}
        />
        
        {/* Wider invisible clickable area */}
        <path
          d={edgePath}
          stroke="transparent"
          strokeWidth="20"
          fill="none"
          style={{ cursor: 'pointer' }}
          onClick={handleEdgeClick}
        />
        
        {/* Crow's foot markers */}
        {relationType === 'ONE_TO_MANY' && (
          <>
            {/* "One" side marker at source */}
            <g transform={`translate(${sourceX}, ${sourceY})`}>
              <line x1="-8" y1="-4" x2="-8" y2="4" stroke={lineColor} strokeWidth="2"/>
              <line x1="-5" y1="-4" x2="-5" y2="4" stroke={lineColor} strokeWidth="2"/>
            </g>
            
            {/* "Many" side marker at target */}
            <g transform={`translate(${targetX}, ${targetY})`}>
              <line x1="0" y1="0" x2="8" y2="-4" stroke={lineColor} strokeWidth="2"/>
              <line x1="0" y1="0" x2="8" y2="0" stroke={lineColor} strokeWidth="2"/>
              <line x1="0" y1="0" x2="8" y2="4" stroke={lineColor} strokeWidth="2"/>
            </g>
          </>
        )}
      </g>
    );
  }
);

ELKRelationshipEdge.displayName = "ELKRelationshipEdge";