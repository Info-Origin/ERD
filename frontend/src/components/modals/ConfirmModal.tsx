import './Modal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'default';
}

const getIcon = (type: string) => ({ danger: '⚠️', warning: '❓' }[type] ?? '❓');
const getTypeClass = (type: string) => ({ danger: 'confirm-danger', warning: 'confirm-warning' }[type] ?? 'confirm-default');

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Yes', cancelText = 'Cancel', type = 'warning' }: ConfirmModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content confirm-modal ${getTypeClass(type)}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span className="confirm-icon">{getIcon(type)}</span>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="confirm-message">
            {message.split('\n').map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
          <button className="btn-secondary" onClick={onClose}>{cancelText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
