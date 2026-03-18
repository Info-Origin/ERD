import { FiSave, FiAlertCircle, FiCornerUpLeft, FiCornerUpRight } from 'react-icons/fi';
import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { useApp } from '../../context/AppContext';
import './PersistenceIndicator.css';

export const PersistenceIndicator = () => {
  const { isModified, canUndo, canRedo, undo, redo, resetToOriginal, setIsAnyModalOpen } = useApp() as unknown as {
    isModified: boolean; canUndo: boolean; canRedo: boolean;
    undo: () => void; redo: () => void; resetToOriginal: () => void;
    setIsAnyModalOpen: (v: boolean) => void;
  };
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const mergeInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // placeholder for merge info click-outside (feature hidden)
  }, []);

  const handleResetClick = () => { setShowResetConfirm(true); setIsAnyModalOpen(true); };
  const handleConfirmReset = () => { resetToOriginal(); setIsAnyModalOpen(false); };
  const handleCancelReset = () => { setShowResetConfirm(false); setIsAnyModalOpen(false); };

  return (
    <div className={`persistence-indicator ${isModified ? 'persistence-indicator--modified' : 'persistence-indicator--clean'}`}>
      {isModified && (
        <div className="persistence-status">
          <div className="persistence-main-status">
            <FiSave className="persistence-icon" />
            <span className="persistence-text">Changes saved locally</span>
            <FiAlertCircle className="persistence-warning" title="Changes are not saved to database" />
          </div>
          <div ref={mergeInfoRef} />
        </div>
      )}
      <div className="persistence-actions">
        <IconButton icon={FiCornerUpLeft} size="sm" title={canUndo ? 'Undo' : 'Nothing to undo'} onClick={undo} disabled={!canUndo} />
        <IconButton icon={FiCornerUpRight} size="sm" title={canRedo ? 'Redo' : 'Nothing to redo'} onClick={redo} disabled={!canRedo} />
        {isModified && (
          <Button variant="outline" size="sm" onClick={handleResetClick} title="Reset to original schema">Reset</Button>
        )}
      </div>
      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={handleCancelReset}
        onConfirm={handleConfirmReset}
        title="Reset Current Schema"
        message="Are you sure you want to reset the current schema? This will clear all virtual changes and cannot be undone."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};
