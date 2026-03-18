import type { ERDData, Relationship } from '../types';

// ============================================================
// Internal change shape types
// ============================================================

interface TableAdded { tableName: string; columns: string[] }
interface TableDeleted { tableName: string; columns: string[] }
interface TableRenamed { oldName: string; newName: string }

interface ColumnAdded { tableName: string; columnName: string; type: string; nullable: boolean; pk: boolean; fk?: boolean; unique: boolean }
interface ColumnDeleted { tableName: string; columnName: string; type: string }
interface ColumnRenamed { tableName: string; oldName: string; newName: string; type: string }
interface ColumnModified { tableName: string; columnName: string; changes: { property: string; oldValue: unknown; newValue: unknown }[] }

interface ConstraintChange { tableName: string; columnName: string; constraintType: string }

export interface DetectedChanges {
  tables: { added: TableAdded[]; deleted: TableDeleted[]; renamed: TableRenamed[] };
  columns: { added: ColumnAdded[]; deleted: ColumnDeleted[]; renamed: ColumnRenamed[]; modified: ColumnModified[] };
  relationships: { added: Partial<Relationship>[]; deleted: Partial<Relationship>[] };
  constraints: { added: ConstraintChange[]; deleted: ConstraintChange[]; modified: ConstraintChange[] };
}

export interface DatabaseChangeResult {
  isFirstLoad: boolean;
  hasChanges: boolean;
  changes: DetectedChanges | null;
}

// ============================================================
// Main export
// ============================================================

export const detectDatabaseChanges = (
  baselineSchema: ERDData | null,
  currentSchema: ERDData,
): DatabaseChangeResult => {
  if (!baselineSchema) {
    return { isFirstLoad: true, hasChanges: false, changes: null };
  }

  const changes: DetectedChanges = {
    tables: detectTableChanges(baselineSchema, currentSchema),
    columns: detectColumnChanges(baselineSchema, currentSchema),
    relationships: detectRelationshipChanges(baselineSchema, currentSchema),
    constraints: detectConstraintChanges(baselineSchema, currentSchema),
  };

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

  return { isFirstLoad: false, hasChanges, changes };
};

// ============================================================
// Helpers
// ============================================================

const calculateColumnSimilarity = (cols1: string[], cols2: string[]): number => {
  if (cols1.length === 0 && cols2.length === 0) return 1;
  if (cols1.length === 0 || cols2.length === 0) return 0;
  const set1 = new Set(cols1);
  const set2 = new Set(cols2);
  let matches = 0;
  set1.forEach((c) => { if (set2.has(c)) matches++; });
  return matches / new Set([...cols1, ...cols2]).size;
};

const detectTableChanges = (baseline: ERDData, current: ERDData) => {
  const baselineTables = Object.keys(baseline.tables || {});
  const currentTables = Object.keys(current.tables || {});

  const added: TableAdded[] = currentTables
    .filter((t) => !baselineTables.includes(t))
    .map((t) => ({ tableName: t, columns: Object.keys(current.tables[t].columns || {}) }));

  const deleted: TableDeleted[] = baselineTables
    .filter((t) => !currentTables.includes(t))
    .map((t) => ({ tableName: t, columns: Object.keys(baseline.tables[t].columns || {}) }));

  const renamed: TableRenamed[] = [];
  const addedCopy = [...added];
  const deletedCopy = [...deleted];

  deletedCopy.forEach((del) => {
    addedCopy.forEach((add) => {
      if (calculateColumnSimilarity(del.columns, add.columns) >= 0.8) {
        renamed.push({ oldName: del.tableName, newName: add.tableName });
        const ai = added.findIndex((t) => t.tableName === add.tableName);
        const di = deleted.findIndex((t) => t.tableName === del.tableName);
        if (ai !== -1) added.splice(ai, 1);
        if (di !== -1) deleted.splice(di, 1);
      }
    });
  });

  return { added, deleted, renamed };
};

