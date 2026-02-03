/**
 * Conflict Detection Utility
 * Analyzes schema changes for referential integrity conflicts
 */

/**
 * Analyzes potential conflicts when changing column properties
 * @param {Object} params - Analysis parameters
 * @param {string} params.tableName - Table being modified
 * @param {string} params.columnName - Column being modified
 * @param {Object} params.newProperties - New column properties
 * @param {Object} params.currentSchema - Current schema data
 * @returns {Object} Conflict analysis result
 */
export const analyzeColumnChange = ({ tableName, columnName, newProperties, currentSchema }) => {
  const conflicts = [];
  const affectedTables = new Set();
  const cascadingChanges = [];
  
  if (!currentSchema || !currentSchema.tables || !currentSchema.relationships) {
    return { hasConflicts: false, conflicts: [], affectedTables: [], cascadingChanges: [] };
  }

  const currentColumn = currentSchema.tables[tableName]?.columns[columnName];
  if (!currentColumn) {
    return { hasConflicts: false, conflicts: [], affectedTables: [], cascadingChanges: [] };
  }

  // Check if this column is referenced by foreign keys (PK side)
  const referencingRelationships = currentSchema.relationships.filter(rel => 
    rel.toTable === tableName && rel.toColumn === columnName
  );

  // Check if this column is a foreign key (FK side)
  const foreignKeyRelationships = currentSchema.relationships.filter(rel => 
    rel.fromTable === tableName && rel.fromColumn === columnName
  );

  // Analyze data type changes
  if (newProperties.type && newProperties.type !== currentColumn.type) {
    analyzeDataTypeChange({
      tableName,
      columnName,
      oldType: currentColumn.type,
      newType: newProperties.type,
      referencingRelationships,
      foreignKeyRelationships,
      currentSchema,
      conflicts,
      affectedTables,
      cascadingChanges
    });
  }

  // Analyze constraint changes
  analyzeConstraintChanges({
    tableName,
    columnName,
    currentColumn,
    newProperties,
    referencingRelationships,
    foreignKeyRelationships,
    currentSchema,
    conflicts,
    affectedTables,
    cascadingChanges
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    affectedTables: Array.from(affectedTables),
    cascadingChanges
  };
};

/**
 * Analyzes data type change conflicts
 */
const analyzeDataTypeChange = ({
  tableName,
  columnName,
  oldType,
  newType,
  referencingRelationships,
  foreignKeyRelationships,
  currentSchema,
  conflicts,
  affectedTables,
  cascadingChanges
}) => {
  // Check if this is a PK column being referenced by FKs
  if (referencingRelationships.length > 0) {
    referencingRelationships.forEach(rel => {
      const fkTable = rel.fromTable;
      const fkColumn = rel.fromColumn;
      const fkCurrentType = currentSchema.tables[fkTable]?.columns[fkColumn]?.type;
      
      affectedTables.add(fkTable);
      
      // For PK->FK relationships, ALWAYS cascade the type change to maintain referential integrity
      // This is essential for foreign key constraints to work properly
      cascadingChanges.push({
        type: 'DATA_TYPE_CASCADE',
        tableName: fkTable,
        columnName: fkColumn,
        oldType: fkCurrentType,
        newType: newType,
        reason: `Foreign key must match primary key type`,
        relationship: rel
      });
      
      // Check if data types are compatible for warning purposes
      const compatibility = checkDataTypeCompatibility(oldType, newType, fkCurrentType);
      
      if (!compatibility.compatible) {
        // Add a warning about potential data loss, but still allow the cascade
        conflicts.push({
          type: 'DATA_TYPE_INCOMPATIBLE_CASCADE',
          severity: 'HIGH',
          message: `Changing ${tableName}.${columnName} from ${oldType} to ${newType} requires cascading incompatible type change to ${fkTable}.${fkColumn}`,
          affectedTable: fkTable,
          affectedColumn: fkColumn,
          currentType: fkCurrentType,
          proposedType: newType,
          details: 'This may cause data loss or conversion issues. Review the affected data carefully.',
          relationship: rel
        });
      }
    });
  }

  // Check if this is an FK column - CASCADE TO PK AND ALL OTHER FKS
  if (foreignKeyRelationships.length > 0) {
    foreignKeyRelationships.forEach(rel => {
      const pkTable = rel.toTable;
      const pkColumn = rel.toColumn;
      const pkCurrentType = currentSchema.tables[pkTable]?.columns[pkColumn]?.type;
      
      affectedTables.add(pkTable);
      
      // Check if new FK type matches PK type
      if (newType !== pkCurrentType) {
        // BIDIRECTIONAL CASCADING: When FK type changes, cascade to PK and all other FKs
        
        // 1. CASCADE TO THE REFERENCED PK
        cascadingChanges.push({
          type: 'DATA_TYPE_CASCADE',
          tableName: pkTable,
          columnName: pkColumn,
          oldType: pkCurrentType,
          newType: newType,
          reason: `Primary key must match foreign key type (bidirectional cascade)`,
          relationship: rel,
          cascadeDirection: 'FK_TO_PK'
        });
        
        // 2. CASCADE TO ALL OTHER FKS THAT REFERENCE THE SAME PK
        const allFKsReferencingSamePK = currentSchema.relationships.filter(otherRel => 
          otherRel.toTable === pkTable && 
          otherRel.toColumn === pkColumn &&
          !(otherRel.fromTable === tableName && otherRel.fromColumn === columnName) // Exclude the current FK
        );
        
        allFKsReferencingSamePK.forEach(otherRel => {
          const otherFKTable = otherRel.fromTable;
          const otherFKColumn = otherRel.fromColumn;
          const otherFKCurrentType = currentSchema.tables[otherFKTable]?.columns[otherFKColumn]?.type;
          
          affectedTables.add(otherFKTable);
          
          cascadingChanges.push({
            type: 'DATA_TYPE_CASCADE',
            tableName: otherFKTable,
            columnName: otherFKColumn,
            oldType: otherFKCurrentType,
            newType: newType,
            reason: `Foreign key must match updated primary key type (bidirectional cascade)`,
            relationship: otherRel,
            cascadeDirection: 'PK_TO_OTHER_FKS'
          });
        });
        
        // Add informational conflict about the bidirectional cascade
        const totalAffectedFKs = allFKsReferencingSamePK.length;
        conflicts.push({
          type: 'BIDIRECTIONAL_CASCADE_INFO',
          severity: 'MEDIUM',
          message: `Changing FK ${tableName}.${columnName} from ${pkCurrentType} to ${newType} will cascade to PK ${pkTable}.${pkColumn} and ${totalAffectedFKs} other FK column(s)`,
          affectedTable: pkTable,
          affectedColumn: pkColumn,
          currentType: pkCurrentType,
          proposedType: newType,
          details: `This will update: PK ${pkTable}.${pkColumn} and ${totalAffectedFKs} other FK columns that reference it`,
          relationship: rel,
          cascadeCount: totalAffectedFKs + 1 // +1 for the PK itself
        });
      }
    });
  }
};

/**
 * Analyzes constraint change conflicts
 */
const analyzeConstraintChanges = ({
  tableName,
  columnName,
  currentColumn,
  newProperties,
  referencingRelationships,
  foreignKeyRelationships,
  currentSchema,
  conflicts,
  affectedTables,
  cascadingChanges
}) => {
  // Check nullable constraint changes
  if (newProperties.hasOwnProperty('nullable') && newProperties.nullable !== currentColumn.nullable) {
    if (newProperties.nullable === false && currentColumn.nullable === true) {
      // Making column NOT NULL
      if (referencingRelationships.length > 0) {
        conflicts.push({
          type: 'NULLABLE_CONSTRAINT_CONFLICT',
          severity: 'MEDIUM',
          message: `Making ${tableName}.${columnName} NOT NULL may affect ${referencingRelationships.length} foreign key relationship(s)`,
          affectedTables: referencingRelationships.map(rel => rel.fromTable),
          details: 'Foreign key columns may need to be updated to maintain referential integrity'
        });
      }
    }
  }

  // Check primary key constraint changes
  if (newProperties.hasOwnProperty('pk') && newProperties.pk !== currentColumn.pk) {
    if (newProperties.pk === false && currentColumn.pk === true) {
      // Removing PK constraint
      if (referencingRelationships.length > 0) {
        conflicts.push({
          type: 'PRIMARY_KEY_REMOVAL_CONFLICT',
          severity: 'CRITICAL',
          message: `Removing primary key from ${tableName}.${columnName} will break ${referencingRelationships.length} foreign key relationship(s)`,
          affectedTables: referencingRelationships.map(rel => rel.fromTable),
          details: 'This operation may cause referential integrity violations. Foreign key relationships will become invalid.',
          blocking: true
        });
      }
    }
  }

  // Check unique constraint changes
  if (newProperties.hasOwnProperty('unique') && newProperties.unique !== currentColumn.unique) {
    if (newProperties.unique === false && currentColumn.unique === true) {
      // Removing unique constraint
      const uniqueRelationships = referencingRelationships.filter(rel => {
        const fkColumn = currentSchema.tables[rel.fromTable]?.columns[rel.fromColumn];
        return fkColumn?.unique === true; // 1:1 relationship via unique FK
      });
      
      if (uniqueRelationships.length > 0) {
        conflicts.push({
          type: 'UNIQUE_CONSTRAINT_REMOVAL',
          severity: 'MEDIUM',
          message: `Removing unique constraint from ${tableName}.${columnName} will change 1:1 relationships to 1:N`,
          affectedTables: uniqueRelationships.map(rel => rel.fromTable),
          details: 'This will affect relationship cardinality'
        });
      }
    }
  }
};

/**
 * Checks if two data types are compatible
 */
const checkDataTypeCompatibility = (oldType, newType, fkType) => {
  // Normalize types for comparison
  const normalizeType = (type) => {
    if (!type) return '';
    return type.toUpperCase().split('(')[0]; // Remove size specifications
  };

  const oldNormalized = normalizeType(oldType);
  const newNormalized = normalizeType(newType);
  const fkNormalized = normalizeType(fkType);

  // Exact match
  if (newNormalized === fkNormalized) {
    return { compatible: true, requiresCascade: false };
  }

  // Compatible type groups
  const compatibleGroups = [
    ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT'],
    ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT'],
    ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE'],
    ['DATE', 'DATETIME', 'TIMESTAMP'],
    ['BOOLEAN', 'BOOL', 'TINYINT']
  ];

  // Check if types are in the same compatibility group
  for (const group of compatibleGroups) {
    if (group.includes(newNormalized) && group.includes(fkNormalized)) {
      return { compatible: true, requiresCascade: true };
    }
  }

  // Not compatible
  return { compatible: false, requiresCascade: false };
};

/**
 * Applies cascading changes to maintain referential integrity
 */
export const applyCascadingChanges = (cascadingChanges, currentSchema) => {
  const updatedSchema = JSON.parse(JSON.stringify(currentSchema)); // Deep clone
  
  cascadingChanges.forEach(change => {
    if (change.type === 'DATA_TYPE_CASCADE') {
      const table = updatedSchema.tables[change.tableName];
      if (table && table.columns[change.columnName]) {
        table.columns[change.columnName].type = change.newType;
      }
    }
  });
  
  return updatedSchema;
};

/**
 * Generates a human-readable summary of conflicts
 */
export const generateConflictSummary = (conflicts, cascadingChanges) => {
  const summary = {
    critical: conflicts.filter(c => c.severity === 'CRITICAL').length,
    high: conflicts.filter(c => c.severity === 'HIGH').length,
    medium: conflicts.filter(c => c.severity === 'MEDIUM').length,
    cascading: cascadingChanges.length,
    blocking: conflicts.some(c => c.blocking)
  };
  
  return summary;
};