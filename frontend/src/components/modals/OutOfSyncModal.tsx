import { Button } from '../common/Button';
import './OutOfSyncModal.css';

interface OutOfSyncModalProps {
  isOpen: boolean;
  onRefresh: () => void;
  onCancel: () => void;
}

export const OutOfSyncModal = ({ isOpen, onRefresh, onCancel }: OutOfSyncModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content out-of-sync-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon">⚠️</div>
          <h2>Out of Sync</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p>Another user has saved changes to this schema.</p>
          <p>Your changes are out of sync and cannot be saved.</p>
          <p className="warning-text">If you refresh, your unsaved changes will be discarded.</p>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onRefresh}>Refresh & Discard My Changes</Button>
        </div>
      </div>
    </div>
  );
};
