import express from 'express';
import lockService from '../services/lockService.js';

const router = express.Router();

/**
 * POST /api/locks/acquire
 * Acquire lock on a table
 */
router.post('/acquire', async (req, res) => {
  try {
    const { schemaName, tableName, sessionId } = req.body;

    if (!schemaName || !tableName || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: schemaName, tableName, sessionId'
      });
    }

    const result = await lockService.acquireLock(schemaName, tableName, sessionId);

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in acquire lock route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/locks/release
 * Release lock on a table
 */
router.post('/release', async (req, res) => {
  try {
    const { schemaName, tableName, sessionId } = req.body;

    if (!schemaName || !tableName || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: schemaName, tableName, sessionId'
      });
    }

    const result = await lockService.releaseLock(schemaName, tableName, sessionId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in release lock route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/locks/status/:schema/:table
 * Get lock status for a specific table
 */
router.get('/status/:schema/:table', async (req, res) => {
  try {
    const { schema, table } = req.params;

    const result = await lockService.getLockStatus(schema, table);
    res.json(result);
  } catch (error) {
    console.error('Error in get lock status route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/locks/schema/:schema
 * Get all locks for a schema
 */
router.get('/schema/:schema', async (req, res) => {
  try {
    const { schema } = req.params;

    const locks = await lockService.getSchemaLocks(schema);
    res.json({ locks });
  } catch (error) {
    console.error('Error in get schema locks route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
