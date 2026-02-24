/**
 * Persistence Adapter
 * Provides synchronous interface with async background sync to database
 * Uses localStorage for immediate reads/writes, syncs to database in background
 */

import persistenceService from '../services/persistenceService.js';

// Storage keys
const STORAGE_KEY = "reverseERD_virtualSchemas";
const TABLE_POSITIONS_KEY = "reverseERD_tablePositions";
const REAL_DB_HISTORY_KEY = "reverseERD_realDbHistory";
const BASELINE_SCHEMA_KEY = "reverseERD_baselineSchemas";

// ==================== PRIVATE HELPERS ====================

function _saveToLocalStorage(storageType, schemaName, data) {
  try {
    const key = `reverseERD_${storageType}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    stored[schemaName] = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

function _loadFromLocalStorage(storageType, schemaName) {
  try {
    const key = `reverseERD_${storageType}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return stored[schemaName]?.data || null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
}

function _deleteFromLocalStorage(storageType, schemaName) {
  try {
    const key = `reverseERD_${storageType}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    delete stored[schemaName];
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (error) {
    console.warn('Failed to delete from localStorage:', error);
  }
}

// ==================== PUBLIC API ====================

export const saveBaselineSchema = (schemaName, baselineSchema) => {
  _saveToLocalStorage('baselineSchemas', schemaName, baselineSchema);
  persistenceService.saveBaselineSchema(schemaName, baselineSchema).catch(err => {
    console.warn('Failed to sync baseline schema to database:', err);
  });
};

export const loadBaselineSchema = (schemaName) => {
  return _loadFromLocalStorage('baselineSchemas', schemaName);
};

export const clearBaselineSchema = (schemaName) => {
  _deleteFromLocalStorage('baselineSchemas', schemaName);
  persistenceService.deleteBaselineSchema(schemaName).catch(err => {
    console.warn('Failed to delete baseline schema from database:', err);
  });
};

export const saveRealDbHistory = (schemaName, history) => {
  _saveToLocalStorage('realDbHistory', schemaName, history);
  persistenceService.saveRealDbHistory(schemaName, history).catch(err => {
    console.warn('Failed to sync real DB history to database:', err);
  });
};

export const loadRealDbHistory = (schemaName) => {
  return _loadFromLocalStorage('realDbHistory', schemaName) || [];
};

export const clearRealDbHistory = (schemaName) => {
  _deleteFromLocalStorage('realDbHistory', schemaName);
  persistenceService.deleteRealDbHistory(schemaName).catch(err => {
    console.warn('Failed to delete real DB history from database:', err);
  });
};

export const saveToStorage = (schemaName, virtualSchema) => {
  _saveToLocalStorage('virtualSchemas', schemaName, virtualSchema);
  persistenceService.saveVirtualSchema(schemaName, virtualSchema).catch(err => {
    console.warn('Failed to sync virtual schema to database:', err);
  });
};

export const saveTablePositions = (schemaName, positions) => {
  _saveToLocalStorage('tablePositions', schemaName, positions);
  persistenceService.saveTablePositions(schemaName, positions).catch(err => {
    console.warn('Failed to sync table positions to database:', err);
  });
};

export const loadTablePositions = (schemaName) => {
  return _loadFromLocalStorage('tablePositions', schemaName) || {};
};

export const clearTablePositions = (schemaName) => {
  _deleteFromLocalStorage('tablePositions', schemaName);
  persistenceService.deleteTablePositions(schemaName).catch(err => {
    console.warn('Failed to delete table positions from database:', err);
  });
};

export const loadFromStorage = (schemaName) => {
  return _loadFromLocalStorage('virtualSchemas', schemaName);
};

export const getStorageTimestamp = (schemaName) => {
  try {
    const key = 'reverseERD_virtualSchemas';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return stored[schemaName]?.timestamp || null;
  } catch (error) {
    console.warn('Failed to get timestamp from localStorage:', error);
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

export const clearFromStorage = (schemaName) => {
  _deleteFromLocalStorage('virtualSchemas', schemaName);
  persistenceService.deleteVirtualSchema(schemaName).catch(err => {
    console.warn('Failed to delete virtual schema from database:', err);
  });
};

export const clearAllFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TABLE_POSITIONS_KEY);
    localStorage.removeItem(REAL_DB_HISTORY_KEY);
    localStorage.removeItem(BASELINE_SCHEMA_KEY);
  } catch (error) {
    console.warn("Failed to clear all from localStorage:", error);
  }
};
