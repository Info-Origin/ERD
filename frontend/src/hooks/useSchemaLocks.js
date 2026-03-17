import { useState, useCallback, useEffect, useRef } from 'react';
import lockService from '../services/lockService';

/**
 * Hook to manage schema-level locks
 * Polls for lock status changes so all users see updates in real time
 */
export const useSchemaLocks = (schemas) => {
  // Map of schemaName -> { isLocked, lockedBy, userDisplayName, lockedAt }
  const [schemaLocks, setSchemaLocks] = useState({});
  const pollIntervalRef = useRef(null);
  const schemasRef = useRef(schemas);

  // Keep ref in sync without triggering re-renders
  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);

  const fetchLocks = useCallback(async () => {
    const current = schemasRef.current;
    if (!current || current.length === 0) return;
    try {
      const locks = await lockService.getBulkLockStatus(current);
      setSchemaLocks(locks);
    } catch (err) {
      // Silently fail - lock status is non-critical
    }
  }, []); // stable - no deps, reads from ref

  // Poll every 5 seconds so User B sees lock changes without refresh
  useEffect(() => {
    fetchLocks();
    pollIntervalRef.current = setInterval(fetchLocks, 5000);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchLocks]); // fetchLocks is now stable, interval never restarts

  const acquireLock = useCallback(async (schemaName) => {
    const result = await lockService.acquireLock(schemaName);
    if (result.success) {
      // Immediately update local state
      setSchemaLocks(prev => ({
        ...prev,
        [schemaName]: {
          isLocked: true,
          lockedBy: lockService.getSessionId(),
          userDisplayName: result.lock.userDisplayName,
          lockedAt: result.lock.lockedAt
        }
      }));
    }
    return result;
  }, []);

  const releaseLock = useCallback(async (schemaName) => {
    const result = await lockService.releaseLock(schemaName);
    if (result.success) {
      setSchemaLocks(prev => {
        const updated = { ...prev };
        delete updated[schemaName];
        return updated;
      });
    }
    return result;
  }, []);

  const isLockedByMe = useCallback((schemaName) => {
    const lock = schemaLocks[schemaName];
    if (!lock?.isLocked) return false;
    return lock.lockedBy === lockService.getSessionId();
  }, [schemaLocks]);

  const isLockedByOther = useCallback((schemaName) => {
    const lock = schemaLocks[schemaName];
    if (!lock?.isLocked) return false;
    return lock.lockedBy !== lockService.getSessionId();
  }, [schemaLocks]);

  return {
    schemaLocks,
    acquireLock,
    releaseLock,
    isLockedByMe,
    isLockedByOther,
    refreshLocks: fetchLocks
  };
};
