import React from 'react';
import './Modal.css';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Yes', cancelText = 'Cancel', type = 'warning' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '❓';
      default:
        return '❓';
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'danger':
        return 'confirm-danger';
      case 'warning':
        return 'confirm-warning';
      default:
        return 'confirm-default';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content confirm-modal ${getTypeClass()}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <span className="confirm-icon">{getIcon()}</span>
            {title}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="confirm-message">
            {message.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button className="btn-danger" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;