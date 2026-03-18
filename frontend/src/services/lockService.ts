import type { LockStatus, SchemaLocks } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4001/api';

class LockService {
  getSessionId(): string {
    let sessionId = localStorage.getItem('reverseERD_sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('reverseERD_sessionId', sessionId);
    }
    return sessionId;
  }

  async acquireLock(schemaName: string): Promise<{ success: boolean; reason?: string; message?: string }> {
    const sessionId = this.getSessionId();
    const response = await fetch(`${API_BASE_URL}/locks/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaName, sessionId }),
    });
    return response.json();
  }

  async releaseLock(schemaName: string): Promise<{ success: boolean; message?: string }> {
    const sessionId = this.getSessionId();
    const response = await fetch(`${API_BASE_URL}/locks/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaName, sessionId }),
    });
    return response.json();
  }

  async getLockStatus(schemaName: string): Promise<LockStatus> {
    const response = await fetch(
      `${API_BASE_URL}/locks/status/${encodeURIComponent(schemaName)}`,
    );
    return response.json();
  }

  async getBulkLockStatus(schemaNames: string[]): Promise<SchemaLocks> {
    const response = await fetch(`${API_BASE_URL}/locks/bulk-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaNames }),
    });
    const data = await response.json();
    return data.locks || {};
  }

  isLockedByMe(lockStatus: LockStatus): boolean {
    if (!lockStatus?.isLocked) return false;
    return lockStatus.lockedBy === this.getSessionId();
  }
}

export default new LockService();
