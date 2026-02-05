import React, { useState, useEffect, useCallback } from 'react';
import { useVirtualSchema } from '../../context/VirtualSchemaContext';
import { formatDataTypeForDisplay, getFullDataType } from '../../utils/dataTypeFormatter';
import { 
  ALL_MYSQL_DATA_TYPES, 
  DATA_TYPES_WITH_LENGTH, 
  DATA_TYPES_WITH_DEFAULTS,
  COMMON_DEFAULTS,
  getBaseDataType,
  getTypeLength,
  buildFullType
} from '../../utils/mysqlDataTypes';
import { analyzeColumnChange, applyCascadingChanges } from '../../utils/conflictDetection';
import { ConflictWarningModal } from './ConflictWarningModal';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';
import './Modal.css';
import './EditTableModal.css';
import './AlertModal.css';
import './ConfirmModal.css';

const EditTableModal = ({ isOpen, onClose, tableName, schemaName }) => {
  const {
    workingSchema,
    addRelationship,
    addForeignKeyWithNewColumn, // NEW: Atomic FK creation
    deleteRelationship,
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,
    updateColumn,
    addColumn,
    forceRefreshFromBackend
  } = useVirtualSchema();

  const [activeTab, setActiveTab] = useState('constraints');
  const [columns, setColumns] = useState([]);
  const [foreignKeys, setForeignKeys] = useState([]);
  const [editingFK, setEditingFK] = useState(null);
  const [editingColumn, setEditingColumn] = useState(null);
  const [showAddFK, setShowAddFK] = useState(false);
  
  // Pending constraint changes state
  const [pendingConstraintChanges, setPendingConstraintChanges] = useState({});
  
  // New modal states
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  
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

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && workingSchema && tableName) {
      setActiveTab('constraints'); // Always start with Constraints tab
      
      // Reset pending constraint changes
      setPendingConstraintChanges({});
      
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
        setColumns(columnList);
      } else {
        setColumns([]);
      }

      // Load foreign keys
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
          isVirtual: rel.isVirtual !== undefined ? rel.isVirtual : false // Default to false for real DB FKs
        }));
      setForeignKeys(tableFKs);
      
      // Reset editing states
      setEditingFK(null);
    }
  }, [isOpen, tableName, workingSchema]); // Add workingSchema back to dependencies to ensure updates

  const handleSave = () => {
    try {
      // REMOVED: Table renaming functionality
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
    
    // Update pending changes
    setPendingConstraintChanges(prev => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        [constraintType]: newValue
      }
    }));
    
    // Update the local columns state for UI display
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      
      // Special handling for PK constraint - only one column can be PK
      if (constraintType === 'pk' && newValue === true) {
        // Uncheck all other PK columns in UI
        newColumns.forEach((col, idx) => {
          if (idx !== index && col.pk) {
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
    for (const [columnName, changes] of Object.entries(pendingConstraintChanges)) {
      // Apply each constraint change
      for (const [constraintType, newValue] of Object.entries(changes)) {
        if (constraintType === 'pk') {
          togglePrimaryKey(tableName, columnName);
        } else if (constraintType === 'nullable') {
          toggleNullable(tableName, columnName);
        } else if (constraintType === 'unique') {
          toggleUnique(tableName, columnName);
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
        togglePrimaryKey(tableName, column.name);
      } else if (constraintType === 'nullable') {
        toggleNullable(tableName, column.name);
      } else if (constraintType === 'unique') {
        toggleUnique(tableName, column.name);
      }
      
      // Apply cascading changes if any
      if (cascadingChanges.length > 0) {
        for (const change of cascadingChanges) {
          if (change.type === 'DATA_TYPE_CASCADE') {
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
        ...newProperties
      };
      setColumns(newColumns);
      
      // Show success message if cascading changes were applied
      if (cascadingChanges.length > 0) {
        const affectedTables = [...new Set(cascadingChanges.map(c => c.tableName))];
        showAlert('Success', `Constraint updated successfully!\nCascading updates applied to: ${affectedTables.join(', ')}`, 'success');
      }
      
    } catch (error) {
      showAlert('Error', `Error updating constraint: ${error.message}`, 'error');
    }
  };

  
  const handleColumnCancel = () => {
    // Reset column data to original values
    if (editingColumn !== null) {
      const originalColumn = workingSchema.tables[tableName].columns[columns[editingColumn].name];
      const newColumns = [...columns];
      newColumns[editingColumn] = {
        ...newColumns[editingColumn],
        baseType: getBaseDataType(originalColumn.type),
        typeLength: getTypeLength(originalColumn.type),
        defaultValue: originalColumn.defaultValue || ''
      };
      setColumns(newColumns);
    }
    setEditingColumn(null);
  };

  const handleColumnChange = (index, field, value) => {
    const newColumns = [...columns];
    newColumns[index] = {
      ...newColumns[index],
      [field]: value
    };
    setColumns(newColumns);
  };

  const handleAddFK = () => {
    const newFK = {
      name: `FK_${tableName}_new`,
      fromColumn: '__CREATE_NEW__', // Default to creating new column
      newColumnName: '', // Will be filled by user
      toTable: '',
      toColumn: '',
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
      isNew: true,
      isVirtual: true // Mark new FKs as virtual (user-created)
    };
    const newIndex = foreignKeys.length;
    setForeignKeys([...foreignKeys, newFK]);
    setEditingFK(newIndex); // Automatically enter edit mode for the new FK
    setShowAddFK(false);
  };

  const handleDeleteFK = (index) => {
    try {
      const fk = foreignKeys[index];
      
      // Only allow deleting virtual FKs
      if (!fk.isVirtual) {
        showAlert('Cannot Delete', 'Real database foreign keys cannot be deleted from the ERD tool. This would require direct database changes.', 'warning');
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

      return newFKs;
    });
  }, [editingFK, tableName]);

  const handleSaveFK = (index) => {
    try {
      const fk = foreignKeys[index];
      
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

        // DATA TYPE VALIDATION - Check if data types are compatible
        const referencedTable = workingSchema.tables[fk.toTable];
        const referencedColumn = referencedTable?.columns[fk.toColumn];
        
        if (referencedColumn && workingSchemaColumn.type !== referencedColumn.type) {
          // Data type mismatch - show conflict modal
          setConflictModal({
            isOpen: true,
            conflicts: [{
              type: 'DATA_TYPE_MISMATCH',
              message: `Cannot create foreign key: Data type mismatch`,
              details: `Column "${tableName}.${workingSchemaColumn.name}" (${workingSchemaColumn.type}) cannot reference "${fk.toTable}.${fk.toColumn}" (${referencedColumn.type})`
            }],
            cascadingChanges: [],
            affectedTables: [tableName, fk.toTable],
            changeDescription: `Create foreign key ${tableName}.${workingSchemaColumn.name} → ${fk.toTable}.${fk.toColumn}`,
            pendingChange: null // No pending change, just block the action
          });
          return; // Block FK creation
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
      }
      
      setEditingFK(null);
    } catch (error) {
      showAlert('Error', `Error creating foreign key: ${error.message}`, 'error');
      console.error('FK creation error:', error);
    }
  };

  const getAvailableTables = () => {
    if (!workingSchema) return [];
    return Object.keys(workingSchema.tables).filter(name => name !== tableName);
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
                  <div className="edit-constraint-actions">Actions</div>
                </div>
                
                {columns.map((column, index) => (
                  <div key={`${column.originalName || column.name}-${index}`} className="edit-constraint-row">
                    <div className="edit-constraint-name">
                      <span className="column-name-readonly">{column.name}</span>
                    </div>
                    <div className="edit-constraint-type">
                      {editingColumn === index ? (
                        <div className="data-type-editor">
                          <select
                            value={column.baseType}
                            onChange={(e) => handleColumnChange(index, 'baseType', e.target.value)}
                            className="data-type-select"
                          >
                            <optgroup label="Numeric Types">
                              <option value="TINYINT">TINYINT</option>
                              <option value="SMALLINT">SMALLINT</option>
                              <option value="MEDIUMINT">MEDIUMINT</option>
                              <option value="INT">INT</option>
                              <option value="BIGINT">BIGINT</option>
                              <option value="DECIMAL">DECIMAL</option>
                              <option value="FLOAT">FLOAT</option>
                              <option value="DOUBLE">DOUBLE</option>
                              <option value="REAL">REAL</option>
                            </optgroup>
                            <optgroup label="String Types">
                              <option value="CHAR">CHAR</option>
                              <option value="VARCHAR">VARCHAR</option>
                              <option value="BINARY">BINARY</option>
                              <option value="VARBINARY">VARBINARY</option>
                              <option value="TINYBLOB">TINYBLOB</option>
                              <option value="BLOB">BLOB</option>
                              <option value="MEDIUMBLOB">MEDIUMBLOB</option>
                              <option value="LONGBLOB">LONGBLOB</option>
                              <option value="TINYTEXT">TINYTEXT</option>
                              <option value="TEXT">TEXT</option>
                              <option value="MEDIUMTEXT">MEDIUMTEXT</option>
                              <option value="LONGTEXT">LONGTEXT</option>
                            </optgroup>
                            <optgroup label="Date & Time Types">
                              <option value="DATE">DATE</option>
                              <option value="TIME">TIME</option>
                              <option value="DATETIME">DATETIME</option>
                              <option value="TIMESTAMP">TIMESTAMP</option>
                              <option value="YEAR">YEAR</option>
                            </optgroup>
                            <optgroup label="Other Types">
                              <option value="BIT">BIT</option>
                              <option value="BOOLEAN">BOOLEAN</option>
                              <option value="ENUM">ENUM</option>
                              <option value="SET">SET</option>
                              <option value="JSON">JSON</option>
                            </optgroup>
                          </select>
                          {DATA_TYPES_WITH_LENGTH.includes(column.baseType) && (
                            <input
                              type="text"
                              value={column.typeLength}
                              onChange={(e) => handleColumnChange(index, 'typeLength', e.target.value)}
                              placeholder="Length"
                              className="type-length-input"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="column-type-readonly" title={getFullDataType(column.type)}>
                          {formatDataTypeForDisplay(column.type)}
                        </span>
                      )}
                    </div>
                    <div className="edit-constraint-default">
                      {editingColumn === index ? (
                        <div className="default-value-editor">
                          <input
                            type="text"
                            value={column.defaultValue}
                            onChange={(e) => handleColumnChange(index, 'defaultValue', e.target.value)}
                            placeholder="NULL"
                            className="default-value-input"
                          />
                          {COMMON_DEFAULTS[column.baseType] && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleColumnChange(index, 'defaultValue', e.target.value);
                                }
                              }}
                              className="common-defaults-select"
                            >
                              <option value="">Common defaults...</option>
                              {COMMON_DEFAULTS[column.baseType].map(defaultVal => (
                                <option key={defaultVal} value={defaultVal}>{defaultVal}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className="default-value-readonly">
                          {column.defaultValue || 'NULL'}
                        </span>
                      )}
                    </div>
                    <div className="edit-constraint-pk">
                      <input
                        type="checkbox"
                        checked={Boolean(column.pk)}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'pk', e.target.checked);
                        }}
                        disabled={editingColumn === index}
                      />
                    </div>
                    <div className="edit-constraint-nn">
                      <input
                        type="checkbox"
                        checked={!column.nullable}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'nullable', !e.target.checked);
                        }}
                        disabled={column.pk || editingColumn === index} // PK columns are always NOT NULL
                      />
                    </div>
                    <div className="edit-constraint-uq">
                      <input
                        type="checkbox"
                        checked={Boolean(column.unique)}
                        onChange={(e) => {
                          handleConstraintToggle(index, 'unique', e.target.checked);
                        }}
                        disabled={editingColumn === index}
                      />
                    </div>
                    <div className="edit-constraint-actions">
                      {editingColumn === index ? (
                        <>
                          <button className="btn-save-small" onClick={() => handleColumnSave(index)} title="Save changes" disabled>
                            ✓
                          </button>
                          <button className="btn-cancel-small" onClick={handleColumnCancel} title="Cancel changes" disabled>
                            ✕
                          </button>
                        </>
                      ) : (
                        <button className="btn-edit-small" onClick={() => handleColumnEdit(index)} title="Data type editing temporarily disabled" disabled>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{width: '16px', height: '16px'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'foreignKeys' && (
            <div className="foreign-keys-tab">
              <div className="tab-header">
                <h3>Foreign Keys</h3>
                <button className="btn-add" onClick={handleAddFK}>
                  + Add Foreign Key
                </button>
              </div>
              
              <div className="fk-table">
                <div className="edit-fk-header">
                  <div className="edit-fk-name">FK Name</div>
                  <div className="edit-fk-column">Column</div>
                  <div className="edit-fk-ref-table">Referenced Table</div>
                  <div className="edit-fk-ref-column">Referenced Column</div>
                  <div className="edit-fk-on-update">On Update</div>
                  <div className="edit-fk-on-delete">On Delete</div>
                  <div className="edit-fk-actions">Actions</div>
                </div>
                
                {foreignKeys.map((fk, index) => (
                  <div key={index} className={`edit-fk-row ${editingFK === index ? 'editing' : ''} ${!fk.isVirtual ? 'read-only' : ''}`}>
                    <div className="edit-fk-name">
                      <input
                        type="text"
                        value={fk.name}
                        onChange={(e) => handleFKChange(index, 'name', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                        readOnly={!fk.isVirtual}
                      />
                    </div>
                    <div className="edit-fk-column">
                      <select
                        value={fk.fromColumn}
                        onChange={(e) => handleFKChange(index, 'fromColumn', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                      >
                        <option value="">Select or Create Column</option>
                        <optgroup label="Existing Columns">
                          {getCurrentTableColumns().map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </optgroup>
                        {fk.isVirtual && (
                          <optgroup label="Create New Column">
                            <option value="__CREATE_NEW__">+ Create New FK Column</option>
                          </optgroup>
                        )}
                      </select>
                      {fk.fromColumn === '__CREATE_NEW__' && editingFK === index && fk.isVirtual && (
                        <input
                          type="text"
                          placeholder="New column name (e.g., dept_id)"
                          value={fk.newColumnName}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleFKChange(index, 'newColumnName', e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          onBlur={(e) => e.stopPropagation()}
                          autoFocus
                          style={{ 
                            marginTop: '4px', 
                            width: '100%',
                            padding: '4px',
                            border: '1px solid var(--primary-color)',
                            borderRadius: '3px'
                          }}
                        />
                      )}
                    </div>
                    <div className="edit-fk-ref-table">
                      <select
                        value={fk.toTable}
                        onChange={(e) => handleFKChange(index, 'toTable', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                      >
                        <option value="">Select Table</option>
                        {getAvailableTables().map(table => (
                          <option key={table} value={table}>{table}</option>
                        ))}
                      </select>
                    </div>
                    <div className="edit-fk-ref-column">
                      <select
                        value={fk.toColumn}
                        onChange={(e) => handleFKChange(index, 'toColumn', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                      >
                        <option value="">Select Column</option>
                        {getAvailableColumns(fk.toTable).length === 0 && fk.toTable ? (
                          <option value="" disabled>No PK/UNIQUE columns available</option>
                        ) : (
                          getAvailableColumns(fk.toTable).map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="edit-fk-on-update">
                      <select
                        value={fk.onUpdate}
                        onChange={(e) => handleFKChange(index, 'onUpdate', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                      >
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                    <div className="edit-fk-on-delete">
                      <select
                        value={fk.onDelete}
                        onChange={(e) => handleFKChange(index, 'onDelete', e.target.value)}
                        disabled={editingFK !== index || !fk.isVirtual}
                      >
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                    <div className="edit-fk-actions">
                      {fk.isVirtual ? (
                        // Virtual FK - Show edit/delete buttons
                        editingFK === index ? (
                          <>
                            <button className="btn-save" onClick={() => handleSaveFK(index)}>
                              ✓
                            </button>
                            <button className="btn-cancel" onClick={() => handleCancelFK(index)}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn-edit" onClick={() => {
                              setEditingFK(index);
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{width: '16px', height: '16px'}}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            <button className="btn-delete" onClick={() => handleDeleteFK(index)}>
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
                  </div>
                ))}
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
    </div>
  );
};

export default EditTableModal;