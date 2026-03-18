/**
 * Foreign Key Comparison Utilities
 */
import type { ERDData, Relationship } from '../types';

export interface FKEntry {
  columnName: string;
  columnData: Record<string, unknown>;
  relationship: Relationship | null;
  type: string;
  nmMetadata?: NMMetadata;
}

export interface NMMetadata {
  isNM: boolean;
  junctionTable: string;
  table1: string;
  table2: string;
  displayName: string;
  relationships: Relationship[];
}

export interface TableFKChanges {
  added: FKEntry[];
  removed: FKEntry[];
  synced: FKEntry[];
  baselineFKs: FKEntry[];
  virtualFKs: FKEntry[];
  tableName: string;
  isNewTable?: boolean;
  isDeletedTable?: boolean;
  isJunctionTable?: boolean;
  nmMetadata?: NMMetadata;
}

export interface FKComparisonResult {
  hasChanges: boolean;
  changes: Record<string, TableFKChanges>;
  affectedTables: string[];
}

export const compareForeignKeys = (
  baselineSchema: ERDData,
  virtualSchema: ERDData
): FKComparisonResult => {
  if (!baselineSchema || !virtualSchema) {
    return { hasChanges: false, changes: {}, affectedTables: [] };
  }

  const changes: Record<string, TableFKChanges> = {};
  let hasChanges = false;

  const allTables = new Set([
    ...Object.keys(baselineSchema.tables || {}),
    ...Object.keys(virtualSchema.tables || {}),
  ]);

  allTables.forEach((tableName) => {
    const baselineTable = baselineSchema.tables?.[tableName];
    const virtualTable = virtualSchema.tables?.[tableName];

    if (!baselineTable && virtualTable) {
      const tableChanges: TableFKChanges = {
        added: [], removed: [], synced: [], baselineFKs: [], virtualFKs: [],
        tableName, isNewTable: true,
      };
      Object.entries(virtualTable.columns || {}).forEach(([columnName, columnData]) => {
        if (columnData.fk) {
          const relationship = findRelationshipForColumn(virtualSchema, tableName, columnName);
          const entry: FKEntry = { columnName, columnData: columnData as unknown as Record<string, unknown>, relationship, type: 'added' };
          tableChanges.added.push(entry);
          tableChanges.virtualFKs.push({ ...entry, type: 'virtual' });
        }
      });
      if (tableChanges.added.length > 0) { changes[tableName] = tableChanges; hasChanges = true; }
      return;
    }

    if (baselineTable && !virtualTable) {
      const tableChanges: TableFKChanges = {
        added: [], removed: [], synced: [], baselineFKs: [], virtualFKs: [],
        tableName, isDeletedTable: true,
      };
      Object.entries(baselineTable.columns || {}).forEach(([columnName, columnData]) => {
        if (columnData.fk) {
          const relationship = findRelationshipForColumn(baselineSchema, tableName, columnName);
          const entry: FKEntry = { columnName, columnData: columnData as unknown as Record<string, unknown>, relationship, type: 'removed' };
          tableChanges.removed.push(entry);
          tableChanges.baselineFKs.push({ ...entry, type: 'baseline' });
        }
      });
      if (tableChanges.removed.length > 0) { changes[tableName] = tableChanges; hasChanges = true; }
      return;
    }

    if (!baselineTable || !virtualTable) return;

    const tableChanges: TableFKChanges = {
      added: [], removed: [], synced: [], baselineFKs: [], virtualFKs: [], tableName,
    };

    const baselineFKs = new Set<string>();
    Object.entries(baselineTable.columns || {}).forEach(([col, data]) => { if (data.fk) baselineFKs.add(col); });
    (baselineSchema.relationships || []).forEach((rel) => { if (rel.fromTable === tableName) baselineFKs.add(rel.fromColumn); });

    baselineFKs.forEach((columnName) => {
      const columnData = baselineTable.columns[columnName];
      const relationship = findRelationshipForColumn(baselineSchema, tableName, columnName);
      if (columnData) {
        tableChanges.baselineFKs.push({ columnName, columnData: { ...(columnData as unknown as Record<string, unknown>), fk: true }, relationship, type: 'baseline' });
      }
    });

    const virtualFKs = new Set<string>();
    Object.entries(virtualTable.columns || {}).forEach(([col, data]) => { if (data.fk) virtualFKs.add(col); });
    (virtualSchema.relationships || []).forEach((rel) => { if (rel.fromTable === tableName) virtualFKs.add(rel.fromColumn); });

    virtualFKs.forEach((columnName) => {
      const columnData = virtualTable.columns[columnName];
      const relationship = findRelationshipForColumn(virtualSchema, tableName, columnName);
      if (columnData) {
        tableChanges.virtualFKs.push({ columnName, columnData: { ...(columnData as unknown as Record<string, unknown>), fk: true }, relationship, type: 'virtual' });
      }
    });

    virtualFKs.forEach((columnName) => {
      const virtualRelationship = findRelationshipForColumn(virtualSchema, tableName, columnName);
      if (baselineFKs.has(columnName)) {
        if (virtualRelationship?.isUserCreated || virtualRelationship?.isSynced) {
          const columnData = virtualTable.columns[columnName];
          tableChanges.synced.push({ columnName, columnData: columnData as unknown as Record<string, unknown>, relationship: virtualRelationship, type: 'synced' });
          hasChanges = true;
        }
      } else {
        const columnData = virtualTable.columns[columnName];
        tableChanges.added.push({ columnName, columnData: columnData as unknown as Record<string, unknown>, relationship: virtualRelationship, type: 'added' });
        hasChanges = true;
      }
    });

    baselineFKs.forEach((columnName) => {
      if (!virtualFKs.has(columnName)) {
        const columnData = baselineTable.columns[columnName];
        const relationship = findRelationshipForColumn(baselineSchema, tableName, columnName);
        tableChanges.removed.push({ columnName, columnData: columnData as unknown as Record<string, unknown>, relationship, type: 'removed' });
        hasChanges = true;
      }
    });

    if (tableChanges.added.length > 0 || tableChanges.removed.length > 0 || tableChanges.synced.length > 0) {
      changes[tableName] = tableChanges;
    }
  });

  // Detect N:M relationships and add metadata
  Object.entries(changes).forEach(([tableName, tableChanges]) => {
    const table = virtualSchema.tables?.[tableName] || baselineSchema.tables?.[tableName];
    if (!table) return;

    const allColumns = Object.values(table.columns || {});
    const fkColumns = allColumns.filter((col) => col.fk);
    const pkColumns = allColumns.filter((col) => col.pk);
    const isJunctionTable = (table as { isJunctionTable?: boolean }).isJunctionTable ||
      (fkColumns.length === 2 && pkColumns.length === 2 && fkColumns.every((fk) => fk.pk));

    if (isJunctionTable) {
      const rels = (virtualSchema.relationships || baselineSchema.relationships || []).filter(
        (r) => r.fromTable === tableName
      );
      const table1 = rels[0]?.toTable;
      const table2 = rels[1]?.toTable;

      if (table1 && table2) {
        const nmMetadata: NMMetadata = {
          isNM: true, junctionTable: tableName, table1, table2,
          displayName: `${table1} ↔ ${table2}`, relationships: rels,
        };
        const addMeta = (fk: FKEntry) => ({ ...fk, nmMetadata });
        tableChanges.added = tableChanges.added.map(addMeta);
        tableChanges.removed = tableChanges.removed.map(addMeta);
        tableChanges.synced = tableChanges.synced.map(addMeta);
        tableChanges.baselineFKs = tableChanges.baselineFKs.map(addMeta);
        tableChanges.virtualFKs = tableChanges.virtualFKs.map(addMeta);
        tableChanges.isJunctionTable = true;
        tableChanges.nmMetadata = nmMetadata;
      }
    }
  });

  return { hasChanges, changes, affectedTables: Object.keys(changes) };
};

