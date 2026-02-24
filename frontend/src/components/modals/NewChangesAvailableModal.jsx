import { Button } from '../common/Button';
import './NewChangesAvailableModal.css';

export const NewChangesAvailableModal = ({ isOpen, onRefresh, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content new-changes-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon">🔄</div>
          <h2>New Changes Available</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <p>There are new changes saved by other users.</p>
          <p>Please refresh to pull the latest changes.</p>
        </div>
        
        <div className="modal-footer">
          <Button variant="ghost" onClick={onCancel}>
            Later
          </Button>
          <Button variant="primary" onClick={onRefresh}>
            Refresh Now
          </Button>
        </div>
      </div>
    </div>
  );
};
