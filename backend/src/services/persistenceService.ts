import persistencePool from "../config/persistenceDb.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type {
  VirtualSchemaRow,
  TablePositionsRow,
  BaselineSchemaRow,
  RealDbHistoryRow,
  TimestampRow,
  CountRow,
  SchemaListRow,
} from "../types/index.js";

class PersistenceService {
  // ==================== VIRTUAL SCHEMAS ====================

  async saveVirtualSchema(
    schemaName: string,
    virtualSchema: unknown
  ): Promise<{ success: boolean; result: ResultSetHeader }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      `INSERT INTO virtual_schemas (schema_name, virtual_schema) 
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE 
       virtual_schema = VALUES(virtual_schema),
       updated_at = CURRENT_TIMESTAMP`,
      [schemaName, JSON.stringify(virtualSchema)]
    );
    return { success: true, result };
  }

  async loadVirtualSchema(
    schemaName: string
  ): Promise<{ schema: string; timestamp: Date } | null> {
    const [rows] = await persistencePool.execute<
      (VirtualSchemaRow & RowDataPacket)[]
    >(
      "SELECT virtual_schema, updated_at FROM virtual_schemas WHERE schema_name = ?",
      [schemaName]
    );
    if (rows.length === 0) return null;
    return { schema: rows[0].virtual_schema, timestamp: rows[0].updated_at };
  }

  async deleteVirtualSchema(
    schemaName: string
  ): Promise<{ success: boolean; deleted: boolean }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      "DELETE FROM virtual_schemas WHERE schema_name = ?",
      [schemaName]
    );
    return { success: true, deleted: result.affectedRows > 0 };
  }

  async getVirtualSchemaTimestamp(
    schemaName: string
  ): Promise<{ timestamp: number } | null> {
    const [rows] = await persistencePool.execute<
      (TimestampRow & RowDataPacket)[]
    >(
      "SELECT UNIX_TIMESTAMP(updated_at) * 1000 as timestamp FROM virtual_schemas WHERE schema_name = ?",
      [schemaName]
    );
    if (rows.length === 0) return null;
    return { timestamp: rows[0].timestamp };
  }

  async getAllVirtualSchemas(): Promise<SchemaListRow[]> {
    const [rows] = await persistencePool.execute<
      (SchemaListRow & RowDataPacket)[]
    >(
      "SELECT schema_name, updated_at FROM virtual_schemas ORDER BY schema_name ASC"
    );
    return rows;
  }

  // ==================== TABLE POSITIONS ====================

  async saveTablePositions(
    schemaName: string,
    positions: unknown
  ): Promise<{ success: boolean; result: ResultSetHeader }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      `INSERT INTO table_positions (schema_name, positions) 
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE 
       positions = VALUES(positions),
       updated_at = CURRENT_TIMESTAMP`,
      [schemaName, JSON.stringify(positions)]
    );
    return { success: true, result };
  }

  async loadTablePositions(
    schemaName: string
  ): Promise<{ positions: string; timestamp: Date } | null> {
    const [rows] = await persistencePool.execute<
      (TablePositionsRow & RowDataPacket)[]
    >(
      "SELECT positions, updated_at FROM table_positions WHERE schema_name = ?",
      [schemaName]
    );
    if (rows.length === 0) return null;
    return { positions: rows[0].positions, timestamp: rows[0].updated_at };
  }

  async deleteTablePositions(
    schemaName: string
  ): Promise<{ success: boolean; deleted: boolean }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      "DELETE FROM table_positions WHERE schema_name = ?",
      [schemaName]
    );
    return { success: true, deleted: result.affectedRows > 0 };
  }

  // ==================== BASELINE SCHEMAS ====================

  async saveBaselineSchema(
    schemaName: string,
    baselineSchema: unknown
  ): Promise<{ success: boolean; result: ResultSetHeader }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      `INSERT INTO baseline_schemas (schema_name, baseline_schema) 
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE 
       baseline_schema = VALUES(baseline_schema),
       updated_at = CURRENT_TIMESTAMP`,
      [schemaName, JSON.stringify(baselineSchema)]
    );
    return { success: true, result };
  }

  async loadBaselineSchema(
    schemaName: string
  ): Promise<{ schema: string; timestamp: Date } | null> {
    const [rows] = await persistencePool.execute<
      (BaselineSchemaRow & RowDataPacket)[]
    >(
      "SELECT baseline_schema, updated_at FROM baseline_schemas WHERE schema_name = ?",
      [schemaName]
    );
    if (rows.length === 0) return null;
    return { schema: rows[0].baseline_schema, timestamp: rows[0].updated_at };
  }

  async deleteBaselineSchema(
    schemaName: string
  ): Promise<{ success: boolean; deleted: boolean }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      "DELETE FROM baseline_schemas WHERE schema_name = ?",
      [schemaName]
    );
    return { success: true, deleted: result.affectedRows > 0 };
  }

  // ==================== REAL DB HISTORY ====================

  async saveRealDbHistory(
    schemaName: string,
    history: unknown
  ): Promise<{ success: boolean; result: ResultSetHeader }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      `INSERT INTO real_db_history (schema_name, history) 
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE 
       history = VALUES(history),
       updated_at = CURRENT_TIMESTAMP`,
      [schemaName, JSON.stringify(history)]
    );
    return { success: true, result };
  }

  async loadRealDbHistory(
    schemaName: string
  ): Promise<{ history: string; timestamp: Date } | null> {
    const [rows] = await persistencePool.execute<
      (RealDbHistoryRow & RowDataPacket)[]
    >(
      "SELECT history, updated_at FROM real_db_history WHERE schema_name = ?",
      [schemaName]
    );
    if (rows.length === 0) return null;
    return { history: rows[0].history, timestamp: rows[0].updated_at };
  }

  async deleteRealDbHistory(
    schemaName: string
  ): Promise<{ success: boolean; deleted: boolean }> {
    const [result] = await persistencePool.execute<ResultSetHeader>(
      "DELETE FROM real_db_history WHERE schema_name = ?",
      [schemaName]
    );
    return { success: true, deleted: result.affectedRows > 0 };
  }

  // ==================== BULK OPERATIONS ====================

  async clearAllForSchema(schemaName: string): Promise<{ success: boolean }> {
    await Promise.all([
      this.deleteVirtualSchema(schemaName),
      this.deleteTablePositions(schemaName),
      this.deleteBaselineSchema(schemaName),
      this.deleteRealDbHistory(schemaName),
    ]);
    return { success: true };
  }

  async getStorageStats(): Promise<{
    virtualSchemas: number;
    tablePositions: number;
    baselineSchemas: number;
    realDbHistory: number;
  }> {
    const [virtualCount] = await persistencePool.execute<
      (CountRow & RowDataPacket)[]
    >("SELECT COUNT(*) as count FROM virtual_schemas");
    const [positionsCount] = await persistencePool.execute<
      (CountRow & RowDataPacket)[]
    >("SELECT COUNT(*) as count FROM table_positions");
    const [baselineCount] = await persistencePool.execute<
      (CountRow & RowDataPacket)[]
    >("SELECT COUNT(*) as count FROM baseline_schemas");
    const [historyCount] = await persistencePool.execute<
      (CountRow & RowDataPacket)[]
    >("SELECT COUNT(*) as count FROM real_db_history");

    return {
      virtualSchemas: virtualCount[0].count,
      tablePositions: positionsCount[0].count,
      baselineSchemas: baselineCount[0].count,
      realDbHistory: historyCount[0].count,
    };
  }
}

export default new PersistenceService();
