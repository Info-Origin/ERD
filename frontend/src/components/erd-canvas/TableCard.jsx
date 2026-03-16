import { memo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Handle, Position } from "@xyflow/react";
import {
  FiTable,
  FiKey,
  FiLink,
  FiSettings,
} from "react-icons/fi";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { formatDataTypeForDisplay, getFullDataType } from "../../utils/dataTypeFormatter";
import { useApp } from "../../context/AppContext";
import { calculatePortPosition } from "../../utils/smartPortDistribution";
import { clsx } from "clsx";
import "./TableCard.css";

export const TableCard = memo(({ data }) => {
  const {
    selectTable,
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,
    highlightedRelationship,
    highlightedNMRelationship,
    setHighlightedNMRelationshipWithTimer,
    erdData,
    openEditTableModal,
    openRelationshipDetailsModal,
    hoveredTable,
    hoverHighlightedRelationships,
    handleTableHover,
    handleTableHoverEnd,
    tablesInCircularDependency,
    showNotification,
    isSchemaLockedByOther,
    schemaLocks,
  } = useApp();

  const { tableName, columns, isSelected, isHighlighted, isParent, highlightedColumn, isJunctionTable } = data;

  // Check if this table is part of a circular dependency
  const isInCircularDependency = tablesInCircularDependency?.includes(tableName);

  const isLockedByOther = isSchemaLockedByOther?.(erdData?.schemaName);

  // State for self-join hover highlighting
  const [selfJoinHover, setSelfJoinHover] = useState(false);

  // Check if this table has self-referencing relationships
  const hasSelfJoin = () => {
    if (!erdData?.relationships) return false;
    return erdData.relationships.some(rel => 
      rel.fromTable === tableName && rel.toTable === tableName
    );
  };

  // Get self-join relationship details
  const getSelfJoinRelationships = () => {
    if (!erdData?.relationships) return [];
    return erdData.relationships.filter(rel => 
      rel.fromTable === tableName && rel.toTable === tableName
    );
  };

  // Check if a column is involved in self-join
  const isColumnInSelfJoin = (columnName) => {
    if (!selfJoinHover) return false;
    const selfJoinRels = getSelfJoinRelationships();
    return selfJoinRels.some(rel => 
      rel.fromColumn === columnName || rel.toColumn === columnName
    );
  };

  // REMOVED: All structure editing state and functions
  // - isEditMode, isEditingTableName, editingTableName
  // - editingColumn, editingColumnName, isAddingColumn, newColumn
  // - deleteTable, renameTable, addColumn, deleteColumn, renameColumn, updateColumn functions

  // MySQL Workbench Professional Column Ordering
  const getOrderedColumns = () => {
    const columnEntries = Object.entries(columns || {});
    
    // Sort columns according to MySQL Workbench standards:
    // 1. Primary Keys first
    // 2. Foreign Keys second  
    // 3. Unique columns third
    // 4. Regular columns last
    return columnEntries.sort(([nameA, colA], [nameB, colB]) => {
      // Primary keys always first
      if (colA.pk && !colB.pk) return -1;
      if (!colA.pk && colB.pk) return 1;
      
      // Among non-PKs, foreign keys come next
      if (colA.fk && !colB.fk) return -1;
      if (!colA.fk && colB.fk) return 1;
      
      // Among non-PK/FK, unique columns come next
      if (colA.unique && !colB.unique) return -1;
      if (!colA.unique && colB.unique) return 1;
      
      // Finally, alphabetical order for same-type columns
      return nameA.localeCompare(nameB);
    });
  };

  const orderedColumns = getOrderedColumns();
  
  // Create smart distributed handles based on relationships
  const createSmartHandles = () => {
    const handles = [];
    
    // DYNAMIC PORT CALCULATION - Calculate based on table's relationship density
    // Get all relationships for this table from erdData (passed via context)
    const allRelationships = erdData?.relationships || [];
    
    // Count relationships involving this table
    const tableRelationships = allRelationships.filter(rel => 
      rel.fromTable === tableName || rel.toTable === tableName
    );
    
    // Dynamic port count based on relationship density (with safe fallback)
    const relationshipCount = tableRelationships.length;
    let maxPortsPerSide;
    
    if (relationshipCount <= 5) maxPortsPerSide = 5;        // Default: 5 ports per side
    else if (relationshipCount <= 20) maxPortsPerSide = 8;  // Medium: 8 ports per side  
    else if (relationshipCount <= 50) maxPortsPerSide = 12; // High: 12 ports per side
    else maxPortsPerSide = 15;                              // Maximum: 15 ports per side
    
    // Create distributed ports for each side
    ['top', 'bottom', 'left', 'right'].forEach(side => {
      const position = side === 'top' ? Position.Top :
                     side === 'bottom' ? Position.Bottom :
                     side === 'left' ? Position.Left : Position.Right;
      
      // Create dynamic number of ports per side
      for (let portIndex = 0; portIndex < maxPortsPerSide; portIndex++) {
        const portPosition = calculatePortPosition(side, portIndex, maxPortsPerSide);
        const handleId = `${tableName}-${side}-${portIndex}`;
        
        // Source handle
        handles.push(
          <Handle
            key={`${handleId}-source`}
            type="source"
            position={position}
            id={`${handleId}-source`}
            className="table-handle smart-handle"
            style={{
              ...portPosition,
              opacity: 0, // Completely invisible
              width: '4px',
              height: '4px',
              background: 'transparent',
              border: 'none',
              margin: 0,
              padding: 0,
              pointerEvents: 'none'
            }}
            isConnectable={false}
          />
        );
        
        // Target handle
        handles.push(
          <Handle
            key={`${handleId}-target`}
            type="target"
            position={position}
            id={`${handleId}-target`}
            className="table-handle smart-handle"
            style={{
              ...portPosition,
              opacity: 0, // Completely invisible
              width: '4px',
              height: '4px',
              background: 'transparent',
              border: 'none',
              margin: 0,
              padding: 0,
              pointerEvents: 'none'
            }}
            isConnectable={false}
          />
        );
      }
    });
    
    return handles;
  };
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 }
  });

  const handleClick = () => {
    // Check if this table is a junction table for N:M relationship
    if (erdData?.relationships && erdData?.tables) {
      const outgoingFKs = erdData.relationships.filter(rel => rel.fromTable === tableName);
      
      // Junction table criteria:
      // 1. Exactly 2 outgoing FKs
      // 2. Both FKs point to DIFFERENT tables (not self-referencing)
      // 3. Ideally marked as isJunctionTable OR both FKs are PKs
      if (outgoingFKs.length === 2) {
        const table1 = outgoingFKs[0].toTable;
        const table2 = outgoingFKs[1].toTable;
        
        // CRITICAL: Exclude self-joins - both FKs must point to different tables
        if (table1 !== table2 && table1 !== tableName && table2 !== tableName) {
          // Additional check: verify this is actually a junction table
          const tableData = erdData.tables[tableName];
          const fkColumns = outgoingFKs.map(fk => fk.fromColumn);
          const areBothPKs = fkColumns.every(col => tableData?.columns?.[col]?.pk);
          
          // Trigger N:M highlight only if:
          // - Table is explicitly marked as junction table, OR
          // - Both FK columns are part of the primary key
          if (data.isJunctionTable || areBothPKs) {
            setHighlightedNMRelationshipWithTimer({
              table1,
              table2,
              junctionTable: tableName
            });
            return; // Don't do normal table selection
          }
        }
      }
    }
    
    // Normal table selection
    selectTable(tableName);
  };

  // Handle right-click context menu with smart positioning
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Menu dimensions (approximate)
    const menuWidth = 180;
    const menuHeight = 60; // Approximate height for one item
    
    // Calculate position
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu would go outside viewport horizontally
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    
    // Adjust if menu would go outside viewport vertically
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }
    
    setContextMenu({
      isOpen: true,
      position: { x, y }
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 }
    });
  };

  const handleEditTable = () => {
    openEditTableModal(tableName, erdData?.schemaName || 'Unknown Schema');
    handleCloseContextMenu();
  };

  // REMOVED: All structure editing handlers
  // - toggleEditMode, handleTableNameDoubleClick, handleTableNameSave, handleTableNameCancel, handleTableNameKeyDown
  // - handleColumnNameDoubleClick, handleColumnNameSave, handleColumnNameCancel, handleColumnNameKeyDown
  // - handleColumnTypeChange, handleDeleteTable, handleAddColumn, handleDeleteColumn

  const handleTogglePK = (columnName, e) => {
    e.stopPropagation();
    togglePrimaryKey(tableName, columnName);
  };

  const handleToggleUnique = (columnName, e) => {
    e.stopPropagation();
    toggleUnique(tableName, columnName);
  };

  const handleToggleNullable = (columnName, e) => {
    e.stopPropagation();
    toggleNullable(tableName, columnName);
  };

  const columnEntries = Object.entries(columns || {});

  // Check if this table is part of the highlighted relationship
  const isTableHighlighted = highlightedRelationship && 
    (highlightedRelationship.fromTable === tableName || highlightedRelationship.toTable === tableName);

  // NEW: Check if this table is part of N:M highlighted relationship (3 tables: 2 main + junction)
  const isTableNMHighlighted = highlightedNMRelationship && 
    (highlightedNMRelationship.table1 === tableName || 
     highlightedNMRelationship.table2 === tableName || 
     highlightedNMRelationship.junctionTable === tableName);

  return (
    <>
      <div
        className={clsx("table-card", {
          "table-card-selected": isSelected,
          "table-card-hover": !isSelected,
          "table-card-relationship-highlighted": isTableHighlighted && !isTableNMHighlighted, // Regular highlight only if not N:M
          "table-card-nm-highlighted": isTableNMHighlighted, // NEW: Purple N:M highlight (HIGHEST priority)
          "table-card-junction": isJunctionTable && !isTableNMHighlighted && !isHighlighted, // NEW: Permanent purple for junction tables (but not when N:M highlighted or search highlighted)
          "table-card-search-highlighted": isHighlighted, // Add search highlight class (HIGHEST PRIORITY)
          "table-card-parent": isParent && !isHighlighted && !isTableHighlighted && !isTableNMHighlighted && !isJunctionTable, // Add parent class only if not already highlighted or junction
          "table-card-circular-dependency": isInCircularDependency && !isTableNMHighlighted && !isJunctionTable && !isHighlighted, // Circular dependency highlight (but not when N:M highlighted, junction, or search highlighted)
        })}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ position: 'relative' }} // Ensure proper positioning context
      >
      {/* REMOVED: NodeResizer - no longer needed without edit mode */}

      {/* Smart distributed handles for optimal connection points */}
      {createSmartHandles()}

      <div 
        className="table-card-header" 
        onContextMenu={handleContextMenu}
        onMouseEnter={() => handleTableHover(tableName)}
        onMouseLeave={handleTableHoverEnd}
      >
        <FiTable className="table-card-icon" />
        
        <span className="table-card-title" title={tableName}>
          {tableName}
        </span>
        
        {/* Self-join text indicator */}
        {hasSelfJoin() && (
          <span 
            className="self-join-text" 
            title={`Self-referencing relationships: ${getSelfJoinRelationships().map(rel => `${rel.fromColumn} → ${rel.toColumn}`).join(', ')}`}
            style={{
              fontSize: '10px',
              color: '#6b7280', // Subtle gray color
              marginLeft: '8px',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '3px',
              transition: 'all 0.2s ease',
              backgroundColor: selfJoinHover ? 'rgba(107, 114, 128, 0.1)' : 'transparent',
              border: selfJoinHover ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid transparent',
              fontStyle: 'italic'
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              handleTableHoverEnd(); // Clear any existing table hover
              setSelfJoinHover(true);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setSelfJoinHover(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Open relationship details modal with self-join relationships
              const selfJoinRels = getSelfJoinRelationships();
              if (selfJoinRels.length > 0) {
                openRelationshipDetailsModal(selfJoinRels);
              }
            }}
          >
            Self Joined
          </span>
        )}
        
        {/* REMOVED: Edit mode toggle and structure editing buttons */}
      </div>

      <div className="table-card-body" onContextMenu={handleContextMenu}>
        {orderedColumns.length === 0 ? (
          <div className="table-card-empty">No columns</div>
        ) : (
          <>
            {orderedColumns.map(([columnName, columnData], index) => {
              // Enhanced highlighting logic - distinguish between PK and FK
              let isHighlighted = false;
              let highlightType = null; // 'click-pk', 'click-fk', 'search', 'hover-primary', 'hover-foreign'
              
              // NEW: Check if this column is highlighted from search
              const isSearchHighlighted = highlightedColumn === columnName;
              
              // PRIORITY 1: Search highlighting takes highest priority
              if (isSearchHighlighted) {
                isHighlighted = true;
                highlightType = 'search';
              }
              // PRIORITY 2: Click-based relationship highlighting (only if no search)
              // Check against ALL bundled relationships in the ERD
              else if (highlightedRelationship && erdData?.relationships) {
                const { fromTable, fromColumn, toTable, toColumn } = highlightedRelationship;
                
                // Find all relationships that match the highlighted relationship type
                const matchingRelationships = erdData.relationships.filter(rel => {
                  // Check if this relationship matches the highlighted one
                  return (
                    (rel.toTable === fromTable && rel.fromTable === toTable) ||
                    (rel.fromTable === toTable && rel.toTable === fromTable)
                  );
                });
                
                // Check if this column is involved in any matching relationship
                for (const rel of matchingRelationships) {
                  const isPkMatch = rel.toTable === tableName && rel.toColumn === columnName;
                  const isFkMatch = rel.fromTable === tableName && rel.fromColumn === columnName;
                  
                  if (isPkMatch) {
                    isHighlighted = true;
                    highlightType = 'click-pk'; // Click-based PK highlighting (Blue)
                    break;
                  } else if (isFkMatch) {
                    isHighlighted = true;
                    highlightType = 'click-fk'; // Click-based FK highlighting (Green)
                    break;
                  }
                }
              }
              // PRIORITY 3: Hover-based relationship highlighting (only if no search or click, and NOT hovering on Self Joined text)
              else if (hoverHighlightedRelationships.length > 0 && !selfJoinHover) {
                for (const hoverRel of hoverHighlightedRelationships) {
                  const isPkMatch = hoverRel.fromTable === tableName && hoverRel.fromColumn === columnName;
                  const isFkMatch = hoverRel.toTable === tableName && hoverRel.toColumn === columnName;
                  
                  if (isPkMatch) {
                    isHighlighted = true;
                    highlightType = 'hover-primary'; // Hover-based PK highlighting (Green)
                    break;
                  } else if (isFkMatch) {
                    isHighlighted = true;
                    highlightType = 'hover-foreign'; // Hover-based FK highlighting (Blue)
                    break;
                  }
                }
              }
              
              return (
              <div
                key={columnName}
                className={clsx("table-card-row", {
                  "table-card-row-highlighted": isHighlighted,
                  "table-card-row-click-pk-highlighted": isHighlighted && highlightType === 'click-pk',
                  "table-card-row-click-fk-highlighted": isHighlighted && highlightType === 'click-fk',
                  "table-card-row-pk-highlighted": isHighlighted && highlightType === 'hover-primary',
                  "table-card-row-fk-highlighted": isHighlighted && highlightType === 'hover-foreign',
                  "table-card-row-search-highlighted": isHighlighted && highlightType === 'search',
                  "table-card-row-self-join-highlighted": isColumnInSelfJoin(columnName),
                })}
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  order: index, // Ensure proper ordering
                  position: 'relative'
                }}
              >
                {/* Column Name & Icons - MySQL Workbench Style */}
                <div className="table-card-row-left">
                  {/* Icon priority: PK > FK > UNIQUE */}
                  {columnData.pk && <FiKey className="column-icon pk-icon" title="Primary Key" />}
                  {columnData.fk && !columnData.pk && <FiLink className="column-icon fk-icon" title="Foreign Key" />}
                  {columnData.unique && !columnData.pk && !columnData.fk && (
                    <span className="column-icon unique-icon" title="Unique">⚠️</span>
                  )}
                  
                  <span 
                    className={clsx("column-name", {
                      'column-pk': columnData.pk,
                      'column-fk': columnData.fk,
                      'column-unique': columnData.unique
                    })}
                    title={`${columnName} - Right-click for constraints`}
                  >
                    {columnName}
                  </span>
                  <span className="column-type-display" title={getFullDataType(columnData.type)}>
                    {formatDataTypeForDisplay(columnData.type)}
                  </span>
                </div>

                {/* Data Type & Constraints */}
                <div className="table-card-row-right">
                  {/* Show FK when column is referencing another table, even if it's also a PK */}
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
                        className="constraint-badge constraint-badge-clickable"
                        onClick={(e) => handleTogglePK(columnName, e)}
                        title="Primary Key - Click to remove"
                      >
                        PK
                      </Badge>
                    ) : null}
                    
                    {columnData.unique && (
                      <Badge
                        variant={BADGE_VARIANTS.UNIQUE}
                        className="constraint-badge constraint-badge-clickable"
                        onClick={(e) => handleToggleUnique(columnName, e)}
                        title="Unique - Click to remove"
                      >
                        UQ
                      </Badge>
                    )}
                    
                    {columnData.nullable === false && !columnData.pk && !columnData.compositeKey && (
                      <Badge
                        variant={BADGE_VARIANTS.NOT_NULL}
                        className="constraint-badge constraint-badge-clickable"
                        onClick={(e) => handleToggleNullable(columnName, e)}
                        title="NOT NULL - Click to allow nulls"
                      >
                        NN
                      </Badge>
                    )}
                    
                    {columnData.autoIncrement && (
                      <Badge
                        variant={BADGE_VARIANTS.AUTO_INCREMENT}
                        className="constraint-badge-readonly"
                        title="Auto Increment (read-only)"
                      >
                        AI
                      </Badge>
                    )}
                  </div>

                  {/* REMOVED: Structure editing actions (delete column button) */}
                </div>
              </div>
            )})}

            {/* REMOVED: Add column functionality */}
          </>
        )}
      </div>
      
      {/* Context Menu - Rendered in portal to avoid React Flow z-index issues */}
      {contextMenu.isOpen && createPortal(
        <>
          <div 
            className="context-menu-overlay" 
            onClick={handleCloseContextMenu}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              background: 'transparent'
            }}
          />
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.position.x,
              top: contextMenu.position.y,
              zIndex: 10000,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              minWidth: '180px',
              padding: '4px 0'
            }}
          >
            {/* Edit Constraints */}
            <div 
              className={`context-menu-item${isLockedByOther ? ' context-menu-item-disabled' : ''}`}
              onClick={isLockedByOther ? undefined : handleEditTable}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: isLockedByOther ? 'not-allowed' : 'pointer',
                color: isLockedByOther ? 'var(--text-tertiary)' : 'var(--text-primary)',
                fontSize: '0.9rem',
                transition: 'background-color 0.2s ease',
                opacity: isLockedByOther ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLockedByOther) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title={isLockedByOther ? `Schema locked by ${schemaLocks?.[erdData?.schemaName]?.userDisplayName || 'another user'}` : 'Edit table constraints'}
            >
              <FiSettings 
                className="context-menu-icon" 
                style={{
                  width: '16px',
                  height: '16px',
                  color: isLockedByOther ? 'var(--text-tertiary)' : 'var(--text-secondary)'
                }}
              />
              Edit Constraints
            </div>
          </div>
        </>,
        document.body
      )}
    </div>

    {/* Removed local EditTableModal - using shared modal from AppContext */}
  </>
  );
});

TableCard.displayName = "TableCard";
