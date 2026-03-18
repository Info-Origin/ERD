import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { Button } from '../common/Button';
import './Modal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: string;
}

export const ConfirmationModal = ({
  isOpen, onClose, onConfirm, title, message,
  confirmText = 'Yes', cancelText = 'Cancel', variant = 'danger',
}: ConfirmationModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirmation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiAlertTriangle className="modal-warning-icon" />
            <h2 className="modal-title">{title}</h2>
          </div>
        </div>
        <div className="modal-body">
          <p className="confirmation-message">{message}</p>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button variant={variant} onClick={() => { onConfirm(); onClose(); }} className="confirmation-button">
            <FiRefreshCw />{confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
