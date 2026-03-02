/**
 * Persistence Adapter
 * Database-only storage for virtual schemas, baseline, and table positions
 * No localStorage caching - all data stored in persistence database
 */

import persistenceService from '../services/persistenceService.js';

// ==================== PUBLIC API ====================

export const saveBaselineSchema = async (schemaName, baselineSchema, connectionId = null) => {
  // If connectionId provided, use composite key for multi-database support
  const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
  
  try {
    await persistenceService.saveBaselineSchema(storageKey, baselineSchema);
  } catch (err) {
    console.warn('Failed to save baseline schema to database:', err);
    throw err;
  }
};

export const loadBaselineSchema = async (schemaName, connectionId = null) => {
  try {
    // Try new format first (with connectionId) for multi-database support
    const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
    const baseline = await persistenceService.loadBaselineSchema(storageKey);
    
    if (baseline) {
      return baseline;
    }
    
    // If connectionId was used but not found, try fallback without connectionId
    if (connectionId) {
      console.log(`⚠️ No baseline found with connectionId, trying fallback...`);
      const fallbackBaseline = await persistenceService.loadBaselineSchema(schemaName);
      return fallbackBaseline;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load baseline schema from database:', error);
    return null;
  }
};

export const clearBaselineSchema = async (schemaName, connectionId = null) => {
  const storageKey = connectionId ? `${connectionId}_${schemaName}` : schemaName;
  
  try {
    await persistenceService.deleteBaselineSchema(storageKey);
  } catch (err) {
    console.warn('Failed to delete baseline schema from database:', err);
  }
};

export const saveRealDbHistory = async (schemaName, history) => {
  try {
    await persistenceService.saveRealDbHistory(schemaName, history);
  } catch (err) {
    console.warn('Failed to save real DB history to database:', err);
    throw err;
  }
};

export const loadRealDbHistory = async (schemaName) => {
  try {
    const history = await persistenceService.loadRealDbHistory(schemaName);
    return history || [];
  } catch (error) {
    console.warn('Failed to load real DB history from database:', error);
    return [];
  }
};

export const clearRealDbHistory = async (schemaName) => {
  try {
    await persistenceService.deleteRealDbHistory(schemaName);
  } catch (err) {
    console.warn('Failed to delete real DB history from database:', err);
  }
};

export const saveToStorage = async (schemaName, virtualSchema) => {
  try {
    await persistenceService.saveVirtualSchema(schemaName, virtualSchema);
  } catch (err) {
    console.warn('Failed to save virtual schema to database:', err);
    throw err;
  }
};

export const saveTablePositions = async (schemaName, positions) => {
  try {
    await persistenceService.saveTablePositions(schemaName, positions);
  } catch (err) {
    console.warn('Failed to save table positions to database:', err);
    throw err;
  }
};

export const loadTablePositions = async (schemaName) => {
  try {
    const positions = await persistenceService.loadTablePositions(schemaName);
    return positions || {};
  } catch (error) {
    console.warn('Failed to load table positions from database:', error);
    return {};
  }
};

export const clearTablePositions = async (schemaName) => {
  try {
    await persistenceService.deleteTablePositions(schemaName);
  } catch (err) {
    console.warn('Failed to delete table positions from database:', err);
  }
};

export const loadFromStorage = async (schemaName) => {
  try {
    const schema = await persistenceService.loadVirtualSchema(schemaName);
    return schema;
  } catch (error) {
    console.warn('Failed to load virtual schema from database:', error);
    return null;
  }
};

export const loadFromDatabase = async (schemaName) => {
  try {
    const schema = await persistenceService.loadVirtualSchema(schemaName);
    return schema;
  } catch (error) {
    console.warn('Failed to load from database:', error);
    return null;
  }
};

export const loadBaselineFromDatabase = async (schemaName, connectionId = null) => {
  // This function now just calls loadBaselineSchema (which is already database-only)
  return loadBaselineSchema(schemaName, connectionId);
};

export const getStorageTimestamp = async (schemaName) => {
  try {
    const timestamp = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    return timestamp || null;
  } catch (error) {
    console.warn('Failed to get timestamp from database:', error);
    return null;
  }
};

export const checkForNewerChanges = async (schemaName, currentTimestamp) => {
  try {
    // Check persistence DB for newer changes
    const dbTimestamp = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    
    if (!dbTimestamp || !currentTimestamp) {
      return false;
    }
    
    // If DB has newer changes than our current timestamp, return true
    return dbTimestamp > currentTimestamp;
  } catch (error) {
    console.warn('Failed to check for newer changes:', error);
    return false;
  }
};

export const clearFromStorage = async (schemaName) => {
  try {
    await persistenceService.deleteVirtualSchema(schemaName);
  } catch (err) {
    console.warn('Failed to delete virtual schema from database:', err);
  }
};

export const clearAllFromStorage = async () => {
  // Database-only storage - nothing to clear from localStorage
  console.log('clearAllFromStorage: Using database-only storage, no localStorage to clear');
};
