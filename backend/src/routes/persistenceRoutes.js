import express from 'express';
import persistenceService from '../services/persistenceService.js';

const router = express.Router();

// ==================== VIRTUAL SCHEMAS ====================

/**
 * GET /api/persistence/virtual-schema/:schemaName
 * Load virtual schema from database
 */
router.get('/virtual-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadVirtualSchema(schemaName);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Virtual schema not found' 
      });
    }
    
    res.json({ 
      success: true, 
      schema: result.schema,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error loading virtual schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/persistence/virtual-schema/:schemaName
 * Save virtual schema to database
 */
router.post('/virtual-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const { virtualSchema } = req.body;
    
    if (!virtualSchema) {
      return res.status(400).json({ 
        success: false, 
        error: 'virtualSchema is required' 
      });
    }
    
    await persistenceService.saveVirtualSchema(schemaName, virtualSchema);
    
    res.json({ 
      success: true, 
      message: 'Virtual schema saved successfully' 
    });
  } catch (error) {
    console.error('Error saving virtual schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/persistence/virtual-schema/:schemaName
 * Delete virtual schema from database
 */
router.delete('/virtual-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteVirtualSchema(schemaName);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: result.deleted ? 'Virtual schema deleted' : 'Virtual schema not found'
    });
  } catch (error) {
    console.error('Error deleting virtual schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/persistence/virtual-schema/:schemaName/timestamp
 * Get virtual schema timestamp only (for checking if newer changes exist)
 */
router.get('/virtual-schema/:schemaName/timestamp', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.getVirtualSchemaTimestamp(schemaName);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Virtual schema not found' 
      });
    }
    
    res.json({ 
      success: true, 
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error getting virtual schema timestamp:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== TABLE POSITIONS ====================

/**
 * GET /api/persistence/table-positions/:schemaName
 * Load table positions from database
 */
router.get('/table-positions/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadTablePositions(schemaName);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Table positions not found' 
      });
    }
    
    res.json({ 
      success: true, 
      positions: result.positions,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error loading table positions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/persistence/table-positions/:schemaName
 * Save table positions to database
 */
router.post('/table-positions/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const { positions } = req.body;
    
    if (!positions) {
      return res.status(400).json({ 
        success: false, 
        error: 'positions is required' 
      });
    }
    
    await persistenceService.saveTablePositions(schemaName, positions);
    
    res.json({ 
      success: true, 
      message: 'Table positions saved successfully' 
    });
  } catch (error) {
    console.error('Error saving table positions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/persistence/table-positions/:schemaName
 * Delete table positions from database
 */
router.delete('/table-positions/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteTablePositions(schemaName);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: result.deleted ? 'Table positions deleted' : 'Table positions not found'
    });
  } catch (error) {
    console.error('Error deleting table positions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== BASELINE SCHEMAS ====================

/**
 * GET /api/persistence/baseline-schema/:schemaName
 * Load baseline schema from database
 */
router.get('/baseline-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadBaselineSchema(schemaName);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Baseline schema not found' 
      });
    }
    
    res.json({ 
      success: true, 
      schema: result.schema,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error loading baseline schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/persistence/baseline-schema/:schemaName
 * Save baseline schema to database
 */
router.post('/baseline-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const { baselineSchema } = req.body;
    
    if (!baselineSchema) {
      return res.status(400).json({ 
        success: false, 
        error: 'baselineSchema is required' 
      });
    }
    
    await persistenceService.saveBaselineSchema(schemaName, baselineSchema);
    
    res.json({ 
      success: true, 
      message: 'Baseline schema saved successfully' 
    });
  } catch (error) {
    console.error('Error saving baseline schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/persistence/baseline-schema/:schemaName
 * Delete baseline schema from database
 */
router.delete('/baseline-schema/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteBaselineSchema(schemaName);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: result.deleted ? 'Baseline schema deleted' : 'Baseline schema not found'
    });
  } catch (error) {
    console.error('Error deleting baseline schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== REAL DB HISTORY ====================

/**
 * GET /api/persistence/real-db-history/:schemaName
 * Load real DB history from database
 */
router.get('/real-db-history/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.loadRealDbHistory(schemaName);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'Real DB history not found' 
      });
    }
    
    res.json({ 
      success: true, 
      history: result.history,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error loading real DB history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/persistence/real-db-history/:schemaName
 * Save real DB history to database
 */
router.post('/real-db-history/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const { history } = req.body;
    
    if (!history) {
      return res.status(400).json({ 
        success: false, 
        error: 'history is required' 
      });
    }
    
    await persistenceService.saveRealDbHistory(schemaName, history);
    
    res.json({ 
      success: true, 
      message: 'Real DB history saved successfully' 
    });
  } catch (error) {
    console.error('Error saving real DB history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/persistence/real-db-history/:schemaName
 * Delete real DB history from database
 */
router.delete('/real-db-history/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    const result = await persistenceService.deleteRealDbHistory(schemaName);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: result.deleted ? 'Real DB history deleted' : 'Real DB history not found'
    });
  } catch (error) {
    console.error('Error deleting real DB history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== BULK OPERATIONS ====================

/**
 * DELETE /api/persistence/clear-all/:schemaName
 * Clear all persistence data for a schema (reset)
 */
router.delete('/clear-all/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;
    await persistenceService.clearAllForSchema(schemaName);
    
    res.json({ 
      success: true, 
      message: 'All persistence data cleared for schema' 
    });
  } catch (error) {
    console.error('Error clearing all data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/persistence/stats
 * Get storage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await persistenceService.getStorageStats();
    
    res.json({ 
      success: true, 
      stats 
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/persistence/schemas
 * Get list of all schemas with persistence data
 */
router.get('/schemas', async (req, res) => {
  try {
    const schemas = await persistenceService.getAllVirtualSchemas();
    
    res.json({ 
      success: true, 
      schemas 
    });
  } catch (error) {
    console.error('Error getting schemas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
