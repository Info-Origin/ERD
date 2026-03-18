import connectionManager from "../config/dynamicConnectionManager.js";
import { buildSchemaModel } from "../utils/erdMapper.js";
import type {
  TablesMap,
  Relationship,
  RelationType,
  SchemaModel,
} from "../types/index.js";
import type { RowDataPacket } from "mysql2";

interface SchemaRow extends RowDataPacket {
  schema_name: string;
}

interface ColumnRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_KEY: string;
  COLUMN_TYPE: string;
  EXTRA: string;
  ORDINAL_POSITION: number;
}

interface CompositeKeyRow extends RowDataPacket {
  TABLE_NAME: string;
  pk_column_count: number;
}

interface FKRow extends RowDataPacket {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  constraint_name: string;
  update_rule: string | null;
  delete_rule: string | null;
}

interface PKRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
}

interface UniqueRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  CONSTRAINT_NAME: string;
}

export const getSchemas = async (connectionId: string): Promise<string[]> => {
  const pool = connectionManager.getPool(connectionId);
  const query = `
    SELECT SCHEMA_NAME AS schema_name
    FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')
    ORDER BY SCHEMA_NAME;
  `;
  const [rows] = await pool.query<SchemaRow[]>(query);
  return rows.map((r) => r.schema_name);
};

export const getTablesAndColumns = async (
  connectionId: string,
  schemaName: string
): Promise<TablesMap> => {
  const pool = connectionManager.getPool(connectionId);

  const query = `
    SELECT
      t.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.IS_NULLABLE,
      c.COLUMN_KEY,
      c.COLUMN_TYPE,
      c.EXTRA,
      c.ORDINAL_POSITION
    FROM information_schema.TABLES t
    JOIN information_schema.COLUMNS c
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
     AND t.TABLE_NAME = c.TABLE_NAME
    WHERE t.TABLE_SCHEMA = ?
    ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
  `;
  const [rows] = await pool.query<ColumnRow[]>(query, [schemaName]);

  const compositeKeyQuery = `
    SELECT TABLE_NAME, COUNT(*) as pk_column_count
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'
    GROUP BY TABLE_NAME
    HAVING COUNT(*) > 1;
  `;
  const [compositeKeyRows] = await pool.query<CompositeKeyRow[]>(
    compositeKeyQuery,
    [schemaName]
  );

  const tablesWithCompositeKeys = new Set(
    compositeKeyRows.map((row) => row.TABLE_NAME)
  );

  const tables: TablesMap = {};
  for (const row of rows) {
    const tableName = row.TABLE_NAME;
    if (!tables[tableName]) {
      tables[tableName] = { name: tableName, columns: {} };
    }

    const isPk = row.COLUMN_KEY === "PRI";
    const isUnique = row.COLUMN_KEY === "UNI";
    const nullable = row.IS_NULLABLE === "YES";
    const autoIncrement =
      row.EXTRA && row.EXTRA.toLowerCase().includes("auto_increment");
    const isCompositeKey = isPk && tablesWithCompositeKeys.has(tableName);
    const displayType = row.COLUMN_TYPE
      ? row.COLUMN_TYPE.toUpperCase()
      : row.DATA_TYPE.toUpperCase();

    tables[tableName].columns[row.COLUMN_NAME] = {
      type: displayType,
      columnType: row.COLUMN_TYPE,
      pk: !!isPk,
      compositeKey: !!isCompositeKey,
      unique: !!isUnique,
      nullable,
      autoIncrement: !!autoIncrement,
      ordinalPosition: row.ORDINAL_POSITION,
    };
  }

  return tables;
};

