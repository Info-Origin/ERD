import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualSchema } from '../../context/VirtualSchemaContext';
import { useApp } from '../../context/AppContext';
import { formatDataTypeForDisplay, getFullDataType } from '../../utils/dataTypeFormatter';
import type { ColumnData } from '../../types';
import {
  ALL_MYSQL_DATA_TYPES,
  DATA_TYPES_WITH_LENGTH,
  DATA_TYPES_WITH_DEFAULTS,
  COMMON_DEFAULTS,
  getBaseDataType,
  getTypeLength,
  buildFullType,
  areDataTypesCompatible,
} from '../../utils/mysqlDataTypes';
import { analyzeColumnChange, applyCascadingChanges } from '../../utils/conflictDetection';
import type { ConflictItem, CascadingChange } from '../../utils/conflictDetection';
import { ConflictWarningModal } from './ConflictWarningModal';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';
import { NMPreviewModal } from './NMPreviewModal';
import { getTableColumnNotes, saveColumnNote } from '../../services/columnNotesService';
import './Modal.css';
import './EditTableModal.css';
import './AlertModal.css';
import './ConfirmModal.css';

// ============================================================
// Local Types
// ============================================================

interface LocalColumn {
  name: string;
  originalName: string;
  type: string;
  pk: boolean;
  nullable: boolean;
  unique: boolean;
  fk: boolean;
  autoIncrement: boolean;
  baseType: string;
  typeLength: string;
  defaultValue: string;
  [key: string]: unknown;
}

interface LocalFK {
  id?: string;
  name: string;
  fromColumn: string;
  originalFromColumn?: string;
  newColumnName?: string;
  toTable: string;
  toColumn: string;
  onUpdate: string;
  onDelete: string;
  cardinality?: string;
  junctionTableName?: string;
  isNew?: boolean;
  isVirtual?: boolean;
}

interface AlertModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  type?: 'danger' | 'warning' | 'default';
}

interface NMPreviewModalState {
  isOpen: boolean;
  table1: string;
  table1Column: string;
  table2: string;
  table2Column: string;
  junctionTableName: string;
  fk1Name: string;
  fk2Name: string;
  table1Type: string;
  table2Type: string;
  onConfirm: (() => void) | null;
}

interface ConflictModalState {
  isOpen: boolean;
  conflicts: ConflictItem[];
  cascadingChanges: CascadingChange[];
  affectedTables: string[];
  changeDescription: string;
  pendingChange: PendingChange | null;
}

interface PendingChange {
  type: 'COLUMN_UPDATE' | 'CONSTRAINT_TOGGLE' | 'APPLY_CONSTRAINTS';
  index?: number;
  column?: LocalColumn;
  fullType?: string;
  newProperties?: Record<string, unknown>;
  constraintType?: string;
  newValue?: unknown;
  columnName?: string;
  changes?: Record<string, unknown>;
}

interface PendingConstraintChanges {
  [columnName: string]: Record<string, unknown>;
}

interface EditTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  schemaName: string;
}

// ============================================================
// CardinalityIcon Component
// ============================================================

interface CardinalityIconProps {
  cardinality: string;
  isIdentifying: boolean;
}

