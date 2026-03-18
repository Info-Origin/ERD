import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSmoothStepPath } from '@xyflow/react';
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import type { Relationship } from "../../types";
import './RelationshipEdge.css';

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
  isIdentifying?: boolean;
  relationType?: string;
}

interface DirectRelationshipEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  data?: EdgeData;
  selected?: boolean;
  markerEnd?: string;
  markerStart?: string;
  label?: React.ReactNode;
  source?: string;
  target?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export const DirectRelationshipEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
  markerEnd, markerStart, label, source, target,
  sourceHandle, targetHandle,
}: DirectRelationshipEdgeProps) => {
  const {
    setHighlightedRelationship, highlightedRelationship,
    setHighlightedRelationshipWithTimer, setHighlightedNMRelationshipWithTimer,
    highlightedNMRelationship, hoverHighlightedRelationships,
    deleteRelationships, showNotification,
    openRelationshipDetailsModal, openRelationshipDeleteModal,
    tablesInCircularDependency, relationshipsInCircularDependency,
  } = useApp();
  const { workingSchema } = useVirtualSchema();

  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

  const selfJoin = data?.fromTable === data?.toTable;
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

  const lineColor = 'var(--erd-line-color)';

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

  const isIdentifying = data?.isIdentifying === true;
  const strokeDasharray = isIdentifying ? "none" : "6,3";

  let edgePath: string;
  if (selfJoin) {
    const loopSize = 30;
    const offset = 15;
    const tableRightEdge = Math.max(sourceX, targetX);
    const loopX = tableRightEdge + offset;
    edgePath = `M ${sourceX} ${sourceY} L ${loopX} ${sourceY} A ${loopSize / 2} ${loopSize / 2} 0 0 1 ${loopX} ${targetY} L ${targetX} ${targetY}`;
  } else {
    [edgePath] = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition: sourcePosition as Parameters<typeof getSmoothStepPath>[0]['sourcePosition'],
      targetPosition: targetPosition as Parameters<typeof getSmoothStepPath>[0]['targetPosition'],
      borderRadius: 0,
    });
  }

  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

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
        type: ((rel as EdgeData).relationType || 'ONE_TO_MANY') as import('../../types').RelationshipType,
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
    (isUserCreated || isCircularDependencyLine ? 2.5 : (isHoverHighlighted ? 2.5 : 1.5));

  const filterStyle =
    isNMJunctionLine || isNMVirtualLineHighlighted || isHoverHighlighted
      ? `drop-shadow(0 0 6px ${isNMJunctionLine || isNMVirtualLineHighlighted ? '#9333ea' : hoverHighlight?.highlightType === 'primary' ? '#34d399' : '#60a5fa'})`
      : isUserCreated ? 'drop-shadow(0 0 4px #125da8aa)'
      : isCircularDependencyLine ? 'drop-shadow(0 0 4px #ef4444)'
      : 'none';

  return (
    <g key={`direct-relationship-${id}`} style={{ zIndex: selfJoin ? 1000 : 'auto' as React.CSSProperties['zIndex'] }} className={selfJoin ? 'self-join-group' : ''}>
      {!selfJoin && (
        <>
          <path
            id={id}
            className={`react-flow__edge-path direct-edge-path ${selected ? 'selected' : ''}`}
            d={edgePath}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill="none"
            markerEnd={markerEnd}
            markerStart={markerStart}
            style={{ cursor: 'pointer', pointerEvents: 'all', filter: filterStyle, transition: 'all 0.2s ease' }}
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            data-relationship-id={id}
            data-user-created={isUserCreated ? 'true' : 'false'}
            data-nm-highlighted={(isNMJunctionLine || isNMVirtualLineHighlighted) ? 'true' : 'false'}
          />
          <path d={edgePath} stroke="transparent" strokeWidth="20" fill="none"
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            onClick={handleEdgeClick} onContextMenu={handleContextMenu} data-relationship-id={id} />
          {label && (
            <g onClick={handleEdgeClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
              <rect x={labelX - 20} y={labelY - 18} width="40" height="16" fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth="0.5" rx="3" opacity="0.95" />
              <text x={labelX} y={labelY} textAnchor="middle" fill={lineColor} fontSize="12" fontWeight="500" style={{ userSelect: 'none', pointerEvents: 'none' }} data-relationship-id={id}>
                {label}
              </text>
            </g>
          )}
        </>
      )}
      {selfJoin && (
        <g>
          <path
            d={`M ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2} Q ${Math.max(sourceX, targetX) + 40} ${(sourceY + targetY) / 2 - 20} ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2 - 40} Q ${Math.max(sourceX, targetX) + 40} ${(sourceY + targetY) / 2 - 60} ${Math.max(sourceX, targetX) + 10} ${(sourceY + targetY) / 2 - 40}`}
            fill="none" stroke={lineColor} strokeWidth="1.5" strokeDasharray="5,5"
            markerEnd="url(#arrowhead)"
            onClick={handleEdgeClick} onContextMenu={handleContextMenu}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
          />
          <text x={Math.max(sourceX, targetX) + 50} y={(sourceY + targetY) / 2 - 30} fill={lineColor} fontSize="10" fontFamily="monospace">self-join</text>
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

DirectRelationshipEdge.displayName = 'DirectRelationshipEdge';
