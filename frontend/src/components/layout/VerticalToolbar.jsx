import { useState, useRef, useEffect } from "react";
import { FiCornerUpLeft, FiCornerUpRight, FiZoomIn, FiZoomOut, FiMaximize2, FiGitBranch, FiRefreshCw, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { IconButton } from "../common/IconButton";
import { Button } from "../common/Button";
import { ConfirmationModal } from "../modals/ConfirmationModal";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { compareForeignKeys } from "../../utils/fkComparison";
import "./VerticalToolbar.css";

export const VerticalToolbar = ({ onZoomIn, onZoomOut, onFitView, isCollapsed, onToggleCollapse }) => {
  const { 
    isModified, 
    canUndo, 
    canRedo, 
    undo, 
    redo, 
    resetToOriginal, 
    crowsFootMode, 
    toggleCrowsFootMode,
    selectedSchema,
    showFKComparison,
    showNotification,
    setIsAnyModalOpen
  } = useApp();
  
  const { originalSchema, workingSchema } = useVirtualSchema();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetClick = () => {
    setShowResetConfirm(true);
    setIsAnyModalOpen(true);
  };

  const handleConfirmReset = () => {
    resetToOriginal();
    setShowResetConfirm(false);
    setIsAnyModalOpen(false);
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
    setIsAnyModalOpen(false);
  };

  const handleCompareClick = () => {
    if (!originalSchema || !workingSchema || !selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }

    const comparisonResult = compareForeignKeys(originalSchema, workingSchema);
    
    if (!comparisonResult.hasChanges) {
      showNotification?.("No changes are applied.", "info");
      return;
    }

    showFKComparison?.(comparisonResult);
  };

  return (
    <>
      <div className="vertical-toolbar">
        {/* Collapse/Expand Toggle */}
        <div className="toolbar-section">
          <IconButton
            icon={isCollapsed ? FiChevronRight : FiChevronLeft}
            size="md"
            title={isCollapsed ? "Expand Schema Explorer" : "Collapse Schema Explorer"}
            onClick={onToggleCollapse}
          />
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Undo/Redo/Reset Section */}
        <div className="toolbar-section">
          <IconButton
            icon={FiCornerUpLeft}
            size="sm"
            title={canUndo ? "Undo" : "Nothing to undo"}
            onClick={undo}
            disabled={!canUndo}
          />
          <IconButton
            icon={FiCornerUpRight}
            size="sm"
            title={canRedo ? "Redo" : "Nothing to redo"}
            onClick={redo}
            disabled={!canRedo}
          />
          {isModified && (
            <IconButton
              icon={FiRefreshCw}
              size="md"
              onClick={handleResetClick}
              title="Reset to original schema"
            />
          )}
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Canvas Controls Section */}
        <div className="toolbar-section">
          <IconButton
            icon={FiZoomIn}
            title="Zoom In"
            onClick={onZoomIn}
            size="md"
          />
          <IconButton
            icon={FiZoomOut}
            title="Zoom Out"
            onClick={onZoomOut}
            size="md"
          />
          <IconButton
            icon={FiMaximize2}
            title="Center ERD (Fit All Tables to View)"
            onClick={onFitView}
            size="md"
          />
          <IconButton
            icon={FiGitBranch}
            title={crowsFootMode ? "Switch to Simple Lines" : "Switch to Crow's Foot Notation"}
            onClick={toggleCrowsFootMode}
            size="md"
            style={{
              background: crowsFootMode ? '#10b981' : 'var(--bg-secondary)',
              color: crowsFootMode ? 'white' : 'var(--text-primary)',
              border: crowsFootMode ? '1px solid #059669' : '1px solid var(--border-color)'
            }}
          />
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Compare Button */}
        <div className="toolbar-section">
          <button
            className="toolbar-compare-button"
            title="Compare foreign key changes"
            onClick={handleCompareClick}
            disabled={!selectedSchema}
          >
            <img 
              src="/compare.png" 
              alt="Compare" 
              width="20" 
              height="20"
              style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
            />
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={handleCancelReset}
        onConfirm={handleConfirmReset}
        title="Reset to Original Schema"
        message="Are you sure you want to reset all changes? This will discard all modifications and restore the original schema."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
};
