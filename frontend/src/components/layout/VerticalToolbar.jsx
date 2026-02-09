import { useState } from "react";
import { FiCornerUpLeft, FiCornerUpRight, FiZoomIn, FiZoomOut, FiMaximize2, FiGitBranch, FiRefreshCw, FiChevronLeft, FiChevronRight, FiGrid } from "react-icons/fi";
import { IconButton } from "../common/IconButton";
import { ConfirmationModal } from "../modals/ConfirmationModal";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
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
    gridBackground,
    toggleGridBackground,
    setIsAnyModalOpen,
    showNotification
  } = useApp();
  
  const { layoutMode, setLayoutMode } = useVirtualSchema();
  
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

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'grid' ? 'hybrid' : 'grid';
    setLayoutMode(newMode);
    showNotification?.(
      `Layout: ${newMode === 'hybrid' ? 'Hierarchical + Grid' : 'Grid Only'}`,
      "info"
    );
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
          <button
            className="toolbar-icon-button"
            title="Center ERD (Fit All Tables to View)"
            onClick={onFitView}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
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
          <IconButton
            icon={FiGrid}
            title={gridBackground ? "Hide Grid Background" : "Show Grid Background"}
            onClick={toggleGridBackground}
            size="md"
            style={{
              background: gridBackground ? '#3b82f6' : 'var(--bg-secondary)',
              color: gridBackground ? 'white' : 'var(--text-primary)',
              border: gridBackground ? '1px solid #2563eb' : '1px solid var(--border-color)'
            }}
          />
          {/* Layout Mode Toggle */}
          <button
            className="toolbar-icon-button"
            title={layoutMode === 'grid' ? 'Switch to Hybrid Layout (Hierarchical + Grid)' : 'Switch to Grid Layout'}
            onClick={toggleLayoutMode}
            style={{
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px'
            }}
          >
            <img 
              src="/erd.png" 
              alt="Layout Mode" 
              style={{ 
                width: '20px', 
                height: '20px'
              }}
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
