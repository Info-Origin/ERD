/**
 * Persistence Adapter
 * Database-only storage for virtual schemas, baseline, and table positions
 */
import persistenceService from '../services/persistenceService';
import type { ERDData, TablePositions, RealDbHistoryEntry } from '../types';

export const saveBaselineSchema = async (schemaName: string, baselineSchema: ERDData, connectionId: string | null = null): Promise<void> => {
  const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
  try {
    await persistenceService.saveBaselineSchema(storageKey, baselineSchema);
  } catch (err) {
    console.warn('Failed to save baseline schema to database:', err);
    throw err;
  }
};

export const loadBaselineSchema = async (schemaName: string, connectionId: string | null = null): Promise<ERDData | null> => {
  try {
    const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
    const baseline = await persistenceService.loadBaselineSchema(storageKey);
    if (baseline) return baseline;
    if (connectionId) {
      console.log('⚠️ No baseline found with connectionId, trying fallback...');
      return await persistenceService.loadBaselineSchema(schemaName);
    }
    return null;
  } catch (error) {
    console.warn('Failed to load baseline schema from database:', error);
    return null;
  }
};

export const clearBaselineSchema = async (schemaName: string, connectionId: string | null = null): Promise<void> => {
  const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
  try {
    await persistenceService.deleteBaselineSchema(storageKey);
  } catch (err) {
    console.warn('Failed to delete baseline schema from database:', err);
  }
};

export const saveRealDbHistory = async (schemaName: string, history: RealDbHistoryEntry[]): Promise<void> => {
  try {
    await persistenceService.saveRealDbHistory(schemaName, history);
  } catch (err) {
    console.warn('Failed to save real DB history to database:', err);
    throw err;
  }
};

export const loadRealDbHistory = async (schemaName: string): Promise<RealDbHistoryEntry[]> => {
  try {
    const history = await persistenceService.loadRealDbHistory(schemaName);
    return (history || []) as RealDbHistoryEntry[];
  } catch (error) {
    console.warn('Failed to load real DB history from database:', error);
    return [];
  }
};

export const clearRealDbHistory = async (schemaName: string): Promise<void> => {
  try {
    await persistenceService.deleteRealDbHistory(schemaName);
  } catch (err) {
    console.warn('Failed to delete real DB history from database:', err);
  }
};

export const saveToStorage = async (schemaName: string, virtualSchema: ERDData): Promise<void> => {
  try {
    await persistenceService.saveVirtualSchema(schemaName, virtualSchema);
  } catch (err) {
    console.warn('Failed to save virtual schema to database:', err);
    throw err;
  }
};

export const saveTablePositions = async (schemaName: string, positions: TablePositions): Promise<void> => {
  try {
    await persistenceService.saveTablePositions(schemaName, positions);
  } catch (err) {
    console.warn('Failed to save table positions to database:', err);
    throw err;
  }
};

export const loadTablePositions = async (schemaName: string): Promise<TablePositions> => {
  try {
    const positions = await persistenceService.loadTablePositions(schemaName);
    return positions || {};
  } catch (error) {
    console.warn('Failed to load table positions from database:', error);
    return {};
  }
};

export const clearTablePositions = async (schemaName: string): Promise<void> => {
  try {
    await persistenceService.deleteTablePositions(schemaName);
  } catch (err) {
    console.warn('Failed to delete table positions from database:', err);
  }
};

export const loadFromStorage = async (schemaName: string): Promise<ERDData | null> => {
  try {
    return await persistenceService.loadVirtualSchema(schemaName);
  } catch (error) {
    console.warn('Failed to load virtual schema from database:', error);
    return null;
  }
};

export const loadFromDatabase = async (schemaName: string): Promise<ERDData | null> => {
  try {
    return await persistenceService.loadVirtualSchema(schemaName);
  } catch (error) {
    console.warn('Failed to load from database:', error);
    return null;
  }
};

export const loadBaselineFromDatabase = async (schemaName: string, connectionId: string | null = null): Promise<ERDData | null> => {
  return loadBaselineSchema(schemaName, connectionId);
};

export const getStorageTimestamp = async (schemaName: string): Promise<number | null> => {
  try {
    const timestamp = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    return timestamp || null;
  } catch (error) {
    console.warn('Failed to get timestamp from database:', error);
    return null;
  }
};

export const checkForNewerChanges = async (schemaName: string, currentTimestamp: number): Promise<boolean> => {
  try {
    const dbTimestamp = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    if (!dbTimestamp || !currentTimestamp) return false;
    return dbTimestamp > currentTimestamp;
  } catch (error) {
    console.warn('Failed to check for newer changes:', error);
    return false;
  }
};

export const clearFromStorage = async (schemaName: string): Promise<void> => {
  try {
    await persistenceService.deleteVirtualSchema(schemaName);
  } catch (err) {
    console.warn('Failed to delete virtual schema from database:', err);
  }
};

export const clearAllFromStorage = async (): Promise<void> => {
  console.log('clearAllFromStorage: Using database-only storage, no localStorage to clear');
};
