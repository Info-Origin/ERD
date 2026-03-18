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
  isUnique?: boolean;
  type?: string;
  cardinalityType?: string;
  relationType?: string;
}

interface CrowsFootEdgeProps {
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

export const CrowsFootEdge = ({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
  markerEnd, markerStart, label, source, target,
  sourceHandle, targetHandle,
}: CrowsFootEdgeProps) => {
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
  const bgColor = 'var(--bg-primary)';

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

  const getRelationshipStyle = () => {
    const isIdentifying = data?.isIdentifying === true;
    const isUnique = data?.isUnique === true;
    const relationType = data?.type || 'ONE_TO_MANY';
    let strokeDasharray = "none";
    if (relationType === 'ONE_TO_ONE_UNIQUE') strokeDasharray = "3,2";
    else if (!isIdentifying) strokeDasharray = "6,3";
    const cardinality = data?.cardinalityType || '1:N';
    return { strokeDasharray, cardinality, isIdentifying, isUnique };
  };

  const relationshipStyle = getRelationshipStyle();

  let edgePath = '';
  if (!selfJoin) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
      const unitX = dx / length;
      const unitY = dy / length;
      const adjSX = sourceX + unitX * 8;
      const adjSY = sourceY + unitY * 8;
      const adjTX = targetX - unitX * 3;
      const adjTY = targetY - unitY * 3;
      [edgePath] = getSmoothStepPath({
        sourceX: adjSX, sourceY: adjSY, targetX: adjTX, targetY: adjTY,
        sourcePosition: sourcePosition as Parameters<typeof getSmoothStepPath>[0]['sourcePosition'],
        targetPosition: targetPosition as Parameters<typeof getSmoothStepPath>[0]['targetPosition'],
        borderRadius: 0,
      });
    }
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
    let rels = getAllRelationships();
    if (rels.length > 0 && (rels[0] as Relationship & { isJunctionRelationship?: boolean }).isJunctionRelationship) {
      const junctionTable = (rels[0] as Relationship & { junctionTable?: string }).junctionTable;
      rels = data?.bundledRelationships?.filter((r) => r.fromTable === junctionTable || r.toTable === junctionTable) || rels;
    }
    closeContextMenu();
    openRelationshipDetailsModal(rels as Relationship[]);
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

  const markerColor = (isNMJunctionLine || isNMVirtualLineHighlighted) ? '#9333ea' :
    isUserCreated ? '#125da8aa' :
    isCircularDependencyLine ? '#ef4444' : lineColor;

  const markerFill = (isNMJunctionLine || isNMVirtualLineHighlighted) ? '#9333ea' :
    isUserCreated ? '#125da8aa' :
    isCircularDependencyLine ? '#ef4444' : bgColor;

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