const detectColumnChanges = (baseline: ERDData, current: ERDData) => {
  const added: ColumnAdded[] = [];
  const deleted: ColumnDeleted[] = [];
  const renamed: ColumnRenamed[] = [];
  const modified: ColumnModified[] = [];

  Object.keys(current.tables || {}).forEach((tableName) => {
    if (!baseline.tables[tableName]) return;
    const bCols = baseline.tables[tableName].columns || {};
    const cCols = current.tables[tableName].columns || {};
    const bNames = Object.keys(bCols);
    const cNames = Object.keys(cCols);

    cNames.filter((c) => !bNames.includes(c)).forEach((c) =>
      added.push({ tableName, columnName: c, type: cCols[c].type, nullable: cCols[c].nullable, pk: cCols[c].pk, fk: cCols[c].fk, unique: cCols[c].unique }),
    );

    bNames.filter((c) => !cNames.includes(c)).forEach((c) =>
      deleted.push({ tableName, columnName: c, type: bCols[c].type }),
    );

    // Rename detection
    added.filter((a) => a.tableName === tableName).forEach((addedCol) => {
      deleted.filter((d) => d.tableName === tableName).forEach((deletedCol) => {
        const bc = bCols[deletedCol.columnName];
        const cc = cCols[addedCol.columnName];
        if (bc.type === cc.type && Math.abs((bc.ordinalPosition || 0) - (cc.ordinalPosition || 0)) <= 1) {
          renamed.push({ tableName, oldName: deletedCol.columnName, newName: addedCol.columnName, type: cc.type });
          const ai = added.findIndex((a) => a.tableName === tableName && a.columnName === addedCol.columnName);
          const di = deleted.findIndex((d) => d.tableName === tableName && d.columnName === deletedCol.columnName);
          if (ai !== -1) added.splice(ai, 1);
          if (di !== -1) deleted.splice(di, 1);
        }
      });
    });

    // Modified detection
    cNames.filter((c) => bNames.includes(c)).forEach((c) => {
      const bc = bCols[c];
      const cc = cCols[c];
      const changes: { property: string; oldValue: unknown; newValue: unknown }[] = [];
      if (bc.type !== cc.type) changes.push({ property: 'type', oldValue: bc.type, newValue: cc.type });
      if (bc.nullable !== cc.nullable) changes.push({ property: 'nullable', oldValue: bc.nullable, newValue: cc.nullable });
      if (bc.pk !== cc.pk) changes.push({ property: 'primaryKey', oldValue: bc.pk, newValue: cc.pk });
      if (bc.unique !== cc.unique) changes.push({ property: 'unique', oldValue: bc.unique, newValue: cc.unique });
      if (bc.autoIncrement !== cc.autoIncrement) changes.push({ property: 'autoIncrement', oldValue: bc.autoIncrement, newValue: cc.autoIncrement });
      if (changes.length > 0) modified.push({ tableName, columnName: c, changes });
    });
  });

  return { added, deleted, renamed, modified };
};

const detectRelationshipChanges = (baseline: ERDData, current: ERDData) => {
  const createKey = (r: Relationship) => `${r.fromTable}.${r.fromColumn}->${r.toTable}.${r.toColumn}`;
  const bKeys = new Set((baseline.relationships || []).map(createKey));
  const cKeys = new Set((current.relationships || []).map(createKey));

  const added = (current.relationships || []).filter((r) => !bKeys.has(createKey(r)));
  const deleted = (baseline.relationships || []).filter((r) => !cKeys.has(createKey(r)));

  return { added, deleted };
};

