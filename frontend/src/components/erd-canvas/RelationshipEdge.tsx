import { useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { useTheme } from "../../context/ThemeContext";
import type { Relationship } from "../../types";
import "./RelationshipEdge.css";

interface EdgeData {
  fromTable?: string;
  fromColumn?: string;
  toTable?: string;
  toColumn?: string;
  isVirtualNM?: boolean;
  junctionTable?: string;
  bundledRelationships?: (Relationship & { isJunctionRelationship?: boolean; junctionTable?: string })[];
  isBundled?: boolean;
  bundleCount?: number;
  isUserCreated?: boolean;
  portIndex?: number;
  totalRelationships?: number;
  routingMode?: string;
  crowsFootMode?: boolean;
}

interface RelationshipEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  label?: React.ReactNode;
  markerEnd?: string;
  data?: EdgeData;
  style?: React.CSSProperties;
  source?: string;
  target?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

const getMySQLWorkbenchPath = ({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  portIndex = 1, totalRelationships = 1,
  sourceHandle, targetHandle,
}: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  sourcePosition: string; targetPosition: string;
  portIndex?: number; totalRelationships?: number;
  sourceHandle?: string; targetHandle?: string;
}): [string, number, number] => {
  let path = `M ${sourceX} ${sourceY}`;
  let labelX = 0, labelY = 0;

  const laneSpacing = 15;
  const laneOffset = (portIndex - 1) * laneSpacing;

  const getPositionFromHandle = (handle?: string) => {
    if (!handle) return sourcePosition || targetPosition;
    const parts = handle.split('.');
    return parts[parts.length - 1];
  };

  const actualSourcePosition = getPositionFromHandle(sourceHandle);
  const actualTargetPosition = getPositionFromHandle(targetHandle);

  if (actualSourcePosition === actualTargetPosition) {
    const loopSize = 80 + laneOffset;
    if (actualSourcePosition === "right") {
      path += ` L ${sourceX + loopSize} ${sourceY} L ${sourceX + loopSize} ${targetY + loopSize} L ${targetX} ${targetY + loopSize} L ${targetX} ${targetY}`;
      labelX = sourceX + loopSize + 20; labelY = sourceY + loopSize / 2;
    } else if (actualSourcePosition === "bottom") {
      path += ` L ${sourceX} ${sourceY + loopSize} L ${targetX - loopSize} ${sourceY + loopSize} L ${targetX - loopSize} ${targetY} L ${targetX} ${targetY}`;
      labelX = sourceX - loopSize / 2; labelY = sourceY + loopSize + 20;
    } else if (actualSourcePosition === "left") {
      path += ` L ${sourceX - loopSize} ${sourceY} L ${sourceX - loopSize} ${targetY - loopSize} L ${targetX} ${targetY - loopSize} L ${targetX} ${targetY}`;
      labelX = sourceX - loopSize - 20; labelY = sourceY - loopSize / 2;
    } else {
      path += ` L ${sourceX} ${sourceY - loopSize} L ${targetX + loopSize} ${sourceY - loopSize} L ${targetX + loopSize} ${targetY} L ${targetX} ${targetY}`;
      labelX = sourceX + loopSize / 2; labelY = sourceY - loopSize - 20;
    }
    return [path, labelX, labelY];
  }

  if (actualSourcePosition === 'right' && actualTargetPosition === 'left') {
    if (Math.abs(sourceY - targetY) < 10) {
      const adj = sourceY + laneOffset;
      path = `M ${sourceX} ${adj} L ${targetX} ${adj}`;
      labelX = (sourceX + targetX) / 2; labelY = adj - 20;
    } else {
      const midX = sourceX + 50 + laneOffset;
      path += ` L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      labelX = midX + 20; labelY = (sourceY + targetY) / 2;
    }
  } else if (actualSourcePosition === 'left' && actualTargetPosition === 'right') {
    if (Math.abs(sourceY - targetY) < 10) {
      const adj = sourceY + laneOffset;
      path = `M ${sourceX} ${adj} L ${targetX} ${adj}`;
      labelX = (sourceX + targetX) / 2; labelY = adj - 20;
    } else {
      const midX = sourceX - 50 - laneOffset;
      path += ` L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      labelX = midX - 20; labelY = (sourceY + targetY) / 2;
    }
  } else if (actualSourcePosition === 'bottom' && actualTargetPosition === 'top') {
    if (Math.abs(sourceX - targetX) < 10) {
      const adj = sourceX + laneOffset;
      path = `M ${adj} ${sourceY} L ${adj} ${targetY}`;
      labelX = adj + 30; labelY = (sourceY + targetY) / 2;
    } else {
      const midY = sourceY + 50 + laneOffset;
      path += ` L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2; labelY = midY + 25;
    }
  } else if (actualSourcePosition === 'top' && actualTargetPosition === 'bottom') {
    if (Math.abs(sourceX - targetX) < 10) {
      const adj = sourceX + laneOffset;
      path = `M ${adj} ${sourceY} L ${adj} ${targetY}`;
      labelX = adj + 30; labelY = (sourceY + targetY) / 2;
    } else {
      const midY = sourceY - 50 - laneOffset;
      path += ` L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2; labelY = midY - 20;
    }
  } else {
    const midOffset = 50 + laneOffset;
    if (actualSourcePosition === 'right') {
      const bendX = sourceX + midOffset;
      path += ` L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`;
      labelX = bendX + 20; labelY = (sourceY + targetY) / 2;
    } else if (actualSourcePosition === 'left') {
      const bendX = sourceX - midOffset;
      path += ` L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`;
      labelX = bendX - 20; labelY = (sourceY + targetY) / 2;
    } else if (actualSourcePosition === 'bottom') {
      const bendY = sourceY + midOffset;
      path += ` L ${sourceX} ${bendY} L ${targetX} ${bendY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2; labelY = bendY + 25;
    } else if (actualSourcePosition === 'top') {
      const bendY = sourceY - midOffset;
      path += ` L ${sourceX} ${bendY} L ${targetX} ${bendY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2; labelY = bendY - 20;
    }
  }

  return [path, labelX, labelY];
};

export const RelationshipEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, label, markerEnd,
  data, style, source, target, sourceHandle, targetHandle,
}: RelationshipEdgeProps) => {
  const {
    setHighlightedRelationship, highlightedRelationship, routingMode,
    setHighlightedRelationshipWithTimer, setHighlightedNMRelationshipWithTimer,
    highlightedNMRelationship, hoverHighlightedRelationships,
    deleteRelationships, showNotification,
    openRelationshipDetailsModal, openRelationshipDeleteModal,
    tablesInCircularDependency, relationshipsInCircularDependency,
  } = useApp();
  const { theme } = useTheme();
  const { workingSchema } = useVirtualSchema();

  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

  const lineColor = theme === 'dark' ? '#bdc3c7' : '#2c3e50';

  const isUserCreated = data?.bundledRelationships?.some((rel) => rel.isUserCreated) || data?.isUserCreated;

  const isCircularDependencyLine =
    data?.bundledRelationships?.some((rel) =>
      relationshipsInCircularDependency?.some(
        (c) => c.fromTable === rel.fromTable && c.fromColumn === rel.fromColumn && c.toTable === rel.toTable && c.toColumn === rel.toColumn
      )
    ) ||
    relationshipsInCircularDependency?.some(
      (c) => c.fromTable === data?.fromTable && c.fromColumn === data?.fromColumn && c.toTable === data?.toTable && c.toColumn === data?.toColumn
    );

  const isHighlighted =
    highlightedRelationship &&
    data?.bundledRelationships?.some(
      (rel) =>
        highlightedRelationship.fromTable === rel.toTable &&
        highlightedRelationship.toTable === rel.fromTable &&
        highlightedRelationship.fromColumn === rel.toColumn &&
        highlightedRelationship.toColumn === rel.fromColumn
    );

  const hoverHighlight =
    data?.bundledRelationships &&
    hoverHighlightedRelationships.find((hoverRel) =>
      data.bundledRelationships!.some(
        (rel) =>
          hoverRel.fromTable === rel.toTable &&
          hoverRel.toTable === rel.fromTable &&
          hoverRel.fromColumn === rel.toColumn &&
          hoverRel.toColumn === rel.fromColumn
      )
    );

  const isHoverHighlighted = !!hoverHighlight;

  const isNMJunctionLine =
    highlightedNMRelationship &&
    ((data?.fromTable === highlightedNMRelationship.junctionTable &&
      (data?.toTable === highlightedNMRelationship.table1 || data?.toTable === highlightedNMRelationship.table2)) ||
      data?.bundledRelationships?.some(
        (rel) =>
          rel.fromTable === highlightedNMRelationship.junctionTable &&
          (rel.toTable === highlightedNMRelationship.table1 || rel.toTable === highlightedNMRelationship.table2)
      ));

  const isNMVirtualLineHighlighted =
    data?.isVirtualNM &&
    highlightedNMRelationship &&
    data.junctionTable === highlightedNMRelationship.junctionTable &&
    ((data.fromTable === highlightedNMRelationship.table1 && data.toTable === highlightedNMRelationship.table2) ||
      (data.fromTable === highlightedNMRelationship.table2 && data.toTable === highlightedNMRelationship.table1));

  const portIndex = data?.portIndex || 1;
  const totalRelationships = data?.totalRelationships || 1;

  const [edgePath, labelX, labelY] = getMySQLWorkbenchPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    portIndex, totalRelationships,
    sourceHandle, targetHandle,
  });

  const straightPath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const straightLabelX = (sourceX + targetX) / 2;
  const straightLabelY = (sourceY + targetY) / 2;

  const pathToUse = routingMode === 'orthogonal' ? edgePath : straightPath;
  const labelXToUse = routingMode === 'orthogonal' ? labelX : straightLabelX;
  const labelYToUse = routingMode === 'orthogonal' ? labelY : straightLabelY;

  const selfJoin = data?.fromTable === data?.toTable;
  const strokeDasharray = selfJoin ? "5,5" : "none";

  const getAllRelationships = () => {
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      return workingSchema.relationships.filter((rel) => rel.fromTable === data.junctionTable);
    }
    if (data?.bundledRelationships && data.bundledRelationships.length > 0) return data.bundledRelationships;
    if (data?.fromTable && data?.fromColumn && data?.toTable && data?.toColumn) return [data as unknown as Relationship];
    return [];
  };

  const hasUserCreatedRelationships = () => {
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      return workingSchema.tables[data.junctionTable]?.isUserCreated === true;
    }
    const junctionTableName = data?.bundledRelationships?.[0]?.fromTable;
    if (junctionTableName && workingSchema?.tables[junctionTableName]) {
      const jt = workingSchema.tables[junctionTableName];
      if (jt.isUserCreated && Object.values(jt.columns).filter((c) => c.fk).length === 2) return true;
    }
    return getAllRelationships().some((rel) => rel.isUserCreated);
  };

  const handleEdgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data) return;
    if (data.isVirtualNM) {
      setHighlightedNMRelationshipWithTimer({ table1: data.fromTable!, table2: data.toTable!, junctionTable: data.junctionTable! });
      return;
    }
    const rel = data.bundledRelationships?.[0] || data;
    if (rel.fromColumn && rel.toColumn && rel.fromTable && rel.toTable) {
      setHighlightedRelationshipWithTimer({
        fromTable: rel.toTable, fromColumn: rel.toColumn,
        toTable: rel.fromTable, toColumn: rel.fromColumn,
        type: ((rel as EdgeData & { relationType?: string }).relationType || 'ONE_TO_MANY') as import('../../types').RelationshipType,
        relationType: (rel as EdgeData & { relationType?: string }).relationType || 'ONE_TO_MANY',
      } as Parameters<typeof setHighlightedRelationshipWithTimer>[0]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu({ isOpen: false, x: 0, y: 0 });

  const handleViewDetails = () => {
    closeContextMenu();
    openRelationshipDetailsModal(getAllRelationships() as Relationship[]);
  };

  const handleDeleteClick = () => {
    closeContextMenu();
    if (data?.isVirtualNM && data?.junctionTable && workingSchema) {
      const jt = workingSchema.tables[data.junctionTable];
      if (jt?.isUserCreated) {
        const rels = workingSchema.relationships
          .filter((rel) => rel.fromTable === data.junctionTable)
          .map((rel) => ({ ...rel, isJunctionRelationship: true, junctionTable: data.junctionTable }));
        openRelationshipDeleteModal(rels as Relationship[]);
      }
      return;
    }
    const junctionTableName = data?.bundledRelationships?.[0]?.fromTable;
    if (junctionTableName && workingSchema?.tables[junctionTableName]) {
      const jt = workingSchema.tables[junctionTableName];
      if (jt.isUserCreated && Object.values(jt.columns).filter((c) => c.fk).length === 2) {
        const rels = workingSchema.relationships
          .filter((rel) => rel.fromTable === junctionTableName)
          .map((rel) => ({ ...rel, isJunctionRelationship: true, junctionTable: junctionTableName }));
        openRelationshipDeleteModal(rels as Relationship[]);
        return;
      }
    }
    const rels = getAllRelationships().filter((rel) => rel.isUserCreated);
    if (rels.length > 0) openRelationshipDeleteModal(rels as Relationship[]);
  };

  const strokeColor =
    isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' :
    isUserCreated ? '#125da8aa' :
    isCircularDependencyLine ? '#ef4444' :
    isHoverHighlighted ? (hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa') :
    lineColor;

  const strokeWidth = isNMJunctionLine || isNMVirtualLineHighlighted ? 2.5 :
    (isUserCreated || isCircularDependencyLine ? 2.5 : (isHoverHighlighted ? 2.5 : 1));

  const filterStyle =
    isNMJunctionLine || isNMVirtualLineHighlighted || isHoverHighlighted
      ? `drop-shadow(0 0 6px ${isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa'})`
      : isUserCreated ? 'drop-shadow(0 0 4px #125da8aa)'
      : isCircularDependencyLine ? 'drop-shadow(0 0 4px #ef4444)'
      : 'none';

  return (
    <g key={`relationship-${id}`}>
      <path
        d={pathToUse}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        style={{ cursor: 'pointer', pointerEvents: 'all', filter: filterStyle, transition: 'all 0.2s ease' }}
        onClick={handleEdgeClick}
        onContextMenu={handleContextMenu}
        data-relationship-id={id}
        data-user-created={isUserCreated ? 'true' : 'false'}
        data-nm-highlighted={(isNMJunctionLine || isNMVirtualLineHighlighted) ? 'true' : 'false'}
      />
      <path
        d={pathToUse}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        style={{ cursor: 'pointer', pointerEvents: 'all' }}
        onClick={handleEdgeClick}
        onContextMenu={handleContextMenu}
        data-relationship-id={id}
      />
      {label && (
        <g onClick={handleEdgeClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
          <rect x={labelXToUse - 20} y={labelYToUse - 18} width="40" height="16" fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth="0.5" rx="3" opacity="0.95" />
          <text x={labelXToUse} y={labelYToUse} textAnchor="middle" fill={lineColor} fontSize="12" fontWeight="500" style={{ userSelect: 'none', pointerEvents: 'none' }} data-relationship-id={id}>
            {label}
          </text>
        </g>
      )}
      {contextMenu.isOpen && createPortal(
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={closeContextMenu} />
          <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', padding: '4px 0' }}>
            <div style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem' }}
              onClick={handleViewDetails}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              View Details {data?.isBundled && `(${data.bundleCount})`}
            </div>
            {hasUserCreatedRelationships() && (
              <div style={{ padding: '8px 12px', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem' }}
                onClick={handleDeleteClick}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
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

RelationshipEdge.displayName = "RelationshipEdge";
