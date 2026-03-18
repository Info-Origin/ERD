import { useState, useEffect } from 'react';
import { useConnection } from '../../context/ConnectionContext';
import './Modal.css';
import './ConnectionModal.css';

const API_BASE_URL = (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL || 'http://localhost:4001/api';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (data: unknown) => void;
}

interface FormData {
  host: string; port: string; database: string; user: string;
  password: string; connectionName: string; dbType: string; ssl: boolean;
}

const emptyForm: FormData = { host: '', port: '3306', database: '', user: '', password: '', connectionName: '', dbType: 'mysql', ssl: false };

export const ConnectionModal = ({ isOpen, onClose, onConnect }: ConnectionModalProps) => {
  const { isConnected, activeConnection, disconnect } = useConnection();
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; isAlreadyConnected?: boolean } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (isOpen && isConnected && activeConnection) {
      setFormData({ ...emptyForm, host: activeConnection.info?.host || '', port: String(activeConnection.info?.port || 3306), database: activeConnection.info?.database || '', user: activeConnection.info?.user || '', connectionName: activeConnection.info?.name || '', ssl: activeConnection.info?.ssl || false });
    }
  }, [isOpen, isConnected, activeConnection]);

  const validateField = (name: string, value: string): string | null => {
    if (name === 'host') { if (!value) return 'Host is required'; if (!/^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/.test(value)) return 'Invalid host format'; }
    if (name === 'port') { const p = parseInt(value, 10); if (isNaN(p) || p < 1 || p > 65535) return 'Invalid port'; }
    if (name === 'database') { if (!value) return 'Database name is required'; if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed'; }
    if (name === 'user') { if (!value) return 'Username is required'; if (value.length > 32) return 'Username too long'; }
    if (name === 'password') { if (!value) return 'Password is required'; }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: fieldValue }));
    if (type !== 'checkbox') setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    setTestResult(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string | null> = {};
    (['host', 'port', 'database', 'user', 'password'] as const).forEach(k => { newErrors[k] = validateField(k, formData[k] as string); });
    setErrors(newErrors);
    return Object.values(newErrors).every(v => !v);
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/connection/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      setTestResult(data.success ? { success: true, message: data.isAlreadyConnected ? `Already connected (${data.existingConnection?.connectedAt})` : 'Connection test successful!', isAlreadyConnected: data.isAlreadyConnected } : { success: false, message: data.message });
    } catch { setTestResult({ success: false, message: 'Network error. Please check your connection.' }); }
    finally { setTesting(false); }
  };

  const performConnection = async () => {
    setConnecting(true);
    try {
      if (isConnected) await disconnect();
      const res = await fetch(`${API_BASE_URL}/connection/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (data.success) { onConnect(data); onClose(); setFormData(emptyForm); setTestResult(null); setErrors({}); }
      else setTestResult({ success: false, message: data.message });
    } catch { setTestResult({ success: false, message: 'Failed to establish connection' }); }
    finally { setConnecting(false); setShowConfirmation(false); }
  };

  const handleConnect = async () => { if (!validateForm()) return; if (isConnected) { setShowConfirmation(true); return; } await performConnection(); };
  const handleClose = () => { setFormData(emptyForm); setTestResult(null); setErrors({}); setShowConfirmation(false); onClose(); };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content connection-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isConnected ? 'Switch Connection' : 'Connect to Database'}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        {testResult && <div className={`test-result ${testResult.success ? (testResult.isAlreadyConnected ? 'warning' : 'success') : 'error'}`}>{testResult.message}</div>}
        <div className="modal-body">
          <div className="form-container">
            <div className="form-group"><label>Connection Name (Optional)</label><input type="text" name="connectionName" value={formData.connectionName} onChange={handleChange} placeholder="My Database" /></div>
            <div className="form-group"><label>Database Type</label><input type="text" value="MySQL" disabled style={{ backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }} /></div>
            <div className="form-row">
              <div className="form-group"><label>Host *</label><input type="text" name="host" value={formData.host} onChange={handleChange} placeholder="localhost" className={errors.host ? 'error' : ''} />{errors.host && <span className="error-text">{errors.host}</span>}</div>
              <div className="form-group"><label>Port *</label><input type="number" name="port" value={formData.port} onChange={handleChange} placeholder="3306" className={errors.port ? 'error' : ''} />{errors.port && <span className="error-text">{errors.port}</span>}</div>
            </div>
            <div className="form-group"><label>Database Name *</label><input type="text" name="database" value={formData.database} onChange={handleChange} placeholder="my_database" className={errors.database ? 'error' : ''} />{errors.database && <span className="error-text">{errors.database}</span>}</div>
            <div className="form-group"><label>Username *</label><input type="text" name="user" value={formData.user} onChange={handleChange} placeholder="root" className={errors.user ? 'error' : ''} autoComplete="username" />{errors.user && <span className="error-text">{errors.user}</span>}</div>
            <div className="form-group"><label>Password *</label>
              <div className="password-input">
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" className={errors.password ? 'error' : ''} autoComplete="current-password" />
                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
            <div className="form-group ssl-checkbox-group"><label className="checkbox-label"><input type="checkbox" name="ssl" checked={formData.ssl} onChange={handleChange} /><span>Enable SSL/TLS</span></label></div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={handleClose} disabled={testing || connecting} className="btn-secondary">Cancel</button>
          <button onClick={handleTestConnection} disabled={testing || connecting} className="btn-secondary">{testing ? 'Testing...' : 'Test Connection'}</button>
          <button onClick={handleConnect} disabled={testing || connecting || !testResult?.success} className="btn-primary">{connecting ? 'Connecting...' : 'Connect'}</button>
        </div>
      </div>
      {showConfirmation && (
        <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="confirmation-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirmation-header"><h3>Switch Database Connection</h3></div>
            <div className="confirmation-body">
              <div className="confirmation-icon">⚠️</div>
              <div className="confirmation-content">
                <p><span className="current-connection">Currently connected to: {(activeConnection as { info?: { name?: string } })?.info?.name}</span></p>
                <p>Connecting to a new database will replace the current connection. Continue?</p>
              </div>
            </div>
            <div className="confirmation-actions">
              <button onClick={() => setShowConfirmation(false)} className="btn-secondary" disabled={connecting}>Cancel</button>
              <button onClick={performConnection} className="btn-primary" disabled={connecting}>{connecting ? 'Connecting...' : 'OK, Switch Connection'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
