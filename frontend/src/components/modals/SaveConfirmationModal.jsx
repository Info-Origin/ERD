import { Button } from '../common/Button';
import './SaveConfirmationModal.css';

export const SaveConfirmationModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content save-confirmation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save Changes</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <p>Do you want to save changes to the virtual database?</p>
        </div>
        
        <div className="modal-footer">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Yes, Save
          </Button>
        </div>
      </div>
    </div>
  );
};
