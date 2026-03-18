import { useRef, useEffect } from "react";
import { FiKey, FiLink, FiCheck, FiX } from "react-icons/fi";
import { useApp } from "../../context/AppContext";
import type { ColumnData } from "../../types";
import "./ConstraintMenu.css";

interface ConstraintMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  tableName: string;
  columnName: string;
  columnData: ColumnData;
}

export const ConstraintMenu = ({
  isOpen,
  onClose,
  position,
  tableName,
  columnName,
  columnData,
}: ConstraintMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { togglePrimaryKey, toggleUnique, toggleNullable } = useApp();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTogglePK = () => { togglePrimaryKey(tableName, columnName); onClose(); };
  const handleToggleUnique = () => { toggleUnique(tableName, columnName); onClose(); };
  const handleToggleNullable = () => { if (!columnData.pk) toggleNullable(tableName, columnName); onClose(); };

  return (
    <div
      ref={menuRef}
      className="constraint-menu"
      style={{ position: "fixed", left: position.x, top: position.y, zIndex: 1000 }}
    >
      <div className="constraint-menu-header">
        <span>Constraints for {columnName}</span>
      </div>
      <div className="constraint-menu-item" onClick={handleTogglePK}>
        <FiKey className="constraint-menu-icon" />
        <span>Primary Key</span>
        {columnData.pk && <FiCheck className="constraint-menu-check" />}
      </div>
      <div className="constraint-menu-item" onClick={handleToggleUnique}>
        <FiLink className="constraint-menu-icon" />
        <span>Unique</span>
        {columnData.unique && <FiCheck className="constraint-menu-check" />}
      </div>
      <div
        className={`constraint-menu-item ${columnData.pk ? 'constraint-menu-item-disabled' : ''}`}
        onClick={handleToggleNullable}
      >
        <FiX className="constraint-menu-icon" />
        <span>NOT NULL</span>
        {!columnData.nullable && <FiCheck className="constraint-menu-check" />}
      </div>
    </div>
  );
};
