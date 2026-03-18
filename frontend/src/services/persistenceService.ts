import type { ERDData, TablePositions, SavedSchema } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4001/api';

class PersistenceService {
  // ==================== VIRTUAL SCHEMAS ====================

  async saveVirtualSchema(schemaName: string, virtualSchema: ERDData): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ virtualSchema }),
      });
      if (!response.ok) throw new Error('Failed to save virtual schema');
    } catch (error) {
      console.error('Error saving virtual schema:', error);
      this._saveToLocalStorage('virtualSchemas', schemaName, virtualSchema);
      throw error;
    }
  }

  async loadVirtualSchema(schemaName: string): Promise<ERDData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to load virtual schema');
      const data = await response.json();
      return data.schema as ERDData;
    } catch (error) {
      console.warn('Error loading virtual schema from API, trying localStorage:', error);
      return this._loadFromLocalStorage<ERDData>('virtualSchemas', schemaName);
    }
  }

  async deleteVirtualSchema(schemaName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/virtual-schema/${schemaName}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete virtual schema');
    } catch (error) {
      console.error('Error deleting virtual schema:', error);
      this._deleteFromLocalStorage('virtualSchemas', schemaName);
      throw error;
    }
  }

  async getVirtualSchemaTimestamp(schemaName: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/persistence/virtual-schema/${schemaName}/timestamp`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to get virtual schema timestamp');
      const data = await response.json();
      return data.timestamp as number;
    } catch {
      return null;
    }
  }

  // ==================== TABLE POSITIONS ====================

  async saveTablePositions(schemaName: string, positions: TablePositions): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });
      if (!response.ok) throw new Error('Failed to save table positions');
    } catch (error) {
      console.error('Error saving table positions:', error);
      this._saveToLocalStorage('tablePositions', schemaName, positions);
      throw error;
    }
  }

  async loadTablePositions(schemaName: string): Promise<TablePositions> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`);
      if (response.status === 404) return {};
      if (!response.ok) throw new Error('Failed to load table positions');
      const data = await response.json();
      return data.positions as TablePositions;
    } catch (error) {
      console.warn('Error loading table positions from API, trying localStorage:', error);
      return this._loadFromLocalStorage<TablePositions>('tablePositions', schemaName) || {};
    }
  }

  async deleteTablePositions(schemaName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/table-positions/${schemaName}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete table positions');
    } catch (error) {
      console.error('Error deleting table positions:', error);
      this._deleteFromLocalStorage('tablePositions', schemaName);
      throw error;
    }
  }

  // ==================== BASELINE SCHEMAS ====================

  async saveBaselineSchema(schemaName: string, baselineSchema: ERDData): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineSchema }),
      });
      if (!response.ok) throw new Error('Failed to save baseline schema');
    } catch (error) {
      console.error('Error saving baseline schema:', error);
      this._saveToLocalStorage('baselineSchemas', schemaName, baselineSchema);
      throw error;
    }
  }

  async loadBaselineSchema(schemaName: string): Promise<ERDData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to load baseline schema');
      const data = await response.json();
      return data.schema as ERDData;
    } catch (error) {
      console.warn('Error loading baseline schema from API, trying localStorage:', error);
      return this._loadFromLocalStorage<ERDData>('baselineSchemas', schemaName);
    }
  }

  async deleteBaselineSchema(schemaName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/baseline-schema/${schemaName}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete baseline schema');
    } catch (error) {
      console.error('Error deleting baseline schema:', error);
      this._deleteFromLocalStorage('baselineSchemas', schemaName);
      throw error;
    }
  }

  // ==================== REAL DB HISTORY ====================

  async saveRealDbHistory(schemaName: string, history: unknown[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      if (!response.ok) throw new Error('Failed to save real DB history');
    } catch (error) {
      console.error('Error saving real DB history:', error);
      this._saveToLocalStorage('realDbHistory', schemaName, history);
      throw error;
    }
  }

  async loadRealDbHistory(schemaName: string): Promise<unknown[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`);
      if (response.status === 404) return [];
      if (!response.ok) throw new Error('Failed to load real DB history');
      const data = await response.json();
      return data.history as unknown[];
    } catch (error) {
      console.warn('Error loading real DB history from API, trying localStorage:', error);
      return this._loadFromLocalStorage<unknown[]>('realDbHistory', schemaName) || [];
    }
  }

  async deleteRealDbHistory(schemaName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/real-db-history/${schemaName}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete real DB history');
    } catch (error) {
      console.error('Error deleting real DB history:', error);
      this._deleteFromLocalStorage('realDbHistory', schemaName);
      throw error;
    }
  }

  // ==================== BULK ====================

  async clearAllForSchema(schemaName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/clear-all/${schemaName}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear all data');
    } catch (error) {
      console.error('Error clearing all data:', error);
      this._deleteFromLocalStorage('virtualSchemas', schemaName);
      this._deleteFromLocalStorage('tablePositions', schemaName);
      this._deleteFromLocalStorage('baselineSchemas', schemaName);
      this._deleteFromLocalStorage('realDbHistory', schemaName);
      throw error;
    }
  }

  async getSavedSchemas(): Promise<SavedSchema[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/persistence/schemas`);
      if (!response.ok) throw new Error('Failed to get saved schemas');
      const data = await response.json();
      return data.schemas || [];
    } catch (error) {
      console.error('Error getting saved schemas:', error);
      return [];
    }
  }

  // ==================== LOCALSTORAGE FALLBACK ====================

  private _saveToLocalStorage<T>(storageType: string, schemaName: string, data: T): void {
    try {
      const key = `reverseERD_${storageType}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[schemaName] = { data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private _loadFromLocalStorage<T>(storageType: string, schemaName: string): T | null {
    try {
      const key = `reverseERD_${storageType}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      return (stored[schemaName]?.data as T) || null;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  private _deleteFromLocalStorage(storageType: string, schemaName: string): void {
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
