import { useState, useCallback, useEffect, useRef } from 'react';
import lockService from '../services/lockService';
import type { SchemaLocks, LockStatus } from '../types';

interface UseSchemaLocksReturn {
  schemaLocks: SchemaLocks;
  acquireLock: (schemaName: string) => Promise<{ success: boolean; lock?: { userDisplayName: string; lockedAt: string } }>;
  releaseLock: (schemaName: string) => Promise<{ success: boolean }>;
  isLockedByMe: (schemaName: string) => boolean;
  isLockedByOther: (schemaName: string) => boolean;
  refreshLocks: () => Promise<void>;
}

export const useSchemaLocks = (schemas: string[]): UseSchemaLocksReturn => {
  const [schemaLocks, setSchemaLocks] = useState<SchemaLocks>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const schemasRef = useRef<string[]>(schemas);

  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);

  const fetchLocks = useCallback(async () => {
    const current = schemasRef.current;
    if (!current || current.length === 0) return;
    try {
      const locks = await lockService.getBulkLockStatus(current);
      setSchemaLocks(locks);
    } catch {
      // non-critical — silently fail
    }
  }, []);

  useEffect(() => {
    fetchLocks();
    pollIntervalRef.current = setInterval(fetchLocks, 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchLocks]);

  const acquireLock = useCallback(async (schemaName: string) => {
    const result = await lockService.acquireLock(schemaName);
    if (result.success && (result as { lock?: { userDisplayName: string; lockedAt: string } }).lock) {
      const lock = (result as { success: boolean; lock: { userDisplayName: string; lockedAt: string } }).lock;
      setSchemaLocks((prev) => ({
        ...prev,
        [schemaName]: {
          isLocked: true,
          lockedBy: lockService.getSessionId(),
          userDisplayName: lock.userDisplayName,
          lockedAt: lock.lockedAt,
        } as LockStatus,
      }));
    }
    return result as { success: boolean; lock?: { userDisplayName: string; lockedAt: string } };
  }, []);

  const releaseLock = useCallback(async (schemaName: string) => {
    const result = await lockService.releaseLock(schemaName);
    if (result.success) {
      setSchemaLocks((prev) => {
        const updated = { ...prev };
        delete updated[schemaName];
        return updated;
      });
    }
    return result;
  }, []);

  const isLockedByMe = useCallback(
    (schemaName: string) => {
      const lock = schemaLocks[schemaName];
      if (!lock?.isLocked) return false;
      return lock.lockedBy === lockService.getSessionId();
    },
    [schemaLocks],
  );

  const isLockedByOther = useCallback(
    (schemaName: string) => {
      const lock = schemaLocks[schemaName];
      if (!lock?.isLocked) return false;
      return lock.lockedBy !== lockService.getSessionId();
    },
    [schemaLocks],
  );

  return { schemaLocks, acquireLock, releaseLock, isLockedByMe, isLockedByOther, refreshLocks: fetchLocks };
};
