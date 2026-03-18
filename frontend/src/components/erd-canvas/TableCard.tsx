import { memo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Handle, Position } from "@xyflow/react";
import { FiTable, FiKey, FiLink, FiSettings } from "react-icons/fi";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { formatDataTypeForDisplay, getFullDataType } from "../../utils/dataTypeFormatter";
import { useApp } from "../../context/AppContext";
import { calculatePortPosition } from "../../utils/smartPortDistribution";
import { clsx } from "clsx";
import type { ColumnData, Relationship } from "../../types";
import "./TableCard.css";

interface TableCardData {
  tableName: string;
  columns: Record<string, ColumnData>;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isParent?: boolean;
  highlightedColumn?: string;
  isJunctionTable?: boolean;
}

interface TableCardProps {
  data: TableCardData;
}

export const TableCard = memo(({ data }: TableCardProps) => {
  const {
    selectTable, togglePrimaryKey, toggleUnique, toggleNullable,
    highlightedRelationship, highlightedNMRelationship,
    setHighlightedNMRelationshipWithTimer, erdData,
    openEditTableModal, openRelationshipDetailsModal,
    hoveredTable, hoverHighlightedRelationships,
    handleTableHover, handleTableHoverEnd,
    tablesInCircularDependency, showNotification,
    isSchemaLockedByOther, schemaLocks,
  } = useApp();

  const { tableName, columns, isSelected, isHighlighted, isParent, highlightedColumn, isJunctionTable } = data;

  const isInCircularDependency = tablesInCircularDependency?.includes(tableName);
  const isLockedByOther = isSchemaLockedByOther?.(erdData?.schemaName ?? '');

  const [selfJoinHover, setSelfJoinHover] = useState(false);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: { x: 0, y: 0 } });

  const hasSelfJoin = () => erdData?.relationships?.some((rel) => rel.fromTable === tableName && rel.toTable === tableName) ?? false;
  const getSelfJoinRelationships = (): Relationship[] => erdData?.relationships?.filter((rel) => rel.fromTable === tableName && rel.toTable === tableName) ?? [];
  const isColumnInSelfJoin = (columnName: string) => {
    if (!selfJoinHover) return false;
    return getSelfJoinRelationships().some((rel) => rel.fromColumn === columnName || rel.toColumn === columnName);
  };

  const getOrderedColumns = () => {
    return Object.entries(columns || {}).sort(([nameA, colA], [nameB, colB]) => {
      if (colA.pk && !colB.pk) return -1;
      if (!colA.pk && colB.pk) return 1;
      if (colA.fk && !colB.fk) return -1;
      if (!colA.fk && colB.fk) return 1;
      if (colA.unique && !colB.unique) return -1;
      if (!colA.unique && colB.unique) return 1;
      return nameA.localeCompare(nameB);
    });
  };

  const orderedColumns = getOrderedColumns();

  const createSmartHandles = () => {
    const handles: React.ReactNode[] = [];
    const allRelationships = erdData?.relationships || [];
    const tableRelationships = allRelationships.filter((rel) => rel.fromTable === tableName || rel.toTable === tableName);
    const relationshipCount = tableRelationships.length;
    let maxPortsPerSide = 5;
    if (relationshipCount > 50) maxPortsPerSide = 15;
    else if (relationshipCount > 20) maxPortsPerSide = 12;
    else if (relationshipCount > 5) maxPortsPerSide = 8;

    (['top', 'bottom', 'left', 'right'] as const).forEach((side) => {
      const position = side === 'top' ? Position.Top : side === 'bottom' ? Position.Bottom : side === 'left' ? Position.Left : Position.Right;
      for (let portIndex = 0; portIndex < maxPortsPerSide; portIndex++) {
        const portPosition = calculatePortPosition(side, portIndex, maxPortsPerSide);
        const handleId = `${tableName}-${side}-${portIndex}`;
        const commonStyle: React.CSSProperties = { ...portPosition, opacity: 0, width: '4px', height: '4px', background: 'transparent', border: 'none', margin: 0, padding: 0, pointerEvents: 'none' };
        handles.push(
          <Handle key={`${handleId}-source`} type="source" position={position} id={`${handleId}-source`} className="table-handle smart-handle" style={commonStyle} isConnectable={false} />,
          <Handle key={`${handleId}-target`} type="target" position={position} id={`${handleId}-target`} className="table-handle smart-handle" style={commonStyle} isConnectable={false} />
        );
      }
    });
    return handles;
  };

  const handleClick = () => {
    if (erdData?.relationships && erdData?.tables) {
      const outgoingFKs = erdData.relationships.filter((rel) => rel.fromTable === tableName);
      if (outgoingFKs.length === 2) {
        const table1 = outgoingFKs[0].toTable;
        const table2 = outgoingFKs[1].toTable;
        if (table1 !== table2 && table1 !== tableName && table2 !== tableName) {
          const tableData = erdData.tables[tableName];
          const fkColumns = outgoingFKs.map((fk) => fk.fromColumn);
          const areBothPKs = fkColumns.every((col) => tableData?.columns?.[col]?.pk);
          if (data.isJunctionTable || areBothPKs) {
            setHighlightedNMRelationshipWithTimer({ table1, table2, junctionTable: tableName });
            return;
          }
        }
      }
    }
    selectTable(tableName);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let x = e.clientX, y = e.clientY;
    if (x + 180 > viewportWidth) x = viewportWidth - 190;
    if (y + 60 > viewportHeight) y = viewportHeight - 70;
    setContextMenu({ isOpen: true, position: { x, y } });
  };

  const handleCloseContextMenu = () => setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });

  const handleEditTable = () => {
    openEditTableModal(tableName, erdData?.schemaName || 'Unknown Schema');
    handleCloseContextMenu();
  };

  const handleTogglePK = (columnName: string, e: React.MouseEvent) => { e.stopPropagation(); togglePrimaryKey(tableName, columnName); };
  const handleToggleUnique = (columnName: string, e: React.MouseEvent) => { e.stopPropagation(); toggleUnique(tableName, columnName); };
  const handleToggleNullable = (columnName: string, e: React.MouseEvent) => { e.stopPropagation(); toggleNullable(tableName, columnName); };

  const isTableHighlighted = highlightedRelationship &&
    (highlightedRelationship.fromTable === tableName || highlightedRelationship.toTable === tableName);

  const isTableNMHighlighted = highlightedNMRelationship &&
    (highlightedNMRelationship.table1 === tableName || highlightedNMRelationship.table2 === tableName || highlightedNMRelationship.junctionTable === tableName);

  return (
    <>
      <div
        className={clsx("table-card", {
          "table-card-selected": isSelected,
          "table-card-hover": !isSelected,
          "table-card-relationship-highlighted": isTableHighlighted && !isTableNMHighlighted,
          "table-card-nm-highlighted": isTableNMHighlighted,
          "table-card-junction": isJunctionTable && !isTableNMHighlighted && !isHighlighted,
          "table-card-search-highlighted": isHighlighted,
          "table-card-parent": isParent && !isHighlighted && !isTableHighlighted && !isTableNMHighlighted && !isJunctionTable,
          "table-card-circular-dependency": isInCircularDependency && !isTableNMHighlighted && !isJunctionTable && !isHighlighted,
        })}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ position: 'relative' }}
      >
        {createSmartHandles()}

        <div className="table-card-header" onContextMenu={handleContextMenu}
          onMouseEnter={() => handleTableHover(tableName)} onMouseLeave={handleTableHoverEnd}>
          <FiTable className="table-card-icon" />
          <span className="table-card-title" title={tableName}>{tableName}</span>
          {hasSelfJoin() && (
            <span
              className="self-join-text"
              title={`Self-referencing relationships: ${getSelfJoinRelationships().map((rel) => `${rel.fromColumn} → ${rel.toColumn}`).join(', ')}`}
              style={{
                fontSize: '10px', color: '#6b7280', marginLeft: '8px', fontWeight: '500',
                cursor: 'pointer', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.2s ease',
                backgroundColor: selfJoinHover ? 'rgba(107, 114, 128, 0.1)' : 'transparent',
                border: selfJoinHover ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid transparent',
                fontStyle: 'italic',
              }}
              onMouseEnter={(e) => { e.stopPropagation(); handleTableHoverEnd(); setSelfJoinHover(true); }}
              onMouseLeave={(e) => { e.stopPropagation(); setSelfJoinHover(false); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                const selfJoinRels = getSelfJoinRelationships();
                if (selfJoinRels.length > 0) openRelationshipDetailsModal(selfJoinRels);
              }}
            >
              Self Joined
            </span>
          )}
        </div>

        <div className="table-card-body" onContextMenu={handleContextMenu}>
          {orderedColumns.length === 0 ? (
            <div className="table-card-empty">No columns</div>
          ) : (
            orderedColumns.map(([columnName, columnData], index) => {
              let rowHighlighted = false;
              let highlightType: string | null = null;
              const isSearchHighlighted = highlightedColumn === columnName;

              if (isSearchHighlighted) {
                rowHighlighted = true; highlightType = 'search';
              } else if (highlightedRelationship && erdData?.relationships) {
                const { fromTable, fromColumn, toTable, toColumn } = highlightedRelationship;
                const matchingRels = erdData.relationships.filter((rel) =>
                  (rel.toTable === fromTable && rel.fromTable === toTable) ||
                  (rel.fromTable === toTable && rel.toTable === fromTable)
                );
                for (const rel of matchingRels) {
                  if (rel.toTable === tableName && rel.toColumn === columnName) { rowHighlighted = true; highlightType = 'click-pk'; break; }
                  if (rel.fromTable === tableName && rel.fromColumn === columnName) { rowHighlighted = true; highlightType = 'click-fk'; break; }
                }
              } else if (hoverHighlightedRelationships.length > 0 && !selfJoinHover) {
                for (const hoverRel of hoverHighlightedRelationships) {
                  if (hoverRel.fromTable === tableName && hoverRel.fromColumn === columnName) { rowHighlighted = true; highlightType = 'hover-primary'; break; }
                  if (hoverRel.toTable === tableName && hoverRel.toColumn === columnName) { rowHighlighted = true; highlightType = 'hover-foreign'; break; }
                }
              }

              return (
                <div
                  key={columnName}
                  className={clsx("table-card-row", {
                    "table-card-row-highlighted": rowHighlighted,
                    "table-card-row-click-pk-highlighted": rowHighlighted && highlightType === 'click-pk',
                    "table-card-row-click-fk-highlighted": rowHighlighted && highlightType === 'click-fk',
                    "table-card-row-pk-highlighted": rowHighlighted && highlightType === 'hover-primary',
                    "table-card-row-fk-highlighted": rowHighlighted && highlightType === 'hover-foreign',
                    "table-card-row-search-highlighted": rowHighlighted && highlightType === 'search',
                    "table-card-row-self-join-highlighted": isColumnInSelfJoin(columnName),
                  })}
                  onClick={(e) => e.stopPropagation()}
                  style={{ order: index, position: 'relative' }}
                >
                  <div className="table-card-row-left">
                    {columnData.pk && <FiKey className="column-icon pk-icon" title="Primary Key" />}
                    {columnData.fk && !columnData.pk && <FiLink className="column-icon fk-icon" title="Foreign Key" />}
                    {columnData.unique && !columnData.pk && !columnData.fk && <span className="column-icon unique-icon" title="Unique">⚠️</span>}
                    <span className={clsx("column-name", { 'column-pk': columnData.pk, 'column-fk': columnData.fk, 'column-unique': columnData.unique })} title={`${columnName} - Right-click for constraints`}>
                      {columnName}
                    </span>
                    <span className="column-type-display" title={getFullDataType(columnData.type)}>{formatDataTypeForDisplay(columnData.type)}</span>
                  </div>
                  <div className="table-card-row-right">
                    <div className="column-constraints">
                      {columnData.compositeKey ? (
                        <Badge variant={BADGE_VARIANTS.COMPOSITE_KEY} className="constraint-badge-readonly" title={columnData.fk ? "Composite Key (also Foreign Key)" : "Composite Key"}>CK</Badge>
                      ) : columnData.fk ? (
                        <Badge variant={BADGE_VARIANTS.FK} className="constraint-badge-readonly" title={columnData.isPkAndFk ? "Primary Key serving as Foreign Key" : "Foreign Key"}>FK</Badge>
                      ) : columnData.pk ? (
                        <Badge variant={BADGE_VARIANTS.PK} className="constraint-badge constraint-badge-clickable" onClick={(e) => handleTogglePK(columnName, e)} title="Primary Key - Click to remove">PK</Badge>
                      ) : null}
                      {columnData.unique && <Badge variant={BADGE_VARIANTS.UNIQUE} className="constraint-badge constraint-badge-clickable" onClick={(e) => handleToggleUnique(columnName, e)} title="Unique - Click to remove">UQ</Badge>}
                      {columnData.nullable === false && !columnData.pk && !columnData.compositeKey && <Badge variant={BADGE_VARIANTS.NOT_NULL} className="constraint-badge constraint-badge-clickable" onClick={(e) => handleToggleNullable(columnName, e)} title="NOT NULL - Click to allow nulls">NN</Badge>}
                      {columnData.autoIncrement && <Badge variant={BADGE_VARIANTS.AUTO_INCREMENT} className="constraint-badge-readonly" title="Auto Increment (read-only)">AI</Badge>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {contextMenu.isOpen && createPortal(
          <>
            <div className="context-menu-overlay" onClick={handleCloseContextMenu} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'transparent' }} />
            <div className="context-menu" style={{ position: 'fixed', left: contextMenu.position.x, top: contextMenu.position.y, zIndex: 10000, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', padding: '4px 0' }}>
              <div
                className={`context-menu-item${isLockedByOther ? ' context-menu-item-disabled' : ''}`}
                onClick={isLockedByOther ? undefined : handleEditTable}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: isLockedByOther ? 'not-allowed' : 'pointer', color: isLockedByOther ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: '0.9rem', transition: 'background-color 0.2s ease', opacity: isLockedByOther ? 0.5 : 1 }}
                onMouseEnter={(e) => { if (!isLockedByOther) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                title={isLockedByOther ? `Schema locked by ${schemaLocks?.[erdData?.schemaName ?? '']?.userDisplayName || 'another user'}` : 'Edit table constraints'}
              >
                <FiSettings style={{ width: '16px', height: '16px', color: isLockedByOther ? 'var(--text-tertiary)' : 'var(--text-secondary)' }} />
                Edit Constraints
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </>
  );
});

TableCard.displayName = "TableCard";
