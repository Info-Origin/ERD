/**
 * Conflict Detection Utility
 */
import type { ERDData, Relationship } from '../types';

export interface ConflictItem {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  affectedTable?: string;
  affectedColumn?: string;
  affectedTables?: string[];
  currentType?: string;
  proposedType?: string;
  details?: string;
  relationship?: Relationship;
  blocking?: boolean;
  cascadeCount?: number;
}

export interface CascadingChange {
  type: string;
  tableName: string;
  columnName: string;
  oldType?: string;
  newType: string;
  reason: string;
  relationship?: Relationship;
  cascadeDirection?: string;
}

export interface ConflictAnalysisResult {
  hasConflicts: boolean;
  conflicts: ConflictItem[];
  affectedTables: string[];
  cascadingChanges: CascadingChange[];
}

export interface ConflictSummary {
  critical: number;
  high: number;
  medium: number;
  cascading: number;
  blocking: boolean;
}

export interface AnalyzeColumnChangeParams {
  tableName: string;
  columnName: string;
  newProperties: Record<string, unknown>;
  currentSchema: ERDData;
}

export const analyzeColumnChange = ({
  tableName, columnName, newProperties, currentSchema,
}: AnalyzeColumnChangeParams): ConflictAnalysisResult => {
  const conflicts: ConflictItem[] = [];
  const affectedTables = new Set<string>();
  const cascadingChanges: CascadingChange[] = [];

  if (!currentSchema?.tables || !currentSchema?.relationships) {
    return { hasConflicts: false, conflicts: [], affectedTables: [], cascadingChanges: [] };
  }

  const currentColumn = currentSchema.tables[tableName]?.columns[columnName];
  if (!currentColumn) {
    return { hasConflicts: false, conflicts: [], affectedTables: [], cascadingChanges: [] };
  }

  const referencingRelationships = currentSchema.relationships.filter(
    (rel) => rel.toTable === tableName && rel.toColumn === columnName
  );
  const foreignKeyRelationships = currentSchema.relationships.filter(
    (rel) => rel.fromTable === tableName && rel.fromColumn === columnName
  );

  if (newProperties.type && newProperties.type !== currentColumn.type) {
    analyzeDataTypeChange({
      tableName, columnName,
      oldType: currentColumn.type as string,
      newType: newProperties.type as string,
      referencingRelationships, foreignKeyRelationships,
      currentSchema, conflicts, affectedTables, cascadingChanges,
    });
  }

  analyzeConstraintChanges({
    tableName, columnName, currentColumn: currentColumn as unknown as Record<string, unknown>,
    newProperties, referencingRelationships, foreignKeyRelationships,
    currentSchema, conflicts, affectedTables, cascadingChanges,
  });

  return { hasConflicts: conflicts.length > 0, conflicts, affectedTables: Array.from(affectedTables), cascadingChanges };
};

interface DataTypeChangeParams {
  tableName: string;
  columnName: string;
  oldType: string;
  newType: string;
  referencingRelationships: Relationship[];
  foreignKeyRelationships: Relationship[];
  currentSchema: ERDData;
  conflicts: ConflictItem[];
  affectedTables: Set<string>;
  cascadingChanges: CascadingChange[];
}

