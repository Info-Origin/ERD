import { useState } from 'react';
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { compareForeignKeys } from "../../utils/fkComparison";
import { SaveConfirmationModal } from '../modals/SaveConfirmationModal';
import "./CanvasControls.css";

export const CanvasControls = ({ isCollapsed }) => {
  const { 
    selectedSchema, 
    showFKComparison, 
    showNotification, 
    openExportPDFModal, 
    showOutOfSyncModal,
    saveChangesWithDatabaseCheck, // SCENARIO 4: Use new save function with DB check
    checkForDatabaseChanges // For sync button
  } = useApp();
  const { 
    originalSchema, 
    workingSchema, 
    hasUnsavedChanges
  } = useVirtualSchema();

  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleCompareClick = () => {
    if (!originalSchema || !workingSchema || !selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }

    // Compare foreign keys between baseline and virtual schemas
    const comparisonResult = compareForeignKeys(originalSchema, workingSchema);
    
    if (!comparisonResult.hasChanges) {
      // Show "No changes" notification
      showNotification?.("No changes are applied.", "info");
      return;
    }

    // Show FK comparison modal
    showFKComparison?.(comparisonResult);
  };

  const handleExportClick = () => {
    if (!selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }
    openExportPDFModal?.();
  };

  const handleSyncClick = async () => {
    if (!selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }
    
    // Check for database changes and show sync modal
    const hasChanges = await checkForDatabaseChanges?.();
    
    // If no changes detected, show notification
    if (hasChanges === false) {
      showNotification?.("No changes to sync. Database is up to date.", "info");
    }
  };

  const handleSaveClick = () => {
    if (!selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }
    
    if (!hasUnsavedChanges) {
      showNotification?.("No changes to save", "info");
      return;
    }

    // Show save confirmation modal
    setShowSaveModal(true);
  };

  const handleSaveConfirm = async () => {
    // SCENARIO 4: Use new save function that checks for database changes first
    const result = await saveChangesWithDatabaseCheck?.();
    
    if (result?.success) {
      // Success handled by the function itself
      setShowSaveModal(false);
    } else if (result?.reason === 'database_changes_detected') {
      // Database changes modal will be shown, close save modal
      setShowSaveModal(false);
    } else if (result?.reason === 'conflict') {
      // Conflict detected - out of sync modal already shown
      setShowSaveModal(false);
    } else if (result?.reason === 'no_changes') {
      // No changes notification already shown
      setShowSaveModal(false);
    } else {
      // Error notification already shown
      setShowSaveModal(false);
    }
  };

  const handleSaveCancel = () => {
    setShowSaveModal(false);
  };

  return (
    <>
      <div className={`canvas-controls ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Save Changes Button */}
        <button
          className={`canvas-control-button save-button ${hasUnsavedChanges ? 'has-changes' : ''}`}
          title={hasUnsavedChanges ? "Save changes to database" : "No changes to save"}
          onClick={handleSaveClick}
          disabled={!selectedSchema || !hasUnsavedChanges}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ filter: (!selectedSchema || !hasUnsavedChanges) ? 'grayscale(100%) opacity(0.5)' : 'none' }}
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span className="save-button-text">Save Changes</span>
          {hasUnsavedChanges && <span className="unsaved-indicator">●</span>}
        </button>

        {/* Compare Changes Button */}
        <button
          className="canvas-control-button compare-button"
          title="Compare foreign key changes"
          onClick={handleCompareClick}
          disabled={!selectedSchema}
        >
          <img 
            src="/compare.png" 
            alt="Compare" 
            width="16" 
            height="16"
            style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
          />
          <span className="compare-button-text">Compare Changes</span>
        </button>

        {/* Export PDF Button */}
        <button
          className="canvas-control-button export-button"
          title="Export ERD to PDF"
          onClick={handleExportClick}
          disabled={!selectedSchema}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="export-button-text">Export ERD</span>
        </button>

        {/* Sync Button */}
        <button
          className="canvas-control-button sync-button"
          title="Sync with actual database"
          onClick={handleSyncClick}
          disabled={!selectedSchema}
        >
          <img 
            src="/sync.png" 
            alt="Sync" 
            width="16" 
            height="16"
            style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
          />
          <span className="sync-button-text">Pull Changes</span>
        </button>
      </div>

      {/* Save Confirmation Modal */}
      <SaveConfirmationModal
        isOpen={showSaveModal}
        onConfirm={handleSaveConfirm}
        onCancel={handleSaveCancel}
      />
    </>
  );
};
