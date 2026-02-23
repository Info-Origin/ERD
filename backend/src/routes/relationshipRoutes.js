import express from 'express';
import db from '../config/db.js';

const router = express.Router();

/**
 * DELETE /api/schemas/:schemaName/relationships
 * Delete user-created relationships (VIRTUAL ONLY - no real DB changes)
 * This endpoint only validates the request and returns success.
 * The actual deletion happens in the frontend's virtual schema.
 */
router.delete('/:schemaName/relationships', async (req, res) => {
  const { schemaName } = req.params;
  const { relationships, junctionTables } = req.body;

  if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
    return res.status(400).json({ error: 'Relationships array is required' });
  }

  try {
    const results = [];

    // Validate that all relationships are user-created (no DB modifications allowed)
    for (const rel of relationships) {
      const { fromTable, fromColumn, toTable, toColumn } = rel;

      if (!fromTable || !fromColumn || !toTable || !toColumn) {
        throw new Error('Invalid relationship data: missing required fields');
      }

      // Only allow deletion of user-created relationships
      if (!rel.isUserCreated && !rel.isJunctionRelationship) {
        throw new Error(`Cannot delete database-existing relationship: ${fromTable}.${fromColumn} -> ${toTable}.${toColumn}`);
      }

      results.push({
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        status: 'deleted_virtually'
      });
    }

    // Add junction table deletions to results (virtual only)
    if (junctionTables && Array.isArray(junctionTables) && junctionTables.length > 0) {
      for (const junctionTable of junctionTables) {
        results.push({
          table: junctionTable,
          status: 'junction_table_deleted_virtually'
        });
      }
    }

    // Return success - frontend will handle virtual deletion
    res.json({
      success: true,
      message: `${results.length} item(s) deleted virtually (no database changes)`,
      results,
      virtual: true // Flag to indicate this was a virtual operation
    });

  } catch (error) {
    console.error('Error validating relationship deletion:', error);
    res.status(500).json({
      error: 'Failed to delete relationships',
      message: error.message
    });
  }
});

export default router;
