import { useState } from "react";
import { FiCornerUpLeft, FiCornerUpRight, FiZoomIn, FiZoomOut, FiMaximize2, FiGitBranch, FiRefreshCw, FiChevronLeft, FiChevronRight, FiGrid } from "react-icons/fi";
import { IconButton } from "../common/IconButton";
import { ConfirmationModal } from "../modals/ConfirmationModal";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import "./VerticalToolbar.css";

export const VerticalToolbar = ({ onZoomIn, onZoomOut, onFitView, onResetLayout, isCollapsed, onToggleCollapse }) => {
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
    showNotification,
    selectedSchema,
    schemasHasLoaded,
    hasUnsavedChanges
  } = useApp();
  
  const { clearAllTablePositions, resetUnsavedChanges } = useVirtualSchema();
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetUnsavedConfirm, setShowResetUnsavedConfirm] = useState(false); // NEW: For unsaved changes reset

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

  // NEW: Handle reset unsaved changes
  const handleResetUnsavedClick = () => {
    setShowResetUnsavedConfirm(true);
    setIsAnyModalOpen(true);
  };

  const handleConfirmResetUnsaved = async () => {
    const success = await resetUnsavedChanges();
    if (success) {
      showNotification?.("Unsaved changes discarded", "success");
    } else {
      showNotification?.("Failed to reset changes", "error");
    }
    setShowResetUnsavedConfirm(false);
    setIsAnyModalOpen(false);
  };

  const handleCancelResetUnsaved = () => {
    setShowResetUnsavedConfirm(false);
    setIsAnyModalOpen(false);
  };

  const handleResetLayout = () => {
    if (!selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }
    // Clear all saved table positions to restore initial layout
    clearAllTablePositions();
    
    // Trigger layout recalculation without page reload
    if (onResetLayout) {
      onResetLayout();
    }
    
    showNotification?.("Layout reset to initial positions", "success");
  };

  // Disable all non-collapse buttons until schemas are loaded
  const noSchema = !schemasHasLoaded;

  return (
    <>
      <div className="vertical-toolbar">
        {/* Collapse/Expand Toggle */}
        <div className="toolbar-section">
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={isCollapsed ? FiChevronRight : FiChevronLeft}
              size="md"
              title={isCollapsed ? "Expand Schema Explorer" : "Collapse Schema Explorer"}
              onClick={onToggleCollapse}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Undo/Redo Section */}
        <div className="toolbar-section">
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiCornerUpLeft}
              size="sm"
              title={canUndo ? "Undo" : "Nothing to undo"}
              onClick={undo}
              disabled={noSchema || !canUndo}
            />
            <span className="toolbar-button-label">Undo</span>
          </div>
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiCornerUpRight}
              size="sm"
              title={canRedo ? "Redo" : "Nothing to redo"}
              onClick={redo}
              disabled={noSchema || !canRedo}
            />
            <span className="toolbar-button-label">Redo</span>
          </div>
          <div className="toolbar-button-wrapper">
            <button
              className="toolbar-icon-button"
              onClick={handleResetUnsavedClick}
              title={hasUnsavedChanges ? "Reset unsaved changes" : "No unsaved changes"}
              disabled={noSchema || !hasUnsavedChanges}
              style={{
                opacity: (noSchema || !hasUnsavedChanges) ? 0.5 : 1,
                cursor: (noSchema || !hasUnsavedChanges) ? 'not-allowed' : 'pointer'
              }}
            >
              <img 
                src="/rotate.png" 
                alt="Reset Unsaved"
                className={(noSchema || !hasUnsavedChanges) ? 'toolbar-img-icon disabled' : 'toolbar-img-icon'}
                style={{ width: '20px', height: '20px' }}
              />
            </button>
            <span className="toolbar-button-label">Reset</span>
          </div>
        </div>

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Canvas Controls Section */}
        <div className="toolbar-section">
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiZoomIn}
              title="Zoom In"
              onClick={onZoomIn}
              size="md"
              disabled={noSchema}
            />
            <span className="toolbar-button-label">Zoom In</span>
          </div>
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiZoomOut}
              title="Zoom Out"
              onClick={onZoomOut}
              size="md"
              disabled={noSchema}
            />
            <span className="toolbar-button-label">Zoom Out</span>
          </div>
          <div className="toolbar-button-wrapper">
            <button
              className="toolbar-icon-button"
              title="Center ERD (Fit All Tables to View)"
              onClick={onFitView}
              disabled={noSchema}
              style={{
                opacity: noSchema ? 0.5 : 1,
                cursor: noSchema ? 'not-allowed' : 'pointer'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            <span className="toolbar-button-label">Fit View</span>
          </div>
          <div className="toolbar-button-wrapper">
            <button
              className="toolbar-icon-button"
              title="Reset Layout (Restore Initial Table Positions)"
              onClick={handleResetLayout}
              disabled={noSchema || !selectedSchema}
              style={{
                opacity: (noSchema || !selectedSchema) ? 0.5 : 1,
                cursor: (noSchema || !selectedSchema) ? 'not-allowed' : 'pointer'
              }}
            >
              <img 
                src="/reset-layout.png" 
                alt="Reset Layout"
                className={(noSchema || !selectedSchema) ? 'toolbar-img-icon disabled' : 'toolbar-img-icon'}
                style={{ width: '20px', height: '20px' }}
              />
            </button>
            <span className="toolbar-button-label">Layout</span>
          </div>
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiGitBranch}
              title={crowsFootMode ? "Switch to Simple Lines" : "Switch to Crow's Foot Notation"}
              onClick={toggleCrowsFootMode}
              size="md"
              disabled={noSchema}
              style={{
                background: !noSchema && crowsFootMode ? '#10b981' : 'var(--bg-secondary)',
                color: !noSchema && crowsFootMode ? 'white' : 'var(--text-primary)',
                border: !noSchema && crowsFootMode ? '1px solid #059669' : '1px solid var(--border-color)'
              }}
            />
            <span className="toolbar-button-label">Crow's Foot</span>
          </div>
          <div className="toolbar-button-wrapper">
            <IconButton
              icon={FiGrid}
              title={gridBackground ? "Hide Grid Background" : "Show Grid Background"}
              onClick={toggleGridBackground}
              size="md"
              disabled={noSchema}
              style={{
                background: !noSchema && gridBackground ? '#3b82f6' : 'var(--bg-secondary)',
                color: !noSchema && gridBackground ? 'white' : 'var(--text-primary)',
                border: !noSchema && gridBackground ? '1px solid #2563eb' : '1px solid var(--border-color)'
              }}
            />
            <span className="toolbar-button-label">Grid</span>
          </div>
          <div className="toolbar-button-wrapper">
            <button
              className="toolbar-icon-button"
              onClick={handleResetClick}
              title={isModified ? "Reset to original schema" : "No changes to reset"}
              disabled={noSchema || !isModified}
              style={{
                opacity: (noSchema || !isModified) ? 0.5 : 1,
                cursor: (noSchema || !isModified) ? 'not-allowed' : 'pointer'
              }}
            >
              <img 
                src="/reset.png" 
                alt="Reset"
                className={(noSchema || !isModified) ? 'toolbar-img-icon disabled' : 'toolbar-img-icon'}
                style={{ width: '20px', height: '20px' }}
              />
            </button>
            <span className="toolbar-button-label">Reset</span>
          </div>
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

      <ConfirmationModal
        isOpen={showResetUnsavedConfirm}
        onClose={handleCancelResetUnsaved}
        onConfirm={handleConfirmResetUnsaved}
        title="Reset Unsaved Changes"
        message="Are you sure you want to discard all unsaved changes? This will restore the last saved state."
        confirmText="Yes, Discard"
        cancelText="Cancel"
        variant="warning"
      />
    </>
  );
};
