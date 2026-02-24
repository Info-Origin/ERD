import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  saveBaselineSchema,
  loadBaselineSchema,
  clearBaselineSchema,
  saveRealDbHistory,
  loadRealDbHistory,
  clearRealDbHistory,
  saveToStorage,
  saveTablePositions,
  loadTablePositions,
  clearTablePositions,
  loadFromStorage,
  clearFromStorage,
  clearAllFromStorage,
  getStorageTimestamp,
  checkForNewerChanges as checkForNewerChangesFn,
} from "../utils/persistenceAdapter.js";

// Persistence utilities now use database-backed API with localStorage fallback
const STORAGE_KEY = "reverseERD_virtualSchemas";
const TABLE_POSITIONS_KEY = "reverseERD_tablePositions";
const REAL_DB_HISTORY_KEY = "reverseERD_realDbHistory";
const BASELINE_SCHEMA_KEY = "reverseERD_baselineSchemas";

const VirtualSchemaContext = createContext();

export const useVirtualSchema = () => {
  const context = useContext(VirtualSchemaContext);
  if (!context) {
    throw new Error(
      "useVirtualSchema must be used within VirtualSchemaProvider",
    );
  }
  return context;
};

export const VirtualSchemaProvider = ({ children }) => {
  const [originalSchema, setOriginalSchema] = useState(null);
  const [workingSchema, setWorkingSchema] = useState(null);
  const [isModified, setIsModified] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // NEW: Track unsaved changes
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null); // NEW: Track when changes were last saved
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentSchemaName, setCurrentSchemaName] = useState(null);
  const [tablePositions, setTablePositions] = useState({});
  const [isSwitchingSchema, setIsSwitchingSchema] = useState(false);
  const [realDbHistory, setRealDbHistory] = useState([]); // Track real DB changes over time
  const historyIndexRef = useRef(-1);
  const historyRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // REMOVED: Auto-save to database when working schema changes
  // Now using manual save button instead
  
  // Auto-save table positions (canvas layout only)
  useEffect(() => {
    if (currentSchemaName && Object.keys(tablePositions).length > 0) {
      saveTablePositions(currentSchemaName, tablePositions);
    }
  }, [tablePositions, currentSchemaName]);

  // Merge real database schema with virtual schema changes
  const mergeSchemas = useCallback((realSchema, virtualSchema, originalSchema = null, dbHistory = []) => {
    // SIMPLIFIED MERGE STRATEGY:
    // 1. Start with real DB schema (source of truth for structure)
    // 2. Apply virtual modifications (user changes like PK, constraints, relationships)
    // 3. Remove columns that existed in original but are now deleted from real DB
    // 4. Keep user-added columns that never existed in real DB
    
    // Start with real schema as base
    const merged = JSON.parse(JSON.stringify(realSchema));
    
    // Process each table
    Object.keys(virtualSchema.tables).forEach(tableName => {
      const virtualTable = virtualSchema.tables[tableName];
      const realTable = realSchema.tables[tableName];
      const originalTable = originalSchema?.tables?.[tableName];
      
      if (realTable) {
        // Table exists in both real and virtual schemas
        
        // Start with real table structure
        merged.tables[tableName] = {
          ...realTable,
          columns: {}
        };
        
        // Step 1: Add all columns from real DB (these are current and valid)
        Object.keys(realTable.columns).forEach(columnName => {
          const realColumn = realTable.columns[columnName];
          const virtualColumn = virtualTable.columns[columnName];
          
          if (virtualColumn) {
            // Column exists in both - merge virtual changes with real structure
            merged.tables[tableName].columns[columnName] = {
              ...realColumn, // Keep real DB structure (type, etc.)
              ...virtualColumn, // Apply virtual modifications (PK, constraints, etc.)
              // Ensure critical real DB properties are preserved
              type: realColumn.type, // Always use real DB type
              autoIncrement: realColumn.autoIncrement, // Always use real DB AI
            };
          } else {
            // Column exists in real but not in virtual - add as-is
            merged.tables[tableName].columns[columnName] = realColumn;
          }
        });
        
        // Step 2: Handle virtual-only columns (user-added or deleted from real DB)
        Object.keys(virtualTable.columns).forEach(columnName => {
          if (!realTable.columns[columnName]) {
            // Column exists in virtual but not in current real DB
            const virtualColumn = virtualTable.columns[columnName];
            
            // CRITICAL FIX: Check if this column has isUserCreated flag
            // If it does, it's truly user-added and should be kept
            // If it doesn't, it came from the real DB originally and was deleted
            const isUserCreated = virtualColumn.isUserCreated === true;
            
            if (isUserCreated) {
              // Column was explicitly created by user in UI - keep it
              merged.tables[tableName].columns[columnName] = virtualColumn;
            } else {
              // Column came from real DB originally but is now deleted
              // Check baseline to confirm
              const existedInBaseline = originalSchema?.tables?.[tableName]?.columns?.[columnName];
              
              if (existedInBaseline) {
                // Column existed in baseline but not in current real DB - it was deleted/renamed
                // Don't add to merged schema (respect real DB changes)
                console.log(`🗑️ Removing column ${tableName}.${columnName} - deleted from real DB`);
              } else {
                // Edge case: column in virtual but not in baseline or real DB
                // This shouldn't happen, but keep it to be safe
                merged.tables[tableName].columns[columnName] = virtualColumn;
              }
            }
          }
        });
        
      } else if (originalSchema?.tables?.[tableName]) {
        // Table existed in original but not in current real DB - it was deleted
        // Don't add to merged schema
      } else {
        // Table never existed in real DB - check baseline more carefully
        const baselineSchema = originalSchema;
        const existedInBaseline = baselineSchema?.tables?.[tableName];
        
        if (existedInBaseline) {
          // Table existed in baseline but not in current real DB - it was deleted
          // Don't add to merged schema
        } else {
          // Table never existed in real DB - it's user-added
          merged.tables[tableName] = virtualTable;
        }
      }
    });
    
    // Add any new tables from real DB that aren't in virtual
    Object.keys(realSchema.tables).forEach(tableName => {
      if (!virtualSchema.tables[tableName]) {
        merged.tables[tableName] = realSchema.tables[tableName];
      }
    });
    
    // Clean up relationships that reference deleted tables/columns
    const validRelationships = (merged.relationships || []).filter(rel => {
      const fromTableExists = merged.tables[rel.fromTable];
      const toTableExists = merged.tables[rel.toTable];
      const fromColumnExists = fromTableExists?.columns[rel.fromColumn];
      const toColumnExists = toTableExists?.columns[rel.toColumn];
      
      const isValid = fromTableExists && toTableExists && fromColumnExists && toColumnExists;
      return isValid;
    });
    
    // Merge relationships from virtual schema (user-added relationships)
    const virtualRelationships = virtualSchema.relationships || [];
    const relationshipMap = new Map();
    
    // Add valid relationships
    validRelationships.forEach(rel => {
      const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
      relationshipMap.set(key, rel);
    });
    
    // Add virtual relationships (will override if same key)
    virtualRelationships.forEach(rel => {
      const fromTableExists = merged.tables[rel.fromTable];
      const toTableExists = merged.tables[rel.toTable];
      const fromColumnExists = fromTableExists?.columns[rel.fromColumn];
      const toColumnExists = toTableExists?.columns[rel.toColumn];
      
      if (fromTableExists && toTableExists && fromColumnExists && toColumnExists) {
        const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
        relationshipMap.set(key, rel);
      }
    });
    
    merged.relationships = Array.from(relationshipMap.values());
    
    // Keep virtual schema metadata
    merged.schemaName = virtualSchema.schemaName || realSchema.schemaName;
    
    return merged;
  }, []);

  // Get merge summary for debugging
  const getMergeSummary = useCallback((realSchema, virtualSchema) => {
    if (!realSchema || !virtualSchema) return null;
    
    const realTables = Object.keys(realSchema.tables || {});
    const virtualTables = Object.keys(virtualSchema.tables || {});
    const newRealTables = realTables.filter(t => !virtualSchema.tables[t]);
    const userAddedTables = virtualTables.filter(t => !realSchema.tables[t]);
    const modifiedTables = realTables.filter(t => virtualSchema.tables[t]);
    
    return {
      newFromDatabase: newRealTables,
      addedByUser: userAddedTables,
      modifiedByUser: modifiedTables,
      totalTables: Math.max(realTables.length, virtualTables.length)
    };
  }, []);

  // Helper function to recalculate isIdentifying for all relationships based on current PK status
  const recalculateIsIdentifying = useCallback((schema) => {
    if (!schema || !schema.tables || !schema.relationships) return schema;

    const updatedRelationships = schema.relationships.map(rel => {
      // Check if the FK column is part of the PK in the child table
      const childTable = schema.tables[rel.fromTable];
      if (!childTable || !childTable.columns[rel.fromColumn]) {
        return rel;
      }

      const fkColumn = childTable.columns[rel.fromColumn];
      const isIdentifying = fkColumn.pk === true;
      
      // Also recalculate cardinality based on UNIQUE or PK status
      // If FK is PK or UNIQUE, it's 1:1, otherwise 1:N
      const isOneToOne = fkColumn.pk || fkColumn.unique;
      const cardinalityType = isOneToOne ? '1:1' : '1:N';
      const relationType = isOneToOne ? 'ONE_TO_ONE' : 'ONE_TO_MANY';

      return {
        ...rel,
        isIdentifying,
        cardinalityType,
        type: relationType
      };
    });

    return {
      ...schema,
      relationships: updatedRelationships
    };
  }, []);

  // Initialize virtual schema from original or database
  const initializeSchema = useCallback(async (erdData) => {
    if (!erdData) return;

    const schemaName = erdData.schemaName;
    
    // If switching to a different schema, prepare new schema data first, then switch atomically
    if (currentSchemaName && currentSchemaName !== schemaName) {
      // Set switching state to prevent race conditions
      setIsSwitchingSchema(true);
      
      // Prepare new schema data
      const savedTablePositions = loadTablePositions(schemaName);
      
      // Apply FK detection to schema based on relationships
      const applyFKDetection = (schema) => {
        const updatedSchema = JSON.parse(JSON.stringify(schema));
        
        // Reset FK flags first
        Object.values(updatedSchema.tables).forEach(table => {
          Object.values(table.columns).forEach(column => {
            column.fk = false;
            column.isPkAndFk = false;
          });
        });

        // Apply FK detection based on relationships
        (updatedSchema.relationships || []).forEach((rel) => {
          if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
            const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
            column.fk = true;
            if (column.pk) {
              column.isPkAndFk = true;
            }
          }
        });

        return updatedSchema;
      };

      // Prepare new working schema
      const savedSchema = loadFromStorage(schemaName);
      
      let newWorkingSchema;
      let newHistory;
      let newHistoryIndex;
      let newIsModified;

      if (savedSchema) {
        // MERGE STRATEGY: Combine real DB schema with virtual schema changes
        // For schema switching, we need to build the history context
        const switchingRealDbHistory = [{
          timestamp: Date.now(),
          tables: Object.keys(erdData.tables || {}),
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        
        const originalRealSchema = erdData; // For switching, current erdData is the baseline
        const mergedSchema = mergeSchemas(erdData, savedSchema, originalRealSchema, switchingRealDbHistory);
        
        // Apply FK detection to merged schema to ensure relationships are properly marked
        newWorkingSchema = applyFKDetection(mergedSchema);
        
        // Recalculate isIdentifying for all relationships based on current PK status
        newWorkingSchema = recalculateIsIdentifying(newWorkingSchema);
        
        newHistory = [JSON.parse(JSON.stringify(erdData)), newWorkingSchema];
        newHistoryIndex = 1;
        newIsModified = true;
      } else {
        newWorkingSchema = JSON.parse(JSON.stringify(erdData));
        newHistory = [newWorkingSchema];
        newHistoryIndex = 0;
        newIsModified = false;
      }

      // ATOMIC UPDATE - Set all state at once to prevent race conditions
      setCurrentSchemaName(schemaName);
      setOriginalSchema(erdData);
      setTablePositions(savedTablePositions);
      setWorkingSchema(newWorkingSchema);
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(newHistoryIndex);
      historyIndexRef.current = newHistoryIndex;
      setIsModified(newIsModified);
      setIsSwitchingSchema(false); // Clear switching state
      
      return; // Early return for schema switching
    }
    
    // Initial schema load (not switching)
    setCurrentSchemaName(schemaName);
    setOriginalSchema(erdData);
    
    // CRITICAL: Save the baseline schema for future comparisons
    // This represents the FIRST real DB state we saw for this schema
    let baselineSchema = loadBaselineSchema(schemaName);
    if (!baselineSchema) {
      // First time loading this schema - save it as baseline
      saveBaselineSchema(schemaName, erdData);
      baselineSchema = erdData;
    }
    
    // Track real DB history for better merge decisions - do this BEFORE merging
    const updatedRealDbHistory = (() => {
      const currentRealTables = Object.keys(erdData.tables || {});
      
      // Load existing history from localStorage
      const existingHistory = loadRealDbHistory(schemaName);
      
      // If this is a completely new schema, initialize history
      if (currentSchemaName !== schemaName) {
        const newHistory = [{
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        saveRealDbHistory(schemaName, newHistory);
        return newHistory;
      }
      
      // If we have no history yet for this schema, initialize it
      if (existingHistory.length === 0) {
        const newHistory = [{
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        saveRealDbHistory(schemaName, newHistory);
        return newHistory;
      }
      
      // Check if real DB has changed since last time
      const lastEntry = existingHistory[existingHistory.length - 1];
      const lastRealTables = lastEntry.tables;
      
      const tablesChanged = currentRealTables.length !== lastRealTables.length ||
        !currentRealTables.every(table => lastRealTables.includes(table)) ||
        !lastRealTables.every(table => currentRealTables.includes(table));
      
      if (tablesChanged) {
        const updatedHistory = [...existingHistory, {
          timestamp: Date.now(),
          tables: currentRealTables,
          schema: JSON.parse(JSON.stringify(erdData))
        }];
        
        // Keep history manageable (last 50 entries)
        const trimmedHistory = updatedHistory.slice(-50);
        
        saveRealDbHistory(schemaName, trimmedHistory);
        return trimmedHistory;
      }
      
      // No changes, return existing history
      return existingHistory;
    })();
    
    // Update the history state
    setRealDbHistory(updatedRealDbHistory);

    // Load table positions from localStorage
    const savedTablePositions = loadTablePositions(schemaName);
    setTablePositions(savedTablePositions);

    // Apply FK detection to schema based on relationships
    const applyFKDetection = (schema) => {
      const updatedSchema = JSON.parse(JSON.stringify(schema));
      
      // Reset FK flags first
      Object.values(updatedSchema.tables).forEach(table => {
        Object.values(table.columns).forEach(column => {
          column.fk = false;
          column.isPkAndFk = false;
        });
      });

      // Apply FK detection based on relationships
      (updatedSchema.relationships || []).forEach((rel) => {
        if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
          const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
          column.fk = true;
          if (column.pk) {
            column.isPkAndFk = true;
          }
        }
      });

      return updatedSchema;
    };

    // Try to load from localStorage first
    const savedSchema = loadFromStorage(schemaName);
    
    if (savedSchema) {
      // MERGE STRATEGY: Combine real DB schema with virtual schema changes
      // CRITICAL: Use the persistent baseline schema for comparison
      
      // Get the timestamp of the saved schema
      const timestamp = getStorageTimestamp(schemaName);
      if (timestamp) {
        setLastSavedTimestamp(timestamp);
      }
      
      // DYNAMIC BASELINE UPDATE: If real DB has new tables that aren't in baseline,
      // update the baseline to include them. This ensures that when they're later
      // deleted, they'll be properly detected as deletions.
      const realTables = Object.keys(erdData.tables || {});
      const baselineTables = Object.keys(baselineSchema?.tables || {});
      const newTablesInReal = realTables.filter(table => !baselineTables.includes(table));
      
      // CRITICAL FIX: Also remove columns from baseline that no longer exist in real DB
      let baselineNeedsUpdate = newTablesInReal.length > 0;
      const updatedBaseline = JSON.parse(JSON.stringify(baselineSchema || {}));
      if (!updatedBaseline.tables) updatedBaseline.tables = {};
      
      // Add new tables
      if (newTablesInReal.length > 0) {
        newTablesInReal.forEach(tableName => {
          updatedBaseline.tables[tableName] = erdData.tables[tableName];
        });
      }
      
      // Clean up baseline: remove columns that don't exist in real DB anymore
      Object.keys(updatedBaseline.tables || {}).forEach(tableName => {
        const baselineTable = updatedBaseline.tables[tableName];
        const realTable = erdData.tables[tableName];
        
        if (realTable && baselineTable.columns) {
          const baselineColumns = Object.keys(baselineTable.columns);
          const realColumns = Object.keys(realTable.columns);
          
          baselineColumns.forEach(columnName => {
            if (!realColumns.includes(columnName)) {
              // Column exists in baseline but not in real DB - remove it
              console.log(`🧹 Cleaning baseline: removing ${tableName}.${columnName}`);
              delete updatedBaseline.tables[tableName].columns[columnName];
              baselineNeedsUpdate = true;
            }
          });
          
          // Also add new columns from real DB to baseline
          realColumns.forEach(columnName => {
            if (!baselineColumns.includes(columnName)) {
              console.log(`➕ Updating baseline: adding ${tableName}.${columnName}`);
              updatedBaseline.tables[tableName].columns[columnName] = realTable.columns[columnName];
              baselineNeedsUpdate = true;
            }
          });
        }
      });
      
      // Save updated baseline if changes were made
      if (baselineNeedsUpdate) {
        saveBaselineSchema(schemaName, updatedBaseline);
        baselineSchema = updatedBaseline;
        console.log('✅ Baseline schema updated to match real DB');
      }
      
      const mergedSchema = mergeSchemas(erdData, savedSchema, baselineSchema, updatedRealDbHistory);
      
      // Apply FK detection to merged schema to ensure relationships are properly marked
      let updatedSchema = applyFKDetection(mergedSchema);
      
      // Recalculate isIdentifying for all relationships based on current PK status
      updatedSchema = recalculateIsIdentifying(updatedSchema);
      
      setWorkingSchema(updatedSchema);
      const newHistory = [JSON.parse(JSON.stringify(erdData)), updatedSchema];
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(1);
      historyIndexRef.current = 1;
      setIsModified(true);
    } else {
      const clonedSchema = JSON.parse(JSON.stringify(erdData));
      setWorkingSchema(clonedSchema);
      const newHistory = [clonedSchema];
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(0);
      historyIndexRef.current = 0;
      setIsModified(false);
    }
  }, [currentSchemaName]); // Add currentSchemaName to dependencies

  // Force refresh and merge with current real DB state
  const refreshAndMerge = useCallback(async (newRealSchema) => {
    if (!workingSchema || !currentSchemaName) return;

    try {
      // CRITICAL FIX: Use the persistent baseline schema for comparison
      // This ensures that deleted tables/columns are properly detected
      let baselineSchema = loadBaselineSchema(currentSchemaName);
      
      if (!baselineSchema) {
        // If no baseline exists, use the current originalSchema and save it
        baselineSchema = originalSchema;
        if (baselineSchema) {
          saveBaselineSchema(currentSchemaName, baselineSchema);
        }
      }
      
      // DYNAMIC BASELINE UPDATE: If real DB has new tables that aren't in baseline,
      // update the baseline to include them. This ensures that when they're later
      // deleted, they'll be properly detected as deletions.
      const realTables = Object.keys(newRealSchema.tables || {});
      const baselineTables = Object.keys(baselineSchema?.tables || {});
      const newTablesInReal = realTables.filter(table => !baselineTables.includes(table));
      
      // CRITICAL FIX: Also remove columns from baseline that no longer exist in real DB
      // This prevents the "ghost column" issue when columns are renamed
      let baselineNeedsUpdate = newTablesInReal.length > 0;
      const updatedBaseline = JSON.parse(JSON.stringify(baselineSchema || {}));
      if (!updatedBaseline.tables) updatedBaseline.tables = {};
      
      // Add new tables
      if (newTablesInReal.length > 0) {
        newTablesInReal.forEach(tableName => {
          updatedBaseline.tables[tableName] = newRealSchema.tables[tableName];
        });
      }
      
      // Clean up baseline: remove columns that don't exist in real DB anymore
      Object.keys(updatedBaseline.tables || {}).forEach(tableName => {
        const baselineTable = updatedBaseline.tables[tableName];
        const realTable = newRealSchema.tables[tableName];
        
        if (realTable && baselineTable.columns) {
          const baselineColumns = Object.keys(baselineTable.columns);
          const realColumns = Object.keys(realTable.columns);
          
          baselineColumns.forEach(columnName => {
            if (!realColumns.includes(columnName)) {
              // Column exists in baseline but not in real DB - remove it
              console.log(`🧹 Cleaning baseline: removing ${tableName}.${columnName}`);
              delete updatedBaseline.tables[tableName].columns[columnName];
              baselineNeedsUpdate = true;
            }
          });
          
          // Also add new columns from real DB to baseline
          realColumns.forEach(columnName => {
            if (!baselineColumns.includes(columnName)) {
              console.log(`➕ Updating baseline: adding ${tableName}.${columnName}`);
              updatedBaseline.tables[tableName].columns[columnName] = realTable.columns[columnName];
              baselineNeedsUpdate = true;
            }
          });
        }
      });
      
      // Save updated baseline if changes were made
      if (baselineNeedsUpdate) {
        saveBaselineSchema(currentSchemaName, updatedBaseline);
        baselineSchema = updatedBaseline;
        console.log('✅ Baseline schema updated to match real DB');
      }
      
      // Merge the new real schema with current virtual changes
      const mergedSchema = mergeSchemas(newRealSchema, workingSchema, baselineSchema, realDbHistory);
      
      // Apply FK detection
      const applyFKDetection = (schema) => {
        const updatedSchema = JSON.parse(JSON.stringify(schema));
        
        // Reset FK flags first
        Object.values(updatedSchema.tables).forEach(table => {
          Object.values(table.columns).forEach(column => {
            column.fk = false;
            column.isPkAndFk = false;
          });
        });

        // Apply FK detection based on relationships
        (updatedSchema.relationships || []).forEach((rel) => {
          if (updatedSchema.tables[rel.fromTable] && updatedSchema.tables[rel.fromTable].columns[rel.fromColumn]) {
            const column = updatedSchema.tables[rel.fromTable].columns[rel.fromColumn];
            column.fk = true;
            if (column.pk) {
              column.isPkAndFk = true;
            }
          }
        });

        return updatedSchema;
      };

      let finalSchema = applyFKDetection(mergedSchema);
      
      // Recalculate isIdentifying for all relationships based on current PK status
      finalSchema = recalculateIsIdentifying(finalSchema);
      
      // Update state - DO NOT update originalSchema here, keep it as the stable baseline
      setWorkingSchema(finalSchema);
      const newHistory = [JSON.parse(JSON.stringify(baselineSchema || newRealSchema)), finalSchema];
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(1);
      historyIndexRef.current = 1; // FIX: Update ref immediately
      setIsModified(true);
      
      return finalSchema;
    } catch (error) {
      console.error('Error in refreshAndMerge:', error);
      throw error;
    }
  }, [workingSchema, currentSchemaName, realDbHistory, originalSchema, mergeSchemas, recalculateIsIdentifying]);

  // Force refresh from backend (ignore localStorage)
  const forceRefreshFromBackend = useCallback(() => {
    if (originalSchema && currentSchemaName) {
      const clonedOriginal = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      const newHistory = [clonedOriginal];
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(0);
      historyIndexRef.current = 0; // Update ref immediately
      setIsModified(false);
      clearFromStorage(currentSchemaName);
    }
  }, [originalSchema, currentSchemaName]);

  // Add to history for undo/redo
  const addToHistory = useCallback(
    (newSchema) => {
      setHistory(prevHistory => {
        const currentIndex = historyIndexRef.current;
        const newHistory = prevHistory.slice(0, currentIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newSchema)));
        historyRef.current = newHistory; // Update ref immediately
        return newHistory;
      });
      
      // Update both state and ref immediately to prevent race conditions
      const newIndex = historyIndexRef.current + 1;
      historyIndexRef.current = newIndex; // Update ref immediately
      setHistoryIndex(newIndex); // Update state
    },
    [],
  );

  // Update working schema
  const updateWorkingSchema = useCallback(
    (newSchema) => {
      setWorkingSchema(newSchema);
      addToHistory(newSchema);
      setIsModified(true);
      setHasUnsavedChanges(true); // Mark as having unsaved changes
    },
    [addToHistory],
  );

  // Helper function to protect synced FKs during undo/redo
  const protectSyncedFKs = useCallback((targetSchema, currentRealSchema) => {
    if (!currentRealSchema || !targetSchema) return targetSchema;

    const protectedSchema = JSON.parse(JSON.stringify(targetSchema));
    
    // Get all FKs from current real database
    const realFKs = new Map(); // Key: "tableName.columnName", Value: relationship
    (currentRealSchema.relationships || []).forEach(rel => {
      const key = `${rel.fromTable}.${rel.fromColumn}`;
      realFKs.set(key, rel);
    });

    console.log('🛡️ Protecting synced FKs during undo/redo:', {
      realFKCount: realFKs.size,
      realFKs: Array.from(realFKs.keys())
    });

    let protectedCount = 0;

    // Ensure all real FKs are present in the target schema
    realFKs.forEach((realRel, key) => {
      const [tableName, columnName] = key.split('.');
      
      // Check if table exists in target schema
      if (!protectedSchema.tables[tableName]) {
        // Table was deleted in history but exists in real DB - restore it
        if (currentRealSchema.tables[tableName]) {
          protectedSchema.tables[tableName] = JSON.parse(JSON.stringify(currentRealSchema.tables[tableName]));
          console.log(`🛡️ Restored table: ${tableName}`);
          protectedCount++;
        }
      }
      
      // Check if column exists in target schema
      if (protectedSchema.tables[tableName]) {
        if (!protectedSchema.tables[tableName].columns[columnName]) {
          // Column was deleted in history but exists in real DB - restore it
          if (currentRealSchema.tables[tableName]?.columns[columnName]) {
            protectedSchema.tables[tableName].columns[columnName] = 
              JSON.parse(JSON.stringify(currentRealSchema.tables[tableName].columns[columnName]));
            console.log(`🛡️ Restored column: ${tableName}.${columnName}`);
            protectedCount++;
          }
        }
        
        // Ensure FK flag is set
        if (protectedSchema.tables[tableName].columns[columnName]) {
          protectedSchema.tables[tableName].columns[columnName].fk = true;
        }
      }
      
      // Check if relationship exists in target schema
      const relationshipExists = (protectedSchema.relationships || []).some(rel =>
        rel.fromTable === realRel.fromTable &&
        rel.fromColumn === realRel.fromColumn &&
        rel.toTable === realRel.toTable &&
        rel.toColumn === realRel.toColumn
      );
      
      if (!relationshipExists) {
        // Relationship was deleted in history but exists in real DB - restore it
        if (!protectedSchema.relationships) {
          protectedSchema.relationships = [];
        }
        protectedSchema.relationships.push(JSON.parse(JSON.stringify(realRel)));
        console.log(`🛡️ Restored relationship: ${tableName}.${columnName} -> ${realRel.toTable}.${realRel.toColumn}`);
        protectedCount++;
      }
    });

    if (protectedCount > 0) {
      console.log(`✅ Protected ${protectedCount} synced FK(s) from being removed by undo/redo`);
    }

    return protectedSchema;
  }, []);

  // Undo
  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex; // FIX: Update ref immediately
      
      let previousState = JSON.parse(JSON.stringify(currentHistory[newIndex]));
      
      // CRITICAL: Protect synced FKs - merge with current real database state
      // This ensures that FKs added to real DB are never removed by undo
      previousState = protectSyncedFKs(previousState, originalSchema);
      
      setWorkingSchema(previousState);
      setIsModified(newIndex !== 0);
      setHasUnsavedChanges(true); // Mark as unsaved after undo
    }
  }, [originalSchema, protectSyncedFKs]); // Add dependencies

  // Redo
  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex; // FIX: Update ref immediately
      
      let nextState = JSON.parse(JSON.stringify(currentHistory[newIndex]));
      
      // CRITICAL: Protect synced FKs - merge with current real database state
      // This ensures that FKs added to real DB are never removed by redo
      nextState = protectSyncedFKs(nextState, originalSchema);
      
      setWorkingSchema(nextState);
      setIsModified(true);
      setHasUnsavedChanges(true); // Mark as unsaved after redo
    }
  }, [originalSchema, protectSyncedFKs]); // Add dependencies

  // Reset to original
  const resetToOriginal = useCallback(() => {
    if (originalSchema && currentSchemaName) {
      const clonedOriginal = JSON.parse(JSON.stringify(originalSchema));
      setWorkingSchema(clonedOriginal);
      const newHistory = [clonedOriginal];
      setHistory(newHistory);
      historyRef.current = newHistory; // Update ref immediately
      setHistoryIndex(0);
      historyIndexRef.current = 0; // FIX: Update ref immediately
      setIsModified(false);
      setHasUnsavedChanges(false); // Clear unsaved flag
      clearFromStorage(currentSchemaName);
      clearBaselineSchema(currentSchemaName); // Clear baseline so it gets reset
    }
  }, [originalSchema, currentSchemaName]);

  // NEW: Manual save function
  const saveChangesToPersistence = useCallback(() => {
    if (workingSchema && currentSchemaName && hasUnsavedChanges) {
      saveToStorage(currentSchemaName, workingSchema);
      const timestamp = Date.now();
      setLastSavedTimestamp(timestamp);
      setHasUnsavedChanges(false);
      console.log('✅ Changes saved to persistence DB at', new Date(timestamp).toLocaleTimeString());
      return true;
    }
    return false;
  }, [workingSchema, currentSchemaName, hasUnsavedChanges]);

  // NEW: Refresh from persistence DB
  const refreshFromPersistence = useCallback(async () => {
    if (!currentSchemaName || !originalSchema) return false;

    try {
      // Load saved schema from persistence DB
      const savedSchema = loadFromStorage(currentSchemaName);
      const baselineSchema = loadBaselineSchema(currentSchemaName);
      
      if (savedSchema) {
        // Merge real DB with saved virtual changes
        const merged = mergeSchemas(originalSchema, savedSchema, baselineSchema, realDbHistory);
        setWorkingSchema(merged);
        const newHistory = [JSON.parse(JSON.stringify(originalSchema)), merged];
        setHistory(newHistory);
        historyRef.current = newHistory;
        setHistoryIndex(1);
        historyIndexRef.current = 1;
        setIsModified(true);
      } else {
        // No saved data, use original
        const clonedOriginal = JSON.parse(JSON.stringify(originalSchema));
        setWorkingSchema(clonedOriginal);
        const newHistory = [clonedOriginal];
        setHistory(newHistory);
        historyRef.current = newHistory;
        setHistoryIndex(0);
        historyIndexRef.current = 0;
        setIsModified(false);
      }
      
      const timestamp = Date.now();
      setLastSavedTimestamp(timestamp);
      setHasUnsavedChanges(false);
      console.log('🔄 Refreshed from persistence DB at', new Date(timestamp).toLocaleTimeString());
      return true;
    } catch (error) {
      console.error('Error refreshing from persistence:', error);
      return false;
    }
  }, [currentSchemaName, originalSchema, realDbHistory, mergeSchemas]);

  // NEW: Check if persistence DB has newer changes than current timestamp
  const checkForNewerChanges = useCallback(async () => {
    if (!currentSchemaName || !lastSavedTimestamp) return false;

    try {
      const hasNewer = await checkForNewerChangesFn(currentSchemaName, lastSavedTimestamp);
      return hasNewer;
    } catch (error) {
      console.warn('Error checking for newer changes:', error);
      return false;
    }
  }, [currentSchemaName, lastSavedTimestamp]);

  // Clear virtual schema
  const clearVirtualSchema = useCallback(() => {
    if (currentSchemaName) {
      clearFromStorage(currentSchemaName);
      clearRealDbHistory(currentSchemaName);
      clearBaselineSchema(currentSchemaName); // Clear baseline as well
    }
    setWorkingSchema(null);
    setOriginalSchema(null);
    setHistory([]);
    historyRef.current = []; // Update ref immediately
    setHistoryIndex(-1);
    historyIndexRef.current = -1; // FIX: Update ref immediately
    setIsModified(false);
    setCurrentSchemaName(null);
    setRealDbHistory([]);
  }, [currentSchemaName]);

  // Clear ALL virtual schemas (for global refresh)
  const clearAllVirtualSchemas = useCallback(() => {
    clearAllFromStorage();
    setWorkingSchema(null);
    setOriginalSchema(null);
    setHistory([]);
    historyRef.current = []; // Update ref immediately
    setHistoryIndex(-1);
    historyIndexRef.current = -1; // FIX: Update ref immediately
    setIsModified(false);
    setCurrentSchemaName(null);
  }, []);

  // TABLE OPERATIONS

  const addTable = useCallback(
    (tableName) => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };

      if (newSchema.tables[tableName]) {
        throw new Error(`Table "${tableName}" already exists`);
      }

      newSchema.tables[tableName] = {
        name: tableName,
        columns: {},
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const deleteTable = useCallback(
    (tableName) => {
      if (!workingSchema) return;

      const newSchema = { ...workingSchema };
      delete newSchema.tables[tableName];

      // Remove relationships involving this table
      newSchema.relationships = (newSchema.relationships || []).filter(
        (rel) => rel.fromTable !== tableName && rel.toTable !== tableName,
      );

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const renameTable = useCallback(
    (oldName, newName) => {
      if (!workingSchema) return;

      if (workingSchema.tables[newName]) {
        throw new Error(`Table "${newName}" already exists`);
      }

      const newSchema = { ...workingSchema };

      // Rename in tables
      newSchema.tables[newName] = {
        ...newSchema.tables[oldName],
        name: newName,
      };
      delete newSchema.tables[oldName];

      // Update relationships
      newSchema.relationships = (newSchema.relationships || []).map((rel) => ({
        ...rel,
        fromTable: rel.fromTable === oldName ? newName : rel.fromTable,
        toTable: rel.toTable === oldName ? newName : rel.toTable,
      }));

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // COLUMN OPERATIONS

  const addColumn = useCallback(
    (tableName, columnName, columnData = {}) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };

      if (newSchema.tables[tableName].columns[columnName]) {
        throw new Error(
          `Column "${columnName}" already exists in table "${tableName}"`,
        );
      }

      newSchema.tables[tableName] = {
        ...newSchema.tables[tableName],
        columns: {
          ...newSchema.tables[tableName].columns,
          [columnName]: {
            name: columnName,
            type: columnData.type || "VARCHAR(255)",
            pk: columnData.pk || false,
            fk: columnData.fk || false,
            unique: columnData.unique || false,
            nullable: columnData.nullable !== undefined ? columnData.nullable : true,
            defaultValue: columnData.defaultValue || null,
          },
        },
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const deleteColumn = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      // Create new columns object without the deleted column
      const currentColumns = workingSchema.tables[tableName].columns;
      const newColumns = Object.keys(currentColumns).reduce((acc, key) => {
        if (key !== columnName) {
          acc[key] = currentColumns[key];
        }
        return acc;
      }, {});

      // Filter out relationships involving this column
      const newRelationships = (workingSchema.relationships || []).filter(
        (rel) =>
          !(rel.fromTable === tableName && rel.fromColumn === columnName) &&
          !(rel.toTable === tableName && rel.toColumn === columnName),
      );

      const newSchema = {
        ...workingSchema,
        relationships: newRelationships,
        tables: {
          ...workingSchema.tables,
          [tableName]: {
            ...workingSchema.tables[tableName],
            columns: newColumns
          }
        }
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const updateColumn = useCallback(
    (tableName, columnName, updates) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = { ...workingSchema };

      newSchema.tables[tableName] = {
        ...newSchema.tables[tableName],
        columns: {
          ...newSchema.tables[tableName].columns,
          [columnName]: {
            ...newSchema.tables[tableName].columns[columnName],
            ...updates,
          },
        },
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  const renameColumn = useCallback(
    (tableName, oldName, newName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      if (workingSchema.tables[tableName].columns[newName]) {
        throw new Error(
          `Column "${newName}" already exists in table "${tableName}"`,
        );
      }

      const newSchema = { ...workingSchema };
      const column = newSchema.tables[tableName].columns[oldName];

      newSchema.tables[tableName].columns[newName] = {
        ...column,
        name: newName,
      };
      delete newSchema.tables[tableName].columns[oldName];

      // Update relationships
      newSchema.relationships = (newSchema.relationships || []).map((rel) => ({
        ...rel,
        fromColumn:
          rel.fromTable === tableName && rel.fromColumn === oldName
            ? newName
            : rel.fromColumn,
        toColumn:
          rel.toTable === tableName && rel.toColumn === oldName
            ? newName
            : rel.toColumn,
      }));

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // CONSTRAINT OPERATIONS

  const togglePrimaryKey = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const currentColumn = workingSchema.tables[tableName].columns[columnName];
      const newColumns = { ...workingSchema.tables[tableName].columns };

      // Remove PK from other columns if setting this one as PK
      if (!currentColumn.pk) {
        Object.keys(newColumns).forEach((col) => {
          newColumns[col] = { ...newColumns[col], pk: false };
        });
      }

      // Update the target column
      newColumns[columnName] = {
        ...currentColumn,
        pk: !currentColumn.pk,
        nullable: !currentColumn.pk ? false : currentColumn.nullable, // PK cannot be nullable
      };

      const newSchema = {
        ...workingSchema,
        tables: {
          ...workingSchema.tables,
          [tableName]: {
            ...workingSchema.tables[tableName],
            columns: newColumns
          }
        }
      };

      // Recalculate isIdentifying for ALL relationships based on new PK status
      const schemaWithUpdatedRelationships = recalculateIsIdentifying(newSchema);

      updateWorkingSchema(schemaWithUpdatedRelationships);
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  const toggleUnique = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = {
        ...workingSchema,
        tables: {
          ...workingSchema.tables,
          [tableName]: {
            ...workingSchema.tables[tableName],
            columns: {
              ...workingSchema.tables[tableName].columns,
              [columnName]: {
                ...workingSchema.tables[tableName].columns[columnName],
                unique: !workingSchema.tables[tableName].columns[columnName].unique,
              }
            }
          }
        }
      };

      // Recalculate isIdentifying and cardinality for all relationships
      const schemaWithUpdatedRelationships = recalculateIsIdentifying(newSchema);

      updateWorkingSchema(schemaWithUpdatedRelationships);
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  const toggleNullable = useCallback(
    (tableName, columnName) => {
      if (!workingSchema || !workingSchema.tables[tableName]) return;

      const newSchema = {
        ...workingSchema,
        tables: {
          ...workingSchema.tables,
          [tableName]: {
            ...workingSchema.tables[tableName],
            columns: {
              ...workingSchema.tables[tableName].columns,
              [columnName]: {
                ...workingSchema.tables[tableName].columns[columnName],
                nullable: !workingSchema.tables[tableName].columns[columnName].nullable,
              }
            }
          }
        }
      };

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // RELATIONSHIP OPERATIONS

  const addRelationship = useCallback(
    (fromTable, fromColumn, toTable, toColumn, type = "ONE_TO_MANY") => {
      if (!workingSchema) return;

      const currentRelationships = workingSchema.relationships || [];

      // Check if relationship already exists
      const exists = currentRelationships.some(
        (rel) =>
          rel.fromTable === fromTable &&
          rel.fromColumn === fromColumn &&
          rel.toTable === toTable &&
          rel.toColumn === toColumn,
      );

      if (exists) {
        throw new Error("Relationship already exists");
      }

      // Create new relationship
      const newRelationship = {
        id: uuidv4(),
        fromTable,
        fromColumn,
        toTable,
        toColumn,
        type,
        isUserCreated: true, // Mark user-created relationships
        createdAt: Date.now(), // Timestamp for "created X minutes ago"
      };

      // Create deep copy with new relationship
      let newSchema = {
        ...workingSchema,
        relationships: [...currentRelationships, newRelationship],
        tables: {
          ...workingSchema.tables,
          [fromTable]: {
            ...workingSchema.tables[fromTable],
            columns: {
              ...workingSchema.tables[fromTable].columns,
              [fromColumn]: {
                ...workingSchema.tables[fromTable].columns[fromColumn],
                fk: true
              }
            }
          }
        }
      };

      // Recalculate isIdentifying and cardinality for all relationships
      newSchema = recalculateIsIdentifying(newSchema);

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  // NEW: Atomic FK creation with new column
  const addForeignKeyWithNewColumn = useCallback(
    (fromTable, newColumnName, columnType, toTable, toColumn, type = "ONE_TO_MANY") => {
      if (!workingSchema) return;

      // Check if column already exists
      if (workingSchema.tables[fromTable]?.columns[newColumnName]) {
        throw new Error(`Column "${newColumnName}" already exists in table "${fromTable}"`);
      }

      const currentRelationships = workingSchema.relationships || [];

      // Check if relationship already exists
      const exists = currentRelationships.some(
        (rel) =>
          rel.fromTable === fromTable &&
          rel.fromColumn === newColumnName &&
          rel.toTable === toTable &&
          rel.toColumn === toColumn,
      );

      if (exists) {
        throw new Error("Relationship already exists");
      }

      // Create new relationship
      const newRelationship = {
        id: uuidv4(),
        fromTable,
        fromColumn: newColumnName,
        toTable,
        toColumn,
        type,
        isUserCreated: true, // Mark user-created relationships
        createdAt: Date.now(), // Timestamp for "created X minutes ago"
      };

      // ATOMIC OPERATION: Create both column and relationship in single schema update
      let newSchema = {
        ...workingSchema,
        relationships: [...currentRelationships, newRelationship],
        tables: {
          ...workingSchema.tables,
          [fromTable]: {
            ...workingSchema.tables[fromTable],
            columns: {
              ...workingSchema.tables[fromTable].columns,
              [newColumnName]: {
                name: newColumnName,
                type: columnType,
                pk: false,
                fk: true, // Mark as FK immediately
                unique: false,
                nullable: true, // FK columns can be nullable
                defaultValue: null,
                isUserCreated: true, // Mark as user-created so it can be deleted when FK is changed
              }
            }
          }
        }
      };

      // Recalculate isIdentifying and cardinality for all relationships
      newSchema = recalculateIsIdentifying(newSchema);

      updateWorkingSchema(newSchema);
      return newRelationship.id; // Return the relationship ID for tracking
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  const deleteRelationship = useCallback(
    (relationshipId) => {
      if (!workingSchema) return;

      const currentRelationships = workingSchema.relationships || [];
      const rel = currentRelationships.find((r) => r.id === relationshipId);
      
      if (!rel) return;

      // Filter out the relationship to delete
      const newRelationships = currentRelationships.filter((r) => r.id !== relationshipId);

      // Check if this was the only FK reference for this column
      const otherRefs = newRelationships.filter(
        (r) =>
          r.fromTable === rel.fromTable &&
          r.fromColumn === rel.fromColumn,
      );

      // Check if the FK column should be deleted
      // Only delete if:
      // 1. Column is user-created (has isUserCreated flag)
      // 2. No other FKs reference this column
      // 3. Column did NOT exist in the original database schema (not a DB column)
      const fkColumn = workingSchema.tables[rel.fromTable]?.columns[rel.fromColumn];
      const existsInOriginalDB = originalSchema?.tables?.[rel.fromTable]?.columns?.[rel.fromColumn];
      const shouldDeleteColumn = fkColumn?.isUserCreated && otherRefs.length === 0 && !existsInOriginalDB;

      // Create deep copy with updated relationships
      let newSchema = {
        ...workingSchema,
        relationships: newRelationships
      };

      // If column should be deleted, remove it entirely
      if (shouldDeleteColumn) {
        const { [rel.fromColumn]: removed, ...remainingColumns} = workingSchema.tables[rel.fromTable].columns;
        newSchema.tables = {
          ...workingSchema.tables,
          [rel.fromTable]: {
            ...workingSchema.tables[rel.fromTable],
            columns: remainingColumns
          }
        };
        console.log('🗑️ Deleted user-created FK column:', rel.fromColumn);
      } else {
        // Otherwise just update FK status
        newSchema.tables = {
          ...workingSchema.tables,
          [rel.fromTable]: {
            ...workingSchema.tables[rel.fromTable],
            columns: {
              ...workingSchema.tables[rel.fromTable].columns,
              [rel.fromColumn]: {
                ...workingSchema.tables[rel.fromTable].columns[rel.fromColumn],
                fk: otherRefs.length > 0 // Keep FK true if other relationships exist
              }
            }
          }
        };
      }

      updateWorkingSchema(newSchema);
    },
    [workingSchema, updateWorkingSchema],
  );

  // NEW: Advanced relationship creation methods
  const createVirtualRelationship = useCallback(
    async (relationshipData) => {
      if (!workingSchema) return;

      try {
        // Import the relationship creation service
        const { createRelationship, validateRelationshipCreation } = await import('../services/relationshipCreationService.js');
        
        // Validate the relationship
        const errors = validateRelationshipCreation(
          workingSchema, 
          relationshipData.parentTable, 
          relationshipData.childTable, 
          relationshipData.type
        );

        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }

        // Create the relationship and update schema
        const updatedSchema = createRelationship(workingSchema, relationshipData);
        updateWorkingSchema(updatedSchema);

        return true;
        
      } catch (error) {
        throw error;
      }
    },
    [workingSchema, updateWorkingSchema],
  );

  // Table position operations
  const updateTablePosition = useCallback((tableName, position) => {
    setTablePositions(prev => ({
      ...prev,
      [tableName]: position
    }));
  }, []);

  const clearAllTablePositions = useCallback(() => {
    if (currentSchemaName) {
      clearTablePositions(currentSchemaName);
      setTablePositions({});
    }
  }, [currentSchemaName]);

  // Clean up off-screen table positions
  const cleanupOffScreenPositions = useCallback(() => {
    if (!currentSchemaName) return;
    
    const maxDistance = 2000;
    const cleanedPositions = {};
    let hasChanges = false;
    
    Object.entries(tablePositions).forEach(([tableName, position]) => {
      const distance = Math.sqrt(position.x * position.x + position.y * position.y);
      if (distance <= maxDistance) {
        cleanedPositions[tableName] = position;
      } else {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setTablePositions(cleanedPositions);
    }
  }, [currentSchemaName, tablePositions]);

  // NEW: Atomic FK column update - handles deleting old relationship, deleting old column, and adding new relationship
  const updateForeignKeyColumn = useCallback(
    (tableName, oldColumnName, newColumnName, toTable, toColumn) => {
      if (!workingSchema) return;

      console.log('🔄 Atomic FK update:', { tableName, oldColumnName, newColumnName, toTable, toColumn });

      // Find the old relationship
      const oldRelationship = (workingSchema.relationships || []).find(
        rel => rel.fromTable === tableName && rel.fromColumn === oldColumnName && rel.toTable === toTable
      );

      if (!oldRelationship) {
        throw new Error('Old relationship not found');
      }

      // Check if old column should be deleted (user-created)
      const oldColumn = workingSchema.tables[tableName]?.columns[oldColumnName];
      const shouldDeleteOldColumn = oldColumn?.isUserCreated && oldColumnName !== newColumnName;

      // Create new schema with all changes applied atomically
      let newSchema = { ...workingSchema };

      // 1. Remove old relationship
      newSchema.relationships = (workingSchema.relationships || []).filter(
        rel => rel.id !== oldRelationship.id
      );

      // 2. Delete old column if user-created
      if (shouldDeleteOldColumn) {
        const { [oldColumnName]: removed, ...remainingColumns } = newSchema.tables[tableName].columns;
        newSchema.tables = {
          ...newSchema.tables,
          [tableName]: {
            ...newSchema.tables[tableName],
            columns: remainingColumns
          }
        };
        console.log('🗑️ Deleted old user-created column:', oldColumnName);
      }

      // 3. Add new relationship
      const newRelationship = {
        id: uuidv4(),
        fromTable: tableName,
        fromColumn: newColumnName,
        toTable,
        toColumn,
        type: 'ONE_TO_MANY',
        isUserCreated: true,
        createdAt: Date.now(),
      };

      newSchema.relationships = [...newSchema.relationships, newRelationship];

      // 4. Update FK status on new column
      newSchema.tables = {
        ...newSchema.tables,
        [tableName]: {
          ...newSchema.tables[tableName],
          columns: {
            ...newSchema.tables[tableName].columns,
            [newColumnName]: {
              ...newSchema.tables[tableName].columns[newColumnName],
              fk: true
            }
          }
        }
      };

      // 5. Recalculate isIdentifying and cardinality for all relationships
      newSchema = recalculateIsIdentifying(newSchema);

      console.log('✅ Atomic FK update completed');
      updateWorkingSchema(newSchema);
      return newRelationship.id;
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  // NEW: Atomic FK update with new column creation - handles deleting old relationship and creating new column + relationship
  const updateForeignKeyWithNewColumn = useCallback(
    (tableName, oldColumnName, newColumnName, newColumnType, toTable, toColumn) => {
      if (!workingSchema) return;

      console.log('🔄 Atomic FK update with new column:', { tableName, oldColumnName, newColumnName, newColumnType, toTable, toColumn });

      // Find the old relationship
      const oldRelationship = (workingSchema.relationships || []).find(
        rel => rel.fromTable === tableName && rel.fromColumn === oldColumnName && rel.toTable === toTable
      );

      if (!oldRelationship) {
        throw new Error('Old relationship not found');
      }

      // Check if new column already exists
      if (workingSchema.tables[tableName]?.columns[newColumnName]) {
        throw new Error(`Column "${newColumnName}" already exists in table "${tableName}"`);
      }

      // Create new schema with all changes applied atomically
      let newSchema = { ...workingSchema };

      // 1. Remove old relationship
      newSchema.relationships = (workingSchema.relationships || []).filter(
        rel => rel.id !== oldRelationship.id
      );

      // 2. Check if old column still has other relationships after removing this one
      const otherRelationshipsOnOldColumn = newSchema.relationships.filter(
        rel => rel.fromTable === tableName && rel.fromColumn === oldColumnName
      );

      // 3. Update old column's FK flag if no other relationships use it
      if (otherRelationshipsOnOldColumn.length === 0) {
        newSchema.tables = {
          ...newSchema.tables,
          [tableName]: {
            ...newSchema.tables[tableName],
            columns: {
              ...newSchema.tables[tableName].columns,
              [oldColumnName]: {
                ...newSchema.tables[tableName].columns[oldColumnName],
                fk: false // No longer a FK
              }
            }
          }
        };
        console.log('✅ Updated old column FK flag to false:', oldColumnName);
      }

      // 4. Create new column
      newSchema.tables = {
        ...newSchema.tables,
        [tableName]: {
          ...newSchema.tables[tableName],
          columns: {
            ...newSchema.tables[tableName].columns,
            [newColumnName]: {
              name: newColumnName,
              type: newColumnType,
              pk: false,
              fk: true,
              unique: false,
              nullable: true,
              defaultValue: null,
              isUserCreated: true, // Mark as user-created so it can be deleted later
            }
          }
        }
      };

      // 5. Add new relationship
      const newRelationship = {
        id: uuidv4(),
        fromTable: tableName,
        fromColumn: newColumnName,
        toTable,
        toColumn,
        type: 'ONE_TO_MANY',
        isUserCreated: true,
        createdAt: Date.now(),
      };

      newSchema.relationships = [...newSchema.relationships, newRelationship];

      // 6. Recalculate isIdentifying and cardinality for all relationships
      newSchema = recalculateIsIdentifying(newSchema);

      console.log('✅ Atomic FK update with new column completed');
      updateWorkingSchema(newSchema);
      return newRelationship.id;
    },
    [workingSchema, updateWorkingSchema, recalculateIsIdentifying],
  );

  // Helper function to detect if a table is a junction table (even if not marked)
  const isTableJunctionTable = useCallback((tableName, tableData) => {
    // Check if explicitly marked as junction table
    if (tableData.isJunctionTable && tableData.junctionFor) {
      return { isJunction: true, junctionFor: tableData.junctionFor };
    }

    // Detect junction table by structure:
    // 1. Has exactly 2 columns (or 2 PK columns if more columns exist)
    // 2. Both columns are PK and FK
    // 3. Both columns reference different tables
    const columns = Object.entries(tableData.columns || {});
    const pkColumns = columns.filter(([name, col]) => col.pk);
    const fkColumns = columns.filter(([name, col]) => col.fk);

    // Must have exactly 2 PK columns that are also FKs
    if (pkColumns.length !== 2 || fkColumns.length < 2) {
      return { isJunction: false };
    }

    // Check if both PK columns are also FKs
    const pkFkColumns = pkColumns.filter(([name, col]) => col.fk);
    if (pkFkColumns.length !== 2) {
      return { isJunction: false };
    }

    // Find which tables these FKs reference
    const relationships = workingSchema?.relationships || [];
    const referencedTables = pkFkColumns.map(([colName]) => {
      const rel = relationships.find(r => r.fromTable === tableName && r.fromColumn === colName);
      return rel?.toTable;
    }).filter(Boolean);

    // Must reference exactly 2 different tables (or same table for self-referencing)
    if (referencedTables.length === 2) {
      return { isJunction: true, junctionFor: referencedTables.sort() };
    }

    return { isJunction: false };
  }, [workingSchema]);

  // NEW: Create Many-to-Many relationship with junction table
  const addManyToManyRelationship = useCallback(
    (table1, table1Column, table2, table2Column, junctionTableName = null) => {
      if (!workingSchema) return;

      console.log('🔄 Creating N:M relationship:', { table1, table1Column, table2, table2Column, junctionTableName });

      // CRITICAL: Check if N:M relationship already exists between these two tables
      // Look for any junction table that connects these two tables
      const sortedTables = [table1, table2].sort();
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
        throw new Error(
          `N:M relationship already exists between "${table1}" and "${table2}" via junction table "${existingJunctionName}".\n\n` +
          `You cannot create multiple N:M relationships between the same two tables.\n\n` +
          `If you need to modify the relationship, delete the existing junction table first.`
        );
      }

      // Generate junction table name if not provided (alphabetically sorted)
      const autoJunctionName = [table1, table2].sort().join('_');
      const finalJunctionName = junctionTableName || autoJunctionName;

      // Validate: Check if junction table name already exists (for different tables)
      if (workingSchema.tables[finalJunctionName]) {
        const existingTable = workingSchema.tables[finalJunctionName];
        
        if (existingTable.isJunctionTable && existingTable.junctionFor) {
          // It's a junction table for different tables
          throw new Error(
            `Junction table "${finalJunctionName}" already exists for tables: ${existingTable.junctionFor.join(' and ')}.\n\n` +
            `Please choose a different junction table name.`
          );
        } else {
          // It's a regular table with the same name
          throw new Error(
            `Table "${finalJunctionName}" already exists in the schema.\n\n` +
            `Please choose a different junction table name.\n\n` +
            `Suggestions:\n` +
            `- ${finalJunctionName}_junction\n` +
            `- ${finalJunctionName}_link\n` +
            `- ${finalJunctionName}_map`
          );
        }
      }

      // Validate: Both tables must exist
      if (!workingSchema.tables[table1] || !workingSchema.tables[table2]) {
        throw new Error('Both tables must exist in the schema');
      }

      // Validate: Both columns must exist and be PK or UNIQUE
      const table1Col = workingSchema.tables[table1].columns[table1Column];
      const table2Col = workingSchema.tables[table2].columns[table2Column];

      if (!table1Col || !table2Col) {
        throw new Error('Both columns must exist in their respective tables');
      }

      if (!table1Col.pk && !table1Col.unique) {
        throw new Error(`Column "${table1Column}" in table "${table1}" must be PRIMARY KEY or UNIQUE`);
      }

      if (!table2Col.pk && !table2Col.unique) {
        throw new Error(`Column "${table2Column}" in table "${table2}" must be PRIMARY KEY or UNIQUE`);
      }

      // Generate FK column names for junction table
      const generateFKName = (tableName, columnName) => {
        const tableNameLower = tableName.toLowerCase();
        const columnNameLower = columnName.toLowerCase();
        
        // If column is just 'id', use table_id format
        if (columnNameLower === 'id') {
          return `${tableNameLower}_id`;
        }
        
        // If column already contains table name, use as-is
        if (columnNameLower.includes(tableNameLower)) {
          return columnNameLower;
        }
        
        // Otherwise combine table_column format
        return `${tableNameLower}_${columnNameLower}`;
      };

      let fk1Name = generateFKName(table1, table1Column);
      let fk2Name = generateFKName(table2, table2Column);

      // Handle self-referencing N:M (e.g., users -> users)
      if (table1 === table2 && fk1Name === fk2Name) {
        // Make FK names distinct for self-referencing
        fk1Name = `${fk1Name}_1`;
        fk2Name = `${fk2Name}_2`;
      }

      // Create junction table with composite PK
      const junctionTable = {
        name: finalJunctionName,
        columns: {
          [fk1Name]: {
            name: fk1Name,
            type: table1Col.type,
            pk: true, // Part of composite PK
            fk: true,
            unique: false,
            nullable: false,
            isUserCreated: true,
            compositeKey: true, // Mark as part of composite key
          },
          [fk2Name]: {
            name: fk2Name,
            type: table2Col.type,
            pk: true, // Part of composite PK
            fk: true,
            unique: false,
            nullable: false,
            isUserCreated: true,
            compositeKey: true, // Mark as part of composite key
          }
        },
        isUserCreated: true, // Mark entire table as user-created
        isJunctionTable: true, // Mark as junction table for N:M
        junctionFor: [table1, table2].sort() // Track which tables this joins
      };

      // Create two 1:N identifying relationships
      const relationship1 = {
        id: uuidv4(),
        fromTable: finalJunctionName,
        fromColumn: fk1Name,
        toTable: table1,
        toColumn: table1Column,
        type: 'ONE_TO_MANY',
        cardinalityType: '1:N',
        constraintName: `fk_${finalJunctionName}_${fk1Name}`,
        isUserCreated: true,
        createdAt: Date.now(),
        lineStyle: 'solid', // N:M is always identifying
        isIdentifying: true,
        isJunctionRelationship: true, // Mark as part of N:M
        junctionTable: finalJunctionName
      };

      const relationship2 = {
        id: uuidv4(),
        fromTable: finalJunctionName,
        fromColumn: fk2Name,
        toTable: table2,
        toColumn: table2Column,
        type: 'ONE_TO_MANY',
        cardinalityType: '1:N',
        constraintName: `fk_${finalJunctionName}_${fk2Name}`,
        isUserCreated: true,
        createdAt: Date.now(),
        lineStyle: 'solid', // N:M is always identifying
        isIdentifying: true,
        isJunctionRelationship: true, // Mark as part of N:M
        junctionTable: finalJunctionName
      };

      // Create new schema with all changes applied atomically
      const newSchema = {
        ...workingSchema,
        tables: {
          ...workingSchema.tables,
          [finalJunctionName]: junctionTable
        },
        relationships: [
          ...(workingSchema.relationships || []),
          relationship1,
          relationship2
        ]
      };

      console.log('✅ N:M relationship created:', {
        junctionTable: finalJunctionName,
        relationships: [relationship1.id, relationship2.id]
      });

      updateWorkingSchema(newSchema);
      
      return {
        junctionTableName: finalJunctionName,
        relationship1Id: relationship1.id,
        relationship2Id: relationship2.id
      };
    },
    [workingSchema, updateWorkingSchema, isTableJunctionTable],
  );

  const value = {
    // State
    originalSchema,
    workingSchema,
    isModified,
    hasUnsavedChanges, // NEW: Expose unsaved changes state
    lastSavedTimestamp, // NEW: Expose last saved timestamp
    isSwitchingSchema,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    tablePositions,

    // Core operations
    initializeSchema,
    resetToOriginal,
    forceRefreshFromBackend,
    refreshAndMerge,
    saveChangesToPersistence, // NEW: Manual save function
    refreshFromPersistence, // NEW: Manual refresh function
    checkForNewerChanges, // NEW: Check for newer changes from other users
    clearVirtualSchema,
    clearAllVirtualSchemas,
    updateWorkingSchema, // Add this method for FK comparison
    setOriginalSchema, // Add this method for auto-refresh
    undo,
    redo,

    // Table operations
    addTable,
    deleteTable,
    renameTable,

    // Column operations
    addColumn,
    deleteColumn,
    updateColumn,
    renameColumn,

    // Constraint operations
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,

    // Relationship operations
    addRelationship,
    addForeignKeyWithNewColumn, // NEW: Atomic FK creation with new column
    updateForeignKeyColumn, // NEW: Atomic FK column update
    updateForeignKeyWithNewColumn, // NEW: Atomic FK update with new column creation
    addManyToManyRelationship, // NEW: N:M relationship creation
    isTableJunctionTable, // NEW: Helper to detect junction tables
    deleteRelationship,
    createVirtualRelationship, // NEW: Advanced relationship creation

    // Table position operations
    updateTablePosition,
    clearAllTablePositions,
    cleanupOffScreenPositions,

    // Utility functions
    getMergeSummary,
  };

  return (
    <VirtualSchemaContext.Provider value={value}>
      {children}
    </VirtualSchemaContext.Provider>
  );
};
