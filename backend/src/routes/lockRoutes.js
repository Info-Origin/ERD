import express from 'express';
import lockService from '../services/lockService.js';

const router = express.Router();

/**
 * POST /api/locks/acquire
 * Acquire lock on a schema
 */
router.post('/acquire', async (req, res) => {
  try {
    const { schemaName, sessionId } = req.body;

    if (!schemaName || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: schemaName, sessionId'
      });
    }

    const result = await lockService.acquireLock(schemaName, sessionId);

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in acquire lock route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/locks/release
 * Release lock on a schema
 */
router.post('/release', async (req, res) => {
  try {
    const { schemaName, sessionId } = req.body;

    if (!schemaName || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: schemaName, sessionId'
      });
    }

    const result = await lockService.releaseLock(schemaName, sessionId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in release lock route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/locks/status/:schema
 * Get lock status for a schema
 */
router.get('/status/:schema', async (req, res) => {
  try {
    const { schema } = req.params;
    const result = await lockService.getLockStatus(schema);
    res.json(result);
  } catch (error) {
    console.error('Error in get lock status route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/locks/bulk-status
 * Get lock status for multiple schemas at once
 */
router.post('/bulk-status', async (req, res) => {
  try {
    const { schemaNames } = req.body;

    if (!schemaNames || !Array.isArray(schemaNames)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: schemaNames (array)'
      });
    }

    const result = await lockService.getBulkLockStatus(schemaNames);
    res.json({ locks: result });
  } catch (error) {
    console.error('Error in bulk lock status route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
