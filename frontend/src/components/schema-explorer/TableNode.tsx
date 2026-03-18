import { useState, useRef, useEffect } from "react";
import { FiChevronRight, FiChevronDown, FiTable, FiSettings } from "react-icons/fi";
import { ColumnList } from "./ColumnList";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import type { TableData } from "../../types";
import "./TableNode.css";

interface TableNodeProps {
  tableName: string;
  tableData: TableData;
}

export const TableNode = ({ tableName, tableData }: TableNodeProps) => {
  const { selectedTable, selectTable, erdData, openEditTableModal } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  const isSelected = selectedTable === tableName;

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleClick = () => {
    selectTable(tableName);
    setIsExpanded(!isExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 180;
    const menuHeight = 60;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
    if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;

    setContextMenu({ isOpen: true, position: { x, y } });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      const autoCloseTimer = setTimeout(handleCloseContextMenu, 5000);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        clearTimeout(autoCloseTimer);
      };
    }
  }, [contextMenu.isOpen]);

  const handleEditConstraints = () => {
    openEditTableModal(tableName, erdData?.schemaName || "Unknown Schema");
    handleCloseContextMenu();
  };

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
          <span className="table-name" title={tableName}>
            {tableName}
          </span>
          <span className="table-count">{columnCount}</span>
        </div>

        {isExpanded && (
          <div className="table-content">
            <ColumnList tableName={tableName} columns={tableData.columns} />
          </div>
        )}

        {contextMenu.isOpen && (
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              position: "fixed",
              left: contextMenu.position.x,
              top: contextMenu.position.y,
              zIndex: 10000,
            }}
          >
            <div className="context-menu-item" onClick={handleEditConstraints}>
              <FiSettings className="context-menu-icon" />
              Edit Constraints
            </div>
          </div>
        )}
      </div>
    </>
  );
};
