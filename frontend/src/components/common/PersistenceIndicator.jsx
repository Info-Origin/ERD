import { FiSave, FiAlertCircle, FiCornerUpLeft, FiCornerUpRight, FiGitMerge } from "react-icons/fi";
import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ConfirmationModal } from "../modals/ConfirmationModal";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import "./PersistenceIndicator.css";

export const PersistenceIndicator = () => {
  const { isModified, canUndo, canRedo, undo, redo, resetToOriginal, erdData, setIsAnyModalOpen } = useApp();
  const { originalSchema, getMergeSummary } = useVirtualSchema();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMergeInfo, setShowMergeInfo] = useState(false);
  const mergeInfoRef = useRef(null);

  // Get merge summary if both schemas exist
  const mergeSummary = originalSchema && erdData ? getMergeSummary(erdData, originalSchema) : null;

  // Close merge info when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mergeInfoRef.current && !mergeInfoRef.current.contains(event.target)) {
        setShowMergeInfo(false);
      }
    };

    if (showMergeInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMergeInfo]);

  const handleResetClick = () => {
    setShowResetConfirm(true);
    setIsAnyModalOpen(true);
  };

  const handleConfirmReset = () => {
    resetToOriginal();
    setIsAnyModalOpen(false);
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
    setIsAnyModalOpen(false);
  };

  return (
    <div className={`persistence-indicator ${isModified ? 'persistence-indicator--modified' : 'persistence-indicator--clean'}`}>
      {/* Status section - only show when modified */}
      {isModified && (
        <div className="persistence-status">
          <div className="persistence-main-status">
            <FiSave className="persistence-icon" />
            <span className="persistence-text">Changes saved locally</span>
            <FiAlertCircle className="persistence-warning" title="Changes are not saved to database" />
          </div>
          
          {/* Merge info - show when there's merge data */}
          {/* Temporarily hidden - functionality preserved for later */}
          {false && mergeSummary && (mergeSummary.newFromDatabase.length > 0 || mergeSummary.addedByUser.length > 0) && (
            <div className="merge-info" ref={mergeInfoRef}>
              <IconButton
                icon={FiGitMerge}
                size="sm"
                title="Schema merged: DB changes + UI changes"
                onClick={() => setShowMergeInfo(!showMergeInfo)}
                className="merge-toggle"
              />
              {showMergeInfo && (
                <div className="merge-details">
                  <div className="merge-summary">
                    <strong>Schema Merged</strong>
                    {mergeSummary.newFromDatabase.length > 0 && (
                      <div>📥 New from DB: {mergeSummary.newFromDatabase.join(', ')}</div>
                    )}
                    {mergeSummary.addedByUser.length > 0 && (
                      <div>➕ Added by you: {mergeSummary.addedByUser.join(', ')}</div>
                    )}
                    {mergeSummary.modifiedByUser.length > 0 && (
                      <div>✏️ Modified by you: {mergeSummary.modifiedByUser.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Actions section - always visible */}
      <div className="persistence-actions">
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
        {/* Reset button - only show when modified */}
        {isModified && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetClick}
            title="Reset to original schema"
          >
            Reset
          </Button>
        )}
      </div>

      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={handleCancelReset}
        onConfirm={handleConfirmReset}
        title="Reset Current Schema"
        message="Are you sure you want to reset the current schema? This will clear all virtual changes for this schema only (added tables, columns, constraints) and cannot be undone."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};