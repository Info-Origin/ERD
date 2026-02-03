import { useState } from "react";
import { FiChevronRight, FiChevronDown, FiTable, FiSettings } from "react-icons/fi";
import { ColumnList } from "./ColumnList";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import "./TableNode.css";

export const TableNode = ({ tableName, tableData }) => {
  const { selectedTable, selectTable, erdData, openEditTableModal } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 }
  });
  
  const isSelected = selectedTable === tableName;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClick = () => {
    selectTable(tableName);
  };

  // Handle right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 }
    });
  };

  const handleEditConstraints = () => {
    // Use shared modal from AppContext for constraint editing only
    openEditTableModal(tableName, erdData?.schemaName || 'Unknown Schema');
    handleCloseContextMenu();
  };

  // REMOVED: All structure editing functionality
  // - Table name editing (double-click, input, save/cancel)
  // - Add column functionality  
  // - Delete table functionality

  const columnCount = Object.keys(tableData.columns || {}).length;

  return (
    <>
      <div className="table-node">
        <div
          className={clsx("table-header", { "table-selected": isSelected })}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
        <button
          className="table-toggle"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          aria-label={isExpanded ? "Collapse table" : "Expand table"}
        >
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </button>
        <FiTable className="table-icon" />
        
        {/* Table name - read-only, no editing */}
        <span 
          className="table-name"
          title="Table name (read-only)"
        >
          {tableName}
        </span>
        
        <span className="table-count">{columnCount}</span>
        
        {/* REMOVED: Add/Delete buttons - no structure editing allowed */}
      </div>
      
      {isExpanded && (
        <div className="table-content">
          <ColumnList 
            tableName={tableName}
            columns={tableData.columns} 
          />
          
          {/* REMOVED: Add column functionality - no structure editing allowed */}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.isOpen && (
        <>
          <div 
            className="context-menu-overlay" 
            onClick={handleCloseContextMenu}
          />
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.position.x,
              top: contextMenu.position.y,
              zIndex: 10000
            }}
          >
            <div className="context-menu-item" onClick={handleEditConstraints}>
              <FiSettings className="context-menu-icon" />
              Edit Constraints
            </div>
          </div>
        </>
      )}
    </div>

    {/* Removed local EditTableModal - using shared modal from AppContext */}
  </>
  );
};
