import { memo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import type { Relationship } from "../../types";

interface EdgeData {
  fromTable?: string;
  fromColumn?: string;
  toTable?: string;
  toColumn?: string;
  bundledRelationships?: Relationship[];
  elkBendPoints?: { x: number; y: number }[];
  relationType?: string;
}

interface ELKRelationshipEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data?: EdgeData;
  style?: React.CSSProperties;
}

export const ELKRelationshipEdge = memo(
  ({ id, sourceX, sourceY, targetX, targetY, data, style }: ELKRelationshipEdgeProps) => {
    const { setHighlightedRelationship, highlightedRelationship } = useApp();
    const { theme } = useTheme();
    const [isClicked, setIsClicked] = useState(false);

    const lineColor = theme === 'dark' ? '#bdc3c7' : '#2c3e50';

    const isHighlighted =
      highlightedRelationship &&
      data?.bundledRelationships?.some(
        (rel) =>
          highlightedRelationship.fromTable === rel.toTable &&
          highlightedRelationship.toTable === rel.fromTable &&
          highlightedRelationship.fromColumn === rel.toColumn &&
          highlightedRelationship.toColumn === rel.fromColumn
      );

    const handleEdgeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data?.fromTable && data?.toTable && data?.fromColumn && data?.toColumn) {
        const rel = data.bundledRelationships?.[0] || data;
        setHighlightedRelationship({
          fromTable: rel.toTable!, fromColumn: rel.toColumn!,
          toTable: rel.fromTable!, toColumn: rel.fromColumn!,
          type: (data.relationType || 'ONE_TO_MANY') as import('../../types').RelationshipType,
        } as Parameters<typeof setHighlightedRelationship>[0]);
        setTimeout(() => setHighlightedRelationship(null), 8000);
      }
    };

    const createPath = () => {
      if (data?.elkBendPoints && data.elkBendPoints.length > 0) {
        let path = `M ${sourceX} ${sourceY}`;
        data.elkBendPoints.forEach((point) => { path += ` L ${point.x} ${point.y}`; });
        path += ` L ${targetX} ${targetY}`;
        return path;
      }
      const deltaX = targetX - sourceX;
      const deltaY = targetY - sourceY;
      const minDistance = 30;
      if (Math.abs(deltaX) < minDistance && Math.abs(deltaY) < minDistance) {
        return `M ${sourceX} ${sourceY} L ${sourceX} ${targetY} L ${targetX} ${targetY}`;
      }
      const isTargetToRight = deltaX > 0;
      const isTargetBelow = deltaY > 0;
      const horizontalOffset = Math.abs(deltaX) * 0.6;
      const verticalOffset = Math.abs(deltaY) * 0.6;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const midX = isTargetToRight ? sourceX + horizontalOffset : sourceX - horizontalOffset;
        return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      } else {
        const midY = isTargetBelow ? sourceY + verticalOffset : sourceY - verticalOffset;
        return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      }
    };

    const edgePath = createPath();
    const relationType = data?.relationType || 'ONE_TO_MANY';
    const isSelfJoin = data?.fromTable === data?.toTable;

    return (
      <g>
        <path
          d={edgePath}
          stroke={isHighlighted ? '#3b82f6' : lineColor}
          strokeWidth={isHighlighted ? 3 : 2}
          strokeDasharray={isSelfJoin ? "5,5" : "none"}
          fill="none"
          style={{ cursor: 'pointer', filter: isHighlighted ? 'drop-shadow(0 0 6px #3b82f6)' : 'none' }}
          onClick={handleEdgeClick}
        />
        <path d={edgePath} stroke="transparent" strokeWidth="20" fill="none" style={{ cursor: 'pointer' }} onClick={handleEdgeClick} />
        {relationType === 'ONE_TO_MANY' && (
          <>
            <g transform={`translate(${sourceX}, ${sourceY})`}>
              <line x1="-8" y1="-4" x2="-8" y2="4" stroke={lineColor} strokeWidth="2" />
              <line x1="-5" y1="-4" x2="-5" y2="4" stroke={lineColor} strokeWidth="2" />
            </g>
            <g transform={`translate(${targetX}, ${targetY})`}>
              <line x1="0" y1="0" x2="8" y2="-4" stroke={lineColor} strokeWidth="2" />
              <line x1="0" y1="0" x2="8" y2="0" stroke={lineColor} strokeWidth="2" />
              <line x1="0" y1="0" x2="8" y2="4" stroke={lineColor} strokeWidth="2" />
            </g>
          </>
        )}
      </g>
    );
  }
);

ELKRelationshipEdge.displayName = "ELKRelationshipEdge";
