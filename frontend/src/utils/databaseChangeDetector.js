/**
 * Database Change Detector
 * Compares baseline schema with current real database schema
 * Detects all types of changes: tables, columns, relationships, constraints
 */

/**
 * Main function to detect all database changes
 * @param {Object} baselineSchema - Last known state of database
 * @param {Object} currentSchema - Current state of database
 * @returns {Object} Detected changes with detailed information
 */
export const detectDatabaseChanges = (baselineSchema, currentSchema) => {
  // First load - no baseline exists
  if (!baselineSchema) {
    return {
      isFirstLoad: true,
      hasChanges: false,
      changes: null
    };
  }

  // Both schemas exist - compare them
  const changes = {
    tables: detectTableChanges(baselineSchema, currentSchema),
    columns: detectColumnChanges(baselineSchema, currentSchema),
    relationships: detectRelationshipChanges(baselineSchema, currentSchema),
    constraints: detectConstraintChanges(baselineSchema, currentSchema)
  };

  // Check if any changes exist
  const hasChanges = 
    changes.tables.added.length > 0 ||
    changes.tables.deleted.length > 0 ||
    changes.tables.renamed.length > 0 ||
    changes.columns.added.length > 0 ||
    changes.columns.deleted.length > 0 ||
    changes.columns.renamed.length > 0 ||
    changes.columns.modified.length > 0 ||
    changes.relationships.added.length > 0 ||
    changes.relationships.deleted.length > 0 ||
    changes.constraints.added.length > 0 ||
    changes.constraints.deleted.length > 0 ||
    changes.constraints.modified.length > 0;

  return {
    isFirstLoad: false,
    hasChanges,
    changes
  };
};

/**
 * Detect table-level changes
 */
const detectTableChanges = (baseline, current) => {
  const baselineTables = Object.keys(baseline.tables || {});
  const currentTables = Object.keys(current.tables || {});

  const added = [];
  const deleted = [];
  const renamed = [];

  // Find added tables
  currentTables.forEach(tableName => {
    if (!baselineTables.includes(tableName)) {
      added.push({
        tableName,
        columns: Object.keys(current.tables[tableName].columns || {})
      });
    }
  });

  // Find deleted tables
  baselineTables.forEach(tableName => {
    if (!currentTables.includes(tableName)) {
      deleted.push({
        tableName,
        columns: Object.keys(baseline.tables[tableName].columns || {})
      });
    }
  });

  // Detect renames (smart matching)
  // If a table was deleted and another was added with similar columns, it's likely a rename
  const potentialRenames = [];
  deleted.forEach(deletedTable => {
    added.forEach(addedTable => {
      const similarity = calculateColumnSimilarity(
        deletedTable.columns,
        addedTable.columns
      );
      
      // If 80%+ columns match, likely a rename
      if (similarity >= 0.8) {
        potentialRenames.push({
          oldName: deletedTable.tableName,
          newName: addedTable.tableName,
          similarity
        });
      }
    });
  });

  // Remove detected renames from added/deleted lists
  potentialRenames.forEach(rename => {
    const addedIndex = added.findIndex(t => t.tableName === rename.newName);
    const deletedIndex = deleted.findIndex(t => t.tableName === rename.oldName);
    
    if (addedIndex !== -1) added.splice(addedIndex, 1);
    if (deletedIndex !== -1) deleted.splice(deletedIndex, 1);
    
    renamed.push({
      oldName: rename.oldName,
      newName: rename.newName
    });
  });

  return { added, deleted, renamed };
};

/**
 * Detect column-level changes
 */