export const getRelationships = async (
  connectionId: string,
  schemaName: string
): Promise<Relationship[]> => {
  const pool = connectionManager.getPool(connectionId);

  const query = `
    SELECT
      kcu.TABLE_NAME AS from_table,
      kcu.COLUMN_NAME AS from_column,
      kcu.REFERENCED_TABLE_NAME AS to_table,
      kcu.REFERENCED_COLUMN_NAME AS to_column,
      kcu.CONSTRAINT_NAME AS constraint_name,
      rc.UPDATE_RULE AS update_rule,
      rc.DELETE_RULE AS delete_rule
    FROM information_schema.KEY_COLUMN_USAGE kcu
    LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE kcu.TABLE_SCHEMA = ?
      AND kcu.REFERENCED_TABLE_SCHEMA = ?
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;
  `;
  const [rows] = await pool.query<FKRow[]>(query, [schemaName, schemaName]);

  const pkQuery = `
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'
  `;
  const [pkRows] = await pool.query<PKRow[]>(pkQuery, [schemaName]);

  const uniqueQuery = `
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ?
      AND CONSTRAINT_NAME != 'PRIMARY'
      AND CONSTRAINT_NAME LIKE 'UNI%' OR CONSTRAINT_NAME LIKE '%unique%'
    UNION
    SELECT c.TABLE_NAME, c.COLUMN_NAME, 'UNIQUE' as CONSTRAINT_NAME
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = ? AND c.COLUMN_KEY = 'UNI'
  `;
  const [uniqueRows] = await pool.query<UniqueRow[]>(uniqueQuery, [
    schemaName,
    schemaName,
  ]);

  const primaryKeys = new Set<string>();
  pkRows.forEach((row) => primaryKeys.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`));

  const uniqueColumns = new Set<string>();
  uniqueRows.forEach((row) =>
    uniqueColumns.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`)
  );

  const junctionTables = new Set<string>();
  const tableForeignKeys: Record<
    string,
    { column: string; referencedTable: string; referencedColumn: string }[]
  > = {};

  rows.forEach((row) => {
    if (!tableForeignKeys[row.from_table]) {
      tableForeignKeys[row.from_table] = [];
    }
    tableForeignKeys[row.from_table].push({
      column: row.from_column,
      referencedTable: row.to_table,
      referencedColumn: row.to_column,
    });
  });

  Object.entries(tableForeignKeys).forEach(([tableName, foreignKeys]) => {
    if (foreignKeys.length === 2) {
      const fk1IsPk = primaryKeys.has(`${tableName}.${foreignKeys[0].column}`);
      const fk2IsPk = primaryKeys.has(`${tableName}.${foreignKeys[1].column}`);
      if (fk1IsPk && fk2IsPk) junctionTables.add(tableName);
    }
  });

  return rows.map((row) => {
    const fkColumnKey = `${row.from_table}.${row.from_column}`;
    const isIdentifying = primaryKeys.has(fkColumnKey);

    let relationType: RelationType = "ONE_TO_MANY";
    let cardinalityType = "1:N";

    if (junctionTables.has(row.from_table)) {
      relationType = "ONE_TO_MANY";
      cardinalityType = "1:N";
    } else if (isIdentifying) {
      relationType = "ONE_TO_ONE";
      cardinalityType = "1:1";
    } else if (uniqueColumns.has(fkColumnKey)) {
      relationType = "ONE_TO_ONE_UNIQUE";
      cardinalityType = "1:1*";
    }

    return {
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column,
      constraintName: row.constraint_name,
      updateRule: row.update_rule || "RESTRICT",
      deleteRule: row.delete_rule || "RESTRICT",
      type: relationType,
      cardinalityType,
      isIdentifying,
      isUnique: uniqueColumns.has(fkColumnKey),
      isJunctionTable: junctionTables.has(row.from_table),
    };
  });
};

export const getSchemaErd = async (
  connectionId: string,
  schemaName: string
): Promise<SchemaModel> => {
  const tables = await getTablesAndColumns(connectionId, schemaName);
  const relationships = await getRelationships(connectionId, schemaName);

  relationships.forEach((rel) => {
    if (tables[rel.fromTable]?.columns[rel.fromColumn]) {
      tables[rel.fromTable].columns[rel.fromColumn].fk = true;
      const column = tables[rel.fromTable].columns[rel.fromColumn];
      if (column.pk) column.isPkAndFk = true;
    }
  });

  return buildSchemaModel({ schemaName, tables, relationships });
};
