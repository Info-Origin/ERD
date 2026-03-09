import { useState, useEffect } from 'react';
import { useConnection } from '../../context/ConnectionContext';
import './Modal.css';
import './ConnectionModal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

export const ConnectionModal = ({ isOpen, onClose, onConnect }) => {
  const { isConnected, activeConnection, disconnect } = useConnection();
  
  const [formData, setFormData] = useState({
    host: '',
    port: '3306',
    database: '',
    user: '',
    password: '',
    connectionName: '',
    dbType: 'mysql',
    ssl: false
  });
  
  const [errors, setErrors] = useState({});
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Check if already connected
  useEffect(() => {
    if (isOpen && isConnected) {
      // Pre-fill with current connection info
      setFormData({
        host: activeConnection?.info?.host || '',
        port: activeConnection?.info?.port?.toString() || '3306',
        database: activeConnection?.info?.database || '',
        user: activeConnection?.info?.user || '',
        password: '',
        connectionName: activeConnection?.info?.name || '',
        dbType: 'mysql',
        ssl: activeConnection?.info?.ssl || false
      });
    }
  }, [isOpen, isConnected, activeConnection]);

  const validateField = (name, value) => {
    switch (name) {
      case 'host':
        if (!value) return 'Host is required';
        // Allow cloud endpoints like AWS RDS, Railway, etc.
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/.test(value)) return 'Invalid host format';
        break;
      case 'port':
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) return 'Invalid port';
        break;
      case 'database':
        if (!value) return 'Database name is required';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed';
        break;
      case 'user':
        if (!value) return 'Username is required';
        if (value.length > 32) return 'Username too long';
        break;
      case 'password':
        if (!value) return 'Password is required';
        break;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: fieldValue }));
    
    // Clear error for this field
    if (type !== 'checkbox') {
      const error = validateField(name, fieldValue);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
    
    // Clear test result when form changes
    setTestResult(null);
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      // Skip optional fields
      if (key !== 'connectionName' && key !== 'ssl' && key !== 'dbType') {
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/connection/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.isAlreadyConnected) {
          // Connection already exists
          setTestResult({ 
            success: true, 
            message: `This connection is already active (connected at ${data.existingConnection?.connectedAt})`,
            isAlreadyConnected: true
          });
        } else {
          // New connection test successful
          setTestResult({ 
            success: true, 
            message: 'Connection test successful!',
            isAlreadyConnected: false
          });
        }
      } else {
        setTestResult({ success: false, message: data.message });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Network error. Please check your connection.' 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!validateForm()) return;
    
    // If already connected, show confirmation dialog
    if (isConnected) {
      setShowConfirmation(true);
      return;
    }
    
    // Proceed with connection
    await performConnection();
  };

  const performConnection = async () => {
    setConnecting(true);
    
    try {
      // If already connected, disconnect first
      if (isConnected) {
        await disconnect();
      }

      const response = await fetch(`${API_BASE_URL}/connection/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onConnect(data);
        onClose();
        
        // Reset form
        setFormData({
          host: '',
          port: '3306',
          database: '',
          user: '',
          password: '',
          connectionName: '',
          dbType: 'mysql',
          ssl: false
        });
        setTestResult(null);
        setErrors({});
      } else {
        setTestResult({ success: false, message: data.message });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Failed to establish connection' 
      });
    } finally {
      setConnecting(false);
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    setFormData({
      host: '',
      port: '3306',
      database: '',
      user: '',
      password: '',
      connectionName: '',
      dbType: 'mysql',
      ssl: false
    });
    setTestResult(null);
    setErrors({});
    setShowConfirmation(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isConnected ? 'Switch Connection' : 'Connect to Database'}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {testResult && (
          <div className={`test-result ${
            testResult.success 
              ? (testResult.isAlreadyConnected ? 'warning' : 'success')
              : 'error'
          }`}>
            {testResult.message}
          </div>
        )}
        
        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label htmlFor="connectionName">Connection Name (Optional)</label>
              <input
                type="text"
                id="connectionName"
                name="connectionName"
                value={formData.connectionName}
                onChange={handleChange}
                placeholder="My Database"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dbType">Database Type</label>
              <input
                type="text"
                id="dbType"
                name="dbType"
                value="MySQL"
                disabled
                style={{ backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="host">Host *</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={formData.host}
                  onChange={handleChange}
                  placeholder="localhost or db.example.com"
                  className={errors.host ? 'error' : ''}
                />
                {errors.host && <span className="error-text">{errors.host}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="port">Port *</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={formData.port}
                  onChange={handleChange}
                  placeholder="3306"
                  className={errors.port ? 'error' : ''}
                />
                {errors.port && <span className="error-text">{errors.port}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="database">Database Name *</label>
              <input
                type="text"
                id="database"
                name="database"
                value={formData.database}
                onChange={handleChange}
                placeholder="my_database"
                className={errors.database ? 'error' : ''}
              />
              {errors.database && <span className="error-text">{errors.database}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="user">Username *</label>
              <input
                type="text"
                id="user"
                name="user"
                value={formData.user}
                onChange={handleChange}
                placeholder="root"
                className={errors.user ? 'error' : ''}
                autoComplete="username"
              />
              {errors.user && <span className="error-text">{errors.user}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={errors.password ? 'error' : ''}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-group ssl-checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  id="ssl"
                  name="ssl"
                  checked={formData.ssl}
                  onChange={handleChange}
                />
                <span>Enable SSL/TLS (Required for most cloud databases)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleClose} disabled={testing || connecting} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleTestConnection} 
            disabled={testing || connecting}
            className="btn-secondary"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button 
            onClick={handleConnect} 
            disabled={testing || connecting || !testResult?.success}
            className="btn-primary"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <h3>Switch Database Connection</h3>
            </div>
            <div className="confirmation-body">
              <div className="confirmation-icon">⚠️</div>
              <div className="confirmation-content">
                <p><span className="current-connection">Currently connected to: {activeConnection?.info?.name}</span></p>
                <p>Connecting to a new database will replace the current connection. Continue?</p>
              </div>
            </div>
            <div className="confirmation-actions">
              <button 
                onClick={() => setShowConfirmation(false)} 
                className="btn-secondary"
                disabled={connecting}
              >
                Cancel
              </button>
              <button 
                onClick={performConnection} 
                className="btn-primary"
                disabled={connecting}
              >
                {connecting ? 'Connecting...' : 'OK, Switch Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
