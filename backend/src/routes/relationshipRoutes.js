import express from 'express';
import db from '../config/db.js';

const router = express.Router();

/**
 * DELETE /api/schemas/:schemaName/relationships
 * Delete user-created relationships (FK constraints and columns)
 */
router.delete('/:schemaName/relationships', async (req, res) => {
  const { schemaName } = req.params;
  const { relationships } = req.body;

  if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
    return res.status(400).json({ error: 'Relationships array is required' });
  }

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const results = [];

    for (const rel of relationships) {
      const { fromTable, fromColumn, toTable, toColumn } = rel;

      if (!fromTable || !fromColumn || !toTable || !toColumn) {
        throw new Error('Invalid relationship data: missing required fields');
      }

      // Only allow deletion of user-created relationships
      if (!rel.isUserCreated) {
        throw new Error(`Cannot delete database-existing relationship: ${fromTable}.${fromColumn} -> ${toTable}.${toColumn}`);
      }

      // Step 1: Find the FK constraint name
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
          AND REFERENCED_TABLE_SCHEMA = ?
          AND REFERENCED_TABLE_NAME = ?
          AND REFERENCED_COLUMN_NAME = ?
      `, [schemaName, fromTable, fromColumn, schemaName, toTable, toColumn]);

      if (constraints.length === 0) {
        console.warn(`No FK constraint found for ${fromTable}.${fromColumn} -> ${toTable}.${toColumn}`);
        continue;
      }

      const constraintName = constraints[0].CONSTRAINT_NAME;

      // Step 2: Drop the foreign key constraint
      await connection.query(`
        ALTER TABLE \`${schemaName}\`.\`${fromTable}\`
        DROP FOREIGN KEY \`${constraintName}\`
      `);

      // Step 3: Drop the FK column
      await connection.query(`
        ALTER TABLE \`${schemaName}\`.\`${fromTable}\`
        DROP COLUMN \`${fromColumn}\`
      `);

      results.push({
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        constraintName,
        status: 'deleted'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: `${results.length} relationship(s) deleted successfully`,
      results
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error deleting relationships:', error);
    res.status(500).json({
      error: 'Failed to delete relationships',
      message: error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/schemas/:schemaName/relationships/restore
 * Restore deleted relationships (undo feature)
 */
router.post('/:schemaName/relationships/restore', async (req, res) => {
  const { schemaName } = req.params;
  const { relationships } = req.body;

  if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
    return res.status(400).json({ error: 'Relationships array is required' });
  }

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const results = [];

    for (const rel of relationships) {
      const { fromTable, fromColumn, toTable, toColumn, cardinalityType, isIdentifying } = rel;

      if (!fromTable || !fromColumn || !toTable || !toColumn) {
        throw new Error('Invalid relationship data: missing required fields');
      }

      // Step 1: Get the data type of the referenced column
      const [refColumns] = await connection.query(`
        SELECT COLUMN_TYPE, IS_NULLABLE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `, [schemaName, toTable, toColumn]);

      if (refColumns.length === 0) {
        throw new Error(`Referenced column ${toTable}.${toColumn} not found`);
      }

      const columnType = refColumns[0].COLUMN_TYPE;
      const nullable = isIdentifying ? 'NOT NULL' : 'NULL';

      // Step 2: Re-add the FK column
      await connection.query(`
        ALTER TABLE \`${schemaName}\`.\`${fromTable}\`
        ADD COLUMN \`${fromColumn}\` ${columnType} ${nullable}
      `);

      // Step 3: Re-create the foreign key constraint
      const constraintName = `fk_${fromTable}_${toTable}_${fromColumn}`.substring(0, 64);
      
      await connection.query(`
        ALTER TABLE \`${schemaName}\`.\`${fromTable}\`
        ADD CONSTRAINT \`${constraintName}\`
        FOREIGN KEY (\`${fromColumn}\`)
        REFERENCES \`${schemaName}\`.\`${toTable}\` (\`${toColumn}\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
      `);

      results.push({
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        constraintName,
        status: 'restored'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: `${results.length} relationship(s) restored successfully`,
      results
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error restoring relationships:', error);
    res.status(500).json({
      error: 'Failed to restore relationships',
      message: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