const CardinalityIcon: React.FC<CardinalityIconProps> = ({ cardinality, isIdentifying }) => {
  const strokeDasharray = isIdentifying ? 'none' : '2,2';

  if (cardinality === '1:1') {
    return (
      <svg width="30" height="12" viewBox="0 0 30 12" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
        <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray={strokeDasharray} />
        <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
        <circle cx="26" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
      </svg>
    );
  } else {
    return (
      <svg width="30" height="12" viewBox="0 0 30 12" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
        <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray={strokeDasharray} />
        <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
        <g>
          <line x1="26" y1="6" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
          <line x1="26" y1="2.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
          <line x1="26" y1="9.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }
};

// ============================================================
// EditTableModal Component
// ============================================================

const EditTableModal: React.FC<EditTableModalProps> = ({ isOpen, onClose, tableName, schemaName }) => {
  const {
    workingSchema,
    originalSchema,
    hasUnsavedChanges,
    addRelationship,
    addForeignKeyWithNewColumn,
    updateForeignKeyColumn,
    updateForeignKeyWithNewColumn,
    addManyToManyRelationship,
    isTableJunctionTable,
    deleteRelationship,
    deleteTable,
    deleteColumn,
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,
    updateColumn,
    addColumn,
    forceRefreshFromBackend,
  } = useVirtualSchema();

  const { registerEditTableModalRefresh } = useApp();

  const [activeTab, setActiveTab] = useState<string>('constraints');
  const [columns, setColumns] = useState<LocalColumn[]>([]);
  const [foreignKeys, setForeignKeys] = useState<LocalFK[]>([]);
  const [editingFK, setEditingFK] = useState<number | null>(null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [showAddFK, setShowAddFK] = useState(false);
  const [columnNotes, setColumnNotes] = useState<Record<string, string>>({});
  const [isApplyingConstraints, setIsApplyingConstraints] = useState(false);
  const [isSavingFK, setIsSavingFK] = useState(false);
  const previousColumnsRef = useRef<LocalColumn[]>([]);

  // Load column notes from database on mount
  useEffect(() => {
    const loadColumnNotes = async () => {
      if (isOpen && tableName && schemaName) {
        try {
          const notes = await getTableColumnNotes(schemaName, tableName);
          setColumnNotes(notes);
        } catch (error) {
          console.error('Failed to load column notes from database:', error);
          setColumnNotes({});
        }
      }
    };
    loadColumnNotes();
  }, [isOpen, tableName, schemaName]);

  // Save column notes to database with debounce
  useEffect(() => {
    if (!tableName || !schemaName) return;
    const timeoutId = setTimeout(async () => {
      for (const [columnName, note] of Object.entries(columnNotes)) {
        try {
          await saveColumnNote(schemaName, tableName, columnName, note);
        } catch (error) {
          console.error(`Failed to save note for ${columnName}:`, error);
        }
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [columnNotes, tableName, schemaName]);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedFKs, setSelectedFKs] = useState<Set<number>>(new Set());
  const [pendingConstraintChanges, setPendingConstraintChanges] = useState<PendingConstraintChanges>({});

  const [alertModal, setAlertModal] = useState<AlertModalState>({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '', onConfirm: null });

  const [nmPreviewModal, setNMPreviewModal] = useState<NMPreviewModalState>({
    isOpen: false, table1: '', table1Column: '', table2: '', table2Column: '',
    junctionTableName: '', fk1Name: '', fk2Name: '', table1Type: '', table2Type: '', onConfirm: null,
  });

  const isColumnFromRealDB = useCallback((columnName: string): boolean => {
    if (!originalSchema || !tableName) return false;
    const baselineTable = originalSchema.tables?.[tableName];
    if (!baselineTable) return false;
    return Boolean(baselineTable.columns?.[columnName]);
  }, [originalSchema, tableName]);

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'default' = 'warning') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const closeAlert = () => setAlertModal({ isOpen: false, title: '', message: '', type: 'info' });
  const closeConfirm = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  const [conflictModal, setConflictModal] = useState<ConflictModalState>({
    isOpen: false, conflicts: [], cascadingChanges: [], affectedTables: [],
    changeDescription: '', pendingChange: null,
  });

  const transferDescriptionsOnRename = useCallback(
    (oldColumns: LocalColumn[], newColumns: LocalColumn[], currentNotes: Record<string, string>): Record<string, string> => {
      if (!oldColumns || oldColumns.length === 0) return currentNotes;
      const updatedNotes = { ...currentNotes };
      let hasChanges = false;

      newColumns.forEach((newCol, index) => {
        if (index < oldColumns.length) {
          const oldCol = oldColumns[index];
          if (oldCol.name !== newCol.name && currentNotes[oldCol.name]) {
            updatedNotes[newCol.name] = currentNotes[oldCol.name];
            delete updatedNotes[oldCol.name];
            hasChanges = true;
          }
        }
      });

      if (!hasChanges) {
        const oldColumnMap = new Map<string, string>();
        oldColumns.forEach(col => {
          const key = `${col.type}_${col.pk}_${col.fk}_${col.unique}_${col.nullable}`;
          if (!oldColumnMap.has(key)) oldColumnMap.set(key, col.name);
        });
        newColumns.forEach(newCol => {
          const key = `${newCol.type}_${newCol.pk}_${newCol.fk}_${newCol.unique}_${newCol.nullable}`;
          const oldName = oldColumnMap.get(key);
          if (oldName && oldName !== newCol.name && currentNotes[oldName] && !updatedNotes[newCol.name]) {
            updatedNotes[newCol.name] = currentNotes[oldName];
            delete updatedNotes[oldName];
          }
        });
      }
      return updatedNotes;
    },
    []
  );

  const buildColumnList = (tableColumns: Record<string, ColumnData>): LocalColumn[] =>
    Object.entries(tableColumns).map(([columnName, columnData]) => ({
      ...(columnData as unknown as Record<string, unknown>),
      name: columnName,
      originalName: columnName,
      pk: Boolean(columnData.pk),
      nullable: columnData.nullable !== undefined ? Boolean(columnData.nullable) : true,
      unique: Boolean(columnData.unique),
      fk: Boolean(columnData.fk),
      autoIncrement: Boolean(columnData.autoIncrement),
      type: String(columnData.type || ''),
      baseType: getBaseDataType(String(columnData.type || '')),
      typeLength: getTypeLength(String(columnData.type || '')),
      defaultValue: String((columnData as unknown as Record<string, unknown>).defaultValue || ''),
    }));

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && workingSchema && tableName && !isSavingFK) {
      setActiveTab('constraints');
      setPendingConstraintChanges({});
      setIsDeleteMode(false);
      setSelectedFKs(new Set());

      const tableData = workingSchema.tables[tableName];
      if (tableData?.columns) {
        const columnList = buildColumnList(tableData.columns);
        if (previousColumnsRef.current.length > 0) {
          const updatedNotes = transferDescriptionsOnRename(previousColumnsRef.current, columnList, columnNotes);
          if (JSON.stringify(updatedNotes) !== JSON.stringify(columnNotes)) setColumnNotes(updatedNotes);
        }
        previousColumnsRef.current = columnList;
        setColumns(columnList);
      } else {
        setColumns([]);
        previousColumnsRef.current = [];
      }

      const tableFKs: LocalFK[] = (workingSchema.relationships || [])
        .filter((rel) => rel.fromTable === tableName)
        .map((rel) => ({
          id: (rel as unknown as { id?: string }).id,
          name: `FK_${rel.fromTable}_${rel.fromColumn}`,
          fromColumn: rel.fromColumn,
          originalFromColumn: rel.fromColumn,
          toTable: rel.toTable,
          toColumn: rel.toColumn,
          onUpdate: (rel as unknown as { onUpdate?: string }).onUpdate || 'RESTRICT',
          onDelete: (rel as unknown as { onDelete?: string }).onDelete || 'RESTRICT',
          isVirtual: Boolean((rel as unknown as { isVirtual?: boolean }).isVirtual) || Boolean(rel.isUserCreated),
        }));
      setForeignKeys(tableFKs);
      setEditingFK(null);
    }
  }, [isOpen, tableName, workingSchema, isSavingFK, transferDescriptionsOnRename]);

  // Refresh columns when switching tabs
  useEffect(() => {
    if ((activeTab === 'columns' || activeTab === 'constraints') && workingSchema && tableName) {
      const tableData = workingSchema.tables[tableName];
      if (tableData?.columns) {
        const columnList = buildColumnList(tableData.columns);
        if (previousColumnsRef.current.length > 0) {
          const updatedNotes = transferDescriptionsOnRename(previousColumnsRef.current, columnList, columnNotes);
          if (JSON.stringify(updatedNotes) !== JSON.stringify(columnNotes)) setColumnNotes(updatedNotes);
        }
        previousColumnsRef.current = columnList;
        setColumns(columnList);
      }
    }
  }, [activeTab, workingSchema, tableName, transferDescriptionsOnRename]);

  // Watch for workingSchema changes after applying constraints
  useEffect(() => {
    if (isApplyingConstraints && workingSchema && tableName) {
      const tableData = workingSchema.tables[tableName];
      if (tableData?.columns) {
        setColumns(buildColumnList(tableData.columns));
        setIsApplyingConstraints(false);
      }
    }
  }, [workingSchema, isApplyingConstraints, tableName]);

  const refreshForeignKeys = useCallback(() => {
    if (workingSchema && tableName) {
      const tableData = workingSchema.tables[tableName];
      if (tableData?.columns) {
        setColumns(buildColumnList(tableData.columns));
      } else {
        setColumns([]);
      }
      const tableFKs: LocalFK[] = (workingSchema.relationships || [])
        .filter((rel) => rel.fromTable === tableName)
        .map((rel) => ({
          id: (rel as unknown as { id?: string }).id,
          name: `FK_${rel.fromTable}_${rel.fromColumn}`,
          fromColumn: rel.fromColumn,
          toTable: rel.toTable,
          toColumn: rel.toColumn,
          onUpdate: (rel as unknown as { onUpdate?: string }).onUpdate || 'RESTRICT',
          onDelete: (rel as unknown as { onDelete?: string }).onDelete || 'RESTRICT',
          isVirtual: Boolean((rel as unknown as { isVirtual?: boolean }).isVirtual) || Boolean(rel.isUserCreated),
        }));
      setForeignKeys(tableFKs);
    }
  }, [workingSchema, tableName]);

  useEffect(() => {
    if (isOpen && registerEditTableModalRefresh) {
      registerEditTableModalRefresh(refreshForeignKeys);
    }
  }, [isOpen, registerEditTableModalRefresh, refreshForeignKeys]);

  const handleSave = () => {
    try {
      setPendingConstraintChanges({});
      onClose();
    } catch (error) {
      showAlert('Error', `Error saving constraints: ${(error as Error).message}`, 'error');
    }
  };

  const handleColumnSave = (index: number) => {
    try {
      const column = columns[index];
      const fullType = buildFullType(column.baseType, column.typeLength);
      const originalColumn = workingSchema!.tables[tableName].columns[column.name] as unknown as Record<string, unknown>;

      const newProperties = {
        type: fullType,
        defaultValue: column.defaultValue || null,
        nullable: column.nullable,
        pk: column.pk,
        unique: column.unique,
        autoIncrement: column.autoIncrement,
      };

      const conflictAnalysis = analyzeColumnChange({ tableName, columnName: column.name, newProperties, currentSchema: workingSchema! });

      const changes: string[] = [];
      if (fullType !== originalColumn.type) changes.push(`Data type: ${originalColumn.type} → ${fullType}`);
      if (newProperties.nullable !== originalColumn.nullable) changes.push(`Nullable: ${originalColumn.nullable ? 'YES' : 'NO'} → ${newProperties.nullable ? 'YES' : 'NO'}`);
      if (newProperties.pk !== originalColumn.pk) changes.push(`Primary Key: ${originalColumn.pk ? 'YES' : 'NO'} → ${newProperties.pk ? 'YES' : 'NO'}`);
      if (newProperties.unique !== originalColumn.unique) changes.push(`Unique: ${originalColumn.unique ? 'YES' : 'NO'} → ${newProperties.unique ? 'YES' : 'NO'}`);
      if ((newProperties.defaultValue || '') !== (originalColumn.defaultValue || '')) changes.push(`Default: "${originalColumn.defaultValue || ''}" → "${newProperties.defaultValue || ''}"`);

      const changeDescription = `Modify column ${tableName}.${column.name}:\n${changes.join('\n')}`;

      if (conflictAnalysis.hasConflicts || conflictAnalysis.cascadingChanges.length > 0) {
        setConflictModal({
          isOpen: true,
          conflicts: conflictAnalysis.conflicts,
          cascadingChanges: conflictAnalysis.cascadingChanges,
          affectedTables: conflictAnalysis.affectedTables,
          changeDescription,
          pendingChange: { type: 'COLUMN_UPDATE', index, column, fullType, newProperties },
        });
        return;
      }
      applyColumnChanges(index, column, fullType, newProperties);
    } catch (error) {
      showAlert('Error', `Error updating column: ${(error as Error).message}`, 'error');
    }
  };

  const applyColumnChanges = async (
    index: number,
    column: LocalColumn,
    fullType: string,
    newProperties: Record<string, unknown>,
    cascadingChanges: unknown[] = []
  ) => {
    try {
      updateColumn(tableName, column.name, newProperties as Parameters<typeof updateColumn>[2]);
      if (cascadingChanges.length > 0) {
        for (const change of cascadingChanges as Array<{ type: string; tableName: string; columnName: string; newType: string }>) {
          if (change.type === 'DATA_TYPE_CASCADE') {
            updateColumn(change.tableName, change.columnName, { type: change.newType });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      const newColumns = [...columns];
      newColumns[index] = { ...newColumns[index], type: fullType, ...newProperties };
      setColumns(newColumns);
      setEditingColumn(null);
      if (cascadingChanges.length > 0) {
        const affectedTables = [...new Set((cascadingChanges as Array<{ tableName: string }>).map(c => c.tableName))];
        showAlert('Success', `Changes applied successfully!\nCascading updates applied to: ${affectedTables.join(', ')}\n\nChanges are saved in the virtual schema.`, 'success');
      }
    } catch (error) {
      showAlert('Error', `Error applying changes: ${(error as Error).message}`, 'error');
    }
  };

  const handleConflictConfirm = async () => {
    const { pendingChange, cascadingChanges } = conflictModal;
    if (pendingChange) {
      if (pendingChange.type === 'COLUMN_UPDATE') {
        await applyColumnChanges(pendingChange.index!, pendingChange.column!, pendingChange.fullType!, pendingChange.newProperties!, cascadingChanges);
      } else if (pendingChange.type === 'CONSTRAINT_TOGGLE') {
        await applyConstraintToggle(pendingChange.index!, pendingChange.column!, pendingChange.constraintType!, pendingChange.newValue, pendingChange.newProperties!, cascadingChanges);
      } else if (pendingChange.type === 'APPLY_CONSTRAINTS') {
        const { columnName, changes } = pendingChange;
        for (const [constraintType, newValue] of Object.entries(changes!)) {
          if (constraintType === 'pk') togglePrimaryKey(tableName, columnName!);
          else if (constraintType === 'nullable') toggleNullable(tableName, columnName!);
          else if (constraintType === 'unique') toggleUnique(tableName, columnName!);
        }
        const remainingChanges = { ...pendingConstraintChanges };
        delete remainingChanges[columnName!];
        setPendingConstraintChanges(remainingChanges);
        if (cascadingChanges && cascadingChanges.length > 0) {
          const updatedSchema = applyCascadingChanges(cascadingChanges as import('../../utils/conflictDetection').CascadingChange[], workingSchema!);
          // Apply cascading type changes via updateColumn
          (cascadingChanges as Array<{ type: string; tableName: string; columnName: string; newType: string }>).forEach((change) => {
            if (change.type === 'DATA_TYPE_CASCADE') updateColumn(change.tableName, change.columnName, { type: change.newType });
          });
        }
        if (Object.keys(remainingChanges).length > 0) {
          setTimeout(() => handleApplyConstraints(), 100);
        }
      }
    }
    setConflictModal({ isOpen: false, conflicts: [], cascadingChanges: [], affectedTables: [], changeDescription: '', pendingChange: null });
  };

  const handleConflictCancel = () => {
    setConflictModal({ isOpen: false, conflicts: [], cascadingChanges: [], affectedTables: [], changeDescription: '', pendingChange: null });
  };

  const handleConstraintToggle = (index: number, constraintType: string, newValue: boolean) => {
    const column = columns[index];
    const columnName = column.name;

    if (constraintType === 'pk' && newValue === true) {
      const realDBHasPK = columns.some(col => isColumnFromRealDB(col.name) && col.pk);
      if (realDBHasPK) {
        showAlert('Cannot Set Primary Key', 'This table already has a primary key defined in the real database. A table can only have one primary key. To change the primary key, you must modify it in the actual database.', 'error');
        return;
      }
    }

    setPendingConstraintChanges(prev => ({
      ...prev,
      [columnName]: { ...prev[columnName], [constraintType]: newValue },
    }));

    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      if (constraintType === 'pk' && newValue === true) {
        newColumns.forEach((col, idx) => {
          if (idx !== index && col.pk && !isColumnFromRealDB(col.name)) {
            newColumns[idx] = { ...col, pk: false };
            setPendingConstraintChanges(prev => ({ ...prev, [col.name]: { ...prev[col.name], pk: false } }));
          }
        });
        newColumns[index] = { ...newColumns[index], pk: true, nullable: false };
        setPendingConstraintChanges(prev => ({ ...prev, [columnName]: { ...prev[columnName], pk: true, nullable: false } }));
      } else {
        newColumns[index] = { ...newColumns[index], [constraintType]: newValue };
        if (constraintType === 'pk' && newValue === true) {
          newColumns[index].nullable = false;
          setPendingConstraintChanges(prev => ({ ...prev, [columnName]: { ...prev[columnName], nullable: false } }));
        }
      }
      return newColumns;
    });
  };

  const handleApplyConstraints = async () => {
    if (Object.keys(pendingConstraintChanges).length === 0) return;

    for (const [columnName, changes] of Object.entries(pendingConstraintChanges)) {
      const originalColumn = workingSchema!.tables[tableName].columns[columnName] as unknown as Record<string, unknown>;
      const newProperties = { ...originalColumn, ...changes };

      const conflictAnalysis = analyzeColumnChange({ tableName, columnName, newProperties, currentSchema: workingSchema! });
      const constraintNames: Record<string, string> = { pk: 'Primary Key', nullable: 'Nullable', unique: 'Unique' };
      const changedConstraints = Object.keys(changes).map(key => constraintNames[key]).join(', ');
      const changeDescription = `Modify ${changedConstraints} constraint(s) on ${tableName}.${columnName}`;

      if (conflictAnalysis.hasConflicts || conflictAnalysis.cascadingChanges.length > 0) {
        setConflictModal({
          isOpen: true,
          conflicts: conflictAnalysis.conflicts,
          cascadingChanges: conflictAnalysis.cascadingChanges,
          affectedTables: conflictAnalysis.affectedTables,
          changeDescription,
          pendingChange: { type: 'APPLY_CONSTRAINTS', columnName, changes, newProperties },
        });
        return;
      }
    }
    await applyAllConstraintChanges();
  };

  const applyAllConstraintChanges = async () => {
    setIsApplyingConstraints(true);
    for (const [columnName, changes] of Object.entries(pendingConstraintChanges)) {
      const isSettingPK = changes.pk === true;
      if (isSettingPK) {
        togglePrimaryKey(tableName, columnName);
      } else {
        for (const [constraintType] of Object.entries(changes)) {
          if (constraintType === 'nullable') toggleNullable(tableName, columnName);
          else if (constraintType === 'unique') toggleUnique(tableName, columnName);
        }
      }
    }
    setPendingConstraintChanges({});
  };

  const handleCancelConstraints = () => {
    if (workingSchema?.tables[tableName]?.columns) {
      setColumns(buildColumnList(workingSchema.tables[tableName].columns));
    }
    setPendingConstraintChanges({});
  };

  const applyConstraintToggle = async (
    index: number,
    column: LocalColumn,
    constraintType: string,
    newValue: unknown,
    newProperties: Record<string, unknown>,
    cascadingChanges: unknown[] = []
  ) => {
    try {
      if (constraintType === 'pk') await togglePrimaryKey(tableName, column.name);
      else if (constraintType === 'nullable') await toggleNullable(tableName, column.name);
      else if (constraintType === 'unique') await toggleUnique(tableName, column.name);

      if (cascadingChanges.length > 0) {
        for (const change of cascadingChanges as Array<{ type: string; tableName: string; columnName: string; newType: string }>) {
          if (change.type === 'DATA_TYPE_CASCADE') {
            await updateColumn(change.tableName, change.columnName, { type: change.newType });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (workingSchema?.tables[tableName]?.columns) {
        setColumns(buildColumnList(workingSchema.tables[tableName].columns));
      }
      if (cascadingChanges.length > 0) {
        const affectedTables = [...new Set((cascadingChanges as Array<{ tableName: string }>).map(c => c.tableName))];
        showAlert('Success', `Constraint updated successfully!\nCascading updates applied to: ${affectedTables.join(', ')}`, 'success');
      }
    } catch (error) {
      showAlert('Error', `Error updating constraint: ${(error as Error).message}`, 'error');
    }
  };

  const handleAddFK = () => {
    const newFK: LocalFK = {
      name: `FK_${tableName}_new`,
      fromColumn: '__CREATE_NEW__',
      newColumnName: '',
      toTable: '',
      toColumn: '',
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
      cardinality: '1:N',
      junctionTableName: '',
      isNew: true,
      isVirtual: true,
    };
    const newIndex = foreignKeys.length;
    setForeignKeys([...foreignKeys, newFK]);
    setEditingFK(newIndex);
    setShowAddFK(false);
  };

  const handleToggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedFKs(new Set());
  };

  const handleToggleFKSelection = (index: number) => {
    const fk = foreignKeys[index];
    if (!fk.isVirtual) return;
    setSelectedFKs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const handleSelectAllFKs = () => {
    const userCreatedIndices = foreignKeys
      .map((fk, index) => (fk.isVirtual ? index : null))
      .filter((index): index is number => index !== null);
    if (selectedFKs.size === userCreatedIndices.length) setSelectedFKs(new Set());
    else setSelectedFKs(new Set(userCreatedIndices));
  };

  const handleDeleteSelectedFKs = () => {
    if (selectedFKs.size === 0) return;
    const fksToDelete = Array.from(selectedFKs).map(index => foreignKeys[index]);
    const fkNames = fksToDelete.map(fk => fk.name).join(', ');
    const tableData = workingSchema?.tables[tableName];
    const allColumns = Object.values(tableData?.columns || {});
    const fkColumns = allColumns.filter(col => col.fk);
    const pkColumns = allColumns.filter(col => col.pk);
    const isJunctionTable = (tableData as unknown as { isJunctionTable?: boolean })?.isJunctionTable ||
      (fkColumns.length === 2 && pkColumns.length === 2 && fkColumns.every(fkCol => fkCol.pk));

    if (isJunctionTable) {
      showConfirm('Delete Junction Table',
        `"${tableName}" is a junction table for a many-to-many relationship. Deleting foreign keys will delete the entire table and break the N:M relationship. Continue?`,
        () => { deleteTable(tableName); onClose(); }, 'danger');
      return;
    }
    showConfirm('Delete Selected Foreign Keys',
      `Are you sure you want to delete ${selectedFKs.size} foreign key(s)?\n\n${fkNames}\n\nThis action cannot be undone.`,
      () => {
        fksToDelete.forEach(fk => { if (fk.id) deleteRelationship(fk.id); });
        setSelectedFKs(new Set());
        setIsDeleteMode(false);
        showAlert('Success', `Successfully deleted ${selectedFKs.size} foreign key(s).`, 'success');
      }, 'danger');
  };

  const handleDeleteFK = (index: number) => {
    try {
      const fk = foreignKeys[index];
      if (!fk.isVirtual) {
        showAlert('Cannot Delete', 'Real database foreign keys cannot be deleted from the ERD tool. This would require direct database changes.', 'warning');
        return;
      }
      const tableData = workingSchema?.tables[tableName];
      const allColumns = Object.values(tableData?.columns || {});
      const fkColumns = allColumns.filter(col => col.fk);
      const pkColumns = allColumns.filter(col => col.pk);
      const isJunctionTable = (tableData as unknown as { isJunctionTable?: boolean })?.isJunctionTable ||
        (fkColumns.length === 2 && pkColumns.length === 2 && fkColumns.every(fkCol => fkCol.pk));

      if (isJunctionTable) {
        showConfirm('Delete Junction Table',
          `"${tableName}" is a junction table for a many-to-many relationship. Deleting this foreign key will delete the entire table and break the N:M relationship. Continue?`,
          () => { deleteTable(tableName); onClose(); }, 'danger');
        return;
      }
      showConfirm('Delete Foreign Key', `Delete foreign key "${fk.name}"?`,
        () => {
          if (!fk.isNew && fk.id) deleteRelationship(fk.id);
          setForeignKeys(foreignKeys.filter((_, i) => i !== index));
          setEditingFK(null);
        }, 'danger');
    } catch (error) {
      showAlert('Error', `Error deleting foreign key: ${(error as Error).message}`, 'error');
    }
  };

  const handleCancelFK = (index: number) => {
    const fk = foreignKeys[index];
    if (fk.isNew) setForeignKeys(foreignKeys.filter((_, i) => i !== index));
    setEditingFK(null);
  };

  const handleFKChange = useCallback((index: number, field: string, value: string) => {
    setForeignKeys(prevFKs => {
      const newFKs = [...prevFKs];
      newFKs[index] = { ...newFKs[index], [field]: value };

      if (field === 'toTable' && value && newFKs[index].fromColumn === '__CREATE_NEW__') {
        const suggestedColumnName = `${value}_id`;
        newFKs[index].newColumnName = suggestedColumnName;
        newFKs[index].name = `FK_${tableName}_${suggestedColumnName}`;
      }

      if (field === 'cardinality' && newFKs[index].fromColumn && newFKs[index].fromColumn !== '__CREATE_NEW__') {
        const fkColumnName = newFKs[index].fromColumn;
        const shouldBeUnique = value === '1:1';
        const fkColumn = columns.find(col => col.name === fkColumnName);
        const isPK = fkColumn?.pk || false;

        if (isPK && !shouldBeUnique) {
          newFKs[index].cardinality = '1:1';
          return newFKs;
        }
        if (!isPK) {
          setColumns(prevColumns => {
            const newColumns = [...prevColumns];
            const columnIndex = newColumns.findIndex(col => col.name === fkColumnName);
            if (columnIndex !== -1) newColumns[columnIndex] = { ...newColumns[columnIndex], unique: shouldBeUnique };
            return newColumns;
          });
          if (workingSchema?.tables[tableName]) {
            const col = workingSchema.tables[tableName].columns[fkColumnName] as unknown as Record<string, unknown>;
            if (col && col.unique !== shouldBeUnique) {
              setTimeout(() => toggleUnique(tableName, fkColumnName), 0);
            }
          }
        }
      }
      return newFKs;
    });
  }, [tableName, workingSchema, toggleUnique, columns]);

  const handleSaveFK = (index: number) => {
    try {
      const fk = foreignKeys[index];

      // N:M RELATIONSHIP HANDLING
      if (fk.cardinality === 'N:M') {
        if (!fk.toTable) { showAlert('Validation Error', 'Please select the second table for N:M relationship', 'warning'); return; }
        if (!fk.toColumn) { showAlert('Validation Error', 'Please select a column from the second table', 'warning'); return; }

        const sortedTables = [tableName, fk.toTable].sort();
        const existingJunctionTable = Object.entries(workingSchema!.tables).find(([tblName, tableData]) => {
          const junctionInfo = isTableJunctionTable(tblName, tableData);
          if (junctionInfo.isJunction && junctionInfo.junctionFor) {
            return JSON.stringify(junctionInfo.junctionFor.sort()) === JSON.stringify(sortedTables);
          }
          return false;
        });

        if (existingJunctionTable) {
          showAlert('N:M Already Exists',
            `A Many-to-Many relationship already exists between "${tableName}" and "${fk.toTable}" via junction table "${existingJunctionTable[0]}".\n\nYou cannot create multiple N:M relationships between the same two tables.\n\nIf you need to modify the relationship, delete the existing junction table first.`,
            'error');
          return;
        }

        const currentTablePKColumn = Object.entries(workingSchema!.tables[tableName].columns)
          .find(([, col]) => col.pk || col.unique);
        if (!currentTablePKColumn) {
          showAlert('Validation Error', `Table "${tableName}" must have a PRIMARY KEY or UNIQUE column for N:M relationship`, 'warning');
          return;
        }
        const [table1Column, table1ColData] = currentTablePKColumn;
        const table2Col = workingSchema!.tables[fk.toTable].columns[fk.toColumn];
        if (!table2Col || (!table2Col.pk && !table2Col.unique)) {
          showAlert('Validation Error', `Column "${fk.toColumn}" in table "${fk.toTable}" must be PRIMARY KEY or UNIQUE`, 'warning');
          return;
        }

        const autoJunctionName = [tableName, fk.toTable].sort().join('_');
        const finalJunctionName = fk.junctionTableName?.trim() || autoJunctionName;

        if (workingSchema!.tables[finalJunctionName]) {
          const existingTable = workingSchema!.tables[finalJunctionName] as unknown as { isJunctionTable?: boolean; junctionFor?: string[] };
          if (existingTable.isJunctionTable && existingTable.junctionFor) {
            showAlert('Table Name Conflict', `Junction table "${finalJunctionName}" already exists for tables: ${existingTable.junctionFor.join(' and ')}.\n\nPlease choose a different junction table name.`, 'warning');
          } else {
            showAlert('Table Name Conflict', `Table "${finalJunctionName}" already exists in the schema.\n\nPlease choose a different junction table name.\n\nSuggestions:\n- ${finalJunctionName}_junction\n- ${finalJunctionName}_link\n- ${finalJunctionName}_map`, 'warning');
          }
          return;
        }

        const generateFKName = (tblName: string, colName: string): string => {
          const tl = tblName.toLowerCase();
          const cl = colName.toLowerCase();
          if (cl === 'id') return `${tl}_id`;
          if (cl.includes(tl)) return cl;
          return `${tl}_${cl}`;
        };

        let fk1Name = generateFKName(tableName, table1Column);
        let fk2Name = generateFKName(fk.toTable, fk.toColumn);
        if (tableName === fk.toTable && fk1Name === fk2Name) { fk1Name += '_1'; fk2Name += '_2'; }

        setNMPreviewModal({
          isOpen: true,
          table1: tableName, table1Column,
          table2: fk.toTable, table2Column: fk.toColumn,
          junctionTableName: finalJunctionName,
          fk1Name, fk2Name,
          table1Type: String(table1ColData.type),
          table2Type: String(table2Col.type),
          onConfirm: () => {
            try {
              const result = addManyToManyRelationship(tableName, table1Column, fk.toTable, fk.toColumn, finalJunctionName);
              setNMPreviewModal(prev => ({ ...prev, isOpen: false }));
              setEditingFK(null);
              setForeignKeys(foreignKeys.filter((_, i) => i !== index));
              showAlert('Success', `N:M relationship created successfully!\n\nJunction table "${result?.junctionTableName}" has been created with two 1:N relationships.`, 'success');
            } catch (error) {
              setNMPreviewModal(prev => ({ ...prev, isOpen: false }));
              showAlert('Error', `Error creating N:M relationship: ${(error as Error).message}`, 'error');
            }
          },
        });
        return;
      }

      // REGULAR 1:1 or 1:N RELATIONSHIP HANDLING
      if (!fk.name.trim()) { showAlert('Validation Error', 'Foreign key name is required', 'warning'); return; }
      if (!fk.toTable) { showAlert('Validation Error', 'Please select a referenced table', 'warning'); return; }

      const availableTargetColumns = getAvailableColumns(fk.toTable);
      if (availableTargetColumns.length === 0) {
        showAlert('Validation Error', `Table "${fk.toTable}" has no PRIMARY KEY or UNIQUE columns available for foreign key reference. Add a PRIMARY KEY or UNIQUE constraint to a column first.`, 'warning');
        return;
      }
      if (!fk.toColumn) { showAlert('Validation Error', 'Please select a referenced column', 'warning'); return; }

      let actualColumnName = fk.fromColumn;

      if (fk.fromColumn === '__CREATE_NEW__') {
        if (!fk.newColumnName?.trim()) { showAlert('Validation Error', 'Please enter a name for the new column', 'warning'); return; }
        actualColumnName = fk.newColumnName.trim();
        if (fk.toTable === tableName && actualColumnName === fk.toColumn) {
          showAlert('Self-Join Error', `Cannot create self-referencing foreign key: column "${actualColumnName}" cannot reference itself.\n\nFor self-join relationships, the foreign key column must reference a different column in the same table.\n\nExample: employees.manager_id → employees.employee_id`, 'error');
          return;
        }
        if (columns.find(col => col.name === actualColumnName)) {
          showAlert('Validation Error', `Column "${actualColumnName}" already exists. Please choose a different name.`, 'warning');
          return;
        }
        const referencedColumn = workingSchema!.tables[fk.toTable]?.columns?.[fk.toColumn];
        const columnType = String(referencedColumn?.type || 'INT');
        let relationshipId: string | undefined;
        try {
          relationshipId = addForeignKeyWithNewColumn(tableName, actualColumnName, columnType, fk.toTable, fk.toColumn, 'ONE_TO_MANY');
        } catch (error) {
          if ((error as Error).message === 'Relationship already exists') {
            showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
          } else throw error;
          return;
        }
        const newColumn: LocalColumn = { name: actualColumnName, type: columnType, pk: false, nullable: true, unique: false, fk: true, defaultValue: '', originalName: actualColumnName, autoIncrement: false, baseType: getBaseDataType(columnType), typeLength: getTypeLength(columnType) };
        setColumns([...columns, newColumn]);
        const newFKs = [...foreignKeys];
        newFKs[index] = { ...fk, fromColumn: actualColumnName, isNew: false, id: relationshipId };
        setForeignKeys(newFKs);
      } else {
        if (!fk.fromColumn) { showAlert('Validation Error', 'Please select a column from the current table', 'warning'); return; }
        const workingSchemaColumn = workingSchema!.tables[tableName]?.columns?.[fk.fromColumn];
        if (!workingSchemaColumn) { showAlert('Validation Error', `Column "${fk.fromColumn}" does not exist in table "${tableName}"`, 'warning'); return; }
        if (fk.toTable === tableName && fk.fromColumn === fk.toColumn) {
          showAlert('Self-Join Error', `Cannot create self-referencing foreign key: column "${fk.fromColumn}" cannot reference itself.\n\nFor self-join relationships, the foreign key column must reference a different column in the same table.\n\nExample: employees.manager_id → employees.employee_id`, 'error');
          return;
        }
        const referencedColumn = workingSchema!.tables[fk.toTable]?.columns?.[fk.toColumn];
        if (referencedColumn) {
          const compatibility = areDataTypesCompatible(String(workingSchemaColumn.type), String(referencedColumn.type));
          if (!compatibility.compatible) {
            showAlert('Data Type Mismatch', `Cannot create foreign key: ${compatibility.reason}\n\nChild column: ${tableName}.${workingSchemaColumn.type} (${workingSchemaColumn.type})\nParent column: ${fk.toTable}.${fk.toColumn} (${referencedColumn.type})\n\nThe data types must be compatible for a foreign key relationship.`, 'error');
            return;
          }
        }
      }

      if (fk.isNew) {
        if (fk.fromColumn !== '__CREATE_NEW__') {
          try {
            addRelationship(tableName, actualColumnName, fk.toTable, fk.toColumn, 'ONE_TO_MANY');
          } catch (error) {
            if ((error as Error).message === 'Relationship already exists') {
              showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            } else throw error;
            return;
          }
          const newFKs = [...foreignKeys];
          newFKs[index] = { ...fk, fromColumn: actualColumnName, isNew: false, id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
          setForeignKeys(newFKs);
          const newColumns = [...columns];
          const columnIndex = newColumns.findIndex(col => col.name === actualColumnName);
          if (columnIndex !== -1) { newColumns[columnIndex] = { ...newColumns[columnIndex], fk: true }; setColumns(newColumns); }
        }
      } else {
        if (!fk.isVirtual) { showAlert('Cannot Edit Database FK', 'Foreign keys from the database cannot be edited. You can only edit user-created foreign keys.', 'warning'); return; }
        if (fk.fromColumn === '__CREATE_NEW__') {
          if (!fk.newColumnName?.trim()) { showAlert('Validation Error', 'Please enter a name for the new column', 'warning'); return; }
          actualColumnName = fk.newColumnName.trim();
          if (columns.find(col => col.name === actualColumnName)) { showAlert('Validation Error', `Column "${actualColumnName}" already exists. Please choose a different name.`, 'warning'); return; }
          const referencedColumn = workingSchema!.tables[fk.toTable]?.columns?.[fk.toColumn];
          const columnType = String(referencedColumn?.type || 'INT');
          try {
            updateForeignKeyWithNewColumn(tableName, fk.originalFromColumn!, actualColumnName, columnType, fk.toTable, fk.toColumn);
          } catch (error) {
            if ((error as Error).message === 'Relationship already exists') showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            else showAlert('Error', `Error updating foreign key: ${(error as Error).message}`, 'error');
            return;
          }
        } else {
          try {
            updateForeignKeyColumn(tableName, fk.originalFromColumn!, actualColumnName, fk.toTable, fk.toColumn);
          } catch (error) {
            if ((error as Error).message === 'Relationship already exists') showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            else if ((error as Error).message === 'Old relationship not found') showAlert('Error', 'Could not find the original foreign key relationship to update.', 'error');
            else showAlert('Error', `Error updating foreign key: ${(error as Error).message}`, 'error');
          }
        }
      }
      setEditingFK(null);
    } catch (error) {
      showAlert('Error', `Error creating foreign key: ${(error as Error).message}`, 'error');
    }
  };

  const getAvailableTables = (): string[] => {
    if (!workingSchema) return [];
    return Object.keys(workingSchema.tables);
  };

  const getAvailableColumns = (targetTable: string): string[] => {
    if (!workingSchema || !targetTable) return [];
    const table = workingSchema.tables[targetTable];
    if (!table) return [];
    return Object.entries(table.columns)
      .filter(([, columnData]) => columnData.pk || columnData.unique)
      .map(([columnName]) => columnName);
  };

  const getCurrentTableColumns = (): string[] => columns.filter(col => col.name).map(col => col.name);

  const detectCardinality = (fkColumnName: string): string => {
    if (!fkColumnName || fkColumnName === '__CREATE_NEW__') return '1:N';
    const column = columns.find(col => col.name === fkColumnName);
    if (!column) return '1:N';
    return column.unique || column.pk ? '1:1' : '1:N';
  };

  const detectIdentifying = (fkColumnName: string): boolean => {
    if (!fkColumnName || fkColumnName === '__CREATE_NEW__') return false;
    const column = columns.find(col => col.name === fkColumnName);
    return column?.pk || false;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-table-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="table-info">
            <span className="table-name-display">{tableName}</span>
            <span className="schema-name">Schema: {schemaName}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button className={`tab ${activeTab === 'constraints' ? 'active' : ''}`} onClick={() => setActiveTab('constraints')}>Constraints</button>
          <button className={`tab ${activeTab === 'foreignKeys' ? 'active' : ''}`} onClick={() => setActiveTab('foreignKeys')}>Foreign Keys</button>
          <button className={`tab ${activeTab === 'columns' ? 'active' : ''}`} onClick={() => setActiveTab('columns')}>Columns</button>
        </div>

        <div className="modal-body">
          {activeTab === 'constraints' && (
            <div className="constraints-tab">
              <div className="tab-header">
                <h3>
                  Column Constraints
                  {Object.keys(pendingConstraintChanges).length > 0 && (
                    <span className="pending-changes-indicator" title="You have unsaved constraint changes">
                      ({Object.keys(pendingConstraintChanges).length} pending)
                    </span>
                  )}
                </h3>
                <p className="tab-description">Edit primary keys, unique constraints, and nullable settings</p>
              </div>
              <div className="constraints-table">
                <div className="edit-constraint-header">
                  <div className="edit-constraint-name">Column Name</div>
                  <div className="edit-constraint-type">Data Type</div>
                  <div className="edit-constraint-default">Default/Expression</div>
                  <div className="edit-constraint-pk">PK</div>
                  <div className="edit-constraint-nn">NN</div>
                  <div className="edit-constraint-uq">UQ</div>
                </div>
                {columns.map((column, index) => {
                  const isFromRealDB = isColumnFromRealDB(column.name);
                  const displayDefault = (column.defaultValue === null || column.defaultValue === undefined || column.defaultValue === '' || column.defaultValue === 'NULL') ? '-' : column.defaultValue;
                  return (
                    <div key={`${column.originalName || column.name}-${index}`} className="edit-constraint-row">
                      <div className="edit-constraint-name" title={column.name}>
                        <span className="column-name-readonly">{column.name}</span>
                        {isFromRealDB && <span className="real-db-badge" title="Column from real database - constraints are read-only">DB</span>}
                      </div>
                      <div className="edit-constraint-type">
                        <span className="column-type-readonly" title={getFullDataType(column.type)}>{formatDataTypeForDisplay(column.type)}</span>
                      </div>
                      <div className="edit-constraint-default">
                        <span className="default-value-readonly">{displayDefault}</span>
                      </div>
                      <div className="edit-constraint-pk">
                        <input id={`pk-${tableName}-${column.name}`} name={`pk-${tableName}-${column.name}`} type="checkbox" checked={Boolean(column.pk)}
                          onChange={(e) => handleConstraintToggle(index, 'pk', e.target.checked)}
                          disabled={isFromRealDB} title={isFromRealDB ? 'Real DB column - constraint is read-only' : 'Toggle primary key'} />
                      </div>
                      <div className="edit-constraint-nn">
                        <input id={`nn-${tableName}-${column.name}`} name={`nn-${tableName}-${column.name}`} type="checkbox" checked={!column.nullable}
                          onChange={(e) => handleConstraintToggle(index, 'nullable', !e.target.checked)}
                          disabled={column.pk || isFromRealDB} title={isFromRealDB ? 'Real DB column - constraint is read-only' : column.pk ? 'Primary key columns are always NOT NULL' : 'Toggle nullable'} />
                      </div>
                      <div className="edit-constraint-uq">
                        <input id={`uq-${tableName}-${column.name}`} name={`uq-${tableName}-${column.name}`} type="checkbox" checked={Boolean(column.unique)}
                          onChange={(e) => handleConstraintToggle(index, 'unique', e.target.checked)}
                          disabled={isFromRealDB} title={isFromRealDB ? 'Real DB column - constraint is read-only' : 'Toggle unique'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'foreignKeys' && (
            <div className="foreign-keys-tab">
              <div className="tab-header">
                <h3>Foreign Keys</h3>
                <div className="fk-header-actions">
                  {isDeleteMode ? (
                    <>
                      <button className="btn-delete-selected" onClick={handleDeleteSelectedFKs} disabled={selectedFKs.size === 0}>Delete Selected ({selectedFKs.size})</button>
                      <button className="btn-cancel" onClick={handleToggleDeleteMode}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-add" onClick={handleAddFK}>Add Foreign Key</button>
                      {foreignKeys.some(fk => fk.isVirtual && !fk.isNew) && (
                        <button className="btn-delete-mode" onClick={handleToggleDeleteMode} title="Delete user-created foreign keys">Delete Foreign Key</button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="fk-table">
                <div className="edit-fk-header">
                  {isDeleteMode && (
                    <div className="edit-fk-checkbox">
                      <input id="select-all-fks" name="select-all-fks" type="checkbox"
                        checked={selectedFKs.size > 0 && selectedFKs.size === foreignKeys.filter(fk => fk.isVirtual).length}
                        onChange={handleSelectAllFKs} title="Select all user-created FKs" />
                    </div>
                  )}
                  <div className="edit-fk-name">Foreign Key Name</div>
                  <div className="edit-fk-column">Child Column (FK)</div>
                  <div className="edit-fk-ref-table">Parent Table</div>
                  <div className="edit-fk-ref-column">Parent Column (PK)</div>
                  <div className="edit-fk-cardinality">Cardinality</div>
                  <div className="edit-fk-type">Relation Type</div>
                  <div className="edit-fk-on-update">On Update</div>
                  <div className="edit-fk-on-delete">On Delete</div>
                  {!isDeleteMode && <div className="edit-fk-actions">Actions</div>}
                </div>

                {foreignKeys.map((fk, index) => (
                  <div key={index} className={`edit-fk-row ${editingFK === index ? 'editing' : ''} ${!fk.isVirtual ? 'read-only' : ''}`}>
                    {isDeleteMode && (
                      <div className="edit-fk-checkbox">
                        <input id={`fk-select-${index}`} name={`fk-select-${index}`} type="checkbox"
                          checked={selectedFKs.has(index)} onChange={() => handleToggleFKSelection(index)}
                          disabled={!fk.isVirtual} title={fk.isVirtual ? 'Select for deletion' : 'Database FK cannot be deleted'} />
                      </div>
                    )}
                    <div className="edit-fk-name">
                      {editingFK === index && fk.isVirtual ? (
                        <input id={`fk-name-${index}`} name={`fk-name-${index}`} type="text"
                          value={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!fk.fromColumn || fk.fromColumn === '__CREATE_NEW__') {
                              handleFKChange(index, 'newColumnName', value);
                              handleFKChange(index, 'fromColumn', '__CREATE_NEW__');
                            }
                          }}
                          placeholder="Enter new FK name"
                          disabled={Boolean(fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__')}
                          readOnly={Boolean(fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__')}
                          title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || ''}
                          className="fk-column-name-input"
                          style={{ background: fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? 'var(--bg-secondary)' : 'var(--bg-primary)' }}
                        />
                      ) : (
                        <span className="fk-column-name-display" title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || fk.name}>
                          {fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || fk.name}
                        </span>
                      )}
                    </div>

                    {fk.cardinality === 'N:M' ? (
                      <div className="edit-fk-column">
                        {editingFK === index && fk.isVirtual ? (
                          <input id={`fk-junction-${index}`} name={`fk-junction-${index}`} type="text"
                            value={fk.junctionTableName || ''}
                            onChange={(e) => handleFKChange(index, 'junctionTableName', e.target.value)}
                            placeholder={`${[tableName, fk.toTable || 'table2'].sort().join('_')}`}
                            title="Junction table name (leave empty for auto-generated)"
                            className="fk-junction-name-input" />
                        ) : (
                          <span className="fk-junction-name-display" title={fk.junctionTableName || 'Auto-generated'}>
                            {fk.junctionTableName || `${[tableName, fk.toTable || 'table2'].sort().join('_')}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="edit-fk-column">
                        <select id={`fk-from-column-${index}`} name={`fk-from-column-${index}`}
                          value={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) { handleFKChange(index, 'fromColumn', value); handleFKChange(index, 'newColumnName', ''); }
                            else handleFKChange(index, 'fromColumn', '__CREATE_NEW__');
                          }}
                          disabled={editingFK !== index || !fk.isVirtual}
                          title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : '+ Create New Column'}
                          className="fk-column-select">
                          <option value="">Create New Column</option>
                          <optgroup label="Existing Columns">
                            {getCurrentTableColumns().map(col => <option key={col} value={col} title={col}>{col}</option>)}
                          </optgroup>
                        </select>
                      </div>
                    )}

                    <div className="edit-fk-ref-table">
                      <select id={`fk-to-table-${index}`} name={`fk-to-table-${index}`} value={fk.toTable}
                        onChange={(e) => handleFKChange(index, 'toTable', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.toTable || 'Select Parent Table'} className="fk-select-with-ellipsis">
                        <option value="">Select Table</option>
                        {getAvailableTables().map(table => (
                          <option key={table} value={table} title={table}>{table}{table === tableName ? ' (Self-Join)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="edit-fk-ref-column">
                      <select id={`fk-to-column-${index}`} name={`fk-to-column-${index}`} value={fk.toColumn}
                        onChange={(e) => handleFKChange(index, 'toColumn', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.toColumn || 'Select Parent Column'} className="fk-select-with-ellipsis">
                        <option value="">Select Column</option>
                        {getAvailableColumns(fk.toTable).length === 0 && fk.toTable ? (
                          <option value="" disabled>No PK/UNIQUE columns available</option>
                        ) : (
                          getAvailableColumns(fk.toTable).map(col => <option key={col} value={col} title={col}>{col}</option>)
                        )}
                      </select>
                    </div>

                    <div className="edit-fk-cardinality">
                      {editingFK === index && fk.isVirtual ? (() => {
                        const fkColumn = columns.find(col => col.name === fk.fromColumn);
                        const isPK = fkColumn?.pk || false;
                        const detectedCardinality = detectCardinality(fk.fromColumn);
                        return (
                          <select id={`fk-cardinality-${index}`} name={`fk-cardinality-${index}`}
                            value={fk.cardinality || detectedCardinality}
                            onChange={(e) => handleFKChange(index, 'cardinality', e.target.value)}
                            disabled={isPK && fk.cardinality !== 'N:M'}
                            title={isPK && fk.cardinality !== 'N:M' ? 'Cardinality is locked to 1:1 because FK column is a Primary Key (always unique)' : 'Select relationship cardinality'}>
                            <option value="1:1">1:1 (One-to-One)</option>
                            <option value="1:N">1:N (One-to-Many)</option>
                            <option value="N:M">N:M (Many-to-Many)</option>
                          </select>
                        );
                      })() : (
                        <span className="fk-cardinality-display" title={
                          fk.cardinality === 'N:M' ? 'Many-to-Many: Creates junction table' :
                          fk.cardinality === '1:1' ? 'One-to-One: FK has UNIQUE constraint or is PK' :
                          'One-to-Many: FK does not have UNIQUE constraint'
                        }>
                          {fk.cardinality !== 'N:M' && (
                            <CardinalityIcon cardinality={fk.cardinality || detectCardinality(fk.fromColumn)} isIdentifying={detectIdentifying(fk.fromColumn)} />
                          )}
                          {fk.cardinality || detectCardinality(fk.fromColumn)}
                        </span>
                      )}
                    </div>

                    <div className="edit-fk-type">
                      <span className={`fk-type-badge ${detectIdentifying(fk.fromColumn) ? 'identifying' : 'non-identifying'}`}
                        title={detectIdentifying(fk.fromColumn) ? 'Identifying: FK is part of Primary Key' : 'Non-Identifying: FK is not part of Primary Key'}>
                        {detectIdentifying(fk.fromColumn) ? 'Identifying' : 'Non-Identifying'}
                      </span>
                    </div>

                    <div className="edit-fk-on-update">
                      <select id={`fk-on-update-${index}`} name={`fk-on-update-${index}`} value={fk.onUpdate}
                        onChange={(e) => handleFKChange(index, 'onUpdate', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.onUpdate || 'RESTRICT'} className="fk-select-with-ellipsis">
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>

                    <div className="edit-fk-on-delete">
                      <select id={`fk-on-delete-${index}`} name={`fk-on-delete-${index}`} value={fk.onDelete}
                        onChange={(e) => handleFKChange(index, 'onDelete', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.onDelete || 'RESTRICT'} className="fk-select-with-ellipsis">
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>

                    {!isDeleteMode && (
                      <div className="edit-fk-actions">
                        {fk.isVirtual ? (
                          editingFK === index ? (
                            <>
                              <button className="btn-save" onClick={() => handleSaveFK(index)} title="Save">✓</button>
                              <button className="btn-cancel" onClick={() => handleCancelFK(index)} title="Cancel">✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-edit" onClick={() => setEditingFK(index)} title="Edit foreign key">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                              </button>
                              <button className="btn-delete" onClick={() => handleDeleteFK(index)} title="Delete foreign key">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </>
                          )
                        ) : (
                          <span className="read-only-indicator">🔒 Read-Only</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'columns' && (
            <div className="columns-tab">
              <div className="tab-header">
                <h3>Column Details</h3>
                <p className="tab-description">View column information and add notes</p>
              </div>
              <div className="columns-table">
                <div className="columns-header">
                  <div className="col-name">Column Name</div>
                  <div className="col-datatype">Data Type</div>
                  <div className="col-constraints">Constraints</div>
                  <div className="col-default">Default</div>
                  <div className="col-notes">Description</div>
                </div>
                <div className="columns-rows-container">
                  {columns.map((column, index) => (
                    <div key={index} className="columns-row">
                      <div className="col-name" title={column.name}><span className="column-name-text">{column.name}</span></div>
                      <div className="col-datatype"><span className="datatype-badge">{column.type}</span></div>
                      <div className="col-constraints">
                        <div className="constraint-badges">
                          {column.pk && <span className="constraint-badge pk" title="Primary Key">PK</span>}
                          {column.fk && <span className="constraint-badge fk" title="Foreign Key">FK</span>}
                          {column.unique && <span className="constraint-badge uq" title="Unique">UQ</span>}
                          {!column.nullable && <span className="constraint-badge nn" title="Not Null">NN</span>}
                          {column.autoIncrement && <span className="constraint-badge ai" title="Auto Increment">AI</span>}
                        </div>
                      </div>
                      <div className="col-default"><span className="default-value">{column.defaultValue || '-'}</span></div>
                      <div className="col-notes">
                        <input id={`notes-${tableName}-${column.name}`} name={`notes-${tableName}-${column.name}`}
                          type="text" className="notes-input" placeholder="Add description..."
                          value={columnNotes[column.name] || ''}
                          onChange={(e) => setColumnNotes({ ...columnNotes, [column.name]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {activeTab === 'constraints' && (
            <>
              <button className="btn-cancel" onClick={handleCancelConstraints} disabled={Object.keys(pendingConstraintChanges).length === 0}>Cancel Changes</button>
              <button className="btn-save" onClick={handleApplyConstraints} disabled={Object.keys(pendingConstraintChanges).length === 0}>Apply Constraints</button>
            </>
          )}
        </div>
      </div>

      <ConflictWarningModal isOpen={conflictModal.isOpen} onClose={handleConflictCancel} onConfirm={handleConflictConfirm}
        conflicts={conflictModal.conflicts} cascadingChanges={conflictModal.cascadingChanges}
        affectedTables={conflictModal.affectedTables} changeDescription={conflictModal.changeDescription} />

      <AlertModal isOpen={alertModal.isOpen} onClose={closeAlert} title={alertModal.title} message={alertModal.message} type={alertModal.type} />

      <ConfirmModal isOpen={confirmModal.isOpen} onClose={closeConfirm} onConfirm={confirmModal.onConfirm ?? (() => {})}
        title={confirmModal.title} message={confirmModal.message} type={confirmModal.type} />

      <NMPreviewModal isOpen={nmPreviewModal.isOpen} onClose={() => setNMPreviewModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={nmPreviewModal.onConfirm ?? (() => {})} table1={nmPreviewModal.table1} table1Column={nmPreviewModal.table1Column}
        table2={nmPreviewModal.table2} table2Column={nmPreviewModal.table2Column}
        junctionTableName={nmPreviewModal.junctionTableName} fk1Name={nmPreviewModal.fk1Name} fk2Name={nmPreviewModal.fk2Name}
        table1Type={nmPreviewModal.table1Type} table2Type={nmPreviewModal.table2Type} />
    </div>
  );
};

export default EditTableModal;
