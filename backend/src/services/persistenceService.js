import persistencePool from '../config/persistenceDb.js';

/**
 * Persistence Service
 * Handles all database operations for virtual schema persistence
 */

class PersistenceService {
  // ==================== VIRTUAL SCHEMAS ====================
  
  /**
   * Save virtual schema to database
   */
  async saveVirtualSchema(schemaName, virtualSchema) {
    try {
      const [result] = await persistencePool.execute(
        `INSERT INTO virtual_schemas (schema_name, virtual_schema) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE 
         virtual_schema = VALUES(virtual_schema),
         updated_at = CURRENT_TIMESTAMP`,
        [schemaName, JSON.stringify(virtualSchema)]
      );
      return { success: true, result };
    } catch (error) {
      console.error('Error saving virtual schema:', error);
      throw error;
    }
  }

  /**
   * Load virtual schema from database
   */
  async loadVirtualSchema(schemaName) {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT virtual_schema, updated_at FROM virtual_schemas WHERE schema_name = ?',
        [schemaName]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return {
        schema: rows[0].virtual_schema,
        timestamp: rows[0].updated_at
      };
    } catch (error) {
      console.error('Error loading virtual schema:', error);
      throw error;
    }
  }

  /**
   * Delete virtual schema from database
   */
  async deleteVirtualSchema(schemaName) {
    try {
      const [result] = await persistencePool.execute(
        'DELETE FROM virtual_schemas WHERE schema_name = ?',
        [schemaName]
      );
      return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error deleting virtual schema:', error);
      throw error;
    }
  }

  /**
   * Get virtual schema timestamp only (for checking if newer changes exist)
   */
  async getVirtualSchemaTimestamp(schemaName) {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT UNIX_TIMESTAMP(updated_at) * 1000 as timestamp FROM virtual_schemas WHERE schema_name = ?',
        [schemaName]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return {
        timestamp: rows[0].timestamp
      };
    } catch (error) {
      console.error('Error getting virtual schema timestamp:', error);
      throw error;
    }
  }

  /**
   * Get all virtual schemas (for admin/debugging)
   */
  async getAllVirtualSchemas() {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT schema_name, updated_at FROM virtual_schemas ORDER BY updated_at DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all virtual schemas:', error);
      throw error;
    }
  }

  // ==================== TABLE POSITIONS ====================
  
  /**
   * Save table positions to database
   */
  async saveTablePositions(schemaName, positions) {
    try {
      const [result] = await persistencePool.execute(
        `INSERT INTO table_positions (schema_name, positions) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE 
         positions = VALUES(positions),
         updated_at = CURRENT_TIMESTAMP`,
        [schemaName, JSON.stringify(positions)]
      );
      return { success: true, result };
    } catch (error) {
      console.error('Error saving table positions:', error);
      throw error;
    }
  }

  /**
   * Load table positions from database
   */
  async loadTablePositions(schemaName) {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT positions, updated_at FROM table_positions WHERE schema_name = ?',
        [schemaName]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return {
        positions: rows[0].positions,
        timestamp: rows[0].updated_at
      };
    } catch (error) {
      console.error('Error loading table positions:', error);
      throw error;
    }
  }

  /**
   * Delete table positions from database
   */
  async deleteTablePositions(schemaName) {
    try {
      const [result] = await persistencePool.execute(
        'DELETE FROM table_positions WHERE schema_name = ?',
        [schemaName]
      );
      return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error deleting table positions:', error);
      throw error;
    }
  }

  // ==================== BASELINE SCHEMAS ====================
  
  /**
   * Save baseline schema to database
   */
  async saveBaselineSchema(schemaName, baselineSchema) {
    try {
      const [result] = await persistencePool.execute(
        `INSERT INTO baseline_schemas (schema_name, baseline_schema) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE 
         baseline_schema = VALUES(baseline_schema),
         updated_at = CURRENT_TIMESTAMP`,
        [schemaName, JSON.stringify(baselineSchema)]
      );
      return { success: true, result };
    } catch (error) {
      console.error('Error saving baseline schema:', error);
      throw error;
    }
  }

  /**
   * Load baseline schema from database
   */
  async loadBaselineSchema(schemaName) {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT baseline_schema, updated_at FROM baseline_schemas WHERE schema_name = ?',
        [schemaName]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return {
        schema: rows[0].baseline_schema,
        timestamp: rows[0].updated_at
      };
    } catch (error) {
      console.error('Error loading baseline schema:', error);
      throw error;
    }
  }

  /**
   * Delete baseline schema from database
   */
  async deleteBaselineSchema(schemaName) {
    try {
      const [result] = await persistencePool.execute(
        'DELETE FROM baseline_schemas WHERE schema_name = ?',
        [schemaName]
      );
      return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error deleting baseline schema:', error);
      throw error;
    }
  }

  // ==================== REAL DB HISTORY ====================
  
  /**
   * Save real DB history to database
   */
  async saveRealDbHistory(schemaName, history) {
    try {
      const [result] = await persistencePool.execute(
        `INSERT INTO real_db_history (schema_name, history) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE 
         history = VALUES(history),
         updated_at = CURRENT_TIMESTAMP`,
        [schemaName, JSON.stringify(history)]
      );
      return { success: true, result };
    } catch (error) {
      console.error('Error saving real DB history:', error);
      throw error;
    }
  }

  /**
   * Load real DB history from database
   */
  async loadRealDbHistory(schemaName) {
    try {
      const [rows] = await persistencePool.execute(
        'SELECT history, updated_at FROM real_db_history WHERE schema_name = ?',
        [schemaName]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return {
        history: rows[0].history,
        timestamp: rows[0].updated_at
      };
    } catch (error) {
      console.error('Error loading real DB history:', error);
      throw error;
    }
  }

  /**
   * Delete real DB history from database
   */
  async deleteRealDbHistory(schemaName) {
    try {
      const [result] = await persistencePool.execute(
        'DELETE FROM real_db_history WHERE schema_name = ?',
        [schemaName]
      );
      return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error deleting real DB history:', error);
      throw error;
    }
  }

  // ==================== BULK OPERATIONS ====================
  
  /**
   * Clear all data for a specific schema (reset)
   */
  async clearAllForSchema(schemaName) {
    try {
      await Promise.all([
        this.deleteVirtualSchema(schemaName),
        this.deleteTablePositions(schemaName),
        this.deleteBaselineSchema(schemaName),
        this.deleteRealDbHistory(schemaName)
      ]);
      return { success: true };
    } catch (error) {
      console.error('Error clearing all data for schema:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      const [virtualCount] = await persistencePool.execute(
        'SELECT COUNT(*) as count FROM virtual_schemas'
      );
      const [positionsCount] = await persistencePool.execute(
        'SELECT COUNT(*) as count FROM table_positions'
      );
      const [baselineCount] = await persistencePool.execute(
        'SELECT COUNT(*) as count FROM baseline_schemas'
      );
      const [historyCount] = await persistencePool.execute(
        'SELECT COUNT(*) as count FROM real_db_history'
      );
      
      return {
        virtualSchemas: virtualCount[0].count,
        tablePositions: positionsCount[0].count,
        baselineSchemas: baselineCount[0].count,
        realDbHistory: historyCount[0].count
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
}

export default new PersistenceService();
