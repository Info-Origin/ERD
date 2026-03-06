import React, { useState, useEffect, useCallback } from 'react';
import { useVirtualSchema } from '../../context/VirtualSchemaContext';
import { useApp } from '../../context/AppContext';
import { formatDataTypeForDisplay, getFullDataType } from '../../utils/dataTypeFormatter';
import { 
  ALL_MYSQL_DATA_TYPES, 
  DATA_TYPES_WITH_LENGTH, 
  DATA_TYPES_WITH_DEFAULTS,
  COMMON_DEFAULTS,
  getBaseDataType,
  getTypeLength,
  buildFullType,
  areDataTypesCompatible
} from '../../utils/mysqlDataTypes';
import { analyzeColumnChange, applyCascadingChanges } from '../../utils/conflictDetection';
import { ConflictWarningModal } from './ConflictWarningModal';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';
import { NMPreviewModal } from './NMPreviewModal';
import { getTableColumnNotes, saveColumnNote } from '../../services/columnNotesService';
import './Modal.css';
import './EditTableModal.css';
import './AlertModal.css';
import './ConfirmModal.css';

// Cardinality Icon Component (same size as Legend - 30px)
const CardinalityIcon = ({ cardinality, isIdentifying }) => {
  const strokeDasharray = isIdentifying ? 'none' : '2,2';
  
  if (cardinality === '1:1') {
    // One-to-One: Circle on both ends
    return (
      <svg width="30" height="12" viewBox="0 0 30 12" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
        <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray={strokeDasharray} />
        <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
        <circle cx="26" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
      </svg>
    );
  } else {
    // One-to-Many: Circle on left, Crow's foot on right
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

const EditTableModal = ({ isOpen, onClose, tableName, schemaName }) => {
  const {
    workingSchema,
    originalSchema, // NEW: Get baseline schema to check if columns are from real DB
    hasUnsavedChanges,
    addRelationship,
    addForeignKeyWithNewColumn, // NEW: Atomic FK creation
    updateForeignKeyColumn, // NEW: Atomic FK column update
    updateForeignKeyWithNewColumn, // NEW: Atomic FK update with new column creation
    addManyToManyRelationship, // NEW: N:M relationship creation
    isTableJunctionTable, // NEW: Helper to detect junction tables
    deleteRelationship,
    deleteTable, // For deleting junction tables
    deleteColumn, // Add this for deleting user-created FK columns
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,
    updateColumn,
    addColumn,
    forceRefreshFromBackend
  } = useVirtualSchema();

  const { registerEditTableModalRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('constraints');
  const [columns, setColumns] = useState([]);
  const [foreignKeys, setForeignKeys] = useState([]);
  const [editingFK, setEditingFK] = useState(null);
  const [showAddFK, setShowAddFK] = useState(false);
  const [columnNotes, setColumnNotes] = useState({}); // Store notes for each column
  const [isApplyingConstraints, setIsApplyingConstraints] = useState(false); // Track when we're applying constraints
  const [isSavingFK, setIsSavingFK] = useState(false); // Track when we're saving FK to prevent reload
  const previousColumnsRef = React.useRef([]); // Track previous columns for rename detection
  
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
    
    // Debounce timer
    const timeoutId = setTimeout(async () => {
      // Save each note that has changed
      for (const [columnName, note] of Object.entries(columnNotes)) {
        try {
          await saveColumnNote(schemaName, tableName, columnName, note);
        } catch (error) {
          console.error(`Failed to save note for ${columnName}:`, error);
        }
      }
    }, 1000); // Save after 1 second of no changes
    
    return () => clearTimeout(timeoutId);
  }, [columnNotes, tableName, schemaName]);
  
  // Bulk FK deletion state
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedFKs, setSelectedFKs] = useState(new Set());
  
  // Pending constraint changes state
  const [pendingConstraintChanges, setPendingConstraintChanges] = useState({});
  
  // New modal states
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  
  // N:M Preview Modal state
  const [nmPreviewModal, setNMPreviewModal] = useState({
    isOpen: false,
    table1: '',
    table1Column: '',
    table2: '',
    table2Column: '',
    junctionTableName: '',
    fk1Name: '',
    fk2Name: '',
    table1Type: '',
    table2Type: '',
    onConfirm: null
  });
  
  // Helper function to check if column exists in baseline (real DB)
  const isColumnFromRealDB = useCallback((columnName) => {
    if (!originalSchema || !tableName) return false;
    const baselineTable = originalSchema.tables?.[tableName];
    if (!baselineTable) return false;
    return Boolean(baselineTable.columns?.[columnName]);
  }, [originalSchema, tableName]);

  // Helper functions for modals
  const showAlert = (title, message, type = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const closeAlert = () => {
    setAlertModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const closeConfirm = () => {
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
  };
  
  // Conflict detection state
  const [conflictModal, setConflictModal] = useState({
    isOpen: false,
    conflicts: [],
    cascadingChanges: [],
    affectedTables: [],
    changeDescription: '',
    pendingChange: null
  });
  
  // REMOVED: All structure editing state and functions
  // - editingTableName, editingColumnData
  // - addColumn, deleteColumn, renameColumn, renameTable functions
  // - showAddColumn, newColumn state

  // Helper function to detect column renames and transfer descriptions
  const transferDescriptionsOnRename = useCallback((oldColumns, newColumns, currentNotes) => {
    if (!oldColumns || oldColumns.length === 0) return currentNotes;
    
    const updatedNotes = { ...currentNotes };
    let hasChanges = false;
    
    // Strategy 1: Match by position (index) - most reliable for renames
    newColumns.forEach((newCol, index) => {
      if (index < oldColumns.length) {
        const oldCol = oldColumns[index];
        
        // If names are different but position is same, likely a rename
        if (oldCol.name !== newCol.name && currentNotes[oldCol.name]) {
          updatedNotes[newCol.name] = currentNotes[oldCol.name];
          delete updatedNotes[oldCol.name];
          hasChanges = true;
          console.log(`📝 Transferred description from "${oldCol.name}" to "${newCol.name}" (by position)`);
        }
      }
    });
    
    // Strategy 2: Match by properties (type, constraints) for columns that moved positions
    if (!hasChanges) {
      const oldColumnMap = new Map();
      oldColumns.forEach(col => {
        const key = `${col.type}_${col.pk}_${col.fk}_${col.unique}_${col.nullable}`;
        if (!oldColumnMap.has(key)) {
          oldColumnMap.set(key, col.name);
        }
      });
      
      newColumns.forEach(newCol => {
        const key = `${newCol.type}_${newCol.pk}_${newCol.fk}_${newCol.unique}_${newCol.nullable}`;
        const oldName = oldColumnMap.get(key);
        
        if (oldName && oldName !== newCol.name && currentNotes[oldName] && !updatedNotes[newCol.name]) {
          updatedNotes[newCol.name] = currentNotes[oldName];
          delete updatedNotes[oldName];
          hasChanges = true;
          console.log(`📝 Transferred description from "${oldName}" to "${newCol.name}" (by properties)`);
        }
      });
    }
    
    return updatedNotes;
  }, []);

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && workingSchema && tableName && !isSavingFK) { // Don't reload during FK save
      setActiveTab('constraints'); // Always start with Constraints tab
      
      // Reset pending constraint changes
      setPendingConstraintChanges({});
      
      // Reset delete mode state
      setIsDeleteMode(false);
      setSelectedFKs(new Set());
      
      // Load columns (read-only for constraint editing)
      const tableData = workingSchema.tables[tableName];
      if (tableData && tableData.columns) {
        const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
          ...columnData,
          name: columnName,
          originalName: columnName,
          // Ensure all boolean fields have proper defaults
          pk: columnData.pk || false,
          nullable: columnData.nullable !== undefined ? columnData.nullable : true,
          unique: columnData.unique || false,
          fk: columnData.fk || false,
          autoIncrement: columnData.autoIncrement || false,
          // Add data type editing fields
          baseType: getBaseDataType(columnData.type),
          typeLength: getTypeLength(columnData.type),
          defaultValue: columnData.defaultValue || ''
        }));
        
        // Transfer descriptions if columns were renamed
        // console.log('🔍 [Modal Open] Checking for column renames...', {
        //   oldColumnsCount: previousColumnsRef.current.length,
        //   newColumnsCount: columnList.length,
        //   oldColumns: previousColumnsRef.current.map(c => c.name),
        //   newColumns: columnList.map(c => c.name),
        //   currentNotes: Object.keys(columnNotes)
        // });
        
        if (previousColumnsRef.current.length > 0) {
          const updatedNotes = transferDescriptionsOnRename(previousColumnsRef.current, columnList, columnNotes);
          if (JSON.stringify(updatedNotes) !== JSON.stringify(columnNotes)) {
            console.log('✅ [Modal Open] Descriptions updated:', updatedNotes);
            setColumnNotes(updatedNotes);
          } else {
            // console.log('ℹ️ [Modal Open] No description changes needed');
          }
        }
        
        // Update ref with current columns
        previousColumnsRef.current = columnList;
        setColumns(columnList);
      } else {
        setColumns([]);
        previousColumnsRef.current = [];
      }

      // Load foreign keys
      const tableFKs = (workingSchema.relationships || [])
        .filter(rel => rel.fromTable === tableName)
        .map(rel => ({
          id: rel.id,
          name: `FK_${rel.fromTable}_${rel.fromColumn}`,
          fromColumn: rel.fromColumn,
          originalFromColumn: rel.fromColumn, // Track original for editing
          toTable: rel.toTable,
          toColumn: rel.toColumn,
          onUpdate: rel.onUpdate || 'RESTRICT',
          onDelete: rel.onDelete || 'RESTRICT',
          isVirtual: rel.isVirtual || rel.isUserCreated || false // Check both isVirtual and isUserCreated
        }));
      setForeignKeys(tableFKs);
      
      // Reset editing state
      setEditingFK(null);
    }
  }, [isOpen, tableName, workingSchema, isSavingFK, transferDescriptionsOnRename]); // Remove columnNotes to avoid infinite loop

  
  // Refresh columns when switching to Columns or Constraints tab
  useEffect(() => {
    if ((activeTab === 'columns' || activeTab === 'constraints') && workingSchema && tableName) {
      const tableData = workingSchema.tables[tableName];
      if (tableData && tableData.columns) {
        const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
          ...columnData,
          name: columnName,
          originalName: columnName,
          pk: columnData.pk || false,
          nullable: columnData.nullable !== undefined ? columnData.nullable : true,
          unique: columnData.unique || false,
          fk: columnData.fk || false,
          autoIncrement: columnData.autoIncrement || false,
          baseType: getBaseDataType(columnData.type),
          typeLength: getTypeLength(columnData.type),
          defaultValue: columnData.defaultValue || ''
        }));
        
        // Transfer descriptions if columns were renamed
        // console.log('🔍 [Tab Switch] Checking for column renames...', {
        //   oldColumnsCount: previousColumnsRef.current.length,
        //   newColumnsCount: columnList.length,
        //   oldColumns: previousColumnsRef.current.map(c => c.name),
        //   newColumns: columnList.map(c => c.name),
        //   currentNotes: Object.keys(columnNotes)
        // });
        
        if (previousColumnsRef.current.length > 0) {
          const updatedNotes = transferDescriptionsOnRename(previousColumnsRef.current, columnList, columnNotes);
          if (JSON.stringify(updatedNotes) !== JSON.stringify(columnNotes)) {
            console.log('✅ [Tab Switch] Descriptions updated:', updatedNotes);
            setColumnNotes(updatedNotes);
          } else {
          //  console.log('ℹ️ [Tab Switch] No description changes needed');
          }
        }
        
        // Update ref with current columns
        previousColumnsRef.current = columnList;
        setColumns(columnList);
      }
    }
  }, [activeTab, workingSchema, tableName, transferDescriptionsOnRename]); // Remove columnNotes to avoid infinite loop

  // Watch for workingSchema changes after applying constraints
  useEffect(() => {
    if (isApplyingConstraints && workingSchema && tableName) {
      const tableData = workingSchema.tables[tableName];
      if (tableData && tableData.columns) {
        const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
          ...columnData,
          name: columnName,
          originalName: columnName,
          pk: Boolean(columnData.pk),
          nullable: columnData.nullable !== undefined ? columnData.nullable : true,
          unique: Boolean(columnData.unique),
          fk: Boolean(columnData.fk),
          autoIncrement: Boolean(columnData.autoIncrement),
          baseType: getBaseDataType(columnData.type),
          typeLength: getTypeLength(columnData.type),
          defaultValue: columnData.defaultValue || ''
        }));
        setColumns(columnList);
        setIsApplyingConstraints(false);
      }
    }
  }, [workingSchema, isApplyingConstraints, tableName]);

  // Refresh function to reload foreign keys and columns from schema
  const refreshForeignKeys = useCallback(() => {
    if (workingSchema && tableName) {
      // Reload columns (in case columns were added/removed)
      const tableData = workingSchema.tables[tableName];
      if (tableData && tableData.columns) {
        const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
          name: columnName,
          originalName: columnName,
          type: columnData.type,
          pk: Boolean(columnData.pk),
          nullable: columnData.nullable !== false,
          unique: Boolean(columnData.unique),
          fk: Boolean(columnData.fk),
          defaultValue: columnData.defaultValue || ''
        }));
        setColumns(columnList);
      } else {
        setColumns([]);
      }

      // Reload foreign keys
      const tableFKs = (workingSchema.relationships || [])
        .filter(rel => rel.fromTable === tableName)
        .map(rel => ({
          id: rel.id,
          name: `FK_${rel.fromTable}_${rel.fromColumn}`,
          fromColumn: rel.fromColumn,
          toTable: rel.toTable,
          toColumn: rel.toColumn,
          onUpdate: rel.onUpdate || 'RESTRICT',
          onDelete: rel.onDelete || 'RESTRICT',
          isVirtual: rel.isVirtual || rel.isUserCreated || false // Check both isVirtual and isUserCreated
        }));
      setForeignKeys(tableFKs);
    }
  }, [workingSchema, tableName]);

  // Register refresh callback with AppContext when modal opens
  useEffect(() => {
    if (isOpen && registerEditTableModalRefresh) {
      registerEditTableModalRefresh(refreshForeignKeys);
    }
  }, [isOpen, registerEditTableModalRefresh, refreshForeignKeys]);

  const handleSave = () => {
    try {
      // Clear pending changes when closing
      setPendingConstraintChanges({});
      onClose();
    } catch (error) {
      console.error('Error saving constraints:', error);
      showAlert('Error', `Error saving constraints: ${error.message}`, 'error');
    }
  };

  // REMOVED: All structure editing handlers
  // - handleAddColumn, handleDeleteColumn, handleColumnChange, handleCancelColumn, handleSaveColumn

  // Column data type and default value editing
  const handleColumnEdit = (index) => {
    setEditingColumn(index);
  };

  const handleColumnSave = (index) => {
    try {
      const column = columns[index];
      const fullType = buildFullType(column.baseType, column.typeLength);
      const originalColumn = workingSchema.tables[tableName].columns[column.name];
      
      // Prepare the new properties for conflict analysis
      const newProperties = {
        type: fullType,
        defaultValue: column.defaultValue || null,
        nullable: column.nullable,
        pk: column.pk,
        unique: column.unique,
        autoIncrement: column.autoIncrement
      };
      
      // Check for conflicts
      const conflictAnalysis = analyzeColumnChange({
        tableName,
        columnName: column.name,
        newProperties,
        currentSchema: workingSchema
      });
      
      // Generate change description
      const changes = [];
      if (fullType !== originalColumn.type) {
        changes.push(`Data type: ${originalColumn.type} → ${fullType}`);
      }
      if (newProperties.nullable !== originalColumn.nullable) {
        changes.push(`Nullable: ${originalColumn.nullable ? 'YES' : 'NO'} → ${newProperties.nullable ? 'YES' : 'NO'}`);
      }
      if (newProperties.pk !== originalColumn.pk) {
        changes.push(`Primary Key: ${originalColumn.pk ? 'YES' : 'NO'} → ${newProperties.pk ? 'YES' : 'NO'}`);
      }
      if (newProperties.unique !== originalColumn.unique) {
        changes.push(`Unique: ${originalColumn.unique ? 'YES' : 'NO'} → ${newProperties.unique ? 'YES' : 'NO'}`);
      }
      if ((newProperties.defaultValue || '') !== (originalColumn.defaultValue || '')) {
        changes.push(`Default: "${originalColumn.defaultValue || ''}" → "${newProperties.defaultValue || ''}"`);
      }
      
      const changeDescription = `Modify column ${tableName}.${column.name}:\n${changes.join('\n')}`;
      
      // If conflicts detected or cascading changes needed, show warning modal
      if (conflictAnalysis.hasConflicts || conflictAnalysis.cascadingChanges.length > 0) {
        setConflictModal({
          isOpen: true,
          conflicts: conflictAnalysis.conflicts,
          cascadingChanges: conflictAnalysis.cascadingChanges,
          affectedTables: conflictAnalysis.affectedTables,
          changeDescription,
          pendingChange: {
            type: 'COLUMN_UPDATE',
            index,
            column,
            fullType,
            newProperties
          }
        });
        return; // Don't apply changes yet, wait for user confirmation
      }
      
      // No conflicts, apply changes directly
      applyColumnChanges(index, column, fullType, newProperties);
      
    } catch (error) {
      showAlert('Error', `Error updating column: ${error.message}`, 'error');
    }
  };
  
  // Apply column changes (used both directly and after conflict resolution)
  const applyColumnChanges = async (index, column, fullType, newProperties, cascadingChanges = []) => {
    try {
      console.log('🔧 Applying column changes:', {
        tableName,
        columnName: column.name,
        newProperties,
        cascadingChanges
      });
      
      // Update column in virtual schema
      updateColumn(tableName, column.name, newProperties);
      
      // Apply cascading changes if any
      if (cascadingChanges.length > 0) {
        console.log('🔄 Applying cascading changes:', cascadingChanges);
        
        // Apply each cascading change with proper async handling
        for (const change of cascadingChanges) {
          if (change.type === 'DATA_TYPE_CASCADE') {
            console.log(`🔄 Cascading ${change.tableName}.${change.columnName}: ${change.oldType} → ${change.newType}`);
            
            // Apply the change
            updateColumn(change.tableName, change.columnName, {
              type: change.newType
            });
            
            // Small delay between changes to ensure state propagation
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      // Update local state to reflect changes immediately
      const newColumns = [...columns];
      newColumns[index] = {
        ...newColumns[index],
        type: fullType,
        ...newProperties
      };
      setColumns(newColumns);
      setEditingColumn(null);
      
      // Show success message if cascading changes were applied
      if (cascadingChanges.length > 0) {
        const affectedTables = [...new Set(cascadingChanges.map(c => c.tableName))];
        
        // Show success message
        showAlert('Success', `Changes applied successfully!\nCascading updates applied to: ${affectedTables.join(', ')}\n\nChanges are saved in the virtual schema.`, 'success');
        
        // Don't close modal immediately - let user see the changes
        // They can close it manually or it will close when they click OK/Cancel
      }
      
    } catch (error) {
      console.error('❌ Error applying changes:', error);
      showAlert('Error', `Error applying changes: ${error.message}`, 'error');
    }
  };
  
  // Handle conflict modal confirmation
  const handleConflictConfirm = async () => {
    const { pendingChange, cascadingChanges } = conflictModal;
    
    if (pendingChange) {
      if (pendingChange.type === 'COLUMN_UPDATE') {
        await applyColumnChanges(
          pendingChange.index,
          pendingChange.column,
          pendingChange.fullType,
          pendingChange.newProperties,
          cascadingChanges
        );
      } else if (pendingChange.type === 'CONSTRAINT_TOGGLE') {
        await applyConstraintToggle(
          pendingChange.index,
          pendingChange.column,
          pendingChange.constraintType,
          pendingChange.newValue,
          pendingChange.newProperties,
          cascadingChanges
        );
      } else if (pendingChange.type === 'APPLY_CONSTRAINTS') {
        // Apply the specific constraint changes and continue with the rest
        const { columnName, changes } = pendingChange;
        for (const [constraintType, newValue] of Object.entries(changes)) {
          if (constraintType === 'pk') {
            togglePrimaryKey(tableName, columnName);
          } else if (constraintType === 'nullable') {
            toggleNullable(tableName, columnName);
          } else if (constraintType === 'unique') {
            toggleUnique(tableName, columnName);
          }
        }
        
        // Remove this column from pending changes and continue with others
        const remainingChanges = { ...pendingConstraintChanges };
        delete remainingChanges[columnName];
        setPendingConstraintChanges(remainingChanges);
        
        // Apply cascading changes if any
        if (cascadingChanges && cascadingChanges.length > 0) {
          await applyCascadingChanges(cascadingChanges, workingSchema, {
            updateColumn,
            togglePrimaryKey,
            toggleUnique,
            toggleNullable
          });
        }
        
        // Continue applying remaining constraint changes
        if (Object.keys(remainingChanges).length > 0) {
          // Process next column (this will trigger another conflict check if needed)
          setTimeout(() => handleApplyConstraints(), 100);
        }
      }
    }
    
    // Close conflict modal
    setConflictModal({
      isOpen: false,
      conflicts: [],
      cascadingChanges: [],
      affectedTables: [],
      changeDescription: '',
      pendingChange: null
    });
  };
  
  // Handle conflict modal cancellation
  const handleConflictCancel = () => {
    setConflictModal({
      isOpen: false,
      conflicts: [],
      cascadingChanges: [],
      affectedTables: [],
      changeDescription: '',
      pendingChange: null
    });
  };

  // Enhanced constraint toggle handlers with pending state
  const handleConstraintToggle = (index, constraintType, newValue) => {
    const column = columns[index];
    const columnName = column.name;
    
    console.log('🔧 Constraint toggled:', { columnName, constraintType, newValue });
    
    // CRITICAL: Check if trying to set PK on a virtual column when real DB already has PK
    if (constraintType === 'pk' && newValue === true) {
      // Check if any real DB column already has PK
      const realDBHasPK = columns.some(col => isColumnFromRealDB(col.name) && col.pk);
      
      if (realDBHasPK) {
        // Show error - cannot have virtual PK when real DB already defines one
        showAlert(
          'Cannot Set Primary Key',
          'This table already has a primary key defined in the real database. A table can only have one primary key. To change the primary key, you must modify it in the actual database.',
          'error'
        );
        return; // Don't allow the change
      }
    }
    
    // Update pending changes
    setPendingConstraintChanges(prev => {
      const updated = {
        ...prev,
        [columnName]: {
          ...prev[columnName],
          [constraintType]: newValue
        }
      };
      return updated;
    });
    
    // Update the local columns state for UI display
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      
      // Special handling for PK constraint - only one column can be PK
      if (constraintType === 'pk' && newValue === true) {
        // Uncheck all OTHER VIRTUAL PK columns in UI (don't touch real DB columns)
        newColumns.forEach((col, idx) => {
          if (idx !== index && col.pk && !isColumnFromRealDB(col.name)) {
            // Only uncheck if it's a virtual column
            newColumns[idx] = { ...col, pk: false };
            // Also remove from pending changes for other columns
            setPendingConstraintChanges(prev => ({
              ...prev,
              [col.name]: {
                ...prev[col.name],
                pk: false
              }
            }));
          }
        });
        
        // Set the current column as PK and NOT NULL
        newColumns[index] = {
          ...newColumns[index],
          pk: true,
          nullable: false
        };
        
        // Update pending changes for nullable as well
        setPendingConstraintChanges(prev => ({
          ...prev,
          [columnName]: {
            ...prev[columnName],
            pk: true,
            nullable: false
          }
        }));
      } else {
        // For other constraints, just update normally
        newColumns[index] = {
          ...newColumns[index],
          [constraintType]: newValue
        };
        
        // Special handling for PK constraint (PK implies NOT NULL)
        if (constraintType === 'pk' && newValue === true) {
          newColumns[index].nullable = false;
          setPendingConstraintChanges(prev => ({
            ...prev,
            [columnName]: {
              ...prev[columnName],
              nullable: false
            }
          }));
        }
      }
      
      return newColumns;
    });
  };
  // Apply all pending constraint changes
  const handleApplyConstraints = async () => {
    if (Object.keys(pendingConstraintChanges).length === 0) {
      return; // No changes to apply
    }

    // Process each column with pending changes
    for (const [columnName, changes] of Object.entries(pendingConstraintChanges)) {
      const column = columns.find(col => col.name === columnName);
      const originalColumn = workingSchema.tables[tableName].columns[columnName];
      
      // Prepare the new properties
      const newProperties = {
        type: originalColumn.type,
        defaultValue: originalColumn.defaultValue,
        nullable: originalColumn.nullable,
        pk: originalColumn.pk,
        unique: originalColumn.unique,
        autoIncrement: originalColumn.autoIncrement,
        ...changes // Apply pending changes
      };
      
      // Check for conflicts
      const conflictAnalysis = analyzeColumnChange({
        tableName,
        columnName,
        newProperties,
        currentSchema: workingSchema
      });
      
      // Generate change description
      const constraintNames = {
        pk: 'Primary Key',
        nullable: 'Nullable',
        unique: 'Unique'
      };
      
      const changedConstraints = Object.keys(changes).map(key => constraintNames[key]).join(', ');
      const changeDescription = `Modify ${changedConstraints} constraint(s) on ${tableName}.${columnName}`;
      
      // If conflicts detected, show warning modal
      if (conflictAnalysis.hasConflicts || conflictAnalysis.cascadingChanges.length > 0) {
        setConflictModal({
          isOpen: true,
          conflicts: conflictAnalysis.conflicts,
          cascadingChanges: conflictAnalysis.cascadingChanges,
          affectedTables: conflictAnalysis.affectedTables,
          changeDescription,
          pendingChange: {
            type: 'APPLY_CONSTRAINTS',
            columnName,
            changes,
            newProperties
          }
        });
        return; // Stop processing and wait for user confirmation
      }
    }
    
    // No conflicts, apply all changes
    await applyAllConstraintChanges();
  };

  // Apply all constraint changes to virtual schema
  const applyAllConstraintChanges = async () => {
    // Set flag to trigger reload when workingSchema updates
    setIsApplyingConstraints(true);
    
    // Group changes by column to apply them together
    for (const [columnName, changes] of Object.entries(pendingConstraintChanges)) {
      // Check if this column is being set as PK
      const isSettingPK = changes.pk === true;
      
      if (isSettingPK) {
        // If setting PK, only call togglePrimaryKey (it will handle nullable automatically)
        togglePrimaryKey(tableName, columnName);
      } else {
        // Apply other constraint changes
        for (const [constraintType, newValue] of Object.entries(changes)) {
          if (constraintType === 'nullable') {
            toggleNullable(tableName, columnName);
          } else if (constraintType === 'unique') {
            toggleUnique(tableName, columnName);
          }
          // Skip 'pk' here as it's handled above
        }
      }
    }
    
    // Clear pending changes
    setPendingConstraintChanges({});
  };

  // Cancel all pending constraint changes
  const handleCancelConstraints = () => {
    // Revert columns to original state
    if (workingSchema && tableName && workingSchema.tables[tableName]) {
      const tableData = workingSchema.tables[tableName];
      const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
        ...columnData,
        name: columnName,
        originalName: columnName,
        pk: columnData.pk || false,
        nullable: columnData.nullable !== undefined ? columnData.nullable : true,
        unique: columnData.unique || false,
        fk: columnData.fk || false,
        autoIncrement: columnData.autoIncrement || false,
        baseType: getBaseDataType(columnData.type),
        typeLength: getTypeLength(columnData.type),
        defaultValue: columnData.defaultValue || ''
      }));
      setColumns(columnList);
    }
    
    // Clear pending changes
    setPendingConstraintChanges({});
  };
  const applyConstraintToggle = async (index, column, constraintType, newValue, newProperties, cascadingChanges = []) => {
    try {
      // Apply the constraint toggle using the appropriate virtual schema method
      if (constraintType === 'pk') {
        await togglePrimaryKey(tableName, column.name);
      } else if (constraintType === 'nullable') {
        await toggleNullable(tableName, column.name);
      } else if (constraintType === 'unique') {
        await toggleUnique(tableName, column.name);
      }
      
      // Apply cascading changes if any
      if (cascadingChanges.length > 0) {
        for (const change of cascadingChanges) {
          if (change.type === 'DATA_TYPE_CASCADE') {
            await updateColumn(change.tableName, change.columnName, {
              type: change.newType
            });
            
            // Small delay between changes to ensure state propagation
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      // Force reload columns from workingSchema after state update
      // Use a longer delay to ensure workingSchema has been updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reload columns from the updated workingSchema
      if (workingSchema && tableName && workingSchema.tables[tableName]) {
        const tableData = workingSchema.tables[tableName];
        const columnList = Object.entries(tableData.columns).map(([columnName, columnData]) => ({
          ...columnData,
          name: columnName,
          originalName: columnName,
          pk: Boolean(columnData.pk),
          nullable: columnData.nullable !== undefined ? columnData.nullable : true,
          unique: Boolean(columnData.unique),
          fk: Boolean(columnData.fk),
          autoIncrement: Boolean(columnData.autoIncrement),
          baseType: getBaseDataType(columnData.type),
          typeLength: getTypeLength(columnData.type),
          defaultValue: columnData.defaultValue || ''
        }));
        setColumns(columnList);
        console.log('Columns reloaded after constraint toggle:', columnList.find(c => c.name === column.name));
      }
      
      // Show success message if cascading changes were applied
      if (cascadingChanges.length > 0) {
        const affectedTables = [...new Set(cascadingChanges.map(c => c.tableName))];
        showAlert('Success', `Constraint updated successfully!\nCascading updates applied to: ${affectedTables.join(', ')}`, 'success');
      }
      
    } catch (error) {
      showAlert('Error', `Error updating constraint: ${error.message}`, 'error');
    }
  };



  const handleAddFK = () => {
    const newFK = {
      name: `FK_${tableName}_new`,
      fromColumn: '__CREATE_NEW__', // Default to creating new column
      newColumnName: '', // Will be filled by user in FK Name field
      toTable: '',
      toColumn: '',
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
      cardinality: '1:N', // Default cardinality (can be 1:1, 1:N, or N:M)
      junctionTableName: '', // For N:M relationships
      isNew: true,
      isVirtual: true // Mark new FKs as virtual (user-created)
    };
    const newIndex = foreignKeys.length;
    setForeignKeys([...foreignKeys, newFK]);
    setEditingFK(newIndex); // Automatically enter edit mode for the new FK
    setShowAddFK(false);
  };

  // Bulk FK deletion handlers
  const handleToggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedFKs(new Set()); // Clear selection when toggling mode
  };

  const handleToggleFKSelection = (index) => {
    const fk = foreignKeys[index];
    
    // Only allow selecting user-created FKs
    if (!fk.isVirtual) return;
    
    setSelectedFKs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSelectAllFKs = () => {
    // Get all user-created FK indices
    const userCreatedIndices = foreignKeys
      .map((fk, index) => fk.isVirtual ? index : null)
      .filter(index => index !== null);
    
    if (selectedFKs.size === userCreatedIndices.length) {
      // All selected, deselect all
      setSelectedFKs(new Set());
    } else {
      // Select all user-created FKs
      setSelectedFKs(new Set(userCreatedIndices));
    }
  };

  const handleDeleteSelectedFKs = () => {
    if (selectedFKs.size === 0) return;
    
    const fksToDelete = Array.from(selectedFKs).map(index => foreignKeys[index]);
    const fkNames = fksToDelete.map(fk => fk.name).join(', ');
    
    // Check if this is a junction table
    const tableData = workingSchema.tables[tableName];
    const allColumns = Object.values(tableData?.columns || {});
    const fkColumns = allColumns.filter(col => col.fk);
    const pkColumns = allColumns.filter(col => col.pk);
    
    const isJunctionTable = tableData?.isJunctionTable || 
      (fkColumns.length === 2 && pkColumns.length === 2 && 
       fkColumns.every(fkCol => fkCol.pk));
    
    if (isJunctionTable) {
      // Show warning that deleting FKs from junction table will delete entire table
      showConfirm(
        'Delete Junction Table',
        `"${tableName}" is a junction table for a many-to-many relationship. Deleting foreign keys will delete the entire table and break the N:M relationship. Continue?`,
        () => {
          // Delete the entire table (this automatically removes all relationships in one operation)
          // This creates only ONE history entry for undo/redo
          deleteTable(tableName);
          
          // Close the modal
          onClose();
        },
        'danger'
      );
      return;
    }
    
    showConfirm(
      'Delete Selected Foreign Keys',
      `Are you sure you want to delete ${selectedFKs.size} foreign key(s)?\n\n${fkNames}\n\nThis action cannot be undone.`,
      () => {
        // Delete each selected FK
        fksToDelete.forEach(fk => {
          if (fk.id) {
            deleteRelationship(fk.id);
          }
        });
        
        // Clear selection and exit delete mode
        setSelectedFKs(new Set());
        setIsDeleteMode(false);
        
        showAlert('Success', `Successfully deleted ${selectedFKs.size} foreign key(s).`, 'success');
      },
      'danger'
    );
  };

  const handleDeleteFK = (index) => {
    try {
      const fk = foreignKeys[index];
      
      // Only allow deleting virtual FKs
      if (!fk.isVirtual) {
        showAlert('Cannot Delete', 'Real database foreign keys cannot be deleted from the ERD tool. This would require direct database changes.', 'warning');
        return;
      }
      
      // Check if this is a junction table
      const tableData = workingSchema.tables[tableName];
      const allColumns = Object.values(tableData?.columns || {});
      const fkColumns = allColumns.filter(col => col.fk);
      const pkColumns = allColumns.filter(col => col.pk);
      
      const isJunctionTable = tableData?.isJunctionTable || 
        (fkColumns.length === 2 && pkColumns.length === 2 && 
         fkColumns.every(fkCol => fkCol.pk));
      
      if (isJunctionTable) {
        // Show warning that deleting FK from junction table will delete entire table
        showConfirm(
          'Delete Junction Table',
          `"${tableName}" is a junction table for a many-to-many relationship. Deleting this foreign key will delete the entire table and break the N:M relationship. Continue?`,
          () => {
            // Delete the entire table (this automatically removes all relationships in one operation)
            // This creates only ONE history entry for undo/redo
            deleteTable(tableName);
            
            // Close the modal
            onClose();
          },
          'danger'
        );
        return;
      }
      
      showConfirm(
        'Delete Foreign Key',
        `Delete foreign key "${fk.name}"?`,
        () => {
          // Delete from virtual schema if it's not a new FK
          if (!fk.isNew && fk.id) {
            deleteRelationship(fk.id);
          }
          
          // Remove from local state
          const newFKs = foreignKeys.filter((_, i) => i !== index);
          setForeignKeys(newFKs);
          setEditingFK(null);
        },
        'danger'
      );
    } catch (error) {
      showAlert('Error', `Error deleting foreign key: ${error.message}`, 'error');
    }
  };

  const handleCancelFK = (index) => {
    const fk = foreignKeys[index];
    
    // If it's a new FK that was never saved, remove it from the array
    if (fk.isNew) {
      const newFKs = foreignKeys.filter((_, i) => i !== index);
      setForeignKeys(newFKs);
    }
    
    // Exit edit mode
    setEditingFK(null);
  };

  const handleFKChange = useCallback((index, field, value) => {
    setForeignKeys(prevFKs => {
      const newFKs = [...prevFKs];
      newFKs[index] = {
        ...newFKs[index],
        [field]: value
      };

      // Auto-suggest column name when referenced table is selected
      if (field === 'toTable' && value && newFKs[index].fromColumn === '__CREATE_NEW__') {
        const suggestedColumnName = `${value}_id`;
        newFKs[index].newColumnName = suggestedColumnName;
        newFKs[index].name = `FK_${tableName}_${suggestedColumnName}`;
      }

      // Handle cardinality change - update UNIQUE constraint on FK column
      if (field === 'cardinality' && newFKs[index].fromColumn && newFKs[index].fromColumn !== '__CREATE_NEW__') {
        const fkColumnName = newFKs[index].fromColumn;
        const shouldBeUnique = value === '1:1';
        
        console.log('🔄 Cardinality changed:', { fkColumnName, newCardinality: value, shouldBeUnique });
        
        // Check if the FK column is a PK
        const fkColumn = columns.find(col => col.name === fkColumnName);
        const isPK = fkColumn?.pk || false;
        
        // If the column is a PK, it's always unique (1:1), so don't allow changing to 1:N
        if (isPK && !shouldBeUnique) {
          console.warn('Cannot change cardinality to 1:N for a PK column - PKs are always unique');
          // Revert the change
          newFKs[index].cardinality = '1:1';
          return newFKs;
        }
        
        // Update the column's unique constraint in local state (only if not a PK)
        if (!isPK) {
          console.log('✏️ Updating UNIQUE constraint:', { column: fkColumnName, unique: shouldBeUnique });
          
          setColumns(prevColumns => {
            const newColumns = [...prevColumns];
            const columnIndex = newColumns.findIndex(col => col.name === fkColumnName);
            
            if (columnIndex !== -1) {
              newColumns[columnIndex] = {
                ...newColumns[columnIndex],
                unique: shouldBeUnique
              };
              console.log('✅ Local columns state updated');
            }
            
            return newColumns;
          });
          
          // Update in workingSchema for both new and existing FKs
          // Use setTimeout to avoid updating state during render
          if (workingSchema && workingSchema.tables[tableName]) {
            const column = workingSchema.tables[tableName].columns[fkColumnName];
            if (column) {
              // Toggle unique constraint to match cardinality
              if (column.unique !== shouldBeUnique) {
                console.log('🔧 Toggling UNIQUE in workingSchema (deferred)');
                setTimeout(() => {
                  toggleUnique(tableName, fkColumnName);
                }, 0);
              }
            }
          }
        }
      }

      return newFKs;
    });
  }, [tableName, workingSchema, toggleUnique]);

  const handleSaveFK = (index) => {
    try {
      const fk = foreignKeys[index];
      
      // N:M RELATIONSHIP HANDLING
      if (fk.cardinality === 'N:M') {
        // Validate N:M specific requirements
        if (!fk.toTable) {
          showAlert('Validation Error', 'Please select the second table for N:M relationship', 'warning');
          return;
        }

        if (!fk.toColumn) {
          showAlert('Validation Error', 'Please select a column from the second table', 'warning');
          return;
        }

        // CRITICAL: Check if N:M relationship already exists between these two tables
        // Look for any junction table that connects these two tables
        const sortedTables = [tableName, fk.toTable].sort();
        const existingJunctionTable = Object.entries(workingSchema.tables).find(([tblName, tableData]) => {
          const junctionInfo = isTableJunctionTable(tblName, tableData);
          if (junctionInfo.isJunction && junctionInfo.junctionFor) {
            const junctionFor = junctionInfo.junctionFor.sort();
            return JSON.stringify(junctionFor) === JSON.stringify(sortedTables);
          }
          return false;
        });

        if (existingJunctionTable) {
          const [existingJunctionName] = existingJunctionTable;
          showAlert(
            'N:M Already Exists',
            `A Many-to-Many relationship already exists between "${tableName}" and "${fk.toTable}" via junction table "${existingJunctionName}".\n\n` +
            `You cannot create multiple N:M relationships between the same two tables.\n\n` +
            `If you need to modify the relationship, delete the existing junction table first.`,
            'error'
          );
          return;
        }

        // Get current table's PK column
        const currentTablePKColumn = Object.entries(workingSchema.tables[tableName].columns)
          .find(([name, col]) => col.pk || col.unique);
        
        if (!currentTablePKColumn) {
          showAlert('Validation Error', `Table "${tableName}" must have a PRIMARY KEY or UNIQUE column for N:M relationship`, 'warning');
          return;
        }

        const [table1Column, table1ColData] = currentTablePKColumn;

        // Validate second table has PK/UNIQUE
        const table2Col = workingSchema.tables[fk.toTable].columns[fk.toColumn];
        if (!table2Col || (!table2Col.pk && !table2Col.unique)) {
          showAlert('Validation Error', `Column "${fk.toColumn}" in table "${fk.toTable}" must be PRIMARY KEY or UNIQUE`, 'warning');
          return;
        }

        // Generate junction table name and FK names
        const autoJunctionName = [tableName, fk.toTable].sort().join('_');
        const finalJunctionName = fk.junctionTableName?.trim() || autoJunctionName;

        // Check if junction table name already exists (for different tables or regular table)
        if (workingSchema.tables[finalJunctionName]) {
          const existingTable = workingSchema.tables[finalJunctionName];
          
          if (existingTable.isJunctionTable && existingTable.junctionFor) {
            // It's a junction table for different tables
            showAlert(
              'Table Name Conflict',
              `Junction table "${finalJunctionName}" already exists for tables: ${existingTable.junctionFor.join(' and ')}.\n\n` +
              `Please choose a different junction table name.`,
              'warning'
            );
          } else {
            // It's a regular table with the same name
            showAlert(
              'Table Name Conflict',
              `Table "${finalJunctionName}" already exists in the schema.\n\n` +
              `Please choose a different junction table name.\n\n` +
              `Suggestions:\n` +
              `- ${finalJunctionName}_junction\n` +
              `- ${finalJunctionName}_link\n` +
              `- ${finalJunctionName}_map`,
              'warning'
            );
          }
          return;
        }

        // Generate FK column names
        const generateFKName = (tblName, colName) => {
          const tableNameLower = tblName.toLowerCase();
          const columnNameLower = colName.toLowerCase();
          
          if (columnNameLower === 'id') {
            return `${tableNameLower}_id`;
          }
          
          if (columnNameLower.includes(tableNameLower)) {
            return columnNameLower;
          }
          
          return `${tableNameLower}_${columnNameLower}`;
        };

        let fk1Name = generateFKName(tableName, table1Column);
        let fk2Name = generateFKName(fk.toTable, fk.toColumn);

        // Handle self-referencing N:M
        if (tableName === fk.toTable && fk1Name === fk2Name) {
          fk1Name = `${fk1Name}_1`;
          fk2Name = `${fk2Name}_2`;
        }

        // Show N:M Preview Modal
        setNMPreviewModal({
          isOpen: true,
          table1: tableName,
          table1Column: table1Column,
          table2: fk.toTable,
          table2Column: fk.toColumn,
          junctionTableName: finalJunctionName,
          fk1Name,
          fk2Name,
          table1Type: table1ColData.type,
          table2Type: table2Col.type,
          onConfirm: () => {
            try {
              // Create N:M relationship
              const result = addManyToManyRelationship(
                tableName,
                table1Column,
                fk.toTable,
                fk.toColumn,
                finalJunctionName
              );

           //   console.log('✅ N:M relationship created:', result);

              // Close preview modal
              setNMPreviewModal({ ...nmPreviewModal, isOpen: false });

              // Remove the FK from editing state
              setEditingFK(null);

              // Remove from foreignKeys list (it's now a junction table, not a regular FK)
              const newFKs = foreignKeys.filter((_, i) => i !== index);
              setForeignKeys(newFKs);

              showAlert('Success', `N:M relationship created successfully!\n\nJunction table "${result.junctionTableName}" has been created with two 1:N relationships.`, 'success');
            } catch (error) {
              setNMPreviewModal({ ...nmPreviewModal, isOpen: false });
              showAlert('Error', `Error creating N:M relationship: ${error.message}`, 'error');
              console.error('N:M creation error:', error);
            }
          }
        });

        return; // Exit early for N:M
      }

      // REGULAR 1:1 or 1:N RELATIONSHIP HANDLING
      // Validation
      if (!fk.name.trim()) {
        showAlert('Validation Error', 'Foreign key name is required', 'warning');
        return;
      }

      if (!fk.toTable) {
        showAlert('Validation Error', 'Please select a referenced table', 'warning');
        return;
      }

      // Check if target table has any PK or UNIQUE columns available for referencing
      const availableTargetColumns = getAvailableColumns(fk.toTable);
      if (availableTargetColumns.length === 0) {
        showAlert('Validation Error', `Table "${fk.toTable}" has no PRIMARY KEY or UNIQUE columns available for foreign key reference. Add a PRIMARY KEY or UNIQUE constraint to a column first.`, 'warning');
        return;
      }

      if (!fk.toColumn) {
        showAlert('Validation Error', 'Please select a referenced column', 'warning');
        return;
      }

      let actualColumnName = fk.fromColumn;

      // Handle creating new column
      if (fk.fromColumn === '__CREATE_NEW__') {
        if (!fk.newColumnName || !fk.newColumnName.trim()) {
          showAlert('Validation Error', 'Please enter a name for the new column', 'warning');
          return;
        }

        actualColumnName = fk.newColumnName.trim();
        
        // SELF-JOIN VALIDATION: Prevent same column self-reference (for new columns)
        if (fk.toTable === tableName && actualColumnName === fk.toColumn) {
          showAlert(
            'Self-Join Error', 
            `Cannot create self-referencing foreign key: column "${actualColumnName}" cannot reference itself.\n\nFor self-join relationships, the foreign key column must reference a different column in the same table.\n\nExample: employees.manager_id → employees.employee_id`,
            'error'
          );
          return;
        }

        // Check if column name already exists
        const existingColumn = columns.find(col => col.name === actualColumnName);
        if (existingColumn) {
          showAlert('Validation Error', `Column "${actualColumnName}" already exists. Please choose a different name.`, 'warning');
          return;
        }

        // Determine appropriate data type based on referenced column
        const referencedTable = workingSchema.tables[fk.toTable];
        const referencedColumn = referencedTable?.columns[fk.toColumn];
        const columnType = referencedColumn?.type || 'INT';

        // ATOMIC OPERATION: Create both column and relationship in single history entry
        let relationshipId;
        try {
          relationshipId = addForeignKeyWithNewColumn(
            tableName, 
            actualColumnName, 
            columnType, 
            fk.toTable, 
            fk.toColumn, 
            'ONE_TO_MANY'
          );
        } catch (error) {
          if (error.message === "Relationship already exists") {
            showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            return;
          } else {
            throw error; // Re-throw other errors
          }
        }

        // Update local columns state
        const newColumn = {
          name: actualColumnName,
          type: columnType,
          pk: false,
          nullable: true,
          unique: false,
          fk: true,
          defaultValue: null,
          originalName: actualColumnName
        };
        setColumns([...columns, newColumn]);

        // Update local FK state with the relationship ID
        const newFKs = [...foreignKeys];
        newFKs[index] = { 
          ...fk, 
          fromColumn: actualColumnName,
          isNew: false,
          id: relationshipId // Use the actual relationship ID
        };
        setForeignKeys(newFKs);

      } else {
        // Using existing column - ADD DATA TYPE VALIDATION
        if (!fk.fromColumn) {
          showAlert('Validation Error', 'Please select a column from the current table', 'warning');
          return;
        }

        // Check if the column exists in working schema
        const workingSchemaColumn = workingSchema.tables[tableName]?.columns[fk.fromColumn];
        if (!workingSchemaColumn) {
          showAlert('Validation Error', `Column "${fk.fromColumn}" does not exist in table "${tableName}"`, 'warning');
          return;
        }
        
        // SELF-JOIN VALIDATION: Prevent same column self-reference (for existing columns)
        if (fk.toTable === tableName && fk.fromColumn === fk.toColumn) {
          showAlert(
            'Self-Join Error', 
            `Cannot create self-referencing foreign key: column "${fk.fromColumn}" cannot reference itself.\n\nFor self-join relationships, the foreign key column must reference a different column in the same table.\n\nExample: employees.manager_id → employees.employee_id`,
            'error'
          );
          return;
        }

        // DATA TYPE VALIDATION - Check if data types are compatible
        const referencedTable = workingSchema.tables[fk.toTable];
        const referencedColumn = referencedTable?.columns[fk.toColumn];
        
        if (referencedColumn) {
          const compatibility = areDataTypesCompatible(workingSchemaColumn.type, referencedColumn.type);
          
          if (!compatibility.compatible) {
            // Data type mismatch - show error
            showAlert(
              'Data Type Mismatch', 
              `Cannot create foreign key: ${compatibility.reason}\n\nChild column: ${tableName}.${workingSchemaColumn.name} (${workingSchemaColumn.type})\nParent column: ${fk.toTable}.${fk.toColumn} (${referencedColumn.type})\n\nThe data types must be compatible for a foreign key relationship.`,
              'error'
            );
            return; // Block FK creation
          }
        }
      }

      if (fk.isNew) {
        // For existing columns, create the relationship in virtual schema
        if (fk.fromColumn !== '__CREATE_NEW__') {
          try {
            addRelationship(tableName, actualColumnName, fk.toTable, fk.toColumn, 'ONE_TO_MANY');
          } catch (error) {
            if (error.message === "Relationship already exists") {
              showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
              return;
            } else {
              throw error; // Re-throw other errors
            }
          }
          
          // Update local state
          const newFKs = [...foreignKeys];
          newFKs[index] = { 
            ...fk, 
            fromColumn: actualColumnName, // Use the actual column name
            isNew: false,
            // Generate a temporary ID for tracking
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          setForeignKeys(newFKs);

          // Update existing column to show FK status
          const newColumns = [...columns];
          const columnIndex = newColumns.findIndex(col => col.name === actualColumnName);
          if (columnIndex !== -1) {
            newColumns[columnIndex] = {
              ...newColumns[columnIndex],
              fk: true
            };
            setColumns(newColumns);
          }
        }
        // For new columns, the relationship was already created atomically above
      } else {
        // EDITING EXISTING FK - Update the relationship in virtual schema
        // Only allow editing user-created (virtual) FKs, not database FKs
        if (!fk.isVirtual) {
          showAlert('Cannot Edit Database FK', 'Foreign keys from the database cannot be edited. You can only edit user-created foreign keys.', 'warning');
          return;
        }
        
        // Check if we're switching to CREATE NEW column
        if (fk.fromColumn === '__CREATE_NEW__') {
          // SPECIAL CASE: Editing FK and switching to create new column
          console.log('✏️ Editing FK - switching to create new column');
          
          if (!fk.newColumnName || !fk.newColumnName.trim()) {
            showAlert('Validation Error', 'Please enter a name for the new column', 'warning');
            return;
          }

          actualColumnName = fk.newColumnName.trim();

          // Check if column name already exists
          const existingColumn = columns.find(col => col.name === actualColumnName);
          if (existingColumn) {
            showAlert('Validation Error', `Column "${actualColumnName}" already exists. Please choose a different name.`, 'warning');
            return;
          }

          // Determine appropriate data type based on referenced column
          const referencedTable = workingSchema.tables[fk.toTable];
          const referencedColumn = referencedTable?.columns[fk.toColumn];
          const columnType = referencedColumn?.type || 'INT';

          try {
            // Use atomic function: delete old relationship + create new column + create new relationship
            updateForeignKeyWithNewColumn(
              tableName,
              fk.originalFromColumn, // old column
              actualColumnName, // new column name
              columnType, // new column type
              fk.toTable,
              fk.toColumn
            );

            console.log('✅ FK updated - switched to new column');
            
          } catch (error) {
            if (error.message === "Relationship already exists") {
              showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            } else {
              showAlert('Error', `Error updating foreign key: ${error.message}`, 'error');
              console.error('FK update error:', error);
            }
            return;
          }
          
        } else {
          // Normal case: Editing FK with existing column
          console.log('✏️ Editing existing FK - using atomic update');
          
          // Use atomic function to update FK column
          // This handles: delete old relationship, delete old column (if user-created), add new relationship
          try {
            updateForeignKeyColumn(
              tableName,
              fk.originalFromColumn, // old column
              actualColumnName, // new column
              fk.toTable,
              fk.toColumn
            );
            
            console.log('✅ Atomic FK update completed');
            
          } catch (error) {
            if (error.message === "Relationship already exists") {
              showAlert('Validation Error', `Foreign key relationship already exists: ${tableName}.${actualColumnName} → ${fk.toTable}.${fk.toColumn}`, 'warning');
            } else if (error.message === "Old relationship not found") {
              showAlert('Error', 'Could not find the original foreign key relationship to update.', 'error');
            } else {
              showAlert('Error', `Error updating foreign key: ${error.message}`, 'error');
              console.error('FK update error:', error);
            }
          }
        }
      }
      
      setEditingFK(null);
    } catch (error) {
      showAlert('Error', `Error creating foreign key: ${error.message}`, 'error');
      console.error('FK creation error:', error);
    }
  };

  const getAvailableTables = () => {
    if (!workingSchema) return [];
    // Include current table for self-join support
    return Object.keys(workingSchema.tables);
  };

  const getAvailableColumns = (targetTable) => {
    if (!workingSchema || !targetTable) return [];
    const table = workingSchema.tables[targetTable];
    if (!table) return [];
    
    // Only return PK or UNIQUE columns (real DB behavior)
    // Foreign keys can only reference columns with unique constraints
    return Object.entries(table.columns)
      .filter(([columnName, columnData]) => columnData.pk || columnData.unique)
      .map(([columnName]) => columnName);
  };

  const getCurrentTableColumns = () => {
    return columns.filter(col => col.name).map(col => col.name);
  };

  // Helper function to detect cardinality based on FK column constraints
  const detectCardinality = (fkColumnName) => {
    if (!fkColumnName || fkColumnName === '__CREATE_NEW__') return '1:N'; // Default
    
    const column = columns.find(col => col.name === fkColumnName);
    if (!column) return '1:N';
    
    // If FK column has UNIQUE constraint OR is a PK (PKs are implicitly unique), it's 1:1
    // Otherwise it's 1:N
    return (column.unique || column.pk) ? '1:1' : '1:N';
  };

  // Helper function to detect if relationship is identifying
  const detectIdentifying = (fkColumnName) => {
    if (!fkColumnName || fkColumnName === '__CREATE_NEW__') return false; // Default
    
    const column = columns.find(col => col.name === fkColumnName);
    if (!column) return false;
    
    // If FK column is part of PK, it's identifying
    return column.pk || false;
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
          <button
            className={`tab ${activeTab === 'constraints' ? 'active' : ''}`}
            onClick={() => setActiveTab('constraints')}
          >
            Constraints
          </button>
          <button
            className={`tab ${activeTab === 'foreignKeys' ? 'active' : ''}`}
            onClick={() => setActiveTab('foreignKeys')}
          >
            Foreign Keys
          </button>
          <button
            className={`tab ${activeTab === 'columns' ? 'active' : ''}`}
            onClick={() => setActiveTab('columns')}
          >
            Columns
          </button>
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
                  // Show "-" for null, undefined, empty string, or the string "NULL"
                  const displayDefault = (column.defaultValue === null || 
                                         column.defaultValue === undefined || 
                                         column.defaultValue === '' ||
                                         column.defaultValue === 'NULL') 
                    ? '-' 
                    : column.defaultValue;
                  
                  return (
                  <div key={`${column.originalName || column.name}-${index}`} className="edit-constraint-row">
                    <div className="edit-constraint-name" title={column.name}>
                      <span className="column-name-readonly">{column.name}</span>
                      {isFromRealDB && (
                        <span className="real-db-badge" title="Column from real database - constraints are read-only">
                          DB
                        </span>
                      )}
                    </div>
                    <div className="edit-constraint-type">
                      <span className="column-type-readonly" title={getFullDataType(column.type)}>
                        {formatDataTypeForDisplay(column.type)}
                      </span>
                    </div>
                    <div className="edit-constraint-default">
                      <span className="default-value-readonly">
                        {displayDefault}
                      </span>
                    </div>
                    <div className="edit-constraint-pk">
                      <input
                        id={`pk-${tableName}-${column.name}`}
                        name={`pk-${tableName}-${column.name}`}
                        type="checkbox"
                        checked={Boolean(column.pk)}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'pk', e.target.checked);
                        }}
                        disabled={isFromRealDB}
                        title={isFromRealDB ? 'Real DB column - constraint is read-only' : 'Toggle primary key'}
                      />
                    </div>
                    <div className="edit-constraint-nn">
                      <input
                        id={`nn-${tableName}-${column.name}`}
                        name={`nn-${tableName}-${column.name}`}
                        type="checkbox"
                        checked={!column.nullable}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'nullable', !e.target.checked);
                        }}
                        disabled={column.pk || isFromRealDB} // PK columns are always NOT NULL, or real DB column
                        title={isFromRealDB ? 'Real DB column - constraint is read-only' : column.pk ? 'Primary key columns are always NOT NULL' : 'Toggle nullable'}
                      />
                    </div>
                    <div className="edit-constraint-uq">
                      <input
                        id={`uq-${tableName}-${column.name}`}
                        name={`uq-${tableName}-${column.name}`}
                        type="checkbox"
                        checked={Boolean(column.unique)}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'unique', e.target.checked);
                        }}
                        disabled={isFromRealDB}
                        title={isFromRealDB ? 'Real DB column - constraint is read-only' : 'Toggle unique'}
                      />
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
                      <button 
                        className="btn-delete-selected" 
                        onClick={handleDeleteSelectedFKs}
                        disabled={selectedFKs.size === 0}
                      >
                        Delete Selected ({selectedFKs.size})
                      </button>
                      <button className="btn-cancel" onClick={handleToggleDeleteMode}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-add" onClick={handleAddFK}>
                        Add Foreign Key
                      </button>
                      {foreignKeys.some(fk => fk.isVirtual && !fk.isNew) && (
                        <button 
                          className="btn-delete-mode" 
                          onClick={handleToggleDeleteMode}
                          title="Delete user-created foreign keys"
                        >
                        Delete Foreign Key
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="fk-table">
                <div className="edit-fk-header">
                  {isDeleteMode && (
                    <div className="edit-fk-checkbox">
                      <input
                        id="select-all-fks"
                        name="select-all-fks"
                        type="checkbox"
                        checked={selectedFKs.size > 0 && selectedFKs.size === foreignKeys.filter(fk => fk.isVirtual).length}
                        onChange={handleSelectAllFKs}
                        title="Select all user-created FKs"
                      />
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
                        <input
                          id={`fk-select-${index}`}
                          name={`fk-select-${index}`}
                          type="checkbox"
                          checked={selectedFKs.has(index)}
                          onChange={() => handleToggleFKSelection(index)}
                          disabled={!fk.isVirtual}
                          title={fk.isVirtual ? 'Select for deletion' : 'Database FK cannot be deleted'}
                        />
                      </div>
                    )}                    <div className="edit-fk-name">
                      {editingFK === index && fk.isVirtual ? (
                        // In edit mode - allow typing new column name or show selected column name
                        <input
                          id={`fk-name-${index}`}
                          name={`fk-name-${index}`}
                          type="text"
                          value={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!fk.fromColumn || fk.fromColumn === '__CREATE_NEW__') {
                              // Creating new column - update newColumnName
                              handleFKChange(index, 'newColumnName', value);
                              handleFKChange(index, 'fromColumn', '__CREATE_NEW__');
                            }
                            // If existing column selected, don't allow editing
                          }}
                          placeholder="Enter new FK name"
                          disabled={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__'}
                          readOnly={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__'}
                          title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || ''}
                          className="fk-column-name-input"
                          style={{
                            background: fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? 'var(--bg-secondary)' : 'var(--bg-primary)'
                          }}
                        />
                      ) : (
                        // View mode - show column name with ellipsis and tooltip
                        <span 
                          className="fk-column-name-display"
                          title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || fk.name}
                        >
                          {fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : fk.newColumnName || fk.name}
                        </span>
                      )}
                    </div>
                    {/* Conditional rendering based on cardinality */}
                    {fk.cardinality === 'N:M' ? (
                      // N:M: Show Junction Table Name field instead of Child Column
                      <div className="edit-fk-column">
                        {editingFK === index && fk.isVirtual ? (
                          <input
                            id={`fk-junction-${index}`}
                            name={`fk-junction-${index}`}
                            type="text"
                            value={fk.junctionTableName || ''}
                            onChange={(e) => handleFKChange(index, 'junctionTableName', e.target.value)}
                            placeholder={`${[tableName, fk.toTable || 'table2'].sort().join('_')}`}
                            title="Junction table name (leave empty for auto-generated)"
                            className="fk-junction-name-input"
                          />
                        ) : (
                          <span className="fk-junction-name-display" title={fk.junctionTableName || 'Auto-generated'}>
                            {fk.junctionTableName || `${[tableName, fk.toTable || 'table2'].sort().join('_')}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      // 1:1 or 1:N: Show Child Column selector
                      <div className="edit-fk-column">
                        <select
                          id={`fk-from-column-${index}`}
                          name={`fk-from-column-${index}`}
                          value={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              // Existing column selected - update fromColumn
                              handleFKChange(index, 'fromColumn', value);
                              handleFKChange(index, 'newColumnName', ''); // Clear new column name
                            } else {
                              // "Create New" selected - clear fromColumn
                              handleFKChange(index, 'fromColumn', '__CREATE_NEW__');
                            }
                          }}
                          disabled={editingFK !== index || !fk.isVirtual}
                          title={fk.fromColumn && fk.fromColumn !== '__CREATE_NEW__' ? fk.fromColumn : '+ Create New Column'}
                          className="fk-column-select"
                        >
                          <option value="">Create New Column</option>
                          <optgroup label="Existing Columns">
                            {getCurrentTableColumns().map(col => (
                              <option key={col} value={col} title={col}>{col}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    )}
                    <div className="edit-fk-ref-table">
                      <select
                        id={`fk-to-table-${index}`}
                        name={`fk-to-table-${index}`}
                        value={fk.toTable}
                        onChange={(e) => handleFKChange(index, 'toTable', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.toTable || 'Select Parent Table'}
                        className="fk-select-with-ellipsis"
                      >
                        <option value="">Select Table</option>
                        {getAvailableTables().map(table => (
                          <option key={table} value={table} title={table}>
                            {table}{table === tableName ? ' (Self-Join)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="edit-fk-ref-column">
                      <select
                        id={`fk-to-column-${index}`}
                        name={`fk-to-column-${index}`}
                        value={fk.toColumn}
                        onChange={(e) => handleFKChange(index, 'toColumn', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.toColumn || 'Select Parent Column'}
                        className="fk-select-with-ellipsis"
                      >
                        <option value="">Select Column</option>
                        {getAvailableColumns(fk.toTable).length === 0 && fk.toTable ? (
                          <option value="" disabled>No PK/UNIQUE columns available</option>
                        ) : (
                          getAvailableColumns(fk.toTable).map(col => (
                            <option key={col} value={col} title={col}>{col}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="edit-fk-cardinality">
                      {editingFK === index && fk.isVirtual ? (
                        (() => {
                          const fkColumn = columns.find(col => col.name === fk.fromColumn);
                          const isPK = fkColumn?.pk || false;
                          const detectedCardinality = detectCardinality(fk.fromColumn);
                          
                          return (
                            <select
                              id={`fk-cardinality-${index}`}
                              name={`fk-cardinality-${index}`}
                              value={fk.cardinality || detectedCardinality}
                              onChange={(e) => handleFKChange(index, 'cardinality', e.target.value)}
                              disabled={isPK && fk.cardinality !== 'N:M'}
                              title={isPK && fk.cardinality !== 'N:M' ? 'Cardinality is locked to 1:1 because FK column is a Primary Key (always unique)' : 'Select relationship cardinality'}
                            >
                              <option value="1:1">1:1 (One-to-One)</option>
                              <option value="1:N">1:N (One-to-Many)</option>
                              <option value="N:M">N:M (Many-to-Many)</option>
                            </select>
                          );
                        })()
                      ) : (
                        <span className="fk-cardinality-display" title={
                          fk.cardinality === 'N:M' ? 'Many-to-Many: Creates junction table' :
                          fk.cardinality === '1:1' ? 'One-to-One: FK has UNIQUE constraint or is PK' : 
                          'One-to-Many: FK does not have UNIQUE constraint'
                        }>
                          {fk.cardinality !== 'N:M' && (
                            <CardinalityIcon 
                              cardinality={fk.cardinality || detectCardinality(fk.fromColumn)} 
                              isIdentifying={detectIdentifying(fk.fromColumn)}
                            />
                          )}
                          {fk.cardinality || detectCardinality(fk.fromColumn)}
                        </span>
                      )}
                    </div>
                    <div className="edit-fk-type">
                      <span 
                        className={`fk-type-badge ${detectIdentifying(fk.fromColumn) ? 'identifying' : 'non-identifying'}`}
                        title={detectIdentifying(fk.fromColumn) ? 'Identifying: FK is part of Primary Key' : 'Non-Identifying: FK is not part of Primary Key'}
                      >
                        {detectIdentifying(fk.fromColumn) ? 'Identifying' : 'Non-Identifying'}
                      </span>
                    </div>
                    <div className="edit-fk-on-update">
                      <select
                        id={`fk-on-update-${index}`}
                        name={`fk-on-update-${index}`}
                        value={fk.onUpdate}
                        onChange={(e) => handleFKChange(index, 'onUpdate', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.onUpdate || 'RESTRICT'}
                        className="fk-select-with-ellipsis"
                      >
                        <option value="RESTRICT" title="RESTRICT">RESTRICT</option>
                        <option value="CASCADE" title="CASCADE">CASCADE</option>
                        <option value="SET NULL" title="SET NULL">SET NULL</option>
                        <option value="NO ACTION" title="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                    <div className="edit-fk-on-delete">
                      <select
                        id={`fk-on-delete-${index}`}
                        name={`fk-on-delete-${index}`}
                        value={fk.onDelete}
                        onChange={(e) => handleFKChange(index, 'onDelete', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        title={fk.onDelete || 'RESTRICT'}
                        className="fk-select-with-ellipsis"
                      >
                        <option value="RESTRICT" title="RESTRICT">RESTRICT</option>
                        <option value="CASCADE" title="CASCADE">CASCADE</option>
                        <option value="SET NULL" title="SET NULL">SET NULL</option>
                        <option value="NO ACTION" title="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                    {!isDeleteMode && (
                      <div className="edit-fk-actions">
                        {fk.isVirtual ? (
                          // Virtual FK - Show edit/delete buttons
                          editingFK === index ? (
                            <>
                              <button className="btn-save" onClick={() => handleSaveFK(index)} title="Save">
                                ✓
                              </button>
                              <button className="btn-cancel" onClick={() => handleCancelFK(index)} title="Cancel">
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                className="btn-edit" 
                                onClick={() => {
                                  setEditingFK(index);
                                }}
                                title="Edit foreign key"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{width: '16px', height: '16px'}}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                              </button>
                              <button 
                                className="btn-delete" 
                                onClick={() => handleDeleteFK(index)}
                                title="Delete foreign key"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{width: '16px', height: '16px'}}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </>
                          )
                        ) : (
                          // Real DB FK - Show read-only indicator
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
                      <div className="col-name" title={column.name}>
                        <span className="column-name-text">{column.name}</span>
                      </div>
                      <div className="col-datatype">
                        <span className="datatype-badge">{column.type}</span>
                      </div>
                      <div className="col-constraints">
                        <div className="constraint-badges">
                          {column.pk && <span className="constraint-badge pk" title="Primary Key">PK</span>}
                          {column.fk && <span className="constraint-badge fk" title="Foreign Key">FK</span>}
                          {column.unique && <span className="constraint-badge uq" title="Unique">UQ</span>}
                          {!column.nullable && <span className="constraint-badge nn" title="Not Null">NN</span>}
                          {column.autoIncrement && <span className="constraint-badge ai" title="Auto Increment">AI</span>}
                        </div>
                      </div>
                      <div className="col-default">
                        <span className="default-value">{column.defaultValue || '-'}</span>
                      </div>
                      <div className="col-notes">
                        <input
                          id={`notes-${tableName}-${column.name}`}
                          name={`notes-${tableName}-${column.name}`}
                          type="text"
                          className="notes-input"
                          placeholder="Add description..."
                          value={columnNotes[column.name] || ''}
                          onChange={(e) => setColumnNotes({...columnNotes, [column.name]: e.target.value})}
                        />
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
              <button 
                className="btn-cancel" 
                onClick={handleCancelConstraints}
                disabled={Object.keys(pendingConstraintChanges).length === 0}
              >
                Cancel Changes
              </button>
              <button 
                className="btn-save" 
                onClick={handleApplyConstraints}
                disabled={Object.keys(pendingConstraintChanges).length === 0}
              >
                Apply Constraints
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Conflict Warning Modal */}
      <ConflictWarningModal
        isOpen={conflictModal.isOpen}
        onClose={handleConflictCancel}
        onConfirm={handleConflictConfirm}
        conflicts={conflictModal.conflicts}
        cascadingChanges={conflictModal.cascadingChanges}
        affectedTables={conflictModal.affectedTables}
        changeDescription={conflictModal.changeDescription}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* N:M Preview Modal */}
      <NMPreviewModal
        isOpen={nmPreviewModal.isOpen}
        onClose={() => setNMPreviewModal({ ...nmPreviewModal, isOpen: false })}
        onConfirm={nmPreviewModal.onConfirm}
        table1={nmPreviewModal.table1}
        table1Column={nmPreviewModal.table1Column}
        table2={nmPreviewModal.table2}
        table2Column={nmPreviewModal.table2Column}
        junctionTableName={nmPreviewModal.junctionTableName}
        fk1Name={nmPreviewModal.fk1Name}
        fk2Name={nmPreviewModal.fk2Name}
        table1Type={nmPreviewModal.table1Type}
        table2Type={nmPreviewModal.table2Type}
      />
    </div>
  );
};

export default EditTableModal;