const analyzeDataTypeChange = ({
  tableName, columnName, oldType, newType,
  referencingRelationships, foreignKeyRelationships,
  currentSchema, conflicts, affectedTables, cascadingChanges,
}: DataTypeChangeParams): void => {
  if (referencingRelationships.length > 0) {
    referencingRelationships.forEach((rel) => {
      const fkTable = rel.fromTable;
      const fkColumn = rel.fromColumn;
      const fkCurrentType = currentSchema.tables[fkTable]?.columns[fkColumn]?.type as string;
      affectedTables.add(fkTable);
      cascadingChanges.push({ type: 'DATA_TYPE_CASCADE', tableName: fkTable, columnName: fkColumn, oldType: fkCurrentType, newType, reason: 'Foreign key must match primary key type', relationship: rel });
      const compatibility = checkDataTypeCompatibility(oldType, newType, fkCurrentType);
      if (!compatibility.compatible) {
        conflicts.push({ type: 'DATA_TYPE_INCOMPATIBLE_CASCADE', severity: 'HIGH', message: `Changing ${tableName}.${columnName} from ${oldType} to ${newType} requires cascading incompatible type change to ${fkTable}.${fkColumn}`, affectedTable: fkTable, affectedColumn: fkColumn, currentType: fkCurrentType, proposedType: newType, details: 'This may cause data loss or conversion issues.', relationship: rel });
      }
    });
  }

  if (foreignKeyRelationships.length > 0) {
    foreignKeyRelationships.forEach((rel) => {
      const pkTable = rel.toTable;
      const pkColumn = rel.toColumn;
      const pkCurrentType = currentSchema.tables[pkTable]?.columns[pkColumn]?.type as string;
      affectedTables.add(pkTable);
      if (newType !== pkCurrentType) {
        cascadingChanges.push({ type: 'DATA_TYPE_CASCADE', tableName: pkTable, columnName: pkColumn, oldType: pkCurrentType, newType, reason: 'Primary key must match foreign key type (bidirectional cascade)', relationship: rel, cascadeDirection: 'FK_TO_PK' });
        const allFKsReferencingSamePK = currentSchema.relationships.filter(
          (otherRel) => otherRel.toTable === pkTable && otherRel.toColumn === pkColumn &&
            !(otherRel.fromTable === tableName && otherRel.fromColumn === columnName)
        );
        allFKsReferencingSamePK.forEach((otherRel) => {
          const otherFKTable = otherRel.fromTable;
          const otherFKColumn = otherRel.fromColumn;
          const otherFKCurrentType = currentSchema.tables[otherFKTable]?.columns[otherFKColumn]?.type as string;
          affectedTables.add(otherFKTable);
          cascadingChanges.push({ type: 'DATA_TYPE_CASCADE', tableName: otherFKTable, columnName: otherFKColumn, oldType: otherFKCurrentType, newType, reason: 'Foreign key must match updated primary key type (bidirectional cascade)', relationship: otherRel, cascadeDirection: 'PK_TO_OTHER_FKS' });
        });
        conflicts.push({ type: 'BIDIRECTIONAL_CASCADE_INFO', severity: 'MEDIUM', message: `Changing FK ${tableName}.${columnName} from ${pkCurrentType} to ${newType} will cascade to PK ${pkTable}.${pkColumn} and ${allFKsReferencingSamePK.length} other FK column(s)`, affectedTable: pkTable, affectedColumn: pkColumn, currentType: pkCurrentType, proposedType: newType, details: `This will update: PK ${pkTable}.${pkColumn} and ${allFKsReferencingSamePK.length} other FK columns that reference it`, relationship: rel, cascadeCount: allFKsReferencingSamePK.length + 1 });
      }
    });
  }
};

interface ConstraintChangeParams {
  tableName: string;
  columnName: string;
  currentColumn: Record<string, unknown>;
  newProperties: Record<string, unknown>;
  referencingRelationships: Relationship[];
  foreignKeyRelationships: Relationship[];
  currentSchema: ERDData;
  conflicts: ConflictItem[];
  affectedTables: Set<string>;
  cascadingChanges: CascadingChange[];
}

