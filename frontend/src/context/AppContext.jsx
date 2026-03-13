import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSchemas } from "../hooks/useSchemas";
import { useERD } from "../hooks/useERD";
import { useSelection } from "../hooks/useSelection";
import { useDebounce } from "../hooks/useDebounce";
import { useVirtualSchema } from "./VirtualSchemaContext";
import { revertFKChange } from "../utils/fkComparison";
import { detectCircularDependencies } from "../utils/circularDependencyDetector";

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedRelationship, setHighlightedRelationship] = useState(null);
  
  // Get connectionId from ConnectionContext for multi-database support
  const ConnectionContext = createContext();
  try {
    const connectionContext = useContext(require('./ConnectionContext').ConnectionContext);
    var connectionId = connectionContext?.connectionId || null;
  } catch (e) {
    var connectionId = null; // Fallback if ConnectionContext not available
  }
  
  // NEW: Hover-based relationship highlighting
  const [hoveredTable, setHoveredTable] = useState(null);
  const [hoverHighlightedRelationships, setHoverHighlightedRelationships] = useState([]);
  
  // NEW: N:M relationship highlighting (separate from regular highlighting)
  const [highlightedNMRelationship, setHighlightedNMRelationship] = useState(null);
  const [nmHighlightTimer, setNMHighlightTimer] = useState(null);
  
  // NEW: Timer management for relationship highlighting
  const [highlightTimer, setHighlightTimer] = useState(null);
  
  // NEW: Circular dependency detection
  const [tablesInCircularDependency, setTablesInCircularDependency] = useState([]);
  const [relationshipsInCircularDependency, setRelationshipsInCircularDependency] = useState([]);
  
  const [routingMode] = useState('direct'); // Fixed to 'direct' stepped lines only
  const [crowsFootMode, setCrowsFootMode] = useState(false); // Toggle for crow's foot notation
  const [gridBackground, setGridBackground] = useState(true); // Toggle for grid background (default: on)
  
  // Shared Edit Table Modal state
  const [sharedEditTableModal, setSharedEditTableModal] = useState({
    isOpen: false,
    tableName: null,
    schemaName: null
  });

  // FK refresh callback for EditTableModal synchronization
  const [editTableModalRefreshCallback, setEditTableModalRefreshCallback] = useState(null);

  // FK Comparison Modal state
  const [fkComparisonModal, setFkComparisonModal] = useState({
    isOpen: false,
    comparisonResult: null
  });

  // Global modal state - tracks if any modal is open
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // NEW: New changes detection modal state
  const [newChangesModal, setNewChangesModal] = useState({
    isOpen: false
  });

  // NEW: Unsaved changes modal state
  const [unsavedChangesModal, setUnsavedChangesModal] = useState({
    isOpen: false,
    targetSchema: null,
    onConfirm: null
  });

  // NEW: Out of sync modal state
  const [outOfSyncModal, setOutOfSyncModal] = useState({
    isOpen: false
  });

  // NEW: Selected application state
  const [selectedApplication, setSelectedApplication] = useState(() => {
    // Load from localStorage on initialization
    const saved = localStorage.getItem('reverseERD_selectedApplication');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved application:', e);
      }
    }
    // Default to InfoQA
    return {
      uuid: 'f487663908ebf11eabb6112c1e641f7d9',
      label: 'Info QA (dev)'
    };
  });

  // Save selected application to localStorage whenever it changes
  useEffect(() => {
    if (selectedApplication) {
      localStorage.setItem('reverseERD_selectedApplication', JSON.stringify(selectedApplication));
    }
  }, [selectedApplication]);

  // Notification system (simple state-based notifications)
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds for success/info
    if (type === "success" || type === "info") {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    selectedSchema,
    selectedTable,
    selectSchema: originalSelectSchema,
    selectTable,
    clearSelection,
  } = useSelection();

  const {
    schemas,
    loading: schemasLoading,
    error: schemasError,
    hasLoaded: schemasHasLoaded,
    refetch: refetchSchemas,
    setSchemas: setSchemasDirectly, // NEW: Manual schema list setter
  } = useSchemas(false); // Don't auto-fetch on mount
  const {
    erdData,
    loading: erdLoading,
    error: erdError,
    refetch: refetchERD,
  } = useERD(selectedSchema);

  // Virtual schema context
  const virtualSchema = useVirtualSchema();

  // ==================== LOAD ALL SCHEMAS (First Time) ====================
  // This function loads ALL schemas from real DB and saves them to persistence DB
  const loadAllSchemasFirstTime = useCallback(async () => {
    try {
      console.log('🔄 Loading all schemas from real DB for first time...');
      
      // Step 1: Fetch schema list from real DB
      await refetchSchemas();
      
      // Wait for schemas to be populated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Get the schema list
      const schemaService = (await import('../services/schemaService')).default;
      const schemaList = await schemaService.getSchemas();
      
      console.log(`📊 Found ${schemaList.length} schemas, saving all to persistence DB...`);
      
      // Step 3: For each schema, fetch ERD data and save to persistence DB
      const erdService = (await import('../services/schemaErdService')).default;
      const { saveBaselineSchema } = await import('../utils/persistenceAdapter');
      const persistenceService = (await import('../services/persistenceService')).default;
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < schemaList.length; i++) {
        const schemaName = schemaList[i];
        try {
          console.log(`  Loading ${i + 1}/${schemaList.length}: ${schemaName}`);
          
          // Fetch ERD data from real DB
          const erdData = await erdService.getERDData(schemaName);
          
          // Save baseline
          await saveBaselineSchema(schemaName, erdData, connectionId);
          
          // Save virtual schema (same as baseline initially)
          await persistenceService.saveVirtualSchema(schemaName, erdData);
          
          successCount++;
        } catch (error) {
          console.error(`  ❌ Failed to load ${schemaName}:`, error);
          failCount++;
        }
      }
      
      console.log(`✅ Loaded ${successCount}/${schemaList.length} schemas (${failCount} failed)`);
      
      // Step 4: Update schemas state so app knows schemas are loaded
      setSchemasDirectly(schemaList);
      
      // Step 5: Wait for React to process state updates, then auto-select first schema
      if (schemaList.length > 0) {
        // Use longer delay to ensure all state updates are processed
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`🎯 Auto-selecting first schema: ${schemaList[0]}`);
        originalSelectSchema(schemaList[0]);
      }
      
      return { success: true, total: schemaList.length, successCount, failCount };
    } catch (error) {
      console.error('❌ Error loading all schemas:', error);
      throw error;
    }
  }, [refetchSchemas, originalSelectSchema, connectionId, setSchemasDirectly]);

  // ==================== INITIALIZATION ====================
  // Check for saved schemas on mount and auto-load if found
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if there are any saved schemas in persistence DB
        const persistenceService = (await import('../services/persistenceService')).default;
        const savedSchemas = await persistenceService.getSavedSchemas();
        
        if (savedSchemas && savedSchemas.length > 0) {
          // Schemas exist in persistence DB - load from cache (NO real DB query)
          
          // Convert saved schemas to the format expected by schema explorer
          const schemaList = savedSchemas.map(s => s.schema_name);
          
          // CRITICAL FIX: Filter schemas by selected application
          // This ensures browser refresh shows correct schemas for the application
          const schemaService = (await import('../services/schemaService')).default;
          const filteredSchemas = await schemaService.getSchemas(selectedApplication.uuid);
          
          // Set filtered schemas
          setSchemasDirectly(filteredSchemas);
          
          // Check if there's a last selected schema in localStorage
          const lastSelectedSchema = localStorage.getItem('reverseERD_lastSelectedSchema');
          
          // Auto-select the last selected schema, or first schema if none saved
          const schemaToSelect = (lastSelectedSchema && filteredSchemas.includes(lastSelectedSchema)) 
            ? lastSelectedSchema 
            : filteredSchemas[0]; // Use first filtered schema
          
          if (schemaToSelect) {
            setTimeout(() => {
              originalSelectSchema(schemaToSelect);
            }, 100);
          }
        } else {
          console.log('ℹ️ No saved schemas found, showing "Load Schemas" button');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();
  }, [selectedApplication.uuid]); // Re-run when application changes

  // ==================== DATABASE CHANGES DETECTION ====================
  // MUST BE DEFINED EARLY - Used by other functions below
  
  // Database Changes Modal state
  const [databaseChangesModal, setDatabaseChangesModal] = useState({
    isOpen: false,
    changes: null,
    isRefreshing: false,
    onComplete: null,
    targetSchema: null // Track which schema the changes are for
  });

  // Check for database changes (manual trigger only)
  const checkForDatabaseChanges = useCallback(async (onComplete = null, targetSchema = null) => {
    // Use targetSchema if provided, otherwise use selectedSchema
    const schemaToCheck = targetSchema || selectedSchema;
    
    if (!schemaToCheck) return false;

    try {
      const erdService = (await import('../services/schemaErdService')).default;
      const { detectDatabaseChanges } = await import('../utils/databaseChangeDetector');
      const { loadBaselineSchema } = await import('../utils/persistenceAdapter');

      // Load baseline with connectionId for multi-database support
      const baseline = await loadBaselineSchema(schemaToCheck, connectionId);
      const currentRealDB = await erdService.getERDData(schemaToCheck);
      const changeResult = detectDatabaseChanges(baseline, currentRealDB);

      if (changeResult.isFirstLoad) {
        const { saveBaselineSchema } = await import('../utils/persistenceAdapter');
        await saveBaselineSchema(schemaToCheck, currentRealDB, connectionId);
        //console.log('📊 First load: Baseline schema saved for', schemaToCheck);
        return false;
      }

      if (changeResult.hasChanges) {
        setDatabaseChangesModal({
          isOpen: true,
          changes: changeResult.changes,
          isRefreshing: false,
          onComplete,
          targetSchema: schemaToCheck // Store which schema has changes
        });
        setIsAnyModalOpen(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking for database changes:', error);
      showNotification('Failed to check for database changes', 'error');
      return false;
    }
  }, [selectedSchema, showNotification, connectionId]);

  // Handle refresh from Database Changes Modal
  const handleDatabaseChangesRefresh = useCallback(async () => {
    const schemaToRefresh = databaseChangesModal.targetSchema || selectedSchema;
    
    if (!schemaToRefresh) return;

    setDatabaseChangesModal(prev => ({ ...prev, isRefreshing: true }));

    try {
      const erdService = (await import('../services/schemaErdService')).default;
      const persistenceService = (await import('../services/persistenceService')).default;

      // Fetch current real DB state
      const currentRealDB = await erdService.getERDData(schemaToRefresh);
      
      // DO NOT save baseline here - let refreshAndMerge handle it
      // This ensures the merge can see the old baseline and detect deletions

      // Only update virtual schema if we're refreshing the CURRENT schema
      if (schemaToRefresh === selectedSchema) {
        // Update originalSchema to the new real DB state
        // This will become the new baseline after merge
        if (virtualSchema.setOriginalSchema) {
          virtualSchema.setOriginalSchema(currentRealDB);
        }
        
        if (virtualSchema.refreshAndMerge) {
          // Merge real DB changes with virtual changes
          // refreshAndMerge will update the baseline internally
          const mergedSchema = await virtualSchema.refreshAndMerge(currentRealDB);
          
          // CRITICAL: Save merged schema to persistence DB so it persists after browser refresh
          if (mergedSchema) {
            await persistenceService.saveVirtualSchema(schemaToRefresh, mergedSchema);
            
            // Get the actual timestamp from persistence DB after saving
            const dbTimestamp = await persistenceService.getVirtualSchemaTimestamp(schemaToRefresh);
            
            if (dbTimestamp && virtualSchema.setLastSavedTimestamp) {
              virtualSchema.setLastSavedTimestamp(dbTimestamp);
            }
            
            // Clear unsaved changes flag
            if (virtualSchema.setHasUnsavedChanges) {
              virtualSchema.setHasUnsavedChanges(false);
            }
            
          }
        }
      }

      const onComplete = databaseChangesModal.onComplete;
      setDatabaseChangesModal({
        isOpen: false,
        changes: null,
        isRefreshing: false,
        onComplete: null,
        targetSchema: null
      });
      setIsAnyModalOpen(false);

      showNotification('Database changes synchronized successfully', 'success');

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error refreshing database changes:', error);
      showNotification('Failed to refresh database changes', 'error');
      setDatabaseChangesModal(prev => ({ ...prev, isRefreshing: false }));
    }
  }, [selectedSchema, virtualSchema, databaseChangesModal.onComplete, databaseChangesModal.targetSchema, showNotification]);

  // Out of sync modal functions (defined early - used by actuallySaveChanges)
  const showOutOfSyncModal = useCallback(() => {
    setOutOfSyncModal({ isOpen: true });
    setIsAnyModalOpen(true);
  }, []);

  const closeOutOfSyncModal = useCallback(() => {
    setOutOfSyncModal({ isOpen: false });
    setIsAnyModalOpen(false);
  }, []);

  const handleRefreshFromOutOfSync = useCallback(async () => {
    const refreshed = await virtualSchema.refreshFromPersistence?.();
    if (refreshed) {
      showNotification("Schema refreshed. Your changes were discarded.", "info");
    } else {
      showNotification("Failed to refresh schema", "error");
    }
    closeOutOfSyncModal();
  }, [virtualSchema, showNotification]);

  // ==================== MODAL FUNCTIONS ====================

  // Shared Edit Table Modal functions
  // Open modal directly without database change check
  const openEditTableModal = useCallback((tableName, schemaName) => {
    setSharedEditTableModal({
      isOpen: true,
      tableName,
      schemaName
    });
    setIsAnyModalOpen(true);
  }, []);

  const closeEditTableModal = () => {
    setSharedEditTableModal({
      isOpen: false,
      tableName: null,
      schemaName: null
    });
    setIsAnyModalOpen(false);
    // Clear the refresh callback when modal closes
    setEditTableModalRefreshCallback(null);
  };

  // Register refresh callback for EditTableModal
  const registerEditTableModalRefresh = (refreshCallback) => {
    setEditTableModalRefreshCallback(() => refreshCallback);
  };

  // FK Comparison Modal functions
  const showFKComparison = (comparisonResult) => {
    setFkComparisonModal({
      isOpen: true,
      comparisonResult
    });
    setIsAnyModalOpen(true);
  };

  const closeFKComparison = () => {
    setFkComparisonModal({
      isOpen: false,
      comparisonResult: null
    });
    setIsAnyModalOpen(false);
  };

  // Handle FK change revert
  const handleRevertFKChange = (tableName, columnName, changeType) => {
    try {
      const updatedSchema = revertFKChange(
        virtualSchema.workingSchema,
        tableName,
        columnName,
        changeType,
        virtualSchema.originalSchema
      );

      // Update the virtual schema
      virtualSchema.updateWorkingSchema(updatedSchema);

      // Refresh EditTableModal if it's open and showing the affected table
      if (editTableModalRefreshCallback && 
          sharedEditTableModal.isOpen && 
          sharedEditTableModal.tableName === tableName) {
        editTableModalRefreshCallback();
      }

      // Show success notification
      showNotification(`Foreign key change reverted for ${tableName}.${columnName}`, "success");

      // Update the comparison result to remove the reverted change
      if (fkComparisonModal.comparisonResult) {
        const updatedResult = { ...fkComparisonModal.comparisonResult };
        const tableChanges = updatedResult.changes[tableName];
        
        if (tableChanges) {
          if (changeType === 'added') {
            tableChanges.added = tableChanges.added.filter(change => change.columnName !== columnName);
          } else if (changeType === 'removed') {
            tableChanges.removed = tableChanges.removed.filter(change => change.columnName !== columnName);
          }

          // Remove table from changes if no more changes
          if (tableChanges.added.length === 0 && tableChanges.removed.length === 0) {
            delete updatedResult.changes[tableName];
            updatedResult.affectedTables = updatedResult.affectedTables.filter(t => t !== tableName);
          }

          // Check if any changes remain
          updatedResult.hasChanges = Object.keys(updatedResult.changes).length > 0;

          if (!updatedResult.hasChanges) {
            // Close modal if no more changes
            closeFKComparison();
          } else {
            // Update modal with new comparison result
            setFkComparisonModal(prev => ({
              ...prev,
              comparisonResult: updatedResult
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error reverting FK change:', error);
      showNotification(`Error reverting change: ${error.message}`, "error");
    }
  };

  // NEW: Hover-based relationship highlighting functions
  const handleTableHover = (tableName) => {
    // SMART PRIORITY: Don't show hover highlighting if there's an active search with column results
    // This prevents confusion when user has searched for specific columns
    if (debouncedSearch && debouncedSearch.includes('.')) {
      // User is searching for specific columns (contains dot notation like "table.column")
      // Skip hover highlighting to avoid confusion
      return;
    }

    // Use working schema (includes virtual changes) or fall back to original erdData
    const currentSchema = virtualSchema.workingSchema || erdData;
    
    if (!currentSchema?.relationships) {
      setHoveredTable(null);
      setHoverHighlightedRelationships([]);
      return;
    }

    setHoveredTable(tableName);

    // Find all relationships involving this table (both actual and virtual)
    const relatedRelationships = currentSchema.relationships.filter(rel => 
      rel.fromTable === tableName || rel.toTable === tableName
    );

    // Create highlight data for each relationship
    const highlightData = relatedRelationships.map(rel => {
      const isTablePrimaryKey = rel.fromTable === tableName;
      const isTableForeignKey = rel.toTable === tableName;

      return {
        ...rel,
        highlightType: isTablePrimaryKey ? 'primary' : 'foreign', // 'primary' = blue, 'foreign' = green
        isTablePrimaryKey,
        isTableForeignKey
      };
    });

    setHoverHighlightedRelationships(highlightData);
  };

  const handleTableHoverEnd = () => {
    setHoveredTable(null);
    setHoverHighlightedRelationships([]);
  };

  // NEW: Improved relationship highlighting with proper timer management
  const setHighlightedRelationshipWithTimer = (relationshipData) => {
    // Clear any existing timer
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      setHighlightTimer(null);
    }

    // MUTUALLY EXCLUSIVE: Clear N:M highlight when setting regular relationship highlight
    if (relationshipData && nmHighlightTimer) {
      clearTimeout(nmHighlightTimer);
      setNMHighlightTimer(null);
      setHighlightedNMRelationship(null);
    }

    // Set the new highlighted relationship
    setHighlightedRelationship(relationshipData);

    // Set new timer if relationship data is provided
    if (relationshipData) {
      const newTimer = setTimeout(() => {
        setHighlightedRelationship(null);
        setHighlightTimer(null);
      }, 4000);
      
      setHighlightTimer(newTimer);
    }
  };

  // NEW: N:M relationship highlighting with timer (5 seconds, purple color)
  const setHighlightedNMRelationshipWithTimer = (nmData) => {
    // Clear any existing N:M timer
    if (nmHighlightTimer) {
      clearTimeout(nmHighlightTimer);
      setNMHighlightTimer(null);
    }

    // MUTUALLY EXCLUSIVE: Clear regular relationship highlight when setting N:M highlight
    if (nmData && highlightTimer) {
      clearTimeout(highlightTimer);
      setHighlightTimer(null);
      setHighlightedRelationship(null);
    }

    // Set the new highlighted N:M relationship
    // nmData structure: { table1, table2, junctionTable }
    setHighlightedNMRelationship(nmData);

    // Set new timer if data is provided
    if (nmData) {
      const newTimer = setTimeout(() => {
        setHighlightedNMRelationship(null);
        setNMHighlightTimer(null);
      }, 5000); // 5 seconds for N:M highlights
      
      setNMHighlightTimer(newTimer);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (highlightTimer) {
        clearTimeout(highlightTimer);
      }
      if (nmHighlightTimer) {
        clearTimeout(nmHighlightTimer);
      }
    };
  }, [highlightTimer, nmHighlightTimer]);

  // Clear N:M highlight when schema changes
  useEffect(() => {
    // Clear N:M highlight and timer when switching schemas
    if (nmHighlightTimer) {
      clearTimeout(nmHighlightTimer);
      setNMHighlightTimer(null);
    }
    setHighlightedNMRelationship(null);
  }, [selectedSchema]); // Run when schema changes

  // Detect circular dependencies whenever relationships change
  useEffect(() => {
    const currentSchema = virtualSchema.workingSchema || erdData;
    
    if (currentSchema?.relationships) {
      const circularDeps = detectCircularDependencies(currentSchema.relationships);
      setTablesInCircularDependency(circularDeps.tables);
      setRelationshipsInCircularDependency(circularDeps.relationships);
      
      if (circularDeps.tables.length > 0) {
      }
    } else {
      setTablesInCircularDependency([]);
      setRelationshipsInCircularDependency([]);
    }
  }, [virtualSchema.workingSchema, erdData]);

  // Toggle crow's foot notation mode
  const toggleCrowsFootMode = () => {
    setCrowsFootMode(prev => !prev);
  };

  // Toggle grid background
  const toggleGridBackground = () => {
    setGridBackground(prev => !prev);
  };

  // Close Database Changes Modal (not used - user must refresh)
  const closeDatabaseChangesModal = useCallback(() => {
    // Modal cannot be closed without refreshing
    // This function exists for consistency but does nothing
  }, []);

  // ==================== SAVE CHANGES HELPERS ====================
  
  // SCENARIO 4: Save Changes - Check for database changes before saving
  const saveChangesWithDatabaseCheck = useCallback(async () => {
    // Check for database changes before saving
    const hasDbChanges = await checkForDatabaseChanges(() => {
      // After database refresh, proceed with save
      actuallySaveChanges();
    });
    
    // If database changes modal is shown, stop here
    if (hasDbChanges) {
      return { success: false, reason: 'database_changes_detected' };
    }
    
    // No database changes, save directly
    return await actuallySaveChanges();
  }, [checkForDatabaseChanges]);

  // Helper function to actually save changes
  const actuallySaveChanges = useCallback(async () => {
    if (virtualSchema.saveChangesToPersistence) {
      const result = await virtualSchema.saveChangesToPersistence();
      
      if (result.success) {
        showNotification('Changes saved successfully!', 'success');
      } else if (result.reason === 'conflict') {
        // Show out of sync modal
        showOutOfSyncModal();
      } else if (result.reason === 'no_changes') {
        showNotification('No changes to save', 'info');
      } else {
        showNotification('Failed to save changes', 'error');
      }
      
      return result;
    }
    return { success: false, reason: 'no_save_function' };
  }, [virtualSchema, showNotification, showOutOfSyncModal]);

  // ==================== SCENARIO TRIGGERS ====================
  
  // REMOVED: Scenario 3 Browser Refresh Check
  // Browser refresh should NEVER query real DB - everything loads from persistence DB
  // Real DB is only checked when user clicks "Save Changes" button
  // This ensures zero real DB queries on refresh (cost savings requirement)
  
  // Initialize virtual schema when ERD data loads
  useEffect(() => {
    if (erdData && !erdLoading && selectedSchema) {
      virtualSchema.initializeSchema(erdData);
    }
  }, [erdData, erdLoading, selectedSchema, virtualSchema.initializeSchema]);

  // NEW: New changes modal functions
  const showNewChangesModal = useCallback(() => {
    setNewChangesModal({ isOpen: true });
    setIsAnyModalOpen(true);
  }, []);

  const closeNewChangesModal = useCallback(() => {
    setNewChangesModal({ isOpen: false });
    setIsAnyModalOpen(false);
  }, []);

  const handleRefreshFromNewChanges = useCallback(async () => {
    const refreshed = await virtualSchema.refreshFromPersistence?.();
    if (refreshed) {
      showNotification("Changes refreshed successfully!", "success");
    } else {
      showNotification("Failed to refresh changes", "error");
    }
    closeNewChangesModal();
  }, [virtualSchema, showNotification]);

  // NEW: Unsaved changes modal functions
  const showUnsavedChangesModal = useCallback((targetSchema, onConfirm) => {
    setUnsavedChangesModal({
      isOpen: true,
      targetSchema,
      onConfirm
    });
    setIsAnyModalOpen(true);
  }, []);

  const closeUnsavedChangesModal = useCallback(() => {
    setUnsavedChangesModal({
      isOpen: false,
      targetSchema: null,
      onConfirm: null
    });
    setIsAnyModalOpen(false);
  }, []);

  const handleSaveAndSwitch = useCallback(() => {
    const saved = virtualSchema.saveChangesToPersistence?.();
    if (saved) {
      showNotification("Changes saved successfully!", "success");
    }
    
    // Execute the original action (schema switch)
    if (unsavedChangesModal.onConfirm) {
      unsavedChangesModal.onConfirm();
    }
    
    closeUnsavedChangesModal();
  }, [virtualSchema, showNotification, unsavedChangesModal.onConfirm]);

  const handleDiscardAndSwitch = useCallback(() => {
    // Just execute the original action without saving
    if (unsavedChangesModal.onConfirm) {
      unsavedChangesModal.onConfirm();
    }
    
    closeUnsavedChangesModal();
  }, [unsavedChangesModal.onConfirm]);

  // NEW: Wrapped selectSchema with unsaved changes check only
  const selectSchema = useCallback(async (schemaName) => {
    // Check for unsaved changes when switching schemas
    if (selectedSchema && schemaName !== selectedSchema && virtualSchema.hasUnsavedChanges) {
      // Show unsaved changes modal
      showUnsavedChangesModal(schemaName, () => {
        // This callback will be executed after user chooses to save or discard
        originalSelectSchema(schemaName);
      });
    } else {
      // No unsaved changes, switch directly
      originalSelectSchema(schemaName);
    }
  }, [selectedSchema, virtualSchema.hasUnsavedChanges, originalSelectSchema, showUnsavedChangesModal]);

  // NEW: Periodic check for new changes from other users (persistence DB)
  // DISABLED: Only show conflict modal when user tries to save, not during idle time
  /*
  useEffect(() => {
    if (!selectedSchema || !virtualSchema.lastSavedTimestamp) return;

    const checkForNewChanges = setInterval(async () => {
      try {
        // ONLY show "New Changes Available" modal if user has NO unsaved changes
        // If they have unsaved changes, they'll get "Out of Sync" modal when they try to save
        if (virtualSchema.hasUnsavedChanges) {
          return; // Skip check if user is actively editing
        }

        // Check if persistence DB has newer changes
        const hasNewerChanges = await virtualSchema.checkForNewerChanges?.();
        
        if (hasNewerChanges && !newChangesModal.isOpen) {
          console.log('🔔 New changes detected from other users (user is idle)');
          showNewChangesModal();
        }
      } catch (error) {
        console.warn('Failed to check for new changes:', error);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkForNewChanges);
  }, [selectedSchema, virtualSchema.lastSavedTimestamp, virtualSchema.hasUnsavedChanges, newChangesModal.isOpen, showNewChangesModal, virtualSchema.checkForNewerChanges]);
  */

  // NEW: Browser beforeunload protection for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (virtualSchema.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [virtualSchema.hasUnsavedChanges]);

  // Track workingSchema changes for debugging
  useEffect(() => {
    // Debug logging removed for production
  }, [virtualSchema.workingSchema]);

  // Relationship details and delete modals
  const [relationshipDetailsModal, setRelationshipDetailsModal] = useState({
    isOpen: false,
    relationships: []
  });
  const [relationshipDeleteModal, setRelationshipDeleteModal] = useState({
    isOpen: false,
    relationships: []
  });

  // Export PDF modal
  const [exportPDFModal, setExportPDFModal] = useState({
    isOpen: false
  });

  const openRelationshipDetailsModal = (relationships) => {
    setRelationshipDetailsModal({
      isOpen: true,
      relationships
    });
    setIsAnyModalOpen(true);
  };

  const closeRelationshipDetailsModal = () => {
    setRelationshipDetailsModal({
      isOpen: false,
      relationships: []
    });
    setIsAnyModalOpen(false);
  };

  const openRelationshipDeleteModal = (relationships) => {
    setRelationshipDeleteModal({
      isOpen: true,
      relationships
    });
    setIsAnyModalOpen(true);
  };

  const closeRelationshipDeleteModal = () => {
    setRelationshipDeleteModal({
      isOpen: false,
      relationships: []
    });
    setIsAnyModalOpen(false);
  };

  const openExportPDFModal = () => {
    setExportPDFModal({
      isOpen: true
    });
    setIsAnyModalOpen(true);
  };

  const closeExportPDFModal = () => {
    setExportPDFModal({
      isOpen: false
    });
    setIsAnyModalOpen(false);
  };

  const deleteRelationships = async (relationships) => {
    try {
      // VIRTUAL DELETION ONLY - No real database modifications
      // This function removes relationships from the virtual schema representation only
      
      // Check if any relationship is part of a junction table
      const junctionTables = new Set();
      relationships.forEach(rel => {
        if (rel.isJunctionRelationship && rel.junctionTable) {
          junctionTables.add(rel.junctionTable);
        }
      });

      // If deleting from junction table, include ALL relationships from that junction table
      let allRelationshipsToDelete = [...relationships];
      if (junctionTables.size > 0) {
        junctionTables.forEach(junctionTable => {
          const junctionRels = virtualSchema.workingSchema.relationships.filter(rel =>
            rel.fromTable === junctionTable || rel.toTable === junctionTable
          );
          junctionRels.forEach(rel => {
            if (!allRelationshipsToDelete.find(r => 
              r.fromTable === rel.fromTable && 
              r.fromColumn === rel.fromColumn &&
              r.toTable === rel.toTable &&
              r.toColumn === rel.toColumn
            )) {
              allRelationshipsToDelete.push(rel);
            }
          });
        });
      }

      // Call backend API to validate deletion (no real DB changes)
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api'}/schemas/${selectedSchema}/relationships`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          relationships: allRelationshipsToDelete,
          junctionTables: Array.from(junctionTables)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete relationships');
      }

      // VIRTUAL UPDATE: Update working schema in memory only
      if (virtualSchema.workingSchema) {
        const updatedSchema = {
          ...virtualSchema.workingSchema,
          relationships: virtualSchema.workingSchema.relationships.filter(rel => 
            !allRelationshipsToDelete.some(delRel => 
              rel.fromTable === delRel.fromTable &&
              rel.fromColumn === delRel.fromColumn &&
              rel.toTable === delRel.toTable &&
              rel.toColumn === delRel.toColumn
            )
          ),
          tables: { ...virtualSchema.workingSchema.tables }
        };

        // Handle FK columns: Remove user-created columns, or just remove FK badge from DB columns
        allRelationshipsToDelete.forEach(rel => {
          if (updatedSchema.tables[rel.fromTable]) {
            const table = updatedSchema.tables[rel.fromTable];
            const column = table.columns[rel.fromColumn];
            
            if (column) {
              // Check if column exists in original DB
              const existsInOriginalDB = virtualSchema.originalSchema?.tables?.[rel.fromTable]?.columns?.[rel.fromColumn];
              const shouldDeleteColumn = column.isUserCreated && !existsInOriginalDB;
              
              if (shouldDeleteColumn) {
                // Delete user-created column (virtual only)
                delete updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
              } else {
                // Just remove FK badge from DB column (virtual only)
                updatedSchema.tables[rel.fromTable].columns[rel.fromColumn] = {
                  ...column,
                  fk: false
                };
              }
            }
          }
        });

        // Remove junction tables (virtual only)
        junctionTables.forEach(junctionTable => {
          if (updatedSchema.tables[junctionTable]) {
            delete updatedSchema.tables[junctionTable];
          }
        });

        virtualSchema.updateWorkingSchema(updatedSchema);
      }

      // Show success notification
      const count = allRelationshipsToDelete.length;
      const junctionMsg = junctionTables.size > 0 ? ` and ${junctionTables.size} junction table${junctionTables.size > 1 ? 's' : ''}` : '';
      showNotification(
        `${count} relationship${count > 1 ? 's' : ''} deleted successfully${junctionMsg}.`,
        'success'
      );

      return { success: true };
    } catch (error) {
      console.error('Error deleting relationships:', error);
      showNotification('Failed to delete relationships: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  };

  // ==================== RELOAD SCHEMAS FOR APPLICATION ====================
  const reloadSchemasForApplication = useCallback(async (applicationUuid) => {
    try {
      console.log(`🔄 Reloading schemas for application: ${applicationUuid}`);
      
      // Fetch schemas filtered by application
      const schemaService = (await import('../services/schemaService')).default;
      const schemaList = await schemaService.getSchemas(applicationUuid);
      
      console.log(`📊 Found ${schemaList.length} schemas for this application`);
      
      // Update schemas list
      setSchemasDirectly(schemaList);
      
      // Auto-select first schema if available
      if (schemaList.length > 0) {
        setTimeout(() => {
          originalSelectSchema(schemaList[0]);
        }, 100);
      } else {
        // No schemas for this application
        showNotification('No schemas found for this application', 'info');
      }
      
      return { success: true, schemas: schemaList };
    } catch (error) {
      console.error('Error reloading schemas:', error);
      showNotification('Failed to reload schemas', 'error');
      return { success: false, error: error.message };
    }
  }, [setSchemasDirectly, originalSelectSchema, showNotification]);

  const value = {
    // Application
    selectedApplication,
    setSelectedApplication,
    reloadSchemasForApplication,
    
    // Schemas
    schemas,
    schemasLoading,
    schemasError,
    schemasHasLoaded,
    refetchSchemas,
    loadAllSchemasFirstTime, // NEW: Load all schemas from real DB and save to persistence DB

    // ERD Data (with race condition protection during schema switching)
    erdData: (() => {
      // Priority: workingSchema > erdData (but not during schema switching)
      let result;
      if (virtualSchema.isSwitchingSchema) {
        result = null;
      } else if (virtualSchema.workingSchema) {
        result = virtualSchema.workingSchema;
      } else {
        result = erdData;
      }
      return result;
    })(),
    originalERDData: erdData,
    erdLoading: erdLoading || virtualSchema.isSwitchingSchema,
    erdError,
    refetchERD,

    // Virtual Schema
    ...virtualSchema,

    // Selection
    selectedSchema,
    selectedTable,
    selectSchema,
    selectTable,
    clearSelection,

    // Search
    searchQuery,
    setSearchQuery,
    debouncedSearch,

    // Relationship highlighting
    highlightedRelationship,
    setHighlightedRelationship,
    setHighlightedRelationshipWithTimer, // NEW: Improved timer management

    // NEW: N:M relationship highlighting (separate from regular highlighting)
    highlightedNMRelationship,
    setHighlightedNMRelationship,
    setHighlightedNMRelationshipWithTimer,

    // NEW: Hover-based relationship highlighting
    hoveredTable,
    hoverHighlightedRelationships,
    handleTableHover,
    handleTableHoverEnd,

    // NEW: Circular dependency detection
    tablesInCircularDependency,
    relationshipsInCircularDependency,

    // Routing mode (fixed to direct)
    routingMode,

    // Crow's foot notation mode
    crowsFootMode,
    toggleCrowsFootMode,

    // Grid background toggle
    gridBackground,
    toggleGridBackground,

    // Shared Edit Table Modal
    sharedEditTableModal,
    openEditTableModal,
    closeEditTableModal,
    registerEditTableModalRefresh,

    // FK Comparison Modal
    fkComparisonModal,
    showFKComparison,
    closeFKComparison,
    handleRevertFKChange,

    // Notifications
    notifications,
    showNotification,
    removeNotification,

    // Relationship deletion
    deleteRelationships,

    // Relationship modals
    relationshipDetailsModal,
    openRelationshipDetailsModal,
    closeRelationshipDetailsModal,
    relationshipDeleteModal,
    openRelationshipDeleteModal,
    closeRelationshipDeleteModal,

    // Export PDF modal
    exportPDFModal,
    openExportPDFModal,
    closeExportPDFModal,

    // Global modal state
    isAnyModalOpen,
    setIsAnyModalOpen,

    // Database Changes Modal (NEW)
    databaseChangesModal,
    checkForDatabaseChanges,
    handleDatabaseChangesRefresh,
    closeDatabaseChangesModal,
    saveChangesWithDatabaseCheck, // SCENARIO 4: Save with DB check

    // NEW: New changes detection modal
    newChangesModal,
    showNewChangesModal,
    closeNewChangesModal,
    handleRefreshFromNewChanges,

    // NEW: Unsaved changes modal
    unsavedChangesModal,
    showUnsavedChangesModal,
    closeUnsavedChangesModal,
    handleSaveAndSwitch,
    handleDiscardAndSwitch,

    // NEW: Out of sync modal
    outOfSyncModal,
    showOutOfSyncModal,
    closeOutOfSyncModal,
    handleRefreshFromOutOfSync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
