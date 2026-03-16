import persistencePool from '../config/persistenceDb.js';

/**
 * Lock Service - Manages schema-level locks for multi-user collaboration
 */
class LockService {
  /**
   * Acquire lock on a schema
   */
  async acquireLock(schemaName, sessionId) {
    try {
      const [existingLocks] = await persistencePool.execute(
        'SELECT * FROM schema_locks WHERE schema_name = ?',
        [schemaName]
      );

      if (existingLocks.length > 0) {
        const existingLock = existingLocks[0];

        if (existingLock.locked_by === sessionId) {
          return {
            success: false,
            reason: 'already_locked_by_you',
            message: 'You already have this schema locked'
          };
        }

        return {
          success: false,
          reason: 'locked',
          lockedBy: existingLock.user_display_name,
          lockedAt: existingLock.locked_at,
          message: `Schema is locked by ${existingLock.user_display_name}`
        };
      }

      const userDisplayName = await this.generateUserDisplayName(sessionId);

      const [result] = await persistencePool.execute(
        `INSERT INTO schema_locks (schema_name, locked_by, user_display_name) VALUES (?, ?, ?)`,
        [schemaName, sessionId, userDisplayName]
      );

      return {
        success: true,
        lock: {
          id: result.insertId,
          schemaName,
          lockedBy: sessionId,
          userDisplayName,
          lockedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error acquiring schema lock:', error);
      throw error;
    }
  }

  /**
   * Release lock on a schema
   */
  async releaseLock(schemaName, sessionId) {
    try {
      const [locks] = await persistencePool.execute(
        'SELECT * FROM schema_locks WHERE schema_name = ? AND locked_by = ?',
        [schemaName, sessionId]
      );

      if (locks.length === 0) {
        return {
          success: false,
          reason: 'not_owner',
          message: 'You do not own this lock'
        };
      }

      await persistencePool.execute(
        'DELETE FROM schema_locks WHERE schema_name = ? AND locked_by = ?',
        [schemaName, sessionId]
      );

      return { success: true, message: 'Lock released' };
    } catch (error) {
      console.error('Error releasing schema lock:', error);
      throw error;
    }
  }

  /**
   * Get lock status for a schema
   */
  async getLockStatus(schemaName) {
    try {
      const [locks] = await persistencePool.execute(
        'SELECT * FROM schema_locks WHERE schema_name = ?',
        [schemaName]
      );

      if (locks.length === 0) {
        return { isLocked: false };
      }

      const lock = locks[0];
      return {
        isLocked: true,
        lockedBy: lock.locked_by,
        userDisplayName: lock.user_display_name,
        lockedAt: lock.locked_at
      };
    } catch (error) {
      console.error('Error getting schema lock status:', error);
      throw error;
    }
  }

  /**
   * Get lock status for multiple schemas at once
   */
  async getBulkLockStatus(schemaNames) {
    try {
      if (!schemaNames || schemaNames.length === 0) return {};

      const placeholders = schemaNames.map(() => '?').join(',');
      const [locks] = await persistencePool.execute(
        `SELECT * FROM schema_locks WHERE schema_name IN (${placeholders})`,
        schemaNames
      );

      const result = {};
      locks.forEach(lock => {
        result[lock.schema_name] = {
          isLocked: true,
          lockedBy: lock.locked_by,
          userDisplayName: lock.user_display_name,
          lockedAt: lock.locked_at
        };
      });

      return result;
    } catch (error) {
      console.error('Error getting bulk lock status:', error);
      throw error;
    }
  }

  /**
   * Generate user display name (User A, User B, etc.)
   */
  async generateUserDisplayName(sessionId) {
    try {
      const [existing] = await persistencePool.execute(
        'SELECT user_display_name FROM schema_locks WHERE locked_by = ? LIMIT 1',
        [sessionId]
      );

      if (existing.length > 0) {
        return existing[0].user_display_name;
      }

      const [allNames] = await persistencePool.execute(
        'SELECT DISTINCT user_display_name FROM schema_locks ORDER BY user_display_name'
      );

      const usedNames = allNames.map(row => row.user_display_name);
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let letter of alphabet) {
        const name = `User ${letter}`;
        if (!usedNames.includes(name)) return name;
      }

      return `User ${Date.now()}`;
    } catch (error) {
      console.error('Error generating user display name:', error);
      return `User ${Date.now()}`;
    }
  }
}

export default new LockService();
