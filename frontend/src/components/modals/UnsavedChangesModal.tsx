import { Button } from '../common/Button';
import './UnsavedChangesModal.css';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal = ({ isOpen, onSave, onDiscard, onCancel }: UnsavedChangesModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content unsaved-changes-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon">⚠️</div>
          <h2>Unsaved Changes</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p>You have unsaved changes in the current schema.</p>
          <p>Do you want to save them before switching?</p>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onDiscard}>Discard Changes</Button>
          <Button variant="primary" onClick={onSave}>Save & Switch</Button>
        </div>
      </div>
    </div>
  );
};
