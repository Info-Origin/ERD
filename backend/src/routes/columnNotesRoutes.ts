import express from "express";
import type { Request, Response } from "express";
import persistencePool from "../config/persistenceDb.js";
import type { RowDataPacket } from "mysql2";

const router = express.Router();

interface ColumnNoteRow extends RowDataPacket {
  table_name: string;
  column_name: string;
  note: string;
}

interface ColumnNoteSimpleRow extends RowDataPacket {
  column_name: string;
  note: string;
}

router.get("/:schemaName", async (req: Request, res: Response) => {
  try {
    const { schemaName } = req.params;
    const [rows] = await persistencePool.query<ColumnNoteRow[]>(
      "SELECT table_name, column_name, note FROM column_notes WHERE schema_name = ?",
      [schemaName]
    );

    const notes: Record<string, Record<string, string>> = {};
    rows.forEach((row) => {
      if (!notes[row.table_name]) notes[row.table_name] = {};
      notes[row.table_name][row.column_name] = row.note;
    });

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/:schemaName/:tableName", async (req: Request, res: Response) => {
  try {
    const { schemaName, tableName } = req.params;
    const [rows] = await persistencePool.query<ColumnNoteSimpleRow[]>(
      "SELECT column_name, note FROM column_notes WHERE schema_name = ? AND table_name = ?",
      [schemaName, tableName]
    );

    const notes: Record<string, string> = {};
    rows.forEach((row) => {
      notes[row.column_name] = row.note;
    });

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/:schemaName/:tableName/:columnName", async (req: Request, res: Response) => {
  try {
    const { schemaName, tableName, columnName } = req.params;
    const { note } = req.body as { note?: string };

    if (note === null || note === undefined || note === "") {
      await persistencePool.query(
        "DELETE FROM column_notes WHERE schema_name = ? AND table_name = ? AND column_name = ?",
        [schemaName, tableName, columnName]
      );
    } else {
      await persistencePool.query(
        `INSERT INTO column_notes (schema_name, table_name, column_name, note) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE note = ?, updated_at = CURRENT_TIMESTAMP`,
        [schemaName, tableName, columnName, note, note]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/:schemaName/:tableName/:columnName", async (req: Request, res: Response) => {
  try {
    const { schemaName, tableName, columnName } = req.params;
    await persistencePool.query(
      "DELETE FROM column_notes WHERE schema_name = ? AND table_name = ? AND column_name = ?",
      [schemaName, tableName, columnName]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/:schemaName/:tableName", async (req: Request, res: Response) => {
  try {
    const { schemaName, tableName } = req.params;
    await persistencePool.query(
      "DELETE FROM column_notes WHERE schema_name = ? AND table_name = ?",
      [schemaName, tableName]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