const detectColumnChanges = (baseline, current) => {
  const added = [];
  const deleted = [];
  const renamed = [];
  const modified = [];

  const baselineTables = baseline.tables || {};
  const currentTables = current.tables || {};

  // Check each table that exists in both schemas
  Object.keys(currentTables).forEach(tableName => {
    if (!baselineTables[tableName]) return; // New table, skip

    const baselineColumns = baselineTables[tableName].columns || {};
    const currentColumns = currentTables[tableName].columns || {};

    const baselineColNames = Object.keys(baselineColumns);
    const currentColNames = Object.keys(currentColumns);

    // Find added columns
    currentColNames.forEach(colName => {
      if (!baselineColNames.includes(colName)) {
        added.push({
          tableName,
          columnName: colName,
          type: currentColumns[colName].type,
          nullable: currentColumns[colName].nullable,
          pk: currentColumns[colName].pk,
          fk: currentColumns[colName].fk,
          unique: currentColumns[colName].unique
        });
      }
    });

    // Find deleted columns
    baselineColNames.forEach(colName => {
      if (!currentColNames.includes(colName)) {
        deleted.push({
          tableName,
          columnName: colName,
          type: baselineColumns[colName].type
        });
      }
    });

    // Detect column renames (smart matching by type and position)
    const addedInTable = added.filter(c => c.tableName === tableName);
    const deletedInTable = deleted.filter(c => c.tableName === tableName);

    addedInTable.forEach(addedCol => {
      deletedInTable.forEach(deletedCol => {
        const baselineCol = baselineColumns[deletedCol.columnName];
        const currentCol = currentColumns[addedCol.columnName];

        // Check if types match and positions are close
        if (
          baselineCol.type === currentCol.type &&
          Math.abs(
            (baselineCol.ordinalPosition || 0) - 
            (currentCol.ordinalPosition || 0)
          ) <= 1
        ) {
          renamed.push({
            tableName,
            oldName: deletedCol.columnName,
            newName: addedCol.columnName,
            type: currentCol.type
          });

          // Remove from added/deleted
          const addIdx = added.findIndex(
            c => c.tableName === tableName && c.columnName === addedCol.columnName
          );
          const delIdx = deleted.findIndex(
            c => c.tableName === tableName && c.columnName === deletedCol.columnName
          );
          if (addIdx !== -1) added.splice(addIdx, 1);
          if (delIdx !== -1) deleted.splice(delIdx, 1);
        }
      });
    });

    // Find modified columns (type or constraint changes)
    currentColNames.forEach(colName => {
      if (baselineColNames.includes(colName)) {
        const baselineCol = baselineColumns[colName];
        const currentCol = currentColumns[colName];

        const changes = [];

        // Type change
        if (baselineCol.type !== currentCol.type) {
          changes.push({
            property: 'type',
            oldValue: baselineCol.type,
            newValue: currentCol.type
          });
        }

        // Nullable change
        if (baselineCol.nullable !== currentCol.nullable) {
          changes.push({
            property: 'nullable',
            oldValue: baselineCol.nullable,
            newValue: currentCol.nullable
          });
        }

        // PK change
        if (baselineCol.pk !== currentCol.pk) {
          changes.push({
            property: 'primaryKey',
            oldValue: baselineCol.pk,
            newValue: currentCol.pk
          });
        }

        // Unique change
        if (baselineCol.unique !== currentCol.unique) {
          changes.push({
            property: 'unique',
            oldValue: baselineCol.unique,
            newValue: currentCol.unique
          });
        }

        // Auto increment change
        if (baselineCol.autoIncrement !== currentCol.autoIncrement) {
          changes.push({
            property: 'autoIncrement',
            oldValue: baselineCol.autoIncrement,
            newValue: currentCol.autoIncrement
          });
        }

        if (changes.length > 0) {
          modified.push({
            tableName,
            columnName: colName,
            changes
          });
        }
      }
    });
  });

  return { added, deleted, renamed, modified };
};

/**
 * Detect relationship (foreign key) changes
 */
