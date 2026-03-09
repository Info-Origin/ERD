const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

/**
 * Lock Service - Frontend API for table locking
 */
class LockService {
  /**
   * Get session ID (generate if doesn't exist)
   */
  getSessionId() {
    let sessionId = localStorage.getItem('reverseERD_sessionId');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      localStorage.setItem('reverseERD_sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Acquire lock on a table
   */
  async acquireLock(schemaName, tableName) {
    try {
      const sessionId = this.getSessionId();
      
      const response = await fetch(`${API_BASE_URL}/locks/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schemaName,
          tableName,
          sessionId
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return data; // Return error response
      }

      return data;
    } catch (error) {
      console.error('Error acquiring lock:', error);
      throw error;
    }
  }

  /**
   * Release lock on a table
   */
  async releaseLock(schemaName, tableName) {
    try {
      const sessionId = this.getSessionId();
      
      const response = await fetch(`${API_BASE_URL}/locks/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schemaName,
          tableName,
          sessionId
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return data;
      }

      return data;
    } catch (error) {
      console.error('Error releasing lock:', error);
      throw error;
    }
  }

  /**
   * Get lock status for a specific table
   */
  async getLockStatus(schemaName, tableName) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/locks/status/${encodeURIComponent(schemaName)}/${encodeURIComponent(tableName)}`
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting lock status:', error);
      throw error;
    }
  }

  /**
   * Get all locks for a schema
   */
  async getSchemaLocks(schemaName) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/locks/schema/${encodeURIComponent(schemaName)}`
      );

      const data = await response.json();
      return data.locks || [];
    } catch (error) {
      console.error('Error getting schema locks:', error);
      throw error;
    }
  }
}

export default new LockService();
