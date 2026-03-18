import {
  createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import persistenceService from '../services/persistenceService';
import {
  saveBaselineSchema, loadBaselineSchema, clearBaselineSchema,
  saveRealDbHistory, loadRealDbHistory, clearRealDbHistory,
  saveToStorage, saveTablePositions, loadTablePositions, clearTablePositions,
  loadFromStorage, loadFromDatabase, loadBaselineFromDatabase,
  clearFromStorage, clearAllFromStorage, getStorageTimestamp,
  checkForNewerChanges as checkForNewerChangesFn,
} from '../utils/persistenceAdapter';
import type { ERDData, TableData, ColumnData, Relationship, TablePositions, RealDbHistoryEntry } from '../types';

// ============================================================
// Types
// ============================================================

export interface SaveResult {
  success: boolean;
  reason?: string;
  hasNewerChanges?: boolean;
  error?: unknown;
}

export interface MergeSummary {
  newFromDatabase: string[];
  addedByUser: string[];
  modifiedByUser: string[];
  totalTables: number;
}

export interface JunctionInfo {
  isJunction: boolean;
  junctionFor?: string[];
}

export interface NMRelationshipResult {
  junctionTableName: string;
  relationship1Id: string;
  relationship2Id: string;
}

export interface VirtualSchemaContextValue {
  originalSchema: ERDData | null;
  workingSchema: ERDData | null;
  isModified: boolean;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  lastSavedTimestamp: number | null;
  setLastSavedTimestamp: (v: number) => void;
  connectionPrefix: string | null;
  isSwitchingSchema: boolean;
  canUndo: boolean;
  canRedo: boolean;
  tablePositions: TablePositions;
  initializeSchema: (erdData: ERDData, connId?: string | null, isFromPersistenceDB?: boolean) => Promise<void>;
  resetToOriginal: () => Promise<void>;
  forceRefreshFromBackend: () => void;
  refreshAndMerge: (newRealSchema: ERDData) => Promise<ERDData | undefined>;
  saveChangesToPersistence: () => Promise<SaveResult>;
  refreshFromPersistence: () => Promise<boolean>;
  resetUnsavedChanges: () => Promise<boolean>;
  checkForNewerChanges: () => Promise<boolean>;
  clearVirtualSchema: () => Promise<void>;
  clearAllVirtualSchemas: () => void;
  updateWorkingSchema: (schema: ERDData) => void;
  setOriginalSchema: (schema: ERDData | null) => void;
  undo: () => void;
  redo: () => void;
  addTable: (tableName: string) => void;
  deleteTable: (tableName: string) => void;
  renameTable: (oldName: string, newName: string) => void;
  addColumn: (tableName: string, columnName: string, columnData?: Partial<ColumnData>) => void;
  deleteColumn: (tableName: string, columnName: string) => void;
  updateColumn: (tableName: string, columnName: string, updates: Partial<ColumnData>) => void;
  renameColumn: (tableName: string, oldName: string, newName: string) => void;
  togglePrimaryKey: (tableName: string, columnName: string) => void;
  toggleUnique: (tableName: string, columnName: string) => void;
  toggleNullable: (tableName: string, columnName: string) => void;
  addRelationship: (fromTable: string, fromColumn: string, toTable: string, toColumn: string, type?: string) => void;
  addForeignKeyWithNewColumn: (fromTable: string, newColumnName: string, columnType: string, toTable: string, toColumn: string, type?: string) => string | undefined;
  updateForeignKeyColumn: (tableName: string, oldColumnName: string, newColumnName: string, toTable: string, toColumn: string) => string | undefined;
  updateForeignKeyWithNewColumn: (tableName: string, oldColumnName: string, newColumnName: string, newColumnType: string, toTable: string, toColumn: string) => string | undefined;
  addManyToManyRelationship: (table1: string, table1Column: string, table2: string, table2Column: string, junctionTableName?: string | null) => NMRelationshipResult | undefined;
  isTableJunctionTable: (tableName: string, tableData: TableData) => JunctionInfo;
  deleteRelationship: (relationshipId: string) => void;
  createVirtualRelationship: (relationshipData: unknown) => Promise<boolean | undefined>;
  updateTablePosition: (tableName: string, position: { x: number; y: number }) => void;
  clearAllTablePositions: () => void;
  cleanupOffScreenPositions: () => void;
  getMergeSummary: (realSchema: ERDData, virtualSchema: ERDData) => MergeSummary | null;
}

const VirtualSchemaContext = createContext<VirtualSchemaContextValue | null>(null);

export const useVirtualSchema = (): VirtualSchemaContextValue => {
  const context = useContext(VirtualSchemaContext);
  if (!context) throw new Error('useVirtualSchema must be used within VirtualSchemaProvider');
  return context;
};

// ============================================================
// Provider
// ============================================================

export const VirtualSchemaProvider = ({ children }: { children: ReactNode }) => {
  const [originalSchema, setOriginalSchema] = useState<ERDData | null>(null);
  const [workingSchema, setWorkingSchema] = useState<ERDData | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [history, setHistory] = useState<ERDData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentSchemaName, setCurrentSchemaName] = useState<string | null>(null);
  const [tablePositions, setTablePositions] = useState<TablePositions>({});
  const [isSwitchingSchema, setIsSwitchingSchema] = useState(false);
  const [realDbHistory, setRealDbHistory] = useState<RealDbHistoryEntry[]>([]);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionPrefix, setConnectionPrefix] = useState<string | null>(null);
  const historyIndexRef = useRef(-1);
  const historyRef = useRef<ERDData[]>([]);

  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    if (currentSchemaName && Object.keys(tablePositions).length > 0) {
      const key = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
      saveTablePositions(key, tablePositions).catch((err) => console.warn('Failed to save table positions:', err));
    }
  }, [tablePositions, currentSchemaName, connectionPrefix]);

  const applyFKDetection = (schema: ERDData): ERDData => {
    const updatedSchema: ERDData = JSON.parse(JSON.stringify(schema));
    Object.values(updatedSchema.tables).forEach((table) => {
      Object.values(table.columns).forEach((column) => {
        (column as ColumnData & { fk: boolean; isPkAndFk: boolean }).fk = false;
        (column as ColumnData & { isPkAndFk: boolean }).isPkAndFk = false;
      });
    });
    (updatedSchema.relationships || []).forEach((rel) => {
      const col = updatedSchema.tables[rel.fromTable]?.columns[rel.fromColumn];
      if (col) {
        col.fk = true;
        if (col.pk) (col as ColumnData & { isPkAndFk: boolean }).isPkAndFk = true;
      }
    });
    return updatedSchema;
  };

  const recalculateIsIdentifying = useCallback((schema: ERDData): ERDData => {
    if (!schema?.tables || !schema?.relationships) return schema;
    return {
      ...schema,
      relationships: schema.relationships.map((rel) => {
        const fkColumn = schema.tables[rel.fromTable]?.columns[rel.fromColumn];
        if (!fkColumn) return rel;
        const isIdentifying = fkColumn.pk === true;
        const isOneToOne = fkColumn.pk || fkColumn.unique;
        return { ...rel, isIdentifying, cardinalityType: isOneToOne ? '1:1' : '1:N', type: (isOneToOne ? 'ONE_TO_ONE' : 'ONE_TO_MANY') as Relationship['type'] };
      }),
    };
  }, []);

  const mergeSchemas = useCallback((
    realSchema: ERDData, virtualSchema: ERDData,
    originalSchema: ERDData | null = null, dbHistory: RealDbHistoryEntry[] = []
  ): ERDData => {
    const merged: ERDData = JSON.parse(JSON.stringify(realSchema));

    Object.keys(virtualSchema.tables).forEach((tableName) => {
      const virtualTable = virtualSchema.tables[tableName];
      const realTable = realSchema.tables[tableName];
      const existedInBaseline = originalSchema?.tables?.[tableName];

      if (realTable) {
        if (!existedInBaseline) {
          merged.tables[tableName] = JSON.parse(JSON.stringify(realTable));
          return;
        }
        merged.tables[tableName] = { ...realTable, columns: {} };
        Object.keys(realTable.columns).forEach((columnName) => {
          const realColumn = realTable.columns[columnName];
          const virtualColumn = virtualTable.columns[columnName];
          merged.tables[tableName].columns[columnName] = virtualColumn
            ? { ...realColumn, ...virtualColumn, type: realColumn.type, autoIncrement: realColumn.autoIncrement }
            : realColumn;
        });
        Object.keys(virtualTable.columns).forEach((columnName) => {
          if (!realTable.columns[columnName] && virtualTable.columns[columnName].isUserCreated) {
            merged.tables[tableName].columns[columnName] = virtualTable.columns[columnName];
          }
        });
      } else {
        if (originalSchema?.tables?.[tableName]) {
          delete merged.tables[tableName];
        } else {
          merged.tables[tableName] = virtualTable;
        }
      }
    });

    Object.keys(realSchema.tables).forEach((tableName) => {
      if (!virtualSchema.tables[tableName]) merged.tables[tableName] = realSchema.tables[tableName];
    });

    const validRelationships = (merged.relationships || []).filter((rel) => {
      const ft = merged.tables[rel.fromTable], tt = merged.tables[rel.toTable];
      return ft && tt && ft.columns[rel.fromColumn] && tt.columns[rel.toColumn];
    });

    const realRelationshipKeys = new Set((realSchema.relationships || []).map((r) => `${r.fromTable}.${r.fromColumn}->${r.toTable}.${r.toColumn}`));
    const relationshipMap = new Map<string, Relationship>();
    validRelationships.forEach((rel) => { relationshipMap.set(`${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`, rel); });

    (virtualSchema.relationships || []).forEach((rel) => {
      const ft = merged.tables[rel.fromTable], tt = merged.tables[rel.toTable];
      if (!ft || !tt || !ft.columns[rel.fromColumn] || !tt.columns[rel.toColumn]) return;
      const fromInReal = realSchema.tables[rel.fromTable], toInReal = realSchema.tables[rel.toTable];
      const fromInBaseline = originalSchema?.tables?.[rel.fromTable], toInBaseline = originalSchema?.tables?.[rel.toTable];
      if ((fromInReal && !fromInBaseline) || (toInReal && !toInBaseline)) return;

      const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
      const existsInRealDB = realRelationshipKeys.has(key);
      const cleanedRel = { ...rel };
      if (existsInRealDB && cleanedRel.isUserCreated) { cleanedRel.isSynced = true; delete cleanedRel.isUserCreated; delete cleanedRel.createdAt; }
      else if (!existsInRealDB && cleanedRel.isSynced) { cleanedRel.isUserCreated = true; cleanedRel.createdAt = Date.now(); delete cleanedRel.isSynced; }
      else if (!existsInRealDB && !cleanedRel.isUserCreated && !cleanedRel.isSynced) return;
      relationshipMap.set(key, cleanedRel);
    });

    merged.relationships = Array.from(relationshipMap.values());
    merged.schemaName = virtualSchema.schemaName || realSchema.schemaName;
    return merged;
  }, []);

  const getMergeSummary = useCallback((realSchema: ERDData, virtualSchema: ERDData): MergeSummary | null => {
    if (!realSchema || !virtualSchema) return null;
    const realTables = Object.keys(realSchema.tables || {});
    const virtualTables = Object.keys(virtualSchema.tables || {});
    return {
      newFromDatabase: realTables.filter((t) => !virtualSchema.tables[t]),
      addedByUser: virtualTables.filter((t) => !realSchema.tables[t]),
      modifiedByUser: realTables.filter((t) => virtualSchema.tables[t]),
      totalTables: Math.max(realTables.length, virtualTables.length),
    };
  }, []);

  const initializeSchema = useCallback(async (erdData: ERDData, connId: string | null = null, isFromPersistenceDB = false) => {
    if (!erdData) return;
    const schemaName = erdData.schemaName;
    if (connId !== null) { setConnectionId(connId); setConnectionPrefix(connId); } else { setConnectionPrefix(null); }
    const persistenceKey = connId ? `${connId}${schemaName}` : schemaName;

    if (currentSchemaName && currentSchemaName !== schemaName) {
      setIsSwitchingSchema(true);
      const savedTablePositions = await loadTablePositions(persistenceKey);
      const savedSchema = await loadFromStorage(persistenceKey);
      let newWorkingSchema: ERDData, newHistory: ERDData[], newHistoryIndex: number, newIsModified: boolean;

      if (savedSchema) {
        const switchingRealDbHistory: RealDbHistoryEntry[] = [{ timestamp: Date.now(), tables: Object.keys(erdData.tables || {}), schema: JSON.parse(JSON.stringify(erdData)) }];
        let mergedSchema = mergeSchemas(erdData, savedSchema, erdData, switchingRealDbHistory);
        mergedSchema = applyFKDetection(mergedSchema);
        newWorkingSchema = recalculateIsIdentifying(mergedSchema);
        newHistory = [JSON.parse(JSON.stringify(erdData)), newWorkingSchema];
        newHistoryIndex = 1; newIsModified = true;
      } else {
        newWorkingSchema = JSON.parse(JSON.stringify(erdData));
        newHistory = [newWorkingSchema]; newHistoryIndex = 0; newIsModified = false;
      }

      setCurrentSchemaName(schemaName); setOriginalSchema(erdData); setTablePositions(savedTablePositions);
      setWorkingSchema(newWorkingSchema); setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(newHistoryIndex); historyIndexRef.current = newHistoryIndex;
      setIsModified(newIsModified); setHasUnsavedChanges(false); setIsSwitchingSchema(false);
      return;
    }

    setCurrentSchemaName(schemaName);
    let baselineSchema = await loadBaselineSchema(persistenceKey, null);
    if (!baselineSchema) { await saveBaselineSchema(persistenceKey, erdData, null); baselineSchema = erdData; }
    setOriginalSchema(baselineSchema);

    const updatedRealDbHistory = await (async () => {
      const currentRealTables = Object.keys(erdData.tables || {});
      const existingHistory = await loadRealDbHistory(persistenceKey);
      if (currentSchemaName !== schemaName || existingHistory.length === 0) {
        const newHist: RealDbHistoryEntry[] = [{ timestamp: Date.now(), tables: currentRealTables, schema: JSON.parse(JSON.stringify(erdData)) }];
        await saveRealDbHistory(persistenceKey, newHist); return newHist;
      }
      const lastEntry = existingHistory[existingHistory.length - 1];
      const tablesChanged = currentRealTables.length !== lastEntry.tables.length || !currentRealTables.every((t) => lastEntry.tables.includes(t));
      if (tablesChanged) {
        const updatedHist = [...existingHistory, { timestamp: Date.now(), tables: currentRealTables, schema: JSON.parse(JSON.stringify(erdData)) }].slice(-50);
        await saveRealDbHistory(persistenceKey, updatedHist); return updatedHist;
      }
      return existingHistory;
    })();
    setRealDbHistory(updatedRealDbHistory);

    const savedTablePositions = await loadTablePositions(persistenceKey);
    setTablePositions(savedTablePositions);

    const savedSchema = await loadFromDatabase(persistenceKey);
    if (savedSchema) {
      const dbTimestamp = await persistenceService.getVirtualSchemaTimestamp(persistenceKey);
      if (dbTimestamp) setLastSavedTimestamp(dbTimestamp);
      let updatedSchema = applyFKDetection(savedSchema);
      updatedSchema = recalculateIsIdentifying(updatedSchema);
      setWorkingSchema(updatedSchema);
      const newHistory = [updatedSchema]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(true); setHasUnsavedChanges(false);
    } else {
      const clonedSchema: ERDData = JSON.parse(JSON.stringify(erdData));
      setWorkingSchema(clonedSchema);
      const newHistory = [clonedSchema]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(false); setHasUnsavedChanges(false);
    }
  }, [currentSchemaName, mergeSchemas, recalculateIsIdentifying]);

  const refreshAndMerge = useCallback(async (newRealSchema: ERDData): Promise<ERDData | undefined> => {
    if (!workingSchema || !currentSchemaName) return;
    const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
    try {
      let baselineSchema = await loadBaselineSchema(pKey, null);
      if (!baselineSchema) { baselineSchema = originalSchema; if (baselineSchema) await saveBaselineSchema(pKey, baselineSchema, null); }

      const realTables = Object.keys(newRealSchema.tables || {});
      const baselineTables = Object.keys(baselineSchema?.tables || {});
      let baselineNeedsUpdate = false;
      const updatedBaseline: ERDData = JSON.parse(JSON.stringify(baselineSchema || { schemaName: newRealSchema.schemaName, tables: {}, relationships: [] }));
      if (!updatedBaseline.tables) updatedBaseline.tables = {};

      realTables.filter((t) => !baselineTables.includes(t)).forEach((tableName) => { updatedBaseline.tables[tableName] = newRealSchema.tables[tableName]; baselineNeedsUpdate = true; });

      Object.keys(updatedBaseline.tables || {}).forEach((tableName) => {
        const baselineTable = updatedBaseline.tables[tableName];
        const realTable = newRealSchema.tables[tableName];
        if (realTable && baselineTable.columns) {
          const baselineCols = Object.keys(baselineTable.columns);
          const realCols = Object.keys(realTable.columns);
          baselineCols.forEach((col) => { if (!realCols.includes(col)) { delete updatedBaseline.tables[tableName].columns[col]; baselineNeedsUpdate = true; } });
          realCols.forEach((col) => { if (!baselineCols.includes(col)) { updatedBaseline.tables[tableName].columns[col] = realTable.columns[col]; baselineNeedsUpdate = true; } });
          baselineCols.forEach((col) => {
            if (realCols.includes(col)) {
              const bc = updatedBaseline.tables[tableName].columns[col], rc = realTable.columns[col];
              if (bc.pk !== rc.pk || bc.unique !== rc.unique || bc.nullable !== rc.nullable) {
                updatedBaseline.tables[tableName].columns[col] = { ...bc, pk: rc.pk, unique: rc.unique, nullable: rc.nullable };
                baselineNeedsUpdate = true;
              }
            }
          });
        }
      });

      const baselineRelKeys = new Set((updatedBaseline.relationships || []).map((r) => `${r.fromTable}.${r.fromColumn}->${r.toTable}.${r.toColumn}`));
      const realRelKeys = new Set((newRealSchema.relationships || []).map((r) => `${r.fromTable}.${r.fromColumn}->${r.toTable}.${r.toColumn}`));
      if ([...realRelKeys].some((k) => !baselineRelKeys.has(k)) || [...baselineRelKeys].some((k) => !realRelKeys.has(k))) {
        updatedBaseline.relationships = newRealSchema.relationships || []; baselineNeedsUpdate = true;
      }

      if (baselineNeedsUpdate) { await saveBaselineSchema(pKey, updatedBaseline, null); baselineSchema = updatedBaseline; }

      const mergedSchema = mergeSchemas(newRealSchema, workingSchema, baselineSchema, realDbHistory);
      const deletedTables = Object.keys(baselineSchema?.tables || {}).filter((t) => !newRealSchema.tables[t]);
      if (deletedTables.length > 0) {
        mergedSchema.relationships = (mergedSchema.relationships || []).filter((rel) => !deletedTables.includes(rel.fromTable) && !deletedTables.includes(rel.toTable));
        deletedTables.forEach((t) => { delete mergedSchema.tables[t]; });
        const cleanedBaseline: ERDData = JSON.parse(JSON.stringify(baselineSchema));
        deletedTables.forEach((t) => { delete cleanedBaseline.tables[t]; });
        await saveBaselineSchema(pKey, cleanedBaseline, null);
        await saveToStorage(pKey, mergedSchema);
      }

      let finalSchema = applyFKDetection(mergedSchema);
      finalSchema = recalculateIsIdentifying(finalSchema);
      setWorkingSchema(finalSchema);
      const newHistory = [finalSchema]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(true); setHasUnsavedChanges(false);
      return finalSchema;
    } catch (error) { console.error('Error in refreshAndMerge:', error); throw error; }
  }, [workingSchema, currentSchemaName, connectionPrefix, realDbHistory, originalSchema, mergeSchemas, recalculateIsIdentifying]);

  const forceRefreshFromBackend = useCallback(() => {
    if (originalSchema && currentSchemaName) {
      const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
      const clonedOriginal: ERDData = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      const newHistory = [clonedOriginal]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(false);
      clearFromStorage(pKey);
    }
  }, [originalSchema, currentSchemaName, connectionPrefix]);

  const addToHistory = useCallback((newSchema: ERDData) => {
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory.slice(0, historyIndexRef.current + 1), JSON.parse(JSON.stringify(newSchema))];
      historyRef.current = newHistory; return newHistory;
    });
    const newIndex = historyIndexRef.current + 1;
    historyIndexRef.current = newIndex; setHistoryIndex(newIndex);
  }, []);

  const updateWorkingSchema = useCallback((newSchema: ERDData) => {
    setWorkingSchema(newSchema); addToHistory(newSchema); setIsModified(true); setHasUnsavedChanges(true);
  }, [addToHistory]);

  const protectSyncedFKs = useCallback((targetSchema: ERDData, currentRealSchema: ERDData | null): ERDData => {
    if (!currentRealSchema || !targetSchema) return targetSchema;
    const protectedSchema: ERDData = JSON.parse(JSON.stringify(targetSchema));
    const realFKs = new Map<string, Relationship>();
    (currentRealSchema.relationships || []).forEach((rel) => { realFKs.set(`${rel.fromTable}.${rel.fromColumn}`, rel); });

    realFKs.forEach((realRel, key) => {
      const [tableName, columnName] = key.split('.');
      if (!protectedSchema.tables[tableName] && currentRealSchema.tables[tableName]) {
        protectedSchema.tables[tableName] = JSON.parse(JSON.stringify(currentRealSchema.tables[tableName]));
      }
      if (protectedSchema.tables[tableName]) {
        if (!protectedSchema.tables[tableName].columns[columnName] && currentRealSchema.tables[tableName]?.columns[columnName]) {
          protectedSchema.tables[tableName].columns[columnName] = JSON.parse(JSON.stringify(currentRealSchema.tables[tableName].columns[columnName]));
        }
        if (protectedSchema.tables[tableName].columns[columnName]) protectedSchema.tables[tableName].columns[columnName].fk = true;
      }
      const relExists = (protectedSchema.relationships || []).some((rel) => rel.fromTable === realRel.fromTable && rel.fromColumn === realRel.fromColumn && rel.toTable === realRel.toTable && rel.toColumn === realRel.toColumn);
      if (!relExists) { if (!protectedSchema.relationships) protectedSchema.relationships = []; protectedSchema.relationships.push(JSON.parse(JSON.stringify(realRel))); }
    });
    return protectedSchema;
  }, []);

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1; setHistoryIndex(newIndex); historyIndexRef.current = newIndex;
      let previousState: ERDData = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      previousState = protectSyncedFKs(previousState, originalSchema);
      setWorkingSchema(previousState); setIsModified(newIndex !== 0); setHasUnsavedChanges(true);
    }
  }, [originalSchema, protectSyncedFKs]);

  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex < historyRef.current.length - 1) {
      const newIndex = currentIndex + 1; setHistoryIndex(newIndex); historyIndexRef.current = newIndex;
      let nextState: ERDData = JSON.parse(JSON.stringify(historyRef.current[newIndex]));
      nextState = protectSyncedFKs(nextState, originalSchema);
      setWorkingSchema(nextState); setIsModified(true); setHasUnsavedChanges(true);
    }
  }, [originalSchema, protectSyncedFKs]);

  const resetToOriginal = useCallback(async () => {
    if (originalSchema && currentSchemaName) {
      const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
      const clonedOriginal: ERDData = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      const newHistory = [clonedOriginal]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(false); setHasUnsavedChanges(false);
      await saveToStorage(pKey, clonedOriginal); setLastSavedTimestamp(Date.now());
    }
  }, [originalSchema, currentSchemaName, connectionPrefix]);

  const saveChangesToPersistence = useCallback(async (): Promise<SaveResult> => {
    if (!workingSchema || !currentSchemaName || !hasUnsavedChanges) return { success: false, reason: 'no_changes' };
    const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
    try {
      const hasNewer = await checkForNewerChangesFn(pKey, lastSavedTimestamp ?? 0);
      if (hasNewer) return { success: false, reason: 'conflict', hasNewerChanges: true };
      await saveToStorage(pKey, workingSchema);
      const timestamp = Date.now(); setLastSavedTimestamp(timestamp); setHasUnsavedChanges(false);
      const newHistory = [JSON.parse(JSON.stringify(workingSchema))]; setHistory(newHistory); historyRef.current = newHistory;
      setHistoryIndex(0); historyIndexRef.current = 0;
      return { success: true };
    } catch (error) { console.error('Error saving to persistence:', error); return { success: false, reason: 'error', error }; }
  }, [workingSchema, currentSchemaName, connectionPrefix, hasUnsavedChanges, lastSavedTimestamp]);

  const refreshFromPersistence = useCallback(async (): Promise<boolean> => {
    if (!currentSchemaName || !originalSchema) return false;
    const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
    try {
      const savedSchema = await loadFromDatabase(pKey);
      const baselineSchema = await loadBaselineFromDatabase(pKey);
      if (savedSchema) {
        const merged = mergeSchemas(originalSchema, savedSchema, baselineSchema, realDbHistory);
        setWorkingSchema(merged);
        const newHistory = [JSON.parse(JSON.stringify(merged))]; setHistory(newHistory); historyRef.current = newHistory;
        setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(true);
      } else {
        const clonedOriginal: ERDData = JSON.parse(JSON.stringify(originalSchema));
        setWorkingSchema(clonedOriginal);
        const newHistory = [clonedOriginal]; setHistory(newHistory); historyRef.current = newHistory;
        setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(false);
      }
      setLastSavedTimestamp(Date.now()); setHasUnsavedChanges(false); return true;
    } catch (error) { console.error('Error refreshing from persistence:', error); return false; }
  }, [currentSchemaName, connectionPrefix, originalSchema, realDbHistory, mergeSchemas]);

  const checkForNewerChanges = useCallback(async (): Promise<boolean> => {
    if (!currentSchemaName || !lastSavedTimestamp) return false;
    const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
    try { return await checkForNewerChangesFn(pKey, lastSavedTimestamp); } catch { return false; }
  }, [currentSchemaName, connectionPrefix, lastSavedTimestamp]);

  const resetUnsavedChanges = useCallback(async (): Promise<boolean> => {
    if (!currentSchemaName || !originalSchema) return false;
    const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
    try {
      const savedSchema = await loadFromDatabase(pKey);
      const baselineSchema = await loadBaselineFromDatabase(pKey);
      if (savedSchema) {
        const merged = mergeSchemas(originalSchema, savedSchema, baselineSchema, realDbHistory);
        setWorkingSchema(merged);
        const newHistory = [JSON.parse(JSON.stringify(merged))]; setHistory(newHistory); historyRef.current = newHistory;
        setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(true); setHasUnsavedChanges(false);
      } else {
        const clonedOriginal: ERDData = JSON.parse(JSON.stringify(originalSchema));
        setWorkingSchema(clonedOriginal);
        const newHistory = [clonedOriginal]; setHistory(newHistory); historyRef.current = newHistory;
        setHistoryIndex(0); historyIndexRef.current = 0; setIsModified(false); setHasUnsavedChanges(false);
      }
      return true;
    } catch (error) { console.error('Error resetting unsaved changes:', error); return false; }
  }, [currentSchemaName, connectionPrefix, originalSchema, realDbHistory, mergeSchemas]);

  const clearVirtualSchema = useCallback(async () => {
    if (currentSchemaName) {
      const pKey = connectionPrefix ? `${connectionPrefix}${currentSchemaName}` : currentSchemaName;
      await clearFromStorage(pKey); await clearRealDbHistory(pKey); await clearBaselineSchema(pKey, connectionId);
    }
    setWorkingSchema(null); setOriginalSchema(null); setHistory([]); historyRef.current = [];
    setHistoryIndex(-1); historyIndexRef.current = -1; setIsModified(false); setCurrentSchemaName(null); setRealDbHistory([]);
  }, [currentSchemaName, connectionPrefix, connectionId]);

  const clearAllVirtualSchemas = useCallback(() => {
    clearAllFromStorage(); setWorkingSchema(null); setOriginalSchema(null); setHistory([]); historyRef.current = [];
    setHistoryIndex(-1); historyIndexRef.current = -1; setIsModified(false); setCurrentSchemaName(null);
  }, []);

  // TABLE OPERATIONS
  const addTable = useCallback((tableName: string) => {
    if (!workingSchema) return;
    if (workingSchema.tables[tableName]) throw new Error(`Table "${tableName}" already exists`);
    updateWorkingSchema({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { name: tableName, columns: {} } } });
  }, [workingSchema, updateWorkingSchema]);

  const deleteTable = useCallback((tableName: string) => {
    if (!workingSchema) return;
    const newSchema = { ...workingSchema };
    delete newSchema.tables[tableName];
    newSchema.relationships = (newSchema.relationships || []).filter((rel) => rel.fromTable !== tableName && rel.toTable !== tableName);
    updateWorkingSchema(newSchema);
  }, [workingSchema, updateWorkingSchema]);

  const renameTable = useCallback((oldName: string, newName: string) => {
    if (!workingSchema) return;
    if (workingSchema.tables[newName]) throw new Error(`Table "${newName}" already exists`);
    const newSchema = { ...workingSchema };
    newSchema.tables[newName] = { ...newSchema.tables[oldName], name: newName };
    delete newSchema.tables[oldName];
    newSchema.relationships = (newSchema.relationships || []).map((rel) => ({ ...rel, fromTable: rel.fromTable === oldName ? newName : rel.fromTable, toTable: rel.toTable === oldName ? newName : rel.toTable }));
    updateWorkingSchema(newSchema);
  }, [workingSchema, updateWorkingSchema]);

  // COLUMN OPERATIONS
  const addColumn = useCallback((tableName: string, columnName: string, columnData: Partial<ColumnData> = {}) => {
    if (!workingSchema?.tables[tableName]) return;
    if (workingSchema.tables[tableName].columns[columnName]) throw new Error(`Column "${columnName}" already exists in table "${tableName}"`);
    updateWorkingSchema({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: { ...workingSchema.tables[tableName].columns, [columnName]: { type: columnData.type || 'VARCHAR(255)', pk: columnData.pk || false, fk: columnData.fk || false, unique: columnData.unique || false, nullable: columnData.nullable !== undefined ? columnData.nullable : true, autoIncrement: columnData.autoIncrement || false } } } } });
  }, [workingSchema, updateWorkingSchema]);

  const deleteColumn = useCallback((tableName: string, columnName: string) => {
    if (!workingSchema?.tables[tableName]) return;
    const newColumns = Object.fromEntries(Object.entries(workingSchema.tables[tableName].columns).filter(([k]) => k !== columnName));
    updateWorkingSchema({ ...workingSchema, relationships: (workingSchema.relationships || []).filter((rel) => !(rel.fromTable === tableName && rel.fromColumn === columnName) && !(rel.toTable === tableName && rel.toColumn === columnName)), tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: newColumns } } });
  }, [workingSchema, updateWorkingSchema]);

  const updateColumn = useCallback((tableName: string, columnName: string, updates: Partial<ColumnData>) => {
    if (!workingSchema?.tables[tableName]) return;
    updateWorkingSchema({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: { ...workingSchema.tables[tableName].columns, [columnName]: { ...workingSchema.tables[tableName].columns[columnName], ...updates } } } } });
  }, [workingSchema, updateWorkingSchema]);

  const renameColumn = useCallback((tableName: string, oldName: string, newName: string) => {
    if (!workingSchema?.tables[tableName]) return;
    if (workingSchema.tables[tableName].columns[newName]) throw new Error(`Column "${newName}" already exists in table "${tableName}"`);
    const newSchema = { ...workingSchema };
    newSchema.tables[tableName].columns[newName] = { ...newSchema.tables[tableName].columns[oldName] };
    delete newSchema.tables[tableName].columns[oldName];
    newSchema.relationships = (newSchema.relationships || []).map((rel) => ({ ...rel, fromColumn: rel.fromTable === tableName && rel.fromColumn === oldName ? newName : rel.fromColumn, toColumn: rel.toTable === tableName && rel.toColumn === oldName ? newName : rel.toColumn }));
    updateWorkingSchema(newSchema);
  }, [workingSchema, updateWorkingSchema]);

  // CONSTRAINT OPERATIONS
  const togglePrimaryKey = useCallback((tableName: string, columnName: string) => {
    if (!workingSchema?.tables[tableName]) return;
    const currentColumn = workingSchema.tables[tableName].columns[columnName];
    const newColumns = { ...workingSchema.tables[tableName].columns };
    if (!currentColumn.pk) Object.keys(newColumns).forEach((col) => { newColumns[col] = { ...newColumns[col], pk: false }; });
    newColumns[columnName] = { ...currentColumn, pk: !currentColumn.pk, nullable: !currentColumn.pk ? false : currentColumn.nullable };
    updateWorkingSchema(recalculateIsIdentifying({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: newColumns } } }));
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const toggleUnique = useCallback((tableName: string, columnName: string) => {
    if (!workingSchema?.tables[tableName]) return;
    updateWorkingSchema(recalculateIsIdentifying({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: { ...workingSchema.tables[tableName].columns, [columnName]: { ...workingSchema.tables[tableName].columns[columnName], unique: !workingSchema.tables[tableName].columns[columnName].unique } } } } }));
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const toggleNullable = useCallback((tableName: string, columnName: string) => {
    if (!workingSchema?.tables[tableName]) return;
    updateWorkingSchema({ ...workingSchema, tables: { ...workingSchema.tables, [tableName]: { ...workingSchema.tables[tableName], columns: { ...workingSchema.tables[tableName].columns, [columnName]: { ...workingSchema.tables[tableName].columns[columnName], nullable: !workingSchema.tables[tableName].columns[columnName].nullable } } } } });
  }, [workingSchema, updateWorkingSchema]);

  // RELATIONSHIP OPERATIONS
  const addRelationship = useCallback((fromTable: string, fromColumn: string, toTable: string, toColumn: string, type = 'ONE_TO_MANY') => {
    if (!workingSchema) return;
    const currentRelationships = workingSchema.relationships || [];
    if (currentRelationships.some((rel) => rel.fromTable === fromTable && rel.fromColumn === fromColumn && rel.toTable === toTable && rel.toColumn === toColumn)) throw new Error('Relationship already exists');
    const newRelationship: Relationship = { fromTable, fromColumn, toTable, toColumn, type: type as Relationship['type'], isUserCreated: true, createdAt: Date.now() };
    updateWorkingSchema(recalculateIsIdentifying({ ...workingSchema, relationships: [...currentRelationships, newRelationship], tables: { ...workingSchema.tables, [fromTable]: { ...workingSchema.tables[fromTable], columns: { ...workingSchema.tables[fromTable].columns, [fromColumn]: { ...workingSchema.tables[fromTable].columns[fromColumn], fk: true } } } } }));
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const addForeignKeyWithNewColumn = useCallback((fromTable: string, newColumnName: string, columnType: string, toTable: string, toColumn: string, type = 'ONE_TO_MANY'): string | undefined => {
    if (!workingSchema) return;
    if (workingSchema.tables[fromTable]?.columns[newColumnName]) throw new Error(`Column "${newColumnName}" already exists in table "${fromTable}"`);
    const currentRelationships = workingSchema.relationships || [];
    if (currentRelationships.some((rel) => rel.fromTable === fromTable && rel.fromColumn === newColumnName && rel.toTable === toTable && rel.toColumn === toColumn)) throw new Error('Relationship already exists');
    const id = uuidv4();
    const newRelationship: Relationship = { fromTable, fromColumn: newColumnName, toTable, toColumn, type: type as Relationship['type'], isUserCreated: true, createdAt: Date.now() };
    updateWorkingSchema(recalculateIsIdentifying({ ...workingSchema, relationships: [...currentRelationships, newRelationship], tables: { ...workingSchema.tables, [fromTable]: { ...workingSchema.tables[fromTable], columns: { ...workingSchema.tables[fromTable].columns, [newColumnName]: { type: columnType, pk: false, fk: true, unique: false, nullable: true, autoIncrement: false, isUserCreated: true } } } } }));
    return id;
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const deleteRelationship = useCallback((relationshipId: string) => {
    if (!workingSchema) return;
    const currentRelationships = workingSchema.relationships || [];
    const rel = currentRelationships.find((r) => (r as Relationship & { id?: string }).id === relationshipId);
    if (!rel) return;
    const newRelationships = currentRelationships.filter((r) => (r as Relationship & { id?: string }).id !== relationshipId);
    const otherRefs = newRelationships.filter((r) => r.fromTable === rel.fromTable && r.fromColumn === rel.fromColumn);
    const fkColumn = workingSchema.tables[rel.fromTable]?.columns[rel.fromColumn];
    const existsInOriginalDB = originalSchema?.tables?.[rel.fromTable]?.columns?.[rel.fromColumn];
    const shouldDeleteColumn = (fkColumn as ColumnData & { isUserCreated?: boolean })?.isUserCreated && otherRefs.length === 0 && !existsInOriginalDB;
    let newSchema = { ...workingSchema, relationships: newRelationships };
    if (shouldDeleteColumn) {
      const { [rel.fromColumn]: _removed, ...remainingColumns } = workingSchema.tables[rel.fromTable].columns;
      newSchema.tables = { ...workingSchema.tables, [rel.fromTable]: { ...workingSchema.tables[rel.fromTable], columns: remainingColumns } };
    } else {
      newSchema.tables = { ...workingSchema.tables, [rel.fromTable]: { ...workingSchema.tables[rel.fromTable], columns: { ...workingSchema.tables[rel.fromTable].columns, [rel.fromColumn]: { ...workingSchema.tables[rel.fromTable].columns[rel.fromColumn], fk: otherRefs.length > 0 } } } };
    }
    updateWorkingSchema(newSchema);
  }, [workingSchema, updateWorkingSchema, originalSchema]);

  const updateForeignKeyColumn = useCallback((tableName: string, oldColumnName: string, newColumnName: string, toTable: string, toColumn: string): string | undefined => {
    if (!workingSchema) return;
    const oldRelationship = (workingSchema.relationships || []).find((rel) => rel.fromTable === tableName && rel.fromColumn === oldColumnName && rel.toTable === toTable);
    if (!oldRelationship) throw new Error('Old relationship not found');
    const oldColumn = workingSchema.tables[tableName]?.columns[oldColumnName];
    const shouldDeleteOldColumn = (oldColumn as ColumnData & { isUserCreated?: boolean })?.isUserCreated && oldColumnName !== newColumnName;
    let newSchema = { ...workingSchema };
    newSchema.relationships = (workingSchema.relationships || []).filter((rel) => (rel as Relationship & { id?: string }).id !== (oldRelationship as Relationship & { id?: string }).id);
    if (shouldDeleteOldColumn) { const { [oldColumnName]: _r, ...remaining } = newSchema.tables[tableName].columns; newSchema.tables = { ...newSchema.tables, [tableName]: { ...newSchema.tables[tableName], columns: remaining } }; }
    const id = uuidv4();
    const newRelationship: Relationship = { fromTable: tableName, fromColumn: newColumnName, toTable, toColumn, type: 'ONE_TO_MANY', isUserCreated: true, createdAt: Date.now() };
    newSchema.relationships = [...newSchema.relationships, newRelationship];
    newSchema.tables = { ...newSchema.tables, [tableName]: { ...newSchema.tables[tableName], columns: { ...newSchema.tables[tableName].columns, [newColumnName]: { ...newSchema.tables[tableName].columns[newColumnName], fk: true } } } };
    updateWorkingSchema(recalculateIsIdentifying(newSchema));
    return id;
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const updateForeignKeyWithNewColumn = useCallback((tableName: string, oldColumnName: string, newColumnName: string, newColumnType: string, toTable: string, toColumn: string): string | undefined => {
    if (!workingSchema) return;
    const oldRelationship = (workingSchema.relationships || []).find((rel) => rel.fromTable === tableName && rel.fromColumn === oldColumnName && rel.toTable === toTable);
    if (!oldRelationship) throw new Error('Old relationship not found');
    if (workingSchema.tables[tableName]?.columns[newColumnName]) throw new Error(`Column "${newColumnName}" already exists in table "${tableName}"`);
    let newSchema = { ...workingSchema };
    newSchema.relationships = (workingSchema.relationships || []).filter((rel) => (rel as Relationship & { id?: string }).id !== (oldRelationship as Relationship & { id?: string }).id);
    const otherRelsOnOldCol = newSchema.relationships.filter((rel) => rel.fromTable === tableName && rel.fromColumn === oldColumnName);
    if (otherRelsOnOldCol.length === 0) { newSchema.tables = { ...newSchema.tables, [tableName]: { ...newSchema.tables[tableName], columns: { ...newSchema.tables[tableName].columns, [oldColumnName]: { ...newSchema.tables[tableName].columns[oldColumnName], fk: false } } } }; }
    newSchema.tables = { ...newSchema.tables, [tableName]: { ...newSchema.tables[tableName], columns: { ...newSchema.tables[tableName].columns, [newColumnName]: { type: newColumnType, pk: false, fk: true, unique: false, nullable: true, autoIncrement: false, isUserCreated: true } } } };
    const id = uuidv4();
    const newRelationship: Relationship = { fromTable: tableName, fromColumn: newColumnName, toTable, toColumn, type: 'ONE_TO_MANY', isUserCreated: true, createdAt: Date.now() };
    newSchema.relationships = [...newSchema.relationships, newRelationship];
    updateWorkingSchema(recalculateIsIdentifying(newSchema));
    return id;
  }, [workingSchema, updateWorkingSchema, recalculateIsIdentifying]);

  const createVirtualRelationship = useCallback(async (relationshipData: unknown): Promise<boolean | undefined> => {
    if (!workingSchema) return;
    try {
      const { createRelationship, validateRelationshipCreation } = await import('../services/relationshipCreationService');
      const data = relationshipData as { parentTable: string; childTable: string; type: unknown };
      const errors = validateRelationshipCreation(workingSchema, data.parentTable, data.childTable, data.type as import('../types').RelationshipTypeDefinition);
      if (errors.length > 0) throw new Error(errors.join(', '));
      updateWorkingSchema(createRelationship(workingSchema, relationshipData as import('../services/relationshipCreationService').RelationshipCreationData));
      return true;
    } catch (error) { throw error; }
  }, [workingSchema, updateWorkingSchema]);

  const isTableJunctionTable = useCallback((tableName: string, tableData: TableData): JunctionInfo => {
    if ((tableData as TableData & { isJunctionTable?: boolean; junctionFor?: string[] }).isJunctionTable && (tableData as TableData & { junctionFor?: string[] }).junctionFor) {
      return { isJunction: true, junctionFor: (tableData as TableData & { junctionFor?: string[] }).junctionFor };
    }
    const columns = Object.entries(tableData.columns || {});
    const pkColumns = columns.filter(([, col]) => col.pk);
    const fkColumns = columns.filter(([, col]) => col.fk);
    if (pkColumns.length !== 2 || fkColumns.length < 2) return { isJunction: false };
    const pkFkColumns = pkColumns.filter(([, col]) => col.fk);
    if (pkFkColumns.length !== 2) return { isJunction: false };
    const relationships = workingSchema?.relationships || [];
    const referencedTables = pkFkColumns.map(([colName]) => relationships.find((r) => r.fromTable === tableName && r.fromColumn === colName)?.toTable).filter(Boolean) as string[];
    if (referencedTables.length === 2) return { isJunction: true, junctionFor: referencedTables.sort() };
    return { isJunction: false };
  }, [workingSchema]);

  const addManyToManyRelationship = useCallback((table1: string, table1Column: string, table2: string, table2Column: string, junctionTableName: string | null = null): NMRelationshipResult | undefined => {
    if (!workingSchema) return;
    const sortedTables = [table1, table2].sort();
    const existingJunctionTable = Object.entries(workingSchema.tables).find(([tblName, tableData]) => {
      const info = isTableJunctionTable(tblName, tableData);
      return info.isJunction && info.junctionFor && JSON.stringify(info.junctionFor.sort()) === JSON.stringify(sortedTables);
    });
    if (existingJunctionTable) throw new Error(`N:M relationship already exists between "${table1}" and "${table2}" via junction table "${existingJunctionTable[0]}".`);

    const finalJunctionName = junctionTableName || [table1, table2].sort().join('_');
    if (workingSchema.tables[finalJunctionName]) throw new Error(`Table "${finalJunctionName}" already exists in the schema.`);
    if (!workingSchema.tables[table1] || !workingSchema.tables[table2]) throw new Error('Both tables must exist in the schema');

    const table1Col = workingSchema.tables[table1].columns[table1Column];
    const table2Col = workingSchema.tables[table2].columns[table2Column];
    if (!table1Col || !table2Col) throw new Error('Both columns must exist in their respective tables');
    if (!table1Col.pk && !table1Col.unique) throw new Error(`Column "${table1Column}" in table "${table1}" must be PRIMARY KEY or UNIQUE`);
    if (!table2Col.pk && !table2Col.unique) throw new Error(`Column "${table2Column}" in table "${table2}" must be PRIMARY KEY or UNIQUE`);

    const generateFKName = (tableName: string, columnName: string) => {
      const tl = tableName.toLowerCase(), cl = columnName.toLowerCase();
      if (cl === 'id') return `${tl}_id`;
      if (cl.includes(tl)) return cl;
      return `${tl}_${cl}`;
    };
    let fk1Name = generateFKName(table1, table1Column);
    let fk2Name = generateFKName(table2, table2Column);
    if (table1 === table2 && fk1Name === fk2Name) { fk1Name += '_1'; fk2Name += '_2'; }

    const junctionTable: TableData & { isUserCreated?: boolean; isJunctionTable?: boolean; junctionFor?: string[] } = {
      name: finalJunctionName, isUserCreated: true, isJunctionTable: true, junctionFor: [table1, table2].sort(),
      columns: {
        [fk1Name]: { type: table1Col.type, pk: true, fk: true, unique: false, nullable: false, autoIncrement: false, isUserCreated: true, compositeKey: true },
        [fk2Name]: { type: table2Col.type, pk: true, fk: true, unique: false, nullable: false, autoIncrement: false, isUserCreated: true, compositeKey: true },
      },
    };

    const rel1Id = uuidv4(), rel2Id = uuidv4();
    const relationship1: Relationship = { fromTable: finalJunctionName, fromColumn: fk1Name, toTable: table1, toColumn: table1Column, type: 'ONE_TO_MANY', cardinalityType: '1:N', constraintName: `fk_${finalJunctionName}_${fk1Name}`, isUserCreated: true, createdAt: Date.now(), isIdentifying: true, isJunctionRelationship: true, junctionTable: finalJunctionName };
    const relationship2: Relationship = { fromTable: finalJunctionName, fromColumn: fk2Name, toTable: table2, toColumn: table2Column, type: 'ONE_TO_MANY', cardinalityType: '1:N', constraintName: `fk_${finalJunctionName}_${fk2Name}`, isUserCreated: true, createdAt: Date.now(), isIdentifying: true, isJunctionRelationship: true, junctionTable: finalJunctionName };

    updateWorkingSchema({ ...workingSchema, tables: { ...workingSchema.tables, [finalJunctionName]: junctionTable }, relationships: [...(workingSchema.relationships || []), relationship1, relationship2] });
    return { junctionTableName: finalJunctionName, relationship1Id: rel1Id, relationship2Id: rel2Id };
  }, [workingSchema, updateWorkingSchema, isTableJunctionTable]);

  const updateTablePosition = useCallback((tableName: string, position: { x: number; y: number }) => {
    setTablePositions((prev) => ({ ...prev, [tableName]: position }));
  }, []);

  const clearAllTablePositions = useCallback(() => {
    if (currentSchemaName) { clearTablePositions(currentSchemaName); setTablePositions({}); }
  }, [currentSchemaName]);

  const cleanupOffScreenPositions = useCallback(() => {
    if (!currentSchemaName) return;
    const cleaned: TablePositions = {};
    let hasChanges = false;
    Object.entries(tablePositions).forEach(([tableName, position]) => {
      if (Math.sqrt(position.x ** 2 + position.y ** 2) <= 2000) cleaned[tableName] = position;
      else hasChanges = true;
    });
    if (hasChanges) setTablePositions(cleaned);
  }, [currentSchemaName, tablePositions]);

  const value: VirtualSchemaContextValue = {
    originalSchema, workingSchema, isModified, hasUnsavedChanges, setHasUnsavedChanges,
    lastSavedTimestamp, setLastSavedTimestamp, connectionPrefix, isSwitchingSchema,
    canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1, tablePositions,
    initializeSchema, resetToOriginal, forceRefreshFromBackend, refreshAndMerge,
    saveChangesToPersistence, refreshFromPersistence, resetUnsavedChanges, checkForNewerChanges,
    clearVirtualSchema, clearAllVirtualSchemas, updateWorkingSchema, setOriginalSchema,
    undo, redo, addTable, deleteTable, renameTable, addColumn, deleteColumn, updateColumn, renameColumn,
    togglePrimaryKey, toggleUnique, toggleNullable, addRelationship, addForeignKeyWithNewColumn,
    updateForeignKeyColumn, updateForeignKeyWithNewColumn, addManyToManyRelationship,
    isTableJunctionTable, deleteRelationship, createVirtualRelationship,
    updateTablePosition, clearAllTablePositions, cleanupOffScreenPositions, getMergeSummary,
  };

  return <VirtualSchemaContext.Provider value={value}>{children}</VirtualSchemaContext.Provider>;
};