const analyzeConstraintChanges = ({
  tableName, columnName, currentColumn, newProperties,
  referencingRelationships, conflicts,
}: ConstraintChangeParams): void => {
  if (Object.prototype.hasOwnProperty.call(newProperties, 'nullable') && newProperties.nullable !== currentColumn.nullable) {
    if (newProperties.nullable === false && currentColumn.nullable === true && referencingRelationships.length > 0) {
      conflicts.push({ type: 'NULLABLE_CONSTRAINT_CONFLICT', severity: 'MEDIUM', message: `Making ${tableName}.${columnName} NOT NULL may affect ${referencingRelationships.length} foreign key relationship(s)`, affectedTables: referencingRelationships.map((rel) => rel.fromTable), details: 'Foreign key columns may need to be updated to maintain referential integrity' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(newProperties, 'pk') && newProperties.pk !== currentColumn.pk) {
    if (newProperties.pk === false && currentColumn.pk === true && referencingRelationships.length > 0) {
      conflicts.push({ type: 'PRIMARY_KEY_REMOVAL_CONFLICT', severity: 'CRITICAL', message: `Removing primary key from ${tableName}.${columnName} will break ${referencingRelationships.length} foreign key relationship(s)`, affectedTables: referencingRelationships.map((rel) => rel.fromTable), details: 'This operation may cause referential integrity violations.', blocking: true });
    }
  }

  if (Object.prototype.hasOwnProperty.call(newProperties, 'unique') && newProperties.unique !== currentColumn.unique) {
    if (newProperties.unique === false && currentColumn.unique === true) {
      const uniqueRelationships = referencingRelationships.filter((rel) => {
        const fkColumn = (currentColumn as unknown as ERDData).tables?.[rel.fromTable]?.columns[rel.fromColumn];
        return (fkColumn as { unique?: boolean })?.unique === true;
      });
      if (uniqueRelationships.length > 0) {
        conflicts.push({ type: 'UNIQUE_CONSTRAINT_REMOVAL', severity: 'MEDIUM', message: `Removing unique constraint from ${tableName}.${columnName} will change 1:1 relationships to 1:N`, affectedTables: uniqueRelationships.map((rel) => rel.fromTable), details: 'This will affect relationship cardinality' });
      }
    }
  }
};

interface TypeCompatibility {
  compatible: boolean;
  requiresCascade: boolean;
}

const checkDataTypeCompatibility = (oldType: string, newType: string, fkType: string): TypeCompatibility => {
  const normalizeType = (type: string) => (type || '').toUpperCase().split('(')[0];
  const newNormalized = normalizeType(newType);
  const fkNormalized = normalizeType(fkType);

  if (newNormalized === fkNormalized) return { compatible: true, requiresCascade: false };

  const compatibleGroups = [
    ['INT','INTEGER','BIGINT','SMALLINT','TINYINT'],
    ['VARCHAR','CHAR','TEXT','LONGTEXT','MEDIUMTEXT'],
    ['DECIMAL','NUMERIC','FLOAT','DOUBLE'],
    ['DATE','DATETIME','TIMESTAMP'],
    ['BOOLEAN','BOOL','TINYINT'],
  ];

  for (const group of compatibleGroups) {
    if (group.includes(newNormalized) && group.includes(fkNormalized)) {
      return { compatible: true, requiresCascade: true };
    }
  }

  return { compatible: false, requiresCascade: false };
};

export const applyCascadingChanges = (cascadingChanges: CascadingChange[], currentSchema: ERDData): ERDData => {
  const updatedSchema: ERDData = JSON.parse(JSON.stringify(currentSchema));
  cascadingChanges.forEach((change) => {
    if (change.type === 'DATA_TYPE_CASCADE') {
      const table = updatedSchema.tables[change.tableName];
      if (table?.columns[change.columnName]) {
        table.columns[change.columnName].type = change.newType;
      }
    }
  });
  return updatedSchema;
};

export const generateConflictSummary = (conflicts: ConflictItem[], cascadingChanges: CascadingChange[]): ConflictSummary => ({
  critical: conflicts.filter((c) => c.severity === 'CRITICAL').length,
  high: conflicts.filter((c) => c.severity === 'HIGH').length,
  medium: conflicts.filter((c) => c.severity === 'MEDIUM').length,
  cascading: cascadingChanges.length,
  blocking: conflicts.some((c) => c.blocking),
});
