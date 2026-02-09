import { createContext, useContext, useState, useEffect } from "react";
import { useSchemas } from "../hooks/useSchemas";
import { useERD } from "../hooks/useERD";
import { useSelection } from "../hooks/useSelection";
import { useDebounce } from "../hooks/useDebounce";
import { useVirtualSchema } from "./VirtualSchemaContext";
import { revertFKChange } from "../utils/fkComparison";

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

  // Notification system (simple state-based notifications)
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds for success/info, keep error/warning until manually closed
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
    selectSchema,
    selectTable,
    clearSelection,
  } = useSelection();

  const {
    schemas,
    loading: schemasLoading,
    error: schemasError,
    refetch: refetchSchemas,
  } = useSchemas();
  const {
    erdData,
    loading: erdLoading,
    error: erdError,
    refetch: refetchERD,
  } = useERD(selectedSchema);

  // Virtual schema context
  const virtualSchema = useVirtualSchema();

  // Shared Edit Table Modal functions
  const openEditTableModal = (tableName, schemaName) => {
    setSharedEditTableModal({
      isOpen: true,
      tableName,
      schemaName
    });
    setIsAnyModalOpen(true);
  };

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

  // Toggle crow's foot notation mode
  const toggleCrowsFootMode = () => {
    setCrowsFootMode(prev => !prev);
  };

  // Toggle grid background
  const toggleGridBackground = () => {
    setGridBackground(prev => !prev);
  };

  // Auto-refresh mechanism for real-time sync detection
  useEffect(() => {
    if (!selectedSchema || !erdData || erdLoading) return;

    const autoRefreshInterval = setInterval(async () => {
      try {
        // Import the service directly to fetch fresh data
        const erdService = (await import('../services/schemaErdService')).default;
        const freshERDData = await erdService.getERDData(selectedSchema);
        
        if (freshERDData) {
          // Compare with current original schema to detect meaningful changes
          const hasChanges = (() => {
            if (!virtualSchema.originalSchema) return true;

            // Compare table count
            const originalTables = Object.keys(virtualSchema.originalSchema.tables || {});
            const freshTables = Object.keys(freshERDData.tables || {});
            if (originalTables.length !== freshTables.length) return true;

            // Compare table names
            if (!originalTables.every(table => freshTables.includes(table))) return true;

            // Compare relationships count (for FK sync detection)
            const originalRels = (virtualSchema.originalSchema.relationships || []).length;
            const freshRels = (freshERDData.relationships || []).length;
            if (originalRels !== freshRels) return true;

            // Deep comparison for relationships (most important for FK sync)
            const originalRelKeys = (virtualSchema.originalSchema.relationships || [])
              .map(rel => `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`)
              .sort();
            const freshRelKeys = (freshERDData.relationships || [])
              .map(rel => `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`)
              .sort();
            
            return JSON.stringify(originalRelKeys) !== JSON.stringify(freshRelKeys);
          })();

          if (hasChanges) {
            console.log('🔄 Auto-refresh detected database changes, updating schema...');
            
            // Update the original schema with fresh data
            if (virtualSchema.setOriginalSchema) {
              virtualSchema.setOriginalSchema(freshERDData);
            }

            // Trigger refresh and merge to update sync status
            if (virtualSchema.refreshAndMerge) {
              await virtualSchema.refreshAndMerge(freshERDData);
            }

            // If FK comparison modal is open, refresh it with new data
            if (fkComparisonModal.isOpen && virtualSchema.workingSchema) {
              const { compareForeignKeys } = await import('../utils/fkComparison');
              const updatedComparison = compareForeignKeys(freshERDData, virtualSchema.workingSchema);
              
              console.log('🔄 FK Comparison refresh:', {
                hasChanges: updatedComparison.hasChanges,
                affectedTables: updatedComparison.affectedTables,
                changes: updatedComparison.changes
              });
              
              if (updatedComparison.hasChanges) {
                setFkComparisonModal(prev => ({
                  ...prev,
                  comparisonResult: updatedComparison
                }));
                console.log('✅ FK Comparison modal updated with fresh data');
              } else {
                // No more changes, close the modal
                closeFKComparison();
                showNotification("All changes have been synchronized!", "success");
                console.log('✅ All FK changes synchronized, closing modal');
              }
            }

            // Refresh EditTableModal if it's open
            if (editTableModalRefreshCallback && sharedEditTableModal.isOpen) {
              editTableModalRefreshCallback();
            }

            // Show notification about sync detection
            if (fkComparisonModal.isOpen) {
              showNotification("Database changes detected and synchronized!", "info");
            }
          }
        }
      } catch (error) {
        // Silently handle errors to avoid disrupting user experience
        console.warn('Auto-refresh failed:', error);
      }
    }, 3000); // 3 second interval

    return () => clearInterval(autoRefreshInterval);
  }, [
    selectedSchema, 
    erdData, 
    erdLoading, 
    virtualSchema.originalSchema, 
    virtualSchema.workingSchema,
    virtualSchema.refreshAndMerge, 
    virtualSchema.setOriginalSchema,
    fkComparisonModal.isOpen,
    editTableModalRefreshCallback,
    sharedEditTableModal.isOpen,
    showNotification,
    closeFKComparison
  ]);

  // Initialize virtual schema when ERD data loads
  useEffect(() => {
    if (erdData && !erdLoading && selectedSchema) {
      virtualSchema.initializeSchema(erdData);
    }
  }, [erdData, erdLoading, selectedSchema, virtualSchema.initializeSchema]);

  // Track workingSchema changes for debugging
  useEffect(() => {
    // Debug logging removed for production
  }, [virtualSchema.workingSchema]);

  const value = {
    // Schemas
    schemas,
    schemasLoading,
    schemasError,
    refetchSchemas,

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

    // Global modal state
    isAnyModalOpen,
    setIsAnyModalOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