const detectRelationshipChanges = (baseline, current) => {
  const baselineRels = baseline.relationships || [];
  const currentRels = current.relationships || [];

  const added = [];
  const deleted = [];

  // Create relationship keys for comparison
  const createRelKey = (rel) => 
    `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;

  const baselineKeys = new Set(baselineRels.map(createRelKey));
  const currentKeys = new Set(currentRels.map(createRelKey));

  // Find added relationships
  currentRels.forEach(rel => {
    const key = createRelKey(rel);
    if (!baselineKeys.has(key)) {
      added.push({
        fromTable: rel.fromTable,
        fromColumn: rel.fromColumn,
        toTable: rel.toTable,
        toColumn: rel.toColumn,
        type: rel.type,
        constraintName: rel.constraintName,
        updateRule: rel.updateRule,
        deleteRule: rel.deleteRule
      });
    }
  });

  // Find deleted relationships
  baselineRels.forEach(rel => {
    const key = createRelKey(rel);
    if (!currentKeys.has(key)) {
      deleted.push({
        fromTable: rel.fromTable,
        fromColumn: rel.fromColumn,
        toTable: rel.toTable,
        toColumn: rel.toColumn,
        type: rel.type,
        constraintName: rel.constraintName
      });
    }
  });

  return { added, deleted };
};

/**
 * Detect constraint changes (PK, UNIQUE, NOT NULL)
 */
const detectConstraintChanges = (baseline, current) => {
  const added = [];
  const deleted = [];
  const modified = [];

  const baselineTables = baseline.tables || {};
  const currentTables = current.tables || {};

  Object.keys(currentTables).forEach(tableName => {
    if (!baselineTables[tableName]) return;

    const baselineColumns = baselineTables[tableName].columns || {};
    const currentColumns = currentTables[tableName].columns || {};

    Object.keys(currentColumns).forEach(colName => {
      if (!baselineColumns[colName]) return;

      const baselineCol = baselineColumns[colName];
      const currentCol = currentColumns[colName];

      // Primary Key constraint added
      if (!baselineCol.pk && currentCol.pk) {
        added.push({
          tableName,
          columnName: colName,
          constraintType: 'PRIMARY KEY'
        });
      }

      // Primary Key constraint removed
      if (baselineCol.pk && !currentCol.pk) {
        deleted.push({
          tableName,
          columnName: colName,
          constraintType: 'PRIMARY KEY'
        });
      }

      // Unique constraint added
      if (!baselineCol.unique && currentCol.unique) {
        added.push({
          tableName,
          columnName: colName,
          constraintType: 'UNIQUE'
        });
      }

      // Unique constraint removed
      if (baselineCol.unique && !currentCol.unique) {
        deleted.push({
          tableName,
          columnName: colName,
          constraintType: 'UNIQUE'
        });
      }

      // NOT NULL constraint added
      if (baselineCol.nullable && !currentCol.nullable) {
        added.push({
          tableName,
          columnName: colName,
          constraintType: 'NOT NULL'
        });
      }

      // NOT NULL constraint removed (now nullable)
      if (!baselineCol.nullable && currentCol.nullable) {
        deleted.push({
          tableName,
          columnName: colName,
          constraintType: 'NOT NULL'
        });
      }
    });
  });

  return { added, deleted, modified };
};

/**
 * Calculate similarity between two column lists
 * Returns a value between 0 and 1
 */
const calculateColumnSimilarity = (columns1, columns2) => {
  if (columns1.length === 0 && columns2.length === 0) return 1;
  if (columns1.length === 0 || columns2.length === 0) return 0;

  const set1 = new Set(columns1);
  const set2 = new Set(columns2);
  
  let matches = 0;
  set1.forEach(col => {
    if (set2.has(col)) matches++;
  });

  const totalUnique = new Set([...columns1, ...columns2]).size;
  return matches / totalUnique;
};

/**
 * Format changes for display
 */
export const formatChangesForDisplay = (changes) => {
  if (!changes) return null;

  const sections = [];

  // Tables section
  const tableCount = 
    changes.tables.added.length + 
    changes.tables.deleted.length + 
    changes.tables.renamed.length;
  
  if (tableCount > 0) {
    sections.push({
      title: 'Table Changes',
      count: tableCount,
      items: [
        ...changes.tables.added.map(t => ({
          type: 'added',
          description: `Table "${t.tableName}" added with ${t.columns.length} columns`
        })),
        ...changes.tables.deleted.map(t => ({
          type: 'deleted',
          description: `Table "${t.tableName}" deleted`
        })),
        ...changes.tables.renamed.map(t => ({
          type: 'renamed',
          description: `Table renamed: "${t.oldName}" → "${t.newName}"`
        }))
      ]
    });
  }

  // Columns section
  const columnCount = 
    changes.columns.added.length + 
    changes.columns.deleted.length + 
    changes.columns.renamed.length +
    changes.columns.modified.length;
  
  if (columnCount > 0) {
    sections.push({
      title: 'Column Changes',
      count: columnCount,
      items: [
        ...changes.columns.added.map(c => ({
          type: 'added',
          description: `Column "${c.tableName}.${c.columnName}" added (${c.type})`
        })),
        ...changes.columns.deleted.map(c => ({
          type: 'deleted',
          description: `Column "${c.tableName}.${c.columnName}" deleted`
        })),
        ...changes.columns.renamed.map(c => ({
          type: 'renamed',
          description: `Column renamed: "${c.tableName}.${c.oldName}" → "${c.newName}"`
        })),
        ...changes.columns.modified.map(c => ({
          type: 'modified',
          description: `Column "${c.tableName}.${c.columnName}" modified`,
          details: c.changes.map(ch => 
            `${ch.property}: ${formatValue(ch.oldValue)} → ${formatValue(ch.newValue)}`
          )
        }))
      ]
    });
  }

  // Relationships section
  const relCount = 
    changes.relationships.added.length + 
    changes.relationships.deleted.length;
  
  if (relCount > 0) {
    sections.push({
      title: 'Foreign Key Changes',
      count: relCount,
      items: [
        ...changes.relationships.added.map(r => ({
          type: 'added',
          description: `Relationship added: ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}`
        })),
        ...changes.relationships.deleted.map(r => ({
          type: 'deleted',
          description: `Relationship deleted: ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}`
        }))
      ]
    });
  }

  // Constraints section
  const constraintCount = 
    changes.constraints.added.length + 
    changes.constraints.deleted.length;
  
  if (constraintCount > 0) {
    sections.push({
      title: 'Constraints',
      count: constraintCount,
      items: [
        ...changes.constraints.added.map(c => ({
          type: 'added',
          description: `${c.constraintType} added to ${c.tableName}.${c.columnName}`
        })),
        ...changes.constraints.deleted.map(c => ({
          type: 'deleted',
          description: `${c.constraintType} removed from ${c.tableName}.${c.columnName}`
        }))
      ]
    });
  }

  return sections;
};

/**
 * Format value for display
 */
const formatValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  return String(value);
};
