/**
 * Persistence Service
 * Handles all API calls to the persistence backend
 * Replaces localStorage with database-backed persistence
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

class PersistenceService {
  // ==================== VIRTUAL SCHEMAS ====================
  
  /**
   * Save virtual schema to database
   */
  async saveVirtualSchema(schemaName, virtualSchema) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ virtualSchema }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save virtual schema');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving virtual schema:', error);
      // Fallback to localStorage if API fails
      this._saveToLocalStorage('virtualSchemas', schemaName, virtualSchema);
      throw error;
    }
  }

  /**
   * Load virtual schema from database
   */
  async loadVirtualSchema(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`);
      
      if (response.status === 404) {
        return null; // Schema not found (expected for first load)
      }
      
      if (!response.ok) {
        throw new Error('Failed to load virtual schema');
      }
      
      const data = await response.json();
      return data.schema;
    } catch (error) {
      // Only log unexpected errors (not 404s)
      if (error.message !== 'Failed to load virtual schema') {
        console.warn('Error loading virtual schema from API, trying localStorage:', error);
      }
      // Fallback to localStorage if API fails
      return this._loadFromLocalStorage('virtualSchemas', schemaName);
    }
  }

  /**
   * Delete virtual schema from database
   */
  async deleteVirtualSchema(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete virtual schema');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting virtual schema:', error);
      // Fallback to localStorage if API fails
      this._deleteFromLocalStorage('virtualSchemas', schemaName);
      throw error;
    }
  }

  /**
   * Get virtual schema timestamp from database
   */
  async getVirtualSchemaTimestamp(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}/timestamp`);
      
      if (response.status === 404) {
        return null; // Schema not found (expected for first load)
      }
      
      if (!response.ok) {
        throw new Error('Failed to get virtual schema timestamp');
      }
      
      const data = await response.json();
      return data.timestamp;
    } catch (error) {
      // Silently handle 404s - they're expected when no data exists yet
      return null;
    }
  }

  // ==================== TABLE POSITIONS ====================
  
  /**
   * Save table positions to database
   */
  async saveTablePositions(schemaName, positions) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ positions }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save table positions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving table positions:', error);
      // Fallback to localStorage if API fails
      this._saveToLocalStorage('tablePositions', schemaName, positions);
      throw error;
    }
  }

  /**
   * Load table positions from database
   */
  async loadTablePositions(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`);
      
      if (response.status === 404) {
        return {}; // No positions found
      }
      
      if (!response.ok) {
        throw new Error('Failed to load table positions');
      }
      
      const data = await response.json();
      return data.positions;
    } catch (error) {
      console.warn('Error loading table positions from API, trying localStorage:', error);
      // Fallback to localStorage if API fails
      return this._loadFromLocalStorage('tablePositions', schemaName) || {};
    }
  }

  /**
   * Delete table positions from database
   */
  async deleteTablePositions(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete table positions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting table positions:', error);
      // Fallback to localStorage if API fails
      this._deleteFromLocalStorage('tablePositions', schemaName);
      throw error;
    }
  }

  // ==================== BASELINE SCHEMAS ====================
  
  /**
   * Save baseline schema to database
   */
  async saveBaselineSchema(schemaName, baselineSchema) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ baselineSchema }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save baseline schema');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving baseline schema:', error);
      // Fallback to localStorage if API fails
      this._saveToLocalStorage('baselineSchemas', schemaName, baselineSchema);
      throw error;
    }
  }

  /**
   * Load baseline schema from database
   */
  async loadBaselineSchema(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`);
      
      if (response.status === 404) {
        return null; // Schema not found (expected for first load)
      }
      
      if (!response.ok) {
        throw new Error('Failed to load baseline schema');
      }
      
      const data = await response.json();
      return data.schema;
    } catch (error) {
      // Only log unexpected errors
      if (error.message !== 'Failed to load baseline schema') {
        console.warn('Error loading baseline schema from API, trying localStorage:', error);
      }
      // Fallback to localStorage if API fails
      return this._loadFromLocalStorage('baselineSchemas', schemaName);
    }
  }

  /**
   * Delete baseline schema from database
   */
  async deleteBaselineSchema(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete baseline schema');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting baseline schema:', error);
      // Fallback to localStorage if API fails
      this._deleteFromLocalStorage('baselineSchemas', schemaName);
      throw error;
    }
  }

  // ==================== REAL DB HISTORY ====================
  
  /**
   * Save real DB history to database
   */
  async saveRealDbHistory(schemaName, history) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save real DB history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error saving real DB history:', error);
      // Fallback to localStorage if API fails
      this._saveToLocalStorage('realDbHistory', schemaName, history);
      throw error;
    }
  }

  /**
   * Load real DB history from database
   */
  async loadRealDbHistory(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`);
      
      if (response.status === 404) {
        return []; // No history found
      }
      
      if (!response.ok) {
        throw new Error('Failed to load real DB history');
      }
      
      const data = await response.json();
      return data.history;
    } catch (error) {
      console.warn('Error loading real DB history from API, trying localStorage:', error);
      // Fallback to localStorage if API fails
      return this._loadFromLocalStorage('realDbHistory', schemaName) || [];
    }
  }

  /**
   * Delete real DB history from database
   */
  async deleteRealDbHistory(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete real DB history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting real DB history:', error);
      // Fallback to localStorage if API fails
      this._deleteFromLocalStorage('realDbHistory', schemaName);
      throw error;
    }
  }

  // ==================== BULK OPERATIONS ====================
  
  /**
   * Clear all persistence data for a schema
   */
  async clearAllForSchema(schemaName) {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/clear-all/${schemaName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear all data');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error clearing all data:', error);
      // Fallback to localStorage if API fails
      this._deleteFromLocalStorage('virtualSchemas', schemaName);
      this._deleteFromLocalStorage('tablePositions', schemaName);
      this._deleteFromLocalStorage('baselineSchemas', schemaName);
      this._deleteFromLocalStorage('realDbHistory', schemaName);
      throw error;
    }
  }

  // ==================== LOCALSTORAGE FALLBACK ====================
  
  /**
   * Save to localStorage as fallback
   */
  _saveToLocalStorage(storageType, schemaName, data) {
    try {
      const key = `reverseERD_${storageType}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[schemaName] = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load from localStorage as fallback
   */
  _loadFromLocalStorage(storageType, schemaName) {
    try {
      const key = `reverseERD_${storageType}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      return stored[schemaName]?.data || null;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Delete from localStorage as fallback
   */
  _deleteFromLocalStorage(storageType, schemaName) {
    try {
      const key = `reverseERD_${storageType}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      delete stored[schemaName];
      localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to delete from localStorage:', error);
    }
  }
}

export default new PersistenceService();
