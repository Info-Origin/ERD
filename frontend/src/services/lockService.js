const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

/**
 * Lock Service - Frontend API for schema-level locking
 */
class LockService {
  getSessionId() {
    let sessionId = localStorage.getItem('reverseERD_sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('reverseERD_sessionId', sessionId);
    }
    return sessionId;
  }

  async acquireLock(schemaName) {
    const sessionId = this.getSessionId();
    const response = await fetch(`${API_BASE_URL}/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaName, sessionId })
    });
    return response.json();
  }

  async releaseLock(schemaName) {
    const sessionId = this.getSessionId();
    const response = await fetch(`${API_BASE_URL}/locks/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaName, sessionId })
    });
    return response.json();
  }

  async getLockStatus(schemaName) {
    const response = await fetch(
      `${API_BASE_URL}/locks/status/${encodeURIComponent(schemaName)}`
    );
    return response.json();
  }

  async getBulkLockStatus(schemaNames) {
    const response = await fetch(`${API_BASE_URL}/locks/bulk-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaNames })
    });
    const data = await response.json();
    return data.locks || {};
  }

  isLockedByMe(lockStatus) {
    if (!lockStatus?.isLocked) return false;
    return lockStatus.lockedBy === this.getSessionId();
  }
}

export default new LockService();
