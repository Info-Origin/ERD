import { useState, useRef, useEffect } from "react";
import { FiChevronRight, FiChevronDown, FiTable, FiSettings } from "react-icons/fi";
import { ColumnList } from "./ColumnList";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import "./TableNode.css";

export const TableNode = ({ tableName, tableData }) => {
  const { selectedTable, selectTable, erdData, openEditTableModal } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const contextMenuRef = useRef(null);
  
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

  // Click outside detection for context menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Auto-close after 5 seconds
      const autoCloseTimer = setTimeout(() => {
        handleCloseContextMenu();
      }, 5000);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        clearTimeout(autoCloseTimer);
      };
    }
  }, [contextMenu.isOpen]);

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
        <div 
          ref={contextMenuRef}
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
      )}
    </div>

    {/* Removed local EditTableModal - using shared modal from AppContext */}
  </>
  );
};
