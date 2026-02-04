import React from 'react';
import './Modal.css';

const AlertModal = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'error':
        return 'alert-error';
      case 'success':
        return 'alert-success';
      case 'warning':
        return 'alert-warning';
      default:
        return 'alert-info';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content alert-modal ${getTypeClass()}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <span className="alert-icon">{getIcon()}</span>
            {title}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="alert-message">
            {message.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;