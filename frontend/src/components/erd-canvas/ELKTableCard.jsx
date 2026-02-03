import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FiTable, FiKey, FiLink } from "react-icons/fi";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { formatDataTypeForDisplay, getFullDataType } from "../../utils/dataTypeFormatter";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import "./TableCard.css";

/**
 * ELK-based Table Card Component (Visual Only)
 * Uses ELK port information for precise handle positioning
 * Relationship creation functionality removed
 */
export const ELKTableCard = memo(({ data, selected }) => {
  const { selectTable, highlightedRelationship } = useApp();
  
  const { tableName, columns, elkPorts } = data;

  // Professional column ordering: PK → FK → Others
  const getOrderedColumns = () => {
    const columnEntries = Object.entries(columns || {});
    return columnEntries.sort(([nameA, colA], [nameB, colB]) => {
      if (colA.pk && !colB.pk) return -1;
      if (!colA.pk && colB.pk) return 1;
      if (colA.fk && !colB.fk) return -1;
      if (!colA.fk && colB.fk) return 1;
      return nameA.localeCompare(nameB);
    });
  };

  const orderedColumns = getOrderedColumns();

  const handleClick = () => {
    // Normal mode only - select table for details
    selectTable(tableName);
  };

  // Check if this table is part of the highlighted relationship
  const isTableHighlighted = highlightedRelationship && 
    (highlightedRelationship.fromTable === tableName || highlightedRelationship.toTable === tableName);

  // Create handles based on ELK port information
  const createHandles = () => {
    // Create handles for all columns with multiple distinct ports per side
    const handles = [];
    
    orderedColumns.forEach(([columnName, columnData], columnIndex) => {
      const baseId = `${tableName}.${columnName}`;
      const headerHeight = 40;
      const rowHeight = 28;
      const handleY = headerHeight + (columnIndex * rowHeight) + (rowHeight / 2);

      // Create handles for all four sides with multiple ports per side
      const sides = [
        { side: 'NORTH', position: Position.Top },
        { side: 'SOUTH', position: Position.Bottom },
        { side: 'EAST', position: Position.Right },
        { side: 'WEST', position: Position.Left }
      ];

      sides.forEach(({ side, position }) => {
        // Create 3 distinct ports per side to prevent overlap
        for (let portIndex = 0; portIndex < 3; portIndex++) {
          let handleStyle = {};
          
          if (side === 'WEST' || side === 'EAST') {
            // Distribute ports vertically along the side
            const offsetY = (portIndex - 1) * 8; // -8px, 0px, +8px offset
            handleStyle = {
              top: `${handleY + offsetY}px`,
              [side === 'WEST' ? 'left' : 'right']: '-6px'
            };
          } else {
            // NORTH or SOUTH - distribute ports horizontally
            const baseX = 20 + (columnIndex % 4) * 20; // Base position
            const offsetX = (portIndex - 1) * 5; // -5%, 0%, +5% offset
            handleStyle = {
              [side === 'NORTH' ? 'top' : 'bottom']: '-6px',
              left: `${baseX + offsetX}%`
            };
          }

          // Create both base handle and specific port handles
          const handleIds = [
            baseId, // Base handle for ELK automatic selection
            `${baseId}.${side}.${portIndex}` // Specific port handle
          ];

          handleIds.forEach(handleId => {
            // Create source handle
            handles.push(
              <Handle
                key={`${handleId}-source`}
                type="source"
                position={position}
                id={`${handleId}-source`}
                style={{
                  ...handleStyle,
                  opacity: 0, // Make invisible
                  width: '8px',
                  height: '8px',
                  background: 'transparent',
                  border: 'none'
                }}
                isConnectable={false}
              />
            );

            // Create target handle
            handles.push(
              <Handle
                key={`${handleId}-target`}
                type="target"
                position={position}
                id={`${handleId}-target`}
                style={{
                  ...handleStyle,
                  opacity: 0, // Make invisible
                  width: '8px',
                  height: '8px',
                  background: 'transparent',
                  border: 'none'
                }}
                isConnectable={false}
              />
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
      style={{
        cursor: 'default'
      }}
    >
      {/* ELK-based handles */}
      {createHandles()}

      {/* Table header */}
      <div className="table-card-header">
        <FiTable className="table-card-icon" />
        <span className="table-card-title">{tableName}</span>
        <span className="table-card-count">{orderedColumns.length}</span>
      </div>

      {/* Table body with columns */}
      <div className="table-card-body">
        {orderedColumns.length === 0 ? (
          <div className="table-card-empty">No columns</div>
        ) : (
          orderedColumns.map(([columnName, columnData], index) => {
            // Enhanced highlighting logic with corrected ERD semantics
            let isHighlighted = false;
            let highlightType = null;
            
            if (highlightedRelationship) {
              const { fromTable, fromColumn, toTable, toColumn } = highlightedRelationship;
              
              // Semantic direction: PK (from) → FK (to)
              const isPkMatch = fromTable === tableName && fromColumn === columnName;
              const isFkMatch = toTable === tableName && toColumn === columnName;
              
              if (isPkMatch) {
                isHighlighted = true;
                highlightType = 'pk';
              } else if (isFkMatch) {
                isHighlighted = true;
                highlightType = 'fk';
              }
            }
            
            return (
              <div
                key={columnName}
                className={clsx("table-card-row", {
                  "table-card-row-highlighted": isHighlighted,
                  "table-card-row-pk-highlighted": isHighlighted && highlightType === 'pk',
                  "table-card-row-fk-highlighted": isHighlighted && highlightType === 'fk',
                })}
                style={{ order: index }}
              >
                <div className="table-card-row-left">
                  {columnData.pk && <FiKey className="column-icon pk-icon" title="Primary Key" />}
                  {columnData.fk && !columnData.pk && <FiLink className="column-icon fk-icon" title="Foreign Key" />}
                  {columnData.unique && !columnData.pk && !columnData.fk && (
                    <span className="column-icon unique-icon" title="Unique">⚠️</span>
                  )}
                  
                  <span className="column-name" title={columnName}>
                    {columnName}
                  </span>
                  <span className="column-type-display" title={getFullDataType(columnData.type)}>
                    {formatDataTypeForDisplay(columnData.type)}
                  </span>
                </div>

                <div className="table-card-row-right">
                  <div className="column-constraints">
                    {/* CK takes highest priority for composite keys */}
                    {columnData.compositeKey ? (
                      <Badge
                        variant={BADGE_VARIANTS.COMPOSITE_KEY}
                        className="constraint-badge-readonly"
                        title={columnData.fk ? "Composite Key (also Foreign Key)" : "Composite Key - Part of multi-column primary key"}
                      >
                        CK
                      </Badge>
                    ) : columnData.fk ? (
                      <Badge
                        variant={BADGE_VARIANTS.FK}
                        className="constraint-badge-readonly"
                        title={columnData.isPkAndFk ? "Primary Key serving as Foreign Key" : "Foreign Key (managed via relationships)"}
                      >
                        FK
                      </Badge>
                    ) : columnData.pk ? (
                      <Badge
                        variant={BADGE_VARIANTS.PK}
                        className="constraint-badge-readonly"
                        title="Primary Key"
                      >
                        PK
                      </Badge>
                    ) : null}
                    
                    {columnData.unique && (
                      <Badge
                        variant={BADGE_VARIANTS.UNIQUE}
                        className="constraint-badge-readonly"
                        title="Unique"
                      >
                        UQ
                      </Badge>
                    )}
                    
                    {columnData.nullable === false && !columnData.pk && !columnData.compositeKey && (
                      <Badge
                        variant={BADGE_VARIANTS.NOT_NULL}
                        className="constraint-badge-readonly"
                        title="NOT NULL"
                      >
                        NN
                      </Badge>
                    )}
                    
                    {columnData.autoIncrement && (
                      <Badge
                        variant={BADGE_VARIANTS.AUTO_INCREMENT}
                        className="constraint-badge-readonly"
                        title="Auto Increment"
                      >
                        AI
                      </Badge>
                    )}
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