const detectConstraintChanges = (baseline: ERDData, current: ERDData) => {
  const added: ConstraintChange[] = [];
  const deleted: ConstraintChange[] = [];

  Object.keys(current.tables || {}).forEach((tableName) => {
    if (!baseline.tables[tableName]) return;
    const bCols = baseline.tables[tableName].columns || {};
    const cCols = current.tables[tableName].columns || {};

    Object.keys(cCols).forEach((colName) => {
      if (!bCols[colName]) return;
      const bc = bCols[colName];
      const cc = cCols[colName];

      if (!bc.pk && cc.pk) added.push({ tableName, columnName: colName, constraintType: 'PRIMARY KEY' });
      if (bc.pk && !cc.pk) deleted.push({ tableName, columnName: colName, constraintType: 'PRIMARY KEY' });
      if (!bc.unique && cc.unique) added.push({ tableName, columnName: colName, constraintType: 'UNIQUE' });
      if (bc.unique && !cc.unique) deleted.push({ tableName, columnName: colName, constraintType: 'UNIQUE' });
      if (bc.nullable && !cc.nullable) added.push({ tableName, columnName: colName, constraintType: 'NOT NULL' });
      if (!bc.nullable && cc.nullable) deleted.push({ tableName, columnName: colName, constraintType: 'NOT NULL' });
    });
  });

  return { added, deleted, modified: [] };
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  return String(value);
};

export const formatChangesForDisplay = (changes: DetectedChanges | null) => {
  if (!changes) return null;
  const sections = [];

  const tableCount = changes.tables.added.length + changes.tables.deleted.length + changes.tables.renamed.length;
  if (tableCount > 0) {
    sections.push({
      title: 'Table Changes',
      count: tableCount,
      items: [
        ...changes.tables.added.map((t) => ({ type: 'added', description: `Table "${t.tableName}" added with ${t.columns.length} columns` })),
        ...changes.tables.deleted.map((t) => ({ type: 'deleted', description: `Table "${t.tableName}" deleted` })),
        ...changes.tables.renamed.map((t) => ({ type: 'renamed', description: `Table renamed: "${t.oldName}" → "${t.newName}"` })),
      ],
    });
  }

  const colCount = changes.columns.added.length + changes.columns.deleted.length + changes.columns.renamed.length + changes.columns.modified.length;
  if (colCount > 0) {
    sections.push({
      title: 'Column Changes',
      count: colCount,
      items: [
        ...changes.columns.added.map((c) => ({ type: 'added', description: `Column "${c.tableName}.${c.columnName}" added (${c.type})` })),
        ...changes.columns.deleted.map((c) => ({ type: 'deleted', description: `Column "${c.tableName}.${c.columnName}" deleted` })),
        ...changes.columns.renamed.map((c) => ({ type: 'renamed', description: `Column renamed: "${c.tableName}.${c.oldName}" → "${c.newName}"` })),
        ...changes.columns.modified.map((c) => ({ type: 'modified', description: `Column "${c.tableName}.${c.columnName}" modified`, details: c.changes.map((ch) => `${ch.property}: ${formatValue(ch.oldValue)} → ${formatValue(ch.newValue)}`) })),
      ],
    });
  }

  const relCount = changes.relationships.added.length + changes.relationships.deleted.length;
  if (relCount > 0) {
    sections.push({
      title: 'Foreign Key Changes',
      count: relCount,
      items: [
        ...changes.relationships.added.map((r) => ({ type: 'added', description: `Relationship added: ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}` })),
        ...changes.relationships.deleted.map((r) => ({ type: 'deleted', description: `Relationship deleted: ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}` })),
      ],
    });
  }

  const conCount = changes.constraints.added.length + changes.constraints.deleted.length;
  if (conCount > 0) {
    sections.push({
      title: 'Constraints',
      count: conCount,
      items: [
        ...changes.constraints.added.map((c) => ({ type: 'added', description: `${c.constraintType} added to ${c.tableName}.${c.columnName}` })),
        ...changes.constraints.deleted.map((c) => ({ type: 'deleted', description: `${c.constraintType} removed from ${c.tableName}.${c.columnName}` })),
      ],
    });
  }

  return sections;
};