  const createCrowsFootMarkers = () => {
    const markers: React.ReactNode[] = [];
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return markers;

    const unitX = dx / length;
    const unitY = dy / length;

    let dirX = 0, dirY = 0, spreadX = 0, spreadY = 0;
    switch (targetPosition) {
      case 'left': dirX = 1; dirY = 0; spreadX = 0; spreadY = 1; break;
      case 'right': dirX = -1; dirY = 0; spreadX = 0; spreadY = 1; break;
      case 'top': dirX = 0; dirY = 1; spreadX = 1; spreadY = 0; break;
      default: dirX = 0; dirY = -1; spreadX = 1; spreadY = 0; break;
    }

    let sourceDirX = 0, sourceDirY = 0, sourceSpreadX = 0, sourceSpreadY = 0;
    switch (sourcePosition) {
      case 'left': sourceDirX = 1; sourceDirY = 0; sourceSpreadX = 0; sourceSpreadY = 1; break;
      case 'right': sourceDirX = -1; sourceDirY = 0; sourceSpreadX = 0; sourceSpreadY = 1; break;
      case 'top': sourceDirX = 0; sourceDirY = 1; sourceSpreadX = 1; sourceSpreadY = 0; break;
      default: sourceDirX = 0; sourceDirY = -1; sourceSpreadX = 1; sourceSpreadY = 0; break;
    }

    const crowsFootLength = 10;
    const crowsFootSpread = 8;
    const circleRadius = 4;
    const sourceMarkerDistance = 8;
    const targetMarkerDistance = 3;

    const relationType = data?.type || 'ONE_TO_MANY';
    const circleX = sourceX + unitX * sourceMarkerDistance;
    const circleY = sourceY + unitY * sourceMarkerDistance;

    if (relationType !== 'MANY_TO_MANY') {
      markers.push(
        <circle key="source-marker" cx={circleX} cy={circleY} r={circleRadius}
          fill={markerFill} stroke={markerColor} strokeWidth="1.5" />
      );
    }

    const targetBaseX = targetX - unitX * targetMarkerDistance;
    const targetBaseY = targetY - unitY * targetMarkerDistance;

    if (relationType === 'ONE_TO_ONE' || relationType === 'ONE_TO_ONE_UNIQUE') {
      markers.push(
        <circle key="target-marker-unique" cx={targetBaseX} cy={targetBaseY} r={circleRadius}
          fill={markerFill} stroke={markerColor} strokeWidth="1.5" />
      );
    } else if (relationType === 'MANY_TO_MANY') {
      const targetCenterEndX = targetBaseX + dirX * crowsFootLength;
      const targetCenterEndY = targetBaseY + dirY * crowsFootLength;
      markers.push(
        <g key="target-crows-foot">
          <line x1={targetBaseX} y1={targetBaseY} x2={targetCenterEndX} y2={targetCenterEndY} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={targetBaseX} y1={targetBaseY} x2={targetCenterEndX + spreadX * crowsFootSpread} y2={targetCenterEndY - spreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={targetBaseX} y1={targetBaseY} x2={targetCenterEndX - spreadX * crowsFootSpread} y2={targetCenterEndY + spreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
      const sourceCrowsFootBaseX = sourceX + unitX * sourceMarkerDistance;
      const sourceCrowsFootBaseY = sourceY + unitY * sourceMarkerDistance;
      const sourceCenterEndX = sourceCrowsFootBaseX + sourceDirX * crowsFootLength;
      const sourceCenterEndY = sourceCrowsFootBaseY + sourceDirY * crowsFootLength;
      markers.push(
        <g key="source-crows-foot">
          <line x1={sourceCrowsFootBaseX} y1={sourceCrowsFootBaseY} x2={sourceCenterEndX} y2={sourceCenterEndY} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={sourceCrowsFootBaseX} y1={sourceCrowsFootBaseY} x2={sourceCenterEndX + sourceSpreadX * crowsFootSpread} y2={sourceCenterEndY - sourceSpreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={sourceCrowsFootBaseX} y1={sourceCrowsFootBaseY} x2={sourceCenterEndX - sourceSpreadX * crowsFootSpread} y2={sourceCenterEndY + sourceSpreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    } else {
      const centerEndX = targetBaseX + dirX * crowsFootLength;
      const centerEndY = targetBaseY + dirY * crowsFootLength;
      markers.push(
        <g key="target-crows-foot">
          <line x1={targetBaseX} y1={targetBaseY} x2={centerEndX} y2={centerEndY} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={targetBaseX} y1={targetBaseY} x2={centerEndX + spreadX * crowsFootSpread} y2={centerEndY - spreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={targetBaseX} y1={targetBaseY} x2={centerEndX - spreadX * crowsFootSpread} y2={centerEndY + spreadY * crowsFootSpread} stroke={markerColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    }

    return markers;
  };

  return (
    <g key={`crows-foot-relationship-${id}`}>
      {!selfJoin && (
        <>
          <path
            id={id}
            className="react-flow__edge-path crows-foot-edge-path"
            d={edgePath}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={relationshipStyle.strokeDasharray}
            fill="none"
            style={{ cursor: 'pointer', pointerEvents: 'all', filter: filterStyle, transition: 'all 0.2s ease' }}
            onClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            data-relationship-id={id}
            data-user-created={isUserCreated ? 'true' : 'false'}
            data-nm-highlighted={(isNMJunctionLine || isNMVirtualLineHighlighted) ? 'true' : 'false'}
          />
          {createCrowsFootMarkers()}
          <path d={edgePath} stroke="transparent" strokeWidth="20" fill="none"
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            onClick={handleEdgeClick} onContextMenu={handleContextMenu} data-relationship-id={id} />
          <g onClick={handleEdgeClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
            <rect x={labelX - 18} y={labelY - 20} width="36" height="16" fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth="0.5" rx="3" opacity="0.95" />
            <text x={labelX} y={labelY - 10} textAnchor="middle" fill={lineColor} fontSize="10" fontWeight="500" fontFamily="monospace" style={{ userSelect: 'none', pointerEvents: 'none' }} data-relationship-id={id}>
              {data?.cardinalityType || relationshipStyle.cardinality}
              {data?.type === 'ONE_TO_ONE_UNIQUE' && ' (U)'}
            </text>
          </g>
        </>
      )}
      {selfJoin && (
        <circle
          cx={Math.max(sourceX, targetX) + 25}
          cy={(sourceY + targetY) / 2}
          r="8"
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeDasharray="3,3"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={handleEdgeClick}
          onContextMenu={handleContextMenu}
          data-relationship-id={id}
        />
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

CrowsFootEdge.displayName = 'CrowsFootEdge';
