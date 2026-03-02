import express from 'express';
import persistencePool from '../config/persistenceDb.js';

const router = express.Router();

// Get all column notes for a schema
router.get('/:schemaName', async (req, res) => {
  try {
    const { schemaName } = req.params;

    const [rows] = await persistencePool.query(
      'SELECT table_name, column_name, note FROM column_notes WHERE schema_name = ?',
      [schemaName]
    );

    // Convert to object format: { tableName: { columnName: note } }
    const notes = {};
    rows.forEach(row => {
      if (!notes[row.table_name]) {
        notes[row.table_name] = {};
      }
      notes[row.table_name][row.column_name] = row.note;
    });

    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error fetching column notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get column notes for a specific table
router.get('/:schemaName/:tableName', async (req, res) => {
  try {
    const { schemaName, tableName } = req.params;

    const [rows] = await persistencePool.query(
      'SELECT column_name, note FROM column_notes WHERE schema_name = ? AND table_name = ?',
      [schemaName, tableName]
    );

    // Convert to object format: { columnName: note }
    const notes = {};
    rows.forEach(row => {
      notes[row.column_name] = row.note;
    });

    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error fetching table column notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save or update a column note
router.post('/:schemaName/:tableName/:columnName', async (req, res) => {
  try {
    const { schemaName, tableName, columnName } = req.params;
    const { note } = req.body;

    if (note === null || note === undefined || note === '') {
      // Delete note if empty
      await persistencePool.query(
        'DELETE FROM column_notes WHERE schema_name = ? AND table_name = ? AND column_name = ?',
        [schemaName, tableName, columnName]
      );
    } else {
      // Insert or update note
      await persistencePool.query(
        `INSERT INTO column_notes (schema_name, table_name, column_name, note) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE note = ?, updated_at = CURRENT_TIMESTAMP`,
        [schemaName, tableName, columnName, note, note]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving column note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a column note
router.delete('/:schemaName/:tableName/:columnName', async (req, res) => {
  try {
    const { schemaName, tableName, columnName } = req.params;

    await persistencePool.query(
      'DELETE FROM column_notes WHERE schema_name = ? AND table_name = ? AND column_name = ?',
      [schemaName, tableName, columnName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting column note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all notes for a table
router.delete('/:schemaName/:tableName', async (req, res) => {
  try {
    const { schemaName, tableName } = req.params;

    await persistencePool.query(
      'DELETE FROM column_notes WHERE schema_name = ? AND table_name = ?',
      [schemaName, tableName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting table notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
