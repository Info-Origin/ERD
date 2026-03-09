import persistencePool from '../config/persistenceDb.js';

/**
 * Lock Service - Manages table locks for multi-user collaboration
 */
class LockService {
  /**
   * Acquire lock on a table
   */
  async acquireLock(schemaName, tableName, sessionId) {
    try {
      // Check if table is already locked
      const [existingLocks] = await persistencePool.execute(
        'SELECT * FROM table_locks WHERE schema_name = ? AND table_name = ?',
        [schemaName, tableName]
      );

      if (existingLocks.length > 0) {
        const existingLock = existingLocks[0];
        
        // Check if locked by same user (different tab)
        if (existingLock.locked_by === sessionId) {
          return {
            success: false,
            reason: 'already_locked_by_you',
            message: 'You already have this table locked in another tab'
          };
        }
        
        // Active lock by another user
        return {
          success: false,
          reason: 'locked',
          lockedBy: existingLock.user_display_name,
          lockedAt: existingLock.locked_at,
          message: `Table is locked by ${existingLock.user_display_name}`
        };
      }

      // Generate user display name
      const userDisplayName = await this.generateUserDisplayName(sessionId);

      // Acquire lock
      const [result] = await persistencePool.execute(
        `INSERT INTO table_locks (schema_name, table_name, locked_by, user_display_name) 
         VALUES (?, ?, ?, ?)`,
        [schemaName, tableName, sessionId, userDisplayName]
      );

      console.log(`🔒 Lock acquired: ${schemaName}.${tableName} by ${userDisplayName}`);

      return {
        success: true,
        lock: {
          id: result.insertId,
          schemaName,
          tableName,
          lockedBy: sessionId,
          userDisplayName,
          lockedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error acquiring lock:', error);
      throw error;
    }
  }

  /**
   * Release lock on a table
   */
  async releaseLock(schemaName, tableName, sessionId) {
    try {
      // Verify ownership
      const [locks] = await persistencePool.execute(
        'SELECT * FROM table_locks WHERE schema_name = ? AND table_name = ? AND locked_by = ?',
        [schemaName, tableName, sessionId]
      );

      if (locks.length === 0) {
        return {
          success: false,
          reason: 'not_owner',
          message: 'You do not own this lock'
        };
      }

      // Release lock
      await persistencePool.execute(
        'DELETE FROM table_locks WHERE schema_name = ? AND table_name = ? AND locked_by = ?',
        [schemaName, tableName, sessionId]
      );

      console.log(`🔓 Lock released: ${schemaName}.${tableName} by ${locks[0].user_display_name}`);

      return {
        success: true,
        message: 'Lock released'
      };
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
      const [locks] = await persistencePool.execute(
        'SELECT * FROM table_locks WHERE schema_name = ? AND table_name = ?',
        [schemaName, tableName]
      );

      if (locks.length === 0) {
        return {
          isLocked: false
        };
      }

      const lock = locks[0];
      return {
        isLocked: true,
        lockedBy: lock.locked_by,
        userDisplayName: lock.user_display_name,
        lockedAt: lock.locked_at,
        lastHeartbeat: lock.last_heartbeat
      };
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
      const [locks] = await persistencePool.execute(
        'SELECT * FROM table_locks WHERE schema_name = ? ORDER BY locked_at DESC',
        [schemaName]
      );

      return locks.map(lock => ({
        tableName: lock.table_name,
        lockedBy: lock.locked_by,
        userDisplayName: lock.user_display_name,
        lockedAt: lock.locked_at,
        lastHeartbeat: lock.last_heartbeat
      }));
    } catch (error) {
      console.error('Error getting schema locks:', error);
      throw error;
    }
  }

  /**
   * Generate user display name (User A, User B, etc.)
   */
  async generateUserDisplayName(sessionId) {
    try {
      // Check if this session already has a display name
      const [existing] = await persistencePool.execute(
        'SELECT user_display_name FROM table_locks WHERE locked_by = ? LIMIT 1',
        [sessionId]
      );

      if (existing.length > 0) {
        return existing[0].user_display_name;
      }

      // Get all existing display names
      const [allNames] = await persistencePool.execute(
        'SELECT DISTINCT user_display_name FROM table_locks ORDER BY user_display_name'
      );

      const usedNames = allNames.map(row => row.user_display_name);

      // Find next available letter
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let letter of alphabet) {
        const name = `User ${letter}`;
        if (!usedNames.includes(name)) {
          return name;
        }
      }

      // If all letters used, use numbers
      return `User ${Date.now()}`;
    } catch (error) {
      console.error('Error generating user display name:', error);
      return `User ${Date.now()}`;
    }
  }
}

export default new LockService();
