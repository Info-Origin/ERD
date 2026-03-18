import './Modal.css';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'warning';
}

const getIcon = (type: string) => ({ error: '❌', success: '✅', warning: '⚠️' }[type] ?? 'ℹ️');
const getTypeClass = (type: string) => ({ error: 'alert-error', success: 'alert-success', warning: 'alert-warning' }[type] ?? 'alert-info');

const AlertModal = ({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content alert-modal ${getTypeClass(type)}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span className="alert-icon">{getIcon(type)}</span>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert-message">
            {message.split('\n').map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
