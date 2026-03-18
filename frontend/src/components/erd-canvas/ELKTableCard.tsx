import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FiTable, FiKey, FiLink } from "react-icons/fi";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { formatDataTypeForDisplay, getFullDataType } from "../../utils/dataTypeFormatter";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import type { ColumnData } from "../../types";
import "./TableCard.css";

interface ELKTableCardData {
  tableName: string;
  columns: Record<string, ColumnData>;
  elkPorts?: unknown[];
  highlightedColumn?: string;
}

interface ELKTableCardProps {
  data: ELKTableCardData;
  selected?: boolean;
}

export const ELKTableCard = memo(({ data, selected }: ELKTableCardProps) => {
  const { selectTable, highlightedRelationship } = useApp();
  const { tableName, columns, elkPorts, highlightedColumn } = data;

  const getOrderedColumns = () => {
    return Object.entries(columns || {}).sort(([nameA, colA], [nameB, colB]) => {
      if (colA.pk && !colB.pk) return -1;
      if (!colA.pk && colB.pk) return 1;
      if (colA.fk && !colB.fk) return -1;
      if (!colA.fk && colB.fk) return 1;
      return nameA.localeCompare(nameB);
    });
  };

  const orderedColumns = getOrderedColumns();
  const handleClick = () => selectTable(tableName);

  const isTableHighlighted =
    highlightedRelationship &&
    (highlightedRelationship.fromTable === tableName || highlightedRelationship.toTable === tableName);

  const createHandles = () => {
    const handles: React.ReactNode[] = [];
    orderedColumns.forEach(([columnName, columnData], columnIndex) => {
      const baseId = `${tableName}.${columnName}`;
      const headerHeight = 40;
      const rowHeight = 28;
      const handleY = headerHeight + columnIndex * rowHeight + rowHeight / 2;

      const sides = [
        { side: 'NORTH', position: Position.Top },
        { side: 'SOUTH', position: Position.Bottom },
        { side: 'EAST', position: Position.Right },
        { side: 'WEST', position: Position.Left },
      ];

      sides.forEach(({ side, position }) => {
        for (let portIndex = 0; portIndex < 3; portIndex++) {
          let handleStyle: React.CSSProperties = {};
          if (side === 'WEST' || side === 'EAST') {
            const offsetY = (portIndex - 1) * 8;
            handleStyle = { top: `${handleY + offsetY}px`, [side === 'WEST' ? 'left' : 'right']: '-6px' };
          } else {
            const baseX = 20 + (columnIndex % 4) * 20;
            const offsetX = (portIndex - 1) * 5;
            handleStyle = { [side === 'NORTH' ? 'top' : 'bottom']: '-6px', left: `${baseX + offsetX}%` };
          }

          const handleIds = [baseId, `${baseId}.${side}.${portIndex}`];
          handleIds.forEach((handleId) => {
            const commonStyle: React.CSSProperties = { ...handleStyle, opacity: 0, width: '8px', height: '8px', background: 'transparent', border: 'none' };
            handles.push(
              <Handle key={`${handleId}-source`} type="source" position={position} id={`${handleId}-source`} style={commonStyle} isConnectable={false} />,
              <Handle key={`${handleId}-target`} type="target" position={position} id={`${handleId}-target`} style={commonStyle} isConnectable={false} />
            );
          });
        }
      });
    });
    return handles;
  };

  return (
    <div
      className={clsx("table-card", {
        "table-card-selected": selected,
        "table-card-hover": !selected,
        "table-card-relationship-highlighted": isTableHighlighted,
      })}
      onClick={handleClick}
      style={{ cursor: 'default' }}
    >
      {createHandles()}
      <div className="table-card-header">
        <FiTable className="table-card-icon" />
        <span className="table-card-title">{tableName}</span>
        <span className="table-card-count">{orderedColumns.length}</span>
      </div>
      <div className="table-card-body">
        {orderedColumns.length === 0 ? (
          <div className="table-card-empty">No columns</div>
        ) : (
          orderedColumns.map(([columnName, columnData], index) => {
            let isHighlighted = false;
            let highlightType: string | null = null;
            const isSearchHighlighted = highlightedColumn === columnName;

            if (highlightedRelationship) {
              const { fromTable, fromColumn, toTable, toColumn } = highlightedRelationship;
              if (fromTable === tableName && fromColumn === columnName) { isHighlighted = true; highlightType = 'pk'; }
              else if (toTable === tableName && toColumn === columnName) { isHighlighted = true; highlightType = 'fk'; }
            }
            if (isSearchHighlighted && !isHighlighted) { isHighlighted = true; highlightType = 'search'; }

            return (
              <div
                key={columnName}
                className={clsx("table-card-row", {
                  "table-card-row-highlighted": isHighlighted,
                  "table-card-row-pk-highlighted": isHighlighted && highlightType === 'pk',
                  "table-card-row-fk-highlighted": isHighlighted && highlightType === 'fk',
                  "table-card-row-search-highlighted": isHighlighted && highlightType === 'search',
                })}
                style={{ order: index }}
              >
                <div className="table-card-row-left">
                  {columnData.pk && <FiKey className="column-icon pk-icon" title="Primary Key" />}
                  {columnData.fk && !columnData.pk && <FiLink className="column-icon fk-icon" title="Foreign Key" />}
                  {columnData.unique && !columnData.pk && !columnData.fk && <span className="column-icon unique-icon" title="Unique">⚠️</span>}
                  <span className="column-name" title={columnName}>{columnName}</span>
                  <span className="column-type-display" title={getFullDataType(columnData.type)}>{formatDataTypeForDisplay(columnData.type)}</span>
                </div>
                <div className="table-card-row-right">
                  <div className="column-constraints">
                    {columnData.compositeKey ? (
                      <Badge variant={BADGE_VARIANTS.COMPOSITE_KEY} className="constraint-badge-readonly" title={columnData.fk ? "Composite Key (also Foreign Key)" : "Composite Key"}>CK</Badge>
                    ) : columnData.fk ? (
                      <Badge variant={BADGE_VARIANTS.FK} className="constraint-badge-readonly" title={columnData.isPkAndFk ? "Primary Key serving as Foreign Key" : "Foreign Key"}>FK</Badge>
                    ) : columnData.pk ? (
                      <Badge variant={BADGE_VARIANTS.PK} className="constraint-badge-readonly" title="Primary Key">PK</Badge>
                    ) : null}
                    {columnData.unique && <Badge variant={BADGE_VARIANTS.UNIQUE} className="constraint-badge-readonly" title="Unique">UQ</Badge>}
                    {columnData.nullable === false && !columnData.pk && !columnData.compositeKey && <Badge variant={BADGE_VARIANTS.NOT_NULL} className="constraint-badge-readonly" title="NOT NULL">NN</Badge>}
                    {columnData.autoIncrement && <Badge variant={BADGE_VARIANTS.AUTO_INCREMENT} className="constraint-badge-readonly" title="Auto Increment">AI</Badge>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

ELKTableCard.displayName = "ELKTableCard";
