import pool from "../config/db.js";
import { buildSchemaModel } from "../utils/erdMapper.js";

export const getSchemas = async () => {
  const query = `
    SELECT SCHEMA_NAME AS schema_name
    FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')
    ORDER BY SCHEMA_NAME;
  `;
  const [rows] = await pool.query(query);
  return rows.map((r) => r.schema_name);
};

export const getTablesAndColumns = async (schemaName) => {
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
  const [rows] = await pool.query(query, [schemaName]);

  // Get composite key information
  const compositeKeyQuery = `
    SELECT 
      TABLE_NAME,
      COUNT(*) as pk_column_count
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? 
      AND CONSTRAINT_NAME = 'PRIMARY'
    GROUP BY TABLE_NAME
    HAVING COUNT(*) > 1;
  `;
  const [compositeKeyRows] = await pool.query(compositeKeyQuery, [schemaName]);
  
  // Create a set of tables that have composite keys
  const tablesWithCompositeKeys = new Set(
    compositeKeyRows.map(row => row.TABLE_NAME)
  );

  const tables = {};
  for (const row of rows) {
    const tableName = row.TABLE_NAME;
    if (!tables[tableName]) {
      tables[tableName] = {
        name: tableName,
        columns: {},
      };
    }

    const isPk = row.COLUMN_KEY === "PRI";
    const isUnique = row.COLUMN_KEY === "UNI";
    const nullable = row.IS_NULLABLE === "YES";
    const autoIncrement = row.EXTRA && row.EXTRA.toLowerCase().includes('auto_increment');
    
    // Determine if this PK column is part of a composite key
    const isCompositeKey = isPk && tablesWithCompositeKeys.has(tableName);

    // Use COLUMN_TYPE for complete type info (e.g., varchar(255), int(11), json)
    // Convert to uppercase for consistency with frontend expectations
    const displayType = row.COLUMN_TYPE ? row.COLUMN_TYPE.toUpperCase() : row.DATA_TYPE.toUpperCase();
    
    tables[tableName].columns[row.COLUMN_NAME] = {
      type: displayType,
      columnType: row.COLUMN_TYPE,
      pk: !!isPk,
      compositeKey: !!isCompositeKey, // New field for composite key detection
      unique: !!isUnique,
      nullable,
      autoIncrement: !!autoIncrement,
      ordinalPosition: row.ORDINAL_POSITION,
    };
  }

  return tables;
};

export const getRelationships = async (schemaName) => {
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
  const [rows] = await pool.query(query, [schemaName, schemaName]);

  // Get primary key information to determine identifying relationships
  const pkQuery = `
    SELECT 
      TABLE_NAME,
      COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? 
      AND CONSTRAINT_NAME = 'PRIMARY'
  `;
  const [pkRows] = await pool.query(pkQuery, [schemaName]);
  
  // Get unique constraint information for 1:1 detection
  const uniqueQuery = `
    SELECT 
      TABLE_NAME,
      COLUMN_NAME,
      CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? 
      AND CONSTRAINT_NAME != 'PRIMARY'
      AND CONSTRAINT_NAME LIKE 'UNI%' OR CONSTRAINT_NAME LIKE '%unique%'
    UNION
    SELECT 
      c.TABLE_NAME,
      c.COLUMN_NAME,
      'UNIQUE' as CONSTRAINT_NAME
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = ?
      AND c.COLUMN_KEY = 'UNI'
  `;
  const [uniqueRows] = await pool.query(uniqueQuery, [schemaName, schemaName]);
  
  // Create sets for quick lookup
  const primaryKeys = new Set();
  pkRows.forEach(row => {
    primaryKeys.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`);
  });
  
  const uniqueColumns = new Set();
  uniqueRows.forEach(row => {
    uniqueColumns.add(`${row.TABLE_NAME}.${row.COLUMN_NAME}`);
  });

  // Detect junction tables for many-to-many relationships
  const junctionTables = new Set();
  const tableForeignKeys = {};
  
  // Group foreign keys by table
  rows.forEach(row => {
    if (!tableForeignKeys[row.from_table]) {
      tableForeignKeys[row.from_table] = [];
    }
    tableForeignKeys[row.from_table].push({
      column: row.from_column,
      referencedTable: row.to_table,
      referencedColumn: row.to_column
    });
  });
  
  // A junction table has exactly 2 foreign keys and they form the primary key
  Object.entries(tableForeignKeys).forEach(([tableName, foreignKeys]) => {
    if (foreignKeys.length === 2) {
      // Check if both FK columns are also PK columns (composite key)
      const fk1IsPk = primaryKeys.has(`${tableName}.${foreignKeys[0].column}`);
      const fk2IsPk = primaryKeys.has(`${tableName}.${foreignKeys[1].column}`);
      
      if (fk1IsPk && fk2IsPk) {
        junctionTables.add(tableName);
      }
    }
  });

  const relationships = rows.map((row) => {
    // Determine if this is an identifying relationship
    const fkColumnKey = `${row.from_table}.${row.from_column}`;
    const isIdentifying = primaryKeys.has(fkColumnKey);
    
    // Determine relationship cardinality
    let relationType = "ONE_TO_MANY"; // Default
    let cardinalityType = "1:N"; // Default display
    
    // Special handling for junction tables
    if (junctionTables.has(row.from_table)) {
      // For junction tables, the relationship to parent tables should be shown as N:M
      // This represents the conceptual many-to-many relationship
      relationType = "MANY_TO_MANY";
      cardinalityType = "N:M";
    }
    // Check for 1:1 relationships (non-junction tables)
    else if (isIdentifying) {
      // FK is also PK - this is 1:1 identifying
      relationType = "ONE_TO_ONE";
      cardinalityType = "1:1";
    }
    else if (uniqueColumns.has(fkColumnKey)) {
      // FK has unique constraint - this is 1:1 non-identifying
      relationType = "ONE_TO_ONE_UNIQUE";
      cardinalityType = "1:1*"; // Special notation for unique FK
    }

    return {
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column,
      constraintName: row.constraint_name,
      updateRule: row.update_rule || 'RESTRICT',
      deleteRule: row.delete_rule || 'RESTRICT',
      type: relationType,
      cardinalityType: cardinalityType,
      isIdentifying: isIdentifying,
      isUnique: uniqueColumns.has(fkColumnKey),
      isJunctionTable: junctionTables.has(row.from_table),
    };
  });

  return relationships;
};

export const getSchemaErd = async (schemaName) => {
  const tables = await getTablesAndColumns(schemaName);
  const relationships = await getRelationships(schemaName);
  
  // Mark FK columns based on relationships
  // Important: A column should show FK badge when it's referencing another table,
  // even if it's also a PK in its own table
  relationships.forEach((rel) => {
    if (tables[rel.fromTable] && tables[rel.fromTable].columns[rel.fromColumn]) {
      // Mark as FK in the referencing table (fromTable)
      tables[rel.fromTable].columns[rel.fromColumn].fk = true;
      
      // If this column is also a PK in the same table, we need to decide display priority
      // For display purposes, FK should take precedence when the column is referencing another table
      const column = tables[rel.fromTable].columns[rel.fromColumn];
      if (column.pk) {
        // This is a PK that also serves as FK - mark it specially
        column.isPkAndFk = true;
      }
    }
  });
  
  const erdModel = buildSchemaModel({ schemaName, tables, relationships });
  
  return erdModel;
};
