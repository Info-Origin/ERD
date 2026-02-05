/**
 * Foreign Key Comparison Utilities
 * Handles detection and comparison of foreign key changes between schemas
 */

/**
 * Compare foreign keys between baseline and virtual schemas
 * @param {Object} baselineSchema - The original database schema
 * @param {Object} virtualSchema - The modified virtual schema
 * @returns {Object} Comparison result with complete FK data for both schemas
 */
export const compareForeignKeys = (baselineSchema, virtualSchema) => {
  if (!baselineSchema || !virtualSchema) {
    return { hasChanges: false, changes: {} };
  }

  const changes = {};
  let hasChanges = false;

  // Get all tables from both schemas
  const allTables = new Set([
    ...Object.keys(baselineSchema.tables || {}),
    ...Object.keys(virtualSchema.tables || {})
  ]);

  allTables.forEach(tableName => {
    const baselineTable = baselineSchema.tables?.[tableName];
    const virtualTable = virtualSchema.tables?.[tableName];

    if (!baselineTable || !virtualTable) {
      // Skip tables that don't exist in both schemas
      return;
    }

    const tableChanges = {
      added: [],
      removed: [],
      synced: [], // NEW: Synced foreign keys
      baselineFKs: [], // All FKs in baseline schema
      virtualFKs: [],  // All FKs in virtual schema
      tableName
    };

    // IMPROVED: Get ALL FK columns from baseline schema (both from columns and relationships)
    const baselineFKs = new Set();
    
    // Method 1: Check column FK flags
    Object.entries(baselineTable.columns || {}).forEach(([columnName, columnData]) => {
      if (columnData.fk) {
        baselineFKs.add(columnName);
      }
    });

    // Method 2: Check relationships array (more reliable)
    (baselineSchema.relationships || []).forEach(rel => {
      if (rel.fromTable === tableName) {
        baselineFKs.add(rel.fromColumn);
      }
    });

    // Build baselineFKs array with complete data
    baselineFKs.forEach(columnName => {
      const columnData = baselineTable.columns[columnName];
      const relationship = findRelationshipForColumn(baselineSchema, tableName, columnName);
      
      if (columnData) {
        tableChanges.baselineFKs.push({
          columnName,
          columnData: {
            ...columnData,
            fk: true // Ensure FK flag is set
          },
          relationship,
          type: 'baseline'
        });
      }
    });

    // IMPROVED: Get ALL FK columns from virtual schema (both from columns and relationships)
    const virtualFKs = new Set();
    
    // Method 1: Check column FK flags
    Object.entries(virtualTable.columns || {}).forEach(([columnName, columnData]) => {
      if (columnData.fk) {
        virtualFKs.add(columnName);
      }
    });

    // Method 2: Check relationships array (more reliable)
    (virtualSchema.relationships || []).forEach(rel => {
      if (rel.fromTable === tableName) {
        virtualFKs.add(rel.fromColumn);
      }
    });

    // Build virtualFKs array with complete data
    virtualFKs.forEach(columnName => {
      const columnData = virtualTable.columns[columnName];
      const relationship = findRelationshipForColumn(virtualSchema, tableName, columnName);
      
      if (columnData) {
        tableChanges.virtualFKs.push({
          columnName,
          columnData: {
            ...columnData,
            fk: true // Ensure FK flag is set
          },
          relationship,
          type: 'virtual'
        });
      }
    });

    // NEW: Detect synced, added, and removed FKs
    virtualFKs.forEach(columnName => {
      const virtualRelationship = findRelationshipForColumn(virtualSchema, tableName, columnName);
      const baselineRelationship = findRelationshipForColumn(baselineSchema, tableName, columnName);

      if (baselineFKs.has(columnName)) {
        // FK exists in both schemas - check if it was originally virtual
        if (virtualRelationship?.isVirtual) {
          // This was originally added virtually but now exists in actual DB - SYNCED
          const columnData = virtualTable.columns[columnName];
          tableChanges.synced.push({
            columnName,
            columnData,
            relationship: virtualRelationship,
            type: 'synced'
          });
          hasChanges = true;
        }
        // If not originally virtual, it's just a normal existing FK (no change)
      } else {
        // FK exists only in virtual - ADDED
        const columnData = virtualTable.columns[columnName];
        tableChanges.added.push({
          columnName,
          columnData,
          relationship: virtualRelationship,
          type: 'added'
        });
        hasChanges = true;
      }
    });

    // Find removed FKs (in baseline but not in virtual)
    baselineFKs.forEach(columnName => {
      if (!virtualFKs.has(columnName)) {
        const columnData = baselineTable.columns[columnName];
        const relationship = findRelationshipForColumn(baselineSchema, tableName, columnName);
        
        tableChanges.removed.push({
          columnName,
          columnData,
          relationship,
          type: 'removed'
        });
        hasChanges = true;
      }
    });

    // Include table only if it has actual changes (added, removed, or synced)
    if (tableChanges.added.length > 0 || tableChanges.removed.length > 0 || tableChanges.synced.length > 0) {
      changes[tableName] = tableChanges;
    }
  });

  return {
    hasChanges,
    changes,
    affectedTables: Object.keys(changes)
  };
};