const findRelationshipForColumn = (
  schema: ERDData,
  tableName: string,
  columnName: string
): Relationship | null => {
  if (!schema.relationships) return null;
  return schema.relationships.find(
    (rel) => rel.fromTable === tableName && rel.fromColumn === columnName
  ) || null;
};

export interface FKChangesSummary {
  totalChanges: number;
  addedCount: number;
  removedCount: number;
  syncedCount: number;
  affectedTablesCount: number;
  description: string;
}

export const getFKChangesSummary = (comparisonResult: FKComparisonResult): FKChangesSummary => {
  if (!comparisonResult.hasChanges) {
    return { totalChanges: 0, addedCount: 0, removedCount: 0, syncedCount: 0, affectedTablesCount: 0, description: 'No foreign key changes detected' };
  }

  let addedCount = 0, removedCount = 0, syncedCount = 0;
  Object.values(comparisonResult.changes).forEach((tc) => {
    addedCount += tc.added.length;
    removedCount += tc.removed.length;
    syncedCount += tc.synced.length;
  });

  const totalChanges = addedCount + removedCount + syncedCount;
  const affectedTablesCount = comparisonResult.affectedTables.length;
  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} added`);
  if (removedCount > 0) parts.push(`${removedCount} removed`);
  if (syncedCount > 0) parts.push(`${syncedCount} synced`);
  let description = parts.join(', ');
  if (affectedTablesCount > 1) description += ` across ${affectedTablesCount} tables`;

  return { totalChanges, addedCount, removedCount, syncedCount, affectedTablesCount, description };
};

export const revertFKChange = (
  virtualSchema: ERDData,
  tableName: string,
  columnName: string,
  changeType: 'added' | 'removed',
  baselineSchema: ERDData
): ERDData => {
  const updatedSchema: ERDData = JSON.parse(JSON.stringify(virtualSchema));

  if (changeType === 'added') {
    const table = updatedSchema.tables[tableName];
    const isJunctionTable = (table as { isJunctionTable?: boolean })?.isJunctionTable || (
      (table as { isUserCreated?: boolean })?.isUserCreated &&
      Object.values(table?.columns || {}).filter((col) => col.fk).length === 2 &&
      Object.values(table?.columns || {}).filter((col) => col.pk).length === 2
    );

    if (isJunctionTable) {
      delete updatedSchema.tables[tableName];
      updatedSchema.relationships = (updatedSchema.relationships || []).filter(
        (rel) => rel.fromTable !== tableName
      );
      return updatedSchema;
    }

    const baselineColumn = baselineSchema.tables?.[tableName]?.columns?.[columnName];
    if (!baselineColumn) {
      if (updatedSchema.tables[tableName]?.columns[columnName]) {
        delete updatedSchema.tables[tableName].columns[columnName];
      }
    } else {
      if (updatedSchema.tables[tableName]?.columns[columnName]) {
        updatedSchema.tables[tableName].columns[columnName].fk = false;
      }
    }
    updatedSchema.relationships = (updatedSchema.relationships || []).filter(
      (rel) => !(rel.fromTable === tableName && rel.fromColumn === columnName)
    );
  } else if (changeType === 'removed') {
    const baselineColumn = baselineSchema.tables?.[tableName]?.columns?.[columnName];
    const baselineRelationship = findRelationshipForColumn(baselineSchema, tableName, columnName);

    if (baselineColumn && updatedSchema.tables[tableName]?.columns[columnName]) {
      updatedSchema.tables[tableName].columns[columnName].fk = true;
    }

    if (baselineRelationship) {
      if (!updatedSchema.relationships) updatedSchema.relationships = [];
      const existingRel = updatedSchema.relationships.find(
        (rel) =>
          rel.fromTable === baselineRelationship.fromTable &&
          rel.fromColumn === baselineRelationship.fromColumn &&
          rel.toTable === baselineRelationship.toTable &&
          rel.toColumn === baselineRelationship.toColumn
      );
      if (!existingRel) updatedSchema.relationships.push({ ...baselineRelationship });
    }
  }

  return updatedSchema;
};
