import { useState, useEffect } from 'react';
import { FiX, FiCheck, FiInfo, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import './Notification.css';

export const Notification = ({ 
  message, 
  type = 'info', 
  duration = 5000, 
  onClose, 
  position = 'top-right' 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300); // Wait for animation to complete
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheck className="notification-icon" />;
      case 'warning':
        return <FiAlertTriangle className="notification-icon" />;
      case 'error':
        return <FiAlertCircle className="notification-icon" />;
      default:
        return <FiInfo className="notification-icon" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`notification notification-${type} notification-${position} ${isVisible ? 'notification-visible' : ''}`}>
      <div className="notification-content">
        {getIcon()}
        <span className="notification-message">{message}</span>
      </div>
      <button 
        className="notification-close" 
        onClick={handleClose}
        aria-label="Close notification"
      >
        <FiX />
      </button>
    </div>
  );
};