/**
 * Find the relationship for a specific column
 * @param {Object} schema - The schema to search in
 * @param {string} tableName - The table name
 * @param {string} columnName - The column name
 * @returns {Object|null} The relationship object or null if not found
 */
const findRelationshipForColumn = (schema, tableName, columnName) => {
  if (!schema.relationships) return null;
  
  return schema.relationships.find(rel => 
    rel.fromTable === tableName && rel.fromColumn === columnName
  ) || null;
};

/**
 * Get a summary of FK changes for display
 * @param {Object} comparisonResult - Result from compareForeignKeys
 * @returns {Object} Summary with counts and descriptions
 */
export const getFKChangesSummary = (comparisonResult) => {
  if (!comparisonResult.hasChanges) {
    return {
      totalChanges: 0,
      addedCount: 0,
      removedCount: 0,
      syncedCount: 0,
      affectedTablesCount: 0,
      description: "No foreign key changes detected"
    };
  }

  let addedCount = 0;
  let removedCount = 0;
  let syncedCount = 0;

  Object.values(comparisonResult.changes).forEach(tableChanges => {
    addedCount += tableChanges.added.length;
    removedCount += tableChanges.removed.length;
    syncedCount += tableChanges.synced.length;
  });

  const totalChanges = addedCount + removedCount + syncedCount;
  const affectedTablesCount = comparisonResult.affectedTables.length;

  let description = "";
  const parts = [];
  if (addedCount > 0) parts.push(`${addedCount} added`);
  if (removedCount > 0) parts.push(`${removedCount} removed`);
  if (syncedCount > 0) parts.push(`${syncedCount} synced`);
  
  description = parts.join(', ');
  if (affectedTablesCount > 1) {
    description += ` across ${affectedTablesCount} tables`;
  }

  return {
    totalChanges,
    addedCount,
    removedCount,
    syncedCount,
    affectedTablesCount,
    description
  };
};

/**
 * Revert a specific FK change
 * @param {Object} virtualSchema - The current virtual schema
 * @param {string} tableName - The table name
 * @param {string} columnName - The column name
 * @param {string} changeType - 'added' or 'removed'
 * @param {Object} baselineSchema - The baseline schema for reference
 * @returns {Object} Updated virtual schema
 */
export const revertFKChange = (virtualSchema, tableName, columnName, changeType, baselineSchema) => {
  const updatedSchema = JSON.parse(JSON.stringify(virtualSchema));

  if (changeType === 'added') {
    // Check if this column existed in the baseline schema
    const baselineColumn = baselineSchema.tables?.[tableName]?.columns?.[columnName];
    
    if (!baselineColumn) {
      // Column was newly created for this FK - remove it entirely
      if (updatedSchema.tables[tableName]?.columns[columnName]) {
        delete updatedSchema.tables[tableName].columns[columnName];
      }
    } else {
      // Column existed before - just remove FK flag
      if (updatedSchema.tables[tableName]?.columns[columnName]) {
        updatedSchema.tables[tableName].columns[columnName].fk = false;
      }
    }

    // Remove the relationship
    updatedSchema.relationships = (updatedSchema.relationships || []).filter(rel => 
      !(rel.fromTable === tableName && rel.fromColumn === columnName)
    );

  } else if (changeType === 'removed') {
    // Restore the FK constraint from baseline
    const baselineColumn = baselineSchema.tables?.[tableName]?.columns?.[columnName];
    const baselineRelationship = findRelationshipForColumn(baselineSchema, tableName, columnName);

    if (baselineColumn && updatedSchema.tables[tableName]?.columns[columnName]) {
      updatedSchema.tables[tableName].columns[columnName].fk = true;
    }

    // Restore the relationship if it exists in baseline
    if (baselineRelationship) {
      if (!updatedSchema.relationships) {
        updatedSchema.relationships = [];
      }

      // Check if relationship already exists
      const existingRel = updatedSchema.relationships.find(rel => 
        rel.fromTable === baselineRelationship.fromTable && 
        rel.fromColumn === baselineRelationship.fromColumn &&
        rel.toTable === baselineRelationship.toTable &&
        rel.toColumn === baselineRelationship.toColumn
      );

      if (!existingRel) {
        updatedSchema.relationships.push({ ...baselineRelationship });
      }
    }
  }

  return updatedSchema;
};